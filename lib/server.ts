import argon2 from 'argon2';
import { randomBytes, createHash, createHmac, pbkdf2 as pbkdf2Callback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getDatabase, type BoundStatement } from '../db';
import { applyAction, initialState, visibleState, isParent, names, DomainError, type Person, type State, type Action } from './domain';
import { settleCycles } from './cycles';

type Stored = { id: number; revision: number; data: string; credentials: string };
type Session = { token: string; profile: Person | null; expires: number; parent_until: number; remember_token: string | null };
type Hash = { salt: string; hash: string; algorithm?: 'argon2id' | 'pbkdf2' };
type Credentials = { password: Hash; codes?: Record<Person, Hash>; pins?: Record<Person, Hash>; pendingCodes?: Record<Person, string[]> };
const animalIds = ['bengal', 'panda', 'fox', 'otter', 'owl', 'frog', 'lion', 'bunny', 'koala', 'dog', 'penguin', 'flamingo'];
const SESSION_MS = 12 * 60 * 60 * 1000;
const DEVICE_MS = 365 * 24 * 60 * 60 * 1000;
const PARENT_MS = 15 * 60 * 1000;
const db = () => (globalThis as typeof globalThis & { __taskXpTestDB?: ReturnType<typeof getDatabase> }).__taskXpTestDB ?? getDatabase();
const hex = (value: Buffer) => value.toString('hex');
const random = () => hex(randomBytes(32));
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const pbkdf2 = promisify(pbkdf2Callback);
function pepper(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === 'production' && (!secret || !/^[a-f0-9]{64,}$/i.test(secret))) throw new Error('SESSION_SECRET must be at least 32 random bytes encoded as hex');
  return createHmac('sha256', secret || 'local-development-only-task-xp-pepper').update(value).digest('hex');
}

async function passwordHash(value: string): Promise<Hash> {
  return { salt: '', hash: await argon2.hash(pepper(value), { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }), algorithm: 'argon2id' };
}
async function matches(value: unknown, stored: Hash) {
  if (typeof value !== 'string' || value.length > 256) return false;
  if (stored.algorithm === 'argon2id' || stored.hash.startsWith('$argon2id$')) {
    try { return await argon2.verify(stored.hash, pepper(value)); } catch { return false; }
  }
  // Verify older PBKDF2 records and replace them with Argon2id on a successful login.
  try {
    const candidate = await pbkdf2(value, stored.salt, 100000, 32, 'sha256') as Buffer;
    const expected = Buffer.from(stored.hash, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch { return false; }
}
function validAnimalCode(value: unknown): value is string {
  return typeof value === 'string' && value.split('.').length === 4 && value.split('.').every((animal) => animalIds.includes(animal));
}
async function codeHashes(codes: Record<Person, string[]>) {
  const result = {} as Record<Person, Hash>;
  for (const profile of Object.keys(names) as Person[]) result[profile] = await passwordHash(codes[profile].join('.'));
  return result;
}
function makeAnimalCodes() {
  const result = {} as Record<Person, string[]>;
  const used = new Set<string>();
  for (const profile of Object.keys(names) as Person[]) {
    let code: string[];
    let key: string;
    do {
      code = [];
      while (code.length < 4) {
        const animal = animalIds[randomBytes(4).readUInt32BE() % animalIds.length];
        if (!code.includes(animal)) code.push(animal);
      }
      key = code.join('.');
    } while (used.has(key));
    used.add(key);
    result[profile] = code;
  }
  return result;
}
function secureCookie(request: Request) {
  const publicOrigin = process.env.PUBLIC_ORIGIN;
  return publicOrigin ? new URL(publicOrigin).protocol === 'https:' : new URL(request.url).protocol === 'https:';
}
function cookie(request: Request, name: string, value: string, maxAge?: number) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict${maxAge === undefined ? '' : `; Max-Age=${maxAge}`}${secureCookie(request) ? '; Secure' : ''}`;
}
function requestCookies(request: Request) {
  const all = request.headers.get('cookie') ?? '';
  const read = (name: string) => all.match(new RegExp(`(?:^|;\\s*)${name}=([a-f0-9]{64})(?:;|$)`))?.[1] ?? null;
  return { session: read('txp_session'), device: read('txp_remember') };
}
async function readSession(request: Request): Promise<Session | null> {
  const value = requestCookies(request).session;
  if (!value) return null;
  return db().prepare('SELECT * FROM sessions WHERE token = ? AND expires > ?').bind(digest(value), Date.now()).first<Session>();
}
async function newSession(request: Request, profile: Person | null, old?: Session | null, rememberChoice?: boolean) {
  const value = random();
  let rememberToken = rememberChoice === false ? null : old?.remember_token ?? null;
  let deviceCookie: string | null = null;
  const now = Date.now();
  const statements: BoundStatement[] = [];

  if (rememberChoice === true) {
    if (old?.remember_token) statements.push(db().prepare('DELETE FROM remember_devices WHERE token = ?').bind(old.remember_token));
    const deviceValue = random();
    rememberToken = digest(deviceValue);
    statements.push(db().prepare('INSERT INTO remember_devices (token, expires, created) VALUES (?, ?, ?)').bind(rememberToken, now + DEVICE_MS, now));
    deviceCookie = cookie(request, 'txp_remember', deviceValue, Math.floor(DEVICE_MS / 1000));
  } else if (rememberChoice === false && old?.remember_token) {
    statements.push(db().prepare('DELETE FROM remember_devices WHERE token = ?').bind(old.remember_token));
  }

  const expires = now + SESSION_MS;
  const parentUntil = profile && isParent(profile) ? now + PARENT_MS : 0;
  statements.push(db().prepare('INSERT INTO sessions (token, profile, expires, parent_until, remember_token) VALUES (?, ?, ?, ?, ?)').bind(digest(value), profile, expires, parentUntil, rememberToken));
  if (old) statements.push(db().prepare('DELETE FROM sessions WHERE token = ?').bind(old.token));
  statements.push(db().prepare('DELETE FROM sessions WHERE expires < ?').bind(now));
  statements.push(db().prepare('DELETE FROM remember_devices WHERE expires < ?').bind(now));
  await db().batch(statements);
  const sessionCookie = cookie(request, 'txp_session', value, Math.floor(SESSION_MS / 1000));
  return [sessionCookie, ...(deviceCookie ? [deviceCookie] : rememberChoice === false ? [cookie(request, 'txp_remember', '', 0)] : [])];
}
async function restoreDevice(request: Request) {
  const raw = requestCookies(request).device;
  if (!raw) return { session: null as Session | null, cookies: [] as string[] };
  const oldToken = digest(raw);
  const device = await db().prepare('SELECT token, expires FROM remember_devices WHERE token = ? AND expires > ?').bind(oldToken, Date.now()).first<{ token: string; expires: number }>();
  if (!device) return { session: null, cookies: [cookie(request, 'txp_remember', '', 0)] };
  const rotatedValue = random();
  const rotatedToken = digest(rotatedValue);
  const now = Date.now();
  const sessionValue = random();
  const expires = now + SESSION_MS;
  const rotate = db().prepare('UPDATE remember_devices SET token = ? WHERE token = ? AND expires > ?').bind(rotatedToken, oldToken, now);
  const insertSession = db().prepare('INSERT INTO sessions (token, profile, expires, parent_until, remember_token) SELECT ?, NULL, ?, 0, ? WHERE EXISTS (SELECT 1 FROM remember_devices WHERE token = ?)').bind(digest(sessionValue), expires, rotatedToken, rotatedToken);
  const removeExpired = db().prepare('DELETE FROM sessions WHERE expires < ?').bind(now);
  const result = await db().batch([rotate, insertSession, removeExpired]);
  if (!result[0]?.meta?.changes || !result[1]?.meta?.changes) return { session: null, cookies: [cookie(request, 'txp_remember', '', 0)] };
  const session: Session = { token: digest(sessionValue), profile: null, expires, parent_until: 0, remember_token: rotatedToken };
  return { session, cookies: [cookie(request, 'txp_session', sessionValue, Math.floor(SESSION_MS / 1000)), cookie(request, 'txp_remember', rotatedValue, Math.max(0, Math.floor((device.expires - now) / 1000)))] };
}
async function limit(key: string) {
  const now = Date.now();
  await db().prepare('INSERT INTO attempts (key, count, until) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN until <= ? THEN 1 ELSE count + 1 END, until = CASE WHEN until <= ? THEN ? ELSE until END').bind(key, now + 15 * 60000, now, now, now + 15 * 60000).run();
  const row = await db().prepare('SELECT count FROM attempts WHERE key = ?').bind(key).first<{ count: number }>();
  if (row && row.count > 10) throw new DomainError('rate');
}
function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected = process.env.PUBLIC_ORIGIN ? new URL(process.env.PUBLIC_ORIGIN).origin : new URL(request.url).origin;
  if (!origin || origin !== expected) throw new DomainError('origin');
}
function setupAllowed(request: Request, body?: Record<string, unknown>) {
  const host = new URL(request.url).hostname;
  const local = process.env.NODE_ENV !== 'production' && (host === 'localhost' || host === '127.0.0.1');
  const secret = process.env.TASK_XP_SETUP_TOKEN;
  if (local) return true;
  if (!secret || secret.length < 32 || typeof body?.setupToken !== 'string') return false;
  const actual = Buffer.from(body.setupToken);
  const expected = Buffer.from(secret);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function responseState(row: Stored, session: Session | null) {
  return { initialized: true, authenticated: !!session, profile: session?.profile ?? null, parentUntil: session?.parent_until ?? 0, state: session?.profile ? visibleState(JSON.parse(row.data), session.profile) : null };
}
function response(data: unknown, status = 200, cookies: string[] = []) {
  const result = new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
  for (const value of cookies) result.headers.append('set-cookie', value);
  return result;
}

export async function handle(request: Request) {
  const responseCookies: string[] = [];
  const reply = (data: unknown, status = 200, cookies: string[] = []) => response(data, status, [...responseCookies, ...cookies]);
  try {
    let row = await db().prepare('SELECT * FROM family WHERE id = 1').first<Stored>();
    let session = await readSession(request);
    if (!session) {
      const restored = await restoreDevice(request);
      session = restored.session;
      responseCookies.push(...restored.cookies);
    }
    if (session?.profile && isParent(session.profile) && session.parent_until > 0 && session.parent_until <= Date.now()) {
      responseCookies.push(...await newSession(request, null, session));
      session = null;
    }
    if (row && session?.profile) {
      for (let retry = 0; retry < 5; retry++) {
        const data = JSON.stringify(settleCycles(JSON.parse(row.data)));
        if (data === row.data) break;
        const result = await db().prepare('UPDATE family SET data = ?, revision = revision + 1 WHERE id = 1 AND revision = ?').bind(data, row.revision).run();
        if (result.meta.changes) { row = { ...row, data, revision: row.revision + 1 }; break; }
        row = await db().prepare('SELECT * FROM family WHERE id = 1').first<Stored>();
        if (!row) throw new DomainError('missing');
        if (retry === 4) throw new DomainError('conflict');
      }
    }
    if (request.method === 'GET') return reply(row ? responseState(row, session) : { initialized: false, localSetup: setupAllowed(request) });
    checkOrigin(request);
    const raw = await request.text();
    if (raw.length > 16000) return reply({ error: 'invalid' }, 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return reply({ error: 'invalid' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new DomainError('invalid');
    const op = body.op;
    const ip = process.env.TASK_XP_TRUST_PROXY === 'true' ? request.headers.get('x-real-ip') ?? 'unknown' : 'local';
    if (op === 'setup') {
      if (row) throw new DomainError('already');
      if (!setupAllowed(request, body)) throw new DomainError('setup');
      if (typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 128) throw new DomainError('password');
      const generated = makeAnimalCodes();
      const credentials: Credentials = { password: await passwordHash(body.password), codes: await codeHashes(generated), pendingCodes: generated };
      const state = initialState();
      await db().prepare('INSERT INTO family (id, revision, data, credentials) VALUES (1, 0, ?, ?)').bind(JSON.stringify(state), JSON.stringify(credentials)).run();
      return reply({ ok: true, animalCodes: generated }, 200, await newSession(request, null));
    }
    if (!row) throw new DomainError('setup');
    if (op === 'login') {
      await limit('login:' + digest(ip));
      const credentials: Credentials = JSON.parse(row.credentials);
      if (!await matches(body.password, credentials.password)) throw new DomainError('credentials');
      const upgraded = credentials.password.algorithm !== 'argon2id' && !credentials.password.hash.startsWith('$argon2id$');
      if (upgraded) credentials.password = await passwordHash(String(body.password));
      const reveal = credentials.pendingCodes;
      if (reveal) delete credentials.pendingCodes;
      if (upgraded || reveal) await db().prepare('UPDATE family SET credentials = ? WHERE id = 1').bind(JSON.stringify(credentials)).run();
      return reply({ ok: true, ...(reveal ? { animalCodes: reveal } : {}) }, 200, await newSession(request, null, session, body.remember === true));
    }
    if (!session) return reply({ error: 'session' }, 401);
    if (op === 'logout') {
      await db().batch([
        db().prepare('DELETE FROM sessions WHERE token = ?').bind(session.token),
        ...(session.remember_token ? [db().prepare('DELETE FROM remember_devices WHERE token = ?').bind(session.remember_token)] : []),
      ]);
      return reply({ ok: true }, 200, [cookie(request, 'txp_session', '', 0), cookie(request, 'txp_remember', '', 0)]);
    }
    if (op === 'lock') return reply({ ok: true }, 200, await newSession(request, null, session));
    if (op === 'unlock') {
      await limit('pin-auto:' + digest(ip));
      const credentials: Credentials = JSON.parse(row.credentials), stored = credentials.codes ?? credentials.pins;
      if (!stored) throw new DomainError('credentials');
      const candidate = body.code ?? body.pin;
      const found: Person[] = [];
      for (const profile of Object.keys(names) as Person[]) if (await matches(candidate, stored[profile])) found.push(profile);
      if (!found.length) throw new DomainError('credentials');
      if (found.length > 1) return reply({ needsProfile: true });
      return reply({ ok: true }, 200, await newSession(request, found[0], session));
    }
    if (op === 'profile') {
      const profile = body.profile as Person;
      if (!Object.hasOwn(names, profile)) throw new DomainError('invalid');
      await limit('pin:' + profile + ':' + digest(ip));
      const credentials: Credentials = JSON.parse(row.credentials), stored = credentials.codes ?? credentials.pins;
      if (!stored || !await matches(body.code ?? body.pin, stored[profile])) throw new DomainError('credentials');
      return reply({ ok: true }, 200, await newSession(request, profile, session));
    }
    if (!session.profile) return reply({ error: 'session' }, 401);
    if (op === 'security') {
      if (!isParent(session.profile)) throw new DomainError('forbidden');
      const credentials: Credentials = JSON.parse(row.credentials), stored = credentials.codes ?? credentials.pins;
      if (!stored) throw new DomainError('credentials');
      await limit('security:' + digest(ip));
      if (!await matches(body.currentCode ?? body.currentPin, stored[session.profile])) throw new DomainError('credentials');
      if (typeof body.password === 'string' && body.password) {
        if (body.password.length < 10 || body.password.length > 128) throw new DomainError('password');
        credentials.password = await passwordHash(body.password);
      }
      if (body.profile) {
        const profile = body.profile as Person, code = body.code ?? body.pin;
        if (!Object.hasOwn(names, profile) || !validAnimalCode(code)) throw new DomainError('pin');
        for (const other of Object.keys(names) as Person[]) if (other !== profile && await matches(code, stored[other])) throw new DomainError('pin');
        credentials.codes ??= {} as Record<Person, Hash>;
        credentials.codes[profile] = await passwordHash(code);
      }
      await db().batch([
        db().prepare('UPDATE family SET credentials = ? WHERE id = 1').bind(JSON.stringify(credentials)),
        db().prepare('DELETE FROM sessions WHERE token != ?').bind(session.token),
        ...(!session.remember_token ? [db().prepare('DELETE FROM remember_devices').bind()] : [db().prepare('DELETE FROM remember_devices WHERE token != ?').bind(session.remember_token)]),
      ]);
      return reply({ ok: true });
    }
    if (op === 'export') {
      if (!isParent(session.profile)) throw new DomainError('forbidden');
      return reply({ exportedAt: new Date().toISOString(), data: JSON.parse(row.data) });
    }
    if (op !== 'action' || !body.action || typeof body.action !== 'object') throw new DomainError('invalid');
    for (let retry = 0; retry < 5; retry++) {
      const current = retry === 0 ? row : await db().prepare('SELECT * FROM family WHERE id = 1').first<Stored>();
      if (!current) throw new DomainError('missing');
      const state = applyAction(JSON.parse(current.data) as State, session.profile, body.action as Action);
      const result = await db().prepare('UPDATE family SET data = ?, revision = revision + 1 WHERE id = 1 AND revision = ?').bind(JSON.stringify(state), current.revision).run();
      if (result.meta.changes) return reply({ ok: true, state: visibleState(state, session.profile) });
    }
    return reply({ error: 'conflict' }, 409);
  } catch (error) {
    if (error instanceof DomainError) return reply({ error: error.code }, error.code === 'forbidden' ? 403 : error.code === 'rate' ? 429 : 400);
    console.error('Task XP API failure', error instanceof Error ? error.message : 'unknown');
    return reply({ error: 'storage' }, 503);
  }
}

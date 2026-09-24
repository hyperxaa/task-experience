import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const sql = new DatabaseSync(':memory:');
sql.exec(`
  CREATE TABLE family (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL, credentials TEXT NOT NULL);
  CREATE TABLE sessions (token TEXT PRIMARY KEY, profile TEXT, expires INTEGER NOT NULL, parent_until INTEGER NOT NULL DEFAULT 0, remember_token TEXT);
  CREATE TABLE attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL);
  CREATE TABLE remember_devices (token TEXT PRIMARY KEY, expires INTEGER NOT NULL, created INTEGER NOT NULL);
`);
const adapter = {
  prepare(query) {
    let values = [];
    const statement = {
      bind(...next) { values = next; return statement; },
      first() { return sql.prepare(query).get(...values) ?? null; },
      run() { const result = sql.prepare(query).run(...values); return { meta: { changes: Number(result.changes) } }; },
    };
    return statement;
  },
  batch(statements) { return statements.map((statement) => statement.run()); },
};
globalThis.__taskXpTestDB = adapter;

const compile = (source) => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const cycles = moduleUrl(compile(readFileSync('lib/cycles.ts', 'utf8')));
const weeklyBonuses = moduleUrl(compile(readFileSync('lib/weekly-bonuses.ts', 'utf8')).replace("from './cycles.ts'", `from '${cycles}'`));
const domain = moduleUrl(compile(readFileSync('lib/domain.ts', 'utf8')).replace("from './cycles.ts'", `from '${cycles}'`).replace("from './weekly-bonuses.ts'", `from '${weeklyBonuses}'`));
const require = createRequire(import.meta.url);
const argon2Url = pathToFileURL(require.resolve('argon2')).href;
let serverSource = compile(readFileSync('lib/server.ts', 'utf8'))
  .replace("import { getDatabase } from '../db';", 'const getDatabase=()=>globalThis.__taskXpTestDB;')
  .replace("from 'argon2'", `from '${argon2Url}'`)
  .replace("from './domain'", `from '${domain}'`)
  .replace("from './cycles'", `from '${cycles}'`)
  .replace("from './weekly-bonuses'", `from '${weeklyBonuses}'`);
const { handle } = await import(moduleUrl(serverSource));

const jar = new Map();
async function request(body, { origin = 'http://localhost', method = 'POST', extraHeaders = {} } = {}) {
  const headers = { origin, ...extraHeaders, ...(jar.size ? { cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; ') } : {}) };
  const response = await handle(new Request('http://localhost/api/xp', {
    method,
    headers,
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  }));
  const setCookies = response.headers.getSetCookie();
  for (const value of setCookies) {
    const [pair] = value.split(';');
    const separator = pair.indexOf('=');
    const name = pair.slice(0, separator), token = pair.slice(separator + 1);
    if (token) jar.set(name, token); else jar.delete(name);
  }
  return { status: response.status, data: await response.json(), setCookies, setCookie: setCookies.join('\n') };
}

const password = 'test-family-secret-2026';
let codes;

test('access lifecycle: short session, remembered device, parent boundary and revocation', async () => {
  const setup = await request({ op: 'setup', password });
  assert.equal(setup.status, 200);
  codes = setup.data.animalCodes;
  const setupCredentials = JSON.parse(sql.prepare('SELECT credentials FROM family').get().credentials);
  assert.equal(setupCredentials.pendingCodes, undefined);
  assert.equal(typeof setupCredentials.pendingCodesEncrypted, 'string');
  assert.equal(JSON.stringify(setupCredentials).includes(codes.aina.join('.')), false);
  assert.match(setup.setCookie, /Max-Age=43200/);
  const code = (profile) => codes[profile].join('.');

  assert.equal((await request({ op: 'login', password: 'wrong', remember: true })).status, 400);
  const login = await request({ op: 'login', password, remember: true });
  assert.equal(login.status, 200);
  assert.deepEqual(login.data.animalCodes, codes);
  assert.equal(JSON.parse(sql.prepare('SELECT credentials FROM family').get().credentials).pendingCodesEncrypted, undefined);
  assert.match(login.setCookie, /Max-Age=43200/);
  assert.match(login.setCookie, /txp_remember=.*Max-Age=31536000/);
  assert.match(login.setCookie, /HttpOnly; SameSite=Strict/);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM remember_devices').get().n, 1);

  const sessionBefore = jar.get('txp_session');
  const unlock = await request({ op: 'unlock', code: code('aina') });
  assert.equal(unlock.status, 200);
  assert.notEqual(jar.get('txp_session'), sessionBefore);
  assert.equal((await request(null, { method: 'GET' })).data.profile, 'aina');
  assert.equal((await request({ op: 'security', currentCode: code('aina'), password: 'changed-password' })).status, 403);
  await request({ op: 'lock' });
  assert.equal((await request(null, { method: 'GET' })).data.profile, null);

  await request({ op: 'unlock', code: code('xavi') });
  assert.ok((await request(null, { method: 'GET' })).data.parentUntil > Date.now());
  assert.equal((await request({ op: 'security', currentCode: code('xavi'), profile: 'iara', code: code('aina') })).data.error, 'pin');
  const changedCode = 'bengal.flamingo.penguin.koala';
  assert.equal((await request({ op: 'security', currentCode: code('xavi'), profile: 'iara', code: changedCode })).status, 200);
  await request({ op: 'lock' });
  await request({ op: 'unlock', code: changedCode });
  assert.equal((await request(null, { method: 'GET' })).data.profile, 'iara');
  assert.equal((await request({ op: 'lock' }, { origin: 'http://evil.test' })).data.error, 'origin');

  const logout = await request({ op: 'logout' });
  assert.equal(logout.status, 200);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM remember_devices').get().n, 0);
  assert.equal(jar.has('txp_remember'), false);
  assert.equal((await request(null, { method: 'GET' })).data.authenticated, false);

  const transient = await request({ op: 'login', password, remember: false });
  assert.equal(transient.status, 200);
  assert.equal(transient.data.animalCodes, undefined);
  assert.match(transient.setCookie, /Max-Age=43200/);
  assert.match(transient.setCookie, /txp_remember=; Path=\/; HttpOnly; SameSite=Strict; Max-Age=0/);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM remember_devices').get().n, 0);
});

test('expired session restores from a rotating one-year device token', async () => {
  await request({ op: 'logout' });
  await request({ op: 'login', password, remember: true });
  const firstDevice = sql.prepare('SELECT token FROM remember_devices').get().token;
  sql.prepare('UPDATE sessions SET expires = 1').run();
  const restored = await request(null, { method: 'GET' });
  assert.equal(restored.data.authenticated, true);
  assert.equal(restored.data.profile, null);
  const secondDevice = sql.prepare('SELECT token FROM remember_devices').get().token;
  assert.notEqual(secondDevice, firstDevice);
  assert.match(restored.setCookie, /txp_remember=.*Max-Age=\d+/);
  await request({ op: 'logout' });
  assert.equal(sql.prepare('SELECT count(*) AS n FROM remember_devices').get().n, 0);
});

test('animal-code attempts are limited across all profiles', async () => {
  await request({ op: 'login', password, remember: false });
  sql.exec('DELETE FROM attempts');
  for (let i = 0; i < 10; i++) assert.equal((await request({ op: 'unlock', code: 'fox.fox.fox.fox' })).status, 400);
  assert.equal((await request({ op: 'unlock', code: codes.aina.join('.') })).status, 429);
});

test('correct profile selections do not consume the failed-attempt allowance', async () => {
  sql.exec('DELETE FROM attempts');
  await request({ op: 'login', password, remember: false });
  for (let i = 0; i < 11; i++) assert.equal((await request({ op: 'unlock', code: codes.aina.join('.') })).status, 200);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM attempts WHERE key LIKE 'pin-auto:%'").get().n, 0);
});

test('duplicate animal code never selects an arbitrary profile', async () => {
  await request({ op: 'login', password, remember: false });
  sql.exec('DELETE FROM attempts');
  const credentials = JSON.parse(sql.prepare('SELECT credentials FROM family').get().credentials);
  credentials.codes.iara = credentials.codes.aina;
  sql.prepare('UPDATE family SET credentials=?').run(JSON.stringify(credentials));
  await request({ op: 'lock' });
  assert.equal((await request({ op: 'unlock', code: codes.aina.join('.') })).data.needsProfile, true);
  assert.equal((await request(null, { method: 'GET' })).data.profile, null);
});

test('legacy plaintext pending animal codes are encrypted on first read', async () => {
  const credentials = JSON.parse(sql.prepare('SELECT credentials FROM family').get().credentials);
  credentials.pendingCodes = codes;
  sql.prepare('UPDATE family SET credentials=?').run(JSON.stringify(credentials));
  await request(null, { method: 'GET' });
  const upgraded = JSON.parse(sql.prepare('SELECT credentials FROM family').get().credentials);
  assert.equal(upgraded.pendingCodes, undefined);
  assert.equal(typeof upgraded.pendingCodesEncrypted, 'string');
  assert.equal(JSON.stringify(upgraded).includes(codes.aina.join('.')), false);
  const login = await request({ op: 'login', password, remember: false });
  assert.deepEqual(login.data.animalCodes, codes);
});

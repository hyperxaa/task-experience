import { argon2idAsync } from '@noble/hashes/argon2.js';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const MEMORY_KIB = 19456;
const ITERATIONS = 2;
const PARALLELISM = 1;

export async function hashArgon2id(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await argon2idAsync(password, salt, { t: ITERATIONS, m: MEMORY_KIB, p: PARALLELISM, dkLen: 32, maxmem: MEMORY_KIB * 1024 });
  return `$argon2id$v=19$m=${MEMORY_KIB},t=${ITERATIONS},p=${PARALLELISM}$${salt.toString('base64').replace(/=+$/,'')}$${Buffer.from(key).toString('base64').replace(/=+$/,'')}`;
}

export async function verifyArgon2id(encoded: string, password: string): Promise<boolean> {
  const match = /^\$argon2id\$v=(\d+)\$([mtp]=\d+,[mtp]=\d+,[mtp]=\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(encoded);
  if (!match) return false;
  const [, versionText, paramsText, saltText, hashText] = match;
  const params = Object.fromEntries(paramsText.split(',').map(entry => entry.split('=')));
  if (Object.keys(params).length !== 3) return false;
  const version = Number(versionText), m = Number(params.m), t = Number(params.t), p = Number(params.p);
  if (version !== 19 || m < 8 || m > 65536 || t < 1 || t > 6 || p < 1 || p > 4) return false;
  const salt = Buffer.from(saltText, 'base64'), expected = Buffer.from(hashText, 'base64');
  if (salt.length < 8 || salt.length > 64 || expected.length < 16 || expected.length > 64) return false;
  const actual = await argon2idAsync(password, salt, { t, m, p, dkLen: expected.length, maxmem: m * 1024 });
  return timingSafeEqual(Buffer.from(actual), expected);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import argon2 from 'argon2';
import { hashArgon2id, verifyArgon2id } from '../lib/auth-argon.ts';

test('portable Argon2id hashes verify in native Node and existing native hashes verify in Workers format', async () => {
  const password = 'a-family-secret';
  const portable = await hashArgon2id(password);
  assert.equal(await argon2.verify(portable, password), true);
  assert.equal(await verifyArgon2id(portable, password + '!'), false);
  const native = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  assert.equal(await verifyArgon2id(native, password), true);
});

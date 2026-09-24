import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import Database from 'better-sqlite3';

test('online backup includes changes still held in the SQLite WAL', () => {
  const root = mkdtempSync(join(tmpdir(), 'taskxp-backup-test-'));
  const source = join(root, 'taskxp.db');
  const database = new Database(source);
  try {
    database.pragma('journal_mode = WAL');
    database.exec('CREATE TABLE example (value INTEGER NOT NULL); INSERT INTO example (value) VALUES (42)');
    assert.equal(existsSync(source + '-wal'), true);

    const command = spawnSync(process.execPath, ['scripts/backup.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: source },
      encoding: 'utf8',
    });
    assert.equal(command.status, 0, command.stderr);
    const destination = command.stdout.trim();
    assert.equal(resolve(destination).startsWith(resolve(root, 'backups')), true);
    const backup = new Database(destination, { readonly: true, fileMustExist: true });
    try {
      assert.equal(backup.prepare('SELECT value FROM example').get()?.value, 42);
      assert.equal(backup.prepare('PRAGMA integrity_check').get()?.integrity_check, 'ok');
    } finally {
      backup.close();
    }
  } finally {
    database.close();
    if (relative(tmpdir(), root).startsWith('taskxp-backup-test-')) rmSync(root, { recursive: true, force: true });
  }
});

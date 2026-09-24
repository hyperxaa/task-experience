import Database from 'better-sqlite3';
import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';

const source = process.env.DATABASE_URL;
if (!source || !isAbsolute(source)) throw new Error('Set DATABASE_URL to the absolute production SQLite path');

process.umask(0o077);
const backupDirectory = join(dirname(source), 'backups');
mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
chmodSync(backupDirectory, 0o700);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = join(backupDirectory, `taskxp-${timestamp}-${randomBytes(4).toString('hex')}.db`);

let completed = false;
try {
  const database = new Database(source, { readonly: true, fileMustExist: true });
  try {
    await database.backup(destination);
  } finally {
    database.close();
  }
  const copy = new Database(destination, { readonly: true, fileMustExist: true });
  try {
    if (copy.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok') throw new Error('Backup integrity check failed');
  } finally {
    copy.close();
  }
  completed = true;
  console.log(destination);
} finally {
  if (!completed) rmSync(destination, { force: true });
}

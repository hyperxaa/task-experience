import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export type BoundStatement = {
  bind: (...values: unknown[]) => BoundStatement;
  first: <T = Record<string, unknown>>() => T | null;
  run: () => { meta: { changes: number } };
};
type D1Compat = {
  prepare: (sql: string) => BoundStatement;
  batch: (statements: BoundStatement[]) => Promise<Array<{ meta: { changes: number } }>>;
};

let sqlite: Database.Database | undefined;
let compat: D1Compat | undefined;
let orm: ReturnType<typeof drizzle<typeof schema>> | undefined;

function databasePath() {
  const configured = process.env.DATABASE_URL || './data/taskxp.db';
  if (configured.startsWith('file:')) return fileURLToPath(configured);
  if (isAbsolute(configured)) return configured;
  if (process.env.NODE_ENV === 'production') throw new Error('DATABASE_URL must be an absolute path in production');
  const relative = configured.replace(/^(?:\.?[\\/])?(?:data[\\/])?/, '');
  const root = resolve(process.cwd(), 'data');
  const path = join(process.cwd(), 'data', relative);
  if (path !== root && !path.startsWith(root + sep)) throw new Error('Relative DATABASE_URL must stay inside ./data');
  return path;
}

function open() {
  if (sqlite) return sqlite;
  const path = databasePath();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS family (
      id INTEGER PRIMARY KEY NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL,
      credentials TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY NOT NULL,
      profile TEXT,
      expires INTEGER NOT NULL,
      parent_until INTEGER NOT NULL DEFAULT 0,
      remember_token TEXT
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions (expires);
    CREATE TABLE IF NOT EXISTS attempts (
      key TEXT PRIMARY KEY NOT NULL,
      count INTEGER NOT NULL,
      until INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS remember_devices (
      token TEXT PRIMARY KEY NOT NULL,
      expires INTEGER NOT NULL,
      created INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS remember_devices_expiry ON remember_devices (expires);
  `);
  const sessionColumns = new Set((sqlite.pragma('table_info(sessions)') as Array<{ name: string }>).map((column) => column.name));
  if (!sessionColumns.has('remember_token')) sqlite.exec('ALTER TABLE sessions ADD COLUMN remember_token TEXT');
  return sqlite;
}

export function getDatabase(): D1Compat {
  if (compat) return compat;
  compat = {
    prepare(sql) {
      const statement = open().prepare(sql);
      let values: unknown[] = [];
      const bound: BoundStatement = {
        bind(...next) { values = next; return bound; },
        first<T>() { return (statement.get(...(values as never[])) as T | undefined) ?? null; },
        run() {
          const result = statement.run(...(values as never[]));
          return { meta: { changes: Number(result.changes) } };
        },
      };
      return bound;
    },
    async batch(statements) {
      return open().transaction(() => statements.map((statement) => statement.run()))();
    },
  };
  return compat;
}

export function getDrizzleDb() {
  if (!orm) orm = drizzle(open(), { schema });
  return orm;
}

export function closeDatabaseForTests() {
  sqlite?.close();
  sqlite = undefined;
  compat = undefined;
  orm = undefined;
}

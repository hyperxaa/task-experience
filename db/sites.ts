import { env } from 'cloudflare:workers';
import type { BoundStatement, DatabaseAdapter, RunResult } from './types';

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first: <T>() => Promise<T | null>;
  run: () => Promise<RunResult>;
};
type D1Binding = {
  prepare: (sql: string) => D1Statement;
  batch: (statements: D1Statement[]) => Promise<RunResult[]>;
};
const prepared = new WeakMap<BoundStatement, D1Statement>();

export function getDatabase(): DatabaseAdapter {
  const binding = (env as { DB?: D1Binding }).DB;
  if (!binding) throw new Error('D1 binding DB is unavailable');
  return {
    prepare(sql) {
      let statement = binding.prepare(sql);
      const wrapper: BoundStatement = {
        bind(...values) { statement = statement.bind(...values); prepared.set(wrapper, statement); return wrapper; },
        first<T>() { return statement.first<T>(); },
        run() { return statement.run(); },
      };
      prepared.set(wrapper, statement);
      return wrapper;
    },
    batch(statements) {
      const native = statements.map(statement => prepared.get(statement));
      if (native.some(statement => !statement)) throw new Error('Invalid D1 statement');
      return binding.batch(native as D1Statement[]);
    },
  };
}

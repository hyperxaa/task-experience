export type RunResult = { meta: { changes: number } };
export type BoundStatement = {
  bind: (...values: unknown[]) => BoundStatement;
  first: <T = Record<string, unknown>>() => T | null | Promise<T | null>;
  run: () => RunResult | Promise<RunResult>;
};
export type DatabaseAdapter = {
  prepare: (sql: string) => BoundStatement;
  batch: (statements: BoundStatement[]) => Promise<RunResult[]>;
};

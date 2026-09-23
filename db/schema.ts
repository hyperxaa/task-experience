import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const family = sqliteTable('family', { id: integer('id').primaryKey(), revision: integer('revision').notNull().default(0), data: text('data').notNull(), credentials: text('credentials').notNull() });
export const sessions = sqliteTable('sessions', { token: text('token').primaryKey(), profile: text('profile'), expires: integer('expires').notNull(), parentUntil: integer('parent_until').notNull().default(0) }, t => [index('sessions_expiry').on(t.expires)]);
export const attempts = sqliteTable('attempts', { key: text('key').primaryKey(), count: integer('count').notNull(), until: integer('until').notNull() });

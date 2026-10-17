import { drizzle, type NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import * as schema from './schema/index.ts';

export type Schema = typeof schema;

// What feature functions take as their first argument. Both the client and a transaction
// satisfy it, so a function works the same inside or outside db.transaction().
export type Database = PgDatabase<NodePgQueryResultHKT, Schema>;

// Plain function with no Nitro dependency, so the seed script and the tests use it too.
export const createDatabase = (url: string) => {
  if (!url) {
    throw new Error('Database URL is empty. Set NUXT_DATABASE_URL (see .env.example).');
  }
  const pool = new Pool({ connectionString: url });
  // An idle pooled connection can fail, e.g. when Postgres restarts. Without a listener,
  // Node treats the 'error' event as fatal and the whole server exits; with one, the
  // pool drops the broken connection and opens a new one on the next query.
  pool.on('error', (error) => {
    console.error('Idle Postgres connection failed:', error.message);
  });
  return drizzle({ client: pool, schema });
};

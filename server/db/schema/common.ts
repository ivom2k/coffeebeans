import { sql, type SQL } from 'drizzle-orm';
import { timestamp, type AnyPgColumn } from 'drizzle-orm/pg-core';

// Locales that have content in the database: the user's locale and coffee descriptions.
export const locales = ['et', 'ru'] as const;

// updated_at is maintained by the set_updated_at() trigger rather than by the app,
// so edits made outside the app (DBeaver, migrations) keep it right too.
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

// A CHECK constraint is DDL, which takes no bind parameters, so the values are inlined.
// Use it only with code-owned constants, never with user input.
export const isOneOf = (column: AnyPgColumn, values: readonly string[]): SQL =>
  sql`${column} IN (${sql.raw(values.map(value => `'${value}'`).join(', '))})`;

export const isSlug = (column: AnyPgColumn): SQL =>
  sql`${column} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`;

export const isCountryCode = (column: AnyPgColumn): SQL =>
  sql`${column} ~ '^[A-Z]{2}$'`;

export const isVocabularyCode = (column: AnyPgColumn): SQL =>
  sql`${column} ~ '^[A-Z][A-Z0-9_]*$'`;

import { sql } from 'drizzle-orm';
import { bigint, check, pgTable, timestamp, unique, varchar } from 'drizzle-orm/pg-core';
import { isOneOf, locales, timestamps } from './common.ts';

export const authProviders = ['GOOGLE'] as const;
export const userRoles = ['USER', 'ADMIN'] as const;

// No email and no name, by design. A user is never hard-deleted once they have
// ratings: anonymise_user() clears the identity and sets deleted_at instead.
export const appUser = pgTable('app_user', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  authProvider: varchar('auth_provider', { length: 16, enum: authProviders }),
  externalSubject: varchar('external_subject', { length: 255 }), // the OIDC `sub` claim
  locale: varchar('locale', { length: 5, enum: locales }).notNull().default('et'),
  role: varchar('role', { length: 16, enum: userRoles }).notNull().default('USER'),
  ...timestamps,
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, t => [
  unique('app_user_identity_uq').on(t.authProvider, t.externalSubject),
  check('app_user_provider_chk', isOneOf(t.authProvider, authProviders)),
  check('app_user_role_chk', isOneOf(t.role, userRoles)),
  check('app_user_locale_chk', isOneOf(t.locale, locales)),
  // Active users must carry an identity; anonymised users must not.
  check('app_user_identity_chk', sql`
    (${t.deletedAt} IS NULL AND ${t.authProvider} IS NOT NULL AND ${t.externalSubject} IS NOT NULL)
    OR (${t.deletedAt} IS NOT NULL AND ${t.authProvider} IS NULL AND ${t.externalSubject} IS NULL)`),
]);

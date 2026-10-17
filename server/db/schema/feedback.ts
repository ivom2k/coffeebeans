import { sql } from 'drizzle-orm';
import { bigint, char, check, index, pgTable, varchar } from 'drizzle-orm/pg-core';
import { isOneOf, timestamps } from './common.ts';
import { appUser } from './users.ts';

export const feedbackStatuses = ['NEW', 'READ', 'DONE'] as const;

// Needs no sign-in; guarded by a honeypot, a rate limit and the length cap below.
export const feedback = pgTable('feedback', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  message: varchar('message', { length: 1000 }).notNull(),
  pagePath: varchar('page_path', { length: 300 }), // the page the widget was opened on
  userId: bigint('user_id', { mode: 'number' }).references(() => appUser.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 16, enum: feedbackStatuses }).notNull().default('NEW'),
  // HMAC-SHA256 of the IP with a server secret, never the address itself; a plain hash
  // of an IPv4 address can be brute-forced. Purged after about 30 days.
  ipHmac: char('ip_hmac', { length: 64 }),
  ...timestamps,
}, t => [
  check('feedback_status_chk', isOneOf(t.status, feedbackStatuses)),
  check('feedback_message_chk', sql`length(btrim(${t.message})) > 0`),
  index('feedback_new_idx').on(t.createdAt).where(sql`${t.status} = 'NEW'`),
]);

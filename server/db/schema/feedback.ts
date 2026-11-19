import { sql } from 'drizzle-orm';
import { bigint, char, check, index, pgTable, varchar } from 'drizzle-orm/pg-core';
import { feedbackStatuses } from '../../../shared/types/feedback.ts';
import { isOneOf, timestamps } from './common.ts';
import { appUser } from './users.ts';

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
  // A path on this site. The inbox shows it as a link, so it must never be another site's URL.
  check('feedback_page_path_chk', sql`${t.pagePath} IS NULL OR (${t.pagePath} LIKE '/%' AND ${t.pagePath} NOT LIKE '//%')`),
  index('feedback_new_idx').on(t.createdAt).where(sql`${t.status} = 'NEW'`),
  // The daily limit counts one sender's recent feedback; the purge clears old hashes.
  index('feedback_ip_hmac_idx').on(t.ipHmac, t.createdAt).where(sql`${t.ipHmac} IS NOT NULL`),
  // The same count for a signed-in sender, and the lookup anonymise_user() and the foreign key's
  // ON DELETE SET NULL make.
  index('feedback_user_id_idx').on(t.userId, t.createdAt).where(sql`${t.userId} IS NOT NULL`),
  // The site-wide daily count, and the deletion of messages older than a year (decisions log §5).
  index('feedback_created_at_idx').on(t.createdAt),
]);

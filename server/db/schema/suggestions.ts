import { sql } from 'drizzle-orm';
import { bigint, check, index, jsonb, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { coffeeBean } from './catalogue.ts';
import { isOneOf, timestamps } from './common.ts';
import { machineModel } from './machines.ts';
import { appUser } from './users.ts';

export const suggestionTypes = ['COFFEE_BEAN', 'MACHINE_MODEL'] as const;
export const suggestionStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE'] as const;
export const suggestionReviewReasons = ['NOT_WHOLE_BEANS', 'NOT_SOLD_IN_ESTONIA', 'NOT_ENOUGH_INFO', 'OTHER'] as const;

// Sign-in only (enforced in the API). The outcome is shown on the user's
// "Minu ettepanekud" page, so no email is needed.
export const suggestion = pgTable('suggestion', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  suggestionType: varchar('suggestion_type', { length: 16, enum: suggestionTypes }).notNull(),
  status: varchar('status', { length: 16, enum: suggestionStatuses }).notNull().default('PENDING'),
  // NULL only after anonymisation.
  userId: bigint('user_id', { mode: 'number' }).references(() => appUser.id, { onDelete: 'set null' }),
  // Type-specific fields, parsed at the API boundary as a discriminated union on suggestion_type.
  details: jsonb('details').notNull().default({}),
  // Optional price-tag photo, kept outside the directory Caddy serves and deleted at
  // review: suggestion_image_chk allows it only while the suggestion is pending.
  imagePath: varchar('image_path', { length: 300 }),
  // APPROVED: the record created; DUPLICATE: the one that already existed.
  resultingCoffeeBeanId: bigint('resulting_coffee_bean_id', { mode: 'number' }).references(() => coffeeBean.id),
  resultingMachineModelId: bigint('resulting_machine_model_id', { mode: 'number' }).references(() => machineModel.id),
  reviewReason: varchar('review_reason', { length: 32, enum: suggestionReviewReasons }), // REJECTED only
  reviewNote: varchar('review_note', { length: 500 }), // optional, shown to the user
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  // NULL after review = the unread marker on the profile icon. A re-review must reset it.
  resultSeenAt: timestamp('result_seen_at', { withTimezone: true }),
  ...timestamps,
}, t => [
  check('suggestion_type_chk', isOneOf(t.suggestionType, suggestionTypes)),
  check('suggestion_status_chk', isOneOf(t.status, suggestionStatuses)),
  check('suggestion_details_chk', sql`jsonb_typeof(${t.details}) = 'object'`),
  check('suggestion_image_chk', sql`${t.imagePath} IS NULL OR ${t.status} = 'PENDING'`),
  check('suggestion_result_chk', sql`
    (${t.suggestionType} = 'COFFEE_BEAN' AND ${t.resultingMachineModelId} IS NULL)
    OR (${t.suggestionType} = 'MACHINE_MODEL' AND ${t.resultingCoffeeBeanId} IS NULL)`),
  // APPROVED and DUPLICATE point at a record; PENDING and REJECTED don't.
  check('suggestion_target_chk', sql`
    (${t.status} IN ('APPROVED', 'DUPLICATE'))
    = (${t.resultingCoffeeBeanId} IS NOT NULL OR ${t.resultingMachineModelId} IS NOT NULL)`),
  check('suggestion_reason_chk', sql`(${t.status} = 'REJECTED') = (${t.reviewReason} IS NOT NULL)`),
  check('suggestion_reason_code_chk', isOneOf(t.reviewReason, suggestionReviewReasons)),
  check('suggestion_note_chk', sql`${t.reviewNote} IS NULL OR ${t.status} <> 'PENDING'`),
  check('suggestion_reviewed_chk', sql`(${t.status} = 'PENDING') = (${t.reviewedAt} IS NULL)`),
  check('suggestion_seen_chk', sql`
    ${t.resultSeenAt} IS NULL OR (${t.reviewedAt} IS NOT NULL AND ${t.resultSeenAt} >= ${t.reviewedAt})`),
  index('suggestion_user_id_idx').on(t.userId),
  index('suggestion_pending_idx').on(t.createdAt).where(sql`${t.status} = 'PENDING'`),
]);

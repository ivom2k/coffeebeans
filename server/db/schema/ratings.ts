import { sql } from 'drizzle-orm';
import {
  bigint, boolean, check, index, numeric, pgTable, pgView, primaryKey, smallint, unique, varchar,
} from 'drizzle-orm/pg-core';
import { coffeeBean, coffeeBeanStatuses } from './catalogue.ts';
import { timestamps } from './common.ts';
import { machineKinds, machineModel } from './machines.ts';
import { appUser } from './users.ts';
import { beanSurface, machineIssue } from './vocabularies.ts';

// Never served publicly: public routes read only the summary views below, which keeps
// private notes private.
export const rating = pgTable('rating', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  // No cascade, on purpose: a user with ratings is anonymised, never deleted.
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => appUser.id),
  coffeeBeanId: bigint('coffee_bean_id', { mode: 'number' }).notNull().references(() => coffeeBean.id),
  // The catalogue model used at rating time, not the user's machine entry, so each
  // rating stays a self-contained fact.
  machineModelId: bigint('machine_model_id', { mode: 'number' }).references(() => machineModel.id),
  score: smallint('score').notNull(),

  // Optional perception sliders, all 1 = low .. 5 = high. NULL = not answered.
  perceivedBitterness: smallint('perceived_bitterness'), // 1 pehme .. 5 mõru
  perceivedRoastCharacter: smallint('perceived_roast_character'), // 1 erk, puuviljane .. 5 tume, šokolaadine
  perceivedCrema: smallint('perceived_crema'), // 1 vähe .. 5 palju
  perceivedStrength: smallint('perceived_strength'), // 1 lahja .. 5 kange

  beanSurfaceCode: varchar('bean_surface_code', { length: 32 }).references(() => beanSurface.code), // NULL = not answered

  // NULL = skipped, false = no issues, true = details in rating_machine_issue. The issue
  // rate's denominator counts only people who answered, so "no issues" must stay
  // distinct from "skipped". The server writes this flag and the rows in one transaction.
  hadMachineIssues: boolean('had_machine_issues'),

  privateNote: varchar('private_note', { length: 500 }), // visible only to its author
  ...timestamps,
}, t => [
  unique('rating_user_bean_uq').on(t.userId, t.coffeeBeanId),
  check('rating_score_chk', sql`${t.score} BETWEEN 1 AND 5`),
  check('rating_bitterness_chk', sql`${t.perceivedBitterness} BETWEEN 1 AND 5`),
  check('rating_roast_character_chk', sql`${t.perceivedRoastCharacter} BETWEEN 1 AND 5`),
  check('rating_crema_chk', sql`${t.perceivedCrema} BETWEEN 1 AND 5`),
  check('rating_strength_chk', sql`${t.perceivedStrength} BETWEEN 1 AND 5`),
  index('rating_coffee_bean_id_idx').on(t.coffeeBeanId),
  index('rating_machine_model_id_idx').on(t.machineModelId),
]);

export const ratingMachineIssue = pgTable('rating_machine_issue', {
  ratingId: bigint('rating_id', { mode: 'number' }).notNull()
    .references(() => rating.id, { onDelete: 'cascade' }),
  machineIssueCode: varchar('machine_issue_code', { length: 32 }).notNull()
    .references(() => machineIssue.code),
}, t => [
  primaryKey({ name: 'rating_machine_issue_pkey', columns: [t.ratingId, t.machineIssueCode] }),
]);

// The views are created in the db_objects custom migration. `.existing()` gives them
// types without drizzle-kit ever generating SQL for them.

// Ranking and histogram, for non-draft coffees. Pages show raw_mean (NULL while
// unrated); the ranked list sorts by shrunk_mean.
export const coffeeBeanRatingSummary = pgView('coffee_bean_rating_summary', {
  coffeeBeanId: bigint('coffee_bean_id', { mode: 'number' }).notNull(),
  status: varchar('status', { length: 16, enum: coffeeBeanStatuses }).notNull(),
  ratingCount: bigint('rating_count', { mode: 'number' }).notNull(),
  rawMean: numeric('raw_mean', { mode: 'number' }),
  shrunkMean: numeric('shrunk_mean', { mode: 'number' }).notNull(),
  score1Count: bigint('score_1_count', { mode: 'number' }).notNull(),
  score2Count: bigint('score_2_count', { mode: 'number' }).notNull(),
  score3Count: bigint('score_3_count', { mode: 'number' }).notNull(),
  score4Count: bigint('score_4_count', { mode: 'number' }).notNull(),
  score5Count: bigint('score_5_count', { mode: 'number' }).notNull(),
}).existing();

// "6 of 14 Philips owners reported issues". machineKind and manufacturerId are NULL for
// ratings made without naming a machine.
export const coffeeBeanMachineIssueSummary = pgView('coffee_bean_machine_issue_summary', {
  coffeeBeanId: bigint('coffee_bean_id', { mode: 'number' }).notNull(),
  machineKind: varchar('machine_kind', { length: 16, enum: machineKinds }),
  manufacturerId: bigint('manufacturer_id', { mode: 'number' }),
  answeredCount: bigint('answered_count', { mode: 'number' }).notNull(),
  withIssuesCount: bigint('with_issues_count', { mode: 'number' }).notNull(),
}).existing();

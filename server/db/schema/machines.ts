import { bigint, check, index, pgTable, unique, varchar } from 'drizzle-orm/pg-core';
import { isOneOf, isSlug, timestamps } from './common.ts';
import { appUser } from './users.ts';

// Every machine_issue code describes the grinder. An AUTOMATIC machine has it built in,
// so issue rates group by manufacturer; a PORTAFILTER owner's grinder is usually a
// separate device from another brand, so those owners form one group.
export const machineKinds = ['AUTOMATIC', 'PORTAFILTER'] as const;

export const machineManufacturer = pgTable('machine_manufacturer', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 120 }).notNull(),
  ...timestamps,
}, t => [
  unique('machine_manufacturer_name_uq').on(t.name),
  unique('machine_manufacturer_slug_uq').on(t.slug),
  check('machine_manufacturer_slug_chk', isSlug(t.slug)),
]);

// Only approved models live here; new ones arrive through suggestions.
export const machineModel = pgTable('machine_model', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  manufacturerId: bigint('manufacturer_id', { mode: 'number' }).notNull()
    .references(() => machineManufacturer.id),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 120 }).notNull(), // unique within its manufacturer
  kind: varchar('kind', { length: 16, enum: machineKinds }).notNull(),
  ...timestamps,
}, t => [
  unique('machine_model_manufacturer_name_uq').on(t.manufacturerId, t.name),
  unique('machine_model_manufacturer_slug_uq').on(t.manufacturerId, t.slug),
  check('machine_model_slug_chk', isSlug(t.slug)),
  check('machine_model_kind_chk', isOneOf(t.kind, machineKinds)),
]);

// The machines offered in a user's rating form. Ratings reference machine_model, not
// this table, so these rows can be edited or deleted freely.
export const userMachine = pgTable('user_machine', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  userId: bigint('user_id', { mode: 'number' }).notNull()
    .references(() => appUser.id, { onDelete: 'cascade' }),
  machineModelId: bigint('machine_model_id', { mode: 'number' }).notNull()
    .references(() => machineModel.id),
  nickname: varchar('nickname', { length: 50 }), // 'Kodu', 'Töö'
  ...timestamps,
}, t => [
  index('user_machine_user_id_idx').on(t.userId),
]);

import { sql } from 'drizzle-orm';
import {
  bigint, char, check, index, integer, pgTable, primaryKey, smallint, text, timestamp, unique, varchar,
} from 'drizzle-orm/pg-core';
import { isCountryCode, isOneOf, isSlug, locales, timestamps } from './common.ts';
import { species } from './vocabularies.ts';

// ARCHIVED = no longer sold, including sold-out limited releases. Archived coffees keep
// their pages and ratings but leave the buying lists.
export const coffeeBeanStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;

export const brand = pgTable('brand', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 120 }).notNull(),
  countryCode: char('country_code', { length: 2 }), // ISO 3166-1 alpha-2, the brand's home country
  ...timestamps,
}, t => [
  unique('brand_name_uq').on(t.name),
  unique('brand_slug_uq').on(t.slug),
  check('brand_slug_chk', isSlug(t.slug)),
  check('brand_country_chk', isCountryCode(t.countryCode)),
]);

// The coffee itself, independent of bag size: ratings attach here.
export const coffeeBean = pgTable('coffee_bean', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  brandId: bigint('brand_id', { mode: 'number' }).notNull().references(() => brand.id),
  // As printed on the bag, including the harvest year or lot when the bag names one,
  // so different lots never share ratings. Never translated.
  name: varchar('name', { length: 150 }).notNull(),
  // May change: old public slugs live on in coffee_bean_slug_redirect.
  slug: varchar('slug', { length: 200 }).notNull(),
  // Declared roast mapped to 1 light .. 5 dark; NULL when the bag gives only "intensity".
  roastLevel: smallint('roast_level'),
  imagePath: varchar('image_path', { length: 300 }), // relative path on the uploads volume
  status: varchar('status', { length: 16, enum: coffeeBeanStatuses }).notNull().default('DRAFT'),
  ...timestamps,
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }), // last deliberate content check, not any edit
}, t => [
  // Also serves lookups by brand_id, which leads it, so brand_id needs no index of its own.
  unique('coffee_bean_brand_name_uq').on(t.brandId, t.name),
  unique('coffee_bean_slug_uq').on(t.slug),
  check('coffee_bean_slug_chk', isSlug(t.slug)),
  check('coffee_bean_roast_level_chk', sql`${t.roastLevel} BETWEEN 1 AND 5`),
  check('coffee_bean_status_chk', isOneOf(t.status, coffeeBeanStatuses)),
]);

// Per-locale content. Only descriptions: they are content, not vocabulary.
export const coffeeBeanTranslation = pgTable('coffee_bean_translation', {
  coffeeBeanId: bigint('coffee_bean_id', { mode: 'number' }).notNull()
    .references(() => coffeeBean.id, { onDelete: 'cascade' }),
  locale: varchar('locale', { length: 5, enum: locales }).notNull(),
  description: text('description').notNull(),
  ...timestamps,
}, t => [
  primaryKey({ name: 'coffee_bean_translation_pkey', columns: [t.coffeeBeanId, t.locale] }),
  check('coffee_bean_translation_locale_chk', isOneOf(t.locale, locales)),
]);

// The bag on the shelf. One coffee can have several packages of the same size: GS1
// requires a new GTIN when the net content changes, and markets can differ.
export const coffeeBeanPackage = pgTable('coffee_bean_package', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  coffeeBeanId: bigint('coffee_bean_id', { mode: 'number' }).notNull()
    .references(() => coffeeBean.id, { onDelete: 'cascade' }),
  sizeG: integer('size_g').notNull(),
  // EAN-8, UPC-A and EAN-13 left-padded with zeros to 14 digits (GS1's database form),
  // so a code entered as UPC-A and scanned as EAN-13 still matches. The app verifies
  // the check digit.
  gtin: char('gtin', { length: 14 }),
  ...timestamps,
}, t => [
  unique('coffee_bean_package_gtin_uq').on(t.gtin),
  check('coffee_bean_package_size_chk', sql`${t.sizeG} > 0`),
  check('coffee_bean_package_gtin_chk', sql`${t.gtin} ~ '^[0-9]{14}$'`),
  index('coffee_bean_package_coffee_bean_id_idx').on(t.coffeeBeanId),
]);

// Blend composition. The app checks that percentages sum to 100 when every row has one.
export const coffeeBeanSpecies = pgTable('coffee_bean_species', {
  coffeeBeanId: bigint('coffee_bean_id', { mode: 'number' }).notNull()
    .references(() => coffeeBean.id, { onDelete: 'cascade' }),
  speciesCode: varchar('species_code', { length: 32 }).notNull().references(() => species.code),
  percentage: smallint('percentage'), // NULL = declared but not quantified ("Arabica & Robusta")
}, t => [
  primaryKey({ name: 'coffee_bean_species_pkey', columns: [t.coffeeBeanId, t.speciesCode] }),
  check('coffee_bean_species_pct_chk', sql`${t.percentage} BETWEEN 1 AND 100`),
]);

// Where the beans were grown, when the bag says.
export const coffeeBeanOrigin = pgTable('coffee_bean_origin', {
  coffeeBeanId: bigint('coffee_bean_id', { mode: 'number' }).notNull()
    .references(() => coffeeBean.id, { onDelete: 'cascade' }),
  countryCode: char('country_code', { length: 2 }).notNull(),
}, t => [
  primaryKey({ name: 'coffee_bean_origin_pkey', columns: [t.coffeeBeanId, t.countryCode] }),
  check('coffee_bean_origin_country_chk', isCountryCode(t.countryCode)),
]);

// Old slugs of published coffees, answered with a 301. Rows point at the coffee rather
// than its new slug, so repeated renames never chain. Written only by the
// coffee_bean_track_slug() trigger.
export const coffeeBeanSlugRedirect = pgTable('coffee_bean_slug_redirect', {
  oldSlug: varchar('old_slug', { length: 200 }).primaryKey(),
  coffeeBeanId: bigint('coffee_bean_id', { mode: 'number' }).notNull()
    .references(() => coffeeBean.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('coffee_bean_slug_redirect_bean_idx').on(t.coffeeBeanId),
]);

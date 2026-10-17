import { check, pgTable, smallint, varchar } from 'drizzle-orm/pg-core';
import { isVocabularyCode } from './common.ts';

// Vocabularies hold codes only. The code is the i18n key, so rendering a label never
// needs a join. The rows themselves come from the vocabularies migration.
const vocabulary = <TName extends string>(name: TName) =>
  pgTable(name, {
    code: varchar('code', { length: 32 }).primaryKey(),
    sortOrder: smallint('sort_order').notNull().default(0),
  }, t => [
    check(`${name}_code_chk`, isVocabularyCode(t.code)),
  ]);

export const species = vocabulary('species');
export const beanSurface = vocabulary('bean_surface');
export const machineIssue = vocabulary('machine_issue');

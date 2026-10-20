import { asc, desc, eq, sql } from 'drizzle-orm';
import type { CoffeeListItem, RankedCoffees } from '../../../shared/types/coffee.ts';
import type { Database } from '../../db/client.ts';
import {
  brand, coffeeBean, coffeeBeanMachineIssueSummary, coffeeBeanRatingSummary, type coffeeBeanStatuses,
} from '../../db/schema/index.ts';
import { issueFlag } from './machineIssues.ts';
import type { Thresholds } from './thresholds.ts';

// Per-coffee totals across all machines, for the list badge and the filter.
const issueTotals = (db: Database) => db
  .select({
    coffeeBeanId: coffeeBeanMachineIssueSummary.coffeeBeanId,
    answered: sql<number>`sum(${coffeeBeanMachineIssueSummary.answeredCount})::int`.as('answered'),
    withIssues: sql<number>`sum(${coffeeBeanMachineIssueSummary.withIssuesCount})::int`.as('with_issues'),
  })
  .from(coffeeBeanMachineIssueSummary)
  .groupBy(coffeeBeanMachineIssueSummary.coffeeBeanId)
  .as('issue_totals');

// The rows behind every coffee list: ranking, search and brand pages. Starting from the
// summary view leaves drafts out. Callers add their own where and order by.
export const selectCoffeeListRows = (db: Database) => {
  const totals = issueTotals(db);
  return db
    .select({
      slug: coffeeBean.slug,
      name: coffeeBean.name,
      brandName: brand.name,
      roastLevel: coffeeBean.roastLevel,
      status: coffeeBeanRatingSummary.status,
      ratingCount: coffeeBeanRatingSummary.ratingCount,
      rawMean: coffeeBeanRatingSummary.rawMean,
      answered: totals.answered,
      withIssues: totals.withIssues,
    })
    .from(coffeeBeanRatingSummary)
    .innerJoin(coffeeBean, eq(coffeeBean.id, coffeeBeanRatingSummary.coffeeBeanId))
    .innerJoin(brand, eq(brand.id, coffeeBean.brandId))
    .leftJoin(totals, eq(totals.coffeeBeanId, coffeeBeanRatingSummary.coffeeBeanId))
    .$dynamic();
};

export const rankedOrder = [
  desc(coffeeBeanRatingSummary.shrunkMean),
  desc(coffeeBeanRatingSummary.ratingCount),
  asc(brand.name),
  asc(coffeeBean.name),
];

type CoffeeListRow = {
  slug: string;
  name: string;
  brandName: string;
  roastLevel: number | null;
  status: (typeof coffeeBeanStatuses)[number];
  ratingCount: number;
  rawMean: number | null;
  answered: number | null; // null when no rating has answered the issue question
  withIssues: number | null;
};

export const toCoffeeListItem = (row: CoffeeListRow, rules: Thresholds): CoffeeListItem => ({
  slug: row.slug,
  name: row.name,
  brandName: row.brandName,
  roastLevel: row.roastLevel,
  archived: row.status === 'ARCHIVED',
  ratingCount: row.ratingCount,
  rawMean: row.rawMean,
  issueFlag: issueFlag({ answered: row.answered ?? 0, withIssues: row.withIssues ?? 0 }, rules),
});

// Estonian alphabetical order puts z after s and õ, ä, ö, ü at the end.
const collator = new Intl.Collator('et');

// Items arrive in ranked order. Coffees below the minimum rating count are listed apart
// rather than ranked: unrated, a coffee would sit at the global mean (decisions log §2).
export const splitByRatingCount = (items: readonly CoffeeListItem[], rules: Thresholds): RankedCoffees => ({
  ranked: items.filter(item => item.ratingCount >= rules.minRatings),
  unrated: items
    .filter(item => item.ratingCount < rules.minRatings)
    .toSorted((a, b) => collator.compare(a.brandName, b.brandName) || collator.compare(a.name, b.name)),
});

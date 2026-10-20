import { and, eq, inArray } from 'drizzle-orm';
import type { RankedCoffees, RankingFilters } from '../../../shared/types/coffee.ts';
import type { Database } from '../../db/client.ts';
import { coffeeBean, coffeeBeanRatingSummary } from '../../db/schema/index.ts';
import { rankedOrder, selectCoffeeListRows, splitByRatingCount, toCoffeeListItem } from './coffeeListItems.ts';
import { thresholds, type Thresholds } from './thresholds.ts';

export const listRankedCoffees = async (
  db: Database,
  filters: RankingFilters,
  rules: Thresholds = thresholds,
): Promise<RankedCoffees> => {
  const rows = await selectCoffeeListRows(db)
    .where(and(
      // Archived coffees keep their pages but leave the buying lists (decisions log §4).
      eq(coffeeBeanRatingSummary.status, 'PUBLISHED'),
      // A coffee with no declared roast level can't match a roast filter.
      filters.roastLevels.length > 0 ? inArray(coffeeBean.roastLevel, filters.roastLevels) : undefined,
    ))
    .orderBy(...rankedOrder);

  const items = rows
    .map(row => toCoffeeListItem(row, rules))
    .filter(item => !filters.fewIssuesOnly || item.issueFlag === null);
  return splitByRatingCount(items, rules);
};

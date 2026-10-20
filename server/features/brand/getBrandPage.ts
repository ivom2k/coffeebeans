import { eq } from 'drizzle-orm';
import type { BrandPageResponse } from '../../../shared/types/brand.ts';
import type { Database } from '../../db/client.ts';
import { brand, coffeeBean } from '../../db/schema/index.ts';
import { rankedOrder, selectCoffeeListRows, splitByRatingCount, toCoffeeListItem } from '../coffee/coffeeListItems.ts';
import { thresholds, type Thresholds } from '../coffee/thresholds.ts';

// null when there is no such brand, or when all its coffees are still drafts.
export const getBrandPage = async (
  db: Database,
  slug: string,
  rules: Thresholds = thresholds,
): Promise<BrandPageResponse | null> => {
  const [brandRow] = await db
    .select({ id: brand.id, slug: brand.slug, name: brand.name, countryCode: brand.countryCode })
    .from(brand)
    .where(eq(brand.slug, slug));
  if (!brandRow) {
    return null;
  }

  const rows = await selectCoffeeListRows(db).where(eq(coffeeBean.brandId, brandRow.id)).orderBy(...rankedOrder);
  if (rows.length === 0) {
    return null;
  }

  const items = rows.map(row => toCoffeeListItem(row, rules));
  return {
    brand: { slug: brandRow.slug, name: brandRow.name, countryCode: brandRow.countryCode },
    ...splitByRatingCount(items.filter(item => !item.archived), rules),
    archived: items.filter(item => item.archived),
  };
};

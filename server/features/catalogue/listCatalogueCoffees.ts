import { desc, eq } from 'drizzle-orm';
import type { CatalogueCoffeeRow } from '../../../shared/types/catalogue.ts';
import type { Database } from '../../db/client.ts';
import { brand, coffeeBean, coffeeBeanRatingSummary } from '../../db/schema/index.ts';

// Every coffee, drafts included, most recently changed first: the admin's way back into work in
// progress. The summary view leaves drafts out, hence the left join; drafts can't be rated, so
// they have no ratings to count.
export const listCatalogueCoffees = async (db: Database): Promise<CatalogueCoffeeRow[]> => {
  const rows = await db
    .select({
      id: coffeeBean.id,
      slug: coffeeBean.slug,
      name: coffeeBean.name,
      brandName: brand.name,
      status: coffeeBean.status,
      ratingCount: coffeeBeanRatingSummary.ratingCount,
      imagePath: coffeeBean.imagePath,
      updatedAt: coffeeBean.updatedAt,
    })
    .from(coffeeBean)
    .innerJoin(brand, eq(brand.id, coffeeBean.brandId))
    .leftJoin(coffeeBeanRatingSummary, eq(coffeeBeanRatingSummary.coffeeBeanId, coffeeBean.id))
    .orderBy(desc(coffeeBean.updatedAt), desc(coffeeBean.id));

  return rows.map(({ ratingCount, imagePath, updatedAt, ...row }) => ({
    ...row,
    ratingCount: ratingCount ?? 0,
    hasImage: imagePath !== null,
    updatedAt: updatedAt.toISOString(),
  }));
};

import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import type { SearchResponse } from '../../../shared/types/search.ts';
import { toGtin14 } from '../../../shared/utils/gtin.ts';
import type { Database } from '../../db/client.ts';
import { brand, coffeeBean, coffeeBeanPackage } from '../../db/schema/index.ts';
import { selectCoffeeListRows, toCoffeeListItem } from '../coffee/coffeeListItems.ts';
import { thresholds, type Thresholds } from '../coffee/thresholds.ts';

const coffeeLimit = 20;
const brandLimit = 5;

const findByGtin = async (db: Database, query: string, rules: Thresholds): Promise<SearchResponse> => {
  const gtin = toGtin14(query);
  if (!gtin.ok) {
    return { kind: 'invalidGtin' };
  }
  const [found] = await db
    .select({ coffeeBeanId: coffeeBeanPackage.coffeeBeanId, sizeG: coffeeBeanPackage.sizeG })
    .from(coffeeBeanPackage)
    .where(eq(coffeeBeanPackage.gtin, gtin.gtin));
  if (!found) {
    return { kind: 'gtin', coffee: null };
  }
  // No row when the package belongs to a draft, which isn't public yet.
  const [row] = await selectCoffeeListRows(db).where(eq(coffeeBean.id, found.coffeeBeanId));
  return { kind: 'gtin', coffee: row ? { ...toCoffeeListItem(row, rules), packageSizeG: found.sizeG } : null };
};

// Typo-tolerant (decisions log §4): pg_trgm word similarity over accent-folded names, so
// "valozzi" finds Vallozzi and "pohjarost" finds Põhjaröst. `<%` uses pg_trgm's default
// threshold of 0.6. At catalogue scale a sequential scan is fine.
const findByName = async (db: Database, query: string, rules: Thresholds): Promise<SearchResponse> => {
  const needle = sql`unaccent(${query})`;
  const coffeeName = sql`unaccent(${brand.name} || ' ' || ${coffeeBean.name})`;
  const brandName = sql`unaccent(${brand.name})`;

  const coffeeRows = await selectCoffeeListRows(db)
    .where(sql`${needle} <% ${coffeeName}`)
    .orderBy(sql`word_similarity(${needle}, ${coffeeName}) DESC`, asc(brand.name), asc(coffeeBean.name))
    .limit(coffeeLimit);

  const brands = await db
    .select({ slug: brand.slug, name: brand.name, countryCode: brand.countryCode, coffeeCount: count(coffeeBean.id) })
    .from(brand)
    // The inner join drops brands whose coffees are all drafts: they have no public page yet.
    .innerJoin(coffeeBean, and(eq(coffeeBean.brandId, brand.id), ne(coffeeBean.status, 'DRAFT')))
    .where(sql`${needle} <% ${brandName}`)
    .groupBy(brand.id)
    .orderBy(sql`word_similarity(${needle}, ${brandName}) DESC`, asc(brand.name))
    .limit(brandLimit);

  return { kind: 'text', brands, coffees: coffeeRows.map(row => toCoffeeListItem(row, rules)) };
};

// Digits and spaces only means a barcode typed from the price tag (decisions log §4).
export const searchCatalogue = (db: Database, query: string, rules: Thresholds = thresholds): Promise<SearchResponse> =>
  /^[\d\s]+$/.test(query) ? findByGtin(db, query, rules) : findByName(db, query, rules);

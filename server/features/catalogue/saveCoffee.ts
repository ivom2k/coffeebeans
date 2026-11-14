import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import type { CoffeeConflict, CoffeeEditorInput } from '../../../shared/types/catalogue.ts';
import { allowedStatuses } from '../../../shared/utils/catalogue.ts';
import { toPrintedGtin } from '../../../shared/utils/gtin.ts';
import type { Database } from '../../db/client.ts';
import { constraintViolation } from '../../db/errors.ts';
import {
  brand, coffeeBean, coffeeBeanOrigin, coffeeBeanPackage, coffeeBeanSpecies, coffeeBeanTranslation,
} from '../../db/schema/index.ts';

export type SaveCoffeeResult
  = | { kind: 'saved'; id: number }
    | { kind: 'notFound' }
    | { kind: 'unknownBrand' }
    | { kind: 'conflict'; conflict: CoffeeConflict };

const coffeeColumns = (input: CoffeeEditorInput) => ({
  brandId: input.brandId,
  name: input.name,
  slug: input.slug,
  status: input.status,
  roastLevel: input.roastLevel,
});

// Packages, species and origins are replaced as a whole: nothing references their rows, and the
// form always sends the full lists. The GTIN constraint is checked per statement, so a code the
// delete freed can be inserted again in the same transaction.
const writeDetails = async (tx: Database, coffeeBeanId: number, input: CoffeeEditorInput) => {
  await tx.delete(coffeeBeanPackage).where(eq(coffeeBeanPackage.coffeeBeanId, coffeeBeanId));
  if (input.packages.length > 0) {
    await tx.insert(coffeeBeanPackage).values(input.packages.map(pkg => ({ coffeeBeanId, ...pkg })));
  }
  await tx.delete(coffeeBeanSpecies).where(eq(coffeeBeanSpecies.coffeeBeanId, coffeeBeanId));
  if (input.species.length > 0) {
    await tx.insert(coffeeBeanSpecies)
      .values(input.species.map(row => ({ coffeeBeanId, speciesCode: row.code, percentage: row.percentage })));
  }
  await tx.delete(coffeeBeanOrigin).where(eq(coffeeBeanOrigin.coffeeBeanId, coffeeBeanId));
  if (input.origins.length > 0) {
    await tx.insert(coffeeBeanOrigin).values(input.origins.map(countryCode => ({ coffeeBeanId, countryCode })));
  }

  const description = input.descriptions.et;
  if (description === null) {
    await tx.delete(coffeeBeanTranslation)
      .where(and(eq(coffeeBeanTranslation.coffeeBeanId, coffeeBeanId), eq(coffeeBeanTranslation.locale, 'et')));
  } else {
    await tx.insert(coffeeBeanTranslation)
      .values({ coffeeBeanId, locale: 'et', description })
      .onConflictDoUpdate({ target: [coffeeBeanTranslation.coffeeBeanId, coffeeBeanTranslation.locale], set: { description } });
  }
};

// Which of the submitted GTINs another coffee already has, to name it in the message.
const findGtinOwners = async (db: Database, input: CoffeeEditorInput, ownId: number | null) => {
  const gtins = input.packages.flatMap(pkg => (pkg.gtin === null ? [] : [pkg.gtin]));
  const rows = await db
    .select({ gtin: coffeeBeanPackage.gtin, coffeeName: sql<string>`${brand.name} || ' ' || ${coffeeBean.name}` })
    .from(coffeeBeanPackage)
    .innerJoin(coffeeBean, eq(coffeeBean.id, coffeeBeanPackage.coffeeBeanId))
    .innerJoin(brand, eq(brand.id, coffeeBean.brandId))
    .where(and(inArray(coffeeBeanPackage.gtin, gtins), ownId === null ? undefined : ne(coffeeBean.id, ownId)));
  return rows.flatMap(row => (row.gtin === null ? [] : [{ gtin: toPrintedGtin(row.gtin), coffeeName: row.coffeeName }]));
};

// The constraints decide what is taken, so no check made beforehand can go stale. The save runs
// as its own transaction (a savepoint inside a caller's), which has already rolled back by the
// time a violation reaches this catch, so the follow-up lookup runs on a usable connection.
const mapViolations = async (
  db: Database,
  input: CoffeeEditorInput,
  ownId: number | null,
  save: () => Promise<SaveCoffeeResult>,
): Promise<SaveCoffeeResult> => {
  try {
    return await save();
  } catch (error) {
    switch (constraintViolation(error)?.constraint) {
      case 'coffee_bean_slug_uq':
        return { kind: 'conflict', conflict: { reason: 'slugTaken' } };
      case 'coffee_bean_brand_name_uq':
        return { kind: 'conflict', conflict: { reason: 'nameTaken' } };
      case 'coffee_bean_package_gtin_uq':
        return { kind: 'conflict', conflict: { reason: 'gtinTaken', gtins: await findGtinOwners(db, input, ownId) } };
      case 'coffee_bean_brand_id_brand_id_fk':
        return { kind: 'unknownBrand' };
      default:
        throw error;
    }
  }
};

// A new coffee was just entered from the bag, which is a deliberate content check, so it starts
// as reviewed.
export const createCoffee = (db: Database, input: CoffeeEditorInput): Promise<SaveCoffeeResult> =>
  mapViolations(db, input, null, () => db.transaction(async (tx): Promise<SaveCoffeeResult> => {
    const [created] = await tx.insert(coffeeBean)
      .values({ ...coffeeColumns(input), reviewedAt: sql`now()` })
      .returning({ id: coffeeBean.id });
    if (!created) {
      throw new Error('Coffee insert returned no row.');
    }
    await writeDetails(tx, created.id, input);
    return { kind: 'saved', id: created.id };
  }));

// The slug trigger keeps the old slug of a published or archived coffee as a 301 (§10). The row
// is locked while its status is checked, so the rule holds against a save running alongside.
export const updateCoffee = (db: Database, id: number, input: CoffeeEditorInput): Promise<SaveCoffeeResult> =>
  mapViolations(db, input, id, () => db.transaction(async (tx): Promise<SaveCoffeeResult> => {
    const [current] = await tx.select({ status: coffeeBean.status }).from(coffeeBean).where(eq(coffeeBean.id, id)).for('update');
    if (!current) {
      return { kind: 'notFound' };
    }
    if (!allowedStatuses(current.status).includes(input.status)) {
      return { kind: 'conflict', conflict: { reason: 'cannotUnpublish' } };
    }
    await tx.update(coffeeBean).set(coffeeColumns(input)).where(eq(coffeeBean.id, id));
    await writeDetails(tx, id, input);
    return { kind: 'saved', id };
  }));

// "Märgi üle vaadatuks": the last deliberate content check, which an ordinary edit is not.
export const markCoffeeReviewed = async (db: Database, id: number): Promise<{ reviewedAt: string } | null> => {
  const [row] = await db.update(coffeeBean)
    .set({ reviewedAt: sql`now()` })
    .where(eq(coffeeBean.id, id))
    .returning({ reviewedAt: coffeeBean.reviewedAt });
  return row?.reviewedAt ? { reviewedAt: row.reviewedAt.toISOString() } : null;
};

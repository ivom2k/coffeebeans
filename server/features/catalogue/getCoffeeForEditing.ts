import { and, asc, desc, eq } from 'drizzle-orm';
import { speciesCodes, type CoffeeForEditing, type SpeciesCode } from '../../../shared/types/catalogue.ts';
import { coffeeImageUrl } from '../../../shared/utils/coffeeImage.ts';
import { toPrintedGtin } from '../../../shared/utils/gtin.ts';
import type { Database } from '../../db/client.ts';
import {
  coffeeBean, coffeeBeanOrigin, coffeeBeanPackage, coffeeBeanSpecies, coffeeBeanTranslation, species,
} from '../../db/schema/index.ts';

// The foreign key and the vocabulary test keep the column within the list. A code outside it
// means a migration added a species the app doesn't know yet.
const toSpeciesCode = (value: string): SpeciesCode => {
  const code = speciesCodes.find(known => known === value);
  if (code === undefined) {
    throw new Error(`Unknown species code: ${value}`);
  }
  return code;
};

// The coffee form's starting state. GTINs come back as printed on the bag, which is what the
// admin compares them with; saving turns them into 14 digits again.
export const getCoffeeForEditing = async (db: Database, id: number): Promise<CoffeeForEditing | null> => {
  const [coffee] = await db.select().from(coffeeBean).where(eq(coffeeBean.id, id));
  if (!coffee) {
    return null;
  }

  // One query at a time: db may be a transaction, which is a single connection.
  const packages = await db
    .select({ sizeG: coffeeBeanPackage.sizeG, gtin: coffeeBeanPackage.gtin })
    .from(coffeeBeanPackage)
    .where(eq(coffeeBeanPackage.coffeeBeanId, id))
    .orderBy(desc(coffeeBeanPackage.sizeG), asc(coffeeBeanPackage.id));
  const speciesRows = await db
    .select({ code: coffeeBeanSpecies.speciesCode, percentage: coffeeBeanSpecies.percentage })
    .from(coffeeBeanSpecies)
    .innerJoin(species, eq(species.code, coffeeBeanSpecies.speciesCode))
    .where(eq(coffeeBeanSpecies.coffeeBeanId, id))
    .orderBy(asc(species.sortOrder));
  const origins = await db
    .select({ countryCode: coffeeBeanOrigin.countryCode })
    .from(coffeeBeanOrigin)
    .where(eq(coffeeBeanOrigin.coffeeBeanId, id))
    .orderBy(asc(coffeeBeanOrigin.countryCode));
  const [translation] = await db
    .select({ description: coffeeBeanTranslation.description })
    .from(coffeeBeanTranslation)
    .where(and(eq(coffeeBeanTranslation.coffeeBeanId, id), eq(coffeeBeanTranslation.locale, 'et')));

  return {
    id: coffee.id,
    brandId: coffee.brandId,
    name: coffee.name,
    slug: coffee.slug,
    status: coffee.status,
    roastLevel: coffee.roastLevel,
    packages: packages.map(pkg => ({ sizeG: pkg.sizeG, gtin: pkg.gtin === null ? null : toPrintedGtin(pkg.gtin) })),
    species: speciesRows.map(row => ({ code: toSpeciesCode(row.code), percentage: row.percentage })),
    origins: origins.map(origin => origin.countryCode),
    descriptions: { et: translation?.description ?? null },
    imageUrl: coffee.imagePath === null ? null : coffeeImageUrl(coffee.imagePath),
    reviewedAt: coffee.reviewedAt?.toISOString() ?? null,
  };
};

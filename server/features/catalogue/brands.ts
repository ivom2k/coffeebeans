import type { BrandInput, BrandOption } from '../../../shared/types/catalogue.ts';
import type { Database } from '../../db/client.ts';
import { constraintViolation } from '../../db/errors.ts';
import { brand } from '../../db/schema/index.ts';

const brandColumns = { id: brand.id, name: brand.name, slug: brand.slug, countryCode: brand.countryCode };

// Estonian order, as the public lists use: z after s, õ ä ö ü at the end.
const collator = new Intl.Collator('et');

export const listBrands = async (db: Database): Promise<BrandOption[]> =>
  (await db.select(brandColumns).from(brand)).toSorted((a, b) => collator.compare(a.name, b.name));

export type CreateBrandResult = { kind: 'created'; brand: BrandOption } | { kind: 'nameTaken' } | { kind: 'slugTaken' };

// The unique constraints decide, so two saves can't both pass a check made beforehand. The
// insert runs in its own transaction: inside a caller's one it becomes a savepoint, and a
// violation rolls back only that, leaving the caller's transaction usable.
export const createBrand = async (db: Database, input: BrandInput): Promise<CreateBrandResult> => {
  try {
    const [created] = await db.transaction(tx => tx.insert(brand).values(input).returning(brandColumns));
    if (!created) {
      throw new Error('Brand insert returned no row.');
    }
    return { kind: 'created', brand: created };
  } catch (error) {
    const violation = constraintViolation(error);
    if (violation?.constraint === 'brand_name_uq') {
      return { kind: 'nameTaken' };
    }
    if (violation?.constraint === 'brand_slug_uq') {
      return { kind: 'slugTaken' };
    }
    throw error;
  }
};

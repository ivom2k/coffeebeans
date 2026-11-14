import { z } from 'zod';
import {
  coffeeStatuses, speciesCodes, type BrandInput, type CoffeeEditorInput,
} from '../../../shared/types/catalogue.ts';
import { speciesShare } from '../../../shared/utils/catalogue.ts';
import { countryCodes } from '../../../shared/utils/countries.ts';
import { toGtin14 } from '../../../shared/utils/gtin.ts';
import { slugPattern } from '../../../shared/utils/slug.ts';

// Checked here too, so a bad slug is a 400 rather than a failed insert.
const slug = (max: number) => z.string().trim().min(1).max(max).regex(slugPattern);

// Stored as 14 digits, whatever printed form was typed. Blank means the barcode isn't known yet.
const optionalGtin = z.string().nullable().transform((value, ctx) => {
  if (value === null || value.trim() === '') {
    return null;
  }
  const result = toGtin14(value);
  if (!result.ok) {
    ctx.addIssue({ code: 'custom', message: result.error });
    return z.NEVER;
  }
  return result.gtin;
});

const distinct = <T>(values: readonly T[]) => new Set(values).size === values.length;

export const coffeeInputSchema = z.object({
  brandId: z.number().int().positive(),
  name: z.string().trim().min(1).max(150),
  slug: slug(200),
  status: z.enum(coffeeStatuses),
  roastLevel: z.number().int().min(1).max(5).nullable(),
  packages: z.array(z.object({ sizeG: z.number().int().positive().max(100_000), gtin: optionalGtin })).max(20)
    // The GTIN column is unique, so one coffee can't list a code twice either.
    .refine(packages => distinct(packages.flatMap(({ gtin }) => (gtin === null ? [] : [gtin]))), 'Each GTIN at most once'),
  species: z.array(z.object({ code: z.enum(speciesCodes), percentage: z.number().int().min(1).max(100).nullable() }))
    .refine(rows => distinct(rows.map(row => row.code)), 'Each species at most once')
    .refine(rows => speciesShare(rows).valid, 'Percentages must add up to 100 when every species has one'),
  origins: z.array(z.enum(countryCodes)).max(30).refine(distinct, 'Each country at most once'),
  // Blank means no description, stored as no row rather than an empty one.
  descriptions: z.object({ et: z.string().trim().max(2000).nullable().transform(text => text || null) }),
}) satisfies z.ZodType<CoffeeEditorInput>;

export const brandInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: slug(120),
  countryCode: z.enum(countryCodes).nullable(),
}) satisfies z.ZodType<BrandInput>;

export const coffeeIdSchema = z.object({ id: z.coerce.number().int().positive() });

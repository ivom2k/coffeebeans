import type { BrandOption } from '../../../../shared/types/catalogue.ts';
import { brandInputSchema } from '../../../features/catalogue/catalogueInput.ts';
import { createBrand } from '../../../features/catalogue/brands.ts';

// A new brand has no public coffees yet, so no public page changes and the cache stays.
export default defineEventHandler(async (event): Promise<BrandOption> => {
  requireAdmin(event);
  const input = await readValidatedBody(event, brandInputSchema.parse);
  const result = await createBrand(useDb(), input);
  if (result.kind !== 'created') {
    throw createError({ statusCode: 409, statusMessage: 'Brand conflict', data: { reason: result.kind } });
  }
  setResponseStatus(event, 201);
  return result.brand;
});

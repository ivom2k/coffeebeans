import type { BrandOption } from '../../../../shared/types/catalogue.ts';
import { listBrands } from '../../../features/catalogue/brands.ts';

export default defineEventHandler(async (event): Promise<BrandOption[]> => {
  requireAdmin(event);
  return listBrands(useDb());
});

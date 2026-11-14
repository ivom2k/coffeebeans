import type { CatalogueCoffeeRow } from '../../../../shared/types/catalogue.ts';
import { listCatalogueCoffees } from '../../../features/catalogue/listCatalogueCoffees.ts';

export default defineEventHandler(async (event): Promise<CatalogueCoffeeRow[]> => {
  requireAdmin(event);
  return listCatalogueCoffees(useDb());
});

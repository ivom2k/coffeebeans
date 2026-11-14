import type { CoffeeForEditing } from '../../../../shared/types/catalogue.ts';
import { coffeeIdSchema } from '../../../features/catalogue/catalogueInput.ts';
import { getCoffeeForEditing } from '../../../features/catalogue/getCoffeeForEditing.ts';

export default defineEventHandler(async (event): Promise<CoffeeForEditing> => {
  requireAdmin(event);
  const { id } = await getValidatedRouterParams(event, coffeeIdSchema.parse);
  const coffee = await getCoffeeForEditing(useDb(), id);
  if (!coffee) {
    throw createError({ statusCode: 404, statusMessage: 'Coffee not found' });
  }
  return coffee;
});

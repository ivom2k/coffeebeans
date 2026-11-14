import { coffeeIdSchema } from '../../../../features/catalogue/catalogueInput.ts';
import { markCoffeeReviewed } from '../../../../features/catalogue/saveCoffee.ts';

// The review date isn't shown publicly, so the public cache stays as it is.
export default defineEventHandler(async (event): Promise<{ reviewedAt: string }> => {
  requireAdmin(event);
  const { id } = await getValidatedRouterParams(event, coffeeIdSchema.parse);
  const marked = await markCoffeeReviewed(useDb(), id);
  if (!marked) {
    throw createError({ statusCode: 404, statusMessage: 'Coffee not found' });
  }
  return marked;
});

import { coffeeIdSchema, coffeeInputSchema } from '../../../features/catalogue/catalogueInput.ts';
import { updateCoffee } from '../../../features/catalogue/saveCoffee.ts';

// PUT: the form always sends the whole coffee, lists included.
export default defineEventHandler(async (event): Promise<{ id: number }> => {
  requireAdmin(event);
  const { id } = await getValidatedRouterParams(event, coffeeIdSchema.parse);
  const input = await readValidatedBody(event, coffeeInputSchema.parse);
  savedCoffeeId(await updateCoffee(useDb(), id, input));
  // After the commit; a renamed slug's old URL now redirects, which cached pages don't know yet.
  await clearPublicPageCache();
  return { id };
});

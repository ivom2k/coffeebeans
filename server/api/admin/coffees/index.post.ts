import { coffeeInputSchema } from '../../../features/catalogue/catalogueInput.ts';
import { createCoffee } from '../../../features/catalogue/saveCoffee.ts';

export default defineEventHandler(async (event): Promise<{ id: number }> => {
  requireAdmin(event);
  const input = await readValidatedBody(event, coffeeInputSchema.parse);
  const id = savedCoffeeId(await createCoffee(useDb(), input));
  // After the commit: a published coffee joins the lists, and cleared any earlier, a request
  // could cache the old ones again.
  await clearPublicPageCache();
  setResponseStatus(event, 201);
  return { id };
});

import { coffeeIdSchema } from '../../../../features/catalogue/catalogueInput.ts';
import { removeCoffeeImage } from '../../../../features/catalogue/removeCoffeeImage.ts';

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const { id } = await getValidatedRouterParams(event, coffeeIdSchema.parse);
  const result = await removeCoffeeImage(useDb(), useRuntimeConfig(event).mediaDir, id);
  if (result.kind === 'notFound') {
    throw createError({ statusCode: 404, statusMessage: 'Coffee not found' });
  }
  await clearPublicPageCache();
  return null;
});

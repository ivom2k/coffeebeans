import { z } from 'zod';
import type { MyRating } from '../../../../shared/types/rating.ts';
import { ratingInputSchema } from '../../../features/rating/ratingInput.ts';
import { saveRating } from '../../../features/rating/saveRating.ts';

const paramsSchema = z.object({ slug: z.string().min(1).max(200) });

// PUT: one rating per user and coffee, so saving again replaces it.
export default defineEventHandler(async (event): Promise<{ rating: MyRating }> => {
  const user = requireUser(event);
  const { slug } = await getValidatedRouterParams(event, paramsSchema.parse);
  const input = await readValidatedBody(event, ratingInputSchema.parse);
  const result = await saveRating(useDb(), user.id, slug, input);
  if (result.kind === 'notFound') {
    throw createError({ statusCode: 404, statusMessage: 'Coffee not found' });
  }
  if (result.kind === 'unknownMachine') {
    throw createError({ statusCode: 422, statusMessage: 'Unknown machine model' });
  }
  // After the commit: cleared any earlier, a request could cache the old numbers again.
  await clearPublicPageCache();
  return { rating: result.rating };
});

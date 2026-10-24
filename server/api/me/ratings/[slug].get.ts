import { z } from 'zod';
import type { MyRating } from '../../../../shared/types/rating.ts';
import { getMyRating } from '../../../features/rating/getMyRating.ts';

const paramsSchema = z.object({ slug: z.string().min(1).max(200) });

// rating null: not rated yet. Wrapped in an object, since a bare null answers 204.
export default defineEventHandler(async (event): Promise<{ rating: MyRating | null }> => {
  const user = requireUser(event);
  const { slug } = await getValidatedRouterParams(event, paramsSchema.parse);
  const result = await getMyRating(useDb(), user.id, slug);
  if (result.kind === 'notFound') {
    throw createError({ statusCode: 404, statusMessage: 'Coffee not found' });
  }
  return { rating: result.rating };
});

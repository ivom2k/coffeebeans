import { z } from 'zod';
import type { CoffeePageResponse } from '../../../shared/types/coffee.ts';
import { locales } from '../../db/schema/common.ts';
import { getCoffeePage } from '../../features/coffee/getCoffeePage.ts';

const paramsSchema = z.object({ slug: z.string().min(1).max(200) });
const querySchema = z.object({ locale: z.enum(locales).default('et') });

export default defineEventHandler(async (event): Promise<CoffeePageResponse> => {
  const { slug } = await getValidatedRouterParams(event, paramsSchema.parse);
  const { locale } = await getValidatedQuery(event, querySchema.parse);
  const result = await getCoffeePage(useDb(), slug, locale);
  if (result.kind === 'notFound') {
    throw createError({ statusCode: 404, statusMessage: 'Coffee not found' });
  }
  return result;
});

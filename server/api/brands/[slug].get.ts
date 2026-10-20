import { z } from 'zod';
import type { BrandPageResponse } from '../../../shared/types/brand.ts';
import { getBrandPage } from '../../features/brand/getBrandPage.ts';

const paramsSchema = z.object({ slug: z.string().min(1).max(120) });

export default defineEventHandler(async (event): Promise<BrandPageResponse> => {
  const { slug } = await getValidatedRouterParams(event, paramsSchema.parse);
  const page = await getBrandPage(useDb(), slug);
  if (!page) {
    throw createError({ statusCode: 404, statusMessage: 'Brand not found' });
  }
  return page;
});

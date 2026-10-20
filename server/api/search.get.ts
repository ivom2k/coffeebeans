import { z } from 'zod';
import { searchCatalogue } from '../features/search/searchCatalogue.ts';

const querySchema = z.object({
  q: z.string().trim().min(2).max(100),
});

// Not cached (nuxt.config.ts): every query is different.
export default defineEventHandler(async (event) => {
  const { q } = await getValidatedQuery(event, querySchema.parse);
  return searchCatalogue(useDb(), q);
});

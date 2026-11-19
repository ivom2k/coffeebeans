import { z } from 'zod';
import { searchCatalogue } from '../features/search/searchCatalogue.ts';
import { textSchema } from '../features/security/textInput.ts';

const querySchema = z.object({
  q: textSchema({ min: 2, max: 100 }),
});

// Not cached (nuxt.config.ts): every query is different.
export default defineEventHandler(async (event) => {
  const { q } = await getValidatedQuery(event, querySchema.parse);
  return searchCatalogue(useDb(), q);
});

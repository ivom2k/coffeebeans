import { z } from 'zod';
import type { RankedCoffees } from '../../shared/types/coffee.ts';
import { listRankedCoffees } from '../features/coffee/listRankedCoffees.ts';

const querySchema = z.object({
  // "?roast=4,5": declared roast levels 1 (light) to 5 (dark).
  roast: z.string()
    .regex(/^[1-5](,[1-5])*$/)
    .transform(value => [...new Set(value.split(',').map(Number))])
    .optional(),
  // "?issues=few" hides coffees flagged for machine issues (decisions log §2).
  issues: z.literal('few').optional(),
});

export default defineEventHandler(async (event): Promise<RankedCoffees> => {
  const query = await getValidatedQuery(event, querySchema.parse);
  return listRankedCoffees(useDb(), { roastLevels: query.roast ?? [], fewIssuesOnly: query.issues === 'few' });
});

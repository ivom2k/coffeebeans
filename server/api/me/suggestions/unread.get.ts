import type { UnreadOutcomes } from '../../../../shared/types/suggestion.ts';
import { countUnreadOutcomes } from '../../../features/suggestion/mySuggestions.ts';

// The marker on the profile icon: outcomes the user hasn't seen yet.
export default defineEventHandler(async (event): Promise<UnreadOutcomes> => {
  const user = requireUser(event);
  return { count: await countUnreadOutcomes(useDb(), user.id) };
});

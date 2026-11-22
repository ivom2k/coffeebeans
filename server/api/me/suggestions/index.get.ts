import type { MySuggestion } from '../../../../shared/types/suggestion.ts';
import { listMySuggestions } from '../../../features/suggestion/mySuggestions.ts';

// "Minu ettepanekud". Reading the list changes nothing: outcomes are marked as seen only by the
// POST to seen.post.ts (CLAUDE.md § Access).
export default defineEventHandler((event): Promise<MySuggestion[]> => {
  const user = requireUser(event);
  return listMySuggestions(useDb(), user.id);
});

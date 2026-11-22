import { markOutcomesSeen, markSeenSchema } from '../../../features/suggestion/mySuggestions.ts';

// Sent by "Minu ettepanekud" once it has shown new outcomes, with their ids. It marks only the
// caller's own, whatever ids it is sent.
export default defineEventHandler(async (event): Promise<{ marked: number }> => {
  const user = requireUser(event);
  const { ids } = await readValidatedBody(event, markSeenSchema.parse);
  return { marked: await markOutcomesSeen(useDb(), user.id, ids) };
});

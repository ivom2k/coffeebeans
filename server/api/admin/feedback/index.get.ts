import type { FeedbackItem } from '../../../../shared/types/feedback.ts';
import { feedbackListQuerySchema } from '../../../features/feedback/feedbackInput.ts';
import { listFeedback } from '../../../features/feedback/listFeedback.ts';

export default defineEventHandler(async (event): Promise<FeedbackItem[]> => {
  requireAdmin(event);
  const { status } = await getValidatedQuery(event, feedbackListQuerySchema.parse);
  return listFeedback(useDb(), status);
});

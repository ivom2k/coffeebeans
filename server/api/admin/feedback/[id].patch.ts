import { feedbackIdSchema, feedbackStatusSchema } from '../../../features/feedback/feedbackInput.ts';
import { setFeedbackStatus } from '../../../features/feedback/setFeedbackStatus.ts';

// Feedback is never shown publicly, so the public cache stays as it is.
export default defineEventHandler(async (event): Promise<Record<string, never>> => {
  requireAdmin(event);
  const { id } = await getValidatedRouterParams(event, feedbackIdSchema.parse);
  const { status } = await readValidatedBody(event, feedbackStatusSchema.parse);
  const result = await setFeedbackStatus(useDb(), id, status);
  if (result.kind === 'notFound') {
    throw createError({ statusCode: 404, statusMessage: 'Feedback not found' });
  }
  return {};
});

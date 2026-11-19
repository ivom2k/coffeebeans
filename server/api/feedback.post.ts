import { feedbackLimits } from '../../shared/utils/feedback.ts';
import { feedbackInputSchema } from '../features/feedback/feedbackInput.ts';
import { sendFeedback, type FeedbackSender } from '../features/feedback/sendFeedback.ts';

// The feedback widget, open to visitors who never signed in (decisions log §6). It reads the
// user from the context the session middleware set and never touches the session itself, so a
// visitor's request leaves with no cookie (CLAUDE.md § Access).
export default defineEventHandler(async (event): Promise<Record<string, never>> => {
  const { message, pagePath, website } = await readValidatedBody(event, feedbackInputSchema.parse);

  // A filled honeypot gets the answer a real send gets, so a bot learns nothing from it.
  if (website) {
    setResponseStatus(event, 201);
    return {};
  }

  // Checked for a signed-in sender too: without the key the site is misconfigured, and the
  // first visitor would be the one to find out.
  const ipHmac = storedIpHmac(event);
  if (ipHmac === null) {
    console.error('Feedback refused: NUXT_IP_HMAC_KEY is missing or shorter than 32 characters.');
    throw createError({ statusCode: 503, statusMessage: 'Feedback unavailable' });
  }

  const { user } = event.context;
  const sender: FeedbackSender = user ? { kind: 'user', userId: user.id } : { kind: 'visitor', ipHmac };
  const result = await sendFeedback(useDb(), { message, pagePath, sender }, feedbackLimits);
  // The same answer for either cap, so a sender can't tell how close the site is to its own.
  if (result.kind !== 'sent') {
    throw createError({ statusCode: 429, statusMessage: 'Too many messages' });
  }
  setResponseStatus(event, 201);
  return {};
});

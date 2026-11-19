import { z } from 'zod';
import { feedbackStatuses, type FeedbackInput } from '../../../shared/types/feedback.ts';
import { maxFeedbackLength } from '../../../shared/utils/feedback.ts';
import { toPagePath } from '../../../shared/utils/localPath.ts';
import { textSchema } from '../security/textInput.ts';

// What the widget sends. Strict, so a field nobody expects is a 400 rather than ignored.
export const feedbackInputSchema = z.strictObject({
  message: textSchema({ min: 1, max: maxFeedbackLength, multiline: true }),
  // The page the widget was opened on, kept as its pathname only (decisions log §6). Anything
  // that isn't a path on this site becomes no page rather than a refusal: the message still counts.
  pagePath: z.string().max(2048).nullish().transform(toPagePath),
  website: z.string().max(200).optional(),
}) satisfies z.ZodType<FeedbackInput>;

export const feedbackIdSchema = z.object({ id: z.coerce.number().int().positive() });

export const feedbackListQuerySchema = z.object({ status: z.enum(feedbackStatuses).default('NEW') });

export const feedbackStatusSchema = z.strictObject({ status: z.enum(feedbackStatuses) });

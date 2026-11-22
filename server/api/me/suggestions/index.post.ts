import { suggestionLimits } from '../../../../shared/utils/suggestion.ts';
import type { CapRefusal } from '../../../features/suggestion/createSuggestion.ts';
import { submitSuggestion } from '../../../features/suggestion/submitSuggestion.ts';

// A coffee or machine suggestion, with an optional price-tag photo in the same multipart request
// (decisions log §6). server/middleware/0.guard.ts has already refused a declared length over
// the route's cap, a body sent without one, and anything that isn't a form.

const capError = (refusal: CapRefusal) => {
  const status = { accountLimit: 409, dailyLimit: 429, queueFull: 503, photoQueueFull: 503 } as const;
  return createError({ statusCode: status[refusal], statusMessage: 'Suggestion limit reached', data: { reason: refusal } });
};

export default defineEventHandler(async (event): Promise<{ id: number }> => {
  const user = requireUser(event);
  const result = await submitSuggestion(useDb(), {
    userId: user.id,
    privateDir: useRuntimeConfig(event).privateMediaDir,
    request: event.node.req,
    // Node's built-in parser through h3's readFormData: a few megabytes of photo cost about as
    // much memory again, where h3's own multipart parser copied it byte by byte into an array
    // ten times its size (decisions log §6).
    readForm: () => readFormData(event),
  }, suggestionLimits);

  switch (result.kind) {
    case 'created':
      setResponseStatus(event, 201);
      return { id: result.id };
    case 'busy':
      setResponseHeader(event, 'Retry-After', 10);
      throw createError({ statusCode: 503, statusMessage: 'Too many uploads at once' });
    case 'inProgress':
      setResponseHeader(event, 'Retry-After', 10);
      throw createError({ statusCode: 429, statusMessage: 'Upload already in progress', data: { reason: 'inProgress' } });
    case 'timedOut':
    case 'aborted':
      throw unfinishedUploadError(event, result.kind);
    case 'unreadable':
      throw createError({ statusCode: 400, statusMessage: 'Form not readable' });
    case 'formRefused':
      throw createError({ statusCode: result.status, statusMessage: 'Suggestion form refused', data: { reason: result.reason } });
    case 'invalid':
      throw createError({ statusCode: 400, statusMessage: 'Invalid suggestion' });
    case 'empty':
    case 'photoNotTaken':
      throw createError({ statusCode: 400, statusMessage: 'Invalid suggestion', data: { reason: result.kind } });
    case 'unsupported':
    case 'tooLarge':
      throw createError({ statusCode: 422, statusMessage: 'Photo not accepted', data: { reason: result.kind } });
    default:
      throw capError(result.kind);
  }
});

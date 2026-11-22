import type { H3Event } from 'h3';

// What an upload handler answers when the body never arrived whole (server/features/security/
// uploadRead.ts).
export const unfinishedUploadError = (event: H3Event, kind: 'timedOut' | 'aborted') => {
  if (kind === 'aborted') {
    // The client has left, so nobody reads this; it only ends the handler.
    return createError({ statusCode: 400, statusMessage: 'Upload aborted' });
  }
  // The answer goes out first; then the connection is closed under the rest of the upload.
  setResponseHeader(event, 'Connection', 'close');
  event.node.res.once('finish', () => event.node.req.destroy());
  return createError({ statusCode: 408, statusMessage: 'Upload too slow' });
};

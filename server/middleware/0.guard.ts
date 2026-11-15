import { checkBody } from '../features/security/bodyLimits.ts';
import { isSameOriginRequest } from '../features/security/requestOrigin.ts';

// Every request passes here first (Nitro runs middleware in file-name order), before the session
// is loaded and before any handler reads a body. Two refusals no endpoint has to remember:
// a write that doesn't come from this site's own pages, and a body larger than its route allows.
// Never exempt a route: a new upload gets a row in bodyLimits.ts instead (CLAUDE.md § Access).
export default defineEventHandler((event) => {
  const header = (name: string) => getRequestHeader(event, name);

  const sameOrigin = isSameOriginRequest({
    method: event.method,
    secFetchSite: header('sec-fetch-site'),
    origin: header('origin'),
    host: header('host'),
  });
  if (!sameOrigin) {
    throw createError({ statusCode: 403, statusMessage: 'Cross-site request refused' });
  }

  const body = checkBody({
    method: event.method,
    path: getRequestURL(event).pathname,
    contentLength: header('content-length'),
    transferEncoding: header('transfer-encoding'),
    contentType: header('content-type'),
  });
  if (!body.ok) {
    throw createError({ statusCode: body.status, statusMessage: body.message });
  }
});

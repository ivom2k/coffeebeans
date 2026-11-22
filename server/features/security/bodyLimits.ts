// How large a request body each route may send, checked from the headers before a handler runs
// and so before a byte of the body is read into memory. The app reads bodies whole, so without
// this any visitor could make it hold megabytes per request. Caddy has the same caps
// (deploy/caddy/Caddyfile); these are the ones the tests can reach, and the ones dev has.
//
// A route that takes an upload adds a row here and a matcher in the Caddyfile. Everything else
// gets the default, so a new endpoint is capped without anyone remembering to.

import { maxSuggestionPhotoBytes } from '../../../shared/utils/suggestion.ts';

// `image`: the raw bytes of one file. `multipart`: a form with fields and a file, as a browser
// sends FormData.
export type BodyKind = 'json' | 'image' | 'multipart';
export type BodyLimit = { kind: BodyKind; maxBytes: number };

const kib = 1024;
const mib = 1024 * kib;

// The largest JSON the app takes is the admin's coffee form: a 2000-character description (up to
// four bytes each), twenty packages and thirty origins come to about 10 KiB.
export const defaultBodyLimit: BodyLimit = { kind: 'json', maxBytes: 32 * kib };

// A phone photo is a few megabytes.
export const adminImageLimit: BodyLimit = { kind: 'image', maxBytes: 15 * mib };

// A user's suggestion: the photo, plus room for the form's envelope and its small JSON part.
export const suggestionUploadLimit: BodyLimit = { kind: 'multipart', maxBytes: maxSuggestionPhotoBytes + 64 * kib };

const uploadRoutes: readonly { method: string; pattern: RegExp; limit: BodyLimit }[] = [
  { method: 'PUT', pattern: /^\/api\/admin\/coffees\/[^/]+\/image$/, limit: adminImageLimit },
  { method: 'POST', pattern: /^\/api\/me\/suggestions$/, limit: suggestionUploadLimit },
];

// Lower case and without a trailing slash, so a variant spelling of an upload route can only
// fall back to the smaller default, never the other way round.
const normalise = (path: string) => path.toLowerCase().replace(/\/+$/, '');

export const bodyLimitFor = (method: string, path: string): BodyLimit =>
  uploadRoutes.find(route => route.method === method.toUpperCase() && route.pattern.test(normalise(path)))?.limit
  ?? defaultBodyLimit;

export type BodyHeaders = {
  method: string;
  path: string;
  contentLength: string | undefined;
  transferEncoding: string | undefined;
  contentType: string | undefined;
};

export type BodyCheck = { ok: true } | { ok: false; status: 400 | 411 | 413 | 415; message: string };

export const checkBody = ({ method, path, contentLength, transferEncoding, contentType }: BodyHeaders): BodyCheck => {
  // A chunked body declares no length, so it could only be measured while it is read. Browsers
  // send a length for every body the site's own pages produce.
  if (transferEncoding !== undefined) {
    return { ok: false, status: 411, message: 'Length required' };
  }
  if (contentLength !== undefined && !/^\d+$/.test(contentLength)) {
    return { ok: false, status: 400, message: 'Invalid Content-Length' };
  }
  // Node reads no more than the declared length, so the header bounds what reaches memory.
  const length = Number(contentLength ?? 0);
  const limit = bodyLimitFor(method, path);
  if (length > limit.maxBytes) {
    return { ok: false, status: 413, message: 'Request body too large' };
  }
  // h3 parses JSON out of any content type, text/plain included, which a plain HTML form on
  // another site can send. An image route checks its bytes itself.
  if (length > 0 && limit.kind === 'json' && !/^application\/json\s*(;|$)/i.test(contentType ?? '')) {
    return { ok: false, status: 415, message: 'JSON expected' };
  }
  // A form route reads nothing but a form, so a stray JSON or text body never reaches its parser.
  if (length > 0 && limit.kind === 'multipart' && !/^multipart\/form-data\s*;/i.test(contentType ?? '')) {
    return { ok: false, status: 415, message: 'Form expected' };
  }
  return { ok: true };
};

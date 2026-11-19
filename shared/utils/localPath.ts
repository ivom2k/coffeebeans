// Paths that come from a request and must stay on this site: where the browser goes after
// sign-in, and the page a feedback message was sent from, which the admin inbox shows as a link.
// Anything else would be an open redirect, or a link to another site in the admin's own inbox.

const maxInputLength = 2048;
export const maxPagePathLength = 300;
// Never contacted. A path that resolves to any other origin was trying to leave the site.
const placeholderOrigin = 'https://local-path.invalid';

// The URL parser reads paths the way browsers do: a backslash counts as a slash and tabs and
// newlines vanish, so "/\evil.example" and "/\t/evil.example" both come out as another host.
// Dot segments are resolved too, and "/.//evil.example" keeps this origin but resolves to the
// path "//evil.example", which a browser reads as another host once it is a Location or an href.
const parseLocalPath = (value: unknown): URL | null => {
  if (typeof value !== 'string' || value.length > maxInputLength || !value.startsWith('/')) {
    return null;
  }
  const url = URL.parse(value, placeholderOrigin);
  return url?.origin === placeholderOrigin && !url.pathname.startsWith('//') ? url : null;
};

// The whole path with its query and hash, or the home page.
export const toLocalPath = (value: unknown): string => {
  const url = parseLocalPath(value);
  return url ? `${url.pathname}${url.search}${url.hash}` : '/';
};

// The pathname alone, or null. A query can hold a search, which the inbox doesn't need.
export const toPagePath = (value: unknown): string | null => {
  const pathname = parseLocalPath(value)?.pathname;
  return pathname !== undefined && pathname.length <= maxPagePathLength ? pathname : null;
};

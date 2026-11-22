// A link typed by a user, such as a suggestion's product page, which the admin later clicks.
// Only an absolute http: or https: URL without credentials is a link; anything else (javascript:,
// data:, a path, //host) never reaches an href. The server never fetches it. Used by the API and
// again by every component that binds such a link to href (CLAUDE.md § Access).

export const maxHttpUrlLength = 500;

// Whitespace and control characters. The URL parser drops tabs and newlines silently, so
// "java\tscript:" would otherwise parse as javascript:.
const unsafeCharacter = /[\s\p{Cc}]/u;

export const toHttpUrl = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length > maxHttpUrlLength || unsafeCharacter.test(value)) {
    return null;
  }
  const url = URL.parse(value);
  if (url === null || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
    return null;
  }
  if (url.username !== '' || url.password !== '' || url.hostname === '') {
    return null;
  }
  // The normalised form can be longer than what was typed: an IDN host becomes punycode and
  // non-ASCII in the path is percent-encoded.
  return url.href.length <= maxHttpUrlLength ? url.href : null;
};

// Where the browser goes after sign-in. The value comes from the query string, so anything that
// isn't a path on this site becomes the home page; otherwise a crafted sign-in link would send
// a visitor through Google and on to another site (an open redirect).

const maxLength = 2048;
// Never contacted. A path that resolves to any other origin was trying to leave the site.
const placeholderOrigin = 'https://return-path.invalid';

export const toLocalPath = (value: unknown): string => {
  if (typeof value !== 'string' || value.length > maxLength || !value.startsWith('/')) {
    return '/';
  }
  // The URL parser reads paths the way browsers do: a backslash counts as a slash and tabs and
  // newlines vanish, so "/\evil.example" and "/\t/evil.example" both come out as another host.
  const url = URL.parse(value, placeholderOrigin);
  return url?.origin === placeholderOrigin ? `${url.pathname}${url.search}${url.hash}` : '/';
};

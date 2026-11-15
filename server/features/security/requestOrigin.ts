// Cross-site request forgery: another site makes a visitor's browser send a write here, with the
// visitor's session cookie attached. The cookie's SameSite=Lax already keeps it off cross-site
// POSTs, but that trusts every subdomain of kohvioad.eu and rests on one cookie attribute. This
// check is the second lock: a write must come from a page of this very origin.

// Never change state (CLAUDE.md § Access), so they need no origin.
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export type RequestOrigin = {
  method: string;
  secFetchSite: string | undefined;
  origin: string | undefined;
  host: string | undefined;
};

export const isSameOriginRequest = ({ method, secFetchSite, origin, host }: RequestOrigin): boolean => {
  if (safeMethods.has(method.toUpperCase())) {
    return true;
  }
  // Browsers set Sec-Fetch-Site themselves and page scripts can't change it. `same-site` is a
  // subdomain, which is not this origin; `none` is a typed address, never a write.
  if (secFetchSite !== undefined) {
    return secFetchSite === 'same-origin';
  }
  // Older browsers send only Origin on a cross-origin write. Neither header means the request
  // didn't come from a browser (curl, a test), where no visitor's cookie rides along.
  if (origin === undefined) {
    return true;
  }
  // "null" (a sandboxed frame) parses as no URL and is refused.
  const originHost = URL.parse(origin)?.host;
  return originHost !== undefined && host !== undefined && originHost === host.toLowerCase();
};

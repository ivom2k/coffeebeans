import type { Bucket } from './rateLimiter.ts';

// Which requests are counted, and against what. One table rather than a call in each handler,
// so a new endpoint is limited without anyone remembering to: a write that isn't listed here
// falls into `unlisted`, and a test fails until it gets a row (server/tests/routes.test.ts).

const minute = 60_000;
const hour = 60 * minute;

export const buckets = {
  // Uncached, and two sequential scans per request. A minute of typing in the search field, or
  // the suggestion form's duplicate check, stays well under it.
  search: { name: 'search', limit: 60, windowMs: minute },
  // Both legs of a sign-in count, so ten sign-ins an hour from one address. Each callback costs
  // a request to Google and a database write.
  signIn: { name: 'signIn', limit: 20, windowMs: hour },
  // Every save empties the whole route cache, so a loop of them would make every page render
  // from Postgres.
  ratingSave: { name: 'ratingSave', limit: 30, windowMs: hour },
  machineWrite: { name: 'machineWrite', limit: 30, windowMs: hour },
  // The one write a visitor can make without signing in. The daily caps per sender and for the
  // whole site are counted from the table (shared/utils/feedback.ts).
  feedback: { name: 'feedback', limit: 5, windowMs: hour },
  unlisted: { name: 'unlisted', limit: 30, windowMs: hour },
} as const satisfies Record<string, Bucket>;

// `user` counts per account once signed in; before that, and for `ip`, per client address.
export type LimitRule = { bucket: Bucket; by: 'ip' | 'user' } | 'none';

const rules: readonly { methods: readonly string[]; pattern: RegExp; rule: LimitRule }[] = [
  { methods: ['GET'], pattern: /^\/api\/search$/, rule: { bucket: buckets.search, by: 'ip' } },
  // The search page runs the same query while it renders on the server, where the call to the
  // endpoint is internal and uncounted. With or without a locale prefix (/ru/otsing).
  { methods: ['GET'], pattern: /^(\/[a-z]{2})?\/otsing$/, rule: { bucket: buckets.search, by: 'ip' } },
  { methods: ['GET'], pattern: /^\/api\/auth\/google$/, rule: { bucket: buckets.signIn, by: 'ip' } },
  { methods: ['PUT'], pattern: /^\/api\/me\/ratings\/[^/]+$/, rule: { bucket: buckets.ratingSave, by: 'user' } },
  { methods: ['POST'], pattern: /^\/api\/me\/machines$/, rule: { bucket: buckets.machineWrite, by: 'user' } },
  { methods: ['PATCH', 'DELETE'], pattern: /^\/api\/me\/machines\/[^/]+$/, rule: { bucket: buckets.machineWrite, by: 'user' } },
  // By the account when signed in, otherwise by the address.
  { methods: ['POST'], pattern: /^\/api\/feedback$/, rule: { bucket: buckets.feedback, by: 'user' } },
  // The role check is the limit: only the admin gets past server/middleware/2.admin.ts.
  { methods: ['POST', 'PUT', 'PATCH', 'DELETE'], pattern: /^\/api\/admin\//, rule: 'none' },
  // Sign-out only ends the caller's own session.
  { methods: ['DELETE'], pattern: /^\/api\/_auth\/session$/, rule: 'none' },
];

const readMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const normalise = (path: string) => path.toLowerCase().replace(/\/+$/, '');

// Undefined for a read nobody listed: pages and cached endpoints are served from the route
// cache and are not counted.
export const limitRuleFor = (method: string, path: string): LimitRule | undefined => {
  const verb = method.toUpperCase();
  const listed = rules.find(rule => rule.methods.includes(verb) && rule.pattern.test(normalise(path)))?.rule;
  if (listed !== undefined) {
    return listed;
  }
  return readMethods.has(verb) ? undefined : { bucket: buckets.unlisted, by: 'user' };
};

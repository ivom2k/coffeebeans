import { limitRuleFor } from '../features/security/rateLimits.ts';

// Counts the requests listed in rateLimits.ts and refuses the ones over their limit. Runs after
// 1.session.ts, so a signed-in user's writes are counted per account wherever they come from.
//
// The user is read only for rules counted `by: 'user'`, which are all writes under /api/me/.
// Nothing here runs for a cached page: those have no rule (CLAUDE.md § Access).
export default defineEventHandler((event) => {
  // The request from outside was counted when it arrived; the calls a server render makes on
  // its behalf are not counted again.
  if (isInternalRequest(event)) {
    return;
  }
  const rule = limitRuleFor(event.method, getRequestURL(event).pathname);
  if (rule === undefined || rule === 'none') {
    return;
  }

  const user = rule.by === 'user' ? event.context.user : undefined;
  const subject = user ? `u:${user.id}` : `ip:${limiterSubject(event)}`;
  const taken = useRateLimiter().take(rule.bucket, subject);
  if (!taken.allowed) {
    setResponseHeader(event, 'Retry-After', taken.retryAfterSeconds);
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' });
  }
});

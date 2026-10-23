import type { H3Event } from 'h3';
import type { SessionUser } from '../features/auth/sessionUser.ts';

declare module 'h3' {
  interface H3EventContext {
    // Set by server/middleware/session.ts when the request belongs to an active account.
    user?: SessionUser;
  }
}

// Handlers read the user from here rather than from getUserSession(), which would start an
// empty session, and set a cookie, for a visitor who never signed in.
export const requireUser = (event: H3Event): SessionUser => {
  const { user } = event.context;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Sign-in required' });
  }
  return user;
};

// For server/api/admin/. The role is read from the database on every request, so it is the
// check; hidden UI never is.
export const requireAdmin = (event: H3Event): SessionUser => {
  const user = requireUser(event);
  if (user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Admins only' });
  }
  return user;
};

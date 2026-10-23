import type { H3Event } from 'h3';
import { findActiveUser } from '../features/auth/findActiveUser.ts';

// clearUserSession() alone leaves the cookie in the browser with an empty value; deleting it
// leaves no cookie at all. A browser matches the cookie to delete by name and path, and the
// path is h3's default for both.
const endSession = async (event: H3Event) => {
  await clearUserSession(event);
  deleteCookie(event, useRuntimeConfig(event).session.name);
};

// Sealed session cookies can't be revoked one by one, so every request that carries one is
// checked against the database: a deleted or anonymised account is signed out on its next
// request (decisions log §7).
//
// The library's own session route is answered here too: GET is the browser's session check on
// every page load, DELETE is sign-out. Its handlers would start an empty session, and set a
// cookie, for a visitor who never signed in, or leave an emptied cookie behind on sign-out.
export default defineEventHandler(async (event) => {
  const onSessionRoute = getRequestURL(event).pathname === '/api/_auth/session';
  if (onSessionRoute && event.method === 'DELETE') {
    await endSession(event);
    return { loggedOut: true };
  }
  const isSessionCheck = onSessionRoute && event.method === 'GET';

  if (getCookie(event, useRuntimeConfig(event).session.name) === undefined) {
    return isSessionCheck ? {} : undefined;
  }

  // A cookie that is empty or no longer unseals (expired, or the session password changed)
  // reads as a session without `secure`, and is deleted below.
  const { secure } = await getUserSession(event);
  const user = secure ? await findActiveUser(useDb(), secure.userId) : null;
  if (user) {
    event.context.user = user;
    return;
  }
  await endSession(event);
  return isSessionCheck ? {} : undefined;
});

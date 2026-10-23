import type { H3Event } from 'h3';
import { z } from 'zod';
import { findOrCreateGoogleUser } from '../../features/auth/findOrCreateGoogleUser.ts';
import { toLocalPath } from '../../features/auth/returnPath.ts';

// Sign-in with Google, both legs: without `code` it sends the browser to Google, and Google
// sends it back here with one. Registered as the redirect URI of the Google OAuth clients.

const querySchema = z.object({
  redirect: z.string().optional().transform(toLocalPath),
  code: z.string().optional(),
  error: z.string().optional(),
});
const userinfoSchema = z.object({ sub: z.string().min(1).max(255) });

// Where to go afterwards, kept across the trip to Google. Lax, because the way back is a
// top-level navigation from accounts.google.com.
const returnCookie = 'sign-in-return';
const returnCookieOptions = {
  httpOnly: true,
  secure: !import.meta.dev,
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: 60 * 10,
} as const;

const takeReturnPath = (event: H3Event) => {
  const path = toLocalPath(getCookie(event, returnCookie));
  deleteCookie(event, returnCookie, returnCookieOptions);
  return path;
};

const googleSignIn = defineOAuthGoogleEventHandler({
  // The library's default is `email profile`. Only the subject is needed (decisions log §5).
  config: { scope: ['openid'] },
  async onSuccess(event, { user: userinfo }) {
    const { sub } = userinfoSchema.parse(userinfo);
    const user = await findOrCreateGoogleUser(useDb(), sub);
    await setUserSession(event, { user: {}, secure: { userId: user.id } });
    return sendRedirect(event, takeReturnPath(event));
  },
  onError(_event, error) {
    // Google's error text only, never the tokens. Rethrown, it renders error.vue.
    console.error(error.message);
    throw error;
  },
});

export default defineEventHandler(async (event) => {
  const { redirect, code, error } = await getValidatedQuery(event, querySchema.parse);
  // Cancel on Google's screen comes back with `error` and no `code`, which the library would
  // take as a fresh start and send the browser straight back to Google.
  if (error) {
    return sendRedirect(event, takeReturnPath(event));
  }
  if (!code) {
    setCookie(event, returnCookie, redirect, returnCookieOptions);
  }
  return googleSignIn(event);
});

// Every admin endpoint is refused here to anyone but an admin, before its handler runs and so
// before a body is read: a signed-in user can't make the server hold a photo upload just to be
// told no. Runs after 1.session.ts (Nitro orders middleware by file name), which sets the user.
// The handlers check again with requireAdmin(), next to the code they guard.
export default defineEventHandler((event) => {
  if (getRequestURL(event).pathname.toLowerCase().startsWith('/api/admin/')) {
    requireAdmin(event);
  }
});

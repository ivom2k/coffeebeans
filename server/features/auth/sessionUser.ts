import { appUser, type userRoles } from '../../db/schema/index.ts';

// What a request knows about its signed-in user. The session middleware reads it from the
// database on every request rather than from the cookie, so a deleted account or a changed
// role takes effect on the next request.
export type SessionUser = { id: number; role: (typeof userRoles)[number] };

export const sessionUserColumns = { id: appUser.id, role: appUser.role };

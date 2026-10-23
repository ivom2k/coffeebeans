import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../db/client.ts';
import { appUser } from '../../db/schema/index.ts';
import { sessionUserColumns, type SessionUser } from './sessionUser.ts';

// null once the account is deleted or anonymised: the caller then ends the session.
export const findActiveUser = async (db: Database, userId: number): Promise<SessionUser | null> => {
  const [user] = await db
    .select(sessionUserColumns)
    .from(appUser)
    .where(and(eq(appUser.id, userId), isNull(appUser.deletedAt)));
  return user ?? null;
};

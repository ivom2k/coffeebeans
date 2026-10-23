import { and, eq } from 'drizzle-orm';
import type { Database } from '../../db/client.ts';
import { appUser } from '../../db/schema/index.ts';
import { sessionUserColumns, type SessionUser } from './sessionUser.ts';

// The Google subject (`sub`) is the only thing stored about the person (decisions log §5).
// DO NOTHING rather than DO UPDATE: an update would fire the updated_at trigger on every
// sign-in. An anonymised account has no subject left, so signing in again creates a new user.
export const findOrCreateGoogleUser = async (db: Database, subject: string): Promise<SessionUser> => {
  const [created] = await db
    .insert(appUser)
    .values({ authProvider: 'GOOGLE', externalSubject: subject })
    .onConflictDoNothing({ target: [appUser.authProvider, appUser.externalSubject] })
    .returning(sessionUserColumns);
  if (created) {
    return created;
  }

  const [existing] = await db
    .select(sessionUserColumns)
    .from(appUser)
    .where(and(eq(appUser.authProvider, 'GOOGLE'), eq(appUser.externalSubject, subject)));
  if (!existing) {
    throw new Error('Google user neither inserted nor found.');
  }
  return existing;
};

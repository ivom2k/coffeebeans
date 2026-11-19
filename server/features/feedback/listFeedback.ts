import { desc, eq, sql } from 'drizzle-orm';
import type { FeedbackItem, FeedbackStatus } from '../../../shared/types/feedback.ts';
import type { Database } from '../../db/client.ts';
import { feedback } from '../../db/schema/index.ts';

// At 300 messages a day at most, the newest hundred is more than one sitting's reading.
export const maxListedFeedback = 100;

// The admin inbox, newest first. The query selects neither the address hash nor the account,
// only whether there was one, so no caller can pass them on.
export const listFeedback = async (db: Database, status: FeedbackStatus): Promise<FeedbackItem[]> => {
  const rows = await db
    .select({
      id: feedback.id,
      message: feedback.message,
      pagePath: feedback.pagePath,
      signedIn: sql<boolean>`${feedback.userId} IS NOT NULL`,
      status: feedback.status,
      createdAt: feedback.createdAt,
    })
    .from(feedback)
    .where(eq(feedback.status, status))
    .orderBy(desc(feedback.createdAt), desc(feedback.id))
    .limit(maxListedFeedback);
  return rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString() }));
};

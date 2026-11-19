import { eq } from 'drizzle-orm';
import type { FeedbackStatus } from '../../../shared/types/feedback.ts';
import type { Database } from '../../db/client.ts';
import { feedback } from '../../db/schema/index.ts';

export type SetFeedbackStatusResult = { kind: 'updated' } | { kind: 'notFound' };

export const setFeedbackStatus = async (db: Database, id: number, status: FeedbackStatus): Promise<SetFeedbackStatusResult> => {
  const updated = await db.update(feedback).set({ status }).where(eq(feedback.id, id)).returning({ id: feedback.id });
  return updated.length > 0 ? { kind: 'updated' } : { kind: 'notFound' };
};

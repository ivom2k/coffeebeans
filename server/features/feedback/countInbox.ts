import { eq } from 'drizzle-orm';
import type { InboxCounts } from '../../../shared/types/feedback.ts';
import type { Database } from '../../db/client.ts';
import { feedback, suggestion } from '../../db/schema/index.ts';

// What waits for the admin, for the badges in the admin menu. Both counts read a partial index
// (feedback_new_idx, suggestion_pending_idx). The suggestion queue's badge comes with its page.
export const countInbox = async (db: Database): Promise<InboxCounts> => ({
  newFeedback: await db.$count(feedback, eq(feedback.status, 'NEW')),
  pendingSuggestions: await db.$count(suggestion, eq(suggestion.status, 'PENDING')),
});

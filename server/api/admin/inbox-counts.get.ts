import type { InboxCounts } from '../../../shared/types/feedback.ts';
import { countInbox } from '../../features/feedback/countInbox.ts';

export default defineEventHandler(async (event): Promise<InboxCounts> => {
  requireAdmin(event);
  return countInbox(useDb());
});

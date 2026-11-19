import { and, eq, gt, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../db/client.ts';
import { feedback } from '../../db/schema/index.ts';

// Who sent it: a signed-in user is counted by their account and stored with it; a visitor is
// counted by the HMAC of their address, and only that is stored (decisions log §5).
export type FeedbackSender = { kind: 'user'; userId: number } | { kind: 'visitor'; ipHmac: string };

export type FeedbackLimits = { perSenderPerDay: number; sitePerDay: number };

export type SendFeedbackResult = { kind: 'sent' } | { kind: 'senderLimit' } | { kind: 'siteLimit' };

type Feedback = { message: string; pagePath: string | null; sender: FeedbackSender };

const fromSender = (sender: FeedbackSender): SQL | undefined =>
  (sender.kind === 'user' ? eq(feedback.userId, sender.userId) : eq(feedback.ipHmac, sender.ipHmac));

export const sendFeedback = async (
  db: Database,
  { message, pagePath, sender }: Feedback,
  limits: FeedbackLimits,
): Promise<SendFeedbackResult> =>
  // Inside a caller's transaction this runs as a savepoint.
  db.transaction(async (tx): Promise<SendFeedbackResult> => {
    // One lock for every send, held until commit, so two sends at once can't both count one
    // below a cap and both insert: the second waits and counts the first's row. A visitor has
    // no row of their own to lock, as a user's machine count does.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('feedback'))`);

    const lastDay = gt(feedback.createdAt, sql`now() - interval '24 hours'`);
    if (await tx.$count(feedback, lastDay) >= limits.sitePerDay) {
      return { kind: 'siteLimit' };
    }
    if (await tx.$count(feedback, and(lastDay, fromSender(sender))) >= limits.perSenderPerDay) {
      return { kind: 'senderLimit' };
    }

    await tx.insert(feedback).values({
      message,
      pagePath,
      userId: sender.kind === 'user' ? sender.userId : null,
      ipHmac: sender.kind === 'visitor' ? sender.ipHmac : null,
    });
    return { kind: 'sent' };
  });

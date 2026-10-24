import { and, eq } from 'drizzle-orm';
import type { Database } from '../../db/client.ts';
import { userMachine } from '../../db/schema/index.ts';

// Ratings keep their machine: they reference the catalogue model, not this entry.
export const removeMyMachine = async (
  db: Database,
  userId: number,
  machineId: number,
): Promise<{ kind: 'removed' } | { kind: 'notFound' }> => {
  // Matching on user_id too: another user's machine id finds nothing, as if it didn't exist.
  const removed = await db
    .delete(userMachine)
    .where(and(eq(userMachine.id, machineId), eq(userMachine.userId, userId)))
    .returning({ id: userMachine.id });
  return removed.length > 0 ? { kind: 'removed' } : { kind: 'notFound' };
};

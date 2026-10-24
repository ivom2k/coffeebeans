import { and, eq } from 'drizzle-orm';
import type { Database } from '../../db/client.ts';
import { userMachine } from '../../db/schema/index.ts';

// Only the nickname changes. A different machine is a new entry, since ratings already
// point at the model rather than at this row.
export const updateMyMachine = async (
  db: Database,
  userId: number,
  machineId: number,
  nickname: string | null,
): Promise<{ kind: 'updated' } | { kind: 'notFound' }> => {
  // Matching on user_id too: another user's machine id finds nothing, as if it didn't exist.
  const updated = await db
    .update(userMachine)
    .set({ nickname })
    .where(and(eq(userMachine.id, machineId), eq(userMachine.userId, userId)))
    .returning({ id: userMachine.id });
  return updated.length > 0 ? { kind: 'updated' } : { kind: 'notFound' };
};

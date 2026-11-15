import { eq } from 'drizzle-orm';
import type { MyMachine, MyMachineInput } from '../../../shared/types/machine.ts';
import { canAddMachine } from '../../../shared/utils/machine.ts';
import type { Database } from '../../db/client.ts';
import { appUser, userMachine } from '../../db/schema/index.ts';
import { findMachineModel } from './machineModelRef.ts';

export type AddMyMachineResult
  = | { kind: 'added'; machine: MyMachine }
    | { kind: 'unknownModel' }
    | { kind: 'limitReached' };

export const addMyMachine = async (db: Database, userId: number, input: MyMachineInput): Promise<AddMyMachineResult> => {
  const model = await findMachineModel(db, input.machineModelId);
  if (!model) {
    return { kind: 'unknownModel' };
  }

  // Inside a caller's transaction this runs as a savepoint.
  return db.transaction(async (tx): Promise<AddMyMachineResult> => {
    // The user's row is locked while their machines are counted, so two requests at once can't
    // both count one below the limit and both add: the second waits and counts the first's row.
    await tx.select({ id: appUser.id }).from(appUser).where(eq(appUser.id, userId)).for('update');
    if (!canAddMachine(await tx.$count(userMachine, eq(userMachine.userId, userId)))) {
      return { kind: 'limitReached' };
    }

    const [added] = await tx
      .insert(userMachine)
      .values({ userId, machineModelId: model.modelId, nickname: input.nickname })
      .returning({ id: userMachine.id, nickname: userMachine.nickname });
    if (!added) {
      throw new Error('Machine insert returned no row.');
    }
    return { kind: 'added', machine: { ...model, ...added } };
  });
};

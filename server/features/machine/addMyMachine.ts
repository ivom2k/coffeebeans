import type { MyMachine, MyMachineInput } from '../../../shared/types/machine.ts';
import type { Database } from '../../db/client.ts';
import { userMachine } from '../../db/schema/index.ts';
import { findMachineModel } from './machineModelRef.ts';

export type AddMyMachineResult = { kind: 'added'; machine: MyMachine } | { kind: 'unknownModel' };

export const addMyMachine = async (db: Database, userId: number, input: MyMachineInput): Promise<AddMyMachineResult> => {
  const model = await findMachineModel(db, input.machineModelId);
  if (!model) {
    return { kind: 'unknownModel' };
  }

  const [added] = await db
    .insert(userMachine)
    .values({ userId, machineModelId: model.modelId, nickname: input.nickname })
    .returning({ id: userMachine.id, nickname: userMachine.nickname });
  if (!added) {
    throw new Error('Machine insert returned no row.');
  }
  return { kind: 'added', machine: { ...model, ...added } };
};

import { asc, eq } from 'drizzle-orm';
import type { MyMachine } from '../../../shared/types/machine.ts';
import type { Database } from '../../db/client.ts';
import { machineManufacturer, machineModel, userMachine } from '../../db/schema/index.ts';
import { machineModelRefColumns } from './machineModelRef.ts';

// In the order they were added, so a user's first machine stays first.
export const listMyMachines = (db: Database, userId: number): Promise<MyMachine[]> =>
  db
    .select({ id: userMachine.id, nickname: userMachine.nickname, ...machineModelRefColumns })
    .from(userMachine)
    .innerJoin(machineModel, eq(machineModel.id, userMachine.machineModelId))
    .innerJoin(machineManufacturer, eq(machineManufacturer.id, machineModel.manufacturerId))
    .where(eq(userMachine.userId, userId))
    .orderBy(asc(userMachine.id));

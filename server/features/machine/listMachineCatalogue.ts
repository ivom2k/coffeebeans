import { eq } from 'drizzle-orm';
import type { MachineModelRef } from '../../../shared/types/machine.ts';
import type { Database } from '../../db/client.ts';
import { machineManufacturer, machineModel } from '../../db/schema/index.ts';
import { byManufacturerAndModel, machineModelRefColumns } from './machineModelRef.ts';

// Every approved model, for the add-machine picker. Only the profile shows the whole
// catalogue; the rating form offers just the user's own machines (decisions log §3).
export const listMachineCatalogue = async (db: Database): Promise<MachineModelRef[]> => {
  const models = await db
    .select(machineModelRefColumns)
    .from(machineModel)
    .innerJoin(machineManufacturer, eq(machineManufacturer.id, machineModel.manufacturerId));
  return models.toSorted(byManufacturerAndModel);
};

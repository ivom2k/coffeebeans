import { eq } from 'drizzle-orm';
import type { MachineModelRef } from '../../../shared/types/machine.ts';
import type { Database } from '../../db/client.ts';
import { machineManufacturer, machineModel } from '../../db/schema/index.ts';

// The columns behind MachineModelRef. A query that selects them joins machine_manufacturer.
export const machineModelRefColumns = {
  modelId: machineModel.id,
  manufacturerName: machineManufacturer.name,
  modelName: machineModel.name,
  kind: machineModel.kind,
};

export const findMachineModel = async (db: Database, modelId: number): Promise<MachineModelRef | null> => {
  const [model] = await db
    .select(machineModelRefColumns)
    .from(machineModel)
    .innerJoin(machineManufacturer, eq(machineManufacturer.id, machineModel.manufacturerId))
    .where(eq(machineModel.id, modelId));
  return model ?? null;
};

// Estonian alphabetical order, with numbers compared by value so "VM 300" precedes "VM 1000".
const collator = new Intl.Collator('et', { numeric: true });

export const byManufacturerAndModel = (a: MachineModelRef, b: MachineModelRef): number =>
  collator.compare(a.manufacturerName, b.manufacturerName) || collator.compare(a.modelName, b.modelName);

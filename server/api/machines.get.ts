import type { MachineModelRef } from '../../shared/types/machine.ts';
import { listMachineCatalogue } from '../features/machine/listMachineCatalogue.ts';

// The approved catalogue, the same for every visitor. Not cached: only the add-machine
// picker asks for it.
export default defineEventHandler((): Promise<MachineModelRef[]> => listMachineCatalogue(useDb()));

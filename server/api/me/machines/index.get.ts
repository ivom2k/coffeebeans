import type { MyMachine } from '../../../../shared/types/machine.ts';
import { listMyMachines } from '../../../features/machine/listMyMachines.ts';

export default defineEventHandler((event): Promise<MyMachine[]> => {
  const user = requireUser(event);
  return listMyMachines(useDb(), user.id);
});

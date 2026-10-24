import type { MyMachine } from '../../../../shared/types/machine.ts';
import { addMyMachine } from '../../../features/machine/addMyMachine.ts';
import { addMachineSchema } from '../../../features/machine/machineInput.ts';

export default defineEventHandler(async (event): Promise<MyMachine> => {
  const user = requireUser(event);
  const input = await readValidatedBody(event, addMachineSchema.parse);
  const result = await addMyMachine(useDb(), user.id, input);
  if (result.kind === 'unknownModel') {
    throw createError({ statusCode: 422, statusMessage: 'Unknown machine model' });
  }
  setResponseStatus(event, 201);
  return result.machine;
});

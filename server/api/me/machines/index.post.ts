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
  // 409 rather than 422: the request is valid, the account is full. Trying again can't succeed
  // until a machine is removed, which is what the drawer tells the user.
  if (result.kind === 'limitReached') {
    throw createError({ statusCode: 409, statusMessage: 'Machine limit reached' });
  }
  setResponseStatus(event, 201);
  return result.machine;
});

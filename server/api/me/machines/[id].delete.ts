import { machineIdSchema } from '../../../features/machine/machineInput.ts';
import { removeMyMachine } from '../../../features/machine/removeMyMachine.ts';

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const { id } = await getValidatedRouterParams(event, machineIdSchema.parse);
  const result = await removeMyMachine(useDb(), user.id, id);
  if (result.kind === 'notFound') {
    throw createError({ statusCode: 404, statusMessage: 'Machine not found' });
  }
  return null;
});

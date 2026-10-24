import { machineIdSchema, updateMachineSchema } from '../../../features/machine/machineInput.ts';
import { updateMyMachine } from '../../../features/machine/updateMyMachine.ts';

// Answers with the nickname as stored (trimmed, blank as null), so the browser needn't repeat
// the rule.
export default defineEventHandler(async (event): Promise<{ nickname: string | null }> => {
  const user = requireUser(event);
  const { id } = await getValidatedRouterParams(event, machineIdSchema.parse);
  const { nickname } = await readValidatedBody(event, updateMachineSchema.parse);
  const result = await updateMyMachine(useDb(), user.id, id, nickname);
  if (result.kind === 'notFound') {
    throw createError({ statusCode: 404, statusMessage: 'Machine not found' });
  }
  return { nickname };
});

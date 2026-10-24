import { z } from 'zod';
import type { MyMachineInput } from '../../../shared/types/machine.ts';

// 'Kodu', 'Töö'. Blank means no nickname, stored as NULL rather than an empty string.
export const nicknameSchema = z.string().trim().max(50).nullish().transform(nickname => nickname || null);

export const addMachineSchema = z.object({
  machineModelId: z.number().int().positive(),
  nickname: nicknameSchema,
}) satisfies z.ZodType<MyMachineInput>;

export const updateMachineSchema = z.object({ nickname: nicknameSchema });

export const machineIdSchema = z.object({ id: z.coerce.number().int().positive() });

import { z } from 'zod';
import { beanSurfaceCodes, machineIssueCodes, type RatingInput } from '../../../shared/types/rating.ts';

const oneToFive = z.number().int().min(1).max(5);
const sliderAnswer = oneToFive.nullable();

export const ratingInputSchema = z.object({
  score: oneToFive,
  perception: z.object({
    bitterness: sliderAnswer,
    roastCharacter: sliderAnswer,
    crema: sliderAnswer,
    strength: sliderAnswer,
  }),
  beanSurface: z.enum(beanSurfaceCodes).nullable(),
  machineModelId: z.number().int().positive().nullable(),
  // Each code at most once: the issue rows' primary key is (rating, code).
  machineIssues: z.array(z.enum(machineIssueCodes))
    .refine(codes => new Set(codes).size === codes.length, 'Each issue code at most once')
    .nullable(),
  // Blank means no note, stored as NULL rather than an empty string.
  privateNote: z.string().trim().max(500).nullable().transform(note => note || null),
})
  // The issue question follows the machine's kind, and the summaries leave out answers given
  // without a machine (groupMachineIssues), so an answer without one is a client error.
  .refine(input => input.machineModelId !== null || input.machineIssues === null, {
    message: 'Machine issues need a machine',
    path: ['machineIssues'],
  }) satisfies z.ZodType<RatingInput>;

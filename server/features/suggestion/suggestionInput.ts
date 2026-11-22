import { z } from 'zod';
import type {
  CoffeeSuggestionDetails, MachineSuggestionDetails, SuggestionInput, SuggestionType,
} from '../../../shared/types/suggestion.ts';
import { toHttpUrl } from '../../../shared/utils/httpUrl.ts';
import { suggestionFieldLengths } from '../../../shared/utils/suggestion.ts';
import { machineKinds } from '../../db/schema/index.ts';
import { textSchema } from '../security/textInput.ts';

// The form's `details` part (decisions log §6). Strict on both branches, so a key nobody expects
// is a 400 and nothing unvalidated reaches the jsonb column.

// A blank field is no answer rather than an empty string.
const optionalLine = (max: number) => textSchema({ max }).nullish().transform(value => value || null);

// Only an http: or https: link without credentials (shared/utils/httpUrl.ts); anything else is a
// 400 rather than dropped, so the user learns the link wasn't taken.
const optionalLink = optionalLine(suggestionFieldLengths.url).transform((value, ctx) => {
  if (value === null) {
    return null;
  }
  const url = toHttpUrl(value);
  if (url === null) {
    ctx.addIssue({ code: 'custom', message: 'Not an http or https link' });
    return z.NEVER;
  }
  return url;
});

const coffeeSchema = z.strictObject({
  suggestionType: z.literal('COFFEE_BEAN'),
  name: optionalLine(suggestionFieldLengths.name),
  url: optionalLink,
});

const machineSchema = z.strictObject({
  suggestionType: z.literal('MACHINE_MODEL'),
  manufacturer: textSchema({ min: 1, max: suggestionFieldLengths.manufacturer }),
  model: textSchema({ min: 1, max: suggestionFieldLengths.model }),
  kind: z.enum(machineKinds).nullish().transform(value => value ?? null),
});

export const suggestionInputSchema = z.discriminatedUnion(
  'suggestionType',
  [coffeeSchema, machineSchema],
) satisfies z.ZodType<SuggestionInput>;

// What goes into the jsonb column: the details without the type, which has a column of its own.
export const toStoredDetails = (input: SuggestionInput): CoffeeSuggestionDetails | MachineSuggestionDetails =>
  input.suggestionType === 'COFFEE_BEAN'
    ? { name: input.name, url: input.url }
    : { manufacturer: input.manufacturer, model: input.model, kind: input.kind };

const storedString = z.string().catch('');
const storedOptional = z.string().nullable().catch(null);

// Reads a stored row back for the author's list. Lenient, so one row edited by hand in DBeaver
// shows with blanks instead of failing the whole list.
export const readStoredCoffeeDetails = (value: unknown): CoffeeSuggestionDetails => {
  const parsed = z.object({ name: storedOptional, url: storedOptional }).catch({ name: null, url: null }).parse(value);
  return { name: parsed.name, url: toHttpUrl(parsed.url) };
};

export const readStoredMachineDetails = (value: unknown): MachineSuggestionDetails =>
  z.object({
    manufacturer: storedString,
    model: storedString,
    kind: z.enum(machineKinds).nullable().catch(null),
  }).catch({ manufacturer: '', model: '', kind: null }).parse(value);

// Whether a type takes a photo at all: only a coffee's price tag does.
export const takesPhoto = (type: SuggestionType): boolean => type === 'COFFEE_BEAN';

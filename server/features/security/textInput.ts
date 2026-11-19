import { z } from 'zod';
import { cleanText } from '../../../shared/utils/text.ts';

type TextRules = { min?: number; max: number; multiline?: boolean };

// Every text field the API takes goes through this rather than z.string(), so a control
// character is a 400 here instead of a 500 from Postgres (shared/utils/text.ts). The lengths are
// checked on the cleaned text, as it will be stored.
export const textSchema = ({ min = 0, max, multiline = false }: TextRules) => z.string()
  .transform((value, ctx) => {
    const cleaned = cleanText(value, { multiline });
    if (!cleaned.ok) {
      ctx.addIssue({ code: 'custom', message: 'Control characters are not allowed' });
      return z.NEVER;
    }
    return cleaned.text;
  })
  .pipe(z.string().min(min).max(max));

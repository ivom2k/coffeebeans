// Free text as it is stored: trimmed, line endings in one form, and no control characters.
// Postgres refuses a NUL in text outright, so without this one stray byte is a 500. The other
// control characters have no place in a name or a message either, and can hide or reorder what
// the admin reads. Applied to every text field the API takes (CLAUDE.md § Access).

export type TextOptions = { multiline: boolean };
export type CleanedText = { ok: true; text: string } | { ok: false };

const tab = 0x09;
const lineFeed = 0x0a;

// Unicode's Cc category: C0, DEL and C1.
const isControl = (code: number) => code <= 0x1f || (code >= 0x7f && code <= 0x9f);

const isAllowed = (character: string, { multiline }: TextOptions) => {
  const code = character.codePointAt(0) ?? 0;
  return !isControl(code) || (multiline && (code === tab || code === lineFeed));
};

export const cleanText = (value: string, options: TextOptions): CleanedText => {
  // Windows and old Mac line endings become \n, so a length check counts one character per break.
  const text = (options.multiline ? value.replace(/\r\n?/g, '\n') : value).trim();
  return [...text].every(character => isAllowed(character, options)) ? { ok: true, text } : { ok: false };
};

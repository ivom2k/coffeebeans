// The parts of the suggestion form, taken apart before anything in them is trusted: `details`,
// the fields as JSON, and an optional `photo`. Nothing else, and each at most once, so a request
// can't smuggle a second file past the checks or make the server hold parts it never reads.

// The longest field values in shared/utils/suggestion.ts fit several times over.
export const maxDetailsBytes = 4 * 1024;

export type SuggestionParts = { details: unknown; photo: File | null };

export type SuggestionPartsResult
  = | { ok: true; parts: SuggestionParts }
    | { ok: false; status: 400 | 413; reason: string };

const refuse = (status: 400 | 413, reason: string): SuggestionPartsResult => ({ ok: false, status, reason });

const parseJson = (text: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
};

export const readSuggestionParts = (form: FormData, maxPhotoBytes: number): SuggestionPartsResult => {
  const entries = [...form.entries()];
  if (entries.some(([name]) => name !== 'details' && name !== 'photo')) {
    return refuse(400, 'unexpectedPart');
  }
  const details = entries.filter(([name]) => name === 'details').map(([, value]) => value);
  const photos = entries.filter(([name]) => name === 'photo').map(([, value]) => value);
  if (details.length !== 1 || photos.length > 1) {
    return refuse(400, 'partCount');
  }

  // A part sent with a file name arrives as a File: the details are text, never a file.
  const [text] = details;
  if (typeof text !== 'string') {
    return refuse(400, 'detailsNotText');
  }
  if (new TextEncoder().encode(text).length > maxDetailsBytes) {
    return refuse(400, 'detailsTooLong');
  }
  const json = parseJson(text);
  if (!json.ok) {
    return refuse(400, 'detailsNotJson');
  }

  const [photo] = photos;
  if (photo === undefined) {
    return { ok: true, parts: { details: json.value, photo: null } };
  }
  if (typeof photo === 'string') {
    return refuse(400, 'photoNotFile');
  }
  if (photo.size === 0) {
    return refuse(400, 'photoEmpty');
  }
  if (photo.size > maxPhotoBytes) {
    return refuse(413, 'photoTooLarge');
  }
  return { ok: true, parts: { details: json.value, photo } };
};

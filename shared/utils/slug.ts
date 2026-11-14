// The pattern the slug CHECK constraints enforce (server/db/schema/common.ts), so the form and the
// API refuse a bad slug before the database would.
export const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Letters Unicode doesn't split into a base letter and an accent, so NFKD alone would drop them.
const unsplitLetters: Readonly<Record<string, string>> = {
  ß: 'ss', æ: 'ae', ø: 'o', œ: 'oe', ł: 'l', đ: 'd', ð: 'd', þ: 'th',
};

// A URL slug as the slug CHECK allows it: lowercase letters and digits in runs joined by single
// hyphens. Accents are folded rather than dropped, so "Öine Espresso" becomes "oine-espresso".
export const toSlug = (...parts: readonly string[]): string =>
  parts.join(' ')
    .toLowerCase()
    .replace(/[ßæøœłđðþ]/g, letter => unsplitLetters[letter] ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// A new coffee's slug follows its brand and name until the admin types one by hand, and follows
// again once that field is emptied. An existing coffee starts as edited by hand: changing a
// published slug adds a redirect, so it never changes by itself.
export const suggestedSlug = (
  { brandSlug, name, current, editedByHand }: { brandSlug: string | null; name: string; current: string; editedByHand: boolean },
): string => (editedByHand && current !== '' ? current : toSlug(brandSlug ?? '', name));

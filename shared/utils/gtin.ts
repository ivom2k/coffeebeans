// EAN-8, UPC-A, EAN-13 and GTIN-14.
const gs1Lengths = new Set([8, 12, 13, 14]);

export type GtinError = 'NOT_DIGITS' | 'BAD_LENGTH' | 'BAD_CHECK_DIGIT';
export type GtinResult = { ok: true; gtin: string } | { ok: false; error: GtinError };

// GS1 mod-10 over the first 13 digits of the padded code, weighted 3, 1, 3, ... from the
// left. Padding zeros add nothing, so one rule covers every length.
const checkDigit = (first13: string): number => {
  const sum = [...first13].reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10;
};

// The stored form: left-padded to 14 digits, so an EAN-13 and its UPC-A form are one code.
// Spaces are dropped because price tags print the code in groups.
export const toGtin14 = (input: string): GtinResult => {
  const digits = input.replace(/\s/g, '');
  if (!/^\d+$/.test(digits)) {
    return { ok: false, error: 'NOT_DIGITS' };
  }
  if (!gs1Lengths.has(digits.length)) {
    return { ok: false, error: 'BAD_LENGTH' };
  }
  const gtin = digits.padStart(14, '0');
  return checkDigit(gtin.slice(0, 13)) === Number(gtin.at(13))
    ? { ok: true, gtin }
    : { ok: false, error: 'BAD_CHECK_DIGIT' };
};

// The code as printed on the bag. A UPC-A shows as its EAN-13 form (one leading zero),
// which is what a scanner reads too.
export const toPrintedGtin = (gtin14: string): string => {
  if (gtin14.startsWith('000000')) {
    return gtin14.slice(6);
  }
  return gtin14.startsWith('0') ? gtin14.slice(1) : gtin14;
};

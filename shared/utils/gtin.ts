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

// What a package row in the coffee form shows while the code is typed. Blank is allowed: a bag
// can be entered before its barcode is known.
export type GtinStatus = 'EMPTY' | 'OK' | GtinError;

export const gtinStatus = (input: string): GtinStatus => {
  if (input.trim() === '') {
    return 'EMPTY';
  }
  const result = toGtin14(input);
  return result.ok ? 'OK' : result.error;
};

// The coffee form's package rows: each code's own check, and DUPLICATE when another row has the
// same code, compared in the stored form, so "2001234500012" and "02001234500012" are one code.
// One code never names two packages: GS1 gives a new GTIN when the net content changes, and the
// column is unique (the server refuses the same, coffeeInputSchema).
export type PackageGtinStatus = GtinStatus | 'DUPLICATE';

export const packageGtinStatuses = (inputs: readonly string[]): PackageGtinStatus[] => {
  const stored = inputs.map((input) => {
    const result = toGtin14(input);
    return result.ok ? result.gtin : null;
  });
  return inputs.map((input, index) => {
    const status = gtinStatus(input);
    return status === 'OK' && stored.filter(code => code === stored[index]).length > 1 ? 'DUPLICATE' : status;
  });
};

// The code as printed on the bag. A UPC-A shows as its EAN-13 form (one leading zero),
// which is what a scanner reads too.
export const toPrintedGtin = (gtin14: string): string => {
  if (gtin14.startsWith('000000')) {
    return gtin14.slice(6);
  }
  return gtin14.startsWith('0') ? gtin14.slice(1) : gtin14;
};

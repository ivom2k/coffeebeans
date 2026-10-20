import { describe, expect, it } from 'vitest';
import { toGtin14, toPrintedGtin } from './gtin';

// Codes from GS1's 200-299 in-store range, as in the seed, so no real product's code is used.
describe('toGtin14', () => {
  it('Should_PadToFourteenDigits_When_InputIsEan13', () => {
    // Arrange
    const ean13 = '2001234500012';

    // Act
    const result = toGtin14(ean13);

    // Assert
    expect(result).toEqual({ ok: true, gtin: '02001234500012' });
  });

  it('Should_PadToFourteenDigits_When_InputIsEan8', () => {
    // Arrange
    const ean8 = '20000004';

    // Act
    const result = toGtin14(ean8);

    // Assert
    expect(result).toEqual({ ok: true, gtin: '00000020000004' });
  });

  it('Should_PadToFourteenDigits_When_InputIsUpcA', () => {
    // Arrange
    const upcA = '200123450007';

    // Act
    const result = toGtin14(upcA);

    // Assert
    expect(result).toEqual({ ok: true, gtin: '00200123450007' });
  });

  it('Should_KeepTheCode_When_InputIsAlreadyGtin14', () => {
    // Arrange
    const gtin14 = '02001234500012';

    // Act
    const result = toGtin14(gtin14);

    // Assert
    expect(result).toEqual({ ok: true, gtin: '02001234500012' });
  });

  it('Should_IgnoreSpaces_When_CodeIsTypedAsPrinted', () => {
    // Arrange: price tags print EAN-13 in groups.
    const grouped = '2 001234 500012';

    // Act
    const result = toGtin14(grouped);

    // Assert
    expect(result).toEqual({ ok: true, gtin: '02001234500012' });
  });

  it('Should_RejectTheCode_When_CheckDigitIsWrong', () => {
    // Arrange: the last digit of a valid code changed from 2 to 3.
    const typo = '2001234500013';

    // Act
    const result = toGtin14(typo);

    // Assert
    expect(result).toEqual({ ok: false, error: 'BAD_CHECK_DIGIT' });
  });

  it.each(['200123', '2001234500', '200123450001234'])('Should_RejectTheCode_When_LengthIsNotAGs1Length (%s)', (input) => {
    // Act
    const result = toGtin14(input);

    // Assert
    expect(result).toEqual({ ok: false, error: 'BAD_LENGTH' });
  });

  it.each(['', '2001234-500012', 'vallozzi'])('Should_RejectTheInput_When_ItIsNotDigits (%j)', (input) => {
    // Act
    const result = toGtin14(input);

    // Assert
    expect(result).toEqual({ ok: false, error: 'NOT_DIGITS' });
  });
});

describe('toPrintedGtin', () => {
  it.each([
    ['02001234500012', '2001234500012'],
    ['00000020000004', '20000004'],
    ['00200123450007', '0200123450007'],
    ['12001234500019', '12001234500019'],
  ])('Should_DropThePadding_When_ShowingStoredCode (%s)', (stored, printed) => {
    // Act
    const result = toPrintedGtin(stored);

    // Assert
    expect(result).toBe(printed);
  });
});

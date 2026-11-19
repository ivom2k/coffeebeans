import { describe, expect, it } from 'vitest';
import { textSchema } from './textInput.ts';

describe('textSchema', () => {
  it('Should_ReturnTheCleanedText_When_ItIsValid', () => {
    // Arrange
    const schema = textSchema({ min: 1, max: 20, multiline: true });

    // Act
    const result = schema.safeParse('  Tere\r\nkohv  ');

    // Assert
    expect(result).toMatchObject({ success: true, data: 'Tere\nkohv' });
  });

  it('Should_MeasureTheTrimmedText_When_CheckingTheLength', () => {
    // Arrange: five characters once trimmed, and only spaces.
    const schema = textSchema({ min: 1, max: 5 });

    // Act
    const results = [schema.safeParse('  kohvi  ').success, schema.safeParse('   ').success];

    // Assert
    expect(results).toEqual([true, false]);
  });

  it('Should_Fail_When_TheTextHasANul', () => {
    // Arrange
    const schema = textSchema({ max: 100, multiline: true });

    // Act
    const result = schema.safeParse('a\u0000b');

    // Assert
    expect(result.success).toBe(false);
  });
});

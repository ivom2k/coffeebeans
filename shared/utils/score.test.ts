import { describe, expect, it } from 'vitest';
import { formatScore } from './score';

describe('formatScore', () => {
  it('Should_WriteADecimalComma_When_LanguageIsEstonian', () => {
    // Act
    const result = formatScore(4.4, 'et-EE');

    // Assert
    expect(result).toBe('4,4');
  });

  it('Should_KeepOneDecimal_When_MeanIsWhole', () => {
    // Act
    const result = formatScore(5, 'et-EE');

    // Assert: "5,0 (1 hinnang)", as on the canvas.
    expect(result).toBe('5,0');
  });

  it('Should_RoundToOneDecimal_When_MeanHasTwo', () => {
    // Act
    const result = formatScore(4.33, 'et-EE');

    // Assert
    expect(result).toBe('4,3');
  });

  it.each([
    [4.25, '4,3'],
    // 4.35 is stored as 4.34999..., so toFixed(1) would give "4.3".
    [4.35, '4,4'],
  ])('Should_RoundHalfUp_When_SecondDecimalIsFive (%s)', (mean, expected) => {
    // Act
    const result = formatScore(mean, 'et-EE');

    // Assert
    expect(result).toBe(expected);
  });
});

import { describe, expect, it } from 'vitest';
import { formatPackageSize } from './packageSize';

describe('formatPackageSize', () => {
  it.each([
    [1000, '1 kg'],
    [1500, '1,5 kg'],
    [1250, '1,25 kg'],
    [500, '500 g'],
    [250, '250 g'],
  ])('Should_WriteTheBagSizeAsPrinted_When_LanguageIsEstonian (%s g)', (sizeG, expected) => {
    // Act
    const result = formatPackageSize(sizeG, 'et-EE');

    // Assert
    expect(result).toBe(expected);
  });
});

import { describe, expect, it } from 'vitest';
import { countryCodes } from './countries';

describe('countryCodes', () => {
  it('Should_ListEveryAssignedCodeOnce_When_ComparedWithIso3166', () => {
    // Assert: ISO 3166-1 has 249 assigned alpha-2 codes.
    expect(countryCodes).toHaveLength(249);
    expect(new Set(countryCodes).size).toBe(countryCodes.length);
    expect(countryCodes.toSorted()).toEqual(countryCodes);
  });

  it('Should_HaveAnEstonianName_When_ShownInTheForm', () => {
    // Arrange: without the fallback, an unknown code comes back as undefined rather than itself.
    const names = new Intl.DisplayNames(['et-EE'], { type: 'region', fallback: 'none' });

    // Act
    const unnamed = countryCodes.filter(code => names.of(code) === undefined);

    // Assert
    expect(unnamed).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { maxDetailsBytes, readSuggestionParts } from './suggestionParts.ts';

const maxPhotoBytes = 100;
const details = JSON.stringify({ suggestionType: 'COFFEE_BEAN', name: 'Crema', url: null });
const photo = (size = 10) => new File([new Uint8Array(size)], 'silt.jpg', { type: 'image/jpeg' });

const formOf = (...parts: [string, string | File][]) => {
  const form = new FormData();
  for (const [name, value] of parts) {
    form.append(name, value);
  }
  return form;
};

describe('readSuggestionParts', () => {
  it('Should_ReturnTheDetailsAndThePhoto_When_TheFormHoldsBoth', () => {
    // Act
    const result = readSuggestionParts(formOf(['details', details], ['photo', photo()]), maxPhotoBytes);

    // Assert
    expect(result).toMatchObject({ ok: true, parts: { details: { name: 'Crema' } } });
    expect(result.ok && result.parts.photo?.size).toBe(10);
  });

  it('Should_ReturnNoPhoto_When_TheFormHoldsOnlyTheDetails', () => {
    // Act
    const result = readSuggestionParts(formOf(['details', details]), maxPhotoBytes);

    // Assert
    expect(result).toEqual({ ok: true, parts: { details: JSON.parse(details), photo: null } });
  });

  it.each([
    ['an unknown part', formOf(['details', details], ['website', 'x'])],
    ['two photos', formOf(['details', details], ['photo', photo()], ['photo', photo()])],
    ['two details', formOf(['details', details], ['details', details])],
    ['no details', formOf(['photo', photo()])],
    ['details sent as a file', formOf(['details', new File([details], 'details.json')])],
    ['details one byte too long', formOf(['details', `"${'x'.repeat(maxDetailsBytes - 1)}"`])],
    ['broken JSON', formOf(['details', '{"suggestionType":'])],
    ['an empty photo', formOf(['details', details], ['photo', photo(0)])],
    ['a photo sent as text', formOf(['details', details], ['photo', 'not a file'])],
    ['nothing at all', formOf()],
  ])('Should_Answer400_When_TheFormHolds %s', (_case, form) => {
    // Act
    const result = readSuggestionParts(form, maxPhotoBytes);

    // Assert
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it('Should_Answer413_When_ThePhotoIsOverTheLimit', () => {
    // Act
    const atLimit = readSuggestionParts(formOf(['details', details], ['photo', photo(maxPhotoBytes)]), maxPhotoBytes);
    const over = readSuggestionParts(formOf(['details', details], ['photo', photo(maxPhotoBytes + 1)]), maxPhotoBytes);

    // Assert
    expect(atLimit.ok).toBe(true);
    expect(over).toMatchObject({ ok: false, status: 413 });
  });
});

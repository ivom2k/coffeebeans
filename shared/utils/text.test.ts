import { describe, expect, it } from 'vitest';
import { cleanText } from './text.ts';

describe('cleanText', () => {
  it('Should_TrimTheText_When_ItHasSpaceAround', () => {
    // Act
    const result = cleanText('  Kodu  ', { multiline: false });

    // Assert
    expect(result).toEqual({ ok: true, text: 'Kodu' });
  });

  it('Should_KeepLineBreaksAndTabs_When_TheFieldIsMultiline', () => {
    // Arrange
    const value = 'Esimene rida\r\nTeine\trida\rKolmas';

    // Act
    const result = cleanText(value, { multiline: true });

    // Assert: \r\n and a lone \r both become \n.
    expect(result).toEqual({ ok: true, text: 'Esimene rida\nTeine\trida\nKolmas' });
  });

  it.each([
    ['a line break', 'Kodu\nmasin'],
    ['a tab', 'Kodu\tmasin'],
    ['a carriage return', 'Kodu\rmasin'],
  ])('Should_Refuse_When_ASingleLineFieldHas %s', (_, value) => {
    // Act
    const result = cleanText(value, { multiline: false });

    // Assert
    expect(result).toEqual({ ok: false });
  });

  it.each([
    ['a NUL', 'a\u0000b'],
    ['an escape', 'a\u001Bb'],
    ['a DEL', 'a\u007Fb'],
    ['a C1 control', 'a\u0085b'],
    ['a vertical tab', 'a\u000Bb'],
  ])('Should_Refuse_When_TheTextHas %s', (_, value) => {
    // Act
    const results = [cleanText(value, { multiline: true }), cleanText(value, { multiline: false })];

    // Assert
    expect(results).toEqual([{ ok: false }, { ok: false }]);
  });

  it('Should_KeepLettersAndEmoji_When_TheyAreNotControlCharacters', () => {
    // Arrange
    const value = 'Öine röst ☕ — väga hea';

    // Act
    const result = cleanText(value, { multiline: false });

    // Assert
    expect(result).toEqual({ ok: true, text: value });
  });
});

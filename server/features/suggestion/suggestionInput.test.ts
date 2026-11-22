import { describe, expect, it } from 'vitest';
import { suggestionFieldLengths } from '../../../shared/utils/suggestion.ts';
import { readStoredCoffeeDetails, readStoredMachineDetails, suggestionInputSchema } from './suggestionInput.ts';

describe('suggestionInputSchema', () => {
  it('Should_TrimTheNameAndKeepTheLink_When_ACoffeeHasBoth', () => {
    // Act
    const result = suggestionInputSchema.parse({ suggestionType: 'COFFEE_BEAN', name: '  Valtorre Crema ', url: 'https://pood.example/v' });

    // Assert
    expect(result).toEqual({ suggestionType: 'COFFEE_BEAN', name: 'Valtorre Crema', url: 'https://pood.example/v' });
  });

  it('Should_TurnBlanksIntoNull_When_ACoffeeComesWithAPhotoOnly', () => {
    // Act: the photo travels beside the details, so both fields may be empty.
    const results = [
      suggestionInputSchema.parse({ suggestionType: 'COFFEE_BEAN', name: '  ', url: '' }),
      suggestionInputSchema.parse({ suggestionType: 'COFFEE_BEAN' }),
    ];

    // Assert
    expect(results).toEqual([
      { suggestionType: 'COFFEE_BEAN', name: null, url: null },
      { suggestionType: 'COFFEE_BEAN', name: null, url: null },
    ]);
  });

  it('Should_TakeAMachine_When_ItHasAManufacturerAndAModel', () => {
    // Act
    const result = suggestionInputSchema.parse({ suggestionType: 'MACHINE_MODEL', manufacturer: 'Jura', model: 'E8' });

    // Assert
    expect(result).toEqual({ suggestionType: 'MACHINE_MODEL', manufacturer: 'Jura', model: 'E8', kind: null });
  });

  it.each([
    ['javascript', 'javascript:alert(1)'],
    ['a data URL', 'data:text/html,x'],
    ['protocol-relative', '//evil.example'],
    ['credentials', 'http://user:pass@pood.example'],
    ['text that is no link', 'see the blue bag'],
  ])('Should_RefuseTheLink_When_ItIs %s', (_case, url) => {
    // Act
    const result = suggestionInputSchema.safeParse({ suggestionType: 'COFFEE_BEAN', name: 'X', url });

    // Assert
    expect(result.success).toBe(false);
  });

  it.each([
    ['an unknown type', { suggestionType: 'BRAND', name: 'X' }],
    ['no type', { name: 'X' }],
    ['an unknown key', { suggestionType: 'COFFEE_BEAN', name: 'X', price: 9 }],
    ['__proto__', JSON.parse('{"suggestionType":"COFFEE_BEAN","name":"X","__proto__":{"admin":true}}')],
    ['a machine field on a coffee', { suggestionType: 'COFFEE_BEAN', name: 'X', model: 'E8' }],
    ['a machine without its model', { suggestionType: 'MACHINE_MODEL', manufacturer: 'Jura' }],
    ['a machine with a blank model', { suggestionType: 'MACHINE_MODEL', manufacturer: 'Jura', model: '  ' }],
    ['an unknown machine kind', { suggestionType: 'MACHINE_MODEL', manufacturer: 'Jura', model: 'E8', kind: 'MOKA' }],
    ['a name too long', { suggestionType: 'COFFEE_BEAN', name: 'x'.repeat(suggestionFieldLengths.name + 1) }],
    ['a NUL in the name', { suggestionType: 'COFFEE_BEAN', name: 'Crema\u0000' }],
    ['a line break in the name', { suggestionType: 'COFFEE_BEAN', name: 'Crema\nScura' }],
    ['not an object', 'COFFEE_BEAN'],
  ])('Should_RefuseTheDetails_When_TheyHold %s', (_case, details) => {
    // Act
    const result = suggestionInputSchema.safeParse(details);

    // Assert
    expect(result.success).toBe(false);
  });
});

describe('reading stored details', () => {
  it('Should_ShowBlanks_When_AStoredRowWasEditedIntoAnotherShape', () => {
    // Act
    const coffee = readStoredCoffeeDetails({ name: 5, url: 'javascript:alert(1)' });
    const machine = readStoredMachineDetails('not an object');

    // Assert: a link the API would never take doesn't come back out either.
    expect(coffee).toEqual({ name: null, url: null });
    expect(machine).toEqual({ manufacturer: '', model: '', kind: null });
  });
});

import { describe, expect, it } from 'vitest';
import { brandInputSchema, coffeeInputSchema } from './catalogueInput.ts';

const validCoffee = {
  brandId: 1,
  name: 'Crema Dolce',
  slug: 'vallozzi-crema-dolce',
  status: 'DRAFT',
  roastLevel: 3,
  packages: [{ sizeG: 1000, gtin: '2001234500012' }],
  species: [{ code: 'ARABICA', percentage: 70 }, { code: 'ROBUSTA', percentage: 30 }],
  origins: ['BR', 'VN'],
  descriptions: { et: 'Pehme segu.' },
};

describe('coffeeInputSchema', () => {
  it('Should_StoreTheGtinAsFourteenDigits_When_TypedInAPrintedForm', () => {
    // Act
    const input = coffeeInputSchema.parse({
      ...validCoffee,
      packages: [{ sizeG: 1000, gtin: '2 001234 500012' }, { sizeG: 500, gtin: '200123450007' }],
    });

    // Assert
    expect(input.packages).toEqual([{ sizeG: 1000, gtin: '02001234500012' }, { sizeG: 500, gtin: '00200123450007' }]);
  });

  it.each([null, '', '   '])('Should_StoreNoGtin_When_TheBarcodeIsNotKnown (%j)', (gtin) => {
    // Act
    const input = coffeeInputSchema.parse({ ...validCoffee, packages: [{ sizeG: 250, gtin }] });

    // Assert
    expect(input.packages).toEqual([{ sizeG: 250, gtin: null }]);
  });

  it('Should_RejectTheCoffee_When_AGtinCheckDigitIsWrong', () => {
    // Act
    const result = coffeeInputSchema.safeParse({ ...validCoffee, packages: [{ sizeG: 1000, gtin: '2001234500013' }] });

    // Assert
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path: ['packages', 0, 'gtin'], message: 'BAD_CHECK_DIGIT' });
  });

  it('Should_RejectTheCoffee_When_TwoPackagesShareAGtin', () => {
    // Arrange: the same code, once as EAN-13 and once padded.
    const packages = [{ sizeG: 1000, gtin: '2001234500012' }, { sizeG: 500, gtin: '02001234500012' }];

    // Act
    const result = coffeeInputSchema.safeParse({ ...validCoffee, packages });

    // Assert
    expect(result.success).toBe(false);
  });

  it.each([
    ['a species twice', [{ code: 'ARABICA', percentage: 50 }, { code: 'ARABICA', percentage: 50 }]],
    ['percentages over 100', [{ code: 'ARABICA', percentage: 80 }, { code: 'ROBUSTA', percentage: 30 }]],
    ['an unknown species', [{ code: 'MOCHA', percentage: null }]],
  ])('Should_RejectTheCoffee_When_SpeciesHave %s', (_case, species) => {
    // Act
    const result = coffeeInputSchema.safeParse({ ...validCoffee, species });

    // Assert
    expect(result.success).toBe(false);
  });

  it('Should_AcceptTheBlend_When_NoSpeciesHasAPercentage', () => {
    // Act
    const result = coffeeInputSchema.safeParse({
      ...validCoffee,
      species: [{ code: 'ARABICA', percentage: null }, { code: 'ROBUSTA', percentage: null }],
    });

    // Assert
    expect(result.success).toBe(true);
  });

  it.each([
    ['an unknown country', ['XX']],
    ['a country twice', ['BR', 'BR']],
  ])('Should_RejectTheCoffee_When_OriginsHave %s', (_case, origins) => {
    // Act
    const result = coffeeInputSchema.safeParse({ ...validCoffee, origins });

    // Assert
    expect(result.success).toBe(false);
  });

  it.each(['Crema Dolce', 'crema_dolce', 'crema--dolce', '-crema', ''])('Should_RejectTheSlug_When_TheCheckWouldRefuseIt (%j)', (slug) => {
    // Act
    const result = coffeeInputSchema.safeParse({ ...validCoffee, slug });

    // Assert
    expect(result.success).toBe(false);
  });

  it('Should_TrimTheTextAndStoreNoDescription_When_ItIsBlank', () => {
    // Act
    const input = coffeeInputSchema.parse({ ...validCoffee, name: '  Crema Dolce ', descriptions: { et: '  ' } });

    // Assert
    expect(input.name).toBe('Crema Dolce');
    expect(input.descriptions).toEqual({ et: null });
  });

  it.each([
    ['the name', { name: 'Crema\u0000Dolce' }],
    ['the description', { descriptions: { et: 'Pehme\u0000segu.' } }],
  ])('Should_RejectTheCoffee_When_ANulIsIn %s', (_, change) => {
    // Act
    const result = coffeeInputSchema.safeParse({ ...validCoffee, ...change });

    // Assert
    expect(result.success).toBe(false);
  });

  it.each([0, 6, 2.5])('Should_RejectTheRoastLevel_When_ItIsOffTheScale (%s)', (roastLevel) => {
    // Act
    const result = coffeeInputSchema.safeParse({ ...validCoffee, roastLevel });

    // Assert
    expect(result.success).toBe(false);
  });
});

describe('brandInputSchema', () => {
  it('Should_AcceptTheBrand_When_ItHasNoCountry', () => {
    // Act
    const input = brandInputSchema.parse({ name: ' Põhjaröst ', slug: 'pohjarost', countryCode: null });

    // Assert
    expect(input).toEqual({ name: 'Põhjaröst', slug: 'pohjarost', countryCode: null });
  });

  it('Should_RejectTheBrand_When_TheCountryIsNotAnIsoCode', () => {
    // Act
    const result = brandInputSchema.safeParse({ name: 'Põhjaröst', slug: 'pohjarost', countryCode: 'ee' });

    // Assert
    expect(result.success).toBe(false);
  });

  it('Should_RejectTheBrand_When_TheNameHasANul', () => {
    // Act
    const result = brandInputSchema.safeParse({ name: 'Põhja\u0000röst', slug: 'pohjarost', countryCode: null });

    // Assert
    expect(result.success).toBe(false);
  });
});

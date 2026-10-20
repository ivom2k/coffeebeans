import { afterAll, describe, expect, it } from 'vitest';
import type { SearchResponse } from '../../../shared/types/search.ts';
import { coffeeBeanPackage } from '../../db/schema/index.ts';
import { closeTestDb, createBrand, createCoffee, withRollback } from '../../db/tests/helpers.ts';
import { searchCatalogue } from './searchCatalogue.ts';

const coffeeSlugs = (result: SearchResponse) =>
  result.kind === 'text' ? result.coffees.map(coffee => coffee.slug).toSorted() : [];

describe('searchCatalogue', () => {
  afterAll(closeTestDb);

  it('Should_FindTheBrandsCoffees_When_QueryMissesALetter', () => withRollback(async (tx) => {
    // Arrange
    const vallozzi = await createBrand(tx, { name: 'Vallozzi' });
    const tormikohv = await createBrand(tx, { name: 'Tormikohv' });
    await createCoffee(tx, { brandId: vallozzi.id, name: 'Crema Dolce', slug: 'vallozzi-crema-dolce' });
    await createCoffee(tx, { brandId: vallozzi.id, name: 'Intenso Scuro', slug: 'vallozzi-intenso-scuro' });
    await createCoffee(tx, { brandId: tormikohv.id, name: 'Tume', slug: 'tormikohv-tume' });

    // Act: "valozzi" is one letter short, as in "lavaza" for Lavazza.
    const result = await searchCatalogue(tx, 'valozzi');

    // Assert
    expect(coffeeSlugs(result)).toEqual(['vallozzi-crema-dolce', 'vallozzi-intenso-scuro']);
    expect(result).toMatchObject({ kind: 'text', brands: [{ name: 'Vallozzi', coffeeCount: 2 }] });
  }));

  it('Should_IgnoreAccents_When_QueryIsTypedWithoutThem', () => withRollback(async (tx) => {
    // Arrange
    const pohjarost = await createBrand(tx, { name: 'Põhjaröst' });
    await createCoffee(tx, { brandId: pohjarost.id, name: 'Öine Espresso', slug: 'pohjarost-oine-espresso' });

    // Act
    const result = await searchCatalogue(tx, 'pohjarost oine');

    // Assert
    expect(coffeeSlugs(result)).toEqual(['pohjarost-oine-espresso']);
  }));

  it('Should_LeaveOutDraftsButKeepArchived_When_Searching', () => withRollback(async (tx) => {
    // Arrange
    const vallozzi = await createBrand(tx, { name: 'Vallozzi' });
    await createCoffee(tx, { brandId: vallozzi.id, name: 'Crema Dolce', slug: 'published' });
    await createCoffee(tx, { brandId: vallozzi.id, name: 'Gran Aroma', slug: 'archived', status: 'ARCHIVED' });
    await createCoffee(tx, { brandId: vallozzi.id, name: 'Nuovo', slug: 'draft', status: 'DRAFT' });

    // Act
    const result = await searchCatalogue(tx, 'vallozzi');

    // Assert: archived coffees keep their pages, so search still finds them.
    expect(coffeeSlugs(result)).toEqual(['archived', 'published']);
    expect(result).toMatchObject({ brands: [{ name: 'Vallozzi', coffeeCount: 2 }] });
  }));

  it('Should_FindTheCoffee_When_QueryIsTheEan13OfItsPackage', () => withRollback(async (tx) => {
    // Arrange
    const coffee = await createCoffee(tx, { slug: 'by-barcode' });
    await tx.insert(coffeeBeanPackage).values({ coffeeBeanId: coffee.id, sizeG: 500, gtin: '02001234500012' });

    // Act
    const result = await searchCatalogue(tx, '2001234500012');

    // Assert
    expect(result).toMatchObject({ kind: 'gtin', coffee: { slug: 'by-barcode', packageSizeG: 500 } });
  }));

  it('Should_FindNothing_When_NoPackageCarriesTheGtin', () => withRollback(async (tx) => {
    // Act
    const result = await searchCatalogue(tx, '2001234500029');

    // Assert
    expect(result).toEqual({ kind: 'gtin', coffee: null });
  }));

  it('Should_ReportAnInvalidGtin_When_CheckDigitIsWrong', () => withRollback(async (tx) => {
    // Act
    const result = await searchCatalogue(tx, '2001234500013');

    // Assert
    expect(result).toEqual({ kind: 'invalidGtin' });
  }));
});

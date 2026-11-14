import { afterAll, describe, expect, it } from 'vitest';
import { closeTestDb, createBrand as insertBrand, withRollback } from '../../db/tests/helpers.ts';
import { createBrand, listBrands } from './brands.ts';

// One pool for the whole file: closed once every describe below has run.
afterAll(closeTestDb);

describe('createBrand', () => {
  it('Should_CreateTheBrand_When_NameAndSlugAreFree', () => withRollback(async (tx) => {
    // Act
    const result = await createBrand(tx, { name: 'Põhjaröst', slug: 'pohjarost', countryCode: 'EE' });

    // Assert
    expect(result).toEqual({
      kind: 'created',
      brand: { id: expect.any(Number), name: 'Põhjaröst', slug: 'pohjarost', countryCode: 'EE' },
    });
  }));

  it('Should_ReportTheName_When_ABrandAlreadyHasIt', () => withRollback(async (tx) => {
    // Arrange
    await insertBrand(tx, { name: 'Põhjaröst' });

    // Act
    const result = await createBrand(tx, { name: 'Põhjaröst', slug: 'pohjarost-2', countryCode: null });

    // Assert
    expect(result).toEqual({ kind: 'nameTaken' });
  }));

  it('Should_ReportTheSlug_When_ABrandAlreadyHasIt', () => withRollback(async (tx) => {
    // Arrange
    await createBrand(tx, { name: 'Põhjaröst', slug: 'pohjarost', countryCode: null });

    // Act
    const result = await createBrand(tx, { name: 'Pohjarost', slug: 'pohjarost', countryCode: null });

    // Assert: and the transaction is still usable afterwards, since the insert ran as a savepoint.
    expect(result).toEqual({ kind: 'slugTaken' });
    expect((await listBrands(tx)).map(brand => brand.name)).toContain('Põhjaröst');
  }));
});

describe('listBrands', () => {
  it('Should_SortInEstonianOrder_When_NamesStartWithAccents', () => withRollback(async (tx) => {
    // Arrange: Estonian puts z after s, and Ö after the plain letters.
    await createBrand(tx, { name: 'Österby', slug: 'osterby', countryCode: null });
    await createBrand(tx, { name: 'Zeta', slug: 'zeta', countryCode: null });
    await createBrand(tx, { name: 'Saare', slug: 'saare', countryCode: null });

    // Act
    const names = (await listBrands(tx)).map(brand => brand.name);

    // Assert
    expect(names).toEqual(['Saare', 'Zeta', 'Österby']);
  }));
});

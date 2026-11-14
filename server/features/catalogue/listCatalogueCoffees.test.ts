import { afterAll, describe, expect, it } from 'vitest';
import { closeTestDb, createBrand, createCoffee, rateCoffee, withRollback } from '../../db/tests/helpers.ts';
import { listCatalogueCoffees } from './listCatalogueCoffees.ts';

describe('listCatalogueCoffees', () => {
  afterAll(closeTestDb);

  it('Should_ListDraftsToo_When_TheAdminOpensTheCatalogue', () => withRollback(async (tx) => {
    // Arrange
    const brand = await createBrand(tx, { name: 'Vallozzi' });
    const draft = await createCoffee(tx, { brandId: brand.id, name: 'Talvesegu', slug: 'talvesegu', status: 'DRAFT' });
    const published = await createCoffee(tx, { brandId: brand.id, name: 'Crema', slug: 'crema' });
    await rateCoffee(tx, published.id, [4, 5]);

    // Act
    const rows = await listCatalogueCoffees(tx);

    // Assert
    expect(rows.toSorted((a, b) => a.id - b.id)).toEqual([
      {
        id: draft.id, slug: 'talvesegu', name: 'Talvesegu', brandName: 'Vallozzi', status: 'DRAFT',
        ratingCount: 0, hasImage: false, updatedAt: expect.any(String),
      },
      {
        id: published.id, slug: 'crema', name: 'Crema', brandName: 'Vallozzi', status: 'PUBLISHED',
        ratingCount: 2, hasImage: false, updatedAt: expect.any(String),
      },
    ]);
  }));
});

import { afterAll, describe, expect, it } from 'vitest';
import { closeTestDb, createBrand, createCoffee, rateCoffee, withRollback } from '../../db/tests/helpers.ts';
import { getBrandPage } from './getBrandPage.ts';
import type { Thresholds } from '../coffee/thresholds.ts';

const rules: Thresholds = { minRatings: 1, minIssueAnswers: 5, issueFlagShare: 0.4 };

describe('getBrandPage', () => {
  afterAll(closeTestDb);

  it('Should_ListRankedUnratedAndArchivedApart_When_BrandHasAllThree', () => withRollback(async (tx) => {
    // Arrange
    const brandRow = await createBrand(tx, { name: 'Vallozzi' });
    const rated = await createCoffee(tx, { brandId: brandRow.id, slug: 'rated' });
    const archived = await createCoffee(tx, { brandId: brandRow.id, slug: 'archived', status: 'ARCHIVED' });
    await createCoffee(tx, { brandId: brandRow.id, slug: 'unrated' });
    await createCoffee(tx, { brandId: brandRow.id, slug: 'draft', status: 'DRAFT' });
    await rateCoffee(tx, rated.id, [4]);
    await rateCoffee(tx, archived.id, [5]);

    // Act
    const page = await getBrandPage(tx, brandRow.slug, rules);

    // Assert
    expect(page).toMatchObject({
      brand: { slug: brandRow.slug, name: 'Vallozzi', countryCode: null },
      ranked: [{ slug: 'rated' }],
      unrated: [{ slug: 'unrated' }],
      archived: [{ slug: 'archived', archived: true }],
    });
  }));

  it('Should_ReturnNull_When_AllTheBrandsCoffeesAreDrafts', () => withRollback(async (tx) => {
    // Arrange
    const brandRow = await createBrand(tx);
    await createCoffee(tx, { brandId: brandRow.id, status: 'DRAFT' });

    // Act
    const page = await getBrandPage(tx, brandRow.slug, rules);

    // Assert
    expect(page).toBeNull();
  }));
});

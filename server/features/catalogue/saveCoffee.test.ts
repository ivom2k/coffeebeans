import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { CoffeeEditorInput } from '../../../shared/types/catalogue.ts';
import type { Database } from '../../db/client.ts';
import { coffeeBean, coffeeBeanSlugRedirect, coffeeBeanTranslation } from '../../db/schema/index.ts';
import { closeTestDb, createBrand, createCoffee as insertCoffee, rateCoffee, withRollback } from '../../db/tests/helpers.ts';
import { getCoffeePage } from '../coffee/getCoffeePage.ts';
import { listRankedCoffees } from '../coffee/listRankedCoffees.ts';
import type { Thresholds } from '../coffee/thresholds.ts';
import { searchCatalogue } from '../search/searchCatalogue.ts';
import { coffeeInputSchema } from './catalogueInput.ts';
import { getCoffeeForEditing } from './getCoffeeForEditing.ts';
import { createCoffee, markCoffeeReviewed, updateCoffee } from './saveCoffee.ts';

const rules: Thresholds = { minRatings: 1, minIssueAnswers: 5, issueFlagShare: 0.4 };
const noFilters = { roastLevels: [], fewIssuesOnly: false };

// Through the API's schema, as a handler would pass it: GTINs typed as printed become 14 digits.
const coffeeInput = (brandId: number, overrides: Partial<CoffeeEditorInput> = {}): CoffeeEditorInput =>
  coffeeInputSchema.parse({
    brandId,
    name: 'Crema Dolce',
    slug: 'vallozzi-crema-dolce',
    status: 'PUBLISHED',
    roastLevel: 3,
    packages: [{ sizeG: 1000, gtin: '2001234500012' }, { sizeG: 500, gtin: null }],
    species: [{ code: 'ARABICA', percentage: 70 }, { code: 'ROBUSTA', percentage: 30 }],
    origins: ['BR', 'VN'],
    descriptions: { et: 'Pehme segu igapäevaseks espressoks.' },
    ...overrides,
  });

const saved = async (result: Promise<{ kind: string; id?: number }>) => {
  const outcome = await result;
  if (outcome.kind !== 'saved' || outcome.id === undefined) {
    throw new Error(`Expected a saved coffee, got ${outcome.kind}.`);
  }
  return outcome.id;
};

const pageOf = (tx: Database, slug: string) => getCoffeePage(tx, slug, 'et', rules);

// One pool for the whole file: closed once every describe below has run.
afterAll(closeTestDb);

describe('createCoffee', () => {
  it('Should_ShowTheCoffeeOnItsPublicPage_When_SavedAsPublished', () => withRollback(async (tx) => {
    // Arrange
    const brand = await createBrand(tx, { name: 'Vallozzi' });

    // Act
    await saved(createCoffee(tx, coffeeInput(brand.id)));

    // Assert: the public read path sees every table the editor wrote.
    expect(await pageOf(tx, 'vallozzi-crema-dolce')).toMatchObject({
      kind: 'coffee',
      coffee: {
        name: 'Crema Dolce',
        roastLevel: 3,
        brand: { name: 'Vallozzi' },
        description: 'Pehme segu igapäevaseks espressoks.',
        packages: [{ sizeG: 1000, gtin: '02001234500012' }, { sizeG: 500, gtin: null }],
        species: [{ code: 'ARABICA', percentage: 70 }, { code: 'ROBUSTA', percentage: 30 }],
        origins: ['BR', 'VN'],
        ratingCount: 0,
      },
    });
    expect((await listRankedCoffees(tx, noFilters, rules)).unrated.map(item => item.slug)).toEqual(['vallozzi-crema-dolce']);
  }));

  it('Should_KeepTheCoffeeOutOfEveryPublicList_When_SavedAsDraft', () => withRollback(async (tx) => {
    // Arrange
    const brand = await createBrand(tx, { name: 'Vallozzi' });

    // Act
    await saved(createCoffee(tx, coffeeInput(brand.id, { status: 'DRAFT' })));

    // Assert
    expect(await pageOf(tx, 'vallozzi-crema-dolce')).toEqual({ kind: 'notFound' });
    expect(await listRankedCoffees(tx, noFilters, rules)).toEqual({ ranked: [], unrated: [] });
    expect(await searchCatalogue(tx, 'Vallozzi Crema', rules)).toMatchObject({ coffees: [] });
    expect(await searchCatalogue(tx, '2001234500012', rules)).toEqual({ kind: 'gtin', coffee: null });
  }));

  it('Should_FindTheCoffeeByItsEan13_When_TheGtinWasTypedAsUpcA', () => withRollback(async (tx) => {
    // Arrange: one code in two printed forms, 12 digits on the bag and 13 from a scanner.
    const brand = await createBrand(tx, { name: 'Vallozzi' });
    await saved(createCoffee(tx, coffeeInput(brand.id, { packages: [{ sizeG: 250, gtin: '200123450007' }] })));

    // Act
    const result = await searchCatalogue(tx, '0200123450007', rules);

    // Assert
    expect(result).toMatchObject({ kind: 'gtin', coffee: { slug: 'vallozzi-crema-dolce', packageSizeG: 250 } });
  }));

  it('Should_MarkTheCoffeeReviewed_When_Created', () => withRollback(async (tx) => {
    // Arrange
    const brand = await createBrand(tx);

    // Act
    const id = await saved(createCoffee(tx, coffeeInput(brand.id)));

    // Assert
    expect((await getCoffeeForEditing(tx, id))?.reviewedAt).toEqual(expect.any(String));
  }));

  it.each([
    ['slug', { name: 'Another Name' }, { reason: 'slugTaken' }],
    ['brand and name', { slug: 'another-slug' }, { reason: 'nameTaken' }],
  ] as const)('Should_ReportAConflict_When_TheSameIsAlreadyTaken (%s)', (_case, overrides, conflict) => withRollback(async (tx) => {
    // Arrange
    const brand = await createBrand(tx);
    await saved(createCoffee(tx, coffeeInput(brand.id, { packages: [] })));

    // Act
    const result = await createCoffee(tx, coffeeInput(brand.id, { packages: [], ...overrides }));

    // Assert
    expect(result).toEqual({ kind: 'conflict', conflict });
  }));

  it('Should_NameTheCoffeeThatHasTheGtin_When_AnotherCoffeeHasIt', () => withRollback(async (tx) => {
    // Arrange
    const brand = await createBrand(tx, { name: 'Vallozzi' });
    await saved(createCoffee(tx, coffeeInput(brand.id)));

    // Act
    const result = await createCoffee(tx, coffeeInput(brand.id, { name: 'Oro', slug: 'vallozzi-oro' }));

    // Assert: shown as printed, the way the admin typed it.
    expect(result).toEqual({
      kind: 'conflict',
      conflict: { reason: 'gtinTaken', gtins: [{ gtin: '2001234500012', coffeeName: 'Vallozzi Crema Dolce' }] },
    });
  }));

  it('Should_ReportTheBrand_When_ItDoesNotExist', () => withRollback(async (tx) => {
    // Act
    const result = await createCoffee(tx, coffeeInput(999_999_999));

    // Assert
    expect(result).toEqual({ kind: 'unknownBrand' });
  }));
});

describe('updateCoffee', () => {
  it('Should_ReplaceTheListsAndDescription_When_Saved', () => withRollback(async (tx) => {
    // Arrange
    const brand = await createBrand(tx);
    const id = await saved(createCoffee(tx, coffeeInput(brand.id)));

    // Act
    await saved(updateCoffee(tx, id, coffeeInput(brand.id, {
      packages: [{ sizeG: 1000, gtin: '2001234500012' }],
      species: [{ code: 'ARABICA', percentage: 100 }],
      origins: [],
      descriptions: { et: null },
    })));

    // Assert: the GTIN the delete freed is taken again in the same transaction.
    expect(await getCoffeeForEditing(tx, id)).toMatchObject({
      packages: [{ sizeG: 1000, gtin: '2001234500012' }],
      species: [{ code: 'ARABICA', percentage: 100 }],
      origins: [],
      descriptions: { et: null },
    });
    expect(await tx.select().from(coffeeBeanTranslation).where(eq(coffeeBeanTranslation.coffeeBeanId, id))).toEqual([]);
  }));

  it('Should_RedirectTheOldSlug_When_APublishedCoffeeIsRenamed', () => withRollback(async (tx) => {
    // Arrange
    const brand = await createBrand(tx);
    const id = await saved(createCoffee(tx, coffeeInput(brand.id)));

    // Act
    await saved(updateCoffee(tx, id, coffeeInput(brand.id, { name: 'Crema Dolce 2026', slug: 'vallozzi-crema-dolce-2026' })));

    // Assert
    expect(await pageOf(tx, 'vallozzi-crema-dolce')).toEqual({ kind: 'redirect', slug: 'vallozzi-crema-dolce-2026' });
  }));

  it('Should_LeaveNoRedirect_When_ADraftIsRenamed', () => withRollback(async (tx) => {
    // Arrange: a draft's slug was never public.
    const brand = await createBrand(tx);
    const id = await saved(createCoffee(tx, coffeeInput(brand.id, { status: 'DRAFT' })));

    // Act
    await saved(updateCoffee(tx, id, coffeeInput(brand.id, { status: 'PUBLISHED', slug: 'vallozzi-dolce' })));

    // Assert
    expect(await tx.select().from(coffeeBeanSlugRedirect).where(eq(coffeeBeanSlugRedirect.coffeeBeanId, id))).toEqual([]);
    expect(await pageOf(tx, 'vallozzi-dolce')).toMatchObject({ kind: 'coffee' });
  }));

  it.each(['PUBLISHED', 'ARCHIVED'] as const)('Should_RefuseToMakeADraft_When_TheCoffeeHasBeenPublic (%s)', status => withRollback(async (tx) => {
    // Arrange
    const brand = await createBrand(tx);
    const id = await saved(createCoffee(tx, coffeeInput(brand.id, { status })));

    // Act
    const result = await updateCoffee(tx, id, coffeeInput(brand.id, { status: 'DRAFT' }));

    // Assert: refused, and nothing changed.
    expect(result).toEqual({ kind: 'conflict', conflict: { reason: 'cannotUnpublish' } });
    expect((await tx.select({ status: coffeeBean.status }).from(coffeeBean).where(eq(coffeeBean.id, id)))[0]?.status).toBe(status);
  }));

  it('Should_KeepThePageButLeaveTheRanking_When_Archived', () => withRollback(async (tx) => {
    // Arrange
    const brand = await createBrand(tx);
    const id = await saved(createCoffee(tx, coffeeInput(brand.id)));
    await rateCoffee(tx, id, [4]);

    // Act
    await saved(updateCoffee(tx, id, coffeeInput(brand.id, { status: 'ARCHIVED' })));

    // Assert
    expect(await pageOf(tx, 'vallozzi-crema-dolce')).toMatchObject({ kind: 'coffee', coffee: { archived: true, ratingCount: 1 } });
    expect((await listRankedCoffees(tx, noFilters, rules)).ranked).toEqual([]);
  }));

  it('Should_ReportNotFound_When_TheCoffeeDoesNotExist', () => withRollback(async (tx) => {
    // Arrange
    const brand = await createBrand(tx);

    // Act
    const result = await updateCoffee(tx, 999_999_999, coffeeInput(brand.id));

    // Assert
    expect(result).toEqual({ kind: 'notFound' });
  }));

  it('Should_IgnoreItsOwnGtins_When_OnlyAnotherCoffeeConflicts', () => withRollback(async (tx) => {
    // Arrange
    const brand = await createBrand(tx, { name: 'Vallozzi' });
    await saved(createCoffee(tx, coffeeInput(brand.id, { packages: [{ sizeG: 1000, gtin: '2001234500029' }] })));
    const id = await saved(createCoffee(tx, coffeeInput(brand.id, { name: 'Oro', slug: 'vallozzi-oro' })));

    // Act: keeps its own code and adds the other coffee's.
    const result = await updateCoffee(tx, id, coffeeInput(brand.id, {
      name: 'Oro',
      slug: 'vallozzi-oro',
      packages: [{ sizeG: 1000, gtin: '2001234500012' }, { sizeG: 500, gtin: '2001234500029' }],
    }));

    // Assert
    expect(result).toEqual({
      kind: 'conflict',
      conflict: { reason: 'gtinTaken', gtins: [{ gtin: '2001234500029', coffeeName: 'Vallozzi Crema Dolce' }] },
    });
  }));
});

describe('markCoffeeReviewed', () => {
  it('Should_SetTheReviewDate_When_TheCoffeeExists', () => withRollback(async (tx) => {
    // Arrange: inserted directly, so it has never been reviewed.
    const coffee = await insertCoffee(tx);

    // Act
    const result = await markCoffeeReviewed(tx, coffee.id);

    // Assert
    expect(result).toEqual({ reviewedAt: expect.any(String) });
    expect((await getCoffeeForEditing(tx, coffee.id))?.reviewedAt).toBe(result?.reviewedAt);
  }));

  it('Should_ReturnNull_When_TheCoffeeDoesNotExist', () => withRollback(async (tx) => {
    // Act
    const result = await markCoffeeReviewed(tx, 999_999_999);

    // Assert
    expect(result).toBeNull();
  }));
});

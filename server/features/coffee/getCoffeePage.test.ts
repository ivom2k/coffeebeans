import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  coffeeBean, coffeeBeanOrigin, coffeeBeanPackage, coffeeBeanSpecies, coffeeBeanTranslation,
} from '../../db/schema/index.ts';
import {
  addRatings, closeTestDb, createCoffee, createMachineModel, createManufacturer, rateCoffee, withRollback,
} from '../../db/tests/helpers.ts';
import { getCoffeePage } from './getCoffeePage.ts';
import type { Thresholds } from './thresholds.ts';

const rules: Thresholds = { minRatings: 1, minIssueAnswers: 5, issueFlagShare: 0.4 };

describe('getCoffeePage', () => {
  afterAll(closeTestDb);

  it('Should_ReturnTheCoffeeWithItsSummary_When_SlugIsCurrent', () => withRollback(async (tx) => {
    // Arrange
    const coffee = await createCoffee(tx, { slug: 'crema', name: 'Crema', roastLevel: 3 });
    await tx.insert(coffeeBeanTranslation).values([
      { coffeeBeanId: coffee.id, locale: 'et', description: 'Pehme segu.' },
      { coffeeBeanId: coffee.id, locale: 'ru', description: 'Мягкая смесь.' },
    ]);
    await tx.insert(coffeeBeanPackage).values([
      { coffeeBeanId: coffee.id, sizeG: 500, gtin: null },
      { coffeeBeanId: coffee.id, sizeG: 1000, gtin: '02001234500012' },
    ]);
    await tx.insert(coffeeBeanSpecies).values([
      { coffeeBeanId: coffee.id, speciesCode: 'ROBUSTA', percentage: 20 },
      { coffeeBeanId: coffee.id, speciesCode: 'ARABICA', percentage: 80 },
    ]);
    await tx.insert(coffeeBeanOrigin).values([
      { coffeeBeanId: coffee.id, countryCode: 'VN' },
      { coffeeBeanId: coffee.id, countryCode: 'BR' },
    ]);
    await rateCoffee(tx, coffee.id, [5, 5, 4, 1]);

    // Act
    const result = await getCoffeePage(tx, 'crema', 'et', rules);

    // Assert
    expect(result).toMatchObject({
      kind: 'coffee',
      coffee: {
        slug: 'crema',
        name: 'Crema',
        archived: false,
        roastLevel: 3,
        description: 'Pehme segu.',
        packages: [{ sizeG: 1000, gtin: '02001234500012' }, { sizeG: 500, gtin: null }],
        species: [{ code: 'ARABICA', percentage: 80 }, { code: 'ROBUSTA', percentage: 20 }],
        origins: ['BR', 'VN'],
        ratingCount: 4,
        rawMean: 3.75,
        scoreCounts: [1, 0, 0, 1, 2],
      },
    });
  }));

  it('Should_RedirectToTheCurrentSlug_When_SlugIsAnOldOne', () => withRollback(async (tx) => {
    // Arrange
    const coffee = await createCoffee(tx, { slug: 'old-name' });
    await tx.update(coffeeBean).set({ slug: 'new-name' }).where(eq(coffeeBean.id, coffee.id));

    // Act
    const result = await getCoffeePage(tx, 'old-name', 'et', rules);

    // Assert
    expect(result).toEqual({ kind: 'redirect', slug: 'new-name' });
  }));

  it('Should_ReturnNotFound_When_CoffeeIsADraft', () => withRollback(async (tx) => {
    // Arrange
    await createCoffee(tx, { slug: 'not-yet', status: 'DRAFT' });

    // Act
    const result = await getCoffeePage(tx, 'not-yet', 'et', rules);

    // Assert
    expect(result).toEqual({ kind: 'notFound' });
  }));

  it('Should_ReturnNotFound_When_RedirectTargetIsBackInDraft', () => withRollback(async (tx) => {
    // Arrange
    const coffee = await createCoffee(tx, { slug: 'was-public' });
    await tx.update(coffeeBean).set({ slug: 'renamed' }).where(eq(coffeeBean.id, coffee.id));
    await tx.update(coffeeBean).set({ status: 'DRAFT' }).where(eq(coffeeBean.id, coffee.id));

    // Act
    const result = await getCoffeePage(tx, 'was-public', 'et', rules);

    // Assert
    expect(result).toEqual({ kind: 'notFound' });
  }));

  it('Should_GroupMachineIssuesByKind_When_RatingsNameMachines', () => withRollback(async (tx) => {
    // Arrange: one automatic manufacturer, portafilter machines from two others, and a
    // rating that names no machine.
    const veskimees = await createManufacturer(tx, { name: 'Veskimees' });
    const automatic = await createMachineModel(tx, { kind: 'AUTOMATIC', manufacturerId: veskimees.id });
    const portafilterA = await createMachineModel(tx, { kind: 'PORTAFILTER' });
    const portafilterB = await createMachineModel(tx, { kind: 'PORTAFILTER' });
    const coffee = await createCoffee(tx, { slug: 'oily' });
    await addRatings(tx, coffee.id, [
      ...Array.from({ length: 2 }, () => ({ score: 3, machineModelId: automatic.id, issues: ['GRINDER_STRUGGLED'] })),
      ...Array.from({ length: 3 }, () => ({ score: 4, machineModelId: automatic.id, issues: [] })),
      { score: 4, machineModelId: portafilterA.id, issues: ['FREQUENT_CLEANING'] },
      { score: 4, machineModelId: portafilterB.id, issues: [] },
      { score: 5 },
    ]);

    // Act
    const result = await getCoffeePage(tx, 'oily', 'et', rules);

    // Assert
    expect(result).toMatchObject({
      kind: 'coffee',
      coffee: {
        machineIssues: {
          automatic: [{ manufacturerName: 'Veskimees', answered: 5, withIssues: 2, enoughAnswers: true }],
          portafilter: { answered: 2, withIssues: 1, enoughAnswers: false },
        },
      },
    });
  }));
});

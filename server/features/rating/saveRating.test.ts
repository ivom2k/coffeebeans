import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { RatingInput } from '../../../shared/types/rating.ts';
import { rating, ratingMachineIssue } from '../../db/schema/index.ts';
import {
  closeTestDb, createCoffee, createMachineModel, createManufacturer, createUser, rateCoffee, withRollback,
} from '../../db/tests/helpers.ts';
import { getCoffeePage } from '../coffee/getCoffeePage.ts';
import type { Thresholds } from '../coffee/thresholds.ts';
import { saveRating } from './saveRating.ts';

const rules: Thresholds = { minRatings: 1, minIssueAnswers: 1, issueFlagShare: 0.4 };

const ratingInput = (overrides: Partial<RatingInput> = {}): RatingInput => ({
  score: 4,
  perception: { bitterness: null, roastCharacter: null, crema: null, strength: null },
  beanSurface: null,
  machineModelId: null,
  machineIssues: null,
  privateNote: null,
  ...overrides,
});

describe('saveRating', () => {
  afterAll(closeTestDb);

  it('Should_CreateTheRating_When_UserRatesTheCoffeeForTheFirstTime', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const coffee = await createCoffee(tx, { slug: 'crema' });
    const maker = await createManufacturer(tx, { name: 'Veskimees' });
    const model = await createMachineModel(tx, { manufacturerId: maker.id, name: 'VM 300' });

    // Act
    const result = await saveRating(tx, user.id, 'crema', ratingInput({
      score: 5,
      perception: { bitterness: 2, roastCharacter: null, crema: 4, strength: null },
      beanSurface: 'OILY',
      machineModelId: model.id,
      machineIssues: ['FREQUENT_CLEANING', 'BEANS_STICK_IN_HOPPER'],
      privateNote: 'Jahvatus 8',
    }));

    // Assert
    expect(result).toEqual({
      kind: 'saved',
      rating: {
        score: 5,
        perception: { bitterness: 2, roastCharacter: null, crema: 4, strength: null },
        beanSurface: 'OILY',
        machine: { modelId: model.id, manufacturerName: 'Veskimees', modelName: 'VM 300', kind: 'AUTOMATIC' },
        // In the vocabulary's order, not the order sent.
        machineIssues: ['BEANS_STICK_IN_HOPPER', 'FREQUENT_CLEANING'],
        privateNote: 'Jahvatus 8',
      },
    });
    expect(await tx.select().from(rating).where(eq(rating.coffeeBeanId, coffee.id)))
      .toMatchObject([{ userId: user.id, score: 5, hadMachineIssues: true, privateNote: 'Jahvatus 8' }]);
  }));

  it('Should_UpdateTheSameRow_When_UserRatesTheCoffeeAgain', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const coffee = await createCoffee(tx, { slug: 'crema' });
    await saveRating(tx, user.id, 'crema', ratingInput({ score: 2, privateNote: 'Liiga mõru' }));

    // Act
    await saveRating(tx, user.id, 'crema', ratingInput({ score: 4 }));

    // Assert
    expect(await tx.select().from(rating).where(eq(rating.coffeeBeanId, coffee.id)))
      .toMatchObject([{ userId: user.id, score: 4, privateNote: null }]);
  }));

  it('Should_DeriveTheFlagAndRowsFromOneInput_When_IssuesAreSkippedNoneOrSome', () => withRollback(async (tx) => {
    // Arrange
    const model = await createMachineModel(tx);
    const coffee = await createCoffee(tx, { slug: 'crema' });
    const skipped = await createUser(tx);
    const none = await createUser(tx);
    const some = await createUser(tx);

    // Act
    await saveRating(tx, skipped.id, 'crema', ratingInput({ machineModelId: model.id, machineIssues: null }));
    await saveRating(tx, none.id, 'crema', ratingInput({ machineModelId: model.id, machineIssues: [] }));
    await saveRating(tx, some.id, 'crema', ratingInput({ machineModelId: model.id, machineIssues: ['GRINDER_STRUGGLED', 'OTHER'] }));

    // Assert
    const saved = await tx.select({ userId: rating.userId, hadMachineIssues: rating.hadMachineIssues })
      .from(rating).where(eq(rating.coffeeBeanId, coffee.id));
    const flagOf = (userId: number) => saved.find(row => row.userId === userId)?.hadMachineIssues;
    expect([flagOf(skipped.id), flagOf(none.id), flagOf(some.id)]).toEqual([null, false, true]);
    expect(await tx.$count(ratingMachineIssue)).toBe(2);
  }));

  it('Should_ReplaceTheIssueRows_When_TheAnswerChanges', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const model = await createMachineModel(tx);
    await createCoffee(tx, { slug: 'crema' });
    await saveRating(tx, user.id, 'crema', ratingInput({ machineModelId: model.id, machineIssues: ['GRINDER_JAMMED', 'OTHER'] }));

    // Act
    const result = await saveRating(tx, user.id, 'crema', ratingInput({ machineModelId: model.id, machineIssues: [] }));

    // Assert
    expect(result).toMatchObject({ kind: 'saved', rating: { machineIssues: [] } });
    expect(await tx.$count(ratingMachineIssue)).toBe(0);
  }));

  it('Should_ReturnNotFoundAndSaveNothing_When_CoffeeIsADraft', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    await createCoffee(tx, { slug: 'not-yet', status: 'DRAFT' });

    // Act
    const result = await saveRating(tx, user.id, 'not-yet', ratingInput());

    // Assert
    expect(result).toEqual({ kind: 'notFound' });
    expect(await tx.$count(rating, eq(rating.userId, user.id))).toBe(0);
  }));

  it('Should_SaveTheRating_When_CoffeeIsArchived', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    await createCoffee(tx, { slug: 'sold-out', status: 'ARCHIVED' });

    // Act
    const result = await saveRating(tx, user.id, 'sold-out', ratingInput());

    // Assert
    expect(result).toMatchObject({ kind: 'saved' });
  }));

  it('Should_ReturnUnknownMachineAndSaveNothing_When_ModelDoesNotExist', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    await createCoffee(tx, { slug: 'crema' });

    // Act
    const result = await saveRating(tx, user.id, 'crema', ratingInput({ machineModelId: 999_999, machineIssues: [] }));

    // Assert
    expect(result).toEqual({ kind: 'unknownMachine' });
    expect(await tx.$count(rating, eq(rating.userId, user.id))).toBe(0);
  }));

  it('Should_MoveTheCoffeeSummary_When_ARatingIsSavedAndThenEdited', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const maker = await createManufacturer(tx, { name: 'Veskimees' });
    const model = await createMachineModel(tx, { manufacturerId: maker.id });
    const coffee = await createCoffee(tx, { slug: 'crema' });
    await rateCoffee(tx, coffee.id, [5, 5]);
    const summaryOf = async () => {
      const page = await getCoffeePage(tx, 'crema', 'et', rules);
      return page.kind === 'coffee' ? page.coffee : null;
    };
    const before = await summaryOf();

    // Act
    await saveRating(tx, user.id, 'crema', ratingInput({ score: 2, machineModelId: model.id, machineIssues: ['GRINDER_JAMMED'] }));
    const afterSave = await summaryOf();
    await saveRating(tx, user.id, 'crema', ratingInput({ score: 5, machineModelId: model.id, machineIssues: [] }));
    const afterEdit = await summaryOf();

    // Assert
    expect(before).toMatchObject({ ratingCount: 2, rawMean: 5, scoreCounts: [0, 0, 0, 0, 2], machineIssues: { automatic: [] } });
    expect(afterSave).toMatchObject({
      ratingCount: 3,
      rawMean: 4,
      scoreCounts: [0, 1, 0, 0, 2],
      machineIssues: { automatic: [{ manufacturerName: 'Veskimees', answered: 1, withIssues: 1 }] },
    });
    expect(afterEdit).toMatchObject({
      ratingCount: 3,
      rawMean: 5,
      scoreCounts: [0, 0, 0, 0, 3],
      machineIssues: { automatic: [{ manufacturerName: 'Veskimees', answered: 1, withIssues: 0 }] },
    });
  }));
});

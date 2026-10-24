import { afterAll, describe, expect, it } from 'vitest';
import { rating, ratingMachineIssue } from '../../db/schema/index.ts';
import {
  closeTestDb, createCoffee, createMachineModel, createManufacturer, createUser, required, withRollback,
} from '../../db/tests/helpers.ts';
import { getMyRating } from './getMyRating.ts';

describe('getMyRating', () => {
  afterAll(closeTestDb);

  it('Should_ReturnTheUsersRatingWithItsNote_When_TheyRatedTheCoffee', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const coffee = await createCoffee(tx, { slug: 'crema' });
    const maker = await createManufacturer(tx, { name: 'Kangpress' });
    const model = await createMachineModel(tx, { manufacturerId: maker.id, name: 'Classic 1', kind: 'PORTAFILTER' });
    const [row] = await tx.insert(rating).values({
      userId: user.id, coffeeBeanId: coffee.id, machineModelId: model.id, score: 3, perceivedStrength: 5,
      beanSurfaceCode: 'SLIGHTLY_OILY', hadMachineIssues: true, privateNote: 'Ainult piimaga',
    }).returning();
    await tx.insert(ratingMachineIssue).values([
      { ratingId: required(row).id, machineIssueCode: 'OTHER' },
      { ratingId: required(row).id, machineIssueCode: 'GRINDER_STRUGGLED' },
    ]);

    // Act
    const result = await getMyRating(tx, user.id, 'crema');

    // Assert
    expect(result).toEqual({
      kind: 'found',
      rating: {
        score: 3,
        perception: { bitterness: null, roastCharacter: null, crema: null, strength: 5 },
        beanSurface: 'SLIGHTLY_OILY',
        machine: { modelId: model.id, manufacturerName: 'Kangpress', modelName: 'Classic 1', kind: 'PORTAFILTER' },
        machineIssues: ['GRINDER_STRUGGLED', 'OTHER'],
        privateNote: 'Ainult piimaga',
      },
    });
  }));

  it('Should_ReturnNoRating_When_OnlyAnotherUserRatedTheCoffee', () => withRollback(async (tx) => {
    // Arrange
    const me = await createUser(tx);
    const someoneElse = await createUser(tx);
    const coffee = await createCoffee(tx, { slug: 'crema' });
    await tx.insert(rating).values({ userId: someoneElse.id, coffeeBeanId: coffee.id, score: 5, privateNote: 'Not yours' });

    // Act
    const result = await getMyRating(tx, me.id, 'crema');

    // Assert
    expect(result).toEqual({ kind: 'found', rating: null });
  }));

  it('Should_ReportTheIssueAnswerAsSkipped_When_RatingNamesNoMachine', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const coffee = await createCoffee(tx, { slug: 'crema' });
    await tx.insert(rating).values({ userId: user.id, coffeeBeanId: coffee.id, score: 4 });

    // Act
    const result = await getMyRating(tx, user.id, 'crema');

    // Assert
    expect(result).toMatchObject({ kind: 'found', rating: { machine: null, machineIssues: null, beanSurface: null } });
  }));

  it('Should_ReturnNotFound_When_CoffeeIsADraftOrUnknown', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    await createCoffee(tx, { slug: 'not-yet', status: 'DRAFT' });

    // Act
    const results = [await getMyRating(tx, user.id, 'not-yet'), await getMyRating(tx, user.id, 'no-such-coffee')];

    // Assert
    expect(results).toEqual([{ kind: 'notFound' }, { kind: 'notFound' }]);
  }));
});

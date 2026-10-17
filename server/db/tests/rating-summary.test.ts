import { desc, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { Database } from '../client.ts';
import { coffeeBeanRatingSummary } from '../schema/index.ts';
import { closeTestDb, createCoffee, rateCoffee, withRollback } from './helpers.ts';

const summaryOf = (tx: Database, coffeeIds: number[]) =>
  tx.select().from(coffeeBeanRatingSummary)
    .where(inArray(coffeeBeanRatingSummary.coffeeBeanId, coffeeIds))
    .orderBy(desc(coffeeBeanRatingSummary.shrunkMean));

describe('coffee_bean_rating_summary', () => {
  afterAll(closeTestDb);

  it('Should_RankTwentyGoodRatingsAboveASingleFive_When_GlobalMeanIs3_8', () => withRollback(async (tx) => {
    // Arrange: the decisions log §2 examples. 30 ratings summing to 114 make the global
    // mean m exactly 3.8.
    const single = await createCoffee(tx);
    const many = await createCoffee(tx);
    const filler = await createCoffee(tx);
    await rateCoffee(tx, single.id, [5]);
    await rateCoffee(tx, many.id, [...Array<number>(12).fill(4), ...Array<number>(8).fill(5)]); // sum 88, mean 4.4
    await rateCoffee(tx, filler.id, [3, 3, 3, 2, 2, 2, 2, 2, 2]); // sum 21

    // Act
    const rows = await summaryOf(tx, [single.id, many.id, filler.id]);

    // Assert: (5·3.8 + 5) / 6 = 4.0 and (5·3.8 + 88) / 25 = 4.28, so the coffee with the
    // lower raw mean ranks first.
    expect(rows.map(row => row.coffeeBeanId)).toEqual([many.id, single.id, filler.id]);
    expect(rows[0]).toMatchObject({ ratingCount: 20, rawMean: 4.4, shrunkMean: 4.28 });
    expect(rows[1]).toMatchObject({ ratingCount: 1, rawMean: 5, shrunkMean: 4 });
  }));

  it('Should_ShowGlobalMeanAndNoRawMean_When_CoffeeIsUnrated', () => withRollback(async (tx) => {
    // Arrange: m = 4.5
    const rated = await createCoffee(tx);
    const unrated = await createCoffee(tx);
    await rateCoffee(tx, rated.id, [5, 4]);

    // Act
    const [row] = await summaryOf(tx, [unrated.id]);

    // Assert
    expect(row).toMatchObject({ ratingCount: 0, rawMean: null, shrunkMean: 4.5 });
  }));

  it('Should_LeaveOutDraftCoffees_When_ListingSummaries', () => withRollback(async (tx) => {
    // Arrange
    const draft = await createCoffee(tx, { status: 'DRAFT' });
    const published = await createCoffee(tx, { status: 'PUBLISHED' });
    const archived = await createCoffee(tx, { status: 'ARCHIVED' });

    // Act
    const rows = await summaryOf(tx, [draft.id, published.id, archived.id]);

    // Assert
    expect(new Set(rows.map(row => row.coffeeBeanId))).toEqual(new Set([published.id, archived.id]));
  }));

  it('Should_CountEachScore_When_BuildingTheHistogram', () => withRollback(async (tx) => {
    // Arrange
    const coffee = await createCoffee(tx);
    await rateCoffee(tx, coffee.id, [5, 5, 4, 1]);

    // Act
    const [row] = await summaryOf(tx, [coffee.id]);

    // Assert
    expect(row).toMatchObject({ score1Count: 1, score2Count: 0, score3Count: 0, score4Count: 1, score5Count: 2 });
  }));
});

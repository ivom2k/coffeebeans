import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { Database } from '../client.ts';
import { coffeeBean, coffeeBeanSlugRedirect } from '../schema/index.ts';
import { closeTestDb, createCoffee, withRollback } from './helpers.ts';

const rename = (tx: Database, coffeeId: number, changes: Partial<typeof coffeeBean.$inferInsert>) =>
  tx.update(coffeeBean).set(changes).where(eq(coffeeBean.id, coffeeId));

const redirectsTo = async (tx: Database, coffeeId: number) =>
  (await tx.select({ oldSlug: coffeeBeanSlugRedirect.oldSlug })
    .from(coffeeBeanSlugRedirect)
    .where(eq(coffeeBeanSlugRedirect.coffeeBeanId, coffeeId)))
    .map(row => row.oldSlug)
    .sort();

describe('coffee_bean_track_slug trigger', () => {
  afterAll(closeTestDb);

  it('Should_KeepOldSlug_When_PublishedCoffeeIsRenamed', () => withRollback(async (tx) => {
    // Arrange
    const coffee = await createCoffee(tx, { slug: 'old-name' });

    // Act
    await rename(tx, coffee.id, { slug: 'new-name' });

    // Assert
    expect(await redirectsTo(tx, coffee.id)).toEqual(['old-name']);
  }));

  it('Should_KeepNoRedirect_When_DraftCoffeeIsRenamed', () => withRollback(async (tx) => {
    // Arrange
    const coffee = await createCoffee(tx, { status: 'DRAFT', slug: 'draft-name' });

    // Act
    await rename(tx, coffee.id, { slug: 'better-name' });

    // Assert: the draft URL was never public.
    expect(await redirectsTo(tx, coffee.id)).toEqual([]);
  }));

  it('Should_PointEveryOldSlugAtTheCoffee_When_RenamedTwice', () => withRollback(async (tx) => {
    // Arrange
    const coffee = await createCoffee(tx, { slug: 'first' });

    // Act
    await rename(tx, coffee.id, { slug: 'second' });
    await rename(tx, coffee.id, { slug: 'third' });

    // Assert: both point at the coffee itself, so neither chains through the other.
    expect(await redirectsTo(tx, coffee.id)).toEqual(['first', 'second']);
  }));

  it('Should_RemoveTheRedirect_When_AnotherCoffeeTakesTheSlug', () => withRollback(async (tx) => {
    // Arrange
    const renamed = await createCoffee(tx, { slug: 'contested' });
    await rename(tx, renamed.id, { slug: 'moved-on' });

    // Act
    await createCoffee(tx, { slug: 'contested' });

    // Assert: a slug in live use always wins.
    expect(await redirectsTo(tx, renamed.id)).toEqual([]);
  }));

  it('Should_SwapTheRedirect_When_CoffeeIsRenamedBack', () => withRollback(async (tx) => {
    // Arrange
    const coffee = await createCoffee(tx, { slug: 'original' });
    await rename(tx, coffee.id, { slug: 'detour' });

    // Act
    await rename(tx, coffee.id, { slug: 'original' });

    // Assert
    expect(await redirectsTo(tx, coffee.id)).toEqual(['detour']);
  }));

  it('Should_KeepNoRedirect_When_PublishedAndRenamedInOneUpdate', () => withRollback(async (tx) => {
    // Arrange
    const coffee = await createCoffee(tx, { status: 'DRAFT', slug: 'working-title' });

    // Act
    await rename(tx, coffee.id, { status: 'PUBLISHED', slug: 'launch-name' });

    // Assert: the trigger looks at the status before the update, which was DRAFT.
    expect(await redirectsTo(tx, coffee.id)).toEqual([]);
  }));
});

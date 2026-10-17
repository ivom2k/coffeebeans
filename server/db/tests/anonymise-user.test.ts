import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { Database } from '../client.ts';
import { appUser, feedback, rating, suggestion, userMachine, userWatchedCoffeeBean } from '../schema/index.ts';
import {
  anonymiseUser, closeTestDb, createCoffee, createMachineModel, createUser, required, withRollback,
} from './helpers.ts';

// A user with a row in every table anonymise_user() touches.
const createUserWithHistory = async (tx: Database) => {
  const user = await createUser(tx);
  const coffee = await createCoffee(tx);
  const model = await createMachineModel(tx);
  await tx.insert(rating).values({ userId: user.id, coffeeBeanId: coffee.id, score: 4, privateNote: 'Mine only' });
  await tx.insert(userMachine).values({ userId: user.id, machineModelId: model.id, nickname: 'Kodu' });
  await tx.insert(userWatchedCoffeeBean).values({ userId: user.id, coffeeBeanId: coffee.id });
  await tx.insert(suggestion).values({ suggestionType: 'COFFEE_BEAN', userId: user.id, details: { name: 'Something new' } });
  await tx.insert(feedback).values({ message: 'Tere!', userId: user.id });
  return user;
};

const historyOf = async (tx: Database, userId: number) => ({
  user: required((await tx.select().from(appUser).where(eq(appUser.id, userId)))[0]),
  ratings: await tx.select().from(rating).where(eq(rating.userId, userId)),
  machines: await tx.select().from(userMachine).where(eq(userMachine.userId, userId)),
  watched: await tx.select().from(userWatchedCoffeeBean).where(eq(userWatchedCoffeeBean.userId, userId)),
  suggestions: await tx.select().from(suggestion).where(eq(suggestion.userId, userId)),
  feedback: await tx.select().from(feedback).where(eq(feedback.userId, userId)),
});

describe('anonymise_user()', () => {
  afterAll(closeTestDb);

  it('Should_RemoveTheIdentityAndKeepTheRatings_When_UserIsActive', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUserWithHistory(tx);
    const [suggestionsBefore, feedbackBefore] = [await tx.$count(suggestion), await tx.$count(feedback)];

    // Act
    const anonymised = await anonymiseUser(tx, user.id);

    // Assert
    const after = await historyOf(tx, user.id);
    expect(anonymised).toBe(true);
    expect(after.user).toMatchObject({ authProvider: null, externalSubject: null });
    expect(after.user.deletedAt).toBeInstanceOf(Date);
    expect(after.ratings).toEqual([expect.objectContaining({ score: 4, privateNote: null })]);
    expect(after.machines).toEqual([]);
    expect(after.watched).toEqual([]);
    // Suggestions and feedback stay, detached from the user.
    expect(after.suggestions).toEqual([]);
    expect(after.feedback).toEqual([]);
    expect([await tx.$count(suggestion), await tx.$count(feedback)]).toEqual([suggestionsBefore, feedbackBefore]);
  }));

  it('Should_LeaveOtherUsersUntouched_When_AnonymisingOne', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUserWithHistory(tx);
    const bystander = await createUserWithHistory(tx);
    const before = await historyOf(tx, bystander.id);

    // Act
    await anonymiseUser(tx, user.id);

    // Assert
    expect(await historyOf(tx, bystander.id)).toEqual(before);
  }));

  it('Should_ReturnFalse_When_UserIsAlreadyAnonymised', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUserWithHistory(tx);
    await anonymiseUser(tx, user.id);

    // Act
    const anonymisedAgain = await anonymiseUser(tx, user.id);

    // Assert
    expect(anonymisedAgain).toBe(false);
  }));

  it('Should_ReturnFalse_When_UserDoesNotExist', () => withRollback(async (tx) => {
    // Act
    const anonymised = await anonymiseUser(tx, 999_999_999);

    // Assert
    expect(anonymised).toBe(false);
  }));

  it('Should_RefuseAHardDelete_When_UserHasRatings', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUserWithHistory(tx);

    // Act: a nested transaction is a savepoint, so the failure doesn't abort the test's transaction.
    const hardDelete = tx.transaction(savepoint => savepoint.delete(appUser).where(eq(appUser.id, user.id)));

    // Assert: 23503 is Postgres' foreign_key_violation; rating.user_id has no cascade.
    await expect(hardDelete).rejects.toMatchObject({ cause: { code: '23503' } });
  }));
});

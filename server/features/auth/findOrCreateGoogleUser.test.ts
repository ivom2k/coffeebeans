import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { appUser } from '../../db/schema/index.ts';
import { anonymiseUser, closeTestDb, withRollback } from '../../db/tests/helpers.ts';
import { findOrCreateGoogleUser } from './findOrCreateGoogleUser.ts';

describe('findOrCreateGoogleUser', () => {
  afterAll(closeTestDb);

  it('Should_CreateUser_When_SubjectIsNew', () => withRollback(async (tx) => {
    // Act
    const user = await findOrCreateGoogleUser(tx, 'google-subject-new');

    // Assert
    expect(user.role).toBe('USER');
    const rows = await tx.select().from(appUser).where(eq(appUser.id, user.id));
    expect(rows).toMatchObject([{ authProvider: 'GOOGLE', externalSubject: 'google-subject-new', deletedAt: null }]);
  }));

  it('Should_ReturnSameUser_When_SubjectSignsInAgain', () => withRollback(async (tx) => {
    // Arrange
    const first = await findOrCreateGoogleUser(tx, 'google-subject-again');

    // Act
    const second = await findOrCreateGoogleUser(tx, 'google-subject-again');

    // Assert
    expect(second).toEqual(first);
    expect(await tx.$count(appUser, eq(appUser.externalSubject, 'google-subject-again'))).toBe(1);
  }));

  it('Should_CreateNewUser_When_PreviousAccountWasAnonymised', () => withRollback(async (tx) => {
    // Arrange
    const deleted = await findOrCreateGoogleUser(tx, 'google-subject-returning');
    await anonymiseUser(tx, deleted.id);

    // Act
    const returning = await findOrCreateGoogleUser(tx, 'google-subject-returning');

    // Assert
    expect(returning.id).not.toBe(deleted.id);
  }));
});

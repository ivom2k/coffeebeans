import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { appUser } from '../../db/schema/index.ts';
import { anonymiseUser, closeTestDb, createUser, withRollback } from '../../db/tests/helpers.ts';
import { findActiveUser } from './findActiveUser.ts';

describe('findActiveUser', () => {
  afterAll(closeTestDb);

  it('Should_ReturnIdAndRole_When_UserIsActive', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);

    // Act
    const found = await findActiveUser(tx, user.id);

    // Assert
    expect(found).toEqual({ id: user.id, role: 'USER' });
  }));

  it('Should_ReturnNull_When_UserIsAnonymised', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    await anonymiseUser(tx, user.id);

    // Act
    const found = await findActiveUser(tx, user.id);

    // Assert
    expect(found).toBeNull();
  }));

  it('Should_ReturnNull_When_UserRowIsDeleted', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    await tx.delete(appUser).where(eq(appUser.id, user.id));

    // Act
    const found = await findActiveUser(tx, user.id);

    // Assert
    expect(found).toBeNull();
  }));
});

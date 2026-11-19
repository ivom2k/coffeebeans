import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { feedback } from '../../db/schema/index.ts';
import { closeTestDb, createUser, withRollback } from '../../db/tests/helpers.ts';
import { listFeedback } from './listFeedback.ts';

describe('listFeedback', () => {
  afterAll(closeTestDb);

  it('Should_ListNewestFirstWithOnlyWhetherTheSenderWasSignedIn_When_ReadingAStatus', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    await tx.insert(feedback).values([
      { message: 'Vanem', ipHmac: 'a'.repeat(64), createdAt: sql`now() - interval '1 hour'` },
      { message: 'Uuem', userId: user.id, pagePath: '/' },
      { message: 'Loetud', status: 'READ' },
    ]);

    // Act
    const items = await listFeedback(tx, 'NEW');

    // Assert
    expect(items).toEqual([
      { id: expect.any(Number), message: 'Uuem', pagePath: '/', signedIn: true, status: 'NEW', createdAt: expect.any(String) },
      { id: expect.any(Number), message: 'Vanem', pagePath: null, signedIn: false, status: 'NEW', createdAt: expect.any(String) },
    ]);
  }));

  it('Should_HoldNeitherTheHashNorTheAccount_When_Serialised', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    await tx.insert(feedback).values([{ message: 'A', ipHmac: 'f'.repeat(64) }, { message: 'B', userId: user.id }]);

    // Act
    const json = JSON.stringify(await listFeedback(tx, 'NEW'));

    // Assert
    expect(json).not.toMatch(/ipHmac|ip_hmac|userId|user_id/);
    expect(json).not.toContain('f'.repeat(64));
  }));
});

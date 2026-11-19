import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { Database } from '../../db/client.ts';
import { feedback } from '../../db/schema/index.ts';
import { closeTestDb, createUser, withRollback } from '../../db/tests/helpers.ts';
import { sendFeedback, type FeedbackSender } from './sendFeedback.ts';

const limits = { perSenderPerDay: 2, sitePerDay: 4 };
const visitor = (letter: string): FeedbackSender => ({ kind: 'visitor', ipHmac: letter.repeat(64) });

const send = (tx: Database, sender: FeedbackSender, message = 'Tere') =>
  sendFeedback(tx, { message, pagePath: '/kohv/x', sender }, limits);

// One multi-row INSERT: a transaction is a single connection, so no queries in parallel.
const insertEarlier = (tx: Database, count: number, ipHmac: string | null, hoursAgo: number) =>
  tx.insert(feedback).values(Array.from({ length: count }, () => ({
    message: 'Varem',
    ipHmac,
    createdAt: sql`now() - make_interval(hours => ${hoursAgo})`,
  })));

describe('sendFeedback', () => {
  afterAll(closeTestDb);

  it('Should_StoreTheHashAndNoUser_When_AVisitorSends', () => withRollback(async (tx) => {
    // Act
    const result = await send(tx, visitor('a'), 'Vale röstiaste');

    // Assert
    expect(result).toEqual({ kind: 'sent' });
    expect(await tx.select().from(feedback)).toMatchObject([
      { message: 'Vale röstiaste', pagePath: '/kohv/x', userId: null, ipHmac: 'a'.repeat(64), status: 'NEW' },
    ]);
  }));

  it('Should_StoreTheUserAndNoHash_When_ASignedInUserSends', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);

    // Act
    const result = await send(tx, { kind: 'user', userId: user.id });

    // Assert
    expect(result).toEqual({ kind: 'sent' });
    expect(await tx.select().from(feedback)).toMatchObject([{ userId: user.id, ipHmac: null }]);
  }));

  it('Should_RefuseTheSender_When_TheyReachedTheirDailyLimit', () => withRollback(async (tx) => {
    // Arrange
    await send(tx, visitor('a'));
    await send(tx, visitor('a'));

    // Act
    const sameSender = await send(tx, visitor('a'));
    const otherSender = await send(tx, visitor('b'));

    // Assert
    expect([sameSender, otherSender]).toEqual([{ kind: 'senderLimit' }, { kind: 'sent' }]);
    expect(await tx.$count(feedback, eq(feedback.ipHmac, 'a'.repeat(64)))).toBe(2);
  }));

  it('Should_CountAUserByTheirAccount_When_TheySendAgain', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const sender: FeedbackSender = { kind: 'user', userId: user.id };
    await send(tx, sender);
    await send(tx, sender);

    // Act
    const result = await send(tx, sender);

    // Assert
    expect(result).toEqual({ kind: 'senderLimit' });
  }));

  it('Should_LeaveOutOlderMessages_When_CountingTheLastDay', () => withRollback(async (tx) => {
    // Arrange: more than either limit, all from yesterday.
    await insertEarlier(tx, 5, 'a'.repeat(64), 25);

    // Act
    const result = await send(tx, visitor('a'));

    // Assert
    expect(result).toEqual({ kind: 'sent' });
  }));

  it('Should_RefuseEveryone_When_TheSiteReachedItsDailyLimit', () => withRollback(async (tx) => {
    // Arrange: from senders who no longer have a hash, as after the purge or an account deletion.
    await insertEarlier(tx, limits.sitePerDay, null, 1);

    // Act
    const result = await send(tx, visitor('c'));

    // Assert
    expect(result).toEqual({ kind: 'siteLimit' });
    expect(await tx.$count(feedback)).toBe(limits.sitePerDay);
  }));
});

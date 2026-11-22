import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { Database } from '../../db/client.ts';
import { suggestion } from '../../db/schema/index.ts';
import { closeTestDb, createBrand, createCoffee, createMachineModel, createUser, withRollback } from '../../db/tests/helpers.ts';
import { countUnreadOutcomes, listMySuggestions, markOutcomesSeen, markSeenSchema, mySuggestionsLimit } from './mySuggestions.ts';

afterAll(closeTestDb);

type Insert = typeof suggestion.$inferInsert;

const coffeeSuggestion = (userId: number, name: string, extra: Partial<Insert> = {}): Insert =>
  ({ suggestionType: 'COFFEE_BEAN', userId, details: { name, url: null }, ...extra });

// A minute ago: marking as seen stamps the transaction's start, which must not come before the
// review (suggestion_seen_chk).
const reviewed = (extra: Partial<Insert>): Partial<Insert> => ({ reviewedAt: new Date(Date.now() - 60_000), ...extra });

const add = async (tx: Database, row: Insert) => {
  const [inserted] = await tx.insert(suggestion).values(row).returning({ id: suggestion.id });
  return inserted?.id ?? 0;
};

describe('listMySuggestions', () => {
  it('Should_ShowEachOutcome_When_TheSuggestionsWereReviewed', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const brand = await createBrand(tx, { name: 'Norrsken' });
    const published = await createCoffee(tx, { brandId: brand.id, name: 'Mörkrost', slug: 'norrsken-morkrost' });
    const model = await createMachineModel(tx, { name: 'E8' });
    await add(tx, coffeeSuggestion(user.id, 'waiting', { createdAt: new Date('2026-11-01') }));
    await add(tx, coffeeSuggestion(user.id, 'added', reviewed({ status: 'APPROVED', resultingCoffeeBeanId: published.id, createdAt: new Date('2026-11-02') })));
    await add(tx, coffeeSuggestion(user.id, 'rejected', reviewed({
      status: 'REJECTED', reviewReason: 'NOT_WHOLE_BEANS', reviewNote: 'Kapslid', createdAt: new Date('2026-11-03'),
    })));
    await add(tx, {
      suggestionType: 'MACHINE_MODEL',
      userId: user.id,
      details: { manufacturer: 'Jura', model: 'E8', kind: 'AUTOMATIC' },
      ...reviewed({ status: 'DUPLICATE', resultingMachineModelId: model.id, createdAt: new Date('2026-11-04') }),
    });

    // Act
    const list = await listMySuggestions(tx, user.id);

    // Assert: newest first.
    expect(list.map(item => item.outcome)).toEqual([
      { kind: 'exists', machine: { manufacturerName: expect.any(String), modelName: 'E8' } },
      { kind: 'rejected', reason: 'NOT_WHOLE_BEANS', note: 'Kapslid' },
      { kind: 'added', coffee: { slug: 'norrsken-morkrost', brandName: 'Norrsken', name: 'Mörkrost' } },
      { kind: 'waiting' },
    ]);
    expect(list.map(item => item.unread)).toEqual([true, true, true, false]);
    expect(list[3]).toMatchObject({ type: 'COFFEE_BEAN', details: { name: 'waiting', url: null } });
  }));

  it('Should_ListOnlyTheCallersOwn_When_AnotherUserHasSuggestionsToo', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const other = await createUser(tx);
    await add(tx, coffeeSuggestion(user.id, 'mine'));
    await add(tx, coffeeSuggestion(other.id, 'theirs'));

    // Act
    const list = await listMySuggestions(tx, user.id);

    // Assert
    expect(list.map(item => item.details)).toEqual([{ name: 'mine', url: null }]);
  }));

  it('Should_ShowWaitingWithoutTheCoffee_When_TheApprovedCoffeeIsStillADraft', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const draft = await createCoffee(tx, { status: 'DRAFT', name: 'Secret draft', slug: 'secret-draft' });
    await add(tx, coffeeSuggestion(user.id, 'sent', reviewed({ status: 'APPROVED', resultingCoffeeBeanId: draft.id })));
    await add(tx, coffeeSuggestion(user.id, 'sent again', reviewed({ status: 'DUPLICATE', resultingCoffeeBeanId: draft.id })));

    // Act
    const list = await listMySuggestions(tx, user.id);

    // Assert
    expect(list.map(item => [item.outcome, item.unread])).toEqual([[{ kind: 'waiting' }, false], [{ kind: 'waiting' }, false]]);
    expect(JSON.stringify(list)).not.toMatch(/Secret draft|secret-draft/);
  }));

  it('Should_ShowAnUnseenOutcome_When_ItIsOlderThanTheNewestFifty', () => withRollback(async (tx) => {
    // Arrange: an old suggestion reviewed only now, behind a full list of newer ones.
    const user = await createUser(tx);
    await add(tx, coffeeSuggestion(user.id, 'old', reviewed({ status: 'REJECTED', reviewReason: 'OTHER', createdAt: new Date('2026-01-01') })));
    await tx.insert(suggestion).values(Array.from({ length: mySuggestionsLimit }, (_, day) =>
      coffeeSuggestion(user.id, `newer ${day}`, { createdAt: new Date(Date.UTC(2026, 10, 1, 0, day)) })));

    // Act
    const list = await listMySuggestions(tx, user.id);

    // Assert: still newest first, with the old one last instead of the oldest of the newer ones.
    expect(list).toHaveLength(mySuggestionsLimit);
    expect(list.at(-1)).toMatchObject({ details: { name: 'old' }, unread: true });
    expect(list[0]?.details).toEqual({ name: `newer ${mySuggestionsLimit - 1}`, url: null });
  }));
});

describe('the unread marker', () => {
  it('Should_CountReviewedUnseenOutcomesOnly_When_SomeAreWaitingOnADraft', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const published = await createCoffee(tx);
    const draft = await createCoffee(tx, { status: 'DRAFT' });
    await add(tx, coffeeSuggestion(user.id, 'pending'));
    await add(tx, coffeeSuggestion(user.id, 'rejected', reviewed({ status: 'REJECTED', reviewReason: 'OTHER' })));
    await add(tx, coffeeSuggestion(user.id, 'added', reviewed({ status: 'APPROVED', resultingCoffeeBeanId: published.id })));
    await add(tx, coffeeSuggestion(user.id, 'draft', reviewed({ status: 'APPROVED', resultingCoffeeBeanId: draft.id })));
    await add(tx, coffeeSuggestion(user.id, 'seen', reviewed({ status: 'REJECTED', reviewReason: 'OTHER', resultSeenAt: new Date(Date.now() - 30_000) })));

    // Act
    const count = await countUnreadOutcomes(tx, user.id);

    // Assert
    expect(count).toBe(2);
  }));

  it('Should_MarkOnlyTheCallersVisibleOutcomes_When_Seen', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const other = await createUser(tx);
    const draft = await createCoffee(tx, { status: 'DRAFT' });
    const mine = await add(tx, coffeeSuggestion(user.id, 'mine', reviewed({ status: 'REJECTED', reviewReason: 'OTHER' })));
    const waitingOnDraft = await add(tx, coffeeSuggestion(user.id, 'draft', reviewed({ status: 'APPROVED', resultingCoffeeBeanId: draft.id })));
    const theirs = await add(tx, coffeeSuggestion(other.id, 'theirs', reviewed({ status: 'REJECTED', reviewReason: 'OTHER' })));

    // Act: the page sends what it showed; another's id slipped in marks nothing.
    const marked = await markOutcomesSeen(tx, user.id, [mine, waitingOnDraft, theirs]);

    // Assert: the draft's stays unseen, so its marker appears once the coffee is published.
    expect(marked).toBe(1);
    const seen = async (id: number) =>
      (await tx.select({ seenAt: suggestion.resultSeenAt }).from(suggestion).where(eq(suggestion.id, id)))[0]?.seenAt ?? null;
    expect(await seen(mine)).not.toBeNull();
    expect(await seen(waitingOnDraft)).toBeNull();
    expect(await seen(theirs)).toBeNull();
    expect(await countUnreadOutcomes(tx, user.id)).toBe(0);
    expect(await countUnreadOutcomes(tx, other.id)).toBe(1);
  }));

  it('Should_KeepTheMarker_When_AnOutcomeArrivedAfterTheListWasShown', () => withRollback(async (tx) => {
    // Arrange: the page showed the first; the second was reviewed a moment later.
    const user = await createUser(tx);
    const shown = await add(tx, coffeeSuggestion(user.id, 'shown', reviewed({ status: 'REJECTED', reviewReason: 'OTHER' })));
    const later = await add(tx, coffeeSuggestion(user.id, 'later', reviewed({ status: 'REJECTED', reviewReason: 'OTHER' })));

    // Act
    const marked = await markOutcomesSeen(tx, user.id, [shown]);

    // Assert
    expect(marked).toBe(1);
    const [laterRow] = await tx.select({ seenAt: suggestion.resultSeenAt }).from(suggestion).where(eq(suggestion.id, later));
    expect(laterRow?.seenAt).toBeNull();
    expect(await countUnreadOutcomes(tx, user.id)).toBe(1);
  }));

  it('Should_MarkNothing_When_NoIdsAreSent', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    await add(tx, coffeeSuggestion(user.id, 'unseen', reviewed({ status: 'REJECTED', reviewReason: 'OTHER' })));

    // Act
    const marked = await markOutcomesSeen(tx, user.id, []);

    // Assert
    expect(marked).toBe(0);
    expect(await countUnreadOutcomes(tx, user.id)).toBe(1);
  }));
});

describe('markSeenSchema', () => {
  it.each([
    ['no ids', {}],
    ['an id that is not a whole number', { ids: [1.5] }],
    ['more ids than the list shows', { ids: Array.from({ length: mySuggestionsLimit + 1 }, (_, index) => index + 1) }],
    ['a key nobody expects', { ids: [1], all: true }],
  ])('Should_RefuseTheBody_When_ItHolds %s', (_case, body) => {
    // Act
    const parsed = markSeenSchema.safeParse(body);

    // Assert
    expect(parsed.success).toBe(false);
  });
});

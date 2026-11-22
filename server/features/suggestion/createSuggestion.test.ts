import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SuggestionInput } from '../../../shared/types/suggestion.ts';
import type { Database } from '../../db/client.ts';
import { appUser, suggestion } from '../../db/schema/index.ts';
import { closeTestDb, committedDb, createUser, withRollback } from '../../db/tests/helpers.ts';
import { gifImage, hugeClaimedPng, sidewaysPhotoWithLocation } from '../../tests/images.ts';
import { canSuggestNow, createSuggestion, type SuggestionLimits } from './createSuggestion.ts';

const limits: SuggestionLimits = { pendingPerAccount: 3, newPerAccountPerDay: 4, pendingSiteWide: 6, pendingPhotosSiteWide: 2 };
const coffee: SuggestionInput = { suggestionType: 'COFFEE_BEAN', name: 'Valtorre Crema', url: null };
const machine: SuggestionInput = { suggestionType: 'MACHINE_MODEL', manufacturer: 'Jura', model: 'E8', kind: null };
const dayAgo = 24 * 60 * 60 * 1000;

let privateDir: string;
beforeAll(async () => {
  privateDir = await mkdtemp(join(tmpdir(), 'kohvioad-suggestions-'));
});
afterAll(async () => {
  await rm(privateDir, { recursive: true, force: true });
  await closeTestDb();
});

const storedFiles = async () => {
  try {
    return await readdir(join(privateDir, 'suggestion'));
  } catch {
    return [];
  }
};

// Rows inserted directly, as earlier suggestions of the same user.
const addSuggestions = async (tx: Database, userId: number, count: number, extra: Partial<typeof suggestion.$inferInsert> = {}) => {
  if (count > 0) {
    await tx.insert(suggestion).values(Array.from({ length: count }, () => ({
      suggestionType: 'COFFEE_BEAN' as const, userId, details: { name: 'Earlier', url: null }, ...extra,
    })));
  }
};

const rejected = (createdAt: Date) =>
  ({ status: 'REJECTED' as const, reviewReason: 'OTHER' as const, reviewedAt: new Date(), createdAt });

describe('createSuggestion', () => {
  it('Should_StoreTheDetails_When_ACoffeeHasANameOnly', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);

    // Act
    const result = await createSuggestion(tx, privateDir, { userId: user.id, input: coffee, photo: null }, limits);

    // Assert
    expect(result.kind).toBe('created');
    const rows = await tx.select().from(suggestion).where(eq(suggestion.userId, user.id));
    expect(rows).toMatchObject([{
      suggestionType: 'COFFEE_BEAN', status: 'PENDING', details: { name: 'Valtorre Crema', url: null }, imagePath: null,
    }]);
  }));

  it('Should_StoreAnUprightWebpWithoutMetadata_When_ThePhotoHasGpsAndAnOrientation', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const photo = await sidewaysPhotoWithLocation();

    // Act
    const result = await createSuggestion(tx, privateDir, {
      userId: user.id, input: { ...coffee, name: null }, photo,
    }, limits);

    // Assert
    expect(result.kind).toBe('created');
    const [row] = await tx.select({ imagePath: suggestion.imagePath }).from(suggestion).where(eq(suggestion.userId, user.id));
    expect(row?.imagePath).toMatch(/^suggestion\/[0-9a-f]{32}\.webp$/);
    const stored = await sharp(await readFile(join(privateDir, row?.imagePath ?? ''))).metadata();
    expect([stored.format, stored.width, stored.height]).toEqual(['webp', 20, 40]);
    expect(stored.exif).toBeUndefined();
  }));

  it('Should_FitThePhotoInside1600Pixels_When_ItIsLarger', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const photo = await sharp({ create: { width: 3200, height: 1200, channels: 3, background: '#3557B7' } }).jpeg().toBuffer();

    // Act
    await createSuggestion(tx, privateDir, { userId: user.id, input: coffee, photo }, limits);

    // Assert
    const [row] = await tx.select({ imagePath: suggestion.imagePath }).from(suggestion).where(eq(suggestion.userId, user.id));
    const stored = await sharp(await readFile(join(privateDir, row?.imagePath ?? ''))).metadata();
    expect([stored.width, stored.height]).toEqual([1600, 600]);
  }));

  it('Should_RefuseAndStoreNothing_When_TheCoffeeHasNoNameLinkOrPhoto', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);

    // Act
    const result = await createSuggestion(tx, privateDir, {
      userId: user.id, input: { suggestionType: 'COFFEE_BEAN', name: null, url: null }, photo: null,
    }, limits);

    // Assert
    expect(result).toEqual({ kind: 'empty' });
    expect(await tx.$count(suggestion, eq(suggestion.userId, user.id))).toBe(0);
  }));

  it('Should_RefuseThePhoto_When_TheSuggestionIsAMachine', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);

    // Act
    const result = await createSuggestion(tx, privateDir, {
      userId: user.id, input: machine, photo: await sidewaysPhotoWithLocation(),
    }, limits);

    // Assert
    expect(result).toEqual({ kind: 'photoNotTaken' });
  }));

  it.each([
    ['a GIF', gifImage, 'unsupported'],
    ['a web page', async () => Buffer.from('<!doctype html><script>alert(1)</script>'), 'unsupported'],
    ['a decompression bomb', async () => hugeClaimedPng(), 'tooLarge'],
    [
      'over 16 megapixels',
      () => sharp({ create: { width: 4250, height: 4000, channels: 3, background: '#000000' } }).jpeg().toBuffer(),
      'tooLarge',
    ],
  ] as const)('Should_RefuseThePhoto_When_ItIs %s', (_case, makePhoto, expected) => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const filesBefore = await storedFiles();

    // Act
    const result = await createSuggestion(tx, privateDir, { userId: user.id, input: coffee, photo: await makePhoto() }, limits);

    // Assert
    expect(result).toEqual({ kind: expected });
    expect(await tx.$count(suggestion, eq(suggestion.userId, user.id))).toBe(0);
    expect(await storedFiles()).toEqual(filesBefore);
  }));
});

describe('the caps', () => {
  it('Should_RefuseTheNext_When_TheAccountHasAsManyWaitingAsItMay', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    await addSuggestions(tx, user.id, limits.pendingPerAccount - 1);
    const lastOne = await createSuggestion(tx, privateDir, { userId: user.id, input: coffee, photo: null }, limits);

    // Act
    const refused = await createSuggestion(tx, privateDir, { userId: user.id, input: coffee, photo: null }, limits);

    // Assert
    expect([lastOne.kind, refused.kind]).toEqual(['created', 'accountLimit']);
    expect(await canSuggestNow(tx, user.id, limits)).toBe('accountLimit');
  }));

  it('Should_RefuseTheNext_When_TheAccountSentItsDailyCountOfAnyOutcome', () => withRollback(async (tx) => {
    // Arrange: reviewed ones count too, or an account could send one, wait for a rejection, repeat.
    const user = await createUser(tx);
    await addSuggestions(tx, user.id, limits.newPerAccountPerDay, rejected(new Date()));

    // Act
    const result = await createSuggestion(tx, privateDir, { userId: user.id, input: coffee, photo: null }, limits);

    // Assert
    expect(result).toEqual({ kind: 'dailyLimit' });
  }));

  it('Should_TakeTheSuggestion_When_TheEarlierOnesAreOlderThanADay', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    await addSuggestions(tx, user.id, limits.newPerAccountPerDay, rejected(new Date(Date.now() - dayAgo - 60_000)));

    // Act
    const result = await createSuggestion(tx, privateDir, { userId: user.id, input: coffee, photo: null }, limits);

    // Assert
    expect(result.kind).toBe('created');
  }));

  it('Should_RefuseEveryone_When_TheSiteQueueIsFull', () => withRollback(async (tx) => {
    // Arrange: spread over other accounts, each under its own cap.
    const others = [await createUser(tx), await createUser(tx)];
    for (const other of others) {
      await addSuggestions(tx, other.id, limits.pendingSiteWide / others.length);
    }
    const user = await createUser(tx);

    // Act
    const result = await createSuggestion(tx, privateDir, { userId: user.id, input: coffee, photo: null }, limits);

    // Assert
    expect(result).toEqual({ kind: 'queueFull' });
    expect(await canSuggestNow(tx, user.id, limits)).toBe('queueFull');
  }));

  it('Should_RefuseOnlyAPhoto_When_ThePhotoQueueIsFull', () => withRollback(async (tx) => {
    // Arrange
    const other = await createUser(tx);
    await addSuggestions(tx, other.id, limits.pendingPhotosSiteWide, { imagePath: `suggestion/${'a'.repeat(32)}.webp` });
    const user = await createUser(tx);
    const filesBefore = await storedFiles();

    // Act
    const withPhoto = await createSuggestion(tx, privateDir, {
      userId: user.id, input: coffee, photo: await sidewaysPhotoWithLocation(),
    }, limits);
    const withoutPhoto = await createSuggestion(tx, privateDir, { userId: user.id, input: coffee, photo: null }, limits);

    // Assert: the photo it had already written is gone again.
    expect([withPhoto.kind, withoutPhoto.kind]).toEqual(['photoQueueFull', 'created']);
    expect(await storedFiles()).toEqual(filesBefore);
  }));

  it('Should_LetOnlyOneThrough_When_TwoArriveAtOnceForTheLastPlace', async () => {
    // Arrange: committed, since each request runs in a transaction of its own.
    const user = await createUser(committedDb);
    const oneLeft = { ...limits, pendingPerAccount: 1 };

    try {
      // Act
      const results = await Promise.all([
        createSuggestion(committedDb, privateDir, { userId: user.id, input: coffee, photo: null }, oneLeft),
        createSuggestion(committedDb, privateDir, { userId: user.id, input: coffee, photo: null }, oneLeft),
      ]);

      // Assert
      expect(results.map(result => result.kind).toSorted()).toEqual(['accountLimit', 'created']);
      expect(await committedDb.$count(suggestion, eq(suggestion.userId, user.id))).toBe(1);
    } finally {
      await committedDb.delete(suggestion).where(eq(suggestion.userId, user.id));
      await committedDb.delete(appUser).where(eq(appUser.id, user.id));
    }
  });
});

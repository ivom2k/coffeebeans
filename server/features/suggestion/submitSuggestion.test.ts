import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../db/client.ts';
import { suggestion } from '../../db/schema/index.ts';
import { closeTestDb, createUser, withRollback } from '../../db/tests/helpers.ts';
import { sidewaysPhotoWithLocation, truncatedPhoto } from '../../tests/images.ts';
import type { SuggestionLimits } from './createSuggestion.ts';
import { submitSuggestion } from './submitSuggestion.ts';

const limits: SuggestionLimits = { pendingPerAccount: 3, newPerAccountPerDay: 4, pendingSiteWide: 6, pendingPhotosSiteWide: 2 };
const coffee = { suggestionType: 'COFFEE_BEAN', name: 'Valtorre Crema', url: null };

let privateDir: string;
beforeAll(async () => {
  privateDir = await mkdtemp(join(tmpdir(), 'kohvioad-submit-'));
});
afterAll(async () => {
  await rm(privateDir, { recursive: true, force: true });
  await closeTestDb();
});

const storedFiles = async () => {
  try {
    return await readdir(join(privateDir, 'suggestion'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

// The form as the browser sends it, already parsed.
const formOf = (details: unknown, photo?: Buffer, extra: [string, string][] = []) => {
  const form = new FormData();
  form.append('details', JSON.stringify(details));
  if (photo) {
    form.append('photo', new Blob([new Uint8Array(photo)], { type: 'image/jpeg' }), 'hinnasilt.jpg');
  }
  extra.forEach(([name, value]) => form.append(name, value));
  return form;
};

// A request that is still connected, and a form that arrives when the test says so.
const submission = (userId: number, readForm: () => Promise<FormData>) =>
  ({ userId, privateDir, request: new IncomingMessage(new Socket()), readForm });

const arriving = () => {
  const { promise, resolve } = Promise.withResolvers<FormData>();
  return { readForm: () => promise, arrive: resolve };
};

const fillPhotoQueue = async (tx: Database) => {
  const other = await createUser(tx);
  await tx.insert(suggestion).values(Array.from({ length: limits.pendingPhotosSiteWide }, () => ({
    suggestionType: 'COFFEE_BEAN' as const, userId: other.id, details: { name: 'Earlier', url: null }, imagePath: `suggestion/${'a'.repeat(32)}.webp`,
  })));
};

describe('submitSuggestion', () => {
  it('Should_CreateTheSuggestionWithItsPhoto_When_TheFormIsComplete', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const form = formOf(coffee, await sidewaysPhotoWithLocation());

    // Act
    const result = await submitSuggestion(tx, submission(user.id, async () => form), limits);

    // Assert
    expect(result.kind).toBe('created');
    const [row] = await tx.select({ imagePath: suggestion.imagePath }).from(suggestion).where(eq(suggestion.userId, user.id));
    expect(row?.imagePath).toMatch(/^suggestion\/[0-9a-f]{32}\.webp$/);
  }));

  it('Should_NotReceiveTheForm_When_TheAccountHasAsManyWaitingAsItMay', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    await tx.insert(suggestion).values(Array.from({ length: limits.pendingPerAccount }, () => ({
      suggestionType: 'COFFEE_BEAN' as const, userId: user.id, details: { name: 'Earlier', url: null },
    })));
    const readForm = vi.fn(async () => formOf(coffee));

    // Act
    const result = await submitSuggestion(tx, submission(user.id, readForm), limits);

    // Assert
    expect(result).toEqual({ kind: 'accountLimit' });
    expect(readForm).not.toHaveBeenCalled();
  }));

  it('Should_RefuseBeforeDecoding_When_ThePhotoQueueIsFull', () => withRollback(async (tx) => {
    // Arrange: a photo that a decode would refuse as unsupported, so only the early cap check
    // can answer photoQueueFull.
    await fillPhotoQueue(tx);
    const user = await createUser(tx);
    const filesBefore = await storedFiles();

    // Act
    const result = await submitSuggestion(tx, submission(user.id, async () => formOf(coffee, await truncatedPhoto())), limits);

    // Assert
    expect(result).toEqual({ kind: 'photoQueueFull' });
    expect(await storedFiles()).toEqual(filesBefore);
  }));

  it('Should_RefuseThePhotoAs422_When_ItIsCutOffHalfway', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);

    // Act
    const result = await submitSuggestion(tx, submission(user.id, async () => formOf(coffee, await truncatedPhoto())), limits);

    // Assert: an answer the form can explain, where the encode used to throw.
    expect(result).toEqual({ kind: 'unsupported' });
    expect(await tx.$count(suggestion, eq(suggestion.userId, user.id))).toBe(0);
  }));

  it('Should_SayInProgress_When_TheAccountsPreviousFormIsStillArriving', () => withRollback(async (tx) => {
    // Arrange: the first has taken its place once it starts reading.
    const user = await createUser(tx);
    const first = arriving();
    const firstRead = vi.fn(first.readForm);
    const running = submitSuggestion(tx, submission(user.id, firstRead), limits);
    await vi.waitFor(() => expect(firstRead).toHaveBeenCalled());

    // Act
    const second = await submitSuggestion(tx, submission(user.id, async () => formOf(coffee)), limits);
    first.arrive(formOf(coffee));

    // Assert: the first goes through once its form has arrived, and only the first.
    expect(second).toEqual({ kind: 'inProgress' });
    expect((await running).kind).toBe('created');
    expect(await tx.$count(suggestion, eq(suggestion.userId, user.id))).toBe(1);
  }));

  it('Should_FreeThePlace_When_TheFormTakesTooLong', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const neverArrives = () => new Promise<FormData>(() => {});

    // Act
    const slow = await submitSuggestion(tx, submission(user.id, neverArrives), limits, 10);
    const next = await submitSuggestion(tx, submission(user.id, async () => formOf(coffee)), limits);

    // Assert
    expect([slow.kind, next.kind]).toEqual(['timedOut', 'created']);
  }));

  it('Should_SayUnreadable_When_TheParserFails', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);

    // Act
    const result = await submitSuggestion(tx, submission(user.id, () => Promise.reject(new TypeError('Failed to parse body as FormData'))), limits);

    // Assert
    expect(result).toEqual({ kind: 'unreadable' });
  }));

  it('Should_RefuseTheForm_When_ItHoldsAPartNobodyAskedFor', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);

    // Act
    const result = await submitSuggestion(tx, submission(user.id, async () => formOf(coffee, undefined, [['website', 'https://spam.example']])), limits);

    // Assert
    expect(result).toEqual({ kind: 'formRefused', status: 400, reason: 'unexpectedPart' });
  }));
});

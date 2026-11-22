import { and, eq, gt, isNotNull, sql } from 'drizzle-orm';
import type { SuggestionInput } from '../../../shared/types/suggestion.ts';
import type { Database } from '../../db/client.ts';
import { suggestion } from '../../db/schema/index.ts';
import { processSuggestionPhoto } from './processSuggestionPhoto.ts';
import { toStoredDetails, takesPhoto } from './suggestionInput.ts';
import { newPhotoPath, removePhoto, writePhoto } from './suggestionPhotoFiles.ts';

export type SuggestionLimits = {
  pendingPerAccount: number;
  newPerAccountPerDay: number;
  pendingSiteWide: number;
  pendingPhotosSiteWide: number;
};

export type SuggestionCounts = { pendingMine: number; newMineToday: number; pendingAll: number; pendingPhotos: number };

export type CapRefusal = 'accountLimit' | 'dailyLimit' | 'queueFull' | 'photoQueueFull';

// Which cap, if any, a new suggestion would break. The photo cap only matters for one with a photo:
// a full photo queue still takes a suggestion without one.
export const capRefusal = (counts: SuggestionCounts, limits: SuggestionLimits, withPhoto: boolean): CapRefusal | null => {
  if (counts.pendingMine >= limits.pendingPerAccount) {
    return 'accountLimit';
  }
  if (counts.newMineToday >= limits.newPerAccountPerDay) {
    return 'dailyLimit';
  }
  if (counts.pendingAll >= limits.pendingSiteWide) {
    return 'queueFull';
  }
  if (withPhoto && counts.pendingPhotos >= limits.pendingPhotosSiteWide) {
    return 'photoQueueFull';
  }
  return null;
};

// Four small counts rather than one pass with FILTER, so each can use its index: the user's
// (suggestion_user_id_idx) or the pending queue's (suggestion_pending_idx).
const countSuggestions = async (db: Database, userId: number): Promise<SuggestionCounts> => {
  const mine = eq(suggestion.userId, userId);
  const pending = eq(suggestion.status, 'PENDING');
  return {
    pendingMine: await db.$count(suggestion, and(mine, pending)),
    newMineToday: await db.$count(suggestion, and(mine, gt(suggestion.createdAt, sql`now() - interval '24 hours'`))),
    pendingAll: await db.$count(suggestion, pending),
    pendingPhotos: await db.$count(suggestion, and(pending, isNotNull(suggestion.imagePath))),
  };
};

// The caps without a lock, for submitSuggestion to refuse early: before the body is read, a full
// account or queue never has its form received; once the form shows a photo, a full photo queue
// never has it decoded. createSuggestion counts again under the lock.
export const canSuggestNow = async (
  db: Database,
  userId: number,
  limits: SuggestionLimits,
  withPhoto = false,
): Promise<CapRefusal | null> => capRefusal(await countSuggestions(db, userId), limits, withPhoto);

export type CreateSuggestionResult
  = | { kind: 'created'; id: number }
    | { kind: CapRefusal }
    // A coffee with no name, no link and no photo: nothing to go on (decisions log §4).
    | { kind: 'empty' }
    // A photo with a machine suggestion, which has no price tag.
    | { kind: 'photoNotTaken' }
    | { kind: 'unsupported' }
    | { kind: 'tooLarge' };

type NewSuggestion = { userId: number; input: SuggestionInput; photo: Buffer | null };

// A refused or failed insert leaves no file behind. A file that can't be removed is left to the
// nightly sweep (Phase 7.4); the error that matters is the one that stopped the insert.
const discardPhoto = async (privateDir: string, photoPath: string | null) => {
  if (photoPath === null) {
    return;
  }
  try {
    await removePhoto(privateDir, photoPath);
  } catch (error) {
    console.error(`Suggestion photo not removed: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
};

const storePhoto = async (privateDir: string, photo: Buffer) => {
  const processed = await processSuggestionPhoto(photo);
  if (processed.kind !== 'processed') {
    return processed;
  }
  const photoPath = newPhotoPath();
  await writePhoto(privateDir, photoPath, processed.photo);
  return { kind: 'stored' as const, photoPath };
};

export const createSuggestion = async (
  db: Database,
  privateDir: string,
  { userId, input, photo }: NewSuggestion,
  limits: SuggestionLimits,
): Promise<CreateSuggestionResult> => {
  if (photo !== null && !takesPhoto(input.suggestionType)) {
    return { kind: 'photoNotTaken' };
  }
  if (input.suggestionType === 'COFFEE_BEAN' && input.name === null && input.url === null && photo === null) {
    return { kind: 'empty' };
  }

  // Decoded and written before the transaction, so the lock below is never held across a decode.
  const stored = photo === null ? null : await storePhoto(privateDir, photo);
  if (stored !== null && stored.kind !== 'stored') {
    return stored;
  }
  const photoPath = stored?.photoPath ?? null;

  try {
    // Inside a caller's transaction this runs as a savepoint.
    const result = await db.transaction(async (tx): Promise<CreateSuggestionResult> => {
      // One lock for every new suggestion, held until commit, so two at once can't both count one
      // below a cap and both insert: the second waits and counts the first's row.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('suggestion'))`);
      const refusal = capRefusal(await countSuggestions(tx, userId), limits, photoPath !== null);
      if (refusal !== null) {
        return { kind: refusal };
      }
      const [row] = await tx.insert(suggestion)
        .values({ suggestionType: input.suggestionType, userId, details: toStoredDetails(input), imagePath: photoPath })
        .returning({ id: suggestion.id });
      if (!row) {
        throw new Error('Suggestion insert returned no row.');
      }
      return { kind: 'created', id: row.id };
    });
    if (result.kind !== 'created') {
      await discardPhoto(privateDir, photoPath);
    }
    return result;
  } catch (error) {
    await discardPhoto(privateDir, photoPath);
    throw error;
  }
};

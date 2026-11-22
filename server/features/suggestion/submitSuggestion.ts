import type { IncomingMessage } from 'node:http';
import { maxSuggestionPhotoBytes } from '../../../shared/utils/suggestion.ts';
import type { Database } from '../../db/client.ts';
import { withImageSlot } from '../media/imageDecoder.ts';
import { createUploadGate } from '../security/uploadGate.ts';
import { readUpload } from '../security/uploadRead.ts';
import { canSuggestNow, createSuggestion, type CreateSuggestionResult, type SuggestionLimits } from './createSuggestion.ts';
import { suggestionInputSchema, takesPhoto } from './suggestionInput.ts';
import { readSuggestionParts } from './suggestionParts.ts';

// A suggestion as it arrives over HTTP: the multipart form, received and taken apart, then
// created. The order is the point, each step before the costlier one after it (decisions log §6):
// the caps, before the body is read; a place to receive it in; the photo cap, once the form shows
// a photo; the decoder's slot, only around the decode.

// How long a form may take to arrive. A photo downsized by the form is a few hundred kilobytes;
// the original it falls back to is up to 6 MB, most of a minute on a store's slow mobile data.
export const uploadDeadlineMs = 60_000;

// Forms received at once. Four hold at most about 25 MB, and as much again while each is parsed.
// Each place is held for at most the deadline, an account gets one, and each account may send ten
// an hour, so keeping all four taken around the clock takes about two dozen accounts. The admin's
// photo has a gate of its own, so they can't keep it out.
export const suggestionUploadPlaces = 4;
const withUploadPlace = createUploadGate({ places: suggestionUploadPlaces });

export type SubmitSuggestionResult
  = | CreateSuggestionResult
    // Every place taken, or the decoder's queue full: come back later.
    | { kind: 'busy' }
    // This account's previous form is still arriving.
    | { kind: 'inProgress' }
    | { kind: 'timedOut' }
    // The client left before the form ended, so nobody reads the answer.
    | { kind: 'aborted' }
    // Bytes the multipart parser couldn't read.
    | { kind: 'unreadable' }
    | { kind: 'formRefused'; status: 400 | 413; reason: string }
    | { kind: 'invalid' };

export type Submission = {
  userId: number;
  privateDir: string;
  // Watched for the client leaving while the form is read.
  request: IncomingMessage;
  // The handler's parser, so this file needs nothing from h3 and runs in plain Vitest.
  readForm: () => Promise<FormData>;
};

const receiveAndCreate = async (
  db: Database,
  { userId, privateDir, request, readForm }: Submission,
  limits: SuggestionLimits,
  deadlineMs: number,
): Promise<SubmitSuggestionResult> => {
  const read = await readUpload(request, readForm, deadlineMs).catch((error: unknown) => {
    // Usually a broken form from the client; the message is kept in case it is the server's.
    console.warn(`Suggestion form not readable: ${error instanceof Error ? error.message : 'unknown error'}`);
    return { kind: 'unreadable' } as const;
  });
  if (read.kind !== 'read') {
    return read;
  }

  const parts = readSuggestionParts(read.value, maxSuggestionPhotoBytes);
  if (!parts.ok) {
    return { kind: 'formRefused', status: parts.status, reason: parts.reason };
  }
  const input = suggestionInputSchema.safeParse(parts.parts.details);
  if (!input.success) {
    return { kind: 'invalid' };
  }

  const { photo } = parts.parts;
  if (photo !== null && takesPhoto(input.data.suggestionType)) {
    const refusal = await canSuggestNow(db, userId, limits, true);
    if (refusal !== null) {
      return { kind: refusal };
    }
  }

  const photoBytes = photo === null ? null : Buffer.from(await photo.arrayBuffer());
  const create = () => createSuggestion(db, privateDir, { userId, input: input.data, photo: photoBytes }, limits);
  if (photoBytes === null) {
    return create();
  }
  // One decode at a time across every upload route. createSuggestion decodes before it takes its
  // lock, so the slot is held for the decode, the file's write and one short transaction.
  const decoded = await withImageSlot(create);
  return decoded.kind === 'ran' ? decoded.value : decoded;
};

export const submitSuggestion = async (
  db: Database,
  submission: Submission,
  limits: SuggestionLimits,
  deadlineMs = uploadDeadlineMs,
): Promise<SubmitSuggestionResult> => {
  // Before the body is read: a full account or queue never has its form received.
  const early = await canSuggestNow(db, submission.userId, limits);
  if (early !== null) {
    return { kind: early };
  }
  const placed = await withUploadPlace(submission.userId, () => receiveAndCreate(db, submission, limits, deadlineMs));
  return placed.kind === 'ran' ? placed.value : placed;
};

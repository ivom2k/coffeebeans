import type { IncomingMessage } from 'node:http';
import { withDeadline } from './deadline.ts';

// Reading an upload's body, which arrives at the client's pace. It ends one of three ways: read
// whole, out of time, or the client gone. A request whose client has left emits its error only
// to listeners already attached, and then nothing more, so a parser that starts listening after
// that waits for an end that never comes: until the deadline, or with no deadline for ever, while
// the upload holds its place (decisions log §6).

export type UploadReadResult<T> = { kind: 'read'; value: T } | { kind: 'timedOut' } | { kind: 'aborted' };

// Gone before its body ended: no more data can arrive.
const clientLeft = (request: IncomingMessage) => request.destroyed && !request.readableEnded;

export const readUpload = async <T>(
  request: IncomingMessage,
  read: () => Promise<T>,
  deadlineMs: number,
): Promise<UploadReadResult<T>> => {
  if (clientLeft(request)) {
    return { kind: 'aborted' };
  }
  // A request closes after its end too, once it has been read; only a close before the end is the
  // client leaving.
  const left = Promise.withResolvers<UploadReadResult<T>>();
  const onClose = () => {
    if (!request.readableEnded) {
      left.resolve({ kind: 'aborted' });
    }
  };
  request.once('close', onClose);
  try {
    const reading = read().then(
      (value): UploadReadResult<T> => ({ kind: 'read', value }),
      // A parser that was already listening sees the client leave as an error: the same answer.
      (error: unknown): UploadReadResult<T> => {
        if (clientLeft(request)) {
          return { kind: 'aborted' };
        }
        throw error;
      },
    );
    const result = await withDeadline(Promise.race([reading, left.promise]), deadlineMs);
    return result.kind === 'timedOut' ? result : result.value;
  } finally {
    request.off('close', onClose);
  }
};

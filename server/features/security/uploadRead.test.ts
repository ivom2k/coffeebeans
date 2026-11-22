import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import { readUpload } from './uploadRead.ts';

// A request as Node's server hands it over, on a socket that never connects: the test pushes the
// body, or destroys it as a client that leaves does.
const newRequest = () => new IncomingMessage(new Socket());

// The way h3 reads a body: listening for its data, its end and an error.
const readBody = (request: IncomingMessage) => () => new Promise<string>((resolve, reject) => {
  const chunks: Buffer[] = [];
  request.on('data', (chunk: Buffer) => chunks.push(chunk));
  request.on('end', () => resolve(Buffer.concat(chunks).toString()));
  request.on('error', reject);
});

// A parser that started listening after the client left: it never hears anything again.
const neverEnds = () => new Promise<string>(() => {});

describe('readUpload', () => {
  it('Should_ReturnTheBody_When_ItArrivesInTime', async () => {
    // Arrange
    const request = newRequest();
    const reading = readUpload(request, readBody(request), 1000);

    // Act
    request.push('form');
    request.push(null);

    // Assert
    expect(await reading).toEqual({ kind: 'read', value: 'form' });
  });

  it('Should_SayAbortedWithoutReading_When_TheClientLeftWhileTheUploadWaited', async () => {
    // Arrange
    const request = newRequest();
    request.destroy();
    const read = vi.fn(neverEnds);

    // Act
    const result = await readUpload(request, read, 60_000);

    // Assert
    expect(result).toEqual({ kind: 'aborted' });
    expect(read).not.toHaveBeenCalled();
  });

  it('Should_SayAbortedAtOnce_When_TheClientLeavesAndTheParserHearsNothing', async () => {
    // Arrange: a deadline far past the test's own timeout, so only the close can end it.
    const request = newRequest();
    const reading = readUpload(request, neverEnds, 60_000);

    // Act
    request.destroy();

    // Assert
    expect(await reading).toEqual({ kind: 'aborted' });
  });

  it('Should_SayAborted_When_TheParserHearsTheClientLeaveAsAnError', async () => {
    // Arrange
    const request = newRequest();
    const reading = readUpload(request, readBody(request), 60_000);
    request.push('half a fo');

    // Act
    request.destroy(new Error('aborted'));

    // Assert
    expect(await reading).toEqual({ kind: 'aborted' });
  });

  it('Should_PassTheFailureOn_When_TheReadFailsWhileTheClientIsStillThere', async () => {
    // Act
    const reading = readUpload(newRequest(), () => Promise.reject(new Error('not a form')), 1000);

    // Assert
    await expect(reading).rejects.toThrow('not a form');
  });

  it('Should_SayTimedOut_When_TheBodyTakesTooLong', async () => {
    // Act
    const result = await readUpload(newRequest(), neverEnds, 10);

    // Assert
    expect(result).toEqual({ kind: 'timedOut' });
  });

  it('Should_LeaveNoListenerBehind_When_TheReadIsDone', async () => {
    // Arrange
    const request = newRequest();
    const before = request.listenerCount('close');

    // Act
    await readUpload(request, async () => 'form', 1000);

    // Assert
    expect(request.listenerCount('close')).toBe(before);
  });
});

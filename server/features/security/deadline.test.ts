import { describe, expect, it } from 'vitest';
import { withDeadline } from './deadline.ts';

const after = <T>(ms: number, value: T) => new Promise<T>(resolve => setTimeout(() => resolve(value), ms));

describe('withDeadline', () => {
  it('Should_ReturnTheResult_When_TheWorkFinishesInTime', async () => {
    // Act
    const result = await withDeadline(after(5, 'form'), 1000);

    // Assert
    expect(result).toEqual({ kind: 'done', value: 'form' });
  });

  it('Should_GiveUp_When_TheWorkTakesTooLong', async () => {
    // Act
    const result = await withDeadline(after(1000, 'form'), 10);

    // Assert
    expect(result).toEqual({ kind: 'timedOut' });
  });

  it('Should_PassTheFailureOn_When_TheWorkFailsInTime', async () => {
    // Act
    const result = withDeadline(Promise.reject(new Error('broken form')), 1000);

    // Assert
    await expect(result).rejects.toThrow('broken form');
  });

  it('Should_SwallowALateFailure_When_TheDeadlineHasPassed', async () => {
    // Arrange: a request destroyed after its deadline makes the read fail afterwards.
    const late = new Promise<string>((_, reject) => setTimeout(() => reject(new Error('aborted')), 20));

    // Act
    const result = await withDeadline(late, 5);
    await after(30, undefined);

    // Assert: Vitest fails the run on an unhandled rejection, so reaching here is the proof.
    expect(result).toEqual({ kind: 'timedOut' });
  });
});

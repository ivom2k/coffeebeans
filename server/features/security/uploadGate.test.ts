import { describe, expect, it } from 'vitest';
import { createUploadGate } from './uploadGate.ts';

// Work that waits until the test lets it finish, like a body still arriving.
const gate = () => {
  const { promise, resolve } = Promise.withResolvers<string>();
  return { wait: () => promise, open: (value: string) => resolve(value) };
};

describe('createUploadGate', () => {
  it('Should_RunTheUploadsOfSeveralAccounts_When_ThereArePlacesForThem', async () => {
    // Arrange
    const withPlace = createUploadGate({ places: 2 });
    const first = gate();
    const second = gate();

    // Act
    const running = [withPlace(1, first.wait), withPlace(2, second.wait)];
    first.open('one');
    second.open('two');

    // Assert
    expect(await Promise.all(running)).toEqual([{ kind: 'ran', value: 'one' }, { kind: 'ran', value: 'two' }]);
  });

  it('Should_SayInProgress_When_TheSameAccountSendsASecondWhileTheFirstArrives', async () => {
    // Arrange: room for more, so only the account rule can refuse it.
    const withPlace = createUploadGate({ places: 4 });
    const first = gate();
    const running = withPlace(1, first.wait);

    // Act
    const second = await withPlace(1, async () => 'second');
    first.open('first');

    // Assert
    expect(second).toEqual({ kind: 'inProgress' });
    expect(await running).toEqual({ kind: 'ran', value: 'first' });
  });

  it('Should_SayBusy_When_EveryPlaceIsTaken', async () => {
    // Arrange
    const withPlace = createUploadGate({ places: 1 });
    const first = gate();
    const running = withPlace(1, first.wait);

    // Act
    const refused = await withPlace(2, async () => 'second');
    first.open('first');
    await running;
    const afterwards = await withPlace(2, async () => 'third');

    // Assert: refused at once rather than queued, and the place is free again afterwards.
    expect(refused).toEqual({ kind: 'busy' });
    expect(afterwards).toEqual({ kind: 'ran', value: 'third' });
  });

  it('Should_FreeThePlace_When_TheUploadFails', async () => {
    // Arrange
    const withPlace = createUploadGate({ places: 1 });
    await expect(withPlace(1, async () => {
      throw new Error('form not readable');
    })).rejects.toThrow('form not readable');

    // Act
    const next = await withPlace(1, async () => 'next');

    // Assert
    expect(next).toEqual({ kind: 'ran', value: 'next' });
  });
});

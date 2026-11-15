import { describe, expect, it } from 'vitest';
import { createRateLimiter, type Bucket } from './rateLimiter.ts';

const feedback: Bucket = { name: 'feedback', limit: 3, windowMs: 60_000 };
const search: Bucket = { name: 'search', limit: 3, windowMs: 1000 };

// A clock the test moves by hand.
const clock = (start = 1_000_000) => {
  let at = start;
  const advance = (ms: number) => {
    at += ms;
  };
  return { now: () => at, advance };
};

const takeTimes = (limiter: ReturnType<typeof createRateLimiter>, bucket: Bucket, subject: string, times: number) =>
  Array.from({ length: times }, () => limiter.take(bucket, subject).allowed);

describe('createRateLimiter', () => {
  it('Should_AllowUpToTheLimit_When_RequestsComeInOneWindow', () => {
    // Arrange
    const limiter = createRateLimiter({ now: clock().now });

    // Act
    const allowed = takeTimes(limiter, feedback, 'a', 4);

    // Assert
    expect(allowed).toEqual([true, true, true, false]);
  });

  it('Should_SayWhenToComeBack_When_TheLimitIsReached', () => {
    // Arrange
    const time = clock();
    const limiter = createRateLimiter({ now: time.now });
    takeTimes(limiter, feedback, 'a', 3);
    time.advance(20_500);

    // Act
    const refused = limiter.take(feedback, 'a');

    // Assert: 39.5 seconds of the minute are left, rounded up.
    expect(refused).toEqual({ allowed: false, retryAfterSeconds: 40 });
  });

  it('Should_AllowAgain_When_TheWindowHasPassed', () => {
    // Arrange
    const time = clock();
    const limiter = createRateLimiter({ now: time.now });
    takeTimes(limiter, feedback, 'a', 4);

    // Act
    time.advance(feedback.windowMs);
    const allowed = takeTimes(limiter, feedback, 'a', 4);

    // Assert
    expect(allowed).toEqual([true, true, true, false]);
  });

  it('Should_CountEachSubjectAlone_When_TwoSubjectsShareABucket', () => {
    // Arrange
    const limiter = createRateLimiter({ now: clock().now });
    takeTimes(limiter, feedback, 'a', 4);

    // Act
    const other = limiter.take(feedback, 'b');

    // Assert
    expect(other).toEqual({ allowed: true });
  });

  it('Should_CountEachBucketAlone_When_OneSubjectUsesTwo', () => {
    // Arrange
    const limiter = createRateLimiter({ now: clock().now });
    takeTimes(limiter, feedback, 'a', 4);

    // Act
    const other = limiter.take(search, 'a');

    // Assert
    expect(other).toEqual({ allowed: true });
  });

  it('Should_NeverHoldMoreThanMaxKeys_When_FloodedWithNewSubjects', () => {
    // Arrange
    const limiter = createRateLimiter({ maxKeys: 100, now: clock().now });

    // Act: every request from a new address, none of them expired.
    for (let subject = 0; subject < 5000; subject++) {
      limiter.take(feedback, String(subject));
    }

    // Assert
    expect(limiter.size()).toBe(100);
  });

  it('Should_DropExpiredWindowsFirst_When_MakingRoom', () => {
    // Arrange: a full map where the long window was opened before the short ones.
    const time = clock();
    const limiter = createRateLimiter({ maxKeys: 3, now: time.now });
    takeTimes(limiter, feedback, 'long', 3);
    limiter.take(search, 'short-1');
    limiter.take(search, 'short-2');
    time.advance(search.windowMs);

    // Act: the short windows have expired, the long one hasn't.
    limiter.take(search, 'new');

    // Assert: the oldest entry survived because it was still counting.
    expect(limiter.take(feedback, 'long').allowed).toBe(false);
    expect(limiter.size()).toBe(2);
  });

  it('Should_KeepARenewedSubjectYoungest_When_TheMapFillsUp', () => {
    // Arrange
    const time = clock();
    const limiter = createRateLimiter({ maxKeys: 2, now: time.now });
    limiter.take(search, 'first');
    limiter.take(feedback, 'second');
    time.advance(search.windowMs);
    // 'first' starts a new window, which makes 'second' the oldest entry.
    takeTimes(limiter, search, 'first', 3);

    // Act
    limiter.take(feedback, 'third');

    // Assert
    expect(limiter.take(search, 'first').allowed).toBe(false);
    expect(limiter.size()).toBe(2);
  });
});

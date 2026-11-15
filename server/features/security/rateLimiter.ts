// Counts requests per subject in fixed windows, in this process's memory (decisions log §6):
// nothing about a visitor is written anywhere, and a restart forgets it all. The route cache
// already assumes one app process, and so does this.

export type Bucket = { name: string; limit: number; windowMs: number };
export type Take = { allowed: true } | { allowed: false; retryAfterSeconds: number };

type Window = { startedAt: number; count: number; windowMs: number };

export type RateLimiterOptions = {
  // The limiter is itself something a visitor fills, one entry per address, so it is bounded
  // like everything else they can create. 50 000 entries are a few megabytes.
  maxKeys?: number;
  now?: () => number;
};

const pruneIntervalMs = 1000;

export const createRateLimiter = ({ maxKeys = 50_000, now = Date.now }: RateLimiterOptions = {}) => {
  // A Map keeps insertion order, so its first key is the oldest window.
  const windows = new Map<string, Window>();
  let lastPrunedAt = Number.NEGATIVE_INFINITY;

  // At most once a second: under a flood of new addresses every request would otherwise walk
  // the whole map.
  const pruneExpired = (at: number) => {
    if (at - lastPrunedAt < pruneIntervalMs) {
      return;
    }
    lastPrunedAt = at;
    for (const [key, window] of windows) {
      if (at - window.startedAt >= window.windowMs) {
        windows.delete(key);
      }
    }
  };

  // Dropping the oldest window forgets someone's count early. That lets a flood loosen other
  // visitors' limits, never tighten them, and never grows the map.
  const makeRoom = (at: number) => {
    pruneExpired(at);
    while (windows.size >= maxKeys) {
      const oldest = windows.keys().next();
      if (oldest.done) {
        return;
      }
      windows.delete(oldest.value);
    }
  };

  const take = (bucket: Bucket, subject: string): Take => {
    const key = `${bucket.name}:${subject}`;
    const at = now();
    const current = windows.get(key);
    if (current && at - current.startedAt < bucket.windowMs) {
      if (current.count >= bucket.limit) {
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.startedAt + bucket.windowMs - at) / 1000)) };
      }
      current.count += 1;
      return { allowed: true };
    }
    // Deleted first, so a renewed window moves to the young end of the map.
    windows.delete(key);
    makeRoom(at);
    windows.set(key, { startedAt: at, count: 1, windowMs: bucket.windowMs });
    return { allowed: true };
  };

  return { take, size: () => windows.size };
};

export type RateLimiter = ReturnType<typeof createRateLimiter>;

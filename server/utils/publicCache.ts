// Removes every response Nitro's swr route rules have cached, so the next request renders
// fresh. Call it after a write that changes public output has committed. A rating moves the
// global mean behind every coffee's shrunk mean, so the ranking, coffee and brand pages, their
// APIs and their payloads are all stale at once. The cache lives in this one process's memory.
//
// Removed key by key: the memory driver's clear() ignores the prefix and empties all storage.
export const clearPublicPageCache = async () => {
  const cache = useStorage('cache');
  const keys = await cache.getKeys('nitro:routes');
  await Promise.all(keys.map(key => cache.removeItem(key)));
};

// Nitro's swr cache sends `cache-control: s-maxage=60, stale-while-revalidate`, which only
// shared caches read. A browser finds no lifetime in it and guesses one from Last-Modified
// (about a tenth of the copy's age), so a page whose cache entry was hours old could stay in a
// visitor's browser for an hour without asking again. `no-cache` makes the browser check every
// time; Nitro still answers from its own cache, with a bodiless 304 while the ETag matches.
// The 304 itself is sent by h3 before this hook runs and carries `max-age=60`, so a checked
// copy is reused for at most a minute: the same bound the server cache already has.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event) => {
    const { cache } = getRouteRules(event);
    if (cache && cache.swr) {
      setResponseHeader(event, 'cache-control', 'no-cache');
    }
  });
});

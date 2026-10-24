// Nitro's swr cache sends `cache-control: s-maxage=60, stale-while-revalidate`, which only
// shared caches read. A browser finds no lifetime in it and guesses one from Last-Modified
// (about a tenth of the copy's age), so a page whose cache entry was hours old could stay in a
// visitor's browser for an hour without asking again. `no-cache` makes the browser check every
// time; Nitro still answers from its own cache, with a bodiless 304 while the ETag matches.
//
// The header is rewritten as it is set, not in a response hook: h3 sends the 304 itself, with
// `max-age=60`, and ends the response before any hook runs. The browser would then reuse its
// copy for a minute without asking, even after a rating save had emptied the server cache.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    const { cache } = getRouteRules(event);
    if (!cache || !cache.swr) {
      return;
    }
    const response = event.node.res;
    const setHeader = response.setHeader.bind(response);
    response.setHeader = (name, value) =>
      setHeader(name, name.toLowerCase() === 'cache-control' ? 'no-cache' : value);
  });
});

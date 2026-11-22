import type { MarkOutcomesSeenRequest, MySuggestion, UnreadOutcomes } from '#shared/types/suggestion';

// The signed-in user's suggestions and the marker for outcomes they haven't seen, fetched only in
// the browser: they are per-user, and the pages around them are cached for every visitor.
const listKey = 'my-suggestions';
const unreadKey = 'my-suggestion-outcomes-unread';

// "Minu ettepanekud". Fetched again each time the page mounts.
export const useMySuggestions = () => {
  const { data, status } = useFetch('/api/me/suggestions', {
    key: listKey,
    server: false,
    default: (): MySuggestion[] => [],
  });
  return { suggestions: readonly(data), status: readonly(status) };
};

// The red dot on the profile icon and the count on the account page. One key, so marking the
// outcomes seen clears both at once.
export const useUnreadOutcomes = () => {
  const { data } = useFetch('/api/me/suggestions/unread', {
    key: unreadKey,
    server: false,
    dedupe: 'defer',
    default: (): UnreadOutcomes => ({ count: 0 }),
  });
  return { unreadCount: computed(() => data.value.count) };
};

// Sent once the list has been shown, naming the outcomes it showed: reading the list itself
// changes nothing on the server, and an outcome that arrived since keeps its marker.
export const markOutcomesSeen = async (ids: readonly number[]): Promise<void> => {
  const body: MarkOutcomesSeenRequest = { ids: [...ids] };
  await $fetch('/api/me/suggestions/seen', { method: 'POST', body });
  await refreshNuxtData(unreadKey);
};

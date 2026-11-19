import type { InboxCounts } from '#shared/types/feedback';

// The badges in the admin menu, fetched in the browser only like every admin request. One key,
// so a page that changes a count refreshes the badge with refreshAdminInboxCounts().
const key = 'admin-inbox-counts';

export const useAdminInboxCounts = () => {
  const { data } = useFetch('/api/admin/inbox-counts', {
    key,
    server: false,
    dedupe: 'defer',
    default: (): InboxCounts => ({ newFeedback: 0, pendingSuggestions: 0 }),
  });
  return { counts: readonly(data) };
};

export const refreshAdminInboxCounts = () => refreshNuxtData(key);

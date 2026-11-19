import type { Ref } from 'vue';
import type { FeedbackItem, FeedbackStatus } from '#shared/types/feedback';

// The admin feedback inbox for one status, fetched in the browser only. Changing `status` loads
// that tab; moving a message to another status takes it off this one.
export const useFeedbackInbox = (status: Readonly<Ref<FeedbackStatus>>) => {
  const { data, status: loadStatus, error } = useFetch('/api/admin/feedback', {
    query: { status },
    server: false,
    default: (): FeedbackItem[] => [],
  });

  const moveTo = async (id: number, next: FeedbackStatus): Promise<void> => {
    await $fetch(`/api/admin/feedback/${id}`, { method: 'PATCH', body: { status: next } });
    data.value = data.value.filter(item => item.id !== id);
    await refreshAdminInboxCounts();
  };

  return { items: readonly(data), status: readonly(loadStatus), error: readonly(error), moveTo };
};

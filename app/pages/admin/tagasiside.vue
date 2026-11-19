<script setup lang="ts">
import type { Ref } from 'vue';
import { feedbackStatuses, type FeedbackItem, type FeedbackStatus } from '#shared/types/feedback';

// The feedback inbox from the UI canvas: one tab per status, newest first. Messages are a
// visitor's text, so they render as text only, never as markup.
definePageMeta({ layout: 'admin' });

const { t } = useI18n();
const toast = useToast();
const { formatDateTime } = useFormatters();
useSeoMeta({ title: () => t('feedbackInbox.title') });

const current: Ref<FeedbackStatus> = shallowRef('NEW');
const { items, status, error, moveTo } = useFeedbackInbox(current);
const { counts } = useAdminInboxCounts();

const tabs = computed(() => feedbackStatuses.map(value => ({
  value,
  label: value === 'NEW' && counts.value.newFeedback > 0
    ? t('feedbackInbox.newWithCount', { count: counts.value.newFeedback })
    : t(`feedbackInbox.status.${value}`),
})));

// The server stored only paths on this site; checked again here, since this one becomes an href.
const linkOf = (item: FeedbackItem): string | null =>
  item.pagePath !== null && toPagePath(item.pagePath) === item.pagePath ? item.pagePath : null;

const moves = (item: FeedbackItem) => feedbackStatuses.filter(value => value !== item.status);

const move = async (item: FeedbackItem, next: FeedbackStatus) => {
  try {
    await moveTo(item.id, next);
  } catch {
    toast.add({ title: t('feedbackInbox.updateFailed'), color: 'error', icon: 'i-lucide-circle-alert' });
  }
};
</script>

<template>
  <div class="flex flex-col gap-5">
    <h1 class="text-[28px] leading-tight font-bold text-highlighted">
      {{ $t('feedbackInbox.title') }}
    </h1>

    <UTabs
      v-model="current"
      :items="tabs"
      :content="false"
      variant="link"
      :aria-label="$t('feedbackInbox.statusTabs')"
      :ui="{ trigger: 'h-11 px-4 text-[15px]' }"
    />

    <AdminLoad
      :status="status"
      :error="error"
    >
      <p
        v-if="items.length === 0"
        class="text-muted"
      >
        {{ $t('feedbackInbox.empty') }}
      </p>
      <ul
        v-else
        class="flex flex-col gap-3"
      >
        <li
          v-for="item in items"
          :key="item.id"
        >
          <article class="flex flex-col gap-3 rounded-2xl bg-default p-5 ring ring-default ring-inset">
            <div class="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted">
              <time :datetime="item.createdAt">{{ formatDateTime(item.createdAt) }}</time>
              <ULink
                v-if="linkOf(item)"
                :to="linkOf(item) ?? undefined"
                class="font-mono text-[13px] text-primary wrap-anywhere"
              >
                {{ item.pagePath }}
              </ULink>
              <span v-else>{{ $t('feedbackInbox.noPage') }}</span>
              <span>{{ item.signedIn ? $t('feedbackInbox.signedIn') : $t('feedbackInbox.anonymous') }}</span>
            </div>
            <p class="text-base/relaxed whitespace-pre-wrap text-highlighted wrap-anywhere">
              {{ item.message }}
            </p>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="next in moves(item)"
                :key="next"
                :label="$t(`feedbackInbox.markAs.${next}`)"
                :color="next === 'DONE' ? 'success' : 'neutral'"
                :variant="next === 'DONE' ? 'soft' : 'outline'"
                size="lg"
                class="h-11"
                @click="move(item, next)"
              />
            </div>
          </article>
        </li>
      </ul>
    </AdminLoad>
  </div>
</template>

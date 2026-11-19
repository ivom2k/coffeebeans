<script setup lang="ts">
import type { InboxCounts } from '#shared/types/feedback';

// Only what exists: the suggestion queue joins in Phase 7.3, so the menu never links to a page
// that isn't there. A count shows as a badge when something waits.
const items: readonly { to: string; label: string; count?: keyof InboxCounts }[] = [
  { to: '/admin/kohvid', label: 'admin.coffees' },
  { to: '/admin/tagasiside', label: 'admin.feedback', count: 'newFeedback' },
];

const { counts } = useAdminInboxCounts();
const countOf = (item: (typeof items)[number]) => (item.count ? counts.value[item.count] : 0);
</script>

<template>
  <nav
    :aria-label="$t('admin.nav')"
    class="flex gap-1 px-3 pt-3 lg:w-60 lg:shrink-0 lg:flex-col lg:px-3 lg:pt-6"
  >
    <NuxtLinkLocale
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="flex min-h-11 items-center justify-between gap-2 rounded-md px-3.5 text-default hover:bg-elevated/60"
      active-class="bg-primary-50 font-semibold"
    >
      {{ $t(item.label) }}
      <UBadge
        v-if="countOf(item) > 0"
        :label="String(countOf(item))"
        :aria-label="$t('admin.newCount', countOf(item))"
        size="sm"
        class="rounded-full"
      />
    </NuxtLinkLocale>
  </nav>
</template>

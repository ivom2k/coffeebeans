<script setup lang="ts">
// Only what exists: the suggestion queue and the feedback inbox join in Phase 7, so the menu
// never links to a page that isn't there.
const items = [{ to: '/admin/kohvid', label: 'admin.coffees' }] as const;
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
      class="flex min-h-11 items-center rounded-md px-3.5 text-default hover:bg-elevated/60"
      active-class="bg-primary-50 font-semibold"
    >
      {{ $t(item.label) }}
    </NuxtLinkLocale>
  </nav>
</template>

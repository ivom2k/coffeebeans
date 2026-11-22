<script setup lang="ts">
// The account page's links, from the UI canvas. "Jälgitavad" joins with the watchlist after the
// MVP. Rendered for a signed-in user only, in the browser.
const { unreadCount } = useUnreadOutcomes();
</script>

<template>
  <nav
    :aria-label="$t('account.title')"
    class="overflow-hidden rounded-xl bg-default ring ring-default ring-inset"
  >
    <NuxtLinkLocale
      to="/konto/ettepanekud"
      class="flex min-h-14 items-center justify-between gap-3 px-4 text-default"
    >
      <span class="font-semibold">{{ $t('suggestion.mine') }}</span>
      <span class="flex items-center gap-2">
        <UBadge
          v-if="unreadCount > 0"
          color="error"
          :label="$t('suggestion.unreadCount', unreadCount)"
          class="rounded-full px-2 text-[13px]"
        />
        <UIcon
          name="i-lucide-chevron-right"
          class="size-5 text-muted"
        />
      </span>
    </NuxtLinkLocale>
  </nav>
</template>

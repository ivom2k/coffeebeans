<script setup lang="ts">
// The signed-in header's account icon, with a red dot while a suggestion has an outcome the user
// hasn't seen (decisions log §6). Its own component, so the count is fetched only once signed in.
const { t } = useI18n();
const localePath = useLocalePath();
const { unreadCount } = useUnreadOutcomes();

const label = computed(() =>
  (unreadCount.value > 0 ? t('account.titleWithUnread', unreadCount.value) : t('account.title')));
</script>

<template>
  <UChip
    :show="unreadCount > 0"
    color="error"
    size="xl"
    inset
  >
    <UButton
      :to="localePath('/konto')"
      icon="i-lucide-user-round"
      :aria-label="label"
      size="xl"
      class="size-11 justify-center rounded-full"
    />
  </UChip>
</template>

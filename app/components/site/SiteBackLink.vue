<script setup lang="ts">
// Back to the ranked list unless told where.
withDefaults(defineProps<{ to?: string; label?: string }>(), { to: '/', label: undefined });
</script>

<template>
  <NuxtLinkLocale
    :to="to"
    class="flex h-11 items-center gap-1 self-start text-[15px] text-primary hover:text-primary-800"
  >
    <UIcon
      name="i-lucide-chevron-left"
      class="size-5"
    />
    {{ label ?? $t('common.backToRanking') }}
  </NuxtLinkLocale>
</template>

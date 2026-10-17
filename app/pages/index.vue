<script setup lang="ts">
const { t } = useI18n();

useSeoMeta({ description: () => t('home.lead') });
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-1.5 lg:gap-4">
    <h1 class="text-[26px] leading-tight font-bold tracking-[-0.01em] text-highlighted lg:text-[2.5rem]">
      {{ $t('home.title') }}
    </h1>
    <p class="text-base leading-normal text-muted lg:text-lg">
      {{ $t('home.lead') }}
    </p>
  </div>
</template>

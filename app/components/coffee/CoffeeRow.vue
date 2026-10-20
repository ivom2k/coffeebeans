<script setup lang="ts">
import type { CoffeeListItem } from '#shared/types/coffee';

defineProps<{ coffee: CoffeeListItem; rank?: number }>();

const { formatScore } = useFormatters();
</script>

<template>
  <NuxtLinkLocale
    :to="`/kohv/${coffee.slug}`"
    class="flex min-h-19 items-center gap-3 rounded-lg bg-default p-3 text-default ring ring-default ring-inset transition-colors hover:bg-elevated/40"
  >
    <span
      v-if="rank"
      class="w-5 shrink-0 text-center text-[15px] font-semibold text-muted"
    >{{ rank }}</span>
    <CoffeeBeanArt class="size-13 rounded-md" />
    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="text-[13px] text-muted">{{ coffee.brandName }}</span>
      <span class="font-semibold text-highlighted">{{ coffee.name }}</span>
      <span class="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
        <span>{{ coffee.roastLevel === null ? $t('coffee.roastUnknown') : $t('coffee.roastShort', { level: coffee.roastLevel }) }}</span>
        <span v-if="coffee.archived">· {{ $t('coffee.archivedShort') }}</span>
        <CoffeeIssueBadge
          v-if="coffee.issueFlag"
          :flag="coffee.issueFlag"
        />
      </span>
    </span>
    <span
      v-if="coffee.rawMean !== null"
      class="flex shrink-0 flex-col items-end gap-0.5"
    >
      <span class="text-[22px] leading-tight font-bold text-highlighted">{{ formatScore(coffee.rawMean) }}</span>
      <span class="text-xs text-muted">({{ $t('coffee.ratingCount', coffee.ratingCount) }})</span>
    </span>
  </NuxtLinkLocale>
</template>

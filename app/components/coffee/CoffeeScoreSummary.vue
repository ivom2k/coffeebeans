<script setup lang="ts">
import type { ScoreCounts } from '#shared/types/coffee';

// The raw mean, always with its count (decisions log §2); the ranked list sorts by the
// shrunk mean instead.
defineProps<{ rawMean: number; ratingCount: number; scoreCounts: ScoreCounts }>();

const { formatScore } = useFormatters();
</script>

<template>
  <div class="flex flex-col gap-4 rounded-lg bg-default p-5 ring ring-default ring-inset">
    <p class="flex items-baseline gap-2.5">
      <span class="text-[52px] leading-none font-bold tracking-[-0.02em] text-highlighted">{{ formatScore(rawMean) }}</span>
      <span class="text-[17px] text-muted">({{ $t('coffee.ratingCount', ratingCount) }})</span>
    </p>
    <CoffeeScoreHistogram :counts="scoreCounts" />
  </div>
</template>

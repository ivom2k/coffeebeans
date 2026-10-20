<script setup lang="ts">
import type { ScoreCounts } from '#shared/types/coffee';

const props = defineProps<{ counts: ScoreCounts }>();

const { t } = useI18n();

// Five CSS bars, rendered on the server with no chart library (decisions log §2). The
// highest score comes first, and bars are relative to the most common score.
const rows = computed(() => {
  const most = Math.max(...props.counts);
  return [5, 4, 3, 2, 1].map((score) => {
    const count = props.counts[score - 1] ?? 0;
    return { score, count, width: most > 0 ? `${(count / most) * 100}%` : '0%' };
  });
});

const label = computed(() =>
  t('coffee.histogramLabel', { counts: rows.value.map(row => `${row.score} – ${row.count}`).join(', ') }));
</script>

<template>
  <div
    role="img"
    :aria-label="label"
    class="flex flex-col gap-2"
  >
    <div
      v-for="row in rows"
      :key="row.score"
      class="flex items-center gap-2.5 text-sm text-muted"
    >
      <span class="w-3">{{ row.score }}</span>
      <span class="flex h-3 flex-1 overflow-hidden rounded-full bg-(--ui-border-muted)">
        <span
          class="rounded-full bg-primary"
          :style="{ width: row.width }"
        />
      </span>
      <span class="w-6 text-right tabular-nums">{{ row.count }}</span>
    </div>
  </div>
</template>

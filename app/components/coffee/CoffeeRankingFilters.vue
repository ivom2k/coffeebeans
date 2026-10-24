<script setup lang="ts">
import type { RankingFilters } from '#shared/types/coffee';

const filters = defineModel<RankingFilters>({ required: true });

const { t } = useI18n();

const roastLabel = (level: number) => {
  if (level === 1) {
    return t('ranking.roastLight', { level });
  }
  return level === 5 ? t('ranking.roastDark', { level }) : String(level);
};

const roastItems = computed(() => [1, 2, 3, 4, 5].map(level => ({ value: level, label: roastLabel(level) })));
const issueItems = computed(() => [
  { value: 'all', label: t('ranking.issuesAll') },
  { value: 'few', label: t('ranking.issuesFew') },
]);

const roastLevels = computed<number[]>({
  get: () => filters.value.roastLevels,
  set: (levels) => {
    filters.value = { ...filters.value, roastLevels: levels.toSorted() };
  },
});

const issues = computed<string>({
  get: () => (filters.value.fewIssuesOnly ? 'few' : 'all'),
  set: (value) => {
    filters.value = { ...filters.value, fewIssuesOnly: value === 'few' };
  },
});
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <!-- With no level chosen, Nuxt UI renders the label as a dimmed placeholder, which made the
         filter look disabled next to the issue filter. Both are buttons, so both read alike. -->
    <USelect
      v-model="roastLevels"
      :items="roastItems"
      multiple
      :aria-label="$t('ranking.roastFilter')"
      class="h-11 rounded-full ps-4"
      :ui="{ placeholder: 'text-highlighted' }"
    >
      <template #default>
        {{ roastLevels.length > 0 ? $t('ranking.roastFilterSelected', { levels: roastLevels.join(', ') }) : $t('ranking.roastFilter') }}
      </template>
    </USelect>
    <USelect
      v-model="issues"
      :items="issueItems"
      :aria-label="$t('ranking.issuesFilter')"
      class="h-11 rounded-full ps-4"
    >
      <template #default>
        {{ issues === 'few' ? $t('ranking.issuesFew') : $t('ranking.issuesFilter') }}
      </template>
    </USelect>
  </div>
</template>

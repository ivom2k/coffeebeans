<script setup lang="ts">
import type { RankingFilters } from '#shared/types/coffee';

const { t } = useI18n();
const route = useRoute();

useSeoMeta({ description: () => t('home.lead') });

// Only the known parameters go to the API, which validates them; an invalid value
// typed into the URL ends on the error page.
const query = computed(() => ({ roast: route.query.roast, issues: route.query.issues }));
const { data, error } = await useFetch('/api/ranking', { query });
if (error.value) {
  throw createError({ statusCode: error.value.statusCode, statusMessage: error.value.statusMessage, fatal: true });
}

const roastLevelsIn = (value: unknown): number[] => typeof value === 'string'
  ? value.split(',').map(Number).filter(level => Number.isInteger(level) && level >= 1 && level <= 5)
  : [];

// The URL holds the filters, so a filtered list can be shared and survives a reload. The
// controls read it directly rather than the fetched data, so each click shows at once.
const filters = computed<RankingFilters>({
  get: () => ({ roastLevels: roastLevelsIn(route.query.roast), fewIssuesOnly: route.query.issues === 'few' }),
  set: async ({ roastLevels, fewIssuesOnly }) => {
    await navigateTo({
      query: {
        roast: roastLevels.length > 0 ? roastLevels.join(',') : undefined,
        issues: fewIssuesOnly ? 'few' : undefined,
      },
    }, { replace: true });
  },
});
</script>

<template>
  <div class="flex flex-col gap-4 lg:gap-6">
    <div class="flex max-w-2xl flex-col gap-1.5 lg:gap-4">
      <h1 class="text-[26px] leading-tight font-bold tracking-[-0.01em] text-highlighted lg:text-[2.5rem]">
        {{ $t('home.title') }}
      </h1>
      <p class="text-base/normal text-muted lg:text-lg/normal">
        {{ $t('home.lead') }}
      </p>
    </div>

    <SearchField class="max-w-2xl" />

    <CoffeeRankingFilters v-model="filters" />

    <section
      aria-labelledby="ranking-heading"
      class="flex flex-col gap-2"
    >
      <h2
        id="ranking-heading"
        class="mt-1 text-xl font-bold text-highlighted"
      >
        {{ $t('ranking.title') }}
      </h2>
      <ol
        v-if="data && data.ranked.length > 0"
        class="flex flex-col gap-2"
      >
        <li
          v-for="(coffee, index) in data.ranked"
          :key="coffee.slug"
        >
          <CoffeeRow
            :coffee="coffee"
            :rank="index + 1"
          />
        </li>
      </ol>
      <p
        v-else
        class="text-muted"
      >
        {{ filters.roastLevels.length > 0 || filters.fewIssuesOnly ? $t('ranking.emptyFiltered') : $t('ranking.empty') }}
      </p>
    </section>

    <section
      v-if="data && data.unrated.length > 0"
      aria-labelledby="unrated-heading"
      class="flex flex-col gap-2"
    >
      <h2
        id="unrated-heading"
        class="mt-3 text-xl font-bold text-highlighted"
      >
        {{ $t('ranking.unratedTitle') }}
      </h2>
      <ul class="flex flex-col gap-2">
        <li
          v-for="coffee in data.unrated"
          :key="coffee.slug"
        >
          <CoffeeRow :coffee="coffee" />
        </li>
      </ul>
    </section>
  </div>
</template>

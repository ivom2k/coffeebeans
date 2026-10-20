<script setup lang="ts">
import type { BrandHit, SearchResponse } from '#shared/types/search';

const { t } = useI18n();
const route = useRoute();
const localePath = useLocalePath();
const { countryName, formatPackageSize } = useFormatters();

// Search results aren't landing pages, and every query would be its own thin page.
useRobotsRule(false);
useSeoMeta({ title: () => t('search.title') });

const q = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim() : ''));
const searchable = computed(() => q.value.length >= 2);

// The explicit type stops TypeScript from inferring it through Nitro's route typing,
// which overflows its recursion limit here.
const { data, error } = await useAsyncData(
  'search',
  () => (searchable.value ? $fetch<SearchResponse>('/api/search', { query: { q: q.value } }) : Promise.resolve(null)),
  { watch: [q] },
);

const resultCount = computed(() =>
  data.value?.kind === 'text' ? data.value.brands.length + data.value.coffees.length : 0);

const brandMeta = (brand: BrandHit) => [
  brand.countryCode === null ? null : countryName(brand.countryCode),
  t('search.coffeeCount', brand.coffeeCount),
].filter(part => part !== null).join(' · ');

// Results of a cleared query shouldn't linger under an empty field. Replace rather than
// push, so Back still leads to where the visitor came from.
const clearResults = () => navigateTo(localePath('/otsing'), { replace: true });
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-4">
    <SiteBackLink />
    <h1 class="sr-only">
      {{ $t('search.title') }}
    </h1>
    <SearchField
      :initial-query="q"
      @clear="clearResults"
    />

    <p
      v-if="error"
      role="alert"
      class="text-error"
    >
      {{ $t('search.failed') }}
    </p>
    <p
      v-else-if="!q"
      class="text-muted"
    >
      {{ $t('search.prompt') }}
    </p>
    <p
      v-else-if="!searchable"
      class="text-muted"
    >
      {{ $t('search.tooShort') }}
    </p>

    <template v-else-if="data?.kind === 'text'">
      <template v-if="resultCount > 0">
        <p class="text-[15px] text-muted">
          {{ $t('search.resultCount', { count: resultCount, query: q }, resultCount) }}
        </p>
        <section
          v-if="data.brands.length > 0"
          aria-labelledby="brands-heading"
          class="flex flex-col gap-2"
        >
          <h2
            id="brands-heading"
            class="text-sm font-semibold tracking-[0.04em] text-muted uppercase"
          >
            {{ $t('search.brands', data.brands.length) }}
          </h2>
          <NuxtLinkLocale
            v-for="brand in data.brands"
            :key="brand.slug"
            :to="`/brand/${brand.slug}`"
            class="flex min-h-15 items-center justify-between gap-3 rounded-lg bg-default px-4 py-3 ring ring-default ring-inset transition-colors hover:bg-elevated/40"
          >
            <span class="flex flex-col gap-0.5">
              <span class="font-semibold text-highlighted">{{ brand.name }}</span>
              <span class="text-[13px] text-muted">{{ brandMeta(brand) }}</span>
            </span>
            <UIcon
              name="i-lucide-chevron-right"
              class="size-5 shrink-0 text-muted"
            />
          </NuxtLinkLocale>
        </section>
        <section
          v-if="data.coffees.length > 0"
          aria-labelledby="coffees-heading"
          class="flex flex-col gap-2"
        >
          <h2
            id="coffees-heading"
            class="mt-2 text-sm font-semibold tracking-[0.04em] text-muted uppercase"
          >
            {{ $t('search.coffees') }}
          </h2>
          <ul class="flex flex-col gap-2">
            <li
              v-for="coffee in data.coffees"
              :key="coffee.slug"
            >
              <CoffeeRow :coffee="coffee" />
            </li>
          </ul>
        </section>
      </template>
      <SearchEmpty
        v-else
        :title="$t('search.noResultsTitle', { query: q })"
        :hint="$t('search.noResultsHint')"
      />
    </template>

    <template v-else-if="data?.kind === 'gtin'">
      <template v-if="data.coffee">
        <p class="flex items-center gap-2 text-[15px] font-semibold text-success">
          <UIcon
            name="i-lucide-scan-barcode"
            class="size-5"
          />
          {{ $t('search.foundByBarcode') }} · {{ $t('search.package', { size: formatPackageSize(data.coffee.packageSizeG) }) }}
        </p>
        <CoffeeRow :coffee="data.coffee" />
      </template>
      <SearchEmpty
        v-else
        :title="$t('search.barcodeNotFoundTitle')"
        :hint="$t('search.barcodeHint')"
      />
    </template>

    <SearchEmpty
      v-else-if="data?.kind === 'invalidGtin'"
      :title="$t('search.barcodeInvalidTitle', { query: q })"
      :hint="$t('search.barcodeInvalidHint')"
    />
  </div>
</template>

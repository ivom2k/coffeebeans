<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
const { countryName } = useFormatters();

const slug = computed(() => String(route.params.slug));
const { data, error } = await useFetch(() => `/api/brands/${encodeURIComponent(slug.value)}`);
if (error.value) {
  throw createError({ statusCode: error.value.statusCode, statusMessage: error.value.statusMessage, fatal: true });
}

const forSale = computed(() => (data.value ? [...data.value.ranked, ...data.value.unrated] : []));
const coffeeCount = computed(() => forSale.value.length + (data.value?.archived.length ?? 0));
const meta = computed(() => [
  data.value?.brand.countryCode ? countryName(data.value.brand.countryCode) : null,
  t('brand.coffeeCount', coffeeCount.value),
].filter(part => part !== null).join(' · '));

useSeoMeta({
  title: () => data.value?.brand.name ?? '',
  description: () => t('brand.meta', { name: data.value?.brand.name ?? '' }),
});

// Like coffee pages, thin until one of its coffees has a rating (decisions log §10).
const hasRating = [...forSale.value, ...(data.value?.archived ?? [])].some(coffee => coffee.ratingCount > 0);
if (!hasRating) {
  useRobotsRule('noindex, follow');
}
</script>

<template>
  <div
    v-if="data"
    class="flex flex-col gap-4"
  >
    <SiteBackLink />

    <div class="flex flex-col gap-1">
      <span class="text-sm font-semibold tracking-[0.04em] text-muted uppercase">{{ $t('brand.eyebrow') }}</span>
      <h1 class="text-[30px] leading-tight font-bold tracking-[-0.01em] text-highlighted">
        {{ data.brand.name }}
      </h1>
      <p class="text-[15px] text-muted">
        {{ meta }}
      </p>
    </div>

    <section
      v-if="forSale.length > 0"
      aria-labelledby="coffees-heading"
      class="flex flex-col gap-2"
    >
      <h2
        id="coffees-heading"
        class="mt-2 text-xl font-bold text-highlighted"
      >
        {{ $t('brand.coffeesTitle') }}
      </h2>
      <ul class="flex flex-col gap-2">
        <li
          v-for="coffee in forSale"
          :key="coffee.slug"
        >
          <CoffeeRow :coffee="coffee" />
        </li>
      </ul>
    </section>

    <section
      v-if="data.archived.length > 0"
      aria-labelledby="archived-heading"
      class="flex flex-col gap-2"
    >
      <h2
        id="archived-heading"
        class="mt-2 text-xl font-bold text-highlighted"
      >
        {{ $t('brand.archivedTitle') }}
      </h2>
      <ul class="flex flex-col gap-2">
        <li
          v-for="coffee in data.archived"
          :key="coffee.slug"
        >
          <CoffeeRow :coffee="coffee" />
        </li>
      </ul>
    </section>
  </div>
</template>

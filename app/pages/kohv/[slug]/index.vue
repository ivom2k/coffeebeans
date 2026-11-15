<script setup lang="ts">
const { t, locale } = useI18n();
const route = useRoute();
const localePath = useLocalePath();
const { countryName, formatScore } = useFormatters();

const slug = computed(() => String(route.params.slug));
const { data, error } = await useFetch(() => `/api/coffees/${encodeURIComponent(slug.value)}`, {
  query: { locale },
});
if (error.value) {
  throw createError({ statusCode: error.value.statusCode, statusMessage: error.value.statusMessage, fatal: true });
}
if (data.value?.kind === 'redirect') {
  // An old slug: a permanent redirect keeps shared links and search rankings (decisions log §10).
  await navigateTo(localePath(`/kohv/${data.value.slug}`), { redirectCode: 301 });
}

const coffee = computed(() => (data.value?.kind === 'coffee' ? data.value.coffee : null));
const fullName = computed(() => (coffee.value ? `${coffee.value.brand.name} ${coffee.value.name}` : ''));
const hasIssueAnswers = computed(() =>
  coffee.value !== null && (coffee.value.machineIssues.automatic.length > 0 || coffee.value.machineIssues.portafilter !== null));

useSeoMeta({
  title: () => fullName.value,
  description: () => {
    if (coffee.value?.rawMean == null) {
      return t('coffee.metaUnrated', { name: fullName.value });
    }
    return t('coffee.metaRated', {
      name: fullName.value,
      score: formatScore(coffee.value.rawMean),
      ratings: t('coffee.ratingCount', coffee.value.ratingCount),
    });
  },
});

// Unrated pages are thin content, so they stay out of search until the first rating
// (decisions log §10).
if (coffee.value && coffee.value.rawMean === null) {
  useRobotsRule('noindex, follow');
}

// Product structured data uses the same raw mean and count the page shows (§10).
// AggregateRating needs at least one rating.
if (coffee.value && coffee.value.rawMean !== null) {
  useSchemaOrg([
    defineProduct({
      name: fullName.value,
      brand: { '@type': 'Brand', 'name': coffee.value.brand.name },
      description: coffee.value.description ?? undefined,
      // Relative; the schema.org module makes it absolute with the site URL.
      image: coffee.value.imageUrl ?? undefined,
      aggregateRating: {
        ratingValue: coffee.value.rawMean,
        ratingCount: coffee.value.ratingCount,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  ]);
}
</script>

<template>
  <div
    v-if="coffee"
    class="flex flex-col gap-4"
  >
    <SiteBackLink />

    <div
      v-if="coffee.archived"
      role="status"
      class="flex gap-3 rounded-lg bg-elevated p-4"
    >
      <UIcon
        name="i-lucide-archive"
        class="size-5.5 shrink-0 text-toned"
      />
      <span class="flex flex-col gap-0.5">
        <strong class="text-highlighted">{{ $t('coffee.archivedTitle') }}</strong>
        <span class="text-sm/normal text-toned">{{ $t('coffee.archivedText') }}</span>
      </span>
    </div>

    <!-- Photo, title, score. On a phone they stack in that order, which is also their order
         here. From lg up the title runs across the top and the photo stands beside the score
         card, so the two start on one line: beside the title, the photo's top met the small
         brand line and its bottom ended partway down the card. -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start lg:gap-x-8">
      <!-- A photo takes its width from its own shape, centred on a phone. The drawing that
           stands in for one has no shape, so it gets the frame's width. -->
      <CoffeeImage
        :src="coffee.imageUrl"
        :alt="$t('coffee.photoAlt', { name: fullName })"
        size="lg"
        eager
        class="h-60 rounded-lg lg:col-start-1 lg:row-start-2"
        :class="coffee.imageUrl ? 'mx-auto lg:mx-0' : 'lg:w-80'"
      />

      <div class="flex flex-col gap-1 lg:col-span-2 lg:row-start-1">
        <span class="text-[15px] text-muted">
          <NuxtLinkLocale
            :to="`/brand/${coffee.brand.slug}`"
            class="inline-block py-2.5 font-semibold text-primary hover:text-primary-800"
          >{{ coffee.brand.name }}</NuxtLinkLocale>
          <template v-if="coffee.brand.countryCode"> · {{ countryName(coffee.brand.countryCode) }}</template>
        </span>
        <h1 class="text-[30px] leading-tight font-bold tracking-[-0.01em] text-highlighted">
          {{ coffee.name }}
        </h1>
      </div>

      <div class="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-2">
        <template v-if="coffee.rawMean !== null">
          <CoffeeScoreSummary
            :raw-mean="coffee.rawMean"
            :rating-count="coffee.ratingCount"
            :score-counts="coffee.scoreCounts"
          />
          <!-- Per-user: "Hinda" or the visitor's own rating, rendered in the browser only.
               The fallback holds the button's height so the page doesn't jump. -->
          <ClientOnly>
            <RatingAction
              :slug="coffee.slug"
              :outline="coffee.archived"
            />
            <template #fallback>
              <div class="h-13" />
            </template>
          </ClientOnly>
        </template>
        <div
          v-else
          class="flex flex-col items-center gap-2.5 rounded-lg bg-default px-5 py-6 text-center ring ring-default ring-inset"
        >
          <span class="text-xl font-bold text-highlighted">{{ $t('coffee.noRatingsTitle') }}</span>
          <p class="text-[15px] leading-normal text-muted">
            {{ $t('coffee.noRatingsText') }}
          </p>
          <div class="mt-1.5 self-stretch">
            <ClientOnly>
              <RatingAction
                :slug="coffee.slug"
                :label="$t('rating.rateFirst')"
                :outline="coffee.archived"
              />
              <template #fallback>
                <div class="h-13" />
              </template>
            </ClientOnly>
          </div>
        </div>
      </div>
    </div>

    <CoffeeMachineIssues
      v-if="hasIssueAnswers"
      :issues="coffee.machineIssues"
    />

    <CoffeePackageDetails :coffee="coffee" />

    <section
      v-if="coffee.description"
      aria-labelledby="description-heading"
      class="flex flex-col gap-2 px-1"
    >
      <h2
        id="description-heading"
        class="text-xl font-bold text-highlighted"
      >
        {{ $t('coffee.descriptionTitle') }}
      </h2>
      <p class="leading-relaxed">
        {{ coffee.description }}
      </p>
    </section>
  </div>
</template>

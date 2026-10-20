<script setup lang="ts">
import type { CoffeeDetails } from '#shared/types/coffee';

const props = defineProps<{ coffee: CoffeeDetails }>();

const { t } = useI18n();
const { countryName, formatPackageSize } = useFormatters();

// Species codes are i18n keys (decisions log §9). Percentages are optional per blend.
const composition = computed(() => props.coffee.species
  .map(({ code, percentage }) => percentage === null
    ? t(`species.${code}`)
    : t('coffee.speciesShare', { percentage, species: t(`species.${code}`) }))
  .join(', '));

const origins = computed(() => props.coffee.origins.map(countryName).join(', '));

const packages = computed(() => props.coffee.packages.map(pkg => ({
  size: formatPackageSize(pkg.sizeG),
  gtin: pkg.gtin === null ? null : toPrintedGtin(pkg.gtin),
})));
</script>

<template>
  <section
    aria-labelledby="details-heading"
    class="flex flex-col gap-4.5 rounded-lg bg-default p-5 ring ring-default ring-inset"
  >
    <h2
      id="details-heading"
      class="text-xl font-bold text-highlighted"
    >
      {{ $t('coffee.detailsTitle') }}
    </h2>
    <dl class="flex flex-col gap-4.5">
      <CoffeeRoastLevel
        v-if="coffee.roastLevel !== null"
        :level="coffee.roastLevel"
      />
      <div
        v-else
        class="flex justify-between gap-4 text-[15px]"
      >
        <dt class="text-muted">
          {{ $t('coffee.roastLevel') }}
        </dt>
        <dd class="font-semibold">
          {{ $t('coffee.unknown') }}
        </dd>
      </div>
      <div
        v-if="composition"
        class="flex justify-between gap-4 text-[15px]"
      >
        <dt class="text-muted">
          {{ $t('coffee.composition') }}
        </dt>
        <dd class="text-right font-semibold">
          {{ composition }}
        </dd>
      </div>
      <div
        v-if="origins"
        class="flex justify-between gap-4 text-[15px]"
      >
        <dt class="text-muted">
          {{ $t('coffee.origin') }}
        </dt>
        <dd class="text-right font-semibold">
          {{ origins }}
        </dd>
      </div>
      <div
        v-if="packages.length > 0"
        class="flex flex-col gap-2 text-[15px]"
      >
        <dt class="text-muted">
          {{ $t('coffee.packages', packages.length) }}
        </dt>
        <dd
          v-for="(pkg, index) in packages"
          :key="index"
          class="flex justify-between gap-4"
        >
          <span class="font-semibold">{{ pkg.size }}</span>
          <span
            v-if="pkg.gtin"
            class="text-muted tabular-nums"
          >{{ pkg.gtin }}</span>
        </dd>
      </div>
    </dl>
  </section>
</template>

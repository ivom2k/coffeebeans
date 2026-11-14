<script setup lang="ts">
import { speciesCodes, type SpeciesCode } from '#shared/types/catalogue';

// The blend as the bag declares it. Percentages are optional ("Arabica & Robusta"); once every
// species has one, they must add up to 100, the same rule the server applies (speciesShare).
const rows = defineModel<SpeciesRow[]>({ required: true });
defineProps<{ error?: string }>();

const { t } = useI18n();
const share = computed(() => speciesShare(speciesPercentages(rows.value)));

const add = (code: SpeciesCode) => {
  rows.value = [...rows.value, { key: nextRowKey(), code, percentage: '' }];
};
const addItems = computed(() => speciesCodes
  .filter(code => !rows.value.some(row => row.code === code))
  .map(code => ({ label: t(`species.${code}`), onSelect: () => add(code) })));
const update = (key: number, percentage: string) => {
  rows.value = rows.value.map(row => (row.key === key ? { ...row, percentage } : row));
};
const remove = (key: number) => {
  rows.value = rows.value.filter(row => row.key !== key);
};
</script>

<template>
  <div class="flex min-w-0 flex-1 basis-70 flex-col gap-2.5">
    <h2 class="text-[17px] font-bold text-highlighted">
      {{ $t('catalogue.composition') }}
    </h2>
    <div
      v-for="row in rows"
      :key="row.key"
      class="flex items-center gap-2"
    >
      <span class="flex-1 first-letter:uppercase">{{ $t(`species.${row.code}`) }}</span>
      <UInput
        :model-value="row.percentage"
        :aria-label="$t('catalogue.percentageLabel', { species: $t(`species.${row.code}`) })"
        inputmode="numeric"
        size="lg"
        class="w-20"
        :ui="{ base: 'text-right', trailing: 'pointer-events-none' }"
        @update:model-value="value => update(row.key, String(value))"
      >
        <template #trailing>
          <span class="text-sm text-muted">%</span>
        </template>
      </UInput>
      <UButton
        icon="i-lucide-x"
        :aria-label="$t('catalogue.removeSpecies', { species: $t(`species.${row.code}`) })"
        color="neutral"
        variant="ghost"
        size="lg"
        @click="remove(row.key)"
      />
    </div>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <UDropdownMenu
        v-if="addItems.length > 0"
        :items="addItems"
      >
        <UButton
          icon="i-lucide-plus"
          :label="$t('catalogue.addSpecies')"
          variant="link"
          class="px-0"
        />
      </UDropdownMenu>
      <span
        v-if="share.allQuantified"
        aria-live="polite"
        :class="['text-sm font-semibold', share.valid ? 'text-success' : 'text-error']"
      >
        {{ share.valid ? $t('catalogue.speciesTotal', { total: share.total }) : $t('catalogue.speciesTotalWrong', { total: share.total }) }}
      </span>
    </div>
    <p
      v-if="error"
      role="alert"
      class="text-sm text-error"
    >
      {{ error }}
    </p>
  </div>
</template>

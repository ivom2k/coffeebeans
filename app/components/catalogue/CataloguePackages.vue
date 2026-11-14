<script setup lang="ts">
import type { PackageGtinStatus } from '#shared/utils/gtin';

// The bags a coffee is sold in, each with its barcode checked as it is typed (decisions log §4),
// including against the other rows. A blank barcode is allowed: the bag may be entered before its
// code is known, so a blank row shows no status at all.
const rows = defineModel<PackageRow[]>({ required: true });
defineProps<{ submitted: boolean; error?: string }>();

const statuses = computed(() => packageGtinStatuses(rows.value.map(row => row.gtin)));
const statusOf = (index: number): PackageGtinStatus => statuses.value[index] ?? 'EMPTY';
const isInvalid = (status: PackageGtinStatus) => status !== 'EMPTY' && status !== 'OK';

const update = (key: number, changes: Partial<PackageRow>) => {
  rows.value = rows.value.map(row => (row.key === key ? { ...row, ...changes } : row));
};
const add = () => {
  rows.value = [...rows.value, { key: nextRowKey(), sizeG: '', gtin: '' }];
};
const remove = (key: number) => {
  rows.value = rows.value.filter(row => row.key !== key);
};
</script>

<template>
  <section class="flex flex-col gap-3 rounded-lg bg-default p-5 ring ring-default ring-inset lg:p-6">
    <h2 class="text-[17px] font-bold text-highlighted">
      {{ $t('catalogue.packages') }}
    </h2>
    <div v-if="rows.length > 0">
      <!-- The canvas's column heads. Hidden from screen readers: each input's aria-label already
           holds the same words, which would otherwise be read twice. -->
      <div
        aria-hidden="true"
        class="flex gap-2 text-[13px] font-semibold text-muted"
      >
        <span class="w-22 shrink-0">{{ $t('catalogue.size') }}</span>
        <span>{{ $t('catalogue.gtin') }}</span>
      </div>
      <ul class="flex flex-col">
        <li
          v-for="(row, index) in rows"
          :key="row.key"
          class="flex items-start gap-2 border-b border-muted py-2 last:border-b-0"
        >
          <!-- On a 375 px screen the barcode needs about 140 px for 13 digits at 16 px, a size
               that can't shrink: iOS zooms into any input set smaller when it gets focus. So the
               size field is just wide enough for "10000", and its trailing padding, sized for an
               icon by default, is cut to fit a "g". -->
          <UInput
            :model-value="row.sizeG"
            :aria-label="$t('catalogue.sizeLabel')"
            :color="submitted && wholeNumber(row.sizeG) === null ? 'error' : undefined"
            :highlight="submitted && wholeNumber(row.sizeG) === null"
            inputmode="numeric"
            size="lg"
            class="w-22 shrink-0"
            :ui="{ base: 'pe-7 text-right', trailing: 'pointer-events-none' }"
            @update:model-value="value => update(row.key, { sizeG: String(value) })"
          >
            <template #trailing>
              <span class="text-sm text-muted">g</span>
            </template>
          </UInput>
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <UInput
              :model-value="row.gtin"
              :aria-label="$t('catalogue.gtin')"
              :color="isInvalid(statusOf(index)) ? 'error' : undefined"
              :highlight="isInvalid(statusOf(index))"
              inputmode="numeric"
              size="lg"
              class="w-full max-w-60"
              :ui="{ base: 'px-2.5 tabular-nums' }"
              @update:model-value="value => update(row.key, { gtin: String(value) })"
            />
            <span
              v-if="statusOf(index) !== 'EMPTY'"
              aria-live="polite"
              :class="['text-sm font-semibold', isInvalid(statusOf(index)) ? 'text-error' : 'text-success']"
            >
              <span class="sr-only">{{ $t('catalogue.check') }}: </span>{{ $t(`catalogue.gtinStatus.${statusOf(index)}`) }}
            </span>
          </div>
          <UButton
            icon="i-lucide-x"
            :aria-label="$t('catalogue.removePackage')"
            color="neutral"
            variant="ghost"
            size="lg"
            @click="remove(row.key)"
          />
        </li>
      </ul>
    </div>
    <p
      v-if="error"
      role="alert"
      class="text-sm text-error"
    >
      {{ error }}
    </p>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <UButton
        icon="i-lucide-plus"
        :label="$t('catalogue.addPackage')"
        variant="link"
        class="px-0"
        @click="add"
      />
      <span class="text-[13px] text-muted">{{ $t('catalogue.gtinHint') }}</span>
    </div>
  </section>
</template>

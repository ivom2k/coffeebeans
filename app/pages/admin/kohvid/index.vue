<script setup lang="ts">
import type { Ref } from 'vue';
import { useFilter } from 'reka-ui';
import { coffeeStatuses, type CoffeeStatus } from '#shared/types/catalogue';

// Every coffee, drafts included: the way into the editor. Not on the UI canvas, so kept to a
// search, a status filter and the list. The catalogue is a few hundred coffees at most, so it
// loads whole and filters in the browser.
definePageMeta({ layout: 'admin' });

const { t } = useI18n();
const localePath = useLocalePath();
const { formatDate } = useFormatters();
useSeoMeta({ title: () => t('catalogue.listTitle') });

const { coffees, status, error } = useCatalogueCoffees();
const search: Ref<string> = shallowRef('');
const statusFilter: Ref<CoffeeStatus | null> = shallowRef(null);

// Every typed word must match, accents and case ignored, as in the machine picker.
const { contains } = useFilter({ sensitivity: 'base' });
const shown = computed(() => {
  const words = search.value.trim().split(/\s+/).filter(word => word !== '');
  return coffees.value.filter(coffee =>
    (statusFilter.value === null || coffee.status === statusFilter.value)
    && words.every(word => contains(`${coffee.brandName} ${coffee.name}`, word)));
});

const statusOptions = computed(() => coffeeStatuses.map(value => ({ value, label: t(`catalogue.status.${value}`) })));
const badgeColor: Readonly<Record<CoffeeStatus, 'neutral' | 'success' | 'warning'>> = {
  DRAFT: 'neutral',
  PUBLISHED: 'success',
  ARCHIVED: 'warning',
};
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-[28px] leading-tight font-bold text-highlighted">
        {{ $t('catalogue.listTitle') }}
      </h1>
      <UButton
        v-if="status === 'success'"
        :to="localePath('/admin/kohvid/uus')"
        icon="i-lucide-plus"
        :label="$t('catalogue.add')"
        size="xl"
      />
    </div>

    <AdminLoad
      :status="status"
      :error="error"
    >
      <div class="flex flex-col gap-4">
        <UInput
          v-model="search"
          type="search"
          icon="i-lucide-search"
          :placeholder="$t('catalogue.search')"
          :aria-label="$t('catalogue.search')"
          size="xl"
          class="w-full max-w-md"
        />
        <RatingSegmentControl
          v-model="statusFilter"
          :options="statusOptions"
          :label="$t('catalogue.statusFilter')"
          variant="chips"
        />

        <p
          v-if="coffees.length === 0"
          class="text-muted"
        >
          {{ $t('catalogue.empty') }}
        </p>
        <p
          v-else-if="shown.length === 0"
          class="text-muted"
        >
          {{ $t('catalogue.noMatch') }}
        </p>
        <ul
          v-else
          class="flex flex-col gap-2"
        >
          <li
            v-for="coffee in shown"
            :key="coffee.id"
          >
            <NuxtLinkLocale
              :to="`/admin/kohvid/${coffee.id}`"
              class="flex items-center gap-3 rounded-lg bg-default p-3.5 ring ring-default ring-inset transition-colors hover:bg-elevated/40"
            >
              <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span class="text-[13px] text-muted">{{ coffee.brandName }}</span>
                <span class="font-semibold text-highlighted">{{ coffee.name }}</span>
                <span class="text-[13px] text-muted">
                  {{ $t('coffee.ratingCount', coffee.ratingCount) }}
                  <template v-if="!coffee.hasImage"> · {{ $t('catalogue.noPhoto') }}</template>
                  · {{ $t('catalogue.updated', { date: formatDate(coffee.updatedAt) }) }}
                </span>
              </span>
              <UBadge
                :color="badgeColor[coffee.status]"
                variant="soft"
                :label="$t(`catalogue.status.${coffee.status}`)"
                class="shrink-0"
              />
            </NuxtLinkLocale>
          </li>
        </ul>
      </div>
    </AdminLoad>
  </div>
</template>

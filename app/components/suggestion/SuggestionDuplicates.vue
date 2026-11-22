<script setup lang="ts">
import type { Ref } from 'vue';
import type { CoffeeListItem } from '#shared/types/coffee';
import type { SearchResponse } from '#shared/types/search';

// The live duplicate check (decisions log §6): as the user types a name or a barcode, coffees
// already in the catalogue appear, so the most common outcome resolves with no wait. It goes
// through the same /api/search as the search page, under the same limit, and adds no endpoint.
// A failed or refused check hides the block; it never stops a send.
const props = defineProps<{ query: string }>();

const shown = 3;
const debounceMs = 300;
const matches: Ref<readonly CoffeeListItem[]> = shallowRef([]);

const matchesOf = (result: SearchResponse): CoffeeListItem[] => {
  if (result.kind === 'text') {
    return result.coffees.slice(0, shown);
  }
  return result.kind === 'gtin' && result.coffee ? [result.coffee] : [];
};

watch(() => props.query.trim().slice(0, 100), (q, _previous, onCleanup) => {
  if (q.length < 2) {
    matches.value = [];
    return;
  }
  let current = true;
  const timer = setTimeout(async () => {
    try {
      const result = await $fetch<SearchResponse>('/api/search', { query: { q } });
      if (current) {
        matches.value = matchesOf(result);
      }
    } catch {
      // Rate-limited or offline: the check is a convenience, so it just disappears.
      if (current) {
        matches.value = [];
      }
    }
  }, debounceMs);
  onCleanup(() => {
    current = false;
    clearTimeout(timer);
  });
});
</script>

<template>
  <div
    role="region"
    aria-live="polite"
    :aria-label="$t('suggestion.duplicatesTitle')"
  >
    <div
      v-if="matches.length > 0"
      class="flex flex-col gap-2.5 rounded-lg bg-warning-50 p-3.5"
    >
      <span class="text-[15px] font-semibold text-warning">{{ $t('suggestion.duplicatesTitle') }}</span>
      <NuxtLinkLocale
        v-for="coffee in matches"
        :key="coffee.slug"
        :to="`/kohv/${coffee.slug}`"
        class="flex items-center justify-between gap-3 rounded-md bg-default p-3 text-default"
      >
        <span class="flex min-w-0 flex-col gap-0.5">
          <span class="text-[13px] text-muted">{{ coffee.brandName }}</span>
          <span class="font-semibold wrap-anywhere">{{ coffee.name }}</span>
        </span>
        <span class="shrink-0 text-sm font-semibold text-primary">{{ $t('suggestion.duplicateOpen') }}</span>
      </NuxtLinkLocale>
    </div>
  </div>
</template>

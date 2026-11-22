<script setup lang="ts">
// The list on "Minu ettepanekud", for a signed-in user, in the browser only. New outcomes keep
// their marker for this visit; once they have been shown, a POST names them as seen, which clears
// the red dot on the profile icon. Loading the list alone changes nothing (CLAUDE.md § Access).
const { suggestions, status } = useMySuggestions();

const unreadIds = computed(() => suggestions.value.filter(suggestion => suggestion.unread).map(suggestion => suggestion.id));
watch(unreadIds, async (ids) => {
  if (ids.length === 0) {
    return;
  }
  try {
    await markOutcomesSeen(ids);
  } catch (error) {
    // The marker simply stays until the next visit.
    console.warn('Outcomes not marked as seen:', error instanceof Error ? error.message : error);
  }
}, { immediate: true });
</script>

<template>
  <div class="flex flex-col gap-4">
    <SuggestionCard
      v-for="suggestion in suggestions"
      :key="suggestion.id"
      :suggestion="suggestion"
    />
    <div
      v-if="status === 'success' && suggestions.length === 0"
      class="flex flex-col items-start gap-3"
    >
      <p class="text-muted">
        {{ $t('suggestion.empty') }}
      </p>
    </div>
    <p
      v-else-if="status === 'error'"
      role="alert"
      class="text-error"
    >
      {{ $t('suggestion.loadFailed') }}
    </p>
  </div>
</template>

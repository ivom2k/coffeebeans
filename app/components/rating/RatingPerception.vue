<script setup lang="ts">
// One optional slider: five segments with both pole labels on screen, and a visible clear
// control once a value is set. Tapping the chosen segment again clears it too (decisions log §2).
const props = defineProps<{ label: string; low: string; high: string }>();
const value = defineModel<number | null>({ required: true });

const polesId = useId();
const options = computed(() =>
  [1, 2, 3, 4, 5].map(level => ({ value: level, label: String(level), ariaLabel: `${props.label} ${level}` })));
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex min-h-11 items-center justify-between gap-3">
      <span class="font-bold text-highlighted">{{ label }}</span>
      <span class="flex items-center gap-2">
        <span class="text-sm text-muted">{{ value === null ? $t('rating.unanswered') : $t('rating.chosen', { value }) }}</span>
        <UButton
          v-if="value !== null"
          :label="$t('common.clear')"
          :aria-label="$t('rating.clearLabel', { label })"
          variant="link"
          size="lg"
          class="h-11 px-1 text-[15px] font-semibold"
          @click="value = null"
        />
      </span>
    </div>
    <RatingSegmentControl
      v-model="value"
      :options="options"
      :label="label"
      :described-by="polesId"
    />
    <p
      :id="polesId"
      class="flex justify-between gap-4 text-[13px] text-muted"
    >
      <span><span class="sr-only">1: </span>{{ low }}</span>
      <span class="text-right"><span class="sr-only">5: </span>{{ high }}</span>
    </p>
  </div>
</template>

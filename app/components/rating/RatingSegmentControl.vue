<script setup lang="ts" generic="T extends string | number">
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui';

// A single-select row of segments or chips on Reka's ToggleGroup, which brings the roving
// focus, arrow keys and pressed state; Nuxt UI has no toggle group. Nothing is selected by
// default, so an untouched control never submits a value (decisions log §2).
const props = withDefaults(defineProps<{
  options: readonly { value: T; label: string; ariaLabel?: string }[];
  // The group's accessible name.
  label: string;
  describedBy?: string;
  variant?: 'segments' | 'chips';
  // Off for a required answer: tapping the chosen option again then keeps it.
  clearable?: boolean;
}>(), { describedBy: undefined, variant: 'segments', clearable: true });

const model = defineModel<T | null>({ required: true });

// Reka answers a tap on the chosen option with undefined. The root always gets null rather
// than undefined for "nothing chosen": Reka keeps its own copy of the value when the first
// one it sees is undefined, and ignoring a re-tap would then leave the two out of step.
const choose = (value: unknown) => {
  const option = props.options.find(candidate => candidate.value === value);
  if (option) {
    model.value = option.value;
  } else if (props.clearable) {
    model.value = null;
  }
};
</script>

<template>
  <ToggleGroupRoot
    type="single"
    :model-value="model"
    :aria-label="label"
    :aria-describedby="describedBy"
    :class="variant === 'segments' ? 'flex gap-1.5' : 'flex flex-wrap gap-2'"
    @update:model-value="choose"
  >
    <ToggleGroupItem
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :aria-label="option.ariaLabel"
      :class="[
        'cursor-pointer bg-default font-medium text-default ring ring-accented ring-inset',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'data-[state=on]:bg-primary data-[state=on]:text-inverted data-[state=on]:ring-0',
        variant === 'segments'
          ? 'h-12 min-w-0 flex-1 rounded-md text-base data-[state=on]:font-bold'
          : 'h-11 rounded-full px-4 text-[15px] data-[state=on]:font-semibold',
      ]"
    >
      {{ option.label }}
    </ToggleGroupItem>
  </ToggleGroupRoot>
</template>

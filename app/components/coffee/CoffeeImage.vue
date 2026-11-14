<script setup lang="ts">
// The coffee's photo, or the bean drawing when it has none. Shown whole (object-contain) on the
// drawing's tint, since a bag's label matters more than filling the frame. Sizing comes from the
// caller's class. Lazy by default; the coffee page's photo is the first thing it shows, so it
// loads at once.
const { src, alt, size = 'sm', eager = false } = defineProps<{
  src: string | null;
  // Empty where the photo only repeats the name next to it, as in the list rows.
  alt: string;
  size?: 'sm' | 'lg';
  eager?: boolean;
}>();
</script>

<template>
  <span
    v-if="src"
    class="flex shrink-0 overflow-hidden bg-primary-50"
  >
    <img
      :src="src"
      :alt="alt"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
      class="size-full object-contain"
    >
  </span>
  <CoffeeBeanArt
    v-else
    :size="size"
  />
</template>

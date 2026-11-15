<script setup lang="ts">
// The coffee's photo, or the bean drawing when it has none. Sizing comes from the caller's class.
// Lazy by default; the coffee page's photo is the first thing it shows, so it loads at once.
//
// The two sizes fit the photo differently. A list row's thumbnail (sm) fills its square, cropped
// around the centre, which on a bag is the label. The coffee page's photo (lg) keeps its own
// shape and is its own frame (CoffeePhoto.vue): shown whole inside a wider tinted frame, a
// portrait photo left a bar of the tint on each side.
const { src, alt, size = 'sm', eager = false } = defineProps<{
  src: string | null;
  // Empty where the photo only repeats the name next to it, as in the list rows.
  alt: string;
  size?: 'sm' | 'lg';
  eager?: boolean;
}>();
</script>

<template>
  <CoffeePhoto
    v-if="src && size === 'lg'"
    :src="src"
    :alt="alt"
    :eager="eager"
  />
  <!-- The tint under a thumbnail shows only until the file has loaded. -->
  <img
    v-else-if="src"
    :src="src"
    :alt="alt"
    :loading="eager ? 'eager' : 'lazy'"
    decoding="async"
    class="shrink-0 bg-primary-50 object-cover"
  >
  <CoffeeBeanArt
    v-else
    :size="size"
  />
</template>

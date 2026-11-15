<script setup lang="ts">
import type { Ref } from 'vue';

// The coffee page's photo, in its own shape (CoffeeImage.vue), and the way to a larger view: the
// whole photo is a button that opens it as large as the screen allows, in Nuxt UI's modal. From
// there the browser's own pinch-zoom does the rest, so there is no zoom-and-drag widget to
// build or to depend on. The modal shows the same file, which the browser already has.
const { src, alt, eager = false } = defineProps<{ src: string; alt: string; eager?: boolean }>();

const zoomed: Ref<boolean> = shallowRef(false);
</script>

<template>
  <!-- As wide as the photo, so the badge sits in the photo's corner and the caller's rounding
       clips the photo itself. -->
  <span class="relative block w-fit max-w-full shrink-0 overflow-hidden">
    <!-- Named by the photo's alt text plus the hidden label. -->
    <button
      type="button"
      class="block h-full cursor-zoom-in"
      @click="zoomed = true"
    >
      <img
        :src="src"
        :alt="alt"
        :loading="eager ? 'eager' : 'lazy'"
        decoding="async"
        class="h-full w-auto max-w-full object-contain"
      >
      <span class="sr-only">{{ $t('coffee.photoZoom') }}</span>
      <span
        class="absolute right-2 bottom-2 flex size-9 items-center justify-center rounded-full bg-default/90 text-highlighted ring ring-default"
        aria-hidden="true"
      >
        <UIcon
          name="i-lucide-zoom-in"
          class="size-5"
        />
      </span>
    </button>

    <UModal
      v-model:open="zoomed"
      fullscreen
      :title="alt"
      :ui="{ body: 'flex min-h-0 items-center justify-center p-2 sm:p-4' }"
    >
      <template #body>
        <img
          :src="src"
          :alt="alt"
          class="max-h-full max-w-full object-contain"
        >
      </template>
    </UModal>
  </span>
</template>

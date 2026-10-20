<script setup lang="ts">
// Stands in for the coffee's photo until image upload arrives (Phase 6).
const { size = 'sm' } = defineProps<{ size?: 'sm' | 'lg' }>();
</script>

<template>
  <span
    class="flex shrink-0 items-center justify-center bg-primary-50 text-primary"
    aria-hidden="true"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      :stroke-width="size === 'lg' ? 1.2 : 1.6"
      :class="size === 'lg' ? 'size-14' : 'size-6'"
    >
      <g transform="rotate(-32 12 12)">
        <ellipse
          cx="12"
          cy="12"
          rx="5.5"
          ry="8"
        />
        <path d="M12 4.5 C15 8 9 16 12 19.5" />
      </g>
    </svg>
  </span>
</template>

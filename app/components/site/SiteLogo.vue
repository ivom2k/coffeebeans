<script setup lang="ts">
// Inverted is the admin header's version from the UI canvas: a light circle and a dark bean on
// the dark band.
const { inverted = false } = defineProps<{ inverted?: boolean }>();
</script>

<template>
  <svg
    viewBox="0 0 64 64"
    aria-hidden="true"
  >
    <circle
      cx="32"
      cy="32"
      r="31"
      :class="inverted ? 'fill-primary-300' : 'fill-primary'"
    />
    <g transform="rotate(-32 32 32)">
      <ellipse
        cx="32"
        cy="32"
        rx="12.5"
        ry="18.5"
        :class="inverted ? 'fill-(--ui-bg-inverted)' : 'fill-white'"
      />
      <path
        d="M32 16.5 C39 25 25 39 32 47.5"
        fill="none"
        :class="inverted ? 'stroke-primary-300' : 'stroke-primary'"
        stroke-width="3.5"
        stroke-linecap="round"
      />
    </g>
  </svg>
</template>

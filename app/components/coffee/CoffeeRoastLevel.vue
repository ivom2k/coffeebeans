<script setup lang="ts">
// Declared roast on the bag's 1 light .. 5 dark scale (decisions log §4). One group of
// the package details <dl>, so it holds only <dt> and <dd>.
defineProps<{ level: number }>();
</script>

<template>
  <div class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-[15px]">
    <dt class="text-muted">
      {{ $t('coffee.roastLevel') }}
    </dt>
    <dd class="font-semibold">
      {{ $t('coffee.roastValue', { level }) }}
    </dd>
    <dd class="col-span-2">
      <div
        role="img"
        :aria-label="$t('coffee.roastBarLabel', { level })"
        class="grid grid-cols-5 gap-1"
      >
        <span
          v-for="segment in 5"
          :key="segment"
          class="h-2.5 rounded-sm"
          :class="segment <= level ? 'bg-primary' : 'bg-(--ui-border-muted)'"
        />
      </div>
      <div
        class="mt-2 flex justify-between text-[13px] text-muted"
        aria-hidden="true"
      >
        <span>{{ $t('coffee.roastLight') }}</span>
        <span>{{ $t('coffee.roastDark') }}</span>
      </div>
    </dd>
  </div>
</template>

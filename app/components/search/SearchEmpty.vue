<script setup lang="ts">
defineProps<{ title: string; hint: string }>();

const localePath = useLocalePath();
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col items-center gap-3 px-4 py-8 text-center">
      <CoffeeBeanArt
        size="lg"
        class="size-22 rounded-full"
      />
      <h2 class="text-xl font-bold text-highlighted">
        {{ title }}
      </h2>
      <p class="text-[15px] leading-normal text-muted">
        {{ hint }}
      </p>
    </div>
    <UButton
      :to="localePath('/')"
      color="neutral"
      variant="outline"
      size="xl"
      block
      :label="$t('search.showRanking')"
    />
  </div>
</template>

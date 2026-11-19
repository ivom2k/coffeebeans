<script setup lang="ts">
import type { Ref } from 'vue';

// The footer from the UI canvas, with only the links whose pages exist: "Meist", "Privaatsus"
// and "Soovita kohvi" join with their pages. It is part of every cached page, so its markup is
// the same for everyone and the feedback sheet opens in the browser.
const feedbackOpen: Ref<boolean> = shallowRef(false);
</script>

<template>
  <footer class="border-t border-default">
    <UContainer class="flex flex-wrap gap-x-5 pt-4 pb-7">
      <UButton
        :label="$t('feedback.open')"
        variant="link"
        class="px-0 py-3 text-[15px]"
        @click="feedbackOpen = true"
      />
    </UContainer>
    <FeedbackSheet v-model:open="feedbackOpen" />
  </footer>
</template>

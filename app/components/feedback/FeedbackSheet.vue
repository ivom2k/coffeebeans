<script setup lang="ts">
import type { Ref } from 'vue';
import { maxFeedbackLength } from '#shared/utils/feedback';

// The feedback sheet from the UI canvas, opened from the footer of every public page. Those pages
// are cached for everyone, so it renders closed and the same for all, and talks to the server
// only when sent. The canvas's "Soovita kohvi" tab joins once that page exists (Phase 7.2).
const open = defineModel<boolean>('open', { required: true });

const { t } = useI18n();
const route = useRoute();
const toast = useToast();

const message: Ref<string> = shallowRef('');
// The honeypot. People never see or reach it; a bot that fills in every field gives itself away.
const website: Ref<string> = shallowRef('');
const sending: Ref<boolean> = shallowRef(false);
const failure: Ref<string | null> = shallowRef(null);

const canSend = computed(() => message.value.trim() !== '' && !sending.value);

const send = async () => {
  sending.value = true;
  failure.value = null;
  try {
    // The path without its query: the server keeps no more than that either.
    await $fetch('/api/feedback', {
      method: 'POST',
      body: { message: message.value, pagePath: route.path, website: website.value },
    });
    message.value = '';
    open.value = false;
    toast.add({ title: t('feedback.sent'), color: 'success', icon: 'i-lucide-check' });
  } catch (error) {
    failure.value = statusCodeOf(error) === 429 ? t('feedback.tooMany') : t('feedback.failed');
  } finally {
    sending.value = false;
  }
};
</script>

<template>
  <UDrawer
    v-model:open="open"
    :title="$t('feedback.title')"
    :ui="{
      content: 'mx-auto max-w-lg',
      container: 'px-5 pt-3 pb-7',
      title: 'text-[22px]/tight font-bold',
    }"
  >
    <template #body>
      <form
        class="relative flex flex-col gap-2"
        @submit.prevent="send"
      >
        <UFormField
          :label="$t('feedback.message')"
          name="message"
          size="xl"
          :ui="{ label: 'font-semibold' }"
        >
          <UTextarea
            v-model="message"
            :rows="5"
            :maxlength="maxFeedbackLength"
            :placeholder="$t('feedback.placeholder')"
            autoresize
            class="w-full"
          />
        </UFormField>
        <input
          v-model="website"
          type="text"
          name="website"
          tabindex="-1"
          autocomplete="off"
          aria-hidden="true"
          class="absolute left-[-9999px] size-px"
        >
        <div class="flex justify-between text-sm text-muted">
          <span>{{ $t('feedback.noAccount') }}</span>
          <span>{{ $t('feedback.count', { count: message.length, max: maxFeedbackLength }) }}</span>
        </div>
        <p
          v-if="failure"
          role="alert"
          class="text-sm text-error"
        >
          {{ failure }}
        </p>
        <UButton
          type="submit"
          :label="$t('feedback.send')"
          :loading="sending"
          :disabled="!canSend"
          size="xl"
          block
          class="mt-2 h-13.5 text-[17px]"
        />
      </form>
    </template>
  </UDrawer>
</template>

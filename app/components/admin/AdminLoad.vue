<script setup lang="ts">
import type { AsyncDataRequestStatus } from '#app';
import type { Ref } from 'vue';

// What an admin page shows until its data is in: a spinner, the sign-in sheet for a visitor who
// isn't signed in (401), a plain refusal for a signed-in non-admin (403), or the page itself.
// The server decides who is an admin; this only explains its answer.
const props = defineProps<{
  status: AsyncDataRequestStatus;
  error: { statusCode?: number } | null | undefined;
  notFoundText?: string;
}>();

const sheetOpen: Ref<boolean> = shallowRef(false);
const statusCode = computed(() => props.error?.statusCode);
</script>

<template>
  <slot v-if="status === 'success'" />
  <div
    v-else-if="statusCode === 401"
    class="flex flex-col items-start gap-3"
  >
    <p class="text-muted">
      {{ $t('admin.signInText') }}
    </p>
    <UButton
      :label="$t('auth.signIn')"
      size="xl"
      @click="sheetOpen = true"
    />
    <AuthSignInSheet v-model:open="sheetOpen" />
  </div>
  <div
    v-else-if="statusCode === 403"
    role="alert"
    class="flex flex-col gap-1"
  >
    <strong class="text-lg text-highlighted">{{ $t('admin.forbiddenTitle') }}</strong>
    <p class="text-muted">
      {{ $t('admin.forbiddenText') }}
    </p>
  </div>
  <p
    v-else-if="status === 'error'"
    role="alert"
    class="text-error"
  >
    {{ statusCode === 404 && notFoundText ? notFoundText : $t('admin.loadFailed') }}
  </p>
  <div
    v-else
    class="flex justify-center py-10"
  >
    <UIcon
      name="i-lucide-loader-circle"
      class="size-6 animate-spin text-muted"
    />
  </div>
</template>

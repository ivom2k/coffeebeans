<script setup lang="ts">
import type { Ref } from 'vue';

const { t } = useI18n();
const localePath = useLocalePath();
const { loggedIn, ready, clear } = useUserSession();
const sheetOpen: Ref<boolean> = shallowRef(false);

useSeoMeta({ title: () => t('account.title') });
useRobotsRule(false);

const signOut = async () => {
  await clear();
  await navigateTo(localePath('/'));
};
</script>

<!-- Later phases add their sections from the canvas: machines (5), suggestions (7), the data
     export and account deletion (8). -->
<template>
  <div class="flex max-w-xl flex-col gap-6">
    <!-- The session is known only in the browser. -->
    <div class="flex flex-col gap-1">
      <h1 class="text-[26px] leading-tight font-bold tracking-[-0.01em] text-highlighted">
        {{ $t('account.title') }}
      </h1>
      <ClientOnly>
        <p
          v-if="ready && loggedIn"
          class="text-[15px] text-muted"
        >
          {{ $t('account.signedInWith') }}
        </p>
      </ClientOnly>
    </div>

    <ClientOnly>
      <template v-if="ready">
        <div
          v-if="loggedIn"
          class="overflow-hidden rounded-lg bg-default ring ring-default ring-inset"
        >
          <UButton
            :label="$t('account.signOut')"
            icon="i-lucide-log-out"
            color="neutral"
            variant="ghost"
            size="xl"
            block
            class="min-h-14 justify-start rounded-none px-4"
            @click="signOut"
          />
        </div>
        <div
          v-else
          class="flex flex-col items-start gap-3"
        >
          <p class="text-muted">
            {{ $t('account.signedOut') }}
          </p>
          <UButton
            :label="$t('auth.signIn')"
            size="xl"
            @click="sheetOpen = true"
          />
          <AuthSignInSheet v-model:open="sheetOpen" />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type { Ref } from 'vue';

// "Minu ettepanekud" (decisions log §6). The server renders only the heading; the list is the
// user's own and loads in the browser.
const { t } = useI18n();
const localePath = useLocalePath();
const { loggedIn, ready } = useUserSession();
const sheetOpen: Ref<boolean> = shallowRef(false);

useSeoMeta({ title: () => t('suggestion.mine') });
useRobotsRule(false);
</script>

<template>
  <div class="flex max-w-xl flex-col gap-4">
    <SiteBackLink
      to="/konto"
      :label="$t('account.title')"
    />
    <div class="flex items-center justify-between gap-3">
      <h1 class="text-[26px] leading-tight font-bold tracking-[-0.01em] text-highlighted">
        {{ $t('suggestion.mine') }}
      </h1>
      <UButton
        :to="localePath('/soovita')"
        :label="$t('suggestion.new')"
        :aria-label="$t('suggestion.newLabel')"
        color="neutral"
        variant="outline"
        size="xl"
        class="h-11 shrink-0 text-[15px]"
      />
    </div>

    <ClientOnly>
      <template v-if="ready">
        <SuggestionList v-if="loggedIn" />
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

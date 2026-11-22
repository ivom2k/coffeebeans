<script setup lang="ts">
import type { Ref } from 'vue';
import type { SuggestionType } from '#shared/types/suggestion';

// Suggest a coffee or a machine (decisions log §6). Not cached, and the server renders only the
// heading, which depends on nothing but the URL: the form and the signed-in check run in the
// browser. ?tyyp=masin opens it on the machine form, as "Soovita masinat" on the account page does.
const { t } = useI18n();
const route = useRoute();
const { loggedIn, ready } = useUserSession();

const type: Ref<SuggestionType> = shallowRef(route.query.tyyp === 'masin' ? 'MACHINE_MODEL' : 'COFFEE_BEAN');
const sent: Ref<boolean> = shallowRef(false);
const sheetOpen: Ref<boolean> = shallowRef(false);

useSeoMeta({ title: () => t(`suggestion.title.${type.value}`) });
useRobotsRule(false);
</script>

<template>
  <SuggestionSent v-if="sent" />
  <div
    v-else
    class="flex max-w-xl flex-col gap-5"
  >
    <div class="flex flex-col gap-1.5">
      <h1 class="text-[26px] leading-tight font-bold tracking-[-0.01em] text-highlighted">
        {{ $t(`suggestion.title.${type}`) }}
      </h1>
      <p class="text-[15px]/normal text-muted">
        {{ $t(`suggestion.lead.${type}`) }}
      </p>
    </div>

    <ClientOnly>
      <template v-if="ready">
        <SuggestionForm
          v-if="loggedIn"
          v-model:type="type"
          @sent="sent = true"
        />
        <div
          v-else
          class="flex flex-col items-start gap-3"
        >
          <p class="text-muted">
            {{ $t('suggestion.signedOutText') }}
          </p>
          <UButton
            :label="$t('auth.signIn')"
            size="xl"
            @click="sheetOpen = true"
          />
          <AuthSignInSheet
            v-model:open="sheetOpen"
            :title="$t('suggestion.signInTitle')"
          />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

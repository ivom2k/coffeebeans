<script setup lang="ts">
import type { Ref } from 'vue';

const { t, locale } = useI18n();
const route = useRoute();
const localePath = useLocalePath();

// Only the coffee's name comes from the server, through the same cached endpoint as the coffee
// page. This page falls under the /kohv/** swr rule too, which is safe because everything
// per-user on it renders in the browser.
const slug = computed(() => String(route.params.slug));
const { data, error } = await useFetch(() => `/api/coffees/${encodeURIComponent(slug.value)}`, {
  query: { locale },
});
if (error.value) {
  throw createError({ statusCode: error.value.statusCode, statusMessage: error.value.statusMessage, fatal: true });
}
if (data.value?.kind === 'redirect') {
  await navigateTo(localePath(`/kohv/${data.value.slug}/hinda`), { redirectCode: 301 });
}

const coffee = computed(() => (data.value?.kind === 'coffee' ? data.value.coffee : null));
const fullName = computed(() => (coffee.value ? `${coffee.value.brand.name} ${coffee.value.name}` : ''));

useSeoMeta({ title: () => t('rating.pageTitle', { name: fullName.value }) });
useRobotsRule(false);

const { loggedIn, ready } = useUserSession();
const sheetOpen: Ref<boolean> = shallowRef(false);
</script>

<template>
  <div
    v-if="coffee"
    class="flex max-w-xl flex-col gap-6"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex flex-col gap-0.5">
        <span class="text-[15px] text-muted">{{ $t('rating.eyebrow') }}</span>
        <h1 class="text-2xl/tight font-bold text-highlighted">
          {{ fullName }}
        </h1>
      </div>
      <UButton
        :to="localePath(`/kohv/${coffee.slug}`)"
        icon="i-lucide-x"
        :aria-label="$t('rating.close')"
        color="neutral"
        variant="ghost"
        size="xl"
        class="size-11 shrink-0 justify-center"
      />
    </div>

    <ClientOnly>
      <template v-if="ready">
        <RatingEditor
          v-if="loggedIn"
          :slug="coffee.slug"
        />
        <div
          v-else
          class="flex flex-col items-start gap-3"
        >
          <p class="text-muted">
            {{ $t('rating.signedOutText') }}
          </p>
          <UButton
            :label="$t('auth.signIn')"
            size="xl"
            @click="sheetOpen = true"
          />
          <AuthSignInSheet
            v-model:open="sheetOpen"
            :title="$t('rating.signInTitle')"
          />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

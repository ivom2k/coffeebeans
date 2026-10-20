<script setup lang="ts">
import type { NuxtError } from '#app';
import { et } from '@nuxt/ui/locale';

const props = defineProps<{ error: NuxtError }>();

const { t } = useI18n();
const localePath = useLocalePath();

const notFound = computed(() => props.error.statusCode === 404);

useSeoMeta({ title: () => (notFound.value ? t('error.notFoundTitle') : t('error.title')) });
useRobotsRule(false);

const goHome = () => clearError({ redirect: localePath('/') });
</script>

<!-- Nuxt renders this instead of app.vue, so it brings its own UApp and layout. -->
<template>
  <UApp :locale="et">
    <NuxtLayout>
      <div class="flex max-w-xl flex-col gap-3">
        <h1 class="text-[26px] leading-tight font-bold tracking-[-0.01em] text-highlighted">
          {{ notFound ? $t('error.notFoundTitle') : $t('error.title') }}
        </h1>
        <p class="leading-normal text-muted">
          {{ notFound ? $t('error.notFoundText') : $t('error.text') }}
        </p>
        <UButton
          size="xl"
          class="self-start"
          :label="$t('error.home')"
          @click="goHome"
        />
      </div>
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
import type { Ref } from 'vue';

// "Hinda" on the coffee page. Signed out, it opens the sign-in sheet, which comes back to the
// rating form itself. Per-user, so the page puts it in <ClientOnly>.
const props = withDefaults(defineProps<{ slug: string; label?: string; outline?: boolean }>(), {
  label: undefined,
  outline: false,
});

const { t } = useI18n();
const localePath = useLocalePath();
const { loggedIn, ready } = useUserSession();
const sheetOpen: Ref<boolean> = shallowRef(false);

const buttonLabel = computed(() => props.label ?? t('rating.rate'));
</script>

<template>
  <div
    v-if="!ready"
    class="h-13"
  />
  <RatingOwnAction
    v-else-if="loggedIn"
    :slug="slug"
    :label="buttonLabel"
    :outline="outline"
  />
  <template v-else>
    <UButton
      :label="buttonLabel"
      :color="outline ? 'neutral' : 'primary'"
      :variant="outline ? 'outline' : 'solid'"
      size="xl"
      block
      class="h-13 text-[17px]"
      @click="sheetOpen = true"
    />
    <AuthSignInSheet
      v-model:open="sheetOpen"
      :title="$t('rating.signInTitle')"
      :redirect="localePath(`/kohv/${slug}/hinda`)"
    />
  </template>
</template>

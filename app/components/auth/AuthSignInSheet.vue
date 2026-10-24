<script setup lang="ts">
// The sign-in sheet from the UI canvas. The header opens it with the default title; the rating
// button opens it with its own ("Logi sisse, et hinnata") and the rating form as the way back.
const props = defineProps<{ title?: string; redirect?: string }>();
const open = defineModel<boolean>('open', { required: true });

const route = useRoute();
// Back to this page afterwards unless told otherwise. The server accepts only a path on this site.
const signInUrl = computed(() => `/api/auth/google?redirect=${encodeURIComponent(props.redirect ?? route.fullPath)}`);
</script>

<template>
  <UDrawer
    v-model:open="open"
    :title="title ?? $t('auth.signIn')"
    :description="$t('auth.lead')"
    :ui="{
      content: 'mx-auto max-w-lg',
      container: 'px-5 pt-3 pb-8',
      title: 'text-2xl/tight font-bold',
      description: 'mt-3 text-base/normal text-toned',
    }"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <!-- A full page load, not router navigation: the server sends the browser on to Google. -->
        <UButton
          :to="signInUrl"
          external
          :label="$t('auth.continueWithGoogle')"
          color="neutral"
          variant="outline"
          size="xl"
          block
          class="h-13.5 gap-2.5 text-[17px]"
        >
          <template #leading>
            <AuthGoogleMark class="size-6" />
          </template>
        </UButton>
        <p class="flex gap-2.5 rounded-md bg-elevated px-3.5 py-3 text-sm/[1.45] text-toned">
          <UIcon
            name="i-lucide-lock"
            class="size-5 shrink-0"
          />
          {{ $t('auth.privacy') }}
        </p>
      </div>
    </template>
    <template #footer>
      <UButton
        :label="$t('auth.notNow')"
        variant="link"
        size="xl"
        class="self-center"
        @click="open = false"
      />
    </template>
  </UDrawer>
</template>

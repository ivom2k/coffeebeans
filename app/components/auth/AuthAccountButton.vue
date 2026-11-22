<script setup lang="ts">
import type { Ref } from 'vue';

// Renders only in the browser (<ClientOnly> in the header), and only once the session check
// has answered, so a signed-in visitor never sees "Logi sisse" flash first.
const { loggedIn, ready } = useUserSession();
const sheetOpen: Ref<boolean> = shallowRef(false);
</script>

<template>
  <template v-if="ready">
    <AuthAccountLink v-if="loggedIn" />
    <template v-else>
      <UButton
        :label="$t('auth.signIn')"
        size="xl"
        class="h-11 px-3.5 text-[15px]"
        @click="sheetOpen = true"
      />
      <AuthSignInSheet v-model:open="sheetOpen" />
    </template>
  </template>
</template>

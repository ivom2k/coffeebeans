<script setup lang="ts">
import type { Ref } from 'vue';

// The price-tag photo. Two ways in on a phone: the camera straight away, or any picture already
// taken. A desktop browser ignores `capture` and would open the same file picker twice, so the
// camera button shows only where the main pointer is a finger (pointer-coarse). HEIC is left out
// of `accept` (decisions log §6); the photo is made ready here before it is shown and sent.
const photo = defineModel<File | null>({ required: true });
const emit = defineEmits<{ failure: [message: string | null] }>();

const { t } = useI18n();
const chosen: Ref<File | null> = shallowRef(null);
const preparing: Ref<boolean> = shallowRef(false);
const accept = 'image/jpeg,image/png,image/webp';

watch(chosen, async (file) => {
  if (!file) {
    return;
  }
  chosen.value = null;
  preparing.value = true;
  emit('failure', null);
  const prepared = await preparePhoto(file);
  preparing.value = false;
  if (prepared.kind === 'tooLarge') {
    emit('failure', t('suggestion.photoTooLarge'));
    return;
  }
  photo.value = prepared.file;
});

// The preview is the prepared copy, so the user sees what is sent. Its URL is released whenever
// the photo changes and when the form goes away.
const previewUrl = computed(() => (photo.value ? URL.createObjectURL(photo.value) : null));
watch(previewUrl, (_url, previous) => {
  if (previous) {
    URL.revokeObjectURL(previous);
  }
});
onBeforeUnmount(() => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <span
      id="suggestion-photo-label"
      class="font-semibold text-highlighted"
    >{{ $t('suggestion.photo') }}</span>

    <div
      v-if="photo && previewUrl"
      class="flex items-center gap-4 rounded-lg bg-default p-3 ring ring-default ring-inset"
    >
      <img
        :src="previewUrl"
        :alt="$t('suggestion.photoPreview')"
        class="size-24 rounded-md bg-elevated object-cover"
      >
      <UButton
        :label="$t('suggestion.photoRemove')"
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        size="xl"
        class="h-11"
        @click="photo = null"
      />
    </div>

    <div
      v-else
      role="group"
      aria-labelledby="suggestion-photo-label"
      class="flex flex-col gap-2"
    >
      <UFileUpload
        v-slot="{ open }"
        v-model="chosen"
        :accept="accept"
        capture="environment"
        :dropzone="false"
        :interactive="false"
        reset
        class="hidden pointer-coarse:flex"
      >
        <UButton
          :label="$t('suggestion.photoCamera')"
          icon="i-lucide-camera"
          size="xl"
          block
          :loading="preparing"
          class="h-13 text-base"
          @click="open()"
        />
      </UFileUpload>
      <UFileUpload
        v-slot="{ open }"
        v-model="chosen"
        :accept="accept"
        :dropzone="false"
        :interactive="false"
        reset
      >
        <UButton
          :label="$t('suggestion.photoChoose')"
          icon="i-lucide-image"
          color="neutral"
          variant="outline"
          size="xl"
          block
          :loading="preparing"
          class="h-13 text-base"
          @click="open()"
        />
      </UFileUpload>
    </div>

    <p class="text-sm/normal text-muted">
      {{ $t('suggestion.photoPrivacy') }}
    </p>
  </div>
</template>

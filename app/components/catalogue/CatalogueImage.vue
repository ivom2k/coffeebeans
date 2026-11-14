<script setup lang="ts">
import type { Ref } from 'vue';

// The coffee's photo, saved as soon as it is chosen. The server re-encodes it (decisions log §4),
// so what shows here afterwards is what visitors get. HEIC isn't offered, so iPhones send JPEG:
// sharp's prebuilt binaries can't decode HEIC (§6).
defineProps<{ imageUrl: string | null; busy: boolean }>();
const emit = defineEmits<{ upload: [file: File]; remove: [] }>();

const chosen: Ref<File | null> = shallowRef(null);
watch(chosen, (file) => {
  if (file) {
    emit('upload', file);
    chosen.value = null;
  }
});
</script>

<template>
  <section class="flex flex-wrap items-center gap-5 rounded-lg bg-default p-5 ring ring-default ring-inset lg:p-6">
    <img
      v-if="imageUrl"
      :src="imageUrl"
      :alt="$t('catalogue.photoCurrent')"
      class="h-30 w-40 rounded-md bg-primary-50 object-contain"
    >
    <CoffeeBeanArt
      v-else
      size="lg"
      class="h-30 w-40 rounded-md"
    />
    <div class="flex min-w-0 flex-1 basis-70 flex-col items-start gap-2">
      <h2 class="text-[17px] font-bold text-highlighted">
        {{ $t('catalogue.photo') }}
      </h2>
      <p class="text-sm/normal text-muted">
        {{ $t('catalogue.photoLead') }}
      </p>
      <div class="flex flex-wrap gap-2">
        <UFileUpload
          v-slot="{ open }"
          v-model="chosen"
          accept="image/jpeg,image/png,image/webp"
          :dropzone="false"
          :interactive="false"
          reset
        >
          <UButton
            :label="$t('catalogue.photoChoose')"
            icon="i-lucide-image-up"
            color="neutral"
            variant="outline"
            size="lg"
            :loading="busy"
            @click="open()"
          />
        </UFileUpload>
        <UButton
          v-if="imageUrl"
          :label="$t('catalogue.photoRemove')"
          color="error"
          variant="ghost"
          size="lg"
          :disabled="busy"
          @click="emit('remove')"
        />
      </div>
    </div>
  </section>
</template>

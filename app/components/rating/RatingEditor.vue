<script setup lang="ts">
import type { Ref } from 'vue';
import type { RatingInput } from '#shared/types/rating';

// The signed-in part of the rating page. It loads the user's machines and any earlier
// rating, saves, then returns to the coffee page, whose numbers are already fresh: the save
// emptied the page cache.
const props = defineProps<{ slug: string }>();

const { t } = useI18n();
const toast = useToast();
const localePath = useLocalePath();
const { rating, status, save } = useMyRating(() => props.slug);
const { machines, status: machinesStatus } = useMyMachines();
const saving: Ref<boolean> = shallowRef(false);

const loaded = computed(() => status.value === 'success' && machinesStatus.value === 'success');
const failed = computed(() => status.value === 'error' || machinesStatus.value === 'error');

const submit = async (input: RatingInput) => {
  saving.value = true;
  const saved = await save(input).then(() => true, () => false);
  saving.value = false;
  if (!saved) {
    toast.add({ title: t('rating.saveFailed'), color: 'error', icon: 'i-lucide-circle-alert' });
    return;
  }
  toast.add({ title: t('rating.saved'), color: 'success', icon: 'i-lucide-check' });
  await navigateTo(localePath(`/kohv/${props.slug}`));
};
</script>

<template>
  <RatingForm
    v-if="loaded"
    :initial="rating"
    :machines="machines"
    :saving="saving"
    @submit="submit"
  />
  <p
    v-else-if="failed"
    role="alert"
    class="text-error"
  >
    {{ $t('rating.loadFailed') }}
  </p>
  <div
    v-else
    class="flex justify-center py-10"
  >
    <UIcon
      name="i-lucide-loader-circle"
      class="size-6 animate-spin text-muted"
    />
  </div>
</template>

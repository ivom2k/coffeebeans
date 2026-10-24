<script setup lang="ts">
import type { MyRating } from '#shared/types/rating';

// The signed-in user's own rating on the coffee page, private note included. It only ever
// renders in the browser, since the page around it is cached for every visitor.
const props = defineProps<{ rating: MyRating; slug: string }>();

const { t } = useI18n();
const localePath = useLocalePath();

const issueFacts = computed(() => {
  const { machineIssues } = props.rating;
  if (machineIssues === null) {
    return [];
  }
  return machineIssues.length === 0 ? [t('rating.noIssues')] : machineIssues.map(code => t(`machineIssue.${code}`));
});
const facts = computed(() => [
  ...(props.rating.beanSurface ? [t(`beanSurface.${props.rating.beanSurface}`)] : []),
  ...issueFacts.value,
]);
</script>

<template>
  <section
    aria-labelledby="your-rating-heading"
    class="flex flex-col gap-3.5 rounded-lg bg-primary-50 p-5"
  >
    <div class="flex items-center justify-between gap-3">
      <h2
        id="your-rating-heading"
        class="text-lg font-bold text-highlighted"
      >
        {{ $t('rating.yours') }}
      </h2>
      <UButton
        :to="localePath(`/kohv/${slug}/hinda`)"
        :label="$t('rating.edit')"
        :aria-label="$t('rating.editLabel')"
        variant="link"
        class="h-11 px-1 text-[15px] font-semibold"
      />
    </div>
    <div class="flex items-center gap-3">
      <span class="flex size-14 shrink-0 items-center justify-center rounded-md bg-primary text-[28px] font-bold text-inverted">
        {{ rating.score }}<span class="sr-only"> / 5</span>
      </span>
      <span class="flex min-w-0 flex-col gap-0.5 text-[15px]">
        <span
          v-if="rating.machine"
          class="font-semibold text-highlighted"
        >{{ rating.machine.manufacturerName }} {{ rating.machine.modelName }}</span>
        <span
          v-if="facts.length > 0"
          class="text-toned"
        >{{ facts.join(' · ') }}</span>
      </span>
    </div>
    <p
      v-if="rating.privateNote"
      class="flex gap-2 rounded-md bg-default px-3.5 py-3 text-[15px]/[1.45]"
    >
      <UIcon
        name="i-lucide-lock"
        class="mt-0.5 size-4.5 shrink-0 text-muted"
      />
      <!-- Plain text interpolation: the note is user input (never v-html). -->
      <span class="min-w-0 wrap-break-word whitespace-pre-line"><span class="sr-only">{{ $t('rating.private') }}: </span>{{ rating.privateNote }}</span>
    </p>
  </section>
</template>

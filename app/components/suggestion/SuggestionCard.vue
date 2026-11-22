<script setup lang="ts">
import type { MySuggestion } from '#shared/types/suggestion';

// One card on "Minu ettepanekud", in the four kinds from the UI canvas. Everything here is the
// user's own text or the catalogue's, shown as text; the user's link is never made a link, it's
// only shown so they recognise what they sent.
const props = defineProps<{ suggestion: MySuggestion }>();

const { t } = useI18n();
const { formatDate } = useFormatters();
const localePath = useLocalePath();

const title = computed(() => {
  const { suggestion } = props;
  if (suggestion.type === 'MACHINE_MODEL') {
    return `${suggestion.details.manufacturer} ${suggestion.details.model}`;
  }
  return suggestion.details.name ?? suggestion.details.url ?? t('suggestion.photoOnly');
});

const badge = computed(() => {
  const colors = { waiting: 'neutral', added: 'success', exists: 'primary', rejected: 'error' } as const;
  const { kind } = props.suggestion.outcome;
  return { color: colors[kind], label: t(`suggestion.outcome.${kind}`) };
});
</script>

<template>
  <article
    class="flex flex-col gap-3 rounded-xl bg-default p-4 ring-inset"
    :class="suggestion.unread ? 'ring-2 ring-primary' : 'ring ring-default'"
  >
    <div class="flex items-center justify-between gap-2">
      <UBadge
        :color="badge.color"
        variant="soft"
        :label="badge.label"
        class="rounded-full px-2.5 py-1 text-[13px]"
      />
      <span
        v-if="suggestion.unread"
        class="flex items-center gap-1.5 text-[13px] font-semibold text-error"
      >
        <span class="size-2 rounded-full bg-error" />{{ $t('suggestion.unread') }}
      </span>
    </div>

    <div class="flex flex-col gap-0.5">
      <span class="text-[13px] text-muted">
        {{ $t('suggestion.sentOn', { type: $t(`suggestion.type.${suggestion.type}`), date: formatDate(suggestion.createdAt) }) }}
      </span>
      <h2 class="text-lg font-bold wrap-anywhere text-highlighted">
        {{ title }}
      </h2>
    </div>

    <template v-if="suggestion.outcome.kind === 'added' && 'coffee' in suggestion.outcome">
      <div class="flex gap-2">
        <UButton
          :to="localePath(`/kohv/${suggestion.outcome.coffee.slug}/hinda`)"
          :label="$t('suggestion.rate')"
          size="xl"
          block
          class="h-12 flex-1"
        />
        <UButton
          :to="localePath(`/kohv/${suggestion.outcome.coffee.slug}`)"
          :label="$t('suggestion.openCoffee')"
          color="neutral"
          variant="outline"
          size="xl"
          block
          class="h-12 flex-1"
        />
      </div>
    </template>

    <NuxtLinkLocale
      v-else-if="suggestion.outcome.kind === 'exists' && 'coffee' in suggestion.outcome"
      :to="`/kohv/${suggestion.outcome.coffee.slug}`"
      class="flex items-center justify-between gap-3 rounded-md bg-muted p-3 text-default"
    >
      <span class="flex min-w-0 flex-col gap-0.5">
        <span class="text-[13px] text-muted">{{ suggestion.outcome.coffee.brandName }}</span>
        <span class="font-semibold wrap-anywhere">{{ suggestion.outcome.coffee.name }}</span>
      </span>
      <UIcon
        name="i-lucide-chevron-right"
        class="size-5 shrink-0 text-muted"
      />
    </NuxtLinkLocale>

    <p
      v-else-if="(suggestion.outcome.kind === 'added' || suggestion.outcome.kind === 'exists') && 'machine' in suggestion.outcome"
      class="text-[15px]/normal"
    >
      {{ $t(`suggestion.machine.${suggestion.outcome.kind}`, {
        name: `${suggestion.outcome.machine.manufacturerName} ${suggestion.outcome.machine.modelName}`,
      }) }}
      <NuxtLinkLocale
        to="/konto"
        class="font-semibold text-primary"
      >
        {{ $t('suggestion.machine.toMachines') }}
      </NuxtLinkLocale>
    </p>

    <dl
      v-else-if="suggestion.outcome.kind === 'rejected'"
      class="flex flex-col gap-1.5 text-[15px]/normal"
    >
      <div class="flex gap-1.5">
        <dt class="text-muted">
          {{ $t('suggestion.reasonLabel') }}
        </dt>
        <dd class="font-semibold">
          {{ $t(`suggestion.reason.${suggestion.outcome.reason}`) }}
        </dd>
      </div>
      <div
        v-if="suggestion.outcome.note"
        class="rounded-md bg-muted px-3 py-2.5"
      >
        <dt class="sr-only">
          {{ $t('suggestion.note') }}
        </dt>
        <dd class="whitespace-pre-wrap wrap-anywhere">
          {{ suggestion.outcome.note }}
        </dd>
      </div>
    </dl>
  </article>
</template>

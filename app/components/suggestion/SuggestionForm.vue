<script setup lang="ts">
import type { Ref } from 'vue';
import type { SuggestionInput, SuggestionType } from '#shared/types/suggestion';
import { toHttpUrl } from '#shared/utils/httpUrl';
import { suggestionFieldLengths } from '#shared/utils/suggestion';

// The suggestion form from the UI canvas, for a signed-in user, in the browser only. Coffee: at
// least one of a name, a link and a price-tag photo (decisions log §4). Machine: manufacturer and
// model. The server checks all of it again; these checks only save a round trip.
const type = defineModel<SuggestionType>('type', { required: true });
const emit = defineEmits<{ sent: [] }>();

const { t } = useI18n();

const name: Ref<string> = shallowRef('');
const url: Ref<string> = shallowRef('');
const photo: Ref<File | null> = shallowRef(null);
const manufacturer: Ref<string> = shallowRef('');
const model: Ref<string> = shallowRef('');
const kind: Ref<'AUTOMATIC' | 'PORTAFILTER' | null> = shallowRef(null);
const sending: Ref<boolean> = shallowRef(false);
const failure: Ref<string | null> = shallowRef(null);
const photoFailure: Ref<string | null> = shallowRef(null);

const typeOptions = computed(() => (['COFFEE_BEAN', 'MACHINE_MODEL'] as const)
  .map(value => ({ value, label: t(`suggestion.type.${value}`) })));
const kindOptions = computed(() => (['AUTOMATIC', 'PORTAFILTER'] as const)
  .map(value => ({ value, label: t(`machineKind.${value}`) })));

// The same check as the server's, shown as the link is typed.
const link = computed(() => url.value.trim());
const linkInvalid = computed(() => link.value !== '' && toHttpUrl(link.value) === null);

const canSend = computed(() => {
  if (sending.value) {
    return false;
  }
  if (type.value === 'MACHINE_MODEL') {
    return manufacturer.value.trim() !== '' && model.value.trim() !== '';
  }
  return !linkInvalid.value && (name.value.trim() !== '' || link.value !== '' || photo.value !== null);
});

const details = (): SuggestionInput => (type.value === 'COFFEE_BEAN'
  ? { suggestionType: 'COFFEE_BEAN', name: name.value.trim() || null, url: link.value || null }
  : { suggestionType: 'MACHINE_MODEL', manufacturer: manufacturer.value.trim(), model: model.value.trim(), kind: kind.value });

// What each refusal means for the user, by its status and the server's reason.
const failureMessage = (error: unknown): string => {
  const reason = failureReasonOf(error);
  switch (statusCodeOf(error)) {
    case 409:
      return t('suggestion.errors.accountLimit');
    case 429:
      // The same account's previous upload is still arriving, from another tab: not "too many".
      return reason === 'inProgress' ? t('suggestion.errors.busy') : t('suggestion.errors.tooMany');
    case 503:
      if (reason === 'photoQueueFull') {
        return t('suggestion.errors.photoQueueFull');
      }
      return reason === 'queueFull' ? t('suggestion.errors.queueFull') : t('suggestion.errors.busy');
    case 413:
      return t('suggestion.photoTooLarge');
    case 422:
      return t('suggestion.errors.photoUnsupported');
    case 400:
      return reason === 'empty' ? t('suggestion.needsSomething') : t('suggestion.errors.invalid');
    default:
      return t('suggestion.errors.failed');
  }
};

const send = async () => {
  sending.value = true;
  failure.value = null;
  // A FormData body: the browser sets the multipart type and its boundary itself.
  const form = new FormData();
  form.append('details', JSON.stringify(details()));
  if (type.value === 'COFFEE_BEAN' && photo.value) {
    form.append('photo', photo.value);
  }
  try {
    await $fetch('/api/me/suggestions', { method: 'POST', body: form });
    emit('sent');
  } catch (error) {
    failure.value = failureMessage(error);
  } finally {
    sending.value = false;
  }
};
</script>

<template>
  <form
    class="flex flex-col gap-5"
    @submit.prevent="send"
  >
    <RatingSegmentControl
      v-model="type"
      :options="typeOptions"
      :label="$t('suggestion.typeGroup')"
      :clearable="false"
    />

    <template v-if="type === 'COFFEE_BEAN'">
      <div class="flex flex-col gap-2">
        <UFormField
          :label="$t('suggestion.name')"
          name="name"
          size="xl"
          :ui="{ label: 'font-semibold' }"
        >
          <UInput
            v-model="name"
            :maxlength="suggestionFieldLengths.name"
            :placeholder="$t('suggestion.namePlaceholder')"
            autocomplete="off"
            class="w-full"
            :ui="{ base: 'h-13' }"
          />
        </UFormField>
        <SuggestionDuplicates :query="name" />
      </div>

      <UFormField
        :label="$t('suggestion.link')"
        name="url"
        size="xl"
        :error="linkInvalid ? $t('suggestion.linkInvalid') : undefined"
        :ui="{ label: 'font-semibold' }"
      >
        <UInput
          v-model="url"
          type="url"
          inputmode="url"
          :maxlength="suggestionFieldLengths.url"
          placeholder="https://"
          autocomplete="off"
          class="w-full"
          :ui="{ base: 'h-13' }"
        />
      </UFormField>

      <SuggestionPhoto
        v-model="photo"
        @failure="photoFailure = $event"
      />
      <p
        v-if="photoFailure"
        role="alert"
        class="text-sm text-error"
      >
        {{ photoFailure }}
      </p>
    </template>

    <template v-else>
      <UFormField
        :label="$t('suggestion.manufacturer')"
        name="manufacturer"
        size="xl"
        required
        :ui="{ label: 'font-semibold' }"
      >
        <UInput
          v-model="manufacturer"
          :maxlength="suggestionFieldLengths.manufacturer"
          :placeholder="$t('suggestion.manufacturerPlaceholder')"
          autocomplete="off"
          class="w-full"
          :ui="{ base: 'h-13' }"
        />
      </UFormField>
      <UFormField
        :label="$t('suggestion.model')"
        name="model"
        size="xl"
        required
        :ui="{ label: 'font-semibold' }"
      >
        <UInput
          v-model="model"
          :maxlength="suggestionFieldLengths.model"
          :placeholder="$t('suggestion.modelPlaceholder')"
          autocomplete="off"
          class="w-full"
          :ui="{ base: 'h-13' }"
        />
      </UFormField>
      <div class="flex flex-col gap-2">
        <span
          id="suggestion-kind-label"
          class="font-semibold text-highlighted"
        >{{ $t('suggestion.kind') }} <span class="font-normal text-muted">({{ $t('common.optional') }})</span></span>
        <RatingSegmentControl
          v-model="kind"
          :options="kindOptions"
          :label="$t('suggestion.kind')"
          variant="chips"
        />
      </div>
    </template>

    <p
      v-if="failure"
      role="alert"
      class="text-sm text-error"
    >
      {{ failure }}
    </p>
    <UButton
      type="submit"
      :label="$t('suggestion.send')"
      :loading="sending"
      :disabled="!canSend"
      size="xl"
      block
      class="h-14 text-[17px]"
    />
  </form>
</template>

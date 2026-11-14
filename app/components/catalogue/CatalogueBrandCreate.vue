<script setup lang="ts">
import type { Ref } from 'vue';
import type { BrandOption } from '#shared/types/catalogue';

// "Lisa bränd" from the coffee form's brand picker. Brands are created here only; a rename goes
// through DBeaver, since brands have no slug redirects.
const open = defineModel<boolean>('open', { required: true });
const props = defineProps<{ typedName: string }>();
const emit = defineEmits<{ created: [brand: BrandOption] }>();

const { t } = useI18n();
const toast = useToast();
const { create } = useCatalogueBrandActions();
const countries = useCountryOptions();

const name: Ref<string> = shallowRef('');
const slug: Ref<string> = shallowRef('');
const slugEditedByHand: Ref<boolean> = shallowRef(false);
const countryCode: Ref<string | undefined> = shallowRef(undefined);
const saving: Ref<boolean> = shallowRef(false);
const taken: Ref<'nameTaken' | 'slugTaken' | null> = shallowRef(null);

// Starts from what was typed into the picker's search.
watch(open, (isOpen) => {
  if (isOpen) {
    name.value = props.typedName.trim();
    slug.value = toSlug(name.value);
    slugEditedByHand.value = false;
    countryCode.value = undefined;
    taken.value = null;
  }
});
watch(name, (value) => {
  slug.value = suggestedSlug({ brandSlug: null, name: value, current: slug.value, editedByHand: slugEditedByHand.value });
});

const editSlug = (value: string) => {
  slug.value = value;
  slugEditedByHand.value = value !== '';
};

const submit = async () => {
  saving.value = true;
  taken.value = null;
  try {
    const brand = await create({ name: name.value, slug: slug.value, countryCode: countryCode.value ?? null });
    emit('created', brand);
    open.value = false;
  } catch (error) {
    const reason = failureReasonOf(error);
    if (reason === 'nameTaken' || reason === 'slugTaken') {
      taken.value = reason;
    } else {
      toast.add({ title: t('catalogue.newBrand.failed'), color: 'error', icon: 'i-lucide-circle-alert' });
    }
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <UModal
    v-model:open="open"
    :title="$t('catalogue.newBrand.title')"
  >
    <template #body>
      <form
        class="flex flex-col gap-4"
        @submit.prevent="submit"
      >
        <UFormField
          :label="$t('catalogue.newBrand.name')"
          :error="taken === 'nameTaken' ? $t('catalogue.newBrand.nameTaken') : undefined"
        >
          <UInput
            v-model="name"
            maxlength="100"
            required
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField
          :label="$t('catalogue.newBrand.slug')"
          :error="taken === 'slugTaken' ? $t('catalogue.newBrand.slugTaken') : undefined"
        >
          <UInput
            :model-value="slug"
            maxlength="120"
            required
            size="xl"
            class="w-full"
            @update:model-value="value => editSlug(String(value))"
          />
        </UFormField>
        <UFormField
          :label="$t('catalogue.newBrand.country')"
          :hint="$t('common.optional')"
        >
          <USelectMenu
            v-model="countryCode"
            :items="countries"
            value-key="value"
            :placeholder="$t('catalogue.newBrand.countryPlaceholder')"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          :label="$t('catalogue.newBrand.save')"
          :loading="saving"
          :disabled="name.trim() === '' || slug === ''"
          size="xl"
          block
        />
      </form>
    </template>
  </UModal>
</template>

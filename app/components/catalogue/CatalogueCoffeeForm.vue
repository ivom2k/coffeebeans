<script setup lang="ts">
import type { Ref } from 'vue';
import type { BrandOption, CoffeeConflict, CoffeeEditorInput, CoffeeStatus } from '#shared/types/catalogue';

// The coffee editor from the UI canvas (Admin-kohv). Its state starts from `initial`, which the
// page loads once (Phase 7 will fill it from a suggestion). It checks what it can as the admin
// types, with the same rules the server applies, and emits the whole coffee; the page saves it
// and passes back any conflict the database reported.
const props = defineProps<{
  initial: CoffeeDraft;
  // The status stored now, which decides whether Mustand is still offered; null for a new coffee.
  savedStatus: CoffeeStatus | null;
  brands: readonly BrandOption[];
  saving: boolean;
  conflict: CoffeeConflict | null;
}>();
const emit = defineEmits<{ submit: [input: CoffeeEditorInput]; cancel: [] }>();

const { t } = useI18n();

const brandId: Ref<number | undefined> = shallowRef(props.initial.brandId ?? undefined);
const name: Ref<string> = shallowRef(props.initial.name);
const slug: Ref<string> = shallowRef(props.initial.slug);
// A saved coffee's slug changes only by hand: renaming a public one adds a redirect.
const slugEditedByHand: Ref<boolean> = shallowRef(props.initial.slug !== '');
const status: Ref<CoffeeStatus | null> = shallowRef(props.initial.status);
const roastLevel: Ref<number | null> = shallowRef(props.initial.roastLevel);
const packages: Ref<PackageRow[]> = ref(toPackageRows(props.initial.packages));
const species: Ref<SpeciesRow[]> = ref(toSpeciesRows(props.initial.species));
const origins: Ref<string[]> = ref([...props.initial.origins]);
const description: Ref<string> = shallowRef(props.initial.descriptions.et ?? '');
const submitted: Ref<boolean> = shallowRef(false);

const brandSlug = computed(() => props.brands.find(brand => brand.id === brandId.value)?.slug ?? null);
watch([brandSlug, name], () => {
  slug.value = suggestedSlug({ brandSlug: brandSlug.value, name: name.value, current: slug.value, editedByHand: slugEditedByHand.value });
});
const editSlug = (value: string) => {
  slug.value = value;
  slugEditedByHand.value = value !== '';
};

// A conflict belongs to the values that caused it, so any edit clears it until the next save.
const conflict: Ref<CoffeeConflict | null> = shallowRef(props.conflict);
watch(() => props.conflict, (value) => {
  conflict.value = value;
});
watch([brandId, name, slug, status, packages], () => {
  conflict.value = null;
}, { deep: true });

const statusOptions = computed(() => allowedStatuses(props.savedStatus).map(value => ({ value, label: t(`catalogue.status.${value}`) })));
const roastOptions = [1, 2, 3, 4, 5].map(level => ({ value: level, label: String(level) }));
const showsRedirectHint = computed(() => props.savedStatus !== null && props.savedStatus !== 'DRAFT');

// The same check the rows show, duplicates across rows included.
const packagesValid = computed(() => packages.value.every(row => wholeNumber(row.sizeG) !== null)
  && packageGtinStatuses(packages.value.map(row => row.gtin)).every(status => status === 'EMPTY' || status === 'OK'));
const speciesValid = computed(() => speciesShare(speciesPercentages(species.value)).valid);

const missing = (isMissing: boolean, message: string) => (submitted.value && isMissing ? message : undefined);
const errors = computed(() => ({
  brand: missing(brandId.value === undefined, t('catalogue.brandMissing')),
  name: conflict.value?.reason === 'nameTaken'
    ? t('catalogue.nameTaken')
    : missing(name.value.trim() === '', t('catalogue.nameMissing')),
  slug: conflict.value?.reason === 'slugTaken'
    ? t('catalogue.slugTaken')
    : missing(!slugPattern.test(slug.value), t('catalogue.slugInvalid')),
  status: conflict.value?.reason === 'cannotUnpublish' ? t('catalogue.cannotUnpublish') : undefined,
  packages: conflict.value?.reason === 'gtinTaken'
    ? conflict.value.gtins.map(owner => t('catalogue.gtinTaken', { gtin: owner.gtin, coffee: owner.coffeeName })).join(' ')
    : missing(packages.value.some(row => wholeNumber(row.sizeG) === null), t('catalogue.sizeMissing')),
}));

const valid = computed(() => brandId.value !== undefined
  && name.value.trim() !== ''
  && slugPattern.test(slug.value)
  && status.value !== null
  && packagesValid.value
  && speciesValid.value);

const submit = () => {
  submitted.value = true;
  if (!valid.value || brandId.value === undefined || status.value === null) {
    return;
  }
  emit('submit', {
    brandId: brandId.value,
    name: name.value,
    slug: slug.value,
    status: status.value,
    roastLevel: roastLevel.value,
    packages: packages.value.map(row => ({ sizeG: wholeNumber(row.sizeG) ?? 0, gtin: row.gtin.trim() || null })),
    species: speciesPercentages(species.value),
    origins: [...origins.value],
    descriptions: { et: description.value.trim() || null },
  });
};

const roastHintId = useId();
</script>

<template>
  <form
    class="flex flex-col gap-5"
    novalidate
    @submit.prevent="submit"
  >
    <UFormField
      :label="$t('catalogue.statusLabel')"
      :error="errors.status"
      :ui="{ label: 'font-semibold' }"
    >
      <RatingSegmentControl
        v-model="status"
        :options="statusOptions"
        :label="$t('catalogue.statusLabel')"
        :clearable="false"
        class="max-w-md"
      />
    </UFormField>

    <section class="grid gap-x-6 gap-y-5 rounded-lg bg-default p-5 ring ring-default ring-inset sm:grid-cols-2 lg:p-6">
      <CatalogueBrandPicker
        v-model="brandId"
        :brands="brands"
        :error="errors.brand"
      />
      <UFormField
        :label="$t('catalogue.name')"
        :help="$t('catalogue.nameHint')"
        :error="errors.name"
      >
        <UInput
          v-model="name"
          maxlength="150"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField
        :label="$t('catalogue.slug')"
        :help="showsRedirectHint ? $t('catalogue.slugHint') : undefined"
        :error="errors.slug"
      >
        <UInput
          :model-value="slug"
          maxlength="200"
          size="xl"
          class="w-full"
          @update:model-value="value => editSlug(String(value))"
        />
      </UFormField>
      <div class="flex flex-col gap-1.5">
        <span class="text-sm font-medium text-default">{{ $t('catalogue.roastLevel') }}</span>
        <RatingSegmentControl
          v-model="roastLevel"
          :options="roastOptions"
          :label="$t('catalogue.roastLevel')"
          :described-by="roastHintId"
        />
        <span
          :id="roastHintId"
          class="text-[13px] text-muted"
        >{{ $t('catalogue.roastHint') }}</span>
      </div>
    </section>

    <section class="flex flex-wrap gap-x-10 gap-y-6 rounded-lg bg-default p-5 ring ring-default ring-inset lg:p-6">
      <CatalogueSpecies
        v-model="species"
        :error="submitted && !speciesValid ? $t('catalogue.fixErrors') : undefined"
      />
      <CatalogueOrigins v-model="origins" />
    </section>

    <CataloguePackages
      v-model="packages"
      :submitted="submitted"
      :error="errors.packages"
    />

    <section class="flex flex-col gap-3 rounded-lg bg-default p-5 ring ring-default ring-inset lg:p-6">
      <h2 class="text-[17px] font-bold text-highlighted">
        {{ $t('catalogue.description') }}
      </h2>
      <UTextarea
        v-model="description"
        :aria-label="$t('catalogue.descriptionLabel')"
        :rows="4"
        maxlength="2000"
        autoresize
        size="xl"
        class="w-full"
      />
    </section>

    <slot name="photo" />

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="text-sm text-muted">
        <slot name="review" />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <p
          v-if="submitted && !valid"
          role="alert"
          class="text-sm text-error"
        >
          {{ $t('catalogue.fixErrors') }}
        </p>
        <UButton
          :label="$t('catalogue.cancel')"
          color="neutral"
          variant="outline"
          size="xl"
          @click="emit('cancel')"
        />
        <UButton
          type="submit"
          :label="$t('catalogue.save')"
          :loading="saving"
          size="xl"
        />
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import type { AsyncDataRequestStatus } from '#app';
import type { Ref } from 'vue';
import type { CoffeeConflict, CoffeeEditorInput } from '#shared/types/catalogue';

// One coffee in the editor, by id rather than slug, since the slug is one of the things it edits.
definePageMeta({ layout: 'admin' });

const { t } = useI18n();
const toast = useToast();
const route = useRoute();
const localePath = useLocalePath();
const { formatDate } = useFormatters();

const id = Number(route.params.id);
const { coffee, status: coffeeStatus, error: coffeeError, save, uploadImage, removeImage, markReviewed } = useCoffeeEditor(id);
const { brands, status: brandsStatus, error: brandsError } = useCatalogueBrands();

// Both loads behind one state: the first refusal (401, 403) or failure explains the page.
const status = computed((): AsyncDataRequestStatus => {
  if (coffeeStatus.value === 'error' || brandsStatus.value === 'error') {
    return 'error';
  }
  return coffeeStatus.value === 'success' && brandsStatus.value === 'success' ? 'success' : 'pending';
});
const error = computed(() => coffeeError.value ?? brandsError.value);

const brandName = computed(() => brands.value.find(brand => brand.id === coffee.value?.brandId)?.name ?? '');
useSeoMeta({ title: () => coffee.value?.name ?? t('catalogue.listTitle') });

const saving: Ref<boolean> = shallowRef(false);
const conflict: Ref<CoffeeConflict | null> = shallowRef(null);
const uploading: Ref<boolean> = shallowRef(false);
const marking: Ref<boolean> = shallowRef(false);

const fail = (title: string) => toast.add({ title, color: 'error', icon: 'i-lucide-circle-alert' });
const succeed = (title: string) => toast.add({ title, color: 'success', icon: 'i-lucide-check' });

const submit = async (input: CoffeeEditorInput) => {
  saving.value = true;
  conflict.value = null;
  try {
    await save(input);
    succeed(t('catalogue.saved'));
  } catch (failure) {
    conflict.value = coffeeConflictOf(failure);
    if (!conflict.value) {
      fail(t('catalogue.saveFailed'));
    }
  } finally {
    saving.value = false;
  }
};

// 413 comes from the handler's size check or from Caddy's cap; 422 names what sharp refused.
const uploadFailure = (failure: unknown) => {
  if (statusCodeOf(failure) === 413 || failureReasonOf(failure) === 'tooLarge') {
    return t('catalogue.photoTooLarge');
  }
  return failureReasonOf(failure) === 'unsupported' ? t('catalogue.photoUnsupported') : t('catalogue.photoFailed');
};

const upload = async (file: File) => {
  uploading.value = true;
  try {
    await uploadImage(file);
    succeed(t('catalogue.photoSaved'));
  } catch (failure) {
    fail(uploadFailure(failure));
  } finally {
    uploading.value = false;
  }
};

const remove = async () => {
  uploading.value = true;
  try {
    await removeImage();
    succeed(t('catalogue.photoRemoved'));
  } catch {
    fail(t('catalogue.photoFailed'));
  } finally {
    uploading.value = false;
  }
};

const review = async () => {
  marking.value = true;
  try {
    await markReviewed();
  } catch {
    fail(t('catalogue.markReviewedFailed'));
  } finally {
    marking.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col gap-5">
    <AdminLoad
      :status="status"
      :error="error"
      :not-found-text="$t('catalogue.notFound')"
    >
      <template v-if="coffee">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div class="flex flex-col gap-1">
            <span class="text-sm text-muted">
              <NuxtLinkLocale
                to="/admin/kohvid"
                class="hover:text-default"
              >{{ $t('catalogue.listTitle') }}</NuxtLinkLocale> / {{ brandName }}
            </span>
            <h1 class="text-[28px] leading-tight font-bold text-highlighted">
              {{ coffee.name }}
            </h1>
          </div>
          <!-- A draft has no public page yet. -->
          <UButton
            v-if="coffee.status !== 'DRAFT'"
            :to="localePath(`/kohv/${coffee.slug}`)"
            :label="$t('catalogue.viewPage')"
            trailing-icon="i-lucide-external-link"
            color="neutral"
            variant="ghost"
          />
        </div>

        <CatalogueCoffeeForm
          :initial="coffee"
          :saved-status="coffee.status"
          :brands="brands"
          :saving="saving"
          :conflict="conflict"
          @submit="submit"
          @cancel="navigateTo(localePath('/admin/kohvid'))"
        >
          <template #photo>
            <CatalogueImage
              :image-url="coffee.imageUrl"
              :busy="uploading"
              @upload="upload"
              @remove="remove"
            />
          </template>
          <template #review>
            {{ coffee.reviewedAt ? $t('catalogue.reviewedAt', { date: formatDate(coffee.reviewedAt) }) : $t('catalogue.neverReviewed') }}
            ·
            <UButton
              :label="$t('catalogue.markReviewed')"
              :loading="marking"
              variant="link"
              class="px-0 text-sm font-semibold"
              @click="review"
            />
          </template>
        </CatalogueCoffeeForm>
      </template>
    </AdminLoad>
  </div>
</template>

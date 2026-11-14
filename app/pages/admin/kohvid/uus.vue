<script setup lang="ts">
import type { Ref } from 'vue';
import type { CoffeeConflict, CoffeeEditorInput } from '#shared/types/catalogue';

// A new coffee starts as a draft. The photo needs the coffee's id, so saving moves on to the
// editor, where it can be added.
definePageMeta({ layout: 'admin' });

const { t } = useI18n();
const toast = useToast();
const localePath = useLocalePath();
useSeoMeta({ title: () => t('catalogue.newTitle') });

const { brands, status, error } = useCatalogueBrands();
const initial = emptyCoffee();
const saving: Ref<boolean> = shallowRef(false);
const conflict: Ref<CoffeeConflict | null> = shallowRef(null);

const submit = async (input: CoffeeEditorInput) => {
  saving.value = true;
  conflict.value = null;
  try {
    const { id } = await createCatalogueCoffee(input);
    toast.add({ title: t('catalogue.saved'), color: 'success', icon: 'i-lucide-check' });
    await navigateTo(localePath(`/admin/kohvid/${id}`));
  } catch (failure) {
    conflict.value = coffeeConflictOf(failure);
    if (!conflict.value) {
      toast.add({ title: t('catalogue.saveFailed'), color: 'error', icon: 'i-lucide-circle-alert' });
    }
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-col gap-1">
      <NuxtLinkLocale
        to="/admin/kohvid"
        class="self-start text-sm text-muted hover:text-default"
      >
        {{ $t('catalogue.listTitle') }}
      </NuxtLinkLocale>
      <h1 class="text-[28px] leading-tight font-bold text-highlighted">
        {{ $t('catalogue.newTitle') }}
      </h1>
    </div>

    <AdminLoad
      :status="status"
      :error="error"
    >
      <CatalogueCoffeeForm
        :initial="initial"
        :saved-status="null"
        :brands="brands"
        :saving="saving"
        :conflict="conflict"
        @submit="submit"
        @cancel="navigateTo(localePath('/admin/kohvid'))"
      >
        <template #photo>
          <section class="flex flex-col gap-2 rounded-lg bg-default p-5 ring ring-default ring-inset lg:p-6">
            <h2 class="text-[17px] font-bold text-highlighted">
              {{ $t('catalogue.photo') }}
            </h2>
            <p class="text-sm text-muted">
              {{ $t('catalogue.photoSaveFirst') }}
            </p>
          </section>
        </template>
      </CatalogueCoffeeForm>
    </AdminLoad>
  </div>
</template>

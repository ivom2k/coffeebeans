<script setup lang="ts">
import type { Ref } from 'vue';
import type { BrandOption } from '#shared/types/catalogue';

// The coffee form's brand. A name the list doesn't have can be added on the spot, which is how
// the real catalogue's brands arrive: the seed's are invented.
const brandId = defineModel<number | undefined>({ required: true });
const props = defineProps<{ brands: readonly BrandOption[]; error?: string }>();

const items = computed(() => props.brands.map(brand => ({ label: brand.name, value: brand.id })));
const creating: Ref<boolean> = shallowRef(false);
const typedName: Ref<string> = shallowRef('');

const startCreating = (name: string) => {
  typedName.value = name;
  creating.value = true;
};
</script>

<template>
  <UFormField
    :label="$t('catalogue.brand')"
    :error="error"
  >
    <USelectMenu
      v-model="brandId"
      :items="items"
      value-key="value"
      create-item
      :placeholder="$t('catalogue.brandPlaceholder')"
      :search-input="{ placeholder: $t('catalogue.brandSearch') }"
      size="xl"
      class="w-full"
      @create="startCreating"
    >
      <template #create-item-label="{ item }">
        {{ $t('catalogue.brandCreate', { name: item }) }}
      </template>
    </USelectMenu>
    <CatalogueBrandCreate
      v-model:open="creating"
      :typed-name="typedName"
      @created="brand => brandId = brand.id"
    />
  </UFormField>
</template>

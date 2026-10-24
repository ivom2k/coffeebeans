<script setup lang="ts">
import type { Ref } from 'vue';
import { useFilter } from 'reka-ui';
import type { MachineModelRef, MyMachine } from '#shared/types/machine';

// The only place the whole catalogue appears; the rating form offers just the user's own
// machines (decisions log §3).
const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ added: [machine: MyMachine] }>();

const { t } = useI18n();
const toast = useToast();
const { add } = useMyMachineActions();

const { data: catalogue, status, execute } = useFetch('/api/machines', {
  key: 'machine-catalogue',
  server: false,
  immediate: false,
  default: (): MachineModelRef[] => [],
});
// Loaded on the first open: most visits to the account page add no machine.
watch(open, (isOpen) => {
  if (isOpen && status.value === 'idle') {
    execute();
  }
}, { immediate: true });

const modelId: Ref<number | undefined> = shallowRef(undefined);
const nickname: Ref<string> = shallowRef('');
const searchTerm: Ref<string> = shallowRef('');
const saving: Ref<boolean> = shallowRef(false);

const selected = computed(() => catalogue.value.find(model => model.modelId === modelId.value));

// Every typed word must match, so "veskimees 300" finds Veskimees VM 300. Nuxt UI's own filter
// looks for the whole term in one field. Accents and case are ignored, as in search.
const { contains } = useFilter({ sensitivity: 'base' });

// One shape for the manufacturer headings and the models, which is what lets the menu take
// `value` as its value key.
type PickerItem = { type?: 'label'; label: string; value?: number; description?: string };

const items = computed((): PickerItem[][] => {
  const words = searchTerm.value.trim().split(/\s+/).filter(word => word !== '');
  const found = catalogue.value.filter(model =>
    words.every(word => contains(`${model.manufacturerName} ${model.modelName}`, word)));
  const manufacturers = [...new Set(found.map(model => model.manufacturerName))];
  return manufacturers.map(manufacturer => [
    { type: 'label', label: manufacturer },
    ...found
      .filter(model => model.manufacturerName === manufacturer)
      .map(model => ({ label: model.modelName, value: model.modelId, description: t(`machineKind.${model.kind}`) })),
  ]);
});

const submit = async () => {
  if (modelId.value === undefined) {
    return;
  }
  saving.value = true;
  try {
    const machine = await add({ machineModelId: modelId.value, nickname: nickname.value });
    emit('added', machine);
    open.value = false;
    modelId.value = undefined;
    nickname.value = '';
  } catch {
    toast.add({ title: t('machine.saveFailed'), color: 'error', icon: 'i-lucide-circle-alert' });
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <UDrawer
    v-model:open="open"
    :title="$t('machine.add')"
    :description="$t('machine.addLead')"
    :ui="{
      content: 'mx-auto max-w-lg',
      container: 'px-5 pt-3 pb-8',
      title: 'text-2xl/tight font-bold',
      description: 'mt-2 text-base/normal text-toned',
    }"
  >
    <template #body>
      <form
        class="flex flex-col gap-5"
        @submit.prevent="submit"
      >
        <UFormField :label="$t('machine.model')">
          <USelectMenu
            v-model="modelId"
            v-model:search-term="searchTerm"
            :items="items"
            value-key="value"
            ignore-filter
            :loading="status === 'pending'"
            :placeholder="$t('machine.modelPlaceholder')"
            :search-input="{ placeholder: $t('machine.search') }"
            size="xl"
            class="w-full"
          >
            <template
              v-if="selected"
              #default
            >
              {{ selected.manufacturerName }} {{ selected.modelName }}
            </template>
            <template #empty>
              {{ status === 'error' ? $t('machine.catalogueFailed') : $t('machine.noMatch') }}
            </template>
          </USelectMenu>
        </UFormField>
        <UFormField
          :label="$t('machine.nickname')"
          :hint="$t('common.optional')"
        >
          <UInput
            v-model="nickname"
            maxlength="50"
            :placeholder="$t('machine.nicknamePlaceholder')"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          :label="$t('machine.add')"
          :loading="saving"
          :disabled="modelId === undefined"
          size="xl"
          block
          class="h-13.5 text-[17px]"
        />
      </form>
    </template>
  </UDrawer>
</template>

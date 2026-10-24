<script setup lang="ts">
import type { Ref } from 'vue';
import type { MyMachine } from '#shared/types/machine';

// Open while a machine is set. Only the nickname changes: a different machine is a new entry.
const machine = defineModel<MyMachine | null>('machine', { required: true });

const { t } = useI18n();
const toast = useToast();
const { rename, remove } = useMyMachineActions();

// Kept after the model clears, so the title doesn't vanish while the drawer slides away.
const shown: Ref<MyMachine | null> = shallowRef(null);
const nickname: Ref<string> = shallowRef('');
const saving: Ref<boolean> = shallowRef(false);

watch(machine, (current) => {
  if (current) {
    shown.value = current;
    nickname.value = current.nickname ?? '';
  }
}, { immediate: true });

const open = computed({
  get: () => machine.value !== null,
  set: (isOpen: boolean) => {
    if (!isOpen) {
      machine.value = null;
    }
  },
});

const run = async (change: (id: number) => Promise<void>) => {
  if (!machine.value) {
    return;
  }
  saving.value = true;
  try {
    await change(machine.value.id);
    machine.value = null;
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
    :title="shown ? `${shown.manufacturerName} ${shown.modelName}` : ''"
    :description="shown ? $t(`machineKind.${shown.kind}`) : ''"
    :ui="{
      content: 'mx-auto max-w-lg',
      container: 'px-5 pt-3 pb-8',
      title: 'text-2xl/tight font-bold',
      description: 'mt-1 text-base/normal text-toned',
    }"
  >
    <template #body>
      <form
        class="flex flex-col gap-4"
        @submit.prevent="run(id => rename(id, nickname))"
      >
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
          :label="$t('machine.save')"
          :loading="saving"
          size="xl"
          block
          class="mt-1 h-13.5 text-[17px]"
        />
        <!-- No confirmation: ratings made with the machine keep it. -->
        <UButton
          :label="$t('machine.remove')"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="xl"
          block
          :disabled="saving"
          @click="run(remove)"
        />
      </form>
    </template>
  </UDrawer>
</template>

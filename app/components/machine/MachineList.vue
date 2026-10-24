<script setup lang="ts">
import type { Ref } from 'vue';
import type { MyMachine } from '#shared/types/machine';

// "Minu masinad" on the account page. Renders only for a signed-in user, in the browser.
const { machines, status } = useMyMachines();
const adding: Ref<boolean> = shallowRef(false);
const editing: Ref<MyMachine | null> = shallowRef(null);
</script>

<template>
  <section
    aria-labelledby="machines-heading"
    class="flex flex-col gap-3"
  >
    <div class="flex flex-col gap-1">
      <h2
        id="machines-heading"
        class="text-xl font-bold text-highlighted"
      >
        {{ $t('machine.title') }}
      </h2>
      <p class="text-sm/normal text-muted">
        {{ $t('machine.lead') }}
      </p>
    </div>

    <ul
      v-if="machines.length > 0"
      class="flex flex-col gap-3"
    >
      <li
        v-for="machine in machines"
        :key="machine.id"
        class="flex items-center justify-between gap-3 rounded-lg bg-default py-2 ps-4 pe-2 ring ring-default ring-inset"
      >
        <span class="flex min-w-0 flex-col gap-0.5 py-1.5">
          <span class="font-semibold text-highlighted">{{ machine.manufacturerName }} {{ machine.modelName }}</span>
          <span class="text-sm text-muted">
            <template v-if="machine.nickname">{{ machine.nickname }} · </template>{{ $t(`machineKind.${machine.kind}`) }}
          </span>
        </span>
        <UButton
          :label="$t('machine.edit')"
          :aria-label="$t('machine.editLabel', { name: `${machine.manufacturerName} ${machine.modelName}` })"
          variant="ghost"
          size="xl"
          class="h-11 shrink-0 text-[15px]"
          @click="editing = machine"
        />
      </li>
    </ul>
    <p
      v-else-if="status === 'success'"
      class="text-muted"
    >
      {{ $t('machine.none') }}
    </p>
    <p
      v-else-if="status === 'error'"
      role="alert"
      class="text-error"
    >
      {{ $t('machine.loadFailed') }}
    </p>

    <UButton
      :label="$t('machine.add')"
      icon="i-lucide-plus"
      color="neutral"
      variant="outline"
      size="xl"
      block
      class="h-13 text-base"
      @click="adding = true"
    />

    <MachineAddDrawer v-model:open="adding" />
    <MachineEditDrawer v-model:machine="editing" />
  </section>
</template>

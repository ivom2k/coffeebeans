<script setup lang="ts">
import type { CoffeeDetails } from '#shared/types/coffee';

const props = defineProps<{ issues: CoffeeDetails['machineIssues'] }>();

const someTooFew = computed(() =>
  [...props.issues.automatic, props.issues.portafilter].some(group => group !== null && !group.enoughAnswers));
</script>

<template>
  <section
    aria-labelledby="machine-issues-heading"
    class="flex flex-col gap-4 rounded-lg bg-default p-5 ring ring-default ring-inset"
  >
    <div class="flex flex-col gap-1">
      <h2
        id="machine-issues-heading"
        class="text-xl font-bold text-highlighted"
      >
        {{ $t('coffee.machineIssuesTitle') }}
      </h2>
      <p class="text-sm/normal text-muted">
        {{ $t('coffee.machineIssuesIntro') }}
      </p>
    </div>

    <template v-if="issues.automatic.length > 0">
      <h3 class="mt-1 text-sm font-semibold tracking-[0.04em] text-muted uppercase">
        {{ $t('coffee.automaticMachines') }}
      </h3>
      <CoffeeIssueGroup
        v-for="group in issues.automatic"
        :key="group.manufacturerName"
        :label="group.manufacturerName"
        :group="group"
      />
    </template>

    <template v-if="issues.portafilter">
      <h3 class="mt-2 text-sm font-semibold tracking-[0.04em] text-muted uppercase">
        {{ $t('coffee.portafilterMachines') }}
      </h3>
      <CoffeeIssueGroup
        :label="$t('coffee.grinderIssues')"
        :group="issues.portafilter"
      />
    </template>

    <!-- "Liiga vähe vastuseid" alone doesn't say what is held back or how many answers it takes. -->
    <p
      v-if="someTooFew"
      class="text-sm/normal text-muted"
    >
      {{ $t('coffee.issueThreshold', { count: issues.minAnswers }) }}
    </p>
  </section>
</template>

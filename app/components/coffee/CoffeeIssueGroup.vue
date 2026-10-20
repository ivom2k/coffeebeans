<script setup lang="ts">
import type { MachineIssueGroup } from '#shared/types/coffee';

const props = defineProps<{ label: string; group: MachineIssueGroup }>();

const width = computed(() => `${(props.group.withIssues / props.group.answered) * 100}%`);
</script>

<template>
  <div
    v-if="group.enoughAnswers"
    class="flex flex-col gap-1.5"
  >
    <!-- On a narrow phone the value moves under the label instead of both breaking mid-phrase;
         ml-auto keeps it right-aligned on either line. -->
    <div class="flex flex-wrap gap-x-4">
      <span class="font-semibold">{{ label }}</span>
      <i18n-t
        keypath="coffee.issueShare"
        tag="span"
        class="ml-auto whitespace-nowrap"
      >
        <template #withIssues>
          <strong>{{ group.withIssues }}</strong>
        </template>
        <template #answered>
          {{ group.answered }}
        </template>
      </i18n-t>
    </div>
    <!-- The numbers above carry the information; the bar only shows it. -->
    <span
      class="flex h-2.5 overflow-hidden rounded-full bg-warning-100"
      aria-hidden="true"
    >
      <span
        class="rounded-full bg-warning-700"
        :style="{ width }"
      />
    </span>
  </div>
  <!-- "1 of 1 = 100 %" says nothing, so small groups show only their count (decisions log §2). -->
  <div
    v-else
    class="flex flex-wrap gap-x-4 text-muted"
  >
    <span class="font-semibold">{{ label }}</span>
    <span class="ml-auto whitespace-nowrap">{{ $t('coffee.tooFewAnswers', { count: group.answered }) }}</span>
  </div>
</template>

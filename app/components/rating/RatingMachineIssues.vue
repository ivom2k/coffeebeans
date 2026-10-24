<script setup lang="ts">
import type { MachineKind } from '#shared/types/machine';
import { machineIssueCodes, type MachineIssueCode } from '#shared/types/rating';

// Every issue code describes the grinder, which a portafilter user usually owns separately,
// so the question follows the machine's kind (decisions log §3). Unanswered is not "no
// issues": the issue share counts only people who answered.
defineProps<{ kind: MachineKind; error?: string }>();
const answer = defineModel<'no' | 'yes' | null>('answer', { required: true });
const issues = defineModel<MachineIssueCode[]>('issues', { required: true });

const { t } = useI18n();
const questionId = useId();

const answers = computed(() => [
  { value: 'no' as const, label: t('rating.issuesNo') },
  { value: 'yes' as const, label: t('rating.issuesYes') },
]);
const issueItems = computed(() => machineIssueCodes.map(code => ({ value: code, label: t(`machineIssue.${code}`) })));
const status = computed(() => {
  if (answer.value === null) {
    return t('rating.issuesSkipped');
  }
  return answer.value === 'no' ? t('rating.issuesNone') : t('rating.issuesSome');
});
</script>

<template>
  <div
    role="group"
    :aria-labelledby="questionId"
    class="flex flex-col gap-3 rounded-lg bg-default p-4 ring ring-default ring-inset"
  >
    <p
      :id="questionId"
      class="text-[17px] font-bold text-highlighted"
    >
      {{ $t(`rating.issuesQuestion.${kind}`) }}
    </p>
    <div class="flex min-h-11 items-center justify-between gap-3">
      <span class="text-sm text-muted">{{ status }}</span>
      <UButton
        v-if="answer !== null"
        :label="$t('common.clear')"
        :aria-label="$t('rating.clearLabel', { label: $t(`rating.issuesQuestion.${kind}`) })"
        variant="link"
        size="lg"
        class="h-11 px-1 text-[15px] font-semibold"
        @click="answer = null"
      />
    </div>
    <RatingSegmentControl
      v-model="answer"
      :options="answers"
      :label="$t(`rating.issuesQuestion.${kind}`)"
    />
    <UCheckboxGroup
      v-if="answer === 'yes'"
      v-model="issues"
      :items="issueItems"
      :legend="$t('rating.issuesPick')"
      size="xl"
      :ui="{
        fieldset: 'gap-y-0',
        legend: 'pt-1 pb-1.5 text-sm font-normal text-muted',
        container: 'h-12',
        label: 'py-3 font-normal',
      }"
    />
    <p
      v-if="error"
      role="alert"
      class="text-sm text-error"
    >
      {{ error }}
    </p>
  </div>
</template>

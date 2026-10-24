<script setup lang="ts">
import type { Ref } from 'vue';
import type { MachineModelRef, MyMachine } from '#shared/types/machine';
import {
  beanSurfaceCodes, type BeanSurfaceCode, type MachineIssueCode, type MyRating, type Perception, type RatingInput,
} from '#shared/types/rating';

// The rating form from the UI canvas. Rendered once the user's machines and any earlier
// rating have loaded, so its state starts from them. `machines` follows the loaded list, so
// a machine added from the form appears in the select.
const props = defineProps<{ initial: MyRating | null; machines: readonly MyMachine[]; saving: boolean }>();
const emit = defineEmits<{ submit: [input: RatingInput] }>();

const { t } = useI18n();
const machines = toRef(props, 'machines');

const scoreOptions = [1, 2, 3, 4, 5].map(score => ({ value: score, label: String(score) }));
const surfaceOptions = computed(() => beanSurfaceCodes.map(code => ({ value: code, label: t(`beanSurface.${code}`) })));
const sliders = [
  { key: 'bitterness', label: 'rating.bitterness', low: 'rating.bitternessLow', high: 'rating.bitternessHigh' },
  { key: 'roastCharacter', label: 'rating.roastCharacter', low: 'rating.roastCharacterLow', high: 'rating.roastCharacterHigh' },
  { key: 'crema', label: 'rating.crema', low: 'rating.cremaLow', high: 'rating.cremaHigh' },
  { key: 'strength', label: 'rating.strength', low: 'rating.strengthLow', high: 'rating.strengthHigh' },
] as const satisfies readonly { key: keyof Perception; label: string; low: string; high: string }[];

// The select's value is the user's machine entry, not the model: two entries can share one.
const noMachine = 'none';
const keptMachine = 'kept';
const choiceOf = (machine: MyMachine) => `machine-${machine.id}`;
const machineName = (model: MachineModelRef) => `${model.manufacturerName} ${model.modelName}`;

// An edit keeps the rated model even after that machine was removed from the profile, so
// saving never drops it unasked.
const ratedModel = props.initial?.machine ?? null;
const keptModel = ratedModel && !machines.value.some(machine => machine.modelId === ratedModel.modelId) ? ratedModel : null;

const machineChoices = computed(() => [
  ...machines.value.map(machine => ({
    value: choiceOf(machine),
    label: machine.nickname ? `${machineName(machine)} · ${machine.nickname}` : machineName(machine),
    model: machine,
  })),
  ...(keptModel ? [{ value: keptMachine, label: machineName(keptModel), model: keptModel }] : []),
  { value: noMachine, label: t('rating.noMachine'), model: null },
]);

const initialChoice = (): string | undefined => {
  if (props.initial) {
    const own = machines.value.find(machine => machine.modelId === ratedModel?.modelId);
    if (own) {
      return choiceOf(own);
    }
    return keptModel ? keptMachine : noMachine;
  }
  // A new rating: one machine is the obvious answer; with several, the user picks.
  const [only] = machines.value;
  return machines.value.length === 1 && only ? choiceOf(only) : undefined;
};

const initialAnswer = (issues: readonly MachineIssueCode[] | null | undefined) => {
  if (issues == null) {
    return null;
  }
  return issues.length === 0 ? 'no' : 'yes';
};

const score: Ref<number | null> = shallowRef(props.initial?.score ?? null);
const beanSurface: Ref<BeanSurfaceCode | null> = shallowRef(props.initial?.beanSurface ?? null);
const machineChoice: Ref<string | undefined> = shallowRef(initialChoice());
const issueAnswer: Ref<'no' | 'yes' | null> = shallowRef(initialAnswer(props.initial?.machineIssues));
const issues: Ref<MachineIssueCode[]> = ref([...(props.initial?.machineIssues ?? [])]);
const perception: Ref<Perception> = ref({
  bitterness: null, roastCharacter: null, crema: null, strength: null, ...props.initial?.perception,
});
const privateNote: Ref<string> = shallowRef(props.initial?.privateNote ?? '');
const detailsOpen: Ref<boolean> = shallowRef(Object.values(perception.value).some(value => value !== null));
const addingMachine: Ref<boolean> = shallowRef(false);
const submitted: Ref<boolean> = shallowRef(false);

const selectedModel = computed(() => machineChoices.value.find(choice => choice.value === machineChoice.value)?.model ?? null);

// "Jah, oli" with nothing ticked would be sent as [], which means "no issues". OTHER exists
// for a problem that isn't listed.
const issuesIncomplete = computed(() => selectedModel.value !== null && issueAnswer.value === 'yes' && issues.value.length === 0);
const scoreError = computed(() => (submitted.value && score.value === null ? t('rating.scoreMissing') : undefined));
const issuesError = computed(() => (submitted.value && issuesIncomplete.value ? t('rating.issuesMissing') : undefined));

// Without a machine the issue question isn't shown, and the server refuses an answer to it.
const machineIssues = (): MachineIssueCode[] | null => {
  if (selectedModel.value === null || issueAnswer.value === null) {
    return null;
  }
  return issueAnswer.value === 'no' ? [] : [...issues.value];
};

const scoreSection = useTemplateRef('scoreSection');
const issuesSection = useTemplateRef('issuesSection');

const submit = () => {
  submitted.value = true;
  if (score.value === null) {
    scoreSection.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (issuesIncomplete.value) {
    issuesSection.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  emit('submit', {
    score: score.value,
    perception: { ...perception.value },
    beanSurface: beanSurface.value,
    machineModelId: selectedModel.value?.modelId ?? null,
    machineIssues: machineIssues(),
    privateNote: privateNote.value,
  });
};

const scorePolesId = useId();
</script>

<template>
  <form
    class="flex flex-col gap-6"
    novalidate
    @submit.prevent="submit"
  >
    <div
      ref="scoreSection"
      class="flex flex-col gap-2.5"
    >
      <p class="text-[17px] font-bold text-highlighted">
        {{ $t('rating.score') }} <span class="font-normal text-muted">({{ $t('rating.required') }})</span>
      </p>
      <RatingSegmentControl
        v-model="score"
        :options="scoreOptions"
        :label="$t('rating.scoreGroup')"
        :described-by="scorePolesId"
        :clearable="false"
      />
      <p
        :id="scorePolesId"
        class="flex justify-between gap-4 text-[13px] text-muted"
      >
        <span><span class="sr-only">1: </span>{{ $t('rating.scoreLow') }}</span>
        <span class="text-right"><span class="sr-only">5: </span>{{ $t('rating.scoreHigh') }}</span>
      </p>
      <p
        v-if="scoreError"
        role="alert"
        class="text-sm text-error"
      >
        {{ scoreError }}
      </p>
    </div>

    <div class="flex flex-col gap-2.5">
      <p class="text-[17px] font-bold text-highlighted">
        {{ $t('rating.beanSurface') }}
      </p>
      <RatingSegmentControl
        v-model="beanSurface"
        :options="surfaceOptions"
        :label="$t('rating.beanSurface')"
        variant="chips"
      />
    </div>

    <div class="flex flex-col gap-2">
      <UFormField
        :label="$t('rating.machine')"
        :ui="{ label: 'text-[17px] font-bold text-highlighted' }"
      >
        <USelect
          v-model="machineChoice"
          :items="machineChoices"
          :placeholder="$t('rating.machinePlaceholder')"
          size="xl"
          class="h-13 w-full"
        />
      </UFormField>
      <p class="text-sm text-muted">
        {{ $t('rating.machineHint') }}
        <UButton
          :label="$t('machine.add')"
          variant="link"
          class="inline-flex px-0 py-2 text-sm font-semibold"
          @click="addingMachine = true"
        />
      </p>
      <MachineAddDrawer
        v-model:open="addingMachine"
        @added="machine => machineChoice = choiceOf(machine)"
      />
    </div>

    <div
      v-if="selectedModel"
      ref="issuesSection"
    >
      <RatingMachineIssues
        v-model:answer="issueAnswer"
        v-model:issues="issues"
        :kind="selectedModel.kind"
        :error="issuesError"
      />
    </div>

    <UCollapsible
      v-model:open="detailsOpen"
      class="flex flex-col"
    >
      <UButton
        variant="soft"
        size="xl"
        block
        trailing-icon="i-lucide-chevron-down"
        class="group h-13 justify-between px-3.5 text-base"
        :ui="{ trailingIcon: 'transition-transform duration-200 group-data-[state=open]:rotate-180' }"
      >
        <span>{{ $t('rating.details') }} <span class="font-normal">({{ $t('common.optional') }})</span></span>
      </UButton>
      <template #content>
        <div class="flex flex-col gap-5.5 pt-4">
          <RatingPerception
            v-for="slider in sliders"
            :key="slider.key"
            v-model="perception[slider.key]"
            :label="$t(slider.label)"
            :low="$t(slider.low)"
            :high="$t(slider.high)"
          />
        </div>
      </template>
    </UCollapsible>

    <div class="flex flex-col gap-2">
      <UFormField
        :label="$t('rating.note')"
        :hint="$t('common.optional')"
        :ui="{ label: 'text-[17px] font-bold text-highlighted' }"
      >
        <UTextarea
          v-model="privateNote"
          :rows="4"
          maxlength="500"
          :placeholder="$t('rating.notePlaceholder')"
          size="xl"
          autoresize
          class="w-full"
        />
      </UFormField>
      <p class="flex justify-between gap-3 text-sm text-muted">
        <span class="flex items-center gap-1.5">
          <UIcon
            name="i-lucide-lock"
            class="size-4 shrink-0"
          />
          {{ $t('rating.notePrivate') }}
        </span>
        <span>{{ $t('rating.noteCount', { count: privateNote.length }) }}</span>
      </p>
    </div>

    <UButton
      type="submit"
      :label="$t('rating.save')"
      :loading="saving"
      size="xl"
      block
      class="h-14 text-[17px]"
    />
  </form>
</template>

<script setup lang="ts">
// Where the beans were grown, when the bag says. Chips with a remove button each, and a search
// field that finds a country by its Estonian name.
const origins = defineModel<string[]>({ required: true });

const countries = useCountryOptions();
const labelId = useId();
</script>

<template>
  <div class="flex min-w-0 flex-1 basis-70 flex-col gap-2.5">
    <h2
      :id="labelId"
      class="text-[17px] font-bold text-highlighted"
    >
      {{ $t('catalogue.origin') }}
    </h2>
    <UInputMenu
      v-model="origins"
      :items="countries"
      value-key="value"
      multiple
      :aria-labelledby="labelId"
      :placeholder="$t('catalogue.originPlaceholder')"
      size="lg"
      class="w-full"
    />
  </div>
</template>

<script setup lang="ts">
import type { Ref } from 'vue';

const props = defineProps<{ initialQuery?: string; submitOnClear?: boolean }>();

const localePath = useLocalePath();
const query: Ref<string> = shallowRef(props.initialQuery ?? '');
const field = useTemplateRef('field');

// Back and forward on the search page change the query without remounting this field.
watch(() => props.initialQuery, (value) => {
  query.value = value ?? '';
});

// An empty search means "show me everything", and that is the ranked list.
const submit = async () => {
  const q = query.value.trim();
  await navigateTo(q ? { path: localePath('/otsing'), query: { q } } : localePath('/'));
};

// Clears the field and puts the cursor back for a new query. With submitOnClear (the search
// page), clearing submits the empty search instead, which leads to the ranked list; navigateTo
// pushes, so Back brings the cleared results back. No focus then: on a phone it would open the
// keyboard just before the page changes.
const clear = async () => {
  query.value = '';
  if (props.submitOnClear) {
    await submit();
    return;
  }
  field.value?.inputRef?.focus();
};
</script>

<template>
  <!-- A plain GET form: before hydration, or without JavaScript, the browser submits it
       and the search page renders on the server. -->
  <form
    role="search"
    :action="localePath('/otsing')"
    method="get"
    @submit.prevent="submit"
  >
    <UInput
      ref="field"
      v-model="query"
      name="q"
      type="search"
      enterkeyhint="search"
      autocomplete="off"
      :placeholder="$t('search.placeholder')"
      :aria-label="$t('search.label')"
      size="xl"
      class="w-full"
      :ui="{ base: ['h-13 rounded-md ps-3.5', query ? 'pe-24' : 'pe-13'], trailing: 'gap-0 pe-1' }"
    >
      <template #trailing>
        <!-- 44 px, like the canvas: big enough to hit with a thumb. -->
        <UButton
          v-if="query"
          type="button"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xl"
          class="size-11 justify-center"
          :aria-label="$t('search.clear')"
          @click="clear"
        />
        <UButton
          type="submit"
          icon="i-lucide-search"
          color="primary"
          variant="ghost"
          size="xl"
          class="size-11 justify-center"
          :aria-label="$t('search.submit')"
        />
      </template>
    </UInput>
  </form>
</template>

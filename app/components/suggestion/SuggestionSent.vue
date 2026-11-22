<script setup lang="ts">
// The confirmation from the UI canvas: a state of the suggestion page, not a page of its own.
const localePath = useLocalePath();
</script>

<template>
  <div class="flex max-w-xl flex-col gap-4 pt-6">
    <span class="flex size-22 items-center justify-center self-center rounded-full bg-success-50">
      <UIcon
        name="i-lucide-check"
        class="size-11 text-success"
      />
    </span>
    <h1 class="mt-2 text-center text-[26px] leading-tight font-bold text-highlighted">
      {{ $t('suggestion.sentTitle') }}
    </h1>
    <p class="text-center text-base/normal text-toned">
      {{ $t('suggestion.sentText') }}
    </p>

    <div class="mt-2 flex gap-3 rounded-lg bg-default p-4 ring ring-default ring-inset">
      <UChip
        color="error"
        inset
        size="xl"
        class="shrink-0"
      >
        <span class="flex size-10 items-center justify-center rounded-full bg-primary-50">
          <UIcon
            name="i-lucide-user-round"
            class="size-5 text-primary"
          />
        </span>
      </UChip>
      <i18n-t
        keypath="suggestion.sentWhere"
        tag="p"
        class="text-[15px]/normal"
        scope="global"
      >
        <template #page>
          <strong>{{ $t('suggestion.mine') }}</strong>
        </template>
      </i18n-t>
    </div>

    <div class="mt-4 flex flex-col gap-2.5">
      <UButton
        :to="localePath('/konto/ettepanekud')"
        :label="$t('suggestion.mine')"
        size="xl"
        block
        class="h-13.5 text-[17px]"
      />
      <UButton
        :to="localePath('/')"
        :label="$t('suggestion.backToRanking')"
        color="neutral"
        variant="outline"
        size="xl"
        block
        class="h-13.5 text-[17px]"
      />
    </div>
  </div>
</template>

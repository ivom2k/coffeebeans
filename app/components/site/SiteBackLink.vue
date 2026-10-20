<template>
  <NuxtLinkLocale
    to="/"
    class="flex h-11 items-center gap-1 self-start text-[15px] text-primary hover:text-primary-800"
  >
    <UIcon
      name="i-lucide-chevron-left"
      class="size-5"
    />
    {{ $t('common.backToRanking') }}
  </NuxtLinkLocale>
</template>

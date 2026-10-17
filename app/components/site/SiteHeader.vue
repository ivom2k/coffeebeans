<template>
  <header class="border-b border-default bg-default">
    <UContainer class="flex h-15 items-center justify-between lg:h-17">
      <NuxtLinkLocale
        to="/"
        :aria-label="$t('site.homeLink')"
        class="flex items-center gap-2 text-highlighted lg:gap-2.5"
      >
        <SiteLogo class="size-7 lg:size-8" />
        <span class="text-[22px] font-bold tracking-[-0.02em] lg:text-2xl">{{ $t('site.name') }}</span>
      </NuxtLinkLocale>
    </UContainer>
  </header>
</template>

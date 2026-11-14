<template>
  <header class="bg-inverted text-inverted">
    <div class="flex min-h-15 flex-wrap items-center gap-x-4 gap-y-2 px-4 lg:px-6">
      <span class="flex items-center gap-2.5">
        <SiteLogo
          inverted
          class="size-7"
        />
        <span class="text-xl font-bold tracking-[-0.02em]">{{ $t('site.name') }}</span>
        <span class="rounded-sm bg-primary-300 px-2 py-0.5 text-xs font-bold tracking-wider text-highlighted uppercase">
          {{ $t('admin.badge') }}
        </span>
      </span>
      <NuxtLinkLocale
        to="/"
        class="ml-auto py-3 text-[15px] text-primary-200 underline underline-offset-2 hover:text-primary-100"
      >
        {{ $t('admin.viewSite') }}
      </NuxtLinkLocale>
    </div>
  </header>
</template>

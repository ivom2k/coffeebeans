<template>
  <div class="flex min-h-dvh flex-col">
    <SiteHeader />
    <UContainer as="main" class="flex-1 py-5 lg:py-10">
      <slot />
    </UContainer>
  </div>
</template>

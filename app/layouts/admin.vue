<!-- The admin shell from the UI canvas. Admin pages render in the browser only (nuxt.config.ts),
     so nothing here is ever server-rendered or cached. -->
<template>
  <div class="flex min-h-dvh flex-col">
    <AdminHeader />
    <div class="flex flex-1 flex-col lg:flex-row">
      <AdminNav />
      <main class="min-w-0 flex-1 px-4 pt-4 pb-12 lg:max-w-230 lg:px-6 lg:pt-6">
        <slot />
      </main>
    </div>
  </div>
</template>

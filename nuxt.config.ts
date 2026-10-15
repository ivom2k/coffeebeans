// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n', '@nuxtjs/seo', 'nuxt-auth-utils', '@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  site: {
    url: 'https://kohvioad.eu',
    name: 'Kohvioad',
  },
  app: {
    head: {
      // Separator from the brand canvas tab mockup: "Kohvioad – kohviubade hinnangud"
      templateParams: { separator: '–' },
    },
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
});

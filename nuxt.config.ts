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
  ui: {
    // Light mode only for the MVP: the design has no dark theme yet.
    colorMode: false,
  },
  i18n: {
    defaultLocale: 'et',
    strategy: 'prefix_except_default',
    locales: [{ code: 'et', language: 'et-EE', name: 'Eesti', file: 'et.json' }],
    // Cached pages must be identical for every visitor, so never redirect by browser language.
    detectBrowserLanguage: false,
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
});

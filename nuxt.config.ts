// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n', '@nuxtjs/seo', 'nuxt-auth-utils', '@nuxt/ui', '@nuxt/eslint'],
  devtools: { enabled: true },
  app: {
    head: {
      // Separator from the brand canvas tab mockup: "Kohvioad – kohviubade hinnangud"
      templateParams: { separator: '–' },
    },
  },
  css: ['~/assets/css/main.css'],
  site: {
    url: 'https://kohvioad.eu',
    name: 'Kohvioad',
  },
  ui: {
    // Light mode only for the MVP: the design has no dark theme yet.
    colorMode: false,
  },
  runtimeConfig: {
    // Server-only. Set at runtime through NUXT_DATABASE_URL, so the built image holds no credentials.
    databaseUrl: '',
  },
  compatibilityDate: '2025-07-15',
  typescript: {
    // Root-level tool configs aren't in any generated tsconfig; this makes `npm run check` cover them.
    // Paths are relative to .nuxt/, where the tsconfig is generated.
    nodeTsConfig: {
      include: ['../drizzle.config.ts', '../vitest.config.ts'],
    },
  },
  eslint: {
    config: {
      // ESLint Stylistic formats the code, so there is no separate formatter.
      stylistic: { semi: true, braceStyle: '1tbs' },
    },
  },
  i18n: {
    defaultLocale: 'et',
    strategy: 'prefix_except_default',
    locales: [{ code: 'et', language: 'et-EE', name: 'Eesti', file: 'et.json' }],
    // Cached pages must be identical for every visitor, so never redirect by browser language.
    detectBrowserLanguage: false,
  },
});

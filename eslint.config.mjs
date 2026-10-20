// @ts-check
// Nuxt generates the base config (Vue, TypeScript, Stylistic) during `nuxt prepare`.
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';
import { getDefaultSelectors } from 'eslint-plugin-better-tailwindcss/defaults';
import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt(
  {
    rules: {
      // CLAUDE.md: never v-html on user-supplied text. A trusted use needs an explicit disable comment.
      'vue/no-v-html': 'error',
    },
  },
  {
    // Tailwind class checks, the same ones the VS Code Tailwind extension shows, so they also
    // run in `npm run lint` and CI. No ordering or wrapping rules: they would only restyle.
    files: ['**/*.vue', '**/*.ts'],
    plugins: { 'better-tailwindcss': betterTailwindcss },
    settings: {
      // The plugin reads the theme from here. Nuxt UI's `#build/ui.css` import resolves to its
      // static fallback outside Nuxt, which registers the same token names (bg-default, text-muted).
      'better-tailwindcss': {
        entryPoint: 'app/assets/css/main.css',
        selectors: [
          ...getDefaultSelectors(),
          // Nuxt UI's per-instance overrides: :ui="{ base: '…' }" in templates…
          { kind: 'attribute', name: '^(:|v-bind:)?ui$', match: [{ type: 'objectValues' }] },
          // …and the theme-wide ones in app.config.ts.
          { kind: 'callee', name: '^defineAppConfig$', match: [{ type: 'objectValues', path: 'class$' }] },
        ],
      },
    },
    rules: {
      ...betterTailwindcss.configs.correctness.rules,
      'better-tailwindcss/enforce-canonical-classes': 'error',
      'better-tailwindcss/no-duplicate-classes': 'error',
      'better-tailwindcss/no-deprecated-classes': 'error',
      'better-tailwindcss/no-unnecessary-whitespace': 'error',
    },
  },
);

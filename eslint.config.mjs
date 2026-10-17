// @ts-check
// Nuxt generates the base config (Vue, TypeScript, Stylistic) during `nuxt prepare`.
import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt({
  rules: {
    // CLAUDE.md: never v-html on user-supplied text. A trusted use needs an explicit disable comment.
    'vue/no-v-html': 'error',
  },
});

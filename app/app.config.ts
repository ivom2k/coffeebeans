export default defineAppConfig({
  ui: {
    colors: {
      primary: 'cornflower',
      neutral: 'slate',
      success: 'pine',
      warning: 'ochre',
      error: 'brick',
    },
    badge: {
      // Soft badges on the canvas sit on a light tint of their colour rather than on
      // Nuxt UI's 10 % mix, which turns muddy for the dark text shades.
      compoundVariants: [
        { color: 'success', variant: 'soft', class: 'bg-success-50' },
        { color: 'warning', variant: 'soft', class: 'bg-warning-50' },
        { color: 'error', variant: 'soft', class: 'bg-error-50' },
      ],
    },
  },
});

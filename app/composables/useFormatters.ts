import type { ComputedRef } from 'vue';

// Locale-aware formatting for templates. It uses the locale's BCP 47 language (et-EE),
// not its route code, so Russian later gets its own separators and country names.
export const useFormatters = () => {
  const { localeProperties } = useI18n();
  const language: ComputedRef<string> = computed(() => localeProperties.value.language ?? 'et-EE');
  const regionNames: ComputedRef<Intl.DisplayNames> = computed(() =>
    new Intl.DisplayNames([language.value], { type: 'region' }));

  return {
    formatScore: (mean: number) => formatScore(mean, language.value),
    formatPackageSize: (sizeG: number) => formatPackageSize(sizeG, language.value),
    countryName: (code: string) => regionNames.value.of(code) ?? code,
  };
};

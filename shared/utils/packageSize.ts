// Bag sizes as the locale writes them: "1 kg", "1,5 kg", "250 g".
export const formatPackageSize = (sizeG: number, language: string): string =>
  sizeG >= 1000
    ? new Intl.NumberFormat(language, { style: 'unit', unit: 'kilogram', maximumFractionDigits: 3 }).format(sizeG / 1000)
    : new Intl.NumberFormat(language, { style: 'unit', unit: 'gram' }).format(sizeG);

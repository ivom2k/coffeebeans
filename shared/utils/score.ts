// Scores always show one decimal, with the locale's separator: "4,3" in Estonian.
// Intl rounds half up on the decimal value; toFixed rounds the binary float, which
// turns 4.35 into "4.3".
export const formatScore = (mean: number, language: string): string =>
  new Intl.NumberFormat(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(mean);

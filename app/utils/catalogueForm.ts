import type { CoffeeStatus, PackageInput, SpeciesCode, SpeciesInput } from '#shared/types/catalogue';

// The coffee form's starting state. A new coffee, or one pre-filled from a suggestion (Phase 7),
// may have no brand yet. The lists are readonly, so a composable's readonly copy of a loaded
// coffee can be passed in as it is: the form only reads them.
export type CoffeeDraft = {
  brandId: number | null;
  name: string;
  slug: string;
  status: CoffeeStatus;
  roastLevel: number | null;
  packages: readonly PackageInput[];
  species: readonly SpeciesInput[];
  origins: readonly string[];
  descriptions: { et: string | null };
};

export const emptyCoffee = (): CoffeeDraft => ({
  brandId: null,
  name: '',
  slug: '',
  status: 'DRAFT',
  roastLevel: null,
  packages: [],
  species: [],
  origins: [],
  descriptions: { et: null },
});

// Rows as typed: numbers stay text until saved, so an empty or half-typed field shows as typed.
// A key keeps each row's inputs in place while rows are added and removed around it.
export type PackageRow = { key: number; sizeG: string; gtin: string };
export type SpeciesRow = { key: number; code: SpeciesCode; percentage: string };

let lastRowKey = 0;
export const nextRowKey = () => ++lastRowKey;

// A whole number, or null for an empty field or anything else.
export const wholeNumber = (text: string): number | null => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);

export const toPackageRows = (packages: readonly PackageInput[]): PackageRow[] =>
  packages.map(pkg => ({ key: nextRowKey(), sizeG: String(pkg.sizeG), gtin: pkg.gtin ?? '' }));

export const toSpeciesRows = (species: readonly SpeciesInput[]): SpeciesRow[] =>
  species.map(row => ({ key: nextRowKey(), code: row.code, percentage: row.percentage === null ? '' : String(row.percentage) }));

export const speciesPercentages = (rows: readonly SpeciesRow[]) =>
  rows.map(row => ({ code: row.code, percentage: wholeNumber(row.percentage) }));

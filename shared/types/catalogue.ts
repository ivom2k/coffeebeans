// The admin coffee editor (decisions log §6). Served only under /api/admin/ and never cached.
// No imports: server/db/schema/ imports this file, and the seed loads the schema through Node's
// own TypeScript support, which resolves neither aliases nor extensionless paths.

// ARCHIVED = no longer sold, including sold-out limited releases. The schema's CHECK is built
// from this list.
export const coffeeStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type CoffeeStatus = (typeof coffeeStatuses)[number];

// The species vocabulary in sort_order. The codes are also the i18n keys; a database test keeps
// them equal to the migration's rows.
export const speciesCodes = ['ARABICA', 'ROBUSTA', 'LIBERICA', 'EXCELSA'] as const;
export type SpeciesCode = (typeof speciesCodes)[number];

export type BrandOption = { id: number; name: string; slug: string; countryCode: string | null };
export type BrandInput = { name: string; slug: string; countryCode: string | null };

export type PackageInput = { sizeG: number; gtin: string | null };
export type SpeciesInput = { code: SpeciesCode; percentage: number | null };

// What the coffee form sends. A GTIN may arrive in any printed form; the server stores the
// 14-digit one. Descriptions are keyed by locale so Russian adds without an API change.
export type CoffeeEditorInput = {
  brandId: number;
  name: string;
  slug: string;
  status: CoffeeStatus;
  roastLevel: number | null;
  packages: PackageInput[];
  species: SpeciesInput[];
  origins: string[];
  descriptions: { et: string | null };
};

// The form's starting state for an existing coffee. Dates are ISO strings, as JSON carries them.
export type CoffeeForEditing = CoffeeEditorInput & {
  id: number;
  imageUrl: string | null;
  reviewedAt: string | null;
};

// One row of the admin coffee list, drafts included.
export type CatalogueCoffeeRow = {
  id: number;
  slug: string;
  name: string;
  brandName: string;
  status: CoffeeStatus;
  ratingCount: number;
  hasImage: boolean;
  updatedAt: string;
};

// Why a save was refused with 409; the form shows it on the field it concerns.
export type CoffeeConflict
  = | { reason: 'slugTaken' }
    | { reason: 'nameTaken' }
    | { reason: 'cannotUnpublish' }
    | { reason: 'gtinTaken'; gtins: { gtin: string; coffeeName: string }[] };

export type BrandConflict = { reason: 'nameTaken' } | { reason: 'slugTaken' };

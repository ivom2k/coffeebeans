import type { CoffeeListItem } from './coffee';

export type BrandHit = { slug: string; name: string; countryCode: string | null; coffeeCount: number };

// An all-digit query is a barcode lookup: 'gtin' with coffee null when no package carries
// the code, or 'invalidGtin' when its check digit is wrong.
export type SearchResponse
  = | { kind: 'text'; brands: BrandHit[]; coffees: CoffeeListItem[] }
    | { kind: 'gtin'; coffee: (CoffeeListItem & { packageSizeG: number }) | null }
    | { kind: 'invalidGtin' };

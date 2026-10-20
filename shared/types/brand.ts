import type { CoffeeListItem, RankedCoffees } from './coffee';

export type BrandPageResponse = RankedCoffees & {
  brand: { slug: string; name: string; countryCode: string | null };
  // No longer sold: listed apart, since archived coffees leave the buying lists.
  archived: CoffeeListItem[];
};

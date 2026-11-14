import { coffeeStatuses, type CoffeeStatus } from '../types/catalogue';

// The coffee form's rules, shared by the form and the server's validation, so what the form
// shows is what the API enforces.

export type SpeciesShare = { total: number; allQuantified: boolean; valid: boolean };

// Percentages must add up to 100 only when every species has one (decisions log §4): "Arabica &
// Robusta" with no numbers is a valid declaration.
export const speciesShare = (rows: readonly { percentage: number | null }[]): SpeciesShare => {
  const total = rows.reduce((sum, row) => sum + (row.percentage ?? 0), 0);
  const allQuantified = rows.length > 0 && rows.every(row => row.percentage !== null);
  return { total, allQuantified, valid: !allQuantified || total === 100 };
};

// Where a coffee may move from its saved status (null: not saved yet). Once public it never goes
// back to draft: a draft has no page, so its URL and its old-slug redirects would answer 404.
// Archiving is how a coffee leaves the lists.
export const allowedStatuses = (saved: CoffeeStatus | null): readonly CoffeeStatus[] =>
  saved === null || saved === 'DRAFT' ? coffeeStatuses : coffeeStatuses.filter(status => status !== 'DRAFT');

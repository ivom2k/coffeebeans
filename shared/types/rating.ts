import type { MachineModelRef } from './machine';

// The vocabulary codes the rating form offers, in the tables' sort_order. They are also the
// i18n keys and the API's enums; a database test keeps them equal to the migration's rows.
export const beanSurfaceCodes = ['DRY', 'SLIGHTLY_OILY', 'OILY'] as const;
export const machineIssueCodes = [
  'BEANS_STICK_IN_HOPPER', 'GRINDER_STRUGGLED', 'GRINDER_JAMMED', 'FREQUENT_CLEANING', 'OTHER',
] as const;

export type BeanSurfaceCode = (typeof beanSurfaceCodes)[number];
export type MachineIssueCode = (typeof machineIssueCodes)[number];

// The optional sliders, 1 = low .. 5 = high; null = not answered (decisions log §2).
export type Perception = {
  bitterness: number | null;
  roastCharacter: number | null;
  crema: number | null;
  strength: number | null;
};

// What the rating form sends. machineIssues: null = skipped, [] = no issues; the server
// derives had_machine_issues from it, so the flag and the rows can't disagree.
export type RatingInput = {
  score: number;
  perception: Perception;
  beanSurface: BeanSurfaceCode | null;
  machineModelId: number | null;
  machineIssues: MachineIssueCode[] | null;
  privateNote: string | null;
};

// The signed-in user's own rating, private note included. Served only under /api/me/ and
// fetched only in the browser, never into a cached page.
export type MyRating = Omit<RatingInput, 'machineModelId'> & { machine: MachineModelRef | null };

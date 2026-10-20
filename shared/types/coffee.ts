// What public endpoints return about coffees. useFetch writes it into the page source and
// swr serves it to everyone, so it comes only from the catalogue tables and the summary
// views, never from individual ratings.

// Totals across all machines, present only when the coffee is flagged (decisions log §2).
export type MachineIssueFlag = { answered: number; withIssues: number };

export type CoffeeListItem = {
  slug: string;
  name: string;
  brandName: string;
  roastLevel: number | null;
  archived: boolean;
  ratingCount: number;
  rawMean: number | null;
  issueFlag: MachineIssueFlag | null;
};

export type RankingFilters = { roastLevels: number[]; fewIssuesOnly: boolean };

export type RankedCoffees = {
  ranked: CoffeeListItem[];
  // Below the ranked list's minimum rating count, ordered by brand and name.
  unrated: CoffeeListItem[];
};

export type MachineIssueGroup = { answered: number; withIssues: number; enoughAnswers: boolean };

// Counts of scores 1 to 5, in that order, so always five. Not a tuple type: useFetch's
// serialised types turn tuples into plain arrays.
export type ScoreCounts = readonly number[];

export type CoffeeDetails = {
  slug: string;
  name: string;
  archived: boolean;
  roastLevel: number | null;
  brand: { slug: string; name: string; countryCode: string | null };
  description: string | null;
  packages: { sizeG: number; gtin: string | null }[];
  species: { code: string; percentage: number | null }[];
  origins: string[];
  ratingCount: number;
  rawMean: number | null;
  scoreCounts: ScoreCounts;
  machineIssues: {
    automatic: (MachineIssueGroup & { manufacturerName: string })[];
    portafilter: MachineIssueGroup | null;
    // Answers a group needs before its share shows; the page states it for groups below it.
    minAnswers: number;
  };
};

// 'redirect' answers an old slug of a published coffee: the page sends a 301 to this one.
export type CoffeePageResponse
  = | { kind: 'coffee'; coffee: CoffeeDetails }
    | { kind: 'redirect'; slug: string };

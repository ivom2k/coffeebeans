// Coffee and machine suggestions and the "Minu ettepanekud" page (decisions log §6). No imports
// but relative .ts ones: server/db/schema/ imports this file, and the seed loads the schema
// through Node's own TypeScript support, which resolves neither aliases nor extensionless paths.

// The schema's CHECKs are built from these lists.
export const suggestionTypes = ['COFFEE_BEAN', 'MACHINE_MODEL'] as const;
export const suggestionStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE'] as const;
// The code is the i18n key (suggestion.reason.*).
export const suggestionReviewReasons = ['NOT_WHOLE_BEANS', 'NOT_SOLD_IN_ESTONIA', 'NOT_ENOUGH_INFO', 'OTHER'] as const;

export type SuggestionType = (typeof suggestionTypes)[number];
export type SuggestionReviewReason = (typeof suggestionReviewReasons)[number];

// The same two kinds as machine_model.kind; null when the user doesn't know.
type SuggestedMachineKind = 'AUTOMATIC' | 'PORTAFILTER';

// What `details` holds, by type. A coffee needs a name, a link or a photo; the photo isn't part
// of the details, it travels beside them.
export type CoffeeSuggestionDetails = { name: string | null; url: string | null };
export type MachineSuggestionDetails = { manufacturer: string; model: string; kind: SuggestedMachineKind | null };

// The form's `details` part, as JSON.
export type SuggestionInput
  = | ({ suggestionType: 'COFFEE_BEAN' } & CoffeeSuggestionDetails)
    | ({ suggestionType: 'MACHINE_MODEL' } & MachineSuggestionDetails);

// What became of a suggestion, as its author sees it. A coffee that is still a draft has no page,
// so a suggestion that led to one stays `waiting`, with no name and no link (decisions log §6).
export type SuggestionOutcome
  = | { kind: 'waiting' }
    | { kind: 'added' | 'exists'; coffee: { slug: string; brandName: string; name: string } }
    | { kind: 'added' | 'exists'; machine: { manufacturerName: string; modelName: string } }
    | { kind: 'rejected'; reason: SuggestionReviewReason; note: string | null };

// One row of the author's own list. Dates are ISO strings, as JSON carries them.
export type MySuggestion = {
  id: number;
  createdAt: string;
  // An outcome the author hasn't seen yet: the marker on the profile icon.
  unread: boolean;
  outcome: SuggestionOutcome;
} & (
  | { type: 'COFFEE_BEAN'; details: CoffeeSuggestionDetails }
  | { type: 'MACHINE_MODEL'; details: MachineSuggestionDetails }
);

export type UnreadOutcomes = { count: number };

// The POST that marks outcomes seen: the ids of the new ones the page showed.
export type MarkOutcomesSeenRequest = { ids: number[] };

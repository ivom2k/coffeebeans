import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { MySuggestion, SuggestionOutcome } from '../../../shared/types/suggestion.ts';
import type { Database } from '../../db/client.ts';
import { brand, coffeeBean, machineManufacturer, machineModel, suggestion } from '../../db/schema/index.ts';
import { readStoredCoffeeDetails, readStoredMachineDetails } from './suggestionInput.ts';

// The signed-in user's own suggestions and the marker for outcomes they haven't seen. Every query
// here filters on the user id from the session, never on an id from the request (CLAUDE.md
// § Access).

// How many the list shows, newest first. Every unseen outcome is among them, up to this many, so
// the marker can always be cleared by looking.
export const mySuggestionsLimit = 50;

// A suggestion that led to a coffee still in DRAFT has no outcome yet as far as its author can
// tell: the coffee has no page, and its name isn't public (decisions log §6).
const pointsAtDraft = sql`EXISTS (
  SELECT 1 FROM ${coffeeBean} WHERE ${coffeeBean.id} = ${suggestion.resultingCoffeeBeanId} AND ${coffeeBean.status} = 'DRAFT'
)`;

// One rule for the marker, the count, the list's choice of rows and marking as seen: reviewed, not
// yet seen, and not waiting on a draft. A draft's suggestion stays unseen, so its marker appears
// once the coffee is published.
const isUnseenOutcome = sql<boolean>`(
  ${suggestion.reviewedAt} IS NOT NULL AND ${suggestion.resultSeenAt} IS NULL
  AND (${suggestion.resultingCoffeeBeanId} IS NULL OR NOT ${pointsAtDraft})
)`;

const unseenOutcome = (userId: number): SQL | undefined => and(eq(suggestion.userId, userId), isUnseenOutcome);

type Row = {
  id: number;
  suggestionType: 'COFFEE_BEAN' | 'MACHINE_MODEL';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DUPLICATE';
  details: unknown;
  reviewReason: 'NOT_WHOLE_BEANS' | 'NOT_SOLD_IN_ESTONIA' | 'NOT_ENOUGH_INFO' | 'OTHER' | null;
  reviewNote: string | null;
  resultSeenAt: Date | null;
  createdAt: Date;
  coffee: { slug: string; name: string; status: string; brandName: string } | null;
  machine: { manufacturerName: string; modelName: string } | null;
};

const outcomeOf = (row: Row): SuggestionOutcome => {
  if (row.status === 'REJECTED') {
    return { kind: 'rejected', reason: row.reviewReason ?? 'OTHER', note: row.reviewNote };
  }
  if (row.status === 'PENDING') {
    return { kind: 'waiting' };
  }
  const kind = row.status === 'APPROVED' ? 'added' : 'exists';
  if (row.coffee !== null) {
    // The draft rule: no name and no slug until the coffee is public.
    return row.coffee.status === 'DRAFT'
      ? { kind: 'waiting' }
      : { kind, coffee: { slug: row.coffee.slug, brandName: row.coffee.brandName, name: row.coffee.name } };
  }
  return row.machine === null ? { kind: 'waiting' } : { kind, machine: row.machine };
};

// Pure, so the draft rule is tested without a database.
export const toMySuggestion = (row: Row): MySuggestion => {
  const outcome = outcomeOf(row);
  const base = {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    unread: outcome.kind !== 'waiting' && row.resultSeenAt === null,
    outcome,
  };
  return row.suggestionType === 'COFFEE_BEAN'
    ? { ...base, type: 'COFFEE_BEAN', details: readStoredCoffeeDetails(row.details) }
    : { ...base, type: 'MACHINE_MODEL', details: readStoredMachineDetails(row.details) };
};

const newestFirst = (a: { id: number; createdAt: Date }, b: { id: number; createdAt: Date }) =>
  b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id;

export const listMySuggestions = async (db: Database, userId: number): Promise<MySuggestion[]> => {
  const rows = await db
    .select({
      id: suggestion.id,
      suggestionType: suggestion.suggestionType,
      status: suggestion.status,
      details: suggestion.details,
      reviewReason: suggestion.reviewReason,
      reviewNote: suggestion.reviewNote,
      resultSeenAt: suggestion.resultSeenAt,
      createdAt: suggestion.createdAt,
      coffeeSlug: coffeeBean.slug,
      coffeeName: coffeeBean.name,
      coffeeStatus: coffeeBean.status,
      brandName: brand.name,
      manufacturerName: machineManufacturer.name,
      modelName: machineModel.name,
    })
    .from(suggestion)
    .leftJoin(coffeeBean, eq(coffeeBean.id, suggestion.resultingCoffeeBeanId))
    .leftJoin(brand, eq(brand.id, coffeeBean.brandId))
    .leftJoin(machineModel, eq(machineModel.id, suggestion.resultingMachineModelId))
    .leftJoin(machineManufacturer, eq(machineManufacturer.id, machineModel.manufacturerId))
    .where(eq(suggestion.userId, userId))
    // Unseen outcomes first when choosing the rows, so one older than the newest 50 still shows
    // and can be marked seen; then shown newest first.
    .orderBy(desc(isUnseenOutcome), desc(suggestion.createdAt), desc(suggestion.id))
    .limit(mySuggestionsLimit);

  return rows.toSorted(newestFirst).map(row => toMySuggestion({
    ...row,
    coffee: row.coffeeSlug !== null && row.coffeeName !== null && row.coffeeStatus !== null && row.brandName !== null
      ? { slug: row.coffeeSlug, name: row.coffeeName, status: row.coffeeStatus, brandName: row.brandName }
      : null,
    machine: row.manufacturerName !== null && row.modelName !== null
      ? { manufacturerName: row.manufacturerName, modelName: row.modelName }
      : null,
  }));
};

export const countUnreadOutcomes = (db: Database, userId: number): Promise<number> =>
  db.$count(suggestion, unseenOutcome(userId));

// The POST's body: the ids of the new outcomes the page showed.
export const markSeenSchema = z.strictObject({
  ids: z.array(z.number().int().positive()).max(mySuggestionsLimit),
});

// Called by a POST once the list has been shown, never while answering a GET (CLAUDE.md § Access:
// no state change on GET). Only the outcomes the page named: one reviewed after the list was
// drawn keeps its marker. Filtered on the session's user as well, so another account's ids mark
// nothing. Returns how many rows it marked.
export const markOutcomesSeen = async (db: Database, userId: number, ids: readonly number[]): Promise<number> => {
  if (ids.length === 0) {
    return 0;
  }
  const marked = await db.update(suggestion)
    .set({ resultSeenAt: sql`now()` })
    .where(and(unseenOutcome(userId), inArray(suggestion.id, [...ids])))
    .returning({ id: suggestion.id });
  return marked.length;
};

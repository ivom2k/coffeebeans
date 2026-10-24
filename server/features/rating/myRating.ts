import { and, asc, eq, ne } from 'drizzle-orm';
import { beanSurfaceCodes, machineIssueCodes, type MyRating } from '../../../shared/types/rating.ts';
import type { Database } from '../../db/client.ts';
import { coffeeBean, machineIssue, rating, ratingMachineIssue } from '../../db/schema/index.ts';
import { findMachineModel } from '../machine/machineModelRef.ts';

// Drafts were never public, so they can't be rated. Archived coffees can: someone may still
// have a bag of a sold-out release, and the archived page keeps its "Hinda" button.
export const findRateableCoffeeId = async (db: Database, slug: string): Promise<number | null> => {
  const [coffee] = await db
    .select({ id: coffeeBean.id })
    .from(coffeeBean)
    .where(and(eq(coffeeBean.slug, slug), ne(coffeeBean.status, 'DRAFT')));
  return coffee?.id ?? null;
};

// The foreign keys and the vocabulary test keep these columns within the code lists. A code
// outside them means a migration added a row the app doesn't know yet.
const toCode = <T extends string>(codes: readonly T[], value: string): T => {
  const code = codes.find(known => known === value);
  if (code === undefined) {
    throw new Error(`Unknown vocabulary code: ${value}`);
  }
  return code;
};

// The user's own rating, private note included. Callers serve it only to that user.
export const readMyRating = async (db: Database, userId: number, coffeeBeanId: number): Promise<MyRating | null> => {
  const [row] = await db
    .select()
    .from(rating)
    .where(and(eq(rating.userId, userId), eq(rating.coffeeBeanId, coffeeBeanId)));
  if (!row) {
    return null;
  }

  // One query at a time: db may be a transaction, which is a single connection.
  const machine = row.machineModelId === null ? null : await findMachineModel(db, row.machineModelId);
  const issueRows = row.hadMachineIssues
    ? await db
        .select({ code: ratingMachineIssue.machineIssueCode })
        .from(ratingMachineIssue)
        .innerJoin(machineIssue, eq(machineIssue.code, ratingMachineIssue.machineIssueCode))
        .where(eq(ratingMachineIssue.ratingId, row.id))
        .orderBy(asc(machineIssue.sortOrder))
    : [];

  return {
    score: row.score,
    perception: {
      bitterness: row.perceivedBitterness,
      roastCharacter: row.perceivedRoastCharacter,
      crema: row.perceivedCrema,
      strength: row.perceivedStrength,
    },
    beanSurface: row.beanSurfaceCode === null ? null : toCode(beanSurfaceCodes, row.beanSurfaceCode),
    machine,
    machineIssues: row.hadMachineIssues === null ? null : issueRows.map(issue => toCode(machineIssueCodes, issue.code)),
    privateNote: row.privateNote,
  };
};

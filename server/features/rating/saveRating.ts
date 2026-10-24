import { eq } from 'drizzle-orm';
import type { MyRating, RatingInput } from '../../../shared/types/rating.ts';
import type { Database } from '../../db/client.ts';
import { rating, ratingMachineIssue } from '../../db/schema/index.ts';
import { findMachineModel } from '../machine/machineModelRef.ts';
import { findRateableCoffeeId, readMyRating } from './myRating.ts';

export type SaveRatingResult
  = | { kind: 'saved'; rating: MyRating }
    | { kind: 'notFound' }
    | { kind: 'unknownMachine' };

// Creates the user's rating of the coffee or replaces it: one per user and coffee
// (decisions log §2). One transaction, so the summary views never see a rating without its
// issue rows. Inside a caller's transaction it runs as a savepoint.
export const saveRating = (db: Database, userId: number, slug: string, input: RatingInput): Promise<SaveRatingResult> =>
  db.transaction(async (tx): Promise<SaveRatingResult> => {
    const coffeeBeanId = await findRateableCoffeeId(tx, slug);
    if (coffeeBeanId === null) {
      return { kind: 'notFound' };
    }
    if (input.machineModelId !== null && await findMachineModel(tx, input.machineModelId) === null) {
      return { kind: 'unknownMachine' };
    }

    const values = {
      score: input.score,
      perceivedBitterness: input.perception.bitterness,
      perceivedRoastCharacter: input.perception.roastCharacter,
      perceivedCrema: input.perception.crema,
      perceivedStrength: input.perception.strength,
      beanSurfaceCode: input.beanSurface,
      machineModelId: input.machineModelId,
      // null = skipped, false = no issues: one input decides both the flag and the rows.
      hadMachineIssues: input.machineIssues === null ? null : input.machineIssues.length > 0,
      privateNote: input.privateNote,
    };
    const [saved] = await tx
      .insert(rating)
      .values({ userId, coffeeBeanId, ...values })
      .onConflictDoUpdate({ target: [rating.userId, rating.coffeeBeanId], set: values })
      .returning({ id: rating.id });
    if (!saved) {
      throw new Error('Rating upsert returned no row.');
    }

    await tx.delete(ratingMachineIssue).where(eq(ratingMachineIssue.ratingId, saved.id));
    if (input.machineIssues !== null && input.machineIssues.length > 0) {
      await tx.insert(ratingMachineIssue)
        .values(input.machineIssues.map(code => ({ ratingId: saved.id, machineIssueCode: code })));
    }

    const savedRating = await readMyRating(tx, userId, coffeeBeanId);
    if (!savedRating) {
      throw new Error('Saved rating not found.');
    }
    return { kind: 'saved', rating: savedRating };
  });

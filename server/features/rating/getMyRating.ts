import type { MyRating } from '../../../shared/types/rating.ts';
import type { Database } from '../../db/client.ts';
import { findRateableCoffeeId, readMyRating } from './myRating.ts';

// rating null: the user hasn't rated this coffee yet.
export type GetMyRatingResult = { kind: 'found'; rating: MyRating | null } | { kind: 'notFound' };

export const getMyRating = async (db: Database, userId: number, slug: string): Promise<GetMyRatingResult> => {
  const coffeeBeanId = await findRateableCoffeeId(db, slug);
  if (coffeeBeanId === null) {
    return { kind: 'notFound' };
  }
  return { kind: 'found', rating: await readMyRating(db, userId, coffeeBeanId) };
};

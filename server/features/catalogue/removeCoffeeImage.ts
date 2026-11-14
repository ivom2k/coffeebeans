import type { Database } from '../../db/client.ts';
import { removeImageFiles, switchImagePath } from './coffeeImageFiles.ts';

// The coffee falls back to the bean drawing. Its files go once the row no longer names them.
export const removeCoffeeImage = async (
  db: Database,
  mediaDir: string,
  coffeeId: number,
): Promise<{ kind: 'removed' } | { kind: 'notFound' }> => {
  const switched = await switchImagePath(db, coffeeId, null);
  if (!switched.found) {
    return { kind: 'notFound' };
  }
  if (switched.previous !== null) {
    await removeImageFiles(mediaDir, switched.previous);
  }
  return { kind: 'removed' };
};

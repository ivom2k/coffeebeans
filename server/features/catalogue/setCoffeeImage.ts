import { eq } from 'drizzle-orm';
import { coffeeImageUrl } from '../../../shared/utils/coffeeImage.ts';
import type { Database } from '../../db/client.ts';
import { coffeeBean } from '../../db/schema/index.ts';
import { newImagePath, removeImageFiles, switchImagePath, writeImageFiles } from './coffeeImageFiles.ts';
import { processCoffeeImage } from './processCoffeeImage.ts';

export type SetCoffeeImageResult
  = | { kind: 'saved'; imageUrl: string }
    | { kind: 'notFound' }
    | { kind: 'unsupported' }
    | { kind: 'tooLarge' };

// The new files are written before the row points at them, so the database never names a missing
// file, and removed again if the row can't be changed. The old files go only after the change has
// committed: a failure in between leaves an unused file behind, never a coffee without its photo.
export const setCoffeeImage = async (
  db: Database,
  mediaDir: string,
  coffeeId: number,
  upload: Buffer,
): Promise<SetCoffeeImageResult> => {
  const [coffee] = await db.select({ slug: coffeeBean.slug }).from(coffeeBean).where(eq(coffeeBean.id, coffeeId));
  if (!coffee) {
    return { kind: 'notFound' };
  }
  const processed = await processCoffeeImage(upload);
  if (processed.kind !== 'processed') {
    return processed;
  }

  const imagePath = newImagePath(coffee.slug);
  await writeImageFiles(mediaDir, imagePath, processed.image);
  const switched = await switchImagePath(db, coffeeId, imagePath).catch(async (error: unknown) => {
    await removeImageFiles(mediaDir, imagePath);
    throw error;
  });
  if (!switched.found) {
    // Deleted while the photo was being processed.
    await removeImageFiles(mediaDir, imagePath);
    return { kind: 'notFound' };
  }
  if (switched.previous !== null) {
    await removeImageFiles(mediaDir, switched.previous);
  }
  return { kind: 'saved', imageUrl: coffeeImageUrl(imagePath) };
};

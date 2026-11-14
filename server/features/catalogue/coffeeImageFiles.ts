import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { thumbnailPath } from '../../../shared/utils/coffeeImage.ts';
import type { Database } from '../../db/client.ts';
import { coffeeBean } from '../../db/schema/index.ts';
import type { ProcessedImage } from './processCoffeeImage.ts';

// Files under the media folder, which Caddy serves at /media/. Every path the app writes has this
// shape. It is checked before each delete, so a row edited by hand can't make the server remove a
// file outside the folder.
const storedPathPattern = /^coffee\/[a-z0-9-]+\.webp$/;

// The slug makes the file name say what it shows; the random part makes every upload a new URL,
// which lets Caddy tell browsers to keep the file forever, and keeps a draft's photo unguessable.
export const newImagePath = (slug: string) => `coffee/${slug}-${randomBytes(8).toString('hex')}.webp`;

const filesOf = (imagePath: string) => [imagePath, thumbnailPath(imagePath)];

export const writeImageFiles = async (mediaDir: string, imagePath: string, image: ProcessedImage) => {
  await mkdir(join(mediaDir, 'coffee'), { recursive: true });
  await writeFile(join(mediaDir, imagePath), image.photo);
  await writeFile(join(mediaDir, thumbnailPath(imagePath)), image.thumbnail);
};

// A file already gone is the outcome a delete wants, so only other errors are raised.
const unlinkIfPresent = async (path: string) => {
  try {
    await unlink(path);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
  }
};

export const removeImageFiles = async (mediaDir: string, imagePath: string) => {
  if (!storedPathPattern.test(imagePath)) {
    throw new Error(`Refusing to delete an image path the app never writes: ${imagePath}`);
  }
  for (const path of filesOf(imagePath)) {
    await unlinkIfPresent(join(mediaDir, path));
  }
};

export type ImageSwitch = { found: false } | { found: true; previous: string | null };

// Points the coffee at a new photo (or none) and returns the one it had, so the caller can delete
// that photo's files once the change has committed. The row is locked while it is read, so two
// uploads at once can't both see the same previous photo.
export const switchImagePath = (db: Database, coffeeId: number, imagePath: string | null): Promise<ImageSwitch> =>
  db.transaction(async (tx): Promise<ImageSwitch> => {
    const [row] = await tx.select({ imagePath: coffeeBean.imagePath }).from(coffeeBean)
      .where(eq(coffeeBean.id, coffeeId)).for('update');
    if (!row) {
      return { found: false };
    }
    await tx.update(coffeeBean).set({ imagePath }).where(eq(coffeeBean.id, coffeeId));
    return { found: true, previous: row.imagePath };
  });

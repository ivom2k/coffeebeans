import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../db/client.ts';
import { coffeeBean } from '../../db/schema/index.ts';
import { closeTestDb, createCoffee, withRollback } from '../../db/tests/helpers.ts';
import { gifImage, sidewaysPhotoWithLocation } from '../../tests/images.ts';
import { removeCoffeeImage } from './removeCoffeeImage.ts';
import { setCoffeeImage } from './setCoffeeImage.ts';

// A media folder of its own per test, so the files the feature writes and deletes are real.
let mediaDir: string;
beforeEach(async () => {
  mediaDir = await mkdtemp(join(tmpdir(), 'kohvioad-media-'));
});
afterEach(() => rm(mediaDir, { recursive: true, force: true }));
afterAll(closeTestDb);

const filesInMedia = async () => (await readdir(join(mediaDir, 'coffee')).catch(() => [])).toSorted();

const storedPath = async (tx: Database, coffeeId: number) =>
  (await tx.select({ imagePath: coffeeBean.imagePath }).from(coffeeBean).where(eq(coffeeBean.id, coffeeId)))[0]?.imagePath;

// The photo and its thumbnail, as file names in the coffee folder.
const pairOf = (imagePath: string) => {
  const name = imagePath.replace('coffee/', '');
  return [name, name.replace(/\.webp$/, '.thumb.webp')].toSorted();
};

describe('setCoffeeImage', () => {
  it('Should_WriteThePhotoAndThumbnail_When_TheCoffeeGetsItsFirstPhoto', () => withRollback(async (tx) => {
    // Arrange
    const coffee = await createCoffee(tx, { slug: 'vallozzi-crema' });

    // Act
    const result = await setCoffeeImage(tx, mediaDir, coffee.id, await sidewaysPhotoWithLocation());

    // Assert: named after the slug, and the row points at the photo the URL serves.
    const imagePath = await storedPath(tx, coffee.id);
    expect(imagePath).toMatch(/^coffee\/vallozzi-crema-[0-9a-f]{16}\.webp$/);
    expect(result).toEqual({ kind: 'saved', imageUrl: `/media/${imagePath}` });
    expect(await filesInMedia()).toEqual(pairOf(imagePath ?? ''));
  }));

  it('Should_DeleteTheOldFiles_When_ThePhotoIsReplaced', () => withRollback(async (tx) => {
    // Arrange
    const coffee = await createCoffee(tx);
    await setCoffeeImage(tx, mediaDir, coffee.id, await sidewaysPhotoWithLocation());
    const firstPath = await storedPath(tx, coffee.id);

    // Act
    await setCoffeeImage(tx, mediaDir, coffee.id, await sidewaysPhotoWithLocation());

    // Assert: a new name, so browsers that kept the old photo forever fetch the new one.
    const secondPath = await storedPath(tx, coffee.id);
    expect(secondPath).not.toBe(firstPath);
    expect(await filesInMedia()).toEqual(pairOf(secondPath ?? ''));
  }));

  it('Should_WriteNoFiles_When_TheUploadIsRefused', () => withRollback(async (tx) => {
    // Arrange
    const coffee = await createCoffee(tx);

    // Act
    const result = await setCoffeeImage(tx, mediaDir, coffee.id, await gifImage());

    // Assert
    expect(result).toEqual({ kind: 'unsupported' });
    expect(await filesInMedia()).toEqual([]);
    expect(await storedPath(tx, coffee.id)).toBeNull();
  }));

  it('Should_WriteNoFiles_When_TheCoffeeDoesNotExist', () => withRollback(async (tx) => {
    // Act
    const result = await setCoffeeImage(tx, mediaDir, 999_999_999, await sidewaysPhotoWithLocation());

    // Assert
    expect(result).toEqual({ kind: 'notFound' });
    expect(await filesInMedia()).toEqual([]);
  }));
});

describe('removeCoffeeImage', () => {
  it('Should_DeleteTheFilesAndClearThePath_When_ThePhotoIsRemoved', () => withRollback(async (tx) => {
    // Arrange
    const coffee = await createCoffee(tx);
    await setCoffeeImage(tx, mediaDir, coffee.id, await sidewaysPhotoWithLocation());

    // Act
    const result = await removeCoffeeImage(tx, mediaDir, coffee.id);

    // Assert
    expect(result).toEqual({ kind: 'removed' });
    expect(await filesInMedia()).toEqual([]);
    expect(await storedPath(tx, coffee.id)).toBeNull();
  }));

  it('Should_RefuseToDelete_When_TheStoredPathPointsOutsideTheMediaFolder', () => withRollback(async (tx) => {
    // Arrange: a row edited by hand to name a file the app never wrote.
    const coffee = await createCoffee(tx);
    await tx.update(coffeeBean).set({ imagePath: '../keep.webp' }).where(eq(coffeeBean.id, coffee.id));
    await mkdir(join(mediaDir, 'coffee'), { recursive: true });
    await writeFile(join(mediaDir, 'keep.webp'), 'not ours to delete');

    // Act
    const removal = removeCoffeeImage(tx, mediaDir, coffee.id);

    // Assert
    await expect(removal).rejects.toThrow('Refusing to delete');
    expect(await readdir(mediaDir)).toContain('keep.webp');
  }));
});

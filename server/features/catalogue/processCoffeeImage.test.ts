import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { gifImage, hugeClaimedPng, sidewaysPhotoWithLocation, truncatedPhoto } from '../../tests/images.ts';
import { processCoffeeImage } from './processCoffeeImage.ts';

const processed = async (input: Buffer) => {
  const result = await processCoffeeImage(input);
  if (result.kind !== 'processed') {
    throw new Error(`Expected a processed image, got ${result.kind}.`);
  }
  return result.image;
};

describe('processCoffeeImage', () => {
  it('Should_TurnThePhotoUpright_When_ExifSaysItIsSideways', async () => {
    // Arrange
    const input = await sidewaysPhotoWithLocation();

    // Act
    const { photo, thumbnail } = await processed(input);

    // Assert: 40 × 20 stored, 20 × 40 shown; small photos are never enlarged.
    expect(await sharp(photo).metadata()).toMatchObject({ format: 'webp', width: 20, height: 40 });
    expect(await sharp(thumbnail).metadata()).toMatchObject({ format: 'webp', width: 20, height: 40 });
  });

  it('Should_DropEveryExifTag_When_ThePhotoCarriesALocation', async () => {
    // Arrange
    const input = await sidewaysPhotoWithLocation();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    // Act
    const { photo, thumbnail } = await processed(input);

    // Assert
    for (const output of [photo, thumbnail]) {
      const metadata = await sharp(output).metadata();
      expect(metadata.exif).toBeUndefined();
      expect(metadata.orientation).toBeUndefined();
    }
  });

  it('Should_FitBothSizesInsideTheirBounds_When_ThePhotoIsLarge', async () => {
    // Arrange: a landscape photo bigger than both bounds.
    const input = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: '#E8EDFB' } }).jpeg().toBuffer();

    // Act
    const { photo, thumbnail } = await processed(input);

    // Assert: the long edge meets the bound and the aspect ratio stays.
    expect(await sharp(photo).metadata()).toMatchObject({ width: 960, height: 720 });
    expect(await sharp(thumbnail).metadata()).toMatchObject({ width: 160, height: 120 });
  });

  it.each([
    ['a GIF', gifImage],
    ['text', async () => Buffer.from('not an image')],
    ['a JPEG cut off halfway', truncatedPhoto],
  ])('Should_RefuseTheUpload_When_ItIs %s', async (_case, makeInput) => {
    // Act
    const result = await processCoffeeImage(await makeInput());

    // Assert
    expect(result).toEqual({ kind: 'unsupported' });
  });

  it('Should_RefuseTheUpload_When_ItsHeaderClaimsTooManyPixels', async () => {
    // Act
    const result = await processCoffeeImage(hugeClaimedPng());

    // Assert
    expect(result).toEqual({ kind: 'tooLarge' });
  });
});

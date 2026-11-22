import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { gifImage, hugeClaimedPng, sidewaysPhotoWithLocation, truncatedPhoto } from '../../tests/images.ts';
import { createSlotQueue, encodeImage, openImage, sniffImageFormat } from './imageDecoder.ts';

const maxPixels = 1_000_000;

const solid = (width = 8, height = 8) => sharp({ create: { width, height, channels: 3, background: '#3557B7' } });

const svgImage = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>');

describe('sniffImageFormat', () => {
  it.each([
    ['jpeg', () => solid().jpeg().toBuffer()],
    ['png', () => solid().png().toBuffer()],
    ['webp', () => solid().webp().toBuffer()],
  ] as const)('Should_NameTheFormat_When_TheBytesAre %s', async (format, makeImage) => {
    // Act
    const sniffed = sniffImageFormat(await makeImage());

    // Assert
    expect(sniffed).toBe(format);
  });

  it.each([
    ['a GIF', gifImage],
    ['a TIFF', () => solid().tiff().toBuffer()],
    ['an SVG', async () => svgImage],
    ['an HTML page', async () => Buffer.from('<!doctype html><script>alert(1)</script>')],
    ['a RIFF file that is not WebP', async () => Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt ', 'latin1')],
    ['two bytes of a JPEG', async () => Buffer.from([0xFF, 0xD8])],
    ['nothing', async () => Buffer.alloc(0)],
  ])('Should_ReturnNull_When_TheBytesAre %s', async (_case, makeInput) => {
    // Act
    const sniffed = sniffImageFormat(await makeInput());

    // Assert
    expect(sniffed).toBeNull();
  });
});

describe('openImage', () => {
  it.each([
    ['jpeg', () => solid().jpeg().toBuffer()],
    ['png', () => solid().png().toBuffer()],
    ['webp', () => solid().webp().toBuffer()],
  ] as const)('Should_OpenTheImage_When_ItIs %s', async (_format, makeImage) => {
    // Act
    const result = await openImage(await makeImage(), maxPixels);

    // Assert: it really decodes, so the loader for this format is switched on.
    expect(result.kind).toBe('opened');
    if (result.kind === 'opened') {
      const { info } = await result.image.raw().toBuffer({ resolveWithObject: true });
      expect([info.width, info.height]).toEqual([8, 8]);
    }
  });

  it('Should_TurnThePhotoUprightAndDropItsMetadata_When_EncodingIt', async () => {
    // Arrange
    const result = await openImage(await sidewaysPhotoWithLocation(), maxPixels);
    if (result.kind !== 'opened') {
      throw new Error(`Expected an opened image, got ${result.kind}.`);
    }

    // Act
    const encoded = await sharp(await result.image.webp().toBuffer()).metadata();

    // Assert: 40 × 20 stored sideways, 20 × 40 shown.
    expect([encoded.width, encoded.height]).toEqual([20, 40]);
    expect(encoded.exif).toBeUndefined();
  });

  it.each([
    ['a GIF', gifImage],
    ['a TIFF', () => solid().tiff().toBuffer()],
    ['an SVG', async () => svgImage],
    ['text', async () => Buffer.from('not an image')],
    ['a JPEG signature with nothing behind it', async () => Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10])],
    ['a PNG signature in front of an SVG', async () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), svgImage])],
  ])('Should_RefuseTheUpload_When_ItIs %s', async (_case, makeInput) => {
    // Act
    const result = await openImage(await makeInput(), maxPixels);

    // Assert
    expect(result).toEqual({ kind: 'unsupported' });
  });

  it('Should_RefuseTheUpload_When_ItsHeaderClaimsTooManyPixels', async () => {
    // Act: a few dozen bytes that would decode to 300 MB.
    const result = await openImage(hugeClaimedPng(), 64_000_000);

    // Assert
    expect(result).toEqual({ kind: 'tooLarge' });
  });

  it('Should_ApplyTheCallersLimit_When_TwoRoutesAllowDifferentSizes', async () => {
    // Arrange: 100 × 100 is 10 000 pixels.
    const image = await solid(100, 100).jpeg().toBuffer();

    // Act
    const results = [await openImage(image, 10_000), await openImage(image, 9999)];

    // Assert
    expect(results.map(result => result.kind)).toEqual(['opened', 'tooLarge']);
  });
});

describe('encodeImage', () => {
  it('Should_ReturnTheEncodedImage_When_TheDataIsWhole', async () => {
    // Arrange
    const opened = await openImage(await solid().jpeg().toBuffer(), maxPixels);
    if (opened.kind !== 'opened') {
      throw new Error(`Expected an opened image, got ${opened.kind}.`);
    }

    // Act
    const result = await encodeImage(opened.image.webp());

    // Assert
    expect(result.kind).toBe('encoded');
    if (result.kind === 'encoded') {
      expect((await sharp(result.data).metadata()).format).toBe('webp');
    }
  });

  it('Should_RefuseTheUpload_When_TheDataStopsHalfwayBehindAWholeHeader', async () => {
    // Arrange: the header passes, which is all openImage reads.
    const opened = await openImage(await truncatedPhoto(), maxPixels);
    if (opened.kind !== 'opened') {
      throw new Error(`Expected an opened image, got ${opened.kind}.`);
    }

    // Act
    const result = await encodeImage(opened.image.webp());

    // Assert: refused, where the encode itself would throw.
    expect(result).toEqual({ kind: 'unsupported' });
  });
});

// The sniff above is the first check; this is the second, underneath it. Should a later change
// hand bytes to sharp without sniffing them, libvips still has no loader for these.
describe('blocked loaders', () => {
  it.each([
    ['a GIF', gifImage],
    ['a TIFF', () => solid().tiff().toBuffer()],
    ['an SVG', async () => svgImage],
  ])('Should_FailInsideSharp_When_TheBytesAre %s', async (_case, makeInput) => {
    // Act
    const reading = sharp(await makeInput()).metadata();

    // Assert
    await expect(reading).rejects.toThrow();
  });
});

describe('createSlotQueue', () => {
  // Work that waits until the test lets it finish.
  const gate = () => {
    const { promise, resolve } = Promise.withResolvers<undefined>();
    return { wait: () => promise, open: () => resolve(undefined) };
  };

  it('Should_RunOneAtATime_When_SeveralArriveTogether', async () => {
    // Arrange
    const withSlot = createSlotQueue({ maxWaiting: 4 });
    let running = 0;
    let mostAtOnce = 0;
    const work = async () => {
      running += 1;
      mostAtOnce = Math.max(mostAtOnce, running);
      await new Promise(resolve => setTimeout(resolve, 5));
      running -= 1;
      return 'done';
    };

    // Act
    const results = await Promise.all([withSlot(work), withSlot(work), withSlot(work)]);

    // Assert
    expect(mostAtOnce).toBe(1);
    expect(results).toEqual(Array.from({ length: 3 }, () => ({ kind: 'ran', value: 'done' })));
  });

  it('Should_SayBusy_When_TheQueueIsFull', async () => {
    // Arrange: one running and one waiting is all this queue holds.
    const withSlot = createSlotQueue({ maxWaiting: 1 });
    const first = gate();
    const running = withSlot(first.wait);
    const waiting = withSlot(async () => 'second');

    // Act
    const refused = await withSlot(async () => 'third');
    first.open();

    // Assert: the refused work never ran, the queued one did.
    expect(refused).toEqual({ kind: 'busy' });
    expect(await waiting).toEqual({ kind: 'ran', value: 'second' });
    await running;
  });

  it('Should_FreeTheSlot_When_TheWorkFails', async () => {
    // Arrange
    const withSlot = createSlotQueue({ maxWaiting: 0 });
    const failing = withSlot(async () => {
      throw new Error('decode failed');
    });
    await expect(failing).rejects.toThrow('decode failed');

    // Act
    const next = await withSlot(async () => 'next');

    // Assert
    expect(next).toEqual({ kind: 'ran', value: 'next' });
  });
});

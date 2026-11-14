import sharp from 'sharp';

// Uploads are rare, so libvips keeps no cache of decoded images between them: on a 2 GB server
// that memory is better left to Postgres.
sharp.cache(false);

// Phone photos and screenshots. HEIC is left out: sharp's prebuilt binaries can't decode it, and
// the file input doesn't offer it, so iPhones send JPEG (decisions log §6).
const acceptedFormats = new Set(['jpeg', 'png', 'webp']);

// A 48-megapixel phone photo fits. The limit is checked against the header before anything is
// decoded, so a small file that would decode to a huge image (a decompression bomb) is refused.
export const maxInputPixels = 64_000_000;

// The coffee page shows the photo at most 240 px tall or 360 px wide, the list rows a 52 px
// square: room for a 3× screen at both. Never enlarged.
export const imageBounds = { photo: 960, thumbnail: 160 } as const;

export type ProcessedImage = { photo: Buffer; thumbnail: Buffer };
export type ProcessImageResult = { kind: 'processed'; image: ProcessedImage } | { kind: 'unsupported' } | { kind: 'tooLarge' };

const readFormat = async (input: Buffer) => {
  try {
    return await sharp(input).metadata();
  } catch {
    // Not an image sharp recognises: the same answer as an image in a format it won't take.
    return null;
  }
};

// Every upload is re-encoded (decisions log §4): auto-rotated from its EXIF orientation first,
// then written as WebP without any metadata, which is sharp's default, so EXIF and GPS are gone.
export const processCoffeeImage = async (input: Buffer): Promise<ProcessImageResult> => {
  const metadata = await readFormat(input);
  if (!metadata?.format || !acceptedFormats.has(metadata.format)) {
    return { kind: 'unsupported' };
  }
  if (metadata.width * metadata.height > maxInputPixels) {
    return { kind: 'tooLarge' };
  }

  const oriented = sharp(input, { limitInputPixels: maxInputPixels }).autoOrient();
  const encode = (bound: number, quality: number) => oriented.clone()
    .resize(bound, bound, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
  const photo = await encode(imageBounds.photo, 80);
  const thumbnail = await encode(imageBounds.thumbnail, 75);
  return { kind: 'processed', image: { photo, thumbnail } };
};

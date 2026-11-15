import { openImage } from '../media/imageDecoder.ts';

// A 48-megapixel phone photo fits. The limit is checked against the header before anything is
// decoded, so a small file that would decode to a huge image (a decompression bomb) is refused.
export const maxInputPixels = 64_000_000;

// The coffee page shows the photo at most 240 px tall or 360 px wide, the list rows a 52 px
// square: room for a 3× screen at both. Never enlarged.
export const imageBounds = { photo: 960, thumbnail: 160 } as const;

export type ProcessedImage = { photo: Buffer; thumbnail: Buffer };
export type ProcessImageResult = { kind: 'processed'; image: ProcessedImage } | { kind: 'unsupported' } | { kind: 'tooLarge' };

// Every upload is re-encoded (decisions log §4). The decoder accepts only JPEG, PNG and WebP,
// turns the photo upright from its EXIF orientation, and what is written here as WebP carries
// no metadata, so EXIF and GPS are gone.
export const processCoffeeImage = async (input: Buffer): Promise<ProcessImageResult> => {
  const opened = await openImage(input, maxInputPixels);
  if (opened.kind !== 'opened') {
    return opened;
  }

  const encode = (bound: number, quality: number) => opened.image.clone()
    .resize(bound, bound, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
  const photo = await encode(imageBounds.photo, 80);
  const thumbnail = await encode(imageBounds.thumbnail, 75);
  return { kind: 'processed', image: { photo, thumbnail } };
};

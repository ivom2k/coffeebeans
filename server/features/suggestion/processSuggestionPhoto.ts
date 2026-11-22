import { encodeImage, openImage } from '../media/imageDecoder.ts';

// A quarter of what the admin's photo may have (decisions log §6): a 12-megapixel phone photo
// fits, and the form sends at most 2000 px anyway. Read from the header, before decoding.
export const maxSuggestionPhotoPixels = 16_000_000;

// Plenty to read the barcode and the name on a price tag.
export const suggestionPhotoBound = 1600;

export type ProcessSuggestionPhotoResult = { kind: 'processed'; photo: Buffer } | { kind: 'unsupported' } | { kind: 'tooLarge' };

// Re-encoded like every upload (decisions log §4): only JPEG, PNG and WebP are decoded, the photo
// is turned upright, and the WebP written carries no metadata, so EXIF and GPS are gone. One file,
// never enlarged: only the admin sees it, and only until review.
export const processSuggestionPhoto = async (input: Buffer): Promise<ProcessSuggestionPhotoResult> => {
  const opened = await openImage(input, maxSuggestionPhotoPixels);
  if (opened.kind !== 'opened') {
    return opened;
  }
  const encoded = await encodeImage(opened.image
    .resize(suggestionPhotoBound, suggestionPhotoBound, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 }));
  return encoded.kind === 'encoded' ? { kind: 'processed', photo: encoded.data } : encoded;
};

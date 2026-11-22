import { maxSuggestionPhotoBytes, suggestionPhotoUploadBound } from '#shared/utils/suggestion';

// A suggestion's photo, made ready on the phone before it is sent (decisions log §6): drawn upright
// into a canvas of at most 2000 px and saved as JPEG. The canvas copy carries no EXIF, so the GPS
// tag never leaves the phone, and a store's mobile connection carries a few hundred kilobytes
// instead of several megabytes. Safari decodes HEIC itself, so an iPhone photo arrives as JPEG.
// The server relies on none of this: it decodes, re-encodes and strips the photo again.

export type PreparedPhoto = { kind: 'ready'; file: File } | { kind: 'tooLarge' };

const toJpeg = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));

const redraw = async (original: File): Promise<File | null> => {
  const bitmap = await createImageBitmap(original, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, suggestionPhotoUploadBound / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await toJpeg(canvas);
    return blob ? new File([blob], 'hinnasilt.jpg', { type: 'image/jpeg' }) : null;
  } finally {
    bitmap.close();
  }
};

export const preparePhoto = async (original: File): Promise<PreparedPhoto> => {
  try {
    const redrawn = await redraw(original);
    if (redrawn !== null && redrawn.size <= maxSuggestionPhotoBytes) {
      return { kind: 'ready', file: redrawn };
    }
  } catch (error) {
    // A browser that can't decode the file in a canvas sends the original instead, and the
    // server, which decodes everything itself, decides whether it is a photo at all.
    console.warn('Photo sent without resizing:', error instanceof Error ? error.message : error);
  }
  return original.size <= maxSuggestionPhotoBytes ? { kind: 'ready', file: original } : { kind: 'tooLarge' };
};

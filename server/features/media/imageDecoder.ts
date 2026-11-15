import sharp, { type Sharp } from 'sharp';

// The only file that imports sharp (eslint.config.mjs enforces it), so every image the server
// decodes goes through the same narrowing, whoever uploaded it.

// Uploads are rare, so libvips keeps no cache of decoded images between them: on a 2 GB server
// that memory is better left to Postgres.
sharp.cache(false);

// libvips picks a loader by looking at the bytes, and it has one for SVG, TIFF, GIF, PDF and
// more, each a parser an upload could reach. Every loader is switched off, then the three the
// site accepts are switched back on, for in-memory input only. Process-wide, and done as this
// module loads, before any image can arrive.
sharp.block({ operation: ['VipsForeignLoad'] });
sharp.unblock({ operation: ['VipsForeignLoadJpegBuffer', 'VipsForeignLoadPngBuffer', 'VipsForeignLoadWebpBuffer'] });

// Phone photos and screenshots. HEIC is left out: sharp's prebuilt binaries can't decode it, and
// the file inputs don't offer it (decisions log §6).
export type ImageFormat = 'jpeg' | 'png' | 'webp';

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

// The format by its first bytes, read here rather than by libvips: bytes that aren't one of the
// three never reach a parser at all. The Content-Type header says nothing, the client wrote it.
export const sniffImageFormat = (bytes: Uint8Array): ImageFormat | null => {
  if (startsWith(bytes, [0xFF, 0xD8, 0xFF])) {
    return 'jpeg';
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) {
    return 'png';
  }
  // "RIFF", four bytes of length, "WEBP".
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp';
  }
  return null;
};

export type OpenImageResult
  = | { kind: 'opened'; image: Sharp }
    | { kind: 'unsupported' }
    | { kind: 'tooLarge' };

const readHeader = async (input: Buffer) => {
  try {
    return await sharp(input).metadata();
  } catch {
    // Bytes that start like an image and aren't one: the same answer as a format never accepted.
    return null;
  }
};

// The pixel count comes from the header, before anything is decoded, so a small file that would
// decode to a huge image (a decompression bomb) is refused. The image handed back is turned
// upright from its EXIF orientation; whatever is encoded from it carries no metadata, which is
// sharp's default, so EXIF and GPS are gone (decisions log §4).
export const openImage = async (input: Buffer, maxPixels: number): Promise<OpenImageResult> => {
  const format = sniffImageFormat(input);
  if (format === null) {
    return { kind: 'unsupported' };
  }
  const header = await readHeader(input);
  if (header?.format !== format) {
    return { kind: 'unsupported' };
  }
  if (header.width * header.height > maxPixels) {
    return { kind: 'tooLarge' };
  }
  return { kind: 'opened', image: sharp(input, { limitInputPixels: maxPixels }).autoOrient() };
};

export type SlotResult<T> = { kind: 'ran'; value: T } | { kind: 'busy' };

// One piece of work at a time, with a short queue behind it. Decoding a photo takes tens of
// megabytes for a moment, so ten at once could push Postgres into swap. An upload takes its
// slot before its body is read, which bounds the bodies held in memory the same way.
export const createSlotQueue = ({ maxWaiting = 4 }: { maxWaiting?: number } = {}) => {
  let pending = 0;
  let last: Promise<unknown> = Promise.resolve();

  return async <T>(work: () => Promise<T>): Promise<SlotResult<T>> => {
    // One running plus maxWaiting in the queue: the next caller is told to come back.
    if (pending > maxWaiting) {
      return { kind: 'busy' };
    }
    pending += 1;
    const previous = last;
    const finished = Promise.withResolvers<undefined>();
    last = finished.promise;
    await previous;
    try {
      return { kind: 'ran', value: await work() };
    } finally {
      pending -= 1;
      finished.resolve(undefined);
    }
  };
};

// Shared by every upload route in the process: the admin's photo and a user's never decode at
// the same moment.
export const withImageSlot = createSlotQueue();

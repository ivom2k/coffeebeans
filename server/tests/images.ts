import { crc32, deflateSync } from 'node:zlib';
import sharp from 'sharp';

// Test images made on the spot, so no photo goes into the public repository.

// 40 × 20 pixels stored sideways: EXIF orientation 6 says to turn it a quarter clockwise, so it
// shows as 20 × 40. Carries a GPS tag and a copyright line, the metadata re-encoding must drop.
export const sidewaysPhotoWithLocation = () => sharp({ create: { width: 40, height: 20, channels: 3, background: '#3557B7' } })
  .jpeg()
  .withMetadata({ orientation: 6 })
  .withExif({ IFD0: { Copyright: 'kohvioad test' }, IFD3: { GPSLatitudeRef: 'N' } })
  .toBuffer();

export const gifImage = () => sharp({ create: { width: 4, height: 4, channels: 3, background: '#000000' } }).gif().toBuffer();

export const tiffImage = () => sharp({ create: { width: 4, height: 4, channels: 3, background: '#000000' } }).tiff().toBuffer();

export const svgImage = async () =>
  Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><script>alert(1)</script></svg>');

// A real photo of `width` × `height`, one colour, so a large one is still a small file.
export const plainPhoto = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#3557B7' } }).jpeg().toBuffer();

// A JPEG cut off halfway, as a phone can save one: the header is whole, so the format and size
// checks pass, and libvips fails only while decoding. Noise, so the missing half holds image data.
export const truncatedPhoto = async () => {
  const noise = { type: 'gaussian', mean: 128, sigma: 30 } as const;
  const photo = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#000000', noise } }).jpeg().toBuffer();
  return photo.subarray(0, Math.floor(photo.length / 2));
};

const pngChunk = (type: string, data: Buffer) => {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
};

// A decompression bomb's shape: a few dozen bytes whose header claims 10 000 × 10 000 pixels,
// 300 MB once decoded. Only the header is valid, which is all a size check may read.
export const hugeClaimedPng = () => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(10_000, 0);
  header.writeUInt32BE(10_000, 4);
  header[8] = 8; // bits per channel
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.alloc(16))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
};

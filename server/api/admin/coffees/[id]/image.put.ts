import { coffeeIdSchema } from '../../../../features/catalogue/catalogueInput.ts';
import { setCoffeeImage } from '../../../../features/catalogue/setCoffeeImage.ts';
import { withImageSlot } from '../../../../features/media/imageDecoder.ts';
import { adminImageLimit } from '../../../../features/security/bodyLimits.ts';
import { createUploadGate } from '../../../../features/security/uploadGate.ts';
import { readUpload } from '../../../../features/security/uploadRead.ts';

// The body is the image file itself, as the browser sends a File: no multipart to parse.
// server/middleware/0.guard.ts has already refused a declared length over the route's limit and
// a body sent without one, so the length is checked again here only as the read's own bound.

// One photo at a time: the editor sends one, so a second while the first arrives is a double tap.
// A gate of its own, so users' suggestions can never keep the admin's photo out.
const withAdminUpload = createUploadGate({ places: 1 });

// 15 MB at the 1 Mbit/s a weak mobile connection uploads.
const adminUploadDeadlineMs = 120_000;

export default defineEventHandler(async (event): Promise<{ imageUrl: string }> => {
  const admin = requireAdmin(event);
  const { id } = await getValidatedRouterParams(event, coffeeIdSchema.parse);

  const placed = await withAdminUpload(admin.id, async () => {
    const read = await readUpload(event.node.req, () => readRawBody(event, false), adminUploadDeadlineMs);
    if (read.kind !== 'read') {
      throw unfinishedUploadError(event, read.kind);
    }
    const upload = read.value;
    if (!upload || upload.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Image missing' });
    }
    if (upload.length > adminImageLimit.maxBytes) {
      throw createError({ statusCode: 413, statusMessage: 'Image too large' });
    }
    // The decoder's slot only now that the body is here: one decode at a time across every
    // upload route, and a slow upload holds nobody else's.
    return withImageSlot(() => setCoffeeImage(useDb(), useRuntimeConfig(event).mediaDir, id, upload));
  });
  if (placed.kind === 'inProgress') {
    setResponseHeader(event, 'Retry-After', 10);
    throw createError({ statusCode: 429, statusMessage: 'Upload already in progress' });
  }
  if (placed.kind === 'busy' || placed.value.kind === 'busy') {
    setResponseHeader(event, 'Retry-After', 10);
    throw createError({ statusCode: 503, statusMessage: 'Too many uploads at once' });
  }

  const result = placed.value.value;
  if (result.kind === 'notFound') {
    throw createError({ statusCode: 404, statusMessage: 'Coffee not found' });
  }
  if (result.kind !== 'saved') {
    throw createError({ statusCode: 422, statusMessage: 'Image not accepted', data: { reason: result.kind } });
  }
  // After the commit, as with every write that changes public pages.
  await clearPublicPageCache();
  return { imageUrl: result.imageUrl };
});

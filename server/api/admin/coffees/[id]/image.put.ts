import { coffeeIdSchema } from '../../../../features/catalogue/catalogueInput.ts';
import { setCoffeeImage } from '../../../../features/catalogue/setCoffeeImage.ts';
import { withImageSlot } from '../../../../features/media/imageDecoder.ts';
import { adminImageLimit } from '../../../../features/security/bodyLimits.ts';

// The body is the image file itself, as the browser sends a File: no multipart to parse.
// server/middleware/0.guard.ts has already refused a declared length over the route's limit and
// a body sent without one, so the length is checked again here only as the read's own bound.
export default defineEventHandler(async (event): Promise<{ imageUrl: string }> => {
  requireAdmin(event);
  const { id } = await getValidatedRouterParams(event, coffeeIdSchema.parse);

  // The slot is taken before the body is read: at most one upload is held in memory and
  // decoded at a time, across every upload route.
  const slot = await withImageSlot(async () => {
    const upload = await readRawBody(event, false);
    if (!upload || upload.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Image missing' });
    }
    if (upload.length > adminImageLimit.maxBytes) {
      throw createError({ statusCode: 413, statusMessage: 'Image too large' });
    }
    return setCoffeeImage(useDb(), useRuntimeConfig(event).mediaDir, id, upload);
  });
  if (slot.kind === 'busy') {
    setResponseHeader(event, 'Retry-After', 10);
    throw createError({ statusCode: 503, statusMessage: 'Too many uploads at once' });
  }

  const result = slot.value;
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

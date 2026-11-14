import { coffeeIdSchema } from '../../../../features/catalogue/catalogueInput.ts';
import { setCoffeeImage } from '../../../../features/catalogue/setCoffeeImage.ts';

// A phone photo is a few megabytes. Caddy caps every request body a little above this.
const maxUploadBytes = 15 * 1024 * 1024;

const tooLarge = () => createError({ statusCode: 413, statusMessage: 'Image too large' });

// The body is the image file itself, as the browser sends a File: no multipart to parse. A
// declared length over the limit is refused before anything is read; a body sent without one is
// still bounded by Caddy's cap, and checked once read.
export default defineEventHandler(async (event): Promise<{ imageUrl: string }> => {
  requireAdmin(event);
  const { id } = await getValidatedRouterParams(event, coffeeIdSchema.parse);
  if (Number(getRequestHeader(event, 'content-length') ?? 0) > maxUploadBytes) {
    throw tooLarge();
  }
  const upload = await readRawBody(event, false);
  if (!upload || upload.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Image missing' });
  }
  if (upload.length > maxUploadBytes) {
    throw tooLarge();
  }

  const result = await setCoffeeImage(useDb(), useRuntimeConfig(event).mediaDir, id, upload);
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

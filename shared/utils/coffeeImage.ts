// One upload becomes two WebP files on the media volume: the coffee page's photo and the list
// thumbnail beside it. image_path stores the photo's path; the thumbnail's is derived, so the
// naming lives here alone. Caddy serves the volume at /media/ (the dev server does locally).
export const thumbnailPath = (imagePath: string): string => imagePath.replace(/\.webp$/, '.thumb.webp');

export const coffeeImageUrl = (imagePath: string): string => `/media/${imagePath}`;

export const coffeeThumbnailUrl = (imagePath: string): string => `/media/${thumbnailPath(imagePath)}`;

import type { SaveCoffeeResult } from '../features/catalogue/saveCoffee.ts';

// The admin coffee save's outcome as HTTP, shared by create and update. A conflict carries its
// reason in `data`, which the form shows on the field it concerns.
export const savedCoffeeId = (result: SaveCoffeeResult): number => {
  switch (result.kind) {
    case 'saved':
      return result.id;
    case 'notFound':
      throw createError({ statusCode: 404, statusMessage: 'Coffee not found' });
    case 'unknownBrand':
      throw createError({ statusCode: 422, statusMessage: 'Unknown brand' });
    case 'conflict':
      throw createError({ statusCode: 409, statusMessage: 'Coffee conflict', data: result.conflict });
  }
};

import { bigint, index, pgTable, primaryKey, timestamp } from 'drizzle-orm/pg-core';
import { coffeeBean } from './catalogue.ts';
import { appUser } from './users.ts';

// Coffees a user keeps tabs on. "N new ratings since you added it" compares rating
// timestamps with this row's created_at: derived, not stored.
export const userWatchedCoffeeBean = pgTable('user_watched_coffee_bean', {
  userId: bigint('user_id', { mode: 'number' }).notNull()
    .references(() => appUser.id, { onDelete: 'cascade' }),
  coffeeBeanId: bigint('coffee_bean_id', { mode: 'number' }).notNull()
    .references(() => coffeeBean.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ name: 'user_watched_coffee_bean_pkey', columns: [t.userId, t.coffeeBeanId] }),
  index('user_watched_coffee_bean_bean_idx').on(t.coffeeBeanId),
]);

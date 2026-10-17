import { TransactionRollbackError, sql } from 'drizzle-orm';
import { createDatabase, type Database } from '../client.ts';
import {
  appUser, brand, coffeeBean, machineManufacturer, machineModel, rating, type coffeeBeanStatuses,
} from '../schema/index.ts';

const testDb = createDatabase(process.env.TEST_DATABASE_URL ?? '');

export const closeTestDb = () => testDb.$client.end();

// Runs a test body in a transaction that is always rolled back, so every test starts
// from the freshly migrated database and never sees another test's rows.
export const withRollback = async (body: (tx: Database) => Promise<void>) => {
  try {
    await testDb.transaction(async (tx) => {
      await body(tx);
      tx.rollback();
    });
  } catch (error) {
    if (!(error instanceof TransactionRollbackError)) {
      throw error;
    }
  }
};

// INSERT ... RETURNING of one row always yields that row; this narrows the type and
// fails loudly if that ever stops being true.
export const required = <T>(value: T | undefined): T => {
  if (value === undefined) {
    throw new Error('Expected a row, got none.');
  }
  return value;
};

// Unique names and slugs within a test run.
let sequence = 0;
const nextNumber = () => ++sequence;

export const createUser = async (tx: Database) => {
  const [user] = await tx.insert(appUser)
    .values({ authProvider: 'GOOGLE', externalSubject: `test-user-${nextNumber()}` })
    .returning();
  return required(user);
};

export const createCoffee = async (
  tx: Database,
  { status = 'PUBLISHED', slug }: { status?: (typeof coffeeBeanStatuses)[number]; slug?: string } = {},
) => {
  const number = nextNumber();
  const [brandRow] = await tx.insert(brand)
    .values({ name: `Brand ${number}`, slug: `brand-${number}` })
    .returning({ id: brand.id });
  const [coffee] = await tx.insert(coffeeBean)
    .values({ brandId: required(brandRow).id, name: `Coffee ${number}`, slug: slug ?? `coffee-${number}`, status })
    .returning();
  return required(coffee);
};

export const createMachineModel = async (tx: Database) => {
  const number = nextNumber();
  const [manufacturer] = await tx.insert(machineManufacturer)
    .values({ name: `Maker ${number}`, slug: `maker-${number}` })
    .returning({ id: machineManufacturer.id });
  const [model] = await tx.insert(machineModel)
    .values({ manufacturerId: required(manufacturer).id, name: `Model ${number}`, slug: `model-${number}`, kind: 'AUTOMATIC' })
    .returning();
  return required(model);
};

// One new user per score, since a user can rate a coffee only once. The users go in as
// one multi-row INSERT: a transaction is a single connection, and firing queries at it
// concurrently (Promise.all) is deprecated in pg 8 and an error in pg 9.
export const rateCoffee = async (tx: Database, coffeeBeanId: number, scores: readonly number[]) => {
  const users = await tx.insert(appUser)
    .values(scores.map(() => ({ authProvider: 'GOOGLE' as const, externalSubject: `test-user-${nextNumber()}` })))
    .returning({ id: appUser.id });
  await tx.insert(rating).values(scores.map((score, index) => ({
    userId: required(users[index]).id, coffeeBeanId, score,
  })));
};

export const anonymiseUser = async (tx: Database, userId: number) => {
  const result = await tx.execute<{ anonymised: boolean }>(sql`SELECT anonymise_user(${userId}) AS anonymised`);
  return required(result.rows[0]).anonymised;
};

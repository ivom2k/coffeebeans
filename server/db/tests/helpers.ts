import { TransactionRollbackError, sql } from 'drizzle-orm';
import { createDatabase, type Database } from '../client.ts';
import {
  appUser, brand, coffeeBean, machineManufacturer, machineModel, rating, ratingMachineIssue,
  type coffeeBeanStatuses, type machineKinds,
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

export const createBrand = async (tx: Database, { name }: { name?: string } = {}) => {
  const number = nextNumber();
  const [brandRow] = await tx.insert(brand)
    .values({ name: name ?? `Brand ${number}`, slug: `brand-${number}` })
    .returning();
  return required(brandRow);
};

type CoffeeOptions = {
  status?: (typeof coffeeBeanStatuses)[number];
  slug?: string;
  name?: string;
  brandId?: number; // a new brand when left out
  roastLevel?: number | null;
};

export const createCoffee = async (
  tx: Database,
  { status = 'PUBLISHED', slug, name, brandId, roastLevel = null }: CoffeeOptions = {},
) => {
  const number = nextNumber();
  const ownerId = brandId ?? (await createBrand(tx)).id;
  const [coffee] = await tx.insert(coffeeBean)
    .values({ brandId: ownerId, name: name ?? `Coffee ${number}`, slug: slug ?? `coffee-${number}`, status, roastLevel })
    .returning();
  return required(coffee);
};

export const createManufacturer = async (tx: Database, { name }: { name?: string } = {}) => {
  const number = nextNumber();
  const [manufacturer] = await tx.insert(machineManufacturer)
    .values({ name: name ?? `Maker ${number}`, slug: `maker-${number}` })
    .returning();
  return required(manufacturer);
};

export const createMachineModel = async (
  tx: Database,
  { kind = 'AUTOMATIC', manufacturerId }: { kind?: (typeof machineKinds)[number]; manufacturerId?: number } = {},
) => {
  const number = nextNumber();
  const ownerId = manufacturerId ?? (await createManufacturer(tx)).id;
  const [model] = await tx.insert(machineModel)
    .values({ manufacturerId: ownerId, name: `Model ${number}`, slug: `model-${number}`, kind })
    .returning();
  return required(model);
};

type RatingSpec = {
  score: number;
  machineModelId?: number;
  issues?: readonly string[] | null; // null or left out = skipped, [] = no issues
};

// One new user per rating, since a user can rate a coffee only once. Each table gets one
// multi-row INSERT: a transaction is a single connection, and firing queries at it
// concurrently (Promise.all) is deprecated in pg 8 and an error in pg 9.
export const addRatings = async (tx: Database, coffeeBeanId: number, specs: readonly RatingSpec[]) => {
  const users = await tx.insert(appUser)
    .values(specs.map(() => ({ authProvider: 'GOOGLE' as const, externalSubject: `test-user-${nextNumber()}` })))
    .returning({ id: appUser.id });
  const userIds = specs.map((_, index) => required(users[index]).id);

  const ratings = await tx.insert(rating).values(specs.map((spec, index) => ({
    userId: required(userIds[index]),
    coffeeBeanId,
    score: spec.score,
    machineModelId: spec.machineModelId ?? null,
    // The rating API's rule: one input decides both the flag and the rows.
    hadMachineIssues: spec.issues == null ? null : spec.issues.length > 0,
  }))).returning({ id: rating.id, userId: rating.userId });
  const ratingIdByUser = new Map(ratings.map(row => [row.userId, row.id]));

  const issueRows = specs.flatMap((spec, index) => (spec.issues ?? []).map(code => ({
    ratingId: required(ratingIdByUser.get(required(userIds[index]))),
    machineIssueCode: code,
  })));
  if (issueRows.length > 0) {
    await tx.insert(ratingMachineIssue).values(issueRows);
  }
};

export const rateCoffee = (tx: Database, coffeeBeanId: number, scores: readonly number[]) =>
  addRatings(tx, coffeeBeanId, scores.map(score => ({ score })));

export const anonymiseUser = async (tx: Database, userId: number) => {
  const result = await tx.execute<{ anonymised: boolean }>(sql`SELECT anonymise_user(${userId}) AS anonymised`);
  return required(result.rows[0]).anonymised;
};

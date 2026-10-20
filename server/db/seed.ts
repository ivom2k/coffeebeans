// Fictional development and test data: every brand, coffee and machine name is invented,
// because this file is public and the seed is served on the pre-launch site.
// Run with `npm run db:seed` on a freshly migrated database.
import { eq } from 'drizzle-orm';
import { createDatabase, type Database } from './client.ts';
import {
  appUser, brand, coffeeBean, coffeeBeanOrigin, coffeeBeanPackage, coffeeBeanSpecies,
  coffeeBeanTranslation, machineManufacturer, machineModel, rating, ratingMachineIssue,
  userMachine, type coffeeBeanStatuses, type machineKinds,
} from './schema/index.ts';

type CoffeeSeed = {
  brand: string; // brand slug
  name: string;
  slug: string;
  roastLevel: number | null;
  status: (typeof coffeeBeanStatuses)[number];
  // GTINs use GS1's 200-299 prefix range, which is reserved for in-store codes and never
  // assigned to a manufacturer's product, with valid check digits.
  packages: readonly { sizeG: number; gtin: string | null }[];
  species: readonly { code: string; percentage: number | null }[];
  origins: readonly string[];
  description?: string; // Estonian
};

type MachineSeed = {
  manufacturer: string;
  manufacturerSlug: string;
  models: readonly { name: string; slug: string; kind: (typeof machineKinds)[number] }[];
};

type RatingSeed = {
  coffee: string; // coffee slug
  user: number; // seed user number
  score: number;
  machine?: string; // machine model slug
  surface?: string; // bean_surface code
  issues: readonly string[] | null; // null = skipped, [] = no issues
  perceived?: { bitterness?: number; roastCharacter?: number; crema?: number; strength?: number };
  note?: string;
};

const userCount = 12;

const brands = [
  { name: 'Vallozzi', slug: 'vallozzi', countryCode: 'IT' }, // doubled letters: "valozzi", one letter short, must find it
  { name: 'Põhjaröst', slug: 'pohjarost', countryCode: 'EE' }, // accents: "pohjarost" must find it
  { name: 'Tormikohv', slug: 'tormikohv', countryCode: 'EE' },
] as const;

const coffees: readonly CoffeeSeed[] = [
  {
    brand: 'vallozzi', name: 'Crema Dolce', slug: 'vallozzi-crema-dolce', roastLevel: 3, status: 'PUBLISHED',
    packages: [{ sizeG: 1000, gtin: '02001234500012' }, { sizeG: 500, gtin: '02001234500029' }],
    species: [{ code: 'ARABICA', percentage: 70 }, { code: 'ROBUSTA', percentage: 30 }],
    origins: ['BR', 'VN'],
    description: 'Pehme ja ühtlane segu igapäevaseks espressoks. Sobib hästi piimajookidesse.',
  },
  {
    brand: 'vallozzi', name: 'Intenso Scuro', slug: 'vallozzi-intenso-scuro', roastLevel: 5, status: 'PUBLISHED',
    packages: [{ sizeG: 1000, gtin: '02001234500036' }],
    species: [{ code: 'ARABICA', percentage: 20 }, { code: 'ROBUSTA', percentage: 80 }],
    origins: ['VN', 'IN', 'UG'],
    description: 'Tume röst ja palju robustat: kange, mõru ja õline uba.',
  },
  {
    brand: 'vallozzi', name: 'Gran Aroma', slug: 'vallozzi-gran-aroma', roastLevel: 4, status: 'ARCHIVED',
    packages: [{ sizeG: 1000, gtin: '02001234500043' }],
    species: [{ code: 'ARABICA', percentage: null }, { code: 'ROBUSTA', percentage: null }],
    origins: [],
  },
  {
    brand: 'vallozzi', name: 'Oro Classico', slug: 'vallozzi-oro-classico', roastLevel: 3, status: 'PUBLISHED',
    packages: [{ sizeG: 1000, gtin: '02001234500050' }, { sizeG: 250, gtin: '02001234500067' }],
    species: [{ code: 'ARABICA', percentage: 100 }],
    origins: ['BR'],
  },
  {
    brand: 'pohjarost', name: 'Hommik', slug: 'pohjarost-hommik', roastLevel: 2, status: 'PUBLISHED',
    packages: [{ sizeG: 500, gtin: '02001234500074' }, { sizeG: 250, gtin: '02001234500081' }],
    species: [{ code: 'ARABICA', percentage: 100 }],
    origins: ['ET', 'CO'],
    description: 'Hele röst, erk ja puuviljane. Etioopia ja Colombia ubade segu.',
  },
  {
    brand: 'pohjarost', name: 'Öine Espresso', slug: 'pohjarost-oine-espresso', roastLevel: 4, status: 'PUBLISHED',
    packages: [{ sizeG: 1000, gtin: '02001234500098' }],
    species: [{ code: 'ARABICA', percentage: 90 }, { code: 'ROBUSTA', percentage: 10 }],
    origins: ['BR', 'IN'],
  },
  {
    // A limited lot: the harvest year is part of the name (decisions log §1).
    brand: 'pohjarost', name: 'Etioopia Guji 2026', slug: 'pohjarost-etioopia-guji-2026', roastLevel: 1, status: 'PUBLISHED',
    packages: [{ sizeG: 250, gtin: null }],
    species: [{ code: 'ARABICA', percentage: 100 }],
    origins: ['ET'],
  },
  {
    brand: 'pohjarost', name: 'Talvesegu', slug: 'pohjarost-talvesegu', roastLevel: 3, status: 'DRAFT',
    packages: [{ sizeG: 500, gtin: '02001234500104' }],
    species: [{ code: 'ARABICA', percentage: null }, { code: 'ROBUSTA', percentage: null }],
    origins: [],
  },
  {
    // Renamed at the end of the seed, so its old slug gets a redirect.
    brand: 'tormikohv', name: 'Tume', slug: 'tormikohv-tume', roastLevel: 5, status: 'PUBLISHED',
    // Two 1 kg packages: the same product can carry different GTINs in different markets.
    packages: [{ sizeG: 1000, gtin: '02001234500111' }, { sizeG: 1000, gtin: '02001234500128' }],
    species: [{ code: 'ARABICA', percentage: 60 }, { code: 'ROBUSTA', percentage: 40 }],
    origins: [],
  },
  {
    brand: 'tormikohv', name: 'Kerge Tuul', slug: 'tormikohv-kerge-tuul', roastLevel: 1, status: 'PUBLISHED',
    packages: [{ sizeG: 500, gtin: '02001234500135' }],
    species: [{ code: 'ARABICA', percentage: 100 }],
    origins: ['KE'],
  },
];

const machines: readonly MachineSeed[] = [
  {
    manufacturer: 'Veskimees', manufacturerSlug: 'veskimees', models: [
      { name: 'VM 100', slug: 'vm-100', kind: 'AUTOMATIC' },
      { name: 'VM 300 Plus', slug: 'vm-300-plus', kind: 'AUTOMATIC' },
    ],
  },
  { manufacturer: 'Duomatica', manufacturerSlug: 'duomatica', models: [{ name: 'Duo 5', slug: 'duo-5', kind: 'AUTOMATIC' }] },
  { manufacturer: 'Kangpress', manufacturerSlug: 'kangpress', models: [{ name: 'Classic 1', slug: 'classic-1', kind: 'PORTAFILTER' }] },
];

const userMachines = [
  { user: 1, machine: 'vm-300-plus', nickname: 'Kodu' },
  { user: 1, machine: 'classic-1', nickname: 'Töö' },
  { user: 2, machine: 'duo-5', nickname: null },
] as const;

// Spread so the ranking, the histogram and the machine-issue summary all have something
// to show: one coffee with a single 5 (it ranks below well-rated coffees with many
// ratings), an oily coffee with grinder trouble, skipped answers, and no machine named.
// A machine-issue group needs 5 answers before its share shows, so three coffees reach it
// in one group each: Intenso Scuro a high share, Crema Dolce a low one, Hommik none at all.
const ratings: readonly RatingSeed[] = [
  { coffee: 'vallozzi-crema-dolce', user: 1, score: 5, machine: 'vm-300-plus', surface: 'DRY', issues: [], perceived: { bitterness: 2, roastCharacter: 3, crema: 4, strength: 3 }, note: 'Osta uuesti, kui on soodushinnaga.' },
  { coffee: 'vallozzi-crema-dolce', user: 2, score: 4, machine: 'duo-5', surface: 'DRY', issues: [] },
  { coffee: 'vallozzi-crema-dolce', user: 3, score: 4, machine: 'classic-1', surface: 'SLIGHTLY_OILY', issues: [], perceived: { crema: 5 } },
  { coffee: 'vallozzi-crema-dolce', user: 4, score: 5, machine: 'vm-100', surface: 'DRY', issues: [] },
  { coffee: 'vallozzi-crema-dolce', user: 5, score: 3, issues: null },
  { coffee: 'vallozzi-crema-dolce', user: 6, score: 4, machine: 'vm-300-plus', surface: 'DRY', issues: null },
  { coffee: 'vallozzi-crema-dolce', user: 7, score: 4, machine: 'duo-5', surface: 'SLIGHTLY_OILY', issues: ['FREQUENT_CLEANING'] },
  { coffee: 'vallozzi-crema-dolce', user: 8, score: 5, machine: 'classic-1', surface: 'DRY', issues: [] },
  { coffee: 'vallozzi-crema-dolce', user: 9, score: 2, machine: 'vm-100', surface: 'DRY', issues: [], perceived: { bitterness: 5 }, note: 'Liiga mõru, isegi piimaga.' },
  { coffee: 'vallozzi-crema-dolce', user: 10, score: 4, machine: 'duo-5', issues: [] },
  { coffee: 'vallozzi-crema-dolce', user: 11, score: 5, machine: 'vm-100', surface: 'DRY', issues: [] },
  { coffee: 'vallozzi-crema-dolce', user: 12, score: 4, machine: 'vm-300-plus', surface: 'DRY', issues: ['FREQUENT_CLEANING'] },

  { coffee: 'vallozzi-intenso-scuro', user: 1, score: 3, machine: 'vm-300-plus', surface: 'OILY', issues: ['GRINDER_STRUGGLED', 'FREQUENT_CLEANING'], perceived: { bitterness: 5, roastCharacter: 5, strength: 5 } },
  { coffee: 'vallozzi-intenso-scuro', user: 2, score: 2, machine: 'duo-5', surface: 'OILY', issues: ['BEANS_STICK_IN_HOPPER'] },
  { coffee: 'vallozzi-intenso-scuro', user: 3, score: 4, machine: 'classic-1', surface: 'OILY', issues: [] },
  { coffee: 'vallozzi-intenso-scuro', user: 4, score: 3, machine: 'vm-100', surface: 'OILY', issues: ['BEANS_STICK_IN_HOPPER', 'GRINDER_STRUGGLED'] },
  { coffee: 'vallozzi-intenso-scuro', user: 5, score: 2, machine: 'duo-5', surface: 'OILY', issues: ['GRINDER_JAMMED'] },
  { coffee: 'vallozzi-intenso-scuro', user: 6, score: 3, machine: 'vm-300-plus', surface: 'SLIGHTLY_OILY', issues: [] },
  { coffee: 'vallozzi-intenso-scuro', user: 9, score: 2, machine: 'vm-100', surface: 'OILY', issues: ['GRINDER_STRUGGLED'] },
  { coffee: 'vallozzi-intenso-scuro', user: 11, score: 3, machine: 'vm-300-plus', surface: 'OILY', issues: [] },
  { coffee: 'vallozzi-intenso-scuro', user: 7, score: 3, machine: 'duo-5', surface: 'OILY', issues: [] },
  { coffee: 'vallozzi-intenso-scuro', user: 8, score: 3, machine: 'duo-5', surface: 'OILY', issues: [] },
  { coffee: 'vallozzi-intenso-scuro', user: 10, score: 4, machine: 'duo-5', surface: 'OILY', issues: [] },

  { coffee: 'vallozzi-gran-aroma', user: 7, score: 4, machine: 'vm-100', surface: 'DRY', issues: [] },
  { coffee: 'vallozzi-gran-aroma', user: 8, score: 3, machine: 'duo-5', surface: 'DRY', issues: [] },
  { coffee: 'vallozzi-gran-aroma', user: 9, score: 4, issues: null },

  { coffee: 'pohjarost-hommik', user: 1, score: 5, machine: 'vm-300-plus', surface: 'DRY', issues: [], perceived: { bitterness: 1, roastCharacter: 1 } },
  { coffee: 'pohjarost-hommik', user: 3, score: 5, machine: 'classic-1', surface: 'DRY', issues: [] },
  { coffee: 'pohjarost-hommik', user: 8, score: 4, machine: 'classic-1', surface: 'DRY', issues: [] },
  { coffee: 'pohjarost-hommik', user: 11, score: 5, machine: 'vm-100', surface: 'DRY', issues: [] },
  { coffee: 'pohjarost-hommik', user: 6, score: 4, machine: 'classic-1', surface: 'DRY', issues: [] },
  { coffee: 'pohjarost-hommik', user: 10, score: 5, machine: 'classic-1', surface: 'DRY', issues: [] },
  { coffee: 'pohjarost-hommik', user: 12, score: 4, machine: 'classic-1', surface: 'DRY', issues: [] },

  { coffee: 'pohjarost-oine-espresso', user: 2, score: 4, machine: 'duo-5', surface: 'SLIGHTLY_OILY', issues: [] },
  { coffee: 'pohjarost-oine-espresso', user: 4, score: 4, machine: 'vm-100', surface: 'SLIGHTLY_OILY', issues: ['OTHER'] },
  { coffee: 'pohjarost-oine-espresso', user: 12, score: 3, machine: 'classic-1', surface: 'SLIGHTLY_OILY', issues: [] },

  { coffee: 'pohjarost-etioopia-guji-2026', user: 3, score: 5, machine: 'classic-1', surface: 'DRY', issues: [], perceived: { roastCharacter: 1 } },

  { coffee: 'tormikohv-tume', user: 5, score: 3, machine: 'vm-300-plus', surface: 'OILY', issues: ['GRINDER_STRUGGLED'] },
  { coffee: 'tormikohv-tume', user: 6, score: 4, machine: 'classic-1', surface: 'OILY', issues: [] },
  { coffee: 'tormikohv-tume', user: 7, score: 3, machine: 'duo-5', surface: 'OILY', issues: ['GRINDER_JAMMED', 'OTHER'] },
  { coffee: 'tormikohv-tume', user: 9, score: 2, machine: 'vm-100', surface: 'OILY', issues: ['BEANS_STICK_IN_HOPPER'] },
  { coffee: 'tormikohv-tume', user: 11, score: 3, issues: null },

  { coffee: 'tormikohv-kerge-tuul', user: 10, score: 2, machine: 'duo-5', surface: 'DRY', issues: [] },
  { coffee: 'tormikohv-kerge-tuul', user: 12, score: 3, machine: 'classic-1', surface: 'DRY', issues: [] },
];

const seedSubject = (user: number) => `seed-user-${String(user).padStart(2, '0')}`;

const lookup = <K>(ids: ReadonlyMap<K, number>, key: K): number => {
  const id = ids.get(key);
  if (id === undefined) {
    throw new Error(`Seed data refers to an unknown key: ${String(key)}`);
  }
  return id;
};

const seed = async (db: Database) => {
  if (await db.$count(brand) > 0) {
    throw new Error('The database already has a catalogue. Seed only a freshly migrated database.');
  }

  const brandIds = new Map((await db.insert(brand).values([...brands])
    .returning({ id: brand.id, slug: brand.slug })).map(row => [row.slug, row.id]));

  const coffeeIds = new Map((await db.insert(coffeeBean)
    .values(coffees.map(coffee => ({
      brandId: lookup(brandIds, coffee.brand),
      name: coffee.name,
      slug: coffee.slug,
      roastLevel: coffee.roastLevel,
      status: coffee.status,
    })))
    .returning({ id: coffeeBean.id, slug: coffeeBean.slug })).map(row => [row.slug, row.id]));

  await db.insert(coffeeBeanPackage).values(coffees.flatMap(coffee =>
    coffee.packages.map(pkg => ({ coffeeBeanId: lookup(coffeeIds, coffee.slug), ...pkg }))));
  await db.insert(coffeeBeanSpecies).values(coffees.flatMap(coffee =>
    coffee.species.map(({ code, percentage }) => ({ coffeeBeanId: lookup(coffeeIds, coffee.slug), speciesCode: code, percentage }))));
  await db.insert(coffeeBeanOrigin).values(coffees.flatMap(coffee =>
    coffee.origins.map(countryCode => ({ coffeeBeanId: lookup(coffeeIds, coffee.slug), countryCode }))));
  await db.insert(coffeeBeanTranslation).values(coffees.flatMap(coffee =>
    coffee.description ? [{ coffeeBeanId: lookup(coffeeIds, coffee.slug), locale: 'et' as const, description: coffee.description }] : []));

  const manufacturerIds = new Map((await db.insert(machineManufacturer)
    .values(machines.map(({ manufacturer, manufacturerSlug }) => ({ name: manufacturer, slug: manufacturerSlug })))
    .returning({ id: machineManufacturer.id, slug: machineManufacturer.slug })).map(row => [row.slug, row.id]));

  const modelIds = new Map((await db.insert(machineModel)
    .values(machines.flatMap(machine => machine.models.map(model => ({
      manufacturerId: lookup(manufacturerIds, machine.manufacturerSlug), ...model,
    }))))
    .returning({ id: machineModel.id, slug: machineModel.slug })).map(row => [row.slug, row.id]));

  const userIds = new Map((await db.insert(appUser)
    .values(Array.from({ length: userCount }, (_, index) => ({ authProvider: 'GOOGLE' as const, externalSubject: seedSubject(index + 1) })))
    .returning({ id: appUser.id, externalSubject: appUser.externalSubject })).map(row => [row.externalSubject, row.id]));
  const userId = (user: number) => lookup(userIds, seedSubject(user));

  await db.insert(userMachine).values(userMachines.map(({ user, machine, nickname }) => ({
    userId: userId(user), machineModelId: lookup(modelIds, machine), nickname,
  })));

  const ratingRows = await db.insert(rating)
    .values(ratings.map(seedRating => ({
      userId: userId(seedRating.user),
      coffeeBeanId: lookup(coffeeIds, seedRating.coffee),
      machineModelId: seedRating.machine ? lookup(modelIds, seedRating.machine) : null,
      score: seedRating.score,
      perceivedBitterness: seedRating.perceived?.bitterness,
      perceivedRoastCharacter: seedRating.perceived?.roastCharacter,
      perceivedCrema: seedRating.perceived?.crema,
      perceivedStrength: seedRating.perceived?.strength,
      beanSurfaceCode: seedRating.surface,
      // The same rule the rating API follows: one input decides both the flag and the rows.
      hadMachineIssues: seedRating.issues === null ? null : seedRating.issues.length > 0,
      privateNote: seedRating.note,
    })))
    .returning({ id: rating.id, userId: rating.userId, coffeeBeanId: rating.coffeeBeanId });
  const ratingIds = new Map(ratingRows.map(row => [`${row.userId}:${row.coffeeBeanId}`, row.id]));

  await db.insert(ratingMachineIssue).values(ratings.flatMap(seedRating =>
    (seedRating.issues ?? []).map(code => ({
      ratingId: lookup(ratingIds, `${userId(seedRating.user)}:${lookup(coffeeIds, seedRating.coffee)}`),
      machineIssueCode: code,
    }))));

  // Renamed last, so everything above can refer to its original slug. The slug trigger
  // keeps 'tormikohv-tume' as a redirect, because the coffee was already published.
  await db.update(coffeeBean)
    .set({ name: 'Tume Torm', slug: 'tormikohv-tume-torm' })
    .where(eq(coffeeBean.slug, 'tormikohv-tume'));

  return { brands: brands.length, coffees: coffees.length, users: userCount, ratings: ratings.length };
};

const db = createDatabase(process.env.NUXT_DATABASE_URL ?? '');
try {
  const counts = await db.transaction(seed);
  console.log(`Seeded ${counts.brands} brands, ${counts.coffees} coffees, ${counts.users} users and ${counts.ratings} ratings.`);
} finally {
  await db.$client.end();
}

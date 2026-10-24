import { randomUUID } from 'node:crypto';
import { globSync } from 'node:fs';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { fileURLToPath } from 'node:url';
import { fetch, setup } from '@nuxt/test-utils/e2e';
import { eq } from 'drizzle-orm';
import { createEvent, sealSession } from 'h3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  appUser, brand, coffeeBean, machineManufacturer, machineModel, rating, ratingMachineIssue, userMachine,
} from '../db/schema/index.ts';
import { closeTestDb, committedDb, createCoffee, createMachineModel, createUser, required } from '../db/tests/helpers.ts';

// Public routes are cached for every visitor. Nitro renders a cached route without the
// visitor's cookie but with the request's context, which holds the signed-in user, so server
// code that reads that user would cache their private data for everyone (decisions log §7).
// The test therefore requests every route as the note's author first, and anonymously only
// once nothing is left to cache.

const rootDir = fileURLToPath(new URL('../..', import.meta.url));

// The test server gets its own session password, so CI needs no secret; the author's cookie
// is sealed with it. nuxt-session is nuxt-auth-utils' cookie name, which the session
// middleware reads too.
const sessionPassword = `test-only-session-password-${randomUUID()}`;
const sessionCookie = 'nuxt-session';

const noteCanary = `private-note-canary-${randomUUID()}`;
const nicknameCanary = `nick-${randomUUID().slice(0, 8)}`;
const coffeeSlug = 'kanaari-segu';
const brandSlug = 'kanaari';

// Every public page and GET endpoint, with the file that serves it; a test below fails when
// one is missing. The cache key is the whole URL, so the endpoints appear as the pages and
// the browser call them. They come first: a page renders by fetching them anonymously, which
// would otherwise cache a clean copy before the author's request.
const publicRoutes = [
  { source: 'server/api/ranking.get.ts', path: '/api/ranking' },
  { source: 'server/api/search.get.ts', path: '/api/search?q=kanaari' },
  { source: 'server/api/coffees/[slug].get.ts', path: `/api/coffees/${coffeeSlug}?locale=et` },
  { source: 'server/api/coffees/[slug].get.ts', path: `/api/coffees/${coffeeSlug}` },
  { source: 'server/api/brands/[slug].get.ts', path: `/api/brands/${brandSlug}` },
  { source: 'server/api/machines.get.ts', path: '/api/machines' },
  { source: 'app/pages/index.vue', path: '/' },
  { source: 'app/pages/index.vue', path: '/_payload.json' },
  { source: 'app/pages/otsing.vue', path: '/otsing?q=kanaari' },
  { source: 'app/pages/kohv/[slug]/index.vue', path: `/kohv/${coffeeSlug}` },
  { source: 'app/pages/kohv/[slug]/index.vue', path: `/kohv/${coffeeSlug}/_payload.json` },
  { source: 'app/pages/kohv/[slug]/hinda.vue', path: `/kohv/${coffeeSlug}/hinda` },
  { source: 'app/pages/brand/[slug].vue', path: `/brand/${brandSlug}` },
  { source: 'app/pages/konto.vue', path: '/konto' },
];

// The cookie a sign-in sets for the author, sealed the way nuxt-auth-utils seals it.
const signedInCookie = async (userId: number) => {
  const request = new IncomingMessage(new Socket());
  const event = createEvent(request, new ServerResponse(request));
  event.context.sessions = {
    [sessionCookie]: { id: randomUUID(), createdAt: Date.now(), data: { user: {}, secure: { userId } } },
  };
  const sealed = await sealSession(event, { name: sessionCookie, password: sessionPassword, maxAge: 60 * 60 });
  return `${sessionCookie}=${sealed}`;
};

type RouteResponse = { status: number; body: string };

const request = async (path: string, cookie?: string): Promise<RouteResponse> => {
  const response = await fetch(path, { headers: cookie ? { cookie } : {} });
  return { status: response.status, body: await response.text() };
};

// One request at a time and in this order: which request reaches the cache first is the point.
const requestEach = async (paths: readonly string[], cookie?: string): Promise<Map<string, RouteResponse>> => {
  const responses = new Map<string, RouteResponse>();
  for (const path of paths) {
    responses.set(path, await request(path, cookie));
  }
  return responses;
};

describe('public routes', async () => {
  let fixture: { brandId: number; coffeeId: number; userId: number; modelId: number; manufacturerId: number; cookie: string };
  let asAuthor: Map<string, RouteResponse>;
  let anonymous: Map<string, RouteResponse>;

  // Committed rather than rolled back: the server reads them over its own connection.
  beforeAll(async () => {
    const [brandRow] = await committedDb.insert(brand).values({ name: 'Kanaari', slug: brandSlug }).returning();
    const coffee = await createCoffee(committedDb, { slug: coffeeSlug, name: 'Segu', brandId: required(brandRow).id });
    const model = await createMachineModel(committedDb);
    const author = await createUser(committedDb);
    await committedDb.insert(userMachine).values({ userId: author.id, machineModelId: model.id, nickname: nicknameCanary });
    const [ratingRow] = await committedDb.insert(rating).values({
      userId: author.id,
      coffeeBeanId: coffee.id,
      machineModelId: model.id,
      score: 4,
      perceivedBitterness: 3,
      beanSurfaceCode: 'OILY',
      hadMachineIssues: true,
      privateNote: noteCanary,
    }).returning();
    await committedDb.insert(ratingMachineIssue).values({ ratingId: required(ratingRow).id, machineIssueCode: 'GRINDER_JAMMED' });
    fixture = {
      brandId: required(brandRow).id,
      coffeeId: coffee.id,
      userId: author.id,
      modelId: model.id,
      manufacturerId: model.manufacturerId,
      cookie: await signedInCookie(author.id),
    };
  });

  // Ratings first: rating.user_id has no cascade. The issue rows and the user's machine go
  // with their parents.
  afterAll(async () => {
    await committedDb.delete(rating).where(eq(rating.coffeeBeanId, fixture.coffeeId));
    await committedDb.delete(appUser).where(eq(appUser.id, fixture.userId));
    await committedDb.delete(coffeeBean).where(eq(coffeeBean.id, fixture.coffeeId));
    await committedDb.delete(brand).where(eq(brand.id, fixture.brandId));
    await committedDb.delete(machineModel).where(eq(machineModel.id, fixture.modelId));
    await committedDb.delete(machineManufacturer).where(eq(machineManufacturer.id, fixture.manufacturerId));
    await closeTestDb();
  });

  // A production build against the test database. vitest.config.ts loads .env, so without
  // the override the server would connect to the development database.
  await setup({
    rootDir,
    server: true,
    build: true,
    env: { NUXT_DATABASE_URL: process.env.TEST_DATABASE_URL, NUXT_SESSION_PASSWORD: sessionPassword },
  });

  // Registered after setup(), so it runs once the server is up.
  beforeAll(async () => {
    const paths = publicRoutes.map(route => route.path);
    asAuthor = await requestEach(paths, fixture.cookie);
    anonymous = await requestEach(paths);
  }, 60_000);

  it('Should_ListEveryPageAndPublicEndpoint_When_CheckingTheRouteTable', () => {
    // Arrange
    const sources = [
      ...globSync('app/pages/**/*.vue', { cwd: rootDir }),
      ...globSync('server/api/**/*.get.ts', { cwd: rootDir }).filter(file => !/^server[\\/]api[\\/](me|admin|auth)[\\/]/.test(file)),
    ].map(file => file.replaceAll('\\', '/'));

    // Act
    const listed = [...new Set(publicRoutes.map(route => route.source))];

    // Assert
    expect(listed.toSorted()).toEqual(sources.toSorted());
  });

  it('Should_CountTheFixtureRating_When_RequestingTheCoffee', () => {
    // Act
    const coffee = JSON.parse(anonymous.get(`/api/coffees/${coffeeSlug}?locale=et`)?.body ?? 'null');

    // Assert: the routes really see the rating whose note they must leave out.
    expect(coffee).toMatchObject({ kind: 'coffee', coffee: { ratingCount: 1 } });
  });

  it('Should_ShowTheAuthorTheirOwnPrivateData_When_SignedIn', async () => {
    // Act: /api/me/ is never cached, so the order doesn't matter here.
    const ownRating = await request(`/api/me/ratings/${coffeeSlug}`, fixture.cookie);
    const ownMachines = await request('/api/me/machines', fixture.cookie);

    // Assert: the cookie works, so the signed-in pass was really signed in.
    expect(ownRating.body).toContain(noteCanary);
    expect(ownMachines.body).toContain(nicknameCanary);
  });

  // A browser that revalidated a page or payload must not then reuse it without asking: after a
  // rating save the server is fresh at once, and the rater would see the old numbers.
  it.each([`/kohv/${coffeeSlug}`, `/kohv/${coffeeSlug}/_payload.json`, `/api/coffees/${coffeeSlug}?locale=et`])(
    'Should_TellTheBrowserToCheckAgain_When_Answering304For %s',
    async (path) => {
      // Arrange
      const first = await fetch(path);
      const etag = first.headers.get('etag') ?? '';

      // Act
      const revalidated = await fetch(path, { headers: { 'if-none-match': etag } });

      // Assert
      expect(first.headers.get('cache-control')).toBe('no-cache');
      expect(revalidated.status).toBe(304);
      expect(revalidated.headers.get('cache-control')).toBe('no-cache');
    },
  );

  it.each(publicRoutes)('Should_LeaveOutPrivateData_When_Requesting $path', ({ path }) => {
    // Act
    const responses = [asAuthor.get(path), anonymous.get(path)];

    // Assert
    for (const response of responses) {
      expect(response?.status, path).toBe(200);
      expect(response?.body).not.toContain(noteCanary);
      expect(response?.body).not.toContain(nicknameCanary);
    }
  });
});

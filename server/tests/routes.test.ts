import { randomUUID } from 'node:crypto';
import { globSync, mkdtempSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetch, setup } from '@nuxt/test-utils/e2e';
import { eq } from 'drizzle-orm';
import { createEvent, sealSession } from 'h3';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  appUser, brand, coffeeBean, machineManufacturer, machineModel, rating, ratingMachineIssue, userMachine,
} from '../db/schema/index.ts';
import { maxMachinesPerAccount } from '../../shared/utils/machine.ts';
import { closeTestDb, committedDb, createCoffee, createMachineModel, createUser, required } from '../db/tests/helpers.ts';
import { gifImage, sidewaysPhotoWithLocation } from './images.ts';

// The app built for production and run against the test database, requested over HTTP: what
// only a running server shows. One build serves both blocks below, since it takes a minute.
//
// Public routes are cached for every visitor. Nitro renders a cached route without the
// visitor's cookie but with the request's context, which holds the signed-in user, so server
// code that reads that user would cache their private data for everyone (decisions log §7).
// The public block therefore requests every route as the note's author first, and anonymously
// only once nothing is left to cache.
//
// Admin routes check the role on the server. The admin block shows every one of them refuses
// anyone else, and that an admin's coffee save reaches the cached public pages at once.
//
// The account block holds what a signed-in user's own endpoints answer over HTTP, where the
// feature tests stop at the function's result.

const rootDir = fileURLToPath(new URL('../..', import.meta.url));

// The test server gets its own session password, so CI needs no secret; the cookies are sealed
// with it. nuxt-session is nuxt-auth-utils' cookie name, which the session middleware reads too.
const sessionPassword = `test-only-session-password-${randomUUID()}`;
const sessionCookie = 'nuxt-session';

// The photos the admin block uploads land here instead of the repository's media/.
const mediaDir = mkdtempSync(join(tmpdir(), 'kohvioad-routes-media-'));

const noteCanary = `private-note-canary-${randomUUID()}`;
const nicknameCanary = `nick-${randomUUID().slice(0, 8)}`;
const coffeeSlug = 'kanaari-segu';
const brandSlug = 'kanaari';
const adminBrandSlug = 'admini-rost';
const adminCoffeeSlug = 'admini-rost-hommik';

// Every page and public GET endpoint, with the file that serves it; a test below fails when
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
  // Rendered in the browser only: the server sends the same empty shell to everyone.
  { source: 'app/pages/admin/kohvid/index.vue', path: '/admin/kohvid' },
  { source: 'app/pages/admin/kohvid/uus.vue', path: '/admin/kohvid/uus' },
  { source: 'app/pages/admin/kohvid/[id].vue', path: '/admin/kohvid/1' },
  { source: 'app/pages/admin/kohv/[slug].vue', path: `/admin/kohv/${coffeeSlug}` },
];

// Every admin endpoint, with the file that serves it; a test below fails when one is missing.
const adminRoutes = [
  { source: 'server/api/admin/brands/index.get.ts', method: 'GET', path: '/api/admin/brands' },
  { source: 'server/api/admin/brands/index.post.ts', method: 'POST', path: '/api/admin/brands' },
  { source: 'server/api/admin/coffees/index.get.ts', method: 'GET', path: '/api/admin/coffees' },
  { source: 'server/api/admin/coffees/index.post.ts', method: 'POST', path: '/api/admin/coffees' },
  { source: 'server/api/admin/coffees/[id].get.ts', method: 'GET', path: '/api/admin/coffees/1' },
  { source: 'server/api/admin/coffees/[id].put.ts', method: 'PUT', path: '/api/admin/coffees/1' },
  { source: 'server/api/admin/coffees/[id]/reviewed.post.ts', method: 'POST', path: '/api/admin/coffees/1/reviewed' },
  { source: 'server/api/admin/coffees/[id]/image.put.ts', method: 'PUT', path: '/api/admin/coffees/1/image' },
  { source: 'server/api/admin/coffees/[id]/image.delete.ts', method: 'DELETE', path: '/api/admin/coffees/1/image' },
];

// The cookie a sign-in sets, sealed the way nuxt-auth-utils seals it.
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

// A JSON request the way the admin pages send one.
const send = (method: string, path: string, cookie: string | undefined, body?: unknown) => fetch(path, {
  method,
  headers: { ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
  body: body === undefined ? undefined : JSON.stringify(body),
});

// As a browser sends a File: the bytes themselves. Copied into a plain Uint8Array, since fetch's
// body type doesn't take a Buffer that may sit on shared memory.
const uploadImage = (path: string, cookie: string, image: Buffer, contentType: string) =>
  fetch(path, { method: 'PUT', headers: { cookie, 'content-type': contentType }, body: new Uint8Array(image) });

const sources = (pattern: string, exclude?: RegExp) => globSync(pattern, { cwd: rootDir })
  .map(file => file.replaceAll('\\', '/'))
  .filter(file => !exclude?.test(file))
  .toSorted();

describe('routes', async () => {
  let fixture: {
    brandId: number; coffeeId: number; userId: number; adminId: number; fullUserId: number; modelId: number; manufacturerId: number;
    authorCookie: string; adminCookie: string; fullUserCookie: string;
  };

  // Committed rather than rolled back: the server reads them over its own connection.
  beforeAll(async () => {
    const [brandRow] = await committedDb.insert(brand).values({ name: 'Kanaari', slug: brandSlug }).returning();
    const coffee = await createCoffee(committedDb, { slug: coffeeSlug, name: 'Segu', brandId: required(brandRow).id });
    const model = await createMachineModel(committedDb);
    const author = await createUser(committedDb);
    const admin = await createUser(committedDb);
    await committedDb.update(appUser).set({ role: 'ADMIN' }).where(eq(appUser.id, admin.id));
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
    // An account that already has as many machines as one may save.
    const fullUser = await createUser(committedDb);
    await committedDb.insert(userMachine)
      .values(Array.from({ length: maxMachinesPerAccount }, () => ({ userId: fullUser.id, machineModelId: model.id })));
    fixture = {
      brandId: required(brandRow).id,
      coffeeId: coffee.id,
      userId: author.id,
      adminId: admin.id,
      fullUserId: fullUser.id,
      modelId: model.id,
      manufacturerId: model.manufacturerId,
      authorCookie: await signedInCookie(author.id),
      adminCookie: await signedInCookie(admin.id),
      fullUserCookie: await signedInCookie(fullUser.id),
    };
  });

  // Ratings first: rating.user_id has no cascade. The issue rows, the user's machine and a
  // coffee's packages go with their parents. The admin block's coffee and brand were committed
  // by the server.
  afterAll(async () => {
    await committedDb.delete(rating).where(eq(rating.coffeeBeanId, fixture.coffeeId));
    await committedDb.delete(appUser).where(eq(appUser.id, fixture.userId));
    await committedDb.delete(appUser).where(eq(appUser.id, fixture.adminId));
    await committedDb.delete(appUser).where(eq(appUser.id, fixture.fullUserId));
    await committedDb.delete(coffeeBean).where(eq(coffeeBean.id, fixture.coffeeId));
    await committedDb.delete(coffeeBean).where(eq(coffeeBean.slug, adminCoffeeSlug));
    await committedDb.delete(brand).where(eq(brand.id, fixture.brandId));
    await committedDb.delete(brand).where(eq(brand.slug, adminBrandSlug));
    await committedDb.delete(machineModel).where(eq(machineModel.id, fixture.modelId));
    await committedDb.delete(machineManufacturer).where(eq(machineManufacturer.id, fixture.manufacturerId));
    await closeTestDb();
    await rm(mediaDir, { recursive: true, force: true });
  });

  // A production build against the test database. vitest.config.ts loads .env, so without
  // the overrides the server would connect to the development database and write photos into
  // the repository.
  await setup({
    rootDir,
    server: true,
    build: true,
    env: { NUXT_DATABASE_URL: process.env.TEST_DATABASE_URL, NUXT_SESSION_PASSWORD: sessionPassword, NUXT_MEDIA_DIR: mediaDir },
  });

  describe('public routes', () => {
    let asAuthor: Map<string, RouteResponse>;
    let anonymous: Map<string, RouteResponse>;

    // Registered after setup(), so it runs once the server is up.
    beforeAll(async () => {
      const paths = publicRoutes.map(route => route.path);
      asAuthor = await requestEach(paths, fixture.authorCookie);
      anonymous = await requestEach(paths);
    }, 60_000);

    it('Should_ListEveryPageAndPublicEndpoint_When_CheckingTheRouteTable', () => {
      // Arrange
      const expected = [
        ...sources('app/pages/**/*.vue'),
        ...sources('server/api/**/*.get.ts', /^server\/api\/(me|admin|auth)\//),
      ].toSorted();

      // Act
      const listed = [...new Set(publicRoutes.map(route => route.source))];

      // Assert
      expect(listed.toSorted()).toEqual(expected);
    });

    it('Should_CountTheFixtureRating_When_RequestingTheCoffee', () => {
      // Act
      const coffee = JSON.parse(anonymous.get(`/api/coffees/${coffeeSlug}?locale=et`)?.body ?? 'null');

      // Assert: the routes really see the rating whose note they must leave out.
      expect(coffee).toMatchObject({ kind: 'coffee', coffee: { ratingCount: 1 } });
    });

    it('Should_ShowTheAuthorTheirOwnPrivateData_When_SignedIn', async () => {
      // Act: /api/me/ is never cached, so the order doesn't matter here.
      const ownRating = await request(`/api/me/ratings/${coffeeSlug}`, fixture.authorCookie);
      const ownMachines = await request('/api/me/machines', fixture.authorCookie);

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

  describe('admin routes', () => {
    it('Should_ListEveryAdminEndpoint_When_CheckingTheRouteTable', () => {
      // Act
      const listed = adminRoutes.map(route => route.source).toSorted();

      // Assert
      expect(listed).toEqual(sources('server/api/admin/**/*.ts'));
    });

    // Refused before validation too: a body that would fail it still gets 401 or 403, not 400.
    it.each(adminRoutes)('Should_RefuseAnyoneButAnAdmin_When_Requesting $method $path', async ({ method, path }) => {
      // Arrange
      const body = method === 'GET' || method === 'DELETE' ? undefined : {};

      // Act
      const anonymous = await send(method, path, undefined, body);
      const signedInUser = await send(method, path, fixture.authorCookie, body);

      // Assert
      expect(anonymous.status).toBe(401);
      expect(signedInUser.status).toBe(403);
    });

    it('Should_PublishTheCoffeeWithItsPhoto_When_AnAdminEntersIt', async () => {
      // Arrange
      const createdBrand = await send('POST', '/api/admin/brands', fixture.adminCookie, {
        name: 'Admini Röst', slug: adminBrandSlug, countryCode: 'EE',
      });
      const { id: brandId } = await createdBrand.json() as { id: number };

      // Act
      const createdCoffee = await send('POST', '/api/admin/coffees', fixture.adminCookie, {
        brandId,
        name: 'Hommik',
        slug: adminCoffeeSlug,
        status: 'PUBLISHED',
        roastLevel: 2,
        packages: [{ sizeG: 250, gtin: '2001234500081' }],
        species: [{ code: 'ARABICA', percentage: 100 }],
        origins: ['ET'],
        descriptions: { et: 'Hele röst.' },
      });
      const { id } = await createdCoffee.json() as { id: number };
      const uploaded = await uploadImage(`/api/admin/coffees/${id}/image`, fixture.adminCookie, await sidewaysPhotoWithLocation(), 'image/jpeg');
      const { imageUrl } = await uploaded.json() as { imageUrl: string };
      const publicPage = await (await fetch(`/api/coffees/${adminCoffeeSlug}?locale=et`)).json();

      // Assert
      expect([createdBrand.status, createdCoffee.status, uploaded.status]).toEqual([201, 201, 200]);
      expect(publicPage).toMatchObject({
        kind: 'coffee',
        coffee: { name: 'Hommik', brand: { name: 'Admini Röst' }, imageUrl, packages: [{ sizeG: 250, gtin: '02001234500081' }] },
      });
      // The file the server wrote: upright, and without the upload's EXIF and GPS.
      const stored = await sharp(await readFile(join(mediaDir, imageUrl.replace('/media/', '')))).metadata();
      expect([stored.format, stored.width, stored.height]).toEqual(['webp', 20, 40]);
      expect(stored.exif).toBeUndefined();
    });

    it('Should_ShowTheNewNameAtOnce_When_AnAdminRenamesACachedCoffee', async () => {
      // Arrange: requested twice, so it is in the swr cache.
      const path = `/api/coffees/${coffeeSlug}?locale=et`;
      await fetch(path);
      expect(await (await fetch(path)).json()).toMatchObject({ coffee: { name: 'Segu' } });
      const editor = await (await send('GET', `/api/admin/coffees/${fixture.coffeeId}`, fixture.adminCookie)).json() as Record<string, unknown>;

      // Act
      const saved = await send('PUT', `/api/admin/coffees/${fixture.coffeeId}`, fixture.adminCookie, {
        brandId: editor.brandId,
        name: 'Segu Uus',
        slug: coffeeSlug,
        status: editor.status,
        roastLevel: editor.roastLevel,
        packages: editor.packages,
        species: editor.species,
        origins: editor.origins,
        descriptions: editor.descriptions,
      });

      // Assert: without the save emptying the cache, swr would answer with the old name first.
      expect(saved.status).toBe(200);
      expect(await (await fetch(path)).json()).toMatchObject({ coffee: { name: 'Segu Uus' } });
    });

    it('Should_KeepAdminDataOutOfEveryCache_When_Answering', async () => {
      // Act
      const response = await send('GET', '/api/admin/coffees', fixture.adminCookie);

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    });

    it.each([
      ['an image over the size limit', () => Buffer.alloc(15 * 1024 * 1024 + 1), 'image/jpeg', 413],
      ['a GIF', gifImage, 'image/gif', 422],
    ] as const)('Should_RefuseTheUpload_When_ItIs %s', async (_case, makeImage, contentType, expected) => {
      // Act
      const response = await uploadImage(`/api/admin/coffees/${fixture.coffeeId}/image`, fixture.adminCookie, await makeImage(), contentType);

      // Assert
      expect(response.status).toBe(expected);
    });
  });

  describe('account routes', () => {
    // The limit itself is tested in addMyMachine.test.ts. This is its answer over HTTP, which
    // the add drawer reads: on a 409 it says why, where any other failure says "try again".
    it('Should_Answer409_When_AddingAMachineToAFullAccount', async () => {
      // Arrange: the same request from both accounts.
      const machine = { machineModelId: fixture.modelId, nickname: null };

      // Act: the author has one machine, so theirs shows the request itself is fine.
      const withRoom = await send('POST', '/api/me/machines', fixture.authorCookie, machine);
      const full = await send('POST', '/api/me/machines', fixture.fullUserCookie, machine);
      const kept = await (await send('GET', '/api/me/machines', fixture.fullUserCookie)).json() as unknown[];

      // Assert
      expect([withRoom.status, full.status]).toEqual([201, 409]);
      expect(kept).toHaveLength(maxMachinesPerAccount);
    });
  });
});

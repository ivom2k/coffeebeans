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
  appUser, brand, coffeeBean, feedback, machineManufacturer, machineModel, rating, ratingMachineIssue, userMachine,
} from '../db/schema/index.ts';
import type { BrandPageResponse } from '../../shared/types/brand.ts';
import { maxFeedbackLength } from '../../shared/utils/feedback.ts';
import { maxMachinesPerAccount } from '../../shared/utils/machine.ts';
import { closeTestDb, committedDb, createCoffee, createMachineModel, createUser, required } from '../db/tests/helpers.ts';
import { bodyLimitFor } from '../features/security/bodyLimits.ts';
import { buckets, limitRuleFor } from '../features/security/rateLimits.ts';
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
// feature tests stop at the function's result, and shows each of them refuses a visitor.
//
// The request guard block shows that every endpoint that writes refuses a request from another
// site and a body over its limit, and is counted by the rate limiter. The middleware that does
// it runs for every route, so what these tables guard against is an endpoint added later that
// nobody listed: a test fails until it has a row.

const rootDir = fileURLToPath(new URL('../..', import.meta.url));

// The test server gets its own session password, so CI needs no secret; the cookies are sealed
// with it. nuxt-session is nuxt-auth-utils' cookie name, which the session middleware reads too.
const sessionPassword = `test-only-session-password-${randomUUID()}`;
const sessionCookie = 'nuxt-session';
// The same for the key of the address hash stored with anonymous feedback.
const ipHmacKey = `test-only-ip-hmac-key-${randomUUID()}`;

// The photos the admin block uploads land here instead of the repository's media/.
const mediaDir = mkdtempSync(join(tmpdir(), 'kohvioad-routes-media-'));

const noteCanary = `private-note-canary-${randomUUID()}`;
const nicknameCanary = `nick-${randomUUID().slice(0, 8)}`;
const coffeeSlug = 'kanaari-segu';
const brandSlug = 'kanaari';
const adminBrandSlug = 'admini-rost';
const adminCoffeeSlug = 'admini-rost-hommik';
// A coffee that isn't public yet, under the same brand, so every list that shows the brand's
// coffees would show it too if it forgot to leave drafts out.
const draftCanary = `draft-canary-${randomUUID()}`;
const draftSlug = 'kanaari-mustand';
// A feedback message, which only the admin inbox may show.
const feedbackCanary = `feedback-canary-${randomUUID()}`;

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
  { source: 'app/pages/admin/tagasiside.vue', path: '/admin/tagasiside' },
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
  { source: 'server/api/admin/feedback/index.get.ts', method: 'GET', path: '/api/admin/feedback' },
  { source: 'server/api/admin/feedback/[id].patch.ts', method: 'PATCH', path: '/api/admin/feedback/1' },
  { source: 'server/api/admin/inbox-counts.get.ts', method: 'GET', path: '/api/admin/inbox-counts' },
];

// Every endpoint for the signed-in user's own rows, with the file that serves it; a test below
// fails when one is missing.
const meRoutes = [
  { source: 'server/api/me/machines/index.get.ts', method: 'GET', path: '/api/me/machines' },
  { source: 'server/api/me/machines/index.post.ts', method: 'POST', path: '/api/me/machines' },
  { source: 'server/api/me/machines/[id].patch.ts', method: 'PATCH', path: '/api/me/machines/1' },
  { source: 'server/api/me/machines/[id].delete.ts', method: 'DELETE', path: '/api/me/machines/1' },
  { source: 'server/api/me/ratings/[slug].get.ts', method: 'GET', path: `/api/me/ratings/${coffeeSlug}` },
  { source: 'server/api/me/ratings/[slug].put.ts', method: 'PUT', path: `/api/me/ratings/${coffeeSlug}` },
];

// Writes outside admin/ and me/. Sign-out is the library's route, which the session middleware
// answers itself.
const otherWriteRoutes = [
  { source: 'server/middleware/1.session.ts', method: 'DELETE', path: '/api/_auth/session' },
  { source: 'server/api/feedback.post.ts', method: 'POST', path: '/api/feedback' },
];

// Every request that can change something. Built from the tables above, so a row added there
// is guarded here; a test below fails when a file that writes is in none of them.
const writeRoutes = [...adminRoutes, ...meRoutes, ...otherWriteRoutes].filter(route => route.method !== 'GET');

// The three ways a browser says a request came from somewhere else (decisions log §7).
const foreignOrigins: { from: string; headers: Record<string, string> }[] = [
  { from: 'another site', headers: { 'sec-fetch-site': 'cross-site' } },
  { from: 'a subdomain', headers: { 'sec-fetch-site': 'same-site' } },
  { from: 'an older browser on another site', headers: { origin: 'https://evil.example' } },
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

type RouteResponse = { status: number; body: string; setCookie: string[] };

const request = async (path: string, cookie?: string): Promise<RouteResponse> => {
  const response = await fetch(path, { headers: cookie ? { cookie } : {} });
  return { status: response.status, body: await response.text(), setCookie: response.headers.getSetCookie() };
};

// The test server trusts X-Forwarded-For as production does behind Caddy, so a test that
// counts requests gets an address of its own and doesn't use up another test's limit.
const requestFrom = (address: string, path: string) => fetch(path, { headers: { 'x-forwarded-for': address } });

// The feedback widget's request, from an address of its own: every send counts against it.
const postFeedback = (address: string, body: unknown, cookie?: string) => fetch('/api/feedback', {
  method: 'POST',
  headers: { 'x-forwarded-for': address, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
});

const storedFeedback = (message: string) => committedDb
  .select({ pagePath: feedback.pagePath, userId: feedback.userId, ipHmac: feedback.ipHmac })
  .from(feedback)
  .where(eq(feedback.message, message));

// A body sent without a declared length, as chunks.
const chunkedBody = () => new ReadableStream<Uint8Array>({
  start(controller) {
    controller.enqueue(new TextEncoder().encode('{}'));
    controller.close();
  },
});

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
    await createCoffee(committedDb, { slug: draftSlug, name: draftCanary, brandId: required(brandRow).id, status: 'DRAFT' });
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
    // Sent from the coffee's page by its rater, before the public block requests anything.
    await committedDb.insert(feedback).values({ message: feedbackCanary, pagePath: `/kohv/${coffeeSlug}`, userId: author.id });
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
    // Every feedback row: the fixture's and whatever the server stored for the tests below.
    await committedDb.delete(feedback);
    await committedDb.delete(rating).where(eq(rating.coffeeBeanId, fixture.coffeeId));
    await committedDb.delete(appUser).where(eq(appUser.id, fixture.userId));
    await committedDb.delete(appUser).where(eq(appUser.id, fixture.adminId));
    await committedDb.delete(appUser).where(eq(appUser.id, fixture.fullUserId));
    await committedDb.delete(coffeeBean).where(eq(coffeeBean.id, fixture.coffeeId));
    await committedDb.delete(coffeeBean).where(eq(coffeeBean.slug, draftSlug));
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
  // the repository. NUXT_TRUST_PROXY as in deploy/compose.yaml: the address comes from
  // X-Forwarded-For, and a request without the header counts by its connection.
  await setup({
    rootDir,
    server: true,
    build: true,
    env: {
      NUXT_DATABASE_URL: process.env.TEST_DATABASE_URL,
      NUXT_SESSION_PASSWORD: sessionPassword,
      NUXT_IP_HMAC_KEY: ipHmacKey,
      NUXT_MEDIA_DIR: mediaDir,
      NUXT_TRUST_PROXY: 'true',
    },
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
        // A draft has no page yet, so its name appears nowhere a visitor can look.
        expect(response?.body).not.toContain(draftCanary);
        expect(response?.body).not.toContain(feedbackCanary);
      }
    });

    // Nitro stores a cached render's response headers and replays them, so a cookie set behind
    // a cached route would go to every visitor (CLAUDE.md § Access). No public route sets one
    // at all: a visitor who never signed in gets no cookie.
    it.each(publicRoutes)('Should_SetNoCookie_When_Requesting $path', ({ path }) => {
      // Act
      const cookies = [asAuthor.get(path)?.setCookie, anonymous.get(path)?.setCookie];

      // Assert
      expect(cookies).toEqual([[], []]);
    });

    it('Should_ShowTheBrandWithoutItsDraft_When_ADraftSharesTheBrand', () => {
      // Act
      const brandPage = JSON.parse(anonymous.get(`/api/brands/${brandSlug}`)?.body ?? 'null') as BrandPageResponse;

      // Assert: the routes above really list this brand's coffees, the draft's sibling.
      expect([...brandPage.ranked, ...brandPage.unrated, ...brandPage.archived]).toHaveLength(1);
    });

    it.each([`/api/coffees/${draftSlug}`, `/kohv/${draftSlug}`, `/kohv/${draftSlug}/hinda`])(
      'Should_Answer404_When_RequestingADraftAt %s',
      async (path) => {
        // Act: as its admin would too, since a public route never reads who is asking.
        const responses = [await request(path), await request(path, fixture.adminCookie)];

        // Assert
        for (const response of responses) {
          expect(response.status).toBe(404);
          expect(response.body).not.toContain(draftCanary);
        }
      },
    );
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

    // An upload over the size limit is refused for every route in the request guard block.
    it.each([
      ['a GIF', gifImage, 'image/gif'],
      ['a GIF sent as a JPEG', gifImage, 'image/jpeg'],
      ['a web page sent as a JPEG', async () => Buffer.from('<!doctype html><script>alert(1)</script>'), 'image/jpeg'],
    ] as const)('Should_RefuseTheUpload_When_ItIs %s', async (_case, makeImage, contentType) => {
      // Act: the header is the client's claim; the bytes decide.
      const response = await uploadImage(`/api/admin/coffees/${fixture.coffeeId}/image`, fixture.adminCookie, await makeImage(), contentType);

      // Assert
      expect(response.status).toBe(422);
    });
  });

  describe('account routes', () => {
    it('Should_ListEveryAccountEndpoint_When_CheckingTheRouteTable', () => {
      // Act
      const listed = meRoutes.map(route => route.source).toSorted();

      // Assert
      expect(listed).toEqual(sources('server/api/me/**/*.ts'));
    });

    // Before validation too: a body that would fail it still gets 401, not 400. A handler that
    // forgot requireUser() would answer here with someone's rows, or a 400.
    it.each(meRoutes)('Should_RefuseAVisitor_When_Requesting $method $path', async ({ method, path }) => {
      // Arrange
      const body = method === 'GET' || method === 'DELETE' ? undefined : {};

      // Act
      const anonymous = await send(method, path, undefined, body);

      // Assert
      expect(anonymous.status).toBe(401);
    });

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

  // The one write open to visitors. Each test sends from an address of its own, since every
  // request it makes, refused or not, counts against that address's five an hour.
  describe('feedback', () => {
    it('Should_StoreTheHashAndThePathnameOnly_When_AVisitorSends', async () => {
      // Arrange
      const message = `Visitor ${randomUUID()}`;

      // Act
      const response = await postFeedback('203.0.113.80', { message, pagePath: '/kohv/x?q=secret#frag', website: '' });

      // Assert: a visitor who never signed in still has no cookie afterwards.
      expect(response.status).toBe(201);
      expect(response.headers.getSetCookie()).toEqual([]);
      const [row] = await storedFeedback(message);
      expect(row).toMatchObject({ pagePath: '/kohv/x', userId: null });
      expect(row?.ipHmac).toMatch(/^[0-9a-f]{64}$/);
    });

    it.each(['https://evil.example', '//evil.example', '/.//evil.example'])(
      'Should_StoreNoPage_When_ThePathLeavesTheSite (%s)',
      async (pagePath) => {
        // Arrange
        const message = `Path ${randomUUID()}`;

        // Act
        const response = await postFeedback('203.0.113.81', { message, pagePath });

        // Assert
        expect(response.status).toBe(201);
        expect(await storedFeedback(message)).toMatchObject([{ pagePath: null }]);
      },
    );

    it('Should_StoreTheUserAndNoHash_When_ASignedInUserSends', async () => {
      // Arrange
      const message = `User ${randomUUID()}`;

      // Act
      const response = await postFeedback('203.0.113.82', { message, pagePath: '/' }, fixture.authorCookie);

      // Assert
      expect(response.status).toBe(201);
      expect(await storedFeedback(message)).toEqual([{ pagePath: '/', userId: fixture.userId, ipHmac: null }]);
    });

    it('Should_AnswerAsIfSentAndStoreNothing_When_TheHoneypotIsFilled', async () => {
      // Arrange
      const message = `Bot ${randomUUID()}`;

      // Act
      const response = await postFeedback('203.0.113.83', { message, pagePath: '/', website: 'https://spam.example' });

      // Assert
      expect(response.status).toBe(201);
      expect(await storedFeedback(message)).toEqual([]);
    });

    it.each([
      ['too long', 'x'.repeat(maxFeedbackLength + 1)],
      ['only whitespace', ' \n\t '],
      ['holding a NUL', 'Tere\u0000kohv'],
    ])('Should_Answer400_When_TheMessageIs %s', async (_, message) => {
      // Act
      const response = await postFeedback('203.0.113.84', { message, pagePath: '/' });

      // Assert
      expect(response.status).toBe(400);
    });

    it('Should_Answer429_When_OneAddressSendsASixthMessageWithinAnHour', async () => {
      // Arrange: what the client writes in front of Caddy's entry changes with every request.
      const from = (request: number) => `10.0.1.${request}, 203.0.113.85`;
      for (let request = 0; request < buckets.feedback.limit; request++) {
        expect((await postFeedback(from(request), { message: `Flood ${request}`, pagePath: '/' })).status).toBe(201);
      }

      // Act
      const refused = await postFeedback(from(buckets.feedback.limit), { message: 'Flood', pagePath: '/' });

      // Assert
      expect(refused.status).toBe(429);
      expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0);
    });

    it('Should_ShowTheMessageWithoutWhoSentIt_When_TheAdminReadsTheInbox', async () => {
      // Arrange: a visitor's message, whose stored hash must not reach the inbox.
      const message = `Inbox ${randomUUID()}`;
      await postFeedback('203.0.113.86', { message, pagePath: '/' });
      const [stored] = await storedFeedback(message);

      // Act
      const response = await send('GET', '/api/admin/feedback?status=NEW', fixture.adminCookie);
      const body = await response.text();

      // Assert
      expect(response.status).toBe(200);
      expect(body).toContain(message);
      expect(body).toContain(feedbackCanary);
      expect(body).not.toMatch(/ipHmac|ip_hmac|userId|user_id/);
      expect(body).not.toContain(required(stored?.ipHmac ?? undefined));
    });
  });

  // server/middleware/0.guard.ts, before the session is loaded and before any handler. Every
  // request here is a visitor's: refused by the guard it never reaches the 401 behind it, so
  // the status alone shows which check answered.
  describe('request guard', () => {
    it('Should_ListEveryEndpointThatWrites_When_CheckingTheRouteTable', () => {
      // Act
      const listed = writeRoutes.map(route => route.source).filter(source => source.startsWith('server/api/')).toSorted();

      // Assert
      expect(listed).toEqual(sources('server/api/**/*.{post,put,patch,delete}.ts'));
    });

    it('Should_NameTheMethodItsFileServes_When_ARouteIsListed', () => {
      // Act: a row with the wrong method would test a request the file never answers.
      const mislabelled = [...adminRoutes, ...meRoutes]
        .filter(route => !route.source.endsWith(`.${route.method.toLowerCase()}.ts`));

      // Assert
      expect(mislabelled).toEqual([]);
    });

    describe.each(foreignOrigins)('from $from', ({ headers }) => {
      it.each(writeRoutes)('Should_RefuseTheWrite_When_Requesting $method $path', async ({ method, path }) => {
        // Act
        const response = await fetch(path, { method, headers });

        // Assert
        expect(response.status).toBe(403);
        expect(response.statusText).toBe('Cross-site request refused');
      });
    });

    it('Should_LetTheWriteThrough_When_ItComesFromThisSite', async () => {
      // Act: the header a browser sends from the site's own pages.
      const response = await fetch('/api/me/machines', {
        method: 'POST',
        headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
        body: '{}',
      });

      // Assert: past the guard, and stopped by the sign-in check behind it.
      expect(response.status).toBe(401);
    });

    it('Should_LeaveReadsAlone_When_AnotherSiteLinksHere', async () => {
      // Act: following a link from elsewhere is how most visitors arrive.
      const response = await fetch(`/kohv/${coffeeSlug}`, { headers: { 'sec-fetch-site': 'cross-site' } });

      // Assert
      expect(response.status).toBe(200);
    });

    it.each(writeRoutes)('Should_Answer413_When_TheBodyIsOverTheLimitOf $method $path', async ({ method, path }) => {
      // Arrange: one byte more than the route allows, declared honestly.
      const limit = bodyLimitFor(method, path);
      const contentType = limit.kind === 'json' ? 'application/json' : 'image/jpeg';

      // Act
      const response = await fetch(path, { method, headers: { 'content-type': contentType }, body: new Uint8Array(limit.maxBytes + 1) });

      // Assert
      expect(response.status).toBe(413);
    });

    it.each(writeRoutes)('Should_Answer411_When_TheBodyHasNoDeclaredLengthFor $method $path', async ({ method, path }) => {
      // Act: `duplex` is what Node's fetch needs to send a stream; the DOM types don't know it.
      const response = await fetch(path, {
        method,
        headers: { 'content-type': 'application/json' },
        body: chunkedBody(),
        duplex: 'half',
      } as RequestInit);

      // Assert
      expect(response.status).toBe(411);
    });

    it.each(writeRoutes.filter(route => bodyLimitFor(route.method, route.path).kind === 'json'))(
      'Should_Answer415_When_JsonIsSentAsPlainTextTo $method $path',
      async ({ method, path }) => {
        // Act: the one content type a plain HTML form on another site can send JSON in.
        const response = await fetch(path, { method, headers: { 'content-type': 'text/plain' }, body: '{}' });

        // Assert
        expect(response.status).toBe(415);
      },
    );

    it.each(writeRoutes)('Should_HaveARateLimitRule_When_Requesting $method $path', ({ method, path }) => {
      // Act
      const rule = limitRuleFor(method, path);

      // Assert: a bucket of its own, or a stated reason to have none, never the fallback.
      expect(rule).toBeDefined();
      expect(rule).not.toEqual({ bucket: buckets.unlisted, by: 'user' });
    });
  });

  // server/middleware/3.rateLimit.ts. Each test asks from an address of its own.
  describe('rate limits', () => {
    const searchPath = '/api/search?q=kanaari';

    it('Should_Answer429_When_OneAddressSearchesPastTheLimit', async () => {
      // Arrange: Caddy appends the address it saw; what the client wrote in front of it changes
      // with every request and must not count as a new visitor.
      const from = (request: number) => `10.0.0.${request % 250}, 203.0.113.50`;
      for (let request = 0; request < buckets.search.limit; request++) {
        expect((await requestFrom(from(request), searchPath)).status).toBe(200);
      }

      // Act
      const refused = await requestFrom(from(buckets.search.limit), searchPath);
      const neighbour = await requestFrom('203.0.113.51', searchPath);

      // Assert
      expect(refused.status).toBe(429);
      expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0);
      expect(neighbour.status).toBe(200);
    }, 60_000);

    it('Should_CountAnIpv6SubscriberOnce_When_TheyChangeAddressWithinTheir64', async () => {
      // Arrange
      const from = (request: number) => `2001:db8:aa:bb::${(request + 1).toString(16)}`;
      for (let request = 0; request < buckets.search.limit; request++) {
        await requestFrom(from(request), searchPath);
      }

      // Act
      const refused = await requestFrom(from(buckets.search.limit), searchPath);
      const other64 = await requestFrom('2001:db8:aa:bc::1', searchPath);

      // Assert
      expect([refused.status, other64.status]).toEqual([429, 200]);
    }, 60_000);

    // The search page calls the endpoint inside the server while it renders, without the
    // visitor's address. Counted, those calls would all land in one bucket and the page would
    // show an error to everyone once sixty people had searched within a minute.
    it('Should_ShowEveryVisitorTheirResults_When_ManySearchWithinAMinute', async () => {
      // Act
      const pages = [];
      for (let visitor = 0; visitor < buckets.search.limit + 2; visitor++) {
        const response = await requestFrom(`198.51.100.${visitor}`, '/otsing?q=kanaari');
        pages.push({ status: response.status, found: (await response.text()).includes(`/kohv/${coffeeSlug}`) });
      }

      // Assert: the page answers 200 even when its search failed, so the result is the proof.
      expect(pages.filter(page => page.status !== 200 || !page.found)).toEqual([]);
    }, 60_000);

    it('Should_CountTheSearchPageToo_When_OneAddressKeepsReloadingIt', async () => {
      // Arrange
      for (let request = 0; request < buckets.search.limit; request++) {
        await requestFrom('203.0.113.60', '/otsing?q=kanaari');
      }

      // Act
      const refused = await requestFrom('203.0.113.60', '/otsing?q=kanaari');

      // Assert
      expect(refused.status).toBe(429);
    }, 60_000);
  });
});

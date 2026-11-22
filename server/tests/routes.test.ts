import { randomUUID } from 'node:crypto';
import { globSync, mkdtempSync } from 'node:fs';
import { readdir, readFile, rm } from 'node:fs/promises';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetch, setup } from '@nuxt/test-utils/e2e';
import { eq, inArray } from 'drizzle-orm';
import { createEvent, sealSession } from 'h3';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  appUser, brand, coffeeBean, feedback, machineManufacturer, machineModel, rating, ratingMachineIssue, suggestion, userMachine,
} from '../db/schema/index.ts';
import type { BrandPageResponse } from '../../shared/types/brand.ts';
import type { MySuggestion } from '../../shared/types/suggestion.ts';
import { maxFeedbackLength } from '../../shared/utils/feedback.ts';
import { maxMachinesPerAccount } from '../../shared/utils/machine.ts';
import { maxSuggestionPhotoBytes, suggestionLimits } from '../../shared/utils/suggestion.ts';
import { closeTestDb, committedDb, createCoffee, createMachineModel, createUser, required } from '../db/tests/helpers.ts';
import { bodyLimitFor, type BodyLimit } from '../features/security/bodyLimits.ts';
import { buckets, limitRuleFor } from '../features/security/rateLimits.ts';
import { gifImage, hugeClaimedPng, plainPhoto, sidewaysPhotoWithLocation, svgImage, tiffImage, truncatedPhoto } from './images.ts';

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

// The photos the admin block uploads land here instead of the repository's media/, and the
// suggestion photos in a folder of their own, as in production.
const mediaDir = mkdtempSync(join(tmpdir(), 'kohvioad-routes-media-'));
const privateMediaDir = mkdtempSync(join(tmpdir(), 'kohvioad-routes-private-'));

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
// A suggestion's text and the admin's note on another, which only their author may see.
const suggestionCanary = `suggestion-canary-${randomUUID()}`;
const reviewNoteCanary = `review-note-canary-${randomUUID()}`;

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
  // Not cached, and per-user only in the browser: the server renders the same heading for all.
  { source: 'app/pages/konto/index.vue', path: '/konto' },
  { source: 'app/pages/konto/ettepanekud.vue', path: '/konto/ettepanekud' },
  { source: 'app/pages/soovita.vue', path: '/soovita' },
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
  { source: 'server/api/me/suggestions/index.get.ts', method: 'GET', path: '/api/me/suggestions' },
  { source: 'server/api/me/suggestions/index.post.ts', method: 'POST', path: '/api/me/suggestions' },
  { source: 'server/api/me/suggestions/unread.get.ts', method: 'GET', path: '/api/me/suggestions/unread' },
  { source: 'server/api/me/suggestions/seen.post.ts', method: 'POST', path: '/api/me/suggestions/seen' },
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

// The content type each kind of route takes, for requests that should get past the type check.
const contentTypeFor = (limit: BodyLimit) =>
  ({ json: 'application/json', image: 'image/jpeg', multipart: 'multipart/form-data; boundary=x' })[limit.kind];

// The suggestion form as the browser sends it: `details` as JSON and the photo as a file. Fetch
// sets the multipart type and its boundary itself.
type FormPart = [name: string, value: string | Blob, fileName?: string];

const suggestionForm = (details: unknown, photo?: Buffer, extra: FormPart[] = []) => {
  const form = new FormData();
  form.append('details', JSON.stringify(details));
  if (photo) {
    form.append('photo', new Blob([new Uint8Array(photo)], { type: 'image/jpeg' }), 'hinnasilt.jpg');
  }
  for (const [name, value, fileName] of extra) {
    if (typeof value === 'string') {
      form.append(name, value);
    } else {
      form.append(name, value, fileName);
    }
  }
  return form;
};

const postSuggestion = (cookie: string | undefined, form: FormData) =>
  fetch('/api/me/suggestions', { method: 'POST', headers: cookie ? { cookie } : {}, body: form });

const coffeeDetails = (name: string | null, url: string | null = null) => ({ suggestionType: 'COFFEE_BEAN', name, url });

// The files the server wrote for suggestions, in either media folder; none before the first one.
// Any other error fails the test, so a folder it can't read never passes for an empty one.
const filesIn = async (dir: string) => {
  try {
    return await readdir(join(dir, 'suggestion'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const sources = (pattern: string, exclude?: RegExp) => globSync(pattern, { cwd: rootDir })
  .map(file => file.replaceAll('\\', '/'))
  .filter(file => !exclude?.test(file))
  .toSorted();

describe('routes', async () => {
  let fixture: {
    brandId: number; coffeeId: number; userId: number; adminId: number; fullUserId: number; modelId: number; manufacturerId: number;
    authorCookie: string; adminCookie: string; fullUserCookie: string;
    otherUserCookie: string; queueUserCookie: string; rejectedSuggestionId: number;
  };

  // Accounts a test makes for itself, so each sends from an account of its own: every suggestion,
  // refused or not, counts against its account's ten an hour. Removed in afterAll.
  const extraUserIds: number[] = [];
  const newSuggester = async () => {
    const user = await createUser(committedDb);
    extraUserIds.push(user.id);
    return { id: user.id, cookie: await signedInCookie(user.id) };
  };

  // Committed rather than rolled back: the server reads them over its own connection.
  beforeAll(async () => {
    const [brandRow] = await committedDb.insert(brand).values({ name: 'Kanaari', slug: brandSlug }).returning();
    const coffee = await createCoffee(committedDb, { slug: coffeeSlug, name: 'Segu', brandId: required(brandRow).id });
    const draft = await createCoffee(committedDb, { slug: draftSlug, name: draftCanary, brandId: required(brandRow).id, status: 'DRAFT' });
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
    // The author's suggestions: one waiting, one rejected with a note, and one approved into the
    // draft, which its author must see as still waiting. Reviewed a minute ago, as an earlier
    // request would have: marking as seen stamps a later time (suggestion_seen_chk).
    const reviewedAt = new Date(Date.now() - 60_000);
    const [, rejectedRow] = await committedDb.insert(suggestion).values([
      { suggestionType: 'COFFEE_BEAN', userId: author.id, details: { name: suggestionCanary, url: null } },
      {
        suggestionType: 'COFFEE_BEAN', userId: author.id, details: { name: 'Kapslid', url: null },
        status: 'REJECTED', reviewReason: 'NOT_WHOLE_BEANS', reviewNote: reviewNoteCanary, reviewedAt,
      },
      {
        suggestionType: 'COFFEE_BEAN', userId: author.id, details: { name: 'Mustandiks', url: null },
        status: 'APPROVED', resultingCoffeeBeanId: draft.id, reviewedAt,
      },
    ]).returning({ id: suggestion.id });
    // A second user with nothing of their own, and one whose account is full of waiting ones.
    const otherUser = await createUser(committedDb);
    const queueUser = await createUser(committedDb);
    extraUserIds.push(otherUser.id, queueUser.id);
    await committedDb.insert(suggestion).values(Array.from({ length: suggestionLimits.pendingPerAccount }, () => ({
      suggestionType: 'COFFEE_BEAN' as const, userId: queueUser.id, details: { name: 'Ootel', url: null },
    })));
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
      otherUserCookie: await signedInCookie(otherUser.id),
      queueUserCookie: await signedInCookie(queueUser.id),
      rejectedSuggestionId: required(rejectedRow).id,
    };
  });

  // Ratings first: rating.user_id has no cascade. The issue rows, the user's machine and a
  // coffee's packages go with their parents. The admin block's coffee and brand were committed
  // by the server.
  afterAll(async () => {
    // Every feedback row and suggestion: the fixture's and whatever the server stored for the
    // tests below. Suggestions first: one points at the draft, without a cascade.
    await committedDb.delete(feedback);
    await committedDb.delete(suggestion);
    await committedDb.delete(appUser).where(inArray(appUser.id, extraUserIds));
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
    await rm(privateMediaDir, { recursive: true, force: true });
  });

  // A production build against the test database. vitest.config.ts loads .env, so without
  // the overrides the server would connect to the development database and write photos into
  // the repository. NUXT_TRUST_PROXY as in deploy/compose.yaml: the address comes from
  // X-Forwarded-For, and a request without the header counts by its connection.
  await setup({
    rootDir,
    server: true,
    build: true,
    // The build and the server's start, which took four minutes on a throttled laptop against the
    // library's 240-second default for Windows. A build that hangs still fails, only later.
    setupTimeout: 10 * 60_000,
    // The test build lives in a temporary folder but would write the editor's server tsconfig
    // (.nuxt/tsconfig.server.json) pointing into it; once the folder is removed, the editor no
    // longer knows Nitro's auto-imports in any server file. The build itself never reads it.
    nuxtConfig: { nitro: { typescript: { generateTsConfig: false } } },
    env: {
      NUXT_DATABASE_URL: process.env.TEST_DATABASE_URL,
      NUXT_SESSION_PASSWORD: sessionPassword,
      NUXT_IP_HMAC_KEY: ipHmacKey,
      NUXT_MEDIA_DIR: mediaDir,
      NUXT_PRIVATE_MEDIA_DIR: privateMediaDir,
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
      const ownSuggestions = await request('/api/me/suggestions', fixture.authorCookie);

      // Assert: the cookie works, so the signed-in pass was really signed in.
      expect(ownRating.body).toContain(noteCanary);
      expect(ownMachines.body).toContain(nicknameCanary);
      expect(ownSuggestions.body).toContain(suggestionCanary);
      expect(ownSuggestions.body).toContain(reviewNoteCanary);
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
        expect(response?.body).not.toContain(suggestionCanary);
        expect(response?.body).not.toContain(reviewNoteCanary);
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
      // Arrange: a body of the kind the route takes, so the guard's type check lets it through.
      const body = method === 'GET' || method === 'DELETE' ? undefined : {};
      const isForm = bodyLimitFor(method, path).kind === 'multipart';

      // Act: a form route gets a form, at its own path and method.
      const anonymous = isForm
        ? await fetch(path, { method, body: suggestionForm(coffeeDetails('Crema')) })
        : await send(method, path, undefined, body);

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

  // The first upload, link and free text from users who aren't the admin (decisions log §6).
  describe('suggestions', () => {
    const storedPath = async (id: number) => (await committedDb
      .select({ imagePath: suggestion.imagePath }).from(suggestion).where(eq(suggestion.id, id)))[0]?.imagePath ?? null;
    const seenAt = async (id: number) => (await committedDb
      .select({ seenAt: suggestion.resultSeenAt }).from(suggestion).where(eq(suggestion.id, id)))[0]?.seenAt ?? null;
    const listOf = async (cookie: string) => (await send('GET', '/api/me/suggestions', cookie)).json() as Promise<MySuggestion[]>;
    const unreadOf = async (cookie: string) => (await send('GET', '/api/me/suggestions/unread', cookie)).json() as Promise<{ count: number }>;

    it('Should_StoreAnUprightWebpInThePrivateFolderOnly_When_ASuggestionCarriesAPhoto', async () => {
      // Arrange
      const { cookie } = await newSuggester();
      const publicFilesBefore = await filesIn(mediaDir);

      // Act
      const response = await postSuggestion(cookie, suggestionForm(coffeeDetails(null), await sidewaysPhotoWithLocation()));

      // Assert: no thumbnail and nothing in the folder Caddy serves.
      expect(response.status).toBe(201);
      const { id } = await response.json() as { id: number };
      const path = await storedPath(id);
      expect(path).toMatch(/^suggestion\/[0-9a-f]{32}\.webp$/);
      const stored = await sharp(await readFile(join(privateMediaDir, path ?? ''))).metadata();
      expect([stored.format, stored.width, stored.height]).toEqual(['webp', 20, 40]);
      expect(stored.exif).toBeUndefined();
      expect(await filesIn(mediaDir)).toEqual(publicFilesBefore);
    });

    it('Should_FitTheStoredPhotoInside1600Pixels_When_ALargePhotoArrives', async () => {
      // Arrange
      const { cookie } = await newSuggester();

      // Act
      const response = await postSuggestion(cookie, suggestionForm(coffeeDetails('Suur'), await plainPhoto(3200, 2000)));

      // Assert
      const { id } = await response.json() as { id: number };
      const stored = await sharp(await readFile(join(privateMediaDir, await storedPath(id) ?? ''))).metadata();
      expect([response.status, stored.width, stored.height]).toEqual([201, 1600, 1000]);
    });

    it.each([
      ['a GIF', gifImage],
      ['an SVG', svgImage],
      ['a TIFF', tiffImage],
      ['a web page sent as a JPEG', async () => Buffer.from('<!doctype html><script>alert(1)</script>')],
      ['a decompression bomb', async () => hugeClaimedPng()],
      ['17 megapixels', () => plainPhoto(4250, 4000)],
      ['a JPEG cut off halfway', truncatedPhoto],
    ])('Should_Answer422AndStoreNothing_When_ThePhotoIs %s', async (_case, makePhoto) => {
      // Arrange: the part claims image/jpeg whatever it holds; the bytes decide.
      const { id: userId, cookie } = await newSuggester();
      const filesBefore = await filesIn(privateMediaDir);

      // Act
      const response = await postSuggestion(cookie, suggestionForm(coffeeDetails('Crema'), await makePhoto()));

      // Assert
      expect(response.status).toBe(422);
      expect(await committedDb.$count(suggestion, eq(suggestion.userId, userId))).toBe(0);
      expect(await filesIn(privateMediaDir)).toEqual(filesBefore);
    });

    it('Should_Answer413_When_ThePhotoIsOverSixMegabytesInsideTheFormsLimit', async () => {
      // Arrange: within the route's cap, so it is the handler's own check that answers.
      const { cookie } = await newSuggester();
      const photo = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF]), Buffer.alloc(maxSuggestionPhotoBytes - 2)]);

      // Act
      const response = await postSuggestion(cookie, suggestionForm(coffeeDetails('Crema'), photo));

      // Assert
      expect(response.status).toBe(413);
    });

    it.each([
      ['an extra part', [['website', 'https://spam.example']]],
      ['a second photo', [['photo', new Blob([new Uint8Array(10)]), 'teine.jpg']]],
      ['the details twice', [['details', JSON.stringify(coffeeDetails('Teine'))]]],
    ] as [string, FormPart[]][])('Should_Answer400_When_TheFormHolds %s', async (_case, extra) => {
      // Arrange
      const { cookie } = await newSuggester();

      // Act
      const response = await postSuggestion(cookie, suggestionForm(coffeeDetails('Crema'), await plainPhoto(8, 8), extra));

      // Assert
      expect(response.status).toBe(400);
    });

    it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', '//evil.example', 'http://user:pass@pood.example'])(
      'Should_Answer400_When_TheLinkIs %s',
      async (url) => {
        // Arrange
        const { id: userId, cookie } = await newSuggester();

        // Act
        const response = await postSuggestion(cookie, suggestionForm(coffeeDetails('Crema', url)));

        // Assert
        expect(response.status).toBe(400);
        expect(await committedDb.$count(suggestion, eq(suggestion.userId, userId))).toBe(0);
      },
    );

    it('Should_Answer400_When_ACoffeeHasNoNameLinkOrPhoto', async () => {
      // Arrange
      const { cookie } = await newSuggester();

      // Act
      const response = await postSuggestion(cookie, suggestionForm(coffeeDetails('  ', '')));

      // Assert
      expect(response.status).toBe(400);
    });

    it('Should_Answer409_When_TheAccountAlreadyHasTenWaiting', async () => {
      // Act: refused before the photo is read.
      const response = await postSuggestion(fixture.queueUserCookie, suggestionForm(coffeeDetails('Üheteistkümnes'), await plainPhoto(8, 8)));

      // Assert
      expect(response.status).toBe(409);
    });

    it('Should_ShowTheDraftsSuggestionAsWaiting_When_TheAuthorReadsTheList', async () => {
      // Act
      const list = await listOf(fixture.authorCookie);
      const unread = await unreadOf(fixture.authorCookie);

      // Assert: the approved one shows no name and no slug, and only the rejection is new.
      expect(list.map(item => item.outcome.kind).toSorted()).toEqual(['rejected', 'waiting', 'waiting']);
      expect(JSON.stringify(list)).not.toMatch(new RegExp(`${draftCanary}|${draftSlug}`));
      expect(unread).toEqual({ count: 1 });
    });

    it('Should_ShowNoneOfAnothersAndMarkOnlyTheirOwn_When_AnotherUserReadsAndMarks', async () => {
      // Act: the other user sends the author's id.
      const theirList = await send('GET', '/api/me/suggestions', fixture.otherUserCookie);
      const theirSeen = await send('POST', '/api/me/suggestions/seen', fixture.otherUserCookie, { ids: [fixture.rejectedSuggestionId] });

      // Assert
      expect(theirList.status).toBe(200);
      const body = await theirList.text();
      expect(body).toBe('[]');
      expect(await theirSeen.json()).toEqual({ marked: 0 });
      expect(await seenAt(fixture.rejectedSuggestionId)).toBeNull();
    });

    // An author of its own, so the fixture's rejection stays unread for the tests above whatever
    // order they run in.
    it('Should_MarkTheOutcomeSeenOnlyByThePost_When_TheAuthorOpensTheList', async () => {
      // Arrange: reviewed a minute ago, as in the fixture (suggestion_seen_chk).
      const { id: userId, cookie } = await newSuggester();
      const [row] = await committedDb.insert(suggestion).values({
        suggestionType: 'COFFEE_BEAN', userId, details: { name: 'Kapslid', url: null },
        status: 'REJECTED', reviewReason: 'NOT_WHOLE_BEANS', reviewedAt: new Date(Date.now() - 60_000),
      }).returning({ id: suggestion.id });
      const rejectedId = required(row).id;

      // Act: reading the list twice changes nothing; the POST names what the page showed.
      const list = await listOf(cookie);
      await listOf(cookie);
      const beforePost = await seenAt(rejectedId);
      const marked = await send('POST', '/api/me/suggestions/seen', cookie, { ids: list.filter(item => item.unread).map(item => item.id) });

      // Assert
      expect(beforePost).toBeNull();
      expect(await marked.json()).toEqual({ marked: 1 });
      expect(await seenAt(rejectedId)).not.toBeNull();
      expect(await unreadOf(cookie)).toEqual({ count: 0 });
    });

    it('Should_Answer400_When_TheSeenPostNamesNoIds', async () => {
      // Act: the old body-less request, which marked everything.
      const response = await send('POST', '/api/me/suggestions/seen', fixture.otherUserCookie, {});

      // Assert
      expect(response.status).toBe(400);
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

      // Act
      const response = await fetch(path, {
        method,
        headers: { 'content-type': contentTypeFor(limit) },
        body: new Uint8Array(limit.maxBytes + 1),
      });

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

    it.each(writeRoutes.filter(route => bodyLimitFor(route.method, route.path).kind === 'multipart'))(
      'Should_Answer415_When_AFormRouteGetsJson $method $path',
      async ({ method, path }) => {
        // Act
        const response = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: '{}' });

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

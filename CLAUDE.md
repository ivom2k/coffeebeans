# kohvioad

Public site for rating roasted whole coffee beans sold in Estonia (kohvioad.eu), so shoppers can check a coffee before buying it. The core use is a phone in a store aisle: build mobile-first and keep pages fast.

This is a solo learning project. When you touch infrastructure (Dockerfile, Compose, Caddy, DNS, CI), explain what each part does and why, not only what to type.

## Stack

- Nuxt 4 with Vue `<script setup lang="ts">` and TypeScript, as one project: UI under `app/`, API as Nitro routes under `server/api/`. Public pages are server-rendered. Only server code touches the database.
- PostgreSQL 18 through Drizzle ORM 0.45 and the `pg` driver, with drizzle-kit migrations. Local Postgres runs in `docker-compose.yml`.
- Tests: Vitest.
- Google sign-in (OIDC) via `nuxt-auth-utils`, sessions in sealed cookies.
- UI components: Nuxt UI v4. It sets up Tailwind v4 itself, so don't add a separate Tailwind module.
- `@nuxtjs/i18n` and `@nuxtjs/seo`; sharp for image processing.
- Production: Docker Compose on one Pilvio VPS in Tallinn, behind Caddy. CI/CD: GitHub Actions builds the images, pushes them to GHCR and deploys; the server only pulls.
- Development happens on Windows and production on Linux, so `package.json` scripts must run on both (no `rm -rf`, no inline `VAR=value`).
- Zod for schema validation.
- Not decided yet, so ask before choosing or installing: what runs scheduled cleanup (a Nitro task or a cron container). Ask before adding any other dependency as well.

## Layout

One Nuxt project, with top-level folders split by where the code runs. Inside each folder, organise by feature (vertical slices), not by technical layer, and use the same feature name across folders.

- `app/` runs during SSR and in the browser: `pages/` is the router (folder path = URL), `layouts/` holds the page shells, plus `components/<feature>/`, `composables/use*.ts`, and `middleware/` for route guards (UX only, never access control).
- `shared/` holds plain TypeScript imported by both sides: DTOs in `shared/types/`, pure helpers (GTIN, score formatting) in `shared/utils/`. It imports from neither `app/` nor `server/`.
- `server/` never reaches the browser: `api/` (endpoints), `features/<feature>/<useCase>.ts` (queries and commands), `db/schema/` (Drizzle tables, views via `.existing()`), `db/migrations/` (generated and custom SQL), `middleware/` (session and admin checks), `plugins/` (Nitro hooks, such as the browser cache header on cached routes), `utils/` (cross-cutting helpers such as `useDb()` and `requireUser()`).
- `Dockerfile` (root) builds the production images: `app`, and `migrate` for migrations and the seed. `deploy/` holds what runs on the server: `compose.yaml`, `caddy/Caddyfile`, `deploy.sh` and the runbook `README.md`.
- Relative imports under `server/db/` end in `.ts` and use no path aliases: the seed script runs on Node's built-in TypeScript support, which resolves neither extensionless imports nor aliases. `server/features/` follows the same rule and uses no Nuxt auto-imports, because plain Vitest, without Nuxt, runs the feature tests that sit next to them.
- UI text lives in `i18n/locales/`.
- Handlers stay thin: validate, check auth, call one feature function, map the result to a status code. Feature functions are plain async functions that take `db` (or a transaction) as their first argument. No classes, repositories or service layers.
- Import feature modules explicitly; only `server/utils/` is auto-imported. Public handlers import only feature code that reads the summary views; the signed-in user's own rows go through `server/api/me/`.
- `useFetch` serialises its result into the page source, so anything a public endpoint returns must be fit for every visitor. Per-user UI goes inside `<ClientOnly>`, and fetches `/api/me/` data with `server: false`.
- App code never imports from `server/`; it calls `$fetch` or `useFetch`. Nuxt blocks only some of these imports.

## Commands

- `npm run dev`: dev server at http://localhost:3000.
- `npm run check`: lint (any warning fails; Tailwind classes included) and type check, the same as CI runs on every push to `main`. Run it before handing back a change.
- `npm run lint:fix`: fixes lint findings and formatting. ESLint Stylistic is the formatter; there is no Prettier.
- `npm run build`: production build.
- `npm test`: Vitest. Drops and recreates the `_test` database in `TEST_DATABASE_URL`, migrates it, then runs the tests, each in a rolled-back transaction. One test, `server/tests/publicRoutes.test.ts`, builds the app (about a minute) and runs it against that database to check that no public route returns private data and that cached routes tell browsers to check back; it commits its own rows and removes them.
- `npm run db:generate`: a migration from changes in `server/db/schema/`. Add `-- --custom --name=<name>` for an empty file for hand-written SQL. Review the generated SQL before migrating.
- `npm run db:migrate`: applies pending migrations to `NUXT_DATABASE_URL`.
- `npm run db:seed`: the fictional seed, into a freshly migrated database only.

The database commands and `npm test` need the Compose Postgres running (`docker compose up -d`, which Ivo runs). Keep this section in step with `package.json`.

Deploys: a push to `main` deploys once the `check`, `test` and `image` jobs pass. Server operations are in `deploy/README.md`; Ivo runs them.

## Git

Solo project: commits go straight to `main`, with no feature branches or pull requests.

## Rules

### Access, privacy and security

- Reading needs no account. Rating and suggestions require sign-in. Feedback needs none and is guarded by a honeypot, an in-app rate limit and a length cap.
- Public routes get rating data only from the views `coffee_bean_rating_summary` and `coffee_bean_machine_issue_summary`, never from `rating` itself: `rating.private_note` is visible only to its author.
- Public pages are cached with Nitro `swr` route rules, so their server output must be identical for every visitor. Anything per-user (the visitor's own rating, watchlist state, the signed-in header) renders in the browser. Code behind a cached route (its page, and every handler the page or the browser calls there) never reads the session user: Nitro renders it with the request's context, user included, and caches the result for everyone. A write that changes public output calls `clearPublicPageCache()` after its transaction commits.
- Admin endpoints live under `server/api/admin/` and check the role on the server. Hidden UI is not access control.
- The database stores no email and no name. Sign-in requests only the `openid` scope.
- A server middleware loads the user for every request with a session and clears the session if the account no longer exists or is anonymised.
- No cookie before sign-in. Handlers read the user from `requireUser()` or `event.context.user`, never `getUserSession()`, which starts a session and sets a cookie when there is none.
- Never hard-delete a user: account deletion calls `anonymise_user()`. `rating.user_id` has no cascade on purpose.
- Every uploaded image is re-encoded with sharp, auto-rotated first, which strips EXIF and GPS. Suggestion photos get random names, live outside the directory Caddy serves, are shown only through an authenticated admin route, and are deleted at review.
- IP addresses are stored only as an HMAC-SHA256 with a server secret, and only for anonymous feedback.
- Postgres is never public: Compose publishes it as `127.0.0.1:5432:5432` or not at all, because Docker's iptables rules bypass ufw.
- The repository is public. No secrets, real catalogue data or photos go into git; secrets live in GitHub Secrets and on the server, and git holds only a small fictional seed.

### Database

- Conventions: `bigint GENERATED ALWAYS AS IDENTITY` keys; `timestamptz` everywhere (`withTimezone: true` in Drizzle); `created_at` and `updated_at` on mutable tables, with `updated_at` set by trigger; statuses and kinds as `varchar` plus CHECK, never `pgEnum`; vocabularies keyed by an UPPER_SNAKE `code`; junction tables with a composite primary key.
- Drizzle doesn't index foreign keys. Add an index wherever a lookup or a cascade uses one; FKs into vocabularies stay unindexed.
- Extensions, triggers, views and functions live in a hand-written custom migration (`drizzle-kit generate --custom`). Declare the views in the Drizzle schema with `.existing()`, so they are typed but never generated.
- Change the schema only through generated migrations: never `drizzle-kit push`, which skips the custom SQL, and never edit a migration that has already run.
- Never read-then-write counts or averages in app code. Read the views; if they ever need denormalising, use an atomic `UPDATE` or a trigger.

### Ratings and catalogue

- The ranked list sorts by `shrunk_mean` and lists unrated coffees separately. Coffee pages and their structured data show `raw_mean` with its count, e.g. "4,3 (2 hinnangut)".
- Perception sliders are optional, NULL meaning not answered: a five-segment single-select toggle group with nothing selected and a visible clear control. Never `<input type="range">`, which always submits a value.
- The rating API takes `machineIssues: IssueCode[] | null` (null = skipped, `[]` = no issues). The server writes `had_machine_issues` and the `rating_machine_issue` rows in one transaction.
- GTINs are stored as 14 digits, left-padded with zeros, with the check digit verified in the app. An all-digit search query is a GTIN lookup.

### Languages and SEO

- Estonian is the default locale at `/`; Russian comes later under `/ru/` (`prefix_except_default`). UI text comes from locale files, never hard-coded in templates.
- Vocabulary codes stored in the database are the i18n keys; never store display labels. Coffee and brand names are never translated. Country names come from `Intl.DisplayNames`.
- Coffee pages are `noindex` and left out of the sitemap until their first rating.
- Until launch the whole site is non-indexable, through `NUXT_SITE_INDEXABLE=false` in the server's `.env` (`deploy/compose.yaml` requires the variable). That is the only switch: don't also set `site.indexable` in `nuxt.config.ts`.
- Public URLs never break: an old slug of a published coffee answers with a 301 to the current URL (`coffee_bean_slug_redirect`, maintained by a trigger).

### Code

- TypeScript in strict mode, no `any`.
- Functional style: pure functions, immutable data, composition over classes. Keep side effects at the edges (server handlers, composables, event handlers).
- Vue: Composition API only; type-based `defineProps`, `defineEmits` and `defineModel`; `shallowRef` for primitives; props down, events up; composables return readonly state plus explicit actions.
- Never use `v-html` on user-supplied text (feedback, suggestions, notes).
- Colours, the font and radii are theme tokens in `app/assets/css/main.css` and `app/app.config.ts`. Components use Nuxt UI's semantic classes (`text-muted`, `bg-default`, `border-default`, `text-primary`), never hex values. Light mode only for the MVP (`ui.colorMode: false`).
- Validate every request body, query and route parameter at the API boundary with a schema. `suggestion.details` is a discriminated union on `suggestion_type`.
- Accessible widgets (dropdowns, dialogs, the segment control) come from Nuxt UI. Where it has no matching component (it has no toggle group, which the sliders need), use the Reka UI primitive it is built on. Never hand-roll them.
- Use Nuxt UI v4 component names: `UFormField`, `UDropdownMenu` and `USwitch`, not the v2 names `UFormGroup`, `UDropdown` and `UToggle`.
- Existing comments may be edited
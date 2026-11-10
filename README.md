# NGTZ · Never Go To Zero

A full-stack habit tracker built around a small promise: do the minimum on a hard day instead of doing nothing.

Each habit has a full version and a minimum version. Log **green** for the full action, **yellow** for the minimum, or **red** for zero. Green and yellow both count toward a streak.

## What it does

- Google and GitHub sign-in with database-backed sessions.
- Create, edit, reorder through the API, and archive personal habits.
- Record or clear daily statuses, including past dates in a monthly calendar.
- Show optimistic status updates with rollback when a save fails.
- Display daily totals, completion counts, weekly summaries, and streaks.
- View linked providers, unlink a provider while retaining a login method, or delete an account.

The main engineering concerns are authenticated ownership, repeatable writes, and preserving historical data. The repository includes executable authorization regression tests and CI; see [verification](#verification) for the test boundary and [current limits](#current-limits) for remaining work.

## Stack

| Layer | Implementation |
| --- | --- |
| Web | Next.js 16 App Router, React 19, TypeScript |
| Data | PostgreSQL on Neon, Drizzle ORM |
| Authentication | NextAuth.js, Google and GitHub OAuth |
| UI | Tailwind CSS, Recharts |
| Tests | Vitest, PGlite (PostgreSQL running locally in WebAssembly) |
| CI | GitHub Actions: production audit, type checking, tests, build, HTTP smoke |

## Run locally

Use Node.js 22.12+ and npm. You need a development Neon database and OAuth app credentials for interactive sign-in. Automated tests need neither.

```bash
git clone https://github.com/thisumitk/ngtz-app.git
cd ngtz-app
npm ci
cp .env.example .env
```

Fill in the values in `.env`:

- `DATABASE_URL`: your development Neon PostgreSQL connection string.
- `NEXTAUTH_URL`: `http://localhost:3000` locally; your HTTPS origin when deployed.
- `NEXTAUTH_SECRET`: generate a unique secret with `openssl rand -base64 32`.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: a Google OAuth web application.
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`: a GitHub OAuth application.

Configure each provider's redirect URI:

```text
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/auth/callback/github
```

Use separate development and production OAuth apps where callback restrictions require it. Never commit `.env` or reuse the CI placeholder secret in a deployment.

Apply the schema only to your development database, then start the app:

```bash
npm run db:push
npm run dev
```

Open http://localhost:3000. `db:push` changes the target database schema; review its proposed changes before accepting them. For deployment, configure the same environment variables and HTTPS callback URLs on your host, provision the schema separately, then run `npm run build` and `npm start`. Vercel can run the Next.js build automatically.

## Architecture

```text
Browser
  ├─ Dashboard / calendar → useHabits + useLogs
  ├─ Analytics → useAnalytics
  └─ Settings → account API
          │
          ▼
Next.js route handlers
  ├─ Resolve database-backed NextAuth session
  ├─ Scope queries to the authenticated user
  └─ Drizzle ORM → Neon PostgreSQL
```

- `src/app/api/`: authentication, habits, daily logs, analytics, and account handlers.
- `src/lib/db/schema.ts`: NextAuth tables plus `habits` and `daily_logs`.
- `src/lib/session.ts`: server-side session lookup. The page proxy checks for a cookie to redirect pages; it is not the authorization boundary.
- `src/hooks/`: client data loading and optimistic status updates.
- `src/components/`: habit cards, forms, calendar, navigation, and status buttons.
- `tests/`: route integration tests and local-date tests.

### Data and authorization decisions

**One log per user, habit, and calendar date.** A unique index on `(user_id, habit_id, date)` and `ON CONFLICT DO UPDATE` make repeated status writes idempotent. A null or omitted status clears the owned log; repeating a clear is harmless.

**Ownership is checked before mutation.** `PUT /api/logs` looks up the habit using both its ID and the authenticated user's ID before inserting, updating, or clearing a log. Foreign and missing habit IDs return the same `404`. The body cannot choose the log's user ID. Log reads and deletion predicates are also user-scoped.

**Archiving preserves history.** Deleting a habit sets `archived_at`; the dashboard lists active habits. Existing historical logs remain, and owners can still edit logs for their archived habits through the API. Account deletion is different: database cascades delete the user's related records.

**Analytics run on the server.** PostgreSQL computes grouped counts and weekly totals. TypeScript computes current and longest streaks from logs loaded for the last 365 days. These are not lifetime streaks, and streak calculation is not SQL-based.

**Calendar dates are distinct from timestamps.** Logs use PostgreSQL `date`; UI helpers format browser-local dates. The server uses its own local timezone for default analytics ranges. A missing past day breaks a streak, as does red; an unlogged current day allows the streak to start yesterday.

### API overview

All application API routes require a valid session. OAuth endpoints are managed by NextAuth.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/habits` | Active habits for the current user |
| `POST /api/habits` | Create a habit |
| `PATCH /api/habits/:id` | Update an owned habit |
| `DELETE /api/habits/:id` | Archive an owned habit |
| `GET /api/logs?from=YYYY-MM-DD&to=YYYY-MM-DD` | Current user's logs, with optional inclusive bounds |
| `PUT /api/logs` | Upsert or clear an owned habit's daily log |
| `GET /api/analytics?range=week\|month\|quarter\|year` | Counts, daily totals, streaks, and weekly summary |
| `GET /api/account` | Account information and linked providers |
| `DELETE /api/account` | Delete account after confirmation |
| `DELETE /api/account/providers/:provider` | Unlink a provider, retaining at least one login method |

A status write looks like:

```json
{ "habitId": "<owned-habit-uuid>", "date": "2026-03-01", "status": "yellow", "note": "One page" }
```

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run test:smoke
# or all four, in order:
npm run check
```

The dev and build commands explicitly use Webpack. The build needs a syntactically valid `DATABASE_URL` even when it does not query a live database. For a build-only check, use the placeholders in `.github/workflows/ci.yml`; these are not interactive-development credentials.

The log tests call the real Next.js `GET` and `PUT` handlers and execute real Drizzle SQL against isolated in-memory PostgreSQL. Only the authenticated identity and database connection are substituted. Test DDL is generated from the application schema. No test connects to `DATABASE_URL` or modifies a deployed database.

Coverage includes:

- Anonymous access and read isolation between two users.
- Foreign and nonexistent habit IDs, mixed-case UUIDs, all three statuses, and clear requests.
- Rejection of updates to pre-existing cross-owner rows.
- Owned create/update/retry/clear flows, optional notes, and ignoring a caller-supplied user ID.
- Archived-habit history, required fields, status validation, and inclusive date filters.
- Local date formatting, leap days, and year boundaries.
- Async route parameters, adapter methods, database-session renewal/expiry, and the production Neon driver with intercepted HTTP.
- React 19 chart server rendering and 13 local production HTTP smoke checks.

These tests verify route/database boundaries and a mocked Neon HTTP protocol, not a real OAuth exchange, browser interaction, live Neon transport, or production traffic. There is no dedicated lint configuration or browser end-to-end suite yet.

## Current limits

- Existing inconsistent log rows are not repaired by the ownership check. Before deploying to an existing database, audit rows where a log's `user_id` differs from its habit's owner and decide how to handle them. Do not delete records blindly.
- Analytics load a 365-day lookback for streaks and may use a different timezone from the browser. The dashboard requests a fixed recent window, so navigating earlier calendar months does not fetch older history.
- Input validation is partial. Comprehensive request schemas, malformed JSON handling, date validation, and pagination/range limits remain work to do.
- Rapid overlapping optimistic updates are not covered by browser concurrency tests.
- Both OAuth providers currently enable automatic linking by matching email. Review provider email-verification guarantees and the desired linking policy before using this for sensitive accounts.
- Generated migration files are currently ignored. The existing `db:generate` / `db:migrate` commands need a reviewed, versioned migration workflow before production schema changes.
- No load-test results, uptime guarantee, or live deployment verification is claimed here. The [dependency review](docs/dependency-security.md) records the current production audit, remaining development-tool findings, and upgrade validation limits.

## The principle

Version **1.0** is the full action. Version **0.1** is the smallest useful action. Yellow is a win: consistency should survive an imperfect day.

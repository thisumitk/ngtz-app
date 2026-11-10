# Dependency security review · 2026-11-10

Scope: the eight package entries reported by `npm audit --omit=dev` on commit `ed66f3041df367dff229f8d8784a8200ea814463`. This is a dependency review, not a full security audit or a test against a deployed service. No repository `SECURITY.md` policy was present; the assessment uses the shipped code and documented deployment model.

## Baseline applicability

Audit severities describe upstream advisories, not demonstrated exploitation of this application. Package entries can contain multiple advisories or repeat a transitive dependency's severity.

| Package | Static verdict | Repository evidence and limits |
| --- | --- | --- |
| `@auth/core` | Not actionable through the inspected runtime path | The Drizzle adapter's JavaScript imports Drizzle, not Auth.js core. Its core references are types. The app's authentication handler uses `next-auth` v4. No direct Auth.js core handler is configured. |
| `@auth/drizzle-adapter` | Not actionable for the inherited core advisories | The audit entry inherits the core findings above. Adapter SQL/user/session methods are used; the vulnerable core authentication handlers are not invoked through those methods. Upgrade still removes the affected dependency. |
| `drizzle-orm` | Not actionable through current identifier construction | `src/lib/db/schema.ts` defines identifiers in source. API inputs are bound values in ORM expressions. No user-selected SQL identifier or `sql.raw` path was found. This does not excuse passing user-controlled identifiers to future queries. |
| `lodash` | Not actionable through inspected calls | Used transitively by Recharts. No `template` use is present in the application. Recharts' `omit` calls use fixed keys such as `children` and `width`, not attacker-controlled path arrays. |
| `next` | Needs review, priority 1 | The App Router and request-handling framework are reachable. The app has no custom server, rewrites, Pages Router/i18n, Server Actions, CSP nonces, or `beforeInteractive` scripts. Image remote patterns exist even though the UI uses ordinary image tags, so optimizer exposure cannot be dismissed just from component usage. Hosting/runtime mitigations and image-input control were not established. No RCE or DoS was attempted. |
| `next-auth` | Needs review, priority 2 | Two OAuth providers and database sessions are configured in `src/lib/auth.ts`. No email provider or `getToken` caller is present, excluding those specific paths. OAuth provider-binding cookies are relevant: Google uses PKCE, while GitHub can rely on state. Attacker visibility into an authorization request and the complete account-linking exploit preconditions were not established. |
| `postcss` | Not actionable as a remote application path | CSS comes from repository source and trusted build dependencies. No user-submitted CSS/source-map processing API exists. Build tools still need updates, especially if future workflows process untrusted CSS. |
| `uuid` | Not actionable through inspected calls | NextAuth uses `v4()` without a caller-supplied buffer for JWT IDs; session IDs use Node crypto. The reported buffer-boundary issue affects other UUID functions. No such call site is present. |

“Not actionable” is limited to the listed paths, not a declaration that the package version is safe in all configurations. The two review items remain unproven vulnerabilities in this application. They were upgraded rather than waiting for a live exploit demonstration.

Relevant upstream details:

- [OAuth provider-binding advisory](https://github.com/advisories/GHSA-x445-f3h2-j279): additional conditions are required beyond having multiple providers.
- [Next.js AVIF optimizer advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) and [SVG optimizer advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw): optimizer/native-library and runtime conditions matter.
- [Drizzle identifier escaping advisory](https://github.com/advisories/GHSA-gpj5-g38j-94v9).
- [Next.js 16 migration guide](https://nextjs.org/docs/app/guides/upgrading/version-16).

## Upgrade choice

| Component | Baseline | Selected |
| --- | --- | --- |
| Next.js | 14.2.35 | 16.4.6 |
| React / ReactDOM | 18.3.1 | 19.2.9 |
| NextAuth | 4.24.13 | 4.24.15 |
| Auth Drizzle adapter | 1.11.1 | 1.11.3 |
| Drizzle ORM | 0.33.0 | 0.45.4 |
| Neon serverless driver | 0.9.5 | 1.2.0 |
| Drizzle Kit | 0.24.2 | 0.31.11 |

Next 15.5.29 also patches the listed framework advisories, but still pins the old PostCSS 8.4.31 dependency. Next 16.4.6 provides patched framework dependencies without a PostCSS override. Webpack remains explicit in dev/build scripts to avoid adding a bundler migration. NextAuth stays on v4, preserving database sessions and the current provider configuration.

Required application changes are limited to awaiting dynamic route parameters, adopting the `proxy` filename/export, and framework-generated TypeScript configuration. React and ReactDOM stay aligned, and a scoped Recharts `react-is` override matches their version. No database schema migration is required by this patch.

Compatible transitive patches update Lodash, browser-mapping data, Browserslist, Picomatch, and the CSS selector parser. The lockfile records exact dependency versions.

## Validation and residual risk

The production audit reports **zero findings** at the review date. Re-run `npm run audit:production`; advisory databases change.

The full development-inclusive audit still reports **four moderate entries**, all for the same esbuild development-server advisory propagated through Drizzle Kit → `@esbuild-kit/esm-loader` → `@esbuild-kit/core-utils` → esbuild. The affected behavior is a separately started esbuild serving endpoint; this repository's commands do not start one. Do not expose development tooling to untrusted networks. The audit's suggested Drizzle Kit downgrade is not applied because it would discard the compatible current toolchain. This is a recorded residual dependency issue, not a zero-findings claim for development dependencies.

Verification covers:

- Existing log ownership and lifecycle regression tests.
- Dynamic route parameters, owner isolation, and last-provider protection.
- Actual adapter user/account/session/token methods against schema-derived PostgreSQL.
- Valid, expired, unknown, and renewed sessions through NextAuth and the application's session callback.
- Production Drizzle/Neon connection code with intercepted HTTP transport, bound parameters, timestamp mapping, and error propagation.
- Recharts server rendering with React 19 and fragment children.
- Production build and local HTTP smoke of redirects, protected endpoints, provider metadata, session lookup without a cookie, and CSRF setup.

The transport test does not contact Neon. Session tests use the API-style NextAuth entry point and a test database; HTTP smoke covers the real Next request APIs without a valid session. Full OAuth login, authenticated browser flows, live Neon networking, responsive chart hydration/tooltips/animation, and deployment behavior remain release checks. A clean package audit is not a substitute for those checks.

# @object-ui/console

## 11.2.0

## 11.1.0

## 7.3.0

### Minor Changes

- 02da91f: feat(console): resolve the post-login landing from app metadata, not a hardcode

  The root route (`/`) previously redirected via a hardcoded
  `PREFERRED_APPS = ['cloud_control']` in `CloudAwareRootRedirect` — baking one
  product's policy (cloud) into the shared Console, with no supported way for a
  deployment to opt out of the `/home` launcher or land somewhere custom without
  forking the SPA.

  `CloudAwareRootRedirect` is replaced by `RootLandingRedirect`, which resolves the
  landing purely from app metadata (`resolveLandingPath`, unit-tested):

  1. the app marked `isDefault: true` → `/apps/<it>` (its own `homePageId` then
     selects the landing page within it);
  2. else the single visible app (`active !== false && hidden !== true`) → that app;
  3. else `/home` — the multi-app workspace launcher (legacy default).

  This gives `isDefault` **routing semantics** (it was a display-only badge) — a
  back-compat-relevant contract change. Back-compat: a deployment with no
  `isDefault` app and ≥2 visible apps still lands on `/home`, exactly as before;
  cloud is unaffected (`cloud_control` is already `isDefault: true`) and the
  cloud-specific hardcode is removed. The landing is now a build-time product
  decision a developer declares in metadata, not a runtime Settings-UI preference.

## 7.2.0

## 7.1.0

### Patch Changes

- b1766d3: fix(console): object-detail page uses the valid `record` PageType

  `buildObjectDetailPageSchema` emitted `pageType: 'record_detail'`, which was
  dropped from `PageType` (`record | home | app | utility`) in framework#2265 /
  objectui#1949 — a `tsc` error (TS2322) that broke the console build (Bundle
  Analysis). An object detail page is a `record` page; use that.

## 7.0.0

### Minor Changes

- 893e530: Package documentation portal + nav entry (ADR-0046).

  The `/docs/:name` viewer already existed but had no way in: no index and no
  navigation entry, so a doc was reachable only by typing its exact URL. Adds a
  platform-level docs portal at `/docs` (`DocsIndex`) that lists every installed
  `doc` metadata item grouped by package namespace, each linking to the existing
  viewer. A "Documentation" entry now appears in the home/system navigation
  (`UnifiedSidebar`), visible to all users (not gated behind workspace-admin), so
  docs are discoverable. The viewer route stays app-independent and
  single-coordinate (`/docs/<name>`); per-app deep-links remain opt-in `url` nav
  items pointing at that same global URL. Doc grouping is a pure, unit-tested
  helper (`groupDocsByPackage`).

- 78d1a56: ADR-0046 P2: `/docs/:name` package-documentation route.

  One authenticated route renders any installed `doc` metadata item (flat Markdown docs compiled from a package's `src/docs/*.md`): fetches the item via the standard metadata API (`meta.getItem('doc', name)`), renders the sanitized body through `@object-ui/plugin-markdown`, and rewrites relative cross-references `[x](./other_doc.md#anchor)` → `/docs/other_doc#anchor` (fenced/inline code untouched, SPA navigation on click). Unknown names degrade to a "Documentation not found" notice per the ADR — never a hard failure.

- 89e113c: ADR-0044 send-back-for-revision in the approvals inbox (framework #1744/#1769). Approvers get a "Send back" action (violet, with its own dialog) that ends the round as `returned` and unlocks the record; the submitter sees a revision panel on the returned request — edit-record link, optional comment, Resubmit (opens round N+1) and Recall (abandons the revision). New `returned` status badge/filter, Round-N chips (list + drawer), timeline rendering for `revise`/`resubmit` actions, `approvalsApi.sendBack/resubmit`, and ten-locale `approvalsInbox` strings.
- c09f44e: Docs: mermaid diagrams + long-doc table of contents (ADR-0046).

  - **plugin-markdown** renders ```mermaid fenced blocks as diagrams (`<Mermaid>`: lazy-loaded mermaid, `securityLevel: 'strict'`, rendered post-`rehype-sanitize`by a trusted component, degrades to the raw source on error). Mermaid is text → SVG, so it stays within the v1 image/binary ban. Adds`extractToc(markdown)`— a TOC builder whose slugs are generated with the same`github-slugger` `rehype-slug`uses, so`#id` links resolve to the rendered heading anchors.
  - **console** `DocPage` shows a sticky right-rail table of contents (h2–h3) for docs with ≥3 headings, plus an app-independent `/apps/:packageId/docs` index already added earlier.
  - **i18n** adds `help.onThisPage` (en/zh; other locales fall back).

- 3fa23a7: feat(header): context-aware Help & Documentation menu + app-scoped docs index

  The top-right "?" was a bare external link to `docs.objectstack.ai`, duplicating
  the left sidebar's in-product `/docs` entry and ignoring the ADR-0046 docs hub.
  It is now an aggregated, context-aware menu:

  - **This app's docs** — shown only when the current app's package owns docs
    (matched by `_packageId`). A single-doc app deep-links straight to the
    viewer; a multi-doc app lands on the new app-scoped index.
  - **All documentation** — the in-product `/docs` portal.
  - **Online documentation** — `docs.objectstack.ai` (opens in a new tab).

  Docs are lazily fetched once on first menu open (names/labels only), so the menu
  adds no cost until used; a failed fetch soft-degrades to the static entries.

  Also adds the app-scoped docs index route **`/apps/:packageId/docs`**
  (`AppDocsIndex`) — the package-scoped sibling of `/docs`, listing just that
  app's docs — which the "This app's docs" entry targets when an app ships more
  than one. New `help.*` strings added to the `en` and `zh` bundles (other
  locales fall back to `en`).

- 4eb9cb6: feat(plugin-tree): add a `tree` / tree-grid object view type

  Renders a self-referencing object as an indented, expand/collapse tree-grid —
  the right view for arbitrary-depth hierarchies (business unit / org chart,
  category trees, BOMs, nested comments) that fixed-depth grouping can't express.
  New `@object-ui/plugin-tree` package (`object-tree`/`tree`), `tree` added to the
  `ViewType` union, and dispatch wired through plugin-list `ListView` +
  app-shell `ObjectView` (the console path).

### Patch Changes

- 8d37b31: fix(ADR-0046): enable Tailwind typography so Markdown docs render styled.

  `plugin-markdown`'s `MarkdownImpl` renders inside `prose prose-h1:text-3xl …`,
  but the console never registered `@tailwindcss/typography`, so every `prose`
  utility was a no-op — Markdown rendered with no heading sizes, list markers, or
  spacing (the `/docs/<name>` page showed its `# Title` at body size, looking
  unstyled). Register the plugin (`@plugin '@tailwindcss/typography'`) and add the
  dependency. Now doc headings, paragraphs, inline code, and links render with
  proper hierarchy.

- d82a580: fix(ADR-0046): docs portal shows summaries, not machine ids.

  The portal listed each doc as title + its raw machine name (`showcase_index`)
  — noise for the business readers docs are written for. Drop the machine id from
  the reader-facing list and render the doc's `description` (ADR-0046) as a
  one-line summary under the title instead. Falls back cleanly when a doc has no
  description.

- e164c92: feat(ADR-0046): lightweight chrome for the docs routes.

  The `/docs` portal and `/docs/:name` viewer are app-independent top-level
  routes, so they rendered as bare full-bleed pages with no header and no way
  back. Add a minimal sticky `DocShell` header — a "Documentation" home link
  (→ `/docs`) plus a breadcrumb of the current doc — shared by the portal and the
  viewer. Keeps ADR-0046's "no nav taxonomy in v1" intent (no app sidebar) while
  giving readers orientation and a way out. The portal's redundant in-body title
  is dropped in favour of the header.

- b8a5d41: ADR-0048: finish sweeping app-entry links onto the canonical package-id route
  segment (follow-up to the home-page fix).

  - `AppManagementPage` (System → Apps) "Open app" button now opens
    `/apps/<packageId>` (`app._packageId ?? app.name`) instead of `/apps/<name>`.
  - `AppContent` current-app sub-routes/redirects (the `metadata/package` →
    `component/developer/packages` redirect, and the record-form `baseUrl`) now
    build against the URL's own `appName` segment instead of `activeApp.name`, so a
    `/apps/<packageId>/…` URL keeps its package-id segment instead of flipping to
    the name form. `requestedAppMissing` (preview-drafts) now resolves the segment
    via `matchAppBySegment` so a package-id URL isn't treated as a missing app.

- 56571d6: ADR-0048: DocPage resolves docs package-scoped. The doc viewer at
  `/apps/:appName/docs/:name` now passes the route's package segment as
  `getItem('doc', name, { packageId })`, so the single-doc fetch is package-scoped
  (prefer-local) on the server. Two installed packages may ship a doc with the
  same bare name and each resolves within its own package — doc names no longer
  need a globally-unique namespace prefix (the prefix becomes a convention, like
  `page`/`dashboard`/`report`). The legacy top-level `/docs/:name` path (no
  `appName`) keeps its context-free behavior.
- 77cc6bb: Cloud Connection bind v2 UX (cloud ADR runtime-identity-binding §2.3): the binding flow becomes one click. `CloudConnectionPanel` drops the environment-id input entirely (registration happens cloud-side at approval), auto-opens the approval page in a popup on Connect (user-code display stays as the popup-blocked fallback), and shows the registered runtime name + runtime id once bound. `DeviceAuthPage` displays the requesting device's context (`runtime_name` / `runtime_version` from the verification URL) plus an "only approve if you started this" warning — the informed-consent surface for the RFC 8628 flow. Two new `auth.device.*` keys across all locales.
- 82bcc87: DeviceAuthPage claims the device code (GET /device?user_code=…) before approve/deny — better-auth's device-authorization plugin rejects both with 400 "not been claimed by a verifying session" otherwise, so approval silently failed.
- c97513f: DeviceAuthPage preserves the full query string (runtime_name / runtime_version device context) through the login redirect — previously only user_code survived, so a signed-out approver never saw what device they were authorizing.

## 6.2.3

## 6.2.2

## 6.2.1

## 6.2.0

## 6.1.0

## 6.0.4

## 6.0.3

## 6.0.2

### Patch Changes

- d0e63f1: Migrate AI chat history from localStorage to the server-backed
  `ai_conversations` / `ai_messages` REST API. The studio `AiChatPanel`,
  the console `ConsoleFloatingChatbot`, and any other consumer of the new
  `useChatConversation` hook (in `@object-ui/app-shell`) now resolve a
  durable conversation id per signed-in user, hydrate prior messages on
  mount, and rotate the conversation on reset. The previous
  `objectstack:ai-chat-messages` localStorage entries are no longer read
  or written.

## 6.0.1

## 6.0.0

## 5.4.2

## 5.4.1

## 5.4.0

## 5.3.2

## 5.3.1

### Patch Changes

- 9c95649: Make the published Console SPA path-portable. Build with relative Vite
  base (`./`) and derive the React Router basename from `document.baseURI`
  at runtime, so the same `dist/` works at any mount path (`/_console/`,
  `/console/`, `/foo/bar/`). Hosts should inject `<base href="/path/">`
  into the served HTML — the framework CLI does this automatically.
- c351c96: Fix self-host blank page: clear `VITE_SERVER_URL` in `.env.production`
  so the published SPA defaults to same-origin instead of baking in
  `https://demo.objectstack.ai`. CORS-blocked auth/i18n/discovery calls
  were preventing the SPA from rendering when embedded in any host other
  than the demo deployment. Demo-only deployments now inject
  `VITE_SERVER_URL` at deploy time.
  - @object-ui/types@5.3.1
  - @object-ui/core@5.3.1
  - @object-ui/i18n@5.3.1
  - @object-ui/react@5.3.1
  - @object-ui/components@5.3.1
  - @object-ui/fields@5.3.1
  - @object-ui/layout@5.3.1
  - @object-ui/data-objectstack@5.3.1
  - @object-ui/auth@5.3.1
  - @object-ui/permissions@5.3.1
  - @object-ui/mobile@5.3.1
  - @object-ui/plugin-calendar@5.3.1
  - @object-ui/plugin-charts@5.3.1
  - @object-ui/plugin-chatbot@5.3.1
  - @object-ui/plugin-dashboard@5.3.1
  - @object-ui/plugin-designer@5.3.1
  - @object-ui/plugin-detail@5.3.1
  - @object-ui/plugin-form@5.3.1
  - @object-ui/plugin-gantt@5.3.1
  - @object-ui/plugin-grid@5.3.1
  - @object-ui/plugin-kanban@5.3.1
  - @object-ui/plugin-list@5.3.1
  - @object-ui/plugin-map@5.3.1
  - @object-ui/plugin-markdown@5.3.1
  - @object-ui/plugin-report@5.3.1
  - @object-ui/plugin-timeline@5.3.1
  - @object-ui/plugin-view@5.3.1
  - @object-ui/collaboration@5.3.1
  - @object-ui/app-shell@5.3.1
  - @object-ui/providers@5.3.1

## 5.3.0

### Minor Changes

- efb4c00: feat(observability): Sentry integration + bundle splitting for production launch

  **Sentry (opt-in via `VITE_SENTRY_DSN`)**
  - New `initSentry()` / `captureError()` / `setSentryUser()` / `getSentry()`
    helpers exported from `@object-ui/app-shell`.
  - Dynamic-import design: when `VITE_SENTRY_DSN` is unset, `@sentry/react`
    is **never fetched** — zero bundle cost for self-hosted users.
  - `ErrorBoundary.componentDidCatch` now best-effort reports to Sentry.
  - Console app calls `initSentry()` before React mount; never blocks first
    paint.
  - Configurable via:
    - `VITE_SENTRY_DSN` — required to enable
    - `VITE_SENTRY_ENVIRONMENT` — defaults to `MODE`
    - `VITE_SENTRY_RELEASE` — defaults to `VITE_APP_VERSION`
    - `VITE_SENTRY_TRACES_SAMPLE_RATE` — defaults to `0.1`
    - `VITE_SENTRY_REPLAY=true` — opt-in to 10% on-error replay
  - Sensitive URL params (`token`, `access_token`, `apiKey`, etc.) are
    stripped from breadcrumb URLs before send.

  **Bundle splitting**
  - `plugin-dashboard` (8 component types) now lazy-registered via
    `ComponentRegistry.registerLazy()` — only loads on dashboard pages.
  - `plugin-dashboard` and `plugin-report` each get their own chunk
    (previously merged into `plugins-views`).
  - Net first-paint JS reduction: **~200 KB** when the user never visits a
    dashboard or report page.
  - New chunks: `plugin-dashboard` (119 K), `plugin-report` (92 K),
    `vendor-sentry` (346 K raw / 97 K brotli, lazy).
  - `plugins-views` shrinks 387 K → 180 K (now `plugin-list` + `plugin-detail` only).

## 5.2.1

## 5.2.0

## 5.1.1

## 5.1.0

### Patch Changes

- 32306e8: chore: bump `@objectstack/client` and `@objectstack/cli` to `^4.2.0`

  Brings in the published Optimistic Concurrency Control surface
  (`If-Match` header on `data.update`/`data.delete`, `409
CONCURRENT_UPDATE` response shape with `currentVersion` /
  `currentRecord`) so the inline-edit save path can actually push the
  `ifMatch` token through.

## 5.0.2

## 5.0.1

## 5.0.0

## 4.8.0

## 4.7.0

## 4.6.0

## 4.5.0

## 4.4.0

## 4.3.1

## 4.3.0

## 4.2.1

## 4.2.0

## 4.1.0

## 4.0.12

## 4.0.11

### Patch Changes

- 1909bc3: Add `transformSpecTranslations` / `isSpecTranslationData` helpers to
  `@object-ui/i18n` so apps no longer need to maintain their own copy of the
  `@objectstack/spec` `TranslationData` → flat namespace transform.

  The new transform preserves **every** `_`-prefixed object scope by
  convention (`_views`, `_actions`, `_sections`, `_notifications`, `_errors`,
  `_options`, plus anything added in future spec versions), which fixes a
  class of silent-failure regressions where new spec scopes were dropped
  during transformation — leaving e.g. list-view labels to fall back to the
  untranslated source string.

  `@object-ui/console`'s `loadLanguage.ts` is rewritten to delegate to the
  shared helper.

## 4.0.10

## 4.0.9

### Patch Changes

- 19c044f: i18n

## 4.0.8

## 4.0.7

### Patch Changes

- 7c9b85c: Fix compatibility with the framework's normalized Expression envelope format.

  `@objectstack/spec` now emits predicate (`visible` / `enabled`) and template
  (`titleFormat`) fields as `{ dialect, source }` envelopes instead of bare
  strings. The previous implementation assumed strings and crashed the record
  detail view (`TypeError: titleFormat.replace is not a function`) and printed
  `Failed to evaluate expression: ${[object Object]}` for every action visibility
  predicate.
  - `@object-ui/core`: `ExpressionEvaluator.evaluate` / `evaluateCondition` now
    unwrap Expression envelopes transparently.
  - `@object-ui/react`: new `toPredicateInput()` helper to safely normalize
    `boolean | string | Expression` predicate inputs into the `${expr}` form
    expected by `useCondition`.
  - `@object-ui/components`: `action-bar`, `action-button`, `action-group`,
    `action-icon`, `action-menu` renderers use `toPredicateInput()` instead of
    template-literal interpolation that produced `${[object Object]}`.
  - `@object-ui/plugin-detail`, `@object-ui/plugin-kanban`,
    `@object-ui/plugin-calendar`, `@object-ui/app-shell`,
    `@object-ui/console`: title-format helpers accept both legacy strings and
    the new `{ source }` envelope.

  All changes are backward-compatible — legacy bare strings continue to work.

## 4.0.6

## 4.0.5

## 4.0.4

## 4.0.3

## 4.0.1

### Patch Changes

- f3bc42e: fix console

## 4.0.0

## 3.4.0

## 3.3.2

### Patch Changes

- 89a7b21: fix i18n

## 3.3.1

### Patch Changes

- db7a418: fix(console): respect Vite `BASE_URL` when redirecting after a workspace
  switch. The post-switch redirect previously hardcoded `/console/home`,
  which broke deployments served from a different base path (e.g. Vercel,
  where the console is mounted at `/`). It now derives the target from
  `import.meta.env.BASE_URL`, so it works both behind `HonoServerPlugin`
  (`/console/home`) and on standalone deployments (`/home`).

## 3.3.0

## 3.2.0

### Minor Changes

- 91a9103: upgrade objectstack ai service

## 3.1.5

## 3.1.4

### Patch Changes

- 7129017: fix

## 3.1.3

## 3.1.2

## 3.1.1

## 3.0.3

### Patch Changes

- e1267d2: fix: re-attach listViews to object metadata stripped by defineStack() Zod parse

## 3.0.2

### Patch Changes

- f1c2fc1: fix build

## 3.0.1

## 3.0.0

### Major Changes

- Upgrade to @objectstack v3.0.0 and console bundle optimization
  - Upgraded all @objectstack/\* packages from ^2.0.7 to ^3.0.0
  - Breaking change migrations: Hub → Cloud namespace, definePlugin removed, PaginatedResult.value → .records, PaginatedResult.count → .total, client.meta.getObject() → client.meta.getItem()
  - Console bundle optimization: split monolithic 3.7 MB chunk into 17 granular cacheable chunks (95% main entry reduction)
  - Added gzip + brotli pre-compression via vite-plugin-compression2
  - Lazy MSW loading for build:server (~150 KB gzip saved)
  - Added bundle analysis with rollup-plugin-visualizer

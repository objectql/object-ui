# @object-ui/app-shell — Changelog

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0
  - @object-ui/auth@5.4.0
  - @object-ui/collaboration@5.4.0
  - @object-ui/components@5.4.0
  - @object-ui/core@5.4.0
  - @object-ui/data-objectstack@5.4.0
  - @object-ui/fields@5.4.0
  - @object-ui/layout@5.4.0
  - @object-ui/permissions@5.4.0
  - @object-ui/providers@5.4.0
  - @object-ui/react@5.4.0
  - @object-ui/i18n@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2
- @object-ui/core@5.3.2
- @object-ui/i18n@5.3.2
- @object-ui/react@5.3.2
- @object-ui/components@5.3.2
- @object-ui/fields@5.3.2
- @object-ui/layout@5.3.2
- @object-ui/data-objectstack@5.3.2
- @object-ui/auth@5.3.2
- @object-ui/permissions@5.3.2
- @object-ui/collaboration@5.3.2
- @object-ui/providers@5.3.2

## 5.3.1

### Patch Changes

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
- @object-ui/collaboration@5.3.1
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

### Patch Changes

- @object-ui/types@5.3.0
- @object-ui/core@5.3.0
- @object-ui/i18n@5.3.0
- @object-ui/react@5.3.0
- @object-ui/components@5.3.0
- @object-ui/fields@5.3.0
- @object-ui/layout@5.3.0
- @object-ui/data-objectstack@5.3.0
- @object-ui/auth@5.3.0
- @object-ui/permissions@5.3.0
- @object-ui/collaboration@5.3.0
- @object-ui/providers@5.3.0

## 5.2.1

### Patch Changes

- 9ccda28: security: force DOMPurify to `^3.4.5` via pnpm override

  Resolves 8 moderate-severity GHSA advisories against the transitive
  `dompurify@3.2.7` pulled in by `monaco-editor`. Vulnerabilities covered:
  - SAFE_FOR_TEMPLATES bypass in RETURN_DOM mode
  - FORBID_TAGS bypassed by function-based ADD_TAGS predicate
  - Prototype Pollution to XSS via CUSTOM_ELEMENT_HANDLING fallback
  - ADD_TAGS function-form short-circuit bypass of FORBID_TAGS
  - ADD_ATTR predicate skipping URI validation
  - USE_PROFILES prototype pollution enabling event handlers
  - mutation-XSS via Re-Contextualization
  - Generic XSS vector

  No API changes; override is transparent to consumers.
  - @object-ui/types@5.2.1
  - @object-ui/core@5.2.1
  - @object-ui/i18n@5.2.1
  - @object-ui/react@5.2.1
  - @object-ui/components@5.2.1
  - @object-ui/fields@5.2.1
  - @object-ui/layout@5.2.1
  - @object-ui/data-objectstack@5.2.1
  - @object-ui/auth@5.2.1
  - @object-ui/permissions@5.2.1
  - @object-ui/collaboration@5.2.1
  - @object-ui/providers@5.2.1

## 5.2.0

### Minor Changes

- 321294c: Cmd-K now shows recently viewed records in its empty state, sourced
  from the existing cloud-synced `sys_user_preference` adapter (already
  wired by `RecentItemsProvider` + `useTrackRouteAsRecent` +
  `RecordDetailView`). Multi-device by construction: open a record on
  laptop, see it in `⌘K → Recently viewed` on phone.
  - Group renders only when input is empty (no competition with search).
  - Limited to the 5 most recent record-type entries.
  - New i18n key `console.commandPalette.recentRecords` (en + zh seeded;
    other locales fall back to `defaultValue: "Recently viewed"`).

- b2d1704: feat(cmdk): record search across objects in the Command Palette
  - New `useRecordSearch` hook in `@object-ui/react` debounces a query, fans out
    to `dataSource.find(name, { $search, $top })` across candidate objects, and
    aggregates hits. Race-safe via a monotonic runId; per-object 404s are
    silently dropped via `Promise.allSettled`.
  - `CommandPalette` (`@object-ui/app-shell`) now accepts a `dataSource` prop;
    when supplied, the palette renders a `Records` group at the top with hits
    scoped to the active app's nav objects. Item `value` embeds the live query
    so cmdk's client-side filter doesn't hide async results.
  - Added `console.commandPalette.records` i18n key (`Records` / `记录`).

- 921bd28: Console now honors `App.homePageId` for the bare `/console/apps/:appName`
  landing route. Previously it always redirected to the first reachable nav
  item, so CRM-style apps with KPI dashboards still landed users on the
  first object list (e.g. Leads) rather than the configured home page.

  The new `resolveLandingRoute` looks up the `homePageId` nav item, builds
  its route (object / view / page / dashboard / report), and falls back to
  the existing `findFirstRoute` only when no `homePageId` is set or it
  resolves to a routeless item type.

- 3ebba63: Fix silent blank page on shorthand record deep-links.

  Three related fixes that all addressed the same UX: a user follows a URL
  shaped `/{object}/{recordId}` and sees a completely blank content area.
  1. **`useNavigationOverlay` produced the broken URL itself.** When
     middle-click / Cmd-click opened a gallery card in a new tab and no
     `onNavigate` was provided, the hook built `/{object}/{id}` — a URL
     shape that does not match any route in the console route table. The
     builder now emits the canonical `/{object}/record/{id}`.
  2. **Shorthand redirect for externally shared links.** Even with the
     producer fixed, links pasted from email / Slack / older builds
     still use the shorthand. The console now intercepts
     `/{:objectName}/:maybeRecordId` and, when the second segment looks
     like a record id (URL-safe slug ≥ 6 chars, not a reserved keyword),
     redirects to `/{objectName}/record/{recordId}` preserving query and
     hash.
  3. **Visible 404 fallback.** Routes that match nothing at all now
     render an explicit "Page not found" empty state with a "Go back"
     action instead of leaving the content area blank. Silent failures
     are now visible failures.

- a4a0e1d: Add `<PresenceProvider>` abstraction with `useTenantPresence()` and
  `useRecordPresence(objectName, recordId)` hooks. The default source is a
  no-op so hooks return `[]` until a host app wires in a realtime
  transport (WebSocket / SSE). Replaces the two architectural TODOs in
  `AppHeader` (tenant scope) and `RecordDetailView` (record scope) that
  were waiting on this abstraction.

  `AppHeader` now falls back to `useTenantPresence()` when the
  `presenceUsers` prop is omitted, and `RecordDetailView` renders
  `<PresenceAvatars>` next to the lifecycle badge when other users are
  viewing the same record. Both code paths render exactly as before when
  no provider is mounted, so this change is non-visual for existing
  consumers.

### Patch Changes

- 9997cae: DataSource: add optional `bulkUpdate(resource, ids, patch)` for "same patch, many rows" interactions (Slack "mark all as read", Linear "archive selected"). The ObjectStack adapter routes to `POST /api/v1/data/:object/updateMany` so the client pays one HTTP/auth/RLS round-trip instead of N parallel PATCHes, eliminating mark-all-read jank on inboxes with 50+ unread.

  AppHeader's `markAllRead` now prefers `bulkUpdate`, with a transparent fallback to the per-id loop for adapters that don't implement the helper.

- 0a644f0: feat(app-shell): CommandPalette searching indicator

  When `useRecordSearch` is mid-flight (debounced fetch across objects
  hasn't returned yet), the palette now surfaces a subtle visual:
  - A small pulsing primary-coloured dot next to the **Records** group
    heading, so the user sees that more results may still appear.
  - A `Searching…` placeholder inside the empty state when the user has
    typed something but no hits exist yet — replaces the static
    "No results found." message until the request settles.

  New i18n key `console.commandPalette.searching` (en + zh).

- 5f71924: feat(app-shell): better default toast UX in ConsoleToaster

  `ConsoleToaster` now ships UX-positive defaults that match the Linear
  / Notion pattern users expect from an enterprise console:
  - `position="top-right"` — keeps the user's primary work area (centre
    - bottom) unobstructed.
  - `closeButton` — every toast has an explicit X so users can dismiss
    rather than wait the duration out.
  - `richColors` — type-aware coloured backgrounds (success / error /
    warning / info) so the kind of message is legible at a glance.
  - `expand` — toast stack expands on hover so users can read multiple
    recent toasts without dismissing.
  - `visibleToasts={4}` — prevents the corner from being overrun.
  - `duration: 4000` — long enough to read + click an `Undo` action.

  All of these are still overridable via `<ConsoleToaster …>` props.

- 5425608: CRM UX polish pass — calmer enterprise look across detail + kanban.
  - **plugin-kanban**: column headers now use a 2px muted accent stripe with
    neutral foreground titles + a quiet grey count pill instead of full
    rainbow gradient + colored title + colored count. Pipeline boards
    (Opportunity, Case, Task, Lead) look like Salesforce/Linear instead of
    a toy. WIP-limit overflow remains destructive-red so urgency stays loud.
  - **plugin-detail (`record:reference_rail`)**: new `hideEmpty` prop
    (default true) collapses entries whose total === 0 into a single
    `+ N empty (Quotes · Products …)` chip at the bottom of the rail.
    Removes the 4–7 "No records" stack that dominated the aside.
  - **plugin-detail (`record:path`)**: completed stages now render with an
    emerald-tinted background + bold green check instead of low-contrast
    `bg-muted text-muted-foreground` (which read as "light grey on white"
    and was borderline unreadable).
  - **app-shell (`RecordDetailView`)**: record-not-found short-circuit.
    Previously a stale/missing recordId still rendered the page chrome
    (rail, discussion, breadcrumb with the raw id), making invalid links
    look like a partially broken page. Now renders a clean centered
    `Empty` state with database icon + i18n'd "Record not found" copy.
  - **i18n**: added `detail.showEmptyRelated_{one,other}` and
    `empty.recordNotFound{,Description}` keys (en + zh).

- 710fbe6: feat(app-shell): notification center animation polish

  InboxPopover now animates every signal that matters for "noticing":
  - Bell button **bounces once** when total pressure increases (new
    notification or approval arrives). Tracks previous total via a ref
    so the very first render — when the server-side counts hydrate —
    does not trigger a spurious bounce.
  - Bell badge **zooms in** on every count change (re-keyed on
    `totalBadge` so each transition is an independent animation).
  - Per-tab counter badges (Notifications / Approvals) get the same
    zoom-in treatment on count change.
  - Notification list rows **fade + slide in from top** with a small
    staggered delay (capped at 6×20ms so a full list never feels
    laggy).
  - Activity rows mirror the same fade/slide pattern.
  - Empty states (`You're all caught up`, `No recent activity`, `No
pending approvals`) fade in instead of popping in.
  - The unread dot (•) is now always rendered but fades its opacity
    when `is_read` flips, instead of disappearing instantly — gives a
    smooth "marked read" affordance.

  All animations are wrapped in `motion-safe:` utility variants so
  users with `prefers-reduced-motion` see the previous (instant) UI.
  No new dependencies; reuses `tailwindcss-animate` utilities already
  present in the design system.

- 7c441f5: End-to-end @-mention notifications.

  `@object-ui/plugin-detail` now exports `extractMentions(text, suggestions)`
  — a small utility that resolves `@<label>` tokens in a comment body to
  user ids, using the same suggestion list that drives the in-editor
  dropdown. Handles labels with spaces ("@QA Test"), CJK ("@王小明"),
  longest-match disambiguation ("Anna Lee" wins over "Anna"), and ignores
  unknown @-tokens. 9 unit tests.

  `@object-ui/app-shell` `RecordDetailView` now:
  1. Serializes the resolved mention ids into `sys_comment.mentions`
     (previously hard-coded `'[]'`, so servers had no idea who was being
     pinged).
  2. Fan-outs a `sys_notification` row per mentioned recipient
     (self-mentions are filtered as noise) with the canonical bell-inbox
     shape: `type: 'mention'`, `recipient_id`, `actor_name`, `title`,
     `body` preview (≤140 chars), `source_object`/`source_id`/
     `source_comment_id`, `is_read: false`, `created_at`.

  The notification write tolerates 404 silently, so deployments without
  a notification collection degrade to the previous behavior (mention
  text + highlight, no inbox row). Spec-compliant servers that emit
  notifications via their own sys_comment after-create hook can ignore
  the client-side write — the bell de-dupes by id at the polling layer.

- 072cad0: Always seed @-mention suggestions with the current user so the dropdown
  appears even when the backend has no `sys_user` directory (or the fetch
  fails). Hosts with a real user roster still get the merged list —
  current user first, then directory entries de-duped by id.

  Previously, typing `@` in the discussion comment box was a no-op on
  example backends that don't serve `sys_user`, making the feature look
  broken. Authors can now at minimum mention themselves; richer rosters
  are merged in automatically when available.

- 54e3dfb: Remove unused stub renderers from `@object-ui/app-shell`:
  - `ObjectRenderer` / `ObjectRendererProps`
  - `DashboardRenderer` / `DashboardRendererProps`
  - `PageRenderer` / `PageRendererProps`
  - `FormRenderer` / `FormRendererProps`

  These were placeholder components that never delegated to a real
  SchemaRenderer — they rendered a literal `"TODO"` string and were not
  consumed anywhere in the monorepo or in the official Console app.
  Because they were non-functional, no working production code could
  have depended on them; this is treated as a patch-level cleanup rather
  than a semver-major break.

  If you were importing one of the removed stubs (and somehow got past
  the "TODO" placeholder render), the real renderers ship from the
  respective plugin packages:
  - Dashboard → `@object-ui/plugin-dashboard` (`DashboardRenderer`)
  - Page / Object / Form → `@object-ui/react` (`SchemaRenderer`) +
    `@object-ui/plugin-form` / `@object-ui/plugin-grid` etc.

- Updated dependencies [de0c5e6]
- Updated dependencies [9997cae]
- Updated dependencies [321294c]
- Updated dependencies [b2d1704]
- Updated dependencies [0a644f0]
- Updated dependencies [a3cb88f]
- Updated dependencies [5425608]
- Updated dependencies [6c3f018]
- Updated dependencies [d912a60]
- Updated dependencies [87bc8ff]
- Updated dependencies [3ebba63]
- Updated dependencies [e919433]
- Updated dependencies [a8d12ec]
- Updated dependencies [a4a0e1d]
- Updated dependencies [70b5570]
- Updated dependencies [aa063db]
- Updated dependencies [d9c3bae]
- Updated dependencies [d1442e3]
- Updated dependencies [7c7400a]
- Updated dependencies [b703480]
- Updated dependencies [e7b6eae]
  - @object-ui/types@5.2.0
  - @object-ui/data-objectstack@5.2.0
  - @object-ui/core@5.2.0
  - @object-ui/i18n@5.2.0
  - @object-ui/react@5.2.0
  - @object-ui/fields@5.2.0
  - @object-ui/components@5.2.0
  - @object-ui/collaboration@5.2.0
  - @object-ui/layout@5.2.0
  - @object-ui/auth@5.2.0
  - @object-ui/permissions@5.2.0
  - @object-ui/providers@5.2.0

## 5.1.1

### Patch Changes

- Updated dependencies [8955b9c]
  - @object-ui/components@5.1.1
  - @object-ui/fields@5.1.1
  - @object-ui/layout@5.1.1
  - @object-ui/types@5.1.1
  - @object-ui/core@5.1.1
  - @object-ui/i18n@5.1.1
  - @object-ui/react@5.1.1
  - @object-ui/data-objectstack@5.1.1
  - @object-ui/auth@5.1.1
  - @object-ui/permissions@5.1.1
  - @object-ui/collaboration@5.1.1
  - @object-ui/providers@5.1.1

## 5.1.0

### Minor Changes

- d1ec6a2: Fold inline-edit into the page-header overflow menu (HubSpot/Lightning
  pattern) and remove the orphan "Edit fields" toolbar row that previously
  floated between the tab strip and the first detail section.
  - `@object-ui/app-shell` `RecordDetailView`: injects a new `sys_inline_edit`
    system action that appears in the ⋯ overflow menu and dispatches a
    `objectui:record:inline-edit-toggle` window CustomEvent (filtered by
    recordId + objectName).
  - `@object-ui/plugin-detail` `DetailView`: listens for that event to
    toggle inline-edit mode; the in-page toolbar now renders only during
    active editing / save error / locked states, so the idle layout flows
    tabs → first section card with no orphan row.
  - `@object-ui/components` layout containers: extended `KNOWN_LABEL_DICT`
    with zh-CN + zh-TW translations for common CRM related-list labels
    (Quotes / Products / Contacts / Accounts / Leads / Opportunities /
    Cases / Campaigns / Approvals / Documents / Emails / Calls / Meetings
    / Open Tasks / Closed Tasks), so authored English labels auto-translate
    in `page:accordion` / `page:tabs` items.

- cf30cc2: Polish Lightning record detail page layout.
  - `record:details` sections now render with Card chrome by default when a `title` is present, restoring visual grouping that was missing on pages like the opportunity detail page.
  - Section labels can be translated via the `{ns}.objects.{objectName}._sections.{name}.label` convention. Author each section with a stable `name` (e.g. `info`, `forecast`) and the renderer picks up the locale-specific label automatically. Falls back to the literal `label` when no translation exists.
  - The `page:header` action toolbar now collapses into a `⋯` overflow menu when more than two actions are present. The first business action stays inline; secondary system actions (Edit / Share / Delete) move into the menu, with destructive styling applied to Delete.
  - Header action labels resolve via the `{ns}.objects.{objectName}._actions.{name}.label` convention.
  - Removed the meaningless field-count Badge from collapsible section headers (the `2` chip next to "Description"). Field-count metadata wasn't useful in the header and added visual noise.
  - Synth-path `sys_delete` now carries `variant: 'destructive'` so the overflow menu can color it appropriately.

- c0b236f: Platform detail/form polish:
  - **Auto-section grouping**: When an object has no authored `views.form.sections`, the detail page now splits fields into a primary section and a collapsible "More details" section based on a field-type/name heuristic (textarea / markdown / description / notes / remarks). Eliminates the wall-of-fields layout on objects without explicit detail metadata.
  - **FormSection card chrome**: `FormSection` now accepts `showBorder`. Defaults to `true` for titled sections (Card wrapper) and `false` for untitled sections (flat). Same auto-default already applied to `DetailSection`.
  - **Origin breadcrumb**: Navigating from a list/kanban into a record now records the source view; the detail page shows a `← <view label>` back-link above the page header.
  - New i18n key `detail.sectionMoreDetails` (en + zh-CN).

### Patch Changes

- d51a577: feat(platform): Discussion attachments + @mention directory + Reference Rail aside
  - **Discussion attachments** — `RichTextCommentInput` now accepts an `extraSlot`
    and a `canSubmitEmpty` flag so hosts can mount the existing
    `CommentAttachment` composer beneath the editor without forking the toolbar.
    `RecordActivityTimeline` plumbs the attachments through
    `DiscussionContext.onUploadAttachments` and submits attachment-only comments.
  - **@mention directory** — `DiscussionContext` gains a `mentionSuggestions`
    field; `RecordDetailView` populates it from the host `sys_user` collection so
    `@` autocomplete in the composer now resolves against real users.
  - **Reference Rail** — New `record:reference_rail` renderer + a dedicated
    `aside` region emitted by `buildDefaultPageSchema` whenever a record has
    ≥ 2 related lists. The rail surfaces a Salesforce/HubSpot-style snapshot
    of related collections (count badge + top 3 records) on `xl+` viewports.
  - **Layout** — `PageRenderer`'s structured-layout `<aside>` wrappers now honor
    `aside.className`, letting schemas attach responsive utilities like
    `hidden xl:flex` to the rail region.

- 1976691: Fix the drawer "Open as full page" (maximize) button on the record drawer
  which threw `TypeError: name.indexOf is not a function` and prevented
  navigation to the dedicated detail page.
  - `@object-ui/app-shell` `ObjectView`: pass `objectDef.name` (string) — not
    the whole `objectDef` — into `viewLabel(...)` when computing the
    `originState.from.label` for both drawer-navigate and list-navigate
    flows. Two call sites fixed.
  - `@object-ui/i18n` `useObjectLabel`: harden `stripNamespace` so it
    tolerates non-string inputs and returns an empty string instead of
    throwing, providing a safety net for similar future regressions.

- a49f300: feat(detail): per-object Reference Rail opt-out via `objectDef.detail.hideReferenceRail`

  The Record-detail Reference Rail (right-hand related-list summary cards)
  can now be suppressed on a per-object basis without authoring a full
  custom `Page`. Catalog-style objects (Product, Task) ship with the rail
  off by default; hub objects (Account, Opportunity, Contact, Case) keep it
  on.
  - `RecordDetailView` now reads `(objectDef as any)?.detail?.hideReferenceRail`
    and `…?.hideRelatedTab` and threads them to `buildDefaultPageSchema`.
  - The Reference Rail renderer also accepts entries authored as either a
    flat `entries` array or nested under `properties.entries`, so explicit
    `Page` authors can opt-in via the standard spec shape.
  - See `packages/plugin-detail/README.md` (Reference Rail decision matrix)
    for the rationale and per-object guidance.

- e9767b0: Remove dead `sys_presence` REST probes from `RecordDetailView` and `AppHeader`. Real-time
  presence does not belong in a regular REST collection — the feature is being redesigned
  behind a transport-level `<PresenceProvider>` (see ROADMAP). This change removes the
  probe (and associated state / unused UI mounts) so the browser no longer makes silently
  swallowed 404 requests on every record open / app navigation. UI surface area is
  unchanged for end users (the previous code never rendered viewers when the probe failed).
- Updated dependencies [bd8447d]
- Updated dependencies [fbd5052]
- Updated dependencies [d51a577]
- Updated dependencies [1976691]
- Updated dependencies [d1ec6a2]
- Updated dependencies [cf30cc2]
- Updated dependencies [5b80cfd]
- Updated dependencies [49b1760]
- Updated dependencies [c0b236f]
- Updated dependencies [d548d6b]
  - @object-ui/components@5.1.0
  - @object-ui/react@5.1.0
  - @object-ui/i18n@5.1.0
  - @object-ui/types@5.1.0
  - @object-ui/core@5.1.0
  - @object-ui/data-objectstack@5.1.0
  - @object-ui/fields@5.1.0
  - @object-ui/layout@5.1.0
  - @object-ui/auth@5.1.0
  - @object-ui/collaboration@5.1.0
  - @object-ui/permissions@5.1.0
  - @object-ui/providers@5.1.0

## 5.0.2

### Patch Changes

- cab6a93: **plugin-grid:** column summary footer now formats values using the
  column's type metadata. Currency columns render `Sum: $1,760,000.00`
  instead of bare `Sum: 1,760,000`; percent columns honor `0–1` vs
  `0–100` value ranges; avg uses two fraction digits. `useColumnSummary`
  accepts an optional `fieldMetadata` map (typically `objectSchema.fields`)
  so per-field `type`, `currency`, `defaultCurrency`, `precision` are
  respected.

  **plugin-gantt:** added safe-fallback `useGanttTranslation` hook. All
  hardcoded toolbar `aria-label`s and the `Task Name` / `Start` / `End` /
  `Today` column-header strings now flow through `t('gantt.*')`. A new
  `gantt.*` section is exported from the en/zh/ja/ko/de/fr/es/pt/ru/ar
  locales.

  **app-shell:** `ReportView` no longer hardcodes the `Edit` button label
  or the `Loading report…` fallback — they now use `common.edit` and
  `common.loading`.

  **i18n:** added top-level `gantt` section (with English fallbacks in
  non-en/zh locales) and the `common.addToFavorites` /
  `common.removeFromFavorites` keys across all ten built-in locales so
  the `builtInLocales` parity tests pass.

- Updated dependencies [cab6a93]
  - @object-ui/i18n@5.0.2
  - @object-ui/components@5.0.2
  - @object-ui/fields@5.0.2
  - @object-ui/react@5.0.2
  - @object-ui/layout@5.0.2
  - @object-ui/types@5.0.2
  - @object-ui/core@5.0.2
  - @object-ui/data-objectstack@5.0.2
  - @object-ui/auth@5.0.2
  - @object-ui/permissions@5.0.2
  - @object-ui/collaboration@5.0.2
  - @object-ui/providers@5.0.2

## 5.0.1

### Patch Changes

- cb4879e: form
  - @object-ui/types@5.0.1
  - @object-ui/core@5.0.1
  - @object-ui/i18n@5.0.1
  - @object-ui/react@5.0.1
  - @object-ui/components@5.0.1
  - @object-ui/fields@5.0.1
  - @object-ui/layout@5.0.1
  - @object-ui/data-objectstack@5.0.1
  - @object-ui/auth@5.0.1
  - @object-ui/permissions@5.0.1
  - @object-ui/collaboration@5.0.1
  - @object-ui/providers@5.0.1

## 5.0.0

### Minor Changes

- 8930b15: feat(detail): close the gap between Page-assigned and default record detail pages (Track 1)

  Custom Lightning-style record detail pages (assigned via `assignedPage` /
  `Page` schemas) used to feel meaningfully poorer than the auto-generated
  default detail view. They were missing cross-cutting affordances and
  shipped with English-only tab labels and heavy bordered section cards
  even when the host locale was Chinese. Track 1 closes the visible gap:
  - **app-shell `RecordDetailView`**: the `assignedPage` branch now wears
    the same chrome as the default branch — lifecycle managed-by badge
    and presence avatars in the top-right, `MetadataPanel` debug panel,
    `ActionConfirmDialog` / `ActionParamDialog`, and an auto-appended
    `RecordChatterPanel` at the bottom of the page. Authors opt out of
    the auto-discussion with `assignedPage.disableDiscussion = true`.
  - **plugin-detail `record:details`**: defaults to `inlineEdit: true` so
    fields are click-to-edit just like the default page, and synthesises
    sections with `showBorder: false` by default so a Lightning page
    doesn't double-wrap every block in a heavy Card.
  - **components `page:tabs` / `page:accordion`**: well-known English
    labels (Details / Related / Activity / History / Notes / Files /
    Tasks / Events / Attachments / Chatter / Discussion / Comments /
    Overview / Summary) auto-translate to Chinese (`zh-CN` / `zh-TW`)
    via a built-in dictionary keyed off `document.documentElement.lang`.
    Authors supplying explicit localised labels (string or
    `{ default, zh-CN, ... }`) are not affected.
  - **i18n provider**: applies the initial language to
    `document.documentElement.lang` on mount (i18next does not fire
    `languageChanged` for the bootstrap language), so locale-aware
    renderers downstream see the right value from the first render.

- 186aee8: feat(detail): default-on renderViaSchema for non-assignedPage records

  Track 3 Phase G slice 6. The synthesized Page schema path (slice 2,
  behind `?renderViaSchema=1`) is now the default rendering pipeline for
  every object without a custom assignedPage. Visual and functional
  parity verified on task and account before flipping.

  Switches preserved: `?renderViaSchema=0` URL fallback,
  `objectDef.detail.renderViaSchema = false` per-object opt-out.

- 927187a: Phase N.1 + N.2: visual polish for record detail pages.

  **N.1 — System actions on full Lightning pages.** `PageHeaderRenderer`
  now merges `headerSystemActions` from `RecordContext` with authored
  actions (authored wins on name/id collision), so full custom pages
  (lead, opportunity, ...) once again show 编辑 / 分享 / 删除 alongside
  their authored actions. `sys_share` and `sys_delete` now use the
  `outline` variant instead of `destructive` to read better in
  multi-button clusters.

  **N.2 — Hide empty fields by default in synth detail pages.**
  `record:details` defaults `section.hideEmpty` to `true` so synthesized
  pages don't render label graveyards on first load. The "显示 N 个空字段"
  reveal toggle is preserved as the user-facing escape hatch. Authors can
  opt back into showing every field by setting `hideEmpty: false` on the
  section schema.

- 8435860: Phase N.4b: highlight↔body dedup now works for hand-authored Lightning
  pages too.

  Adds a small `HighlightFieldsContext` registry. `record:highlights`
  registers the field names it currently surfaces; `record:details` unions
  that live set into its `hideFieldNames` filter so a field shown in the
  highlight strip is never duplicated in the section grid below.

  Previously the dedup only fired for synth-generated pages (via the
  `hideFields` prop passed by `buildDefaultPageSchema`). Custom Lightning
  pages (e.g. opportunity) showed `所属客户` both in the strip and in the
  body. The registry-based approach covers both code paths uniformly with
  no schema author work required.

  The registry uses `useSyncExternalStore` so adding/removing highlights
  notifies consumers without triggering the provider value identity to
  change — avoiding the update-loop that a naive context implementation
  would cause.

  `RecordDetailView` mounts `<HighlightFieldsProvider>` once per record
  page so the two renderers share state.

- 74962b0: feat(detail): record:discussion schema component + flush accordion variant
  - New `record:discussion` schema type lets authors place the record
    chatter feed anywhere in a custom Page schema. Wired through a
    shared `DiscussionContext` provider on the `assignedPage` branch
    of `RecordDetailView`; auto-append still applies when no explicit
    `record:discussion` / `record:chatter` node is present.
  - `page:accordion` gains a `variant` prop. Default `flush` strips the
    per-item border so accordion sections no longer double-wrap inner
    Card-bearing renderers (RelatedList, etc.). Authors who want the
    old visual pass `variant: 'card'`.
  - `translateLabel` now handles compound labels split by `&`, `and`,
    or `和` (e.g. `Notes & Attachments` → `备注与附件`).

- fa4c2cb: feat(detail): renderViaSchema opt-in routes default detail through SchemaRenderer (Track 3 Phase G slice 2)

  When `?renderViaSchema=1` is in the URL, or `objectDef.detail.renderViaSchema === true`,
  `RecordDetailView`'s no-assignedPage branch now synthesizes a canonical
  Page schema (`page:header` → `record:highlights` → `record:path` →
  `page:tabs(record:details)` → `record:discussion`) via
  `buildDefaultPageSchema(objectDef, { sections, highlightFields })` and
  renders it through the existing `<SchemaRenderer>` pipeline.

  This means every object without a custom assigned page can opt in to
  the same chrome (record-aware header chip, chevron path, flush
  accordion, discussion slot) that custom Lightning pages already enjoy.

  Changes:
  - `buildDefaultPageSchema` now emits `page:tabs.items` (correct shape
    for the renderer) rather than `tabs`.
  - `PageHeaderRenderer.resolvedTitle` honors `objectSchema.primaryField`
    before the legacy `name/title/display_name/label` fallbacks.
  - `RecordDetailView` rebuilds the synthesized schema with
    `detailSchema.sections` + `highlightFields` at render time so
    `record:details` inherits the same field layout the legacy
    `<DetailView>` would have produced.

  Flag is intentionally off by default — flipping the default is a
  separate explicit commit after empirical parity validation across
  multiple objects. Known gaps tracked for slice 3: titleFormat
  fallback for objects without `primaryField`, auto Activity / History
  tabs, header-action buttons.

- 7213027: feat(detail): slotted record pages (Track 3 Phase I)

  Introduce `kind: "slotted"` record pages that override one or more
  named slots while letting the default-page synthesizer fill in the
  rest. Authors no longer need to re-author the entire page just to
  customize the header or one tab.

  **Slot menu (v1):**
  - `header` — replaces `page:header`
  - `actions` — replaces the `record:quick_actions` action bar
  - `highlights` — replaces the chips + chevron path strip
  - `details` — replaces the Details tab body (other tabs stay synthesized)
  - `tabs` — replaces the entire `page:tabs` node (wins over `details`)
  - `discussion` — replaces the inline `record:discussion` footer

  Each slot is a full replacement at the slot boundary. To compose
  default + custom, call the corresponding `buildDefault*` sub-builder
  (now exported from `@object-ui/plugin-detail`):
  `buildDefaultHeader`, `buildDefaultActions`, `buildDefaultHighlights`,
  `buildDefaultDetails`, `buildDefaultTabs`, `buildDefaultDiscussion`.

  **Author shape:**

  ```ts
  {
    type: 'record',
    object: 'account',
    kind: 'slotted',
    slots: {
      header: { type: 'page:header', properties: { ... } },
    },
  }
  ```

  **API changes:**
  - `PageSchema` (in `@object-ui/types`): adds `kind?: 'full' | 'slotted'`
    (default `'full'`) and `slots?: PageSlotMap`.
  - `usePageAssignment` (in `@object-ui/react`): result now exposes a
    `slots` field populated when the matched page has `kind === 'slotted'`.
    Existing `page` field is unchanged for full pages.
  - `buildDefaultPageSchema` (in `@object-ui/plugin-detail`): accepts an
    `options.slots` map that overrides individual regions at synthesis time.

- 34b66bf: feat(detail): synthesize Related / Activity / History tabs + record:quick_actions header (Track 3 Phase G slice 4)
  - `buildDefaultPageSchema` now accepts `headerActions`, `related`,
    `showActivity`, and `history` options. When provided, the synthesizer
    emits a `record:quick_actions` node after `page:header` and appends
    the corresponding tabs to `page:tabs.items` in stable order
    (Details / Related / Activity / History).
  - New `record:history` renderer wraps the existing `HistoryTimeline`,
    reading `entries` / `loading` from the schema. Host owns fetching.
  - `RecordDetailView` forwards `detailSchema.actions[0].actions`,
    `detailSchema.related[]` (unwrapped to `{objectName,relationshipField}`),
    and `detailSchema.history` into the synthesizer call so the
    `renderViaSchema` path reaches parity with the monolithic DetailView
    tab strip and header action bar.
  - 6 new unit tests covering headerActions emit/skip, Related tab
    shape, Activity opt-in, History entries pass-through, and stable
    tab ordering.

  No behavior change for objects without the `renderViaSchema` opt-in.

- c7561a7: **Unify per-user UI state storage onto `sys_user_preference`.**

  `createObjectStackUserStateAdapter` previously wrote to a bespoke
  `user_app_state` object using `(user_id, kind, payload)` columns. That
  parallel KV table duplicated the canonical per-user preference store
  shipped by `@objectstack/plugin-auth`, and pulled UI traces (favorites,
  recent items, grid widths) out of the place users actually look for
  their settings.

  The adapter now defaults to:
  - `resource`: `sys_user_preference`
  - field shape: `(user_id, key, value)` instead of `(user_id, kind, payload)`
  - option name: **`key`** instead of `kind`

  `ConsoleShell` is updated to attach favorites/recent under the namespaced
  keys `ui.favorites` and `ui.recent`. Recommended convention for new
  adapters: keep machine-written UI traces under `ui.*` so they stay
  distinguishable from user-facing preferences (`theme`, `locale`, ...).

  **Migration**: callers passing `kind:` need to switch to `key:`. Callers
  relying on the old `user_app_state` table can pin
  `resource: 'user_app_state'` to keep the legacy behaviour, but no
  backend ships that schema and the new default works against any
  plugin-auth-enabled environment with zero extra setup.

### Patch Changes

- 983d5ad: fix(app-shell): suppress duplicate discussion panel on record detail pages

  `RecordDetailView` auto-appends a `RecordChatterPanel` below the
  rendered page unless an explicit `record:discussion` / `record:chatter`
  node is found in the schema. The detection walker recursed into
  `children / items / body / components / properties.*` but **not**
  `regions[]`. Synthesised pages (`buildDefaultPageSchema`) and authored
  full-Lightning pages place `record:discussion` inside
  `regions[0].components`, so the walker missed it and a second
  discussion panel rendered on top of the first.

  Extracted the walker into `utils/pageSchemaIntrospect.ts`, added a
  `regions` branch, and covered both shapes with unit tests.

  Verified in browser on account (slotted), opportunity (full), lead,
  contact, and task — each renders exactly one discussion panel.

- a4c10b2: Restore Edit / Share / Delete system actions on synthesized record detail headers.

  Phase G slice 6 flipped the synth detail page on by default but did not
  forward the legacy DetailView's built-in system actions to the new
  `record:quick_actions` bar. Objects without authored `record_header`
  business actions ended up with a bare header (only the ★ favorite +
  copy-id chip from `page:header`).

  This patch injects gated system actions into `synthHeaderActions` for
  both the synth and slotted paths:
  - `sys_edit` — visible when `affordances.edit`. Calls the existing
    `onEdit` prop, opening the same form modal as before.
  - `sys_share` — always visible. Uses `navigator.share` when available;
    falls back to clipboard copy of the current URL with a toast.
  - `sys_delete` — visible when `affordances.delete`. Confirms via
    `window.confirm`, calls `dataSource.delete`, then navigates back to
    the list.

  Business / custom actions (e.g. Lead.convert, Contact.set_primary)
  continue to render alongside the system actions, unchanged. Full
  Lightning pages (objects with an `assignedPage`) are unaffected — they
  remain author-owned.

- Updated dependencies [542cca9]
- Updated dependencies [8930b15]
- Updated dependencies [95b6b21]
- Updated dependencies [ddb08a7]
- Updated dependencies [f16a762]
- Updated dependencies [765d50f]
- Updated dependencies [927187a]
- Updated dependencies [bae8ba8]
- Updated dependencies [8435860]
- Updated dependencies [bece8ca]
- Updated dependencies [bb2ea48]
- Updated dependencies [77c1877]
- Updated dependencies [b14fe09]
- Updated dependencies [1911d34]
- Updated dependencies [ba98039]
- Updated dependencies [a7bef6e]
- Updated dependencies [86c04f1]
- Updated dependencies [74962b0]
- Updated dependencies [8b850b5]
- Updated dependencies [3154334]
- Updated dependencies [fa4c2cb]
- Updated dependencies [7213027]
- Updated dependencies [34b66bf]
- Updated dependencies [c7561a7]
  - @object-ui/plugin-detail@5.0.0
  - @object-ui/components@5.0.0
  - @object-ui/i18n@5.0.0
  - @object-ui/layout@5.0.0
  - @object-ui/react@5.0.0
  - @object-ui/types@5.0.0
  - @object-ui/data-objectstack@5.0.0
  - @object-ui/plugin-calendar@5.0.0
  - @object-ui/plugin-kanban@5.0.0
  - @object-ui/fields@5.0.0
  - @object-ui/plugin-charts@5.0.0
  - @object-ui/plugin-chatbot@5.0.0
  - @object-ui/plugin-dashboard@5.0.0
  - @object-ui/plugin-designer@5.0.0
  - @object-ui/plugin-form@5.0.0
  - @object-ui/plugin-grid@5.0.0
  - @object-ui/plugin-list@5.0.0
  - @object-ui/plugin-report@5.0.0
  - @object-ui/plugin-view@5.0.0
  - @object-ui/auth@5.0.0
  - @object-ui/collaboration@5.0.0
  - @object-ui/core@5.0.0
  - @object-ui/permissions@5.0.0

## 4.8.0

### Minor Changes

- 3a17c8d: Mobile UI: aggressive chrome reduction to match real mobile-app conventions.

  Real mobile CRMs (Salesforce, HubSpot, Notion, Linear) keep one row of
  chrome on phones: title + 1 primary action, plus content. We were
  shipping ~5 rows of toolbars + chips + tabs above the data. This commit
  hides the desktop-only chrome at the `<sm` breakpoint:
  - **ListView**: TabBar (view switcher), UserFilters chip row, quick-filters
    chip row, Sort button, list-scoped Search popover, and the
    (newly-added) mobile-only ViewSettingsPopover gear are all hidden on
    phones. Only the **Filter** icon survives on mobile — paired with the
    global ⌘K top-bar search, that is the entire mobile control surface.
  - **Kanban**: previous commit replaced verbose swipe text with a dot
    indicator; that stands.
  - **ObjectView page header**: the Import (CSV upload) button is hidden
    on mobile — CSV import is a desktop workflow.

  Net effect on a 390px viewport: ListView toolbar collapses from
  ~10 controls (5 chips + 5 icons) to a single Filter icon next to the
  title; the body of the page is reachable without scrolling past 3 rows
  of chrome.

  Desktop and tablet behavior is unchanged.

- 51e274a: feat(app-shell,plugin-list): mobile Airtable-style topbar + filter chip row

  Refactor mobile object-view layout to match the Airtable Interface
  pattern:
  - **AppHeader**: the mobile topbar's static page label is now a
    view-switcher dropdown (`<viewName> ▾`). Tapping opens a list of
    available views with icons + active-state checkmark. Falls back to
    plain text when only one view exists, or when the current page has
    no view-switching surface (Home, Settings, …).
  - **ObjectView**: drops the standalone mobile `sm:hidden` view-select
    row that previously lived between the desktop tab bar and the
    content area. View switching is now exposed exclusively via the
    topbar dropdown on mobile, eliminating the duplicated `object name`
    vs `view name` rows.
  - **ListView**: un-hides the `UserFilters` chip row on mobile.
    Single-line, horizontally scrollable, matches the Airtable Interface
    filter chip strip.
  - New lightweight `MobileViewSwitcherContext` provides a
    page → header data channel (no zustand dependency added).

  Net effect on mobile (390×844):

  ```
  ☰ 客户卡片 ▾                🔍 🔔 M    ← topbar
  类型 ▾  行业 ▾  是否活跃 ▾  更多 3 ▾  ⛛  ← chip row
  [content cards]                          ← content
                                    (+)    ← FAB
  [Leads | Accounts | Contacts | …]        ← bottom nav
  ```

- 7feed12: Mobile UX: Home affordance + chrome reduction

  Two fixes that match what users actually need on a 390px viewport:
  - **Add Home link to mobile sidebar.** When inside an app, the sidebar
    drawer previously listed only the current app's nav groups, with no
    way back to the home page (the desktop topbar's logo and AppSwitcher
    pill are hidden on phones). Now the mobile sidebar opens with a
    prominent "Home" row (`/home`) at the top, gated to mobile + app
    context so the desktop layout is untouched.
  - **Cut a row of top chrome.** The list/object PageHeader (icon + title
    - create / import / more actions) duplicated the page title already
      shown in the topbar. On mobile it's hidden entirely; the primary
      create action moves to a floating "+" button anchored above the
      bottom nav. Desktop still renders the full PageHeader.

- 00363fd: feat(app-shell): remove mobile bottom-tab navigation

  The mobile bottom-tab strip was rendering the first 5 leaf items of
  the app's navigation tree — exactly the same items that the drawer
  (`☰`) surfaces, just without grouping, favourites, or recents.

  Per the Notion / Linear mobile convention, we now rely on the drawer
  alone. Bottom-tab strips work when they expose **orthogonal**
  top-level sections (Airtable's Home / Bases / Notifications / Account)
  — but ours was a duplicate of the drawer, so it was pure visual
  weight: ~52px of vertical real estate, redundant taps, and clashes
  with the FAB and chat-bubble stack at the bottom-right corner.

  Net effect:
  - Drawer remains the single source of in-app navigation.
  - ~52px reclaimed for list/kanban content on every mobile screen.
  - FAB and chat-bubble keep their existing offsets (no overlap;
    bottom-nav was already accounted for above them).

- faba0e3: Mobile UX cleanup:
  - `app-shell/AppHeader`: hide the platform-logo, app-switcher pill, and
    intermediate path separators on mobile when inside an app route. The
    sidebar already exposes those affordances; the topbar now reads
    `☰ + page title + Search + Inbox + Avatar`.
  - `plugin-list`: replace the hidden mobile TabBar with a new compact
    `TabBarSelect` dropdown (current view name + chevron → menu of every
    view). Phone users keep view-switching without burning a row on chip
    pills. Desktop continues to render the inline TabBar.

### Patch Changes

- @object-ui/types@4.8.0
- @object-ui/core@4.8.0
- @object-ui/i18n@4.8.0
- @object-ui/react@4.8.0
- @object-ui/components@4.8.0
- @object-ui/fields@4.8.0
- @object-ui/layout@4.8.0
- @object-ui/data-objectstack@4.8.0
- @object-ui/auth@4.8.0
- @object-ui/permissions@4.8.0
- @object-ui/collaboration@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0
- @object-ui/core@4.7.0
- @object-ui/i18n@4.7.0
- @object-ui/react@4.7.0
- @object-ui/components@4.7.0
- @object-ui/fields@4.7.0
- @object-ui/layout@4.7.0
- @object-ui/data-objectstack@4.7.0
- @object-ui/auth@4.7.0
- @object-ui/permissions@4.7.0
- @object-ui/collaboration@4.7.0

## 4.6.0

### Patch Changes

- Updated dependencies [3ee436d]
  - @object-ui/components@4.6.0
  - @object-ui/fields@4.6.0
  - @object-ui/layout@4.6.0
  - @object-ui/types@4.6.0
  - @object-ui/core@4.6.0
  - @object-ui/i18n@4.6.0
  - @object-ui/react@4.6.0
  - @object-ui/data-objectstack@4.6.0
  - @object-ui/auth@4.6.0
  - @object-ui/permissions@4.6.0
  - @object-ui/collaboration@4.6.0

## 4.5.0

### Patch Changes

- d714e85: Lookup display-name resolution now falls back through a Salesforce-style chain
  when an `$expand`'d reference object lacks a top-level `name`/`label`/
  `display_name`/`title` field:
  1. Standard display fields (existing behaviour)
  2. `salutation first_name last_name` composite — handles person records that
     only carry first/last name parts
  3. `email` — last-resort identifier, beats the opaque id

  Applies to `LookupCellRenderer`, `PageHeader.subtitle` interpolation,
  `DetailView` page-mode `titleFormat`, and the shared `formatRecordTitle`
  utility. Concretely: a Contact reference with `first_name: Bob`, `last_name:
Lin` and no `name` field now renders as `Bob Lin` everywhere — instead of
  the email or [object Object] fallback.

- Updated dependencies [ab5e281]
- Updated dependencies [d714e85]
- Updated dependencies [6b6afd1]
- Updated dependencies [22fa558]
- Updated dependencies [aa7855f]
- Updated dependencies [170d89f]
  - @object-ui/types@4.5.0
  - @object-ui/fields@4.5.0
  - @object-ui/layout@4.5.0
  - @object-ui/components@4.5.0
  - @object-ui/i18n@4.5.0
  - @object-ui/auth@4.5.0
  - @object-ui/collaboration@4.5.0
  - @object-ui/core@4.5.0
  - @object-ui/data-objectstack@4.5.0
  - @object-ui/permissions@4.5.0
  - @object-ui/react@4.5.0

## 4.4.0

### Patch Changes

- 501ce20: fix(detail): hide system/tenant fields from auto-generated record detail

  The auto-generated detail section (used when an object has no explicit form
  sections) was leading every record page with `organization_id` (rendered as
  "ORGANIZATION: Admin's Workspace") — pure tenancy metadata with no business
  value. Extended the existing audit-field filter to also drop
  `organization_id`, `tenant_id`, `is_deleted`, and `deleted_at`. Objects that
  intentionally surface tenant info can still do so via explicit
  `views.form.sections`.

- 63eb66d: fix(detail): expand lookup fields so subtitle + lookup cells show display names

  The record-page fetch in `RecordDetailView` (the page-mode path) now
  requests `$expand` for every lookup/master_detail field on the object,
  mirroring the behaviour the legacy `DetailView` already had. Combined
  with two small downstream fixes — `PageHeader` subtitle interpolation
  now extracts `name/label` from expanded reference objects instead of
  rendering `[object Object]`, and `LookupCellRenderer` now short-circuits
  to `pickRecordDisplayName` when the value is already a nested record —
  all `record:*` renderers and the page header subtitle (`Owned by
{account}`) now display the related record's name rather than the raw
  foreign-key id.

- 2bd45af: feat(shell): main becomes the scroll container; record tabs are sticky
  - `AppShell`'s SidebarProvider wrapper is now constrained to viewport
    height (`h-svh overflow-hidden`) instead of expanding with content via
    the default `min-h-svh`. This makes the inner `<main>` (which is
    `overflow-auto`) the actual scroll container instead of the window.
  - `RecordDetailView` page-mode container drops the redundant
    `h-full overflow-auto` (avoids nested scrollers; main owns scroll now).
  - `page:tabs` (horizontal) gets `sticky top-0 z-20` with a translucent
    backdrop so the tab strip stays visible while users scroll through
    long record pages — the Salesforce Lightning behaviour our schemas
    were already implying.

- e33d575: Support dotted paths (e.g. `{account.name}`) in object `titleFormat`. When a
  placeholder resolves to an expanded reference object, automatically extract
  its `name`/`label`/`display_name`/`title` so detail page titles render the
  related record's display name instead of falling through to the object label.
- Updated dependencies [63eb66d]
- Updated dependencies [67dabe1]
- Updated dependencies [ef0e30d]
- Updated dependencies [2bd45af]
  - @object-ui/layout@4.4.0
  - @object-ui/fields@4.4.0
  - @object-ui/components@4.4.0
  - @object-ui/types@4.4.0
  - @object-ui/core@4.4.0
  - @object-ui/i18n@4.4.0
  - @object-ui/react@4.4.0
  - @object-ui/data-objectstack@4.4.0
  - @object-ui/auth@4.4.0
  - @object-ui/permissions@4.4.0
  - @object-ui/collaboration@4.4.0

## 4.3.1

### Patch Changes

- 9167935: fix
- 52af5cf: fix
- Updated dependencies [5f4ac6e]
- Updated dependencies [6b683c8]
- Updated dependencies [0d8eb98]
  - @object-ui/i18n@4.3.1
  - @object-ui/components@4.3.1
  - @object-ui/layout@4.3.1
  - @object-ui/fields@4.3.1
  - @object-ui/react@4.3.1
  - @object-ui/types@4.3.1
  - @object-ui/core@4.3.1
  - @object-ui/data-objectstack@4.3.1
  - @object-ui/auth@4.3.1
  - @object-ui/permissions@4.3.1
  - @object-ui/collaboration@4.3.1

## 4.3.0

### Patch Changes

- 079c3b2: feat(plugin-report): per-block field resolution for joined reports

  Joined report blocks can override `objectName` to query a different
  object than the container, but the editor was always offering the
  container's fields — wrong field names, wrong types, broken granularity
  and chart-axis filtering.

  `ReportConfigPanel` now accepts an optional `getFieldsForObject`
  resolver. `JoinedBlocksEditor` uses it to source fields for each
  block based on `block.objectName ?? containerObjectName`, falling
  back to the static `availableFields` when the resolver returns
  `undefined` (unknown object).

  `ReportView` wires the resolver against the app's loaded `objects`
  list and reuses the same parsing path internally to derive its
  top-level `availableFields`, removing the duplicated schema lookup.

  5 new RTL tests verify the resolver wiring, fallback behaviour,
  add-block flow, and inline duplicate-name validation (111 plugin-report
  tests green).

- 154a36c: fix
- fed4897: fix
- Updated dependencies [f196cf4]
- Updated dependencies [ee1cc96]
- Updated dependencies [0b032be]
- Updated dependencies [115d36a]
- Updated dependencies [4e7bc1b]
- Updated dependencies [8442c05]
  - @object-ui/i18n@4.3.0
  - @object-ui/components@4.3.0
  - @object-ui/fields@4.3.0
  - @object-ui/react@4.3.0
  - @object-ui/layout@4.3.0
  - @object-ui/types@4.3.0
  - @object-ui/core@4.3.0
  - @object-ui/data-objectstack@4.3.0
  - @object-ui/auth@4.3.0
  - @object-ui/permissions@4.3.0
  - @object-ui/collaboration@4.3.0

## 4.2.1

### Patch Changes

- 47c27c7: fix
  - @object-ui/types@4.2.1
  - @object-ui/core@4.2.1
  - @object-ui/i18n@4.2.1
  - @object-ui/react@4.2.1
  - @object-ui/components@4.2.1
  - @object-ui/fields@4.2.1
  - @object-ui/layout@4.2.1
  - @object-ui/data-objectstack@4.2.1
  - @object-ui/auth@4.2.1
  - @object-ui/permissions@4.2.1
  - @object-ui/collaboration@4.2.1

## 4.2.0

### Patch Changes

- 786de60: ReportView no longer caps the report content at `max-w-5xl` (1024px). Reports now use the full available content width, matching DashboardView behavior. Matrix and grid reports in particular benefit from the additional horizontal real estate.
- Updated dependencies [eb738bd]
- Updated dependencies [650392e]
- Updated dependencies [84b4bf1]
  - @object-ui/i18n@4.2.0
  - @object-ui/components@4.2.0
  - @object-ui/fields@4.2.0
  - @object-ui/react@4.2.0
  - @object-ui/layout@4.2.0
  - @object-ui/types@4.2.0
  - @object-ui/core@4.2.0
  - @object-ui/data-objectstack@4.2.0
  - @object-ui/auth@4.2.0
  - @object-ui/permissions@4.2.0
  - @object-ui/collaboration@4.2.0

## 4.1.0

### Patch Changes

- b4ce9e2: Fix summary reports: render chart + KPIs, correct empty-table on server-aggregated data.
  - `plugin-report`: `SpecReportGrid` now renders a KPI strip (per aggregating column) and a chart section above the grid for `summary` reports. KPI section auto-hides when no aggregating columns. New `buildChartData()` adapter buckets aggregated `ReportRow[]` to chart-ready data, auto-sorts pie/funnel descending, and falls back to row count when the chart `yAxis` points at a non-numeric column. When the data is server-aggregated, the grid switches columns to `[groupings, ${field}__${agg}]` so cells aren't empty against a raw-row column schema.
  - `plugin-charts`: register `'column'` as an alias of `'bar'` in `ChartRenderer` / `AdvancedChartImpl` (Recharts only has `BarChart`).
  - `app-shell`: `ReportView` now routes any object-backed report (matrix/joined/summary/tabular/columns/groupingsAcross) through the spec `ReportRenderer`; fully-legacy `fields`+`data` schemas still use `ReportViewer`.
  - @object-ui/types@4.1.0
  - @object-ui/core@4.1.0
  - @object-ui/i18n@4.1.0
  - @object-ui/react@4.1.0
  - @object-ui/components@4.1.0
  - @object-ui/fields@4.1.0
  - @object-ui/layout@4.1.0
  - @object-ui/data-objectstack@4.1.0
  - @object-ui/auth@4.1.0
  - @object-ui/permissions@4.1.0
  - @object-ui/collaboration@4.1.0

## 4.0.12

### Patch Changes

- e468592: fix
  - @object-ui/types@4.0.12
  - @object-ui/core@4.0.12
  - @object-ui/i18n@4.0.12
  - @object-ui/react@4.0.12
  - @object-ui/components@4.0.12
  - @object-ui/fields@4.0.12
  - @object-ui/layout@4.0.12
  - @object-ui/data-objectstack@4.0.12
  - @object-ui/auth@4.0.12
  - @object-ui/permissions@4.0.12
  - @object-ui/plugin-calendar@4.0.12
  - @object-ui/plugin-charts@4.0.12
  - @object-ui/plugin-chatbot@4.0.12
  - @object-ui/plugin-dashboard@4.0.12
  - @object-ui/plugin-designer@4.0.12
  - @object-ui/plugin-detail@4.0.12
  - @object-ui/plugin-form@4.0.12
  - @object-ui/plugin-grid@4.0.12
  - @object-ui/plugin-kanban@4.0.12
  - @object-ui/plugin-list@4.0.12
  - @object-ui/plugin-report@4.0.12
  - @object-ui/plugin-view@4.0.12
  - @object-ui/collaboration@4.0.12

## 4.0.11

### Patch Changes

- 7ea1d93: dashboard
- Updated dependencies [1909bc3]
  - @object-ui/i18n@4.0.11
  - @object-ui/components@4.0.11
  - @object-ui/fields@4.0.11
  - @object-ui/plugin-calendar@4.0.11
  - @object-ui/plugin-charts@4.0.11
  - @object-ui/plugin-dashboard@4.0.11
  - @object-ui/plugin-designer@4.0.11
  - @object-ui/plugin-kanban@4.0.11
  - @object-ui/plugin-list@4.0.11
  - @object-ui/react@4.0.11
  - @object-ui/layout@4.0.11
  - @object-ui/plugin-chatbot@4.0.11
  - @object-ui/plugin-detail@4.0.11
  - @object-ui/plugin-form@4.0.11
  - @object-ui/plugin-grid@4.0.11
  - @object-ui/plugin-report@4.0.11
  - @object-ui/plugin-view@4.0.11
  - @object-ui/types@4.0.11
  - @object-ui/core@4.0.11
  - @object-ui/data-objectstack@4.0.11
  - @object-ui/auth@4.0.11
  - @object-ui/permissions@4.0.11
  - @object-ui/collaboration@4.0.11

## 4.0.10

### Patch Changes

- 7cb0c37: metadata
  - @object-ui/types@4.0.10
  - @object-ui/core@4.0.10
  - @object-ui/i18n@4.0.10
  - @object-ui/react@4.0.10
  - @object-ui/components@4.0.10
  - @object-ui/fields@4.0.10
  - @object-ui/layout@4.0.10
  - @object-ui/data-objectstack@4.0.10
  - @object-ui/auth@4.0.10
  - @object-ui/permissions@4.0.10
  - @object-ui/plugin-calendar@4.0.10
  - @object-ui/plugin-charts@4.0.10
  - @object-ui/plugin-chatbot@4.0.10
  - @object-ui/plugin-dashboard@4.0.10
  - @object-ui/plugin-designer@4.0.10
  - @object-ui/plugin-detail@4.0.10
  - @object-ui/plugin-form@4.0.10
  - @object-ui/plugin-grid@4.0.10
  - @object-ui/plugin-kanban@4.0.10
  - @object-ui/plugin-list@4.0.10
  - @object-ui/plugin-report@4.0.10
  - @object-ui/plugin-view@4.0.10
  - @object-ui/collaboration@4.0.10

## 4.0.9

### Patch Changes

- 19c044f: i18n
  - @object-ui/types@4.0.9
  - @object-ui/core@4.0.9
  - @object-ui/i18n@4.0.9
  - @object-ui/react@4.0.9
  - @object-ui/components@4.0.9
  - @object-ui/fields@4.0.9
  - @object-ui/layout@4.0.9
  - @object-ui/data-objectstack@4.0.9
  - @object-ui/auth@4.0.9
  - @object-ui/permissions@4.0.9
  - @object-ui/plugin-calendar@4.0.9
  - @object-ui/plugin-charts@4.0.9
  - @object-ui/plugin-chatbot@4.0.9
  - @object-ui/plugin-dashboard@4.0.9
  - @object-ui/plugin-designer@4.0.9
  - @object-ui/plugin-detail@4.0.9
  - @object-ui/plugin-form@4.0.9
  - @object-ui/plugin-grid@4.0.9
  - @object-ui/plugin-kanban@4.0.9
  - @object-ui/plugin-list@4.0.9
  - @object-ui/plugin-report@4.0.9
  - @object-ui/plugin-view@4.0.9
  - @object-ui/collaboration@4.0.9

## 4.0.8

### Patch Changes

- 3d58eaa: fix(auth,app-shell): hide Log out menu item when auth is disabled (guest/preview mode)

  When the console runs against a server with `discovery.services.auth.enabled === false`
  (or in preview mode), `AuthProvider` hardcodes `isAuthenticated: true` and the mock
  `signOut()` has no real backend. Previously, clicking "Log out" in the user menu had
  no visible effect — the user/session were nulled but the UI stayed authenticated.

  Changes:
  - **`@object-ui/auth`** — added `isAuthEnabled: boolean` to `AuthContextValue`
    (`true` only when real auth is in use, `false` for guest/preview modes).
  - **`@object-ui/app-shell`** — `AppHeader` and `AppSidebar` now hide the "Log out"
    menu item entirely when `!isAuthEnabled`, so users aren't presented with an action
    that can't actually do anything. Also fixed two missed i18n strings in
    `AppSidebar` ("Settings", "Log out").
  - **`@object-ui/i18n`** — added `user.{profile,settings,logout}` namespace to all
    10 built-in locales (en/zh translated; ja/ko/de/fr/es/pt/ru/ar fall back to
    English pending native translation).

- Updated dependencies [3d58eaa]
  - @object-ui/auth@4.0.8
  - @object-ui/i18n@4.0.8
  - @object-ui/components@4.0.8
  - @object-ui/fields@4.0.8
  - @object-ui/plugin-calendar@4.0.8
  - @object-ui/plugin-charts@4.0.8
  - @object-ui/plugin-dashboard@4.0.8
  - @object-ui/plugin-designer@4.0.8
  - @object-ui/plugin-list@4.0.8
  - @object-ui/react@4.0.8
  - @object-ui/layout@4.0.8
  - @object-ui/plugin-chatbot@4.0.8
  - @object-ui/plugin-detail@4.0.8
  - @object-ui/plugin-form@4.0.8
  - @object-ui/plugin-grid@4.0.8
  - @object-ui/plugin-kanban@4.0.8
  - @object-ui/plugin-report@4.0.8
  - @object-ui/plugin-view@4.0.8
  - @object-ui/types@4.0.8
  - @object-ui/core@4.0.8
  - @object-ui/data-objectstack@4.0.8
  - @object-ui/permissions@4.0.8
  - @object-ui/collaboration@4.0.8

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

- fd15918: Comprehensive i18n refactor + CI test fix.

  **i18n (`@object-ui/i18n`)**
  - Added ~130 new keys under 12 new top-level namespaces: `layout`, `search`,
    `empty`, `renderer`, `actionDialog`, `rowAction`, `navigationSync`,
    `objectActions`, `objectViewActions`, `dashboardActions`, `recordDetail`,
    `cellRender`, plus `grid.{empty,yes,no,systemFields,openMenu}`.
  - Mirrored all new top-level namespaces to all 10 built-in locales
    (en, zh, ja, ko, de, fr, es, pt, ru, ar) to maintain key parity required
    by the locale-structure test. Non-en/zh locales seed with English values
    and rely on `fallbackLng: 'en'` until human translation lands.

  **App shell (`@object-ui/app-shell`)** — replaced hardcoded English in 14
  files with `useObjectTranslation`:
  - Layout: `AppSidebar`, `ActivityFeed` (locale-aware relative time),
    `MetadataInspector`.
  - Views: `SearchResultsPage`, `ActionParamDialog`, `RecordFormPage`,
    `RecordDetailView`, `PageView`, `DashboardView` (PDF / forecast toasts),
    `ReportView`, `ObjectView` (rename / delete view toasts).
  - Console: `AppContent` (no-apps empty state).
  - Components: `PageRenderer`, `FormRenderer`, `DashboardRenderer`.
  - Hooks: `useNavigationSync` (16 toasts incl. Undo label),
    `useObjectActions` (delete confirm + success / failure toasts).

  **Plugin grid (`@object-ui/plugin-grid`)**
  - `ObjectGrid` record-detail panel now translates Empty / Yes / No / System
    via the existing `useGridTranslation` safe-fallback wrapper.
  - `RowActionMenu` adopts a local safe-fallback i18n wrapper for
    `Open menu` / `Edit` / `Delete`, preserving standalone-usage guarantees.

  **CLI test fix (`@object-ui/cli`)**
  - `cli-bin.test.ts` auto-builds the package on first run when `dist/cli.js`
    is missing, instead of throwing. This unbreaks `pnpm test:coverage` in CI
    (root vitest run does not honor turbo's `^build` deps) and removes the
    manual `pnpm --filter @object-ui/cli build` requirement for local dev.

- Updated dependencies [7c9b85c]
- Updated dependencies [fd15918]
  - @object-ui/core@4.0.7
  - @object-ui/react@4.0.7
  - @object-ui/components@4.0.7
  - @object-ui/plugin-detail@4.0.7
  - @object-ui/plugin-kanban@4.0.7
  - @object-ui/plugin-calendar@4.0.7
  - @object-ui/i18n@4.0.7
  - @object-ui/plugin-grid@4.0.7
  - @object-ui/data-objectstack@4.0.7
  - @object-ui/fields@4.0.7
  - @object-ui/layout@4.0.7
  - @object-ui/plugin-charts@4.0.7
  - @object-ui/plugin-chatbot@4.0.7
  - @object-ui/plugin-dashboard@4.0.7
  - @object-ui/plugin-designer@4.0.7
  - @object-ui/plugin-form@4.0.7
  - @object-ui/plugin-list@4.0.7
  - @object-ui/plugin-report@4.0.7
  - @object-ui/plugin-view@4.0.7
  - @object-ui/types@4.0.7
  - @object-ui/auth@4.0.7
  - @object-ui/permissions@4.0.7
  - @object-ui/collaboration@4.0.7

## 4.0.6

### Patch Changes

- 925051d: fix: convert Tailwind v3 `[--var]` arbitrary value syntax to v4 `(--var)`

  Shadcn `Sidebar`, `Calendar`, `Chart`, `Popover`, `Tooltip`, `HoverCard`,
  `Menubar`, `Select`, `Dropdown`, `Context-Menu`, and `AppSidebar` used the
  Tailwind v3 syntax `w-[--sidebar-width]`, `origin-[--radix-...]`, etc.
  Tailwind v4 no longer interprets the bare `--xxx` inside arbitrary values
  as `var(--xxx)`, so the rule emits empty CSS — the sidebar collapses to
  0 width and overlays the main content, dropdown/popover positions fall
  back to the wrong origin, and the calendar cells lose their fixed size.

  Replaced all such occurrences with the v4 CSS-variable shorthand
  `w-(--sidebar-width)`, `origin-(--radix-...)`, etc. Existing
  `[calc(var(--xxx)*-1)]` arbitrary expressions are unaffected.

- Updated dependencies [89ae109]
- Updated dependencies [925051d]
- Updated dependencies [1b6dc64]
  - @object-ui/plugin-grid@4.0.6
  - @object-ui/plugin-form@4.0.6
  - @object-ui/fields@4.0.6
  - @object-ui/components@4.0.6
  - @object-ui/plugin-chatbot@4.0.6
  - @object-ui/plugin-designer@4.0.6
  - @object-ui/plugin-kanban@4.0.6
  - @object-ui/plugin-view@4.0.6
  - @object-ui/plugin-calendar@4.0.6
  - @object-ui/plugin-detail@4.0.6
  - @object-ui/plugin-report@4.0.6
  - @object-ui/layout@4.0.6
  - @object-ui/plugin-charts@4.0.6
  - @object-ui/plugin-dashboard@4.0.6
  - @object-ui/plugin-list@4.0.6
  - @object-ui/types@4.0.6
  - @object-ui/core@4.0.6
  - @object-ui/i18n@4.0.6
  - @object-ui/react@4.0.6
  - @object-ui/data-objectstack@4.0.6
  - @object-ui/auth@4.0.6
  - @object-ui/permissions@4.0.6
  - @object-ui/collaboration@4.0.6

## 4.0.5

### Patch Changes

- Updated dependencies [1dc6061]
  - @object-ui/components@4.0.5
  - @object-ui/fields@4.0.5
  - @object-ui/layout@4.0.5
  - @object-ui/plugin-calendar@4.0.5
  - @object-ui/plugin-charts@4.0.5
  - @object-ui/plugin-chatbot@4.0.5
  - @object-ui/plugin-dashboard@4.0.5
  - @object-ui/plugin-designer@4.0.5
  - @object-ui/plugin-detail@4.0.5
  - @object-ui/plugin-form@4.0.5
  - @object-ui/plugin-grid@4.0.5
  - @object-ui/plugin-kanban@4.0.5
  - @object-ui/plugin-list@4.0.5
  - @object-ui/plugin-report@4.0.5
  - @object-ui/plugin-view@4.0.5
  - @object-ui/types@4.0.5
  - @object-ui/core@4.0.5
  - @object-ui/i18n@4.0.5
  - @object-ui/react@4.0.5
  - @object-ui/data-objectstack@4.0.5
  - @object-ui/auth@4.0.5
  - @object-ui/permissions@4.0.5
  - @object-ui/collaboration@4.0.5

## 4.0.4

### Patch Changes

- Updated dependencies [d2b6ece]
  - @object-ui/components@4.0.4
  - @object-ui/fields@4.0.4
  - @object-ui/layout@4.0.4
  - @object-ui/plugin-calendar@4.0.4
  - @object-ui/plugin-charts@4.0.4
  - @object-ui/plugin-chatbot@4.0.4
  - @object-ui/plugin-dashboard@4.0.4
  - @object-ui/plugin-designer@4.0.4
  - @object-ui/plugin-detail@4.0.4
  - @object-ui/plugin-form@4.0.4
  - @object-ui/plugin-grid@4.0.4
  - @object-ui/plugin-kanban@4.0.4
  - @object-ui/plugin-list@4.0.4
  - @object-ui/plugin-report@4.0.4
  - @object-ui/plugin-view@4.0.4
  - @object-ui/types@4.0.4
  - @object-ui/core@4.0.4
  - @object-ui/i18n@4.0.4
  - @object-ui/react@4.0.4
  - @object-ui/data-objectstack@4.0.4
  - @object-ui/auth@4.0.4
  - @object-ui/permissions@4.0.4
  - @object-ui/collaboration@4.0.4

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

- Updated dependencies [4be43e2]
  - @object-ui/types@4.0.3
  - @object-ui/core@4.0.3
  - @object-ui/i18n@4.0.3
  - @object-ui/react@4.0.3
  - @object-ui/components@4.0.3
  - @object-ui/fields@4.0.3
  - @object-ui/layout@4.0.3
  - @object-ui/data-objectstack@4.0.3
  - @object-ui/auth@4.0.3
  - @object-ui/permissions@4.0.3
  - @object-ui/plugin-calendar@4.0.3
  - @object-ui/plugin-charts@4.0.3
  - @object-ui/plugin-chatbot@4.0.3
  - @object-ui/plugin-dashboard@4.0.3
  - @object-ui/plugin-designer@4.0.3
  - @object-ui/plugin-detail@4.0.3
  - @object-ui/plugin-form@4.0.3
  - @object-ui/plugin-grid@4.0.3
  - @object-ui/plugin-kanban@4.0.3
  - @object-ui/plugin-list@4.0.3
  - @object-ui/plugin-report@4.0.3
  - @object-ui/plugin-view@4.0.3
  - @object-ui/collaboration@4.0.3

## Unreleased

### Added

- **Page-mode record forms.** Objects can now opt into a route-driven
  full-screen create/edit experience by setting `editMode: 'page'` on the
  object metadata (default remains `'modal'`). When opted in, the
  console mounts two new routes under `/apps/:appName/`:
  - `:objectName/new` for create
  - `:objectName/record/:recordId/edit` for edit

  URLs are deep-linkable, refresh-safe, and respect the browser back
  button. The new `RecordFormPage` view renders inside the existing
  `ConsoleLayout` chrome and reuses the same `<ObjectForm>` pipeline as
  the modal flow, so every existing form configuration (sections,
  visibility expressions, validations, `formType: 'tabbed' | 'wizard'`,
  …) works without changes.

  Two declarative actions expose the routes for `<action:button>` JSON:
  - `{ "action": "navigate_create", "params": { "objectName": "..." } }`
  - `{ "action": "navigate_edit", "params": { "objectName": "...", "recordId": "..." } }`

  When called from inside an `ObjectView` the `objectName` falls back to
  the action context, so it can be omitted from the params.

  See `content/docs/guide/record-edit-modes.md` for a walkthrough.
  - New view: `packages/app-shell/src/views/RecordFormPage.tsx`
  - New helpers: `resolveRecordFormTarget`, `resolveNavigateCreateUrl`,
    `resolveNavigateEditUrl` in
    `packages/app-shell/src/utils/recordFormNavigation.ts`
  - Tests: `RecordFormPage.test.tsx` (6) and
    `recordFormNavigation.test.ts` (22), all passing.

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1
- @object-ui/core@4.0.1
- @object-ui/i18n@4.0.1
- @object-ui/react@4.0.1
- @object-ui/components@4.0.1
- @object-ui/fields@4.0.1
- @object-ui/layout@4.0.1
- @object-ui/data-objectstack@4.0.1
- @object-ui/auth@4.0.1
- @object-ui/permissions@4.0.1
- @object-ui/plugin-calendar@4.0.1
- @object-ui/plugin-charts@4.0.1
- @object-ui/plugin-chatbot@4.0.1
- @object-ui/plugin-dashboard@4.0.1
- @object-ui/plugin-designer@4.0.1
- @object-ui/plugin-detail@4.0.1
- @object-ui/plugin-form@4.0.1
- @object-ui/plugin-grid@4.0.1
- @object-ui/plugin-kanban@4.0.1
- @object-ui/plugin-list@4.0.1
- @object-ui/plugin-report@4.0.1
- @object-ui/plugin-view@4.0.1
- @object-ui/collaboration@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0
  - @object-ui/auth@4.0.0
  - @object-ui/collaboration@4.0.0
  - @object-ui/components@4.0.0
  - @object-ui/core@4.0.0
  - @object-ui/data-objectstack@4.0.0
  - @object-ui/fields@4.0.0
  - @object-ui/layout@4.0.0
  - @object-ui/permissions@4.0.0
  - @object-ui/plugin-calendar@4.0.0
  - @object-ui/plugin-charts@4.0.0
  - @object-ui/plugin-chatbot@4.0.0
  - @object-ui/plugin-dashboard@4.0.0
  - @object-ui/plugin-designer@4.0.0
  - @object-ui/plugin-detail@4.0.0
  - @object-ui/plugin-form@4.0.0
  - @object-ui/plugin-grid@4.0.0
  - @object-ui/plugin-kanban@4.0.0
  - @object-ui/plugin-list@4.0.0
  - @object-ui/plugin-report@4.0.0
  - @object-ui/plugin-view@4.0.0
  - @object-ui/react@4.0.0
  - @object-ui/i18n@4.0.0

## 4.0.0

### Patch Changes

- Updated dependencies [a2d7023]
- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
- Updated dependencies [b2be122]
  - @object-ui/components@3.4.0
  - @object-ui/fields@3.4.0
  - @object-ui/plugin-designer@3.4.0
  - @object-ui/plugin-grid@3.4.0
  - @object-ui/plugin-kanban@3.4.0
  - @object-ui/types@3.4.0
  - @object-ui/plugin-form@3.4.0
  - @object-ui/plugin-calendar@3.4.0
  - @object-ui/layout@3.4.0
  - @object-ui/plugin-charts@3.4.0
  - @object-ui/plugin-chatbot@3.4.0
  - @object-ui/plugin-dashboard@3.4.0
  - @object-ui/plugin-detail@3.4.0
  - @object-ui/plugin-list@3.4.0
  - @object-ui/plugin-report@3.4.0
  - @object-ui/plugin-view@3.4.0
  - @object-ui/auth@3.4.0
  - @object-ui/collaboration@3.4.0
  - @object-ui/core@3.4.0
  - @object-ui/data-objectstack@3.4.0
  - @object-ui/permissions@3.4.0
  - @object-ui/react@3.4.0
  - @object-ui/i18n@3.4.0

## 3.3.2

### Patch Changes

- @object-ui/types@3.3.2
- @object-ui/core@3.3.2
- @object-ui/i18n@3.3.2
- @object-ui/react@3.3.2
- @object-ui/components@3.3.2
- @object-ui/fields@3.3.2
- @object-ui/layout@3.3.2
- @object-ui/data-objectstack@3.3.2
- @object-ui/auth@3.3.2
- @object-ui/permissions@3.3.2
- @object-ui/plugin-calendar@3.3.2
- @object-ui/plugin-charts@3.3.2
- @object-ui/plugin-chatbot@3.3.2
- @object-ui/plugin-dashboard@3.3.2
- @object-ui/plugin-designer@3.3.2
- @object-ui/plugin-detail@3.3.2
- @object-ui/plugin-form@3.3.2
- @object-ui/plugin-grid@3.3.2
- @object-ui/plugin-kanban@3.3.2
- @object-ui/plugin-list@3.3.2
- @object-ui/plugin-report@3.3.2
- @object-ui/plugin-view@3.3.2
- @object-ui/collaboration@3.3.2

## 3.3.1

### Patch Changes

- b429568: chore(examples): relocate console templates under `examples/`

  The fork-ready ObjectStack console template moved from `apps/console-starter`
  to `examples/console-starter`, so `apps/` only contains real deployable
  products (`console`, `site`). The third-party integration demo
  `examples/minimal-console` was renamed to `examples/byo-backend-console`
  to make its "bring-your-own backend" purpose explicit and to remove the
  naming collision with the starter template. Source comments and READMEs in
  `@object-ui/app-shell` and `@object-ui/components` have been updated to
  point at the new paths; no runtime behaviour changed. A new
  `examples/README.md` provides a "which example should I use?" selector.

- Updated dependencies [b429568]
  - @object-ui/components@3.3.1
  - @object-ui/fields@3.3.1
  - @object-ui/layout@3.3.1
  - @object-ui/plugin-calendar@3.3.1
  - @object-ui/plugin-charts@3.3.1
  - @object-ui/plugin-chatbot@3.3.1
  - @object-ui/plugin-dashboard@3.3.1
  - @object-ui/plugin-designer@3.3.1
  - @object-ui/plugin-detail@3.3.1
  - @object-ui/plugin-form@3.3.1
  - @object-ui/plugin-grid@3.3.1
  - @object-ui/plugin-kanban@3.3.1
  - @object-ui/plugin-list@3.3.1
  - @object-ui/plugin-report@3.3.1
  - @object-ui/plugin-view@3.3.1
  - @object-ui/types@3.3.1
  - @object-ui/core@3.3.1
  - @object-ui/i18n@3.3.1
  - @object-ui/react@3.3.1
  - @object-ui/data-objectstack@3.3.1
  - @object-ui/auth@3.3.1
  - @object-ui/permissions@3.3.1
  - @object-ui/collaboration@3.3.1

All notable changes to this package will be documented in this file.
See the [monorepo CHANGELOG](../../CHANGELOG.md) for cross-package release notes.

# @object-ui/app-shell — Changelog

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

# @object-ui/i18n

## 5.0.1

## 5.0.0

### Patch Changes

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

## 4.8.0

## 4.7.0

## 4.6.0

## 4.5.0

### Patch Changes

- 22fa558: Clean up pre-existing TypeScript errors in `plugin-list` and tighten i18n:
  - Switch grouping-editor labels to `t(key, { defaultValue })` option form so i18next's strict types accept the literal fallback.
  - Add the missing `list.addGroup` / `list.collapsedByDefault` / `list.removeGroup` keys to en + zh locale bundles.
  - Drop the dead `currentView === 'list'` branch in `ListView` (local `ViewType` union has `'grid'`, never `'list'`).
  - Widen `UserFilters.resolveFields` `translateOptions` parameter from a generic `<T>` to the concrete option shape so it matches the `useObjectLabel` hook's signature.

## 4.4.0

## 4.3.1

### Patch Changes

- 5f4ac6e: fix(i18n): add notifications + organizations namespaces to all 8 non-en/zh locales (ar/de/es/fr/ja/ko/pt/ru) to restore top-level key parity. Resolves the long-standing i18n.test.ts locale-parity failure.

## 4.3.0

### Patch Changes

- f196cf4: feat(plugin-report): popup picker for groupings + section-aware test ids

  The matrix/summary "Group by" (rows) and "Columns axis" (cols) sections now
  share the same searchable popup picker as the columns section, with a
  commit-on-select single-pick mode wired through `FieldPickerDialog`.
  - Per-row field buttons display the human-readable field label and open a
    dialog scoped to swap that single field (already-used fields filtered out)
  - "Add grouping" trigger uses the same dialog
  - `GroupingsBuilder` accepts a `testIdPrefix` prop; ReportConfigPanel passes
    `rows-grouping` and `cols-grouping` so both instances no longer share the
    ambiguous `grouping-field-0` testid
  - Bigger row spacing (h-7 / text-xs) — the old `text-[10px]` was unreadable

  `FieldPickerDialog` gains:
  - `commitOnSelect`: hides the Confirm/Cancel footer; clicking a row commits
    - closes immediately (intended for `singleSelect` flows)
  - `trigger`: custom trigger element override (used by the per-row field button)

- ee1cc96: feat(plugin-report): joined-report block editor

  `type: 'joined'` reports were a black hole in the editor — the type
  selector exposed them but no UI knew how to edit the `blocks` array,
  so users could neither create nor modify joined reports without
  hand-editing JSON.

  This change adds a `Blocks` section to the report editor, visible only
  when `type === 'joined'`. Each block renders as a collapsible card with
  its own name (required + unique-validated), label, description, block
  type, object override, and reuses the existing `ColumnsEditor`,
  `GroupingsBuilder`, `SpecFilterAdapter`, and `ChartConfig` builders so
  every block behaves like a mini standalone report — matching the
  runtime contract of `JoinedReportRenderer`.

  Block-level validation is surfaced in the main `ValidationBanner`:
  empty blocks array, missing or duplicate block names, and blocks
  without columns all become editor-time errors so saves stay safe.

  The non-joined sections (Columns / Rows / Columns axis / Filters /
  Chart) are hidden when `type === 'joined'` since they live per-block
  in the spec.

  New exports from `@object-ui/plugin-report`:
  - `JoinedBlocksEditor` — standalone component for embedding the
    block editor anywhere.
  - `validateJoinedBlocks` — pure helper returning translated
    problem strings, suitable for custom validation banners.
  - `ColumnsEditor`, `GroupingsBuilder`, `ChartConfig`,
    `SpecFilterAdapter`, `normalizeColumns` are now exported so
    downstream consumers can build their own report-editor surfaces.

  i18n: added `report.editor.blocks*` / `report.editor.addBlock` /
  `report.editor.removeBlock` / `report.editor.blockName*` /
  `report.editor.blockLabel*` / `report.editor.blockDescription*` /
  `report.editor.validationJoinedNeedsBlocks` /
  `report.editor.validationBlockNameRequired` /
  `report.editor.validationBlockNameDuplicate` /
  `report.editor.validationBlockNeedsColumns` to en + zh.

- 0b032be: feat(plugin-report): replace inline column picker with a popup field picker

  The columns section now opens a Dialog-based multi-select picker (`FieldPickerDialog`)
  instead of rendering the unselected field list inline. The popup supports search,
  batched multi-selection (commit several fields in one click), per-field type badges,
  cancel-discards-pending semantics, and is fully i18n'd. Also fixes a latent
  `ReferenceError: normalizeColumns is not defined` that crashed the editor whenever
  the chart section was expanded.

- 115d36a: i18n: native translations for the report editor (`report.editor.*`) in 8 locales — ar, de, es, fr, ja, ko, pt, ru. Previously these locales had the English placeholder strings copy-pasted from `en.ts` and the newer `blocks*`, `addCondition`, `opContains`, `formatCurrency` etc. keys were missing entirely (so the report editor surfaced raw key names in those languages). All locales now carry the full key set with locale-appropriate copy.
- 4e7bc1b: **Report editor panel overhaul**

  The report configuration panel is now safe to open on any spec-shape `Report` and only exposes fields that are actually persisted by `@objectstack/spec`.

  `@object-ui/plugin-report`:
  - Add a bidirectional `SpecFilterAdapter` so `ReportConfigPanel` can edit
    spec `FilterCondition` filters (`{field: value}`, `{field: {$op: value}}`,
    top-level `$and`/`$or`). Complex / nested filters fall back to a
    read-only banner and are preserved verbatim on save.
  - Drop sections that never round-tripped through the spec
    (`conditionalFormatting`, `sections`, `export`, `schedule`, `appearance`)
    and their helper components.
  - Add type-driven section visibility: `tabular` shows Columns/Filters,
    `summary` adds Rows + Chart, `matrix` adds Rows + Columns axis + Chart.
  - New `GroupingsBuilder` covers `groupingsDown`/`groupingsAcross` with
    `sortOrder` and date-aware `dateGranularity` controls.
  - New `ColumnsEditor` lets users reorder picked columns, override labels,
    set aggregates and choose a display format.
  - Chart subset now mirrors the spec: chart `title`, `showLegend`,
    `showDataLabels`, plus `funnel` (scatter removed).
  - Validation banner highlights missing `objectName` and missing
    rows/columns for `matrix`/`summary` reports.
  - All editor labels and hints are i18n-driven (`report.editor.*`).
  - 18 new unit tests cover the filter adapter round-trip.

  `@object-ui/components`:
  - `FilterBuilder` now guards against malformed external `value` props.
    Previously a spec-shape filter (`{is_active: true}`) would crash the
    component on first render; the builder now falls back to an empty
    AND group whenever `value` is not a valid `FilterGroup`.

  `@object-ui/i18n`:
  - Add `report.editor.*` strings to `en` and `zh`.

- 8442c05: Improve report editor panel usability based on real-user browser testing:
  - **Wider config panel** — the report editor now defaults to a `--config-panel-width`
    of 440px (up from 280px), driven by a new optional `style` prop on
    `ConfigPanelRenderer`. Long field labels, report titles, type labels, and filter
    rows no longer truncate to "Account Na" / "kup" / "ct" / 1-character widths.
  - **Disambiguated "Columns" sections** — for `summary` and `matrix` reports the
    measure list is now labelled **"Values / 度量"** (pivot-style vocabulary) instead
    of "Columns", which previously clashed with the matrix's pivot column axis
    (also called "Columns / 列"). The two sections used to be indistinguishable.
    New i18n key `report.editor.values` / `valuesHint` is shipped for all 10
    locales (en, zh, ar, de, es, fr, ja, ko, pt, ru).
  - **Reordered sections for matrix/summary** — the editor now surfaces _Rows_
    and _Columns_ (the pivot axes) **before** _Values_, mirroring how a business
    user thinks about a pivot table.
  - **Per-row aggregate/format headers** — each column row in `ColumnsEditor` now
    shows small "Aggregate" / "Format" labels above the respective selects, and
    the row uses a 2-line layout so the label input has its own line. The cramped
    3-dropdowns-side-by-side layout at 10px font is gone.
  - **Searchable field picker** — the "Add columns" list now has a search box,
    a `filtered / total` counter, an empty-state message, and a scrollable bordered
    container. New i18n keys: `report.editor.searchFields`,
    `report.editor.noMatchingFields`.

## 4.2.1

## 4.2.0

### Patch Changes

- eb738bd: fix(i18n): add missing top-level `report` key to ar/de/es/fr/ja/ko/pt/ru locales

  The i18n parity test (`all locales have the same top-level keys`) was failing
  because the `report` key existed only in `en` and `zh`. The other built-in
  locales now include the same `report` block (English fallback strings) so the
  CI parity check passes again.

- 650392e: MatrixRenderer now displays i18n-translated labels for picklist (`select` / `status`) groupings instead of raw values (e.g. `Best Case` / `Commit` / `Pipeline` instead of `best_case` / `commit` / `pipeline`). Field labels in the corner cell, row/column total labels, and the `(Empty)` / `(All)` placeholders are also fully translated. Adds `report.*` keys to `en` and `zh` locale bundles.
- 84b4bf1: Summary reports now render i18n-translated labels in the chart axis, chart series legend, and totals strip. `buildChartData` accepts a new `labels` parameter so callers (currently `SpecReportGrid`) can supply field/column/aggregate/value resolvers. Replaces raw column keys (e.g. `Count of case_number`) and raw picklist values (e.g. `closed`, `in_progress`) with their translated display labels (e.g. `案例编号 · 计数`, `已关闭`, `处理中`). Adds `report.totals` locale key.

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

## 4.0.7

### Patch Changes

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

## 4.0.6

## 4.0.5

## 4.0.4

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

## 4.0.1

## 4.0.0

## 3.4.0

## 3.3.2

## 3.3.1

## 3.3.0

## 3.2.0

## 3.1.5

### Patch Changes

- cfe0596: fix i18n

## 3.1.4

## 3.1.3

## 3.1.2

## 3.1.1

## 3.0.3

## 3.0.2

## 3.0.1

## 3.0.0

### Minor Changes

- 87979c3: Upgrade to @objectstack v3.0.0 and console bundle optimization
  - Upgraded all @objectstack/\* packages from ^2.0.7 to ^3.0.0
  - Breaking change migrations: Hub → Cloud namespace, definePlugin removed, PaginatedResult.value → .records, PaginatedResult.count → .total, client.meta.getObject() → client.meta.getItem()
  - Console bundle optimization: split monolithic 3.7 MB chunk into 17 granular cacheable chunks (95% main entry reduction)
  - Added gzip + brotli pre-compression via vite-plugin-compression2
  - Lazy MSW loading for build:server (~150 KB gzip saved)
  - Added bundle analysis with rollup-plugin-visualizer

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

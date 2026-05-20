# @object-ui/types

## 4.5.0

### Minor Changes

- ab5e281: `record:highlights` renderer normalizes rich field items.

  `RecordHighlightsComponentProps.fields` is now `Array<string | { name, label?, icon?, type? }>`. The renderer normalizes both forms before passing to `HeaderHighlight`, so schemas can attach per-instance label/icon overrides without editing the underlying object metadata. FLS and `redactFields` still apply on the normalized list.

## 4.4.0

## 4.3.1

## 4.3.0

## 4.2.1

## 4.2.0

## 4.1.0

## 4.0.12

## 4.0.11

## 4.0.10

## 4.0.9

## 4.0.8

## 4.0.7

## 4.0.6

## 4.0.5

## 4.0.4

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

## Unreleased

### Added

- **`ObjectSchemaMetadata.editMode`.** Optional `'modal' | 'page'` flag
  declaring whether record create/edit should open the global
  `<ModalForm>` (default) or navigate to the dedicated full-screen route
  mounted by `@object-ui/app-shell` (`/apps/:appName/:objectName/new` and
  `/apps/:appName/:objectName/record/:recordId/edit`). Default remains
  `'modal'` so existing schemas are unaffected. See the new guide at
  `content/docs/guide/record-edit-modes.md` for details.

## 4.0.1

## 4.0.0

### Major Changes

- Release v4.0.0: Unified app shell, convention-based i18n, and plugin architecture overhaul.

  ### Major Changes
  - **`@object-ui/app-shell`**: New unified application shell with sidebar, breadcrumb, and dashboard wiring.
  - **`@object-ui/providers`**: Promoted to first-class fixed package; new `DataSourceProvider` and `ThemeProvider` APIs.
  - **Convention-based i18n** (`@object-ui/i18n`): `useObjectLabel` now covers nav groups, dashboards, pages, reports, charts, and field options — zero-config localisation via translation packs.
  - **Dashboard surface i18n**: `DashboardRenderer`, `DashboardView`, `ChartRenderer`, `ObjectDataTable`, `ObjectChart`, and `data-table` all resolve labels through the i18n convention.
  - **Sidebar/breadcrumb/chart i18n**: Full i18n coverage across navigation, breadcrumbs, chart axes/legends, and table column headers.
  - **System view immutability**: Read-only UI affordances for system-managed views.
  - **Multi-level grouping**: Nested sub-group support with inline grouping editor.
  - **Record title resolution**: `titleFormat` and separator cleanup for consistent record display.

## 3.4.0

### Minor Changes

- f1ca238: Async streaming export — spec v4 export job lifecycle end-to-end

  For tenants with millions of records the legacy in-memory CSV/JSON export blew
  past the browser's heap. This change wires the spec v4 streaming-export
  contract through the renderer end-to-end:

  **`@object-ui/types`** — `DataSource` gains four optional methods:
  - `createExportJob(resource, request)` → `{ jobId, status, estimatedRecords, createdAt }`
  - `getExportJobProgress(jobId)` → `{ status, processedRecords, totalRecords, percentComplete, downloadUrl, … }`
  - `cancelExportJob(jobId)` (optional)
  - `getExportJobDownloadUrl(jobId)` (optional — for short-lived signed URLs)

  Mirror the spec v4 `CreateExportJobRequest` / `ExportJobProgress` shapes; types
  remain dependency-free.

  **`@object-ui/components`** — new public API:
  - `useExportJob({ dataSource, pollIntervalMs, onComplete, onError })` — owns the
    full polling loop, terminal-state handling, cancel, and download.
  - `<ExportProgressDialog open onOpenChange job filename closeAfterDownloadMs />` —
    determinate or indeterminate progress bar, byte/record counts, Cancel while
    running, Download on completion, error banner on failure.

  **`@object-ui/plugin-grid`** — `ObjectGrid` now auto-detects async export
  support: when the `DataSource` exposes `createExportJob` + `getExportJobProgress`
  (and the schema isn't using inline `value` data) the export popover routes
  through the streaming path with a progress dialog. Otherwise it falls back to
  the existing client-side blob path. Set `exportOptions.streaming = false` to
  force the legacy path.

### Patch Changes

- de881ef: Mobile UX round 3 — Form: sticky save bar, fullscreen long-text editor, and auto-stepper for long forms on small viewports.

  **`@object-ui/types`** — `ObjectFormSchema.mobile` (new) lets a single form opt into all three behaviours:

  ```ts
  {
    type: 'object-form',
    objectName: 'leads',
    mode: 'create',
    mobile: {
      stickyActions: true,        // pin Submit/Cancel to bottom on phones
      stepper: 'auto',            // long forms render one field per step
      stepperMinFields: 8,        // …but only past this many fields
      stepperFieldsPerStep: 1,    // … (default 1)
      fullscreenLongText: true,   // textarea fields get an "expand" affordance
    },
  }
  ```

  `FormSchema.mobileStickyActions` (new) is the lower-level escape hatch — applied automatically when `mobile.stickyActions` is set on `ObjectFormSchema`.

  **`@object-ui/plugin-form`** — `ObjectForm` now:
  - propagates `mobile.fullscreenLongText` to every textarea/markdown/html field as `mobile_fullscreen: true`,
  - sets `mobileStickyActions` on the inner form schema and adds `pb-20` padding so content isn't covered by the fixed bar,
  - when `mobile.stepper === true` (or `'auto'` + `useIsMobile()` + > `stepperMinFields` fields), routes the flat field list through the existing `WizardForm` with synthetic single-field "steps" — keeping per-step validation and the existing `Next`/`Back`/`Submit` flow.

  **`@object-ui/components`** — the registered `form` renderer adds:
  - a `mobileStickyActions` opt-in that turns the action row into a `position: sticky; bottom: 0` bar on small viewports, and
  - an inline `FullscreenTextarea` wrapper used when no field-package widget is registered, providing the same expand-button + edit-dialog UX so the feature works even in lighter setups.

  **`@object-ui/fields`** — `TextAreaField` ships the actual fullscreen UX: a top-right `Maximize2` button opens a near-fullscreen `Dialog` containing a full-height `Textarea` with a draft-then-commit save model (Cancel reverts).

  All three behaviours are off by default — existing forms render unchanged.

## 3.3.2

## 3.3.1

## 3.3.0

## 3.2.0

## 3.1.5

## 3.1.4

## 3.1.3

## 3.1.2

## 3.1.1

### Patch Changes

- Patch release v3.1.1

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

## 0.3.1

### Patch Changes

- Maintenance release - Documentation and build improvements

## 0.3.0

### Minor Changes

- New plugin-object and ObjectQL SDK updates

  **Added:**
  - New Plugin: @object-ui/plugin-object - ObjectQL plugin for automatic table and form generation
    - ObjectTable: Auto-generates tables from ObjectQL object schemas
    - ObjectForm: Auto-generates forms from ObjectQL object schemas with create/edit/view modes
    - Full TypeScript support with comprehensive type definitions
  - Type Definitions: Added ObjectTableSchema and ObjectFormSchema to @object-ui/types
  - ObjectQL Integration: Enhanced ObjectQLDataSource with getObjectSchema() method using MetadataApiClient

  **Changed:**
  - Updated @objectql/sdk from ^1.8.3 to ^1.9.1
  - Updated @objectql/types from ^1.8.3 to ^1.9.1

## 0.2.1

### Patch Changes

- Patch release: Add automated changeset workflow and CI/CD improvements

  This release includes infrastructure improvements:
  - Added changeset-based version management
  - Enhanced CI/CD workflows with GitHub Actions
  - Improved documentation for contributing and releasing

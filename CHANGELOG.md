# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Chinese language pack (zh.ts) untranslated key** (`@object-ui/i18n`): Fixed `console.objectView.toolbarEnabledCount` which was still in English (`'{{count}} of {{total}} enabled'`) — now properly translated to `'已启用 {{count}}/{{total}} 项'`. Also fixed the same untranslated key in all other 8 non-English locales (ja, ko, de, fr, es, pt, ru, ar).

- **Hardcoded English strings in platform UI** (`apps/console`, `@object-ui/fields`, `@object-ui/react`, `@object-ui/components`): Replaced hardcoded English strings with i18n `t()` calls:
  - Console `App.tsx`: Modal dialog title (`"Create/Edit Contact"`), description (`"Add a new ... to your database."`), submitText (`"Save Record"`), and cancelText (`"Cancel"`) now use i18n keys.
  - `SelectField`: Default placeholder `"Select an option"` now uses `t('common.selectOption')`.
  - `LookupField`: Default placeholder `"Select..."` and search placeholder `"Search..."` now use i18n keys.
  - `FieldFactory`: Default select option placeholder now uses `t('common.selectOption')`.
  - Form renderer: Default select placeholder now uses `t('common.selectOption')`.

### Added

- **New i18n keys for select/form components** (`@object-ui/i18n`): Added new translation keys across all 10 locale packs:
  - `common.selectOption` — Default select field placeholder (e.g., '请选择' in Chinese)
  - `common.select` — Short select placeholder (e.g., '选择...' in Chinese)
  - `form.createTitle` — Form dialog create title with interpolation (e.g., '新建{{object}}' in Chinese)
  - `form.editTitle` — Form dialog edit title with interpolation
  - `form.createDescription` — Form dialog create description with interpolation
  - `form.editDescription` — Form dialog edit description with interpolation
  - `form.saveRecord` — Save record button text

- **Safe translation hook for field widgets** (`@object-ui/fields`): Added `useFieldTranslation` hook that provides fallback to English defaults when no `I18nProvider` is available, following the same pattern as `useDetailTranslation` in `@object-ui/plugin-detail`.

### Fixed

- **ObjectView ChatterPanel test assertion mismatch** (`apps/console`): Fixed the failing CI test in `ObjectView.test.tsx` where the RecordChatterPanel drawer test used `getByLabelText('Show discussion')` but the actual aria-label rendered by the component is `'Show Discussion (0)'` (from the i18n default translation `detail.showDiscussion` with count parameter). Updated the test assertion to match the correct aria-label.

### Changed

- **Upgrade @objectstack packages from v3.2.9 to v3.3.0**: Upgraded all `@objectstack/*` dependencies across the entire monorepo (root, `apps/console`, `examples/crm`, `examples/todo`, `examples/msw-todo`, `examples/kitchen-sink`, `packages/core`, `packages/types`, `packages/react`, `packages/data-objectstack`, `packages/plugin-map`, `packages/plugin-gantt`, `packages/plugin-timeline`) from `^3.2.9` to `^3.3.0`. All 42 build tasks pass and all 7,224 tests pass with no breaking changes.

### Added

- **Standardized List Refresh After Mutation (P0/P1/P2)** (`@object-ui/types`, `@object-ui/plugin-list`, `@object-ui/plugin-view`, `@object-ui/plugin-kanban`, `@object-ui/plugin-calendar`, `@object-ui/react`, `@object-ui/core`, `apps/console`): Resolved a platform-level architectural deficiency where list views did not refresh after create/update/delete mutations. The fix spans three phases:
  - **P0 — refreshTrigger Prop**: Added `refreshTrigger?: number` to `ListViewSchema`. When a parent component (e.g., `ObjectView`) increments this value after a mutation, `ListView` automatically re-fetches data. The plugin-view's `ObjectView.renderContent()` now passes its internal `refreshKey` as both a direct callback prop and embedded in the schema's `refreshTrigger`. The console `ObjectView` combines both its own and the plugin's refresh signals for full propagation.
  - **P1 — Imperative `refresh()` API + `useDataRefresh` hook**: `ListView` is now wrapped with `React.forwardRef` and exposes a `refresh()` method via `useImperativeHandle`. Parents can trigger a re-fetch programmatically via `listRef.current?.refresh()`. Exported `ListViewHandle` type from `@object-ui/plugin-list`. Added reusable `useDataRefresh(dataSource, objectName)` hook to `@object-ui/react` that encapsulates the refreshKey state + `onMutation` subscription pattern for any view component.
  - **P2 — DataSource Mutation Event Bus**: Added `MutationEvent` interface and optional `onMutation(callback): unsubscribe` method to the `DataSource` interface. All data-bound views now auto-subscribe to mutation events when the DataSource implements this: `ListView`, `ObjectView` (plugin-view), `ObjectKanban` (plugin-kanban), and `ObjectCalendar` (plugin-calendar). `ValueDataSource` emits mutation events on create/update/delete. Includes 22 new tests covering all three phases.

- **Unified i18n Plugin Loading & Translation Injection** (`examples/crm`, `apps/console`): Unified the i18n loading mechanism so that both server and MSW/mock environments use the same translation pipeline. CRM's `objectstack.config.ts` now declares its translations via `i18n: { namespace: 'crm', translations: crmLocales }`. The shared config (`objectstack.shared.ts`) merges i18n bundles from all composed stacks. `createKernel` registers an i18n kernel service from the config bundles and auto-generates the `/api/v1/i18n/translations/:lang` MSW handler, returning translations in the standard `{ data: { locale, translations } }` spec envelope. Removed all manually-maintained i18n custom handlers and duplicate `loadAppLocale` functions from `browser.ts` and `server.ts`. The broker shim now supports `i18n.getTranslations` for server-side dispatch.

- **ObjectDataTable: columns now support `string[]` shorthand** (`@object-ui/plugin-dashboard`): `ObjectDataTable` now normalizes `columns` entries so that both `string[]` (e.g. `['name', 'close_date']`) and `object[]` formats are accepted. String entries are automatically converted to `{ header, accessorKey }` objects with title-cased headers derived from snake_case and camelCase field names. Previously, passing a `string[]` caused the downstream `data-table` renderer to crash when accessing `col.accessorKey` on a plain string. Mixed arrays (some strings, some objects) are also handled correctly. Includes 8 new unit tests.

### Fixed

- **i18n Kernel Service `getTranslations` Returns Wrong Format** (`apps/console`): Fixed the `createKernel` i18n service registration where `getTranslations` returned a wrapped `{ locale, translations }` object instead of the flat `Record<string, any>` dictionary expected by the spec's `II18nService` interface. The HttpDispatcher wraps the service return value in `{ data: { locale, translations } }`, so the extra wrapping caused translations to be empty or double-nested in the API response (`/api/v1/i18n/translations/:lang`). The service now returns `resolveI18nTranslations(bundles, lang)` directly, aligning with the spec and making CRM business translations work correctly in all environments (MSW, server, dev).

- **i18n Translations Empty in Server Mode (`pnpm start`)** (`apps/console`): Fixed translations returning `{}` when running the real ObjectStack server on port 3000. The root cause was that the CLI's `isHostConfig()` function detects plugins with `init` methods in the config's `plugins` array and treats it as a "host config" — **skipping auto-registration of `AppPlugin`**. Without `AppPlugin`, the config's translations, objects, and seed data were never loaded. Additionally, the kernel's memory i18n fallback is only auto-registered in `validateSystemRequirements()` (after all plugin starts), too late for `AppPlugin.start()` → `loadTranslations()`. Fixed by: (1) explicitly adding `AppPlugin(sharedConfig)` to `objectstack.config.ts` plugins, and (2) adding `MemoryI18nPlugin` before it to register the i18n service during init phase. Also added a spec-format `translations` array to `objectstack.shared.ts` so `AppPlugin.loadTranslations()` can iterate and load the CRM locale bundles.

- **i18n Translations Empty in Root Dev Mode (`pnpm dev`)** (root `objectstack.config.ts`): Fixed translations returning `{}` when running `pnpm dev` from the monorepo root. The root config uses `objectstack dev` → `objectstack serve --dev` which loads the root `objectstack.config.ts` — but this config did not aggregate i18n bundles from the example stacks (CRM, Todo, etc.). The `composeStacks()` function doesn't handle the custom `i18n` field, so translation data was lost during composition. Fixed by: (1) aggregating i18n bundles from all plugin configs (same pattern as `objectstack.shared.ts`), (2) building a spec-format `translations` array passed to `AppPlugin(mergedApp)`, and (3) adding `MemoryI18nPlugin` to register the i18n service during init phase.

- **Duplicate Data in Calendar and Kanban Views** (`@object-ui/plugin-view`, `@object-ui/plugin-kanban`, `@object-ui/plugin-list`): Fixed a bug where Calendar and Kanban views displayed every record twice. The root cause was that `ObjectView` (plugin-view) unconditionally fetched data even when a `renderListView` callback was provided — causing parallel duplicate requests since `ListView` (plugin-list) independently fetches its own data. The duplicate fetch results triggered re-renders that destabilised child component rendering, leading to duplicate events in the calendar and duplicate cards on the kanban board. Additionally, `ObjectKanban` lacked proper external-data handling (`data`/`loading` props with `hasExternalData` guard), unlike `ObjectCalendar` which already had this pattern. Fixes: (1) `ObjectView` now skips its own fetch when `renderListView` is provided, (2) `ObjectKanban` now accepts explicit `data`/`loading` props and skips internal fetch when external data is supplied (matching `ObjectCalendar`'s pattern), (3) `ListView` now handles `{ value: [] }` OData response format consistently with `extractRecords` utility. Includes regression tests.

- **CI Build Fix: Replace dynamic `require()` with static imports** (`@object-ui/plugin-view`): Replaced module-level `require('@object-ui/react')` calls in `index.tsx` and `ObjectView.tsx` with static `import` statements. The dynamic `require()` pattern is not supported by Next.js Turbopack, causing the docs site build to fail during SSR prerendering of the `/docs/components/complex/view-switcher` page with `Error: dynamic usage of require is not supported`. Since `@object-ui/react` is already a declared dependency and other files in the package use static imports from it, replacing the `require()` with static imports is safe and eliminates the SSR compatibility issue.

- **CI Build Fix: Remove unused `...rest` parameter** (`@object-ui/plugin-calendar`): Removed unused `...rest` destructured parameter from `ObjectCalendar` component props (TS6133), which caused the declaration file generation to emit a TypeScript error during the build.

- **CI Build Fix: Unused Parameters in Test Mocks** (`apps/console`): Fixed TypeScript `noUnusedParameters` errors (TS6133) in `ListToolbarActions.test.tsx` where mock component `props` parameters were declared but never used in `@object-ui/plugin-kanban` and `@object-ui/plugin-calendar` mocks, causing the console `tsc` build step to fail in CI.

- **i18n loadLanguage Not Compatible with Spec REST API Response Format** (`apps/console`): Fixed `loadLanguage` in `apps/console/src/main.tsx` to correctly unwrap the `@objectstack/spec` REST API envelope `{ data: { locale, translations } }`. Previously, the function returned the raw JSON response, which meant `useObjectLabel` and `useObjectTranslation` hooks received a wrapped object instead of the flat translation map, causing business object and field labels (e.g., CRM contact/account) to fall back to English. The fix extracts `data.translations` when the spec envelope is detected, while preserving backward compatibility with mock/dev environments that return flat translation objects. Includes 6 unit tests covering spec envelope unwrapping, flat fallback, HTTP errors, network failures, and edge cases.

- **List Toolbar Action Buttons Not Responding** (`apps/console`): Fixed a bug where schema-driven action buttons in the upper-right corner of the list view (rendered via `action:bar` with `locations: ['list_toolbar']`) did not respond to clicks. The root cause: the console `ObjectView` component rendered these action buttons via `SchemaRenderer` without wrapping them in an `ActionProvider`. This caused `useAction()` to fall back to a local `ActionRunner` with no handlers, toast, confirmation, or navigation capabilities — so clicks executed silently with no visible effect. Added `ActionProvider` with proper handlers (toast via Sonner, confirmation dialog, navigation via React Router, param collection dialog, and a generic API handler) to the console `ObjectView`, following the same pattern already used in `RecordDetailView`. Includes 4 new integration tests validating the full action chain (render, confirm, execute, cancel).

- **CRM Seed Data Lookup References** (`examples/crm`): Fixed all CRM seed data files to use natural key (`name`) references for lookup fields instead of raw `id` values. The `SeedLoaderService` resolves foreign key references by the target object's `name` field (the default `externalId`), so seed data values like `order: "o1"` or `account: "2"` could not be resolved and were set to `null`. Updated all 8 affected data files (`account`, `contact`, `opportunity`, `order`, `order_item`, `opportunity_contact`, `project_task`, `event`) to use human-readable name references (e.g., `order: "ORD-2024-001"`, `product: "Workstation Pro Laptop"`, `account: "Salesforce Tower"`). This fixes the issue where Order and Product columns displayed as empty in the Order Item grid view.

### Added

- **Lookup Field Selection Display Fix** (`@object-ui/fields`): Fixed a bug where selecting a record from the RecordPickerDialog (Level 2 popup) produced no visible feedback in the LookupField. The root cause: `findOption` only searched static and popover-fetched options, which did not include records loaded by the dialog. Added `onSelectRecords` callback to `RecordPickerDialogProps` that returns full record objects alongside IDs. LookupField now caches selected records from the dialog and displays their labels/badges correctly. Both single-select and multi-select modes are supported. Includes a `selectedRecordsMap` ref in RecordPickerDialog that persists selected record data across page navigation for multi-select scenarios.

- **RecordPickerDialog UI/UX Overhaul** (`@object-ui/fields`): Major enterprise-grade improvements referencing mainstream low-code platforms:
  - **Skeleton Loading Screen**: Replaced simple spinner with a table-shaped skeleton screen during initial data load, matching the column layout for a polished loading experience.
  - **Sticky Table Header**: Table header now sticks to the top during vertical scroll, keeping column labels visible at all times.
  - **Loading Overlay**: Subsequent data fetches (page navigation, sorting, filtering) show a semi-transparent overlay with spinner over the existing data, preventing layout jank.
  - **Page Jump Input**: New input field in pagination bar allows users to type a page number and press Enter to jump directly to any page.
  - **Enhanced Search Bar**: Redesigned with a subtle background container and borderless input for a cleaner, more modern appearance.
  - **Improved Table Styling**: Even/odd row striping (`bg-muted/20`), refined selected-row highlighting (`bg-primary/5`), uppercase column headers with tighter tracking, rounded table border, and improved cell padding.
  - **Responsive Dialog**: Responsive dialog sizing from `sm:max-w-3xl` to `lg:max-w-5xl` for optimal data density across screen sizes; filter panel supports 3-column layout on wide viewports (`lg:grid-cols-3`).
  - **Fixed Close-Reset Cycle**: Separated dialog close-reset logic into its own `useEffect` (depends only on `open`) to prevent cascading state updates that could trigger React Error #185 (Maximum update depth exceeded) when selecting a record.
  - **8 New Unit Tests**: Comprehensive test coverage for skeleton loading (column count validation), sticky header classes, page jump navigation (valid/invalid/single-page), and loading overlay behavior.

- **"Browse All" Button for Lookup Fields** (`@object-ui/fields`): Added an always-visible "Browse All" (table icon) button next to the Lookup quick-select trigger. Opens the full RecordPickerDialog directly, regardless of record count — making enterprise features (multi-column table, sort/filter bar, cell renderers) discoverable at all times. Previously, the dialog was only accessible via the "Show All Results" in-popover button, which only appeared when total records exceeded the page size. The button uses accessible `aria-label`, `title`, and Lucide `TableProperties` icon. Keyboard and screen reader accessible.
- **CRM Enterprise Lookup Metadata** (`examples/crm`): All 14 lookup fields across 8 CRM objects now have enterprise-grade RecordPicker configuration — `lookup_columns` (with type hints for cell rendering: select, currency, boolean, date, number, percent), `lookup_filters` (base business filters using eq/ne/in/notIn operators), and `description_field`. Uses post-create `Object.assign` injection pattern to bypass `ObjectSchema.create()` Zod stripping (analogous to the listViews passthrough approach).
- **Enterprise Lookup Tests** (`examples/crm`): 12 new test cases validating lookup_columns presence & type diversity, lookup_filters operator validity, description_field coverage, and specific business logic (e.g., active-only users, non-cancelled orders, open opportunities).
- **RecordPickerDialog Component** (`@object-ui/fields`): New enterprise-grade record selection dialog with multi-column table display, pagination, search, column sorting with `$orderby`, keyboard navigation (Arrow keys + Enter), loading/error/empty states, and single/multi-select support. Responsive layout with mobile-friendly width. Provides the foundation for Salesforce-style Lookup experience.
- **LookupField Popover Typeahead** (`@object-ui/fields`): Level 1 quick-select upgraded from Dialog to Popover for inline typeahead experience (anchored dropdown, not modal). Includes "Show All Results" footer button that opens the full RecordPickerDialog (Level 2).
- **LookupFieldMetadata Schema Enhancement** (`@object-ui/types`): Added `lookup_columns`, `description_field`, `lookup_page_size`, `lookup_filters` to `LookupFieldMetadata`. New `LookupColumnDef` interface with `type` hint for cell formatting. New `LookupFilterDef` interface for base filter configuration.

### Changed

- **@objectstack v3.2.6 Upgrade**: Upgraded all `@objectstack/*` packages from `^3.2.5` to `^3.2.6` across 13 package.json files (43 references)
- **@objectstack v3.0.4 Upgrade**: Upgraded all `@objectstack/*` packages from `^3.0.2` to `^3.0.4` across 42 references
- **@objectstack v3.0.0 Upgrade**: Upgraded all `@objectstack/*` packages from `^2.0.7` to `^3.0.0` across 13 package.json files
- **Breaking change migrations**:
  - `Hub` namespace → `Cloud` in @object-ui/types re-exports
  - `definePlugin` removed (only `defineStack` remains)
  - `PaginatedResult.value` → `.records` across all data plugins and adapters
  - `PaginatedResult.count` → `.total` in data-objectstack adapter
  - `client.meta.getObject()` → `client.meta.getItem('object', name)` in data adapter
- Updated spec version references across ROADMAP.md, SPEC_COMPLIANCE_EVALUATION.md, OBJECTSTACK_CLIENT_EVALUATION.md, and console docs
- Updated ROADMAP with v3.0.0 migration table and next phase roadmap (N.1-N.5)
- Updated namespace-exports tests to reflect v3.0.0 exports

### Added

- **Preview Mode** (`@object-ui/auth`): New `previewMode` prop on `AuthProvider` for auto-login with simulated identity — skip login/registration for marketplace demos and app showcases. Includes `PreviewBanner` component, `isPreviewMode` / `previewMode` on `useAuth()`, and `PreviewModeOptions` type. Aligns with `@objectstack/spec` kernel `PreviewModeConfig`.
- **Discovery Preview Detection** (`@object-ui/react`): Extended `DiscoveryInfo` with `mode` and `previewMode` fields for server-driven preview mode detection.
- **Console Preview Support**: `ConditionalAuthWrapper` auto-detects `mode === 'preview'` from server discovery and configures auth accordingly.
- **Console Bundle Optimization**: Split monolithic 3.7 MB main chunk into 17 granular cacheable chunks via `manualChunks` — main entry reduced from 1,008 KB gzip to 48.5 KB gzip (95% reduction)
- **Gzip + Brotli Compression**: Pre-compressed assets via `vite-plugin-compression2` — Brotli main entry at 40 KB
- **Bundle Analysis**: Added `rollup-plugin-visualizer` generating interactive treemap at `dist/stats.html`; new `build:analyze` script
- **Lazy MSW Loading**: MSW mock server now loaded via dynamic `import()` — fully excluded from `build:server` output (~150 KB gzip saved)
- **ROADMAP Console v1.0 Section**: Added production release optimization roadmap with detailed before/after metrics

---

## [0.3.1] - 2026-01-27

### Changed

- Maintenance release - Documentation and build improvements
- Updated internal dependencies across all packages

---

## [0.3.0] - 2026-01-17

### Added

- **New Plugin**: `@object-ui/plugin-object` - ObjectQL plugin for automatic table and form generation
  - `ObjectTable`: Auto-generates tables from ObjectQL object schemas
  - `ObjectForm`: Auto-generates forms from ObjectQL object schemas with create/edit/view modes
  - Full TypeScript support with comprehensive type definitions
- **Type Definitions**: Added `ObjectTableSchema` and `ObjectFormSchema` to `@object-ui/types`
- **ObjectQL Integration**: Enhanced `ObjectQLDataSource` with `getObjectSchema()` method using MetadataApiClient

### Changed

- Updated `@objectql/sdk` from ^1.8.3 to ^1.9.1
- Updated `@objectql/types` from ^1.8.3 to ^1.9.1

---

## [0.2.1] - 2026-01-15

### Changed

- Fixed changeset configuration to remove non-existent @apps/* pattern
- Added automated changeset-based version management and release workflow
- Enhanced CI/CD workflows with GitHub Actions
- Improved documentation for contributing and releasing

## [0.2.0] - 2026-01-15

### Added

- Comprehensive test suite using Vitest and React Testing Library
- Test coverage for @object-ui/core, @object-ui/react, @object-ui/components, and @object-ui/designer packages
- GitHub Actions CI/CD workflows:
  - CI workflow for automated testing, linting, and building
  - Release workflow for publishing new versions
- Test coverage reporting with @vitest/coverage-v8
- Contributing guidelines (CONTRIBUTING.md)
- Documentation for testing and development workflow in README
- README files for all core packages

### Changed

- Updated package.json scripts to use Vitest instead of placeholder test commands
- Enhanced README with testing instructions and CI status badges

## [0.1.0] - Initial Release

### Added

- Core packages:
  - @object-ui/core - Core logic, types, and validation (Zero React dependencies)
  - @object-ui/react - React bindings and SchemaRenderer component
  - @object-ui/components - Standard UI components built with Tailwind CSS & Shadcn
  - @object-ui/designer - Drag-and-drop visual editor
- Monorepo structure using pnpm workspaces
- Basic TypeScript configuration
- Example applications in the examples directory
- Complete documentation site with VitePress

[0.3.0]: https://github.com/objectstack-ai/objectui/releases/tag/v0.3.0
[0.2.1]: https://github.com/objectstack-ai/objectui/releases/tag/v0.2.1
[0.2.0]: https://github.com/objectstack-ai/objectui/releases/tag/v0.2.0
[0.1.0]: https://github.com/objectstack-ai/objectui/releases/tag/v0.1.0

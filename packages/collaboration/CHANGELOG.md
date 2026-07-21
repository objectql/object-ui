# @object-ui/collaboration

## 16.1.0

### Patch Changes

- ebe6494: chore(lint): clear the baseline lint errors in nine more packages (objectui#2713 Wave 2)

  Second wave of the #2713 lint-gate restoration (after #2730). These nine package
  lints were red at baseline on `main`, so their per-package `lint` gate could not
  catch new violations. Cleared every **error** (no behavior change; warnings out
  of scope):

  - **`react-hooks/rules-of-hooks`** (`i18n`, `plugin-grid`, `plugin-view`,
    `plugin-list`) — translation helpers (`useSafeFieldLabel`,
    `useRowActionTranslation`, `useViewLabel`, `useViewTabLabel`, `useMoreLabel`)
    wrapped a provider-safe hook (`useObjectTranslation`/`useObjectLabel`, which
    never throw) in try/catch; removed the wrapper (the same fix #2709 applied in
    fields). `plugin-kanban` `ObjectKanban` moved its `if (error)` early return
    below the `useCallback` so hooks run unconditionally. `collaboration`
    `__unsafe_usePresenceContext` keeps its deliberate danger-prefix name via a
    justified scoped disable.
  - **`react-hooks/static-components`** (`layout`, `plugin-list`, `plugin-report`)
    — dynamic-icon / registry lookups (`resolveIcon`, `useRegistryComponent`) are
    stable component references, not components created during render → scoped
    disable with justification. `plugin-charts` `TreemapCell` was a _genuine_
    inline component and is hoisted to module scope (it is purely props-driven).
  - **`no-irregular-whitespace`** (`plugin-grid` `ImportWizard`) — the literal
    U+FEFF BOM prepended to exported CSV/text blobs (so Excel detects UTF-8) is
    now written as the `﻿` escape: byte-identical at runtime, no literal
    irregular-whitespace character in source.
  - **`no-useless-assignment`** (`plugin-grid` `BulkActionDialog`) — dropped a
    dead `= null` initializer that the exhaustive `switch` (incl. `default`)
    overwrites before it is read.
  - **`no-unsafe-function-type`** (`plugin-view` `ViewTabBar`) — the dnd-kit
    render-prop `listeners` map is typed `Record<string, (...args: any[]) => void>`
    instead of bare `Function`.
  - **`no-require-imports`** (`plugin-kanban`, `plugin-view` tests) — hoisted
    `vi.mock` factories use an `async` factory with `await import('react')`.

- Updated dependencies [7cf4051]
- Updated dependencies [94d4876]
- Updated dependencies [2b17339]
- Updated dependencies [31b77d4]
- Updated dependencies [6d4fbe6]
- Updated dependencies [62b9ab5]
- Updated dependencies [29c6040]
- Updated dependencies [faebac3]
- Updated dependencies [199fa83]
  - @object-ui/types@16.1.0

## 16.0.0

### Patch Changes

- Updated dependencies [210806a]
- Updated dependencies [b4ef588]
- Updated dependencies [5534535]
- Updated dependencies [9b8f978]
  - @object-ui/types@16.0.0

## 15.0.0

### Patch Changes

- @object-ui/types@15.0.0

## 14.1.0

### Patch Changes

- Updated dependencies [2ded18c]
- Updated dependencies [e628d1f]
- Updated dependencies [887062c]
- Updated dependencies [9e2d58f]
- Updated dependencies [d5b1bc0]
- Updated dependencies [f0f10f5]
  - @object-ui/types@14.1.0

## 14.0.0

### Patch Changes

- Updated dependencies [86c69c3]
- Updated dependencies [6a74160]
  - @object-ui/types@14.0.0

## 13.2.0

### Patch Changes

- @object-ui/types@13.2.0

## 13.1.0

### Patch Changes

- @object-ui/types@13.1.0

## 13.0.0

### Patch Changes

- Updated dependencies [619097e]
  - @object-ui/types@13.0.0

## 12.1.0

### Patch Changes

- Updated dependencies [c31874d]
  - @object-ui/types@12.1.0

## 12.0.0

### Patch Changes

- Updated dependencies [226fde9]
- Updated dependencies [e4de456]
  - @object-ui/types@12.0.0

## 11.5.0

### Patch Changes

- Updated dependencies [9255686]
- Updated dependencies [1072701]
  - @object-ui/types@11.5.0

## 11.4.0

### Patch Changes

- Updated dependencies [8bf6295]
- Updated dependencies [1948c5b]
- Updated dependencies [c38d107]
  - @object-ui/types@11.4.0

## 11.3.0

### Patch Changes

- @object-ui/types@11.3.0

## 11.2.0

### Patch Changes

- @object-ui/types@11.2.0

## 11.1.0

### Patch Changes

- @object-ui/types@11.1.0

## 7.3.0

### Patch Changes

- @object-ui/types@7.3.0

## 7.2.0

### Patch Changes

- Updated dependencies [d23db5c]
  - @object-ui/types@7.2.0

## 7.1.0

### Patch Changes

- Updated dependencies [677f7ed]
- Updated dependencies [a71be60]
- Updated dependencies [cb03bc3]
  - @object-ui/types@7.1.0

## 7.0.0

### Patch Changes

- Updated dependencies [ddbe4a2]
- Updated dependencies [9049bbe]
- Updated dependencies [cb2fdb1]
- Updated dependencies [6cfa330]
- Updated dependencies [ad8ade6]
- Updated dependencies [3870c20]
- Updated dependencies [b88c560]
- Updated dependencies [d16566f]
- Updated dependencies [300d755]
- Updated dependencies [4eb9cb6]
- Updated dependencies [858ad94]
  - @object-ui/types@7.0.0

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3

## 6.2.2

### Patch Changes

- @object-ui/types@6.2.2

## 6.2.1

### Patch Changes

- @object-ui/types@6.2.1

## 6.2.0

### Patch Changes

- @object-ui/types@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/types@6.1.0

## 6.0.4

### Patch Changes

- @object-ui/types@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1

## 5.2.0

### Minor Changes

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

- Updated dependencies [de0c5e6]
- Updated dependencies [9997cae]
- Updated dependencies [70b5570]
  - @object-ui/types@5.2.0

## 5.1.1

### Patch Changes

- @object-ui/types@5.1.1

## 5.1.0

### Patch Changes

- Updated dependencies [cf30cc2]
- Updated dependencies [5b80cfd]
  - @object-ui/types@5.1.0

## 5.0.2

### Patch Changes

- @object-ui/types@5.0.2

## 5.0.1

### Patch Changes

- @object-ui/types@5.0.1

## 5.0.0

### Patch Changes

- Updated dependencies [7213027]
  - @object-ui/types@5.0.0

## 4.8.0

### Patch Changes

- @object-ui/types@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0

## 4.6.0

### Patch Changes

- @object-ui/types@4.6.0

## 4.5.0

### Patch Changes

- Updated dependencies [ab5e281]
  - @object-ui/types@4.5.0

## 4.4.0

### Patch Changes

- @object-ui/types@4.4.0

## 4.3.1

### Patch Changes

- @object-ui/types@4.3.1

## 4.3.0

### Patch Changes

- @object-ui/types@4.3.0

## 4.2.1

### Patch Changes

- @object-ui/types@4.2.1

## 4.2.0

### Patch Changes

- @object-ui/types@4.2.0

## 4.1.0

### Patch Changes

- @object-ui/types@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12

## 4.0.11

### Patch Changes

- @object-ui/types@4.0.11

## 4.0.10

### Patch Changes

- @object-ui/types@4.0.10

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9

## 4.0.8

### Patch Changes

- @object-ui/types@4.0.8

## 4.0.7

### Patch Changes

- @object-ui/types@4.0.7

## 4.0.6

### Patch Changes

- @object-ui/types@4.0.6

## 4.0.5

### Patch Changes

- @object-ui/types@4.0.5

## 4.0.4

### Patch Changes

- @object-ui/types@4.0.4

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

- Updated dependencies [4be43e2]
  - @object-ui/types@4.0.3

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0

## 3.4.0

### Patch Changes

- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
  - @object-ui/types@3.4.0

## 3.3.2

### Patch Changes

- @object-ui/types@3.3.2

## 3.3.1

### Patch Changes

- @object-ui/types@3.3.1

## 3.3.0

### Patch Changes

- @object-ui/types@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0

## 3.1.5

### Patch Changes

- @object-ui/types@3.1.5

## 3.1.4

### Patch Changes

- @object-ui/types@3.1.4

## 3.1.3

### Patch Changes

- @object-ui/types@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1

## 3.0.3

### Patch Changes

- @object-ui/types@3.0.3

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2

## 3.0.1

### Patch Changes

- @object-ui/types@3.0.1

## 3.0.0

### Minor Changes

- 87979c3: Upgrade to @objectstack v3.0.0 and console bundle optimization
  - Upgraded all @objectstack/\* packages from ^2.0.7 to ^3.0.0
  - Breaking change migrations: Hub → Cloud namespace, definePlugin removed, PaginatedResult.value → .records, PaginatedResult.count → .total, client.meta.getObject() → client.meta.getItem()
  - Console bundle optimization: split monolithic 3.7 MB chunk into 17 granular cacheable chunks (95% main entry reduction)
  - Added gzip + brotli pre-compression via vite-plugin-compression2
  - Lazy MSW loading for build:server (~150 KB gzip saved)
  - Added bundle analysis with rollup-plugin-visualizer

### Patch Changes

- Updated dependencies [87979c3]
  - @object-ui/types@3.0.0

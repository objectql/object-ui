# @object-ui/mobile

## 17.4.0

### Minor Changes

- 48132f7: Track the `@objectstack` family at `17.0.0-rc.5` (objectui#3560).

  The pin moves from `^17.0.0-rc.2` to `^17.0.0-rc.5` across all 37 declarations in
  30 `package.json` files, and the sibling `@objectstack/*` packages (`client` /
  `formula` / `lint`) move with it — they pin `@objectstack/spec` **exactly**, so
  leaving them behind would keep a second copy of the spec in the tree and have
  `@objectstack/lint` validating against schemas that still accept the keys rc.3–rc.5
  retire. `pnpm-lock.yaml` now resolves one copy of each of the six family packages
  (`spec` / `client` / `core` / `formula` / `lint` / `sdui-parser`), all at rc.5.

  Bumping the pin and repairing the fallout cannot be split: the pin alone reddens
  CI, and the code alone targets a shape that is not in effect yet.

  ## A live bug this upgrade fixes

  **`ObjectStackDataSource.delete()` never emitted its mutation event, and resolved
  `undefined` instead of a boolean.** `@objectstack/client`'s `DeleteDataResult`
  declared a key called `deleted` — a key no schema has ever declared and no server
  path has ever returned on `DELETE /data/:object/:id`. So `result.deleted`
  compiled and read `undefined` at runtime: the guard never fired, a successful
  delete notified no subscriber, and every consumer's cache stayed stale.
  objectstack#5638 corrected the interface to the schema's `success`; following the
  rename is what restores both behaviours. Nothing in this repo had to change shape
  for it — the code was already asking the right question of the wrong key.

  ## Breaking, in FROM → TO form

  - **The five `@objectstack/spec/ui` interaction-config modules are gone** —
    touch / dnd / keyboard / animation / offline, 32 defs and 64 exports
    (objectstack#4988, PR objectstack#5321). None of them had an authoring door: no
    metadata document could ever carry one of these blocks, so a stack that parsed
    before the retirement parses byte-for-byte the same after it. `@object-ui/types`
    drops the 32 `export type` re-exports. The vocabulary each one's only real
    consumer needs is now declared by that consumer, which is the remedy the spec's
    own retirement ledger prescribes ("declare that union locally — it is your
    client's policy, not the platform's"):

    - `@object-ui/react`'s `useOffline` owns `OfflineStrategy`, `ConflictResolution`,
      `PersistStorageType`, `EvictionPolicyType`, `OfflineConfig`,
      `OfflineCacheConfig`, `OfflineSyncConfig`;
    - `@object-ui/core`'s `DndProtocol` / `KeyboardProtocol` own `DndConfig`,
      `DragItem`, `DropZone`, `DragConstraint`, `DragHandle`, `DropEffect`,
      `KeyboardNavigationConfig`, `KeyboardShortcut`, `FocusManagement`,
      `FocusTrapConfig`;
    - `@object-ui/types`' `mobile` module owns `SpecGestureConfig`,
      `SwipeGestureConfig`, `PinchGestureConfig`, `LongPressGestureConfig`,
      `TouchTargetConfig`, `TouchInteraction` (plus a new `SPEC_GESTURE_TYPES`
      runtime tuple), so `@object-ui/mobile`'s import paths are unchanged.

    Every shape is moved verbatim — same keys, same members, same optionality — so
    no hook or bridge changes behaviour. Consumers importing these names from
    `@object-ui/types` must import them from the owning package instead. Note the
    spec's _surviving_ `ConnectorConflictResolution` (`/integration`, connector sync)
    and `ConflictResolutionStrategy` (`/api`, route merge policy) are **different
    concepts** — do not re-point at them.

  - **`@object-ui/types` no longer re-exports `NotificationAction` or `EmbedConfig`**
    (objectstack#5015, PR objectstack#5300). Both were published `ui` vocabulary with
    no authoring door; no notification action was ever parsed from metadata and no
    iframe route ever read an embed config. The presentation enums
    (`NotificationType` / `NotificationSeverity` / `NotificationPosition`) and
    `SharingConfig` **survive** and are untouched — public form sharing still gates
    the anonymous endpoints on `allowAnonymous` + `publicLink`.
    `@object-ui/core`'s `SharingProtocol` keeps `resolveEmbedConfig` /
    `generateEmbedCode` against a locally declared `EmbedConfig`, so its surface is
    unchanged.
  - **`ThemeEngine` stops emitting nine retired CSS variable groups**
    (objectstack#5021 option 2, PR objectstack#5289). `theme.animation`,
    `theme.zIndex` and five typography groups (`fontSize` / `fontWeight` /
    `lineHeight` / `letterSpacing`, plus `fontFamily.heading` / `fontFamily.mono`)
    are tombstones the schema now rejects by name, so `--duration-*`, `--timing-*`,
    `--z-*`, `--font-size-*`, `--font-weight-*`, `--line-height-*`,
    `--letter-spacing-*`, `--font-heading` and `--font-mono` had become structurally
    dead code — no author could produce the input that reached them.
    `generateAnimationVars` and `generateZIndexVars` are removed from
    `@object-ui/core`, and `@object-ui/types` drops `Animation` / `ZIndex` /
    `AnimationSchema` / `ZIndexSchema`. **`theme.customVars` is the declared — and
    since #5021 the only — door**: each entry is emitted verbatim as
    `--<key>: <value>`, so a `--z-modal` or a `--duration-fast` goes there now.
    LIVE emission is untouched byte for byte: `colors`, `borderRadius`, `shadows`,
    `typography.fontFamily.base` (→ `--font-sans`) and `customVars`.
  - **`@object-ui/types`' `HttpMethodSchema` now binds the spec's
    `HttpMethodSubsetSchema`, and `HttpMethod` binds `HttpMethodSubset`**
    (objectstack#5832, PR objectstack#5976 — objectui#3499). The spec renamed its
    5-value UI subset because `schemaNameFromExportKey` strips the `Schema` suffix,
    so the 5-value and 7-value enums both published as `shared/HttpMethod` and the
    later write won — the emitted JSON Schema and reference page described only one
    of them. **The runtime domain is unchanged and this repo's exported names are
    unchanged**; this follows the rename without touching cross-package semantics.
    Deliberately NOT re-pointed at the spec's bare `HttpMethod`: that is the 7-value
    enum, and widening to it would let `method: 'HEAD'` compile and then throw in
    `HttpRequestSchema.parse()`.
  - **`dashboard.widgets[].actionUrl` / `actionType` / `actionIcon` / `aria` are
    refused, not stripped** (objectstack#5010, ADR-0049 enforce-or-remove). A
    dashboard widget has no action button and never had one — every action the
    dashboard dispatches comes from `header.actions[]` — and no renderer ever applied
    the widget `aria`, so it promised accessibility compliance it did not deliver.
    A stale dashboard now gets a named error telling it where the affordance moved,
    instead of silently losing it. Run `os migrate meta --from 16` to rewrite.

- e6fdbdc: Reclaim the natural names `GestureType` and `GestureConfig` (objectui#3363).

  `@objectstack/spec` 17.0.0-rc.3 deleted the whole `ui/touch` module
  (objectstack#4988, PR objectstack#5321), vacating three names objectui had
  renamed **away from** in objectstack#4115 purely to avoid a collision. Two of
  those workarounds have now outlived their reason and are undone.

  ## Breaking, in FROM → TO form

  - `TouchGestureType` → **`GestureType`** — objectui's direction-fused recogniser
    vocabulary (`tap`, `swipe-left`, `swipe-up`, …).
  - `TouchGestureConfig` → **`GestureConfig`** — the flat gesture→`action` handler
    binding.

  Both are exported from `@object-ui/types` and re-exported by `@object-ui/mobile`.
  Nothing about either shape changed: same members, same optionality. Consumers
  import the new name; there is no other edit.

  **The old names are gone, not deprecated.** This follows the precedent set by the
  objectstack#4115 rename batch that introduced them, whose own migration note reads:
  "an alias would preserve exactly the ambiguity being removed". A deprecated alias
  would be worse here than in the general case, because the ambiguity these renames
  exist to prevent is between two same-named types — leaving `TouchGestureType`
  alive next to `GestureType` restores the two-spellings-one-concept problem while
  claiming to retire it.

  The retired spec vocabulary that used to hold these names still lives in
  `@object-ui/types`' `mobile` module under its deliberate `Spec…` prefix
  (`SpecGestureType`, `SpecGestureConfig`, `SwipeGestureConfig`, …), and that prefix
  is untouched — it is now the only thing distinguishing the two contracts, so
  `useSpecGesture` still maps one onto the other exactly as before.

  ## `PWAOfflineConfig` is deliberately NOT reclaimed

  The spec vacated `OfflineConfig` in the same retirement, but the spec was never
  its only claimant: that rename was a **cross-package arbitration between two
  objectui packages**, and `@object-ui/react` won it. `useOffline`'s config is the
  offline data/sync model key for key, so it holds the bare `OfflineConfig`, while
  this package's service-worker route cache stays `PWAOfflineConfig`
  (objectui#3156 / objectui#3159).

  Before objectui#3560 that name reached `@object-ui/react` from the spec, so the
  spec-side tripwire covered it by accident. Since the retirement it is declared
  locally in `packages/react/src/hooks/useOffline.ts`, which means the spec's
  vacancy no longer says anything about whether the name is free — it is not.
  Reclaiming it would put two different `OfflineConfig` shapes on the public
  surface of two packages that are routinely imported together, which is the exact
  ambiguity objectstack#4115 renamed it away from.

  `page-nav-misc-spec-parity.test.ts` now pins that reason directly instead of
  leaving it as prose: it asserts `@object-ui/react` still declares
  `OfflineConfig`, and its failure message tells the next reader that the reclaim
  has become available if it ever stops.

### Patch Changes

- Updated dependencies [d229dfa]
- Updated dependencies [c2fd122]
- Updated dependencies [48132f7]
- Updated dependencies [7e5bb5d]
- Updated dependencies [e6fdbdc]
- Updated dependencies [7e2b7e9]
- Updated dependencies [c1e1e6b]
  - @object-ui/types@17.4.0

## 17.3.0

### Patch Changes

- Updated dependencies [d915c47]
- Updated dependencies [9e9e9a9]
- Updated dependencies [23018cc]
- Updated dependencies [f44d872]
- Updated dependencies [f833d3a]
- Updated dependencies [d22ae31]
  - @object-ui/types@17.3.0

## 17.2.0

### Minor Changes

- 726b89c: `@object-ui/types` stops declaring sixteen symbols under names `@objectstack/spec` owns (objectui#3156, objectstack#4115).

  Seven are now **derived** from the spec, nine are **renamed** to the local
  dialect they always were. Both halves remove the same hazard: a local
  declaration under a spec export's name reads as the spec's own definition to
  the next reader, so a copy that is merely _correct today_ is a planted premise
  tomorrow.

  **Derived** — the spec now supplies the keys, by reference:

  | symbol                   | derivation                                                                        |
  | :----------------------- | :-------------------------------------------------------------------------------- |
  | `ActionParam`            | `z.input<typeof ActionParamSchema>`, `type` widened to the local legacy spellings |
  | `CreateExportJobRequest` | `Omit<CreateExportJobInput, 'object'>` (`object` is the method argument)          |
  | `CreateExportJobResult`  | re-export from `@objectstack/spec/contracts`                                      |
  | `ImportRowResult`        | re-export from `@objectstack/spec/api`                                            |
  | `NavigationArea`         | spec keys, with `navigation` / `visible` pinned locally                           |
  | `NavigationAreaSchema`   | `specFieldsExcept(NavigationAreaSchema.shape, …)`                                 |
  | `Theme`                  | re-export of the spec's `ThemeInput` (the authoring shape)                        |
  | `ExportJobFormat`        | re-export of the spec's `ExportFormat`                                            |

  Four of these close real gaps rather than tidy names. `ActionParam` never
  declared `reference` — the key `resolveActionParams()` actually reads for an
  inline lookup target — nor `defaultFromRow`, which the metadata designer's own
  inspector writes; it also narrowed `visible` to a bare string although the
  resolver has always accepted the `{ dialect, source }` envelope too.
  `CreateExportJobResult.createdAt` and `ImportRowResult.action` were optional
  here and required by the server, leaving every consumer a branch that could
  never run. And `NavigationArea`'s `id` now carries the spec's own length rule
  instead of accepting any string.

  **Renamed** — same word, different concept:

  | was                | now                      | why                                                                                                                            |
  | :----------------- | :----------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
  | `FileMetadata`     | `UploadedFileMetadata`   | field-VALUE payload (`url`, `original_name`), not the storage file record                                                      |
  | `GestureType`      | `TouchGestureType`       | direction-fused (`swipe-left`), not the spec's type+direction pair                                                             |
  | `GestureConfig`    | `TouchGestureConfig`     | gesture→`action` binding, not per-gesture tuning                                                                               |
  | `OfflineConfig`    | `PWAOfflineConfig`       | service-worker route caching, not the offline data/sync model                                                                  |
  | `PageRegion`       | `PageNodeRegion`         | region of the renderer page NODE, holding `SchemaNode`s                                                                        |
  | `PageRegionSchema` | `PageNodeRegionSchema`   | zod twin of the above                                                                                                          |
  | `ResponsiveConfig` | `MobileResponsiveConfig` | mobile box config, not the spec's SDUI grid contract                                                                           |
  | `WidgetManifest`   | `RuntimeWidgetManifest`  | SDUI component manifest, not the field-widget plugin manifest                                                                  |
  | `WidgetSource`     | `RuntimeWidgetSource`    | `module`/`inline`/`registry` loader union — and its `inline` carries a resolved component where the spec's carries source code |

  **Migration**: the old names are gone, not deprecated — an alias would preserve
  exactly the ambiguity being removed. Import the new name; nothing about the
  shapes changed. `@object-ui/types` already re-exports the spec's own
  `SpecResponsiveConfig`, and `@object-ui/react`'s `useOffline` config remains the
  spec-shaped `OfflineConfig`, so both concepts stay reachable under
  distinguishable names.

  Each rename carries a bidirectional tripwire
  (`packages/types/src/__tests__/page-nav-misc-spec-parity.test.ts`): it fails if
  the spec ever claims the new name, and also if the spec retires the old one —
  at which point the natural name can be taken back rather than the workaround
  outliving its reason.

### Patch Changes

- Updated dependencies [4ae0ac4]
- Updated dependencies [696e3c1]
- Updated dependencies [4bf612c]
- Updated dependencies [cb82705]
- Updated dependencies [f572849]
- Updated dependencies [444457c]
- Updated dependencies [022e4c3]
- Updated dependencies [009e25d]
- Updated dependencies [726b89c]
  - @object-ui/types@17.2.0

## 17.1.0

### Patch Changes

- Updated dependencies [9e7349e]
- Updated dependencies [8864971]
- Updated dependencies [b41f401]
- Updated dependencies [19e9fa0]
- Updated dependencies [38ca8be]
- Updated dependencies [4952edf]
- Updated dependencies [7f0252e]
- Updated dependencies [7639a61]
- Updated dependencies [94e63ef]
- Updated dependencies [c4db402]
- Updated dependencies [5319bf1]
- Updated dependencies [49e5671]
- Updated dependencies [b5b97e2]
- Updated dependencies [f59f2c1]
- Updated dependencies [4874117]
- Updated dependencies [ce08d55]
- Updated dependencies [2374a49]
- Updated dependencies [ea7f477]
- Updated dependencies [7f23cd0]
- Updated dependencies [24e0e0a]
- Updated dependencies [3a6cf24]
- Updated dependencies [aa35561]
- Updated dependencies [03bd53b]
- Updated dependencies [3c1f321]
- Updated dependencies [a045a32]
- Updated dependencies [912496d]
- Updated dependencies [9867281]
  - @object-ui/types@17.1.0

## 17.0.0

### Patch Changes

- Updated dependencies [1767124]
- Updated dependencies [8ecf5a6]
- Updated dependencies [dfd3705]
- Updated dependencies [6dee2cb]
- Updated dependencies [c7cff19]
- Updated dependencies [cd09a7b]
- Updated dependencies [f1abf0e]
- Updated dependencies [f05b84e]
- Updated dependencies [662bdf9]
- Updated dependencies [059a052]
- Updated dependencies [53642d4]
- Updated dependencies [8aae006]
- Updated dependencies [d147a13]
  - @object-ui/types@17.0.0

## 16.1.0

### Patch Changes

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

- a2d7023: End-user feature batch — forms, designer history, import/export, and PWA offline sync.

  **Forms (`@object-ui/fields`, `@object-ui/providers`)**

  - `FileField`: native `<input capture="environment">` camera capture for mobile devices, plus a uploading-progress indicator driven by `UploadProvider`.
  - `ImageField`: per-image inline crop/rotate via the lazy-loaded `ImageCropperDialog` (canvas-based, zero new deps).
  - New `UploadProvider` in `@object-ui/providers` with pluggable adapters for S3 and Azure Blob (plus the default object-URL adapter for local previews). XHR-based with progress, abort, and retry.
  - `LookupField`: `lookup.dependsOn: string | string[]` to chain dependent lookups (e.g. State depends on Country); the trigger is gated until parent values are present and the OData `$filter` is built automatically.

  **Container-aware widget widths (`@object-ui/components`)**

  - New `useResizeObserver(ref)` hook exposing `{ width, height }` of any element. SSR-safe; reads the initial size via `getBoundingClientRect`.
  - `plugin-gantt` and `plugin-kanban` now react to their container size instead of `window.innerWidth`, so they behave correctly inside split panels and dashboards.

  **Designer history (`@object-ui/plugin-designer`)**

  - `useUndoRedo` (and therefore `useDesignerHistory`) gains `persistKey` + `storage` options to round-trip the undo/redo stack through `sessionStorage`, plus a `clearPersisted()` cleanup helper. Drafts now survive accidental tab refreshes.
  - New `<HistoryPanel>` component renders the timeline visually with one-click jump-to-checkpoint via the new `jumpTo(index)` API.

  **Import wizard (`@object-ui/plugin-grid`)**

  - Saved column-mapping templates: name, save, re-apply, and delete via a new template bar in the mapping step. Persisted under `objectui:import-templates:${objectName}` (override via `templateStorageKey` / `templateStorage`).
  - Inline validation correction: cells with errors in the preview step are now editable; corrections feed straight into the import without requiring a re-upload, with green-bar status indicators for fixed rows.

  **PWA offline sync (`@object-ui/mobile`)**

  - New `MemoryOfflineQueue` / `IndexedDbOfflineQueue` (`createOfflineQueue()` picks the best backend) backed by IndexedDB.
  - `createOfflineDataSource(inner, { queue })` wraps any DataSource so mutations issued while offline (or that fail with a network-style error) are queued and replayed in order on reconnect. Includes `replay()`, `drop()`, `clear()`, `pending()`, an `onChange` notifier, and an opt-in `resolveConflict` hook for stale-write conflicts.
  - New `useOfflineSync(source)` hook exposes `{ isOnline, pending, isReplaying, replay, drop, clear }` and auto-replays on the browser's `online` event.
  - `getServiceWorkerSource(opts)` emits a customisable Service Worker that pre-caches the app shell, applies network-first to API requests, and broadcasts `REPLAY_QUEUE` to clients on Background Sync. `requestBackgroundSync(tag)` registers a one-shot sync from the page.

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

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

### Patch Changes

- Updated dependencies [b859617]
  - @object-ui/types@2.0.0

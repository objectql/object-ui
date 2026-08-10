---
"@object-ui/types": minor
"@object-ui/core": minor
"@object-ui/react": minor
"@object-ui/mobile": minor
"@object-ui/data-objectstack": minor
---

Track the `@objectstack` family at `17.0.0-rc.5` (objectui#3560).

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
  spec's *surviving* `ConnectorConflictResolution` (`/integration`, connector sync)
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

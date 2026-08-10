# @object-ui/data-objectstack

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

### Patch Changes

- 3765678: data-objectstack: pass the server's `drillRanges` date-bucket drill scope through `queryDataset` (restores date drill-through)

  `queryDataset` rebuilds its result by **hand-picking** keys off the REST payload,
  and `drillRanges` was never in the list — so the analytics service's date-range
  drill sidecar (framework#1752) was dropped by the only real adapter in this repo,
  while five consumer call sites were already reading it (`DatasetWidget.tsx:471`
  and `:593`, `DatasetReportRenderer.tsx:316`, `:431`, `:855`).

  The user-visible effect was not a degraded drill but a missing one. A
  `dateGranularity` dimension groups a **span** of records into one bucket, which
  equality filters cannot express, so `service-analytics` deliberately excludes
  date dimensions from `dimensionFields`/`drillRawRows` and sends a parallel
  half-open `[gte, lt)` range per row instead. For a chart or report grouped **only
  by time** that makes `drillRanges` the _only_ thing that can make
  `canDrill = !!object && (drillDims.length > 0 || !!drillRanges?.length)` true —
  with the key dropped, the entire drill entry point disappeared. A mixed
  date + non-date grouping kept its drill but built a filter with no time bound, so
  clicking June's bar opened every month (a superset).

  Neither side's tests could see it: the dashboard and report tests mock their own
  data source and feed `drillRanges` in directly, and the adapter's own suite never
  asserted the key. The new adapter-level tests therefore mock the **envelope the
  server actually sends** — bare (`res.json(result)`, no `{ success, data }`
  wrapper), carrying `sql`, and for a date-only grouping carrying `object` +
  `drillRanges` and _no_ `dimensionFields`/`drillRawRows` — then assert the key
  arrives verbatim and row-aligned, that the consumers' own `canDrill` predicate is
  true, and that `buildDatasetDrillFilter` (the shared builder both surfaces call)
  scopes the drilled list to the clicked bucket.

  The declared entry type is `@object-ui/core`'s `DatasetDrillRange` **by
  reference**, per the objectui#3613/#3752 discipline: it is the single in-repo
  declaration of this shape (what the filter builder accepts and what both
  renderers type their state with), and nothing in `@objectstack/spec` owns it yet,
  so restating `{ field, gte, lt }` locally would create a third dialect of it.

  `drillRawTotals` (the totals-row companion, framework#3214) is deliberately
  **not** added: it has zero consumers in this repo, so passing it through would
  add a declared-but-unexercised return key with no user-facing effect — it belongs
  in the change that lands a totals-row drill and can test it.

- d83f6b3: data-objectstack: type `queryDataset`'s result `fields[]` as the spec's `AnalyticsResult.fields[]` element instead of a hand-written copy

  The return-value half of the drift objectui#3613 fixed on the parameter side. The
  adapter hand-listed five keys for a result column
  (`name`/`type`/`label`/`format`/`currency`) and, like every restatement, stopped
  at the contract of the day it was written: it never grew **`percentScale`**,
  which `@objectstack/spec@17.0.0-rc.5` carries on
  `AnalyticsResult.fields[]` and documents as mandatory reading for renderers —
  "renderers that receive it must scale by it instead of guessing from the value"
  (objectui#3136).

  That omission was not cosmetic. `percentScale` is the server's answer to a
  question a `%` format string cannot express (is the stored number a 0–1 fraction,
  or already percentage points?), and objectui#3136 exists because guessing from
  the value's magnitude printed a ratio of exactly `1` as "1.0%". Three in-repo
  consumers read the field through their own local types
  (`DatasetResultField` in `@object-ui/core`), so nothing was red here — but any
  author reading columns through the adapter's **declared** return type got
  `Property 'percentScale' does not exist`, i.e. the declaration actively steered
  them back to the guess the spec bans.

  `fields` is now the spec type by reference, so there is nothing left to re-sync;
  the change is additive for existing consumers (one more optional key).
  `queryDataset.test.ts` pins structural identity with the spec element, pins
  `percentScale` as the `'fraction' | 'whole'` union rather than a widened
  `string`, keeps a negative pin against the five-key shape, and adds a runtime
  test that reads `percentScale` off a result column **through the declared type**.

  The rest of the envelope stays locally declared, deliberately. It is the REST
  envelope, not an `AnalyticsResult`: the route adds ADR-0021 D2 drill metadata
  (`object` / `dimensionFields` / `drillRawRows`) on top of the spec result, and
  this method rebuilds its own object from the payload without copying `sql` — so
  declaring the envelope as `AnalyticsResult & { … }` would advertise a key the
  adapter structurally cannot return. A pin records that too.

- 5f08c05: data-objectstack: type `queryDataset(selection)` as the spec's `DatasetSelection` instead of a hand-written copy

  The adapter restated the selection contract inline, field by field, and the copy
  had drifted three ways from the pinned `@objectstack/spec@17.0.0-rc.5`:

  - **`compareTo.dimension` was required.** It has been optional since
    objectstack#5011, _because the executor resolves it_: exactly one time
    dimension carrying a `dateRange` is the one shifted, and zero or several
    raises a loud error naming the candidates. Requiring it made the compiler
    demand from every typed caller precisely the consumer-side dimension guess
    that change forbids — trading a loud executor error for a silently wrong
    comparison window. No runtime path hit this yet (the dashboard's
    `DatasetWidget` passes `selection` as `unknown`), but a declaration is a live
    instruction to anyone calling this client from TypeScript.
  - **`timeDimensions` was widened to `unknown[]`**, erasing the very entry shape
    the executor's resolution reads (`{ dimension, granularity?, dateRange? }`),
    and **`runtimeFilter` to `Record<string, unknown>`**, erasing the
    `$and`/`$or`/`$not` vocabulary the server parses.
  - **`dateGranularity` was missing entirely** — the copy had simply stopped at
    whatever the contract looked like the day it was written, so a typed caller
    could not bucket a trend by month at all.

  The parameter is now the spec type by reference, so there is nothing left to
  re-sync. The fix is the removal of the dialect rather than a correction to it:
  restating a contract owned elsewhere creates a second de-facto dialect of it, and
  drift is then only a matter of time (AGENTS.md #0/#0.1). `queryDataset.test.ts`
  pins structural identity with `DatasetSelection` plus each of the three drifts
  individually, checked by this package's `tsc --noEmit`; a runtime test pins that
  a dimension-less `compareTo` reaches the server untouched, so the adapter can
  never start guessing on the executor's behalf.

  The response type is deliberately left alone — it is the REST envelope
  (`object` / `dimensionFields` / `drillRawRows`), not a restatement of
  `AnalyticsResult`.

- 41d6022: The console no longer reads `/meta/*` before it knows whether it has a session, and a failed request now says which request failed

  Opening a logged-out console painted ~30 red `HTTP request failed` lines before
  the login form was drawn. Two independent causes, fixed independently
  (objectui#4042).

  **1. Requests fired before the session was known.** `ConnectedShellInner` now
  withholds the metadata tree until `GET /auth/get-session` resolves, so
  `meta/object` / `meta/view` / `meta/app` are never issued blind. `useAuth()`
  outside an `AuthProvider` reports `isLoading: false`, so an embed with no auth
  provider is unaffected, and every protected route already sat behind an
  `AuthGuard` that resolves auth first — the signed-in data flow is unchanged.

  The console's landing route (`<Route path="/">`) was the actual entry point for
  the burst: it mounted `ConnectedShell` with no guard above it, so simply opening
  `/_console/` mounted the whole data layer as an anonymous visitor. It is now
  guarded, which also means an unauthenticated visitor reaches `/login` without a
  single doomed request. `examples/console-starter` had the same shape and got the
  same fix.

  **2. Two requests per type, per mount — not an unauthenticated artefact.**
  Consumers read metadata during the FIRST render (`useActionModal` reads
  `objects`, whose getter kicks `ensureType('object')` and `ensureType('view')`
  from the render phase), before any effect runs. `MetadataProvider`'s preview-mode
  effect then cleared the whole cache on mount, discarding those two entries while
  their requests were in flight; the next render found them `idle` and refetched
  both. The effect now skips its mount run — on mount the cache is empty and there
  was never anything to drop; it only ever meant something on a later
  `previewDrafts` change. That halved `meta/object` and `meta/view` on **every**
  mount, signed in included.

  A second duplicate only appeared once a read had failed: `entry.promise`
  collapses callers that arrive while a request is in flight, but callers arriving
  just after a failure each started a fresh attempt. A failed type now stays
  un-retried for ~1s, which collapses one mount's burst of callers into a single
  attempt. This is deliberately not the 5-minute `ttlMs` — later callers still
  retry on their own, and `refresh()` / `invalidate()` retry immediately and
  unconditionally, so no explicit recovery path changes.

  **3. `HTTP request failed` now identifies the request.** `@objectstack/client`
  reports every non-2xx as
  `logger.error("HTTP request failed", undefined, { method, url, status, error })`,
  and the console's logger forwarded that verbatim — so the identifying fields
  lived only in the third argument, and anything that flattens a console record to
  text rendered them `[object Object]` / `Object`. A screenful of failures could
  not tell you a single URL or status. The message string now carries them:

  ```text
  HTTP request failed: GET /api/v1/meta/object -> 401 [UNAUTHORIZED]
  ```

  The structured bag is still passed alongside for DevTools to expand — text for
  the flatteners, object for the inspectors, neither at the other's expense. The
  formatter is exported as `formatHttpFailureMessage`, and `createQuietHttpLogger`
  is now exported too so an app wiring its own `ObjectStackClient` gets the same
  identified failures.

  Nothing is newly silenced. The only demotion remains 404-on-an-optional-
  collection (`sys_presence`, `sys_activity`), which is an expected outcome of a
  request we still mean to make; a 401 that survives the session gate — a
  mid-session expiry, say — stays a visible, fully-identified error. The cure for
  doomed requests is not issuing them, never hiding them once issued.

- 7e2b7e9: Fix saved list-view preferences never reading back (density, column widths, sort, hidden columns, inline edit)

  `listViewOverrides` in the ObjectStack adapter enumerated `GET /api/v1/meta/{objectName}` — putting the object name in the metadata **type** slot — while `updateViewConfig` persists under `type='view'`. The two key spaces are disjoint, so the batch map came back empty for every object and every personalization a user saved on a list view was written to the server but never read back, showing up as "the setting didn't save".

  The read now enumerates `type='view'` once and narrows to the object client-side, through the same accessor `listViews()` uses over the same rows — the metadata index is name-only, so there is no server-side `?object=` filter to push it into.

  Second half: the batch read no longer swallows its own failures into an empty map. An empty map is an authoritative "this object has no overrides" and callers may still trust it and skip the per-view reads (the batch optimization is intact), but a transport failure now rejects, so the per-view `getView` fallback it was silently disabling becomes reachable again. `DataSource.listViewOverrides` documents both terms so other adapters implement the same contract.

- Updated dependencies [6719877]
- Updated dependencies [56ff091]
- Updated dependencies [d229dfa]
- Updated dependencies [4bc6c23]
- Updated dependencies [c3b01a7]
- Updated dependencies [e06810e]
- Updated dependencies [ab3ad4f]
- Updated dependencies [c2fd122]
- Updated dependencies [48132f7]
- Updated dependencies [1d723e3]
- Updated dependencies [0109f54]
- Updated dependencies [7e5bb5d]
- Updated dependencies [fbc23e0]
- Updated dependencies [e6fdbdc]
- Updated dependencies [6bb454a]
- Updated dependencies [523be48]
- Updated dependencies [7e2b7e9]
- Updated dependencies [c1e1e6b]
  - @object-ui/core@17.4.0
  - @object-ui/types@17.4.0

## 17.3.0

### Minor Changes

- d22ae31: Track `@objectstack/spec` 17.0.0-rc.2 (objectui#3235, #3208, #3287, #3264).

  The pin moves from `^17.0.0-rc.1` to `^17.0.0-rc.2` across the workspace, and
  the sibling `@objectstack/*` packages (`client` / `core` / `formula` / `lint`)
  move with it — they pin `@objectstack/spec` **exactly**, so leaving them behind
  kept a second copy of the spec in the tree and would have had `@objectstack/lint`
  validating against rc.1 schemas that still accept keys rc.2 retires.

  Breaking semantics, in FROM → TO form:

  - **`app.homePageId` is retired — an app's landing page is now its first
    navigation item.** An app that pinned a landing page with `homePageId` will
    open on the first reachable navigation entry (by `order`) instead; the root
    landing still follows `isDefault`. To restore a specific landing page, reorder
    `navigation` so the intended entry comes first. Stored metadata is migrated by
    `os migrate meta --from 16`. The key is a hard error now, not a stripped one:
    the spec ships a tombstone that names the migration.
    Upstream retired it because of its SHAPE, not its usage — it was an ID
    cross-reference with no referential integrity, so a `homePageId` that pointed
    at nothing silently fell back to the first navigation item anyway
    (objectstack#4667, premise corrected in #4709). If the capability returns, it
    returns as a flag on the navigation item itself, which cannot dangle.
  - **`@object-ui/types`' `HttpMethod` now resolves to the spec's
    `HttpMethodType`.** Shape is verbatim identical — the same 5-value UI subset —
    and `@object-ui/types` still exports it as `HttpMethod`, so no consumer
    changes. The spec renamed its `./ui` export because `HttpMethod` named two
    different types depending on the import path (`./shared` / `./api` carry a
    7-value enum including `HEAD` / `OPTIONS`); objectui deliberately keeps the
    5-value one (objectstack#4691).
  - **`AppContextSelector.includeAll` / `placement` are gone.** Neither ever did
    anything in this renderer: context selectors are mandatory-scope, so no "All"
    row was ever rendered, and `placement: 'topbar'` put nothing in the topbar.
    Both carried schema defaults, which is why the liveness lint structurally
    could not flag them — removal was the only channel that reaches an author
    (framework#4509).
  - **`NavigationArea.visible` / `order` / `requiredPermissions` are gone.** An
    area is a layout grouping, not an access boundary. Gating moved down to the
    navigation ITEM, where `visible` and `requiredPermissions` are unchanged and
    still enforced. `AppSchemaRenderer`'s area switcher no longer hides an area, so
    an area whose items are all gated away renders as visible-but-empty rather
    than disappearing.
  - **`@object-ui/core` no longer exports `NotificationProtocol`**
    (`resolveNotificationConfig`, `specNotificationToToast`, `mapSeverityToVariant`,
    `mapPosition`, `ToastNotification`). It bridged `@objectstack/spec/ui`'s
    `Notification` / `NotificationConfig`, which objectstack#4610 deleted with no
    successor. Use `resolveNotificationConfig` from `@object-ui/react`
    (`NotificationContext`), which owns the live `NotificationSystemConfig` and is
    what every notification surface already read. Note that the spec's _other_
    `Notification` — `@objectstack/spec/api` — is the REST inbox row, a different
    contract, and is deliberately NOT aliased in as a replacement.
  - **The `email_template` client-side validator now uses
    `EmailTemplateDefinitionSchema`.** It was pointing at the removed
    `EmailTemplateSchema`, so authored templates were being checked against the
    wrong contract: the live one is keyed `name` + `locale` (not `id`) and splits
    the body into `bodyHtml` / `bodyText` (not `body` + `bodyType`)
    (objectstack#4616 / #4807).

  Fixes that are not breaking, but were only found because rc.2 stopped being
  lenient — each had been passing vacuously:

  - **`view` drafts are actually validated now.** The client validator named the
    aggregated container schema while this admin authors first-class `ViewItem`s,
    and the container used to strip `viewKind` / `config` in silence — so no view
    draft ever had one of its own keys checked. It now validates each shape
    against its own schema (objectui#3312).
  - **The console's worked examples were wrong**, and being stripped rather than
    refused: `view.list.object` (the container root already declares it),
    `job.concurrency` / `job.timeoutMs` (no such keys; the spelling is `timeout`,
    already in ms), `email_template.from` / `.to` (a template is not a send —
    the sender override is `fromOverride`, an object), and
    `datasource.capabilities` / `.healthCheck` (objectstack#4583 removed the
    former; the latter was never a datasource key). These are the drafts an
    author — or a model generating metadata — copies.
  - Action key inventory re-derived: `ActionSchema` gained the package-lock
    envelope (`_lock*` / `_package*` / `_provenance`), so a packaged action no
    longer reports them as unknown keys.
  - The schema-diff panel labels the new `default_mismatch` finding.
  - Test fixtures pinning the retired `managedBy: 'system'` bucket now use
    `engine-owned`. Protocol 17 split that value (objectstack#3355), so it
    resolved to the default-writable fallback and a batch of "stays locked"
    assertions had quietly stopped asserting anything.

### Patch Changes

- Updated dependencies [18cd432]
- Updated dependencies [d915c47]
- Updated dependencies [5781fb1]
- Updated dependencies [9e9e9a9]
- Updated dependencies [23018cc]
- Updated dependencies [d915c47]
- Updated dependencies [f44d872]
- Updated dependencies [509104a]
- Updated dependencies [a4cff5b]
- Updated dependencies [f833d3a]
- Updated dependencies [2a9513d]
- Updated dependencies [d22ae31]
  - @object-ui/core@17.3.0
  - @object-ui/types@17.3.0

## 17.2.0

### Minor Changes

- c5ccbd5: Stop declaring 12 `@object-ui/data-objectstack` / `@object-ui/plugin-chatbot` /
  `@object-ui/plugin-list` symbols under names `@objectstack/spec` owns
  (objectui#3160, objectstack#4115 batch 6). All three packages leave the ledger.

  **Breaking for importers of `@object-ui/data-objectstack`** — four exported
  names changed, because the spec exports the same name for a _different_ thing:

  | was                   | now                         | what the spec's same-named export actually is                                            |
  | :-------------------- | :-------------------------- | :--------------------------------------------------------------------------------------- |
  | `CacheStats`          | `MetadataCacheStats`        | the platform `ICacheService` counters (`keyCount`, `memoryUsage`)                        |
  | `MetadataSaveOptions` | `MetadataClientSaveOptions` | options for writing a metadata item to a **file** (`format`, `path`, `indent`, `atomic`) |
  | `SecurityPolicy`      | `SecurityManagerPolicy`     | the package supply-chain policy (`autoScan`, licences, code signing, sandbox)            |
  | `ValidationError`     | `DataApiValidationError`    | a plain `{ field, message, code? }` entry in a validation report                         |

  Each pair is disjoint or nearly so — `MetadataSaveOptions` and `SecurityPolicy`
  share not one key with the spec type whose name they wore — so none of them was
  a dialect to reconcile; they were four unrelated concepts squatting on spec
  names. `DataApiValidationError` follows the `<what was validated>Validation<Error|Result>`
  convention registered on objectstack#4115 (`@object-ui/core` took
  `SchemaNodeValidationError` in batch 4). Its **runtime** `name` deliberately
  stays `'ValidationError'`: `normaliseClientError` and `@object-ui/react`'s
  error-message helper both sniff `err.name`, so that string is a wire contract,
  not a symbol.

  **Breaking for importers of `@object-ui/plugin-chatbot`** — `PendingActionRow`
  and `PendingActionStatus` are now re-exported from `@objectstack/spec/contracts`
  instead of hand-transcribed, which narrows them. The copies had drifted three
  ways, and each drift had **disabled a compile-time check** rather than merely
  differed from one:

  - `status: PendingActionStatus | string` — a union with `string` absorbs the
    literals, so that annotation carried no information at all;
  - `[key: string]: unknown` — the objectstack#4075 mechanism: an index signature
    makes every structural comparison against the spec answer "identical", however
    far the copy has drifted;
  - `created_at` / `updated_at`, which the service contract does not carry and no
    consumer in this repo reads.

  **Breaking for importers of `@object-ui/plugin-list`** — `ViewTab` is derived from the spec's `ViewTabSchema`
  — from its **input** side, because `pinned` / `isDefault` / `visible` carry
  `.default()`s and this component is handed authored metadata, not parsed output.
  That removes a renderer-side tolerance the copy carried: `visible` accepted
  `string | boolean` and the tab bar compared it against the literal `'false'`, a
  spelling no producer emits. `label` also stops being required (the spec makes it
  optional; `name` is the identifier) and `filter` stops being `any`.

  `ListView` and `UserFilters` keep their names as declared dialects: both are the
  React **renderers** of the spec types whose names they share, and each takes that
  spec type as a prop (`ListViewProps.schema`, `UserFiltersProps.config`) rather
  than restating its shape. `Tool` and `MessageContent` in `plugin-chatbot` are
  vendored Vercel AI Elements / Shadcn primitives — upstream's component API, not
  objectui's authored surface — so the guard now skips that directory the same way
  it already skips `components/src/ui/`, with a test that fails if any file there
  stops carrying its vendor banner.

  Scored `minor`, not `major`, per this repo's fixed-group rule — objectui's major
  tracks `@objectstack`, so breaking changes of our own ship as minor with the
  semantics spelled out above (see AGENTS.md §版本号策略). A `major` here would carry
  all 39 packages of the fixed group to `18.0.0` and off objectstack's 17.x line.

- d3584c6: Bring the whole `@objectstack` family to `17.0.0-rc.1`, so the dependency graph resolves a
  single copy of `@objectstack/spec`.

  #3178 bumped **only** `@objectstack/spec` to `17.0.0-rc.1`. The rest of the family —
  `client`, `core`, `formula`, `lint` (and `sdui-parser`, reached through `lint`) — stayed on
  `17.0.0-rc.0`, and each of them depends on spec at an **exact** version rather than a
  caret:

  ```
  @objectstack/client@17.0.0-rc.0  -> spec "17.0.0-rc.0"
  @objectstack/core@17.0.0-rc.0    -> spec "17.0.0-rc.0"
  @objectstack/formula@17.0.0-rc.0 -> spec "17.0.0-rc.0"
  @objectstack/lint@17.0.0-rc.0    -> spec "17.0.0-rc.0"
  ```

  So `main` carried **two** spec copies: objectui's own code read `17.0.0-rc.1` while every
  `@objectstack/*` package read `17.0.0-rc.0` from its own nested `node_modules`. That breaks
  the single-contract invariant this repo's guards are built on, and it breaks them
  _silently_ — the affected checks depend on identity, not on version strings:

  - `spec-subschema-parity.test.ts` distinguishes a genuine re-export from a fork by
    **reference identity** of the zod schema object. Two spec copies make every schema a
    distinct object, so a real re-export starts reading as a fork (or a fork slips through,
    depending on which copy each side resolved).
  - `scripts/check-spec-symbol-derivation.mjs` and `spec-symbol-parity.test.ts` use
    `createRequire` to resolve spec's `.d.ts` and run it through the TS checker. With two
    copies installed, _which_ declaration file the checker sees is a function of resolution
    order rather than of intent.

  The declared ranges were already `^17.0.0-rc.0`, which technically admits rc.1 — the pin
  lived in the lockfile. Raising the remaining ranges to `^17.0.0-rc.1` makes the floor
  explicit and forbids a future install from silently sliding back onto a family member that
  drags rc.0 along with it. The rc.1 family members pin spec at `17.0.0-rc.1` exactly, so the
  graph now converges on one copy by construction, not by luck.

  No product behaviour changes here. `check:spec-symbols` reconciliation was already
  completed by #3178 and stays green under the unified graph; this changeset is `minor`
  per the repo's fixed-group version policy.

### Patch Changes

- Updated dependencies [4ae0ac4]
- Updated dependencies [696e3c1]
- Updated dependencies [bca45cc]
- Updated dependencies [4bf612c]
- Updated dependencies [335041c]
- Updated dependencies [b414983]
- Updated dependencies [256f8cc]
- Updated dependencies [d9668a7]
- Updated dependencies [cb82705]
- Updated dependencies [f572849]
- Updated dependencies [d3584c6]
- Updated dependencies [a8ad6c0]
- Updated dependencies [444457c]
- Updated dependencies [850033c]
- Updated dependencies [022e4c3]
- Updated dependencies [009e25d]
- Updated dependencies [726b89c]
  - @object-ui/types@17.2.0
  - @object-ui/core@17.2.0

## 17.1.0

### Minor Changes

- 9b773f9: fix(analytics): a missing analytics capability no longer renders as an empty KPI — objectstack#3891

  The framework retired its degraded in-kernel analytics fallback (objectstack#3891):
  it dropped the caller's RLS/tenant scope and ignored the contract filter, so it
  answered `200` with over-broad numbers. `@objectstack/service-analytics` is now
  the only implementation, and a deployment without it answers `404` on
  `/analytics/query` (objectstack#4019 stops mounting the routes) or `501` on
  `/analytics/dataset/query`.

  Three things were wrong on this side of that boundary:

  **① A KPI on such a deployment rendered a confident zero.** `aggregate()`'s
  `catch` promises a client-side fallback, and the fallback is correct — but the
  adapter never got there for the most likely failure. It now classifies the
  failure (`classifyAnalyticsFailure`) instead of treating every error alike:
  capability-absent (404/501) degrades to a client-side aggregate over a
  **server-scoped** `find()` — same rows, same filter, RLS still applied — and
  says so **once per adapter** in the console, naming the package to install,
  rather than once per widget or not at all.

  **② A rejected query was answered with plausible numbers.** The framework
  validates `/analytics/query` at the entry now (objectstack#4010), so a `400
VALIDATION_FAILED` means _this adapter_ sent an off-contract body. Degrading
  there would bury our own bug behind output from a different code path — the
  misdirection objectstack#3878 documented. It now throws
  `AnalyticsQueryRejectedError` and never falls back. Transient failures (5xx,
  network) degrade exactly as before.

  **③ The dataset preview blamed the author for a missing capability.**
  `queryDataset` mapped `501`/`404` to `Dataset query failed: 501 Not Implemented
— …`; it now throws the typed `AnalyticsNotInstalledError`
  (`code: 'ANALYTICS_NOT_INSTALLED'`) with a message a UI can render verbatim, and
  `DatasetPreview` shows it as a "analytics capability not installed" empty state
  instead of a red error banner. A real compile error (e.g. "relationship not
  declared in include") keeps its server detail and its banner.

  New exports from `@object-ui/data-objectstack`: `AnalyticsNotInstalledError`,
  `AnalyticsQueryRejectedError`, `isAnalyticsNotInstalledError`,
  `classifyAnalyticsFailure`.

- 1cf0de7: fix(detail): finish the approval-lock story, and warn on silently stripped fields (framework#3794)

  The Console reported record writability wrong in both directions during an
  approval, so a user had nothing to go on: what they _could_ edit said "locked",
  and what they _couldn't_ said "updated successfully".

  **The lock band told the truth; the Edit button did not.** objectui#2902 split
  the band into "in approval · editable" vs locked, but the header **Edit** CTA
  still keyed off nothing at all — on a genuinely locked record it stayed live, so
  the user opened the form, filled a screen, and got `RECORD_LOCKED` back on Save.
  It is now `disabled` on a locked record: visible-but-off, with the band beside it
  saying why. This is the LOCK, not the mere presence of an approval — a
  `lockRecord: false` node keeps Edit live, which is the point of that setting.

  **And the band could still re-lock itself.** `DetailView` OR-ed the record's own
  `approval_status` mirror into `isLocked` unconditionally. That mirror is written
  on submit by any flow configuring an `approvalStatusField`, _regardless of_
  `lockRecord` — so on a `lockRecord: false` node the host correctly resolved "not
  locked" from the request's `lock_record` while the mirror dragged the band back
  to "Locked for approval", with the pencils live and saves landing underneath it.
  The host is now authoritative whenever it threads `approvalPending`; the mirror
  is consulted only for bare/legacy `DetailView` hosts that thread nothing, where
  it still reads as locked (no node granularity — the safe direction).

  Recall's tooltip no longer promises to unlock a record the node never locked
  (`detail.cancelApprovalTooltipUnlocked`).

  **Silently stripped fields now surface on the record form's save path.** The
  adapter emitted a write-warning for `create`/`update` responses carrying
  `droppedFields`, but not for `batchTransaction` — which is how the record form
  saves a master-detail record, i.e. the one surface where a user actually edits a
  `readonlyWhen`-locked field. `batchTransaction` now emits one warning per event,
  resolving each back to its operation via the response's `index`.

  The toast itself was hardcoded English and called every strip "read-only". It is
  now localized (`detail.writeStripped*`, ten locales) and worded by reason:
  `readonly_when` says the field is not editable _in this record's current state_,
  which is what actually happened — the field is editable in other states and the
  form rendered it as an ordinary input, so "read-only" sent the user hunting for a
  permission problem that does not exist.

  **And it stopped crying wolf.** `createObjectStackUserStateAdapter` hand-stamped
  the server-managed `updated_at` on every recents/favorites write, which the
  server strips and reports — so the console popped "Some fields were not saved"
  about a field no user ever touched, on page loads, drowning the signal the toast
  exists for. It no longer sends the column; the server stamps it anyway.

- 0ded602: fix(form): a server rejection that names fields now marks those fields (objectstack#3896)

  The server has always said which field it rejected. `@objectstack/objectql`'s
  validators throw `VALIDATION_FAILED` with `fields[]` — one entry per offending
  field, each with a human `message` — and both the REST layer and the runtime
  dispatcher serve that as a 400 with the entries intact.

  Every form dropped them. The submit handler caught the rejection, ran the
  message through `extractWriteErrorMessage`, and showed **one undirected toast**:
  the user was told something was wrong but not _what_, on a surface that already
  knows how to mark an input — and already does exactly that for client-side
  validation. On a long form the offending field was often off-screen, so "创建"
  appeared to do nothing.

  **Now the two failures behave identically, because they share one
  implementation.** The per-field marking, the toast naming the fields, and the
  scroll-and-focus of the first offender (#2793) were extracted from the
  client-side invalid handler; the server path calls the same function. As far as
  the person filling in the form is concerned these are the same event — only the
  referee differs.

  Three layers, each of which was dropping the detail:

  - **`@object-ui/react`** — new `extractFieldErrors(err)` (exported alongside
    `extractWriteErrorMessage` / `isPermissionError`) normalises the three shapes
    the error can arrive in: a typed `ValidationError` from the ObjectStack
    adapter, the raw `@objectstack/client` error (whose `details` falls back to the
    whole response body, which is where `fields[]` lands), and a hand-rolled error
    carrying `fields` directly — the server duck-types that shape identically, so
    the client must not be pickier than the server. Entries with no usable `field`
    are **dropped rather than guessed at**: marking an innocent input is worse than
    the generic toast.
  - **`@object-ui/data-objectstack`** — `normaliseClientError` now maps a 400
    `VALIDATION_FAILED` onto the `ValidationError` class that has sat in
    `errors.ts` since the package was written, exported and **never once
    constructed**. Its `validationErrors: Array<{ field, message }>` shape was
    already exactly right. `create` also now normalises at all: only `update` did,
    so a rejected insert reached callers as the raw client error — and a create is
    the path that most often trips required-field validation.
  - **`@object-ui/components`** — the form renderer maps the entries onto
    `form.setError` and takes over the failure, **but only when every rejected
    field has a visible input to carry it**. If the server also rejected something
    the form does not render, it falls through to the banner, whose top-level
    message concatenates every field's reason — so the part the user cannot see
    inline is still said out loud instead of silently dropped.

  This also removes the need for the client-side predicate mirroring added in
  #2962: a form no longer has to guess what the server will reject in order to
  warn about it beforehand, and mirrored predicates drift.

  Non-field failures (403 / permission denials / anything without `fields[]`) take
  exactly the path they took before.

### Patch Changes

- 4952edf: fix(errors): error-code branches survive the framework's ADR-0112 rename — objectstack#3841

  Framework ADR-0112 renamed the whole `error.code` vocabulary from lowercase
  `snake_case` to `SCREAMING_SNAKE` (`destructive_change` → `DESTRUCTIVE_CHANGE`).
  Eleven places compared `err.code` against the old spelling with `===`, so against
  a swept server they simply stopped matching — and nothing threw. The affordance
  each branch guards just vanished and the user got the generic error toast instead:

  - the destructive-change confirm dialog (resource editor, permission matrix)
  - the "create a writable package first" hint
  - field-scoped validation issues on embedded item saves
  - the all-or-nothing publish summary naming the causal item
  - unknown-object tolerance in the app header and in record search
  - the marketplace's local-install messages for conflict / auth / unavailable
  - `isNotFoundError` in the data layer

  `RECORD_NOT_FOUND` had already been renamed a release earlier, so that branch was
  already dead before this fix.

  New `errorCodeIs` / `errorCodeIsAnyOf` in `@object-ui/types` compare
  case-insensitively, so the console keeps working against servers on either side
  of the rename — the console ships separately from the server it talks to. Every
  call site now passes the catalog (SCREAMING) spelling, and `error-code.ts` is the
  single file to delete once no supported server emits the old vocabulary.

- 7f0252e: fix(list,data-objectstack,types): exporting a searched list no longer downloads the unsearched superset

  The server-streamed export mirrored the view's `filter` and `sort`, and the
  code comment claimed that made the file match the screen:

  > Mirrors the active view's filter + sort so the exported file matches what the
  > user sees.

  It mirrored one half. There was no way to carry the term a user had typed into
  the search box — `ExportDownloadRequest` had no field for one — so exporting
  during a search produced **more rows than the list showed**, in a file that
  looks authoritative, with nothing indicating the difference. The client-side
  fallback was always correct (it serializes the already-searched `data`); only
  the server path was wrong, and it is the one that handles xlsx.

  Same family as a dropped filter (objectstack#3948, objectstack#4181): a
  plausible answer that is quietly broader than the one asked for.

  - `ExportDownloadRequest` gains `search` / `searchFields`.
  - `ObjectStackAdapter.exportDownload` sends them as `search=` / `searchFields=`,
    trimming the term and omitting both when it is blank (`searchFields` alone
    means nothing).
  - `ListView` passes the active `searchTerm` and the view's `searchableFields`,
    and both are now in the export callback's dependency array — a stale closure
    would export the wrong row set.

  Requires a server with objectstack#4230. Older servers ignore unknown query
  params on this route, so they keep today's behaviour rather than erroring.

  **Also: the filter merge is no longer written twice.** The three filter sources
  (view filter, filter-panel group, per-field user filters) were merged by
  verbatim copies in the data fetch and in the export — two copies that must
  agree, deciding respectively what the user _sees_ and what they _download_.
  Both now call `buildEffectiveFilter`. This is a pure extraction: the copies did
  agree, and the four parity tests added for it pass against the old code too.
  They exist to keep it that way — the adapter's duplicated filter-shape check
  had already drifted apart unnoticed (#3072).

- 7d35010: fix(data-objectstack): a view's own filter no longer disappears when the user adds one

  `ObjectStackAdapter` translated object-form filter entries
  (`[{ field, operator, value }, ...]`) only at the **top level** of a `$filter`.
  The moment a list has both a stored view filter and a user filter, it builds

  ```js
  [
    "and",
    [{ field: "stage", operator: "eq", value: "won" }],
    [["amount", ">", 1]],
  ];
  ```

  whose head is the string `and`, so the old check called the whole thing
  "already AST" and shipped the rules untranslated. Both server answers to that
  are wrong:

  ```js
  isFilterAST(above); // false — a bare rule object is not an AST child
  parseFilterAST(above); // { amount: { $gt: 1 } }   ← `stage = won` is GONE
  ```

  Since objectstack#4121 the `isFilterAST` gate turns it into a **400 and the
  list fails to load**. Before it — or anywhere `parseFilterAST` is reached
  without that gate — **the view's own condition is dropped without a word** and
  the list returns records the view exists to exclude.

  Translation is now recursive through `and`/`or` nodes and legacy flat child
  arrays, so the shape reaches the server as a valid AST
  (`{$and: [{stage: 'won'}, {amount: {$gt: 1}}]}`).

  Three related fixes in the same code:

  - **An untranslatable entry is now an error, not an omission.** Entries that
    failed to translate were dropped, and dropping one conjunct of an `and`
    returns a _superset_ of the rows asked for — dropping the last one sent no
    `filter=` at all, so the whole table came back. `find()` now throws
    `MalformedFilterError`, carrying `code: 'INVALID_FILTER'` / `httpStatus: 400`
    so a failed list renders "the filter is malformed" rather than "check your
    connection". A rule with a blank `field` passes `ViewFilterRuleSchema`
    (`z.string()` admits `''`), so this is reachable from real stored metadata.
    A _mixed_ array (`[{ field, operator, value }, ['amount', '>', 1]]`) now
    keeps both halves instead of dropping the tuple — that case was a lost
    condition, not a malformed one.
  - **The two `find()` routes can no longer disagree.** The "is this object
    form?" test existed twice — once in `translateFilterToAST`, once inline in
    `convertQueryParams` — and the copies had already drifted: the inline one
    omitted a `!== null` guard, so a `$filter` of `[null]` threw a `TypeError` on
    the plain route while the same value was handled on the `$expand` route. One
    definition now serves both.
  - **Dropped an unreachable `entry.name` fallback.** `objectFilterEntryToAST`
    read `entry.field ?? entry.name` while the shape check keyed on `field`
    alone, so the `name` half was dead from the commit that introduced it. The
    spec agrees it is not a real shape — `ViewFilterRuleSchema.field` is
    required, so such a rule cannot be saved as view metadata.

  Refs objectstack#3948, objectstack#4121, #2945

- c4d7b20: fix(view,list,core): a view's filter no longer disappears, or arrives as a predicate on columns that don't exist

  Sweeping the other `$filter` producers after #3078 turned up two live defects in
  `ObjectView`, which fetches its own data for calendar / kanban / gallery /
  timeline (grid delegates to `ObjectGrid`).

  **1. An object filter was dropped, and only for non-grid views.**
  `table.defaultFilters` is declared `Record<string, any>`, and the merge tested
  `baseFilter.length > 0` — `undefined > 0` for an object. So the filter vanished
  and the view returned **every record**. `ObjectGrid` assigns the same value
  straight to `params.$filter`, so one view definition filtered correctly as a
  grid and returned everything as a calendar.

  **2. Rule objects were spread into the `and`, not wrapped.**
  `['and', ...baseFilter, ...userFilter]` is only correct when the source is an
  array of AST nodes. `activeView.filter` is a spec `ViewFilterRule[]`, so
  spreading put bare rule objects where the AST expects nodes:

  ```js
  isFilterAST([
    "and",
    { field: "stage", operator: "eq", value: "won" },
    ["owner", "=", "me"],
  ]);
  // false → 400 since objectstack#4121
  parseFilterAST(same);
  // {$and:[{field:'stage',operator:'eq',value:'won'}, {owner:'me'}]}
  ```

  That second line is a predicate over three columns named `field`, `operator`
  and `value` — which don't exist.

  > **Correction.** The first version of this note said the spread was "reachable
  > whenever a view with a filter meets a user filter value". That was wrong for
  > `ObjectView`: the branch required a non-empty user filter, and nothing ever
  > wrote the state it was built from, so it could never run. The shape is
  > genuinely broken — a live server answers it with a 400 — and the adapter-level
  > defence added alongside is still warranted for any producer that emits it, but
  > **this particular site was dead code, not a live defect.** Defect 1 above was
  > live: it sat on the always-taken path. The dead machinery behind the wrong
  > claim is removed in a follow-up.

  New in `@object-ui/core`: `toFilterNode` normalizes one source (rule array / AST
  / MongoDB object) and `mergeFilterNodes` combines sources as siblings under one
  `and`. `ObjectView` and `ListView.buildEffectiveFilter` both use them, so the
  three filter shapes are reconciled in one place instead of by hand at each
  renderer.

  `ObjectStackAdapter` also now translates a bare rule object sitting directly
  under a logical node — the chokepoint defence for any producer still emitting
  the spread shape. Only rule-_shaped_ objects are touched; a child with no
  `field` is a genuine MongoDB condition and passes through untouched.

  **Correcting a comment shipped in #3078.** `buildEffectiveFilter` documented the
  dropped-object case as unreachable, "nothing in this repo produces one for a
  list view". That was wrong: `ObjectView` passes `mergedFilters` straight into
  that schema's `filter`, and its last fallback is `table.defaultFilters`. The
  case is now handled rather than explained away.

  Verified with 19 tests across the four packages; reverting each source file
  fails the ones that cover it. Emitted filters are asserted against the spec's
  own `isFilterAST` / `parseFilterAST`, including an executable pin on what the
  old spread shape produced.

- ad0183a: fix(data-objectstack,core): an object filter no longer depends on whether the query expands a lookup

  #3072 single-sourced the ARRAY branch of the adapter's two `find()` routes. The
  object branch was left as it was: `convertQueryParams` converted a MongoDB-style
  filter to AST while `translateFilterToAST` returned it verbatim — so the same
  `$filter` went out in two formats, decided by whether the query happened to
  expand a lookup.

  Measured across 21 operator shapes, **four diverged**. Most of the gap turned
  out to be harmless — `{$and: […]}` survives the plain route as a
  `['$and','=',[…]]` comparison that `parseFilterAST` reads back as a real `$and`,
  and `$exists` vs `$null` is a difference the server treats identically. Two were
  not harmless:

  - **The unknown-operator guard only ran on one route.** `convertFiltersToAST`
    throws on an unrecognised operator, with a comment saying it does so "to avoid
    silent failure" — but the expanded route never called it, so a typo'd operator
    threw on a plain read and shipped silently whenever a lookup was expanded.
  - **`$regex` was silently rewritten to `contains`.** `$regex: 'a.c'` matches
    "abc"; `contains 'a.c'` matches only those three literal characters. That is a
    _different question_, not a weaker version of the same one, and neither result
    looks wrong on screen. The rewrite sat behind a `console.warn`, which is not
    an error channel in a deployed app — and the function's own unknown-operator
    message never listed `$regex` among the supported set. The spec has no
    `$regex` (`FILTER_OPERATORS`, `data/filter.zod.ts`), so there is nothing to
    translate it into: it is now refused, the same treatment the neighbouring
    unknown operator already got. Nothing in the repo depended on the conversion.

  Both refusals now throw `FilterOperatorError`, carrying `code: 'INVALID_FILTER'`
  / `httpStatus: 400`. The pre-existing unknown-operator throw was a bare `Error`,
  which `classifyLoadError` classifies as a network fault — so a malformed filter
  told the user to check their connection (#3066), the one thing it definitely
  was not.

- a17ef09: fix(data-objectstack): a string `$orderby` reaches the server as a sort instead of a list of character indices — #3106

  `QueryParams['$orderby']` declares four shapes — `string`, `string[]`,
  `SortNode[]`, `Record<field, direction>`. Both of this adapter's `find()` routes
  (`convertQueryParams` for a plain read, `rawFindWithPopulate` for one carrying
  `$expand`/`$search`) carried their own copy of the fold that serializes it, and
  both copies handled the same three. The bare string fell through to the
  `Record` branch, where `Object.entries('name asc')` enumerates the string's
  character indices — so the request went out as `sort=0,1,2,3,4,5,6,7`.

  Since `objectstack#4226` the server refuses a sort it cannot read
  (`400 INVALID_SORT`) rather than dropping it silently, so this was not a
  degraded ordering but a list that failed to load outright — and `"${field}
${order}"` is exactly the shape `ObjectGrid` builds from its view metadata's
  `sort`, making every standalone grid with a configured sort a broken one.

  Both routes now share one exported `serializeOrderBy`, for the same reason the
  filter path already shares one: two copies of a fold can only agree by
  inspection, and these two did not.

- Updated dependencies [62311b6]
- Updated dependencies [9e7349e]
- Updated dependencies [8864971]
- Updated dependencies [b41f401]
- Updated dependencies [19e9fa0]
- Updated dependencies [95b7214]
- Updated dependencies [7d9734d]
- Updated dependencies [6ae818e]
- Updated dependencies [746dd00]
- Updated dependencies [aebfa4f]
- Updated dependencies [38ca8be]
- Updated dependencies [4952edf]
- Updated dependencies [7f0252e]
- Updated dependencies [c4d7b20]
- Updated dependencies [7639a61]
- Updated dependencies [94e63ef]
- Updated dependencies [02aef0c]
- Updated dependencies [6f29aa5]
- Updated dependencies [c4db402]
- Updated dependencies [5319bf1]
- Updated dependencies [49e5671]
- Updated dependencies [b5b97e2]
- Updated dependencies [f59f2c1]
- Updated dependencies [4874117]
- Updated dependencies [ad0183a]
- Updated dependencies [ce08d55]
- Updated dependencies [aa1240a]
- Updated dependencies [2374a49]
- Updated dependencies [390c071]
- Updated dependencies [d10f526]
- Updated dependencies [2d5d594]
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
  - @object-ui/core@17.1.0
  - @object-ui/types@17.1.0

## 17.0.0

### Minor Changes

- d62fb1f: feat(app-shell): toast when a save silently dropped read-only fields (framework #3431/#3455)

  The framework now reports fields it LEGALLY stripped from a write (a non-system
  caller can't seed a `readonly` field, a `readonlyWhen` predicate locked it, …)
  via a `droppedFields` payload on the create/update response. Previously the
  console discarded it: a value the user typed into a locked field just vanished on
  save with a success toast and no explanation.

  - **data-objectstack:** `ObjectStackAdapter` now emits a `WriteWarningEvent`
    after a create/update whose response carried `droppedFields`, exposed through a
    new `onWriteWarning(cb)` subscription (mirrors the existing `onMutation` bus).
    Reads the field structurally, so an older client or a backend that never drops
    is a no-op. New exported types: `WriteWarningEvent`, `WriteWarningListener`,
    `DroppedFieldsEvent`.
  - **app-shell:** `AdapterProvider` subscribes and raises a `toast.warning`
    ("Some fields were not saved — the read-only field … could not be changed"),
    so the strip is visible instead of silent. The write itself still succeeded;
    status/behaviour are unchanged.

### Patch Changes

- 8ecf5a6: Command palette (⌘K) now surfaces record search hits from the platform's global
  search endpoint (`GET /api/v1/search`).

  Previously the palette only ran a per-object `find({ $search })` fanout (the
  metadata-driven ADR-0061 search), which misses records that only the global
  search index knows about — so typing a well-known record name returned no
  records even though `/api/v1/search` served them. `ObjectStackAdapter` now
  exposes a `searchAll(query, { limit, objects })` method that calls the unified
  endpoint, `useRecordSearch` prefers it when present (falling back to the fanout
  otherwise), and the palette renders the resulting record hits grouped by object.

- 6e8fd3c: fix(charts): a fieldless `count` aggregate keyed its value column `undefined`, so the chart plotted nothing (framework#3701)

  framework#3701 pinned down what an OBJECT-bound chart aggregate names its result
  columns — the raw field names it was given (`groupBy` for the category, `field`
  for the value; no `sum_`-style decoration, unlike a dataset measure), plus the
  literal `count` when a `count` omits `field`, which is the alias the engine
  projects `COUNT(*)` under. `os validate` now lints page sources against that
  convention, so the paths that build these rows have to honour it exactly.

  Three of the four did. The odd one out was `count` — the one function that may
  legitimately omit `field` — because every row builder read `params.field`
  directly:

  - `aggregateRecords` / `ObjectDataSource.aggregateClientSide` emitted
    `{ [groupBy]: key, [undefined]: value }`, i.e. a column literally named
    `undefined` that no axis binding could ever name;
  - the legacy analytics path was worse: it remapped the server's `count` measure
    onto `params.field` and **deleted** the original key, so the value the server
    did return was thrown away before the chart saw it.

  All of them now resolve the column through one helper (`aggregateValueKey`) so a
  fieldless count lands under `count`, matching the framework contract. The
  comparison-overlay column is derived from the same key (`count__comparison`
  instead of `undefined__comparison`), and `aggregate.field` is typed optional to
  match the spec's `ChartAggregateSchema`. Charts that name a field are unchanged.

- Updated dependencies [1767124]
- Updated dependencies [8ecf5a6]
- Updated dependencies [7b35e4b]
- Updated dependencies [e16ed2d]
- Updated dependencies [f9bbddb]
- Updated dependencies [dfd3705]
- Updated dependencies [2735de6]
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
  - @object-ui/core@17.0.0

## 16.1.0

### Minor Changes

- 8c1e415: feat(data-objectstack): gate the non-atomic batch fallback on the discovery `transactionalBatch` capability (#2693)

  `ObjectStackAdapter.batchTransaction` now negotiates atomic cross-object batch
  **declaratively** instead of only probing at runtime. At `connect()` the adapter
  reads `capabilities.transactionalBatch` from `GET /api/v1/discovery`
  (framework #3298 — `declared === enforced`; the server advertises `true` only
  when the `/batch` route is mounted _and_ the runtime engine can honour a
  transaction):

  - **Declared `true`** — the adapter TRUSTS server atomicity: it calls `/batch`
    and surfaces any failure (including `404`/`405`/`501`) as a real error. No
    runtime probe, no non-atomic client-side compensation.
  - **Declared `false`, or absent** (backend predates #3298) — the legacy path is
    unchanged: probe `/batch` and, on `404`/`405`/`501`, fall back to the
    non-atomic `emulateBatchTransaction`. Keeping this avoids regressing older
    backends from "saves, less safe" to "no save path" (#2679 compat constraint).

  Both the hierarchical wire shape (`{ transactionalBatch: { enabled: true } }`)
  and the flat form the client SDK normalizes to (`{ transactionalBatch: true }`)
  are accepted. `@object-ui/core`'s generic `emulateBatchTransaction` /
  `runBatchTransaction` are untouched and remain the fallback for adapters with no
  server-side transaction (`ValueDataSource`, `MockDataSource`, …).

  Docs: the adapter README and the data-source guide now document the capability
  table and the minimum-backend note — atomic cross-object saves are guaranteed
  only against backends advertising the capability (framework #3298 / #1604).

  Picks up #2679 acceptance item 4; unblocked by framework#3298 (merged).

- 62b9ab5: feat(data): unify master-detail saves behind `DataSource.batchTransaction`, isolate the non-atomic fallback in the adapter (#2679)

  Master-detail saves (`MasterDetailForm`, `LineItemsPanel`) now always persist
  through `dataSource.batchTransaction(operations)` — one ordered cross-object
  operation list, with `{ $ref: <op index> }` linking a child to a parent created
  in the same batch. The form no longer contains any client-side orchestration or
  best-effort compensation-delete; that atomicity anti-pattern is gone from the UI
  layer (framework #1604 / framework ADR-0034 item 4).

  - **`@object-ui/types`** — `batchTransaction?` is now a first-class (optional)
    method on the `DataSource` contract, typed via `BatchTransactionOperation` /
    `BatchRef`. Replaces the previous `(dataSource as any).batchTransaction`
    method-sniffing.
  - **`@object-ui/core`** — new `emulateBatchTransaction(dataSource, operations)`
    (sequential writes, `$ref` resolution, best-effort reverse-order compensation)
    and `runBatchTransaction(dataSource, operations)` (prefers the adapter's method,
    emulates otherwise). `ApiDataSource` / `ValueDataSource` implement
    `batchTransaction` via the emulation.
  - **`@object-ui/data-objectstack`** — `ObjectStackAdapter.batchTransaction` uses
    the server's atomic `POST /api/v1/batch`, prefers the typed
    `client.data.batchTransaction` SDK method when the installed client exposes it,
    and degrades to the client-side emulation ONLY when the endpoint is missing
    (404/405) or the runtime can't do transactions (501). Real errors (400/401/403/
    409/500) still surface. This is the isolated, tested home of the non-atomic
    fallback.
  - **`@object-ui/plugin-form`** — removed `applyDetail` / `createMany` /
    `ApplyDetailResult` from `masterDetailTx.ts`; `MasterDetailForm` and
    `LineItemsPanel` build ops and call `runBatchTransaction`. `LineItemsPanel`
    saves are now atomic on a capable backend, with the rollup folded into the same
    batch.

  No behavior change on a current ObjectStack backend (it has `/api/v1/batch`);
  older/limited backends keep a working — now clearly non-atomic — save path.

### Patch Changes

- 8b8b744: chore(deps): align `@objectstack/formula` / `lint` / `client` to `^15.1.1`

  These three were still pinned to `^14.6.0` while `@objectstack/spec` was already
  `^15.1.1` — a version skew from the v15 upgrade (formula/lint/client publish in
  lockstep with spec, and their own 15.0.0 entries are pure dependency bumps, so
  this is alignment, not a behavioral migration).

  Practical effect: the client-side field-rule evaluation
  (`visibleWhen`/`readonlyWhen`/`requiredWhen` via `fieldRules.ts`, which delegates
  to `@objectstack/formula`'s `ExpressionEngine`) now tracks the 15.x engine — and
  will pick up the framework's `dateField == today()` equality fix
  (objectstack-ai/objectstack#3205) automatically at the next 15.x release via the
  caret range. Renderer/action `visible`/`disabled` predicates are unaffected (they
  use the home-grown JS evaluator — tracked separately in #2661).

- 7cf4051: chore(deps): align every `@objectstack/*` dependency to `^16.0.0-rc.0`

  Bumps `@objectstack/spec` / `client` / `formula` / `lint` from `^15.1.1` to the
  `16.0.0-rc.0` pre-release across the workspace (root + `apps/console` +
  `apps/site` + all consuming packages). ObjectUI's own packages are already on
  major 16, so this closes the 15↔16 skew between ObjectUI and the `@objectstack`
  contract libraries (which publish in lockstep with `spec`).

  This is a dependency alignment, not a behavioral migration: the full workspace
  build (43/43) and the `@objectstack`-consuming package test suites
  (`core` / `app-shell` / `data-objectstack` / `plugin-form` / `types`) are green
  against `16.0.0-rc.0` with no source changes required.

  Practical effect: `@objectstack/client@16.0.0-rc.0` now ships
  `data.batchTransaction` (framework #3271), so `ObjectStackAdapter`'s feature
  detect (`typeof client.data.batchTransaction === 'function'`) routes
  master-detail cross-object saves through the typed SDK method instead of the
  raw `fetch('/api/v1/batch')` fallback — realizing the "verify SDK path" half of
  #2694. The raw-fetch branch stays as a defensive fallback (removal tracked in
  #2694).

- 0ea5036: refactor(data-objectstack): route `batchTransaction` through the client SDK only, drop the raw-fetch branch

  `@objectstack/client@^16` (framework #3271, the current ObjectUI dependency
  floor) ships `data.batchTransaction`, so `ObjectStackAdapter.batchTransaction`
  now calls the typed SDK method directly. The transitional hand-rolled
  `fetch('/api/v1/batch')` branch — a feature-detect shim kept while the SDK
  method was unreleased — is removed (#2694). Per AGENTS.md §7, adapter data
  always flows through `@objectstack/client`, never a raw `fetch`.

  No behavior change: the SDK still drives the server's atomic `POST /api/v1/batch`,
  one `MutationEvent` is emitted per committed op (no double-fire), and the adapter
  still degrades to the non-atomic `emulateBatchTransaction` when this backend lacks
  the endpoint (404/405) or its runtime can't do transactions (501). Every other
  status still surfaces to the caller.

- 549c67d: chore(lint): clear the mechanical baseline lint errors so these packages' lint gates protect them again

  Extends the fields/core cleanup from #2709 (objectui#2713). These eight package
  lints were red at baseline on `main`, so their per-package `lint` gate could not
  catch new violations of the same class. Cleared every **error** (no behavior
  change; warnings are out of scope):

  - **`no-useless-catch`** (`data-objectstack`) — unwrapped five try/catch blocks
    whose `catch` only re-threw; errors still propagate identically.
  - **`preserve-caught-error`** (`cli`, `data-objectstack`, `react`) — the caught
    error's message is inlined into the thrown `Error`; a scoped disable with a
    justifying comment carries each one, because these packages target ES2020
    whose lib types the 1-arg `Error` constructor only (so `{ cause }` won't
    compile) — same reasoning as the core case in #2709.
  - **`prefer-const`** (`plugin-calendar`, `plugin-map`) — `let`→`const` for
    never-reassigned bindings.
  - **`no-empty-object-type`** (`plugin-designer`) — empty extend-only interfaces
    → equivalent `type` aliases.
  - **`no-useless-assignment`** (`react`) — dropped a dead initializer that both
    branches overwrite before it is read.
  - **`no-require-imports`** (`plugin-calendar`, `plugin-timeline` tests) —
    hoisted `vi.mock` factories now use an `async` factory with
    `await import('react')` instead of `require('react')`.
  - **stale `eslint-disable` directive** (`plugin-markdown`) — removed a
    `react/no-danger` disable whose plugin is not loaded in the flat config (an
    unknown-rule reference that ESLint v10 reports as an error); the rationale is
    kept as a plain comment.

- 29c6040: fix(app-shell): redo the record-list "Add View" create flow — empty-name 405, invisible drafts, canonical naming

  Rebuilds the record-list "Add View" / "Save as view" create path so a
  runtime-created view has one canonical identity and is actually verifiable
  before publish (supersedes #2754; fixes #2767).

  - **Unified identity (P1).** New `viewEnvelope(objectName, spec, { name, label })`
    seam in `runtime-metadata-persistence.ts` emits the canonical ViewItem
    (`{ name: '<object>.<key>', object, viewKind: 'list', label, config }` with
    `config.data = { provider: 'object', object }`), mirroring the Studio
    `anchors.ts:createBuildBody`. The **qualified** name is passed as BOTH the
    `PUT /meta/view/:name` URL segment and `body.name`, so the `sys_metadata`
    row key, the ViewTabBar tab id, and the body identity all agree and the
    draft → read → publish loop resolves. `ObjectView` and `ObjectDataPage` both
    call the single helper — the duplicated envelope block is gone (P6).
  - **Empty-name guards (405).** `MetadataClient.save()` and
    `createRuntimeMetadata()` throw a clear contextual error instead of emitting
    `PUT /meta/view/` (empty `:name`, server 405).
  - **Draft visibility (P2/P3/P4).** `DataSource.listViews(objectName, { previewDrafts })`:
    in draft-preview mode the `ObjectStackAdapter` makes a **single**
    `MetadataClient.withPreviewDrafts(true).list('view')` request and uses the
    server's already-overlaid list (draft wins by name, `_draft` tagged) —
    replacing, not appending, so a draft that edits a published view can't
    double-tab. No hand-rolled `fetch` of metadata routes at the adapter layer.
    After a create in normal mode the console navigates to the new view with
    `?preview=draft`, so the DraftPreviewBar is visible and Publish is one click.
  - **CJK-aware naming (P5).** `CreateViewDialog` gains an editable machine-name
    field, prefilled via `slugify(label)` for Latin labels and required (submit
    disabled) when slugify yields empty for non-Latin labels — no more silent
    random `task_grid_mrsyt56j` names. New `console.objectView.viewName*` keys
    (en/zh).

- Updated dependencies [1c8935a]
- Updated dependencies [8b8b744]
- Updated dependencies [7cf4051]
- Updated dependencies [2e7d7f0]
- Updated dependencies [94d4876]
- Updated dependencies [2b17339]
- Updated dependencies [31b77d4]
- Updated dependencies [6d4fbe6]
- Updated dependencies [0a3710b]
- Updated dependencies [62b9ab5]
- Updated dependencies [1629313]
- Updated dependencies [29c6040]
- Updated dependencies [faebac3]
- Updated dependencies [2331ac9]
- Updated dependencies [199fa83]
- Updated dependencies [eee4ded]
  - @object-ui/core@16.1.0
  - @object-ui/types@16.1.0

## 16.0.0

### Patch Changes

- Updated dependencies [210806a]
- Updated dependencies [b4ef588]
- Updated dependencies [5534535]
- Updated dependencies [9b8f978]
  - @object-ui/types@16.0.0
  - @object-ui/core@16.0.0

## 15.0.0

### Patch Changes

- @object-ui/types@15.0.0
- @object-ui/core@15.0.0

## 14.1.0

### Patch Changes

- Updated dependencies [0890fa7]
- Updated dependencies [2ded18c]
- Updated dependencies [e628d1f]
- Updated dependencies [5523fc4]
- Updated dependencies [887062c]
- Updated dependencies [9e2d58f]
- Updated dependencies [dea65f7]
- Updated dependencies [d5b1bc0]
- Updated dependencies [f0f10f5]
  - @object-ui/core@14.1.0
  - @object-ui/types@14.1.0

## 14.0.0

### Minor Changes

- 6a74160: Sharing-rule form: pick, don't type. Three new widget-hint field components make
  the generic object form render pickers where an admin previously had to type
  machine data (driven by the framework `widget` hints on `sys_sharing_rule`;
  generalizes the `capability-multiselect` pattern). All degrade to the underlying
  `type` renderer when a widget is unregistered.

  - **`object-ref`** — choose a registered object by name (searchable `Combobox`),
    backed by the new `DataSource.getObjects()` (`ObjectStackAdapter` lists code-
    and DB-defined objects via `/api/v1/meta/object`), falling back to a
    `sys_metadata` query. Stores the object's `name`.
  - **`filter-condition`** — a visual criteria builder (`FilterBuilder`) scoped to
    the fields of the object chosen in a sibling field (via `getObjectSchema`),
    round-tripping the stored **MongoDB-style** FilterCondition JSON. Criteria the
    builder can't represent (or invalid JSON) fall back to a raw-JSON editor, with
    an always-available "Edit as JSON" toggle — nothing is hidden or lost.
  - **`recipient-picker`** — a record picker whose target object follows a sibling
    `recipient_type` (`user`→sys_user, `team`→sys_team, `business_unit`/
    `unit_and_subordinates`→sys_business_unit, `position`→sys_position), storing the
    value the evaluator matches on (a record id, or the position **name**). Resets
    the stored id when the type changes.

  Wiring: the three keys join `DATA_SOURCE_FIELD_TYPES` (form.tsx) so the form
  threads `dataSource` + `dependentValues` to them, and `INLINE_EXCLUDED_FIELD_TYPES`
  (they're authored in the record form, not a grid cell). `DataSource.getObjects()`
  is optional on the interface; the ObjectStack adapter implements it.

### Patch Changes

- Updated dependencies [443360a]
- Updated dependencies [86c69c3]
- Updated dependencies [05e56ca]
- Updated dependencies [6a74160]
  - @object-ui/core@14.0.0
  - @object-ui/types@14.0.0

## 13.2.0

### Patch Changes

- e492b9d: Permission sets — pure separation of **design** (Studio) and **assignment**
  (Setup), per ADR-0056 / epic #2398. A `sys_permission_set` used to render its six
  authorization facets in Setup as raw `[Object]` / JSON textareas, and only
  objects+fields were editable in Studio; this reworks both surfaces.

  **Setup (assign + read-only):**

  - The six facets (`object_permissions`, `field_permissions`, `system_permissions`,
    `row_level_security`, `tab_permissions`, `admin_scope`) now render read-only on
    the `sys_permission_set` record page as a compact summary (counts, or capability
    chips) plus a **“Design in Studio →”** deep-link into the structured editor
    (`/apps/:appName/metadata/permission/:setName`, env scope). No `[Object]`, no
    JSON — in the record view, inline edit, and the create/edit form. Implemented as
    a `permission-facet-link` field widget stamped onto the six fields via the single
    `ObjectStackAdapter.getObjectSchema` choke point and honored by DetailSection +
    the record form.
  - User assignment (add/remove via `sys_user_permission_set`) is surfaced directly
    on the Setup record page.

  **Studio (design every facet):** the permission matrix editor gains structured
  editors for the facets that were JSON-only —

  - **System Capabilities**: a multi-select over the live `sys_capability` registry
    (scope-grouped, labelled chips).
  - **Row-Level Security**: per-policy rows (object · operation · enabled) with CEL
    USING/CHECK.
  - **Tab Visibility**: per-tab `visible | hidden | default_on | default_off`.
  - **Delegated Admin Scope**: business-unit + subtree, manage-assignments /
    -bindings / author-env-sets toggles, and an assignable-permission-sets allowlist.
    Assignment was moved out of the editor (it is now a Setup act) — the editor is
    purely a design surface.

  Storage/types are unchanged; editors read/write the draft’s existing parsed
  fields and tolerate legacy JSON strings on load. Note: env-scope metadata saves of
  these facets do not yet project onto the queryable `sys_permission_set` data
  record the Setup summary reads, so a fresh Studio edit isn’t reflected in Setup’s
  read-only view until the projection refreshes — tracked as a framework follow-up
  (enforcement reads the authoritative metadata).

  - @object-ui/types@13.2.0
  - @object-ui/core@13.2.0

## 13.1.0

### Patch Changes

- @object-ui/types@13.1.0
- @object-ui/core@13.1.0

## 13.0.0

### Patch Changes

- Updated dependencies [619097e]
  - @object-ui/types@13.0.0
  - @object-ui/core@13.0.0

## 12.1.0

### Patch Changes

- Updated dependencies [c31874d]
  - @object-ui/types@12.1.0
  - @object-ui/core@12.1.0

## 12.0.0

### Patch Changes

- Updated dependencies [226fde9]
- Updated dependencies [e4de456]
  - @object-ui/types@12.0.0
  - @object-ui/core@12.0.0

## 11.5.0

### Minor Changes

- 1072701: Import wizard: use registered server-side import mappings (framework #2611). When an object has `mapping` metadata artifacts targeting it, the wizard shows a "Saved mapping" selector; picking one hands rename + transforms + write semantics to the server (the artifact is authoritative), replaces the manual column table with a read-only summary of the mapping, and submits `mappingName` over source-header rows (mutually exclusive with the inline column rename). `ImportRequestOptions` gains `mappingName`; the objectstack adapter gains `listImportMappings(objectName)` (feature-detected — the selector simply doesn't appear when unsupported). New `grid.import.*` strings added across all locales.

### Patch Changes

- Updated dependencies [9255686]
- Updated dependencies [1072701]
  - @object-ui/types@11.5.0
  - @object-ui/core@11.5.0

## 11.4.0

### Patch Changes

- c0164ad: fix(studio): surface spec-validation failures on the field at save/publish

  When a Studio metadata draft failed spec validation, the designer got a single
  opaque banner (and, on a partial publish, a false "published!" toast) — the
  server was already returning field-anchored issues, but the client threw them
  away. Two problems, both fixed:

  - **`parseError` (data-objectstack)** read `String(body.error)`, which yields
    `"[object Object]"` for the dispatcher's object-shaped error, and ignored the
    validation `issues`. It now reads the message from either shape (string or
    `{ message }`) and exposes `MetadataError.issues`, accepting all live server
    shapes — top-level `body.issues` (REST server) and `error.details.issues`
    (HTTP dispatcher).

  - **Studio save/publish (app-shell)** now render those issues **field-anchored**.
    A new `formatMetadataError` helper turns a caught error into one line per
    offending field (`• fields.amount.type — Invalid option: …`); the save banners
    render it with `whitespace-pre-line`. `doPublish` no longer claims success when
    the response carries `data.failed[]` — it lists which drafts failed and why
    (the server returns 200 with the failures buried, so the UI used to swallow
    them). `formatPublishFailures` formats those per-draft.

  Verified end-to-end against a live backend: an invalid object draft returns 422
  with field-anchored issues, and the Studio banner shows
  `• fields.amount.type — Invalid option: expected one of "text"|…` instead of a
  generic message. Unit-tested: `parseError` on the dispatcher shape, and the
  `formatMetadataError` / `formatPublishFailures` helpers.

- Updated dependencies [8bf6295]
- Updated dependencies [1948c5b]
- Updated dependencies [c38d107]
  - @object-ui/types@11.4.0
  - @object-ui/core@11.4.0

## 11.3.0

### Patch Changes

- Updated dependencies [d23d6eb]
  - @object-ui/core@11.3.0
  - @object-ui/types@11.3.0

## 11.2.0

### Patch Changes

- Updated dependencies [9e7a986]
- Updated dependencies [1311749]
  - @object-ui/core@11.2.0
  - @object-ui/types@11.2.0

## 11.1.0

### Patch Changes

- @object-ui/types@11.1.0
- @object-ui/core@11.1.0

## 7.3.0

### Patch Changes

- @object-ui/types@7.3.0
- @object-ui/core@7.3.0

## 7.2.0

### Patch Changes

- Updated dependencies [d23db5c]
  - @object-ui/types@7.2.0
  - @object-ui/core@7.2.0

## 7.1.0

### Patch Changes

- Updated dependencies [677f7ed]
- Updated dependencies [08c47da]
- Updated dependencies [a71be60]
- Updated dependencies [cb03bc3]
  - @object-ui/types@7.1.0
  - @object-ui/core@7.1.0

## 7.0.0

### Minor Changes

- 30ee761: feat(studio): surface pending drafts on the package detail (ADR-0033)

  After an AI builds an app, its objects/views land as drafts bound to the app package — but Studio's active-only browsers hid them, so the package looked empty and there was no obvious way to find what to review/publish.

  - `MetadataClient.listDrafts({ packageId?, type? })` calls the new `GET /api/v1/meta/_drafts` endpoint, returning pending draft headers (with `packageId`).
  - The package detail sheet (PackagesPage) now shows a **Pending changes** section listing each drafted item, each linking to the existing per-item review/diff (`?review=1`) so the user can publish it. A just-built app package is no longer shown as empty.

- 053c948: feat: ADR-0047 — interface pages, visualization switcher, and Airtable-parity filters

  End-user interface/list pages reach full rendering and authoring parity:

  - **Spec tabs + visualization switcher** — `ObjectView` now forwards
    `viewDef.tabs` (stored/served but never rendered) and `viewDef.appearance`
    (`allowedVisualizations` whitelist), turning on the dormant `ViewSwitcher` when
    more than one type is whitelisted; effective options = author whitelist ∩
    capability-resolvable types (kanban needs `groupBy`, calendar a date field, …).
    `ListView` accepts the canonical `ViewFilterRule[]` tab-filter shape.
  - **User filters** — render only when `userFilters` is explicitly configured;
    selections (dropdown values + active tab) mirror into `uf_*` URL params and
    restore on load, so filtered lists survive reload and are shareable.
  - **Toolbar polish** — the visualization switcher becomes a compact right-side
    "Grid ▾" dropdown inside the tool cluster (no extra row); filter tabs and
    dropdown filters are mutually exclusive.
  - **Studio authoring** — a usable, schema-driven interface-page inspector
    (collapsible sections honoured, array-of-enum → multi-select, a None/Tabs/
    Dropdown `filter-mode` selector where None maps to ABSENCE of `userFilters`),
    and the Design/Preview tabs render the live list via `InterfaceListPage`
    (including a non-empty grid when the source view is hollow).

- 5332639: feat(app-shell): render full object forms (incl. master-detail) in screen-flow wizard steps

  `FlowRunner` now renders an `object-form` screen step: when the paused screen
  carries `kind: 'object-form'`, it mounts the real `<ObjectForm>` for the named
  object (auto-routing to `MasterDetailForm` for inline child collections),
  prefilled from the step's `defaults`. The form persists itself (atomic
  master-detail batch), then resumes the run with the saved record id bound to the
  step's `idVariable`. `dataSource`/`objects` are threaded through all three
  `FlowRunner` mount points.

  Also fixes three pre-existing bugs this surfaced (each affects normal forms too):

  - **plugin-form**: `ObjectForm` now forwards `initialValues`/`initialData` when
    routing to `MasterDetailForm`, so prefilled header values are no longer
    dropped on master-detail create forms.
  - **fields**: `PercentField` treated values as `0–1` fractions (`value × 100`),
    so a `0–100` field (e.g. `probability` default `50`) rendered as `5000%` —
    exceeding `max=100`, which makes HTML5 constraint validation mark the field
    `:invalid` and silently block the whole form's submit. It now treats a field
    declaring `max > 1` as the `0–100` whole-number convention, matching the
    read-side formatter.
  - **data-objectstack**: `ObjectStackAdapter.batchTransaction` now sends
    `credentials: 'include'`, so master-detail batch saves authenticate under the
    console's cookie session (previously every batch save 401'd).

- d16566f: Atomic master-detail create via the cross-object transactional batch endpoint (ObjectStack #1604).

  When the server exposes the transactional batch endpoint, a NEW parent record and its child line items are now persisted in ONE server transaction — commit all or roll back all — instead of the previous client-orchestrated "create parent → create children → best-effort cleanup on failure" sequence.

  **`@object-ui/data-objectstack` — `ObjectStackAdapter.batchTransaction(operations)`**

  - New method posting `{ operations }` to `POST /api/v1/batch`. Operations run in one server transaction. A field value of `{ $ref: <earlier op index> }` resolves to that op's generated id, so a child can reference its parent created earlier in the same batch (master-detail FK). Throws `ObjectStackError('BATCH_ERROR')` on a non-2xx response.

  **`@object-ui/plugin-form`**

  - `MasterDetailForm` now detects `dataSource.batchTransaction` and, on a NEW parent, builds one atomic batch (parent at index 0, each child FK set to `{ $ref: 0 }`) via the new pure helper `buildMasterDetailBatch`. Client-side total rollups are merged into the parent payload before the batch. Edit mode and adapters without `batchTransaction` keep the existing client-orchestrated path.
  - `ObjectForm` gained a `submitHandler` hook: when supplied, the form validates and hands the collected values to the host instead of calling `dataSource.create` / `dataSource.update`. `MasterDetailForm` uses it to own the atomic parent+children write while the parent fields are still rendered by `ObjectForm`.

  **`@object-ui/types`**

  - `ObjectFormSchema.submitHandler?: (values) => any | Promise<any>` — typed override for host-owned persistence.

  Pairs with the framework-side ambient-transaction fix (ObjectQL `AsyncLocalStorage` transaction propagation) and the `/api/v1/batch` endpoint added in `@objectstack/rest`.

### Patch Changes

- b99d9bd: ADR-0048: package-scope the Studio metadata editor read. Two installed packages
  may ship metadata with the same `type`/`name`; the editor now resolves the right
  one instead of first-match.

  - `MetadataClient`: `layered()` and `getDraft()` accept `{ packageId }`, and
    `get()` emits the `package` query param (→ server prefer-local, `?package=`).
  - `ResourceListPage`: each item's edit link carries its owning package
    (`?package=<row._packageId>`), so even the unscoped "all" list disambiguates;
    falls back to the workspace suffix for runtime/overlay-only rows.
  - `ResourceEditPage`: reads `?package=` and scopes the layered + draft read to
    that package. (The route's `:appName` is the Studio app, not the edited item's
    owner, so the scope must come from the URL, not the active app.)

- a58c6b8: fix(datasource): exclude form-family views from `listViews()`

  `OBJECTSTACKDataSource.listViews(objectName)` feeds the object list-view
  switcher (`ObjectView` → `ViewTabBar`), but returned **every** view bound to
  the object — including form-family ones. With the backend now exposing each
  view as an independent **ViewItem** carrying a `viewKind` discriminant
  (ADR-0017, "Object has-many View"), a form view such as `crm_activity.default`
  (expanded from `formViews.default`) leaked in as a spurious switcher tab and,
  when opened, fell back to the default grid.

  `listViews()` now filters out `viewKind` `form`/`detail` items so only
  list-family views reach the switcher. Bare view specs without a `viewKind`
  (legacy artifacts and user-saved views) are still treated as list views.

- Updated dependencies [5976ba3]
- Updated dependencies [eaccefd]
- Updated dependencies [f7f325d]
- Updated dependencies [c12986e]
- Updated dependencies [71d7ce0]
- Updated dependencies [053c948]
- Updated dependencies [ddbe4a2]
- Updated dependencies [2d47e94]
- Updated dependencies [9049bbe]
- Updated dependencies [cb2fdb1]
- Updated dependencies [c3749eb]
- Updated dependencies [6cfa330]
- Updated dependencies [ad8ade6]
- Updated dependencies [d54346c]
- Updated dependencies [3870c20]
- Updated dependencies [b88c560]
- Updated dependencies [d16566f]
- Updated dependencies [1394e34]
- Updated dependencies [300d755]
- Updated dependencies [4eb9cb6]
- Updated dependencies [7c239fd]
- Updated dependencies [858ad94]
- Updated dependencies [2270239]
- Updated dependencies [8d1195d]
  - @object-ui/core@7.0.0
  - @object-ui/types@7.0.0

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3
- @object-ui/core@6.2.3

## 6.2.2

### Patch Changes

- @object-ui/types@6.2.2
- @object-ui/core@6.2.2

## 6.2.1

### Patch Changes

- @object-ui/types@6.2.1
- @object-ui/core@6.2.1

## 6.2.0

### Minor Changes

- ec8dcde: Add visual editing for object & field metadata in the Setup app.

  **`@object-ui/data-objectstack`** — new `MetadataClient` class. A thin,
  auth-friendly wrapper over the framework's `/api/v1/meta/*` REST
  endpoints (list / get / save / reset / history), with first-class
  support for `If-Match` (optimistic concurrency), `X-Actor` (audit
  attribution), environment-scoped paths
  (`/environments/:id/meta/*`), and 404-as-null semantics. Use
  `new MetadataClient({ baseUrl })` or `client.withEnvironment(id)` to
  target a specific environment.

  **`@object-ui/plugin-designer`** — two new route-ready pages that
  together close the "Data Model" management loop in the Setup app:

  - `MetadataObjectsPage` — lists every object schema (via
    `MetadataClient.list('object')`), renders the existing
    `ObjectManager`, and persists edits/deletes through PUT/DELETE on
    the metadata REST surface. Honours `allowRuntimeCreate` and
    surfaces server errors verbatim.
  - `MetadataFieldsPage` — for a single object, loads the parent
    schema, projects `fields` into the existing `FieldDesigner`, and
    on save merges the edited field map back into the object before
    issuing a single PUT. Preserves unknown per-field attributes so
    nothing the designer doesn't render is dropped.

  Both pages take either a pre-built `MetadataClient` or a
  `MetadataClientConfig`; neither imposes a routing convention on the
  host app — they can be mounted anywhere (e.g.
  `/apps/setup/_meta/object` and `/apps/setup/_meta/object/:name/fields`).

  These additions do not modify the underlying `ObjectManager` /
  `FieldDesigner` components, which remain pure controlled-input
  components usable in non-REST contexts.

### Patch Changes

- fe3c1d3: Metadata Admin engine — unified UI for all 27 metadata types.

  A generic, schema-driven admin shell that replaces the old per-type
  bespoke pages with a single registry-driven engine. Admins can now browse,
  create, override, diff, and roll back every registered metadata type from
  the Setup app → _All Metadata Types_.

  ### New: `@object-ui/app-shell` views/metadata-admin

  - **`MetadataDirectoryPage`** — auto-grouped tile directory by domain, with
    free-text search, domain chips, and a _Writable only_ filter.
  - **`MetadataResourceListPage` / `MetadataResourceEditPage` / `…CreatePage` / `…HistoryPage`** —
    generic CRUD shell. Uses the new `/meta/types` schema field to render
    SchemaForm; uses `?layers=code,overlay,effective` to power a 3-state diff
    tab; uses `/references` to warn before destructive deletes.
  - **`MetadataQuickFind`** — Cmd+Shift+M palette searching across types and
    items.
  - **`PermissionMatrixEditor`** — Salesforce-style matrix custom editor for
    `type=permission`. Objects × CRUD/VAMA/lifecycle columns with cascade
    rules (viewAllRecords ⟹ allowRead, etc.), expandable per-object field
    R/W subtable, bulk-set (R / CRUD / All / None), filter, _only granted_
    toggle, destructive-change confirmation, profile switch.
  - **`DesignerEditorWrapper`** — generic load–edit–save shell that hosts any
    bespoke designer (`ObjectViewConfigurator`, `DashboardEditor`,
    `PageCanvasEditor`, …). Handles dirty tracking, Save / Reset / Refresh /
    History buttons, and the read-only fallback when `allowOrgOverride` is
    false.
  - **`i18n.ts`** — bilingual (`en-US`, `zh-CN`) bundle for built-in type
    labels, domain labels, and engine UI strings, with `detectLocale()` and a
    `t(key)` helper.

  ### New routing variant

  - App nav now supports `{ type: 'component', componentRef, params? }` items.
    `AppContent` resolves them through the existing `ComponentRegistry`.
  - Built-in components registered: `metadata:directory`, `metadata:resource`,
    `metadata:object/edit` (FieldsPage), `metadata:permission/edit`
    (PermissionMatrixEditor), and lazy designer wrappers for view / dashboard
    / page.

  ### Plugin-designer

  - Lazy-exported `ObjectManager`, `FieldDesigner`, `ObjectViewConfigurator`,
    `DashboardEditor`, `PageCanvasEditor`, `MetadataObjectsPage`, and
    `MetadataFieldsPage` so the engine can mount them on demand.

  The temporary `/dev/meta` route is removed. Setup app navigation flows
  through the new component routes.

  - @object-ui/types@6.2.0
  - @object-ui/core@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/core@6.1.0
  - @object-ui/types@6.1.0

## 6.0.4

### Patch Changes

- @object-ui/types@6.0.4
- @object-ui/core@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3
- @object-ui/core@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2
- @object-ui/core@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1
- @object-ui/core@6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0
- @object-ui/core@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2
- @object-ui/core@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1
- @object-ui/core@5.4.1

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0
  - @object-ui/core@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2
- @object-ui/core@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1
- @object-ui/core@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0
- @object-ui/core@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1
- @object-ui/core@5.2.1

## 5.2.0

### Minor Changes

- de0c5e6: Add `DataSource.bulkDelete(resource, ids)` as the symmetric counterpart
  to `bulkUpdate`. Implemented in `data-objectstack` via the client's
  `deleteMany` primitive with a per-id fallback that emulates
  `continueOnError` semantics for older clients.

  Extract the bulk-vs-per-row decision into a reusable
  `executeBulkBatch(input, ops)` helper in `@object-ui/core`:

  - Single decision tree shared by both update and delete fast paths.
  - Bulk success → no per-row pass.
  - Bulk partial-count → aggregate batch error.
  - Bulk throw → per-row fallback so users still get id-level error detail.

  `useBulkExecutor` in plugin-grid now uses the helper for both `update`
  and `delete` batches, cutting "delete 500 selected rows" from 500 HTTP
  requests down to ~3.

- 9997cae: DataSource: add optional `bulkUpdate(resource, ids, patch)` for "same patch, many rows" interactions (Slack "mark all as read", Linear "archive selected"). The ObjectStack adapter routes to `POST /api/v1/data/:object/updateMany` so the client pays one HTTP/auth/RLS round-trip instead of N parallel PATCHes, eliminating mark-all-read jank on inboxes with 50+ unread.

  AppHeader's `markAllRead` now prefers `bulkUpdate`, with a transparent fallback to the per-id loop for adapters that don't implement the helper.

### Patch Changes

- Updated dependencies [de0c5e6]
- Updated dependencies [9997cae]
- Updated dependencies [70b5570]
- Updated dependencies [d1442e3]
  - @object-ui/types@5.2.0
  - @object-ui/core@5.2.0

## 5.1.1

### Patch Changes

- @object-ui/types@5.1.1
- @object-ui/core@5.1.1

## 5.1.0

### Minor Changes

- 5b80cfd: feat: Optimistic Concurrency Control (OCC) on DataSource writes

  `DataSource.update()` and `DataSource.delete()` now accept an optional fourth /
  third argument `opts?: { ifMatch?: string }`. When supplied, adapters forward
  the token to the backend; servers that implement OCC (e.g. ObjectStack
  `>=4.2.0`) compare it against the record's current `updated_at` and reject
  with `409 CONCURRENT_UPDATE` on mismatch, preventing silent overwrites in
  multi-user editing scenarios.

  **`@object-ui/data-objectstack`**

  - Exports `ConcurrentUpdateError` (carries `currentVersion` and
    `currentRecord`) and `isConcurrentUpdateError()` type guard.
  - `update()` / `delete()` accept `opts.ifMatch` and forward it via the
    `@objectstack/client` data API (header: `If-Match`). Requires
    `@objectstack/client@>=4.1.2` for the header to reach the server;
    older clients silently drop the option and fall back to today's
    "last writer wins" behaviour.
  - Adapter-level error handling maps a 409 with `code === 'CONCURRENT_UPDATE'`
    into a typed `ConcurrentUpdateError` so callers can detect and recover
    from conflicts without parsing the wire format.

  **`@object-ui/core`**

  - `ApiDataSource.update()` and `.delete()` accept `opts.ifMatch` and emit
    the `If-Match` HTTP header.

  UI consumers (Detail view, inline cell-edit) will be wired in a follow-up
  patch to capture `updated_at` at load time, pass it as `ifMatch` on save,
  and present a Reload / Overwrite / Cancel dialog on conflict.

### Patch Changes

- Updated dependencies [cf30cc2]
- Updated dependencies [5b80cfd]
  - @object-ui/types@5.1.0
  - @object-ui/core@5.1.0

## 5.0.2

### Patch Changes

- @object-ui/types@5.0.2
- @object-ui/core@5.0.2

## 5.0.1

### Patch Changes

- @object-ui/types@5.0.1
- @object-ui/core@5.0.1

## 5.0.0

### Minor Changes

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

- Updated dependencies [7213027]
  - @object-ui/types@5.0.0
  - @object-ui/core@5.0.0

## 4.8.0

### Patch Changes

- @object-ui/types@4.8.0
- @object-ui/core@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0
- @object-ui/core@4.7.0

## 4.6.0

### Patch Changes

- @object-ui/types@4.6.0
- @object-ui/core@4.6.0

## 4.5.0

### Patch Changes

- Updated dependencies [ab5e281]
  - @object-ui/types@4.5.0
  - @object-ui/core@4.5.0

## 4.4.0

### Patch Changes

- @object-ui/types@4.4.0
- @object-ui/core@4.4.0

## 4.3.1

### Patch Changes

- @object-ui/types@4.3.1
- @object-ui/core@4.3.1

## 4.3.0

### Patch Changes

- @object-ui/types@4.3.0
- @object-ui/core@4.3.0

## 4.2.1

### Patch Changes

- @object-ui/types@4.2.1
- @object-ui/core@4.2.1

## 4.2.0

### Patch Changes

- @object-ui/types@4.2.0
- @object-ui/core@4.2.0

## 4.1.0

### Patch Changes

- @object-ui/types@4.1.0
- @object-ui/core@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12
- @object-ui/core@4.0.12

## 4.0.11

### Patch Changes

- @object-ui/types@4.0.11
- @object-ui/core@4.0.11

## 4.0.10

### Patch Changes

- @object-ui/types@4.0.10
- @object-ui/core@4.0.10

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9
- @object-ui/core@4.0.9

## 4.0.8

### Patch Changes

- @object-ui/types@4.0.8
- @object-ui/core@4.0.8

## 4.0.7

### Patch Changes

- Updated dependencies [7c9b85c]
  - @object-ui/core@4.0.7
  - @object-ui/types@4.0.7

## 4.0.6

### Patch Changes

- @object-ui/types@4.0.6
- @object-ui/core@4.0.6

## 4.0.5

### Patch Changes

- @object-ui/types@4.0.5
- @object-ui/core@4.0.5

## 4.0.4

### Patch Changes

- @object-ui/types@4.0.4
- @object-ui/core@4.0.4

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

- Updated dependencies [4be43e2]
  - @object-ui/types@4.0.3
  - @object-ui/core@4.0.3

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1
- @object-ui/core@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0
  - @object-ui/core@4.0.0

## 3.4.0

### Patch Changes

- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
  - @object-ui/types@3.4.0
  - @object-ui/core@3.4.0

## 3.3.2

### Patch Changes

- @object-ui/types@3.3.2
- @object-ui/core@3.3.2

## 3.3.1

### Patch Changes

- @object-ui/types@3.3.1
- @object-ui/core@3.3.1

## 3.3.0

### Patch Changes

- @object-ui/types@3.3.0
- @object-ui/core@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0
- @object-ui/core@3.2.0

## 3.1.5

### Patch Changes

- @object-ui/types@3.1.5
- @object-ui/core@3.1.5

## 3.1.4

### Patch Changes

- @object-ui/types@3.1.4
- @object-ui/core@3.1.4

## 3.1.3

### Patch Changes

- @object-ui/types@3.1.3
- @object-ui/core@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2
- @object-ui/core@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1
  - @object-ui/core@3.1.1

## 3.0.3

### Patch Changes

- @object-ui/types@3.0.3
- @object-ui/core@3.0.3

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2
- @object-ui/core@3.0.2

## 3.0.1

### Patch Changes

- @object-ui/types@3.0.1
- @object-ui/core@3.0.1

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
  - @object-ui/core@3.0.0

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

### Patch Changes

- Updated dependencies [b859617]
  - @object-ui/types@2.0.0
  - @object-ui/core@2.0.0

## 0.3.1

### Patch Changes

- Maintenance release - Documentation and build improvements
- Updated dependencies
  - @object-ui/types@0.3.1
  - @object-ui/core@0.3.1

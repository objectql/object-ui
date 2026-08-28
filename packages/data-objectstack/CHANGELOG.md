# @object-ui/data-objectstack

## 17.6.0

### Minor Changes

- a8411ad: data-objectstack: retire the four remaining `v3.0.0 Deep Integration` modules — `IntegrationManager`, `SecurityManager`, the studio canvas helpers (`createDefaultCanvasConfig` / `snapToGrid` / `calculateAutoLayout`), and the contract helpers (`validatePluginContract` / `generateContractManifest`) — for having zero code consumers outside this package
  
  `src/index.ts`'s `// v3.0.0 Deep Integration modules` banner introduced five
  modules. objectui#4152 / PR #4239 already retired the first,
  `CloudOperations`, for fabricating a plausible success against a client
  namespace that does not exist. This closes out the other four:
  `contracts.ts`, `integration.ts`, `security.ts`, `studio.ts`.
  
  **Not a repeat of #4152's urgency limb.** None of these four fabricated
  anything — `SecurityManager.generateCSPHeader()` really composes a header,
  `snapToGrid` really snaps, `validatePluginContract` really validates. What
  they shared with `CloudOperations` was the other limb: published surface of
  `@object-ui/data-objectstack` with a measured **zero** code consumers outside
  this package, across `packages/`, `apps/` and `examples/` (`.ts`/`.tsx`,
  excluding `node_modules`). The two apparent hits on re-measurement were
  homonyms, not consumers — `packages/plugin-designer/src/PageDesigner.tsx`
  declares its own local `snapToGrid` callback with no import from this
  package, and the `SecurityManager` hits outside this file are prose in
  `CHANGELOG.md`. Under the startup-focus principle a declared capability with
  no producer, no consumer and no business pull is retired, not kept on the
  chance it becomes useful.
  
  **Breaking, in FROM → TO form.** The following are no longer exported from
  `@object-ui/data-objectstack`:
  
  - `IntegrationManager` and its types (`IntegrationConfig`, `IntegrationTrigger`,
    `IntegrationProvider`, `SlackIntegrationConfig`, `EmailIntegrationConfig`,
    `WebhookIntegrationConfig`)
  - `SecurityManager` and its types (`SecurityManagerPolicy`, `CSPConfig`,
    `AuditLogConfig`, `AuditEventType`, `DataMaskingConfig`, `DataMaskingRule`,
    `AuditLogEntry`)
  - `createDefaultCanvasConfig`, `snapToGrid`, `calculateAutoLayout` and their
    types (`StudioCanvasConfig`, `StudioPropertyEditor`,
    `StudioThemeBuilderConfig`, `StudioColorPalette`, `StudioTypographyPreset`,
    `StudioShadowPreset`)
  - `validatePluginContract`, `generateContractManifest` and their types
    (`PluginContract`, `PluginExport`, `PluginAPIContract`,
    `ContractValidationResult`, `ContractValidationError`)
  
  It is a `minor` under this repo's version policy (objectui's own breaking
  changes never declare `major`). Nothing broke that was working: the only
  in-repo construction sites were this package's own `v3-compat.test.ts` (which
  exercised the modules directly) and `spec-symbol-batch6.test.ts` (which only
  guarded `SecurityManagerPolicy`'s name against colliding with the spec's
  unrelated `SecurityPolicy` — that guard is removed along with its subject).
  
  **No compile-compat stub was left**, for the same reason #4152 left none: with
  no consumer to keep compiling, a stub would be a second phantom surface
  guarding the first.
  
  **The banner and the compat-test title stop claiming a v3.** `index.ts`'s
  `// v3.0.0 Deep Integration modules` banner had nothing left under it once
  these four went, so it is removed rather than retitled.
  `v3-compat.test.ts` — titled "v3.0.0 compatibility tests for @objectstack
  dependencies" against a resolved `@objectstack` family of `17.0.0-rc.6` even
  before this change — is not an empty shell (one block, `PaginatedResult API`,
  never depended on any of the five retired modules), so it stays and is
  retitled instead of deleted.
  
  A negative pin
  (`src/v3-deep-integration-retired-4241.pin.test.ts`) replaces the retired
  `v3-compat.test.ts` cases and fails if any of the thirty retired names
  returns — reading both the runtime export list (which catches the seven
  class/function exports) and `index.ts`'s source text (the only instrument
  that can catch a returning `export type`).

### Patch Changes

- 1ef236e: `@object-ui/data-objectstack` stops publishing its `src/` tree
  
  The manifest's `files` array listed `src` alongside `dist`, so every published tarball carried all 43 source files — 38 of them `*.test.ts`. It had been that way since the package's first commit (`780a1b993`), never added for a consumer, and objectui#4006 recorded the same shape without acting on it: its scope was the `*.test.d.ts` half that the build program emitted into `dist`, and its own triage note graded this half as tarball weight rather than a break.
  
  Nothing in the published surface reached those files, which is why no consumer changes in either direction. Measured on a cleanly rebuilt `dist`, all four ways in are closed: the `exports` map has one entry (`.`) and every condition under it targets `dist`; `main` / `module` / `types` are `./dist/index.js`, `./dist/index.js`, `./dist/index.d.ts`; the repo and the docs teach only the root specifier, and no `@object-ui/data-objectstack/src/...` deep import exists anywhere (the `src` paths in sibling `vite.config.ts` / `vitest.config.mts` files are workspace aliases resolved through `path.resolve()` against the source tree, which no `files` array shapes); and the tarball holds no sourcemap that could point back at `src`, since `tsup.config.ts` sets `sourcemap: false` and its bundled `dts` writes no `.d.ts.map` — the built `dist` contains four files, zero `.map` among them, and zero occurrences of `sourceMappingURL` or `../src/`.
  
  `npm pack --dry-run` across the change, on the same `dist`:
  
  | | before | after |
  | --- | --- | --- |
  | entries | 51 | 8 |
  | unpacked | 1356830 B | 719876 B |
  | tarball | 393379 B | 222157 B |
  
  43 files leave, none arrives, and every surviving entry is byte-identical apart from the edited `package.json`: `dist/index.{js,cjs,d.ts,d.cts}`, `README.md`, `CHANGELOG.md`, `LICENSE`, `package.json`. The 43 are the 38 tests plus the five modules they cover (`index.ts`, `errors.ts`, `metadata-client.ts`, `userState.ts`, `cache/MetadataCache.ts`), whose published form remains the bundled `dist/index.js`.
- cf4f8a6: `MetadataClient.layered()` now reads the three-layer view from its declared path,
  `GET /meta/:type/:name/layers`, instead of flagging the ordinary item read.
  
  The consumer half of objectstack#5882 (ruled B by the maintainer; the server half
  landed in objectstack#6596 and shipped in `@objectstack/spec@17.0.0`). The layered
  projection — packaged baseline vs tenant overlay vs merged effective, which is
  what the Studio metadata editor's comparison tabs render — used to be reached by
  hanging a query flag on `GET /meta/:type/:name`. One route therefore answered two
  unrelated representations chosen by a query parameter, while `packages/spec`
  declared only the unflagged one: anything generating a client from the route
  table produced a parser that was simply wrong for the flagged call. The
  projection now has a path of its own and a response schema of its own
  (`GetMetaItemLayeredResponseSchema`).
  
  Same body, same envelope, so nothing in the editor changes shape: `code`,
  `overlay`, `overlayScope`, `effective`, the load-time `_diagnostics` and the full
  ADR-0010 protection envelope all still arrive on one round trip, and `?package=`
  (ADR-0048) is still threaded — the two entry points are served by ONE handler
  upstream precisely so the deprecation window's promise holds. The retired
  spelling still answers during that window, marked with RFC 9745 `Deprecation` and
  an RFC 8288 `Link: rel="successor-version"` pointing here, so this migration is
  safe against a lagging backend for as long as the window stays open, and it is
  what lets the maintainer close it.
  
  One behaviour delta rides along, and it is the server's design rather than a
  choice made here: the retired flag FELL THROUGH to the plain item read when the
  backend's protocol implementation had no layered support, answering the
  `{ type, name, item }` envelope. A dedicated path refuses to answer a different
  resource under this one's declared shape and returns 501 `NOT_IMPLEMENTED`, which
  surfaces as a failed read instead of a comparison view whose `code` and `overlay`
  are silently blank.
  
  The request is built in this package rather than delegated to
  `@objectstack/client` because the SDK expresses no layered read in either
  spelling — the framework's REST route ledger records the route as `server-only`,
  "consumed by objectui over plain HTTP", and whether the SDK should express it is
  an open upstream product call. The new path expectation is derived from the
  installed `@objectstack/spec` route table, and a ratchet keeps any shipped source
  file or skills guide from reaching the projection by query flag again.
- 3d053bb: The Studio's overlay-layer badge stops printing the producer's raw scope value
  
  objectui#4982. `MetadataLayered.overlayScope` was typed `string | null` under a comment naming its
  vocabulary as `organization | environment | package` — three spellings the producer has never
  emitted. The real vocabulary lives in `@objectstack/spec`'s `GetMetaItemLayeredResponseSchema`
  (`z.enum(['org', 'env']).nullable()`), and the framework's two assignment sites write `'org'` /
  `'env'`. Because the declared type was `string`, no compiler anywhere had an opinion, so the wrong
  comment was the only description of the field a reader had.
  
  `overlayScope` is now the spec union, derived by indexing the published response type rather than
  restated locally (a restatement is the fork `check:spec-symbol-derivation` rejects); the alias ships
  as `MetadataOverlayScope`.
  
  User-visible half: `LayeredDiff`'s overlay badge rendered that value straight to screen while the
  sibling artifact / none / merged badges all went through `translateConsoleValue`, and
  `CONSOLE_VALUE_ZH.layer` had no entry for either value the field can hold. One badge therefore had
  two languages depending on the data — a zh-CN admin opening any overlaid metadata item read `org` /
  `env`, while an un-overlaid one read 「已设」. The badge now translates like its three siblings, with
  「组织」/「环境」 added to the layer table. That table's overlay-scope half is keyed by the spec union,
  so a scope the spec adds later fails `type-check` until it has a label instead of quietly reaching a
  badge in English. `translateConsoleValue` remains zh-only for every group, as before — extending it
  to the other locale packs is a separate decision and not part of this change.
- d871f8e: A view personalization overlay no longer freezes the view it was laid over. `ObjectView`'s
  `persistViewPatch` sends `{ ...baseViewDef, ...patch }`, so a row written by a mere column
  drag or sort change stored the view's whole body — its effective `filter`, `columns`,
  `label`, `type`, `isDefault` — as of that moment, and the display merge
  (`{ ...source, ...override }`) then let that snapshot outrank the source view indefinitely:
  an admin edited a view's filter and everyone who had ever resized a column silently kept the
  old filter, with nothing reporting it.
  
  An overlay now contributes only the keys it owns — `rowHeight`, `sort`, `hiddenFields`,
  `columnState`, `inlineEdit` (`VIEW_OVERLAY_OWNED_KEYS`, new export from
  `@object-ui/data-objectstack` alongside `narrowPersonalizationOverlay`) — so a later change
  to the source view reaches every user, including those whose stored row still carries the
  old snapshot: rows written before this change stop shadowing the source on the next read,
  with no migration to run and nothing rewritten at rest. A genuine saved view's own body is
  untouched — it is classified by the same predicate `listViews()` already excludes overlay
  rows by, so a row cannot be an overlay for one reader and a saved view for the other
  (objectui#5233, ruled on objectstack#7494).
- a0b9e91: A system (code-defined) view's personalization overlay row no longer masquerades as a user-created saved view.
  
  Toggling density / sort / hidden columns / column widths / inline-edit on a code-defined view persists a row under the same `type='view'` metadata namespace a genuinely saved view lives in, keyed by the same id (`ObjectStackAdapter.updateViewConfig`). `listViews()` previously returned that row indistinguishably from a real saved view, so `ObjectView`'s `isSystem = !saved` check flipped to `false` and the tab gained Rename / Delete / Set-default / Pin against a view that lives in code — `handleDeleteView` would even call `dataSource.deleteView` on it.
  
  Two layers now keep the two kinds of rows apart:
  
  - **Write side**: `updateViewConfig` — the only production writer of personalization overlays — stamps an explicit `_isOverride: true` discriminant on every row it saves, UNLESS the write targets an already-saved view's own row (see below).
  - **Read side**: `listViews()` excludes any row carrying that marker, and (for rows already persisted before this fix shipped) a best-effort legacy shape: a flat body with a `viewKind` the platform can only have server-side-backfilled from a registry (code-defined) baseline — a genuine runtime-created saved view never has one.
  
  `listViewOverrides()` (the reader `ObjectView` uses to merge these settings back into the live view for display) is unchanged — it is supposed to keep seeing overlay rows.
  
  The overlay this stores is **org-wide shared view settings**, not a per-user preference (a true per-user scope is a parked platform-side v18 direction) — comments describing it as "personal" have been corrected to say so.
  
  **Follow-up fix (same card, post-review):** `updateViewConfig`'s ONE call site (`ObjectView`'s toolbar-driven toggle) fires for a toggle on EITHER a system view OR an already-saved view — a saved view whose own toolbar the user toggles writes to that same view's own row. Stamping the overlay marker unconditionally there would flag the user's own saved view as an overlay and make `listViews()` exclude it on the very next read, i.e. the saved view would vanish from the switcher the moment its density was adjusted. `updateViewConfig` gains an optional `opts.isSavedView` parameter (also added to the `DataSource` interface in `@object-ui/types`); `ObjectView` passes it from the same `isSavedViewId` classification its readonly gate and mutating handlers already use, and the marker is withheld when it's true.
- Updated dependencies [88085e3]
- Updated dependencies [2533ec5]
- Updated dependencies [bbe8b86]
- Updated dependencies [8477be5]
- Updated dependencies [279fb13]
- Updated dependencies [ad07b65]
- Updated dependencies [41f498b]
- Updated dependencies [e1d4251]
- Updated dependencies [1184192]
- Updated dependencies [a2a9747]
- Updated dependencies [ac600e5]
- Updated dependencies [c1ef923]
- Updated dependencies [af5e292]
- Updated dependencies [7f96b10]
- Updated dependencies [167ec42]
- Updated dependencies [f1d4748]
- Updated dependencies [b1119ec]
- Updated dependencies [9f23d2b]
- Updated dependencies [578e025]
- Updated dependencies [af025ee]
- Updated dependencies [598c89a]
- Updated dependencies [b8b9af4]
- Updated dependencies [31676be]
- Updated dependencies [9ce096f]
- Updated dependencies [e05db88]
- Updated dependencies [5ffcc14]
- Updated dependencies [d971e51]
- Updated dependencies [97abb24]
- Updated dependencies [deb157a]
- Updated dependencies [d2ce342]
- Updated dependencies [9695da7]
- Updated dependencies [58b8346]
- Updated dependencies [dfc6975]
- Updated dependencies [3cf4de0]
- Updated dependencies [c9dc811]
- Updated dependencies [a0b9e91]
- Updated dependencies [99bd015]
  - @object-ui/types@17.6.0
  - @object-ui/core@17.6.0

## 17.5.0

### Minor Changes

- 932cbcd: An app you are not allowed to open now says so, instead of reporting that it may still be publishing

  `GET /api/v1/meta/apps` is filtered per session server-side (`filterAppForUser`), so an app withheld by its `requiredPermissions` and an app that does not exist were byte-identical to the console: both simply absent from the list. With one fact and two conditions, `AppContent` rendered its only copy for an absent app — "This app is not available yet — it may still be publishing. Try again in a moment." — over a permanent authorization decision, under a Retry button that could never succeed.

  That is not a cosmetic complaint. On a downstream acceptance round one role hit this screen while another opened the same app fine, and because the copy names a transient deployment state the finding was filed as a suspected platform defect and carried through two test batches before a clean-baseline investigation found the account was missing a permission-set binding. The gate had been working exactly as designed; the message is what sent everyone to the wrong place.

  The maintainer ruling (2026-08-12) took the contract half first. objectstack#8013 made the BY-NAME route answer an explicit denial — `403` with the ADR-0112 catalog code `PERMISSION_DENIED` in the declared `{ success: false, error: { code, message } }` envelope — for an app that exists and whose `requiredPermissions` the session lacks, while the LIST route stays filtered exactly as before, with no `authorized: false` flag, so the enumeration surface is not widened past what a direct by-name probe already implies. Absence keeps answering `404 RESOURCE_NOT_FOUND`, and so do the two neighbouring refusals the same ruling deliberately left alone: an unpublished app (ADR-0045 §3 keeps it externally unobservable) and an app gated by an absent optional service (ADR-0057 D10 — nothing was denied to the caller).

  This is the console half. When a requested app is missing from the list and the existing post-publish readiness re-check still cannot find it, the console asks the by-name route which of the two it is, through a new `ObjectStackAdapter.probeAppAccess(name)`. On the measured code it renders a plain authorization message with a way back to the launcher; on anything else — an absent app, an unreachable server, a host that injected a DataSource without the probe — today's publishing copy renders byte for byte, retry button included.

  Two properties of that seam are load-bearing rather than incidental. It branches on the ADR-0112 **code**, never the status (objectui#4408): the two answers under test are both errors one status apart, and a status-reading implementation passes the happy path while going blind exactly where the defect lives. And only `denied` moves the copy: this bug exists because the console asserted a state it had not measured, so a probe that fails, times out or cannot be issued must leave the screen alone rather than guess in the other direction.

  `probeAppAccess` is deliberately separate from `getApp` rather than a flag on it: `getApp` degrades every failure to `null` — the very conflation being undone — and memoises in the adapter's metadata cache, where a verdict about the CALLER would outlive the session it described. New public API on the adapter (`probeAppAccess`, `isAppPermissionDeniedError`, `APP_PERMISSION_DENIED_CODE`, `AppAccessVerdict`), purely additive; nothing existing changed shape. Three new `empty.*` keys ship in all ten locale packs.

- 537a0d1: `deleteView` removes every home the view has — deleting a draft-only saved view no longer silently no-ops

  A view has two possible homes: the pending per-item **draft** (`DELETE /api/v1/meta/view/:name?state=draft`) and the **published** overlay (`DELETE /api/v1/meta/view/:name`). `deleteView` addressed only the second, unqualified. Deleting a view that existed only as a draft therefore fired the delete at the published overlay, the server answered `200 {"success":true,"reset":false,"message":"No view '…' found — nothing to delete."}`, the draft survived untouched, and the tab was still there after a reload — while the receipt reported `{ deleted: false }` and nothing surfaced the refusal to the user.

  That is not a corner case. ADR-0034's `persistRuntimeMetadata` (app-shell) stages **every** runtime edit as a draft, and a view created from the `+` tab lives ONLY as a draft until an explicit Publish — so both "a view you just made" and "a published view you have since edited" are routinely draft-carrying.

  **Why this is not the mechanical mirror of #4139.** `updateView` probes the draft first and writes back to whichever home the read resolved; that is right for an update in all cases. Copying it here would have been wrong in one: on a published+draft pair a draft-first-_only_ delete discards the draft and leaves the published row still serving the view. That is not Delete view, it is **Discard draft** — a deliberately different operation that already exists (`discardRuntimeDraft`, documented as "the published overlay is untouched"). The asymmetry has a clean statement: for an update, one home is the right home; for a delete, "remove this view" is satisfied only when _no home is left serving it_.

  So both homes are now deleted, **draft first**. The order is load-bearing on the failure path: a fault between the two calls leaves the published overlay intact, so the view is still served and the delete is cleanly retryable. The reverse order would strand a draft-only view — precisely the bug above.

  **Two blind calls, no probe.** Measured against the framework's `deleteMetaItem`: a missing home is reported as a **200** carrying `reset:false` (`"No pending draft for view/x."` / `"No view 'x' found — nothing to delete."`), never a 404. There is nothing for a probe to protect against, and `updateView`'s probe exists for a different reason — its read must resolve the row the merge writes back to — which has no counterpart for a delete.

  **One transport, one error contract.** Both halves now go through `MetadataClient.reset()`, the transport that can express the `?state=` qualifier and the one `updateView`'s draft half already uses. The published half previously went through `client.meta.deleteItem`; measured, that issues the byte-identical request (this adapter configures no environment scoping), so routing it here changes no addressing and collapses two error shapes into one `MetadataError`.

  The receipt is widened **additively**: `{ deleted }` gains optional `draft` and `published` outcomes (`removed`, plus the server's `reset` / `message`). `deleted` is true only when no home is left serving the view _and_ at least one actually held a row — a view that existed in neither home still answers `false`, unchanged. A failure of the published half after the draft was discarded now throws (matching `updateView`'s convention of surfacing a fault rather than degrading) carrying the partial state on the error's `outcome`: "draft gone, overlay left" is exactly what the old `{ deleted: boolean }` could not express, and it is never rounded up to `true`.

  Cache invalidation moves into a `finally`, so `invalidateViewKeys` fires exactly once per call on **every** outcome including the throw. After a half-failure the draft row really is gone, and objectui#4363's asymmetry decides it: an unnecessary invalidation costs one refetch, a missed one costs the cache's full 5-minute TTL of stale overrides.

  Minor rather than patch: this moves published behavior for existing callers and adds two exported types, the same grading objectui#4271's `get()` unwrap and objectui#4495's `find()` resolve→reject took. The `.d.ts` diff is additive only — `deleteView`'s return widens from an inline `{ deleted: boolean }` to the new `DeleteViewResult`, which still carries `deleted: boolean` — so no consumer needs a code edit to keep compiling. A repo-wide census found one call site (app-shell's `ObjectView` delete handler), which awaits the call and does not read the receipt.

- bec3e14: The `DataSource` contract carries `deleteView`'s per-home outcomes (#4564)

  #4479 / PR #4562 widened the ObjectStack adapter's `deleteView` to return
  `DeleteViewResult { deleted, draft?, published? }`, so a caller could finally tell a
  partial delete ("draft gone, published overlay left") from a complete one. The shared
  interface did not follow: `DataSource.deleteView?` still declared the narrow
  `Promise<{ deleted: boolean }>`.

  Nothing failed to compile, and that is exactly what made the gap invisible — a wider
  return is assignable to a narrower declaration, so the adapter satisfied the interface
  while every consumer reaching it **through** `DataSource` was handed a type with the
  per-home outcomes already discarded. The one real call site today (app-shell's
  `ObjectView` delete handler) awaits the call and reads nothing off the receipt, so the
  loss was latent rather than broken.

  `DeleteViewResult` and `ViewHomeDeleteOutcome` now live in `@object-ui/types`, beside
  the `DataSource` interface that returns them, and `deleteView?`'s declared return is
  `Promise<DeleteViewResult>`. The direction was forced: the dependency runs
  `@object-ui/data-objectstack` to `@object-ui/types` and never the other way, so the
  shapes could not be imported downward — moving them was the alternative to re-declaring
  a structural twin in `types`, which the one-resolver rule rejects because a copy is
  mutually assignable with the original for exactly as long as it takes to drift.

  `@object-ui/data-objectstack` re-exports both names unchanged, so every importer PR
  #4562 left pointing at it keeps compiling — and now resolves to the same declaration the
  shared contract speaks rather than a look-alike. A repo-wide census before the move
  found zero importers of either name outside the declaring file itself, PR #4562's own
  suite included, so the re-export is insurance rather than a load-bearing shim.

  `deleteView` stays **optional** on the interface and keeps both parameters; the growth is
  to the return type only, and `deleted` is untouched, so a consumer reading only `deleted`
  needs no edit.

  Grading, per this repository's version-alignment convention (the major tracks
  `@objectstack`, never an API-break count):

  - `@object-ui/types` — **minor**: entry-reachable growth. Two new exported interfaces
    plus a widened method return on `DataSource`, all reachable from the package entry.
  - `@object-ui/data-objectstack` — **minor**, measured rather than assumed. Its emitted
    `dist/index.d.ts` is **not** byte-identical after the swap: the two `interface` blocks
    leave the file and are replaced by a re-export from `@object-ui/types` (121.61 KB to
    120.25 KB). Both names remain in the public export list, so no importer breaks, but the
    declaration genuinely moved and the emitted types now depend on `@object-ui/types` for
    it — that is a minor, not a patch.

- 479cc7b: `MetadataClient.get()` returns the item body its docblock always promised — the field half of the permission matrix is alive again

  `GET /api/v1/meta/:type/:name` answers the spec-declared envelope `{ type, name, item, …protection fields }` — one shape, for published and draft reads alike, since objectstack#5563 collapsed the read to it. `get()` handed that envelope straight back to callers while its own docblock declared it returned "the unwrapped item content". Every consumer reading `obj.fields` therefore read `undefined`.

  The visible cost was the entire field-level half of the permission matrix: expanding any object in `/_console/apps/:app/metadata/permission/:set` reported "No fields registered for this object." with zero checkboxes, for every object, while the network showed that object's 21 fields arriving 200 OK. Reproduced against two objects on fresh loads, and proven not to be the read-only gate — a run with the editor fully writable (864 enabled checkboxes) still showed an empty field sub-table, which is exactly what a read resolving `undefined` predicts.

  That was one symptom of nine. A census of every `get()` call site found **zero** deliberate readers of the envelope and nine consumers reading the body directly, all of them broken the same way: the RLS CEL editor's field lint and autocomplete resolved an empty field set; the dataset inspectors and the preview field/catalog hooks came back empty; the report drill-down's fallback path read `def.object` off the envelope, found nothing and silently returned; the record-page seed synthesized a default layout from an envelope instead of an object; and the Field Designer read `raw.fields` for display and then wrote `{ ...raw, fields }` back — saving the envelope over the object body. None of it was caught, because the test doubles across the repo were written against the docblock: they answered a bare `{ fields }` body, so the suite exercised the documented contract while production ran the other one.

  The fix is at the producer, not the nine consumers. `get()` now unwraps the envelope once, at the client boundary — so every one of those call sites is repaired without being touched. Detection is by the PRESENCE of the three keys `GetMetaItemResponseSchema` declares (`type: string`, `name: string`, an `item` slot), never guessed from payload contents: a metadata document carrying its own `type` and `name` (a view is `{ name, type: 'grid', … }`) has no `item` and is left whole, and a document with an `item` property of its own but no envelope identity is likewise untouched. Key count is deliberately not part of the test, since a real envelope also spreads the ADR-0008 protection carriers. Anything that is not the envelope — an older server answering the bare document — passes through byte-for-byte, and 404 still reads as `null`.

  `getDraft()` is unchanged and keeps returning the envelope, which its docblock declares and roughly eleven call sites depend on by reading `.item`. That asymmetry is now real rather than aspirational: the two methods share one private transport, and differ only in whether they unwrap. `unwrapDraftBody` (app-shell) and `unwrapViewDraft` (this package) remain the shared helpers for taking a draft body out, and both were already tolerant of either shape, so the two seams that reach a draft through `get()` keep their exact semantics — including reading an empty draft as "nothing pending".

  Minor rather than patch: this moves published behavior for existing callers, the same grading `find()`'s resolve-to-reject change took. No signature changed — the `.d.ts` diff is documentation plus one private member — so nothing needs a code edit to keep compiling; a caller that had written its own `.item` compensator against the old behavior would need to drop it, and none exists in this repo.

- 2776b11: data-objectstack: retire the phantom `CloudOperations` surface — the class, its three `Cloud*` types, and the module that claimed to integrate a cloud namespace no client has ever shipped

  `src/cloud.ts` exported a `CloudOperations` class with four methods, all
  re-exported from the package entry, so this was published surface of
  `@object-ui/data-objectstack`. Every method optional-chained into
  `client.cloud?.…`, and no released `@objectstack/client` has ever exported a
  `cloud` namespace. Re-measured at `17.0.0-rc.6` before deleting: the module's
  export list is `ObjectStackClient`, `ScopedProjectClient`, `RealtimeAPI`,
  `QueryBuilder`, `FilterBuilder`, `createQuery`, `createFilter`, and a
  constructed client's `.cloud` is `undefined`. The nearest real namespaces on the
  instance — `projects` (which owns `/api/v1/cloud/environments`) and `packages`
  (which owns marketplace installs) — are not what these methods reached for.

  So every call resolved `undefined` and fell through to a literal:

  | method                | what it returned, always                                      |
  | :-------------------- | :------------------------------------------------------------ |
  | `deploy`              | `{ deploymentId: 'deploy-' + Date.now(), status: 'pending' }` |
  | `getDeploymentStatus` | `{ status: 'unknown' }`                                       |
  | `searchMarketplace`   | `[]`                                                          |
  | `installPlugin`       | `{ success: false }`                                          |

  The maintainer's 2026-08-11 ruling removed it rather than repairing it, and named
  the reason: `deploy()` did not degrade to an error, it **manufactured a
  plausible success**. A caller got a well-formed `deploymentId` for an operation
  that never left the process and then polled it forever against
  `{ status: 'unknown' }`. That is the most dangerous shape for an AI consumer,
  which builds downstream logic on the fake id instead of getting suspicious.
  Under the startup-focus principle a declared capability with no producer, no
  consumer and no business pull is retired, not stubbed.

  **Breaking, in FROM → TO form.** `CloudOperations`, `CloudDeploymentConfig`,
  `CloudHostingConfig` and `CloudMarketplaceEntry` are no longer exported from
  `@object-ui/data-objectstack`. It is a `minor` under this repo's version policy
  (objectui's own breaking changes never declare `major`). Nothing broke that was
  working: the only in-repo construction site was a test, and every method's
  observable behaviour was a fabricated constant.

  **No compile-compat stub was left.** The ruling allows one — throwing loud
  `NotImplemented` — only where a compile need is demonstrated. Measured across the
  whole repository, the sole importers were the package's own `index.ts`,
  `v3-compat.test.ts` (three cases asserting the fallback had the right _keys_,
  which is how the emptiness stayed green) and objectui#3720's vocabulary pin. No
  app, no other package, no doc. With no consumer to keep compiling, a stub would
  be a second phantom surface guarding the first.

  The false module header went with it — it read `Cloud namespace integration for
@objectstack/spec v3.0.0 / Replaces the legacy Hub namespace`, against a resolved
  spec of `17.0.0-rc.6` and schemas this package never consumed.

  **objectui#3720's pin retires with its subject.** `cloud-environment-vocabulary.pin.test.ts`
  pinned the doc comment on `CloudDeploymentConfig.environment` — the deliberate
  three-member deploy-target vocabulary and the `staging`-is-not-a-discovery-member
  trap. Every fact it held was a claim _about_ that comment, and its spec-side
  assertions existed only to keep those claims honest; with the type deleted they
  would pin `@objectstack/spec`'s enums on behalf of no local reader — the same
  phantom shape this change closes. #3720's conclusion is unaffected and now moot:
  it found no producer-side deploy-target type to converge onto because the
  producer did not exist, and this change removes the consumer that was waiting for
  it. Its pending empty changeset (`cloud-deploy-environment-vocabulary-3720.md`,
  never released) is removed too, since it announced a deliberate vocabulary on a
  type this same release deletes.

  A negative pin (`src/cloud-surface-retired-4152.pin.test.ts`) replaces the
  retired cases and fails if any of the four names returns — reading both the
  runtime export list (which catches the class) and `index.ts`'s source text
  (which is the only instrument that can catch a returning `export type`).

- 2e3b0c0: fix(list): an `OBJECT_API_DISABLED` list request renders an honest cannot-work state instead of the empty state

  A list pointed at an object whose `enable` block withholds the API rendered its ordinary
  empty state, so _"this page cannot work, and never could"_ reached the user as _"you have no
  records"_ (objectui#4408). The reported instance — `Setup › Advanced › Signing Keys`, whose
  `sys_jwks` declares `enable.apiEnabled: false` — could not load for any persona and said so
  to nobody. That is also why the upstream defect objectstack#7544 survived review for its
  whole life: a merely unpopulated page invites nobody to click through.

  The masking had two halves, in two packages, and neither package could see the other:

  - **`@object-ui/data-objectstack`** (minor — see the grading note below) — `find()` degraded
    **every** 404 into `{ data: [], total: 0 }` and memoised the resource, so the denial arrived
    at the surface as a successful empty result, indistinguishable from a genuinely empty
    object. The two `enable`-block denials are now let through instead: `OBJECT_API_DISABLED`
    (404) and `OBJECT_API_METHOD_NOT_ALLOWED` (405). The memo skips them too — absorbing one
    would have pinned the object to "empty" for the rest of the session.
  - **`@object-ui/plugin-list`** — the load-error panel gained an `api-disabled` kind. The 405
    half was never swallowed, so it already reached this panel, but classified as `network`:
    _"check your connection and try again"_ for a condition no retry can change. It now says
    the object is not exposed through the API, that this is a setting on the object rather than
    a permission, and it offers **no Retry** button, because every retry re-fetches the
    identical refusal.

  Both denials are pure functions of the object's metadata — no user, no permission, no
  context — so neither is transient or per-user, which is exactly the case where a silent empty
  state is most misleading. Discrimination is on the ADR-0112 `code`, never the status: a
  missing collection, a missing record and a disabled object are all 404.

  **A genuinely empty object still renders the ordinary empty state**, and a backend without an
  optional collection still degrades to empty — pinned in both directions, at the adapter, at
  the view, and once end-to-end over a real adapter and a real `ListView`.

  Also closes a code-propagation gap on the same path: `find()`'s raw `$expand`/`$search`
  branch bypasses `@objectstack/client` and hand-rolled its own error, stamping only `status`.
  It now carries the ADR-0112 envelope (`code` + `httpStatus`), so a denial arriving on the
  branch a list takes whenever it expands a lookup or runs a search is no longer anonymous.

  New strings: `list.loadErrorApiDisabledTitle` / `list.loadErrorApiDisabledMessage`, in the
  `en` pack and mirrored in the list defaults map.

  ## Grading note — why `@object-ui/data-objectstack` is **minor** and not patch

  Two independent reasons, either of which is sufficient under this repo's precedent
  (objectui#4403 / #4177, and #4485's grading of `@object-ui/core`'s `toDomProps` lift):

  1. **The emitted `.d.ts` grows two NEW exports.** `isApiAccessDeniedError(error: unknown):
boolean` and `API_ACCESS_DENIED_CODES` (the readonly tuple
     `['OBJECT_API_DISABLED', 'OBJECT_API_METHOD_NOT_ALLOWED']`) are added to the package's
     public surface. Additive surface growth is minor.
  2. **Observable behaviour on a published API moves.** `ObjectStackDataSource.find()` now
     **REJECTS** for the two `enable`-block denial codes where it previously **RESOLVED** with
     `{ data: [], total: 0 }`. No signature changed and nothing was removed, but a caller that
     relied on those two codes arriving as a successful empty result now receives a rejected
     promise carrying `code` + `httpStatus`, and must handle it.

  Deliberately unchanged, and still resolving to an empty result exactly as before: a bare 404
  with no code, `OBJECT_NOT_FOUND` (still memoised) and `RECORD_NOT_FOUND`. The behaviour move
  is scoped to the two denial codes named above and to nothing else.

  Not major: this follows AGENTS.md's version-alignment rule — objectui's major tracks
  `@objectstack`'s, so this repo's own breaking semantics are declared as minor with the change
  described in the body, which is what this note is.

### Patch Changes

- d9d3463: Retire four zero-consumer declared surfaces (dead-surface sweep batch 3, #4328). Each was
  measured as declared-but-never-read at the branch point, and each is removed rather than
  left as an authoring surface whose values nothing acts on.

  Breaking for anyone who typed against the removed declarations, marked `minor` per this
  repository's version-alignment convention (the major tracks `@objectstack`, never an
  API-break count):

  - `@object-ui/core` no longer exports `mergeViewsIntoObjects`. It was a second copy left
    behind by the move of that step to the provider layer, and it had drifted: it ignored a
    view container's default `list` and keyed views by the authored bare key instead of the
    composer's `<object>.<key>` identity. The live implementation — `MetadataProvider`'s, in
    `@object-ui/app-shell` — is unchanged and remains the only one. (#3775)
  - `@object-ui/types`' `RoleDefinition` no longer declares `permissions`. A role's grants
    live in `ObjectPermissionConfig.roles`, keyed by object; that is the only home any
    consumer reads (`resolveRoles` walks `inherits` and matches on `name`). The removed
    field was _required_, so five fixtures across three packages had been declaring an empty
    array for a value nothing would ever look at. Role-attached grants are now a compile
    error rather than silently ignored data. (#4288)
  - `@object-ui/react`'s `RecordContextValue` no longer declares `loading` / `error`. Both
    had zero producers and zero consumers — no host passed them, no `record:*` renderer read
    them — and only the provider's memo dependency list still named them. Record-level
    loading and error state stays where it is actually expressed: each renderer's own data
    source. (#3773)

  No behaviour change, no request-count change:

  - `@object-ui/data-objectstack` drops five `metadataCache.invalidate('views:<object>')`
    calls across `updateViewConfig` / `createView` / `updateView` / `deleteView`. No read
    path has ever populated that key — `listViews` fetches directly, uncached — so all five
    were permanent no-ops. The invalidations of the keys that do have readers
    (`view:<object>:<viewId>` for `getView`, `view-overrides:<object>` for
    `listViewOverrides`) are untouched and now pinned. (#3778)

- c0f9a4b: Studio surfaces the runtime authoring gate's advisory findings instead of discarding them client-side

  The framework's runtime authoring gate produces two kinds of verdict on a metadata write. Errors become a 422 and the author sees them. Advisories ride a **200** — the save succeeded, the row persisted, the version bumped — and until objectstack#7435 the server dropped them into a deduped `console.warn` behind a process-level set. That landing put them on the wire as an optional `advisories[]` on the save response, emitted only when non-empty, and objectui was still throwing them away one layer further out: `MetadataClient.save` parsed the body, returned it as an opaque `T`, and every call site awaited it for its side effect and discarded the value.

  The measured case the fix is built on: a `nightly_purge` flow whose only defect is a `delete_record` node with `multi: true` and no filter yields `errors = 0 / advisories = 1`. The save returns 200, the flow goes live, and nothing anywhere tells the author it deletes every row. That matters most for exactly the authors Studio serves — a Studio tenant or an MCP/AI author has no `os lint` and no CLI config for `sys_metadata` overlay rows, so this gate is not the weakest of four doors, it is the only one.

  `MetadataClient` now carries an `onSaveAdvisory` sink, invoked after a save whose response carried a non-empty `advisories[]`, and the console wires it in `useMetadataClient` — the one hook every app-shell write path takes its client from, so a single wiring covers `ResourceEditPage`, `StudioDesignSurface`, `EmbeddedItemEditor`, `DatasourceResourcePage`, `ObjectHooksPanel` and any future call site rather than a toast copied into twenty of them. The finding shape is re-exported from `@objectstack/spec` (`RuntimeAuthoringIssue`) rather than restated, so it cannot fork from the 422 `issues[]` it deliberately shares a declaration with.

  The affordance is the warning tier and says "Saved" first. A successful save that reads as a failure is the specific defect this surface must not ship, so the toast acknowledges the write, lists `rule` + `message` + `hint` per finding with `where` as secondary context, and renders that text **verbatim** — `message` and `hint` are server prose composed by the gate's rules, not i18n keys. Only the frame around them is translated (`console.saveAdvisoryTitle`, ten packs). The sink is best-effort in both directions: a malformed finding is dropped rather than printed as blanks, and a throwing renderer cannot turn a save the server already committed into an error.

  **What this does not surface yet, and why.** Studio's designer saves as a **draft** on every edit, and drafts are never gated — the framework returns at its D1 early-return (`if (args.state !== 'active') return null`) before running a single rule, so a draft save produces no findings at all rather than producing some that get withheld. The publish step that promotes a draft to active _does_ run the gate, but the publish route returns no `advisories` field until objectstack#7294 lands. So a draft-then-publish flow renders nothing today, at both of its doors, for two different reasons; the active-mode save door renders findings now. That gap is pinned as a test rather than left for a reader to rediscover.

- 605b747: The second metadata client class surfaces the runtime authoring gate's advisories instead of discarding them

  objectui#4133 (PR #4236) put the gate's advisory findings — the ones that ride a **200**, where the save succeeded and the row persisted — in front of Studio authors, but it covered only one of the two client classes that write through `PUT /api/v1/meta/:type/:name`. The wiring lifts at `useMetadataClient`, which is where every app-shell path takes its `MetadataClient` from. `ObjectStackClient.meta.saveItem` — the SDK client hanging off `ObjectStackAdapter` — is a different class reaching the same door, and every one of its callers awaited the call and discarded the response, so an `advisories[]` the server attached was parsed off the wire and dropped one layer further out.

  Those callers all write in **active** mode, so this is not the draft case where the gate never runs: the gate does run for them, produces findings, and the author was told nothing. The list is `MetadataService` (five saves behind the Object Manager and Field Designer), `useNavigationSync`, plugin-designer's Create/EditAppPage, and the adapter's own `updateViewConfig` / view / `updateDashboard` paths.

  `ObjectStackAdapter` now carries an `onSaveAdvisory(listener)` subscription and emits on it after a metadata save whose 200 carried a non-empty `advisories[]`; `AdapterProvider` subscribes once and renders through the same `emitSaveAdvisories` the other client class already uses, so both doors produce one wording on the warning tier that says "Saved" first. The emitter is installed **once at the adapter/client seam** rather than at the call sites: every caller above reaches the save door through the adapter's own long-lived `ObjectStackClient`, so one interception covers all of them, plus any future one, without a toast copied into a dozen places — the same reasoning that put #4133's sink at one factory instead of twenty call sites.

  It is a sibling of the `onWriteWarning` channel (#3431/#3455) rather than a second payload pushed down it, which is what `MetadataSaveAdvisoryEvent` already said it was modelled on. `WriteWarningEvent` is a closed shape whose required `droppedFields` means "fields the write legally stripped", so carrying advisories on it would either force every existing subscriber to grow a branch or make the event lie about what happened. The seam's shape is reused; its event type is not. `readSaveAdvisories` is shared unchanged between the two clients — one reader, two call sites — which the response envelopes make possible: the spec puts `advisories` at the save body's top level, and the SDK returns that body verbatim (it strips its `{ success, data }` envelope only when a `data` key is present, and this body has none). That measurement is pinned by tests that drive a real SDK client through a fake `fetch` rather than stubbing the method under test.

- b42558a: Renaming a freshly-created view now persists — `updateView` reads and writes the same row, instead of reading the published overlay and losing the edit into a rejected partial write

  ADR-0034 stages every runtime-created view as a per-item **draft**: a view made from the `+` tab lives only in the draft row until an explicit Publish, and the UI reads it back through `?preview=draft`. `updateView` addressed neither half of that. Its read went to the published overlay (`client.meta.getItem`, no draft qualifier), which 404s for a draft-only view; a `catch {}` labelled "treat missing as create-equivalent" then substituted `current = {}`, so the read-merge-write cycle merged onto nothing. What went out was the fragment that merge produces — literally `{label, name, object}`, no `viewKind`, no `config` — which the server rejects as an invalid ViewItem (422). Nothing surfaced to the user, and the draft row still held the old label, so the rename simply did not happen. Create, pin and delete were unaffected: they never take this path.

  The read now probes the draft row first and, on a hit, merges onto that body and writes it straight back with `mode: 'draft'`. Whichever row the read resolved is the row the write updates, so the two halves agree by construction rather than by coincidence. Probing the draft **before** the published overlay is what makes it correct for a view that has both: writing the published row while a draft is pending would put the edit somewhere the draft shadows, and Publish would later overwrite it with the pre-edit body — losing the change a second time, further from the cause. A draft edit stays a draft, preserving ADR-0037's guarantee that nothing the preview shows goes live until Publish. Renaming a published view with no draft pending is unchanged, published read to published write.

  The silent catch is gone. A view that resolves in neither home now throws naming the view and the object (creating one is `createView`'s job — no caller of `updateView` relied on the create-equivalent behaviour), and a network, permission or server fault on either read propagates instead of degrading into the partial write that corrupted the row. This turns a class of failure that was previously invisible into an error the existing call sites already catch and surface.

  Set-default and reorder drive the same read-merge-write cycle with `{isDefault}` / `{sortOrder}` patches, so they were emitting the same partial write and are fixed by the same change.

- d2f6e6b: Publishing a view from the console no longer serves a five-minute-stale override map — every writer now routes through one invalidation seam

  `ObjectStackAdapter` caches two view-shaped reads: `getView` under `view:{object}:{name}` and `listViewOverrides` under `view-overrides:{object}`, with `MetadataCache`'s default 5-minute TTL. objectui#4363 made the adapter's own four write paths drop both. But the console's real create-a-view flow never calls any of them: `ObjectView.handleViewCreate` writes through the ADR-0034 metadata seam (`createRuntimeMetadata` → `metadataClient.save`), and Publish goes `RuntimeDraftBar` → `publishRuntimeMetadata` → `metadataClient.publish`. Two writers into the same `/meta/view/:name` rows; only one of them invalidated anything.

  Publish is the sharp end. A create lands an invisible per-item draft, and `listViewOverrides` enumerates published rows, so the map is still honest there. Publish promotes the row into exactly the world the map describes — and nothing dropped the key, so the object page kept applying its pre-publish snapshot for the rest of the TTL. It does not self-heal: `loadViewOverrides` treats a resolved map as authoritative and deliberately does not re-probe per view (objectui#3774, correct — re-probing reinstates the 404 flurry the batch read exists to remove), so the per-view `getView` fallback that would have masked a stale map is by design unreachable.

  The fix is one seam rather than a fifth copy of the key list. `ObjectStackAdapter.invalidateViewKeys(objectName, viewName)` is now the only place that knows which keys a view-row write drops; the adapter's four write paths call it instead of restating the pair, app-shell's ADR-0034 persistence module calls it for `view` saves, creates, publishes and discards, and `MetadataService.saveMetadataItem` calls it when the category is `view` (where it previously named `view:{name}`, which no reader has). Restatement is what this repo keeps paying for — objectui#3778 removed five copies of a key no reader populated, objectui#4363 fixed four copies that named half the live set, and objectui#4373 is the measured proof that a new writer forgets the list by default. A pin suite can only guard writers that exist; a seam makes the next one unable to forget.

  No cache key, no read path and no public signature changed. The adapter's eight existing invalidation pins pass unchanged, which is the evidence that routing four paths through a seam changed nothing observable; two new structural guards keep the key set from being restated again — one asserting each key template appears exactly twice in the adapter (its reader, and the seam), one asserting no app-shell file spells either.

- 85a3082: Every view write path now invalidates the override map — a created, renamed or deleted view is no longer shadowed by a five-minute-stale batch read

  `ObjectStackAdapter` caches two view-shaped reads: `getView` under `view:{object}:{viewId}`, and `listViewOverrides` under `view-overrides:{object}`. Four write paths touch view rows, and until now exactly one of them — `updateViewConfig` — invalidated the second key. `createView`, `updateView` and `deleteView` invalidated only the per-view key, so the batch override map kept answering from a snapshot taken up to `MetadataCache`'s default 5-minute TTL earlier.

  That gap does not heal itself. `loadViewOverrides` in app-shell's `ObjectView` treats a resolved map as authoritative and deliberately does not re-probe per view — that is objectui#3774's fix, and it is correct, since re-probing reinstates the 404 flurry the batch read exists to remove. So the per-view `getView` fallback that would have masked a stale map is by design unreachable, and the stale map is served in full. Meanwhile `listViews` is uncached and answers fresh, so the view switcher could list a view whose override body came from a map written minutes earlier: the sharpest shape is the rename/pin path (`updateView`), where a user edits a view, returns to the object, and is served the pre-edit override.

  All four paths now emit the same ordered pair — the per-view key, then the object's override map. The rule is uniform per method rather than per branch: `updateView`'s draft half invalidates both keys as its published half does, which is deliberate over-invalidation (both readers enumerate published rows, so a draft write stales neither) chosen because an unnecessary invalidation costs one refetch while a missed one costs the full TTL. `createView` names the per-view key too, because `saveItem` is an upsert and an explicit `spec.name` that already exists overwrites a published row a prior `getView` may hold.

  No signature, no cache key and no read path changed; the only difference is which keys each write drops. The pin suite added by objectui#4328 now asserts the full invalidation key set for all five call sites, with the sweep's two pins kept as untouched controls: `listViews` stays uncached, and no write path names the retired `views:{object}` key.

- Updated dependencies [ee66e2e]
- Updated dependencies [ee26e65]
- Updated dependencies [5900ac5]
- Updated dependencies [f650253]
- Updated dependencies [3d9769a]
- Updated dependencies [3fc2971]
- Updated dependencies [aca27fa]
- Updated dependencies [dde7283]
- Updated dependencies [92876f0]
- Updated dependencies [f279deb]
- Updated dependencies [eb7f586]
- Updated dependencies [e901131]
- Updated dependencies [d9d3463]
- Updated dependencies [2a40f69]
- Updated dependencies [bec3e14]
- Updated dependencies [613b167]
- Updated dependencies [1f9b905]
- Updated dependencies [abb0f81]
- Updated dependencies [38ab505]
- Updated dependencies [7e4f0e5]
- Updated dependencies [92250d6]
- Updated dependencies [c1d939f]
- Updated dependencies [49ae9f4]
- Updated dependencies [2459a3e]
- Updated dependencies [d6aa172]
- Updated dependencies [fe52a04]
- Updated dependencies [bb68488]
- Updated dependencies [9461dd3]
- Updated dependencies [ab04728]
  - @object-ui/core@17.5.0
  - @object-ui/types@17.5.0

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

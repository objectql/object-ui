# @object-ui/react

## 17.4.0

### Minor Changes

- 5bfaabd: `PageComponentSchema.dataSource` now reaches every object-bound block, not just
  `list-view` — and `element:record_picker` stops discarding `view`
  (objectstack#6953).

  objectstack#5576 wired the spec's per-element data binding
  (`dataSource: { object, view?, filter?, sort?, limit? }`) to `list-view` and left
  the same declaration inert on every other page component. Two gaps remained, and
  both were silent:

  - **`element:record_picker` read four of the five keys and dropped `view`.** So
    `dataSource: { object: 'account', view: 'hot' }` — the spec's own example —
    built a picker over EVERY account instead of the rows the saved view selects.
    Nothing threw and nothing rendered an error; the option list was simply wider
    than what was authored, which also means a user could select a record the page
    said was out of scope.
  - **`object-grid` / `object-form` / `object-kanban` / `object-calendar` /
    `object-chart` / `object-metric` / `record:related_list` read none of it.**
    Each gates its fetch on its own `objectName`, and nothing mapped
    `dataSource.object` onto it, so a page written the way the spec documents
    rendered an empty grid / a field-less form / a board with no cards / an empty
    month / an empty chart / a static metric number — with no request and no
    diagnostic anywhere. Spec-valid metadata rendering nothing is the
    objectstack#4413 shape.

  Composition follows objectstack#5576's landed semantics unchanged on every block:
  a named saved view supplies the baseline, a key written on the component itself
  overrides it, an explicit binding key overrides both, `filter` AND-combines
  ("additional filter criteria" — a binding can narrow a view, never widen it), and
  a `view` name that does not resolve renders a configuration error instead of
  degrading to the object's full scope.

  - `@object-ui/react` — new `useElementDataSourceSchema(schema, mapping, dataSource?)`
    and `ElementDataSourceGate` apply a resolved binding to the schema keys a given
    block reads, plus `ElementDataSourceErrorPanel` / `ElementDataSourceLoadingPanel`
    for the two non-final states. One precedence table for all blocks rather than
    one copy per block — that copy is how "additional filter criteria" would have
    become two dialects.
  - A mapping names **only** keys its block genuinely reads. A composed value
    written onto a key the block ignores would be accepted and dropped, which is
    the defect being removed, one layer deeper — so a kanban's swimlane `columns`
    never receive a view's field list, and a block with no row cap leaves `limit`
    unmapped. The per-block coverage table, including two residual gaps that are
    named rather than papered over, is in `content/docs/guide/data-source.md`.

  No behaviour changes for a block that carries no `dataSource`: the binding-free
  path returns the schema by reference, so nothing remounts and nothing refetches.

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

- 8aad9fd: Action-face predicates written against the canonical `record.` root now evaluate

  `action:button`, `action:icon`, `action:menu` and `action:group` gated their
  actions on `useCondition(pred, context)`, which evaluates on
  `new ExpressionEvaluator({ ...scope, ...context })` — and the context each of
  them passed was the row spread flat, or nothing at all. Only the shorthand
  spelling resolved:

  | predicate                    | verdict, before                  |
  | ---------------------------- | -------------------------------- |
  | `status == "pending"`        | evaluates (`action:button` only) |
  | `record.status == "pending"` | throws `record is not defined`   |
  | `data.status == "pending"`   | throws `data is not defined`     |

  `record.` is not a mistaken spelling — it is the canonical one. It is what
  `ExpressionEvaluator`'s CEL path binds (`bag.record` as the record namespace),
  what `evalRowPredicate` binds on the record header, list rows, the row kebab
  and conditional formatting (`record.status` / bare `status` / `data.status`),
  and what the server enforces with. A `visible` that fails CLOSED turns the throw
  into "hidden", so a correctly-authored predicate deleted its own button —
  indistinguishable from the gate having said no. On the fail-soft legs the same
  throw lands the other way: `disabled` greyed a control out for everyone.

  Live rather than theoretical: every declared action on framework's
  `sys_approval_request` gates on `record.viewer.*`, so the whole server-declared
  approval decision set was invisible wherever the declared-action bar rendered
  until objectui#4077 fixed that bar. These four generic renderers carried the
  same binding.

  What changed:

  - all four bind the row the three canonical ways, through one named helper
    (`usePredicateRecordContext`, exported from `@object-ui/react` beside
    `useCondition`), so the action face and the row surfaces answer an author's
    `visible:` the same way;
  - `action:icon` reads the row at all. It evaluated against an empty bag, so not
    even the bare-field shorthand resolved — and its `data` prop was landing in
    the props spread onto the DOM button;
  - `action:menu`'s items and `action:group`'s two leaves receive the row from
    their host, which they previously never got;
  - `action:bar` forwards the row into the overflow menu it builds, not just to
    its inline members. An action's predicate had been answering a different
    question purely because it spilled past `maxVisible` — which on mobile
    defaults to 1, making the verdict a function of the viewport.

  Deliberately unchanged: the evaluation entry and each site's error policy. A
  predicate that genuinely faults still fails closed on `action:button` /
  `action:menu` `visible` and still fails soft on the other legs, exactly as
  before; `toPredicateInput`, `hasDeclaredVisibilityGate` and the empty-predicate
  rules keep their pinned semantics. Binding the row is a separate question from
  what to do when the predicate faults.

  A surface with no row of its own binds nothing rather than an empty record, so
  a host that supplies the row through the ambient predicate scope is not blanked
  out; a row passed explicitly still wins over the scope.

- e06810e: `PageComponentSchema.dataSource` is now consumed instead of discarded — a
  `list-view` page component can reference a **saved view by name** for the first
  time, and writing the binding no longer breaks the component
  (objectstack#5576).

  The spec declares a per-element data binding on every page component —
  `dataSource: { object, view?, filter?, sort?, limit? }` — and objectui read none
  of it. `ViewDataProvider.resolveElementDataSource` forwarded
  `filter`/`sort`/`limit` and dropped `view` entirely, and had no caller outside its
  own test; nothing mapped `object` onto the `objectName` a list actually reads. So
  "reference a saved view by name" was published, validated and inert, and every
  page that wanted a saved view's columns/filter/sort had to inline a second copy of
  them — the drift the binding exists to remove.

  Writing the binding also **broke** the block, for a reason unrelated to `view`:
  `SchemaRenderer` spread the schema's `dataSource` metadata onto the component as a
  React prop, and that is the prop name the host uses to inject the data-source
  ADAPTER. The plain `{ object, view }` object shadowed the adapter, so the first
  `dataSource.find(…)` threw `dataSource.find is not a function` and `list-view`
  rendered "Couldn't load records" — a spec-compliant component failing next to
  identical ones that omitted the binding.

  - `@object-ui/react` — `SchemaRenderer` no longer spreads `schema.dataSource` as a
    prop (it is metadata, like `visibleWhen`); renderers read it off `schema`. An
    explicit React `dataSource` prop is unaffected. New
    `useElementDataSource(schema, dataSource?)` hook resolves a binding, fetching
    the named saved view from the object definition's `listViews` and the metadata
    overlay's `listViews()`.
  - `@object-ui/core` — new `isElementDataSourceConfig` / `collectSavedViews` /
    `resolveSavedView` / `composeElementDataSource`, and `resolveElementDataSource`
    now honours `view` through an optional `DataFetcher.fetchViews`, reporting an
    unresolvable view as an error instead of silently returning every record.
    `resolveViewId` moved here from `@object-ui/app-shell` (re-exported there) so
    one matcher serves both the object page and a page component.
  - `@object-ui/plugin-list` — `list-view` maps the binding onto the props
    `ListView` reads. `dataSource.*` keys are authoritative, view-supplied values
    are a baseline the component's own keys override, and `filter` AND-combines at
    every level (the spec calls the binding's filter "additional criteria"), so a
    binding can narrow a saved view but never widen it. A `view` name that does not
    resolve renders a configuration error naming the object's actual views and
    issues no query — it never falls back to the object's default view, because that
    turns a typo into a silently wider answer.

- ab3ad4f: An empty predicate is no longer a declared gate anywhere (objectui#3850, objectui#3862)

  "Is a gate DECLARED on this key — is there a condition to reach a verdict on?" was
  answered three times in this repo, with three different scopes, and the widest
  answers sat on `disabled`, where the mistake is not benign:

  - `hasDeclaredVisibilityGate` (the action face) asked `!= null && !== ''`, so every
    OBJECT counted — including `{ dialect: 'cel', source: '' }`. That envelope is not
    a hand-written curiosity: `@objectstack/spec`'s `ExpressionInputSchema` normalizes
    every authored predicate into one, so "the author left the predicate empty"
    compiles to exactly it. The verdict path normalized the same value back to
    `undefined`, and `evaluateCondition(undefined)` answers `true` — "no condition, so
    visible/enabled". On `visible` that `true` means SHOW, so the two mistakes
    cancelled; on `disabled` it means GREY, so they compounded: a button disabled
    forever that no author asked to disable (objectui#3850, the residue objectui#3842
    left behind).
  - `SchemaRenderer` asked `disabled !== undefined` inline, one notch wider again, so
    `disabled: null` greyed out too — on the GENERIC rendering path, since that block
    runs for every node type, and not as an internal flag either: `_disabled` is
    forwarded to the component as a real `disabled` prop (objectui#3862).
  - `ActionRunner`'s execution gates asked "does this normalize to something
    evaluable?" — the scope that turned out to be right (objectui#3848 / objectui#3872).

  There is now ONE definition, `hasDeclaredPredicate`, exported from
  `@object-ui/core` (`evaluator/declaredPredicate.ts`, beside the `toPredicateInput`
  normalizer it is derived from): a gate is declared when normalization still leaves a
  condition to evaluate. `''`, a whitespace-only string, an empty-`source` envelope
  and any non-predicate value (`0`, `{}`) are NOT declared; `false` IS (a verdict is
  not a missing gate — objectui#3812). `hasDeclaredVisibilityGate` keeps its name as a
  re-export of it, so the five member-action renderer call sites, `DeclaredActionsBar`
  and `record-quick-actions` are unchanged and inherit the scope;
  `SchemaRenderer`'s `disabled` / `disabledOn` chain and `ActionRunner`'s two gates
  read the same function. No consumer got a local "and also check for empty" test —
  that fourth dialect is what objectui#3842 / objectui#3849 spent two PRs merging away.

  Measured behaviour change, `action:button` and the generic path, before → after:

  | value                                                     | `visible`      | `disabled` | `enabled` | `SchemaRenderer` `disabled` prop |
  | --------------------------------------------------------- | -------------- | ---------- | --------- | -------------------------------- |
  | `''`                                                      | shown → shown  | on → on    | on → on   | forwarded → absent               |
  | `null`                                                    | shown → shown  | on → on    | on → on   | forwarded → absent               |
  | `{ dialect: 'cel', source: '' }`                          | shown → shown  | GREY → on  | on → on   | forwarded → absent               |
  | `{ source: '' }`                                          | shown → shown  | GREY → on  | on → on   | forwarded → absent               |
  | `'   '` (whitespace)                                      | HIDDEN → shown | on → on    | GREY → on | forwarded → absent               |
  | `0` / `{}` (not predicates)                               | shown → shown  | GREY → on  | on → on   | forwarded → absent               |
  | `true` / `false` / bare CEL / `${…}` / non-empty envelope | unchanged      | unchanged  | unchanged | unchanged                        |

  Every row moves toward "there is no gate here", never away from it, and no value
  that HAS a verdict changes it — the verdict is still read from the raw value, only
  the gate in front of it narrowed. Two rows are behaviour changes rather than the
  equivalence the ruling expected, and are pinned as such: the whitespace string moves
  on `visible` / `enabled` (it used to normalize to `'${   }'`, which evaluates falsy,
  so a predicate that says nothing HID the action from everyone), and non-predicate
  junk stops greying controls out (fail-open, the posture `ActionRunner` already
  committed to).

  One blank spelling is knowingly still outside the scope: an envelope whose `source`
  is blank but not EMPTY (`{ dialect: 'cel', source: '   ' }`) — the normalizer folds a
  `source` of `''` and does not trim, so the string spelling of a blank predicate is
  trimmed and the envelope spelling is not, and `disabled` still greys out for that one
  value. The ruling enumerated three empty spellings; this is a fourth, measured and
  filed as objectui#3960 rather than widened in here.

  One chain is deliberately untouched: `SchemaRenderer`'s `visible` / `visibleWhen` /
  `visibleOn` / `visibility` / `hidden` / `hiddenOn` legs keep `!== undefined`, because
  narrowing them would change ALIAS PRECEDENCE, not just emptiness. The `hidden` legs
  are not negated and therefore carry this same defect with the polarity that makes the
  node vanish — measured, out of this ruling's scope, filed as objectui#3955.

- 0109f54: Blank predicates and non-predicate values are no longer gates, at the last three entries that still judged them (objectui#3955, objectui#3957, objectui#3960)

  objectui#3850 sank "is a predicate gate DECLARED here?" into one definition,
  `@object-ui/core`'s `hasDeclaredPredicate`. Three places were left out of that
  ruling's placement clause, each with the same shape of defect: the evaluator's
  single default for "there is nothing here to evaluate" is `true`, meaning
  _visible/enabled_, and wherever a too-wide "declared" test hands it an empty
  predicate on an INVERTED key, that `true` turns a control off for a value the
  metadata never used to say anything.

  **`SchemaRenderer`'s `hidden` / `hiddenOn` legs (objectui#3955)** asked
  `!== undefined` and did NOT negate the verdict, so an empty predicate meant HIDE
  and the node disappeared — on the generic rendering path, since that block runs
  for every schema type. Harder to diagnose than the `disabled` twin objectui#3862
  fixed: a greyed-out control is still on screen, while a node that never rendered
  is indistinguishable from metadata that meant to hide it. Both legs now read the
  shared definition.

  **The "blank" criterion now covers the envelope spelling (objectui#3960).** The
  definition trimmed a whitespace-only STRING and not an envelope's whitespace-only
  `source`, because `toPredicateInput` folds a `source` of `''` and does not trim.
  So `{ dialect: 'cel', source: '   ' }` was a declared gate whose verdict came from
  core's own CEL entry calling that exact value "no predicate" (`if (!source.trim())
return true`) — `disabled` greyed out forever and `ActionRunner.execute` answered
  `{ success: false, error: 'Action is disabled' }` with the handler never invoked.
  Blankness is now decided once for both spellings, at the definition. The
  NORMALIZER's contract is deliberately unchanged: "what shape does the evaluator
  accept" is not the same question as "is there a condition", and moving the trim
  there would have flipped verdicts for every
  `useCondition(toPredicateInput(…))` call site, including container-level `visible`
  reads that never asked this question at all.

  **`ActionEngine.getActionsForLocation`'s `visible` filter (objectui#3957)** was the
  last consumer answering the question with a range of its own — three empty
  spellings folded by hand, everything else coerced with `Boolean(raw)`. It now reads
  the shared definition and the coercion branch is gone, so one value no longer gets
  two answers depending on whether an action was surfaced by the engine or rendered
  standalone (the invariant objectui#3314 established). Its fail-CLOSED posture on a
  predicate that THROWS is untouched (`throwOnError: true` + `warnHiddenPredicate`):
  "the predicate faulted" and "there is no predicate" are different facts.

  Behaviour changes, before → after. Observation-class: each needs an author to write
  an empty/blank predicate or a non-predicate value, and there is no known user path
  today.

  | value                                                       | `ActionEngine` `visible` | `SchemaRenderer` `hidden` | `disabled` (action face + generic path) | `ActionRunner.execute` `disabled` |
  | ----------------------------------------------------------- | ------------------------ | ------------------------- | --------------------------------------- | --------------------------------- |
  | `''` / `null`                                               | shown → shown            | HIDDEN → rendered         | unchanged                               | unchanged                         |
  | `'   '` (blank text)                                        | HIDDEN → shown           | HIDDEN → rendered         | unchanged                               | unchanged                         |
  | `0` / `NaN`                                                 | HIDDEN → shown           | HIDDEN → rendered         | unchanged                               | unchanged                         |
  | `{}` / `[]`                                                 | shown → shown            | HIDDEN → rendered         | unchanged                               | unchanged                         |
  | `{ dialect: 'cel', source: '' }`                            | shown → shown            | HIDDEN → rendered         | unchanged                               | unchanged                         |
  | `{ dialect: 'cel', source: '   ' }`                         | shown → shown            | HIDDEN → rendered         | GREY → on                               | refused → runs                    |
  | `{ source: '   ' }` (no dialect)                            | HIDDEN → shown           | HIDDEN → rendered         | GREY → on                               | refused → runs                    |
  | `true` / `false` / bare CEL / `${…}` / a non-blank envelope | unchanged                | unchanged                 | unchanged                               | unchanged                         |

  Every row moves toward "there is no gate here", never away from it, and no value
  that HAS a verdict changes it — a declared `false` is still a verdict, not a
  missing gate (objectui#3812), and blankness is `trim()`, not "short": `{ dialect:
'cel', source: ' x ' }` is a predicate. One alias precedence changes with the
  `hidden` legs and is pinned rather than claimed as an equivalence: an undeclared
  `hidden` no longer short-circuits the chain, so a declared `hiddenOn` is finally
  consulted.

  `SchemaRenderer`'s four `visible*` legs keep `!== undefined` deliberately, as
  objectui#3850 ruled: their `true` is negated, so an empty predicate already lands
  on "shown", and narrowing them would change alias precedence rather than fix
  anything.

- Updated dependencies [6719877]
- Updated dependencies [56ff091]
- Updated dependencies [7864f03]
- Updated dependencies [d229dfa]
- Updated dependencies [4bc6c23]
- Updated dependencies [c3b01a7]
- Updated dependencies [f5f8744]
- Updated dependencies [3765678]
- Updated dependencies [d83f6b3]
- Updated dependencies [5f08c05]
- Updated dependencies [69becd2]
- Updated dependencies [5e52495]
- Updated dependencies [b750823]
- Updated dependencies [e06810e]
- Updated dependencies [ab3ad4f]
- Updated dependencies [c2fd122]
- Updated dependencies [ac2139c]
- Updated dependencies [b14ab3a]
- Updated dependencies [8c60819]
- Updated dependencies [41d6022]
- Updated dependencies [e64a52e]
- Updated dependencies [844d17f]
- Updated dependencies [48132f7]
- Updated dependencies [4dcd52a]
- Updated dependencies [42ae5c6]
- Updated dependencies [1d723e3]
- Updated dependencies [0109f54]
- Updated dependencies [7e5bb5d]
- Updated dependencies [fbc23e0]
- Updated dependencies [6d762da]
- Updated dependencies [e6fdbdc]
- Updated dependencies [f9faa7d]
- Updated dependencies [6bb454a]
- Updated dependencies [523be48]
- Updated dependencies [7e2b7e9]
- Updated dependencies [33526fd]
- Updated dependencies [32413ec]
- Updated dependencies [c1e1e6b]
  - @object-ui/core@17.4.0
  - @object-ui/i18n@17.4.0
  - @object-ui/types@17.4.0
  - @object-ui/data-objectstack@17.4.0

## 17.3.0

### Patch Changes

- d915c47: Relation fields (`lookup` / `master_detail` / `user` / `tree`) are now usable in action and conditional-formatting predicates: they bind as the stored foreign key on every surface, and the fields a predicate reads are included in the query projection (#3501).

  Before this, one predicate over one relation field had four different fates, decided by things its author does not control. `$expand` **replaces** the id in place with the whole related record, and a view expands exactly the relations it shows as COLUMNS — so `record.owner == "U1"` was **true** where the column was absent, **false** where it was displayed, and a **fault** where the field was neither displayed nor projected (a list's `$select` was built from its columns alone, and CEL treats an absent key as a fault, not as null). A fault is fail-CLOSED on the row kebab and the selection bar and fail-OPEN on the lenient paths, so the same authoring mistake hid the button from everyone on one surface and showed it to everyone on the next, with nothing on screen to point at either. The server, meanwhile, only ever sees the id — so client and server could not agree, which is the one thing ADR-0036 / ADR-0058 exist to guarantee.

  Two changes close it. `toPredicateRecord` (new, `@object-ui/core`) collapses expanded relation values back to their ids when a record is bound for evaluation — driven by the object's own field types, not by sniffing for an `id` key, so a `json` field that happens to carry one is untouched. It is threaded through `evalRowPredicate` / `resolveConditionalFormatting` (via a new `fields` option), `useRowPredicate`, `partitionBulkRows`, and both `page:header` evaluators, with the object schema supplied by `ObjectGrid` / `ListView` / `ObjectKanban` / the record context. Kanban card formatting is threaded the same way, so a rule cannot match on the grid view of a list and silently never match on its board. Display is unaffected — a detail-page title still renders the related record's name, and the schema-only `kanban-ui` entry point (which has no object schema to offer) keeps using the payload verbatim. `collectPredicateFieldRefs` / `listViewPredicates` (new) harvest the `record.x` / `data.x` references out of a view's conditional formatting, row-action defs, bulk-action defs, promoted object actions and `userActions` overrides, and add them to `$select` — intersected with the object's declared fields plus the platform columns every object carries (`isProjectableField`), because an unknown key is not ignored by every backend. No `$expand` is added: a predicate wants the foreign key, which is what an unexpanded relation already is.

- 175bd79: `toPredicateInput` is now re-exported from `@object-ui/core` instead of being reimplemented in `@object-ui/react`. Behaviour is byte-for-byte identical — the renderer-side copy in `packages/react/src/hooks/useExpression.ts` had item-for-item the same semantics as the canonical `packages/core/src/evaluator/predicateInput.ts` (booleans short-circuit, bare strings and non-`cel` dialects become `${…}`, a `{ dialect: 'cel', source }` envelope survives so `useCondition` routes it to the canonical `@objectstack/formula` engine, empty/absent predicates become `undefined`), and every existing import path (`import { toPredicateInput } from '@object-ui/react'`) keeps working with an unchanged signature. What changes is that there is now ONE implementation rather than two held in step by a parity table: #3314 is the record of what two normalizations do when left alone — they drift, and the same `visible:` predicate reaches different verdicts depending on whether the action was surfaced by `ActionEngine.getActionsForLocation` or rendered standalone. The 14-shape normalization parity table degenerated once both of its columns called the same function, so it is replaced by a single identity assertion (`react`'s export IS `core`'s function object); the engine-path-vs-renderer-path verdict parity suite is untouched and still proves the two call paths agree (#3367).
- Updated dependencies [18cd432]
- Updated dependencies [d915c47]
- Updated dependencies [b71fc92]
- Updated dependencies [65516ba]
- Updated dependencies [94c5b7c]
- Updated dependencies [ca0fa8f]
- Updated dependencies [3889ffb]
- Updated dependencies [5781fb1]
- Updated dependencies [7e2406a]
- Updated dependencies [9e9e9a9]
- Updated dependencies [4eeb932]
- Updated dependencies [5c856ec]
- Updated dependencies [23018cc]
- Updated dependencies [68b6a28]
- Updated dependencies [0554e88]
- Updated dependencies [d915c47]
- Updated dependencies [f44d872]
- Updated dependencies [28b2e65]
- Updated dependencies [509104a]
- Updated dependencies [825bbe3]
- Updated dependencies [6195841]
- Updated dependencies [5dd0127]
- Updated dependencies [a415684]
- Updated dependencies [a4cff5b]
- Updated dependencies [5af2852]
- Updated dependencies [f833d3a]
- Updated dependencies [a6ec93d]
- Updated dependencies [2a9513d]
- Updated dependencies [d22ae31]
- Updated dependencies [c7ed4c3]
- Updated dependencies [2409e1d]
- Updated dependencies [789fe3e]
  - @object-ui/core@17.3.0
  - @object-ui/types@17.3.0
  - @object-ui/i18n@17.3.0
  - @object-ui/data-objectstack@17.3.0

## 17.2.0

### Minor Changes

- a889e31: A record's approval band now shows the quorum / per-group tally the server already computes.

  The showcase's `showcase_committee_quorum` node declares `behavior: 'quorum'` with
  `minApprovals: 2` over three approvers, and even ships a pre-rendered
  `"Committee Sign-off (2 of 3)"` label; `showcase_expense_signoff` declares
  `per_group` (会签) with named manager / finance groups. On the business record
  the approval band rendered none of it — the lock badge, the recall button and
  the approve/reject actions were all correct, but a two-of-three committee step
  looked exactly like a one-approver step. An approver could not see whether their
  own click finalized the node or was one of three, which is the single fact a
  quorum node exists to express (objectstack#4478).

  Nothing was wrong on the wire, and nothing here papers over the server. The
  framework computes `decision_progress` — `{ behavior, got, need, groups? }`,
  derived from the node's own `node_config_json` snapshot, so the count a client
  shows is the count the engine will enforce. **It attaches that block in
  `getRequest` only**: `listRequests` deliberately skips it, because the
  `sys_approval_action` tally it costs is per row and a list read may return
  hundreds. The record header's `useRecordApprovals` reads
  `GET /approvals/requests?object=…&recordId=…` — the list route — so the
  enrichment was never in the payload it had. The hook now follows up with one
  single read for the ONE pending row and folds the result onto it; a failed or
  mismatched follow-up leaves the row exactly as the list sent it, so a display-only
  enrichment can never take the approval panel down and no tally is ever invented.

  `InlineEditProvider` carries the block through as `approvalProgress`, and the
  DetailView approval band renders it beside the existing badge: a labelled
  `role="progressbar"` with one tick per required approval for `quorum` /
  `unanimous`, and for `per_group` a chip per group marking which have signed
  (`finance 1/1` ✓, `manager 0/1`). Group names come from the flow author's own
  config, so they need no locale strings; the three new label keys are added to all
  ten packs. `first_response` nodes carry no `decision_progress` and are unchanged —
  one decision is the whole step there, and a "1 of 1" bar would be noise.

  Scored `minor` rather than `patch`: this is new observable rendering plus a new
  public `approvalProgress` prop / `ApprovalProgress` type on `@object-ui/react`,
  not a behavior correction inside an existing surface.

- 09d30a4: Stop declaring 18 `@object-ui/auth` / `@object-ui/components` / `@object-ui/react`
  symbols under names `@objectstack/spec` owns (objectui#3159, objectstack#4115
  batch 5).

  **Breaking for importers of all three packages** — six exported names changed,
  because the spec exports the same name for a _different_ thing:

  | package      | was                          | now                      | what the spec's same-named export actually is                                  |
  | :----------- | :--------------------------- | :----------------------- | :----------------------------------------------------------------------------- |
  | `auth`       | `AuthSession`                | `AuthClientSession`      | the SERVER's session record (`{ id, userId, expiresAt: ISO string, token? }`)  |
  | `auth`       | `AuthProviderConfig`         | `AuthProviderOptions`    | an OAuth/OIDC provider registration (`{ id, clientId, clientSecret, scope? }`) |
  | `components` | `FilterCondition`            | `FilterBuilderCondition` | the recursive ObjectQL predicate AST (`$and`/`$or`/`$not`)                     |
  | `components` | `Field`                      | `FieldContainer`         | an object FIELD's metadata and its builder namespace                           |
  | `react`      | `ConflictResolutionStrategy` | `ConflictResolution`     | the metadata-MERGE policy (`error \| priority \| first-wins \| last-wins`)     |

  The `react` rename is the odd one out: the new name is the **spec's own** name
  for the union that hook always used, so it is a re-export rather than a dialect.

  Eleven more keep their names and are now **imported or derived from the spec**
  instead of re-declared: `TenancyPosture`, `DelegableScope` (+`DelegableAdminScope`),
  `AuthUser`, `ShareLinkPermission`, `ShareLinkAudience`, `ShareLink`, `SortItem`,
  `OfflineStrategy`, `OfflineCacheConfig`, `OfflineSyncConfig`, `OfflineConfig`,
  `NavigationConfig`.

  **Three of the copies were losing information, not just duplicating it.**

  - `AuthUser` never declared the spec's `positions` or `tenantId` — the
    authorization inputs. Its `[key: string]: unknown` index signature meant the
    omission was invisible at every call site _and_ to any structural comparison
    (the objectstack#4075 mechanism). It now `extends` the spec principal, so the
    display-only fields (`image`, `role`, `roles`, `emailVerified`) are the delta
    and the spec's keys arrive on their own.
  - `useNavigationOverlay`'s copy carried the note _"inline … to avoid importing
    from `@object-ui/types` (which may not be a direct dependency of
    `@object-ui/react`)"_. The vocabulary belongs to `@objectstack/spec`, which
    **is** a direct dependency — the same expired "kept local to avoid a
    dependency" comment objectui#3169 found in `@object-ui/app-shell`.
  - `useOffline` and `usePerformance` both opened with _"Types aligned with
    `@objectstack/spec` v2.0.7"_. The installed spec is 17.0.0-rc.1.

  `ShareLink` derives from the spec row **minus `password_hash`** — omitted rather
  than optional, because it is the credential itself and typing it in a browser
  package is an invitation to render it. `password_protected` (the boolean the UI
  needs in its place) is the one local addition.

  The config types derive from each schema's **input** side, not `z.infer`.
  `useOffline(config: OfflineConfig = {})` defaults to the empty object, which the
  output type — every `.default()`ed key required — would reject outright.

  `@objectstack/spec` moves from `devDependencies` to `dependencies` in
  `@object-ui/components`: its public type surface now references the spec.

  Scored `minor`, not `major`, per this repo's fixed-group rule — objectui's major
  tracks `@objectstack`, so breaking changes of our own ship as minor with the
  semantics spelled out above (see AGENTS.md §版本号策略). A `major` here would carry
  all 39 packages of the fixed group to `18.0.0` and off objectstack's 17.x line.

### Patch Changes

- ea96284: `useMetadataItem` no longer spins forever outside a `<MetadataProvider>` — the "graceful fallback" was the thing that made those consumers impossible to mount.

  `useMetadata()` built its no-provider fallback **inline on every call**, so outside a provider
  every render produced a new `getItem`. `useMetadataItem` lists `getItem` in its effect deps and,
  on the no-name path, called `setState({ item: null, loading: false, error: null })` with a fresh
  object each run. New identity → effect re-runs → new state object → re-render → new identity:
  an unbreakable loop, synchronous enough to hang inside `render()` rather than fail.

  So the fallback documented as the graceful path for consumers mounted outside a provider —
  "common in unit tests that only need to assert on rendering" — was precisely what made them
  unmountable. `record:alert` and `record:quick_actions` both call `useMetadataItem`
  unconditionally; each pinned a core and grew unbounded (8.6 GB before the first kill) on a
  `render()` that never returned.

  Two changes, at the cause and one layer in:

  - The fallback is a frozen module-level singleton, so its identity is stable across renders.
  - The clear-state path bails out when the state is already cleared, instead of installing an
    equal-but-new object. That covers the same loop arriving by another route — any caller whose
    context value is rebuilt per render, which this interface explicitly invites ("hand-rolled
    context values in tests keep working").

  Found by `apps/console/src/__tests__/record-block-record-reach.test.tsx` (objectui#3149), which
  could not mount either block until this was fixed.

- Updated dependencies [4ae0ac4]
- Updated dependencies [696e3c1]
- Updated dependencies [bca45cc]
- Updated dependencies [a889e31]
- Updated dependencies [4bf612c]
- Updated dependencies [335041c]
- Updated dependencies [b414983]
- Updated dependencies [256f8cc]
- Updated dependencies [c5ccbd5]
- Updated dependencies [d9668a7]
- Updated dependencies [4b470b9]
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
  - @object-ui/i18n@17.2.0
  - @object-ui/data-objectstack@17.2.0

## 17.1.0

### Minor Changes

- c4db402: refactor(views): ListView's `aria` and `sharing` are the spec sub-shapes (#2890 scope A step 5)

  Last rename batch in the ListView vocabulary migration.

  **`aria`** is now the spec's `AriaPropsSchema`: `label` → `ariaLabel`,
  `describedBy` → `ariaDescribedBy`, folded at the ListView boundary like every
  other legacy key. Two things fall out of adopting the spec shape:

  - `role` becomes authorable. The list region hardcoded `role="region"`; it now
    reads `aria.role` and falls back to `region`.
  - `aria.live` stays as a documented local extension — it has no spec
    counterpart, and dropping it would silently disable a shipped capability.
    Promote it rather than growing that extension.

  **`sharing`** is now the spec's `ViewSharingSchema` (`{ type, lockedBy }`),
  imported by reference — the local four-key object is gone. The legacy pair folds
  in: `visibility` collapses onto the two ownership kinds the spec models (only
  `private` is `personal`; `team` / `organization` / `public` are all
  `collaborative`), and a bare `enabled: true` maps to `personal`, which is the
  badge the user already saw (the old title fell back to `'private'`).

  _Visible change_: the share badge's tooltip shows the spec ownership type, so a
  view authored with `visibility: 'team'` reads "Sharing: collaborative" instead
  of "Sharing: team". The four-value audience has no spec home and nothing but
  that tooltip consumed it; keeping a second audience enum alive would re-open the
  fork this issue closes.

  Also fixes the **spec bridge**, which was doing the opposite of its job: given a
  spec-shaped `sharing`, `transformListView` _downgraded_ it — inventing a legacy
  `visibility` audience and an `enabled` flag that the renderer then had to fold
  back. Both sides speak `ViewSharing` now, so it passes through.

  `conditionalFormatting` and `exportOptions` are deliberately **not** folded.
  Both objectui shapes are supersets carrying capability the spec cannot express —
  the `{ field, operator, value }` rule form, and `maxRecords` / `includeHeaders`
  / `fileNamePrefix`. Folding them onto the narrower spec shapes would delete
  working features; they want promotion upstream, not a rename.

- 07de839: fix(notifications): the config, `position` and action `variant` are read instead of forked or ignored (#3014 follow-up)

  The last of the notification contract. After `displayType` (#3071) and `icon`
  (#3076), four gaps of the same family were left:

  - **the config was 3/4 inert** — only `defaultDuration` was ever read.
    `maxVisible` and `stacking` were carried and ignored, while
    `NotificationBanners` capped at a hard-coded `3` of its own;
  - **its field names forked from `NotificationConfigSchema`** — `position` vs
    `defaultPosition`, a renderer-local `stacking` boolean with no spec
    counterpart, and no `pauseOnHover` at all;
  - **a notification could not declare a `position`.** The #3008 parity guard
    asserted the position _vocabulary_ matched the spec while nothing positioned
    anything by it — a guard passing over an unused value;
  - **`NotificationActionButton.variant` was the shadcn Button vocabulary**
    (`default | destructive | outline`) under a spec-shaped name, forking
    `NotificationActionSchema.variant` (`primary | secondary | link`).

  **How positioning resolves now** — `notification.position ?? config.defaultPosition
?? nothing`, and "nothing" is a real answer:

  - **declared** → the surface pins itself there, always. `presentNotificationToast`
    passes it per-toast so the contract wins over the container;
  - **undeclared** → the surface keeps its own anchor (a snackbar's bottom edge) or
    defers to the host's toast chrome.

  That asymmetry is the design decision. The host's sonner container also serves
  toasts that are _not_ spec notifications (the console action runtime's own
  `toast.*` calls), so it stays the fallback authority for placement — never a
  competing one. A declared position a component prop could silently override
  would be the same "validates, then does nothing" shape this whole area is about.
  Hence `defaultPosition` has no fabricated default: "the host didn't say" has to
  be representable.

  Also: `maxVisible` / `stackDirection` now drive every stacking surface through
  one shared `visibleNotificationStack` (cap keeps the NEWEST, stack grows in the
  declared direction); `pauseOnHover` holds a transient notification's timer and
  resumes it with the time it had left, which needed the provider to track live
  timers rather than fire-and-forget `setTimeout`s. Legacy spellings still resolve:
  `position` folds into `defaultPosition`, and `stacking: false` reads as
  `maxVisible: 1` rather than being ignored.

  `onToast` now receives the resolved config as a second argument, so the delegate
  can apply the parts of the contract only it can. Existing one-argument handlers
  are unaffected. The spec-parity guard gained the action-variant vocabulary, the
  one notification enum it did not cover.

- 2a40b5e: feat(notifications): each spec `displayType` gets its own presentation instead of a toast (#3014)

  #3008 closed the **contract** half of this: `NotificationContext`'s union matched
  `NotificationTypeSchema`, and `notify()` materialized the declared type so a
  consumer _could_ branch on it. Nothing did. `NotificationProvider` handed every
  item to the host's `onToast` delegate regardless of type, so an author picking
  `banner` or `inline` got a transient overlay — plausible output, wrong output.

  Each of the five spec types now has a presentation of its own:

  | `displayType` | Presentation                                           | Rendered by                        |
  | ------------- | ------------------------------------------------------ | ---------------------------------- |
  | `toast`       | transient overlay (unchanged)                          | the host's `onToast` delegate      |
  | `snackbar`    | bottom-anchored bar, one at a time, at most one action | `<NotificationSnackbar />`         |
  | `banner`      | page-width strip **in the content flow**               | `<NotificationBanners />`          |
  | `alert`       | blocking acknowledgement dialog, FIFO queue            | `<NotificationAlerts />`           |
  | `inline`      | in place, at the raising surface                       | `<NotificationInline scope="…" />` |

  The four surface components ship from `@object-ui/components` and subscribe via
  `useNotificationsByPresentation(type, scope?)`.

  **Answers to the three questions the issue left open:**

  1. **Banner/inline placement is the host's.** They are not overlays: a banner takes
     space at the top of the content area and an `inline` notification belongs next to
     the thing that raised it. So the context exposes the items and the surfaces
     subscribe, rather than one `onToast`-style delegate positioning everything. An
     `inline` notification carries a `scope` that pairs it with its outlet, so two
     forms on one page don't show each other's messages.
  2. **`alert` is modal-ish but NOT the action system's `ModalHandler`.** That handler
     resolves a page/object, renders it, and reports an `ActionResult` back to the
     `ActionRunner`; a notification alert has no schema, no target and no result.
     Routing it there would mean synthesizing a page just to say "OK". It renders
     through the `AlertDialog` primitive instead — no second action-modal path.
  3. **`snackbar` earns its own component.** It supersedes rather than stacks, anchors
     bottom regardless of the toast position config, and takes at most one action.
     Making it a sonner variant is what "presents as a toast" means.

  **Also fixed:** auto-dismiss now follows the presentation. `toast`/`snackbar` keep
  the transient timer; `banner`/`alert`/`inline` are persistent unless the raiser sets
  `duration` explicitly — a persistent banner used to evaporate on the shared 5s toast
  timer. `dismissible` is honored on the persistent surfaces (an `alert` always keeps
  its acknowledge button; `dismissible: false` only closes the Escape route).

  `onToast` now receives **only** `toast` items. A provider with no `onToast` remains
  the supported store-only mode (a bell reading `notifications`/`unreadCount`), but
  raising one of the other four types with its surface unmounted warns in dev, naming
  the component to mount — that failure used to be silent.

  `NOTIFICATION_PRESENTATIONS` is typed `Record<NotificationPresentation, …>`, so a new
  member in the spec enum fails type-check until its presentation is decided; a parity
  test additionally asserts the table covers `NotificationTypeSchema` exactly and that
  no two types share a surface.

- ce08d55: chore(deps): upgrade `@objectstack/*` to 17.0.0-rc.0, and let the spec take back what it now owns

  `spec` / `client` / `formula` / `lint` move from `^16.x` to `^17.0.0-rc.0`. Two
  groups of v17 changes reach this repo, and they pull in opposite directions —
  the spec pruned surface objectui re-exported, and adopted surface objectui had
  been carrying locally.

  **The spec pruned dead Theme config (objectstack#3494), so the re-exports went
  with it.** `ThemeSchema` dropped `spacing`, `breakpoints`, `logo`, `density`,
  `wcagContrast`, `rtl`, `touchTarget` and `keyboardNavigation` — authorable but
  never enforced, so authoring them was already a silent no-op. `@object-ui/types`
  re-exported those sub-schemas _by reference_ (issue #2231), so they could not
  survive the prune without becoming hand-written mirrors — exactly the second
  de-facto contract AGENTS.md #0.1 forbids. Removed from the public surface:

  - Types: `Spacing`, `Breakpoints`, `DensityMode`, `WcagContrastLevel`,
    `ThemeLogo`, and the deprecated `SpacingScale` alias
  - Schemas: `SpacingSchema`, `SpacingScaleSchema`, `BreakpointsSchema`,
    `ThemeLogoSchema`, and the `SpacingSchemaType` / `BreakpointsSchemaType` helpers
  - `Theme.spacing`, `Theme.breakpoints` and `Theme.logo`

  `mergeThemes` no longer merges the three dropped keys. `generateThemeVars` is
  unaffected — it never emitted them, which is why the liveness audit called them
  dead. The one real consumer was `ThemeProvider`, which set the favicon from
  `theme.logo.favicon`; that path is gone, because v17 strips the key at parse and
  it could never arrive again. The live favicon is unaffected: it comes from
  operator branding (`getFaviconUrl()`), applied in the console's `index.html`,
  `main.tsx`, and on route change.

  Nothing else read the pruned types. In particular the list-density feature is
  untouched — `useDensityMode` and `rowHeightToDensityMode` use `@object-ui/core`'s
  own local `DensityMode`, which never came from the spec.

  **The spec adopted objectui's ListColumn extensions (objectui#2231), so the
  extension collapsed.** `ListColumnSchema` used to `.extend()` the spec with two
  fields, each carrying a note to promote it upstream rather than grow the
  extension; v17 did exactly that. `summary` is now the spec's
  `union([ColumnSummarySchema, ColumnSummaryConfigSchema])` — the same enum ∪
  `{ type, field }` form `useColumnSummary` reads — and `prefix` is the spec's
  `ColumnPrefixSchema`. `ListColumnSchema` is now a plain by-reference re-export.
  One behavior change rides along: `prefix.type` defaults to `'text'` on parse
  instead of staying `undefined`, so the cell renderer always gets a value.

  **Node 22 is now the floor.** Every `@objectstack` package declares
  `engines.node: ">=22.0.0"` (objectstack#3825; Node 20 reached EOL 2026-04-30).
  This repo claimed `>=20` and ran CI on Node 20.x, so it promised — and validated
  — a runtime its own core dependency does not support. `engines.node` is now
  `>=22`, CI runs Node 22.x, and the CI/deployment docs say so.

  The major stays 17: per AGENTS.md the major tracks `@objectstack`'s major, which
  is also 17, and that convention deliberately outranks semver purity — so the
  removals above ship as a minor rather than desyncing the two.

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

- fc0272a: fix(actions): apply the ADR-0066 D4 capability gate on every action surface (framework#3923)

  An action declaring `requiredPermissions` is supposed to be one declaration with
  two enforcement surfaces: 403 on the server, hidden button in the UI. The UI half
  only ever ran inside `ActionEngine.getActionsForLocation` — and the surfaces
  `record_header`, `record_more`, `list_item` and `list_toolbar` actually render on
  do not go through the engine. They filter their own action lists. So a button
  declaring a capability nobody holds rendered, live and clickable, on the record
  header, in every grid row menu, and on the list toolbar. For a `type: 'api'`
  action pointed at a self-authored endpoint, nothing else was checking either: the
  platform's action route (which is where the 403 comes from) never sees that
  request.

  `page:header`, `action:bar` (business _and_ `systemActions`) and the grid's
  `RowActionMenu` now apply the same gate, via a shared `useCapabilityGate()` so
  the surfaces cannot drift apart. The rule is the engine's, unchanged: hide unless
  the caller holds **all** declared capabilities; an empty held set is "holds
  nothing" and gates; **unknown** — no action runtime, no resolved capabilities —
  fails OPEN, because the server is the authority and hiding a permitted user's
  button on missing client data is the worse failure.

  The record surface was also feeding the gate nothing to work with.
  `RecordDetailView` mounts its own `<ActionProvider>`, which shadows the shell's
  for every action on that page, and seeded it with identity only — no
  `systemPermissions`. Since unknown fails open, that alone un-gated every
  `record_header` / `record_more` / `record_section` action on the one page those
  locations exist on. It now forwards the caller's resolved capabilities (and only
  once they have actually resolved, so a standalone embed without a
  `PermissionProvider` keeps failing open rather than hiding everything).

  `useRecordEditable`'s record-level explain probe went out on a bare
  `fetch(..., { credentials: 'include' })`. A bearer-token session carries its
  credential in the `Authorization` header, not a cookie, so the probe came back
  401 on a perfectly valid admin session and the verdict silently failed open —
  the hook was inert in exactly the deployments it was written for. It now rides
  the host's authenticated fetch (`SchemaRendererProvider`'s `apiFetch`), falling
  back to the global one for standalone embeds.

- 9eb932b: fix(console): three real-user console failures — 403 blamed on the network, ⌘K search capped at 8 objects, nav gating fields inert

  1. **List error panel classifies the failure** (`plugin-list`, `i18n`): a 403/401 from the data source used to render the same "check your connection" copy as a genuine outage, sending users to debug their network while the server was correctly denying access. The panel now classifies by `httpStatus`/`status`/`statusCode`, the `PERMISSION_DENIED`/`UNAUTHORIZED` error codes, or an `HTTP <status>` message prefix, and renders dedicated permission-denied / sign-in-required copy (all nine locales).

  2. **⌘K / full-page search scope is no longer truncated** (`react`): `maxObjectsQueried` caps the per-object fanout fallback, not the search scope — it used to slice the candidate pool itself, so the `objects` whitelist sent to the platform's `/api/v1/search` only ever named the first 8 nav objects. Which sidebar group came first decided which records were findable; everything later in the nav was unsearchable no matter what the user typed.

  3. **Nav gating fields finally gate** (`app-shell`): `evaluateVisibility` only evaluated `${…}` template strings, so the `{ dialect: 'cel', source }` envelopes the spec normalizes every authored `visible` predicate into fell through to a blanket "visible" — a constant-false predicate still rendered for everyone. It now delegates to `ExpressionEvaluator.evaluateCondition`, which routes CEL envelopes to the canonical `@objectstack/formula` engine. And the sidebars' `requiredPermissions` check treats a bare name as an ADR-0066 system capability (union of the user's permission-set `systemPermissions` from `/me/permissions`) — the same subset rule the server applies to `AppSchema.requiredPermissions` — instead of misreading it as `can(<name>, 'read')`, which had degraded `requiredPermissions` into a hide-from-everyone switch (admins included). The `object:action` form and the legacy object-read fallback keep working.

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

- 2374a49: fix(sdui): a react page no longer loses its state to a memo that never held, and a source that exports nothing fails loudly

  Writing the regression guard for objectui#2954's "latent hazard" found it was
  already real.

  **`evaluatedSchema` was memoised on values rebuilt every render.**
  `SchemaRenderer` fell back to a fresh `{}` when no `SchemaRendererProvider` sat
  above it, and `usePageVariables()` returned a brand-new object literal outside a
  `PageVariablesProvider`. Both feed the `evaluatedSchema` memo's dependency list,
  so for any tree without those providers the memo never hit: the schema was
  re-cloned and the ExpressionEvaluator re-run on every render, and children got a
  new schema identity every time. A `kind:'react'` page memoises its compiled
  source on that identity, so the page was recompiled — a new page function, a new
  element type — and React remounted it, silently discarding the user's `useState`.
  Any registry notification (every lazy plugin's first load) triggered it. Both
  fallbacks are now module constants.

  **A source that exports nothing now throws instead of rendering blank.**
  `generateElement` inserts the implicit `export default` only when the source
  _starts with_ JSX, a `function` declaration, `()` or `class` — so the very
  common `const Page = () => …` exported nothing, and the page rendered blank with
  no error reported anywhere. It now throws with a message naming the fix, which
  `ReactRunner`'s error panel surfaces. `export default null` still means "render
  nothing"; a default export that is not a component throws too.

  **`PageSchema['kind']` matches `@objectstack/spec`.** It declared
  `'full' | 'slotted'` while the renderer had shipped `'react'` and
  `'html'`/`'jsx'` since ADR-0080 and read the field through a cast. The union now
  spells all five and the cast is gone.

  Docs: new `content/docs/guide/react-pages.md` (choosing between the executed and
  parsed tiers, the capability gate, the injected scope, flat props, `Block`,
  `useAdapter`, source shapes, error handling) and a `@object-ui/react-runtime`
  README — the package had neither, while being the tier AI-authored pages target.

- Updated dependencies [62311b6]
- Updated dependencies [9e7349e]
- Updated dependencies [8864971]
- Updated dependencies [9b773f9]
- Updated dependencies [1cf0de7]
- Updated dependencies [752e18f]
- Updated dependencies [c785740]
- Updated dependencies [b41f401]
- Updated dependencies [19e9fa0]
- Updated dependencies [d61efd1]
- Updated dependencies [95b7214]
- Updated dependencies [7d9734d]
- Updated dependencies [6ae818e]
- Updated dependencies [9eb932b]
- Updated dependencies [746dd00]
- Updated dependencies [aebfa4f]
- Updated dependencies [38ca8be]
- Updated dependencies [3cb9646]
- Updated dependencies [4952edf]
- Updated dependencies [7f0252e]
- Updated dependencies [7d35010]
- Updated dependencies [c4d7b20]
- Updated dependencies [7639a61]
- Updated dependencies [94e63ef]
- Updated dependencies [02aef0c]
- Updated dependencies [6f29aa5]
- Updated dependencies [d21794c]
- Updated dependencies [c4db402]
- Updated dependencies [5319bf1]
- Updated dependencies [49e5671]
- Updated dependencies [b5b97e2]
- Updated dependencies [f59f2c1]
- Updated dependencies [4874117]
- Updated dependencies [ad0183a]
- Updated dependencies [ce08d55]
- Updated dependencies [a17ef09]
- Updated dependencies [aa1240a]
- Updated dependencies [2374a49]
- Updated dependencies [390c071]
- Updated dependencies [d10f526]
- Updated dependencies [2d5d594]
- Updated dependencies [ea7f477]
- Updated dependencies [7f23cd0]
- Updated dependencies [0ded602]
- Updated dependencies [24e0e0a]
- Updated dependencies [f8a95e5]
- Updated dependencies [3a6cf24]
- Updated dependencies [aa35561]
- Updated dependencies [03bd53b]
- Updated dependencies [3c1f321]
- Updated dependencies [a045a32]
- Updated dependencies [912496d]
- Updated dependencies [9867281]
  - @object-ui/core@17.1.0
  - @object-ui/types@17.1.0
  - @object-ui/data-objectstack@17.1.0
  - @object-ui/i18n@17.1.0

## 17.0.0

### Major Changes

- c77108c: refactor(spec-bridge): remove the dead page/dashboard bridges (#1892)

  `SpecBridge`'s `page` and `dashboard` bridges — `bridgePage`, `bridgeDashboard`,
  and the `SpecBridge#transformPage` / `#transformDashboard` methods — had no
  runtime consumer. Pages render through their own renderer and dashboards
  through `DashboardView → DashboardRenderer → DatasetWidget` (ADR-0021); neither
  path routes through `SpecBridge`. The dashboard bridge's input shape
  (`object` / `categoryField` / `valueField` / `aggregate`) is the pre-ADR-0021
  widget model, which the strict `DashboardWidgetSchema` now rejects — so the
  bridge could not receive a spec-valid dashboard even in principle.

  Flagged dead by the metadata-liveness audit (framework #1878 / #1892). The
  `list` and `form` bridges are unaffected and remain the live authoring path.

  BREAKING CHANGE: the public exports `bridgePage`, `bridgeDashboard`, and the
  `SpecBridge#transformPage` / `#transformDashboard` methods are removed. There
  is no replacement — render pages and dashboards through their renderers
  (`DashboardRenderer` / the page renderer) directly.

### Minor Changes

- 952b978: fix(detail): the approval band honors the node's `lockRecord` instead of assuming every approval locks (#2902)

  A record detail page treated "a pending approval request exists" as "this
  record is locked". An approval node declares `lockRecord` (default `true`), and
  on `lockRecord: false` the server keeps accepting writes for the whole time
  that node waits — so the console was asserting a lock the backend did not
  enforce.

  The label was the smaller half of it. The same conflated signal fed `canEdit`,
  so the record-level inline-edit session was suppressed too: no pencils,
  `enter()` a no-op. On a single-approver step — a department head or plant
  manager, exactly the case `lockRecord: false` exists for, where the approver is
  meant to fill in the missing detail before deciding — the capability was
  unreachable from the UI. And a flow chaining nodes with different policies drew
  one identical band for "edit freely" and "the server will reject your save with
  `RECORD_LOCKED`", so the two states were indistinguishable until Save failed.

  Approval state is now two signals:

  - **`approvalPending`** — an approval is running. Drives the band and the recall
    button, both meaningful whether or not the record is editable.
  - **`locked`** — that approval also forbids edits, from the pending node's
    `lock_record` (framework#3814, read off the same `node_config_json` snapshot
    the server's record-lock hook reads).

  The band renders two states: amber lock + "Locked for approval", or sky clock +
  "In approval · editable", each with its own tooltip. Recall moved out of the
  locked branch — an editable pending approval is just as recallable. Inline
  editing stays live in the editable state.

  `InlineEditProvider` takes a new optional `approvalPending` prop, defaulting to
  `locked`, so a host that threads only `locked` renders exactly as before. The
  record's `approval_status` field remains the fallback for backends with no
  approvals API; it carries no node granularity, so it still reads as locked — as
  does a pending request from a backend too old to report the policy.

  New `detail.approvalPendingEditable` / `detail.approvalPendingTooltip` keys are
  translated in all ten locales.

- 1767124: feat(grid): compute all eleven spec column summary aggregations (#2890)

  `ColumnSummarySchema` accepts eleven aggregation names; `useColumnSummary` computed
  five. The other six — `none`, `count_empty`, `count_filled`, `count_unique`,
  `percent_empty`, `percent_filled` — passed validation at authoring time and then
  rendered a blank footer cell, with no error raised on either side.

  The computation now splits into two families. Count and percent read _raw_ cell
  values, before the numeric parse, so they work on text, select and lookup columns and
  a value that does not parse as a number still counts as a filled row; a cell is empty
  when it is `null`, `undefined`, `""` or an empty array. `sum`/`avg`/`min`/`max` keep
  the existing numeric parse and column formatting.

  Two behavior changes follow from the enum carrying both `count` and `count_filled`,
  which cannot mean the same thing:

  - `count` is now every row; `count_filled` is the non-empty variant. Only a column
    whose values are all empty renders differently than before.
  - a zero count renders `Empty: 0` instead of collapsing to a blank cell.

  Column currency/percent formatting is gated to the numeric family, so `count_unique`
  on a currency column reads `Unique: 3` and not `$3.00`. `none` and unrecognized names
  skip the entry entirely, so a view whose columns all opt out renders no footer row.

  `ListColumnSchema`'s objectui-local `{ type, field }` arm now takes its vocabulary
  from `SpecColumnSummarySchema` by reference — it was stuck at the same five names,
  which left the per-column `field` override unavailable for the six new aggregations.

  A parity test asserts the renderer's supported set equals the spec enum in both
  directions: a spec name the renderer omits is the bug above, and a renderer name the
  spec omits would be local dialect (Commandment #0).

  **Removed:** `useColumnSummary` from `@object-ui/react`. It was a second, unrelated
  hook of the same name with no callers — a different API, a comment claiming it
  implemented spec v2.0.7, and a `distinct` aggregation that is not in the spec
  vocabulary at all (the spec calls it `count_unique`). Use `useColumnSummary` from
  `@object-ui/plugin-grid`, which implements the spec enum.

- c6cfdf1: feat(react)!: trim the dead device/preference delegates from
  `useClientNotifications` (objectstack#3612 companion)

  `registerDevice`, `getPreferences`, and `updatePreferences` delegated to
  `@objectstack/client` methods that were deleted in objectstack#3612 — the
  `/notifications/devices` and `/notifications/preferences` server routes they
  targeted were never built, so every call already surfaced an error at
  runtime. The hook keeps `fetchNotifications` and `markAsRead` (both
  dispatcher-served and route-ledgered). Breaking only for code destructuring
  the removed functions from the hook result; nothing in this repo did.

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

- 7b35e4b: fix(dashboard,charts): resolve `{current_user_id}` in widget filters (framework #3574)

  A dashboard widget filtered on `{current_user_id}` rendered `0`. The token
  reached SQL as a literal, matched no row, and nothing was logged on the client
  or the server — a silent zero that reads as "you have no work" rather than
  "this filter did not resolve". The same token in a list-view filter resolved
  correctly, so a user-scoped list and a user-scoped widget over the same data
  disagreed.

  There was no shared resolver. Three ad-hoc implementations had grown up
  independently — `ObjectView` for list views, `ObjectDataPage` for URL filter
  triples, `NavigationRenderer` for hrefs — and each understood only the filter
  shape its own surface used. `ObjectView`'s opened with
  `if (!Array.isArray(filter)) return filter`, so it could not have been reused
  by dashboard widgets even in principle: widget filters are MongoDB-style
  objects. Widgets therefore got no resolution at all — `DatasetWidget` called
  `resolveDateMacros` and nothing else, which is why `{today}` worked in a widget
  and `{current_user_id}` silently did not.

  - **`@object-ui/core`** — new `utils/filter-tokens.ts` with
    `resolveContextTokens` and `resolveFilterPlaceholders`. The latter expands
    _every_ placeholder vocabulary in one call and is what surfaces should use;
    resolving only some of them is the whole defect. The walk handles arrays and
    plain objects uniformly, so one resolver covers both platform filter shapes.
  - **`@object-ui/react`** — new `FilterScopeProvider` / `useFilterScope`. The
    renderer packages deliberately do not depend on `@object-ui/auth`, so the
    shell supplies the session values. This is a separate context from
    `PredicateScopeContext`, which is the expression evaluation scope and carries
    no organization.
  - **`@object-ui/plugin-dashboard` / `@object-ui/plugin-charts`** — all six
    widgets that previously resolved date macros only now resolve both
    vocabularies: `DatasetWidget`, `ObjectMetricWidget`, `ObjectDataTable`,
    `ObjectPivotTable`, and `ObjectChart` (dataset-bound and inline paths). The
    chart's `compareTo` comparison filter gets the session pass too — otherwise
    the overlay series silently ignored the owner clause the primary series
    honoured.
  - **`@object-ui/app-shell`** — `ObjectView`'s local `substituteFilterTokens`
    and `ObjectDataPage`'s inline `=== '{current_user_id}'` ternary now delegate
    to the shared resolver, so both also gain `{current_org_id}` and date macros.
    Two of the three ad-hoc implementations are gone rather than joined by a
    fourth.

  An unresolvable token is left intact rather than dropped: leaving it yields an
  empty result, whereas dropping the clause would _widen_ the result set and show
  a signed-out viewer everyone's data. It is no longer silent — the resolver
  warns, naming the token, and suggests the intended spelling for known
  near-misses (`{current_user}`, `{user_id}`, `{organization_id}`). Authoring-time
  enforcement lands separately as `filter-token-unknown` in `@objectstack/lint`.

- Updated dependencies [0b3be01]
- Updated dependencies [3c4d935]
- Updated dependencies [4b60d2d]
- Updated dependencies [952b978]
- Updated dependencies [de5e40c]
- Updated dependencies [1a03af6]
- Updated dependencies [3e886eb]
- Updated dependencies [cfc675e]
- Updated dependencies [20df08c]
- Updated dependencies [1767124]
- Updated dependencies [8ecf5a6]
- Updated dependencies [af705b9]
- Updated dependencies [0502a7c]
- Updated dependencies [7b35e4b]
- Updated dependencies [e16ed2d]
- Updated dependencies [c6fd752]
- Updated dependencies [f9bbddb]
- Updated dependencies [dfd3705]
- Updated dependencies [2735de6]
- Updated dependencies [6dee2cb]
- Updated dependencies [e05f052]
- Updated dependencies [0502a7c]
- Updated dependencies [faad45e]
- Updated dependencies [09c6a17]
- Updated dependencies [c7cff19]
- Updated dependencies [ba73a02]
- Updated dependencies [cd09a7b]
- Updated dependencies [f1abf0e]
- Updated dependencies [f05b84e]
- Updated dependencies [9b4b952]
- Updated dependencies [7d46648]
- Updated dependencies [6e8fd3c]
- Updated dependencies [bb4aa25]
- Updated dependencies [75f1cdf]
- Updated dependencies [662bdf9]
- Updated dependencies [059a052]
- Updated dependencies [53642d4]
- Updated dependencies [8aae006]
- Updated dependencies [d62fb1f]
- Updated dependencies [d147a13]
- Updated dependencies [c6aaed8]
- Updated dependencies [263f885]
- Updated dependencies [dc334da]
  - @object-ui/i18n@17.0.0
  - @object-ui/types@17.0.0
  - @object-ui/data-objectstack@17.0.0
  - @object-ui/core@17.0.0

## 16.1.0

### Minor Changes

- 803558e: feat(data): thread the host's authenticated fetch into `provider: 'api'` data sources (#2725)

  `provider: 'api'` view data sources went through a bare `globalThis.fetch`, so
  custom endpoints (gantt composite trees, report aggregates) carried only
  same-origin cookies while every native `/api/v1/*` request carried
  `Authorization: Bearer` — the moment cookie HMAC verification failed (dev
  restart rotating the fallback auth secret, cookie expiry/rotation in prod)
  those views 401'd while the rest of the app kept working.

  - **`@object-ui/react`** — `SchemaRendererProvider` accepts an optional
    `apiFetch`; nested providers inherit it from their parent so re-wrapped
    subtrees (react pages, preview surfaces) keep the host's authentication.
    `useViewData` defaults the api-provider adapter's fetch to the context
    `apiFetch` (explicit `adapterOptions.fetch` still wins).
  - **`@object-ui/auth`** — `createAuthenticatedFetch` gains a
    `sameOriginOnly` option: cross-origin URLs pass through to the bare fetch
    with no `Authorization` / `X-Tenant-ID` / `Accept-Language`, so metadata-
    supplied third-party URLs never see the platform token.
  - **`@object-ui/app-shell`** — the console wires
    `createAuthenticatedFetch({ sameOriginOnly: true })` (settle-signal wrapped)
    as `apiFetch` on the root `SchemaRendererProvider`.
  - **`@object-ui/plugin-gantt`** — `ObjectGantt` resolves its api-provider
    DataSource with the context `apiFetch`, covering reads and write-backs.

  Behaviour is unchanged for hosts that don't provide `apiFetch` (bare fetch +
  cookies, as before).

- 2e7d7f0: feat(evaluator): route `{ dialect: 'cel' }` component/action predicates to the canonical CEL engine (#2661)

  Component and action `visible` / `disabled` / `hidden` predicates were evaluated
  by the home-grown JS `ExpressionEvaluator`, while field rules
  (`visibleWhen`/`readonlyWhen`/`requiredWhen`, via `fieldRules.ts`) and row/list
  conditionals (via `evalRowPredicate`) already delegate to the canonical
  `@objectstack/formula` engine. That split meant a `{ dialect: 'cel' }` predicate
  in a renderer/action surface was executed as **JavaScript** — CEL-only forms
  (`x in list`, `has()`, typed `==`, the `today()`/`daysFromNow()` catalog) behaved
  differently from, or faulted against, the server's enforcement.

  This converges the remaining tier onto the same engine:

  - **`@object-ui/core`** — `ExpressionEvaluator.evaluateCondition` now detects a
    `{ dialect: 'cel', source }` envelope and evaluates it on `@objectstack/formula`
    (via `evalFieldPredicate`), binding the `record` namespace plus the whole
    context bag as top-level scope (`record.*`, `features.*`, `user.*`, `app.*`).
    Fail-soft to visible/enabled to match the legacy default; `throwOnError`
    callers still fail closed on a _faulting_ predicate (a genuine `false` never
    throws). This fixes every `SchemaRenderer` visibility/disabled read at once.
  - **`@object-ui/react`** — `toPredicateInput` preserves a CEL envelope instead of
    collapsing it to a `${source}` string, and `useCondition` accepts and forwards
    the envelope (keyed on a stable `(dialect, source)` so it doesn't re-evaluate
    each render). Action buttons (`action-icon`/`group`/`bar`/`button`) therefore
    evaluate CEL `visible`/`enabled`/`disabled` on the canonical engine.

  **Back-compat:** bare strings and `${…}` templates stay on the legacy JS path
  (deprecation window); only an explicit `{ dialect: 'cel' }` envelope is rerouted.
  `{ dialect: 'template' }` is unaffected.

  Together with the `^15.1.1` alignment (#2662), a renderer CEL predicate now
  reaches the identical verdict as the server — including the framework's
  `dateField == today()` equality fix (objectstack-ai/objectstack#3205) once it
  lands in a published 15.x. The broader home-grown-vs-canonical divergence
  motivation is #2661.

### Patch Changes

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

- Updated dependencies [0318118]
- Updated dependencies [1c8935a]
- Updated dependencies [af1b0db]
- Updated dependencies [8b8b744]
- Updated dependencies [7cf4051]
- Updated dependencies [8c1e415]
- Updated dependencies [0ea5036]
- Updated dependencies [2e7d7f0]
- Updated dependencies [94d4876]
- Updated dependencies [1100a8b]
- Updated dependencies [7abe4cd]
- Updated dependencies [549c67d]
- Updated dependencies [ebe6494]
- Updated dependencies [2b17339]
- Updated dependencies [31b77d4]
- Updated dependencies [6d4fbe6]
- Updated dependencies [0a3710b]
- Updated dependencies [f80aaf2]
- Updated dependencies [62b9ab5]
- Updated dependencies [1629313]
- Updated dependencies [29c6040]
- Updated dependencies [faebac3]
- Updated dependencies [2331ac9]
- Updated dependencies [199fa83]
- Updated dependencies [eee4ded]
  - @object-ui/i18n@16.1.0
  - @object-ui/core@16.1.0
  - @object-ui/data-objectstack@16.1.0
  - @object-ui/types@16.1.0

## 16.0.0

### Minor Changes

- d3e19ed: Adapt to framework 15.1: (1) ADR-0067 D2 all-or-nothing publishes — `formatPublishFailures` renders a rolled-back batch as ONE banner anchored on the causal item (`batch_aborted` entries are summarized, not listed as parallel errors); PackagesPage says "rolled back because X" instead of "{n} failed"; the AI chat publish toast surfaces the real reason instead of a bare count. Pre-15.1 partial-publish responses keep their per-item rendering. (2) ADR-0076 D12 honest discovery — `DiscoveryServiceStatus` gains `handlerReady` + `degraded`/`stub` statuses, new backward-tolerant `isServiceUsable()` helper (absent fields keep the pre-15.1 default; `stub`/`handlerReady:false` gate off; `degraded` stays usable), consumed by `isAuthEnabled`/`isAiEnabled` and `ConditionalAuthWrapper`.

### Patch Changes

- 59d4fa9: fix(detail): show the "Locked for approval" band on request-tracked backends (objectui#2618)

  The DetailView approval-lock band keyed only off the record's own
  `approval_status` field, so it never rendered on backends that track the lock
  via an open approval request and never materialize that field — even though
  the lock was real (writes rejected with `RECORD_LOCKED`). The record-level
  `InlineEditContext` now carries the host's `locked`/`lockedReason` signal
  (the same dual-source `approvalLocked` that already gates `canEdit` in
  `RecordDetailView`), and the band renders from it while keeping `DetailView`
  DataSource-agnostic. Also backfills the approval-lock strings into the detail
  translation defaults so a bare DetailView shows the label, not the raw i18n key.

- 195a651: refactor(spec-bridge): retire the hand-written `ListViewSpec`/`ListColumn` mirrors in the list-view bridge (#2231 follow-up)

  The SpecBridge's list-view bridge kept a third hand-written copy of the ListView shape
  (after the zod schema and the TS interface unified in the previous #2231 PR). It now
  derives its input type from `@objectstack/spec/ui` (`Partial<ListView>`, spec `ListColumn`),
  so the bridge can no longer drift from the protocol.

  Behavior fix surfaced by the real types: spec `columns` is `string[] | ListColumn[]`, but
  the old local interface only admitted `ListColumn[]` — a bare field-name column would have
  produced a broken `{ accessorKey: undefined }` mapping. String columns now map to a default
  column (`{ accessorKey: field, header: field }`).

- Updated dependencies [210806a]
- Updated dependencies [b4ef588]
- Updated dependencies [ca0f5f0]
- Updated dependencies [5534535]
- Updated dependencies [9b8f978]
  - @object-ui/types@16.0.0
  - @object-ui/i18n@16.0.0
  - @object-ui/core@16.0.0
  - @object-ui/data-objectstack@16.0.0

## 15.0.0

### Patch Changes

- @object-ui/types@15.0.0
- @object-ui/core@15.0.0
- @object-ui/i18n@15.0.0
- @object-ui/data-objectstack@15.0.0

## 14.1.0

### Minor Changes

- 5523fc4: Dashboard-level filters — the three #2578 item-5 enhancements (framework#2501):

  - **react**: nested `PageVariablesProvider`s now MERGE instead of shadowing
    wholesale. A filtered dashboard embedded in a Page with its own `variables`
    keeps the outer page variables readable inside widget subtrees (`page.*`);
    an inner definition shadows only the SAME name; writes route to the scope
    that defines the variable (writing an outer-defined name from inside the
    nested subtree updates the outer provider); `resetVariables` stays local.
    Names defined nowhere still write locally, exactly as before.
  - **core**: `buildWidgetScopedFilter` accepts an optional `knownFields` set —
    a DEFAULT binding whose target field is not on the widget's object is
    skipped with a console warning instead of emitting a query the backend
    empty-matches. Explicit `filterBindings` strings are always honoured (a
    typo surfaces as a visibly empty widget, never a silently dropped filter).
    Omitting `knownFields` preserves the previous unchecked behaviour.
  - **plugin-dashboard**: `DashboardRenderer` feeds `knownFields` from
    `dataSource.getObjectSchema` for inline `object` widgets (best-effort —
    unchecked while metadata loads or when the source can't describe objects).
    `optionsFrom` dynamic filter options now resolve DISTINCT values
    server-side via a dataset GROUP BY (`queryDataset` with an inline draft)
    when the data source supports it, falling back to the previous client-side
    top-200 dedupe otherwise.

- dea65f7: Unify the list-view conditional tier onto the canonical CEL engine (#1584).

  Conditional formatting (list / grid / kanban) and row-action `visible` /
  `disabled` predicates are now evaluated by `@objectstack/formula`'s
  `ExpressionEngine` — the same engine the server uses — instead of the legacy
  JS-dialect `ExpressionEvaluator`, matching how `@objectstack/spec` already types
  these surfaces (`ExpressionInputSchema` / CEL). The whole platform now speaks one
  expression dialect (framework ADR-0058).

  - `@object-ui/core`: new `evalRowPredicate` + `resolveConditionalFormatting`
    helpers (next to `evalFieldPredicate`). One implementation of all three
    formatting rule shapes; dialect routing (a `{ dialect: 'cel' }` envelope is
    always CEL; a bare string is CEL unless it carries legacy-only syntax
    (`${…}` / `===` / `?.` / `.includes()`), which routes to the old engine with a
    one-time deprecation warning); the native `{ field, operator, value }` form is
    translated to CEL.
  - `@object-ui/react`: new `useRowPredicate` hook (canonical CEL, ambient
    predicate scope merged).
  - Consumers converged: `ListView.evaluateConditionalFormatting` (thin wrapper,
    export kept), `ObjectGrid` row styling (inline copy removed), kanban card
    styles, and the grid / data-table row-action menus. `plugin-view`'s kanban
    branch now forwards top-level `conditionalFormatting` (previously dropped).
  - Row-action `visible` fails **closed** (broken predicate → hidden + warn);
    `disabled` fails soft. The CEL `in` operator (and list membership) now work in
    row predicates — the legacy engine could not parse them.
  - The legacy `FormField.condition: { field, equals/notEquals/in }` is retired to
    a CEL translation (back-compat preserved); `FieldDesigner` migrated to
    `visibleWhen`.

  Fully back-compat: existing conditional-formatting rules, row-action predicates,
  and form `condition` metadata keep working (translated / routed as needed).

- 5b52624: feat(detail): record-level inline edit — shared `InlineEditContext` + one atomic Save (objectui#2407 P1)

  Lift the inline-edit session out of `DetailView`'s private state into a
  record-level, shared context so a record page's surfaces can share ONE draft and
  commit it in ONE atomic, cross-field-validated write (replacing the per-field
  save loop).

  - **`InlineEditContext` / `InlineEditProvider` / `useInlineEdit`** (@object-ui/react)
    — pure UI state (`editing`, `canEdit`, `draft`, `autoFocusField`, `saving`,
    `error` + `enter` / `setField` / `cancel` / `reset`). A _separate_ context from
    `RecordContext` (mirrors `HighlightFieldsContext`) so per-keystroke draft churn
    doesn't re-render other `record:*` consumers.
  - **`<InlineEditSaveBar>`** (@object-ui/plugin-detail) — the record-level sticky
    Save/Cancel bar. Commits the whole draft in ONE
    `dataSource.update(obj, id, draft, { ifMatch: data.updated_at })` → `refresh()`;
    a `409 CONCURRENT_UPDATE` reuses `<ConcurrentUpdateDialog>` (reload / overwrite).
    A callback mode (`onFieldSave`) preserves the drawer's per-field persistence
    contract with plugin-gantt/calendar/kanban.
  - **`DetailView`** now consumes `useInlineEdit()` instead of owning inline-edit
    state; its header/inline Save-Cancel bars and per-field batch-save are removed
    (the approval-lock badge stays). Rendered without a provider it is simply
    read-only.
  - **`record:details`** and **`RecordDetailDrawer`** each wrap their `DetailView`
    in an `<InlineEditProvider>` + `<InlineEditSaveBar>`. The object-lifecycle /
    permission gate flows through `canEdit`; computed / readonly / system fields
    and the OCC path are unchanged.

  Guardrails preserved: computed (`formula`/`summary`/`rollup`/`auto_number`) +
  `readonly` + system fields expose no editor; `canEdit` gate; OCC (`ifMatch` +
  `ConcurrentUpdateDialog`); the atomic partial update carries only user-edited
  keys (never computed/read-only). Editable highlights ride on top of this in P2.

- f94905d: remove(react): drop the unused `FormRenderer` / `FieldFactory` duplicate render path (#2545)

  `FormRenderer` (and its captive `FieldFactory`) was an exported-but-dead second
  form render path: zero runtime consumers anywhere in the repo — the only import
  was its own test file. It duplicated `@object-ui/plugin-form`'s `ObjectForm`
  (the path every app actually uses via the component registry) but had drifted
  into a degraded variant: raw-HTML/Tailwind instead of the shared UI primitives,
  a hard-coded Submit button, and no support for `submitBehavior` / `aria` /
  `groups`.

  **Breaking (ships as minor per the pre-1.0 launch-window convention):** the
  public exports `FormRenderer`, `FormRendererProps`, `FieldFactory`,
  `FieldFactoryProps`, and `ExtendedFormField` are removed from
  `@object-ui/react`. Render forms through the `object-form` schema node
  (`@object-ui/plugin-form` `ObjectForm`, reachable from a `FormViewSchema` via
  `SchemaRenderer` / the spec bridge) instead. Closes Phase 4 of #2545.

### Patch Changes

- Updated dependencies [82441e4]
- Updated dependencies [2efa9fd]
- Updated dependencies [0890fa7]
- Updated dependencies [2ded18c]
- Updated dependencies [e628d1f]
- Updated dependencies [5523fc4]
- Updated dependencies [887062c]
- Updated dependencies [23d65c3]
- Updated dependencies [9e2d58f]
- Updated dependencies [dea65f7]
- Updated dependencies [d5b1bc0]
- Updated dependencies [f0f10f5]
  - @object-ui/i18n@14.1.0
  - @object-ui/core@14.1.0
  - @object-ui/types@14.1.0
  - @object-ui/data-objectstack@14.1.0

## 14.0.0

### Minor Changes

- 86c69c3: ADR-0089: read the canonical `visibleWhen` conditional-visibility predicate in the form + page renderers.

  `@objectstack/spec` now unifies conditional visibility under a single canonical key, `visibleWhen`, and folds the deprecated `visibleOn` (view form) / `visibility` (page component) aliases into it at parse. This updates ObjectUI to read the canonical key:

  - **Page renderer** (`SchemaRenderer`) — evaluates `visibleWhen` first (show-when-truthy), then the deprecated `visibleOn` / `visibility` as a defensive read for raw / un-normalized metadata. `visibleWhen` is stripped from DOM props.
  - **Spec→node bridges** — the page bridge maps a component's `visibleWhen ?? visibility` onto the node's canonical `visibleWhen`; the form-view bridge maps a field's `visibleWhen ?? visibleOn` onto the ObjectForm view-level predicate slot.
  - **Form renderers** — the `@object-ui/react` `FormRenderer` prefers `visibleWhen` over the `visibleOn` alias. (`ObjectForm`/`form.tsx` already evaluated `visibleWhen`.)
  - **Types** — the component base schema (`BaseSchema` / `base.zod`) gains the canonical `visibleWhen`; `visibleOn` is marked `@deprecated`.

  Fully back-compat: existing `visibleOn` / `visibility` metadata keeps working through the alias reads.

### Patch Changes

- Updated dependencies [443360a]
- Updated dependencies [c70bca7]
- Updated dependencies [86c69c3]
- Updated dependencies [05e56ca]
- Updated dependencies [5971cc4]
- Updated dependencies [6a74160]
  - @object-ui/core@14.0.0
  - @object-ui/i18n@14.0.0
  - @object-ui/types@14.0.0
  - @object-ui/data-objectstack@14.0.0

## 13.2.0

### Patch Changes

- Updated dependencies [53c40c2]
- Updated dependencies [e492b9d]
  - @object-ui/i18n@13.2.0
  - @object-ui/data-objectstack@13.2.0
  - @object-ui/types@13.2.0
  - @object-ui/core@13.2.0

## 13.1.0

### Patch Changes

- @object-ui/types@13.1.0
- @object-ui/core@13.1.0
- @object-ui/i18n@13.1.0
- @object-ui/data-objectstack@13.1.0

## 13.0.0

### Patch Changes

- Updated dependencies [9e38270]
- Updated dependencies [619097e]
  - @object-ui/i18n@13.0.0
  - @object-ui/types@13.0.0
  - @object-ui/core@13.0.0
  - @object-ui/data-objectstack@13.0.0

## 12.1.0

### Patch Changes

- Updated dependencies [6cbccf3]
- Updated dependencies [e1840bf]
- Updated dependencies [c31874d]
  - @object-ui/i18n@12.1.0
  - @object-ui/types@12.1.0
  - @object-ui/core@12.1.0
  - @object-ui/data-objectstack@12.1.0

## 12.0.0

### Patch Changes

- Updated dependencies [226fde9]
- Updated dependencies [e4de456]
  - @object-ui/types@12.0.0
  - @object-ui/core@12.0.0
  - @object-ui/data-objectstack@12.0.0
  - @object-ui/i18n@12.0.0

## 11.5.0

### Minor Changes

- 6fffd3d: Client-side data-invalidation bus — refresh data, don't rebuild UI (objectui#2269 P1).

  - `@object-ui/react` gains the bus: `notifyDataChanged({objectName, recordId?})`, `useDataInvalidation(objectName, recordId?)` (reader nonce), `subscribeDataChanges`, and `useMutationInvalidationBridge(dataSource)` which fans every dataSource write (`MutationEvent`) onto the bus. The bus also dispatches the legacy `objectui:related-changed` window event, so pre-bus listeners keep working.
  - The `key={refreshKey}` remount of `RecordDetailView` (AppContent) and the `key={actionRefreshKey}` remount of `DetailView` (RecordDetailView) are GONE: record data now refetches in place via the bus — scroll, collapsed sections, tabs and in-progress inline edits survive every save/action/undo. All nine action-success bumps became precisely-scoped `notifyDataChanged` calls; undo/redo use the operation's own `objectName`/`recordId`.
  - `RelatedCountStore` is wired to the bus (tab count badges refetch after any change to their object) and its `useSyncExternalStore` snapshot is now a monotonic version — previously it returned the same `Map` reference, so `emit()` never re-rendered subscribers and invalidations left badges stale; `useRelatedCountVersion()` is exported and drives the probe effect's re-fetch.
  - app-shell also gains the reserved URL-param registry (`urlParams.ts` — `form`/`formObject`/`formLink`/`tab`/`recordId`/`palette`/`shortcuts` constants replace scattered string literals) and AGENTS.md Commandment #8 (UI-state classification: state that must survive a data refresh may never live only in an uncontrolled component).

### Patch Changes

- fae75e2: Fix two bugs verified still-present after #2254 claimed to resolve them (framework#2620 / framework#2616 Showcase UX pass, tracked in #2268):

  - **Wizard/form `submitBehavior: 'thank-you'` allowed duplicate resubmission.** #2254 fixed the spec-bridge dropping `submitBehavior` before it reached the renderer, so the configured toast message started appearing — but `WizardForm`'s last step and `ObjectForm`'s submit handler only ever called `toast.success(...)` for `thank-you`/`next-record`; the form stayed mounted and fully filled with its submit button re-enabled once the request settled, so a second click created a second record. Both components now track a terminal `submitted` state and, when set, replace the form with a confirmation panel (using the behavior's `title`/`message`, which were also never read before) — mirroring the pattern `apps/console/src/components/FormPage.tsx` already used for its own standalone forms.

  - **Command Center-style 3-up chart bands stayed collapsed to ~100-130px, and a dataset-bound chart's measure leaked its raw field name.**
    - `responsiveStyles` (and `style`) were declared on the page-spec `PageComponent` bridge input type but never copied onto the `SchemaNode` in `spec-bridge/bridges/page.ts::mapComponent()` — so a page author's ADR-0065 layout override (e.g. forcing `display: 'grid'` on a `type: 'flex'` band) never reached `SchemaRenderer`, and the node silently fell back to its default flex layout. Both fields are now mapped through.
    - `ObjectChart`'s dataset-bound fetch path (`schema.dataset` + `ds.queryDataset(...)`) discarded the response's `fields` array (which carries each measure's `label`, e.g. `{ name: 'task_count', label: 'Tasks' }`) before it ever reached `buildChartSeries()` — whose `fields` param already resolves this correctly (see `chart-series.test.ts`) — so the legend/tooltip always fell back to the raw field name. The fetched `fields` are now captured and threaded through.

- Updated dependencies [544d8eb]
- Updated dependencies [9255686]
- Updated dependencies [1072701]
  - @object-ui/i18n@11.5.0
  - @object-ui/types@11.5.0
  - @object-ui/data-objectstack@11.5.0
  - @object-ui/core@11.5.0

## 11.4.0

### Patch Changes

- Updated dependencies [8bf6295]
- Updated dependencies [1948c5b]
- Updated dependencies [9cd9be1]
- Updated dependencies [c38d107]
- Updated dependencies [790558b]
- Updated dependencies [c0164ad]
  - @object-ui/types@11.4.0
  - @object-ui/i18n@11.4.0
  - @object-ui/data-objectstack@11.4.0
  - @object-ui/core@11.4.0

## 11.3.0

### Patch Changes

- Updated dependencies [d88c8ec]
- Updated dependencies [d23d6eb]
  - @object-ui/i18n@11.3.0
  - @object-ui/core@11.3.0
  - @object-ui/data-objectstack@11.3.0
  - @object-ui/types@11.3.0

## 11.2.0

### Patch Changes

- Updated dependencies [9e7a986]
- Updated dependencies [1311749]
  - @object-ui/core@11.2.0
  - @object-ui/data-objectstack@11.2.0
  - @object-ui/types@11.2.0
  - @object-ui/i18n@11.2.0

## 11.1.0

### Patch Changes

- Updated dependencies [6726a2b]
  - @object-ui/i18n@11.1.0
  - @object-ui/types@11.1.0
  - @object-ui/core@11.1.0
  - @object-ui/data-objectstack@11.1.0

## 7.3.0

### Patch Changes

- @object-ui/types@7.3.0
- @object-ui/core@7.3.0
- @object-ui/i18n@7.3.0
- @object-ui/data-objectstack@7.3.0

## 7.2.0

### Patch Changes

- Updated dependencies [8e7c1da]
- Updated dependencies [d23db5c]
  - @object-ui/i18n@7.2.0
  - @object-ui/types@7.2.0
  - @object-ui/core@7.2.0
  - @object-ui/data-objectstack@7.2.0

## 7.1.0

### Minor Changes

- a71be60: chore: drop the unrendered `blank` / `record_review` page types and their config

  The `blank` and `record_review` page types have no renderer and were removed
  from `@objectstack/spec`'s `PageTypeSchema` (framework#2265, enforce-or-remove).
  This drops their now-dead references in objectui so the upstream spec can hard-
  remove `BlankPageLayoutSchema` / `RecordReviewConfigSchema`:

  - `PageType` union: removed `dashboard` / `form` / `record_detail` /
    `record_review` / `overview` / `blank` (grid/gallery/kanban/calendar/timeline
    remain — those are list _visualizations_, a separate cleanup).
  - Removed `blankLayout` from `PageLayout` and the `blankLayout` / `recordReview`
    handling in the spec→SDUI page bridge.
  - Removed the redundant `BlankPageLayout{,Schema,Item,ItemSchema}` re-import from
    `@objectstack/spec/ui` (it was never used).

### Patch Changes

- Updated dependencies [677f7ed]
- Updated dependencies [08c47da]
- Updated dependencies [a71be60]
- Updated dependencies [cb03bc3]
  - @object-ui/types@7.1.0
  - @object-ui/core@7.1.0
  - @object-ui/data-objectstack@7.1.0
  - @object-ui/i18n@7.1.0

## 7.0.0

### Minor Changes

- c12986e: Add resultDialog + target interpolation for one-shot action reveals

  Some platform actions return values the user MUST copy now because the
  server will not surface them again — 2FA TOTP URI + backup codes, freshly
  minted OAuth client_secret, regenerated recovery codes. Previously these
  had to ship as bespoke pages in `apps/account` because actions only
  emitted a fire-and-forget toast.

  **`@object-ui/core` — ActionRunner**

  - New `ActionDef.resultDialog: ResultDialogSpec` field. When set on a
    successful action, the runner suppresses the `successMessage` toast and
    awaits the registered `ResultDialogHandler` instead. Missing handler is
    non-fatal (logs a warning); rejected handler is treated as acknowledged.
  - New `setResultDialogHandler(handler)` setter.
  - New types: `ResultDialogSpec`, `ResultDialogFieldSpec`,
    `ResultDialogHandler`.
  - `executeUrl` and `executeAPI` now run `${param.X}` and `${ctx.X}`
    interpolation against `target` before fetching / navigating. Values are
    `encodeURIComponent`'d, missing keys resolve to empty string. `ctx`
    exposes `origin`, `user`, `org`, `recordId` by default; consumers can
    inject more via `context.ctx`.

  **`@object-ui/react`**

  - `ActionProvider` and `useActionRunner` both gained an `onResultDialog`
    option that wires straight through to the runner.

  **`@object-ui/app-shell`**

  - New `ActionResultDialog` component — promise-based, blocks click-outside
    and Escape (the user MUST click acknowledge), renders five field
    formats: `qrcode` (client-side via the `qrcode` package — never sent
    off-device, so 2FA URIs stay secret), `code-list`, `secret`, `text`,
    `json`. Falls back to `json` when a value's shape doesn't match its
    declared format.
  - `ObjectView` and `RecordDetailView` install the handler and mount the
    dialog automatically, so any action with `resultDialog` declared in
    metadata now works without code changes.
  - New dependency: `qrcode@^1.5.x` for client-side QR rendering.

  Pairs with the framework-side `Action.resultDialog` schema added in
  `@objectstack/spec` and the `sys_two_factor` / `sys_oauth_application` /
  `sys_account` updates in `@objectstack/platform-objects`.

### Patch Changes

- 6cfa330: feat(dashboard): drill "Open in list" escape hatch + unify report drill

  Adopts the mainstream BI peek-then-escalate drill model. Drill-through opens an
  in-place drawer (keep context) and offers an "Open in list →" affordance to
  escalate to the object's full list page (sort / bulk-select / export / shareable
  URL) — the Looker / Power BI "see records → open in page" pattern.

  - New `DrillNavigationContext` (`@object-ui/react`): the app shell provides
    `openRecordList`; the renderer stays decoupled from console routing.
  - The drill drawers (pivot / dataset / chart / KPI) render the escape hatch when
    a host navigation handler is present, and hide it otherwise (self-contained
    peek). `DashboardView` provides the handler via `useOpenRecordList`.
  - `DrillDownConfig.target` gains `'navigate'` — skip the drawer and open the
    list directly; degrades to `'drawer'` when no host handler is available.
  - `ReportView` drill-through now opens the same in-place drawer (peek records →
    click a row to open a record) instead of navigating away; the escape hatch
    preserves the previous navigate-to-list behavior. Dashboard and report drill
    are now unified.
  - i18n: `dashboard.openInList` (en / zh).

- e95cc25: Fix the NavigationSyncEffect baseline race: lazily-loaded `page`/`dashboard` metadata (and the empty cache during `invalidate()` refetch) could seed a partial diff baseline, making platform `sys_` pages look "user added" — the effect then wrote them into every app's navigation, 403ing on ADR-0010 locked apps (red "Failed to update navigation" toasts) and polluting writable apps. The effect now diffs only while both types are `status === 'ready'` (new optional `MetadataContextValue.getTypeStatus`), never treats `sys_`-prefixed artifacts as user creations, and skips apps whose `_lock`/`protection.lock` is `full`/`no-overlay`.
- abe8ebc: Repoint `useClientNotifications` to the ADR-0030 `@objectstack/client` surface

  The `useClientNotifications` bridge hook called `client.notifications.*` with
  signatures that no longer exist on `@objectstack/client@7.x`:

  - `registerDevice(token, platform)` → the SDK takes a single
    `RegisterDeviceRequest` object (`{ token, platform }`).
  - `markAsRead(id)` → there is no single-id method; the SDK exposes
    `markRead(ids: string[])`. The hook keeps its friendly single-id API and
    adapts to the batch call.

  These helpers are the stable transport contract for ADR-0030 (Notification
  Convergence): server-side they route to the L5 `sys_inbox_message`
  materialization and the `sys_notification_receipt` read-state spine — the
  re-modeled `sys_notification` L2 event no longer carries recipient/read
  columns. (The Console bell itself reads the inbox + receipts directly via the
  generic data API; see the `@object-ui/app-shell` bell cut-over.)

  ## Cut-over sequence (operational — run in this order)

  The Console UI repoint must land together with the framework pipeline **and**
  the data migration so the bell is never blank and read-state is never lost:

  1. Deploy the framework ADR-0030 change (objects + `emit()` + producers). New
     notifications now land in `sys_inbox_message` + `sys_notification_receipt`.
  2. Run the data migration **once** to carry existing notifications across —
     `migrateSysNotificationToEvent({ driver, data })` from
     `@objectstack/metadata/migrations`. It splits each legacy `sys_notification`
     inbox row into a `sys_inbox_message` + receipt, rewrites the row to the event
     shape, and clears the legacy columns. It is **idempotent** and reports
     `not_applicable` on fresh installs. This runs against the ObjectStack
     **server/data engine** — it is not a Console (frontend) step.
  3. Deploy the objectui repoint (this change + the `@object-ui/app-shell` bell
     cut-over).

- 2270239: feat: scoped style-object rendering (ADR-0065)

  A metadata node may carry `responsiveStyles` (per-breakpoint CSS-property maps);
  `SchemaRenderer` compiles it to **id-scoped CSS** injected as a `<style>` tag and
  appends a scope class to the node. Build-independent (arbitrary values + design
  tokens pass through verbatim — no Tailwind JIT), collision-free (per-node scope,
  unlayered so it beats base utilities), responsive-correct (model breakpoint maps
  → generated `@media`, never `md:` variant classes). Adds `compileScopedStyles`/
  `scopeClassFor`/`hasResponsiveStyles` to `@object-ui/core` and an SDUI design-token
  palette (`--space-*`, `--surface`, `--brand`, …) to the theme. Mirrors Builder.io.

- Updated dependencies [5976ba3]
- Updated dependencies [eaccefd]
- Updated dependencies [f7f325d]
- Updated dependencies [c12986e]
- Updated dependencies [71d7ce0]
- Updated dependencies [30ee761]
- Updated dependencies [053c948]
- Updated dependencies [b99d9bd]
- Updated dependencies [053c948]
- Updated dependencies [89e113c]
- Updated dependencies [ddbe4a2]
- Updated dependencies [2d47e94]
- Updated dependencies [9049bbe]
- Updated dependencies [77cc6bb]
- Updated dependencies [97c6831]
- Updated dependencies [cb2fdb1]
- Updated dependencies [a58c6b8]
- Updated dependencies [c3749eb]
- Updated dependencies [c09f44e]
- Updated dependencies [6cfa330]
- Updated dependencies [ad8ade6]
- Updated dependencies [d54346c]
- Updated dependencies [5332639]
- Updated dependencies [3870c20]
- Updated dependencies [b88c560]
- Updated dependencies [0ad72a6]
- Updated dependencies [3fa23a7]
- Updated dependencies [18d0339]
- Updated dependencies [59b6bbb]
- Updated dependencies [d16566f]
- Updated dependencies [1394e34]
- Updated dependencies [300d755]
- Updated dependencies [bd8b054]
- Updated dependencies [4eb9cb6]
- Updated dependencies [7c239fd]
- Updated dependencies [858ad94]
- Updated dependencies [2270239]
- Updated dependencies [2f31406]
- Updated dependencies [8d1195d]
  - @object-ui/core@7.0.0
  - @object-ui/data-objectstack@7.0.0
  - @object-ui/i18n@7.0.0
  - @object-ui/types@7.0.0

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3
- @object-ui/core@6.2.3
- @object-ui/i18n@6.2.3
- @object-ui/data-objectstack@6.2.3

## 6.2.2

### Patch Changes

- a66f788: fix(react): preserve `data-obj-schema-invalid` flag across re-renders

  `SchemaRenderer` runs a post-mount `forceUpdate` to pick up lazy plugin
  registrations. The dev-mode validator was deduping via a `WeakSet` that
  always returned `valid: true` on the second call, which stripped the
  `data-obj-schema-invalid` attribute on the immediate re-render. The
  result and the "warn-once" tracking are now stored separately: a
  `WeakMap` caches the validation outcome (so the visual flag is stable),
  while a `WeakSet` continues to dedupe `console.warn` output.

  - @object-ui/types@6.2.2
  - @object-ui/core@6.2.2
  - @object-ui/i18n@6.2.2
  - @object-ui/data-objectstack@6.2.2

## 6.2.1

### Patch Changes

- @object-ui/types@6.2.1
- @object-ui/core@6.2.1
- @object-ui/i18n@6.2.1
- @object-ui/data-objectstack@6.2.1

## 6.2.0

### Patch Changes

- Updated dependencies [fe3c1d3]
- Updated dependencies [ec8dcde]
  - @object-ui/data-objectstack@6.2.0
  - @object-ui/types@6.2.0
  - @object-ui/core@6.2.0
  - @object-ui/i18n@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/core@6.1.0
  - @object-ui/types@6.1.0
  - @object-ui/data-objectstack@6.1.0
  - @object-ui/i18n@6.1.0

## 6.0.4

### Patch Changes

- @object-ui/types@6.0.4
- @object-ui/core@6.0.4
- @object-ui/i18n@6.0.4
- @object-ui/data-objectstack@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3
- @object-ui/core@6.0.3
- @object-ui/i18n@6.0.3
- @object-ui/data-objectstack@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2
- @object-ui/core@6.0.2
- @object-ui/i18n@6.0.2
- @object-ui/data-objectstack@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1
- @object-ui/core@6.0.1
- @object-ui/i18n@6.0.1
- @object-ui/data-objectstack@6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0
- @object-ui/core@6.0.0
- @object-ui/i18n@6.0.0
- @object-ui/data-objectstack@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2
- @object-ui/core@5.4.2
- @object-ui/i18n@5.4.2
- @object-ui/data-objectstack@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1
- @object-ui/core@5.4.1
- @object-ui/i18n@5.4.1
- @object-ui/data-objectstack@5.4.1

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0
  - @object-ui/core@5.4.0
  - @object-ui/data-objectstack@5.4.0
  - @object-ui/i18n@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2
- @object-ui/core@5.3.2
- @object-ui/i18n@5.3.2
- @object-ui/data-objectstack@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1
- @object-ui/core@5.3.1
- @object-ui/i18n@5.3.1
- @object-ui/data-objectstack@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0
- @object-ui/core@5.3.0
- @object-ui/i18n@5.3.0
- @object-ui/data-objectstack@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1
- @object-ui/core@5.2.1
- @object-ui/i18n@5.2.1
- @object-ui/data-objectstack@5.2.1

## 5.2.0

### Minor Changes

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

- aa063db: `useRecordSearch` now orders hits by relevance instead of object-fanout
  order. Tiers (higher wins):

  - 110: exact recordId paste
  - 100: display exactly equals the query
  - 80: display starts with the query
  - 60: any token in display starts with the query
  - 40: display contains the query as a substring

  This makes `⌘K → "Ada"` rank "Ada Lovelace" above "AdvancedTradingAccount"
  even though Account is queried before Contact in the fanout.

  `RecordSearchHit` gains a `score` field for callers that want to render
  hint chips, filter low-confidence rows, or further customize ordering.

- 7c7400a: feat(react): dev-mode schema validation in SchemaRenderer

  `SchemaRenderer` now runs the canonical `validateSchema` from
  `@object-ui/core` on every schema object it renders (deduped per-object
  via a WeakSet so re-renders don't re-log). Errors are surfaced via a
  single grouped `console.warn` that includes the offending JSON path,
  and the host element receives `data-obj-schema-invalid="true"` so apps
  can hook a visual cue (e.g. red outline) via CSS.

  The entire pass is gated on `process.env.NODE_ENV !== 'production'`
  and is a no-op in production builds — zero runtime cost shipped to
  users.

### Patch Changes

- Updated dependencies [de0c5e6]
- Updated dependencies [9997cae]
- Updated dependencies [321294c]
- Updated dependencies [b2d1704]
- Updated dependencies [0a644f0]
- Updated dependencies [a3cb88f]
- Updated dependencies [5425608]
- Updated dependencies [e919433]
- Updated dependencies [70b5570]
- Updated dependencies [d9c3bae]
- Updated dependencies [d1442e3]
  - @object-ui/types@5.2.0
  - @object-ui/data-objectstack@5.2.0
  - @object-ui/core@5.2.0
  - @object-ui/i18n@5.2.0

## 5.1.1

### Patch Changes

- @object-ui/types@5.1.1
- @object-ui/core@5.1.1
- @object-ui/i18n@5.1.1
- @object-ui/data-objectstack@5.1.1

## 5.1.0

### Patch Changes

- bd8447d: Three platform-wide detail polish items.

  **Tighter page rhythm**

  - Outer `PageRenderer` padding `p-4 md:p-6 lg:p-8` → `p-3 md:p-4 lg:p-6`
    and outer body wrap `space-y-8` → `space-y-6` so list / detail / home
    pages share the same edge rhythm. Cuts ~16px of edge slack on lg.

  **Highlights KPI treatment**

  - `HeaderHighlight` now renders numeric / currency / percent / decimal
    values as KPI numbers (`text-xl md:text-2xl font-semibold tabular-nums`)
    instead of the uniform `text-sm font-semibold`, so amount / probability
    / count fields read as headline stats — Salesforce-style key facts.

  **Discussion footer upgrade**

  - `RecordActivityTimeline` now uses `RichTextCommentInput` (bold / italic /
    list / code, `@`-mention autocomplete, preview toggle, Send) instead of
    a bare `<textarea>`.
  - `DiscussionContext` gains an optional `mentionSuggestions` array that
    hosts can wire (e.g. team member directory). Falls back to free-text
    `@mention` when omitted.
  - `RecordChatterPanel` threads `mentionSuggestions` through both inline
    and sidebar positions.

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

- Updated dependencies [1976691]
- Updated dependencies [cf30cc2]
- Updated dependencies [5b80cfd]
- Updated dependencies [49b1760]
- Updated dependencies [c0b236f]
  - @object-ui/i18n@5.1.0
  - @object-ui/types@5.1.0
  - @object-ui/core@5.1.0
  - @object-ui/data-objectstack@5.1.0

## 5.0.2

### Patch Changes

- Updated dependencies [cab6a93]
  - @object-ui/i18n@5.0.2
  - @object-ui/types@5.0.2
  - @object-ui/core@5.0.2
  - @object-ui/data-objectstack@5.0.2

## 5.0.1

### Patch Changes

- @object-ui/types@5.0.1
- @object-ui/core@5.0.1
- @object-ui/i18n@5.0.1
- @object-ui/data-objectstack@5.0.1

## 5.0.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [8930b15]
- Updated dependencies [7213027]
- Updated dependencies [c7561a7]
  - @object-ui/i18n@5.0.0
  - @object-ui/types@5.0.0
  - @object-ui/data-objectstack@5.0.0
  - @object-ui/core@5.0.0

## 4.8.0

### Patch Changes

- @object-ui/types@4.8.0
- @object-ui/core@4.8.0
- @object-ui/i18n@4.8.0
- @object-ui/data-objectstack@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0
- @object-ui/core@4.7.0
- @object-ui/i18n@4.7.0
- @object-ui/data-objectstack@4.7.0

## 4.6.0

### Patch Changes

- @object-ui/types@4.6.0
- @object-ui/core@4.6.0
- @object-ui/i18n@4.6.0
- @object-ui/data-objectstack@4.6.0

## 4.5.0

### Patch Changes

- Updated dependencies [ab5e281]
- Updated dependencies [22fa558]
  - @object-ui/types@4.5.0
  - @object-ui/i18n@4.5.0
  - @object-ui/core@4.5.0
  - @object-ui/data-objectstack@4.5.0

## 4.4.0

### Patch Changes

- @object-ui/types@4.4.0
- @object-ui/core@4.4.0
- @object-ui/i18n@4.4.0
- @object-ui/data-objectstack@4.4.0

## 4.3.1

### Patch Changes

- Updated dependencies [5f4ac6e]
  - @object-ui/i18n@4.3.1
  - @object-ui/types@4.3.1
  - @object-ui/core@4.3.1
  - @object-ui/data-objectstack@4.3.1

## 4.3.0

### Patch Changes

- Updated dependencies [f196cf4]
- Updated dependencies [ee1cc96]
- Updated dependencies [0b032be]
- Updated dependencies [115d36a]
- Updated dependencies [4e7bc1b]
- Updated dependencies [8442c05]
  - @object-ui/i18n@4.3.0
  - @object-ui/types@4.3.0
  - @object-ui/core@4.3.0
  - @object-ui/data-objectstack@4.3.0

## 4.2.1

### Patch Changes

- @object-ui/types@4.2.1
- @object-ui/core@4.2.1
- @object-ui/i18n@4.2.1
- @object-ui/data-objectstack@4.2.1

## 4.2.0

### Patch Changes

- Updated dependencies [eb738bd]
- Updated dependencies [650392e]
- Updated dependencies [84b4bf1]
  - @object-ui/i18n@4.2.0
  - @object-ui/types@4.2.0
  - @object-ui/core@4.2.0
  - @object-ui/data-objectstack@4.2.0

## 4.1.0

### Patch Changes

- @object-ui/types@4.1.0
- @object-ui/core@4.1.0
- @object-ui/i18n@4.1.0
- @object-ui/data-objectstack@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12
- @object-ui/core@4.0.12
- @object-ui/i18n@4.0.12
- @object-ui/data-objectstack@4.0.12

## 4.0.11

### Patch Changes

- Updated dependencies [1909bc3]
  - @object-ui/i18n@4.0.11
  - @object-ui/types@4.0.11
  - @object-ui/core@4.0.11
  - @object-ui/data-objectstack@4.0.11

## 4.0.10

### Patch Changes

- @object-ui/types@4.0.10
- @object-ui/core@4.0.10
- @object-ui/i18n@4.0.10
- @object-ui/data-objectstack@4.0.10

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9
- @object-ui/core@4.0.9
- @object-ui/i18n@4.0.9
- @object-ui/data-objectstack@4.0.9

## 4.0.8

### Patch Changes

- Updated dependencies [3d58eaa]
  - @object-ui/i18n@4.0.8
  - @object-ui/types@4.0.8
  - @object-ui/core@4.0.8
  - @object-ui/data-objectstack@4.0.8

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

- Updated dependencies [7c9b85c]
- Updated dependencies [fd15918]
  - @object-ui/core@4.0.7
  - @object-ui/i18n@4.0.7
  - @object-ui/data-objectstack@4.0.7
  - @object-ui/types@4.0.7

## 4.0.6

### Patch Changes

- @object-ui/types@4.0.6
- @object-ui/core@4.0.6
- @object-ui/i18n@4.0.6
- @object-ui/data-objectstack@4.0.6

## 4.0.5

### Patch Changes

- @object-ui/types@4.0.5
- @object-ui/core@4.0.5
- @object-ui/i18n@4.0.5
- @object-ui/data-objectstack@4.0.5

## 4.0.4

### Patch Changes

- @object-ui/types@4.0.4
- @object-ui/core@4.0.4
- @object-ui/i18n@4.0.4
- @object-ui/data-objectstack@4.0.4

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
  - @object-ui/data-objectstack@4.0.3

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1
- @object-ui/core@4.0.1
- @object-ui/i18n@4.0.1
- @object-ui/data-objectstack@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0
  - @object-ui/core@4.0.0
  - @object-ui/data-objectstack@4.0.0
  - @object-ui/i18n@4.0.0

## 3.4.0

### Patch Changes

- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
  - @object-ui/types@3.4.0
  - @object-ui/core@3.4.0
  - @object-ui/data-objectstack@3.4.0
  - @object-ui/i18n@3.4.0

## 3.3.2

### Patch Changes

- @object-ui/types@3.3.2
- @object-ui/core@3.3.2
- @object-ui/i18n@3.3.2
- @object-ui/data-objectstack@3.3.2

## 3.3.1

### Patch Changes

- @object-ui/types@3.3.1
- @object-ui/core@3.3.1
- @object-ui/i18n@3.3.1
- @object-ui/data-objectstack@3.3.1

## 3.3.0

### Patch Changes

- @object-ui/types@3.3.0
- @object-ui/core@3.3.0
- @object-ui/i18n@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0
- @object-ui/core@3.2.0
- @object-ui/i18n@3.2.0

## 3.1.5

### Patch Changes

- Updated dependencies [cfe0596]
  - @object-ui/i18n@3.1.5
  - @object-ui/types@3.1.5
  - @object-ui/core@3.1.5

## 3.1.4

### Patch Changes

- @object-ui/types@3.1.4
- @object-ui/core@3.1.4
- @object-ui/i18n@3.1.4

## 3.1.3

### Patch Changes

- @object-ui/types@3.1.3
- @object-ui/core@3.1.3
- @object-ui/i18n@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2
- @object-ui/core@3.1.2
- @object-ui/i18n@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1
  - @object-ui/core@3.1.1
  - @object-ui/i18n@3.1.1

## 3.0.3

### Patch Changes

- @object-ui/types@3.0.3
- @object-ui/core@3.0.3
- @object-ui/i18n@3.0.3

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2
- @object-ui/core@3.0.2
- @object-ui/i18n@3.0.2

## 3.0.1

### Patch Changes

- adf2cc0: Patch release for bug fixes and improvements
  - @object-ui/types@3.0.1
  - @object-ui/core@3.0.1
  - @object-ui/i18n@3.0.1

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
  - @object-ui/i18n@3.0.0

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

### Patch Changes

- Updated dependencies [b859617]
  - @object-ui/types@2.0.0
  - @object-ui/core@2.0.0
  - @object-ui/i18n@2.0.0

## 0.3.1

### Patch Changes

- Maintenance release - Documentation and build improvements
- Updated dependencies
  - @object-ui/core@0.3.1

## 0.3.0

### Minor Changes

- Unified version across all packages to 0.3.0 for consistent versioning

## 0.2.2

### Patch Changes

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

- Updated dependencies
  - @object-ui/core@0.2.2

## 0.2.1

### Patch Changes

- Patch release: Add automated changeset workflow and CI/CD improvements

  This release includes infrastructure improvements:

  - Added changeset-based version management
  - Enhanced CI/CD workflows with GitHub Actions
  - Improved documentation for contributing and releasing

- Updated dependencies
  - @object-ui/core@0.2.1

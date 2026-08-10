# @object-ui/plugin-grid

## 17.4.0

### Patch Changes

- 18c42c6: `BulkActionDialog` required params: the control now announces the required state, and the visual `*` stays out of its accessible name

  `ParamField` renders each bulk param's label with a `*` marker when
  `param.required`, inside a `<Label htmlFor>` that points at the control. Two
  conventions the app-shell `ActionParamDialog` has carried since objectui#3299 /
  objectui#3290 were missing at this site:

  - The `*` span had no `aria-hidden="true"`. Accname folds a referencing label's
    text into the control's name, so every required bulk param announced as
    "Notify owner asterisk" — a decorative glyph read aloud as part of the label.
  - No `aria-required` was passed to the widget. `param.required` is otherwise
    live — the dialog's own pre-submit gate reads it to keep Next disabled — but
    nothing carried the state to the control, and no widget derives it from
    `field.required` (`toDomProps` forwards `aria-*` by prefix; it invents
    nothing). So the only channel that could announce requiredness was empty
    while the only thing present was the glyph.

  The required state now rides the state channel to the control, deliberately as
  `aria-required` and not the native `required` attribute — per the objectui#3290
  ruling, the native attribute would arm the browser's constraint-validation
  bubble alongside this dialog's own gating, giving one field two validators.
  `|| undefined` keeps an optional param free of the attribute entirely rather
  than carrying `aria-required="false"`, matching `ActionParamDialog`.

  The marker remains visible; only its participation in the accessible name
  changes. `id` ownership at this site was already correct and is untouched, as
  is `ActionParamDialog`.

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

- 9154d9e: `object-grid` publishes the filter key it actually reads: `filter`, singular (objectui#4041)

  The registration declared plural `filters` while `ObjectGrid` reads singular
  `schema.filter`, and `schema.filters` had **zero** read points anywhere in the
  renderer. Both halves of that mismatch were silent, in opposite directions:

  - An author following the published vocabulary wrote `filters: [...]`. The save
    gate accepted it — `sdui-parser/src/validate.ts` walks a node's props against
    the block's `inputs`, and `filters` was there — the renderer never read it, and
    the grid answered with **the whole table**. No error at authoring time, none at
    runtime, and a wider answer is not visibly wrong.
  - The spelling that actually worked, `filter`, was undeclared, so writing it was
    reported as `unknown-prop`.

  Published word and runtime read pointed at opposite keys, on a shipped authoring
  surface. `list-view` — the sibling block, same family — has always declared the
  singular and read the singular.

  **The plural is removed, not taught to the renderer** (maintainer ruling
  2026-08-10, option A). It has no read point on any ref, so no working grid can
  depend on it: this deletes a key with no users rather than a contract. Teaching
  the renderer to read `filters` too was the rejected alternative — it would have
  hardened a misspelling into a second de-facto contract for the same concept.

  `patch` rather than `minor`/`major` on that same fact. The removed key never
  reached the query on any released version, so nothing that worked stops working;
  what changes is that a filter written under the published name now takes effect.

  **The read point now lowers through `toFilterNode`**, which is what makes the
  newly-reachable key honest rather than merely reachable. Until now the only value
  that could arrive at `schema.filter` was an ObjectQL AST synthesized by
  `ElementDataSourceGate`, and copying that onto `$filter` verbatim was correct. An
  author writes the spec's view vocabulary instead — `ViewFilterRule[]`,
  `[{ field, operator, value }]` — and that shape byte-copied onto `$filter` is
  refused on the wire: `isFilterAST` is false for an array of objects and the data
  API answers `400 INVALID_FILTER` (measured against a real backend in
  objectui#3431). Declaring the key without this hop would have traded a silent
  wrong answer for a guaranteed failure, which is not a fix. `toFilterNode` is the
  repo's single lowering hop before the wire and every other consumer on this chain
  already went through it — `plugin-list`'s `buildEffectiveFilter`, `plugin-view`'s
  `ObjectView`, `plugin-detail`'s `RelatedList`; this read point was the last one
  that did not.

  Two behaviour changes ride along at that read point, both narrow and both toward
  the shared sink's documented contract: a MongoDB-style object `filter` is now
  converted instead of silently dropped (the old `Array.isArray` guard read false
  for it, and the grid returned every record — the same defect `buildEffectiveFilter`
  fixed one package over), and a declared-but-empty `filter: []` now skips `$filter`
  rather than sending an empty one. The fetch and the server-side export read the
  same lowered value, so the downloaded file cannot disagree with the screen.

- 97b63d7: Row actions declaring `visible: false` are now hidden instead of rendered

  A custom row action's visibility **gate** was detected by truthiness, so
  `visible: false` — the most explicit way an author can say "never show this" —
  fell into the "no gate declared" branch and the action rendered for every row.
  Both surfaces of the ObjectGrid row cell (the "⋮" overflow item and the inline
  `variant:'primary'` button) and the data-table's row overflow menu read the same
  gate, so all three rendered it; the `#3562` emptiness guard counts with that same
  gate, so a row whose only action was `visible: false` also grew a "⋮" it could
  not fill.

  The gate now detects a **declared** gate by `!= null && !== ''` and lets the
  declaration itself decide — a boolean short-circuits to its own verdict rather
  than being handed to the CEL engine. This is the invariant objectui#3492 already
  established for the selection bar, whose `hasVisibilityGate` spells out why
  truthiness cannot answer the question, and the same `!= null` posture the
  built-in `visibleWhen` gate has always had. `visible: true` still renders,
  `''` and an absent `visible` are still no gate at all, and no expression-valued
  `visible` changes verdict.

  Behaviour change surface, deliberately narrow: only an action whose `visible` is
  the literal boolean `false` (or another falsy non-empty value) changes — it goes
  from rendered to hidden, which is what the declaration asked for.
  `ActionSchema.visible` is `ExpressionInputSchema` with no boolean member, so
  `objectstack build` cannot emit this shape; hand-written view JSON and
  in-process callers constructing defs can, and did. The three row surfaces now
  reach the same verdict as the selection bar and the record page header for every
  non-expression shape, which `predicate-surface-parity` pins.

- 14c59c0: Grid row actions: the inline button budget is now spent on the primaries that actually render

  `RowActionMenu` allocated its inline slots on the **declared** row actions, before
  any `visible` predicate ran:

  ```ts
  const primaryDefs = gatedActionDefs.filter((d) => d.variant === "primary");
  const inlineDefs = primaryDefs.slice(0, Math.max(0, maxInlineActions));
  ```

  So on a row where the _leading_ `variant: 'primary'` action was suppressed by its
  own `visible`, that action still held the slot — `RowActionInlineButton` returned
  `null` into it — while the next primary, the one that _did_ survive the row's
  predicates, had already been sliced into the overflow list. The row then rendered
  **no inline button and a "⋮" hiding its main CTA**, even though exactly one primary
  was visible and `maxInlineActions` (default 1) allowed exactly one inline button.

  Slot allocation now happens inside `planRowActionMenu`, after visibility, so the
  budget is only ever spent on a primary that renders. `maxInlineActions` is
  unchanged in meaning and default — it is a width budget for real buttons, and
  counting an invisible action against it protected no layout.

  Behaviour change surface, deliberately narrow:

  - a row with 2 or more primaries where a _leading_ one is suppressed for that row —
    the surviving primary moves from the "⋮" menu to an inline button, and the "⋮"
    disappears if nothing else is left to fold;
  - unchanged: how many primaries may go inline, the menu order (folded primaries
    above secondaries), which items render at all, the ADR-0066 D4 capability gate
    (still applied once to the declared set, upstream of this decision), and the
    #3562 empty-menu guard — a row with nothing renderable still grows no trigger.

  Rows whose primaries are all ungated (the `sys_environment` Open + Upgrade Plan
  shape that motivated `maxInlineActions`) are bit-for-bit unaffected: declared order
  and surviving order coincide.

- aeb8424: List row Edit/Delete, bulk delete and related-list CRUD now run the caller's own permission, not just the object's API exposure (objectui#4096)

  The row kebab's built-in Edit/Delete rendered for every account, including ones
  the server answers `403 PERMISSION_DENIED` on. Clicking Edit opened a fully
  prefilled dialog that could only fail on save; Delete — a destructive entry —
  sat one click away from users who could never perform it.

  The gate intersected the object's resolved CRUD affordance with the server's
  effective API operation set (`/me/permissions` `apiOperations`, objectui#3720),
  and nothing else. `apiOperations` is the object's **API exposure surface** —
  "which verbs does this object publish" — and the spec's own describe text says
  so. It is principal-independent: the report measured two accounts with opposite
  `allowEdit`, 30 shared objects, and **30/30 identical** `apiOperations`. A gate
  made only of object-scoped layers therefore fails OPEN for every unprivileged
  caller, which is why the same screen carried three different answers to "may
  this user write this object": the toolbar's New was correctly hidden
  (`affordances.create && can(obj, 'create')`), the record header's Edit/Delete
  were correctly hidden (per-record write probe), and the row kebab was not.

  Four surfaces now AND the principal's own verdict — `can(obj, 'update' |
'delete')`, i.e. `/me/permissions` `allowEdit` / `allowDelete`, the toolbar's
  source — on top of the layers they already had:

  - the grid row kebab's built-in Edit/Delete (`resolveRowCrudAffordances` gained
    `permissionUpdate` / `permissionDelete`, filled at the `ObjectGrid` call site);
  - the grid's bulk-delete bar, which rides the same object-level delete verdict,
    so the row gate and the more destructive bulk entry move together;
  - the non-grid (kanban / calendar / gallery) bulk bar `ListView` renders itself;
  - the related-list Create/Edit/Delete on a child object
    (`RelatedRecordActionsBridge`), which had the same object-only gate.

  **This is a tightening of the intersection, not a swap.** Every existing layer
  stays: the ADR-0103 lifecycle bucket, `userActions.edit` / `delete`, and
  `apiOperations`. A permission grant cannot re-open what any of them closed, and
  none of them survives a permission denial.

  Fail-open is preserved where it is the deliberate contract: `usePermissions()`
  with no `PermissionProvider` answers `can: () => true`, so standalone embeds and
  hosts that ship no permission source keep their Edit/Delete exactly as before.
  Under `MePermissionsProvider` the semantics are the toolbar's, unchanged and now
  shared: an authenticated principal whose object is absent from
  `/me/permissions.objects` resolves fail-closed (objectui#2926 ④), an anonymous
  session keeps the permissive default, and children never render while the
  permission set is loading. Per-key absence is still permissive — an object entry
  without `allowEdit` reads as allowed.

  Server-side enforcement was already hard (403, DB unchanged), so this closes a
  UI-affordance gap rather than an authorization hole.

- 1a33b1a: fix(plugin-grid): don't render a row "⋮" trigger that opens an empty menu

  The object list's row overflow trigger was gated on whether row-action
  **handlers** were wired and how many actions were **declared**
  (`(canEdit && onEdit) || (canDelete && onDelete) || menuDefs.length > 0 || rowActions.length > 0`),
  while the menu's items were filtered a second time — per item, per record —
  against `visibleWhen` / `visible`. On a row where every item was
  predicate-suppressed the trigger still rendered and opened an empty box, which
  reads as a broken page: a platform object whose row actions are gated for one
  role showed a "⋮" on every row for everyone else, with nothing inside it.

  The trigger is now decided by the items that will actually render for that row,
  resolved through the same visibility functions the items gate themselves on, so
  the two cannot disagree. The decision is per row: within one grid a row that
  keeps an action keeps its trigger while a row with nothing left renders none. The
  inline `variant: 'primary'` button reads that same shared rule. The actions
  column is table-level and unchanged, so a row with nothing to offer renders an
  empty cell and every row keeps the same cell count.

  Which items render is untouched — only whether the trigger renders when none of
  them survive.

- Updated dependencies [794c497]
- Updated dependencies [993336f]
- Updated dependencies [f0a625a]
- Updated dependencies [b5980f4]
- Updated dependencies [8aad9fd]
- Updated dependencies [6719877]
- Updated dependencies [56ff091]
- Updated dependencies [0186cdc]
- Updated dependencies [7864f03]
- Updated dependencies [ea41a59]
- Updated dependencies [0cbdca8]
- Updated dependencies [d229dfa]
- Updated dependencies [ecae400]
- Updated dependencies [4bc6c23]
- Updated dependencies [d3e738a]
- Updated dependencies [c3b01a7]
- Updated dependencies [f5f8744]
- Updated dependencies [7ed3360]
- Updated dependencies [69becd2]
- Updated dependencies [5e52495]
- Updated dependencies [0fa5e4d]
- Updated dependencies [b750823]
- Updated dependencies [5bfaabd]
- Updated dependencies [e06810e]
- Updated dependencies [ab3ad4f]
- Updated dependencies [65bb513]
- Updated dependencies [c97a45e]
- Updated dependencies [b19162d]
- Updated dependencies [c2fd122]
- Updated dependencies [1bd6faa]
- Updated dependencies [ac2139c]
- Updated dependencies [b14ab3a]
- Updated dependencies [e24d767]
- Updated dependencies [8c60819]
- Updated dependencies [aca561a]
- Updated dependencies [e64a52e]
- Updated dependencies [844d17f]
- Updated dependencies [d8a0be4]
- Updated dependencies [48132f7]
- Updated dependencies [4dcd52a]
- Updated dependencies [42ae5c6]
- Updated dependencies [0ef9dfd]
- Updated dependencies [f4b97c8]
- Updated dependencies [1d723e3]
- Updated dependencies [0109f54]
- Updated dependencies [7e5bb5d]
- Updated dependencies [fbc23e0]
- Updated dependencies [6d762da]
- Updated dependencies [e6fdbdc]
- Updated dependencies [54233b1]
- Updated dependencies [c2ecbae]
- Updated dependencies [f9faa7d]
- Updated dependencies [97b63d7]
- Updated dependencies [6bb454a]
- Updated dependencies [11c1e71]
- Updated dependencies [523be48]
- Updated dependencies [7e2b7e9]
- Updated dependencies [33526fd]
- Updated dependencies [32413ec]
- Updated dependencies [c1e1e6b]
  - @object-ui/components@17.4.0
  - @object-ui/react@17.4.0
  - @object-ui/core@17.4.0
  - @object-ui/fields@17.4.0
  - @object-ui/i18n@17.4.0
  - @object-ui/types@17.4.0
  - @object-ui/mobile@17.4.0
  - @object-ui/permissions@17.4.0

## 17.3.0

### Patch Changes

- d915c47: The bulk selection bar now applies the ADR-0066 D4 `requiredPermissions` capability gate, and short-circuits a boolean `visible` instead of treating it as a broken expression (#3492).

  Two independent gaps put the selection bar out of step with the other three action surfaces. **First**, the capability gate: `action-bar.tsx` (list toolbar), `containers.tsx` (record header) and `RowActionMenu.tsx` (row kebab) all call `useCapabilityGate`, but `resolveBulkActions` dropped `requiredPermissions` when promoting an object action into a `BulkActionDef` and `BulkActionBar` never read it — so the same action was hidden from an unentitled user in the row kebab and offered to them in the selection bar the moment they ticked a checkbox. For a `type: 'api'` action pointed at a custom endpoint nothing behind it was guaranteed to say no. `BulkActionDef` now carries `requiredPermissions?: string[]`, the fold forwards it, and the bar filters on it with the engine's rule verbatim (empty declaration passes, several are AND-ed, unknown capabilities fail OPEN).

  **Second**, boolean `visible`: `partitionBulkRows` handed it straight to the CEL engine, producing `{ dialect: 'cel', source: undefined }` — a fault, which on this fail-closed path disqualified every selected record. So `visible: true` hid the button from everyone, the exact inverse of what it says; and `visible: false` rendered the button anyway, because the render guard tested `def.visible &&` for truthiness and read a declared `false` as "ungated". Booleans now short-circuit the way `useCondition` / `useRowPredicate` always have, and "is this def gated" is one shared predicate (`hasVisibilityGate`) rather than a truthiness test. `BulkActionDefSchema.visible` is `ExpressionInputSchema`, so `objectstack build` never emitted this shape — hand-written view JSON and in-process callers did.

- d915c47: Relation fields (`lookup` / `master_detail` / `user` / `tree`) are now usable in action and conditional-formatting predicates: they bind as the stored foreign key on every surface, and the fields a predicate reads are included in the query projection (#3501).

  Before this, one predicate over one relation field had four different fates, decided by things its author does not control. `$expand` **replaces** the id in place with the whole related record, and a view expands exactly the relations it shows as COLUMNS — so `record.owner == "U1"` was **true** where the column was absent, **false** where it was displayed, and a **fault** where the field was neither displayed nor projected (a list's `$select` was built from its columns alone, and CEL treats an absent key as a fault, not as null). A fault is fail-CLOSED on the row kebab and the selection bar and fail-OPEN on the lenient paths, so the same authoring mistake hid the button from everyone on one surface and showed it to everyone on the next, with nothing on screen to point at either. The server, meanwhile, only ever sees the id — so client and server could not agree, which is the one thing ADR-0036 / ADR-0058 exist to guarantee.

  Two changes close it. `toPredicateRecord` (new, `@object-ui/core`) collapses expanded relation values back to their ids when a record is bound for evaluation — driven by the object's own field types, not by sniffing for an `id` key, so a `json` field that happens to carry one is untouched. It is threaded through `evalRowPredicate` / `resolveConditionalFormatting` (via a new `fields` option), `useRowPredicate`, `partitionBulkRows`, and both `page:header` evaluators, with the object schema supplied by `ObjectGrid` / `ListView` / `ObjectKanban` / the record context. Kanban card formatting is threaded the same way, so a rule cannot match on the grid view of a list and silently never match on its board. Display is unaffected — a detail-page title still renders the related record's name, and the schema-only `kanban-ui` entry point (which has no object schema to offer) keeps using the payload verbatim. `collectPredicateFieldRefs` / `listViewPredicates` (new) harvest the `record.x` / `data.x` references out of a view's conditional formatting, row-action defs, bulk-action defs, promoted object actions and `userActions` overrides, and add them to `$select` — intersected with the object's declared fields plus the platform columns every object carries (`isProjectableField`), because an unknown key is not ignored by every backend. No `$expand` is added: a predicate wants the foreign key, which is what an unexpanded relation already is.

- 6195841: Localize the record-detail overlay heading that `ListView` and `ObjectGrid`
  build themselves (objectui#3426)

  #3423 gave `NavigationOverlay`'s `resolvedTitle` an i18n default
  (`detail.recordDetail`), but two hosts never let that default run: they
  string-built an English heading in TypeScript and passed it as the `title`
  prop, so a zh/ja/de session got a fully localized drawer with one English
  heading on it.

  - `packages/plugin-list/src/ListView.tsx` — `` `${schema.label} Detail` ``
  - `packages/plugin-grid/src/ObjectGrid.tsx` — the same template, plus a bare
    `'Record Detail'` literal for the no-label case

  Both are user-reachable, not dead defaults. `list-view` / `object-grid` are
  public page blocks and `navigation` is an authorable key on their schema, so a
  page that authors `navigation: { mode: 'drawer' }` opens exactly this overlay
  on row click. (`app-shell`'s `ObjectView` does suppress it — it passes its own
  `onRowClick`, which takes priority inside `useNavigationOverlay`, and renders
  its own overlay — but that is one host overriding a public block, not proof the
  branch is unreachable.)

  ## What changed

  Both call sites now key their heading instead of concatenating it:

  - a new `detail.recordDetailWithLabel` (`'{{label}} Detail'`) carries the
    object label through interpolation, so a pack whose qualifier trails the noun
    (`de`) or that needs a possessive particle (`ja`/`zh`) can write its own
    arrangement rather than inherit English word order;
  - the no-label branch reuses `detail.recordDetail` — the very key the overlay
    itself defaults to — so one heading on one control cannot drift into two
    translations.

  The new key is added to all ten locale packs and to each plugin's English
  defaults map (`LIST_DEFAULT_TRANSLATIONS` / `GRID_DEFAULT_TRANSLATIONS`), which
  is what `createSafeTranslation` falls back to with no `I18nProvider` mounted.

  English output is byte-identical in every branch (`Contacts Detail` /
  `Contacts Detail` / `Record Detail`), with and without a provider — pinned by a
  provider-less test file per plugin, kept separate because `initReactI18next`
  registers its instance as a module global that outlives `cleanup()`.

- Updated dependencies [18cd432]
- Updated dependencies [b7165ce]
- Updated dependencies [532cf8b]
- Updated dependencies [680080a]
- Updated dependencies [a7651e6]
- Updated dependencies [d915c47]
- Updated dependencies [b71fc92]
- Updated dependencies [65516ba]
- Updated dependencies [94c5b7c]
- Updated dependencies [ca0fa8f]
- Updated dependencies [34595eb]
- Updated dependencies [3889ffb]
- Updated dependencies [5781fb1]
- Updated dependencies [7e2406a]
- Updated dependencies [9e9e9a9]
- Updated dependencies [19b8c9b]
- Updated dependencies [56409c2]
- Updated dependencies [042e09d]
- Updated dependencies [7d08c3f]
- Updated dependencies [9cbcbf4]
- Updated dependencies [85c4c9c]
- Updated dependencies [fd54c3e]
- Updated dependencies [4eeb932]
- Updated dependencies [6fe485b]
- Updated dependencies [5c856ec]
- Updated dependencies [23018cc]
- Updated dependencies [53811d1]
- Updated dependencies [68b6a28]
- Updated dependencies [0554e88]
- Updated dependencies [d915c47]
- Updated dependencies [f44d872]
- Updated dependencies [28b2e65]
- Updated dependencies [509104a]
- Updated dependencies [825bbe3]
- Updated dependencies [6195841]
- Updated dependencies [5dd0127]
- Updated dependencies [06632e9]
- Updated dependencies [a415684]
- Updated dependencies [a4cff5b]
- Updated dependencies [175bd79]
- Updated dependencies [5af2852]
- Updated dependencies [34d9169]
- Updated dependencies [5881a2c]
- Updated dependencies [9bc3709]
- Updated dependencies [f833d3a]
- Updated dependencies [30ae33a]
- Updated dependencies [a6ec93d]
- Updated dependencies [2a9513d]
- Updated dependencies [49f7449]
- Updated dependencies [71be406]
- Updated dependencies [d22ae31]
- Updated dependencies [c7ed4c3]
- Updated dependencies [2409e1d]
- Updated dependencies [789fe3e]
- Updated dependencies [f789c3b]
- Updated dependencies [a321fa4]
- Updated dependencies [8d8094a]
  - @object-ui/core@17.3.0
  - @object-ui/fields@17.3.0
  - @object-ui/components@17.3.0
  - @object-ui/types@17.3.0
  - @object-ui/i18n@17.3.0
  - @object-ui/react@17.3.0
  - @object-ui/mobile@17.3.0
  - @object-ui/permissions@17.3.0

## 17.2.0

### Minor Changes

- 4bf612c: Aggregate single-call mode for bulk actions: `execution: 'aggregate'` (objectui#3139).

  A `bulkActionDefs` entry with `operation: 'custom'` used to have exactly one
  dispatch shape: one action-runner call per selected record (`_rowRecord`
  attached). "Select N rows → ONE call that receives every selected id" — the
  zip-of-QR-codes / merged-PDF / batch-print shape — could not be expressed, so
  downstream projects fell back to per-row `window.open` storms or gave up.

  `BulkActionDef` now carries `execution?: 'perRecord' | 'aggregate'` (default
  `'perRecord'`, existing views untouched). An aggregate def dispatches its
  action exactly once for the whole selection with `params._selectedIds:
string[]` injected and the full records published as
  `context.selectedRecords`. The authored form usually just names a declared
  object action — `{ name, operation: 'custom', execution: 'aggregate' }` —
  and `resolveBulkActions` attaches the declaration. Results are
  all-or-nothing: a failure is attributed to every id with the real error and
  per-row Retry is hidden (re-running the action is the retry; a total failure
  keeps the selection). `batchSize` does not apply; `maxRecords` still gates.

  The executor rides the existing `executeBulkBatch` bulk-first decision tree —
  the aggregate call is its `bulkCall`, and the per-row "fallback" only
  re-throws the captured error for attribution, never fans out N dispatches
  against an endpoint written for one `_selectedIds` call.

  Also: url/api target interpolation now exposes `${ctx.selection.ids}` (comma
  -joined) and `${ctx.selection.count}` from the grid's checkbox selection, so
  a plain `list_toolbar` action can carry the selection without bulk plumbing;
  the console's server-action handler recognizes `_selectedIds` and skips the
  single-record multi-select guard for aggregate dispatches.

- 4a51e77: Stop declaring 14 symbols across ten packages under names `@objectstack/spec`
  owns (objectui#3161, objectstack#4115 batch 7 — the long tail, one or two
  entries per package). All ten packages leave the ledger, which drops from 17
  collisions across 11 packages to 3 across 1.

  **Renamed exports** — in every case the spec exports the same name for a
  _different_ thing, so the old name was a mis-description rather than a dialect:

  | package                    | was                                | now                                                  | what the spec's same-named export is                                                                                                       |
  | :------------------------- | :--------------------------------- | :--------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
  | `@object-ui/fields`        | `FieldWidgetProps`                 | `FieldWidgetComponentProps`                          | the DECLARED field-widget plugin props contract (a zod object; `field.type` is the `FieldType` enum, `readonly`/`required` carry defaults) |
  | `@object-ui/layout`        | `PageHeaderProps`                  | `PageHeaderComponentProps`                           | the authored `page:header` node — a zod schema of `title`, `subtitle`, an icon NAME, `breadcrumb`, `actions: string[]`                     |
  | `@object-ui/layout`        | `Page`                             | `PageNodeRenderer`                                   | the authored page metadata DOCUMENT (`name`, `label`, `type`, `regions`)                                                                   |
  | `@object-ui/plugin-detail` | `ObjectFieldLike`                  | `ObjectDefFieldLike`                                 | the i18n duck type `translateObject` walks (`help`/`description`, plus `[key: string]: any`)                                               |
  | `@object-ui/plugin-grid`   | `ColumnSummaryConfig`              | `ColumnSummarySetting`                               | the OBJECT form of `ListColumn.summary` **only** — the local one was the whole union, shorthand included                                   |
  | `@object-ui/plugin-grid`   | `isMultiValueField`                | `hasMultiValueShape`                                 | the spec's classifier, which requires a def with a `type`; the local one is called with `undefined`                                        |
  | `@object-ui/collaboration` | `RealtimeConfig`                   | `RealtimeSubscriptionConfig`                         | the app's realtime DECLARATION (`enabled`, `transport`, `subscriptions[]`)                                                                 |
  | `@object-ui/plugin-charts` | `ChartConfig`                      | `ChartContainerConfig`                               | the authored chart document (`type`, `xAxis`, `series`, `showLegend`, …)                                                                   |
  | `@object-ui/plugin-form`   | `FormSection` / `FormSectionProps` | `FormSectionContainer` / `FormSectionContainerProps` | the authored form-section metadata (`name`, `pane`, `visibleWhen`, `fields`)                                                               |
  | `@object-ui/providers`     | `Theme`                            | `ThemePreference`                                    | a whole theme DOCUMENT (`name`, `label`, `colors`, `typography`)                                                                           |
  | `@object-ui/runner`        | `App` (default export)             | `RunnerApp`                                          | the authored application metadata type **and** the `App.create()` builder                                                                  |
  | `@object-ui/sdui-parser`   | `ValidationResult`                 | `ManifestValidationResult`                           | plugin-manifest validation (`{ valid, errors?, warnings? }`), exported from both `kernel` and `contracts`                                  |

  `ManifestValidationResult` follows the `<what was validated>Validation<Error|Result>`
  convention registered on objectstack#4115 (`@object-ui/core` took
  `SchemaNodeValidationResult` in batch 4). `PageHeaderComponentProps` deliberately
  reuses the name `@object-ui/app-shell` already chose for its own header props in
  batch 3, so one concept does not acquire two dialect names one package apart.

  **Now derived from the spec instead of hand-written:**

  - `@object-ui/fields` — `isFileIdToken` is re-exported from
    `@objectstack/spec/data`. The local copy was character-for-character identical
    to the spec's function while its comment said it "mirrors" it, so every
    behaviour test passed and only reference identity could tell the two apart.
    The regex is a wire decision: widening it server-side while a copy here kept
    the old bound would make every new id read as "not a reference", and the
    widget would submit the legacy inline blob to a backend expecting a reference.
  - `@object-ui/plugin-detail` — `FeedFilterMode` is re-exported from
    `@objectstack/spec/data`, in a file that already imported the sibling
    `FeedItemType` from the spec.
  - `@object-ui/plugin-grid` — the eleven-member aggregation union is now the
    spec's `ColumnSummary` enum, so the total `Record<ColumnSummaryType, string>`
    label map turns a member the spec adds into a compile error instead of a
    blank footer cell. `ColumnSummarySetting` is `NonNullable<ListColumn['summary']>`,
    i.e. whatever forms the spec itself accepts. `hasMultiValueShape` delegates to
    the spec's `isMultiValueField` rather than re-deriving it from
    `MULTI_OPTION_TYPES` / `MULTI_CAPABLE_TYPES`.
  - `@object-ui/providers` — `ThemePreference` is the spec's `ThemeMode` union
    plus the one legacy `'system'` spelling this provider still honours for stored
    preferences, read off the schema's own `_zod` carrier so the package takes no
    zod dependency.

  `@objectstack/spec` moves from `devDependencies` to `dependencies` in
  `@object-ui/fields` (it re-exports a runtime function) and `@object-ui/providers`
  (its public `.d.ts` now references the spec).

  Scored `minor`, not `major`, per this repo's fixed-group rule — objectui's major
  tracks `@objectstack`, so breaking changes of our own ship as minor with the
  semantics spelled out above (see AGENTS.md §版本号策略). A `major` here would carry
  all 39 packages of the fixed group to `18.0.0` and off objectstack's 17.x line.

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

- 335041c: Stop declaring 13 `@object-ui/core` symbols under names `@objectstack/spec` owns
  (objectui#3158, objectstack#4115 batch 4).

  **Breaking for importers of `@object-ui/core`** — seven exported names changed,
  because the spec exports the same name for a _different_ thing:

  | was                      | now                               | what the spec's same-named export actually is                                |
  | :----------------------- | :-------------------------------- | :--------------------------------------------------------------------------- |
  | `ChartSeries`            | `ChartSeriesBinding`              | the authored dataset-binding descriptor (a measure `name`, no `data`)        |
  | `ActionHandler`          | `ActionRunnerHandler`             | the SERVER-side objectql handler, `(ctx) => unknown`                         |
  | `PluginDefinition`       | `RegistryPluginDefinition`        | the platform PACKAGE manifest (`id`/`slug`/`staticPath`/install hooks)       |
  | `ValidationError`        | `SchemaNodeValidationError`       | plugin-manifest validation, keyed by `field`, no severity                    |
  | `ValidationResult`       | `SchemaNodeValidationResult`      | ditto, with both arrays optional                                             |
  | `defineView`             | `defineSystemView`                | the VIEW-DOCUMENT factory: parses a `ViewSchema`, returns a validated `View` |
  | `resolveCrudAffordances` | `resolveEffectiveCrudAffordances` | the object-level affordance matrix, with no notion of server API operations  |

  The other six keep their names and are now **imported from the spec** instead of
  re-declared: `StyleMap`, `ResponsiveStyles` (ADR-0065), `RowHeight`,
  `CONTEXT_TOKENS`, `CrudAffordances`, `RowCrudPredicates`.

  **The copies were live misdescriptions, not just duplicates.** Three said so in
  their own comments:

  - `CONTEXT_TOKENS` carried a note that the duplication was "temporary until the
    next coordinated release… because the installed `@objectstack/spec` predates
    that export". The installed spec (17.0.0-rc.0) exports it, and the copy was
    byte-identical — so it passed every value comparison and every behavioural
    test for the whole interval in which its stated reason was false.
  - `RowHeight` advertised itself as "the spec's `RowHeightSchema` vocabulary"
    while being a hand-written union. It happened to be correct; nothing would
    have caught the day it stopped being.
  - `managedBy.ts` described itself as a "UI-side mirror of the framework's
    `resolveCrudAffordances()`" and carried its own `DEFAULTS` table — a
    line-for-line copy of the spec's `CRUD_AFFORDANCE_DEFAULTS`, plus a copy of
    its override parser.

  `resolveEffectiveCrudAffordances` now **delegates** the bucket/`userActions` half
  to the spec's `resolveCrudAffordances()`, so the bucket table has exactly one
  definition on the platform. What stays objectui's is the part the spec has no
  notion of: intersecting that matrix with the server-resolved effective API
  operation set (#3391), so the UI never offers a button the server would 405 —
  and the name now says that instead of claiming to be the spec's function.

  Deriving `RowCrudPredicates` also **tightens** it: the local copy typed
  `visibleWhen`/`disabledWhen` as `unknown`, where the spec types them as
  `Expression | ExpressionInput`. That was imprecision, not a deliberate dialect.

- cb82705: A standalone grid's search box searches the list, not the page you can see (objectui#3118).

  Under server-side pagination a standalone `ObjectGrid` rendered `data-table`'s
  built-in search box, and that box filtered the rows the table was holding —
  which is one page. The user read "2 results for X in this list" while 3075 rows
  never participated, with the pager beside it still reading `1 / 63`. Every piece
  was individually correct: `searchable` defaults to true, `manualPagination` is
  true, and the two are declared next to each other in the same object literal.

  This is objectui#3106 one axis over — sort there, filter here — and it takes the
  same shape. `DataTable` gains `manualSearch` + a controlled `search` +
  `onSearchChange`. In that mode it filters nothing, reports the typed term, and
  renders `search` as the box's value, holding **no** term of its own: a private
  copy beside a controlled prop is the shape the defect had. `ObjectGrid` turns
  that term into a `$search` on the refetch — the server picks the matching fields
  from the object's metadata (ADR-0061), the same channel the ListView toolbar has
  always used — and returns to page 1, since a new term makes the old page index a
  different set of rows (usually no rows at all). `$searchFields` rides along only
  when the view declared `searchableFields`, which can narrow the server-resolved
  set and never widen it.

  Two things worth naming:

  - Both paths are never live at once. The server's answer is the answer; a client
    pass left running underneath would silently re-narrow it to whichever returned
    rows happen to contain the term as _rendered text_, overruling the server's
    own notion of which fields are searchable.
  - Under `manualSearch` a table with no `onSearchChange` renders **no** search
    box. The sort axis could degrade to inert headers; here there is no honest
    local behaviour to fall back to, because the rows to search are not in the
    browser.

  Client-paginated grids are untouched: inline, bound and grouped grids hold every
  row they display, so their box keeps filtering in memory, where the count it
  produces is true. The ListView path was never affected — it passes
  `showSearch: false` and searches from its own toolbar.

- Updated dependencies [4ae0ac4]
- Updated dependencies [696e3c1]
- Updated dependencies [bca45cc]
- Updated dependencies [a889e31]
- Updated dependencies [09d30a4]
- Updated dependencies [4bf612c]
- Updated dependencies [335041c]
- Updated dependencies [b414983]
- Updated dependencies [256f8cc]
- Updated dependencies [d9668a7]
- Updated dependencies [4b470b9]
- Updated dependencies [785b8a5]
- Updated dependencies [cb82705]
- Updated dependencies [f572849]
- Updated dependencies [4a51e77]
- Updated dependencies [f6e8d78]
- Updated dependencies [ea96284]
- Updated dependencies [d3584c6]
- Updated dependencies [a8ad6c0]
- Updated dependencies [444457c]
- Updated dependencies [850033c]
- Updated dependencies [022e4c3]
- Updated dependencies [009e25d]
- Updated dependencies [726b89c]
  - @object-ui/types@17.2.0
  - @object-ui/components@17.2.0
  - @object-ui/core@17.2.0
  - @object-ui/react@17.2.0
  - @object-ui/i18n@17.2.0
  - @object-ui/fields@17.2.0
  - @object-ui/mobile@17.2.0
  - @object-ui/permissions@17.2.0

## 17.1.0

### Minor Changes

- 24e0e0a: feat(components,grid,list): a column-header sort orders the whole list, not the page you can see — #3106

  Clicking a column header under server pagination sorted **the current page**.
  The user saw "sorted by this column" and got "these fifty rows are in order;
  page 2 starts over". The sort was real — its scope was not the one the screen
  implied — and it had no way out of `data-table` at all: the sort lived in two
  `useState`s with no callback, so the layer that issues the request could not
  see it even in principle.

  `DataTable` gains `manualSorting` + a controlled `sort` + `onSortChange`. In
  that mode it sorts nothing, reports what a header click asks for, and renders
  `sort` as the indicator — keeping **no** sort state of its own, because a
  private copy beside a controlled prop is the shape the defect had.

  `ObjectGrid` turns that into a `$orderby` in both of its server modes (its own
  fetch, and a parent-driven one), and `ListView` lands it in `currentSort` — the
  same state the toolbar's sort builder writes. One sort, two controls: that is
  what makes "does a header sort outrank the saved view's sort?" a non-question
  rather than a precedence rule someone has to remember.

  Three details that are decisions, not incidentals:

  - **A header click replaces the order** instead of appending to it, so the
    column under the cursor is the one the list is sorted by. Multi-key orders
    still come from the sort builder, and the headers render them numbered.
  - **It cannot ask for "no sort".** In client mode the third click clears, and
    that is meaningful there — the rows return to the order they arrived in.
    Across a server-paged collection there is no such order (objectstack#4363), so
    a header offering it would hand the user a worse lie than the one being fixed.
    Clearing stays with the sort builder, which can restore the view's default.
  - **Relational columns render no sort affordance** under server sorting. A
    `lookup` column shows a related record's name while `$orderby` can only order
    by the stored id (objectstack#4256) — the same reason #3096 removed them from
    the toolbar's sort picker. Client-side sorting keys off the rendered label, so
    those headers stay live there.

  Client-side tables are untouched: same three-state cycle, same local sort.

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

- 5340879: fix(grid): bulk-action params render the shared form field widgets — a failed lookup fetch shows an error + Retry instead of a permanent "Loading…" (#3064, ADR-0059)

  `BulkActionDialog`'s hand-rolled param controls (a 2026-05 MVP predating the
  PeoplePicker and ADR-0059) are replaced by the same field-widget renderer the
  object form and `ActionParamDialog` use, via a new pure `bulkParamToField()`
  adapter + `getLazyFieldWidget()`:

  - `lookup` params get the real searchable `LookupField` (server-side search,
    record-picker dialog, loading/error/empty states owned by `useRecordQuery`);
    a `sys_user` target — or a `user`-typed param — is promoted to the form's
    search-first PeoplePicker (avatar + subtitle rows, recents, banned users
    excluded). Every other param type (date/datetime/boolean/select/multiselect/
    textarea/number/…) renders its form widget too, so param support can no
    longer drift behind the form surface.
  - The #3064 failure pipeline is gone by construction: no more eager
    `find($top:200)` prefetch on open, no error swallowed into an empty option
    list rendering as permanent "Loading…", and no per-param failure cache —
    reopening or Retry refetches.
  - Preserved semantics: #2204 schema-fallback multi-value detection, required
    gating, #2185 nested-popper dismissal guard, and human-readable confirm-step
    labels (now resolved per selected id via `findOne`, replacing the removed
    candidate prefetch).

- 19e9fa0: fix(grid): drop the `bulkEnabled` derivation — the spec key is a tombstone

  Follow-up to objectui#3002 / #3031. That change folded two sources into the
  selection bar: a view's `bulkActions` names resolved against
  `objectDef.actions`, and object actions declaring `ActionSchema.bulkEnabled`.
  The second source is dead.

  `@objectstack/spec` 17.0.0 retired `action.bulkEnabled` in the #3896 audit
  close-out (framework#4054, landed while #3031 was in flight — the spec source
  still carried the key when its design was settled). It is now a `retiredKey()`
  tombstone, so it is not merely ignored: `defineStack` **hard-rejects** a config
  that sets it, and the backend refuses to boot. Browser verification against a
  real showcase backend is what surfaced this — the derivation branch could never
  run, and #3031's changeset pointed authors at a key that breaks their app.

  The tombstone's own prescription is the path that survives:

  > the multi-select toolbar is driven by the LIST VIEW's `bulkActions` /
  > `bulkActionDefs`, never by this flag … declare the action in the view's
  > `bulkActions` instead.

  So `resolveBulkActions` now folds exactly two vocabularies — inline-authored
  `bulkActionDefs`, and `bulkActions` names promoted to their declared object
  action — which is what #3031's other half already did and what the end-to-end
  run exercised: naming `showcase_mark_done` in the view's `bulkActions` issued
  one `POST /api/v1/actions/showcase_task/showcase_mark_done` per selected
  record (10/10 → `done: true, progress: 100` server-side). Everything downstream
  of the fold is unchanged: promoted defs still carry the action's label, icon,
  `visible`, confirm text and params; still run through `BulkActionDialog`
  (params → confirm → progress → result); still dispatch per record with
  `_rowRecord` attached; still attribute failures per record.

  A stale `bulkEnabled: true` on an object action is now inert rather than a
  second path into the bar. Note tsc cannot catch this class of drift here — the
  fold reads a loosely-typed `NamedActionDef` with an index signature, so the
  retired key never surfaces as `never`.

- a149e90: fix(grid): a bulk delete / by-name action clears the row checkboxes, not just the toolbar — objectui#3056

  After a successful bulk delete (or a bulk action dispatched to a
  consumer-registered runner handler), the selection toolbar vanished but every
  row stayed visibly ticked. The user was left on a page of selected rows with no
  toolbar to act on them, and no way back except unticking each row or reloading.

  `ObjectGrid` carries two selection sources that must move together:
  `selectedRows` (ours — drives the toolbar) and the data-table's internal
  `selectedRowIds` (drives the checkboxes, cleared only when the host bumps
  `selectionResetKey`). `handleBulkDialogClose` reset both; `dispatchBulkAction`
  reset only the first, on both of its branches.

  Both now go through one `resetSelection()` helper — including the dialog path,
  so the invariant is structural rather than three call sites remembering to
  agree. Failure semantics are untouched: a by-name action that reports
  `success: false` still keeps the toolbar AND the checkboxes so the user can fix
  the cause and retry the same rows.

- d61efd1: fix(grid): a bulk action's `visible` is evaluated per selected record — objectui#3067

  The selection bar evaluated a def's `visible` against the ambient scope with no
  record bound. That does not fail open, it answers wrongly: with no `record` in
  scope the lenient evaluator returned `true` for **every** row-scoped predicate,
  including the ones that should be false — `${record.done}` and
  `${record.owner == user.id}` both came back `true`. An authored gate was not
  weakened, it was inverted for half its inputs, and nothing distinguished that
  from a real verdict.

  `visible` is now evaluated **once per selected record, with that record in
  scope**, fail-closed per record and warning once on a fault — the same contract
  the row kebab uses. One evaluation answers both questions:

  - **Is the button offered?** When at least one selected record passes. A
    record-free predicate (`features.x`, `current_user.y`) returns the same
    verdict for every row, so it still behaves as a plain button-level gate — no
    syntactic sniffing for `record` references is involved.
  - **Which records does it run on?** The ones that passed. The confirm step
    states how many were skipped, so a run over fewer records than the user
    ticked says so instead of quietly shrinking the selection.

  Eligibility is re-applied to the EXPANDED set after "select all N matching",
  not just the page selection the button could see.

  The mechanism predates objectui#3002, but only inline-authored
  `bulkActionDefs[].visible` used to reach it — written by authors who knew there
  was no record. #3031 began promoting object actions into the bar, and their
  `visible` is typically written for a row/record surface, which is what put
  row-scoped predicates in front of a record-free evaluation.

- 95b7214: fix(list,grid,detail,tree,core): every column resolver reads one key (#3104 PR2)

  PR1 (#3119) put a canonicalizing fold at ListView's ingestion boundary. This
  converges the 22 read sites themselves onto `columnIdentity()` from
  `@object-ui/core`, so a surface that is NOT downstream of that fold resolves
  the same identity anyway.

  That distinction is the user-visible part. A standalone `object-grid` node —
  authored directly on a page, with no `list-view` above it — never passed
  through `normalizeListViewSchema`. Its `getSelectFields` read `c.field` alone
  while the `ensureId` probe one line above read `f?.name || f?.field`, so a
  legacy `{ name: 'account' }` column reached `$select` as a literal `undefined`
  hole: the server never returned the field and every cell in that column came
  back empty. Same for `ObjectTree`, `RelatedList` and the `record:details` /
  `record:related_list` renderers.

  Converged:

  | Surface                                  | Was                                            | Now                                 |
  | ---------------------------------------- | ---------------------------------------------- | ----------------------------------- |
  | `ListView` ×9 + its 2 request builders   | `name \|\| fieldName \|\| field` vs `f?.field` | `columnIdentity()`                  |
  | `RelatedList` ×8                         | `accessorKey \|\| field \|\| name`             | `accessorKey \|\| columnIdentity()` |
  | `ObjectGrid`                             | name-first probe vs `c.field` projection       | `columnIdentity()`                  |
  | `ObjectTree`                             | `name \|\| fieldName \|\| field \|\| key`      | `columnIdentity() \|\| key`         |
  | `buildExpandFields`                      | `field ?? name ?? fieldName`                   | `columnIdentity()`                  |
  | `record-details` / `record-related-list` | `field \|\| name (\|\| key)`                   | `columnIdentity() (\|\| key)`       |

  `accessorKey` keeps its precedence in `RelatedList` — it is TanStack Table's
  column key, not ObjectStack metadata identity, and only the `field || name`
  tail was converged. `key` stays a tail fallback in `ObjectTree` and
  `record-related-list` for the same reason: it is a generic entry key.

  Two incidental fixes that TypeScript surfaced once the resolver stopped
  returning `any`: ListView's filter-field options and its hide-fields popover
  both built entries keyed `undefined` for a column with no resolvable identity.
  Those entries could never match a column; they are now dropped.

  **Inventory re-triage.** PR1 recorded 24 family members. Two were mis-classified
  and are reclassified here rather than converged — reading what they actually
  feed shows they are not column reads at all:

  - `ViewPreview.tsx` adapts a ViewItem **form** section to what `object-form`
    selects by (`field` → `name`) — the #3090 two-layer join.
  - `SchemaForm.tsx` renders an arbitrary metadata **array** into a popover
    summary and guesses at a display key; the entries are validations, actions,
    or whatever the JSON schema declares.

  So the family was 22, and it is now **0**. The ratchet asserts that, asserts
  each converged surface actually routes through the shared reader (a surface
  that dropped identity resolution instead of converging it goes red), and pins
  `accessorKey`'s precedence in `RelatedList`.

- 6f29aa5: fix(grid): a legacy string row action runs instead of green-toasting a no-op — objectui#2960

  A list view declaring `rowActions: ['convert_lead']` rendered a menu item that
  performed **zero network requests** and reported success. Where the object also
  declared the same action with `locations: ['list_item']`, the row menu showed a
  working entry and a dead duplicate of it side by side.

  **The name never became an action.** `ObjectGrid` dispatched the legacy form as
  `{ type: <action name>, params: { record } }` — the action _name_ landing in the
  runner's `type` slot, never resolved against the object's action defs. It
  matches no built-in type and (absent a handler registered under that exact name)
  no handler either, so it fell through to `ActionRunner.executeActionSchema`,
  which returned `{success: true, reload: true, close: true}` for a schema with
  nothing in it. `handlePostExecution` then fired the green "Action completed
  successfully" toast.

  Two changes, either of which would have surfaced the bug:

  **① `ObjectGrid` resolves legacy names against `objectDef.actions`.** A name
  that matches a declared action is promoted to that def and dispatched through
  the same path as a `list_item` action — so it actually runs, and it picks up the
  def's label, `visible`/`disabled` predicates, param dialog and capability gate,
  none of which the string form could carry. A name that matches an action already
  rendered as a def is dropped, which is what removes the dead twin. Names that
  resolve to nothing are still dispatched by name, since a consumer may have
  registered a runner handler under exactly that name.

  **② `ActionRunner`'s empty-schema fallthrough fails loudly.** It no longer
  reports success for an action it never ran: a dispatch with no registered
  handler and no `api`/`endpoint`/`navigate`/`redirect`/`onClick` returns a
  failure naming the action. Schema-only shapes that _do_ declare something — a
  bare `redirect`, an explicit `reload`/`close` — run exactly as before.

- 4874117: fix(grid): an object-declared bulk action runs over the selected records — objectui#3002

  A list view declaring `bulkActions: ['push_down']` rendered a selection-bar
  button that never ran the action: `ObjectGrid` dispatched the legacy form as
  `{ type: <action name>, params: { records } }`, putting the action _name_ in the
  runner's `type` slot. Since objectui#2996 that fails loudly instead of
  green-toasting a no-op, but it still never ran. Nor could the object declare a
  bulk action to resolve against — `bulkActionDefs` was passed through from the
  view JSON verbatim, never derived from `objectDef.actions` the way
  `rowActionDefs` is derived from `locations: ['list_item']`.

  **No spec change was needed.** `ActionSchema.bulkEnabled` — _"Whether this
  action can be applied to multiple selected records"_ — has always been the
  declaration; what was missing was a consumer, exactly as framework's own
  property-liveness audit recorded (_"engine has `getBulkActions`/`executeBulk`,
  but no spec-driven view path calls `executeBulk`"_). So no new `locations`
  entry: a list's selection bar is the only surface on which records are
  multi-selected, which is what the flag already names. `locations` stays
  orthogonal — it places an action's single-record entry, and an action may carry
  both (`locations: ['list_item'], bulkEnabled: true` = one row from the kebab, N
  rows from the selection bar).

  **`ObjectGrid` folds three sources into the selection bar** (new pure
  `resolveBulkActions`, the twin of `resolveLegacyRowActions`; `ObjectGrid` is the
  single convergence point of all three list callers):

  - defs authored inline in the view JSON — unchanged, they win every collision;
  - object actions declaring `bulkEnabled: true` — **derived**, which is what
    "declare a bulk action on the object" now means;
  - legacy `bulkActions` names — resolved against `objectDef.actions` and
    **promoted** to that def, so they carry the action's label, icon, `visible`
    predicate, confirm text and params instead of a bare humanized name. A name
    matching a def already on the bar is dropped rather than rendered as a dead
    twin; a name matching nothing is still dispatched by name, since a consumer
    may have registered a runner handler under it.

  **Execution reuses the existing `BulkActionDialog` model** (params → confirm →
  progress → result). A derived def carries the source action under `actionDef`,
  and `useBulkExecutor` dispatches it through the action runner once per selected
  record with the row attached as `_rowRecord` — so `recordIdParam` injection
  behaves exactly as it does for a `list_item` row action. Client fan-out is the
  only semantics the single-record action contract supports; a server-side "take
  every id at once" variant would need its own spec key and endpoint contract.
  Params and confirmation are collected once by the dialog and handed to the
  runner as values so it never re-prompts per record, per-record toasts are muted
  in favour of the dialog's aggregate result, and a failing record is attributed
  in the result list (and error CSV) rather than counted as a success.

  Also fixed: the bar rendered legacy string buttons **only when no defs
  existed**, so a view mixing both silently lost half its buttons. After the fold
  the two lists are disjoint, and both render.

- Updated dependencies [62311b6]
- Updated dependencies [fc0272a]
- Updated dependencies [9e7349e]
- Updated dependencies [8864971]
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
- Updated dependencies [68ef584]
- Updated dependencies [4952edf]
- Updated dependencies [7f0252e]
- Updated dependencies [c4d7b20]
- Updated dependencies [c769d3d]
- Updated dependencies [7639a61]
- Updated dependencies [94e63ef]
- Updated dependencies [c735bf7]
- Updated dependencies [02aef0c]
- Updated dependencies [6f29aa5]
- Updated dependencies [d21794c]
- Updated dependencies [c4db402]
- Updated dependencies [5319bf1]
- Updated dependencies [49e5671]
- Updated dependencies [2307b52]
- Updated dependencies [9a04d25]
- Updated dependencies [b5b97e2]
- Updated dependencies [f59f2c1]
- Updated dependencies [07de839]
- Updated dependencies [2a40b5e]
- Updated dependencies [df613fa]
- Updated dependencies [4874117]
- Updated dependencies [ad0183a]
- Updated dependencies [ce08d55]
- Updated dependencies [eb4b740]
- Updated dependencies [aecc934]
- Updated dependencies [5b084eb]
- Updated dependencies [aa1240a]
- Updated dependencies [2374a49]
- Updated dependencies [390c071]
- Updated dependencies [d10f526]
- Updated dependencies [2d5d594]
- Updated dependencies [ea7f477]
- Updated dependencies [379728f]
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
- Updated dependencies [80edbd4]
- Updated dependencies [9867281]
  - @object-ui/core@17.1.0
  - @object-ui/components@17.1.0
  - @object-ui/react@17.1.0
  - @object-ui/types@17.1.0
  - @object-ui/i18n@17.1.0
  - @object-ui/permissions@17.1.0
  - @object-ui/fields@17.1.0
  - @object-ui/mobile@17.1.0

## 17.0.0

### Minor Changes

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

- 2735de6: feat: render the server's effective API operation set (#3391 PR-4)

  The frontend now consumes the per-object **effective API operation set** the
  server resolves (from `/me/permissions` `apiOperations`, framework #3391) —
  never the raw `apiMethods` — so Import/Export/New/Edit/Delete buttons match what
  the server will actually admit, and a 405 import refusal shows a dedicated
  message instead of silently falling back.

  - **core** `resolveCrudAffordances(obj, effectiveApiOperations?)` — new optional
    second argument intersects each affordance bit with its API operation
    (create/import→create/import, edit→update, delete→delete, exportCsv→export).
    Omitting it (old backend / no effective set) leaves affordances unchanged.
  - **permissions** — `/me/permissions` response carries per-object
    `apiOperations`; `PermissionContextValue.getObjectApiOperations(object)`
    exposes it (undefined when absent → callers keep current behavior); `check()`
    maps `import→allowCreate`, `export→allowRead`.
  - **app-shell** `ObjectView` intersects its toolbar affordances with the object's
    effective operations (Import); the platform-admin identity-import bypass is
    unaffected.
  - **plugin-list** `ListView` / **plugin-grid** `ObjectGrid` gate the Export
    button (and export handler) on effective `export`; `plugin-grid` gains the
    `@object-ui/permissions` workspace dependency.
  - **plugin-grid** `ImportWizard` — a 405 / `OBJECT_API_METHOD_NOT_ALLOWED`
    import refusal is detected by a new `isImportNotAllowed` predicate at every
    catch site (async, sync, dry-run) and STOPS with a dedicated
    `grid.import.notAllowed` message (10 locales + fallback dict) — it never falls
    back to the sync/legacy path (which 405s too), distinct from the 404
    route-absent fallback.

  Backward-compatible: a missing effective set (unrestricted object, older
  backend, or no permission provider) preserves the current default-allow
  behavior everywhere.

- ba45145: feat: gate list row Edit/Delete and bulk delete on the server's effective operation set (#3720)

  The **fourth** surface #3391 left open. The three earlier rounds — the toolbar
  (objectui#2823), detail/form (#3546, objectui#2832 + #2876) and related lists
  (#3546) — all route through `resolveCrudAffordances`. The main list's **row
  CRUD** does not: it has its own resolver (`plugin-grid`'s
  `resolveRowCrudAffordances`), so none of those rounds ever reached it.

  Its gate was `operations ?? { update: !!onEdit, delete: !!onDelete }` — and
  `ObjectView` wires `onEdit`/`onDelete` unconditionally while view JSON rarely
  declares `operations`, so it was effectively always-on. A caller whose effective
  set carried neither `update` nor `delete` still got the row kebab's Edit/Delete
  **and** the bulk delete, the most destructive affordance on the list.

  - **plugin-grid** `resolveRowCrudAffordances` now takes `managedBy` and
    `effectiveApiOperations` and resolves the object verdict through the shared
    `resolveCrudAffordances` policy — so the row gate is the SAME decision the
    toolbar, record header, form and related lists make. It also returns
    `objectCanDelete`, the object-level delete verdict that bulk delete gates on
    (bulk rides `onBulkDelete`, a different callback from the row `onDelete`).
  - **plugin-grid** `ObjectGrid` threads its existing `effectiveApiOps` — until
    now fed only to Export — into the row gate, and applies the delete verdict to
    bulk delete: the implicit `['delete']`, an author-declared
    `bulkActions: ['delete']`, and any `bulkActionDefs` entry with
    `operation: 'delete'`. A declared bulk action is a _wiring_ declaration, not a
    permission grant. Custom action ids and non-delete operations pass through
    untouched.
  - **plugin-list** `ListView`'s own bulk bar (the non-grid views — kanban /
    calendar / gallery; the grid path delegates to `ObjectGrid`) drops its
    built-in `delete` under the same verdict.

  Also closes the ADR-0103 gap on this chain: `rowCrudAffordances` documented the
  bucket lock as "applied upstream via the view's `operations.*`", but the
  all-open default meant it never was — an engine-owned `system` / `append-only` /
  `better-auth` object leaked a generic row Edit/Delete that the engine rejects
  (`assertEngineOwnedWriteAllowed`). Running the shared policy applies it, and a
  `userActions` opt-in still re-opens it (e.g. `sys_user`'s `edit`).

  Same semantics as the earlier rounds: **intersection, never union** — a server
  grant cannot re-open what the bucket or `userActions` closed, and a
  `userActions` opt-in cannot survive a server denial. A missing effective set
  (unrestricted object, older backend, or no `PermissionProvider`) preserves the
  current behavior.

### Patch Changes

- 553443e: fix(grid): validate email format in the import preview (objectstack#3566)

  The ImportWizard's per-cell `validateValue` did no format check for `email`
  columns (it fell through to `default → true`), so an obviously-bad address —
  e.g. a non-ASCII domain like `x@柴仟.com` — passed client validation (and the
  server dry-run) and only failed at real-import time inside better-auth, giving
  a jarring "passed validation, then failed" experience.

  - Added `isPlausibleEmail`, a single-pass structural + ASCII check that mirrors
    the server's `isLikelyEmail`, so bad emails are flagged red in the preview
    step before submit. No regex backtracking (same ReDoS-safety as the server).

- 09c6a17: fix(grid): localize import result errors (objectstack#3566)

  The import completion screen rendered the raw English server message verbatim —
  e.g. `Row 6 (position): position: "装配工" matches more than one
os_tianshun_ehr_position — use a unique value or the record id` — with the field
  name twice, an internal object api-name, all in English, while the dry-run panel
  already localized the same errors.

  - The result list now runs through the same `formatDryRunError` path (driving
    off the structured error `code`, resolving the api-name to its field label,
    dropping the duplicated `<api-name>:` prefix). Threaded the error `code`
    through `ImportResult.errors` to make this possible.
  - Added code-driven translations for the remaining structured import errors —
    `invalid_boolean` / `invalid_number` / `invalid_date` / `invalid_option` /
    `required` / `AMBIGUOUS_MATCH` — with Chinese (`zh`) copy in `@object-ui/i18n`
    alongside the existing reference errors.

- c7cff19: feat(plugin-grid): "Import as historical data" option in the Import Wizard (framework #3479)

  Adds a checkbox to the Import Wizard's options panel that sends `treatAsHistorical`
  on the import request. When on, the server skips the object's `state_machine` rule so
  mid-lifecycle rows — a batch of already-`closed` tickets, `closed_won` deals — aren't
  rejected by `initialStates`. Off by default: a normal import still walks the FSM, so
  the exemption is always an explicit opt-in.

  Pairs with the framework side (objectstack #3483). `ImportRequestOptions.treatAsHistorical`
  is added to `@object-ui/types`, and `assembleImportRequest` threads it through both the
  inline and named-mapping request shapes (sent only when on).

- df6697f: docs(plugin-grid): the "Import as historical data" wizard hint now reflects audit-timeline preservation (#3493)

  `treatAsHistorical` gained a second half in framework #3493/#3497 — the import
  write context also carries `preserveAudit`, so a historical import keeps the
  original `updated_at`/`updated_by` and business `readonly` fields instead of
  stamping-now / stripping them. The checkbox hint only described the
  state-machine-skip half; it now also says the original timestamps & author are
  preserved. The `ImportRequest.treatAsHistorical` type doc (`@object-ui/types`)
  is updated to match. Copy-only — no behavior change (the checkbox already sent
  `treatAsHistorical`, so the server-side extension is reached without any wiring
  change).

- 9b4b952: fix(i18n): make `en` the complete source of truth for grid import and set-password (objectui#2872 b/c)

  The `en` and `zh` packs had drifted in both directions, silently, because
  `fallbackLng: 'en'` degrades a missing key into English rather than an error and
  the missing-key handler only fires in dev.

  - **74 keys existed only in `zh`.** `grid.import.*` and `auth.setPassword.*` had
    never been added to `en`, so no other locale could translate them: the English
    text came from call-site `defaultValue:` args and a private map inside
    `ImportWizard`. They now live in `en`, which is what translators and
    `os i18n extract` read.
  - **4 `en` keys were missing from `zh`** (`console.commandPalette.title`,
    two `console.ai.suggestions.metadataAssistant.*`, `help.keyboardShortcuts`),
    so Chinese users saw English.

  `grid.import` in particular had three disagreeing sources — the `en` pack (62
  keys), `zh` (130) and `ImportWizard`'s own fallback map (133), union 134, no two
  the same set. All three are now aligned on 134.

  The wizard's fallback map is kept, not deleted: it is what lets the wizard render
  with no `I18nProvider` mounted (standalone embedding, unit tests). It is instead
  pinned to the `en` pack by a new test, so the two can no longer drift.

  `SetPasswordPage` drops its now-redundant inline `defaultValue:` args; the text
  is byte-identical, it just comes from the pack now.

  Adds two guards, both mutation-verified:

  - `en` ↔ `zh` full key parity, asserted in both directions. The other eight
    packs are still ~357 keys behind and are tracked separately (objectui#2872
    part a), so they are deliberately not asserted yet.
  - `IMPORT_DEFAULT_TRANSLATIONS` ↔ `en.grid.import`, same keys and same text.

- 7d46648: fix(hooks): stop calling translation hooks inside try/catch (objectui#2879)

  Eleven call sites wrapped a React hook in `try`/`catch` to make it
  "provider-safe". `useObjectTranslation` and `useObjectLabel` already are — they
  read context optionally and fall back to react-i18next's global instance, and
  never throw. The `catch` bought nothing and cost correctness: a throw _after_
  the hook ran desyncs hook order on the next render, because React matches hooks
  positionally. objectui#2595/#2596 fixed exactly this in `@object-ui/i18n`'s
  `createSafeTranslation`; nine plugin-local re-implementations kept their own
  copy of the bug, and two more (`ObjectTimeline`, `ObjectView`) were found by the
  new lint rule below — `ObjectView` had even suppressed
  `react-hooks/rules-of-hooks` inline to keep it.

  - Six exact re-implementations now delegate to `createSafeTranslation`:
    `plugin-detail`, `plugin-timeline`, `plugin-list`, `plugin-calendar`,
    `plugin-grid`'s `ObjectGrid`, `plugin-designer`.
  - `components`' `data-table` also delegates; `createSafeTranslation` now
    returns `language` alongside `t` so consumers that localize dates don't need
    a second hook call. Purely additive.
  - `plugin-gantt` and `plugin-grid`'s `ImportWizard` keep their local hooks —
    they fall back _per key_, which a single-probe factory cannot express and
    which their comments justify (a host dictionary that covers common keys but
    lags on newer ones). Only the `try`/`catch` is removed.
  - `ObjectTimeline` and `ObjectView` call the hook directly and probe the
    returned value, mirroring `useSafeFieldLabel`.

  Adds `object-ui/no-try-catch-around-hook` (error) so a twelfth copy fails CI.
  It only matches `use*` names, accepts member calls solely on `React` (so
  `vi.useRealTimers()` is not a hook), and resets its try-depth inside nested
  functions (so `renderHook(() => useThing())` inside a `try` is fine) — both
  false positives were real code in this repo and are pinned in the rule's tests.

  `eslint-rules/**/*.test.js` matched no vitest project glob, so the local
  plugin's specs had never run in CI. They are now included; all three pass.

  `ObjectTimeline`'s test mock of `@object-ui/react` omitted `useObjectLabel` —
  the removed `try`/`catch` had been silently absorbing that gap. The mock is now
  complete.

- 662bdf9: fix(fls): wire the real per-caller FLS channel into import targets and grid
  columns; remove the never-populated `field.permissions` shape (objectstack#3661)

  The `permissions?: { read?, write?, edit? }` key on `@object-ui/types` field
  definitions (Phase 3.2.6) was declared-but-never-enforced: no producer in the
  stack ever populated it, so every guard reading it short-circuited to "allow".
  Per ADR-0049 enforce-or-remove, the shape is deleted and the three consumers
  now use the server-resolved `/auth/me/permissions` channel
  (`usePermissions().checkField`) — the same channel ObjectForm/ModalForm/ListView
  already enforce:

  - **ImportWizard target fields (app-shell `ObjectView`)**: the importable
    field set (and thus the downloadable CSV template's columns) now drops
    fields the caller cannot edit, instead of offering columns the server's
    FLS write gate would 403.
  - **ObjectGrid auto-derived columns**: columns the caller cannot read are
    dropped (same gate ListView applies), instead of a dead schema-shape check.
  - **ObjectForm**: the redundant dead guard in field generation is removed;
    the existing `applyFieldPerms` gate remains the real enforcement point.

  BREAKING CHANGE: `@object-ui/types` field definitions no longer accept a
  `permissions` key. It never carried data at runtime; consumers needing
  per-caller field-level permissions must use `@object-ui/permissions`
  (`MePermissionsProvider` + `useFieldPermissions`/`checkField`).

- dc7a798: fix(plugin-grid,plugin-form,plugin-designer,cli,vscode-extension): type-check the last five unchecked packages, and fix the two runtime bugs that hid there (#2919)

  Closes the remaining `DEBT` entries from the #2911 sweep. Each package gains
  `"type-check": "tsc --noEmit"` and loses its entry in
  `scripts/check-type-check-coverage.mjs`; coverage goes 36 -> 41 of 45 and
  outstanding errors 25 -> 5 (only #2916 `plugin-view` and #2918 `layout` remain).

  **Two of these were real bugs, not just type noise.**

  `@object-ui/cli` — `objectui validate` could never report a validation failure.
  `ZodError.errors` was removed in Zod 4 (the repo is on 4.4.3), so `.errors` read
  `undefined` and `.forEach` threw a `TypeError` that the enclosing `catch`
  reported as `✗ Error reading or parsing schema file: Cannot read properties of
undefined` — swallowing the very errors the command exists to print. Now reads
  `.issues`. Verified against the built CLI: an invalid schema now prints
  `1. Invalid input / Code: invalid_union` and exits 1.

  `@object-ui/plugin-grid` — grouping a grid by a boolean column showed the raw
  i18n key. `t('grid.booleanTrue', 'Yes')` asked for a key present in neither
  `GRID_DEFAULT_TRANSLATIONS` nor any locale bundle, and passed the English
  fallback as a bare second argument — which `createSafeTranslation`'s no-provider
  translator reads as an _options object_, so the fallback never applied and the
  header rendered the literal `grid.booleanTrue`. Switched to the `grid.yes` /
  `grid.no` keys the boolean cell renderer (`ObjectGrid.tsx`) and
  `BulkActionDialog` already use, with the fallback passed as `defaultValue`.
  Covered by a new regression test, confirmed to fail against the old code.

  The rest are type-only corrections that preserve runtime behaviour exactly:

  - **plugin-grid** `importParsers.ts` — `scorePair`'s `score`/`reason` moved into
    one `best` record. They were captured `let`s mutated only inside the `bump`
    closure, which TypeScript's control-flow analysis does not track, so it still
    believed `reason` was `'none'` at the type gate and flagged the comparisons as
    non-overlapping (TS2367). The gate — which stops a text column being mapped
    onto a number field — is unchanged; its two dedicated tests still pass.
  - **plugin-form** — `SectionFieldsContext.fieldLabel` now requires `fallback`,
    matching the `useSafeFieldLabel` producer in `@object-ui/i18n` (an omitted
    fallback could not satisfy the `=> string` return, and all four call sites
    already pass one). This one signature cleared six errors.
    `MasterDetailFormSchema.recordId` widens to `string | number`, matching
    `ObjectFormSchema` and the five envelopes that forward straight into it;
    it is narrowed with `String()` only at the batch-transaction boundary, whose
    `BatchTransactionOperation.id` is a string by protocol (the `isEdit` guard
    already proves it non-null there). `deriveMasterDetail`'s column sort gets an
    explicit `fillPriority` helper — `GridColumn.type` is optional, and a column
    without one keeps sorting at priority 5 exactly as the old
    `TYPE_FILL_PRIORITY[undefined] ?? 5` lookup put it.
  - **plugin-designer** — unused `index` parameter prefixed `_`, matching the
    `_entry` beside it.
  - **cli** — a stale `@ts-expect-error` removed; `viteConfig` is typed `any`, so
    the line it guarded had stopped erroring.
  - **vscode-extension** (`object-ui`) — migrated off `moduleResolution: "node"`,
    which is deprecated and stops working in TypeScript 7, to `node16` paired with
    `module: "node16"` (the package has no `"type": "module"`, so node16 resolves
    it as the CommonJS that tsup emits, and it gains the `exports`-map awareness
    node10 lacks). Its error count was under-reported as 1: that TS5107 config
    error masked four more. The package uses `console`/`Buffer` but sets
    `lib: ["ES2020"]` with no DOM and never declared `@types/node` — added, with an
    explicit `types: ["node", "vscode"]`.

  Also: `plugin-grid`, `plugin-form` and `plugin-designer` gain the `baseUrl` +
  `paths` override their type-checked plugin peers already carry, and `cli` an
  empty `paths`. Without it the inherited root `paths` point `@object-ui/*` at
  sibling `src/`, which is outside each project's `rootDir` and produces the ~104
  spurious TS6059 errors noted in #2915; workspace deps instead resolve through
  node_modules to built `.d.ts`, which `type-check`'s `dependsOn: ["^build"]`
  guarantees exist.

  Verified the gate genuinely covers all five rather than trusting the green:
  injecting a type error into each package makes `pnpm type-check --filter <pkg>`
  fail, which was impossible before this change.

- Updated dependencies [7b21891]
- Updated dependencies [0b3be01]
- Updated dependencies [3c4d935]
- Updated dependencies [4b1ed7d]
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
- Updated dependencies [8fb1295]
- Updated dependencies [e16ed2d]
- Updated dependencies [c6fd752]
- Updated dependencies [f9bbddb]
- Updated dependencies [dfd3705]
- Updated dependencies [c77108c]
- Updated dependencies [2735de6]
- Updated dependencies [697cda4]
- Updated dependencies [c19ac11]
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
- Updated dependencies [341bfb5]
- Updated dependencies [2f947e4]
- Updated dependencies [7d46648]
- Updated dependencies [9b53d72]
- Updated dependencies [bb4aa25]
- Updated dependencies [75f1cdf]
- Updated dependencies [662bdf9]
- Updated dependencies [059a052]
- Updated dependencies [53642d4]
- Updated dependencies [8aae006]
- Updated dependencies [c6cfdf1]
- Updated dependencies [d147a13]
- Updated dependencies [c6aaed8]
- Updated dependencies [263f885]
- Updated dependencies [dc334da]
  - @object-ui/components@17.0.0
  - @object-ui/i18n@17.0.0
  - @object-ui/fields@17.0.0
  - @object-ui/react@17.0.0
  - @object-ui/types@17.0.0
  - @object-ui/core@17.0.0
  - @object-ui/permissions@17.0.0
  - @object-ui/mobile@17.0.0

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

- 2b17339: fix(list): keep the injected `owner_id` out of the leading auto-derived columns

  A view-less object's default list columns are derived from the object's field
  order. The framework's `applySystemFields` spreads its injected
  system/audit/ownership fields to the FRONT of that order and stamps them
  `system: true`; `owner_id` is deliberately non-hidden and non-readonly
  (ownership is reassignable), so the old name-based exclusion lists in
  `ObjectGrid` and `InterfaceListPage` — which never listed `owner_id` — let it
  through as column #1 on many showcase list pages (e.g. `showcase_field_zoo`).

  Default-column derivation now classifies system fields via the shared
  `isSystemManagedField` helper, which branches on the spec `system` flag (the
  single source of truth stamped by the registry) with a name-set fallback that
  includes the ownership/tenancy FKs. `owner_id` is pushed to the end
  (`ObjectGrid`) / excluded from the business columns (`InterfaceListPage`), so
  auto-derived lists lead with business fields again and pick up future injected
  fields without editing a name list. Also declares the `system` flag on the
  `@object-ui/types` field metadata.

- 0a3710b: **Finish the `managedBy` / `userActions` de-dup — one parser for the override shape (completes objectui#2712, framework#3343).** #2712 consolidated the bucket _union_ + affordance _set_ mirrors but left four surfaces still parsing the `userActions.{create,edit,delete}` override shape by hand. They now all route through the shared `@object-ui/core` policy, so no package re-implements the boolean / #2614-object-form parse locally.

  - **`@object-ui/core`** promotes the internal `normalizeOverride` to the exported **`normalizeUserAction(v, base)`** (the one parser) and adds **`userActionPredicates(v)`** for per-record CEL predicate extraction.
  - **`app-shell/utils/managedByEmptyState.ts`** — the writable-`system` create check and its local `EmptyStateUserActions` interface are replaced by `resolveCrudAffordances({ managedBy, userActions }).create`.
  - **`plugin-grid/rowCrudAffordances.ts`** — the local `isOptedOut` / `predicatesOf` helpers (and duplicated `RowCrudUserAction` / `RowCrudPredicates` types) fold into `normalizeUserAction`; the historical type names stay re-exported for compat.
  - **`plugin-detail/RelatedList.tsx`** — its inline `predicatesOf` fold into `userActionPredicates`.
  - **`plugin-form/ObjectForm.tsx`** — the hand-rolled `managedBy !== 'platform'` blanket lock + `userActions` unlock is replaced by the resolved affordance for the current mode (`edit` / `create`), the **same** `resolveCrudAffordances` contract the detail (`isObjectInlineEditable`) and grid surfaces use.

  Behavior-preserving for `platform` / `system` / `append-only` / `better-auth`, with one deliberate alignment: an admin-editable **`config`**-bucket object (e.g. `sys_webhook`, `sys_permission_set`) is now editable in `ObjectForm` — it was previously over-locked as "non-`platform`", while detail/grid already treated it as editable (`config` resolves `edit: true`). New unit coverage for the shared parser and the config / create-mode form gate; all existing affordance/edit-gate tests stay green.

- 3b2e4d9: fix(list): route remaining system-field groupings through the shared classifier

  Follow-up to the `owner_id` default-column fix: consolidate the display-oriented
  system-field exclusions onto the shared `isSystemManagedField` /
  `SYSTEM_MANAGED_FIELD_NAMES` (from `@object-ui/types`) so the framework-injected
  `owner_id` is treated consistently across the grid, record picker, and detail
  drawer.

  - `ObjectGrid` record-detail drawer: the business-fields vs. muted meta-section
    split now uses the shared classifier, so `owner_id` (and other injected system
    fields) land in the meta section instead of the business body.
  - `deriveLookupColumns` (record picker): drops its local name set for the shared
    classifier — now flag-aware (`field.system`), not just name-based.
  - `RecordDetailDrawer`: its default `systemFields` set is derived from the shared
    `SYSTEM_MANAGED_FIELD_NAMES`; the `systemFields` prop override is preserved.

  `deriveRelatedLists`' narrow "audit FK on every object" set and plugin-detail's
  inline-edit "never editable" set are intentionally left distinct — different
  semantics (the latter deliberately keeps `owner_id` editable).

- Updated dependencies [0318118]
- Updated dependencies [1c8935a]
- Updated dependencies [af1b0db]
- Updated dependencies [8b8b744]
- Updated dependencies [7cf4051]
- Updated dependencies [803558e]
- Updated dependencies [aefcf39]
- Updated dependencies [2e7d7f0]
- Updated dependencies [ef14f69]
- Updated dependencies [94d4876]
- Updated dependencies [1100a8b]
- Updated dependencies [7abe4cd]
- Updated dependencies [69fa5d1]
- Updated dependencies [549c67d]
- Updated dependencies [ebe6494]
- Updated dependencies [2b17339]
- Updated dependencies [31b77d4]
- Updated dependencies [6d4fbe6]
- Updated dependencies [0a3710b]
- Updated dependencies [f80aaf2]
- Updated dependencies [62b9ab5]
- Updated dependencies [14cb729]
- Updated dependencies [1629313]
- Updated dependencies [29c6040]
- Updated dependencies [faebac3]
- Updated dependencies [2331ac9]
- Updated dependencies [199fa83]
- Updated dependencies [eee4ded]
- Updated dependencies [3b2e4d9]
  - @object-ui/fields@16.1.0
  - @object-ui/i18n@16.1.0
  - @object-ui/core@16.1.0
  - @object-ui/types@16.1.0
  - @object-ui/react@16.1.0
  - @object-ui/components@16.1.0
  - @object-ui/mobile@16.1.0

## 16.0.0

### Minor Changes

- 5534535: feat(grid): built-in row Edit/Delete honor per-record CEL predicates (#2614)

  The object's `userActions.edit` / `userActions.delete` now also accept an
  object form `{ enabled?, visibleWhen?, disabledWhen? }`. The predicates are
  evaluated per row on the canonical CEL engine (`useRowPredicate`, the same
  machinery custom row actions use): `visibleWhen` false → the built-in
  Edit/Delete item is not rendered for that row (fail-closed); `disabledWhen`
  true → rendered disabled (fail-soft). Wired through ObjectGrid's
  RowActionMenu and the data-table's row overflow menu (the related-list
  path), with the app-shell `crudAffordances` mirror kept in lockstep.
  Omitting the predicates (or using plain booleans) keeps today's behavior
  bit-for-bit; declared predicates evaluate only when a row's menu opens, so
  grid rendering cost is unchanged.

### Patch Changes

- 80977d0: Import wizard: stop leaving the user at two silent dead-ends (surfaced during framework batch-write testing).

  - #2640 — the mapping step now renders an inline hint listing every required field that has no column mapped (as `label (name)`), so a disabled **Next** button always explains itself. The hint updates live with the mapping and clears once the columns are supplied; the disable logic itself is unchanged.
  - #2639 — when the server `/import` route is unavailable and the wizard downgrades to the legacy per-row `create` loop, the completion screen now shows a "compatibility fallback" notice (values written as-is, without server-side coercion) via a new optional `ImportResult.degraded` flag — the downgrade is no longer silent. The pre-existing guard that refuses the fallback when relation columns are mapped (which would otherwise write raw natural keys into FK columns) is retained.

- Updated dependencies [d3e19ed]
- Updated dependencies [59d4fa9]
- Updated dependencies [4c7c47f]
- Updated dependencies [210806a]
- Updated dependencies [b4ef588]
- Updated dependencies [ca0f5f0]
- Updated dependencies [5534535]
- Updated dependencies [9b8f978]
- Updated dependencies [195a651]
- Updated dependencies [33b4995]
  - @object-ui/react@16.0.0
  - @object-ui/components@16.0.0
  - @object-ui/types@16.0.0
  - @object-ui/i18n@16.0.0
  - @object-ui/fields@16.0.0
  - @object-ui/core@16.0.0
  - @object-ui/mobile@16.0.0

## 15.0.0

### Patch Changes

- @object-ui/types@15.0.0
- @object-ui/core@15.0.0
- @object-ui/i18n@15.0.0
- @object-ui/react@15.0.0
- @object-ui/components@15.0.0
- @object-ui/fields@15.0.0
- @object-ui/mobile@15.0.0

## 14.1.0

### Minor Changes

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

### Patch Changes

- 06d5ec6: ImportWizard now defaults the "Run automations & triggers" checkbox to ON
  (framework#2922): automations always ran on import before the server honored
  the flag, so preserving behavior means opt-out rather than opt-in. The reset
  path restores the same default.
- Updated dependencies [82441e4]
- Updated dependencies [2efa9fd]
- Updated dependencies [0890fa7]
- Updated dependencies [2ded18c]
- Updated dependencies [e628d1f]
- Updated dependencies [5523fc4]
- Updated dependencies [887062c]
- Updated dependencies [579b24d]
- Updated dependencies [2b30583]
- Updated dependencies [23d65c3]
- Updated dependencies [055e1d2]
- Updated dependencies [9e2d58f]
- Updated dependencies [dea65f7]
- Updated dependencies [f30ff68]
- Updated dependencies [073e7aa]
- Updated dependencies [3e8bf07]
- Updated dependencies [6c0135c]
- Updated dependencies [5b52624]
- Updated dependencies [4afb251]
- Updated dependencies [d5b1bc0]
- Updated dependencies [f94905d]
- Updated dependencies [2712fc1]
- Updated dependencies [f0f10f5]
  - @object-ui/i18n@14.1.0
  - @object-ui/fields@14.1.0
  - @object-ui/core@14.1.0
  - @object-ui/types@14.1.0
  - @object-ui/react@14.1.0
  - @object-ui/components@14.1.0
  - @object-ui/mobile@14.1.0

## 14.0.0

### Patch Changes

- 05e56ca: 导出/导入模板的下载文件名与内容本地化。

  **导出文件名**:CSV/Excel/JSON 导出下载不再是 `<对象名>.<扩展名>`(如 `contracts.csv`),改为「对象显示名-视图名-时间戳.扩展名」(如 `任务-In Progress-20260714-153045.xlsx`);`exportOptions.fileNamePrefix` 配置仍优先(且作为完整前缀,不再追加视图名)。视图名与对象名重复时自动省略;`@object-ui/core` 新增 `buildExportFileName(ext, { prefix, label, objectName, viewLabel }, now?)` 与 `sanitizeFileNameBase(raw)`,ObjectGrid 与 ListView 的所有导出路径(服务端流式与前端兜底)统一走它。app-shell/plugin-view 的 ObjectView 现将当前视图的显示标签写进传给 ListView 的 schema(`label`),使导出文件名能区分同一对象的不同保存视图。

  **导入模板**:「下载模板」修复两处英文漏出——示例行的 select/多选取值改为优先取选项**显示标签**(如 `准备中`)而非 ASCII slug(`prepare`,服务端导入两者都接受);模板文件名本地化为 `{{object}}-导入模板.csv`(新增 i18n key `grid.import.templateFileName`,英文回退 `{{object}}-import-template.csv`)。

- Updated dependencies [443360a]
- Updated dependencies [c70bca7]
- Updated dependencies [86c69c3]
- Updated dependencies [05e56ca]
- Updated dependencies [a44e7b6]
- Updated dependencies [5971cc4]
- Updated dependencies [6a74160]
  - @object-ui/core@14.0.0
  - @object-ui/i18n@14.0.0
  - @object-ui/react@14.0.0
  - @object-ui/types@14.0.0
  - @object-ui/components@14.0.0
  - @object-ui/fields@14.0.0
  - @object-ui/mobile@14.0.0

## 13.2.0

### Minor Changes

- 53c40c2: feat: identity import — the stock ImportWizard now drives sys_user bulk import (framework#2782)

  The Users list gets an Import entry for platform admins (gated on
  `features.admin` from `/api/v1/auth/config` plus workspace-admin), wired to
  the dedicated `POST /api/v1/auth/admin/import-users` pipeline instead of the
  generic data import (which would bypass better-auth hashing and produce
  accounts that can never sign in).

  - **plugin-grid**: two generic, backend-agnostic ImportWizard slots —
    `extraOptionsContent` (host-injected options on the preview step) and
    `renderResultExtra` (host-rendered content on the result step).
  - **app-shell**: identity import dataSource adapter — splits files into the
    endpoint's ≤500-row batches (idempotent upsert makes re-runs safe), injects
    the selected password policy, renumbers per-batch results onto the whole
    file, and enriches rows with their sign-in identity. Password policy panel
    (`none` default / `invite` / `temporary`) and a one-shot temporary-password
    reveal with CSV download (client memory only — nothing is persisted).
    Async-job/undo surfaces are hidden for identity import by design.
  - **auth**: `AuthPublicConfig.features.admin` typing.
  - **i18n**: en/zh strings for the identity import panels.

### Patch Changes

- 80901aa: Honor action `visible` (and `enabled`) predicates in three more action renderers.

  Following the data-table row-action fix, three sibling renderers still rendered schema-defined actions without evaluating their `visible` CEL predicate:

  - **`action:group` dropdown mode** (`@object-ui/components`) — dropdown items ignored `visible`/`enabled`, while the group's inline mode already honored them.
  - **Related-list `list_toolbar` header actions** (`@object-ui/plugin-detail`) — e.g. an organization's "Invite User" button ignored `visible`, even though the sibling row actions (fed by the same `deriveActions` bridge) already honored it via the data-table's `DataTableRowActionItem`.
  - **Grid bulk-action bar** (`@object-ui/plugin-grid`) — `bulkActionDefs.visible` was ignored entirely; the button is now hidden when the predicate is false (the `BulkActionDef.visible` doc comment is corrected from "disables" to "hides" to match).

  Each now evaluates `visible` (and, where applicable, `enabled`) via a hook-safe per-item component that mirrors `RowActionMenuItem` / `DataTableRowActionItem`, resolving `features`/`user` from the ambient `ExpressionProvider` scope. Rendering-layer only — no action definitions changed.

- Updated dependencies [80901aa]
- Updated dependencies [53c40c2]
- Updated dependencies [e492b9d]
  - @object-ui/components@13.2.0
  - @object-ui/i18n@13.2.0
  - @object-ui/fields@13.2.0
  - @object-ui/react@13.2.0
  - @object-ui/types@13.2.0
  - @object-ui/core@13.2.0
  - @object-ui/mobile@13.2.0

## 13.1.0

### Patch Changes

- @object-ui/types@13.1.0
- @object-ui/core@13.1.0
- @object-ui/i18n@13.1.0
- @object-ui/react@13.1.0
- @object-ui/components@13.1.0
- @object-ui/fields@13.1.0
- @object-ui/mobile@13.1.0

## 13.0.0

### Patch Changes

- Updated dependencies [9e38270]
- Updated dependencies [ac04b76]
- Updated dependencies [619097e]
  - @object-ui/i18n@13.0.0
  - @object-ui/components@13.0.0
  - @object-ui/types@13.0.0
  - @object-ui/fields@13.0.0
  - @object-ui/react@13.0.0
  - @object-ui/core@13.0.0
  - @object-ui/mobile@13.0.0

## 12.1.0

### Patch Changes

- Updated dependencies [6cbccf3]
- Updated dependencies [e1840bf]
- Updated dependencies [c31874d]
  - @object-ui/components@12.1.0
  - @object-ui/fields@12.1.0
  - @object-ui/i18n@12.1.0
  - @object-ui/types@12.1.0
  - @object-ui/react@12.1.0
  - @object-ui/core@12.1.0
  - @object-ui/mobile@12.1.0

## 12.0.0

### Patch Changes

- 68e2d1c: Studio UX audit fixes (objectui#2285) — browser walkthrough of the Studio design surface surfaced one rendering bug and several dead-space/discoverability issues; all fixed and re-verified end to end:

  - **Bug — mobile card view showed `[object Object]` for lookup fields.** `ObjectGrid`'s narrow-viewport card layout dumped raw field values through `String(value)` instead of reusing the type-aware cell renderer the desktop table already used; a lookup's expanded object (`{ id, name }`) rendered as the literal string. Now routed through the shared `coerceToSafeValue` helper (newly exported from `@object-ui/fields`, alongside `pickRecordDisplayName`) and a hoisted `renderRecordDetail`, matching the desktop path.
  - **Studio has no responsive/mobile layout.** Below the mobile breakpoint, each pillar's rail (Objects / Flows / Nav tree / Permission sets) now collapses into a toggleable overlay drawer instead of permanently squeezing the canvas into ~190px, and the top pillar-tab bar scrolls horizontally instead of clipping Automations/Interfaces/Access off-screen.
  - **Records tab / Automations canvas had a dead space band.** `ObjectView`'s built-in "+ New" toolbar row (a separate, mostly-empty flex row above the grid) is now folded into the grid's own toolbar via a new optional `onAddRecord` passthrough on `renderListView`; the Automations canvas container now sizes to the pillar's full height instead of its own intrinsic content height.
  - **Automations "fit view" never actually zoomed in.** `fitToView`'s zoom calculation was hard-capped at 100%, so small (2-4 node) flows stayed stranded in a corner of a mostly-blank canvas even after fitting. Removed the artificial cap (now bounded only by the existing `MAX_ZOOM`) and auto-fit once on mount so opening a flow starts appropriately zoomed instead of a fixed 100%/pan-0,0 default.
  - **Validations tab didn't default-select the first rule**, unlike the Access pillar's Permission Set list — now consistent.
  - **HTML/React "source" pages left the Properties panel permanently empty** (no selectable block exists for raw JSX/HTML pages). It now shows a contextual message pointing at the source editor instead of the generic "click a block" empty state.
  - **Permission matrix column headers (C/R/U/D/Tr/Re/Pu/VA/MA) had no visible legend** — added one above the matrix (the header cells' native tooltips stay as-is).
  - **App Builder landing page** widened and given the same icon-badge treatment as Home's app cards, with a 3-column grid on wide screens instead of a narrow fixed-width column stranded in the corner of the viewport.

- Updated dependencies [226fde9]
- Updated dependencies [e36a9c7]
- Updated dependencies [e4de456]
- Updated dependencies [68e2d1c]
  - @object-ui/types@12.0.0
  - @object-ui/core@12.0.0
  - @object-ui/components@12.0.0
  - @object-ui/fields@12.0.0
  - @object-ui/mobile@12.0.0
  - @object-ui/react@12.0.0
  - @object-ui/i18n@12.0.0

## 11.5.0

### Minor Changes

- 1072701: Import wizard: use registered server-side import mappings (framework #2611). When an object has `mapping` metadata artifacts targeting it, the wizard shows a "Saved mapping" selector; picking one hands rename + transforms + write semantics to the server (the artifact is authoritative), replaces the manual column table with a read-only summary of the mapping, and submits `mappingName` over source-header rows (mutually exclusive with the inline column rename). `ImportRequestOptions` gains `mappingName`; the objectstack adapter gains `listImportMappings(objectName)` (feature-detected — the selector simply doesn't appear when unsupported). New `grid.import.*` strings added across all locales.

### Patch Changes

- Updated dependencies [544d8eb]
- Updated dependencies [6fffd3d]
- Updated dependencies [9255686]
- Updated dependencies [fae75e2]
- Updated dependencies [1072701]
  - @object-ui/i18n@11.5.0
  - @object-ui/react@11.5.0
  - @object-ui/components@11.5.0
  - @object-ui/types@11.5.0
  - @object-ui/fields@11.5.0
  - @object-ui/core@11.5.0
  - @object-ui/mobile@11.5.0

## 11.4.0

### Minor Changes

- 144ab55: Consume the ADR-0085 object semantic roles from `@objectstack/spec@11.7.0`, retiring the per-surface hint dialects:

  - **Single-source fieldGroups derivation**: `plugin-form`'s `deriveFieldGroupSections` and `plugin-detail`'s `deriveFieldGroupDetailSections` are now thin adapters over the spec's `deriveFieldGroupLayout` (ADR-0085 §5) — forms, modals and detail pages render the SAME grouping from one implementation. The canonical `collapse: 'none' | 'expanded' | 'collapsed'` enum is honoured everywhere (deprecated `collapsible`/`collapsed` and `defaultExpanded` spellings still read for pre-11.7 metadata).
  - **`stageField` semantic role**: the detail stepper reads the top-level `stageField`; `stageField: false` now actually suppresses stage detection (previously the `false` handling was wired to the removed `detail.stageField` key, so spec-authored `false` fell through to the name heuristic).
  - **`highlightFields` rename**: default grid columns, card compact views, the detail highlight strip, child-record preview fields and interface-page default columns read the object's `highlightFields` (deprecated `compactLayout` spelling read as fallback for pre-11.7 metadata).
  - **Removed dead reads**: the never-spec-writable `objectDef.views.*` UI hints and the ADR-0085-removed `detail.*` block (`sections`, `sectionGroups`, `highlightFields`, `stageField`, `useFieldGroups`, `showReferenceRail`, `hideReferenceRail`, `hideRelatedTab`, `relatedLayout`) are no longer consulted. Per-page customization goes through an assigned Page schema (`record:reference_rail` remains available there as a renderer capability). `detail.renderViaSchema` survives only as the legacy-renderer kill-switch and is removed together with that path.

### Patch Changes

- 1948c5b: fix(plugin-grid): keep the grid's row selection in sync when a bulk-action dialog closes

  Closing a bulk-action result dialog (e.g. 派工 / 下推) on **Done** cleared
  ObjectGrid's `selectedRows` — which drives the selection toolbar — but never
  touched the DataTable's internal checkbox state. Two visible problems:

  - **Desync on success.** The toolbar disappeared while every row stayed visibly
    ticked, because the checkboxes are table-internal state the grid couldn't
    reach.

  - **Lost selection on total failure.** When the run failed for _every_ row
    (0 succeeded — a precondition error, say), the toolbar still vanished,
    stranding the user with no way to retry the exact rows they'd picked.

  The dialog-close handler now gates the reset on `result.succeeded > 0`: a total
  failure keeps both the selection _and_ the toolbar (and skips the phantom
  refetch) so the user can fix the cause and retry. When it does reset, a new
  `selectionResetKey` prop on DataTable clears the internal checkbox selection in
  lockstep with the toolbar, so the two never drift apart.

- 3e42680: fix(plugin-grid): schema-aware multi-value semantics for bulk-edit params (#2204)

  BulkActionDialog was schema-blind: whether a bulk-edit param rendered a
  single- or multi-select — and whether the patch shipped a scalar or an
  array — depended solely on the hand-written `BulkActionParam.multiple`
  flag. A view author targeting a multi-value field (`multiselect`, `tags`,
  `checkboxes`, or `select`/`lookup`/`user`/`file`/`image` with
  `multiple: true`) who forgot the flag got a single-select control and a
  SCALAR patch, silently corrupting the column shape server-side.

  Now the target object's schema is the fallback:

  - ObjectGrid passes its `objectSchema.fields` into BulkActionDialog and
    useBulkExecutor.
  - An explicit `param.multiple` boolean still wins; otherwise `update`
    params derive multi-ness from the field definition via the new
    `isMultiValueField` helper.
  - The executor shape-normalizes every outgoing patch (`run` and `retry`):
    a lone scalar aimed at a multi-value field is wrapped into a
    single-element array — mirroring the server-side guard added in
    framework #2552.

- 2edcaff: Drop the `compactLayout` fallback reads (6 sites: ObjectGrid default columns, deriveHighlightFields, RecordDetailView highlight strip + child preview, ObjectView ×2, InterfaceListPage). The deprecated spelling was retired from the spec by framework#2539 (framework#2536) — served metadata carries `highlightFields` only, so the fallbacks could never fire again; keeping them would teach the retired key to the next reader.
- 9cd9be1: fix(plugin-grid): make the import wizard's preview step readable — wider columns + friendlier validation errors

  Two problems on the import wizard's 预览 (preview) step:

  - **Cramped preview table.** With many mapped columns crammed into the fixed
    dialog width, each header collapsed to one character per line (`关联排班计划`
    stacked vertically) and became unreadable. Columns now get a `min-width` and
    headers no longer wrap, so the preview area scrolls horizontally instead of
    crushing every column.

  - **Unreadable dry-run error messages.** A reference cell that couldn't resolve
    rendered as `第 1 行: product: product: no os_tianshun_ehr_product matches "导管架"`
    — the field named twice, an internal object api-name leaking through, all in
    English. The server already tags each failure with a structured `code`, so we
    now drive the message off that code (localized, with the offending value),
    resolve the field's api-name to its label, and only fall back to the raw
    server text — minus the duplicated prefix — for unrecognized codes. The same
    row now reads `第 1 行: 产品：找不到匹配 "导管架" 的记录`.

- Updated dependencies [8bf6295]
- Updated dependencies [1948c5b]
- Updated dependencies [bce581a]
- Updated dependencies [9cd9be1]
- Updated dependencies [5160832]
- Updated dependencies [69d6b94]
- Updated dependencies [c38d107]
- Updated dependencies [243a9ba]
- Updated dependencies [289be5b]
- Updated dependencies [7782698]
- Updated dependencies [19f2533]
- Updated dependencies [790558b]
- Updated dependencies [09e1b26]
- Updated dependencies [e84d64d]
  - @object-ui/types@11.4.0
  - @object-ui/components@11.4.0
  - @object-ui/fields@11.4.0
  - @object-ui/i18n@11.4.0
  - @object-ui/core@11.4.0
  - @object-ui/mobile@11.4.0
  - @object-ui/react@11.4.0

## 11.3.0

### Patch Changes

- c55a52a: fix(grid): don't open an inline editor for read-only / computed / binary fields

  Inline editing fell back to a plain text box for every field without a
  dedicated widget — including ones you can never author a value for. Found by
  browser-testing the field-zoo: a **Formula**, **Roll-up**, or **Auto Number**
  cell (system-computed) opened an editable text input, as did **File / Image /
  Avatar / Video / Audio / Signature** (binary). Typing into a computed cell is
  meaningless and, if the server accepted it, would clobber the derived value.

  Gate it: a column is marked `editable: false` (which the data-table already
  honors — it won't enter edit mode) when the field is `readonly` or an
  inherently non-authorable type (`formula`, `summary`/`rollup`, `autonumber`,
  `file`, `image`, `avatar`, `video`, `audio`, `signature`). Ordinary types
  (text, number, date, select, boolean, …) are unaffected. Relational/structured
  types (lookup, master-detail, json, …) intentionally keep their text fallback
  for now — they want a proper picker, not a hard read-only lock.

- 2e3e058: feat(grid): inline select editor only offers valid state-machine transitions

  When a field is governed by a `state_machine` validation, the inline cell
  editor now filters its dropdown to the values reachable from the current state
  (the current value plus its declared transitions) — so you can't stage an edit
  the server is bound to reject. Example: a task already `Done` only offers
  `Done` and `In Progress`, not `In Review`.

  This reads the same `validations` metadata the server enforces (already served
  on the object schema), and falls back to showing all options when the field has
  no state machine or its current state is undeclared (mirroring the validation
  engine's lenient allow). Complements the save-failure surfacing — prevent the
  invalid edit at the source, and still report it if one slips through.

- Updated dependencies [d88c8ec]
- Updated dependencies [b7237bb]
- Updated dependencies [d23d6eb]
  - @object-ui/components@11.3.0
  - @object-ui/i18n@11.3.0
  - @object-ui/core@11.3.0
  - @object-ui/fields@11.3.0
  - @object-ui/react@11.3.0
  - @object-ui/types@11.3.0
  - @object-ui/mobile@11.3.0

## 11.2.0

### Patch Changes

- Updated dependencies [9e7a986]
- Updated dependencies [1311749]
  - @object-ui/components@11.2.0
  - @object-ui/core@11.2.0
  - @object-ui/fields@11.2.0
  - @object-ui/react@11.2.0
  - @object-ui/types@11.2.0
  - @object-ui/i18n@11.2.0
  - @object-ui/mobile@11.2.0

## 11.1.0

### Patch Changes

- Updated dependencies [6726a2b]
  - @object-ui/i18n@11.1.0
  - @object-ui/components@11.1.0
  - @object-ui/fields@11.1.0
  - @object-ui/react@11.1.0
  - @object-ui/types@11.1.0
  - @object-ui/core@11.1.0
  - @object-ui/mobile@11.1.0

## 7.3.0

### Patch Changes

- Updated dependencies [788dbf9]
  - @object-ui/fields@7.3.0
  - @object-ui/types@7.3.0
  - @object-ui/core@7.3.0
  - @object-ui/i18n@7.3.0
  - @object-ui/react@7.3.0
  - @object-ui/components@7.3.0
  - @object-ui/mobile@7.3.0

## 7.2.0

### Patch Changes

- 0caea33: fix(grid): list column headers fall back to the field's label, not the prettified machine name

  A view column declared as a bare `{ field: 'request_title' }` (no explicit `label`) rendered
  its header from the prettified machine name ("Request title") even when the field had a
  localized label ("申请标题"). On a non-English app that surfaced English column headers despite
  fully-localized field labels. ObjectGrid now resolves the header as
  `column.label → schema field label → prettified name`, matching the other header-resolution
  sites in the same file. Found dogfooding AI-built Chinese apps.

- Updated dependencies [8e7c1da]
- Updated dependencies [d23db5c]
  - @object-ui/i18n@7.2.0
  - @object-ui/types@7.2.0
  - @object-ui/components@7.2.0
  - @object-ui/fields@7.2.0
  - @object-ui/react@7.2.0
  - @object-ui/core@7.2.0
  - @object-ui/mobile@7.2.0

## 7.1.0

### Patch Changes

- Updated dependencies [677f7ed]
- Updated dependencies [08c47da]
- Updated dependencies [a71be60]
- Updated dependencies [cb03bc3]
  - @object-ui/types@7.1.0
  - @object-ui/core@7.1.0
  - @object-ui/react@7.1.0
  - @object-ui/components@7.1.0
  - @object-ui/fields@7.1.0
  - @object-ui/mobile@7.1.0
  - @object-ui/i18n@7.1.0

## 7.0.0

### Minor Changes

- a00e16d: feat: evaluate CEL `disabled` on action buttons + record-page Undo wiring

  - **components (page header)**: the `record_header` action toolbar now evaluates
    a CEL `disabled` predicate against the record (boolean was the only honoured
    form before), mirroring its existing `visible` evaluation. An action can now
    grey out conditionally (e.g. "Reassign" on a converted lead) instead of only
    hiding via `visible`.
  - **plugin-grid (row menu)**: `RowActionMenu` items likewise evaluate `disabled`
    (boolean or CEL against the row), and skip the click when disabled.
  - **components (action-button)**: forward `undoable` / `recordIdField` when
    executing, so undoable update actions keep their Undo affordance through the
    `action:button` path.
  - **app-shell (RecordDetailView)**: mount `useGlobalUndo` and wire the record
    action runtime's success toast to offer "Undo" for `undoable` actions
    (capturing the changed fields' prior values from the loaded record).
  - **plugin-detail (record:quick_actions)**: the widget's buttons now evaluate a
    CEL `disabled` and show a spinner + disable while running.

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

### Patch Changes

- bd8b054: fix(currency): resolve the tenant default currency across the long-tail renderers

  Phase 2b of the currency-resolution work (ADR-0053). The cell/field renderers
  already funnelled through `resolveFieldCurrency` + `useLocalization` (#1856),
  but the rest of the renderers still hard-coded `USD` or read only one of
  `currency`/`defaultCurrency`. They now share the same resolution chain — explicit
  field currency -> `currencyConfig.defaultCurrency` -> legacy `defaultCurrency` ->
  tenant `localization.currency` -> plain number:

  - `plugin-dashboard` `ObjectMetricWidget` (inferred currency), `ObjectDataTable`
    (symbol-format fallback).
  - `plugin-grid` `useColumnSummary` (footer agrees with the cells) and
    `ObjectGrid` (compact amount + name-inferred currency cells).
  - `plugin-detail` `DetailView` summary metrics.
  - `plugin-gantt` `ObjectGantt` currency tooltips.
  - `components` `element:number` (`format: 'currency'`) — tenant default instead
    of a baked-in `USD`, and renders with the tenant locale.

  `resolveFieldCurrency` now lives in `@object-ui/i18n` (co-located with
  `useLocalization`, which supplies the tenant default); `@object-ui/fields`
  re-exports it, so the existing import path is unchanged. No behavior change when
  no tenant currency is configured — a field that declares its own currency, or a
  deployment with no `localization.currency`, renders exactly as before.

- Updated dependencies [5976ba3]
- Updated dependencies [a00e16d]
- Updated dependencies [eaccefd]
- Updated dependencies [f7f325d]
- Updated dependencies [c12986e]
- Updated dependencies [71d7ce0]
- Updated dependencies [053c948]
- Updated dependencies [89e113c]
- Updated dependencies [ddbe4a2]
- Updated dependencies [2d47e94]
- Updated dependencies [9049bbe]
- Updated dependencies [77cc6bb]
- Updated dependencies [6c0c92c]
- Updated dependencies [97c6831]
- Updated dependencies [cb2fdb1]
- Updated dependencies [c3749eb]
- Updated dependencies [c09f44e]
- Updated dependencies [6cfa330]
- Updated dependencies [ad8ade6]
- Updated dependencies [d54346c]
- Updated dependencies [5332639]
- Updated dependencies [3870c20]
- Updated dependencies [2eb3096]
- Updated dependencies [b88c560]
- Updated dependencies [0ad72a6]
- Updated dependencies [bd398df]
- Updated dependencies [3fa23a7]
- Updated dependencies [18d0339]
- Updated dependencies [66ed3ad]
- Updated dependencies [c6445b6]
- Updated dependencies [80c133c]
- Updated dependencies [5e1b838]
- Updated dependencies [59b6bbb]
- Updated dependencies [d16566f]
- Updated dependencies [90acb7f]
- Updated dependencies [7913390]
- Updated dependencies [514f426]
- Updated dependencies [1394e34]
- Updated dependencies [e95cc25]
- Updated dependencies [abe8ebc]
- Updated dependencies [300d755]
- Updated dependencies [bd8b054]
- Updated dependencies [4eb9cb6]
- Updated dependencies [7c239fd]
- Updated dependencies [858ad94]
- Updated dependencies [2270239]
- Updated dependencies [db8cd00]
- Updated dependencies [2f31406]
- Updated dependencies [18728c1]
- Updated dependencies [8d1195d]
  - @object-ui/core@7.0.0
  - @object-ui/components@7.0.0
  - @object-ui/react@7.0.0
  - @object-ui/i18n@7.0.0
  - @object-ui/types@7.0.0
  - @object-ui/fields@7.0.0
  - @object-ui/mobile@7.0.0

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3
- @object-ui/core@6.2.3
- @object-ui/react@6.2.3
- @object-ui/components@6.2.3
- @object-ui/fields@6.2.3
- @object-ui/mobile@6.2.3

## 6.2.2

### Patch Changes

- Updated dependencies [a66f788]
  - @object-ui/react@6.2.2
  - @object-ui/components@6.2.2
  - @object-ui/fields@6.2.2
  - @object-ui/types@6.2.2
  - @object-ui/core@6.2.2
  - @object-ui/mobile@6.2.2

## 6.2.1

### Patch Changes

- @object-ui/types@6.2.1
- @object-ui/core@6.2.1
- @object-ui/react@6.2.1
- @object-ui/components@6.2.1
- @object-ui/fields@6.2.1
- @object-ui/mobile@6.2.1

## 6.2.0

### Patch Changes

- @object-ui/react@6.2.0
- @object-ui/components@6.2.0
- @object-ui/fields@6.2.0
- @object-ui/types@6.2.0
- @object-ui/core@6.2.0
- @object-ui/mobile@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/core@6.1.0
  - @object-ui/types@6.1.0
  - @object-ui/components@6.1.0
  - @object-ui/fields@6.1.0
  - @object-ui/react@6.1.0
  - @object-ui/mobile@6.1.0

## 6.0.4

### Patch Changes

- @object-ui/types@6.0.4
- @object-ui/core@6.0.4
- @object-ui/react@6.0.4
- @object-ui/components@6.0.4
- @object-ui/fields@6.0.4
- @object-ui/mobile@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3
- @object-ui/core@6.0.3
- @object-ui/react@6.0.3
- @object-ui/components@6.0.3
- @object-ui/fields@6.0.3
- @object-ui/mobile@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2
- @object-ui/core@6.0.2
- @object-ui/react@6.0.2
- @object-ui/components@6.0.2
- @object-ui/fields@6.0.2
- @object-ui/mobile@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1
- @object-ui/core@6.0.1
- @object-ui/react@6.0.1
- @object-ui/components@6.0.1
- @object-ui/fields@6.0.1
- @object-ui/mobile@6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0
- @object-ui/core@6.0.0
- @object-ui/react@6.0.0
- @object-ui/components@6.0.0
- @object-ui/fields@6.0.0
- @object-ui/mobile@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2
- @object-ui/core@5.4.2
- @object-ui/react@5.4.2
- @object-ui/components@5.4.2
- @object-ui/fields@5.4.2
- @object-ui/mobile@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1
- @object-ui/core@5.4.1
- @object-ui/react@5.4.1
- @object-ui/components@5.4.1
- @object-ui/fields@5.4.1
- @object-ui/mobile@5.4.1

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0
  - @object-ui/components@5.4.0
  - @object-ui/core@5.4.0
  - @object-ui/fields@5.4.0
  - @object-ui/mobile@5.4.0
  - @object-ui/react@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2
- @object-ui/core@5.3.2
- @object-ui/react@5.3.2
- @object-ui/components@5.3.2
- @object-ui/fields@5.3.2
- @object-ui/mobile@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1
- @object-ui/core@5.3.1
- @object-ui/react@5.3.1
- @object-ui/components@5.3.1
- @object-ui/fields@5.3.1
- @object-ui/mobile@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0
- @object-ui/core@5.3.0
- @object-ui/react@5.3.0
- @object-ui/components@5.3.0
- @object-ui/fields@5.3.0
- @object-ui/mobile@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1
- @object-ui/core@5.2.1
- @object-ui/react@5.2.1
- @object-ui/components@5.2.1
- @object-ui/fields@5.2.1
- @object-ui/mobile@5.2.1

## 5.2.0

### Minor Changes

- e3160a5: `useBulkExecutor` now collapses an `update` batch into a single
  `dataSource.bulkUpdate(resource, ids, patch)` call when the adapter
  exposes the bulk primitive — turning "mark 500 notifications read"
  from 500 PATCH calls into 1.
  - Adapters without `bulkUpdate` keep working unchanged (per-row path).
  - Single-row batches stay per-row (no win, just overhead).
  - `delete`/`custom` operations are unchanged.
  - On bulk throw, the executor falls back to per-row updates for that
    batch so users still get id-level error attribution.
  - Partial server counts (`succeeded < total`) surface as one aggregate
    error entry per batch — bulk endpoints rarely report per-row failures.
  - Pre-mutation snapshot and `undo()`/`retry()` still work because the
    snapshot is captured client-side before any mutation.

### Patch Changes

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

- 5633edd: feat(detail,grid): tab + selection motion polish

  **plugin-detail**

  - `DetailTabs` and the auto-tabs path in `DetailView` (5 inline
    `<TabsContent>` instances: details, related, activity, discussion,
    history) now fade in when their tab becomes active, eliminating
    the harsh flash when switching tabs.

  **plugin-grid**

  - `BulkActionBar` slides in from the bottom + fades in when a
    selection is made, instead of popping into existence.
  - The "N items selected" counter re-animates on every count change
    (re-keyed on the count value with a small `zoom-in-90`), so users
    see clear feedback as they tick/untick rows. `tabular-nums` keeps
    the number from jittering during the animation.

  All animations are wrapped in `motion-safe:` so prefers-reduced-motion
  users keep the original instant UI. No new deps.

  **Dialog / Sheet motion audit (informational, no code change)**

  Verified `packages/components/src/ui/{dialog,alert-dialog,sheet}.tsx`:
  Dialog + AlertDialog use a consistent `duration-200`. Sheet uses an
  asymmetric `open:500ms / close:300ms` — this is the intentional
  shadcn upstream default ("slower open feels purposeful"). No fixes
  needed; these primitives live in the no-touch zone anyway.

- e919433: Stop silently assuming USD when a currency field has no `currency`
  configured. For non-USD orgs (e.g. a CNY-based CRM seeded without an
  explicit currency) the cells now render as plain locale-formatted
  numbers (`150,000.00`) instead of `$150,000.00` — which was the #1
  "why is my RMB showing as dollars?" bug.

  Behavior change is opt-in via omission: when `currency` /
  `defaultCurrency` is set on the field/column, formatting is unchanged.

  Fixed call sites:

  - `@object-ui/fields`: `formatCurrency`, `formatCompactCurrency`, and
    `CurrencyCellRenderer` no longer default-param `'USD'`.
  - `@object-ui/i18n`: `formatCurrency()` falls back to `formatNumber`
    semantics when `currency` is omitted.
  - `@object-ui/plugin-grid`: column-summary formatter (`Sum: 5,000,000`
    instead of `Sum: $5,000,000.00`).
  - `@object-ui/plugin-detail`: header-highlight currency formatter.
  - `@object-ui/plugin-dashboard`: `ObjectMetricWidget` inferred
    currency now resolves to `undefined` (not `'USD'`) for un-tagged
    fields, so `MetricWidget`'s `isCurrency` heuristic falls through
    to plain number formatting.

- Updated dependencies [de0c5e6]
- Updated dependencies [9997cae]
- Updated dependencies [b2d1704]
- Updated dependencies [6c3f018]
- Updated dependencies [d912a60]
- Updated dependencies [87bc8ff]
- Updated dependencies [3ebba63]
- Updated dependencies [e919433]
- Updated dependencies [a8d12ec]
- Updated dependencies [70b5570]
- Updated dependencies [aa063db]
- Updated dependencies [d9c3bae]
- Updated dependencies [d1442e3]
- Updated dependencies [7c7400a]
  - @object-ui/types@5.2.0
  - @object-ui/core@5.2.0
  - @object-ui/react@5.2.0
  - @object-ui/fields@5.2.0
  - @object-ui/components@5.2.0
  - @object-ui/mobile@5.2.0

## 5.1.1

### Patch Changes

- Updated dependencies [8955b9c]
  - @object-ui/components@5.1.1
  - @object-ui/fields@5.1.1
  - @object-ui/types@5.1.1
  - @object-ui/core@5.1.1
  - @object-ui/react@5.1.1
  - @object-ui/mobile@5.1.1

## 5.1.0

### Patch Changes

- Updated dependencies [bd8447d]
- Updated dependencies [fbd5052]
- Updated dependencies [d51a577]
- Updated dependencies [d1ec6a2]
- Updated dependencies [cf30cc2]
- Updated dependencies [5b80cfd]
- Updated dependencies [d548d6b]
  - @object-ui/components@5.1.0
  - @object-ui/react@5.1.0
  - @object-ui/types@5.1.0
  - @object-ui/core@5.1.0
  - @object-ui/fields@5.1.0
  - @object-ui/mobile@5.1.0

## 5.0.2

### Patch Changes

- cab6a93: **plugin-grid:** column summary footer now formats values using the
  column's type metadata. Currency columns render `Sum: $1,760,000.00`
  instead of bare `Sum: 1,760,000`; percent columns honor `0–1` vs
  `0–100` value ranges; avg uses two fraction digits. `useColumnSummary`
  accepts an optional `fieldMetadata` map (typically `objectSchema.fields`)
  so per-field `type`, `currency`, `defaultCurrency`, `precision` are
  respected.

  **plugin-gantt:** added safe-fallback `useGanttTranslation` hook. All
  hardcoded toolbar `aria-label`s and the `Task Name` / `Start` / `End` /
  `Today` column-header strings now flow through `t('gantt.*')`. A new
  `gantt.*` section is exported from the en/zh/ja/ko/de/fr/es/pt/ru/ar
  locales.

  **app-shell:** `ReportView` no longer hardcodes the `Edit` button label
  or the `Loading report…` fallback — they now use `common.edit` and
  `common.loading`.

  **i18n:** added top-level `gantt` section (with English fallbacks in
  non-en/zh locales) and the `common.addToFavorites` /
  `common.removeFromFavorites` keys across all ten built-in locales so
  the `builtInLocales` parity tests pass.

  - @object-ui/components@5.0.2
  - @object-ui/fields@5.0.2
  - @object-ui/react@5.0.2
  - @object-ui/types@5.0.2
  - @object-ui/core@5.0.2
  - @object-ui/mobile@5.0.2

## 5.0.1

### Patch Changes

- @object-ui/types@5.0.1
- @object-ui/core@5.0.1
- @object-ui/react@5.0.1
- @object-ui/components@5.0.1
- @object-ui/fields@5.0.1
- @object-ui/mobile@5.0.1

## 5.0.0

### Patch Changes

- Updated dependencies [8930b15]
- Updated dependencies [95b6b21]
- Updated dependencies [ddb08a7]
- Updated dependencies [765d50f]
- Updated dependencies [927187a]
- Updated dependencies [bae8ba8]
- Updated dependencies [8435860]
- Updated dependencies [bb2ea48]
- Updated dependencies [b14fe09]
- Updated dependencies [a7bef6e]
- Updated dependencies [74962b0]
- Updated dependencies [3154334]
- Updated dependencies [fa4c2cb]
- Updated dependencies [7213027]
  - @object-ui/components@5.0.0
  - @object-ui/react@5.0.0
  - @object-ui/types@5.0.0
  - @object-ui/fields@5.0.0
  - @object-ui/core@5.0.0
  - @object-ui/mobile@5.0.0

## 4.8.0

### Patch Changes

- @object-ui/types@4.8.0
- @object-ui/core@4.8.0
- @object-ui/react@4.8.0
- @object-ui/components@4.8.0
- @object-ui/fields@4.8.0
- @object-ui/mobile@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0
- @object-ui/core@4.7.0
- @object-ui/react@4.7.0
- @object-ui/components@4.7.0
- @object-ui/fields@4.7.0
- @object-ui/mobile@4.7.0

## 4.6.0

### Minor Changes

- 9aacced: **Bulk actions (Phase 2): cross-page select-all.**

  When the user selects every row on the current page and there are more matching records off-screen, the `BulkActionBar` now surfaces a banner with a "Select all N matching" affordance (Gmail / Salesforce convention). Opting in flips the bar into "all matches" mode and the bulk dispatcher transparently expands the record set by re-issuing the active find against `dataSource` (paged at 500/request, hard-capped at 5000) before handing it to the executor or the consumer's `onBulkDelete` callback.

  - `BulkActionBar` gains `pageSize`, `totalMatching`, `allMatchingSelected`, and `onSelectAllMatching` props.
  - `ObjectGrid` captures `total` + the last find params from `dataSource.find` and resets the cross-page flag whenever the underlying query changes.
  - 7 new `BulkActionBar.test.tsx` cases cover the affordance + Clear interaction.

- 9661d86: **Bulk actions (Phase 2): undo last batch + per-row error inspector.**

  `useBulkExecutor` now snapshots the pre-mutation values for every successful row in an `update` run (limited to keys actually touched by the patch). The dialog's result step exposes:

  - **Undo** — a one-shot button that replays the snapshot through `dataSource.update`, restoring the prior values. Available only for `update` operations where at least one row landed; consumed after a single click so a sticky toast can't double-revert.
  - **Per-row error inspector** — failed rows are listed with an inline **Retry** affordance that re-attempts the original op + params for that record and drops the row from the error list on success.

  Notes:

  - `delete` and `custom` operations never accumulate a snapshot — undoing a delete from the client would silently miss server-side cascades, so the button is hidden up-front.
  - The CSV export of all errors is unchanged.
  - 5 new tests in `useBulkExecutor.test.ts` cover snapshot capture, failure filtering, undo replay, delete no-op, and retry-clears-error.

- 3ee436d: feat(components): add `RelatedCountStore` runtime cache + `useRelatedCount`
  hook (built on `useSyncExternalStore`, no new deps). Replaces
  `PageTabsRenderer`'s local per-instance `derivedCounts` state with a
  shared module-scoped store so multiple consumers of the same
  object/parent pair share a single probe.

  Wires `useBulkExecutor` to call `RelatedCountStore.invalidate(resource)`
  after any successful bulk update/delete, so related-list badges on
  parent records re-probe automatically on the next render instead of
  showing stale counts.

### Patch Changes

- Updated dependencies [3ee436d]
  - @object-ui/components@4.6.0
  - @object-ui/fields@4.6.0
  - @object-ui/types@4.6.0
  - @object-ui/core@4.6.0
  - @object-ui/react@4.6.0
  - @object-ui/mobile@4.6.0

## 4.5.0

### Patch Changes

- Updated dependencies [ab5e281]
- Updated dependencies [d714e85]
- Updated dependencies [6b6afd1]
- Updated dependencies [aa7855f]
- Updated dependencies [170d89f]
  - @object-ui/types@4.5.0
  - @object-ui/fields@4.5.0
  - @object-ui/components@4.5.0
  - @object-ui/core@4.5.0
  - @object-ui/mobile@4.5.0
  - @object-ui/react@4.5.0

## 4.4.0

### Patch Changes

- Updated dependencies [63eb66d]
- Updated dependencies [2bd45af]
  - @object-ui/fields@4.4.0
  - @object-ui/components@4.4.0
  - @object-ui/types@4.4.0
  - @object-ui/core@4.4.0
  - @object-ui/react@4.4.0
  - @object-ui/mobile@4.4.0

## 4.3.1

### Patch Changes

- Updated dependencies [6b683c8]
  - @object-ui/components@4.3.1
  - @object-ui/fields@4.3.1
  - @object-ui/react@4.3.1
  - @object-ui/types@4.3.1
  - @object-ui/core@4.3.1
  - @object-ui/mobile@4.3.1

## 4.3.0

### Patch Changes

- Updated dependencies [4e7bc1b]
- Updated dependencies [8442c05]
  - @object-ui/components@4.3.0
  - @object-ui/fields@4.3.0
  - @object-ui/react@4.3.0
  - @object-ui/types@4.3.0
  - @object-ui/core@4.3.0
  - @object-ui/mobile@4.3.0

## 4.2.1

### Patch Changes

- @object-ui/types@4.2.1
- @object-ui/core@4.2.1
- @object-ui/react@4.2.1
- @object-ui/components@4.2.1
- @object-ui/fields@4.2.1
- @object-ui/mobile@4.2.1

## 4.2.0

### Patch Changes

- @object-ui/components@4.2.0
- @object-ui/fields@4.2.0
- @object-ui/react@4.2.0
- @object-ui/types@4.2.0
- @object-ui/core@4.2.0
- @object-ui/mobile@4.2.0

## 4.1.0

### Patch Changes

- @object-ui/types@4.1.0
- @object-ui/core@4.1.0
- @object-ui/react@4.1.0
- @object-ui/components@4.1.0
- @object-ui/fields@4.1.0
- @object-ui/mobile@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12
- @object-ui/core@4.0.12
- @object-ui/react@4.0.12
- @object-ui/components@4.0.12
- @object-ui/fields@4.0.12
- @object-ui/mobile@4.0.12

## 4.0.11

### Patch Changes

- @object-ui/components@4.0.11
- @object-ui/fields@4.0.11
- @object-ui/react@4.0.11
- @object-ui/types@4.0.11
- @object-ui/core@4.0.11
- @object-ui/mobile@4.0.11

## 4.0.10

### Patch Changes

- @object-ui/types@4.0.10
- @object-ui/core@4.0.10
- @object-ui/react@4.0.10
- @object-ui/components@4.0.10
- @object-ui/fields@4.0.10
- @object-ui/mobile@4.0.10

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9
- @object-ui/core@4.0.9
- @object-ui/react@4.0.9
- @object-ui/components@4.0.9
- @object-ui/fields@4.0.9
- @object-ui/mobile@4.0.9

## 4.0.8

### Patch Changes

- @object-ui/components@4.0.8
- @object-ui/fields@4.0.8
- @object-ui/react@4.0.8
- @object-ui/types@4.0.8
- @object-ui/core@4.0.8
- @object-ui/mobile@4.0.8

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

- Updated dependencies [7c9b85c]
  - @object-ui/core@4.0.7
  - @object-ui/react@4.0.7
  - @object-ui/components@4.0.7
  - @object-ui/fields@4.0.7
  - @object-ui/types@4.0.7
  - @object-ui/mobile@4.0.7

## 4.0.6

### Patch Changes

- 89ae109: Fix click navigation and required-FK form rendering

  - **plugin-grid**: ObjectGrid's `getSelectFields()` now always includes `id` in
    the SELECT projection. Previously, when a view configured `columns` without
    `id`, the SQL driver stripped it from results, and row-click handlers silently
    no-oped because `record.id` was undefined.
  - **plugin-form / fields**: Master-detail fields now render as a single-value
    lookup picker (`LookupField`) in create/edit forms instead of a one-to-many
    related-list widget. From the child-side, master-detail is the FK to the
    parent record and is typically NOT NULL — it must appear in forms. Prior
    behavior dropped it via the auto-layout exclusion list, which caused server
    errors like "NOT NULL constraint failed: contact.account" when users tried
    to create child records.

- Updated dependencies [89ae109]
- Updated dependencies [925051d]
- Updated dependencies [1b6dc64]
  - @object-ui/fields@4.0.6
  - @object-ui/components@4.0.6
  - @object-ui/types@4.0.6
  - @object-ui/core@4.0.6
  - @object-ui/react@4.0.6
  - @object-ui/mobile@4.0.6

## 4.0.5

### Patch Changes

- 1dc6061: fix(build): inline dynamic imports in library outputs

  Library `vite build --lib` outputs were emitting separate code-split chunks
  (`rolldown-runtime-*.js`, `LookupField-*.js`, etc.) when source files used
  `React.lazy()` / dynamic `import()`. When consumer apps re-bundled these
  multi-file dists, the library's per-chunk rolldown-runtime collided with the
  consumer's own runtime, causing "TypeError: i is not a function" at runtime
  when lazy components tried to register themselves (e.g. TextField in
  `@object-ui/fields` after 4.0.4).

  Adding `output.inlineDynamicImports: true` to all `@object-ui/*` library vite
  configs forces a single `dist/index.js` per package, which lets consumer
  bundlers handle the library as an opaque ESM module without identifier
  mismatches across chunks.

  Affected packages: components, fields, layout, plugin-aggrid, plugin-ai,
  plugin-calendar, plugin-charts, plugin-chatbot, plugin-dashboard,
  plugin-designer, plugin-detail, plugin-editor, plugin-form, plugin-gantt,
  plugin-grid, plugin-kanban, plugin-list, plugin-map, plugin-markdown,
  plugin-report, plugin-timeline, plugin-view, plugin-workflow.

- Updated dependencies [1dc6061]
  - @object-ui/components@4.0.5
  - @object-ui/fields@4.0.5
  - @object-ui/types@4.0.5
  - @object-ui/core@4.0.5
  - @object-ui/react@4.0.5
  - @object-ui/mobile@4.0.5

## 4.0.4

### Patch Changes

- d2b6ece: fix: externalize all bare imports in library builds

  Library builds (vite lib mode) now externalize every non-relative import instead of bundling third-party CJS dependencies into the published dist. This avoids inlined `require("react")` / `require("react-dom")` calls that cause `Calling \`require\` for "react" in an environment that doesn't expose the \`require\` function` runtime errors when consumer apps re-bundle the published dist.

  Specifically fixes:

  - `@object-ui/plugin-dashboard` no longer inlines `react-grid-layout` (and its transitive `react-draggable` / `react-resizable` CJS bundles). `react-grid-layout` is now declared as a peer dependency so consumers install a single ESM-friendly copy.
  - `@object-ui/components`, `@object-ui/plugin-calendar`, `@object-ui/plugin-charts`, `@object-ui/plugin-designer` no longer inline `react-i18next` / `i18next` / `use-sync-external-store` CJS shims.
  - All plugin packages now use a unified `external: (id) => !/^[./]/.test(id) && !id.startsWith(__dirname)` rule, ensuring future additions of CJS deps are automatically externalized.

- Updated dependencies [d2b6ece]
  - @object-ui/components@4.0.4
  - @object-ui/fields@4.0.4
  - @object-ui/types@4.0.4
  - @object-ui/core@4.0.4
  - @object-ui/react@4.0.4
  - @object-ui/mobile@4.0.4

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

- Updated dependencies [4be43e2]
  - @object-ui/types@4.0.3
  - @object-ui/core@4.0.3
  - @object-ui/react@4.0.3
  - @object-ui/components@4.0.3
  - @object-ui/fields@4.0.3
  - @object-ui/mobile@4.0.3

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1
- @object-ui/core@4.0.1
- @object-ui/react@4.0.1
- @object-ui/components@4.0.1
- @object-ui/fields@4.0.1
- @object-ui/mobile@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0
  - @object-ui/components@4.0.0
  - @object-ui/core@4.0.0
  - @object-ui/fields@4.0.0
  - @object-ui/mobile@4.0.0
  - @object-ui/react@4.0.0

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

- Updated dependencies [a2d7023]
- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
  - @object-ui/components@3.4.0
  - @object-ui/fields@3.4.0
  - @object-ui/mobile@3.4.0
  - @object-ui/types@3.4.0
  - @object-ui/core@3.4.0
  - @object-ui/react@3.4.0

## 3.3.2

### Patch Changes

- @object-ui/types@3.3.2
- @object-ui/core@3.3.2
- @object-ui/react@3.3.2
- @object-ui/components@3.3.2
- @object-ui/fields@3.3.2
- @object-ui/mobile@3.3.2

## 3.3.1

### Patch Changes

- Updated dependencies [b429568]
  - @object-ui/components@3.3.1
  - @object-ui/fields@3.3.1
  - @object-ui/types@3.3.1
  - @object-ui/core@3.3.1
  - @object-ui/react@3.3.1
  - @object-ui/mobile@3.3.1

## 3.3.0

### Patch Changes

- @object-ui/types@3.3.0
- @object-ui/core@3.3.0
- @object-ui/react@3.3.0
- @object-ui/components@3.3.0
- @object-ui/fields@3.3.0
- @object-ui/mobile@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0
- @object-ui/core@3.2.0
- @object-ui/react@3.2.0
- @object-ui/components@3.2.0
- @object-ui/fields@3.2.0
- @object-ui/mobile@3.2.0

## 3.1.5

### Patch Changes

- @object-ui/react@3.1.5
- @object-ui/components@3.1.5
- @object-ui/fields@3.1.5
- @object-ui/types@3.1.5
- @object-ui/core@3.1.5
- @object-ui/mobile@3.1.5

## 3.1.4

### Patch Changes

- @object-ui/types@3.1.4
- @object-ui/core@3.1.4
- @object-ui/react@3.1.4
- @object-ui/components@3.1.4
- @object-ui/fields@3.1.4
- @object-ui/mobile@3.1.4

## 3.1.3

### Patch Changes

- @object-ui/types@3.1.3
- @object-ui/core@3.1.3
- @object-ui/react@3.1.3
- @object-ui/components@3.1.3
- @object-ui/fields@3.1.3
- @object-ui/mobile@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2
- @object-ui/core@3.1.2
- @object-ui/react@3.1.2
- @object-ui/components@3.1.2
- @object-ui/fields@3.1.2
- @object-ui/mobile@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1
  - @object-ui/components@3.1.1
  - @object-ui/core@3.1.1
  - @object-ui/fields@3.1.1
  - @object-ui/mobile@3.1.1
  - @object-ui/react@3.1.1

## 3.0.3

### Patch Changes

- @object-ui/types@3.0.3
- @object-ui/core@3.0.3
- @object-ui/react@3.0.3
- @object-ui/components@3.0.3
- @object-ui/fields@3.0.3
- @object-ui/mobile@3.0.3

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2
- @object-ui/core@3.0.2
- @object-ui/react@3.0.2
- @object-ui/components@3.0.2
- @object-ui/fields@3.0.2
- @object-ui/mobile@3.0.2

## 3.0.1

### Patch Changes

- Updated dependencies [adf2cc0]
  - @object-ui/react@3.0.1
  - @object-ui/components@3.0.1
  - @object-ui/fields@3.0.1
  - @object-ui/types@3.0.1
  - @object-ui/core@3.0.1
  - @object-ui/mobile@3.0.1

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
  - @object-ui/react@3.0.0
  - @object-ui/components@3.0.0
  - @object-ui/fields@3.0.0
  - @object-ui/mobile@3.0.0

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

### Patch Changes

- Updated dependencies [b859617]
  - @object-ui/types@2.0.0
  - @object-ui/core@2.0.0
  - @object-ui/react@2.0.0
  - @object-ui/components@2.0.0
  - @object-ui/fields@2.0.0

## 0.3.1

### Patch Changes

- Maintenance release - Documentation and build improvements
- Updated dependencies
  - @object-ui/types@0.3.1
  - @object-ui/core@0.3.1
  - @object-ui/react@0.3.1
  - @object-ui/components@0.3.1
  - @object-ui/fields@0.3.1

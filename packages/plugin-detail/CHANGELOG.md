# @object-ui/plugin-detail

## 17.6.0

### Minor Changes

- 279fb13: `ComponentInput.type` can declare a UNION, so a block stops warning about legal
  writes its own description recommends
  
  A registration's `type` was one coarse control kind, while a good number of spec
  keys accept more than one shape. A declaration therefore had to pick an arm, and
  the repo's own manifest gate then reported `type-mismatch` on the other arm's
  legal values. Four of the five measured cases were the loud shape: the input's
  `description` teaches the author to write an inline translation map
  (`{ en, "zh-CN", … }`) while the same input's `type: 'string'` made
  `sdui-parser`'s `checkType` warn about exactly that map — one platform authority
  contradicting itself on the write it had just recommended. Because these land at
  warning severity the page still compiled and rendered; the cost is that noise on
  correct authoring trains authors, AI authors included, to dismiss the
  `unknown-prop` and `type-mismatch` reports that are real.
  
  `type` now accepts an ARRAY of coarse kinds as well as a single one (maintainer
  ruling on objectui#3832, direction (a)), and a value passes the coarse check when
  ANY declared arm accepts it. Both declaration sites in `@object-ui/types` move
  together with the registry's own copy in `@object-ui/core`, and
  `ComponentInputSchema` enforces the same widening — a non-empty array of
  DISTINCT kinds, so an empty arm list or a repeated arm is refused at authoring
  time rather than normalized behind the author's back.
  
  Five declarations now spell their real contract, and the `type-mismatch` warning
  on each of these legal writes is gone:
  
  - `page:header.title`, `page:header.subtitle`, `page:card.title` —
    string **or** inline translation map (the spec's union, measured against
    `ComponentPropsMap` at the pinned rc.6; the renderers resolve both through
    `pickLocalized`);
  - `record:alert.title`, `record:alert.body` — the same two shapes, justified
    against the RENDERER since the pinned spec carries no `record:alert` props
    schema;
  - `element:text_input.defaultValue` — `string | number`, the spec's union,
    which had been narrowed to `'string'` with the number arm named only in prose.
  
  **Backward compatible, and measured as such.** The single-kind form stays valid
  and is still the canonical spelling for a one-arm key: it validates identically
  (the diagnostics for one arm, `invalid-enum` and its `error` severity included,
  are byte-identical), and `manifestFromConfigs` collapses a one-element array back
  to the bare string, so every entry already in a published `sdui.manifest.json`
  serializes unchanged and arrays appear only where a union was really declared.
  The JSX authoring surface follows in the same step — `generateDts` emits a
  TypeScript union for a union input, so the `.d.ts` an author type-checks against
  accepts exactly what the gate accepts.
  
  A union widens what is legal; it does not switch the check off. A value matching
  NO declared arm is still reported, a multi-arm mismatch reports at its strictest
  arm's severity (`error` when an `enum` arm is present, so an enum's closed list
  does not become dismissible by having a second arm added next to it), and arms
  are meant to match the contract rather than relax the gate:
  `element:text_input.defaultValue` deliberately gains no `object` arm because the
  spec rejects a map there, and `element:record_picker.emptyText` keeps its single
  `'string'` arm because that renderer drops the map form (objectui#4163) — an arm
  the renderer never honours would advertise a shape that cannot reach the screen.
- 8b9dc62: `element:text.content` and `element:button.label` declare the inline translation
  map they already accept
  
  Two more instances of the contradiction objectui#3832 fixed the mechanism for,
  measured after that ruling had fixed its scope at five specimens and filed
  separately as objectui#4970. Both inputs' own `description` tells the author to
  write an inline translation map (`{ en, "zh-CN", … }`), both renderers resolve one
  through `pickLocalized`, and both spec props schemas accept one — while the
  declaration said `type: 'string'`, so the manifest gate reported
  `type-mismatch` on the exact shape the block had recommended. Both blocks are in
  `PUBLIC_BLOCKS`, so this reached authors through `sdui.manifest.json` and
  `sdui-intrinsics.d.ts` as well as the save gate.
  
  Each declaration is now `type: ['string', 'object']`, the union form
  objectui#3832 introduced, and the arms are the ones the contract accepts —
  re-measured on the `@objectstack/spec` 17.0.0 GA pin rather than carried over
  from the issue, which was written at the 17.0.0-rc.6 pin:
  `ComponentPropsMap['element:text'].content` and
  `ComponentPropsMap['element:button'].label` are both
  `string | Record< string, string >`, and both refuse a number, a boolean and an
  array. Those three refusals are the controls in the acceptance test, which is
  what keeps a widening distinguishable from a silenced check.
  
  Nothing else about the two blocks moves. A plain-string `content` / `label`
  validates exactly as before, values matching neither arm are still reported, and
  no other manifest entry changes shape — the public manifest now carries seven
  array-valued input types, the five from objectui#3832 plus these two, with the
  remaining 57 public blocks serializing byte for byte as they did.
  
  `record:alert`'s renderer-local prop type is corrected in the same pass
  (`plugin-detail`): its `title` / `body` were still typed `string` while the same
  file resolves both through `pickLocalized` and the block's published `inputs`
  have declared `['string', 'object']` since objectui#3832, so the two slots were
  narrower than both the renderer and the block's own published surface. The type
  is not exported, so no consumer was misled and no published surface changes. The
  CTA's `action.label` one level down is left alone on purpose (objectui#4998):
  `action` is published as a bare `object` whose member shape lives in prose, so
  there are no declared arms for it to be aligned against yet.
- 98eab36: Publish the five `@objectstack/spec` 17.0.0 keys the renderers already honoured, so
  authors can discover them
  
  `page:header.maxVisible`, `page:header.mobileMaxVisible`, `page:tabs.alwaysShowStrip`,
  `record:details.inlineEdit` and `record:details.showHeader` are declared by the spec and
  read by the renderers today, and none of them was in its block's published `inputs`. That
  is the direction nothing reports: `gen-manifest.ts` left all five out of
  `sdui.manifest.json` and `sdui-intrinsics.d.ts`, so they were in no designer panel and no
  generated type; `sdui-parser`'s prop walk reported `unknown-prop` on an author who wrote
  one anyway; and the renderer honoured it regardless. Measured on the console's own
  manifest before this change, all five drew
  
  ```
  unknown-prop: page:header has no prop "maxVisible"
  unknown-prop: page:header has no prop "mobileMaxVisible"
  unknown-prop: page:tabs has no prop "alwaysShowStrip"
  unknown-prop: record:details has no prop "inlineEdit"
  unknown-prop: record:details has no prop "showHeader"
  ```
  
  and now draw nothing. Same defect as `record:details.hideFields` in objectui#3808 and
  `readonly` in objectui#3407; it could not land until the GA pin moved (objectui#4636),
  because the pre-GA pin declared none of the five and publishing them would have failed the
  repo-wide parity gate's forward direction.
  
  Each entry carries a description, because for these keys the discoverability IS the fix.
  Two are worth reading before use:
  
  - `maxVisible` / `mobileMaxVisible` are positive integers — the contract rejects `0` and
    fractional values — and they do not govern every action: an action declaring
    `record_more` without `record_header`, and any action with `component: 'action:menu'`,
    is routed to the overflow menu regardless of the budget.
  - `inlineEdit` is an opt-OUT only. The value is combined with the object's own resolved
    editability (ADR-0103) and with the server's effective API operation set, so `false`
    always wins while `true` cannot open editing the platform refuses.
  
  **`page:tabs` also gains a read.** `alwaysShowStrip` was honoured only as
  `schema.properties.alwaysShowStrip`, while `inputs` publishes TOP-LEVEL keys — the shape
  the manifest whitelists, the generated types declare and the JSX-page compiler validates.
  Measured on a one-tab schema: the wrapped form showed the strip, the flat form did not, so
  publishing the key alone would have advertised a write the renderer throws away. The
  canonical top-level arm is read first now, with the `properties` arm kept for paths that
  reach the renderer without `SchemaRenderer`'s hoist — the same dual read `maxVisible` has
  always had. This can only ever ADD a strip to a one-tab page; multi-tab pages are
  unaffected, and `false` and non-boolean values both read as "not set".
  
  The five GA-pending entries that held this card's place in
  `registry-inputs-spec-parity.test.ts` are deleted, which is what the gate's own
  `carries no stale unpublished-key exemption` check demands once the keys are published.

### Patch Changes

- 7c297e3: Retire `permission_change`, `export`, and `restore` from the audit-log action filter (`AuditLogPage`'s `ACTION_OPTIONS`) and badge maps (`AuditLogPage` and `HistoryTimeline`'s `ACTION_VARIANT`). These three values never had a writer anywhere on the platform, so the filter always returned zero rows for them and the badges never rendered — a visible product defect (audit surface should be narrow-but-honest, not broad-but-lying). `import`, `login`, and `config_change` are kept: `import` has a real writer (`plugin-auth`'s `admin-import-users.ts`) and is still declared by the server enum and filtered by the `config_changes` list view; `login`/`config_change` gained real writers in objectstack#8144/#8145.
- c1ef923: Grid and related-list column headers no longer offer a sort on a `formula` column.
  
  A `formula` value is computed on read: no driver materialises a column for it, so
  a server `$orderby` naming one has nothing to order by. That sort never worked.
  Until objectstack#6994 the platform did not say so — the response carried the very
  values it had been asked to order by, out of order, under a `200`, with ascending
  and descending byte-identical on a real SQL driver — and it now answers
  `400 INVALID_SORT`. So the header was wrong before the platform's refusal and is
  wrong after it, for the same reason: it offers a sort that cannot be performed.
  
  `ObjectGrid` withheld the affordance only from reference-bearing columns
  (objectui#3096). Unmaterialized types are a SECOND reason a server sort is
  impossible, not a different mechanism, so it now reads both — and so do the two
  sort entry points of a related list (the embedded table's headers and the
  sort-button row a `data-list` card keeps), which each derived that rule
  separately.
  
  Client-side sorting is deliberately unchanged. There the rows are all in the
  browser and the formula value is the one the server hydrated on read, so ordering
  by what the cell shows is honest — the same split the relational carve-out makes.
  A sort DECLARED in view metadata is also unchanged: it still goes out and is still
  refused by name, because silently dropping an author's declaration would hide the
  authoring error instead of surfacing it (the toolbar's sort picker keeps such a
  field listed for exactly that reason — it is the only way to remove it).
  
  The membership — `formula` alone — moved out of a private set in `ListView` into
  `@object-ui/core` (`UNMATERIALIZED_FIELD_TYPES` / `isUnmaterializedFieldType`),
  bound to `@objectstack/spec`'s own storage predicate so the renderer cannot drift
  from what the drivers actually store. It is deliberately narrower than the spec's
  write contract `COMPUTED_VALUE_TYPES`: a `summary` and an `autonumber` each get a
  real maintained column and sort correctly, and withholding their headers would
  have broken two affordances that work.
- 5607092: objectui#4029 — the repo root now lints `no-console` (`error`, allowing
  `warn`/`error`) so a stray module- or function-scope `console.log`/`info`/
  `debug` fails CI instead of shipping silently (as `console.log('Registering
  object-map...')` did in #7139, caught only by hand). Landing the rule meant
  individually judging every real hit outside the tooling exemptions
  (`scripts/**`, `**/examples/**`, test files, `packages/cli/src/**`,
  `packages/create-plugin/src/**`) — this changeset covers the published
  packages whose call sites changed:
  
  - `@object-ui/app-shell`: `ObjectDataPage`'s dropped-URL-filter message is a
    real diagnostic (data silently discarded), so it moves from `console.debug`
    to `console.warn` to match the house convention.
  - `@object-ui/plugin-detail`: `DetailView`'s Web Share API failure now reports
    via `console.error` (it is a real failure, not debug noise); a redundant
    "Link copied to clipboard" success log is removed.
  - `@object-ui/fields`: `MasterDetailField`'s `handleView` stub no longer logs
    the item it does nothing with.
  - `@object-ui/runner`: `App`'s loader-selection debug prints, `LayoutRenderer`'s
    unused click-handler stub log, and `MockDataSource`'s per-call narration
    (`find`/`create`/`getObjectSchema`) are removed — none diagnosed a problem,
    they only echoed the happy path.
  - `object-ui` (VS Code extension): the "extension is now active!" activation
    log is removed.
  
  No behavior changes beyond console output. `@object-ui/core` and
  `@object-ui/data-objectstack` also touch `no-console`-adjacent lines
  (`debugLog`/`debugTime`/`debugTimeEnd`, `createQuietHttpLogger`) but only to
  add `eslint-disable-next-line` documentation — those ARE the repo's
  deliberate debug/logger infrastructure, not leaked residue, so their own
  changeset carries empty frontmatter.
- 598c89a: The retired `owner` field-type spelling stops being blessed by the published contract, and inline edit refuses it the way the record form already does.
  
  objectui#4814 retired `owner` as a field type (ruling A′): it was a synonym for
  `user` with zero behavioral delta — both resolved to the same person-picker
  widget — and it was never a member of `@objectstack/spec`'s closed `FieldType`,
  so no object schema could ever declare it. `@object-ui/fields` now answers the
  spelling with a visible tombstone refusal plus a console prescription. That PR
  shrank the three public DOC unions; their CODE twins were left behind, so this
  package spent the interval telling an author "legal" for a word the renderer
  refuses.
  
  **`@object-ui/types` — the three published twins shrink (objectui#4914 items 1-3).**
  `ReportFieldSchema.type` (`zod/reports.zod.ts`) is a RUNTIME validator, so the
  contradiction was executable, not merely advisory: a report document authored
  with `type: 'owner'` validated green and then rendered a refusal. It now fails
  validation, with the issue on the `type` path. Its TS twin `ReportField['type']`
  and `UserFieldMetadata['type']` drop the member in the same batch, so published
  `.d.ts` autocomplete stops offering it. This is an accept-set SHRINK on a
  published validator and a narrowing of two published unions — patch-level
  because the spelling it removes has had no working renderer since #4814, but
  callers still passing `type: 'owner'` will now see a type error and a failed
  parse. The record-owner idiom survives verbatim as
  `{ type: 'user', name: 'owner' }`: the field NAME carries the ownership meaning,
  the type carries the widget.
  
  **`@object-ui/plugin-detail` — inline edit joins the tombstone (objectui#4914 item 5).**
  `InlineFieldInput` routes by a STORED field's actual type, so a record whose
  field is still typed `owner` was getting a working person picker inline while
  the record form showed the refusal — two edit surfaces disagreeing about one
  field, which is worse than either uniform outcome. A retired spelling now
  renders the same `RetiredFieldTombstone` the form does, reported once per
  spelling rather than once per row. The table is read live from
  `@object-ui/fields`, so a future retirement is covered the day it lands.
  
  Measured while implementing, and the reason the refusal is the load-bearing
  half: simply deleting `owner` from the inline routing table would have changed
  nothing an author could see. `hasFieldEditWidget('owner')` is still true — the
  fields package maps `owner: UserField` in `EDIT_WIDGETS` — so the type would
  have reached the same picker down the delegation road instead of the routing
  road. That residual face is outside this change's scope and is filed separately.
- 7dd93c0: `record:quick_actions` reads the toolbar's accessible name under the spelling the ARIA contract accepts, and stops advertising an action fallback it never had.
  
  Two producer-side defects in the same component (objectui#4663), found while
  objectstack#8744 measured this renderer's read points.
  
  **The `aria` read point was dead in both directions.** The toolbar read
  `schema.aria?.label` and nothing else — the ONE spelling `@objectstack/spec`'s
  `AriaPropsSchema` refuses. On that closed shape `label` is an ALIAS ENTRY: a
  rename prescription pointing at `ariaLabel`, there to produce a better rejection
  message, never accepted (measured: `safeParse({ label })` returns
  `unrecognized_keys` naming `label`, while `safeParse({ ariaLabel })` passes). So
  a spec-valid `aria: { ariaLabel: 'Account actions' }` reached the renderer and
  was read by nothing — the built-in "Quick actions" default won every time — and
  the spelling that did work was one no author can write without the contract
  rejecting the document. `SchemaRenderer`'s generic ARIA channel was no escape
  hatch either: it reads the FLAT `schema.ariaLabel` and injects `aria-label` as a
  component prop, which this renderer drops along with every other non-designer
  prop.
  
  The read is now `(aria.ariaLabel ?? aria.label) || 'Quick actions'`. The legacy
  leg is back-compat only, for documents stored before the contract closed;
  canonical wins when both are present. Both halves follow how the repo already
  handles this key: `normalizeListViewSchema`'s aria fold copies the legacy key
  across only when the canonical one is `undefined` (so a declared `ariaLabel: ''`
  shadows a stale `label`), and `ListView`'s own read point treats an empty string
  as no accessible name at all — which here resolves to the built-in default,
  since `role="toolbar"` needs a name.
  
  **The `actionNames` description promised a fallback that exists on no path.** It
  read "(else every action declared for the object at this location)". Measured:
  with no `actionNames` and no host-supplied `actions`, `namesToResolve` is empty,
  `needsLookup` is false, the object metadata is never queried, and the bar renders
  its dashed placeholder. The registry `inputs` are published — they are serialized
  into `sdui.manifest.json` and the JSX authoring types, and Studio teaches authors
  from them — so the promise reached tooling; objectstack#8744's dispatch prompt
  quoted it verbatim as a declared input. Per the triage ruling the sentence is
  what changes: implementing the fallback would be a behaviour expansion and needs
  its own card. No runtime behaviour changes with it, and a regression test now
  drives a LOADED metadata provider to prove the object's declared actions really
  are not pulled in (with a control proving the same wiring delivers them the
  moment a name asks).
- 229b17e: 修复相关列表(`RelatedList`)以 spec 规范拼写 `field` 声明的对象列只出表头、单元格全空的问题(objectui#5022)。
  
  `RelatedList` 的所有身份读点都经由 `columnIdentity` 规范优先解析,因此
  `{ field: 'status', label: 'Status' }` 能通过 FLS 过滤、外键过滤、空列裁剪与排序判定;而它喂给的
  `data-table` 只按 `col.accessorKey || col.name` 归一化访问键,从不读 `field`,于是每个单元格取的是
  `row[undefined]`,渲染成空值占位符 —— 与 objectui#3951 同形,只差一种拼写。
  
  现在 `normalizeColumn` 在把对象列交给表格前,把解析出的身份写回 `accessorKey`:
  词表解析留在 `RelatedList` 一侧,不并入表格适配器(`column-identity.ts` 有意画下的
  `TABLE_ADAPTER_COLUMN_KEY` 边界)。作者已显式声明的 `accessorKey` 不被覆盖,原有拼写一并保留,
  无法解析出身份的条目原样返回。legacy `name` 拼写、字符串列与显式 `accessorKey` 列行为不变。
  
  同一处身份现在同时供给单元格取数与表头排序 —— 此前 `field` 列的表头排序派发的是
  `undefined` 字段(被 `RelatedList` 丢弃),该列在取数与排序两个方向上同时失效。
- dfc6975: Related-list "+ New" now honours `userActions.create` predicates, and the grid
  toolbar's inline-edit affordance is gated on `update` permission (objectui#4646,
  objectui#4647).
  
  Two declared-but-unenforced gaps on the same toolbar surface.
  
  **#4646 — `createPredicates` had a producer and no consumer.**
  `@objectstack/spec@17.0.0` widened `userActions.create` to
  `z.union([z.boolean(), RowCrudActionOverrideSchema])`, so `resolveCrudAffordances`
  emits `createPredicates` — and nothing in objectui read them, against roughly
  fifteen consumption sites apiece for `editPredicates` / `deletePredicates`. The
  symptom: a parent record entering a frozen state correctly greyed its children's
  row Edit/Delete while the related list's "+ New" stayed fully live, so the user
  filled in the whole child form to earn a server 409. The related-list toolbar now
  evaluates `visibleWhen` / `disabledWhen` **once against the host parent record**,
  per the spec docblock's binding for this key, on top of the existing
  `o.create ∧ can(child, 'create')` check. `visibleWhen` hides "+ New" and fails
  CLOSED; `disabledWhen` greys it and fails SOFT — the same evaluator, fail
  directions and hidden-vs-disabled split the record header already uses for
  edit/delete (objectui#4419 / PR #4515). A bare-boolean `userActions.create` is
  untouched: with no predicates there is nothing to evaluate.
  
  **#4647 — the inline-edit toggle was the one ungated affordance on its toolbar.**
  It rendered on "grid view ∧ the host wired `onInlineEditChange` ∧ not the compact
  toolbar", and every host wires that callback unconditionally. New and Import are
  hidden for an account without the grant and the bulk-delete entry on the same
  toolbar ANDs `can(obj, 'delete')`, but a read-only principal could flip inline
  edit, modify cells and press "Save all" to earn a server 403. It is now gated on
  the object's resolved edit affordance ∧ `can(object, 'update')`, mirroring that
  bulk-delete gate. The gate is applied at all three sites that carry this
  affordance — the wide toolbar's toggle, the compact toolbar's settings-popover
  entry (which previously had no gate at all, not even the callback), and the
  `editable` mode handed to the grid, so a stored view carrying `inlineEdit: true`
  can no longer drop a read-only principal into editable cells with no toggle to
  press.
  
  `ListViewSchema.userActions.editInline` is also consumed now: an explicit `false`
  withholds the affordance wholesale, which authors previously could not do.
  
  **Behaviour change for read-only users, stated plainly.** Where the UI used to
  offer inline editing and let the server refuse it, it now declines to offer the
  entry point at all. No data access changes — the server gate was and remains the
  enforcement boundary; this only stops the UI walking users into round-trips
  guaranteed to fail. Accounts *with* the grant see no change, and hosts with no
  `PermissionProvider` mounted (standalone embeds, the Studio designer) keep
  today's behaviour, since `can()` answers `true` there by design.
  
  One deliberate non-change: the absent case of `userActions.editInline` defers to
  the host's existing `inlineEdit` channel rather than enforcing the spec's
  `.default(false)`. Enforcing that default would remove the toggle from every
  stored console list view in one release, since nothing folds a legacy key into
  `editInline` and no existing view declares it. This follows the rule the
  surrounding toolbar-flag block already states for itself — defaults chosen to
  match what the flags have always done. `InterfaceListPage`, the key's other
  consumer, reads the absent case as OFF, because the ADR-0047 interface page has
  no such host channel to defer to.
- Updated dependencies [88085e3]
- Updated dependencies [69251bf]
- Updated dependencies [57e668f]
- Updated dependencies [516663d]
- Updated dependencies [41ac1b7]
- Updated dependencies [1eaf0a1]
- Updated dependencies [a09bc33]
- Updated dependencies [460c4d0]
- Updated dependencies [0ae27f7]
- Updated dependencies [2533ec5]
- Updated dependencies [78c0f9a]
- Updated dependencies [bbe8b86]
- Updated dependencies [8477be5]
- Updated dependencies [279fb13]
- Updated dependencies [2e82ab2]
- Updated dependencies [ad07b65]
- Updated dependencies [41f498b]
- Updated dependencies [ef0d150]
- Updated dependencies [f34226e]
- Updated dependencies [564b605]
- Updated dependencies [e1d4251]
- Updated dependencies [40d3a33]
- Updated dependencies [8b9dc62]
- Updated dependencies [1184192]
- Updated dependencies [a2a9747]
- Updated dependencies [65e88e6]
- Updated dependencies [a1609a6]
- Updated dependencies [53f23bc]
- Updated dependencies [c4533dc]
- Updated dependencies [be60815]
- Updated dependencies [37f6844]
- Updated dependencies [93de4f6]
- Updated dependencies [2b50261]
- Updated dependencies [384f30d]
- Updated dependencies [ac600e5]
- Updated dependencies [97fba31]
- Updated dependencies [232f61a]
- Updated dependencies [d374caf]
- Updated dependencies [5673576]
- Updated dependencies [c1ef923]
- Updated dependencies [911ceaa]
- Updated dependencies [98eab36]
- Updated dependencies [af5e292]
- Updated dependencies [3fbbea1]
- Updated dependencies [0bffb18]
- Updated dependencies [800f455]
- Updated dependencies [5458414]
- Updated dependencies [3241559]
- Updated dependencies [7f96b10]
- Updated dependencies [167ec42]
- Updated dependencies [616a2a5]
- Updated dependencies [6c68b13]
- Updated dependencies [0046d8f]
- Updated dependencies [f1d4748]
- Updated dependencies [bea374e]
- Updated dependencies [b1119ec]
- Updated dependencies [5607092]
- Updated dependencies [9f23d2b]
- Updated dependencies [578e025]
- Updated dependencies [af025ee]
- Updated dependencies [d109a4d]
- Updated dependencies [598c89a]
- Updated dependencies [4a0bd17]
- Updated dependencies [b8b9af4]
- Updated dependencies [d8b9259]
- Updated dependencies [31676be]
- Updated dependencies [8c0d52e]
- Updated dependencies [aff10e2]
- Updated dependencies [70a774b]
- Updated dependencies [9ce096f]
- Updated dependencies [e05db88]
- Updated dependencies [7458a41]
- Updated dependencies [ad13d63]
- Updated dependencies [5ffcc14]
- Updated dependencies [d971e51]
- Updated dependencies [97abb24]
- Updated dependencies [deb157a]
- Updated dependencies [9c60144]
- Updated dependencies [e7747f1]
- Updated dependencies [d2ce342]
- Updated dependencies [9695da7]
- Updated dependencies [ac2f332]
- Updated dependencies [a777058]
- Updated dependencies [75444e3]
- Updated dependencies [58b8346]
- Updated dependencies [2d0bd16]
- Updated dependencies [a9e17b4]
- Updated dependencies [b8ce7dc]
- Updated dependencies [dad51e5]
- Updated dependencies [1c9c342]
- Updated dependencies [787c738]
- Updated dependencies [8396656]
- Updated dependencies [dbbd38a]
- Updated dependencies [61556dc]
- Updated dependencies [8871c14]
- Updated dependencies [93fe362]
- Updated dependencies [dfc6975]
- Updated dependencies [3cf4de0]
- Updated dependencies [c9dc811]
- Updated dependencies [144ef9b]
- Updated dependencies [138ab04]
- Updated dependencies [a0b9e91]
- Updated dependencies [99bd015]
- Updated dependencies [21e4585]
  - @object-ui/types@17.6.0
  - @object-ui/fields@17.6.0
  - @object-ui/i18n@17.6.0
  - @object-ui/react@17.6.0
  - @object-ui/components@17.6.0
  - @object-ui/core@17.6.0
  - @object-ui/permissions@17.6.0

## 17.5.0

### Patch Changes

- ceccdcf: Action confirm dialogs and success toasts now honour the bundle's translated
  `confirmText` / `successMessage`, not just `label` (objectui#4265).

  A TranslationBundle entry for an action carries three keys under one
  `_actions.<name>` node — `label`, `confirmText`, `successMessage` — and
  `useObjectLabel()` has always exposed a resolver for each. What had drifted was
  the call sites: `page:header` (authored record pages), `record:quick_actions`
  and the related-list row menu resolved the button `label` only and dispatched
  the authored `confirmText` / `successMessage` untouched. One bundle entry met
  two fates: the button rendered the translation, the confirm dialog rendered the
  authored English.

  All action-rendering surfaces now go through one resolver,
  `useActionTextLocalizer()` (new, exported from `@object-ui/react`), which
  applies the existing `actionLabel` / `actionConfirm` / `actionSuccess`
  resolvers over the three keys together. Fallback is unchanged: with no bundle
  entry — or an entry lacking a key — the authored text renders. A bundle cannot
  introduce a `confirmText` or `successMessage` the metadata never declared.

- 6d01319: Inline edit no longer offers a record picker for a spec-spelled `autonumber` field that carries a `reference_to`

  `TEXTUAL_REF_FALLBACK_TYPES` — the detail page's one definition of "machine-computed" — spelled the auto-number type `auto_number` only. `@objectstack/spec`, the designer and the metadata importer all spell it `autonumber`, and the set is matched by RAW spelling, so it carried half the type.

  The reader that had no gate in front of it is `InlineFieldInput`'s reference fallback, `!!field.reference_to && !TEXTUAL_REF_FALLBACK_TYPES.has(type)`, on exported public API. A field typed `autonumber` keeps a `reference_to` for relational metadata — which is the entire reason this set exists — so it took the lookup branch and rendered the RECORD PICKER: a searchable list of records offered as replacements for a machine-generated identity. The `auto_number` spelling of the identical field rendered the textual fallback, as intended. Both spellings are now members, matching how `plugin-form` carries both in each of its non-input sets.

  The editability half of the same report (objectui#4219) was already closed from another direction by #4228, whose shared exclusion resolves aliases before matching — a field typed `autonumber` offers no inline affordance in either host. The two gates are a union, so this fix also removes the union's dependence on which spelling the metadata happens to use: previously `autonumber` was held by the exclusion gate alone and `auto_number` by both, and losing either gate would have re-opened a different half of the defect depending on how the field was authored.

  Pins land with it: the reference fallback for `autonumber` (red before this change — the picker really did render), `auto_number` and a real `lookup` as controls in both directions, and set membership asserted directly so the union statement is checked rather than described.

- 63fe8fd: `record:related_list` and the detail synthesizer now declare two shapes they already accepted at runtime.

  `RecordRelatedListRenderer`'s `schema` prop made `objectName` required, which rejected the exact authoring shape the per-element `dataSource` binding exists to support (`{ relationshipField, dataSource: { object, view } }`) — the gate maps the binding onto `objectName` before the body reads it, so the key is supplied, not missing. It is optional on the wrapper's input now, and required everywhere else.

  `ObjectDefLike.fieldGroups` is derived from the spec's authorable field group instead of restating it. The hand-written list had drifted: it omitted `icon` and `description`, both of which the synthesizer passes through to detail section descriptors, so an object definition declaring the group icon the code honours did not type-check against it.

- 3e19fe7: i18n copy: one ellipsis glyph across the ten packs, `usted` in the es draft-preview empty state, and a pt sentence that stops contracting `de` onto its own hole

  Three locale-copy defects that no gate could see, because all three are _value_ defects on keys whose names, placeholders and key sets were already correct.

  **One ellipsis (objectui#3878).** `en` ended 33 values with three ASCII full stops (`Loading...`, `Ask anything...`) and 110 with the typographic ellipsis `…`, and the nine translation packs had copied `en` value by value — so a user could read both glyphs on one screen: `common.loading` beside `dashboard.loading`, `console.ai.askAnything` beside its own panel's siblings. All ten packs now spell it `…` (U+2026), per the maintainer-authorized consistency pass registered on objectstack#6015. 312 pack values changed: 34 in `en` (the 33 trailing plus the one mid-sentence `collaboration.commentPlaceholder`) and 278 across the nine. Eleven inline `defaultValue` call sites were re-synchronised with the new `en` text, which `scripts/check-i18n-call-site-keys.mjs` requires byte-for-byte.

  The convention is now pinned so the split cannot regrow: `packages/i18n/src/__tests__/ellipsis-glyph-3878.test.ts` fails, by key name, on any value in any of the ten packs that holds three ASCII full stops. It is deliberately wider than "a trailing `...` in `en`", because the census showed the narrow rule would have shipped with two holes in it — `collaboration.commentPlaceholder` puts the ellipsis mid-sentence, and `list.loading` had the packs wrong while `en` was already right, which no `en`-only rule can see.

  Fifteen module-local **no-provider fallback** entries were moved with the packs, across `useCollaborationTranslation`, `useFieldTranslation`, `useDetailTranslation`, `ObjectGrid`, `KanbanImpl`, `data-table` and `ConnectionStatus`. Those maps exist to render when no `LocalizationProvider` is mounted, and each one's own docblock requires it to stay byte-identical to the `en` pack — a requirement objectui#3440 already enforces mechanically for the collaboration map. Leaving them behind would have made the provider-less path disagree with the provider path on ten keys.

  **es `usted` (objectui#3875).** `preview.empty.notReadyDescription` said `Revisa la conversación` — the tú imperative — in a namespace that is otherwise 23:1 usted, and it renders _underneath the usted draft-preview banner at the same moment_, not before or after it. `Revisa` → `Revise`; nothing else in the sentence carries a register. The neighbouring `approvalsInbox` namespace is legitimately tú and was left alone.

  **pt contraction (objectui#3877).** `ConcurrentUpdateDialog` splits `detail.concurrentUpdateDescription` on `{{field}}` and renders a bolded label in the gap, and pt left a bare `de` in front of that gap. When the multi-field conflict branch passes the record label (`este registro`), Portuguese users read `de este registro` — a contraction error every native speaker sees, and one that no spelling of the leaf value could fix (`deste registro` renders `de deste registro`). The pt sentence is rewritten so the hole is preceded by the verb `afeta` instead of any preposition, which closes the whole class rather than trading `de` for an `em` or `a` that contract just as hard. pt only; `en` is unchanged.

  No behavior, no keys added or removed, no placeholder changed.

- 6314e87: Inline-editing an `address` on the record detail page now edits it as real sub-fields, instead of collapsing it to one text box reading `[Object]` and saving a string over the structured value.

  `InlineFieldInput`'s type switch routed the scalar and relational families to their dedicated widgets; every structured-object type matched nothing and fell through to the terminal raw text input at the end of the component. That fallback stringifies an object value through `coerceToSafeValue`, whose general-object case extracts `name || label || externalId || id || _id` and otherwise returns the literal `[Object]`. A stored address carries none of those keys, so the edit box read `[Object]`.

  The display half was cosmetic; the write half was not. The fallback is a plain input wired to `onChange(v)`, so whatever the user typed was emitted as a **string** that replaced the whole `{ street, city, state, postalCode, country }` object on save — and `[Object]` was what the user saw as the current value they were correcting, which makes typing over it the natural gesture. An ordinary double-click inline edit therefore destroyed the sub-field structure. This is the input path only: objectui#4037 fixed the display registry, and read mode (including the inline-edit read state before editing starts) already rendered a formatted address.

  `location` and `geolocation` are fixed with it. Both store objects too (`{ latitude, longitude }`), both reached the same terminal input, and both produced the identical `[Object]`-then-overwrite pair — one defect in three spellings, not three defects.

  No new editor was written and no consumer-side tolerance was added. All three route to the widgets the create/edit dialog already uses (`AddressField` / `LocationField` / `GeolocationField`, the form's own structured-value editors), so the two entry points cannot diverge on the value shape they write back, and `coerceToSafeValue` is left untouched — the routing is what stops an address from ever reaching it. `autoFocus` follows the numeric branches' convention and lands on each widget's first sub-input (street / the coordinate box / latitude).

  String-valued types are unchanged: `text`, `textarea`, `email`, `phone`, `url`, `color`, `code`, `time`, `qrcode` and the rest keep the terminal text input, where stringification is the identity and nothing is lost.

- 5e2e9fa: A `password` or `secret` field on the record detail page is no longer inline-editable: it renders no pencil / double-click affordance and produces no editor, on both the details body and the highlights strip.

  Both types are **masked on read** — `getCellRenderer` returns a fixed bullet run for either — so the value the row could hand an editor was never the credential. `InlineFieldInput` had no branch for either type, so both reached the terminal raw text input at the end of the component, and the row's payload value was seeded into a `type="text"` box: rendered in clear, selectable and copyable, in a control the user reads as holding their credential. Committing the row then wrote that placeholder back verbatim over the field. For `secret` the overwritten value is an opaque reference into an encrypted store (ADR-0100), so the write destroyed the pointer, not just the display. Nothing in the flow said so; the failure surfaced later, wherever that credential was used.

  The decision already existed one package over. `INLINE_EXCLUDED_FIELD_TYPES` in `@object-ui/fields` excludes both types with exactly this reasoning, and the grid honours it through `isInlineExcludedFieldType()`. The detail hosts gated on readonly / computed / system only and never consulted it, so the detail page reproduced the precise failure the set exists to prevent. Both hosts now consult that same alias-aware contract (`isInlineExcludedDetailFieldType`, a narrow-only union of the authored and the object type, matching the computed gate under objectui#3355) rather than growing a second hand-maintained list — so the rule cannot drift between the grid and the detail page again.

  Consulting the shared set closes the container family on the detail page with it: `object`, `composite`, `record`, `grid`, `repeater` and `vector` rode the same plain-text fallback with an object-shaped value, and are now excluded too. The spec spelling `autonumber` is likewise excluded, where the detail computed gate only knew the `auto_number` spelling. The heavy-editor family (`markdown`, `html`, `richtext`) loses its one-line text box on the detail page — those are authored in the record form, which has the real editors.

  The binary/attachment family is deliberately exempt and keeps its detail editor. It is in the shared set for a grid-cell reason — a cell cannot host an upload dropzone — while `InlineFieldInput` routes `image` / `avatar` / `signature` / `file` (and the `video` / `audio` spellings) to the same upload widgets the record form uses. That exemption is pinned against the routing it claims, so it cannot outlive it.

  Re-authoring a credential is unchanged and still belongs in the record form, which has the widget for it (`PasswordField`).

- 297534b: Align 43 inline `defaultValue` strings with the `en` pack, and make the call-site gate enforce it (objectui#3810)

  `t(key, { defaultValue: 'English text' })` only renders that text when i18next
  **misses** the key. Where the key exists in `packages/i18n/src/locales/en.ts` the
  pack value always wins, so the inline string is dead code — and 43 of those dead
  strings said something different from the sentence users actually read.

  `scripts/check-i18n-call-site-keys.mjs` (objectui#3530) now compares the two
  whenever a call site carries a literal `defaultValue` for a key `en` defines, and
  fails on any byte of difference. It is a hard rule with **no baseline**: the
  repo-wide census measured 43 sites in 19 files out of 851 literal inline defaults,
  and all 43 are aligned here, so there is no debt for a ratchet to hold. A
  `defaultValue` on a key that is _not_ yet in `en` stays legal — that transition
  runs for months (objectui#3546) and belongs to the existing `missing-key` rule,
  which keeps reporting it alone.

  Every fix moved the CALL SITE to the pack's wording. `en.ts` is untouched: its
  values are what users read today, and changing one would oblige the same change in
  the nine other packs (`scripts/check-i18n-en-drift.mjs`, objectui#3650). Six of the
  43 differed only in an ellipsis (`...` against U+2026) — invisible in review, which
  is how they survived three i18n gates that are each blind to this class by
  construction.

  The visible effect is confined to hosts that render these components with **no**
  `I18nProvider` and no initialised i18next instance. There, react-i18next's
  not-ready `t` returns the `defaultValue`, so the inline string was the rendered
  one; it now matches what a provider-backed app has always shown. Inside the
  console — provider mounted — nothing users see changes. The clearest converging
  examples: the workspaces screen was written as "Organizations" at nine call sites
  while every user has been reading "Workspaces"; the forgot-password success line
  was written as "If an account exists, a reset link has been sent." while the pack
  asserts "We've sent a password reset link to {{email}}."

- e7663f2: fix(detail): inline edit no longer destroys array values or flattens types on the record page

  `InlineFieldInput`'s type switch ended in a raw text input, and every type it had
  no branch for landed there: the value was displayed through `coerceToSafeValue`
  and written back as whatever the user typed — a bare string.

  Two damage classes survived the earlier passes. Array-valued fields (`tags`,
  `checkboxes`, an options-less multi picklist) were offered for editing as
  `"a, b"` — `coerceToSafeValue` joins arrays — and saved back as that string, so
  the array was gone. Type-lossy scalars (`toggle`, `slider`, `progress`,
  `rating`, `radio`) round-tripped through `String()`, so a boolean column
  received `"true"`, a numeric one `"42"`, and `radio` accepted any free-typed
  value its option list never offered.

  Types the switch already routes keep their editors. Everything else that the
  fields package can edit inline now falls back to `FieldEditWidget` — the same
  control the form renders, `json` → the code editor included — and only genuinely
  string-valued types (`text`, `textarea`, `email`, `phone`, `url`) keep the plain
  input. A drift guard asserts every field type is exactly one of routed /
  excluded / delegated / benign, so a new type can no longer inherit the
  value-destroying default in silence.

  `@object-ui/fields`: the four fixed-option widgets no longer clear the stored
  value when the field declares no `options` at all. An empty offered set had two
  opposite causes — a list that cascaded to zero (clear) and a list that was never
  authored (nothing to decide) — and the second deleted the value on mount, which
  the grid's inline cell editor has always been able to trigger. `FieldEditWidget`
  also forwards `autoFocus` to the widget it renders.

- e076fd5: Inline-edit toggle reads "Edit fields" without an I18nProvider, matching every locale pack

  `DETAIL_DEFAULT_TRANSLATIONS` said `Edit fields inline` where all ten packs say
  `Edit fields`, so `InlineEditSaveBar`'s toggle announced two different names for one
  control — the map's on provider-less hosts (standalone embeds, the preview gallery),
  the pack's in the console. The pack wins; the map row now mirrors it byte for byte.

  The three ungated defaults maps (`plugin-detail`, `plugin-list`, `plugin-designer`) are
  now compared key-by-key against the `en` pack by a new gate, generalizing the
  collaboration-only precedent from objectui#3440. `LIST_DEFAULT_TRANSLATIONS` and
  `DESIGNER_DEFAULT_TRANSLATIONS` are exported for it, as `DETAIL_DEFAULT_TRANSLATIONS`
  and `COLLAB_DEFAULT_TRANSLATIONS` already were.

- 456aac8: `@object-ui/plugin-detail` now declares `react-router-dom` as a peer dependency (`^6.0.0 || ^7.0.0`), the range its three siblings already use.

  It has been importing the router all along — `PermissionFacetLink.tsx` and `record-reference-rail.tsx` both take `Link` and `useParams` from it — while its manifest named it in no field at all. That resolved locally for a reason that does not travel: the workspace root declares `react-router-dom` in its own `devDependencies`, so a `node_modules/react-router-dom` symlink exists at the root of this repository and Node's upward directory walk reaches it from every package directory. A consumer's install has no such root, and this package's rollup config externalises every bare specifier, so the published `dist/index.js` carried an import of a package the manifest never asked for.

  Consumers already installing `@object-ui/app-shell`, `@object-ui/layout` or `@object-ui/plugin-designer` were unaffected — all three declare the same peer — so this closes the case of a consumer that pulls `plugin-detail` on its own.

  A new repository gate, `pnpm check:phantom-deps`, now asserts that every bare specifier a released package imports under `src/` is declared by that package rather than merely resolvable from it, so the next one of these fails on the pull request that introduces it (objectui#4394).

- 7d04b0e: `record:details` stops publishing a `layout` key the spec removed and the renderer never honoured

  `record:details` declared `layout: enum ['auto','custom']` with `defaultValue: 'auto'` and the description "auto uses the object highlightFields; custom uses explicit sections". None of that was ever implemented. The renderer's only `schema.layout` read tested `'inline'` | `'compact'` — two values the schema never permitted — so both legal values fell through the same ternary and the key selected nothing. `auto` and `custom` have behaved identically for as long as both have existed.

  Two directions were wrong with zero diagnostics: `layout: 'auto'` plus explicit `sections` still rendered the sections, and `layout: 'custom'` with no sections silently fell back to the flat body rather than reporting the missing groups. Because the input carried a `defaultValue`, this was not stale documentation — it was the manifest, the generated `sdui-intrinsics.d.ts` and the designer panel actively offering the key. An AI author writing `layout: 'custom'` believed it took effect.

  `@objectstack/spec` 17.0.0 removed the property (objectstack#6946, ADR-0087 D2); `17.0.0-rc.6` is pinned here, so the key is already rejected on parse with a named migration message pointing at `os migrate meta --from 16`. This release completes the objectui half of that retirement: the input declaration is gone, and so is the dead `inline`/`compact` branch — the synthesized layout is now the constant it always resolved to.

  Nothing that worked stops working. The body-source contract is unchanged and is now the only one declared: **`sections` renders the explicit groups; omitting it falls back to the flat body derived from the object's fields.** That is pinned in both directions, plus the empty-array boundary between them, in `recordDetailsBodySource.test.tsx`.

  One gate got sharper on the way through. The parity test's "declares no top-level input the spec does not accept" check read raw `.shape` keys — but an ADR-0087 D2 tombstone stays _in_ the shape as a `z.never()`, so a retired key still answers "is this declared?" with yes. That is precisely why this input survived the rc.6 pin bump with every derived gate green. The check now filters tombstoned members out, so it catches the next D2 retirement instead of waving it through.

- c32a8a1: `richtext` fields are placed like the long-form fields they are — four layout sets stopped spelling the type three ways the spec rejects

  `@objectstack/spec` spells the WYSIWYG type `richtext`, one word, and **rejects** `rich_text` and `rich-text`: both exist only as typo keys in the spec's own `suggestFieldType` table, so `FieldSchema` refuses a field declared with either. Four sets that place fields by matching the RAW type string carried nothing else — `SKIP_TYPES` in the related list spelled it `rich_text`, both `WIDE_FIELD_TYPES` and `SECONDARY_FIELD_TYPES` spelled it `rich-text` — so each set was inert for the only spelling a producer can emit, and every one of them named the type it was failing to handle.

  For a real `richtext` field that meant: it was auto-derived into a related-list column, it never spanned the full row in a multi-column detail section or form (unlike `markdown` and `html` sitting right beside it in the same sets), and it stayed in the dense primary section of the record page instead of dropping into "More details". All four move together — half of them would have left the detail page and the form disagreeing about the same field, which is worse than the uniform gap.

  The dead spellings are dropped rather than kept alongside the live one: the alias table is the single place aliases belong, and a set that carries both invites the next drift. The pins are derived from the spec's own `FieldType` vocabulary instead of enumerated, so a member that stops being a real type name fails by name — replacing an assertion that was green only because the set contained the string it asked about.

  `markdown` joins `richtext` and `html` in the related list's `SKIP_TYPES`, on a measurement rather than on the assumption that it renders raw. It does not: markdown and richtext both render through `MarkdownCellRenderer`, formatted and sanitized. The reason none of the three works in a table is that the formatted output is block-level — a heading, paragraphs, a list — inside a single-line truncating cell, so a document shows as one clipped heading with the rest invisible. `textarea` stays derived for the same reason read the other way: it renders as plain truncated text, which is a useful column. Author-declared columns are untouched — this set only filters the zero-config auto-derive walk.

- 3f5f87c: `SchemaRenderer` states its real contract — a typed, required `schema` and a deliberate forwarding surface

  `SchemaRenderer` is the renderer loop: every registered SDUI component is rendered through it. It handed `forwardRef` a props type of `{ schema: SchemaNode } & Record<string, any>`, which puts `string` into `keyof Props`, so `'ref' extends keyof Props` was always true, React's `PropsWithoutRef` took its `Omit` branch, and `Omit` over a type carrying a string index signature keeps only the index signature. Every declared prop was erased. Measured on the pre-fix source: `keyof ComponentProps<typeof SchemaRenderer>` was `string` and `ComponentProps<typeof SchemaRenderer>['schema']` was `any`, while the type argument went on declaring `SchemaNode`. The other half is the same defect seen from the call site — `<SchemaRenderer />` with no schema at all, `<SchemaRenderer schema={12345} />`, and an arbitrary misspelled prop each type-checked in silence. This is objectui#4422 / PR #4438's trap in the most central component in the repo, spelled `Record<string, any>` rather than `[key: string]: any`, which is why every previous sweep's grep and both shipped guards' detector reported the site as clean.

  Graded **minor, not major**, on objectui#4528's reasoning: the type argument has always DECLARED `schema`; the index signature erased it from the resolved type, and restoring what the declaration documents is a fix to the published contract rather than a contract break.

  **The forwarding surface is kept, deliberately.** This component forwards every prop it does not read to the component the schema names, resolved at runtime from a plugin-extensible registry — `packages/react/README.md` documents exactly that, and `@object-ui/components`' form renderer consumes the `onSubmit` it shows being forwarded. Closing that surface would state a false contract and would force every leaf plugin's props into this package. So the two halves are separated: the `forwardRef` type argument is the honest `SchemaRendererProps`, with no index signature for `PropsWithoutRef` to collapse, and the open surface is stated once in an explicit export annotation, which nothing routes through `Omit`. The published `.d.ts` shows the erasure disappearing: `ForwardRefExoticComponent<Omit<{ schema: SchemaNode } & Record<string, any>, "ref"> & RefAttributes<any>>` becomes `ForwardRefExoticComponent<SchemaRendererProps & Record<string, any> & RefAttributes<any>>`.

  `SchemaRendererProps.schema` is declared as `BaseSchema | string | null | undefined` — what this component actually handles. It previously declared `@object-ui/core`'s `SchemaNode` interface, which requires `type: string` and so contradicted the component's own early returns for strings and nullish, while every caller held `@object-ui/types`' wider union. The erasure hid that mismatch completely.

  **One declared behaviour change.** A non-object, non-string primitive schema now renders as its own text. It previously fell through to the shallow copy `{ ...schema }`, which spreads a primitive to an empty object, lost the `type` the renderer then looked up, and surfaced the red "Unknown component type: undefined" box — an accident of the spread rather than a decision. The declared props type excludes `number` / `boolean` so no author is invited to pass them; the runtime handling is defence-in-depth for untyped callers and stored metadata. Strings, `null`, `undefined`, `0` and `false` render exactly as before, and an object naming an unregistered type still gets the error box; all four are pinned.

  Latent defects the erasure had been hiding, each surfaced by the repo-wide type-check and fixed at its call site: `DashboardRenderer` cast its widget schema to `Record<string, any>`, dropping the `type` every branch of `getComponentSchema` sets; `DashboardGridLayout`'s equivalent now states its return type instead of inferring a union that admitted a shape with no `type`; and `ReportViewer` handed a section's `content` array to the renderer whole, so a multi-node section rendered the unknown-component box instead of its content — arrays are mapped rather than widened into the renderer's declared input.

  A repo-wide structural guard replaces the two per-package siblings' blocked direction: it judges every `forwardRef` in `packages/*/src` (219 sites) and its detector resolves `Record<string, …>` and `string`-keyed mapped types in addition to literal index signatures — the spelling the previous detector went blind on. It judges the type argument only, where an index signature is an accidental eraser, and never an export annotation, where one is a stated contract.

- 2fea4d2: `detail.showEmptyRelated` renders Russian and Arabic again — the "+N empty" button no longer falls through to English at the counts it takes most often

  This was the repo's only pre-existing i18next plural family, and all ten packs defined exactly two slots: `_one` and `_other`. i18next asks `Intl.PluralRules` for the one suffix a language needs for that number, and when the pack has no such slot it walks `fallbackLng` to `en`. Russian has four plural categories and Arabic six, so `ru` at counts 2-4 (`few`) and 5-20, 25-30, … (`many`), and `ar` at 0, 2, 3-10 and 11-99, resolved nothing locally and rendered the English string. The call site is the collapsed-empties button in the record detail's reference rail, whose count is the number of empty related lists — 2 to 4 are the most common values it ever takes, so a Russian user essentially always read English.

  The fix is a base key (no suffix) beside the two existing slots, in all ten packs. The base key is always in i18next's lookup chain, so every category a pack did not enumerate resolves to it, in that pack's own language — and, unlike adding `_few`/`_many` to `ru` alone, it keeps the ten packs' key sets identical, which full key parity requires. Same shape objectui#3546 slice six established for `perm.facet.*`. Where the base key is genuinely reachable it carries a count-invariant phrasing: `ru` uses the «Существительное: {{count}}» form the pack already writes 22 times, `ar` the «{{count}} مفرد(جمع)» marker it uses throughout. For `en`/`de`/`zh`/`ja`/`ko` the base key cannot be reached at all (their categories are covered by the two existing slots) and repeats `_other` for parity; `fr`/`es`/`pt` reach it only from a million up, where the plural form is already correct. No English copy moves.

  The provider-less path needed the same row for a different reason: `createSafeTranslation`'s fallback resolves `defaults[key]` literally and never appends a plural suffix, so the two suffixed rows in plugin-detail's defaults table were unreachable through it and that path answered with the raw key. It now carries the base key too.

  Parity across packs turned out to be necessary and not sufficient — ten identical key sets were green throughout, because the defect is one level below key names: the slot the language needs is not in the set. So the invariant "a plural family must carry a base key" is now asserted over all ten packs in `all-locales-key-parity.test.ts`, where it is pack-intrinsic and fails at PR time without needing a call site to exist. It went red on all ten packs before this change and names the family that is missing its base.

- dad805d: Six i18n keys no longer render as raw key strings on hosts with no `I18nProvider` (objectui#4396)

  `detail.saving`, `list.resetSortToDefault`, `appDesigner.widgetProperties`, `appDesigner.addWidget`, `appDesigner.modeEdit` and `common.delete` were read through `createSafeTranslation` without a row in their hook's defaults table and without an inline `defaultValue` at the call site — the only two fallbacks that path has. On a provider-less host (standalone embedding, the preview gallery, host apps that never mount a provider) `fallbackT` therefore returned the key itself, so users saw `detail.saving` in the inline-edit save button, `list.resetSortToDefault` on the sort popover's reset control, `appDesigner.widgetProperties` as the dashboard inspector heading, `appDesigner.addWidget` as its toolbar label, `appDesigner.modeEdit` as a button's accessible name, and `common.delete` on the designer's destructive confirm.

  Each key now has a row in its consumer hook's defaults table, byte-identical to the `en` pack value. No pack was edited, no key added, no call site changed.

- 35997ce: fix(plugin-detail): synthesize page components in the spec's `properties` carrier so Studio page-create can persist

  Creating a page in Studio never completed. The create path seeds a record
  page's `regions` from `buildDefaultPageSchema(objectDef)` and PUTs the result,
  and every node that synthesizer emitted carried its widget props at the TOP
  level of the component — `{ type: 'page:header', recordChrome: true }`,
  `{ type: 'page:tabs', items: [...] }`, and the same for `record:highlights`,
  `record:path`, `record:details`, `record:related_list`, `record:history` and
  `record:reference_rail`. ADR-0089 D3a closed `PageComponentSchema` with
  `.strict()`, so those keys are not stripped, they are a parse error
  (`Unrecognized key(s) on this view/page schema: 'recordChrome', 'actions'`).
  The server refused the body and no page row was ever stored.

  The props now go where the spec declares them — the node's `properties` bag,
  which is where `ComponentPropsMap` defines `page:header.recordChrome` and
  `page:tabs.items` in the first place. Nothing is dropped and nothing changes on
  screen: a header still defaults to record chrome ON, an author's
  `recordChrome: false` is still carried (and now actually persists), the tabs
  keep their items, and `SchemaRenderer` hoists `properties` back onto the node
  before dispatch, so every renderer receives exactly the props it did before.

  One code path does the wrapping for every node the synthesizer builds, so there
  is a single answer to "what may go in a page write". Slot overrides are
  untouched — a node handed in by a caller is still placed verbatim.

- b388950: fix(plugin-detail): the record detail header honors `userActions` predicates

  `userActions.delete` reached the record detail header in its **boolean** form
  but not in its **predicate** form. `userActions: { delete: false }` removed
  Delete from the row kebab, the selection bar and the detail header, because the
  host lowers the boolean into `schema.showDelete`. `userActions: { delete: {
visibleWhen: … } }` reached only the row kebab: the header ANDed
  `schema.showDelete ∧ objectAllowsDelete ∧ canDeleteRecord` and never evaluated
  the predicate, so an author upgrading from "nobody may delete this object" to
  "these records may not be deleted" silently lost the surface they were most
  likely to have tested on.

  The header now folds the per-record predicates in as a fourth conjunct,
  evaluated against the open record through the same helper family the row
  surfaces use — `userActionPredicates` from `@object-ui/core` for the parse (the
  import `RelatedList` already makes) and `useRowPredicate` from
  `@object-ui/react` for the evaluation:

  - `delete.visibleWhen` / `edit.visibleWhen` false → the header affordance is
    hidden (fails closed; `visibleWhen: false` counts as a declared gate).
  - `delete.disabledWhen` / `edit.disabledWhen` true → the header affordance
    renders disabled rather than disappearing, matching the row kebab.

  The existing permission and record-writability gates are unchanged, so a
  predicate that holds can never resurrect a button the user may not press. The
  boolean form stays the host's channel — a bare boolean yields no predicate.

- Updated dependencies [0e67b53]
- Updated dependencies [932cbcd]
- Updated dependencies [734d186]
- Updated dependencies [3fc2971]
- Updated dependencies [f7c6430]
- Updated dependencies [ae10a01]
- Updated dependencies [92876f0]
- Updated dependencies [828549a]
- Updated dependencies [e1ade8f]
- Updated dependencies [3e19fe7]
- Updated dependencies [bb58d1d]
- Updated dependencies [5cc847c]
- Updated dependencies [fa21254]
- Updated dependencies [33c32bf]
- Updated dependencies [66fb4fa]
- Updated dependencies [6d641c9]
- Updated dependencies [45e1949]
- Updated dependencies [92250d6]
- Updated dependencies [58bebf6]
- Updated dependencies [405e808]
- Updated dependencies [c0f9a4b]
- Updated dependencies [ac853ce]
- Updated dependencies [fa51109]
- Updated dependencies [d46f9b8]
- Updated dependencies [2fea4d2]
- Updated dependencies [7f1cb33]
- Updated dependencies [2e3b0c0]
- Updated dependencies [78fa331]
- Updated dependencies [31ab1ac]
- Updated dependencies [0082db8]
- Updated dependencies [06915b0]
- Updated dependencies [ff84b05]
  - @object-ui/i18n@17.5.0

## 17.4.0

### Minor Changes

- ecae400: Retire the `capability-multiselect` field widget name, which existed only on the docs-site registration path and which nothing ever stamped (objectui#3308, ADR-0049 enforce-or-remove)

  `field:capability-multiselect` was registered by `registerFields()` and only there. That function's sole caller is the docs site, so the key never existed on the live path (`registerAllFields()`, run at module import, iterates `fieldWidgetMap` — which never listed it). A field authored with `widget: 'capability-multiselect'` therefore resolved to nothing in every real application, while the comment above the registration described it as usable from a record form: a code comment promising a capability that does not exist, which is the worst direction for a metadata renderer AI-authored apps read as authority.

  Nothing stamped the hint either. ADR-0056 P1 stamps `permission-facet-link` on all six `sys_permission_set` facets — `system_permissions` included — through the single `ObjectStackAdapter.getObjectSchema` choke point, and P2 put the capability editor in Studio. The widget name was a leftover from an intermediate iteration of that rollout.

  Removed, with a tombstone at each site:

  - `@object-ui/fields` — the `field:capability-multiselect` registration and the comment that advertised it. **Breaking in name only**: the key was unreachable outside the docs site, so no application could have resolved it. A field still carrying the hint now degrades to its declared `type` renderer, the defined behavior for an unregistered widget.
  - `@object-ui/plugin-detail` — `InlineFieldInput`'s `widget === 'capability-multiselect'` branch, the hint's last honoring surface. Leaving one consumer for a name no producer emits and no form resolves is the same declared-vs-enforced split, inverted. The sibling `permission-facet-link` branch is untouched and pinned.
  - `@object-ui/components` — the dead `capability-multiselect` entry in the form renderer's `DATA_SOURCE_FIELD_TYPES` set, which could never match a resolvable widget.
  - `@object-ui/plugin-form` — a comment naming `capability-multiselect` as the widget stamped onto `sys_permission_set.system_permissions`; it names `permission-facet-link` now, which is what is actually stamped.

  `CapabilityMultiSelectField` itself is **unchanged and still exported**: Studio's `PermissionMatrixEditor` imports and renders it directly, which is ADR-0056 P2's design. Only the widget name is retired — the component is not a registry field widget and its doc comment now says so.

  `registerFields()` is also **kept**, with its `@deprecated Use registerAllFields() instead` note corrected. The two are not interchangeable: it registers `createFieldRenderer(widget)`, which synthesizes the label, description and the local `value`/`onChange` state that lets a bare field node (`{ type: 'currency', label: 'Amount' }`) render standalone in the docs demos. Retiring it needs a decision about where that demo chrome goes; the note now records that instead of implying a drop-in replacement.

### Patch Changes

- f0a625a: `disabled: ''` no longer greys out the remaining five action surfaces (objectui#3849)

  objectui#3842 / PR #3851 fixed the "is a `disabled` gate DECLARED?" test on
  `action:button` and app-shell's `DeclaredActionsBar`. Five same-shaped sites were
  outside that PR's scope and stayed on `!= null`, so within one component the
  `visible` gate asked `hasDeclaredVisibilityGate` while the `disabled` gate on the
  next line asked `!= null` — two spellings of one question:

  - `@object-ui/components` — `action:icon`, `action:group`'s inline button
    (`InlineActionButton`) and dropdown item (`DropdownActionItem`), and
    `action:menu`'s item (`ActionMenuItem`).
  - `@object-ui/plugin-detail` — `record:quick_actions`' `QuickActionButton`.

  Why the missing `!== ''` half is a defect on this key and not on `visible`:
  `toPredicateInput('')` is `undefined` and `evaluateCondition(undefined)` is
  `true`. On `visible` that `true` means SHOW, so an over-broad "declared" test and
  a permissive empty predicate cancel out. On `disabled` it means DISABLE, so they
  compound — `disabled: ''` (an empty predicate: nothing declared) rendered a
  permanently greyed-out control, with nothing the author could write to un-grey
  it. Unlike #3842's approvals inbox, these five are the general action face
  (toolbars, dropdowns, record quick actions), so the reach is wider even though no
  single high-value host owns them.

  **Behaviour change surface, deliberately narrow.** Only `disabled: ''` changes —
  from disabled to clickable, which is what "no predicate" asked for. `disabled:
true` still disables, `disabled: false` and an absent `disabled` still do not, and
  no expression-valued `disabled` changes verdict. On the four sites that also carry
  the legacy non-spec `enabled` fallback, one consequence follows: an empty
  `disabled` now falls THROUGH to that leg instead of short-circuiting on the empty
  predicate, so an action spelling both (`disabled: ''` + `enabled: true`) becomes
  clickable. `record:quick_actions` has no `enabled` leg, so its chain is the single
  gate.

  Routing those legacy `enabled` legs through the same definition is
  behaviour-preserving by derivation rather than a fix: the leg is negated
  (`disabled = !isEnabled`), so an empty predicate's `true` already arrived as "not
  disabled" — the verdict "no gate declared" produces. #3842's four-shape derivation
  table is reproduced next to the new pins, together with the statement that no
  `enabled` case can go red by reverting that leg.

  `hasDeclaredVisibilityGate` keeps its historic name (the objectui#3842 ruling): the
  predicate is key-neutral, and one implementation behind two names is how a repo
  grows dialects. The three `@object-ui/components` sites import it relatively;
  `record:quick_actions` takes it from the package barrel, the cross-package route
  objectui#3835 opened. Every call site says so in a comment.

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

- 7b3e048: `record:highlights` publishes the `readonly` entry key, so an AI author can discover it from the manifest

  `readonly` on a `fields[]` entry has been enforced for a while — the renderer copies it
  through normalization and `HeaderHighlight`'s editability gate refuses inline editing on a
  chip carrying it (objectstack#5077) — and `@objectstack/spec` declares it on
  `RecordHighlightsField` (objectstack#5176 / PR #5607). The block's own published authoring
  surface never mentioned it: the `fields` input still spelled the entry shape
  `{name,label?,icon?,type?}`, and since the registry `inputs` are what
  `gen-manifest.ts` serializes into `sdui.manifest.json`, an author reading the manifest was
  told the key did not exist. The `fields` description now states the full entry shape and
  what `readonly` does, which is the discoverability the manifest is for.

  `readonly` is documented **inside** the `fields` description rather than declared as an
  input of its own, because that is where the contract puts it. The spec's
  `RecordHighlightsProps` has exactly three top-level keys (`fields`, `layout`, `aria`) and
  carries `readonly` per ENTRY. A top-level `{ name: 'readonly', type: 'boolean' }` input
  would publish a key the platform silently discards: the generated `sdui.manifest.json` and
  `sdui-intrinsics.d.ts` would advertise a `readonly` prop, the manifest gate validates
  top-level props only and would raise no diagnostic, `RecordHighlightsProps` is a plain
  `z.object` so the unknown key is stripped on parse without error, and the renderer — which
  reads `field.readonly` per entry — would never see it. An author who trusted that surface
  would be left with the machine-owned column still hand-editable and no diagnostic anywhere
  explaining why. `ComponentInput` is flat by design, so an array-of-objects input publishes
  its member keys in prose, as `record:path.stages` and `record:alert.action` already do.

  A new spec-parity test derives both directions from `@objectstack/spec` at runtime instead
  of restating today's key list: every key of `RecordHighlightsField`'s object arm must be
  named in the `fields` description, and the block must declare no top-level input that
  `RecordHighlightsProps` does not accept. Nothing previously cross-checked the registry
  `inputs` against the spec, so both drift directions were silent. No runtime behaviour
  changes.

- aca561a: Four spec keys the renderers already honoured are now discoverable from the published `inputs`

  `record:details.hideFields`, `record:related_list.relationshipValueField`,
  `record:related_list.add` and `element:text_input.defaultValue` were declared by
  `@objectstack/spec` and read by their renderers, while the registry `inputs` —
  the surface `gen-manifest.ts` serializes into `sdui.manifest.json` and
  `sdui-intrinsics.d.ts` — never mentioned them. Nothing anywhere reported the
  mismatch, and every layer that reads a manifest said the opposite of the
  runtime: the keys were in no designer panel and no generated `.d.ts`,
  `sdui-parser`'s prop walk returned `unknown-prop` for an author who wrote one,
  and the renderer honoured it regardless. That is objectui#3407's original
  complaint (`readonly` was enforced and honoured, the description just never said
  so) on four more keys.

  Each description is derived from what the renderer actually does, not from
  restating the spec's one-liner, because the two can differ and the published
  text is what an AI author reads:

  - `hideFields` documents bare field names only — the renderer tolerates
    `{name}` / `{field}` entries but the spec is `z.array(z.string())` and rejects
    them, so teaching that spelling would publish a dialect the contract refuses;
  - `relationshipValueField` publishes the renderer's `'id'` default and says that
    the resolved value drives the list filter, the Add-picker link value and the
    pre-filled create form together;
  - `add` publishes its member shape in prose (`ComponentInput` is flat and has no
    member-shape slot) with each default taken from the renderer — including
    `picker.labelField`, where the renderer defaults to `name` while the spec's
    own wording says "the object title field". It also names `picker.filter` as a
    KNOWN GAP rather than documenting it as a restriction: the spec declares it
    and nothing reads it, so an author would otherwise believe their picker is
    scoped when it offers every record (objectui#3831);
  - `defaultValue` distinguishes the two behaviours an author can get — seeding a
    bound page variable once while it is still empty, versus the native
    uncontrolled initial value with no variable bound.

  `element:text_input` is not in the public tier, so its gap was not in
  `sdui.manifest.json` at all — it was in the JSX-page compiler's prop whitelist,
  which `renderers/layout/page.tsx` builds from `getKnownTypes()` plus these same
  `inputs`, making the undeclared `defaultValue` a live `unknown-prop` warning.

  The repo-wide parity gate now runs in both directions over one covered set and
  one exemption discipline, so neither direction can be forgotten again the way
  the reverse half was after PR #3806. Nine spec keys stay deliberately
  unpublished, each with a written reason and a tracking issue: two the renderers
  do not read at all (objectui#3829), three retired upstream by ADR-0087
  tombstones, `page:tabs.type` (a carrier collision, objectstack#6776), two
  `targetVariable` declarative hints (objectui#3834), and
  `element:record_picker.filter` (objectui#3830).

- 6d762da: The five locale keys behind #3546's eight no-fallback `t()` call sites are now defined in all ten packs, so the built-in-view toasts, the activity-timeline source link, the wizard's required-field toast and the Gantt refresh button's accessible name are translated instead of falling back to English — or, on two surfaces, to the key itself (part of #3546).

  `scripts/check-i18n-call-site-keys.mjs` measured 258 keys that a `t()` call site asks for and no pack defines. These five were the subset with no working inline default: `console.objectView.cannotEditMetaView`, `console.objectView.cannotDeleteMetaView`, `detail.viewSource`, `gantt.toolbar.refresh` and `wizard.missingRequired`. Adding a `defaultValue` is deliberately not the fix — that mechanism is what kept all 258 invisible for months.

  **Two of the eight sites really did render the raw key**, and both go through a binding with nothing in front of i18next. `ObjectView.tsx` calls `useObjectTranslation()` directly, so five toasts read `console.objectView.cannotEditMetaView` / `cannotDeleteMetaView` on screen; the `|| 'Built-in views cannot be renamed.'` guards next to them were dead on every path, because i18next answers a miss with the key itself and a non-empty string never falls through `||`. Those four unreachable English strings are removed rather than repaired: one key served four call sites (rename / pin / set-as-default / configure), so the pack copy covers any change to a built-in view instead of naming one operation. `RecordActivityTimeline.tsx` fails the same way for a subtler reason — `useDetailTranslation` is `createSafeTranslation(..., 'detail.back')`, and because `detail.back` does resolve, the probe hands back i18next's `t` for every key and bypasses the defaults map wholesale, so `detail.viewSource` reached the user verbatim.

  **The other two sites were not rendering a raw key**, contrary to the issue's description, and are fixed here as the milder "English in all ten languages" class. `wizard.missingRequired` is its own hook's probe key, so the probe failed and `createSafeTranslation` correctly served its English default. `gantt.toolbar.refresh` goes through `useGanttTranslation`, which deliberately does not use `createSafeTranslation` and falls back per key — so the refresh button's `aria-label` was "Refresh", in English, never the key. Screen-reader users heard an English word rather than an identifier; a `zh` session now hears 刷新.

  Regression cover is provider-mounted on purpose: with no `I18nProvider` the defaults maps answer every one of these keys and the assertions pass while the console is broken, which is precisely the false-green the issue documents. For the two sites whose English output was already correct, `en` cannot discriminate before from after — the `zh` assertions are the ones that pin the fix.

- 4178d5a: `record:details` 的 `sections` 输入说明改为从 spec 形状派生的对象形,不再教已被退役的「Section IDs」

  `inputs` 不是文档,而是发布出去的编写契约:`gen-manifest.ts` 把它序列化进
  `sdui.manifest.json`(保存门 + parser 白名单)和 `sdui-intrinsics.d.ts`。而
  `record:details.sections` 的说明写的是 `Section IDs to show (required when layout
is "custom")` —— 那是 17.x 以前的形状。pin 版 `@objectstack/spec@17.0.0-rc.5` 的
  `RecordDetailsProps.sections` 是对象数组 `{ name?, label?, columns?, fields }`,
  objectstack#5611 把 `z.array(z.string())` 那条拼法**删掉**而不是 union 进来(既无
  producer 也无 consumer,一种形状而不是两套事实契约)。

  照旧说明写 `sections: ['contact_info', 'address']` 的作者,在四层之间拿不到任何
  诊断:`['a','b']` 对 manifest 门是合法 `array`(门只看顶层键名 + 粗类型),上游
  `validateComponentProps` 是 advisory 级,spec 只在真的走 parse 的路径上才拒,而
  `RecordDetailsRenderer` 对每个条目读 `s.name` / `s.label` / `s.fields` —— 字符串上
  三者全 `undefined`,该 section 一个字段都不渲染。`layout: 'custom'` 时 sections 是
  详情页正文的唯一来源,所以结果是一张没有报错的空白详情页。

  新说明逐键派生自 spec 各成员的 `.describe()` 与渲染器实读:`fields` 必填、按序渲染;
  `label` 是标题(省略即无标题、无边框);`name` 是 snake_case 稳定标识与 i18n 锚点
  (标题走 `objects.{object}._sections.{name}.label`);`columns`(1-4)是本 section 的
  字段栅格宽度,省略则由渲染器推导;并明确写出字符串条目不被接受。渲染器另外还认的
  `title` / `showBorder` / `hideEmpty` **故意不写进说明** —— spec 的 section 对象没有
  声明它们,parse 时会被静默剥掉,发布它们等于教作者写契约丢弃的键。

  同时新增 `recordDetailsInputs.spec-parity.test.ts`:两个方向的断言都在运行时从 spec
  schema 派生(每个 spec 成员键都能从说明里发现;本 block 不声明 spec 不接受的顶层
  input),所以下一次 spec 变形会先让测试红,而不是又一次静默张开。仅说明文本变化,无
  运行时行为改动。

- 54233b1: Record detail pages: a header ⟳ that refreshes the record, its related lists and its tab counts in place — no browser reload

  Concurrent-editing scenario from the shop floor (MES work orders): operator A sits on a record's detail page while operator B starts or reports the same order. A had no way to see the new state except F5, which throws away the open tab, the scroll position and any in-progress inline edit along with the stale data.

  The pipeline for this already existed — the objectui#2269 invalidation bus refetches every mounted reader in place, and `RecordContext.refresh` had been declared for it — but nothing produced that field and no UI reached for it. Three changes give it a trigger:

  - **`RecordDetailView` produces `RecordContext.refresh`**, publishing `notifyDataChanged({ objectName: '*' })`. The wildcard is deliberate: a user reaches for refresh because of a write made by SOMEONE ELSE, which this client never saw and therefore cannot attribute to particular objects. `'*'` marks everything mounted as stale, so the main record, every related child list and the tab-count badges all refetch — no remount, so tab / scroll / draft state survive. First phase covers the standalone record route; embedded hosts (list drawer, split-pane preview) keep their existing chrome unchanged.
  - **`page:header` renders the ⟳** at the far end of the header row when — and only when — the host provides `refresh`. It is page chrome rather than a header action, so its position is the same on every record page regardless of which business actions the object declares, and it can never be collapsed into the `⋯` overflow. Styled as that `⋯` trigger's twin so the row reads as one button family. Its accessible name and tooltip come from the existing `common.refresh` key, so the icon-only button is not English-only in the other nine locales. The icon spins for a short floor after a click, because the bus is fire-and-forget and a warm backend would otherwise finish before the click looked like it landed.
  - **`RelatedList` accepts the `'*'` wildcard** on the legacy `objectui:related-changed` event, matching what `dataChangeMatches` already does for the bus's own readers. This listener compared the payload's object name to its own, so a wildcard invalidation reached everything on the page except the related lists — a concrete foreign object name is still ignored.

  Hosts that provide no `refresh` render exactly as before.

- c2ecbae: 相关列表 Add 选择器兑现 `add.picker.filter`:作者限定的候选范围现在真的生效

  `record:related_list.add.picker.filter` 被 spec 声明为「Restrict which records the picker offers」,但渲染器从未读过它 —— 挂 `RecordPickerDialog` 时不传任何 filter,对话框照样提供 `picker.object` 的全部记录,选中即建链接行或改父,`os validate` / `os build` 全绿、运行时零诊断。作者写下「只允许指派 active 的岗位」「只允许挂未过期的许可」,得到的是完整候选列表。

  现在它按原样传给 `RecordPickerDialog` 的 `baseFilter` —— 不是 `lookupFilters`,后者会把条件渲染成用户可编辑的筛选栏行,等于把作者的硬性限制降级成建议。

  `baseFilter` 因此接受两种形状,按结构判别(`Array.isArray`):

  - **`QueryParams.$filter` 记录形式**(依赖型 lookup 链)保持原有的键覆盖语义逐字节不变 —— 级联父值必须**替换**同字段上过期的 `lookupFilters` 条目,而不是与之求交。
  - **spec 的 `ViewFilterRule[]`** 经 `mergeFilterNodes`(仓内唯一的 filter 下沉口)下沉,19 个 operator 全部无损到达服务端,包括记录形式没有 `$op` 可用的 `before` / `after` / `is_empty` / `is_not_empty`。此处**不新增**第二份 operator 词汇表。

  槽位类型同时从 `Record<string, any>` 收紧为 `unknown`:前者会接受规则数组(数组满足 `any` 的字符串索引),旧的对象展开再把它压成 `{"0": {...}}`,于是查询去过滤名为 `0` 的列 —— 类型全绿、查询错误、无任何诊断。

- acc34c5: `record:related_list`: an `add` without `add.picker` no longer takes the whole related list down.

  The Add-picker gate compared only `add` for truthiness and then read `add.picker.object` bare, so page metadata declaring `add` but omitting the (spec-required) `picker` threw during render and `SchemaRenderer` replaced the entire related list with a "Component failed to render" card whose message never mentioned `picker`. Both the Add button and the picker dialog now gate on the resolved `add.picker.object` — the list body renders as usual, only the unconfigured Add affordance is withheld, and a console hint names the missing key. Off-spec `add` still does nothing, so no lenient second dialect is introduced; producing-side validation of page metadata is tracked separately.

- c4768a7: `record:related_list` — the declared `filter` reaches the query, and the Add button answers to the same gate as its dialog

  - **`filter` is consumed** (objectstack#7118). The spec declares
    `RecordRelatedListProps.filter` ("additional filter criteria") and this repo
    published it as a registry input, but nothing read it: `RelatedList` built its
    query from `{ [relationshipField]: parentId }` alone, so an authored filter was
    accepted by every gate and silently dropped — the list answered with every child
    of the parent. It is now AND-combined with the parent condition (never
    substituted for it, so an additional criterion can only narrow), lowered through
    the repo's single filter sink so the spec's `[{ field, operator, value }]`
    vocabulary and a composed `dataSource` binding both work. With nothing authored
    the query is unchanged. As a consequence a saved view named through
    `dataSource: { object, view }` no longer contributes its columns/sort/limit while
    its filter is discarded — the list can no longer be wider than the view it names.
    On the legacy raw-URL fallback path, which cannot express an operator, a declared
    filter is refused with a console explanation instead of dropped.
  - **The Add button now requires `dataSource`** (objectui#3895), matching the picker
    dialog and the add callback. In hosts that supply no `RecordContext` — Studio
    designer previews, context-free embeds — the button rendered and did nothing at
    all when clicked; the affordance is now withheld where the capability behind it
    is absent.

- Updated dependencies [7864f03]
- Updated dependencies [f5f8744]
- Updated dependencies [69becd2]
- Updated dependencies [5e52495]
- Updated dependencies [b750823]
- Updated dependencies [ac2139c]
- Updated dependencies [b14ab3a]
- Updated dependencies [8c60819]
- Updated dependencies [e64a52e]
- Updated dependencies [844d17f]
- Updated dependencies [4dcd52a]
- Updated dependencies [42ae5c6]
- Updated dependencies [6d762da]
- Updated dependencies [f9faa7d]
- Updated dependencies [33526fd]
- Updated dependencies [32413ec]
  - @object-ui/i18n@17.4.0

## 17.3.0

### Minor Changes

- 5af2852: The record detail page now shows a read-gated approval panel (#3461). A record in approval used to expose NOTHING about the running approval to anyone but the current pending approver — `useRecordApprovals` was consumed solely to inject the header Approve/Reject buttons, while the pending-approver list, decision progress, and the `sys_approval_action` timeline existed only in the Approval Center's drawer, a `setup`-app surface that business roles can't navigate to (and whose backing object is tenant-wide, so granting read there is over-broad). The submitter couldn't tell whom to nudge; the record's own audit history was no help either, since the engine mirrors business fields as `runAs:'system'` and decisions never enter record history. The new surface is an **Approvals tab** on the record page — a peer of Details/Related (same promotion Attachments got in objectstack#4358), emitted by `buildDefaultTabs` only when the record actually has requests, with a request-count badge and the label localizing through the tab strip's KNOWN_LABEL_DICT (审批). The tab wraps the new `record:approvals` node (`RecordApprovalsPanel`), visible to EVERY viewer who can read the record: current flow/step with the enriched flow-steps strip, server-computed decision progress (quorum tally, per-group 会签 ticks), the waiting-on chips with server-resolved names and group labels (never raw ids), one chronological action timeline merged across all of the record's requests (a multi-level flow opens one request per node), decision comments and attachments, and an inline remind button for the submitter (`viewer.is_submitter`, with an id-match fallback for older backends) that POSTs the existing `/approvals/requests/:id/remind`. The host threads its live `useRecordApprovals` read through the node so the tab and the header decision buttons never disagree; on authored pages the `record:approvals` renderer self-fetches, and an authored page that omits the node gets a bottom-of-page fallback append so the approval story is never lost to a custom layout. Copy reuses the Approval Center's `approvalsInbox.*` keys so the two surfaces can't drift; `useRecordApprovals` now exposes the full `requests` array plus `listApprovalActions` / `remindApprovalRequest`, and its `ApprovalRequestLite` carries the display enrichment (`process_label`, `step_label`, `flow_steps`, `viewer`, `round`) the single-read endpoint already sent.

### Patch Changes

- 532cf8b: Deliver the required state to the control in the five renderers outside the object form that still painted it as an asterisk only (objectui#3299 — the same defect #3290/#3298 fixed in `form.tsx`).

  Each site converges on the reference shape (`EmbeddableForm.tsx`): the control carries `aria-required={required || undefined}` and the asterisk is `aria-hidden="true"`, so assistive tech announces required once, as a state — instead of hearing a bare "asterisk" folded into the accessible name, or nothing at all.

  - `@object-ui/app-shell` — `ActionParamDialog` (both the boolean row and the default branch, delivered through the real field widgets' `toDomProps` whitelist) and `CreateViewDialog` (display label, machine name, and every type-specific required-field selector).
  - `@object-ui/components` — the custom `ActionParamDialog` (all five typed branches, including the Radix select trigger) and `FieldContainer`, whose existing Slot injection (`id` / `aria-describedby` / `aria-invalid`) now also injects `aria-required`, covering every consumer in one place.
  - `@object-ui/plugin-detail` — `InlineCreateRelated`'s create-tab inputs.

  Deliberately NOT the native `required` attribute (#3290 ruling): each of these hosts runs its own validation, and native `required` would arm the browser's constraint-validation bubble beside it. The SDUI controls that already use native `required` (`renderers/form/{input,textarea,select,checkbox}.tsx`, `basic/text-input.tsx`) are unchanged — they don't have a second validator, so their channel is already correct.

- b71fc92: Localize the last untranslated console-chrome accessible names (objectstack#5430)

  Four icon-only controls still carried hardcoded English accessible names, so
  under a non-English session they were the only English left in the record
  chrome — and because the controls have no visible label, that literal _is_ the
  control to a screen reader and to the hover tooltip.

  - `page:header`'s `role="toolbar"` — now `detail.pageHeaderActions` (its `⋯`
    overflow trigger eight lines below was fixed in #5407; the toolbar was missed)
  - `ReactionPicker`'s `role="listbox"` popup — now `detail.emojiPicker`
  - `ReactionPicker`'s per-reaction chip, which built its name by concatenation
    with English pluralization baked in (`reaction${count !== 1 ? 's' : ''}`) —
    now `detail.reactionCount` / `detail.reactionCountOne`
  - `NavigationOverlay`'s drawer close and split-panel close — now `common.close`
    (the key the rest of the console already uses) and `common.closePanel`

  The pluralized label follows this repo's **two-key** convention
  (`detail.relatedRecords`/`relatedRecordOne`, `lookup.recordCount`/`recordCountOne`)
  rather than an i18next `_one`/`_other` pair: zh/ja/ko have no separate singular
  form, so those packs would legitimately omit the `_one` half and
  `all-locales-key-parity` would read that as a lost key.

  All five new keys are added to all ten locale packs.

- 3889ffb: Console chrome i18n gaps (objectstack#5407).

  - A dependency-gated lookup now names its controlling field by its **label**
    instead of its raw API name. The sentence was localized but the interpolated
    name was not, so every locale — English included — read `Select crm_account
first`. The form renderer passes a new `dependsOnLabels` widget prop (the
    lookup-side counterpart of `emptyHint`, which it already resolves to labels
    for the fixed-option widgets); a name the host does not cover still falls
    back to itself.
  - The page-header overflow trigger's `More actions` accessible name now reads
    `detail.moreActions`, the same key `action:menu`'s own overflow trigger uses,
    so the two cannot diverge per locale.
  - The activity-feed reaction button's `Add reaction` accessible name is now a
    bundle key (`detail.addReaction`, added to all ten packs).
  - The "check the highlighted fields" toast joins field names with a per-locale
    separator (`validation.formInvalidJoiner`) instead of a hardcoded `、`
    (U+3001) — right for zh/ja by accident, wrong in English and every Latin
    locale. Latin packs use `, `, CJK `、`, Arabic `، `.
  - The Spanish `validation.required` / `validation.unique` templates gained
    their own masculine head noun (`El campo {{field}} es obligatorio`) so the
    adjective agrees for feminine field labels too — `Cuenta es obligatorio` was
    ungrammatical.

- bbbde12: Behavior change — **an authored display `type` can NARROW inline editability, but never WIDEN it** (objectui#3355).

  Both detail-surface editability gates (`HeaderHighlight`, the `record:highlights` strip; `DetailSection`, the details body) used to resolve ONE effective type with display precedence — `viewFieldType || objectFieldType`. An authored non-computed `type` therefore ERASED the object's `formula` / `summary` / `rollup` / `auto_number` declaration from the gate's view, and a machine-owned column became inline-editable.

  The gate now reads the two types separately and takes their UNION: a field is non-editable if the authored entry type **or** the object field's type is computed. Renderer/editor selection keeps the old precedence, so nothing about the display changes — only who may write.

  What flips:

  - `{ name: 'supply_share', type: 'number' }` authored over an object field declared `rollup` (or `formula` / `summary` / `auto_number`) — a display override written to fix formatting — no longer offers a pencil / double-click editor. This is the shipped configuration behind objectstack-ai/objectstack#5077: a hook-maintained rollup was overwritten by hand from the header strip and stayed corrupted until an unrelated child-row touch re-fired it (downstream yinlianghui/hotcrm-heimao#61).
  - Narrowing is unchanged: an authored `type: 'formula'` still locks a plain object column.
  - Fields with no authored computed type over a plain object column stay editable, and the entry-level `readonly` declaration from objectui#3356 is still honored.

  The object schema is authoritative about what is machine-computed; a presentation override has no business granting write access. The rule now lives in ONE shared helper, `isComputedFieldType` in `fieldEnrichment.ts` — beside `enrichDetailField`, the module both hosts already share — with the computed-type set moved there too (still re-exported as `TEXTUAL_REF_FALLBACK_TYPES`), so the strip and the body cannot drift apart again.

- 5a24ad9: Localize `RecordDetailDrawer`'s drag-resize handle (objectstack#5733)

  `packages/plugin-detail/src/RecordDetailDrawer.tsx` carried a byte-identical twin
  of the literal objectstack#5506 removed from `NavigationOverlay`: a
  `role="separator"` drag handle on the drawer's left edge with a hardcoded
  `aria-label="Resize drawer"`. #5506's sweep fenced on `packages/components`, so
  this second copy survived it.

  The handle has no visible label, so that string IS the control as far as a
  screen reader is concerned — a zh/ja/de session got one English announcement in
  an otherwise localized drawer. It is not a dormant branch either: `resizable`
  defaults to `true`, and the drawer is what plugin-kanban / plugin-calendar /
  plugin-gantt open on row, card and event click.

  It now reads `t('common.resizeDrawer')` — deliberately the SAME key #5506 gave
  the other handle (already present in all ten locale packs) rather than a new
  `detail.resizeDrawer` twin, so one control rendered from two packages cannot end
  up with two translations that drift apart.

  `common.resizeDrawer` is also added to `DETAIL_DEFAULT_TRANSLATIONS`, the map
  `createSafeTranslation` falls back to when no `I18nProvider` is mounted. Without
  that entry the name would degrade to the raw key for every provider-less host —
  which is the regression the accompanying no-provider test pins.

- 23018cc: `record:highlights` now honours a `readonly: true` on an authored field entry, so a header chip for a platform-owned column no longer offers inline edit. `HeaderHighlight`'s editability gate already consulted `field.readonly`, but the renderer rebuilt each entry from a fixed `{name,label,icon,type}` list and dropped `readonly` one layer before that check, so the gate could never fire from authored metadata — a hook-maintained rollup or approval-written grade could be overwritten by hand from the detail-page header strip and stayed wrong until an unrelated write re-fired the computation. `readonly` is now a declared key on `HighlightField` and on the `RecordHighlightsComponentProps.fields[]` entry union, mirroring `DetailViewField.readonly` (objectstack#5077).
- 58a00f0: Give `InlineCreateRelated`'s card-header close button an accessible name (objectui#3411 — the neighbouring defect found while implementing #3381/PR #3410, in the same file and left outside that PR's scope fence as a different class).

  The button is icon-only: its sole child was a lucide `X`, with no text, `aria-label`, `aria-labelledby` or `title`. lucide-react excludes childless, a11y-prop-less icons from the accessibility tree (it defaults them to `aria-hidden="true"`), so the button had no name source at all and its computed accessible name was the empty string — a screen reader announced a nameless "button". Unlike the placeholder case in #3381 there was no browser-side fallback to soften it: the name was empty in every implementation. WCAG 4.1.2 / 2.4.6.

  The fix is `aria-label="Close"` on the button, plus an explicit `aria-hidden="true"` on the icon so the intent is local rather than inherited from the icon library's default. `aria-label` rather than #3381's visually hidden `<label>` because this control has no visible copy for a label to stay in step with — the drift that ruling guarded against cannot arise here — and it matches the shape the repo's other close buttons already use (shadcn's dialog/sheet, `DashboardEditor`).

  No props, spec or visible-copy change; the component's rendering is otherwise identical.

- 53811d1: Associate the label with its control at the two form surfaces where the two were never programmatically connected (objectui#3341 — found while implementing #3299/PR #3340, and deliberately left out of that PR's scope fence as a different class of defect).

  `aria-required` reaching the control (#3299) only fixes the required _state_; at these two sites the control's accessible _name_ was still wrong, because the label pointed at nothing:

  - `@object-ui/plugin-detail` — `InlineCreateRelated`'s create-tab fields rendered a `<label>` with no `htmlFor` beside an `<Input>` with no `id`, and the two were siblings rather than wrapper/child. The field label was unreachable for assistive tech, and clicking the label did not focus the input. The ids are namespaced with `React.useId`, because `field.name` alone is unique only within one instance and a detail page mounts one of these per related list.
  - `@object-ui/components` — the custom `ActionParamDialog`'s `select` branch rendered `<Label htmlFor={param.name}>` but never put the matching `id` on its Radix `SelectTrigger`, so the reference dangled. The textarea / number / date / text branches already set `id={param.name}`; select was the only one that did not.

  `SelectTrigger` renders a `<button role="combobox">`, and `button` is a labelable element, so the plain `htmlFor`/`id` pair is the correct association there — no `aria-labelledby` required. No spec change and no widget-props contract change.

- b17ce4c: Give `InlineCreateRelated`'s "Link Existing" search box a real accessible name (objectui#3381 — the neighbouring defect found while implementing #3341/PR #3380, and left out of that PR's scope fence as a different class).

  The box carried a `placeholder` and nothing else: no `<label>`, no `aria-label`, no `aria-labelledby`. Its accessible name therefore fell through to the placeholder, which is the last resort in HTML-AAM and fails in two ways — the name a browser derives from it is the one thing that disappears the moment the user types, and the fallback is not implemented uniformly (`dom-accessibility-api` has no placeholder step at all, so under test the control computed to the empty string while a browser would have said "Search Contact…").

  The fix is a visually hidden `<label htmlFor>` pointing at a `React.useId`-namespaced input id — the same shape #3341 left on the create tab, rather than an `aria-label`, so the accessible name stays a real label element instead of a detached string that can drift from the visible copy. The label text and the placeholder are now derived from one expression (the placeholder only adds the ellipsis), and the id uses a hyphenated `link-search` segment so it cannot collide with a create-tab field literally named `search`. The decorative magnifier is explicitly `aria-hidden` — lucide already defaults childless icons to that, but spelling it out keeps the intent local and independent of the icon library's defaults.

  No props, spec or rendered-copy change: the placeholder string is byte-identical to before.

- c7fba27: `field:permission-facet-link` now registers through `withFieldCarrier` — the
  repo's only raw `field:` registration bypassed the single-metadata-carrier seam
  (objectui#3233), so under the SDUI path (`SchemaRenderer` passes `schema`,
  never `field`) the widget read `field === undefined` and silently rendered an
  anonymous facet summary (`field?.name` empty, no facet branch selected). The
  form and inline-edit hosts were unaffected — they pass `field` directly, which
  the carrier forwards unchanged. Fixes objectui#3307.
- 12bf669: The record discussion panel now says "loading" while it is loading, instead of
  "No comments yet" (objectui#3209).

  FROM: opening any record page showed the discussion/chatter panel asserting
  `No comments yet` for the whole first leg of the page, then contradicting
  itself when the comments appeared. TO: the panel shows the loading row until
  the feed has actually answered, and only then commits to "this record has no
  comments".

  objectui#3205 gave `RecordActivityTimeline` the render branch that prefers a
  loading row over the empty copy, and `RecordChatterPanel` already forwarded
  `loading` to it in both positions — but on the chatter chain **nothing
  produced the signal**, so that branch could never fire. `record:activity`
  computes its own flag and was visibly fixed by #3205; chatter was not. The
  four wiring points are one chain and are all closed here, because any one of
  them left open still ships the empty copy to some user:

  - `RecordDetailView` — the host that OWNS the feed fetch — now derives a
    `feedLoading` flag from its two reads (`sys_comment` + `sys_activity`);
  - `<DiscussionContextProvider loading={feedLoading}>` publishes it (the field
    was already declared on `DiscussionContextValue`, and already read by
    `record:activity`);
  - the auto-appended `<RecordChatterPanel loading={feedLoading}>` — the panel
    authored pages get when they place no discussion slot — receives it
    directly;
  - the `record:chatter` / `record:discussion` renderer forwards
    `loading={discussion?.loading}`, so a hand-placed block is on the same
    chain as the synthesized one.

  The two reads run in parallel, so the flag closes over **both**: it clears on
  `Promise.allSettled`, and a REJECTED read counts as an answer. A deployment
  without the audit plugin 404s `sys_activity` and an object with
  `enable.feeds: false` 403s `sys_comment`; neither may pin the panel in a
  permanent spinner, which would be a worse bug than the one being fixed. The
  flag is keyed by `object:recordId` rather than being a plain boolean, so the
  first render of a record already reads as loading (no one-frame flash of the
  empty state) and navigating between records cannot show the previous record's
  settled answer.

  No tolerance was added at the consumer. The timeline still does not guess that
  "no items yet and just mounted" means loading — that guess is wrong the moment
  a record genuinely has no comments, and the signal belongs to whoever owns the
  fetch. Same shape as objectui#3165 / #3205: divergence converges at the
  producer.

- Updated dependencies [b71fc92]
- Updated dependencies [65516ba]
- Updated dependencies [94c5b7c]
- Updated dependencies [ca0fa8f]
- Updated dependencies [3889ffb]
- Updated dependencies [7e2406a]
- Updated dependencies [4eeb932]
- Updated dependencies [5c856ec]
- Updated dependencies [68b6a28]
- Updated dependencies [0554e88]
- Updated dependencies [28b2e65]
- Updated dependencies [825bbe3]
- Updated dependencies [6195841]
- Updated dependencies [5dd0127]
- Updated dependencies [a415684]
- Updated dependencies [5af2852]
- Updated dependencies [a6ec93d]
- Updated dependencies [c7ed4c3]
- Updated dependencies [2409e1d]
- Updated dependencies [789fe3e]
  - @object-ui/i18n@17.3.0

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

- dd06bcd: `record:activity` fetches a feed instead of rendering a permanently empty one (objectui#3165).

  The block published eleven inputs — `types`, `filterMode`, `showFilterToggle`,
  `limit`, `showCompleted`, `unifiedTimeline`, `showCommentInput`,
  `enableMentions`, `enableReactions`, `enableThreading`,
  `showSubscriptionToggle` — every one of them a filter or an affordance over a
  feed that could not have content on any path. `RecordActivityRenderer` called
  `useRecordContext()`, discarded the result and rendered
  `<RecordActivityTimeline items={[]}>` with the empty array hard-coded; the
  timeline takes `items` as a prop and never fetched; no host supplied any
  (`buildDefaultPageSchema` emits `{ type: 'record:activity' }` with no props at
  all). Declared, published to `sdui.manifest.json`, inert at runtime —
  objectstack#4413's shape, three blocks over.

  **The feed now has three sources, in precedence order.** `items` on the node
  (the convention `record:history` uses for `entries`); a mounted
  `DiscussionContext`, which the console's record page fills with the merged
  `sys_comment` + `sys_activity` feed and the write handlers; otherwise a
  **self-fetch** of `sys_activity` scoped to the bound record
  (`{ object_name, record_id }`, newest first, `limit` rows per page, "Load more"
  re-reading a wider window). The third path is what makes the block
  drop-anywhere — hand-authored inside a `page:tabs`, with no host feeding it —
  and it mirrors the read `record:history` already had. Rows map to feed items
  exactly as the console's record page maps them, so both surfaces agree about
  what a row is.

  **The read-side inputs now filter.** `types` is an allow-list over feed item
  types (unrecognised entries ignored; an all-typo list is treated as unset
  rather than emptying the feed). `limit` is a page size and caps the scoped
  read. `showCompleted` (spec default `false`) hides completed activities.
  `unifiedTimeline: false` un-mixes field changes from the comment stream — the
  panel becomes a discussion feed and field changes stay in `record:history`.
  `filterMode` seeds which slice the dropdown opens on and falls back to `all`
  on an unrecognised value instead of leaving a `<Select>` matching nothing.

  **The write-side switches are wired to the host's handlers.**
  `showCommentInput`, `enableThreading`, `enableReactions` and `enableMentions`
  read `onAddComment` / `onAddReply` / `onToggleReaction` /
  `mentionSuggestions` off `DiscussionContext` — the same standing
  `record:discussion` has. With no host mounted the feed stays read-only and no
  composer is rendered, rather than showing one that silently drops what you
  type.

  **`showSubscriptionToggle` is recorded as a known gap, not quietly left
  looking configurable.** The bell needs a `RecordSubscription` value and
  somewhere to persist it, and the platform has no record-subscription object to
  read or write one from. Its input description now says `NOT IMPLEMENTED` (that
  text ships to `sdui.manifest.json`, so an author meets it before writing the
  prop), the docs repeat it, and a test pins it inert so the note has to be
  deleted the day a backend for it lands.

  `apps/console`'s record-reach probe (objectui#3149 layer 3a) asserted the old
  behaviour from its `NO_RECORD_REACH` ledger in both directions; that entry is
  deleted, and the probe now reports `record:activity` as responding to the bound
  record.

### Patch Changes

- 6be575c: A fetching activity feed says "loading", not "No activity recorded" (objectui#3205).

  `RecordActivityTimeline` declared a `loading` prop and destructured it straight
  into `_loading`, so nothing in the component ever read it. For the whole
  duration of a feed fetch the panel therefore rendered the empty state — "No
  activity recorded" — and then contradicted itself when the rows landed. The
  empty copy is a factual claim about the record; it may only be made once the
  fetch that would fill the feed has settled.

  The timeline now branches on `loading` **before** the empty branch and renders a
  spinner row (`role="status"`, `aria-live="polite"`) while the feed is in flight.
  `collapseWhenEmpty` does not suppress it: that flag is about the empty state
  ("collapse when there are no items"), and mid-fetch it is not yet known whether
  there are items.

  The guard is `loading && filtered.length === 0`, not `loading` alone — a refresh
  or a "Load more" round-trip keeps the rows already on screen instead of blanking
  them (that button carries its own spinner).

  No prop or signature changed: the fix is that the declared prop is now read.
  `record:activity` has computed a live `loading` since objectui#3165 (true during
  its self-fetch) and `RecordChatterPanel` already forwarded it in both positions,
  so the whole chain now shows a loading state end to end.

- Updated dependencies [a889e31]
- Updated dependencies [4b470b9]
  - @object-ui/i18n@17.2.0

## 17.1.0

### Minor Changes

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

- 390c071: feat(record): declare inputs for the seven configurable record:\* blocks, and curate six

  Seven `record:*` blocks shipped with renderers that read props but declared no
  `inputs`. That combination is the worst of both: the renderer honours
  `limit`, `severity`, `location` …, while every authoring surface — the designer
  panel, the AI vocabulary, the generated manifest — reports the block takes no
  configuration. objectui#3013 recorded them as deliberately uncurated for
  exactly that reason.

  The declarations mirror what each renderer actually reads:

  | block                                  | inputs                                                                       |
  | -------------------------------------- | ---------------------------------------------------------------------------- |
  | `record:activity`                      | 11 — from `RecordActivityComponentProps`                                     |
  | `record:chatter` / `record:discussion` | 5 — from `RecordChatterComponentProps`                                       |
  | `record:alert`                         | 8 — severity, title, body, visible, icon, action, dismissible, dismissKey    |
  | `record:quick_actions`                 | 7 — actionNames, requiredPermissions, location, align, inline, variant, size |
  | `record:history`                       | 3 — limit, emptyText, unknownUserText                                        |
  | `record:reference_rail`                | 1 — hideEmpty                                                                |

  `inputs` describe what an AUTHOR writes, which is a subset of what the renderer
  reads. `entries`, `loading` and resolved `actions` are injected by the host
  shell off RecordContext; declaring them would invite a model to hand-write the
  data the page is supposed to fetch. `aria` is omitted for the reason it is
  omitted on `record:details` — an accessibility escape hatch, not a layout
  choice. `location` takes its enum from the spec's `ACTION_LOCATIONS` rather
  than restating it, per objectui#3019.

  Six of the seven are now in `PUBLIC_BLOCKS`: configurable and absent from the
  contract is the state objectui#3006 was about. The contract goes 36 → 42 tags,
  all resolving.

  `record:chatter` stays out — it is the same renderer as `record:discussion`
  under a Salesforce-familiar name, kept for schemas already in the wild. Two
  spellings of one block is ambiguity an authoring model cannot resolve, so the
  vocabulary carries the spec's name. A test compares the two input lists, so the
  day they diverge the exclusion stops being justified and fails.

  A companion assertion requires every curated `record:*` tag to declare inputs.
  A curated tag with none reads as "takes no configuration" when the renderer in
  fact reads props — the same gap objectui#3006 opened, pointed the other way.

- bac266c: fix(detail): a related list has one sorting semantics instead of two — #3106

  A related list carried two. Its own sort-button row (opt-in via `sortable`) went
  out as a server `$orderby` over the whole child collection; the `data-table` it
  embeds took `sortable`'s default of `true` and sorted the rows it was holding —
  which, in windowed mode, is **one page**.

  Turning `sortable` on put both in the same card, with nothing saying they meant
  different things. Leaving it off — the default — was worse: the page-local sort
  was then the _only_ one the user could reach, and it looked exactly like the
  list being sorted.

  The table's column headers now drive this list's sort in both modes, so there is
  one order behind them:

  - **Windowed**: the header sort becomes the server `$orderby` and resets to page
    one, the same path the buttons took.
  - **Client mode**: this list keeps sorting in memory, where its key is the label
    resolved through its own id → name map (#3096) — a key the embedded table
    cannot see, so its sort was the worse of the two even when both were possible.

  The button row survives only where there are no headers to click: a `list`
  (`data-list`) related list, or a caller-supplied `schema` whose contents we
  cannot assume. `sortable`'s documentation now says that is what it controls.

  Relational columns keep #3096's rule, moved to the header: no sort affordance
  while the sort is a server `$orderby` (the key would be the stored foreign-key
  id while the cell shows a name), live in client mode where the key is the label.

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

- c785740: fix(detail): record Attachments become their own tab (with count badge) and their copy is translated — objectstack#4358

  Two defects on `enable.files: true` record detail pages:

  1. **Buried placement.** `RecordDetailView` appended `RecordAttachmentsPanel`
     AFTER the schema-rendered page tree, whose synthesized default embeds
     `record:discussion` as the last main component — so the panel always
     landed below an ever-growing feed timeline, undiscoverable without
     scrolling to the very bottom, with no metadata knob to move it.

     `buildDefaultTabs` now emits a peer **Attachments** tab (a new
     `record:attachments` node rendered by an app-shell registration wrapping
     the existing panel via RecordContext) between Related and
     Activity/History. `PageTabsRenderer` derives the tab's count badge from a
     `sys_attachment` probe scoped to `(parent_object, parent_id)`, riding the
     same RelatedCountStore cache/invalidation bus as related-list badges — so
     uploads and deletes update the badge live. A `hideAttachments` synthesizer
     option suppresses the tab; RecordDetailView keeps its legacy bottom append
     only as the fallback for authored pages without the node
     (`hasExplicitAttachments`).

  2. **Untranslated copy.** The panel's eleven `detail.*` keys (`attachments`,
     `uploadAttachment`, `loadingAttachments`, `noAttachments`,
     `downloadAttachment`, `deleteAttachment`, and the five
     `attachment*Denied/Required` friendly errors) existed only as inline
     English `defaultValue`s — no locale bundle carried them, so non-English
     consoles always showed English. All ten locales now define them; the tab
     label rides the existing well-known-label dictionary (→ 附件 etc.).

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

- 2baa13f: fix(record): register the record:\* blocks under one key, prefixed once

  Eleven blocks in plugin-detail were registered as
  `register('record:x', …, { namespace: 'record' })` — an already-prefixed name
  handed to a registry that prefixes it again. Each landed at
  `record:record:x`, and the key authors actually resolved, `record:x`, was the
  un-namespaced _fallback_ rather than the intended registration. The registry
  carried 23 keys for 12 components.

  Nothing failed, which is why it survived: `getPublicConfigs()` rewrites `type`
  to the curated tag, so the doubled name never reached the contract, the
  manifest, or the JSX surface. It was visible only when enumerating the registry
  directly — which is what objectui#3013's reverse check does.

  Registering the bare name is what makes `namespace` correct, and
  `skipFallback: true` is what keeps the fallback from claiming that bare name
  globally. Without it these would take over `details`, `path`, `history`,
  `alert` … as top-level tags; `alert` is the live case, owned by `ui:`. Every
  block stays reachable exactly as `record:<name>`, and 23 keys become 12.

  `record:line_items` needed no change — it was the one already registered this
  way, which is what made objectui#3006's near-miss possible in the first place.

  Two console assertions hold the shape: no key carries a doubled prefix, and no
  `record:*` block owns the bare spelling of its own name.

- 2d5d594: fix(list,detail): sorting a lookup column no longer orders by an invisible key — #3096

  A relational column (`lookup` / `master_detail` / `user` / `tree`) never holds
  the string its cell shows: it holds the `$expand`-ed record, or a raw foreign-key
  id whose label was resolved separately. Every sort path took that raw value as
  its key, so the column of names came back in an order with no relation to the
  names — sorting looked broken, with nothing saying the key was something else.

  The two halves are fixed differently, because they can order by different things:

  - **Client-side sorts** (grid column headers, any `data-table`, a non-windowed
    related list) now key off the label the cell renders, via the new
    `getSortValue` / `compareSortValues` in `@object-ui/core` — which resolves an
    expanded record through `getRecordDisplayName` (ADR-0079), so the sort key and
    the lookup cell agree on which field names a record. This replaces two broken
    comparators: `a[col] < b[col]` is always false between two objects (the
    comparator collapsed to a constant and permuted the rows), and
    `String(a[col])` is `"[object Object]"` (every row compared equal, so the sort
    silently did nothing).
  - **Server `$orderby` sorts** cannot be fixed here — the key is the stored id by
    construction, and `objectstack#4256` settled that no relation join is coming.
    So those entry points stop offering the illusion: the ListView toolbar sort
    picker withholds relational fields and explains why (pointing at a formula
    field as the supported way to sort by a related name), and a windowed related
    list renders no sort button for them.

  A relational field the view's CURRENT sort already uses stays listed, labelled
  `(by ID)`, so view metadata authored or saved with such a sort round-trips
  instead of rendering a blank row and losing the sort on the next edit.

- Updated dependencies [1cf0de7]
- Updated dependencies [752e18f]
- Updated dependencies [c785740]
- Updated dependencies [d61efd1]
- Updated dependencies [9eb932b]
- Updated dependencies [3cb9646]
- Updated dependencies [d21794c]
- Updated dependencies [b5b97e2]
- Updated dependencies [2d5d594]
- Updated dependencies [f8a95e5]
  - @object-ui/i18n@17.1.0

## 17.0.0

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

- f9bbddb: feat: gate detail/form edit & delete on the server's effective operation set (#3546)

  PR-4 (#3391) wired the **list/toolbar** surface (ObjectView Import, ListView /
  ObjectGrid Export) to the server-resolved effective API operation set
  (`/me/permissions` `apiOperations`, intersected via
  `resolveCrudAffordances(obj, effectiveApiOperations?)`). The **detail / form**
  surfaces still gated edit/delete on the bucket + `userActions` alone. This
  extends the same intersection to them, so the record page and its forms never
  offer an operation the server would 405.

  - **core** `isObjectInlineEditable(obj, effectiveApiOperations?)` gains the same
    optional second argument as `resolveCrudAffordances` — inline-edit is now
    additionally ANDed with the server allowing `update`.
  - **app-shell** `RecordDetailView` threads the object's effective operations into
    the synthesized Edit/Delete header actions and the record-body inline-edit
    gate (`canEdit`); `RelatedRecordActionsBridge` intersects each **child**
    object's Create/Edit/Delete handlers with that child's own effective set.
  - **plugin-detail** `record:details` ANDs its inline-edit affordance with the
    object's effective `update`.
  - **plugin-form** `ObjectForm`'s blanket managed-object field lock also engages
    when the server denies `update` (edit mode) / `create` (create mode).

  Backward-compatible: a missing effective set (unrestricted object, older
  backend, or no `PermissionProvider`) leaves the resolved affordance untouched —
  the bucket/`userActions` decision wins, exactly as today. Layers on top of the
  existing per-object `check('edit')` / `check('delete')` permission gates
  (intersection, never union).

### Patch Changes

- 7b21891: fix(action): honor the spec `disabled` predicate on every action-rendering surface (#1885 follow-through)

  The spec Action field is `disabled` (boolean | CEL — disabled when TRUE); the
  schema has no `enabled` key. #1885 wired it in `action:button` only. Browser
  dogfooding against the showcase found FIVE more surfaces where a spec-authored
  `disabled` silently did nothing:

  - **components** — the `action:group` leaves (inline + dropdown), `action:icon`
    and `action:menu` still read the legacy non-spec `enabled`. They now consume
    `disabled` as the primary control (evaluated in the same scope as `visible`),
    with `enabled` kept as a deprecated fallback.
  - **app-shell** — `DeclaredActionsBar` (server-declared action bar) read
    neither; it gains `disabled` (no legacy fallback: declared actions are
    spec-shaped and never carried `enabled`).
  - **plugin-detail** — `record:quick_actions` HAD a `disabled` implementation,
    but its `typeof === 'string'` split dropped the `{dialect:'cel', source}`
    envelope the server compiles authored CEL into (#2661 routes envelopes to the
    canonical formula engine), so the predicate never fired on real metadata. It
    now feeds `toPredicateInput`'s result to `useCondition` whole, like every
    other surface.

  Pinned by new `DropdownActionItem` tests (disabled-when-TRUE, false-stays-
  clickable, disabled-wins-over-enabled, boolean literal) and browser-verified
  end-to-end against the showcase `showcase_archive_task` specimen: greyed on an
  in-progress task, clickable on a done one (with `visible` hiding Mark Done on
  the same screen — the hide-vs-grey contrast).

- faad45e: fix(fields): render `image` fields consistently and add click-to-zoom (#2836)

  An `image` field rendered differently — and wrongly — on three surfaces:

  - **Edit form showed broken thumbnails.** A record read back its `image` value
    as a bare `sys_file` id (the reference form), but `readFileValue` returned an
    id with no URL — the comment assumed the read path expands it, which the
    edit-form data path does not. The result was `<img src="">`. `file-value` now
    derives the stable download URL (`/api/v1/storage/files/:id`, which
    302-redirects to a signed URL and works directly as `<img src>`) for a bare
    id or an id-only object, so every widget and cell renderer resolves one.
  - **Inline edit leaked the raw storage URL.** `InlineFieldInput` had no branch
    for file-backed types and fell through to a plain text input showing
    `/api/v1/storage/files/…`. It now renders the same upload widgets the form
    uses (`image`/`avatar`/`signature`/`file`/`video`/`audio`).
  - **Hard-coded English.** `ImageField`'s upload/crop/remove/alt strings now go
    through `t('fields.image.*')` (en + zh added).

  Also adds an `ImageLightbox` — click a read-only thumbnail (detail or list cell)
  to open a full-screen preview; multiple images get prev/next navigation, a
  position counter and arrow-key support, a single image just the image. In a
  grid cell the click is `stopPropagation`-guarded so enlarging doesn't also open
  the row.

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

- 53642d4: fix(core,fields): a string `$orderby` is a clause, not a character array — and localize the sharing-rule widgets (objectstack#3821)

  **The recipient picker listed nothing, ever.** `QueryParams['$orderby']` was
  typed as `Record | string[] | SortObject[]`, so `queryParamsToRecord` sent any
  non-array value through `Object.entries`. Handed the clause string `'name asc'`
  — which callers do build by hand — it walked the string index by index and
  emitted `$orderby=0 n,1 a,2 m,3 e,4 ,5 a,6 s,7 c`. The server sorted by columns
  that don't exist and every row was filtered out, so
  `sys_sharing_rule.recipient_id` rendered "No matches" for every recipient type
  and no sharing rule could be created from the Console. `ObjectGrid` builds the
  same shape from a schema-level `sort` in three places, so grids with a string
  sort silently showed an empty table.

  A string `$orderby` is now passed through verbatim (the server's OData
  normalizer has always parsed `'name asc'`), and the type admits `string`.
  `RecipientPickerField` additionally switched to the structured
  `{ name: 'asc' }` form so it can't regress this way against any data source.

  **The three sharing-rule authoring widgets never had translations.**
  `ObjectRefField`, `RecipientPickerField` and `FilterConditionField` hardcoded
  their English copy — a Chinese Console showed "Select an object", "Select a
  user", "Search…", "No matches", "Edit as JSON". They now go through
  `useFieldTranslation` like every other widget, with keys added under `fields.*`
  in all ten locales.

  The recipient placeholder was the interesting one: it read
  `` `Select a ${recipientType.replace(/_/g,' ')}` ``, interpolating the enum
  value into an English sentence — a shape no locale can translate. It is now a
  per-type key (`fields.recipient.selectUser`, `…selectBusinessUnit`, …), so
  "选择业务单元" and "Select a business unit" no longer have to share a structure.

  **Editing a rule silently dropped its recipient.** The picker resets the stored
  id when `recipient_type` changes, because an id valid for a user is meaningless
  for a team. It treated the edit form's `'' → 'user'` hydration as such a change:
  opening any saved rule blanked the recipient, and saving persisted the blank.
  Only a non-empty predecessor now counts as a type switch.

  **Building a filter submitted the surrounding form.** None of `FilterBuilder`'s
  controls declared `type="button"`, and a bare `<button>` inside a `<form>`
  defaults to `type="submit"`. Adding, removing or clearing a condition therefore
  submitted the sharing-rule dialog — firing validation mid-edit, and on an
  already-valid form saving the record before the admin was done.

  **A rejected write showed the user raw server diagnostics.** The form rendered
  `error.message` verbatim, so a sharing / RLS denial reached the dialog and the
  toast as `FORBIDDEN: insufficient privileges to update showcase_private_note
pi-TgoJ4_DM55Fqz` — untranslated, and leaking the object's machine name and the
  record id to whoever hit it. Permission failures now render localized copy
  (`form.noPermissionToSave`, added in all ten locales), with the server text kept
  on the console for debugging; other failures still show the server's message,
  which is the useful part, and fall back to `form.submitFailed` when there is
  none — replacing the previously hardcoded English "An error occurred during
  submission".

  **The detail header offered "Edit" on records the user may only read.** Object
  permissions can't express "this one record is read-only" — a read-only sharing
  grant sits inside an object the user may otherwise edit — so the header showed
  the primary Edit CTA, opened the form, and let the user retype a field before
  the server rejected the save. `DetailView` now gates Edit / Delete on the
  object-level check AND on the explain engine's record-grained verdict
  (`POST /api/v1/security/explain` with a `recordId`, ADR-0090 D6 / ADR-0095 C2 —
  the same pipeline the enforcement middleware runs, so button and server cannot
  disagree). Explaining oneself needs no special permission. The probe is one
  cached request per record, skipped entirely when the object-level check already
  says no, and **fails open** on every uncertainty — an unanswered hint must never
  be the reason a permitted user cannot act; the server stays the authority
  (ADR-0057 D10).

  **A long option rendered straight past the combobox border.** `Combobox`'s
  trigger pinned itself to the component's `w-[200px]` default while the fields
  around it ran the full form column, and the selected label was a bare text child
  of a flex button — flex items need `truncate` AND `min-w-0` to clip, and it had
  neither. So "成员 (showcase_project_membership)" in the object picker overflowed
  the control and collided with the field beside it. The label now truncates, the
  trigger can shrink, the dropdown matches the trigger's width instead of a
  hardcoded 200px (a widened combobox used to clip its own options), and the two
  sharing-rule pickers ask for `w-full` so they line up with every other input.

  Hardens `evaluatePermission` while there: a role config carrying only
  `fieldPermissions` (no `actions`) made `check()` throw a TypeError that
  propagated out of the render. A permission check must not be able to crash a
  view.

  Browser-verified against the framework showcase Console in Chinese: object /
  criteria / recipient copy is fully localized, the recipient dropdown lists real
  users, business units and positions, a saved rule reopens with its recipient and
  criteria intact, editing the filter no longer submits, and a rule created
  end-to-end stores a real record id rather than free text. The criteria authored
  in the builder is honored by the evaluator: `{"pinned":true}` on an owner-private
  object granted the recipient exactly the matching records and nothing else.

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

## 16.1.0

### Minor Changes

- faebac3: Related lists paginate by default and fetch server-side windows (#2711).

  `record:related_list` now applies the spec default `limit` of 5 when a node
  doesn't declare one, so detail-page related lists render pages with
  Previous/Next controls instead of dumping every child row. On the auto-fetch
  path RelatedList requests one page at a time (`$top`/`$skip`), reads the
  collection size from `QueryResult.total` (`hasMore` fallback), sends user
  column sorts as a server `$orderby`, and seeds the initial order from the
  node's `sort` prop (new `defaultSort` prop on RelatedList). Caller-provided
  `data` keeps the historical client-side slicing. Behavior change: lists that
  previously rendered all rows now show 5 per page — declare a larger `limit`
  on the `record:related_list` node to widen the window.

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

- 53513a4: fix(plugin-detail): #2688 — record surfaces without a caller title no longer floor to `Record #<id>`, and the meta footer never prints a raw audit user id

  - `DetailView` header: after every declared-identity step misses and no
    `schema.title` was provided, probe name-ish record keys (`name`, `title`,
    `*_name`, …) before falling to the `Record #<id>` floor. Fixes records whose
    name lives in a field the type-aware derivation deliberately skips (e.g. an
    `autonumber` `name`) opened from surfaces like the gantt row drawer.
  - `RecordMetaFooter`: `created_by` / `updated_by` are always user references on
    ObjectStack — when the fetched schema omits the audit system fields, default
    the reference target to `sys_user` so the footer renders a resolved user name
    (or the muted placeholder) instead of the raw opaque id.

- f329ec5: chore(lint): clear the baseline lint errors in plugin-detail (objectui#2713 Wave 3)

  Wave 3 of the #2713 lint-gate restoration. `@object-ui/plugin-detail` was red at
  baseline on `main`; cleared every **error** (no behavior change; warnings out of
  scope). All nine are `react-hooks` errors — the record renderers called hooks
  after conditional early returns, which is a real fragility (React throws when the
  guard toggles between renders), so each is restructured so hooks run
  unconditionally while the rendered output stays identical:

  - **`record-reference-rail`** — hoisted `useState` above the empty-entries early
    return (no dependency on it).
  - **`record-related-list`** — moved the `!objectName` placeholder return below
    the four hooks (`usePermissions` / `useFieldPermissions` / `useRelatedRecordActions`
    / `useMemo`); those hooks are pure context/memo reads, safe with an empty
    object name. The object-level read gate ordering is unchanged (covered by
    `RecordRelatedListRenderer.readgate.test`).
  - **`record-quick-actions`** — moved the `requiredPermissions` gate below
    `useActionEngine` (a pure `useContext`/`useMemo` hook).
  - **`record-highlights`** — `useId` + `useRegisterHighlightFields` now run
    unconditionally; the permission gate is enforced after them. Because
    `useRegisterHighlightFields` has a register effect, it is passed `[]` when the
    gate denies — equivalent to not registering, so no body field is ever hidden
    for highlights that aren't rendered.
  - **`RelatedList`** `SectionIcon` (`react-hooks/static-components`) —
    `resolveIconComponent` is a stable registry lookup, not a component created
    during render → justified scoped disable.

- 6d4fbe6: **Consolidate the `managedBy` lifecycle-bucket logic into one shared source of truth (follows framework ADR-0103).** The bucket taxonomy was hand-mirrored in several places — `crudAffordances.ts`, `ManagedByBadge.tsx` (its own `Bucket` union + `isWriteOptedIn` + the writable-system derivation), and `plugin-detail`'s `record-details.tsx` (`NON_EDITABLE_BUCKETS`, duplicated because it can't depend on app-shell) — a drift risk, and the object-schema `managedBy` type was open-ended (`(string & {})`) so unknown buckets slipped through and silently defaulted to fully-editable.

  - **`@object-ui/types`** now owns the closed `ManagedByBucket` union (+ `MANAGED_BY_BUCKETS`), and `ObjectSchema.managedBy` is tightened from `'platform' | 'better-auth' | (string & {})` to that union — unknown buckets are now a type error at authoring time.
  - **`@object-ui/core`** now owns the React-free runtime logic — `resolveCrudAffordances`, `isWriteOptedIn`, `isSystemWritable`, `isObjectInlineEditable` — reachable by every UI package including `plugin-detail` (which could not import app-shell).
  - **`app-shell/utils/crudAffordances.ts`** is now a thin re-export of `@object-ui/core` (existing imports keep working); `ManagedByBadge` consumes the shared `isSystemWritable`; `plugin-detail` `record-details.tsx` replaces its hand-mirrored `NON_EDITABLE_BUCKETS` with `isObjectInlineEditable`.

  Behavior-preserving — all existing affordance/edit-gate tests stay green; the shared module adds direct unit coverage (including the previously-untested `isSystemWritable` derivation). Translated copy (badge variants, empty-state messages) stays in app-shell.

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
- Updated dependencies [af1b0db]
- Updated dependencies [1100a8b]
- Updated dependencies [7abe4cd]
- Updated dependencies [ebe6494]
- Updated dependencies [f80aaf2]
- Updated dependencies [29c6040]
  - @object-ui/i18n@16.1.0

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

- 9d4a429: fix(form+detail): keep single-file children as inline grids; drop non-spec `attachment` handling

  Two follow-ups to the upload-in-grid work (objectui#2360):

  - **#2654** — Now that `file`/`image`/`avatar` fields render a compact upload
    cell in the line-item grid, a child object with a _single_ such field no
    longer flips the smart `inlineEdit` default to a per-row form. `resolveInlineMode`
    splits the old `FORM_ONLY_TYPES`: truly form-only types (textarea / richtext /
    html / markdown / json / location / address) still tip to `form` on their own,
    while file-family types only tip when several rich fields pile up
    (`RICH_FIELD_FORM_THRESHOLD`, default 2). An explicit `inlineEdit` always wins.

  - **#2655** — `attachment` is not a `@objectstack/spec` field type (the spec
    media types are file/image/avatar/video/audio), so the renderer no longer
    models it: removed from `fieldTypeToColumnType`, the inline-mode heuristic, and
    `RelatedList`'s auto-column `SKIP_TYPES`. Contract-first cleanup — the renderer
    stops fossilizing a phantom type (AGENTS.md #0.1).

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
  - @object-ui/permissions@16.0.0

## 15.0.0

### Patch Changes

- bb22788: Inline-edit field enrichment passes `min`/`max`/`step` through to the numeric
  editors (objectui#2572 live dogfood find). Both `DetailSection` and
  `HeaderHighlight` copy an explicit whitelist of objectSchema keys into the
  enriched field they hand `InlineFieldInput`; the numeric range/step
  constraints were missing from that list, so a currency field declaring
  `min: 0` rendered a number input with no range affordance. Adds a live e2e
  spec (`e2e/live/inline-edit-polish-2572.spec.ts`) driving the whole #2572
  polish set against the real showcase stack.
  - @object-ui/types@15.0.0
  - @object-ui/core@15.0.0
  - @object-ui/i18n@15.0.0
  - @object-ui/react@15.0.0
  - @object-ui/components@15.0.0
  - @object-ui/fields@15.0.0
  - @object-ui/permissions@15.0.0

## 14.1.0

### Minor Changes

- 471c5d3: feat(detail): editable record highlights on the shared inline-edit draft (objectui#2407 P2)

  The highlights strip is now editable in place and shares ONE draft + ONE atomic
  Save with the details body (building on the P1 `InlineEditContext` / `#2529`
  `InlineFieldInput`).

  - **`HeaderHighlight`** consumes `useInlineEdit()`: hovering a highlight shows a
    pencil and double-click enters the shared record edit session; each editable
    highlight renders the same `<InlineFieldInput>` the body uses (value =
    `draft[name] ?? data[name]`, write via `setField`). Computed
    (`formula`/`summary`/`rollup`/`auto_number`), `readonly`, and system fields
    expose no editor. Empty highlights are kept while editing so they can be
    filled. Compact-layout UX: an actively-edited column widens and renders the
    editor full-width (Salesforce-style expand-on-edit).
  - **`RecordDetailView`** (app-shell) hosts ONE `<InlineEditProvider>` (with the
    object-lifecycle `canEdit` gate) spanning both `record:highlights` and
    `record:details`, plus the single record-level `<InlineEditSaveBar>` — so a
    highlight edit and a body edit commit together in ONE
    `update(obj, id, draft, { ifMatch })`.
  - **`record:details`** drops its P1-local provider/save bar (it would otherwise
    split the draft from the highlights) and just consumes the shared context;
    **`record:highlights`** threads the DataSource through for lookup/user editors.

  Guardrails preserved: computed/readonly/system highlights non-editable; `canEdit`
  gate; OCC (`ifMatch` + `ConcurrentUpdateDialog`); only user-edited keys are sent.

- 579b24d: feat(fields+form+detail): file/image uploads in inline line-item grids (#2360)

  `Field.file` in a master-detail inline grid previously degraded to a plain text
  input (no `input[type=file]` on the page → no way to upload from the grid), and
  auto-derived subform / related-list columns silently dropped file fields.

  - **fields**: new `FileCell` — a compact upload control for grid cells (upload
    button + removable chips, image thumbnails), sharing the `UploadProvider`
    pipeline with the full-size `FileField` via an extracted `useFileUploads`
    hook. `GridField` supports `type: 'file'` columns (with `accept` /
    `multiple`), renders file names in list/readonly modes, and no longer falls
    back to a text `<Input>` for file columns.
  - **plugin-form**: `deriveColumns` / `hydrateColumns` no longer exclude
    `file`/`image`/`avatar` fields — they map to `file` columns and carry the
    field's `multiple` + `accept` (image fields default to `['image/*']`).
  - **plugin-detail**: auto-derived related-list columns no longer skip
    `file`/`image` fields — they render through the existing FileCellRenderer /
    ImageCellRenderer (file-name chip / thumbnail).

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

### Patch Changes

- 2efa9fd: Detail-page UX follow-ups from the ADR-0085 PR4 real-backend browser pass (framework#2548):

  - **Highlight strip no longer repeats the record title.** A declared
    `highlightFields` list containing the title field rendered it as the first
    chip — truncated — directly under the identical page H1. `deriveHighlightFields`
    now resolves the title (`primaryField` / `nameField` / deprecated
    `displayNameField`, else the conventional display-field names) via the new
    exported `resolveTitleField` and filters it from declared lists before the
    4-chip cap, matching what the heuristic branch always did. app-shell's
    `RecordDetailView` synthParts (which pre-computes the list and bypasses the
    derivation) applies the same filter.
  - **Per-field currency reaches the renderers.** The spec channel
    (`currencyConfig.defaultCurrency`) was dropped by the highlight-strip and
    detail-section field enrichment, so a spec-authored currency field could
    never show its symbol ("25,000,000" instead of "$25,000,000");
    `resolveFieldCurrency` reads it second after the designer-only bare
    `currency` key.
  - **app-shell approvals fetches send the Bearer token.** The header badge
    poll, home-inbox count, and record-page approvals panel were cookie-only
    (new shared `bearerAuthHeaders()` util) — same split-origin failure mode as
    the console `approvalsApi` fix below.
  - **`fieldGroups[].icon` / `description` reach detail pages.** The shared
    derivation (ADR-0085 §5) already passed them through; the detail synth
    dropped them. Sections now carry both, and `DetailSection` renders a real
    Lucide icon for identifier-shaped names (emoji/text values keep the
    historical text rendering).
  - **Record meta footer stops dangling without an actor.** Seeded/system rows
    with `created_by: null` rendered "Created by · 10m ago"; the footer now
    falls back to actor-less labels ("Created / Updated"), with new i18n keys in
    all six locales (and the zh `createdBy`/`updatedBy` mistranslation fixed:
    创建人/更新人, not 创建于/更新于).
  - **Select badges ellipsize instead of clipping mid-glyph.** In bounded
    containers (highlight-strip columns, grid cells) an overlong option label
    used to be cut at the container edge ("Technolog…"); badges now shrink with
    an inner truncate and expose the full label as a hover title. The highlight
    strip's hover title also prefers the option label over the raw stored value.

  Console app (unversioned): `approvalsApi` now sends the stored Bearer token
  like every other console call — cookie-only auth silently lost the approvals
  surface on split-origin deployments where the SameSite cookie doesn't flow.

- f9a7907: refactor(plugin-detail): extract `<InlineFieldInput>` from `DetailSection`

  Lift the inline-edit input branch out of `DetailSection` into a standalone,
  reusable `<InlineFieldInput>` component (objectui#2407, step 0 — the
  behavior-preserving refactor that precedes the record-level `InlineEditContext`
  and editable-highlights work).

  Behavior is unchanged: `<InlineFieldInput>` renders the exact same type-aware
  editors the detail body handled inline — `SelectField`, `BooleanField`,
  `LookupField`, `UserField`, `CapabilityMultiSelectField`, the
  `permission-facet-link` read-only facet, and the plain number/date/text input
  (with ISO-date coercion and `$expand`-ed-reference safety so an object value
  never leaks `"[object Object]"`). `DetailSection` now delegates to it and keeps
  the field-editability gate (computed / `readonly` / system-field / object
  lifecycle) exactly as before. The `extractLookupId` helper and the
  `TEXTUAL_REF_FALLBACK_TYPES` set move alongside the component.

  This lets any record-level surface (the details body **and** the highlights
  strip) share one editor, shrinking the surface of the follow-up
  editable-highlights change. Covered by the existing `DetailSection` inline-edit
  suites plus a new `InlineFieldInput` parity test.

- 4afb251: Record-level inline edit polish (objectui#2572, follow-up to #2407) — the five
  rough edges from the live showcase verification pass:

  - **Expanded reference values pass through to the picker.** `InlineFieldInput`
    no longer collapses an `$expand`-ed record object to a bare id before
    handing it to `LookupField` / `UserField` — the picker resolves the display
    name it already carries instead of re-fetching the referenced record via
    `findOne` (or sticking on the placeholder when it can't). `LookupField`
    still hands its Level-2 pickers (PeoplePicker / RecordPickerDialog) bare
    ids, collapsed via the existing `normalizeId`.
  - **Approval-lock preflight.** The record page now re-reads the approval
    state whenever the record is invalidated (a save can _trigger_ an approval
    flow that locks the record), derives one `approvalLocked` signal
    (`approval_status` pending/in_approval OR an open pending request), gates
    the inline-edit session's `canEdit` with it — hiding the pencil affordances
    and no-op'ing `enter()` on a locked record — and drives the save bar's
    `locked`/`lockedHint` so users can't type into a draft that Save would
    reject with `RECORD_LOCKED`.
  - **Numeric field types edit with the real numeric widgets.** `number` /
    `currency` / `percent` route to `NumberField` / `CurrencyField` /
    `PercentField` (the same widgets the form uses) instead of a free-text
    input: numeric keyboard, symbol adornment, fraction↔percent display
    conversion, and numbers (not strings) into the draft. `NumberField` and
    `CurrencyField` now surface metadata `min`/`max` on the input, `NumberField`
    honors an explicit `step` and steps by 1 for `scale: 0` (previously fell
    back to `any`).
  - **Header Edit CTA stands down during an inline session.** The synthesized
    `sys_edit` action carries `disableDuringInlineEdit`, and the `page:header`
    renderer greys such actions out while `InlineEditContext.editing` — the
    classic form-edit surface can no longer be stacked on top of a live inline
    draft.
  - **Keyboard shortcuts for the shared edit session.** `InlineEditSaveBar`
    binds **Esc → cancel** (deferring to any open Radix layer — popover /
    select / dialog — which owns Escape for "close") and **Cmd/Ctrl+Enter →
    save**, both respecting `saving`/`locked`.

- 2712fc1: fix(fields+detail): resolve the pre-existing rules-of-hooks violations in the cell renderers

  - `CurrencyCellRenderer` / `EmailCellRenderer` / `PhoneCellRenderer` called
    hooks (`useLocalization`, `useFieldLabel`, `useState`) **after** their
    empty-value early return — a value flipping between null and set changed
    the hook count between renders (latent "Rendered more hooks than during
    the previous render" crash). Hooks now run unconditionally before the
    early return.
  - `useFieldLabel` wrapped `useObjectTranslation()` in try/catch; a throw
    after other hooks ran would desync hook order. The underlying hook is
    provider-safe (optional context + global i18n fallback), so the guard is
    removed.
  - `ReferenceCellRenderer` no longer constructs JSX inside try/catch (the
    try can't catch render errors anyway) — the display string is computed in
    the try, rendered outside.
  - `RecordMetaFooter`'s UserRef renders the registry cell renderer via
    `React.createElement` instead of a locally-assigned capitalized JSX tag
    (flagged as component-creation-during-render; the registry reference is
    stable).

  No behavior change intended; eslint react-hooks errors on these files drop
  to zero.

- f0f10f5: feat(kanban): default lane field honours the ADR-0085 `stageField` role

  Kanban views without an explicit `groupByField`/`groupField` hard-coded their
  lane field to the literal `'status'` (in both app-shell's ObjectView options
  and plugin-list's ListView fallback) — ignoring the object's declared
  lifecycle and even inventing a field the object doesn't have. The default now
  resolves through the shared `stageField` detector:

  1. explicit view config (unchanged, always wins);
  2. the object's `stageField` semantic role;
  3. `stageField: false` → **no default lanes** (the status-shaped field is
     declared non-linear; the board renders its empty state until the view
     picks a lane field explicitly);
  4. else the shared name/type heuristic (status / stage / state / phase by
     name, then status/stage by type) — never a nonexistent field.

  `detectStatusField` moved from `@object-ui/plugin-detail` to
  `@object-ui/types` (new export, with the `StatusFieldSource` input type) so
  plugin-list and app-shell share the exact semantics; plugin-detail re-exports
  it unchanged.

  Also fixes ListView's pre-existing rules-of-hooks error while touching the
  file: `useListFieldLabel` wrapped `useObjectLabel()` in try/catch (hook-order
  desync risk; the hook is provider-safe) — same fix as objectui#2595's
  `useFieldLabel`.

  Behavior change is limited to kanban views with no explicit lane field on
  objects that either declare `stageField` (now honoured), declare
  `stageField: false` (now suppressed), or have no status-shaped field at all
  (previously grouped by a nonexistent `status` into one "undefined" lane; now
  an honest empty state). Objects with a real `status` field — the common case —
  are unchanged.

- Updated dependencies [82441e4]
- Updated dependencies [2efa9fd]
- Updated dependencies [e628d1f]
- Updated dependencies [23d65c3]
  - @object-ui/i18n@14.1.0

## 14.0.0

### Patch Changes

- eef832b: 修复记录抽屉绕过甘特图行级锁定的问题(#2436 第 5 项)。

  - `RecordDetailDrawer` 的编辑/删除能力现在由调用方是否传入 `onFieldSave` / `onDelete` 决定:两者都省略时抽屉严格只读(无内联编辑、无删除入口)。此前抽屉硬编码 `inlineEdit` 与 `showDelete: true`,并无条件向内层 DetailView 传包装函数,导致锁定记录仍可"编辑"(且改动静默丢失)。
  - `ObjectGantt` 对 `lockField` 锁定的行、以及全局 `readOnly` 的甘特图,不再向抽屉传入 `onFieldSave` / `onDelete`,与时间轴上禁止拖拽/调整的行为保持一致。

- 5971cc4: i18n: translate the Profile page, honor inline i18n label objects under bare
  base-language codes, and localize managed-by badges / record quick actions.

  - `pickLocalized` now upgrades a bare base language (`zh`) to any
    region-qualified key sharing the base (`zh-CN`) — runtime language is
    normalized to the base code while metadata authors write full BCP-47 tags,
    so inline `{ en, 'zh-CN', ... }` label objects previously fell back to
    English.
  - ProfilePage (`account:profile_card` / `/system/profile`): every hardcoded
    string — page title/subtitle, avatar Upload/Replace/Remove, Personal
    Information card, Change/Set Password card — now goes through
    `useObjectTranslation()` with `profile.*` keys (new namespace in all ten
    locale bundles); the lazy-load fallback reuses `common.loading`.
  - `ManagedByBadge` chips/tooltips (Config/System/Append-only/Identity) now
    resolve through new `managedByBadge.*` keys with `{{provider}}`
    interpolation.
  - `record:quick_actions` resolves action labels via the
    `objects.{object}._actions.{action}.label` convention plus `pickLocalized`,
    so object action buttons (Change Password, Enable 2FA, …) localize.
  - `record:details` / `record:related_list` / `record:alert` / `ObjectTree`
    pass inline label objects through `pickLocalized`.
  - Locale bundles: added `managedByBadge` namespace to all ten locales and
    backfilled `list.inlineEditShort` / `inlineEditLabel` /
    `recordEditingTitle` for ja/es/ko/de/fr/pt/ru/ar.

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
  - @object-ui/permissions@14.0.0

## 13.2.0

### Patch Changes

- 80901aa: Honor action `visible` (and `enabled`) predicates in three more action renderers.

  Following the data-table row-action fix, three sibling renderers still rendered schema-defined actions without evaluating their `visible` CEL predicate:

  - **`action:group` dropdown mode** (`@object-ui/components`) — dropdown items ignored `visible`/`enabled`, while the group's inline mode already honored them.
  - **Related-list `list_toolbar` header actions** (`@object-ui/plugin-detail`) — e.g. an organization's "Invite User" button ignored `visible`, even though the sibling row actions (fed by the same `deriveActions` bridge) already honored it via the data-table's `DataTableRowActionItem`.
  - **Grid bulk-action bar** (`@object-ui/plugin-grid`) — `bulkActionDefs.visible` was ignored entirely; the button is now hidden when the predicate is false (the `BulkActionDef.visible` doc comment is corrected from "disables" to "hides" to match).

  Each now evaluates `visible` (and, where applicable, `enabled`) via a hook-safe per-item component that mirrors `RowActionMenuItem` / `DataTableRowActionItem`, resolving `features`/`user` from the ambient `ExpressionProvider` scope. Rendering-layer only — no action definitions changed.

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

- Updated dependencies [53c40c2]
  - @object-ui/i18n@13.2.0

## 13.1.0

### Patch Changes

- @object-ui/i18n@13.1.0

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
  - @object-ui/permissions@13.0.0

## 12.1.0

### Patch Changes

- 47e72b8: Fix a React #300 crash when drilling from a master record into a related child record.

  `DetailSection` placed its all-empty `return null` guard _before_ the virtual-scroll `useEffect`, so a section that rendered all-empty on one pass (effect skipped) and populated on the next (effect runs) changed its hook count between renders of the same reconciled fiber — React threw error #300 ("rendered more hooks than during the previous render"). This reliably tripped on the master-detail drill-in (e.g. Account → Project), showing an error boundary and bouncing the user away on refresh. The all-empty guard now runs after every hook, making the hook count invariant.

- Updated dependencies [6cbccf3]
- Updated dependencies [e1840bf]
  - @object-ui/i18n@12.1.0

## 12.0.0

### Minor Changes

- e36a9c7: Align the DetailView column density with the entry form (objectui#2578 "多列显示").

  - **Detail views now reach up to 4 columns, matching the form.** `inferDetailColumns` was hard-capped at 2 columns and the section column count was derived per-section, so a field-heavy record displayed 2 columns in detail but 4 in the edit form. It now uses the same density scale as the form's `inferColumns` (1 → 2 → 3 → 4 by field count) and `deriveFieldGroupDetailSections` derives the count from the object's _total_ field count and stamps it uniformly on every section — so view and edit read at the same width. The responsive grid classes and `getResponsiveSpanClass` ladder were extended through the 3- and 4-column breakpoints, and the effective column count is clamped to the number of visible fields so a lone field never sits at 1/N width.
  - **Long JSON values no longer spill into the neighbouring column.** `JsonCellRenderer` (used by `address`/`json`/`object`/`composite`/`record` fields) applied `truncate` to a bare inline `<span>`, where `overflow:hidden`/`text-overflow:ellipsis` never clip (there is no width box) and the accompanying `white-space:nowrap` also defeated the cell's `break-words`; a long name-keyed map or address JSON therefore overflowed into the adjacent GPS/color cell once the grid narrowed to multi-column. The renderer is now a `block max-w-full` element so `truncate` clamps to the cell width (full value still on hover), and the detail cell wrappers carry `min-w-0` so unbreakable values wrap instead of setting the track's min width.

### Patch Changes

- Updated dependencies [226fde9]
- Updated dependencies [e36a9c7]
- Updated dependencies [e4de456]
- Updated dependencies [68e2d1c]
  - @object-ui/types@12.0.0
  - @object-ui/core@12.0.0
  - @object-ui/components@12.0.0
  - @object-ui/fields@12.0.0
  - @object-ui/permissions@12.0.0
  - @object-ui/react@12.0.0
  - @object-ui/i18n@12.0.0

## 11.5.0

### Minor Changes

- 6fffd3d: Client-side data-invalidation bus — refresh data, don't rebuild UI (objectui#2269 P1).

  - `@object-ui/react` gains the bus: `notifyDataChanged({objectName, recordId?})`, `useDataInvalidation(objectName, recordId?)` (reader nonce), `subscribeDataChanges`, and `useMutationInvalidationBridge(dataSource)` which fans every dataSource write (`MutationEvent`) onto the bus. The bus also dispatches the legacy `objectui:related-changed` window event, so pre-bus listeners keep working.
  - The `key={refreshKey}` remount of `RecordDetailView` (AppContent) and the `key={actionRefreshKey}` remount of `DetailView` (RecordDetailView) are GONE: record data now refetches in place via the bus — scroll, collapsed sections, tabs and in-progress inline edits survive every save/action/undo. All nine action-success bumps became precisely-scoped `notifyDataChanged` calls; undo/redo use the operation's own `objectName`/`recordId`.
  - `RelatedCountStore` is wired to the bus (tab count badges refetch after any change to their object) and its `useSyncExternalStore` snapshot is now a monotonic version — previously it returned the same `Map` reference, so `emit()` never re-rendered subscribers and invalidations left badges stale; `useRelatedCountVersion()` is exported and drives the probe effect's re-fetch.
  - app-shell also gains the reserved URL-param registry (`urlParams.ts` — `form`/`formObject`/`formLink`/`tab`/`recordId`/`palette`/`shortcuts` constants replace scattered string literals) and AGENTS.md Commandment #8 (UI-state classification: state that must survive a data refresh may never live only in an uncontrolled component).

- 9255686: Record detail tabs are URL-addressable (`?tab=`) and survive subtree remounts (objectui#2257, ADR-0054 C3).

  - `buildDefaultTabs` emits STABLE semantic tab values (`details` / `related:<child>` / `related` / `activity` / `history`) instead of leaving the renderer to synthesize index-derived ones.
  - `PageTabsRenderer` honors `item.value`, a host-provided `schema.defaultTab` (validated against actual tabs) and `schema.onTabChange`; index fallback kept for authored schemas without values.
  - app-shell `RecordDetailView` restores the active tab from `?tab=` and writes it back with `replace` (tab switches never stack history), via the pure `withPageTabsUrlSync` page-tree injector (never mutates authored/memoized page schemas). Legacy `DetailView.autoTabs` wired to the same contract (`defaultTab`/`onTabChange`).
  - Fixes the tab strip resetting to Details after save-refresh remounts (`refreshKey`-style) and dev-StrictMode URL churn; enables `?tab=` deep links; invalid values fall back to Details.

### Patch Changes

- Updated dependencies [544d8eb]
- Updated dependencies [1072701]
  - @object-ui/i18n@11.5.0

## 11.4.0

### Minor Changes

- 144ab55: Consume the ADR-0085 object semantic roles from `@objectstack/spec@11.7.0`, retiring the per-surface hint dialects:

  - **Single-source fieldGroups derivation**: `plugin-form`'s `deriveFieldGroupSections` and `plugin-detail`'s `deriveFieldGroupDetailSections` are now thin adapters over the spec's `deriveFieldGroupLayout` (ADR-0085 §5) — forms, modals and detail pages render the SAME grouping from one implementation. The canonical `collapse: 'none' | 'expanded' | 'collapsed'` enum is honoured everywhere (deprecated `collapsible`/`collapsed` and `defaultExpanded` spellings still read for pre-11.7 metadata).
  - **`stageField` semantic role**: the detail stepper reads the top-level `stageField`; `stageField: false` now actually suppresses stage detection (previously the `false` handling was wired to the removed `detail.stageField` key, so spec-authored `false` fell through to the name heuristic).
  - **`highlightFields` rename**: default grid columns, card compact views, the detail highlight strip, child-record preview fields and interface-page default columns read the object's `highlightFields` (deprecated `compactLayout` spelling read as fallback for pre-11.7 metadata).
  - **Removed dead reads**: the never-spec-writable `objectDef.views.*` UI hints and the ADR-0085-removed `detail.*` block (`sections`, `sectionGroups`, `highlightFields`, `stageField`, `useFieldGroups`, `showReferenceRail`, `hideReferenceRail`, `hideRelatedTab`, `relatedLayout`) are no longer consulted. Per-page customization goes through an assigned Page schema (`record:reference_rail` remains available there as a renderer capability). `detail.renderViaSchema` survives only as the legacy-renderer kill-switch and is removed together with that path.

- 19f2533: Detail-page related lists: `relatedList: 'primary'` → own tab, multi-FK & self-referential related lists, unified picker columns (framework #2579).

  - **plugin-detail** (`buildDefaultTabs`): the default related-list layout is now
    the ADR-0085 prominence rule — lists whose FK declares `relatedList: 'primary'`
    each get their OWN tab; every other related list collapses into a single
    "Related" tab. With no primary lists this is byte-for-byte the previous stacked
    default, so it is opt-in per relationship. `relatedLayout: 'tabs' | 'stack'`
    remain app-level overrides (force all-own-tabs / all-stacked).
  - **app-shell** (`deriveRelatedLists`): emits one related list per eligible FK —
    a child referencing the parent through several relationships (e.g.
    `primary_account` + `partner_account`) now surfaces each, disambiguated by the
    FK label; includes self-referential relationships (hierarchies → a "child"
    list); and carries the `isPrimary` prominence flag through. `RecordDetailView`
    threads `isPrimary` into the synthesized page.
  - **fields** (`deriveLookupColumns`): the lookup-picker default columns now
    prefer the object's ADR-0085 `highlightFields` (then legacy `displayFields`,
    then the field walk) — the same "how to list this object" source the related
    list uses, so a picker and a related list of the same object agree with zero
    per-surface config.

  Pairs with the `@objectstack/spec` change that makes `relatedList` a tri-state
  (`boolean | 'primary'`) and `record:related_list` `columns` optional.

### Patch Changes

- 2edcaff: Drop the `compactLayout` fallback reads (6 sites: ObjectGrid default columns, deriveHighlightFields, RecordDetailView highlight strip + child preview, ObjectView ×2, InterfaceListPage). The deprecated spelling was retired from the spec by framework#2539 (framework#2536) — served metadata carries `highlightFields` only, so the fallbacks could never fire again; keeping them would teach the retired key to the next reader.
- 7782698: fix(components): page:header record title honours `nameField` via the unified ADR-0079 resolver

  The default console record detail page renders the synthesized `page:header`
  (`buildDefaultPageSchema`, renderViaSchema default-on), whose record-chip title
  chain probed `objSchema.primaryField` (not a spec property — always undefined),
  `titleFormat`, then hardcoded `name`/`full_name`/`title`/`subject`/
  `display_name`/`label` record keys. It never consulted the object's declared
  `nameField`/`displayNameField`, so an object titled by e.g. `subject` rendered
  `<ObjectLabel> <id-prefix>` as its H1 instead of the record's real name.

  `PageHeaderRenderer` now resolves through `getRecordDisplayName(objSchema, data,
{ deriveFromRecordKeys: false })` after the author overrides and before the
  legacy probes — mirroring `DetailView.resolveDisplayTitle` so both headers
  agree. `RecordDetailView`'s `primaryField` derivation and
  `buildDefaultPageSchema`'s highlight-strip dedup also honour
  `nameField`/`displayNameField`.

- Updated dependencies [9cd9be1]
- Updated dependencies [790558b]
  - @object-ui/i18n@11.4.0

## 11.3.0

### Minor Changes

- db5ebe4: Declare designer inputs for the `record:*` blocks (details, related_list,
  highlights, path) so they conform to the spec protocol (RecordDetailsProps /
  RecordRelatedListProps / RecordHighlightsProps / RecordPathProps in
  @objectstack/spec component.zod). They previously registered ZERO inputs — the
  visual designer could not configure them, and the spec↔frontend conformance
  check flagged 17 spec-only divergences. Now each block's inputs mirror its spec
  schema (columns/layout/sections/fields, etc.).

### Patch Changes

- Updated dependencies [d88c8ec]
  - @object-ui/i18n@11.3.0

## 11.2.0

### Minor Changes

- 32dbd6a: feat(detail): `relatedLayout: 'tabs'` — surface related tables as peer tabs via config

  Record detail pages can now show each related table as its own top-level tab
  instead of stacking them all inside a single **Related** tab — no custom page
  required. Set `detail.relatedLayout: 'tabs'` on the object; the synthesized
  record page then emits one tab per related list (label = the related list's
  `title`, falling back to its `objectName`, carrying its `icon`), slotted between
  the **Details** tab and **Activity** / **History**.

  - `buildDefaultPageSchema` (`@object-ui/plugin-detail`): new
    `BuildPageOptions.relatedLayout?: 'stack' | 'tabs'` threaded through
    `buildDefaultTabs` (the single choke point for the related-tab emission).
    `'tabs'` fans the related children out into peer tabs; `'stack'` (default)
    keeps the legacy single **Related** tab — **zero regression** when omitted.
    Still honours `hideRelatedTab` (no related tabs emitted) in both modes.
  - `RecordDetailView` (`@object-ui/app-shell`): reads
    `objectDef.detail.relatedLayout` per object and forwards it to the synth.

### Patch Changes

- @object-ui/i18n@11.2.0

## 11.1.0

### Patch Changes

- Updated dependencies [6726a2b]
  - @object-ui/i18n@11.1.0

## 7.3.0

### Patch Changes

- @object-ui/i18n@7.3.0

## 7.2.0

### Minor Changes

- d23db5c: feat(detail): related-list add-by-picker (generic m2m/junction) + a generic "Assigned Users" management UI on permission sets (assign ai_seat and any role with zero bespoke CRUD; server-side cap errors surface inline).

### Patch Changes

- Updated dependencies [8e7c1da]
  - @object-ui/i18n@7.2.0

## 7.1.0

### Patch Changes

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

- f7f325d: feat: action progress state + Undo affordance

  - **core**: `ActionResult.undo` (an `UndoableOperation`) and `ActionDef.undoable`.
    On success the `ActionRunner` pushes the operation onto the global UndoManager
    and the success toast carries an "Undo" affordance (`ToastHandler` gains an
    `undo` option).
  - **app-shell**: the console action runtime mounts `useGlobalUndo` (Ctrl+Z /
    Ctrl+Shift+Z) and renders the toast's "Undo" button; its `apiHandler` resolves
    the row id from the list row record and, for `undoable` actions, captures the
    changed fields' prior values so the update can be reverted.
  - **plugin-detail**: record-header quick-action buttons show a spinner + disable
    while the action runs (a visible progress state for slow/flow actions).

### Patch Changes

- 3cc38fe: perf(detail/header): lazy + dedupe related-list fan-out, coalesce header polls

  Opening a record detail fired ~50 concurrent `/api/v1` requests that
  head-of-line-blocked one another on a single control-plane container.

  - `RecordDetailView` no longer eager-preloads reverse-reference children
    when the reference rail renders them (that data was discarded while the
    rail re-fetched the same collections).
  - `record:reference_rail` now gates fetching on visibility
    (`IntersectionObserver`; the rail is `hidden xl:flex`), caps concurrency
    at 3, and fetches once per `(parentId + entries)` via a signature guard,
    applying results through a mounted ref.
  - `AppHeader` inbox/notification, approvals, and activity pollers gained
    in-flight guards so bootstrap effect re-runs coalesce to one request; the
    approvals poll now sends one request with all identities comma-joined
    instead of one per identity.

  Measured locally: opening an environment detail dropped from ~52 to ~17
  requests, related collections from ×3–5 each to ×1, approvals from ×9 to ≤3.

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

- 650bd1f: fix(forms/dashboard/related-list): four business-facing rendering fixes found while QA-ing a showcase workspace

  - **plugin-form / WizardForm**: a multi-step `object-form` with `formType: 'wizard'` posted an empty/partial body on submit, so the server rejected every required field. Two causes: (1) the footer Next/Create buttons bypassed the inner form and submitted the wizard's own (never-collected) `formData`; (2) the create-mode data-seeding effect re-ran on `dataSource`/`objectSchema` identity churn and reset `formData` to `{}` mid-wizard. Now the buttons submit the inner form natively (`<form id>` + `type="submit"`, which validates each step and collects values via `getValues()`), and the create seed is made idempotent.
  - **plugin-dashboard / DashboardRenderer**: chart widgets rendered as empty cards (recharts logged `width(-1) height(-1)`) because the positioned grid used `auto-rows-min`, collapsing any widget with no intrinsic height. The explicit-columns grid now uses `gridAutoRows: minmax(5rem, auto)` so spanned chart rows get a real height while tables can still grow.
  - **plugin-detail / RelatedList**: auto-derived related-list columns led with system audit fields (`created_at`, `updated_at`, …) for child objects without a name/title field, pushing business columns past the column cap. System audit fields are now sorted last.
  - **plugin-form / ObjectForm + WizardForm**: a successful create/update gave no feedback for metadata-only pages (which can't pass an `onSuccess` function). They now show a default `toast.success('Created'/'Saved')` when no `onSuccess` handler is supplied (guarded so a `submitHandler` host like MasterDetailForm never double-toasts).

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
  - @object-ui/permissions@7.0.0

## 6.2.3

## 6.2.2

## 6.2.1

## 6.2.0

## 6.1.0

## 6.0.4

## 6.0.3

## 6.0.2

## 6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0
- @object-ui/core@6.0.0
- @object-ui/react@6.0.0
- @object-ui/components@6.0.0
- @object-ui/fields@6.0.0
- @object-ui/permissions@6.0.0

## 5.4.2

## 5.4.1

## 5.4.0

## 5.3.2

## 5.3.1

## 5.3.0

## 5.2.1

## 5.2.0

### Minor Changes

- 7c441f5: End-to-end @-mention notifications.

  `@object-ui/plugin-detail` now exports `extractMentions(text, suggestions)`
  — a small utility that resolves `@<label>` tokens in a comment body to
  user ids, using the same suggestion list that drives the in-editor
  dropdown. Handles labels with spaces ("@QA Test"), CJK ("@王小明"),
  longest-match disambiguation ("Anna Lee" wins over "Anna"), and ignores
  unknown @-tokens. 9 unit tests.

  `@object-ui/app-shell` `RecordDetailView` now:

  1. Serializes the resolved mention ids into `sys_comment.mentions`
     (previously hard-coded `'[]'`, so servers had no idea who was being
     pinged).
  2. Fan-outs a `sys_notification` row per mentioned recipient
     (self-mentions are filtered as noise) with the canonical bell-inbox
     shape: `type: 'mention'`, `recipient_id`, `actor_name`, `title`,
     `body` preview (≤140 chars), `source_object`/`source_id`/
     `source_comment_id`, `is_read: false`, `created_at`.

  The notification write tolerates 404 silently, so deployments without
  a notification collection degrade to the previous behavior (mention
  text + highlight, no inbox row). Spec-compliant servers that emit
  notifications via their own sys_comment after-create hook can ignore
  the client-side write — the bell de-dupes by id at the polling layer.

- 70b5570: `record:path` now distinguishes won/lost terminal stages. Stages can opt
  in via the new `terminal: 'won' | 'lost'` property on each stage entry,
  and the renderer also falls back to a value/label heuristic (matches
  `closed_lost`, `lost`, `failed`, `cancelled`, `失败`, `流失`, `丢单`, etc.)
  so existing CRM-style picklists get the treatment without migration.

  - **Lost** stages render in a visually separated group with a left
    border, destructive (red) tint, pill shape, and `✗` glyph — mirroring
    the Salesforce / HubSpot alt-terminus pattern that signals "this
    breaks the forward path, not steps past it."
  - **Won** terminus (the last stage of the forward chevron) gets a subtle
    emerald wash + 🏆 glyph to read as "the goal," even before the record
    reaches it.
  - Mobile pill row distinguishes lost via color, since the layout doesn't
    have room to fork the row.

- 3216f8a: `buildDefaultPageSchema` now accepts a `slots.rightRail` override that
  contributes nodes to the aside (right-rail) region. The aside region is
  emitted whenever either the auto-detected reference rail OR
  `slots.rightRail` is non-empty (previously: only when 2+ related lists
  were declared). Slot contributions are appended after the canonical
  `record:reference_rail` so the "related summary" stays anchored at the
  top while plugins can drop activity feeds, workflow status cards,
  presence lists, etc. beneath it.

  No change for existing schemas — the aside region only renders if
  something opts in.

### Patch Changes

- a3cb88f: CRM UX polish batch:
  - Kanban columns: drop the per-column rainbow top stripe. Lane border + header divider are sufficient; cards are now the loudest thing on screen (Linear / HubSpot pattern).
  - Stage chevron (`record:path`): bump completed-stage contrast (emerald-800 text on emerald-500/15, was 700 on /10) and future-stage text from `foreground/70` to `foreground/85` for legibility.
  - i18n: add `notifications.emptyUnread`, `notifications.filterUnread`, `notifications.filterAll` (en + zh) so the InboxPopover Unread/All sub-filter renders in the active locale.
- 5425608: CRM UX polish pass — calmer enterprise look across detail + kanban.

  - **plugin-kanban**: column headers now use a 2px muted accent stripe with
    neutral foreground titles + a quiet grey count pill instead of full
    rainbow gradient + colored title + colored count. Pipeline boards
    (Opportunity, Case, Task, Lead) look like Salesforce/Linear instead of
    a toy. WIP-limit overflow remains destructive-red so urgency stays loud.
  - **plugin-detail (`record:reference_rail`)**: new `hideEmpty` prop
    (default true) collapses entries whose total === 0 into a single
    `+ N empty (Quotes · Products …)` chip at the bottom of the rail.
    Removes the 4–7 "No records" stack that dominated the aside.
  - **plugin-detail (`record:path`)**: completed stages now render with an
    emerald-tinted background + bold green check instead of low-contrast
    `bg-muted text-muted-foreground` (which read as "light grey on white"
    and was borderline unreadable).
  - **app-shell (`RecordDetailView`)**: record-not-found short-circuit.
    Previously a stale/missing recordId still rendered the page chrome
    (rail, discussion, breadcrumb with the raw id), making invalid links
    look like a partially broken page. Now renders a clean centered
    `Empty` state with database icon + i18n'd "Record not found" copy.
  - **i18n**: added `detail.showEmptyRelated_{one,other}` and
    `empty.recordNotFound{,Description}` keys (en + zh).

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

## 5.1.1

## 5.1.0

### Minor Changes

- d1ec6a2: Fold inline-edit into the page-header overflow menu (HubSpot/Lightning
  pattern) and remove the orphan "Edit fields" toolbar row that previously
  floated between the tab strip and the first detail section.

  - `@object-ui/app-shell` `RecordDetailView`: injects a new `sys_inline_edit`
    system action that appears in the ⋯ overflow menu and dispatches a
    `objectui:record:inline-edit-toggle` window CustomEvent (filtered by
    recordId + objectName).
  - `@object-ui/plugin-detail` `DetailView`: listens for that event to
    toggle inline-edit mode; the in-page toolbar now renders only during
    active editing / save error / locked states, so the idle layout flows
    tabs → first section card with no orphan row.
  - `@object-ui/components` layout containers: extended `KNOWN_LABEL_DICT`
    with zh-CN + zh-TW translations for common CRM related-list labels
    (Quotes / Products / Contacts / Accounts / Leads / Opportunities /
    Cases / Campaigns / Approvals / Documents / Emails / Calls / Meetings
    / Open Tasks / Closed Tasks), so authored English labels auto-translate
    in `page:accordion` / `page:tabs` items.

- cf30cc2: Polish Lightning record detail page layout.

  - `record:details` sections now render with Card chrome by default when a `title` is present, restoring visual grouping that was missing on pages like the opportunity detail page.
  - Section labels can be translated via the `{ns}.objects.{objectName}._sections.{name}.label` convention. Author each section with a stable `name` (e.g. `info`, `forecast`) and the renderer picks up the locale-specific label automatically. Falls back to the literal `label` when no translation exists.
  - The `page:header` action toolbar now collapses into a `⋯` overflow menu when more than two actions are present. The first business action stays inline; secondary system actions (Edit / Share / Delete) move into the menu, with destructive styling applied to Delete.
  - Header action labels resolve via the `{ns}.objects.{objectName}._actions.{name}.label` convention.
  - Removed the meaningless field-count Badge from collapsible section headers (the `2` chip next to "Description"). Field-count metadata wasn't useful in the header and added visual noise.
  - Synth-path `sys_delete` now carries `variant: 'destructive'` so the overflow menu can color it appropriately.

- 32306e8: feat(plugin-detail): conflict-resolution dialog for OCC

  When inline record-detail edits race a concurrent writer, the bound
  DataSource now raises `ConcurrentUpdateError` (HTTP 409
  `CONCURRENT_UPDATE`). `RecordDetailsRenderer` catches it and opens a
  new `<ConcurrentUpdateDialog>` showing the user's pending value next
  to the server's current value, with three resolution paths:

  - **Reload latest** — discard the pending edit and refetch.
  - **Overwrite anyway** — retry against the server's freshest version
    (still OCC-checked, but acknowledges "I've seen the newer version").
  - **Cancel** — close the dialog and leave the form untouched.

  The renderer now forwards `record.updated_at` as `{ ifMatch }` to
  `dataSource.update()`, so the server can detect stale writes. The
  component is re-exported as `ConcurrentUpdateDialog` /
  `isConcurrentUpdateError` from `@object-ui/plugin-detail` for hosts
  that need to surface the same UX from custom save paths.

  End-to-end OCC requires `@objectstack/client@>=4.2.0` (now wired) and
  backend support in `@objectstack/rest@>=4.2.0`.

- 49b1760: Polish the ConcurrentUpdateDialog and add i18n.

  - Internationalise all dialog strings (title, body, button labels, "your edit" / "current value" headings, audit-trail line) through `useDetailTranslation`. Locale strings added to `@object-ui/i18n` for English and Chinese.
  - Replace the plain dialog header with an amber warning badge + `AlertTriangle` icon to communicate that this is a conflict, not a routine confirmation.
  - Visually differentiate the two value blocks: amber tint for the user's pending edit, sky tint for the server's current value. Both wrap long values cleanly.
  - Surface audit provenance for the racer's write (`updated_at`, plus `updated_by_name`/`updated_by_label` when supplied). Opaque ID-looking `updated_by` tokens are suppressed.
  - Re-prioritise the action buttons: **Reload latest** is now the primary/recommended action (autofocused), **Overwrite anyway** is rendered as a destructive-outline button so the dangerous path requires deliberate intent, and **Cancel** falls back to a ghost variant.

- 8fd863e: Platform highlight + list polish:
  - **deriveHighlightFields**: extended the preferred-field list (close_date, due_date, account, contact, …) and now skips fields whose declared type is not "highlight-friendly" (textarea, markdown, json, boolean, rich-text, etc.). Untyped legacy fields still pass through. Prevents long-form/structural fields from ending up in the highlight strip on objects with sparse metadata.
  - **ListView bulk-action labels**: bulk-action buttons now resolve their labels through `actionLabel(objectName, action, fallback)` so they pick up app-supplied translations under `_actions.<name>.label`, matching the detail-page page-header overflow menu. Falls back to the previous title-cased string when no resource is found.

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

- fbd5052: Tighten record-detail visual rhythm. Section card titles were rendering at
  Shadcn's default `text-2xl` which dominated the page; the related-list
  accordion in flush mode dropped all per-item borders so the collapsed
  "Quotes / Products / Open Tasks" triggers stacked with zero visual
  separation.

  - `@object-ui/plugin-detail` `DetailSection`: override the `CardTitle`
    className to `text-base font-semibold tracking-tight`, slim down
    `CardHeader` padding (`py-3 px-4 sm:py-4 sm:px-6`) and `CardContent`
    vertical padding so titles + content read as a single tight block
    rather than a billboard. Demoted the section description from `text-sm
mt-1.5` to `text-xs mt-1` for the same reason.
  - `@object-ui/components` `PageAccordionRenderer`: in the default
    `flush` variant restore a subtle `border-b last:border-b-0` divider
    between accordion items so collapsed siblings get a separator, and
    style the trigger as `text-sm font-semibold tracking-tight
hover:no-underline` (Shadcn's hover-underline default looks busy on
    CRM-style related-list lists).

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

- a49f300: feat(detail): per-object Reference Rail opt-out via `objectDef.detail.hideReferenceRail`

  The Record-detail Reference Rail (right-hand related-list summary cards)
  can now be suppressed on a per-object basis without authoring a full
  custom `Page`. Catalog-style objects (Product, Task) ship with the rail
  off by default; hub objects (Account, Opportunity, Contact, Case) keep it
  on.

  - `RecordDetailView` now reads `(objectDef as any)?.detail?.hideReferenceRail`
    and `…?.hideRelatedTab` and threads them to `buildDefaultPageSchema`.
  - The Reference Rail renderer also accepts entries authored as either a
    flat `entries` array or nested under `properties.entries`, so explicit
    `Page` authors can opt-in via the standard spec shape.
  - See `packages/plugin-detail/README.md` (Reference Rail decision matrix)
    for the rationale and per-object guidance.

- 1cb6e21: feat(plugin-detail): suppress Related tab when Reference Rail is auto-emitted

  When `buildDefaultPageSchema` decides to emit the Reference Rail (≥ 2
  related lists), the duplicate `Related` tab is now suppressed by
  default. The same data appeared in both places before, which is
  visually noisy and risks confusing users when one surface refreshes
  out-of-step with the other.

  Behavior matches HubSpot / Microsoft Dynamics: the rail is the single
  source of truth for related-list snapshots, and each rail card now
  exposes a `View all` link that deep-links into the child object's
  filtered list view. Authors can opt back into both surfaces via the
  new `hideRelatedTab: false` option.

  The change is gated on the same `≥ 2` heuristic that emits the rail,
  so single-related-list pages keep the inline Related tab (where the
  rail wouldn't have helped anyway).

- d548d6b: Unify empty-state visuals across timeline + registered `empty` renderer.
  - `RecordActivityTimeline` and `ActivityTimeline` now use `DataEmptyState`
    instead of a bare `<p>` so empty timelines match list/related-list visuals
    (muted icon badge + centered copy).
  - The `ui:empty` schema renderer now delegates to `DataEmptyState`, giving
    schema-driven empty regions the same chrome as ad-hoc consumers.

## 5.0.2

## 5.0.1

## 5.0.0

### Major Changes

- bb2ea48: **Phase O.0 — fix: related-list shows wrong records (critical data bug)**

  `RelatedList` previously called `dataSource.find(api)` with no filter
  when auto-fetching, so every Related tab dumped the entire target
  object table instead of the records that actually reference the
  current parent (e.g. an Account showed every Contact in the system,
  not only contacts of that account).

  Two coupled fixes:

  1. `RelatedList` now requires `parentId` + `referenceField` to auto-
     fetch. When both are present it calls `dataSource.find(api,
{ $filter: { [referenceField]: parentId } })`. When either is
     missing it renders the empty state and logs a developer warning —
     never silently fetches the whole object.
  2. `RelatedCountStore` was sending the probe query as `{ where, limit }`
     which most data-source adapters silently ignored (the codebase
     convention is `{ $filter, $top }`). The tab-count badges were
     therefore showing the global object count, not the parent-scoped
     count. Switched to `$filter` / `$top` to match.

  `record:related_list` renderer threads `ctx.recordId` through as
  `parentId`; no schema author changes required.

  **Breaking:** custom callers that depended on `RelatedList` fetching
  the entire object table when `referenceField` is omitted will need to
  either pass `data` explicitly or supply both `parentId` and
  `referenceField`. The previous behaviour was a bug, not a feature.

### Minor Changes

- 542cca9: feat(detail): buildDefaultPageSchema synthesizer (Track 3 Phase G slice 1)

  Pure-function synthesizer that emits a canonical Lightning-style Page
  schema (`page:header` → `record:highlights?` → `record:path?` →
  `page:tabs` → `record:discussion?`) from an object definition and
  optional overrides. Also exports helpers `detectStatusField`,
  `deriveStages`, `deriveHighlightFields`.

  This is the foundation for converging the default `<DetailView>`
  output with custom Lightning pages. Phase H will wire it into
  `RecordDetailView`'s non-assignedPage branch so the default detail
  page renders through the same `<SchemaRenderer>` pipeline as custom
  pages, inheriting all Phase D/E/F polish automatically.

  No runtime behaviour change in this slice — synthesizer is exported
  but not yet consumed.

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

- bae8ba8: Phase N.3 + N.4 + N.6: record detail visual polish.

  **N.3 — Highlight strip packs left.** `HeaderHighlight` no longer
  stretches a 1-2 chip strip across the full page. Each cell is now
  `min-w-[8rem] max-w-[16rem]` and wraps via flexbox so sparse strips
  sit naturally at the left edge.

  **N.4 — De-duplicate highlight ↔ body.** `record:details` accepts a
  new `hideFields: string[]` prop. The synth pipeline auto-populates it
  with the highlight-strip field list so a field surfaced in
  `record:highlights` no longer appears a second time in the section
  grid below. Authors can also set it directly on the schema.

  **N.6 — Tab count badges only show when >0.** `page:tabs` suppresses
  the count pill when the count is exactly 0 (was rendering "0" as a
  muted badge on every empty Activity/History tab).

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

- bece8ca: Phase N (continued): merge custom record_header actions into `page:header`
  instead of emitting a sibling `record:quick_actions` node. This fixes a
  visual collision on objects (contact, account, ...) that author custom
  record_header actions: previously the floating quick-actions bar
  (`-mt-12` overlay) collided with the system Edit/Share/Delete cluster
  already rendered by `page:header`. Now all action buttons live on a single
  header row.

  `buildDefaultHeader` accepts an optional `actions` array; `buildDefaultActions`
  remains exported as a sub-builder for authors who explicitly want the
  floating quick-action bar via a slot override.

- 77c1877: **Phase O.1 — Cap detail body grid at 2 columns for denser, more legible layout.**

  The auto-layout previously emitted **3 columns** for sections with 11+
  fields, which on typical desktop widths produced very sparse rows
  (label/value cells filled ~30% of each column, lots of whitespace).
  Capped the inferred maximum at 2 columns so paired fields read as
  cleanly-aligned label/value pairs.

  Authors who explicitly set `section.columns: 3` retain the 3-column
  layout — only the auto-inference default changed.

- b14fe09: Phase P.0 + P.5: tighten record-detail header chrome.

  - `RecordTitleChip` collapses the title row to a single baseline-aligned line — H1, eyebrow object label, copy-id, favorite star — instead of the previous two-row title + subtitle layout.
  - `record:details` extends the highlight-field dedup set to also exclude the title field resolved from `objectSchema.primaryField` (or the standard `name`/`full_name`/`title`/`subject`/`display_name`/`label` fallbacks). Removes the duplicate row that previously echoed the H1 (e.g. "客户名称: Acme Corporation") inside the field grid.

- 1911d34: **Phase P.1 — Collapse empty Related-list cards to header-only.**

  Previously each empty related list rendered a full Card with a 200px+
  "暂无相关记录" empty-state block (header + 32px icon + label +
  optional CTA). With 5-10 related objects mostly empty (common on
  fresh records), the Related tab became a wall of empty cards
  spanning 1500+ vertical pixels.

  Now: when a related list has zero records (and isn't loading), the
  CardContent is skipped entirely. The header row shows the title +
  `(0)` badge + an inline italic "暂无相关记录" hint + the `+ 新建`
  button (downgraded to ghost variant). A 200px empty card becomes a
  40px row.

  Lists with data are unchanged.

- ba98039: **Phase P.2 — Collapse CREATE event field-dump in History timeline.**

  CREATE events render every populated field as a `from: — → to: value`
  diff row. For a record with 20+ fields this turned the History tab
  into a wall of debug-looking `Field: — → value` lines.

  For `action === 'create'` we now render a single `▸ N fields
populated` disclosure that expands on click. The expanded view shows
  just `Field: value` (no useless `— →` arrow), since for a creation
  event the "from" is implicitly empty.

  UPDATE / DELETE events are unchanged — their field diffs are
  genuinely informative.

- 86c04f1: Phase Q: unify record-detail visual rhythm — one canvas, one box idiom.

  Audit revealed three competing chrome treatments fighting on the same
  page: the highlight strip was a filled Card, the discussion panel was
  another filled Card, the related-list cards used heavy borders — while
  the title chip, field grid, and history timeline were naked. The
  result was visually noisy ("有的下划线，有的有边框，有的没边框").

  This change commits to a single design language:

  - **Highlights** (`HeaderHighlight`): drop the `Card`/`CardContent`
    wrapper. Render as a borderless `<section>` of stat cells with a
    subtle `border-b` separator. The tab strip below now carries the
    only visible anchor in that vertical band.
  - **Discussion / activity feed** (`RecordActivityTimeline`): drop the
    `Card`/`CardHeader`/`CardContent` wrapper. Render as a borderless
    `<section>` with a top divider and a semantic `<header>` for the
    title. Right-side chatter panel still wraps with its own border so
    no chrome is lost in pinned mode.
  - **Related list** (`RelatedList`): keep the card grouping (each is a
    table of child records — earned chrome), but tone it down to
    `border-border/60 bg-transparent` so the boxes recede instead of
    competing with the rest of the canvas.

  Net effect: title / highlights / details / history sit on one
  continuous bg-background canvas separated by whitespace + hairline
  dividers; related lists are the one (subtle) boxed treatment, justified
  by their tabular content. No internal package APIs changed.

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

- 8b850b5: feat(detail): record:path chevron stepper + record:highlights surface refresh (Phase E)

  - `record:path` now renders Salesforce Lightning-style chevron segments
    (clip-path arrows + overlap) with a primary glow on the current step
    and a check mark on completed steps. On mobile (`<sm`) it falls back
    to a horizontally-scrollable pill row that keeps the same semantics
    but never overflows the viewport.
  - `record:highlights` surface drops the dashed border in favour of a
    solid `bg-muted/40` card with a softer border, so the highlights
    strip reads as a continuous extension of the header chip above it
    rather than a separate framed widget.

- fa4c2cb: feat(detail): renderViaSchema opt-in routes default detail through SchemaRenderer (Track 3 Phase G slice 2)

  When `?renderViaSchema=1` is in the URL, or `objectDef.detail.renderViaSchema === true`,
  `RecordDetailView`'s no-assignedPage branch now synthesizes a canonical
  Page schema (`page:header` → `record:highlights` → `record:path` →
  `page:tabs(record:details)` → `record:discussion`) via
  `buildDefaultPageSchema(objectDef, { sections, highlightFields })` and
  renders it through the existing `<SchemaRenderer>` pipeline.

  This means every object without a custom assigned page can opt in to
  the same chrome (record-aware header chip, chevron path, flush
  accordion, discussion slot) that custom Lightning pages already enjoy.

  Changes:

  - `buildDefaultPageSchema` now emits `page:tabs.items` (correct shape
    for the renderer) rather than `tabs`.
  - `PageHeaderRenderer.resolvedTitle` honors `objectSchema.primaryField`
    before the legacy `name/title/display_name/label` fallbacks.
  - `RecordDetailView` rebuilds the synthesized schema with
    `detailSchema.sections` + `highlightFields` at render time so
    `record:details` inherits the same field layout the legacy
    `<DetailView>` would have produced.

  Flag is intentionally off by default — flipping the default is a
  separate explicit commit after empirical parity validation across
  multiple objects. Known gaps tracked for slice 3: titleFormat
  fallback for objects without `primaryField`, auto Activity / History
  tabs, header-action buttons.

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

- 34b66bf: feat(detail): synthesize Related / Activity / History tabs + record:quick_actions header (Track 3 Phase G slice 4)

  - `buildDefaultPageSchema` now accepts `headerActions`, `related`,
    `showActivity`, and `history` options. When provided, the synthesizer
    emits a `record:quick_actions` node after `page:header` and appends
    the corresponding tabs to `page:tabs.items` in stable order
    (Details / Related / Activity / History).
  - New `record:history` renderer wraps the existing `HistoryTimeline`,
    reading `entries` / `loading` from the schema. Host owns fetching.
  - `RecordDetailView` forwards `detailSchema.actions[0].actions`,
    `detailSchema.related[]` (unwrapped to `{objectName,relationshipField}`),
    and `detailSchema.history` into the synthesizer call so the
    `renderViaSchema` path reaches parity with the monolithic DetailView
    tab strip and header action bar.
  - 6 new unit tests covering headerActions emit/skip, Related tab
    shape, Activity opt-in, History entries pass-through, and stable
    tab ordering.

  No behavior change for objects without the `renderViaSchema` opt-in.

### Patch Changes

- f16a762: feat(plugin-detail): cross-object detail-page convergence polish (Phase J)

  Two regression fixes surfaced by the Phase J browser canary across CRM
  record detail pages:

  1. **`record:path` now localizes stage labels.** The renderer threads
     `useSafeFieldLabel().translateOptions` against the record-context's
     `objectName` + the schema's `statusField`, so picklist labels match the
     active locale instead of leaking English (`New / Contacted / Qualified`)
     onto zh-CN pages. Falls back to the schema's authored labels when no
     i18n provider is mounted.
  2. **`deriveHighlightFields` skips system + primary fields.** Adds
     `organization_id`, `workspace_id`, `tenant_id`, `created_by`,
     `updated_by`, `deleted_by` to the skip set so the synthesized highlight
     strip stops leaking an orphan "CRM Test's Workspace" chip with no
     visible field label. Also skips the object's `primaryField` and common
     title-field candidates (`name`, `full_name`, `title`, `subject`,
     `display_name`) so the strip never duplicates the page H1.

  `ObjectDefLike` gains an optional `primaryField` declaration to drive the
  new skip behavior. No spec changes; the field is already part of the
  upstream object schema.

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
  - @object-ui/permissions@5.0.0

## 4.8.0

### Minor Changes

- 06a4066: Mobile: render related sub-tables on record detail pages as a single-column
  gallery of cards (reusing the existing `object-gallery` renderer) instead of
  cramped multi-column tables. Non-first related sections start collapsed on
  mobile to keep the page scannable. Desktop behavior is unchanged. Touch
  targets on the section "+ 新建" button and header are enlarged on mobile.

## 4.7.0

## 4.6.0

### Patch Changes

- 8f490ad: test(perms): add field-level permission negative tests for DetailView
  and ListView. Mounts each consumer inside a `PermissionProvider` that
  denies read on a specific field and asserts the field never reaches
  the rendered DOM (sections, top-level fields, summary chips,
  constructed list columns). Closes the automated half of the Sprint 3-A
  "Known limitations" — backend enforcement is still required, but the
  client-side defence-in-depth is now regression-tested.

## 4.5.0

### Minor Changes

- ab5e281: `record:highlights` renderer normalizes rich field items.

  `RecordHighlightsComponentProps.fields` is now `Array<string | { name, label?, icon?, type? }>`. The renderer normalizes both forms before passing to `HeaderHighlight`, so schemas can attach per-instance label/icon overrides without editing the underlying object metadata. FLS and `redactFields` still apply on the normalized list.

### Patch Changes

- d714e85: Lookup display-name resolution now falls back through a Salesforce-style chain
  when an `$expand`'d reference object lacks a top-level `name`/`label`/
  `display_name`/`title` field:

  1. Standard display fields (existing behaviour)
  2. `salutation first_name last_name` composite — handles person records that
     only carry first/last name parts
  3. `email` — last-resort identifier, beats the opaque id

  Applies to `LookupCellRenderer`, `PageHeader.subtitle` interpolation,
  `DetailView` page-mode `titleFormat`, and the shared `formatRecordTitle`
  utility. Concretely: a Contact reference with `first_name: Bob`, `last_name:
Lin` and no `name` field now renders as `Bob Lin` everywhere — instead of
  the email or [object Object] fallback.

## 4.4.0

### Patch Changes

- 67dabe1: feat(page-header): first-class `actions` property on page:header

  PageHeader now accepts an `actions: ActionDef[]` (or string[]) property
  and renders the toolbar inline in the header's right-aligned action slot.
  Removes the need for authors to declare a sibling `record:quick_actions`
  node and the `-mt-12` visual offset hack to pair the toolbar with the
  title. The hack still applies for legacy schemas using the sibling form
  (via location:'record_header'); the new in-header rendering opts out via
  an `inline: true` flag automatically set by PageHeader.

- e33d575: Support dotted paths (e.g. `{account.name}`) in object `titleFormat`. When a
  placeholder resolves to an expanded reference object, automatically extract
  its `name`/`label`/`display_name`/`title` so detail page titles render the
  related record's display name instead of falling through to the object label.

## 4.3.1

### Patch Changes

- 0d8eb98: feat(detail): Salesforce-style record header + section field grid

  - `page:header` now renders an icon chip (resolves Lucide names via
    `LazyIcon`) plus subtitle, so detail pages can show
    "Name / Company" without an extra component.
  - `record:details` normalises string field entries (`fields: ['email']`)
    into the `{name, label?}` shape expected by `DetailSection`, and maps
    section `label` → `title`. Schemas authored against `@objectstack/spec`
    now produce a real grouped field grid instead of an empty card.

- b0bc410: feat(detail): pair quick actions with header, suppress duplicate title chip
  - `record:quick_actions` placed at `record_header` now visually pairs
    with the surrounding `page:header` (Salesforce Lightning placement)
    instead of orphaning into its own row below the title.
  - `record:details` defaults to `showHeader: false` on the inner
    DetailView so embedded record pages no longer render a duplicate
    title chip + star/copy buttons under the page header. The legacy
    standalone DetailView screens are unaffected (showHeader defaults
    to true on that direct path).

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

## 4.0.6

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

## 4.0.4

### Patch Changes

- d2b6ece: fix: externalize all bare imports in library builds

  Library builds (vite lib mode) now externalize every non-relative import instead of bundling third-party CJS dependencies into the published dist. This avoids inlined `require("react")` / `require("react-dom")` calls that cause `Calling \`require\` for "react" in an environment that doesn't expose the \`require\` function` runtime errors when consumer apps re-bundle the published dist.

  Specifically fixes:

  - `@object-ui/plugin-dashboard` no longer inlines `react-grid-layout` (and its transitive `react-draggable` / `react-resizable` CJS bundles). `react-grid-layout` is now declared as a peer dependency so consumers install a single ESM-friendly copy.
  - `@object-ui/components`, `@object-ui/plugin-calendar`, `@object-ui/plugin-charts`, `@object-ui/plugin-designer` no longer inline `react-i18next` / `i18next` / `use-sync-external-store` CJS shims.
  - All plugin packages now use a unified `external: (id) => !/^[./]/.test(id) && !id.startsWith(__dirname)` rule, ensuring future additions of CJS deps are automatically externalized.

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1
- @object-ui/core@4.0.1
- @object-ui/react@4.0.1
- @object-ui/components@4.0.1
- @object-ui/fields@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0
  - @object-ui/components@4.0.0
  - @object-ui/core@4.0.0
  - @object-ui/fields@4.0.0
  - @object-ui/react@4.0.0

## 3.4.0

### Patch Changes

- Updated dependencies [a2d7023]
- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
  - @object-ui/components@3.4.0
  - @object-ui/fields@3.4.0
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

## 3.3.1

### Patch Changes

- Updated dependencies [b429568]
  - @object-ui/components@3.3.1
  - @object-ui/fields@3.3.1
  - @object-ui/types@3.3.1
  - @object-ui/core@3.3.1
  - @object-ui/react@3.3.1

## 3.3.0

### Patch Changes

- @object-ui/types@3.3.0
- @object-ui/core@3.3.0
- @object-ui/react@3.3.0
- @object-ui/components@3.3.0
- @object-ui/fields@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0
- @object-ui/core@3.2.0
- @object-ui/react@3.2.0
- @object-ui/components@3.2.0
- @object-ui/fields@3.2.0

## 3.1.5

### Patch Changes

- @object-ui/react@3.1.5
- @object-ui/components@3.1.5
- @object-ui/fields@3.1.5
- @object-ui/types@3.1.5
- @object-ui/core@3.1.5

## 3.1.4

### Patch Changes

- @object-ui/types@3.1.4
- @object-ui/core@3.1.4
- @object-ui/react@3.1.4
- @object-ui/components@3.1.4
- @object-ui/fields@3.1.4

## 3.1.3

### Patch Changes

- @object-ui/types@3.1.3
- @object-ui/core@3.1.3
- @object-ui/react@3.1.3
- @object-ui/components@3.1.3
- @object-ui/fields@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2
- @object-ui/core@3.1.2
- @object-ui/react@3.1.2
- @object-ui/components@3.1.2
- @object-ui/fields@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1
  - @object-ui/components@3.1.1
  - @object-ui/core@3.1.1
  - @object-ui/fields@3.1.1
  - @object-ui/react@3.1.1

## 3.0.3

### Patch Changes

- @object-ui/types@3.0.3
- @object-ui/core@3.0.3
- @object-ui/react@3.0.3
- @object-ui/components@3.0.3

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2
- @object-ui/core@3.0.2
- @object-ui/react@3.0.2
- @object-ui/components@3.0.2

## 3.0.1

### Patch Changes

- Updated dependencies [adf2cc0]
  - @object-ui/react@3.0.1
  - @object-ui/components@3.0.1
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
  - @object-ui/react@3.0.0
  - @object-ui/components@3.0.0

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

### Patch Changes

- Updated dependencies [b859617]
  - @object-ui/types@2.0.0
  - @object-ui/core@2.0.0
  - @object-ui/react@2.0.0
  - @object-ui/components@2.0.0

# @object-ui/plugin-view

## 17.7.0

### Minor Changes

- 53dc89d: **Breaking (shipped as `minor` per AGENTS.md §版本号策略).** `ObjectViewProps.views[].sort`
  now spells its direction key **`order`**. The retired spelling is **`direction`** — named
  here so that a host still writing it can find this entry by searching the old key
  (objectui#5293).
  
  ```diff
    <ObjectView
      views={[{
        id: 'recent', label: 'Recent', type: 'grid',
  -     sort: [{ field: 'created_at', direction: 'desc' }],
  +     sort: [{ field: 'created_at', order: 'desc' }],
      }]}
    />
  ```
  
  **Nothing that worked stops working on this surface, because on the `views` prop
  `direction` never worked.** All three consumers of the resolved `activeView.sort` read
  `order`: the non-grid fetch lowers it through the shared sink `convertSortToQueryParams`,
  whose `entry.order === 'desc'` is false for a missing key; the grid path forwards it to
  `ObjectGridSchema.sort`, where `ObjectGrid` builds the wire string `` `${s.field} ${s.order}` ``
  — literally `"created_at undefined"` — and `parseSchemaSort` reads a missing `order` as
  ascending, so the column header even drew an ascending arrow; `mergedSort` hands the same
  value to the delegated list view.
  
  So a host writing the exact shape the prop declared got an **ascending** list with no
  failure signal anywhere: the declaration said the value was well-formed, and the direction
  was dropped at three independent readers rather than rejected at one. This rename does not
  take away a feature — it converts a silent wrong answer into a loud type error at the one
  place that can still be fixed cheaply.
  
  **Scope — one published export still accepts `direction`, and this release does not retire
  it.** `toSortItems` (`packages/plugin-view/src/config/view-config-utils.ts`, re-exported
  from the package root and listed in the README) folds `s.order || s.direction || 'asc'`.
  It serves a different surface — the studio inspector-draft that feeds `SortBuilder` — and
  it is not reachable from the `views` prop, so it neither affects nor is affected by this
  rename. If you migrate by searching for the old key, that is the other hit you will find:
  it is dormant (nothing in this repo calls it outside a test), and removing it would be a
  separate break on a separate public export, tracked as objectui#6011. It is not a partial
  retirement of this one.
  
  `order` is the spelling every other sort surface already uses (`SortConfig`,
  `NamedListView.sort`, `ObjectGridSchema.sort` / `.defaultSort`, and the shared
  `QuerySortEntry` sink), so the prop now has one spelling repo-wide and declared equals
  enforced.
  
  ⛔ Deliberately **not** a tolerant dual-read (`direction ?? order`): that is the tolerance
  layer objectui#4869 ruled against, and admitting the old key as an alias would rebuild the
  drift this change removes. `SortUI` is untouched — it legitimately owns `direction` on its
  own `SortUISchema` and converts at its boundaries.
- e176053: Consolidate the seven lucide icon-name resolvers into one seam (objectui#5935).
  
  Seven modules resolved authored icon names into lucide's runtime `icons` record, each
  with its own copy of the logic: **three different tokenisers** (`split('-')` on five of
  them, `split(/[-_\s]/)` on one, `split(/[-_\s]+/)` on one) and the `Home` -> `House`
  rename on only **four** of the seven. The same authored name therefore rendered on one
  surface and not another — the sidebar-vs-action-bar disagreement objectui#5633 opened
  with. There is now one resolver, `resolveIcon`, exported from `@object-ui/components`,
  and the other six call it.
  
  **The tokeniser is `split(/[-_\s]+/)` with `Home` -> `House` applied universally, and it
  was measured rather than chosen.** Its regression set is empty three independent ways:
  against the authored population, against a maximally-pessimistic every-authored-name x
  every-surface cross-product, and against a bound-free differential over 8,298 spellings
  derived from all 1,767 live record keys — each with a discrimination control that fired
  in the same run. `split('-')` was **not** adoptable: it regresses 4,748 name-surface
  pairs in that last reading, stripping two surfaces of every snake_case and
  space-separated spelling they resolve today.
  
  **What changes for you — all of it widening, none of it removal.** No name that resolved
  before stops resolving: no key of lucide's record contains `_`, whitespace or `-`
  (measured: 0 of 1,767), so whenever the old narrow tokeniser produced a live key the
  wider one produces the same key. Sixteen name-surface pairs start resolving where they
  rendered a fallback or nothing before:
  
  - `layout_dashboard` and `building_2` (and every other snake_case or space-separated
    spelling) now resolve on the shared resolver, `ui:icon`, `ListView`'s empty state,
    `TabBar` and `ViewSwitcher` — they previously resolved only on the action preview and
    the related list.
  - `home` / `Home` now resolves on `RelatedList`, `ListView` and `TabBar`, which carried
    no rename map. `Home` is not a live record key, so this could only ever be a widening.
  
  **What does NOT change: what each surface draws when a name does not resolve.** The seam
  answers `name -> component`, returning `null`, and decides nothing else (maintainer
  ruling 2026-09-03 on objectui#5935). Every call site keeps its own fallback, visibly, at
  the call site: `ui:icon` keeps its `SquareDashed` placeholder and its warning
  (objectui#5631, untouched), `RelatedList` and `ListView` keep their `Inbox` glyph,
  `ActionPreview` keeps its three-character name chip, and the shared resolver, `TabBar`
  and `ViewSwitcher` keep `null`. A two-valued `onUnresolvable` parameter was ruled on and
  then dropped once the tree was measured to have four such behaviours rather than two: a
  lookup function is the wrong place to publish a presentation decision.
  
  `resolveIcon` is newly exported from `@object-ui/components`, which is the only surface
  this adds. `scripts/check-lucide-icon-record-names.mjs` is simplified in the same change:
  its census goes from seven sites to one, and its normalisation stops being a
  widest-common approximation of three disagreeing resolvers — so the under-reporting that
  gate disclosed at objectui#5932 is closed rather than merely bounded.
- c5fbe0b: **Breaking (shipped as `minor` per AGENTS.md §版本号策略).** The published `toSortItems`
  export now reads its sort direction from **`order`** only. The retired spelling is
  **`direction`** — named here so that a host still writing it can find this entry by
  searching the old key (objectui#6011).
  
  ```diff
    import { toSortItems } from '@object-ui/plugin-view';
  
  - toSortItems([{ field: 'created_at', direction: 'desc' }]);
  + toSortItems([{ field: 'created_at', order: 'desc' }]);
  ```
  
  **What changed, exactly.** `toSortItems` folded `s.order || s.direction || 'asc'`: two
  spellings for one key, silently preferring the canonical one. It now folds
  `s.order || 'asc'`. Everything else about the helper is unchanged — `id` is still
  preserved when present and minted with `crypto.randomUUID()` otherwise, `field` still
  defaults to `''`, and a non-array draft still yields `[]`.
  
  **The failure mode if you do not migrate is silent.** A draft entry spelled
  `{ field: 'created_at', direction: 'desc' }` used to produce
  `{ field: 'created_at', order: 'desc' }`; it now produces
  `{ field: 'created_at', order: 'asc' }` — the documented default for an entry that names
  no direction. Nothing throws and nothing warns: the `SortBuilder` row renders, and it
  renders **ascending**. If you have a studio inspector draft, a persisted view body, or any
  other producer that still writes `direction`, grep for the key and re-spell it to `order`.
  
  **Why the tolerant read went rather than staying.** objectui#4869 ruled that a spelling the
  sink does not recognise gets ruled into the contract or rejected at the producer, never
  absorbed by a tolerance layer. objectui#5293 retired the same word on
  `ObjectViewProps.views[].sort` and shipped it as a `minor`; this entry finishes the job on
  the sort family's public surface, so `order` is now the one spelling repo-wide and declared
  equals enforced. The scope note in the objectui#5293 entry — that this export was *not*
  retired by that change — described that release's scope correctly and is superseded here.
  
  `SortUI` is untouched. Its own file-local `toSortItems` is a different symbol, and
  `direction` is the key `SortUISchema` legitimately declares.
- b97790a: Seven more `find()` readers now read exactly what `QueryResult` declares — the
  `records` arm is removed from each (objectui#6726, following objectui#5945).
  
  `QueryResult` (`@object-ui/types`) declares exactly one rows member — `data` —
  alongside `total`, `page`, `pageSize`, `hasMore`, `cursor` and `metadata`.
  `records` is not a member of it. It is the spelling the server envelope and the
  client SDK use, which `ObjectStackAdapter.normalizeQueryResult` maps to `data`
  before returning — a *below*-the-adapter spelling that had leaked into
  above-the-adapter consumers. objectui#5945 removed it from two app-shell
  readers; these are the seven the same producer sweep turned up and that card did
  not name:
  
  | module | what it does |
  | --- | --- |
  | `components/src/hooks/related-count-store.ts` | related-list tab badge count |
  | `components/src/renderers/basic/data-list.tsx` | `element:repeater` rows |
  | `components/src/renderers/basic/elements.tsx` | `element:number` client-side aggregate |
  | `components/src/renderers/basic/record-picker.tsx` | `element:record_picker` options |
  | `plugin-detail/src/renderers/record-activity.tsx` | `record:activity` self-fetch |
  | `plugin-detail/src/renderers/record-history.tsx` | `record:history` self-fetch |
  | `plugin-view/src/ObjectView.tsx` | non-grid (kanban / calendar / gallery / timeline) fetch |
  
  **One of them was actively wrong, six were dead.** `related-count-store.ts`
  read `records` *ahead of* `data` — the precedence inversion objectui#5945 was
  filed about — so a `find()` answer carrying both would have been counted from
  the key the contract does not declare. The other six read `data` first, so their
  `records` arm could never be reached by a conforming producer. A dead tolerant
  arm is not harmless: it is where a non-conforming producer keeps working
  unrejected, and hardens into a second de-facto contract nobody is checking
  (AGENTS.md #0.1).
  
  **What stops being accepted.** A `find()` answer shaped `{ records: [...] }`
  now reads as **no rows** at these seams instead of silently resolving. Every
  call site degrades rather than throws: the tab badge counts 0, the repeater and
  the picker render their empty state, `element:number` reports 0, the activity
  and history feeds render empty, and the non-grid views paint no rows.
  
  **Nothing produces that shape at this seam today**, which is why this is a
  removal rather than a migration. Measured repo-wide over every tracked file:
  `ObjectStackAdapter.normalizeQueryResult` CONSUMES the server/SDK `records`
  envelope and returns `{ data, total, page, pageSize, hasMore }`; every other
  `find()` implementation in the repo (`ApiDataSource`, `ValueDataSource`, the
  runner and example mocks, the `@object-ui/types` REST example) returns `data`
  or a bare array. The `records` producers that DO exist are on other seams and
  are untouched: `ViewDataProvider`'s own `ResolvedData` interface, which declares
  `records` legitimately; the raw Cloud HTTP payloads `marketplaceApi.ts` and
  `packagedActions.ts` read; and the client-SDK doubles that sit *below*
  `normalizeQueryResult`.
  
  **The bare-array arm is kept** wherever it existed, because it is live: fakes at
  these seams answer with a plain array. Each module carries its own pin —
  `*.contractEnvelope-6726.*` — asserting the contract read, the live arms, and
  the refusal of `records`, so the live and the dead shapes cannot drift into each
  other.
  
  `QueryResult` is **not** widened to bless `records`; that would be a
  published-type change and a maintainer decision.
- c18d099: Read `find()` answers as `QueryResult` declares them on two more seams: the
  related-count badge store no longer reads `count`, and `ObjectView`'s non-grid
  unwrap no longer reads `value` (objectui#6840, following objectui#6726).
  
  `QueryResult` (`@object-ui/types`) declares exactly one rows member, `data`, and
  exactly one count member, `total`. objectui#6726 removed the `records` arm from
  seven consumers after measuring that nothing produces it at the
  `DataSource.find()` seam, and deliberately left two arms reading *other*
  undeclared keys standing in the same expressions — because it had measured
  `records` and not them. Its own pin says so in as many words. This is the
  measurement it deferred.
  
  - `related-count-store.ts` dropped `typeof res?.count === 'number' ? res.count`,
    which was tried second and *ahead of the contract's `data`* — the same
    precedence inversion objectui#5945/#6726 were filed about, on the key those
    cards did not measure. The store already asks the server for the count with
    `$count: true` and reads it back as `total`, which is a declared member.
  - `ObjectView.tsx` dropped the ladder's last branch,
    `Array.isArray((results as any).value)`. Unlike the store's arm this was a
    pure fallback, not an inversion — `data` was already read first.
  
  Both keys are the raw-payload spellings that `ObjectStackAdapter.normalizeQueryResult`
  and `ApiDataSource.normalizeQueryResult` already fold into `total` / `data`
  *below* this seam, so nothing above it emits them. A producer sweep over every
  `find()` definition body in the repo (452 bodies / 331 files, bracket-scanned so
  a body cannot leak into sibling properties) found `count` emitted **0** times,
  against controls `total` (85 hits / 75 files) and `data` (135 hits / 103 files)
  drawn from the same cells. Narrowed to the 25 bodies reachable by `ObjectView`,
  `value` is emitted **0** times against the same controls (6 and 6).
  
  No producer changes behaviour, because there is no producer; what changes is
  that a non-conforming one is now refused instead of silently absorbed — which
  is the point (AGENTS.md #0.1). Each module gets its own refusal pin
  (`*.contractEnvelope-6840.*`), and the pins keep the live arms green alongside
  the deleted ones, because live and dead is the whole distinction.
  
  Deliberately not done: `QueryResult` is **not** widened to bless `count` or
  `value`. That is a published-type change and the maintainer's call, the same
  floor objectui#6726 respected.
  
  The `value` reading here is **seam-local** and does not transfer: at
  `extractRecords` (`@object-ui/core`, objectui#6839) the same key is still LIVE —
  five test doubles in plugin-calendar / plugin-kanban emit it today.
- 2a7ac32: Calendar views no longer render on invented field names (objectui#7029; ruled on
  objectstack#13748, director batch #19, option A).
  
  A view that carried no `calendar:` block used to have a complete-looking calendar
  configuration synthesized for it. `ObjectCalendar` has always decided whether it
  has a usable configuration by asking whether a start-date binding is PRESENT, so
  the fabrication short-circuited its own refusal screen — "Calendar configuration
  required. Please specify startDateField and titleField." — which existed all
  along and was simply unreachable. Measured on a leave-request object whose real
  fields are `start_date` / `end_date`: every record piled onto today's cell under
  titles resolved through the display-name chain. A plausible, fully wrong screen,
  with zero signal to the author.
  
  Three faces were fabricating, on two independent routes to the same renderer:
  
  - `app-shell/ObjectView` emitted `startDateField: 'due_date'` and
    `titleField: 'name'` into `options.calendar` for every object view;
  - `plugin-list/ListView`'s calendar branch floored the same two bindings at
    `'start_date'` / `'end_date'` one layer down;
  - `plugin-view/ObjectView.generateViewSchema` — the authored `object-view`
    element route, which bypasses `ListView` entirely — carried its own copy.
  
  All three now forward only what the author declared. This converges the calendar
  on the shape its siblings already had: `timelineViewOptions` (objectui#3129
  retired this very literal from the timeline axis), the kanban lane detector
  (ADR-0085, "never invents a field the object doesn't have"), and
  `defaultCalendarFromObject` (a binding, or nothing).
  
  **Behaviour change, loud over silent.** With no binding to forward, ADR-0047's
  capability gate stops offering the Calendar toggle to views that configured
  none, and a view forced onto the calendar renderer reaches the refusal screen
  instead of a wrong one. A view that happened to sit on an object carrying a real
  `due_date` field was rendering by luck; it now refuses until its `calendar:`
  block is written. Correctly configured calendars are unaffected — same fields,
  same render. The same deletion also stops the fabricated name from answering for
  the Timeline switcher, which accepts a calendar binding as a legitimate axis.
  
  The spec half — cross-field validation rejecting a half-written declaration at
  authoring time — is objectstack#13817. This half makes the runtime honest
  independent of which spec version the host pins.
- 5f4514f: Gantt views no longer render on invented date field names (objectui#7070).
  
  The half PR #7062 fenced out and reported separately. A view that carried no
  `gantt:` block used to have a complete-looking date axis synthesized for it:
  all three faces floored `startDateField` at `'start_date'` and `endDateField`
  at `'end_date'` — field names no view had written and most objects do not
  carry.
  
  `ObjectGantt.getGanttConfig` takes its flat branch as soon as BOTH date props
  are present, so the fabricated pair short-circuited the renderer's own refusal
  screen — "Gantt configuration required. Please specify startDateField,
  endDateField, and titleField." — which existed all along and was simply
  unreachable from every route. The same fabrication answered ADR-0047's
  capability gate in `ListView.availableViews`, so the Gantt toggle was live on
  every object view in the product.
  
  ⚠️ The premise was MEASURED before anything was deleted, because #7029's
  mechanic is only correct where a refusal path exists and that had never been
  established for this renderer: on the unmodified tree, `ObjectGantt` REFUSES an
  absent binding — it does not render empty, and it does not throw.
  
  Three faces were fabricating, on two independent routes to the same renderer:
  
  - `app-shell/src/views/ObjectView.tsx` — the console object page. The inline
    branch becomes `ganttViewOptions`, the sibling of `calendarViewOptions` and
    `timelineViewOptions`: the declared block spread whole, title floored at
    `'name'`, no date field invented.
  - `plugin-list/src/ListView.tsx` — the render branch AND the capability gate.
  - `plugin-view/src/ObjectView.tsx` — `generateViewSchema`, the authored
    `object-view` element route, which bypasses `ListView` entirely.
  
  **What changes for an author.** A view that declared no gantt configuration is
  no longer offered the Gantt toggle, and one forced onto the renderer reaches
  the refusal screen instead of a plausible, fully wrong chart. A view that
  declared a binding is unaffected — the declared block is forwarded exactly as
  before, every spec key included.
  
  Also corrected: the objectui#3129 note at the top of `app-shell/ObjectView.tsx`
  certified the gantt branch below it as already using the safe two-rung shape.
  It did not. The note now states each sibling branch as measured, and says
  explicitly which fabrication REMAINS — the timeline `'created_at'` floor at the
  two plugin faces, which objectui#7070 routes to a ruling rather than settling
  per-face.
  
  Deliberately out of scope, and left in place: `progressField` / `dependenciesField`
  (not date axes, different absent-value semantics) and the timeline `'created_at'`
  posture conflict.
- 04a67b9: Retire the `'created_at'` timeline date-axis floors at both plugin faces
  (objectui#7070 step ③, maintainer ruling 2026-09-01, 总监批 #28).
  
  **Breaking, deliberately.** A timeline view that declares **no** date axis anywhere no
  longer renders. `ListView`'s and `ObjectView`'s timeline branches used to hand
  `ObjectTimeline` a `startDateField` of `'created_at'` for such a view; both now forward
  a declared axis or no key at all, and the renderer shows its "declare a date axis"
  refusal instead.
  
  House posture, entered with the ruling: **日期轴永不虚构** — a date axis is never
  fabricated. This is the third and last step of a sequence the ruling ordered and forbade
  reordering: `ObjectTimeline` gained the refusal screen and lost its own internal
  `|| 'date'` floor first (objectui#7459), which by its own measurement changed nothing a
  user could see — precisely because these two faces still supplied a name. They are the
  supply.
  
  The floor was not a harmless default. `'created_at'` is a column nearly every object
  carries, so downstream it was indistinguishable from a real binding and could never
  resolve to nothing — while the `$select` projection is collected from the **declared**
  `timeline` / `options.timeline` blocks and never from this prop. An undeclared view was
  therefore given a timeline bound to a column the query had not requested, and every
  record bucketed into "No date": a screen that looks built, is wrong, and gives the
  author no signal. The ruling also explicitly replaced the written decision that stood on
  the deleted `ListView` line ("`created_at` stays the last resort for a view that
  declares no date axis anywhere") — it was a second, de-facto contract held at one face,
  on the very literal objectui#3129 had retired at the app-shell face.
  
  **Migration.** Declare the axis on the view: `timeline.startDateField` (spec-canonical),
  `timeline.dateField` (legacy alias), or a `calendar.startDateField` — objectui#3129
  established that a calendar binding is a legitimate timeline axis, and it still is. All
  three keep rendering exactly as before; only the *undeclared* case changes. A view that
  really did want records laid out by creation time says so in one key:
  `timeline: { startDateField: 'created_at' }`. The refusal names the accepted keys on
  screen, so an affected view reports its own fix.
  
  `titleField` is unaffected and keeps its `'name'` floor at both faces — it is not a date
  axis. So do gantt's `progressField` / `dependenciesField`, which the ruling scoped out
  for separate evaluation.
- 6712930: The two kanban adapters stop writing the retired `groupField` onto the
  `object-kanban` node they generate (objectui#7773). `groupBy` — the key the
  renderer actually reads — is unchanged and is now the only lane key emitted.
  
  **What was measured, on this branch's base (`a915064e`).** Both adapters emitted
  the key twice:
  
  ```
  packages/plugin-view/src/ObjectView.tsx:1362   groupField: groupBy,
  packages/plugin-list/src/ListView.tsx:2500     groupField: laneField,
  ```
  
  The `object-kanban` renderer never read it: `groupField` has ZERO hits anywhere
  under `packages/plugin-kanban/`, against a control of thirteen `schema.groupBy`
  read sites in `ObjectKanban.tsx` from the same query — so the zero is a reading,
  not a blind grep. The write was inert; the board grouped by `groupBy` and
  `groupField` rode along unread.
  
  **Why it is removed rather than tolerated.** objectui#7322 RETIRED
  `groupField` on this node on both published faces — `groupField?: never` on the
  TypeScript interface and a `retirementTombstone()` in the Zod mirror, which
  refuses an authored value BY NAME. So the adapters were producers emitting a
  node their own published contract rejects. That was harmless only because a
  generated node never reaches the mirror at runtime (`SchemaRenderer` runs the
  structural `validateSchema`, not `safeValidateSchema`) — but the CLI's
  `os check` / `os validate` DO run the mirror, so the identical node was already
  refused when authored by hand and admitted when generated. This closes that
  split.
  
  **What changes for a consumer.** Nothing on any documented path: the renderer's
  behaviour is byte-identical, because it never read the key. A host that
  registers its own `object-kanban` component and reads `props.schema.groupField`
  off the generated node now reads `undefined` — read `groupBy` instead, which
  carries the same value and always did. Graded `minor` rather than `patch` for
  exactly that narrowing, following the repo convention that objectui's own
  breaking changes ship as `minor` (AGENTS.md 版本号策略, mechanically enforced by
  `scripts/check-changeset-no-major.mjs`).
  
  **Who is NOT affected — the boundary is node-local.** Every VIEW-LEVEL
  `groupField` read is untouched and still live: it is a legacy alias of the
  spec's `groupByField` on the kanban *view config*, mapped by
  `normalize-list-view.ts`, and both adapters still resolve lanes through it
  (`ObjectView.tsx`'s `kanbanCfg.groupField ||`, `ListView.tsx`'s
  `groupByField || groupField`). Authoring `options.kanban.groupField` on a
  `list-view` or `object-view` keeps working exactly as documented in
  `packages/plugin-list/README.md`. `groupField` is dead only on the generated
  `object-kanban` NODE.
  
  The two tests that pinned the duplicate write are TURNED, not deleted — they now
  assert the key is absent, so restoring the write reddens them instead of being
  silently re-blessed by a missing assertion.
- 4ef29f0: Remove the inert `showRefresh` designer input from the `object-view` registration (objectui#5567).
  
  The `object-view` designer no longer offers a "Show Refresh Button" toggle, and the registration no longer defaults `showRefresh: true`. The key was declared, documented, and defaulted, but `ObjectView` never read it — an author who wrote `showRefresh: false` on an `object-view` node always got a no-op. **Behaviour is unchanged for every existing app**, because nothing ever consumed the key.
  
  Migration: nothing to do. If you wrote `showRefresh` on an `object-view` node, the key simply disappears from the designer's property panel; it never controlled anything. The live refresh channel is `userActions.refresh` (rendered by the list toolbar in `@object-ui/plugin-list`), which is unaffected. `showRefresh` on other surfaces (e.g. `CRUDToolbar`) is also unaffected.
  
  `@object-ui/app-shell` only drops its two producer writes of the dead key (the app `ObjectView` wrapper and the metadata-admin `ViewPreview`) — no user-visible change.
- 2d36552: Pins `@objectstack/spec`, `@objectstack/client`, `@objectstack/formula` and `@objectstack/lint` to `17.1.0`, and adapts the two consumer surfaces the new build moves.
  
  The pin itself is a lockfile refresh — every manifest already declared `^17.0.0`, which admits `17.1.0`, so no dependency range changed. All four move together: a split resolution is what produced the dual-version spec graph that reddened `check:spec-symbols` in this repo's history.
  
  **A `icontains` filter now reaches the driver as a filter.** `icontains` is a canonical `VIEW_FILTER_OPERATORS` member as of `17.1.0`, so an author can declare it on a `ViewFilterRule` and the spec validates it — but `@object-ui/data-objectstack`'s alias table had no row for it, and an unmapped operator is how this adapter shipped an unfiltered query before (objectstack#3948). It is an identity row like `contains`: `icontains` is itself a member of `VALID_AST_OPERATORS`, so the spelling the author writes is the spelling the AST takes, and no case-sensitivity is translated away. Declared rather than left to the table's `?? op` fall-through, on the rule its own parity test states — the AST gate accepting a spelling is not the driver compiling it into a `WHERE` clause.
  
  The same operator reaches the list view's own bridge: `@object-ui/plugin-list`'s `mapOperator` gains an explicit `icontains` arm. The emitted spelling is identical to the input, but the arm is written out rather than left to the `default` passthrough — `icontains` is its own member of `VALID_AST_OPERATORS`, so a raw passthrough is accepted *today*, and depending on that coincidence is what the bridge's own parity test records as how it once stopped discriminating.
  
  `@object-ui/core` adds `onSuccess` to its spec key inventory, so an author writing the key `17.1.0` now declares is no longer warned that it is unknown. That is a diagnostic statement only — the four declared action surfaces still drop the key before it reaches the runner, which is tracked separately.
  
  **A stored view filtering case-insensitively still shows that operator when it is reopened.** `@object-ui/plugin-view`'s canonical-to-builder table is keyed by `ViewFilterOperator`, so `17.1.0` adding `icontains` failed to compile rather than letting the operator reach the FilterBuilder as a raw spelling its dropdown cannot select. It maps to the builder's `containsCaseInsensitive` — the id that authors the spec's `$icontains` — and deliberately not to `contains`, which would quietly rewrite a case-insensitive filter into a case-sensitive one the next time the view was saved.
  
  **The page-editor palette keeps one entry per renderer.** `17.1.0` retires `element:filter` from `PageComponentType` and adds `record:discussion`, leaving the member count at 34 either side — so the swap is invisible to any count-based reading. The stale `element:filter` exclusion is dropped, and `record:discussion` is excluded because it is the *same renderer* as the already-offered `record:chatter`, not because it is unauthorable. Nothing the palette offers changes.
  
  **The console eager-closure ceiling is re-baselined, by maintainer ruling.** The release is roughly 930 KB larger uncompressed and nearly all of it lands in `vendor-objectstack-*.js`, which put the closure past a ceiling that was deliberately sized to catch a 89 KiB regression — the gate refused the bump, correctly. Raising it was escalated rather than taken locally, because gate-strength policy had been ruled the maintainer's; the ruling on objectui#5531 authorised the raise. `MAX_EAGER_CLOSURE_GZIP_BYTES` and the `BASELINE` it is derived from move together in one commit, keeping headroom at 2.00% and below the 91,136-byte regression size the gate must still catch. The gate's *sensitivity* is untouched: a repeat of that regression from the new baseline still fails. No behaviour ships from this file — it is CI policy, recorded here because the version it governs is the one this changeset publishes.

### Patch Changes

- 39f4309: Published typings from every `vite-plugin-dts` package now carry an explicit extension on
  every relative specifier, and a type error in the declaration build now fails the build
  instead of being printed and ignored (objectui#5439, objectui#5483).
  
  **Consumers on `moduleResolution: nodenext` or `node16` may see NEW type errors, and that
  is the fix working.** These packages re-export mostly through NAMED re-exports —
  `export { useObjectChat } from './useObjectChat'`. TypeScript could not follow the
  extensionless hop, but it still DECLARED the name, so the symbol resolved to a silent
  `any`. Nothing errored; consumers simply got no types. With the extension emitted, the
  symbol carries its real type, and any call site that was relying on the `any` now type
  checks for the first time. This is the mode that produced the 21 residual `TS7006` on
  `@object-ui/app-shell` reported against objectui#5365 — a type hole that opened quietly,
  unlike objectui#5365's own `export * from './ui'` packages where the same defect surfaced
  immediately as `TS2305: has no exported member`.
  
  410 extensionless relative specifiers across 19 packages were emitted before this change;
  the count is now 0 in all 22 packages that build typings through `vite-plugin-dts`.
  `@object-ui/fields` was already clean — its sources write explicit `.js` specifiers — and
  is wired so it stays that way.
  
  The second half changes no emitted output today: 22/22 packages built green unmodified, so
  making the declaration step's exit code honest turns nothing red. It changes what a FUTURE
  regression does — print and exit 0, versus fail the build.
- 9caa7d4: `ObjectView` wraps `table.defaultSort` before handing it to a delegated list view, so a
  view whose only ordering is the deprecated key actually sorts (objectui#6235).
  
  `ObjectGridSchema.defaultSort` is declared a SINGLE `{ field, order }` object — the zod
  mirror agrees (`z.object({ field, order })`, not a union) — while the `list-view` node's
  `sort` slot is declared `string | SortConfig[]`, imported by reference from the spec's own
  `ListViewSchema`. `mergedSort`'s last branch forwarded the bare object into that slot
  unwrapped. The three branches ahead of it all produce an array or a string, so this was the
  one shape the slot never declared.
  
  Nothing crashed and nothing warned: every reader of that slot drops an unparseable sort
  silently. `ListView.parseSortConfig` and `ObjectGrid.parseSchemaSort` both open
  `typeof sort === 'string' ? [sort] : Array.isArray(sort) ? sort : []`, so a bare object
  yields `[]`; the shared sink `convertSortToQueryParams` returns `undefined` for it. Both
  in-tree hosts feed the slot straight into `ListView` (`app-shell`'s `fullSchema` and
  Studio's `renderStudioGridList`), so the symptom was an unsorted list with no error —
  while the SAME metadata sorted correctly as a grid, because `ObjectGrid` performs this
  lowering for the same pair.
  
  The wrap is verbatim the one the non-grid fetch path in this same file already applies
  (`|| (schema.table?.defaultSort ? [schema.table.defaultSort] : undefined)`), so all three
  consumers now agree and no fourth dialect is introduced. The shared sink is deliberately
  NOT widened to accept a bare `{ field, order }`: that is the widening the maintainer ruling
  of 2026-08-22 rejected on the merits, because the same slot legitimately carries
  `$orderby`'s own `Record<field, direction>` map, in which `{ field: 'desc' }` is a legal
  ordering by a column literally named `field`.
  
  Precedence is unchanged — a named view's sort still outranks `table.sort`, which still
  outranks `table.defaultSort`. Only the final branch changes shape.
  
  One behaviour note for hosts writing off-schema metadata: an ARRAY in `table.defaultSort`
  was previously forwarded verbatim by this path alone and is now lowered like every other
  resolver in the repo, which leaves it unreadable rather than rescuing it. That input is
  already refused by the zod mirror and already behaves this way on the fetch path and in
  `ObjectGrid`; the canonical slot for an array is `table.sort`.
- e929c56: `ObjectView`'s non-grid fetch now carries `$expand` (objectui#6419). The effect built its
  expand set from `objectSchemaRef.current` — a ref assigned in the render body, deliberately
  kept out of the effect's dependency list so the effect would run exactly once per mount. On
  that one run the ref was still `null`, so `buildExpandFields` saw no fields and the query
  went out as `{ $top: 100 }` with no `$expand` at all; because the effect never re-ran on the
  schema's arrival, it never went out with one either.
  
  `ObjectView` hands the rows it fetches to the child view as `data={data}`, which suppresses
  that child's own fetch. So every lookup / master_detail / user / tree field in the six
  non-grid views it hosts — kanban, calendar, gallery, timeline, gantt, map — rendered from
  raw foreign-key ids: blank on the kanban (its `resolveDisplay` suppresses opaque ids) and
  potentially the raw id on the other five.
  
  The object schema and the fact that its read has SETTLED are now one piece of state, keyed
  by object name, and the record query waits on it — the shape `ObjectKanban` adopted in
  objectui#6271. The gate is on the read having settled, **not** on a truthy schema: a view
  whose adapter exposes no `getObjectSchema`, or whose read threw, still queries (unexpanded)
  rather than waiting forever, and switching objects closes the gate in the same commit rather
  than sending the previous object's expand set.
  
  The trade was measured on this effect rather than inherited, because it has five more
  dependencies than the board's. With an instrumented adapter (schema and `find` both 30ms)
  across four host regimes: before, one query with no `$expand` and one raw delivery to the
  child; with `objectSchema` merely added to the dependency list, two queries and two
  deliveries — `raw` then `expanded`, a visible two-step paint, because here the raw rows
  settle into state *before* the re-run's cleanup rather than being discarded as they were on
  the board; gated, one query carrying `$expand` the first time and a single expanded
  delivery, with correct rows landing at the same wall clock as the dependency version.
- 6a7893d: `ObjectView`'s non-grid fetch no longer re-queries once per parent render when the host
  passes an inline `views` array (objectui#6460).
  
  The effect that fetches rows for the six non-grid view types (kanban, calendar, gallery,
  timeline, gantt, map) listed `activeView` — an **element of the `views` prop array** — among
  its dependencies. A host writing `views={[{ id: 'cal', type: 'calendar', label: … }]}`, which
  is how this component's own docs write it, produces a fresh element object on every one of
  its own renders, so the dependency changed identity every render and a new `find()` went out
  each time. Measured with an instrumented adapter and three parent re-renders: **4 queries
  where a hoisted array gives 1**. Because `ObjectView` hands its rows to the child view as
  `data={data}`, each extra query also re-delivered a fresh row array downstream — the
  "duplicate events in child views like the calendar" hazard, from the re-run direction.
  
  The effect now depends on the **values it reads** — the active view's `filter` and `sort`,
  plus its `id` — held at a steady reference while they are structurally unchanged, instead of
  on the view object's identity. Asking hosts to hoist the array was considered and rejected:
  that is a contract change on every caller of a published component, and it leaves the defect
  live for every host that does not comply.
  
  Nothing about precedence moves: a named `listViews` config's `filter`/`sort` still outrank
  the view's, which still outrank `table.filter`/`table.sort` and their deprecated aliases.
  Changing a view's filter, changing its sort, and switching the active view all still
  re-fetch. The comparison never serializes, so it stays correct for filter and sort values
  that have no faithful stringification — a `Date`, a function, a `Map`, `NaN`, or plain
  key-order instability — and every case it cannot model resolves to "changed", which costs a
  redundant query rather than withholding a needed one.
- 34ea56d: Relay a per-view `rowColor` through the two object-view hosts (objectui#7218).
  
  `rowColor` is a declared member of `ListViewSchema` — imported by reference from
  `@objectstack/spec`, shape `{ field, colors? }` — and `ListView` reads it to
  seed its `rowColorConfig` state, which colours whole rows from the named field's
  value. Neither object-view host relayed it: `app-shell`'s
  `ObjectView.renderListView` builds its list schema by spreading the host's and
  then relaying 47 named keys off the active view, and `plugin-view`'s
  `ObjectView` assembles 46 inside its `object-view HOST-COMPOSITION SURFACE`
  fence. `rowColor` had a rung in neither.
  
  So an authored per-view row colour was unreachable on the object route:
  authored, validated, built and served correctly, then dropped at the relay.
  Nothing errored and every authoring gate passed — the only symptom was that the
  rows were not coloured, which an author cannot notice short of diffing the DOM.
  Same "declared and inert" shape objectui#7199 fixed for `description`.
  
  **This is a relay, not a new surface.** The interface route
  (`InterfaceListPage.tsx`) has shipped `rowColor: view.rowColor` next to
  `grouping` and `pagination` since ADR-0047, into a schema typed
  `ListViewSchema`, with no fence of any kind — so the key was already
  author-reachable and already had a delivery path; two of three hosts simply did
  not use it. The legacy shorthand for the same feature (bare `color`) already had
  a rung in both literals; only the spec-canonical spelling was missing.
  
  **No published surface moves.** Both rungs are view-sourced only, and neither
  adds a cast read off the object-view node — that would have added a 28th name to
  the objectui#5097 HOST-COMPOSITION exemption whose count the 2026-08-18 ruling
  fixed at 27, which is a ruling and not a refactor. `grouping` is the in-fence
  precedent for a view-only rung.
  
  ⚠️ Not `userActions.rowColor`, a boolean permission toggle sharing this name at
  a different nesting level ("may the user open the colour panel" versus "what the
  colours are"). That key is untouched, and the new pins hold the two apart.
- 7c3df8f: The settled-schema convergence, and the gantt's duplicate query gated
  (objectui#7225, maintainer ruling B, 2026-09-02).
  
  `useSettledSchema` was extracted and published in PR #6690 with exactly **one**
  non-test adopter (`ObjectTree`, the component that had an actual defect —
  objectui#6481's unkeyed latch). `ObjectKanban`, `plugin-view/ObjectView` and
  `ObjectCalendar` kept their own hand copies of the same shape, so a published
  export was owed compatibility forever **and** the duplication it was named for
  stayed. All three now call the hook.
  
  The migration is a pure deduplication with no behaviour delta — the hook was
  extracted *from* these three shapes, so each becomes a one-line call.
  `ObjectCalendar`, which objectui#6482 named as the obstacle, fits via the
  recipe the hook's own doc comment prescribes for it by name: pass the data
  source as `undefined` for a render that must not read metadata
  (`hasInlineData ? undefined : dataSource`), so "inline value data set" is
  expressed as "there is no source to read from" rather than as a second enable
  flag. GATE PLACEMENT stays local in all three, which is what #6482 ruled and
  what made the calendar's obstacle a non-obstacle: it was about the gate half.
  
  **One observable change:** `ObjectKanban`'s rejected definition read now logs
  on `console.error` with a `[useSettledSchema]` prefix instead of
  `console.warn`. Its test spy moves with it, and now asserts on the channel
  rather than merely silencing it.
  
  **The gantt's duplicate query is gated** (ask 2 of the card; #6482's
  undischarged half). `ObjectGantt` listed `objectSchema` in `reload`'s
  dependency list, so every load issued two unbounded queries — the first with no
  `$expand` at all. Measured on this component across three latency profiles, the
  cost is not the mild "round trip bought and thrown away": when the metadata
  read is the slower of the two, which is the common case on a cold
  `MetadataCache`, the user sees the full three-step paint — raw foreign-key ids,
  back to the loading placeholder, then the expanded rows. It now issues one
  query, already expanded.
  
  Gating the gantt required its schema resolution to settle on EVERY exit
  (objectui#7232): the hand-rolled effect returned without settling on
  `!effectiveDataSource`, on `!resource` and in its `catch` — harmless while
  nothing waited on it, and a chart that never loads once something does.
  `useSettledSchema` settles on all three by construction, which is what makes
  the gate safe; both exits are pinned.
  
  ⛔ Gating is not capping. The row ceiling on these fetches is objectui#7210's
  separate ruling, in its own commit on the same branch.
- d327b9c: FLS-gate the `$expand` projection at the seven remaining `buildExpandFields`
  call sites (objectui#7429).
  
  objectui#7215 / PR #7229 gated the two projection sites in its scope
  (`ObjectGrid`, `ListView`). objectui#7230 / PR #7428 gated four more
  (`ObjectCalendar`, `ObjectGantt`, `RecordDetailView`, `DetailView`). This
  closes the seven that were left: `ObjectKanban`, `ObjectTree`, `ObjectView`
  (the non-grid record-fetch effect), `ObjectMap`, `ObjectGallery`,
  `ObjectTimeline`, and the metadata-admin `PagePreview`'s record-binding fetch.
  
  **All seven pass no column list at all**, which makes every one of them the
  sharp shape: `buildExpandFields` reads an absent column list as "no column
  restriction" and falls back to **every declared relation on the object**,
  denied ones included. So each of these components asked the server to resolve
  the object's full relation set by default, not by configuration — the
  ordinary shape of each surface, not a corner of it.
  
  **`PagePreview` is the one site where the judged principal is not the page's
  eventual audience.** It calls the browser's own `fetch` with
  `credentials: 'include'` rather than `DataSource.find`, so it runs under
  whichever session is loading the Studio preview. Gating on that same session's
  `usePermissions()` is still the correct principal: it is exactly the request
  the browser is about to make, on its own credentials, regardless of who later
  opens the published page.
  
  **Reproduced before it was fixed**, as a failing test per site (and, for the
  two sites — `ObjectView`, `PagePreview` — where the gate was implemented
  before its test was run red, a reverse-verification: the gate was reverted,
  all four denial-and-set pins on each went red, and the two deferral/positive
  control pins stayed green, before the gate was restored).
  
  **Grading, measured rather than assumed** — the same reading objectui#6898,
  #7215 and #7230 recorded: against ObjectStack's own server this is
  defence-in-depth, not a live disclosure. `plugin-security`'s
  `FieldMasker.maskRecord` deletes every unreadable key from each returned row
  and objectql's expand path writes the resolved record back under that same
  key, so one statement removes the expanded object and the bare id alike; the
  expansion sub-read is itself gated (the referenced object's full CRUD + RLS +
  FLS treatment, objectstack#7626). It is load-bearing for any backend that does
  not strip, and the client-request side is real regardless.
  
  **Nothing a permitted view did stops working.** The gate judges each site's
  `buildExpandFields` OUTPUT, which contains only the object's declared
  reference-bearing fields, so the "`checkField` answers false for an
  undeclared key" trap cannot be reached. An unanswered permission policy
  filters nothing. `buildExpandFields` itself is unchanged.
  
  `@object-ui/permissions` is added to `dependencies` for `plugin-kanban`,
  `plugin-tree`, `plugin-map`, `plugin-timeline`, and `plugin-view` — the fifth
  one objectui#7429's own dependency count missed (it named four); `plugin-list`
  and `app-shell` already had it.
- c6198c2: **Breaking for authored metadata:** `ComponentInput.label`, `ComponentInput.defaultValue` and
  `ComponentInput.advanced` are RETIRED on both faces (objectui#7493 item ① and objectui#7781;
  maintainer ruling A of 2026-09-06, immediate, no deprecation window; ADR-0049 enforce-or-remove).
  They are the three keys the manifest serializer does not forward, and nothing read them on any
  publication or consumption path.
  
  No manifest ever published them, so no consumer could ever have read them. `sdui-parser`'s
  serializer (`packages/sdui-parser/src/index.ts`) forwards exactly six keys per input — `name`,
  `type`, `required`, `enum`, `binding`, `description` — so a value authored under any of the three
  never reached `sdui.manifest.json`, the generated JSX `.d.ts`, or a diagnostic; its boundary type
  has no slot for them; the registry's data-source seam reads `name` only; and neither the designer
  nor the app-shell inspectors consult registry `inputs` at all. A structural census over every
  `inputs:` array in the repository (re-measured on this change's merge-base, `name` 951 and `type`
  951 as the controls) counted the writes: `label` 908, `defaultValue` 245, `advanced` 9 — written on
  nearly every registration, read by nothing.
  
  FROM → TO, per key — all three **TOMBSTONED, not removed**, because the route was measured on
  the built face before it was chosen: `ComponentInputSchema` is a non-strict `z.object`, and an
  undeclared key parses GREEN and is silently STRIPPED, so a deletion would have swallowed 1,162
  authored values in silence. The tombstone is what makes the refusal loud and by name.
  
  - `label?: string` → `label?: never` on the interface, `retirementTombstone()` on the Zod mirror.
    Migration: delete the key. An input is identified by its `name` on every path that reaches it;
    nothing ever rendered a label for it.
  - `defaultValue?: any` → `defaultValue?: never` / `retirementTombstone()`. Migration: delete the
    key. The renderer's own fallback read IS the default; tell the author about it in `description`,
    which IS published. (Tightening the type to `unknown` was ruled out: it closes no error class,
    since nothing reads the value.)
  - `advanced?: boolean` → `advanced?: never` / `retirementTombstone()`. Migration: delete the key.
    No designer surface ever hid an "advanced" input; there is nothing to write instead.
  
  The retirement kit: `?: never` on `ComponentInput` (`packages/types/src/base.ts`), so authoring one
  is a `tsc` error at the registration site; `retirementTombstone()` on `ComponentInputSchema`
  (`packages/types/src/zod/base.zod.ts`), so an authored value is REFUSED at parse time with
  `code: 'invalid_type'`, the key named in the issue `path`, and the migration note as the message
  (one string, both channels). Pinned in
  `packages/types/src/__tests__/component-input-retired-keys-7493.test.ts`, which also holds a
  tree-scoped absence census over every `inputs:` array under `packages/**` and `apps/**`.
  
  Accept-set change, stated plainly for reviewers: a document that sets any of the three keys on a
  `ComponentInput` used to parse GREEN (the value was then dropped by the serializer) and now parses
  RED. Every in-repo authoring site — 1,199 keys across 110 registration files, the three standalone
  `ComponentInput[]` arrays and the two named input arrays `tsc` found included — is deleted in the same change, as the ruling's split rule
  requires; the `WidgetRegistry` seam no longer copies the widget-manifest values onto the synthesized
  `ComponentInput` (they fed nothing), and the data-source declaration `ELEMENT_DATA_SOURCE_INPUT`
  drops its `label`. The patch entries on the other packages record exactly that: their registrations
  stop authoring inert keys, with no runtime or published-manifest change.
  
  The nine test files that read `defaultValue` off a registration were re-pinned against the
  renderer's ACTUAL default (its own fallback read, or the `defaultProps` it ships) instead of the
  declaration that went away; two assertions that only restated the shadow default were dropped with
  the reason on the line.
  
  The in-repo zero is what was measured. Whether anything OUTSIDE this repository writes these keys
  is not measurable from here (the objectui#5674 limit); converting such a write from a silent drop
  into a named refusal is exactly what the tombstones buy. `WidgetInput`'s own `label` /
  `defaultValue` / `advanced` (the widget-manifest face) stay declared and writable — nothing has
  ruled on that face; that it now has no reader either is recorded as objectui#7911.
- cad512f: A host-composed `tree` view is now labelled with the tree icon in `ObjectView`'s
  view switcher instead of the grid one, and the `tree` / `chart` view types are
  recorded as host-composition-only surfaces (objectui#5321).
  
  `viewSwitcherSchema`'s `iconMap` carried an entry for every view type except
  `tree`, so a tree view fell through to the `|| 'table'` fallback and was drawn
  with the grid glyph. objectui#2916 fixed exactly this once, for `chart`, by
  adding a single key — nothing recorded that the map had to be COMPLETE, so the
  next missing member went unnoticed. The map is now typed
  `Record<ViewType, string>`, which is how `ViewSwitcher`'s own
  `DEFAULT_VIEW_ICONS` (the consumer of these strings) has always been declared:
  a future `ViewType` member fails `type-check` rather than silently rendering as
  a grid. The `tree` value is `'list-tree'`, the same `ListTree` glyph
  `DEFAULT_VIEW_ICONS` already names for this view type, and the runtime fallback
  stays for host props that carry an unrecognised type. Reached in practice by
  the console, whose `CreateViewDialog` offers `tree` among the view types a user
  can create.
  
  No authoring surface changes. `generateViewSchema` renders eight view types
  while `ObjectViewSchema.defaultViewType` and `NamedListView.type` admit six of
  them, so `tree` and `chart` are selectable only through the component's `views`
  prop. The maintainer ruled on 2026-08-20 that both stay recorded as
  host-composition-only rather than being added to those unions, following the
  objectui#5097 precedent; the record now lives beside that one, with the branch
  set derived from a source fence, the authored unions pinned at the type level,
  and host reachability measured.
- cfc2c7a: **Bug fix:** a non-grid `object-view` (calendar / kanban / gallery / timeline)
  whose sort came from the deprecated `table.defaultSort` no longer comes back
  empty. `ObjectGridSchema.defaultSort` is declared a single `{ field, order }`
  object, and `ObjectView`'s own fetch handed it to `$orderby` verbatim — where
  the ObjectStack adapter reads it as an `$orderby` map and folds it with
  `Object.entries`, so the request went out sorting by two columns literally
  named `field` and `order`. The server answers `400 INVALID_SORT`, `ObjectView`
  swallows the error, and the view rendered with no records — while the *same*
  metadata sorted correctly as a grid, because `ObjectGrid` lowers that pair
  before using it (objectui#4869, maintainer ruling 2026-08-22).
  
  `ObjectView` now performs the same legacy-to-canonical lowering `ObjectGrid`
  already does (`sort ?? (defaultSort ? [defaultSort] : undefined)`) and routes
  the whole chain — named view sort, `views` prop sort, `table.sort`,
  `table.defaultSort` — through the shared `convertSortToQueryParams` sink. This
  was the last object-bound read site sending an authored sort to `$orderby`
  unlowered; every other block (gantt, map, calendar, timeline,
  `record:line_items`) already did, so an adapter that implements `find` itself
  now receives one normalized `Record<field, direction>` from all of them instead
  of two different dialects.
  
  Precedence is unchanged, and both spellings of the pair keep working. The
  shared sink was deliberately **not** widened to accept a bare `{ field, order }`:
  its input slot also legitimately carries `$orderby`'s own map, in which
  `{ field: 'desc' }` is a valid ordering by a column named `field`, so widening
  it would make one shared function guess.
  
  Two visible shape changes on the wire, both semantically identical to before: a
  string `table.sort` such as `'name desc'` now serializes as `-name` rather than
  riding through as `name desc`, and a `SortConfig[]` arrives as a map rather than
  as an array.
- 6c6cee7: A RETIRED field-type spelling is now refused — out loud, once — by every
  field-type predicate in the renderer, not just by the widget road
  (objectui#4914, maintainer ruling B of 2026-08-18).
  
  `@object-ui/fields` exports a single `isRetiredFieldType(t)` gate, and it runs
  ahead of six predicate faces that previously granted a retired spelling
  first-class treatment: the filter builder's operator buckets and its value
  control (`@object-ui/components`), the detail page's highlight-strip picker
  (`@object-ui/plugin-detail`), `normalizeFieldType` (`@object-ui/plugin-view`),
  the dashboard's `$expand` whitelist and `isLookupType`
  (`@object-ui/plugin-dashboard`), and the list toolbar's lookup-like filter
  control (`@object-ui/plugin-list`). Each one now fires the migration
  prescription on the console — once per spelling across all of them, never once
  per predicate — and then answers as it would for a spelling it does not
  recognise.
  
  This closes the whole CLASS rather than one word: the gate is quantified over
  `RETIRED_FIELD_TYPES`, so the next retirement covers all seven consumers on the
  day it lands. It is the shape objectui#4932 and objectui#4942 already
  established for the form and inline-edit roads.
  
  Measured before the change, and the reason the fix is a gate rather than a
  deletion: `owner` was not dead in these faces. `operatorsForFieldType('owner')`
  equalled the `user` bucket item for item, `computeLookupExpand` actively
  requested `$expand` for it, `isLookupType('owner')` was `true` alongside
  `reference`, and `normalizeFieldType('owner')` answered `'select'` exactly as
  `picklist` does. Deleting the members alone would have traded a visible
  contradiction for a SILENT degradation — a filter picker collapsing to a bare id
  box, `$expand` quietly stopping so cells show raw foreign-key ids — which is
  verbatim the failure mode `RETIRED_FIELD_TYPES`' own docblock exists to prevent.
  The gate keeps that fallback and adds the half that was missing: the author is
  told.
  
  The boundary question is answered on record: `owner` arriving through a
  backend-vocabulary normalizer is an authoring error to refuse loudly, not
  legitimate foreign input to tolerate. The open backend vocabulary those
  normalizers exist for is untouched — `reference`, `picklist`, `money`, `int`,
  `datetime_tz` and the rest are equally absent from the spec's closed `FieldType`
  and are equally unretired, so they classify exactly as before.
  
  `RETIRED_FIELD_TYPES`, `reportRetiredFieldType` and `resetRetiredFieldTypeReports`
  move to `@object-ui/core` and are re-exported from `@object-ui/fields`, so that
  package's published surface is unchanged apart from the newly ruled gate.
  `@object-ui/components` is a consumer of the gate and `@object-ui/fields`
  depends on it, so a single shared table could not live in `fields` — and a
  second copy would have meant a second dedupe set and two console lines for one
  spelling. No package gained a new dependency.
  
  A retired spelling never loses a stored value: `retypeFilterValue` is
  deliberately not gated, and the refused filter row stays operable rather than
  drawing a blank operator trigger.
- 6b348d2: `ViewSwitcher` draws an icon for `chart` and `gantt` views again, and both
  icon maps in the package now name only spellings lucide still resolves
  (objectui#5586).
  
  `ViewSwitcher.resolveIcon` turns an icon NAME into a component by looking it up
  in lucide's runtime `icons` record. lucide retires a spelling by dropping it
  from that record while KEEPING it as a deprecated named export, so a retired
  name still imports, still type-checks and still renders as a component — and
  silently resolves to nothing as a string. `ObjectView` composes the switcher
  from names, and two of them had been retired on lucide-react 1.31.0:
  `chart: 'bar-chart-3'` and `gantt: 'gantt-chart'`. Both view types rendered as a
  label with no icon at all while every sibling type had one, and nothing went red
  because no lucide symbol appears in that map for the compiler to check. Measured
  against the installed package: `BarChart3` and `GanttChart` are absent from
  `icons`, while `ChartColumn` and `ChartGantt` are present.
  
  - `ObjectView`'s `iconMap`: `bar-chart-3` → `chart-column`,
    `gantt-chart` → `chart-gantt`.
  - `ViewSwitcher`'s `DEFAULT_VIEW_ICONS`: the adjacent entries that named
    deprecated aliases move to the names the record carries —
    `BarChart3` → `ChartColumn`, `GanttChartSquare` → `ChartGantt`,
    `Grid` → `Grid3x3`. `ChartColumn`/`Grid3x3` are the same components the
    aliases already pointed at, so those two glyphs are unchanged; the `gantt`
    default picks up the plain gantt glyph, which is what `iconMap` now supplies
    for that view type.
  
  The regression pin widens from `tree` alone to EVERY name both maps supply: a
  pin scoped to the two names that broke would not have caught this and would not
  catch the next lucide bump.
- Updated dependencies [9c74902]
- Updated dependencies [64dae8e]
- Updated dependencies [b06e374]
- Updated dependencies [06a8af5]
- Updated dependencies [6a91586]
- Updated dependencies [a04d7c6]
- Updated dependencies [9801765]
- Updated dependencies [460575f]
- Updated dependencies [d796c8d]
- Updated dependencies [594704f]
- Updated dependencies [d3995fe]
- Updated dependencies [1b1d772]
- Updated dependencies [d88e20f]
- Updated dependencies [2d7304d]
- Updated dependencies [062943f]
- Updated dependencies [636b236]
- Updated dependencies [4172589]
- Updated dependencies [64d624d]
- Updated dependencies [053fdc8]
- Updated dependencies [41b7ce3]
- Updated dependencies [67a87d9]
- Updated dependencies [39f4309]
- Updated dependencies [d2fb6ef]
- Updated dependencies [7cd3987]
- Updated dependencies [e304a4e]
- Updated dependencies [490d9a9]
- Updated dependencies [fc62bb4]
- Updated dependencies [41df893]
- Updated dependencies [3e853c9]
- Updated dependencies [00f3eb5]
- Updated dependencies [1ec291c]
- Updated dependencies [453dbaa]
- Updated dependencies [95f8704]
- Updated dependencies [f8cdbf2]
- Updated dependencies [69a2163]
- Updated dependencies [24e027e]
- Updated dependencies [2c3cd1b]
- Updated dependencies [e176053]
- Updated dependencies [e30ed15]
- Updated dependencies [17ccec9]
- Updated dependencies [90665e0]
- Updated dependencies [8d3a529]
- Updated dependencies [5ac2e2c]
- Updated dependencies [194fae1]
- Updated dependencies [7e19d03]
- Updated dependencies [beccf1c]
- Updated dependencies [b08b7eb]
- Updated dependencies [546ddf7]
- Updated dependencies [864154e]
- Updated dependencies [b023625]
- Updated dependencies [75bd83d]
- Updated dependencies [7a72422]
- Updated dependencies [44d075b]
- Updated dependencies [40c479a]
- Updated dependencies [5173a5e]
- Updated dependencies [971d387]
- Updated dependencies [ee851c3]
- Updated dependencies [6414dfd]
- Updated dependencies [a8d5c71]
- Updated dependencies [905b21f]
- Updated dependencies [88e9109]
- Updated dependencies [2c45966]
- Updated dependencies [db3a600]
- Updated dependencies [6fd2cf7]
- Updated dependencies [5fa06c4]
- Updated dependencies [52a43de]
- Updated dependencies [e4559d1]
- Updated dependencies [2c71482]
- Updated dependencies [129bcc5]
- Updated dependencies [c9a7252]
- Updated dependencies [5f19b92]
- Updated dependencies [a26b9e4]
- Updated dependencies [5ef9c4f]
- Updated dependencies [e0b289d]
- Updated dependencies [46f0bb4]
- Updated dependencies [2da6441]
- Updated dependencies [3b9c774]
- Updated dependencies [8ec11e1]
- Updated dependencies [6f81384]
- Updated dependencies [22ba927]
- Updated dependencies [f8c70f4]
- Updated dependencies [5d3a2d1]
- Updated dependencies [c38162d]
- Updated dependencies [8f1d995]
- Updated dependencies [b362c1b]
- Updated dependencies [f9c34df]
- Updated dependencies [dddb942]
- Updated dependencies [00c665e]
- Updated dependencies [29754cf]
- Updated dependencies [3c2b6f7]
- Updated dependencies [6e88630]
- Updated dependencies [b84dc18]
- Updated dependencies [ac8abb0]
- Updated dependencies [9d86e1d]
- Updated dependencies [99a3c2d]
- Updated dependencies [1c19722]
- Updated dependencies [5961030]
- Updated dependencies [faa863d]
- Updated dependencies [fd814d6]
- Updated dependencies [f24de8b]
- Updated dependencies [c8ea8af]
- Updated dependencies [9602dc8]
- Updated dependencies [3190414]
- Updated dependencies [4e480f5]
- Updated dependencies [38a123c]
- Updated dependencies [299102e]
- Updated dependencies [30c73cd]
- Updated dependencies [c4987fb]
- Updated dependencies [f55d666]
- Updated dependencies [f241a4d]
- Updated dependencies [830ed58]
- Updated dependencies [d7acad6]
- Updated dependencies [45a9aeb]
- Updated dependencies [713db46]
- Updated dependencies [c71e14d]
- Updated dependencies [bf3a03c]
- Updated dependencies [748494b]
- Updated dependencies [5967be0]
- Updated dependencies [831be72]
- Updated dependencies [29cb85b]
- Updated dependencies [3e028c8]
- Updated dependencies [d0889e2]
- Updated dependencies [ce503e5]
- Updated dependencies [f20dcf0]
- Updated dependencies [12402a9]
- Updated dependencies [aff3d7a]
- Updated dependencies [4ca30d0]
- Updated dependencies [7a5da14]
- Updated dependencies [fff9645]
- Updated dependencies [9c3b7ce]
- Updated dependencies [2c1c967]
- Updated dependencies [9486ac6]
- Updated dependencies [9486ac6]
- Updated dependencies [4d5f9b4]
- Updated dependencies [d6ceb8d]
- Updated dependencies [dc4365c]
- Updated dependencies [e321d52]
- Updated dependencies [969ba84]
- Updated dependencies [4c68077]
- Updated dependencies [7977ff9]
- Updated dependencies [4ac3769]
- Updated dependencies [3beef6d]
- Updated dependencies [06b8c42]
- Updated dependencies [46b9bc9]
- Updated dependencies [19f3637]
- Updated dependencies [9bd08fe]
- Updated dependencies [45ac2cb]
- Updated dependencies [b97790a]
- Updated dependencies [dbd5194]
- Updated dependencies [7c9b044]
- Updated dependencies [d47de51]
- Updated dependencies [3fe6463]
- Updated dependencies [b392674]
- Updated dependencies [4f3a1e2]
- Updated dependencies [31ab372]
- Updated dependencies [846889b]
- Updated dependencies [26896c6]
- Updated dependencies [67fc3b0]
- Updated dependencies [fab4802]
- Updated dependencies [33a3b3c]
- Updated dependencies [b87f15b]
- Updated dependencies [045d20b]
- Updated dependencies [c18d099]
- Updated dependencies [adb2a86]
- Updated dependencies [03380aa]
- Updated dependencies [f9984c0]
- Updated dependencies [9700dd9]
- Updated dependencies [3561bd2]
- Updated dependencies [bf97b98]
- Updated dependencies [320374d]
- Updated dependencies [b0d308d]
- Updated dependencies [1349400]
- Updated dependencies [8063bcb]
- Updated dependencies [b74a859]
- Updated dependencies [d4493fd]
- Updated dependencies [240b80f]
- Updated dependencies [77cb489]
- Updated dependencies [bfaa158]
- Updated dependencies [777e5c6]
- Updated dependencies [0c386dd]
- Updated dependencies [9e37d9b]
- Updated dependencies [5ad86dd]
- Updated dependencies [16a725f]
- Updated dependencies [4dfdcc3]
- Updated dependencies [6a449fc]
- Updated dependencies [446d93d]
- Updated dependencies [ecd9cb2]
- Updated dependencies [98d4108]
- Updated dependencies [0e3b3be]
- Updated dependencies [220c18d]
- Updated dependencies [00d3f09]
- Updated dependencies [4388f71]
- Updated dependencies [c93b4d5]
- Updated dependencies [c1fe272]
- Updated dependencies [8ad218d]
- Updated dependencies [5f78953]
- Updated dependencies [639114c]
- Updated dependencies [639114c]
- Updated dependencies [1490691]
- Updated dependencies [1f31d3a]
- Updated dependencies [d1842ab]
- Updated dependencies [78ca238]
- Updated dependencies [d8ec8d6]
- Updated dependencies [351eb31]
- Updated dependencies [866cd1d]
- Updated dependencies [20c04b2]
- Updated dependencies [84ffdbc]
- Updated dependencies [a276480]
- Updated dependencies [01c9023]
- Updated dependencies [48c19bd]
- Updated dependencies [a6d8b8d]
- Updated dependencies [b652514]
- Updated dependencies [adbda1b]
- Updated dependencies [adbda1b]
- Updated dependencies [adbda1b]
- Updated dependencies [8952395]
- Updated dependencies [e8c553b]
- Updated dependencies [2e32ed4]
- Updated dependencies [7c3df8f]
- Updated dependencies [67dadd6]
- Updated dependencies [e21308e]
- Updated dependencies [a4514e8]
- Updated dependencies [b9f5ff1]
- Updated dependencies [e75f4c9]
- Updated dependencies [19f1639]
- Updated dependencies [4704aa4]
- Updated dependencies [47547d0]
- Updated dependencies [858cd72]
- Updated dependencies [554f2b6]
- Updated dependencies [26e06d7]
- Updated dependencies [669d71b]
- Updated dependencies [2d3fe73]
- Updated dependencies [ed27d7c]
- Updated dependencies [7dedec6]
- Updated dependencies [52c8cf7]
- Updated dependencies [52c8cf7]
- Updated dependencies [3399704]
- Updated dependencies [7bf244b]
- Updated dependencies [f0bb9fa]
- Updated dependencies [81a2eb1]
- Updated dependencies [20cb8db]
- Updated dependencies [00d2fa6]
- Updated dependencies [c6198c2]
- Updated dependencies [2f61238]
- Updated dependencies [51eb515]
- Updated dependencies [c354ce5]
- Updated dependencies [8fe8e5c]
- Updated dependencies [2a5bf45]
- Updated dependencies [9587fc9]
- Updated dependencies [e62c44e]
- Updated dependencies [daf9d57]
- Updated dependencies [c15d7ec]
- Updated dependencies [5d0876c]
- Updated dependencies [f7ace0a]
- Updated dependencies [b041b9c]
- Updated dependencies [ce2aaef]
- Updated dependencies [2ce2612]
- Updated dependencies [bc640ec]
- Updated dependencies [3e377c9]
- Updated dependencies [a3eb5d0]
- Updated dependencies [4ce14f1]
- Updated dependencies [2af1fa7]
- Updated dependencies [c14d3a0]
- Updated dependencies [caf477f]
- Updated dependencies [f6375da]
- Updated dependencies [967e5d8]
- Updated dependencies [a4611b3]
- Updated dependencies [20316ba]
- Updated dependencies [d3499b3]
- Updated dependencies [91f9276]
- Updated dependencies [18897a4]
- Updated dependencies [8b7ea39]
- Updated dependencies [a915064]
- Updated dependencies [52cac38]
- Updated dependencies [64a252d]
- Updated dependencies [d1bebb0]
- Updated dependencies [4f9f1ee]
- Updated dependencies [c842594]
- Updated dependencies [cf1d29e]
- Updated dependencies [0758bd8]
- Updated dependencies [0ea7054]
- Updated dependencies [fc32921]
- Updated dependencies [8f9d87a]
- Updated dependencies [6bca0e4]
- Updated dependencies [81c0bc4]
- Updated dependencies [3c76801]
- Updated dependencies [2fcefb9]
- Updated dependencies [77f846a]
- Updated dependencies [bc5870c]
- Updated dependencies [b55a346]
- Updated dependencies [065bba7]
- Updated dependencies [dd19463]
- Updated dependencies [100547e]
- Updated dependencies [3a58149]
- Updated dependencies [6d1c155]
- Updated dependencies [d7573b3]
- Updated dependencies [bf3edfe]
- Updated dependencies [2c8474c]
- Updated dependencies [6ce89da]
- Updated dependencies [0e05aac]
- Updated dependencies [ae61ad4]
- Updated dependencies [5aed9e4]
- Updated dependencies [83c77dc]
- Updated dependencies [3c9fca3]
- Updated dependencies [18a8e7d]
- Updated dependencies [e7957ab]
- Updated dependencies [f7e34ca]
- Updated dependencies [e719ebd]
- Updated dependencies [f9e4f91]
- Updated dependencies [fa429cf]
- Updated dependencies [ed8df3e]
- Updated dependencies [fe76ece]
- Updated dependencies [8ebd57f]
- Updated dependencies [c40f3b8]
- Updated dependencies [58770f3]
- Updated dependencies [aefe428]
- Updated dependencies [485f096]
- Updated dependencies [199d31b]
- Updated dependencies [9e22085]
- Updated dependencies [b655a9d]
- Updated dependencies [c574dfb]
- Updated dependencies [02f48b6]
- Updated dependencies [3e01cb5]
- Updated dependencies [7138bc1]
- Updated dependencies [cef27e2]
- Updated dependencies [4e8622b]
- Updated dependencies [dffd752]
- Updated dependencies [105f3c5]
- Updated dependencies [3ccd9e8]
- Updated dependencies [689b979]
- Updated dependencies [e546222]
- Updated dependencies [fd13f52]
- Updated dependencies [d7bd274]
- Updated dependencies [98c3a74]
- Updated dependencies [ebce5a3]
- Updated dependencies [9d9040d]
- Updated dependencies [20e317c]
- Updated dependencies [425762e]
- Updated dependencies [0fce2ef]
- Updated dependencies [9850c6e]
- Updated dependencies [de570cc]
- Updated dependencies [b2ea297]
- Updated dependencies [5b5a5c3]
- Updated dependencies [ab92940]
- Updated dependencies [a691c0b]
- Updated dependencies [0b1326d]
- Updated dependencies [1e66879]
- Updated dependencies [c5200f0]
- Updated dependencies [af3861f]
- Updated dependencies [515f171]
- Updated dependencies [83ec618]
- Updated dependencies [4f14ad7]
- Updated dependencies [258d264]
- Updated dependencies [cac64b3]
- Updated dependencies [fa140b8]
- Updated dependencies [71cba28]
- Updated dependencies [190fbd0]
- Updated dependencies [c00bf28]
- Updated dependencies [f2158ec]
- Updated dependencies [fd8dace]
- Updated dependencies [72ffc34]
- Updated dependencies [bf28341]
- Updated dependencies [78cbdb5]
- Updated dependencies [b7543a9]
- Updated dependencies [6c6cee7]
- Updated dependencies [42887e0]
- Updated dependencies [83fe6e7]
- Updated dependencies [d1ab06f]
- Updated dependencies [591bf27]
- Updated dependencies [38a9568]
- Updated dependencies [f90b8fb]
- Updated dependencies [91783c4]
- Updated dependencies [dba7d84]
- Updated dependencies [43ca9d5]
- Updated dependencies [5a07e67]
- Updated dependencies [2d36552]
- Updated dependencies [45d8288]
- Updated dependencies [b2437a7]
- Updated dependencies [f157423]
- Updated dependencies [7a90afd]
- Updated dependencies [ba306e3]
- Updated dependencies [eddc1dd]
- Updated dependencies [490f482]
- Updated dependencies [27308c5]
- Updated dependencies [8689166]
- Updated dependencies [c9327c9]
- Updated dependencies [920165d]
- Updated dependencies [26a2238]
- Updated dependencies [9101be5]
- Updated dependencies [f53a8d0]
- Updated dependencies [5d79faf]
- Updated dependencies [30266cf]
- Updated dependencies [57f9b07]
- Updated dependencies [3c73d99]
- Updated dependencies [d91aed9]
- Updated dependencies [ed71d9e]
- Updated dependencies [7776fc2]
- Updated dependencies [c86185e]
- Updated dependencies [fb96ecb]
- Updated dependencies [1170ed1]
- Updated dependencies [4d73b07]
  - @object-ui/plugin-form@17.7.0
  - @object-ui/i18n@17.7.0
  - @object-ui/core@17.7.0
  - @object-ui/types@17.7.0
  - @object-ui/components@17.7.0
  - @object-ui/plugin-grid@17.7.0
  - @object-ui/react@17.7.0
  - @object-ui/permissions@17.7.0

## 17.6.0

### Minor Changes

- 0a73b51: `ObjectView` and `ListView` now flatten a view's `map` block through a
  whitelist instead of spreading the whole (untyped) block to the top level.
  
  Both `case 'map'` flatteners used to build the `object-map` schema with
  `...(options.map || {})` — a raw spread of an untyped bag
  (`NamedListView.options?: Record<string, any>`), so any key an author wrote in
  the `map` block reached the top level unfiltered. `ObjectMap`'s own
  `FlatMapConfigKeys = Omit<ObjectMapConfig, 'style'>` declares `style` OUT of
  this flat form (`style` is also `BaseSchema.style`, inline CSS legal on every
  node), so the two disagreed about the same shape. `style` was the live
  specimen: `map: { style: '<url>' }` reached the top level as a CSS-shaped
  `style` key it was never supposed to carry.
  
  Behavior narrowing, stated because it changes what reaches the flattened
  schema: a `map` block key that is not one of `ObjectMapConfig`'s declared
  flat keys (`latitudeField` / `longitudeField` / `locationField` / `titleField`
  / `descriptionField` / `zoom` / `center`) — including `style` — no longer
  reaches the top level of the flattened `object-map` schema. This closes a gap
  rather than removing working behavior: the pinned strict spec view schemas
  accept no `map` block at all today, so no author-facing surface could reach
  this path, and `ObjectMap` already stopped reading a top-level `style` as a
  map style (a dev warning names the correct spelling instead).
  
  The whitelist is DERIVED from `ObjectMapConfigSchema` (`@object-ui/types/zod`)
  rather than hand-listed, so the flatteners and the declaration cannot drift
  apart again — a key added to (or removed from) the schema reaches both
  flatteners without a second edit. `ObjectMap`'s own `FLAT_MAP_CONFIG_KEYS` is
  derived from the same schema for the same reason.
- f1d4748: Remove the retired `striped` / `bordered` / `virtualScroll` list-view surface
  
  objectstack#7176 retired `list.striped`, `list.bordered` and `list.virtualScroll`
  from the spec after measuring every objectui reader as pass-through: each one
  copied the key onward and no renderer ever applied it. objectui stops declaring,
  typing and forwarding them.
  
  Off the chain: the `@objectstack/spec` list-view bridge in `@object-ui/react`,
  `ListView`'s child-view props in `@object-ui/plugin-list`, both `ObjectView`
  relays (`@object-ui/plugin-view` and `@object-ui/app-shell`), the `ObjectGridSchema`
  and `NamedListView` declarations in `@object-ui/types` (interface and zod),
  `ObjectGrid.component.yml` in `@object-ui/components`, and the page-block
  inspector's `striped` / `bordered` toggles in the metadata-admin designer.
  
  Behaviour is unchanged: nothing read these keys, so nothing rendered differently
  for them. Stored view metadata that still carries one keeps validating — the keys
  are simply no longer relayed. `ListViewSchema` continues to take the spec's
  list-view fields by reference, so the protocol's own retirement tombstones
  arrive with the next `@objectstack/spec` bump and reject the keys at the
  authoring boundary. Restoring any of the three as live surface requires an
  implementation card filed first, per the ruling.
- d006ce1: `object-view`: a top-level `conditionalFormatting` no longer reaches the kanban view.
  
  `ObjectView.generateViewSchema`'s kanban branch resolved its rule list from a
  three-link chain: `options.kanban.conditionalFormatting`, then the active view's
  own rule, then `(schema as any).conditionalFormatting` read straight off the
  `object-view` node. The first two links are declared surface. The third was not:
  `ObjectViewSchema` has no such member, the `object-view` registry registration
  does not publish it in `inputs`, and `BaseSchema`'s index signature keeps tsc
  silent — yet it was honoured, because that branch runs exactly when no host
  supplies `renderListView`, which is the path the registered renderer takes.
  
  That one key was the sole counter-example to the objectui#5097 exemption, whose
  stated basis is that its 27 keys are reachable only through the host-supplied
  delegation. Maintainer ruling of 2026-08-19 on objectui#5248 (verbatim
  「全部接受」): Option 2, gated on a liveness check, with Option 1 (declare the key
  on `ObjectViewSchema` and in the registry `inputs`) pre-ruled for the case where
  the check found real authored usage. The check came back empty — no authored
  document in either repo puts `conditionalFormatting` on an `object-view` node
  (objectui docs carry it only on `object-grid`, the authoring skill only on
  `list-view`; objectstack authors no `object-view` node at all) — so the read was
  dropped rather than the key declared.
  
  Behavior change, stated because it is one: an `object-view` node that carried a
  top-level `conditionalFormatting` and rendered a kanban view now renders that
  kanban unformatted. Author the rules where they are declared — under
  `options.kanban.conditionalFormatting`, or on the view — and both keep working
  with the same precedence as before.
  
  Not narrowed: the host `renderListView` delegation still reads the key off the
  `object-view` node and forwards it to the host's list renderer. It remains
  host-composition surface under objectui#5097; only the author-reachable path
  closed. Both halves are pinned in
  `packages/plugin-view/src/__tests__/ObjectView.kanbanConditionalFormatting.test.tsx`,
  and `objectViewHostSurface.test.tsx` now asserts that ZERO exempt keys are read
  outside the host-composition fence.

### Patch Changes

- ad07b65: Four packages stop publishing tooling material in their `dist/`
  
  Each of these packages spelled its build exclusions as `*.test.*`, while this repo's tooling convention is a directory one — `__tests__` / `__mocks__` / `__benchmarks__`, exactly as `TOOLING_FILE` in `scripts/check-phantom-dependencies.mjs` spells it. Any tooling file whose *name* is not `*.test.*` therefore stayed in the emit program and shipped in the tarball. This is the same shape and the same cause as objectui#4006, which fixed `@object-ui/fields` and `@object-ui/plugin-editor` by the filename criterion and so did not reach these four.
  
  Measured by building each package from a cleared `dist/` on both sides of the change. Nine files disappear, none appears, and every surviving file is untouched — the totals move by exactly the count removed:
  
  | package | `dist/` files | removed |
  | --- | --- | --- |
  | `@object-ui/core` | 176 to 174 | `dist/__benchmarks__/core.bench.js`, `core.bench.d.ts` |
  | `@object-ui/plugin-designer` | 70 to 66 | `dist/__tests__/__mocks__/plugin-form.d.ts`, `plugin-grid.d.ts`, and both `.d.ts.map` |
  | `@object-ui/plugin-grid` | 62 to 60 | `dist/__tests__/explainDouble.d.ts` and its `.d.ts.map` |
  | `@object-ui/plugin-view` | 13 to 12 | `dist/__tests__/explainDouble.d.ts` |
  
  Only `@object-ui/core`'s had runtime weight. The other eight are declarations nothing resolves, but `core.bench.js` is a real emitted module whose first import is `import { bench, describe } from 'vitest'` — a runtime import of a package a consumer never installs, since `vitest` is a devDependency of `@object-ui/core` and devDependencies are not installed transitively. Nothing resolves it today either (it is not in the `exports` map), so no consumer breaks in either direction; this is the tarball shedding files nothing reached.
  
  No type coverage leaves with the emit. The three plugins' helper and mock files are already program inputs of the `tsconfig.test.json` that each package's `type-check` chains, reached through the imports in the suites beside them — `tsc --listFiles` names all four files on both sides of the change. `core.bench.ts` had no such edge, since nothing imports a benchmark, so it is now named explicitly in `packages/core/tsconfig.test.json`. That move was deliberate rather than forced: `scripts/check-type-check-coverage.mjs` enumerates `*.test.ts(x)` only, so a benchmark that no program reads is invisible to it, and dropping the coverage silently would have been the "coverage that was right by accident" objectui#4006 recorded. Verified by appending a provably-false annotation to the benchmark, which turns `tsc -p packages/core/tsconfig.test.json` red at exit 2.
- 20bc99f: `ObjectView` forwards the canonical `table` keys — `pagination` / `selection` / `filter` / `sort` now take effect, and the deprecated spellings keep working as aliases.
  
  `ObjectViewSchema.table` is documented as inheriting from `ObjectGridSchema`,
  but `ObjectView` does not spread it: it forwards a hand-written whitelist of
  keys, and that whitelist carried only the **deprecated** half of four pairs.
  `pageSize`, `selectable`, `defaultFilters` and `defaultSort` were forwarded;
  their canonical successors `pagination`, `selection`, `filter` and `sort` had
  **no read point at all** in the file.
  
  So an author who wrote the shape the type recommends — `table: { pagination:
  { pageSize: 25 } }`, having read `@deprecated Use pagination.pageSize instead`
  on the key they were avoiding — got a view that compiled, read correctly, and
  did nothing. There was no failure signal at any layer: the key is declared on
  `ObjectGridSchema`, `ObjectGrid` already reads it, and only this forwarding hop
  dropped it. That silent success is the defect being closed.
  
  All four canonical keys are now forwarded at every site that forwarded their
  deprecated counterpart: the grid schema, the non-grid data fetch
  (kanban / gallery / calendar / timeline / gantt / map), and the delegated
  `renderListView` schema. When an author writes both spellings the **canonical
  key wins** — it is read first in the chains `ObjectView` resolves itself, and on
  the grid path both slots are forwarded so `ObjectGrid`'s existing canonical-first
  resolution decides, keeping the two layers in agreement.
  
  Nothing that worked before changes. The deprecated spellings are still read and
  are still the value used when they are the only one written; no canonical value
  is synthesised from a deprecated one, so `ObjectGrid`'s `pagination`-keyed
  behaviour is untouched for views that only ever wrote `pageSize`. The two
  precedence segments ahead of `table` — a named `listViews` entry, then the
  active view — are untouched, and a named view still outranks a `table` default.
  
  Declaration-surface note: `table` remains `Partial< Omit< ObjectGridSchema, … > >`,
  which the `BaseSchema` index signature collapses to zero declared members, so
  editor completion still offers no keys and a misspelling is still accepted
  silently. That half is deferred to the structural track and is not addressed
  here.
- e22b9d7: `ObjectView` sends a named view's `sort` to the grid slot that can hold it — the declared sort now reaches both the header indicator and `$orderby`.
  
  A named view's sort is an **array**: `NamedListView.sort` is
  `Array< { field, order } >`, and the `views` prop declares an array too.
  `ObjectView` forwarded the resolved view sort into `gridSchema.defaultSort`,
  which `ObjectGridSchema` declares as a **single** `{ field, order }`. The
  arity mismatch had no compile-time witness — `ObjectViewSchema.table`
  collapses to a bare index signature — and both of `ObjectGrid`'s readers then
  failed, in different ways:
  
  - **The header drew nothing.** `parseSchemaSort(schemaSort ?? (schema.defaultSort
    ? [schema.defaultSort] : undefined))` re-wraps an already-array `defaultSort`
    into `[[{ field, order }]]`. Each entry must be a string or an object with a
    string `field`; a nested array is neither, so the entry was skipped and the
    parse returned `[]`. A view that arrived sorted `name desc` looked unsorted,
    and the first click on that column asked for `asc` on a list already `desc`.
  - **The fetch sent nonsense.** `` `${(schema.defaultSort as any).field} ${(schema
    .defaultSort as any).order}` `` reads two absent keys off an array, so the
    request carried the literal string `"undefined undefined"` as `$orderby`.
    `serializeOrderBy` passes a non-empty string through untouched, so that
    reached the server verbatim.
  
  The two view precedence segments (`listViews` entry, then the active `views`
  entry) now ride the **canonical** `sort` slot, declared `string | SortConfig[]`
  — the arity a view actually carries, and the only one of the pair that can
  express a multi-key sort at all. The legacy `defaultSort` slot keeps carrying
  the `table` segment alone and is read exactly as before.
  
  **Precedence is unchanged.** `ObjectGrid` resolves `sort ?? defaultSort`, so a
  view sort still outranks both `table.sort` and `table.defaultSort`, and a
  `table.sort` still outranks a `table.defaultSort` — the same order the non-grid
  fetch and the delegated `renderListView` schema already express. A view that
  supplies no sort forwards exactly what it forwarded before.
  
  This is also the shape the shared sort sink accepts (`convertSortToQueryParams`
  takes `string | SortConfig[]`), so the fix converges on the normalized dialect
  rather than adding another spelling for the sort-sink convergence work to fold
  in later.
- 2426608: `ObjectView` now forwards the canonical `table.columns` on the non-grid paths, not only on the grid one.
  
  `ObjectViewSchema.table` inherits from `ObjectGridSchema`, where `columns` is the
  canonical spelling and `fields` carries `@deprecated Use columns instead`. Only
  one of the file's three field-list read points consulted `table.columns` — the
  grid one. `generateViewSchema`'s shared `baseProps` and the delegated
  `renderListView` schema both read `table.fields` alone, so an author who wrote
  `table: { columns: [...] }` on a non-grid view got an empty field list from a
  schema that compiled and read correctly. Same silent-success shape as
  objectui#5102, different mechanism: not a whitelist that knows only legacy
  spellings, but one that disagreed with itself between two rendering paths.
  
  Both sites now read the canonical key first and keep the deprecated one as a
  working alias, exactly as objectui#5102 settled it for its four pairs. Nothing
  is translated or reshaped on the way through, and precedence is unchanged: a
  named view's `columns`, then the active view's, then the `table` segment.
  
  Where this is observable, measured rather than assumed: `object-kanban` (the
  card fields) and `object-tree` (its flat columns) consume the shared
  `baseProps` field list, and the delegated `list-view` consumes `columns`.
  `object-gallery`, `object-calendar`, `object-timeline`, `object-gantt` and
  `object-map` read no field list off their schema at all, so the forwarded value
  is inert there — before this change and after it.
  
  One shape question the forwarding raised, answered at the boundary:
  `table.columns` is `string[] | ListColumn[]`, and the non-grid slot is a
  names slot (`ObjectKanban` indexes the record by each entry). The object form
  is therefore resolved to field names there with `columnIdentity` — the same
  fold `ObjectGrid` applies to this very value — so one authored `table.columns`
  resolves identically on both paths, and a `ListColumn[]` cannot arrive as a
  non-empty card field list naming nothing (which would suppress ObjectKanban's
  `highlightFields` fallback and render emptier than the bug being fixed). The
  delegated `list-view` slot declares the same union and keeps the value raw, so
  an author's per-column `label` / `width` still reach the list renderer.
- 99d5659: The plugin-view documentation-site page now teaches the keys `ObjectView`
  actually reads, so a copied example renders instead of coming up empty.
  
  `content/docs/plugins/plugin-view.mdx` carried the same fictional key surface
  the README did before it was rewritten: the object name was spelled `object`
  (the real key is `objectName`, the only required one besides `type`), the page
  was organised around a `viewMode` trichotomy that does not exist, and
  `fields` / `mode` / `recordId` / `fieldConfig` / `nestedFields` / `tabs` /
  `filters` / `searchable` / `enableDelete` went with it. None of those is a
  declared member of `ObjectViewSchema`, and none is read anywhere in
  `packages/plugin-view/src`. Because `type: 'object-view'` is genuinely
  registered, a copied example still resolved to a renderer — it just never
  received an `objectName`, and the component's data effects are all guarded on
  it, so the reader got a silent empty view rather than an error.
  
  The Schema API section and every example after it were rewritten against the
  declared surface, with each key measured against the renderer's read points
  before being written: `defaultViewType` (plus `listViews` / `defaultListView`)
  for the list type, `layout` and its drawer/modal/page record surface in place of
  the separate "form view" and "detail view" narratives, `table` and `form` for
  grid and form configuration, `operations` booleans and `onNavigate` in place of
  the `onCreate` / `onUpdate` / `onDelete` callbacks that were never part of this
  contract, and the `show*` toolbar toggles. The examples are now typed
  `ObjectViewSchema` blocks rather than untyped JSON, which makes a missing
  `objectName` a compile error in all fourteen of them — the page previously had
  no assertion at all, since `ObjectViewSchema` inherits an index signature from
  `BaseSchema` that accepts any undeclared key.
  
  Three structural facts are stated outright: `dataSource` is a required prop of
  `ObjectViewProps` and not a schema key; create, edit and read are internal
  states of one record surface rather than authored modes; and `ObjectView`
  forwards a fixed list of keys out of `table` and `form` rather than passing
  those objects through, so the page names exactly which ones — including that
  page size on this path is `table.pageSize`, not `table.pagination`.
  
  The TypeScript Support snippet's `import type { ObjectViewSchema }` also moves
  from `@object-ui/plugin-view`, which does not export it, to `@object-ui/types`,
  where it is declared. Copying the old line produced a TS2305.
- 405d54e: The plugin-view README now documents the keys `ObjectView` actually reads, so a
  copied example renders instead of coming up empty.
  
  Every untyped schema literal in the README was written against a key vocabulary
  `ObjectViewSchema` does not declare and `ObjectView` does not read. The object
  name was spelled `object` — the real key is `objectName`, and it is the only
  required key besides `type` — so a copied example left the component with no
  object to query. Three "view modes" were organized around a `viewMode` key that
  exists nowhere, and `fields`, `mode`, `recordId`, `fieldConfig`, `nestedFields`,
  `tabs`, `searchable`, `sortable`, `filters` and `enableDelete` were documented
  the same way. None of it failed loudly: `ObjectViewSchema` extends a base schema
  carrying a `[key: string]: any` index signature, so excess-property checking is
  defeated on this type, and the blocks carried no type annotation to trip even
  the one assertion that does bite.
  
  The thirteen affected blocks are rewritten against the declared surface, each
  one measured against the renderer before being written: `defaultViewType` (plus
  `listViews` / `defaultListView`) for the list type, `layout` with its
  drawer/modal/page record surface for what the README called form and detail
  views, `table` and `form` for grid and form configuration, `operations`
  booleans and `onNavigate` in place of the `onCreate` / `onUpdate` / `onDelete` /
  `onSubmit` callbacks that were never part of this contract, and the `show*`
  toolbar toggles. Examples now carry `ObjectViewSchema` annotations, which makes
  a missing `objectName` a compile error in all fifteen of them.
  
  Three structural facts are stated outright rather than left to be inferred:
  `dataSource` is a required prop of `ObjectViewProps` and not a schema key, so
  putting it in the schema does nothing; create/edit/read are internal states of
  one record surface rather than authored modes, which is why `ObjectViewSchema`
  omits `mode` from its `form` block; and `ObjectView` forwards a fixed list of
  keys out of `table` and `form` rather than passing those objects through, so the
  README now names exactly which ones — including that page size is `table.pageSize`
  on this path, the spelling the component forwards.
  
  The `ViewSwitcher`, `FilterUI` and `SortUI` sections are untouched: their keys
  were checked against the registered `inputs` and already matched.
- d2cf8fd: docs: README 按真实导出面重写虚构的 `viewComponents` 手动注册,并把 `ObjectViewSchema` 的导入路径改到 `@object-ui/types`
  
  `### Manual Registration` 教的 `viewComponents` 在本包(以至全仓)零命中,照抄第一行就是
  `Object.entries(undefined)` 抛 TypeError;替换为三节真话:七个 `ComponentRegistry.register`
  调用认领的 schema 类型键表、本包 39 个真实导出名、以及把导出组件挂到自定义键的写法。
  
  `ObjectViewSchema` 是真类型,但声明在 `@object-ui/types`,本包只 import 不 re-export,按
  README 原路径导入是 TS2305;改导入路径(未新增任何导出或 re-export),示例键面随之对齐真身
  (`objectName` 必填、`defaultViewType`、`table.columns`)。
  
  无代码/类型/运行时改动。声明 patch 是因为 `README.md` 在包的 `files` 里,随下次发布到 npm。
- Updated dependencies [88085e3]
- Updated dependencies [69251bf]
- Updated dependencies [57e668f]
- Updated dependencies [516663d]
- Updated dependencies [41ac1b7]
- Updated dependencies [1eaf0a1]
- Updated dependencies [feb6b16]
- Updated dependencies [460c4d0]
- Updated dependencies [0ae27f7]
- Updated dependencies [9aecabe]
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
- Updated dependencies [9b20dea]
- Updated dependencies [469b604]
- Updated dependencies [8b9dc62]
- Updated dependencies [d7be3bd]
- Updated dependencies [a954b48]
- Updated dependencies [bda9b12]
- Updated dependencies [e354dd0]
- Updated dependencies [1184192]
- Updated dependencies [a2a9747]
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
- Updated dependencies [f68018d]
- Updated dependencies [d374caf]
- Updated dependencies [5673576]
- Updated dependencies [c1ef923]
- Updated dependencies [911ceaa]
- Updated dependencies [98eab36]
- Updated dependencies [375efb4]
- Updated dependencies [af5e292]
- Updated dependencies [3fbbea1]
- Updated dependencies [3e0214c]
- Updated dependencies [800f455]
- Updated dependencies [dbbd38a]
- Updated dependencies [27c9cbd]
- Updated dependencies [7f96b10]
- Updated dependencies [167ec42]
- Updated dependencies [616a2a5]
- Updated dependencies [0046d8f]
- Updated dependencies [3b03704]
- Updated dependencies [f1d4748]
- Updated dependencies [bea374e]
- Updated dependencies [b1119ec]
- Updated dependencies [9f23d2b]
- Updated dependencies [b4089be]
- Updated dependencies [578e025]
- Updated dependencies [b4bccc7]
- Updated dependencies [af025ee]
- Updated dependencies [d109a4d]
- Updated dependencies [598c89a]
- Updated dependencies [4a0bd17]
- Updated dependencies [b8b9af4]
- Updated dependencies [31676be]
- Updated dependencies [958d757]
- Updated dependencies [8c0d52e]
- Updated dependencies [bfb64ee]
- Updated dependencies [e09f9e8]
- Updated dependencies [03e5f97]
- Updated dependencies [ae804ec]
- Updated dependencies [b29488f]
- Updated dependencies [9fbb9b5]
- Updated dependencies [90517e1]
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
- Updated dependencies [2165d88]
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
  - @object-ui/i18n@17.6.0
  - @object-ui/react@17.6.0
  - @object-ui/plugin-grid@17.6.0
  - @object-ui/components@17.6.0
  - @object-ui/core@17.6.0
  - @object-ui/plugin-form@17.6.0

## 17.5.0

### Patch Changes

- d0c3b26: Every plain `<button>` now declares its `type`. HTML defaults an untyped button to
  `type="submit"`, so any of these buttons would submit the form it was composed into
  instead of running its own handler — a real risk for renderers (`drawer`, `tree-view`,
  `navigation-overlay`) whose placement inside a form is a JSON metadata decision. 114
  sites were converted to `type="button"`; no site was a genuine submit button, and the
  DOM is otherwise unchanged.

  The defect class is now closed mechanically by a new `object-ui/button-has-type` ESLint
  rule (error), so the next untyped button fails CI at write time rather than being found
  by a fourth audit round (objectui#4045, closing the objectui#3344 family).

- 3f5f87c: `SchemaRenderer` states its real contract — a typed, required `schema` and a deliberate forwarding surface

  `SchemaRenderer` is the renderer loop: every registered SDUI component is rendered through it. It handed `forwardRef` a props type of `{ schema: SchemaNode } & Record<string, any>`, which puts `string` into `keyof Props`, so `'ref' extends keyof Props` was always true, React's `PropsWithoutRef` took its `Omit` branch, and `Omit` over a type carrying a string index signature keeps only the index signature. Every declared prop was erased. Measured on the pre-fix source: `keyof ComponentProps<typeof SchemaRenderer>` was `string` and `ComponentProps<typeof SchemaRenderer>['schema']` was `any`, while the type argument went on declaring `SchemaNode`. The other half is the same defect seen from the call site — `<SchemaRenderer />` with no schema at all, `<SchemaRenderer schema={12345} />`, and an arbitrary misspelled prop each type-checked in silence. This is objectui#4422 / PR #4438's trap in the most central component in the repo, spelled `Record<string, any>` rather than `[key: string]: any`, which is why every previous sweep's grep and both shipped guards' detector reported the site as clean.

  Graded **minor, not major**, on objectui#4528's reasoning: the type argument has always DECLARED `schema`; the index signature erased it from the resolved type, and restoring what the declaration documents is a fix to the published contract rather than a contract break.

  **The forwarding surface is kept, deliberately.** This component forwards every prop it does not read to the component the schema names, resolved at runtime from a plugin-extensible registry — `packages/react/README.md` documents exactly that, and `@object-ui/components`' form renderer consumes the `onSubmit` it shows being forwarded. Closing that surface would state a false contract and would force every leaf plugin's props into this package. So the two halves are separated: the `forwardRef` type argument is the honest `SchemaRendererProps`, with no index signature for `PropsWithoutRef` to collapse, and the open surface is stated once in an explicit export annotation, which nothing routes through `Omit`. The published `.d.ts` shows the erasure disappearing: `ForwardRefExoticComponent<Omit<{ schema: SchemaNode } & Record<string, any>, "ref"> & RefAttributes<any>>` becomes `ForwardRefExoticComponent<SchemaRendererProps & Record<string, any> & RefAttributes<any>>`.

  `SchemaRendererProps.schema` is declared as `BaseSchema | string | null | undefined` — what this component actually handles. It previously declared `@object-ui/core`'s `SchemaNode` interface, which requires `type: string` and so contradicted the component's own early returns for strings and nullish, while every caller held `@object-ui/types`' wider union. The erasure hid that mismatch completely.

  **One declared behaviour change.** A non-object, non-string primitive schema now renders as its own text. It previously fell through to the shallow copy `{ ...schema }`, which spreads a primitive to an empty object, lost the `type` the renderer then looked up, and surfaced the red "Unknown component type: undefined" box — an accident of the spread rather than a decision. The declared props type excludes `number` / `boolean` so no author is invited to pass them; the runtime handling is defence-in-depth for untyped callers and stored metadata. Strings, `null`, `undefined`, `0` and `false` render exactly as before, and an object naming an unregistered type still gets the error box; all four are pinned.

  Latent defects the erasure had been hiding, each surfaced by the repo-wide type-check and fixed at its call site: `DashboardRenderer` cast its widget schema to `Record<string, any>`, dropping the `type` every branch of `getComponentSchema` sets; `DashboardGridLayout`'s equivalent now states its return type instead of inferring a union that admitted a shape with no `type`; and `ReportViewer` handed a section's `content` array to the renderer whole, so a multi-node section rendered the unknown-component box instead of its content — arrays are mapped rather than widened into the renderer's declared input.

  A repo-wide structural guard replaces the two per-package siblings' blocked direction: it judges every `forwardRef` in `packages/*/src` (219 sites) and its detector resolves `Record<string, …>` and `string`-keyed mapped types in addition to literal index signatures — the spelling the previous detector went blind on. It judges the type argument only, where an index signature is an accidental eraser, and never an export annotation, where one is a stated contract.

- Updated dependencies [0e67b53]
- Updated dependencies [ceccdcf]
- Updated dependencies [d6e5124]
- Updated dependencies [debad27]
- Updated dependencies [dc2aa3e]
- Updated dependencies [ee66e2e]
- Updated dependencies [ee26e65]
- Updated dependencies [5900ac5]
- Updated dependencies [932cbcd]
- Updated dependencies [734d186]
- Updated dependencies [f650253]
- Updated dependencies [3d9769a]
- Updated dependencies [8f85f8b]
- Updated dependencies [7ffd616]
- Updated dependencies [d0c3b26]
- Updated dependencies [3fc2971]
- Updated dependencies [aca27fa]
- Updated dependencies [dde7283]
- Updated dependencies [f7c6430]
- Updated dependencies [4dadf0d]
- Updated dependencies [ae10a01]
- Updated dependencies [77d6f28]
- Updated dependencies [92876f0]
- Updated dependencies [f279deb]
- Updated dependencies [4b70d28]
- Updated dependencies [eb7f586]
- Updated dependencies [e901131]
- Updated dependencies [ebb4e0e]
- Updated dependencies [d9d3463]
- Updated dependencies [2a40f69]
- Updated dependencies [bec3e14]
- Updated dependencies [613b167]
- Updated dependencies [b4d3c22]
- Updated dependencies [1f9b905]
- Updated dependencies [cb13400]
- Updated dependencies [828549a]
- Updated dependencies [e1ade8f]
- Updated dependencies [bc64bfe]
- Updated dependencies [abb0f81]
- Updated dependencies [38ab505]
- Updated dependencies [51ab34e]
- Updated dependencies [24bb2de]
- Updated dependencies [0ca6096]
- Updated dependencies [3e19fe7]
- Updated dependencies [bb58d1d]
- Updated dependencies [5cc847c]
- Updated dependencies [fa21254]
- Updated dependencies [f565418]
- Updated dependencies [33c32bf]
- Updated dependencies [66fb4fa]
- Updated dependencies [b953a97]
- Updated dependencies [d7f3e30]
- Updated dependencies [6d641c9]
- Updated dependencies [7e4f0e5]
- Updated dependencies [a84385b]
- Updated dependencies [45e1949]
- Updated dependencies [51ac39f]
- Updated dependencies [5e514c4]
- Updated dependencies [92250d6]
- Updated dependencies [c1d939f]
- Updated dependencies [58bebf6]
- Updated dependencies [36310dc]
- Updated dependencies [405e808]
- Updated dependencies [49ae9f4]
- Updated dependencies [a3ae404]
- Updated dependencies [4270c11]
- Updated dependencies [bfdf3d4]
- Updated dependencies [bb68488]
- Updated dependencies [c0f9a4b]
- Updated dependencies [b1e42d0]
- Updated dependencies [2459a3e]
- Updated dependencies [ac853ce]
- Updated dependencies [fa51109]
- Updated dependencies [d6aa172]
- Updated dependencies [c32a8a1]
- Updated dependencies [fe52a04]
- Updated dependencies [d46f9b8]
- Updated dependencies [3f5f87c]
- Updated dependencies [2fea4d2]
- Updated dependencies [f5e1143]
- Updated dependencies [7f1cb33]
- Updated dependencies [f148a64]
- Updated dependencies [bb68488]
- Updated dependencies [2e3b0c0]
- Updated dependencies [9461dd3]
- Updated dependencies [78fa331]
- Updated dependencies [47f551b]
- Updated dependencies [31ab1ac]
- Updated dependencies [0082db8]
- Updated dependencies [ab04728]
- Updated dependencies [5bf09fd]
- Updated dependencies [06915b0]
- Updated dependencies [ff84b05]
  - @object-ui/i18n@17.5.0
  - @object-ui/react@17.5.0
  - @object-ui/components@17.5.0
  - @object-ui/core@17.5.0
  - @object-ui/types@17.5.0
  - @object-ui/plugin-grid@17.5.0
  - @object-ui/plugin-form@17.5.0

## 17.4.0

### Patch Changes

- Updated dependencies [794c497]
- Updated dependencies [993336f]
- Updated dependencies [f0a625a]
- Updated dependencies [b5980f4]
- Updated dependencies [8aad9fd]
- Updated dependencies [6719877]
- Updated dependencies [56ff091]
- Updated dependencies [7864f03]
- Updated dependencies [0cbdca8]
- Updated dependencies [d229dfa]
- Updated dependencies [18c42c6]
- Updated dependencies [ecae400]
- Updated dependencies [4bc6c23]
- Updated dependencies [d3e738a]
- Updated dependencies [c3b01a7]
- Updated dependencies [f5f8744]
- Updated dependencies [8497579]
- Updated dependencies [f0c9a90]
- Updated dependencies [7ed3360]
- Updated dependencies [69becd2]
- Updated dependencies [5e52495]
- Updated dependencies [0fa5e4d]
- Updated dependencies [b750823]
- Updated dependencies [5bfaabd]
- Updated dependencies [022002a]
- Updated dependencies [e06810e]
- Updated dependencies [ab3ad4f]
- Updated dependencies [c2fd122]
- Updated dependencies [1bd6faa]
- Updated dependencies [9154d9e]
- Updated dependencies [ac2139c]
- Updated dependencies [b14ab3a]
- Updated dependencies [e24d767]
- Updated dependencies [8c60819]
- Updated dependencies [aca561a]
- Updated dependencies [e64a52e]
- Updated dependencies [844d17f]
- Updated dependencies [48132f7]
- Updated dependencies [4dcd52a]
- Updated dependencies [42ae5c6]
- Updated dependencies [0ef9dfd]
- Updated dependencies [1d723e3]
- Updated dependencies [0109f54]
- Updated dependencies [7e5bb5d]
- Updated dependencies [fbc23e0]
- Updated dependencies [6d762da]
- Updated dependencies [e6fdbdc]
- Updated dependencies [54233b1]
- Updated dependencies [f9faa7d]
- Updated dependencies [97b63d7]
- Updated dependencies [14c59c0]
- Updated dependencies [aeb8424]
- Updated dependencies [6bb454a]
- Updated dependencies [1a33b1a]
- Updated dependencies [11c1e71]
- Updated dependencies [523be48]
- Updated dependencies [7e2b7e9]
- Updated dependencies [33526fd]
- Updated dependencies [32413ec]
- Updated dependencies [c1e1e6b]
  - @object-ui/components@17.4.0
  - @object-ui/react@17.4.0
  - @object-ui/core@17.4.0
  - @object-ui/i18n@17.4.0
  - @object-ui/types@17.4.0
  - @object-ui/plugin-grid@17.4.0
  - @object-ui/plugin-form@17.4.0

## 17.3.0

### Patch Changes

- 28b2e65: Localize the create / edit / view form title `ObjectView` builds itself
  (objectui#3462)

  The same family as #3426 / PR #3457 and #3459 / PR #3464, one call site further
  in. `ObjectView.getFormTitle()` string-built its three verbs in TypeScript:

      case 'create': return `Create ${objectLabel}`;
      case 'edit':   return `Edit ${objectLabel}`;
      case 'view':   return `View ${objectLabel}`;

  so a Chinese session whose object is labelled 联系人 read a drawer headed
  **"View 联系人"** — an English verb glued onto a localized label. All three
  consumers are visible chrome: `renderDrawerForm`'s `DrawerTitle`,
  `renderModalForm`'s `DialogTitle`, and the `title` prop handed to
  `NavigationOverlay` in the `popover` branch (a host-supplied `title` displaces
  the overlay's own `resolvedTitle` default, so it is what the user sees).

  The bar to reach it is lower than #3459's split panel: `ObjectViewSchema.layout`
  already defaults to `'drawer'`, and `navigation` is a declared authorable input
  on the registered `object-view` block whose `mode` union carries `drawer`,
  `modal` and `popover`. A row click under any of them sets `formMode: 'view'` and
  opens the container. `app-shell`'s wrapper pinning `layout: 'page'` is one host
  overriding a registered block, not proof the branch is dead.

  ## What changed

  The three verb branches resolve `form.createTitle` / `form.editTitle` /
  `form.viewTitle`.

  **No new key family was minted.** `form.createTitle` (`'Create {{object}}'`) and
  `form.editTitle` (`'Edit {{object}}'`) already ship in all ten packs and are
  already how `app-shell` heads the PAGE-mode record form
  (`RecordFormPage.tsx`, `AppContent.tsx`). The drawer / modal / popover titles are
  the same heading on a different surface, so they resolve the same keys — a
  parallel per-plugin family would have guaranteed the two spellings drift, which
  is what the sibling issues were about. Only the third verb had no sibling:
  `form.viewTitle` is added to all ten packs, following each pack's existing
  arrangement for its create/edit twins rather than a translated-verb-plus-label
  concatenation (de puts the verb last, ja/zh use particles and no space).

  `VIEW_DEFAULT_TRANSLATIONS` in `ObjectView.tsx` gains the three English entries,
  which is what `createSafeTranslation` falls back to with no `I18nProvider`
  mounted.

  Two branches stay literal on purpose and are pinned by tests: `schema.form.title`
  (the author wrote a title, so the author's title wins, in every locale) and the
  `default` branch (bare object label, no verb to translate).

  ## Visible English change

  None. Every branch is byte-identical in English — `Create Contacts`,
  `Edit Contacts`, `View Contacts` — with and without a provider, so e2e specs and
  host tests that address this chrome by its English name keep addressing it. The
  provider-less path has its own test file, kept separate because
  `initReactI18next` registers its instance as a module global that outlives
  `cleanup()`.

  The toolbar's create BUTTON keeps resolving `console.objectView.new`
  ("New" / 新建) and was deliberately not reused for the heading: a button verb and
  a title are different contexts, and folding them together is how the next drift
  of this shape would start.

- aa36e60: Localize the record-detail headings that `ObjectKanban`, `ObjectTree` and
  `ObjectView` build themselves (objectui#3459)

  #3426 / PR #3457 keyed `ListView` and `ObjectGrid`; a repo-wide grep found the
  same pattern in three more hosts, each string-building an English heading in
  TypeScript so the surrounding drawer/panel was fully localized with one English
  phrase on top of it.

  - `packages/plugin-kanban/src/ObjectKanban.tsx` — the object-derived heading of
    the card-detail drawer
  - `packages/plugin-tree/src/ObjectTree.tsx` — the bare literal
    `"Record Details"` handed to `NavigationOverlay`
  - `packages/plugin-view/src/ObjectView.tsx` — `` `${objectLabel} Detail` `` on
    the `mode: 'split'` panel

  All three are user-reachable, each verified by a test that drives the real
  interaction (render the block, click a card/row, read the heading), not by
  inspection:

  - `object-kanban` is a public page block whose `navigation` config DEFAULTS to
    `{ mode: 'drawer' }`, so a board needs no authoring at all to open this
    drawer on card click;
  - `object-tree` needs `navigation: { mode: 'drawer' }` authored explicitly, and
    every row's click is wired to `navigation.handleClick`;
  - `object-view` declares `navigation` as an authorable input and maps
    `mode: 'split'` onto the branch that renders this heading.

  ## What changed

  Each call site now keys its heading through the existing `detail.*` pair —
  `detail.recordDetailWithLabel` (`'{{label}} Detail'`) where an object label is
  available, `detail.recordDetail` where none is. No new locale keys: both
  already ship in all ten packs from #3457, and reusing them keeps one heading on
  one control instead of minting per-plugin twins that drift.

  Each plugin gains its own English defaults map, which is what
  `createSafeTranslation` falls back to with no `I18nProvider` mounted;
  `@object-ui/plugin-tree` gains a dependency on `@object-ui/i18n` for it.

  ## Visible English change

  One, deliberate: the tree overlay's heading goes from the plural
  `Record Details` to the singular `Record Detail` — the spelling the whole
  `detail.*` family, including `NavigationOverlay`'s own default, already uses.
  The maintainer ruled on normalizing the stray plurals rather than minting a
  plural key; a repo-wide grep confirmed no `e2e/` spec and no unit test
  addressed the old string.

  Every other branch is byte-identical in English (`Contacts Detail`,
  `Support cases Detail`, `Contacts Detail`), with and without a provider —
  pinned by a provider-less test file per plugin, kept separate because
  `initReactI18next` registers its instance as a module global that outlives
  `cleanup()`.

  The kanban's other former plural (`'Card Details'`) is NOT a visible change: it
  sat on a branch that fires only when the board has no `objectName`, while the
  drawer consuming it returns `null` on that very condition. It is keyed anyway
  so the literal cannot leak if that guard ever relaxes, and it deliberately has
  no test — an assertion there would pass because nothing renders.

- Updated dependencies [18cd432]
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
- Updated dependencies [56409c2]
- Updated dependencies [042e09d]
- Updated dependencies [9cbcbf4]
- Updated dependencies [85c4c9c]
- Updated dependencies [fd54c3e]
- Updated dependencies [4eeb932]
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
- Updated dependencies [f833d3a]
- Updated dependencies [30ae33a]
- Updated dependencies [a6ec93d]
- Updated dependencies [2a9513d]
- Updated dependencies [71be406]
- Updated dependencies [d22ae31]
- Updated dependencies [c7ed4c3]
- Updated dependencies [2409e1d]
- Updated dependencies [789fe3e]
- Updated dependencies [8d8094a]
  - @object-ui/core@17.3.0
  - @object-ui/components@17.3.0
  - @object-ui/types@17.3.0
  - @object-ui/plugin-grid@17.3.0
  - @object-ui/i18n@17.3.0
  - @object-ui/react@17.3.0
  - @object-ui/plugin-form@17.3.0

## 17.2.0

### Patch Changes

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
- Updated dependencies [cb82705]
- Updated dependencies [f572849]
- Updated dependencies [5eaa861]
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
  - @object-ui/plugin-grid@17.2.0
  - @object-ui/plugin-form@17.2.0

## 17.1.0

### Minor Changes

- 5319bf1: feat(views): the list toolbar speaks one vocabulary — `userActions` (#2890 scope A step 3)

  The seven bare `show*` toolbar flags fold into the spec's `userActions`, and the
  renderer reads nothing else. `showDescription` folds into
  `appearance.showDescription` at the same boundary.

  | legacy                                                    | canonical                                                 |
  | :-------------------------------------------------------- | :-------------------------------------------------------- |
  | `showSearch` / `showSort` / `showFilters` / `showDensity` | `userActions.search` / `.sort` / `.filter` / `.rowHeight` |
  | `showGroup` / `showHideFields` / `showColor`              | `userActions.group` / `.hideFields` / `.rowColor`         |
  | `showDescription`                                         | `appearance.showDescription`                              |

  **The last three are new keys, and they close a capability hole rather than just
  renaming one.** `@objectstack/spec`'s `UserActionsConfigSchema` documents itself
  as "which interactive actions are available to users in the view toolbar — each
  boolean toggles the corresponding toolbar element on/off", and already carries
  `rowHeight` (objectui's `showDensity` under its spec name). Grouping, column
  visibility and row coloring are the same kind of toggle: the spec models all
  three as _configuration_ (`grouping`, `hiddenFields`, `rowColor`) but has no
  "may the user change it" switch for any of them.

  The consequence was visible in the product. With no `userActions` key to read,
  the two list surfaces **hardcoded opposite policies**: `InterfaceListPage` (the
  author-curated interface page) pinned all three OFF, `ObjectDataPage` pinned two
  ON — and an interface-page author could not turn grouping back on for end users
  at all. Both surfaces now express their policy as `userActions` defaults, which
  an author can override.

  Until the keys land in `@objectstack/spec`, `@object-ui/types` carries them as a
  documented `.extend()` on `UserActionsConfigSchema` (the same shape
  `ListColumnSchema` uses while waiting on objectstack#3761); it collapses into a
  plain re-export once they do. Note the spec schema is not `.strict()`, so before
  this an author writing `userActions: { group: false }` had it **silently
  stripped** — valid on parse, no effect at render.

  Defaults are unchanged and deliberately asymmetric, matching what these flags
  have always done: `search` / `sort` / `filter` / `rowHeight` / `group` are on
  unless turned off; `hideFields` / `rowColor` are off unless turned on. Making
  them uniform would grow two buttons on every existing view, so it is left as its
  own product decision rather than smuggled into a vocabulary migration.

  Also drops a dead relay in app-shell's `ObjectView`, which forwarded
  `showDescription` onto the node although `ListView` has only ever read
  `appearance.showDescription`.

### Patch Changes

- 4545380: fix(view): the spec→FilterBuilder map follows the four operators #2942 added

  `CANONICAL_TO_BUILDER` mapped `starts_with`, `ends_with`, `is_null` and
  `is_not_null` to `null`, with a comment asserting the FilterBuilder had no such
  operator. #2942 gave it `startsWith`, `endsWith`, `isNull` and `isNotNull` —
  and this table did not follow, so a stored view carrying any of the four still
  reached the builder as a raw spelling it could by then have rendered, and the
  comment claiming otherwise was simply false.

  All four now map. `is_null`/`is_not_null` go to `isNull`/`isNotNull` and **not**
  to `isEmpty`/`isNotEmpty`: the builder draws both pairs, and folding the NULL
  predicate onto the empty-string one would silently rewrite the author's operator
  the next time the view was saved.

  **The guard could not have caught this, and now can.** The parity test asserted
  the unmapped set equalled a hand-kept list of gaps — which stays true when the
  _builder_ gains an operator, because neither side of that comparison moves. The
  new assertion is derived instead: `starts_with` and `startsWith` fold to the same
  key, so an unmapped canonical operator whose folded name matches a folded builder
  id is an omission by definition. Verified by reverting the four mappings, which
  reproduces the drift as four named failures.

  The unmapped set is now empty — all 19 canonical `VIEW_FILTER_OPERATORS` members
  translate.

  Refs #2945, #2942, #2989

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

- bebaebd: refactor(view): remove ObjectView's filter/sort bar, which was never connected

  `ObjectView` carried its own filter and sort bar: `filterValues` / `sortConfig`
  state, a `filter-ui` schema and a `sort-ui` schema, ~80 lines of field
  introspection to build them. None of it was wired. No setter was ever called and
  neither schema was ever rendered — both states sat at their initial empty value
  for the component's entire life.

  Removed rather than wired, because the real filter and sort UI belongs to the
  renderer this component delegates to. `showFilters`, `showSort` and
  `filterableFields` are forwarded downstream and `ListView` implements them for
  real. Connecting the local copy would have produced a _second_ filter bar
  competing with that one.

  The dead state was not inert, though — it left a branch in every merge path that
  could never run, and those branches read as live code:

  - The fetch path merged `baseFilter` with a `userFilter` that was always `[]`.
  - `mergedFilters` (what the `renderListView` slot receives, used by the Studio
    design surface) opened with a branch that **replaced** the view's filter with
    the user's instead of combining them — which would have been a real bug had
    the state ever been written.

  Two "defects" reported against these branches during #3081 were unreachable for
  exactly this reason; that changeset carries the correction. Keeping code that
  looks live and cannot run is what made the misreading possible twice, which is
  the argument for deleting it rather than leaving it for the next reader.

  No behaviour change: every removed branch was unreachable, and the surviving
  paths are pinned by new tests covering both what the component queries with and
  what it hands the delegated renderer.

- 80edbd4: fix(view,components): the spec→FilterBuilder operator table covers the whole view vocabulary, and the dead write direction is gone

  `view-config-utils`' `SPEC_TO_BUILDER_OP` resolved **10 of the spec's 19
  canonical `VIEW_FILTER_OPERATORS`**. The nine it missed —
  `not_equals`, `starts_with`, `ends_with`, `greater_than`, `less_than`,
  `greater_than_or_equal`, `less_than_or_equal`, `is_null`, `is_not_null` — all
  appear in stored view metadata (they are canonical; `ViewFilterRuleSchema`
  validates against exactly this list), and each reached the FilterBuilder as a
  raw spelling its operator dropdown cannot select.

  Same defect and same cause as #2974, one table over: spellings were enumerated
  by hand. That table is now derived from the spec's own canonical list and
  `VIEW_FILTER_OPERATOR_ALIASES`, matched case- and separator-insensitively, so
  `not_in` / `notIn` / `'not in'` / `NOT_IN` are one entry rather than four
  chances to miss one.

  Four canonical operators have no FilterBuilder equivalent —
  `starts_with`/`ends_with` (absent from its vocabulary) and `is_null`/
  `is_not_null` (distinct from the `is_empty`/`is_not_empty` it does have). They
  are recorded as explicit `null`s and asserted, and deliberately left unmapped:
  folding them onto a near-equivalent would silently rewrite the author's
  operator on the next save, whereas an unmapped operator surfaces as a condition
  row the author must complete.

  Also retired `BUILDER_TO_SPEC_OP` and `toSpecFilter` — the write direction,
  dead since the legacy `buildViewConfigSchema` engine was replaced by the
  studio's spec-driven inspector (no caller anywhere in the repo, and not part of
  `@object-ui/plugin-view`'s public exports). It was objectui's last emitter of
  `'not in'` with a space, plus `before`/`after`, as _filter-AST_ operators —
  spellings that reached the server outside `VALID_AST_OPERATORS` and were dropped
  without an error (objectstack-ai/objectstack#3948).

  `@object-ui/components` now exports `FILTER_BUILDER_OPERATORS` (and the
  `FilterBuilderOperator` type), derived from the operators the FilterBuilder
  actually renders, so tables mapping onto that vocabulary can assert against it
  instead of restating it.

  Refs objectstack-ai/objectui#2945, #2901.

- e4c2783: fix(view): the chart view gets a label and an icon in the view switcher — objectui#2916

  `ViewSwitcher`'s two exhaustive `Record<ViewType, …>` maps — `DEFAULT_VIEW_LABELS`
  and `DEFAULT_VIEW_ICONS` — were each missing the `chart` key. `chart` is a member
  of `ViewType` and `plugin-charts` is a registered view, so a chart tab rendered
  with no icon and with its raw type key `chart` as the label, while every sibling
  view showed a glyph and a capitalized name.

  Both maps now carry `chart`, using the same `BarChart3` glyph and `'Chart'` label
  that `plugin-list`'s switcher, `app-shell`'s `ObjectView`/`CreateViewDialog`, and
  the `console.objectView.viewTypeChart` translation already agree on — so the
  switcher no longer disagrees with the rest of the UI. An explicit per-view
  `label`/`icon` still overrides the default, unchanged.

  Why the compiler did not catch it: `@object-ui/plugin-view` had no `type-check`
  script, so `Record<ViewType, …>` — the exhaustiveness guard that exists precisely
  to make a missing member a compile error — was never evaluated by CI. The package
  now type-checks both its sources and its tests, and its `DEBT` entry in
  `scripts/check-type-check-coverage.mjs` is deleted. Compiling the tests for the
  first time also surfaced three unused destructured spy parameters, and the
  package's one remaining reported error (a `dnd-kit` `SyntheticListenerMap`
  mismatch in `ViewTabBar`) is fixed by typing the listener bag as `dnd-kit`'s own
  exported `DraggableSyntheticListeners` rather than a hand-written structural fork.

  Refs objectui#2911, objectui#2915.

- Updated dependencies [62311b6]
- Updated dependencies [fc0272a]
- Updated dependencies [9e7349e]
- Updated dependencies [8864971]
- Updated dependencies [1cf0de7]
- Updated dependencies [752e18f]
- Updated dependencies [c785740]
- Updated dependencies [b41f401]
- Updated dependencies [5340879]
- Updated dependencies [19e9fa0]
- Updated dependencies [a149e90]
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
- Updated dependencies [aeb0bd2]
- Updated dependencies [c735bf7]
- Updated dependencies [02aef0c]
- Updated dependencies [6f29aa5]
- Updated dependencies [d21794c]
- Updated dependencies [c4db402]
- Updated dependencies [5319bf1]
- Updated dependencies [49e5671]
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
- Updated dependencies [5b084eb]
- Updated dependencies [aa1240a]
- Updated dependencies [2374a49]
- Updated dependencies [390c071]
- Updated dependencies [d10f526]
- Updated dependencies [e339d60]
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
- Updated dependencies [c0d0bc8]
- Updated dependencies [9867281]
  - @object-ui/core@17.1.0
  - @object-ui/components@17.1.0
  - @object-ui/plugin-grid@17.1.0
  - @object-ui/react@17.1.0
  - @object-ui/types@17.1.0
  - @object-ui/i18n@17.1.0
  - @object-ui/plugin-form@17.1.0

## 17.0.0

### Minor Changes

- cd09a7b: refactor(views): ListView reads the spec-canonical `columns`, with legacy `fields` folded in one normalizer (#2890 scope A step 1)

  `ListViewSchema` has been derived from `@objectstack/spec/ui` since #2231, but
  the renderer still spoke objectui's own vocabulary for the same concepts. First
  rename closed: **`fields` → `columns`**.

  Legacy acceptance does not disappear — stored view metadata in user databases
  carries `fields` — but it now lives in exactly one place instead of being
  re-implemented per read-site:

  - **New `normalizeListViewSchema` (`@object-ui/core`)** folds `fields` into
    `columns` (canonical wins when both are present) and drops the legacy key, so
    a read-site that was missed fails loudly instead of quietly taking the legacy
    path. It also absorbs the `viewType` renderability default ListView applied
    inline. Non-mutating, idempotent, and returns its input by reference when
    there is nothing to fold, so ListView's downstream memos keep a stable
    dependency identity.
  - **`ListView` normalizes once at the component boundary**, before anything
    reads the schema. This is what guarantees the fold runs: nothing on the render
    path parses view metadata through zod (the zod schemas serve the CLI
    validator, the VS Code extension and tests), so a `z.preprocess` on
    `ListViewSchema` — spec-side or local — would never execute.
  - **Producers emit `columns`**: `ObjectView`'s `renderListView` payload,
    `ObjectDataPage`, `InterfaceListPage` and the `list-view` registry defaults
    had been _downgrading_ already-canonical `columns` config back to `fields`.

  Two latent inconsistencies go away with it: the filter builder's
  objectDef-not-loaded fallback now resolves `ListColumn.field` (it read only
  `name`/`fieldName`, so object-form columns produced unnamed filter entries), and
  the column list no longer depends on which of the two keys a host happened to
  emit.

  `fields` stays declared on `ListViewSchema` and in the drift guard's sanctioned
  set — it is still valid input, and `@objectstack/spec`'s `react-blocks.ts`
  sanctions it as the React-tier `<ListView fields>` prop — but it is input-only.

- f1abf0e: fix(views): ListView reads the spec-canonical `filter`, so a view's base filter reaches every visualization (#2890 scope A step 4)

  Third rename in the ListView vocabulary migration: **`filters` → `filter`**. Unlike
  the first two this closes a live bug, because the fork was asymmetric.

  `ListView` was the **only** surface in the repo reading `filters`. Every child
  view — `ObjectGrid`, `ObjectGallery`, `ObjectKanban`, `ObjectCalendar`,
  `ObjectGantt`, `ObjectMap`, `ObjectTree`, `ObjectChart` — reads `filter`, and
  `ListView` handed them `filters`. Wherever a child fetches its own rows instead
  of receiving `ListView`'s, the view's base filter was silently dropped:

  - **a `chart` list view aggregated the whole object.** The chart branch built an
    `object-chart` node with `filters:`; `ObjectChart` reads `schema.filter` and
    never read `filters`, so a chart view with a base filter charted unfiltered
    totals.
  - the same applied to any of the other view components rendered standalone from
    a list-view-shaped config.

  Conversely, a **spec-authored** list view — one carrying `filter`, which is what
  the spec says and what `runtime-metadata-persistence` and "Save as view" already
  persist — rendered **unfiltered** in `ListView`, because nothing read that key.

  The fold is a key rename only. Both keys carry an ObjectQL FilterNode array
  everywhere in objectui; every consumer passes the value straight to `$filter`.
  (The spec types `filter` as `ViewFilterRule[]` — `{field, operator, value}`
  objects — so objectui's field is typed from the spec but used as something else.
  That mismatch is real and left alone here: converting formats inside a
  vocabulary fold would change what reaches the data source.)

  Also collapses a duplicated computation in `app-shell`'s `ObjectView`, which
  computed the same effective filter **twice** — once as `filter` for the child
  views, once as `filters` for `ListView` — with the two copies subtly different
  (only one fell back to `listSchema.filter`; only the other ran token
  substitution over the URL filters). There is now one computation, keeping both
  behaviors.

  `filters` stays declared on `ListViewSchema` and in the drift guard's sanctioned
  set — stored views carry it and it is still valid input — but it is input-only.

### Patch Changes

- 6dee2cb: feat(form): consume spec-aligned FormView buttons/defaults in ObjectForm

  The authored `@objectstack/spec` FormViewSchema carries structured
  `buttons.{submit,cancel,reset}.{show,label}` and `defaults`, but the form
  renderer only read the flat renderer-invented `showSubmit`/`submitText`/
  `showCancel`/`cancelText`/`showReset`/`initialValues`. That left the two spec
  keys parsed-but-inert (ADR-0078) and stuck at `experimental` in the spec
  liveness ledger.

  `ObjectForm` now folds the structured shape down onto those flat props inside
  its existing normalization pass, so every entry path (ObjectView
  drawer/modal/page, RecordFormPage) honors it. An explicitly-set flat key still
  wins, so metadata authored against the deprecated flat keys is unchanged.
  `ObjectView` and `RecordFormPage` forward `buttons`/`defaults` from the spec
  form view. `ObjectFormSchema` gains the optional `buttons`/`defaults` fields.

  Refs objectstack-ai/objectstack#1894, objectstack-ai/objectstack#2998.

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

- 8aae006: fix(views): the five per-view-type configs speak the spec vocabulary (#2231 phase 3)

  `kanban`/`calendar`/`gantt`/`gallery`/`timeline` on `ListViewSchema` were the last
  hand-written forks left after #2882 — and the fork was not cosmetic: objectui named
  the same concepts differently from `@objectstack/spec/ui`, and several read-sites
  only understood one of the two dialects. Two of those gaps were live bugs.

  **Kanban lanes ignored the spec key.** `ListView` gated the Kanban tab on
  `groupByField || groupField` but rendered lanes off `groupField` alone. A config
  authored with the spec key — which is exactly what the product's own
  `CreateViewDialog` emits — offered the tab and then grouped by whatever
  `detectStatusField()` guessed. The spec's `columns` (the fields shown on each card)
  was also spread onto the board verbatim, where `columns` means _lanes_, so
  `ObjectKanban` built lanes with `undefined` id and title. `columns` now maps to
  `cardFields` and the vocabulary keys are stripped from the passthrough.

  **Timeline lost every spec key in app-shell.** `ObjectView`'s `timeline` branch was
  a three-key whitelist while its `gallery`/`gantt` siblings had already been fixed to
  spread-first, so a stored `timeline: { startDateField, endDateField, groupByField,
colorField, scale }` arrived with only `titleField` and an axis pinned to the
  `'due_date'` fallback.

  Also: `plugin-view`'s `ObjectView` now reads `gallery.coverField` and
  `timeline.startDateField` (it only understood the legacy aliases), and the dead
  `gallery.subtitleField` is removed — three producers computed it and `ObjectGallery`
  never read it.

  The schema side now derives from the spec configs (`.partial()`, since the product
  authors partial configs and spec marks `columns`/`titleField`/`startDateField`
  required). `gantt` needed no local schema at all. The pre-#2231 names
  (`groupField`, `cardFields`, `imageField`, `dateField`) remain accepted as deprecated
  aliases so stored views keep validating; the spec key wins wherever both appear.
  `calendar.defaultView` stays local — it has no spec counterpart.

- Updated dependencies [7b21891]
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
- Updated dependencies [8fb1295]
- Updated dependencies [e16ed2d]
- Updated dependencies [c6fd752]
- Updated dependencies [f9bbddb]
- Updated dependencies [dfd3705]
- Updated dependencies [c77108c]
- Updated dependencies [2735de6]
- Updated dependencies [c19ac11]
- Updated dependencies [6dee2cb]
- Updated dependencies [e05f052]
- Updated dependencies [0502a7c]
- Updated dependencies [faad45e]
- Updated dependencies [553443e]
- Updated dependencies [09c6a17]
- Updated dependencies [c7cff19]
- Updated dependencies [df6697f]
- Updated dependencies [ba73a02]
- Updated dependencies [ba45145]
- Updated dependencies [cd09a7b]
- Updated dependencies [f1abf0e]
- Updated dependencies [f05b84e]
- Updated dependencies [9b4b952]
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
- Updated dependencies [dc7a798]
- Updated dependencies [d147a13]
- Updated dependencies [c6aaed8]
- Updated dependencies [263f885]
- Updated dependencies [dc334da]
  - @object-ui/components@17.0.0
  - @object-ui/i18n@17.0.0
  - @object-ui/react@17.0.0
  - @object-ui/plugin-grid@17.0.0
  - @object-ui/types@17.0.0
  - @object-ui/core@17.0.0
  - @object-ui/plugin-form@17.0.0

## 16.1.0

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

- Updated dependencies [0318118]
- Updated dependencies [1c8935a]
- Updated dependencies [af1b0db]
- Updated dependencies [8b8b744]
- Updated dependencies [7cf4051]
- Updated dependencies [803558e]
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
- Updated dependencies [1629313]
- Updated dependencies [29c6040]
- Updated dependencies [faebac3]
- Updated dependencies [2331ac9]
- Updated dependencies [199fa83]
- Updated dependencies [eee4ded]
- Updated dependencies [3b2e4d9]
  - @object-ui/i18n@16.1.0
  - @object-ui/core@16.1.0
  - @object-ui/types@16.1.0
  - @object-ui/react@16.1.0
  - @object-ui/plugin-form@16.1.0
  - @object-ui/components@16.1.0
  - @object-ui/plugin-grid@16.1.0

## 16.0.0

### Patch Changes

- Updated dependencies [d3e19ed]
- Updated dependencies [59d4fa9]
- Updated dependencies [4c7c47f]
- Updated dependencies [210806a]
- Updated dependencies [80977d0]
- Updated dependencies [9d4a429]
- Updated dependencies [b4ef588]
- Updated dependencies [ca0f5f0]
- Updated dependencies [5534535]
- Updated dependencies [9b8f978]
- Updated dependencies [195a651]
- Updated dependencies [33b4995]
  - @object-ui/react@16.0.0
  - @object-ui/components@16.0.0
  - @object-ui/types@16.0.0
  - @object-ui/plugin-grid@16.0.0
  - @object-ui/plugin-form@16.0.0
  - @object-ui/i18n@16.0.0
  - @object-ui/core@16.0.0

## 15.0.0

### Patch Changes

- @object-ui/types@15.0.0
- @object-ui/core@15.0.0
- @object-ui/i18n@15.0.0
- @object-ui/react@15.0.0
- @object-ui/components@15.0.0
- @object-ui/plugin-form@15.0.0
- @object-ui/plugin-grid@15.0.0

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

- Updated dependencies [82441e4]
- Updated dependencies [2efa9fd]
- Updated dependencies [0890fa7]
- Updated dependencies [2ded18c]
- Updated dependencies [e628d1f]
- Updated dependencies [5523fc4]
- Updated dependencies [887062c]
- Updated dependencies [579b24d]
- Updated dependencies [23d65c3]
- Updated dependencies [06d5ec6]
- Updated dependencies [055e1d2]
- Updated dependencies [9e2d58f]
- Updated dependencies [dea65f7]
- Updated dependencies [f30ff68]
- Updated dependencies [073e7aa]
- Updated dependencies [6c0135c]
- Updated dependencies [5b52624]
- Updated dependencies [4afb251]
- Updated dependencies [d5b1bc0]
- Updated dependencies [f94905d]
- Updated dependencies [f0f10f5]
  - @object-ui/i18n@14.1.0
  - @object-ui/core@14.1.0
  - @object-ui/types@14.1.0
  - @object-ui/react@14.1.0
  - @object-ui/plugin-form@14.1.0
  - @object-ui/plugin-grid@14.1.0
  - @object-ui/components@14.1.0

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
  - @object-ui/plugin-grid@14.0.0
  - @object-ui/components@14.0.0
  - @object-ui/plugin-form@14.0.0

## 13.2.0

### Patch Changes

- Updated dependencies [80901aa]
- Updated dependencies [53c40c2]
- Updated dependencies [e492b9d]
- Updated dependencies [5da9905]
  - @object-ui/components@13.2.0
  - @object-ui/plugin-grid@13.2.0
  - @object-ui/i18n@13.2.0
  - @object-ui/plugin-form@13.2.0
  - @object-ui/react@13.2.0
  - @object-ui/types@13.2.0
  - @object-ui/core@13.2.0

## 13.1.0

### Patch Changes

- @object-ui/types@13.1.0
- @object-ui/core@13.1.0
- @object-ui/i18n@13.1.0
- @object-ui/react@13.1.0
- @object-ui/components@13.1.0
- @object-ui/plugin-form@13.1.0
- @object-ui/plugin-grid@13.1.0

## 13.0.0

### Patch Changes

- Updated dependencies [9e38270]
- Updated dependencies [ac04b76]
- Updated dependencies [619097e]
  - @object-ui/i18n@13.0.0
  - @object-ui/components@13.0.0
  - @object-ui/types@13.0.0
  - @object-ui/plugin-form@13.0.0
  - @object-ui/plugin-grid@13.0.0
  - @object-ui/react@13.0.0
  - @object-ui/core@13.0.0

## 12.1.0

### Patch Changes

- Updated dependencies [6cbccf3]
- Updated dependencies [e1840bf]
- Updated dependencies [c31874d]
- Updated dependencies [195121a]
  - @object-ui/components@12.1.0
  - @object-ui/i18n@12.1.0
  - @object-ui/types@12.1.0
  - @object-ui/plugin-form@12.1.0
  - @object-ui/plugin-grid@12.1.0
  - @object-ui/react@12.1.0
  - @object-ui/core@12.1.0

## 12.0.0

### Patch Changes

- 77a0953: Consolidate the record-surface mirror onto `@objectstack/spec/data` (objectui#2269 debt paydown).

  `plugin-view/src/recordSurface.ts` re-exports `deriveRecordSurface` / `deriveRecordFlowSurface` / `countAuthorableFields` / `RECORD_SURFACE_PAGE_THRESHOLD` + types from `@objectstack/spec/data` instead of carrying a hand-kept copy — the local mirror only existed because objectui pinned a spec (`^11.7`) predating those exports, and the pin is now `^12.2`. The objectui-local overlay-size helpers (`deriveOverlaySize` / `overlayWidthFor` / `OverlaySize`, a renderer width concern the protocol doesn't own) stay local but reuse spec's `countAuthorableFields`. `RecordSurface` widens to spec's `'page' | 'modal' | 'drawer'` (the heuristic still only emits page/drawer); `resolvePostCreateTarget`'s `surface` param accepts the wider type and treats `'modal'` like a drawer. Behavior is unchanged (mirror unit tests pass verbatim against the re-exported functions); console production build resolves the subpath import.

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
- Updated dependencies [e4de456]
- Updated dependencies [68e2d1c]
  - @object-ui/types@12.0.0
  - @object-ui/core@12.0.0
  - @object-ui/components@12.0.0
  - @object-ui/plugin-form@12.0.0
  - @object-ui/plugin-grid@12.0.0
  - @object-ui/react@12.0.0
  - @object-ui/i18n@12.0.0

## 11.5.0

### Minor Changes

- 6c1ad9e: Record task flows open as derived overlays with lossless return (framework#2604, extends framework#2578).

  - **Create/Edit never route** — the global record form is URL-driven (`?form=new` / `?form=<id>`): browser Back closes the overlay with the origin (list scroll/filters, detail state) intact; field-heavy objects derive a full-screen modal (`modalSize:'full'`) via the new `deriveRecordFlowSurface` mirror in plugin-view, light ones keep the auto-sized modal. `editMode:'page'` opt-in unchanged.
  - **Save invariant** — _edit never moves you_ (origin refetches in place); _create lands on the new record's detail_ on its derived surface (drawer over the still-intact list for light objects, detail route for heavy), with `replace:true` so Back skips the transient form entry.
  - **Subtable child create/edit = overlay over the parent detail, never a route** — related-list New/Edit push `?form=…&formObject=<child>&formLink=<fk>:<parentId>`; the one global overlay pre-links the parent (refresh-safe), sizes to the CHILD object, and on save stays on the parent while only the child's related lists refetch. ModalForm now forwards `initialValues` into its master-detail (subforms) branch so pre-links survive for children with inline line items.

### Patch Changes

- 70c4a3f: Studio package-create dogfood follow-ups (framework#2615 — P2 wizard + P3 polish):

  - **Package-id wizard feedback.** The three package wizards (switcher create,
    landing create, landing duplicate) share a new `PackageIdInput`: illegal
    characters are still normalized away, but no longer silently — a notice
    says what was removed — a reverse-domain format hint shows while the id
    doesn't parse, and a CJK-only name that yields no id suggestion is told to
    type one manually instead of leaving the id box mysteriously empty.
  - **Records-grid duplicate "Actions" column.** A field literally named
    `actions` is now dropped from the Studio grid's data columns, so it no
    longer collides with the always-pinned row-actions column (it stays
    editable in the form designer).
  - **Record-create verb consistency.** The `ObjectView` toolbar create button
    resolved a hardcoded English "Create"; it now uses the same
    `console.objectView.new` ("New" / 新建) key as the runtime object pages so
    Studio and the running app agree.
  - **Branded cold-load splash.** The console's pre-auth loading gate rendered a
    bare "Loading…"; it now shows the branded, boot-safe `LoadingScreen`.
  - **Picklist option editor.** Value/label inputs and CJK option labels no
    longer truncate — the six controls that shared one cramped row are split
    into a two-row layout so the inputs get the full panel width.
  - **Draft-save confirmation.** The Data pillar's "Save draft" now shows a
    success toast and a "last saved HH:MM" indicator, matching the App and
    Automations pillars.

- Updated dependencies [544d8eb]
- Updated dependencies [6fffd3d]
- Updated dependencies [9255686]
- Updated dependencies [fae75e2]
- Updated dependencies [1072701]
- Updated dependencies [ec9c8ee]
- Updated dependencies [6c1ad9e]
  - @object-ui/i18n@11.5.0
  - @object-ui/react@11.5.0
  - @object-ui/components@11.5.0
  - @object-ui/types@11.5.0
  - @object-ui/plugin-form@11.5.0
  - @object-ui/plugin-grid@11.5.0
  - @object-ui/core@11.5.0

## 11.4.0

### Minor Changes

- 8bf6295: feat: adaptive record surface + semantic field span + responsive columns (framework#2578)

  Field-heavy objects (all metadata is AI-authored) now present themselves without
  any authored presentation config:

  - **Adaptive surface** — a record's create/edit/detail opens as a full page when
    the object is field-heavy, or a drawer when it is light. Derived from field
    count (`deriveRecordSurface`), not authored; mobile always pages. Wired into the
    app-shell ObjectView detail navigation (an authored view/object `navigation`
    still wins).
  - **Semantic field span** — `FormField.span` (`auto`/`full`) is a width primitive
    decoupled from the (per-surface derived) column count; legacy `colSpan` is
    clamped so it never overflows. `ObjectForm` now honours per-section `columns`
    and carries `span`/`colSpan` from section defs — fixes the bug where
    `type:'simple'` ignored `section.columns` and grouped fields rendered single
    column.
  - **Responsive columns** — `inferColumns` scales the column CAP with field count
    (≤3→1, ≤8→2, ≤15→3, 16+→4); the ACTUAL column count follows the form's real
    width via CSS container queries, so the same form goes 1→2→3→4 columns as a
    drawer widens or becomes a page.
  - **Runtime overlay width** — `NavigationConfig.size` bucket is resolved to a
    viewport-clamped width at runtime (`overlayWidthFor`); a pixel width is never
    authored (the author cannot know the client viewport).

### Patch Changes

- Updated dependencies [8bf6295]
- Updated dependencies [144ab55]
- Updated dependencies [1948c5b]
- Updated dependencies [3e42680]
- Updated dependencies [bce581a]
- Updated dependencies [2edcaff]
- Updated dependencies [9cd9be1]
- Updated dependencies [c38d107]
- Updated dependencies [7782698]
- Updated dependencies [1e9145d]
- Updated dependencies [e84d64d]
  - @object-ui/plugin-form@11.4.0
  - @object-ui/types@11.4.0
  - @object-ui/plugin-grid@11.4.0
  - @object-ui/components@11.4.0
  - @object-ui/core@11.4.0
  - @object-ui/react@11.4.0

## 11.3.0

### Patch Changes

- Updated dependencies [d88c8ec]
- Updated dependencies [b7237bb]
- Updated dependencies [c55a52a]
- Updated dependencies [2e3e058]
- Updated dependencies [d23d6eb]
  - @object-ui/components@11.3.0
  - @object-ui/plugin-grid@11.3.0
  - @object-ui/core@11.3.0
  - @object-ui/plugin-form@11.3.0
  - @object-ui/react@11.3.0
  - @object-ui/types@11.3.0

## 11.2.0

### Patch Changes

- Updated dependencies [9e7a986]
- Updated dependencies [1311749]
  - @object-ui/components@11.2.0
  - @object-ui/core@11.2.0
  - @object-ui/plugin-form@11.2.0
  - @object-ui/plugin-grid@11.2.0
  - @object-ui/react@11.2.0
  - @object-ui/types@11.2.0

## 11.1.0

### Patch Changes

- @object-ui/components@11.1.0
- @object-ui/plugin-form@11.1.0
- @object-ui/plugin-grid@11.1.0
- @object-ui/react@11.1.0
- @object-ui/types@11.1.0
- @object-ui/core@11.1.0

## 7.3.0

### Patch Changes

- @object-ui/plugin-form@7.3.0
- @object-ui/plugin-grid@7.3.0
- @object-ui/types@7.3.0
- @object-ui/core@7.3.0
- @object-ui/react@7.3.0
- @object-ui/components@7.3.0

## 7.2.0

### Patch Changes

- Updated dependencies [0caea33]
- Updated dependencies [4aa8b84]
- Updated dependencies [d23db5c]
  - @object-ui/plugin-grid@7.2.0
  - @object-ui/plugin-form@7.2.0
  - @object-ui/types@7.2.0
  - @object-ui/components@7.2.0
  - @object-ui/react@7.2.0
  - @object-ui/core@7.2.0

## 7.1.0

### Patch Changes

- Updated dependencies [677f7ed]
- Updated dependencies [08c47da]
- Updated dependencies [a71be60]
- Updated dependencies [aae8791]
- Updated dependencies [cb03bc3]
  - @object-ui/types@7.1.0
  - @object-ui/core@7.1.0
  - @object-ui/react@7.1.0
  - @object-ui/plugin-form@7.1.0
  - @object-ui/components@7.1.0
  - @object-ui/plugin-grid@7.1.0

## 7.0.0

### Minor Changes

- 4eb9cb6: feat(plugin-tree): add a `tree` / tree-grid object view type

  Renders a self-referencing object as an indented, expand/collapse tree-grid —
  the right view for arbitrary-depth hierarchies (business unit / org chart,
  category trees, BOMs, nested comments) that fixed-depth grouping can't express.
  New `@object-ui/plugin-tree` package (`object-tree`/`tree`), `tree` added to the
  `ViewType` union, and dispatch wired through plugin-list `ListView` +
  app-shell `ObjectView` (the console path).

- 7b71cd8: Unify the runtime ObjectView "view editor" onto the studio's spec-driven inspector. The right-rail view editor now hosts the same `ViewVariantInspector` the metadata studio uses (config fields sourced straight from `@objectstack/spec`) instead of the legacy `buildViewConfigSchema` engine, so runtime and studio share one view-editing surface. A new `view-config-adapter` bridges the runtime's flat view shape and the studio's ViewItem draft, keeping the `sys_view` persistence path untouched; field pickers read from the in-memory object definition (no extra network fetch). The legacy `buildViewConfigSchema` engine and its exports are retired; `ConfigPanelRenderer` is retained for the dashboard/report config panels.

### Patch Changes

- 9bef806: feat(view): pass form-view `subforms` through to ObjectForm

  `ObjectView`'s form schema now forwards `form.subforms` to `ObjectForm`, so a
  form view that declares inline child collections renders as a master-detail
  form (parent fields + child grids, atomic save) in ObjectView's own
  create/edit form — no bespoke page. Pairs with `@objectstack/spec`
  `FormViewSchema.subforms` and ObjectForm's existing `subforms` rendering.

- Updated dependencies [5976ba3]
- Updated dependencies [a00e16d]
- Updated dependencies [eaccefd]
- Updated dependencies [f7f325d]
- Updated dependencies [c12986e]
- Updated dependencies [71d7ce0]
- Updated dependencies [053c948]
- Updated dependencies [053c948]
- Updated dependencies [ddbe4a2]
- Updated dependencies [2d47e94]
- Updated dependencies [9049bbe]
- Updated dependencies [6c0c92c]
- Updated dependencies [cb2fdb1]
- Updated dependencies [c3749eb]
- Updated dependencies [f6044fa]
- Updated dependencies [6cfa330]
- Updated dependencies [ad8ade6]
- Updated dependencies [d54346c]
- Updated dependencies [5332639]
- Updated dependencies [3870c20]
- Updated dependencies [2eb3096]
- Updated dependencies [b88c560]
- Updated dependencies [80c133c]
- Updated dependencies [d16566f]
- Updated dependencies [69510df]
- Updated dependencies [b148daf]
- Updated dependencies [90acb7f]
- Updated dependencies [7913390]
- Updated dependencies [514f426]
- Updated dependencies [586a027]
- Updated dependencies [00f8d2d]
- Updated dependencies [9aac2b8]
- Updated dependencies [1394e34]
- Updated dependencies [e95cc25]
- Updated dependencies [abe8ebc]
- Updated dependencies [300d755]
- Updated dependencies [bd8b054]
- Updated dependencies [4eb9cb6]
- Updated dependencies [7c239fd]
- Updated dependencies [858ad94]
- Updated dependencies [2270239]
- Updated dependencies [650bd1f]
- Updated dependencies [18728c1]
- Updated dependencies [8426db7]
- Updated dependencies [8d1195d]
  - @object-ui/core@7.0.0
  - @object-ui/components@7.0.0
  - @object-ui/plugin-grid@7.0.0
  - @object-ui/react@7.0.0
  - @object-ui/types@7.0.0
  - @object-ui/plugin-form@7.0.0

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3
- @object-ui/core@6.2.3
- @object-ui/react@6.2.3
- @object-ui/components@6.2.3
- @object-ui/plugin-form@6.2.3
- @object-ui/plugin-grid@6.2.3

## 6.2.2

### Patch Changes

- Updated dependencies [a66f788]
  - @object-ui/react@6.2.2
  - @object-ui/components@6.2.2
  - @object-ui/plugin-form@6.2.2
  - @object-ui/plugin-grid@6.2.2
  - @object-ui/types@6.2.2
  - @object-ui/core@6.2.2

## 6.2.1

### Patch Changes

- @object-ui/types@6.2.1
- @object-ui/core@6.2.1
- @object-ui/react@6.2.1
- @object-ui/components@6.2.1
- @object-ui/plugin-form@6.2.1
- @object-ui/plugin-grid@6.2.1

## 6.2.0

### Patch Changes

- @object-ui/plugin-form@6.2.0
- @object-ui/plugin-grid@6.2.0
- @object-ui/react@6.2.0
- @object-ui/components@6.2.0
- @object-ui/types@6.2.0
- @object-ui/core@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/core@6.1.0
  - @object-ui/types@6.1.0
  - @object-ui/components@6.1.0
  - @object-ui/plugin-form@6.1.0
  - @object-ui/plugin-grid@6.1.0
  - @object-ui/react@6.1.0

## 6.0.4

### Patch Changes

- @object-ui/types@6.0.4
- @object-ui/core@6.0.4
- @object-ui/react@6.0.4
- @object-ui/components@6.0.4
- @object-ui/plugin-form@6.0.4
- @object-ui/plugin-grid@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3
- @object-ui/core@6.0.3
- @object-ui/react@6.0.3
- @object-ui/components@6.0.3
- @object-ui/plugin-form@6.0.3
- @object-ui/plugin-grid@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2
- @object-ui/core@6.0.2
- @object-ui/react@6.0.2
- @object-ui/components@6.0.2
- @object-ui/plugin-form@6.0.2
- @object-ui/plugin-grid@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1
- @object-ui/core@6.0.1
- @object-ui/react@6.0.1
- @object-ui/components@6.0.1
- @object-ui/plugin-form@6.0.1
- @object-ui/plugin-grid@6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0
- @object-ui/core@6.0.0
- @object-ui/react@6.0.0
- @object-ui/components@6.0.0
- @object-ui/plugin-form@6.0.0
- @object-ui/plugin-grid@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2
- @object-ui/core@5.4.2
- @object-ui/react@5.4.2
- @object-ui/components@5.4.2
- @object-ui/plugin-form@5.4.2
- @object-ui/plugin-grid@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1
- @object-ui/core@5.4.1
- @object-ui/react@5.4.1
- @object-ui/components@5.4.1
- @object-ui/plugin-form@5.4.1
- @object-ui/plugin-grid@5.4.1

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0
  - @object-ui/components@5.4.0
  - @object-ui/core@5.4.0
  - @object-ui/plugin-form@5.4.0
  - @object-ui/plugin-grid@5.4.0
  - @object-ui/react@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2
- @object-ui/core@5.3.2
- @object-ui/react@5.3.2
- @object-ui/components@5.3.2
- @object-ui/plugin-form@5.3.2
- @object-ui/plugin-grid@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1
- @object-ui/core@5.3.1
- @object-ui/react@5.3.1
- @object-ui/components@5.3.1
- @object-ui/plugin-form@5.3.1
- @object-ui/plugin-grid@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0
- @object-ui/core@5.3.0
- @object-ui/react@5.3.0
- @object-ui/components@5.3.0
- @object-ui/plugin-form@5.3.0
- @object-ui/plugin-grid@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1
- @object-ui/core@5.2.1
- @object-ui/react@5.2.1
- @object-ui/components@5.2.1
- @object-ui/plugin-form@5.2.1
- @object-ui/plugin-grid@5.2.1

## 5.2.0

### Patch Changes

- Updated dependencies [de0c5e6]
- Updated dependencies [e3160a5]
- Updated dependencies [9997cae]
- Updated dependencies [b2d1704]
- Updated dependencies [5633edd]
- Updated dependencies [87bc8ff]
- Updated dependencies [3ebba63]
- Updated dependencies [e919433]
- Updated dependencies [a8d12ec]
- Updated dependencies [70b5570]
- Updated dependencies [aa063db]
- Updated dependencies [d1442e3]
- Updated dependencies [7c7400a]
  - @object-ui/types@5.2.0
  - @object-ui/core@5.2.0
  - @object-ui/plugin-grid@5.2.0
  - @object-ui/react@5.2.0
  - @object-ui/components@5.2.0
  - @object-ui/plugin-form@5.2.0

## 5.1.1

### Patch Changes

- Updated dependencies [8955b9c]
  - @object-ui/components@5.1.1
  - @object-ui/plugin-form@5.1.1
  - @object-ui/plugin-grid@5.1.1
  - @object-ui/types@5.1.1
  - @object-ui/core@5.1.1
  - @object-ui/react@5.1.1

## 5.1.0

### Patch Changes

- Updated dependencies [bd8447d]
- Updated dependencies [fbd5052]
- Updated dependencies [d51a577]
- Updated dependencies [d1ec6a2]
- Updated dependencies [cf30cc2]
- Updated dependencies [5b80cfd]
- Updated dependencies [c0b236f]
- Updated dependencies [d548d6b]
  - @object-ui/components@5.1.0
  - @object-ui/react@5.1.0
  - @object-ui/types@5.1.0
  - @object-ui/core@5.1.0
  - @object-ui/plugin-form@5.1.0
  - @object-ui/plugin-grid@5.1.0

## 5.0.2

### Patch Changes

- Updated dependencies [cab6a93]
- Updated dependencies [a311e22]
  - @object-ui/plugin-grid@5.0.2
  - @object-ui/plugin-form@5.0.2
  - @object-ui/components@5.0.2
  - @object-ui/react@5.0.2
  - @object-ui/types@5.0.2
  - @object-ui/core@5.0.2

## 5.0.1

### Patch Changes

- @object-ui/types@5.0.1
- @object-ui/core@5.0.1
- @object-ui/react@5.0.1
- @object-ui/components@5.0.1
- @object-ui/plugin-form@5.0.1
- @object-ui/plugin-grid@5.0.1

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
  - @object-ui/plugin-form@5.0.0
  - @object-ui/plugin-grid@5.0.0
  - @object-ui/core@5.0.0

## 4.8.0

### Patch Changes

- @object-ui/types@4.8.0
- @object-ui/core@4.8.0
- @object-ui/react@4.8.0
- @object-ui/components@4.8.0
- @object-ui/plugin-form@4.8.0
- @object-ui/plugin-grid@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0
- @object-ui/core@4.7.0
- @object-ui/react@4.7.0
- @object-ui/components@4.7.0
- @object-ui/plugin-form@4.7.0
- @object-ui/plugin-grid@4.7.0

## 4.6.0

### Patch Changes

- Updated dependencies [9aacced]
- Updated dependencies [9661d86]
- Updated dependencies [3ee436d]
  - @object-ui/plugin-grid@4.6.0
  - @object-ui/components@4.6.0
  - @object-ui/plugin-form@4.6.0
  - @object-ui/types@4.6.0
  - @object-ui/core@4.6.0
  - @object-ui/react@4.6.0

## 4.5.0

### Patch Changes

- Updated dependencies [6b6afd1]
- Updated dependencies [ab5e281]
- Updated dependencies [6b6afd1]
- Updated dependencies [aa7855f]
- Updated dependencies [170d89f]
  - @object-ui/plugin-form@4.5.0
  - @object-ui/types@4.5.0
  - @object-ui/components@4.5.0
  - @object-ui/core@4.5.0
  - @object-ui/plugin-grid@4.5.0
  - @object-ui/react@4.5.0

## 4.4.0

### Patch Changes

- Updated dependencies [2bd45af]
  - @object-ui/components@4.4.0
  - @object-ui/plugin-form@4.4.0
  - @object-ui/plugin-grid@4.4.0
  - @object-ui/types@4.4.0
  - @object-ui/core@4.4.0
  - @object-ui/react@4.4.0

## 4.3.1

### Patch Changes

- Updated dependencies [6b683c8]
  - @object-ui/components@4.3.1
  - @object-ui/react@4.3.1
  - @object-ui/plugin-form@4.3.1
  - @object-ui/plugin-grid@4.3.1
  - @object-ui/types@4.3.1
  - @object-ui/core@4.3.1

## 4.3.0

### Patch Changes

- Updated dependencies [4e7bc1b]
- Updated dependencies [8442c05]
  - @object-ui/components@4.3.0
  - @object-ui/react@4.3.0
  - @object-ui/plugin-form@4.3.0
  - @object-ui/plugin-grid@4.3.0
  - @object-ui/types@4.3.0
  - @object-ui/core@4.3.0

## 4.2.1

### Patch Changes

- @object-ui/types@4.2.1
- @object-ui/core@4.2.1
- @object-ui/react@4.2.1
- @object-ui/components@4.2.1
- @object-ui/plugin-form@4.2.1
- @object-ui/plugin-grid@4.2.1

## 4.2.0

### Patch Changes

- @object-ui/components@4.2.0
- @object-ui/react@4.2.0
- @object-ui/plugin-form@4.2.0
- @object-ui/plugin-grid@4.2.0
- @object-ui/types@4.2.0
- @object-ui/core@4.2.0

## 4.1.0

### Patch Changes

- @object-ui/types@4.1.0
- @object-ui/core@4.1.0
- @object-ui/react@4.1.0
- @object-ui/components@4.1.0
- @object-ui/plugin-form@4.1.0
- @object-ui/plugin-grid@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12
- @object-ui/core@4.0.12
- @object-ui/react@4.0.12
- @object-ui/components@4.0.12
- @object-ui/plugin-form@4.0.12
- @object-ui/plugin-grid@4.0.12

## 4.0.11

### Patch Changes

- @object-ui/components@4.0.11
- @object-ui/react@4.0.11
- @object-ui/plugin-form@4.0.11
- @object-ui/plugin-grid@4.0.11
- @object-ui/types@4.0.11
- @object-ui/core@4.0.11

## 4.0.10

### Patch Changes

- @object-ui/types@4.0.10
- @object-ui/core@4.0.10
- @object-ui/react@4.0.10
- @object-ui/components@4.0.10
- @object-ui/plugin-form@4.0.10
- @object-ui/plugin-grid@4.0.10

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9
- @object-ui/core@4.0.9
- @object-ui/react@4.0.9
- @object-ui/components@4.0.9
- @object-ui/plugin-form@4.0.9
- @object-ui/plugin-grid@4.0.9

## 4.0.8

### Patch Changes

- @object-ui/components@4.0.8
- @object-ui/react@4.0.8
- @object-ui/plugin-form@4.0.8
- @object-ui/plugin-grid@4.0.8
- @object-ui/types@4.0.8
- @object-ui/core@4.0.8

## 4.0.7

### Patch Changes

- Updated dependencies [7c9b85c]
- Updated dependencies [fd15918]
  - @object-ui/core@4.0.7
  - @object-ui/react@4.0.7
  - @object-ui/components@4.0.7
  - @object-ui/plugin-grid@4.0.7
  - @object-ui/plugin-form@4.0.7
  - @object-ui/types@4.0.7

## 4.0.6

### Patch Changes

- Updated dependencies [89ae109]
- Updated dependencies [925051d]
- Updated dependencies [1b6dc64]
  - @object-ui/plugin-grid@4.0.6
  - @object-ui/plugin-form@4.0.6
  - @object-ui/components@4.0.6
  - @object-ui/types@4.0.6
  - @object-ui/core@4.0.6
  - @object-ui/react@4.0.6

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
  - @object-ui/plugin-form@4.0.5
  - @object-ui/plugin-grid@4.0.5
  - @object-ui/types@4.0.5
  - @object-ui/core@4.0.5
  - @object-ui/react@4.0.5

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
  - @object-ui/plugin-form@4.0.4
  - @object-ui/plugin-grid@4.0.4
  - @object-ui/types@4.0.4
  - @object-ui/core@4.0.4
  - @object-ui/react@4.0.4

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
  - @object-ui/plugin-form@4.0.3
  - @object-ui/plugin-grid@4.0.3

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1
- @object-ui/core@4.0.1
- @object-ui/react@4.0.1
- @object-ui/components@4.0.1
- @object-ui/plugin-form@4.0.1
- @object-ui/plugin-grid@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0
  - @object-ui/components@4.0.0
  - @object-ui/core@4.0.0
  - @object-ui/plugin-form@4.0.0
  - @object-ui/plugin-grid@4.0.0
  - @object-ui/react@4.0.0

## 3.4.0

### Patch Changes

- Updated dependencies [a2d7023]
- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
  - @object-ui/components@3.4.0
  - @object-ui/plugin-grid@3.4.0
  - @object-ui/types@3.4.0
  - @object-ui/plugin-form@3.4.0
  - @object-ui/core@3.4.0
  - @object-ui/react@3.4.0

## 3.3.2

### Patch Changes

- @object-ui/types@3.3.2
- @object-ui/core@3.3.2
- @object-ui/react@3.3.2
- @object-ui/components@3.3.2
- @object-ui/plugin-form@3.3.2
- @object-ui/plugin-grid@3.3.2

## 3.3.1

### Patch Changes

- Updated dependencies [b429568]
  - @object-ui/components@3.3.1
  - @object-ui/plugin-form@3.3.1
  - @object-ui/plugin-grid@3.3.1
  - @object-ui/types@3.3.1
  - @object-ui/core@3.3.1
  - @object-ui/react@3.3.1

## 3.3.0

### Patch Changes

- @object-ui/types@3.3.0
- @object-ui/core@3.3.0
- @object-ui/react@3.3.0
- @object-ui/components@3.3.0
- @object-ui/plugin-form@3.3.0
- @object-ui/plugin-grid@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0
- @object-ui/core@3.2.0
- @object-ui/react@3.2.0
- @object-ui/components@3.2.0
- @object-ui/plugin-form@3.2.0
- @object-ui/plugin-grid@3.2.0

## 3.1.5

### Patch Changes

- @object-ui/react@3.1.5
- @object-ui/components@3.1.5
- @object-ui/plugin-form@3.1.5
- @object-ui/plugin-grid@3.1.5
- @object-ui/types@3.1.5
- @object-ui/core@3.1.5

## 3.1.4

### Patch Changes

- @object-ui/types@3.1.4
- @object-ui/core@3.1.4
- @object-ui/react@3.1.4
- @object-ui/components@3.1.4
- @object-ui/plugin-form@3.1.4
- @object-ui/plugin-grid@3.1.4

## 3.1.3

### Patch Changes

- @object-ui/types@3.1.3
- @object-ui/core@3.1.3
- @object-ui/react@3.1.3
- @object-ui/components@3.1.3
- @object-ui/plugin-form@3.1.3
- @object-ui/plugin-grid@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2
- @object-ui/core@3.1.2
- @object-ui/react@3.1.2
- @object-ui/components@3.1.2
- @object-ui/plugin-form@3.1.2
- @object-ui/plugin-grid@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1
  - @object-ui/components@3.1.1
  - @object-ui/core@3.1.1
  - @object-ui/plugin-form@3.1.1
  - @object-ui/plugin-grid@3.1.1
  - @object-ui/react@3.1.1

## 3.0.3

### Patch Changes

- @object-ui/types@3.0.3
- @object-ui/core@3.0.3
- @object-ui/react@3.0.3
- @object-ui/components@3.0.3
- @object-ui/plugin-form@3.0.3
- @object-ui/plugin-grid@3.0.3

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2
- @object-ui/core@3.0.2
- @object-ui/react@3.0.2
- @object-ui/components@3.0.2
- @object-ui/plugin-form@3.0.2
- @object-ui/plugin-grid@3.0.2

## 3.0.1

### Patch Changes

- Updated dependencies [adf2cc0]
  - @object-ui/react@3.0.1
  - @object-ui/components@3.0.1
  - @object-ui/plugin-form@3.0.1
  - @object-ui/plugin-grid@3.0.1
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
  - @object-ui/plugin-form@3.0.0
  - @object-ui/plugin-grid@3.0.0

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

### Patch Changes

- Updated dependencies [b859617]
  - @object-ui/types@2.0.0
  - @object-ui/core@2.0.0
  - @object-ui/react@2.0.0
  - @object-ui/components@2.0.0
  - @object-ui/plugin-form@2.0.0
  - @object-ui/plugin-grid@2.0.0

## 0.3.1

### Patch Changes

- Maintenance release - Documentation and build improvements
- Updated dependencies
  - @object-ui/types@0.3.1
  - @object-ui/core@0.3.1
  - @object-ui/react@0.3.1
  - @object-ui/components@0.3.1
  - @object-ui/plugin-grid@0.3.1
  - @object-ui/plugin-form@0.3.1

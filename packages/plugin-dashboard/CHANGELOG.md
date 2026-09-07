# @object-ui/plugin-dashboard

## 17.7.0

### Minor Changes

- 64dae8e: Six user-visible fixes across the maker surface, the assistant rail and the
  dataset captions.
  
  **The maker's start chips now promise only what ADR-0112 v1 builds
  (cloud#1984).** Two of the five asked for automation the first version has no
  flows or actions for — the ticket chip said 「状态流转」, the inventory chip said
  「低库存预警」 — and the measured behaviour was not a refusal but a silent
  degrade: a status kanban and a low-stock view. The chip promised an alert and
  delivered a page. All five are reworded in all ten packs (and in the call-site
  `defaultValue` fallbacks, which are a second copy of the same strings) to ask
  for objects, fields, views, pages, dashboards and sample data, keeping each a
  real business scenario — the ticket chip now asks for a status field and a board
  grouped by it, the inventory chip for a view that filters below the reorder
  point. A note beside the keys says to revert when v2 re-adds flows.
  
  **Five newer AI tools get their step labels (objectui#7481).** A zh conversation
  read `✓ Get authoring rules 已完成` between 「读取元数据结构」 and 「列出对象」:
  `get_authoring_rules` (cloud#1837), plus `load_tools`, `open_record`,
  `test_flow` and `toggle_flow`, are registered by the cloud AI runtime but are
  newer than the pinned spec's tool registry, so they had no `chatbot.tool.*`
  entry in any pack and fell through to the English title-caser.
  
  **The assistant rail follows the thread when you send (objectui#7480).** The
  rail and the full-page maker are the same component; what differs is width. A
  reply that still ends on screen in the wide column runs two or three times
  taller in a ~360px rail, so `StickToBottom`'s lock is escaped by the time the
  user types and the new bubble, the tool steps and the streaming answer all land
  below the fold. Every send path now re-arms the lock — including the plan-card
  "Build it" and 确认修改 approvals, whose own code comments already named this
  miss. Message APPENDS deliberately do not, so a user reading back through the
  thread mid-answer is never yanked to the bottom.
  
  **Console toasts move off the assistant composer (objectui#7482).** 「客户更新
  成功」 sat on the ChatDock composer's send button and stayed there. One defect,
  two symptoms: `apps/console` pinned the toaster to `bottom-right` — an override
  that predates ADR-0057 P3a — so a toast both covered the button and, because
  sonner pauses a toast's dismiss timer while the pointer is inside the toaster
  region, never got to run its 4s timer with a pointer resting on the composer
  underneath. The override is gone; the console takes `ConsoleToaster`'s own
  documented top-right anchor, and the 4s success duration is now pinned.
  
  **Built-in aggregate captions follow the locale everywhere (objectui#7534).**
  objectui#7258 taught `buildChartSeries()` to resolve a server-minted default
  measure through the locale map, so a chart legend read `计数` while the table
  beneath it, the KPI caption, the pivot header and the dataset preview still
  printed the server's hard-coded English `Count`. `buildDatasetFieldHelpers()`
  takes the same optional `builtinAggregateLabels`, resolving through the one
  `resolveMeasureLabel` order, and the five call sites pass it. Omitting the
  argument reproduces the previous output byte for byte, and an author-declared
  measure still keeps its own label verbatim (objectui#4106).
  
  **The activity feed stops asking for an object the environment does not have
  (objectui#7476).** A tenant environment has no `sys_activity`, so every page
  load issued a request that 404'd. Everything downstream was already correct —
  the adapter memoizes the missing collection, its logger demotes the failure, the
  feed retires as an ANSWER and the panel renders its earned empty state — so what
  is left is the request itself, and `data-objectstack` states the rule for it:
  the cure for a doomed request is not issuing it. New `useObjectPresence` reads
  the object registry the shell loads for the nav anyway; only a registry that has
  ANSWERED and lists other objects without this one skips the read. Every
  uncertainty — no provider, empty registry, still loading, errored — reads as
  before, because a wrong skip would cost a real deployment its feed.
- 8a6ecac: Retire `FieldMeta.referenceTo` and withdraw the README line documenting it as an
  author-facing column override (objectui#6597, enforce-or-remove — withdraw branch).
  
  **The measurement.** The README documented `referenceTo` as an author override you could
  pass on a `object-data-table` column to "bypass auto-detection" of a lookup's related
  object. Two `keyof FieldMeta` populations exist, kept separate per the card's own trap
  warning: `DatasetRelationship.referenceTo` (a resolver's *output*, unrelated) and this
  package's `FieldMeta.referenceTo` (the card's actual subject). For the latter, neither the
  schema-derived value nor an authored column override ever reached a reader:
  `LookupCellRenderer` (`@object-ui/fields`) resolves its lookup target from
  `field.reference_to` / `field.reference` — never `field.referenceTo` — and
  `computeLookupExpand` builds `$expand` from the OBJECT SCHEMA's field types, never from an
  authored column key. Re-measured on this branch's base (`881d5c292`) with the
  `referenceTo`-vs-`options` positive control already in
  `ObjectDataTable.overrideSource-6425.test.tsx`: `options` (a live override) separates two
  equal-valued columns; `referenceTo` does not — an authored override renders
  byte-identical to its absence.
  
  **No authoring story survived the search either.** `ObjectGrid`'s own relational-meta
  pass-through (`applyRelationalMeta`, `plugin-grid/src/ObjectGrid.tsx`) copies
  `reference_to` / `reference` / `display_field` / etc. from the SCHEMA field def only, at
  all three of its call sites — never from an authored column override. No doc, example, or
  fixture in this repo shows a table column pinning a lookup's target away from what its
  schema field already says. Under the maintainer's standing startup-stage rule
  (2026-08-27: deprecated/alias spellings retire immediately, no transition windows), no
  measured demand selects withdraw.
  
  **Both `keyof FieldMeta` seam bands, both in scope.** `ObjectDataTable` derives two
  refusal bands from `keyof FieldMeta` — `EnrichedColumn`'s write-side tombstones
  (objectui#6373) and `AuthoredColumnOverrides`' read-side band (objectui#6425) — so
  deleting the member would have dropped `referenceTo` from both as a side effect, silently
  un-enforcing objectui#6425's "not declared as spelled, still HELD" verdict. A new
  hand-written `ObjectDataTableRetiredReferenceToTombstone` (`{ referenceTo?: never }`) is
  intersected into both halves of the seam, the exact sibling of
  `ObjectDataTableRetiredDecimalsTombstone` (objectui#6625) — same mechanism, same reason.
  `ObjectDataTableColumnHolds` — the interface that carried the HELD verdict — is now empty
  (kept, not deleted, as the documented extension point a future ruling holds a new key
  onto).
  
  **Ablation.** Removing the tombstone intersection (replacing it with the old
  `{ referenceTo?: unknown }` HELD shape) turns two `@ts-expect-error` directives unused
  (TS2578) — `tsc -p tsconfig.test.json` exits 2. Restoring the intersection returns a clean
  exit 0. This proves the tombstone, not the derived band or a lingering hold, is what
  refuses the key now.
  
  **Behaviour is unchanged** — pinned by the unchanged `referenceTo reaches NOTHING on this
  path` runtime assertion, and by two new counter-control tests (mirroring the ones
  objectui#6625 added for `decimals`) proving the tombstone specifically is what refuses the
  key at both seam bands.
  
  Marked `minor` per this repo's version-alignment rule (AGENTS.md 版本号策略), which
  reserves `major` for following `@objectstack` across a major. Scope note, measured rather
  than assumed: `FieldMeta`, `AuthoredColumnOverrides`, `EnrichedColumn` and
  `ObjectDataTableColumnHolds` are absent from `dist/index.d.ts` — `plugin-dashboard`'s
  barrel re-exports only the `ObjectDataTable` component, and the package's `exports` map
  publishes only `"."`. No downstream type moves; this is a package-internal contract change
  plus a README correction, not a removal from a published type surface.
- 891a188: Retire `FieldMeta.decimals` and the now-unfed `BuildFieldMetaParams.overrides.decimals`
  from `plugin-dashboard`'s shared field-rendering helpers (objectui#6625,
  enforce-or-remove).
  
  `buildFieldMeta` computed `decimals: overrides.decimals ?? meta?.decimals ?? meta?.scale`
  on **every** call and the value **reached nothing**. Re-measured on this branch's base
  (`efdc6c62`): **zero `.decimals` member reads** across `@object-ui/fields`,
  `@object-ui/i18n`, `@object-ui/components`, `@object-ui/core` and `plugin-dashboard`
  itself — the only non-comment occurrence was the write being removed here. The
  **positive control in the same query shape** fires: `.scale` member reads hit
  `NumberField.tsx`, `GridField.tsx` and `fields/src/index.tsx`. So the zero is a
  finding, not a broken query. The `overrides.decimals ??` head of that chain had already
  lost its only feeder when objectui#6425's ruling removed the authored read from
  `ObjectDataTable.enrich()`; `RecordDetailDrawer`, the only other `buildFieldMeta`
  caller, passes no overrides at all. Both halves retire together, so the key leaves in
  one move.
  
  Behaviour is unchanged — no reader existed to notice, pinned by the unchanged runtime
  assertion in `ObjectDataTable.overrideSource-6425.test.tsx` that an authored `decimals`
  renders byte-identical to its absence.
  
  **The refusal did NOT leave with the member.** `ObjectDataTable` derives *two* refusal
  bands from `keyof FieldMeta` — `EnrichedColumn`'s write-side tombstones (objectui#6373)
  and `AuthoredColumnOverrides`' read-side band (objectui#6425) — so deleting the member
  would have dropped `decimals` from both as a side effect, silently un-enforcing
  objectui#6425's retire. A new hand-written `ObjectDataTableRetiredDecimalsTombstone`
  (`{ decimals?: never }`) is intersected into both halves of the seam, the same shape and
  for the same reason as `ObjectGrid`'s `ObjectGridRetiredOptionsTombstone`. The verdict
  is unchanged since 2026-08-27; only the artefact enforcing it moved, from derived to
  hand-written.
  
  Marked `minor` per this repo's version-alignment rule (AGENTS.md 版本号策略), which
  reserves `major` for following `@objectstack` across a major. Scope note, measured rather
  than assumed: `FieldMeta`, `BuildFieldMetaParams`, `AuthoredColumnOverrides` and
  `EnrichedColumn` are **absent from `dist/index.d.ts`** — they are not re-exported by the
  package barrel, and the `exports` map publishes only `"."`, so no consumer can name them.
  No downstream type moves; this is a package-internal contract change.
- 220c18d: Dashboard/analytics widgets get a self-explaining DEFAULT empty state, stated
  once for the surface (objectui#7063).
  
  Maintainer ruling 2026-08-31 (hotcrm#1212, following hotcrm#1203): a widget that
  renders a bare row-placeholder on an empty result is the PLATFORM's defect and
  must be fixed uniformly — apps must not compensate widget by widget
  (objectstack#13848). The measured scenario is a fresh flagship-demo install:
  eleven populated tiles and one reading exactly `暂无数据行` mid-page, which reads
  as "the dashboard failed to load" even though the widget, its declaration and
  its (not yet produced) data are all legitimate.
  
  - New `WidgetEmptyState` is the seam the three dashboard surfaces now share.
    There was no shared placeholder to fix: `DatasetWidget` wrote
    `dashboard.noRows`, while `ObjectDataTable` and `PivotTable` wrote
    `dashboard.noDataAvailable` — three renders, two strings, no common code.
  - The default now reads as a STATE, not a failure: `role="status"` (the empty
    branches previously carried no role at all, while the failure branches beside
    them are `role="alert"`), muted treatment with an inbox glyph rather than a
    warning triangle, and a title plus an explanation where the placeholder was a
    single terse fragment.
  - It names WHAT is empty with zero authored copy — the widget's data source,
    which is the half the reader cannot already see (the tile's title is rendered
    by the card header directly above). That is `widget.dataset` on the dataset
    path and `schema.objectName` on the object-bound table/pivot; `PivotTable`
    takes it as a new optional `sourceLabel` prop, which `ObjectPivotTable`
    forwards.
  - Copy is platform i18n: `dashboard.empty.title` / `.message` / `.sourceLabel`
    added to `en` and all nine sibling packs. No inline `defaultValue` and no
    interpolation — the source renders as a labelled value, so no separator is
    concatenated in code and every pack spells its own punctuation.
  
  No new authoring obligation and no new spec key. Note that the `emptyState`
  override the card assumes for this surface does not exist: `emptyState` is a
  LIST-view contract, and `@objectstack/spec`'s `DashboardWidgetSchema` declares no
  such key — so there is nothing here for an author to override, and adding one
  would be a contract question rather than a rider.
- 0dc2c93: `compareTo` on a `scatter` chart is no longer supported — scatter joins pie / donut /
  funnel on the list of chart families that ignore it (objectui#7402, maintainer ruling
  2026-09-03).
  
  **This removes a published capability, deliberately.** Until now a `chartType: 'scatter'`
  chart (and the dashboard widget types `scatter` and `bubble`, which both render as one)
  with `compareTo` set synthesised a muted "previous period" overlay series. It drew the
  wrong picture: a scatter binds ONE measure, and the renderer reads y through the single
  `YAxis dataKey={series[0].dataKey}`, so the overlay was plotted on the PRIMARY series' y
  — "previous period" painted exactly on top of "current" (objectui#7194).
  
  Enforce-or-remove: rather than keep drawing that, the capability is removed until it can
  be drawn honestly. Drawing a real second measure on a scatter needs the multi-measure
  projection recorded as option A of objectui#7194, which is not built (zero authored
  callers). **If and when that projection lands, `compareTo` on a scatter returns with
  it** — it is the same missing mechanism, one payment.
  
  What changes for authors:
  
  - A `compareTo` on a scatter is now IGNORED rather than drawn. The primary series still
    renders exactly as before — nothing refuses, nothing goes blank, and no comparison
    query is issued on the inline chart path.
  - No `<measure>__comparison` (inline chart) / `<measure>__compare` (dashboard) series is
    appended for a scatter, so a compare-to scatter document also never reaches the
    two-or-more-series scatter refusal being added under objectui#7194.
  - Charts that keep the overlay: line, area, bar, horizontal-bar, combo. Charts that
    ignore `compareTo`: pie, donut, funnel and — as of this change — scatter (and the
    `bubble` widget type that renders as a scatter).
  
  Reachability at the time of the change: **0** authored scatter/bubble instances in-repo
  across both spellings (control `"type": "bar"` fires at 5 example files); incidence in
  deployed tenant metadata is not measurable from this repo.
- 1cca678: Retire the dashboard-**root** `title` read across all five surfaces (objectui#7509,
  maintainer ruling 2026-09-04, decision batch #29, option C, under ADR-0049).
  
  **What changes for an operator.** A stored dashboard whose header came from a legacy
  root `title` now shows its `label`. `label` is the only header source, then the raw
  `name`.
  
  Per surface:
  
  - Console dashboard page (`DashboardView`) — header falls to `label`, then `name`.
  - Standalone dashboard embed (`DashboardRenderer`) — `header` shows `label`; a document
    with no `label` now shows no header title at all.
  - The `dashboard-grid` SDUI component (`DashboardGridLayout`) — heading falls to
    `label`, then the generic `Dashboard`.
  - Studio dashboard designer (`DashboardEditor` preview panel, `DashboardDesignPage`
    heading) — both fall to `label`, then `name` / the generic heading.
  
  **Why now.** `@objectstack/spec`'s `DashboardSchema` refuses a root `title` **by name**
  (`unrecognized_keys(title)`), and the save route answers `422 INVALID_METADATA` — so no
  authored dashboard can acquire the key, and what retires is compatibility with documents
  stored before that refusal existed. Until now five surfaces read the legacy spelling
  independently, which meant a legacy document could show one header in the console and a
  different one in the designer. One spelling now answers everywhere.
  
  **Migration.** `label` is REQUIRED on `DashboardSchema`, so a spec-valid stored dashboard
  already carries it and needs no change — it simply starts showing that `label` instead of
  the legacy `title`. A document carrying `title` and no `label` was already invalid; give
  it a `label`. No in-repo document needed migrating: a sweep of all 627 tracked JSON found
  9 dashboard-shaped nodes, and the 6 carrying a root `title` are `type: 'dashboard'`
  component examples that declare no `header`, so none of them rendered a header title
  either before or after.
  
  **Not affected: widget titles.** `DashboardWidget.title` is a different, spec-**declared**
  key (the spec's `I18nLabel`) on a different receiver, and is untouched — widget headings,
  the designer's widget-title input and its per-locale write path all behave exactly as
  before. Root and widget arms were separated by receiver, and the retirement's pins carry
  widget-level controls on every surface for that reason.
- 0ea7054: Remove 37 runtime dependencies that no file in the declaring package consumes, and gate
  the direction so the next one cannot land (objectui#8198).
  
  `check:phantom-deps` judges imports that are not declared; nothing judged the reverse,
  so a declaration could outlive its last consumer indefinitely. That is what happened to
  `recharts` in `@object-ui/components` after objectui#7397 deleted its only importer — it
  was removed by hand on objectui#7625, and nothing would have reported the next one. The
  new `pnpm check:unused-deps` asks the reverse question over `dependencies` and
  `optionalDependencies` of every released package.
  
  **Potentially breaking, for consumers relying on hoisting.** Nothing these packages ship
  changes: their Vite `external` predicates are path-based and never read `dependencies`,
  so no built artifact moves. What changes is the install graph — a project that imports
  one of the removed packages while depending only on the ObjectUI package that used to
  drag it in will no longer resolve it. Declare it directly; that is the correct
  dependency edge in either case. The removals, by package:
  
  - `@object-ui/plugin-designer`: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@object-ui/fields`
  - `@object-ui/plugin-chatbot`: `react-markdown`, `react-syntax-highlighter`, `remark-gfm` (and the orphaned `@types/react-syntax-highlighter`)
  - `@object-ui/plugin-report`: `@object-ui/plugin-grid`, `clsx`, `react-i18next`, `tailwind-merge`
  - `@object-ui/plugin-map`: `@objectstack/spec`, `lucide-react`, `zod`
  - `@object-ui/runner`: `class-variance-authority`, `clsx`, `tailwind-merge`
  - `@object-ui/core`: `lodash`, `zod`
  - `@object-ui/layout`: `clsx`, `tailwind-merge`, and `react-dom` — which it pinned at an exact version in `dependencies` while also declaring it as a peer range, i.e. a library hard-depending on the renderer it asks its host to supply
  - `@object-ui/plugin-dashboard`: `clsx`, `tailwind-merge`, and the same `react-dom` defect
  - `@object-ui/plugin-ai`: `@object-ui/react`, `clsx`, `tailwind-merge`
  - `@object-ui/fields`: `clsx`, `tailwind-merge`
  - `@object-ui/console`: `@object-ui/react-runtime`, `sucrase`
  - `@object-ui/auth`: `@object-ui/types`
  - `@object-ui/plugin-calendar`: `@object-ui/fields`
  - `@object-ui/plugin-editor`, `@object-ui/plugin-markdown`: `@object-ui/react`
  - `@object-ui/react`: `react-hook-form`
  
  Every one was verified by a whole-package grep before removal — the name appeared nowhere
  under the package but its own manifest and CHANGELOG — and the whole workspace builds,
  type-checks and tests green afterwards.
- 2e471a6: `dashboard` now publishes the authoring inputs its renderer already honours — `widgets`, `label`, `description`, `header`, `globalFilters`, `dateRange`, `refreshInterval` — so `validateTree`, the generated `sdui.manifest.json` and `sdui-intrinsics.d.ts` stop warning authors off keys that work (previously only `columns`/`gap`/`className` were published, and every other honoured key drew `unknown-prop`). Each declared key is accepted by the spec's strict `DashboardSchema`, so the manifest never offers a key the save gate refuses. The legacy `title` spelling and the retired `aria` key stay deliberately unpublished and are pinned as such; the `schema.title || schema.label` fallback read is unchanged, so documents in the wild keep rendering their header title.
- 1d9100e: Dashboard `table` widget — a numeric **measure** column now sorts **descending
  on the first click** (objectui#5845).
  
  The sortable headers shipped in objectui#5827 started every column ascending,
  which left the card's own motivating complaint — the largest industry rendering
  last — two clicks away. For a measure in an analytics widget the question a
  click asks is "who is biggest", so that column now cycles
  **descending → ascending → the dataset's own order**.
  
  Unchanged: a **dimension** column, and a measure whose values are not numbers
  (a `min()`/`max()` over a text field), keep **ascending → descending → the
  dataset's own order** — the idiom the console's own DataTable uses. The
  first-click direction is decided by the same measure-and-all-values-are-numbers
  classification that decides right-alignment, so it follows the column's *role*
  rather than "it looks like digits": a digit-keyed dimension (a year, a quarter)
  still starts ascending.
  
  Blanks still sort **last in both directions** — that arm is now what a measure
  column's very first click runs — and `aria-sort` reports the direction actually
  applied.
- 62c0fa1: Dashboard `table` widget (dataset-backed, flat grouped table) — four rendering
  fixes so it reads as a table rather than a raw dump (objectui#5827):
  
  - **Numeric columns right-align**, header and cells. `tabular-nums` was already
    applied to every cell and could not do its job while the digits were flushed
    left. A column qualifies when it is a MEASURE and every non-null value in it
    is a number — the declared column `type` cannot decide it, because the
    analytics executor stamps `type: 'number'` on every measure regardless of the
    aggregate, so a `min()`/`max()` over a text field would have been
    right-aligned on the strength of a label. Dimensions stay left-aligned even
    when their bucket keys are digits: a grouping axis is not a quantity.
  - **Sortable headers.** Each header is a keyboard-reachable button that cycles
    ascending → descending → back to the dataset's own order, with the console's
    existing sort indicator and `aria-sort` on the `th`. Blanks sort last in
    BOTH directions. The sort is client-side over the rows already fetched — the
    widget issues one `queryDataset` call and paginates nothing, so no round trip
    is involved.
  - **The empty-dimension bucket sorts last** in the default order instead of
    floating to the top. It keeps its `—` label; only its position moves.
  - **Row hover feedback on every row**, not only on a drillable one. A drillable
    row keeps its stronger accent fill.
  
  The CSV export now follows the order the table is showing, which is the same
  "the CSV is the table's data" convention its cell text already followed.
  Drill-through is unaffected: rows are reordered as `(row, incoming index)`
  pairs, so a drill still resolves through the server's parallel raw-value
  sidecar.
  
  Unchanged: the cross-tab (a `pivot` with ≥2 dimensions) renderer, the KPI and
  chart paths, and every non-dataset table in the console.
- e719ebd: `data-table` reads the declared `header`; the producers translate `label` into it.
  
  `TableColumn` declares `header: string` and does not declare `label`. The
  renderer's column normalization nonetheless read `header: col.header || col.label`,
  so the same key had one spelling the type admits and one only the runtime did.
  That alias is gone (objectui#5351), and the translation it used to perform happens
  once at each producer instead: metadata vocabulary in, adapter vocabulary out.
  
  **This narrows what `data-table` accepts, so read this if you author `data-table`
  nodes by hand.** A column spelled `{ label: 'Stage', accessorKey: 'stage' }` on a
  directly authored `data-table` now renders a **headerless** column over live
  cells. Spell it `header` — the key `TableColumn` has always declared. Columns
  reaching `data-table` through `object-data-table`, `object-grid` or a related
  list are unaffected: those producers resolve `header` for you from the spec's
  `ListColumnSchema.label`, so every spelling they accepted before they still
  accept.
  
  `@object-ui/core` gains `columnHeader()` alongside `columnIdentity()` — the reader
  producers use to cross that boundary. It is adapter-first (`header` wins over
  `label`), so an author who addressed the table directly is never overwritten.
  
  `object-data-table` also gains a fix from the same move: a column carrying a
  `label` used to render a **blank** header there even while the alias existed,
  because the widget's field-meta enrichment overwrote the authored `label` before
  the adapter ever saw it. `{ field: 'stage', label: 'Stage' }` now renders "Stage".
  
  The sibling `accessorKey: col.accessorKey || col.name` alias is **unchanged** here
  and still resolves. Retiring it is objectui#5120's remaining step, which is
  gated on two published skill guides that teach that spelling.
- 9e725e0: Dashboard flat `table` widget: render the server's grand total as a `tfoot` row (objectui#5846).
  
  The flat branch now requests the `[]` marginal grouping — the same server-side
  totals machinery the cross-tab has used since framework#1753 — and renders the
  answer under the console's existing `dashboard.total` label. Totals are computed
  by the server with each measure's TRUE aggregate (a `sum` sums, an `avg`/`min`/
  `max` reports the whole-set aggregate); nothing is recombined client-side. The
  row lives in `tfoot`, so it is exempt from sorting, renders below the `—` null
  bucket, and never joins the drillable rows.
  
  No footer is rendered when the executor answers no `[]` grouping, and none is
  requested for a table truncated by `options.limit`, whose visible rows a
  whole-set total could not be reconciled against.

### Patch Changes

- baac3f4: Fix four `find()` calls that passed a query option without its `$`, and gate the shape.
  
  `QueryParams` declares every query option `$`-prefixed and `convertQueryParams` copies
  exactly those keys, so an unprefixed spelling reaches no branch and is dropped — no throw,
  no warning, and it type-checks because the type carries `[key: string]: any` for
  adapter-specific params. For a dropped cap the result is an **unbounded** read rather than
  a truncated one: the platform's GET list route has no default page size, so the query
  returns the whole match set and stays invisible until the object is large.
  
  - `app-shell` `ObjectView` fetched the footer's record count with `{ limit: 0 }`. This one
    **inverted** rather than widened — `$top: 0` is honoured end to end as "no records", so
    the dropped key turned "count only, fetch nothing" into "fetch every row in the object",
    on every mount and every refresh of every list view. It now sends `$top: 0` and reads
    the count off `total` only; the row-counting fallbacks are gone rather than repointed,
    because once zero rows are requested an empty `data` means "you asked for none", not
    "the object is empty", and counting it would assert a confident `0`. With no total the
    footer line is omitted instead.
  - `app-shell` `AssignedUsersSection` looked a permission set up with `{ …, limit: 1 }`,
    one line from three correct `$top` calls.
  - `plugin-dashboard` `DashboardFilterBar` passed `fields` **and** `top` in one literal, so
    a filter's option list read every row and every column of its source object while its
    own comment described it as capped at 200. The same call read `records.items`, which is
    not a `QueryResult` member, so against a real adapter the fallback produced no options
    at all.
  - `console` `sdui-workbench-preview` passed `{ top: 200 }` and read `.records` off the
    result in its page-source metadata.
  
  A new `object-ui/no-unprefixed-query-params` ESLint rule rejects the shape at write time:
  a known query-option name missing its `$` in the second argument of a `find`/`findOne`
  call. It is narrow on purpose — a closed list of spellings, anchored to the call — because
  the index signature exists so adapters can take adapter-specific params, and a rule that
  flagged any unprefixed key would report the shape the type was written to allow. Its
  sibling `no-query-params-under-options` (the `{ options: { $top } }` half) is unchanged.
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
- fc62bb4: `TableColumn.type` now has ONE canonical value set across all three ends that disagreed
  (objectui#5853, maintainer ruling 2026-08-25, Option B: the 8-literal interface union is
  canonical). The interface declared `'text' | 'number' | 'date' | 'datetime' | 'currency' |
  'percent' | 'boolean' | 'action'`; the zod mirror declared `z.string()` and accepted
  anything; the renderer branched on a third set and could only read the key through an
  `as any` cast.
  
  ## ⚠️ Accept-set narrowing — these spellings stop validating
  
  `TableColumnSchema.type` was `z.string().optional()`. **Any string parsed green.** It is now
  `z.enum(TABLE_COLUMN_TYPES).optional()`, so a value outside the eight is refused at parse
  time with `type` named in the error path. Spellings that validated before and are **refused
  now**, grouped by why they were being written:
  
  - **Typos and invented names** — `'money'`, `'datetime2'`, `'string'`, `'int'`, `'integer'`,
    `'float'`, `'double'`, `'datetime-local'`, and every other free-form string. `'money'` is
    the card's headline case: it validated, matched no renderer branch, and the column fell
    through to plain text rendering with nothing reported. That silent fall-through is the
    lenient-validation face that lets AI-authored metadata errors through, and it is now a
    loud parse failure.
  - **Object-schema field types written into a column slot** — `'select'`, `'lookup'`,
    `'user'`, `'file'`, `'formula'`, `'textarea'`, `'email'` and the other 35 members of
    `@objectstack/spec`'s `FieldType` that are not among the eight. These belong on the FIELD,
    not on the column: a column gets its dedicated widget from the field definition behind its
    `accessorKey`, never from `type`.
  
  **Authored metadata in this repo needs no migration.** Measured before tightening, across
  `examples/`, `content/`, `apps/`, `e2e/`, `docs/` and every package (591 JSON schema files
  plus the docs and playground sources): **zero** authored `TableColumn.type` values outside
  the eight, and zero occurrences of `int` / `integer` / `float` / `double` in a column
  position anywhere in the repository. If you author `type` on a table column, check it
  against the eight; if the value describes the FIELD rather than the column, remove it.
  
  ## The renderer's undeclared vocabulary disappears instead of being declared
  
  `int` / `integer` / `float` / `double` were members of the data-table's `NUMERIC_EDIT_TYPES`
  and `datetime-local` had its own editor branch, none of them declared. They arrived because
  column-inference producers forwarded an object schema's field type **verbatim** into
  `TableColumn.type`. Rather than publishing that dialect, producers now fold their inferred
  value onto the declared vocabulary at their emit seam via the new
  `normalizeTableColumnType()`: `int`/`integer`/`float`/`double` → `number`,
  `datetime-local` → `datetime`, and **anything else drops the `type` annotation — never the
  column**. Two producers do this, not the one the card named: `ObjectGrid` (`@object-ui/plugin-grid`)
  and `ObjectDataTable` (`@object-ui/plugin-dashboard`), whose `buildFieldMeta` spread wrote
  the raw field type into the same slot.
  
  Dropping the annotation is behaviour-preserving at the only consumer that reads the key.
  `data-table`'s inline editor branches on `date`, `datetime` and the numeric set and
  otherwise falls through to a text input — which is exactly the `undefined` path. The
  dedicated widget a `select` or `lookup` column gets comes from the host's `renderCellEditor`,
  which resolves the field through `column.accessorKey` and never reads `type`.
  
  ## New public API
  
  `@object-ui/types` exports `TABLE_COLUMN_TYPES` (the canonical tuple — the single
  declaration the zod mirror builds its enum from, so the two cannot drift), the
  `TableColumnType` union, and `normalizeTableColumnType()` for producers. The `as any` cast
  in `data-table.tsx` is deleted and the read is typed, so re-introducing an undeclared
  spelling is a tsc error rather than a silent widening.
  
  A value-level parity pin covers all three ends
  (`packages/types/src/__tests__/table-column-type-canonical.test.ts` and
  `packages/components/src/renderers/complex/__tests__/table-column-type-read-set.test.tsx`).
  objectui#5684's guard is key-set only and cannot see value drift — `type` was present on
  both sides the whole time — which is how this instance survived while its siblings were
  caught. A future inference value turning that pin red is by design; the note at the pin says
  so, and names the two correct repairs.
- a100f77: The dashboard package now holds ONE relation predicate instead of two that
  agreed only because a sweep had just aligned them (objectui#5876).
  
  `computeLookupExpand` in `ObjectDataTable.tsx` carried its own `isLookup`,
  byte-identical to the exported `isLookupType` in `recordFields.tsx` after
  objectui#5692 pointed both at `@object-ui/core`'s `EXPANDABLE_FIELD_TYPES`.
  Nothing kept them aligned: a future edit to either — a member added, the
  retirement gate moved — would have re-forked the `$expand` decision from the
  predicate whose docblock claims to drive it. `computeLookupExpand` now calls
  `isLookupType`, which gains its first production consumer, and the module no
  longer imports the shared family or the retirement gate at all.
  
  **No behaviour changes**, and that is measured rather than assumed:
  
  - The two bodies were identical, so every boolean answer — `tree` is expanded,
    `reference` is not, ordinary relations are — is the same before and after.
  - The retired-spelling warning is not emitted a different number of times.
    `reportRetiredFieldType` dedupes per SPELLING in one module-level set inside
    `@object-ui/core`, which both bodies already shared, so routing two callers
    through one function cannot change the count.
  
  Nothing published moves: `isLookupType` is not re-exported from
  `@object-ui/plugin-dashboard`'s entry, so this is internal shape only.
  
  Because a refactor with no observable delta cannot be pinned by a behavioural
  test — a byte-identical local copy satisfies every assertion you can write
  about `$expand` — the pin is identity, in
  `__tests__/expandableFamily.identity-5692.test.ts`: `computeLookupExpand` is
  observed CALLING `isLookupType`, and `ObjectDataTable.tsx` is read at source
  level to confirm no second body survives for it to call instead.
- 99a3c2d: `BaseSchema` declares `bind`, the data-scope binding path, on both halves — the TypeScript
  interface and its Zod mirror (objectui#6357).
  
  `bind` was read by ten production sites and declared by no schema shape. It resolved as `any`
  through `BaseSchema`'s index signature and rode `.passthrough()` on the validator, while three
  separate documents taught it as an authorable key of *every* node: this repo's own `AGENTS.md`
  §4 ("Every node in the UI tree follows this shape (`@object-ui/types`)"), the published
  agent-facing `skills/objectui/rules/protocol.md` ("Every UI component node MUST follow this
  shape"), and `content/docs/fields/grid.mdx`. So the agent-facing protocol told authors to write
  a key the published types did not know existed.
  
  The census chose the home rather than guessing it. Nine reads go through
  `useDataScope(schema.bind)` — `list` and `tree-view` in `@object-ui/components`, and the
  `object-*` widgets in `plugin-charts`, `plugin-dashboard` (×2), `plugin-grid`, `plugin-kanban`,
  `plugin-list`, `plugin-timeline`. A tenth is `plugin-grid`'s `gridNeedsDataSource` predicate,
  where a present `bind` is one of the escape hatches that makes a missing data-source adapter
  legitimate. Two more sites destructure the key out so `SchemaRenderer`'s prop spread cannot
  write `bind="data.revenue"` onto the DOM. Per-component declaration was measured and rejected:
  it costs nine copies of one key and buys nothing extra, because neither half can refuse the key
  on a non-reader either way. `placeholder` is the standing precedent for a cross-cutting key
  declared on `BaseSchema` and honoured only by a subset.
  
  **Accept-set narrowing, on the value and not the key.** `bind: 42` type-checked and parsed green
  before this change and is refused by both halves now. It only refuses what already crashed:
  `useDataScope` is `(path?: string)` and resolves via `path.split('.')`, so a non-string `bind`
  threw a `TypeError` at render time. Every `bind` authored in this repo is a string, and the
  declaration is optional, so nothing that renders today stops.
  
  **What this does NOT change**, stated because the pin would otherwise be read as more than it is:
  an *undeclared* key is still accepted by both halves, so this did not buy rejection of a
  misspelling such as `bindTo` (objectui#5155 / objectui#6269 own that ceiling). And `data-table`
  still does not call `useDataScope`, so a `bind` on it is still ignored and still renders a header
  over an empty body with no error — a documented silent failure that this declaration neither
  causes nor cures, since the key was accepted on every node before it existed.
  
  `ObjectPivotTable` drops its local `bind?: string`: its `PivotTableSchema & {…}` intersection
  extends `BaseSchema`, so the member was a true duplicate. Two other local declarations are left
  in place and ratcheted rather than removed — their containing types never reference `BaseSchema`,
  so deleting the member would delete the declaration rather than inherit it.
- 129c7a9: `ObjectDataTable` no longer writes six undeclared keys into the `data-table` columns slot
  (objectui#6373). `enrich()` returned `NormalizedColumn`, whose `[key: string]: any` accepts
  anything, so nothing checked the producer's output against
  `DataTableSchema.columns: TableColumn[]`: `{ ...col, ...fieldMeta }` spread `label`,
  `options`, `referenceTo`, `format`, `currency` and `decimals` onto every emitted column, and
  `TableColumn` declares none of them.
  
  The measured read set of the consumer (`data-table.tsx`, comments stripped) contains none of
  the six, so all six retire from the emit rather than being declared — declaring a key nothing
  reads is the same `declared != enforced` defect facing the other way. Rendering is unchanged
  because none of those keys was the live path for its own value: the `FieldMeta` the `cell`
  closure captures is what this widget's type-aware rendering has always read, and it is
  untouched. Authored spellings still pass through, so a column the author wrote as
  `{ format: '$0,0' }` keeps its `format` exactly as before.
  
  `type` is unchanged — objectui#5853's fold at this seam still applies. `name` is unchanged
  and still written: `data-table` reads `col.accessorKey || col.name` and objectui#5120 holds
  that alias while two published skill guides still teach a `{ name, label }` column. The hold
  is now declared at the seam instead of arriving anonymously inside a spread.
  
  The seam's emit type carries ADR-0049 `?: never` tombstones for the retired keys rather than
  being a bare `TableColumn` annotation. Measured before the shape was chosen: a bare annotation
  raises no error at all here, because TypeScript's excess-property check exempts properties
  that arrive through a spread — it would have type-checked the boundary without enforcing it.
- 38a123c: Land objectui#6425's per-key ruling for `ObjectDataTable`'s authored column
  override keys (maintainer, 2026-08-27):
  
  - **Declare `format`, `options`, `currency`** on `TableColumn` and its
    `TableColumnSchema` zod mirror, in the same stroke. All three are honoured
    by `object-data-table`'s cell pipeline — `format` / `options` were
    documented author overrides the published types refused (a typed author got
    a compile error and the zod parse silently stripped the key); `currency`
    shipped in production but was never promised. The zod mirror now passes the
    keys through instead of stripping them; `StaticTableColumn` and its mirror
    tombstone all three under the #5474 lockstep rule (the static renderer
    reads no field-meta overrides).
  - **Retire `decimals`**, immediately: zero readers measured anywhere
    (`NumberCellRenderer` reads `scale`, `PercentCellRenderer` reads
    `precision`), so no authored `decimals` could reach a render. The authored
    read is removed and the key falls into `AuthoredColumnOverrides`' derived
    refusal band — render output is pinned unchanged.
  - **Re-arm plugin-grid's #6004 `options` retirement with an explicit
    tombstone**: that refusal rested on the key's NON-membership (excess-property
    freshness), which declaring `options` on `TableColumn` silently ended.
    `ObjectGridRetiredOptionsTombstone` (`?: never`, intersected into both
    `ObjectGridColumnDraft` and `ObjectGridColumn`) restores the refusal by
    assignability; #6004's verdict itself is unchanged.
  - **`referenceTo` is deliberately NOT declared as spelled** — it stays held,
    owned by objectui#6597 (fix the spelling chain or withdraw the README
    line). The remaining hold is that card's scope, not unfinished work here.
- aff3d7a: A `bind` authored on a `data-table` is now diagnosed at render instead of ignored in
  silence (objectui#6575).
  
  `bind` is the data-scope vocabulary: a path string resolved by `useDataScope()`.
  `list`, `tree-view` and the `object-*` plugin widgets read it. `data-table` does not
  — it takes its rows from an inline `data` array on the node and never calls the hook.
  A `bind` on a `data-table` was nevertheless accepted by every gate: the TS side via
  `BaseSchema`'s index signature, the zod side via `BaseSchema` being `.passthrough()`,
  which `DataTableSchema.extend(…)` inherits. Nothing read it at render, so the author
  got a table drawing a correct-looking header over the "No results found" empty state,
  with no error and no warning — a success receipt for a disagreement between the
  author and the renderer, and the hardest failure shape for a human or an AI author to
  self-check.
  
  The platform was already paying for this in teaching rather than in diagnostics:
  `skills/objectui/rules/protocol.md` documents the pothole verbatim and a pin test
  locks the behaviour. The warning now also reaches the console, where the author who
  did not read the docs is standing:
  
  > `bind: 'customers'` is ignored: data-table does not read `bind`; it reads its rows
  > from the inline `data` array on the node. This node has no inline rows, so the
  > table renders its header over an empty body.
  
  It names the node's address, the path that was spelled, and the way out. The
  consequence clause is measured rather than asserted: a node carrying BOTH `data` and
  `bind` is not empty, and is told that its rows came from `data` and its `bind`
  contributed nothing.
  
  **No behaviour change.** `data-table` still does not read `bind`, and per the
  2026-08-27 ruling it must not start — making it a `useDataScope` reader is a separate
  published-surface question needing its own ruling, including a `data`-vs-`bind`
  precedence. Refusing the key at parse stays blocked on the `.passthrough()` ceiling
  (objectui#5155 / objectui#6269). The trap stops being silent; it does not stop being
  a trap. The channel is the one `plugin-grid`'s `columnSpellingDiagnostics.ts` already
  uses for this exact shape of failure — a pure describe function, a `useEffect` keyed
  on the schema slice, one `console.warn`, no NODE_ENV branch.
  
  `ObjectDataTable` (`@object-ui/plugin-dashboard`) stops forwarding a `bind` it has
  already consumed. It resolves the binding itself via `useDataScope(schema.bind)` and
  then delegated with `{ ...schema, type: 'data-table', … }`, which handed the spent
  key to a component that cannot read one. Without this, a correctly authored and
  published-guide-taught `object-data-table` would have tripped the new diagnostic on
  every render, over rows that were on screen precisely because its `bind` had been
  honoured. The key is stopped where it was spent — the same shape its sibling
  `DashboardGridLayout` already uses for `data`. Nothing else about that delegation
  moved, and the bound rows still arrive.
- 4ca30d0: Two widget prop types anchor their `schema` to exported schema types that extend
  `BaseSchema`, instead of hand-rolled inline literals with no `BaseSchema` in
  their ancestry (objectui#6576, maintainer ruling 2026-08-31 option A; folds
  objectui#6914).
  
  - `@object-ui/types` exports `ObjectGallerySchema` (`type: 'object-gallery'`)
    and `ObjectDataTableSchema` (`type: 'object-data-table'`), each `extends
    BaseSchema`, beside the other `Object*Schema` declarations, with zod mirrors
    of the same names under `@object-ui/types/zod`. `ObjectDataTableSchema`
    declares the two keys the widget was reading behind casts — `drillDown`
    (`DrillDownConfig`) and `onRowClick` — which no declaration carried before.
  - `@object-ui/plugin-list`: the published `ObjectGalleryProps.schema` is
    `ObjectGallerySchema`. Its accept set WIDENS — every `BaseSchema` member is
    writable (`visibleWhen`, a real base member, was a compile error on the
    literal) — and NARROWS in one place: `type` is now required and pinned to
    `'object-gallery'`. `data` stays `Record<string, unknown>[]`.
  - `@object-ui/plugin-dashboard`: `ObjectDataTableProps.schema` (not exported
    from the plugin index) is `ObjectDataTableSchema`. The literal's own
    `[key: string]: any` is gone, so a wrong-typed base member (`visible: 42`) and
    a wrong-shaped `drillDown` are refused, and `type` is pinned to
    `'object-data-table'` instead of bare `string`.
  
  Unchanged on both, stated plainly: an UNKNOWN key still compiles, because
  `BaseSchema`'s index signature is inherited (objectui#5155, open). No runtime
  behaviour changes; the widgets render exactly as before.
- 3beef6d: The spec's `dataSource` element binding is now DECLARED by the blocks that read
  it, so the html tier stops reporting the one working saved-view spelling as
  `unknown-prop` (objectui#6678).
  
  `PageComponentSchema.dataSource` — `{ object, view, filter, sort, limit }` — is
  the one spelling that resolves a saved view for an object-bound block. It works,
  and it drew the identical `unknown-prop` warning as the two spellings that do
  nothing (`viewName`, `view`), because `validateTree` looks a prop up in the
  block's declared `inputs` and no registration declared this key. On the tier
  built to accept AI-authored pages, where the diagnostic IS the contract, the
  only signal pointed away from the key that works.
  
  Adopting the maintainer ruling of 2026-08-29 — option B **in the injection
  form**:
  
  - `ELEMENT_DATA_SOURCE_INPUT` is the single declaration, in `@object-ui/core`
    beside the binding's own semantics; `Registry.register` emits it for any
    registration whose renderer passed through the new `elementDataSourceBlock()`
    seam. One mechanism, one copy — not a hand-kept declaration per block, which is
    the shape that drifts and that a new block forgets. The seam lives in
    `@object-ui/core` and is re-exported by `@object-ui/react` beside
    `ElementDataSourceGate` for discoverability; call sites take the core import,
    because a registration runs at module scope and this repo's suites partially
    mock `@object-ui/react`.
  - Seventeen renderers, in thirteen files across twelve packages, reach the seam
    and now publish the key to the save gate, the parser whitelist, the generated
    JSX authoring types and the block list. The card named nine blocks; the tree
    also has `plugin-grid`, `plugin-timeline`, two further `plugin-form` blocks and
    `element:record_picker` — nothing was hand-listed, so the mechanism covered
    them. `element:record_picker` consumes the gate's HOOK and status panels rather
    than the wrapper tag (its object lives under `properties`), and was found by a
    render probe rather than by reading sources.
  - `dataSource` on a block that does NOT read it (`flex`, `card`) still reports
    `unknown-prop`. Adding the key to `sdui-parser`'s `BASE_PROPS` was refused for
    exactly this reason — that set mirrors `BaseSchema`, and silencing the key
    everywhere would make the diagnostic lie in the other direction.
  - New `check:element-data-source-declaration` fails any source that consumes the
    gate without reaching the seam, so a block added tomorrow cannot forget.
  
  Behaviour of the binding itself is unchanged — this is a declaration, not a
  resolution change. The saved view still resolves its columns, and an
  unresolvable `view` still fails loudly rather than widening to the object's full
  scope.
  
  The spec/registry parity gates (repo-wide and the `record:related_list` per-block
  pin) now derive their accepted set from the WHOLE node contract rather than from
  `ComponentPropsMap[type]` alone. `PageComponentSchema` accepts and keeps
  `dataSource` on a page-component node — it is a node-level key, a sibling of
  `type` and `className`, not a per-block prop — so the gates' previous complaint
  was measurably wrong. Derived from the spec, not exempted, and both still
  discriminate against an invented key.
- d636743: Feed the lookup cells in `ObjectDataTable` and `RecordDetailDrawer` their reference target,
  so schema-aware display-name resolution and drill-through links engage for the first time
  (objectui#6694).
  
  Both widgets build their cell meta with `buildFieldMeta` and render it through
  `renderFieldValue` → `getCellRenderer` → `LookupCellRenderer` (`@object-ui/fields`). That
  renderer resolves its target from `field.reference_to || field.reference`, and `FieldMeta`
  carried neither spelling — nor `display_field`. So the renderer resolved `undefined` and two
  things failed, independently and both silently:
  
  - `useRefObjectSchema` never loaded the referenced object's schema, so the ADR-0079 /
    objectui#2357 resolution never ran and every cell fell back to `pickRecordDisplayName`'s
    generic `.name` / `.title` heuristic. Quiet, because that heuristic usually still produces
    a readable name — it diverges only when the referenced object's display field is not
    literally `name` / `title`, and then it silently shows the wrong one.
  - `ReferencedRecordLink`'s `objectName` was always `undefined`, so `navigable` was always
    `false` and no lookup cell in either widget ever rendered a real anchor — no
    drill-through, no middle-click-new-tab, no copy-link. Quiet, because the cell still
    rendered its value as plain text.
  
  This RESTORES intended behaviour rather than adding surface. `ReferencedRecordLink` was
  placed in the shared cell renderer precisely so every surface would get the affordance once
  ("Both surfaces resolve through `LookupCellRenderer`, so the affordance belongs here,
  once"), and `plugin-grid`'s `ObjectGrid` has fed it all along via `applyRelationalMeta` at
  all three of its column-building call sites. These two widgets simply never adopted that
  copy. Nothing new is authorable: the keys come off the OBJECT SCHEMA field def authors
  already write, never off a column override — the distinction objectui#6597 measured when it
  retired `referenceTo`, and the reason this needs no new column hold.
  
  The copy is made once in `buildFieldMeta`, the seam both widgets funnel through, so the two
  surfaces cannot drift — which is what that module exists for.
  
  ⚠️ The copy set is three keys where `ObjectGrid`'s `RELATIONAL_META_KEYS` is nine, and the
  difference is measured per key, not preferred. The grid's cells are EDITABLE, so its extra
  keys drive the inline picker's query (`LookupField` / `UserField` read `id_field`,
  `description_field`, `lookup_filters`, `lookupFilters`); these two widgets are read-only and
  their render path ends at a cell renderer. `packages/fields/src/index.tsx` reads exactly
  `reference_to`, `reference` and `display_field` off a cell's `field` prop; `titleFormat` is
  never read off a field meta at all (its readers take it off the object schema, which arrives
  here through `useRefObjectSchema(reference_to)`), and `reference_to_field` has zero member
  reads anywhere in the repo. Copying the other six would mint six members written on every
  call and read by nothing — precisely what objectui#6625 (`decimals`) and objectui#6597
  (`referenceTo`) retired from this same file.
  
  No published type widened: `FieldMeta` is internal to the package — it is not re-exported
  through the barrel (`dist/index.d.ts` names neither it nor `recordFields`) and the `exports`
  map publishes only `"."`, so Node refuses `@object-ui/plugin-dashboard/recordFields` with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`.
  
  Behaviour note for existing dashboards: a lookup cell whose referenced object declares a
  `nameField` other than `name` / `title` will now show that declared name instead of the
  heuristic's pick, and valued lookup cells become links wherever the host publishes
  `recordHref`.
- 9700dd9: A lookup cell in `ObjectGrid` now honours the author's `displayField`
  (objectui#6875).
  
  `ObjectGrid` copies a set of relational keys off the object-schema field def
  onto each column's `fieldMeta`, and that bag is what the lookup cell renderer
  and the inline picker receive. The set was hand-kept and had become a strict
  SUBSET of what those two consumers read — `displayField`, `descriptionField`
  and `lookupColumns` were read on the grid's own path and never copied.
  
  They are the spellings that matter. `@objectstack/spec` 17.2.0's `FieldSchema`
  is strict and declares `displayField` / `descriptionField` / `lookupColumns` /
  `lookupFilters` / `reference`, and none of the snake_case twins the copy set
  mostly carried — those parse to `unrecognized_keys`, so a spec-compliant
  producer cannot emit them. Nothing renames anything on the way in either: the
  adapter's `getObjectSchema` choke point rewrites only the `reference` ⇄
  `reference_to` pair. So an author who declared `displayField: 'project_code'`
  got a grid cell showing the referenced record's generic `.name` instead.
  
  - The copy set is now DERIVED, in `plugin-grid/src/relationalMetaKeys.ts`, from
    a table that classifies every key the consumers read off this bag. A gate
    re-extracts that read set from the consumer sources on each run and fails on
    any unclassified spelling or orphan, so the two cannot drift apart again.
  - `reference_field` and `lookup_columns` — the other two never-copied keys —
    stay out on purpose: `FieldSchema` declares neither, so no producer can fill
    them. The gate proves that against the installed spec rather than asserting it
    in prose.
  - `plugin-dashboard`'s `CELL_RELATIONAL_META_KEYS` had the same omission in the
    same fallback chain and gains `displayField` too.
- 5ad86dd: **Breaking for authored metadata:** `TextSchema.value` is RETIRED (objectui#6951,
  maintainer ruling A1 of 2026-09-04; objectui#7016; ADR-0049 enforce-or-remove).
  A `text` node that authors `value` no longer validates: the parse fails loudly on
  the `value` path with the explanation in the message, the TS member is a
  `?: never` tombstone so the same document is refused at compile time, and the
  renderer no longer reads the key. Write `content`.
  
  **What was measured, on this branch's base.** `TextSchema` declared two spellings
  for its one content slot — `content` (read first) and `value` (the fallback limb
  of `{schema.content || schema.value}` at `renderers/basic/text.tsx:162` and
  `:167`) — both declared by objectui#6150, whose docblock called the pair "a
  dialect, not a design" and deferred the choice. The ruling's premise, that
  `value` is the minority spelling, was measured before any edit over the four
  roots it named: **776 `content`-only `text` nodes, 25 `value`-only, 0 authoring
  both** across `examples/` (674 / 13), `apps/` (59 / 0), the `examples/`
  directories under `packages/` (0 / 1) and `content/docs/**` (43 / 11) — a
  thirty-to-one majority for `content`, so the retirement went ahead as ruled.
  (A further 14 `{ value, label, type: "text" }` objects in the filter-builder
  catalog entries are field descriptors whose `type` is a field type, not `text`
  nodes, and were excluded by kind.)
  
  **Who is affected — a `value` authored on a `text` node:**
  
  ```json
  { "type": "text",
    "value": "Hello" }   // ← was tolerated (rendered as the fallback)
  ```
  
  now fails validation with:
  
  > RETIRED (objectui#6951) — `value` is no longer part of TextSchema; write
  > `content`. It was a second spelling of the one content slot, read only as the
  > fallback limb of `schema.content || schema.value`, and was retired under
  > ADR-0049 enforce-or-remove with no deprecation window (maintainer ruling A1,
  > 2026-09-04). The renderer reads `content` alone now, so an authored `value`
  > would render nothing. Rename the key; the string is unchanged.
  
  **Two published faces, one retirement.** The TypeScript interface `TextSchema`
  (`@object-ui/types`, `layout.ts`) declares `value?: never`; the Zod mirror
  `TextSchema` (`@object-ui/types/zod`, `layout.zod.ts`) declares `value` as a
  `retirementTombstone()`, so the key stays DECLARED and is refused BY NAME —
  a plain deletion would have let an authored `value` ride `BaseSchema`'s
  `.passthrough()` into a silent blank, which is worse than the tolerated
  fallback it replaces. The `value?: string` members of `TextSpanSchema` and
  `TabsSchema` in the same file are other schemas' contracts and are unchanged.
  
  **`@object-ui/components`** — the `text` renderer renders `{schema.content}` at
  both arms (the `|| schema.value` limb is gone from each), and the `context-menu`
  renderer's built-in fallback trigger node now spells `content`. Nothing else in
  the package moves. **`@object-ui/plugin-dashboard`** — its three placeholder
  `text` nodes ("chart type is not supported yet", "Custom widget — set
  `component`…", the retired-widget notice) spell `content` so they keep rendering;
  their wording is unchanged and still pinned.
  
  **Who is NOT affected.** A document that already wrote `content` is untouched;
  `content`, `variant`, `align` and `className` are unchanged; `absent` stays
  valid (`{ "type": "text" }` still parses). Every in-repo document that authored
  `value` on a `text` node was rewritten to `content` in the same change: nine
  `examples/schema-catalog` entries, `packages/types/examples/zod-validation-example.ts`,
  eleven doc fences under `content/docs/`, and the `@object-ui/components`,
  `@object-ui/react` and `@object-ui/types/zod` README samples; the catalog is now
  pinned tree-wide against the retired spelling.
  
  **Migration:** rename `value` to `content` on every `text` node; the string is
  unchanged. If a document authored both, `content` was already the value that
  rendered — delete `value`.
  
  Graded `minor`, not `patch`: this narrows the accepted input set, which is
  breaking for any author who wrote the tolerated spelling. It is not `major` per
  this repo's fixed-group convention (objectui's own breaking changes ship as
  `minor`; the group's major tracks `@objectstack` — AGENTS.md 版本号策略,
  mechanically enforced by `scripts/check-changeset-no-major.mjs`).
- 6411def: FLS-gate the `$expand` projection at the five remaining build sites (objectui#7230).
  
  objectui#7215 / PR #7229 gated `$expand` at the two projection sites in its scope
  (`ObjectGrid`, `ListView`). The helper is reached from more places than that. This
  closes the five that were left: `ObjectCalendar`, `ObjectGantt`, `RecordDetailView`,
  `DetailView`, and `ObjectDataTable` (which builds its own whitelist in
  `computeLookupExpand` rather than calling `buildExpandFields`).
  
  **Three of them pass no column list at all**, which makes them the sharp ones:
  `buildExpandFields` reads an absent column list as "no column restriction" and falls
  back to **every declared relation on the object**, denied ones included. So a standalone
  calendar, a gantt, and every record page in the console asked the server to resolve the
  object's full relation set by default rather than by configuration.
  
  **`DetailView` was input-gated, and that is the defect rather than the fix.** Its column
  list is already FLS-filtered field by field, which is exactly the route PR #7229 measured
  as unsound: an emptied column list reads as "no column restriction", so a detail view
  whose authored fields are all denied had its `$expand` **widened** from the relations it
  asked for to every relation the object declares. The principal who may read least was
  asking for the most.
  
  **Reproduced before it was fixed**, as a failing test per site.
  
  **Grading, measured rather than assumed.** Against ObjectStack's own server this is
  defence-in-depth, exactly as objectui#6898 and #7215 are: `plugin-security`'s
  `FieldMasker.maskRecord` deletes every unreadable key from each returned row and
  objectql's expand path writes the resolved record back under that same key, so one
  statement removes the expanded object and the bare id alike; the expansion sub-read is
  itself gated (`__expandRead` takes the referenced object's full CRUD + RLS + FLS
  treatment). It is load-bearing for any backend that does not strip, and the
  client-request side is real regardless.
  
  **Nothing a permitted view did stops working.** The gate judges each helper's OUTPUT,
  which contains only the object's declared reference-bearing fields, so the "`checkField`
  answers false for an undeclared key" trap cannot be reached and derived / host-joined
  columns are untouched. An unanswered permission policy filters nothing. Neither
  `buildExpandFields` nor `computeLookupExpand` is changed.
- 47547d0: Localize the server's built-in aggregate measure titles on dataset charts
  (objectui#7258 — consumer half of the objectstack#14492 contract; maintainer
  ruling B, 2026-09-02).
  
  A dataset-bound chart's aggregate axis / legend title read the analytics
  service's hard-coded English `Count` on a zh console whose category labels were
  already Chinese. The renderer was passing `fields[].label` through verbatim —
  correctly, for an author-declared measure (objectui#4106) — and had no way to
  tell the server's built-in default apart from an author's label.
  
  The wire now can: `AnalyticsResult.fields[]` gains an OPTIONAL structural
  discriminator, `builtinAggregate?: 'count' | 'sum' | 'avg' | 'min' | 'max' |
  'count_distinct'`, populated only on the server-side built-in defaults
  (objectstack#14492). This change is the consumer side of that contract:
  
  - `@object-ui/core`: `buildChartSeries` now accepts `ChartMeasureField[]` —
    `ChartResultField` plus the optional `builtinAggregate` carrier
    (`BuiltinAggregateCarrier`), declared beside the renderer shape rather than
    on it because the spec this release is built against does not carry the key
    yet; new `BUILTIN_AGGREGATES` / `BuiltinAggregate` / `isBuiltinAggregate` /
    `resolveMeasureLabel`; `ChartSeriesOptions.builtinAggregateLabels` carries
    the locale strings in (core stays React-free and i18n-free — the same
    division as `nullCategoryLabel`). A field carrying a recognised
    discriminator resolves through that map; every other field keeps its wire
    `label` verbatim — never by matching the label's text or the field's name
    (the rejected option A).
  - `@object-ui/i18n`: `builtinAggregateLabels(tt)` resolves the six strings
    through the existing `report.aggregate.*` keys (zh already carried 计数 /
    求和 / 平均 / …; all ten packs are pinned to cover the vocabulary).
  - `plugin-charts` (`ObjectChart`), `plugin-dashboard` (`DatasetWidget`),
    `plugin-report` (`DatasetReportRenderer`): pass the resolved map to
    `buildChartSeries`.
  
  Before: 合作中 / 已流失 / 潜在 under an axis titled `Count`. After: the same
  chart titled `计数`; an `en` session still reads `Count`; an author-labelled
  measure (`Tasks`) and a measure literally named `count` without the
  discriminator are byte-for-byte unchanged. Until the upstream field is
  populated the wire carries no discriminator and every chart renders exactly as
  before.
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
- fc32921: Fix a dashboard chart widget with a FIELDLESS `count` aggregate plotting nothing
  (objectui#8266).
  
  A widget bound to an object with `aggregate: { function: 'count', groupBy: 'status' }`
  and no `field` — the normal way to author "how many records per status" — rendered an
  empty chart. No error, no empty state: a plot frame with the category ticks drawn and
  not one mark in it, which reads exactly like "this object has no rows yet".
  
  **Cause.** The two dashboard relays (`DashboardGridLayout`, `DashboardRenderer`) each
  built the series binding as `aggregate?.field || (options.yField || 'value')`, which for
  a fieldless count resolves to `'value'`. The rows an object-bound fieldless count
  returns are keyed `'count'` — the alias the engine projects `COUNT(*)` under, pinned
  since framework#3701. A `dataKey` naming a column no row carries plots nothing, and
  neither of the renderer's two guards fires on it: the rows DO carry the category key,
  and the series array is not empty.
  
  **Fix.** `chartMeasureKey` is a new `@object-ui/core` export delegating to
  `chartAggregateValueKey` in `@objectstack/spec/ui` — the contract's own derivation of
  "the value column an object-bound aggregate produces". Both relays now consult it, and
  the row-projection side (`aggregateValueKey` in `@object-ui/plugin-charts`) is routed
  through the same function, so the two halves of the question cannot drift again.
  
  **What moves on screen.** A chart that was blank now draws. Charts that already drew are
  unaffected: a field-bearing aggregate resolves to its raw field under both the old and
  the new reading, and a chart with no `aggregate` at all keeps the author's `yField`.
  One authored key changes meaning: a `yField` written on an object-bound chart that
  ALSO declares an aggregate no longer wins over the aggregate's own column — it named a
  record column that a grouped aggregate never returns, so it plotted nothing before.
  
  **Not fixed here, and out of scope.** The same widget with no `options.xField` is
  refused by the category-axis guard naming `name`, a key the author never wrote (they
  wrote `aggregate.groupBy`). That is the category half of the same relay gap and is
  filed separately.
- 8f9d87a: Fix a dashboard chart widget that declares its category as `aggregate.groupBy` being
  refused for lacking a `name` column (objectui#8269).
  
  A widget bound to an object with `aggregate: { function: 'count', groupBy: 'status' }`
  and no `options.xField` rendered a refusal instead of a chart:
  
  > This chart cannot plot its category axis: no row has a `name` field.
  
  The author wrote `groupBy: 'status'`. Nothing on screen said `groupBy` was the key that
  had been ignored, and `name` appeared nowhere in their metadata — so the diagnostic sent
  them to debug the wrong layer.
  
  **Cause.** The two dashboard relays (`DashboardGridLayout`, `DashboardRenderer`) each
  floored the category binding on a literal — `options.xField || 'name'` — and handed it to
  the `object-chart` node without ever consulting the aggregate that decides it. An
  object-bound aggregate returns one row per group keyed by the raw `groupBy` field, so no
  row carried `name` and the category-axis guard (framework#4033) fired correctly on a
  binding that was already wrong when it arrived.
  
  **Fix.** `chartCategoryKey` is a new `@object-ui/core` export delegating to
  `chartAggregateCategoryKey` in `@objectstack/spec/ui` — the contract's own derivation of
  "the category column an object-bound aggregate produces", and the published sibling of the
  `chartAggregateValueKey` that objectui#8266 adopted for the measure axis. Both relays now
  consult it for the object-provider branch.
  
  **What moves on screen.** A widget that rendered a refusal now draws. Measured through
  `ChartRenderer` at 480x320 over the rows a fieldless count returns
  (`[{status:'open',count:2},{status:'paid',count:5}]`): the composed binding went from
  `xAxisKey: 'name'` — a `missing-category-key` refusal, 0 marks — to `xAxisKey: 'status'`,
  1 series and 2 marks with the category ticks drawn.
  
  **Unaffected.** A chart with no `aggregate` at all keeps the author's `xField` (its rows
  are raw records, so that key is the right one), an UNGROUPED aggregate keeps it too (it
  returns a single row with no category column), and the authored-literal-rows branch — the
  `chart` node composed after the object-provider check fails — keeps its floor unchanged.
  One authored key changes meaning, exactly as objectui#8266's `yField` did: an `xField`
  written on an object-bound chart that ALSO declares a `groupBy` no longer wins over the
  aggregate's own column — it named a record column a grouped aggregate never returns, so it
  produced the same refusal before.
- 3d79455: `plugin-dashboard`'s two private copies of the reference-bearing field family now
  read `@object-ui/core`'s published `EXPANDABLE_FIELD_TYPES` instead of restating
  it — `LOOKUP_TYPES` in `recordFields.tsx` and the inline disjunction inside
  `computeLookupExpand` in `ObjectDataTable.tsx`. Both carry the identity pin the
  already-converged consumers carry, so a member-identical private copy fails
  rather than quietly re-forking the table.
  
  Two behaviour changes on the dashboard table's `$expand`, in opposite directions:
  
  - **A `tree` column is now expanded.** A self-referencing hierarchy field is
    reference-bearing and a member of the shared family, so its cell renders the
    parent record's display name instead of a bare id — the same treatment the form
    and grid roads already gave it.
  - **A `reference`-typed column is no longer expanded.** Measured before removing
    it: `reference` is absent from `@objectstack/spec`'s closed `FieldType`
    vocabulary and is refused by `FieldSchema.safeParse`, so no spec-compliant
    object schema can declare a field whose stored type is `reference`. Dropping it
    is a no-op on real data; the spelling is a legacy dialect alias on the
    action-param surface, folded to `lookup` before any field-type data is read.
  
  `EXPANDABLE_FIELD_TYPES` itself is unchanged — the measurement did not license
  widening a published shared set.
- cc5de5c: `DashboardRenderer` no longer emits an empty dashboard header wrapper. The
  wrapper used to render whenever `header` was declared, while each of its
  children — title, description, actions — was additionally suppressible. With
  the console page chrome present (`hideHeaderText`, set because the chrome
  already renders the dashboard's title and description) and no `header.actions`,
  every child evaluated falsy and the DOM still received
  `<div class="col-span-full mb-4"></div>`: zero children, yet a full grid row
  (measured 64px) plus `mb-4` of dead band above the filter bar, on every console
  dashboard page (objectui#5812, measured on HotCRM 17.1.0).
  
  The three children are now computed first and the wrapper renders only if one
  of them survives. Nothing else changes: a standalone embed (no chrome) renders
  title and description exactly as before, and declared `header.actions` keep the
  wrapper alive even under the chrome, since the chrome renders text only. Authors
  needed this — dropping `header` from the metadata to reclaim the pixels would
  have cost the standalone embed its title, which is what `header` is for.
- 84d2e98: `DashboardRenderer` drops the unreachable `DatasetWidget` fork from its self-contained
  (card-less) branch, leaving that branch to render `SchemaRenderer` unconditionally
  (objectui#4620).
  
  `isSelfContained` is defined as `widget.type === 'metric' && !datasetBound`, and the
  `isSelfContained` arm of `renderedNode` then forked on `datasetBound` a second time. The
  `datasetBound` side of that inner fork could never execute: reaching it required
  `isSelfContained` to be true, which requires `!datasetBound`. Behaviour is unchanged —
  the removed arm never ran, and the reachable fork in the Card branch (the one that gives
  a dataset-bound metric its title and border chrome) is untouched.
  
  The cost was to readers, not to users: the shape read as "both branches handle
  dataset-bound widgets" when only one can, and a previous PR mirroring this fork onto
  `DashboardGridLayout` had to pay for the reachability argument before it could decline to
  copy the dead limb. A comment now names the invariant in place so the arm is not re-added.
- f24195a: `ObjectDataTable` and `ObjectPivotTable` now use a module-scope frozen empty for
  "no rows yet" instead of a fresh array literal per render (objectui#4629).
  
  Both spelled the resolved row list as `Array.isArray(rawData) ? rawData : []`, so
  whenever `rawData` was a truthy non-array — a provider-config `data`, or a `bind`
  path that resolves to an object — the fallback produced a NEW array identity on
  every render. In `ObjectDataTable` that value keys the `derivedColumns` memo, so
  every column was re-derived (`buildFieldMeta`, a fresh `cell` closure, the
  `isSystemField` pass, the `fieldLabel` lookups) and then discarded by the
  `finalData.length === 0` early return. In `ObjectPivotTable` the value is handed
  straight to `PivotTable`, where it keys the cross-tabulation memo, so the pivot
  rebuilt its row/column sets, bucket map and totals on every render over no rows
  at all.
  
  Nothing rendered wrong before or after; this is wasted work in the empty window,
  plus the live `react-hooks/exhaustive-deps` warning the conditional raised. It is
  the same module-scope frozen empty `data-table.tsx` adopted for its own
  `EMPTY_ROWS` (objectui#4618), applied to the `provider: 'object'` siblings.
- 56f4e34: A dashboard table's auto-derived column headers spell a field key the same way every other path in the `table` widget family does.
  
  `ObjectDataTable` derives headers on two paths — from the author's declared
  `columns`, and from the object schema when no columns were declared. The
  declared path (and the static `data-table` half of the same widget family)
  already used `humanizeFieldKey`, whose docstring names it "the single home for
  the convention, because both halves of the `table` widget family need it and
  they must agree". The auto-derived path carried a third, inline spelling that
  split camelCase but never turned `_` into a space, so it left a raw underscore
  on screen. Measured over the same object's columns:
  
  ```
  path                                     close_date    needs_analysis
  object-bound, AUTO-DERIVED   (before)    Close_date    Needs_analysis
  object-bound, AUTO-DERIVED   (after)     Close Date    Needs Analysis
  object-bound, DECLARED columns           Close Date    Needs Analysis
  static `data-table`, no columns          Close Date    Needs Analysis
  ```
  
  One dashboard can hold all three widgets over one object, so a single field key
  rendered under two spellings — the defect class objectui#5425 rules out. The odd
  path adopts the shared convention rather than the convention gaining a fourth
  dialect. camelCase keys are unaffected (`unitPrice` read `Unit Price` before and
  after — the coincidence that kept the snake_case divergence unnoticed), and a
  translated header still wins: only the fallback handed to `fieldLabel` changed.
  
  Dimension MEMBER labels are untouched by this. The same card reported dashboard
  members rendering a prettified enum instead of the picklist's translated label,
  measured on 17.1.0; re-measured on this branch it no longer reproduces — the
  analytics label net shipped in 17.5.0 routes every non-metric dataset dimension
  through the field's declared options and the locale bundle. That behaviour had
  no test stated in the card's terms and now has one, over the four dashboards the
  card measured, including the property that a bar axis and a pivot header cannot
  disagree about one stored value.
- 84d70bb: `ObjectPivotTable` now depends on the `fieldLabel` / `fieldOptionLabel`
  resolvers directly instead of holding them behind refs, so a pivot re-derives
  its header and option labels when the resolver genuinely changes
  (objectui#5625).
  
  The refs existed for a reason that no longer holds. `useSafeFieldLabel()`
  returned a fresh object on every render outside an i18next provider, so a direct
  dependency would have re-run the metadata-derivation effect on every render —
  and that effect ends in `setFieldLabelMaps` / `setFieldNameLabels` with freshly
  built objects, so each run scheduled the next one: an unbounded derive loop.
  `ObjectPivotTable` worked around that locally with `fieldLabelRef` /
  `fieldOptionLabelRef` plus a `useEffect` keeping them current.
  `useObjectLabel`'s memo now holds with or without an i18next instance bound
  (objectui#5564), so both resolvers have a stable identity on both paths and the
  indirection buys nothing.
  
  It did cost something, and that is the user-visible half: a ref-hidden
  dependency meant the derivation did NOT re-run when the resolver changed. A
  pivot mounted before its `I18nProvider`, or rendered across a language switch,
  kept showing its top-left header label and its select-option cell labels as
  resolved by the old resolver — until some unrelated dependency (the data source,
  the object name) happened to move. It now re-derives once on that transition and
  renders in the active language.
  
  This is the same removal objectui#5587 made in `ObjectChart`, one package over.
  
  Pinned by `ObjectPivotTable.i18nResolverDeps.test.tsx`, which counts derivations
  across forced re-renders both outside and inside a provider, checks that the two
  derived state maps settle, and asserts the language-switch re-derivation.
  Reverting `useObjectLabel.ts` to its pre-objectui#5585 state turns the
  no-provider case red (derivations in the dozens instead of 1), so the removal is
  pinned to the fix that unlocked it rather than to a comment.
- f1c27f0: Dashboard record fields: percent columns now render through the one percent
  scaling decision instead of a second, drifted copy of it.
  
  `renderFieldValue`'s `%`-format branch normalised the value itself before
  calling `formatPercent` (`const normalized = value > 1 ? value / 100 : value`,
  then `normalized * 100`). `formatPercent` already applies `percentDisplayValue`,
  which `@object-ui/core` documents as the single source of truth for percent
  display scaling, so the branch was re-deciding what core owns — and its copy had
  drifted from it in three measured ways:
  
  - `(value / 100) * 100` is not value-preserving in binary floating point,
    re-introducing one call frame upstream the round trip that was removed from
    inside `formatPercent`. On the 0.001-step grid to 200, 19,978 of 199,000
    values change bit pattern and 1,108 rendered strings move, every one a
    last-digit off-by-one: a stored `1.605` rendered `1.60%` where half-up is
    `1.61%`.
  - A stored fraction below `0.01` was scaled twice — the local `* 100` put it
    back under 1, so core's fraction arm scaled it again. `0.005` (0.5%) rendered
    `50.00%`.
  - The local test was `value > 1` rather than core's symmetric `|value| < 1`, so
    a negative already in percentage points took the fraction arm: `-5` rendered
    `-500.00%`.
  
  The branch now hands the raw stored value to `formatPercent` — the identical
  call the list-view percent cell already makes for an ordinary percent column —
  so a percent reads the same as a record field, as a grid cell and as a dashboard
  measure. Output moves where it was wrong: values at or above 1 whose round trip
  lost a digit, fractions below `0.01`, negatives at or below `-1`, and exactly
  `1`, which is one percentage point by core's convention and now renders
  `1.00%` at two decimals, where the local `value > 1` test had made it
  `100.00%`.
- 0ccbdc1: `PivotTable` no longer re-runs its cross-tabulation memo on every render when it
  has no rows (objectui#5562).
  
  The component spelled the empty array twice — as the destructuring default for
  `schema.data` and as the `Array.isArray` fallback that keeps a provider-config
  object out of iteration — so a schema declaring no `data` key, or one whose
  `data` is a provider config rather than rows, produced a fresh array identity on
  every render. That value is the first entry of the memo's dependency list, so
  the memo rebuilt its two ordered key sets, its `bucket[row][col]` map, the
  aggregated matrix and the row/column/grand totals on every render, over nothing.
  Both spellings now resolve to one module-scope frozen empty, so "no rows" is a
  stable value and the memo holds.
  
  Wasted work only: the churn feeds a memo rather than a `setState`, and
  `PivotTable` holds no prop-to-state sync, so nothing rendered wrong and no
  render loop was possible. The identical fix landed for `data-table` in
  objectui#4618 and for `ObjectPivotTable` in objectui#4629; this closes the
  direct-use path those two did not cover, where `DashboardRenderer` and
  `DashboardGridLayout` construct pivot schemas without `ObjectPivotTable` in the
  chain.
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
- cfcff30: Each package's README now states, up front, that it needs a bundler: importing it from plain Node ESM fails, and that is a supported-configuration boundary rather than a defect.
  
  `@object-ui/plugin-dashboard` imports `react-grid-layout/css/styles.css` at module
  scope and `@object-ui/plugin-map` imports `maplibre-gl/dist/maplibre-gl.css`;
  `@object-ui/app-shell` reaches the first of those through the static
  `@object-ui/plugin-dashboard` imports in `DashboardView` and `ReportView`. Node has
  no loader for `.css` at all, so all three resolve and then die during evaluation:
  
  ```
  TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".css"
    for .../react-grid-layout/css/styles.css
  ```
  
  Nothing about how these packages load has changed — every supported host bundles
  them (Vite, webpack, or Next with the package in `transpilePackages`), and that is
  still the only supported way to consume them. What changed is that the boundary is
  now written where a consumer meets it, instead of being learned from a red import.
  
  objectui#5384 ruled unbundled Node consumption **unsupported** for style-carrying
  plugin packages — permanently, over the three packages as a group — rather than
  moving the stylesheet imports out of module scope. No unbundled-Node consumer
  exists, and buying permanent machinery to close a capability gap nobody is pulling
  on was the trade the ruling declined. A real consumer request reopens it as a
  design question, not as a defect: the READMEs say so and name the issue.
- fb96ecb: `WidgetConfigPanel` reads an inline-locale-map title, and a save no longer destroys the other locales.
  
  The dashboard widget config panel carried a private `resolveLabel` documented as
  resolving an `I18nLabel` while reading `defaultValue || key` — the key-reference
  form `@objectstack/spec` retired at 17.0.0-rc.6 (objectstack#5055). The inline
  per-locale map `I18nLabelSchema` actually admits has neither limb, so
  `{ en: 'Revenue', zh: '收入' }` resolved to `''`. It was the fourth private copy
  of that resolver; objectui#4032 swept the other three out of `DashboardRenderer`,
  `MetricWidget` and `MetricCard`.
  
  This was not a display bug. The resolved value seeds the panel's editable draft,
  so a widget whose stored title was a map opened with an **empty** Title field and
  the next save wrote `''` over the author's map — on the ordinary path, not an
  exotic one: open the widget, change anything, save.
  
  Both halves are fixed, per the maintainer's 2026-08-20 ruling on objectui#5301:
  
  - **Reading** goes through `pickLocalized(value, language)`, so the panel shows
    the active locale like every sibling surface post-objectui#4032.
  - **Writing** replaces only the active locale's entry and carries every other
    locale across. A title the author never touched round-trips the stored object
    itself through an unrelated config edit; an edited one merges into the entry
    that was displayed. The live-update callback (`onFieldChange`) forwards the
    merged map for the same reason — hosts feed it back into the widget the panel
    re-opens from, so a bare string there dropped the map before a save ever ran.
  
  `@object-ui/i18n` gains `setLocalized(value, language, next)`, the write-side
  inverse of `pickLocalized`, so the rule is stated once instead of re-derived per
  panel. It follows `pickLocalized`'s first three limbs — exact tag, base language,
  region-qualified sibling — and deliberately stops there: the `default` / `en` /
  first-value limbs are display fallbacks that hand back *another* locale's string,
  and writing to one would let an author editing in `fr` overwrite English. With no
  entry for the active locale the edit adds one. The pairing
  `pickLocalized(setLocalized(map, lang, s), lang) === s` is pinned, because a
  write that lands where the read does not look is how a "saved" string disappears.
  
  A full multi-locale editing UI remains out of scope (objectui#4163).
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
- Updated dependencies [636b236]
- Updated dependencies [4172589]
- Updated dependencies [64d624d]
- Updated dependencies [053fdc8]
- Updated dependencies [41b7ce3]
- Updated dependencies [39f4309]
- Updated dependencies [d2fb6ef]
- Updated dependencies [7cd3987]
- Updated dependencies [e304a4e]
- Updated dependencies [490d9a9]
- Updated dependencies [fc62bb4]
- Updated dependencies [41df893]
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
- Updated dependencies [90665e0]
- Updated dependencies [8d3a529]
- Updated dependencies [5ac2e2c]
- Updated dependencies [194fae1]
- Updated dependencies [7e19d03]
- Updated dependencies [b08b7eb]
- Updated dependencies [546ddf7]
- Updated dependencies [864154e]
- Updated dependencies [b023625]
- Updated dependencies [75bd83d]
- Updated dependencies [44d075b]
- Updated dependencies [40c479a]
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
- Updated dependencies [a26b9e4]
- Updated dependencies [5ef9c4f]
- Updated dependencies [46f0bb4]
- Updated dependencies [8ec11e1]
- Updated dependencies [6f81384]
- Updated dependencies [22ba927]
- Updated dependencies [8631c32]
- Updated dependencies [f8c70f4]
- Updated dependencies [5d3a2d1]
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
- Updated dependencies [5961030]
- Updated dependencies [f24de8b]
- Updated dependencies [c8ea8af]
- Updated dependencies [9602dc8]
- Updated dependencies [3190414]
- Updated dependencies [4e480f5]
- Updated dependencies [38a123c]
- Updated dependencies [299102e]
- Updated dependencies [30c73cd]
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
- Updated dependencies [98188c2]
- Updated dependencies [4c68077]
- Updated dependencies [7977ff9]
- Updated dependencies [3beef6d]
- Updated dependencies [06b8c42]
- Updated dependencies [46b9bc9]
- Updated dependencies [f46bd39]
- Updated dependencies [b98352a]
- Updated dependencies [b76ca67]
- Updated dependencies [45ac2cb]
- Updated dependencies [b97790a]
- Updated dependencies [dbd5194]
- Updated dependencies [7c9b044]
- Updated dependencies [e552c31]
- Updated dependencies [d47de51]
- Updated dependencies [3fe6463]
- Updated dependencies [b392674]
- Updated dependencies [4f3a1e2]
- Updated dependencies [31ab372]
- Updated dependencies [846889b]
- Updated dependencies [7b90231]
- Updated dependencies [26896c6]
- Updated dependencies [67fc3b0]
- Updated dependencies [8579e34]
- Updated dependencies [d57db5d]
- Updated dependencies [33a3b3c]
- Updated dependencies [b87f15b]
- Updated dependencies [045d20b]
- Updated dependencies [c18d099]
- Updated dependencies [0caacca]
- Updated dependencies [adb2a86]
- Updated dependencies [03380aa]
- Updated dependencies [3561bd2]
- Updated dependencies [bf97b98]
- Updated dependencies [320374d]
- Updated dependencies [b0d308d]
- Updated dependencies [b458300]
- Updated dependencies [8063bcb]
- Updated dependencies [b74a859]
- Updated dependencies [d4493fd]
- Updated dependencies [240b80f]
- Updated dependencies [77cb489]
- Updated dependencies [bfaa158]
- Updated dependencies [777e5c6]
- Updated dependencies [0c386dd]
- Updated dependencies [39d69ad]
- Updated dependencies [9e37d9b]
- Updated dependencies [5ad86dd]
- Updated dependencies [16a725f]
- Updated dependencies [4dfdcc3]
- Updated dependencies [6a449fc]
- Updated dependencies [446d93d]
- Updated dependencies [ecd9cb2]
- Updated dependencies [f08bcd9]
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
- Updated dependencies [e8e4c4d]
- Updated dependencies [1f31d3a]
- Updated dependencies [d1842ab]
- Updated dependencies [78ca238]
- Updated dependencies [d8ec8d6]
- Updated dependencies [351eb31]
- Updated dependencies [866cd1d]
- Updated dependencies [20c04b2]
- Updated dependencies [01c9023]
- Updated dependencies [48c19bd]
- Updated dependencies [a6d8b8d]
- Updated dependencies [b652514]
- Updated dependencies [adbda1b]
- Updated dependencies [adbda1b]
- Updated dependencies [8952395]
- Updated dependencies [e8c553b]
- Updated dependencies [2e32ed4]
- Updated dependencies [7c3df8f]
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
- Updated dependencies [ed27d7c]
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
- Updated dependencies [7ed9808]
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
- Updated dependencies [9a1fb41]
- Updated dependencies [c40f3b8]
- Updated dependencies [58770f3]
- Updated dependencies [aefe428]
- Updated dependencies [485f096]
- Updated dependencies [199d31b]
- Updated dependencies [b655a9d]
- Updated dependencies [a865c73]
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
- Updated dependencies [e4e9557]
- Updated dependencies [7a28e1e]
- Updated dependencies [ebce5a3]
- Updated dependencies [9d9040d]
- Updated dependencies [20e317c]
- Updated dependencies [0fce2ef]
- Updated dependencies [9850c6e]
- Updated dependencies [de570cc]
- Updated dependencies [b2ea297]
- Updated dependencies [5b5a5c3]
- Updated dependencies [b6e83be]
- Updated dependencies [ab92940]
- Updated dependencies [a691c0b]
- Updated dependencies [0b1326d]
- Updated dependencies [1e66879]
- Updated dependencies [c5200f0]
- Updated dependencies [af3861f]
- Updated dependencies [515f171]
- Updated dependencies [4f14ad7]
- Updated dependencies [258d264]
- Updated dependencies [cac64b3]
- Updated dependencies [4bb940b]
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
- Updated dependencies [f1690d4]
- Updated dependencies [83fe6e7]
- Updated dependencies [d1ab06f]
- Updated dependencies [38a9568]
- Updated dependencies [f90b8fb]
- Updated dependencies [91783c4]
- Updated dependencies [dba7d84]
- Updated dependencies [5a07e67]
- Updated dependencies [2d36552]
- Updated dependencies [45d8288]
- Updated dependencies [b2437a7]
- Updated dependencies [f157423]
- Updated dependencies [7a90afd]
- Updated dependencies [eddc1dd]
- Updated dependencies [490f482]
- Updated dependencies [27308c5]
- Updated dependencies [8689166]
- Updated dependencies [c9327c9]
- Updated dependencies [920165d]
- Updated dependencies [9101be5]
- Updated dependencies [f53a8d0]
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
  - @object-ui/i18n@17.7.0
  - @object-ui/core@17.7.0
  - @object-ui/types@17.7.0
  - @object-ui/fields@17.7.0
  - @object-ui/components@17.7.0
  - @object-ui/react@17.7.0
  - @object-ui/permissions@17.7.0

## 17.6.0

### Minor Changes

- 4dbcae7: BREAKING: `dashboardComponents` is re-keyed from 11 PascalCase component class
  names to the 8 schema `type` keys the package actually registers
  (`dashboard`, `metric`, `metric-card`, `object-metric`, `pivot`,
  `object-pivot`, `dashboard-grid`, `object-data-table`), aligning the map with
  its four sibling `*Components` maps (objectui#5064, Route A per the
  2026-08-18 maintainer ruling). Every value is the exact component the
  side-effect import registers for that type — for the two `object-*` types
  that is the internal data-source-gate wrapper, not the exported widget. The
  three config-panel components (`DashboardConfigPanel`, `WidgetConfigPanel`,
  `DashboardWithConfig`) leave the map; they remain named exports. Any code
  reading the old keys (e.g. `dashboardComponents.DashboardRenderer`) breaks —
  two independent word-boundary greps measured zero such consumers in-tree.
  Per AGENTS.md §版本号策略, objectui's major tracks `@objectstack`'s major, not
  its own breaking-change count — this package's own breaking changes are
  scored `minor` with the break spelled out in this body, which is what makes
  this a `minor` (maintainer ruling, 2026-08-19).
- 58398ba: fix(plugin-dashboard): `ObjectDataTable` resolves column identity before it hands columns to the table
  
  `normalizeColumns` converted the `string[]` shorthand and returned every object
  column **raw**. `data-table` is an adapter, and its column key is `accessorKey`
  (`TableColumn.accessorKey`) — a key `@object-ui/core` deliberately holds outside
  the metadata identity fold, where `column-identity.ts` names it
  `TABLE_ADAPTER_COLUMN_KEY`. So a column authored in the spec-canonical spelling,
  `{ field: 'stage' }`, reached the adapter carrying no `accessorKey` at all: the
  widget rendered a header over `row[undefined]` — every cell blank, nothing said
  — and `computeLookupExpand`'s `$expand` whitelist, which resolved
  `c.accessorKey || c.name`, missed the same column, so a `field`-spelled lookup
  also lost its related record and showed a raw FK id.
  
  Identity is now resolved once, here, through the shared `columnIdentity` reader
  and stamped onto the adapter's key. This is the move objectui#5022 made in
  `RelatedList` and objectui#5068 generalized in `ObjectGrid`: metadata vocabulary
  in, adapter vocabulary out, one translation in one place.
  
  **Affected input.** A column authored `{ field: … }` on an `object-data-table`
  now renders its cells and, when the field is relational, enters `$expand`. Both
  were previously empty. Columns authored `{ accessorKey: … }` are untouched, by
  reference. An author-supplied `accessorKey` is never overwritten — a deliberate
  divergence between the table slot and the metadata key belongs to the author —
  and an entry whose identity resolves to nothing is returned untouched, so
  nothing is invented for it.
  
  The other half of objectui#5120 — retiring `data-table`'s undeclared `col.name`
  alias — is **not** in this change. The card's census-first fork clause tripped:
  `skills/objectui/guides/data-integration.md` and
  `skills/objectui/guides/schema-expressions.md` both instruct authors to spell a
  `data-table` column `{ "name": …, "label": … }`, so the limb has real authorized
  usage and the deletion went back to the maintainer. This change is a
  prerequisite for that deletion rather than a substitute: it is what stops
  `object-data-table` from depending on the alias.
- f6fc565: `ObjectMetricWidgetProps` now speaks `@objectstack/spec`'s `I18nLabel` vocabulary on `label`, `trend.label`, `description` and `title`.
  
  These four members still declared `string | { key?: string; defaultValue?: string }`
  — the key-reference label form `@objectstack/spec` RETIRED at 17.0.0-rc.6
  (objectstack#5055). The sibling `MetricWidgetProps` was migrated to
  `string | I18nLabel` for exactly this reason in objectui#4358; this interface was
  missed in that pass, and it was the last declaration of the retired shape in any
  package's shipped `src` (objectui#5264).
  
  It was not inert. `ObjectMetricWidget` forwards `label` / `description` / `trend`
  straight to `MetricWidget`, which resolves them with `pickLocalized`. The retired
  object matches no locale limb, so resolution fell through to that resolver's last
  resort — the first string property in insertion order — and a metric authored in
  the natural `{ key, defaultValue }` spelling painted the RAW DOTTED TRANSLATION KEY
  onto the KPI card as its visible label. Written the other way round the English
  fell out instead. That property-order dependence is why the defect never read as
  systematic in review.
  
  Breaking semantics, stated per this repo's version policy (objectui's own
  breaking changes ship as `minor` so the fixed group's major stays aligned with
  `@objectstack`; see AGENTS.md §版本号策略):
  
  - **What starts type-checking:** the inline per-locale map — `label={{ en:
    'Revenue', 'zh-CN': '收入' }}` — which is the ONLY object form the spec admits
    today. Against the old declaration it was a compile error (TS2322/TS2353,
    excess property `en`), so a consumer writing the correct vocabulary could not
    build. This is the substance of the change and it is a WIDENING.
  - **What stops type-checking:** nothing in practice. `I18nLabel`'s object half is
    `InlineLocaleMap`, which erases to `Record<string, string>` in the emitted
    `.d.ts` — the BCP-47 key regex is a Zod runtime refinement and does not survive
    into the type — so `{ key, defaultValue }` remains structurally assignable. The
    retired form is refused where refusal is expressible: `I18nLabelSchema` rejects
    it at authoring time, in both property orders. No renderer-side tolerance was
    added for it (AGENTS.md #0.1).
  - **Behaviour change on the drill-down panel title.** `drawerTitle` read
    `title?.defaultValue` / `label?.defaultValue` directly. An inline per-locale map
    has no such limb, so an authored drill title resolved to `''` and the drawer
    silently fell back to the literal word "Details". It now resolves through the
    same `pickLocalized` and the same UI language as the tile, so the drawer and the
    card that opened it can no longer disagree. A metric still passing the retired
    form (only reachable by cast, or from stored metadata) sees the drawer follow
    the card instead of diverging from it.
- 9ce096f: Give a chart bucket an identity distinct from its display label
  
  objectui#4508. `buildChartSeries` used the bucket's DISPLAY string as the
  bucket's own key, so two pairs of genuinely different groups were conflated —
  and the segment click that drills a bar back to its records inherited both
  conflations. The maintainer ruling (2026-08-14) approved the sentinel-identity
  direction, aligning the chart branch with the distinct-bucket-id form the pivot
  TABLE (`buildPivot`) already uses over the same dataset rows.
  
  Two collisions, one cause:
  
  - **A null group and an empty-string group drew ONE bar.** The pivot branch
    keyed buckets by `String(xRaw ?? '')`, which spells `null` and `''`
    identically. The bar took its label from whichever row created the bucket, and
    the other group's segment then resolved to no row at all — a visible bar whose
    click did nothing.
  - **A record whose stored value spells the bucket label stole the null bucket's
    drill.** A row storing the literal text `(None)` (or any localized
    `chart.nullCategory` — `(未指定)` and the other nine packs) kept its own
    bucket, so two bars carried the same axis text and BOTH resolved to the first.
    That one is a wrong drill, not a dead one: clicking the null bucket's bar
    opened the drawer on another group's records.
  
  What changed:
  
  - **`chartBucketId`** (`@object-ui/core`) is the bucket identity — the SAME
    encoder `buildPivot` keys its buckets with (`pivotBucketId` over
    `pivotDimensionValue`), so the two surfaces stop answering one question two
    ways. The pivot branch now buckets by it, which is what makes null and `''`
    two groups again.
  - **`CHART_BUCKET_ID_KEY`** carries that identity on an emitted row, written
    exactly where two DISTINCT buckets paint the same axis text — the complete set
    of cases where the display string cannot name what was clicked. An ordinary
    chart's rows are returned untouched (by identity), so no renderer-internal key
    reaches an authoring surface.
  - **`findChartSeriesRow`** takes that identity back as `options.bucketId` and
    treats it as authoritative. The renderers forward it: the drill event gains
    `categoryId` (`ChartSegmentClickEvent`, now declared once in
    `@object-ui/core` instead of inline in three packages), `AdvancedChartImpl`
    reads it off the clicked row on the cartesian, pie and funnel paths, and
    `DatasetWidget.handleChartDrill` hands it to the lookup.
  
  Behaviour change worth noting: an empty-string category no longer resolves to a
  null-valued row. That tolerance was justified as the drill layer's own spelling
  of "no group value", but no producer of this lookup's `category` writes it,
  while `''` IS the axis text a genuine empty-string group paints — so the
  tolerance was giving that group's bar a different group's records. A host that
  forwards no `categoryId` keeps its existing drill unchanged.

### Patch Changes

- ef0d150: The dashboard config sidebar translates: `WidgetConfigPanel` and `DashboardConfigPanel` are wired through `t()`.
  
  Both panels build a `ConfigPanelSchema` — breadcrumb, section titles, field
  labels, placeholders, help text and option labels — and neither imported a
  translation hook at all, so all 61 of their user-visible strings were English
  literals. Both are exported from the package barrel and mounted by
  `DashboardWithConfig` as the dashboard editing sidebar, so a user on any
  non-English console opened a panel that stayed English inside chrome that had
  translated around it.
  
  They now resolve through a new `dashboard.config.*` namespace — 75 keys, added
  to all ten locale packs. The namespace sits beside `dashboard.trend.*` and
  `dashboard.filters.*`, which is where this package's other translated surfaces
  already read from, and the panels reach it through
  `useConfigPanelTranslation`, a `createSafeTranslation` hook whose
  `CONFIG_PANEL_DEFAULT_TRANSLATIONS` map carries the English defaults for hosts
  that mount no `I18nProvider`.
  
  The keys are authored fresh against the wording the panels actually ship rather
  than restored from the retired `configPanel.*` block: that vocabulary had no
  reader, was never validated against a shipped label, and covered 16 of the 61
  strings. Where the two name the same word the translations are reused.
  
  Every `en` pack value and every built-in default is byte-identical to the
  literal it replaces, so English rendering and provider-less rendering are
  unchanged — asserted row by row, in both directions, against a frozen table of
  the pre-change literals.
- 375efb4: Publish the authoring surfaces of the four GA `object-*` blocks
  
  `object-form`, `object-grid`, `object-master-detail-form` and `object-metric`
  each honoured far more keys than they declared as registry `inputs`. An author —
  very often an AI author — who wrote one of the undeclared keys got an
  `unknown-prop` report from `sdui-parser` on a key that works, while the designer
  panel and the generated `sdui-intrinsics.d.ts` denied it existed.
  
  68 keys are now declared with descriptions written to teach correct authoring:
  `object-form` +20 (record binding, button labels, post-submit behaviour, mobile
  overrides), `object-grid` +21 (sorting, pagination, grouping, selection, row and
  bulk actions, navigation, export), `object-master-detail-form` +10, and
  `object-metric` +14 (formatting, comparison, drill-down). No renderer behaviour
  changes — this documents what already shipped, so the manifest, the generated
  `.d.ts`, the designer panel and the renderers finally agree.
  
  Ten of `object-grid`'s spec-declared keys are deliberately NOT published:
  its own `@deprecated` legacy spellings (`fields`, `staticData`, `selectable`,
  `pageSize`, `showSearch`, `showPagination`, `defaultSort`, `defaultFilters`,
  `resizableColumns`, `title`). The renderer keeps reading them so existing
  documents render, but recommending a deprecated alias as new authoring surface
  would harden it into a second dialect. Each canonical replacement — `columns`,
  `data`, `selection`, `pagination`, `searchableFields`, `sort`, `filter`,
  `resizable`, `label` — is declared, and each carries a description naming the
  legacy spelling it supersedes.
- bea374e: A KPI card's sub-caption now translates from its own convention key
  
  objectui#4032 item 4. The metric card renders two authored strings, and they
  are two different authored fields:
  
  | authored field        | rendered as             | bundle key                                |
  |-----------------------|-------------------------|-------------------------------------------|
  | `widget.description`  | the shared card header  | `dashboards.<d>.widgets.<id>.description` |
  | `options.description` | the KPI sub-caption     | `dashboards.<d>.widgets.<id>.subCaption`  |
  
  Only the first resolved. The metric dispatch spread `...options` straight
  through, so the sub-caption reached `MetricWidget` as the raw authored English
  and a `zh` dashboard showed a translated header above an untranslated caption.
  
  They get two keys, not one — the objectstack#5428 item-4 ruling (2026-08-06):
  "两个作者字段两个 key". That is why PR #4358 landed items 1-3 and deliberately
  stopped here: at the time `@objectstack/spec` accepted no segment for the
  sub-caption and the only key it would take was `description`, the shared key the
  ruling forbids. objectstack#8056 added `subCaption` to the widget translation
  node, and it ships in `@objectstack/spec@17.0.0` — the version this repo pins.
  
  The server half already existed: `translateDashboard` overlays `subCaption` onto
  `options.description` on the `/meta` path, so a served document was already
  correct. This is the client half — the same key path, for the app bundles
  objectui loads into `I18nProvider` itself.
  
  - `@object-ui/i18n` gains `widgetSubCaption(dashboardName, widgetId, fallback?)`,
    mirroring `widgetDescription` limb for limb rather than re-implementing
    namespace discovery inside the plugin.
  - `DashboardRenderer`'s `tWidgetSubCaption` composes the two channels in the
    order `tWidgetTitle` already fixed — the authored value is collapsed to the
    active language first (an inline per-locale map, the `pickLocalized` seam),
    and the plain string that falls out is offered to the bundle as its fallback —
    so a bundle entry always wins over an inline map, and neither channel is
    replaced by the other. The resolved value is assigned after the `...options`
    spread in both the `object-metric` and static-value branches.
  
  The separation is pinned in both directions, because a shared key is exactly
  what a later tidy-up would reach for: the `description` key never reaches
  `options.description`, and `subCaption` never reaches `widget.description`. On a
  `kpi` / `gauge` / `bullet` widget both are on screen at once, so one shared key
  would make a single translation entry overwrite the other field's text.
  
  Untranslated dashboards are unchanged: with no bundle entry the resolver hands
  back exactly what the spread would have, and with nothing authored and nothing
  translated it answers `undefined` rather than `''`, so a card that has no
  sub-caption grows no caption row.
- e6cd3c2: Docs only: `packages/plugin-dashboard/README.md`'s TypeScript section no longer
  imports two type names that exist nowhere (objectui#5015). Every README import was
  judged against the entry module's real export surface — 20 names, read from the
  build product's `dist/index.d.ts` through the TypeScript compiler API — and every
  corrected snippet was type-checked against that same build product under `strict`.
  
  - **`DashboardSchema`** — taught as the dashboard's schema type, imported from this
    package. Not on its export surface, and not on `@object-ui/types`' either. It
    *looks* present because it occurs in three comments here
    (`src/DashboardRenderer.tsx:884`, `src/DashboardGridLayout.tsx:76` and `:88`) and
    as the name of the metadata-level Zod schema in `@objectstack/spec/ui` — an
    identifier grep hits both, an export-surface check hits neither. The authored
    type does exist under its real name, so the example is rewritten around it rather
    than dropped: `DashboardComponentSchema` from `@object-ui/types`.
  - **`MetricCardSchema`** — pure fiction: zero hits repo-wide under a word boundary,
    outside this README. There is no per-widget-family schema type at all — one
    `DashboardWidgetSchema` covers every `type`, and family-specific settings live
    under `options` — so the name could not be corrected to a sibling. The example now
    types its widgets as `DashboardWidgetSchema` and shows the three authored forms
    the type really carries: a dataset-bound KPI, a static single-value widget with
    its number under `options`, and a registered component node in the widget's
    `component` slot.
  
  The section also states what the type set does *not* cover, because the old snippet
  implied otherwise: `value`, `trend` and `trendValue` are `MetricCard`'s **component**
  props, and `DashboardWidgetSchema` declares none of the three (each measured on its
  own, since the first excess property short-circuits the rest of the diagnostic).
  `MetricCard`'s props interface is not on this package's export surface either.
  
  No export was added, re-exported or renamed to make the old names true, and the
  package's real `dashboardComponents` export is untouched. No code, types or runtime
  behaviour change — the diff is one README and this changeset. The correction reaches
  npm with the package's next publish, which is why it declares a patch: `README.md`
  is in the package's published `files`.
- 671c0d3: `packages/plugin-dashboard/README.md`: two teaching snippets did not survive being
  copied. Both were verified against the package's **build artifact**
  (`dist/index.d.ts`) — export names via the TS compiler API
  (`checker.getExportsOfModule`), each changed TypeScript block compiled against
  those same declarations under `strict`.
  
  - **The `onSchemaChange` persistence example (`TS2345` as written).** The callback
    receives a `DashboardComponentSchema`, whose `name` is optional (`BaseSchema.name`
    in `@object-ui/types`), and `client.meta.saveItem(type, name, item)` declares
    `name: string` (`@objectstack/client@17.0.0`) — so
    `saveItem('dashboard', next.name, next)` is `Argument of type 'string | undefined'
    is not assignable to parameter of type 'string'` in any `strict` consumer. This was
    the one snippet on the page marked `✅ Preferred`, directly under the paragraph
    telling readers that persistence is theirs to wire, i.e. the block most likely to be
    copied whole. It now handles the missing name explicitly (narrow, then write) and
    says why in prose: the type requires it, and what the server does with an absent
    name is **not** measured here, so the example declines to send one rather than
    guessing. No production code was touched to make the old line true — `name` stays
    optional, and the identity question for SDUI dashboard nodes stays with objectui#4600.
  - **The `Object.entries(dashboardComponents).forEach(register)` loop.** `dashboardComponents`
    is a real export, but its eleven keys are component class names
    (`DashboardRenderer`, `MetricCard`, `WidgetConfigPanel`, …), not schema types — so
    the loop registered eleven names no schema author writes, tripped the
    no-namespace deprecation warning once per key
    (`packages/core/src/registry/Registry.ts:198`), and registered none of the eight
    types this package actually claims. It did not need to: those eight are already
    registered by the side-effect import on the line above it. The section is replaced
    by the family form used for the sibling plugins — the real register-key table
    (`view:dashboard`, `plugin-dashboard:metric`, `metric-card`, `object-metric`,
    `pivot`, `object-pivot`, `dashboard-grid`, `object-data-table`, with the bare-name
    fallback rule and the two internal `object-*` wrappers named honestly), plus the
    thing the old snippet was reaching for: registering an exported component under a
    key of your own. `dashboardComponents` itself keeps only a statement of measured
    fact, with no recommended usage, because the shape of that export is under
    adjudication in objectui#5064.
  
  No code, types or runtime behaviour change — the diff is one README plus this
  changeset. It declares a patch because `README.md` is in the package's published
  `files`, so the correction reaches npm with the next release.
- e05db88: A clicked cartesian mark names its own series, and the drill title reads its label
  
  objectui#4672, objectui#4682.
  
  **The dead pivoted drill.** objectui#4680 fixed what a cartesian click could
  read out of recharts 3's `MouseHandlerDataParam`, and measured the wall it could
  not get past: a chart-level click is an AXIS interaction, and recharts
  dispatches those with `activeDataKey` hard-coded `undefined`, because the shared
  cursor spans every series at that tick. A pivoted dataset chart — 2 dimensions,
  1 measure, the shape ADR-0021 introduced — needs the series to resolve its drill
  row, so every segment of every such dashboard chart stayed a dead click. The
  series was left unresolved rather than guessed, and the card carried the rest.
  
  The answer is the mark itself. This renderer draws the `Bar` / `Line` / `Area`,
  so an item-level `onClick` closes over the very `dataKey` it was rendered with —
  the series is statically known, not inferred from tooltip state.
  
  Both handlers fire for one gesture (measured: item first, chart second, sharing
  one `nativeEvent` object), so the item handler does not emit. It RECORDS its
  series, stamped with that gesture, and the chart-level handler composes the one
  event. That is the double-fire answer and the additive property together:
  
  - **one click, one drill event**, because there is one emit site — not a second
    event suppressed after the fact;
  - **a click that lands on no mark is untouched**: it records nothing and falls
    through to the objectui#4680 axis answer exactly as shipped — category, bucket
    identity, and the series only where one series is plotted. Empty plot area
    stays category-only, and "drill the whole category" was rejected as a
    different product question. Nothing that resolved before stops resolving; a
    line's `dot={false}` stroke simply GAINS the exact series where it is hit;
  - pairing on the shared DOM event rather than on a flag means a record left by
    one gesture can never be adopted by a later click.
  
  The clicked key is forwarded exactly as rendered, `''` included: the
  empty-string second-dimension group draws its own bar since objectui#4673, and
  `''` is falsy, so a truthiness test on the way out would send no series at all
  and leave that bar's drill standing on the reader's coercion instead of on what
  was clicked.
  
  **The opaque drill title.** `ChartSegmentClickEvent` gains `seriesLabel`, and
  `DatasetWidget`'s drill drawer titles itself from `seriesLabel ?? series`.
  `ev.series` stays the LOOKUP key — `findChartSeriesRow` resolves it through the
  same assignment `buildChartSeries` made — and only the title reads the label.
  
  The two strings are equal for every ordinary group, which is why reading the key
  as a title went unnoticed. They part company when a group's label cannot name
  it: the null bucket beside a record whose stored value literally spells
  `(None)`, which is objectui#4508's collision on the series axis, reachable since
  objectui#4673. Both groups then key by `chartBucketId`, and the drawer opened on
  the right records under the title `Backlog / [null]`. An internal id where a
  label belongs reads as broken DATA rather than as a broken title.
  
  Neither string can do the other's job, which is why this is a second field
  rather than a change to the first: the label is not resolvable (it is exactly
  what the colliding groups share) and the key is not showable. `seriesLabel` is
  optional and absent wherever a renderer resolved no label, so every other
  chart's title is byte-identical.
- 5ffcc14: fix(plugin-report): forward the chart chrome and series presentation `ReportChartSchema` declares (objectui#4877)
  
  A report's embedded chart forwarded exactly six keys to the registered chart
  component — `chartType`, `data`, `height`, `isAnimationActive`, `series`,
  `xAxisKey`. Everything else `ReportChartSchema` declares as authorable never
  left the report renderer, so it was inert metadata: the author writes it, the
  schema accepts it, nothing reads it.
  
  `showLegend` was the sharpest case because dropping it does not merely ignore
  the author, it INVERTS them: `AdvancedChartImpl` computes
  `legendVisible = showLegend !== false`, so an absent value means the legend is
  on and an explicit `showLegend: false` still drew one.
  
  Now lowered, under objectui#4229's ruled data/presentation split:
  
  - chrome — `showLegend`, `showDataLabels`, `colors` (both the positional-palette
    array and the per-category record), `subtitle`, `description`, `annotations`,
    `interaction`, `height`;
  - per-series presentation — `color`, `stack`, `type`, `yAxis`, `dashArray`,
    `opacity`, `variant`, matched by `series[].name` so series MEMBERSHIP stays
    with the dataset.
  
  `title` is deliberately not forwarded: the report renderer paints it as its own
  heading above the plot, and forwarding it would draw a second one inside the
  chart's frame. `aria` is not lowered either — nothing on this path reads it
  (`AdvancedChartImpl` has no `aria` prop, and this renderer hands the component a
  schema directly rather than through `SchemaRenderer`'s flat ARIA injection), so
  forwarding it would move declared-but-unread one layer down.
  
  The two helpers (`chartConfigPresentation`, `mergeAuthoredPresentation`) moved
  from `plugin-dashboard`'s `DatasetWidget` to `@object-ui/core` beside
  `buildChartSeries`, the derivation they merge onto, so both surfaces lower one
  vocabulary once instead of keeping a second copy (the duplication objectui#4389
  filed as a defect). `@object-ui/core` additionally exports `mergeAuthoredSeries`
  — the series merge alone — for a surface whose axes are bare dimension/measure
  NAME strings rather than spec `ChartAxis` objects, which is what a report chart
  declares. `DatasetWidget` re-exports both names, so its public surface and its
  rendering are unchanged.
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

## 17.5.0

### Minor Changes

- 7084f7d: `DashboardRenderer` and `ListView` serve the props they declare — the index signature stops erasing them

  Both components declared a full props interface and neither was enforced. A `[key: string]: any` on `DashboardRendererProps` and `ListViewProps` puts `string` into `keyof Props`, so `'ref' extends keyof Props` is always true and React's `PropsWithoutRef` takes its `Omit` branch — and `Omit` over a type carrying a string index signature keeps only the index signature. Every declared property was dropped from the resolved type, on both sides: the render function received `{ [x: string]: any }` (so even `schema` was `any` inside the component), and every JSX call site was unchecked. Measured on the pre-fix source, `keyof ComponentProps<typeof DashboardRenderer>` was `string | number` and `ComponentProps<typeof DashboardRenderer>['onWidgetClick']` was `any`, while the interface went on declaring `(widgetId: string | null) => void`. `ListView` measured identically for `onRowClick`. This is objectui#4422 / PR #4438's trap in the two packages that issue left unswept.

  Graded **minor, not major**: the interfaces have always DECLARED these props; the index signature erased them from the resolved type. Restoring what the interface documents is a FIX to the published contract, not a contract break — no documented capability is removed, and `any`-typed accidental passthrough was never the documented surface. Nothing in either package's README or docs endorses relying on it.

  The props each component genuinely reads but never declared are now declared by name, at the type each one lands on: `dataSource` on both, plus `onAddRecord` / `onBulkAction` / `onPageSizeChange` / `onEdit` / `onDelete` / `onBulkDelete` on `ListView`. `DashboardRenderer`'s DOM pass-through keys are derived from `toDomProps`' whitelist constant itself, so the declaration and the runtime filter cannot drift — the "declare it and forward it by name" direction `@object-ui/core`'s `dom-props` doctrine asks for, rather than reopening the spread.

  Type-only: the emitted JS for both packages is byte-identical before and after (verified by sha256 on `dist/index.js` and `dist/index.umd.cjs`), and both packages' runtime suites are untouched and green.

  Three latent defects the erasure had been hiding are fixed with it, each surfaced by the repo-wide type-check: `DashboardWithConfig` typed its widget-select handler `(widgetId: string)` while `DashboardRenderer` calls `onWidgetClick(null)` to deselect; `InterfaceListPage` built a list schema whose `viewType` was a bare `string`; and `StudioDesignSurface` forwarded a `refreshKey` prop that no component in the chain declares or reads, so it was silently dropped. Per-package structural guards now pin the shape in both packages, covering the public `forwardRef` that takes its props whole — the spelling objectui#4438's `schema`-destructuring scan could not see.

- b8bda9a: The editable dashboard grid renders dataset-bound widgets — and says so visibly when it cannot

  `DashboardGridLayout` had no dataset path at all. It never read `widget.dataset`, never imported `DatasetWidget`, and took no `dataSource` prop — so a widget authored the way ADR-0021 says to author them (`{ id, type: 'bar', dataset: 'invoices', values: ['count'] }`) fell straight through to the static-data branch and rendered nothing. Measured on the node the grid handed `SchemaRenderer`, the silence had three flavours rather than the one reported: a `bar` became `{ type: 'chart', data: [] }` (a chart drawn over nothing), a `metric` became `{ type: 'metric', value: '—' }` (an em dash, which reads as a rendered value rather than an error), and a `table` became `{ type: 'data-table', data: [] }`. No data, no diagnostic, no path to fix — on the surface registered as the `dashboard-grid` SDUI component and exported by name from the package entry.

  This is the defect objectui#4612 fixed for the RETIRED authoring shape, one level up: same surface, same silence, but the shape that is current. The sibling `DashboardRenderer` has routed these widgets through the governed `queryDataset` path since ADR-0021, so the cure is that surface's own mechanics rather than a second dispatch idiom — the `datasetBound` predicate decided per widget, and `DatasetWidget` picked at the render site.

  `DashboardGridLayout` therefore gains an optional `dataSource` prop, forwarded to `DatasetWidget` for dataset-bound widgets. A dataset-bound metric now also takes the shared `Card` wrapper, matching the sibling: `DatasetWidget` renders just the value, so without the card it would show as bare text with no title beside its neighbours.

  A dataset-bound widget arriving with NO data source renders a visible state, never a blank. No new placeholder was declared for it: `DatasetWidget`'s own no-capability rendering — an alert reading "This data source does not support dataset queries." — was measured to render visibly when handed no adapter, so routing through it unconditionally cures both halves with one diagnostic and one wording. That case is not hypothetical: `dashboard-grid`'s SDUI registration declares only `title` and `className` inputs, so schema-driven hosts render this component with no adapter at all, and every such host keeps working exactly as before.

  Nothing else moves. The objectui#4612 legacy sentinel keeps its position and its verdict — the two conditions are mutually exclusive by construction, since the shared detector returns false the moment a widget carries `dataset` — and static-data widgets, `options.data` provider widgets and legacy-retired widgets all render as they did and never reach the dataset query. The new prop is additive and optional, so existing call sites are untouched.

- 8640cec: One legacy detector, two dashboard surfaces — the editable grid stops rendering a silent blank chart

  framework#3320 retired the pre-ADR-0021 inline-analytics widget shape (top-level `object` + `categoryField` / `valueField` / `aggregate`, pivot `rowField` / `columnField`) and shipped a graceful fallback for the stored metadata that still carries it: a visible tile reading "This widget uses a retired data format. Edit it to bind a dataset." The fallback was applied to `DashboardRenderer` and to nothing else. `DashboardGridLayout` — separately exported, and registered as the `dashboard-grid` SDUI component — had no sentinel at all, so the identical stored widget fell through to its static-data branch with `data: []`. Same metadata, same product, two different outcomes: a rebind prompt on one surface, a silent blank chart on the other. The blank is worse for the author than the pre-retirement state, because it carries no chart, no diagnostic and no path to fix — the exact outcome the retirement's own test header says must not happen.

  The fix is not a second copy of the condition, because one copy is why the defect existed. The detector and the placeholder now live in a single module (`legacyRetiredWidget.ts`) that both surfaces import; `DashboardRenderer`'s observable behaviour is unchanged, pinned by its existing suite, and the new grid suite mirrors that suite's structure on the surface nobody had pinned. Four positive cases go from blank to placeholder, two of them the widget shapes stored byte-for-byte in the schema catalog's `filtered-dashboard` entry.

  The negative controls are the load-bearing half, because the retired shape is one character away from a live one. `options.data = { provider: 'object', … }` carries its OWN nested `object` and `aggregate`: it is a different, still-live authoring surface, read off the widget's data rather than off the widget top level, and it keeps rendering untouched — as do dataset-bound widgets and static-data widgets, on both surfaces. `DashboardRenderer`'s pivot arm stays deliberately surface-local rather than shared: it returns the placeholder for the entire pivot family because that surface emits no pivot block at all, which is a fact about what it can draw, not about the widget being legacy. The grid does draw pivots, from static data and from the provider config, so exporting that arm would have retired two working branches. A legacy pivot is caught on both surfaces by the shared sentinel instead, via the top-level `object` it carries.

- f244273: `MetricWidgetProps` / `MetricCardProps` declare the DOM pass-through their spread has always accepted

  Both KPI components end their prop list with a `...domProps` spread onto the Shadcn `Card`, and objectui#4357 (PR #4428) kept that spread deliberately — it is their only accessibility pass-through, and removing it would delete the only way a host can put an `id`, a `role` or an `aria-label` on a KPI card. Neither props interface declared any of it. So the type refused what the runtime accepted: a JS consumer, and every SDUI author going through `SchemaRenderer` (untyped at that boundary), got the pass-through, while a TypeScript consumer importing the component directly got `error TS2322` on `id` / `role` / `aria-label` and needed a cast.

  `MetricWidgetProps` now extends `React.HTMLAttributes<HTMLDivElement>`, and `MetricCardProps` extends the same minus `title`. That is the repo's measured convention for an exported props interface that spreads onto a host element (`PageHeaderComponentProps`, `ChatbotProps`, `ChatbotEnhancedProps`, `TypingIndicatorProps`, `RefreshIndicatorProps`, `FieldProps`, and shadcn's `BadgeProps`), and the `Omit` carve-out is `ComboboxProps`'s spelling for a name the component's own contract owns.

  Graded `minor` rather than `patch` per the objectui#4403 precedent: two exported interfaces widen. The widening is purely additive for existing callers — every prop that compiled before still compiles, and nothing narrows — so no source change is required to upgrade.

  Semantics worth knowing, because both are contract statements rather than incidental:

  - **`MetricCard.title` stays the heading.** HTML's `title` is a tooltip; this card's `title` is its heading, in the `I18nLabel` vocabulary, destructured out and rendered into `CardTitle`. No `title` attribute has ever reached this element, so the inherited DOM `title` is omitted rather than declared and silently dropped — the "declared but not delivered" failure this repo treats as first-class (objectui#3290, objectui#3222). `MetricWidget` has no such collision (its heading is `label`) and extends the DOM attributes whole.
  - **`MetricWidget.onClick` stays zero-arg**, narrower than the inherited `MouseEventHandler`, because the same handler is wired to Enter/Space where there is no mouse event to hand over. A zero-arg function is assignable to the inherited signature, so callers already passing `(e) => …` keep compiling.

  Not declared, deliberately: the schema-shaped keys `SchemaRenderer` injects (`schema` / `bind` / `events` / `props` / `ariaLabel` / `ariaDescribedBy` / `dataSource`). None is an HTML attribute name, all seven are destructured out before the spread, and declaring them would re-assert as public contract exactly what PR #4428 stripped from the DOM. They stay in `SchemaHostProps`, intersected in at each component's own signature — accepted so the renderer can inject them, never part of the documented authoring surface.

  Zero runtime change: no component body was touched, and PR #4428's pins pass untouched.

- c1d939f: One `SchemaNode`, and one label vocabulary — the union wins, and labels resolve where the locale lives

  Two packages published a type called `SchemaNode` and they were not the same type. `@object-ui/core` hand-declared `interface SchemaNode { type: string; … [key: string]: any }`; `@object-ui/types` exported `type SchemaNode = BaseSchema | string | number | boolean | null | undefined`, whose own doc comment names `'Plain string'` a valid node. Both were exported under one name from packages the same consumers import together, so which declaration a call site got depended on which package it happened to import from — #4548's canary measured 19 of 35 errors as exactly that collision. Core's declaration is now a re-export of types', so there is one declaration left to disagree with. Core's entry surface is unchanged: `dist/index.d.ts` is byte-identical across the change.

  Reconciling it exposed a real defect rather than a mechanical narrowing, which is why the first attempt was withdrawn instead of forced. The spec bridges write `spec.label` — the spec's `I18nLabel`, an INLINE locale map like `{ en: 'Owner', 'zh-CN': '负责人' }` — into `node.label`, and `BaseSchema.label` declared `string`. Under core's old index signature that assignment was invisibly `any`; under one honest `SchemaNode` it is a type error. `BaseSchema.label` and `.description` therefore now accept `string | I18nLabel`, and the two bridge assignments compile with their expressions untouched.

  Resolution happens at READ time, in the renderer, against the display locale — not at the bridge. Resolving at the bridge was measured unimplementable: it is a plain class method that cannot call a hook, `BridgeContext` declares no locale, and `updateContext()` has zero callers, so a bridge-resolved label would freeze one audience's language into the node tree with no re-translation channel. React's own invalidation re-translates for free at the read site.

  The widening turned every blind `schema.label`-as-string read into a named compiler error, and that inventory is the audit: it named four sites repo-wide, all one class — the label reaching a React child position, where a map does not render as `[object Object]` but THROWS `Objects are not valid as a React child`, failing the whole subtree. Three are `@object-ui/components` renderers (`filter-builder`, `sidebar-group`, `dropdown-menu`), which now resolve with the spec's own `resolveI18nLabel` against `useDisplayLocale()`. The fourth is `plugin-dashboard`'s `DashboardGridLayout` heading, which resolves with `pickLocalized` against the active UI language — matching the widget-title resolution already in that same component rather than putting two resolvers and two disagreeing locale channels in one render; the two resolvers are limb-for-limb twins with a parity test pinning them.

  One interface now carries both label vocabularies two properties apart — `label`/`description` are the spec's INLINE map, `ariaLabel` is the KEYED bundle reference — and each accepts the other's shape vacuously. That confusability is objectui#4167's known hazard, inherent to the spec's `I18nLabel` design; both shapes are named with cross-referenced doc comments stating which resolver owns which slot, and a pin asserts the two unions do not collapse into each other.

  Finally, the spec bridges declare their return type as `BaseSchema` instead of the union. Both bridges end in a single `return node` on an object literal, so the union described nothing real while forcing a narrowing at every read — 272 mechanical errors across five suites in the first round. That change is a type annotation only; the emitted JavaScript is byte-identical.

- 36310dc: `formatPercent` groups its output and follows the display locale — the last
  tooltip/cell channel (objectui#4553).

  PR #4557 threaded the gantt tooltip's number and currency rows and measured that
  the percent row could not follow: `formatPercent(value, precision)` took no
  locale parameter, and its whole body was
  `${percentDisplayValue(value).toFixed(precision)}%`. It built no
  `Intl.NumberFormat` and never reached `formatDisplayNumber` — so unlike its
  siblings it did not render in the MACHINE's locale, it rendered in **no** locale:
  an ASCII decimal mark, never a grouping separator, byte-identical on every
  machine.

  **English output MOVES, and that is the fix.** Because the function never
  grouped, `1235%` was wrong in en-US too, not only in German. Grouping and locale
  therefore land together:

  |            | before  | after          |
  | ---------- | ------- | -------------- |
  | en, 1234.5 | `1235%` | `1,235%`       |
  | de, 1234.5 | `1235%` | `1.235\u00a0%` |
  | de, 80     | `80%`   | `80\u00a0%`    |

  Values below the grouping threshold are unchanged in English (`80%`, `12.5%`,
  `33.33%`), so the move is confined to four digits and up. German changes at every
  magnitude, because the no-break space before the sign is part of the locale's
  percent convention — which is what routing through `Intl` buys over appending a
  literal `%`.

  The scaling contract is untouched: `percentDisplayValue` still disambiguates a
  fraction-stored percent (`0.8` → 80%) from a whole one, so the list cell and the
  dashboard measure formatter still agree.

  Consumers are threaded in the same change, the parameter never landing
  speculatively:

  - **fields** — `PercentCellRenderer`, on BOTH of its paths. Its whole-percent
    branch (`progress` / `completion` fields, which store 0-100 and must skip the
    fraction scaling) was a second bare `toFixed` call; leaving it behind would
    have made one grid internally inconsistent, so both branches now share one
    locale-aware body and differ only in the scaling policy.
  - **plugin-gantt** — the tooltip percent row, completing objectui#4553's switch.
  - **plugin-grid** — the mobile card's percent cell, which sits in the same
    density row as a date cell objectui#4272 had already localized.
  - **plugin-dashboard** — `renderFieldValue`'s percent branch. It is a plain
    function rather than a component, so it takes the locale as an optional fourth
    parameter beside the `tenantCurrency` already threaded that way, and both of
    its callers pass it and declare it in their memo dependency arrays.

  Bumps follow each package's own `.d.ts` diff, measured in both directions.
  `@object-ui/fields` and `@object-ui/plugin-dashboard` are `minor` on the
  objectui#4272 / PR #4544 precedent — quoted from that changeset: "`@object-ui/fields`
  is `minor` because `formatDateTime`'s new optional parameter is visible in the
  package's entry `.d.ts`; the plugin packages' own `.d.ts` files are
  byte-identical, so their change is module-local." Here `formatPercent` and
  `renderFieldValue` each gain an entry-visible optional parameter, while
  plugin-gantt's and plugin-grid's `.d.ts` files are byte-identical and stay
  `patch`.

### Patch Changes

- ee26e65: Analytics: the dimension label net's fetch-and-memo glue is written once, not once per surface

  PR #4388 (objectui#4330) put the same React glue on two surfaces — the dashboard's `DatasetWidget` and plugin-report's dataset block. The resolution RULES were never duplicated (both call the same `@object-ui/core` helpers), but the wiring around them was: read the object schema through the host's authenticated `apiFetch`, keep the fetched metadata locale-free in state, derive the label maps in a render memo. Two copies meant two statements of the same two bug fixes, which is a drift surface rather than a defect — nothing a user could hit today, filed as objectui#4389 so it was retired deliberately.

  It is now split along the layer that can actually hold each half. `@object-ui/core` gains the React-free parts — `loadDimensionFieldMeta` (the base-object read composed with the dimension walk), `deriveDimensionLabelMaps` (the locale-applying derivation) and `dimensionOptionTranslator` (binding the bundle resolver to the object that OWNS a terminal field, which for a dotted path is the relationship target). `@object-ui/react` gains `useDatasetDimensionLabels` / `useDatasetDimensionMeta`, the React wiring that cannot live in core, beside the `useViewData` / `useElementDataSource` / `useDiscovery` hooks that already read `SchemaRendererContext` the same way. Both plugins consume it; the dashboard keeps its chart-only per-category colour and category-order derivation layered locally, since a table renders no palette.

  The card originally proposed `@object-ui/core` as the whole glue's home. That home was disproven by measurement and retired in the card's PM RULING #2: `SchemaRendererContext` is defined in `@object-ui/react`, which depends on core, so core importing it back is a cycle — and core is React-free by declaration, by content, and by the topology in AGENTS.md. objectui#3367 had already ruled this direction for the same family (core-canonical logic, react re-exports).

  Behaviour is unchanged by construction: same read count, same best-effort fallback, same memoization boundary. The two bug fixes are now stated once and pinned at the shared hook — the read rides the host's authenticated `apiFetch` (objectui#4121, pinned by asserting that a new channel re-issues the read, i.e. that it really is in the effect's deps), and the fetched metadata stays locale-free (objectui#4030 / PR #4324, pinned by switching language at runtime and asserting the labels flip with no second metadata read). All 39 assertions PR #4388 landed across both surfaces pass unchanged, and their files are byte-identical to before.

- 5900ac5: Analytics surfaces now run resolved select-option labels through the locale bundle — the chart legend and the related list on one page stop disagreeing

  A dashboard widget grouped by a `select` field rendered the option's authored English label while the related list beside it rendered the translation. The decisive evidence in objectui#4030 is the stored value `orion`: the chart read `Orion Engineered Carbons`, a string with no resemblance to the value and matching the object's `label` byte for byte. So the analytics path had already RESOLVED the option label — it simply never ran the result through the i18n bundle before display. (`domestic → Domestic` differs from its value by case alone, which is why the first diagnosis, "the report groups by stored value", was wrong.)

  There is exactly one resolution channel and this change reuses it rather than adding a chart-side dialect: `fieldOptionLabel` from `useObjectLabel`, i.e. `{ns}.fieldOptions.<object>.<field>.<value>` — the convention `@objectstack/spec` names objectui as the reader of, and the one list, form, kanban and record-picker surfaces already translate select options through. The bundle is applied ONCE, at the output of the label net that landed in objectui#4053/#4263, on the shared option list every consumer reads: chart axis and legend, the table/pivot cells of a dotted dimension, that table's CSV export, per-category colours and the declared category order. `@object-ui/core` gains `localizeFieldOptions` (the pure mirror of `translateOptions`), an optional translator on `buildDimensionLabelMap`, and `resolveDimensionFieldMeta` — the same single relationship walk `resolveDimensionFieldOptions` performs, now keeping the object that OWNS the terminal field, because for `crm_account.industry` the bundle key is `crm_account`, not the dataset's base object.

  Two properties the fix is shaped around. The rows reach this net keyed either way — by stored value when the server did not resolve the dimension, by the English label when it did (ADR-0021) — and the reported screen is the second case, so the map answers to both keys and lands on the same translated display. And identity is untouched: `relabelDimensions` still rewrites display only, so a drilled chart segment clicked as `欧励隆` filters by `orion`, bucket ids and pivot totals keep their raw keys, and an option with no bundle entry (or an `en` console) renders exactly the authored label it renders today.

  The per-locale work moved from the metadata fetch into the render, so switching language now re-labels in place instead of waiting for a refetch.

  Not covered, and unchanged here: a LOCAL select dimension on a table/pivot, whose label the server resolves and whose client-side net is deliberately off (objectui#4263), and a dashboard global filter's own field label, which has no object name in its metadata to key a bundle lookup with — tracked on objectui#4030.

- 3c6e84c: Dashboard `combo` widgets draw as combos on the dataset path — the dataset owns the data, the author owns the presentation

  A widget authoring the spec's own combo shape — `series[].type` plus `series[].yAxis: 'left'|'right'` and two `yAxis` entries — rendered as two bar series on one shared axis. Measured in the DOM: 2 bars, 0 lines, 1 y-axis, where 1 bar, 1 line and 2 axes were authored, so a percentage measure was plotted against a raw count's scale.

  Two halves caused it, and fixing either alone leaves a worse state than before. `CHART_TYPE_MAP` had no `combo` entry, so a `combo` widget fell through its `?? 'bar'` default — bars, whatever the series said. And `chartConfigPresentation` refused to forward `series` / `xAxis` / `yAxis` at all, on the stated grounds that they are derived from the dataset selection, so the per-series mark and the axis binding could never reach the renderer even once the family resolved.

  That belief was half right. The dataset does own the series MEMBERSHIP — which columns become series, which rows, which buckets — and it still does: an authored entry naming a measure the dataset did not select is ignored, and a derived series the author said nothing about keeps the family default. What the dataset never owned is the PRESENTATION carried on those same objects: the per-series mark, its left/right axis binding, label, colour, stack, and the axis definitions' title, format, min, max, step, grid and position. Those are the author's, and they now merge onto the derived bindings by name/key match with the explicit binding winning — one merge function, not a spread per attribute. The split runs through the two binding keys: `ChartSeries.name` and `ChartAxis.field` name a column and stay with the dataset; everything else on the object travels.

  This is objectui#2880's S2 rule, which PR #2883 landed in `ObjectChart` and which the dataset path never carried over. Dropping `ChartAxis.field` on the way through is what makes forwarding the axes safe rather than merely guarded: it is the one key by which an authored axis could have named a series, since the renderer synthesises series from `yAxis[].field` when a chart declares none.

  Two consequences beyond the reported bug. A non-combo widget can now declare one line series and get the combo the renderer already knew how to derive from disagreeing series types. And a `compareTo` overlay inherits its own measure's mark and axis, so the comparison of a bar-on-the-left measure no longer draws as a line on the right the moment the chart becomes a combo.

  Dashboards that never authored `chartConfig.series` or `chartConfig.yAxis` emit exactly what they emitted before.

- 0bf3f44: `DashboardRenderer`'s widget grid now passes only whitelisted DOM props to its container (objectui#4432)

  `view:dashboard` resolves to this component, so `SchemaRenderer` handed it the dashboard node's own keys, the contents of the node's `props` container, the ARIA it resolved and the host's trailing props — and every key the component did not destructure was spread raw onto the grid container. React writes unknown lowercase attributes through in silence and stringifies object values, so the failure was invisible. Measured through the real SDUI path: **13 non-DOM attributes**, including `events="[object Object]"`, `props="[object Object]"` and a camelCase `arialabel` sitting next to the resolved `aria-label`, so the element carried each ARIA value twice under two spellings — one of them meaningless to assistive technology.

  The container is now consume-or-whitelist per objectui#4425 phase 2: only `toDomProps`' output reaches the element, and it is spread FIRST so the component's own computed attributes stay authoritative. The resolved `aria-label` / `aria-describedby`, `role`, `id`, `tabIndex`, `className` and the `data-*` family still arrive — dropping them would have been an accessibility regression dressed as a leak fix, so the new pin asserts the delivered set exactly, not just the absent one. Both layout branches are covered: the responsive desktop grid and the mobile stack spread the same props onto the same host element.

  Three behaviours move with the spread, all of them consequences of a trailing spread that used to override the component's own computed props:

  - **`onClick` now has one carrier.** It is a declared DOM pass-through key AND this container computes a design-mode background handler, and the old spread let the incoming handler replace the computed one — so a host that passed `onClick` silently lost background deselection. Both run now, container affordance first. An authored non-function `onClick` (SDUI spells click behaviour `events: { onClick }`, which is data and is dropped) is ignored instead of handed to React, which used to throw on it.
  - **An authored `style` no longer replaces the computed grid layout.** `style` is not in the SDUI pass-through set, and this container computes its own `gridTemplateColumns` / `gridAutoRows` / `gap`; an authored `style` used to overwrite all of it and collapse the grid.
  - **An authored `data-user-actions` no longer overrides the value computed from the `userActions` prop.** The `data-*` family still passes the whitelist; only this one collision with a computed attribute resolves the other way now.

  The injected `disabled` verdict is also dropped rather than forwarded. Nothing in this component ever read it: it only became a `disabled` attribute on a container element that has no such attribute, which is the leak, not a behaviour.

- eb7f586: Dashboard dataset measures follow the display locale (objectui#4566).

  `formatMeasure` and `formatDimensionValue` in `@object-ui/core` formatted every
  value with a bare `undefined` locale tag at all three of their `Intl` sites.
  `undefined` is not "the user's locale", it is the MACHINE's — neither of the
  repo's two locale channels. A German session read a dashboard KPI as `1,234.5`
  next to a grid cell rendering the same number as `1.234,5`, and inverted
  separators read as a different number, not as an unstyled one.

  Both functions take the display locale as a new OPTIONAL LAST parameter, and
  `DatasetWidget` threads `useDisplayLocale()` into every site it formats through:
  the KPI, the grouped table's measure and dimension cells, and the cross-tab's
  header labels and cells.

  **English output does not move**, and that is the discriminator against the
  sibling fix. These sites already went through `Intl` with default grouping, so
  the only thing that changes is WHOSE locale is used:

  |                   | before      | after                 |
  | ----------------- | ----------- | --------------------- |
  | en, 1234.5 `0.0`  | `1,234.5`   | `1,234.5` (unchanged) |
  | de, 1234.5 `0.0`  | `1,234.5`   | `1.234,5`             |
  | de, 1234.5 EUR    | `€1,234.50` | `1.234,50 €`          |
  | de, 0.6083 `0.0%` | `60.8%`     | `60,8%`               |

  Contrast objectui#4553, where `formatPercent` had never grouped at all and
  moving en `1235%` → `1,235%` WAS the fix.

  Omitting the new argument reproduces the previous output byte for byte, so
  callers that do not thread a locale yet are unaffected.

  Two behaviours are deliberately preserved rather than "improved" alongside the
  locale fix, both measured:

  - **Integers stay verbatim.** The integer branch renders no separator and no
    decimal mark, so a locale has nothing to change there — and routing it through
    `Intl` WOULD change it (a locale with its own numbering system re-digits it,
    and `1e21` expands to 22 digits).
  - **The percent sign stays a literal suffix.** `Intl`'s `style: 'percent'`
    re-scales by 100, and that round trip loses precision at the top of the range
    (en `100,000,000,000,000,000,000,000%` becomes
    `99,999,999,999,999,990,000,000%`). The consequence — a German list cell
    writing `1.234,5 %` with a no-break space where a dashboard measure writes
    `1.234,5%` — is filed separately rather than smuggled in behind a locale fix.

  `@object-ui/core` is `minor` because two of its ENTRY exports gained an optional
  parameter (measured in the built `.d.ts`). `@object-ui/plugin-dashboard` is
  `patch`: its published declarations are unchanged — `buildPivot`'s new optional
  parameter is internal, as that function is not on the package's `exports`
  surface.

- 54d34d2: A dashboard chart's null-value bucket now reads the app's language instead of the English `(None)`

  `buildChartSeries` groups rows whose category value is `null` under a labelled bucket, so the group draws as a bar instead of vanishing off the axis (objectui#4466). The label comes from the caller: `@object-ui/core` is React-free, cannot read the locale bundle, and falls back to the English constant `(None)`. `ObjectChart` passes its resolved label and localizes; `DatasetWidget` called the same helper with no options, so a dashboard widget in a zh app labelled the bucket `(None)` while the standalone chart one panel over labelled it `(未指定)`. It now passes `chart.nullCategory` from the i18n channel, which every locale pack already carries.

  The same label goes to `findChartSeriesRow`, and that half is what keeps the bar clickable. That helper is the inverse map behind segment-click drill-through: it compares the clicked category against its own copy of the bucket label, defaulting to the same English floor. Passing the localized label to only the forward call would draw a bar reading `(未指定)` while the drill matched `(None)` — the click resolves to no row and the drawer never opens, which is a worse outcome than the untranslated word this fixes. Both calls now read one binding, so they cannot drift apart.

  Nothing else moves: non-null categories chart and drill exactly as before, an `en` app still reads `(None)` (now via its locale pack rather than the hardcoded floor), and a widget over data with no null group is untouched.

- ee7a68d: `DatasetWidget`'s option-color / dimension-label probe now rides the host's
  authenticated fetch (`SchemaRendererContext.apiFetch`) instead of the bare global
  `fetch`.

  The one metadata read the effect makes — `GET /api/v1/meta/object/{object}` — went
  out on the global `fetch`, so in a hosted console it skipped whatever the host
  supplies on that channel (Authorization / tenant headers, base-URL rewrite,
  draft-preview params). A bearer-token session carries its credential in a header
  rather than a cookie, so `credentials: 'include'` alone left this read
  unauthenticated. The effect is best-effort and swallows every failure, which made
  the symptom silent: a dataset chart's semantic per-category colors and its
  dimensions' value → label maps simply never applied, and the widget fell back to
  the positional theme palette and the raw stored values on the axis.

  Standalone embeds are unaffected — with no provider (or a provider that supplies no
  `apiFetch`) the probe still uses the global `fetch`, the same documented fallback
  `useRecordEditable` and `provider: 'api'` view sources use.

  This is the `plugin-dashboard` twin of the same fix made to `plugin-charts`'
  `ObjectChart`.

- 436681e: fix(dashboard): resolve a dotted dimension's labels on table and pivot dataset widgets

  A dataset widget's client-side dimension-label safety net returned early for
  `table` / `pivot` / metric widgets, so a DOTTED dimension (`crm_account.industry`)
  rendered the raw stored enum (`education`) there — the same symptom objectui#4053
  fixed for charts, on the widget types its fix did not reach.

  The early return stays for LOCAL dimensions, which is what made it correct in the
  first place: on a table the server resolves those labels (ADR-0021), so running
  the client net for them would be a second resolution of an already-resolved
  value. It now opens only for dotted paths — the case the server is silent on too —
  reusing the existing `resolveDimensionFieldOptions` walk unchanged, multi-hop
  paths included. A table with no dotted dimension resolves nothing and issues no
  metadata read at all, so those widgets render byte-identically.

  A pivot's marginal totals take the same relabel as its rows, because their bucket
  ids are re-derived from the dimension values that the headers are built from; the
  CSV export follows the table's cells for the same reason. Drill-through still
  filters by the stored value — the relabel preserves row order and count, so the
  raw rows it indexes stay aligned.

  Metric widgets are unaffected by design: that branch renders one measure value
  and its header label and puts no dimension value on screen, so it has nothing to
  resolve.

- 613b167: A dataset dimension on a dotted relationship path now renders its option labels instead of the raw stored enum

  A `DatasetDimension` whose `field` is a relationship path (`crm_account.industry`) got no select-option resolution at all: the chart plotted `education`, `finance`, `manufacturing` — the database column, unresolved — while the **same underlying field** reached as a **local** dimension rendered `Education`, `Finance`, `Manufacturing` beside it on the same dashboard. Nothing errored, so the widget just quietly showed database enum values to end users; on a non-English deployment those are words that appear nowhere else in the UI, since every form and list shows the translated label.

  The label lookup read options as `baseObject.fields[<path>]`, which only ever matches the local spelling. For a dotted path the options live on the **related** object, so the lookup missed and the renderer fell through to the stored value.

  The object-resolution step of that one lookup now walks the path: each segment before the last must be a declared relationship (`lookup` / `master_detail`, target read from `reference` / `reference_to` / `referenceTo` / `reference_to_object`), and the terminal field's options are read off the object that actually owns it. This is the same lookup for both spellings rather than a dotted-path variant beside it — a single-segment path never enters the walk and resolves exactly as before, so the local and joined paths cannot drift apart. Multi-hop paths (`crm_account.owner.department`) resolve too, which is the shape the dataset designer already emits.

  Hops ride the caller's existing `GET /meta/object/:name` channel — the same authenticated read that fetched the base object — so no new fetch layer is introduced, and objects are fetched once per resolution even when several dimensions share a prefix. Every failure stays best-effort: a segment that is not a relationship, a target that cannot be loaded, or a terminal field with no options yields no mapping and the raw value survives, exactly as it does today.

  Applies to both surfaces that carried this lookup: dashboard dataset widgets (`DatasetWidget`) and the chart view's dataset path (`ObjectChart`).

  Scope: this ends at "the label is in hand". Whether that label then passes through the i18n bundle is a separate gap tracked upstream as objectstack#5076.

- bb68488: An inline per-locale label now renders its locale's string at the thirteen read sites the `@objectstack/spec` 17.0.0-rc.6 bump exposed

  rc.6 widened `I18nLabel` from `string` to `string | Record<string, string>`, so an author may write `label: { en: 'Owner', 'zh-CN': '负责人' }` anywhere the spec accepts a display label. PR #4169 repaired eight such sites; these thirteen were invisible to it because the five packages involved build through vite/rolldown, so `turbo run build` never type-checks their sources — only `turbo run type-check` does. All thirteen are now resolved through a shared resolver against a real locale, and `turbo run type-check` is 78/78 with zero errors.

  | package                       | what an author can now write and see                                                    |
  | ----------------------------- | --------------------------------------------------------------------------------------- |
  | `@object-ui/layout`           | `NavigationArea.label` — the sidebar area switcher's button and its tooltip             |
  | `@object-ui/plugin-list`      | `ViewTab.label` — the inline pill row, and the mobile dropdown's trigger and menu items |
  | `@object-ui/plugin-dashboard` | `DashboardWidget.title` — the widget card heading and its `title` attribute             |
  | `@object-ui/plugin-designer`  | `DashboardWidget.title` — the widget card and the preview tile                          |
  | `@object-ui/app-shell`        | `ActionParam.label` **and** each `ActionParam.options[].label`                          |

  **Patch, not minor, in every case: no public surface changes meaning.** Every entry above is a read site that previously could only be reached with a value the type system rejected, so no caller's working code changes behaviour. `@object-ui/app-shell` is the only package with an exported-type change and it is purely additive on the authoring side — `RawActionParam.label` and `RawActionParam.options[].label` widen to `I18nLabel` (they accept strictly more), `ResolveActionParamsContext` gains an optional `locale`, and the new `RawActionParamOption` names the authoring shape that was previously spelled with the resolved one. What `resolveActionParams` **emits** is unchanged: `ActionParamDef.label` and its options' labels are still plain `string`s.

  Two consequences worth knowing:

  - **The dashboard designer's title input is deliberately read-only for a map-valued title.** Resolving a per-locale map into a single-line input and writing `e.target.value` back would collapse every other locale on the first keystroke, so the write is guarded and an inline map survives an unrelated edit-and-save round trip untouched — the same conservative branch #4169 took for `DashboardWidgetInspector`. What Studio should actually offer for authoring a per-locale label is objectui#4163 part 2, which is unclaimed and pending design.
  - **`@object-ui/layout` resolves at the spec's `en` default, not the viewer's language.** That package carries no i18n dependency by design (its whole i18n story is injection), and `AppSchemaRendererProps` exposes no locale to thread. The choice and what would change it are documented at the call site.

- 326a70f: Analytics: a LOCAL select dimension on a table / pivot widget — and on a dataset-bound report — now renders its option label through the locale bundle

  A dashboard table grouped by a select field showed `Domestic` on a zh-CN console while the related list on the same screen showed 国内. The value was never untranslated by accident: the server resolves that dimension's display label (ADR-0021) and hands the row over carrying the object's AUTHORED English label. The locale bundle is keyed by the option's stored VALUE (`{ns}.fieldOptions.<object>.<field>.<value>`), so translating one needs the option LIST — and the table path deliberately loaded no object metadata at all, which is why objectui#4030 / PR #4324 fixed charts and dotted dimensions and left this half open.

  Table, pivot and the dataset report block now take the one metadata read that gives the bundle something to translate against, and feed it to the SAME seam #4324 landed (`resolveDimensionFieldMeta` → `localizeFieldOptions` / `buildDimensionLabelMap` → `relabelDimensions`). No second resolution dialect: the map carries both the stored value and the authored label as keys, and the relabel is value-wise and idempotent, so a value the server already resolved lands on the same display it would have from the raw value. Cells, pivot headers on both axes, the server's marginal totals, the CSV export and a report's embedded chart all read the one map, which is what keeps a subtotal's bucket lookup meeting the header it belongs to.

  Untranslated apps are unchanged by construction: with no bundle entry the display equals the authored label, no key is emitted, and the rows come back by identity. Identity keys stay untranslated — a drilled row or cell still filters records by the values the server sent, and measures still export as bare numbers.

  This deliberately amends the acceptance boundary objectui#4263 landed ("a local-only table issues no metadata read"), which was ruled for label RESOLUTION before the read had a second consumer. The pins that stated it are rewritten in place, in the same change, and say so.

- 7e4f0e5: fix(dashboard,i18n): KPI cards and dashboard filters resolve authored labels instead of dropping them (#4032)

  A `type: 'metric'` dashboard widget rendered raw English while every other widget
  type on the same dashboard rendered the translation, and dashboard filter chips
  rendered `[object Object]` or the raw stored value. Both come from the same
  cause: authored labels reaching a render site that could not read the
  vocabulary `@objectstack/spec` actually admits.

  - **KPI cards rejoin the widget translation channel.** The self-contained
    `metric` branch built its own label from the raw `widget.title`, so the
    `{ns}.dashboards.{dash}.widgets.{id}.title` value the renderer had already
    resolved was computed and thrown away. It now reads that channel like every
    other widget header.
  - **The three private `resolveLabel` copies** (`DashboardRenderer`,
    `MetricWidget`, `MetricCard`) are gone. Each read the retired
    `{ key, defaultValue }` key-reference form and ended `defaultValue || key`, so
    handed the inline per-locale map the spec admits today they returned nothing —
    a KPI card with a map title rendered the literal string `metric`. All three
    now use `pickLocalized`, the resolver already used for this vocabulary
    elsewhere in the package.
  - **Dashboard filter labels and static option labels resolve per locale.**
    `DashboardFilterDef.label` widens to `string | I18nLabel`, the filter bar
    resolves before rendering (fixing `[object Object]: All` in the trigger, and
    in `aria-label` / `placeholder`), and the `def.label || def.name` gate now
    tests the RESOLVED string — an object is always truthy, so it never reached
    the fallback before.
  - **Option labels are no longer discarded.** `normalizeFilterOptions` coerced a
    map label to the raw stored value in every locale, English included, so
    `{ value: 'domestic', label: { en: 'Domestic', … } }` displayed as `domestic`.
    The pair shape is still normalized; the label vocabulary is preserved for the
    render side to resolve.
  - **`DashboardComponentSchema.globalFilters` is bound to the spec's
    `GlobalFilter`** instead of restated by hand. The restatement was both too
    narrow (`label?: string`, which is what made these read sites invisible to
    `tsc`) and too wide (it declared a bare-string option shorthand the spec
    rejects at publish).

  Plain-string labels are unaffected and render byte-identically.

- 306c101: KPI cards no longer write their own schema onto the DOM — `MetricWidget` and
  `MetricCard` keep `SchemaRenderer`'s schema-shaped props out of the `...props`
  spread (objectui#4357).

  Both components are two things at once: an SDUI block reached through
  `SchemaRenderer`, and a plain React component a host may render directly. The
  React half wants a `...props` spread on its root so callers can pass `aria-*`,
  `data-*`, `id`, `role`. The SDUI half means that spread also received the node's
  own metadata — and React writes unknown lowercase attributes straight to the DOM,
  stringifying object values. Every KPI card therefore carried
  `schema="[object Object]"`, and a widget authored with events, a binding or a
  props container carried `events="[object Object]"`, `bind="data.revenue"` and
  `props="[object Object]"` beside it.

  Seven props were measured arriving at the call site that are not HTML attribute
  names — `schema`, `events`, `props`, `bind`, `ariaLabel`, `ariaDescribedBy` (the
  last two are the camelCase authored forms of ARIA the renderer already emits in
  their dashed spelling) and `dataSource`. They are destructured out; the spread
  survives untouched for everything that IS a DOM attribute: `id`, `name`, `role`,
  `disabled`, `aria-*`, `data-*`, `className`. Nothing else about the render moves
  — no text, no class, no element.

  `dataSource` is the one that only a live dashboard shows. It is not a schema key
  (the renderer strips the schema's own `dataSource` binding by name); it is the
  injected adapter `DashboardRenderer` hands its `SchemaRenderer` call, which
  arrives through the renderer's trailing props. Every fixture in this package
  renders without an adapter, so it read `undefined` and wrote nothing — while
  every deployment that actually loads data put `datasource="[object Object]"` on
  the card. The pin renders a dashboard with an adapter so the case that only
  production had is now a test.

  The cost of this was never visible; it was that the defect poisoned the
  assertion this area attracts. objectui#4163 pins
  `not.toContain('[object Object]')` on the dashboard grid, and objectui#4032
  wanted the same pin on the metric path but could not write it: the card carried
  the attribute before and after any i18n fix, so the container assertion was red
  for a reason unrelated to labels and the tempting repair was to loosen it. That
  suite asserted on the card heading instead, with a comment. The workaround is
  now removed and the container assertion is back.

  The exported `MetricWidgetProps` / `MetricCardProps` interfaces are unchanged —
  the components' accepted props widen only by the optional, ignored
  `SchemaHostProps` keys, so no consumer type narrows.

- 45e1949: Numbers render in the user's locale, and a `Field.number` year is no longer `2,026`

  Every numeric field the console rendered went through an `Intl.NumberFormat` built with the locale hardcoded to `en-US` and `useGrouping` never set. Two defects rode in that one construction: a `zh-CN` or `de-DE` console still grouped and pointed decimals the US way, and a four-digit **year** stored as `Field.number({ scale: 0 })` rendered as `2,026` — in every locale, with no field property able to turn it off. Apps had been converting year columns to `Field.text` to escape it, permanently trading numeric comparison, range filters and dataset dimension types for a display detail.

  The construction had been copied into five places — the number cell renderer, the currency cell renderer, the `CurrencyField` widget, the compact `formatNumber` helper, and the dashboard `MetricWidget` — so fixing any one surface never changed the answer. They now share one formatter, `formatDisplayNumber` in `@object-ui/i18n`, which owns the locale and the grouping policy together, plus one locale resolver, `useDisplayLocale`.

  `useDisplayLocale` composes the two locale channels this repo already had rather than adding a third: the tenant's regional default (`useLocalization().locale`, ADR-0053) when an org has configured one, otherwise the active UI language (`useObjectTranslation().language`) so grouping and decimal marks follow a language switch. That second step is what covers the case the report was measured in — a fresh database, where the tenant localization endpoint has no locale to give.

  Grouping is now suppressed when a field declares `scale: 0` and carries no currency, which is what makes years, fiscal periods and other ordinals render plainly. This is an **interim default** with an accepted cost: a large scale-0 _count_ loses its separators too. It holds only until the spec gains an authorable presentation hint, which is being specified separately, contract-first; when that lands it overrides this heuristic.

  Three surfaces deliberately keep their separators, because a zero-decimal display there does not come from a field declaration: the dashboard `MetricWidget` (its decimals are parsed from a numeral.js format pattern, and its own contract calls the separators load-bearing — "`1,930,000` not `1930000`"), the `element:number` aggregate renderer, and every currency path including amounts whose currency code could not be resolved. An **undeclared** `scale` also keeps grouping — absent means "decimals unknown", not "integer".

  `formatCurrency`, `formatCompactCurrency` and `formatNumber` each take a new optional trailing `locale` argument. Existing calls are unaffected; omitting it now follows the runtime default rather than forcing US conventions.

- 844ed3a: Dashboard global filters sourced from `optionsFrom` now commit the RAW value instead of the display label.

  The option source is a server GROUP BY whose response carries both forms of every grouped value: `rows` holds the resolved display labels (`{status: 'In Review'}`) and the index-aligned `drillRawRows` holds the raw stored values (`{status: 'in_review'}`). `DashboardFilterBar` read the value off `rows`, so picking an option broadcast a label no record carries into every bound widget's `runtimeFilter` and each widget repainted to "No rows". Options are now paired index-wise — value from `drillRawRows`, label from the displayed row — mirroring how the drill path has always read the same response. The trigger still displays the label, and statically declared `options` are unaffected. When the raw rows are absent, disagree in length with `rows`, or carry no such field, the previous read is kept rather than guessing at a pairing.

- 49ae9f4: Pivot buckets encode an empty dimension value as JSON `null`, so it no longer collides with a row whose value is literally the placeholder character

  objectstack#5473 / objectstack#5665 replaced the pivot's delimiter-joined ids
  with `JSON.stringify`, because every delimiter that had been tried — an empty
  string, a plain space, a control character — assumed the data would not contain
  it, and each assumption failed on ordinary data. This closes the last place the
  same assumption survived: the ids were JSON, but the VALUES fed into them were
  spelled `String(row[d] ?? '∅')`, so an absent dimension value became the
  ordinary string `"∅"` and shared a bucket with a row whose value literally is
  that character (U+2205). One bucket, later row overwriting the earlier one — the
  cell showed a different row's measure, the overwritten row was unreachable, and
  drill-through followed the same wrong index into the wrong records, all without
  an error. The trigger requires that character to appear as a dimension value, so
  this is the assumption being removed rather than a defect users hit today.

  An empty value now encodes as JSON `null`, which `JSON.stringify` renders as a
  bare `null` that no string can spell. The normalization lives in
  `@object-ui/core` as `pivotDimensionValue` (absent ⇒ `null`, everything else ⇒
  its string form) rather than at each call site, because a placeholder spelled by
  a caller is a placeholder that can collide again — which is exactly how this one
  survived the previous fix. `pivotBucketId` accepts `Array<string | null>`
  accordingly; that is a widening, so existing callers passing `string[]` are
  unaffected.

  Both renderers' bucket keys move together, which the fix requires: a bucket id
  and the subtotal map keyed by it are built from the same expression, so changing
  one alone would split the headers while the subtotal map still merged, landing
  every column subtotal under the wrong header. In `plugin-dashboard`'s
  `DatasetWidget` that is the row bucket id, the column bucket id, the cell key,
  and both the `rowTotalById` and `colTotalById` lookups; in `plugin-report`'s
  `DatasetReportRenderer` the single `bucketId` helper already feeds all five.

  The dashboard's column bucket id also stops being a bare string and becomes a
  one-element tuple through the same shared encoder. It was the one id in the
  family still built by hand, on the reasoning that a single value needs no
  boundary — true of the boundary, false of everything else the encoder does, and
  it is why the across axis kept carrying this collision after the row ids were
  fixed.

  No display change: these placeholders only ever entered ids, never labels. An
  unset dimension still renders through `formatDimensionValue` exactly as before,
  and data containing neither an absent value nor that character buckets
  identically — the ids are opaque lookup keys, never parsed back into a value,
  never shown, never persisted.

- a3ae404: fix(components,plugin-dashboard): a static-data `table` widget renders instead of crashing

  A dashboard widget authored as `{ type: 'table', options: { data: [ … ] } }` fell into the
  error boundary with "Maximum update depth exceeded" the moment its tile re-rendered, while
  every chart family on the identical static surface rendered clean.

  - `data-table` no longer re-renders itself to death. Its `columns` / `data` fallbacks are
    module-scope empties instead of per-render array literals, and the prop→state column sync
    re-seeds on a value change rather than on a new identity — so a consumer that derives its
    columns each render (which both dashboard surfaces do) costs the table nothing.
  - Both dashboard surfaces now give the static table the `columns` key `DataTableSchema`
    requires, derived from the rows when the author declared none — the same derivation the
    `provider: 'object'` half of the widget family already performed. Previously such a table
    drew one empty row per record: no headers, no cells.
  - `DashboardGridLayout` reads an authored `options.data` ARRAY for its static table, which
    its `widgetData?.items` expression resolved to `[]`. `DashboardRenderer` had the arm all
    along.

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
- Updated dependencies [e2e6360]
- Updated dependencies [ee26e65]
- Updated dependencies [5900ac5]
- Updated dependencies [932cbcd]
- Updated dependencies [734d186]
- Updated dependencies [f650253]
- Updated dependencies [3d9769a]
- Updated dependencies [8f85f8b]
- Updated dependencies [d0c3b26]
- Updated dependencies [3fc2971]
- Updated dependencies [aca27fa]
- Updated dependencies [dde7283]
- Updated dependencies [f7c6430]
- Updated dependencies [4dadf0d]
- Updated dependencies [ae10a01]
- Updated dependencies [0f21348]
- Updated dependencies [d2e2caf]
- Updated dependencies [92876f0]
- Updated dependencies [f279deb]
- Updated dependencies [4b70d28]
- Updated dependencies [eb7f586]
- Updated dependencies [e901131]
- Updated dependencies [ebb4e0e]
- Updated dependencies [3a9021e]
- Updated dependencies [d9d3463]
- Updated dependencies [2a40f69]
- Updated dependencies [bec3e14]
- Updated dependencies [613b167]
- Updated dependencies [b4d3c22]
- Updated dependencies [1f9b905]
- Updated dependencies [8f60d73]
- Updated dependencies [cb13400]
- Updated dependencies [828549a]
- Updated dependencies [e1ade8f]
- Updated dependencies [bc64bfe]
- Updated dependencies [abb0f81]
- Updated dependencies [38ab505]
- Updated dependencies [3e19fe7]
- Updated dependencies [bb58d1d]
- Updated dependencies [433ff9f]
- Updated dependencies [5cc847c]
- Updated dependencies [e7663f2]
- Updated dependencies [fa21254]
- Updated dependencies [33c32bf]
- Updated dependencies [66fb4fa]
- Updated dependencies [b953a97]
- Updated dependencies [d7f3e30]
- Updated dependencies [6d641c9]
- Updated dependencies [7e4f0e5]
- Updated dependencies [a84385b]
- Updated dependencies [45e1949]
- Updated dependencies [92250d6]
- Updated dependencies [c1d939f]
- Updated dependencies [58bebf6]
- Updated dependencies [36310dc]
- Updated dependencies [52d878a]
- Updated dependencies [405e808]
- Updated dependencies [49ae9f4]
- Updated dependencies [a3ae404]
- Updated dependencies [bfdf3d4]
- Updated dependencies [bb68488]
- Updated dependencies [c0f9a4b]
- Updated dependencies [b1e42d0]
- Updated dependencies [2459a3e]
- Updated dependencies [ac853ce]
- Updated dependencies [fa51109]
- Updated dependencies [d6aa172]
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
  - @object-ui/fields@17.5.0
  - @object-ui/types@17.5.0

## 17.4.0

### Patch Changes

- 4bc6c23: Converge dashboard widget `compareTo` on the executor's `{ kind, dimension? }` contract, and make the dataset path actually render a comparison

  `CompareToConfig` was a three-branch union (`'previousPeriod' | 'previousYear' | { offset }`). `@objectstack/spec` collapsed it to the shape the analytics executor already implements — `DatasetCompareTo`, a plain strict object `{ kind: 'previousPeriod' | 'previousYear'; dimension?: string }` (objectstack#5011) — so this renderer now reads that one shape:

  - `shiftFilterByCompareTo` / `compareToTrendLabelKey` dispatch on `compareTo.kind`. The `{ offset }` duration shift is gone: `{ offset: '1y' }` is `kind: 'previousYear'`, while `'7d'` / `'1M'` have no faithful target and are restated by the author on the widget's own `filter` plus `kind: 'previousPeriod'`. No trend label key is retired — the offset arm resolved to `vsPreviousPeriod`, which survives as the `previousPeriod` fallback.
  - `DatasetWidget` no longer discards part of `compareTo`. It used to forward only the object form because the two string forms had no meaning downstream; with one shape there is nothing to discard, and a stale string is now invalid metadata rejected where it is authored rather than silently reinterpreted here.
  - **The comparison now actually runs on the dataset path.** A widget states its window in its own `filter` (a date macro, or the dashboard date-range filter merged in), but the executor shifts a `timeDimensions` entry carrying a `dateRange` — so a dataset widget asking for a comparison got "compareTo needs a dated window to shift" and rendered none. When (and only when) a comparison is requested, the resolved filter's bounded date windows are lowered into `selection.timeDimensions[].dateRange` and moved out of `runtimeFilter` (a copy left behind would intersect the shifted window with the current one and empty every comparison column). Which dimension gets shifted stays the executor's decision: every window found is lowered under the name the author wrote, and zero or two candidates surfaces the executor's own error, listing them.
  - The `<measure>__compare` columns that come back are now shown: a delta + window label on KPI widgets, a comparison column on tables, and a `variant: 'comparison'` overlay series on charts — the same treatment and the same `dashboard.trend.*` labels the inline object-provider widgets already use.

- 230ffd8: Dashboard metadata's `chartConfig` presentation keys now take effect for the first time

  `DashboardWidgetSchema.chartConfig` is declared as the full spec
  `ChartConfigSchema`, but the ADR-0021 dataset path lowered exactly one key onto
  the chart renderer: `showLegend` (objectui#3135). Everything else an author wrote
  there — the chart's own `title`/`subtitle`, the accessibility `description`, an
  explicit plot `height`, a `colors` palette or per-category colour map,
  `showDataLabels`, `annotations`, `interaction` — parsed as valid metadata,
  reached `DatasetWidget`, and was dropped before the chart schema was built. The
  underlying chart block draws all of them; only the dashboard's hand-off was
  missing.

  `DatasetWidget` now lowers each of those keys, on two mechanical criteria, both
  of which have to hold:

  1. **The chart block draws it end to end on this path.** `{ type: 'chart' }`
     resolves to `ChartRenderer` → `AdvancedChartImpl`, which draws
     `title`/`subtitle` above the plot, turns `description` into the chart
     container's `role="img"` + `aria-label`, applies `height` as that container's
     inline height, paints `colors`, prints `showDataLabels` as per-point labels,
     draws `annotations` as reference lines/bands and honours `interaction` as the
     tooltip toggle plus the range selector. Each is pinned at the DOM level, so a
     key is never forwarded to a prop that ignores it.
  2. **It does not fight the dataset derivation.** `xAxis`, `yAxis` and `series`
     are derived from the widget's dataset selection, so an authored one would
     shadow the derived binding and blank the chart; they stay unforwarded, as does
     `type` (the widget's own `type` already picks the chart family). `aria` stays
     unforwarded too, for the other reason: nothing on this path reads it.

  `colors` is split the way the react tier already splits it, because the two arms
  reach the renderer through different props: a `string[]` is the positional
  palette, a `{ value: color }` record is a per-category map merged over the
  category dimension's own option colours.

  **Behaviour-opening surface.** A dashboard that already wrote any of these keys
  goes from having them ignored to having them applied — the point of the change,
  but visible: a widget that declared `chartConfig.title` now shows that title
  inside the plot area (in addition to the widget card's own `title`, which is a
  separate key), one that declared `height` no longer fills its card, one that
  declared `colors` stops using the theme palette, and `showDataLabels`,
  `annotations` and `interaction.brush` start drawing. Widgets with no
  `chartConfig`, or with only `showLegend`, render exactly as before: undeclared
  keys are never emitted, so the renderer's own defaults stay in charge.

  Part of objectstack#5175 (the enforce half); the narrowing half — what to do
  about `aria`, and about `xAxis`/`yAxis`/`series` being declared on a surface that
  derives them — is still open there.

- c4c0ac8: Dataset-bound metric cards honour their declared `colorVariant` (objectui#3359, objectstack#5010 ruling B)

  `DashboardWidgetSchema.widgets[].colorVariant` has been spec-declared, offered by
  every authoring surface (the widget inspector, the dashboard editor, the config
  panel) and authored **16 times** in shipped metadata — `system_overview` ×7 in
  `platform-objects`, app-showcase's `ops-dashboard` / `revenue-pulse` ×9 — with
  every one of those a `type: 'metric'` widget bound to a dataset. None of them
  ever rendered a colour.

  The reason is structural rather than a missing branch: `dataset` is **required**
  on `DashboardWidgetSchema`, so every legal widget reaches `DatasetWidget` through
  one of `DashboardRenderer`'s two dispatch sites, and `DatasetWidget` read the key
  nowhere. Only the inline (`object` + `valueField`) path had a colour affordance,
  via the `...options` spread into `MetricWidget` — a path the current schema
  cannot produce. Declared, authored, offered in the designer, and inert: the
  renderer painted all sixteen the same.

  The metric card now maps the declaration onto the accent system this package
  already has, instead of a second one:

  - the vocabulary is the spec's `WidgetColorVariantSchema` enum, read from the
    spec **in a test** rather than restated in prose — `default`, `blue`, `teal`,
    `orange`, `purple`, `success`, `warning`, `danger`;
  - the accent lands on the big number, the way `MetricWidget`'s chrome-less
    `bare` layout carries it, because a dataset-bound metric renders no icon chip
    and no card of its own. A dataset-bound KPI and an inline `bare` KPI declaring
    the same variant now read the same;
  - the two class tables both layouts use moved into one shared module
    (`colorVariants.ts`) rather than being copied — the designer's swatch picker
    already calls itself a mirror of "the renderer's colorVariant tokens", and a
    second copy of a palette is how a declared-but-unenforced key becomes the
    harder bug: a key declared two disagreeing ways.

  Nothing changes for a widget that declares no `colorVariant`: its markup is
  pinned byte-for-byte against the pre-change render, as is the enum's own
  `'default'` (its name for "no accent"). Off-spec tokens — including the swatch
  picker's three display-only aliases `green` / `red` / `amber`, which exist so a
  legacy stored value can still be drawn as a swatch — get no accent and no
  aliasing here: the spec enum rejects them where metadata is authored and
  published, and teaching the renderer a second spelling would hand AI-authored
  metadata a dialect the contract does not have.

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

- 022002a: `PageComponentSchema.dataSource` now reaches the remaining object-bound public
  blocks: `object-gantt` / `object-timeline` / `object-map` / `object-pivot` /
  `object-master-detail-form` / `embeddable-form` / `record:line_items`
  (objectstack#7121).

  objectstack#6953 wired the spec's per-element data binding
  (`dataSource: { object, view?, filter?, sort?, limit? }`) to the eight blocks it
  named and left the same declaration inert on these seven. Each gates its fetch on
  its own object key and nothing mapped `dataSource.object` onto it, so a page
  written the way the spec documents rendered an empty gantt / an empty timeline
  rail / a map with no markers / an empty cross-tab / a field-less form — with no
  request and no diagnostic anywhere. Spec-valid metadata rendering nothing is the
  objectstack#4413 shape.

  Composition follows objectstack#5576's landed semantics unchanged, through the
  shared `ElementDataSourceGate` (no change to it or to the resolution layer): a
  named saved view supplies the baseline, a key written on the component itself
  overrides it, an explicit binding key overrides both, `filter` AND-combines
  ("additional filter criteria" — a binding can narrow a view, never widen it), and
  a `view` name that does not resolve renders a configuration error on every one of
  these blocks instead of degrading to the object's full scope.

  Each block maps **only** the keys it genuinely reads, which for this batch means
  several keys stay deliberately unmapped rather than being parked somewhere
  plausible:

  - `object-gantt` and `object-map` take `object` / `filter` / `sort`; neither has a
    row cap or a field-list read site.
  - `object-pivot` takes `object` / `filter`; a cross-tab orders itself by its own
    row/column grouping and cannot be computed over a truncated page.
  - `object-timeline` takes `object` only — its fetch is
    `find(objectName, { options: { $top: 100 } })`, with no filter/sort read site
    at all, so a named view is error-checked and then contributes nothing.
  - `embeddable-form` and `object-master-detail-form` take `object` only (the
    parent object, in the master-detail case); a form that writes one record has no
    collection query for `filter` / `sort` / `limit` to narrow.
  - `record:line_items` takes `object` onto **`childObject`** — the collection it
    actually lists — and nothing else: its query is the parent FK plus a fixed
    `$top: 500`, and its `columns` are editable `GridColumn` objects rather than a
    field-name projection a view could supply.

  The per-block coverage table, including every residual gap named above, is in
  `content/docs/guide/data-source.md`.

  No behaviour change for a block that carries no `dataSource`: the binding-free
  path returns the schema by reference, so nothing remounts and nothing refetches.

- 02eb444: Show the `compareTo` comparison in a dataset pivot cross-tab instead of dropping it

  A dataset widget with `type: 'pivot'` and two or more `dimensions` renders a true cross-tab, and that branch was the one render path the `compareTo` work left out (objectui#3614, following objectui#3337 / PR #3612). It laid out its columns as `bucket × measure` and never admitted the `<measure>__compare` columns the executor returns — so a pivot with a bounded date window and a `compareTo` ran a correct comparison query, received correct comparison data, and displayed none of it: headers, cells and all three subtotals were silent.

  The comparison is now **stacked inside the cell** — current value on top, comparison value and its delta percentage beneath in smaller type:

  - The pivot's column structure is unchanged. Giving the comparison a column of its own would turn `bucket × measure` into `bucket × measure × window`, doubling the width and adding a third header level on the widget family whose width is already the scarce resource.
  - **Row, column and grand subtotals stack it the same way.** A Total that alone showed no comparison would read as "this row has none", which is a different and false statement.
  - One caption names the comparison window ("vs last year") for the whole table, from the same `dashboard.trend.*` vocabulary the KPI and flat-table paths use, and the delta comes from the same helper — so a KPI and a cross-tab cell comparing the same two windows agree on sign and rounding.
  - **CSV export stays data-shaped.** The cross-tab now exports a flat `<measure>__compare` column per compared measure, with bare numbers in the cells: a spreadsheet can compute on the export, and no stacked display string ("$120 $100 20%") ever reaches it.

  Presence is detected from the returned data, as on every other path, so there is no new option to set — and a pivot the executor sent no comparison for renders exactly as it did before.

- c1e1e6b: Studio's widget config panel no longer authors the retired `actionUrl` widget key

  `actionUrl` / `actionType` / `actionIcon` were retired at the WIDGET level in
  `@objectstack/spec` 17.0.0-rc.3 (objectstack#5010, ADR-0049 D2). They are
  `retiredKey` tombstones: `DashboardWidgetSchema` types them `never` and refuses
  any value, so authoring one is a tsc error and a parse error. Two producers in
  `plugin-dashboard` were still emitting the widget-level key anyway
  (objectstack#7129):

  - `WidgetConfigPanel` offered a Behavior-group field labelled "Click-through
    URL", bound to `actionUrl`. That control was inert twice over: no dashboard
    widget renderer has ever read `widget.actionUrl`, so a URL typed there never
    navigated anywhere, and the value it wrote was refused by the spec.
  - `DashboardWithConfig` seeded `actionUrl: widget.actionUrl ?? ''` into every
    widget config handed to the panel. Because the ADR-0021 save scrub only knew
    the dataset-shape keys, that seed rode through to `onWidgetSave` on EVERY
    save — so a Studio author who merely renamed a widget still persisted
    `actionUrl: ''` into stored metadata, a key the spec then refuses. This is
    the wider half of the defect: it did not require anyone to use the field.

  The Behavior group and the seed are both gone, and `sanitizeDraftForType` now
  scrubs all three keys as a second line of defence, for stored widgets that
  already carry them and for hosts that drive `WidgetConfigPanel` directly.

  Behaviour change surface: the widget config panel loses its Behavior section
  (that section contained only this one field). Nothing that rendered before stops
  rendering — the field had no consumer. `header.actions[]` keeps its own,
  unrelated and still-live `actionUrl`; only the widget-level key is a tombstone.

  Also corrects the `DashboardWidgetSchema` docblock in `@object-ui/types`, which
  listed the three retired keys among those that "flow in from the spec" next to
  live keys like `colorVariant`. They do flow in — as `?: never`. The docblock now
  says so, and notes that while authoring one is a tsc error, _reading_ one still
  type-checks (`never | undefined`), which is exactly how these producers survived
  the 2026-08-04 sweep that removed the renderer-side reads.

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

## 17.3.0

### Patch Changes

- 509104a: Fix matrix report cells showing another bucket's numbers when dimension values run together.

  The cross-tab in `DatasetReportRenderer` built its bucket ids by joining dimension values with the EMPTY string, so adjacent values had no boundary at all: `"x"` + `"yz"` and `"xy"` + `"z"` were the same bucket on both axes, and the later row silently overwrote the earlier one. Its cell key then joined the two bucket ids with a plain space, while dimension values contain spaces constantly ("New York", "In Progress"), so `"New"` × `"York Q1"` and `"New York"` × `"Q1"` also met in one key. A merged bucket showed a different row's measure, the overwritten row's value was unreachable, the per-row and per-column subtotals matched the wrong header, and drill-through followed the same wrong index into another record's list — none of it with an error.

  Bucket ids and cell keys are now encoded with `JSON.stringify`, which carries the boundary in its own quoting rather than in a character the data is assumed never to contain. All four lookups in the renderer (row headers, column headers, row subtotals, column subtotals) share the one encoder, so they agree by construction.

  The encoders moved to `@object-ui/core` as `pivotBucketId` / `pivotCellKey` and are now shared with the dashboard `DatasetWidget`, which carried the same defect and fixed it separately: two packages each hand-rolling the same key is why one fix left the other broken. The dashboard keeps its existing exports and behaviour.

- ce7cbe5: Fix dataset pivot cells showing another row's numbers when a dimension value contains a space.

  The cross-tab cell key joined the row bucket id and the column bucket id with a plain space, so two rows whose ids met at a different point of the same string produced ONE key — `"New"` × `"York Q1"` and `"New York"` × `"Q1"` both spelled `New York Q1`. The later row silently overwrote the earlier one: the cell showed a different row's measure, the overwritten row's value was unreachable, and drill-through followed the same wrong index into the wrong records. Row and cell ids are now encoded with `JSON.stringify`, which needs no assumption about characters the data will not contain.

  The row-subtotal lookup builds the same row bucket id and now shares that single encoder. It previously rolled its own join, which agreed with the row headers only when a pivot had exactly one row dimension, so the Total column rendered blank for any pivot with three or more dimensions.

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

## 17.2.0

### Patch Changes

- d9668a7: Honor the server's declared percent scale, so a ratio of exactly 1 renders as 100.0% (#3136)

  A dataset measure declared `format: '0.0%'` rendered every ratio below 1
  correctly and got the single most consequential one wrong: a rate of exactly
  `1` printed as **`1.0%`**. On an SLA / pass-rate dashboard that turns
  "everything met the SLA" into "1% met the SLA", on both surfaces the issue
  names — the KPI card and the dataset-bound table (they share `formatMeasure`).

  The cause was never a bad multiplier; it was a missing fact. `formatMeasure`
  scaled by magnitude — `percentDisplayValue` multiplies by 100 only strictly
  inside `(-1, 1)` — because the column arrived with a `%` format string and
  nothing saying what scale its numbers were on. That guess is undecidable at
  exactly 1, which is both a full-compliance ratio ("100%") and one percentage
  point ("1%"), and it resolved to the reading almost nobody means.

  The server now answers the question instead (framework: `percentScaleOf` +
  `AnalyticsResult.fields[].percentScale`, the sibling of the ADR-0053 currency
  chain): a `derived: { op: 'ratio' }` measure is a `fraction` by definition, and
  a measure over a `percent` field inherits that field's scale. `formatMeasure`
  takes the declared scale as a fourth argument and, when present, scales by it —
  `fraction` ×100, `whole` verbatim — instead of inspecting the value. Every
  dataset-bound call site passes the column's `percentScale`: the dashboard
  metric/table/pivot cells, the report renderer's cells, totals and KPI, and the
  dataset preview.

  `percentDisplayValue` is untouched and still the fallback for a column that
  arrives without the annotation (an older server, or a non-dataset percent cell
  in a list view), so nothing that renders correctly today changes.

- 022e4c3: Upgrade to `@objectstack/spec@17.0.0-rc.1`, stop offering the retired `wait` timeout fields (#3101), and route the newly-adopted `combo` chart type.

  **Breaking for authoring, and the reason to do it now**: the `wait` panel no longer offers
  `waitEventConfig.timeoutMs` or `.onTimeout`. Both are `retiredKey()` tombstones as of spec
  17.0.0-rc.1 (framework#4158), which means a value written there is **rejected at load** —
  so until this lands, Studio can produce flow metadata the author's own runtime refuses.
  That hazard opened the moment rc.1 published, independent of when this repo bumps.

  `wait` never had a timeout: `onTimeout` had zero readers, so neither `'fail'` nor
  `'continue'` ever happened, and `timeoutMs`'s only reader used it as the timer **duration**
  when `timerDuration` was absent. Use **Duration** — it accepts a bare number as
  milliseconds, making the old `timeoutMs: 60000` and `timerDuration: '60000'` the same wait.
  Stored flows are converted by framework's D2 conversion; the designer simply stops offering
  the entry. The two `zh` label overrides go with the fields.

  #3101 asked for this to ride along with the bump rather than land alone, and that is
  load-bearing: the sibling-block assertion is **bidirectional**, so deleting the fields
  against a spec that still declares them fails in the other direction.

  **`combo` is now a spec chart type** — the sole addition to `ChartTypeSchema` in rc.1 (19
  members → 20). It had been a renderer-local family the chart renderer derived from the
  series, so nothing classified it on the two surfaces that route a _spec_ chart type: a
  spec-valid `combo` fell through to the red "Unknown component type" panel on a dashboard
  and to the out-of-spec notice on a report. Both now route it
  (`widgetDispatch.SERIES_CHART_TYPES`, `planReportChart`). The renderer-local derivation
  stays — it is what makes an authored `type: 'combo'` render rather than merely validate.

  **Retired spec exports this repo bound to**, all removed upstream in spec 17.0.0:

  - `JoinStrategy` / `WindowFunction` (framework#4286 tombstoned `query.joins` and
    `query.windowFunctions`: no engine or driver ever read either on the query path). They
    were derived off the spec enums under objectstack#4115's "come off the spec enum, not a
    restatement" rule; with no enum left, `data-protocol.ts` now restates the members locally
    — verbatim from the last spec that published them — as the objectui query-AST vocabulary
    they have become. The AST itself is unchanged.
  - `PerformanceConfig`, retired with `dashboard.performance` (framework#3896). Nothing bound
    to it — `@object-ui/react`'s `usePerformance` declares its own interface and is untouched.
    The dashboard form is derived from the spec's own `dashboardForm`, so the field
    disappears from the inspector for free; its test now pins the absence.

  **Three inverted pins fired, and are recorded rather than resolved.** objectstack#4171's
  tripwires asserted that `NavigationItem`, `FormField` and `ConditionalValidation`'s branches
  still erased to `any`/`unknown` upstream — the premise that justified objectui keeping local
  declarations. rc.1 types them properly, so the assertions are inverted to state the new
  fact. The burn-down each one asks for — deriving those types from the spec — touches
  widely-used public types and is deliberately **not** bundled into a version bump; it is
  tracked in #3177. `JoinNode`'s pin is gone outright: the symbol no longer exists.

  **What the bump arms.** The reconciliation ledger's `subflow` and `decision` panels
  feature-detect their spec exports and had never actually run — rc.0 predates the exports
  (framework#4278). They now execute and pass. The `script` panel's full bidirectional check
  stays deliberately skipped: rc.1 predates framework#4343, so the retired dispatch branches
  are still contract keys there, and only the "offers nothing the executor ignores" direction
  is meaningful. It arms itself on the next rc.

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

## 17.1.0

### Patch Changes

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
  - @object-ui/fields@17.1.0

## 17.0.0

### Patch Changes

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

- e16ed2d: fix(dashboard,charts): send widget `dateGranularity`/`sortBy`/`limit` to the query, and give funnels a real stage order (framework#3588)

  `DatasetWidget` never read `widget.options`. Four keys an author writes there
  change the query the server compiles, so a widget declaring
  `options: { dateGranularity: 'month' }` grouped by the raw timestamp and drew
  one bar per record, and `sortBy`/`sortOrder` produced no ordering at all.

  - `DatasetWidget` lowers `options.dateGranularity`, `options.sortBy` +
    `options.sortOrder`, and `options.limit` into the `DatasetSelection` it posts.
    A `sortBy` naming something the widget does not project is dropped rather than
    sent, so a stale sort key left by an edit degrades to "unordered" instead of
    failing the widget against the server's stricter validation. These keys also
    join the refetch signature, so editing one in the designer refetches instead
    of re-rendering the previous grid.
  - Funnel stages follow a **declared order**. `AdvancedChartImpl` sorted funnel
    segments by value descending, unconditionally — which overrode any server
    ordering and rendered a sales pipeline as a tidy narrowing shape whatever the
    stages' real sequence, hiding the very anomaly (a bulge at Proposal) the chart
    exists to show. It now honours a `categoryOrder`, which `DatasetWidget`
    derives from the dimension field's picklist option order — the pipeline order
    an author already declared on the object — or from an explicit
    `options.stageOrder`. With no declared order the value-descending default is
    unchanged, and a category missing from the order is kept (after the declared
    ones), never dropped.
  - New `@object-ui/core` helpers `buildCategoryOrder` / `buildCategoryRank`,
    keyed by both the stored value and the display label like the existing
    `buildOptionColorMap`, so ordering works whether or not the server resolved
    the dimension's labels.

  Requires the framework-side fix in objectstack#3588 for the selection keys to
  take effect server-side.

- 2cb8d78: fix(console): dispatch flow actions from every surface, and cover the screen-flow round trip (framework#3528)

  The resume half of screen flows is fixed; these are the two launch-side holes
  found while mapping every path that dispatches a `type: 'flow'` action — on
  both, a screen flow could not even be started.

  - **plugin-dashboard** — a dashboard header action only dispatched when its type
    was `modal` or `script`. `flow` (and `api` / `form` / `navigation`) fell
    through to `console.warn("Unknown header actionType")` and did nothing at all.
    The click handler now routes everything that is not a raw `url` navigation
    through the ActionRunner, which owns the type registry; there is nothing for
    the renderer to second-guess.
  - **app-shell** — the console-root `<ActionProvider>` was mounted with no
    `handlers` map. It exists to give every field widget a modal handler, but an
    `ActionProvider` also decides what a `useAction()` consumer _below_ it can
    dispatch, so any `action:button` outside ObjectView / RecordDetailView /
    PageView / DeclaredActionsBar bound to a runner that could only open modals:
    a `flow` action there failed with "Flow handler not registered", and `api` /
    `script` were equally dead. The root now carries the shared console runtime's
    api / flow / script handlers plus its confirm / param / result / screen-flow
    dialogs. `modal` deliberately stays on the client-side `useActionModal`
    handler — registering it in `handlers` would take precedence over `onModal`
    and reroute the inline-create affordance to `/api/v1/actions/...`.

  Both changes ship with regression tests that were verified to fail without them.
  Also adds the first coverage of the screen-flow seam itself, which had none:

  - `FlowRunner.suspense.test.tsx` — a lazily-loaded screen body must not unwind
    past the dialog. Reproduces the real shape (lazy body, route-level boundary
    above the host, host state that must survive) and fails against the
    pre-boundary runner, which is how a paused run's screen used to vanish before
    it could be submitted.
  - `e2e/live/screen-flow.spec.ts` — the live round trip: a row flow action
    triggers the run, the paused screen renders, Submit POSTs to
    `/automation/{flow}/runs/{runId}/resume` with the collected values, and the
    flow's downstream `update_record` shows up in the list. The unit tests stub
    the runner out of the action runtime and the runner's own tests feed it a
    screen directly, so trigger → dialog → resume → refresh was previously only
    ever exercised by hand.

- 341bfb5: fix: read spec-canonical keys for dashboard header title and field length rules

  Two naming-drift closeouts (framework#1878 / framework#1891):

  - `DashboardRenderer` header now falls back to the spec-canonical `label` when
    the legacy `title` is absent (mirrors the `DashboardGridLayout` fallback from
    #2666) — a spec-compliant dashboard gets its header title.
  - Field validation rules now read the spec-canonical camelCase
    `minLength`/`maxLength` (what the server record-validator enforces) with the
    legacy snake_case `min_length`/`max_length` kept as fallback — authored
    length constraints reach the client form.

- 5b9cf96: fix(plugin-map): drop the `maplibre-gl@6` default import, and put type-check behind a CI gate that cannot be silently skipped (#2911)

  `maplibre-gl@6.0.0` removed its default export (arrived via #2848, dependabot),
  so `ObjectMap.tsx`'s `import maplibregl from 'maplibre-gl'` has been a TS1192
  error on `main` for a day. The binding was never used — the map instance comes
  from `react-map-gl/maplibre`, and the stylesheet from the side-effect import on
  the next line — so the import is simply deleted rather than rewritten to
  `import * as`.

  Removing it is runtime-neutral, which the issue had explicitly left unverified.
  `@vis.gl/react-maplibre` (what `react-map-gl/maplibre` re-exports) does
  `Promise.resolve(mapLib || import('maplibre-gl'))` in `components/map.js`, so it
  loads the library itself when no `mapLib` prop is passed. Verified in a browser
  against the `store-locator-map` catalog schema: `maplibre-gl` is fetched as its
  own lazy chunk, the WebGL canvas comes up 800x600, and all three markers mount —
  byte-identical probe output with and without the static import. That also matches
  what `apps/console/src/main.tsx` already intends, where the plugin is registered
  lazily specifically to keep `maplibre-gl` out of the initial bundle.

  **The reason it survived a day of green CI is the part worth fixing.** No
  workflow ran `type-check` at all, and `turbo build` only checks types for
  packages whose `build` script happens to invoke `tsc` — the 22 `vite build`
  packages transpile without checking. A sweep of all 45 packages found ten with
  broken types, `plugin-map` merely being the one that had a script to notice it.

  Adding a `pnpm type-check` job alone would not have been a gate: **turbo silently
  skips any package with no `type-check` script**, so 17 packages read as passing
  because nothing ran. With `plugin-map` fixed, `pnpm type-check` reports 63/63
  green while nine packages are still broken. So:

  - `plugin-ai` and `plugin-report` gain the `paths` override their type-checked
    peers already carry, which detaches workspace deps from sibling _source_ and
    resolves them through built `.d.ts` — the sole cause of the 104-error TS6059
    `rootDir` floods, and the same trick their own `vite.config.ts` already applies
    to the dts program.
  - Seven packages gain `"type-check": "tsc --noEmit"` (`plugin-ai`,
    `plugin-report`, `plugin-dashboard`, `create-plugin`, `console`, and the two
    console examples). Coverage goes 28 -> 35 of 45.
  - New `scripts/check-type-check-coverage.mjs` makes the invisibility impossible:
    a package with no `type-check` script must be declared, with a reason, and the
    lists only shrink — gaining a script without deleting the entry fails the
    guard. The nine known-broken packages are recorded there with error counts
    (`@object-ui/runner` has no `tsconfig.json` at all), tracked as follow-ups.
  - New `Type Check` CI job runs the coverage guard first (instant, no install),
    then `pnpm type-check`.

  Both halves were proven to fail before being trusted: the guard was exercised in
  all four of its failure modes, and re-introducing the `maplibre-gl` import turns
  the job red again, as does a fresh error injected into `plugin-ai` — a package
  that had no type checking whatsoever before this change.

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

## 16.1.0

### Minor Changes

- 94d4876: feat(dashboard): Studio authors the ADR-0021 dataset shape only (framework#3251)

  Finishes the dashboard analytics migration on the authoring side so the
  framework can enable `DashboardWidgetSchema.strict()`. Both Studio surfaces now
  emit only the semantic-layer shape (`dataset` + `dimensions` + `values`); no
  surface authors the removed pre-ADR-0021 inline query.

  **FROM → TO** (authoring)

  - charts: `object` + `categoryField` + `valueField` + `aggregate`
    → `dataset` + `dimensions` + `values`
  - pivots: `object` + `rowField` + `columnField` + `valueField` + `aggregation`
    → `dataset` + `dimensions` + `values` (last dimension spreads across columns)

  **Changes**

  - `@object-ui/types` — `DashboardWidgetSchema` gains `dataset` / `dimensions` /
    `values`; the inline analytics keys (`object`, `categoryField`,
    `categoryGranularity`, `valueField`, `aggregate`, `measures`) are marked
    `@deprecated` (retained only so the renderer can still read legacy/static
    metadata during the transition).
  - `@object-ui/plugin-dashboard` — `WidgetConfigPanel` is rewritten as a dataset
    picker (chart AND pivot). **Breaking prop change:** the unused
    `availableObjects` / `availableFields` props are replaced by a new
    `datasets?: WidgetDatasetCatalogEntry[]` (+ `datasetsLoading?`) catalog prop,
    also forwarded by `DashboardWithConfig`. Hosts resolve the catalog (e.g. via
    the metadata client's `list('dataset')`); without it the panel falls back to
    free-text authoring. New exports: `WidgetDatasetCatalogEntry` and
    `sanitizeDraftForType`.
  - `@object-ui/app-shell` — the metadata-admin `DashboardWidgetInspector` drops
    the legacy inline fields (object / value field / category field / aggregate);
    the dataset section is now the primary (and only) analytics binding, and the
    filter-binding field picker sources options from the bound dataset's
    dimensions. The "Add widget" catalog drops `list` / `custom` — neither is a
    member of `@objectstack/spec` `ChartTypeSchema`, so a widget authored with
    them could never publish.

  **Not changed:** `DashboardRenderer` keeps its legacy/static read branches and
  the `ObjectPivotTable` / `PivotTable` blocks (still public SDUI blocks and the
  backward-compat path for stored/static widgets) — only the dashboard authoring
  flow stops emitting the legacy keys. Retiring those renderer branches is a
  follow-up gated on migrating stored dashboards.

- 2331ac9: feat(report): drill a date-bucket cell into its time range, not a superset (#1752)

  Clicking a report/dashboard cell grouped by a `dateGranularity` date dimension
  ("2026-Q2") used to drill into a **superset** — the date dimension was skipped,
  so the record list spanned every time bucket. It now scopes to the clicked
  bucket's half-open range, consuming the framework's new `drillRanges` sidecar.

  - **`@object-ui/core`** — `buildDatasetDrillFilter` accepts the per-row
    `drillRanges` and emits an ObjectQL range operator object
    (`{ [field]: { $gte, $lt } }`) alongside the equality dims.
  - **`@object-ui/plugin-report` / `@object-ui/plugin-dashboard`** — the report
    renderer and dashboard widget forward `drillRanges`, and a **date-only**
    report (no equality drill dim) is now drillable via the range alone.
  - **`@object-ui/app-shell`** — the "Open in list →" escape hatch
    (`useOpenRecordList`) now targets the ADR-0055 **bare data surface**
    (`/:object/data`, "the URL is the view" — no baked-in view filter to
    over-narrow the drill) and serializes a range to the
    `filter[field][gte|lt]` operator contract. `ObjectDataPage` parses those
    operators (equality shorthand unchanged), renders a range as a single chip,
    and removes both bounds together. A new `drillUrlFilters` module owns the
    write/read serialization so both sides can't drift (round-trip tested).

  Companion to the framework analytics change (objectstack-ai/objectstack#3256).

- 199fa83: feat(dashboard): retire the pre-ADR-0021 inline-analytics renderer branches (framework#3320)

  Follow-up to the dashboard analytics migration (framework#3251 / objectui#2703).
  Authoring already emits only the semantic-layer shape (`dataset` + `dimensions` +
  `values`); this removes the renderer's now-unauthored legacy read-branches.

  - **types**: drop the `@deprecated` inline-analytics keys (`object`,
    `categoryField`, `categoryGranularity`, `valueField`, `aggregate`, `measures`)
    from `DashboardWidgetSchema`. They were retained in #2703 only so the renderer
    could read legacy/static metadata during the transition.
  - **plugin-dashboard**: `DashboardRenderer` no longer emits the object-bound
    metric / chart / pivot / table / list branches from the top-level `object` +
    analytics keys. It keeps the renderer-internal static paths (`options.data` /
    `widget.data` array and the `provider: 'object'` async config) and
    `widget.component`. The dashboard renderer no longer emits `object-pivot` /
    `pivot` at all — dataset pivots render through `DatasetWidget` (grouped table /
    cross-tab); the `ObjectPivotTable` / `PivotTable` components stay as public
    SDUI blocks for other surfaces. `DashboardGridLayout` gets the same treatment.
  - **graceful fallback**: a widget that still carries the retired inline shape in
    stored metadata (top-level `object`, no `dataset`, no inline `options.data`)
    now renders a visible error placeholder prompting a rebind to a dataset, rather
    than a blank chart/grid.
  - **plugin-designer**: `DashboardEditor` drops its inline object / value-field /
    aggregate fields (analytics binding is authored via the dataset picker in
    app-shell's `DashboardWidgetInspector` / plugin-dashboard's `WidgetConfigPanel`).

### Patch Changes

- 0c3209a: chore(lint): clear the baseline lint errors in plugin-dashboard (objectui#2713 Wave 3)

  First package of Wave 3 in the #2713 lint-gate restoration. `@object-ui/plugin-dashboard`
  was red at baseline on `main`; cleared every **error** (no behavior change;
  warnings out of scope):

  - **`react-hooks/rules-of-hooks`** (`ObjectDataTable`) — `useObjectTranslation`
    was wrapped in try/catch; removed the wrapper (the hook is provider-safe and
    never throws — the #2709 fix). English defaults still stand until a
    translation resolves.
  - **`react-hooks/static-components`** (`MetricCard`, `MetricWidget`) —
    `getLazyIcon(name)` returns a module-cached, stable component per name (not a
    component created during render), so the render sites carry a justified scoped
    disable.
  - **`no-irregular-whitespace`** (`DatasetWidget`) — the literal U+FEFF BOM
    prepended to the exported CSV blob (Excel UTF-8 detection) is written as the
    `﻿` escape: byte-identical at runtime, no literal irregular-whitespace char.
  - **`no-useless-escape`** (`recordFields`) — dropped a needless `\$` inside a
    character class (`[\$¥€£]` → `[$¥€£]`).
  - **`no-sparse-arrays`** (`recordFields`) — the `|| [, '']` match fallback is
    written `[undefined, '']` so index 0 is an explicit hole, not a sparse one.
  - **`no-useless-assignment`** (`PivotTable`) — the `suffix` accumulator is now a
    single `const` at its one assignment site instead of a dead-initialized `let`.
  - **`no-require-imports`** (`DashboardRenderer.designMode` test) — the hoisted
    `vi.mock` factory uses an `async` factory with `await import('react')`.

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

## 16.0.0

### Patch Changes

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

## 15.0.0

### Patch Changes

- @object-ui/types@15.0.0
- @object-ui/core@15.0.0
- @object-ui/i18n@15.0.0
- @object-ui/react@15.0.0
- @object-ui/components@15.0.0
- @object-ui/fields@15.0.0

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

- 887062c: feat(dashboard): dashboard-level filters (date / region) driving multiple charts (framework#2501)

  A dashboard's `dateRange` + `globalFilters` declarations are now wired end to
  end: the filter values live as dashboard-level variables (the page variables
  primitive, so they're also readable as `page.<name>` in widget expressions),
  a filter bar renders above the widgets, and at render time the dashboard
  broadcasts the active values into every bound widget's inline query —
  `AND`-merged with the widget's own `filter`. Charts stay inline and
  self-contained; each widget maps a filter to **its own** field.

  - **`@object-ui/types`** — `globalFilters[].name` (stable filter/variable key,
    defaults to `field`) and `DashboardWidgetSchema.filterBindings`
    (`Record<string, string | false>`: per-widget field override / `false`
    opt-out). Zod mirrors included. **Pending paired `@objectstack/spec`
    alignment (framework#2501)** — same precedent as `dataset` /
    `categoryGranularity`.
  - **`@object-ui/core`** — new pure `dashboard-filters` module
    (`resolveDashboardFilterDefs`, `dashboardFilterVariableDefs`,
    `buildFilterCondition`, `buildWidgetScopedFilter`); `mergeFilters` lifted
    from plugin-report (re-exported there unchanged). Date presets emit
    date-macro tokens (`{30_days_ago}` …) so widgets resolve them at query time
    like hand-authored filters.
  - **`@object-ui/plugin-dashboard`** — `DashboardFilterBar` (date presets +
    custom range calendar, select with static `options` or `optionsFrom`,
    text/number inputs, reset); `DashboardRenderer` mounts a
    `PageVariablesProvider` when filters are declared and merges the
    widget-scoped condition into inline widgets' `filter` and dataset widgets'
    `runtimeFilter`. Dashboards without filters render exactly as before.

  Binding precedence: explicit `filterBindings` string/`false` → legacy
  `targetWidgets` allow-list → the filter's own `field` (dateRange defaults to
  `created_at`). Static-data widgets are not filtered.

### Patch Changes

- 2ded18c: Fix: a dashboard filter declaring its static `options` in the
  `@objectstack/spec` object form (`options: [{ value, label }]` — the shape
  the spec validates and what framework-authored dashboards ship) crashed the
  whole dashboard with "Objects are not valid as a React child". Caught driving
  the showcase Revenue Pulse dashboard in a real browser.

  `resolveDashboardFilterDefs` now normalizes both the spec object form and the
  bare-string shorthand (`options: ['EMEA']`) to `{ value, label }` pairs —
  `DashboardFilterDef.options` is typed accordingly — and the filter bar's
  select renders labels (the trigger now shows the selected option's label, not
  its raw value). `@object-ui/types` aligns the `GlobalFilterSchema.options`
  shape with the spec union.

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

## 14.0.0

### Patch Changes

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

## 13.2.0

### Patch Changes

- Updated dependencies [80901aa]
- Updated dependencies [53c40c2]
- Updated dependencies [e492b9d]
  - @object-ui/components@13.2.0
  - @object-ui/i18n@13.2.0
  - @object-ui/fields@13.2.0
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
- @object-ui/fields@13.1.0

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

## 12.0.0

### Patch Changes

- Updated dependencies [226fde9]
- Updated dependencies [e36a9c7]
- Updated dependencies [e4de456]
- Updated dependencies [68e2d1c]
  - @object-ui/types@12.0.0
  - @object-ui/core@12.0.0
  - @object-ui/components@12.0.0
  - @object-ui/fields@12.0.0
  - @object-ui/react@12.0.0
  - @object-ui/i18n@12.0.0

## 11.5.0

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

## 11.4.0

### Patch Changes

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
  - @object-ui/react@11.4.0

## 11.3.0

### Patch Changes

- Updated dependencies [d88c8ec]
- Updated dependencies [b7237bb]
- Updated dependencies [d23d6eb]
  - @object-ui/components@11.3.0
  - @object-ui/i18n@11.3.0
  - @object-ui/core@11.3.0
  - @object-ui/fields@11.3.0
  - @object-ui/react@11.3.0
  - @object-ui/types@11.3.0

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

## 11.1.0

### Patch Changes

- Updated dependencies [6726a2b]
  - @object-ui/i18n@11.1.0
  - @object-ui/components@11.1.0
  - @object-ui/fields@11.1.0
  - @object-ui/react@11.1.0
  - @object-ui/types@11.1.0
  - @object-ui/core@11.1.0

## 7.3.0

### Patch Changes

- Updated dependencies [788dbf9]
  - @object-ui/fields@7.3.0
  - @object-ui/types@7.3.0
  - @object-ui/core@7.3.0
  - @object-ui/i18n@7.3.0
  - @object-ui/react@7.3.0
  - @object-ui/components@7.3.0

## 7.2.0

### Patch Changes

- Updated dependencies [8e7c1da]
- Updated dependencies [d23db5c]
  - @object-ui/i18n@7.2.0
  - @object-ui/types@7.2.0
  - @object-ui/components@7.2.0
  - @object-ui/fields@7.2.0
  - @object-ui/react@7.2.0
  - @object-ui/core@7.2.0

## 7.1.0

### Minor Changes

- 677f7ed: feat(charts,dashboard): data-screen customization primitives

  - object-metric `variant:'bare'` — big tinted number + label, no card chrome
    (data-screen KPIs that stay data-bound).
  - object-chart `colors` prop overrides the theme `--chart-1..n` palette so a
    page/dashboard can brand its charts; compact metric formatting (`'0.0a'` →
    "1.1M").
  - ObjectChartSchema.chartType widened to donut/horizontal-bar/column.

### Patch Changes

- 08c47da: feat(dashboard): dataset chart widgets paint select/lookup dimensions in their option colors

  A dashboard `DatasetWidget` chart grouped by a select/lookup dimension (e.g.
  project `health`) painted its categories from the generic `--chart-1..5`
  palette — the same gap the chart view (`object-chart`) had before #1932. It now
  resolves the dimension field's option colors (using the dataset's base `object`

  - dimension→field map the query already returns) and threads them to the
    renderer as a per-category `categoryColors` map, so health green/red/yellow
    paints semantically.

  The value/label→color resolution is extracted into a shared `buildOptionColorMap`
  (`@object-ui/core`) now used by both `DatasetWidget` and `ObjectChart`.

- Updated dependencies [677f7ed]
- Updated dependencies [08c47da]
- Updated dependencies [a71be60]
- Updated dependencies [cb03bc3]
  - @object-ui/types@7.1.0
  - @object-ui/core@7.1.0
  - @object-ui/react@7.1.0
  - @object-ui/components@7.1.0
  - @object-ui/fields@7.1.0
  - @object-ui/i18n@7.1.0

## 7.0.0

### Minor Changes

- 78f9c16: Dataset-bound dashboard widgets now use the measure's display label + format and
  render metric widgets with a consistent card.

  - KPI value and chart legend use the measure `label` (carried on the analytics
    result `fields`) instead of the raw measure name — "Tasks" not "task_count".
  - The KPI value is formatted via the measure `format` hint ("$0,0" → "$616,000").
  - A dataset-bound `metric` widget takes the shared Card wrapper (title + border)
    like kpi/gauge, instead of rendering as bare untitled text.

  Requires `AnalyticsResult.fields[].label`/`format` (objectstack-ai/objectstack#1683).

- 92449ef: Dataset-bound dashboard widgets now render their TRUE chart family instead of
  always a bar chart.

  `DatasetWidget` routes by `widget.type` to the shared advanced chart renderer:
  pie/donut/line/area/scatter/radar/funnel/treemap/sankey/column/horizontal-bar
  each draw distinctly (one series per measure, carrying the measure label).
  `table`/`pivot` render a grouped table of dimensions + measures (formatted via
  the measure `format`). `metric`/`kpi`/`gauge`/`solid-gauge`/`bullet` keep the
  single-value KPI rendering. Families without a distinct renderer map to their
  closest relative (e.g. `spline`→line, `stacked-area`→area, `pyramid`→funnel) so
  a widget never renders as a silently-wrong bar.

### Patch Changes

- cb2fdb1: feat(dashboard): expand drill-in — table/list row→record + scatter/treemap/sankey drill-through

  Drill-in now covers the widgets that were missing it, and formalizes the two
  interaction semantics mainstream BI/low-code platforms separate. `DrillDownConfig`
  gains a `mode` discriminator: `'filter'` (drill-through: aggregate bucket → filtered
  record list) and `'record'` (drill-to-record: a table/list row → that record's detail).

  - Scatter, treemap and sankey charts now wire click → the existing filtered-record
    drill drawer (radar excluded — no single clickable category point). The
    Recharts-payload → drill-event mapping is extracted to pure, tested functions.
  - Object-backed table/list widgets drill to the clicked record in a read-only detail
    drawer (Sheet/Dialog), on by default (`drillDown:{enabled:false}` opts out). Field
    labels and value formatting (incl. tenant-default currency) are shared with the
    table cells so a value reads identically in both. An author-supplied `onRowClick`
    still wins.
  - The chart/KPI drill-through record lists now drill into a record too, completing the
    segment → list → record chain.

- c3749eb: feat(dashboard): dataset chart widgets drill through to records

  Dataset-bound **chart** widgets (bar/line/pie/area/donut/funnel/…) are now
  click-drillable, matching table/pivot. Clicking a segment maps it back to its
  dataset row and opens the same governed drill drawer (raw group keys preserved),
  so a chart-only dashboard is no longer an exploration dead-end. This closes the
  "object-backed chart drills but dataset chart doesn't" inconsistency and aligns
  with mainstream BI (click a chart → see records).

  - `@object-ui/core`: `findChartSeriesRow` — inverse of `buildChartSeries`,
    maps a clicked `{category, series}` back to the source dataset row index
    (matches both dims when a 2nd dimension is pivoted into series).
  - `ObjectChart`: optional `onSegmentClick` lets a host own the chart click
    (and suppress the widget's own object-drill).
  - `DatasetWidget`: lifts the drill machinery to cover both table/pivot and
    chart, and wires the chart's segment click to the precise dataset drill.

- 3d036a9: fix(dashboard): complete the drill chain in the shared DrillDownDrawer

  The chart and KPI drill-through record lists already let you click a row to open
  that record, but the shared `DrillDownDrawer` (used by **pivot** and **dataset**
  widget drill-through) did not — so the segment → list → record chain was
  inconsistent across widget types. `DrillDownDrawer` now enables record drill on
  its filtered list (dialog target, stacking over the drawer), so every
  drill-through list lands on a clickable record.

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

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3
- @object-ui/core@6.2.3
- @object-ui/i18n@6.2.3
- @object-ui/react@6.2.3
- @object-ui/components@6.2.3
- @object-ui/fields@6.2.3

## 6.2.2

### Patch Changes

- Updated dependencies [a66f788]
  - @object-ui/react@6.2.2
  - @object-ui/components@6.2.2
  - @object-ui/fields@6.2.2
  - @object-ui/types@6.2.2
  - @object-ui/core@6.2.2
  - @object-ui/i18n@6.2.2

## 6.2.1

### Patch Changes

- @object-ui/types@6.2.1
- @object-ui/core@6.2.1
- @object-ui/i18n@6.2.1
- @object-ui/react@6.2.1
- @object-ui/components@6.2.1
- @object-ui/fields@6.2.1

## 6.2.0

### Patch Changes

- @object-ui/react@6.2.0
- @object-ui/components@6.2.0
- @object-ui/fields@6.2.0
- @object-ui/types@6.2.0
- @object-ui/core@6.2.0
- @object-ui/i18n@6.2.0

## 6.1.0

### Minor Changes

- 991b62d: Add `compareTo` field to dashboard widgets for period-over-period
  comparison. Supports `'previousPeriod'`, `'previousYear'`, and
  `{ offset: '7d' | '4w' | '1M' | '1y' }`.

  - **Metric / gauge widgets** now compute a delta percentage when `compareTo`
    is set and surface it as a derived `trend` (auto-labelled via
    `dashboard.trend.vsLast*` i18n keys sniffed from the filter macros).
  - **Chart widgets** (line / area / bar / horizontal-bar / scatter / combo)
    overlay a muted comparison-period series (dashed line, lower fill opacity).
    Pie / donut / funnel ignore `compareTo`.
  - New core utilities: `shiftFilterByCompareTo`, `compareToTrendLabelKey`,
    `computeMetricDelta`, and `CompareToConfig` type.
  - `ChartSeries` now accepts `variant: 'comparison'`, `dashArray`, and
    `opacity` overrides for visual treatment.

  See `packages/plugin-dashboard/SKILL.md` for usage examples.

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/core@6.1.0
  - @object-ui/types@6.1.0
  - @object-ui/components@6.1.0
  - @object-ui/fields@6.1.0
  - @object-ui/react@6.1.0
  - @object-ui/i18n@6.1.0

## 6.0.4

### Patch Changes

- @object-ui/types@6.0.4
- @object-ui/core@6.0.4
- @object-ui/i18n@6.0.4
- @object-ui/react@6.0.4
- @object-ui/components@6.0.4
- @object-ui/fields@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3
- @object-ui/core@6.0.3
- @object-ui/i18n@6.0.3
- @object-ui/react@6.0.3
- @object-ui/components@6.0.3
- @object-ui/fields@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2
- @object-ui/core@6.0.2
- @object-ui/i18n@6.0.2
- @object-ui/react@6.0.2
- @object-ui/components@6.0.2
- @object-ui/fields@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1
- @object-ui/core@6.0.1
- @object-ui/i18n@6.0.1
- @object-ui/react@6.0.1
- @object-ui/components@6.0.1
- @object-ui/fields@6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0
- @object-ui/core@6.0.0
- @object-ui/i18n@6.0.0
- @object-ui/react@6.0.0
- @object-ui/components@6.0.0
- @object-ui/fields@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2
- @object-ui/core@5.4.2
- @object-ui/i18n@5.4.2
- @object-ui/react@5.4.2
- @object-ui/components@5.4.2
- @object-ui/fields@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1
- @object-ui/core@5.4.1
- @object-ui/i18n@5.4.1
- @object-ui/react@5.4.1
- @object-ui/components@5.4.1
- @object-ui/fields@5.4.1

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0
  - @object-ui/components@5.4.0
  - @object-ui/core@5.4.0
  - @object-ui/fields@5.4.0
  - @object-ui/react@5.4.0
  - @object-ui/i18n@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2
- @object-ui/core@5.3.2
- @object-ui/i18n@5.3.2
- @object-ui/react@5.3.2
- @object-ui/components@5.3.2
- @object-ui/fields@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1
- @object-ui/core@5.3.1
- @object-ui/i18n@5.3.1
- @object-ui/react@5.3.1
- @object-ui/components@5.3.1
- @object-ui/fields@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0
- @object-ui/core@5.3.0
- @object-ui/i18n@5.3.0
- @object-ui/react@5.3.0
- @object-ui/components@5.3.0
- @object-ui/fields@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1
- @object-ui/core@5.2.1
- @object-ui/i18n@5.2.1
- @object-ui/react@5.2.1
- @object-ui/components@5.2.1
- @object-ui/fields@5.2.1

## 5.2.0

### Patch Changes

- 87bc8ff: `DataEmptyState` (re-exported as `EmptyState`) is now the canonical
  platform primitive for "no records / no data" states. Two new props
  keep it flexible enough to absorb the hand-rolled variants that lived
  in `plugin-list`, `plugin-kanban`, and `plugin-dashboard`:

  - `showIcon?: boolean` — drops the icon container entirely. Used by the
    kanban board-level empty banner, which is a status banner rather than
    a true empty-state.
  - `iconWrapperClassName?: string` — overrides the default muted rounded
    square. Pass `""` to render the icon raw (used by `ListView`'s grid
    empty state, which uses a large standalone glyph).

  Adopters:

  - `plugin-list` (`ListView` grid empty-state) — preserves the existing
    large icon, title, message, add-record button and `data-testid`s,
    but delegates the structural markup to `DataEmptyState`.
  - `plugin-kanban` (board-level "all columns empty" banner) — keeps the
    dashed border + `role="status"` / `aria-live="polite"` semantics.
  - `plugin-dashboard` (`PivotTable` zero-rows branch) — keeps the
    custom 4-quad SVG icon and `pivot-empty-state` test id.

  No public-API change for consumers; the older inline markup is gone
  but the rendered output, translation keys, and test hooks are
  preserved.

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
- Updated dependencies [321294c]
- Updated dependencies [b2d1704]
- Updated dependencies [0a644f0]
- Updated dependencies [a3cb88f]
- Updated dependencies [5425608]
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
  - @object-ui/i18n@5.2.0
  - @object-ui/react@5.2.0
  - @object-ui/fields@5.2.0
  - @object-ui/components@5.2.0

## 5.1.1

### Patch Changes

- Updated dependencies [8955b9c]
  - @object-ui/components@5.1.1
  - @object-ui/fields@5.1.1
  - @object-ui/types@5.1.1
  - @object-ui/core@5.1.1
  - @object-ui/i18n@5.1.1
  - @object-ui/react@5.1.1

## 5.1.0

### Patch Changes

- Updated dependencies [bd8447d]
- Updated dependencies [fbd5052]
- Updated dependencies [d51a577]
- Updated dependencies [1976691]
- Updated dependencies [d1ec6a2]
- Updated dependencies [cf30cc2]
- Updated dependencies [5b80cfd]
- Updated dependencies [49b1760]
- Updated dependencies [c0b236f]
- Updated dependencies [d548d6b]
  - @object-ui/components@5.1.0
  - @object-ui/react@5.1.0
  - @object-ui/i18n@5.1.0
  - @object-ui/types@5.1.0
  - @object-ui/core@5.1.0
  - @object-ui/fields@5.1.0

## 5.0.2

### Patch Changes

- Updated dependencies [cab6a93]
  - @object-ui/i18n@5.0.2
  - @object-ui/components@5.0.2
  - @object-ui/fields@5.0.2
  - @object-ui/react@5.0.2
  - @object-ui/types@5.0.2
  - @object-ui/core@5.0.2

## 5.0.1

### Patch Changes

- @object-ui/types@5.0.1
- @object-ui/core@5.0.1
- @object-ui/i18n@5.0.1
- @object-ui/react@5.0.1
- @object-ui/components@5.0.1
- @object-ui/fields@5.0.1

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
  - @object-ui/i18n@5.0.0
  - @object-ui/react@5.0.0
  - @object-ui/types@5.0.0
  - @object-ui/fields@5.0.0
  - @object-ui/core@5.0.0

## 4.8.0

### Patch Changes

- @object-ui/types@4.8.0
- @object-ui/core@4.8.0
- @object-ui/i18n@4.8.0
- @object-ui/react@4.8.0
- @object-ui/components@4.8.0
- @object-ui/fields@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0
- @object-ui/core@4.7.0
- @object-ui/i18n@4.7.0
- @object-ui/react@4.7.0
- @object-ui/components@4.7.0
- @object-ui/fields@4.7.0

## 4.6.0

### Patch Changes

- Updated dependencies [3ee436d]
  - @object-ui/components@4.6.0
  - @object-ui/fields@4.6.0
  - @object-ui/types@4.6.0
  - @object-ui/core@4.6.0
  - @object-ui/i18n@4.6.0
  - @object-ui/react@4.6.0

## 4.5.0

### Patch Changes

- e9efa55: Clean up TypeScript errors in `plugin-dashboard`:
  - `DashboardGridLayout.tsx`: replace bare `process.env.NODE_ENV` with `globalThis` cast (package doesn't include `@types/node`, and the dev-mode warning shouldn't pull it in)
  - `DashboardRenderer.tsx`: annotate widget callback params explicitly so `noImplicitAny` is happy; guard `widgetType` before indexing
  - `ObjectDataTable.tsx`: cast normalised column return value to the narrow `NormalizedColumn` shape
  - `ObjectMetricWidget.tsx`: fix stale `target === 'modal'` check — the type allows `'dialog'`, never `'modal'`
- Updated dependencies [ab5e281]
- Updated dependencies [d714e85]
- Updated dependencies [6b6afd1]
- Updated dependencies [22fa558]
- Updated dependencies [aa7855f]
- Updated dependencies [170d89f]
  - @object-ui/types@4.5.0
  - @object-ui/fields@4.5.0
  - @object-ui/components@4.5.0
  - @object-ui/i18n@4.5.0
  - @object-ui/core@4.5.0
  - @object-ui/react@4.5.0

## 4.4.0

### Patch Changes

- Updated dependencies [63eb66d]
- Updated dependencies [2bd45af]
  - @object-ui/fields@4.4.0
  - @object-ui/components@4.4.0
  - @object-ui/types@4.4.0
  - @object-ui/core@4.4.0
  - @object-ui/i18n@4.4.0
  - @object-ui/react@4.4.0

## 4.3.1

### Patch Changes

- Updated dependencies [5f4ac6e]
- Updated dependencies [6b683c8]
  - @object-ui/i18n@4.3.1
  - @object-ui/components@4.3.1
  - @object-ui/fields@4.3.1
  - @object-ui/react@4.3.1
  - @object-ui/types@4.3.1
  - @object-ui/core@4.3.1

## 4.3.0

### Patch Changes

- Updated dependencies [f196cf4]
- Updated dependencies [ee1cc96]
- Updated dependencies [0b032be]
- Updated dependencies [115d36a]
- Updated dependencies [4e7bc1b]
- Updated dependencies [8442c05]
  - @object-ui/i18n@4.3.0
  - @object-ui/components@4.3.0
  - @object-ui/fields@4.3.0
  - @object-ui/react@4.3.0
  - @object-ui/types@4.3.0
  - @object-ui/core@4.3.0

## 4.2.1

### Patch Changes

- @object-ui/types@4.2.1
- @object-ui/core@4.2.1
- @object-ui/i18n@4.2.1
- @object-ui/react@4.2.1
- @object-ui/components@4.2.1
- @object-ui/fields@4.2.1

## 4.2.0

### Patch Changes

- Updated dependencies [eb738bd]
- Updated dependencies [650392e]
- Updated dependencies [84b4bf1]
  - @object-ui/i18n@4.2.0
  - @object-ui/components@4.2.0
  - @object-ui/fields@4.2.0
  - @object-ui/react@4.2.0
  - @object-ui/types@4.2.0
  - @object-ui/core@4.2.0

## 4.1.0

### Minor Changes

- c26e0d5: Gauge widgets bound to an object (`type: 'gauge' | 'solid-gauge'` + `object`) now honor display options that were previously dropped on the floor when the renderer fell back to `object-metric`:
  - `format` (e.g. `'0%'`), `currency`, `prefix`, `suffix` are now forwarded to the underlying metric widget.
  - New `invert` option on `ObjectMetricWidget`: when the aggregated value is a rate in `[0, 1]`, displays `1 - value`. Useful for "compliance" / "uptime" gauges that aggregate the opposite signal (e.g. `avg(is_sla_violated)` → display the SLA compliance rate).

### Patch Changes

- @object-ui/types@4.1.0
- @object-ui/core@4.1.0
- @object-ui/i18n@4.1.0
- @object-ui/react@4.1.0
- @object-ui/components@4.1.0
- @object-ui/fields@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12
- @object-ui/core@4.0.12
- @object-ui/i18n@4.0.12
- @object-ui/react@4.0.12
- @object-ui/components@4.0.12
- @object-ui/fields@4.0.12

## 4.0.11

### Patch Changes

- Updated dependencies [1909bc3]
  - @object-ui/i18n@4.0.11
  - @object-ui/components@4.0.11
  - @object-ui/fields@4.0.11
  - @object-ui/react@4.0.11
  - @object-ui/types@4.0.11
  - @object-ui/core@4.0.11

## 4.0.10

### Patch Changes

- @object-ui/types@4.0.10
- @object-ui/core@4.0.10
- @object-ui/i18n@4.0.10
- @object-ui/react@4.0.10
- @object-ui/components@4.0.10
- @object-ui/fields@4.0.10

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9
- @object-ui/core@4.0.9
- @object-ui/i18n@4.0.9
- @object-ui/react@4.0.9
- @object-ui/components@4.0.9
- @object-ui/fields@4.0.9

## 4.0.8

### Patch Changes

- Updated dependencies [3d58eaa]
  - @object-ui/i18n@4.0.8
  - @object-ui/components@4.0.8
  - @object-ui/fields@4.0.8
  - @object-ui/react@4.0.8
  - @object-ui/types@4.0.8
  - @object-ui/core@4.0.8

## 4.0.7

### Patch Changes

- Updated dependencies [7c9b85c]
- Updated dependencies [fd15918]
  - @object-ui/core@4.0.7
  - @object-ui/react@4.0.7
  - @object-ui/components@4.0.7
  - @object-ui/i18n@4.0.7
  - @object-ui/types@4.0.7

## 4.0.6

### Patch Changes

- Updated dependencies [925051d]
- Updated dependencies [1b6dc64]
  - @object-ui/components@4.0.6
  - @object-ui/types@4.0.6
  - @object-ui/core@4.0.6
  - @object-ui/i18n@4.0.6
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
  - @object-ui/types@4.0.5
  - @object-ui/core@4.0.5
  - @object-ui/i18n@4.0.5
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
  - @object-ui/types@4.0.4
  - @object-ui/core@4.0.4
  - @object-ui/i18n@4.0.4
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
  - @object-ui/i18n@4.0.3
  - @object-ui/react@4.0.3
  - @object-ui/components@4.0.3

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1
- @object-ui/core@4.0.1
- @object-ui/i18n@4.0.1
- @object-ui/react@4.0.1
- @object-ui/components@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0
  - @object-ui/components@4.0.0
  - @object-ui/core@4.0.0
  - @object-ui/react@4.0.0
  - @object-ui/i18n@4.0.0

## 3.4.0

### Patch Changes

- Updated dependencies [a2d7023]
- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
  - @object-ui/components@3.4.0
  - @object-ui/types@3.4.0
  - @object-ui/core@3.4.0
  - @object-ui/react@3.4.0
  - @object-ui/i18n@3.4.0

## 3.3.2

### Patch Changes

- @object-ui/types@3.3.2
- @object-ui/core@3.3.2
- @object-ui/react@3.3.2
- @object-ui/components@3.3.2

## 3.3.1

### Patch Changes

- Updated dependencies [b429568]
  - @object-ui/components@3.3.1
  - @object-ui/types@3.3.1
  - @object-ui/core@3.3.1
  - @object-ui/react@3.3.1

## 3.3.0

### Patch Changes

- @object-ui/types@3.3.0
- @object-ui/core@3.3.0
- @object-ui/react@3.3.0
- @object-ui/components@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0
- @object-ui/core@3.2.0
- @object-ui/react@3.2.0
- @object-ui/components@3.2.0

## 3.1.5

### Patch Changes

- @object-ui/react@3.1.5
- @object-ui/components@3.1.5
- @object-ui/types@3.1.5
- @object-ui/core@3.1.5

## 3.1.4

### Patch Changes

- @object-ui/types@3.1.4
- @object-ui/core@3.1.4
- @object-ui/react@3.1.4
- @object-ui/components@3.1.4

## 3.1.3

### Patch Changes

- @object-ui/types@3.1.3
- @object-ui/core@3.1.3
- @object-ui/react@3.1.3
- @object-ui/components@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2
- @object-ui/core@3.1.2
- @object-ui/react@3.1.2
- @object-ui/components@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1
  - @object-ui/components@3.1.1
  - @object-ui/core@3.1.1
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

## 0.1.1

### Patch Changes

- Maintenance release - Documentation and build improvements
- Updated dependencies
  - @object-ui/types@0.3.1
  - @object-ui/core@0.3.1
  - @object-ui/react@0.3.1
  - @object-ui/components@0.3.1

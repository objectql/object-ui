# @object-ui/plugin-charts

## 17.7.0

### Minor Changes

- 045d20b: Relationship-target readers resolve a lookup's target from `reference` alone,
  dropping the `reference_to` fallback arm (objectui#6837, half 2).
  
  Maintainer ruling, 2026-08-31, 原文照录: 「objectui不是前端的项目吗?后端的元数据只要
  对,前端按协议执行就行了呀」. Protocol normalization belongs on the SERVER; the front
  end just executes the protocol. objectstack#13847 landed the server half — a
  `field-reference-to-alias` conversion rewrites stored `reference_to` to
  `reference` on the serve path and in `os migrate meta`.
  
  `reference` is the only target spelling `@objectstack/spec`'s `FieldSchema`
  declares. Measured on the installed 17.2.0: it refuses `reference_to`,
  `referenceTo` and `target` with `unrecognized_keys`, each carrying its own
  "Did you mean -> `reference`?" rename, while a nonsense key gets the same
  refusal with NO rename hint and `reference` parses clean.
  
  ## ⚠️ BREAKING for a hand-written schema that spells `reference_to` — read this
  
  **This is a behaviour change for BYO consumers, and it is being stated rather
  than shipped silently.** ObjectUI is usable without an ObjectStack backend
  (`examples/byo-backend-console`), and a hand-written TypeScript schema passes
  through no zod door, so nothing rejects the legacy spelling at authoring time.
  
  **The break surface is narrower than "all BYO consumers", and this is the
  measurement rather than a blanket claim.** Two ingestion choke points stamp both
  snake_case keys from whichever spelling arrived — `MetadataProvider`'s type
  cache for metadata type `object`, and `ObjectStackAdapter.getObjectSchema`. Any
  def that passed either one already carries `reference` and is **completely
  unaffected**. What is affected is exactly:
  
  - **A `DataSource` implementation other than `ObjectStackAdapter`.**
    `getObjectSchema` is a required member of the published `DataSource`
    interface, and the readers call it on the generic `dataSource` (through
    `useSettledSchema` and directly), so a host adapter's object schema reaches
    them raw. Every in-repo example of one is on this path:
    `ApiDataSource`, `ValueDataSource`, `packages/types/examples/rest-data-source.ts`,
    `examples/byo-backend-console/src/mockDataSource.ts`,
    `packages/runner/src/lib/mockDataSource.ts`,
    `apps/site/app/components/galleryDataSource.ts`,
    `apps/console/src/sdui-workbench-preview.tsx`,
    `packages/plugin-grid/demo/bulk-actions.tsx`.
  
  **Measured on this tree, none of those eight emits a relationship target at all** —
  `reference_to` and `reference` are both zero in each, and
  `examples/byo-backend-console` carries no lookup or master_detail field
  anywhere (its only `reference` hits are a vite triple-slash directive and a
  tsconfig `references` array). The single in-repo producer that WAS on this
  surface, `packages/plugin-gantt/demo/main.tsx`, is fixed here at the producer.
  
  ⇒ **If you author object metadata by hand and spell a lookup's target
  `reference_to`, rename that key to `reference`.** Symptom if you do not: the
  target silently fails to resolve, and the affected surface degrades rather than
  erroring — a related list is not derived, a gantt quick filter falls back to the
  distinct values in the loaded rows instead of the referenced object's full
  domain, a tree stops auto-detecting its parent pointer, a lookup cell shows a
  raw id, a chart's group-by labels stay unresolved.
  
  The ingestion choke point now emits a **dev-mode warning** when a def arrives
  carrying only `reference_to` or `referenceTo` and no `reference`. It names the
  object, the field and the offending key, and points at this ruling. Stamping is
  deliberately unchanged, so nothing that worked stops working. It is memoised
  once per **(object name, field name, spelling, target value)** — every segment
  of that key is pinned, in both directions, in
  `reference-keys.legacyWarning-6837.test.ts`.
  
  ⛔ **This warning does NOT cover the break described above, and it is worth being
  exact about that rather than letting it read as mitigation.** It lives in
  `normalizeFieldReferenceKeys`, reachable only through
  `normalizeSchemaReferenceKeys`, which has exactly two production call sites —
  `MetadataProvider` (metadata type `object`) and
  `ObjectStackAdapter.getObjectSchema`. Both of those also STAMP the def, so the
  warning fires precisely where the def still resolves and nothing is broken. A
  hand-written schema served through any OTHER `DataSource` — the break surface —
  reaches a reader raw: it never passes through this code and produces **no
  warning at all**. On that path the failure is exactly as silent as before.
  A reader-side or shared-resolver diagnostic, which would cover it, remains open
  on objectui#6837.
  
  ## What did NOT change
  
  **Every key these readers EMIT is byte-identical**, and that was verified
  mechanically over the whole diff rather than asserted. Eleven of the sixteen
  sites write a target onto a bag whose own contract spells it `reference_to` (or
  camelCase `referenceTo`): the six whose read and write share a line —
  `RecordDetailDrawer`, `RelatedList`, `buildDefaultPageSchema`, `ListView`,
  `FilterConditionField`, `resolveActionParams` — plus five more that read on one
  line and emit on another, and so are just as much emitters: `RecordDetailView`,
  `RecordMetaFooter`, `ObjectGallery`, `fieldEnrichment` (all `reference_to`) and
  `UserFilters` (`referenceTo`). Only the right-hand read narrowed anywhere; the
  emitted key is what its target contract declares, and renaming it would be a
  separate change.
  
  **Three readers were deliberately left alone.** `LookupCellRenderer`
  (`fields/src/index.tsx`), `LookupField` and `UserField` read `FieldMetadata` —
  ObjectUI's OWN contract, whose `LookupFieldMetadata` declares `reference_to` and
  never declares `reference`. They are fed by the emitters above and by published
  example schemas (`examples/schema-catalog/src/schemas/fields-lookup/*.json`), so
  narrowing them would break in-repo producers, and `plugin-grid`'s
  `relationalMetaCopySet.derivation.test.ts` re-derives its read set from exactly
  those three sources — where `reference_to` is recorded with verdict
  `adapter-stamped`. `DetailViewFieldSchema` is likewise untouched.
- 0349555: A sankey with no positive flow says so, instead of rendering an empty div
  (objectui#7140).
  
  `AdvancedChartImpl`'s sankey arm keeps only strictly positive measures, so a
  chart handed **real rows** whose measure is all `0`, all `null`, all negative,
  or unparseable built no links and returned a bare `<div>`. Measured in Chromium
  against a populated control: the control drew 1 `<svg>` / 7 `<path>` /
  26 descendants; each of those four tiles rendered `descendantCount: 1`,
  `svgCount: 0`, `textContent: ''`, and their screenshots hashed identical to one
  another. No marks, no text, no `role` — a tile indistinguishable from a widget
  that had crashed, which is the one distinction the file's other refusals exist
  to make.
  
  It now renders through the `ChartRefusal` shell those refusals already use —
  same box, same `role="status"`, and a new `data-chart-error="no-positive-flow"`
  — reading *"This chart has no flow to draw: no row's `<measure>` is above
  zero."*
  
  Two boundaries are deliberate and pinned:
  
  - **No rows at all is untouched.** That is the empty-result question, answered
    upstream in `ObjectChart` where the query outcome is known; a sentence about
    what the rows contain would be false about a dataset with no rows in it.
  - **One positive row among zeros still draws.** The refusal fires on an empty
    link set, never on a thin one.
  
  One code and one sentence for three causes (a genuinely all-zero flow, values a
  flow cannot represent because they are negative, and measures `Number(…) || 0`
  folds to zero): naming any single cause would be false for the other two, so
  the copy names the predicate the filter actually applies, which is true for all
  three. No recovery is promised. Every other chart family is byte-identical —
  eight of the twelve tiles in the browser sweep hashed unchanged.
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
- 01c27c4: Fix: a chart series' `type` override (`ChartDataSeries.type`, objectui#6121) is now
  honoured when the series array is written in the internal `dataKey` binding, not only
  the `name` binding (objectui#7681) — the same sentence #2945 shipped for the other
  dialect.
  
  `ChartRenderer`'s `isInternalShaped` fast path (introduced by #2945 to fix a different
  bug — a `name`-shaped `series` shadowing the normalized `dataKey`-shaped one) took the
  raw authored array untouched whenever every entry already carried `dataKey`, bypassing
  `normalizeSeries` — the only place `type` is translated to the renderer-internal
  `chartType`. So an author who wrote `series: [{ dataKey: 'revenue' }, { dataKey:
  'margin', type: 'line' }]` — both keys independently valid on `ChartDataSeriesSchema` —
  got neither the override nor a combo chart, silently.
  
  `ChartRenderer` now always takes the series array through the one normalization layer
  (objectui#2880 S1) instead of special-casing the `dataKey` shape around it.
  
  **Breaking on unmodified documents, deliberately — this changes rendered output.** A
  chart authored with a `dataKey`-shaped series carrying a `type` override used to render
  one family for every series; it now renders the mix the author actually described (the
  card's own regression case: two bars become one bar and one line).
  
  **Two more effects on the delivered key set for a `dataKey`-shaped series array**,
  undisclosed until now — `normalizeSeries` is a no-op on a well-formed entry, but these
  two cases were never well-formed under the old fast path either:
  
  - An i18n `label` written as a `{ en, zh-CN, … }` record on a `dataKey`-shaped entry was
    previously forwarded as that raw object; it is now resolved to a plain string (the
    first string-valued limb), matching what a `name`-shaped series already got from
    `normalizeChartSchema`.
  - A `dataKey`-shaped entry whose `dataKey` does not resolve to a non-empty string (and
    has no `name` to fall back to) was previously forwarded as-is; it is now dropped from
    the delivered series array, matching what a `name`-shaped series with no usable key
    already got.
  
  No existing well-formed internal caller (`DashboardRenderer`, `ObjectView`, the dataset
  path) changes behaviour — every series entry those callers construct already carries a
  non-empty string `dataKey` and a string `label`.
- 967e5d8: Chart `series[].opacity` and `series[].dashArray` are honoured on every series,
  not only on a `variant: 'comparison'` one (objectui#7698).
  
  `@objectstack/spec` declares `ChartSeries.opacity` ("Override series opacity")
  and `ChartSeries.dashArray` ("Override stroke dash pattern") as unconditional
  per-series overrides, and `normalizeSeries` read both off every series. The
  renderer then honoured them on a comparison overlay only, so an author who
  wrote `{ name: 'cost', opacity: 0.6 }` or `{ name: 'cost', dashArray: '4 4' }`
  on a primary series got a mark drawn exactly as if the key were absent. Fixed
  in the renderer rather than by narrowing the published declaration to match:
  the spec is the contract of record, and a renderer's partial implementation
  does not get to dictate it (AGENTS.md #0.1).
  
  **Two gaps, not one.** The `variant` guard was the visible half — `comparisonStyle`
  returned `null` for any other variant. The second half only showed on
  `dashArray`: that helper already returned an AUTHORED dash for every family
  (the `??` takes the left side whatever the kind), and the **Bar and Scatter
  marks** then passed `fillOpacity` only, dropping `strokeDasharray` and
  `strokeOpacity` on the floor — so an authored dash was lost on those two
  families even on a comparison series. A fix aimed at the guard alone would have
  left that untouched. `comparisonStyle` is now `seriesStyle`, and the Bar and
  Scatter marks pass all three channels.
  
  **Comparison series are unaffected.** The authored branch already won over the
  muted defaults, and those defaults stay gated on `variant: 'comparison'`: a
  comparison series carrying neither key keeps its lower opacity and its `'4 4'`
  line/area dash exactly as before. The two stroke defaults no mark ever consumed
  (bar and scatter — neither is stroked by this renderer) are now spelled
  `undefined`, so opening `strokeOpacity` on those marks does not hand them a
  default they never had.
  
  Only a stroked mark can show a dash, so on a `bar` or `scatter` mark an
  authored `dashArray` reaches the mark and paints nothing — the mark's geometry,
  not a condition on the key. The `ChartDataSeries` mirror docs and the
  plugin-charts reference, which stated the comparison-only condition as an
  interim measure, are corrected in the same change.
- 0758bd8: `ObjectChart` refuses an object-bound chart that declares no category axis (objectui#8168).
  
  An object-bound chart that named no field to group by used to be composed anyway.
  `runAggregate` passed `schema.aggregate` to `ds.aggregate(objectName, { field,
  function, groupBy, filter })` with no guard on `groupBy`, and the `ds.find` leg
  handed the same bag to `aggregateRecords`, which buckets every record on
  `record[groupBy] ?? 'Unknown'`. So one path asked a driver to group by `undefined`
  and the other collapsed the whole object into a single `'Unknown'` bar — and which
  of those a reader saw was decided by the data source, not by the renderer. The only
  loud states this component had were a fetch `error` (`chart-error`) and a generic
  "No data yet"; neither is a statement about an absent binding.
  
  `ObjectCalendar`, `ObjectGantt` and `ObjectTimeline` each already refuse a view that
  declares no axis. This is the fourth, following `ObjectTimeline`'s shape
  (objectui#7459): a `role="alert"` box, `data-testid="chart-missing-category-axis"`,
  naming the bindings the author can declare — `aggregate.groupBy`, `xAxisKey`,
  `xAxis.field` — rendered from the resolver's own vocabulary so the message cannot
  drift from what the resolver reads.
  
  **Breaking, deliberately — and this repo ships breaking as `minor`.** A chart that
  previously rendered an `'Unknown'`-bucketed bar (or whatever the driver did with
  `groupBy: undefined`) now renders the refusal instead. That is the intent: the
  picture it drew was not a picture of the data.
  
  It keys on the CATEGORY alone. A measure may legitimately be absent — `count` takes
  no field — so refusing on an absent measure would refuse `count` grouped by a
  declared category, a chart that renders correctly. Four shapes are deliberately
  untouched: an ADR-0021 `dataset` chart (which may declare no dimension), a chart
  carrying authored `data` or a `bind` scope (no field name is read to fetch those
  rows), a spec-shape `xAxis: { field }` with no `xAxisKey` (resolved through
  `normalizeChartSchema`, this package's one translation of the author-facing shape),
  and every schema the five in-repo producers compose today — all five floor their own
  category, so none of them can reach the refusal.
  
  This does **not** retire the six `'name'` / `'value'` floors at the three relay faces;
  that is the remainder of objectui#7547 and is mechanical only once this screen exists.
  
  New key `chart.unconfigured.noCategoryAxis` in all ten locale packs.
- 6f017e9: Dashboard chart widgets no longer render as a blank area when their height class
  resolves to `auto`.
  
  `ChartContainer`'s min-size fallback was applied only to the wrapper `div`.
  Recharts measures its own `width:100%;height:100%` size-detector element, and a
  percentage height never resolves against an ancestor's `min-height`, so the
  wrapper obediently grew to 280px while the measured element stayed at 0 — and
  Recharts renders no children at all for a non-positive box. The result was a
  widget card with its title over an empty chart area: no marks, no refusal, no
  empty state, and permanent, because a box that never changes fires no resize.
  The floor is now applied to the measured element as well, under the same
  condition, so an author's explicit height still wins.

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
- 40c4711: A sankey that drew only SOME of its rows now says how many (objectui#7148).
  
  The sankey arm keeps strictly positive measures
  (`data.filter((r) => (Number(r?.[dataKey]) || 0) > 0)`), so a mixed dataset
  drew a normal, healthy, confident chart of a fraction of itself and nothing
  anywhere recorded that the other rows existed. Measured in Chromium across 27
  tiles: `[{New business: 40}, {Refunds: -25}, {Chargebacks: -12}]` rendered
  `svg: 1`, `path: 3`, 18 descendants, no `role`, no text, and — against a live
  console control that did fire on the same instrument — zero console output.
  Its screenshot hashed byte-identical to five other datasets, one of which
  genuinely had a single row. Six datasets, one image: a reader had no bit of
  information separating a complete flow from a third of one.
  
  The discard itself stands — a flow has no negative width, so it is the only
  thing that arm can do with those rows. What is added is a footnote under the
  plot naming the ratio and the predicate the filter applies:
  
  > Showing 1 of 3 rows — 2 rows have no `amount` above zero, which a flow
  > cannot draw.
  
  It names the predicate rather than a cause because `Number(…) || 0` folds
  negatives, zeros, `null`, unparseable strings and a missing key into one
  discard, and all five were measured reaching this branch beside a survivor;
  naming any one of them is a sentence that is false for the other four.
  
  A complete flow is byte-for-byte unchanged and gains no wrapper element, and a
  drawable sankey is never replaced by prose: the `no-positive-flow` refusal
  still owns the case where NOTHING survives the filter, and the "one positive
  among zeros still draws" boundary still draws — that fixture is itself a
  thinned dataset, so it now draws *and* says so.
- e8c553b: A scatter handed more than one series now refuses instead of drawing a false picture.
  
  Scatter binds one measure: `series[0].dataKey` is the y axis, and every series was
  handed the same rows through that one axis. A second series therefore added a
  colour and a legend entry and nothing else — measured, two series over two rows
  painted four symbols at two positions, each drawn twice, and the second measure's
  values appeared nowhere on the plot. The data was valid and the picture was
  confidently wrong, which no existing refusal could see.
  
  A `chartType: 'scatter'` with two or more `series` now renders the renderer's
  refusal shell under `data-chart-error="scatter-multi-series"`, stating that a
  scatter plots one measure, naming the fix (keep exactly one series) and listing
  the series keys it was handed. A single-series scatter is unchanged.
  
  This refusal counts authored `series` only. `compareTo` on scatter is out of
  its scope: objectui#7402 ruled (b) that scatter joins pie / donut / funnel in
  excluding `compareTo` — `supportsCompareTo` and the dashboard widget path stop
  synthesising a comparison series for it, so no `…__comparison` overlay is ever
  built for a scatter and this guard is never reached by a compare-to document.
  That exclusion ships as a separate change; until it lands, a `compareTo`
  document still reaches the renderer as two series and refuses here today.
  
  No multi-measure projection is built (maintainer ruling, 2026-09-02): nothing
  in-repo authors a two-series scatter, so that capability waits for a real caller.
  The refusal copy is `chart.scatterOneMeasure` in all ten locale packs.
- bb459ea: Name the scatter legend's series, so its swatch stops reading as a stray data point
  (objectui#7248).
  
  The Chart Gallery scatter ("Estimate vs Progress") appeared to draw a seventh point
  below the x-axis, outside the plot area. It was not a point. `ChartLegendContent`
  resolves a label as `config[nameKey || item.dataKey || 'value']`, and a `<Scatter>`
  carries **no `dataKey`** — scatter's keys live on the XAxis/YAxis, not on the mark — so
  the key collapsed to the literal string `'value'`, missed a config keyed by measure
  name, and the legend entry rendered its colour swatch with no text beside it. An 8x8
  square in `--chart-1`, the same colour as the marks, sitting under the x-axis.
  
  Measured on the running showcase in real Chromium: the swatch sat at cy 341 against a
  plot area ending at cy 295, on a y scale of 4.835 px per unit — y = -9.5, at x ≈ 45.
  That is the "x≈40, y≈-10" the report described, to the pixel, and all six real marks
  were inside the plot area at every viewport width swept from 1440 down to 480.
  
  **The y domain was not the defect and is unchanged.** Clamping it — the fix the report
  asked for — would have created the bug it described: mixed-sign and all-negative
  fixtures are pinned here drawing every mark, because recharts already extends the
  domain to cover negative values.
  
  Two changes. The scatter now passes `nameKey` so its legend resolves the measure's
  label, and `ChartLegendContent` falls back to the series `name` recharts itself put on
  the legend item when the config lookup misses. The second closes the class rather than
  this one instance: the swatch renders unconditionally, so a config miss must never
  leave it anonymous. Charts whose config already resolves are unaffected — only a
  currently-empty label changes.
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
- ed4a2f1: fix(plugin-charts): `pie-chart`, `donut-chart`, `radar-chart` and `scatter-chart` render as the family they name
  
  A schema written as `type: 'pie-chart'` (or `plugin-charts:pie-chart`, and likewise donut / radar / scatter) drew a **bar chart**. The four registrations declared their family as `defaultProps: { chartType: … }`, and nothing on the SDUI path has ever read a registration's `defaultProps` — so `ChartRenderer` resolved no family and `AdvancedChartImpl` fell to its `'bar'` default. Valid data, a confidently wrong picture, and no `data-chart-error` that could fire.
  
  `ChartRenderer` now derives the family from the schema's own `type`, through `normalizeChartSchema` — the package's single translation point, so the exported `normalizeChartSchema` answers what the runtime actually draws. An explicit `chartType` still wins, so `plugin-charts:chart` with `chartType: 'scatter'` is unchanged.
  
  The five inert `defaultProps: { chartType: … }` are removed with it rather than left beside a mechanism that works. Registration `defaultProps` remains unread on the SDUI path repo-wide; activating it generally is a separate, wider change and is not this one.
  
  ⚠️ `scatter-chart` now genuinely reaches the scatter arm, so a two-series `scatter-chart` now renders the `scatter-multi-series` refusal it was always supposed to.
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
- 894d103: `ObjectChart`'s wrapper div now carries `h-full`, keeping the height chain intact from a dashboard grid cell's declared height down to the element Recharts measures. Previously the chain died at the plain auto-height wrapper: `height: 100%` on the chart container computed to `auto`, Recharts measured a permanent zero, and only the `CHART_MIN_HEIGHT` floor (#5503) kept dashboard charts visible — at a fixed floor height instead of filling the cell (#5451). Under auto-height parents `h-full` resolves to `auto`, so non-dashboard hosts are unchanged.
- 5eddeeb: Pie, donut, funnel and treemap now say when rows carry no magnitude they can draw.
  
  These four families size a mark BY its measure, so a row whose value is zero,
  negative, `null` or unparseable stays in the data and is given no area. Measured
  in Chromium across 74 tiles: an all-zero pie put ZERO non-white pixels on the
  page while its DOM carried 31 descendants and a real `svg`; a treemap handed
  `40 / null`, `40 / 0` or `40 / -25 / -12` rendered one full-bleed leaf that was
  byte-identical to a genuinely one-row treemap; and a funnel handed `40` beside a
  `null` drew no segments at all and labelled the tile with the row that had no
  value.
  
  When no row can be sized, these charts now render the file's refusal shell
  (`no-positive-magnitude`) instead of a blank tile. When only some rows can be
  sized, the chart still draws and carries a note counting the ones it could not.
  All-positive charts, charts handed no rows at all, bar charts, and both sankey
  answers are unchanged.
- cef27e2: The value-fallback label prettifier `humanizeLabel` has one implementation instead of two byte-identical copies.
  
  `humanizeLabel` turns a stored value into a display string when nothing else
  resolves it — an option with no declared label, an object name, a chart axis
  member. It existed twice, byte for byte: once in `@object-ui/fields` (read by
  `plugin-grid`, `plugin-gantt`, `plugin-detail` and by that package's own
  renderers) and once as a deliberate local copy in `plugin-charts`'
  `ObjectChart.tsx`, whose comment said it was there "to avoid a dependency on
  `@object-ui/fields`".
  
  Two copies of one convention is a live hazard rather than tidiness: one
  dashboard can hold a chart and a grid over the same stored value, so a change
  landing on one copy alone would put that value on screen under two spellings at
  once. The single implementation now lives in `@object-ui/core` — the shared
  ancestor both packages already depend on, so the dependency the copy existed to
  avoid is still avoided and no new edge is created, and core takes no React
  (objectui#4389: core-canonical logic, plugins consume). Both former sites
  re-export it, so `import { humanizeLabel } from '@object-ui/fields'` keeps
  working unchanged.
  
  **Nothing rendered changes.** The surviving implementation is byte-identical to
  both deleted copies, and each former call site is pinned by identity against the
  core function — not by a copied output table that someone would have to remember
  to edit in two places.
  
  The core module also writes down, for the first time, why this convention stays
  distinct from `humanizeFieldKey` (the KEY fallback, in `@object-ui/plugin-dashboard`),
  which additionally splits camelCase:
  
  ```
  input                humanizeFieldKey     humanizeLabel
  needs_analysis       Needs Analysis       Needs Analysis
  NeedsAnalysis        Needs Analysis       NeedsAnalysis        <- differ
  unitPrice            Unit Price           UnitPrice            <- differ
  BestCase             Best Case            BestCase             <- differ
  lost-to-competitor   Lost-To-Competitor   Lost To Competitor   <- differ
  ```
  
  A field KEY is authored in the codebase and carries a machine spelling, so
  splitting camelCase recovers words its author meant. A stored VALUE is arbitrary
  tenant data, where a mid-token capital is not reliably a word boundary and
  splitting it rewrites what the tenant wrote (`McDonald` to `Mc Donald`). The two
  conventions also do not nest — on the last row each leaves alone the separator
  the other rewrites. Whether they should ever converge is a separate decision
  that would move rendered output in four packages at once; it is deliberately not
  made here.
- d6fe1e1: Draw every categorical x-axis label on short axes
  
  A vertical bar chart in a dashboard-width widget dropped most of its x-axis
  labels — three bars drew one label, five bars drew two — leaving the bars
  unnamed, with no legend to fall back on because a single-series bar chart has
  none.
  
  The x axis applied one tick policy to time and category alike (`preserveStartEnd`
  with a 48px `minTickGap`), which is right for hundreds of dates and wrong for a
  band axis, where a dropped tick is an identity the reader cannot recover rather
  than a sample they can interpolate. It was also keyed to the viewport rather
  than the widget, so a 200px chart inside an 800px console was treated as a wide
  one.
  
  Bar, column, line, area and combo charts now draw every label on a categorical
  x axis of five buckets or fewer — rotating, and ellipsising an over-long name
  rather than clipping it. Longer axes keep the existing measured thinning, and
  horizontal bars are unchanged.
- 6c5ee71: `ObjectChart` now depends on the `fieldOptionLabel` resolver directly instead of
  holding it behind a ref, so a chart re-resolves its groupBy option labels when
  the resolver genuinely changes (objectui#5587).
  
  The ref existed for a reason that no longer holds. `useSafeFieldLabel()` returned
  a fresh object on every render outside an i18next provider, so a direct
  dependency made `fetchData`'s `useCallback` identity fresh on every render, and
  the effect that depends on `fetchData` refetched on every render — an unbounded
  loop. `ObjectChart` worked around that locally with `fieldOptionLabelRef` plus a
  `useEffect` keeping it current. `useObjectLabel`'s memo now holds with or without
  an i18next instance bound (objectui#5564), so the resolver's identity is stable
  on both paths and the indirection buys nothing.
  
  It did cost something, and that is the user-visible half: a ref-hidden dependency
  meant `fetchData` did NOT re-run when the resolver changed. A chart mounted
  before its `I18nProvider`, or rendered across a language switch, kept serving
  groupBy labels resolved by the old resolver until some unrelated dependency
  (object name, filter, aggregate) happened to move. It now refetches once on that
  transition and shows labels in the active language.
  
  Pinned by `ObjectChart.fieldOptionLabelRefetch.test.tsx`, which counts fetches
  across forced re-renders both outside and inside a provider. Reverting
  `useObjectLabel.ts` to its pre-objectui#5564 state turns the no-provider case red
  (2 fetches instead of 1, alongside React's "Maximum update depth exceeded"), so
  the removal is pinned to the fix that unlocked it rather than to a comment.
- 93bbc20: Scatter now says when it cannot place a row, instead of drawing an empty axis.
  
  Scatter is the only two-measure positional chart in the renderer: `xAxisKey` feeds
  a numeric X axis and `series[0]` a numeric Y axis, so a point exists only when
  both are numbers. Measured in real Chromium, rows it could not place produced a
  tile byte-identical to a scatter handed no rows at all, and six different
  authoring failures shared one image. A chart with one placeable row among three
  was 99.75% pixel-identical to a genuinely one-row scatter.
  
  Handed rows it cannot place any of, a scatter now renders the file's refusal
  shell under `data-chart-error="no-plottable-points"`, naming both keys. When some
  rows place and some do not it draws as before with a `data-chart-note="unplotted-points"`
  footnote carrying the count. Charts whose rows all place are byte-identical to
  before, and no wrapper element is added to them.
  
  The predicate is positional, not magnitude-based: zero and negative coordinates
  are ordinary scatter data and keep drawing.
- dd35800: `ObjectChart` now renders a self-describing empty state when its query succeeds
  and returns no rows, instead of falling through to a bare chart frame.
  
  The frame was measured in a browser rather than assumed: recharts derives its
  ticks from the data, so with an empty result the bar and line families emit two
  hairline axis rules and no `text` nodes at all, and pie/donut emit nothing —
  there are no labelled axes to tell the reader what would have been plotted.
  Beside the component's own red "Failed to load chart data" box, a blank tile
  gives the reader nothing to distinguish a young chart from a broken one.
  
  The copy is the one `plugin-dashboard` already shows on the dataset-bound path
  ("No data yet" / the load succeeded / the source name), so the same chart over
  the same empty result no longer reads two different ways depending on which
  widget drew it. Charts with inline authored data are unchanged — they ran no
  query to report on.
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
- Updated dependencies [4c68077]
- Updated dependencies [7977ff9]
- Updated dependencies [3beef6d]
- Updated dependencies [06b8c42]
- Updated dependencies [46b9bc9]
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
- Updated dependencies [33a3b3c]
- Updated dependencies [b87f15b]
- Updated dependencies [045d20b]
- Updated dependencies [c18d099]
- Updated dependencies [adb2a86]
- Updated dependencies [03380aa]
- Updated dependencies [3561bd2]
- Updated dependencies [bf97b98]
- Updated dependencies [320374d]
- Updated dependencies [b0d308d]
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
- Updated dependencies [b655a9d]
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
  - @object-ui/components@17.7.0
  - @object-ui/react@17.7.0

## 17.6.0

### Minor Changes

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

- e132433: A grouped chart whose SECOND dimension was never projected says so instead of
  drawing an empty frame.
  
  "Cannot know refuses loudly" was answered on the first dimension only.
  `AdvancedChartImpl`'s `hasNoCategoryKey` (framework#4033) names an unprojected
  x-axis dimension rather than drawing a bare axis; the series axis had no
  counterpart, so a pivot whose second dimension was absent from the result rows
  produced `series: []` and rendered axes, grid, tooltip and legend around zero
  marks — indistinguishable, to the author, from "no data matched".
  
  Such a chart now renders the same explanatory placeholder
  (`data-chart-error="no-plottable-series"`) and logs the same diagnostic pair the
  category-axis guard logs: the axis it did plot, and the keys its rows actually
  carry.
  
  The three-way distinction is unchanged and pinned: null / empty-string group
  values still DRAW (they are real groups with real buckets), a partially
  projected group key still draws what projects — mirroring the category axis,
  which refuses only when NOT ONE row carries the key — and an ordinary pivot
  renders unchanged. The refusal is limited to the families whose marks come from
  `series` and nothing else (bar, horizontal-bar, line, area, combo); pie, donut,
  funnel, radar and scatter draw from a `value` column with no series declared, so
  they are untouched. A caller that computed no series binding at all
  (`series === undefined`) is also untouched.
- f95434b: Combo charts drill from their marks
  
  objectui#4692, ruled Option B. `AdvancedChartImpl` built `cartesianClickProps` once and
  applied it to exactly one element — the final cartesian `ChartComponent`. The `combo`
  branch returns earlier, from its own `ComposedChart`, which was rendered with `data` and
  no click props at all, so a combo chart fired `onChartClick` never: not on a mark, not on
  the axis. Its marks are the same `Bar` / `Line` / `Area` components the drillable branch
  renders.
  
  The trap that made this worth fixing rather than documenting is that the family is
  **derived**, not only authored: `effectiveChartFamily` resolves a chart to `combo`
  whenever its series declare different families (objectui#2945), so adding `type: 'line'`
  to one series of a drillable bar chart silently turned that chart's drill-through off —
  nothing in the authored spec said drill had been touched, and nothing errored.
  
  A combo's `Bar` / `Line` / `Area` marks now emit `{ category, categoryId, series, value }`
  with the same semantics the plain cartesian branch gives, reusing the item-level
  series-identity machinery from objectui#4672 / objectui#4682: the mark handler records the
  series it was rendered with, the chart-level handler composes the one event, so a gesture
  still produces exactly one `onChartClick`. Retyping one series now changes that series'
  mark and nothing else.
  
  **Only the marks drill.** A click on a combo's plot surface or axis stays silent, where
  the plain cartesian branch falls back to its axis-level answer. A combo plots several
  measures on one plot, so a surface click there has no single series to report and the
  fallback would have to invent one — the same reasoning objectui#4672's ruling gave the
  pivoted case. Combo also carries no chart-wide pointer cursor for that reason; the
  affordance sits on the marks that answer.
  
  Radar is now the one cartesian-adjacent family with no click wiring. The `onChartClick`
  doc comment, corrected in objectui#4705 to say combo was a no-op, states the new rule and
  its one deliberate exception.
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
- d298be8: Cartesian chart clicks report the clicked series and value again
  
  objectui#4672. `AdvancedChartImpl`'s chart-level click handler built its drill
  event from `payload.activePayload[0]` — a **recharts 2** field. This package is
  on recharts 3, which hands a chart-level `onClick` a `MouseHandlerDataParam`:
  `{ activeCoordinate, activeDataKey, activeIndex, activeLabel, activeTooltipIndex,
  isTooltipActive }`, and nothing else. `activePayload` appears nowhere in the
  shipped library, so the read was `undefined` on **every** cartesian click and
  every bar / line / area drill event carried `series: undefined, value: undefined`.
  Nothing went red: the payload is typed `any` at the call site, and every existing
  drill test either calls the pure lookup directly or stubs the chart.
  
  The handler now works from the payload recharts 3 actually sends:
  
  - **The value** is read off the clicked row — `data[activeTooltipIndex]`, the
    array this component was given — for the resolved measure, the same way the
    bucket identity has been read since objectui#4508.
  - **The series** comes from `activeDataKey` when the payload carries one, and
    otherwise from the chart's own series list when it plots exactly one series,
    where the clicked column can belong to nothing else.
  - **A click with no active tick** (the plot margins, an axis label) resolves to
    no row instead of to bucket zero. recharts reports a **null** index there, not
    an absent one, and `Number(null)` is `0` — so such a click used to drill the
    first bucket's records. That is a wrong drill, not a dead one.
  
  A drill on a single-measure chart therefore names its measure and carries its
  value again — `resolveDrillTitle` composes the drawer title from them, and an
  authored drill filter can reference `${event.value}`.
  
  **Still open, deliberately:** a chart plotting several series under the default
  SHARED cursor. Measured against recharts 3.10.1, an axis interaction is
  dispatched with `activeDataKey` hard-coded `undefined` (bar, line and area
  alike, on the mark and on empty plot area), so the payload names no series at
  all — and a pivoted dataset chart's drill lookup requires one. The series is
  left unresolved rather than guessed: naming a series the user did not click
  drills to another group's records, which is worse than the dead click. Resolving
  it needs the clicked mark rather than this payload; objectui#4672 carries that
  half.
- Updated dependencies [88085e3]
- Updated dependencies [69251bf]
- Updated dependencies [57e668f]
- Updated dependencies [516663d]
- Updated dependencies [41ac1b7]
- Updated dependencies [1eaf0a1]
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
- Updated dependencies [7f96b10]
- Updated dependencies [167ec42]
- Updated dependencies [616a2a5]
- Updated dependencies [0046d8f]
- Updated dependencies [f1d4748]
- Updated dependencies [bea374e]
- Updated dependencies [b1119ec]
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
  - @object-ui/components@17.6.0
  - @object-ui/core@17.6.0

## 17.5.0

### Minor Changes

- 5fac011: Publish `normalizeChartSchema` from the package entry.

  `normalizeChartSchema` is the single place the author-facing chart schema is translated into the renderer's internal pipeline contract, and `ChartRenderer` calls it on every render. It was not reachable from the package's only entry point, so a consumer that wanted to assert what `AdvancedChartImpl` is actually handed had to restate the translation rather than run it. It is now exported from the entry, along with the `NormalizedChartSchema` type it returns.

  Additive only: nothing is removed or renamed, and the module was already in the entry's eager import graph via `ChartRenderer`, so this publishes a name rather than shipping new bytes.

### Patch Changes

- 5900ac5: Analytics surfaces now run resolved select-option labels through the locale bundle — the chart legend and the related list on one page stop disagreeing

  A dashboard widget grouped by a `select` field rendered the option's authored English label while the related list beside it rendered the translation. The decisive evidence in objectui#4030 is the stored value `orion`: the chart read `Orion Engineered Carbons`, a string with no resemblance to the value and matching the object's `label` byte for byte. So the analytics path had already RESOLVED the option label — it simply never ran the result through the i18n bundle before display. (`domestic → Domestic` differs from its value by case alone, which is why the first diagnosis, "the report groups by stored value", was wrong.)

  There is exactly one resolution channel and this change reuses it rather than adding a chart-side dialect: `fieldOptionLabel` from `useObjectLabel`, i.e. `{ns}.fieldOptions.<object>.<field>.<value>` — the convention `@objectstack/spec` names objectui as the reader of, and the one list, form, kanban and record-picker surfaces already translate select options through. The bundle is applied ONCE, at the output of the label net that landed in objectui#4053/#4263, on the shared option list every consumer reads: chart axis and legend, the table/pivot cells of a dotted dimension, that table's CSV export, per-category colours and the declared category order. `@object-ui/core` gains `localizeFieldOptions` (the pure mirror of `translateOptions`), an optional translator on `buildDimensionLabelMap`, and `resolveDimensionFieldMeta` — the same single relationship walk `resolveDimensionFieldOptions` performs, now keeping the object that OWNS the terminal field, because for `crm_account.industry` the bundle key is `crm_account`, not the dataset's base object.

  Two properties the fix is shaped around. The rows reach this net keyed either way — by stored value when the server did not resolve the dimension, by the English label when it did (ADR-0021) — and the reported screen is the second case, so the map answers to both keys and lands on the same translated display. And identity is untouched: `relabelDimensions` still rewrites display only, so a drilled chart segment clicked as `欧励隆` filters by `orion`, bucket ids and pivot totals keep their raw keys, and an option with no bundle entry (or an `en` console) renders exactly the authored label it renders today.

  The per-locale work moved from the metadata fetch into the render, so switching language now re-labels in place instead of waiting for a refetch.

  Not covered, and unchanged here: a LOCAL select dimension on a table/pivot, whose label the server resolves and whose client-side net is deliberately off (objectui#4263), and a dashboard global filter's own field label, which has no object name in its metadata to key a bundle lookup with — tracked on objectui#4030.

- 3fc2971: A null-keyed group renders as an explicit bucket instead of silently vanishing from a chart (objectui#4466)

  `buildChartSeries`' single-dimension branch passed rows through verbatim, so a row whose category VALUE is `null` reached recharts with a null category and drew no mark. The visible outcome was not an empty chart but a quietly wrong one: rows `[{user_id: null, event_count: 51}, {user_id: 'Dev Admin', event_count: 2}]` drew exactly ONE bar — the dominant group, 51 of 53 events, dropped while the y-axis scale still accommodated it, so the chart understated its own data and the axis proved the data had been there. With every group null it drew axes, gridlines and an axis title with zero marks and no empty state, which is the shipped first-boot state of the built-in System Overview board's "Events by User" (every seeded `sys_audit_log` row is written with `user_id = NULL`).

  The mapping lives in the shared series layer, so dashboard widgets and standalone `ObjectChart` get one answer rather than a per-chart patch in the recharts wrapper. It resolves the two-answers disagreement the card names as well: an empty result set keeps the designed empty state, a non-empty result always draws bars — the null bucket included.

  `@object-ui/core` gains `NULL_CATEGORY_LABEL` and `ChartSeriesOptions`; `buildChartSeries` and `findChartSeriesRow` each take an optional trailing `options`. Both additive — every existing call site compiles and behaves identically, and a result with no null category is still returned by array identity. The two helpers are a pair on purpose: the caller matches a clicked segment against rows that still carry the raw `null`, so `findChartSeriesRow` reads the bucket label back to that row and the newly-visible bar keeps its drill-through instead of resolving to `-1`.

  The label goes through the i18n channel (`chart.nullCategory`, en `(None)` / zh `(未指定)`, all ten packs), passed down by the renderer: `@object-ui/core` is React-free and cannot read the locale bundle, so it takes the resolved string the same way `dimensionOptionTranslator` takes a resolver. Its English constant is the floor for a provider-less host, not the mechanism.

  `hasNoCategoryKey` (framework#4033) is untouched and now documented against this: a row that does not carry the category key AT ALL is a different defect — a dimension grouped by but never projected — and keeps its explanatory placeholder. The bucket deliberately never ADDS the key to such a row, which is what keeps that guard's signal alive. Key absent → the placeholder; key present with a null value → the bucket.

- aca27fa: The multi-dimension pivot branch buckets a null first-dimension value instead of dropping its bar (objectui#4497)

  `buildChartSeries`' pivot branch (2+ dimensions, single measure) bucketed rows by `String(xRaw ?? '')` but wrote the RAW value into the emitted row, so a null first-dimension value produced `{status: null, Low: 3}` and reached recharts with a null category — which draws no mark. Measured at the DOM: a two-group pivot drew ONE bar, and an all-null pivot drew axes and gridlines with zero bar rectangles and no empty state. That is the same mechanism objectui#4466 fixed one branch below, on the branch that card deliberately left pinned as-is until the pivot's own bucketing had been measured.

  The pivot now maps a null/undefined first-dimension VALUE to the same bucket label the single-dimension branch uses — `ChartSeriesOptions.nullCategoryLabel`, defaulting to `NULL_CATEGORY_LABEL`. One doctrine, one predicate, two call sites; no new export, and every existing call site compiles and behaves identically.

  The bucket KEY is untouched, which is what keeps this a display fix: `String(xRaw ?? '')` still decides which rows share a bar, so every existing grouping is byte-identical and only the label the bucket carries changes. Rows that lack the category key entirely are still not bucketed — that shape is a dimension grouped by but never projected (framework#4033), a different defect with a different answer.

  Drill-through needed no change, which was measured rather than assumed: the pivot's emitted rows are AGGREGATED, so they are not index-aligned with `drillRawRows` and the one production caller (`DatasetWidget.handleChartDrill`) already drills by SEARCHING the raw rows through `findChartSeriesRow`. Those raw rows still carry their null, and objectui#4466's label-matching covers the multi-dimension arm as well as the single-dimension one, so the newly-visible bar resolves to the right record. Pinned at both levels so a regression in either half surfaces as the dead click it would be.

- 613b167: A dataset dimension on a dotted relationship path now renders its option labels instead of the raw stored enum

  A `DatasetDimension` whose `field` is a relationship path (`crm_account.industry`) got no select-option resolution at all: the chart plotted `education`, `finance`, `manufacturing` — the database column, unresolved — while the **same underlying field** reached as a **local** dimension rendered `Education`, `Finance`, `Manufacturing` beside it on the same dashboard. Nothing errored, so the widget just quietly showed database enum values to end users; on a non-English deployment those are words that appear nowhere else in the UI, since every form and list shows the translated label.

  The label lookup read options as `baseObject.fields[<path>]`, which only ever matches the local spelling. For a dotted path the options live on the **related** object, so the lookup missed and the renderer fell through to the stored value.

  The object-resolution step of that one lookup now walks the path: each segment before the last must be a declared relationship (`lookup` / `master_detail`, target read from `reference` / `reference_to` / `referenceTo` / `reference_to_object`), and the terminal field's options are read off the object that actually owns it. This is the same lookup for both spellings rather than a dotted-path variant beside it — a single-segment path never enters the walk and resolves exactly as before, so the local and joined paths cannot drift apart. Multi-hop paths (`crm_account.owner.department`) resolve too, which is the shape the dataset designer already emits.

  Hops ride the caller's existing `GET /meta/object/:name` channel — the same authenticated read that fetched the base object — so no new fetch layer is introduced, and objects are fetched once per resolution even when several dimensions share a prefix. Every failure stays best-effort: a segment that is not a relationship, a target that cannot be loaded, or a terminal field with no options yields no mapping and the raw value survives, exactly as it does today.

  Applies to both surfaces that carried this lookup: dashboard dataset widgets (`DatasetWidget`) and the chart view's dataset path (`ObjectChart`).

  Scope: this ends at "the label is in hand". Whether that label then passes through the i18n bundle is a separate gap tracked upstream as objectstack#5076.

- 0b49d60: Analytics: `ObjectChart` consumes the shared label-net helpers instead of a third copy

  objectui#4389 (PR #4404) named two copies of the analytics label-net glue — the dashboard's `DatasetWidget` and plugin-report's dataset block — and retired both into `@object-ui/core` + `@object-ui/react`. There was a THIRD, which that card did not name and its PR deliberately left out of scope: `packages/plugin-charts/src/ObjectChart.tsx` carried its own `translatorFor` closure, its own `buildDimensionLabelMap` loop, and its own base-object-read-then-walk composition. The `translatorFor` copy was logically identical to the two that were deleted, down to the comment explaining the binding.

  `ObjectChart` now calls core's `dimensionOptionTranslator`, `deriveDimensionLabelMaps` and `loadDimensionFieldMeta` directly. Nothing about what a label IS changes — those helpers are the same code the two retired copies were rewritten onto, so the part that was genuinely duplicated three times is now written once.

  Behaviour is unchanged by construction: same two metadata reads in the same order on the dataset path, same one read on the aggregate path, same best-effort fallback (an unresolvable path yields no entry and the raw value survives), same locale-applying memo boundary. `plugin-charts`' 22 test files / 170 assertions pass unchanged and their files are byte-identical to before, which is the acceptance evidence for a pure swap.

  The card's second, optional step — moving the DATASET path's metadata read onto `@object-ui/react`'s `useDatasetDimensionMeta` — was attempted and declined on measurement; the shape blocker is recorded on objectui#4405 and in the PR. The two bug-fix properties the family exists to state (the read rides the host's authenticated `apiFetch`, objectui#4121; the fetched metadata stays locale-free, objectui#4030 / PR #4324) therefore remain stated locally in this file, exactly as before, and are undisturbed by this change.

- bcd3e02: `ObjectChart`'s category option-color / dimension-label probe now rides the host's
  authenticated fetch (`SchemaRendererContext.apiFetch`) instead of the bare global
  `fetch`.

  Both metadata reads the effect makes — `GET /api/v1/meta/dataset/{dataset}` and
  `GET /api/v1/meta/object/{object}` — went out on the global `fetch`, so in a hosted
  console they skipped whatever the host supplies on that channel (Authorization /
  tenant headers, base-URL rewrite, draft-preview params). A bearer-token session
  carries its credential in a header rather than a cookie, so `credentials: 'include'`
  alone left these two reads unauthenticated. The effect is best-effort and swallows
  every failure, which made the symptom silent: semantic option colors and dataset
  dimension labels simply never applied, and the chart fell back to the positional
  theme palette and raw stored values.

  Standalone embeds are unaffected — with no provider (or a provider that supplies no
  `apiFetch`) the probe still uses the global `fetch`, the same documented fallback
  `useRecordEditable` and `provider: 'api'` view sources use.

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
- Updated dependencies [d0c3b26]
- Updated dependencies [3fc2971]
- Updated dependencies [aca27fa]
- Updated dependencies [dde7283]
- Updated dependencies [f7c6430]
- Updated dependencies [4dadf0d]
- Updated dependencies [ae10a01]
- Updated dependencies [92876f0]
- Updated dependencies [f279deb]
- Updated dependencies [4b70d28]
- Updated dependencies [eb7f586]
- Updated dependencies [e901131]
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
- Updated dependencies [3e19fe7]
- Updated dependencies [bb58d1d]
- Updated dependencies [5cc847c]
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
  - @object-ui/types@17.5.0

## 17.4.0

### Patch Changes

- a7e39a8: `ChartContainer`'s min-size fallback survives a consumer-supplied `style` (objectstack#7026)

  The container wrote `style={{ minHeight: 280, minWidth: 0, ...props.style }}` and
  then spread `{...props}` on the line BELOW it. `props` is the rest of
  `ComponentProps< "div" >` — only `id`, `className`, `children`, `config` and
  `disableSettleRemount` are destructured out of it — so it still carried the
  consumer's `style`, and a later JSX attribute of the same name replaces an earlier
  one outright. Any caller that passed a `style` therefore replaced the whole object:
  both `minHeight` and `minWidth` vanished, and the `...props.style` merge written
  inside it never executed even once. It was dead code that read, to anyone auditing
  the file, as if the fallback were guaranteed.

  That fallback is not decorative. It exists so Recharts' `ResponsiveContainer`
  always has a non-zero box to measure: a dashboard widget that overrides the
  container's `h-[350px]` class and wraps the chart in flex/grid without an explicit
  child height leaves the box at 0, Recharts measures `width/height = -1`, and the
  chart renders invisibly — the exact failure the guard was added for.

  `style` is now destructured out of the rest props and merged explicitly, so which
  side wins is stated in code instead of being decided by JSX attribute order, and
  `{...props}` can no longer reach `style` at all.

  Precedence: **an author's explicit size wins.** Simply spreading `{...props}`
  first and merging unconditionally would have traded this bug for its mirror image
  — `minHeight: 280` injected next to an authored `height: 100` floors that 100 to
  280, silently overriding the author. So each half of the fallback applies only
  when the consumer style declares neither of its own keys: `height`/`minHeight`
  gate the height half, `width`/`minWidth` gate the width half, and a key present
  but set to `undefined`/`null` counts as not declared. Every other consumer style
  key passes through untouched.

  Behaviour change surface, deliberately narrow. A caller that supplies no `style`
  is byte-for-byte unchanged. A caller whose `style` declares a height — which today
  is the only shape in the tree, `AdvancedChartImpl`'s `containerProps` forwarding
  `ChartConfig.height` — keeps exactly the height it authored, also unchanged, and
  additionally regains the `minWidth: 0` half. What changes is the case the issue
  was filed for: a `style` carrying no size key (a margin, a padding, an
  aspect-ratio, any future container-level presentation prop routed through the same
  `containerProps` path) now keeps the min-size fallback instead of silently
  stripping it.

  Pinned in both directions, since a one-sided pin would have been satisfied by the
  mirror-image fix: a non-size `style` keeps `min-height: 280` / `min-width: 0`
  (red before this change), and an explicit `height: 100` renders as 100 with no
  `min-height` floor (red under the unconditional-merge alternative).

- 4bc6c23: Converge dashboard widget `compareTo` on the executor's `{ kind, dimension? }` contract, and make the dataset path actually render a comparison

  `CompareToConfig` was a three-branch union (`'previousPeriod' | 'previousYear' | { offset }`). `@objectstack/spec` collapsed it to the shape the analytics executor already implements — `DatasetCompareTo`, a plain strict object `{ kind: 'previousPeriod' | 'previousYear'; dimension?: string }` (objectstack#5011) — so this renderer now reads that one shape:

  - `shiftFilterByCompareTo` / `compareToTrendLabelKey` dispatch on `compareTo.kind`. The `{ offset }` duration shift is gone: `{ offset: '1y' }` is `kind: 'previousYear'`, while `'7d'` / `'1M'` have no faithful target and are restated by the author on the widget's own `filter` plus `kind: 'previousPeriod'`. No trend label key is retired — the offset arm resolved to `vsPreviousPeriod`, which survives as the `previousPeriod` fallback.
  - `DatasetWidget` no longer discards part of `compareTo`. It used to forward only the object form because the two string forms had no meaning downstream; with one shape there is nothing to discard, and a stale string is now invalid metadata rejected where it is authored rather than silently reinterpreted here.
  - **The comparison now actually runs on the dataset path.** A widget states its window in its own `filter` (a date macro, or the dashboard date-range filter merged in), but the executor shifts a `timeDimensions` entry carrying a `dateRange` — so a dataset widget asking for a comparison got "compareTo needs a dated window to shift" and rendered none. When (and only when) a comparison is requested, the resolved filter's bounded date windows are lowered into `selection.timeDimensions[].dateRange` and moved out of `runtimeFilter` (a copy left behind would intersect the shifted window with the current one and empty every comparison column). Which dimension gets shifted stays the executor's decision: every window found is lowered under the name the author wrote, and zero or two candidates surfaces the executor's own error, listing them.
  - The `<measure>__compare` columns that come back are now shown: a delta + window label on KPI widgets, a comparison column on tables, and a `variant: 'comparison'` overlay series on charts — the same treatment and the same `dashboard.trend.*` labels the inline object-provider widgets already use.

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
- Updated dependencies [c2fd122]
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
- Updated dependencies [6bb454a]
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

## 17.3.0

### Minor Changes

- 9e9e9a9: `DrillDownConfig` now declares only keys a renderer reads, and `target: 'navigate'` is honoured on charts too (#3354).

  **Removed — two keys no renderer has ever read.** `DrillDownConfig.view` (self-described as "reserved") and `DrillDownConfig.sort` ("default sort applied to the drill list") had zero read sites repo-wide: the drill drawer rendered its inline `object-data-table` regardless of `view`, and no widget put `sort` into the drilled table schema. Authoring either did nothing, silently. They are removed rather than implemented because nothing asked for them, and this interface is the shape the protocol's own `drillDown` declaration is being derived from (objectstack#5022) — left in place, they were about to become dead keys carrying protocol authority. Removing a declared key from a published interface is technically breaking for anyone who wrote one, but only in the sense that TypeScript now reports what was already true at runtime: the key did nothing. Per this repo's version policy the bump stays `minor` (the fixed release group tracks `@objectstack`'s major). A compile-time pin in `@object-ui/types` keeps both keys from drifting back without a reader.

  **Fixed — `ObjectChart` no longer degrades `target: 'navigate'` to a drawer.** All five widgets share `DrillDownConfig`, whose `target` JSDoc promises `'navigate'` skips the in-place view and opens the object's full list page when the host provides drill navigation. `DrillDownDrawer` delivered that for the table / pivot / metric widgets, but `ObjectChart` draws its own drawer and branched on `'dialog'` only — so `'navigate'` fell through to the default side sheet, indistinguishable from `'drawer'` even with a host handler wired. The chart now routes `'navigate'` through `DrillNavigationContext.openRecordList` with the same merged filter the drawer would have used, and keeps the documented fallback: with no host navigation handler it degrades to the drawer. `'drawer'` / `'dialog'` behaviour is unchanged, and the header's "Open in list" escape hatch stays independent of `target`.

  The `object-chart` registry input deliberately keeps advertising `target: 'drawer' | 'dialog'` only. `ChartDrillDownSchema` in `@objectstack/spec` declares the chart drill target as those two, strictly, and the publish-time react-page lint parses that schema against the authored literal — so listing `'navigate'` in the designer palette would offer authors a value the publish gate rejects. Widening the protocol union is a spec-side follow-up (objectstack#5435); `'navigate'` works today for any host that composes an `object-chart` schema directly.

- 524a635: `<ObjectChart>` declares `drillDown` as a registry input, so the SDUI save gate treats the segment drill as a contract prop instead of an unknown one (framework#5022).

  The component has read `schema.drillDown` all along — it is what opens the drawer of underlying records when you click a bar or a slice — but the prop was declared in neither the protocol nor this registry entry. The manifest the save gate validates page JSX against is built verbatim from these `inputs`, so an author who wrote the drill got an `unknown-prop` diagnostic for a prop that works. `@objectstack/spec` now declares the shape (`ChartDrillDownSchema`, published on the react-tier `<ObjectChart>` contract); this is the renderer half.

  The published input describes the six keys the spec declares — `enabled`, `filter`, `title`, `target` (`'drawer' | 'dialog'`), `columns`, `maxRows` — and deliberately not the wider `DrillDownConfig` this repo shares with the table / pivot / metric widgets: `ObjectChart` reads none of `mode` / `report` / `view` / `sort`, and does not implement `target: 'navigate'` (it renders the drawer instead — objectui#3354).

  The untyped `(schema as any).drillDown` read is now typed as `DrillDownConfig`. Narrowing it to the spec's `ChartDrillDown` is left as a TODO on the version pin: `@objectstack/spec` is pinned at `^17.0.0-rc.2` here and the declaration lands in the next rc, and re-declaring the shape locally would be the fork that lets the two drift.

### Patch Changes

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
  - @object-ui/i18n@17.3.0
  - @object-ui/react@17.3.0

## 17.2.0

### Minor Changes

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

## 17.1.0

### Minor Changes

- f1c04b6: fix(charts): a spec `series[].type` override actually draws, and a spec-shape `series` plots at all (#2945)

  #2945 listed `combo` (`plugin-charts`) as renderer-local dialect to "promote or
  delete". Neither: the spec **already models a combo chart**, per-series, and its
  own field comment says so —

  ```ts
  // spec/src/ui/chart.zod.ts — ChartSeriesSchema
  /** Series type override (combo charts) */
  type: ChartTypeSchema.optional().describe('Override chart type for this series'),
  ```

  — exactly as it models stacking with `ChartSeries.stack` rather than a
  `stacked-bar` family. So `combo` is not a name an author should reach for; it is
  what "the series disagree about their family" looks like from the renderer's
  side. `effectiveChartFamily` now derives it, and `combo` stays a documented
  renderer-local marker (internal callers pass it directly today).

  Chasing that turned up two live bugs, both silent, on the path a spec author
  takes.

  **1. The per-series override was parsed, carried, and then dropped.** Only the
  renderer's `chartType === 'combo'` branch read `series[].chartType`, so

  ```ts
  { type: 'bar', series: [{ name: 'revenue' }, { name: 'margin', type: 'line' }] }
  ```

  drew `margin` as a bar. Nothing was wrong at any layer but the last — a unit test
  even asserted the value was carried.

  **2. A spec-shape `series` rendered nothing at all.** `series` is the one binding
  both shapes spell with the same key, so `ChartRenderer`'s blanket "internal props
  win" rule let the author's `[{ name }]` shadow the normalized `[{ dataKey }]` and
  reach a renderer that reads `dataKey`. Blank chart. Every other spec binding has a
  distinct name (`xAxis` vs `xAxisKey`), which is why only this one broke — and why
  the isolated normalization tests all passed over a dead path. The raw array is now
  preferred only when it already speaks the internal shape, so internal callers are
  byte-for-byte unchanged and a mixed array works too.

  **Also fixed in passing:** the combo branch had an `area` arm under a `BarChart`
  container, and Recharts renders an `<Area>` child of `BarChart` as nothing — so an
  authored combo with an `area` series drew a blank series. The container is now
  `ComposedChart`, which is what Recharts provides for mixed marks.

  Widening only. A chart whose series all resolve to one family keeps its own
  family, an explicit `combo` is untouched, and a family with no per-series meaning
  (`pie`, `horizontal-bar`, …) is never widened. A derived combo binds series to the
  left axis unless one asks for `yAxis: 'right'` — the spec's own default — so
  widening changes the series' mark and not its scale; the legacy bar→left/line→right
  guess is kept for an authored `combo`, where it was historically the only way to
  reach a second axis.

  Guards: `effectiveChartFamily` / `comboBaseFamily` are unit-tested over the whole
  family matrix; DOM-level tests assert the **marks** rather than the derived family,
  since the carry was already covered and the drawing was what broke; and
  `spec-derived-unions.test.ts` asserts `combo` is absent from the spec's
  `ChartTypeSchema`, so the day it is adopted upstream the derivation is named as the
  thing to retire.

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

## 17.0.0

### Minor Changes

- aa88056: feat(charts): honor `ChartAxis.stepSize`, `ChartConfig.description` and `ChartConfig.height` (framework#3752)

  The tail of the declared-≠-delivered sweep from framework#3729 / #2880. Three
  `ChartConfig` props reached the renderer and did nothing:

  - **`ChartAxis.stepSize`** — Recharts has no "a tick every N units" prop
    (`tickCount` is a hint it may ignore, `interval` is for categorical axes), so
    honoring a step means handing it the tick array outright. `ticksFor` builds it
    from the axis's own `min`/`max` where declared and from the plotted values
    otherwise, so a step works with or without a pinned domain. A data-derived max
    rounds UP to the next step (otherwise the topmost bar sits above the last
    gridline and the axis reads as truncated); an explicit `max` clamps instead,
    since a tick outside a pinned domain would be drawn outside the plot. A step
    that would produce more than 200 ticks is refused rather than rendered — that
    is a wrong config, and drawing it would hang the page instead of surfacing the
    mistake.
  - **`ChartConfig.description`** — the accessibility description. A chart is a
    picture to a screen reader; the container now carries `role="img"` +
    `aria-label`. Without a description it stays an ordinary div, because
    stamping `role="img"` on an _unlabelled_ graphic is worse than leaving one a
    screen reader can skip.
  - **`ChartConfig.height`** — was read only by the legacy `ChartBarRenderer`, not
    by the advanced path that draws every real chart. Now applied to the chart
    container as an inline style, which beats its default `h-[350px]` class.

  `height` and `description` ride on the shared container props, so they apply to
  all eight chart families rather than one branch.

- 9b53d72: feat(charts): ObjectChart honors the spec `ChartConfig` author shape (objectui#2880 / framework#3729)

  `ChartConfigSchema` is the chart protocol, but the renderer only ever read a
  Recharts-flavoured internal shape — `chartType`, `xAxisKey`, `series[].dataKey`.
  Everything an author wrote in the SPEC shape reached the renderer and was
  silently dropped, which is exactly what ADR-0078 forbids. framework#3725
  documented the gap by trimming the published contract down to the props that
  actually worked; this closes it the other way round.

  **S1 — one normalization boundary.** `normalizeChartSchema` translates the
  author shape into the internal pipeline contract in a single place, rather than
  scattering `??` fallbacks through the render tree (framework PD #12: one
  translation is a contract mapping, N fallbacks are a second dialect):

  - `type` → `chartType`, `xAxis: { field }` → `xAxisKey`, `series: [{ name }]` →
    `series: [{ dataKey }]`
  - the report surface's bare-string `xAxis`/`yAxis` resolve too
  - `yAxis: [{ field }]` alone plots, with no `series` declared
  - **internal props win**, so `DashboardRenderer`, `ObjectView` and the dataset
    path are byte-for-byte unaffected — there is no migration

  **The `type` collision.** `ChartConfig.type` is the chart family, but on any
  surface that flattens chart config into a props bag `type` is already the SDUI
  envelope's component discriminator. Spreading props last let an author's
  `type="bar"` replace `object-chart` so the block stopped resolving; stamping the
  discriminator last ate the author's value instead. The react-page wrapper now
  keeps both: the discriminator wins the `type` slot and the author's value is
  preserved beside it as `specType`, which the normalizer reads back.

  **S2 — axis presentation.** `ChartAxis.format` drives the tick formatter (via
  `Intl.NumberFormat`, no new dependency), `min`/`max` pin the domain,
  `logarithmic` swaps the scale, `title` labels the axis, and `showGridLines` is
  honored. A second `yAxis` entry (or `position: 'right'`) turns on the secondary
  axis that `series[].yAxis` binds to — in combo charts an explicit binding now
  beats the family-derived bar→left/line→right guess. `showLegend` is honored,
  and `title`/`subtitle` render above the plot instead of only titling the
  drill-down drawer.

  **S3 — `series[].stack`, `annotations`, `interaction`.** Stacking passes the
  author's group name through as Recharts' `stackId`. Annotations render as
  `ReferenceLine` (`type: 'line'`) / `ReferenceArea` (`type: 'region'`) with the
  declared axis, colour, style and label. `interaction.tooltips: false` suppresses
  the hover card and `interaction.brush: true` adds the range selector;
  `showDataLabels` prints values on the marks. `interaction.zoom` has no Recharts
  primitive behind it and is deliberately still unimplemented rather than faked.

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
- Updated dependencies [09c6a17]
- Updated dependencies [c7cff19]
- Updated dependencies [ba73a02]
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
- Updated dependencies [d147a13]
- Updated dependencies [c6aaed8]
- Updated dependencies [263f885]
- Updated dependencies [dc334da]
  - @object-ui/components@17.0.0
  - @object-ui/i18n@17.0.0
  - @object-ui/react@17.0.0
  - @object-ui/types@17.0.0
  - @object-ui/core@17.0.0

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
  - @object-ui/core@16.0.0

## 15.0.0

### Patch Changes

- @object-ui/types@15.0.0
- @object-ui/core@15.0.0
- @object-ui/i18n@15.0.0
- @object-ui/react@15.0.0
- @object-ui/components@15.0.0

## 14.1.0

### Patch Changes

- Updated dependencies [82441e4]
- Updated dependencies [2efa9fd]
- Updated dependencies [0890fa7]
- Updated dependencies [2ded18c]
- Updated dependencies [e628d1f]
- Updated dependencies [5523fc4]
- Updated dependencies [887062c]
- Updated dependencies [23d65c3]
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

## 13.2.0

### Patch Changes

- Updated dependencies [80901aa]
- Updated dependencies [53c40c2]
- Updated dependencies [e492b9d]
  - @object-ui/components@13.2.0
  - @object-ui/i18n@13.2.0
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

## 13.0.0

### Patch Changes

- Updated dependencies [9e38270]
- Updated dependencies [ac04b76]
- Updated dependencies [619097e]
  - @object-ui/i18n@13.0.0
  - @object-ui/components@13.0.0
  - @object-ui/types@13.0.0
  - @object-ui/react@13.0.0
  - @object-ui/core@13.0.0

## 12.1.0

### Patch Changes

- Updated dependencies [6cbccf3]
- Updated dependencies [e1840bf]
- Updated dependencies [c31874d]
  - @object-ui/components@12.1.0
  - @object-ui/i18n@12.1.0
  - @object-ui/types@12.1.0
  - @object-ui/react@12.1.0
  - @object-ui/core@12.1.0

## 12.0.0

### Patch Changes

- Updated dependencies [226fde9]
- Updated dependencies [e4de456]
  - @object-ui/types@12.0.0
  - @object-ui/core@12.0.0
  - @object-ui/components@12.0.0
  - @object-ui/react@12.0.0
  - @object-ui/i18n@12.0.0

## 11.5.0

### Patch Changes

- fae75e2: Fix two bugs verified still-present after #2254 claimed to resolve them (framework#2620 / framework#2616 Showcase UX pass, tracked in #2268):

  - **Wizard/form `submitBehavior: 'thank-you'` allowed duplicate resubmission.** #2254 fixed the spec-bridge dropping `submitBehavior` before it reached the renderer, so the configured toast message started appearing — but `WizardForm`'s last step and `ObjectForm`'s submit handler only ever called `toast.success(...)` for `thank-you`/`next-record`; the form stayed mounted and fully filled with its submit button re-enabled once the request settled, so a second click created a second record. Both components now track a terminal `submitted` state and, when set, replace the form with a confirmation panel (using the behavior's `title`/`message`, which were also never read before) — mirroring the pattern `apps/console/src/components/FormPage.tsx` already used for its own standalone forms.

  - **Command Center-style 3-up chart bands stayed collapsed to ~100-130px, and a dataset-bound chart's measure leaked its raw field name.**
    - `responsiveStyles` (and `style`) were declared on the page-spec `PageComponent` bridge input type but never copied onto the `SchemaNode` in `spec-bridge/bridges/page.ts::mapComponent()` — so a page author's ADR-0065 layout override (e.g. forcing `display: 'grid'` on a `type: 'flex'` band) never reached `SchemaRenderer`, and the node silently fell back to its default flex layout. Both fields are now mapped through.
    - `ObjectChart`'s dataset-bound fetch path (`schema.dataset` + `ds.queryDataset(...)`) discarded the response's `fields` array (which carries each measure's `label`, e.g. `{ name: 'task_count', label: 'Tasks' }`) before it ever reached `buildChartSeries()` — whose `fields` param already resolves this correctly (see `chart-series.test.ts`) — so the legend/tooltip always fell back to the raw field name. The fetched `fields` are now captured and threaded through.

- Updated dependencies [544d8eb]
- Updated dependencies [6fffd3d]
- Updated dependencies [9255686]
- Updated dependencies [fae75e2]
- Updated dependencies [1072701]
  - @object-ui/i18n@11.5.0
  - @object-ui/react@11.5.0
  - @object-ui/components@11.5.0
  - @object-ui/types@11.5.0
  - @object-ui/core@11.5.0

## 11.4.0

### Patch Changes

- Updated dependencies [8bf6295]
- Updated dependencies [1948c5b]
- Updated dependencies [bce581a]
- Updated dependencies [9cd9be1]
- Updated dependencies [c38d107]
- Updated dependencies [7782698]
- Updated dependencies [790558b]
- Updated dependencies [e84d64d]
  - @object-ui/types@11.4.0
  - @object-ui/components@11.4.0
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
  - @object-ui/react@11.3.0
  - @object-ui/types@11.3.0

## 11.2.0

### Patch Changes

- Updated dependencies [9e7a986]
- Updated dependencies [1311749]
  - @object-ui/components@11.2.0
  - @object-ui/core@11.2.0
  - @object-ui/react@11.2.0
  - @object-ui/types@11.2.0
  - @object-ui/i18n@11.2.0

## 11.1.0

### Patch Changes

- Updated dependencies [6726a2b]
  - @object-ui/i18n@11.1.0
  - @object-ui/components@11.1.0
  - @object-ui/react@11.1.0
  - @object-ui/types@11.1.0
  - @object-ui/core@11.1.0

## 7.3.0

### Patch Changes

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

- 93cf2b1: fix(charts): use field option colors for categorical chart dimensions

  An `object-chart` grouped by a select/lookup field (e.g. project `health`)
  painted its categories from the generic `--chart-1..5` palette, so a "Red"
  health slice rendered teal and "Green" rendered blue. The chart now resolves
  the category dimension's option colors — both the `objectName` + `groupBy`
  path and the dataset path (via the dataset's `object` + dimension `field`) —
  and threads them to the renderer as a per-category `categoryColors` map. That
  map wins over the positional palette and falls back to it for categories
  without an option color, so pie/donut slices and bar cells render in their
  semantic colors.

- Updated dependencies [677f7ed]
- Updated dependencies [08c47da]
- Updated dependencies [a71be60]
- Updated dependencies [cb03bc3]
  - @object-ui/types@7.1.0
  - @object-ui/core@7.1.0
  - @object-ui/react@7.1.0
  - @object-ui/components@7.1.0
  - @object-ui/i18n@7.1.0

## 7.0.0

### Patch Changes

- c5a7d6f: Bar-chart X-axis labels no longer overlap on narrow widgets. When a chart has
  many categories (>4) or any long label (>8 chars), the tick labels are angled
  (-32°) and truncated with a hover `title`; few short labels stay horizontal.
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

- e270c7d: fix(chart): consume ADR-0021 `dataset` binding in list/object chart views

  Chart views authored to the current spec (ADR-0021: `dataset` + `dimensions` +
  `values`) previously rendered nothing — the renderers only read the **removed**
  legacy inline `xAxisField` / `yAxisFields` / `aggregation` shape, so a
  spec-compliant chart view showed an empty canvas. `ObjectChart` now runs the
  governed `queryDataset` path when a chart binds to a dataset (the same path the
  dashboard `DatasetWidget` uses, so numbers stay consistent), and `ListView` /
  `ObjectView` emit the dataset shape. The legacy inline aggregate is kept as a
  deprecated fallback so pre-ADR-0021 metadata keeps rendering.

  Refs objectstack-ai/objectstack#1890

- ab168e4: Dashboard charts no longer render blank on first paint. Recharts'
  `ResponsiveContainer` was a child of a `flex … justify-center` box, so it
  collapsed to content width (0) on first paint inside react-grid-layout,
  measured `width(-1)` and skipped drawing until a later resize fired its
  ResizeObserver. The chart wrapper is now a definite-width block in both the
  dashboard chart container (`plugin-charts/ChartContainerImpl`) and the shadcn
  base (`components/ui/chart`). Follow-up changeset for #1634.
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
- Updated dependencies [3870c20]
- Updated dependencies [2eb3096]
- Updated dependencies [b88c560]
- Updated dependencies [0ad72a6]
- Updated dependencies [3fa23a7]
- Updated dependencies [18d0339]
- Updated dependencies [59b6bbb]
- Updated dependencies [d16566f]
- Updated dependencies [90acb7f]
- Updated dependencies [7913390]
- Updated dependencies [1394e34]
- Updated dependencies [e95cc25]
- Updated dependencies [abe8ebc]
- Updated dependencies [300d755]
- Updated dependencies [bd8b054]
- Updated dependencies [4eb9cb6]
- Updated dependencies [7c239fd]
- Updated dependencies [858ad94]
- Updated dependencies [2270239]
- Updated dependencies [2f31406]
- Updated dependencies [8d1195d]
  - @object-ui/core@7.0.0
  - @object-ui/components@7.0.0
  - @object-ui/react@7.0.0
  - @object-ui/i18n@7.0.0
  - @object-ui/types@7.0.0

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3
- @object-ui/core@6.2.3
- @object-ui/i18n@6.2.3
- @object-ui/react@6.2.3
- @object-ui/components@6.2.3

## 6.2.2

### Patch Changes

- Updated dependencies [a66f788]
  - @object-ui/react@6.2.2
  - @object-ui/components@6.2.2
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

## 6.2.0

### Patch Changes

- @object-ui/react@6.2.0
- @object-ui/components@6.2.0
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
  - @object-ui/react@6.1.0
  - @object-ui/i18n@6.1.0

## 6.0.4

### Patch Changes

- @object-ui/types@6.0.4
- @object-ui/core@6.0.4
- @object-ui/i18n@6.0.4
- @object-ui/react@6.0.4
- @object-ui/components@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3
- @object-ui/core@6.0.3
- @object-ui/i18n@6.0.3
- @object-ui/react@6.0.3
- @object-ui/components@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2
- @object-ui/core@6.0.2
- @object-ui/i18n@6.0.2
- @object-ui/react@6.0.2
- @object-ui/components@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1
- @object-ui/core@6.0.1
- @object-ui/i18n@6.0.1
- @object-ui/react@6.0.1
- @object-ui/components@6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0
- @object-ui/core@6.0.0
- @object-ui/i18n@6.0.0
- @object-ui/react@6.0.0
- @object-ui/components@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2
- @object-ui/core@5.4.2
- @object-ui/i18n@5.4.2
- @object-ui/react@5.4.2
- @object-ui/components@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1
- @object-ui/core@5.4.1
- @object-ui/i18n@5.4.1
- @object-ui/react@5.4.1
- @object-ui/components@5.4.1

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0
  - @object-ui/components@5.4.0
  - @object-ui/core@5.4.0
  - @object-ui/react@5.4.0
  - @object-ui/i18n@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2
- @object-ui/core@5.3.2
- @object-ui/i18n@5.3.2
- @object-ui/react@5.3.2
- @object-ui/components@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1
- @object-ui/core@5.3.1
- @object-ui/i18n@5.3.1
- @object-ui/react@5.3.1
- @object-ui/components@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0
- @object-ui/core@5.3.0
- @object-ui/i18n@5.3.0
- @object-ui/react@5.3.0
- @object-ui/components@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1
- @object-ui/core@5.2.1
- @object-ui/i18n@5.2.1
- @object-ui/react@5.2.1
- @object-ui/components@5.2.1

## 5.2.0

### Patch Changes

- Updated dependencies [de0c5e6]
- Updated dependencies [9997cae]
- Updated dependencies [321294c]
- Updated dependencies [b2d1704]
- Updated dependencies [0a644f0]
- Updated dependencies [a3cb88f]
- Updated dependencies [5425608]
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
  - @object-ui/components@5.2.0

## 5.1.1

### Patch Changes

- Updated dependencies [8955b9c]
  - @object-ui/components@5.1.1
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

## 5.0.2

### Patch Changes

- Updated dependencies [cab6a93]
  - @object-ui/i18n@5.0.2
  - @object-ui/components@5.0.2
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
  - @object-ui/core@5.0.0

## 4.8.0

### Patch Changes

- @object-ui/types@4.8.0
- @object-ui/core@4.8.0
- @object-ui/i18n@4.8.0
- @object-ui/react@4.8.0
- @object-ui/components@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0
- @object-ui/core@4.7.0
- @object-ui/i18n@4.7.0
- @object-ui/react@4.7.0
- @object-ui/components@4.7.0

## 4.6.0

### Patch Changes

- Updated dependencies [3ee436d]
  - @object-ui/components@4.6.0
  - @object-ui/types@4.6.0
  - @object-ui/core@4.6.0
  - @object-ui/i18n@4.6.0
  - @object-ui/react@4.6.0

## 4.5.0

### Patch Changes

- Updated dependencies [ab5e281]
- Updated dependencies [6b6afd1]
- Updated dependencies [22fa558]
- Updated dependencies [aa7855f]
- Updated dependencies [170d89f]
  - @object-ui/types@4.5.0
  - @object-ui/components@4.5.0
  - @object-ui/i18n@4.5.0
  - @object-ui/core@4.5.0
  - @object-ui/react@4.5.0

## 4.4.0

### Patch Changes

- Updated dependencies [2bd45af]
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

## 4.2.0

### Patch Changes

- Updated dependencies [eb738bd]
- Updated dependencies [650392e]
- Updated dependencies [84b4bf1]
  - @object-ui/i18n@4.2.0
  - @object-ui/components@4.2.0
  - @object-ui/react@4.2.0
  - @object-ui/types@4.2.0
  - @object-ui/core@4.2.0

## 4.1.0

### Patch Changes

- b4ce9e2: Fix summary reports: render chart + KPIs, correct empty-table on server-aggregated data.
  - `plugin-report`: `SpecReportGrid` now renders a KPI strip (per aggregating column) and a chart section above the grid for `summary` reports. KPI section auto-hides when no aggregating columns. New `buildChartData()` adapter buckets aggregated `ReportRow[]` to chart-ready data, auto-sorts pie/funnel descending, and falls back to row count when the chart `yAxis` points at a non-numeric column. When the data is server-aggregated, the grid switches columns to `[groupings, ${field}__${agg}]` so cells aren't empty against a raw-row column schema.
  - `plugin-charts`: register `'column'` as an alias of `'bar'` in `ChartRenderer` / `AdvancedChartImpl` (Recharts only has `BarChart`).
  - `app-shell`: `ReportView` now routes any object-backed report (matrix/joined/summary/tabular/columns/groupingsAcross) through the spec `ReportRenderer`; fully-legacy `fields`+`data` schemas still use `ReportViewer`.
  - @object-ui/types@4.1.0
  - @object-ui/core@4.1.0
  - @object-ui/i18n@4.1.0
  - @object-ui/react@4.1.0
  - @object-ui/components@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12
- @object-ui/core@4.0.12
- @object-ui/i18n@4.0.12
- @object-ui/react@4.0.12
- @object-ui/components@4.0.12

## 4.0.11

### Patch Changes

- Updated dependencies [1909bc3]
  - @object-ui/i18n@4.0.11
  - @object-ui/components@4.0.11
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

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9
- @object-ui/core@4.0.9
- @object-ui/i18n@4.0.9
- @object-ui/react@4.0.9
- @object-ui/components@4.0.9

## 4.0.8

### Patch Changes

- Updated dependencies [3d58eaa]
  - @object-ui/i18n@4.0.8
  - @object-ui/components@4.0.8
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

## 0.3.1

### Patch Changes

- Maintenance release - Documentation and build improvements
- Updated dependencies
  - @object-ui/types@0.3.1
  - @object-ui/core@0.3.1
  - @object-ui/react@0.3.1
  - @object-ui/components@0.3.1

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
  - @object-ui/types@0.3.0
  - @object-ui/core@0.2.2
  - @object-ui/react@0.2.2
  - @object-ui/components@0.2.2

## 0.2.1

### Patch Changes

- Patch release: Add automated changeset workflow and CI/CD improvements

  This release includes infrastructure improvements:

  - Added changeset-based version management
  - Enhanced CI/CD workflows with GitHub Actions
  - Improved documentation for contributing and releasing

- Updated dependencies
  - @object-ui/types@0.2.1
  - @object-ui/core@0.2.1
  - @object-ui/react@0.2.1
  - @object-ui/components@0.2.1

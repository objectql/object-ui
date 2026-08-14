# @object-ui/plugin-dashboard

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

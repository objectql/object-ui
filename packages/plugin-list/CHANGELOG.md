# @object-ui/plugin-list

## 17.4.0

### Minor Changes

- bd863fe: fix(timeline): the timeline binds to the date axis the view actually declares (#3129)

  A view whose date axis is bound under `calendar` was **offered** the Timeline
  visualization and then bucketed every record into "No date" — while the calendar
  rendered the very same field correctly. Two read-sites disagreed about what
  counts as a timeline binding:

  - `ListView`'s capability gate accepted `options.calendar.startDateField` as a
    timeline-resolvable axis; the render branch never read calendar config at all,
    so it fell through to its `created_at` last resort.
  - `app-shell`'s object page emitted `startDateField: 'due_date'` into
    `options.timeline` for **every** object view, declared or not. Downstream that
    is indistinguishable from a real binding, and because it is always present it
    shadowed the fallback entirely.

  `ListView` now resolves the axis once — `resolveTimelineDateBinding`, consumed by
  the capability gate and the render branch alike, reading spec key before legacy
  alias and `timeline` before `calendar` in both nestings — and the object page
  forwards only what the view declared. A declared `timeline.startDateField` still
  wins wherever both appear, and a view that declares no date axis anywhere keeps
  the historical `created_at` fallback.

  Observable rendering change (records move out of "No date" into real date
  buckets), hence `minor`.

### Patch Changes

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

- cb5e32d: `UserFilters` preset tab buttons no longer submit an enclosing form; all six buttons declare `type="button"`

  An HTML `<button>` defaults to `type="submit"` inside a `<form>`, so a preset
  filter tab (`filter-tab-*`, tabs mode) submitted the enclosing form on every
  click. The three buttons objectstack#6952 named now declare `type="button"`
  explicitly — the dropdown chip trigger (`filter-badge-*`), the overflow trigger
  (`user-filters-more`) and the preset tab — joining the session-tab buttons that
  objectstack#5236 already declared it on.

  Only one of the three was actually at risk, and the difference is measured
  rather than assumed. The chip and the overflow trigger are
  `PopoverTrigger asChild` children, and Radix's `PopoverTrigger` renders
  `Primitive.button type="button"`; its Slot merges that onto a child declaring no
  `type` of its own, so both already rendered as `button`. Reverting the change
  confirms it: those two keep reading `button`, the plain preset tab button reads
  `null`. For the two triggers this therefore moves a contract out of an upstream
  implementation detail and into local source — the same reasoning objectui#3344
  wrote onto the Combobox trigger — while the preset tab is a real fix.

  Dormant rather than live: the only mount point today is `ListView`'s toolbar,
  which is not inside a form, so no shipped screen submitted anything. The new
  tests pin every rendered `UserFilters` button, in both modes, so a future button
  cannot land at the submit default and an upstream Radix change surfaces in this
  package's tests instead of in a user's form.

  The in-file comment claiming "a Radix trigger keeps the HTML default of `submit`"
  is corrected in passing — it is the inaccuracy that propagated into
  objectstack#6952's premise.

- cf5be4e: `userFilters` tabs: the `allowAddTab` button now adds a tab instead of doing nothing (objectstack#5236)

  The affordance `allowAddTab` renders had hover styling and `title="Add filter tab"` but no `onClick`, and `TabFilters` took no add-tab callback at all — a control that looked fully clickable and did nothing, which disguises "not implemented" as "a bug where clicking does nothing". That mattered more once objectstack#5073 promoted `allowAddTab` into the spec's `UserFiltersSchema`: the key became discoverable through JSON Schema, the Studio SchemaForm and the reference docs, so an author writing `allowAddTab: true` gets a declaration the runtime did not honour.

  Clicking it now opens a small naming popover (the same Popover primitive the filter chips and the "More" overflow already use). Confirming a name adds a tab to the same bar as the presets, carrying a snapshot of the conditions applied at that moment, and selects it. Session tabs also carry a remove affordance; authored presets deliberately do not, since those are metadata. Removing the active session tab re-selects the author's default with the same precedence the initial mount uses, so the bar is never left with no active tab while the removed tab's conditions stay applied.

  The new tab is **session-scoped, held in component state** — no `sys_metadata` write, no API call, no web storage, per ADR-0047 ("an end user's filter choices are session-scoped and never become metadata"). `sessionStorage` was available and deliberately not used: `UserFilters` receives no object or view identity, so any storage key it could invent would be shared by every list in the browser tab, surfacing one list's ad-hoc tabs on another's bar. Persistence beyond the mount, if ever wanted, belongs to the host that already owns the session channel for filter selections (`onSelectionsChange` mirrored into `uf_*` URL params) and can key it by view. The synthetic tab id is reported through `onSelectionsChange` like any other tab switch, so a host mirroring it into the URL hands it back on the next mount, where the existing id check finds no such tab and falls back to the author's default.

  No public API change: `UserFiltersProps` is untouched, and `allowAddTab: false` / an omitted `allowAddTab` still render no affordance at all.

## 17.3.0

### Patch Changes

- 978705c: Gallery covers now resolve the `coverField` value through its **file value
  shape** instead of assuming the field value _is_ a URL string, so an
  ADR-0104-conforming `image` value renders a cover again (objectui#3317).

  Since ADR-0104 D3 wave 2 the stored value of a `file`/`image`/`avatar`/
  `video`/`audio` field is an opaque `sys_file` id, which the read path expands
  in place into `{ id, name, size, mimeType, url }`. `ObjectGallery` read the
  value twice — `hasAnyCover` tested `typeof value === 'string'`, and each card
  did `item[coverField] as string` — so against a spec-correct object value the
  cover area collapsed for the whole gallery, and the card underneath it built
  an `<img src="[object Object]">`. The only values that ever rendered were the
  inline `data:` URIs and external links ADR-0104 retired, which is why this
  stayed invisible.

  ## What changed

  - Both reads now share one `resolveCoverUrl`, so the "does anything have a
    cover?" predicate and the per-card render can no longer disagree — that
    disagreement is what collapsed the area for records that did have a cover.
  - Shape handling is delegated to `readFileValues` from `@object-ui/fields`,
    the platform's existing single arbiter of file value shapes, rather than
    re-derived in the gallery. It accepts the expanded `{ url }` object, a
    legacy bare URL string (still valid during the dual-mode window), and a
    still-bare `sys_file` id — which resolves to the stable
    `/api/v1/storage/files/:id` endpoint instead of reaching `<img src>` as a
    raw opaque token. A value carrying no resolvable URL yields no cover, which
    collapses the area rather than emitting a broken `src`.
  - A `multiple` file field's first entry is used as the cover.

  The sibling paths that thread `coverField`/`imageField` around
  (`ListView`, `app-shell/ObjectView`, `plugin-view/ObjectView`) pass the field
  **name**, not the value, and needed no change.

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

- d7f350a: `UserFilters` no longer carries its own operator table when it lowers a `ViewTab.filter` preset into an ObjectQL AST node. The private `specOperatorToAst` was the second hand-kept operator map in this package and it had drifted: it lowered `not_in` — the spec's OWN canonical spelling — and the legacy `nin` to the spaced `'not in'`, a spelling that appears in no spec vocabulary. `isFilterAST` refuses it, so clicking such a tab produced an empty list plus `400 INVALID_FILTER`. Measured against a real backend (published `@objectstack/*@17.0.0-rc.2` + app-showcase, on `showcase_task`): `$filter=[["status","not in",["done"]]]` returned `400 INVALID_FILTER`, while `[["status","not_in",["done"]]]` returned `200` with the same 8 records as the `["status","!=","done"]` baseline.

  Lowering is now purely structural — all 19 `VIEW_FILTER_OPERATORS` are already members of the wire's `VALID_AST_OPERATORS`, so nothing needs translating — with the spec's own `normalizeFilterOperator` as the single exit for the legacy spellings stored metadata still carries (`gt`, `eq`, `nin`, `notEquals`, …). That is the same exit the write side (`viewFilterFold`) and the saved-view fold in `@object-ui/core` already use, so the directions cannot drift into two dialects. An operator the spec does not know is passed through verbatim, so a misspelling still earns a loud `400` rather than being coerced into a valid filter.

  `before` and `after` are now passed through rather than rewritten to `<` and `>`. That was the one judgement call, and it was settled by measurement rather than assumption: on the same live backend the word and the symbol return identical status and identical record ids, on a `date` field and on a `datetime` field, in both directions — so the rewrite was a no-op and dropping it is a pure fix. The remaining 18 canonical operators were measured the same way and are likewise unchanged in what the server answers; `not_in` is the only one whose answer changes, from `400` to the correct rows. Tab presets given in the legacy already-lowered `filters: triplet[]` shape are untouched, as before.

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

- 5cb75b3: fix(timeline,list): the timeline honours `timeline.dateField`, not just `timeline.startDateField` (#3129)

  `dateField` is the pre-#2231 alias for `startDateField`. `@object-ui/types`
  declares it on the nested config (`ListViewTimelineConfig`), and both
  `ObjectView` read-sites (app-shell and plugin-view) resolve it — but the two
  read-sites that actually drive the axis did not:

  - `ObjectTimeline` consulted the alias only on the FLAT prop (`schema.dateField`),
    never on the nested `schema.timeline`.
  - `ListView` resolved it out of `options.timeline` but not out of the
    spec-canonical `schema.timeline` — including in the capability gate, so such a
    view could fail to offer the Timeline option at all.

  So a view authored as `timeline: { dateField: 'start_date' }` — the spec nesting
  with the legacy key — fell through to the caller's default (`created_at` /
  `due_date`). That field is normally absent from the `$select` projection, so
  every record came back without it and the timeline rendered all of them under
  **No date** — while the configured date was sitting in the row untouched. That
  also explains why widening the view's projection changed nothing: the projection
  already carried the right field; the renderer was reading a different one.

  Both read-sites now resolve the alias in the same precedence position they
  already use for `options.timeline.dateField`. The spec key still wins wherever
  both appear. Observable rendering change (records move out of "No date" into
  real date buckets), hence `minor`.

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

- 5eaa861: `list-view` and `embeddable-form` get a data source on the registry path — their required `objectName` was binding to nothing (#3144).

  `SchemaRenderer` puts the data source on `SchemaRendererContext` and **never** injects it into
  component props. A component that reads `props.dataSource` therefore needs its registration to
  bridge the two. `object-form`, `object-kanban` and `object-calendar` each register a small
  renderer that does exactly that. These two did not:

  - `list-view` (and its `view:list` alias) registered the bare `ListView`, which reads
    `props.dataSource` — so its `getObjectSchema` effect returned immediately, nothing was ever
    fetched, and it rendered the `empty-state` "Nothing here".
  - `embeddable-form`'s renderer was `({ schema }) => <EmbeddableForm config={schema} />`, dropping
    the context entirely — so the read-only source it derives for its inner `ObjectForm` was never
    built, and its submit path (`if (dataSource) await dataSource.create(...)`) had nothing to call.

  Both declare `objectName` **required** in their registry `inputs`. A binding the protocol obliges
  an author to supply, that nothing on that path can consume, is objectstack#4413's shape one layer
  up — and the reason it went unnoticed is that the console never takes this path: it reaches
  ListView through `ObjectView`'s `renderListView` render-prop, which passes a data source itself.
  Broken on the registry/SDUI path, which is the path `sdui.manifest.json` describes and a
  `kind:'react'` page walks.

  Found by `apps/console/src/__tests__/public-block-binding-reach.test.tsx` (objectstack#4472), not
  by hand — that suite mounts every public block declaring an `objectName` under a recording
  `dataSource` and asserts the binding arrives. Its ledger carried these two as named debt; with the
  bridge in place the ledger's both-directions assertion **failed until the entries were deleted**,
  which is the mechanism working as designed. Only `record:related_list` remains, and legitimately
  (it needs a parent record id from `RecordContext` before it may fetch).

  An explicit `dataSource` prop still wins, so hosts passing their own are unaffected, and
  `ListViewRenderer` forwards refs so `ListViewHandle` still works through the registry.

## 17.1.0

### Minor Changes

- d21794c: fix(list,i18n): a 400 from the server no longer reads as "check your connection"

  `classifyLoadError` was written because a 403 rendered the same
  "check your connection and try again" panel as a genuine outage — its own doc
  comment says users "were told to debug their network when the server had
  (correctly) denied them access." It made that distinction for 401 and 403 and
  then sent **everything else**, including 4xx, to the network branch.

  A **400** is the server saying it understood the request and will never accept
  it. Retrying resends the identical bad request, so "check your connection and
  try again" is advice that cannot work — the same mistake the function exists to
  prevent, one status code over.

  This became reachable from ordinary stored metadata with
  objectstack-ai/objectstack#4121: a `$filter` array that is not a filter AST is
  now rejected at the protocol with `400 INVALID_FILTER`, where it previously
  reached a driver (and, for a lone `['and']`, silently returned every row). A
  view saved with such a filter now answers 400 on every load.

  Adds a fourth classification, `rejected`, for `status === 400` and for the
  server's 400-class codes (`INVALID_FILTER`, `UNSUPPORTED_QUERY_PARAM`,
  `INVALID_QUERY`). Its copy points at the filter rather than the network, and
  says who can fix it when the view is saved that way. 403/401 keep priority, so a
  permission denial can never read as a bad request — pinned by a test.

  The two new strings are added to **all ten locale packs**, not just `en`: the
  neighbouring panels are translated, and `fallbackLng: 'en'` would have rendered
  this one in English beside them. The full-parity gate
  (`all-locales-key-parity.test.ts`) caught the pack I missed.

  Verified: 5 new tests — numeric status, error code without a status, a status
  embedded in the message text, and the 403/401 ordering guard. Reverting the
  branch fails four of them. `plugin-list` + `i18n`: **403 tests across 29 files**,
  green.

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

- 9eb932b: fix(console): three real-user console failures — 403 blamed on the network, ⌘K search capped at 8 objects, nav gating fields inert

  1. **List error panel classifies the failure** (`plugin-list`, `i18n`): a 403/401 from the data source used to render the same "check your connection" copy as a genuine outage, sending users to debug their network while the server was correctly denying access. The panel now classifies by `httpStatus`/`status`/`statusCode`, the `PERMISSION_DENIED`/`UNAUTHORIZED` error codes, or an `HTTP <status>` message prefix, and renders dedicated permission-denied / sign-in-required copy (all nine locales).

  2. **⌘K / full-page search scope is no longer truncated** (`react`): `maxObjectsQueried` caps the per-object fanout fallback, not the search scope — it used to slice the candidate pool itself, so the `objects` whitelist sent to the platform's `/api/v1/search` only ever named the first 8 nav objects. Which sidebar group came first decided which records were findable; everything later in the nav was unsearchable no matter what the user typed.

  3. **Nav gating fields finally gate** (`app-shell`): `evaluateVisibility` only evaluated `${…}` template strings, so the `{ dialect: 'cel', source }` envelopes the spec normalizes every authored `visible` predicate into fell through to a blanket "visible" — a constant-false predicate still rendered for everyone. It now delegates to `ExpressionEvaluator.evaluateCondition`, which routes CEL envelopes to the canonical `@objectstack/formula` engine. And the sidebars' `requiredPermissions` check treats a bare name as an ADR-0066 system capability (union of the user's permission-set `systemPermissions` from `/me/permissions`) — the same subset rule the server applies to `AppSchema.requiredPermissions` — instead of misreading it as `can(<name>, 'read')`, which had degraded `requiredPermissions` into a hide-from-everyone switch (admins included). The `object:action` form and the legacy object-read fallback keep working.

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

## 17.0.0

### Minor Changes

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

- f05b84e: refactor(views): ListView resolves density from the spec-canonical `rowHeight` (#2890 scope A step 2)

  Second rename in the ListView vocabulary migration: **`densityMode` → `rowHeight`**,
  folded in the same `normalizeListViewSchema` that step 1 introduced.

  Unlike `fields`/`columns` this is not a pure alias — the two vocabularies are
  different sizes. The spec has five row heights (`compact`/`short`/`medium`/
  `tall`/`extra_tall`); ListView's toolbar offers three densities
  (`compact`/`comfortable`/`spacious`). Both directions now live in one place as
  `DENSITY_MODE_TO_ROW_HEIGHT` / `ROW_HEIGHT_TO_DENSITY_MODE`, chosen so a fold
  followed by a read is a round trip (`spacious` → `tall` → `spacious`), with the
  narrowing collapse (`short` → `compact`, `extra_tall` → `spacious`) stated once
  instead of being re-derived per call site.

  Two behavior fixes fall out of it:

  - **Precedence is no longer inverted.** `ListView` read `densityMode` _first_, so
    a view carrying both keys rendered the legacy value — backwards from every
    other legacy/canonical pair in the schema. The canonical key now wins.
  - **The toolbar stops re-seeding the legacy key.** `ObjectView`'s
    `onDensityChange` persisted `densityMode` into stored view metadata on every
    density toggle, so the legacy vocabulary kept regrowing underneath the
    migration. It persists `rowHeight` now.

  `densityMode` stays declared on `ListViewSchema` and in the drift guard's
  sanctioned set — stored views carry it and it is still valid input — but it is
  input-only.

### Patch Changes

- ab46110: fix(list): show the real match total in the record-count status bar under server pagination

  The Airtable-style record-count bar read `data.length`, but under server-side
  pagination (#2212) `data` is only the current page window — so a 158-row result
  paginated 100/page reported "100 条记录" on page 1 and "58 条记录" on page 2,
  never the true total. There was no other place to see how many records the
  query matched.

  The bar now shows the server's grand total (`serverTotal`) when known, falling
  back to `data.length` when the whole result set is in memory (non-paginated,
  grouped and non-grid views are unchanged — `serverTotal` is null there, so the
  count is identical to before). Browser-verified against the showcase contacts
  list: the bar reads "158 条记录" and stays stable across pages, and switching to
  grouped/other views correctly resets to the loaded count.

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
  - @object-ui/mobile@16.0.0
  - @object-ui/permissions@16.0.0

## 15.0.0

### Patch Changes

- @object-ui/types@15.0.0
- @object-ui/core@15.0.0
- @object-ui/i18n@15.0.0
- @object-ui/react@15.0.0
- @object-ui/components@15.0.0
- @object-ui/fields@15.0.0
- @object-ui/permissions@15.0.0
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

### Patch Changes

- 4b0aee6: Fix: a view declaring its `sort` in the `@objectstack/spec` bare-string
  top-level form (`sort: "name desc"` — `ListViewSchema.sort` is
  `string | Array<{field, order}>`) crashed ListView with
  "schema.sort.map is not a function". Found by the spec/renderer
  shape-mismatch audit that followed the dashboard filter-options crash.
  Sort parsing is now a single normalized `parseSortConfig` (exported) that
  accepts the bare string, legacy `"field desc"` array entries, and
  `{ field, order }` objects, and returns `[]` for malformed entries instead
  of throwing. The `@object-ui/types` declaration already carried the union —
  only the implementation missed the string branch.

## 14.0.0

### Patch Changes

- 05e56ca: 导出/导入模板的下载文件名与内容本地化。

  **导出文件名**:CSV/Excel/JSON 导出下载不再是 `<对象名>.<扩展名>`(如 `contracts.csv`),改为「对象显示名-视图名-时间戳.扩展名」(如 `任务-In Progress-20260714-153045.xlsx`);`exportOptions.fileNamePrefix` 配置仍优先(且作为完整前缀,不再追加视图名)。视图名与对象名重复时自动省略;`@object-ui/core` 新增 `buildExportFileName(ext, { prefix, label, objectName, viewLabel }, now?)` 与 `sanitizeFileNameBase(raw)`,ObjectGrid 与 ListView 的所有导出路径(服务端流式与前端兜底)统一走它。app-shell/plugin-view 的 ObjectView 现将当前视图的显示标签写进传给 ListView 的 schema(`label`),使导出文件名能区分同一对象的不同保存视图。

  **导入模板**:「下载模板」修复两处英文漏出——示例行的 select/多选取值改为优先取选项**显示标签**(如 `准备中`)而非 ASCII slug(`prepare`,服务端导入两者都接受);模板文件名本地化为 `{{object}}-导入模板.csv`(新增 i18n key `grid.import.templateFileName`,英文回退 `{{object}}-import-template.csv`)。

- b66d8ee: The list toolbar search button now shows the active keyword inline (mirroring
  the Sort button's count badge). Previously a search term restored from
  localStorage after navigating away and back kept filtering the list while the
  search popover stayed collapsed — the only cue was a slightly darker magnifier
  icon, so users couldn't tell a keyword filter was still active. The keyword is
  rendered (truncated at 8rem) next to the magnifier whenever a search is active,
  and clicking it opens the popover pre-filled for editing or clearing.
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
  - @object-ui/permissions@14.0.0

## 13.2.0

## 13.1.0

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
  - @object-ui/permissions@13.0.0

## 12.1.0

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
  - @object-ui/mobile@12.0.0
  - @object-ui/permissions@12.0.0
  - @object-ui/react@12.0.0
  - @object-ui/i18n@12.0.0

## 11.5.0

## 11.4.0

## 11.3.0

## 11.2.0

## 11.1.0

## 7.3.0

## 7.2.0

## 7.1.0

## 7.0.0

### Minor Changes

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

- 4eb9cb6: feat(plugin-tree): add a `tree` / tree-grid object view type

  Renders a self-referencing object as an indented, expand/collapse tree-grid —
  the right view for arbitrary-depth hierarchies (business unit / org chart,
  category trees, BOMs, nested comments) that fixed-depth grouping can't express.
  New `@object-ui/plugin-tree` package (`object-tree`/`tree`), `tree` added to the
  `ViewType` union, and dispatch wired through plugin-list `ListView` +
  app-shell `ObjectView` (the console path).

### Patch Changes

- 053c948: fix(plugin-list): gate speculative `$select` fields by the object's real schema

  A list view auto-includes view-binding fields (kanban `groupBy`, calendar/gantt/
  timeline dates, gallery image, timeline status/priority) in `$select` so
  alternate view modes render populated. These were added unconditionally on the
  assumption that "the projection ignores unknown names" — but some backends
  (notably the cloud multi-tenant runtime) reject an unknown `$select` column with
  an EMPTY result set, so a single phantom field zeroed the whole list (an AI-built
  `product` view requesting `status`/`due_date`/`image` showed "no data" though
  rows existed). The speculative additions now go through `addSpeculative()`, which
  keeps only fields present in the object schema; user-declared columns and expand
  roots are untouched.

- db8cd00: feat(app-shell): global settle signal (window.\_\_objectui) + region aria-busy (ADR-0054 Phase 3)

  Adds a single machine-readable "is the app idle?" predicate (ADR-0054 C5). The
  data layer wraps the adapter's `fetch` to count in-flight requests, mirrored onto
  `window.__objectui` with live `idle` / `pendingRequests` getters plus `whenIdle()`
  and `subscribe()`. New `useSettleSignal()` React hook and lower-level exports
  (`getPendingRequests`, `subscribeSettle`, `whenIdle`, `withSettleSignal`,
  `installSettleSignalGlobal`). The list view and record-picker results regions now
  set `aria-busy` while fetching and `data-state="loading|idle"` for region-level
  waiting. Lets an automated (AI) driver wait for settle instead of hardcoding
  timeouts.

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
- @object-ui/i18n@6.0.0
- @object-ui/react@6.0.0
- @object-ui/components@6.0.0
- @object-ui/fields@6.0.0
- @object-ui/permissions@6.0.0
- @object-ui/mobile@6.0.0

## 5.4.2

## 5.4.1

## 5.4.0

## 5.3.2

## 5.3.1

## 5.3.0

## 5.2.1

## 5.2.0

### Minor Changes

- fe63b8c: Gallery cards now prefix numeric / currency / percent fields with their
  translated field label.

  The card layout in `ObjectGallery` previously dropped every label,
  relying on each cell renderer to be self-describing. That works for
  status badges, phone links, email links, and dates — but for bare
  numbers a row like `5,000,000 / 250` gives the user no clue whether
  those are revenue, headcount, pipeline value, or close-date.

  We now auto-prepend a small muted field label for the low-semantic
  renderer types (`number`, `currency`, `percent`, `integer`, `decimal`).
  Self-describing types are unchanged. The label is routed through the
  i18n field-label dictionary so authored objects with translated labels
  render consistently with the detail page.

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

- 50cdefd: Gallery cards no longer render a giant gradient letter placeholder when
  the configured `coverField` has no populated values anywhere in the
  dataset. Previously, simply declaring `gallery.coverField` would force
  the cover area on even when every record's image was null/empty, producing
  oversized 200×200 "C" / "A" letter blocks that dwarfed the actual card
  content (the Contact and Account card views in the CRM example were the
  most visible offenders).

  The configured-but-empty state now matches the unconfigured state:
  collapse the cover area, render a compact title-plus-fields card.
  When at least one record in the dataset has a cover image, the cover
  area still renders for all cards so heights stay consistent.

## 5.1.1

## 5.1.0

### Minor Changes

- 8fd863e: Platform highlight + list polish:
  - **deriveHighlightFields**: extended the preferred-field list (close_date, due_date, account, contact, …) and now skips fields whose declared type is not "highlight-friendly" (textarea, markdown, json, boolean, rich-text, etc.). Untyped legacy fields still pass through. Prevents long-form/structural fields from ending up in the highlight strip on objects with sparse metadata.
  - **ListView bulk-action labels**: bulk-action buttons now resolve their labels through `actionLabel(objectName, action, fallback)` so they pick up app-supplied translations under `_actions.<name>.label`, matching the detail-page page-header overflow menu. Falls back to the previous title-cased string when no resource is found.

## 5.0.2

## 5.0.1

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
  - @object-ui/mobile@5.0.0
  - @object-ui/permissions@5.0.0

## 4.8.0

### Minor Changes

- 3a17c8d: Mobile UI: aggressive chrome reduction to match real mobile-app conventions.

  Real mobile CRMs (Salesforce, HubSpot, Notion, Linear) keep one row of
  chrome on phones: title + 1 primary action, plus content. We were
  shipping ~5 rows of toolbars + chips + tabs above the data. This commit
  hides the desktop-only chrome at the `<sm` breakpoint:

  - **ListView**: TabBar (view switcher), UserFilters chip row, quick-filters
    chip row, Sort button, list-scoped Search popover, and the
    (newly-added) mobile-only ViewSettingsPopover gear are all hidden on
    phones. Only the **Filter** icon survives on mobile — paired with the
    global ⌘K top-bar search, that is the entire mobile control surface.
  - **Kanban**: previous commit replaced verbose swipe text with a dot
    indicator; that stands.
  - **ObjectView page header**: the Import (CSV upload) button is hidden
    on mobile — CSV import is a desktop workflow.

  Net effect on a 390px viewport: ListView toolbar collapses from
  ~10 controls (5 chips + 5 icons) to a single Filter icon next to the
  title; the body of the page is reachable without scrolling past 3 rows
  of chrome.

  Desktop and tablet behavior is unchanged.

- 51e274a: feat(app-shell,plugin-list): mobile Airtable-style topbar + filter chip row

  Refactor mobile object-view layout to match the Airtable Interface
  pattern:

  - **AppHeader**: the mobile topbar's static page label is now a
    view-switcher dropdown (`<viewName> ▾`). Tapping opens a list of
    available views with icons + active-state checkmark. Falls back to
    plain text when only one view exists, or when the current page has
    no view-switching surface (Home, Settings, …).
  - **ObjectView**: drops the standalone mobile `sm:hidden` view-select
    row that previously lived between the desktop tab bar and the
    content area. View switching is now exposed exclusively via the
    topbar dropdown on mobile, eliminating the duplicated `object name`
    vs `view name` rows.
  - **ListView**: un-hides the `UserFilters` chip row on mobile.
    Single-line, horizontally scrollable, matches the Airtable Interface
    filter chip strip.
  - New lightweight `MobileViewSwitcherContext` provides a
    page → header data channel (no zustand dependency added).

  Net effect on mobile (390×844):

  ```
  ☰ 客户卡片 ▾                🔍 🔔 M    ← topbar
  类型 ▾  行业 ▾  是否活跃 ▾  更多 3 ▾  ⛛  ← chip row
  [content cards]                          ← content
                                    (+)    ← FAB
  [Leads | Accounts | Contacts | …]        ← bottom nav
  ```

- faba0e3: Mobile UX cleanup:
  - `app-shell/AppHeader`: hide the platform-logo, app-switcher pill, and
    intermediate path separators on mobile when inside an app route. The
    sidebar already exposes those affordances; the topbar now reads
    `☰ + page title + Search + Inbox + Avatar`.
  - `plugin-list`: replace the hidden mobile TabBar with a new compact
    `TabBarSelect` dropdown (current view name + chevron → menu of every
    view). Phone users keep view-switching without burning a row on chip
    pills. Desktop continues to render the inline TabBar.

## 4.7.0

### Minor Changes

- 186fb2b: Mobile UI optimization: declutter list & kanban on small screens.
  - **ListView toolbar** now auto-collapses HideFields / Group / Color / Density into a single settings gear at `<sm` breakpoints, even when `compactToolbar` is not enabled. Desktop behavior unchanged.
  - **Kanban board** replaces the verbose "← Swipe to navigate →" caption with a compact dot indicator that tracks which column is currently snapped into view. Hidden when there is only one column.

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

### Patch Changes

- 22fa558: Clean up pre-existing TypeScript errors in `plugin-list` and tighten i18n:
  - Switch grouping-editor labels to `t(key, { defaultValue })` option form so i18next's strict types accept the literal fallback.
  - Add the missing `list.addGroup` / `list.collapsedByDefault` / `list.removeGroup` keys to en + zh locale bundles.
  - Drop the dead `currentView === 'list'` branch in `ListView` (local `ViewType` union has `'grid'`, never `'list'`).
  - Widen `UserFilters.resolveFields` `translateOptions` parameter from a generic `<T>` to the concrete option shape so it matches the `useObjectLabel` hook's signature.

## 4.4.0

## 4.3.1

### Patch Changes

- 5f4ac6e: perf(plugin-list): avoid allocating a new schema object every render when the viewType default is unneeded. Stabilizes the downstream `viewComponentSchema` memo so the child SchemaRenderer no longer reconciles on unrelated parent re-renders.

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
- @object-ui/i18n@4.0.1
- @object-ui/react@4.0.1
- @object-ui/components@4.0.1
- @object-ui/mobile@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0
  - @object-ui/components@4.0.0
  - @object-ui/core@4.0.0
  - @object-ui/mobile@4.0.0
  - @object-ui/react@4.0.0
  - @object-ui/i18n@4.0.0

## 3.4.0

### Patch Changes

- Updated dependencies [a2d7023]
- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
  - @object-ui/components@3.4.0
  - @object-ui/mobile@3.4.0
  - @object-ui/types@3.4.0
  - @object-ui/core@3.4.0
  - @object-ui/react@3.4.0
  - @object-ui/i18n@3.4.0

## 3.3.2

### Patch Changes

- @object-ui/types@3.3.2
- @object-ui/core@3.3.2
- @object-ui/i18n@3.3.2
- @object-ui/react@3.3.2
- @object-ui/components@3.3.2
- @object-ui/mobile@3.3.2

## 3.3.1

### Patch Changes

- Updated dependencies [b429568]
  - @object-ui/components@3.3.1
  - @object-ui/types@3.3.1
  - @object-ui/core@3.3.1
  - @object-ui/i18n@3.3.1
  - @object-ui/react@3.3.1
  - @object-ui/mobile@3.3.1

## 3.3.0

### Patch Changes

- @object-ui/types@3.3.0
- @object-ui/core@3.3.0
- @object-ui/i18n@3.3.0
- @object-ui/react@3.3.0
- @object-ui/components@3.3.0
- @object-ui/mobile@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0
- @object-ui/core@3.2.0
- @object-ui/i18n@3.2.0
- @object-ui/react@3.2.0
- @object-ui/components@3.2.0
- @object-ui/mobile@3.2.0

## 3.1.5

### Patch Changes

- Updated dependencies [cfe0596]
  - @object-ui/i18n@3.1.5
  - @object-ui/react@3.1.5
  - @object-ui/components@3.1.5
  - @object-ui/types@3.1.5
  - @object-ui/core@3.1.5
  - @object-ui/mobile@3.1.5

## 3.1.4

### Patch Changes

- @object-ui/types@3.1.4
- @object-ui/core@3.1.4
- @object-ui/i18n@3.1.4
- @object-ui/react@3.1.4
- @object-ui/components@3.1.4
- @object-ui/mobile@3.1.4

## 3.1.3

### Patch Changes

- @object-ui/types@3.1.3
- @object-ui/core@3.1.3
- @object-ui/i18n@3.1.3
- @object-ui/react@3.1.3
- @object-ui/components@3.1.3
- @object-ui/mobile@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2
- @object-ui/core@3.1.2
- @object-ui/i18n@3.1.2
- @object-ui/react@3.1.2
- @object-ui/components@3.1.2
- @object-ui/mobile@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1
  - @object-ui/components@3.1.1
  - @object-ui/core@3.1.1
  - @object-ui/mobile@3.1.1
  - @object-ui/react@3.1.1
  - @object-ui/i18n@3.1.1

## 3.0.3

### Patch Changes

- @object-ui/types@3.0.3
- @object-ui/core@3.0.3
- @object-ui/react@3.0.3
- @object-ui/components@3.0.3
- @object-ui/mobile@3.0.3

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2
- @object-ui/core@3.0.2
- @object-ui/react@3.0.2
- @object-ui/components@3.0.2
- @object-ui/mobile@3.0.2

## 3.0.1

### Patch Changes

- Updated dependencies [adf2cc0]
  - @object-ui/react@3.0.1
  - @object-ui/components@3.0.1
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

## 0.5.1

### Patch Changes

- Fixed ListView view preference persistence causing incorrect view rendering.

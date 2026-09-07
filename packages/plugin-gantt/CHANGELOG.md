# @object-ui/plugin-gantt

## 17.7.0

### Minor Changes

- 00f3eb5: `ObjectGanttSchema` declares the ten gantt keys `ObjectGantt` actually reads
  (objectui#5903, triage 2026-08-24). Every one is a real, working, documented
  feature — `readOnly`, `mobileReadOnly`, `markers`, `navigation`, `skipWeekends`,
  `holidays`, `criticalPath`, `showBaselines`, `persistLayout`, `viewName` — and
  none of them was discoverable from the published type, because all ten were read
  as `(schema as any).K`. The cast was the load-bearing part: it kept the read
  invisible to `tsc`, to the zod mirror and to the designer's registry `inputs`.
  
  Both halves move together. The TS declaration (`packages/types/src/objectql.ts`)
  and its zod mirror (`src/zod/objectql.zod.ts`) gain the same ten keys at the same
  requiredness — all optional — so the `zod-mirror-parity` ratchet stays at zero
  drift for this pair and no `KnownDrift` entry is added. `navigation` is taken
  from `@objectstack/spec`'s `NavigationConfigSchema` by reference rather than
  restated, matching `ObjectGridSchema.navigation`.
  
  `ObjectGanttProps.schema` is retyped from `ObjectGridSchema` to
  `ObjectGanttSchema`. That is what makes the declaration load-bearing: the ten
  keys are not grid keys, so with the old prop type, dropping the casts would have
  left the reads landing on `BaseSchema`'s index signature — the same invisibility
  in different syntax. The grid-style `{ gantt: { … } }` block is unaffected;
  `getGanttConfig` reads it through that index signature exactly as before, and the
  registered renderer passes `schema: any`, so no runtime shape is turned away.
  
  Accept-set change, stated plainly: a **declared** key is now type-validated, so
  `readOnly: 'yes'` is refused where it used to parse green — the same narrowing
  objectui#5074 landed for `viewMode`. An **undeclared** key is still accepted:
  `BaseSchema` is `.passthrough()` and carries an index signature (objectui#5155's
  structural ceiling), so declaring these ten did not buy rejection of a
  misspelling. `packages/types/src/__tests__/gantt-declared-keys.test.ts` pins both
  halves so neither can be misread.
  
  The eleventh reported key, `label`, needed no declaration — `BaseSchema` already
  carries it — so only its cast was dropped.
- 75bd83d: `ObjectGanttSchema` declares the flattened `GanttConfig` face `ObjectGantt`
  actually reads (objectui#6051). `getGanttConfig` has two branches: when
  `startDateField` and `endDateField` are both present at the TOP level it builds
  its config from top-level keys and returns early; otherwise it reads the `gantt`
  block. Everything the first branch reads was undeclared — and unlike
  objectui#5903's ten, none of it was hidden behind a cast. `BaseSchema` carries
  `[key: string]: any` (objectui#5155's structural ceiling) and the helper's
  parameter was `ObjectGridSchema | any`, so `schema.colorField` type-checked as
  `any` with no syntax anywhere to grep for. That is also why the census here is an
  AST enumeration and not a compile-and-observe: an index signature absorbs every
  literal name, so annotating the parameter compiles clean while enforcing nothing.
  
  **27 keys join the declared surface, each additive and each with a live read
  site.** 24 flattened `GanttConfig` members — `colorField`, `borderColorField`,
  `dependenciesField`, `parentField`, `typeField`, `lockField`, `objectField`,
  `summaryExtent`, `defaultCollapsedDepth`, `tooltipFields`, `baselineStartField`,
  `baselineEndField`, `groupByField`, `resourceView`, `assigneeField`,
  `effortField`, `capacity`, `quickFilters`, `autoZoomToFilter`, `timeSegments`,
  `interactions`, `exportFileName`, `timeZone`, `dependencyTypes` — plus the three
  query keys the fetch path reads, `staticData`, `filter` and `sort`. Nothing is
  declared that the renderer does not consume.
  
  **`GanttConfig` itself gains nine members and is a published type**, exported by
  name from `packages/types/src/index.ts`: `lockField`, `objectField`,
  `summaryExtent`, `defaultCollapsedDepth`, `borderColorField`, `dependencyTypes`,
  `timeZone`, `exportFileName`, `interactions`. The entry file's diff is empty only
  because the export list already named the type — the widening happened at the
  declaration.
  
  **The 28th measured key, `gantt` (the block face), is deliberately NOT declared**
  — see the closing section.
  
  The 24 are DERIVED from `GanttConfig` rather than restated, so the flat spelling
  cannot fork from the block spelling, and the invariant is pinned in the type
  system: every key of `GanttConfig` must be declared at the node's top level.
  Making that derivation possible moved nine members — `lockField`, `objectField`,
  `summaryExtent`, `defaultCollapsedDepth`, `borderColorField`, `dependencyTypes`,
  `timeZone`, `exportFileName`, `interactions` — out of `plugin-gantt`'s
  package-private `GanttConfigEx` and into `@object-ui/types`' `GanttConfig`. They
  are a MOVE, not new vocabulary: the `gantt` block already honoured all nine, and
  a type private to the plugin could be referenced by neither authoring face.
  
  Both halves move together, as in objectui#5903: the TS declaration and its zod
  mirror gain the same 27 keys at the same requiredness (all optional), the
  spec-modelled ones taken from `GanttConfigSchema.shape` by reference, so the
  `zod-mirror-parity` ratchet stays at zero drift for this pair and no `KnownDrift`
  or `UnmirroredDeclared` entry is added. The mirror builds the flat face and the
  `gantt` block from one field map, so they are one schema expressed twice.
  
  Accept-set change, stated plainly. All 27 keys are additive — every one is
  optional, and nothing previously legal loses its slot. What changes is that a
  **declared** key is now type-validated, so `capacity: 'one'` and
  `summaryExtent: 'parent'` are refused where they used to parse green. An
  **undeclared** key is still accepted — `BaseSchema` is `.passthrough()`, so this
  bought no rejection of misspellings. There is no narrowing anywhere in this
  change.
  
  **`gantt` is severed on purpose (objectui#6475), not overlooked.** It is the 28th
  key of the measured residue and a genuine read — `getGanttConfig`'s second branch
  honours it in full — but it is the one key whose declaration would NOT have been
  additive. It has no mirror entry today, so a block rides through `.passthrough()`
  unvalidated; declaring it as `GanttConfig` means it gets parsed against the spec's
  `GanttConfigSchema`, which REQUIRES `startDateField`, `endDateField` and
  `titleField`, and `ObjectGanttSchema` reaches the CLI's `validate` / `check`
  through `AnyComponentSchema`. A published CLI's refusal behaviour is decided on
  its own card, where reviewers can see what they are approving; objectui#6475
  carries the full measurement, including the case FOR enforcing it (the renderer
  already feeds that block to `GanttConfigSchema.safeParse` and warns, so enforcing
  restores declared = enforced rather than inventing a contract). Today's behaviour
  is pinned in the test file so the omission is a measured state, not a silent gap.
  `packages/types/src/__tests__/gantt-flat-config-declared-keys.test.ts` pins both
  halves so neither can be misread.
  
  Which face WINS is unchanged and was not decided here: the flat branch is checked
  first and returns early, so a node carrying both spellings still renders the flat
  one. (`plugin-map` had the opposite precedence ruled on in objectui#5018; no
  equivalent ruling exists for gantt.)
- d7acad6: **plugin-gantt: the `gantt` block now outranks the flat top-level spelling, and
  the losing face's keys are named instead of dropped.**
  
  `getGanttConfig` checked the flattened top-level spelling first and returned
  early, so a node carrying both spellings rendered the flat one and every key
  inside an authored `gantt` block was discarded with **no diagnostic** — not even
  the `GanttConfigSchema.safeParse` warning, which sat behind that early return.
  
  `plugin-map` had the identical two-faces shape ruled the other way (maintainer
  ruling on objectui#5018, 2026-08-17, landed in PR #5156): the block wins, with a
  dev-mode warning naming the ignored top-level keys. objectui#6469 inherits that
  ruling, so the two sibling view plugins now answer the same question the same
  way.
  
  What changes:
  
  - A node carrying **both** spellings now renders the **`gantt` block's** values.
    The block is taken **whole** — the flat keys are not merged into it.
  - In dev, `[ObjectGantt] … these top-level keys are IGNORED: …` names every
    shadowed flat key, once per distinct shadowing.
  - Nothing else moves. A node with only the flat spelling, or only a block, is
    read exactly as before.
  
  **Producer-safe:** `ObjectView` (`case 'gantt'`) and `ListView` (`case 'gantt'`)
  both flatten `options.gantt` onto top-level keys and emit **no** `gantt` key, so
  every gantt reached through either view layer still takes the flat branch, and
  the new warning cannot fire on that path. This is the same producer check the
  `plugin-map` flip pinned, re-run on today's `main`.
  
  This **supersedes** the precedence sentence in the objectui#6051 changeset
  (`.changeset/6051-gantt-flat-config-declared-keys.md`), which recorded the flat
  branch winning — accurate for that change, which deliberately did not touch
  precedence, and reversed by this one.
- e3d117a: `ObjectGantt` and `ObjectTree` resolve a relationship target only from the two
  spellings a contract carries, dropping the third one no contract declares
  (objectui#6837, second slice).
  
  - `ObjectGantt`'s quick-filter option fetch was
    `fd?.reference_to ?? fd?.reference ?? fd?.referenceTo`; it is now
    `fd?.reference_to ?? fd?.reference`.
  - `ObjectTree`'s `detectParentField` was
    `def?.reference || def?.reference_to || def?.referenceTo`; it is now
    `def?.reference || def?.reference_to`.
  
  **Accept-set move — a def carrying ONLY `referenceTo` stops resolving a target
  at these two seams.** Concretely: the gantt quick filter for that field falls
  back to the distinct values present in the loaded rows instead of fetching the
  referenced object's full domain, and the tree stops auto-detecting that field as
  its parent pointer, so records render as a flat forest unless `parentField` is
  configured explicitly. Nothing else changes; the two surviving arms are
  untouched.
  
  Two things bound that move:
  
  - Any def that entered through the ingestion choke point is unaffected.
    `normalizeSchemaReferenceKeys` reads `reference_to ?? reference ??
    referenceTo` and stamps both snake_case keys, so a `referenceTo`-only def
    arriving via `MetadataProvider` or `ObjectStackAdapter.getObjectSchema`
    already carries `reference_to` before either component sees it. Only a def
    that bypassed that door entirely is affected — and that door is not total:
    `getObjectSchema` is a required member of the published `DataSource`
    interface, and both components call it on the generic `dataSource`.
  - No contract declares the deleted spelling. `@objectstack/spec` 17.2.0's
    `FieldSchema` refuses `referenceTo` by name with `unrecognized_keys`, carrying
    its own "Did you mean `referenceTo` -> `reference`?" rename, and `referenceTo`
    is additionally a tombstone in `RETIRED_FIELD_KEY_TOMBSTONES` (objectui#6041)
    at all three strip sites, so the designer read door removes it before a draft
    round-trips.
  
  A repo-wide structure-walk producer census found **0** emitters of `referenceTo`
  reaching either seam, measured in the cell these components read (a value inside
  an object schema's `fields` container) against controls `reference` (92 hits / 36
  files) and `reference_to` (52 / 36) hot in the same pass over the same cells;
  the only two in-cell hits are negative fixtures of the retirement machinery,
  asserting the read door strips the key. Neither `plugin-gantt` nor `plugin-tree`
  emits `referenceTo` anywhere, while both packages' own fixtures are hot on the
  surviving spellings.
  
  Pinned by `ObjectGantt.referenceArms-6837.test.tsx` and
  `ObjectTree.referenceArms-6837.test.tsx`, which keep the live arms green beside a
  named refusal for the deleted key.
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
- bf244f4: Size the gantt task list from its container, and give a row's dates ONE predicate
  (objectui#7204, objectui#7224; maintainer ruling 2026-09-02, option Y).
  
  **A row could show no dates at all.** Two gates decided whether a row's dates were
  painted, and they read two different widths. The Start/End columns were gated on the
  container-derived task-list width; the `8/26 → 9/2` sublabel under the title was gated
  by the component's own `@media (min-width: 640px) { .gantt-sm-hidden { display: none } }`
  rule, which reads the viewport. Between a 640px and a 1023px container both were shut,
  so the row's dates existed in the DOM twice and were painted zero times. The same hole
  opened at any width once the splitter was dragged under the threshold.
  
  The sublabel now renders on exactly the complement of the Start/End columns, both from
  the same container-derived width, and the media rule is gone. A row always carries its
  dates one way or the other.
  
  **And the task list no longer caps at 320px.** From a 1024px container up, the pane
  takes 3/8 of the container clamped to `[320, 560]` instead of a flat 320. At 1440 that
  is 540px, which leaves the title 287px with the Start/End columns still painted — a
  40-character title measures 262px in the row's font, so real-world task names stop
  truncating to about seven characters while several hundred pixels of chart sit empty.
  Measured in Chromium at a 1440px container: title 53px before, 287px after.
  
  The Start/End threshold moves from an estimated 280 to a derived **412** — 32 row
  padding + 160 for the two columns + 28 for the open-details slot + 32 of title
  furniture + 160 minimum title, each term traced to the markup that spends it. Below it
  the sublabel carries the dates. One consequence worth stating: between a 1024px and a
  1097px container the columns are now off and the dates ride the sublabel, which trades
  two 80px date cells for a title that grows from 67px to 291px.
  
  Not fixed here, and unchanged: a row's `depth * 14` indent is unbounded, so no single
  default keeps a deeply nested row legible.
- 7c3df8f: A non-grid view's fetch now carries a platform row ceiling, and crossing it is
  never silent (objectui#7210, maintainer ruling a′, 2026-09-02).
  
  Before this, `ObjectGantt`, `ObjectCalendar`, `ObjectMap` and `ObjectTree` each
  issued a `find` with **no `$top` at all**, so the request returned the entire
  filtered result set. At the 186 rows the card was filed from that is invisible;
  on an object with 100k scheduled rows it is the whole table into the browser,
  and nothing an author could write — `pagination.pageSize` included — could
  bound a request that never carried a cap to begin with.
  
  **What changed.** Those four fetches now ask for `NON_GRID_ROW_CEILING_TOP`
  rows, draw at most `NON_GRID_ROW_CEILING` of them, and when the result set was
  larger they render a footnote naming both numbers, verbatim as it renders:
  *"Showing the first 2000 of 41234 records. Narrow the filter."* Below the
  ceiling nothing changes: the full set draws and no footnote appears.
  
  The four view packages take a **minor**, not a patch: a result set above the
  ceiling is no longer drawn in full, which is a behaviour break whatever the
  fixed group does to the released version number.
  
  **The ceiling is a platform constant, not an authorable key** — `2000`, exported
  from `@object-ui/react` as `NON_GRID_ROW_CEILING`. An authored `limit` or
  `dataSource: { limit }` still does not reach these queries, by the same ruling;
  three alternatives were rejected with it (a documentation note only — still the
  whole table; truncating at `pageSize` — silent, and a complete schedule capped
  at one page; an authorable `maxRows` — a new permanent key every author sets).
  
  **Why 2,000.** One constant for all four, so the binding view sets it. Measured
  in this repo's jsdom lane: gantt, calendar and map hold their DOM flat as rows
  grow (virtualised task list; four events per day cell; auto-clustering above
  100 markers), while `ObjectTree` flattens every expanded node into the document
  at a linear **5.2 DOM elements per record** with no virtualisation. 2,000 rows
  is where the worst of the four lands at ~10,400 elements — an order of
  magnitude above Lighthouse's "excessive DOM size" warning, and still ~10x the
  real application result set this card came from.
  
  New exports on `@object-ui/react`: `NON_GRID_ROW_CEILING`,
  `NON_GRID_ROW_CEILING_TOP`, `applyNonGridRowCeiling`, `NonGridRowCeilingNote`
  and the type `NonGridCeilingResult`. Two new `common.*` i18n keys carry the
  footnote copy in all ten packs.
- b041b9c: `@object-ui/core` publishes `resolveRecordSourceObjectName`, the ONE reader for "which
  object is this block bound to" (objectui#7627).
  
  Six view plugins each spelled that resolution locally — `ObjectCalendar` twice,
  `ObjectGantt`, `ObjectTree` twice, `ObjectMap`, `ObjectGrid` — and had drifted: three
  wrote `?? schema.objectName`, one `|| ''`, one `: undefined`, one an `'object' in
  dataConfig` test. They now delegate to one function that states the published
  objectui#6939 record-source ladder (`data`, then `staticData`, then `objectName`) once.
  
  **No behaviour changes.** Each site's pre-collapse expression is transcribed verbatim
  into `record-source.behaviourNeutrality-7627.test.ts` and asserted equal to its
  post-collapse spelling across the whole contract-valid input matrix — both bindings
  present, data only, `objectName` only, empty `objectName`, empty `data.object`, the
  `api` / `value` / `staticData` / array-shorthand providers, and nothing bound.
  
  **Two questions stay two questions.** `normalizeListViewSchema`'s gap-fill (#7477,
  ruling B of PR #7628) is untouched and is NOT re-pointed at the new reader: it answers
  how `objectName` gets POPULATED when absent, where an already-present `objectName` wins.
  The new reader answers which object a block RESOLVES, where the `data` block wins — the
  order declared on both published faces in `@object-ui/types` and pinned by
  `objectql-record-source-refinement-6939.test.ts`. Merging them would silently override
  one standing ruling or the other.
  
  **`ObjectGantt`'s `persistLayoutKey` is deliberately excluded** and keeps its inverted
  order, with an in-place comment saying why: its receiver is a localStorage key
  (`gantt-layout:KEY:filters`), not a record source, so re-pointing it would orphan every
  saved layout and filter-chip set of a view carrying both bindings. Two more sites the
  finding listed are not object-name readers at all and were struck: `ObjectGantt`'s
  refresh-handler predicate (`object` OR `api`) and `plugin-dashboard`'s `isObjectProvider`
  type-guard over a widget's `data`.
  
  `useSettledSchema`'s doc comment stops prescribing the hand-written ladder at all four
  lines that taught it, so the copies cannot re-seed from the hook that replaced them.
- 199d31b: **`viewMode` is now declared authoring surface on `ObjectGanttSchema`, and both
  gantt renderer branches honour it** (objectui#5074, maintainer ruling
  2026-08-19: declare-and-wire; the spec half landed first upstream).
  
  - `ObjectGanttSchema` (TS interface and zod mirror) declares `viewMode`,
    DERIVED from the pinned `@objectstack/spec` `GanttConfigSchema.viewMode`
    enum by reference, so the member list cannot drift. Deliberately no
    default: an omitted `viewMode` keeps letting a persisted layout
    (`persistLayoutKey`) seed the timeline granularity before the renderer's
    `'day'` fallback.
  - The timeline branch (`GanttView`) now receives an authored `viewMode`.
    Previously only the resource-workload branch (`resourceView` +
    `assigneeField`) honoured it, so `viewMode: 'month'` on an ordinary gantt
    view was silently ignored.
  - The `(schema as any).viewMode` cast in `ObjectGantt` is retired; both
    branches read the declared `ganttConfig.viewMode`, which also honours the
    key when authored inside the spec's `gantt` config block.
  - Accept-set note: `viewMode` is now a DECLARED key, so an off-enum value
    (e.g. `viewMode: 'hour'`) becomes a zod validation error where it
    previously passed through unvalidated. Values on the published spec enum
    are unaffected.

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
- 9b61cf1: The package README stops documenting a `navigation` key the spec refuses, and the corrected example is now parsed by the schema that validates it.
  
  `README.md`'s record-navigation override read
  `{ mode: 'page', basePath: '/console/apps/.../campaign' }`. `basePath` is not a
  member of the spec's `NavigationConfig`, and nothing consumes it:
  `useNavigationOverlay` — where a gantt's `navigation` lands — builds no URL out
  of the config, and `ObjectGantt` calls the hook with no `onNavigate`, so a
  page-mode click falls through to the host's `onRowClick`. The destination route
  is owned by the host and was never authorable through this key, under any
  spelling.
  
  That made the snippet worse than inert. `NavigationConfigSchema` is a strict
  object with no passthrough, so the undeclared key did not fall away quietly — it
  rejected the **whole** config with `unrecognized_keys`, taking down the
  `mode: 'page'` the sentence was actually teaching. An author who copied the
  documented snippet got a rejected navigation config and no page navigation, which
  is the copy-the-snippet-get-rejected shape objectui#5057 / #5012 named on other
  keys.
  
  The example is corrected to `{ "navigation": { "mode": "page" } }` — the shape
  the sentence demonstrates — and the prose now says who owns the destination route
  and points at `@objectstack/spec`'s `NavigationConfigSchema` for the member list
  instead of restating it, matching the derivation `ObjectGanttSchema.navigation`'s
  doc comment (objectui#5903) adopted for the same concept.
  
  `view` is **not** substituted for `basePath`. It is a declared member, but it
  names a form view (the spec: *"Name of the form view to use for details"*) and is
  forwarded to `onNavigate` as the action argument — it is not a route, so putting
  it where `basePath` stood would have replaced an invented key with a wrong one.
  It is documented for what it does.
  
  No gate in this repo could have caught the original defect, and that is why the
  fix ships with a measurement rather than a re-reading: `check-doc-snippet-types`
  compiles `ts`/`tsx` fences and `check-doc-component-types` reads `type` literals,
  and both are structurally blind to a metadata key in a README — the former's own
  header records schema-key validity as "a different question … left unruled on
  purpose". `src/readme-navigation-example.test.ts` closes that hole for this
  example by EXTRACTING the fence from the README on every run and parsing it
  against `NavigationConfigSchema`, with a control asserting the same parse still
  rejects an undeclared key by name, so the green cannot come from a schema that
  accepts everything.
  
  `tsconfig.test.json` names `node` in `types` for that test to compile, and its
  comment — which had recorded that no test in this package touches a Node global
  — is corrected rather than left standing.
- cbc8839: `ObjectGantt`'s export filename resolves a locale-map `label` instead of stringifying it
  (objectui#6052). A gantt authored as
  `{ "type": "object-gantt", "objectName": "task", "label": { "en": "Shift Plan", "zh-CN": "排班计划" } }`
  exported its PNG/PDF as `[object Object]-20260825-1030.png`.
  
  `BaseSchema.label` is `string | I18nLabel` since #4580's revised Q1-A ruling — `I18nLabel`
  being the spec's INLINE locale MAP — and the `exportFileName` chain handed that value
  straight to `String(...)`. It now goes through `resolveI18nLabel` from `@objectstack/spec/ui`,
  the producer's own resolver for that vocabulary, against the display locale the file already
  reads via `useDisplayLocale()`. A zh-CN audience gets `排班计划-<stamp>.png`, an en audience
  `Shift Plan-<stamp>.png`, and a plain-string label is unchanged.
  
  The next link in the same chain, `objectSchema?.label`, is deliberately left alone: that is
  the DATA object's label, declared `z.string().optional()` on the spec's `ObjectSchemaBase`,
  which is a `strictObject` — a locale map there is rejected by the producer rather than
  resolved by the consumer, and wrapping it would be accepting a second vocabulary at a read
  site. No filename sanitisation is added either; `GanttView` already strips
  filesystem-hostile characters downstream, and a resolved map entry goes through the same
  strip a plain string does.
- 45a9aeb: `ObjectGanttSchema.dependencyField` is now marked `@deprecated` on both published
  declaration faces, naming `dependenciesField` as the canonical spelling
  (objectui#6470). Nothing is removed and nothing is rejected that was accepted
  before.
  
  **What the two spellings were.** `ObjectGanttSchema` declares both, and
  `getGanttConfig`'s flat branch reads them with a `||`:
  `dependenciesField: schema.dependenciesField || schema.dependencyField`.
  `dependenciesField` is the spec's key (`@objectstack/spec`
  `GanttConfigSchema.dependenciesField`); the singular `dependencyField` has NO
  spec counterpart — zero occurrences across `packages/spec/src`, measured against
  a live positive control on the plural. Until objectui#6051 declared the plural,
  the singular was the ONLY dependencies spelling this interface carried, so for
  the whole time the alias existed the published type taught the non-spec key and
  hid the canonical one.
  
  **What was missing was the ranking, not the behaviour.** The two were declared as
  equals: nothing on either face said which one to author, so a reader — including
  an AI writing metadata, which is the reader this project optimises for — had a
  coin flip between a spec key and pre-spec vocabulary. The marker turns that coin
  flip into a fact the type itself carries, and the zod mirror's description makes
  it readable at runtime as well as in an editor.
  
  This adopts the idiom already ruled for this exact shape rather than inventing a
  second one: `KanbanConfig`'s pre-#2231 aliases (`groupField`, `cardFields`) carry
  `/** @deprecated legacy alias for the spec's X */` plus
  `.describe('Deprecated alias for X')`, and `dependencyField` now reads the same
  way.
  
  **⛔ Not a removal, deliberately.** Deleting the alias — or narrowing the
  renderer's `||` — would break every author who wrote the singular and narrow the
  accept set of a published surface. That is a maintainer decision on a future
  enforce-or-remove card once the deprecation has sat a release, and it is
  explicitly excluded here. Two pins hold the line in both directions:
  `packages/types/src/__tests__/gantt-dependency-field-deprecated-alias.test.ts`
  fails if the marker goes missing AND if the alias stops being declared or
  accepted, and `packages/plugin-gantt/src/ObjectGantt.dependencyAlias.test.tsx`
  fails if the `||` limb is dropped — the two spellings must keep resolving to the
  same config, with the canonical one winning when both carry a value.
  
  `packages/plugin-gantt/README.md`'s `ObjectGanttSchema` example authored the
  singular; it was the only in-repo site that did, and it now authors the plural
  with the alias named as legacy. No runtime code, fixture, example app or catalog
  schema authored it.
- f9653ae: Re-key the load-bearing fetch effects in `ObjectMap`, `ObjectCalendar` and
  `ObjectGantt` onto the primitive fields they actually read off `dataConfig`
  (`provider` / `object` / `items`) instead of the whole memoised `dataConfig`
  object (objectui#6592, the deferred half of objectui#6270/PR #6591).
  `ObjectTree` is a census member too but is deferred out of this change — see
  the PR body — because its own fetch effects are the surface of PR #6696
  (objectui#6481), open at the same time.
  
  `useMemo` carries no semantic guarantee — React is permitted to discard a
  memo cache and recompute even when its dependency array compares equal to
  the previous render, and the local `getDataConfig(schema)` helper each of
  these renderers carries builds a fresh `{ provider, object }` /
  `{ provider, items }` wrapper object on every call. So a fetch effect keyed
  on `dataConfig` itself was correct only for as long as that identity
  happened to survive a discard: a recompute alone (no author or caller
  action) was enough to re-run the effect and issue an extra
  `dataSource.find` / `dataSource.getObjectSchema` call. Keying the effects
  on the primitives instead makes a cache discard a no-op, restoring
  `useMemo` to a pure optimisation.
  
  `ObjectGantt`'s `effectiveDataSource` memo deliberately keeps `dataConfig`
  as a dependency (`resolveDataSource` needs the whole provider-shaped
  value — the `api` provider's `read`/`write` request config cannot be
  flattened to a fixed primitive list the way `object`/`value` can), so its
  `reload()` fetch is decoupled from the redundant direct `dataConfig`
  dependency but not from `effectiveDataSource`'s own; for the `object`/`value`
  providers `resolveDataSource` returns its `fallback`/a fresh
  `ValueDataSource` respectively rather than reading further into the config,
  which is enough for the two fetch effects to observe no extra call under a
  recomputed-but-equivalent `dataConfig` in the common case.
  
  No behaviour change for a schema whose `useMemo` caches survive normally;
  the effects are unaffected by React discarding one.
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
- 231d1b9: Gantt toolbar: the period label names the visible window, and the prev/next
  buttons step it (objectui#7203).
  
  The label formatted `timelineRange.start` — the memo spanning the whole dataset
  — so it named the first unit of the entire result set and could not change while
  the chart was scrolled, because it was not derived from scroll position at all.
  On a dataset running January to December it therefore read "January 2026" at
  every scroll position, four pixels above a band header correctly reading
  "Aug 2026". Measured on the demo fixture in Chromium at 1440x900: on first paint,
  after the chart auto-scrolls to Today, the label read `December 2025` over
  columns `28F 29S 30S 31M 1T 2W 3T` with the band beneath them reading `Aug 2026`.
  Two month labels four pixels apart, disagreeing — and the wrong one is the
  prominent one, so the chart reads as if the columns were mislabelled.
  
  The label now names the period at the left edge of the viewport, snapped to the
  same tier `headerGroups` bands the timeline by: a month under day and week view,
  a year under month and quarter view, a decade under year view, the shift-day
  under shift-segmented day view. The toolbar and the band header therefore agree
  by construction rather than by two derivations that can drift. Wording is
  unchanged for the month tier — the toolbar still spells the month out
  ("August 2026" beside the header's "Aug 2026").
  
  The `‹` / `›` buttons rendered an `aria-label` and an icon and carried no
  `onClick`. They now scroll the visible window one period backwards/forwards at
  that same tier, clamped to the ends of the timeline (ADR-0049 enforce-or-remove:
  wiring is the branch the label change makes available). They step the label's
  tier rather than one column, so a click always changes what the label says.
  
  The band header is untouched. It was already correct; it is the reference here.
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
- 92c65aa: `ObjectGantt` no longer blanks the chart when one reload supersedes another
  
  `reload()` already sequenced concurrent runs with `reloadSeqRef` and guarded every
  result write with `isCurrent()`, but its `finally` was unguarded — so a **superseded**
  reload still flipped `loading` / `refreshing` off. The stale run only had to finish
  first, which is the ordinary case whenever a second reload is issued while the first
  is still in flight: the placeholder was released, no rows had arrived, and the user
  saw an empty chart until the fresh response landed.
  
  The `finally` now clears the flags only when the run reaching it is still the current
  one. It clears **both** flags rather than only the one its own `silent` mode set:
  being current at that point means nothing is in flight any more, so clearing only its
  own mode would strand the other flag whenever the superseded run used the other mode
  — a silent toolbar refresh overtaken by a filter-change reload would have left the
  refresh button busy for the life of the component.
  
  This is the reload guard alone. Nothing about which queries are issued, how they are
  projected or how they page changes.
- e75f4c9: `colorField` now means the same thing in the gantt, the calendar and the timeline
  (objectui#7243).
  
  **The inversion this fixes.** `gantt.colorField` is documented as "field that drives the
  bar color", and the renderer passed the stored value straight into the bar's
  `backgroundColor`. Pointing the key at a select field therefore emitted
  `backgroundColor: "open"` — not a colour, so the browser dropped the declaration and
  every bar rendered identically. OMITTING the key was strictly better: the absent-key
  branch derived a real colour per status. Declaring the documented key was worse than not
  declaring it, with no error, warning or console message either way.
  
  The same key also meant three different things across the three lenses: the timeline
  resolved the field's authored option `color`, the calendar hashed the raw value onto a
  fixed palette, and the gantt emitted the raw value. An author colouring three views by
  one field got three unrelated results, one of which was no colour at all.
  
  **The ladder.** `@object-ui/core` gains `createFieldColorResolver` — the timeline's
  resolver, lifted so all three call it:
  
  1. the field's own option `color` for the record's value;
  2. else the value itself when it already IS a colour literal (`#rgb`, `#rrggbb`,
     `#rrggbbaa`, `rgb(...)`, `hsl(...)`);
  3. else each renderer's own last rung, which is deliberately NOT shared — the gantt
     derives a semantic-token hex (a bar must be painted), the calendar keeps its
     theme-aware 8-stop hash (a soft tint, not a solid fill), the timeline draws its
     default marker.
  
  **What changes for authors.** A gantt or calendar whose `colorField` points at a select
  field with authored option colours now paints those colours. A gantt value that is
  neither an option colour nor a colour literal now derives a colour instead of emitting
  an invalid CSS value — including a palette NAME (`red`), which now resolves to that
  palette's hex, the behaviour the key's own contract has always promised ("hex or
  semantic name") and the one `borderColorField` already had. `gantt.borderColorField`
  takes rung 1 as well, so an authored option colour reaches the alert stroke; it keeps
  today's behaviour otherwise and deliberately gains no derivation rung, since the stroke
  is opt-in and deriving one for every record would draw an alert on records that have
  none.
  
  Calendars whose `colorField` points at a plain categorical field are unchanged: that
  value still reaches `CalendarView`'s deterministic hash exactly as before. The timeline
  is unchanged apart from accepting the 8-digit `#rrggbbaa` hex spelling the calendar
  already accepted.
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
- ce2aaef: One shared record-source ladder, five plugins delegate (objectui#7632).
  
  `@object-ui/core` publishes `resolveRecordSourceConfig(schema)` — the ONE implementation
  of the ruled three-rung record source ladder: `data` first, then `staticData` wrapped as
  `{ provider: 'value', items }`, then `objectName` folded to `{ provider: 'object' }`, and
  `null` when nothing is bound. It is the PRODUCER whose output the objectui#7627 reader
  `resolveRecordSourceObjectName` consumes, and it now sits beside it in the same module.
  
  That ladder is published contract on both faces — `packages/types/src/objectql.ts` and its
  zod mirror both ship `.describe()` strings naming `getDataConfig`'s order (objectui#6939,
  maintainer ruling 2026-09-02), pinned by `objectql-record-source-refinement-6939.test.ts` —
  and it was hand-copied into five plugin components with no gate holding them together. A
  change to the ruled order had five edit sites and nothing that noticed a missed one; that
  is the AGENTS.md #0.1 drift class.
  
  **No behaviour changes.** `ObjectCalendar`, `ObjectGantt` and `ObjectTree` now call the
  shared reader directly. `ObjectGrid` and `ObjectMap` keep their own bare-array `data`
  shorthand as a documented head above the shared call and are otherwise unchanged.
  `record-source-config.behaviourNeutrality-7632.test.ts` transcribes all five pre-collapse
  bodies verbatim and asserts the post-collapse spelling agrees with each across the whole
  input matrix, so a later edit to the shared reader that moves any site turns red.
  
  **Two divergences were measured rather than assumed, and both are preserved.**
  
  `ObjectCalendar`'s `'data' in schema && schema.data` guards exist because its parameter is
  the union `ObjectGridSchema | CalendarSchema` and `CalendarSchema` declares neither key.
  That is a TypeScript narrowing device with no runtime effect — an absent property reads
  `undefined`, falsy either way — so the guard could never change which rung is taken. The
  shared reader's optional-property parameter accepts the union directly, and the
  equivalence is pinned on a fixture that really lacks both keys rather than argued.
  
  `ObjectGrid` and `ObjectMap` normalize a bare-array `data` to `{ provider: 'value', items }`;
  `ObjectCalendar`, `ObjectGantt` and `ObjectTree` do not, and return the array verbatim. That
  is a real divergence on off-contract input — `ViewData` is a discriminated union over object
  variants, so an array under `data` cannot be published. It is NOT unified here: the shared
  rung stays contract-strict and the two sites keep the head locally, the same way objectui#7627
  left the off-contract `{ provider: 'object' }` tails at their sites. Both sides of the fork are
  pinned, so neither folding the head in nor deleting it as redundant can happen silently.
  
  `ObjectTree`'s copy took `schema: any`; it now goes through the shared reader's typed
  parameter. Types are erased at runtime, so nothing it resolves moves.
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
- Updated dependencies [f66072d]
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
- Updated dependencies [1117414]
- Updated dependencies [6d63cd0]
- Updated dependencies [fc62bb4]
- Updated dependencies [41df893]
- Updated dependencies [7c96c94]
- Updated dependencies [4da5109]
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
- Updated dependencies [63d54dd]
- Updated dependencies [7e19d03]
- Updated dependencies [b08b7eb]
- Updated dependencies [546ddf7]
- Updated dependencies [864154e]
- Updated dependencies [b023625]
- Updated dependencies [75bd83d]
- Updated dependencies [44d075b]
- Updated dependencies [40c479a]
- Updated dependencies [b4393e5]
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
- Updated dependencies [d3005f7]
- Updated dependencies [1e7fe0a]
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
- Updated dependencies [3777538]
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
- Updated dependencies [9409eb9]
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
- Updated dependencies [eeb6c2f]
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
- Updated dependencies [854cba3]
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
- Updated dependencies [6411def]
- Updated dependencies [b9f5ff1]
- Updated dependencies [e75f4c9]
- Updated dependencies [19f1639]
- Updated dependencies [4704aa4]
- Updated dependencies [47547d0]
- Updated dependencies [b61d7d8]
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
- Updated dependencies [fe8f451]
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
- Updated dependencies [d06fba8]
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
- Updated dependencies [0b12a33]
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
- Updated dependencies [6c1b105]
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
- Updated dependencies [17fbbaf]
- Updated dependencies [d8cf1cb]
- Updated dependencies [0d1e702]
- Updated dependencies [b03ba3a]
- Updated dependencies [0068348]
- Updated dependencies [641543f]
- Updated dependencies [8a44390]
- Updated dependencies [fa140b8]
- Updated dependencies [71cba28]
- Updated dependencies [190fbd0]
- Updated dependencies [c00bf28]
- Updated dependencies [23705b7]
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
  - @object-ui/plugin-detail@17.7.0
  - @object-ui/react@17.7.0
  - @object-ui/permissions@17.7.0

## 17.6.0

### Patch Changes

- 5edc0c5: `object-gantt` / `object-map` / `object-calendar` no longer drop a sort entry that omits `order`.
  
  The three blocks each inlined a byte-identical private copy of the `sort` →
  `$orderby` conversion. That copy required BOTH `field` and `order` on an array
  entry and silently skipped any entry missing one, so a stored view sorting by
  `[{ field: 'amount' }]` reached the wire with no ordering at all — the authored
  sort key was lost, not applied. The same copy already treated the STRING
  spelling `"amount"` as ascending, so this was an inconsistency between two
  spellings of one thing rather than deliberate strictness.
  
  All three now import the shared `convertSortToQueryParams` sink from
  `@object-ui/core` (introduced by objectstack#7137, already used by
  `object-timeline` and `record:line_items`), and the private copies are gone —
  the sink is the repo's only definition. Two behavior changes come with it, both
  of which make the blocks more faithful to what is already declared rather than
  more tolerant:
  
  - An array entry that omits `order` now orders ASCENDING instead of vanishing.
    That is what `QueryParams.$orderby`'s own member shape
    (`{ field: string; order?: 'asc' | 'desc' }`) says, and what
    `@object-ui/data-objectstack`'s `serializeOrderBy` already did with a missing
    direction.
  - When nothing orderable was authored, the query now carries no `$orderby` at
    all instead of an empty object. `{}` is truthy and meant "no ordering" only by
    accident of the adapter's serializer.
  
  Reachability, so the size of this is not overstated: `SortConfig.order` and
  `ElementDataSourceSort.order` are REQUIRED in objectui's own types, so a typed
  caller could never author the dropped shape. The affected surface is untyped
  stored view metadata (`ElementSavedView` is a loose record by design) — which is
  exactly where an order-less entry can arrive today.
- 6098ecd: plugin-gantt README: the `onTaskUpdate` drag example no longer writes blank dates on a progress drag.
  
  `GanttViewProps.onTaskUpdate`'s second parameter is
  `Partial< Pick< GanttTask, 'title' | 'start' | 'end' | 'progress' > >`
  (`src/GanttView.tsx:345`), so the destructured `start` / `end` are
  `Date | undefined`. The README's "Drag-and-drop rescheduling" example destructured
  them and passed both straight to `save(...)`, under a comment asserting they are
  always real `Date` objects. Both layers of that assertion were wrong.
  
  The runtime half is the one that mattered. `onTaskUpdate` is the single exit for
  every edit path, and the progress grip commits changes with **no** dates at all —
  `commitTaskUpdates([{ task, changes: { progress: cur.value } }])`
  (`src/GanttView.tsx:1335`), forwarded verbatim by `onTaskUpdate(task, changes)`
  (`:1091`). A host that copied the example therefore called
  `save(task.id, { start: undefined, end: undefined })` on every progress drag,
  blanking the record's start and end dates. Drag is documented as opt-in via
  `onTaskUpdate` alone and progress drag needs no extra switch, so the path was
  reachable by default rather than a corner configuration.
  
  The example now guards with `if (!start || !end) return;` and its comment states
  the real shape — that only the keys an edit touched are present, and that the
  progress grip sends just `{ progress }`. Documentation only; no renderer behavior
  changed.
- bb3fab6: Docs only: `packages/plugin-gantt/README.md` no longer teaches two identifiers the
  package does not export, nor a task shape it does not produce (objectui#5012).
  Each README import was judged against the entry module's real export surface
  (35 names, read from the build product's `dist/index.d.ts`), and every corrected
  snippet was type-checked against that same build product:
  
  - **`ganttComponents`** — taught as a components map to iterate over for "manual
    registration" (`Object.entries(ganttComponents).forEach(...)`). It does not
    exist anywhere in the package, so the snippet was `Object.entries(undefined)`:
    a `TypeError` on the first line a reader copied. Registration is *only* the
    side effect of importing the entry point, which runs the two
    `ComponentRegistry.register(...)` calls in `src/index.tsx`. The section is
    replaced by what actually happens: the schema types those calls claim
    (`object-gantt` → `plugin-gantt:object-gantt`, `gantt` → `view:gantt`, both
    with a bare-`type` fallback), the package's real export surface, and — for the
    use case the old snippet was reaching for — registering the exported
    `ObjectGanttRenderer` under a key of your own.
  
  - **`GanttSchema`** — taught as the component schema type in the TypeScript
    section. Pure fiction: zero hits in this package and in `@object-ui/types`
    (a plain grep appears to find it only as a substring of `ObjectGanttSchema`;
    under a word boundary it has no hits at all). The authored type does exist
    under its real name, so the example is rewritten around it rather than
    dropped: `ObjectGanttSchema` from `@object-ui/types`, which is
    **record-driven** — `type: 'object-gantt'` plus an object name and the fields
    to read. It never carried the `tasks` array the old snippet assigned to it.
    No export was added to make the old name true.
  
  - **`GanttTask`** — the one real name of the three, and the reason the section
    still failed to compile. The documented shape had drifted from the exported
    type on three counts: the label field is `title`, not `name`; `start`/`end`
    are `Date` objects, not ISO strings; and `color` is a CSS color, not a
    Tailwind class. Both the "Task Structure" reference block and the typed
    example now match the exported declaration, and the reference block is pinned
    against it in both assignment directions so a future drift fails a check
    instead of compiling as an unrelated local interface.
  
  No code, types or runtime behaviour change — the diff is one README and this
  changeset. The correction reaches npm with the package's next publish, which is
  why it declares a patch: `README.md` is in the package's published `files`.
- 449ffe8: Fix the `GanttViewMode` JSDoc to name all five granularities (objectui#5132).
  
  The comment above `export type GanttViewMode` said "one column per day, week,
  month, or quarter" while the type itself, `VIEW_MODES`, `NOMINAL_DAYS`
  (`year: 365.25`), the column builder, the toolbar and the header-band logic
  have honored a fifth member, `'year'`, all along — `'year'` was fully live,
  just undocumented. Doc-only change, no behavior difference.
- Updated dependencies [88085e3]
- Updated dependencies [69251bf]
- Updated dependencies [57e668f]
- Updated dependencies [516663d]
- Updated dependencies [41ac1b7]
- Updated dependencies [1eaf0a1]
- Updated dependencies [7c297e3]
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
- Updated dependencies [7dd93c0]
- Updated dependencies [229b17e]
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
  - @object-ui/plugin-detail@17.6.0
  - @object-ui/components@17.6.0
  - @object-ui/core@17.6.0

## 17.5.0

### Patch Changes

- ebb4e0e: The date formatter's last three en-US channels now follow the display locale
  (objectui#4272).

  objectui#4468 (PR #4512) pointed every date _renderer_ at `useDisplayLocale()`.
  Three channels were out of its reach because they are properties of the
  formatter's signature and of its callers rather than of any renderer, so a `zh`
  console still met English dates in three places:

  - **`formatDate`'s `'short'` branch** hardcoded
    `toLocaleDateString('en-US', { month: 'short' })`, so it rendered an English
    month even when the caller had threaded `options.locale` into that very call.
    Its only consumers are ObjectGrid's two mobile-card date cells, which threaded
    no locale — fixing either half alone moves nothing, so both land here.
  - **`formatDateTime` took no options parameter at all**, so no caller could
    localize it however hard it tried; it always handed `Intl` an `undefined` tag,
    which means the MACHINE's locale — neither of the repo's two locale channels.
    The parameter is optional and lands together with its consumers, plugin-gantt's
    four tooltip call sites.
  - **The lookup picker's MongoDB `$date` fallback** called a bare
    `toLocaleDateString()` with no tag.

  One resolver everywhere, as before: `useDisplayLocale()` (tenant regional
  default → active UI language → `'en'`). `Intl` accepts `'zh'` verbatim, so there
  is still no mapping table anywhere.

  English output is byte-identical at every touched site — `en` and `en-US` agree
  on all twelve short month names — and the `'short'` layout itself is unchanged:
  only the month token is localized, the compact `"Jan 15, '24"` shape around it
  is a deliberate fixed layout for narrow cards.

  `@object-ui/fields` is `minor` because `formatDateTime`'s new optional parameter
  is visible in the package's entry `.d.ts`; the plugin packages' own `.d.ts` files
  are byte-identical, so their change is module-local.

- 828549a: The gantt's conflict dialog shows the number of affected tasks again, not a literal `{2}`

  `gantt.conflict.body` was resolved at the render site with a literal string replace on **single** braces — `t('gantt.conflict.body').replace('{count}', String(n))` — while all ten locale packs spell the placeholder the i18next way, `{{count}}`. `"…{{count}}…".replace("{count}", "2")` consumes the inner seven characters and leaves the outer pair behind, so every user on every loaded pack read "自动重新排程 **{2}** 个受影响的任务？". The dialog now interpolates through i18next (`t('gantt.conflict.body', { count })`), the idiom `gantt.delete.body` already used.

  The two sibling keys three lines away in the same file, `gantt.autoScheduleDlg.body` and `.skipped`, were **not** broken — pack and call site both used single braces, and they rendered correctly. They are converted anyway, because that split is the whole mechanism: two write-confirmation dialogs in one component carried two different interpolation idioms, so `conflict.body` drifting to the i18next spelling in the packs (which is the correct spelling, and matches every other placeholder in the bundle) silently broke the render. Leaving the auto-schedule keys on the literal-replace idiom leaves the same trap armed for the next translator. All ten packs and the plugin's bundled English fallback table now agree on `{{count}}` for all three; only the braces moved, no translation was reworded.

  `gantt.quickFilter.resultSummary` stays deliberately single-brace — its `ObjectGantt` call site really does resolve `{shown}`/`{total}` with a literal replace, and that convention is pinned by its own parity test. It is now the only key in the gantt namespace on that idiom, and the comments at both spellings say so.

  Nothing caught this, and each gate was silent for its own reason: the cross-pack parity check compares en against each pack, and all eleven spellings agreed; the en-drift check compares a pack against its own history, and the packs were born matching. Both are **relative** comparisons, and the defect lived in the **absolute** relationship between a pack's spelling and the syntax the call site resolves. The existing render test asserted the dialog body contains `'1'` — which `{1}` satisfies. The new pin asserts the absolute form directly, under a real loaded pack, for every way a placeholder can survive to the screen.

- e1ade8f: An illegal gantt dependency link now says why it was refused, instead of doing nothing

  Dragging a dependency onto a target the gantt refuses — itself, a locked row, a group row, or one that would close a dependency cycle — produced no feedback of any kind: no toast, no dialog, no cursor change, no target outline, not even a console warning. The guard was right and completely invisible, so a user drawing a legitimate-looking dependency got a dead interaction and no way to learn the constraint. The rejection was silent in both places it could have shown: a refused bar never became the drop target, so it got no hover treatment at all, and the release handler only ran its body when a target _had_ been registered, so the drop itself was a no-op.

  Both halves are now wired, and both read the **same** verdict. `canReceiveLink`'s four-branch boolean became `classifyLinkTarget`, which returns which branch refused (or `null`), with the boolean derived from it. The hover affordance and the drop toast are two consumers of that one classification, so the reason a user is shown cannot drift from the reason the link was actually refused — there is no second classifier to disagree. The branch names are the leaves of the new `gantt.link.rejected.*` keys, so a branch added later without a message surfaces as a missing key rather than as a plausible-but-wrong sentence.

  During the drag, a refused bar under the pointer gets `cursor: not-allowed` and a destructive outline; on release it raises a toast naming the reason. Four messages, one per branch, in all ten packs. Both the cursor and the outline are driven from inline `style` rather than utility classes, matching the bar's existing read-only cursor three lines away and for the same reason recorded there: `cursor-not-allowed` and the ring alpha utilities are not emitted in the prebuilt components CSS, so a class would look correct in a DOM test and render nothing in a browser.

  Deliberately unchanged: a host veto through `onBeforeDependencyCreate` stays silent. That rejection carries a reason only the host knows, and the gantt has none to show — surfacing it means exposing a rejection-reason output on the public component, which is a separate contract rather than a rider on this one. The four built-in reasons are the gantt's own policy and are the only ones it can explain.

  One of the four, `group`, has no end-to-end path today: a `type: 'group'` row renders no bar, so the drag can never target it. The message is kept anyway — without it the branch would render a raw key on screen if it ever did fire — and the test pins the reachability fact, so it goes red the day group rows gain a bar. Filed as objectui#4209.

- db4ad6b: Gantt tooltip currency re-formats when the tenant currency resolves
  (objectui#4542).

  ObjectGantt's `tasks` memo builds every tooltip string eagerly inside its
  callback, and the `'currency'` case resolves its code down to the tenant
  default (`resolveFieldCurrency(def, tenantCurrency)`). `tenantCurrency` was
  not in the memo's dependency array, so the value was read but never watched.

  That default comes from `GET /api/v1/auth/me/localization`, which is cosmetic
  and non-blocking and therefore answers AFTER first paint. The context change
  re-rendered ObjectGantt, but with none of `data` / `ganttConfig` /
  `objectSchema` / `displayLocale` changed the memo handed back its cached task
  array — so a tooltip amount kept the pre-resolution rendering (a plain
  `1,234.50` instead of `€1,234.50`) until something unrelated invalidated the
  memo.

  This is the currency twin of objectui#4272, which added `displayLocale` to
  this same array for the same reason, and it is not covered by that dep: the
  producer writes currency and locale from one response, so a tenant that
  configures BOTH re-runs the memo through the locale channel — but a tenant
  that configures a currency and no locale (the common shape, since the tenant
  locale is frequently unset) leaves `displayLocale` untouched and the currency
  stale.

  Module-local: the fix is one dependency, the package's `.d.ts` files are
  byte-identical, and rendering is unchanged whenever the channel resolves
  before first paint or a field carries its own currency code.

- a908882: Gantt tooltip numbers and currency follow the display locale (objectui#4553).

  `formatFieldValue`, the tooltip value formatter inside ObjectGantt's `tasks`
  memo, had its four TEMPORAL call sites threaded with `useDisplayLocale()` by
  objectui#4272. The numeric cases beside them passed no locale, so they reached
  `new Intl.NumberFormat(undefined, …)` — the MACHINE's locale, which is neither
  of the repo's two locale channels.

  One tooltip therefore rendered two conventions. A German session read
  `5. Jan. 2024` on the date row and `1,234.50` on the amount row directly below
  it, where German groups with `.` and marks the decimal with `,`. Inverted
  separators do not read as an unstyled number; they read as a different number.
  The currency row was affected in the symbol's POSITION too — `1.234,50 EUR`
  rather than `EUR1,234.50` — while the currency CODE itself was already resolved
  correctly (objectui#4542 made the memo watch it); only the locale rendering that
  code was missing.

  `number` / `integer` / `float` / `decimal` and `currency` now pass the
  `displayLocale` already read at component level, using each formatter's existing
  locale parameter. No formatter signature changed and no memo dependency changed
  (`displayLocale` has been in that array since objectui#4272), so this is
  consumer-side threading only: the package's `.d.ts` files are byte-identical and
  English output is unchanged at every touched site.

  Known gap, tracked on objectui#4553: the `percent` row still does not follow the
  display locale. `formatPercent(value, precision)` takes no locale parameter —
  it is `${percentDisplayValue(value).toFixed(precision)}%`, so it builds no
  `Intl.NumberFormat` at all and renders in NO locale rather than the machine's
  (ASCII decimal mark, never grouped, identical on every machine). Closing that
  needs a `@object-ui/fields` signature change, which is outside this change's
  ruled surface, and is pinned by a test here so the gap cannot drift unnoticed.

- 0ca6096: A gantt task titled `A$&B` no longer prints `{{title}}` back into its own delete dialog — the two hand-rolled provider-less fallback interpolators are literal, like i18next

  objectui#3418 fixed the shared helper's fallback interpolator: `String.prototype.replace` became `split(needle).join(value)`, because `replace` and `replaceAll` both interpret `$&`, `` $` ``, `$'` and `$$` in the **replacement** string and i18next does not. Two hand-rolled copies of that interpolator never got the fix. Both are deliberate non-users of `createSafeTranslation` — each falls back per key so a host dictionary that covers the common keys but lags on newer ones still resolves what it has — so the shared fix had no path to reach them.

  The reachable one is gantt's. `gantt.delete.body` is `'"{{title}}" will be permanently removed. …'` and its call site interpolates the record's own title, which is user data:

  | task title | rendered before                                                       | rendered now                              |
  | ---------- | --------------------------------------------------------------------- | ----------------------------------------- |
  | `A$&B`     | `"A{{title}}B" will be permanently removed.`                          | `"A$&B" will be permanently removed.`     |
  | `` x$`y `` | `"x"y" will be permanently removed.`                                  | `` "x$`y" will be permanently removed. `` |
  | `p$$q`     | `"p$q" will be permanently removed.`                                  | `"p$$q" will be permanently removed.`     |
  | `u$'v`     | `"u" will be permanently removed. …v" will be permanently removed. …` | `"u$'v" will be permanently removed.`     |

  The first row is the ugly one: `$&` expands to the matched text, so the placeholder itself is printed back to the user inside the record's own name. Gantt's copy also carried the other half of the same defect — a bare string needle substitutes only the **first** occurrence, where i18next substitutes every one — and `split`/`join` fixes both at once.

  The import wizard's copy used a `g`-flagged `RegExp`, which covered the repeated-placeholder half but could not touch the `$`-pattern half: that harm lives in the replacement string, not the needle. Its values are authored metadata — field labels and type names spliced into `grid.import.missingRequiredHint` and `grid.import.legacyReferenceBlocked` — so a label containing `$&` corrupted the hint the same way. Retiring the `RegExp` also retires an unescaped needle, since the placeholder name went into the pattern uninterpolated; that was inert while every placeholder name is a bare identifier, and is now structurally impossible.

  This is the provider-less path only (standalone embedding, unit tests). With an `I18nProvider` mounted, i18next serves these keys and was already literal on both sides — which is exactly why the divergence was invisible. No pack, key or call site changed; the three `{{count}}` gantt keys take numbers and were never affected, and `gantt.quickFilter.resultSummary`'s deliberate single-brace idiom is resolved by its call site rather than this interpolator and is untouched.

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
- Updated dependencies [6d01319]
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
- Updated dependencies [63fe8fd]
- Updated dependencies [3e19fe7]
- Updated dependencies [bb58d1d]
- Updated dependencies [433ff9f]
- Updated dependencies [5cc847c]
- Updated dependencies [6314e87]
- Updated dependencies [5e2e9fa]
- Updated dependencies [297534b]
- Updated dependencies [e7663f2]
- Updated dependencies [fa21254]
- Updated dependencies [33c32bf]
- Updated dependencies [66fb4fa]
- Updated dependencies [b953a97]
- Updated dependencies [e076fd5]
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
- Updated dependencies [456aac8]
- Updated dependencies [405e808]
- Updated dependencies [49ae9f4]
- Updated dependencies [a3ae404]
- Updated dependencies [7d04b0e]
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
- Updated dependencies [dad805d]
- Updated dependencies [7f1cb33]
- Updated dependencies [f148a64]
- Updated dependencies [bb68488]
- Updated dependencies [2e3b0c0]
- Updated dependencies [35997ce]
- Updated dependencies [9461dd3]
- Updated dependencies [78fa331]
- Updated dependencies [47f551b]
- Updated dependencies [31ab1ac]
- Updated dependencies [0082db8]
- Updated dependencies [ab04728]
- Updated dependencies [b388950]
- Updated dependencies [5bf09fd]
- Updated dependencies [06915b0]
- Updated dependencies [ff84b05]
  - @object-ui/i18n@17.5.0
  - @object-ui/react@17.5.0
  - @object-ui/components@17.5.0
  - @object-ui/plugin-detail@17.5.0
  - @object-ui/core@17.5.0
  - @object-ui/fields@17.5.0
  - @object-ui/types@17.5.0

## 17.4.0

### Patch Changes

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

- 6d762da: The five locale keys behind #3546's eight no-fallback `t()` call sites are now defined in all ten packs, so the built-in-view toasts, the activity-timeline source link, the wizard's required-field toast and the Gantt refresh button's accessible name are translated instead of falling back to English — or, on two surfaces, to the key itself (part of #3546).

  `scripts/check-i18n-call-site-keys.mjs` measured 258 keys that a `t()` call site asks for and no pack defines. These five were the subset with no working inline default: `console.objectView.cannotEditMetaView`, `console.objectView.cannotDeleteMetaView`, `detail.viewSource`, `gantt.toolbar.refresh` and `wizard.missingRequired`. Adding a `defaultValue` is deliberately not the fix — that mechanism is what kept all 258 invisible for months.

  **Two of the eight sites really did render the raw key**, and both go through a binding with nothing in front of i18next. `ObjectView.tsx` calls `useObjectTranslation()` directly, so five toasts read `console.objectView.cannotEditMetaView` / `cannotDeleteMetaView` on screen; the `|| 'Built-in views cannot be renamed.'` guards next to them were dead on every path, because i18next answers a miss with the key itself and a non-empty string never falls through `||`. Those four unreachable English strings are removed rather than repaired: one key served four call sites (rename / pin / set-as-default / configure), so the pack copy covers any change to a built-in view instead of naming one operation. `RecordActivityTimeline.tsx` fails the same way for a subtler reason — `useDetailTranslation` is `createSafeTranslation(..., 'detail.back')`, and because `detail.back` does resolve, the probe hands back i18next's `t` for every key and bypasses the defaults map wholesale, so `detail.viewSource` reached the user verbatim.

  **The other two sites were not rendering a raw key**, contrary to the issue's description, and are fixed here as the milder "English in all ten languages" class. `wizard.missingRequired` is its own hook's probe key, so the probe failed and `createSafeTranslation` correctly served its English default. `gantt.toolbar.refresh` goes through `useGanttTranslation`, which deliberately does not use `createSafeTranslation` and falls back per key — so the refresh button's `aria-label` was "Refresh", in English, never the key. Screen-reader users heard an English word rather than an identifier; a `zh` session now hears 刷新.

  Regression cover is provider-mounted on purpose: with no `I18nProvider` the defaults maps answer every one of these keys and the assertions pass while the console is broken, which is precisely the false-green the issue documents. For the two sites whose English output was already correct, `en` cannot discriminate before from after — the `zh` assertions are the ones that pin the fix.

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
- Updated dependencies [7b3e048]
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
- Updated dependencies [4178d5a]
- Updated dependencies [54233b1]
- Updated dependencies [c2ecbae]
- Updated dependencies [acc34c5]
- Updated dependencies [c4768a7]
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
  - @object-ui/plugin-detail@17.4.0
  - @object-ui/react@17.4.0
  - @object-ui/core@17.4.0
  - @object-ui/fields@17.4.0
  - @object-ui/i18n@17.4.0
  - @object-ui/types@17.4.0

## 17.3.0

### Patch Changes

- 5c856ec: `ObjectGantt`'s quick-filter bar is now localized instead of pinned to Chinese. The four `QuickFilterBar` labels (`all`, `clear`, `empty`, `resultSummary`) were hardcoded as Chinese string literals at the `ObjectGantt` call site, so the bar read 全部 / 清除筛选 / 无可选项 / 显示 N / M 项任务 under an `en`, `ja`, `es` or `ar` session while the rest of the gantt toolbar localized correctly — a conspicuous mismatch, and a violation of the English-only-codebase rule. `QuickFilterBar` itself was never at fault: it is presentational and already falls back to English, so the host was the only thing pinning the copy.

  The four strings moved into a new `gantt.quickFilter` namespace, added to all ten built-in locale packs, and the call site now resolves them through the gantt package's existing `useGanttTranslation` — the same per-key hook every other gantt string already uses, so a host dictionary that lags on these keys still renders the bundled English default rather than a raw key. `gantt.quickFilter.resultSummary` deliberately keeps SINGLE-brace placeholders (`{shown}` / `{total}`): the call site substitutes them with a literal `.replace`, not i18next interpolation, matching `gantt.autoScheduleDlg.body` and the placeholder convention `all-locales-key-parity` already recognises. Anyone retranslating these packs must keep that spelling — a respell to `{{shown}}` would render the raw placeholder to the user.

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
- Updated dependencies [bbbde12]
- Updated dependencies [5a24ad9]
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
- Updated dependencies [58a00f0]
- Updated dependencies [53811d1]
- Updated dependencies [b17ce4c]
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
- Updated dependencies [c7fba27]
- Updated dependencies [a415684]
- Updated dependencies [a4cff5b]
- Updated dependencies [175bd79]
- Updated dependencies [5af2852]
- Updated dependencies [12bf669]
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
  - @object-ui/plugin-detail@17.3.0
  - @object-ui/types@17.3.0
  - @object-ui/i18n@17.3.0
  - @object-ui/react@17.3.0

## 17.2.0

### Patch Changes

- Updated dependencies [4ae0ac4]
- Updated dependencies [696e3c1]
- Updated dependencies [bca45cc]
- Updated dependencies [6be575c]
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
- Updated dependencies [dd06bcd]
- Updated dependencies [a8ad6c0]
- Updated dependencies [444457c]
- Updated dependencies [850033c]
- Updated dependencies [022e4c3]
- Updated dependencies [009e25d]
- Updated dependencies [726b89c]
  - @object-ui/types@17.2.0
  - @object-ui/components@17.2.0
  - @object-ui/core@17.2.0
  - @object-ui/plugin-detail@17.2.0
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
- Updated dependencies [2baa13f]
- Updated dependencies [bac266c]
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
  - @object-ui/plugin-detail@17.1.0
  - @object-ui/react@17.1.0
  - @object-ui/types@17.1.0
  - @object-ui/i18n@17.1.0
  - @object-ui/fields@17.1.0

## 17.0.0

### Patch Changes

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
  - @object-ui/plugin-detail@17.0.0
  - @object-ui/i18n@17.0.0
  - @object-ui/fields@17.0.0
  - @object-ui/react@17.0.0
  - @object-ui/types@17.0.0
  - @object-ui/core@17.0.0

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

- 5606ca8: fix(plugin-gantt): align the task-list header with the row date columns

  Every data row reserves a trailing w-6 (+4px) slot for the 「→」 open-details
  button whenever `onTaskClick` is live, but the header row didn't — so the
  开始/结束 header labels sat 28px to the right of the date values they caption.
  The header now mirrors the slot under the same condition.

- 1100a8b: feat(plugin-gantt)!: remove the 移动端二维码 (mobile QR share) context-menu item

  The QR-share feature is removed outright: the context-menu item, the QR dialog,
  the `taskUrl` prop on `GanttView`, the URL wiring in `ObjectGantt`, the
  `gantt.menu.qrcode` / `gantt.qr.*` i18n keys (en/zh) and the `qrcode`
  dependency are all deleted. It baked one consumer's app-specific requirement
  (scan-to-open on mobile) into the generic gantt renderer, and what it encoded —
  the desktop console record URL — was not even the right target for that
  requirement. Apps that need scan-to-mobile flows should implement them
  app-side against their own mobile surface.

- 7a5750e: chore(lint): clear the baseline lint errors in plugin-gantt (objectui#2713 Wave 3)

  Wave 3 of the #2713 lint-gate restoration. `@object-ui/plugin-gantt` was red at
  baseline on `main`; cleared every **error** (no behavior change; warnings out of
  scope). 18 of the 21 were in the demo harness:

  - **`react-hooks/static-components` (demo, ×8)** — the `Swatch` legend cell was
    defined inside `ManufacturingLegend`; hoisted to module scope (purely
    props-driven, so nothing from render scope is captured).
  - **`react-hooks/rules-of-hooks` (demo, ×9)** — `App` had a `?quickfilter=1`
    early return before ~9 hooks; moved that route below all hooks so hook order
    is stable (the quick-filter branch renders `<QuickFilterDemo />` regardless).
  - **`react-hooks/purity` (demo, ×1)** — the demo render-timer necessarily reads
    `performance.now()` during render (paired with an effect that measures elapsed
    ms); justified scoped disable, demo-only.
  - **`object-ui/no-synthetic-event-trigger`** (`GanttView.interactions.test`) —
    the Escape-closes-menu test dispatched a raw `window` `KeyboardEvent`; switched
    to `fireEvent.keyDown(window, { key: 'Escape' })` (the pattern already used
    elsewhere in the same file). The window-level Escape listener behaves
    identically.
  - **`no-useless-assignment`** (`GanttView`, `ObjectGantt`) — dropped two dead
    initializers (`ok`, `options`) that their exhaustive `try`/`catch` and
    `if`/`else` branches overwrite before reading.

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
- Updated dependencies [53513a4]
- Updated dependencies [1100a8b]
- Updated dependencies [7abe4cd]
- Updated dependencies [69fa5d1]
- Updated dependencies [f329ec5]
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
  - @object-ui/plugin-detail@16.1.0
  - @object-ui/components@16.1.0

## 16.0.0

### Patch Changes

- Updated dependencies [d3e19ed]
- Updated dependencies [59d4fa9]
- Updated dependencies [4c7c47f]
- Updated dependencies [210806a]
- Updated dependencies [9d4a429]
- Updated dependencies [b4ef588]
- Updated dependencies [ca0f5f0]
- Updated dependencies [5534535]
- Updated dependencies [9b8f978]
- Updated dependencies [195a651]
- Updated dependencies [33b4995]
  - @object-ui/react@16.0.0
  - @object-ui/plugin-detail@16.0.0
  - @object-ui/components@16.0.0
  - @object-ui/types@16.0.0
  - @object-ui/i18n@16.0.0
  - @object-ui/fields@16.0.0
  - @object-ui/core@16.0.0

## 15.0.0

### Patch Changes

- Updated dependencies [bb22788]
  - @object-ui/plugin-detail@15.0.0
  - @object-ui/types@15.0.0
  - @object-ui/core@15.0.0
  - @object-ui/i18n@15.0.0
  - @object-ui/react@15.0.0
  - @object-ui/components@15.0.0
  - @object-ui/fields@15.0.0

## 14.1.0

### Patch Changes

- Updated dependencies [82441e4]
- Updated dependencies [2efa9fd]
- Updated dependencies [0890fa7]
- Updated dependencies [2ded18c]
- Updated dependencies [e628d1f]
- Updated dependencies [5523fc4]
- Updated dependencies [887062c]
- Updated dependencies [471c5d3]
- Updated dependencies [579b24d]
- Updated dependencies [2b30583]
- Updated dependencies [23d65c3]
- Updated dependencies [055e1d2]
- Updated dependencies [f9a7907]
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
  - @object-ui/plugin-detail@14.1.0
  - @object-ui/fields@14.1.0
  - @object-ui/core@14.1.0
  - @object-ui/types@14.1.0
  - @object-ui/react@14.1.0
  - @object-ui/components@14.1.0

## 14.0.0

### Patch Changes

- a506e6d: ObjectGantt now supports the `api` data source for **both read and write-back**.
  Previously `provider: 'api'` logged "API provider not yet implemented" and rendered
  nothing, and every write-back (reschedule, dependency edit, delete, drawer
  inline-edit) was hard-wired to the context ObjectQL `dataSource` + `objectName`,
  so the api provider's `write` config was never used.

  All reads and writes now flow through a single adapter resolved by
  `resolveDataSource(schema.data, dataSource)`: `object` → context DataSource
  (unchanged), `api` → `ApiDataSource` (executes the `read`/`write` HttpRequest
  config), `value` → in-memory `ValueDataSource`. A pure-api view needs no
  `objectName` and no context `dataSource` prop. Object-backed views are behavior-
  preserving. Lookup/master_detail quick-filter option domains still resolve from
  the context object backend (they degrade to distinct in-row values when absent).

- 42b36c4: 新增逐任务预警描边(#2436 第 3 项):视图配置 `borderColorField` 指向
  记录上的预警颜色字段(常为服务端计算的超期/临期字段),该行条形在保留
  原有填充色的同时,以该颜色描边并加 2px 光晕——任务条、里程碑菱形、
  汇总条均生效。语义色名(red/orange/…)映射为调色板 hex,其余 CSS 颜色
  原样透传;空值不描边。开启关键路径高亮时,关键路径样式在其标记行上优先。
- 8a7d5af: 拖拽连线增加内建校验与宿主否决钩子(#2436 第 1、2 项)。落点为锁定行
  (`locked`)或分组行(`type: 'group'`)时,悬停不再高亮、松手不再创建;
  成环依赖(直接回边、跨层级传递回边)基于**全量任务集**检测并拒绝——不受
  折叠子树导致可见连线缺边的影响。新增 `onBeforeDependencyCreate(source,
target, type)` 钩子,在内建校验通过后调用,返回 `false` 可否决本次连线
  (即 DHTMLX `onBeforeLinkAdd` / Syncfusion `actionBegin` 惯例)。
  `wouldCreateDependencyCycle` 从 `scheduling` 导出并单测覆盖。
- eef832b: 修复记录抽屉绕过甘特图行级锁定的问题(#2436 第 5 项)。

  - `RecordDetailDrawer` 的编辑/删除能力现在由调用方是否传入 `onFieldSave` / `onDelete` 决定:两者都省略时抽屉严格只读(无内联编辑、无删除入口)。此前抽屉硬编码 `inlineEdit` 与 `showDelete: true`,并无条件向内层 DetailView 传包装函数,导致锁定记录仍可"编辑"(且改动静默丢失)。
  - `ObjectGantt` 对 `lockField` 锁定的行、以及全局 `readOnly` 的甘特图,不再向抽屉传入 `onFieldSave` / `onDelete`,与时间轴上禁止拖拽/调整的行为保持一致。

- 0b03b34: 快速筛选改为树感知(#2436 第 4 项):命中任务的**全部祖先链**一并保留。
  此前 `displayTasks` 是平铺过滤,项目/产品等分组行本身没有可筛字段值,
  一筛就被丢掉,命中的子任务成孤儿、树结构被打散。现在祖先随命中下级
  自动保留、无命中下级时照常剔除,多分支命中共享祖先不重复。
- 07b2cda: 甘特图写后回读 + 工具栏手动刷新按钮(#2436 第 6/7 项)。

  - 拖拽改期、依赖增删、抽屉内联编辑、删除记录成功后,静默重新读取数据源,让服务端重算的字段(父级汇总、预警颜色、工期重算)刷新到图上;此前乐观补丁只保留客户端写入的字段,派生字段一直陈旧直到整页刷新。静默刷新不闪 loading、不卸载 GanttView(保留滚动/折叠状态),并发请求按序号防乱序覆盖;失败时保留屏上最后一份好数据。
  - GanttView 工具栏新增手动刷新按钮(`onRefresh` / `refreshing` props),object 数据源自动接线;内联 value 数据无可回读来源,不显示按钮。

- Updated dependencies [443360a]
- Updated dependencies [c70bca7]
- Updated dependencies [86c69c3]
- Updated dependencies [05e56ca]
- Updated dependencies [a44e7b6]
- Updated dependencies [eef832b]
- Updated dependencies [5971cc4]
- Updated dependencies [6a74160]
  - @object-ui/core@14.0.0
  - @object-ui/i18n@14.0.0
  - @object-ui/react@14.0.0
  - @object-ui/types@14.0.0
  - @object-ui/components@14.0.0
  - @object-ui/plugin-detail@14.0.0
  - @object-ui/fields@14.0.0

## 13.2.0

### Patch Changes

- Updated dependencies [80901aa]
- Updated dependencies [53c40c2]
- Updated dependencies [e492b9d]
  - @object-ui/components@13.2.0
  - @object-ui/plugin-detail@13.2.0
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
- @object-ui/plugin-detail@13.1.0

## 13.0.0

### Patch Changes

- Updated dependencies [9e38270]
- Updated dependencies [ac04b76]
- Updated dependencies [619097e]
  - @object-ui/i18n@13.0.0
  - @object-ui/components@13.0.0
  - @object-ui/types@13.0.0
  - @object-ui/fields@13.0.0
  - @object-ui/plugin-detail@13.0.0
  - @object-ui/react@13.0.0
  - @object-ui/core@13.0.0

## 12.1.0

### Patch Changes

- Updated dependencies [47e72b8]
- Updated dependencies [6cbccf3]
- Updated dependencies [e1840bf]
- Updated dependencies [c31874d]
  - @object-ui/plugin-detail@12.1.0
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
  - @object-ui/plugin-detail@12.0.0
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
  - @object-ui/plugin-detail@11.5.0
  - @object-ui/components@11.5.0
  - @object-ui/types@11.5.0
  - @object-ui/fields@11.5.0
  - @object-ui/core@11.5.0

## 11.4.0

### Patch Changes

- Updated dependencies [8bf6295]
- Updated dependencies [144ab55]
- Updated dependencies [1948c5b]
- Updated dependencies [bce581a]
- Updated dependencies [2edcaff]
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
  - @object-ui/plugin-detail@11.4.0
  - @object-ui/components@11.4.0
  - @object-ui/fields@11.4.0
  - @object-ui/i18n@11.4.0
  - @object-ui/core@11.4.0
  - @object-ui/react@11.4.0

## 11.3.0

### Patch Changes

- Updated dependencies [d88c8ec]
- Updated dependencies [b7237bb]
- Updated dependencies [db5ebe4]
- Updated dependencies [d23d6eb]
  - @object-ui/components@11.3.0
  - @object-ui/i18n@11.3.0
  - @object-ui/plugin-detail@11.3.0
  - @object-ui/core@11.3.0
  - @object-ui/fields@11.3.0
  - @object-ui/react@11.3.0
  - @object-ui/types@11.3.0

## 11.2.0

### Patch Changes

- Updated dependencies [32dbd6a]
- Updated dependencies [9e7a986]
- Updated dependencies [1311749]
  - @object-ui/plugin-detail@11.2.0
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
  - @object-ui/plugin-detail@11.1.0
  - @object-ui/react@11.1.0
  - @object-ui/types@11.1.0
  - @object-ui/core@11.1.0

## 7.3.0

### Patch Changes

- Updated dependencies [788dbf9]
  - @object-ui/fields@7.3.0
  - @object-ui/plugin-detail@7.3.0
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
  - @object-ui/plugin-detail@7.2.0
  - @object-ui/components@7.2.0
  - @object-ui/fields@7.2.0
  - @object-ui/react@7.2.0
  - @object-ui/core@7.2.0

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
  - @object-ui/plugin-detail@7.1.0
  - @object-ui/i18n@7.1.0

## 7.0.0

### Minor Changes

- 995c85d: Gantt feature parity, Phases 1–5: dependency links, real time scales, hierarchy, interaction polish, and virtualization.

  - **Dependency links** — `task.dependencies` renders as orthogonal arrows in an SVG overlay, with all four MS-Project link types (`fs`/`ss`/`ff`/`sf`) via the object form `{ id, type }`. Arrows follow bars live during drag/resize; hovering a bar highlights its links. `normalizeDependencies` (exported) accepts CSV strings, id arrays, and object arrays with id/type aliases. New dependencies can be created by dragging from a bar's link dot onto another bar (`onDependencyCreate`).
  - **Real time scales** — day/week/month/quarter modes with a two-row header (group row + unit row), weekend tinting, zoom in/out, and a jump-to-today button.
  - **Hierarchy** — `parent` builds a tree: collapsible summary rows with bracket-style summary bars aggregated from descendants, milestone diamonds, indent guides, and `aria-expanded`/`role="treeitem"` semantics. Dragging a summary bar moves its whole subtree by the same offset (live preview + one `onTaskUpdate` per task); the summary's displayed range rolls up from children, so moving a child past the parent's edge stretches the parent automatically.
  - **Interaction polish** — progress drag handle, hover tooltip, context menu (including delete), keyboard navigation/editing, inline title editing, and row drag-reorder (`onTaskReorder`).
  - **Scale** — virtualized rows _and_ columns (spacer-based windowing; only the visible window is in the DOM, verified: 5,000 tasks render in ~27 ms with 26 rows in the DOM), a fullscreen toggle, and custom timeline `markers` (`{ date, label?, color? }`).

  Colors that the prebuilt components stylesheet doesn't emit utilities for use theme CSS variables inline, so everything renders correctly in consuming apps.

- 053c948: feat(gantt): year scale, navigation, saved layout, and PDF export (follow-up to #1672)

  - **Year scale** — new `year` granularity (one column per year, with a "20XXs"
    decade group band above); ResourceWorkload follows the same column width/label.
  - **Navigation** — toolbar gains _This week_ / _This month_ jump buttons (beside
    the existing _Today_), scrolling the timeline to the current week/month start.
  - **Saved layout** — `persistLayoutKey` / `onLayoutChange` plus a "Save layout"
    button snapshot the current granularity + zoom + collapsed task columns to
    `localStorage` (`gantt-layout:<object>:<view>`) and restore on next load (an
    explicit `viewMode` prop still wins). `ObjectGantt` derives the key from the
    data object by default; `persistLayout: false` opts out.
  - **PDF export** — rasterizes the whole chart SVG to JPEG embedded in a
    zero-dependency single-page PDF (DCTDecode), alongside PNG export
    (`buildExportSvg` shared by both).

- 053c948: feat(gantt): configurable hover tooltip + live parent-stretch (follow-up to #1672)

  - **Configurable tooltip** — a view declares `tooltipFields` on its gantt config
    (field names, or `{ field, label }` to override the label); `ObjectGantt`
    resolves each against the record (select options → label, lookups → embedded
    record name, dates/numbers/currency/percent through the shared `@object-ui/
fields` formatters) and feeds `GanttView` a `task.fields` array that replaces
    the default hover detail.
  - **Live parent-stretch** — a summary bar's displayed range rolls up from its
    children live, so dragging a child past the parent's edge stretches the parent.
  - Also replaces six prebuilt-CSS utilities the components stylesheet never emits
    (connector dot `-right-2` was occluding the progress label, resize-handle
    width, progress-fill radius, grid z-index, `sm:` variants) with inline styles
    / a scoped media query so the chart renders correctly in consuming apps.

### Patch Changes

- 0ad72a6: fix: pass full gantt config to renderer, render multi-value lookups in gantt tooltips, persist `bodyExtra` on dataSource actions, and complete zh/en gantt labels

  Four platform gaps that the EHR app previously worked around with `node_modules` patches:

  - **app-shell / ObjectView** — the `config.gantt → renderer props` adapter was a hardcoded 6-field whitelist, so `parentField`/`typeField` (and `baseline*`, `groupByField`, `resourceView`, `tooltipFields`, `quickFilters`, …) never reached the renderer and the chart degraded to a flat list. It now spreads the full `viewDef.gantt` first, then applies the three required defaults last (mirroring the gallery branch).
  - **plugin-gantt / ObjectGantt** — the tooltip value formatter only handled single-object lookups, so a multi-value lookup (a populated `[{name},{name}]` array) fell through to `'—'`. It now maps each array element to its display value and joins them.
  - **app-shell / useConsoleActionRuntime** — `bodyExtra` was merged only on the absolute-HTTP path; the generic `dataSource.update` path ignored it, so a pure-confirmation action (no params array) left an empty payload and persisted nothing. `bodyExtra` is now merged last on that path too, matching the documented semantics.
  - **i18n** — added the gantt labels the 9.x renderer references but the bundles lacked: `toolbar.thisWeek/thisMonth/exportPdf/saveLayout`, `viewMode.year`, `menu.add*/removeDependency/noCandidates`, the `linkType.*` and `conflict.*` blocks, and `readOnly*` — in both `en` (canonical key source) and `zh`.

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
- Updated dependencies [3cc38fe]
- Updated dependencies [bd8b054]
- Updated dependencies [4eb9cb6]
- Updated dependencies [7c239fd]
- Updated dependencies [858ad94]
- Updated dependencies [2270239]
- Updated dependencies [db8cd00]
- Updated dependencies [650bd1f]
- Updated dependencies [2f31406]
- Updated dependencies [18728c1]
- Updated dependencies [8d1195d]
  - @object-ui/core@7.0.0
  - @object-ui/components@7.0.0
  - @object-ui/plugin-detail@7.0.0
  - @object-ui/react@7.0.0
  - @object-ui/i18n@7.0.0
  - @object-ui/types@7.0.0
  - @object-ui/fields@7.0.0

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3
- @object-ui/core@6.2.3
- @object-ui/react@6.2.3
- @object-ui/components@6.2.3
- @object-ui/fields@6.2.3
- @object-ui/plugin-detail@6.2.3

## 6.2.2

### Patch Changes

- Updated dependencies [a66f788]
  - @object-ui/react@6.2.2
  - @object-ui/components@6.2.2
  - @object-ui/fields@6.2.2
  - @object-ui/plugin-detail@6.2.2
  - @object-ui/types@6.2.2
  - @object-ui/core@6.2.2

## 6.2.1

### Patch Changes

- @object-ui/types@6.2.1
- @object-ui/core@6.2.1
- @object-ui/react@6.2.1
- @object-ui/components@6.2.1
- @object-ui/fields@6.2.1
- @object-ui/plugin-detail@6.2.1

## 6.2.0

### Patch Changes

- @object-ui/react@6.2.0
- @object-ui/components@6.2.0
- @object-ui/fields@6.2.0
- @object-ui/plugin-detail@6.2.0
- @object-ui/types@6.2.0
- @object-ui/core@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/core@6.1.0
  - @object-ui/types@6.1.0
  - @object-ui/components@6.1.0
  - @object-ui/fields@6.1.0
  - @object-ui/plugin-detail@6.1.0
  - @object-ui/react@6.1.0

## 6.0.4

### Patch Changes

- @object-ui/types@6.0.4
- @object-ui/core@6.0.4
- @object-ui/react@6.0.4
- @object-ui/components@6.0.4
- @object-ui/fields@6.0.4
- @object-ui/plugin-detail@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3
- @object-ui/core@6.0.3
- @object-ui/react@6.0.3
- @object-ui/components@6.0.3
- @object-ui/fields@6.0.3
- @object-ui/plugin-detail@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2
- @object-ui/core@6.0.2
- @object-ui/react@6.0.2
- @object-ui/components@6.0.2
- @object-ui/fields@6.0.2
- @object-ui/plugin-detail@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1
- @object-ui/core@6.0.1
- @object-ui/react@6.0.1
- @object-ui/components@6.0.1
- @object-ui/fields@6.0.1
- @object-ui/plugin-detail@6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0
- @object-ui/core@6.0.0
- @object-ui/react@6.0.0
- @object-ui/components@6.0.0
- @object-ui/fields@6.0.0
- @object-ui/plugin-detail@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2
- @object-ui/core@5.4.2
- @object-ui/react@5.4.2
- @object-ui/components@5.4.2
- @object-ui/fields@5.4.2
- @object-ui/plugin-detail@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1
- @object-ui/core@5.4.1
- @object-ui/react@5.4.1
- @object-ui/components@5.4.1
- @object-ui/fields@5.4.1
- @object-ui/plugin-detail@5.4.1

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0
  - @object-ui/components@5.4.0
  - @object-ui/core@5.4.0
  - @object-ui/fields@5.4.0
  - @object-ui/plugin-detail@5.4.0
  - @object-ui/react@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2
- @object-ui/core@5.3.2
- @object-ui/react@5.3.2
- @object-ui/components@5.3.2
- @object-ui/fields@5.3.2
- @object-ui/plugin-detail@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1
- @object-ui/core@5.3.1
- @object-ui/react@5.3.1
- @object-ui/components@5.3.1
- @object-ui/fields@5.3.1
- @object-ui/plugin-detail@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0
- @object-ui/core@5.3.0
- @object-ui/react@5.3.0
- @object-ui/components@5.3.0
- @object-ui/fields@5.3.0
- @object-ui/plugin-detail@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1
- @object-ui/core@5.2.1
- @object-ui/react@5.2.1
- @object-ui/components@5.2.1
- @object-ui/fields@5.2.1
- @object-ui/plugin-detail@5.2.1

## 5.2.0

### Patch Changes

- Updated dependencies [de0c5e6]
- Updated dependencies [9997cae]
- Updated dependencies [b2d1704]
- Updated dependencies [a3cb88f]
- Updated dependencies [5425608]
- Updated dependencies [6c3f018]
- Updated dependencies [d912a60]
- Updated dependencies [5633edd]
- Updated dependencies [87bc8ff]
- Updated dependencies [3ebba63]
- Updated dependencies [7c441f5]
- Updated dependencies [e919433]
- Updated dependencies [a8d12ec]
- Updated dependencies [70b5570]
- Updated dependencies [aa063db]
- Updated dependencies [d9c3bae]
- Updated dependencies [3216f8a]
- Updated dependencies [d1442e3]
- Updated dependencies [7c7400a]
  - @object-ui/types@5.2.0
  - @object-ui/core@5.2.0
  - @object-ui/react@5.2.0
  - @object-ui/plugin-detail@5.2.0
  - @object-ui/fields@5.2.0
  - @object-ui/components@5.2.0

## 5.1.1

### Patch Changes

- Updated dependencies [8955b9c]
  - @object-ui/components@5.1.1
  - @object-ui/fields@5.1.1
  - @object-ui/plugin-detail@5.1.1
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
- Updated dependencies [32306e8]
- Updated dependencies [5b80cfd]
- Updated dependencies [49b1760]
- Updated dependencies [a49f300]
- Updated dependencies [8fd863e]
- Updated dependencies [1cb6e21]
- Updated dependencies [d548d6b]
  - @object-ui/components@5.1.0
  - @object-ui/plugin-detail@5.1.0
  - @object-ui/react@5.1.0
  - @object-ui/types@5.1.0
  - @object-ui/core@5.1.0
  - @object-ui/fields@5.1.0

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
  - @object-ui/plugin-detail@5.0.2
  - @object-ui/types@5.0.2
  - @object-ui/core@5.0.2

## 5.0.1

### Patch Changes

- @object-ui/types@5.0.1
- @object-ui/core@5.0.1
- @object-ui/react@5.0.1
- @object-ui/components@5.0.1
- @object-ui/fields@5.0.1
- @object-ui/plugin-detail@5.0.1

## 5.0.0

### Patch Changes

- Updated dependencies [542cca9]
- Updated dependencies [8930b15]
- Updated dependencies [95b6b21]
- Updated dependencies [ddb08a7]
- Updated dependencies [f16a762]
- Updated dependencies [765d50f]
- Updated dependencies [927187a]
- Updated dependencies [bae8ba8]
- Updated dependencies [8435860]
- Updated dependencies [bece8ca]
- Updated dependencies [bb2ea48]
- Updated dependencies [77c1877]
- Updated dependencies [b14fe09]
- Updated dependencies [1911d34]
- Updated dependencies [ba98039]
- Updated dependencies [a7bef6e]
- Updated dependencies [86c04f1]
- Updated dependencies [74962b0]
- Updated dependencies [8b850b5]
- Updated dependencies [3154334]
- Updated dependencies [fa4c2cb]
- Updated dependencies [7213027]
- Updated dependencies [34b66bf]
  - @object-ui/plugin-detail@5.0.0
  - @object-ui/components@5.0.0
  - @object-ui/react@5.0.0
  - @object-ui/types@5.0.0
  - @object-ui/fields@5.0.0
  - @object-ui/core@5.0.0

## 4.8.0

### Patch Changes

- Updated dependencies [06a4066]
  - @object-ui/plugin-detail@4.8.0
  - @object-ui/types@4.8.0
  - @object-ui/core@4.8.0
  - @object-ui/react@4.8.0
  - @object-ui/components@4.8.0
  - @object-ui/fields@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0
- @object-ui/core@4.7.0
- @object-ui/react@4.7.0
- @object-ui/components@4.7.0
- @object-ui/fields@4.7.0
- @object-ui/plugin-detail@4.7.0

## 4.6.0

### Patch Changes

- Updated dependencies [8f490ad]
- Updated dependencies [3ee436d]
  - @object-ui/plugin-detail@4.6.0
  - @object-ui/components@4.6.0
  - @object-ui/fields@4.6.0
  - @object-ui/types@4.6.0
  - @object-ui/core@4.6.0
  - @object-ui/react@4.6.0

## 4.5.0

### Patch Changes

- Updated dependencies [ab5e281]
- Updated dependencies [d714e85]
- Updated dependencies [6b6afd1]
- Updated dependencies [aa7855f]
- Updated dependencies [170d89f]
  - @object-ui/types@4.5.0
  - @object-ui/plugin-detail@4.5.0
  - @object-ui/fields@4.5.0
  - @object-ui/components@4.5.0
  - @object-ui/core@4.5.0
  - @object-ui/react@4.5.0

## 4.4.0

### Patch Changes

- Updated dependencies [63eb66d]
- Updated dependencies [67dabe1]
- Updated dependencies [2bd45af]
- Updated dependencies [e33d575]
  - @object-ui/fields@4.4.0
  - @object-ui/plugin-detail@4.4.0
  - @object-ui/components@4.4.0
  - @object-ui/types@4.4.0
  - @object-ui/core@4.4.0
  - @object-ui/react@4.4.0

## 4.3.1

### Patch Changes

- Updated dependencies [6b683c8]
- Updated dependencies [0d8eb98]
- Updated dependencies [b0bc410]
  - @object-ui/components@4.3.1
  - @object-ui/plugin-detail@4.3.1
  - @object-ui/fields@4.3.1
  - @object-ui/react@4.3.1
  - @object-ui/types@4.3.1
  - @object-ui/core@4.3.1

## 4.3.0

### Patch Changes

- Updated dependencies [4e7bc1b]
- Updated dependencies [8442c05]
  - @object-ui/components@4.3.0
  - @object-ui/fields@4.3.0
  - @object-ui/react@4.3.0
  - @object-ui/plugin-detail@4.3.0
  - @object-ui/types@4.3.0
  - @object-ui/core@4.3.0

## 4.2.1

### Patch Changes

- @object-ui/types@4.2.1
- @object-ui/core@4.2.1
- @object-ui/react@4.2.1
- @object-ui/components@4.2.1
- @object-ui/fields@4.2.1
- @object-ui/plugin-detail@4.2.1

## 4.2.0

### Patch Changes

- @object-ui/components@4.2.0
- @object-ui/fields@4.2.0
- @object-ui/react@4.2.0
- @object-ui/plugin-detail@4.2.0
- @object-ui/types@4.2.0
- @object-ui/core@4.2.0

## 4.1.0

### Patch Changes

- @object-ui/types@4.1.0
- @object-ui/core@4.1.0
- @object-ui/react@4.1.0
- @object-ui/components@4.1.0
- @object-ui/fields@4.1.0
- @object-ui/plugin-detail@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12
- @object-ui/core@4.0.12
- @object-ui/react@4.0.12
- @object-ui/components@4.0.12
- @object-ui/fields@4.0.12
- @object-ui/plugin-detail@4.0.12

## 4.0.11

### Patch Changes

- @object-ui/components@4.0.11
- @object-ui/fields@4.0.11
- @object-ui/react@4.0.11
- @object-ui/plugin-detail@4.0.11
- @object-ui/types@4.0.11
- @object-ui/core@4.0.11

## 4.0.10

### Patch Changes

- @object-ui/types@4.0.10
- @object-ui/core@4.0.10
- @object-ui/react@4.0.10
- @object-ui/components@4.0.10
- @object-ui/fields@4.0.10
- @object-ui/plugin-detail@4.0.10

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9
- @object-ui/core@4.0.9
- @object-ui/react@4.0.9
- @object-ui/components@4.0.9
- @object-ui/fields@4.0.9
- @object-ui/plugin-detail@4.0.9

## 4.0.8

### Patch Changes

- @object-ui/components@4.0.8
- @object-ui/fields@4.0.8
- @object-ui/react@4.0.8
- @object-ui/plugin-detail@4.0.8
- @object-ui/types@4.0.8
- @object-ui/core@4.0.8

## 4.0.7

### Patch Changes

- Updated dependencies [7c9b85c]
  - @object-ui/core@4.0.7
  - @object-ui/react@4.0.7
  - @object-ui/components@4.0.7
  - @object-ui/fields@4.0.7
  - @object-ui/types@4.0.7

## 4.0.6

### Patch Changes

- Updated dependencies [89ae109]
- Updated dependencies [925051d]
- Updated dependencies [1b6dc64]
  - @object-ui/fields@4.0.6
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
  - @object-ui/fields@4.0.5
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
  - @object-ui/fields@4.0.4
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
  - @object-ui/fields@4.0.3

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

- e93fe35: Mobile UX round 3 — Gantt and Map

  **@object-ui/plugin-gantt**

  - Added a sticky vertical "Today" marker on the timeline plus a one-tap **Jump to Today** toolbar button so on-call users can re-orient the view instantly on small screens.
  - Added a **collapsible task list** (toolbar toggle + auto-collapse on the first narrow render) so the timeline area gets the full viewport on phones.
  - Added **pinch-to-zoom** touch gestures on the timeline; wired `columnWidthOverride` state so the existing zoom buttons also respond (previously a no-op).

  **@object-ui/plugin-map**

  - Added a **geolocate button** with the standard `navigator.geolocation.getCurrentPosition` permission flow, an inline error banner, a busy state, and a **user-location marker** (blue dot) the map flies to on success.
  - **Cluster tap-through**: tapping a cluster now flies the map in (zoom + 2, capped at 20) instead of just sitting there.
  - On mobile, the desktop popup is replaced by a **bottom-sheet record card** with safe-area padding and an explicit close button. Desktop continues to use the popup.

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
- @object-ui/fields@3.0.3

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2
- @object-ui/core@3.0.2
- @object-ui/react@3.0.2
- @object-ui/components@3.0.2
- @object-ui/fields@3.0.2

## 3.0.1

### Patch Changes

- Updated dependencies [adf2cc0]
  - @object-ui/react@3.0.1
  - @object-ui/components@3.0.1
  - @object-ui/fields@3.0.1
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
  - @object-ui/fields@3.0.0

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

# @object-ui/plugin-grid

## 17.7.0

### Minor Changes

- 67a87d9: Retire the dead per-column `wrap` forward from `ObjectGrid`'s data-table emit (objectui#5453,
  ADR-0049 enforce-or-remove).
  
  `generateColumns()` copied a per-column `wrap` onto every column object handed to
  `data-table`, and `packages/components`' `data-table.tsx` never read it. Measured on the
  current ref rather than inherited from the card, with comments stripped so prose mentions
  cannot be counted as reads: a column-level `wrap` scores **0**, against `accessorKey` 34,
  `align` 5, `header` 4, `className` 4, `width` 8 and `fitContent` 2 in the same query shape.
  Those sibling counts are the positive control — the search style does find the keys that are
  genuinely consumed, so the zero is a measurement and not a mis-aimed grep. The raw string
  `wrap` does occur in that file; every occurrence is `flex-wrap`, `whitespace-nowrap`, or a
  variable named `wrapper`.
  
  The implement leg was ruled out by the same measurement rather than by preference. `wrap: true`
  would have to drop a `truncate`, which presupposes the renderer has somewhere to put a second
  line — and it does not. `data-table`'s cell wrapper is a two-way switch,
  `isFit ? 'w-full whitespace-nowrap' : 'truncate w-full'`, with a native `title` tooltip as the
  only concession to overflow; the file does not read `density` or `rowHeight` at all. There is
  no clamp, no expand, no line-clamp and no multi-line affordance for a per-column `wrap` to turn
  on, so the enforce-or-remove default applies.
  
  Removing the forward rather than declaring the key follows from `wrap` having **no second road
  to a consumer**. That check is what separates this verdict from `pinned`, which `data-table`
  also never reads and which is nonetheless kept: `ObjectGrid`'s own reorder pass consumes
  `pinned` before the array reaches the slot and re-expresses it as the sticky `className` the
  renderer does read. `wrap` had no such pass anywhere.
  
  **Retired, not merely deleted.** `wrap` is no longer carved out of `RetiredListColumnKey`'s
  `Exclude`, so the derived tombstone band that objectui#6461 installed on this producer now types
  it `never`. Re-adding `...(col.wrap !== undefined && { wrap: col.wrap })` is a compile error
  naming `wrap` — otherwise "retired" is just a deleted line the next edit can put back for free.
  Deriving the band from the authored `ListColumn` is also why this needed no hand-maintained
  list: taking the carve-out out was the whole edit.
  
  **Breaking for TypeScript consumers of `@object-ui/plugin-grid`'s exported emit types only**
  (`ObjectGridColumnHolds` loses its `wrap` member; `ObjectGridColumnDraft['wrap']` becomes
  `never`). Marked `minor` per this repo's version-alignment rule, which reserves `major` for
  following `@objectstack` across a major — the same classification the `MobileOverrides`
  retirement used. **Runtime behaviour is unchanged**: an authored `wrap` did nothing before and
  does nothing now. What changed is that the code no longer implies `data-table` might consume it.
  
  ⚠️ The **authorable** spelling is untouched and still declared: `@objectstack/spec`'s
  `ListColumn.wrap`, which `packages/react`'s spec-bridge still forwards into the grid schema.
  Whether that spec property should keep being declared with no renderer anywhere is a spec-side
  enforce-or-remove question, filed separately rather than settled from inside this renderer.
- beccf1c: fix(plugin-grid): type ObjectGrid's column emit against the `TableColumn[]` slot it fills
  
  `generateColumns()` had no return annotation and all four of its call sites cast
  to `any`, so nothing checked what this producer wrote into
  `DataTableSchema.columns: TableColumn[]`.
  
  Annotating it is not enough, and that is the substance of the change. Measured on
  this program: `generateColumns(): TableColumn[]` raises **zero** diagnostics — the
  emit literals reach the annotation through `.map()`, which strips the freshness
  that excess-property checking depends on, so even an undeclared key written out
  longhand is accepted. Underneath that sits the reason the annotation could not
  bite at all: `objectSchema` is `useState<any>`, and an `any` spread into an object
  literal collapses the **entire** literal to `any`.
  
  So the fix has three parts: name the four inference locals so `any` stops at the
  boundary, carry ADR-0049 `?: never` tombstones **derived** from
  `keyof ListColumn` (never hand-listed, so a future spec key is refused by
  default), and drop the `any` at every call site — including a fourth the card's
  census missed and a fifth (`const generatedColumns: any[]`) inside the producer.
  
  Key verdicts: `headerIcon`, `pinned` and `wrap` are HELD and now declared at the
  seam; `options` is RETIRED — nothing on either side of the seam read it, and
  every value it carried still reaches its consumer through the field metadata the
  cell closure captures and the object schema the inline editor reads. `type` stays
  objectui#5853's and `name` is not emitted here at all.
  
  No rendering change.
- f55d666: Retire four undeclared authored column reads in `ObjectGrid.generateColumns()`
  (objectui#6458).
  
  `ListColumnSchema` is a strict object, so an author who wrote `format`,
  `options`, `appearance` or `essential` on a list column was **refused at
  publish** with `unrecognized_keys` while the grid happily honoured the key at
  runtime. That is the `declared != enforced` split AGENTS.md #0.1 exists to
  stop, and it was reachable only through `(col as any)`. All four reads are
  removed. Each was re-measured on this branch before deletion: **zero authored
  occurrences on a column across `examples/` and `apps/`**, per key, with `field`
  as the positive control in the same query shape — so no real author's metadata
  changes behaviour today.
  
  What each retirement leaves as the only road:
  
  - `format` and `appearance` — the object-field fallback (`objectDefField?.format`
    / `?.appearance`), which is already the road every measured author uses.
  - `options` — the object schema's select options. The column-level override was
    exactly the shape that let AI-authored metadata drift from the schema it is
    supposed to obey; one source for options beats two.
  - `essential` — mobile visibility stays positional (`colIndex === 0`).
  
  **Retired for want of authors, not forbidden forever.** If a real request for
  semantic mobile-column control arrives, the declare route reopens: declare the
  key on `@objectstack/spec` and read it without a cast. What stays ruled out is
  the third road — a renderer-side tolerance for a key the schema refuses.
  
  `columnReadBoundary-6458.test.ts` moves with the change: its bound on undeclared
  cast reads in that branch is now the **empty set**, so a new one goes red on
  arrival rather than accreting quietly.
- f241a4d: feat(plugin-grid): type the data-table schema slot ObjectGrid fills
  
  `const dataTableSchema: any` becomes `ObjectGridDataTableSchema`, and
  `buildGroupTableSchema`'s return carries the same annotation, so the ~46 keys
  this grid writes into the `data-table` slot are finally checked against the
  slot's declaration — the receiver half of the seam whose producer half #6004
  typed. The `(dataTableSchema.columns as any[])` cast in the grouped writer
  drops with it.
  
  The annotation is not a bare `DataTableSchema`, and that is the substance:
  measured on this program, a bare annotation with an undeclared bogus key
  written longhand in the fresh literal compiles with **zero** diagnostics,
  because `BaseSchema`'s `[key: string]: any` index signature makes every key a
  member — excess-property checking never has a non-member to refuse.
  `ObjectGridDataTableSchema` derives from `DataTableSchema` by stripping the
  index signature (never by hand-listing members), which makes the same probe go
  red (TS2353) at both writer literals — shown able to fail before being claimed
  as coverage, per the #6004 rule.
  
  Two schema-level keys the grid passes are undeclared on `DataTableSchema` and
  HELD at the seam with measured live readers in `data-table`:
  `renderCellEditor` and `cellClassName`. Whether `DataTableSchema` should
  declare them is filed for a ruling — nothing is declared on or retired from
  `@object-ui/types` here.
- 351eb31: Converge the lookup/user widget metadata on the spec's camelCase — one concept, one
  spelling (objectui#7155, maintainer ruling A′ of 2026-09-03, director decision batch #19).
  
  **BREAKING, deliberately, with no deprecation window.**
  
  Two published contracts declared OPPOSITE dialects for the same four lookup keys, and
  `@object-ui/fields`' read chains served both — snake FIRST, so the dialect the object
  contract *refuses* outranked the one it *declares*:
  
  | | `@objectstack/spec` `FieldSchema` (object metadata) | `@object-ui/types` `LookupFieldMetadata` (widget metadata) |
  |---|---|---|
  | camelCase | **declared** | compile error (`TS2561`) |
  | snake_case | refused (`unrecognized_keys`) | **declared** |
  
  `LookupFieldMetadata` and `UserFieldMetadata` now declare the spec spellings, and the
  snake members are **removed**:
  
  | before (removed) | after |
  |---|---|
  | `display_field` | `displayField` |
  | `description_field` | `descriptionField` |
  | `lookup_filters` | `lookupFilters` |
  | `id_field` | `idField` |
  
  **Migration.** Rename those four keys wherever you author lookup or user field metadata
  — `LookupFieldMetadata` / `UserFieldMetadata` objects, and any `DataSource.getObjectSchema`
  that returns them. The old spellings are no longer read: a def still carrying
  `display_field` falls back to the referenced record's generic name heuristic rather than
  the field you named.
  
  `idField` is kept as a **widget-contract** key. It carries objectstack#3508's machine-name
  hydration — committing a record field other than the id as the lookup's stored value —
  which is picker behaviour with no `FieldSchema` twin, and none owed.
  
  **Not renamed** (outside this ruling's four keys, still snake on the widget bag):
  `reference_to`, `title_format`, `lookup_columns`, `lookup_page_size`, `depends_on`,
  `allow_create`, `avatar_field`. `reference_to` in particular **stays** — the adapter's
  `normalizeSchemaReferenceKeys` choke point genuinely stamps it onto every def.
  
  Also moved with the rename: `content/docs/fields/lookup.mdx` and `user.mdx` (whose
  snippets CI compiles against the built `d.ts`), all seven in-repo producers, and the
  inline-edit enrichment allow-list in `@object-ui/plugin-detail`. `plugin-grid`'s
  `relationalMetaKeys.ts` drops the four `legacy-alias` verdicts and retires that verdict
  class; its gate is restated to assert the class no longer exists rather than passing
  vacuously.
- 8952395: A grouped grid now says, where the group counts are, that it grouped a **page**
  (objectui#7189).
  
  `useGroupedData` buckets the rows the browser already holds and computes every
  per-group aggregate from that same array, so both the set of groups and every
  number in a group header are properties of the fetched page, not of the query.
  That is a correct implementation of client-side grouping and is **unchanged**
  here — what was missing is any statement that client-side grouping is what you
  are looking at. Measured on a 186-record store distributed 86 / 61 / 31 / 7 / 1
  across five business units with a 100-row page: with contiguous rows the grid
  rendered **two** group headers (`86`, `14`) and three units were absent from
  the screen entirely; with interleaved rows all five resolved but every count
  was a page slice (31 / 31 / 30 / 1 / 7). Nothing on screen said either.
  
  The paging footer is not a statement about what was grouped, and it
  demonstrably did not prevent the wrong reading — a wrong number invites a
  second look, an absent row invites none. So the disclosure goes where the
  authoritative-looking number is:
  
  - a short `Partial` marker beside **every** group count, at every nesting
    depth, carrying the full sentence as its `title` and its accessible name;
  - one line directly above the group list, inside the grouped region rather
    than in the footer: *"Grouped over the first 100 of 186 records. Group counts
    are page-scoped, and a group whose records all fall beyond the loaded rows is
    missing here."*
  
  The trigger is the strongest thing the component can actually know, and the
  wording never outruns it. With a real match total to compare against
  (`resolvedTotalMatching` — the one derived value the pager and both bulk-bar
  sites already read, reached either from the grid's own fetch or from a host's
  `rowCount`) it states the fact with both numbers. With no total but a window
  that came back full it may only say *"more may match"* — the same inference
  `plugin-list`'s own footer draws when no total is known. Rows handed in inline
  are not a page and are never marked, and **a grouped grid whose result set fits
  in one page shows nothing at all**: the marker is conditional, which is what
  makes it worth reading.
  
  Server-side grouping — the durable fix — is deliberately NOT part of this. It
  is an API-surface decision still open on objectui#5560, and nothing here builds
  toward it or changes the fetch.
  
  `@object-ui/i18n` carries the three new `grid.grouping.*` strings across all
  ten locale packs; `GroupRow` gains two optional props (`partialLabel`,
  `partialTitle`) and is otherwise unchanged. No metadata schema key was added:
  the condition is derived from data the grid already has.
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
- cf1d29e: `ComponentInput.of` — the coarse kind of an input's MEMBERS, with readers on day one
  (objectui#8067).
  
  A registration's `type: 'array'` said a value was a list and stopped there, so a member
  that drifted from `@objectstack/spec` was invisible to every layer that reads a
  declaration. `page:header.actions` is the measured cost: the contract declares
  `z.array(z.string())` ("Action IDs"), the renderer read the members as `ActionDef`
  objects, and the repo-wide parity gate in
  `apps/console/src/__tests__/registry-inputs-spec-parity.test.ts` stayed green for the
  whole life of the drift because both sides carried the key and neither could say what
  was inside it. What settled it was a maintainer ruling, not a test — and even after the
  fix, "these are ids" survived only as English in the registration's `description`.
  
  **What is new.** `ComponentInput` gains an optional `of`, carrying the same coarse-kind
  vocabulary as `type` one level down: the ELEMENTS of an `array`, or the VALUES of an
  `object` used as a map. One kind, or an array of them for a member contract that is a
  union, with `type`'s semantics — a member passes when any declared arm accepts it. The
  manifest serializer forwards it, so `sdui.manifest.json` now carries seven keys per
  input instead of six.
  
  **Three readers ship with it**, which was the bar this slot had to clear (objectui#5905
  is the precedent: five `ComponentInput` keys declared and read by nothing). The
  repo-wide parity gate compares every declared `of` against the member kind
  `ComponentPropsMap[type]` actually accepts and fails on one the contract refuses;
  `sdui-parser`'s `validateTree` reports a member that fits no declared kind, as a new
  `member-type-mismatch` diagnostic naming the offending positions; and the generated
  `sdui-intrinsics.d.ts` narrows the authoring type — `page:header`'s `actions` is
  `string[]` where it used to be `unknown[]`.
  
  **Fifteen keys now declare one**, across ten blocks, each DERIVED rather than chosen:
  every container key's member position was probed with one value of each coarse kind and
  a declaration written only where exactly one kind was accepted. A member contract that
  admits several kinds — `record:highlights.fields` takes a field name or an inline field
  object — is deliberately left undeclared and pinned with its reason, because picking one
  arm there is a narrowing this repo leaves un-gated and picking all of them would
  advertise shapes only a per-block pin can vouch for.
  
  **The ceiling is unchanged.** `of` is a KIND and never a value domain, so the maintainer
  ruling of 2026-08-17 quoted on `ComponentInput.type` — the coarse arm plus `description`
  is the publication face's expression ceiling, and spec is the sole judge of values —
  stands exactly as written. `of: 'object'` says the members are objects; which keys they
  carry is still `description`'s job and `os validate`'s.
  
  **Nothing published before this changes.** An input that declares no `of` validates,
  serializes and types byte-identically: `validateTree` checks no member, the serializer
  emits no key, and the codegen emits the same `unknown[]`.
- ebce5a3: `object-grid` / `object-form` / `detail-view` resolve their data source the same way, and a block that resolves none says so
  
  The three object-bound blocks disagreed about how the data-source adapter reached
  them. `object-grid` and `object-form` were registered through wrappers that read
  it from `SchemaRendererProvider` context; `detail-view` was registered as the raw
  component, which reads a React `dataSource` prop. `SchemaRenderer` itself reads
  only context, so the two wirings were mutually exclusive: measured with correct
  keys in every cell, provider wiring gave the grid `find` 1 and the detail view
  `findOne` 0, and prop wiring gave exactly the reverse. Neither reported anything.
  
  All three now resolve the adapter through one rule — an explicit `dataSource`
  prop first, the provider context second. This is additive: `detail-view` keeps
  its prop form (and direct `<DetailView dataSource={…} />` callers are untouched),
  `object-form` gains a prop form it did not have, and `object-grid` no longer
  throws `useSchemaContext must be used within a SchemaRendererProvider` when a
  page has no provider.
  
  And the silence is over. A block in this family that resolves no adapter renders
  a **No data source resolved** panel naming the block, the object it was about to
  read, and the ancestor that injects the adapter — instead of a header-only grid,
  a field-less form card, or nothing at all. The check is opt-in per block, so a
  placement with inline rows, inline `customFields`, an inline record or an `api`
  endpoint is untouched.
  
  New from `@object-ui/react`: `useResolvedDataSource`, `NoDataSourcePanel`,
  `noDataSourceMessage`, and a `requiresDataSource` prop on `ElementDataSourceGate`.

### Patch Changes

- 9801765: The selection bar's built-in **Delete** now honours `userActions.delete.visibleWhen`
  per selected record (objectui#4420). It used to read that key as a bare boolean — the
  object-level verdict only — so ticking a record the author's predicate excludes still
  offered the red Delete, and pressing it deleted the record the predicate was written to
  protect. The row kebab on the same screen hid its Delete correctly, so one declared key
  meant two different things on two surfaces.
  
  Ruled by the maintainer on 2026-08-17 (behaviour 1 of the card's three): **filter the
  operation and report the skipped**. The bar evaluates the predicate once per selected
  record, the delete runs over the allowed subset, and the excluded records are reported
  rather than silently dropped. The button itself is never hidden or disabled by the
  predicate — a mixed selection is not punished for one stray tick — and a selection where
  every row is excluded is a legible refusal rather than an unexplained absence.
  
  - `@object-ui/core` gains `partitionRowsByPredicate`, the set-shaped counterpart of
    `evalRowPredicate`: the fail-closed per-record fold a bulk gate needs, written once.
    A bulk gate evaluates N records in a loop, which is why it can never be a hook.
  - `@object-ui/plugin-grid`'s bulk bar routes an excluded selection through
    `BulkActionDialog`, whose existing `bulk-skipped-notice` slot reports the skipped
    count; a selection with nothing excluded keeps the consumer's own delete flow
    untouched. `resolveRowCrudAffordances` now also returns `objectDeletePredicates` —
    the bulk half of the same predicates, gated on the object verdict rather than on the
    row `onDelete` wiring. The dialog declines to run over zero records.
  - `@object-ui/plugin-list`'s non-grid bulk bar (kanban / calendar / gallery / …) filters
    the built-in `delete` to the eligible subset and states the skipped count inline.
  
  Custom bulk action ids are untouched: they route through the action runner carrying
  their own gates. This is a UI affordance — server enforcement was never the leak.
- 062943f: `@object-ui/plugin-grid` and `@object-ui/plugin-kanban` now publish a stylesheet —
  `"./style.css"`, mapped to `dist/index.css` and compiled at build time from the package's
  own sources (objectui#4929, maintainer ruling 2026-08-17, Direction 1).
  
  **What was broken.** Only `@object-ui/components` and `@object-ui/fields` shipped CSS, and
  each scans its own `src` only, so a class used exclusively by a plugin could not appear in
  either sheet BY CONSTRUCTION. A published-state Vite app that installed one of these two
  plugins and followed the quick-start rendered the grid or the board with **25 themed
  utilities that had no source anywhere in the world** — `bg-muted/10`, `bg-card/60`,
  `text-muted-foreground/60`, `ring-primary/40` and friends, ordinary appearance classes —
  plus ~103 plain ones. Re-measured on the merged tree: the 21 the card listed all still hold,
  and four more (`[&>h3]:text-foreground/80`, `border-l-primary/40`, `border-primary/30`,
  `hover:text-primary`) that its literal-grep method could not see.
  
  The plain utilities a consumer could in principle regenerate by pointing `@source` at the
  package's `dist`. The themed ones they cannot, at all: they resolve `@theme` tokens declared
  in `packages/components/src/index.css`, which that package does not publish. A build inside
  this monorepo is their only possible producer — which is why the fix is a stylesheet we
  ship, not documentation teaching consumers to hand-declare the theme and scan
  `node_modules` (the advice objectui#4858 had just retired from the guides).
  
  **The shape**, inherited from `@object-ui/fields` (objectui#4059): each package gains
  `src/index.css` that `@reference`s the components entry — theme tokens, the class-based
  `dark` variant and the animate plugin become available for resolution while emitting
  nothing — plus `scripts/build-css.mjs`, which subtracts every rule components' published
  sheet already ships. So these are **supplements, imported after** the components sheet, and
  they are 16.30 kB and 11.41 kB rather than another ~170 kB each:
  
  ```css
  @import 'tailwindcss';
  @import '@object-ui/components/style.css';
  @import '@object-ui/fields/style.css';
  @import '@object-ui/plugin-grid/style.css';
  @import '@object-ui/plugin-kanban/style.css';
  ```
  
  Add a line only for the plugins you install; no other `@object-ui/plugin-*` package
  publishes a stylesheet yet. The build step is shared
  (`scripts/build-plugin-stylesheet.mjs`) so it is the pattern the next one inherits rather
  than a file to copy, and it refuses to write a sheet that fails any of four assertions — no
  rule may vanish, the subtraction must have removed something, the class count may not pass
  a leak ceiling, and named themed utilities only this build can produce must still be
  present.
  
  Nothing is removed and no existing import changes: a consumer who does not import the new
  sheets is exactly where they were, and the guides' "do not scan `node_modules`" advice
  stays correct — it is now correct for plugins too.
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
- 490d9a9: Grid headers offer a sort click only on columns the PLATFORM says it will order by
  (objectui#5729 — the consumer leg of objectstack#10235, maintainer ruling A, 2026-08-23:
  the platform serves an explicit per-column sortability signal and the grid reads it,
  rather than re-deriving "virtual ⇒ unsortable" from field type).
  
  `GET /api/v1/meta/object/:name` now answers with a `sortability` projection on its
  ENVELOPE — `{ fields: { [name]: { sortable, reason?, caveat? } } }`, computed at serve
  time from the platform's own storage predicates, deliberately beside `item` rather than
  inside it so the key stays un-authorable. The signal was reaching the browser and being
  discarded one line before its only consumer: `ObjectStackAdapter.getObjectSchema` unwraps
  the envelope to `item`, so every UI reader saw a document with no signal on it. It now
  survives that unwrap, carried on the schema under a symbol key — invisible to
  `JSON.stringify`, to `Object.keys` and to a spread, so a schema handed back at a metadata
  write endpoint can never take it into a body the server parses strictly.
  
  `@object-ui/core` gains the one spelling of the consumer contract:
  `isPlatformSortableField(projection, name)` is `true` iff an entry EXISTS for the name and
  says `sortable: true`. Absence is a refusal — it is how the platform encodes an unknown
  name, a dotted path and an unprovisioned audit column, all three of which the runtime
  doors reject — so the `!== false` spelling every other optional flag in this repo uses
  would get exactly that family backwards. A projection that is absent ALTOGETHER is a
  different question with a different answer (`undefined`: no signal was served) and is
  typed apart from an empty one, so a deployment older than the upstream change keeps the
  behaviour it had rather than being told, falsely, that nothing on the object is sortable.
  
  Three things follow in the grid. The header click on a refused column ceases to exist, so
  neither the old silent-unordered result nor the `400 INVALID_SORT` that replaced it is
  reachable from it. A sort PERSISTED before the signal existed is filtered out of both what
  the grid renders and what it emits, so a restored personalization cannot ride back into
  the next `persistViewPatch({ sort })` — the half-fix where the affordance is gone and the
  PUT still fires. And the relational carve-out is untouched and deliberately not delegated
  to this signal: the platform answers `sortable: true` for a `lookup` (it has a stored
  foreign key and both runtime doors accept ordering by it), while the grid withholds that
  header for a different reason — a column of names ordered by an invisible id.
  
  Columns carrying `caveat: 'unprovisioned-anchor'` keep their click. The runtime accepts
  those sorts; refusing what the platform does not refuse would recreate declared-≠-enforced
  drift in mirror image.
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
- 129bcc5: Column width and order that a user drags in `ObjectGrid` now actually persist
  (objectui#6175). Both halves of `saveColumnState`'s only two call sites were dead, so a
  drag was written nowhere — not to `localStorage`, not through `onColumnStateChange` to the
  host's `dataSource.updateViewConfig`. The saved state was read back correctly forever; it
  was simply never written.
  
  Two independent breaks, one per package:
  
  - **`@object-ui/components`** — `DataTableSchema` has declared
    `onColumnResize?: (columnKey, width) => void` all along, and `data-table.tsx` invoked it
    **nowhere**: the resize drag updated the table's local `columnWidths` state and stopped
    there. It now reports the settled width once, at `mouseup`. Once, deliberately — the host
    turns this callback into a write to shared view config, so a per-`mousemove` callback
    would be a write storm.
  - **`@object-ui/plugin-grid`** — `ObjectGrid` emitted `onColumnReorder` (singular) while the
    renderer invokes the near-duplicate `onColumnsReorder` (with the `s`), a different declared
    key with a different signature. The producer now emits the spelling the renderer actually
    invokes, mapping the reported `TableColumn[]` to the `accessorKey` order `columnState`
    stores.
  
  **Nothing is retired.** Both spellings remain declared on `DataTableSchema`;
  `onColumnReorder` stays declared and stays unwired, exactly as the `RuntimeOnlyDeclared`
  ledger in `zod-mirror-parity.test.ts` records it. Which of the two survives is a
  declared-surface ruling that stays open and is deliberately not settled here.
  
  ⚠️ Behavioural note for hosts: `onColumnStateChange` now fires where it previously never
  did, which means `dataSource.updateViewConfig` is now reached on a column drag. That call
  was unreachable by this path before, so any permission gate on that write now sees traffic
  it never saw.
  
  The renderer's resize/reorder gestures, the inbound seeding of `columnState`, and the
  declared surface are all unchanged.
- c38162d: The batch-explain cap the row-verdict hook paginates under is now imported from
  `@objectstack/spec/security` instead of re-declared locally (objectui#6286).
  `useRecordCrudVerdicts` carried `const EXPLAIN_BATCH_MAX_RECORD_IDS = 200`, a hand copy of
  a SERVER contract constant, under a doc comment that named its own expiry condition: the
  pinned `@objectstack/spec@17.0.0-rc.6` predated the batch form, and the pin bump would
  supersede the declaration. It has.
  
  **No value changes and no behaviour changes.** The spec exports `200`, which is what the
  local copy said, verified by resolving the installed package and reading the export — both
  statically (`dist/security/index.d.mts`) and at runtime through the same specifier the
  source now uses. What changes is reference identity: if the server relaxes or tightens the
  cap and the spec follows, the client follows too, instead of paginating at the old boundary
  with no signal anywhere. The cap's whole point is that an over-cap request is refused with
  `400 VALIDATION_FAILED` rather than truncated, so a client that silently disagrees with it
  is exactly the drift `scripts/check-spec-symbol-derivation.mjs` argues about — and could
  not catch here, because both of its scanners skip non-exported declarations and this const
  was module-local (objectui#5899).
  
  The declared floor already carries the symbol, so no range moves: `@objectstack/spec@17.0.0`
  — the minimum `^17.0.0` admits — exports `EXPLAIN_BATCH_MAX_RECORD_IDS = 200` from
  `./security`. Measured against the published tarballs of `17.0.0-rc.6`, `17.0.0`, `17.1.0`
  and `17.2.0`: only the rc lacks it. The declaration was therefore expired one release
  earlier than the card that found it assumed.
  
  The half of the comment that explains *why* the cap exists and what the server does with an
  over-cap request is kept and now sits on the import; only the half explaining why it was
  declared LOCALLY is gone, since that is the part that stopped being true.
  
  Covered by a new reference-identity test rather than a value assertion. Every assertion on
  `200` passes on both sides of this change — a ghost — so
  `useRecordCrudVerdicts.batchCap.test.tsx` stands the spec module in at a cap no hand copy
  could produce and asserts the request chunking follows it, with a control case proving the
  stand-in installed and differs from the shipped value. The pre-existing cap assertion in
  `rowRecordCrudVerdict.test.tsx` now derives its fixture and its bound from the same export
  instead of re-typing `200`, which removes the last hand copy on this surface without
  pretending to be a two-world test.
- 6e88630: One authority per exported type name, batch 3 of objectui#6349: `ComboboxOption`,
  `NamedActionDef`, `OrgTranslate`.
  
  **`@object-ui/components` — `ComboboxOption` now IS `@object-ui/types`' declaration.**
  The component declared its own `{ value, label }`, a strict subset of the
  `ComboboxOption` that `@object-ui/types` declares for `ComboboxSchema.options` and
  mirrors in `form.zod.ts` (`{ value, label, disabled? }`). The component now re-exports
  the types declaration (through the `@object-ui/types/form` subpath — the root barrel
  does not publish the name), so the name `ComboboxOption` exported from
  `@object-ui/components` gains the optional `disabled?: boolean` member. Every value
  that type-checked before still does — nothing narrows and no key changes type; the
  one thing that moves is `keyof ComboboxOption`, so a consumer that EXHAUSTS the type
  (a `Record` over its keys) will need the new key. Note that the `Combobox` component
  itself does not read `option.disabled` — that member was already declared on the
  `@object-ui/types` face and is now visible on this one too; it is recorded as a
  separate finding, not changed here.
  
  **`@object-ui/plugin-grid` / `@object-ui/app-shell` — internal, surface unchanged.**
  `NamedActionDef` was declared identically in `resolveBulkActions.ts` and
  `resolveLegacyRowActions.ts`; the latter is now the one authority and the former
  re-exports it. `OrgTranslate` was declared identically in `orgErrorMessage.ts` and
  `orgRoleLabel.ts`; the former is now the one authority and the latter re-exports it.
  Neither name is on its package's public entry, and every deep-`dist` module still
  exports the same name with the same shape.
  
  `FilterBuilderCondition` / `FilterGroup` (the other two names this batch was sized
  with) are deliberately NOT converged: their shapes disagree on `id`, `value` and on
  `operator`, and the only dependency-legal re-point would retype `operator` — the
  vocabulary objectui#7561 is asking a maintainer to rule on.
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
- c4987fb: ObjectGrid now restores a persisted column width on the ungrouped path — the stamp key was
  `size`, which nothing downstream reads (objectui#6457).
  
  Resize a grid column and reload: the width came back. It was written to `localStorage`
  (and reported to the host, which persists it through `dataSource.updateViewConfig`), read
  back into `columnState.widths`, and stamped onto the column — as `size`. `TableColumn`
  declares `width`, and `data-table` resolves a column's width at all four of its sites as
  `columnWidths[accessorKey] || col.width || autoSizedWidths[accessorKey]`; it reads no
  column-level `size` anywhere, and ObjectGrid never passes a `columnWidths` prop down. So
  the round trip completed and was discarded at the last hop, and the column fell back to
  the char-estimate auto width. The `persistedColumns` map now stamps `width`.
  
  The correct key was not a judgement call: the **grouped** path in the same component reads
  the same `columnState.widths` and has always stamped `width`, and it worked. One path was
  out of step with its sibling — so this restores a convention rather than teaching
  `data-table` a second spelling. `TableColumn` is not edited: the consumer's declaration
  was the correct one. Precedence is unchanged and needs no change — a persisted width still
  loses to an in-session resize and still beats auto-sizing.
  
  Two things stop it recurring. The map's callback is no longer `(col: any)`: typed as
  `ObjectGridColumn` (`TableColumn & …`, declared since objectui#6004), a stray `size` here
  is now a compile error instead of a silent, user-visible drop — the `any` was what let the
  wrong key cross a boundary that had already declared the right one. And the new pin is the
  **inbound** half — a persisted width seeded through both channels, asserted at the rendered
  header cell. The pre-existing suite asserted only the outbound half, which passes on the
  broken code, because the write is exactly what was wrong; that is the measured reason this
  shipped.
- d6ceb8d: Implement `ListColumn.wrap` — a column that says it wraps now actually wraps
  (objectui#6650, maintainer ruling 2026-09-02, Option B).
  
  `@objectstack/spec` declares `ListColumn.wrap` and describes it to authors as
  "Allow text wrapping", and `packages/plugin-grid/README.md` shows it in its
  authored-column example. No renderer anywhere implemented it. Long cell text
  stayed clipped to one line, with no error, no warning and no feedback of any
  kind — a promise made at authoring time and silently broken at render time.
  
  **What changes.** A `data-table` column with `wrap: true` renders its cell body
  `whitespace-normal break-words` instead of the default `truncate`, so long text
  flows onto further lines and the row grows to fit. `ObjectGrid.generateColumns()`
  forwards the authored key into the column slot, and `TableColumn` declares it, so
  the key is honoured whether it is authored on a spec list view or directly on a
  `data-table` node. `ObjectGrid`'s own `LinkCell` — the record link that column one
  of almost every grid renders through — honours it too, because its own `truncate`
  would otherwise clamp the text back to one line inside a cell body that was
  willing to wrap. `@object-ui/types`' zod mirror carries the key as well; without
  that the non-strict mirror would silently strip an authored `wrap` on the parse
  road, which is the same "renderer honours what the declaration refuses" gap
  objectui#6424 and objectui#6425 closed for their keys.
  
  **Nothing changes for anyone not authoring the key.** `wrap` absent or `false`
  renders exactly what shipped before, pinned as a control rather than assumed, and
  the link cell's default markup is byte-identical to what it was.
  
  **Precedence, where the two keys conflict.** `fitContent` WINS over `wrap`. A fit
  column is `width:1%` with no `minWidth`/`maxWidth` clamp, so the auto table layout
  sizes it from its content alone, and `whitespace-nowrap` is what holds that
  content's min-content width at its max-content width — one line. Drop nowrap and
  min-content falls back to the longest word, so honouring `wrap` there does not
  wrap the column, it collapses it: measured in Chromium with the cell shape
  reproduced exactly, 463.9px wide on one line with nowrap against 70.9px wide over
  ten lines without it — 6.5x narrower and 5.9x taller. The keys do not compose, and
  the one that yields is the one whose outcome nobody asked for.
  
  The static `table` renderer does not gain the key: `StaticTableColumn` tombstones
  it, so an author who writes `wrap` there is refused loudly at parse time with the
  remedy named, rather than having it silently stripped.
- 4ac3769: An object-bound grid whose rows arrive from a **host** now renders the object
  schema's default-columns policy instead of the row payload's keys
  (objectui#6677).
  
  `ObjectGrid.generateColumns()` checks three default paths in order: authored
  `columns` → the inline-data path → the object-schema path. The inline-data path
  is gated on `hasInlineData` (`dataConfig.provider === 'value'`), and
  `dataConfig` is built as `provider: 'value'` from the `data` **prop** before
  anything else — so it is taken by every grid whose rows were handed down rather
  than fetched. It returned unconditionally whenever rows were present, and its
  projection is `schemaFields || Object.keys(inlineData[0])`, the first row's
  keys. That made the object-schema path — the one carrying the documented policy
  (`highlightFields` first; else drop `hidden`, drop readonly system-managed, push
  the remaining system/ownership columns to the end) — **unreachable for every
  object-bound grid reached through a fetching host** (`ListView`, `ObjectView`,
  …). The branch that knows the object was the one that never ran.
  
  Measured on the same page, source and object with one variable — who fetches:
  `<object-grid objectName="opportunity" />` rendered the policy's **5** columns
  (Opportunity Name / Stage / Amount / Close Date / Owner); the same object behind
  `<list-view>` rendered **10**, adding `Id` (`hidden: true`) and the four audit
  columns (`system`). Those are exactly what the policy exists to keep off a
  default list, and the extra key set was whatever the query happened to return.
  
  **The yield is as narrow as the defect, and the two boundaries are the change.**
  Only the row-key *fallback* is wrong for an object-bound grid, so only that is
  given up, and only once there is a policy to give it up to
  (`!schemaFields && !!objectName && !!objectSchema`):
  
  - **An authored `fields` projection still wins.** The schema path drops a name
    the object does not declare (`if (!field) return;`), and a host may
    legitimately join or derive keys, so an explicit projection is not overridden
    — including when it names an audit column on purpose. `!schemaFields` is
    exactly the condition under which the `||` reaches for the row keys, so the
    gate cannot drift from the fallback it guards.
  - **Gating on `objectName` alone would have been a worse defect.** The schema
    arrives from an async fetch, so `objectSchema` is `null` on first paint; that
    gate falls through to `if (!objectSchema) return []` and paints an empty
    header row before flipping. Requiring the *loaded* schema keeps the row-key
    columns on screen until the object is actually known, and is also the
    graceful fallback when the schema fetch fails or the data source has no
    `getObjectSchema` — the grid degrades to heuristic columns rather than going
    blank.
  
  Inline data with no object behind it is untouched: the "Legacy support" path is
  reordered, never deleted, and is still the right answer there.
  
  Scored **patch**, deliberately. No public API moves — no prop, type, export or
  signature changes — and this restores the default-columns policy the component
  already documents and already applied whenever the grid fetched its own rows;
  the host-fed divergence was the defect, not a contract. `minor` was considered,
  because the visible column set changes on existing screens, and rejected: the
  lost columns were never *declared* by any author, only leaked by the branch
  order, and this repo scores behaviour-correcting fixes as patch and reserves
  `minor` for new capability (a `major` is never authored here — the fixed group
  tracks `@objectstack`).
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
- 19f3637: `ObjectGrid` no longer copies `reference_to_field` onto a relational column's `fieldMeta`
  (objectui#6711).
  
  `RELATIONAL_META_KEYS` listed nine keys that `applyRelationalMeta` copies off the
  object-schema field def onto the built `fieldMeta`, at all three of `generateColumns`'s
  column-building call sites. `reference_to_field` had **zero member reads**: swept across
  `packages/` and `apps/` (and again across the producer repo), the only occurrences of the
  identifier anywhere were the array literal itself — the write — and prose recording that
  nothing reads it. No member access, no destructuring, no bracket read.
  
  The control that makes that zero a reading rather than an artefact of how the sweep was
  written: the same sweep over its list-mates finds real readers for each of them —
  `reference_to` / `reference` / `display_field` in `LookupCellRenderer`, and `id_field` /
  `description_field` / `lookup_filters` / `lookupFilters` in `LookupField` / `UserField`,
  which is what the grid's editable cells need.
  
  Nothing renders differently. The key is not a member of any declared type on either end:
  `applyRelationalMeta` writes into a `Record<string, any>`, the bag reaches cell renderers
  through an `as any` cast, and the declared `FieldMetadata` union it is cast to does not
  declare it (nor does `BaseFieldMetadata` carry an index signature). `@objectstack/spec`
  17.2.0's `FieldSchema` does not declare it either — it is in none of that schema's 64
  props — so nothing authorable produces it. This is the same defect class the sibling
  producer retired twice: objectui#6625 (`FieldMeta.decimals`) and objectui#6597
  (`FieldMeta.referenceTo`).
  
  ⚠️ **What the measurement bounds.** The sweep covers this repo and the producer repo. A
  host application outside them could still be reading `reference_to_field` off the
  `fieldMeta` a cell renderer receives; that was never a declared promise this renderer made,
  and this repo's own contract is what the retirement is about — but the world was not
  measured, and a host reading the key gets `undefined` after this change.
  
  Because the key had no readers, the suite stays green whether or not the removal is
  correct, so the absence is pinned directly instead
  (`__tests__/relationalMetaCopySet-6711.test.tsx`): all three call sites, each with a
  presence assertion on the eight surviving keys as the control against a fixture that
  passes by never reaching the copy path.
- 9bd08fe: `ObjectGrid` re-applies field-level security on its inline-data column path too,
  so whether an object-bound grid re-checks FLS no longer depends on who fetched
  the rows (objectui#6723, maintainer ruling 2026-08-29).
  
  `generateColumns()` re-applied FLS at exactly one place — the object-schema
  path. The inline-data path, taken when a host hands rows down as `data` **and**
  the author declared a `fields` projection, had no equivalent check. Both paths
  serve object-bound grids, so the same object with the same authored projection
  did or did not go through the field gate purely according to provenance:
  
  | rows from | `fields` declared | path taken | FLS re-applied |
  | --- | --- | --- | --- |
  | grid fetches | no | object-schema | yes |
  | grid fetches | yes | object-schema | yes |
  | host passes `data` | no | object-schema (since objectui#6677) | yes |
  | host passes `data` | yes | inline-data | **no, until now** |
  
  The inline-data path now filters each column through
  `perms.checkField(objectName, fieldName, 'read')` when `perms.isLoaded &&
  schema.objectName`, the same gate and the same deferral condition the
  object-schema path has always used.
  
  ⚠️ **Only keys the OBJECT DECLARES are judged, and that limit is load-bearing
  rather than an optimisation.** Host-joined and derived keys pass through
  untouched, because keeping them is this path's whole reason to exist — the
  object-schema path drops them outright (`if (!field) return;`). A field policy
  that enumerates readable fields answers "no" for a key it has never heard of, so
  judging derived keys would silently drop them, which is the failure the issue's
  own analysis warned about. Declaration is read with `hasOwnProperty`, so an
  inherited name (`constructor`) is not mistaken for a declared field.
  
  **Defence in depth, not a reachable exploit through the shipped hosts.**
  `ListView` — the dominant host — already filters its own `effectiveFields`
  through this same gate before forwarding, and that redundancy is the point: the
  invariant must not rest on every future host having read the docs. The exposure
  this closes is a direct
  `<ObjectGrid schema={{ objectName, fields }} data={rows} />` composition, or a
  future host that forwards an authored projection unfiltered.
  
  Deliberately unchanged, and refused by name in the ruling: the two paths' other
  differences stay as they are — the schema path's `resolveFieldLabel` (i18n) vs
  the inline path's local humanisation, and the schema path's drop of names the
  object does not declare. Converging those is a separate decision.
  
  Pinned in `packages/plugin-grid/src/__tests__/inlineDataFls-6723.test.tsx` (a
  readable declared field renders; an unreadable declared field does not, even
  with host data for it; a derived key is unaffected; plus the perms-not-loaded,
  no-`objectName` and schema-in-flight boundaries and a case through the real
  `PermissionProvider`) and, as a measured no-op on the `ListView` path, in
  `packages/plugin-list/src/__tests__/ListView.inlineFlsNoop-6723.test.tsx`.
- fab4802: `ObjectGrid` re-applies field-level security on its authored `columns` path too,
  so all three of `generateColumns()`'s default paths now go through the field
  gate (objectui#6799, maintainer ruling 2026-08-30).
  
  objectui#6723 closed the inline-data path and left this one. It was the worst of
  the three to leave, because it is the **most reachable**: the inline-data path
  needs a host to hand rows down, while the authored `columns` path runs whether
  the grid fetches its own rows or not.
  
  | path | reached when | FLS re-applied |
  | --- | --- | --- |
  | authored `columns` (`ListColumn[]` and `string[]` arms) | `schema.columns` present and non-empty | **no, until now** |
  | inline-data | host passes `data` and `fields` is declared | yes (objectui#6723) |
  | object-schema | everything else | yes |
  
  Both arms now filter through `perms.checkField(objectName, fieldName, 'read')`
  when `perms.isLoaded && schema.objectName` — the same gate and the same deferral
  condition the other two paths use.
  
  **What a consumer will feel.** A grid that composes `ObjectGrid` directly with
  an authored `columns` projection will now render *fewer* columns for a principal
  whose field policy denies them: a column naming a declared field the user may
  not read disappears, where it previously rendered with its values. If your host
  already filters its projection through `checkField` before forwarding — as
  `ListView` does — nothing changes at all; this is a measured no-op on that path.
  Hosts that did **not** filter first will see the difference, and that is the
  point of the change rather than a side effect of it.
  
  ⚠️ **Only keys the OBJECT DECLARES are judged, and that limit is load-bearing
  rather than an optimisation.** Host-joined and derived columns pass through
  untouched. It matters more here than on the inline-data path: a `ListColumn`
  carries `label` / `link` / `action` / `prefix` / `width`, so a column whose
  `field` the object does not declare is not a mistake but a legitimate authored
  derived column, and dropping it would destroy authoring work. A field policy
  that enumerates readable fields answers "no" for a key it has never heard of, so
  judging derived keys would silently delete them. Declaration is read with
  `hasOwnProperty`, so an inherited name (`constructor`) is not mistaken for a
  declared field.
  
  **The judged key is read through `columnIdentity`, never off a bare string.** It
  folds the three authored identity spellings — `'salary'`, `{ field: 'salary' }`
  and the legacy `{ name: 'salary' }` — which is why one predicate serves both
  arms. A gate reading `col.field` directly would find no identity on the legacy
  spelling and wave a denied declared field straight through.
  `resolvesToDataColumn` still owns its own decisions and runs first, so the gate
  narrows what survives and never resurrects a hidden or unresolvable column.
  
  **Defence in depth, not a reachable exploit through `ListView`.** Measured in
  this repo: three shipped compositions reach this path without filtering first —
  `ObjectView`, and the designer's `ObjectManager` and `FieldDesigner` — plus two
  dev/demo harnesses. `ListView` filters its own `effectiveFields` through the
  same gate before forwarding, and that redundancy is the point: the invariant
  must not rest on every future host having read the docs.
  
  objectui#6598's `hasAuthoredColumns` predicate is unchanged and its rationale is
  rewritten in the same change: it used to rest on "the grid would not re-check",
  which is no longer true, and it now rests on the half that never depended on the
  grid — an empty projection is the author's projection after filtering, and the
  object's default columns are not what was authored whether or not they are
  FLS-checked on the way out.
  
  Pinned in `packages/plugin-grid/src/__tests__/authoredColumnsFls-6799.test.tsx`.
- f9984c0: `ObjectGrid` no longer copies `titleFormat` onto a relational column's `fieldMeta`
  (objectui#6874).
  
  `RELATIONAL_META_KEYS` listed eight keys that `applyRelationalMeta` copies off the
  object-schema field def onto the built `fieldMeta`, at all three of `generateColumns`'s
  column-building call sites. `titleFormat` was one of them and had **zero FIELD-meta
  readers**.
  
  This is a zero of a different kind from objectui#6711's, and a stronger one: `titleFormat`
  is a real, live key with plenty of readers — it just has none on a field meta. The sweep
  did not fail to find readers. It found every member read of the identifier across
  `packages/` and `apps/` (tests included) and classified each by its receiver:
  
  - `objectDef` / `objectSchema` / `objSchema` — `core/utils/record-title.ts`,
    `components/renderers/layout/containers.tsx`, `plugin-detail/DetailView.tsx`,
    `plugin-kanban/ObjectKanban.tsx`, `plugin-calendar/ObjectCalendar.tsx`,
    `react/hooks/useRecordSearch.ts`. An OBJECT schema, every one.
  - `refObjectSchema?.titleFormat` — `fields/widgets/LookupField.tsx`: the REFERENCED
    object's schema, fetched by `getSchema(referenceTo)`. Also an OBJECT schema, and the one
    that decides this case — it is what the grid's own inline picker reads.
  - `param.titleFormat` — `app-shell/utils/paramToField.ts`, off a resolved `ActionParamDef`.
    The field-def read beside it is `field.title_format`, a different spelling on a different
    surface.
  
  `RecordPickerDialog` and `lookupColumnDisplay` receive it as a PROP, and the repo's single
  `titleFormat=` pass is `titleFormat={refTitleFormat}` — object-schema sourced. So copying
  `reference_to` is what makes `titleFormat` work on this path, and copying `titleFormat`
  onto the meta reached nothing.
  
  Nothing renders differently, and the argument does not rest on the member sweep alone: the
  only computed access to the meta bag anywhere in `@object-ui/fields` or `plugin-grid` is
  `applyRelationalMeta`'s own write, so no consumer can pick the key up dynamically. The key
  is also not a member of any declared type on this path — `applyRelationalMeta` writes into
  a `Record<string, any>` and the bag reaches cell renderers through an `as any` cast.
  
  `plugin-dashboard/src/recordFields.tsx` had already recorded this exact measurement as its
  reason for not copying the key into that seam, so it was a measured no-op in two seams and
  retired from only one. Same defect class as objectui#6625 (`FieldMeta.decimals`),
  objectui#6597 (`FieldMeta.referenceTo`) and objectui#6711 (`reference_to_field`), and the
  same disposition as objectui#6711 on this very list.
  
  ⚠️ **What the measurement bounds.** The sweep covers this repo and the producer repo. A
  host application outside them could still be reading `titleFormat` off the `fieldMeta` a
  cell renderer receives; that was never a declared promise this renderer made, and this
  repo's own contract is what the retirement is about — but the world was not measured, and a
  host reading the key off a field meta gets `undefined` after this change. The supported
  source is unchanged and unaffected: the referenced object's schema.
  
  Because the key had no readers on this path, the suite stays green whether or not the
  removal is correct, so the absence is pinned directly instead
  (`__tests__/relationalMetaCopySet-6874.test.tsx`): all three call sites, each with a
  presence assertion on the seven surviving keys as the control against a fixture that passes
  by never reaching the copy path.
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
- 1349400: ObjectGrid: field-level security on the server `$select` projection
  (objectui#6898) — the FETCH half of the gap objectui#6799 closed on the RENDER
  half.
  
  `getSelectFields()` built the projection from the authored `columns` / `fields`
  with no FLS gate, so after objectui#6799 hid the column the field name was still
  being ASKED for. `perms.checkField(object, field, 'read')` now gates the
  projection, on both authored arms and on the predicate-operand harvest.
  
  Measured, because the grade depended on it: ObjectStack's own server enforces
  FLS on the RECORD, not on the projection — `plugin-security`'s read middleware
  deletes an unreadable key from every returned row, and its `predicate-guard`
  says in terms that the projection is deliberately unguarded because the masker
  strips the value anyway (pinned over real HTTP by objectstack's
  `showcase-fls-read-mask-strip.dogfood.test.ts`, where `?select=name,<denied>`
  answers 200 with the key absent). So against ObjectStack this is
  defence-in-depth; it becomes load-bearing for any backend that does not strip.
  
  Two limits are deliberate and pinned:
  
  - Only keys the object DECLARES are judged. `checkField` answers `false` for a
    field no policy mentions, so judging an undeclared key would strip a host's
    derived or joined column out of its own query.
  - `id` survives even a policy that denies it, structurally — `ensureId` composes
    after the gate — so row navigation cannot break. Readable predicate operands
    are untouched, so objectui#3501 does not regress.
  
  The fetch effect now also depends on `perms.isLoaded`: `/me/permissions`
  resolves asynchronously, so without it nothing would rebuild the projection
  after the policy answered and the gate would never run on the only fetch most
  grids make.
- 84ffdbc: Fix: a `dependsOn` lookup column is no longer permanently uneditable in an
  editable `ObjectGrid`.
  
  `LookupField` resolves the record it gates on as
  `dependentValues ?? ctx.formValues ?? ctx.data ?? {}`, and the grid's inline
  cell editor supplied **none** of the three — `renderCellEditor` rendered
  `FieldEditWidget` with `field` / `value` / `onChange` only, `SchemaRendererContext`
  has no `formValues`, and the grid sets no `ctx.data` for a row. The resolved
  record was therefore `{}` for every row, so a column declaring `dependsOn`
  rendered a disabled trigger reading "Select region first" **even when the row
  carried the parent value**. The field could never be filled and nothing said
  why.
  
  PR #2216 closed #2215 in two halves: the form renderer injects its live watched
  record as `dependentValues`, and every picker takes the `dependsOn` chain as a
  hard `baseFilter`. The second half is host-independent and was already live on
  the grid path — which is why the gate fired at all. The first half is per-host
  and the grid never got it. `renderCellEditor` now passes
  `dependentValues={ctx.row}`, supplying that missing input; no cascade is
  re-implemented.
  
  ⚠️ Interim, and deliberately labelled as such in the code (#7165): `ctx.row` is
  the **saved** record, so a parent edited but not yet saved in the same row does
  not re-scope the child — it stays scoped by the persisted value. Matching the
  form's live-record semantics needs a new member on `renderCellEditor`'s
  published context type and is tracked as #7188.
- a276480: `ObjectGrid` no longer copies `descriptionField`, `lookupColumns` or `lookupFilters` onto a
  relational column's `fieldMeta` (objectui#7166). No behaviour change — all three still reach
  the inline lookup picker, by a different seam.
  
  `applyRelationalMeta` writes the copy set onto the `fieldMeta` that `generateColumns` hands
  to `<CellRenderer>` as the `field` prop — six JSX passes across the three column-building
  paths, and nowhere else. For a relational column that resolves to `LookupCellRenderer`,
  which reads exactly `reference_to`, `reference`, `display_field`, `displayField`,
  `reference_field` and `options`; a `user` column resolves to `UserCellRenderer`, which
  destructures `{ value }` and reads no field meta at all. Measured by receiver rather than by
  count: `packages/fields/src/index.tsx`, the file holding **every** cell renderer, contains
  **zero** occurrences of the three retired keys, against a control of 22 occurrences of the
  `display_field` / `displayField` / `reference_to` spellings the cell does read.
  
  Their only readers off a field meta are `LookupField` and `UserField` — the two **editor**
  widgets — and the grid's inline editor does not receive this bag. `renderCellEditor` looks
  the field up in the object schema and spreads the whole def into the widget
  (`{ name: ctx.column.accessorKey, ...fieldDef }`), so every key a def carries reaches
  `LookupField` whether or not it is copied. The copies were dead writes: the objectui#6711
  (`reference_to_field`) and objectui#6874 (`titleFormat`) class, arriving from the opposite
  direction — those keys had no *declaration*, these have no *reader on this path*.
  
  Two of the three, `descriptionField` and `lookupColumns`, were **added** by objectui#6875 as
  its fix, classified from a read-set derivation alone. Its third key, `displayField`, is
  genuinely delivered and stays copied — and it is the one that arrived with a rendering test.
  ⭐ The generalisable lesson, now recorded in both docblocks: **a derivation establishes that
  a consumer READS a key; it does not establish that a given BAG is how the consumer gets it.**
  
  - New `__tests__/relationalMetaCopySet-7166.test.tsx` renders both directions. The **cell**:
    four lookup columns over one referenced record, differing only in the key under test, all
    resolve the same text, while the `displayField` control column resolves something else —
    the control is what makes the three zeros readings rather than a fixture that never reached
    the lookup path. The **editor**: each retired key still takes effect in the inline picker
    with the copy set no longer carrying it — `descriptionField` drives the secondary line,
    `lookupColumns` shapes the picker columns, `lookupFilters` scopes the candidates — each
    against a sibling control column that declares nothing.
  - The three snake_case `legacy-alias` spellings — `description_field`, `lookup_filters`,
    `id_field` — have the same reader-side verdict and are **deliberately kept**. They are
    recorded as legacy aliases precisely because a host `DataSource` outside these repos may
    hand-feed them; that is a producer-side argument, untouched by this reader-side
    measurement. Their verdict is now recorded on the table with the open producer question
    stated, so the next pass inherits a measurement instead of a silence.
  - ⛔ The derivation gate cannot enforce this retirement, and now says so. Its read set is a
    union over three consumers, two of which are not fed this bag, so all three retired keys
    remain in it and every derived assertion passes whichever verdict they carry. Their absence
    is pinned by an explicit hand-written assertion plus the rendering test. Re-scoping the
    derivation around the cell alone is a design change to objectui#6875's mechanism and is
    filed, not made here.
  - The gate is strengthened, not weakened: every `deferred` verdict is now mechanically proved
    spec-declared against the installed `FieldSchema`, and the sibling pins
    (`relationalMetaCopySet-6711` / `-6874`) turn the retired `lookupFilters` into a live
    negative assertion on a fixture that still declares it.
- a6d8b8d: Fix: a grid grouped by a field it does not also show as a column no longer collapses
  every row into one `(empty)` group (objectui#7179).
  
  `$select` was built from the view's `columns` and nothing else, so a view declaring
  `grouping: { fields: [{ field: 'business_unit' }] }` on a field absent from its columns
  never asked the server for that field. It was `undefined` on every row by the time
  grouping ran, and the grouping label builder — correctly, for a genuinely empty value —
  answered `(empty)` for all of them. The result was one collapsible group holding every
  record, with no error, no warning and no empty state: a grid that looked like it grouped
  and did not, reading as "these records have no value for this field".
  
  The grouping fields are now unioned into the projection, at both places it is built —
  `ObjectGrid` when it fetches for itself, and `ListView` when it fetches and hands the
  rows down. Lookup grouping fields are unioned into `$expand` as well: a `select` that
  fetches a bare foreign key without populating it buckets by raw id instead of by name,
  which is a different wrong answer rather than a fix.
  
  Authors do not need to mirror a grouping field in `columns` any more. That was never
  required by `@objectstack/spec` — `grouping` is a sibling of `columns`, not a subset of
  it — and the neighbouring view kinds (kanban, gantt, timeline) already unioned their
  `groupByField` with no column needed. Refusing the configuration at author time was
  considered and rejected: it would make the grid the odd one out and reject working
  intent that the schema explicitly allows.
  
  The union is guarded, and the guard is as load-bearing as the fix. A `grouping.fields[]`
  entry carries a bare string that has never been through column validation, and some
  backends answer an unknown `$select` key with an empty result set rather than ignoring
  it. Unioned unguarded, a grouping field naming something the object does not declare
  would have turned this bug into a strictly worse one — no rows at all, equally silently.
  Grouping fields are therefore intersected with the object's declared fields and passed
  through the same field-level-security gate as columns and predicate operands before they
  reach the query.
- adbda1b: Fix: a `dependsOn` lookup edited inline follows a parent edited in the same row **before**
  it is saved (#7188, finishing #7165).
  
  #7165 shipped an explicitly-labelled interim: the grid's inline editor scoped a
  `dependsOn` picker by `ctx.row`, the **saved** record. Edit the parent cell, do not save,
  open the child — and the child still listed candidates for the parent's persisted value
  (or stayed gated if that value was empty). The grid now scopes by `ctx.pendingRow ?? ctx.row`,
  where `pendingRow` is the row merged with its staged, unsaved edits, so picking a parent
  re-scopes the child immediately — the form's live-record semantics from #2216. The interim
  marker that named #7188 is gone with the interim.
- 67dadd6: FLS-gate the `$expand` projection at both build sites (objectui#7215).
  
  objectui#6898 closed field-level security on `$select`. `$expand` was left ungated at
  both projection sites — `ObjectGrid`'s own fetch and `ListView`'s `expandFields` memo —
  so a `lookup` / `master_detail` / `user` / `tree` field the current principal cannot
  read was still handed to the server for expansion. `$select` on a denied lookup asks for
  its bare foreign key; `$expand` on the same field asks the server to resolve it and
  return the related record, so the larger of the two disclosures was the ungated one.
  
  **Reproduced before it was fixed**, as failing tests at both sites, and the same leak
  reaches further on the `ListView` path: that builder's `$select` gate drops the denied
  column and then adds the expand roots back unconditionally, so the denied field walked
  back into `$select` as well. Gating the expansion closes both halves.
  
  **Grading, measured rather than assumed.** Against ObjectStack's own server this is
  defence-in-depth, exactly as objectui#6898 is: `plugin-security`'s
  `FieldMasker.maskRecord` deletes every unreadable key from each returned row, and
  objectql's expand path writes the resolved record back under that same key, so one
  statement removes the expanded object and the bare id alike; the expansion sub-read is
  itself gated (`__expandRead` takes the referenced object's full CRUD + RLS + FLS
  treatment). It is load-bearing for any backend that does not strip.
  
  **Nothing a permitted view did stops working.** The gate judges the OUTPUT of
  `buildExpandFields`, which is already a subset of the object's declared
  reference-bearing fields, so the "`checkField` answers false for an undeclared key"
  trap cannot be reached and derived / host-joined columns are untouched. An unanswered
  permission policy filters nothing. `buildExpandFields` itself is unchanged.
- e21308e: Grid: a malformed entry in `grouping.fields[]` no longer crashes the whole grid.
  
  A `null` (or `undefined`) hole in the array was dereferenced with no guard at
  two places — `ObjectGrid`'s `groupValueFormatter` memo and `useGroupedData`'s
  `buildLevel` — throwing `TypeError: Cannot read properties of null (reading
  'field')` during render, before any projection was built. Both sites now read
  one normalized entry list, admitting exactly the entries `collectGroupingFieldRefs`
  harvests into the query projection, so the usable grouping levels still group
  and an unusable entry is simply dropped rather than taking the view down.
- 19f1639: A synthesized default list view now always leads with the object's name field
  (objectui#7245).
  
  **The defect.** An object that declares no list view gets its default grid columns
  synthesized from `highlightFields`, taken verbatim. But `highlightFields` is ADR-0085's
  *"most important fields"* role, not a column list — and its first consumer, the
  detail-page highlight strip, **deliberately removes the title field**, because the page
  H1 directly above it already shows one. So metadata that is entirely correct routinely
  omits the record's name from `highlightFields`. The showcase `showcase_account` declares
  `nameField: "name"` and `highlightFields: ["status", "industry", "annual_revenue"]`, and
  its default `所有记录` grid rendered 14 rows whose columns were `#` / Lifecycle / Industry
  / Annual Revenue / actions — no name column, and no way to tell one account from another.
  
  A list has no H1 to lean on, so the same declaration needs the opposite treatment here.
  This is not a new convention: `deriveLookupColumns` in `@object-ui/fields` already leads
  its record-picker columns with the display field and filters it out of the declared list.
  The list faces now agree with it.
  
  **What changed.** `@object-ui/core` gains two exports on the ADR-0079 title ladder:
  
  - `resolveNameField(objectDef)` — *which field* titles an object: the declared
    `nameField` (then its deprecated `displayNameField` / `NAME_FIELD_KEY` aliases), else
    the type-aware derivation. The name-space twin of `getRecordDisplayName`, which answers
    what that field *says* on one record. Both now read one spelling of the declared
    pointer, so they cannot drift into naming different fields.
  - `leadWithNameField(objectDef, columns)` — moves that field to the front of a
    **synthesized** column list.
  
  All three faces that synthesize default list columns call it: `ObjectView`
  (`defaultListColumnsFromObject`), `InterfaceListPage` (`defaultColumnsFromObject`) and
  `ObjectGrid`'s own derivation. The name field is **moved**, not merely appended, so an
  author who lists it third still gets it first — "the column that identifies the row"
  means first. On the two capped faces the lead is applied *before* the 5 / 6-column slice,
  so an object declaring its name field late no longer loses it off the end.
  
  **Scope, deliberately narrow.** Author-declared column lists are untouched — a view or
  grid that declares `columns` / `fields` said what it wants, and reordering it would be
  renderer-side second-guessing of metadata. Three cases also decline to lead: a name field
  the object carries no field def for (never fabricate a column), one marked
  `hidden: true` (the author said don't show it), and a *derived* pick that lands on a
  system-managed column — `deriveTitleField` filters by type only, and leading a default
  list with a raw id is the regression objectui#2702 / #2777 fixed. A *declared*
  `nameField` pointing at a system field still leads: `sys_migration` really does point at
  `id`, and an explicit designation is not a heuristic misfire.
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
- 9e22085: `ObjectGrid` lowers the deprecated `defaultFilters` through `toFilterNode` instead of
  byte-copying it onto `$filter` (objectui#4082).
  
  The query assembly already lowered the canonical `filter` key through `toFilterNode` —
  the repo's single "last hop before the wire" (objectui#4041) — while the legacy branch
  beside it assigned `params.$filter = schema.defaultFilters` verbatim. That made this the
  one leg on the chain reaching the wire unlowered: `plugin-list`'s `buildEffectiveFilter`
  and `plugin-view`'s non-grid fetch both already route the same value through
  `toFilterNode` / `mergeFilterNodes`.
  
  Byte-copying is refused on the wire for both shapes the slot carries. `defaultFilters` is
  declared `Record<string, any>` (the MongoDB-style shape) and `isFilterAST` is false for a
  plain object; an array of `ViewFilterRule` objects fails the same predicate. Either one
  answers `400 INVALID_FILTER` — measured against a real backend in objectui#3431.
  
  `toFilterNode` handles both without new logic: objects route through
  `convertFiltersToAST`, rule arrays lower element-wise, and an AST already in the slot
  passes through untouched, so nothing is lowered twice. It also folds an absent or empty
  source to `undefined`, which is why the truthiness guard is gone — `defaultFilters: {}`
  used to send `$filter: {}`, asking the server a question with no content in a shape it
  refuses; now `$filter` is omitted, matching the canonical key's documented behaviour.
  
  **Grade — this is less dormant than the card assumed.** objectui#4082 was filed
  observation-class on "no measured producer", reasoning that `defaultFilters` is not in
  `object-grid`'s registered `inputs` so an author writing it only draws a save-gate
  warning. That reasoning covers authors, but not the framework: `plugin-view`'s
  `ObjectView` writes the slot itself, forwarding an active named view's `filter` as
  `defaultFilters: viewFilter || schema.table?.defaultFilters` in its `gridSchema` memo —
  and `plugin-view`'s own README documents `listViews.<name>.filter` as
  `[{ field, operator, value }, …]`, the exact shape objectui#3431 measured as
  `400 INVALID_FILTER`. The registered `object-view` / `view` renderer passes no
  `renderListView`, so that path falls through to `ObjectGrid` rather than to `ListView`,
  and `ListView`'s lowering does not cover it. So a schema-registration host — the
  documented authoring path — reached the raw assignment whenever an active named view
  carried a filter. Not asserted here: a failing request captured against a running
  deployment. `app-shell` is unaffected either way; it supplies `renderListView` and
  delegates to `ListView`, which lowers.
  
  Not in scope, and deliberately not done: retiring `defaultFilters`. This is
  consumer-side only — the key the schema admits is unchanged, and its precedence behind
  the canonical `filter` is unchanged.
  
  The sibling legacy `defaultSort` leg was graded and needs no change; see the PR for the
  measurements.
- c574dfb: `ObjectGrid` says which column it dropped, instead of rendering a header-only grid in silence.
  
  objectui#5068 retired the undeclared `accessorKey` / `header` tolerance branch, so
  `ListColumnSchema`'s `field` / `label` is now the only column spelling the renderer
  reads. That was right — the spec refuses `accessorKey` and `header` by name, and the
  census found zero authored usages. But it relocated a failure mode instead of removing
  it: a column authored in a spelling the renderer does not read contributed nothing, and
  nothing said so. No error, no warning, no empty state — the author got a grid with its
  row-number column and no data columns, which is a success receipt for a disagreement
  between the renderer and the author.
  
  An authored column that can never resolve now emits one `console.warn` naming the
  address rather than the symptom: which block (`object-grid` or the `view:grid` alias),
  which object and label, which `columns[i]`, the keys that entry actually carries, and the
  rewrite that works — for a column authored `{ accessorKey: 'amount', header: 'Amount' }`
  the message spells out `{ field: 'amount', label: 'Amount' }`. It reuses the channel `ObjectGrid` already had for "you declared it, the renderer dropped
  it" (the export-format warning), rather than adding a second differently-shaped one.
  
  Rendering is unchanged in every case: this is additive. The diagnostic reads the
  `columns` input and nothing else — it never asks whether the grid found rows, because
  `object-grid` legitimately draws them from five different places (a bare `data` array,
  `data.provider: 'value'`, legacy `staticData`, `bind`, or a host that owns the fetch and
  passes the window down as a `data` React prop, which is what `plugin-list`'s `ListView`
  does). All five are pinned by test, in both directions. A `hidden: true` column is
  authored intent and is never reported, and so are the arms that legitimately produce no
  columns of their own: no `columns` key, an empty `columns` array, and the `string[]`
  spelling.
  
  A throw was rejected: a grid that renders nothing today would become a page that renders
  nothing.
- 02f48b6: `object-grid` harvests row-action predicate fields from the OBJECT's `userActions` block only — a view's toolbar policy can no longer shadow it.
  
  `userActions` names two different blocks. On a **view** it is toolbar policy —
  the spec's `UserActionsConfigSchema` (`sort`, `search`, `filter`, `refresh`,
  `rowHeight`, `addRecordForm`, `editInline`, `buttons`), which rejects `edit` by
  name. On an **object** it is the CRUD-predicate block (`edit` / `delete` /
  `create` carrying `visibleWhen` / `disabledWhen`, objectui#2614) — and that is
  the only shape `listViewPredicates` can read, since its loop skips every
  non-object value.
  
  `ObjectGrid` read the key view-first when building the `$select` projection
  (`(schema as any).userActions ?? resolvedSchema.userActions`). A view carrying a
  perfectly legal toolbar block therefore shadowed the object's CRUD predicates,
  the harvest found none, and the predicate's operand left the projection. CEL then
  faults on the absent key, fails closed, and the row Edit/Delete button disappears
  for everyone with nothing pointing at the projection — objectui#3501's failure,
  reached with a success receipt at every step.
  
  The view-level block is not hypothetical: `SpecBridge.transformListView` copies
  it onto the `object-grid` node the renderer receives, and `app-shell`'s
  `ObjectView` builds one unconditionally.
  
  The harvest now reads the resolved object block only. Both `userActions` read
  sites carry a comment naming the collision, and
  `__tests__/gridNonAuthorKeys.test.tsx` pins each clause of it: the two shapes,
  the producer that writes the view one, the harvest's blindness to it, and the
  projection that must keep the object's operand with a toolbar block present.
  
  Toolbar policy itself is untouched — it was never read through this path.
- 591bf27: Guard `useRowColor`'s two object-literal lookups with `Object.prototype.hasOwnProperty.call`.
  
  Both `config.colors` (the authored map) and the module's `COLOR_TO_CLASS` literal inherit
  `Object.prototype`, and both were reached with a bare index. A record whose colour field
  held `constructor`, `toString`, `valueOf` or `hasOwnProperty` resolved to an inherited
  function: the `if (!color)` guard passed it (functions are truthy) and `colorToClass` then
  called `.startsWith` on it, throwing a `TypeError` inside the row-className resolver during
  render — a grid crash triggered by record data rather than by metadata. The same shape one
  call deeper in `colorToClass` did not throw; it handed an `Object.prototype` member back as
  the row's `className`, which reached React as a class attribute. Both now resolve to
  `undefined`, as an undeclared value always did.
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
  - @object-ui/mobile@17.7.0
  - @object-ui/permissions@17.7.0

## 17.6.0

### Minor Changes

- dbbd38a: fix(plugin-grid): `ObjectGrid` reads the declared column spelling, and only it
  
  `ObjectGridSchema.columns` is declared `string[] | ListColumn[]`, and
  `ListColumnSchema` in `@objectstack/spec/ui` is a **strict** object: `field` is
  required, and `accessorKey` / `header` are refused **by name** —
  `unrecognized_keys`, with a prescriptive message. The renderer accepted that
  refused spelling anyway, through a branch that sniffed `columns[0]` for an
  `accessorKey` and synthesized a `ListColumn` from it. One key, two spellings:
  one the schema admits, one only the runtime did.
  
  That branch retires (inheriting the disposition of objectui#3951 together with
  its reason — unify at the producer, no consumer-side tolerance alias, AGENTS.md
  #0.1). It is also why the fictional `{ header, accessorKey }` column interface
  in the plugin README (objectui#5013) read as credible: it rendered, so nothing
  signalled that the contract refuses it.
  
  **Affected input.** A column authored `{ accessorKey, header }` no longer
  resolves; it is dropped, and a grid whose columns are all mis-spelled renders as
  the row-number column alone. Write columns the declared way — `{ field, label }`
  — which is what the spec has always accepted and what the docs have always said
  (`content/docs/plugins/plugin-grid.mdx`: "The field this column reads. There is
  no `accessorKey`."). No authored usage of the retired spelling exists in this
  repo's examples, docs, apps or fixtures; every in-repo occurrence of the name
  belongs to the `table` / `data-table` component, which legitimately owns it.
  
  The `columns[0]` sniff goes with the branch. Column identity is a per-column
  property, and one filter now judges it: a mis-spelled column is dropped alone,
  where the sniff let the first entry decide the fate of the whole array — a
  declared column standing behind an undeclared one was lost with it, and the
  reverse order threw a `TypeError` mid-render.
  
  `accessorKey` keeps its job on the way **out**: it is the data-table adapter's
  column key, which `@object-ui/core` deliberately holds outside the metadata
  identity fold (`TABLE_ADAPTER_COLUMN_KEY`) and which `ObjectGrid` still writes
  when it hands columns to the adapter. Metadata vocabulary in, adapter vocabulary
  out, one translation at one boundary.
- b1119ec: Project every declared `recordIdField`, and refuse an action that names no record
  
  objectstack#8018. An `api` action declaring `recordIdParam` identifies the record
  it acts on by a row field — `recordIdField`, default `id`. The grid built
  `$select` from the listView columns, `id` and the predicate refs only, so an
  action keyed on any other field asked the server for everything except the key
  naming its own record. The row arrived without it, and the injection was skipped
  silently: the request went out anyway, minus the parameter. A backend reading a
  missing selector as "match nothing" then answers success for having changed
  nothing, so a record-scoped mutation reports success and does nothing.
  
  Two independent repairs, both in this change:
  
  - **Projection.** `listViewPredicates` (`@object-ui/core`) now also harvests
    `recordIdField` from `rowActionDefs`, `bulkActionDefs` and the object's
    `actions`, spelled as a synthetic `record.<name>` so the one existing harvester
    handles it. Both projection builders — `ObjectGrid` and `ListView` — read that
    function, so both gain the key with no call-site change. The existing guards
    still apply: a name the object does not declare, or one that is not a bare
    identifier, is dropped rather than put in `$select`, because an unknown key
    there is not ignored by every backend.
  - **Loud failure.** New `resolveRecordIdParamSeed` (`@object-ui/core`) is the one
    definition of "can this row identify the record?". `useConsoleActionRuntime`'s
    api handler now refuses the dispatch — `{ success: false, error }`, before the
    request — when the row lacks the key, or holds `null` for it. The two refusals
    are worded differently because they point at different repairs: an absent key
    is a projection or read-visibility problem, a null value is a data one. Falsy
    real values (`0`, `''`, `false`) are values and still dispatch.
  
  The second half is what closes the class rather than the common case: a row can
  lack the key for reasons projection cannot fix — a server-side read mask that
  strips the field regardless of `$select`, a partial payload, a field the
  principal cannot read.
  
  Behaviour change worth noting: an action that previously dispatched an
  under-specified request now fails visibly instead. That is the point — the old
  path could not report the failure it was causing.
- d2ce342: Retire the structured `confirm` object on actions (objectui#4314, maintainer ruling
  2026-08-17, ADR-0049 enforce-or-remove). `confirmText` is now the one confirm
  spelling — the only one the translation bundle can address
  (`{ns}.objects.{obj}._actions.{name}.confirmText`), matching `@objectstack/spec`'s
  action surface.
  
  Breaking semantics (flagged `minor` per this repo's version-alignment policy):
  
  - `@object-ui/types`: `ActionSchema.confirm` is a `?: never` tombstone — authoring
    it is now a tsc error, and the Zod twin rejects any authored value at parse time
    (it previously accepted the object). The backwards `@deprecated` note that
    steered authors from `confirmText` INTO the structured arm is gone.
  - `@object-ui/core`: `ActionRunner` no longer reads `confirm.message` (which used
    to outrank `confirmText`, untranslated). `ActionDef.confirm` carries the same
    `never` tombstone. The `ConfirmationHandler` signature is unchanged, but the
    runner now invokes it without the `options` argument.
  - `@object-ui/plugin-grid`: `resolveBulkActions` no longer falls back to
    `confirm.message` when promoting an object action — spec metadata can never
    deliver that key.
  
  Nothing in the repo, the example apps, or the schema catalog authored the
  structured form (verified on the issue); a dialog authored that way silently lost
  localization. Reopen condition recorded on objectui#4314: real demand returns the
  arm WITH bundle keys designed in.

### Patch Changes

- feb6b16: Grid group headers, compact cards and kanban card badges honour an author-declared option hex, matching the grid cell.
  
  objectui#5141 taught the grid's cell renderer (`SelectCellRenderer`) to render an
  explicitly declared `options[].color` hex as declared instead of quantizing it
  onto one of nine palette families. Four badge call sites in `plugin-grid` and
  `plugin-kanban` still resolved through `getBadgeColorClasses`, which returns a
  class string and therefore cannot carry a runtime colour — Tailwind can only
  emit classes it saw in the source at build time.
  
  The result was worse than the bug it replaced: the same option in the same
  object rendered one colour in a desktop grid cell and a different one in the
  group header above it or on the kanban card beside it. The pre-#5141 state was
  at least uniformly wrong.
  
  All four sites now resolve exactly as the cell does — prefer
  `getBadgeHexAppearance(color)` and use its `className` **and** its `style`,
  falling back to `getBadgeColorClasses` for palette-family names, no colour, and
  every other declaration. The compact card keeps its pipeline-stage heuristic
  when the author declared no colour at all.
  
  Two carriers were widened so the style can reach the element, because these
  badges are not all plain JSX: `GroupRow` takes a `labelColorStyle` alongside
  `labelColorClass`, and a kanban card badge takes `colorStyle` alongside
  `colorClass` (`KanbanCard.badges[]`). Both additions are optional and additive;
  a badge that carries only a class renders exactly as before. The colours ride
  CSS custom properties that the class reads, so a class passed without its style
  paints against undefined variables — the two halves have to travel together.
  
  Behaviour is unchanged for every declaration that is not an explicit hex.
- 9aecabe: A bulk action dialog's per-option `visibleWhen` predicates now read the dialog's own in-progress param values.
  
  The second landing site of the same gap objectui#3765 closed for the
  single-record action dialog. A field's per-option `visibleWhen` reaches a bulk
  param's control, but the dialog supplied no record to evaluate it against: it
  passed no `dependentValues`, so the shared cascading-options evaluator fell
  through its chain (`dependentValues ?? formValues ?? data`) to whatever record
  the host grid page happened to publish, or to nothing at all. A predicate
  written against a SIBLING PARAM — `record.country == 'cn'` on a province option,
  next to a `country` param in the same dialog — could therefore never see the
  value the user had just entered. Authored cascades were dead on this surface, in
  the safe direction: an unresolvable predicate offers the option rather than
  hiding it, so nobody was shown a wrongly-narrowed list.
  
  Per the maintainer's 2026-08-11 ruling (Option B on objectui#3765) the dialog is
  a small form, and its in-progress values are that record. The bulk dialog now
  passes them as `dependentValues` to the option widgets (`select`, `multiselect`,
  `radio`, `checkboxes` — the same allow-list the object form and the single-record
  action dialog thread the live record to). The evaluator is unchanged; this is the
  supply half that was missing.
  
  Bulk is the cheap case for that ruling, which is why it needed no separate one:
  an action over N selected rows has no single row record for the dialog's values
  to displace — the selection was never offered to these predicates, so the
  dialog's values are the only record there has ever been. What the supplied record
  does displace is the host page's, since it wins the chain outright: a predicate
  naming a column the dialog has no param for stays unresolvable, which fails open
  — the option is offered, never wrongly hidden.
- 2533ec5: The bulk-action dialog's "this widget needs a DataSource" rule now derives from the shared reference-field family instead of a fourth private copy.
  
  `packages/plugin-grid/src/components/bulkParamToField.ts` held its own
  `DATA_SOURCE_WIDGET_TYPES` — the fourth hand-maintained answer to one question
  ("which widget has to query records, so it must be handed a DataSource and a
  `reference_to`"), and the only one whose member set matched none of the other
  three: `lookup` / `master_detail` / `user`, against `@object-ui/core`'s
  `EXPANDABLE_FIELD_TYPES` (which also holds `tree`) and the object form's rule
  (which adds three widget-hint pickers). Nothing anywhere could detect the drift;
  the same shape objectui#4770 and objectui#4790 each closed on another surface.
  
  It now reads core's set through one predicate, so all three consumers of the rule
  — the label prefetch / option source (`isLookupishParam`), the `dataSource` prop
  the dialog threads into the widget (`fieldNeedsDataSource`), and the
  `reference_to` / `display_field` branch of `bulkParamToField` — cannot drift apart
  from each other or from the form again.
  
  No behaviour change on any reachable path, which is why this is a patch. The one
  member the two tables differed on, `tree`, can never be a widget key on this
  surface: it is absent from the fields widget map and `mapFieldTypeToFormType`
  sends it to `field:lookup`, so a `tree` param arrives at the rule as `lookup`
  (pinned). The divergence in the other direction is deliberately preserved: the
  form additionally wires `object-ref` / `filter-condition` / `recipient-picker`,
  widget hints no object schema can declare and no bulk param produces — absorbing
  them would change which widgets receive a DataSource here, which is a behaviour
  change and not a convergence.
  
  The pin is an identity pin, not a membership one: it spies on the `has` of the
  Set object core exports, so a member-identical private copy fails it. A
  value-equality assertion would have passed against exactly the defect this
  change removes.
- bbe8b86: The allow-list of option widgets that are fed the live record is now one exported constant, `CASCADE_OPTION_WIDGET_TYPES`, instead of three private copies.
  
  `select` / `multiselect` / `radio` / `checkboxes` are the widgets whose OFFERED
  option set is re-resolved against a record (per-option `visibleWhen`, plus the
  `dependsOn` gate), so they are the widgets a surface must thread its live record
  to. Three surfaces feed that one evaluator — the object form, the single-record
  action dialog and the bulk action dialog — and until now each carried its own
  private `new Set([...])` of the same four keys, with a comment in each asking the
  next person to change all three together. Nothing could have reported them
  drifting: every copy passed its own behavioural tests, and a divergence would
  have shown up only as one surface silently disagreeing with another about what
  "the record" is.
  
  The set now lives in `@object-ui/core`, next to `resolveCascadingOptions` — the
  evaluator that reads that record — because core is the one package all three
  surfaces already depend on, and it is re-exported from `@object-ui/fields` next
  to `resolveFormWidgetType`, whose output is the vocabulary the keys are written
  in. Both are the same object, pinned by test; each consumer keeps its own
  normalization (`normalizeFieldType` in the form, `resolveFormWidgetType` in the
  dialogs), which agree on these four members.
  
  No behaviour changes: the members are identical on all three surfaces, and the
  existing pins for each surface still assert the same records reaching the same
  widgets. The rationale that was repeated in the three copies — including the
  note that the widget-hint picker family (`filter-condition`, `recipient-picker`,
  the lookup family) reads a different sibling key off the same channel and is
  deliberately NOT in this set — is now stated once, in the constant's own
  documentation. Whether the action and bulk dialogs should ever feed those
  pickers stays an open question (objectui#4771), unchanged by this convergence.
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
- 3e0214c: `ObjectGrid`'s inline add-record row now honours `can(object, 'create')` (objectui#5148).
  
  The `create` face of the shape #5143 closed for `update`. `ObjectGrid` resolves
  `permissionUpdate` / `permissionDelete` through `perms.can(...)` and ANDs each
  into the affordance it governs, but the Airtable-style add-record row was gated
  on the author-declared `operations.create` **alone** — a flag that says whether
  the affordance was *wired*, never a permission grant. There was no
  `permissionCreate` in the component at all.
  
  The symptom is the one #5143 and #4646 each closed on a neighbouring surface: a
  principal with no `create` grant was offered the add row, filled it in, and was
  stopped only by the server's 403 — while the toolbar's New button on the very
  same screen had already hidden itself for that principal. No data ever landed
  (the server gate is solid); the cost was a round-trip the UI guaranteed would
  fail, and one component answering "may this user create records here?" two
  opposite ways at once.
  
  `showAddRow` is now the authored request **∧** the principal's verdict, the same
  conjunction #4646 / PR #5145 spelled for the related-list "+ New"
  (`affordances.create ∧ can(obj, 'create')`) with the operation moved to
  `create`. The authored key stays the gate's left half, so this narrows and never
  widens: no verdict turns the add row on for a grid that did not ask for it, and
  a grid declaring no `operations` block keeps falling through the
  `{ update: !!onEdit, delete: !!onDelete }` default that carries no `create` key.
  
  Fail-open is preserved, and is load-bearing rather than incidental here:
  `can()` answers `true` with no `PermissionProvider` mounted, and the verdict is
  skipped entirely when no object name resolves. `plugin-designer`'s
  `FieldDesigner` and `ObjectManager` both build grids with
  `operations: { create: true, update: true, delete: true }` when not read-only
  and typically render with no provider, so those surfaces are untouched — pinned
  by a dedicated test rather than left to inspection.
- 27c9cbd: `object-grid` now declares its `data` input as the object its contract actually
  accepts, instead of as an array (objectui#5090).
  
  The declaration published `{ name: 'data', type: 'array', label: 'Static Data',
  description: 'Inline rows, …' }` — which is the shape of `staticData`, the
  deprecated alias the objectui#4648 carve-out deliberately leaves unpublished,
  under the canonical key's name. The contract is
  `ObjectGridSchema.data?: ViewData`: the spec's discriminated union on
  `provider`, four strict object arms (`object` / `api` / `value` / `schema`),
  none of them an array.
  
  Both halves of that misdeclaration were user-visible. An author following the
  designer panel or the generated `sdui-intrinsics.d.ts` wrote `data: [ …rows… ]`
  and got a grid that renders but a document `tsc` rejects (TS2322) and spec
  parsing refuses; meanwhile the one form that satisfies both,
  `{ provider: 'value', items: [...] }`, was reported as `type-mismatch` by the
  save gate, because a declared `array` arm accepts only arrays. Writing the
  inline-rows form the README already documents now validates clean, and the
  designer labels the key `Data Source` with a description that names all four
  providers rather than only the deprecated shortcut's shape.
  
  The renderer is unchanged: a bare array is still honoured as back-compat
  (`getDataConfig` folds it to `{ provider: 'value', items }`), it is simply no
  longer advertised as authoring surface — the same standing `staticData` has.
  Authors who wrote the array shorthand keep working and will now see a
  `type-mismatch` hint pointing at the spec-valid spelling.
- b4089be: `ObjectGrid`'s `editable` schema key now honours the caller's `update` permission.
  
  A declaratively-authored `object-grid` block carrying `editable: true` opened
  inline editing for every principal, including one with no `update` grant. The
  component had already resolved that principal's verdict — `permissionUpdate =
  can(objectName, 'update')`, sitting a few lines above — but consumed it only for
  the row kebab; the three inline-edit props read `schema.editable` raw. One
  component therefore gave two opposite answers to "may this user write these
  records?" on the very same rows: the kebab correctly hid Edit, while a click on
  a cell dropped the user into an editor whose save could only earn a server 403.
  No data ever landed (the server gate is solid) — the cost was a round-trip the
  UI walked the user through knowing it would fail.
  
  `editable`, `renderCellEditor` and the save/cancel `rowActions` column now read
  one resolved verdict: the authored key AND the object's resolved affordance
  (ADR-0103 bucket, `userActions.edit`, and the server's effective API operations)
  AND the principal's own grant. This is the conjunction objectui#4647 used to
  close the same hole at the ListView layer; the SDUI-authored grid schema is a
  second, independent door into that state which never passes through ListView.
  
  Behaviour change, stated because it is one: a principal WITHOUT the `update`
  grant no longer enters inline edit on such a grid, and no longer sees the
  trailing save/cancel column that served it — that grid is now column-for-column
  the non-editable grid, which is what it always effectively was. Everyone with
  the grant is unaffected. The gate fails OPEN where there is no verdict to be
  had: `can()` answers `true` with no `PermissionProvider`, and a grid with no
  object name resolves the default-writable affordance, so standalone embeds, the
  Studio designer canvas and pure inline-data grids keep today's behaviour.
- b4bccc7: The list row kebab now ANDs the RECORD-level write verdict, not just the object-level grant (objectui#4296). A user holding a broad object grant under `writeScope: 'own'` was offered Edit and Delete on every row they could read, including rows the server refuses with `403 "You do not have access to this record"` — while the record detail header, which has folded the record-grained verdict since objectstack#3821, correctly hid both on the same record for the same user. `ObjectGrid` now asks the same authority the detail header asks (`security/explain`), batched once per (object, operation) for the rows on screen using the `recordIds` form from objectstack#8326, and feeds the answer through the row menu's existing per-row visibility decision — so a denied row loses its entries entirely rather than growing a disabled one, and grows no empty overflow trigger.
  
  Fails open on every uncertainty: a row with no verdict yet, an endpoint that is absent or failing, a row missing from the answer, or a row with no id keeps the object-level rendering this list had before. The server remains the authority; hiding a capability on missing data would be worse than the wasted click this removes. No public entry export changes.
- b29488f: The plugin-grid documentation-site page now spells keys the grid actually reads.
  
  `content/docs/plugins/plugin-grid.mdx` is the docs-site mirror of the README pass
  in objectui#5065, and carried the same defect end to end: the `### Grid` sketch,
  the column definition and every example block declared `type: 'grid'` with
  `header` / `accessorKey` columns.
  
  Bare `grid` is deliberately not this plugin's key — the `view:grid` registration
  passes `skipFallback: true` (`packages/plugin-grid/src/index.tsx`), because `grid`
  belongs to the CSS Grid *layout* container in `@object-ui/components`, whose
  `columns` is a column **count** rather than a column list. A reader copying an
  example therefore rendered a layout container, not a data grid. The registry
  confirms this in both plausible host import orders: `object-grid`,
  `plugin-grid:object-grid` and `view:grid` all resolve to `ObjectGridRenderer`,
  while bare `grid` resolves to the layout container.
  
  The column vocabulary was rejected rather than ignored: `ListColumnSchema`
  (`@objectstack/spec/ui`) is a **strict** Zod object, so `header` and `accessorKey`
  fail validation with `unrecognized_keys` — the identity key is `field` and the
  header is `label`. Likewise `object` is not a key (`objectName` is required and
  there is no `object`), `pagination` carried a `showSizeChanger` that the strict
  `PaginationConfig` rejects, `rowActions` was written as inline definitions with
  callbacks and then as `true` when it is a `string[]` of action names, and the
  top-level `sortable` / `filterable` switches have zero read points anywhere in the
  package — sorting is the per-column `ListColumn.sortable` and filtering is the
  metadata `filter` plus `searchableFields`.
  
  The five `on*` names were taught as schema keys; they are React props on
  `ObjectGridComponentProps`. A schema is a serialisable document and cannot hold a
  function, and the renderer never reads a callback off the schema.
  
  Every block is rewritten against the declared authoring surface
  (`GRID_QUERY_INPUTS`), matching the README pass so the two teaching surfaces no
  longer disagree. The TypeScript section additionally fixes the grid third of
  objectui#5086: it imported `GridSchema` / `GridColumn` from
  `@object-ui/plugin-grid`, and neither name is on that package's 49-name export
  surface — both are taken elsewhere by unrelated types (`GridSchema` in
  `@object-ui/types` is the CSS Grid layout container; `GridColumn` in
  `@object-ui/fields` is a column of the line-items form widget, keyed `name`). It
  now imports `ObjectGridSchema` / `ListColumn` from `@object-ui/types`, with no new
  re-export added to make the old path work.
  
  Documentation only — no renderer behaviour changes, and no capability was added to
  make an example true.
- 9fbb9b5: plugin-grid's README examples now spell keys the grid actually reads.
  
  Ten example blocks and the `### Grid` sketch documented an authoring surface that
  does not exist. Every one declared `type: 'grid'`, which is deliberately NOT this
  plugin's key — the bare `grid` registration is `skipFallback: true`
  (`src/index.tsx:193`), because `grid` belongs to the CSS Grid *layout* container in
  `@object-ui/components`. A reader copying an example therefore rendered a layout
  container, not a data grid, and its unrecognised props leaked into the DOM as
  invalid HTML attributes (objectui#4787 is that runtime symptom; this is its
  documentation-side cause).
  
  The keys inside those blocks fared no better. `sortable`, `filterable` and `object`
  have zero read points anywhere in the repo — sorting is per column
  (`ListColumn.sortable`), filtering is the metadata `filter` plus `searchableFields`,
  and the object is `objectName` (required). `onRowClick`, `onSelectionChange`,
  `onCellChange`, `onRowSave` and `onBatchSave` are React props on
  `ObjectGridComponentProps`; a schema is a serialisable document and cannot carry a
  function, and the grid builds the inner table's handlers itself rather than reading
  any callback off the schema. Columns were written `{ header, accessorKey }` against
  a **strict** `ListColumnSchema` whose column is `{ field, label, … }`; `data` was
  written as a bare row array against a `ViewData`; `pagination` carried a
  `showSizeChanger` that its strict config has no room for; and `rowActions` was
  written as inline definitions with callbacks, then as `true`, against a `string[]`
  of action names.
  
  Every block is rewritten to the declared surface (`GRID_QUERY_INPUTS`,
  `src/index.tsx:145`) and annotated `ObjectGridSchema` — the annotation is the point,
  since an un-annotated `const schema = { … }` type-checks whatever is written in it.
  Documentation only; no renderer behaviour changes, and no capability was added to
  make an example true.
- 90517e1: plugin-grid README: replace the fictional `gridComponents` manual-registration
  snippet and the `GridSchema` / `GridColumn` type names with this package's real
  export surface and the real data-grid types.
  
  Three assertions the README made about identifiers were not true of this package
  (objectui#5013):
  
  - `gridComponents` had zero hits anywhere in the repo. The snippet's
    `Object.entries(gridComponents).forEach(…)` threw `TypeError` on the first
    copied line. Registration here is a side effect of importing the entry, so the
    section is replaced by what actually happens: the keys the three real
    `ComponentRegistry.register(…)` calls claim, the 49-name export surface, and —
    for the case the snippet was reaching for — registering the exported
    `ObjectGridRenderer` under a caller's own key.
  - `GridSchema` and `GridColumn` were imported from `@object-ui/plugin-grid` as
    the data-grid schema and column types. Neither is on this package's export
    surface, and both names denote something else where they do exist:
    `GridSchema` in `@object-ui/types` is the **CSS Grid layout** container
    (`columns` there is a column count, not a column list), and `GridColumn` in
    `@object-ui/fields` is the **form line-items** widget's column (keyed `name`).
    The example is rewritten on the real types, `ObjectGridSchema` and
    `ListColumn` from `@object-ui/types`, with the component-props type
    `ObjectGridComponentProps` named as the thing row callbacks belong to.
  - The in-prose `interface GridColumn { header; accessorKey; … }` reference block
    made that absent name read like a real export, and contradicted this README's
    own Column Summaries section, which already documented columns as `field` +
    `summary`. It is replaced by the 14 keys of `ListColumn`, whose Zod
    declaration is strict — `accessorKey` / `header` are rejected, not ignored.
  
  Documentation only: no code, type or runtime change. `patch` because `README.md`
  is in the package's published `files`.
- e7747f1: fix(fields): retire the `owner` field-type alias with a loud tombstone
  
  `owner` was a synonym for `user` with zero behavioral delta — both resolved to
  the same `UserField` widget — and it is not a member of `@objectstack/spec`'s
  closed `FieldType`, so no object schema could ever declare it. It was reachable
  only through hand-written SDUI, and the three code faces that read it had
  already drifted apart on the word: the form's data-source rule excluded it,
  while plugin-grid's bulk-action dialog and app-shell's `paramToField` included
  it.
  
  The retired spelling now fails **loudly**. Deleting the alias on its own would
  have been absorbed by two silent tails (`mapFieldTypeToFormType`'s
  `|| 'field:text'` and `resolveFormWidgetType`'s `: 'text'`), each handing back a
  working plain text input with no check turning red — so anyone who had written
  `type: 'owner'`, including an AI author copying it out of a doc, would have
  shipped a text box believing they shipped a person picker. Instead:
  
  - `type: 'owner'` and `widget: 'field:owner'` both resolve to a registered
    tombstone widget that renders a visible refusal naming the migration;
  - the same prescription is written to the console once per spelling;
  - the read/cell path degrades to the text cell deliberately and says so.
  
  Migration: write the record-owner field as `{ type: 'user', name: 'owner' }` —
  the field NAME carries the ownership meaning, the type carries the widget.
  `UserField` and `UserCellRenderer` are unchanged; only the synonym is gone.
  
  Also corrects the `dataSource` TSDoc in `@object-ui/fields`, which listed `grid`
  among the widgets the form renderer wires a DataSource to. `GridField` never
  read `dataSource` and no data-source table ever contained the key.
- 2165d88: Rename four component-props types off the names `@objectstack/spec` starts owning in
  17.0.0, keeping the old spellings as deprecated aliases. No behaviour changes and no
  importer breaks.
  
  `@objectstack/spec/ui` exports `ObjectCalendarProps`, `ObjectFormProps`, `ObjectGridProps`
  and `ObjectKanbanProps` from 17.0.0, where each is the AUTHORED props document of the
  matching element — a serialisable authoring surface (`z.input< typeof
  ObjectGridPropsSchema >`). The same-named interfaces here are the RENDERERS' props: a live
  `dataSource`, records pre-fetched by a parent, and the host callbacks. Two different things
  under one word, so the local ones are renamed rather than derived, following the split this
  repo already made for `PageHeaderProps` -> `PageHeaderComponentProps` and the
  `Record*ComponentProps` family in `@object-ui/types`:
  
  | package | new name | old name |
  |---|---|---|
  | `@object-ui/plugin-calendar` | `ObjectCalendarComponentProps` | `ObjectCalendarProps` |
  | `@object-ui/plugin-form` | `ObjectFormComponentProps` | `ObjectFormProps` |
  | `@object-ui/plugin-grid` | `ObjectGridComponentProps` | `ObjectGridProps` |
  | `@object-ui/plugin-kanban` | `ObjectKanbanComponentProps` | `ObjectKanbanProps` |
  
  Every old name is still exported from its package barrel as a `@deprecated` alias denoting
  the SAME type, pinned per package by `spec-symbol-4650.test.ts`, so existing imports keep
  compiling. New code should use the `ComponentProps` spelling.
  
  `@object-ui/app-shell` carries no API change: its `SECRET_MASK` — the ADR-0100 credential
  read mask, which 17.0.0 moves into `@objectstack/spec/data` — is renamed to
  `OBJECTUI_SECRET_MASK` at its declaration in `views/metadata-admin/widgets.tsx`. That
  constant is package-internal and is not re-exported from the barrel, so nothing published
  changes; the rename exists so the local copy cannot be read as the spec's own definition
  while this repo is still pinned below the release that exports it.
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
  - @object-ui/mobile@17.6.0

## 17.5.0

### Minor Changes

- 7ffd616: fix(plugin-grid): cross-page "select all N matching" replays the host's real query — or abstains — instead of fanning out unfiltered

  `resolveBulkRows` re-issues the view's query in 500-record pages so a bulk action
  receives the whole match set rather than the visible window. The query it
  replayed came from `lastFindParamsRef`, whose only writer is ObjectGrid's own
  data loader. Under a host that fetches the rows itself — ListView passing `data`
  plus `manualPagination` and `rowCount`, which is what the console does — that
  loader never runs, so the ref was not the query behind the rows on screen:
  absent, or stale from an earlier own-fetch. Either way the `?? {}` default let
  the fan-out ask the server for the WHOLE OBJECT — no `$filter`, no `$orderby`,
  no `$search` — and hand up to 5000 unmatched records to a destructive executor
  (`onBulkDelete`) while the bar read "All N matching records are selected".

  The host now hands its query down as the new optional `findParams` prop on
  `ObjectGridExternalPaginationProps` (the same shape the internal loader stores),
  and the fan-out reads whichever side owns the fetch. There is deliberately no
  grid-side default: when no query is available for the current data path the
  escalation is **not offered at all** — a host that forgets `findParams` loses
  the affordance rather than silently collecting the whole object, which is what
  makes the unfiltered fan-out structurally unreachable rather than merely
  currently-wired-right. A changed `findParams` also resets the escalation,
  mirroring the `setSelectAllMatching(false)` the internal loader runs next to its
  own params write, so "All N matching" cannot survive the host's filter, search,
  sort or page changing; the comparison is by content, so a host re-render that
  rebuilds an equal object does not drop the user's escalation.

  The internal-loader path is unchanged: with the ref populated the fan-out issues
  the same params it always did, and the `selection.type: 'single'` suppression is
  untouched.

- 24bb2de: grid row menu — the built-in Edit/Delete predicate declarations are derived from the spec-owned authoring type, not hand-restated

  `packages/plugin-grid/src/components/RowActionMenu.tsx` carried its own `BuiltinRowActionPredicates` interface (`{ visibleWhen?: unknown; disabledWhen?: unknown }`) and read it at six declaration sites: both `RowActionMenuProps` predicate props, the shared `isBuiltinRowActionVisible` gate, both `planRowActionMenu` parameters, and the `BuiltinRowActionItem` component. Nothing tied any of them to the type whose values they receive, so a rename at the source would have left every one compiling against a shape that no longer existed — the objectui#3009 hand-copy family, and the mirror of what PR #4423 collapsed in the data-table.

  **Measured true source.** These predicates do NOT flow from `DataTableSchema.rowEditPredicates` / `rowDeletePredicates` — this surface is never handed those keys. `ObjectGrid` resolves the object's `userActions.edit` / `delete` through `resolveRowCrudAffordances`, which returns `CrudAffordances['editPredicates']` / `['deletePredicates']`: the spec-owned `RowCrudPredicates` (ADR-0103, `@objectstack/spec/data`), parsed in exactly one place and re-exported by `@object-ui/core`. Each site now derives from that — per-key `Pick` for the planner (visibility is all it decides), one union alias for the two consumers that serve both built-ins. Measured: with `visibleWhen` renamed at the source, the previous hand-written declarations produce ZERO diagnostics in this package while the derived ones fail to compile at the declarations themselves.

  **Graded `minor` rather than `patch`** because a published type narrows (the objectui#4403 criterion). `RowActionMenuProps.editPredicates` / `deletePredicates` move from `unknown`-valued keys to the spec's `Expression | ExpressionInput` — the authored CEL shorthand or its `{ dialect, source }` envelope — so a consumer passing an `unknown`-typed value, or a bare boolean, stops type-checking. No runtime consumer breaks and no behavior changes; `@object-ui/core` retired the same `unknown` imprecision at its own seam, and this was the last copy of it. (PR #4423's data-table twin stayed `patch` because `DataTableSchema`'s keys were already declared `unknown` — deriving there narrowed nothing.)

  No runtime code was changed, and the package's suite passes unchanged. Alongside it, the "a disabled item still counts toward the menu" rule gains the pin it never had where a user meets it: a row whose only action is `disabledWhen`-gated keeps its "⋮" trigger, and that trigger opens the item, present and `aria-disabled`. The two halves of that rule live in different functions, and each half's own test stayed green while the other regressed. The planner-level case that claimed to pin this is renamed to the verdict it actually decides — the planner never reads `disabledWhen`, so its fixture behaved identically to `{}`.

- 51ac39f: ObjectGrid's host-driven pagination mode is a declared interface instead of twelve `(rest as any)` reads

  `ObjectGridProps` declared twelve members while the component read twelve more out of `...rest`, each through an `as any` cast: `data`, `manualPagination`, `rowCount`, `page`, `pageSize`, `onPageChange`, `onPageSizeChange`, `sort`, `onSortChange`, `search`, `onSearchChange` and `onColumnStateChange`. They are not accidental — together they are the host-driven external-pagination path from framework#2212, where a host has already fetched one window of a larger collection and drives the page/sort/search controls itself, and the component's own comment said so. They were simply declared nowhere, so no call site could be checked against them and no editor could offer them.

  Nothing had caught it because the only untyped caller is `ObjectGridRenderer`, whose `{ schema: any; [key: string]: any }` index signature accepts anything; every typed caller happens to pass only declared props; and the test that exercises the path was compiled by nothing.

  They now live on a named `ObjectGridExternalPaginationProps`, which `ObjectGridProps` extends — a separate interface rather than twelve more members flattened into the authoring surface, so the "advanced host-driven mode" boundary stays visible. The eleven members that already have a counterpart on `DataTableSchema` — the type ObjectGrid forwards them to — are **type-derived** from that declaration (`Partial< Pick< DataTableSchema, … > >`) rather than hand-copied, so the two cannot drift apart; only `onColumnStateChange` is declared explicitly, because the table vocabulary reports per-event `onColumnResize` / `onColumnReorder` rather than the merged `{ order, widths }` layout this reports. `ObjectGridColumnState` is exported for that payload.

  Purely additive for callers: every member is optional, so existing code compiles unchanged, and hosts that were already passing these props now get them checked instead of silently accepted. Runtime behavior is unchanged.

### Patch Changes

- ae10a01: Console chrome reaches the bundle — the list switcher, the aggregate footer, the dialog a11y fallbacks and the whole Settings namespace screen stop being English on non-English consoles

  Six strings on the two screens a user looks at most were hardcoded English literals rather than bundle lookups, so they stayed English on every non-English console with nothing an app could author to change them. They are not object, field, view or action labels — no key in `TranslationData` reaches them — while the console's own bundle already ships zh-CN, ja-JP, es-ES, de, fr, pt, ru, ko and ar and translates hundreds of neighbouring strings. Omissions from an otherwise complete bundle, not a missing capability.

  **Two of the six needed no new keys at all, which is the more interesting half.** The list-view mode switcher named its nine visualizations from a private `VIEW_LABELS` table while `console.objectView.viewType*` — the same nine words — had been resolved through the bundle by the create-view picker for months; the switcher now reads those keys, so the picker's 「画廊」 and the switcher's 「画廊」 cannot drift apart in nine languages. The create/edit dialog's close button is the remainder of a fix that already landed: objectstack#5505 routed the `sr-only` close label through `common.close` for the two Shadcn-synced primitives, but `MobileDialogContent` is a hand-written wrapper outside that regeneration zone with its own close button, and it is exactly what `ModalForm` renders — so the dialog the report measured was the one place still announcing "Close" in English.

  The aggregate footer is the one the original report singled out: the **number** was already locale-formatted and the **prefix** was a hardcoded `Avg: ` / `Sum: `. All eleven aggregation kinds now take their prefix from `grid.summary.*`, and the label/value join is its own key rather than a `': '` baked into the renderer — the separator is translatable content, so zh sets a fullwidth colon and fr the French space-before-colon. The numbers are untouched. The form dialog's `sr-only` description fallback joins the packs too; it is clipped, not visible, so the only way an app could displace it was to author a `description` and thereby put a visible subtitle on every dialog.

  **The Settings namespace screen converts as one unit.** `SettingsView` routed zero framing copy through i18n — save/failure toasts, the env-lock and crypto refusals, the load-error card, the empty-route state, the navigation buttons, the unsaved-changes save bar — while its immediate sibling `SettingsHub`, in the same directory, resolved everything through `t('console.settingsHub.*')`. A zh-CN admin read correctly translated field labels sitting inside an English save bar, because `useSettingsLabel` translates a namespace's authored content but reaches none of the chrome around it. All of it now resolves through a `console.settingsView.*` namespace placed beside the hub's, including the crypto-refusal strings that objectui#4579 deliberately left in English rather than leave one translated string among a dozen literals.

  The save-bar counter was an English plural rule executing in every locale (`change` plus an `s` when the count exceeds one). It is now a real i18next plural family — base key plus `_one` and `_other` in all ten packs — not the `(s)` spelling translated nine ways. The base key is the load-bearing part: i18next asks `Intl.PluralRules` for the one suffix a language needs and, finding no such slot, falls back to English, so without it Russian would read English at counts 2-20 and Arabic at 2-99. Russian and Arabic take the "noun: {count}" form their packs already use for this exact reason, and the counter is verified rendering in-language at 1, 2 and 5.

  The Beta badge reuses the hub's existing key rather than minting a twin, and the refusal messages interpolate their subject through the bundle instead of concatenating a translated word onto an English prefix.

- 77d6f28: fix(plugin-grid): the cross-page "Select all N matching" banner works under external pagination

  `BulkActionBar`'s cross-page affordance was gated on ObjectGrid's `totalMatching`
  state, whose only writer is the component's own data loader. Under a host that
  fetches the rows itself — ListView passing `manualPagination` + `rowCount`, which
  is what the console does — that loader never runs, so the total stayed
  `undefined` and the banner was permanently absent for any match-set size, even
  though the pager two lines away was already rendering the correct page count from
  the host's total.

  The pager's derivation is now hoisted to a single `resolvedTotalMatching` value
  that both the pager and `BulkActionBar` consume, so the affordance reports the
  real server total on both paths. The `selection.type: 'single'` suppression is
  unchanged.

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

- 1f9b905: `exportOptions` is the spec's object form: `streaming` is declared, `'pdf'` is retired, and the alignment comment is finally true

  `ObjectGridSchema.exportOptions` carried four keys under a comment claiming alignment with `@objectstack/spec`'s `ListViewSchema.exportOptions`. The comment was false in both directions. The spec declared a bare format ARRAY, not an object, so no authored document could satisfy both spellings at once; and `ObjectGrid` read a fifth key — `streaming`, the opt-out that forces the client-side export path — which appeared in no declaration anywhere, reachable only through an `as any` cast in the renderer. An author had no way to discover the key except by reading the renderer's source, and no schema would have refused it or honoured it.

  objectstack#8010 closed that upstream by declaring `ListViewExportOptionsSchema` with exactly the five keys this renderer reads. This change lands the objectui half of the reconciliation:

  - The five keys are now one exported type, `ListViewExportOptions` — `formats`, `maxRecords`, `includeHeaders`, `fileNamePrefix`, `streaming` — shared by `ObjectGridSchema` and by a saved `NamedListView`, so the two authoring surfaces cannot grow apart. The comment above it names the spec symbol and version it mirrors, which makes it checkable rather than reassuring.
  - `streaming` is declared, and the renderer's `as any` casts are gone. Removing them against the old four-key type produced two `TS2339: Property 'streaming' does not exist` errors — that red is what the declaration fixes.
  - `'pdf'` is retired from the local format union, published as `ListViewExportFormat`. PDF export was declined platform-side (objectstack#1301 NOT_PLANNED) and the value left the spec's format enum in `@objectstack/spec` 17.0.0, where authoring it is now a parse-time refusal carrying `os migrate meta --from 16`. No ObjectUI path has ever produced a PDF: a declared `'pdf'` reached the user only as a browser console line.

  Runtime behavior of the export menu is unchanged. The filter that drops undeliverable formats is format-agnostic — it keeps what the active path can deliver — so it still hides `xlsx` when no server stream is available, and it still hides a legacy `'pdf'` that pre-17 stored metadata carries until the migration rewrites it. There was no `'pdf'`-specific branch to delete.

  Two guards keep the contract from re-opening. On the type side, a compile-time assertion pins the interface's key set to exactly the spec's five, so a sixth key fails the build. On the renderer side, a source scan collects every property `ObjectGrid` reads off `exportOptions` — through the alias it binds, and through any cast, since a cast is how `streaming` stayed invisible — and fails if the renderer reads anything the type does not declare.

  `@object-ui/types` is a minor: `ListViewExportFormat` and `ListViewExportOptions` are new exports, `streaming` is a new optional key, and `formats` no longer admits `'pdf'`. Anything still writing that value was authoring metadata the platform now refuses at publish.

- 51ab34e: ObjectGrid's bulk-bar **Clear** now unticks the row checkboxes, instead of only removing the toolbar

  Selecting rows and pressing Clear emptied the bulk-actions bar but left every row checkbox at `data-state="checked"` (the header checkbox stuck at `indeterminate` on a partial pick). The user was stranded on a page of ticked rows with no toolbar left to act on them, and the only way out was a reload or re-selecting and clearing through some other path.

  The selection lives in two places: `selectedRows`, which is the grid's own state and drives the toolbar, and the row checkboxes, which live inside the embedded data-table and only clear when `selectionResetKey` moves. `resetSelection()` writes all three, and the delete / dispatch / dialog-close paths have gone through it since the reset-key mechanism was introduced. Both `BulkActionBar` mount sites, however, hand-wrote their `onClearSelection` as `setSelectedRows([]); setSelectAllMatching(false);` — exactly `resetSelection()` minus the key bump — so Clear updated one source and left the other ticked. Both sites now call `resetSelection()`, so there is one reset for every path that clears a selection rather than three hand-copied ones, and the cross-page "all matching" state drops with it.

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

- 3e19fe7: i18n copy: one ellipsis glyph across the ten packs, `usted` in the es draft-preview empty state, and a pt sentence that stops contracting `de` onto its own hole

  Three locale-copy defects that no gate could see, because all three are _value_ defects on keys whose names, placeholders and key sets were already correct.

  **One ellipsis (objectui#3878).** `en` ended 33 values with three ASCII full stops (`Loading...`, `Ask anything...`) and 110 with the typographic ellipsis `…`, and the nine translation packs had copied `en` value by value — so a user could read both glyphs on one screen: `common.loading` beside `dashboard.loading`, `console.ai.askAnything` beside its own panel's siblings. All ten packs now spell it `…` (U+2026), per the maintainer-authorized consistency pass registered on objectstack#6015. 312 pack values changed: 34 in `en` (the 33 trailing plus the one mid-sentence `collaboration.commentPlaceholder`) and 278 across the nine. Eleven inline `defaultValue` call sites were re-synchronised with the new `en` text, which `scripts/check-i18n-call-site-keys.mjs` requires byte-for-byte.

  The convention is now pinned so the split cannot regrow: `packages/i18n/src/__tests__/ellipsis-glyph-3878.test.ts` fails, by key name, on any value in any of the ten packs that holds three ASCII full stops. It is deliberately wider than "a trailing `...` in `en`", because the census showed the narrow rule would have shipped with two holes in it — `collaboration.commentPlaceholder` puts the ellipsis mid-sentence, and `list.loading` had the packs wrong while `en` was already right, which no `en`-only rule can see.

  Fifteen module-local **no-provider fallback** entries were moved with the packs, across `useCollaborationTranslation`, `useFieldTranslation`, `useDetailTranslation`, `ObjectGrid`, `KanbanImpl`, `data-table` and `ConnectionStatus`. Those maps exist to render when no `LocalizationProvider` is mounted, and each one's own docblock requires it to stay byte-identical to the `en` pack — a requirement objectui#3440 already enforces mechanically for the collaboration map. Leaving them behind would have made the provider-less path disagree with the provider path on ten keys.

  **es `usted` (objectui#3875).** `preview.empty.notReadyDescription` said `Revisa la conversación` — the tú imperative — in a namespace that is otherwise 23:1 usted, and it renders _underneath the usted draft-preview banner at the same moment_, not before or after it. `Revisa` → `Revise`; nothing else in the sentence carries a register. The neighbouring `approvalsInbox` namespace is legitimately tú and was left alone.

  **pt contraction (objectui#3877).** `ConcurrentUpdateDialog` splits `detail.concurrentUpdateDescription` on `{{field}}` and renders a bolded label in the gap, and pt left a bare `de` in front of that gap. When the multi-field conflict branch passes the record label (`este registro`), Portuguese users read `de este registro` — a contraction error every native speaker sees, and one that no spelling of the leaf value could fix (`deste registro` renders `de deste registro`). The pt sentence is rewritten so the hole is preceded by the verb `afeta` instead of any preposition, which closes the whole class rather than trading `de` for an `em` or `a` that contract just as hard. pt only; `en` is unchanged.

  No behavior, no keys added or removed, no placeholder changed.

- f565418: fix(plugin-grid): the list link column renders a real anchor when the host publishes record URLs

  The list's `link: true` column (and the auto-linked primary field) rendered as
  a `span role="link"` with no `href`, navigating only through a click handler.
  So the surface users actually open records from had none of a link's native
  affordances — no middle-click / ⌘-click open-in-new-tab, no "copy link
  address", no hover status-bar URL — and `role="link"` without an href is a
  weaker contract for assistive tech than a real anchor. It was also the odd one
  out: the previous release gave record-detail and related-list lookup VALUES
  real anchors, leaving the list column as the weakest of the three surfaces.

  `LinkCell` now renders a real `<a href>` with the same click split: a plain
  left click is prevented and handed to the existing in-app navigation, so drawer
  / modal / page behavior is completely unchanged, while modifier and
  middle-clicks are left to the browser.

  The URL is not assembled in the grid. The object list page publishes its own
  record-URL builder through `RelatedRecordActionsContext.recordHref` — the same
  seam the lookup links use, and the same expression its "open in new window"
  action already navigated with, so the anchor and that action cannot address
  different records. A host that publishes no URL renders exactly what it
  rendered before: the Studio designer, embedded renderers and standalone grids
  are untouched.

  Neither package's published `dist/index.d.ts` changes (measured both ways —
  byte-identical), so this is a patch on both: the list host's new helpers are
  module-level exports behind a barrel that re-exports only `ObjectView`.

- 5e514c4: standalone ObjectGrid resolves off-spec `rowHeight` to compact, matching ListView and the spec bridge, instead of silently styling it as medium

  One component answered one question two ways. `ObjectGrid` seeded its density state with `schema.rowHeight ?? 'compact'`, so an ABSENT `rowHeight` landed on `compact` while an OFF-SPEC one skipped every arm of the density ternaries and came out at their terminal `else` — the `medium` styling. That is the absent-vs-off-spec split objectui#4440 removed from `ListView`, and it made a standalone grid the third answer to a question the rest of the system had already settled: `@object-ui/core`'s `rowHeightToDensityMode` abstains for an off-spec value, the `@object-ui/react` spec bridge abstains, and `ListView` defaults the abstention to `compact`. Off-spec now renders exactly like absent, everywhere.

  Only a standalone grid was affected. When `ListView` owns the grid it overwrites the prop with a value derived from `density.mode`, so nothing off-spec survives that hop.

  The narrowing happens at the state boundary, not in the ternaries. `medium` is still a real row height with its own styling arm, and a leaf renderer's terminal `else` is still legitimate styling — what changes is that nothing unrecognized can reach it. Membership is tested against `ROW_HEIGHT_TO_DENSITY_MODE`, so the admitted values keep one definition in the repo and the build fails if the spec grows a sixth row height without teaching the resolver about it. Both entry points go through the resolver: the initial state and the effect that re-syncs when the `rowHeight` prop changes.

  Two off-spec spellings behaved differently before this, which the report of the defect did not distinguish, and the boundary fix covers both:

  - A plain off-spec value (`'garbage'`) was not a key of the toolbar's row-height icon map either. That map is looked up by the same unvalidated state, so `rowHeightIcons[mode]` was `undefined` and rendering `<RowHeightIcon />` threw `Element type is invalid` — a standalone grid with an off-spec `rowHeight` did not render at all, rather than rendering as `medium`. The toolbar is shown precisely when `schema.rowHeight` is defined, so the crash and the off-spec case coincide exactly.
  - A prototype member (`'toString'`) WAS reachable through that map's prototype chain, resolving to `Object.prototype.toString` — a function, which React accepts as a component — so it survived to the ternaries and rendered as `medium`, the defect as filed. The resolver uses `hasOwnProperty` rather than `in` for this reason, the same reason `@object-ui/core` does.

  Both are now inert: the state can only ever hold one of the five admitted row heights, so the icon lookup is total and the ternaries never fall through.

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

- 4270c11: ObjectGrid's record-detail date fallback follows the display locale
  (objectui#4541).

  `renderRecordDetail`'s type-inference fallback rendered date-like values with
  a bare `formatDate(value)` — no options at all. `formatDate` then handed `Intl`
  an `undefined` tag, and `undefined` is not "the user's locale", it is the
  **machine's**, which is neither of the repo's two locale channels. On a `zh`
  console that one cell rendered `Mar 15, 2024` while every neighbouring date
  cell rendered `2024年3月15日`.

  This was the third `formatDate` site in the file. objectui#4272 (PR #4544)
  ruled its plugin-grid surface to "ONLY the two date-cell call sites" — the two
  that pass `'short'` in the mobile card view — and this one was never among
  them, so it was filed rather than fixed there.

  The fix is pure consumption, not plumbing: the component already reads
  `useDisplayLocale()` at component level (landed in PR #4544), and
  `renderRecordDetail` is a plain arrow in the component body that already closes
  over `tenantCurrency` from that same scope, so the call site simply gains
  `{ locale: displayLocale }`. No hook was added, and the function is not
  memoized, so there is no dependency array to keep in step.

  One resolver everywhere, as before: `useDisplayLocale()` (tenant regional
  default → active UI language → `'en'`). English output is byte-identical — the
  runner's `en-US` and `en` agree on this branch — and the two `'short'` cells
  PR #4544 threaded are untouched.

  `patch` rather than `minor`: the package's own `.d.ts` files are byte-identical
  across the change, so this is module-local (the objectui#4496 precedent).

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
- Updated dependencies [c911544]
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
  - @object-ui/permissions@17.5.0
  - @object-ui/mobile@17.5.0

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

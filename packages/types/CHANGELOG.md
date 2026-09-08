# @object-ui/types

## 17.7.0

### Minor Changes

- 6a91586: Retire the `ActionCondition` `{ expression, then, else }` branch shape from
  `ActionSchema.condition` (objectui#3917, maintainer ruling 2026-08-09 route B,
  enforce-or-remove).
  
  `@object-ui/types` declared `condition` as a branch DSL — `expression` plus `then` /
  `else` sub-actions — and shipped a zod mirror (`ActionConditionSchema`) that accepted it.
  **Nothing ever read `expression`, `then` or `else`**: a repo-wide grep for
  `condition.expression|then|else` has zero non-test hits. The only consumer of the key is
  `ActionRunner.execute`, which reads it as a **predicate gate** (boolean / bare CEL /
  `${...}` template / `{ dialect, source }` envelope). A branch object carries no `source`,
  so the runner's normalizer read it as "no gate declared" and executed the action
  unconditionally: the predicate was never evaluated, `then` / `else` were never dispatched,
  and `os validate` / `os build` stayed green with zero diagnostics. Two docs pages taught
  the shape with worked examples, so an author following the documentation
  ("amounts over 1000 go to manager approval") got unconditional execution.
  
  What changes:
  
  - `ActionCondition` is removed from `@object-ui/types` (and from the barrel export).
  - `ActionSchema.condition` is retyped to the predicate the runtime actually honours:
    `boolean | string | { dialect?: string; source: string }` — the same three arms
    `ActionRunner`'s own `ActionDef.condition` carries, and the same vocabulary `visible`
    and `disabled` use.
  - `ActionConditionSchema` is removed from `@object-ui/types/zod` (and from the zod
    barrel); the `condition` key now validates against that predicate union.
  - The two teaching sites (`content/docs/core/enhanced-actions.mdx` Conditional Execution,
    `content/docs/api/schema-reference.md` ActionSchema table) are rewritten to the live
    vocabulary: `condition` is a gate; a branch is expressed as separate actions with
    mutually exclusive `condition`s.
  
  **The zod parse verdict flips in both directions**, measured on `origin/main` @ `2aff580b5`
  against this branch: the branch object went from **accepted** to **refused**
  (`invalid_union` on `condition`), and every live predicate spelling — `false`,
  `'data.amount > 1000'`, `'${data.amount > 1000}'`, `{ dialect: 'cel', source: ... }` —
  went from **refused** to **accepted**. The old schema required `expression`, so the shape
  the runtime honours was the one the schema rejected.
  
  **Breaking for TypeScript authors of `ActionCondition` and for metadata authoring
  `condition: { expression, then, else }`** — marked `minor` per this repo's
  version-alignment rule, which reserves `major` for following `@objectstack` across a major
  (AGENTS.md 版本号策略; same classification as the `MobileOverrides` retirement,
  objectui#4919). Runtime behaviour is unchanged: an authored branch object did nothing
  before and does nothing now. What changes is that the contract no longer claims otherwise
  — the mistake now surfaces at authoring time as a type error and a named zod refusal,
  instead of a silent no-op that type-checks, validates and runs the action anyway.
- a04d7c6: Mint the `box` component type — the class-transparent neutral block container
  (objectui#3965, maintainer ruling 2026-08-29 方案 A).
  
  The JSON authoring vocabulary had no neutral block box, which is why the
  deprecated `div` could never actually retire: every replacement the deprecation
  notice names injects layout of its own (`container` adds width/centering and a
  responsive padding ramp, `flex`/`stack` add a display mode and gaps, `grid` adds
  `grid-cols-*`, `card` adds border/shadow and wraps children in a `CardContent`
  element — all measured through the real `SchemaRenderer`). `box` closes that
  gap with a three-clause contract, pinned in
  `packages/components/src/renderers/__tests__/box-neutral-container.test.tsx`:
  
  1. renders `children`;
  2. authored `className` passes through **verbatim**;
  3. **zero** injected classes.
  
  Deliberately unlike `div`, `box` reads `children` only — never `schema.body`.
  The `div` renderer's `children || body` fallback is what made a mechanical
  `div`→X swap silently drop content on `body`-authoring nodes while the element
  count stayed unchanged; content moves into `children` at migration time (the
  objectui#6771 B-ruling direction).
  
  Landed on both contract faces per the zod-mirror-parity pairing (objectui#6424
  family form): `BoxSchema` interface in `@object-ui/types`, its zod mirror in
  `@object-ui/types/zod`, the `SchemaRegistry['box']` entry, and the registry
  registration (`namespace: 'ui'`, `isContainer: true`). With `box` landed, the
  catalog's 25 remaining `div`-authoring fixtures (80 nodes) migrate to it
  mechanically with zero render difference, and the catalog ratchet closes to
  zero tolerance for JSON-authored `div`.
- d88e20f: Removed the block schema family (objectui#4895, ADR-0049 enforce-or-remove, maintainer
  ruling 2026-09-02 — option C1, retire the family in one change, no transition window).
  
  **Breaking on a published surface, deliberately.** These names are gone from
  `@object-ui/types`, from both subpaths that carried them:
  
  - `.` (types): `BlockSchema`, `BlockSlot`, `BlockLibrarySchema`, `BlockEditorSchema`,
    `BlockInstanceSchema`, plus the support types with no other reader — `BlockVariable`,
    `BlockMetadata`, `BlockLibraryItem` — and `ComponentSchema`.
  - `./zod` (runtime validators): `BlockVariableSchema`, `BlockSlotSchema`,
    `BlockMetadataSchema`, `BlockSchema`, `BlockLibraryItemSchema`, `BlockLibrarySchema`,
    `BlockEditorSchema`, `BlockInstanceSchema`, `ComponentSchema`, and the
    `BlockComponentSchema` union over them — which was also `AnyComponentSchema`'s block arm.
  
  The zod half is the one that mattered. `AnyComponentSchema.safeParse({ type:
  'block-library' })` returned **success** on 17.6.0 for a node no page can render, so an
  author who copied the documented shape was told green by the shipped validator and then got
  the registry's `OBJUI-001` "Unknown component type" panel. Validated-then-broken is worse
  than never-validated, because the green light is what the author trusted. All five
  discriminants — `block`, `block-library`, `block-editor`, `block-instance`, `component` —
  are now **refused**, pinned in `phase2-schemas.test.ts` alongside the theme refusals
  retired the same way.
  
  Evidence the family was declared-but-unenforced: zero `ComponentRegistry.register(...)`
  sites claimed any of the five keys (positive control `'table'` resolves to two), zero
  renderers, and zero readers outside `packages/types/src`. The liveness pass this card's
  earlier deferral was keyed to (objectui#6935) established that external consumption of this
  package is structurally unmeasurable — the certainly-live control `TableSchema` returns the
  same zero external consumers — so the ruling was taken on the evidence in hand rather than
  on a deferral whose exit cannot fire.
  
  ⚠️ **Not this family, and not touched.** The live slotted record-page vocabulary —
  `PageNodeSchema.kind === 'slotted'` with `slots?: PageSlotMap` (`packages/types/src/layout.ts`),
  rendered by `usePageAssignment` / `PageBlockCanvas` / `PageBlockInspector` in
  `@object-ui/app-shell` — shares the words "block" and "slot" with the retired family and
  shares no declaration, type or file with it. Neither is the `type: 'component'` NAVIGATION
  item kind (`{ type: 'component', componentRef }`, `NavigationItemSchema` in
  `zod/app.zod.ts`), a different declaration in a different module.
  
  `@object-ui/components` carries one forced consequence: `renderers/feedback/empty.tsx`
  annotated its `action` child as the retired `ComponentSchema` and now says `SchemaNode`,
  the node type `SchemaRenderer` actually takes.
  
  `packages/types/src/blocks.ts` and `packages/types/src/zod/blocks.zod.ts` are kept as
  ADR-0049 tombstones exporting nothing, and `block-family-retired-4895.test.ts` pins every
  retired name out of them. `content/docs/blocks/block-schema.mdx` is deleted with the family,
  and objectui#7023 — the narrower validator-only fix — dissolves into this retirement.
- 2d7304d: Retire the `MobileOverrides` type and its `mobileOverrides` mount point (objectui#4919,
  maintainer ruling 2026-08-19, ADR-0049 enforce-or-remove).
  
  `MobileOverrides` published a six-key mobile override surface — `layout`, `columns`,
  `useBottomSheet`, `fullScreen`, `touchTarget` and a three-value `navigation` vocabulary
  (`'bottom-tabs' | 'hamburger' | 'drawer'`) — from `@object-ui/types` and, re-exported,
  from `@object-ui/mobile`. Nothing read any of it. Measured on current `main`: the type had
  exactly four mentions repo-wide — its own declaration, the single
  `MobileComponentConfig.mobileOverrides` mount point, and the two barrel re-exports — and
  the lower-case property name (the spelling a renderer would actually read) appeared only
  in that declaration. No renderer, hook or adapter resolved it, and a sweep of the example
  apps and the `objectstack` sibling checkout found zero authors. The three `navigation`
  values were three spellings of the same no-op.
  
  The declared surface is removed rather than narrowed. The #3985 lineage's rule is "narrow
  to the implemented values"; here the implemented set is empty, so that rule terminates in
  deletion — a config that type-checks, builds and silently does nothing is the
  declare-without-enforce shape the platform doctrine forbids.
  
  Removal rather than a `?: never` tombstone follows this package's own discriminator. A
  tombstone exists to steer authors to a named live replacement — `crud.ts` `confirm` →
  `confirmText` (objectui#4314), `data-display.ts` `hoverable` / `striped` → `data-table`
  (objectui#5474) — or to keep a key loud that the docs had actively taught as working.
  Neither applies: there is no replacement key to steer to, no documentation ever described
  the surface, and there is no successor spelling. That is the same zero-pull, no-successor
  shape as the retired `AccordionItem.icon` (objectui#4652) and `ToggleGroupItem.icon`
  (objectui#4632), both of which were removed outright rather than tombstoned.
  
  **Breaking for TypeScript authors of `MobileOverrides` / `mobileOverrides` only** (marked
  `minor` per this repo's version-alignment rule, which reserves `major` for following
  `@objectstack` across a major — see AGENTS.md's 版本号策略, and the identical
  classification used for `AccordionItem.icon`). Runtime behaviour is unchanged: an authored
  `mobileOverrides` did nothing before and does nothing now. What changes is that the
  contract no longer claims otherwise, so the mistake surfaces at authoring time — importing
  the type is now a "has no exported member" error, and authoring the key on a
  `MobileComponentConfig` object literal is an excess-property error, instead of a silent
  no-op that type-checks and builds.
  
  If real mobile-override renderer work is ever wanted it re-enters deliberately, as designed
  product surface on its own card, with the renderer landing in the same change as the
  declaration — not by resurrecting this declaration.
- 636b236: `navigateOnSuccess` is relative-only, escapes the interpolated id, and is deprecated in favour of `submitBehavior`
  
  The url contract for this key was undeclared: it was same-origin-guarded (so a same-origin
  ABSOLUTE value was accepted), it interpolated `{id}` / `{recordId}` without escaping the
  substituted value, and nothing said which of those was intended. The maintainer ruled it on
  2026-08-17: `navigateOnSuccess` is the pre-ruling ancestor of the `submitBehavior` family
  rather than a second dialect, so as a compat alias it runs under the semantics
  objectstack#7496 ruled for that family.
  
  **Relative paths only.** A same-origin absolute such as `https://own-host/record/{id}` is
  now refused like any other out-of-contract value, rather than accepted and navigated at
  browser level. The destination is authored metadata, which is exactly where an address
  somebody else chose gets copied in. Cross-origin and protocol-relative values were already
  refused and still are; every relative shape that worked before still works.
  
  **The interpolated id is URL-escaped.** `/r/{id}` with an id of `a/b c` resolved to
  `/r/a/b c`, silently growing a path segment, and a template of `{id}` let the id become the
  whole destination. The substituted value now goes through `encodeURIComponent`, so a token
  is a value in the path and never a way to add path structure. The template is the author's
  and is untouched — only the id, which is data read off the written record, is escaped.
  
  Both halves are needed and neither implies the other: relative-only is a rule about where a
  destination starts, so it cannot see structure injected further along; escaping runs only on
  the substituted value, so it cannot see an absolute the author wrote out.
  
  This can only narrow what is reachable. Every destination the key now accepts is a relative
  reference, and a relative reference cannot carry an authority, so it was already accepted by
  the same-origin guard this replaces — no value that was refused is now followed. With every
  accepted destination relative, the browser-level `window.location.assign` fallback at both
  call sites became unreachable and was removed; an accepted destination goes to the injected
  navigation seam, and the absent-seam fallback inside the shared hook is unchanged.
  
  **Deprecation.** `navigateOnSuccess` is marked `@deprecated` in favour of `submitBehavior`,
  which already takes precedence over it and carries the richer `{{record.field_name}}`
  interpolation. The `{id}` / `{recordId}` dialect keeps working for forms that already
  declare it — the ruling converges the documentation and the semantics, not the spelling.
- d2fb6ef: **BREAKING (authoring): `ui:icon` names its glyph with `icon`, not `name`**
  
  `{ "type": "icon", "name": "check" }` no longer renders an icon. Write
  `{ "type": "icon", "icon": "check" }`. Stored metadata authored before this
  release needs converting — see the migration below.
  
  Marked `minor` per AGENTS.md §版本号策略 (this repo never publishes `major`
  outside an `@objectstack` major sync); the break is real and is stated here.
  
  **Why**
  
  `name` is the SDUI identity key every authored node carries, alongside `id` —
  it is not `ui:icon`'s private prop. So an ordinary node like
  `{ type: 'icon', id: 'save_icon', name: 'save_icon' }` asked lucide for a glyph
  called `SaveIcon`, missed, and rendered **nothing at all**: silent to a human,
  and clean to a DOM gate, because a renderer that renders nothing spreads no
  attributes to find. `action:*` already reads `icon`, so this is the vocabulary's
  existing answer, and it leaves no node type on which the identity key is
  unusable.
  
  **What changed**
  
  - `IconSchema` (types + its zod mirror) declares `icon: string` **required**,
    exactly as `name` was required before it — a key rename at constant
    strictness. `name` reverts to the optional identity inherited from
    `BaseSchema`. The mirror previously *required* `name`, which is why the
    renderer could not be migrated on its own: the published contract refused the
    correct shape.
  - `ui:icon` resolves its glyph from `schema.icon`. There is deliberately **no**
    `icon ?? name` fallback: a key meaning "identity" or "glyph" depending on
    whether a lucide lookup happened to hit is the ambiguity being removed.
  - The registry's `inputs` entry and `content/docs/components/basic/icon.mdx`
    moved in the same change as the resolver.
  - All 98 authored icon nodes in this repo are converted.
  
  **The break is loud in three places, never silent**
  
  1. `IconSchema` **refuses** a legacy node, with a message that names the rename
     and points at the converter — not zod's default `expected string, received
     undefined`.
  2. A legacy node that reaches the renderer unvalidated draws the visible
     placeholder shipped in the previous release, and its `console.warn` now
     carries the exact rename (`icon: "save_icon"`) plus the converter's name.
     Its accessible name says so too, and it gains a
     `data-objectui-icon-legacy-name-key` marker so a gate can tell
     "unmigrated node" from "glyph that does not resolve".
  3. **Migration for stored metadata** — `migrateIconNodeKeys` from
     `@object-ui/types`:
  
     ```ts
     import { migrateIconNodeKeys } from '@object-ui/types';
  
     const { document, converted, warnings } = migrateIconNodeKeys(storedPage);
     if (warnings.length) console.warn(warnings.map((w) => w.message).join('\n'));
     if (document !== storedPage) await save(document);
     ```
  
     It walks the whole document and lifts `name` to `icon` on every icon node.
     It is a one-shot conversion a deployer runs over stored documents — **not** a
     read-path fallback; nothing calls it during rendering or parsing. It
     **reports rather than guesses** for the two cases it will not touch: a node
     already declaring both keys (`icon` wins, `name` stays the identity it is),
     and a node naming no glyph at all.
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
- 41df893: `ObjectTrigger` and `ObjectRelationship` are removed from `@object-ui/types` — two
  hand-written interfaces orphaned by the `ObjectSchemaMetadata` derivation
  (objectui#5859, triage adjudication 2026-08-24; the derivation itself was
  objectui#5362).
  
  **Breaking for anyone importing either name.** The two symbols are, verbatim:
  
  - `ObjectTrigger` — the `{ name, when, on, condition?, action, config? }` trigger
    configuration
  - `ObjectRelationship` — the `{ name, object, type, foreign_key?, cascade_delete? }`
    relationship configuration
  
  Both existed solely to type members of the retired hand-written object-document mirror:
  `triggers?: ObjectTrigger[]` and `relationships?: ObjectRelationship[]`. objectui#5362
  replaced that mirror by deriving `ObjectSchemaMetadata` from `@objectstack/spec/data`'s
  `ServiceObject`, and the spec's object document declares neither member — so the two
  interfaces have had nothing to type since. objectui#5362 deliberately left them standing
  because cutting published exports is a separate decision from the ruled derivation; this
  is that decision.
  
  Measured before removing, on `main`: zero references in this repo outside the declaration
  and the `src/index.ts` re-export (`packages/`, `apps/`, `examples/`, `*.ts`/`*.tsx`,
  `node_modules` and `dist` excluded), and zero in the sibling `objectstack` checkout, which
  does import `@object-ui/types` in eleven files. Absence of a spec correspondence was
  verified at type level against the installed `@objectstack/spec` 17.2.0 rather than
  inherited from the card: neither `triggers` nor `relationships` is a key of
  `ServiceObject`. `DataModelDesigner`'s `relationships` state is its own local model and
  never referenced these types.
  
  **That measurement cannot see npm.** In-repo zero is not consumer zero — an external
  application importing either name from `@object-ui/types` will fail to compile after this
  release, and nothing in this repository can detect that. Both names are spelled out above
  so a host can search its own sources for them. If you were importing either, the shapes
  were client-side vocabulary with no runtime behaviour and no spec backing: copy the
  interface into your own code, or model the concept against `@objectstack/spec`, which owns
  the object document.
  
  Type-only change; nothing is emitted and no runtime behaviour moves. Ships `minor`, not
  `major`, per the version-alignment convention in AGENTS.md — objectui's major tracks
  `@objectstack`'s, and breaking changes of objectui's own carry `minor` with the semantics
  stated in the body.
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
- 1ec291c: Retire `ComponentInput.inputType` — the fifth and last key objectui#5905 named (ADR-0049
  enforce-or-remove, maintainer ruling 2026-08-31, option B).
  
  `inputType` was held back when `min` / `max` / `step` / `placeholder` were retired, because
  its defect was a different one. Those four were declared-and-UNREAD. `inputType` was
  declared-and-DROPPED: the repository really did author it — `packages/plugin-markdown`
  wrote `inputType: 'textarea'` on its `content` input, pinned by that package's own test —
  while the manifest serializer dropped it. Retiring it therefore had to decide what that
  registration should say instead, which is the fork the card reported and the ruling closed.
  
  FROM → TO:
  
  - `inputType?: string` → **tombstoned** (`?: never` on the interface, `retirementTombstone()`
    named refusal on the Zod mirror). Put the control hint in `description`, which IS
    published.
  - `plugin-markdown`'s `inputType: 'textarea'` write → **deleted**, at zero capability cost.
  
  The write was measured as a no-op before it was deleted, and re-measured on this branch's
  base rather than inherited from the card. A structural census over every `inputs:` array in
  the repository (211 regions, all tracked TS/TSX/JS sources) scores `inputType` at exactly
  ONE authoring site — the `plugin-markdown` registration — against `name` 953, `type` 969,
  `label` 966, `description` 194, `enum` 119, `required` 86 and `binding` 4 in the same pass
  over the same regions, so the instrument was not blind. The other 192 in-repo `inputType`
  hits are a DIFFERENT face: `FormField.inputType` (`zod/form.zod.ts`), the text-input
  renderer's prop, and `SchemaBuilder.inputType`, none of which sit on a `ComponentInput`.
  The publication path is unchanged and was re-confirmed: `packages/sdui-parser/src/index.ts`
  forwards exactly six keys per input — `name`, `type`, `required`, `enum`, `binding`,
  `description` — so an authored `inputType` could not reach the published
  `sdui.manifest.json` even in principle.
  
  Option A — teach `sdui-parser` to forward the key — is REFUSED on record. The only thing
  that looked like demand for it was a write that had never taken effect, and a write nothing
  reads is not demand for a feature. The neighbouring 2026-08-17 expression-ceiling ruling
  (quoted on `ComponentInput.type`) is untouched and stays deferred, with its reopen
  condition — a measured case of an author shipping a spec-rejected value objectui's silence
  let through — unchanged.
  
  Deleting the member outright was again the option NOT taken, for the reason the four
  siblings established: `ComponentInputSchema` is a non-strict `z.object`, so an undeclared
  key is silently STRIPPED. The tombstone is what converts a write from OUTSIDE this
  repository — the half objectui#5905 could not measure — into a named refusal carrying its
  own remedy, with `code: 'invalid_type'` and the key named in the issue `path`.
  
  Accept-set change, stated plainly for reviewers: a document that sets `ComponentInput.inputType`
  used to parse GREEN (the value was then dropped by the serializer) and now parses RED. That
  is the intended effect and the reason this carries a contract-review label.
  
  Three pins were FLIPPED rather than deleted, so the closure stays asserted instead of
  becoming a silent absence: `plugin-markdown`'s `index.test.ts` (which asserted the write)
  now asserts the key's absence plus a `tsc` refusal at that package's own authoring site,
  and the two fork-half controls in
  `packages/types/src/__tests__/component-input-retired-constraint-keys.test.ts` — one
  type-level, one parse-level — now assert refusal where they asserted liveness.
  
  Stale wording corrected in the same pass, because this change falsifies it: `base.ts` and
  `zod/base.zod.ts` both said the fork was "recorded for a ruling; until then this stays a
  live, writable key", and `widget.ts` called it "the open fork". All three now record the
  ruling. A reader who greps the source instead of the card thread was meeting an open fork
  that no longer existed.
- 453dbaa: Retire `ComponentInput`'s four inert constraint keys — `min`, `max`, `step` and
  `placeholder` (objectui#5905, ADR-0049 enforce-or-remove).
  
  All four were declared on `ComponentInput` and read by nothing, on either path. No consumer
  reads them off a `ComponentInput` value, and the manifest serializer
  (`packages/sdui-parser/src/index.ts`) forwards exactly six keys per input — `name`, `type`,
  `required`, `enum`, `binding`, `description` — so a value authored here could not reach the
  published `sdui.manifest.json` even in principle. Re-measured on this branch's merge-base
  rather than inherited from the card: a structural census over every `inputs:` array in the
  repository (219 regions, all tracked files) scores `min` **0**, `max` **0**, `step` **0**
  and `placeholder` **0**, against `name` 926, `type` 926, `description` 161, `enum` 114 and
  `required` 87 in the same pass over the same regions — the instrument was not blind.
  
  FROM → TO, per key:
  
  ⚠️ The four are **TOMBSTONED, not removed** — the declaration stays, the key becomes
  unwritable. An earlier draft of this list said "removed", which contradicted the paragraph
  below it and described the option this change deliberately did NOT take.
  
  - `min: number` → **tombstoned** (`?: never`, named Zod refusal). Spell the numeric domain
    out in `description`, which IS published (`'A positive integer — the contract rejects 0
    and fractional values'`).
  - `max: number` → **tombstoned**. Same remedy.
  - `step: number` → **tombstoned**. Same remedy.
  - `placeholder: string` → **tombstoned**. Put the hint in `description`. ⚠️
    `BaseSchema.placeholder` — the node-level prop a renderer does read — is a DIFFERENT key
    and is unaffected.
  
  The retirement kit: `?: never` on the interface (`packages/types/src/base.ts`), so authoring
  one is a `tsc` error at the registration site; `retirementTombstone()` on the Zod mirror
  (`packages/types/src/zod/base.zod.ts`), so an authored value is REFUSED at parse time with
  `code: 'invalid_type'`, the key named in the issue `path`, and the migration note as the
  message. Deleting the members outright was the option NOT taken: `ComponentInputSchema` is
  a non-strict `z.object`, which strips an undeclared key silently — one silent no-op traded
  for another. Pinned in
  `packages/types/src/__tests__/component-input-retired-constraint-keys.test.ts`.
  
  Two limits worth stating rather than papering over:
  
  - The in-repo zero is what was measured. Whether anything OUTSIDE this repository writes
    these keys is **not measurable from here** (the same limit objectui#5674 recorded for
    `PluginComponentInput`). Converting such a write from a silent drop into a named refusal
    is exactly what the tombstone buys.
  - The fifth key objectui#5905 named, `inputType`, is **NOT retired here**.
    `packages/plugin-markdown` authors it (`inputType: 'textarea'`), so it is
    declared-and-DROPPED — a different defect that needs a ruling, not a removal. That
    ruling landed on 2026-08-31 and `inputType` is tombstoned in the follow-up change; this
    note records the state as of THIS change, which is what a changeset is for.
  
  This is not a verdict that constraint slots on `ComponentInput` were a mistake. The
  neighbouring `type` field carries a maintainer ruling of 2026-08-17 recording that giving
  `ComponentInput` real constraint slots was **deferred, not rejected** — `min`/`max`/`step`
  read exactly like the slots that ruling declined to add. What is retired is this inert
  spelling; the ruling's own reopen condition still stands.
- 69a2163: **`@object-ui/types/zod` now accepts seven spellings its own TypeScript declarations already declared**
  
  Seven keys across five hand-written zod mirrors refused values the published TS
  types invite and the renderer implements — `declared !== enforced` on a published
  validator. The mirrors are widened to their declarations. Nothing is narrowed and
  nothing previously accepted is rejected, so this is additive for every author and
  every host: schemas that parsed before still parse.
  
  The newly-accepted spellings, so a host can search for them:
  
  | schema (`@object-ui/types/zod`) | key | now also accepts |
  |---|---|---|
  | `ButtonGroupSchema` | `variant` | `secondary`, `destructive`, `ghost`, `link` |
  | `ButtonGroupSchema` | `size` | `icon` |
  | `ObjectChartSchema` | `chartType` | `column`, `horizontal-bar`, `donut` |
  | `FormSchema` | `validationMode` | `onTouched`, `all` |
  | `SelectSchema` | `defaultValue`, `value` | `boolean` |
  | `DataTableSchema` | `selectable` | `'single'`, `'multiple'` (alongside `boolean`) |
  | `ViewSwitcherSchema` / `ViewTypeSchema` | `defaultView`, `activeView`, `views[].type` | `chart` |
  
  **Each one was decided by measuring the renderer, not by matching the declaration.**
  Widening a mirror to its declaration is only correct where the running code
  implements the missing spelling; where a spelling is dead, the right fix is to
  withdraw it from the declaration (ADR-0049 enforce-or-remove), not to teach the
  validator to accept something that renders nothing. The read sites:
  `buttonVariants`' `cva` map (`components/src/ui/button.tsx`) carries all six
  variants and all four sizes; `AdvancedChartImpl` normalizes `column` to `bar`,
  maps `horizontal-bar` to a real `BarChart` layout and gives `donut` its own inner
  radius; `useForm({ mode })` hands `validationMode` straight to react-hook-form,
  whose `isOnTouch` / `isOnAll` branches implement `onTouched` and `all`;
  `toControlValue` / `matchOptionValue` (#3090) round-trip a boolean option value
  with its type intact; `resolveSelectionMode` implements `'single'` as
  replace-on-select with no select-all header, distinct from `'multiple'`; and
  `chart` is a rendered view type with its own `case` in both `ListView` and
  `ObjectView`.
  
  Consumer-visible type effect: `z.infer` of these schemas widens accordingly.
  Widening an input contract cannot break a caller that was already passing a
  narrower value, but code that exhaustively switches on the inferred union — e.g.
  a `switch` over `chartType` with no `default` — will want the new arms.
  
  Refs objectui#5927 (group A of the 17 measured mirror drifts). The remaining
  classes are rulings rather than edits and stay in the `KnownDrift` ledger.
- 24e027e: `@object-ui/types/zod`: the zod const `StylePropsSchema` is renamed to `ClassNameStylePropsSchema` (objectui#5928). **The old name is gone** — there is no deprecated alias and no second spelling. Import `ClassNameStylePropsSchema`.
  
  **What moves on the published surface.** `StylePropsSchema` is removed from `@object-ui/types/zod`; the same object is exported under the new name with the same accept set, so nothing that parsed before parses differently and nothing refused before is accepted now. The break is the name alone: an import of `StylePropsSchema` no longer resolves.
  
  **Why the name had to move.** The const declares exactly two keys — `className` and `style`, the CSS passthrough attributes a node exposes. The TypeScript `StyleProps` (`base.ts`) is the Tailwind-SCALE vocabulary: `padding`, `margin`, `gap`, `backgroundColor`, `textColor`, `borderWidth`, `borderColor`, `borderRadius`. Measured on this branch's base with an AST read of both files: 2 keys against 8, sharing ZERO keys. In this package the `…Schema` suffix otherwise means "runtime mirror of the like-named declaration", so the shared name asserted a mirror relationship that does not exist — and building objectui#5684's parity registry by name pairing duly put the two together and reported drift on a pair that has no counterpart at all.
  
  **Where the non-pair is recorded now.** `zod-mirror-parity.test.ts` keys its existing `EXCLUSIONS` entry — the mechanism that accounts for every exported const with no TypeScript declaration to mirror, each with its stated reason — to `ClassNameStylePropsSchema`. Named for its own two keys, the const leaves no like-named declaration for a name-derived pairing to reach for.
  
  **No deprecation window, deliberately.** No consumer of the old name exists in this repository. Measured on this branch's base: `StylePropsSchema` had exactly three references — the definition, the barrel line, and the guard's own exclusion key — all three inside `packages/types` (lit control on the same query shape: `BaseSchema` matches 251 tracked files). A staged retirement would need named external-consumer evidence, and there is none.
- 2c3cd1b: BREAKING (`@object-ui/core`): `ActionRunner`'s legacy `ActionDef.onSuccess`
  chained-callback channel is retired — `onSuccess` now has exactly the meaning the
  contract declares (objectui#5934, maintainer ruling 2026-08-31).
  
  (The bump is `minor` by this repo's release model — objectui's major is pinned to
  the `@objectstack` family major, and its own breaking changes ship as `minor` with
  the break spelled out here, per `scripts/check-changeset-no-major.mjs`. This
  paragraph is that spelling-out: the break below is real and consumer-visible.)
  
  - **What breaks, by specifier**: `import type { ActionDef } from '@object-ui/core'` —
    `ActionDef['onSuccess']` was `ActionDef | ActionDef[]` (chained callbacks the runner
    dispatched through `executeChain` after a success). It is now derived from the pinned
    spec: `ActionSchema.onSuccess`'s closed strict `{ navigate: string, openIn?: 'self' |
    'newTab' }` block. Code that assigned a callback `ActionDef` (or an array of them) to
    `onSuccess` no longer compiles, and at runtime a callback-shaped value gets NO reading —
    no handler dispatch, no navigation, the action's own result untouched. `onFailure` is NOT
    changed: the spec declares no such key, so it keeps its one runner-native meaning.
  - **Why this is safe to take**: the channel was unreachable from validated metadata —
    `@objectstack/spec` (17.2.0 pin) strict-refuses a callback shape inside `onSuccess` at
    parse (`invalid_type` on `navigate` + `unrecognized_keys`), so no published/saved
    metadata could ever carry one — and a producer census with a positive control found zero
    producers outside the channel's own test pins. Migration for an out-of-repo consumer that
    drove the channel programmatically: put the follow-up actions in `chain` (the runner's
    declared chaining key, unchanged), or author the spec's `onSuccess` navigation block.
  - `@object-ui/types` (minor): `UIActionSchema` now declares `onSuccess`, derived from the
    spec's `ActionSchema.onSuccess` — the renderer view spells the key the four action
    surfaces forward, so the forwards type-check.
  - `@object-ui/components` (patch): the four action renderers forward `onSuccess` without
    the `as any` casts (no behavior change — same key, same value, now typed).
- 90665e0: **Removes a published export.** Retire the `MobileComponentConfig` type
  (objectui#5942, ADR-0049 enforce-or-remove). The name is deleted from
  `@object-ui/types` and from `@object-ui/mobile`, which re-exported it — after
  this release `import type { MobileComponentConfig }` from either package is a
  compile error, not a deprecation warning.
  
  `MobileComponentConfig` published a four-key "mobile component schema
  extension" — `responsive`, `gestures`, `pullToRefresh` and `infiniteScroll` —
  and nothing read it. Re-measured on current `main` before anything was deleted:
  the type had exactly four code mentions repo-wide — its own declaration, one
  doc-comment cross-reference, and the two barrel re-exports. It had **no mount
  point at all**: no type mounted it as a property, nothing extended it, and no
  renderer, hook or adapter annotated, cast to or imported it. A sweep of the
  example apps and the `objectstack` sibling checkout found zero authors. Every
  read-shape probe returned zero against a control lit in the same run.
  
  That makes it stricter than the usual case: not merely a surface whose values
  were unimplemented, but a container with no path by which any authored value
  could reach a renderer. objectui#4919 removed its last member
  (`mobileOverrides`), which is what left the container itself inert.
  
  Removed outright rather than kept as a `?: never` tombstone, on this package's
  own discriminator: a tombstone steers authors to a named live replacement key
  (`crud.ts` `confirm` to `confirmText`; `data-display.ts` `hoverable`/`striped`
  to `data-table`), or keeps loud a key the docs taught as working. Neither
  applies — the whole interface goes, so there is no surviving object to hang a
  `never` key on, and no documentation ever described it
  (`skills/objectui/guides/mobile.md` teaches the hooks, never this type). Same
  zero-pull, no-successor shape as `MobileOverrides` (objectui#4919) and
  `AccordionItem.icon` / `ToggleGroupItem.icon`.
  
  ## Upgrading
  
  **No behaviour changes and there is nothing to migrate at runtime.** An object
  authored against this type did nothing before and does nothing now; what
  changes is that the contract no longer claims otherwise, so the mistake
  surfaces at authoring time instead of silently type-checking.
  
  - **You imported the type only** (the only thing that was possible — nothing
    accepted it as a value): delete the import. If you kept a local config object
    annotated with it, drop the annotation; the object was never passed anywhere
    that read it.
  - **You actually wanted the behaviour:** it exists, and it is not being
    retired. It lives in `@object-ui/mobile` as React hooks, which is where the
    working code always was — `useResponsive` / `ResponsiveContainer` for
    `responsive`, `useGesture` for `gestures`, `usePullToRefresh` for
    `pullToRefresh`. `infiniteScroll` has no hook; it was never implemented in
    any form. See `skills/objectui/guides/mobile.md`.
  - **You want a declarative mobile config surface:** that re-enters deliberately
    as designed product surface on its own card, with the renderer that reads it
    landing in the same change as the declaration — not by restoring this
    declaration.
  
  **Do not follow the compiler's suggestion.** TypeScript reports the removal from
  `@object-ui/types` as TS2724 and appends `Did you mean 'ComponentConfig'?`. That
  is a lexical near-match, not a migration target: `ComponentConfig` is the
  renderer **registration** record (`{ type: string; component: T }`, extending
  `ComponentMeta`) and has nothing to do with mobile configuration. The import
  from `@object-ui/mobile` gets a plain TS2305 with no suggestion at all.
  
  Marked `minor`, not `major`, per this repo's version-alignment rule, which
  reserves `major` for following `@objectstack` across a major (AGENTS.md
  版本号策略) — the same classification objectui#4919's identically breaking type
  removal used. **Breaking for TypeScript consumers of the name only.**
  
  Follow-up, deliberately not widened into this change: `MobileResponsiveConfig`
  and `GestureConfig` were consumed only by this container and are now
  zero-consumer published types themselves. Filed as objectui#7519 for triage.
- 7e19d03: **Breaking for authored metadata:** `DashboardWidgetSchema` (the zod validator
  in `@object-ui/types/zod`) is now `.strict()` — an undeclared widget key
  REFUSES the parse with zod's `unrecognized_keys` issue naming every offending
  key, instead of being silently deleted.
  
  Before this change the schema was a plain `z.object()`: a widget carrying
  `zzcanary` / `categoryField` / `aggregate` parsed five-keys-in, three-keys-out,
  verdict ACCEPT — the same "dropped without a word" failure the schema's own
  docstring records from the pre-derivation hand copy, still live for every key
  no contract declares (objectui#6002). Maintainer ruling 2026-08-25, Route 1
  two-step: objectui#6150 declared the 13 genuinely-consumed keys first (landed
  as PR #6945), then this flip makes a stale or mistyped key loud everywhere the
  contract is consulted (`objectui validate`, `safeValidateSchema`, the catalog
  gate) instead of only inside one catalog test.
  
  **Who is affected — a widget authoring a key outside the declared surface:**
  the retired pre-ADR-0021 inline analytics shape (`object` / `categoryField` /
  `valueField` / `aggregate`) is the canonical case — it used to validate clean
  with all four keys deleted; it now refuses with the keys named. The spec's
  tombstoned keys (`actionUrl` / `actionType` / `actionIcon` / `aria` /
  `responsive`) keep their specific removal messages — they are declared
  `z.never()` members, so they do not degrade to a generic unknown-key error.
  
  **Not affected:** a `metric-card` COMPONENT node in a dashboard's widget slot.
  Its props (`value` / `icon` / `trend` / `trendValue` — registry inputs, not
  widget keys) stay legal: per the 2026-08-14 ruling (objectstack#8593) a
  component node is owned by objectui's own passthrough `BaseSchema`, and
  `DashboardComponentSchema`'s widget slot now routes component-enum types there
  before the strict widget schema is consulted. The legacy
  `{ id, component, layout }` envelope also still parses. The repo-wide corpus
  preflight (575 JSON files, every dashboard-bearing doc fence, all designer
  emit paths) measured **zero** newly-refused widgets.
- 864154e: The Field Designer no longer offers a formula-expression textarea, and no designer write
  path emits a `formula` key (objectui#6043).
  
  **This is a behaviour change on an authoring surface: a control is removed.** A field's
  `type` may still be set to `formula` — that is a valid spec `FieldType` and stays in the
  palette — but the expression itself is no longer authored here. Authors write formula
  expressions in metadata-admin's field inspector, where they are checked.
  
  The control wrote `formula`, which is not in `FieldSchema`'s accept set. Measured against
  the installed `@objectstack/spec` 17.2.0:
  
  ```
  FieldSchema.safeParse({ type:'formula', label:'Tax', formula:'price * quantity' })
    => success = false
    => unrecognized_keys ['formula']   "Did you mean `formula` -> `expression`?"
  ```
  
  so `PUT /api/v1/meta/object/:name` returned a hard 422 `INVALID_METADATA` — and because
  the key was then stored, it blocked **every later save of that object**, not just the one
  that introduced it.
  
  **The key was deliberately NOT renamed to the spec's `expression`.** `FieldSchema` judges
  the key name and never the expression LANGUAGE — measured, it accepts
  `expression: 'price * quantity'` and even `expression: '!!!not cel at all!!!'`; only the
  empty string is refused. Spec `expression` is CEL rooted at `record`
  (`record.amount * 0.1`), whereas this control's own placeholder taught `price * quantity`
  — bare field refs, which under the scope formulas bind evaluate to null silently. A rename
  would therefore have converted a loud, immediate 422 into a formula that saves clean and
  then quietly computes nothing, which is strictly worse than the bug it appears to fix.
  
  Making refusals loud *in the control* would need CEL lint, autocomplete and `returnType`
  inference — that is `CelPredicateField`, which lives in `@object-ui/app-shell`, and
  app-shell depends on `@object-ui/plugin-designer`, so it cannot be imported back without a
  dependency cycle. Growing a second formula-authoring surface inside plugin-designer is a
  feature, not this fix. `returnType` is likewise not authored here: it is only derivable by
  inferring the CEL result type, and with no expression control there is nothing to infer
  from.
  
  `formula` joins the retired-key tombstone in `MetadataFieldsPage`, so an object already
  carrying the key is stripped clean on its next save instead of staying blocked forever —
  which matters more than usual here, because with the control gone an author would
  otherwise have no way left to clear it. It is dropped rather than migrated to `expression`,
  for the same reason the rename was refused. A `expression` authored in metadata-admin is
  **not** touched: it is a real `FieldSchema` key and rides through the designer's
  round-trip untouched.
  
  Also removes the now-unreachable `formula` read/write from
  `views/metadata-admin/previews/object-fields-bridge.ts`, which was a third emit site for
  the key that neither the card nor the parity gate named.
  
  The `formula` entry is removed from `check-designer-field-key-parity.mjs`'s
  `KNOWN_UNPARSEABLE_KEYS` ledger, which ratchets in both directions — a resolved key that
  left a stale entry behind would be as red as a new offender.
- b023625: The field metadata payload no longer emits `sortOrder`, the key `FieldSchema` refuses by
  name (objectui#6045). Field-level sibling of objectui#6223, same objectui#5761 family.
  
  Measured against the installed `@objectstack/spec` 17.2.0, whose `FieldSchema` accept set
  is 71 keys:
  
  ```
  FieldSchema.safeParse({ type:'text', label:'L' })                  => success = true   (control)
  FieldSchema.safeParse({ type:'text', label:'L', sortOrder: 3 })    => unrecognized_keys ["sortOrder"]
  
  FieldSchema.safeParse({ type:'text', label:'L', sortable: true })  => success = true   (control)
  FieldSchema.safeParse({ type:'text', label:'L', sortable: 3 })     => success = false
  ```
  
  The control is what makes that a key-by-key result rather than a schema refusing
  everything, and the `sortable` pair is what shows the near-spelling is a *different
  concept* — a boolean ("whether field is sortable in list views"), not this key's spec
  name.
  
  **The resolution was deletion, not a rename**, which is objectui#4687's shape rather than
  objectui#6041's. The spec has no field-level ordering key at all: it models field order by
  **declaration order** in the object's `fields` record, so a designer that wants explicit
  ordering reorders that record rather than carrying an index. There was nothing to map onto,
  and nothing was invented to map onto.
  
  **It was latent, and that is confirmed on today's tree.** Neither of the two sites that
  construct a `DesignerFieldDefinition` — `FieldDesigner`'s create/update handlers and
  `MetadataFieldsPage.toDesignerField` — ever named the key, so `toFieldPayload` emitted
  `sortOrder: undefined` and `JSON.stringify` dropped it. The key never reached the wire. It
  was one reorder feature away from doing so, which is the objectui#4644 shape: a hard 422
  `INVALID_METADATA` that blocks every subsequent save of the object, with nothing in the UI
  to say which key caused it.
  
  Removed in one go from the wire shape (`FieldMetadataPayload`), its writer
  (`toFieldPayload`) and the UI model (`DesignerFieldDefinition`), so no declaration is left
  behind that no writer fills and no schema accepts.
  
  **Breaking for TypeScript consumers**: `sortOrder` is gone from `DesignerFieldDefinition`
  (`@object-ui/types`) and from `FieldMetadataPayload` (app-shell), so code that set either
  stops compiling.
  
  Two keys share this spelling and are untouched, which is why the census was on the *shape*
  — a field-metadata payload key `FieldSchema` refuses — rather than on the identifier: the
  **object-level** `sortOrder` (`ObjectSchema`'s, removed from the object wire shape by
  objectui#6223 and deliberately kept on the `ObjectDefinition` UI model) and the
  **saved-view** `sortOrder` in `ObjectView`, which is per-view display order on a different
  document entirely.
  
  The `KNOWN_UNPARSEABLE_KEYS` entry in `scripts/check-designer-field-key-parity.mjs` goes
  with the fix — that ledger ratchets in both directions, so an entry left behind for a
  resolved key is as red as a missing one.
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
- 971d387: ⚠️ **Behaviour change: an authored `FormSection.visibleWhen` that has been doing nothing
  will now START HIDING SECTIONS.** Read this before upgrading if any of your metadata
  authors a section predicate.
  
  `@objectstack/spec` declares `FormSection.visibleWhen` and this repo's spec bridge maps it
  through, but every plugin-form layout renders a section header as a virtual
  `section-divider` pseudo-field and none of them copied the predicate onto it. On the
  object-view chain — the create/edit modal, the drawer, the split form, and the full-page
  record form — the key was declared, mapped, carried, and then dropped one hop before
  anything could evaluate it. The section rendered unconditionally, with no diagnostic
  (objectui#6111).
  
  **Why nobody noticed, and why the fix is felt as a regression.** `visibleWhen` fails OPEN:
  a section that renders is what you get when the predicate resolves TRUE, when the predicate
  never arrives, *and* when the predicate faults. Those three worlds were indistinguishable,
  so an app that authored a section predicate saw its section render and had no way to tell
  that the rule was inert. Every such app has been running with the rule switched off, and
  some will have been authored — or simply grown used to — that state. After this change the
  predicate is evaluated for real, and sections that have always been visible will disappear
  for the users the rule excludes.
  
  This is the intended ADR-0089 contract being delivered, not a new capability: the key was
  already declared, already documented, and already honoured by the console form renderer.
  The object-view chain was the one that silently ignored it.
  
  **Before upgrading**, audit any `sections[].visibleWhen` in your form-view metadata and
  confirm each predicate says what you actually want, evaluated against `record` +
  `current_user`. A predicate that was written speculatively, or left behind after a rework,
  now takes effect.
  
  **Measured scope of the hide.** The predicate gates the section's HEADER row. The renderer
  treats `section-divider` as presentational and holds no association between it and the
  fields that follow it, so a false predicate removes the heading and the section's fields
  keep rendering. The console renderer (`apps/console`) drops the whole `<section>`, fields
  included. That divergence is real, is pinned honestly by this change's tests rather than
  implied away, and is filed separately — it needs a renderer-side grouping contract, not
  another line in a layout.
  
  Two hops were dropping the key and both are repaired: `ObjectForm` rebuilds each section
  key by key when it delegates to Split/Drawer/Modal (and `ModalForm`'s own `groups` map does
  it again), so a key those maps did not copy never reached the layout at all; and the six
  `section-divider` synthesis sites across the four layout files.
  
  `@object-ui/types` gains the matching `ObjectFormSection.visibleWhen` declaration.
- ee851c3: The report authoring face declares what its own examples author (objectui#6121,
  maintainer ruling 2026-08-25, Option A — fix the type producer, not the docs).
  
  - `ReportComponentSchema.exportConfigs` is now
    `Partial<Record<ReportExportFormat, ReportExportConfig>>` instead of a TOTAL
    `Record`. Configuring ONE export format no longer forces an author to declare
    all five (`pdf`, `excel`, `csv`, `html`, `json`). The published runtime twin
    was never total — `z.record(z.string(), ReportExportConfigSchema)` in
    `@object-ui/types/zod` has all keys optional — so the TS declaration had been
    stricter than the validator that actually judges authored JSON. This is a pure
    relaxation: every literal that type-checked before still does.
  
  - `ChartDataSeries` gains the optional per-series family override `type`
    (`'bar' | 'line' | 'area'`), with the same key added to its zod twin
    `ChartDataSeriesSchema`. The renderer already reads it —
    `normalizeChartSchema`'s `normalizeSeries` in `@object-ui/plugin-charts`
    resolves the family as `str(raw.chartType) ?? str(raw.type)` — so `type` was
    the author spelling of an override the type refused to declare. The union is
    the three families that read honours, deliberately NOT the wider `ChartType`:
    a wider union would advertise an override the normalizer drops in silence.
  
    NOT only a relaxation on the runtime side, and this is the half a consumer
    needs before taking the bump. `ChartDataSeriesSchema` is a stripping
    `z.object`, so a stored series carrying a non-family `type` — `type: 'pie'`,
    say, copied from `@objectstack/spec`'s `ChartSeries`, whose `type` IS the
    full `ChartType` — used to PARSE, with the unrecognised key dropped in
    silence; it now FAILS. `ChartDataSeriesSchema` feeds `ChartSchema.series`,
    so a consumer running `safeParse` over stored chart JSON newly gets
    `invalid_value` at `series.N.type` where it previously got nothing. (Checked
    against the package's own zod 4.4.3, both directions, with `type: 'line'`
    and a series carrying no `type` as controls: both still parse.) What to do
    about it: the rejected value never had an effect — `normalizeSeries` honours
    exactly the three families and drops every other one with no error, no
    warning and no output key — so the failure surfaces an override that was
    already inert. Drop the `type` from the stored series, or, if the whole
    chart really is that family, move it to the chart's own `chartType`, which
    still takes the full `ChartType`. The TS side is widening-only; only the
    published validator newly rejects.
  
  Both changes carry pins in
  `packages/types/src/__tests__/report-schema-authoring-face.test.ts`: the
  widenings fail if either is narrowed back, and the rejection above is pinned
  openly as `rejects a family the normalizer would silently drop`.
  
  `ReportComponentSchema.dataSource` is NOT changed here — measuring the authorable
  shape against the report runtime's actual read, which the ruling requires,
  produced a fork the ruling did not cover. It is escalated on objectui#6121.
- 6414dfd: The two report data-source keys are retired on both faces (objectui#6121,
  maintainer ruling of 2026-08-30, decision batch #8 — option A's retirement half;
  ADR-0049 enforce-or-remove).
  
  **The accept set of a published validator moves** (`@object-ui/types/zod`):
  
  - `ReportComponentSchema.dataSource` was `z.any().optional()`, so any JSON value
    parsed green and was then read by nobody.
  - `ReportBuilderSchema.dataSources` was `z.array(z.any()).optional()`, on a node
    type no renderer is registered for at all.
  
  Both now carry `retirementTombstone(...)`: an authored value is refused at the
  key's own path with `code: 'invalid_type'` and a message that names the key, says
  why it is retired and points at the spelling that runs. Nothing that used to be
  refused parses green.
  
  **The TypeScript face** — both keys become `?: never` rather than being deleted,
  so an author who still writes one gets a `tsc` error at the authoring site
  instead of a silently stripped key. They were annotated `DataSource` /
  `DataSource[]`, the runtime ADAPTER interface (`find(resource, params)`), which
  no JSON document can author; that mis-annotation is the defect objectui#6121 was
  filed for, since every example on `content/docs/core/report-schema.mdx` authored
  a config object against it.
  
  **Why this is a retirement and not a rename.** No read site consumed either key:
  `@object-ui/plugin-report`'s `ReportRenderer` takes its adapter as a React prop
  or from `SchemaRendererContext`, never off `schema.dataSource`, and the live
  9.0 path binds a semantic-layer `dataset` (ADR-0021). Authored occurrences
  measured zero in this repo and in the sibling `objectstack` checkout, whose
  report metadata binds `dataset` throughout — the ruling's own deprecation-window
  exit criterion. A stored document that still carries the key now fails loudly at
  `safeParse` instead of being accepted and ignored; drop the key, and bind the
  report through `dataset`.
  
  The replacement binding key the ruling names (`data?: ViewData`) is deliberately
  NOT declared here, and is escalated on objectui#6121: `data` is already a live
  key on `ReportComponentSchema` — the report ROW array, read by
  `LegacyReportRenderer` as `data.length` / `data.map` — so declaring the binding
  under that name would put two authoring contracts on one key inside one
  renderer.
  
  Pinned in `packages/types/src/__tests__/report-schema-authoring-face.test.ts`:
  the `never` twins, the named refusals with their issue envelope, the `.describe()`
  metadata channel, and controls that a report without the key still parses.
- a8d5c71: `@object-ui/types/zod`: the 58 `on*` handler keys declared `z.function()` now refuse BY NAME (objectui#6124)
  
  The zod mirrors declared 58 `on*` keys (26 distinct — `onClick`, `onChange`, `onOpenChange`, `onValueChange`, `onCardMove`, …) across `complex`, `data-display`, `disclosure`, `feedback`, `form`, `layout`, `navigation` and `overlay` as `z.function()`, a declaration no JSON document can satisfy on a JSON-authored vocabulary. A JSON author who wrote `onClick: { "action": "toast" }` was already refused, with zod's bare `invalid_type … expected function, received object` naming the key and nothing else.
  
  Every one of the 58 sites is now a named refusal arm in the shape #5099 landed for `FieldConstraintsSchema.pattern.value` (`z.custom` + guidance, via `handlerKeyRefusal()` in `zod/tombstone.zod.ts`): the message names the key, says why JSON cannot author it, and points at the node-type spelling PR #6498 established (`{ "type": "toast" }`, an `action:button` node with a declared action). The same text is the key's `.describe()` metadata — one string, two channels. Deleting the keys was measured and refused: under `BaseSchema.passthrough()` an undeclared key is not refused, it is KEPT, and `onClick` rides `SDUI_DOM_PASS_THROUGH_KEYS` into the DOM listener slot where React throws at click.
  
  **Accept-set change (Clause ②).** A live function value — which parsed green before — is now refused on the JSON mirror too. The programmatic face reaches renderers through the TypeScript interface and React props, never through `safeParse`; on this tree the only runtime `safeParse` doors into these mirrors are the CLI validators and the exported `validateSchema` / `safeValidateSchema` helpers, none of which is fed a function-bearing object. Code that ran a host-supplied function through one of these mirrors must stop doing so.
  
  **TypeScript face, measured per key.** 36 keys whose function value reaches a renderer at runtime (read off `schema.*`, called as a React prop after `SchemaRenderer`'s spread, or spread onto a Radix root / DOM listener slot) keep their function type. 22 keys nothing reads carry the `?: never` tombstone (ADR-0049): `KanbanSchema.onColumnAdd` / `onCardAdd`, `CarouselSchema.onSlideChange`, `ChatbotSchema.onSendMessage`, `AlertSchema.onDismiss`, `ListItem.onClick`, `TreeViewSchema.onSelectChange` / `onExpandChange`, `ToastSchema.onDismiss`, `RadioGroupSchema` / `SwitchSchema` / `ToggleSchema` / `SliderSchema` / `CalendarSchema` / `ComboboxSchema` / `CommandSchema` `.onChange`, `InputOTPSchema.onComplete`, `BreadcrumbItem.onClick`, `SidebarSchema.onCollapsedChange`, `ButtonGroupButton.onClick`, `AlertDialogSchema.onConfirm` / `onCancel`. Assigning one of those is now a `tsc` error naming the key.
  
  Out of scope, per the ruling: the four non-`on*` `z.function()` keys (`cell`, `custom`, `validate`, `renderCellEditor`) stay as they are; `EventHandlersSchema` is objectui#6910's card.
- 88e9109: Declare the two consumed-but-undeclared field-metadata keys ruled on
  objectui#6140 / objectui#6153 (maintainer 2026-08-25, Option A), and de-cast
  the widget reads they legalize:
  
  - `MarkdownFieldMetadata.rows` and `HtmlFieldMetadata.rows` (`@object-ui/types`)
    — the inline-editor height `RichTextField` has always read through an
    `as any` (default 8), following the `TextareaFieldMetadata` precedent. NOT a
    spec key: `@objectstack/spec` `FieldSchema` refuses `rows` BY NAME
    (`unrecognized_keys`) on all four of textarea/markdown/html/richtext, so it is
    an objectui render hint that must not be written into authored object
    metadata. The four inert editor keys (`toolbar`/`preview`/`minHeight`/
    `maxHeight`) stay deliberately undeclared and are pinned so.
  - `SelectOptionMetadata.description` — secondary option text `LookupField`
    searches on authored static options and emits from `recordToOption`. NOT a
    spec key either: `@objectstack/spec` `SelectOptionSchema` is strict over
    exactly `{label, value, color, default, visibleWhen}` and refuses
    `description` BY NAME, and `FieldSchema` routes `options` through that schema,
    so the key must never reach authored object metadata.
  - `RichTextField` and `TextAreaField` (`@object-ui/fields`) now read their
    metadata through the declared types instead of `field as any` (the spec-face
    `maxLength` dual-read in `TextAreaField` stays as a documented structural
    read). Behaviour unchanged; `rows` and option `description` are now legal to
    author in an objectui **annotated literal** — never in an object document sent
    to the platform.
  
  Both spec attributions above were corrected in place before release
  (objectui#7537): as first written this changeset claimed each key was "aligned
  with" a `@objectstack/spec` schema member that does not exist. Re-measured on
  `@objectstack/spec@17.2.0`, each refusal is paired with a control that accepts
  the same payload minus the key. Same correction as objectui#7014 / PR #7510 made
  to the published JSDoc; the package bumps and the declared behaviour are
  unchanged.
- 2c45966: Declare the 13 renderer-read keys that no shipped type declared (objectui#6150)
  
  **This is a published-surface change on `@object-ui/types` and its `zod` mirrors,
  and it moves the accept set in TWO directions.** Read the next two paragraphs
  before reading the list — they are what the change actually is.
  
  **Key membership is NOT widened — it was never narrow.** All eight touched mirrors
  extend `BaseSchema`, which is `.passthrough()`, and `.extend()` carries that policy
  through (measured on the built mirrors: `catchall` is `z.unknown()` on all eight).
  So before this change every one of the 13 keys already parsed green and already
  SURVIVED the parse — admitted unexamined, neither refused nor stripped. Nothing
  that parsed before stops parsing because a key became known.
  
  **Value enforcement IS widened, which in the value dimension is a NARROWING.** For
  the 12 keys that gained a zod mirror entry, the value is now validated against the
  declared type: `{ type: 'text', content: 42 }` parsed green before and is refused
  now, at `content`. That is the point of declaring them — `declared === enforced` —
  but it is a behaviour change for documents that carried a wrong-typed value under
  one of these 13 names. Keys OUTSIDE the 13 are untouched: an undeclared key of any
  type is still admitted unexamined on all eight mirrors, pinned per mirror.
  
  The 13, each with the renderer read site the declaration records:
  
  | type | key | declared as | read at |
  |---|---|---|---|
  | `TextSchema` | `content` | `string` | `renderers/basic/text.tsx` — `{schema.content \|\| schema.value}` |
  | `CarouselSchema` | `opts` | `Record<string, unknown>` | `complex/carousel.tsx` — `opts={schema.opts}` |
  | `CarouselSchema` | `orientation` | `'horizontal' \| 'vertical'` | `complex/carousel.tsx` |
  | `CarouselSchema` | `itemClassName` | `string` | `complex/carousel.tsx` — per-slide class |
  | `FilterBuilderSchema` | `wrapperClass` | `string` | `complex/filter-builder.tsx` |
  | `TreeViewSchema` | `nodes` | `TreeNode[]` | `data-display/tree-view.tsx` |
  | `TreeViewSchema` | `title` | `string` | `data-display/tree-view.tsx` |
  | `TreeViewSchema` | `onNodeClick` | `(node: TreeNode) => void` | `data-display/tree-view.tsx` — INVOKED |
  | `CheckboxSchema` | `required` | `boolean` | `form/checkbox.tsx` — drives the `*` marker |
  | `FileUploadSchema` | `buttonText` | `string` | `form/file-upload.tsx` |
  | `FileUploadSchema` | `wrapperClass` | `string` | `form/file-upload.tsx` |
  | `HoverCardSchema` | `align` | `OverlayAlignment` | `overlay/hover-card.tsx` |
  | `ContextMenuSchema` | `trigger` | `SchemaNode \| SchemaNode[]` | `overlay/context-menu.tsx` |
  
  These compiled before only because `BaseSchema` ends with `[key: string]: any`
  (objectui#5155), so the docs page was the single place in the repo recording each
  capability, and the one place with no mechanical guard.
  
  Three declarations are deliberately not what "declare what is read" would produce
  on its own, and each says so in its own doc comment:
  
  - `CarouselSchema.opts` stays an OPEN bag rather than the docs page's
    `{ loop?, align? }` pair. The renderer forwards the whole bag to embla, so
    narrowing it to two keys would refuse authored documents that work today.
  - `ContextMenuSchema.trigger` is OPTIONAL although the docs page shows it
    required; the renderer substitutes a placeholder, so trigger-less documents are
    legal today.
  - `TreeViewSchema.onNodeClick` gets NO zod mirror. It is invoked, not read as a
    value, so it cannot appear in an authored JSON document; objectui#6152 ruled
    that class is recorded in `zod-mirror-parity.test.ts`'s `RuntimeOnlyDeclared`
    instead, and it is (the first pair to sit there without also sitting in
    `UnmirroredDeclared`, so that file's two counts move with it).
  
  Two of the 13 declare a SECOND spelling for a slot that already had one —
  `TextSchema.content` beside `value`, `TreeViewSchema.nodes` beside `data` — because
  that is what the renderers read. Retiring either spelling is an ADR-0049
  enforce-or-remove question and is deliberately not decided here. Declaring `nodes`
  also does not by itself make a `nodes`-only tree-view document legal: `data` stays
  required on both faces.
- db3a600: `StackSchema` now SHIPS the members it declares (objectui#6151). Its emitted declaration
  carried one property — `type` — where it was meant to carry twenty-five.
  
  The interface was written `extends Omit<FlexSchema, 'type'>`: "everything `FlexSchema` has,
  with a different `type`". That spelling erases every named member. `Omit` of a type over a
  key set is `Pick` over `Exclude` of `keyof` that type, and `keyof` a type carrying a string
  index signature is `string | number` — the literal member names are absorbed. `FlexSchema`
  inherits `BaseSchema`'s `[key: string]: any` (objectui#5155), so excluding `'type'` from
  `string | number` still leaves `string | number`, and the `Pick` rebuilt a type holding the
  index signature and none of the named members. Measured against the built `dist`:
  `FlexSchema` declared 25 properties, `StackSchema` declared 1.
  
  Nothing errored, which is why it survived four releases: the index signature keeps every
  absent key assignable and readable as `any`. The cost fell entirely on the tools that READ
  the declaration. Editor completion on a `stack` node offered `type` and nothing else — no
  `gap`, no `align`, no `justify`, no `children`. And a docs-versus-type sweep read
  `stack.mdx` as documenting keys that do not exist: objectui#6143 flagged `gap`, `children`
  and `className` there as divergences when the docs were right and the type was wrong.
  
  Fixed at the mechanism rather than by restating the members. The six flex/stack members now
  live in a new exported interface, `FlexLayoutProps`, which does NOT inherit `BaseSchema`,
  and `FlexSchema` and `StackSchema` each extend `BaseSchema` and `FlexLayoutProps`. No
  `Omit` crosses the index signature any more, and the members are declared once rather than
  duplicated. Extending `FlexSchema` directly was measured unavailable: an interface may
  narrow an inherited property only to a subtype, and `'stack'` is not a subtype of
  `FlexSchema`'s `type: 'flex'` (TS2430).
  
  `FlexSchema` is unchanged — its six member declarations moved byte-identically, and its
  emitted member set is the same 25 names before and after. The only declaration whose shape
  changes is `StackSchema`, which goes from 1 property to the same 25.
  
  **The one way this can newly error**, and why it ships as `minor`: keys on a `stack` node
  were previously answered by the index signature as `any`, so `gap: 'large'` type-checked.
  `gap` is now `number | undefined` and that line is a `tsc` error. Every value this newly
  rejects is one the renderer never honoured — `stack.tsx` feeds `gap` to a Tailwind numeric
  scale — so the change reports a defect that was already there rather than removing a
  capability. All three in-repo packages that name `StackSchema` or `FlexSchema`
  (`@object-ui/components`, `@object-ui/core`, the schema-catalog example) type-check green
  unchanged.
  
  Guarded by `packages/types/src/__tests__/stack-schema-emitted-members.test.ts`, which
  asserts against the EMITTED declaration rather than the source. That distinction is the
  whole point: a source-level assertion passes on the broken code, because the index
  signature answers for the missing key with `any`. The guard emits declarations with the
  package's own tsconfig and asserts (1) `StackSchema` declares exactly what `FlexSchema`
  declares, and (2) no member of the `LayoutSchema` union has lost any of `BaseSchema`'s
  named members — so the next heritage clause that collapses under the index signature reds
  for the whole class, not just for this one interface.
- 52a43de: `ChatbotSchema` names the `chatbot` node's local-display and legacy
  auto-response keys — a new, additive published surface (objectui#6169, the
  #6172 family ruling: every component node has exactly one named, importable
  authoring-face type).
  
  `ChatbotSchema` (`@object-ui/types`) now declares ten keys that previously
  existed ONLY inside an anonymous inline intersection local to
  `packages/plugin-chatbot/src/renderer.tsx`'s `chatbot` registration, invisible
  to anything outside that one file:
  
  - `showTimestamp`, `userAvatarUrl`, `userAvatarFallback`, `assistantAvatarUrl`,
    `assistantAvatarFallback`, `maxHeight` — display fields.
  - `autoResponse`, `autoResponseText`, `autoResponseDelay` — the local
    auto-response (demo/playground) fields, already live via a real consumer
    (`packages/app-shell/src/console/ai/AiChatPage.tsx`).
  - `onSend?: (content: string, messages: ChatMessage[]) => void` — the
    send-callback, now typed against the published `ChatMessage` shape rather
    than the plugin's internal runtime message type.
  
  Each was read-site-censused before being declared (renderer.tsx and/or
  `useObjectChat.ts` reads every one); none were dead, so none took the
  ADR-0049 retirement route. `disabled` — also present in the original
  intersection — is NOT redeclared: it is already `BaseSchema.disabled`
  (`boolean | string`), read generically for every node type, and redeclaring
  it here would have narrowed away the inherited expression-string case.
  
  **What an external consumer can now do that they could not before:** import
  `ChatbotSchema` from `@object-ui/types` and get these ten keys with real,
  checked types — previously any reference to them required either duplicating
  the anonymous type by hand or falling back to `any`. The Zod mirror
  (`@object-ui/types/zod`) gained the same ten keys in lockstep, so a `chatbot`
  node parsed through it is now validated on these keys rather than silently
  passed through unchecked (`BaseSchema`'s Zod mirror is `.passthrough()`).
  
  `packages/plugin-chatbot`'s `chatbot` registration (`renderer.tsx`) now types
  its `schema` prop as `ChatbotSchema` directly, dropping the anonymous
  intersection. No behavior change: `renderer.tsx:87`'s
  `body: schema.requestBody` forwarding — the subject of the already-merged
  #6193 — is untouched, and the render function reads the exact same keys it
  already read.
  
  This is additive (new optional keys on an interface that already carried a
  `[key: string]: any` index signature, and a new Zod-validated subset of
  previously-passthrough keys), so it ships as `minor` even though it changes
  published type surface: objectui's major is pinned to `@objectstack`'s
  (`scripts/check-changeset-no-major.mjs`), and objectui's own breaking changes
  ship as `minor` with the break spelled out — there is no break here to spell
  out, only a widening from anonymous-and-unchecked to named-and-validated.
  
  Out of scope, deliberately: the `chatbot-enhanced` and `chatbot-floating`
  registrations' own anonymous intersections (different key sets, a decision
  for a separate card in the same family), and the `surface` row on
  `content/docs/plugins/plugin-chatbot.mdx`'s Properties table, which names a
  key no registration in this package currently reads (filed separately).
- e4559d1: `TimelineSchema` now declares the presentational keys the timeline renderer actually reads
  (objectui#6170, maintainer ruling 2026-08-25 — the same family rule adopted on
  objectui#6172: the exported type aligns to the measured authored + read set).
  
  Before this, `TimelineSchema` declared `events` (required), `orientation` and `position`,
  and nothing else. `TimelineRenderer` is annotated `schema: TimelineSchema` and reads nine
  keys off that node — `variant`, `items`, `dateFormat`, `onItemClick`, `minDate`, `maxDate`,
  `rowLabel`, `scale`, `timeScale` — and **none** of the three that were declared. The docs
  property table and the registration's own designer `inputs` had agreed with the renderer
  all along; only the exported type disagreed. It was invisible to `tsc` because `BaseSchema`
  carries `[key: string]: any`, so every undeclared key resolved as `any` and the annotation
  constrained nothing.
  
  The most visible casualty was the docs page's own TypeScript example, which did not
  compile: `Property 'events' is missing in type '{ type: "timeline"; variant: string; items:
  … }' but required in type 'TimelineSchema'`. The page taught an authoring form its own
  published type refused.
  
  **Declared now** (TS interface and the `@object-ui/types/zod` mirror together): `variant`,
  `items`, `dateFormat`, `scale`, `timeScale`, `rowLabel`, `minDate`, `maxDate`. `onItemClick`
  is deliberately left undeclared — it is a runtime slot `ObjectTimeline` installs, and this
  package keeps callback-shaped keys off the authored surface.
  
  **`scale` is the canonical axis key.** It is `@objectstack/spec`'s `ui/TimelineConfig.json`
  spelling and the one `resolveTimelineScale` reads first (`scale ?? timeScale`). The designer
  now offers it, with all six buckets: `hour` / `quarter` / `year` have rendered correctly
  since objectui#2942 but were offered by neither the designer (which listed three) nor the
  exported type (which listed none), so they were authorable and undiscoverable. `timeScale`
  stays as a deprecated alias so stored JSON keeps working; retiring it is routed separately.
  
  **`events` is now optional.** It was required, which is why the documented authoring form
  did not type-check. That widening is the only non-additive change here — strictly more
  programs compile and strictly more input parses than before. `events`, `orientation` and
  `position` remain declared and remain read by nothing; a timeline authored with `events`
  still renders an empty rail. Their removal is a breaking narrowing of a published type and
  is routed through ADR-0049 enforce-or-remove as its own change, not smuggled into this one.
  
  Accept-set note for consumers: keys that previously resolved as `any` are now typed, so a
  value the renderer never implemented — `variant: 'diagonal'`, `dateFormat: 'medieval'`,
  `scale: 'fortnight'` — is a type error and a Zod rejection where it used to pass silently.
  Nothing that renders today stops rendering. `BaseSchema`'s index signature is untouched, so
  an undeclared key is still accepted by both halves (objectui#5155 / objectui#6269 own that
  ceiling).
- 2c71482: One authority for `KanbanSchema` / `KanbanColumn` / `KanbanCard`: the bare names
  now belong to `@object-ui/plugin-kanban` (objectui#6172, closing the
  cross-package half of objectui#6155).
  
  **Breaking, deliberately — six published names are removed from
  `@object-ui/types`.** Per this repo's own rule a breaking change ships `minor`,
  with the break spelled out here.
  
  | removed from | old name | new name |
  | --- | --- | --- |
  | `@object-ui/types` | `KanbanSchema` | `DeclarativeKanbanSchema` |
  | `@object-ui/types` | `KanbanColumn` | `DeclarativeKanbanColumn` |
  | `@object-ui/types` | `KanbanCard` | `DeclarativeKanbanCard` |
  | `@object-ui/types/zod` | `KanbanSchema` | `DeclarativeKanbanSchema` |
  | `@object-ui/types/zod` | `KanbanColumnSchema` | `DeclarativeKanbanColumnSchema` |
  | `@object-ui/types/zod` | `KanbanCardSchema` | `DeclarativeKanbanCardSchema` |
  
  Nothing else moved: every member, every optionality and the Zod mirror's whole
  accept/reject behaviour are byte-for-byte the shape they were. `SchemaRegistry`
  still maps `'kanban'`, `ComplexSchema` still carries the arm, and
  `safeValidateSchema` accepts and refuses exactly what it did before.
  
  **Migration.** `import type { KanbanSchema } from '@object-ui/types'` becomes
  either of two things, and which one you want is the whole point of the rename:
  
  - authoring a board that a **registered renderer** will draw — import the bare
    name from `@object-ui/plugin-kanban`, which is unchanged;
  - annotating or validating the **declarative** shape `@object-ui/types` mirrors
    in Zod — import `DeclarativeKanbanSchema` (or the Zod
    `DeclarativeKanbanSchema` from `@object-ui/types/zod`).
  
  **Why this direction.** The two declarations were structurally unrelated
  dialects sharing three names, and `@object-ui/types` is the declared
  zero-workspace-dependency bottom layer, so it cannot re-point at a plugin —
  convergence had to remove a name from one side or the other. All four
  registered kanban renderers (`kanban`, `kanban-ui`, `kanban-enhanced`,
  `object-kanban`) consume the plugin's dialect and none consumes this one, and
  objectui#6086 measured what happens when the bare name is the copy no renderer
  reads: an IDE or agent auto-import silently authors a board that renders
  nothing — a confident empty board rather than an abstention. So the surviving
  bare name is the one a renderer honours.
- 5ef9c4f: The section grouping contract (objectui#6236, maintainer ruling 2026-08-27): a
  `section-divider` row may now CLAIM its member fields — `FormField.fields: string[]`, the
  same membership shape `FormFieldTab.fields` / `FormFieldPane.fields` already model — and
  the form renderer then gates the WHOLE group on the divider's own visibility verdict
  (`visibleWhen` / `visibleOn` / legacy `condition`).
  
  Before this, one authored `FormSection.visibleWhen` meant two different things: the
  console renderer drops the whole `<section>` (heading and fields), while the plugin-form
  chain's renderer treated `section-divider` as a purely presentational row and hid only
  the HEADING, leaving the section's fields rendering (measured in objectui#6111, which
  pinned that honestly rather than implying a guarantee it did not deliver).
  
  Ruled semantics, now pinned in `section-grouping-6236.test.tsx`:
  
  - **Visibility decides what is DRAWN and nothing else** (console precedent, 2026-08-22
    ruling after #5594) — a hidden section's values still submit.
  - **A hidden section's fields skip client-side validation** — a user is never blocked by
    an error pointing at a control they cannot see (the objectui#6110 defect shape); the
    server-side contract remains the loud floor for genuinely-required data. A section
    hiding mid-session also clears its members' stale errors, the way a field's own false
    predicate already did.
  - **A divider without a claim keeps the old contract** (its predicate gates only the
    heading), so existing schemas are untouched.
  
  Both halves ride the mechanism the field-level predicate already uses (return `null`;
  react-hook-form keeps the value and skips the unmounted control), so field-level and
  section-level visibility cannot drift apart. The zod mirror (`FormFieldSchema`) declares
  the key with the same scope note.
  
  `@object-ui/plugin-form` wires the producer half: all six `section-divider` synthesis
  sites (ObjectForm's stacked simple path, ModalForm's sectioned and derived-fieldGroup
  paths, DrawerForm's sectioned and derived-fieldGroup paths, SplitForm's panes) now stamp
  the membership claim onto the divider they emit, from the RESOLVED member list — so an
  authored `FormSection.visibleWhen` finally hides the whole section on the object-view
  chain, matching the console renderer. The #6111 honest pin (`measured scope`) flipped
  accordingly: it now pins heading-and-fields hiding together, and every per-layout DENIED
  row asserts the claimed member as well as the heading. The derived-fieldGroup sites carry
  the claim for uniformity but stay fail-open — the spec `fieldGroups` vocabulary has no
  section-predicate slot to author. The tabbed arm's predicate slot (objectui#6237) is
  designed to reuse this same grouping contract.
- 46f0bb4: The tabbed arm of the grouping contract (objectui#6237, same maintainer ruling as
  objectui#6236): `FormFieldTab` gains the predicate slot the ruling named —
  `visibleWhen?: string | { dialect?: string; source: string }` — so a section rendered as
  a TAB PANEL (`ModalForm` `contentLayout: 'tabbed'`) can finally carry an authored
  `FormSection.visibleWhen`. The tabbed layout synthesises no `section-divider` at all, so
  the #6236 membership-claim mechanism had nothing to stamp the predicate onto and no slot
  to copy it into; the predicate was silently dropped one hop before evaluation (measured
  in objectui#6237's card).
  
  The form renderer evaluates the tab's predicate with the same record assembly the
  field-level rules use (`ruleRecord` / `previousRecord` / host predicate scope, #6010),
  fail-open, and when FALSE draws neither the tab's trigger nor its panel. Not drawing the
  panel unmounts the claimed fields through the exact mechanism a field's own false
  predicate uses, so the ruled hidden-group semantics are inherited rather than
  re-implemented, and are pinned in `fieldtab-visiblewhen-6237.test.tsx`:
  
  - **Visibility decides what is DRAWN and nothing else** — a hidden tab's values still
    submit.
  - **A hidden tab's fields skip client-side validation** — a user is never blocked by an
    error pointing at a control they cannot see; the server-side contract remains the loud
    floor for genuinely-required data (#2959's trap, answered the same way for tabs as for
    sections). A tab hiding mid-session clears its members' stale errors.
  - **Deterministic re-selection**: a predicate hiding the ACTIVE tab activates the user's
    pick if still visible, else the declared default, else the first visible tab — never an
    empty panel — and the user's pick is restored the moment its tab is re-admitted.
  - **No mid-interaction collapse**: whether the tabbed arm engages stays judged on the
    DECLARED tabs, so a predicate hiding one of two tabs filters the strip (and hides the
    tab's fields) instead of collapsing the modal into the stacked layout under the user's
    cursor. With every tab hidden the strip is omitted; unclaimed fields still render.
  - **A tab without the key keeps the pre-#6237 contract** (always drawn), so existing
    schemas are untouched.
  
  `@object-ui/plugin-form` wires the producer half: `ModalForm`'s tabbed synthesis site now
  copies the section's `visibleWhen` onto the tab it emits, and the #6111 layout matrix
  gains the tabbed-modal rows (direct and via `ObjectForm` delegation). `TabbedForm` /
  `WizardForm` still declare no section predicate in their own section configs — those arms
  remain open on objectui#6237.
- 8f1d995: `ComponentConfig` now has one authority: `@object-ui/types` declares it, `@object-ui/core` re-exports it
  
  `@object-ui/types` and `@object-ui/core` each published a declaration of
  `ComponentConfig`, so an auto-import picked between two different types by
  alphabetical order. After the `ComponentMeta` convergence the remaining
  difference was genericity and the `component` slot: `@object-ui/types`' was
  non-generic with `component: any`, core's was `<T = any>` with
  `component: ComponentRenderer<T>`.
  
  `@object-ui/types`' declaration gains that type parameter, **defaulted**, so
  every existing spelling keeps its meaning exactly — bare `ComponentConfig` is
  `ComponentConfig<any>`, whose `component` is `any`, as before. `@object-ui/core`
  re-exports it instead of declaring its own.
  
  The registry-only keys (`tier`, `namespace`, `skipFallback`, `labelling`,
  `deprecated`) were not dropped: they moved to a named extension,
  `RegistryComponentConfig`, which is what `Registry.getConfig`,
  `getAllConfigs` and `getNamespaceComponents` return. Those return values are
  type-identical to what they returned before, so every read path is unchanged.
  
  **Breaking:** a consumer that imports `ComponentConfig` from `@object-ui/core`
  *and* touches one of those five registry-only keys through that annotation must
  switch the annotation to `RegistryComponentConfig` — the name `ComponentConfig`
  no longer carries them there. Filed `minor` rather than `major` per AGENTS.md's
  versioning policy: objectui's own breaking changes ship as `minor` with the break
  spelled out here, because the whole publishable set is one changeset `fixed` group
  pinned to `@objectstack`'s major.
- 29754cf: Model `code-editor` and `bar-chart` in `AnyComponentSchema`, and repair three catalog fixtures
  
  Both types render — `@object-ui/plugin-editor` registers `code-editor`,
  `@object-ui/plugin-charts` registers `bar-chart` — and neither had a Zod member,
  so `safeValidateSchema` (and therefore `objectui validate`) refused every
  document that named them, whatever the document said. `CodeEditorSchema` and
  `BarChartSchema` are now declared in `@object-ui/types` and mirrored in
  `@object-ui/types/zod`, derived key-for-key from what the two renderers
  demonstrably read rather than from a view of what either component ought to
  accept.
  
  Alongside them, three `examples/schema-catalog` entries that were wrong about
  their own renderer: `basic-select`'s third option spelled its label `type`, so
  the option rendered blank; `icon-toolbar`'s buttons carried only `icon`/`value`,
  which `button-group` never reads, so all three rendered blank; and `basic-tabs`
  gave its items no `value` and no `defaultValue`, so no panel could be selected.
- b84dc18: Three exported type names inside `@object-ui/types` had two authorities each; each now has
  one (objectui#6349, first batch — the three intra-package collisions from the 46-name
  census on objectui#6273).
  
  **`ActionSchema` — renamed, because the two shapes are unrelated.** `crud.ts` and
  `ui-action.ts` both declared it. Measured member-by-member they share 9 keys out of 28 each:
  `crud.ts` `extends BaseSchema` and pins `type: 'action'` (a UI node — a button in a
  component tree), `ui-action.ts` extends nothing and types `type` as `ActionType` (a spec-v2
  action definition, with `name`, `locations`, `params`, `target`). Re-pointing either at the
  other would silently hand a consumer a different type, so this took the rename branch
  (objectui#5044 is the precedent for choosing the surviving name). `ui-action.ts`'s
  declaration is now spelled **`UIActionSchema`** — the name `src/index.ts` has always
  PUBLISHED it under, via `export type { ActionSchema as UIActionSchema }`, which is now a
  plain re-export. **The package's public surface is unchanged**: `ActionSchema` still means
  `crud.ts`'s legacy shape and `UIActionSchema` still means `ui-action.ts`'s, exactly as
  before. Nothing outside `ui-action.ts` imported the old spelling — there is no `./ui-action`
  subpath in `exports`, so the old name was never reachable from outside the package.
  
  **`BreadcrumbItem` / `BreadcrumbSchema` — re-pointed, because one copy was stale.** Both
  were declared in `data-display.ts` and in `navigation.ts`. The data-display pair was not a
  second dialect but a strict SUBSET: no key declared differently on either side, and missing
  `BreadcrumbItem.icon` / `onClick` / `siblings` and `BreadcrumbSchema.maxItems`. Everything
  that reads a breadcrumb was already on the navigation declaration — `registry.ts` maps the
  `'breadcrumb'` component type to it, `src/index.ts` re-exports it under the bare names,
  `zod/navigation.zod.ts` mirrors it (`icon`, `onClick`, `siblings`, `maxItems` included), the
  `ui:breadcrumb` renderer consumes it, and the component's own documentation page documents
  `icon` and `maxItems`. `data-display.ts` now re-exports the one authority.
  
  **What changes for a consumer.** The `@object-ui/types/data-display` subpath is published, so
  its `BreadcrumbItem` / `BreadcrumbSchema` and the `DataDisplaySchema` union's breadcrumb
  member widen to the navigation declaration — they gain the four keys above. Nothing narrows
  and no key changes type, so every value that type-checked before still does; what the subpath
  now declares is what the renderer already honoured and the docs already described. Graded
  `minor` because a published `.d.ts` member changes shape, per this repo's version-alignment
  rule (never `major`).
  
  The three `KNOWN_COLLISIONS` lines came down in the same change; that baseline
  (`scripts/__tests__/one-authority-per-exported-name-6273.test.ts`) is shrink-only and fails in
  both directions, so converging without deleting them would have been red too. 43 entries → 40.
- ac8abb0: The last two exported type names with two authorities *inside* `@object-ui/types` now have
  one each (objectui#6349, second batch — the remaining intra-package collisions from the
  census on objectui#6273). Both took the **rename** branch, because in both cases the two
  declarations are genuinely different types; the surviving spelling is in each case the name
  `src/index.ts` has always published that declaration under, so **no importable name
  changes** and the barrel alias becomes a plain re-export.
  
  **`MenuItem` — renamed to `AppMenuItem` in `app.ts`.** `app.ts` declared a flat,
  all-optional `interface` (`type?: 'item' | 'group' | 'separator'`, `label`, `icon`, `path`,
  `href`, `children`, `badge`, `hidden`) — the `@deprecated` legacy navigation item that
  `AppComponentSchema.menu`, `AppAction.items` and `menuItemToNavigationItem` read.
  `overlay.ts` declared a discriminated **union**, `MenuCommandItem | MenuDividerItem`, whose
  command arm requires `label` and whose both arms **tombstone** `type` as `type?: never`
  (objectui#6523) — precisely the key `app.ts` declares as a three-value enum. Re-pointing
  either at the other would have made an authored `type: 'separator'` legal on one side and a
  type error on the other, so the two names had to part. `@object-ui/types` continues to
  publish overlay's union as `MenuItem` and app's interface as `AppMenuItem`, exactly as
  before.
  
  **`ValidationFunction` — renamed to `FieldValidationFunction` in `field-types.ts`.**
  `data-protocol.ts` declares `(value, context?: ValidationContext) => boolean | string`;
  `field-types.ts` declared `(value) => boolean | string | Promise<boolean | string>`. They
  disagree at both ends of the arrow — different parameter lists, and a `Promise` return that
  the data-protocol signature does not admit — so field-types' is not assignable to
  data-protocol's in the direction that matters. `data-protocol.ts` had said so in prose ("may
  differ from similarly named validation function types in other packages (e.g., in
  `field-types`)") for as long as both existed. The published names `ValidationFunction`
  (data-protocol's) and `FieldValidationFunction` (field-types') are unchanged.
  
  Both `KNOWN_COLLISIONS` lines come down in the same change; that baseline fails in **both**
  directions, so converging without deleting them is red too. 38 entries -> 36.
- 9d86e1d: Retire the `timeScale` alias on the timeline node — `scale` is the only axis spelling
  (objectui#6355, maintainer ruling 2026-08-27).
  
  **BREAKING for authored metadata.** `timeScale` was this renderer's pre-spec spelling of the
  Gantt axis bucket. `scale` is canonical — it is `@objectstack/spec` `ui/TimelineConfig.json`'s
  axis key and the key the renderer preferred (objectui#6170 ruling, 2026-08-25: `timeScale`
  goes the alias-retirement route, not a silent second spelling). objectui#6355's ruling
  retires it immediately, with no phased window, while the project is at startup stage.
  
  **What breaks, and how you will find out.** A timeline document that spells `timeScale` is
  now **refused**, loudly, at the authoring boundary:
  
  - `TimelineSchema.timeScale` is declared `?: never` — writing it is a type error;
  - the Zod twin declares `z.never().optional()` — parsing a document that carries the key
    fails with `invalid_type` / `expected: never` on the `timeScale` path.
  
  The fix is a rename: `timeScale` → `scale`. The accepted values are unchanged (`hour`,
  `day`, `week`, `month`, `quarter`, `year`), so no value needs rewriting.
  
  **Why a tombstone rather than deleting the key.** `BaseSchema` is `.passthrough()` on the
  Zod side and carries `[key: string]: any` on the TS side, so an *undeclared* key is accepted
  unvalidated by both halves. Deleting `timeScale` outright would have let the retired spelling
  parse green and type-check green while the renderer no longer read it — the Gantt axis would
  silently fall back to the `month` default, the chart would change bucket, and nothing would
  error. That is the silent axis breakage objectui#2942 closed, running in the other direction,
  and it is the specific outcome this retirement is shaped to prevent. Keeping the key declared
  as `never` on both halves is what makes the removal audible. Absent stays valid on both, so a
  document that never wrote the alias is untouched.
  
  Also in this change:
  
  - `resolveTimelineScale` drops the `?? schema.timeScale` fallback read; its parameter narrows
    to `{ scale?: unknown }`.
  - The designer drops its deprecated `timeScale` input. The `scale` input already offers all
    six buckets.
  - `ObjectTimeline` now emits the resolved axis under `scale` when it composes the schema it
    hands to the renderer. It previously wrote the alias, which would have made **every**
    object-bound Gantt fall through to the `month` default the moment the fallback read went —
    silently, since that is a composed schema no author ever sees. Writing `scale` after the
    spread also restores the precedence the surrounding code intends: a `timelineConfig.scale`
    now actually beats a flat `schema.scale`, where under the alias the resolver's
    `scale ?? timeScale` ordering let the flat key win.
  - The two in-repo authors are migrated in the same change: the schema-catalog
    `gantt-style-timeline.json` fixture and the registration's own `examples.gantt` block.
  - Docs drop the `timeScale` row and gain a retirement callout;
    `packages/components/.../TIMELINE.md`'s Gantt table now documents `scale` with the full
    six-value vocabulary it has accepted since objectui#2942 (its row still claimed three).
  
  Version note: `minor`, not `major`, per AGENTS.md §版本号策略 — objectui's major tracks the
  `@objectstack` major and all publishable packages share one `fixed` group, so a breaking
  narrowing is declared `minor` with the break spelled out here.
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
- 3190414: `TableColumn` declares `fitContent`, the content-hugging flag `data-table` has
  honoured all along (objectui#6424, maintainer ruling 2026-08-28, Option A — the
  card's second key, in the shape #6615 landed `headerIcon` in).
  
  The key was undeclared-but-honoured: `data-table` skips `fitContent` columns in
  the auto-width pass and renders them as a `width:1%` + `whitespace-nowrap` cell
  with no `overflow-hidden` clamp — but the published declaration refused the key,
  so a typed author writing `{ accessorKey: '_actions', fitContent: true }` got a
  compile error for a key the renderer implements, and `TableColumnSchema.parse`
  silently STRIPPED it, while the same key placed by an untyped producer worked.
  The runtime admitted a vocabulary the declaration refused — the second de-facto
  contract AGENTS.md #0.1 forbids, here with the CONSUMER out of step.
  
  Retiring the reads instead was excluded BY MEASUREMENT, not preference: shipped
  source authors the key (`ObjectGrid` writes `fitContent: true` on the injected
  row-actions `_actions` column) and `data-table-fit-content.test.tsx` pins the
  result. Retiring would re-clip inline row-action buttons.
  
  - `TableColumn.fitContent?: boolean` — serializable metadata, unlike the
    `React.ReactNode` slot `headerIcon` is.
  - `TableColumnSchema` mirrors it as `z.boolean().optional()`: the flag now
    SURVIVES parse instead of vanishing, and a non-boolean is a loud refusal
    naming the key rather than acceptance-without-validation. Pinned by output
    survival, not parse acceptance — acceptance was green before, while the flag
    was stripped.
  - `StaticTableColumn` / `StaticTableColumnSchema` tombstone it (`?: never` +
    `z.never().optional()`), per #5474's lockstep rule: every rich key needs a
    deliberate static-side decision, and the static renderer has no auto-width
    pass to opt out of (its measured read set is the five live keys). Authoring
    it on a static `table` column is a loud parse refusal naming the key, not a
    silent strip.
  
  No runtime behaviour changes in `data-table` itself — the reads were already
  live; the declaration and the parse road now agree with them. The two
  `(col as any).fitContent` sites drop with the declaration, but that removal is
  bookkeeping rather than the fix: `col` is already `any` at both sites, widened
  by the file's own `col: any` normalization, so the casts were redundant at
  compile time today. They become load-bearing the moment those render callbacks
  are typed — which is the standing instrument gap, not closed here.
- 4e480f5: `TableColumn` declares `headerIcon`, the icon node `data-table` has rendered into the
  header cell all along (objectui#6424, maintainer ruling 2026-08-27, Option C per-key).
  
  The key was undeclared-but-honoured: `data-table` renders `col.headerIcon` before the
  header text, and `ObjectGrid` writes it for `showColumnTypeIcons` — but the published
  declaration refused it, so a typed author writing `{ accessorKey: 'x', headerIcon: icon }`
  got a compile error for a key the renderer implements, and `TableColumnSchema.parse`
  silently STRIPPED it, while the same key placed by an untyped producer worked. The runtime
  admitted a vocabulary the declaration refused — the second de-facto contract AGENTS.md
  #0.1 forbids, here with the CONSUMER out of step.
  
  - `TableColumn.headerIcon?: React.ReactNode` — a runtime slot like `cell`, not
    serializable metadata.
  - `TableColumnSchema` mirrors it (`z.any()`, passthrough): the node now SURVIVES parse
    instead of vanishing. Pinned by output survival, not parse acceptance — acceptance was
    green before while the icon was stripped.
  - `StaticTableColumn` / `StaticTableColumnSchema` tombstone it (`?: never` +
    `z.never().optional()`), per #5474's lockstep rule: every rich key needs a deliberate
    static-side decision, and the static renderer never read this one. Authoring it on a
    static `table` column is a loud parse refusal naming the key, not a silent strip.
  
  No runtime behaviour changes in `data-table` itself — the reads were already live; the
  declaration and the parse road now agree with them.
  
  The card's second key, `fitContent`, is deliberately NOT declared and NOT retired here:
  the ruled measurement found real authors (`ObjectGrid`'s row-actions column authors
  `fitContent: true` on `main`), so per the ruling that arm goes back to the decision box
  with the reading rather than into this PR.
  
  Scope of the enforcement claim, measured: the declaration, the parse road, and the
  renderer's behaviour now agree; the renderer's internal column reads remain any-mediated
  (the `col: any` normalization in `data-table.tsx`) — a standing instrument gap, not
  closed here.
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
- 713db46: **`ObjectGanttSchema` now declares the `gantt` BLOCK face — and the spec's
  required trio enforces at validate/check time.**
  
  The `gantt` nested-block spelling of a gantt config (`{ type: 'object-gantt',
  gantt: { … } }`) had **no mirror entry at all**: it rode through
  `BaseSchema`'s `.passthrough()` entirely unvalidated, and the published
  TypeScript never taught the shape either — an author writing `gantt: { … }`
  got no completion, no type checking, no error on a misspelt member. It was
  the 28th and last of the keys `getGanttConfig` (`plugin-gantt/src/ObjectGantt.tsx`)
  reads off the schema that objectui#6051 (PR #6472) did not declare — severed
  into its own card because, unlike the other 27, declaring it changes what a
  published tool refuses.
  
  Both faces now declare it:
  
  ```ts
  // packages/types/src/objectql.ts
  gantt?: GanttConfig;
  
  // packages/types/src/zod/objectql.zod.ts
  gantt: SpecGanttConfigSchema.extend(GanttConfigExtensionFields).optional(),
  ```
  
  `GanttConfig` derives from the spec's `GanttConfigSchema`, which has required
  `startDateField`, `endDateField` and `titleField` since rc.6.
  
  **What the CLI now refuses that it accepted before:** `ObjectGanttSchema` is a
  member of `AnyComponentSchema`, so it reaches `safeValidateSchema` and
  therefore the CLI's `validate` and `check` commands. A `gantt` block missing
  any of the three required fields — previously accepted silently — is now
  **refused**, naming the missing field. A block carrying all three, or a
  schema with no `gantt` block at all, is accepted exactly as before.
  
  **This is a `declared = enforced` restoration, not new requiredness.**
  `getGanttConfig`'s block branch already fed the block to
  `GanttConfigSchema.safeParse` and logged `[ObjectGantt] Invalid gantt
  configuration` to the console on failure — a block missing the trio was
  already non-functional at runtime, silently. What changes is *when* the
  author is told: runtime console warning becomes an authoring-time refusal.
  
  Maintainer ruling, objectui#6475 (2026-08-27), **Option A** — enforce as-is,
  immediately, no warning window (the startup-stage no-gradualism rule,
  objectstack#12668: transitions do not get phased windows without named
  external-user evidence, and none exists here). A census of every `gantt`
  block reachable through `ObjectGanttSchema` in this repository — the
  `examples/schema-catalog` fixtures, `content/docs/plugins/plugin-gantt.mdx`,
  and the published `skills/objectui/guides/page-builder.md` guide — found
  **zero** blocks missing the trio.
- bf3a03c: `ToastSchema` now declares the two trigger-button keys the `toast` renderer actually reads
  (objectui#6496, triage scope cut 2026-08-26 — the same declare-what-runs family as
  objectui#6170).
  
  `renderers/feedback/toast.tsx` renders a `<Button>` that raises the toast, and reads two
  keys off the node to do it: `variant={schema.buttonVariant}` and
  `{schema.buttonLabel || 'Show Toast'}`. `ToastSchema` declared **neither**, on the TS face
  or in the `@object-ui/types/zod` mirror. The registration's own designer `inputs` offered
  `buttonLabel` (with `defaultValue: 'Show Toast'`), so the designer shipped a control for a
  key the published type did not have; `buttonVariant` was read by the renderer and named by
  nothing at all. `SonnerSchema` — the sibling with the identical trigger mechanism —
  declared both all along, so only one of the two components was expressible.
  
  The visible cost was on objectui#6250: with `buttonLabel` undeclared, its seven corrected
  toast demos could not author a per-demo trigger label the way the corrected sonner demos
  could, and all seven render the default `Show Toast`. Those demos are unblocked by this.
  
  **`buttonVariant` is declared as the six Button variants, on both faces.** The model this
  card was told to copy disagrees with itself: `SonnerSchema` spells the key `z.string()` in
  the zod mirror and `'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'`
  in TS. Matching by symmetry picks nothing, so the shape was taken from what the value
  *reaches* — the renderer passes it straight into `<Button variant={…}>`, whose prop type is
  `VariantProps<typeof buttonVariants>['variant']`, exactly those six. The TS face is the
  correct one and both faces here carry it.
  
  An open `string` is not merely under-validation. Measured on `cva` 0.7.1: an unrecognised
  variant key contributes **no** variant class, and `defaultVariants` applies only when the
  value is *absent* — so `buttonVariant: 'primary'` renders a button with no background and
  no text colour, silently, while `buttonVariant: undefined` renders the default look
  correctly. `primary` is the likeliest wrong spelling precisely because the default
  variant's own class is `bg-primary`. And `buttonVariant: ''` is silently resolved to
  `default` by the same falsy fallback — the one wrong value that does not *look* wrong,
  which an open `string` would accept and never signal. That the declared six are the Button's own vocabulary
  is pinned in both directions in `components/src/__tests__/toast-button-variant-parity.test.ts`
  — `@object-ui/types` has zero deps and cannot import the Button, so the list there is
  necessarily hand-copied, and that file is what stops it being a copy that can drift.
  
  **`SonnerSchema`'s own two faces are left disagreeing.** Its mirror stays `z.string()`.
  That is a real defect on a published surface, and it is filed as objectui#6541 rather than
  fixed here —
  this card's face is `ToastSchema`, and narrowing a second published key is its own
  accept-set change with its own consumers to measure.
  
  **Direction 2 of the finding is untouched.** `action` and `onDismiss` are declared on
  `ToastSchema` and read by no renderer; they sit immediately adjacent to this edit and are
  byte-identical after it. They are enforce-or-remove on a published type and belong to the
  objectui#6124 unsatisfiable-mirror census feeding the objectui#6182 handler-dialect
  decision; they are deliberately not pinned here either, so that family's ruling lands
  without a test of this card's to negotiate with.
  
  Accept-set note for consumers: both keys are **optional** and materialise no default, so
  nothing that renders today stops rendering and no stored toast JSON becomes invalid. Two
  keys that previously resolved as `any` through `BaseSchema`'s index signature are now
  typed, so `buttonLabel: 42` and a `buttonVariant` outside the six are a type error and a
  Zod rejection where they used to pass silently — values that never rendered correctly in
  the first place. `BaseSchema` is untouched, so an *undeclared* key is still accepted by
  both halves (objectui#5155 / objectui#6269 own that ceiling); declaring these two bought
  validation of the declared keys, not rejection of misspellings.
- 29cb85b: `MenuItem` is now a discriminated union, and all three menu renderers read the keys it
  declares (objectui#6523, objectui#6346, maintainer ruling 2026-08-27 — "one answer for the
  whole `MenuItem` family").
  
  **The break, spelled out.** `MenuItem` (`@object-ui/types`, shared by `ui:dropdown-menu`,
  `ui:context-menu` and `ui:menubar`) used to be a single object with `label: string`
  required unconditionally. It is now `MenuCommandItem | MenuDividerItem`: a command item
  (`label` required, plus `icon`/`disabled`/`onClick`/`shortcut`/`children`) or a divider
  (`{ separator: true }`, nothing else). The union — not `label?: string` — is deliberate: it
  is what the data actually is, and it keeps the command arm's label protection intact rather
  than weakening it repo-wide to accommodate the divider. Both arms also tombstone `type`
  (`type?: never` / `z.never().optional()`): the retired `{ type: 'separator' }` (and its
  sibling `{ type: 'label' }`) is now a **declared refusal** at parse time, not a silent strip.
  A consumer's own `MenuItem[]` authored with either retired spelling now fails
  `MenuItemSchema.safeParse` and fails `tsc` under the published `.d.ts`; a consumer authoring
  the declared `{ separator: true }` divider now **succeeds** for the first time — before this
  change it failed a strict parse too, because `label` had no way to be omitted.
  
  **Renderer accept behaviour changes to match.** `dropdown-menu` and `context-menu` used to
  branch on the undeclared `item.type === 'separator'`; an author who instead wrote the
  DECLARED `{ separator: true }` got a value that validated, published, and rendered a blank
  menu row (the divider fell through to the ordinary item branch with no `label`). Both
  renderers now branch on `item.separator`, matching `menubar` — which had this right all
  along and is the evidence the type, not those two renderers, was correct. Their registry
  `defaultProps` and `description` strings stop teaching the retired dialect; the 4 places it
  appeared in this repo (2 schema-catalog fixtures, 2 registry `defaultProps`) are migrated.
  
  **The item handler moves to the declared key (objectui#6346).** All three renderers now
  fire `item.onClick` — the key `MenuItem` has always declared (TS source, built `.d.ts`, and
  the Zod mirror all agreed) but that `dropdown-menu`/`context-menu` never read (they read an
  undeclared `item.onSelect` instead) and that `menubar` wired nowhere at all. An author who
  followed the published type and set `onClick` got a value that validated, published, and
  never fired; that is fixed. `renderMenuItems`/`renderContextMenuItems` also tighten from
  `items: any[]` to `items: MenuItem[]` — the widening that let the mismatch type-check in the
  first place. Migration cost measured **zero** in this repo: no fixture, doc or test authored
  `onSelect` on a menu item before this change.
  
  **Rider, recorded as parity not new capability.** `menubar` now also renders the declared
  `shortcut` string — `dropdown-menu` and `context-menu` already drew it, so this aligns the
  third container rather than expanding the surface.
  
  Everything that rendered correctly before this change still renders the same way; the
  narrowing only refuses spellings that were already unprotected (silently stripped or never
  read at all).
- 3e028c8: One tombstone registry for the designer seam's retired field keys
  (objectui#6527). Three independently maintained `RETIRED_FIELD_KEYS` literals
  — the metadata-admin read door (`object-fields-io.ts`), `MetadataService`'s
  carry-over and `MetadataFieldsPage`'s carry-over — become derivations from a
  single registry in `@object-ui/types` (`RETIRED_FIELD_KEY_TOMBSTONES` +
  `retiredFieldKeysFor(site)`), naming each retired key, the card that retired
  it, and its PER-SITE applicability.
  
  Per-site behaviour is unchanged — this is a consolidation, and each site's
  effective strip set is pinned equal to its pre-consolidation literal. The two
  deliberate asymmetries a naive union would have destroyed are now recorded as
  data and pinned:
  
  - `formula` stays stripped by the two write-side carry-overs and is NOT
    stripped by the read door — ruled on objectui#6526 (option B): the
    `ObjectFieldInspector` migration path (objectui#6043) stands, and the
    registry test makes that ruling mechanical.
  - `sortOrder` stays a single-site strip at `MetadataService`'s carry-over,
    now explicitly recorded as the registry's one DEFENSIVE entry (objectui#6045
    measured that no shipped writer ever populated a field-level one).
- ce503e5: **Accept-set NARROWING on a published surface.** `SonnerSchema.buttonVariant` in the zod
  mirror (`@object-ui/types/zod`) was `z.string()`; it is now
  `z.enum(['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'])`. Values
  outside those six — `'primary'`, `'danger'`, `'Default'`, `''` — used to validate and now
  fail. Stated as a narrowing rather than as a fix, because it removes values the published
  mirror accepted (objectui#6541).
  
  **What was wrong.** The same key on the same component shipped as two disagreeing published
  faces: an open string to anyone validating (`@object-ui/types/zod`), and a closed
  six-member union to anyone type-checking (`@object-ui/types`, `SonnerSchema.buttonVariant`
  in `feedback.ts`). The TS face was already correct — only the mirror is changed here, so
  this is the mirror being made to agree with a declaration that sat beside it all along.
  
  **Why the wide face was wrong and not merely wide.** `renderers/feedback/sonner.tsx` passes
  the value straight into `<Button variant={…}>`, whose vocabulary is exactly those six keys
  of `buttonVariants`. Measured on `cva` 0.7.1, an unrecognised key contributes **no** variant
  class, and `defaultVariants` applies only when the value is absent *or falsy*:
  
  ```
  buttonVariants({ variant: undefined }) -> "… bg-primary text-primary-foreground …"  default look
  buttonVariants({ variant: 'ghost'   }) -> "… hover:bg-accent …"                     real variant
  buttonVariants({ variant: 'primary' }) -> "…"                                       NO colour at all
  buttonVariants({ variant: ''        }) -> "… bg-primary …"                          silently 'default'
  ```
  
  So the mirror was validating values the renderer visibly breaks on: `'primary'` — the
  likeliest wrong spelling, since the default variant's own class is `bg-primary` — rendered a
  button with no background and no text colour, and `''` was silently reinterpreted as
  `default`. Nothing that renders correctly today stops validating.
  
  **Blast radius, measured.** The key stays optional, so every published `sonner` node that
  omits it keeps parsing. The two fixtures in the repo that set it
  (`examples/schema-catalog/src/schemas/components-feedback-sonner/{error,promise-based-toast}.json`)
  use `destructive` and `outline` — both inside the six. No consumer was found relying on a
  seventh spelling.
  
  **Model inherited, not invented.** objectui#6496 landed exactly this spelling on
  `ToastSchema` for the same trigger mechanism, matched to `ButtonProps['variant']` as ground
  truth. This card applies the settled shape to the sibling that still disagreed with itself.
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
- 7a5da14: `DetailViewSection.headerColor` is now the closed six-token vocabulary on both halves of
  the contract — the TypeScript declaration and the `@object-ui/types/zod` mirror — instead of
  `string` / `z.string()` (objectui#6594, maintainer ruling A of 2026-08-26 recorded at
  objectstack#12126). The six are `muted`, `muted/50`, `accent`, `primary/10`, `secondary/10`
  and `destructive/10`: exactly what `@object-ui/plugin-detail`'s `HEADER_COLOR_CLASSES`
  resolves (objectui#6178) and exactly what `@objectstack/spec` declares on its strict
  `record:details` section schema (objectstack PR #12616).
  
  ## ⚠️ Accept-set narrowing — these spellings stop validating
  
  `DetailViewSectionSchema.headerColor` was `z.string().optional()`, so **any string parsed
  green** while the renderer contributed no class for most of them. It is now
  `z.enum([...]).optional()`: a value outside the six is refused at parse time with
  `headerColor` named in the error path, and is a `tsc` error at every authoring site typed
  against `DetailViewSection`.
  
  **Authored metadata in this repo needs no migration.** Measured before tightening, across
  the whole tracked tree: `headerColor` occurs in **ten files, none of them authored
  metadata** — the renderer and its tests, the two declaration files changed here, and two
  markdown notes. `examples/`, `content/`, `apps/`, `e2e/` and `docs/` contain **zero**
  occurrences (positive control: `sections` and `detail-view` both hit in those directories,
  so the census reached them). Nothing in the repo authors a value outside the six.
  
  ## The renderer's `bg-*` pass-through is deliberately NOT declared
  
  `headerColorClass` also hands a value that is already a complete `bg-*` class through
  untouched. Ruling A rejected declaring that (option B, "the capability illusion"): whether
  such a class renders depends on the host app's Tailwind build, so declaring it would promise
  a capability the contract cannot keep. It stays a renderer affordance — still supported by
  the renderer, never invited by the contract. The three renderer tests that exercise
  off-contract values (`bg-accent`, `not-a-token`, `constructor`) now route them through a
  documented `offContract()` seam in `DetailSection.headerColor.test.tsx`, which is the visible
  consequence of the narrowing rather than a workaround for it: metadata still arrives as JSON
  over the wire, where no compiler was involved, so the renderer must keep behaving sanely.
  
  ## The three ends cannot drift
  
  `packages/plugin-detail/src/__tests__/headerColor.contractPin-6594.test.ts` pins the resolver,
  the TypeScript declaration and the zod mirror against the ruled vocabulary — the resolver's
  key set one-to-one at runtime, the declaration by invariant type equality, the mirror by
  reading its own enum options. It fails in **both** directions: a seventh token on any one end,
  or one of the six dropped from any one end, turns it red, and the comparator itself is pinned
  against synthetic inputs so the guard has been shown to fail rather than only to pass.
  
  ## Shape, and where it departs from the nearest precedent
  
  The nearest precedent is objectui#5853 (`.changeset/5853-tablecolumn-type-canonical-union.md`),
  which narrowed `TableColumn.type` on the same three-ends pattern and **exported** a
  `TABLE_COLUMN_TYPES` tuple for the zod mirror to build its enum from. That shape is not
  available here and the difference is structural, not a preference: `packages/types/src/views.ts`
  is a **type-only** module, so a tuple there would add a runtime export to the package barrel
  (a value export cannot ride the barrel's `export type` block) and a runtime import edge from
  the zod entry into `views.js`. #5853 had a second reason to export — producers needed its
  `normalizeTableColumnType()` at their emit seam — and `headerColor` has no producer that needs
  a runtime value. The literals are therefore written on each half and the anti-drift guarantee
  is carried by the pin above, which also covers the third end a shared tuple could not reach:
  the renderer, in a package `@object-ui/types` must not depend on.
- 2c1c967: `ObjectGridSchema`'s zod mirror declares `title`, the deprecated legacy
  caption/export-file-title fallback the interface has declared all along and
  `ObjectGrid` reads at both of its `schema.label || schema.title` sites
  (objectui#6639, census-directed maintainer ruling 2026-08-29, declare branch:
  authored `object-grid.title` nodes exist, so the key is declared rather than the
  read retired — dropping the read would have silently cost those nodes their
  caption).
  
  The gain is the typed refusal: the mirror's `.passthrough()` base was already
  admitting any `title` unexamined, and it now enforces the declared `string`.
  `zod-mirror-parity.test.ts`'s `UnmirroredDeclared` ledger records the key as
  worked off — the ledger's first shrink by repair (97 + 1 mirrored + 23
  reclassified is what the seeded "121" now means).
- 3561bd2: **Breaking for authored metadata:** `DataTableSchema.toolbar` is RETIRED
  (objectui#6881, maintainer ruling 2026-08-31). A `data-table` node that authors
  `toolbar` no longer validates — the parse fails loudly on the `toolbar` path
  with the remediation in the message — and the TS member is a `?: never`
  tombstone, so the same document is refused at compile time.
  
  **What was measured.** The key was declared on both published faces —
  `data-display.ts` (`toolbar?: SchemaNode[]`, "Table toolbar actions/content")
  and the Zod mirror (`SchemaNode | SchemaNode[]`) — documented, mirrored, and
  read by NOTHING: `data-table.tsx`, the registered renderer for
  `type: 'data-table'`, contains the word only in two prose comments and never
  reads `schema.toolbar`. The sibling `emptyAction` slot on the same interface IS
  mounted through `SchemaRenderer`, so the census zero is a reading, not a blind
  query. An author who wrote a toolbar got a green document and a blank result,
  with no signal anywhere that said so — the declared-vs-enforced failure mode
  that is worst for AI-authored metadata, which has nothing but the declaration
  to go on.
  
  **Who is affected — a `toolbar` authored directly onto a `data-table` node,
  in either spelling:**
  
  ```json
  { "type": "data-table",
    "columns": [{ "header": "Name", "accessorKey": "name" }],
    "data": [],
    "toolbar": [{ "type": "button", "label": "Refresh" }] }   // ← was tolerated, rendered nothing
  ```
  
  now fails validation with:
  
  > RETIRED (objectui#6881) — never mounted by the data-table renderer; use the
  > built-in toolbar chrome (searchable / exportable), or compose nodes beside
  > the table
  
  The single-node spelling `"toolbar": { … }` — which only the Zod mirror ever
  accepted; the TS face always refused it — is refused the same way, so the two
  faces now agree by refusing both.
  
  **Who is NOT affected.** A document that never wrote the key is untouched
  (`absent` stays valid), and every other `SchemaNode` slot — `emptyAction`
  included — is unchanged. No fixture, example, catalog entry, doc page or app
  in this repository authored the key (measured: all five
  `components-complex-data-table` catalog schemas are toolbar-free, and every
  other `toolbar` occurrence repo-wide is an i18n key, an ARIA role, or an
  unrelated React prop of the same name).
  
  **Migration:** use the built-in toolbar chrome (`searchable` / `exportable`),
  or compose your own nodes beside the table. Per the ruling, a real toolbar
  slot must arrive as a redesigned proposal WITH its enforcing reader — published
  zero-consumer capability gets no sunk-cost exemption.
  
  Graded `minor`, not `patch`: this narrows the accepted input set, which is
  breaking for any author who wrote the tolerated key. It is not `major` per
  this repo's fixed-group convention (objectui's own breaking changes ship as
  `minor`; the group's major tracks `@objectstack` — AGENTS.md 版本号策略,
  mechanically enforced by `scripts/check-changeset-no-major.mjs`).
- bf97b98: feat(types): declare `renderCellEditor` and schema-level `cellClassName` on `DataTableSchema`
  
  `data-table` has read both keys on its production path all along — `renderCellEditor`
  through a `(schema as any)` cast, `cellClassName` by destructuring it into the class of
  its three utility cells (the selection checkbox, the row number, the row actions).
  Neither was declared, so authoring either one was unchecked: a misspelling produced no
  error and no widget, and no editor completion offered them.
  `DataTableSchema` now declares both, and the cast in `data-table.tsx` is gone rather
  than replaced.
  
  What you can write after this change that you could not write before, exactly:
  **nothing new runs.** Both keys had the same effect yesterday, because
  `BaseSchema`'s `[key: string]: any` already admitted them at any type at all. What
  changes is that they are now *checked* and *documented*:
  
  ```ts
  const schema: DataTableSchema = {
    type: 'data-table',
    columns, data,
    cellClassName: 'px-2 py-1 text-sm',        // utility cells only (see below)
    renderCellEditor: ({ column, value, commit, cancel }) =>
      column.type === 'select'
        ? <MyPicker value={value} onSelect={commit} onDismiss={cancel} />
        : null,                                  // null → fall through to the built-in editor
  };
  ```
  
  ⚠️ **One reject direction, deliberate.** Because the keys were previously absorbed by
  the index signature as `any`, authored values of the *wrong shape* also compiled and
  silently did nothing. They are now compile errors:
  
  - `cellClassName` is declared `string`, matching `BaseSchema.className` and
    `TableColumn.cellClassName`. The renderer passes it through `cn()`, which would
    also swallow `['a','b']` or `{ a: true }` — those spellings now fail to compile.
    One authored spelling for a class slot is the contract.
  - `renderCellEditor` is declared as the function `data-table` actually calls. A
    non-function value (or a function with an incompatible context/return type) now
    fails to compile instead of being ignored at runtime.
  
  ⚠️ **What the schema-level `cellClassName` actually styles.** It is NOT the
  table-level twin of the per-column key: the two reach **disjoint** cells. Measured on
  the render, the schema-level key is folded into the **utility** cells only — the
  selection-checkbox cell, the row-number cell and the row-actions cell — while every
  **data** cell folds `TableColumn.cellClassName` and nothing else. Row density is
  therefore a pair of settings (`ObjectGrid` sets both), and the schema-level key alone
  leaves data cells at the primitive's default `p-4`. The docblock, the zod `describe`
  and `content/docs/components/complex/data-table.mdx` all say this now.
  
  No runtime behaviour changed anywhere, and nothing was retired. The zod mirror
  (`@object-ui/types/zod`) gains both keys in the same stroke, so the validator accepts
  what the published types now invite.
- b0d308d: Retire `ChartDataSeries.data`, and correct `ChartSchema.categories`' prose to the read it
  has always had (objectui#6896, ADR-0049 enforce-or-remove; maintainer ruling 2026-08-31).
  
  ⚠️ **BREAKING for anyone authoring a static `ChartSchema` node**, shipped as `minor`
  because this repository's `major` is a cross-repo pin to `@objectstack`'s major rather than
  a severity dial. The break is announced here, which is the channel that carries it.
  
  ## `ChartDataSeries.data` — RETIRED
  
  `data: number[]` was **required** on every authored series and read by nothing.
  `normalizeChartSchema`'s `normalizeSeries` (`@object-ui/plugin-charts`) reads `dataKey` /
  `name`, `label`, `chartType` / `type`, `variant`, `opacity`, `dashArray`, `stack`, `yAxis`
  and `color` — `data` is not among them. Rows come from the chart node's **chart-level**
  `data`, a key `ChartSchema` never declared at all, which survives only because `BaseSchema`
  carries an index signature and so suppresses excess-property checking on chart literals.
  The declaration therefore demanded numbers no reader consumed, and no author could omit
  them.
  
  FROM → TO:
  
  - `data: number[]` (required) → **`data?: never`**, an ADR-0049 retirement tombstone. Put
    the rows on the chart node's chart-level `data`, name the column with the series' `name`
    (or `dataKey`), and put the category axis on `xAxisKey`.
  
  The accept set moves in **both** directions, and both are deliberate:
  
  - **narrowing** — `{ name: 'Revenue', data: [1, 2, 3] }` was accepted and is now refused;
  - **widening** — `{ name: 'Revenue' }` was refused (`data` was required) and is now
    accepted, which is the shape the renderer has always read.
  
  Deleting the member outright was the option **not** taken: `ChartDataSeriesSchema` is a
  non-strict `z.object`, which strips an undeclared key in silence — one silent no-op traded
  for another. The tombstone keeps the key declared and unwritable, so an authored value is a
  **named refusal carrying its own remedy**: `?: never` on the interface (a `tsc` error at the
  authoring site) and `retirementTombstone()` on the Zod mirror (`code: 'invalid_type'`, the
  key named in the issue `path`, the migration note as the message). Per the ruling —
  创业阶段不渐进 — the tombstone is immediate: there is no deprecation window and no
  dual-reading period.
  
  ## `ChartSchema.categories` — NOT retired; its prose was wrong
  
  The key keeps its behaviour. It is read as an **alternative series list**, consulted only
  when `series` is absent, each entry normalized through the same series normalizer where a
  bare string means `{ dataKey }` — so the strings name **columns to plot**. The category axis
  comes from `xAxisKey` / `xAxis`. The docblock said "X-axis labels/categories", so an author
  following the documentation got a different chart from the documented one. Prose follows
  machine: the docblock, the `ChartDataSeries` header (which promised numbers "positionally
  aligned with the chart's `categories`", a model that never existed) and the Zod
  `.describe()` were corrected to the read. No behaviour changed, and `categories` remains
  writable.
  
  ## The census behind the retirement, re-measured on this branch
  
  Re-measured at merge-base `2c3cd1b75` rather than inherited from the card, with a control
  that had to hit in the same query — the instrument was not blind: it scores
  `packages/types/src/__tests__/report-schema-authoring-face.test.ts` **4** authoring sites.
  
  ⚠️ One correction to the record the ruling rests on. The ruling states *zero* authorship of
  a populated `series[].data` outside tests across `packages/` / `apps/` / `examples/`. The
  re-measurement finds **one such site inside those roots** —
  `packages/types/examples/data-display-examples.json` (2 series) — plus **four outside**
  them, in documentation: `content/docs/api/schema-reference.md` (3) and
  `content/docs/core/report-schema.mdx` (1).
  
  Every one of the five is documentation or an unreferenced example, **not a consumer**: none
  is imported, type-checked, parsed by a test or rendered anywhere, `packages/types` does not
  publish its `examples/` directory, and each authors the *documented* model — month names in
  `categories` next to inline `series[].data` — which renders an empty chart today, because
  `data` is dropped and `categories` is ignored whenever `series` is present. They are
  instances of the divergence this change closes rather than users of a working inline-data
  model, so the ruling's conclusion is unaffected. Their migration is filed separately; until
  it lands, an author copying them now trips the tombstone and reads the remedy instead of
  being silently dropped.
  
  Pinned in `packages/types/src/__tests__/chart-inline-data-retired.test.ts` — both channels,
  the announcement itself, and a counter-probe that builds the deletion this retirement did
  not choose and measures the contrast in the same run — and in
  `packages/plugin-charts/src/normalizeChartSchema.test.ts`, where the `categories` read now
  has behaviour coverage it never had.
- d4493fd: Repair the `filter-builder` mirror: the field key is `value`, the type
  vocabulary is the value families the component actually folds a column into,
  and a filter group is `{ id, logic, conditions }` (objectui#6939, maintainer
  ruling recorded 2026-09-02 — one of the eight groups on that card, dispatched
  as its own PR per the ruling).
  
  Three independent mis-declarations sat in one member, and each is a key-name or
  vocabulary **move** rather than a missing optional key:
  
  1. **`FilterFieldSchema` required `name`.** Every read site matches an entry by
     `value` — `fields.find((f) => f.value === …)` in `getOperatorsForField`,
     `changeField`, `getInputType` and `renderValueInput`, `fields[0]?.value` in
     `addCondition`, and `<SelectItem value={field.value}>` in the field dropdown
     (`packages/components/src/custom/filter-builder.tsx`). `name` had zero read
     sites, and `FilterBuilderProps.fields` in that same file already declares
     `Array<{ value, label, type? }>`. `@object-ui/fields`' `deriveFilterFields`,
     the real producer that builds this list from an object schema, emits `value`
     too, and the published doc
     (`content/docs/components/complex/filter-builder.mdx`) has declared
     `value: string` all along.
  2. **Its `type` enum was `string | number | date | boolean | select`.** `string`
     is a phantom, and `text`, `datetime` and `time` — three of the six
     `FilterValueFamily` members the component folds a column into — were all
     refused.
  3. **`FilterGroupSchema` was `{ operator, conditions }`.** The gate is
     `isValidGroup`, which tests `Array.isArray(v.conditions)` and
     `v.logic === "and" || v.logic === "or"` and nothing else.
  
  All five `components-complex-filter-builder/*` catalog entries author
  `{ value, label, type }` fields and a `{ id, logic, conditions }` group — the
  registration's own `inputs` / `defaultProps` spelling — so the mirror refused
  them while the renderer drew them. Re-measured on `origin/main` at `3e01cb55f`,
  both faces untouched: four refusals at the root (`search-interface` roots at
  `stack`, so `objectui check` counts four for this row, and the `filter-builder`
  it wraps is refused on its own), and five renders this change leaves
  byte-identical (11 / 76 / 65 / 11 / 57 elements, same tag census, same
  `textContent` SHA-256).
  
  **This is `minor`, not `patch`, and the reason is that the accept set MOVES.**
  The ruling grades this class "patch where the accept set only widens toward what
  already renders"; that grading does not hold here. Three refusal classes are
  created, each of which was a legal document before:
  
  - **`fields[].name` as the field key.** `{ name, label, type }` now refuses:
    `value` is required and `name` is not declared, so a field entry spelled the
    old way has no identity at all. A document carrying BOTH keys still validates
    (the undeclared one is stripped), which is the migration path.
  - **`type: 'string'`.** Refused outright. It reached the text control only
    through the unrecognised-word fallthrough in `valueFamilyForFieldType` —
    measured indistinguishable from a nonsense spelling — so nothing that read the
    key ever saw it; but a document that carried it did validate before and does
    not now.
  - **`{ operator, conditions }` as the group shape.** Refused: `logic` is
    required. This is the loudest of the three at render time — a group spelled
    that way already failed `isValidGroup`, fell back to `EMPTY_GROUP` and drew an
    **empty board** (76 elements and three condition rows became 11 and none), so
    the mirror was blessing a shape that never rendered.
  
  The widening half, for completeness: `fields[].value`, `type: 'text'` /
  `'datetime'` / `'time'`, and the `{ id, logic, conditions }` group all become
  legal. On the TypeScript twin the same move applies to `FilterField.value` /
  `FilterField.type` and to `FilterGroup.logic`, so a consumer reading
  `field.name` or `group.operator` stops compiling. `major` is not available in
  this repository (`check-changeset-no-major`), so a breaking change is `minor`.
  
  **Two places this departs from a literal reading of the ruling, both measured
  and both flagged for contract review rather than made quietly:**
  
  - **`select` is RETAINED** in the type vocabulary. The ruling's six-member list
    inherits the finding card's description of `select` as "extra"; it is not.
    `selectLikeTypes = ["select", "status"]` gives it its own operator bucket
    (`equals` / `in` / `notIn`) and its own value control — measured, a `select`
    column draws the option-driven Select and no `<input>` at all, against a text
    box for an unrecognised spelling. Dropping it would refuse a spelling this
    mirror accepts *today* and the renderer draws distinctly, which is a fresh
    instance of the class objectui#6939 exists to close.
  - **The group's `id` is declared OPTIONAL.** `isValidGroup` never consults it
    and nothing reads `filterGroup.id`; deleting it from an authored group renders
    byte-identically. Requiring it would invent a refusal the renderer does not
    make. It stays *declared* because a plain `z.object` strips unknown keys in
    silence, so an undeclared `id` would be admitted unvalidated — declaring it
    buys the type check (`id: 42` now refuses) for a key the catalog authors,
    `EMPTY_GROUP` emits and `onChange` round-trips.
  
  **What this does NOT reach, stated rather than left as an absence.** Two of the
  four census entries — `product-search` and `with-conditions`, plus the
  `filter-builder` nested in `search-interface` — still refuse afterwards, on a
  FOURTH divergence the ruling does not address: they author
  `conditions[].operator` as `eq` / `gt` / `lt`, while `FilterOperatorSchema` is
  the spec's canonical `equals` / `greater_than` / `less_than`. Swapping only
  those three spellings makes both entries parse, which is pinned, so the claim
  "the three ruled divergences are gone from all four" is measured. That
  vocabulary is a genuine fork needing its own ruling — the builder's dropdown ids
  are `notEquals` / `greaterThan`, which this mirror also refuses, while the
  canonical spellings it accepts render a **blank** operator trigger — and it is
  reported on objectui#6939 rather than decided here. Seven further live field
  types (`status`, `currency`, `percent`, `rating`, `lookup`, `master_detail`,
  `user`) each have their own bucket and control and are still refused; they were
  refused before this change as well, so that gap is pre-existing rather than a
  regression introduced here, and it is reported on the same card. The published
  doc for this component already offers all fourteen spellings and already marks
  `type` OPTIONAL, which the mirror still does not — a third declaration that
  agrees with the renderer, pinned here so the gap is measured rather than
  asserted, and left for the same review.
- 240b80f: Rename `KanbanColumn.items` to `cards`, in both halves of the published surface
  (objectui#6939, maintainer ruling 2026-09-02).
  
  **Breaking, deliberately.** `KanbanColumn` declared its card list as `items` in
  `complex.ts` and in the zod mirror `complex.zod.ts`. Every board reads `cards`.
  Measured on `origin/main` `78a3cc238`: `KanbanImpl.tsx` reads `.cards` on 12
  lines, `KanbanEnhanced.tsx` on 8, and `bucketCardsIntoColumns` twice more as
  `col.cards || []`; `.items` had **zero** read sites in either board (a
  same-shaped `.title` control on the same two files returns 8 and 3, so those
  zeros are readings and not a mis-shaped probe). Both catalog entries, the
  plugin docs and `content/docs/api/schema-reference.md` all author `cards`.
  
  The consequence was `declared !== enforced` on a published mirror: every
  authored kanban document failed `safeValidateSchema` with `: Invalid input`
  while rendering perfectly, which is how the type sat in objectui#6318's
  "carries a registered component type but did not validate" bucket.
  
  **Why the rename went this way and not the other.** Renaming the twelve read
  sites to `items` was considered and rejected: `bucketCardsIntoColumns` reads
  `col.cards || []`, so the `items` spelling buckets every column to zero cards.
  Measured through the render harness in
  `examples/schema-catalog/test/kanban-column-cards-6939.test.tsx`, the
  `basic-kanban-board` entry goes from 64 elements reading `To Do2 … Design new
  feature …` to 45 elements reading `No cards3 columnsTo Do0 …` — an empty board.
  The declaration, not the corpus, was the wrong side.
  
  **Migration.** If you author `KanbanColumn` objects against `@object-ui/types`
  or validate them through `@object-ui/types/zod`, rename `items` to `cards`.
  Documents that already author `cards` — which is every document in this
  repository, and what the boards have always rendered — need no change and now
  validate. Documents authoring `items` are refused rather than silently drawn as
  an empty board.
  
  `@object-ui/plugin-kanban` is unchanged; it already declared `cards`.
- 9e37d9b: `binding` on a component input is framework-set, not author-declared: `@object-ui/types` gains `InjectedComponentInput`, the `'field'` binding arm is retired from `@object-ui/sdui-parser`'s `RegistryConfigLike`, and the `as ComponentMeta` cast at the injection seam in `@object-ui/core` is gone (objectui#6950; maintainer ruling of 2026-09-07, director decision batch #69; ADR-0049 enforce-or-remove).
  
  **What was measured.** `binding` was published — the manifest serializer forwards it — and read — `validateTree` records a binding site for it — while `ComponentInput`, the authoring type every registration writes against, did not declare it. The one writer in the tree, `ELEMENT_DATA_SOURCE_INPUT`, therefore carried a hand-written inline type and reached a registration's `inputs` through `as ComponentMeta` in `Registry.register`. Declared narrower than enforced, on a published type — and `ComponentInput`'s own docblock listed `binding` among the forwarded per-input keys.
  
  **The ruling** answered the product question the card asked — may an ordinary registration declare a binding input? — with no. So:
  
  - **`@object-ui/types`** exports `InjectedComponentInput`, an `interface … extends ComponentInput` with the required marker `binding: 'object'`. `ComponentInput` itself does not change: no member is added, and authoring `binding` on a registration stays an excess-property `tsc` error — now on purpose and documented at the interface. The two tombstone docblocks that listed `binding` as a forwarded key now say it is forwarded from the framework's injected input, not authored.
  - **`@object-ui/core`** types `ELEMENT_DATA_SOURCE_INPUT` as `InjectedComponentInput` and splices it through a typed local; the cast is gone. Runtime behaviour is unchanged — the same key, `type`, `binding` and `description` reach the manifest, and `validateTree` still records the binding site.
  - **`@object-ui/sdui-parser`** narrows `RegistryConfigLike.inputs[].binding` from `'object' | 'field'` to `'object'`. The `'field'` arm had zero writers — every `binding:` literal in `packages/`, `apps/` and `examples/` is `'object'`, 7 of 7 at this change's merge-base — and nothing on either side of the manifest resolved a field binding. **Breaking, deliberately:** a config that feeds `manifestFromConfigs` a `binding: 'field'` input is now a type error instead of a manifest entry the server would never resolve. `ManifestInput.binding`, the manifest reader's vocabulary, is not narrowed by this change.
  
  If a real need for author-declared bindings is ever measured, it is filed as a widening of `ComponentInput` with the vocabulary decided then — not by putting the cast back.
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
- 16a725f: **Breaking for authored metadata:** `TreeViewSchema.data` is RETIRED (objectui#6951,
  maintainer ruling B1 of 2026-09-04; ADR-0049 enforce-or-remove). A `tree-view`
  node that authors `data` no longer validates: the parse fails loudly on the
  `data` path with the explanation in the message, the TS member is a `?: never`
  tombstone so the same document is refused at compile time, and the renderer no
  longer reads the key. Write `nodes` — or bind the tree with `bind`, which is
  unchanged and still read first.
  
  **What was measured, on this branch's base.** `TreeViewSchema` declared two
  spellings for its one inline-nodes slot — `nodes` (read second) and `data` (read
  third: `boundData || schema.nodes || schema.data || []` at
  `renderers/data-display/tree-view.tsx:105`), both declared by objectui#6150.
  `data` had been REQUIRED until objectui#6939 / PR #7533 made it optional, so
  this retirement starts from a declared-and-optional member on both faces. The
  in-repo corpus at the retirement: seven `tree-view` nodes under
  `examples/schema-catalog` and `packages/types/examples` plus one `content/docs`
  fence — six on `nodes`, two on `data` (`packages/types/examples/data-display-examples.json`
  and `content/docs/api/schema-reference.md`), both rewritten; no package source
  authored either spelling.
  
  **Who is affected — a `data` authored on a `tree-view` node:**
  
  ```json
  { "type": "tree-view",
    "data": [{ "id": "root", "label": "Project" }] }   // ← was tolerated (read third)
  ```
  
  now fails validation with:
  
  > RETIRED (objectui#6951) — `data` is no longer part of TreeViewSchema; write
  > `nodes` (or bind the tree with `bind`). It was the second spelling of the one
  > inline-nodes slot, read only as the last limb of
  > `boundData || schema.nodes || schema.data || []`, and was retired under
  > ADR-0049 enforce-or-remove with no deprecation window (maintainer ruling B1,
  > 2026-09-04). The renderer reads `bind` then `nodes` now, so an authored `data`
  > would render an empty tree. Rename the key; the array is unchanged.
  
  **Two published faces, one retirement — and why a tombstone, not a deletion.**
  The TypeScript interface `TreeViewSchema` (`@object-ui/types`, `data-display.ts`)
  declares `data?: never`; the Zod mirror `TreeViewSchema` (`@object-ui/types/zod`,
  `data-display.zod.ts`) declares `data` as a `retirementTombstone()`. `BaseSchema`
  already declares `data?: any` (`z.any().optional()` on the mirror), so DELETING
  the member would not have refused the key — it would have ADMITTED it,
  unvalidated, through the base member, and the renderer would have drawn an empty
  tree. The tombstone on the extended schema shadows the base member on both
  faces; the pin measures the base accepting the very document the extended
  schema refuses.
  
  **What the ruling kept, deliberately.** `nodes` stays OPTIONAL and no "at least
  one of" presence rule was added: `{ "type": "tree-view", "bind": "treeNodes" }`
  is a legal, rendering document (`bind` is the first source the renderer reads),
  and a bare `{ "type": "tree-view" }` stays legal as PR #7533 left it.
  `TreeNode.data` — the per-node payload on each tree node — is a different
  member on a different schema and is untouched.
  
  **`@object-ui/components`** — the `tree-view` renderer's read is
  `boundData || schema.nodes || []`; nothing else in the package moves.
  
  **Who is NOT affected.** A document that already wrote `nodes` (the four
  `components-data-display-tree-view/*` catalog entries and the nested tree in
  `components-complex-resizable/editor-interface.json`) is untouched; `title`,
  `bind`, the selection / expansion keys and `className` are unchanged. The
  catalog is now pinned tree-wide against the retired spelling.
  
  **Migration:** rename `data` to `nodes` on every `tree-view` node; the array is
  unchanged. If a document authored both, `nodes` was already the value that
  rendered — delete `data`.
  
  Graded `minor`, not `patch`: this narrows the accepted input set, which is
  breaking for any author who wrote the tolerated spelling. It is not `major` per
  this repo's fixed-group convention (objectui's own breaking changes ship as
  `minor`; the group's major tracks `@objectstack` — AGENTS.md 版本号策略,
  mechanically enforced by `scripts/check-changeset-no-major.mjs`).
- 4dfdcc3: **Breaking for authored metadata:** the `exportOptions` member of the ListView
  zod mirror (`ListViewSchema` in `@object-ui/types/zod`) is now `@objectstack/spec`'s
  own `ListViewSchema.shape.exportOptions`, bound by reference rather than
  restated (objectui#6956). A `list-view` document that authors the retired `'pdf'`
  format — in either spelling, `exportOptions: ['csv', 'pdf']` or
  `exportOptions: { formats: ['pdf'] }` — or a sixth key on the object form
  (`{ formats: ['csv'], compression: 'gzip' }`) no longer validates through this
  package's mirror. It never validated at the platform's publish gate:
  `@objectstack/spec` 17.0.0 removed `'pdf'` from the format enum (objectstack#8010;
  PDF export itself was declined as objectstack#1301 NOT_PLANNED) and made the
  object form strict, so the mirror was passing locally what the platform refuses
  with an `os migrate meta --from 16` prescription — an author saw green here and
  a refusal upstream. `streaming`, the fifth spec key, is now declared on this face
  (the renderer honoured it; no local declaration carried it).
  
  **What was measured, on this branch's base.** The mirror declared a pre-#8010
  shape of its own — `'pdf'` in both branches, no `streaming`, a non-strict
  `z.object` — and `ListViewInferred` is `z.input` of that mirror, so the
  `ListViewSchema` TYPE the ListView renderer is written against disagreed with
  its sibling `ObjectGridSchema['exportOptions']` (the clean five-key
  `ListViewExportOptions`), and the renderer could only read `streaming` through
  `as any`. Against the installed pin (`@objectstack/spec@17.2.0`, not a working
  tree), `ListViewSchema.shape.exportOptions` from `@objectstack/spec/ui` lifts
  `['csv', 'xlsx']` to `{ formats: ['csv', 'xlsx'] }`, refuses `['csv', 'pdf']`
  with the migration prescription, refuses `{ formats: ['csv'], compression: 'gzip' }`
  (strict), and accepts `{ formats: ['csv'], streaming: true }` with the value
  intact. The mirror now IS that schema object, so the four verdicts are the
  spec's by construction; `export-options-spec-parity.test.ts` pins the identity,
  the four verdicts, and the survival of `streaming` through a parse.
  
  **The TS face follows.** `ListViewSchema['exportOptions']` is now the spec's
  INPUT type: `ListViewExportFormat[] | ListViewExportOptions` — the bare array
  stays admissible on input because nothing on the render path parses, and the
  object arm IS the same `ListViewExportOptions` that `ObjectGridSchema` and
  `NamedListView` carry. One spec key, one type, on every local authoring surface;
  `'pdf'` is a compile-time refusal in both spellings.
  
  **Who is NOT affected.** A document authoring `['csv', 'xlsx']`,
  `{ formats: ['csv', 'json'] }` or any combination of the five spec keys is
  untouched; absent stays valid; the member's description is now the spec's own
  text. The spec's parse-time lift of a bare array to `{ formats }` now runs for
  whoever parses through this mirror as well.
  
  **Migration:** delete `'pdf'` (the surviving formats are `'csv'`, `'xlsx'` and
  `'json'`); delete any key outside `formats` / `maxRecords` / `includeHeaders` /
  `fileNamePrefix` / `streaming`. `os migrate meta --from 16` lists the mechanical
  edits for existing sources.
  
  Graded `minor`, not `patch`: this narrows the accepted input set, which is
  breaking for any author who wrote the tolerated value. It is not `major` per
  this repo's fixed-group convention (objectui's own breaking changes ship as
  `minor`; the group's major tracks `@objectstack` — AGENTS.md 版本号策略,
  mechanically enforced by `scripts/check-changeset-no-major.mjs`).
- 446d93d: **Breaking for authored metadata:** `MarkdownSchema.sanitize` and
  `MarkdownSchema.components` are RETIRED (objectui#6972, ADR-0049
  enforce-or-remove). A `markdown` node that authors either key no longer
  validates: the parse fails loudly on that key's path with the explanation in
  the message, and both TS members are `?: never` tombstones, so the same document
  is refused at compile time. The two keys do not share a disposition — triage
  recorded the asymmetry — so each is argued below.
  
  ## `sanitize`
  
  **What was measured, on this branch's base.** `sanitize` was declared
  `?: boolean` with `@default true` on both published faces — `data-display.ts`
  and the Zod mirror — documented, and read by NOTHING. Worse than an ordinary
  inert key, it implied a switch that does not exist: sanitization is
  **unconditional**. `rehypePlugins` in `plugin-markdown/src/MarkdownImpl.tsx` is
  a module-level `const` array whose last link is `[rehypeSanitize, sanitizeSchema]`,
  handed to `ReactMarkdown` as-is — no ternary, no `if`, no runtime assembly.
  `MarkdownRenderer` forwards exactly `content` and `className`, and
  `MarkdownImplProps` accepts only those two. A repo-wide grep for
  `schema.sanitize` over `packages/` and `apps/` returns nothing, against a
  control of 20 `.tsx` files reading `schema.content` in the same query shape, so
  the zero is a reading, not a blind query. An author writing `sanitize: false`
  believed they turned XSS filtering off; one writing `sanitize: true` believed
  they turned it on. Neither was true.
  
  **Why remove and not enforce.** The enforce arm of enforce-or-remove for this
  key is a switch that DISABLES XSS sanitization, which is not an acceptable
  outcome; for `sanitize` the ruling collapses to remove (triage on
  objectui#6972).
  
  **Who is affected — a `sanitize` authored onto a `markdown` node:**
  
  ```json
  { "type": "markdown",
    "content": "# Hello",
    "sanitize": false }   // ← was tolerated, changed nothing
  ```
  
  now fails validation with:
  
  > RETIRED (objectui#6972) — sanitization is unconditional: rehype-sanitize is a
  > fixed last link of the markdown renderer's rehype chain, and no value of this
  > key ever switched it. There is no authored spelling that disables XSS
  > sanitization; delete the key.
  
  ## `components`
  
  **What was measured, on this branch's base.** `components` was declared
  `?: Record<string, any>` ("custom components for markdown elements") on both
  faces and read by NOTHING: the `components` map `MarkdownImpl` hands to
  `ReactMarkdown` is its own module-level `mdComponents` (the mermaid / metadata
  fence overrides), never merged with anything off the schema, and
  `grep -rn "schema.components"` over `packages/` and `apps/` returns nothing
  against the same `schema.content` control. The premise the PM declared
  falsifiable — *no host path consumes a `components` map* — was re-measured
  before this half was written: `MarkdownImplProps` has no such prop, `LazyMarkdown`
  receives only `content` and `className`, and no plugin API, app-shell or runner
  site passes one.
  
  **Why remove and not wire, and why not a runtime slot.** A map of React
  component overrides is not a value a JSON document can author — the same shape
  as the handler keys objectui#6124 retired ("JSON has no function value"). The
  `runtime-slot` disposition keeps a TypeScript twin callable when a host-supplied
  value actually reaches a renderer; nothing reaches this one, so there is no twin
  to keep and the TS face refuses it outright. This half is the PM's disposition
  under a declared veto window on objectui#6972, not a maintainer ruling; the PR
  stays draft for contract review. A real override slot must arrive as a proposal
  WITH its enforcing reader, not by reviving this key.
  
  ```json
  { "type": "markdown",
    "content": "# Hello",
    "components": { "h1": "h2" } }   // ← was tolerated, changed nothing
  ```
  
  now fails validation with:
  
  > RETIRED (objectui#6972) — never read: the markdown renderer forwards only
  > `content` and `className`, and a map of React component overrides is not a
  > JSON-authorable value. Delete the key; the fenced mermaid / metadata block
  > overrides are the renderer's own fixed map, not an authoring surface.
  
  ## Both keys
  
  **Two published faces.** `@object-ui/plugin-markdown` re-exports `MarkdownSchema`
  from `@object-ui/types` (one authority since objectui#6172) rather than
  declaring a copy, so the retirement reaches its consumers through the same
  declaration — which is why this changeset names the plugin as well: no plugin
  source changes, but the type its published face exposes narrows, and its own
  test now pins that the refusal arrives there.
  
  **Who is NOT affected.** A document that never wrote either key is untouched
  (`absent` stays valid), `content` and `className` are unchanged, and the
  renderer's behaviour is byte-identical — it sanitized unconditionally before
  and does now, and its fenced-block overrides are the same fixed map. One
  in-repo fixture authored either key
  (`packages/types/examples/data-display-examples.json#examples.markdown`,
  `"sanitize": true`); the key is deleted from it and the fixture is now pinned
  to parse green. No fixture, catalog entry, doc snippet, skill or app in this
  repository authored `components` on a markdown node.
  
  **Migration:** delete the keys. There is nothing to replace either with — the
  behaviour `sanitize` claimed to control is always on, and no authored spelling
  overrides markdown elements.
  
  Graded `minor`, not `patch`: this narrows the accepted input set, which is
  breaking for any author who wrote the tolerated key. It is not `major` per
  this repo's fixed-group convention (objectui's own breaking changes ship as
  `minor`; the group's major tracks `@objectstack` — AGENTS.md 版本号策略,
  mechanically enforced by `scripts/check-changeset-no-major.mjs`).
- 98d4108: Converge the two named select-option types onto one spec-derived base (objectui#7014, Q1).
  
  `SelectOptionMetadata` (`field-types`, the object-metadata read model) and `SelectOption`
  (`form`, the SDUI form vocabulary) each restated the select-option vocabulary by hand.
  Both now extend the new `SelectOptionBase`, which derives the spec's keys from
  `@objectstack/spec/data` **by reference** and writes out only the divergences. A key the
  spec adds now reaches both faces with no edit here; a key it removes becomes a compile
  error at the sites that read it, instead of a hand copy that goes on compiling while the
  contract moves underneath it.
  
  **What widened.** Exactly one key, on one face: `SelectOptionMetadata` gains
  `default?: boolean`. It is a spec key that face could not describe before — ruled
  `enforce` on the object-field face (objectstack#7246), where the engine seeds a new
  record from the option marked `default: true` — and it arrives OPTIONAL, so every
  document that face accepted before is still accepted.
  
  **What narrowed.** Nothing. Both faces resolve to member-for-member what they resolved to
  before (`SelectOption` identically; `SelectOptionMetadata` identically plus `default`),
  pinned invariantly against the pre-convergence member lists in
  `select-option-tier1-convergence-7014.test.ts` so a future "unification" cannot quietly
  drop a key. `SelectOption.value` keeps its deliberate widening past the spec's machine
  identifier (numeric/boolean values for standalone forms, objectui#3090), now named in an
  `Omit` instead of restated.
  
  **The convergence is an EXTENSION, not a replacement.** objectui legitimately carries
  keys the spec does not: `description` (`LookupField` searches it, objectui#6153) on the
  metadata face, and `disabled` / `icon` on both. The spec's `SelectOptionSchema` is strict
  over exactly `{label, value, color, default, visibleWhen}` and refuses each of those
  three **by name**, so they are declared as objectui dialect with that refusal written
  into the published JSDoc rather than described as spec-aligned. These are read-model keys
  and must never reach an authored object document — a field's `options` are routed through
  the strict schema, so one of them fails the whole field.
  
  `SelectOptionBase` is exported from `@object-ui/types` because it appears in the
  `extends` clause of both published interfaces.
- 4388f71: **The overlay family's `trigger` slot now declares the node array its Zod mirror, its runtime and its own shipped defaults already accept** (objectui#7081).
  
  `trigger` on `DialogSchema`, `AlertDialogSchema`, `SheetSchema`, `DrawerSchema`, `PopoverSchema`, `HoverCardSchema` and `DropdownMenuSchema` widens from `SchemaNode` to `SchemaNode | SchemaNode[]` on the TypeScript face — the spelling `ContextMenuSchema` and `TooltipSchema` already carried. Each member keeps its optionality (the first four optional, the last three required). `SchemaNode` itself is unchanged.
  
  This is a **widening**, not a replacement: every singular `trigger` keeps type-checking unchanged. The Zod mirror is untouched — `zod/overlay.zod.ts` already spelled every one of these keys `z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)])` — and so is the runtime: every overlay renderer hands `schema.trigger` to `renderChildren`, whose `Array.isArray` branch has served the array form all along, and every registration's `defaultProps.trigger` ships as an array. What changes is that the TypeScript face stops under-reporting an accept set that already ships: copying a renderer's own default into a typed document is no longer a type error against the type that shipped it. The seven docs pages' `trigger` rows follow the declaration.
  
  Triage on the card (2026-09-03): the validator's accept set does not move, so this is a declaration catching up with what ships rather than a new capability. Per this repository's version-alignment convention, a widening of a published type surface ships as `minor` with the semantics spelled out here rather than as `major` (see AGENTS.md, "版本号策略").
- c93b4d5: `disabled` accepts a predicate string — `boolean | string`, the `BaseSchema` union — on
  the 18 concrete schemas that used to narrow it back to `boolean` (objectui#7087,
  maintainer ruling 2026-09-01: option 1, scoped to `disabled`).
  
  `visible` and `disabled` are twins: objectui#4581 widened both on `BaseSchema` on the same
  evidence — `SchemaRenderer` evaluates both through `evaluator.evaluateCondition` rather
  than reading either as a boolean. After that widening, 0 of the 124 `extends BaseSchema`
  interfaces redeclared `visible`, while 18 still carried a pre-widening
  `disabled?: boolean` of their own, with matching `z.boolean()` mirrors. So
  `disabled: "${data.status === 'locked'}"` — the capability the renderer implements and
  the base type advertises — was a type error and a zod refusal on `ButtonSchema`,
  `InputSchema`, `TextareaSchema`, `SelectSchema`, `CheckboxSchema`, `RadioGroupSchema`,
  `SwitchSchema`, `ToggleSchema`, `SliderSchema`, `FileUploadSchema`, `DatePickerSchema`,
  `CalendarSchema`, `InputOTPSchema`, `FormSchema`, `ComboboxSchema`, `ActionSchema`,
  `CollapsibleSchema` and `ToggleGroupSchema`.
  
  Those 18 redeclarations are removed, on both faces. The interfaces inherit
  `BaseSchema.disabled` the way they always inherited `visible`; the zod mirrors inherit
  `base.zod.ts`'s `z.union([z.boolean(), z.string()])` through `.extend()`'s merged
  `.shape`, so there is no second spelling of the union to drift from — the route
  `ChatbotSchema` took in objectui#6169.
  
  **Additive for authors**: a predicate string is now accepted where it was refused; every
  boolean that parsed before parses unchanged, and a number is still refused at path
  `disabled`. Runtime behaviour does not change — the renderer already evaluated both twins.
  
  **Out of scope, per the ruling**: `label` (29 narrowings) and `description` (32) carry
  `string | I18nLabel` i18n semantics and wait for their own ruling; the independent
  `disabled?: boolean` declarations on shapes that do not extend `BaseSchema`
  (`SelectOption`, `RadioOption`, `FormField`, `ComboboxOption`, `AccordionItem`,
  `ToggleGroupItem`, and the rest of that family) are not narrowings and are untouched.
- 8ad218d: `AlertDialogSchema` now declares the four keys the `alert-dialog` renderer actually reads
  (objectui#7104): `content` (the dialog body, `SchemaNode | SchemaNode[]` like every sibling
  overlay), `cancelText` and `actionText` (the footer's two button labels — each button renders
  only when its label is set; there is no renderer default) on BOTH faces, and `onAction` (the
  confirm button's click handler) as a RUNTIME SLOT in the objectui#6124 shape: callable on the
  TypeScript face, refused by name in the zod mirror because JSON has no function value.
  
  Until now none of the four was declared anywhere. They were accepted only through
  `BaseSchema`'s `[key: string]: any` and the mirror's `.passthrough()` — no editor completed
  them, no page named them, and a wrong-typed value rode through unexamined — while the keys
  the type DID declare for the same affordance (`cancelLabel` / `confirmLabel` /
  `confirmVariant`) are read by nothing, so a document written strictly against the shipped
  type rendered an empty footer. The renderer's own registered `inputs` and `defaultProps` were
  already written in the read dialect; this change makes that single de-facto contract legible
  instead of minting a second one (AGENTS.md #0.1: one strict contract, not N dialects).
  
  **Accept-set change on the published zod mirror — breaking, shipped as `minor` per this
  repo's version-alignment policy (majors track `@objectstack`).** Declared keys are validated
  even under `.passthrough()`, so three documents that parsed green yesterday are refused
  today, each at its own path: `cancelText` or `actionText` carrying a non-string
  (`cancelText: 123` — the renderer drew it as button text), `content` carrying a value that is
  not a node or node array (an object without `type`), and `onAction` carried at all (a JSON
  author cannot write a function; a string or object there was accepted and forwarded to the
  button, where it did nothing or threw at click). A document in the read dialect with
  well-typed values parses exactly as before and its values now survive the parse typed.
  Undeclared keys still pass through unchanged. On the TypeScript face, `cancelText: 123` is
  now a compile error at the key where the index signature used to absorb it.
  
  **No renderer change; no runtime behaviour changes.** The `alert-dialog` renderer, its
  `inputs` and its `defaultProps` are untouched. The three declared-but-unread keys are
  deliberately NOT retired here — that is a narrowing with its own card and its own grade;
  their per-key liveness readings are on objectui#7104.
  
  Docs: `content/docs/components/overlay/alert-dialog.mdx` now publishes the read dialect in
  its Schema block and no longer lists `actions?: BaseSchema[]`, a key no surface ever carried.
  The four schema-catalog examples that page embeds still author `actions` and render an empty
  footer — filed as objectui#7693, not converted here (the conversion is lossy).
- 5f78953: `ChartSchema` declares the data model it renders — chart-level `data` and `xAxisKey`, with
  the bare-string `xAxis` folded onto the latter — and `ChartDataSeries` accepts both binding
  dialects (objectui#7113 option B, 项目总监席 总监批 #28 2026-09-01 「同意」; and
  objectui#6939's `chart` row, maintainer ruling 2026-09-02 「同意」 — both rulings
  independently instructed declaring these two keys, so they land as one change).
  
  ⚠️ Shipped as `minor`, not `patch`, because two document classes that validated before now
  REFUSE. objectui#6939 grades this class "patch where the accept set only widens toward what
  already renders"; this change is not a pure widening, so it takes the level objectui#6896
  set for the same transition in this same file — the mirror starting to refuse — and for the
  same reason: this repository's `major` is a cross-repo pin to `@objectstack`'s major rather
  than a severity dial, so the break is announced here, which is the channel that carries it.
  
  ## What now refuses (the narrowing, named)
  
  **Three** classes validated before and refuse now. The first two survived only on
  `BaseSchema`'s `.passthrough()`; the third was silently STRIPPED by the non-strict
  `ChartDataSeriesSchema` object.
  
  ```jsonc
  // 1. chart-level `data` that is not an array of row objects
  { "type": "chart", "chartType": "bar", "data": "oops" }   // now: [data] expected array
  { "type": "chart", "chartType": "bar", "data": [1,2,3] }  // now: [data.0] expected object
  
  // 2. a non-string `xAxisKey`
  { "type": "chart", "chartType": "bar", "xAxisKey": 123 }  // now: [xAxisKey] expected string
  
  // 3. a non-string `series[].dataKey`  ⚠️ THIS ONE DRAWS A REAL CHART TODAY
  { "type": "chart", "chartType": "bar",
    "series": [{ "name": "a", "dataKey": 123 }] }           // now: [series.0.dataKey] expected string
  ```
  
  ⚠️ **Class 3 is the sharp one and is called out separately.** Classes 1 and 2 are malformed
  documents whose chart was already broken. Class 3 is not: at base it parsed to
  `series: [{ name: 'a' }]` (the non-string `dataKey` stripped in silence) and
  `normalizeChartSchema` renders it — `str(123)` is `undefined`, so the read falls back to
  `name` and yields `series: [{ dataKey: 'a' }]` (`normalizeChartSchema.ts:239`). So this is a
  narrowing away from a document that **renders today**, which is precisely the distinction
  objectui#6939's grading language turns on. `dataKey: null` behaves identically. Measured on
  both states; the declaration itself is right, and this note is the disclosure it was owed.
  
  ## Corrected: what class 2 actually did
  
  An earlier draft of this changeset said `xAxisKey: 123` "drew an EMPTY CHART". The read
  sites do not support that: `ChartRenderer.tsx:133` takes `schema.xAxisKey` raw and the rows
  still reach `data` at `:164`, while the normaliser drops the key (`str(123)` is `undefined`).
  Measured through `normalizeChartSchema`, the result keeps the series and loses only the
  category binding — **a drawn chart with a broken category axis**, not an empty one. Class 1
  (`data` malformed) is the one that leaves nothing to plot.
  
  ## Also changed on the published surface: combinators
  
  Both consts now carry a check (`ChartSchema` the `xAxis` fold, `ChartDataSeriesSchema` the
  at-least-one-binding refinement), and on zod 4.4.3 that makes three combinators **throw**
  where they previously returned a schema:
  
  ```
  ChartSchema.pick(…) / .omit(…) / .partial()        -> throws "cannot be used on object
  ChartDataSeriesSchema.pick(…) / .omit(…) / …          schemas containing refinements"
  ```
  
  `.extend()` with a NEW key still works and preserves the fold and the refinement;
  `.optional()`, `z.discriminatedUnion`, `z.toJSONSchema` and `safeValidateSchema` are all
  unaffected. Nothing in this repository calls the throwing combinators on either const, and
  the published surface already ships refined mirrors (`objectql.zod.ts`, `complex.zod.ts`,
  `form.zod.ts`, `app.zod.ts`), so the class is not new — but it is a real behaviour change on
  a published export and it belongs in the release note rather than in a reviewer's file.
  
  ## What now validates (the widening)
  
  `series: [{ dataKey: 'revenue' }]`. `normalizeSeries` reads
  `str(raw.dataKey) ?? str(raw.name)`, so `dataKey` alone has always been a complete binding
  — but the mirror REQUIRED `name` and refused it. That is why both catalog chart fixtures
  (`advanced-line-chart.json`, `area-chart.json`) failed validation: they are the `chart: 2`
  entry in `objectui check`'s 28-file census. `name` is now optional, `dataKey` is declared,
  and a series binding to NEITHER is refused by name at `series.N.name` — the same path the
  required flag used to report, so the diagnostic did not move.
  
  ## `xAxis` folds; it does not become a second name
  
  `xAxis: 'month'` is accepted at input and is ABSENT from the output, having landed on
  `xAxisKey`. When both are written the canonical key is kept and the alias dropped — not a
  precedence rule minted here, but the one already running at `normalizeChartSchema.ts:292`,
  where `xAxisKey` is the first limb of `str(schema.xAxisKey) ?? xAxisSpec?.field ??
  str(xAxisRaw)`. No chart that renders today changes what it renders.
  
  ⚠️ The `xAxis` **config object** (`{ field, format, title, showGridLines }`) is NOT folded.
  Only the bare string is a sibling spelling of `xAxisKey`; the object's presentation keys
  survive separately into `out.xAxis` (`normalizeChartSchema.ts:289-291`), and folding it
  would discard them.
  
  ## Not done, deliberately
  
  objectui#6939's `chart` row also says "`series[].data` stops being required". On this base
  it already is not: objectui#6896 replaced it with `retirementTombstone(...)` —
  `z.never({ error }).optional()` — which is optional AND refuses any authored value by name.
  Implementing the clause literally would re-widen a retired key and reverse a landed ruling,
  so it is not done.
  
  ## FROM → TO
  
  ```ts
  // ChartDataSeries
  - name: string;
  + name?: string;
  + dataKey?: string;
  
  // ChartSchema
  + data?: Array<Record<string, any>>;
  + xAxisKey?: string;
  ```
- 639114c: Reconcile the declared surface with `@objectstack/spec` 17.3.0 (objectui#7122).
  
  ⚠️ **`@object-ui/types` is graded `minor` for a breaking surface change.**
  The exported `ObjectSchemaClientExtensions` narrows from
  
  ```ts
  export interface ObjectSchemaClientExtensions { editMode?: 'modal' | 'page' }
  ```
  
  to
  
  ```ts
  export type ObjectSchemaClientExtensions = Record<never, never>;
  ```
  
  Two breaking consequences for a consumer that names the type directly. **(1)** It
  no longer declares `editMode`; the key is now carried by the spec's
  `ServiceObject`, so `ObjectSchemaMetadata` still has it, but code written against
  the extension type ALONE loses it. **(2)** `interface` → type alias also ends
  **declaration merging**: a consumer that reopened
  `declare module '@object-ui/types' { interface ObjectSchemaClientExtensions { … } }`
  to add its own client-side member no longer compiles, because an alias cannot be
  reopened. `minor` rather than `major` per `AGENTS.md`'s version-alignment rule —
  objectui's own breaking changes are graded `minor` with the semantics stated in
  the body, since any `major` in the fixed group would push all 39 packages off
  `@objectstack`'s major.
  
  **`ObjectSchema.editMode` is now the spec's.** 17.3.0 adopted the key (measured:
  the accept set went 42 → 43, gained set exactly `['editMode']`, lost set empty,
  declared as the same `'page' | 'modal'` union objectui carried). Its local copy
  is retired from `ObjectSchemaClientExtensions`, which is what that type's own pin
  prescribed for this event, leaving the client delta empty. Nothing is removed
  from the product: `editMode` stays authorable and stays typed on
  `ObjectSchemaMetadata`, carried by the spec's `ServiceObject` instead of by a
  local member — and a published, spec-validated object document may now carry it,
  which at 17.2.0 was refused by name.
  
  **`user:profile` is retired across all three sites.** 17.3.0 dropped it from
  `PageComponentType` (measured: the enum went 34 → 32 options, lost set exactly
  `['user:profile', 'element:form']`, gained set empty). objectui went on knowing
  it in three places, so all three moved together: the Studio palette exclusion
  ledger, `PROTOCOL_COMPONENTS` in `renderers/placeholders.tsx`, and the
  regenerated `known-schema-types.ts` the CLI checks schemas against. Nothing
  user-reachable went with it — neither type had a renderer, `user:profile` had
  only the dashed "Component Placeholder" scaffold, and the app shell's own
  profile affordance is a React slot, never this block type. A page schema still
  naming it now draws the loud "Unknown component type" panel rather than a silent
  grey box, which is this repo's standing treatment for a type outside the
  supported surface.
  
  **`record:details` sections document the eight keys 17.3.0 added.**
  `group`, `hideEmpty`, `collapsible`, `showBorder`, `defaultCollapsed`, `icon`,
  `description` and `headerColor` are now declared on a section entry (4 → 12
  members). Six of the eight are already honoured by `DetailSection`, so the
  `sections` input description now teaches all of them, and says plainly which two
  are not read here. Designer controls for them are a separate feature and are
  deliberately not added.
  
  **`@object-ui/types` raises its declared `@objectstack/spec` floor `^17.0.0` →
  `^17.3.0`, and this is the second half of its `minor`.** The package's emitted
  `dist/spec-report.d.ts` names `FilterCondition` from `@objectstack/spec`, which
  `17.0.0` does not export, so the old range was a claim the artifact did not
  support — `scripts/check-spec-range-floors.mjs` reports it as `[floor-too-low]`
  and names `^17.3.0` as the lowest version carrying every symbol the package
  references. Breaking for a consumer pinned below 17.3.0: it can no longer
  resolve this package. That is the range stating the truth rather than a new
  restriction — the artifact already required those symbols — and it is the
  remedy the gate itself prescribes ("Raise that package's range to the lowest
  version that exports the symbol… Do not add a tolerant re-declaration on this
  side: the range is the claim, and the claim is what is wrong", objectui#5793).
  `@object-ui/core` and `@object-ui/data-objectstack` already declare `^17.2.0`
  and `@object-ui/plugin-detail` `^17.1.0`, so a floor above the family minimum is
  this repo's normal state, not an exception.
  
  ⚠️ **Measured on both sides, because it is bump-caused rather than pre-existing
  and objectui#7688 records the opposite.** The gate is a scheduled / push-to-main
  workflow that cannot red a pull request, and `main` is green on it — the last
  eight runs, most recently at `c2e3cee2c`. On this branch's built tree it exits 1
  with CI's own `--cross-check` invocation, and exits 0 with this raise, judging
  278 (subpath, symbol) pairs across 19 published packages either way. Its blocking
  copy runs on the publish path, so leaving it would have surfaced as a cancelled
  release rather than as a red check. The correction is recorded on objectui#7688.
- 1f31d3a: **Retired: `DetailViewSection.hideEmpty`.** The `record:details` section key is
  gone from `@object-ui/types` and `RecordDetailsRenderer` no longer reads it.
  Emptiness on a detail section is now decided entirely by `DetailSection`'s
  auto-hide heuristic — hide empty rows only while the section still has at least
  one filled row, never on an all-empty section — with the reader's
  "Show N empty fields" toggle as the escape hatch.
  
  **Minor, not major, and deliberately so.** The key was never authorable on any
  validated page: `@objectstack/spec` `RecordDetailsProps` REFUSES it, returning
  `unrecognized_keys: ['hideEmpty']` on the `sections[]` element (measured on the
  installed 17.2.0, against a `columns: 2` control that parses and whose value
  survives). So a spec-compliant document could not carry the key, and a document
  that carried it anyway failed to parse before it ever reached the renderer.
  What this release removes is a *declaration* that invited authors — and code
  generators reading the published `.d.ts` — to write a key the platform refuses.
  That narrows a published type surface, which is what makes it a minor rather
  than a patch; it retires no capability anyone could exercise.
  
  One key had four contracts and three answers: `@object-ui/types` declared it,
  `RecordDetailsRenderer` honoured it, the `DetailViewSectionSchema` zod mirror
  omitted it, and the spec refused it. The maintainer converged the four on the
  spec's answer (2026-09-01): the spec keeps refusing, the mirror stays absent,
  and the declaration and the read are retired. All four are now pinned together
  in `record-details.hideEmptyRetired-7129.test.tsx`.
  
  Going with it is the paradox the key carried: `DetailSection` tested
  `!section.hideEmpty`, so an authored `hideEmpty: false` was indistinguishable
  from an unauthored section and overrode nothing. There is no longer a lever to
  misread.
  
  **Supersedes one paragraph of the `record:details` empty-section changeset in
  this same release.** Its closing "What does not change: an authored `hideEmpty`
  keeps its exact former meaning" no longer holds — an authored `hideEmpty` of
  either polarity is now inert, and the release notes should read that way.
  Everything else in it stands: the unauthored default is unchanged, and so is
  the label-graveyard guard.
  
  **Migration:** delete `hideEmpty` from any `record:details` section you author.
  A section that used `hideEmpty: true` to hide an all-empty block will now show
  that block's skeleton — headings, field labels and one empty-value placeholder
  each. That is the platform's answer for a sparse record, and it is a UI
  decision, not something metadata should have to make.
  
  **Not affected**, despite the shared name: `record:reference_rail`'s own
  `hideEmpty` prop, which is a different surface and still live; and the
  `detail.hideEmptyFields` i18n label behind the toggle.
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
- 20c04b2: A gantt timeline whose rows are malformed now refuses to draw, naming the row,
  instead of crashing the render (objectui#7164, maintainer ruling A+).
  
  `TimelineRenderer`'s gantt branch used to read the authored rows twice — once
  defensively in `findUnusableGanttDate`, once bare in `calculateDateRange` — and
  every input in the gap threw a `TypeError` mid-render from ordinary JSON:
  `items: [null]`, a row whose `items` is `5` / `true` / `{}` / an array-like
  object, or `items` itself not an array. The three readers (the date scan, the
  range computation and the render loop) now consume ONE verdict from
  `classifyGanttRows`, and a malformed shape renders the existing `role="alert"`
  refusal through a new diagnostic key,
  `timeline.gantt.unusableRange.malformedRow` — "items[0] is null, which is not
  a row shape" — never the `malformedDate` copy, which named the wrong fault.
  The key lands in `en` and the nine sibling locale packs.
  
  `@object-ui/types` (minor — the accept set narrows): `TimelineSchema.items` no
  longer declares `z.array(z.any())`. Every element must be an object, and a
  gantt row's own `items`, when present, must be an array, so `validate` refuses
  `items: [null]` and `items: [{ items: 5 }]` at authoring time — before they
  reach a renderer. Feed items (`vertical` / `horizontal`) carry no `items` key
  and parse exactly as before; every in-repo `type: 'timeline'` fixture parses
  green on both sides of the change. Rows with no bars (`items: []`, a row
  without `items`) stay the ordinary empty state and still draw.
- b652514: Mixed id/object action arrays are refused; use all ids or all objects
  (objectui#7182, maintainer ruling 2026-09-02, option C).
  
  An `actions` array on `page:header` or `record:quick_actions` (and the bar's
  spec-declared `actionNames`) is either **all action ids** or **all inline
  `ActionDef` objects**. A mixed `['convert', { … }]` array is now refused on both
  surfaces: none of its authored actions is rendered, and the console names the
  offending index (`… refused at index 1 — element 1 is an inline action object
  but element 0 is an action id …`). Before this change the two renderers
  disagreed on exactly that input — `page:header` normalised per element and drew
  both halves, `record:quick_actions` switched on the whole array and rendered
  nothing for the id — so one authored array meant two things depending on which
  surface drew it, and the mixed form is precisely what a half-migrated page under
  the objectstack#11592 ids ruling produces.
  
  **Breaking, deliberately, and narrowing.** `@objectstack/spec` has always
  declared `PageHeaderProps.actions` as `z.array(z.string())` — the spec already
  refuses an object element at validation, naming its index — and
  `RecordQuickActionsProps` declares `actionNames` (ids) only. What narrows is
  the renderers' undeclared tolerance: an all-object array still passes through
  (transition tolerance for the migration, retired on its own card once the last
  inline array is converted), a mixed one no longer does. **Migration:** convert
  each array whole — every element an id naming an action declared on the
  object — never one element at a time.
  
  New on `@object-ui/types`, beside `actionRendersAt`: the pure
  `resolveDeclaredActionIds(elements, registeredActions)`, with the
  `DeclaredActionsResolution` / `DeclaredActionsRefusal` result types (the shape
  classifier stays module-internal: called with no registry, the function already
  returns the registry-independent verdict a renderer needs before its lookup). Both
  renderers call it; the whole-array switch in `record-quick-actions.tsx` and the
  per-element normalisation in `containers.tsx` are gone. The rule is closed: a
  string is an id, a non-null non-array object is an inline definition, and any
  other element (`null`, a number, a nested array) is refused at its index too.
  An all-id array resolves by `name` in authored order, first registration
  winning on a duplicate name; ids that name nothing are reported back with their
  index for the caller to warn about once its lookup has settled.
  
  **Three further behaviour changes ride on the one rule, all on published
  packages:** on `page:header`, a padded id (`' convert '`) no longer resolves — it
  was previously trimmed before the lookup, and ids are now compared exactly as
  authored; on `page:header`, a blank `''` id is now reported by the unresolved-id
  warning instead of being silently skipped; on `record:quick_actions`, an all-id
  `actions` array with no object bound now renders nothing (the ordinary empty
  placeholder) instead of handing the bare strings to the action engine as action
  definitions.
- adbda1b: feat(types): `renderCellEditor`'s context gains `pendingRow` — the persisted row merged with its staged, unsaved edits (#7188)
  
  The inline cell editor's context on `DataTableSchema` (declared by #6882) carried the row
  once, as `row` — the **persisted** record. A widget that scopes itself by a sibling field
  (a `dependsOn` lookup) had no way to see a parent that was edited in the same row but not
  yet saved, so it kept listing candidates for the old parent.
  
  The context now carries the row twice, deliberately:
  
  - `row` — unchanged: the persisted record, what the data source last returned.
  - `pendingRow` — **new**: `row` shallow-merged with the row's staged, unsaved edits. The
    same object as `row` when nothing is staged.
  
  `row` was **not** redefined to mean the merged record — that would silently change an
  already-published member, and a host that needs the persisted value would have lost its
  only source. Both are addressable. The zod mirror's `renderCellEditor` is `z.function()`
  and encodes no parameter shape; its description records the delta and names the member
  on `DataTableSchema` as the authority. The #6882 exact-shape pin was extended (not
  weakened) in the same change, with a control proving the pin can tell the seventh member's
  presence from its absence.
- 2e32ed4: `ObjectFormSection` no longer declares `className` / `gridClassName` (objectui#7200 —
  the declared-but-inert remainder of objectstack#13626).
  
  **Breaking, deliberately.** A TypeScript literal annotated `ObjectFormSection` (or an
  `ObjectFormSchema.sections` entry) that carries `className` or `gridClassName` is now a
  compile error at the authoring site. Before this change the two members were declared
  with doc comments promising a wrapper / grid class, while — since objectstack#13626
  retired the seven renderer reads (`@object-ui/plugin-form` 2026-09-01) — nothing
  delivered it: an author could write either key, have it type-check, and get nothing.
  
  The authored-metadata type now agrees with `@objectstack/spec`, whose `FormSectionSchema`
  is a strict object declaring neither key, and with the ruling's rationale (maintainer
  2026-09-01, verbatim): "retire the reads … Declaring the keys was weighed and not adopted:
  it would formally invite free Tailwind strings into authored metadata, the exact class
  the boundary exists to keep out." A `?: never` tombstone was not used: `ObjectFormSection`
  has no zod mirror (`ObjectFormSchema` in `zod/objectql.zod.ts` does not declare
  `sections`), so there is no parse door to refuse at, and a tombstone is still a
  declaration in completion and in the published `.d.ts`.
  
  **Not changed.** The five per-layout section config types in `@object-ui/plugin-form`
  (`ModalFormSectionConfig`, `SplitFormSectionConfig`, TabbedForm's `FormSectionConfig`,
  `WizardStepConfig`, `DrawerFormSectionConfig`) keep their `className` / `gridClassName`:
  their renderers read them for programmatic React mounts, which the authorable boundary
  does not govern. The form ROOT `className` (`ObjectFormSchema.className`) is a different
  key on a different node and is unaffected. Runtime behaviour is unchanged — JSON metadata
  carrying either key was already ignored.
  
  **Migration.** Remove the two keys from any `ObjectFormSection` literal; they did nothing.
  Style sections through the host application's own CSS or the form ROOT `className`.
  Section *layout* stays authorable through `columns`.
- 554f2b6: `ObjectCalendarSchema` declares the record-source ladder its renderer already
  reads — `data`, `staticData`, `objectName` — on both faces, in the shape
  objectui#6939 landed on `object-map` and `object-gantt` (objectui#7313).
  
  `ObjectCalendar` resolves its records through the shared ladder
  (`resolveRecordSourceConfig` in `@object-ui/core`, called from
  `plugin-calendar/src/ObjectCalendar.tsx`): `data` first, then `staticData`,
  then `objectName`. The published TypeScript interface REQUIRED `objectName` and
  declared neither `data` nor `staticData`; the published Zod mirror did the same.
  So an `object-calendar` node authored on `staticData` — the route the plugin
  page documents twice — rendered correctly and was refused by
  `safeValidateSchema`, and could not be annotated with its own type
  (`TS2741: Property 'objectName' is missing`).
  
  - `objectName` becomes optional on the TypeScript interface and on the mirror
    in the same stroke; it stays the object-provider key.
  - `data` (`ViewData` / `ViewDataSchema`) and `staticData` (`any[]`) are
    declared on both faces, spelled exactly as `ObjectGanttSchema` spells them.
  - The member ends in `requireRecordSource('object-calendar')`: a node
    authoring NONE of the three is refused by name — one root-level issue,
    `params.code = 'RECORD_SOURCE_REQUIRED'`, the map/gantt message naming
    `data`, `staticData` and `objectName` — instead of by a missing `objectName`.
  
  **A widening.** A node authoring `staticData` or `data` without `objectName`
  now validates (it always rendered — the read is
  `resolveRecordSourceConfig(schema)`, keyed on the three). Every document that
  validated before still validates: `objectName` alone still parses, an empty
  one included, because presence is `!== undefined`. The one shape the
  refinement refuses (none of the three) was refused before too, at
  `objectName`. The two static-data examples in
  `content/docs/plugins/plugin-calendar.mdx` are now annotated
  `ObjectCalendarSchema` and compile under the doc-snippet gate.
- 669d71b: **Breaking for authored metadata:** `ObjectKanbanSchema.groupField` is RETIRED
  (objectui#7322, ADR-0049 enforce-or-remove), and the two keys the `object-kanban`
  renderer actually reads — `groupBy` and `limit` — are now DECLARED and validated
  on both published faces: the TypeScript interface in `objectql.ts` and the Zod
  mirror in `zod/objectql.zod.ts`.
  
  **What was measured, on this branch's base (`53ded82b`).**
  `packages/plugin-kanban/src/ObjectKanban.tsx` reads `schema.groupBy` at thirteen
  sites (lane materialisation at `:601` / `:625` / `:640`, card moves at `:747` /
  `:865`, and their effect deps) and `schema.limit` at two (`:264`,
  `$top: schema.limit ?? DEFAULT_KANBAN_LIMIT`, and the effect deps at `:291`).
  `groupField` has ZERO read sites anywhere under `packages/plugin-kanban/` —
  against a control of those thirteen `groupBy` reads in the same query, so the
  zero is a reading, not a blind grep. Yet the declaration REQUIRED `groupField`
  and declared neither `groupBy` nor `limit`. Measured from source: the
  documented, tested, working shape — `{ type: 'object-kanban', objectName,
  groupBy, limit }` — failed `ObjectKanbanSchema.safeParse` and
  `safeValidateSchema` on the missing `groupField`, and only ever reached the
  renderer through `BaseSchema`'s `[key: string]: any` and `.passthrough()`,
  admitted unexamined. An author who followed the declaration wrote `groupField`
  and got a board that grouped nothing, with no diagnostic on either face.
  
  **Who is affected — an `object-kanban` node authoring `groupField`:**
  
  ```json
  { "type": "object-kanban",
    "objectName": "task",
    "groupField": "status" }   // ← validated, compiled, grouped nothing
  ```
  
  now fails validation at `groupField` with:
  
  > RETIRED (objectui#7322) — `groupField` is not read by the object-kanban
  > renderer; author `groupBy`. (The view-level `kanban.groupField` alias is
  > unaffected.)
  
  and is refused at compile time: `groupField?: never`. The tombstone is
  load-bearing rather than decorative — `BaseSchema` carries `[key: string]: any`,
  so DELETING the member would let the retired spelling type-check green and go on
  doing nothing. **Migration:** rename the key to `groupBy`; the value — the field
  whose value places a record in a lane — is unchanged.
  
  **What now validates that did not before:** the documented shape. `groupBy` is
  REQUIRED (the retired contract required a lane field too; the renderer's
  `if (!schema.groupBy)` branches are defensive early-returns, not a lane-less
  mode, and every documented and tested `object-kanban` node authors the key) and
  must be a string; `limit` is an optional positive integer. A wrong-typed
  `groupBy: 42` or `limit: "twenty"` — previously admitted unexamined — is now
  refused at its own path.
  
  **Who is NOT affected.** The VIEW-LEVEL kanban config is untouched:
  `kanban.groupField` there is a live legacy alias of the spec's `groupByField`
  (`packages/core/src/utils/normalize-list-view.ts` maps it; `plugin-list`'s
  `ListView` and `plugin-view`'s `ObjectView` still read it). `groupField` is dead
  only on the `object-kanban` NODE. The declarative `kanban` node (`KanbanSchema`)
  is untouched, `BaseSchema`'s unknown-key policy is byte-identical (an undeclared
  key still passes through), and the renderer is unchanged — boards authored the
  documented way rendered before and render now. One in-repo fixture authored
  `groupField` on this node (`packages/types/src/__tests__/kanban-conditional-formatting.test.ts`);
  it now authors `groupBy`. No doc snippet, catalog entry, skill or app in this
  repository authored `groupField` on an `object-kanban` node.
  
  Graded `minor`, not `patch`: this narrows the accepted input set, which is
  breaking for any author who wrote the retired key. It is not `major` per this
  repo's fixed-group convention (objectui's own breaking changes ship as `minor`;
  the group's major tracks `@objectstack` — AGENTS.md 版本号策略, mechanically
  enforced by `scripts/check-changeset-no-major.mjs`).
- ed27d7c: The eight `on*` handler keys PR #7339's census could not see now refuse by name
  (objectui#7344 — the objectui#6182 ruling of 2026-08-25 that the handler-expression
  string dialect is not a supported authoring form, executed in the objectui#6124 shape).
  
  **The accept set of published validators moves** (`@object-ui/types/zod`):
  
  - Four mirrors declared the string dialect (`z.string()`) — `AppActionSchema.onClick`,
    `ReportBuilderSchema.onSave` / `.onCancel`, `DetailViewSchema.onBack` — so an authored
    `onBack: 'goBack'` parsed green and then reached a slot that CALLS it
    (`DetailView.handleBack`), throwing `onBack is not a function` at click.
  - Three declared `z.any()` — `ActionSchema.onClick`, `DetailSchema.onBack`,
    `CRUDDialogSchema.onClose` — wider than the callable the TypeScript face declares, so
    any JSON value parsed green (the objectui#7069 direction).
  - One, `CalendarViewSchema.onEventClick`, was `z.function()` in a multi-line spelling the
    anchored census missed.
  
  All eight now carry `handlerKeyRefusal(key, disposition, label)`: an authored string, an
  authored object and a live function are each refused at the key's own path with
  `code: 'custom'` and a message that names the key, says why JSON cannot author it and
  points at the node-type spelling. Nothing that used to be refused parses green.
  
  **The TypeScript face, measured per key** — a function type only where a runtime consumer
  reads a function, else `?: never`:
  
  - Runtime slots (callable kept): `DetailViewSchema.onBack` (now `() => void`, the prop
    `DetailView` invokes — it declared `string`), `DetailSchema.onBack`, `ActionSchema.onClick`,
    `CalendarViewSchema.onEventClick`.
  - Retired (`?: never`): `AppAction.onClick` (no reader touches `onClick`, on the action
    or on `items[]` — `AppComponentSchema.actions[]` itself IS read, by
    `@object-ui/runner`'s `LayoutRenderer`, so the array being unread was never the
    reason this key is inert; corrected at objectui#7721),
    `ReportBuilderSchema.onSave` / `.onCancel` (no `report-builder` renderer is registered),
    `CRUDDialogSchema.onClose` (no `crud-dialog` renderer is registered).
  
  The three `views.zod.ts` `z.string()` keys that are event NAMES (`onViewChange`, the two
  `onChange`, PR #6899) are untouched; their describe text says so and the new pin reads it.
  `zod-mirror-parity.test.ts` records the three new runtime-slot drift rows;
  `content/docs/core/app-schema.mdx` spells its `AppAction.onClick` row `never` and drops the
  string example, the two edits the #7340 docs pin and `check:doc-snippets` require.
- 52c8cf7: `DrillDownConfigSchema` is the zod mirror of `DrillDownConfig`, and both
  declarations that carry `drillDown` reference it — `ChartSchema`
  (`zod/data-display.zod.ts`) and `ObjectDataTableSchema` (`zod/objectql.zod.ts`)
  — so the published validator under `@object-ui/types/zod` reads the key for the
  first time (objectui#7352).
  
  `DrillDownConfig` has been declared on the TypeScript face since objectui#6058
  seeded the parity ledger, and objectui#6576 declared it on a second type. No zod
  mirror existed, so under `BaseSchema`'s `.passthrough()` a
  `drillDown: { enabled: 'yes' }` parsed green and rode through to a widget that
  reads `enabled` as truthy — `declared !== enforced` on a published surface.
  
  Accept-set change on the published validator, stated plainly:
  
  - NARROWS: a `drillDown` whose declared key holds a value outside its declared
    type (`enabled: 'yes'`, `mode: 'jump'`, `maxRows: '50'`, `report: 'pipeline'`)
    is now refused BY NAME on a `chart` or `object-data-table` node, where it
    previously rode through untouched.
  - Unchanged: every value the TypeScript declares still validates, including the
    `{ enabled: true }` / `{ enabled: true, mode: 'record' }` blocks the dashboard
    renderer synthesises, `report`'s two structural forms, and an inline report's
    extra keys (the declaration's index signature is `.catchall(z.unknown())`).
  - Output shape, worth knowing before you read a parsed `drillDown.report`: the
    member is a union, and its two arms differ in what they KEEP. The inline arm
    carries the declaration's index signature as `.catchall(z.unknown())`, so extra
    report keys survive; the named-reference arm is a plain object, so a value that
    reaches it keeps only `name` (`{ name: 'x', columns: [] }` is accepted, and
    parses to `{ name: 'x' }`). Both were accepted and unvalidated before, and
    neither is refused now.
  - Unchanged: `PivotTableSchema.drillDown` has no zod mirror at all, and
    `DataTableSchema` declares the key on neither face — both are untouched here.
  - New export on `@object-ui/types/zod`: `DrillDownConfigSchema`.
  
  `DrillDownConfigSchema` is deliberately NOT `@objectstack/spec/ui`'s
  `ChartDrillDownSchema`: that object models the chart-only subset strictly and
  refuses `mode` and `report` by name, both of which are live keys on the table /
  pivot / metric widgets that share `DrillDownConfig`.
- 52c8cf7: `ObjectGallerySchema` and `ObjectDataTableSchema` are members of
  `ObjectQLComponentSchema` on both faces — the TS union in `objectql.ts` and the
  zod union in `zod/objectql.zod.ts` — so `AnyComponentSchema`, and with it
  `validateSchema` / `safeValidateSchema` / `objectui validate`, has an arm for
  `object-gallery` and `object-data-table` nodes (objectui#7363).
  
  PR #7355 (objectui#6576) minted both schemas beside the other `Object*Schema`
  members and deliberately left the unions alone. Until now a document carrying
  either node was refused as matching NO arm — exactly as before the schemas
  existed — and a wrong-typed declared key on it could never be diagnosed by name.
  
  Accept-set change on the published validator, both directions, stated plainly:
  
  - WIDENS: a well-formed `object-gallery` / `object-data-table` node now
    validates instead of being refused for having no arm.
  - NARROWS in effect: a malformed one (`searchable: 'yes'`, `imageField: 42`,
    `onRowClick` authored as JSON) is now refused BY NAME by the arm, where it was
    previously refused only as "no arm matches".
  - TS face: `Extract< ObjectQLComponentSchema, { type: 'object-gallery' } >`
    resolves to `ObjectGallerySchema` instead of `never`; likewise for
    `object-data-table`. `SchemaByType` has no in-repo consumer, and the wider
    `AnySchema` union already carried `BaseSchema`, so nothing narrows there.
  
  No renderer behaviour changes; both nodes rendered before and render the same.
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
- 51eb515: **Removes two published exports.** Retire the `MobileResponsiveConfig` and
  `GestureConfig` types (objectui#7519, ADR-0049 enforce-or-remove). Both names
  are deleted from `@object-ui/types` and from `@object-ui/mobile`, which
  re-exported them — after this release `import type { MobileResponsiveConfig }`
  or `import type { GestureConfig }` from either package is a compile error, not a
  deprecation warning.
  
  Each had exactly one consumer: the `responsive` and `gestures` members of
  `MobileComponentConfig`, which objectui#5942 retired. Re-measured on current
  `main` before anything was deleted, each was a declaration plus the two barrel
  re-exports and nothing else — no type mounted either, nothing extended,
  annotated, cast to or imported them outside the barrels, and the example apps
  and the `objectstack` sibling checkout had zero authors. A value written against
  either could not reach a renderer or a handler by any path. That is the same
  declared-surface-with-no-consumption-path shape as `MobileComponentConfig`
  itself and `MobileOverrides` (objectui#4919) before it, one level down.
  
  Removed outright rather than kept as `?: never` tombstones, measured against
  this package's two-prong discriminator (a tombstone steers authors to a named
  live replacement key, or keeps loud a key the docs taught as working). Prong 1:
  neither has a replacement key — the behaviour they named lives in hooks, and
  `SpecGestureConfig` is a different contract, not a successor. Prong 2: the only
  release-note lines naming either are the objectstack#4115 rename-ledger rows
  and, for `GestureConfig`, the objectui#3363 reclaim note; none taught a
  renderer or dispatcher reading them, and no member carried a published
  `@default` (contrast `triggerIcon`, tombstoned by objectui#7654 on exactly that
  evidence). Structurally there is also no silent-strip hazard for a tombstone to
  guard: whole interfaces go, nothing ever parsed them, and the mobile module has
  never had a `zod/` twin to host a `retirementTombstone()`. The compiler was the
  only channel these names ever had, and the refusal now lives there.
  
  ## Upgrading
  
  **No behaviour changes and there is nothing to migrate at runtime.** An object
  authored against either type did nothing before and does nothing now; what
  changes is that the contract no longer claims otherwise, so the mistake surfaces
  at authoring time instead of silently type-checking.
  
  - **You imported a type only** (the only thing that was possible — nothing
    accepted either as a value): delete the import. If you kept a local object
    annotated with it, drop the annotation; it was never passed anywhere that read
    it.
  - **You wanted per-breakpoint layout:** it exists and is not being retired —
    `useResponsive` / `ResponsiveContainer` / `useBreakpoint` in
    `@object-ui/mobile`. `ResponsiveValue` and `BreakpointName` stay exported from
    both packages.
  - **You wanted to bind a gesture to a handler:** `useGesture` in
    `@object-ui/mobile` takes `{ type: GestureType, onGesture, threshold?,
    longPressDuration?, enabled? }`. `GestureType` and `GestureContext` stay
    exported from both packages.
  - **You want a declarative mobile config surface:** that re-enters deliberately
    as designed product surface on its own card, with the renderer that reads it
    landing in the same change as the declaration — not by restoring these
    declarations.
  
  **Do not follow the compiler's suggestion for `GestureConfig`.** Measured against
  the built declarations: `import type { GestureConfig }` from either package now
  fails as TS2724 with `Did you mean 'SpecGestureConfig'?`. That is a lexical
  near-match, not a migration target. `SpecGestureConfig` is the retired
  `@objectstack/spec` `ui/touch` **tuning** record (`{ type, label, enabled,
  swipe, pinch, longPress }`) that `useSpecGesture` reads; it has no `action`
  member and does not bind a gesture to anything. `MobileResponsiveConfig` fails
  as a plain TS2305 with no suggestion from either package.
  
  Marked `minor`, not `major`, per this repo's version-alignment rule (AGENTS.md
  版本号策略), which reserves `major` for following `@objectstack` across a major —
  the same classification objectui#5942 and objectui#4919 used for identically
  breaking type removals. **Breaking for TypeScript consumers of the two names
  only.** The in-repo consumer count is zero; consumers outside this repository
  that import either name from either package are not visible from here, which is
  why this entry is graded on the published-surface change and not on that count.
- c354ce5: **`BaseSchema.visible` / `.hidden` / `.disabled` now declare the CEL envelope object the renderer already evaluates, as one named wire type** (objectui#7530, maintainer ruling 2026-09-04, option A).
  
  Each of the three keys goes from `boolean | string` to `boolean | ExpressionWire` on both faces, where `ExpressionWire` is `string | { dialect?: string; source: string }` — the exact string-or-envelope union `FormField.visibleWhen` and its `*When` / `*On` siblings already carried, and the exact accept set of `@object-ui/core`'s `toPredicateInput` / `hasDeclaredPredicate`. The Zod mirror's `z.union([z.boolean(), z.string()])` becomes `z.union([z.boolean(), ExpressionWireSchema])` on all three.
  
  Two names are new on the published surface:
  
  - `ExpressionWire` (type, main entry) — the TypeScript wire union, in `packages/types/src/expression.ts`.
  - `ExpressionWireSchema` (`@object-ui/types/zod`) — its runtime twin, hoisted out of `zod/form.zod.ts` (where it was module-private) into `zod/expression.zod.ts` and imported by both `base.zod.ts` and `form.zod.ts`. One envelope type, reused by reference; no second spelling.
  
  This is a **widening**, not a replacement, and the renderer's behaviour is untouched: `SchemaRenderer`'s `shouldHide` / `shouldDisable` chains already routed all three keys through core's one definition of "declared" and evaluated the value, and the envelope was already pinned as working on `hidden` and `disabled` — through a `Record` cast, because no key declared it. Measured before this change, `BaseSchema.safeParse({ type, hidden: { dialect: 'cel', source: 'true' } })` returned `success: false` (`invalid_union` at path `hidden`) while the identical envelope on `FormField.visibleWhen` parsed one file over; that is the gap this closes, on all three keys at once. Every boolean and string value keeps parsing and keeps type-checking unchanged. `dialect` is optional and unconstrained on the wire because the runtime reads it that way (only `'cel'` keeps its envelope on the canonical engine; anything else is unwrapped onto the legacy path).
  
  Not changed: `hasDeclaredPredicate` (no per-key branch — option B was rejected), the `*On` / `visibleWhen` sibling keys, and `ActionSchema.condition`, which already declared the envelope inline.
  
  Per this repository's version-alignment convention, a widening of a published type surface ships as `minor` with the semantics spelled out here rather than as `major` (see AGENTS.md, "版本号策略").
- 8fe8e5c: `ChartDataSeriesSchema` (and its TS twin `ChartDataSeries`) declares the six series keys the
  renderer reads — `label`, `variant`, `opacity`, `dashArray`, `stack`, `yAxis` — which the
  non-strict Zod object had been **stripping in silence** while `safeParse` reported success
  (objectui#7546, `domain:ui` PM ruling: measure per key, declare what is live, report the rest).
  
  ⚠️ Shipped as `minor`, not `patch`. The declared value domains are the read's own, so the accept
  set widens toward what already renders — but one document class that validated before now
  **refuses**: a series carrying one of these keys with a value the renderer drops in silence
  (`variant: 'bogus'`, `yAxis: 'top'`, `opacity: '0.4'` / `Infinity`, a non-string `stack` /
  `dashArray`, a non-string non-map `label`) — and, separately, `variant: 'current'`, which the
  renderer does NOT drop: the normalizer keeps that renderer-internal spelling and draws it exactly as
  `primary`, but it is not a member of the published pair, so it now refuses at `variant` (below).
  Such a document draws a chart today — the normalizer ignores the bad value, or honours `current`
  — so this is a narrowing away from something that renders, which is the
  distinction objectui#6939's grading language turns on, and it takes the level objectui#6896 and
  objectui#7113 set for the same transition in this same file. This repository's `major` is a
  cross-repo pin to `@objectstack`'s major, not a severity dial; the change is announced here.
  
  ## The defect, measured
  
  `ChartDataSeriesSchema` is a non-strict `z.object` — not `.passthrough()` like `BaseSchema` — so an
  undeclared key is removed, not kept. Reproduced red on `origin/main` `a472b071` before the change:
  
  ```
  input : { name, label, stack, yAxis, opacity, dashArray, variant }
  parse : success = true
  output: { name }
  ```
  
  Every one of the six is read by `normalizeSeries` (`@object-ui/plugin-charts`,
  `normalizeChartSchema.ts:242-255`) and does real work in `AdvancedChartImpl.tsx` — `label` names
  the legend entry, `variant === 'comparison'` selects the muted overlay, `opacity` / `dashArray` set
  stroke and fill, `stack` becomes Recharts' `stackId`, `yAxis` binds the secondary axis. Any consumer
  of the parse output — `objectui check` / `objectui validate` via `safeValidateSchema`, a JSON
  schema derived from the mirror, or any pipeline that keeps `parse()`'s result — lost them outright.
  
  ## Per-key liveness, not a blanket declare
  
  "The renderer reads it" was ruled insufficient (a read leg can sit on a value nothing produces —
  objectui#7642), so each key was measured on producers, real work in the reader, and consumer
  surprise, with a lit control on every count. The six are `@objectstack/spec`'s own
  `ChartSeriesSchema` members under the same names and value domains; this node's `series`
  accepts the spec shape by design; in-repo producers write them onto `type: 'chart'` nodes
  (`DashboardRenderer`, `ObjectChart`, `DatasetWidget`, `core/utils/chart-presentation`); and
  the `variant` / `yAxis` narrowings are design intent the reader already enforces.
  
  **`chartType` — the seventh key the review found — is deliberately NOT declared.** It is the first
  limb of `str(raw.chartType) ?? str(raw.type)`, but it is the renderer's *internal* spelling of the
  declared `type`; the spec's `ChartSeriesSchema` lists it as an alias of `type` and refuses it by
  name; and zero documents, fixtures, catalog entries or designer inputs write it on this face
  (controls lit). Declaring it would mint a second writable name for one override. It is reported
  for its own card; the mirror still strips it, and the pin test holds that gap visible.
  
  ## FROM → TO
  
  ```ts
  // ChartDataSeries — all optional, all additive on the TS face
  + label?: string | I18nLabel;                       // spec I18nLabel: string | inline locale map
  + variant?: 'primary' | 'comparison';               // the spec's own pair
  + opacity?: number;                                 // finite; NaN / Infinity / strings refused (the spec's 0–1 bound is not enforced — the read's domain)
  + dashArray?: string;
  + stack?: string;
  + yAxis?: 'left' | 'right';
  ```
  
  `variant` is the spec's own pair. The normalizer also tolerates a third spelling, `current`, but that
  is the renderer's internal default — written only by the compare-to producers (`ObjectChart`,
  `DatasetWidget`) onto internal-shape arrays that never pass this mirror, and by nothing an author
  writes (docs, fixtures, designer inputs: 0, controls lit) — so it is not a member here: declaring it
  would have fossilised a renderer-side tolerance into a second contract. The normalizer's tolerance
  is unchanged; objectui#7682 owns that decision.
  
  ## Unchanged, deliberately
  
  The object stays non-strict — a truly undeclared key is still stripped, exactly as
  `chart-inline-data-retired.test.ts` pins; this change declares what is read, it does not close
  the object. The `data` tombstone (objectui#6896) and the at-least-one-binding refinement
  (objectui#6939 / #7113) are untouched. No reader changed.
  
  Pinned in `packages/types/src/__tests__/chart-series-keys-7546.test.ts` — the card's fixture
  surviving byte-for-byte, each key on the mirror's own `.shape`, each value domain refusing at its
  own path, the TS face in lockstep, and the `chartType` gap.
- e62c44e: Re-home the breakpoint layout vocabulary and delete the two dead responsive
  implementations (objectui#7580, maintainer ruling 2026-09-04, option A).
  
  **Breaking, deliberately, in one direction only.** `@objectstack/spec` retired its whole
  `ui/responsive` vocabulary in objectstack#11027 — `ResponsiveConfigSchema`,
  `BreakpointName`, `BreakpointColumnMapSchema` and `BreakpointOrderMapSchema` — on the
  stated ground that the four types "had no other authorable carrier". That ground is
  measurably false on the renderer side: `responsive-grid` is a REGISTERED SDUI component
  whose authorable `columns` input is typed by `BreakpointColumnMap` and applied by
  `resolveColumnClasses` on the render path, and `BreakpointName` types four live readers in
  `@object-ui/mobile`. The tombstone's own return condition — the vocabulary "returns if and
  when a renderer implements it" — is already met here, so the two types a renderer reads
  are re-homed rather than retired.
  
  What survives, under the same names and the same members:
  
  - `BreakpointName` (`xs`…`2xl`) is now declared in `@object-ui/types` (`mobile.ts`) instead
    of re-exported from the spec. **No consumer change**: same name, same six members, same
    export sites on `@object-ui/types` and `@object-ui/mobile`. Only its provenance moved.
  - `BreakpointColumnMap` is now declared in `@object-ui/layout` (`ResponsiveGrid.tsx`),
    verbatim from the retired `$strict` schema: six optional column counts, no index
    signature. `responsive-grid`'s `columns` input and its resolver are unchanged.
  
  What is removed:
  
  - `BreakpointOrderMap` (`@object-ui/layout`) — retired with the key, not re-homed. It had
    no read point in the package; it was published only because the retired
    `ResponsiveConfigSchema` paired it with the column map, so an author configuring `order`
    needed the type. With the schema gone there is no order vocabulary for it to be the type
    of, and re-declaring it would be the declare-without-enforce shape ADR-0049 removes.
  - `useResponsiveConfig` (`@object-ui/mobile`), with its `SpecResponsiveConfig` and
    `ResolvedResponsiveState` exports, and `ResponsiveProtocol` (`@object-ui/core`), with
    `resolveResponsiveConfig` / `getVisibilityClasses` / `getColumnClasses` /
    `getOrderClasses` / `shouldHideAtBreakpoint`. Both read the retired
    `ResponsiveConfigSchema` and both were measured at zero callers (objectui#4773).
  - `SpecResponsiveConfig` / `SpecBreakpointName` (`@object-ui/types`) — dead re-exports once
    the two implementations above went, dropped rather than re-declared locally, the same
    disposition the retired i18n names in that file already carry.
  
  No behaviour is retired. The live per-breakpoint readers — `useBreakpoint`,
  `ResponsiveContainer`, `BREAKPOINTS` / `BREAKPOINT_ORDER` / `getCurrentBreakpoint`, and
  `responsive-grid` itself — are untouched.
  
  **Sequencing.** objectui's next `@objectstack/spec` pin bump must carry `Blocked-by:`
  objectui#7580: the retirement is merged upstream and unreleased, so this must land first.
- 5d0876c: **Published TS surface narrowed:** `DashboardComponentSchema` no longer declares the
  dashboard-root `title` member (objectui#7623).
  
  Its doc comment said "Dashboard title displayed in the header", and that stopped being
  true one release earlier: objectui#7509 retired all five dashboard-root `title` read
  arms under ADR-0049, leaving the key declared, documented as rendering, and inert. The
  header text is the spec-canonical `label` on `BaseSchema`, resolved through
  `pickLocalized`.
  
  What an author loses is the **type-level suggestion** only, and there is **no runtime
  and no validation behaviour change**. `BaseSchema`'s index signature means an existing
  `title:` line still compiles; objectui's Zod twin extends `.passthrough()` `BaseSchema`,
  so it parsed a root `title` before this release and still does; and a document validated
  against `@objectstack/spec`'s strict `DashboardSchema` was already refused there
  (`unrecognized_keys: ['title']`) long before it reached a renderer. Nothing that rendered
  stops rendering — the read arms were already gone.
  
  **Unlike `aria` (objectui#5830), no tombstone comes with this.** The spec refuses a root
  `title` as an unrecognized key, not with a named removal message, so there is nothing to
  inherit by reference and none was invented; the pin
  (`packages/types/src/__tests__/dashboard-title-retired-declaration.test.ts`) asserts the
  key-set half only — `title` is out of the interface's declared members while `columns`,
  `widgets` and `header` stay in.
  
  **Not affected, despite the shared name:** widget-level `DashboardWidget.title` — the
  spec's `I18nLabel` on a different receiver, live, declared and read by
  `DashboardRenderer`, `DashboardGridLayout` and `DashboardWithConfig`. The pin carries it
  as an explicit control.
  
  **Migration:** delete a dashboard-root `title` from any authored dashboard and use
  `label` (it accepts a string or a per-locale map). Widget titles are unchanged.
- bc640ec: `SchemaRegistry['kanban']` stops describing a component it cannot name
  
  `SchemaRegistry` documents itself as "the Single Source of Truth for component
  type lookups". Its `'kanban'` entry named `DeclarativeKanbanSchema` — the
  authoring/validation face declared in this package — while the renderer
  registered for that key is `ObjectKanbanRenderer` in `@object-ui/plugin-kanban`
  (`ComponentRegistry.register('kanban', …)`), which consumes that package's own
  `KanbanSchema`. The two are distinct dialects, measured member by member: the
  plugin face declares 19 members in its own body, the declarative face 7, and
  they share three names — `type`, `columns` and `onCardMove`. `onCardMove` has
  the same signature on both sides; `columns` is required
  `DeclarativeKanbanColumn[]` on one and optional `KanbanColumn[]` on the other,
  the two element types sharing five of their six members; the remaining 16
  plugin members and the declarative `draggable` / `onCardClick` have no
  counterpart across the gap. For this one key the map's value did not describe
  the component the key names.
  
  Pointing the entry at the honest type is not reachable from this layer, and
  that was measured rather than assumed. Importing `@object-ui/plugin-kanban`
  here is a phantom dependency — `check:phantom-deps` rejects it by file and
  pair, type-only imports included — and declaring the dependency would close the
  cycle `@object-ui/types` → `@object-ui/plugin-kanban` → `@object-ui/types`,
  because this package is the zero-workspace-dependency bottom layer.
  objectui#6172's ruling (2026-08-31) kept the plugin's bare names rather than
  relocating that dialect down here — that is why this entry cannot name the
  plugin's type at this commit. That half of the ruling has since been reversed:
  objectui#7664's ruling (a) (2026-09-05) rewrites this package's `'kanban'`
  arm to the plugin's shape, has `@object-ui/plugin-kanban` conform to it, and
  retires the `DeclarativeKanban*` trio; `registry.ts` is on its execution list,
  so this entry is scheduled to be re-pointed at the declared type. The value
  below is the transitional state under that ruling, not the permanent one.
  
  So the entry now asserts only what this layer can prove, and what BOTH dialects
  satisfy: `BaseSchema & { type: 'kanban' }`.
  
  **What this changes for consumers.** `keyof SchemaRegistry` — and therefore the
  published `ComponentType` union — is unchanged; `'kanban'` is still a member,
  pinned at compile time so it cannot be narrowed away silently. What changes is
  the value side of this one key, in two ways, one loud and one silent:
  
  - **Breaking, loudly, for consumers who indexed `SchemaRegistry['kanban']` and
    flowed the value into the declarative face.** Before this change
    `SchemaRegistry['kanban']` *was* `DeclarativeKanbanSchema`, so
    `const s: DeclarativeKanbanSchema = registryValue` compiled. It no longer
    does: the entry lacks the required `columns` member, and that assignment is
    a compile error (TS2741). Nothing in this repository performed such an
    indexed access, so no in-repo code moves — the break is for consumers
    outside it.
  - **Silent, for member reads.** `BaseSchema` carries an index signature
    (`[key: string]: any`), so reading the declarative face's own members —
    `columns`, `draggable`, `onCardMove`, `onCardClick` — off the new entry is
    not an error: the reads resolve through the index signature and type as
    `any`. `SchemaRegistry['kanban']['columns']` was `DeclarativeKanbanColumn[]`
    and is now `any`; nothing turns red, the read just stops being checked.
    (Undeclared keys already read as `any` before, through the same signature;
    what changes is those declared members.)
  
  Migration: name the face you actually mean. `DeclarativeKanbanSchema` is still
  exported from `@object-ui/types` unchanged for the authoring face, and
  `KanbanSchema` from `@object-ui/plugin-kanban` for the rendered one.
  
  This is a breaking change shipped as `minor`: this repository's
  version-alignment rule keeps objectui's major pinned to `@objectstack`'s and
  ships objectui's own breaking changes as `minor` with the break spelled out in
  the changeset body, which is what the two bullets above are.
- 3e377c9: Retire `ChatbotSchema.displayMode` — and its copy on `ChatbotFloatingSchema` — as an
  ADR-0049 retirement tombstone, and remove the `chatbot-floating` registration's
  "Display Mode" designer control and its `defaultProps.displayMode: 'floating'` seed
  (objectui#7654, maintainer ruling B of 2026-09-05, director decision batch #44).
  
  ⚠️ **BREAKING for anyone authoring `displayMode` against a chatbot face in TypeScript.**
  Ships as `minor` per the launch-window convention: objectui's `major` is a cross-repo pin
  to `@objectstack`'s so that "same major means compatible" holds across the two repos
  (`scripts/check-changeset-no-major.mjs`), and objectui's own breaking changes ship as
  `minor` with the break named where it lands — this entry is the channel that carries it.
  
  ## What was retired, and why
  
  The node `type` — `chatbot-floating` versus `chatbot` / `chatbot-enhanced` — is the one
  selector of presentation. `displayMode` (`'inline' | 'floating'`) was a second spelling
  of that same choice, and no renderer has ever read it: `chatbot-floating` renders the
  trigger and panel unconditionally, and `chatbot` never looked at the key, so
  `displayMode: 'floating'` on a `chatbot` node produced no trigger and `'inline'` on a
  `chatbot-floating` node changed nothing. It was nevertheless declared on both faces,
  painted as a **Display Mode** control in the designer's property panel, and written as
  `'floating'` into every node the designer created — two surfaces teaching a switch that
  did not exist.
  
  Re-measured on this branch's base rather than inherited from the card: a whole-repo
  `git grep` census over tracked files, build output excluded, returned the declarations,
  the doc comments and parity-ledger entries beside them, one historical CHANGELOG line and
  two unrelated `displayMode` props on `GridField` / `MasterDetailForm` — no read. The same
  pass over `floatingConfig`, a key that IS read, returned 79 lines, so the instrument was
  not blind.
  
  FROM → TO:
  
  - `ChatbotSchema.displayMode?: 'inline' | 'floating'` → **`displayMode?: never`**, an
    ADR-0049 retirement tombstone whose comment points at `type` as the replacement.
  - `ChatbotFloatingSchema.displayMode?: 'inline' | 'floating'` → **`displayMode?: never`**,
    the same tombstone. objectui#7655 declared the key on the floating face with
    `ChatbotSchema`'s own lines precisely so this retirement would find it on both faces;
    leaving the copy typed would have kept the published face teaching the switch.
  - `chatbot-floating` `inputs`: the **Display Mode** control is removed.
  - `chatbot-floating` `defaultProps`: `displayMode: 'floating'` is no longer written into
    designer-created nodes.
  
  A control is restated, never deleted into a vacuum (objectui#7070): the restatement of
  the removed control is the tombstone's guidance plus this note.
  
  **Migration.** Delete `displayMode` from any TypeScript literal typed as `ChatbotSchema`
  or `ChatbotFloatingSchema`; the presentation you wanted is already chosen by `type` —
  `'chatbot-floating'` for the trigger-and-panel, `'chatbot'` / `'chatbot-enhanced'` for
  inline. **No JSON document needs editing** — see the next section.
  
  ## Stored documents: runtime validation of this key is unchanged — zero before, zero after
  
  `displayMode` has never had a Zod arm — it sits in the `UnmirroredDeclared` ledger for
  both `complex.zod.ts#ChatbotSchema` and `#ChatbotFloatingSchema`, and `BaseSchema` is
  `.passthrough()` — so a stored document carrying `displayMode: 'floating'` (every node
  the designer ever created) parses green before this change and parses green after it,
  and the value is dropped at render time exactly as it always was.
  
  That is deliberate, and it is why this tombstone has **no `retirementTombstone()`
  half**: minting a mirror arm to refuse the key would be the declared-but-unmirrored axis
  (objectui#6152), a different defect, and a parse outcome the ruling did not ask for.
  `packages/types/src/__tests__/chatbot-display-mode-retired.test.ts` pins both twins'
  shapes as a **tripwire** — the same shape objectui#7669 gave `triggerIcon` — so that if
  objectui#6152 ever mints an arm for `displayMode`, the pin goes red and whoever lands the
  mirror adds the `retirementTombstone()` half at that time, flipping the control rather
  than deleting it.
  
  ## Why a tombstone and not a deletion — measured on this carrier
  
  `ChatbotSchema` extends `BaseSchema`, which carries a `[key: string]: any` index
  signature, and on such a carrier deleting an optional member is **silent in every value
  shape**: the index signature defeats both excess-property checking and the weak-type
  check. Measured on this member with `tsc -p tsconfig.test.json`, a no-index-signature
  control carrier (`FloatingChatbotConfig`) lit in the same run:
  
  | route | fresh `'floating'` | fresh `'bogus'` | widened `'floating'` |
  |---|---|---|---|
  | declared (before) | clean | `TS2322` | clean |
  | deleted | clean | **clean** | clean |
  | tombstoned (after) | `TS2322` | `TS2322` | `TS2322` |
  
  Deleted, the member reads as `any` and even a wrong-typed value goes quiet. Tombstoned,
  **presence with any value** is a compile error — a channel deletion cannot produce on
  this carrier at all. On a `BaseSchema` carrier the two routes are loud-vs-silent, not
  louder-vs-quieter (the discriminator's carrier branch as corrected on objectui#7678).
  Prong 2 of that discriminator licenses the tombstone: the key was advertised in the
  3.3.0 release record (`CHANGELOG.md:578`) and its published comment taught it as the
  presentation switch. The deleted row is pinned in the test file as a live control — an
  undeclared key that rides both shapes with no directive — so the contrast cannot rot.
  
  ## Accept-set change, one line per face
  
  - **TypeScript.** A write of `displayMode` against either chatbot face used to compile
    and now does not.
  - **Runtime (Zod / `safeValidateSchema`).** Nothing changes at all — a stored document
    carrying the key parses green before and after, and keeps the value.
  - **Designer.** The **Display Mode** control disappears from the `chatbot-floating`
    property panel, and newly created nodes no longer carry the key.
  - **Manifest, author-time validator, and generated JSX props.** The `chatbot-floating`
    registration's `inputs` go from 20 entries to 19 and its `defaultProps` from 9 keys to
    8, so the manifest projected from them no longer lists the prop. Measured on both sides
    of this change: `validateTree` on a stored `chatbot-floating` node carrying
    `displayMode` goes from **0 diagnostics to exactly 1** — code `unknown-prop`, severity
    **`warning`**, message `` `<chatbot-floating> has no prop "displayMode"` `` — which is
    what the JSX/HTML authoring tier reports through `compile()`. In the same pair of runs
    the props interface `generateDts` derives from those same `inputs` drops from 20 members
    to 19, losing its `displayMode?: string` line, so a `.tsx` page written against those
    generated intrinsics no longer type-checks the attribute.
  
    **This is author-time only: no stored document stops parsing and nothing at render
    moves.** The value survives compilation — `compile()` returns a tree still carrying
    `displayMode: 'floating'`, byte-for-byte the same keys before and after — and a
    `warning` never blocks a page, because the page renderer filters the diagnostics to
    `severity === 'error'` before deciding whether to fail. Two neighbouring instruments are
    untouched and worth naming so the scope is not read wider than it is: `os validate` runs
    `safeValidateSchema`, the Zod path, and is silent on this key before and after; and the
    build-time `sdui-intrinsics.d.ts` artifact is generated from the PUBLIC tier, which does
    not contain `chatbot-floating` on either side of this change.
- a3eb5d0: Retire `FloatingChatbotConfig.triggerIcon` (objectui#7654, ADR-0049 enforce-or-remove).
  
  `triggerIcon` was declared `?: string` with `@default 'MessageCircle'` and read by nothing.
  `FloatingChatbot` destructures six of the interface's seven keys — `position`,
  `defaultOpen`, `panelWidth`, `panelHeight`, `title`, `triggerSize` — and never this one,
  and `FloatingChatbotTrigger` takes no icon prop at all, so the advertised default never
  rendered either. Re-measured on this branch's base rather than inherited from the card: a
  whole-repo `git grep` census over tracked files, build output excluded, returns the
  declaration and one historical CHANGELOG line and nothing else, while the same pass over
  `triggerSize` — a key that IS read — returns ten sites across four files, so the instrument
  was not blind.
  
  It is also absent from the `chatbot-floating` registration's `inputs` AND from its
  `defaultProps` (`packages/plugin-chatbot/src/renderer.tsx`), both re-confirmed here. No
  designer control ever offered it and no designer-created node carries it, so TypeScript was
  the only way to reach the key. That is what makes this half of objectui#7654 an ordinary
  retirement; the card's other key, `displayMode`, is seeded into `defaultProps` and is NOT
  touched here.
  
  FROM → TO: `triggerIcon?: string` → **tombstoned**, `?: never` on the interface. The FAB
  trigger renders a fixed icon and takes no icon prop; there is no authored spelling that
  changes it.
  
  ## This tombstone has NO Zod half, deliberately
  
  Every other tombstone in this package pairs `?: never` with a `retirementTombstone()`
  refusal on the Zod twin. There is no twin here to carry one: `FloatingChatbotConfig` has no
  Zod mirror at all, and `floatingConfig` sits in the `UnmirroredDeclared` ledger
  (`zod-mirror-parity.test.ts`, `complex.zod.ts#ChatbotSchema`). `BaseSchema` is
  `.passthrough()`, so the whole `floatingConfig` object rides through unvalidated — before
  this change and after it. Minting a mirror to host a refusal would be the
  declared-but-UNMIRRORED axis (objectui#6152), a different defect: a key can be mirrored and
  inert, or unmirrored and live, and fixing one says nothing about the other. This change
  does not widen into it.
  
  **Accept-set change, stated plainly for reviewers:** on the TypeScript face, a write of
  `FloatingChatbotConfig.triggerIcon` used to compile and now does not. On the runtime face,
  nothing changes at all — the key parsed green before and parses green after. The refusal is
  TYPE-LEVEL ONLY, which is narrower than this package's other tombstones and is the reason
  this carries a contract-review label rather than being filed as an internal tidy-up.
  
  ## Why a tombstone and not a deletion, when the usual argument does not apply
  
  The usual case for `?: never` argues from the mirror: an undeclared key is silently
  STRIPPED by a non-strict `z.object`, so deleting trades one silent no-op for another. With
  no mirror, that argument is unavailable, so the route was measured on the `tsc` channel
  alone instead:
  
  | route | fresh object literal | widened (non-fresh) value |
  |---|---|---|
  | deleted | `TS2353` excess-property error | **compiles CLEAN** |
  | tombstoned | `TS2322` | `TS2322` |
  
  Excess-property checking only reaches a fresh literal, so deletion would have left the
  widened path — `const raw = { triggerIcon: 'Sparkles' }; const cfg: FloatingChatbotConfig =
  raw;` — silently accepting a key nothing reads. The declared `never` makes the assignment
  itself ill-typed, so freshness stops mattering. Both rows are pinned in
  `packages/types/src/__tests__/floating-chatbot-trigger-icon-retired.test.ts`, the "deleted"
  row as a live control on a genuinely undeclared key rather than as prose, so the contrast
  cannot rot.
  
  That file also pins the runtime half as a **tripwire**: it asserts that a node carrying
  `floatingConfig.triggerIcon` still parses green. If objectui#6152 ever mints a
  `FloatingChatbotConfigSchema`, it goes red — the intended signal that whoever lands the
  mirror must add the `retirementTombstone()` half at the same time and flip the control
  rather than delete it into a vacuum.
- 4ce14f1: One named, importable authoring-face type per `plugin-chatbot` registration:
  `ChatbotEnhancedSchema` and `ChatbotFloatingSchema` join `ChatbotSchema`
  (objectui#7655, under the objectui#6169 / #6172 family ruling — every component
  node has exactly one named, importable authoring-face type).
  
  `packages/plugin-chatbot` registers three components — `chatbot`,
  `chatbot-enhanced`, `chatbot-floating` — and `@object-ui/types` published ONE
  face for the family with `type` pinned to `'chatbot'`. An author annotating a
  `chatbot-enhanced` or `chatbot-floating` node either dropped to untyped JSON or
  annotated with `ChatbotSchema` and lied about `type`; the docs' floating example
  had to be a `json` fence because no `tsx` fence could compile. The two
  registrations' real key sets lived in anonymous `ChatbotSchema & { ... }`
  intersections local to the renderer, referenceable by nothing outside that file.
  
  ## The shape, and why not the smaller diff
  
  One interface per registration, not `ChatbotSchema['type']` widened to the union
  of the three keys. The union would give three nodes ONE type and re-open what
  #6169 closed — a single interface declaring keys only some of its own `type`
  values read — and this card exists because the family's declarations had already
  drifted from its reads. Each face declares what ITS registration reads, censused
  per key on the PR's base (one `schema.KEY` read per registration body in
  `renderer.tsx`, lit by keys that are NOT shared: `processVisibility` 0 / 1 / 0,
  `floatingConfig` 0 / 0 / 1), and the twenty keys all three read are picked off
  `ChatbotSchema` by name (`ChatbotSharedKey`) so they stay one declaration:
  
  - **`ChatbotEnhancedSchema`** (`type: 'chatbot-enhanced'`): the shared twenty,
    plus `maxHeight` and `processVisibility` (read here, not by the floating
    panel), plus `enableMarkdown`, `enableFileUpload`, `surface` (`'card' |
    'plain'`, objectui#6687) and the `onClear` runtime slot — four keys
    `ChatbotSchema` never declared.
  - **`ChatbotFloatingSchema`** (`type: 'chatbot-floating'`): the shared twenty,
    plus `enableMarkdown`, `enableFileUpload`, `onClear`, and the two keys it
    declares alongside `ChatbotSchema` — `floatingConfig` (`FloatingChatbotConfig`)
    and `displayMode`. No `maxHeight`, `processVisibility` or `surface`: the
    floating registration has no named read for any of them. (Its trailing raw
    props spread does carry authored keys into the panel today — `processVisibility`,
    `surface` and `showAvatars` are live there, measured through the real host;
    that accidental channel is tracked as objectui#7708, and this face neither
    declares nor promises it.)
  - Neither face declares `ChatbotSchema`'s six legacy members (`loading`,
    `showAvatars`, `userAvatar`, `assistantAvatar`, `markdown`, `height`) — no
    registration reads them by name — and neither redeclares `disabled`, which
    stays `BaseSchema`'s `boolean | string` (objectui#7087).
  
  **`ChatbotSchema` is unchanged.** It keeps `displayMode` and `floatingConfig`
  (declarations verbatim), and the floating face declares the same two, so
  `ChatbotSchema['displayMode']` and `ChatbotSchema['floatingConfig']` stay the
  typed members they were — the objectui#7669 `triggerIcon` tombstone keeps its
  reach on `chatbot` nodes, now pinned on the node. `floatingConfig`'s doc comment
  is rewritten on both faces: the old text said it was "only used when
  `displayMode` is `'floating'`", which was false — it is read by `chatbot-floating`
  alone and forwarded to the panel. `displayMode` is RULED RETIRED — objectui#7654,
  maintainer ruling B (2026-09-05): `?: never` tombstone, designer control and
  `defaultProps` seed removed, in that card's own change. This change carries the
  key untouched on both faces (still unmirrored, still read by nothing) so that PR
  finds the member exactly as ruled, and a tripwire test pins that any value still
  parses green until that PR flips it.
  
  **New published symbol:** `ChatbotSharedKey`, the string-literal union of the
  twenty keys all three registrations read. It is exported from `complex.ts`
  because an exported interface may not extend a `Pick` over a private name
  (TS4022), so it is emitted into `dist/complex.d.ts` and is reachable through the
  published `@object-ui/types/complex` subpath (it is not re-exported from the
  package entry). It is a census, not an authoring face.
  
  ## Zod twins, in lockstep
  
  `@object-ui/types/zod` gains `ChatbotEnhancedSchema` and `ChatbotFloatingSchema`
  (and `ComplexSchema` routes the two new discriminants). Every declared key is an
  arm except: the three runtime slots (`onError`, `onSend`, `onClear`), refused by
  name per objectui#6124; and, on the floating twin only, `floatingConfig` (no
  `FloatingChatbotConfig` mirror exists — minting one is objectui#6152's axis) and
  `displayMode` (unmirrored on `ChatbotSchema`'s twin too; retired by ruling on
  objectui#7654 and executed there). The twins mirror the API body params under the
  key the renderer reads, `requestBody`, and inherit `body` as the children slot —
  they do not copy `ChatbotSchema`'s `body` naming collision.
  
  **Accept-set change, stated plainly:** a `chatbot-enhanced` or `chatbot-floating`
  document parsed through the family's only twin used to fail on `type`; through
  its own twin it now parses, and the keys the twin declares are VALIDATED where
  they rode through `.passthrough()` unexamined before (`surface: 'frameless'`,
  `enableMarkdown: 'yes'` and `requestBody: 'x'` are refused). A `chatbot` node's
  parse outcome is unchanged: `ChatbotSchema`'s twin did not move.
  
  ## `@object-ui/plugin-chatbot`
  
  The `chatbot-enhanced` and `chatbot-floating` registrations type `schema` as the
  published faces and drop the anonymous intersections. One consequence:
  `chatbot-floating` used to write `disabled={schema.disabled}` and then spread
  `{...props}` AFTER it — and `SchemaRenderer` always includes `disabled: verdict
  || undefined` in those props, so the raw read was overridden on every render.
  With `disabled` honestly typed as `boolean | string` the raw union cannot be
  forwarded into the panel's `boolean` prop, so the registration now names the
  host verdict (`disabled: hostDisabled`) the way its two siblings have since
  objectui#4431. No render outcome moves; the pin renders through the real host
  both ways.
  
  This ships as `minor` for `@object-ui/types` because it widens the published
  surface with two new node types, two new Zod twins and one new type alias;
  `ChatbotSchema`'s own accept set does not move: objectui's major is pinned to `@objectstack`'s
  (`scripts/check-changeset-no-major.mjs`), and objectui's own contract changes
  ship as `minor` with the semantics spelled out — as above.
- 2af1fa7: **BREAKING** — the `'kanban'` validator arm now accepts the shape the registered
  renderer reads, and the six `DeclarativeKanban*` exports retire (objectui#7664,
  maintainer ruling (a), 2026-09-05).
  
  For an authored `type: 'kanban'` document two different types were
  authoritative depending on who asked. `safeValidateSchema` — what the CLI's
  `validate` / `check` commands apply — honoured `DeclarativeKanbanSchema`
  (`columns` with `color`, `draggable`, cards with `labels` / `assignees` /
  `priority`), while the renderer registered for the key, `ObjectKanbanRenderer`
  in `@object-ui/plugin-kanban`, consumed that package's own `KanbanSchema`
  (`objectName` / `groupBy` / `cardTitle` / `cardFields`, cards with `badges`).
  The two were unrelated dialects, so a board could pass `objectui validate` and
  render **empty**. The ruling: the plugin dialect is authoritative.
  
  **What changes on this package's published surface:**
  
  - **The `'kanban'` arm's accept set is replaced.** `ComplexSchema` →
    `AnyComponentSchema` → `safeValidateSchema` now validate the plugin dialect,
    declared here as `KanbanSchema` / `KanbanColumn` / `KanbanCard` /
    `CardTemplate` / `ColumnWidthConfig` (TypeScript) and `KanbanSchema` /
    `KanbanColumnSchema` / `KanbanCardSchema` / `CardTemplateSchema` /
    `ColumnWidthConfigSchema` (`@object-ui/types/zod`). An `objectName` /
    `groupBy` board passes. A static `columns[].cards[]` board passes — that
    spelling is the same document in both dialects and always rendered. A board
    in the retired dialect is **refused by name** at the keys that betray it: a
    board-level `draggable` and a column `color` are `?: never` tombstones on the
    TypeScript face and named refusal arms on the mirror, each message naming the
    retired `DeclarativeKanbanSchema` shape and the spelling to write instead.
    Both were measured inert (zero read sites in the plugin). The retired card
    keys are deliberately *not* refused: a card is an open record
    (`[key: string]: any`), and `priority` or `dueDate` are legitimate record
    fields.
  - **Every handler key the retired arm refused is still refused, and one more
    joins them.** The successor arm carries all five `#6124` refusal arms under
    the same `'kanban'` key — `onCardMove`, `onCardClick` and `onQuickAdd` as
    RUNTIME SLOTS (callable on the TypeScript face, refused by name on the
    mirror: `KanbanRenderer` forwards all three off `schema.*` in one block),
    `onColumnAdd` and `onCardAdd` as `?: never` tombstones. `onQuickAdd` is the
    one that is newly refused — the plugin dialect declared it, the retired
    declarative face did not. ⚠️ `onCardClick` is the key this arm must never
    drop rather than refuse: the plugin dialect it is modelled on never declared
    the member (the renderer read it undeclared), and because `BaseSchema` is
    `.passthrough()`, leaving it out does not refuse it — it stops being judged
    and the value is kept. Measured on the built dist, `{ type: 'kanban',
    columns: [], onCardClick: { action: 'toast' } }` is REFUSED, beside the same
    document at `onCardMove` / `onQuickAdd` / `onColumnAdd` / `draggable`.
  - **Six exports retire — the second step of the objectui#6172 rename.**
    objectui#6172 (PR #7643, same release line) renamed this package's trio from
    the bare names to `DeclarativeKanbanSchema` / `DeclarativeKanbanColumn` /
    `DeclarativeKanbanCard` and the three Zod mirrors to `DeclarativeKanban*Schema`
    so the bare names could belong to the renderer's dialect. objectui#6172's own
    stop condition was "if the renamed copy has no retained value, escalate", and
    the retained value it cited was precisely the validator arm. This ruling moves
    that arm to the plugin dialect, so the renamed copies have no consumer left
    and retire under ADR-0049 (enforce-or-remove): `DeclarativeKanbanSchema`,
    `DeclarativeKanbanColumn`, `DeclarativeKanbanCard` from `@object-ui/types` and
    `DeclarativeKanbanSchema`, `DeclarativeKanbanColumnSchema`,
    `DeclarativeKanbanCardSchema` from `@object-ui/types/zod` are gone.
    Importing any of them is a compile error (TS2305).
  - **`SchemaRegistry['kanban']` is `KanbanSchema`.** objectui#7645 (PR #7662)
    weakened the entry to `BaseSchema & { type: 'kanban' }` because this layer
    could not name the plugin's type; it now names the declaration the plugin
    itself imports. `keyof SchemaRegistry` — the published `ComponentType` union —
    is unchanged.
  - **The bare names return to this package with a different shape than they had
    before objectui#6172.** `KanbanSchema` here is now the plugin dialect, not the
    declarative one the pre-rename `KanbanSchema` was. A consumer that never
    migrated off the old bare name and expected `columns` to be required, or
    `draggable` to exist, gets a type error rather than a silent change.
  - `KanbanConditionalFormattingRuleSchema` is newly exported from
    `@object-ui/types/zod`: the rule union the `'object-kanban'` arm already
    applied, now shared with the `'kanban'` arm.
  
  **Migration.** Author boards in the plugin dialect — `objectName` + `groupBy`
  for an object-bound board, or `columns[].cards[]` with `badges` for a static
  one. Replace `DeclarativeKanbanSchema` imports with `KanbanSchema` (from
  `@object-ui/types`, or the Zod `KanbanSchema` from `@object-ui/types/zod`;
  `@object-ui/plugin-kanban` re-exports the same `KanbanSchema` type). Delete
  `draggable` (drag-and-drop is always on) and column `color` (style a lane
  through `className`). `content/docs/api/schema-reference.md`'s kanban section
  now documents this dialect.
  
  This is a breaking change shipped as `minor`: this repository's
  version-alignment rule keeps objectui's major pinned to `@objectstack`'s and
  ships objectui's own breaking changes as `minor` with the break spelled out in
  the changeset body, which is what the bullets above are.
- caf477f: `ChartDataSeriesSchema` (and its TS twin `ChartDataSeries`) now REFUSES `chartType` on a chart
  series BY NAME and points at `type` — the renderer-internal spelling the non-strict Zod object had
  been **stripping in silence** while `safeParse` reported success (objectui#7694, the `domain:ui` PM
  ruling on objectui#7546: option A, a named alias refusal, the posture `@objectstack/spec` already
  takes).
  
  ⚠️ Shipped as `minor`, not `patch`, because this is a NARROWING of a published accept surface, and
  it is named here in the words a release reader can act on:
  
  - **Before:** `series: [{ name: 'revenue', chartType: 'line' }]` validated green through
    `@object-ui/types/zod` (`safeValidateSchema`, `objectui check` / `objectui validate`, any
    pipeline that keeps `parse()`'s output) — and the key was gone from the output, so a consumer of
    the parse result drew that series in the chart's own family, precisely what the author was
    overriding. On the TypeScript face the key was merely an excess property on a fresh literal;
    a widened object carrying it assigned structurally.
  - **After:** the same document REFUSES at `series[i].chartType` (issue code `invalid_type`) with
    one message on both channels — the parse-time issue and the `.describe()` metadata:
    `Unrecognized key(s) on this chart series: \`chartType\`. Did you mean \`chartType\` → \`type\`? …`
    followed by the reason and the remedy. Write `type: 'bar' | 'line' | 'area'`. On the TypeScript
    face `ChartDataSeries.chartType` is a `?: never` tombstone, so both the fresh literal and the
    widened assignment are `tsc` errors.
  - **Both written** (`{ type: 'bar', chartType: 'line' }`) is refused at `chartType` alone — the
    key is not folded onto `type` and no precedence is minted between the two spellings.
  - **Which documents to scan.** The narrowing does not stop at `ChartDataSeriesSchema`; it reaches
    every document through the parents that embed it — `ChartSchema.series`
    (`zod/data-display.zod.ts:622`, `z.array(ChartDataSeriesSchema)`) and, one level further out,
    `ReportSectionSchema.chart` (`zod/reports.zod.ts:105`, `ChartSchema.optional()`). Authors meet it
    through `safeValidateSchema()` (`zod/index.zod.ts:434`, which parses `AnyComponentSchema`) and
    through the CLI's `objectui check` and `objectui validate` commands (`packages/cli/src/cli.ts:211`
    and `:223`). In practice: every `chart` node's `series[]`, and every report section whose `chart`
    carries one.
  
  This repository's `major` is a cross-repo pin to `@objectstack`'s major, not a severity dial; the
  break is announced here, which is the channel that carries it.
  
  ## Why a refusal, and not the two alternatives
  
  `chartType` is the renderer's INTERNAL spelling of `type`: the first limb of `normalizeSeries`'
  `str(raw.chartType) ?? str(raw.type)` (`@object-ui/plugin-charts`, `normalizeChartSchema.ts:244`),
  written by the internal-shape producers that hand `dataKey`-shaped arrays straight to
  `ChartRenderer` (`ObjectChart`, `DatasetWidget`; `core/utils/chart-presentation` translates authored
  `type` *into* it) and by nothing an author writes. Re-measured at implementation time, series-level,
  with lit controls (`dataKey` / `name` / `type` / `color`): docs 0, fixtures 0, designer inputs 0
  (the `chart` registration's `series` is one `code` input), src literals 0, tests 9 — every one an
  internal-shape array that never meets this mirror. Limb ablation over 304 files / 5817 tests:
  deleting `str(raw.chartType) ??` left all green; deleting the `?? str(raw.type)` sibling went 2 red.
  
  - **Not a fold onto `type`.** The renderer takes `chartType` FIRST, so a fold would let the alias
    overwrite the canonical key when both are written — the inversion of the objectui#7113 precedence
    rule (`xAxis` → `xAxisKey` folds *because* the reader already prefers the canonical key).
  - **Not a second writable name.** `@objectstack/spec`'s `ChartSeriesSchema` lists `chartType` in its
    alias map as a spelling of `type` and refuses it by name; declaring it here would mint a second
    de-facto contract against the spec's own posture (AGENTS.md #0.1).
  
  ## The primitive, and the JSON-Schema surface
  
  The new `aliasKeyRefusal()` helper (`zod/tombstone.zod.ts`, internal — not re-exported) reuses
  `retirementTombstone`'s primitive, `z.never({ error }).optional().describe()`, deliberately not
  `handlerKeyRefusal`'s `z.custom`: measured, `z.toJSONSchema` throws on a `z.custom` arm ("Custom
  types cannot be represented in JSON Schema") and represents a `z.never` arm as `{ not: {} }` with its
  description. `z.toJSONSchema(ChartDataSeriesSchema)` succeeded before this change and still does —
  it now lists `chartType` as a refused property carrying the guidance, 11 properties to 12.
  
  ⚠️ The two io modes are not affected alike, measured on this tree. In `io: 'input'` the emitted
  object carries no `additionalProperties` at all, so the accept set genuinely narrows there:
  `chartType` goes from unmentioned to a property that nothing satisfies. In `io: 'output'` — the
  default, and what a bare `z.toJSONSchema(…)` emits — the base **already** emitted
  `additionalProperties: false`, so the key was outside the accept set before this change; what that
  mode gains is the NAMED refusal and its guidance, not a narrower accept set.
  
  ## Unchanged, deliberately
  
  The object stays non-strict — a truly undeclared key is still stripped, exactly as
  `chart-inline-data-retired.test.ts` pins. The six keys objectui#7546 declared, the `data` tombstone
  (objectui#6896) and the at-least-one-binding refinement (objectui#6939 / #7113) are untouched.
  **No reader changed:** `normalizeSeries` still reads `chartType` first on the internal-shape arrays
  its producers hand it; that limb is a reader decision, not this declaration's.
  
  ## FROM → TO
  
  ```ts
  // ChartDataSeries
  + chartType?: never;   // alias of `type` — refused by name; write `type`
  ```
  
  Pinned in `packages/types/src/__tests__/chart-series-chart-type-alias-refusal-7694.test.ts` —
  the refusal envelope, both-written, the TS face, the spec's own posture measured live on the
  installed `@objectstack/spec`, and the JSON-Schema surface; `chart-series-keys-7546.test.ts` block
  (d) now pins the handoff from the gap that card reported.
- f6375da: Export `ComboboxOption` from the `@object-ui/types` root entry (objectui#7697).
  
  **Additive only.** `ComboboxOption` is added to the root barrel's existing named
  re-export list from `./form.js`, next to the sibling option types that were already
  there (`SelectOption`, `RadioOption`). Nothing is removed, retyped or narrowed: the
  declaration stays in `src/form.ts`, its three members (`value`, `label`, `disabled?`)
  are unchanged, and the `@object-ui/types/form` subpath spelling keeps working exactly
  as before. Both spellings now resolve to the same declaration.
  
  **Why it was missing.** objectui#7691 made this package the single authority for the
  name — `@object-ui/components` stopped declaring its own copy and now re-exports this
  one — but reached it through the `/form` subpath, because the root barrel was held by
  objectui#7683 at the time. That choice was deliberate and was judged sound on its own
  merits (the subpath is a house pattern, alongside `@object-ui/types/zod` and
  `@object-ui/types/internal/retired-field-keys`); this release is the follow-up
  objectui#7691 could not take, not a correction of it.
  
  **What changes for you.** `import type { ComboboxOption } from '@object-ui/types'` now
  compiles; on the previous release it read `TS2305` while its two siblings on the same
  list resolved. If you already import from `@object-ui/types/form`, or through
  `@object-ui/components`, nothing changes and no migration is needed — both remain
  supported and are pinned as such.
- a4611b3: Retire the six `ChatbotSchema` members no `plugin-chatbot` registration reads —
  `loading`, `showAvatars`, `userAvatar`, `assistantAvatar`, `markdown` and `height` — as
  ADR-0049 retirement tombstones on **both** published faces (objectui#7703).
  
  ⚠️ **BREAKING for anyone authoring one of these six against `ChatbotSchema`, on either
  face.** Ships as `minor` per the launch-window convention: objectui's `major` is a
  cross-repo pin to `@objectstack`'s so that "same major means compatible" holds across the
  two repos (`scripts/check-changeset-no-major.mjs`), and objectui's own breaking changes
  ship as `minor` with the break named where it lands — this entry is the channel that
  carries it.
  
  ## What was retired, and why
  
  The published type taught six knobs that did nothing. An author — or an AI author reading
  the `.d.ts` — wrote `showAvatars: true` or `height: 400` on a `chatbot` node, got no error
  on either face, and saw no change. Two of them advertised a `@default true` for a switch
  that did not exist.
  
  Re-measured on this branch's base (`21d7989fb`, i.e. **after** objectui#7708's fence
  landed as PR #8077) rather than inherited from the card: one `schema.KEY` count per
  `ComponentRegistry.register(...)` body of `packages/plugin-chatbot/src/renderer.tsx`, the
  file split at the three register calls.
  
  | key | declared type | `schema.KEY` reads (`chatbot` / `chatbot-enhanced` / `chatbot-floating`) |
  | :-- | :-- | :-- |
  | `loading` | `boolean` | 0 / 0 / 0 |
  | `showAvatars` | `boolean` (`@default true`) | 0 / 0 / 0 |
  | `userAvatar` | `string` | 0 / 0 / 0 |
  | `assistantAvatar` | `string` | 0 / 0 / 0 |
  | `markdown` | `boolean` (`@default true`) | 0 / 0 / 0 |
  | `height` | `string \| number` | 0 / 0 / 0 |
  
  Lit controls on the same instrument in the same pass: `placeholder` 1 / 1 / 1, `messages`
  1 / 1 / 1, `userAvatarUrl` 1 / 1 / 1, `maxHeight` 1 / 1 / 0, `floatingConfig` 0 / 0 / 1,
  `processVisibility` 0 / 1 / 0. The zeros are readings, not a blind grep.
  
  ⛔ `processVisibility` is **not** in this retirement — `chatbot-enhanced` reads it, and
  objectui#7655 left the `ChatbotSchema` member as it was. It is pinned live as a control.
  
  ### `showAvatars` is the one key the FENCE turned dark, not a key nothing ever read
  
  The distinction is recorded rather than smoothed over, because the two provenances are
  different facts. `ChatbotEnhanced` really does have a `showAvatars` prop, and until
  objectui#7708 the `chatbot-floating` registration ended its panel element with a raw
  `{...props}` spread that handed an authored value straight to it — measured live through
  the real host. That card was ruled **fence**, not declare, and landed as PR #8077: the
  spread is filtered through `toDomProps` and moved ahead of every named prop. So the key is
  dark on all three registrations **by ruling**, and this retirement records that, not an
  absence. The other five were live on no channel at any time — they are not
  `ChatbotEnhancedProps` members either (`markdown` exists there only as `enableMarkdown`),
  so the spread had nothing to land them on.
  
  ## Enforce-or-remove, decided per key
  
  The other arm was taken key by key and refused each time. `<Chatbot>`
  (`plugin-chatbot/src/index.tsx`) — the component the `chatbot` registration renders —
  declares `messages`, `placeholder`, `onSendMessage`, `disabled`, `showTimestamp`,
  `userAvatarUrl`, `userAvatarFallback`, `assistantAvatarUrl`, `assistantAvatarFallback` and
  `maxHeight`, and **not one of the six**.
  
  | key | why not enforce | migration |
  | :-- | :-- | :-- |
  | `loading` | Chat progress is runtime state the chat runtime owns — the registration derives it from `useObjectChat` as `isLoading`. A static authored boolean would fight the runtime, not configure it | delete the key |
  | `showAvatars` | No target on `<Chatbot>`. Declaring it on the two faces that DO reach `<ChatbotEnhanced>` would re-open by declaration the channel objectui#7708 closed by fence, one card earlier | delete the key — a `chatbot` node already renders an avatar beside every message |
  | `userAvatar` | A second authorable spelling of an image `userAvatarUrl` already carries (AGENTS.md #0.1: one strict contract, not N dialects) | `userAvatarUrl` (+ `userAvatarFallback`) |
  | `assistantAvatar` | Same | `assistantAvatarUrl` (+ `assistantAvatarFallback`) |
  | `markdown` | `<Chatbot>` prints message content as text and has no markdown path; on the two nodes that render markdown, `enableMarkdown` is the live key | `type: 'chatbot-enhanced'` with `enableMarkdown` |
  | `height` | `<Chatbot>` has no `height` prop, and the live `maxHeight` it forwards is a `string`, not this key's `string \| number` union | `maxHeight`, or `floatingConfig.panelHeight` on a floating node |
  
  ## FROM → TO
  
  Each member goes to `?: never` on `packages/types/src/complex.ts` and to
  `retirementTombstone(...)` on `packages/types/src/zod/complex.zod.ts` — both halves, in
  lockstep, the convention `MarkdownSchema.sanitize` (objectui#6972),
  `TimelineSchema.timeScale` (objectui#6355) and `ObjectViewSchema.viewTabBar`
  (objectui#7779) already carry. Each refusal names the key, says why it is retired, and
  points at what to write instead; one string feeds both the parse-time message and the
  `.describe()` metadata, so the two cannot drift.
  
  ## Accept-set change, one line per face
  
  - **TypeScript.** A write of any of the six against `ChatbotSchema` used to compile and
    now does not — including through a widened (non-fresh) value, which is the half a
    deletion would have missed on a `BaseSchema` carrier.
  - **Runtime (Zod / `safeValidateSchema`).** A `chatbot` document authoring one of the six
    used to parse **green** and now parses **red**, `invalid_type` at the key's own path
    with the guidance as the message. This is the narrowing that carries
    `needs:contract-review`.
  - **`chatbot-enhanced` / `chatbot-floating`.** Unchanged in both directions. Those faces
    never declared the six (objectui#7655 censused them out), their twins have no arm to
    refuse one, and `BaseSchema` is `.passthrough()` — so a stored node of either type
    carrying a retired key parses exactly as it did. Pinned.
  
  ## Why tombstones and not deletions
  
  All six **have** a Zod arm, and that is what decides the route here. `BaseSchema` is
  `.passthrough()` on the Zod side and carries a `[key: string]: any` index signature on the
  TS side, so an UNDECLARED key is not refused — it is KEPT. Deleting the members would hand
  the authored spelling exactly the silent no-op this card exists to close, on both faces at
  once. The two-prong discriminator (`mobile.ts`, objectui#5941 / #7526 / #7678) leaves that
  structural hazard to the carrier: where there is no mirror there is "no silent-strip hazard
  for prong 2 to guard". Here there is a mirror to host the refusal, and prong 1 holds by the
  letter for four of the six. The "deleted" row is pinned live as a control in
  `packages/types/src/__tests__/chatbot-dark-keys-retired-7703.test.ts`, so the contrast
  cannot rot into prose.
  
  ## Docs
  
  `content/docs/plugins/plugin-chatbot.mdx` gains the restatement of the six removed keys
  with their replacements (objectui#7070: a control is restated, never deleted into a
  vacuum), and its three present-tense claims that the `chatbot-floating` props spread is
  still unfiltered are corrected to what PR #8077 actually left behind.
- 20316ba: `SchemaRegistry` names all three `plugin-chatbot` registrations, so the published
  `ComponentType` union does too (objectui#7704).
  
  `packages/plugin-chatbot/src/renderer.tsx` registers three components — `chatbot`,
  `chatbot-enhanced` and `chatbot-floating` — and `SchemaRegistry` mapped one of them.
  Since `ComponentType = keyof SchemaRegistry` is the published union, a consumer
  discriminating on it was told two registered keys do not exist: an author narrowing a
  node by `ComponentType`, or writing a `Record<ComponentType, …>` table, had no arm for
  either. The asymmetry that showed which half was wrong is that
  `packages/cli/src/utils/known-schema-types.ts` keeps its own parallel list containing
  both keys, precisely because this map did not.
  
  **Additive.** Two keys join the map under its `// Complex` group; no existing entry
  changes, `'chatbot'` still maps to `ChatbotSchema`, and nothing is removed. The union
  widens, which cannot break a consumer that produces `ComponentType` values and can only
  help one that consumes them — except an exhaustive `Record<ComponentType, …>` or
  `switch`, which now needs the two new arms. Nothing in this repo has one: the only
  consumer of `ComponentType` outside its own declaration is a pin test.
  
  **Why the entries can be honest now.** This map's value has to be the type the
  registered renderer honours, and until objectui#7655 there was none to point at —
  `ChatbotSchema` pins `type` to `'chatbot'`, and each registration's real key set lived
  in an anonymous `ChatbotSchema & { … }` intersection local to the renderer file.
  objectui#7655 published `ChatbotEnhancedSchema` and `ChatbotFloatingSchema` from this
  package, and both registrations already take them as their `schema` parameter, so the
  map's value and the renderer's prop type are one declaration — the same property the
  `'kanban'` arm gained in objectui#7664. Being declared here also makes them reachable:
  `@object-ui/types` has zero workspace dependencies, which is exactly what blocked the
  `kanban` case objectui#7645 measured, where the honoured type lived in a plugin.
  
  Pinned in `src/__tests__/schema-registry-chatbot-keys-7704.test.ts` in two channels —
  compile-time (`tsc -p tsconfig.test.json`: the keys survive in `keyof`, each value is
  the face its renderer honours, and each value's own `type` literal is its key) and
  runtime (a TypeScript-AST census of the interface source, plus each key selecting its
  own arm through `safeValidateSchema`).
  
  Scope: these two keys, whose authoring faces now exist — not a sweep of the map's other
  entries, which objectui#7665 holds.
- d3499b3: `chatbot-floating` now fences its `<FloatingChatbot>` spread the same way its
  two sibling registrations (`chatbot`, `chatbot-enhanced`) already do —
  `{...toDomProps(props)}`, at the head of the element, instead of a raw
  `{...props}` spread at the end (objectui#7708). This is a deliberate,
  user-visible behavior change, not a refactor:
  
  - **A message sent through a floating chatbot now actually renders.**
    Previously the authored `messages` seed (whatever array was on the node
    when it was authored) silently overrode the live runtime messages on every
    render, because the raw spread landed AFTER `messages={runtimeMessages}`.
    Neither the user's own message nor an `autoResponse` reply ever appeared —
    the identical send on `chatbot-enhanced` worked correctly. Fixed.
  - **`displayMode`, `systemPrompt` and `model` stop leaking as DOM attributes**
    on the panel's root element (`systemPrompt` / `model` are still read
    normally, by name, for the request they configure — only the second,
    unfiltered forward is gone). Closes objectui#4425's leak class on the one
    `plugin-chatbot` registration that had not closed it yet.
  - **Three undeclared keys go dark on `chatbot-floating` nodes:**
    `processVisibility`, `surface` and `showAvatars` reached the panel's
    `ChatbotEnhanced` through the raw spread even though `ChatbotFloatingSchema`
    never declared them. `ChatbotFloatingSchema` documents this explicitly and
    always has — the face never promised these keys — so this closes an
    accidental channel rather than removing declared behavior. A document that
    relied on any of the three to affect a floating node loses that effect;
    author them on a `chatbot-enhanced` node instead, where they are part of
    the declared, tested contract.
  
  `@object-ui/types`: `ChatbotFloatingSchema`'s doc comment is updated to match
  — no type-shape change, so nothing that imports the type needs to change.
- 18897a4: Declare `wrapperClass` on `SwitchSchema`, `TextareaSchema`, `DatePickerSchema`,
  `SelectSchema` and `ListSchema`, on both faces (objectui#7722 — the read-driven
  residue outside objectui#6938's batch, one key over five more types).
  
  Each of `renderers/form/switch.tsx`, `textarea.tsx`, `date-picker.tsx`,
  `select.tsx` and `renderers/data-display/list.tsx` reads `schema.wrapperClass`
  onto its wrapper element, and neither the TypeScript interface (`form.ts`,
  `data-display.ts`) nor the zod mirror (`zod/form.zod.ts`,
  `zod/data-display.zod.ts`) declared the key. The reads compiled through
  `BaseSchema`'s index signature (objectui#5155) and the values parsed through
  `.passthrough()`, admitted unexamined. The same key, on the same class of read,
  is declared on `CheckboxSchema` (objectui#6938), `FileUploadSchema` and
  `FilterBuilderSchema` (objectui#6150); these five were left out only because
  their doc pages never listed it.
  
  **minor, not patch — the published face gains five members.** objectui#6938 and
  objectui#7295 graded a one- or two-key residue `patch` because "the accept set
  only widens toward what already renders"; that reasoning still describes the
  VALUE dimension here, but this change is the batch shape of objectui#6150
  (`minor`), and it is dispatched under the contract-review tier precisely because
  it widens the PUBLISHED surface: five schemas each gain a member of the shipped
  `.d.ts` and of the mirror's `.shape` that an editor completes, an annotation
  checks and a validator enforces. Two verdicts move, in opposite directions:
  
  - **Nothing well-typed stops validating or compiling.** Key membership was never
    narrow: `[key: string]: any` admitted the key on the TS face and
    `.passthrough()` admitted it on the zod face, so every document that carried a
    string `wrapperClass` parsed green before and parses green now, with the value
    surviving the parse exactly as before.
  - **A non-string `wrapperClass` is now REFUSED at the key** on these five mirrors
    (`{ type: 'switch', wrapperClass: 42 }` parsed green before; it is refused now,
    at `wrapperClass`). That is enforcement of the declared type, not a new
    capability, but it is a behaviour change for a document that carried a
    wrong-typed value under one of these five names — a value the renderer would
    have interpolated into the class string as text.
  
  Keys outside the five are untouched: an undeclared key of any type is still
  admitted unexamined on all five mirrors, pinned per mirror with a control key
  the renderer does not read. `InputSchema.wrapperClass`, declared on the TS face
  only, is a recorded row of the parity ledger (`UnmirroredDeclared`) and stays
  there; the new sweep pin carries it as a self-expiring exemption.
- 8b7ea39: The zod mirrors stop authoring defaults; the renderer's fallback is the one
  authoritative default (objectui#7735, director ruling, decision batch #69,
  2026-09-07 — maintainer reply 「其他同意」).
  
  **A validator validates; it does not write values into an author's document.**
  `.default(v)` on a mirror member is not documentation — `parse` SUBSTITUTES `v`
  into the output when the key is absent. One authored document therefore had two
  shapes depending on whether it had been through `safeValidateSchema`, and where
  the mirror and the renderer disagreed the mirror silently won:
  
  | key | mirror wrote | the renderer applies |
  |---|---|---|
  | `ContainerSchema.maxWidth` | `'lg'` | `container.tsx`: `?? 'xl'` |
  | `FlexSchema.align` | `'center'` | `flex.tsx`: `\|\| 'start'` |
  
  A `container` omitting `maxWidth` rendered `max-w-xl` as authored and `max-w-lg`
  after a round-trip through the mirror; `'center'` is a value neither `flex` nor
  `stack` applies at all. `StackSchema` already declared no defaults, so the file
  was not even self-consistent.
  
  **What changed.** All 41 `.default()` call sites under `packages/types/src/zod/`
  are removed — `layout.zod.ts` 22, `crud.zod.ts` 11, `form.zod.ts` 5,
  `views.zod.ts` 2, `app.zod.ts` 1. `@object-ui/components` reconciles the third
  face objectui#8229 found: `flex`'s registration `defaultProps.align` seeded
  `'center'`, the value its own renderer never applies, so a designer-made node
  laid out differently from a hand-authored one; it now seeds `'start'`.
  
  **Accept set unchanged.** Every one of the 41 was spelled
  `<type>.optional().default(v)`, so none was carrying optionality: nothing that
  parsed before is refused now, and nothing refused before is accepted. This is a
  narrowing of `parse` OUTPUT only.
  
  **⚠️ Breaking for consumers that read `result.data`.** `validateSchema` /
  `safeValidateSchema` no longer substitute: for a document that OMITS one of these
  keys the key is now ABSENT from the parsed output instead of carrying a value the
  document never authored. Every one of the 41 keys changes output this way. If you
  read a default off the parsed document rather than applying your own fallback,
  apply the fallback yourself.
  
  **And rendering changes too, wherever the mirror's value differed from the
  renderer's.** An earlier draft of this note said rendering does not change on the
  ground that "the two keys that disagreed were the bug"; that was the triage
  sample of 7 keys, not a measurement of the population. Auditing all 22 layout
  keys against their renderers finds **six** disagreements, not two:
  
  | key | the mirror wrote | what the renderer applies when the key is absent |
  |---|---|---|
  | `container.maxWidth` | `'lg'` | `container.tsx`: `?? 'xl'` |
  | `flex.align` | `'center'` | `flex.tsx`: `\|\| 'start'` |
  | `grid.columns` | `3` | `grid.tsx`: `let baseCols = 2` |
  | `text.variant` | `'body'` | `text.tsx`: none — a bare node, no typography class (objectui#6942) |
  | `resizable.withHandle` | `true` | forwarded bare; `undefined` draws NO grip |
  | `page.template` | `'default'` | `page.tsx`: a null template falls through to the `pageType` dispatch |
  
  So a consumer that renders `result.data` sees a different result on all six. What
  does NOT change is rendering inside this repository: the render path never ran
  this validator at all — `SchemaRenderer` calls the STRUCTURAL `validateSchema`
  from `@object-ui/core`, which returns `{valid, errors}` and hands the renderer
  the author's own object. The four modules that do import `@object-ui/types/zod`
  were censused: two read only `result.success`, one discards `result.data`, and
  `os validate` reads only `type` / `id` / `label` / `title` / `children`, none of
  which ever carried a default. The four JSDoc `@default` tags that described the
  mirror rather than the renderer (`grid.columns`, `text.variant`,
  `resizable.withHandle`, `page.template`) are corrected in the same change.
  
  Note that `safeValidateSchema` still substitutes through subschemas imported by
  reference from `@objectstack/spec` (`app.active`, `object-view.navigation.*`,
  `list-view.sharing.type`, and others). Those values are written in that package,
  not this one, and are unaffected by this change.
- 64a252d: **`CollapsibleSchema.trigger` now declares the node array its Zod mirror, its runtime and its own shipped default already accept** (objectui#7767).
  
  `trigger` on `CollapsibleSchema` widens from `string | SchemaNode` to `SchemaNode | SchemaNode[]` on the TypeScript face, and stays required. The dropped `string |` half was redundant rather than an extra: `SchemaNode` is `BaseSchema | string | number | boolean | null | undefined`, so `string | SchemaNode` already denoted exactly `SchemaNode` — a bare string trigger type-checks before and after. `SchemaNode` itself is unchanged.
  
  This is a **widening**, not a replacement: every singular `trigger` keeps type-checking unchanged. The Zod mirror is untouched — `zod/disclosure.zod.ts` already spelled this key `z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)])` — and so is the runtime: `renderers/disclosure/collapsible.tsx` hands `schema.trigger` to `renderChildren`, whose `Array.isArray` branch has served the array form all along, and that same registration's `defaultProps.trigger` ships as an array. What changes is that the TypeScript face stops under-reporting an accept set that already ships: copying the renderer's own default into a typed document is no longer a type error against the type that shipped it. The docs page's `trigger` row follows the declaration.
  
  This is the eighth member of the change objectui#7081 made to the overlay family, carried out under the same ruling (2026-09-03 on that card): the validator's accept set does not move, so this is a declaration catching up with what ships rather than a new capability. Per this repository's version-alignment convention, a widening of a published type surface ships as `minor` with the semantics spelled out here rather than as `major` (see AGENTS.md, "版本号策略").
- c842594: `DashboardComponentSchema.widgets` gains the component-node arm on the TypeScript face (objectui#7952)
  
  `widgets` was `DashboardWidgetSchema[]` in TypeScript while the zod schema it mirrors has been a two-arm union since the 2026-08-14 ruling (objectstack#8593): a component node placed directly in the widget slot (`type: 'metric-card'`, body validated as passthrough `BaseSchema`) or a spec-family widget. So the shape `@object-ui/plugin-dashboard`'s README teaches in every `metric-card` example — and the shape the shipped `DashboardRenderer` renders — parsed green under `safeParse` and was refused by `tsc --strict` (`TS2561: 'value' does not exist in type 'DashboardWidgetSchema'`, six occurrences across the README's dashboard blocks at `fc32921`). There was no annotation an author could write for a document the platform accepts.
  
  **Accept-set change (Clause ②, TypeScript face only).** `widgets` is now `Array<DashboardWidgetSlotComponentSchema | DashboardWidgetSchema>`, and `DashboardWidgetSlotComponentSchema` — `BaseSchema` with `type` narrowed to the closed `DASHBOARD_COMPONENT_WIDGET_TYPES` — is a new export of `@object-ui/types`. The zod schema is unchanged; `DashboardWidgetSchema` is NOT widened with `value` / `icon` / `trend` / `trendValue` (those are `MetricCard`'s registry inputs, not widget keys — the compiler's `Did you mean to write 'values'?` points at the repair both declarations forbid).
  
  **What still refuses.** A widget that names a spec-family `type` and carries an undeclared key (`{ type: 'bar', bogus: 1 }`) is still a `tsc` error: the literal is discriminated by `type`, so the passthrough arm never applies to it. A `type` outside both vocabularies is refused as before. The one corner the TypeScript union cannot discriminate — a legacy `component` envelope with NO `type` plus an undeclared key — compiles on the TypeScript face and is refused by name at validation, as every `BaseSchema` slot already behaves.
  
  **Consumers.** The new arm is assignable to `DashboardWidgetSchema`, so code that annotates a widget callback `(w: DashboardWidgetSchema)` keeps compiling unchanged. Code that reads a property off an unannotated element of `schema.widgets` now sees the union, and through `BaseSchema`'s index signature that read is `any` rather than the widget's declared type — annotate the parameter to keep the narrower type.
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
- 6bca0e4: **Breaking for authored metadata:** the legacy `ActionSchema`'s Phase-2 callback
  pair — `onSuccess` / `onFailure`, each carrying an `ActionCallback` object — is
  RETIRED, and the `ActionCallback` type and its Zod mirror `ActionCallbackSchema`
  (with the inferred `ActionCallbackSchemaType`) are DELETED from `@object-ui/types`
  and `@object-ui/types/zod` (objectui#7068; maintainer ruling option 1 of
  2026-09-05, immediate, no deprecation window; ADR-0049 enforce-or-remove).
  
  **What an author who wrote the shape sees now.** A `{ type: 'action', … }`
  document authoring `onSuccess: { type: 'toast', message: '…' }` (or any
  `onFailure` callback) no longer validates: the parse fails loudly on the
  `onSuccess` / `onFailure` path (`invalid_type`, expected `never`) with the
  explanation and the migration in the message, and the TypeScript members are
  `?: never` tombstones so the same document is a `tsc` error at the authoring
  site. `import type { ActionCallback } from '@object-ui/types'` and
  `import { ActionCallbackSchema } from '@object-ui/types/zod'` fail to resolve.
  
  **What was measured, on this branch's base (`900f8d99`).** `ActionCallback`
  (`{ type: 'toast' | 'message' | 'redirect' | 'reload' | 'custom' | 'ajax' |
  'dialog', message?, url?, api?, method?, dialog?, handler? }`) was declared in
  `crud.ts`, mirrored in `zod/crud.zod.ts`, re-exported by both barrels, and
  carried on the legacy `ActionSchema` as `onSuccess?` / `onFailure?`. Producers:
  the package's own `phase2-schemas.test.ts` fixture and three `ts` fences in
  `content/docs/core/enhanced-actions.mdx` — nothing else (`git grep -l
  ActionCallback` over `packages content skills` hit the five `packages/types`
  files; positive control `SchemaNodeSchema` hit 22). Runtime readers: none —
  `ActionRunner` imports `UIActionSchema`, never this interface, and its own
  `ActionDef.onFailure` is a different (runner-native) meaning. It was the THIRD
  meaning of one key: objectui#5934 had already retired the runner's callback
  meaning of `onSuccess` and converged it on the spec's block.
  
  **Why authored JSON that passed publish is unaffected.** `@objectstack/spec`'s
  `ActionSchema` (installed pin 17.2.0) already refused the callback shape at
  publish — `invalid_type` at `onSuccess.navigate` plus `unrecognized_keys` on the
  `onSuccess` block, and `onFailure` refused as an unrecognized key on the action —
  so no published or saved metadata could carry it. Only TypeScript code that
  typed a callback against the legacy interface, or JSON validated solely through
  `@object-ui/types/zod`, meets the new refusal.
  
  **Where the live meaning lives.** Post-success navigation is the spec's
  `onSuccess` block, `{ navigate, openIn }`, declared on `UIActionSchema`
  (`ui-action.ts`) and forwarded to the runner (objectui#5934). A success or
  failure notice is `successMessage` / `errorMessage` — adjacent keys on the same
  legacy `ActionSchema`, NOT retired, and still accepted on both faces.
  
  **Two published faces, one retirement — tombstone on the keys, deletion of the
  type.** `BaseSchema` is `.passthrough()` on the mirror and carries an index
  signature on the interface, so DELETING the two keys would have ADMITTED an
  authored callback unchecked on both faces; they stay declared as `?: never` /
  `retirementTombstone()` (the PR #7761 / #7769 shape) and the base-vs-extended
  contrast is pinned. The standalone `ActionCallback` / `ActionCallbackSchema` have
  no such escape hatch and are deleted outright, the route objectui#7664 / PR #7743
  took for the `DeclarativeKanban*` trio; the parity ledger drops the pair
  (`EXPECTED_MIRROR_PAIRS` 159 → 158) and the absence is pinned in
  `action-callback-retired-7068.test.ts`.
  
  **Docs, same change.** `content/docs/core/enhanced-actions.mdx` — the three
  `onSuccess` / `onFailure` fences author `successMessage` / `errorMessage`
  instead, and the "Callbacks" section is a "Post-success behaviour" note pointing
  at the spec block (no fence: the legacy type carries no spec-derived block).
  `content/docs/guide/schema-overview.md` — the fragment line, the feature bullet
  and the checklist row are rewritten to the truth (the ✅ claim is now a
  retirement note).
  
  **Migration:** delete `onSuccess` / `onFailure` from any legacy `ActionSchema`
  document or fixture; write `successMessage` / `errorMessage` for notices, put
  follow-up work in `chain`, and author post-success navigation as the spec's
  `onSuccess: { navigate, openIn }` block on `UIActionSchema`.
  
  Graded `minor`, not `patch`: this narrows the accepted input set on both faces
  and removes two exports, which is breaking for any consumer who wrote the shape.
  It is not `major` per this repo's fixed-group convention (objectui's own breaking
  changes ship as `minor`; the group's major tracks `@objectstack` — AGENTS.md
  版本号策略, mechanically enforced by `scripts/check-changeset-no-major.mjs`).
- 2fcefb9: **`AppComponentSchema.hidden` is now declared `boolean` — the spec's app-catalogue flag — instead of the `boolean | ExpressionWire` hide predicate it inherited from `BaseSchema`.** On the `app` node two keys collide in name and differ in meaning (objectui#7542): the zod mirror takes `@objectstack/spec/ui` `AppSchema.hidden` ("Hide from the App Switcher") by reference through `SpecAppFields`, where the spec's `z.boolean().optional()` lands after the base's key and overrides it, so the validator has always refused a predicate string or a CEL envelope object at path `hidden` on an `app` document — through `AppComponentSchema.safeParse` and through `safeValidateSchema` alike — while the published TypeScript interface, restating nothing, invited exactly that spelling. This is direction 1 of the card: the declaration is pulled back to what the validator enforces. Direction 2 — giving the catalogue flag its own name upstream in `@objectstack/spec` so the app node can inherit the renderer's predicate again — stays open as the alternative and is a protocol change, not taken here.
  
  Breaking on the TypeScript face only: a predicate string or envelope on an `app` node no longer type-checks, and an `app` node cannot use the predicate spelling every other node accepts. Authored JSON metadata is unaffected — the validator never admitted it — and the in-repo reader (`filterActiveApps` in `@object-ui/app-shell`) already treats the key as the boolean `hidden !== true`, never evaluating it. The renderer's `hidden` predicate on every other node is unchanged, `BaseSchema.hidden` is untouched, and the `KnownDrift` row objectui#7455 seeded for this pair is removed because the drift it recorded is gone.
- b55a346: `'agenda'` leaves `CalendarViewMode` and the zod `CalendarViewModeSchema`
  (objectui#5740 — the value-level residue of objectui#5667's key-level
  convergence of `CalendarViewSchema` on the registered `calendar-view`
  renderer's measured read set; ADR-0049 enforce-or-remove).
  
  The union declared a value nothing enforced: the registered renderer's `view`
  input declares `enum: ['month','week','day']`, `resolveAuthoredView` resolves
  any off-enum value — `'agenda'` included — to `undefined` (the component's
  `'month'` default), and `CalendarView` renders no agenda view. An author
  writing the type-legal, zod-valid `view: 'agenda'` got a month calendar with
  no error or warning. No in-repo, example, or catalog app authors
  `view: 'agenda'` (measured during objectui#5667's sweep and re-measured for
  this change, including the objectstack tree).
  
  **This narrows the accept set — unlike #5667's key retirements, which created
  no new rejections.** `view` is a declared key, and declared keys are validated
  even under `.passthrough()`, so `view: 'agenda'` is now a **validation error
  that previously parsed green** (an `invalid_value` issue on the `view` path,
  offering `month`/`week`/`day`). Undeclared keys still pass through unchanged.
  Breaking on the published zod surface; ships as `minor` per this repo's
  version-alignment policy (majors track `@objectstack`).
  
  The runtime boundary is unchanged: an off-union `view` in raw metadata still
  falls back to the component's `'month'` default at the renderer, and the
  registry input already declared the three-value enum. Docblocks, the schema
  reference table, and the zod `describe` no longer teach an `'agenda'`
  fallback.
- 065bba7: `CalendarViewSchema` (TS interface and zod mirror) converges on the registered
  `calendar-view` renderer's measured read set (objectui#5667, maintainer ruling
  option A — the renderer is authoritative).
  
  **Breaking for consumers of the published type** (deliberate; per-repo policy
  breaking changes ship as `minor` — the fixed group's `major` tracks
  `@objectstack`):
  
  - Nine inert keys are retired: `events` (the interface's only required key,
    which the renderer deliberately drops — objectui#4433), `defaultView`,
    `defaultDate`, `date`, `views`, `editable`, `onEventCreate`,
    `onEventUpdate`, `onDateChange`. None had a read site on the authored-node
    path and no measured app authors them (ADR-0049 enforce-or-remove).
  - The type now declares what the renderer actually reads: `data`, `titleField`,
    `startDateField`, `endDateField`, `allDayField`, `colorField`, `view`,
    `currentDate`, `allowCreate`, `className`, plus the two host-only function
    hatches it forwards (`onEventClick`, `onViewChange`).
  - Practical radius, measured: `BaseSchema` carries an index signature and the
    zod `BaseSchema` is `.passthrough()`, so nodes still authoring retired keys
    neither fail to compile nor get rejected at validation — they are simply no
    longer declared, documented, or type-checked. The material accept change is
    that zod no longer **requires** `events`: a `{ "type": "calendar-view" }`
    node without it now validates (previously the one key validation demanded
    was the one key guaranteed to do nothing).
  
  Runtime renderer behaviour is unchanged. `@object-ui/plugin-calendar`'s README
  and `content/docs/api/schema-reference.md` are repaired to the converged
  surface in the same change, so no copy of the old contradiction survives.
- 6d1c155: `ComponentMeta` is now declared once and re-exported, and `PluginComponentMeta` is
  deprecated in favour of `ComponentMeta` (objectui#5893).
  
  ## The convergence
  
  `@object-ui/types` published `ComponentMeta` twice, from two different declarations:
  `base.ts` and `plugin-scope.ts` (the latter published as `PluginComponentMeta`). They
  were structural copies, not an alias pair. `plugin-scope.ts`' `ComponentMeta` is now
  `export type { ComponentMeta } from './base.js'` — the disposition objectui#4580 ruled
  for the identical shape, *a structural copy would reproduce the defect the moment either
  side moved*, and the same move objectui#5671 made for the sibling type `ComponentInput`
  in the same file.
  
  Either side had already moved. `base.ts` declared eleven keys; the plugin-scoped copy
  declared nine — the same nine, **minus `tags` and `description`**. So a plugin author
  typing against the plugin-facing declaration could not write two keys the main surface
  advertises, and which the runtime validator already accepted: `ComponentMetaSchema` in
  `zod/base.zod.ts` declares all eleven, so two of the three authorities agreed and the
  plugin-facing one did not. `resizeConstraints`' six members were identical in both, so
  the delta was exactly those two keys.
  
  What changes for a consumer: `tags` and `description` become writable on the
  plugin-facing type. Nothing narrows — no key is removed and no key's type changes, so no
  existing registration stops compiling. The convergence buys **acceptance** of two keys;
  it buys no rejection of anything. `ComponentMetaSchema` is a plain `z.object` with no
  `.strict()`, so it strips unknown keys rather than refusing them, and that is unchanged
  here.
  
  ## The alias deprecation, sequenced after it
  
  `PluginComponentMeta` — the published alias for the plugin-scoped declaration — is now
  `@deprecated` in favour of `ComponentMeta`. **`PluginComponentMeta` is the name to search
  for** if you import it; replace it with `ComponentMeta` from the same entry point.
  
  This is stage 1 of objectui#5674's two-stage retirement (maintainer ruling, 2026-08-22:
  deprecate for a release, then remove). Nothing is removed here — the export still exists
  and still names the same type.
  
  The ordering is deliberate and is why the two halves ship together. Until the convergence
  above, the alias named a genuinely different nine-key interface; deprecating it then
  would have warned consumers about a name that was still about to change meaning. It is
  deprecated now, at its final meaning.
  
  **Why a deprecation window rather than a deletion.** The measurement that licenses
  deleting an export from a published package is *"no importer"*, and what can be measured
  from inside this repository is only *"no importer here"*. In-repo, `PluginComponentMeta`
  has exactly one occurrence — its own export line — searched across every root
  (`packages/`, `apps/`, `content/`, `docs/`, `skills/`, `examples/`, `e2e/`, `scripts/`,
  `eslint-rules/`, `public/`, `.changeset/` and the root docs) plus the sibling
  `objectstack` framework checkout, with controls searched identically so a broken search
  could not read as a clean one. What no search here can see is a consumer on npm. **That
  external caveat is unchanged from objectui#5674 and is not being dropped:** the window
  converts a silent break into a warned one before stage 2 lands. Stage 2 removes the alias
  and the now-dead re-export in `plugin-scope.ts` that exists only to feed it, and ships as
  a `minor` under this repo's policy that its own breaking changes never declare `major`.
  
  ## Pinned by identity, not by member set
  
  A new test asserts that `plugin-scope.ts` re-exports the declaration and declares no
  `ComponentMeta` of its own. A member-set assertion cannot do this job: TypeScript is
  structurally typed, so a local re-declaration carrying the same eleven keys is mutually
  assignable with the imported one and passes every type-level check. A member-identical
  structural copy is exactly what objectui#4580 predicted would drift and exactly the state
  this card recorded — this copy started identical and acquired its two-key delta later.
  The member-set checks are kept alongside the identity pin, labelled as the control that
  shows what it cannot see.
- d7573b3: `ComponentInput` is now declared once and re-exported, instead of restated in three
  places (objectui#4972).
  
  `@object-ui/core`'s `ComponentInput` (`registry/Registry.ts`) and `@object-ui/types`'
  plugin-scoped `ComponentInput` (`plugin-scope.ts`, published as `PluginComponentInput`)
  were structural copies of the interface in `@object-ui/types`' `base.ts`. Both are now
  re-exports of that one declaration, which is the disposition objectui#4580 ruled for the
  identical shape — *a structural copy would reproduce the defect the moment either side
  moved* — and the way `core/src/types/index.ts` already handles `SchemaNode`.
  
  Either side had already moved. `base.ts` declared thirteen keys; both copies declared
  nine, so `min` / `max` / `step` / `placeholder` were missing from **the copy every
  component registration actually imports**. Those four keys were unwritable at any real
  registration — a plain TypeScript error at the call site — while `ComponentInputSchema`
  (the zod schema) and `ComponentMeta.inputs` both accepted them. The publication face
  advertised four keys the authoring face rejected. Measured over the repository, no
  registration had tried to write one yet, so nothing a user hits was broken today; what
  changes is that the four keys become writable, and there is no longer a second
  declaration for the next widening to miss.
  
  `ComponentInput`'s arm vocabulary (`ComponentInputControlType`) was already a single
  declaration imported by all three sites (objectui#3832); this converges the rest of the
  interface.
  
  Measured, not assumed: `@object-ui/core`'s published entry `dist/index.d.ts` is
  byte-identical across the change (sha256 `f6494f80…`, both legs). That gauge is reported
  here only with its control — a probe that added a *required* key to `ComponentInput` left
  the same file byte-identical, because `dist/index.d.ts` is a 63-line barrel of
  `export *` lines that names `ComponentInput` zero times. The gauge that can actually fail
  is the emitted declaration file: `dist/registry/Registry.d.ts` changes, as does
  `@object-ui/types`' `dist/plugin-scope.d.ts`, and those two files are the *only* emitted
  declarations that change in either package.
  
  `WidgetInput`'s union-arm capability is deliberately untouched — a different gate path
  and a separate judgment.
- 18a8e7d: **Published TS surface narrowed:** `DashboardComponentSchema` no longer declares
  the `aria` member (`{ ariaLabel?, ariaDescribedBy?, role? }`). Its doc comment
  claimed alignment with `@objectstack/spec AriaPropsSchema`, but the spec removed
  `dashboard.aria` at the #3896 audit close-out — `DashboardSchema.shape.aria` is
  a tombstone that refuses any value and tells authors to delete the key — and no
  dashboard renderer ever read `schema.aria` (objectui#5830).
  
  What an author loses is the **type-level suggestion** only: the key was already
  refused at parse (the Zod twin inherits the spec tombstone by reference), and
  `BaseSchema`'s index signature means an existing `aria:` line still compiles.
  There is **no runtime behaviour change** — the key never rendered, and stored
  documents carrying it already failed validation before this release.
- e7957ab: **Retired the designer-surface dashboard `aria` pair — `DashboardConfig.aria` and `DashboardConfigSchema.aria`** (objectui#5852).
  
  Both spellings are named verbatim above so a host can grep its own sources: the
  retired member is `aria`, on the TypeScript interface `DashboardConfig`
  (`@object-ui/types`, `designer.ts`) and on its Zod mirror `DashboardConfigSchema`
  (`@object-ui/types/zod`). It declared `{ label?: string; description?: string }`.
  
  **Why.** The spellings `label`/`description` match neither `@objectstack/spec`'s
  `AriaProps` vocabulary (`ariaLabel` / `ariaDescribedBy` / `role`) nor anything a
  renderer maps, so no read point could have consumed them even in principle.
  Re-measured on `main` at the retirement: zero `.aria` reads in
  `packages/plugin-designer/src`, `packages/plugin-dashboard/src` and
  `apps/console/src`; zero occurrences of either name anywhere in the `objectstack`
  repo; and `DashboardConfigPanel.tsx` — the panel the interface's own doc comment
  says it serves — imports neither name.
  
  **The two directions differ, and neither is a no-op:**
  
  - **TypeScript (a narrowed suggestion, not a compile break).** `DashboardConfig`
    carries a `[key: string]: any` catch-all, so an existing `aria:` line still
    compiles; what is gone is the editor suggestion and the false implication that
    the key was part of the contract.
  - **Zod (a behaviour change — read this one).** `aria` is now an ADR-0049
    retirement tombstone (`z.never().optional()`), following this package's
    existing convention. Previously an authored `aria` was **accepted and
    preserved** in `safeParse` output; it is now **refused by name**, with `aria`
    in the issue path and a message telling the author to delete the key. A plain
    deletion was deliberately not taken: `DashboardConfigSchema` is a bare
    `z.object` with no `.strict()`, so deleting the key would have made an
    authored `aria` **silently disappear** from the parsed output instead — a
    quiet data loss in place of a loud refusal.
  
  **External caveat.** In-repo consumer count is zero, but that is not the npm
  count: `@object-ui/types` is published, and stored dashboard configuration is
  not reachable from this repo. A host that authored `aria` on a `DashboardConfig`
  document will now see a validation error naming the key where it previously saw
  a silently carried value. The remedy is to delete the key — it never reached a
  renderer.
- f7e34ca: Close the dashboard widget `type` vocabulary, and admit `metric-card` as objectui's own component extension.
  
  `DashboardWidgetSchema.type` was `string` on the TypeScript interface and `z.string()` in the Zod twin — an unbounded hatch. A typo'd family, a chart type the spec retired, and a component type nothing registers all type-checked and validated, surfacing only as the renderer's red `OBJUI-001` panel at runtime.
  
  It is now the CLOSED `DashboardWidgetTypeName` / `DashboardWidgetTypeSchema`: the spec's own `ChartTypeSchema` families **by reference**, plus two named, closed objectui extension sets — `DASHBOARD_WIDGET_TYPE_EXTENSIONS` (`list`, `custom`: objectui-only widget families) and `DASHBOARD_COMPONENT_WIDGET_TYPES` (`metric-card`: an objectui SDUI **component** type the widget slot holds directly, per the maintainer ruling of 2026-08-14 — objectui's own component enum, explicitly not the spec widget enum).
  
  Three drifts the closure surfaced and this change fixes: the dashboard designer's palette offered `grid`, which is not a widget family in either contract and was refused at publish; the metadata-admin widget inspector and the designer both wrote an unvalidated `string` from their select boxes; and a `@object-ui/types` fixture pinned `bar-chart`, a `plugin-charts` component type, on a dataset-bound widget that could never render as one.
- fa429cf: The register-meta key `defaultChildren` is retired (objectui#5051).
  
  It was declared in four places, produced in eleven, and read in **none**. The designer's
  drop path builds a new node from its twin key only — `PageDesigner.tsx`,
  `props: paletteItem?.defaultProps ?? {}` — with no `children:` line, so a palette item
  that declared `defaultChildren` dropped an **empty** node and the declared children never
  materialised. Nothing rendered the wrong thing; an entire declaration surface was simply
  inert, which is the declared-but-unenforced shape ADR-0049 targets. Per the maintainer
  ruling of 2026-08-19, the key is removed rather than wired up; if designer
  default-children UX is ever product-wanted it returns as its own designed card.
  
  **If you author plugins against the published register-meta table, drop the key.** It is
  gone from `skills/objectui/guides/plugin-development.md`, which had been teaching it. A
  meta that still declares it stays *valid*: `ComponentMetaSchema` is a plain `z.object`,
  and measured on zod 4.4.3 that STRIPS unknown keys rather than rejecting them — so the
  key is silently dropped from the parse output instead of failing validation. TypeScript
  authors get the loud signal instead: all three `ComponentMeta` declarations
  (`@object-ui/types` `base.ts` and `plugin-scope.ts`, `@object-ui/core` `Registry.ts`) no
  longer offer it, so re-declaring it is now a compile error.
  
  **No runtime behaviour changes in either direction.** No code path read the key before
  this change, and the eleven producers that set it (`sidebar.tsx` x10, `span.tsx`) were
  feeding a reader that did not exist. Dropping a `span` or any of the ten sidebar types
  into the designer produces exactly the node it produced yesterday.
  
  Two suites keep it retired, one per package: `packages/types` pins the zod twin (the key
  is absent from the parse output, with a surviving sibling asserted present through the
  same parse as the control) plus the two TS twins with `@ts-expect-error`, and
  `packages/core` pins the registration surface the eleven producers were written against.
  Both are compile-time-enforced through each package's chained `tsconfig.test.json`.
- ed8df3e: `'agenda'` leaves `defaultView` on all three of its declaration faces
  (objectui#5784 — the `defaultView` sibling of objectui#5740's retirement on
  `CalendarViewSchema.view`; ADR-0049 enforce-or-remove): the
  `ObjectCalendarSchema` TS interface (an inline union `#5740`'s
  `CalendarViewMode` narrowing could not reach), the zod `ObjectCalendarSchema`,
  and the list-view `calendar` config's objectui-only `defaultView` extension.
  All three are now `['month', 'week', 'day']`.
  
  The declarations admitted a value nothing enforced: `ObjectCalendar`'s props
  declare `defaultView?: 'month' | 'week' | 'day'`, its schema read casts to the
  same three values, and `CalendarView` renders no agenda view. An author
  writing the type-legal, zod-valid `defaultView: 'agenda'` on an
  `object-calendar` node or in a list view's `calendar` config got a month
  calendar with no error or warning. The spec side already agrees:
  `@objectstack/spec`'s `ObjectCalendarProps.defaultView` is
  `['month', 'week', 'day']`. No in-repo, example, or catalog app authors
  `defaultView: 'agenda'` (measured for objectui#5784 with positive controls,
  including the objectstack tree — its only `agenda` token is the Agenda
  job-scheduler library).
  
  **This narrows the accept set: an author who writes `defaultView: 'agenda'`
  will now be refused at validation.** `defaultView` is a declared key, and
  declared keys are validated even under `.passthrough()`, so
  `defaultView: 'agenda'` is a **validation error that previously parsed
  green** (an `invalid_value` issue on the `defaultView` /
  `calendar.defaultView` path, offering `month`/`week`/`day`). Undeclared keys
  still pass through unchanged. Breaking on the published zod surface; ships as
  `minor` per this repo's version-alignment policy (majors track
  `@objectstack`).
  
  The runtime boundary is unchanged: `ObjectCalendar` still resolves an
  off-union raw `defaultView` away to its `'month'` default. Docblocks and both
  zod `describe` strings now teach the three-value set.
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
- 3e01cb5: **`BaseSchema.hidden` now declares the predicate string the renderer already evaluates** (objectui#7455, maintainer ruling 2026-09-03).
  
  `hidden?: boolean` becomes `hidden?: boolean | string`, and the Zod mirror's `z.boolean()` becomes `z.union([z.boolean(), z.string()])` — matching `visible` (#4581) and `disabled` (#4580 ruling Q3-A) on both faces. `hidden` was the third key on the same evaluated path and the only one still declared boolean-only.
  
  This is a **widening**, not a replacement: every boolean `hidden` keeps parsing and keeps type-checking unchanged, and the renderer's behaviour is untouched by this change — `SchemaRenderer`'s `shouldHide` chain already routed this key through `hasDeclaredPredicate` and evaluated it, which is the evidence the widening rests on. What changes is that authors and their tooling can now write `hidden: "${data.status === 'draft'}"` without casting past the declaration, and the Zod mirror stops refusing it (before this, that value failed `safeParse` with `invalid_type` at path `hidden` while the identical string on `visible` parsed).
  
  `hiddenOn` is unchanged and remains the sibling expression spelling. The CEL envelope object form is still declared on none of `visible` / `hidden` / `disabled`; objectui#7530 rules on all three together.
  
  Per this repository's version-alignment convention, a widening of a published type surface ships as `minor` with the semantics spelled out here rather than as `major` (see AGENTS.md, "版本号策略").
- 105f3c5: Retire `CRUDSchema` and the `type: 'crud'` node spelling (objectui#5373,
  maintainer ruling 2026-08-20, route 2) under ADR-0049 enforce-or-remove.
  
  `crud` had four declaration faces and no registered renderer, for the whole
  life of the key: the TS interface (`packages/types/src/crud.ts`), the zod
  mirror (`packages/types/src/zod/crud.zod.ts`), a dedicated branch in
  `validateSchema` that affirmatively PASSED it, and `CRUDBuilder` in
  `@object-ui/core`. A node spelling it painted the OBJUI-001 "Unknown component
  type" panel, and `content/docs/api/schema-reference.md` published it as
  reference material — so a reader (or an AI author) who copied the page got a
  red panel.
  
  Removed from `@object-ui/types`: the `CRUDSchema` interface and its zod
  mirror, the four shapes that existed only to type its keys — `CRUDOperation`,
  `CRUDFilter`, `CRUDToolbar`, `CRUDPagination` and their zod mirrors and
  `…SchemaType` aliases — and `CRUDSchema` as a member of `CRUDComponentSchema`,
  which is what took it off the node union `AnySchema`. `ActionSchema`,
  `DetailSchema` and `CRUDDialogSchema` are unchanged and remain the union's
  members.
  
  Removed from `@object-ui/core`: `CRUDBuilder` and the `crud()` factory.
  
  Authoring `crud` is now REFUSED BY NAME rather than passed or silently
  ignored. `validateSchema` returns an `error` with `code: 'RETIRED_TYPE'` on
  `schema.type` — at any depth, since it is what `validateChildren` recurses
  with — so `assertValidSchema` throws and `isValidSchema` answers `false`. The
  message names the migration: `object-grid` for the record table with its
  toolbar, filters, pagination and row/batch actions, `object-form` for the
  create/edit form, and `detail` for the record view. `api/schema-reference.md`
  is rewritten around those shapes.
  
  Note on blast radius: the repository itself contains zero authored `crud`
  nodes and zero registrations of the key (measured on the merge base against
  the doc gate's own 659-key registry derivation, which reads `register` and
  `registerLazy` alike). That is an IN-REPO zero, not an npm zero — a published
  consumer that imported the `CRUDSchema` type, called `crud()` / `CRUDBuilder`,
  or authored `type: 'crud'` will see a compile error or a validation error
  respectively. Both are the intended, loud replacement for a shape that has
  never rendered.
- 3ccd9e8: Split the static `table` column type off the rich shared `TableColumn`
  (objectui#5474, maintainer ruling 2026-08-22: Option C), so declared =
  enforced holds per renderer.
  
  `TableColumn` is unchanged and remains the rich shape `data-table`,
  `CRUDSchema` and detail-view relations honour. The static `table` renderer's
  `TableSchema.columns` now declares the new narrow `StaticTableColumn`
  (`header`, `accessorKey`, `className`, `cellClassName`, `width` — exactly the
  keys that renderer reads). The eleven keys the static renderer never read are
  retired from its surface as ADR-0049 tombstones: `hoverable` / `striped` on
  `TableSchema`, and `minWidth` / `align` / `fixed` / `type` / `sortable` /
  `filterable` / `resizable` / `editable` / `cell` on its columns.
  
  Breaking for authored metadata that wrote those keys on a `type: 'table'`
  node: they were silently inert before and are now refused loudly — a tsc
  error on the interface (`?: never`) and a parse rejection naming the key in
  `@object-ui/types/zod`. That loud refusal is the ruled outcome. Migration:
  nodes that wanted the interactive behaviour move to `type: 'data-table'`
  (whose columns keep the rich `TableColumn`); right-aligned columns on the
  static table use `cellClassName: 'text-right'`; alternate-row styling uses
  Tailwind on `className`.
- b2ea297: `ObjectSchemaMetadata` is now derived from `@objectstack/spec`'s `ServiceObject`
  instead of being a hand-written copy (objectui#5362; maintainer ruling
  2026-08-20: the object document type belongs to the spec).
  
  What changes on the published type surface:
  
  - **Gained:** the full spec object-document surface, including the three keys
    the runtime already reads but the old interface rejected as excess
    properties: `icon`, `titleFormat`, `listViews` (plus `pluralLabel`,
    `nameField`, `displayNameField`, `managedBy` as a spec key, and the rest of
    the spec document).
  - **Removed:** nine members the old interface declared that no objectui
    runtime code reads and the spec document does not know: `extends`,
    `triggers`, `primary_key`, `relationships`, `name_field` (the spec spelling
    is `nameField`), `soft_delete`, `audit_trail`, `version`, `cache`.
    `ObjectTrigger` and `ObjectRelationship` remain exported unchanged.
  - **Kept:** `editMode` — the one measured client-side member the runtime reads
    (`recordFormNavigation` / `AppContent`) — now declared on the new
    `ObjectSchemaClientExtensions` interface, which the derivation intersects.
    Note the spec's strict parse rejects `editMode` on published documents
    (`unrecognized_keys`); it is a client-type member only.
  
  Spelling settlement: `listViews` (camelCase) is canonical — `list_views`
  appears nowhere in `@objectstack/spec` 17.2.0. Runtime read sites in
  `@object-ui/app-shell` and `@object-ui/react` keep a documented snake-spelling
  READ fallback for stored pre-settlement documents (that stock has never been
  censused — objectstack#7917); the CRUD guide and its pinned transcription now
  author the canonical spelling.
- 5b5a5c3: **Breaking for authored metadata:** `ObjectViewSchema.viewTabBar` is RETIRED
  (objectui#7779, maintainer ruling B of 2026-09-06; ADR-0049 enforce-or-remove).
  An `object-view` node that authors `viewTabBar` no longer validates: the parse
  fails loudly on the `viewTabBar` path with the explanation in the message, and
  the TS member is a `?: never` tombstone so the same document is refused at
  compile time. Nothing ever read the key off the node — the tab-bar UX config
  (`ViewTabBarConfig`, still exported) is the `config` prop of the `ViewTabBar`
  component, composed by the host, not authored metadata. Remove the key.
  
  In the same change, eight `ObjectViewSchema` keys the TypeScript interface
  declared and the Zod mirror never did are now ENFORCED. Until now a document
  authoring any of them passed the validator unexamined through `BaseSchema`'s
  passthrough while the published type invited the author to write it — declared
  but not enforced (objectui#7279's `UnmirroredDeclared` reading). Each key now
  admits exactly what the declaration promises and refuses a wrong-typed value at
  its own path; a correctly typed document is untouched.
  
  | key | disposition | how |
  | --- | --- | --- |
  | `navigation` | mirrored | the spec's `ListViewSchema.navigation` slot by reference (`NavigationConfigSchema`, optional) |
  | `searchableFields` | mirrored | the spec's `ListViewSchema.searchableFields` slot by reference (`string[]`, optional) |
  | `filterableFields` | mirrored | the spec's `ListViewSchema.filterableFields` slot by reference (`string[]`, optional; the spec marks it a legacy shorthand for `userFilters.fields`) |
  | `allowCreateView` | mirrored | the sibling `ViewSwitcherSchema.allowCreateView` slot by reference — the renderer forwards the value verbatim into the `view-switcher` node it composes |
  | `viewActions` | mirrored | the sibling `ViewSwitcherSchema.viewActions` slot by reference, for the same reason |
  | `defaultViewType` | mirrored | local literal: the declaration's seven-value union (`grid`, `kanban`, `gallery`, `calendar`, `timeline`, `gantt`, `map`) — read as `schema.defaultViewType \|\| 'grid'` |
  | `defaultListView` | mirrored | local literal: `string` — read as `namedListViews?.[schema.defaultListView]` |
  | `showViewSwitcher` | mirrored | local literal: `boolean` — read as `schema.showViewSwitcher === true` |
  | `viewTabBar` | RETIRED | `?: never` + `retirementTombstone()` — zero reads on the node |
  | `listViews` | unchanged (still unmirrored) | see below |
  
  **What was measured.** Every reading was taken on the `object-view` node
  renderer (`packages/plugin-view/src/ObjectView.tsx`, registered by
  `plugin-view/src/index.tsx`) with `schema.objectName` / `schema.layout` as the
  positive controls of the same `schema.KEY` query, so each zero is a reading;
  the repo-wide census of `viewTabBar` finds the key in no source file outside
  `@object-ui/types` (two doc tables listed it as authorable and are corrected
  here). The spec side was read through the installed pin
  (`@objectstack/spec@17.2.0`, `ui` entry, 117 exported object schemas walked;
  control keys `objectName` / `columns` / `navigation` / `listViews` hit): the
  three spec-modelled keys are optional slots on `ListViewSchema` and
  `ObjectListViewSchema`; the six local keys have no spec slot anywhere.
  
  **`listViews` stays unmirrored, on the ruling's own fallback clause.** The
  declaration's value is the local `NamedListView` — **47 declared top-level
  members**, of which the renderer reads six: `label`, `type`, `columns`,
  `filter`, `sort`, `options`. It reads a seventh key off a named view, `data`,
  but `data` is **not a declared member of `NamedListView` at all**: it reaches
  the renderer through an `as any` cast on the named-view config in
  `packages/plugin-view/src/ObjectView.tsx`, so it never was one of the declared
  members a mirror would have to carry. The spec's `ViewSchema.listViews` is a
  record of the STRICT `ObjectListViewSchema`, which requires `columns` and
  refuses `options`, ObjectQL tuple filters and `default` — that is, it refuses
  the named views this package's own README and
  `content/docs/api/schema-reference.md` teach (`{ label: 'All Users' }` fails at
  `columns`; `filter: [["owner", "=", "..."]]` fails at `filter.0`). Mirroring the
  spec value would lose documented behaviour; mirroring the local value would
  enforce **41 unread members** (47 declared, minus the 6 that are both declared
  and read) into the contract — the
  very thing ruling B refused for the six local keys. The key therefore stays in
  the parity ledger with that measurement, pinned, until the maintainer decides its
  value type. It is not papered over with `z.any()`.
  
  **Who is affected:** an author who wrote `viewTabBar` on an `object-view` node
  (remove it), or who wrote a wrong-typed value for one of the eight keys — e.g.
  `defaultViewType: 'tree'` (host-composition-only, objectui#5321),
  `navigation: 'page'` (write `navigation: { mode: 'page' }`),
  `searchableFields: 'name'` (write an array), `viewActions: 'share'` (write
  `[{ type: 'share' }]`). Such documents used to pass validation and render with
  the key ignored; they now fail at the key with the reason.
  
  **Who is NOT affected:** every correctly typed document, and every document
  that never wrote these keys — `absent` stays valid on all nine. No renderer
  changed. The parity ledger (`zod-mirror-parity.test.ts`) records the move:
  `UnmirroredDeclared` 14 entries / 96 keys to 14 / 87, the `ObjectViewSchema`
  entry re-derived into the SPEC-DERIVED half because the mirror now references
  the spec in code.
  
  Graded `minor`, not `patch`: this narrows the accepted input set, which is
  breaking for any author who wrote the tolerated spellings. It is not `major`
  per this repo's fixed-group convention (objectui's own breaking changes ship as
  `minor`; the group's major tracks `@objectstack` — AGENTS.md 版本号策略,
  mechanically enforced by `scripts/check-changeset-no-major.mjs`).
- 258d264: `QueryParams` (`@object-ui/types`) no longer carries the `[key: string]: any`
  index signature; its key set is now exactly the nine declared `$`-prefixed
  members — `$select`, `$filter`, `$orderby`, `$skip`, `$top`, `$expand`,
  `$search`, `$searchFields`, `$count` (objectui#7497).
  
  **What stops type-checking that type-checked before.** Any object literal
  assigned or passed as a `QueryParams` that carries a key outside those nine —
  the unprefixed spellings the readers silently dropped (`{ filter }` for
  `$filter`, `{ limit }` for `$top`, `{ options: { $top } }`), and any
  `$`-prefixed name that is not declared (`{ $limit }`). Reading an undeclared
  key off a `QueryParams` value (`params.filter`) is refused too. A published
  guide had taught `adapter.find('contacts', { filter: { active: true } })` and
  asserted the client saw that `filter`: it compiled, `convertQueryParams`
  dropped the key, and the assertion could never pass. That literal is now a
  compile error at the call site.
  
  **What does not change.** Every reader in this repository —
  `convertQueryParams` and `rawFindWithPopulate` in `@object-ui/data-objectstack`,
  `queryParamsToRecord` in `@object-ui/core`, `ValueDataSource.find` — reads only
  declared members, so nothing the runtime honoured is refused. A
  `Record<string, unknown>` or `Record<string, any>` VALUE (the shape
  `@objectstack/spec`'s `ViewData.params` parses to) still passes, as does a
  spread of one beside `$top` / `$skip`; a type assertion (`{ limit: 1 } as
  QueryParams`) still compiles because assertions skip excess-property checks,
  which is why `object-ui/no-unprefixed-query-params` keeps its typed cases.
  
  **Why `minor` and not `patch` or `major`.** Narrowing the accepted set of a
  published contract is a breaking change for any downstream caller that relied
  on the extra keys. The census behind the grade: across this repository's
  packages, apps, examples, e2e and scripts trees (4,362 files), zero `find` /
  `findOne` call sites or `QueryParams` literals carry a non-`$` key, and no
  adapter reads one — the signature carried nothing but typos. This repository
  records its own breaking changes as `minor` with the break spelled out; `major`
  is reserved for following `@objectstack` across a major (see AGENTS.md, version
  alignment). A `patch` would be wrong: this is a deliberate narrowing, not a
  fix inside the accepted set.
  
  Migration for a downstream caller that did pass an extra key: if an adapter of
  yours reads it, declare it on your own params type and widen at your adapter's
  boundary; if nothing reads it, it was already being dropped — delete it.
- 78cbdb5: Retire `ThemeComponentSchema` (`type: 'theme'`) — a component kind no renderer
  implemented (objectui#5489).
  
  `packages/types/src/theme.ts` declared a theme-manager **component** carrying
  `themes[]`, `activeTheme`, `allowSwitching`, `persistPreference` and
  `storageKey`, and `packages/types/src/zod/theme.zod.ts` published the matching
  Zod object as a member of `ThemeUnionSchema` and therefore of
  `AnyComponentSchema`. Nothing rendered it: `'theme'` appears at no
  `ComponentRegistry.register(...)` / `registerLazy(...)` site in `packages/*/src`,
  and in neither `PROTOCOL_COMPONENTS` nor `PALETTE_PLACEHOLDER_BLOCKS`
  (`packages/components/src/renderers/placeholders.tsx`), so it did not even
  resolve to a placeholder — a page declaring one got the registry's "Unknown
  component type" panel (OBJUI-001) instead of a theme manager. Declared-but-
  unenforced, removed under the maintainer ruling of 2026-08-21 on
  objectstack#10485 (option B).
  
  Removed from the published surface: the `ThemeComponentSchema` type
  (`@object-ui/types`), the `ThemeComponentSchema` Zod object
  (`@object-ui/types/zod`), the `ThemeComponentSchemaType` inference alias, and the
  `'theme'` member of `ThemeUnionSchema` / `AnyComponentSchema`. A schema spelling
  `type: 'theme'` is now REFUSED by `AnyComponentSchema.safeParse` rather than
  accepted and then rendered as an error panel, which is pinned by a test.
  
  **The theme system is unchanged.** `Theme` (the spec's authoring theme
  document), `ThemeDefinitionSchema`, `ThemeModeSchema`, `ThemeEngine`
  (`@object-ui/core`) and `ThemeProvider` (`@object-ui/react`) are all retained and
  untouched — the same ruling retains them explicitly. Author a theme as a
  document handed to `ThemeProvider`; that path never went through the removed
  component kind.
- b7543a9: Retire `ThemeSwitcherSchema` (`type: 'theme-switcher'`) and
  `ThemePreviewSchema` (`type: 'theme-preview'`) — the two remaining theme
  component kinds, which no renderer implemented — together with
  `ThemeUnionSchema`, the union that after objectui#5489 held only these two
  members (objectui#5647).
  
  `packages/types/src/theme.ts` declared a theme-switcher control (`variant`,
  `showMode`, `showThemes`, `lightIcon`, `darkIcon`) and a theme-preview panel
  (`showColors`, `showTypography`, `showComponents`), and
  `packages/types/src/zod/theme.zod.ts` published the matching Zod objects as
  the two members of `ThemeUnionSchema` and therefore of `AnyComponentSchema`.
  Nothing rendered either: neither literal appears at any
  `ComponentRegistry.register(...)` / `registerLazy(...)` site in
  `packages/*/src` (202 registered keys enumerated; positive control on the same
  pipeline: `tooltip` → 1), nor in `PROTOCOL_COMPONENTS` /
  `PALETTE_PLACEHOLDER_BLOCKS`
  (`packages/components/src/renderers/placeholders.tsx`), and no fixture
  declares either kind (control: `"type": "form"` → 81) — so a page declaring
  one got the registry's "Unknown component type" panel (OBJUI-001), never a
  switcher or a preview. Declared-but-unenforced, removed under the 2026-08-21
  maintainer ruling (option B) on objectstack#10485, extended to these siblings
  by inheritance on identical evidence (objectui#5647).
  
  Removed from the published surface: the `ThemeSwitcherSchema` /
  `ThemePreviewSchema` types (`@object-ui/types`), the matching Zod objects and
  `ThemeUnionSchema` (`@object-ui/types/zod`), and the `ThemeSwitcherSchemaType`
  / `ThemePreviewSchemaType` inference aliases. `zod/theme.zod.ts` now exports
  nothing and stands as the tombstone module. A schema spelling
  `type: 'theme-switcher'` or `type: 'theme-preview'` is now REFUSED by
  `AnyComponentSchema.safeParse` rather than accepted and then rendered as an
  error panel, which is pinned by a test.
  
  **The theme system is unchanged.** `Theme` (the theme document vocabulary,
  owned by `@object-ui/types` since objectui#5716), `ThemeEngine`
  (`@object-ui/core`) and `ThemeProvider` (`@object-ui/react`) are retained and
  untouched — the rulings retain them explicitly. Author a theme as a document
  handed to `ThemeProvider`; that path never went through the removed component
  kinds.
- c9327c9: Localize the theme document types: `@object-ui/types` now owns `Theme`, `ThemeMode` and `ColorPalette` (objectui#5716 ruling, 2026-08-23). The spec retired its theme module (objectstack#10485) while ObjectUI retained the theme system, so the types are hand-written from the last-published `@objectstack/spec` 17.1.0 shapes instead of re-exported — a spec dependency refresh past the retirement no longer breaks these packages.
  
  Published-name REMOVALS from `@object-ui/types` (zero in-repo readers, deleted under the same ruling's rider):
  
  - `Typography` — the shape lives on as the inline `Theme['typography']` member.
  - `BorderRadius` — lives on as inline `Theme['borderRadius']`.
  - `Shadow` — lives on as inline `Theme['shadows']`.
  - `ThemeDefinition` — the deprecated alias of `Theme`; use `Theme`.
  
  Also added: `THEME_MODES`, a runtime tuple witness of the theme mode vocabulary (`['auto', 'light', 'dark']`).
  
  The `UI` protocol namespace (`import { UI } from '@object-ui/types'`) now resolves `UI.Theme` / `UI.ThemeMode` / `UI.ColorPalette` to the local owners, so they survive the upcoming spec refresh; the rest of the namespace continues to track `@objectstack/spec/ui`. After that refresh, retired spec/ui members (`UI.ThemeSchema`, `UI.ThemeModeSchema`, `UI.ThemeParsed`, `UI.Typography`, `UI.BorderRadius`, `UI.Shadow`, `UI.defineTheme`) drop out of the namespace.
  
  `@object-ui/providers`: `ThemePreference` is now derived from `@object-ui/types`' `ThemeMode` instead of the retired spec `ThemeModeSchema` (same union: `'auto' | 'light' | 'dark' | 'system'`).
- 920165d: Remove the six retired `@objectstack/spec/ui` theme-schema re-exports from `@object-ui/types/zod` — `ColorPaletteSchema`, `TypographySchema`, `BorderRadiusSchema`, `ShadowSchema`, `ThemeModeSchema`, `ThemeDefinitionSchema` (the spec's `ThemeSchema`) — plus their `…SchemaType` inference helpers, and the `theme` / `mode` props of `ThemePreviewSchema` (zod and interface) that consumed them.
  
  objectstack#10485 (ADR-0049 enforce-or-remove, PR objectstack#10695) retired the spec's whole `ui/theme.zod.ts` module, and the maintainer's ruling on objectstack#10856 (Options A + C) has objectui remove the dangling imports first so the Console Pin Gate can build objectui against the framework tree; restoring the spec exports (Option B) was explicitly not taken. Breaking in effect for anyone importing those six names from `@object-ui/types/zod`: there is no replacement — the validators retired upstream with no successor. The theme TYPE surface (`Theme`, `ThemeMode`, `ColorPalette`, … re-exported from `@object-ui/types`) and the ThemeEngine/ThemeProvider runtime are unchanged.
- 4d73b07: The zod `BaseSchema` mirror now accepts everything its TypeScript declaration
  declares — five keys had drifted narrower (objectui#4605).
  
  `@object-ui/types/zod` is a published runtime validator hand-written to mirror the
  `BaseSchema` interface. As the interface widened, the mirror did not, so five keys
  refused at parse time a spelling the published types invite and the renderer
  implements — "declared = enforced" inverted. `.passthrough()` rescued none of them:
  passthrough admits UNDECLARED keys, and all five are explicitly declared, so the
  narrow declaration won.
  
  Measured against the unmodified mirror before the change, these were the refusals:
  
  | key | authored input | old mirror said |
  |---|---|---|
  | `visible` | `'${data.status === "open"}'` | `expected boolean, received string` |
  | `disabled` | `'${data.status === "locked"}'` | `expected boolean, received string` |
  | `ariaLabel` | `{ key, defaultValue }` | `expected string, received object` |
  | `label` | `{ en: 'Owner', 'zh-CN': '负责人' }` | `expected string, received object` |
  | `description` | `{ en: 'The record owner' }` | `expected string, received object` |
  
  `visible`/`disabled` now take `boolean | string` — what `evaluateCondition` accepts,
  no wider. `ariaLabel` takes the KEYED reference through a new exported
  `KeyedI18nLabelSchema`; `label`/`description` take the spec's own `I18nLabelSchema`
  BY REFERENCE, so a change to the spec's label contract is picked up rather than
  re-typed. Every spelling that parsed before still parses.
  
  The two i18n vocabularies are kept apart rather than merged into "some object".
  `label`/`description` are the spec's INLINE locale map (resolved by
  `resolveI18nLabel(label, locale)`); `ariaLabel` is the KEYED reference (resolved by
  `resolveKeyedI18nLabel`, which returns `undefined` for a locale map and would render
  an EMPTY aria-label). Widening both slots to accept either shape would have
  reproduced objectui#4167's confusability hazard inside the validator that exists to
  catch it, so each slot admits only its own vocabulary and both cross pairings are
  pinned as rejections.
  
  The new pin is DERIVED rather than a hand-written key list: it reads the mirror's own
  `.shape` and compares each key against the declaration, so the next widening of
  `base.ts` that forgets this file turns it red with no list to maintain. It reads
  `.shape` and not `keyof z.input<…>` because that spelling was measured vacuous —
  `.passthrough()` collapses the inferred key union to bare `string`, and a pin written
  over it resolved `never` while five keys were demonstrably narrow. Two guards pin the
  derivation against both degenerations (`never` and `string`).

### Patch Changes

- 06a8af5: `QueryParams.$filter` now declares both shapes the data sources actually accept — the
  MongoDB-style field-keyed record, or a `FilterArray`, the ObjectQL AST sugar bound from
  `@objectstack/spec/data` (objectui#3909).
  
  **Nothing is narrowed and no accepted value changes.** `Record<string, any>` already
  accepted arrays structurally — they satisfy its string index — so the union documents
  shapes that were always legal rather than admitting new ones. Measured both ways under
  `tsc --strict`: all five inputs `translateFilterToAST` enumerates assign to the old and
  new declarations alike, and both reject a bare number and a bare string identically. A
  downstream `turbo run build` over all 43 dependent packages is green, which is the
  evidence a published type change breaks no consumer.
  
  The harm was entirely on the type face, and it was two-sided. The declaration blocked
  nothing while describing one legal shape as though it were the only one — objectui#3831
  is what that cost, a rule array accepted by a `Record<string, any>` slot, object-spread
  flattened to `{"0": {...}}`, types green, and the query filtering on a column literally
  named `0`. And someone writing a new consumer would read the type and its record-only
  `@example`, conclude the array path was illegal, and add a tolerant conversion for it —
  the "widen the consumer to tolerate the producer" shape AGENTS.md #0.1 forbids. Two
  producers have fed arrays through this slot all along: `plugin-list`'s
  `buildEffectiveFilter` (grid and export) and `plugin-view`'s `ObjectView` (calendar /
  kanban / gallery / timeline). The runtime was right; the declaration was narrow.
  
  The array half is **bound** to the spec's `FilterArray` rather than restated locally, so
  it cannot fork from the vocabulary the servers parse — the same failure two hand-written
  operator lists had in objectui#3948. The doc comment names `translateFilterToAST` as the
  authoritative accepted set instead of carrying a second list to drift from.
  
  `@object-ui/fields` drops the local cast this defect forced. PR objectui#3908 wrote
  `filter as Record<string, any>` at one assignment in `useRecordQuery`, deliberately, as
  debt rather than widening the shared type. `hasFilter` is now a type predicate narrowing
  to the `$filter` slot's own type, so the assignment needs no cast and the guard cannot
  drift from the declaration it guards. Type-only throughout; no runtime behaviour changes.
- 460575f: `exportOptions`: the alignment claim is now checked against the installed spec,
  not asserted in prose
  
  `ListViewExportOptions` mirrors `@objectstack/spec`'s
  `ListViewSchema.exportOptions` object branch. The comment above it explained
  that the five keys were restated rather than derived "because objectui still
  pins `@objectstack/spec@17.0.0-rc.6`, whose `ListView.exportOptions` is the
  LEGACY bare format array".
  
  That is no longer true. objectui installs `@objectstack/spec@17.2.0`, which
  carries the object form: the bare format array lifts to `{ formats: [...] }` at
  parse and `'pdf'` has left the enum. Nobody edited the comment; the dependency
  moved underneath it. This is the second time this particular comment has gone
  false — objectui#4535 was filed for the first — and both times the mechanism was
  the same: a prose claim about another package's shape, with nothing that fails
  when that shape changes.
  
  So the reason is corrected and, more to the point, it stops being load-bearing.
  A new `export-options-spec-parity.test.ts` reads the object branch out of the
  spec package that is actually installed, at test time, and asserts against it:
  the key set, the format enum (`'pdf'` absent from both sides), upstream
  strictness, the migration prescription the `'pdf'` refusal carries, and the
  parse-time array lift. The key set is projected from `keyof
  ListViewExportOptions` through an exhaustive `Record`, so a local key added or
  dropped fails to compile rather than passing a comparison against a hand-copied
  list.
  
  The mirror itself is unchanged, and stays a mirror for a measured reason the
  test now pins: `ListViewExportOptionsSchema` is internal to the spec bundle and
  is not one of the package's public exports, so there is nothing to import. Only
  the enclosing `ListViewSchema` is exported, and its `exportOptions` is a
  two-branch union whose inferred type is not this interface. When upstream
  exports the symbol, the test says so by failing, and the mirror can go.
  
  Types are unchanged — no export added or removed, no key or union altered — so
  this is a patch. The shape change was the earlier minor that introduced
  `ListViewExportOptions`.
- 64d624d: `RuntimeWidgetManifest` / `RuntimeWidgetSource` document the spec's retired
  `WidgetManifest` / `WidgetSource` as HISTORY, instead of describing them as a
  live schema (objectui#5213).
  
  Both JSDoc blocks were written while `@objectstack/spec/ui` still exported a
  field-widget-plugin `WidgetManifest` and a `WidgetSource` union — they said the
  local types were "renamed off the spec's name", in the present tense, and the
  manifest block enumerated the spec shape key by key (`fieldTypes`, `category`,
  `lifecycle`, `events`, `properties`, `implementation`, `screenshots`, `license`,
  `aria`, `performance`). Protocol 17 retired that entire widget-registration
  vocabulary under ADR-0049 enforce-or-remove (objectstack#5055): the installed
  `@objectstack/spec` 17.2.0 exports none of those names, and its own tombstone
  records why there is nothing to migrate — no schema ever declared a carrier key
  of a widget shape, so the record is the D3 `SemanticMigration`
  `ui-widget-i18n-family-retired` plus `ui/WidgetManifest` in
  `RETIRED_DEFS_BY_MAJOR` for major 17.
  
  A per-key description of a schema that no longer exists is the ADR-0033 failure:
  an AI author reads a published docblock as present-tense fact and builds on it.
  The enumeration is dropped rather than re-dated, and the blocks now say what is
  true today — the bare names are owned by NOBODY, `RuntimeWidgetManifest` is
  objectui's only widget-registration contract, and the `Runtime` prefix is kept
  BY CHOICE (objectstack#4988's precedent: a freed word is not a reason to spend a
  second breaking rename taking it back; the unlock is recorded, not taken, in
  objectui#4164). The `inline` collision that made the `WidgetSource` rename
  urgent is kept, in the past tense, because it is the reason the prefix exists.
  Both blocks now point at the live assertion instead of restating it: the "the
  spec no longer owns" rows in
  `packages/types/src/__tests__/page-nav-misc-spec-parity.test.ts`, which are what
  goes red if the spec ever re-publishes either name.
  
  Comments only. No type, signature, member or test changed, and the parity test
  that owns this fact was already correct — it moved both rows to its "spec no
  longer owns" table on the 17.0.0-rc.6 bump.
  
  Declared a `patch` for `@object-ui/types` alone because the emit was measured,
  not assumed: both blocks sit on EXPORTED declarations, so they publish. Rebuilt
  from a cleared `dist` and `tsconfig.tsbuildinfo` on both sides and compared by
  SHA-256 — `dist/widget.d.ts` `bb4f2fd702cac02a…` -> `db1d5fbd53d305f5…`
  (a consumer reads this text on hover and in the API docs), while
  `dist/widget.js` is byte-identical across the rebuild
  (`a3de34c54213a269…` both sides), so nothing runtime moved.
- 40c479a: Static-table retirement tombstones now refuse with their remediation text
  (objectui#6105).
  
  The nine ADR-0049 tombstones on `StaticTableColumnSchema` (`minWidth`, `align`,
  `fixed`, `type`, `sortable`, `filterable`, `resizable`, `editable`, `cell`)
  already refused an authored value at the right path — but the carefully written
  `.describe()` string never reached the author, because `.describe()` is schema
  METADATA. What an author saw was zod's own `Invalid input: expected never,
  received string`: which key is wrong, nothing about why it was retired or what
  to write instead. Loud refusal is the ruled outcome; half its payload was being
  dropped.
  
  One shared mechanism carries the text into both channels. `retirementTombstone()`
  (`zod/tombstone.zod.ts`) takes the guidance string ONCE and writes it to both
  `z.never({ error })` — the parse-time issue message — and `.describe()` — the
  generated JSON-Schema and docs surface, unchanged. One string, so the two cannot
  drift.
  
  Authoring `align: 'right'` on a static table column now reports `RETIRED
  (objectui#5474) — never read by the static table; use data-table, or a
  cellClassName like text-right`.
  
  The accept set is untouched: same `success`, same issue `path`, same issue `code`
  (`invalid_type`) for all nine, measured member-by-member before and after. Only
  the message differs.
- 905b21f: The three view handler keys are declared as EVENT NAMES, not callbacks.
  
  `ViewSwitcherSchema.onViewChange`, `FilterUISchema.onChange` and
  `SortUISchema.onChange` were described as "change callback" on both the zod
  mirror and the TS interface. They are not callbacks: the string an author
  writes is the NAME of a `CustomEvent` the renderer dispatches on `window` —
  `new CustomEvent(schema.onViewChange, { detail: { view } })` and its two
  siblings.
  
  **What an author feels.** Nothing they write breaks — the type is still
  `string`, so no accept set moves and no existing document changes verdict.
  What changes is the two places this contract is published — the zod mirror's
  `describe()` text and the TS JSDoc — which now tell them what the string is
  FOR, and what to listen for:
  
  ```json
  { "type": "sort-ui", "fields": [{ "field": "name" }], "onChange": "myapp:sort-changed" }
  ```
  
  ```js
  window.addEventListener('myapp:sort-changed', (e) => e.detail.sort);
  ```
  
  Previously "Sort change callback" invited the two readings the runtime does not
  support — a function (unwritable in JSON) or a handler expression (dropped at
  runtime) — with no hint that the working form is an event name.
  
  The correction also protects the capability. A handler-key census that buckets
  by declared TYPE cannot tell an event name from the unsupported
  handler-expression dialect, and on that reading these three had been swept in
  for retirement, which would have deleted working behaviour. A new pin
  (`plugin-view/src/__tests__/handlerEventNameLiveness.6124.test.tsx`) now holds
  both halves — that each key is DECLARED on the authorable surface, and that the
  authored string reaches `new CustomEvent(...)`.
- 6f81384: `ObjectViewSchema`'s `table` and `form` slots now ship the members they promise
  (objectui#6269). Both were declared by deriving from the schema they document — `table?:
  Partial<Omit<ObjectGridSchema, 'type' | 'objectName'>>`, `form?: Partial<Omit<ObjectFormSchema,
  'type' | 'objectName' | 'mode'>>` — and both derived types declared **zero** properties.
  
  `Omit<T, K>` is `Pick<T, Exclude<keyof T, K>>`, and `keyof T` on a type carrying a string index
  signature is `string | number` — the literal member names are absorbed. `ObjectGridSchema` and
  `ObjectFormSchema` both inherit `BaseSchema`'s `[key: string]: any` (objectui#5155), so each
  `Pick` rebuilt a type holding the index signature and none of the named members. Measured
  through the TypeScript checker: `ObjectGridSchema` 61 members, the `Omit` of it 0;
  `ObjectFormSchema` 67, the `Omit` of it 0. This is objectui#6151's collapse in *property*
  position — #6151's guard walks the `LayoutSchema` union and cannot see properties on
  `ObjectViewSchema`.
  
  Nothing errored, because the index signature answered every key as `any`. The visible costs
  were the ones only a reader of the declaration meets: `table: { colunms: 3 }` type-checked,
  `table: { pageSize: 'ten' }` type-checked, and editor completion inside `table: { … }` offered
  nothing at all for a slot documented as "inherits from ObjectGridSchema".
  
  Each `Omit` is now a `Partial<Pick<…>>` over an explicit key list — 59 keys for `table`, 64 for
  `form`, i.e. every declared member minus the identity keys the view itself fixes. `Pick` with
  literal keys never computes `keyof T`, so it cannot collapse the same way. The key lists are
  pinned against silent drift by `packages/types/src/__tests__/object-view-slot-key-lists.test.ts`,
  which recomputes each source schema's declared members through the TypeScript checker and
  requires set equality; a member added to `ObjectGridSchema` and not to the list turns it red.
  
  **Tightening, deliberately.** Restoring named members re-enables excess-property checks on
  object literals assigned into these two slots, so a misspelled key there is now an error
  instead of silently doing nothing. That is the intent of the fix. The slots' member *types* are
  unchanged — every key that resolved to a real declared type before still does.
  
  The `Pick` lists exist only because `BaseSchema` carries a root string index signature. When an
  objectui#5155 phase removes it, `Omit` stops collapsing and the lists (plus their pin) become
  removable; the pin's own comment records the condition, and one of its assertions is the
  tripwire that will notice.
- dddb942: Delete the dead `metadata-admin/previews/object-fields-bridge.ts` module, and the three
  prose references that still described it as wired.
  
  The module exported `bridgeFromDraft`, `commitToDraft` and `FieldsBridgeResult` and had
  **zero importers** — re-measured on the merged base, not inherited from the filing. Nothing
  in the repository could reach it either: `@object-ui/app-shell`'s `exports` map declares
  only `.` and `./styles.css`, so the file was not addressable as a deep import even from
  outside the workspace.
  
  Removing it is not the whole change. Three comments — in `types/src/designer.ts`, `types`'
  `designer-field-types.test.ts` (twice) and `fields`' `richtext-cell-renderer-5452.test.tsx`
  — cited the bridge as a live corroborating source. Left behind, they would have swapped
  dead code for false documentation: three in-repo pointers telling a future reader that this
  bridge mediates between the framework field record and `FieldDesigner`, and nothing telling
  them it is unreachable. The two that named it as the consumer deriving an editable-subset
  check from `DESIGNER_FIELD_TYPES` now name `MetadataFieldsPage`, which does exactly that
  with the same idiom and the same `objectui#3017` anchor. The third cited the bridge's
  `richtext` → `html` mapping as one of three corroborations that `richtext` stores HTML; the
  other two (the showcase seed and the field-type decision tree) are live and carry the point
  on their own, so that clause is dropped rather than repointed.
  
  No behaviour changes: nothing imported the module, so there is nothing to migrate.
- c8ea8af: `PartialSchema<T>` is pinned as collapsed, and its doc comment now says so
  (objectui#6397). Nothing about the type changes — the declaration is deliberately
  left exactly as written.
  
  The alias promises "all properties optional except the type" and does not deliver
  it. Every instantiation declares exactly ONE property, `type`, and carries a live
  `[key: string]: any`, so it accepts any key at `any`. Measured through the
  TypeScript checker against the emitted `index.d.ts` — the same instrument that
  produced objectui#6269's 61 -> 0 reading:
  
      PartialSchema<ObjectGridSchema>  -> 1 declared property: type   (source: 61)
      PartialSchema<ObjectFormSchema>  -> 1 declared property: type   (source: 67)
      PartialSchema<ObjectViewSchema>  -> 1 declared property: type   (source: 42)
      PartialSchema<ButtonSchema>      -> 1 declared property: type   (source: 27)
  
  `Omit<T, K>` is `Pick<T, Exclude<keyof T, K>>`, and `keyof T` on a type carrying a
  string index signature is `string | number` — the literal member names are
  absorbed. Every `T extends BaseSchema` inherits `BaseSchema`'s `[key: string]: any`
  (objectui#5155), so `Partial<Omit<T, 'type'>>` rebuilds a type holding the index
  signature and none of the named members. This is objectui#6151's collapse
  (heritage clause) and objectui#6269's (property position) in a third position: a
  generic mapped-type alias, which is why neither of their guards sees it — #6151's
  walks the `LayoutSchema` union, #6269's reads `ObjectViewSchema`'s two slots.
  
  **Why a pin and not a repair or a retirement.** Triage ruled on 2026-08-25 that
  retiring the alias is a removal of a published export of `@object-ui/types` — a
  breaking removal of published capability, which sits on the human floor — and that
  escalating it today would spend the maintainer's attention on a question
  objectui#5155 is expected to moot. Repair in place is unavailable: `T` is generic,
  so there is no literal key list to `Pick` the way #6269 could for its two concrete
  schemas, and every generic re-spelling collapses for the same `keyof T` reason.
  Once #5155 removes the root index signature, the alias starts working as written
  with no edit at all. What this ships is the removal of the one impermissible
  state — *declared, published, collapsed, and unpinned*.
  
  No runtime code, no type declaration and no accepted value changes; a consumer's
  `PartialSchema<X>` means exactly what it meant before. Declared `patch` rather
  than as a no-release so the doc-comment warning actually reaches the published
  `.d.ts` a consumer reads — that warning is the deliverable half of the card.
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
- f20dcf0: `ObjectGanttSchema`'s flattened gantt face documents `colorField`, `parentField`,
  `tooltipFields` and `quickFilters` in its own words, instead of pointing at a type that
  says nothing about them (objectui#6547).
  
  Those four members carried a bare `See {@link GanttConfig}.` pointer. `GanttConfig` is
  `SpecGanttConfig & { … }`, and all four arrive from the **spec** half: the local half of
  that intersection declares exactly ten top-level members (`timeSegments`, `lockField`,
  `objectField`, `summaryExtent`, `defaultCollapsedDepth`, `borderColorField`,
  `dependencyTypes`, `timeZone`, `exportFileName`, `interactions`) and none of these four is
  among them. `SpecGanttConfig` is `z.input<typeof GanttConfigSchema>`, and the spec's
  emitted `.d.ts` carries no per-member JSDoc — its 19 members are bare `z.ZodOptional`
  entries under one type-level "Gantt Settings" docblock. So the pointer was not merely
  unhelpful, it was misdirecting: a reader who followed it landed on a type documenting
  nothing about the key and concluded the key was undocumented.
  
  Verified on the built artifact rather than the source: all four bare pointers were present
  in `dist/objectql.d.ts` before this change and none is after, so the defect was on the
  published surface and the repair reaches it.
  
  **Prose only — the published shape is unchanged, and that is the point.** The natural
  repair, writing the prose onto `GanttConfig`, means re-declaring these members inside the
  intersection; PR objectui#6546 measured that as a widened published surface on the built
  `dist/index.d.ts` and it was rejected there. So the shape was measured, not asserted:
  `ObjectGanttSchema`'s 45 members and their checker-resolved types are byte-identical
  before and after, and the built face's 51 declaration lines diff clean with comments
  stripped. Only comment bytes moved.
  
  The seven **member-qualified** pointers (`See {@link GanttConfig.borderColorField}`,
  `.lockField`, `.summaryExtent`, `.defaultCollapsedDepth`, `.timeSegments`,
  `.interactions`, `.exportFileName`) name members of that ten-member local half, resolve to
  real prose, and are deliberately left alone — the defect is the bare form, and a substring
  search for `{@link GanttConfig` hits both.
  
  The prose is taken from the renderer's live read sites in `plugin-gantt`, not invented:
  `colorField`'s status/state/priority/severity fallback chain and the platform default
  blue, `parentField`'s unknown-id-renders-as-root rule, `tooltipFields`' drop-empty-rows
  behaviour (which is what lets a mixed-object tree list the union of every level's fields)
  and its replacement of the default date · duration · progress tooltip line, and
  `quickFilters`' schema-resolved option domains. No behaviour change, no runtime code.
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
- adb2a86: The standalone runner renders `AppAction.items` from its declared type only, which
  makes `AppActionSchema.onClick`'s retirement message true again (objectui#6854,
  maintainer ruling of 2026-09-05, option B2).
  
  `AppAction.items` is `AppMenuItem[]`, and the zod mirror parses it with the legacy
  eight-member `MenuItemSchema` — neither declares `onClick` or `shortcut`.
  `LayoutRenderer` reached both through `as any`, past the type it was handed, and
  that left three mutually exclusive signals about the same key: the TypeScript face
  said `?: never`, the validator's refusal said "no renderer reads this key, so
  nothing could ever run it", and a renderer read it. An agent or a reader could
  believe any one of the three and be contradicted by the other two.
  
  **No published accept set moves and no exported symbol changes.** `AppAction.items`
  is NOT re-typed (the alternative was measured and refused: it would have carried a
  breaking migration for `path` / `href` / `badge` / `type` and the divider spelling,
  for a capability with no measured consumer). The refusal message itself is unchanged
  — it is shared by 22 other retired handler keys, and deleting the cast is what makes
  its sentence true rather than restating it.
  
  - `@object-ui/runner`: `LayoutRenderer` no longer reads `onClick` or `shortcut` on a
    `type: 'user'` action's `items`. The `onClick` branch was an empty body and could
    never run a JSON value; the `shortcut` read rendered a `DropdownMenuShortcut` from
    a key the mirror strips in silence, so no validated document could reach it. A
    census of every JSON and TypeScript app document in this repository found zero
    authors of either key (positive controls recorded on the issue).
  - `@object-ui/types`: the rationale comments on `AppAction.onClick` and
    `AppActionSchema.onClick` said "nothing reads `AppComponentSchema.actions[]`".
    That was false — the runner renders both the `'button'` and the `'user'` arm.
    Corrected to what was measured: `actions[]` is read, `onClick` is not.
  
  Whether `shortcut` should become authorable on `AppAction.items` is a separate
  contract question and is filed on its own.
- 8063bcb: The remaining eleven ADR-0049 tombstones now refuse with their remediation text
  (objectui#6931).
  
  objectui#6105 converted nine tombstones on `StaticTableColumnSchema` to
  `retirementTombstone()`, which writes a guidance string ONCE into both
  author-facing channels — `z.never({ error })` (the parse-time issue message)
  and `.describe()` (generated JSON-Schema and docs). Eleven declarations were
  left on the bare `z.never().optional().describe(...)` spelling and kept
  emitting zod's own `Invalid input: expected never, received string`: which key
  is wrong, nothing about why it was retired or what to write instead.
  
  Five of those eleven sat on `StaticTableColumnSchema` itself, so an author of a
  static-table column read guidance on nine keys and zod's generic on five — a
  shape that teaches the message means something and then withholds it. This
  converts all eleven:
  
  - `StaticTableColumnSchema`: `headerIcon`, `fitContent` (objectui#6424),
    `format`, `options`, `currency` (objectui#6425)
  - `TableSchema`: `hoverable`, `striped` (objectui#5474)
  - `TimelineSchema`: `timeScale` (objectui#6355)
  - `MenuItemSchema`, both union arms: `type` (objectui#6523)
  - `ActionSchema`: `confirm` (objectui#4314) — the key that ESTABLISHED this
    convention, and the last one still answering with zod's generic message
  
  Authoring `timeScale: 'day'` on a timeline now reports `RETIRED
  (objectui#6355) — author scale instead`; authoring the structured `confirm`
  object on an action now reports `RETIRED (objectui#4314) — author confirmText
  instead`.
  
  The accept set is untouched. For every converted member, plus the nine already
  converted and six live-value controls, `safeParse` reports the same `success`,
  the same issue `path`, the same issue `code` (`invalid_type`) and the same
  `expected` (`never`) before and after — only the message differs. Every
  `.description` on the five affected schemas (132 members) is byte-identical:
  `retirementTombstone()` passes the same string `.describe()` already carried.
  
  One nuance for `MenuItemSchema`, which is a union: its top-level issue is
  still zod's own `invalid_union` / `Invalid input` at path `[]`, and the
  converted guidance rides the per-arm issues underneath it. That is a property
  of the union rather than of the tombstone, and it is pinned in the tests so the
  unchanged top-level message is not misread later as a failed conversion.
- b74a859: Declare `wrapperClass` on `CheckboxSchema`, on both faces (objectui#6938 — the
  residue of that card; its `context-menu` half landed with objectui#6939 group 1).
  
  `packages/components/src/renderers/form/checkbox.tsx:36` reads
  `cn("flex items-center space-x-2", schema.wrapperClass)` — classes on the wrapper
  `div` around the box and its label — and neither the TypeScript interface in
  `packages/types/src/form.ts` nor the zod mirror in `zod/form.zod.ts` declared the
  key. It compiled through `BaseSchema`'s index signature and parsed through
  `.passthrough()`, admitted unexamined. The same key, on the same class of read, is
  declared on `FileUploadSchema` and `FilterBuilderSchema` (objectui#6150); the
  checkbox was left out only because its doc page's schema block is a six-line
  summary.
  
  **patch, not minor: the accept set only widens toward what already renders.** The
  key is optional; no document that validated before stops validating. In the value
  dimension the mirror now REFUSES a non-string `wrapperClass` it used to admit
  unexamined — enforcement of the declared type, not a new capability.
- 77cb489: Repair the `object-map` and `object-gantt` mirrors: `objectName` is optional,
  and a refinement requires that at least one of `data`, `staticData`,
  `objectName` is present (objectui#6939, maintainer ruling recorded 2026-09-02 —
  this is one of the eight groups on that card, dispatched as its own PR per the
  ruling).
  
  Both renderers resolve their records from one of three keys, in this order —
  `getDataConfig` in `plugin-map/src/ObjectMap.tsx` and
  `plugin-gantt/src/ObjectGantt.tsx`: `data`, then `staticData`, then
  `objectName`. Both mirrors required `objectName` alone, so a document authored
  on `staticData` drew correctly and was refused by `safeValidateSchema` — six
  catalog entries, three per component.
  
  - **`object-map`** / **`object-gantt`**: `objectName` becomes optional on the
    mirror and on the TypeScript twin in the same stroke, and each member ends in
    `requireRecordSource`, whose issue sits at the root path, carries
    `params.code = 'RECORD_SOURCE_REQUIRED'` and names the three keys an author
    can supply.
  - **`object-gantt`** additionally declares `data` (as `ViewDataSchema`, the
    spelling `object-map` already used): it is the FIRST key that resolver reads
    and was undeclared on both faces, which would have left the refinement naming
    a key the validator had never heard of.
  
  **patch, not minor: the accept set only widens toward what already renders.**
  Every document that validated before still validates — `objectName` alone,
  including an empty one, still parses, because presence is `!== undefined` and
  not the renderer's truthiness. The one shape the refinement refuses (none of
  the three) was refused before too, when `objectName` was required. Documents
  the renderers already draw start validating.
- bfaa158: Repair the `tooltip` and `context-menu` mirrors: declare the keys their renderers
  actually read, and stop requiring the `children` neither of them reads
  (objectui#6939, maintainer ruling recorded 2026-09-02 — this is one of the eight
  groups on that card, dispatched as its own PR per the ruling).
  
  Both members demanded `children` and omitted keys the renderer reads first, so
  `safeValidateSchema` refused two catalog entries that draw correctly:
  
  - **`tooltip`** now declares `trigger`, and `content` / `body` as the two halves of
    one read (`renderers/overlay/tooltip.tsx:28,31` — `renderChildren(schema.trigger)`
    and `schema.content || renderChildren(schema.body)`). The registration's own
    `inputs` list `trigger` / `content` / `body` and never `children`. `trigger`
    follows `HoverCardSchema` two entries below, which is the settled in-repo shape
    for this slot.
  - **`context-menu`** now declares `triggerClassName`, `contentClassName` and
    `modal` (read at `renderers/overlay/context-menu.tsx:87,88,91`), which survived
    only on `BaseSchema.passthrough()`.
  
  **patch, not minor: the accept set only widens toward what already renders.**
  Every key involved is optional, and `children` stays legal — it is `BaseSchema`'s
  own optional key, merely no longer demanded here. No document that validated
  before this change stops validating; documents the renderers already draw start
  validating. The TypeScript twins in `packages/types/src/overlay.ts` move in the
  same stroke, so the published declaration and the published validator keep saying
  the same thing.
  
  ⛔ A tooltip's trigger is authored under `trigger`, never `children`: the catalog
  entry was already moved to `trigger` once on render evidence (objectui#4626 — it
  was a measured blank tile) and moving it back is a known regression.
- 777e5c6: Repair the `tree-view` mirror: `data` is optional, so the `nodes` spelling the
  renderer reads FIRST is a legal document on its own (objectui#6939, maintainer
  ruling recorded 2026-09-02 — this is one of the eight groups on that card,
  dispatched as its own PR per the ruling).
  
  `TreeViewSchema` REQUIRED `data`, the limb the renderer reads THIRD:
  
      const rawNodes = boundData || schema.nodes || schema.data || [];
      // packages/components/src/renderers/data-display/tree-view.tsx:105
  
  The registration's own `inputs` and `defaultProps` spell it `nodes`, and the
  four `components-data-display-tree-view/*` catalog entries ARE those
  `defaultProps` — so `safeValidateSchema` refused every one of them
  (`: Invalid input`) while the renderer drew them correctly. Re-measured on
  `origin/main` at `fe4e7a9e8`: four refusals, and four renders that are
  byte-identical under either spelling (28 / 28 / 12 / 34 elements, same tag
  census, same `textContent` SHA-256). Identical output under the "correction" is
  objectui#6318's own triage test for *the schema was the wrong side*.
  
  **For AUTHORS this widens on both faces.** `data` goes from required to optional
  on the mirror and on the TypeScript twin in the same stroke; nothing that
  validated before validates less, and no document that type-checked as a literal
  stops doing so. A document authored on `data` — such as the tree-view entry in
  `packages/types/examples/data-display-examples.json` — is untouched, and both
  spellings together stay legal.
  
  **For a READER of the TypeScript twin this is a narrowing, and that is the half
  worth stating.** `TreeViewSchema['data']` is now `TreeNode[] | undefined`, so
  code that read `schema.data` and relied on its presence needs a guard and will
  otherwise stop compiling (measured on a consumer probe: exit 0 before, `TS2322`
  plus `TS18048` after). The only in-repo reader already has that guard —
  `renderers/data-display/tree-view.tsx:105` reads
  `boundData || schema.nodes || schema.data || []` — and it type-checks clean, so
  nothing in this repository changes. An out-of-repo consumer that reads the key
  unguarded is the population this paragraph exists for.
  
  Still `patch`: the required-ness was never a guarantee the renderer honoured (it
  reads the key third, behind a default), the accept set only grows, and this is
  the same shape as the two sibling groups of this card that have already landed.
  
  **`data` stays DECLARED rather than being deleted**, and the difference is
  measured rather than assumed: `BaseSchema` already declares `data`
  (`z.any().optional()`; `data?: any` on the TS face), so removing the member
  would not reject the key — it would admit it *unvalidated* while the renderer
  went on reading it. Optional-and-typed is the only shape in which `declared` and
  `enforced` agree for a key that is still read.
  
  **No refinement was added**, deliberately, unlike this card's
  `object-map` / `object-gantt` group. A tree-view carrying no data source at all
  becomes legal here, and that admits no new rendering outcome: `{ data: [] }` was
  already legal and already drew the same empty tree, so an "at least one of
  `nodes` / `data` / `bind`" rule would forbid a spelling of an empty state the
  contract already permits rather than buy a guarantee.
  
  `nodes` and `title` are objectui#6150's declarations and are unchanged; that
  card declared the reads and said in as many words that relaxing `data` was a
  separate accept-set change. This is that change.
- 0c386dd: `DataTableSchema.rowActions` validates as the boolean it has always been declared to be
  (objectui#6940, maintainer ruling 2026-09-02, director seat summon #8, option A).
  
  The hand-written zod mirror in `zod/data-display.zod.ts` declared
  `rowActions: z.array(z.any()).optional()`. Every other face of the same key says
  **boolean**: the TS declaration it mirrors (`rowActions?: boolean`), the renderer's
  destructuring default (`rowActions = false`), its two truthiness gates and two
  `colSpan` arithmetic sites, the registered authoring input
  (`{ type: 'boolean', label: 'Show Row Actions' }`), `defaultProps: { rowActions: true }`,
  and the renderer's own docblock example, which authors `"rowActions": true`. The mirror
  was the single outlier — and the published one, so `safeValidateSchema` refused the
  exact spelling the component's documentation, defaults and authoring UI all teach. Two
  shipped `examples/schema-catalog` entries (`user-table.json`, `full-featured-table.json`)
  failed validation for this and no other reason; both now validate **unchanged**.
  
  **Patch, not minor or major, and the reasoning is the ruling's own:** no author can have
  relied on an array value. The renderer never reads the array — it only truthiness-tests
  the key — so the smallest zod-valid array, `[]`, rendered the actions column identically
  to `true` (objectui#6318 measured both at 42 elements with the `Actions` header present,
  against 39 with the key absent). An array authored here could therefore never have
  carried meaning to any consumer: it either behaved exactly like `true` or, if empty,
  still behaved exactly like `true`. Narrowing it takes away a spelling that was accepted
  but inert, not one anything could have depended on.
  
  A `boolean | array` union was considered and **not** taken: it would permanently accept
  a shape the renderer cannot act on, which is the same second de-facto contract that the
  array spelling already was.
  
  The list view's same-named `rowActions` in `zod/objectql.zod.ts` — `z.array(z.string())`,
  the legacy bare-name action list on `ObjectGridSchema` — is a **different key** that is
  correct as it stands, is in parity with its own TS twin (`rowActions?: string[]`), and is
  not touched.
- ecd9cb2: Wizard view v1, the objectui half (Card R, objectui#6985) — alignment + pins for the
  ruled `type: 'wizard'` tightening (objectstack#13622 D1–D8, maintainer ruling
  2026-08-31; spec half objectstack PR #13733).
  
  The renderer was already aligned: `WizardStepConfig` carries no predicate/collapse
  keys (objectui#6237's ruled split), the wizard route drops-and-reports an authored
  step `visibleWhen`, and `allowSkip` has been navigation-freedom-not-validation-
  exemption since #2959. This card lands the residue:
  
  - **metadata-admin view create seeds one starter step for a wizard** (app-shell
    `anchors.ts`): the create body used to emit `sections: []` for every form type,
    which for `type: 'wizard'` is exactly the shape the tightened spec refuses at
    parse (D7 — a stepless wizard silently rendered as a plain simple form). Same
    seed-the-required-shape move the flow anchor makes for its `type` enum
    (objectui#2326). Other form types keep the bare `[]` — only the wizard variant
    refuses emptiness.
  - **`@object-ui/types` TSDoc states the ruled wizard boundary** where the shared
    section/form types restate the form-view family: `ObjectFormSection.visibleWhen`
    / `collapsible` / `collapsed` name the wizard drop + spec-door refusal;
    `ObjectFormSchema.sections` states sections-ARE-steps and array-order-is-step-
    order; `allowSkip` states the D4 semantics. Type SHAPES are unchanged — the
    spec's own ruled mechanism is a parse-time refinement over the single shared
    section schema (D2 option A), which these types mirror at the type level.
  - **Consumer-side behaviour pins** (`wizardRuledSemantics-6985.test.tsx`): the
    wizard-inert step keys are dropped, never honoured (a denying `visibleWhen`
    does not remove a step; `collapsible`/`collapsed: true` produce no collapse
    affordance, with a positive control on the affordance probe); the empty-steps
    wizard's measured degradation to a simple form is pinned as the shape the spec
    door now refuses (one-step wizards stay legal — no arity floor); array order
    is step order (with a reversed-array control).
  - **Installed-spec door pins** (`wizardSpecDoor-6985.test.ts`), gated on a
    capability probe of the installed `FormViewSchema` rather than a version
    string: the post-Card-S half (refusal messages, prescriptions, the authored-
    `false` collapse boundary, the wizard-scoped control) activates by itself on
    the lockfile bump that brings the tightening in; until then the pre-tightening
    half records the 17.2.x accept-set it measured. `steps:` is pinned refused on
    every spec line.
  
  No teaching material — the #13337/#13086 fence lifts only after both halves land;
  docs changes here are TSDoc/comments only.
- 0e3b3be: Correct three false `@objectstack/spec` alignment claims on field metadata, and pin the
  real boundary (objectui#7014).
  
  **No contract change.** No type, schema, export or runtime path moves. What changes is
  published JSDoc — the text that reaches your editor tooltips through `.d.ts` — which was
  asserting the opposite of what the spec does.
  
  Three doc comments claimed the installed `@objectstack/spec` DECLARES a key that it in
  fact **refuses by name**. Measured on `@objectstack/spec@17.2.0`, each paired with a
  control that accepts the same payload minus the key:
  
  - `SelectOptionMetadata.description` said it "Aligns `@objectstack/spec`
    `SelectOptionSchema.description`". That schema is `.strict()` over exactly
    `{label, value, color, default, visibleWhen}`; `description` fails with
    `unrecognized_keys`.
  - `MarkdownFieldMetadata.rows` and `HtmlFieldMetadata.rows` said `@objectstack/spec`
    `FieldSchema.rows` declares the key "authorable on exactly the multiline editor
    types". `FieldSchema` refuses `rows` by name on all four of
    textarea/markdown/html/richtext.
  
  The keys themselves stay declared and stay consumed — `LookupField` searches an option's
  `description` (objectui#6153) and `RichTextField` reads `rows` (objectui#6140). Only the
  attribution was wrong, and it mattered in a specific way: `FieldSchema` routes a select
  field's `options` through the strict option schema, so authoring `description` on an
  option makes `PUT /api/v1/meta/object/:name` fail the **whole field** with a 422
  `INVALID_METADATA`. The comments were inviting exactly that write. They now say these are
  objectui-side read-model extensions that must never reach authored object metadata.
  
  A new pin (`select-option-spec-extension-7014.test.ts`) asserts the spec's option key set
  and each by-name refusal, so if the spec ever adopts one of these names the claim is
  re-opened loudly instead of silently becoming true.
- c1fe272: Correct `BaseSchema.hidden`'s JSDoc: it hides by NOT RENDERING, exactly as
  `visible: false` does (objectui#7088, maintainer ruling 2026-09-01).
  
  The declaration promised "Controls whether the component is hidden (but still
  rendered) … component is rendered but not visible (visibility: hidden)". The
  renderer has never done that. `visible`, `visibleWhen`, `visibleOn`,
  `visibility`, `hidden` and `hiddenOn` are legs of one `shouldHide` chain in
  `SchemaRenderer`; every leg feeds the same `_hidden` flag, and `_hidden` has
  exactly one consumer — `if (evaluatedSchema._hidden) return null`. No node
  survives for either key, and nothing in the repo emits a `visibility` style. The
  sibling `visible` comment claimed `display: none` on the same false premise and
  is corrected with it.
  
  **Comment-only — no behaviour moves.** The other reading, keeping the node in the
  tree and hiding it visually, was weighed and **declined**: it is a behaviour
  change on a published prop with zero named consumers, so an accessibility or
  animation use-case that wants it reopens the question as its own feature card.
  The JSDoc now records the synonymity as a decision, so the next reader does not
  read "two keys" as "two behaviours", and notes that synonymous in OUTCOME is not
  synonymous in PRECEDENCE — a declared `visible` short-circuits `hidden`, which
  is unchanged and pinned elsewhere.
  
  Why a comment was worth a changeset: the JSDoc is the authority a later docs
  correction is measured against, and this one nearly propagated. While splitting
  the schema-reference `hidden` row, a reader checked it against `base.ts` and
  almost "corrected" the table's "Inverse of `visible`" — the half that describes
  shipped behaviour — toward the declaration. That row is unchanged and stays.
  `SchemaRenderer.hiddenVisibleSynonymy.test.tsx` now pins the claim the comment
  makes: the two keys produce the same rendered output, and `hidden: true` leaves
  no node that could carry a `visibility` style.
- 858cd72: Declare `avatar` and `avatarFallback` on `ChatMessage`, on both faces
  (objectui#7295 — the residue of objectui#4424, whose `RuntimeOnlyMessageKeys`
  named only the three keys API mode lifts out of the stream, never the two a
  human author writes by hand).
  
  `packages/plugin-chatbot/src/index.tsx:173–178` reads
  `message.avatar || userAvatarUrl` and
  `message.avatarFallback || userAvatarFallback` (and the assistant twins), the
  authoring-to-runtime seam spreads every unlisted key through
  (`chatMessageAdapter.ts`, `...passthrough`), and the SDUI renderer feeds the
  authored `messages[]` straight in — a per-message avatar override renders, is
  documented, and no authoring-facing type declared it. `ChatMessage` in
  `packages/types/src/complex.ts` has no index signature (objectui#5155,
  deliberately — none is added here), so an author annotating
  `ChatbotSchema.messages` was told a value that renders is an error (TS2353); the
  zod mirror `ChatMessageSchema` is a plain strip-mode `z.object`, so the value
  parsed green and was silently DROPPED from the parsed output.
  
  **patch, not minor: the accept set only widens toward what already renders.**
  Both keys are optional; no document that validated before stops validating, and
  no TypeScript value that compiled before stops compiling. Two verdicts move,
  both measured on `446d93d` before the change and both toward the renderer's
  behaviour:
  
  - The mirror now KEEPS an authored `avatar` / `avatarFallback` through
    `ChatMessageSchema`, `ChatbotSchema` and `safeValidateSchema` — it stripped
    them before. A consumer that renders the PARSED document (none in this
    repository does; the renderer receives the authored one) sees the override for
    the first time.
  - The mirror now REFUSES a non-string value at the key (`avatar: 42` was
    admitted-and-stripped before) — enforcement of the declared type, not a new
    capability.
  
  Same precedent as `CheckboxSchema.wrapperClass` (objectui#6938) and the
  objectui#6150 batch. `RuntimeOnlyMessageKeys` in `plugin-chatbot` is untouched;
  `SeamChatMessage` inherits the two keys through its `ChatMessage` half. The
  three example blocks on `content/docs/plugins/plugin-chatbot.mdx` that PR #7294
  left unannotated (`supportChat`, `salesBot`, `multiAgentChat`) are annotated
  `ChatbotSchema` again.
- 9587fc9: `ClassNameStylePropsSchema` describes itself by its two keys (objectui#7578).
  
  The schema's `.describe()` text changes from `Style properties` to
  `className and inline style`. **This is published runtime metadata, not a
  comment**: on this package `.describe()` is what lands in the generated
  JSON-Schema `description` field and in the derived docs, so a consumer that
  renders or diffs those will see the new string. The object itself is unchanged —
  same two optional keys (`className`, `style`), same accept set, same types, same
  export name; nothing validates differently.
  
  Why it moved. objectui#5928 renamed the const away from `StyleProps`, because
  the like-named TypeScript `StyleProps` is the Tailwind-scale vocabulary
  (`padding`, `margin`, `gap`, `backgroundColor`, ...) and shares zero keys with
  these two. That rename only reached readers who can see the const name; the
  description still said what the retired name said, so a reader who meets this
  schema through generated JSON-Schema or docs was left hunting `padding` or `gap`
  under a label that promised them. Naming the two keys ends that at the one place
  that reader actually sees.
  
  The new text uses the verbatim key spellings, so the label answers "what is in
  here" with names the reader can act on. Pinned in
  `packages/types/src/__tests__/classname-style-describe-7578.test.ts`, read off
  the live schema exported by the published `@object-ui/types/zod` barrel.
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
- 4f9f1ee: Two of the ten `z.lazy` exports in the zod node face now memoise their getter, so their
  public `.unwrap()` compares by identity (objectui#7918). The other eight are **deliberately
  unchanged** — measured, memoising them is a module-load `ReferenceError`.
  
  The card that found this did not claim the ten were wrong. It asked whether the spelling was
  buying a temporal-dead-zone dodge, and that check is what shipped. Each of the ten was
  rewritten in place to `const inner = <body>; z.lazy(() => inner)`, the package rebuilt, and
  the built barrel imported in a fresh process. **Eight refuse to load.** Seven name the very
  const being declared (`children: z.array(TreeNodeSchema)` sits inside `TreeNodeSchema`'s own
  initialiser); `SchemaNodeSchema` names `BaseSchemaCore`, which `base.zod.ts` declares below
  it. For those eight the `z.lazy` is load-bearing, so `ActionSchema`, `AppMenuItemSchema`,
  `FilterGroupSchema`, `MenuItemSchema`, `NavLinkSchema`, `NavigationMenuItemSchema`,
  `SchemaNodeSchema` and `TreeNodeSchema` keep the spelling they have. The two that loaded
  clean are memoised: `FilterBuilderConditionSchema` is not recursive at all, and
  `NavigationItemSchema` already defers its self-reference through an inner
  `z.lazy(() => NavigationItemSchema)` on `children`.
  
  ⚠️ Two corrections to the finding, both measured, both worth more than the edit:
  
  **The recursion point was already identity-comparable, through the right handle.**
  `zod@4.4.3` caches a lazy's resolved inner type on `def._cachedInner` — its own comment says
  this preserves "identity for cycle detection on recursive schemas" — and `S._zod.innerType`
  reads that cache. It is stable for all ten, including the eight, and survives `.describe()`
  clones. What is *not* stable is `S.unwrap()`, because `ZodLazy` defines it as
  `() => inst._zod.def.getter()`, going around the cache (`ZodPromise` spells its own as a
  stored field). So a schema walker can recognise the recursion point today by reading
  `_zod.innerType`; the objectui#7581 false negative — `ActionSchema` reported "not exported by
  name" when it plainly is — was the wrong handle, not an unrecognisable schema. Memoising is
  still worth doing where it is free, because it makes the public `.unwrap()` honest.
  
  **The "rebuilt on every parse" cost does not exist.** The finding recorded, explicitly
  unmeasured, that a document with N nodes reconstructs the recursive sub-schema N times. It
  does not: the getter runs **once per lazy for the life of the process**, via the same
  `_cachedInner` — measured at one call during the first parse of a 13-node document and zero
  during the second. Wall clock agrees. `NavigationItemSchema` over a 73-node document,
  memoised versus not, medians of nine trials of 200 parses: 149,973 ns versus 140,293 ns per
  parse — ratio 0.94x, with the ranges overlapping. Those are shared-box seconds, so the
  absolutes are not idle-machine figures; the ratio is the reading, and the reading is "no
  difference". There is no parse-time win here, and anyone pricing the strict face
  (objectui#7935 / objectstack#5250) should strike this from the input list.
  
  No accept/reject behaviour moves — a memoised getter changes schema *identity*, not what is
  declared or admitted. The measurement, the eight `ReferenceError` messages, the identity
  matrix and an executable reproduction of both the TDZ mechanism and the once-per-process
  getter are pinned in `packages/types/src/__tests__/zod-lazy-getter-identity-7918.test.ts`.
  
  ⚠️ Also settled while locating the ten: `AppMenuItemSchema` has no declaration of its own —
  it is the barrel alias of `app.zod.ts`'s `MenuItemSchema`, while the barrel's own
  `MenuItemSchema` is `overlay.zod.ts`'s. Two different schemas, so the list really is ten
  entries and not nine.
- 100547e: `objectui validate` now refuses a form field whose widget id names a namespace
  other than `field:`, matching the verdict `@object-ui/core`'s `validateSchema`
  has given since objectui#5375 (objectui#5449).
  
  The CLI reaches `FormFieldSchema` through `safeValidateSchema`, and that schema
  declared `type` and `widget` as bare optional strings — so a field typed
  `ui:password` validated clean while the runtime validator rejected the same
  document with `UNRESOLVABLE_FIELD_WIDGET_NAMESPACE`. The CLI is the surface an
  author actually runs before shipping, so it was the one handing out the false
  green: an author did exactly the diligence objectui#5375 asks for and still
  shipped metadata that renders a secret into a plain text box.
  
  A `superRefine` on `FormFieldSchema` now states the rule, mirroring core's
  precedence (`widget` before `type`), the key it blames, its error code and its
  message verbatim, so the two entry points cannot describe one defect two ways.
  
  **This rejects documents that previously validated.** Only colon-qualified
  field widget ids outside the `field:` namespace are affected — `field:`-prefixed
  ids and bare names such as `password` still pass, registered or not. A field
  carrying, say, `type: 'ui:password'` must be rewritten as `password` or
  `field:password`; it never rendered as a password box in any case.
  
  Which of the repo's authoring-time validators is canonical remains open
  (objectui#4631) — this states the rule on the zod side rather than unifying
  them.
- 0e05aac: The console's cold load no longer asks `/api/v1/runtime/config` or
  `/auth/me/localization` twice (objectui#5544).
  
  Two pairs of boot callers were racing each other for the same URL, with no shared
  provider between them, so no guard inside either component could see the other:
  
  - `GET /api/v1/runtime/config` — the pre-React branding script inlined in
    `apps/console/index.html` (it runs during HTML parse so the tab title and
    favicon are the operator's before the bundle is fetched) and
    `initRuntimeConfig()`. Measured ×2 on prod and on staging. This is the
    expensive one: the console `await`s `initRuntimeConfig()` before
    `createRoot().render()`, so the duplicate sat on the critical path to first
    paint, and at the control plane's ~0.5–1.4 s for this endpoint it also pushed
    boot concurrency further past the server's pool knee.
  - `GET /api/v1/auth/me/localization` — `seedTenantLanguage()` on a device's true
    first visit and `LocalizationFetchProvider` on every boot. The seed keeps
    running past its 500 ms race by design and the provider mounts the moment that
    race resolves, so on a first visit the two overlap. Measured ×2 on staging.
  
  `@object-ui/types` gains `sharedGetJson()`: callers that ask for the same GET
  while one is already in flight join that request instead of starting another. It
  shares the in-flight promise and nothing else — the entry is deleted the instant
  the request settles, so there is no cache, no TTL and no stale window, and a
  caller arriving after settle fetches fresh exactly as before. Rejections fan out
  to every sharer with the status intact (`LocalizationFetchProvider`'s retry
  policy still sees its own 503), each caller receives its own copy of the parsed
  body, and only GETs are eligible — a non-GET is refused rather than quietly
  rewritten.
  
  Requests that differ in credentials mode or headers keep separate identities, so
  the console's two deliberate `auth/get-session` calls — one Bearer-only with the
  cookie omitted to detect a stale token, then one through the cookie — stay two
  requests. Collapsing those would have destroyed the signal the first one exists
  to read.
  
  No component receives anything different: same payloads, same errors, one fewer
  round trip.
- f9e4f91: `DashboardComponentSchema.dateRange.defaultRange` is now bound to
  `DateRangeDefaultRange` from `@objectstack/spec/ui` instead of restating it as a
  hand-written 14-member union (objectui#4984).
  
  The union was byte-faithful to the spec — all 14 members, same order — so nothing
  a user hits changes today. What was missing is the tie that keeps it faithful:
  `resolveDashboardFilterDefs` takes `Pick<DashboardComponentSchema, 'globalFilters' |
  'dateRange'>`, so this union is what typechecks every TS-constructed dashboard, and
  a preset the spec ADDS would have been a legal document that objectui's own types
  said could not exist — the "narrower than the contract it implements" shape whose
  consequence in objectui#4163 was that the bad reads were invisible to `tsc`.
  
  No gate reported it: `check:spec-symbols` rule 1 matches by NAME and an inline union
  on an interface member has no symbol to collide with, while rule 2's claim heuristic
  was waved through by the `SpecGlobalFilter` reference a few lines above. Binding makes
  the file's existing "Aligned with @objectstack/spec" comment structural rather than
  prose.
  
  The emitted `.d.ts` collapses the inline union to the imported alias; the published
  type surface is unchanged — measured with the TypeScript checker over the emitted
  declarations (679 reachable exports from `dist/index.d.ts`, 22 from `dist/complex.d.ts`,
  and `defaultRange` resolving to the same 14 string-literal members before and after).
- 4e8622b: `ActionParam`'s doc block no longer claims that spec 17 narrowed `I18nLabel` to a
  plain string (objectui#4611).
  
  The paragraph explaining why `label` / `options[].label` are inherited rather than
  locally overridden justified itself with a claim about `@objectstack/spec` that was
  never true: "in spec 17 `I18nLabelSchema` is `z.ZodString` — inline per-locale objects
  were dropped in favour of translation files". Measured against the installed GA pin
  `@objectstack/spec@17.0.0` (`dist/ui/index.d.ts:614`), `I18nLabelSchema` is a union of
  a string and a string-to-string record, and the schema's own doc block states two
  authorized forms with "Both are real; neither is deprecated by this schema". Executed
  against `dist/ui/index.mjs`: plain string accepted, inline locale map accepted,
  `{ key, defaultValue }` rejected. A reader who believed the comment would have taken a
  widening to `string | I18nLabel` for a no-op — which is what the finding recorded, one
  seat having nearly done exactly that.
  
  The replacement describes what `I18nLabel` admits and cites the spec's own doc block
  rather than restating a zod expression; where today's spelling is named it is scoped as
  a measurement against 17.0.0 with its file and line, so it ages as a reading rather than
  as a standing fact. The decision itself is unchanged and never depended on the false
  premise — `label` flows in by reference through the spec's schema, and a local
  `string | I18nLabel` collapses to `I18nLabel` whichever forms the union holds.
  
  Documentation only, and the release-visible surface is the declaration file: measured
  with the package's real `tsc` build (`removeComments: false`, per `tsconfig.base.json`),
  108 emitted files on both sides, `dist/ui-action.d.ts` 29,176 → 31,026 bytes, and every
  other file byte-identical — including `dist/ui-action.js` (3,480 bytes, unchanged sha),
  because the comment documents an `interface`, which is erased at emit along with its
  leading comment. No behaviour changes; hover text and the shipped `.d.ts` do.
- dffd752: The `I18nLabel` "inverted pin" now watches the premise it claims to watch, and
  `ui-action.ts` no longer imports a symbol it never uses (objectui#5612, objectui#5613).
  
  Both are residue of the same removed local `label` / `options[].label` override.
  
  The `it(...)` case in `packages/types/src/__tests__/page-nav-misc-spec-parity.test.ts`
  that called itself an inverted pin on the spec's `I18nLabel` rested on one assertion,
  `const label: SpecI18nLabel = 'Priority'`, under a comment claiming spec 17 had narrowed
  `I18nLabel` to a plain string and that a re-widening would stop it compiling. A plain
  string is assignable under the narrow shape *and* under the wide one, so that assignment
  could only ever fail if the plain-string form were removed — the opposite of the event it
  was written to catch. The widening had already landed: `@objectstack/spec@17.0.0`
  declares `I18nLabelSchema` as a union of a string and a string-to-string record
  (`dist/ui/index.d.ts:614`), and the pin stayed green through it. It reported protection
  it did not provide, and asserted a false premise in its own name.
  
  It is retargeted at what actually holds the decision up — not which single form the spec
  has, but that **both** authorized forms stay assignable, on the spec type and on the
  inherited `ActionParam['label']` and `options[].label`. It now fails when either form is
  withdrawn, and deliberately does not fail on a further widening, since inheriting by
  reference is exactly what stays correct as the authorized set moves. The comment is
  rewritten against the schema's own doc block (two authorized forms, "Both are real;
  neither is deprecated by this schema") instead of the false premise. Verified by
  construction: against a locally built narrow `type I18nLabel = string` the new assertions
  fail with `TS2344` and `TS2322`, where the old assignment compiles clean under both
  shapes.
  
  `ui-action.ts`'s `I18nLabel` type import is deleted — no type position had used it since
  the override was removed, and nothing re-exported it — and the doc paragraph that
  recorded the pin as `NOT guarded` is corrected, since the same change makes it a guard.
  
  No behaviour changes; the release-visible surface is the declaration file. Measured with
  the package's real `tsc` build, both legs building from a cleared `dist/` and cleared
  composite build info: 108 emitted files on both sides, exactly one differing —
  `dist/ui-action.d.ts`, 31,026 → 31,117 bytes, JSDoc prose only, no declaration changed.
  Every other file is byte-identical, including `dist/ui-action.js` (3,480 bytes, unchanged
  sha), because the comment documents an `interface`, which is erased at emit along with
  its leading comment. The deleted type import contributes no emitted delta at all, and the
  rewritten test file is not part of the build.
- 689b979: Add `editable` to the rich `TableColumnSchema` zod mirror. The `TableColumn` interface declares `editable?: boolean` and `data-table` honours it, but the mirror omitted the key, so a non-strict parse silently stripped it — and since the renderer treats absence as `true`, a column an author locked with `editable: false` came out of validation editable again. Columns locked with `editable: false` now stay locked through any pipeline that parses metadata via `@object-ui/types/zod` (including the CLI `validate` route).
- e546222: The published `@default` documentation on two `layout.ts` members now matches the value the renderer actually applies. `ContainerSchema.maxWidth` documented `'lg'` while `container.tsx` applies `schema.maxWidth ?? 'xl'`, and the shared `FlexLayoutProps.align` documented `'center'` while `flex.tsx` applies `schema.align || 'start'` and `stack.tsx` applies `schema.align || 'stretch'`. The renderers are unchanged — they are the authority for what runs — so only the docblocks moved; `align` now states both consumers in prose instead of carrying a single `@default`, because one member shared by two deliberately divergent component types cannot have one correct default.
- fd13f52: The published `@default` documentation on `FlexLayoutProps.direction` no longer states a value that only one of its two consumers applies. The member is declared once (objectui#6151) but `flex.tsx` reads `schema.direction || 'row'` while `stack.tsx` reads `schema.direction || 'col'` ("Default to column for Stack"), so the single `@default 'row'` was correct for `flex` and wrong for `stack` — whose own `defaultProps.direction` is `'col'`. The renderers are unchanged — they are the authority for what runs — so only the docblock moved: `direction` now names both consumers in prose, the same remedy objectui#7361 applied to the sibling `align`. `justify` is shared by the same two consumers and both read `|| 'start'`, so its tag is correct and stays: the criterion is a DIVERGENT shared member, not a shared one.
- 0fce2ef: `maxToolRoundtrips` on `ChatbotSchema` is deprecated: it is inert, and an author
  who sets it is now told so instead of being left believing the documented cap
  applies (objectui#5605).
  
  The key was declared authorable in `@object-ui/types` (interface and zod, with a
  description), threaded from the authored document through the chatbot renderer at
  three call sites, accepted by `useObjectChat`, given a default — and then dropped.
  Measuring the installed chat runtime says it cannot be honoured from here rather
  than that someone forgot to wire it: `@ai-sdk/react`'s `useChat` takes `ChatInit`
  plus throttle/resume, and `ChatInit` declares exactly one loop control — the
  boolean predicate `sendAutomaticallyWhen` — and no numeric cap under any
  spelling. The numeric knob was removed from `useChat` in a major, and its
  successor was renamed through `continueUntil` to `stopWhen` / `stepCountIs`,
  which the installed `ai` package declares only on `generateText`, `streamText`
  and the tool-loop agent settings — all server-side. ObjectUI is backend-agnostic,
  so it owns no server loop to cap either, and putting the number in the request
  body would only move the same dead key one hop onto a wire contract no backend
  reads.
  
  This is stage one of a two-stage retirement, so nothing an author already wrote
  breaks: the key still parses, still carries its declared shape, and the renderer
  still threads it. What changes is that it is now marked `@deprecated` in the
  interface, the zod description and the docs, and that authoring it logs a
  one-time notice naming the knob that does work — `planning.maxIterations` on the
  agent. A follow-up removes the declaration once this deprecation has shipped in a
  release.
- a691c0b: `PageSchema.kind`'s TSDoc names the real per-tier styling primitive for source-authored pages instead of the "HTML + Tailwind" framing ADR-0080's own amendment retracted.
  
  This is a published type surface: the TSDoc ships in `@object-ui/types`'s built
  `.d.ts` and is what an author reads on hover over `kind`. It said a `kind:'html'`
  page is "constrained JSX/HTML + Tailwind" — and it links
  `content/docs/guide/react-pages.md`, which objectui#5413 has already corrected to
  say the opposite. Shipped type documentation was contradicting the guide it points
  readers to.
  
  ADR-0080's header amendment (2026-06-30, under ADR-0065, Accepted) supersedes that
  framing on styling: a page's `source` is *runtime metadata*, the console's Tailwind
  is compiled at build time by scanning the console's own `src`, and there is no
  safelist — so an authored utility class produces CSS only by coincidence, when
  objectui already ships that exact class, and otherwise produces nothing with no
  error anywhere. That is the ADR-0065 failure mode verbatim ("works only by
  coincidence"), and it is how a modal's `bg-black/50` backdrop reached production
  fully transparent.
  
  The tiers themselves are unchanged, and every load-bearing claim in the TSDoc
  survives verbatim — parse-never-execute and untrusted-author safety for `html`,
  the deprecated `'jsx'` alias, EVALUATED-in-the-main-tree with no sandbox behind the
  `react-pages` host capability for `react`, the ADR-0080 citation and the guide
  link. Only the styling conclusion changes, to the primitive each tier actually has:
  
  | `kind` | Style with |
  |---|---|
  | `"html"` | The blocks' own structured props (`` `<flex direction gap>` ``, `` `<grid columns>` ``) plus a JSON `style` object. |
  | `"react"` | Inline `style` objects. |
  
  Colors on both tiers come from the theme as `hsl(var(--token))`, so a page follows
  light/dark and whatever theme the deployment installs. The TSDoc now also names the
  rule that reports a violation — `page-source-className-tailwind`, shipped in
  `@objectstack/lint@11.5.0` as `validatePageSourceStyling` and reported by
  `os validate` as a warning on both tiers.
  
  No behaviour change, and the accepted `kind` set is untouched.
  
  `packages/components/src/renderers/layout/react-page.tsx` carries the same
  correction on its two source comments (the injected-scope note and
  `buildComponentScope`), and gains the styling note the file was missing. Those are
  internal comments — they do not project into any `.d.ts` and change no export — so
  they get no entry of their own; there is nothing an `@object-ui/components`
  consumer could read in a CHANGELOG and act on.
- 515f171: `PluginComponentInput` is deprecated in favour of `ComponentInput` (objectui#5674).
  
  This is stage 1 of a two-stage retirement the maintainer ruled on 2026-08-22: deprecate
  for a release, then remove. Nothing is removed here — the export still exists and still
  names the same type.
  
  `@object-ui/types`' entry point publishes `ComponentInput as PluginComponentInput`. Until
  objectui#4972 that alias pointed at a genuinely different declaration: `plugin-scope.ts`
  restated its own nine-key `ComponentInput`. objectui#5671 converged that declaration onto
  `base.ts`, so the alias became a second published name for the *same* type, carrying no
  information the first does not. Two published names for one type is a shape that costs
  readers a step and gives AI-authored code a coin-flip between spellings.
  
  **Why a deprecation window rather than a deletion.** The measurement that licenses
  deleting an export from a published package is *"no importer"*, and what can be measured
  from inside this repository is only *"no importer here"*. In-repo the name has zero
  importers — searched across every root (`packages/`, `apps/`, `content/`, `docs/`,
  `skills/`, `examples/`, `e2e/`, `scripts/`, and the root docs), plus the sibling framework
  repository, with a control name searched identically so a broken search could not read as
  a clean one; the only occurrences are the alias itself and prose about it. What no search
  here can see is a consumer on npm. The deprecation window is the answer to that
  unmeasurable half: it converts a silent break into a warned one before the removal lands.
  
  **Reversibility, deliberately.** Deprecating is undoable; deleting a published export is
  not. Where the evidence is one-sided, the retirement takes the reversible step first.
  
  The tag reaches consumers rather than only the source: a JSDoc block on an export
  specifier survives declaration emit and lands attached to that specifier in the emitted
  `index.d.ts`, which was measured for this change rather than assumed. With comments
  stripped, the emitted entry point is byte-identical before and after — the published
  *type* surface does not move, it only gains the notice.
  
  Stage 2 (removing the alias, and the now-dead re-export in `plugin-scope.ts` that exists
  only to feed it) is filed as a follow-up and ships as a `minor`, per this repo's policy
  that its own breaking changes never declare `major`.
- 3c73d99: Corrects the `@deprecated` prescription on `UniquenessValidation` in
  `packages/types/src/data-protocol.ts`, which pointed authors at spellings the platform
  no longer accepts (objectui#4765).
  
  Comment-only — no runtime behaviour changes. `patch` rather than an empty frontmatter
  because the JSDoc sits on an **exported** declaration and therefore ships to consumers:
  measured with the package's own build (`tsc`, and `tsconfig.base.json` deliberately sets
  `removeComments: false`), `dist/data-protocol.d.ts` goes 40218 → 41781 bytes and the new
  prose is present in the emitted `.d.ts`. What a consumer reads on hover changes, so it
  is declared. The emitted `dist/data-protocol.js` is byte-identical (sha256
  `a3de34c5…`, 207 bytes both ways) — that file is a types-only module whose entire JS
  output is the license banner plus `export {}`, so a comment on an erased `interface`
  reaches the declaration file and nothing else.
  
  Two of the three spellings it prescribed were wrong, measured against the installed
  `@objectstack/spec@17.0.0` (the report was written against `17.0.0-rc.6`):
  
  - **`indexes[].partial`** was retired in spec 17.0.0 under ADR-0049. It is a tombstone
    (`z.never()`) that the parse rejects at any value, so "`partial` for a scoped
    constraint" named a key that cannot be declared. A predicated unique constraint is
    built at the database layer by a runtime migration issuing
    `CREATE UNIQUE INDEX … WHERE`; the prescription now says so.
  - **`{ fields, unique: true }`** on `ObjectSchema.indexes` is the deprecated positional
    spelling of `unique: 'global'` under ADR-0120 — lint `unique/unscoped-declared-index`
    warns in 17.x and protocol 18 rejects it. The prescription now states the scope:
    `unique: 'global' | 'organization'`.
  
  The measurement also refined the report, and the refinement is the reason the rewrite is
  not a uniform find-and-replace. The third spelling — **field-level** `unique: true` — is
  NOT deprecated. `unique` is scope vocabulary shared by two surfaces on which the same
  bare `true` means different things: at index level it stays verbatim (`isGlobalUnique`
  and `isOrganizationUnique` both return `false`), which is why it is the positional
  spelling of `'global'` and is being retired; at field level it is the positional spelling
  of `'organization'` and, in the spec's own words, "stays valid indefinitely … no trap".
  Rewriting both occurrences the same way would have replaced one piece of false guidance
  with another, so the comment now names the per-surface difference explicitly.
  
  The interface's own deprecation is untouched and remains correct: `ValidationRuleSchema`
  rejects `type: 'unique'` at the discriminator (accepted discriminants are `script`,
  `state_machine`, `format`, `cross_field`, `json_schema`, `conditional`), so a rule in
  this shape cannot reach the server.
  
  The replacement closes with what would falsify it — `UniqueScopeSchema` and
  `IndexSchema` in `@objectstack/spec` — so the next reader checks the schemas rather than
  trusting the paragraph. This is the fourth piece of false guidance found in this
  campaign (strictness ledger finding 18), and prose that cannot be checked is how the
  first three survived.
- 1170ed1: `WidgetInput.type` now uses the shared arm vocabulary `ComponentInputControlType`
  instead of restating its eleven literals inline (objectui#5675).
  
  That vocabulary has had a name since objectui#3832, and objectui#4972 converged the
  last structural copy of the surrounding `ComponentInput` interface onto one
  declaration. `WidgetInput` was the remaining site spelling the arms out — a third
  copy of one list, with nothing tying it to the other two.
  
  **No value a widget author may write changes.** The inline restatement was measured
  member-equal to the shared declaration in both directions before it was replaced
  (eleven arms each, same set, and in the same order), so this is a convergence rather
  than a widening or a narrowing. `WidgetInput.type` also stays the SINGLE-kind form:
  `ComponentInput.type` additionally accepts an array of arms for a union-typed key
  (objectui#3832), and importing that capability here would have been a widening, so
  it was deliberately left out — the same disposition objectui#4972 recorded when it
  left this face alone.
  
  What the convergence buys is that one of the two drift directions was **silent**.
  `WidgetRegistry.load()` in `@object-ui/core` translates each `WidgetInput` into a
  `ComponentInput` and passes `type` straight through, so an arm REMOVED from the
  shared vocabulary would have broken that assignment loudly at compile time — but an
  arm ADDED to it produced no error anywhere. Widget authoring would just have stayed
  narrower than component registration, with nothing in the tree saying so. After this
  change neither direction is expressible.
  
  The pin is source-text, deliberately: a TS type alias erases at runtime, so a
  member-identical restatement is indistinguishable from the derived type by any
  assignability or runtime check. Both kinds of assertion are kept in
  `__tests__/widget-input-control-vocabulary.test.ts`, and the ablation showing the
  value assertions stay green on the defect while the identity pin turns red is quoted
  in the PR body.
  
  Two divergences between `WidgetInput` and `ComponentInput` are deliberately **not**
  repaired here, and are now recorded in `WidgetInput`'s doc block instead of living
  only in a closed card's body: the enum slot is spelled `options` on one face and
  `enum` on the other (adapted at the `WidgetRegistry` seam, so nothing fails to
  arrive), and `ComponentInput` carries five keys — `inputType`, `min`, `max`, `step`,
  `placeholder` — that a widget manifest cannot express. Both are surface questions
  about published keys and are raised on objectui#5675 rather than answered by this
  change.

## 17.6.0

### Minor Changes

- 88085e3: Consume the declared nav `runAction` slot; retire the private `?runAction=` string convention
  
  An `object` navigation item can now declare `runAction: '<actionName>'` and the shell will run that action once on arrival at the object's list surface, through the ordinary execute path — so param dialogs, confirms and entitlement gates all still apply. The slot is `@objectstack/spec`'s `ObjectNavItemSchema.runAction`; objectui now reads it instead of a private convention.
  
  - `NavigationItem` declares `runAction` (derived from the spec's object-nav variant), and objectui's own nav schema stops stripping it — `objectui validate` previously discarded the key, so an entry carrying a deep link validated clean with the deep link thrown away.
  - `resolveHref` encodes it onto the list href as the reserved `?runAction=` param, on the list landings only. A `recordId` entry resolves to a record page, which has no list toolbar to answer it, so the slot is not encoded there.
  - The deep link is honoured on **every** object list, not just the environments list. The action is armed only when it is actually present at `list_toolbar`; a name no action answers to runs nothing and deliberately leaves the URL untouched, so a later mount with fresher metadata can still honour it. Undefined references are rejected upstream at authoring time by `defineStack`.
  - The param name now has exactly one definition (`NAV_RUN_ACTION_PARAM`, exported from `@object-ui/layout`) and is registered in the console's reserved-param collision check. It was previously a bare literal hand-written at both the producing and consuming ends, declared by no schema and listed in no registry.
  - `CloudOnboardingNext` takes an optional `properties.createAction` (defaulting to `create_environment`) instead of hand-concatenating its deep link.
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
- 1184192: Align `FieldConstraintsSchema` (the zod face of `FormFieldSchema.validation`) to the public TS contract `FieldValidationRules`. Behaviour change in `objectui validate`: `validation` written to the TS contract — `required: string | boolean`, `minLength`/`maxLength`/`min`/`max` as `{ value, message }` objects, `validate` function — is now accepted (it was rejected before), and the flat scalar dialect (`minLength: 3`, `pattern: '^[a-z]+$'`) that react-hook-form never runs is now rejected (it passed before, validating nothing — the objectui#5099 symptom on the zod face). `pattern.value` must be a compiled RegExp per the objectui#5099 ruling; JSON/YAML cannot express one, so a string `pattern.value` is rejected by name with guidance toward the metadata route (`FieldSchema.pattern`). No silent strip, no string-to-RegExp coercion.
- a2a9747: `FieldValidationRules.pattern.value` narrows to `RegExp`, and the form renderer reports unrecognized validation rule names loudly (objectui#5099, maintainer ruling 2026-08-18).
  
  **BREAKING for hand-written form schemas — deliberately declared `minor`.** This
  repo's version policy reserves `major` for tracking `@objectstack` majors and is
  mechanically enforced (`scripts/check-changeset-no-major.mjs`); per that policy,
  objectui's own breaking changes ship as `minor` with the breaking semantics
  stated plainly here:
  
  - **What breaks:** `validation: { pattern: { value: '^…$', message } }` with a
    **string** value no longer compiles. Write a `RegExp` literal instead:
    `pattern: { value: /^…$/, message }`.
  - **Why red is the fix, not the damage:** react-hook-form applies `pattern`
    only when `value instanceof RegExp`, and the renderer's single read point
    spreads `validation` verbatim — so every string pattern accepted by the old
    type ran **zero** validations, silently. Callers turning red were not
    validating anything yesterday; the error converts silent non-validation into
    explicit failure at authoring time.
  - **Unaffected:** the metadata route. `FieldSchema.pattern` (a string in field
    metadata) is still compiled by `buildValidationRules` in `@object-ui/fields`
    via `new RegExp(...)` before it reaches the renderer.
  
  Also, per the same ruling's second limb, the form renderer now reports rule
  names react-hook-form does not run (`console.error`, message doubles as the fix
  instruction): a misspelled `minlength`, an invented `email`, or numeric keys
  left by spreading an array into `validation` shout instead of vanishing. The
  recognized set is pinned against the installed react-hook-form bundle so a
  future bump cannot silently rot the diagnostic. The ruling's rejected half is
  equally binding and equally pinned by test: the read point does **not** compile
  string patterns — that consumer-side tolerance would harden the ambiguous
  declaration into contract (AGENTS.md #0.1).
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
- 578e025: `ObjectMapSchema` declares what ObjectMap reads, and the `map` block outranks the flat spelling
  
  `object-map` carried three disagreeing shapes for one component. The declared face
  (`ObjectMapSchema`) had four keys — `type`, `objectName`, `locationField`,
  `titleField`, `mapStyle`. The renderer read about fifteen. And `ObjectMapProps.schema`
  was typed `ObjectGridSchema`, so every map-specific read went through
  `(schema as any)`. A TypeScript author could not write the `map` block the docs teach,
  and misspelling `latitudeField` as `latitudeFieId` was caught by nothing: the map
  rendered empty and looked like bad data.
  
  Declared now, each with a read site in `ObjectMap.tsx`: `data`, `staticData`, `filter`,
  `sort`, `map`, `enableClustering`, `navigation`. `ObjectMapConfig` (interface) and
  `ObjectMapConfigSchema` (zod) are lifted out of `plugin-map`, where the zod was
  package-private and called `MapConfigSchema`, into `@object-ui/types` and
  `@object-ui/types/zod` — so the declared authoring face and the validation the renderer
  performs are one schema rather than two that can drift. The `Object` prefix is not
  decoration: `@objectstack/spec/automation` already exports `MapConfigSchema` for an
  unrelated concept, and a local declaration under a spec export's name is what
  `check:spec-symbols` exists to refuse. `ObjectMapProps.schema` is `ObjectMapSchema`, and the `as any` map reads
  are gone.
  
  Behavior change, ruled by the maintainer on objectui#5018 (2026-08-17): the `map` block
  is the author face and the flat top-level spelling (`schema.latitudeField`, …) is the
  internal form ObjectView / ListView produce when they flatten `options.map`. When a
  schema carries both, **the `map` block now wins** — the reverse of the previous order,
  under which the flatten product silently shadowed an authored block — and a dev-mode
  warning names the top-level keys that were ignored. The flat spelling stays out of the
  declared surface and out of the docs.
  
  Nothing changes for views built by ObjectView / ListView: both flatteners emit the flat
  keys and no `map` key at all, so the branch the flip reorders is never reached for their
  output. That property is now pinned rather than assumed
  (`plugin-view/src/__tests__/ObjectView.mapFlatten.test.tsx`).
  
  Bound worth stating, because it limits what the typed surface can promise: `BaseSchema`
  carries an index signature (`[key: string]: any`), so a misspelled key at the TOP level
  still type-checks — for every component schema in the repo. The `map` BLOCK is closed,
  which is what makes the card's headline typo a compile error.
- 97abb24: Remove `BaseFieldMetadata.indexed` — the ObjectStack spec has no field-level
  index flag
  
  `indexed` was never a `FieldSchema` key. The field-level flag built no index
  (objectstack#2377 removed it) and, since objectstack#4001 replaced silent
  drops with loud rejection, `FieldSchema.safeParse` refuses it by name. PR
  #4675 already removed the designer-side declaration
  (`DesignerFieldDefinition.indexed`) and retired the Studio control that wrote
  it; this was the *other* declaration of the same dead key, on the
  renderer-side field-metadata type (`BaseFieldMetadata`, the type
  `FieldWidgetComponentProps.field` resolves to). Measured on current `main`:
  zero readers and zero writers anywhere in `packages/*/src` or `apps/*/src`
  outside of an unrelated "0-indexed" prose comment.
  
  Declare indexes on the object instead: `indexes: [{ name, fields, unique }]`.
- deb157a: Retire the field designer's `Indexed` toggle — the ObjectStack spec has no
  field-level index flag
  
  `indexed` was never a `FieldSchema` key. The field-level flag built no index
  (objectstack#2377 removed it) and, since objectstack#4001 replaced silent
  drops with loud rejection, `FieldSchema.safeParse` refuses it by name. Ticking
  `Indexed` in Studio therefore made `PUT /api/v1/meta/object/:name` fail with
  `422 INVALID_METADATA`, and — because the key was stored — every later save of
  that object stayed blocked until the author found and cleared the toggle.
  
  Both field designers stop offering the control and stop authoring the key
  (`ObjectFieldInspector`'s Advanced section; `FieldDesigner`'s advanced
  section, `MetadataFieldsPage`, `MetadataService`, `metadataConverters`), the
  `designer.field.indexed` / `appDesigner.fieldDesigner.indexed` labels retire
  with it across all ten locale packs, and `DesignerFieldDefinition.indexed` is
  removed from `@object-ui/types`.
  
  Drafts and objects that already carry the key are un-poisoned on load rather
  than migrated, so an edit-and-save round-trip of previously blocked metadata
  now succeeds. The strip is keyed to the retired key alone — every other
  unknown key on a field definition still survives the round-trip.
  
  Declare indexes on the object instead: `indexes: [{ name, fields, unique }]`.
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
- 9695da7: Remove `VectorFieldMetadata.indexed` and `VectorFieldMetadata.distance_metric`
  — both declared keys the ObjectStack spec rejects
  
  Two separate dead keys on `VectorFieldMetadata`
  (`packages/types/src/field-types.ts`), found alongside PR #4686's sibling
  `BaseFieldMetadata.indexed` deletion:
  
  - `indexed` was never a `FieldSchema` key — same class as `BaseFieldMetadata`
    above: the field-level flag built no index (objectstack#2377 removed it),
    and `FieldSchema.safeParse` rejects it by name (objectstack#4001).
  - `distance_metric` was measured first rather than assumed removable: the
    installed `@objectstack/spec` 17.0.0-rc.6's vector field shape declares no
    metric-spelling key under any candidate spelling probed (`metric`,
    `distanceMetric`, `similarity`, `similarityMetric`, `metricType`,
    `vectorMetric`) — `dimensions` is the only vector-specific key
    `FieldSchema` recognizes, and its `FIELD_KEY_GUIDANCE` alias/retirement
    table carries no entry for `distance_metric` at all. With no equivalent to
    align to, and zero measured readers/writers, removal takes no capability
    away.
  
  Both are rejected by `FieldSchema.safeParse` as `unrecognized_keys`; `dimensions`
  is accepted (control). Repo-wide sweep (excluding tests) found zero readers or
  writers of either key on the vector path — `VectorField.tsx` (the renderer)
  reads only `field.dimensions`. Declare the index on the object instead:
  `indexes: [{ name, fields, unique }]`.
- 58b8346: Settle the two declared-but-unread keys on `AccordionItem`: retire `icon`, wire
  `disabled` (objectui#4652).
  
  The same defect as objectui#4632 (PR #4651), one interface up in the same file.
  `AccordionItem` declared `disabled?: boolean` and `icon?: string` while the
  `accordion` renderer read neither — it mapped items to `value`/`title`/`content`
  and dropped the rest. Nothing went red: an author who declared either key got a
  correctly rendered accordion with the key silently ignored.
  
  The two keys are settled in opposite directions, by measurement rather than by
  symmetry. A full corpus sweep (schema catalog, docs, example apps, and this
  repo's `objectstack` sibling checkout) found **zero** sites authoring either key
  on an `AccordionItem`:
  
  - **`icon` is retired** from the TypeScript interface and from the
    `AccordionItemSchema` Zod mirror. It had zero measured pull anywhere in the
    corpus and no established convention to lean on, so under this platform's
    declared=enforced doctrine it is removed rather than speculatively
    implemented.
  - **`disabled` is honored**, despite also having zero catalog pull today.
    Item-level `disabled` is already established live convention in this
    codebase — `tabs`, `select`, `dropdown-menu`, `menubar`, `context-menu` and
    (objectui#4632) `toggle-group` all forward it, and `accordion` was the next
    outlier. The underlying Radix accordion item supports `disabled` natively, so
    the renderer forwarding one prop is the whole change; the synced
    `ui/accordion.tsx` primitive is untouched. The schema catalog's
    `basic-accordion` example now demonstrates a disabled item.
  
  **Breaking for TypeScript authors of `icon` only** (marked `minor` per this
  repo's version-alignment rule, which reserves `major` for following
  `@objectstack` across a major — see AGENTS.md's 版本号策略 and the identical
  classification PR #4651 used for `ToggleGroupItem.icon`). Runtime behaviour of
  an authored `icon` is unchanged — it rendered nothing before and renders
  nothing now; what changes is that the contract no longer claims otherwise, so
  the mistake surfaces at authoring time. Authored `disabled` changes from
  silently ignored to actually disabling that one item (and blocking its
  expand/collapse).
- 99bd015: Settle the two declared-but-unread keys on `ToggleGroupItem`: retire `icon`, wire
  `disabled` (objectui#4632).
  
  `ToggleGroupItem` declared `icon?: string` and `disabled?: boolean` while the
  `toggle-group` renderer read neither — it mapped items to value + aria-label +
  label and dropped the rest. Nothing went red, which is what made it durable: an
  author who declared either key got a correctly rendered group with the key
  silently ignored, and the schema catalog (the corpus AI authoring tools retrieve
  from) was teaching `icon` on all three items of
  `components-disclosure-toggle-group/with-labels`.
  
  The two keys are settled in opposite directions, by measurement rather than by
  symmetry:
  
  - **`icon` is retired** from the TypeScript interface, from the `ToggleGroupItemSchema`
    Zod mirror, from that catalog entry and from the component's docs page. It had zero
    measured pull — across the repo the single catalog entry was the only site authoring
    it, no application code or example app declared it, and no renderer resolved it.
  - **`disabled` is honored.** Item-level `disabled` is already live convention here —
    `tabs`, `select`, `dropdown-menu`, `menubar` and `context-menu` all forward it, and
    `toggle-group` was the lone outlier. The underlying Radix item supports it natively,
    so the renderer forwarding the prop is the whole change; the synced `ui/toggle-group.tsx`
    primitive is untouched.
  
  **Breaking for TypeScript authors of `icon` only** (marked `minor` per this repo's
  version-alignment rule, which reserves `major` for following `@objectstack` across a
  major). Runtime behaviour of an authored `icon` is unchanged — it rendered nothing
  before and renders nothing now; what changes is that the contract no longer claims
  otherwise, so the mistake surfaces at authoring time. Authored `disabled` changes from
  silently ignored to actually disabling that one item.

### Patch Changes

- af5e292: Emit explicit file extensions on relative import specifiers, so the published
  entries can be imported by Node's own ESM resolver.
  
  `@object-ui/react`'s built entry re-exported through extensionless relative
  specifiers (`export * from './SchemaRenderer'`). Node does not extension-search
  relative specifiers, so `import('@object-ui/react')` under plain Node — an SSR
  host, or any consumer without a bundler — failed with `ERR_MODULE_NOT_FOUND`.
  Bundled consumers were never affected and are unchanged by this.
  
  `@object-ui/types`, `@object-ui/core` and `@object-ui/i18n` carried the same
  emission; `@object-ui/react`'s entry stayed unloadable until they were fixed
  too, because evaluation crosses into them. No exported API changed.
- 7f96b10: `DashboardWidgetSchema`: stop re-typing the retired `responsive` key as `any`
  
  `dashboard.widgets[].responsive` was retired in `@objectstack/spec` 17.0.0-rc.6
  (objectstack#4876, ADR-0049 D2), and objectui's Zod twin — which derives every
  spec key by reference — has refused it ever since. The TypeScript interface did
  not follow: `responsive` was held out of the inherited key set by an `Omit` and
  re-declared as `any`, so one key was accepted by tsc and rejected by validation.
  
  Authoring `responsive` on a widget is now a tsc error, matching the Zod tombstone
  that already refuses it. The key inherits as `?: never`, the same way the four
  keys objectstack#5010 retired do.
  
  The `any` was deliberate and carried a written reason — that objectui's renderer
  reads a per-breakpoint record the spec's single object could not express.
  objectui#3173 measured that claim and it was false: there are no
  `widget.responsive` read points in the repo and no authored occurrences in either
  corpus, so nothing migrates. Breakpoint behaviour is unaffected — the shared
  `ResponsiveConfig` shape stays live on `page.components[].responsive`, which
  `useResponsiveConfig` really does read.
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
- b8b9af4: `page:header`'s `maxVisible` / `mobileMaxVisible` now honour the contract's value domain instead of a laxer renderer tolerance.
  
  Three authorities gave two answers for the same value (objectui#5006). Measured on
  `ComponentPropsMap['page:header']` at `@objectstack/spec@17.0.0` — the member lives
  on the `@objectstack/spec/ui` subpath, not the package root — both keys are a
  POSITIVE SAFE INTEGER (`{format:'safeint'}` plus
  `{check:'greater_than',value:0,inclusive:false}`). Spec rejects `0`, `-1`, `1.5`
  and anything past `Number.MAX_SAFE_INTEGER`. objectui's manifest gate and
  `sdui-parser`'s `checkType` said nothing about any of them, and the renderer's
  `readMax` was looser still: it accepted `0` and floored fractions. So the loosest
  of the three layers decided what shipped on screen, while `os validate` / `os build`
  rejected the very same metadata outright.
  
  `readMax` now accepts only what the contract accepts. `Number.isSafeInteger(v) && v > 0`
  is the exact translation of `safeint`, not an approximation — plain `Number.isInteger`
  would admit `2**53 + 2` and `1e21`, which spec rejects.
  
  Behaviour change, stated because this NARROWS the renderer's accept set rather than
  only fixing a fault: a contract-rejected value no longer takes effect and falls back
  to the documented default (3 desktop / 1 mobile). Concretely, `maxVisible: 0` used to
  render zero inline buttons and sweep every action into the overflow menu, and
  `maxVisible: 1.5` used to be floored to `1`; both now render the default 3-inline
  split. This is a narrowing *toward* an already-published contract — no in-tree
  producer writes a rejected value, so nothing in the repo changes behaviour. Both
  schema-level and `properties.*` spellings go through the one reader. `action:bar`'s
  `maxVisible` is an unrelated reader with no `ComponentPropsMap` entry and is
  deliberately untouched.
  
  `ComponentInput.type`'s doc comment now records the trade the ruling fixed in place
  (maintainer, 2026-08-17): the coarse `number` arm plus `description` is the
  publication face's expression ceiling today, and spec is the sole judge of values.
  Giving `ComponentInput` real constraint slots, and binding `checkType` to spec, were
  both deferred with a named reopen condition — a measured case of an author shipping
  a spec-rejected value that objectui's silence let through.
- 3cf4de0: Removed the dead `require` condition from `exports["."]` in `@object-ui/types`'s `package.json`. It pointed at `dist/index.cjs`, a file the package's `"build": "tsc"` script (bare `tsc`, no bundler) structurally never emits — verified on a clean rebuild (`rm -rf dist tsconfig.tsbuildinfo && tsc`): zero `.cjs` files under `dist/`.
  
  **Judged non-breaking (`patch`), because the condition never resolved to anything a consumer could depend on** — measured both ways from a real `require()` call through the package's own resolved workspace symlink (not asserted):
  
  - **Before this change**: `require('@object-ui/types')` → `MODULE_NOT_FOUND: Cannot find module '.../dist/index.cjs'` (the condition existed but its target was never written by the build).
  - **After this change**: `require('@object-ui/types')` → `ERR_PACKAGE_PATH_NOT_EXPORTED: No "exports" main defined ...` (no matching condition).
  
  Both throw. No working `require()` call is turned into a failing one — there was no working one to begin with, in this repo or in any published version, since the build has never emitted `dist/index.cjs`. The `import` condition (`./dist/index.js`, real and always present) and the `types` condition are unchanged.
  
  The package declares `"type": "module"` and ships no bundler, so ESM-only is the contract-honest shape going forward; adding a second build format to satisfy a condition nothing used was the alternative and was not taken.
- c9dc811: `@object-ui/types` stops publishing its `src/` tree
  
  Its manifest's `files` array listed `src` alongside `dist`, so every published tarball carried all 91 source files. Unlike the two sibling packages already fixed (`@object-ui/data-objectstack` #4847, `@object-ui/fields` #4856), this one was not a mechanical delete: `packages/types/tsconfig.json` built with a bare `tsc` and `declarationMap: true`, and its shipped `dist/*.d.ts.map` named `sources: ["../src/*.ts"]` with `sourcesContent: false` — a real, if small, consumer (editor go-to-source). Deleting `src` from `files` while that map still pointed at it would have shipped a tarball with a broken-link map.
  
  Maintainer ruling (2026-08-17, objectui#4851): turn `declarationMap` off at the source rather than keep a permanent per-package exception in the phantom-dependencies gate's header, or add `inlineSources` (which saves nothing and adds a third emitter shape). `types` is a pure-types package built by bare `tsc`, so its `.d.ts` is near-isomorphic to its source — go-to-source degrading to the `.d.ts` is a near-zero-pull, deliberate trade.
  
  Order followed: flipped `declarationMap: false` in `packages/types/tsconfig.json` first, clean-rebuilt, and confirmed the published `dist` has zero `.map` files, zero `sourceMappingURL` occurrences, and zero `../src` references (a positive control against the pre-flip build showed 54 of each, so the greps are exercised, not vacuous) — only then trimmed `files` to `["dist", "README.md", "CHANGELOG.md", "LICENSE"]`.
  
  `npm pack --dry-run` across the change, on the freshly rebuilt `dist`:
  
  | | before | after |
  | --- | --- | --- |
  | entries | 203 | 112 |
  | unpacked | 3974143 B | 2828454 B |
  | tarball | 656307 B | 414644 B |
  
  91 `src/*.ts` files leave, none arrives; the `dist/` entry count (108) is unchanged, and its `.d.ts` payload is now map-free.
- a0b9e91: A system (code-defined) view's personalization overlay row no longer masquerades as a user-created saved view.
  
  Toggling density / sort / hidden columns / column widths / inline-edit on a code-defined view persists a row under the same `type='view'` metadata namespace a genuinely saved view lives in, keyed by the same id (`ObjectStackAdapter.updateViewConfig`). `listViews()` previously returned that row indistinguishably from a real saved view, so `ObjectView`'s `isSystem = !saved` check flipped to `false` and the tab gained Rename / Delete / Set-default / Pin against a view that lives in code — `handleDeleteView` would even call `dataSource.deleteView` on it.
  
  Two layers now keep the two kinds of rows apart:
  
  - **Write side**: `updateViewConfig` — the only production writer of personalization overlays — stamps an explicit `_isOverride: true` discriminant on every row it saves, UNLESS the write targets an already-saved view's own row (see below).
  - **Read side**: `listViews()` excludes any row carrying that marker, and (for rows already persisted before this fix shipped) a best-effort legacy shape: a flat body with a `viewKind` the platform can only have server-side-backfilled from a registry (code-defined) baseline — a genuine runtime-created saved view never has one.
  
  `listViewOverrides()` (the reader `ObjectView` uses to merge these settings back into the live view for display) is unchanged — it is supposed to keep seeing overlay rows.
  
  The overlay this stores is **org-wide shared view settings**, not a per-user preference (a true per-user scope is a parked platform-side v18 direction) — comments describing it as "personal" have been corrected to say so.
  
  **Follow-up fix (same card, post-review):** `updateViewConfig`'s ONE call site (`ObjectView`'s toolbar-driven toggle) fires for a toggle on EITHER a system view OR an already-saved view — a saved view whose own toolbar the user toggles writes to that same view's own row. Stamping the overlay marker unconditionally there would flag the user's own saved view as an overlay and make `listViews()` exclude it on the very next read, i.e. the saved view would vanish from the switcher the moment its density was adjusted. `updateViewConfig` gains an optional `opts.isSavedView` parameter (also added to the `DataSource` interface in `@object-ui/types`); `ObjectView` passes it from the same `isSavedViewId` classification its readonly gate and mutating handlers already use, and the marker is withheld when it's true.

## 17.5.0

### Minor Changes

- f650253: `BaseSchema.ariaLabel` declares the keyed i18n vocabulary the renderer actually
  resolves, `.disabled` accepts the predicate string it actually evaluates, and the
  keyed shape finally has a name (objectui#4581)

  Three slots on one base type had drifted from what the renderer does with them.
  PR #4593 fixed `visible` and measured the rest; these are the rest.

  `ariaLabel` was `string`, but `SchemaRenderer.tsx:111` resolves it with
  `resolveKeyedI18nLabel`, whose input is the KEYED form
  `{ key, defaultValue?, params? }` — a reference into a translation bundle. It is
  now `string | KeyedI18nLabel`, and `KeyedI18nLabel` is a new exported type in
  `@object-ui/types` rather than a fourth inline copy of one object literal: the
  three that existed (`@object-ui/react`'s resolver, `@object-ui/layout`'s
  `resolveLabel`, `@object-ui/app-shell`'s `t`-taking twin) were verified identical
  in their object half first, and two of them now import the name.

  The vocabulary matters more than the widening. `#4581` originally asked for
  `string | I18nLabel`, and that spelling was withdrawn as measured-wrong: the
  spec's `I18nLabel` is the INLINE LOCALE MAP (`string | Record<string, string>`),
  a different vocabulary resolved against a BCP-47 locale by a different function
  of a confusingly similar name. Under it the shipped keyed fixture type-checked
  only vacuously — as a locale map whose "locales" are named `key` and
  `defaultValue` — the same label carrying `params` was rejected outright, and a
  genuine `{ en: 'Owner' }` compiled while rendering an EMPTY `aria-label`. Naming
  the keyed shape is the declaration half of the fix objectui#4167 started on the
  naming side; `@object-ui/app-shell`'s copy keeps its inline spelling for now
  because an open PR has a pending change to that file, and the comment there says
  so.

  `disabled` was `boolean` on a key the renderer never reads as one:
  `SchemaRenderer.tsx:466` evaluates it through the same `evaluateCondition` as
  `visible`, and a `disabledOn?: string` sibling exists for the same reason. It is
  now `boolean | string`. The asymmetry with `visible` was accidental rather than
  deliberate.

  Both are widenings on authored-input-dominant properties: authors gain a
  spelling, nothing that type-checked before stops doing so, and readers already
  coped with `any` through `BaseSchema`'s index signature. Three test fixtures that
  had been casting past these declarations with `as unknown as BaseSchema` state
  their values directly now, and the declared unions are pinned invariantly so
  neither a missing widening nor an overshoot to `any` can pass unnoticed.

  Declaring the vocabulary honestly also surfaced a real one: the `toggle`
  renderer writes `aria-label` itself instead of going through SchemaRenderer's
  resolver, and it forwarded the raw value. Invoked directly it emitted
  `aria-label="[object Object]"` for a keyed label — announced verbatim by a
  screen reader. It resolves now. Through `SchemaRenderer` the bug was invisible,
  because SchemaRenderer injects its own resolved `aria-label` afterwards; a
  downstream type-check sweep found it, not a test.

  `BaseSchema.label` and `.description` are deliberately unchanged and pinned that
  way. They receive the spec's inline `I18nLabel` from the view bridges, which is a
  real defect, but resolving it belongs at the spec-to-schema boundary rather than
  in this declaration — and that work is still blocked on a design question about
  where the display locale enters, so it is not in this release.

- 3d9769a: `BaseSchema.visible` accepts the predicate string the renderer evaluates

  `visible` was declared `boolean`, but the renderer never read it as one: it
  evaluates the key — `SchemaRenderer.tsx:382` calls
  `evaluator.evaluateCondition(schema.visible)`, and `evaluateCondition` is
  declared `(condition: string | boolean | undefined, context?) => boolean`. The
  sibling keys `visibleWhen` and the deprecated `visibleOn` are `string` for that
  same reason; `visible` simply under-reported a capability it already had, and
  fixtures exercising it had to cast past the declaration.

  Now `boolean | string` — exactly what the evaluator accepts, no wider.

  Graded **minor** by position analysis of the published `.d.ts`: the only diff is
  `visible?: boolean` becoming `visible?: boolean | string` on an
  authored-input-dominant property, with no union member removed and no other
  declaration touched — the same shape as #4586/#4591. Authors gain a spelling;
  nothing that previously type-checked stops doing so. Code that READS
  `schema.visible` was already coping with `any` through `BaseSchema`'s index
  signature.

- d9d3463: Retire four zero-consumer declared surfaces (dead-surface sweep batch 3, #4328). Each was
  measured as declared-but-never-read at the branch point, and each is removed rather than
  left as an authoring surface whose values nothing acts on.

  Breaking for anyone who typed against the removed declarations, marked `minor` per this
  repository's version-alignment convention (the major tracks `@objectstack`, never an
  API-break count):

  - `@object-ui/core` no longer exports `mergeViewsIntoObjects`. It was a second copy left
    behind by the move of that step to the provider layer, and it had drifted: it ignored a
    view container's default `list` and keyed views by the authored bare key instead of the
    composer's `<object>.<key>` identity. The live implementation — `MetadataProvider`'s, in
    `@object-ui/app-shell` — is unchanged and remains the only one. (#3775)
  - `@object-ui/types`' `RoleDefinition` no longer declares `permissions`. A role's grants
    live in `ObjectPermissionConfig.roles`, keyed by object; that is the only home any
    consumer reads (`resolveRoles` walks `inherits` and matches on `name`). The removed
    field was _required_, so five fixtures across three packages had been declaring an empty
    array for a value nothing would ever look at. Role-attached grants are now a compile
    error rather than silently ignored data. (#4288)
  - `@object-ui/react`'s `RecordContextValue` no longer declares `loading` / `error`. Both
    had zero producers and zero consumers — no host passed them, no `record:*` renderer read
    them — and only the provider's memo dependency list still named them. Record-level
    loading and error state stays where it is actually expressed: each renderer's own data
    source. (#3773)

  No behaviour change, no request-count change:

  - `@object-ui/data-objectstack` drops five `metadataCache.invalidate('views:<object>')`
    calls across `updateViewConfig` / `createView` / `updateView` / `deleteView`. No read
    path has ever populated that key — `listViews` fetches directly, uncached — so all five
    were permanent no-ops. The invalidations of the keys that do have readers
    (`view:<object>:<viewId>` for `getView`, `view-overrides:<object>` for
    `listViewOverrides`) are untouched and now pinned. (#3778)

- 2a40f69: Retire two post-retirement dead surfaces (#4364, #4368). Both were measured at this
  branch point rather than taken from their cards, and one card's premise only half held.

  Breaking for anyone who typed against the removed declaration, marked `minor` per this
  repository's version-alignment convention (the major tracks `@objectstack`, never an
  API-break count):

  - `@object-ui/types` and `@object-ui/permissions` no longer export
    `ObjectLevelPermission`. It declared a second, parallel home for object-scoped grants
    (`{ object, actions, effect?, conditions? }`) that nothing constructed, accepted or
    read once `RoleDefinition.permissions` was retired (#4288) — its only remaining
    referents were its own definition and the two barrel lines. The wired home is
    `ObjectPermissionConfig.roles`, whose inner grant shape is declared inline; that is
    what the evaluator reads, and it is unchanged. `ObjectPermissionConfig`'s doc comment
    now records the retirement so the surface is not re-declared. (#4364)

  `PermissionCondition` was proposed for retirement on the same card and is **kept**: its
  premise ("only referent is `ObjectLevelPermission.conditions`") did not hold at this
  branch point. `evaluateCondition` in `@object-ui/permissions` takes it as a parameter
  type and implements all eleven of its operators under a 26-case suite. `PermissionEffect`
  is likewise untouched — `FieldLevelPermission.effect` still reads it.

  No behaviour change, no public surface change:

  - `@object-ui/console` drops `src/utils/metadataConverters.ts` and
    `src/services/MetadataService.ts`. Both were console-local duplicates of live
    `@object-ui/app-shell` modules and lost their last importer when the bespoke
    object-detail widgets were retired (#4365). Both had already drifted behind the live
    copies they duplicate — the console converter's `referenceTo` chain never read the
    server's `reference` key, and the console service predates the view cache-invalidation
    seam (#4373) — which is precisely the imitation trap the card recorded: an author
    grepping for "the converter" could land on the unexercised copy. The app-shell copies
    and their tests are untouched. (#4368)

- bec3e14: The `DataSource` contract carries `deleteView`'s per-home outcomes (#4564)

  #4479 / PR #4562 widened the ObjectStack adapter's `deleteView` to return
  `DeleteViewResult { deleted, draft?, published? }`, so a caller could finally tell a
  partial delete ("draft gone, published overlay left") from a complete one. The shared
  interface did not follow: `DataSource.deleteView?` still declared the narrow
  `Promise<{ deleted: boolean }>`.

  Nothing failed to compile, and that is exactly what made the gap invisible — a wider
  return is assignable to a narrower declaration, so the adapter satisfied the interface
  while every consumer reaching it **through** `DataSource` was handed a type with the
  per-home outcomes already discarded. The one real call site today (app-shell's
  `ObjectView` delete handler) awaits the call and reads nothing off the receipt, so the
  loss was latent rather than broken.

  `DeleteViewResult` and `ViewHomeDeleteOutcome` now live in `@object-ui/types`, beside
  the `DataSource` interface that returns them, and `deleteView?`'s declared return is
  `Promise<DeleteViewResult>`. The direction was forced: the dependency runs
  `@object-ui/data-objectstack` to `@object-ui/types` and never the other way, so the
  shapes could not be imported downward — moving them was the alternative to re-declaring
  a structural twin in `types`, which the one-resolver rule rejects because a copy is
  mutually assignable with the original for exactly as long as it takes to drift.

  `@object-ui/data-objectstack` re-exports both names unchanged, so every importer PR
  #4562 left pointing at it keeps compiling — and now resolves to the same declaration the
  shared contract speaks rather than a look-alike. A repo-wide census before the move
  found zero importers of either name outside the declaring file itself, PR #4562's own
  suite included, so the re-export is insurance rather than a load-bearing shim.

  `deleteView` stays **optional** on the interface and keeps both parameters; the growth is
  to the return type only, and `deleted` is untouched, so a consumer reading only `deleted`
  needs no edit.

  Grading, per this repository's version-alignment convention (the major tracks
  `@objectstack`, never an API-break count):

  - `@object-ui/types` — **minor**: entry-reachable growth. Two new exported interfaces
    plus a widened method return on `DataSource`, all reachable from the package entry.
  - `@object-ui/data-objectstack` — **minor**, measured rather than assumed. Its emitted
    `dist/index.d.ts` is **not** byte-identical after the swap: the two `interface` blocks
    leave the file and are replaced by a re-export from `@object-ui/types` (121.61 KB to
    120.25 KB). Both names remain in the public export list, so no importer breaks, but the
    declaration genuinely moved and the emitted types now depend on `@object-ui/types` for
    it — that is a minor, not a patch.

- 1f9b905: `exportOptions` is the spec's object form: `streaming` is declared, `'pdf'` is retired, and the alignment comment is finally true

  `ObjectGridSchema.exportOptions` carried four keys under a comment claiming alignment with `@objectstack/spec`'s `ListViewSchema.exportOptions`. The comment was false in both directions. The spec declared a bare format ARRAY, not an object, so no authored document could satisfy both spellings at once; and `ObjectGrid` read a fifth key — `streaming`, the opt-out that forces the client-side export path — which appeared in no declaration anywhere, reachable only through an `as any` cast in the renderer. An author had no way to discover the key except by reading the renderer's source, and no schema would have refused it or honoured it.

  objectstack#8010 closed that upstream by declaring `ListViewExportOptionsSchema` with exactly the five keys this renderer reads. This change lands the objectui half of the reconciliation:

  - The five keys are now one exported type, `ListViewExportOptions` — `formats`, `maxRecords`, `includeHeaders`, `fileNamePrefix`, `streaming` — shared by `ObjectGridSchema` and by a saved `NamedListView`, so the two authoring surfaces cannot grow apart. The comment above it names the spec symbol and version it mirrors, which makes it checkable rather than reassuring.
  - `streaming` is declared, and the renderer's `as any` casts are gone. Removing them against the old four-key type produced two `TS2339: Property 'streaming' does not exist` errors — that red is what the declaration fixes.
  - `'pdf'` is retired from the local format union, published as `ListViewExportFormat`. PDF export was declined platform-side (objectstack#1301 NOT_PLANNED) and the value left the spec's format enum in `@objectstack/spec` 17.0.0, where authoring it is now a parse-time refusal carrying `os migrate meta --from 16`. No ObjectUI path has ever produced a PDF: a declared `'pdf'` reached the user only as a browser console line.

  Runtime behavior of the export menu is unchanged. The filter that drops undeliverable formats is format-agnostic — it keeps what the active path can deliver — so it still hides `xlsx` when no server stream is available, and it still hides a legacy `'pdf'` that pre-17 stored metadata carries until the migration rewrites it. There was no `'pdf'`-specific branch to delete.

  Two guards keep the contract from re-opening. On the type side, a compile-time assertion pins the interface's key set to exactly the spec's five, so a sixth key fails the build. On the renderer side, a source scan collects every property `ObjectGrid` reads off `exportOptions` — through the alias it binds, and through any cast, since a cast is how `streaming` stayed invisible — and fails if the renderer reads anything the type does not declare.

  `@object-ui/types` is a minor: `ListViewExportFormat` and `ListViewExportOptions` are new exports, `streaming` is a new optional key, and `formats` no longer admits `'pdf'`. Anything still writing that value was authoring metadata the platform now refuses at publish.

- 38ab505: Retire the `global_nav` Studio designer surfaces, and track the `@objectstack` family at `17.0.0-rc.6` (objectstack#7100 / objectstack#6888).

  ## The retirement

  `global_nav` was an `ACTION_LOCATIONS` member no running-app surface ever rendered. The console's ⌘K palette (`app-shell/src/chrome/CommandPalette.tsx`) builds its groups from nav items, objects, dashboards, pages, reports, recent items, record search and theme; it holds no reference to `global_nav`, to `actionRendersAt`, or to any action-metadata source. An action declaring `locations: ['global_nav']` therefore never reached a user.

  The Studio designer previewed it anyway — a mock frame reading `⌘K · Command palette` with the author's button inside it. That is the sharp edge the maintainer's 2026-08-09 ruling on objectstack#6888 named: an authoring tool promising a surface the product does not have teaches authors, and every AI copying this corpus, to declare dead metadata. `@objectstack/spec` `17.0.0-rc.6` retired the member (7 members → 6) with a named rejection message; this release removes the designer surfaces that outlived it.

  - `metadata-admin/previews/ActionPreview.tsx` — the mock command-palette placement frame is gone. The metadata strip above it still ECHOES whatever `locations` the draft declares, deliberately: reporting what a (possibly stale) draft says is honest, whereas the frame CLAIMED the platform renders it.
  - `metadata-admin/inspectors/ActionDefaultInspector.tsx` — the `global_nav` entry is gone from `LOCATION_LABELS`. That map is typed `Record< ActionLocation, string >`, so the retirement reached it as a compile error rather than as a silently stale dropdown — the mechanism objectui#3017 installed, firing as designed.
  - `metadata-admin/previews/block-config.ts` — the `record:quick_actions` location dropdown no longer offers it, and both locale tables drop the now-orphaned `…option.location.global_nav` key.
  - `@object-ui/components`' `action:bar` doc comment is aligned. The component's published enum is `[...ACTION_LOCATIONS]`, so it followed the retirement on its own; only the prose was stale.

  `@object-ui/core`'s `ActionEngine.getActionsForLocation` is **unchanged and still answers a literal string match**. Narrowing it to the six live members would put a second rejection point beside the schema's — the tolerant-consumer shape the strict-contract rule forbids, inverted. Enforcement stays where it belongs: the parameter type is now six-membered so no type-correct caller can spell the retired value, and `ActionLocationSchema` rejects it by name at authoring and publish time.

  ## The dependency move

  All 37 `@objectstack/*` declarations across 30 `package.json` files move from `^17.0.0-rc.5` to `^17.0.0-rc.6`, and `pnpm-lock.yaml` resolves one copy of each family package at rc.6. The siblings move with `spec` because `client` / `formula` / `lint` pin it **exactly** — leaving them behind would keep two copies of the spec in the tree, the split brain objectui#3560 called out.

  Bumping the pin and repairing the fallout cannot be split: at rc.5 the `Record< ActionLocation, string >` above is missing a key, at rc.6 it has an excess one.

  ## Breaking, in FROM → TO form

  - **`@object-ui/types`' `Theme` now binds the spec's `Theme`, not `ThemeInput`.** rc.6 retired every `…Input` alias and moved the bare name onto the `z.input` side (`X` = `z.input`, `XParsed` = `z.infer`). The runtime shape and this package's exported name are unchanged — `Theme` was, and still is, the AUTHORING shape where `mode` is optional. Re-pointing at `ThemeParsed` would have been the silent swap.
  - **`SpecReport` / `SpecReportChart` re-point to `ReportParsed` / `ReportChartParsed`, and `SpecReportInput` / `SpecReportChartInput` to `Report` / `ReportChart`.** Same rename, same rule: each local alias keeps the SIDE it had at rc.5.
  - **`@object-ui/types` no longer re-exports `I18nObject`, `LocaleConfig`, `PluralRule`, `DateFormat` or `NumberFormat`** — all five were retired by rc.6. They were dead re-exports here: nothing in this repo imported them from `@object-ui/types` (`@object-ui/i18n`'s formatter vocabulary in `utils/spec-formatters.ts` is locally declared and never bound the spec symbols). `I18nLabel` survives and is unchanged as a name.
  - **`I18nLabel` itself widened from `string` to `string | Record< string, string >`** — rc.6 folded the retired `I18nObject`'s per-locale map into it and ships `resolveI18nLabel(label, locale)` as the shared resolver. Every read in this repo that lands in a text slot now goes through that resolver, so an inline map renders its locale instead of `[object Object]`. Reads the compiler cannot see are audited separately in objectui#4163.
  - **`@object-ui/types`' `GlobalFilterSchema` derives via `.safeExtend`, not `.extend`.** rc.6's `GlobalFilterSchema` carries a refinement and zod 4 refuses `.extend()` on a refined object outright, which threw at module load. `.safeExtend` is zod's prescribed replacement and KEEPS the refinement, so the spec's cross-field rule now also runs on this package's dialect — which is the intended behaviour, since the pinned divergences widen individual fields and were never meant to switch off a whole-object rule.

- c1d939f: One `SchemaNode`, and one label vocabulary — the union wins, and labels resolve where the locale lives

  Two packages published a type called `SchemaNode` and they were not the same type. `@object-ui/core` hand-declared `interface SchemaNode { type: string; … [key: string]: any }`; `@object-ui/types` exported `type SchemaNode = BaseSchema | string | number | boolean | null | undefined`, whose own doc comment names `'Plain string'` a valid node. Both were exported under one name from packages the same consumers import together, so which declaration a call site got depended on which package it happened to import from — #4548's canary measured 19 of 35 errors as exactly that collision. Core's declaration is now a re-export of types', so there is one declaration left to disagree with. Core's entry surface is unchanged: `dist/index.d.ts` is byte-identical across the change.

  Reconciling it exposed a real defect rather than a mechanical narrowing, which is why the first attempt was withdrawn instead of forced. The spec bridges write `spec.label` — the spec's `I18nLabel`, an INLINE locale map like `{ en: 'Owner', 'zh-CN': '负责人' }` — into `node.label`, and `BaseSchema.label` declared `string`. Under core's old index signature that assignment was invisibly `any`; under one honest `SchemaNode` it is a type error. `BaseSchema.label` and `.description` therefore now accept `string | I18nLabel`, and the two bridge assignments compile with their expressions untouched.

  Resolution happens at READ time, in the renderer, against the display locale — not at the bridge. Resolving at the bridge was measured unimplementable: it is a plain class method that cannot call a hook, `BridgeContext` declares no locale, and `updateContext()` has zero callers, so a bridge-resolved label would freeze one audience's language into the node tree with no re-translation channel. React's own invalidation re-translates for free at the read site.

  The widening turned every blind `schema.label`-as-string read into a named compiler error, and that inventory is the audit: it named four sites repo-wide, all one class — the label reaching a React child position, where a map does not render as `[object Object]` but THROWS `Objects are not valid as a React child`, failing the whole subtree. Three are `@object-ui/components` renderers (`filter-builder`, `sidebar-group`, `dropdown-menu`), which now resolve with the spec's own `resolveI18nLabel` against `useDisplayLocale()`. The fourth is `plugin-dashboard`'s `DashboardGridLayout` heading, which resolves with `pickLocalized` against the active UI language — matching the widget-title resolution already in that same component rather than putting two resolvers and two disagreeing locale channels in one render; the two resolvers are limb-for-limb twins with a parity test pinning them.

  One interface now carries both label vocabularies two properties apart — `label`/`description` are the spec's INLINE map, `ariaLabel` is the KEYED bundle reference — and each accepts the other's shape vacuously. That confusability is objectui#4167's known hazard, inherent to the spec's `I18nLabel` design; both shapes are named with cross-referenced doc comments stating which resolver owns which slot, and a pin asserts the two unions do not collapse into each other.

  Finally, the spec bridges declare their return type as `BaseSchema` instead of the union. Both bridges end in a single `return node` on an object literal, so the union described nothing real while forcing a narrowing at every read — 272 mechanical errors across five suites in the first round. That change is a type annotation only; the emitted JavaScript is byte-identical.

- bb68488: Stop declaring 14 symbols under names `@objectstack/spec` owns at `17.0.0-rc.6`
  (objectui#4167, objectstack#4115).

  The rc.6 bump published nine names this repo already declared locally, on top of
  four that predate it — `check:spec-symbols` reported all thirteen at once, and a
  fourteenth (`GlobalFilterSchema`) appeared during the bump itself. Each was
  triaged on its own rather than blanket-renamed, because the right answer differs
  per symbol: five bind to the spec, three are renamed because the spec's
  same-named export means something else, five arrive by derivation, and one is a
  declared dialect with a written reason.

  **Breaking for importers of `@object-ui/react`, `@object-ui/app-shell` and
  `@object-ui/types`** — three exported names changed, because the spec exports the
  same name for a _different_ thing:

  | package               | was                | now                            | what the spec's same-named export actually is                                                                                                          |
  | :-------------------- | :----------------- | :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `react` / `app-shell` | `MetadataState`    | `MetadataCacheState`           | a metadata item's LIFECYCLE state — `'draft' \| 'active' \| 'deprecated' \| 'archived'` (`MetadataStateSchema`, `@objectstack/spec/system`)            |
  | `react` / `app-shell` | `resolveI18nLabel` | `resolveKeyedI18nLabel`        | a resolver for the INLINE per-locale map (`{ en: 'Owner', 'zh-CN': '负责人' }`) against a BCP-47 locale                                                |
  | `types`               | `DateRangePreset`  | `FilterBuilderDateRangePreset` | the thirteen HISTORICAL dashboard filter-bar presets; this one is the filter-builder set, which adds eight FUTURE windows the dashboard schema rejects |

  `resolveI18nLabel` is the one where the collision had already started costing
  something. rc.6 widened `I18nLabel` from `string` to
  `string | Record< string, string >`, so the same authored value now reaches
  either resolver — and each answers wrongly, silently, for the other's input: the
  keyed one returns `undefined` for `{ en: 'Owner' }` (no `key`, no
  `defaultValue`), and the spec's reads `key` / `defaultValue` / `params` as locale
  tags. The rc.6 bump PR met this and aliased the spec's import as
  `resolveInlineI18nLabel` in five files, with hand-written comments at two of
  them. That is a review convention, which is what objectstack#4115 exists to
  replace with a rule — so `Keyed` is now the counterpart of that `Inline`, and the
  name says which vocabulary it resolves at every call site.

  **Eleven keep their names and are now imported or derived from the spec** instead
  of re-declared: `DATE_RANGE_PRESETS`, `NavigationMode`, `AddressValue`,
  `BreakpointColumnMap`, `BreakpointOrderMap`, `KanbanConfig`, `CalendarConfig`,
  `GanttConfig`, plus the three renamed above at their new names.

  **Four of the copies were losing information, not just duplicating it.**

  - **`GanttConfig` declared six keys and called itself canonical; rc.6's
    `GanttConfigSchema` declares seventeen.** The eleven it never mentioned —
    `parentField`, `typeField`, `baselineStartField`, `baselineEndField`,
    `groupByField`, `resourceView`, `assigneeField`, `effortField`, `capacity`,
    `quickFilters`, `autoZoomToFilter` — are all read by
    `plugin-gantt/src/ObjectGantt.tsx`, through a local `GanttConfigEx`
    intersection that existed only because this type did not carry them. It now
    derives from the spec, with `timeSegments` (shift segmentation) as the one
    genuinely local extension; the schema is `$loose` upstream, so that key is
    legal metadata rather than a second dialect.
  - **`GanttConfig.tooltipFields` carried the comment "not part of the upstream
    GanttConfigSchema".** It is, as of rc.6, so the key now arrives from the spec.
  - **`AddressValue` declared five of the spec's seven parts** — `countryCode` and
    `formatted` were missing, under a comment already claiming to be "the part
    names of `AddressSchema`". The widget still renders five inputs; binding the
    type stops it from asserting the platform cannot store the other two, and makes
    the `{ ...address }` write-through say so.
  - **`DATE_RANGE_PRESETS` was `Object.keys(PRESET_RANGES)`,** a third copy of a
    vocabulary the spec extracted in objectstack#4614 precisely to collapse — its
    own doc comment names this module as one of the three. It is now the spec's
    array by reference, and the local date-macro bounds table is pinned complete
    against it with `satisfies`, so a preset the schema gains without bounds here
    is a compile error rather than a filter that validates clean and then selects
    nothing.

  `NavigationMode` was one hop from the spec already (`NavigationConfig['mode']`);
  it is bound directly, with a both-directions type pin that it stays the same type
  as the config's own `mode`. `KanbanConfig` / `CalendarConfig` /
  `BreakpointColumnMap` / `BreakpointOrderMap` were exact hand copies of `$strict`
  schemas and are now re-exports — "still exact" is the argument for binding them,
  since a copy with nothing to protect can only drift.

  `GlobalFilterSchema` is the one ALLOW entry. It is the same spread-composition
  dialect as `SelectOptionSchema` next to it, and it collided only because rc.6's
  new refinement forced `.extend()` to be respelled as a `.shape` spread — which
  moved a derivation the guard could see into an object literal it deliberately
  does not descend into. The dialect is unchanged and its three divergences are
  pinned; which side moves on the refinement itself is objectui#4165.

  `@objectstack/spec` moves from `devDependencies` to `dependencies` in
  `@object-ui/layout`: its public type surface now references the spec.

- ab04728: `ViewNavigationConfig` IS the spec's navigation config — the second spelling stops requiring `mode` (objectui#4588)

  `@object-ui/types` published **two** types for one spec object, and they disagreed
  about whether `mode` may be omitted. `index.ts` re-exports the spec's
  `NavigationConfig` unchanged, while `objectql.ts` hand-declared a
  `ViewNavigationConfig` covering the same six keys with `mode` **required** — under
  a doc comment that itself claimed `@default 'page'`.

  The spec never asked for that. `@objectstack/spec` declares
  `mode: NavigationModeSchema.default('page')` in `NavigationConfigSchema`, and a
  `.default()` lands on the **authoring** side as `| undefined`, which is why the
  spec publishes its own type as the schema's `z.input`. So
  `navigation: { view: 'summary_view' }` is legal authored metadata that lets the
  mode default — and the hand copy refused it, at the three schema interfaces that
  spell `navigation?: ViewNavigationConfig` (`ObjectGridSchema`, `ObjectViewSchema`,
  `NamedListView`). Authoring one meant inventing a `mode` the renderer was going to
  default anyway, or writing an assertion.

  `ViewNavigationConfig` is now that spec type, per this file's own standing rule —
  "Never Redefine Types. ALWAYS import them." Measured against the published spec
  build, the hand copy had drifted on `mode` and nothing else: the other five keys
  carried the spec's exact value domains. The per-key documentation now lives with
  the schema in the spec instead of being restated here, so the `'page'` default no
  longer has a third place to fall out of sync.

  **No runtime behaviour changes.** A census of every `.mode` read in the repo found
  all of them to be `=== 'x'` comparisons or `navigation?.mode ?? 'page'` — no reader
  of this alias reads `mode` unguarded, so nothing observes the difference at run
  time. This is objectui#4550 / PR objectui#4586 one package over: that one collapsed
  `@object-ui/react`'s `NavigationConfig` to the same spec input, and this is the
  remaining half.

  Graded `minor` on the published-position analysis: in the built `.d.ts`
  `ViewNavigationConfig` occurs **only in input positions** — the three `navigation?:`
  properties of authored schema interfaces — and in **no** return type, since this
  package publishes no function that hands one back. For consumers the change is
  therefore purely permissive: everything that compiled still compiles, and
  spec-shaped configs that previously needed an invented `mode` now compile without
  one. That gained input shape is a capability rather than an internal repair, which
  is more than `patch` describes. The reader-side narrowing (`mode` is now
  `| undefined`) is real but secondary, and in-repo it has no affected reader.

### Patch Changes

- 92876f0: Doc comments no longer cite `@objectstack/spec` symbols the pinned spec has retired

  Eight exported declarations carried a doc comment claiming alignment with a
  `@objectstack/spec` symbol that `17.0.0-rc.6` does not export — four locale
  formatting shapes in `@object-ui/i18n` (`SpecPluralRule`, `SpecDateFormat`,
  `SpecNumberFormat`, `SpecLocaleConfig`) and four activity-feed shapes in
  `@object-ui/types` (`FieldChangeEntry`, `Mention`, `Reaction`,
  `RecordSubscription`). A citation that points at nothing is worse than a stale
  one: the next reader cannot tell whether the protocol retired the symbol,
  renamed it, or never had it.

  Measuring all eight against the published registry answered that question, and
  the answer was not "these names never existed". Every one was a real export the
  protocol retired on purpose, and every local key set was faithful to the schema
  it named. The feed four left `@objectstack/spec/data` in the `16.0.0` major,
  when the feed surface was replaced by the data API over `sys_comment` /
  `sys_activity`. The i18n four left `@objectstack/spec/ui` in `17.0.0-rc.6`
  itself — they were still present in `rc.5` — retired under ADR-0049
  enforce-or-remove because no authorable shape carried them and nothing ever
  parsed them.

  Each comment now records that provenance, including the version the symbol left
  and what (if anything) replaced it, so the shapes read as declarations these
  packages own rather than as a view onto a protocol type. Type shapes, runtime
  behaviour and exports are unchanged — the published `.d.ts` files differ only in
  comment text, which is why this is graded `patch`.

- abb0f81: A dashboard date filter's default has one spelling again — the bare preset name — and the `{ preset }` object becomes a documented legacy alias with a retirement window

  `@objectstack/spec` 17.0.0-rc.6 added a cross-field refinement to `GlobalFilterSchema` holding a `type: 'date'` filter's `defaultValue` to three spellings: a preset NAME (`last_7_days`), an ISO date (`2026-01-15`), or a date-macro token (`{today}`). objectui's derived schema had widened `defaultValue` to `z.any()` and did not carry the refinement, so it accepted `{ preset: 'last_7_days' }` — metadata the platform refuses. That is the tolerant-consumer shape where the designer goes green and the save fails server-side, and it is now closed: the refinement is adopted, the widening is retired, and the object form is refused with the spec's own message.

  Per the maintainer ruling on objectui#4165, the spec stays strict and the bare preset name is the single canonical spelling. `{ preset }` is handled as an ADR-0089 legacy alias rather than by a permanently tolerant schema: `liftLegacyGlobalFilterDefault` / `liftLegacyDashboardFilterDefaults` (new exports on `@object-ui/types`) convert it to the bare name, `@object-ui/core`'s `resolveDashboardFilterDefs` applies the lift when it reads a stored dashboard, and the console's dashboard designer applies it as the document enters the editable draft so the next save persists the canonical spelling. The retirement window is recorded at the read site: the alias may be removed in `@object-ui/types` 18.0.0, and every lift warns on the console so a surviving legacy document is visible rather than silently tolerated.

  No stored dashboard has to change for this release. The lift means a document carrying the object form keeps loading and rendering exactly as before — measured, not assumed: a legacy declaration already resolved correctly, because `{ preset }` also happens to be the runtime value shape objectui's own date filters use, and that coincidence is why the object form went unnoticed for so long. What changes is that the declaration is now canonicalized on read and rewritten on save, so the two spellings converge instead of accreting.

  The other two divergences in this schema — the bare-string `options` shorthand and the optional `optionsFrom.labelField` — are unaffected. Carrying the spec's refinement while keeping them needed a new composition: a refined object schema in zod 4 rejects `.extend()` and `.omit()` outright and types every `.safeExtend()` override as `never`, so objectui's schema now spreads the spec's shape and re-attaches the spec's object-level rules by delegating to the spec schema itself. Nothing restates the spec's grammar, and a refinement the spec adds later flows in with no change here.

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

## 17.4.0

### Minor Changes

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

- e6fdbdc: Reclaim the natural names `GestureType` and `GestureConfig` (objectui#3363).

  `@objectstack/spec` 17.0.0-rc.3 deleted the whole `ui/touch` module
  (objectstack#4988, PR objectstack#5321), vacating three names objectui had
  renamed **away from** in objectstack#4115 purely to avoid a collision. Two of
  those workarounds have now outlived their reason and are undone.

  ## Breaking, in FROM → TO form

  - `TouchGestureType` → **`GestureType`** — objectui's direction-fused recogniser
    vocabulary (`tap`, `swipe-left`, `swipe-up`, …).
  - `TouchGestureConfig` → **`GestureConfig`** — the flat gesture→`action` handler
    binding.

  Both are exported from `@object-ui/types` and re-exported by `@object-ui/mobile`.
  Nothing about either shape changed: same members, same optionality. Consumers
  import the new name; there is no other edit.

  **The old names are gone, not deprecated.** This follows the precedent set by the
  objectstack#4115 rename batch that introduced them, whose own migration note reads:
  "an alias would preserve exactly the ambiguity being removed". A deprecated alias
  would be worse here than in the general case, because the ambiguity these renames
  exist to prevent is between two same-named types — leaving `TouchGestureType`
  alive next to `GestureType` restores the two-spellings-one-concept problem while
  claiming to retire it.

  The retired spec vocabulary that used to hold these names still lives in
  `@object-ui/types`' `mobile` module under its deliberate `Spec…` prefix
  (`SpecGestureType`, `SpecGestureConfig`, `SwipeGestureConfig`, …), and that prefix
  is untouched — it is now the only thing distinguishing the two contracts, so
  `useSpecGesture` still maps one onto the other exactly as before.

  ## `PWAOfflineConfig` is deliberately NOT reclaimed

  The spec vacated `OfflineConfig` in the same retirement, but the spec was never
  its only claimant: that rename was a **cross-package arbitration between two
  objectui packages**, and `@object-ui/react` won it. `useOffline`'s config is the
  offline data/sync model key for key, so it holds the bare `OfflineConfig`, while
  this package's service-worker route cache stays `PWAOfflineConfig`
  (objectui#3156 / objectui#3159).

  Before objectui#3560 that name reached `@object-ui/react` from the spec, so the
  spec-side tripwire covered it by accident. Since the retirement it is declared
  locally in `packages/react/src/hooks/useOffline.ts`, which means the spec's
  vacancy no longer says anything about whether the name is free — it is not.
  Reclaiming it would put two different `OfflineConfig` shapes on the public
  surface of two packages that are routinely imported together, which is the exact
  ambiguity objectstack#4115 renamed it away from.

  `page-nav-misc-spec-parity.test.ts` now pins that reason directly instead of
  leaving it as prose: it asserts `@object-ui/react` still declares
  `OfflineConfig`, and its failure message tells the next reader that the reclaim
  has become available if it ever stops.

### Patch Changes

- d229dfa: `BulkActionParam.options` entries now accept the widget config the renderer already forwards

  The entry type was a closed `{ label, value }`, and it was the only layer in the
  path that said so. `bulkParamToField` spreads each entry into the metadata it
  hands the field widget (`{ ...o, value: String(o.value) }`), so extra keys
  survive; the destination shape `SelectOptionMetadata` declares `color` / `icon` /
  `disabled` / `visibleWhen` and `@object-ui/fields` genuinely reads them; and
  `@objectstack/spec`'s `BulkActionParamSchema` makes the same entry
  `.passthrough()`, so the server accepts them. Writing
  `options: [{ label: 'Purple', value: 'purple', color: '#8B5CF6' }]` therefore
  produced a TypeScript excess-property error on a configuration the renderer
  honours — the type rejected working metadata, which is the most expensive
  direction for an author (an AI author especially) that trusts it absolutely.

  The entry now carries a `[key: string]: unknown` catch-all, matching the one its
  parent `BulkActionParam` has had all along and the idiom `ActionParamOption`
  settled one interface over. `label` and `value` stay required and keep their
  exact types: open is not optional, and the catch-all is not an invitation to
  author new option keys — the authoring gate remains the spec's strict
  `SelectOptionSchema`. No runtime behaviour changes; the widening is
  backward-compatible for consumers.

- c2fd122: fix(actions): forward `bodyShape` end-to-end so a declared body wrap is honoured

  Sibling of the `bodyExtra` fix, same failure shape one key over. `bodyShape` is
  the spec's body-WRAPPING declaration for a `type: 'api'` action — `'flat'` (the
  default) or `{ wrap: key }` to nest the collected params under `key`, the shape
  better-auth's `organization/update` needs. The console `apiHandler` read it
  unconditionally while **no** action renderer forwarded it, so an author who
  declared `bodyShape: { wrap: 'data' }` on an `action:button` / `:group` / `:icon`
  / `:menu` action got a FLAT body on the wire: the endpoint received the params at
  the top level, and the declaration read as honoured because it parsed and
  published.

  The four declared-action renderers now forward the key, and `ActionSchema`
  declares it (typed by derivation from the spec, so the union cannot drift).
  `ActionRunner.executeAPI` — the fallback path taken when no host registered an
  `api` handler — now reads it too, closing a second asymmetry in which the same
  action changed body shape depending on which host executed it. The wrap covers
  the collected params only; `bodyExtra` and other top-level keys stay flat, which
  is the spec's own wording for the key and what both console read-sites already
  did.

  `element:button` deliberately does **not** forward it: its whitelist mirrors
  spec's `InlineActionSchema` pick list field for field, and that pick list does
  not include `bodyShape` — it is not inline vocabulary.

- 7e5bb5d: fix(actions): forward `bodyExtra` end-to-end through the action chain

  An action's static request body (`bodyExtra`) was dropped one hop before the
  `ActionRunner`: every action renderer forwards an explicit whitelist of keys, and
  none of them listed `bodyExtra`. Since `@objectstack/spec` 17 made it the only way
  a `type: 'api'` action can carry a payload (`params` keeps its single meaning as
  the parameter definition array), and the ADR-0087
  `inline-action-api-params-to-body-extra` conversion rewrites older object-form
  `params` pages onto it at load, a previously-working published page validated,
  published and then POSTed an empty body.

  `element:button`, `action:button`, `action:group`, `action:icon` and `action:menu`
  now forward the key; `ActionRunner.executeAPI` merges it into the request body
  **last** (so a constant always overrides a same-named user param, matching the
  console `apiHandler`); `ActionSchema` declares it; and a non-array `params` on a
  `type: 'api'` action keeps working for one version window with a dev-mode
  deprecation warning naming `bodyExtra`.

- 7e2b7e9: Fix saved list-view preferences never reading back (density, column widths, sort, hidden columns, inline edit)

  `listViewOverrides` in the ObjectStack adapter enumerated `GET /api/v1/meta/{objectName}` — putting the object name in the metadata **type** slot — while `updateViewConfig` persists under `type='view'`. The two key spaces are disjoint, so the batch map came back empty for every object and every personalization a user saved on a list view was written to the server but never read back, showing up as "the setting didn't save".

  The read now enumerates `type='view'` once and narrows to the object client-side, through the same accessor `listViews()` uses over the same rows — the metadata index is name-only, so there is no server-side `?object=` filter to push it into.

  Second half: the batch read no longer swallows its own failures into an empty map. An empty map is an authoritative "this object has no overrides" and callers may still trust it and skip the per-view reads (the batch optimization is intact), but a transport failure now rejects, so the per-view `getView` fallback it was silently disabling becomes reachable again. `DataSource.listViewOverrides` documents both terms so other adapters implement the same contract.

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

## 17.3.0

### Minor Changes

- 9e9e9a9: `DrillDownConfig` now declares only keys a renderer reads, and `target: 'navigate'` is honoured on charts too (#3354).

  **Removed — two keys no renderer has ever read.** `DrillDownConfig.view` (self-described as "reserved") and `DrillDownConfig.sort` ("default sort applied to the drill list") had zero read sites repo-wide: the drill drawer rendered its inline `object-data-table` regardless of `view`, and no widget put `sort` into the drilled table schema. Authoring either did nothing, silently. They are removed rather than implemented because nothing asked for them, and this interface is the shape the protocol's own `drillDown` declaration is being derived from (objectstack#5022) — left in place, they were about to become dead keys carrying protocol authority. Removing a declared key from a published interface is technically breaking for anyone who wrote one, but only in the sense that TypeScript now reports what was already true at runtime: the key did nothing. Per this repo's version policy the bump stays `minor` (the fixed release group tracks `@objectstack`'s major). A compile-time pin in `@object-ui/types` keeps both keys from drifting back without a reader.

  **Fixed — `ObjectChart` no longer degrades `target: 'navigate'` to a drawer.** All five widgets share `DrillDownConfig`, whose `target` JSDoc promises `'navigate'` skips the in-place view and opens the object's full list page when the host provides drill navigation. `DrillDownDrawer` delivered that for the table / pivot / metric widgets, but `ObjectChart` draws its own drawer and branched on `'dialog'` only — so `'navigate'` fell through to the default side sheet, indistinguishable from `'drawer'` even with a host handler wired. The chart now routes `'navigate'` through `DrillNavigationContext.openRecordList` with the same merged filter the drawer would have used, and keeps the documented fallback: with no host navigation handler it degrades to the drawer. `'drawer'` / `'dialog'` behaviour is unchanged, and the header's "Open in list" escape hatch stays independent of `target`.

  The `object-chart` registry input deliberately keeps advertising `target: 'drawer' | 'dialog'` only. `ChartDrillDownSchema` in `@objectstack/spec` declares the chart drill target as those two, strictly, and the publish-time react-page lint parses that schema against the authored literal — so listing `'navigate'` in the designer palette would offer authors a value the publish gate rejects. Widening the protocol union is a spec-side follow-up (objectstack#5435); `'navigate'` works today for any host that composes an `object-chart` schema directly.

- f44d872: `mobile.fullscreenLongText` finally reaches auto-generated long-text fields, and
  `mobile_fullscreen` gets one declared carrier (objectui#3245).

  FROM: `ObjectForm` stamped the flag onto the FormField itself
  (`{ ...f, mobile_fullscreen: true }`). TO: it stamps the flag onto the object the
  form renderer will actually forward to the widget as `field` — `f.field || f`,
  resolved exactly the way `renderFieldComponent` resolves it.

  **The flag's only legal carrier is the field metadata, and its only producer is
  `ObjectForm`.** That convention was already what the widget side assumed after
  objectui#3232/#3233 (`TextAreaField` reads `field.mobile_fullscreen` and nothing
  else, and `field` is the single metadata carrier); the producer was writing to a
  different object, so for auto-generated fields the two never met.

  What was broken, end to end: `ObjectForm` builds an auto-generated field as
  `type: 'field:textarea'` **and** stashes the object-field metadata on `.field`.
  The renderer forwards `field: field.field || field`, so the widget received the
  raw metadata — which never carried the flag — while the FormField-level copy was
  dropped by `stripRegisteredFieldProps`. Every entry point into `TextAreaField`
  therefore read `undefined` and the expand affordance never rendered. Only the
  hand-authored `customFields` path (no `.field` to shadow the FormField) ever
  worked, i.e. the feature was dead on the path virtually every form takes. Unit
  tests on both ends passed the whole time, because the break lived in the seam
  between them; this release adds the feature's first integration coverage — real
  `ObjectForm` → real form renderer → real `TextAreaField`, no mocks — which fails
  against the old producer and passes against the new one.

  `mobile_fullscreen` is now declared on `@object-ui/types`' `BaseFieldMetadata`,
  hence on every member of the `FieldMetadata` union that
  `FieldWidgetComponentProps.field` resolves to. It is deliberately **not** an
  `@objectstack/spec` property: nobody authors it on a field definition, it is a
  projection of the form-level `ObjectFormSchema.mobile.fullscreenLongText` setting
  onto the field metadata at render time. Declaring it removes the last untyped
  end of the chain — the producer's `as FormField` cast is gone — so the two sides
  can now disagree out loud instead of silently.

  The hand-authored `customFields` path keeps working unchanged, and keeps its own
  metadata: the flag is stamped on the FormField only when there is no `.field` to
  carry it. Synthesizing a `field` object in that case would light the affordance
  up while quietly replacing the field's `rows` / `placeholder` with defaults — the
  regression test pins that too.

- f833d3a: Retire `validation` from the action-param contract — it was declared on both
  halves, read by neither, and rejected outright by the server (objectui#3201).

  FROM: `validation?: string` was declared on the AUTHORING type
  (`@object-ui/types`' `ActionParam`) and on the RESOLVED type (`@object-ui/core`'s
  `ActionParamDef`). TO: it is declared on neither.

  **Breaking for anyone who declared it — but it never did anything.** This is
  marked `minor`, not `major`, per the repo's version-alignment policy (objectui's
  major tracks `@objectstack`'s, so objectui's own breaking changes ship as `minor`
  with the breaking semantics spelled out here).

  **Migration: delete it.** If you authored `validation: '...'` on an action param,
  it never took effect, and publishing that metadata to the server is a hard parse
  failure — so any metadata that reached production either never carried the key or
  never parsed. Removing it changes no runtime behaviour; it only moves the error
  from "silent no-op, then rejected at publish" to a `tsc` error at the keystroke.

  Why it could not work as authored:

  - `ActionParamSchema` in `@objectstack/spec/ui` is `.strict()` and does not list
    `validation`, so an authored key is a PARSE REJECTION on the server:
    `Unrecognized key(s) on this action param: \`validation\``. Meanwhile `tsc`
    against the public type accepted it — the type vouched for a key the platform
    itself refuses.
  - Nothing read it on the resolved side either: it was never a key of
    `resolveActionParams()`'s `RawActionParam`, the runtime field metadata a
    field-backed param inherits from carries no `validation` to source one from,
    and `paramToField()` never mapped it — so it could not reach the field widgets,
    whose rules `buildValidationRules()` builds from `required` / `minLength` /
    `maxLength` / `pattern`.

  Removed rather than implemented, on ADR-0049 enforce-or-remove. Giving it meaning
  would mean first deciding what an "expression" is here (CEL? a formula? a regex?)
  and adding it to `@objectstack/spec`, which is where such a capability has to
  start — not accreted renderer-side around a key the contract does not have.

  This also retires the last named exception in objectui#3174's drift guard
  (`packages/types/src/__tests__/page-nav-misc-spec-parity.test.ts`), which carried
  `validation` as the one key `ActionParam` added on top of the spec's set. The
  rule it pins — **the authoring type declares exactly the spec's authorable
  keys** — is now literal: the guard asserts the local-only key set is empty, so
  any future addition fails the build instead of being waved through.

- d22ae31: Track `@objectstack/spec` 17.0.0-rc.2 (objectui#3235, #3208, #3287, #3264).

  The pin moves from `^17.0.0-rc.1` to `^17.0.0-rc.2` across the workspace, and
  the sibling `@objectstack/*` packages (`client` / `core` / `formula` / `lint`)
  move with it — they pin `@objectstack/spec` **exactly**, so leaving them behind
  kept a second copy of the spec in the tree and would have had `@objectstack/lint`
  validating against rc.1 schemas that still accept keys rc.2 retires.

  Breaking semantics, in FROM → TO form:

  - **`app.homePageId` is retired — an app's landing page is now its first
    navigation item.** An app that pinned a landing page with `homePageId` will
    open on the first reachable navigation entry (by `order`) instead; the root
    landing still follows `isDefault`. To restore a specific landing page, reorder
    `navigation` so the intended entry comes first. Stored metadata is migrated by
    `os migrate meta --from 16`. The key is a hard error now, not a stripped one:
    the spec ships a tombstone that names the migration.
    Upstream retired it because of its SHAPE, not its usage — it was an ID
    cross-reference with no referential integrity, so a `homePageId` that pointed
    at nothing silently fell back to the first navigation item anyway
    (objectstack#4667, premise corrected in #4709). If the capability returns, it
    returns as a flag on the navigation item itself, which cannot dangle.
  - **`@object-ui/types`' `HttpMethod` now resolves to the spec's
    `HttpMethodType`.** Shape is verbatim identical — the same 5-value UI subset —
    and `@object-ui/types` still exports it as `HttpMethod`, so no consumer
    changes. The spec renamed its `./ui` export because `HttpMethod` named two
    different types depending on the import path (`./shared` / `./api` carry a
    7-value enum including `HEAD` / `OPTIONS`); objectui deliberately keeps the
    5-value one (objectstack#4691).
  - **`AppContextSelector.includeAll` / `placement` are gone.** Neither ever did
    anything in this renderer: context selectors are mandatory-scope, so no "All"
    row was ever rendered, and `placement: 'topbar'` put nothing in the topbar.
    Both carried schema defaults, which is why the liveness lint structurally
    could not flag them — removal was the only channel that reaches an author
    (framework#4509).
  - **`NavigationArea.visible` / `order` / `requiredPermissions` are gone.** An
    area is a layout grouping, not an access boundary. Gating moved down to the
    navigation ITEM, where `visible` and `requiredPermissions` are unchanged and
    still enforced. `AppSchemaRenderer`'s area switcher no longer hides an area, so
    an area whose items are all gated away renders as visible-but-empty rather
    than disappearing.
  - **`@object-ui/core` no longer exports `NotificationProtocol`**
    (`resolveNotificationConfig`, `specNotificationToToast`, `mapSeverityToVariant`,
    `mapPosition`, `ToastNotification`). It bridged `@objectstack/spec/ui`'s
    `Notification` / `NotificationConfig`, which objectstack#4610 deleted with no
    successor. Use `resolveNotificationConfig` from `@object-ui/react`
    (`NotificationContext`), which owns the live `NotificationSystemConfig` and is
    what every notification surface already read. Note that the spec's _other_
    `Notification` — `@objectstack/spec/api` — is the REST inbox row, a different
    contract, and is deliberately NOT aliased in as a replacement.
  - **The `email_template` client-side validator now uses
    `EmailTemplateDefinitionSchema`.** It was pointing at the removed
    `EmailTemplateSchema`, so authored templates were being checked against the
    wrong contract: the live one is keyed `name` + `locale` (not `id`) and splits
    the body into `bodyHtml` / `bodyText` (not `body` + `bodyType`)
    (objectstack#4616 / #4807).

  Fixes that are not breaking, but were only found because rc.2 stopped being
  lenient — each had been passing vacuously:

  - **`view` drafts are actually validated now.** The client validator named the
    aggregated container schema while this admin authors first-class `ViewItem`s,
    and the container used to strip `viewKind` / `config` in silence — so no view
    draft ever had one of its own keys checked. It now validates each shape
    against its own schema (objectui#3312).
  - **The console's worked examples were wrong**, and being stripped rather than
    refused: `view.list.object` (the container root already declares it),
    `job.concurrency` / `job.timeoutMs` (no such keys; the spelling is `timeout`,
    already in ms), `email_template.from` / `.to` (a template is not a send —
    the sender override is `fromOverride`, an object), and
    `datasource.capabilities` / `.healthCheck` (objectstack#4583 removed the
    former; the latter was never a datasource key). These are the drafts an
    author — or a model generating metadata — copies.
  - Action key inventory re-derived: `ActionSchema` gained the package-lock
    envelope (`_lock*` / `_package*` / `_provenance`), so a packaged action no
    longer reports them as unknown keys.
  - The schema-diff panel labels the new `default_mismatch` finding.
  - Test fixtures pinning the retired `managedBy: 'system'` bucket now use
    `engine-owned`. Protocol 17 split that value (objectstack#3355), so it
    resolved to the default-writable fallback and a batch of "stays locked"
    assertions had quietly stopped asserting anything.

### Patch Changes

- d915c47: The bulk selection bar now applies the ADR-0066 D4 `requiredPermissions` capability gate, and short-circuits a boolean `visible` instead of treating it as a broken expression (#3492).

  Two independent gaps put the selection bar out of step with the other three action surfaces. **First**, the capability gate: `action-bar.tsx` (list toolbar), `containers.tsx` (record header) and `RowActionMenu.tsx` (row kebab) all call `useCapabilityGate`, but `resolveBulkActions` dropped `requiredPermissions` when promoting an object action into a `BulkActionDef` and `BulkActionBar` never read it — so the same action was hidden from an unentitled user in the row kebab and offered to them in the selection bar the moment they ticked a checkbox. For a `type: 'api'` action pointed at a custom endpoint nothing behind it was guaranteed to say no. `BulkActionDef` now carries `requiredPermissions?: string[]`, the fold forwards it, and the bar filters on it with the engine's rule verbatim (empty declaration passes, several are AND-ed, unknown capabilities fail OPEN).

  **Second**, boolean `visible`: `partitionBulkRows` handed it straight to the CEL engine, producing `{ dialect: 'cel', source: undefined }` — a fault, which on this fail-closed path disqualified every selected record. So `visible: true` hid the button from everyone, the exact inverse of what it says; and `visible: false` rendered the button anyway, because the render guard tested `def.visible &&` for truthiness and read a declared `false` as "ungated". Booleans now short-circuit the way `useCondition` / `useRowPredicate` always have, and "is this def gated" is one shared predicate (`hasVisibilityGate`) rather than a truthiness test. `BulkActionDefSchema.visible` is `ExpressionInputSchema`, so `objectstack build` never emitted this shape — hand-written view JSON and in-process callers did.

- 23018cc: `record:highlights` now honours a `readonly: true` on an authored field entry, so a header chip for a platform-owned column no longer offers inline edit. `HeaderHighlight`'s editability gate already consulted `field.readonly`, but the renderer rebuilt each entry from a fixed `{name,label,icon,type}` list and dropped `readonly` one layer before that check, so the gate could never fire from authored metadata — a hook-maintained rollup or approval-written grade could be overwritten by hand from the detail-page header strip and stayed wrong until an unrelated write re-fired the computation. `readonly` is now a declared key on `HighlightField` and on the `RecordHighlightsComponentProps.fields[]` entry union, mirroring `DetailViewField.readonly` (objectstack#5077).

## 17.2.0

### Minor Changes

- 4ae0ac4: One placement rule for action `locations` (objectui#3142).

  **Breaking for metadata**: an action that declares no `locations` (missing key
  or `[]`) no longer renders in a located surface. FROM: omitting `locations`
  made an action appear on the list toolbar, the record header, and every
  metadata-admin toolbar. TO: declare where it belongs —
  `locations: ['record_header']` for the record header, `['list_toolbar']` for
  the list toolbar, and so on. Nothing else changes; actions that already
  declare a location are untouched.

  Four renderers each answered "where does an action with no `locations` go?"
  differently — `action:bar` and metadata-admin showed it EVERYWHERE,
  `page:header` showed it on the header, `action:group` showed it for
  `undefined` but hid it for `[]` — while `ActionEngine`, `RecordDetailView`,
  `DeclaredActionsBar`, the related-list bridge and the environment toolbar all
  showed it NOWHERE. The same action therefore appeared or vanished depending on
  which component happened to draw it. All eight now go through one exported
  predicate, `actionRendersAt(action, location)` from `@object-ui/types`: an
  action renders at a location only if it declares that location.

  The strict reading is the platform's own — ADR-0078 lists "an `action` with no
  `locations`" as a verified inert shape, and the detail-page synthesizer already
  documented "must include `locations: ['record_header']` to render". The
  leniency contradicted both, and it is what let an aggregate-only bulk action
  (objectui#3139) — one with no single-record placement by construction — mint a
  list-toolbar button whose dispatch could only fail.

  Two placements are declared elsewhere and need no `locations`, both unchanged:
  host-injected chrome in the `systemActions` / `headerSystemActions` slot (now
  consistently exempt on `page:header` too, where it used to be filtered), and an
  action named in a view's `bulkActions` / `bulkActionDefs`.

  Authoring side: Studio seeds `locations: ['record_header']` on a new action
  instead of minting one that renders nowhere, and the action inspector says so
  when no placement is ticked. The `ActionSchema.locations` JSDoc claimed a
  `['record_header']` default that no renderer ever implemented — corrected.

- 696e3c1: `reference` is the one authorable action-param picker target (objectui#3174).

  **Breaking for authoring**: `ActionParam` in `@object-ui/types` no longer
  declares the nine resolved-side picker keys — `referenceTo`, `displayField`,
  `idField`, `descriptionField`, `titleFormat`, `lookupColumns`, `lookupFilters`,
  `lookupPageSize`, `dependsOn`. FROM: `{ name: 'account_id', type: 'lookup',
referenceTo: 'account' }` type-checked. TO: `{ name: 'account_id', type:
'lookup', reference: 'account' }` — or make the param field-backed
  (`{ field: 'account_id' }`) and it inherits the whole picker group from the
  object field.

  The two halves of one contract disagreed about a spelling, and the type was the
  half that was wrong. `resolveActionParams()` reads the spec's `reference` for an
  inline `lookup`/`master_detail` target and nothing else; it EMITS
  `ActionParamDef.referenceTo`, the resolved spelling. The public authoring type
  declared the resolved spelling "for parity with the resolved shape", so an
  author who followed it got a param whose picker target was dropped in the
  resolver and a dialog that degraded to a plain record-id text input — asking a
  human to paste a UUID. The dev warning that fired then told them to declare
  `reference`, a key the type did not have.

  `reference` wins because the platform had already decided: `ActionParamSchema` in
  `@objectstack/spec` is `.strict()`, lists `referenceTo` **by name** in its
  alias map, and answers it with "use `reference`". So an authored `referenceTo`
  was never storable — it was a hard parse rejection on the server while `tsc`
  waved it through. Resolving it in objectui instead would have made the renderer
  accept metadata the platform itself refuses, and such a param would work in a
  locally-authored TS action and fail at publish; removing the declaration moves
  the failure to where it can be fixed, at the authoring keystroke.

  - **`@object-ui/types`**: the nine keys are gone, and the rule they violated is
    now pinned — `ActionParam` declares _exactly_ the spec's authorable key set.
    The drift guard names the single exception (`validation`, inert and rejected
    by the same `.strict()` parse — filed as objectui#3201) so a second one cannot
    appear without being a decision.
  - **`@object-ui/app-shell`**: `resolveActionParams()` names any resolved-only
    key it finds on an authored param in a dev-mode warning, with the
    prescription (`referenceTo` → "use `reference`"; the rest → "make the param
    field-backed"). It still does **not** read them. This covers the gap `tsc`
    cannot gate — params authored in plain JS, loaded from JSON, or synthesised
    at runtime — so the mistake is loud where it is made rather than surfacing
    downstream as `paramToField()`'s "no reference target" warning naming a key
    the author never wrote.

  The internal pipeline keeps its two spellings on purpose (authoring `reference`
  → `ActionParamDef.referenceTo` → the field's `reference_to`); what is pinned now
  is that the public entry and the public exit agree. The end-to-end test authors
  through the published `ActionParam` and follows one param to `reference_to` —
  every previous test authored the resolver's own local input interface, which is
  why the resolver only ever agreed with itself and the mismatch survived.

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

- 444457c: feat!: follow the framework's `managedBy: 'system'` → `'system-data'` retirement (objectstack#3355)

  **FROM → TO: `managedBy: 'system'` → `managedBy: 'system-data'`.** The framework
  retired the residual `system` bucket in protocol 17; this is the UI half of that
  change, landing with it so the closed `ManagedByBucket` union stays a mirror
  rather than a fork.

  ADR-0103 split the overloaded `system` bucket additively in v16 — the
  engine-owned objects moved to the explicit `engine-owned`, the admin/user-writable
  ones stayed on `system` — which left that value named after the half that had
  already moved out. `system-data` names what it actually holds: the SCHEMA is the
  platform's, the DATA is the admin's or the user's.

  **The derivation this deletes is the point.** Because v16's `system` doubled as
  both the engine-owned default and the writable set, three UI surfaces had to
  RECOVER the distinction from `userActions` at render time:

  - `isSystemWritable()` probed `userActions` for any opted-in write. It is now
    `managedBy === 'system-data'` — the bucket answers directly.
  - `ManagedByBadge` derived a synthetic `'system-writable'` variant key. The
    variant map is now 1:1 with the bucket union, so a new bucket is a compile
    error to miss instead of a silent fallthrough. The `systemWritable` /
    `system` i18n keys are **unchanged**, so no locale bundle moves.
  - `resolveManagedByEmptyState()` asked the resolved `create` affordance whether a
    `system` list should read "entries appear automatically" or show the New
    button. `system-data` now falls through to the generic empty state by
    definition; `engine-owned` keeps the automatic-entries copy.

  **Breaking (UI API):** `ManagedByBadge`'s `userActions` prop and the exported
  `ManagedByUserActions` interface are **removed**. The bucket alone selects the
  variant now, so the prop had become metadata nothing read — the exact defect the
  framework change exists to remove; shipping it as an accepted-but-ignored prop
  would have reproduced it one layer up. Drop the prop from call sites; no other
  change is needed.

  `MANAGED_BY_BUCKETS` and `ManagedByBucket` no longer contain `'system'`.

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

- 009e25d: Report / chart / query symbols stop wearing `@objectstack/spec`'s names
  (objectui#3155, objectstack#4115).

  **Breaking for TypeScript imports** — six exported names change. Each was a
  different concept than the spec export it collided with, so an author reading
  the objectui declaration as "the spec's" was reading a false claim:

  | was                 | now                      | why they were never the same thing                                                                                                                               |
  | :------------------ | :----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `ChartSeries`       | `ChartDataSeries`        | ours is a display name plus literal `data: number[]`; the spec's is a dataset-bound series descriptor (`type`/`stack`/`yAxis`/`variant`) with no data at all     |
  | `ChartSeriesSchema` | `ChartDataSeriesSchema`  | zod twin of the above                                                                                                                                            |
  | `QueryAST`          | `SqlQueryAST`            | ours is a compiled SQL syntax tree (`select`/`from`/`join`/`group_by`); the spec's is the ObjectQL request descriptor (`object`/`fields`/`where`/`expand`)       |
  | `QuerySchema`       | `DriverQueryConfig`      | ours is the high-level config `QueryASTBuilder` compiles; the spec exports that name as a zod schema value                                                       |
  | `DriverInterface`   | `SqlDriverInterface`     | ours is objectui's SQL-oriented client abstraction (`query(sql, params)`); the spec's is the platform runtime driver contract                                    |
  | `DatasourceSchema`  | `DatasourceRegistration` | ours is the in-memory record `DatasourceManager` holds — its `driver` is a live instance; the spec's is the authored metadata document, where `driver` is a name |

  Three more are now DERIVED from the spec instead of hand-restated, which fixes
  live silent-stripping defects, since a `z.object()` drops unknown keys:

  - **`DashboardWidgetSchema`** declared 10 of the spec's 22 keys, so
    `objectui validate` deleted the other 12 without a word — `chartConfig`,
    `colorVariant`, `filter`, `responsive`, `aria`,
    `actionUrl`/`actionType`/`actionIcon`, `compareTo`, `suppressWarnings` and the
    `requiresObject` / `requiresService` capability gates the dashboard renderer
    honours at runtime. The TS interface had declared most of them all along, so a
    widget could type-check and still lose half its configuration on validation.
    Pinned divergences kept: `id` stays optional, `type` stays widened for the
    objectui-only `list` / `custom` families, and the legacy `component` envelope
    stays.
  - **`GlobalFilterSchema`** took `scope` as a free-form string (any typo
    validated); it now uses the spec's `widget | dashboard` vocabulary. The three
    objectui widenings that back a real runtime normalizer are kept and pinned:
    the bare-string `options` shorthand, the normalized `{ preset }` date default,
    and an optional `optionsFrom.labelField`.
  - **`AppContextSelectorSchema`** was a full restatement; spec keys and their
    defaults now flow in by reference, with `label` widened for objectui's i18n
    label envelope — which `AppContextSelectors` already renders.

  `ListViewSchema`'s zod node now names the spec in its own initializer rather
  than one hop away through a local const, so its long-standing derivation is
  visible where it is declared.

  Drift guard: `packages/types/src/__tests__/report-chart-query-spec-parity.test.ts`.

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

- f572849: Fix the admission probes behind objectstack#4171's three inverted pins, and
  derive the `NavigationItem` keys that genuinely became derivable (objectui#3177).

  Spec 17.0.0-rc.1 typed `NavigationItem`, `FormField` and
  `ConditionalValidation.then`/`.otherwise`, so the `IsAny` / `IsUnknown` pins
  guarding them fired. Firing was supposed to mean "the burn-down is due". A
  per-symbol triage found it did not: **`any` was never the only blocker for any
  of the three**, so "no longer `any`" was never the right admission question.
  Nothing was bound; the probes now ask the condition that actually governs each
  symbol, and each still asserts today's state — so they pass now and stop
  compiling the day their own blocker lifts.

  - `NavigationItem` — the spec models navigation as a nine-variant discriminated
    union; objectui keeps one flat shape, and the spec has no counterpart at
    either tier for `visible: boolean` (which `menuItemToNavigationItem`
    manufactures when it inverts legacy `MenuItem.hidden`), `pinned` (backs
    `useNavPins`), the legacy `defaultOpen` spelling, or a separator carrying a
    `label`. Four probes, one per blocker.
  - `FormField` — two concepts on two layers, not two dialects of one: the
    required keys are disjoint (objectui `name` = the form data path; spec
    `field` = an object-field reference, with no `name` at either tier), and the
    shared `field` key is a string on one side and the resolved metadata object
    on the other. Binding would also collapse the objectui#3090 disambiguation
    that exports `SpecFormField` separately, and revert framework#4074's
    `dependsOn` widening.
  - `ConditionalValidation` — the branches went from `unknown` to
    `BaseValidationRuleShape`, which is `{ type: string; …; [key: string]:
unknown }`. Better than `unknown`, still not derivable: `type` is not a
    literal union so a branch cannot narrow by discriminant, and the index
    signature waves through any member — a typo'd `type: 'formatt'` included. The
    spec says so itself and names the remaining work as objectstack#4075. The
    probe now pins "literal discriminant / no index signature", so it goes green
    exactly when that lands.

  What DID become derivable is derived. `NavigationItemType` now comes off the
  spec's own nav-item discriminant instead of a hand-written nine-member copy —
  the objectstack#4115 failure class, and it also makes a future spec variant a
  compile error at exhaustive consumers rather than a silent `default:`. Same for
  `recordMode`, `filters`, `badge`, `target`, `params` and `actionDef`, each taken
  from the spec branch that owns it, extending the existing `badgeVariant`
  precedent. No member changes today, so no consumer is affected.

## 17.1.0

### Minor Changes

- 9e7349e: **`target` is the only action handler slot — the `execute` alias is gone from the renderer (framework#3856).**

  `ActionRunner.executeScript` read `action.target || action.execute`. That fallback
  is unreachable against `@objectstack/spec` 17: `execute` is now a tombstoned key
  (framework#3855) that the parser **rejects** with the rename prescription, so no
  parsed action can carry it and the `||` could only ever yield `target`. Verified
  against 17.0.0-rc.0 — an action declaring `execute` fails `ActionSchema.safeParse`,
  and a `target` action's parsed output has no `execute` key at all.

  Deleted rather than left as harmless residue: two handler slots is what let one
  action run one script server-side and a different one client-side (framework#3713,
  where this renderer preferred the alias while the spec transform preferred
  `target`). A dead slot still reads as a live contract to the next maintainer.

  `execute` is also **removed from the types**, which is the part that had never
  landed. framework#3856 predicted a compile error here; there wasn't one, because
  neither reader was typed against the spec's `z.infer`:

  - `@object-ui/types` `ActionSchema` hand-declared `execute?: string`. Removed, so
    `execute: '…'` now fails `tsc` at the authoring site (TS2353).
  - `@object-ui/core` `ActionDef` hand-declared it too. Removed — but `ActionDef`
    carries a `[key: string]: any` index signature, so stale hand-authored metadata
    that never passed through the parser still compiles. For that path
    `executeScript` now returns the rename prescription instead of a bare
    "No script provided", matching the spec tombstone's rule that removing an
    authorable key must be audible: silently binding no handler is the
    "Mark Done does nothing" shape (framework#2169).

  The four action renderers (`action:button`, `action:icon`, `action:menu`,
  `action:group`) no longer forward `execute` into the runner, and Studio's
  `ActionPreview` no longer falls back to it — previewing an alias-only draft as
  "bound" contradicted the parse that rejects it on save.

  Requires `@objectstack/spec` 17. Metadata still on the alias is rewritten by
  `os migrate meta --from 16`.

- 8864971: **The action sub-vocabularies derive from `@objectstack/spec` instead of restating it (framework#4074).**

  `packages/types/src/ui-action.ts` imported exactly one of the spec's action
  vocabularies — `ActionType`, derived in #2231/#2901 — and hand-declared the rest
  under doc comments claiming spec canonicity. `ActionLocation`'s comment said
  "Single source of truth lives in `@objectstack/spec/ui` … **re-export** here"
  while the code re-_declared_ a parallel union, `as const` tuple, and `z.enum`.

  That is why framework#3856 predicted a compile error when spec 17 removed
  `action.execute` and there wasn't one: nothing in this package was bound to the
  spec's `z.infer`, so a key removal upstream produced no signal here.

  **Already drifted, not merely drift-prone.** `ActionParamSchema.type` is
  `FieldType.optional()` and `FieldType` carries **49** members; the hand-written
  `ActionParamFieldType` listed **16**. A spec-valid param typed `lookup`,
  `multiselect`, `currency`, `user`, `tags` or `json` failed `tsc` against this
  package even though `ActionParamDialog` renders it — the same failure `ActionType`
  had before it was derived (missing `form` while `ActionRunner.executeForm`
  implemented it).

  - `ActionLocation` / `ACTION_LOCATIONS` / `ActionLocationSchema` are now the spec's
    own three symbols, re-exported. `ACTION_LOCATIONS` and `ActionLocationSchema`
    stay **value** exports, as #2561 decision (a) explicitly keeps them.
  - `ActionComponent` is `NonNullable<Action['component']>`. Read off the spec's
    resolved `Action` rather than `ActionSchema.shape.component`, because spec
    exports `ActionSchema` as a `lazySchema` proxy that does not forward `.shape`.
  - `ActionParamFieldType` is the spec's `FieldType` (16 → 49 members), with
    `ACTION_PARAM_FIELD_TYPES` as its runtime witness.
  - `ActionParam` gains the 13 optional capability fields it could not express —
    `visible`, `accept`, `maxSize`, `multiple`, and the lookup-picker group
    (`referenceTo`, `displayField`, `idField`, `descriptionField`, `titleFormat`,
    `lookupColumns`, `lookupFilters`, `lookupPageSize`, `dependsOn`) — all of which
    `@object-ui/core`'s `ActionParamDef` already declares and app-shell's
    `paramToField.ts` maps into the shared field renderer (ADR-0059).

  **The legacy param spellings are now named, not hidden.** `paramToField.ts` folds
  `checkbox` → `boolean`, `reference` → `lookup`, `datetime-local` → `datetime`.
  None is a spec `FieldType`, so deriving `ActionParamFieldType` alone would have
  made authored metadata a type error. They are declared as
  `ObjectUiLocalParamFieldType` / `OBJECTUI_LOCAL_PARAM_FIELD_TYPES` and
  `ActionParam.type` accepts `ResolvableParamFieldType` (spec ∪ local) — the same
  shape `ObjectUiLocalActionType` / `RunnableActionType` already use for
  `navigation`, and for the same reason: a dialect hidden inside a
  `Record<string, string>` in another package is invisible to an importer.

  **Breaking:** `ActionParamFieldType` widens from 16 members to 49, so an
  exhaustive `switch` over a param `type` in a host app stops being exhaustive. The
  16 old members are all still valid, so no authored metadata breaks. The added
  `ActionParam` fields are optional and additive.

  Not included, and still open on framework#4074: `ActionParam`'s `name` / `label` /
  `type` stay required where the spec makes them optional, and the
  `field` / `objectOverride` field-reference form remains unrepresentable. Both are
  breaking in a way that needs its own migration note.

- b41f401: **Authoring types are input types (framework#4074 steps 2–3): `ActionParam` takes the spec's declaration forms, `ListViewSchema` stops promising parse-output defaults, and `FormField.dependsOn` matches its runtime reader.**

  Three public types said something different from what the platform accepts. All
  three divergences were found by making `packages/types`' tests compile (#3009)
  and then resolving the declared `p1-spec-alignment.test.ts` debt site-by-site
  instead of papering over it.

  **`ActionParam` is now the authoring shape, aligned with the spec's input.**
  `name` / `label` / `type` become optional and `field` / `objectOverride` appear:
  the spec's primary way to declare a param — a bare field reference that inherits
  label/type/validation/options from an object field — was unrepresentable while
  all three were required. The _resolved_ shape the dialog consumes (after
  app-shell's `resolveActionParams()` inlines the reference) remains
  `@object-ui/core`'s `ActionParamDef`, with all three required. Authoring and
  resolved are different types on purpose. `label` and option labels take the
  spec's `I18nLabel` by import — which the new compile-time guard promptly
  revealed to be aliased to plain `string` in the current spec (the per-locale
  record is the separate `I18nObject`), so this is not a behavioural widening
  today; importing the alias means objectui tracks any future widening
  automatically.

  **Breaking:** code destructuring `param.name` / `param.label` / `param.type` as
  guaranteed must now handle the field-backed form (or consume the resolved
  `ActionParamDef` instead, which is what dialog-side code should be doing).

  **`ListViewInferred` is `z.input`, not `z.infer`.** The spec sub-schemas that
  flow into the list-view surface (`userActions`, `tabs` → `ViewTab`, `sharing`)
  carry `.default()`s, so the inferred output type made fields like
  `userActions.refresh` or a tab's `pinned`/`visible` _required_ — but nothing on
  the render path ever runs `.parse()`: `normalizeListViewSchema` deliberately
  applies no defaults ("an absent flag stays absent", its own suite). The output
  type therefore rejected valid authored metadata (`userActions: { sort: true }`)
  while promising renderers defaults that never arrive. Typing the surface as
  input matches both the author and the runtime object. Code that _trusted_ those
  phantom defaults now gets an optionality error — which is a latent bug surfacing,
  not a regression: the value really could be absent.

  **`FormField.dependsOn` is `DependsOnInput`.** The runtime reader
  (`resolveCascadingOptions`) has always accepted a bare name, a list of names, or
  lookup-parameter entries `{ field, param }` — its parameter type says so. The
  public property said `string`, so array-authored metadata type-errored while
  working, and the form renderer read the key through `(f as any).dependsOn` to
  get past its own type. The shape now lives in `@object-ui/types` (single source
  of truth next to `FormField`), `@object-ui/core` imports and re-exports it, and
  the two `as any` reads in the components form renderer are typed.

  **The `p1-spec-alignment.test.ts` exclusion is gone.** Its 14 errors resolved:
  the two "sharing in ObjectUI format" tests and the legacy-ARIA-spelling fixture
  are deleted/rewritten — those dialects are _normalizer input_, folded by
  `normalizeListViewSchema` and asserted branch-by-branch in core's
  `normalize-list-view.test.ts`, the seam where the fold actually runs; asserting
  them on the canonical type only ever "passed" because nothing compiled the file.
  One fixture claimed a shape no surface ever admitted (an ObjectQL triplet as a
  spec `ViewTab.filter`) and was corrected to the rule-object form. Every test
  file in `@object-ui/types` is now compiled, with no exclusions.

  Discrimination-checked: reverting `ListViewInferred` to `z.infer`, `dependsOn`
  to `string`, or `ActionParam.name` to required each produces the expected
  compile error in the now-compiled test files (`TS2739` / `TS2322` / `TS2741`);
  restored, all projects are clean.

- 38ca8be: refactor(fields): `requiredWhen` is the only required-predicate slot — drop the retired `conditionalRequired` alias

  `@objectstack/spec` 17 (objectstack#3855) **retired** `Field.conditionalRequired`,
  the long-deprecated alias of `requiredWhen`. ObjectUI carried a back-compat read
  for it in seven places; all of them are removed.

  The removal is safe because the spec did not merely _stop emitting_ the key — it
  made authoring it **fail loudly**. `retiredKey()` declares the key as
  `z.never()`, so:

  - `z.input` types it as `never` — writing it is a `tsc` error at the authoring site;
  - the parse **rejects** it (verified against `17.0.0-rc.0`), at both `FieldSchema`
    and `ObjectSchema`, with the prescription as the message:

    > `conditionalRequired` was removed in @objectstack/spec 17 (#3855) — use
    > `requiredWhen`. Rename the key; the value (a CEL predicate) is unchanged.
    > Run `os migrate meta --from 16` to rewrite it automatically.

  So spec-parsed metadata cannot carry the key — an object declaring it fails to
  load rather than loading with the rule silently dropped. Keeping a renderer-side
  `requiredWhen ?? conditionalRequired` would have re-created exactly the second
  de-facto contract the tombstone exists to prevent: the key would have kept
  working in the UI while being rejected everywhere else, hiding the producer's bug
  (AGENTS.md #0.1). "Backend-agnostic" (#1) does not argue for keeping it either —
  `conditionalRequired` is an ObjectStack-spec-ism, so the only producers that ever
  emit it are ObjectStack producers on ≤16, and the spec ships them a converter.

  Removed from:

  | package                  | site                                                                                                      |
  | :----------------------- | :-------------------------------------------------------------------------------------------------------- |
  | `@object-ui/types`       | the `conditionalRequired?:` member on `FormField`                                                         |
  | `@object-ui/core`        | the `??` fallback + rules-param member in `resolveFieldRuleState`                                         |
  | `@object-ui/components`  | three pass-throughs in the form renderer                                                                  |
  | `@object-ui/plugin-form` | `ObjectForm`, `ModalForm`, `sectionFields`, `deriveMasterDetail` (×2)                                     |
  | `@object-ui/app-shell`   | the field inspector's legacy read/auto-migrate, and the key's entry in `clientValidation`'s CEL lint list |

  **Studio authors lose nothing.** The object designer's draft validation parses
  against the spec's own `ObjectSchema`, so a draft carrying the key now surfaces
  the tombstone's rename prescription under the same `fields.<name>.conditionalRequired`
  path the CEL lint used to report — a better message than the inspector's silent
  auto-migration, and one the server agrees with. That behavior is pinned by a test.

  **Migrating:** rename the key to `requiredWhen` (the CEL value is unchanged), or
  run `os migrate meta --from 16`.

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

- 49e5671: fix(console): `LocalizationFetchProvider` retries a transient `/me/localization` failure instead of degrading for the whole session

  `/auth/me/localization` is served by the environment kernel that owns the session
  on a multi-tenant host, and a cold one answers `503` + `Retry-After` while it
  warms (objectstack#4159). A transient failure is therefore a normal part of a
  cold start — not an exception.

  The provider made ONE attempt and `.catch()`-ed into silence. So a single 503
  during warm-up left currency and locale unset for the **whole session**, silently
  and permanently, long after the kernel was ready. Every money field rendered a
  plain number and nothing ever tried again.

  It now re-attempts a transient failure (`408`, `425`, `429`, `502`, `503`, `504`,
  or a thrown fetch), server-stated `Retry-After` first, exponential backoff
  otherwise. `401` / `403` / `404` / `500` are real answers about the caller and
  still fail on the first attempt.

  **It keeps its posture.** This provider is cosmetic, so it renders children
  throughout — including mid-retry — and fills the value in if and when an attempt
  succeeds. That is the opposite of `MePermissionsProvider`, which is fail-closed
  and holds its loading state across the waits. Both are pinned by tests.

  The retry PRIMITIVES ("is this transient", "how long to wait", `Retry-After`
  parsing) move from `@object-ui/permissions`'s internal module to
  `@object-ui/types` — the lowest package both callers can reach — and
  `PermissionsFetchError` becomes the generic `HttpFetchError`. One definition of
  transient, two policies, rather than a second copy free to drift from the first.
  No behaviour change for `MePermissionsProvider`.

- b5b97e2: fix(types,layout): nav item type `component` joins `NavigationItemType` and its zod enum — objectui#2918

  The renderers have carried a full `type: 'component'` implementation (Phase 3b:
  `componentRef` colon-split to `/component/<ns>/<name>`, `params` serialised as
  querystring, `metadata:*` special-cases) — but the vocabulary never gained the
  member, and `@objectstack/spec` has had `ComponentNavItem` all along. The zod
  enum was the part that bit: `NavigationItemTypeSchema` rejected
  `type: 'component'` at validation time, so authors could not declare one and
  the renderer half was unreachable — dead on arrival rather than dead code.

  - `NavigationItemType` and `NavigationItemTypeSchema` gain `'component'`;
    `NavigationItem` gains the fields the renderer consumes, `componentRef` and
    `params` (also used by `type: 'page'`), mirroring spec's `ComponentNavItem` —
    declared in zod too, so parse no longer strips them.
  - The `(item as any).componentRef` / `params` casts in `NavigationRenderer`
    and `AppSchemaRenderer` become typed access.
  - `NavigationDesigner`'s exhaustive type-meta map gains a `component` badge
    (new `appDesigner.navTypeComponent` key in all 10 locales).
  - `@object-ui/layout` gains `type-check` (src + tests) with the #2915 `paths`
    override; its DEBT entry in `check-type-check-coverage.mjs` is deleted.

- f59f2c1: refactor(actions): `navigation` becomes a named alias of the spec's `url`, sharing one navigator (#2944)

  The last open item of #2944: `ActionRunner` dispatched a seventh action type,
  `navigation`, that `@objectstack/spec`'s `ActionType` does not contain. The issue
  asked for a decision — promote it upstream or delete the case. Neither, as stated.

  - **Promoting it is wrong.** The spec already has `url` for "go to a location",
    with `openIn` for the new-tab/same-tab choice. A seventh type would put a
    second spec name on one operation, which is the exact failure the #2901 audit
    is named after: _a second definition of the vocabulary exists, and the renderer
    is faithful to the wrong one_.
  - **Deleting it is worse, because it is silent.** `{ type: 'navigation', to: … }`
    is authored today (`element:button` CTAs). Without the case the action falls
    through to `executeActionSchema`, which returns `{ success: true }` — a green
    toast that navigates nowhere. That is #2960's trap.

  So it stays, but stops being dialect. `ObjectUiLocalActionType` /
  `OBJECTUI_LOCAL_ACTION_TYPES` in `@object-ui/types` declare it as objectui's own
  alias of `url` — the same treatment #2985 gave `PageVisualizationAlias` — and the
  runner routes both names through one navigator.

  **The alias had already drifted, which is the point.** `executeNavigation` was
  quietly the weaker of the two implementations: no `${param.X}` / `${ctx.X}`
  interpolation, `openIn` ignored, and no `/api/…` full-page short-circuit (the
  redirect-dance case `url` exists to handle). An author who wrote
  `{ type: 'navigation', to: '/x?p=${param.p}' }` shipped the literal `${param.p}`,
  while the identical `url` action resolved it. Both names now behave identically;
  `url` in turn gains `replace` pass-through, the one modifier only the alias had.

  Additive only. `replace` is omitted from the `NavigationHandler` options object
  when unset, so hosts see the option shape they already saw.

  The new guard is structural rather than another assertion. The runner's built-in
  dispatch is a table typed `Record<RunnableActionType, …>` instead of a `switch`,
  so an `ActionType` the spec **adds** stops compiling until an executor exists for
  it — the Tier-2 "validates at save, renders nothing at run time" failure (#2942)
  becomes a build error for actions. `spec-derived-unions.test.ts` additionally
  asserts `navigation` is _absent_ from the spec enum, so the day it is adopted
  upstream, the test fails and names the alias to retire.

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

- ea7f477: refactor(types): retire the five forks that shadowed a `@objectstack/spec` vocabulary (#2944)

  Five declarations in `@object-ui/types` restated a spec vocabulary, four of them
  re-exported under **the spec's own symbol name** — so an importer could not tell
  which definition they had. Every one had already drifted:

  | Declaration                                   | Was                           | Spec      |
  | --------------------------------------------- | ----------------------------- | --------- |
  | `ChartTypeSchema` (`zod/data-display.zod.ts`) | 7 values                      | **19**    |
  | `ChartType` (`data-display.ts`)               | 7 values                      | **19**    |
  | `PageTypeSchema` (`zod/layout.zod.ts`)        | 4 — no `list`                 | 5         |
  | `PageType` (`layout.ts`)                      | 10 — five the spec repudiates | 5 + local |
  | `ReportType` (`reports.ts`)                   | 3 — no `joined`               | 4         |
  | `ActionType` (`ui-action.ts`)                 | 5 — no `form`                 | 6         |

  All are now the spec's schema by reference, or its type re-exported/derived.

  **This is why #2901 was filed with an inverted premise.** It read the 7-value
  `ChartTypeSchema` as the protocol and concluded `plugin-charts` had outgrown it
  with renderer-local dialect. The spec has 19; the 7-value list was this fork.

  **Widening only for consumers.** `ActionType` gains `form` (which
  `ActionRunner.executeForm` already implemented, so a host app previously got a
  type error on working code), `ReportType` gains `joined`, `ChartType` goes 7 → 19,
  and `PageTypeSchema` gains `list`. Nothing was removed, so no existing value
  stops type-checking or validating. Verified against the whole repo: 76/76
  type-check tasks and 8215 tests pass.

  **`PageType` keeps a named local extension.** `grid`/`gallery`/`kanban`/
  `calendar`/`timeline` are visualizations, not page kinds — `ui/page.zod.ts` says
  so outright — but narrowing them away is a breaking type change for anyone
  assigning `pageType: 'kanban'`. They are now `PageVisualizationAlias`, a
  sanctioned and documented local extension (issue #2231's prescription) rather
  than five names hidden inside a hand-written union. Removing it is the separate
  "visualizations are not page types" cleanup.

  Guarded going forward: `spec-subschema-parity.test.ts` pins the two zod schemas
  **by reference** (a faithful copy fails, because a copy is a fork), and the new
  `spec-derived-unions.test.ts` covers the type aliases, which reference identity
  cannot reach.

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

- 03bd53b: feat(form): `SplitForm` honours the spec's new `FormSection.pane`

  A split form's panel assignment was a hardcoded positional rule — first section
  left, everything else right. The rule was invisible in the metadata, so
  reordering sections silently moved them across the divider, and an author could
  not place two sections in the left pane at all.

  Sections now declare their panel: `pane: 'primary' | 'secondary'`
  (@objectstack/spec `FormSection.pane`, objectstack#4160). Placement follows the
  key, not the array position — reordering paned sections never changes the
  layout. Omitted keys keep the exact legacy rule (first section `primary`, rest
  `secondary`), so existing metadata renders unchanged.

  `ObjectForm`'s split dispatch copies the key through its per-key section mapping
  (the path that once silently dropped `visibleOn`), and `ObjectFormSection`
  declares it. The spec side rejects `pane` on non-split form types at parse, so
  the key can never be an accepted-but-ignored no-op.

- 912496d: feat(types,core): the `*Validation` rule types derive from spec 17, and the engine agrees with the server — objectstack#4115

  The five spec-named rule variants in `data-protocol.ts` were hand-written
  interfaces, each labelled `(ObjectStack Spec v2.0.1)` while the installed spec
  was `17.0.0-rc.0`. Nothing bound them to the spec, so fifteen majors of drift
  accumulated with `tsc` silent throughout and the comment still vouching for it.
  They are now `z.input` derivations of `ScriptValidationSchema` /
  `StateMachineValidationSchema` / `CrossFieldValidationSchema` /
  `ConditionalValidationSchema` / `FormatValidationSchema`, and canonicity is
  carried by that binding plus a parity gate rather than by a comment (#3017).

  `z.input`, not `z.infer`, because objectui consumes **authored** metadata as it
  arrives over `/meta` — before the spec applies its defaults and canonicalizes
  expressions. That is the shape actually in the JSON.

  **Breaking, in the shape of the rule types** (minor per this repo's version
  policy — see AGENTS.md §9):

  |                                   | was                                         | is                                                      |
  | --------------------------------- | ------------------------------------------- | ------------------------------------------------------- |
  | `ConditionalValidation`           | `condition` + `rules[]`                     | `when` + `then` / `otherwise`                           |
  | `FormatValidation`                | `pattern` + `flags`, 8 named formats        | `regex`, the 4 formats the server implements            |
  | `Script`/`CrossField` `condition` | `string`                                    | `string \| { dialect, source }`                         |
  | `StateMachineValidation`          | —                                           | gains `initialStates` (objectstack#3165)                |
  | `BaseValidation`                  | no `priority`, `events` included `'delete'` | gains `priority`; `'delete'` retired (objectstack#3184) |

  `UniquenessValidation` / `AsyncValidation` / `RangeValidation` are now
  `@deprecated`. They have no spec counterpart — the spec removed the first two
  deliberately (uniqueness → a unique index, since SELECT-then-INSERT is racy;
  async → the form layer) — and the spec's `ValidationRuleSchema` rejects all
  three, so no rule in those shapes can ride in `ObjectSchema.validations`.

  **`ObjectValidationEngine` now agrees with `objectql`'s rule-validator.** It is a
  client PRE-CHECK of rules the server enforces, so every disagreement cost the
  user something real. Fixed:

  - **Polarity was inverted.** The server violates a rule when the predicate is
    TRUE; the engine violated it when the predicate was FALSE. Every
    spec-authored `script` / `cross_field` rule produced the opposite verdict.
  - **Envelope conditions were a silent no-op.** `{ dialect, source }` reached
    `expression.trim()`, threw, was caught, and read as "passes".
  - **`conditional` was a silent no-op**, reading `rule.condition` / `rule.rules`
    where the spec says `when` / `then`; `otherwise` was never evaluated at all.
  - **`format` produced FALSE REJECTIONS** — it read `rule.pattern`, and
    `undefined.test(...)` threw into a catch that reported a violation, blocking
    writes the server accepts.
  - **An absent `active` disabled the rule** and an absent `events` threw; both
    arrive absent from `/meta` because the spec defaults them at parse time.
  - `priority` now orders execution; `initialStates` is enforced on insert;
    `format`/`state_machine` only fire when the write touches the field; a broken
    predicate or an uncompilable `regex` fails OPEN with a warning; and a rule type
    the engine cannot evaluate (the spec's `json_schema`) warns instead of
    reporting the record as valid.

  The default `SimpleExpressionEvaluator` is not CEL and never was; it now binds
  both the spec's `record.x` scope and objectui's historical bare `x`, and
  documents that richer predicates need a CEL-backed evaluator. `validateRecord`'s
  `event` parameter no longer accepts `'delete'`.

  Gates: `packages/types/src/__tests__/validation-rule-spec-parity.test.ts` (key
  sets, wire shapes, the pinned `then`/`otherwise` divergence with an inverted pin
  that fails when objectstack#4171 is fixed upstream) and the rewritten engine
  suite. objectstack#4115's ledger drops 120 → 115.

### Patch Changes

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

- 7639a61: fix(form): the spec↔runtime form-field chokepoint stops dropping spec 17 vocabulary, and the validator stops contradicting the renderer — #3090

  `normalizeSectionField` — the one translation point between the spec's authored
  form-field shape (`field` = object-field reference) and the runtime shape
  (`name` = data path) — silently dropped four spec keys, worst of all the
  ADR-0089 **canonical** `visibleWhen` spelling while the deprecated `visibleOn`
  worked. Now:

  - view-level `visibleWhen` routes into the view-level slot (`visibleOn`) so it
    ANDs with the object-level rule instead of clobbering it, and the wizard's
    final-submit gate folds the same slot into its verdict (before, a required
    field the view itself hides could block submission from off-screen);
  - `dependsOn`, `keyField`, and `disclosure` carry through;
  - a behavioral parity gate walks the spec `FormFieldSchema` key set — a key the
    spec adds fails as unmapped, a key it retires fails as stale.

  `SelectOptionSchema` is now derived from `@objectstack/spec/data` by reference
  (it used to strip `color` — which `@object-ui/fields` renders — plus `default`
  and the per-option `visibleWhen` gate), with pinned divergences (`value`
  widened for UI forms, `visibleWhen` on the #2212 wire contract) and documented
  UI-only extensions (`disabled`, `icon`). `SelectOption` (TS) gains `color` and
  `default`.

  `FormFieldSchema` (the runtime vocabulary `objectui validate` enforces) now
  covers every key the `FormField` interface declares — `widget`, `dependsOn`,
  `hidden`, `readonly`, `visibleOn`/`visibleWhen`/`readonlyWhen`/`requiredWhen`,
  `span` — and `type` is optional, matching the interface. A typo'd predicate now
  fails loudly instead of being stripped; spec-shape fields (`{ field: … }`) are
  still rejected, pinning the two-layer boundary.

- 94e63ef: fix(form): the runtime `field` metadata slot is declared instead of smuggled, and importing the spec's FormField is a lint error — #3090

  `FormField.field` — the slot where object-bound form paths stash the resolved
  field-metadata **object** for widgets — rode through the index signature,
  undeclared, readable only via `as any`. Same key, different layer: in the spec
  form-view vocabulary `field` is a _string_ (the referenced object-field name),
  and the undeclared slot kept that pun latent. The slot is now declared
  (`field?: Record<string, any>`) with the invariant in its JSDoc: on a runtime
  FormField it is never a string — the authored string form ends at the
  `normalizeSectionField` chokepoint, and a tripwire test pins that across all
  three input shapes. Assigning a string is now a compile error; the `as any`
  casts at the read sites are gone.

  A `no-restricted-imports` tripwire bans importing `FormField`/
  `FormFieldSchema` from `@objectstack/spec/ui` inside this repo: the spec's
  FormField TYPE erases to `any` in its dist (objectstack#4171), so the
  misimport silently deletes type safety — tsc says nothing. The lint message
  names the two layers and the correct import. The drift-guard parity test is
  the one legitimate importer, exempted inline with its reason.

  Ledger: `FormField` and `FormFieldSchema` move from untriaged DEBT to ALLOW
  with the two-layer rationale written down (122 → 120).

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

- 7f23cd0: fix(form): a numeric/boolean select option survives selection with its type intact — #3090

  `SelectOptionSchema.value` has accepted `string | number | boolean` for as
  long as it has existed, but the Radix controls underneath speak strings:
  picking `{ value: 2 }` silently submitted `"2"` — a wrong-typed write into a
  number field that nothing on the client ever reported. (Display half-worked:
  a numeric default matched its numeric item; only SELECTION morphed the type.)

  The renderers now stringify on the way into the control and map the selection
  back to the AUTHORED option value on the way out (`matchOptionValue`), across
  the in-form select, the standalone `type: 'select'` component, and the
  standalone `type: 'radio-group'` component. The TS types stop lying to match:
  `SelectOption.value` / `RadioOption.value` and the corresponding
  `value`/`defaultValue`/`onChange` channels widen to what the zod schemas
  always accepted — a call site treating `option.value` as `string` is now a
  compile error pointing at a real latent crash, not a false comfort.

  The ripple the widening named, handled at each boundary: `@object-ui/core`'s
  `OptionLike.value` widens (the option engines compare by identity, so values
  flow opaquely; the option-lint's CEL-literal domain stringifies at its
  boundary), and the multi-value field widgets (checkboxes / multiselect /
  radio) stringify at theirs — multi-value fields store string arrays.

  Round-trip pinned by real Radix interactions in jsdom: the in-form select
  submits `2` (number), the standalone select hands its handler `false`
  (boolean).

- 3a6cf24: refactor(types): bind seven spec-named symbols to the spec instead of re-declaring them — objectstack#4115 ledger burn-down

  The `check-spec-symbol-derivation` ledger opened at **156** untriaged collisions.
  This is the first tranche: **149** remain, and every symbol removed was _proved_
  equivalent to the spec's before being replaced, not assumed equivalent because
  its doc comment said so. Four of the seven carried exactly such a comment —
  "Mirrors the server's `ImportWriteMode` (`@objectstack/spec`)", "(ObjectStack
  Spec v2.0.1)" — which is the claim this issue exists to make true.

  Bound as re-exports (`@objectstack/spec/api`, `/kernel`, `/ui`):
  `BreakpointName`, `ExportJobStatus`, `ImportJobStatus`, `ImportWriteMode`,
  `ValidationError`.

  Derived with `z.infer` (`@objectstack/spec/data`): `JoinStrategy`,
  `WindowFunction` — the spec exports these as zod enums rather than as types, so
  a re-export would not compile against them.

  All seven are structurally unchanged, so no consumer changes: the full repo
  type-check passes 76/76.

  **What decided the tranche.** Mutual assignability (`[Local] extends [Spec]` and
  back) looks like the obvious test for "is this a safe re-export", and it lies in
  three ways, all of them present in this repo:

  - The **spec's own** export resolves to `any` — `NavigationItem`, `JoinNode`,
    `FormField`. Binding these would replace a precise local interface with `any`,
    a type-safety regression wearing a burn-down's clothes. A naive probe reports
    them as "identical to the spec" and recommends exactly the wrong edit.
  - The **local** declaration resolves to `any` — recursive zod schemas annotated
    `z.ZodType<any>` (`FilterConditionSchema`, `NavigationItemSchema`).
  - The local declaration carries `[key: string]: any` — the objectstack#4075
    mechanism, which absorbs any extra member so two types compare equal while
    accepting wildly different objects (`FormField`, `AppSchema`, `PageSchema`,
    `ThemeSchema`, and 12 more).

  A zod schema needs one question more than a type does: `FormFieldSchema` has an
  **identical `_output` and a divergent `_input`**, so re-exporting it would have
  silently changed what authoring input parses. All of this is now written into the
  ledger's burn-down instructions, with the detection probe for each case.

  `spec-derived-unions.test.ts` gains an **inverted pin** for the three spec-side
  `any` cases: it asserts they are _still_ `any`. The day the spec types any of
  them properly the assertion stops compiling, and the failure is the instruction
  to re-run the triage and burn that symbol down.

  **Guard fix:** `referencesSpec` walked the declaration's own name node, so a
  symbol whose name was also bound to a spec import counted as derived from
  itself. TypeScript rejects that particular pair as a duplicate identifier, so it
  was not reachable in compiling code — but a guard that depends on the compiler
  having run first is a guard with a hole in it. The clean-tree result is
  unchanged, confirming it was masking nothing.

- aa35561: fix(form): a split create/edit form no longer loses the panel you are not submitting from (#2153)

  `SplitForm` rendered one `SchemaRenderer` — one react-hook-form instance and one
  `<form>` element — **per section**, and its two groups of sections live in
  separate resizable panels. So each panel owned isolated form state: submitting
  from one panel's action bar sent only that section's fields and silently dropped
  everything the user had typed on the other side of the divider. Filling both
  panels and clicking Create persisted `{ subject }` alone.

  The same isolation killed cross-panel field rules: a `visibleWhen` in the right
  panel referencing a left-panel field never saw that field in its record, so the
  predicate faulted and failed **open** — the field the author meant to hide was
  always shown.

  Both panels are now ONE form. The panel group became a layout the form renderer
  owns, via a new `FormSchema.fieldPanes` (+ `fieldPanesOrientation`,
  `fieldPanesResizable`) that mirrors `fieldTabs` (#2959): the `<form>` wraps the
  whole `ResizablePanelGroup` and each pane holds only fields, which is what lets a
  single react-hook-form instance span the divider. Sections inside a pane render
  behind the inline `section-divider` header, each at its own declared column
  density within the form's shared grid.

  One more fix falls out of moving the panels into the renderer: `splitResizable:
false` now actually pins the divider. It previously only hid the grip — the
  separator stayed draggable, because nothing passed the panel library's
  `disabled`.

  Each pane is its own `@container`, so a multi-column section collapses to fewer
  columns as its panel is dragged narrower instead of overflowing.

- 3c1f321: fix(form): a tabbed/sectioned create-edit form no longer loses the tabs you are not looking at (#2959, #2153)

  The explicit-`sections` path rendered one `SchemaRenderer` — one react-hook-form
  instance and one `<form>` element — **per section**, all sharing the same
  `formId`. Two failures compounded:

  1. the footer submit button (`form={formId}`) can only be associated with the
     **first** of those forms, so section 2+ never reached the payload; and
  2. in the `tabbed` variant Radix unmounted the inactive panel, destroying that
     tab's form state outright.

  Reported flow (HotCRM, 3 tabs, required `description` on tab 3): fill tab 1 →
  submit → server 400 `description is required` → switch to tab 3, fill it →
  submit → the server now reports `subject; description; status; priority` **all**
  missing, because the second submit's body had lost every earlier value.

  `ModalForm` (stacked and `contentLayout: 'tabbed'`) and `TabbedForm` now render
  ONE form for all sections, matching `ObjectForm` / `DrawerForm`. Stacked sections
  use the existing inline `section-divider` header (which now also renders the
  section's `description`); tabbed sections go through a new
  `FormSchema.fieldTabs` (+ `defaultFieldTab`, `fieldTabsPosition`) that the form
  renderer distributes into **force-mounted** Radix panels — CSS-hidden rather
  than unmounted, since react-hook-form skips validation for unmounted fields,
  which is how a required field on a tab nobody opened used to sail past the
  client and come back as a server 400.

  Validation feedback now points at the tab: a rejected field activates its tab and
  every tab holding one is marked on its trigger, for client-side rules and server
  `fields[]` rejections alike.

- a045a32: **`@object-ui/types`' tests are type-checked, so the spec-derivation guards actually run (framework#4074).**

  `spec-derived-unions.test.ts` exists to stop a spec-derived union from being
  re-forked into a hand-written copy, and its header claimed the `satisfies` checks
  in it "are the real enforcement". They were not. `tsconfig.json` excludes test
  files — correctly, since it is the package build with `rootDir` / `composite` /
  `declaration`, so tests would emit into dist — and no other `tsc` invocation read
  them. Measured, not assumed: reverting `ActionParamFieldType` from the spec's
  `FieldType` back to its old hand-written subset produced **zero** type errors.

  It now produces `TS1360` on the `satisfies` line. Same for the sibling guards over
  `ChartType`, `ReportType`, `ActionType` and `PageType`, which were equally inert —
  the anti-regression mechanism left by #2944/#2901 was not running.

  `packages/types/tsconfig.test.json` follows the shape the package already uses for
  `tsconfig.examples.json`: a separate, emit-free project chained from `type-check`.
  Kept separate rather than deleting the exclude so the BUILD stays honest — the
  reexport guard's source scan needs `types: ["node"]`, and folding that into
  `tsconfig.json` would let package source reference Node APIs and still compile, in
  a package that ships to browsers.

  Turning it on surfaced 39 pre-existing type errors in test files, all fixed here
  except one declared gap:

  - **`p2-spec-exports.test.ts`** imported eight `…Schema` names as types from
    `../index`. #2561 decision (a) removed those, and the sibling
    `spec-ui-schema-reexports.test.ts` asserts their absence — so this file
    contradicted its own guard for the whole interval. A type-only import of a
    nonexistent name erases at runtime, so the suite stayed green. Its minimal
    fixtures were also typed as parsed OUTPUT while being parse INPUT (these schemas
    `.default()` several fields); they now use `z.input<>`, the distinction spec
    draws itself with `ActionInput`. `operator: 'eq'` is likewise a legacy alias spec
    folds at parse time, valid as input and absent from the canonical output union.
  - **`app-creation-types.test.ts` / `system-fields.test.ts`** imported the package
    by its own name. `turbo`'s `type-check` depends on `^build` (upstream only), so
    the package's own `dist` does not exist when it runs; they now use the relative
    import every sibling test uses.
  - **`p1-spec-alignment.test.ts`** is excluded with a written reason, and is real
    debt rather than hygiene: all 14 of its errors sit in tests named
    "should accept &lt;shape&gt;" whose entire purpose is asserting the type accepts
    that shape, and the type rejects it. The clearest case —
    "should accept sharing in ObjectUI format `{ visibility, enabled }`" — describes
    a shape that IS handled, by `foldSharing` in core's `normalize-list-view.ts`, but
    only as untyped input (`normalizeListViewSchema<T>(schema: T): T`), so no type
    names it. Each site is a separate decision (widen the type so the claim becomes
    true, or drop the claim) and several touch the public surface, so they are
    tracked on framework#4074 instead of being silently rewritten here.

  Only `packages/types` is converted. 28 other packages still exclude their tests
  from type-checking, and 5 (`fields`, `cli`, `data-objectstack`, `plugin-charts`,
  `plugin-editor`) already include them — this establishes the pattern for the rest
  rather than sweeping them.

- 9867281: fix(types): zod-validation example and zod README teach the Zod 4 `.issues` accessor, and `examples/` is now type-checked

  `ZodError.errors` was removed in Zod 4 (the repo is on 4.4.3). The
  `packages/types/examples/zod-validation-example.ts` documentation example read
  `.errors` in seven places, so every `console.error` printed `undefined` and the
  last one — `invalidButtonResult.error.errors.length` — threw
  `TypeError: Cannot read properties of undefined (reading 'length')`, killing the
  example before its summary. Same bug, same cause as the `objectui validate` fix
  in #2919; now reads `.issues`.

  `src/zod/README.md` documented the same dead accessor plus a Zod 3 issue shape
  (`code: 'invalid_enum_value'`, `"Invalid enum value. Expected …"`). Both were
  corrected against what 4.4.3 actually emits: `code: 'invalid_value'` with a
  `values` array and `'Invalid option: expected one of …'`.

  **The example was invisible to CI, so the swap alone would let this rot again.**
  `packages/types` type-checks with `tsc --noEmit` over a project whose `include`
  is `["src/**/*"]` — `examples/` was outside it (the `"examples"` entry in
  `exclude` was belt-and-braces; deleting it alone would have changed nothing).
  Examples cannot simply join that project either: it is the package build
  (`tsc` → `dist`) with `rootDir: "./src"`, `composite` and `declaration`, so
  example files are both outside `rootDir` and would emit into `dist`.

  Added `packages/types/tsconfig.examples.json` — an emit-free project covering
  `examples/**/*.ts` — and chained it: `"type-check": "tsc --noEmit && tsc -p
tsconfig.examples.json"`. The example also now imports from `../src/zod/index.zod`
  rather than `../dist/zod/index.zod.js`, matching its three sibling example files
  (`dashboard.ts`, `login-form.ts`, `rest-data-source.ts`, all on `../src/index`)
  so the check needs no prior build.

  Verified the gate has teeth rather than trusting the green: restoring `.errors`
  makes `tsc -p tsconfig.examples.json` fail with seven
  `TS2339: Property 'errors' does not exist on type 'ZodError<…>'`. The example
  also runs clean end-to-end again, printing `Expected validation errors: 2`
  where it previously threw.

  No runtime or published-type change: `examples/` is not in the package's `files`.

## 17.0.0

### Major Changes

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

- dfd3705: feat(types)!: drop the `ObjectStack/ObjectOS/ObjectQL/ObjectUI Capabilities` re-exports (framework capabilities-descriptor prune)

  Upstream `@objectstack/spec` removed the dead static capability-descriptor
  cluster (`ObjectStackCapabilitiesSchema` / `ObjectOSCapabilitiesSchema` /
  `ObjectQLCapabilitiesSchema` / `ObjectUICapabilitiesSchema` + their types) —
  a never-wired fixed-boolean self-portrait whose defaults contradicted the
  live platform (FLS/RLS/audit all `default(false)` while actually enforced).
  This drops the `@object-ui/types` re-exports of those symbols.

  **Migration**: discover real runtime capabilities at runtime, not from a
  static schema — `GET /api/v1/discovery` (dynamic `capabilities` record with
  declared === enforced discipline) and the `/.well-known` contract
  (`WellKnownCapabilitiesSchema` from `@objectstack/spec/api`). No replacement
  re-export.

- 059a052: feat(report)!: drop `SpecReportColumn`/`SpecReportGrouping` re-exports + retire the legacy ReportViewer chart fallback (#3463)

  Cross-repo close-out of the ADR-0021 report cleanup (framework #3463). Upstream
  `@objectstack/spec` removed the dead `ReportColumnSchema` / `ReportGroupingSchema`
  and the unread report `chart.groupBy`; this drops their objectui mirrors and the
  now-orphaned legacy report chart path.

  - **types**: removed the `SpecReportColumn` / `SpecReportColumnInput` /
    `SpecReportGrouping` / `SpecReportGroupingInput` type re-exports and the
    `SpecReportColumnSchema` / `SpecReportGroupingSchema` value re-exports from
    `@object-ui/types` (they aliased the deleted upstream symbols). The live
    report shape is dataset-bound — `SpecReport` with `dataset` + `values`
    (measure names) + `rows` / `columns` (dimension names).
  - **app-shell**: `ReportView` now renders every report through the spec
    `ReportRenderer` dispatcher (dataset → `DatasetReportRenderer`, stored pre-9.0
    JSON → presentation bridge, pre-spec `{ data, columns }` → `LegacyReportRenderer`).
    Deleted the `ReportViewer` last-resort branch, the `mapReportForViewer`
    spec→legacy chart-section adapter (the sole producer of `xAxisField` /
    `yAxisFields`), and the now-dead data-fetch loading flag. No shipped report
    metadata reached the removed branch — the Studio inspector only ever writes
    the dataset-bound shape.
  - **plugin-report**: removed the `ReportViewer` chart-section branch. It read
    the invented `xAxisField` / `yAxisFields` (never the spec's `xAxis` / `yAxis`)
    and was only fed by the deleted `mapReportForViewer`. `ReportViewer` itself is
    retained — its table / summary / text sections still back the `report-viewer`
    registered component and the pre-9.0 presentation bridge.

  **Migration**: nothing an author writes changes. TypeScript consumers importing
  `SpecReportColumn*` / `SpecReportGrouping*` from `@object-ui/types` have no
  replacement type — model report columns as the dataset's measure names and
  grouping as its dimension names.

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

- c7cff19: feat(plugin-grid): "Import as historical data" option in the Import Wizard (framework #3479)

  Adds a checkbox to the Import Wizard's options panel that sends `treatAsHistorical`
  on the import request. When on, the server skips the object's `state_machine` rule so
  mid-lifecycle rows — a batch of already-`closed` tickets, `closed_won` deals — aren't
  rejected by `initialStates`. Off by default: a normal import still walks the FSM, so
  the exemption is always an explicit opt-in.

  Pairs with the framework side (objectstack #3483). `ImportRequestOptions.treatAsHistorical`
  is added to `@object-ui/types`, and `assembleImportRequest` threads it through both the
  inline and named-mapping request shapes (sent only when on).

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

- d147a13: refactor(types): retire the hand-written @objectstack/spec/ui sub-schema mirrors (#2231 phase 2)

  The zod schemas that carried a "Mirrors @objectstack/spec/ui X" header are now the
  spec's schemas **by reference** instead of hand-maintained copies, closing the
  double-maintenance / silent-divergence gap the same way #2622 did for `ListViewSchema`:

  - `objectql.zod.ts` — `HttpMethodSchema`, `HttpRequestSchema`, `ViewDataSchema`,
    `SelectionConfigSchema`, `PaginationConfigSchema` are direct re-exports.
    `ListColumnSchema` derives from the spec base plus the two sanctioned
    objectui-only extensions: `prefix` (ObjectGrid compound cells) and a broadened
    `summary` (the spec `ColumnSummarySchema` enum ∪ the `{ type, field }` object
    form `useColumnSummary` supports).
  - `theme.zod.ts` — `ColorPaletteSchema`, `TypographySchema`, `SpacingSchema`,
    `BorderRadiusSchema`, `ShadowSchema`, `BreakpointsSchema`, `AnimationSchema`,
    `ZIndexSchema`, `ThemeModeSchema`, `ThemeLogoSchema`, `ThemeDefinitionSchema`
    all resolve to the spec's schemas.

  Validation deltas picked up from the spec (drift the mirrors had accumulated):
  `ViewDataSchema` gains the `provider: 'schema'` variant; `HttpRequestSchema.method`,
  `SelectionConfigSchema.type` and `PaginationConfigSchema.pageSize` now apply spec
  defaults on parse; `ListColumnSchema.summary` accepts the full spec aggregation
  vocabulary but no longer accepts arbitrary strings; `AnimationSchema.timing` keys are
  the spec's snake_case (`ease_in` — what the runtime reads) instead of the mirror's
  camelCase; `ThemeDefinitionSchema` gains `density`/`wcagContrast`/`rtl`/`touchTarget`/
  `keyboardNavigation` and its `mode` default follows the spec (`'light'`).

  A new drift-guard (`spec-subschema-parity.test.ts`) asserts reference identity for
  every re-export, so re-forking — including a faithful copy — fails CI.

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

- 31b77d4: **Add the explicit `engine-owned` lifecycle bucket (tracks framework ADR-0103 addendum / #3343).** The framework split the overloaded `managedBy: 'system'` bucket by promoting the engine-owned case to its own enum value; this mirrors it in the UI type + runtime + badge.

  - **`@object-ui/types`** — `ManagedByBucket` union and `MANAGED_BY_BUCKETS` gain `'engine-owned'` (canonical order: `platform, config, system, engine-owned, append-only, better-auth`). The union stays closed, so every consumer that missed the new value is a compile error.
  - **`@object-ui/core`** — `resolveCrudAffordances` gains the `engine-owned` default row (identical all-locked matrix as `system`/`append-only`), so `isObjectInlineEditable` / the grid + form gates treat it as read-only automatically.
  - **`@object-ui/app-shell`** — the `ManagedByBadge` renders `engine-owned` with the same read-only "System-managed" copy as a locked `system` object (reuses the existing `managedByBadge.system` i18n key — zero translation churn; the distinction is at the schema level, not the user-facing string), and `resolveManagedByEmptyState` reuses the `system` engine-owned empty state.

  Behaviour-preserving: `engine-owned` resolves to the same locked affordances `system` did by default, so nothing about how a locked object renders changes — the value just makes the schema self-documenting. New unit coverage for the bucket in `resolveCrudAffordances` / `isObjectInlineEditable` / `MANAGED_BY_BUCKETS` / the empty-state helper.

- 62b9ab5: feat(data): unify master-detail saves behind `DataSource.batchTransaction`, isolate the non-atomic fallback in the adapter (#2679)

  Master-detail saves (`MasterDetailForm`, `LineItemsPanel`) now always persist
  through `dataSource.batchTransaction(operations)` — one ordered cross-object
  operation list, with `{ $ref: <op index> }` linking a child to a parent created
  in the same batch. The form no longer contains any client-side orchestration or
  best-effort compensation-delete; that atomicity anti-pattern is gone from the UI
  layer (framework #1604 / framework ADR-0034 item 4).

  - **`@object-ui/types`** — `batchTransaction?` is now a first-class (optional)
    method on the `DataSource` contract, typed via `BatchTransactionOperation` /
    `BatchRef`. Replaces the previous `(dataSource as any).batchTransaction`
    method-sniffing.
  - **`@object-ui/core`** — new `emulateBatchTransaction(dataSource, operations)`
    (sequential writes, `$ref` resolution, best-effort reverse-order compensation)
    and `runBatchTransaction(dataSource, operations)` (prefers the adapter's method,
    emulates otherwise). `ApiDataSource` / `ValueDataSource` implement
    `batchTransaction` via the emulation.
  - **`@object-ui/data-objectstack`** — `ObjectStackAdapter.batchTransaction` uses
    the server's atomic `POST /api/v1/batch`, prefers the typed
    `client.data.batchTransaction` SDK method when the installed client exposes it,
    and degrades to the client-side emulation ONLY when the endpoint is missing
    (404/405) or the runtime can't do transactions (501). Real errors (400/401/403/
    409/500) still surface. This is the isolated, tested home of the non-atomic
    fallback.
  - **`@object-ui/plugin-form`** — removed `applyDetail` / `createMany` /
    `ApplyDetailResult` from `masterDetailTx.ts`; `MasterDetailForm` and
    `LineItemsPanel` build ops and call `runBatchTransaction`. `LineItemsPanel`
    saves are now atomic on a capable backend, with the rollup folded into the same
    batch.

  No behavior change on a current ObjectStack backend (it has `/api/v1/batch`);
  older/limited backends keep a working — now clearly non-atomic — save path.

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

- 6d4fbe6: **Consolidate the `managedBy` lifecycle-bucket logic into one shared source of truth (follows framework ADR-0103).** The bucket taxonomy was hand-mirrored in several places — `crudAffordances.ts`, `ManagedByBadge.tsx` (its own `Bucket` union + `isWriteOptedIn` + the writable-system derivation), and `plugin-detail`'s `record-details.tsx` (`NON_EDITABLE_BUCKETS`, duplicated because it can't depend on app-shell) — a drift risk, and the object-schema `managedBy` type was open-ended (`(string & {})`) so unknown buckets slipped through and silently defaulted to fully-editable.

  - **`@object-ui/types`** now owns the closed `ManagedByBucket` union (+ `MANAGED_BY_BUCKETS`), and `ObjectSchema.managedBy` is tightened from `'platform' | 'better-auth' | (string & {})` to that union — unknown buckets are now a type error at authoring time.
  - **`@object-ui/core`** now owns the React-free runtime logic — `resolveCrudAffordances`, `isWriteOptedIn`, `isSystemWritable`, `isObjectInlineEditable` — reachable by every UI package including `plugin-detail` (which could not import app-shell).
  - **`app-shell/utils/crudAffordances.ts`** is now a thin re-export of `@object-ui/core` (existing imports keep working); `ManagedByBadge` consumes the shared `isSystemWritable`; `plugin-detail` `record-details.tsx` replaces its hand-mirrored `NON_EDITABLE_BUCKETS` with `isObjectInlineEditable`.

  Behavior-preserving — all existing affordance/edit-gate tests stay green; the shared module adds direct unit coverage (including the previously-untested `isSystemWritable` derivation). Translated copy (badge variants, empty-state messages) stays in app-shell.

- 29c6040: fix(app-shell): redo the record-list "Add View" create flow — empty-name 405, invisible drafts, canonical naming

  Rebuilds the record-list "Add View" / "Save as view" create path so a
  runtime-created view has one canonical identity and is actually verifiable
  before publish (supersedes #2754; fixes #2767).

  - **Unified identity (P1).** New `viewEnvelope(objectName, spec, { name, label })`
    seam in `runtime-metadata-persistence.ts` emits the canonical ViewItem
    (`{ name: '<object>.<key>', object, viewKind: 'list', label, config }` with
    `config.data = { provider: 'object', object }`), mirroring the Studio
    `anchors.ts:createBuildBody`. The **qualified** name is passed as BOTH the
    `PUT /meta/view/:name` URL segment and `body.name`, so the `sys_metadata`
    row key, the ViewTabBar tab id, and the body identity all agree and the
    draft → read → publish loop resolves. `ObjectView` and `ObjectDataPage` both
    call the single helper — the duplicated envelope block is gone (P6).
  - **Empty-name guards (405).** `MetadataClient.save()` and
    `createRuntimeMetadata()` throw a clear contextual error instead of emitting
    `PUT /meta/view/` (empty `:name`, server 405).
  - **Draft visibility (P2/P3/P4).** `DataSource.listViews(objectName, { previewDrafts })`:
    in draft-preview mode the `ObjectStackAdapter` makes a **single**
    `MetadataClient.withPreviewDrafts(true).list('view')` request and uses the
    server's already-overlaid list (draft wins by name, `_draft` tagged) —
    replacing, not appending, so a draft that edits a published view can't
    double-tab. No hand-rolled `fetch` of metadata routes at the adapter layer.
    After a create in normal mode the console navigates to the new view with
    `?preview=draft`, so the DraftPreviewBar is visible and Publish is one click.
  - **CJK-aware naming (P5).** `CreateViewDialog` gains an editable machine-name
    field, prefilled via `slugify(label)` for Latin labels and required (submit
    disabled) when slugify yields empty for non-Latin labels — no more silent
    random `task_grid_mrsyt56j` names. New `console.objectView.viewName*` keys
    (en/zh).

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

## 16.0.0

### Major Changes

- 9b8f978: Adopt `@objectstack/spec` 15 across the workspace and drop the value-erased `…Schema` re-exports from `@object-ui/types` (#2561).

  **Removed exports.** `packages/types` re-exported the `@objectstack/spec/ui` surface inside `export type { … }` blocks, and those blocks included the zod validators (`DndConfigSchema`, `SpecFormViewSchema`, `ThemeModeSchema`, … 84 names in total). Under `export type` a zod value is erased, so importing any of them as a value from `@object-ui/types` silently yielded `undefined` at runtime. Per the #2561 decision (option a) the schema names are removed from the public surface instead of being converted to value re-exports — consumers that need the runtime validators import them from `@objectstack/spec/ui` directly. The inferred types (`DndConfig`, `SpecFormView`, …) are unchanged, and the genuine value re-exports (`defineStack`, `ObjectStackSchema`, `SpecReportSchema`, …) keep working. `BreakpointColumnMapSchema` / `BreakpointOrderMapSchema` are dropped without a type replacement (the spec exports no companion inferred type). A guardrail test (`spec-ui-schema-reexports.test.ts`) pins the contract.

  **Spec 15.** Every workspace package now depends on `@objectstack/spec` ^15.1.1. The `/ui` export-name set is identical to 14.6; the spec-level breaking change is ADR-0089 D3a — `FormFieldSchema` / `FormSectionSchema` / `PageComponentSchema` are `.strict()` and reject undeclared keys, which the workspace test suite passes under. The floor is 15.1.1 (not 15.0.0) because D3a's `.strict().transform(…)` pipes crashed `z.toJSONSchema` over spec's lazySchema proxies (`Cannot set properties of undefined (setting 'ref')`), breaking Studio's spec-derived Page/View inspector schemas; fixed upstream in framework#3021, which shipped in spec 15.1.1. New `view-schema.test.ts` pins the View-inspector derivation (previously untested — it degraded silently).

### Minor Changes

- b4ef588: feat(types): derive `ListViewSchema` from `@objectstack/spec/ui` instead of a hand-written copy (#2231)

  `@object-ui/types` shipped a hand-written mirror of the spec's UI ListView zod
  (`packages/types/src/zod/objectql.zod.ts`) plus a parallel hand-written TS `interface`
  (`objectql.ts`). Both had drifted from the authoritative `@objectstack/spec/ui`
  `ListViewSchema`, with nothing enforcing they stay in sync.

  - The zod `ListViewSchema` now **derives** from the spec's `ListViewSchema`: spec-owned
    fields (`filter`, `sort`, `selection`, `navigation`, `pagination`, `grouping`,
    `rowColor`, `userActions`, `appearance`, `tabs`, `addRecord`, `rowHeight`, `sharing`,
    `chart`/`tree` configs, `responsive`, `performance`, …) flow in **by reference** instead
    of being re-typed. The component envelope (`type: 'list-view'` discriminator +
    `objectName`) and the legacy objectui vocabulary (`viewType`, `fields`, `filters`, the
    `show*` toolbar flags, `densityMode`, `color`, …) plus the configs whose objectui shape
    is intentionally broader than spec's (`userFilters`, `sharing`, `aria`,
    `conditionalFormatting`, `exportOptions`, `kanban`/`calendar`/`gantt`/`gallery`/
    `timeline`) remain as sanctioned local `.extend()`s. Existing payloads keep validating;
    spec-canonical payloads (`columns`/`filter`/`userActions`) now validate too.
  - The hand-written TS `interface ListViewSchema` is replaced by
    `z.infer<typeof ListViewSchema> & ListViewRuntimeProps`, so the type can no longer drift
    from the schema. Non-serializable runtime-only props (`onNavigate`, `onDensityChange`,
    `refreshTrigger`) live in `ListViewRuntimeProps`.
  - Added a drift-guard test (`list-view-spec-parity.test.ts`) that fails if the spec grows a
    field objectui hasn't triaged, renames an aliased anchor (`type`/`columns`/`filter`), or
    an objectui-only field is added outside the sanctioned-local set.
  - Bumped the `@objectstack/spec` dependency `^14.6.0` → `^15.1.0` across the workspace
    (15.1.0 carries the framework#3021 `lazySchema`/`z.toJSONSchema` identity fix that the
    spec-derived Page/View inspectors depend on).

  Migrating the legacy vocabulary to the spec-canonical keys and adopting spec's narrower
  sub-shapes are deferred follow-ups (see #2231). No runtime behavior change.

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

- 210806a: chore(designer): drop the inert object "Enabled" toggle (framework#2377)

  The object designer showed an **Enabled** column (`ObjectManager` grid) and an
  editable **Enabled** boolean (add/edit object form), backed solely by the object
  `active` metadata property. `active` had no runtime consumer and was removed from
  `@objectstack/spec` (framework#3199, ADR-0049 enforce-or-remove) — so the toggle
  never disabled anything. Toggling it "off" left the object fully queryable and
  usable: a false affordance.

  Removed the column, the form field, the `active`↔`enabled` mapping/write-back in
  `MetadataObjectsPage`, the `enabled?` field on the designer `ObjectDefinition`
  type, and the now-unused `appDesigner.objectManager.enabled` string. Non-breaking:
  the metadata write path registers objects via `ObjectSchema.parse()`, which already
  strips unknown keys, and `ObjectDefinition.enabled` was designer-only.

  `isSystem` is unchanged (it stays a live spec property).

## 15.0.0

## 14.1.0

### Minor Changes

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

- d5b1bc0: remove(tenant): drop the zero-consumer `@object-ui/tenant` package and the `types/tenant.ts` mirror (#2564)

  `@object-ui/tenant` (`TenantProvider` / `TenantGuard` / `TenantScopedQuery` /
  `createTenantResolver` / `useTenant` / `useTenantBranding`) was an
  exported-but-dead aspirational surface: no workspace package depended on it
  and nothing imported it. Its `TenantConfig.isolation` strategy enum
  (`'database' | 'schema' | 'row' | 'hybrid'`) was the UI mirror of the spec's
  `tenancy.strategy`, which framework#2763/framework#2962 removed under the same
  enforce-or-remove doctrine — the platform has exactly two tenancy modes, and
  neither is configured client-side.

  `@object-ui/types` no longer exports the tenant type family
  (`TenantConfig`, `TenantIsolationStrategy`, `TenantStatus`, `TenantPlan`,
  `TenantBranding`, `TenantLimits`, `TenantContext`,
  `TenantResolutionStrategy`, `TenantProviderConfig`,
  `TenantScopedQueryConfig`).

  Migration: real tenant scoping is server-enforced — `createAuthenticatedFetch`
  (`@object-ui/auth`) already injects the active organization as `X-Tenant-ID`
  on every API call, and the backend applies row-level isolation
  (`tenancy.enabled` + `tenantField` in `@objectstack/spec`). Per-tenant
  branding is a `ThemeSchema` concern. The skills guides and docs that
  advertised the dead package have been rewritten to say exactly that.

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

- e628d1f: Dashboard-level filters follow-ups (#2578, framework#2501):

  - **i18n**: the `DashboardFilterBar` strings now ship as real locale entries —
    `dashboard.filters.*` (bar label, "All time", "Custom…", "All", "Reset",
    and the 13 date-range preset labels) added to `en` and `zh`. Previously the
    bar always rendered the `useSafeTranslate` English fallbacks.
  - **types**: `GlobalFilterSchema.name` and `DashboardWidgetSchema.filterBindings`
    landed in `@objectstack/spec` (framework#2501), so the local type
    annotations flip from "Pending alignment" to "Aligned" — no shape changes.

  Also adds five schema-catalog examples (`plugin-dashboard/filtered-dashboard-*`:
  dynamic `optionsFrom` options, text/number/lookup filter types, dataset +
  inline widget mix, `targetWidgets` allow-list, date presets + custom range)
  and a new "Dashboard-Level Filters" guide page covering the full tutorial,
  `page.*` expression usage, and known limitations with workarounds.

- 9e2d58f: Kanban `conditionalFormatting` now accepts CEL rules in its type + schema (#1584 follow-up).

  Since #1584 moved kanban card styling onto the shared CEL evaluator, the runtime
  already accepts the spec `{ condition, style }` rule shape — but the type and zod
  schema still only allowed the native `{ field, operator, value }` shape, so a
  CEL kanban rule failed validation for something that worked at runtime. The
  `KanbanConditionalFormattingRule` type and `ObjectKanbanSchema` zod schema are
  widened to a union of both shapes, matching list/grid `conditionalFormatting` and
  the runtime. Back-compat: the native shape keeps validating unchanged.

## 14.0.0

### Minor Changes

- 86c69c3: ADR-0089: read the canonical `visibleWhen` conditional-visibility predicate in the form + page renderers.

  `@objectstack/spec` now unifies conditional visibility under a single canonical key, `visibleWhen`, and folds the deprecated `visibleOn` (view form) / `visibility` (page component) aliases into it at parse. This updates ObjectUI to read the canonical key:

  - **Page renderer** (`SchemaRenderer`) — evaluates `visibleWhen` first (show-when-truthy), then the deprecated `visibleOn` / `visibility` as a defensive read for raw / un-normalized metadata. `visibleWhen` is stripped from DOM props.
  - **Spec→node bridges** — the page bridge maps a component's `visibleWhen ?? visibility` onto the node's canonical `visibleWhen`; the form-view bridge maps a field's `visibleWhen ?? visibleOn` onto the ObjectForm view-level predicate slot.
  - **Form renderers** — the `@object-ui/react` `FormRenderer` prefers `visibleWhen` over the `visibleOn` alias. (`ObjectForm`/`form.tsx` already evaluated `visibleWhen`.)
  - **Types** — the component base schema (`BaseSchema` / `base.zod`) gains the canonical `visibleWhen`; `visibleOn` is marked `@deprecated`.

  Fully back-compat: existing `visibleOn` / `visibility` metadata keeps working through the alias reads.

- 6a74160: Sharing-rule form: pick, don't type. Three new widget-hint field components make
  the generic object form render pickers where an admin previously had to type
  machine data (driven by the framework `widget` hints on `sys_sharing_rule`;
  generalizes the `capability-multiselect` pattern). All degrade to the underlying
  `type` renderer when a widget is unregistered.

  - **`object-ref`** — choose a registered object by name (searchable `Combobox`),
    backed by the new `DataSource.getObjects()` (`ObjectStackAdapter` lists code-
    and DB-defined objects via `/api/v1/meta/object`), falling back to a
    `sys_metadata` query. Stores the object's `name`.
  - **`filter-condition`** — a visual criteria builder (`FilterBuilder`) scoped to
    the fields of the object chosen in a sibling field (via `getObjectSchema`),
    round-tripping the stored **MongoDB-style** FilterCondition JSON. Criteria the
    builder can't represent (or invalid JSON) fall back to a raw-JSON editor, with
    an always-available "Edit as JSON" toggle — nothing is hidden or lost.
  - **`recipient-picker`** — a record picker whose target object follows a sibling
    `recipient_type` (`user`→sys_user, `team`→sys_team, `business_unit`/
    `unit_and_subordinates`→sys_business_unit, `position`→sys_position), storing the
    value the evaluator matches on (a record id, or the position **name**). Resets
    the stored id when the type changes.

  Wiring: the three keys join `DATA_SOURCE_FIELD_TYPES` (form.tsx) so the form
  threads `dataSource` + `dependentValues` to them, and `INLINE_EXCLUDED_FIELD_TYPES`
  (they're authored in the record form, not a grid cell). `DataSource.getObjects()`
  is optional on the interface; the ObjectStack adapter implements it.

## 13.2.0

## 13.1.0

## 13.0.0

### Patch Changes

- 619097e: Adopt `@objectstack/spec` 13 (ADR-0090 Permission Model v2) across the workspace.

  Every workspace package now depends on `@objectstack/spec` ^13.0.0 — the v2 major that renames role → position (D3), removes the profile concept (D2), makes OWD default to `private` when unset (D1), and drops the legacy `read`/`read_write`/`full` sharing aliases (D4). UI fallout fixed in the same sweep:

  - **clientValidation**: the `role` draft-schema loader is now `position` → `PositionSchema` (fixes the `RoleSchema does not exist` build break, #2365); the dead `profile` loader is removed (D2).
  - **Studio previews**: `RolePreview` → `PositionPreview` (flat — positions carry no hierarchy; the old parent-chain breadcrumb and "assign to a Profile" copy are gone). Legacy `role`/`profile` preview keys stay registered for pre-v2 backends.
  - **OWD control** (`ObjectSettingsPanel`): removed the now-dead alias normalization (spec 13 rejects the aliases at authoring time) and the amber "fully public" warning — an unset sharing model now defaults to Private (D1), and the copy says so in both locales.
  - **Fallback schemas / anchors / samples**: `position` replaces the hierarchical `role` fallback schema; `isProfile` dropped from the permission create-anchor and previews samples; permission-set viewer no longer renders a profile badge; console System hub counts `sys_position` instead of the removed `sys_role`.
  - **Studio i18n**: type labels `Role/角色` → `Position/岗位`, `profile` label removed, Access-pillar heading and sharing copy rewritten to the v2 vocabulary.
  - `@object-ui/types` now exports `SubmitBehavior` (was defined but missing from the public surface, breaking `@object-ui/plugin-form`'s re-export under a clean build).
  - **External OWD dial (D11)**: the object Settings sharing card gains an `externalSharingModel` select (portal/partner baseline) with an inline wider-than-internal warning mirroring the publish-time lint.
  - **Permission matrix OWD badges**: every object row now shows its record-level baseline (`OWD Public read`, `Ext Private`, or `OWD Private (default)` for the D1 fail-closed unset case) so grant edits carry their record-reach context.

  The flow designer's approval assignee `role` kind is intentionally unchanged — spec 13 keeps it as the sole D3 exception (better-auth `sys_member.role` org-membership tier).

## 12.1.0

### Minor Changes

- c31874d: Record-header actions honour `Action.order`, so approval decisions no longer get buried in the `⋯` overflow menu (objectui#2339 / framework#2670).

  The `action:bar` renderer now stable-sorts its actions by an explicit **`order`** field (lower = higher / more prominent, default `0`) before the inline/overflow split. The sort is stable and treats unset `order` as `0`, so action groups where nobody sets `order` keep their exact registration order — existing toolbars are unaffected. `order` is added to `ActionSchema` in `@object-ui/types`, mirroring `Action.order` in `@objectstack/spec`.

  `RecordDetailView` now assigns the injected **Approve / Reject** decision buttons a strongly-negative `order` (and gives Approve the highlighted `primary` variant), so on a pending-approval record the approver's decision takes the primary-button slot and app `record_header` actions follow it — instead of the app having to hide its own actions to surface the decision.

## 12.0.0

### Minor Changes

- 226fde9: Cascading & role-gated `select` options (#2284).

  `select` options now accept a per-option `visibleWhen` CEL predicate — the option
  is offered only when it evaluates TRUE against the live record **plus
  `current_user`** (same engine/env as a field-level `visibleWhen`). Combined with a
  field-level `dependsOn`, this drives dependent selects (country → province → city)
  and role/context gating with no bespoke matrix — the same primitives dependent
  lookups (#2215) already use.

  - `@object-ui/core` exposes `resolveVisibleOptions` / `isOptionGroupGated` /
    `resolveDependsOnFields` / `isValueStillOffered` (evaluator), reusing the
    canonical `evalFieldPredicate`.
  - The form renderer narrows a dependent select's option list, gates the control
    with a "Select {parent} first" hint while a `dependsOn` field is empty, and
    clears a now-invalid value when the parent changes.
  - The standalone `SelectField` widget applies the same resolution via
    `dependentValues` + the global predicate scope.

  Client-side hiding is UX, not authorization: gate authorization-sensitive option
  values on the server too. Aligns with `@objectstack/spec` `SelectOption.visibleWhen`.

- e4de456: Fix form section grouping inconsistencies found in a UX review of grouped forms:

  - **Unified section visual language.** `FormSection`'s Card-wrapped path (used by Modal/Split/Tabbed/Wizard forms) previously rendered as a nearly-invisible white-on-white card (same `bg-card` as the page background, distinguished only by a barely-visible shadow) with a duplicated, inconsistent header (different title size, and a collapse chevron positioned differently) versus the flat `SectionDivider` path used by simple/drawer forms. Both now share the same header treatment (`text-sm font-semibold`, inline-left chevron, bottom border), and the Card path gets a soft `bg-muted/40` tint so grouped sections are visually distinguishable without relying on shadow alone.
  - **`readonly` no longer renders as `disabled`.** A field marked `readonly` (statically or via `readonlyWhen`) was being folded into the `disabled` prop before reaching field widgets, so widgets with a dedicated readonly display (e.g. `EmailField`'s mailto link, `TextField`'s plain-text view) never received it — every readonly field just looked permanently disabled. `readonly` is now forwarded as its own prop; generic `input`/`textarea` fields get a distinct readonly style (`bg-muted/40`, no `cursor-not-allowed`) instead of the disabled look.
  - **Section `className`/`gridClassName` now flow through JSON schemas.** `ObjectFormSection` and the per-form-variant section configs (`ModalFormSectionConfig`, `SplitFormSectionConfig`, `FormSectionConfig`, `DrawerFormSectionConfig`) accept `className` (and `gridClassName` where applicable), wired through `ObjectForm`'s form-type dispatch into `FormSection`/`SectionDivider` — closing a gap where section wrappers couldn't be customized from schema despite `FormSection` itself already supporting it.

## 11.5.0

### Minor Changes

- 1072701: Import wizard: use registered server-side import mappings (framework #2611). When an object has `mapping` metadata artifacts targeting it, the wizard shows a "Saved mapping" selector; picking one hands rename + transforms + write semantics to the server (the artifact is authoritative), replaces the manual column table with a read-only summary of the mapping, and submits `mappingName` over source-header rows (mutually exclusive with the inline column rename). `ImportRequestOptions` gains `mappingName`; the objectstack adapter gains `listImportMappings(objectName)` (feature-detected — the selector simply doesn't appear when unsupported). New `grid.import.*` strings added across all locales.

### Patch Changes

- 9255686: Record detail tabs are URL-addressable (`?tab=`) and survive subtree remounts (objectui#2257, ADR-0054 C3).

  - `buildDefaultTabs` emits STABLE semantic tab values (`details` / `related:<child>` / `related` / `activity` / `history`) instead of leaving the renderer to synthesize index-derived ones.
  - `PageTabsRenderer` honors `item.value`, a host-provided `schema.defaultTab` (validated against actual tabs) and `schema.onTabChange`; index fallback kept for authored schemas without values.
  - app-shell `RecordDetailView` restores the active tab from `?tab=` and writes it back with `replace` (tab switches never stack history), via the pure `withPageTabsUrlSync` page-tree injector (never mutates authored/memoized page schemas). Legacy `DetailView.autoTabs` wired to the same contract (`defaultTab`/`onTabChange`).
  - Fixes the tab strip resetting to Details after save-refresh remounts (`refreshKey`-style) and dev-StrictMode URL churn; enables `?tab=` deep links; invalid values fall back to Details.

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

- c38d107: Fix view-level `FormField.visibleOn` (CEL) never taking effect (#2212).

  The spec ships `visibleOn` as an Expression object `{ dialect: 'cel', source }`
  (what the `P` template emits) or a bare string, but the whole chain dropped it:

  - `sectionFields.ts` / `ObjectForm.tsx` only accepted the bare-string shape and
    attached a dead `visible()` closure no renderer ever called — the Expression
    object shape was silently discarded.
  - The form renderer destructured `visibleOn` out of the field config and never
    evaluated it.
  - `RecordFormPage` dropped a `simple` form view's `sections` entirely, so
    page-mode create/edit fell back to the raw schema (every field, no authored
    selection/grouping) while the modal path honored the same view.
  - `ObjectForm`'s grouped-sections path matched section fields by name only,
    dropping per-field `visibleOn` overrides.

  `visibleOn` now flows through normalization verbatim (both wire shapes) and is
  evaluated reactively by the form renderer with the canonical expression engine
  (`evalFieldPredicate` — same engine, record scope, and fail-open semantics as
  field-level `visibleWhen`; both predicates must allow a field for it to show).
  Sectioned/flat normalization also copies field-level `visibleWhen` /
  `readonlyWhen` / `requiredWhen` rules it previously lost.

## 11.3.0

## 11.2.0

## 11.1.0

## 7.3.0

## 7.2.0

### Minor Changes

- d23db5c: feat(detail): related-list add-by-picker (generic m2m/junction) + a generic "Assigned Users" management UI on permission sets (assign ai_seat and any role with zero bespoke CRUD; server-side cap errors surface inline).

## 7.1.0

### Minor Changes

- 677f7ed: feat(charts,dashboard): data-screen customization primitives

  - object-metric `variant:'bare'` — big tinted number + label, no card chrome
    (data-screen KPIs that stay data-bound).
  - object-chart `colors` prop overrides the theme `--chart-1..n` palette so a
    page/dashboard can brand its charts; compact metric formatting (`'0.0a'` →
    "1.1M").
  - ObjectChartSchema.chartType widened to donut/horizontal-bar/column.

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

- cb03bc3: feat(types): type `object-chart` `colors` as a palette OR a value→color map

  `ObjectChartSchema.colors` now accepts either a positional palette (`string[]`)
  or an explicit value→color map (`Record<value, color>`, kanban-style). This
  matches the chart renderer, which resolves a select/lookup dimension's option
  colors per category and lets them (and any explicit map) win over the
  positional palette — so health green/red/yellow paints semantically.

## 7.0.0

### Major Changes

- 858ad94: **Breaking:** remove `@object-ui/plugin-workflow` and its schema types.

  The package's designers (`WorkflowDesigner`, `FlowDesigner`, `AutomationBuilder`,
  `ApprovalProcess`, `AutomationRunHistory`) authored BPMN-style / standalone-workflow
  shapes the ObjectStack automation engine does not execute (ADR-0020, ADR-0031), and
  nothing in the console, runner, or examples consumed them.

  Removed from `@object-ui/types`: `WorkflowSchema`, `WorkflowDesignerSchema`,
  `ApprovalProcessSchema`, `WorkflowInstanceSchema`, `FlowDesignerSchema` and the
  related `Workflow*` / `Flow*` helper types (formerly `./workflow`).

  **Migration:** author flows in the Studio's metadata-admin flow designer
  (`@object-ui/app-shell` → `FlowCanvas`), whose node palette is driven by the
  engine's published action registry (`GET /api/v1/automation/actions`). Run
  history is available in the same view via the Runs panel; approval UI ships
  with the framework's `plugin-approvals`.

### Minor Changes

- ddbe4a2: B2 step 3: client-side field-level conditional rules (`visibleWhen` / `readonlyWhen` / `requiredWhen`). The form renderer now evaluates these CEL predicates reactively against the live record and gates each field's visibility, read-only state, and required-ness accordingly. Evaluation delegates to the canonical `@objectstack/formula` `ExpressionEngine` — the _same_ dialect the server enforces (`requiredWhen` in the rule-validator, `readonlyWhen` in `stripReadonlyWhenFields`) — so the UX and the persisted verdict always agree. New core helpers `evalFieldPredicate` / `resolveFieldRuleState` (zero-React, fail-open). `FormField` gains `visibleWhen` / `readonlyWhen` / `requiredWhen` (+ deprecated `conditionalRequired` alias), and `ObjectForm` carries them through from object metadata.
- 9049bbe: Add end-user friendly agent process summaries for chatbot tool calls, with a debug mode for raw reasoning and tool details. Console chat surfaces now keep a sanitized browser-side display cache so refreshes can restore user/assistant text plus grouped tool states when the backend returns no message rows.
- d16566f: Atomic master-detail create via the cross-object transactional batch endpoint (ObjectStack #1604).

  When the server exposes the transactional batch endpoint, a NEW parent record and its child line items are now persisted in ONE server transaction — commit all or roll back all — instead of the previous client-orchestrated "create parent → create children → best-effort cleanup on failure" sequence.

  **`@object-ui/data-objectstack` — `ObjectStackAdapter.batchTransaction(operations)`**

  - New method posting `{ operations }` to `POST /api/v1/batch`. Operations run in one server transaction. A field value of `{ $ref: <earlier op index> }` resolves to that op's generated id, so a child can reference its parent created earlier in the same batch (master-detail FK). Throws `ObjectStackError('BATCH_ERROR')` on a non-2xx response.

  **`@object-ui/plugin-form`**

  - `MasterDetailForm` now detects `dataSource.batchTransaction` and, on a NEW parent, builds one atomic batch (parent at index 0, each child FK set to `{ $ref: 0 }`) via the new pure helper `buildMasterDetailBatch`. Client-side total rollups are merged into the parent payload before the batch. Edit mode and adapters without `batchTransaction` keep the existing client-orchestrated path.
  - `ObjectForm` gained a `submitHandler` hook: when supplied, the form validates and hands the collected values to the host instead of calling `dataSource.create` / `dataSource.update`. `MasterDetailForm` uses it to own the atomic parent+children write while the parent fields are still rendered by `ObjectForm`.

  **`@object-ui/types`**

  - `ObjectFormSchema.submitHandler?: (values) => any | Promise<any>` — typed override for host-owned persistence.

  Pairs with the framework-side ambient-transaction fix (ObjectQL `AsyncLocalStorage` transaction propagation) and the `/api/v1/batch` endpoint added in `@objectstack/rest`.

- 300d755: feat(form): inline master-detail in a plain ObjectForm via `subforms`

  `ObjectFormSchema` gains a `subforms` array. When set, a regular `object-form`
  renders as a master-detail form — the object's own fields on top, an editable
  grid per child collection below, persisted together in one atomic transaction —
  without a bespoke `object-master-detail-form` page.

  ```ts
  { type: 'object-form', objectName: 'expense_claim',
    subforms: [{ childObject: 'expense_line' }] }   // FK + columns auto-derived
  ```

  Each subform needs only `childObject` (relationship FK and columns are derived
  from the child object's metadata; override with `relationshipField`/`columns`).
  This is the config-driven, page-less way to express master-detail entry — a form
  view can declare its child collections directly.

- 4eb9cb6: feat(plugin-tree): add a `tree` / tree-grid object view type

  Renders a self-referencing object as an indented, expand/collapse tree-grid —
  the right view for arbitrary-depth hierarchies (business unit / org chart,
  category trees, BOMs, nested comments) that fixed-depth grouping can't express.
  New `@object-ui/plugin-tree` package (`object-tree`/`tree`), `tree` added to the
  `ViewType` union, and dispatch wired through plugin-list `ListView` +
  app-shell `ObjectView` (the console path).

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

- ad8ade6: feat(components): metadata-derived field locators on generated forms (ADR-0054 Phase 4)

  The form renderer now emits a stable `data-testid="field:{objectName}.{field}"`
  (plus `data-field`) on every field wrapper, derived from the form's `objectName`
  and each field's name — closing the locator gap at the source so every generated
  form (`ObjectForm`/`ModalForm`/`DrawerForm`/`SplitForm`/`WizardForm`) inherits
  testable fields with zero per-app work (ADR-0054 C4). `FormSchema` gains an
  optional `objectName`; the object prefix is omitted (`field:{field}`) when a form
  has none. `FormItem` now accepts `data-*` attributes.

- 3870c20: feat(forms): declarative `navigateOnSuccess` + `resetOnSuccess` on object-form

  Rounds out declarative success behavior for metadata-only forms (which can't
  pass an `onSuccess` function), complementing `successMessage`:

  - **`navigateOnSuccess`** — after a successful create/update, navigate here.
    Supports `{id}`/`{recordId}` interpolation from the saved record and is
    same-origin-guarded; takes precedence over the toast (landing on the record
    is the confirmation).
  - **`resetOnSuccess`** — after a successful create, reset the form for another
    entry (the wizard returns to a cleared step 1). Ignored when navigating.

  Wired in both ObjectForm and WizardForm via a small shared `successBehavior`
  helper (kept dependency-free to avoid an EmbeddableForm import cycle).

- b88c560: feat(forms): declarative `successMessage` on object-form

  Metadata-only forms (a wizard/object-form authored as JSON) cannot pass an
  `onSuccess` function, so the post-create/update feedback was a fixed
  "Created"/"Saved" toast. `ObjectFormSchema` now accepts `successMessage`, which
  ObjectForm and WizardForm use for the default success toast when no `onSuccess`
  handler is supplied. Falls back to "Created"/"Saved".

## 6.2.3

## 6.2.2

## 6.2.1

## 6.2.0

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

## 6.0.4

## 6.0.3

## 6.0.2

## 6.0.1

## 6.0.0

## 5.4.2

## 5.4.1

## 5.4.0

### Minor Changes

- 3a8c754: Rebuilt the chatbot UI on top of **Vercel AI Elements** (MIT) and wired in
  the v1 capabilities exposed by `@objectstack/service-ai` (tracing,
  `generateObject`, `query_data` tool, `ModelRegistry`).
  - **What's new**
    - `ChatbotEnhanced` is now composed from `Conversation`, `Message`,
      `PromptInput`, `Suggestion`, `Tool`, `Reasoning`, `Sources`, and friends.
      Sticky-to-bottom scrolling, keyboard-aware textarea, file pill chips,
      copy/retry actions, and the streaming/error banners now match the
      shadcn-style AI surface used across the ecosystem.
    - **Tool / reasoning / sources rendering**: assistant messages with
      `toolInvocations`, `reasoning`, or `sources` automatically render the
      collapsible tool panels, the chain-of-thought block, and the citation
      pill. `useObjectChat` parses these directly from `vercel/ai`'s
      `UIMessage.parts` stream — no extra wiring needed at the call site.
    - **Model picker**: optional `models` + `selectedModelId` + `onModelChange`
      props render an inline `<select>` in the prompt-input toolbar. Designed
      to be fed straight from `GET /api/v1/ai/models` (new in service-ai
      v1).
    - **Trace links**: new optional `traceId` on `ChatMessage` surfaces a
      small "trace" link on assistant messages — pair with the `ai_traces`
      object exposed by service-ai's auto-tracing.
    - New optional `suggestions?: string[]` prop renders a chip row in the
      empty state and forwards the picked suggestion to `onSendMessage`.
    - All vendored AI Elements (10 components) plus two missing shadcn
      primitives (`button-group`, `input-group`) are exported as a namespace —
      `import { AIElements } from '@object-ui/plugin-chatbot'` — so apps can
      compose bespoke chat surfaces without dropping back to the legacy
      primitives.
  - **Type-level changes**
    - `@object-ui/types` `ChatMessage` gains optional `reasoning`, `sources`,
      `traceId` fields, and a new `ChatMessageSource` interface.
    - `ChatToolInvocation` accepts the AI SDK v6 lifecycle states
      (`input-streaming`/`input-available`/`output-available`/`output-error`/
      …) in addition to the legacy `partial-call`/`call`/`result`. `args`
      is now optional and accepts arbitrary shapes; new optional `errorText`
      field.
  - **What hasn't changed**
    - Public prop signature on `FloatingChatbot`, `FloatingChatbotPanel`, and
      the SDUI `"chatbot"` renderer.
    - Hook contracts: `useObjectChat`, `useAgents`,
      `useFloatingChatbot`.
    - SSR / Tailwind 4 / React 18+19 support.
  - **Under the hood**
    - New deps: `streamdown`, `use-stick-to-bottom`, `shiki`, `motion`,
      `nanoid`, `@radix-ui/react-use-controllable-state`,
      `@radix-ui/react-slot`, `class-variance-authority`.
    - Vendored sources live under `src/elements/` with header comments pointing
      back to `registry.ai-sdk.dev`. Rule #7 No-Touch Zones are respected —
      `packages/components/src/ui/**` was not modified.

## 5.3.2

## 5.3.1

## 5.3.0

## 5.2.1

## 5.2.0

### Minor Changes

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

- 9997cae: DataSource: add optional `bulkUpdate(resource, ids, patch)` for "same patch, many rows" interactions (Slack "mark all as read", Linear "archive selected"). The ObjectStack adapter routes to `POST /api/v1/data/:object/updateMany` so the client pays one HTTP/auth/RLS round-trip instead of N parallel PATCHes, eliminating mark-all-read jank on inboxes with 50+ unread.

  AppHeader's `markAllRead` now prefers `bulkUpdate`, with a transparent fallback to the per-id loop for adapters that don't implement the helper.

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

## 5.1.1

## 5.1.0

### Minor Changes

- cf30cc2: Polish Lightning record detail page layout.

  - `record:details` sections now render with Card chrome by default when a `title` is present, restoring visual grouping that was missing on pages like the opportunity detail page.
  - Section labels can be translated via the `{ns}.objects.{objectName}._sections.{name}.label` convention. Author each section with a stable `name` (e.g. `info`, `forecast`) and the renderer picks up the locale-specific label automatically. Falls back to the literal `label` when no translation exists.
  - The `page:header` action toolbar now collapses into a `⋯` overflow menu when more than two actions are present. The first business action stays inline; secondary system actions (Edit / Share / Delete) move into the menu, with destructive styling applied to Delete.
  - Header action labels resolve via the `{ns}.objects.{objectName}._actions.{name}.label` convention.
  - Removed the meaningless field-count Badge from collapsible section headers (the `2` chip next to "Description"). Field-count metadata wasn't useful in the header and added visual noise.
  - Synth-path `sys_delete` now carries `variant: 'destructive'` so the overflow menu can color it appropriately.

- 5b80cfd: feat: Optimistic Concurrency Control (OCC) on DataSource writes

  `DataSource.update()` and `DataSource.delete()` now accept an optional fourth /
  third argument `opts?: { ifMatch?: string }`. When supplied, adapters forward
  the token to the backend; servers that implement OCC (e.g. ObjectStack
  `>=4.2.0`) compare it against the record's current `updated_at` and reject
  with `409 CONCURRENT_UPDATE` on mismatch, preventing silent overwrites in
  multi-user editing scenarios.

  **`@object-ui/data-objectstack`**

  - Exports `ConcurrentUpdateError` (carries `currentVersion` and
    `currentRecord`) and `isConcurrentUpdateError()` type guard.
  - `update()` / `delete()` accept `opts.ifMatch` and forward it via the
    `@objectstack/client` data API (header: `If-Match`). Requires
    `@objectstack/client@>=4.1.2` for the header to reach the server;
    older clients silently drop the option and fall back to today's
    "last writer wins" behaviour.
  - Adapter-level error handling maps a 409 with `code === 'CONCURRENT_UPDATE'`
    into a typed `ConcurrentUpdateError` so callers can detect and recover
    from conflicts without parsing the wire format.

  **`@object-ui/core`**

  - `ApiDataSource.update()` and `.delete()` accept `opts.ifMatch` and emit
    the `If-Match` HTTP header.

  UI consumers (Detail view, inline cell-edit) will be wired in a follow-up
  patch to capture `updated_at` at load time, pass it as `ifMatch` on save,
  and present a Reload / Overwrite / Cancel dialog on conflict.

## 5.0.2

## 5.0.1

## 5.0.0

### Minor Changes

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

## 4.8.0

## 4.7.0

## 4.6.0

## 4.5.0

### Minor Changes

- ab5e281: `record:highlights` renderer normalizes rich field items.

  `RecordHighlightsComponentProps.fields` is now `Array<string | { name, label?, icon?, type? }>`. The renderer normalizes both forms before passing to `HeaderHighlight`, so schemas can attach per-instance label/icon overrides without editing the underlying object metadata. FLS and `redactFields` still apply on the normalized list.

## 4.4.0

## 4.3.1

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

## 4.0.4

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

## Unreleased

### Added

- **`ObjectSchemaMetadata.editMode`.** Optional `'modal' | 'page'` flag
  declaring whether record create/edit should open the global
  `<ModalForm>` (default) or navigate to the dedicated full-screen route
  mounted by `@object-ui/app-shell` (`/apps/:appName/:objectName/new` and
  `/apps/:appName/:objectName/record/:recordId/edit`). Default remains
  `'modal'` so existing schemas are unaffected. See the new guide at
  `content/docs/guide/record-edit-modes.md` for details.

## 4.0.1

## 4.0.0

### Major Changes

- Release v4.0.0: Unified app shell, convention-based i18n, and plugin architecture overhaul.

  ### Major Changes

  - **`@object-ui/app-shell`**: New unified application shell with sidebar, breadcrumb, and dashboard wiring.
  - **`@object-ui/providers`**: Promoted to first-class fixed package; new `DataSourceProvider` and `ThemeProvider` APIs.
  - **Convention-based i18n** (`@object-ui/i18n`): `useObjectLabel` now covers nav groups, dashboards, pages, reports, charts, and field options — zero-config localisation via translation packs.
  - **Dashboard surface i18n**: `DashboardRenderer`, `DashboardView`, `ChartRenderer`, `ObjectDataTable`, `ObjectChart`, and `data-table` all resolve labels through the i18n convention.
  - **Sidebar/breadcrumb/chart i18n**: Full i18n coverage across navigation, breadcrumbs, chart axes/legends, and table column headers.
  - **System view immutability**: Read-only UI affordances for system-managed views.
  - **Multi-level grouping**: Nested sub-group support with inline grouping editor.
  - **Record title resolution**: `titleFormat` and separator cleanup for consistent record display.

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

- de881ef: Mobile UX round 3 — Form: sticky save bar, fullscreen long-text editor, and auto-stepper for long forms on small viewports.

  **`@object-ui/types`** — `ObjectFormSchema.mobile` (new) lets a single form opt into all three behaviours:

  ```ts
  {
    type: 'object-form',
    objectName: 'leads',
    mode: 'create',
    mobile: {
      stickyActions: true,        // pin Submit/Cancel to bottom on phones
      stepper: 'auto',            // long forms render one field per step
      stepperMinFields: 8,        // …but only past this many fields
      stepperFieldsPerStep: 1,    // … (default 1)
      fullscreenLongText: true,   // textarea fields get an "expand" affordance
    },
  }
  ```

  `FormSchema.mobileStickyActions` (new) is the lower-level escape hatch — applied automatically when `mobile.stickyActions` is set on `ObjectFormSchema`.

  **`@object-ui/plugin-form`** — `ObjectForm` now:

  - propagates `mobile.fullscreenLongText` to every textarea/markdown/html field as `mobile_fullscreen: true`,
  - sets `mobileStickyActions` on the inner form schema and adds `pb-20` padding so content isn't covered by the fixed bar,
  - when `mobile.stepper === true` (or `'auto'` + `useIsMobile()` + > `stepperMinFields` fields), routes the flat field list through the existing `WizardForm` with synthetic single-field "steps" — keeping per-step validation and the existing `Next`/`Back`/`Submit` flow.

  **`@object-ui/components`** — the registered `form` renderer adds:

  - a `mobileStickyActions` opt-in that turns the action row into a `position: sticky; bottom: 0` bar on small viewports, and
  - an inline `FullscreenTextarea` wrapper used when no field-package widget is registered, providing the same expand-button + edit-dialog UX so the feature works even in lighter setups.

  **`@object-ui/fields`** — `TextAreaField` ships the actual fullscreen UX: a top-right `Maximize2` button opens a near-fullscreen `Dialog` containing a full-height `Textarea` with a draft-then-commit save model (Cancel reverts).

  All three behaviours are off by default — existing forms render unchanged.

## 3.3.2

## 3.3.1

## 3.3.0

## 3.2.0

## 3.1.5

## 3.1.4

## 3.1.3

## 3.1.2

## 3.1.1

### Patch Changes

- Patch release v3.1.1

## 3.0.3

## 3.0.2

## 3.0.1

## 3.0.0

### Minor Changes

- 87979c3: Upgrade to @objectstack v3.0.0 and console bundle optimization
  - Upgraded all @objectstack/\* packages from ^2.0.7 to ^3.0.0
  - Breaking change migrations: Hub → Cloud namespace, definePlugin removed, PaginatedResult.value → .records, PaginatedResult.count → .total, client.meta.getObject() → client.meta.getItem()
  - Console bundle optimization: split monolithic 3.7 MB chunk into 17 granular cacheable chunks (95% main entry reduction)
  - Added gzip + brotli pre-compression via vite-plugin-compression2
  - Lazy MSW loading for build:server (~150 KB gzip saved)
  - Added bundle analysis with rollup-plugin-visualizer

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

## 0.3.1

### Patch Changes

- Maintenance release - Documentation and build improvements

## 0.3.0

### Minor Changes

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

## 0.2.1

### Patch Changes

- Patch release: Add automated changeset workflow and CI/CD improvements

  This release includes infrastructure improvements:

  - Added changeset-based version management
  - Enhanced CI/CD workflows with GitHub Actions
  - Improved documentation for contributing and releasing

# @object-ui/components

## 17.7.0

### Minor Changes

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
- d796c8d: Auto-derived related lists consume the field-level `relatedListFilter`
  declaration — the list query AND-composed, the tab badge counting the same set
  (objectui#4664).
  
  A `lookup` / `master_detail` field may now declare `relatedListFilter`, a
  canonical Query-DSL `FilterCondition` such as `{ status: { $ne: 'deleted' } }`
  (`@objectstack/spec` 17.1.0 — objectstack#8704 / PR #8955). Until now this repo
  accepted that key at every gate and consumed it nowhere: a record page's derived
  related lists answered wider than the metadata asked, and the driving scenario —
  soft-deleted child rows on auto-derived record pages — had no way to be
  expressed at all.
  
  What ships:
  
  - `deriveRelatedLists` reads the key off the FK and carries it on the derived
    descriptor; `RecordDetailView` forwards it into the page synthesizer, which
    emits it onto the `record:related_list` node's **existing** `filter` key. That
    key already had a read site (objectstack#7118): `RelatedList` ANDs it with
    `{ [referenceField]: parentId }`. The declared filter is therefore an authored
    constraint that may only NARROW this parent's children — never a replacement,
    which would leak other parents' rows — and no second filter dialect appears
    for derived pages.
  - The **tab badge honours the same composed filter**. `page:tabs` reads the
    `filter` off the `record:related_list` node it is badging and the count store
    composes it with the parent scope through the same `mergeFilterNodes` sink the
    row query uses, so the badge and the rows send one `$filter`. Badge-count
    parity is normative in the spec key's own contract text; without this half the
    feature would ship the defect it exists to prevent — a badge saying 7 above a
    list showing 3.
  - Counts cache per (object, relationship, parent, **scope**), so a filtered and
    an unfiltered probe over the same relationship are separate entries rather
    than one wrong number.
  
  With no `relatedListFilter` declared, the synthesized node, the row query and
  the badge probe are byte-identical to before. Consumption only — this change
  adds no authoring UI for the filter.
- 4172589: **Breaking for authored metadata:** a `data-table` column spelled `name` no
  longer resolves its cells. Use the declared `accessorKey`.
  
  `data-table`'s column normalization used to read
  `accessorKey: col.accessorKey || col.name` — but `TableColumn`
  (`@object-ui/types`) declares only `accessorKey`, never `name`. The declared
  surface admitted one spelling while the runtime admitted two, which is the
  second de-facto contract AGENTS.md #0.1 forbids. The maintainer ruling of
  2026-08-20 settled the direction for the whole family: retire the consumer-side
  alias, translate at the producers. `label` → `header` retired first
  (objectui#5351); this retires `name` → `accessorKey` and closes the family.
  
  **Who is affected — a column authored DIRECTLY onto a `data-table` node:**
  
  ```json
  { "type": "data-table",
    "columns": [{ "name": "email", "label": "Email" }] }   // ← was tolerated
  ```
  
  becomes
  
  ```json
  { "type": "data-table",
    "columns": [{ "header": "Email", "accessorKey": "email" }] }
  ```
  
  **Who is NOT affected.** Columns reaching the table through `object-data-table`,
  a detail view's `related[]` list, or `object-grid` are unchanged — the adapter
  never sees a legacy spelling from any of them. The reason differs by producer,
  and the difference matters if you are debugging one:
  
  - `object-data-table` and a detail view's `related[]` list **resolve** the
    legacy spelling before delivery, stamping `accessorKey` from `name` (via
    `columnIdentity`). A `name`-spelled column keeps working there.
  - `object-grid` **refuses** it instead: since objectui#5068 an authored column
    must spell the declared `field`, and one that does not is dropped at intake
    and never reaches the table. Its delivered columns carry `accessorKey`
    stamped from `field`. So a `name`-spelled `object-grid` column does not
    render today either — that is objectui#5352's open question, unchanged by
    this release.
  
  Only the directly-authored `data-table` node narrows here.
  
  **How the break presents, so you can recognise it:** the column is not dropped
  and nothing is thrown — its header still renders over blank cells, and
  neighbouring columns are unaffected. If a table's header row looks right but one
  column's cells are empty, check that column's key spelling first.
  
  The two published skill guides that taught the `name` spelling
  (`skills/objectui/guides/data-integration.md`, `schema-expressions.md`) migrate
  in this same release, so the platform never refuses a spelling it still ships.
  
  Graded `minor`, not `patch`: this narrows the accepted input set, which is a
  breaking change for any author who used the tolerated spelling. It is not
  `major` per this repo's fixed-group convention (objectui's own breaking changes
  ship as `minor`; the group's major tracks `@objectstack`).
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
- 7cd3987: `ui:icon`: an unresolvable glyph now renders a visible placeholder instead of nothing
  
  An icon whose name does not resolve to a lucide glyph used to `return null`.
  That failed silently in two independent ways at once: invisible to a human (no
  gap, no error boundary — just an absent glyph), and clean-looking to a gate (a
  renderer that returns `null` spreads no attributes, so a DOM scan of it reports
  no findings).
  
  It now renders a dashed-square placeholder on the same SVG host, keeping the
  authored `className`, `size` and colour so the gap sits exactly where the icon
  would have been, with `role="img"`, an accessible name identifying the icon
  that failed, and a `data-objectui-icon-unresolved` marker. The `console.warn`
  stays and now names the cause.
  
  Also fixed: a node with no `name` at all reached `toPascalCase(undefined)` and
  threw, which the error boundary then swallowed — a third silent failure. It
  renders the placeholder too.
  
  Not included: `ui:icon` still reads the SDUI identity key `name` as its glyph
  name. Moving it to `schema.icon` is ruled but blocked on an authored-metadata
  migration — see objectui#5631.
- f8cdbf2: Route a `data-table`'s `emptyAction` node through `SchemaRenderer`, so a `visibleWhen`
  authored on it is actually evaluated (objectui#5926 gap 1).
  
  `visibleWhen` is not a per-block concern in this platform. It is enforced **once,
  generically**, in `packages/react/src/SchemaRenderer.tsx`: `shouldHide` tests `visibleWhen`
  ahead of the hoisted `visible` (objectui#5454), sets `_hidden`, and the `_hidden` early
  return fires **before** the registry dispatches. A block renderer cannot ignore the gate,
  because it never sees the node.
  
  `emptyAction` was the one authored-node exception in the tree. The empty-state CTA slot
  resolved the registry **directly** — `ComponentRegistry.get(node.type)` — and mounted the
  result itself, so the node never passed through `SchemaRenderer` and its `visibleWhen` was
  **never evaluated**. `@objectstack/spec` accepts the key (`SchemaNodeSchema` carries
  `visibleWhen`, and `data-display.zod.ts` types `emptyAction` as a `SchemaNode`), so an
  author wrote a gate, the platform took it, and nothing enforced it — declared-not-enforced,
  the same class objectui#5401 / #5505 closed for `record:alert`, one level down.
  
  Measured on the branch point, mounting a `data-table` with no rows so the empty state is
  actually reached: an `emptyAction` carrying
  `visibleWhen: { dialect: 'cel', source: 'features.can_create == true' }` under an ambient
  scope of `features.can_create = false` **rendered**, and so did the bare-string spelling of
  the same predicate. Both now render nothing. The three must-show cases were pinned in the
  same file and were green before and after — an `emptyAction` whose predicate resolves
  **true**, one declaring **no** `visibleWhen`, and one whose predicate names an unbound root
  (the central gate fails soft to visible, and this slot now gives the same answer as every
  other node rather than a private one).
  
  The fix is a **route**, not a new check: no `visibleWhen` test was added to `data-table.tsx`.
  A local check on this slot would have been a fourth evaluator, which is the drift
  `page:tabs`' item-level predicate already records on this card. The slot now mounts its
  authored node exactly the way the `empty` renderer's `action` slot always has.
  
  **Behaviour change worth declaring, beyond the gate itself.** No declaration moves and no
  new key is accepted, but two host-observable answers change on this slot:
  
  - An `emptyAction` whose `visibleWhen` resolves false stops rendering. That is the fix.
  - An `emptyAction` whose `type` is missing or names an unregistered component now gets the
    platform's uniform "unknown component type" report instead of rendering as silent
    nothing. Malformed metadata gets one answer across the tree rather than a private one
    here — but a page that shipped a typo'd `emptyAction` type went from invisible to visibly
    reported.
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
- 6fd2cf7: `radio-group` now renders the `orientation` its own type has always declared (objectui#6158).
  
  `RadioGroupSchema.orientation` was declared in two layers and read by none. The shipped TS
  type carries `orientation?: 'horizontal' | 'vertical'` with `@default 'vertical'`
  (`packages/types/src/form.ts:383`) and the zod mirror carries the matching
  `z.enum(['horizontal', 'vertical'])` (`packages/types/src/zod/form.zod.ts:282`), while
  `packages/components/src/renderers/form/radio-group.tsx` contained neither the string
  `orientation` nor `direction` and forwarded only `defaultValue`, `className`, the
  form-control DOM whitelist and the designer props.
  
  The consequence was measurable rather than cosmetic: every radiogroup root the library
  rendered came back byte-identical on that axis — no `data-orientation`, no
  `aria-orientation` — so the docs page's `## Layout Options` section demonstrated a
  distinction the product could not make, and its horizontal demo rendered vertically. An
  author reading the shipped type had every reason to write `orientation: 'horizontal'` and
  no way to discover it was inert.
  
  The key is now forwarded to the underlying Radix `RadioGroup`, which accepts it natively
  with the same two-value vocabulary and puts it on the root as `aria-orientation` and
  `data-orientation`; the layout utilities follow it so the visible difference the docs
  promise is real. This restores declared = enforced **without widening the acceptance
  set** — no new key is accepted, and no spelling outside the declared enum becomes legal.
  
  Two behaviour notes for anyone already shipping radio groups:
  
  - The declared `@default 'vertical'` is now actually applied instead of being left to
    Radix's own `undefined`. A group that never authored the key keeps the vertical stack it
    already rendered, and additionally announces `aria-orientation="vertical"` — the
    announced orientation now agrees with the rendered one rather than being absent. Arrow
    key roving focus narrows to Up/Down for those groups, which is the correct pairing for a
    vertical stack.
  - Author `className` still wins: the orientation layout utilities compose first and the
    authored class last, so tailwind-merge resolves every conflict in the author's favour.
  
  Registry meta `inputs` for `radio-group` gains `orientation` in the same change — it was
  the third surface that omitted the key, and leaving it out would have kept the designer
  palette disagreeing with the type.
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
- 8ec11e1: `page:header` resolves its `actions` as declared ACTION IDS (objectui#6252,
  implementing the objectstack#11592 ruling — maintainer, 2026-08-25, on
  recommendation B).
  
  `@objectstack/spec`'s `PageHeaderProps.actions` is
  `z.array(z.string()).describe('Action IDs to show in header')` and has been for
  as long as the key has existed. The canonical renderer read that array as
  `ActionDef` objects and resolved nothing, so a header authored the way the
  published contract declares rendered **zero buttons** — satisfying the schema
  deleted the header. Two sibling surfaces already read it as ids
  (`record:quick_actions`, and `layout:page-header` by delegating to it), so one
  authoring key meant two different things depending on which renderer drew the
  header.
  
  Each id is now resolved against the object's own `actions` metadata through the
  same `useMetadataItem` entry `record:quick_actions` uses. Resolution happens at
  the top of the actions pipeline, so the existing chain — `record_header` /
  `record_more` placement, the `requiredPermissions` capability gate, `visible` /
  `hidden`, `order`, and the inline/overflow split — runs unchanged over
  uniformly-shaped defs: an id-authored header and an object-authored one converge
  before a single filter runs.
  
  - Inline `ActionDef` objects keep rendering, per element, so a half-migrated
    `['convert', { … }]` array resolves the id and passes the object through. This
    is renderer tolerance for the migration and stays undeclared — the contract is
    ids.
  - An id that resolves to no action renders nothing and warns **once**, naming
    the object's declared action names. A mistyped id is no longer indistinguishable
    from a correctly hidden one.
  - Nothing is written back onto the authored node, so an id-authored page carries
    no `ActionDef` — and no `body.source` handler body — into what it serializes.
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
- c71e14d: **The unresolvable-visibility-predicate report now names the roots of the tier the
  predicate was actually evaluated against** (objectui#6487). An app-shell author
  whose nav, area or field `visible` faulted was told to check `record` and
  `page.<var>` — two roots that tier does not bind at all.
  
  `formatUnresolvableVisibilityMessage` and `reportUnresolvableVisibilityPredicate`
  (both exported from `@object-ui/react`) take a new **optional sixth argument**, a
  `PredicateScopeTier` — also exported — selecting the closing advice paragraph.
  Everything above that paragraph is unchanged on every surface, and so is every
  verdict: this is diagnostics copy only.
  
  **The published signature grew; nothing existing breaks.** The argument defaults
  to `'page-component'`, so a five-argument call keeps printing the bytes it
  printed before. All three in-repo call sites pass their tier explicitly rather
  than lean on that default.
  
  Each tier's root set was derived from the code that builds the bag, not from the
  prose that described it:
  
  - **`'page-component'`** — `SchemaRenderer`'s node gate and `page:tabs` item
    predicates. Both bind `record`, `current_user` and `page.<var>` (the roots
    `@objectstack/spec`'s `ui/page.zod.ts` declares for the tier). Its paragraph is
    byte-for-byte what it was.
  - **`'app-shell'`** — the chrome gate `ExpressionProvider.evaluateVisibility`
    runs, wired onto this reporter by objectui#6443. Its evaluator is built from
    `{ current_user, user, ctx: { user }, os: { user }, app, data, features }`, so
    the line now names `current_user` with its three ADR-0068 alias spellings,
    `app`, and `features` — the deployment-flag root that provider documents for
    exactly this kind of predicate — and states outright that `record` and
    `page.<var>` do not exist there.
  
  **Why not generalise the copy instead.** Dropping the concrete root names would
  have made one paragraph true everywhere at the cost of making it useful nowhere:
  an author who mistyped a root needs to know which roots exist *at their tier*,
  which is the whole reason the paragraph is read.
  
  `data` is bound at the app-shell tier but is deliberately not advertised there —
  every mount of `ExpressionProvider` in this repo passes `data={{}}` or omits it,
  so naming it would point an author at a root that answers nothing.
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
- 9486ac6: `ui:breadcrumb` now reads the two declared keys it never referenced — `separator` and
  `maxItems` (objectui#6646).
  
  `BreadcrumbSchema` has declared both since it shipped (`packages/types/src/navigation.ts`,
  mirrored in `zod/navigation.zod.ts`), and `separator` is additionally advertised to authors
  on the component's own documentation page. The renderer contained zero occurrences of
  either name: it always emitted the bare `BreadcrumbSeparator` and it never collapsed. That
  made `separator` the sharper of the two — an author who read the page, wrote
  `"separator": "/"` and saw a chevron got feedback **identical** to having misspelled the
  key, with nothing to tell the two apart.
  
  **Scored `minor`, not `patch`, on the separator default.** The sibling repair (PR #6644,
  the same renderer's `icon` key) was a `patch` because it only started drawing something
  where nothing had been drawn. This one also changes what an **unauthored** breadcrumb
  renders: `separator` carries `@default '/'` in the declaration while the renderer fell
  through to shadcn's `ChevronRight`, so declared default and actual render disagreed, and
  honouring only the authored value would have left the docs lying about the unauthored one.
  The render is aligned to the declaration (`schema.separator ?? '/'`) rather than the
  declaration being rewritten to match the render — rewriting a published `@default` is a
  contract change, which ADR-0049 routes to a maintainer, and this card's dispatched arm is
  "implement the declaration". Every existing `ui:breadcrumb` therefore separates with `/`
  instead of a chevron unless it authors otherwise. `''` is honoured as authored (no visible
  separator), not promoted to the default — hence `??` and not `||`.
  
  `maxItems` bounds how many crumbs are **rendered**. When the trail is longer, the first
  crumb and the last `maxItems - 1` survive with shadcn's `BreadcrumbEllipsis` between them,
  so the current page — the crumb a trail exists to name — is never the one dropped; at
  `maxItems: 1` there is no room for both ends and the current page is what stays. A value
  that cannot mean a count (absent, non-finite, below `1`) is declined rather than coerced,
  because silently inventing a truncated trail is worse than ignoring the key.
  
  Two catalog fixtures author the keys (`custom-separator`, `collapsed-trail`) and the docs
  page gained a section for each, plus the `maxItems` row its interface block never carried.
  
  `packages/types` is untouched: both keys were already declared, and the only thing missing
  was a renderer that read them.
- 7977ff9: Component deprecation is now DECLARED, not just warned about (objectui#6674).
  
  A deprecated component type used to be stated in exactly two places, neither of
  which a gate, a test or a type can consult: a `console.warn` string literal
  inside the renderer, and the word "(Deprecated)" inside a human-readable
  `label`. Both gates that touch component types ask a different question —
  whether the type RESOLVES — and a deprecated type resolves, which is how one
  could be authored 85 times across 27 shipped exemplars with every check green.
  
  - `@object-ui/core` gains `ComponentDeprecation` / `AuthoringSurface` and the
    `deprecated` key on the registration metadata, plus
    `ComponentRegistry.deprecationFor(type, surface)` to read it back. The
    declaration carries the SURFACES it applies to rather than being a boolean:
    `div` and `span` are deprecated on the JSON authoring surface and are at the
    same time permanent vocabulary of the `kind:'html'` tier, so a bare flag would
    be false for one of its two readers.
  - `@object-ui/components` marks `div` and `span` with the declaration their
    console notices already state. Nothing new is deprecated and no build starts
    failing: the catalog ratchet keeps the existing stock frozen, and draining it
    stays objectui#3965's worklist.
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
- 6a449fc: A field its own `visibleWhen` hides is now cleared, so it stops carrying a stale value
  to the server (objectui#6958).
  
  **Breaking, deliberately.** Until now a field the form renderer hid because the field's
  own `visibleWhen` (or its deprecated view-level sibling `visibleOn`) resolved FALSE kept
  its value in form state and submitted it anyway. Measured against a real running app: an
  object with four mutually-exclusive party columns and a type column naming which one
  applies could not be saved once a party column had been filled and then hidden — the
  server refused the row, correctly, by naming a column that was no longer on screen to
  clear. On the edit path the stored value was re-sent on **every** attempt, so such a
  record could never be retyped through the UI at all. The perverse consequence: *not*
  declaring `visibleWhen` produced an uglier but strictly **more usable** form, because the
  offending column stayed visible and therefore clearable.
  
  **What changes.** When a field's own visibility verdict goes VISIBLE → HIDDEN and the
  field holds a value, the renderer clears it: `null` for a scalar, `[]` for a multi-value.
  The key is deliberately PRESENT and `null` rather than withheld — objectui#6848 measured
  the write contract (`driver-memory` merges `{ ...stored, ...data }`, `driver-sql` issues
  `SET` for the keys present), so an absent key means "leave it unchanged" and only an
  explicit `null` overwrites the stored value. Omitting the key would have left the edit
  path exactly as dead as before.
  
  **What deliberately does NOT change.** Only the field's own conditional-visibility
  predicate clears. A field claimed by a hidden section (objectui#6236), a field on a hidden
  tab (objectui#6237) and a statically `hidden: true` field all keep the ruled semantics —
  visibility decides what is DRAWN and nothing else, and their values still submit. A broken
  predicate still fails OPEN, so a typo cannot silently null a stored column. The clear is
  transition-only and never writes over an empty value, so merely opening a record cannot
  strip the stored values of columns the user never saw, and a create form still omits the
  key for a field it never populated (objectui#4069).
  
  **Migration.** If you relied on `visibleWhen` to hide a field while still submitting its
  value, that value is now cleared on the transition. Carry such a value on a statically
  `hidden` field, or on a field claimed by a conditionally-hidden section, both of which are
  unaffected.
- d1842ab: `DataEmptyState` now declares `role="status"` by default, so an empty result is
  distinguishable from a failed one on every surface that renders it
  (objectui#7132).
  
  This is the convergence half of the two rulings that landed as objectui#7063 and
  objectui#7064, both resting on objectstack#13848: uniform behaviour belongs to
  the platform, and per-surface compensation is the per-app tax being ruled
  against. Those two fixed their own surfaces deliberately and locally; this card
  measured whether the shared primitive should carry the property. It did not.
  
  **Measured, not assumed.** All the surfaces were rendered and their empty boxes
  read directly:
  
  | surface | `role` before |
  |---|---|
  | `DataEmptyState` bare default | *none* |
  | `plugin-list` empty list | *none* |
  | `plugin-list` load-error panel | *none* |
  | `plugin-detail` activity timelines | *none* |
  | `ui:empty` schema renderer | *none* |
  | `plugin-dashboard` `WidgetEmptyState` (#7063) | `status`, typed at the call site |
  | `plugin-kanban` empty board | `status`, typed at the call site |
  
  The sibling states in the same file had always declared themselves —
  `DataLoadingState` is `role="status"`, `DataErrorState` is `role="alert"` — and
  the empty state alone declared nothing. So the surfaces were not legitimately
  differing: the ones that wanted the property had each hand-typed the same line,
  and the ones that had not yet done so were silently missing it. That is one
  platform default, copied by hand, at package level.
  
  **It is a default, not a fixed attribute** — `role` is spread from props, so a
  call site keeps the last word. That is what makes this inert for the two ruled
  surfaces: both already pass `role="status"` explicitly and receive the identical
  attribute with or without it. Neither surface's behaviour changes.
  
  **One real defect fell out of the measurement.** `plugin-list` renders its load
  FAILURE through `DataEmptyState`, borrowing it for layout — so a 403 saying "You
  don't have access" and a young object saying "Nothing here yet" were the same
  node shape, with no role on either. That panel now declares `role="alert"`,
  which both fixes the pre-existing indistinguishability and stops the new default
  from announcing an outage as a routine status.
  
  Metric/KPI widgets are untouched: their carve-out (`rows.length === 0 &&
  !isMetric`) gates whether an empty state is rendered *at all*, upstream of this
  component, so a KPI still reads `0` rather than "no data".
- 78ca238: `DataErrorState` accepts the icon props `DataEmptyState` already had, and `ListView`'s
  load-failure panel is now rendered by the error state instead of the empty state
  (objectui#7143; maintainer ruling 2026-09-01, director decision batch #27).
  
  `ListView` rendered its load FAILURE through `DataEmptyState` — the component named for
  the *empty* case — passing it a destructive icon, error copy and a retry action, while
  `DataErrorState`, in the same file and with the same layout, had no consumer anywhere in
  the repo. objectui#7132 closed the accessibility half of that collision (the panel now
  declares `role="alert"` over the empty state's `role="status"` default) and deliberately
  left the structural half alone: `DataErrorState` hardcoded its icon, so the swap was a
  props-surface question plus a visual change rather than a rename.
  
  **`@object-ui/components` — three additive optional props on `DataErrorState`**, mirrored
  from `DataEmptyState` in the same file rather than spelled a second way:
  
  - `icon?: React.ReactNode` — rendered above the title; falls back to the `AlertCircle`
    glyph the component has always drawn.
  - `showIcon?: boolean` (default `true`) — `false` omits the icon container entirely.
  - `iconWrapperClassName?: string` — REPLACES the wrapper's default class rather than
    merging with it, so `""` renders the icon raw. `DataEmptyState` resolves it with `??`
    against its own default and this does the same, against
    `flex size-10 items-center justify-center rounded-lg bg-destructive/10` — the destructive
    square `DataErrorState` already drew.
  
  Same names, same types, same default semantics as the empty state's; nothing existing on
  `DataErrorState` changed, and a call site that passes none of the three renders exactly
  what it rendered before. `illustration` and `action` were deliberately NOT mirrored — the
  ruling pins three props, and this component's retry affordance is already spelled
  `onRetry` / `retryLabel` (plus `children` for a call site that needs its own control).
  
  One non-prop addition rides along, called out rather than folded in: the icon wrapper now
  carries `data-slot="data-error-state-icon"`, mirroring the empty state's
  `data-empty-state-icon`. Without it the wrapper `iconWrapperClassName` governs has no
  name — untestable and unstylable — and migrating a call site off `DataEmptyState` would
  DROP that identifier rather than rename it.
  
  **`@object-ui/plugin-list` — the panel changes component identity, not pixels.** The call
  site passes the same custom icon through the new `icon` prop, the same
  `iconWrapperClassName="mb-3"`, the same title, and the same copy through `message` (the
  error state's spelling of `description`); its retry `<Button>` moves from `action` to
  `children`, which renders at the identical position. `role="alert"`, the
  `data-testid="list-error-state"` hook and `data-error-kind` are untouched. The whole
  rendered delta is two attributes:
  
  - the panel root's `data-slot` becomes `data-error-state` (was `data-empty-state`);
  - the icon wrapper's becomes `data-error-state-icon` (was `data-empty-state-icon`).
  
  Both are renames, not removals. Nothing in this repo styles or selects on either — no CSS
  rule and no test read them — so a stylesheet in a host app targeting
  `[data-slot="data-empty-state"]` to reach *this* panel is the only way to notice, and it
  should be reading `data-error-state` now. Every class on every node, and the glyphs
  themselves, are byte-identical: this is a visual no-op, deliberately, so the review the
  ruling asks for has a small thing to look at rather than a redesign.
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
- adbda1b: feat(data-table): pass `pendingRow` to the host cell editor — the row with its staged edits merged over it (#7188)
  
  `data-table` already computed each row's `pendingChanges` entry in the row loop that
  renders the editor; it now hands the injected editor that row merged with those staged
  values as `pendingRow`, next to the persisted `row`. Nothing about `row`, `value`,
  `stage`, `commit` or `cancel` changed. A host editor that scopes itself by a sibling
  field can read `pendingRow` and follow an edit the user has made but not yet saved.
- 7bf244b: BREAKING (`@object-ui/components`): the chart primitives — `ChartContainer`,
  `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`,
  `ChartStyle` and the `ChartConfig` type — are removed. `@object-ui/plugin-charts`
  is the single implementation (objectui#7397, maintainer ruling 2026-09-04).
  
  **Migration: import the chart primitives from `@object-ui/plugin-charts`.**
  
  (The bump is `minor` by this repo's release model — objectui's major is pinned to
  the `@objectstack` family major, and its own breaking changes ship as `minor` with
  the break spelled out here, per `scripts/check-changeset-no-major.mjs`. This
  paragraph is that spelling-out: the break below is real and consumer-visible.)
  
  - **What breaks, by specifier**: `import { ChartContainer, ChartTooltip,
    ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle } from
    '@object-ui/components'` and `import type { ChartConfig } from
    '@object-ui/components'` no longer resolve — TS2305 at build time, `undefined` at
    runtime. They were reachable through two `export *` hops (`src/index.ts` →
    `./ui` → `./chart`), so this is a real removal from the published surface, not a
    tidy-up of dead code.
  - **Not affected**: `ChartSkeleton` — the chart-area loading placeholder in
    `src/custom/view-skeleton.tsx` — is a different symbol and stays exported.
    `@objectstack/spec/ui` still owns the authored-chart `ChartConfig`; only the
    per-series style map published from this package is gone. `@object-ui/plugin-charts`
    calls its own map `ChartContainerConfig`, so the two names no longer collide.
  - **Why the copy had to go rather than be fixed in place**: it duplicated
    `packages/plugin-charts/src/ChartContainerImpl.tsx` and carried the
    label-resolution hole objectui#7248 had already fixed there. `ChartLegendContent`
    resolves a label as `config[nameKey || item.dataKey || 'value']` while rendering
    the colour swatch unconditionally, so a legend entry whose config lookup misses
    paints an anonymous coloured dot — on a scatter that reads as a data point drawn
    outside the plot area, which is exactly how objectui#7248 was reported. Two copies
    of one primitive is how a fixed bug returns; consumers importing from
    `@object-ui/components` were getting the unfixed one.
  - **Why not re-export the plugin's copy from here instead**: `@object-ui/plugin-charts`
    depends on `@object-ui/components` (`workspace:*`), so the dependency direction
    forbids it.
  - **Consumer census**: zero in-repo importers, measured with a lit control — no file
    under `apps/**`, `examples/**` or `packages/**` imported any of these names from
    `@object-ui/components`. `plugin-charts` reaches its own copy by relative path.
    The `hotcrm` and `cloud` repositories could not be read from the seat that made
    this change (HTTP 403), so no claim is made about them.
  
  `packages/components/shadcn-components.json` records `chart` under
  `customComponents` with `movedToPlugin: "@object-ui/plugin-charts"`, which is what
  keeps `pnpm shadcn:update-all` from re-fetching the primitive and silently undoing
  this.
- f0bb9fa: **Renamed:** the declared input carrying the action's execution type on `action:button` and
  `action:icon` is now `actionType`. It used to be `type`, which collides with the SDUI
  envelope's component discriminator. **No alias and no transition window** — a declaration
  still spelling it `type` sets the discriminator, not the input.
  
  Implements objectstack#14490 ruling A (maintainer, 2026-09-02, decision batch #13 item 4,
  verbatim 「同意」). The objectui half; the pinned `sdui.manifest.json` in objectstack follows
  as a separate change.
  
  **Why the old name could not stay.** `action:button` and `action:icon` were the only two of
  the manifest's 57 components declaring an input named `type`, and on no tier could an author
  actually set it:
  
  - **html tier** — `parse.ts` composes a node as `{ type: tag, ...props }`, props spread
    last, so `type="api"` replaced the component discriminator and the node stopped resolving
    to a component at all. `validate.ts` cannot report that: `type` is in `BASE_PROPS`, so it
    is skipped before the declared-input check runs. Two mechanisms, one outcome, no
    diagnostic. objectstack PR #14274 landed a refusal on this tier whose prescription
    ("write the tag you meant") is wrong for exactly these two components.
  - **react-page tier** — the wrapper stamps `type: tag` last and parks the author's value
    under `specType` (objectui#2880), which neither action renderer reads.
  - **JSON / `SchemaRenderer`** — the node's `type` is the component id, and the renderer
    forwarded it to `ActionRunner` as the action type. `'action:button'` binds no handler and
    no builtin: the click did nothing, with no error and no toast (the objectui#6306 shape).
  
  `actionType` is not a new vocabulary. It is the spelling this repo already used for this
  exact value: `action:bar` renames the declared type as it spreads a member onto its child
  (`type: componentType, actionType: action.type`), `ActionRunner.execute` resolves
  `action.type || action.actionType || action.name`, and both renderers already read
  `schema.actionType` FIRST. The rename makes the one working spelling the declared one.
  It follows the resolution `page:tabs.type` got upstream for the same carrier collision
  (retired in favour of `tabStyle`, objectstack#6776) rather than inventing a new convention.
  
  **Census of the authored corpus, measured before the rename, not assumed.** Across 4,797
  files in `examples/`, `apps/console/`, `content/docs/` and `packages/`: **zero** authored
  nodes set the input. 517 JSON files (433 of them the schema catalog) contain 2,410
  `type`-bearing nodes and **no** `action:button` / `action:icon` node at all — control: 127
  plain `button` nodes on the same walk. 207 parsed fenced JSON blocks in md/mdx carry **5**
  `action:button` nodes, all of them `{ type, label, icon?, action }` — the discriminator plus
  the `action` channel, none setting an execution type — control: 28 plain `button` nodes, and
  the count independently matches the corpus census already recorded in `SchemaRenderer.tsx`
  ("`action:button` (5 nodes)"). No docs page documents the input; no catalog entry uses the
  components. So the rename breaks no authored document in this repo.
  
  **What changes for a consumer.** The renderers no longer fall back to `schema.type` when
  `actionType` is absent — that fallback is the old spelling, and the ruling forbids an alias.
  A node that declares neither now forwards `type: undefined`, and `ActionRunner` falls
  through to its own `action.name` leg instead of being handed a component id. Declarations
  composed by `action:bar`, `action:group` and `action:menu` are unaffected: they carry the
  spec `ActionSchema.type` inside an `actions` array, which is a different surface and is
  unchanged.
  
  Pinned by `action-type-input-html-tier.test.tsx` (the html tier authors the renamed input
  end to end; the manifest built from the live registry accepts `actionType` and reports a
  bogus prop as the control) and by the rewritten standalone rows in
  `action-bar-member-type-resolution.test.tsx`, one of which now fails if the `|| schema.type`
  leg is ever added back.
- daf9d57: The last two consumer-side reads of `primaryField` off an OBJECT def are gone (objectui#7586).
  
  `primaryField` is a `DetailViewSchema` key (`@object-ui/types` `views.ts`) — a **view** key,
  which `DetailView.resolveDisplayTitle` reads off `schema` and is welcome to. Read off an
  **object** def it is undeclared: `@objectstack/spec`'s object schema is a `strictObject`
  answering `unrecognized_keys: ['primaryField']`, and `ObjectSchema.create()` throws.
  `primaryField` appears in **zero** files of the shipped `@objectstack/spec@17.2.0` dist,
  against 68 for the canonical `nameField`. objectstack#6326 removed the identical read from
  two lint rules; objectui#7287 / PR #7585 removed it from `resolveTitleField`. These two
  survived it — and three of this repo's own changelogs already called the probe *"not a spec
  property — always undefined"* while the code kept honouring it.
  
  **They are two different repairs, not one patch applied twice.**
  
  `@object-ui/components` — `PageHeaderRenderer`'s record-chip chain ranked
  `objectSchema.primaryField` directly under `schema.title` and **above** the unified ADR-0079
  resolver, on the surface that renders the **actual H1** of a synthesized record page. The
  rung is deleted, so the heading now comes from `titleFormat` → the ADR-0079 resolver
  (`nameField` → `displayNameField` → type-aware derivation) → the record-key walk, the same
  precedence `DetailView`'s own header uses.
  
  `@object-ui/plugin-detail` — `record:details`' dedupe ladder decides **which row the body
  grid hides**, so that the field already shown as the H1 is not repeated underneath it. That
  is a different question from "what is the title", and `primaryField` was its *first*
  candidate. The rung is deleted; the ladder is the literal display-name walk that mirrors the
  tail of the header chip's chain. Its docstring, which had described the chip as resolving
  "from objectSchema.primaryField", went stale when PR #7585 landed and now describes the chip
  as it is.
  
  **User-visible, deliberately.** A payload that carries the off-spec key anyway changes in two
  ways: the H1 of its record page stops being `primaryField`'s value, and a different row
  survives the detail grid. Nothing spec-legal can reach either path.
  
  `DetailViewSchema.primaryField` is untouched, and so is `ObjectDefLike.primaryField` in
  `buildDefaultPageSchema` — a deliberate declaration (not a read) that keeps an external
  caller's object literal type-checking.
- c15d7ec: One home for the `date` display convention in `data-table` (objectui#7620).
  
  `data-table`'s fallback cell (`formatCellValue`) sniffs ISO strings and
  formats them. Its date-only branch built its own `Intl.DateTimeFormat` bag —
  `{ year: 'numeric', month: 'short', day: 'numeric' }` — while the shared
  `formatDate` drops the year inside the CURRENT year on purpose (the year
  rarely helps on an in-progress record and crowds the cell). So one table
  rendered two faces for the same value depending on which path a cell took:
  the `date` field cell showed `Jul 4` and the fallback cell showed
  `Jul 4, 2026`. The branch now calls `formatDate` (default style).
  
  **Visible change**: in every `data-table`, a current-year date-only value in a
  column that renders through the fallback cell loses its year — `Jul 4, 2026`
  becomes `Jul 4` in `en-US` — and now matches the `date` field cell beside it.
  Past- and future-year dates are byte-identical (`Jul 4, 2024`), which is why
  the split was easy to miss: the two faces only ever diverged on the dates
  users look at most. The datetime branch, the non-date passthrough and every
  cell with its own renderer are untouched.
  
  A column that genuinely wants the year on every row is an explicit `format`
  style honoured by both paths, not a second option bag — the objectui#7443 /
  objectui#4576 lesson, one type over.
- c14d3a0: Honour `options[].disabled` on a `combobox` node (objectui#7687).
  
  **User-visible behaviour change, deliberately — hence `minor`, not `patch`.** The
  member was already declared by `@object-ui/types` (`ComboboxOption.disabled`) and
  already validated by the zod mirror (`ComboboxOptionSchema`, pinned as `boolean`
  on both faces by the objectui#7087 twin-symmetry ruling), but the component never
  read it: `Combobox` mapped each option to a `CommandItem` carrying `key`, `value`
  and `onSelect` only. So an option authored `{ value, label, disabled: true }`
  passed `safeValidateSchema`, type-checked against the published `ComboboxSchema`,
  and then rendered as an ordinary, fully selectable option — a declared key with no
  read site behind it, the class the enforce-or-remove ledgers exist to close.
  
  An author who already writes `disabled: true` today gets a different combobox
  after this change: that option now renders dimmed and can no longer be chosen, by
  click or by keyboard. That is the intended repair — declared and validated should
  mean enforced — but it is a change in what existing metadata does, not a silent
  internal fix, so it is priced as a behaviour change rather than a patch.
  
  The alternative remedy, retiring `disabled` from `ComboboxOption` and the zod
  mirror, was weighed and **not** adopted: it narrows a published surface and would
  require the objectui#7087 twin-symmetry pin to be changed, where honouring the key
  restores declared = enforced at the cost of one prop. The spelling follows the
  sibling select renderer, which already sets `disabled={opt.disabled}` on its
  `SelectItem`.
  
  Nothing else moves. The whole-control `disabled` prop (the one forwarded to the
  trigger button) is untouched, no key is added to `@object-ui/types`, and no new
  key is introduced — this release only starts reading one that was already
  published.
  
  `@object-ui/types` is deliberately **not** given its own bump. The one file that
  changes there is a test, `component-docs-disabled-inherited-7239.test.ts`: its
  census over `content/docs/components` counts every documented `disabled?:` row,
  and documenting the member adds a legitimate row that the ledger now claims as
  INDEPENDENT (the shipped `ComboboxOption` declares `disabled` itself and does not
  extend `BaseSchema`, so the narrow `boolean` spelling is correct for it). No
  shipped type or value moves in that package, so there is no behaviour there to
  version.
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
- dd19463: `stack` now reads its spacing from `gap` and nothing else — the undeclared
  `spacing` key it also accepted is gone (objectui#4890).
  
  `StackSchema extends Omit<FlexSchema, 'type'>`, whose spacing key is `gap`.
  `spacing` was declared by nothing: not the TypeScript interface, not the zod
  mirror, not the renderer's own `inputs` registration. `stack.tsx` read it anyway,
  as `schema.gap ?? (schema as any).spacing ?? 2` — and the `as any` is the whole
  story, since it existed to get past the type system saying the key was not there.
  A lenient consumer leg does not stay in the consumer: it becomes a second
  de-facto contract that producers write to, and 135 nodes across 39 files of the
  shipped schema catalog did exactly that. Every one of them rendered correctly, so
  nothing ever pointed at it, while the examples went on teaching the key to every
  author who copied them.
  
  The trap it was one edit away from springing: `flex` — semantically a `stack`
  with a `direction` — never read `spacing`, so re-typing any of those nodes would
  have dropped the spacing to the default silently. Fixed at the producer
  (AGENTS.md #0.1): those nodes now author `gap`, carrying the same value, and the
  alias is deleted rather than legalised into `StackSchema`, where it would only
  have been a second name for `gap`.
  
  **If you author `spacing` on a `stack`**, rename it to `gap`; the value and the
  rendering are unchanged. A `stack` still carrying `spacing` now renders the
  default gap, exactly as a `flex` always did.
  
  Also in the same sweep, and visible only in the published example catalog rather
  than in any package API: 140 catalog nodes that were already `flex` / `stack` /
  `container` stopped hand-writing their own declared props in `className`
  (`items-center` → `align`, `justify-between` → `justify`, `gap-2` → `gap`,
  `flex-wrap` → `wrap`, `p-4` → a container's `padding`) — 231 tokens in all
  (objectui#4891). Breakpoint-prefixed overrides and everything decorative stay in
  `className`, because the props are not responsive. Both facts are ratcheted in
  `examples/schema-catalog/test/layout-props-conversion.test.tsx`.
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
- aefe428: **Behaviour change.** Form section and field `visibleWhen` predicates that silently failed
  OPEN now actually evaluate — and a rule that resolves FALSE now hides the field
  (objectui#6010).
  
  `current_user` was bound on two of the three `visibleWhen` surfaces and not the third. A
  page component or app/nav gate got it (`ExpressionProvider` → `SchemaRenderer`), and a
  per-option gate got it (`resolveCascadingOptions(…, predicateScope)`), but every
  `resolveFieldRuleState` call in the form renderer passed `undefined` for the scope
  argument, so a form SECTION or FIELD predicate saw `record` and `previous` and nothing
  else. `'sales_manager' in current_user.positions` therefore named an **unbound root**
  there, and the visibility fallback is fail-open — so the gate did not hide the field from
  the people it named, it **showed the field to everyone**, with no signal beyond one
  deduped `console.warn`.
  
  **What changes for you, in the direction that matters:** if you authored a form-field or
  form-section `visibleWhen` naming `current_user`, saw the field render, and concluded the
  rule was permissive — it was not permissive, it was broken, and it is now enforced. That
  same field will now **hide** for every user the predicate resolves FALSE for. Audit any
  `visibleWhen` on a form field or section that references `current_user` / `user` /
  `ctx.user` / `os.user` before upgrading; a predicate that was quietly inert becomes live.
  
  Two things deliberately do **not** change:
  
  - **A genuinely unbound root still fails open.** A predicate the engine cannot evaluate at
    all still logs one warning and leaves the element visible. Only *evaluated-and-false*
    hides. `visibleWhen` remains presentation, not access control — use field-level security
    or RLS to stop someone reading something.
  - **The deprecated `visibleOn` alias** on a form field now binds the same scope, because
    ADR-0089 D2 folds it into `visibleWhen` at parse; binding one scope for the canonical
    spelling and another for its alias would have reproduced the same defect one spelling
    over. The synthesised legacy `condition: { field, equals }` predicate is unaffected — it
    is generated from a structured object and can only ever name `record.<field>`.
  
  This restores the contract both ADRs already declared: ADR-0068 D1 — *"a predicate authored
  against any one form evaluates identically"* — and ADR-0089 D1 — *"runtime record surfaces
  bind `record` + `current_user`"*. All five surfaces are now pinned against one authored
  predicate text in
  `packages/components/src/renderers/form/__tests__/predicate-scope-parity-6010.test.tsx`,
  so the next divergence is loud instead of silent.
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
- 72ffc34: Retire `ActionParamDialog`: the `custom` barrel's second action-param dialog is
  removed, and the app-shell dialog is recorded as the surviving implementation
  (objectui#5685, maintainer ruling of 2026-08-22).
  
  **Breaking for any out-of-repo host that imported it** (declared `minor` per the
  repo's version-alignment rule — the major tracks `@objectstack`, never an
  API-break count): `@object-ui/components` no longer exports `ActionParamDialog`
  or `ActionParamDialogProps`. Measured at the branch point, the export had zero
  production consumers — its only in-repo importers were its own five test files,
  which retire with it, and no other repository in the organization imports the
  symbol from this package.
  
  This file was the repo's SECOND implementation of the action-param surface, and
  its audit trail is the reason it retires instead of being maintained: the last
  close look (objectui#4758) found per-option `visibleWhen` not evaluated at all,
  and the five hardcoded English strings this card originally recorded were the
  next drift installment. A dormant second dialect of a governed surface is one
  production import away from being live; removing it removes the whole drift
  class.
  
  FROM → TO for an out-of-repo host:
  
  - `import { ActionParamDialog } from '@object-ui/components'` — no drop-in
    replacement is published. The surviving implementation is
    `@object-ui/app-shell`'s `ActionParamDialog` (`src/views/ActionParamDialog.tsx`),
    rendered by app-shell's action runtime (`useConsoleActionRuntime`,
    `RecordDetailView`) rather than exported standalone. A host that needs its own
    param form builds on `@object-ui/fields`' shared field widgets
    (`resolveFormWidgetType` / `getLazyFieldWidget`, ADR-0059) — the same seam the
    surviving dialog renders through.
  
  The unreleased objectui#4758 changeset for this component (`select` options
  through the shared option evaluator) is withdrawn in the same change: the
  component retires before that fix ever ships, so the release notes carry the
  removal rather than new behaviour of a surface this release does not contain.
- 91783c4: Three more secret-field spellings no longer render a secret in clear text on the form's unregistered-widget branch.
  
  Measured on `main` at `f2e11ae6f`, the real `form` renderer on the built-in path
  (no `registerAllFields()`), before and after objectui#5322's fix:
  
  ```
  type            registry hit   rendered type
  ui:password     true           text
  secret          false          text
  field:secret    false          text
  ```
  
  Two halves, per the maintainer ruling of 2026-08-20:
  
  - **`@object-ui/core` — an unresolvable namespaced widget id is now an authoring
    ERROR.** A form field's widget id (`widget`, else `type`) may name the
    `field:` namespace or a bare name; any other namespace resolves no field
    widget (objectui#5254) and used to degrade silently to a plain text box.
    `validateSchema` now reports `UNRESOLVABLE_FIELD_WIDGET_NAMESPACE` and
    `assertValidSchema` throws. Behaviour change: a schema that previously
    validated with e.g. `type: 'ui:password'` is now invalid — inventing a
    plausible-looking widget id fails loudly instead of rendering clear text.
    `field:` ids stay valid whether or not the widget is registered, since
    registration is a runtime fact an authoring-time validator cannot see.
  - **`@object-ui/components` — the known secret types cover the remaining
    spellings.** Bare `secret` and `ui:password` render the native masked input,
    and `field:secret` is refused outright like `field:password`. Existing authors
    need no migration.
  
  `ui:password` **is** registered — as an SDUI node renderer for a top-level
  `{ type: 'email' }`-style node — so an author who checked whether it resolved
  got a yes and still got a clear-text box on the field path. No producer emits
  any of the three; all are reachable only through a hand-authored standalone
  form schema, which is exactly the surface where the author is the producer and
  no normalizer sits in between.
- 490f482: The static `table` renderer reads only the declared `TableColumn` contract, and its published reference page teaches that spelling.
  
  `renderers/complex/table.tsx` resolved a heading as `col.header || col.label` and a
  cell as `row[col.accessorKey || col.name]`. Neither `label` nor `name` is declared
  on `TableColumn`, which declares `header` and `accessorKey` — both required
  (`packages/types/src/data-display.ts`). This was the fourth site of the
  column-alias family, after `data-table`, `ObjectDataTable` and `ObjectGrid`
  (objectui#5350).
  
  Both aliases are retired. The ruling recorded on objectui#5120 (2026-08-20) is the
  family direction — *retire the consumer-side alias; unify the producers* — and it
  names this site: the declared `header`/`accessorKey` contract wins.
  
  What makes this site different from its three siblings is that the alias was not
  merely tolerated, it was **published**. `content/docs/api/schema-reference.md`
  §TableSchema shipped a copyable `{ "name": "id", "label": "#" }` example and a
  property row reading *"Column definitions with `name`, `label`, …"*, while
  `packages/types` declared the opposite pair. Docs and type disagreed about one
  type they both call `TableColumn`, each internally consistent. Retiring the alias
  without correcting the page would have turned a documented, working example into a
  silently broken one, so both halves land together: the page now authors
  `accessorKey`/`header`. The same row also advertised a `render` property that
  `TableColumn` has never declared — the renderer's hook is `cell` — and that claim
  is dropped rather than re-spelled.
  
  The failure mode of a now-unresolvable column is worth stating, because it is
  quiet: the column keeps its slot and its neighbours are unaffected, the header or
  the cells simply render empty, and nothing throws. This renderer keys its cells by
  index rather than by accessor, so unlike `data-table` it does not even produce
  React's generic missing-key warning — a retired-spelling column is fully silent.
  Whether that silence should become an authoring diagnostic is objectui#5349's
  question; no diagnostic is added here.
  
  The two `columns.map` callbacks are typed `TableColumn` instead of `any`, so
  re-introducing an undeclared alias on this renderer is now a type error rather
  than a reviewer's catch.

### Patch Changes

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
- e304a4e: `ui:icon` and `ui:spinner` route their host spread through `toDomProps`
  (objectui#5632, the `BARE_SPREAD_ON_SVG` slice of objectui#5574).
  
  Both renderers forwarded their whole prop bag to the SVG they render, so every
  authored SDUI key on the node became an attribute — 14 per target, and
  `icon="check"` on all 71 icon nodes in the schema catalog. `IconSchema` and
  `SpinnerSchema` declare only `icon` / `size` / `color`, and both renderers
  already consume all three by name, so the SDUI pass-through list withholds
  nothing they need.
  
  Two user-visible behaviours change, both of which were invisible to the DOM-leak
  gate because the judge counts `stroke` / `width` / `height` as legitimate on an
  SVG host:
  
  - **`ui:spinner` now spins.** Its computed `class` (`animate-spin` plus the size
    class) was being overwritten by the `className` carried in the spread, so a
    spinner rendered through `SchemaRenderer` had neither. It is merged now.
  - **A sized `ui:spinner` no longer emits invalid dimensions.** `size` is an enum
    (`sm`/`md`/`lg`/`xl`) and the spread handed the string to lucide's numeric
    `size` prop, putting `width="lg" height="lg"` on the element.
  
  Also: an `icon` node's `color` is a Tailwind class (as `IconSchema.color`
  declares, and as every authored value in the catalog uses). It reached lucide's
  `color` prop through the spread as well, emitting an invalid
  `stroke="text-red-500"` beside the class that does the real work; only the class
  path remains. An authored raw CSS colour (e.g. `color: "red"`) no longer tints
  the glyph through that accident — declare the colour as a class, which is the
  declared contract.
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
- e30ed15: Correct two retired lucide spellings on component-registration `icon` meta
  (objectui#5936, the behaviour-neutral slice).
  
  `ui:page` declared `icon: 'Layout'` and `record:alert` declared
  `icon: 'AlertTriangle'`. lucide retires a spelling by dropping it from the runtime
  `icons` record while keeping the deprecated named export, so both names still
  import and still type-check while resolving to nothing through any resolver that
  reads that record. They are now the live keys `panels-top-left` and
  `triangle-alert`.
  
  **Behaviour-neutral by identity, in every resolution world.** The retired export
  and the live record entry are the SAME OBJECT — measured against the installed
  lucide 1.31.0, not asserted: `Layout === icons['PanelsTopLeft']` and
  `AlertTriangle === icons['TriangleAlert']` are both true. So the repair cannot
  substitute one glyph for another; it can only turn a name that resolves to
  nothing into one that resolves to the glyph it always meant.
  
  - Through a record-reading resolver (`renderers/action/resolve-icon.ts`), the old
    spellings resolve to `null` and the new ones to that shared object.
  - Through the dynamic surface (`iconNames`, 2025 names, retired aliases included),
    both spellings already resolved, and to the same glyph.
  - The kebab spellings were chosen because they are the only ones live on BOTH
    surfaces: `PanelsTopLeft` and `TriangleAlert` are record keys but are absent
    from `iconNames`, which is kebab-case only.
  
  Nothing is retired and no gate is extended here. `check-lucide-icon-record-names.mjs`
  deliberately does not judge a registration's `icon` meta, and it stays that way —
  its verdict is unchanged by this diff (182 names judged, green, both before and
  after). Whether the registration `icon` meta itself should be retired is the open
  half of objectui#5936 and is a maintainer decision under ADR-0049.
- 194fae1: `ui:button` resolves its authored `icon` through the shared `resolveIcon` instead of a
  byte-equivalent copy of it (objectui#5993).
  
  `renderers/form/button.tsx` carried its own `toPascalCase`, its own `iconNameMap` holding
  the single `Home -> House` entry, and its own index into lucide's runtime `icons` record —
  the same algorithm as `renderers/action/resolve-icon.ts`, but not the same function. The
  `action:*` family, `complex/data-table.tsx` and both menu renderers already import the
  shared one. The hazard was drift, not rendering: an alias added to `resolve-icon.ts` to
  absorb a lucide retirement (the objectui#5586 / #5622 mechanism) reached every one of those
  sites and silently missed `ui:button`, which would have gone on resolving the retired
  spelling to nothing while the rest of the repo resolved it correctly.
  
  **No behaviour changes, and that is measured rather than asserted.** The two
  implementations were compared over 3547 names — every one of lucide's 1767 record keys in
  both spellings, plus kebab-case probes (`arrow-right`, `dollar-sign`, `user-plus`), the
  `Home` alias, retired spellings and `undefined`: 3539 identical by object identity, 8
  differing only in the nullish flavour returned for a miss (the copy indexed the record and
  got `undefined`; the shared resolver `?? null`s it), zero genuine forks. That one
  difference cannot reach the DOM — `Icon` is consumed at exactly two sites, both
  `{!isLoading && Icon && <Icon .../>}` truthiness tests, and React renders nothing for
  `null` and `undefined` alike. Icon identity, `h-4 w-4` sizing, `iconPosition`, the loading
  state and the `Loader2` spinner are unchanged, and are pinned by
  `renderers/form/__tests__/button-shared-icon-resolver.test.tsx`.
  
  Because behaviour is unchanged, the usual red-before ablation does not exist for this
  change and none was manufactured. The one row in that suite that discriminates is
  structural: it spies on the shared module and fails when the glyph does not come out of it,
  which is red on the copy and green on the import.
  
  `scripts/check-lucide-icon-record-names.mjs` drops `form/button.tsx` from
  `DECLARED_RECORD_READERS` in the same commit — that gate rediscovers record readers from
  source on every run and fails on drift in both directions, so the removal is verified by
  the gate rather than declared. It is also what now guards the dedupe: a re-inlined copy
  would be discovered as an undeclared record reader and fail. The census entry for the
  `button` *type* stays, its resolver re-pointed at `resolve-icon.ts`, so `ui:button`'s
  authored icon names are still judged against the live record.
  
  `renderers/basic/icon.tsx` keeps its own copy deliberately and is untouched: `ui:icon`
  draws a `SquareDashed` placeholder and warns on an unresolvable name (objectui#5631), which
  the shared resolver does not do.
- 546ddf7: A node-gate visibility predicate that FAULTS now says so in a production build, once per
  distinct predicate source (objectui#6038, maintainer ruling 2026-08-25, option B: "the
  silence is no longer an accepted property"). Observability only — no verdict moves.
  
  `SchemaRenderer`'s visibility chain is fail-open: a predicate that cannot be evaluated
  resolves to the same answer as one that said yes, so a gate that stops biting looks
  exactly like a gate the author got right. The diagnostic that names it (objectui#5454 /
  objectui#5687) sat behind a `__DEV__` short-circuit, because the only fault-detection
  channel available was `throwOnError`, and on the CEL branch `evaluateCelCondition`
  implements that by evaluating **twice** — too expensive to ship for every predicate of
  every node.
  
  **What production actually printed before, measured per dialect on the built evaluator**
  — the card's premise held for one dialect of three, and the other two failed in opposite
  directions:
  
  | dialect | production console, before |
  |---|---|
  | bare string | **nothing** |
  | `{ dialect: 'cel' }` envelope | one generic line, deduped per source |
  | `${…}` template | one generic line **per evaluation**, never deduped |
  
  So the dialect objectstack#11254 measured a live gate breaking on was the silent one,
  while the template dialect was the console flood the ruling's rate-limit clause exists to
  prevent.
  
  **The fix reports the fault the evaluator already detected, at the same number of engine
  calls.** `EvaluationOptions.onFault` is a new passback on `@object-ui/core`'s
  `ExpressionEvaluator`: every fault site is already inside a `catch`, or already holds the
  canonical engine's failure reason, so nothing is evaluated twice. It mirrors, one layer
  up, the seam `FieldPredicateDiagnostic` already documents (`warn: false` plus a reason
  passback), and supplying it transfers reporting to the caller so one fault stays one
  line. Pinned: the CEL branch performs the same number of record reads with the passback
  as without it, and strictly fewer than the `throwOnError` probe.
  
  `SchemaRenderer` passes it in production and reports through the **same** reporter the dev
  branch uses — same message, same severity, same dedupe `Set`, same key. Development and
  production now print the identical line for the identical fault; the `__DEV__` gate no
  longer decides *whether* a fault is reported, only *how* it is detected.
  
  `page:tabs` item-level `visibleWhen` (`@object-ui/components`) is covered by the same
  reporter and the same rate limit. It swallowed the identical fault under a different
  helper, and it was the worse of the two: the node gate at least reported in development,
  while a faulting item predicate was silent in *both* builds on a gate whose false verdict
  removes an entire tab, header and panel.
  
  **Rate limit:** deduped per (node type, gate key, predicate source) — never per render and
  never per node instance. A two-hundred-row list of one broken predicate is one line; a
  second distinct predicate source still gets its own line. Both halves are pinned, because
  a test that asserts only "a warning was emitted" is equally green on an implementation
  that emitted fifty, and one that asserts only "exactly one" is equally green on an
  implementation that suppresses everything.
  
  **Not changed by this card, deliberately:** the fail-open semantics themselves; the
  objectui#5687 adapter-only `data.*` report, which stays development-only under its own
  2026-08-22 ruling (that path is not a fault — the predicate evaluated perfectly, against
  the wrong object); and the `/forms/:name` scope wiring of objectui#6262, which lands in
  its own PR.
  
  `reportUnresolvableVisibilityPredicate`, `formatUnresolvableVisibilityMessage`,
  `UNRESOLVABLE_VISIBILITY_PREFIX` and `__resetVisibilityPredicateWarnings` are now exported
  from `@object-ui/react` so every surface that evaluates a node `visibleWhen` shares one
  reporter and one rate limit — a second copy would mean a second dedupe `Set`, and one
  authored predicate would be entitled to one line per package instead of one line.
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
- f8c70f4: `ui:context-menu` now resolves a menu item's authored `icon` to a glyph. It previously never read the key at all.
  
  Both arms of `renderContextMenuItems` — the leaf `ContextMenuItem` and the `ContextMenuSubTrigger` — ignored `icon` entirely, so an item authored as `{ "label": "Copy", "icon": "copy" }` drew its label and nothing else. The name is now resolved through `resolveIcon`, the same lucide **record** surface `ui:button`, `ui:dropdown-menu` and the `action:*` family already resolve against: a live name draws its glyph, and an unknown or retired spelling draws nothing rather than degrading to a wrong glyph. This mirrors the repair `ui:dropdown-menu` received for the identical defect.
  
  The `components-overlay-context-menu/basic-context-menu` catalog fixture already declared four live names — `copy`, `scissors`, `clipboard`, `trash` — which drew nothing before this change and draw their glyphs now. Those names are also brought under `check:lucide-icon-record-names` by a new `context-menu` census entry, so a future retired spelling fails the gate instead of silently drawing nothing.
- f9c34df: An `action:icon` hosted by an `action:bar` now reaches its handler. It forwarded the
  COMPONENT id as the action type, so the click resolved nothing at all — no error, no
  toast, a button that silently did nothing (objectui#6306, the objectstack#2169 "Mark Done
  does nothing" shape).
  
  `action:bar` does not route members through `SchemaRenderer`. It pulls each member's
  renderer off the registry and RENAMES the declared type as it spreads it onto the child:
  `type` becomes the component id (`'action:icon'`) and the real declaration moves to
  `actionType`. `action:button` has always resolved that pair when it forwards
  (`schema.actionType || schema.type`); `action:icon` read `schema.type` alone and dropped
  `actionType` entirely. `ActionRunner.execute` resolves its handler from
  `action.type || action.actionType || action.name`, and `'action:icon'` binds no registered
  handler and no builtin — for a declaration carrying `target` rather than `endpoint` it does
  not reach the legacy `navigate`/`api` fallback either, so it fell through to
  `executeActionSchema` and the authored action never ran.
  
  **The bug was a function of the layout, not the declaration.** One authored action executed
  or did nothing depending on which `component` the host picked for it — the same asymmetry
  objectui#5493 fixed on this renderer for `onSuccess`, one key over.
  
  `check:action-forward-parity` could not have caught this and its green run was never
  evidence: `type` **is** in the forward whitelist, and that gate diffs key PRESENCE against
  the owed set. This is a wrong-VALUE defect behind a present key, a class the gate has no
  opinion on by construction. The existing icon coverage could not catch it either — it
  rendered `action:icon` bar members three times and asserted only `visible`/`enabled`, never
  that a click reached a handler, which is exactly how this shipped.
  
  Pinned by `action-bar-member-type-resolution.test.tsx`, which executes clicks rather than
  inspecting props. Every row that reads the icon member's zero renders a sibling
  `action:button` member of the SAME declaration in the SAME bar and reads its one first, so
  a zero cannot be "the harness never executed anything". One row registers a trap handler
  keyed on the component id, making the unfixed behaviour a positive artefact (the trap
  fires) rather than only a missing call. A standalone row stays green in both worlds on
  purpose: it refuses a "fix" written as `schema.actionType` alone, which would trade this
  defect for its mirror image on the surface where `type` IS the action type.
  
  Scope is this one renderer. `type: schema` appears in exactly two files under
  `renderers/action/` — `action-button.tsx` (already correct) and `action-icon.tsx`;
  `action:group` and `action:menu` compose their members differently and are untouched.
- f24de8b: The form renderer no longer leaks `FormSchema.previousValues` onto the `<form>` DOM node
  (objectui#6396).
  
  `previousValues` is a declared schema key with a real consumer: the renderer's
  `previousRecord` memo, which binds `previous` for field-rule CEL predicates and is the
  INSERT/UPDATE signal the read-only submit strip gates on (objectui#3484). That consumer
  reads it off `schema` and is unchanged. The defect was on the other channel —
  `SchemaRenderer` spreads every non-metadata top-level schema key as a React prop *in
  addition* to handing the node over as `schema`, so an edit-mode host (`ObjectForm`, which
  is what the `object-master-detail-form` header composes) delivered a second, top-level copy
  in `...props`. The renderer already consume-and-drops that whole family before its DOM
  spread — `objectName`, `onDirtyChange`, `defaultValues`, `fields`, `layout`, … —
  and `previousValues` was the one member missing from the list.
  
  Two things followed, on every edit-mode header render. React declined the prop and printed
  `React does not recognize the previousValues prop on a DOM element`, and — measured on
  React 19, and not recorded on the card — the persisted record was still stamped onto the
  element as `previousvalues="[object Object]"`. Consume-and-dropping the duplicate removes
  both.
  
  Scope is the runtime leak only. The declared key stays exactly as declared
  (`packages/types/src/form.ts`, `packages/types/src/zod/form.zod.ts` are untouched): it has
  a live consumer, so there is nothing here for the enforce-or-remove channel.
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
- 9486ac6: `ui:header-bar` now resolves a crumb's authored `icon` to a glyph instead of drawing
  nothing (objectui#6645).
  
  `HeaderBarSchema.crumbs` is typed `BreadcrumbItem[]` — the same declaration
  `BreadcrumbSchema.items` uses — and its Zod mirror does not merely declare `icon`, it
  **describes** it (`.describe('Breadcrumb icon')`), so any authoring surface that reads Zod
  `describe` can already offer the key to an author. `header-bar.tsx` contained zero
  occurrences of the substring `icon`.
  
  After PR #6644 repaired the breadcrumb side, **one declared key behaved differently on its
  two consumers**: authored on a `breadcrumb` item it drew a glyph, authored on a
  `header-bar` crumb it drew nothing. The asymmetry was invisible only because it had been a
  uniform zero on both. It is now asserted directly — one crumb object is rendered through
  both renderers and the resolved glyph compared, in the positive direction and on a retired
  spelling.
  
  Resolved through the **shared** `resolveIcon`, never a local normaliser: objectui#5993 is
  the standing lesson that a local copy is the same algorithm under a different function, and
  the alias later added there to absorb a lucide retirement reached every `action:*` site
  except `ui:button`. So this is the lucide **record** surface — a live name draws its glyph,
  an unknown or retired spelling draws nothing rather than degrading to a wrong one. The
  `home` -> lucide `House` rename lives only in the shared resolver's map, and a pin asserts
  it from the outside, so a future local re-implementation is red.
  
  The glyph renders once per crumb inside `BreadcrumbItem`, **above** `BreadcrumbLabel`, so
  all three of that helper's arms — the siblings quick-switch dropdown, the last crumb's
  `BreadcrumbPage`, and every earlier `BreadcrumbLink` — carry it by construction rather than
  one at a time.
  
  Scored `patch`, matching PR #6644's scoring of the identical repair on the sibling
  consumer: no new capability, a declared key that drew nothing starts drawing.
  
  A `crumbs-with-icons` catalog fixture authors the key and the docs page documents it, so
  this does not come back next round as "declared but unenforced". The icon-record gate gains
  a `header-bar` census entry for the same reason `context-menu` gained one in objectui#6278:
  until the repair the names reached no resolver and declining them was correct, and a census
  entry is a fact about a renderer. That is not objectui#5992's blind spot, which is the gate
  *guessing* at containers nobody read off a renderer.
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
- 4c68077: A non-array `data` authored on a `data-table` node is now named at render
  instead of dropped in silence (objectui#6665).
  
  `DataTableRenderer` takes its rows from `data: rawData = EMPTY_ROWS` off the
  node and then collapses `Array.isArray(rawData) ? rawData : EMPTY_ROWS`. Any
  non-array value an author wrote therefore becomes zero rows with no error and
  no warning, and the table draws a correct-looking header over `No results
  found` — which reads as a success receipt, the hardest failure shape for a
  human or an AI author to self-check.
  
  The spelling that opened the card is a `${...}` expression string, and it is a
  defect rather than a design because the SAME expression is evaluated one key
  over. Re-measured on merge-base `5967be095` through the real `SchemaRenderer`
  (the table was previously quoted from `skills/objectui/rules/protocol.md` as a
  measurement on `f1c27f037` and had not been re-run); all four legs reproduced,
  and they are now pinned as tests rather than prose:
  
  | node | body |
  |---|---|
  | `{ "data": "${data.customers}" }` | `No results found` |
  | `{ "props": { "data": "${data.customers}" } }` | `No results found` |
  | `{ "properties": { "data": "${data.customers}" } }` | the two rows |
  | `{ "data": [ two literal records ] }` | the two rows |
  
  The predicate is deliberately WIDER than the reported spelling: `data` authored
  and not an array. The `${...}` shape only selects a sharper sentence, because
  the swallow at `Array.isArray(...)` is general — a number, an object, a `null`
  and a plain string are dropped exactly as silently, and a predicate keyed on
  the expression shape would leave each of them to arrive as a fresh card.
  
  It reuses objectui#6575's channel (`dataTableBindDiagnostic.ts`) as a SECOND
  predicate rather than a widened one. The nodes that trip this carry no `bind`
  at all, so that diagnostic's silence on them is correct behaviour, not a gap.
  
  No behaviour change: node-level `data` still does not evaluate expressions.
  Making it do so is a behaviour change on a published component and was ruled to
  the maintainer, not to this change. Nothing is added to the published surface
  either — the new predicate, message builder and prefix constant are
  module-internal and are not re-exported from the package entry, matching
  objectui#6575's own symbols. The trap stops being silent; it does not stop
  being a trap.
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
- 06b8c42: Re-key three more renderer effects onto the primitives they actually read,
  instead of the memoised object identity that produced them (objectui#6697 —
  the three census members from objectui#6592 that sit outside its
  `getDataConfig(schema)` family):
  
  - `RelatedList`'s collection fetch now depends on `defaultSortKey` /
    `filterKey` (the `JSON.stringify`-derived content strings the two memos are
    already keyed on) rather than on `defaultSortSpec` / `listFilterNode`.
  - `page:tabs`' related-count probe now depends on a serialised `probeKey`
    rather than on the `probeTargets` `Map`.
  - `ListView`'s data fetch now depends on the `expandFields` memo's own INPUTS
    — `schema.columns`, the alternate views' binding blocks and
    `objectDef?.fields`, all props and state a discard cannot move — rather than
    on the `expandFields` array the memo returns.
  
  `useMemo` carries no semantic guarantee — React is permitted to discard a memo
  cache and recompute even when its dependency array compares equal to the
  previous render — and all three factories return a FRESH value on every call
  (`normalizeSortSpec`/`toFilterNode` build a new array / a freshly lowered AST,
  the probe factory builds a new `Map`, `buildExpandFields` returns a new array
  in every branch). So each effect re-ran on a discard alone, with nothing an
  author or a caller controls having changed: an extra `dataSource.find` for the
  related collection, an extra `dataSource.find` for the list window, and a
  redundant re-probe of every tab's count. Keying on the primitives makes a
  cache discard a no-op and returns `useMemo` to being a pure optimisation.
  
  Severity is low and the fix is deliberately narrow: the observable was a
  redundant round trip, never incorrect data, so only the re-run condition
  moves — each effect body still reads the memoised value, and a genuine change
  still refetches exactly as before.
  
  The three take two routes on purpose — key on the nearest DISCARD-IMMUNE
  thing. `RelatedList`'s memos are keyed on exactly one primitive each, and
  `page:tabs`' probe memo is keyed on another MEMO's output (`items`), which is
  not discard-immune, so both take a content string. `ListView`'s memo is keyed
  on props and state, so it names those directly: a value key over
  `expandFields` would NOT have been content-equivalent there — `buildExpandFields`
  collapses the collected set down to the relation roots, while the effect body
  also builds `$select` from `schema.columns` and the view bindings — and it
  would have defeated objectui#4567's live-dependency pin, which ruled that
  "ListView's by-identity dependency is correct for a real column change" and
  put the identity stabilisation at the PRODUCER.
  
  One correction to the census card's account, measured while pinning it: for
  `page:tabs` the redundant probe costs nothing on the wire.
  `RelatedCountStore.fetch` returns the cached count as its first act and dedupes
  concurrent probes, so the extra work is the effect re-running, not an extra
  request.
- 7c9b044: `flex` declares the containment it renders (objectui#6740).
  
  `flex` has always rendered `schema.children`, but its registration omitted
  `isContainer` while `grid`, `card`, `container` and `stack` — same directory,
  same `ui` namespace — all declared it. The render path never reads the flag, so
  nothing was broken at runtime; its consumers are elsewhere, and the gap made
  them contradict the renderer.
  
  MEASURED through the mechanism, not inferred from the property. Building the
  manifest the way the app builds it (`getKnownTypes()` + `getMeta()` ->
  `manifestFromConfigs`) and putting a `flex` node carrying children through
  `validateTree` returned `["not-a-container"]`, while `grid` / `card` /
  `container` under the identical probe returned `[]` — the control that makes
  that reading real. Downstream, objectstack's three shipped
  `examples/app-showcase` html pages drew 232 diagnostics, of which every one of
  the 32 warnings was `not-a-container` on `flex`, and `flex` was their only
  source. `validateTree` is not on objectstack's production gate path today, so
  the warnings are currently unobserved — which is why this is worth closing
  before that gate goes live rather than after.
  
  **Second consumer, and the reason this is not purely a declaration change.**
  `renderers/layout/react-page.tsx` builds the JSX scope of every `kind:'react'`
  page with `if (!tag || cfg.isContainer) continue;`. While `flex` omitted the
  flag it was the one layout primitive of the five still injected there, so
  `<Flex>` resolved in react page source — and rendered an EMPTY div, because the
  injected wrapper drops `children`. It now behaves like its four siblings and is
  not injected, which is what `content/docs/guide/react-pages.md` has documented
  all along ("Layout containers are deliberately not injected ... `<flex>`,
  `<grid>`, `<card>` and friends have no injected wrapper"). A react page that
  wrote `<Flex>` moves from silently swallowing its children to the page-level
  error panel naming the identifier, with that page's documented remedy being
  real HTML: `<div style={{ display: 'flex', gap: 16 }}>`.
  
  Pinned over the family rather than over `flex` alone: the defect's shape was
  "three declare it and one does not", and a pin covering only the one that was
  missing would let the next registration rot the same way.
- 846889b: The seven semantic sectioning tags and `aspect-ratio` declare the containment
  they render (objectui#6764).
  
  `renderers/layout/semantic.tsx` registers `aside`, `main`, `header`, `nav`,
  `footer`, `section` and `article`, and `renderers/layout/aspect-ratio.tsx`
  registers one more; all eight call
  `renderChildren(schema.children || schema.body)` and none declared
  `isContainer`. Nothing on the render path reads that flag, so children always
  rendered — what the omission did was make `validateTree` warn `not-a-container`
  on a child list it then rendered, on the tier built to accept AI-authored pages.
  A warning that lies trains authors to discount the true ones.
  
  Same reasoning as objectui#3900 (`page-header`) and objectui#6740 (`flex`):
  `children` is a base property of every node in the JSON protocol, not a
  per-component authoring key, so the flag widens no spec surface.
  
  Scoped by measurement, not by sweep. The census behind this change rendered
  every registered key through the real `SchemaRenderer` and put it through
  `validateTree`: of 131 bare authoring tags, 58 render `schema.children`, 5
  declared the flag, and 53 did not. These 8 are the subset where the second
  consumer is provably unaffected — `renderers/layout/react-page.tsx` drops
  containers from the `kind:'react'` JSX scope, but it reads `getPublicConfigs()`
  and none of the 8 is in the curated public contract. The remaining 45 are
  reported on the card rather than swept in, `button` among them precisely because
  it IS public.
- 26896c6: `element:*` renderers stop re-reading a degenerate config bag as its own character indices — the third and last channel of the objectui#6752 / objectui#6760 hazard (objectui#6783).
  
  Five modules under `packages/components/src/renderers/basic/` — `elements.tsx`, `data-list.tsx`, `text-input.tsx`, `record-picker.tsx`, `metadata-viewer.tsx` — each carried a copy of the same reader, `{ ...(schema?.props ?? {}), ...(schema?.properties ?? {}) }`. `??` only replaces `null`/`undefined`, so a non-object bag went into the object spread and came back out as indexed keys: for `properties: 'not-a-bag'`, the config bag a renderer received was `{ '0': 'n', '1': 'o', … '8': 'g' }` — nine keys nobody authored. The five copies are now one `readProps` (`renderers/basic/readProps.ts`) that asks `isConfigBag`, and a degenerate bag on either side contributes no keys.
  
  `@object-ui/react` exports `isConfigBag` from its package entry. That is the API addition here, and it is the reason the fix is not a sixth spelling of the predicate: objectui#6761 converged six occurrences of "is this a real config bag?" behind one definition in `packages/react/src/utils/configBag.ts` and pinned it, but the pin scans `packages/react/src` only — a copy written one package over would be invisible to it. `@object-ui/components` already depends on `@object-ui/react` (all five modules import from it today), so the reachable answer was to publish the definition rather than retell it. Same reason the node-gate predicate reporter is exported at that entry (objectui#6038): one definition, read by every package that asks.
  
  **What this does not change, measured rather than predicted.** No rendered output moves on today's tree. All five renderers read named keys off this bag, and the single onward spread — `metadata-viewer`'s `<StateMachineView {...props} />` — hands it to components that destructure named fields, so the indexed keys were computed and then dropped. The census behind objectui#6708 found zero authored nodes carrying a degenerate config bag, so this was a latent shape, not a live failure. What the guard buys is what objectui#6752 measured its own guard buys, one channel further down: the authored value's shape is not reinterpreted. objectui#5123's precedence is untouched — `properties` still wins a contested key, and a degenerate bag declares no key for either side to win.
- 00d3f09: `button-group` honors per-button `disabled`, and the catalog stops authoring 29 keys
  nothing reads (objectui#7077, maintainer ruling 2026-09-04, decision batch #25).
  
  **The renderer change.** `ButtonGroupButton` declares `disabled?: boolean` and the
  renderer read it nowhere — it mapped `schema.buttons` to `Button` elements passing
  `variant`, `size`, `className` and `label` and nothing else, so a button declaring
  `disabled: true` rendered live and clickable. It now forwards the value, matching every
  sibling that declares item-level `disabled`: `tabs`, `select`, `dropdown-menu`,
  `menubar`, `context-menu`, and `toggle-group` since objectui#4632. This is mechanical
  consistency with an already-declared contract — no new key, no new type member, and no
  change to what any schema accepts or refuses.
  
  **Migration.** None required. A `disabled: true` you already author starts taking
  effect; that is the declared meaning of the key, and nothing in the shipped corpus
  authored it.
  
  **The corpus change.** `button-group` stays a **presentational** group: no selection
  state, no `selectionMode`, no group-level `value`, no per-button `value`, no per-button
  `icon`. All six catalog fixtures authored those four undeclared keys — 29 occurrences —
  and every one parsed green, because `BaseSchema` is `.passthrough()` and carries
  `[key: string]: any`: admitted unexamined, never refused. The keys are gone from the
  fixtures. Implementing selection instead was weighed and rejected: it is a capability
  addition with zero measured pull, and the only things authoring it were fixtures we
  wrote ourselves — the corpus reverse-defining the product. It remains available as a
  fallback if a real consumer (an app or example needing a segmented control) is produced
  first.
  
  This matters more than a demo tidy-up because the catalog is the corpus AI authoring
  tools retrieve from. An author copying the old `single-selection.json` got a schema that
  validated, published, and did nothing — a failure with no signal to self-correct from.
  
  `with-icons.json` is **removed** rather than emptied: with `icon` retired, a fixture by
  that name authored no icons, and what remained duplicated `basic-button-group.json`. Its
  demo slot on the docs page goes with it. The other five keep their labels and still
  render — `icon-toolbar.json` rendered three blank buttons until objectui#6318 gave it
  labels, and a pin now holds every fixture in the category to a non-empty `label` on
  every button.
  
  `onClick` is **not** wired, and is not a gap: objectui#6124 (PR #7339) retired it two
  days before this ruling. It is `onClick?: never` on the TypeScript face and a refusal by
  name on the Zod mirror, so there is no declared-but-dead handler left to forward.
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
- b9f5ff1: fix(components): eight widgets now consume `SchemaRenderer`'s evaluated `disabled` verdict instead of re-reading the raw authored key
  
  `disabled` on a schema node is `boolean | string` — the string being a predicate. `SchemaRenderer` evaluates `disabled` / `disabledOn`, strips the raw key from the props it spreads, and forwards the answer as a real `disabled` prop. `ui:form`, `ui:button`, `ui:input`, `ui:textarea`, `ui:checkbox`, `ui:select`, `ui:combobox` and `ui:collapsible` re-read the raw key beside that verdict, and an expression string is truthy however it evaluates.
  
  Two user-visible defects go away:
  
  - `ui:form` — a form declaring `disabled: "${...}"` greyed out every field, the submit button and the cancel button even when the predicate was FALSE.
  - `ui:button` — `loading: true` did not disable the button when it was rendered through `SchemaRenderer`: the computed state was overwritten by the forwarded verdict arriving through the DOM pass-through spread, so the spinner ran on a live control.
  
  The six DOM pass-throughs kept their behaviour through `SchemaRenderer` and now read the verdict by name rather than depending on spread order.
- 4704aa4: A form no longer ends on a screen asserting both a failure and a success (objectui#7252).
  
  A refused submit raised an error toast that nothing ever retired, so when the user
  fixed the input and submitted again the confirmation of that second attempt appeared
  *beside* the refusal of the first — a wizard's last step showing "Invalid project
  status transition." and "Your new project is ready…" at the same time.
  
  Every outcome toast a form raises now travels under one stable per-form id, so the
  later outcome supersedes the earlier one instead of stacking beside it:
  
  - `@object-ui/components`' form renderer publishes its three outcome toasts (the
    field-level rejection, an `onAction` error, and a rejected write) under that id, and
    retires the previous attempt's toast in the same place it already cleared the
    previous attempt's in-form banner. This is what fixes the reported wizard flow: the
    refusal comes from this renderer while the success toast is raised by the host
    (`WizardForm` / `ObjectForm`), so no single raiser could supersede the other before.
  - the console's own `FormPage` publishes its confirmation and its submit failure under
    one id, for the same reason.
  
  Toast durations are unchanged — this is about supersession, not lifetime. The
  objectui#4190 arm is deliberately excluded: a refused redirect *destination* still gets
  its own toast, because the write succeeded and that refusal has to stay readable beside
  the confirmation it qualifies.
- 26e06d7: Delete the second, dead `SchemaRenderer` in `packages/components/src` (objectui#7319).
  
  `packages/components/src/SchemaRenderer.tsx` was a 28-line component carrying the same
  export name as the real renderer in `packages/react/src/SchemaRenderer.tsx`. Nothing
  reached it: it is absent from the package barrel, no file in the repo imports it by any
  form, and the package's `exports` map has no subpath that resolves to it.
  
  **No behaviour changes.** The file was never in the runtime bundle — two markers unique to
  it appear in zero `dist/` files, while controls for barrel-exported symbols appear in four
  each. Its only shipped footprint was a stray types-only `dist/SchemaRenderer.d.ts` with no
  runtime module behind it, reachable through no specifier; the published tarball loses that
  file, and no importable surface changes in either direction. Hence a patch, not a minor.
  
  **Why deleting beat keeping.** The copy is a trap, which is what the card's triage asked
  whoever took it to settle. It evaluates no predicate at all: of the real renderer's six
  visibility legs (`visibleWhen` / `visible` / `visibleOn` / `visibility` / `hidden` /
  `hiddenOn`) it consults exactly one, `hidden`, and by bare truthiness rather than
  evaluation — so a node declaring `hiddenOn` is never hidden, and the two enablement legs
  (`disabled` / `disabledOn`) are not read at all. It then spreads `{...schema}` raw, so
  `disabled` would reach the widget as an unevaluated value, which is the precise inverse of
  the real renderer's contract: evaluate the predicate, strip the raw key, forward only the
  verdict.
- 81a2eb1: One home for the `datetime` display convention (objectui#7443).
  
  `formatDateTime` gains a named `'compact'` style, selected through
  `options.style` — the dense grid face, `7/4/2024 7:00 am` in `en-US` — which
  `DateTimeCellRenderer` used to build from its own inlined `Intl` option bags.
  The cell now reads `field.format` (it destructured `value` only, so a
  `datetime` field could not reach the style vocabulary a `date` field has) and
  renders through the shared function, and `data-table`'s `formatCellValue`
  calls `formatDateTime` instead of a third, independently authored option bag.
  Every existing cell without an authored `format`, and every cell authoring
  `'compact'`, renders byte-identically; `'compact'` is today's face named and
  rehoused, not a new one. A `datetime` field that authors any OTHER non-empty
  `format` does change: the cell previously ignored `field` altogether and always
  painted the compact face, and now anything other than `'compact'` selects the
  verbose `formatDateTime` default — measured as `Jul 4, 2024, 07:00 AM` in
  `en-US` for the instant whose compact face is `7/4/2024 7:00 am`. An
  unrecognised value is neither rejected nor passed through; it silently lands on
  that verbose face. No `datetime` field in this repository authors a `format`, so
  no cell here moves — a consumer that authored one is the case this sentence is
  for. Note that `format` has no declared value vocabulary to check a value
  against: `@object-ui/types` types it `format?: string`, and `@objectstack/spec`
  carries one free-form `format?: string` on its shared field schema, described
  "Format string (e.g. email, phone)" and accepting any string. `'compact'` is
  therefore the only value with a defined `datetime` meaning, and every other
  value means "the verbose face" by fallthrough rather than by design.
  
  Additive, no signature change: `formatDateTime(value, options?)` is unchanged
  and `formatDateTime(v, { locale })` keeps meaning what it meant.
  `DateDisplayOptions` gains an optional `style` key (read by `formatDateTime`
  only; `formatDate` still takes its style positionally), and
  `formatDateTimeCompactParts` is a new export of `@object-ui/core`, re-exported
  by `@object-ui/fields`, returning the compact face as the two halves a grid
  cell paints separately. `@object-ui/components` changes no rendered output —
  the table's datetime cell is measured identical before and after in `en-US`,
  `zh` and `de-DE`.
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
- 2f61238: Remove `src/ui/toast.tsx`, an unreferenced primitive, and the dependency only it imported
  
  The file was reachable from nothing: no importer anywhere under
  `packages/components/src`, and `ui/index.ts` never carried it, so the barrel's
  `export * from './ui'` did not reach it either. It shipped all the same —
  `dist/ui/toast.d.ts` was in the published tarball — while contributing nothing to
  `dist/index.js` and nothing to the package's export surface. `ui/sonner.tsx`
  (`Toaster`) is the live implementation and is unaffected.
  
  `@radix-ui/react-toast` is dropped from `dependencies` in the same change: the
  removed file was its only importer anywhere in the repository, so it would
  otherwise have stayed a declared dependency of every install with nothing to
  resolve it.
  
  No exported name changes. A consumer who was resolving `@radix-ui/react-toast`
  through this package's dependency was relying on hoisting rather than on a
  declaration, and should declare it directly.
- f7ace0a: `@object-ui/components` no longer declares `recharts`. The dependency became
  unused when objectui#7397 deleted `src/ui/chart.tsx`, which was its only
  consumer inside this package; `@object-ui/plugin-charts` declares its own
  `recharts` and remains the single implementation (objectui#7625).
  
  **No migration.** Nothing is added to or removed from the published surface, no
  type changes, no behaviour changes. Since objectui#7397 this package publishes
  no recharts-typed export at all, so there is no supported import that reaches
  `recharts` through `@object-ui/components`.
  
  **What actually changes** is the install graph: every consumer of
  `@object-ui/components` was resolving and installing a charting library it could
  not reach. AGENTS.md section 3 constrains this package — the Atoms layer — to
  "Shadcn primitives, zero heavy 3rd-party deps", and heavy widget dependencies
  belong in `@object-ui/plugin-*`; the declaration outlived the reason it existed.
  
  - **Why `patch` and not `minor`.** This repo ships its own breaking changes as
    `minor` with the break spelled out (`scripts/check-changeset-no-major.mjs`),
    so the bump has to state which of the two this is. Nothing breaks for a
    supported consumer: the built output is byte-identical (this package's Vite
    `external` predicate is path-based and never reads `dependencies`, so no
    import graph, chunk or `.d.ts` moves), and the package exposes no recharts
    surface to import. The one consumer this can reach is someone importing
    `recharts` without declaring it and getting it hoisted out of this package's
    dependency by a FLAT `node_modules` layout (npm/yarn). That is a phantom
    dependency — undeclared, unsupported, and un-typed here since objectui#7397 —
    and it is named rather than omitted so the trade is on the record.
  - **Not a bundle-size change.** `vendor-charts` stays eagerly reachable through
    the plugins, so `check:eager-closure` is unaffected in both directions. The
    cost this removes is install-graph weight, not shipped bytes.
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
- 3c76801: `action:button`, `action:icon`, `action:group` and `action:menu` now forward the
  declared `onSuccess` block, so the post-success navigation an author writes in metadata
  actually happens on those four surfaces (objectui#5493).
  
  `onSuccess` — spec's closed strict `{ navigate, openIn }` object — became authorable on
  `ActionSchema` with the `@objectstack/spec` 17.1.0 pin bump (objectui#5328), and the
  runner has read it off the **forwarded** def since objectui#5221:
  `ActionRunner.handlePostExecution` → `readOnSuccessNavigation` → `navigateOnSuccess`,
  which hops through the app's own `navigationHandler` (a real SPA route change, immune to
  popup blocking). Between those two halves sat these four forward whitelists, which never
  carried the key. The action succeeded, the toast said so, and the declared hop silently
  did not happen — the same "shipped green while dropped one hop before the runner" class
  as `bodyExtra` (objectstack#6837), `bodyShape` (objectstack#6938) and `resultDialog`
  (objectui#3646).
  
  Reachability before this change was a function of which host rendered the action: the
  full-def-spread hosts (`DeclaredActionsBar`, `ObjectGrid.onActionDef`,
  `RelatedRecordActionsBridge`, `useNavActionDispatch`) already carried it through, so the
  same declaration hopped there and did nothing here — and on an `action:bar`, whether an
  action lands inline (`action:button`) or in the overflow (`action:menu`) is decided by
  `maxVisible`, 3 desktop / 1 mobile. The declared navigation therefore depended on
  viewport width.
  
  Pinned end to end in
  `packages/components/src/renderers/action/__tests__/action-onSuccess-forward.test.tsx`:
  one row per surface drives the real renderer through the real runner and asserts the
  `${result.*}`-interpolated url reaches `onNavigate`, with `openIn` exercised on both
  branches. Each row asserts the action executed first, so a zero-navigation reading
  cannot be a harness that did nothing.
  
  The four matching `KNOWN_GAPS` entries in `scripts/check-action-forward-parity.mjs` are
  deleted — that ledger is ratcheted, so a stale entry excusing a key that is now
  forwarded fails the gate. `element:button` is untouched and stays correct: `onSuccess`
  is not on spec's `InlineActionSchema` pick list, so that surface never owed it.
- 2c8474c: Published declaration text for the react page renderer changed: `kind:'react'` page `source` styling is now stated in the shipped `.d.ts`
  
  `dist/renderers/layout/react-page.d.ts` is in this package's npm tarball, and the
  declaration emitter reproduces that module's file-header documentation into it
  verbatim. Two things a consumer reads — on hover over `ReactKindPage` in an editor,
  or straight out of the tarball — now say something different:
  
  - The injected-scope note no longer tells authors that layout is left to "plain
    HTML + Tailwind". It says plain HTML.
  - A new paragraph states the styling contract for `kind:'react'` page `source`:
    `source` is runtime metadata, not build input. Style with inline `style` objects
    using `hsl(var(--token))` theme colors, and render overlays through `ObjectForm`
    with `formType` `"drawer"` or `"modal"` rather than a hand-rolled `fixed inset-0`
    backdrop. Do **not** author Tailwind utility classes in page `source`: the
    console's Tailwind is compiled at build time by scanning the console's own `src`
    and there is no safelist, so an authored utility class silently produces no CSS
    and no error anywhere. `os validate` reports it as
    `page-source-className-tailwind`. (ADR-0065; ADR-0080's 2026-06-30 amendment;
    see `content/docs/guide/react-pages.md`.)
  
  That is guidance an author can act on, and it contradicts what this package's
  declarations previously told them, so it is a change to the published surface
  rather than an internal edit. No runtime behaviour changed and no export moved.
  
  This entry is corrective. The text landed under objectui#5461 with a changeset that
  declared only `@object-ui/types`, on the stated grounds that the edits "do not
  project into any `.d.ts`". Rebuilding the package shows that they do — the reasoning
  and the measurement are recorded in `scripts/check-changeset-presence.mjs`'s header,
  where the next author will meet them.
- ae61ad4: The console form now renders a refusal message the producer explicitly marked
  as user-facing, instead of always substituting a generic string
  (objectui#5210).
  
  An application's hook guards could not talk to their users. When a hook refused
  a write with 403, the form replaced the server's text with
  `form.noPermissionToSave` unconditionally — the recorded objectstack#3821 fix,
  which exists because a raw refusal body puts untranslated platform diagnostics
  (`FORBIDDEN: insufficient privileges to update showcase_private_note
  pi-TgoJ4_DM55Fqz`) in front of end users. The external report behind this change
  had 11 guards whose deliberate, localized guidance — which role owns the action,
  whom to ask — never reached anyone, and named the incentive that creates:
  returning 400 instead of 403 for permission failures, degrading the status
  semantics logs, monitoring and API consumers depend on.
  
  The maintainer ruling (2026-08-19) was a producer-side opt-in rather than a
  chattier 403 branch, and the platform half shipped as objectstack#9934: a hook
  marks its refusal text with `userMessage` at throw time. This is the consumer
  half.
  
  - `@object-ui/react` gains `declaredUserMessage(err)` — the one "is this
    marked?" read. It answers the marking verbatim, from the two places the
    adapter boundary parks the envelope (the error itself, where
    `@objectstack/client` lifts it, and `details`), and `null` for everything
    else.
  - The form prefers a marked message over both its generic strings, on ANY
    status — the marking is status-agnostic; 403 is where this was reported, not
    a fence the contract draws.
  
  **Unmarked refusals are unchanged**: a 403 with no marking still shows the
  generic `form.noPermissionToSave`, and the raw text still goes to the browser
  console only. objectstack#3821's protection is preserved by construction, not
  by re-guessing which 403 bodies are presentable — the mark and the marked text
  are one field, so no boundary that rewraps or substitutes `message` can promote
  platform prose into the user-facing channel, and platform code never sets it.
- fe76ece: The typings both packages publish now carry an explicit extension on every relative specifier, so a consumer on `moduleResolution: nodenext` can follow them.
  
  `vite-plugin-dts` emits one declaration file per source file, and TypeScript
  copies a module specifier into the declaration verbatim. `export * from './ui'`
  therefore shipped extensionless in `dist/index.d.ts` — 21 such re-exports in
  `@object-ui/components`, 7 in `@object-ui/layout`, 128 across the two emitted
  trees. Node16/NodeNext resolution does not extension-search a relative
  specifier, so the compiler could follow none of the hops and every symbol they
  carried read as absent from the package:
  
  ```
  error TS2305: Module '"@object-ui/components"' has no exported member 'Badge'.
  ```
  
  Measured on `@object-ui/app-shell`, the largest consumer and the one that pulls
  in both packages: 880 TS2305 across 162 files (864 from `components`, 16 from
  `layout`), plus 215 TS7006 as fallout from the imports that stopped resolving.
  On `@object-ui/fields`, 178 TS2305 and 57 TS7006. Both are zero now.
  
  The emitted `.js` never had the defect — rolldown resolves the same specifier
  away — which is why `pnpm check:esm-specifiers`, whose verdict is about
  specifier-preserving `.js` builds, correctly never scanned either package. The
  fix is therefore in the declaration EMIT (`scripts/vite-dts-explicit-extensions.ts`,
  shared by both `vite.config.ts` files), not in the sources: the same source line
  produces a clean `.js` and a broken `.d.ts`, so no source edit can express the
  difference. The rewriter resolves each specifier against the source tree the
  output mirrors — a file hop becomes `./x.js`, a directory hop `./x/index.js` —
  throws on anything it cannot resolve, and after the build re-parses the emitted
  declarations to assert every relative specifier both carries an extension and
  names a file the build really emitted.
  
  `packages/fields` takes the `nodenext` pin as a result — the same two lines
  `packages/react` has carried since objectui#4538 — so the property is enforced by
  the compiler on the consumer side rather than by review. `packages/app-shell`
  does not: it type-checks clean without the pin and still shows 23 errors with it,
  none of them from these two packages. That residue is filed separately.
- 58770f3: **Behaviour change:** the eighteen renderers whose host element is a form
  control no longer forward their whole prop bag to it. They route it through a
  form-control DOM declaration — the same `pickDomProps` mechanism `grid`, `flex`,
  `stack`, `container` and `text` were converged on — so an authored schema key
  becomes an HTML attribute only if the contract declares it one (objectui#5632,
  the `BARE_SPREAD_MINUS_NAME` slice of objectui#5574).
  
  The eighteen: `action:button`, `action:icon`, `ui:button`, `ui:checkbox`,
  `ui:combobox`, `ui:date-picker`, `ui:email`, `ui:file-upload`, `ui:input`,
  `ui:input-otp`, `ui:password`, `ui:radio-group`, `ui:sidebar-menu-button`,
  `ui:slider`, `ui:sonner`, `ui:switch`, `ui:textarea`, `ui:toggle`.
  
  What this stops reaching the DOM: the renderer's own declared props, consumed
  off `schema` to render the control AND spread onto the element a second time as
  attributes HTML does not define, plus the authored node's SDUI metadata and the
  flattened `props` container. Measured across `examples/schema-catalog`, rendered
  through the real `SchemaRenderer`: 284 illegitimate attributes over 287
  form-control nodes — `button[label]` 140, `button[icon]` 25, `input[inputtype]`
  23, `input[label]` 19, `toggle[label]` 14, `radio-group[options]` 8,
  `date-picker[placeholder]` 7, `file-upload[label]` 7, `file-upload[buttontext]`
  7, `checkbox[label]` 6, `textarea[label]` 6, `toggle[arialabel]` 6,
  `switch[label]` 4, `password[label]` 3, `email[label]` 2, `radio-group[direction]`
  2, and six singletons. The same probe reads 0 after, with `grid`'s 26 nodes at 0
  both times as the control and an unchanged node census across the two runs.
  
  `name` and `disabled` are DELIBERATELY still forwarded. Both are legal on a form
  control and neither was ever part of the leak — the ledgered shape for this
  group is thirteen attributes, not fourteen, precisely because HTML defines
  `name` on these hosts. The whitelist this group uses is therefore the shared
  SDUI one PLUS those two, not the bare `toDomProps` the container renderers take:
  that would have stripped the form-serialization key off every control and
  silently re-enabled every disabled one, and no gate in the repo would have gone
  red for it.
  
  Nothing an author writes renders differently: every leaked key was already being
  read off `schema` and applied. `id`, `role`, `tabIndex`, `className`, `style`,
  event handlers and the open `data-*` / `aria-*` families are unchanged.
  
  Anything that read one of the leaked attributes off the DOM — a CSS attribute
  selector such as `[label="Save"]`, or a test asserting `inputtype` on a rendered
  `ui:input` — must read the schema instead. No `@object-ui` code did; this is
  called out because the attributes were externally visible while they lasted.
- 485f096: The form renderer now keeps a `defaultValues` reset off `onChange` and off the
  `form_change` `onAction` for **every** caller — including one that memoizes the
  callback (objectui#5235).
  
  "A record landing is not a user edit" was already this file's documented,
  pinned behaviour, but two of the three channels delivered it by accident of
  React's effect ordering: every layout DESTROY runs before any layout CREATE, so
  a caller passing a fresh callback each render had its value subscription torn
  down before the reset and re-established after. The guarantee was therefore
  delivered by the callback's *identity changing*. Wrap the same callback in
  `React.useCallback` — taught everywhere as a semantically neutral performance
  optimization — and the identity stays put, the effect never re-runs, the
  subscription survives the reset, and the whole loaded record comes back to the
  host as if the user had typed it: the false "the user edited this" signal
  objectui#2968 was filed about, in a form no type, doc or call site warned about.
  
  The reset now states what those two channels report, the way `onDirtyChange`
  already did (it computes its payload against the freshly installed baseline and
  calls the host outright). Callers passing inline arrows see byte-identical
  behaviour; callers who memoize stop receiving a phantom edit.
  
  Not a contract change: whether a value channel *should* report a programmatic
  reset stays open in objectui#5235. This only removes the answer's dependence on
  caller identity.
- b655a9d: The `ui:grid` renderer now forwards to the DOM by whitelist, so schema keys no longer
  land on the rendered `<div>` as invalid HTML attributes (objectui#4787).
  
  `grid.tsx` ended in a bare `{...gridProps}` spread that removed only `data-obj-*` and
  `style`, so everything else `SchemaRenderer` hands a registered component reached the
  element. Measured on a canary node, eight attributes leaked:
  `columns="4"`, `gap="4"`, `mdcolumns="2"`, `smcolumns="2"`, `name="grid_node"`,
  `props="[object Object]"`, `colorvariant="x"` (the flattened `props` container) and an
  unknown authored `zzcanary="leak"`. A responsive `columns` object rendered as
  `columns="[object Object]"`. Layout was unaffected, so every catalog grid example
  rendered with them — the reason this went unnoticed.
  
  The spread now goes through `toDomProps` from `@object-ui/core`, the same whitelist
  objectui#3291 established in `packages/fields` and objectui#4425 phase 2 promoted to the
  SDUI widget contract. Keys that are *declared* DOM-safe survive — `id`, `className`,
  `role`, `tabIndex`, plus the open `data-*` and `aria-*` families, which is how the
  designer's `data-obj-id` / `data-obj-type` still arrive — and `style` continues to be
  forwarded by name. Nothing an author can add to a grid node reaches the DOM implicitly
  any more, including keys `GridSchema` does not have yet; enumerating today's keys to
  strip would have re-rotted on the next schema addition.
  
  No authored input changes and no layout changes: the grid's own vocabulary was always
  read off `schema`, never off these props.
- d7bd274: **Behaviour change:** the `flex`, `stack`, `container` and `text` renderers no
  longer forward their whole prop bag to the host element. They route it through
  `toDomProps` — the same whitelist `grid` was converged on — so an authored
  schema key becomes an HTML attribute only if the SDUI DOM contract declares it
  one (objectui#5574).
  
  What this stops reaching the DOM: the renderer's own declared props, which were
  consumed off `schema` to build the class list AND spread onto the element a
  second time as attributes HTML does not define. Measured across
  `examples/schema-catalog`, rendered through the real `SchemaRenderer`: 1194
  illegitimate attributes over 1141 nodes — `text[content]` 522, `flex[align]`
  198, `flex[gap]` 193, `stack[gap]` 153, `flex[justify]` 98, `container[padding]`
  14, `container[maxwidth]` 6, `flex[direction]` 5, `stack[align]` 4,
  `text[value]` 1. The same probe reads 0 after, with `grid`'s 26 nodes at 0 both
  times as the control.
  
  Nothing an author writes renders differently: every leaked key was already being
  read off `schema` and applied as a class, so the markup loses attributes that
  never had meaning and keeps the styling that did. `id`, `role`, `tabIndex`,
  `className`, `style`, event handlers and the open `data-*` / `aria-*` families
  are unchanged — including `data-obj-id` / `data-obj-type`, which now arrive
  through the `data-*` family rather than by hand.
  
  Anything that read one of the leaked attributes off the DOM — a CSS attribute
  selector such as `[gap="4"]`, or a test asserting `align` on a rendered `flex` —
  must read the schema or the class instead. No `@object-ui` code did; this is
  called out because the attributes were externally visible while they lasted.
- 9d9040d: `ui:dropdown-menu` now resolves a menu item's authored `icon` to a glyph instead of drawing the name as raw text.
  
  Both arms of the item renderer — `DropdownMenuItem` and `DropdownMenuSubTrigger` — rendered `icon` straight into a text node, so an item authored as `{ "label": "Copy", "icon": "copy" }` drew the literal word `copy` beside its label. The name is now resolved through `resolveIcon`, the same lucide **record** surface `ui:button` and the `action:*` family already resolve against: a live name draws its glyph, and an unknown or retired spelling draws nothing rather than degrading to a wrong glyph.
  
  The `components-overlay-dropdown-menu/with-icons` catalog fixture declared the retired lucide spelling `edit`, which is absent from lucide's runtime `icons` record and would therefore have drawn no glyph; it now declares `square-pen`, the live key the retired export resolves to by identity.
- ab92940: Stop the record header title from collapsing when the action tail is wide
  
  The `page:header` record header laid the title column and the action tail out
  in a `flex-nowrap` row. The tail is `shrink-0`, so the title column — the only
  flexible item — absorbed the entire width deficit. On a record carrying three
  labelled `record_header` actions plus the `⋯` and `⟳` chrome, a 799px viewport
  left the title column 29.5px of a 687px header and the `h1` rendered as a
  single character and an ellipsis, while the breadcrumb above it still showed
  the full record name.
  
  The title column now carries a 12rem floor and the header may wrap at `sm` and
  up, so a tail that cannot fit alongside a readable title drops to its own line
  instead of starving it. Below `sm` the header is already a column and is
  unchanged. Headers whose tail already fits keep their single-line layout.
- 0b1326d: Documentation no longer teaches the "JSX/HTML + Tailwind" framing for a page's
  `source`, which ADR-0080's own 2026-06-30 header amendment (under ADR-0065,
  Accepted) retracted. objectui#5461 corrected three sites; a multiline census
  found eight more, in three spellings a line-oriented grep could not see.
  
  A page's `source` is *runtime metadata*. The console's Tailwind is compiled at
  build time by scanning the console's own `src`, and there is no safelist, so it
  never sees your page: an authored utility class produces CSS only by coincidence
  (when objectui already ships that exact class) and otherwise produces nothing,
  with no error anywhere. That is the ADR-0065 "works only by coincidence" failure
  mode, and it is how a modal's `bg-black/50` backdrop reached production fully
  transparent. `os validate` reports it as `page-source-className-tailwind`, a
  warning on kinds `html`, `react` and `jsx`, shipped in `@objectstack/lint@11.5.0`.
  
  The tiers themselves are unchanged and every load-bearing claim survives —
  parse-never-execute, the untrusted-author safety argument for `html`, and the
  deprecated `'jsx'` alias. Only the styling primitive is corrected, to the wording
  `content/docs/guide/react-pages.md` §Styling already uses:
  
  | `kind` | Style with |
  |---|---|
  | `"html"` | The blocks' own structured props (`` `<flex direction gap>` ``, `` `<grid columns>` ``) plus a JSON `style` object. |
  | `"react"` | Inline `style` objects. |
  
  Colors on both tiers come from the theme as `hsl(var(--token))`.
  
  Why each package has an entry — each was measured against its built artefact, not
  assumed:
  
  - **`@object-ui/react-runtime`**: `README.md` is published to npm (npm includes
    `README.md` in the tarball regardless of `files`). Its "no sandbox" callout is
    the paragraph that routes untrusted-author work to the `html` tier, and it
    carried the retracted framing line-wrapped across `:17-18`. It also gains the
    §Styling section it was missing — the absence is why the framing survived here.
  - **`@object-ui/sdui-parser`**: the corrected header of `src/types.ts` projects
    verbatim into the published `dist/types.d.ts`.
  - **`@object-ui/components`**: the corrected header of
    `src/renderers/basic/html-elements.tsx` projects verbatim into the published
    `dist/renderers/basic/html-elements.d.ts`. The `kind === 'html'` dispatch-arm
    comment in `src/renderers/layout/page.tsx` does **not** project (it is inside a
    function body) and is included here only because the same package already owes
    an entry.
  
  No behaviour change: this is prose only. `CHANGELOG.md` occurrences are
  deliberately untouched — immutable release history.
- fa140b8: `element:record_picker`'s `emptyText` now resolves the inline per-locale map its
  contract has admitted since rc.6, and its published declaration says so
  (objectui#5590).
  
  `@objectstack/spec` widened this key to the `I18nLabel` union
  (`string | Record< string, string >`) at 17.0.0-rc.6, and the installed 17.0.0 GA
  still carries it — measured, not assumed:
  `ElementRecordPickerPropsSchema.safeParse({ object: 'account', emptyText: { en, 'zh-CN' } })`
  succeeds. The renderer honoured only the string arm, handing the map straight to a
  text node. React refuses a plain object in a child position rather than stringifying
  it, so an author writing the map form the contract accepts did not get a mis-rendered
  empty state — the whole picker subtree threw
  `Objects are not valid as a React child (found: object with keys {en, zh-CN})`.
  
  The read site now resolves through `pickLocalized`, the objectui-side helper the
  sibling text-node sites already read through (`element:text.content`,
  `element:button.label`, `page:card.title`), which spells a miss as `''` rather than
  the spec resolver's `undefined`. The default is applied before resolution, so
  `emptyText` absent still means "No records" and an authored empty string still
  renders empty.
  
  The `ComponentMeta` entry, which held a single `'string'` arm precisely because the
  renderer dropped the other one, now declares `['string', 'object']`. That narrowing
  was correct for exactly as long as it was true: with the map arm reaching the screen
  resolved, withholding it would be the false declaration in the other direction — the
  manifest gate reporting `type-mismatch` on a legal write the same input's own
  `description` teaches the author to make. The `apps/console` specimen that pinned the
  narrow arm named this release condition in its own words ("keeps its single `'string'`
  arm until the render site catches up") and is flipped here, keeping its controls.
  
  Three comments in the renderer deferred this gap to objectui#4163, which closed as
  completed on 2026-08-15 while the gap was still open; the file now carries no
  reference to it. The `ComponentInput.type` doc in `@object-ui/types` cited this very
  key as its worked example of an arm deliberately withheld, and is corrected in the
  same change so the example stays true.
- 71cba28: `element:record_picker`'s `label` is now programmatically associated with its
  `SelectTrigger` combobox — fixing a case where the caption the block's own
  registration prose advertised (`'Caption rendered above the picker, in a
  <label> element'`) named nothing at all (objectui#5771).
  
  Pre-fix, the render body was `{label && <label className="…">{label}</label>}`
  against a `SelectTrigger` with no `id`: neither end of the association carried
  any wiring. That is a step worse than the sibling gap objectui#5735 closed on
  `element:text_input` — there the `label` half was already correctly wired and
  only `description` was adrift; here the label element had no `htmlFor` and the
  trigger had no `id`, so the picker had no accessible name unless a
  `placeholder` happened to render text into the trigger's content.
  
  The fix follows the shape objectui#3341 already ruled on for the same defect
  class (`InlineCreateRelated`'s `<label>`/`<Input>` pair) and objectui#5735
  just landed on the complement block: `htmlFor`/`id` against the
  `SelectTrigger` — a `button` with `role="combobox"`, and therefore labelable,
  so no `aria-labelledby` is needed (Radix sets none on the trigger) — wired
  **when `schema.id` exists**, matching `element:text_input`'s precedent rather
  than an always-on `useId()` fallback. Only the author can supply `schema.id`,
  so a picker authored without one keeps its pre-fix, unassociated caption text
  exactly as before; nothing about this change mints an id the author did not
  provide. The `<label>` element itself is also swapped for the shared `Label`
  (`@radix-ui/react-label`) primitive `element:text_input` already uses for the
  same wiring, rather than a bare `<label>` with a `htmlFor` bolted on.
  
  The registration prose for `label` is corrected to describe what the code now
  does (tied to the control by `htmlFor` when the node carries an `id`) instead
  of a caption association the renderer never performed.
- 190fbd0: `element:record_picker`'s `label` and `placeholder` now resolve the inline
  per-locale map their contract admits, and their published declarations say so
  (objectui#5637).
  
  These are the two remaining keys of the trio objectui#5590 fixed one of. All
  three members of `ElementRecordPickerPropsSchema` are the `I18nLabel` union
  (`string | Record< string, string >`) — measured on the installed
  `@objectstack/spec` 17.1.0 pin, where each resolves to
  `optional -> union -> string | record` and
  `safeParse({ object: 'account', <key>: { en, 'zh-CN' } })` succeeds. The
  renderer honoured only the string arm on both, and the two keys failed in two
  different ways:
  
  - `placeholder` was read raw and handed to `SelectValue`. React refuses a plain
    object in that position rather than stringifying it, so the whole picker
    subtree threw
    `Objects are not valid as a React child (found: object with keys {en, zh-CN})`
    — the same harm objectui#5590 removed from `emptyText`.
  - `label` went through the file's local `toText`, whose object branch ends
    `String(o.label ?? o.name ?? o.title ?? o.en ?? '')`. Reaching `o.en`
    unconditionally is an English pick wearing locale resolution's clothes, so a
    `zh-CN` viewer was shown the English entry — and a map that simply omits `en`
    resolved to `''`, which the `{label && …}` render site drops, making the
    picker's label element DISAPPEAR with nothing thrown and nothing logged.
  
  Both keys now resolve at their own read site through `pickLocalized`, the same
  helper the settled `emptyText` shape uses. `toText` is deliberately unchanged:
  it is shared with the row values (`toText(row?.[labelField])`), which are record
  field values rather than `I18nLabel`, so teaching it locale resolution would
  have changed a second, unrelated call site. The `placeholder` default is applied
  before resolution, so an absent key still means "Select a record…" and an
  authored empty string still renders empty.
  
  The two `ComponentMeta` entries, which held a single `'string'` arm precisely
  because the renderer dropped the other one, now declare `['string', 'object']`
  — declared in the change that makes the arm render, never before, which is the
  order `ComponentInput.type` prescribes and the order `emptyText` set.
  
  KNOWN GAP, unchanged by this release: the sibling `label` read sites in
  `renderers/layout/containers.tsx` compose
  `translateLabel(pickLocalized(…), language)`, and that second helper is not
  applied here — `translateLabel` and its `KNOWN_LABEL_DICT` are module-private to
  that file. Only the locale-map resolution lands in this change; a plain-English
  string `label` is still rendered verbatim in every language, exactly as before.
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
- 42887e0: Repair five retired lucide icon spellings that reach a record-reading resolver, and pin
  the names against the runtime `icons` record so the next lucide bump goes red instead of
  silently blanking a glyph (objectui#5622).
  
  lucide retires a spelling by dropping it from its runtime `icons` record while KEEPING it
  as a deprecated named export. A retired name therefore still imports, still type-checks,
  and still renders wherever it is used as a COMPONENT — and resolves to `null` wherever it
  is used as a STRING, because every string lookup here reads that record. Nothing goes red
  either way. Measured against the installed `lucide-react@1.31.0` (1767 record entries) at
  implementation time.
  
  What a user sees change:
  
  - `DetailView`'s mobile Edit action (`icon: 'edit'` → `'square-pen'`) draws its icon
    again. Its items become an `action:bar` schema whose renderers resolve `icon` through
    `renderers/action/resolve-icon.ts`, so the touch-breakpoint edit affordance had been
    drawing a label with nothing beside it. `Edit === SquarePen`, so the glyph is unchanged.
  - The `ui:icon` renderer's own declared default (`'smile'` → `'face-slightly-smiling'`, in
    both the registration `icon` and the `name` input's `defaultValue`) resolves again: the
    designer palette entry's glyph was blank, and an `icon` dropped from that palette
    rendered nothing plus a `console.warn`. `Smile === FaceSlightlySmiling`, so the palette
    looks exactly as it did.
  - `plugin-list`'s `ViewSwitcher` moves `Grid` → `Grid3x3`, `BarChart3` → `ChartColumn`
    (both identical objects, no visual change) and `GanttChartSquare` → `ChartGantt`. The
    gantt one IS a glyph change: it matches the spelling the sibling `plugin-view` switcher
    landed in objectui#5586, so one view type no longer draws two different icons depending
    on which switcher is on screen.
  
  Four resolvability pins are added — in `plugin-detail`, `plugin-list`, `components` and
  alongside the `DeclaredActionsBar` fixtures. Each asserts `icons`-record MEMBERSHIP rather
  than resolvability, because every retired spelling repaired here is the SAME component
  object as its replacement (`Edit === SquarePen`, `Smile === FaceSlightlySmiling`,
  `Grid === Grid3x3`, `BarChart3 === ChartColumn`, `CheckCircle === CircleCheckBig`,
  `XCircle === CircleX` are all true): a pin that rendered the glyph, or reached for the
  export, would pass on the broken name. That is the blindness that let this ship.
- 5a07e67: The `[page:header]` sparse-predicate warning no longer blames `hidden: true` — it
  states what it actually measured (objectui#5399).
  
  When an action's `visible` predicate references a `record.<key>` the bound payload
  does not carry, the warner names the missing key and then explained the cause:
  
  > Hidden (hidden: true) fields are stripped from detail payloads server-side, so a
  > predicate gating on one may evaluate to a hide-by-default verdict.
  
  That cause is false, and it names a mechanism this repo does not own. `hidden` is a
  UI concern — the framework spec describes it as "Hidden from default UI"
  (`packages/spec/src/data/field.zod.ts`) — not a projection rule. Confirmed against
  the framework checkout rather than taken on trust: ObjectQL's own strip for the
  `__search` companion documents that the `hidden` / `readonly` / `system` markers are
  "None of them is a PROJECTION rule", which is precisely why a dedicated strip rule
  had to be written for that one column; drivers answer a query with no `fields` using
  `SELECT *`; and `metadata-protocol` enumerates what the read path does drop —
  `internal: true` columns and the `__search` companion, and nothing else. The only two
  read-side uses of `field.hidden` in the framework are auto-view/auto-form column
  generation and companion-source eligibility, neither of which removes a key from a
  record body.
  
  So an author who read this diagnostic went hunting for a `hidden` flag they would
  either not find, or find on a field the payload demonstrably still returns — while
  the real source of the sparseness (a projected or partial read) went unexamined. A
  confidently wrong cause in a diagnostic is worse than no cause, because it is
  actionable in the wrong direction.
  
  The replacement states the fact this surface can actually see and the consequence it
  does own: the page bound a payload without those keys, a projected or partial read
  will not carry them, and the predicate therefore fails closed and hides the action.
  The measured half of the message — action name, missing fields, predicate source —
  is unchanged, and nothing about what triggers the warning changed.
  
  Message text only. The same false claim also sat in this warner's own doc comments
  and in the comments of the test that pins the message; both are corrected here, and
  the docstring now carries an explicit note against re-attributing the cause to
  `hidden: true`. No other call site was swept.
- 45d8288: fix(components): the `page` wrapper now filters its DOM attributes through the shared whitelist instead of a hand-maintained list
  
  `PageRenderer` stripped PageSchema's descriptor keys with a hand-maintained
  destructure list and spread the remainder onto its wrapper `<div>`. Whenever
  that list fell behind the schema, an authored key was not dropped — it was
  forwarded, and React stringifies unknown attributes in silence, so an authored
  `actions: [{…}, {…}]` reached the DOM as `actions="[object Object],[object
  Object]"`.
  
  The renderer now calls `toDomProps` from `@object-ui/core` — the same
  whitelist every converged SDUI widget already uses (objectui#4425). Twenty-five
  attributes measured leaking off the wrapper stop being emitted, including the
  `context` bag the console injects into every page it renders. Everything the
  wrapper legitimately carries is unchanged: `class`, `style`, `id`, `role`,
  `tabindex`, `data-page-type`, `data-obj-id`, `data-obj-type`, and the open
  `data-*` / `aria-*` families.
  
  This changes no schema's accept/reject behaviour — `BaseSchema.passthrough()`
  is untouched — and adds no read point for any previously leaking key.
- 27308c5: `element:text_input` now ties its authored `description` to the field with
  `aria-describedby`, so assistive tech announces the helper text as the input's
  accessible description instead of leaving it as an unassociated paragraph
  beside the field (objectui#5735).
  
  Before this the paragraph and the input were siblings with no programmatic
  relationship: a screen reader moving to the field announced the label and the
  value and never the helper text. The `label` half of the same block was already
  wired (`htmlFor` against the input's `id`), which is what made the gap specific
  to `description` rather than a general absence of a11y wiring — and the
  identical key authored on a field INSIDE `renderers/form/form.tsx` has been
  announced all along, so one authoring key behaved two ways depending on which
  container the author reached for. It no longer does.
  
  The paragraph's id is minted per instance with `React.useId()` — the same source
  `FormItem` mints the form renderer's description id from — and deliberately not
  derived from `schema.id`. The two associations in this block need ids on
  opposite ends: `htmlFor` names the INPUT, whose id only the author can supply,
  so that wiring still holds only when they gave the node an `id`; `aria-describedby`
  names the PARAGRAPH, which the renderer owns, so the description association
  holds unconditionally and cannot collide when two nodes share an authored id.
  The attribute is emitted only when a paragraph is actually rendered — an absent
  or empty `description` leaves the input with no `aria-describedby` rather than a
  dangling reference.
  
  The key's published `ComponentInput` description, which documented this gap in
  so many words, is rewritten in the same change. Its closing advice — prefer
  `label` for an instruction a user must not miss — is kept rather than deleted,
  on a new basis: a description is announced after the field's name and screen
  readers gate description text behind verbosity settings a user can turn down, so
  it remains the half of the announcement most likely to go unheard.
- 8689166: `element:text_input` now DECLARES the inline-translation arm on `label`,
  `placeholder` and `description`, so the manifest gate stops reporting
  `type-mismatch` on a locale map its own renderer has always resolved correctly
  (objectui#5717).
  
  `@objectstack/spec` types all three keys as the `I18nLabel` union
  (`string | Record<string, string>`) — measured on the installed 17.1.0 pin, per
  key, from the schema's own verdicts — and `text-input.tsx` has resolved all
  three through `pickLocalized` at their read sites since it was written. Only the
  `ComponentMeta` entries stayed at a single `'string'` arm. Driven through the
  same `manifestFromConfigs` + `validateTree` pair the JSX-page compiler and the
  save gate use, an author writing `{ en: 'Owner', 'zh-CN': '负责人' }` got three
  warnings on a write that renders correctly in the viewer's language:
  
  ```
  <element:text_input> prop "label" expected a string
  <element:text_input> prop "placeholder" expected a string
  <element:text_input> prop "description" expected a string
  ```
  
  That is the INVERSE of the direction the rest of this family moved in.
  `element:record_picker.emptyText` (objectui#5590) and that block's `label` /
  `placeholder` (objectui#5637) each held one arm for exactly as long as their
  render site dropped the map, and gained the object arm in the change that taught
  the render site to resolve it — never declare an arm the renderer drops. Here
  the render site was never behind, so the same rule's other half applies:
  withholding an arm the renderer resolves is the false declaration in the other
  direction, and noise on legal writes trains authors (AI authors included) to
  dismiss the `unknown-prop` and `type-mismatch` reports that are real.
  
  Per-key, not blanket. `defaultValue` on this same block keeps `['string',
  'number']` — its contract has no object arm, measured the same way — and the
  console specimen file keeps asserting that an `I18N_MAP` there still reports
  `type-mismatch`. That control is what makes this a widening of three keys rather
  than of a component.
  
  All three keys also gain a `description` written from what the renderer does
  rather than from restating the contract: where each one lands in the rendered
  output (a `<label>` above the field, the native `placeholder` attribute inside
  it, a `<p>` below it), when each is omitted, and the locale fallback chain the
  read site follows. No renderer behaviour changed.
- 9101be5: `ui:breadcrumb` and `ui:command` now resolve a child item's authored `icon` to a glyph instead of drawing nothing.
  
  `BreadcrumbItem.icon` and `CommandItem.icon` are declared keys of the protocol — present in `@object-ui/types`, mirrored in the Zod schemas, and documented on both components' pages — and neither renderer referenced `icon` at all. The catalog fixture literally named `components-data-display-breadcrumb/with-icons` rendered no icons, and the nine names the two `command` fixtures declare all drew nothing. Both names are now resolved through `resolveIcon`, the same lucide **record** surface `ui:button`, `action:*`, `ui:dropdown-menu` and `ui:context-menu` resolve against: a live name draws its glyph, and an unknown or retired spelling draws nothing rather than degrading to a wrong glyph.
  
  `breadcrumb` resolves once per item and draws the glyph above the page/link split, so the last crumb (rendered as the current page) carries it as well as the linked crumbs before it.
  
  Two fixtures declared retired lucide spellings that are absent from the runtime `icons` record and would therefore have drawn nothing: `components-data-display-breadcrumb/with-icons` declared `layout`, now `panels-top-left`, and `components-form-command/command-menu` declared `smile`, now `face-slightly-smiling` — in both cases the live key the retired export resolves to by identity.
  
  `ui:button-group` is NOT included: its fixtures author `icon` on `buttons[]`, but `ButtonGroupButton` declares no such key in `@object-ui/types` or its Zod mirror, so wiring it would first mean widening the published item contract. Routed for a decision rather than chosen (objectui#5931).
- 57f9b07: `ui:text` now honours `TextSchema.variant` and `TextSchema.align`
  
  The nine published variants (`h1`-`h6`, `body`, `caption`, `overline`) each map to
  a distinct typographic class, and `h1`-`h6` render the heading element they name;
  the four published alignments (`left`, `center`, `right`, `justify`) reach the DOM
  as their Tailwind class. The registration's `inputs` list declares both keys, so
  the JSX-page prop whitelist stops reporting `unknown-prop` for them.
  
  The published enum is unchanged — the renderer catches up to it, and a spelling
  outside the enum is still refused by `safeValidateSchema` rather than quietly
  ignored. Behaviour note: a document that already authored `variant: 'h1'` and saw
  no heading will now see one. That is the declared behaviour arriving. A node that
  never authored `variant` renders exactly as before.
- Updated dependencies [64dae8e]
- Updated dependencies [b06e374]
- Updated dependencies [06a8af5]
- Updated dependencies [6a91586]
- Updated dependencies [a04d7c6]
- Updated dependencies [9801765]
- Updated dependencies [460575f]
- Updated dependencies [594704f]
- Updated dependencies [d3995fe]
- Updated dependencies [1b1d772]
- Updated dependencies [d88e20f]
- Updated dependencies [2d7304d]
- Updated dependencies [636b236]
- Updated dependencies [64d624d]
- Updated dependencies [053fdc8]
- Updated dependencies [41b7ce3]
- Updated dependencies [d2fb6ef]
- Updated dependencies [490d9a9]
- Updated dependencies [fc62bb4]
- Updated dependencies [41df893]
- Updated dependencies [00f3eb5]
- Updated dependencies [1ec291c]
- Updated dependencies [453dbaa]
- Updated dependencies [95f8704]
- Updated dependencies [69a2163]
- Updated dependencies [24e027e]
- Updated dependencies [2c3cd1b]
- Updated dependencies [90665e0]
- Updated dependencies [8d3a529]
- Updated dependencies [5ac2e2c]
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
- Updated dependencies [5fa06c4]
- Updated dependencies [52a43de]
- Updated dependencies [e4559d1]
- Updated dependencies [2c71482]
- Updated dependencies [a26b9e4]
- Updated dependencies [5ef9c4f]
- Updated dependencies [46f0bb4]
- Updated dependencies [6f81384]
- Updated dependencies [22ba927]
- Updated dependencies [5d3a2d1]
- Updated dependencies [8f1d995]
- Updated dependencies [b362c1b]
- Updated dependencies [dddb942]
- Updated dependencies [00c665e]
- Updated dependencies [29754cf]
- Updated dependencies [3c2b6f7]
- Updated dependencies [b84dc18]
- Updated dependencies [ac8abb0]
- Updated dependencies [9d86e1d]
- Updated dependencies [99a3c2d]
- Updated dependencies [5961030]
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
- Updated dependencies [4ca30d0]
- Updated dependencies [7a5da14]
- Updated dependencies [0db4fb3]
- Updated dependencies [fff9645]
- Updated dependencies [9c3b7ce]
- Updated dependencies [4703651]
- Updated dependencies [2c1c967]
- Updated dependencies [4d5f9b4]
- Updated dependencies [d6ceb8d]
- Updated dependencies [dc4365c]
- Updated dependencies [e321d52]
- Updated dependencies [969ba84]
- Updated dependencies [7977ff9]
- Updated dependencies [3beef6d]
- Updated dependencies [46b9bc9]
- Updated dependencies [dbd5194]
- Updated dependencies [d47de51]
- Updated dependencies [3fe6463]
- Updated dependencies [b392674]
- Updated dependencies [4f3a1e2]
- Updated dependencies [31ab372]
- Updated dependencies [26896c6]
- Updated dependencies [67fc3b0]
- Updated dependencies [33a3b3c]
- Updated dependencies [b87f15b]
- Updated dependencies [045d20b]
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
- Updated dependencies [446d93d]
- Updated dependencies [ecd9cb2]
- Updated dependencies [98d4108]
- Updated dependencies [0e3b3be]
- Updated dependencies [220c18d]
- Updated dependencies [4388f71]
- Updated dependencies [c93b4d5]
- Updated dependencies [c1fe272]
- Updated dependencies [8ad218d]
- Updated dependencies [5f78953]
- Updated dependencies [639114c]
- Updated dependencies [639114c]
- Updated dependencies [1490691]
- Updated dependencies [1f31d3a]
- Updated dependencies [d8ec8d6]
- Updated dependencies [351eb31]
- Updated dependencies [866cd1d]
- Updated dependencies [20c04b2]
- Updated dependencies [01c9023]
- Updated dependencies [48c19bd]
- Updated dependencies [a6d8b8d]
- Updated dependencies [b652514]
- Updated dependencies [adbda1b]
- Updated dependencies [8952395]
- Updated dependencies [e8c553b]
- Updated dependencies [2e32ed4]
- Updated dependencies [7c3df8f]
- Updated dependencies [a4514e8]
- Updated dependencies [e75f4c9]
- Updated dependencies [19f1639]
- Updated dependencies [47547d0]
- Updated dependencies [858cd72]
- Updated dependencies [554f2b6]
- Updated dependencies [669d71b]
- Updated dependencies [ed27d7c]
- Updated dependencies [52c8cf7]
- Updated dependencies [52c8cf7]
- Updated dependencies [3399704]
- Updated dependencies [81a2eb1]
- Updated dependencies [20cb8db]
- Updated dependencies [00d2fa6]
- Updated dependencies [c6198c2]
- Updated dependencies [51eb515]
- Updated dependencies [c354ce5]
- Updated dependencies [8fe8e5c]
- Updated dependencies [2a5bf45]
- Updated dependencies [9587fc9]
- Updated dependencies [e62c44e]
- Updated dependencies [5d0876c]
- Updated dependencies [b041b9c]
- Updated dependencies [ce2aaef]
- Updated dependencies [2ce2612]
- Updated dependencies [bc640ec]
- Updated dependencies [3e377c9]
- Updated dependencies [a3eb5d0]
- Updated dependencies [4ce14f1]
- Updated dependencies [2af1fa7]
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
- Updated dependencies [2fcefb9]
- Updated dependencies [77f846a]
- Updated dependencies [bc5870c]
- Updated dependencies [b55a346]
- Updated dependencies [065bba7]
- Updated dependencies [100547e]
- Updated dependencies [3a58149]
- Updated dependencies [6d1c155]
- Updated dependencies [d7573b3]
- Updated dependencies [bf3edfe]
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
- Updated dependencies [8ebd57f]
- Updated dependencies [c40f3b8]
- Updated dependencies [199d31b]
- Updated dependencies [3e01cb5]
- Updated dependencies [7138bc1]
- Updated dependencies [cef27e2]
- Updated dependencies [4e8622b]
- Updated dependencies [dffd752]
- Updated dependencies [105f3c5]
- Updated dependencies [3ccd9e8]
- Updated dependencies [8d58f46]
- Updated dependencies [689b979]
- Updated dependencies [e546222]
- Updated dependencies [fd13f52]
- Updated dependencies [98c3a74]
- Updated dependencies [ebce5a3]
- Updated dependencies [20e317c]
- Updated dependencies [0fce2ef]
- Updated dependencies [9850c6e]
- Updated dependencies [de570cc]
- Updated dependencies [b2ea297]
- Updated dependencies [5b5a5c3]
- Updated dependencies [a691c0b]
- Updated dependencies [0b1326d]
- Updated dependencies [1e66879]
- Updated dependencies [c5200f0]
- Updated dependencies [af3861f]
- Updated dependencies [515f171]
- Updated dependencies [4f14ad7]
- Updated dependencies [258d264]
- Updated dependencies [cac64b3]
- Updated dependencies [c00bf28]
- Updated dependencies [f2158ec]
- Updated dependencies [fd8dace]
- Updated dependencies [bf28341]
- Updated dependencies [78cbdb5]
- Updated dependencies [b7543a9]
- Updated dependencies [6c6cee7]
- Updated dependencies [83fe6e7]
- Updated dependencies [d1ab06f]
- Updated dependencies [38a9568]
- Updated dependencies [f90b8fb]
- Updated dependencies [305205a]
- Updated dependencies [91783c4]
- Updated dependencies [dba7d84]
- Updated dependencies [2d36552]
- Updated dependencies [b2437a7]
- Updated dependencies [f157423]
- Updated dependencies [7a90afd]
- Updated dependencies [eddc1dd]
- Updated dependencies [c9327c9]
- Updated dependencies [920165d]
- Updated dependencies [f53a8d0]
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
  - @object-ui/react@17.7.0
  - @object-ui/sdui-parser@17.7.0
  - @object-ui/react-runtime@17.7.0

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
- 232f61a: Form-field type resolution no longer falls back to `ui`-namespace SDUI node renderers.
  
  A `FormSchema` field's `type` now resolves a `field:`-namespaced widget or takes
  the builtin `default` input branch. It no longer falls back to
  `ComponentRegistry.get(type)` — the bare name in whatever namespace happened to
  hold it. (Maintainer ruling of 2026-08-19 on objectui#5254, option B.)
  
  **This is a behaviour change, and it is the point of the change, not a side
  effect.** A spelling that resolved yesterday stops resolving: a form field whose
  `type` names a non-field component renders the default input instead of that
  component. Measured on the built-in (no-`registerAllFields()`) path, the removed
  fallback answered **126** bare names — `div`, `h1`, `card`, `button`, `form`,
  `alert`, `badge`, the display `text` widget — and 116 of them with the fields
  package registered as well. Marked `minor` for that reason. It is released as a
  behaviour change rather than a fix because callers cannot tell from their own
  metadata which of the two rules answered them; anyone who deliberately pointed a
  form field at an SDUI component was relying on a rule no contract stated, and
  that reliance now needs a `field:`-namespaced widget instead.
  
  Nothing changes for the two paths that carry real traffic. With
  `registerAllFields()` — the production configuration — every affected field type
  already resolved its own `field:` widget (`email` to `field:email`, `password`
  to `field:password`, `text` to `field:text`), and object-derived forms go
  through `mapFieldTypeToFormType`, which has always emitted the `field:`-prefixed
  id. Rendering one of these components as a top-level SDUI **node** is untouched:
  this rule governs field resolution only.
  
  What the fallback was producing on the built-in path, for
  `{ name: 'contact', type: 'email', max_length: 50 }`:
  
  ```
  attrs=["class","id","max_length","field","aria-describedby",
         "aria-invalid","type","value","name"]   maxlength=null
  ```
  
  `email` and `password` are registered as `ui`-namespace node renderers for
  top-level `{ type: 'email' }` nodes, so reached as a *field* they received the
  field-widget prop bundle they do not implement and spread it onto the element:
  the raw metadata object landed as `field="[object Object]"`, `max_length`
  landed as an inert attribute with no cap in effect (`maxlength` null), and the
  node renderer's own `<Label>` gave the control a second `<label>` on top of the
  form's. All three are gone; the declared ceiling now actually caps
  (`maxlength="50"`).
  
  `email` and `password` keep rendering the native input they always rendered.
  The default branch derives `<input type>` from those two declared field types
  (`EmailFieldMetadata` / `PasswordFieldMetadata`), because `inputType` there is
  whatever the author wrote and a plain `{ name, type: 'password' }` authors none
  — without it that field would have rendered `type="text"` and shown a secret in
  clear text. An explicitly authored `inputType` still wins. Other declared types
  with a native HTML equivalent (`url`, `phone`, `number`, `color`, `date`)
  already took this branch as `type="text"` and are unchanged.
- 5673576: fix(components): call `FormSchema.onChange` — the declared callback the form renderer never invoked (objectui#4259)
  
  `FormSchema` declares four lifecycle callbacks and the form renderer
  destructures all four off `schema` in one block: `onSubmit`, `onChange`,
  `onDirtyChange`, `onCancel`. Three were wired. `onChange` was destructured and
  then never referenced again — the destructure was its only occurrence in the
  whole file — so a consumer who authored it got a typed, exported, documented,
  autocompleted callback that did nothing at all. No warning, no dev-mode notice,
  no type error: the declaration said it was supported.
  
  It is now called with the live form values whenever a value changes, through the
  same `form.watch` subscription plumbing the `onDirtyChange` and `onAction`
  channels already use, so the value channel cannot drift into its own schedule.
  
  Two properties are deliberate and pinned by tests:
  
  - **The subscription is guarded.** A schema that authors no `onChange`
    establishes no subscription at all, exactly like the existing `onAction`
    channel and unlike the unconditional `onDirtyChange` one. Watching
    unconditionally would have put a third `form.watch` on every form in the
    product on behalf of callers who asked for nothing; honouring the declaration
    is meant to be purely additive for everyone else.
  - **It runs in the layout phase**, matching the `defaultValues` reset and the
    two subscriptions beside it. React runs every layout destroy before any layout
    create, so a caller passing a fresh inline arrow each render — the common
    shape — has the subscription torn down before the reset and re-established
    after. That is what keeps a record landing in edit mode from being reported to
    the host as if the user had edited every field it filled. A passive effect
    inverts that order.
  
  The callback receives the form values, per its declared
  `(data) => void` signature — not a DOM event. A top-level `onChange` spread onto
  the form node is still stripped before it can reach the `form` element, where it
  would have fired with a SyntheticEvent instead; that block's behaviour is
  unchanged, only its now-outdated comment was corrected.
  
  No change to `@object-ui/types` — the declaration was already there and already
  correct. This is the renderer starting to honour it.
- 911ceaa: The fullscreen long-text dialog announces the field's validation state and carries the field's name
  
  objectui#4824, objectui#4832.
  
  `mobile.fullscreenLongText` is a shipped opt-in, and with it on the phone user
  edits long text in this dialog and nowhere else. Measured on all three surfaces
  that render the dialog — `TextAreaField`, `RichTextField`, and the form
  renderer's built-in `textarea` branch — with the field genuinely invalid at that
  moment:
  
  ```
  INLINE  richtext  aria-invalid= true
  DIALOG  richtext  aria-invalid= false   aria-describedby= null
  INLINE  textarea  aria-invalid= true
  DIALOG  textarea  aria-invalid= null    aria-describedby= null
  ```
  
  and the accessible name of every dialog control empty, against `F` on every
  inline one. The rich-text row is the sharp half: the dialog was not silent about
  the failure, it was announcing the OPPOSITE of the inline control for the same
  field at the same moment, because `RichTextEditorSurface` computed
  `aria-invalid={!!error}` from an `error` prop the dialog rendering never
  received. 3 surfaces, 3 broken, one cause: the dialog's control is built from
  scratch by the host, so none of the wiring the inline control gets from the form
  renderer reaches it.
  
  **Answered once, in the primitive.** `FullscreenEditor` now takes the field's
  `error` and owns what the dialog does with it: it renders the message in a
  dialog-local node, and hands `children` a required fourth argument — a
  spreadable set of DOM attributes — carrying `aria-labelledby` (the dialog
  title's text, i.e. the field label #3393 already put there), `aria-invalid`, and
  `aria-errormessage` naming that node. The host spreads it; the host never learns
  an id, so it cannot name the wrong node, cannot compose the attributes subtly
  wrong, and cannot compute its own `aria-invalid` from a prop it forgot to plumb.
  Three hosts hand-answering this is the shape that produced three identical
  holes.
  
  **On objectui#3222's "the text belongs to `FormMessage`".** The maintainer's
  ruling of 2026-08-16 restates that rule as what it was always protecting —
  only one copy of the error text is in the accessibility tree at any moment —
  which the dialog-local node satisfies: it exists only while the dialog is open,
  and for exactly that window Radix `aria-hidden`s everything outside the modal,
  `FormMessage` included. The shortcut of pointing the dialog control's
  `aria-describedby` / `aria-errormessage` at the host's `FormMessage` id is
  forbidden rather than merely unused: it resolves to a node that is `aria-hidden`
  for the whole time the reference is live (an ARIA MUST violation), and neither
  happy-dom nor jsdom can see the difference — which is why every new pin asserts
  that the named node is inside THIS dialog, not merely that it exists.
  
  `aria-errormessage` carries a single IDREF and is emitted only alongside
  `aria-invalid="true"`. It is deliberately not folded into the host's
  `aria-describedby` chain, which on the textarea surface already carries the
  fullscreen character counter's sentence.
  
  **The name reuses the visible title rather than minting a second author for it**
  (#3978): `aria-labelledby` points at a span inside `DialogTitle`, not at
  `DialogTitle` itself — Radix renders the title as `h2` with the id its own
  `DialogContent` `aria-labelledby` names, so putting an id on it would buy the
  control a name at the cost of the dialog's.
  
  **Breaking (shipped as `minor`, see below), `@object-ui/components` only.**
  `FullscreenEditorProps.error` is REQUIRED, not optional, and
  `FullscreenEditorProps['children']` takes a fourth argument.
  
  FROM → TO for an out-of-repo host:
  
  ```
  <FullscreenEditor value={v} onCommit={c} label={l} testIdPrefix="x">
    {(draft, setDraft, disabled) => <textarea … />}
  </FullscreenEditor>
  
  <FullscreenEditor value={v} onCommit={c} label={l} testIdPrefix="x" error={err}>
    {(draft, setDraft, disabled, aria) => <textarea {...aria} … />}
  </FullscreenEditor>
  ```
  
  A render prop may still declare fewer parameters, so only `error` fails to
  compile — which is the point of making it required. Every consumer already has
  the value at hand (registered widgets take `error` off the widget props
  contract, objectui#3222; the built-in branch reads `fieldState.error?.message`),
  and an omitted `error` reproduces this defect exactly: a dialog announcing
  `aria-invalid="false"` for a field its own form has already failed. An optional
  key was forgotten by three surfaces in a row; a required one cannot be.
  
  `@object-ui/fields` is `patch`: `FullscreenFieldEditor` is internal to that
  package (not re-exported from its entry), so nothing in its public surface
  changes — only the behaviour of the two long-text widgets' dialogs.
  
  `minor` rather than `major` follows the repo's standing retirement precedent
  (AGENTS.md §版本号策略, enforced by `scripts/check-changeset-no-major.mjs`): all
  publishable packages sit in one `fixed` group, so a `major` here would carry the
  whole family up against an `@objectstack` that has not moved.
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
- 167ec42: `ComponentMeta.labelling` grows a third value: `'control' | 'group' | 'display'`
  (objectui#4857, ruled jointly with objectui#4871 as the single repo-wide vocabulary for
  "how does a host learn what a widget will render"). `'display'` declares a widget whose
  whole surface is a pure display in EVERY state — no focusable control, nothing a
  `<label for>` could ever reach.
  
  The form renderer answers the declaration with the objectui#4788 host container (field
  id + `aria-labelledby` + `aria-describedby` + `role="group"`) in the editable state too;
  the `readonly === true` arm keeps its exact #4788 semantics for undeclared widgets. The
  display-only four (`formula` / `summary` / `auto_number` / `vector`) declare `'display'`
  — on the real object-form path they arrive `disabled`, never `readonly` (a deliberate
  distinction this change does not touch), so their visible labels pointed `for` at an id
  no element carried and their help text had zero consumers in every editable form.
  
  `grid` was re-measured before being classified: its only bare-config focusable is the
  auxiliary "Add line" button (routing `for` there would have label clicks insert rows),
  and every realistic config is a table of per-cell inputs — a composite. It declares
  `labelling: 'group'` and its root container now consumes the host id, name and
  description, exactly like `address` / `checkboxes`.
  
  Companion registry gate: `FIELD_WIDGET_LABELLING` (exported) is a `Record` keyed by the
  field-widget map's own literal key union, so registering a widget without deciding its
  labelling is a compile error rather than a silent fall-through to the dangling-`for`
  path, and the declaration test asserts the registered meta agrees with it key by key.
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
- 93fe362: layout: `flex` and `container` now honour a declared scale value of `0`
  
  `FlexSchema.gap` and `ContainerSchema.padding` are declared `number`, and both
  renderers already carried an explicit zero branch (`gap === 0 && 'gap-0'`,
  `padding === 0 && 'p-0'`). Neither branch was reachable: the value was read with
  `||`, so a declared `0` was folded into the default before the branch was tested.
  A `flex` asking for no gap rendered `gap-1.5 sm:gap-2`, and a `container` asking
  for no padding rendered `p-2 sm:p-3 md:p-4` — the JSON said one thing and the DOM
  did another, with nothing reported.
  
  Both now read the value with `??`, matching how the sibling `stack` and `grid`
  renderers already read theirs. Omitting the key still applies the same defaults
  (`gap: 2`, `padding: 4`); only an explicitly declared `0` changes, and no node in
  this repository declared either key as `0` before this change.
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

- 460c4d0: The built-in form `input` branch now honours a declared ceiling in both authored spellings.
  
  The branch spread its leftover field props straight onto the element and never
  read the declared ceiling, so one declaration produced two different outcomes.
  Measured on `origin/main`, rendering the built-in branch (no `registerAllFields()`)
  and dumping the element's `getAttributeNames()` / `getAttribute('maxlength')`:
  
  | declaration | `maxlength` on the element | effect |
  |---|---|---|
  | `maxLength: 50` | `"50"` | capped — but only by the coincidence that `maxLength` names a real DOM attribute |
  | `max_length: 50` | `null`, plus a stray `max_length="50"` | no cap at all, and invalid HTML |
  
  Two distinct defects: the missing cap, and an inert attribute on the DOM that
  reads like a working cap to whoever greps the file next.
  
  `max_length` is a live authoring spelling, not a fossil. The registered
  `field:*` widgets have dual-read `maxLength ?? max_length` since framework#1878
  §3, all three producers of a form field normalize it (`ObjectForm`,
  `sectionFields`, `EmbeddableForm.applyDefaultMaxLengths`) and `@object-ui/types`
  declares it on several field types. Every reader in the repo honoured it except
  this branch — which is precisely the one serving a hand-written `FormSchema` fed
  straight to the renderer, where no producer sits in between to normalize it and
  the author is the producer. This is the same mechanism objectui#3439 resolved
  for the built-in `textarea` branch.
  
  The legacy key is destructured off locally rather than added to the shared
  `stripRendererOnlyProps` list: that helper feeds every branch
  (`checkbox`/`switch`/`select`/`default` all share `domFieldProps`), so extending
  it would change what reaches the DOM for widgets this change neither fixes nor
  tests. The neighbouring `textarea` branch strips it the same local way.
  
  Scope, stated because the sibling card resolved more than this one: the ceiling
  only. Whether a single-line input should also carry the visible `{n}/{max}`
  counter and the announced limit that the `textarea` branch grew in
  objectui#3439 is an independent design trade-off that does not follow from that
  card's conclusion, and is deliberately left undecided here.
- 0ae27f7: The form renderer's built-in `textarea` branch now honours a declared character cap the same way the registered `field:textarea` widget does.
  
  One `maxLength` declaration produced two experiences. The registered path has
  shipped four things since objectui#3406/#3408/#3417 — the native cap, visible
  `{n}/{max}` digits, a description reached through `aria-describedby` so the
  limit is announced on focus, and a threshold-gated debounced near-limit notice.
  The built-in branch — the path standalone and embedded hosts take, the ones that
  call no `registerAllFields()` — shipped a subset of one of them.
  
  The accessibility half is the half that mattered: a screen-reader user on this
  path learned the field's limit only as a validation error AFTER submitting. All
  four affordances now render on both of the branch's surfaces (the inline control
  and the fullscreen dialog), from the SAME `CharacterCount` component the widget
  renders rather than a second copy of it.
  
  Also fixed, and wider than the visible gap: the branch never READ the cap, it
  only spread its leftover field props onto the element. A camelCase `maxLength`
  therefore worked by coincidence — it names a real DOM attribute — while the
  legacy `max_length` spelling, which the registered widget and all three
  producers of a form field have dual-read since framework#1878 §3, landed as a
  stray inert `max_length="…"` attribute and capped nothing at all. The branch now
  resolves both spellings and keeps the non-attribute spelling off the DOM.
  
  `CharacterCount` moved from `@object-ui/fields` to `@object-ui/components`, the
  package both render paths may import, in the direction and for the reason
  objectui#3398 measured for `FullscreenEditor`. It was internal to `fields` (never
  exported from that package's barrel), so no published export changed; it is a
  new export of `@object-ui/components`. Its copy moved with it onto the same
  `fields.textarea.*` keys with byte-identical English defaults, so the ten locale
  packs need no edit and provider-less rendering is unchanged.
- 78c0f9a: The form's cascade clear now recognises object-form fields, so a narrowed option list no longer submits a stale value.
  
  `field:select` and `select` name the SAME field kind: the object-form path
  (`mapFieldTypeToFormType`) emits the prefixed widget id, hand-written SDUI
  schemas the bare one. The form host's cascade-clear effect (objectui#2284)
  compared the RAW type string against the bare-name set, so every option field
  coming from an OBJECT schema fell out of the effect entirely. Its controlling
  field could change, its option list narrow, and the no-longer-offered value was
  never dropped — the form submitted exactly the stale "china + california" pair
  the effect exists to prevent. Only genuinely cascading fields were affected
  (those carrying a `dependsOn` or a per-option `visibleWhen`); a plain picklist
  has nothing to recompute either way.
  
  The comparison now normalizes the type before the lookup, which is what the
  render path a few hundred lines below has done for `isOptionField` since
  objectui#3231 — the two readers of "is this an option field?" no longer
  disagree about what a `select` is. This half was the one missed then.
  
  Stated because it is a behavior change and not an equivalent refactor: the
  object-form path gains cascade clearing for the FIRST time. A form whose stored
  value is genuinely excluded by its chosen parent will now clear that value where
  it previously kept it. The narrowing is bounded by the rules already in place
  for the bare-name path, both of which the object path now inherits unchanged: a
  GATED list (a declared `dependsOn` parent still empty) is treated as unknown
  rather than invalid and never deletes anything (objectui#4247), and a field with
  no `dependsOn` and no per-option predicate is never recomputed at all.
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
- 2e82ab2: The config panel footer translates: `ConfigPanelRenderer`'s Save / Discard labels come from the locale pack.
  
  `saveLabel` and `discardLabel` carried the English literals `'Save'` and
  `'Discard'` as parameter defaults, and no caller in the repo passes either prop,
  so the sticky footer that appears the moment a config draft is dirty stayed
  English in every locale — inside panels whose every other string had already
  been routed through `t()`. The fix is in the renderer rather than per-caller:
  the footer is the renderer's own chrome, so a caller-side fix would translate
  one panel's footer and leave the next host's English.
  
  Both labels now resolve through `createSafeTranslation` — the mechanism this
  package already uses for its built-in copy in `form.tsx`,
  `fullscreen-editor.tsx`, `data-table.tsx` and friends. An explicitly passed
  `saveLabel` / `discardLabel` still wins, unchanged and untranslated.
  
  `common.save` is reused rather than twinned: it already ships `Save` in all ten
  packs and is what the console's other save buttons read. `common.discard` is
  new, because the packs carried no shared spelling of the word — the three that
  existed are each scoped to one surface (`form.discard`,
  `console.settingsView.discard`, `console.objectView.discard`) and the last of
  them diverges from the other two in zh/ko/fr. Its ten values are the majority
  spelling, byte-identical to `form.discard` and `console.settingsView.discard`.
  
  Both English defaults are byte-identical to the literals they replace, so a
  host that mounts no `I18nProvider` renders exactly what it did before.
- 40d3a33: `div` 的废弃提示按 provenance 收窄:只对 **JSON 作者面**的节点报,不再对 `kind:'html'` tier 自己解析出的节点开火。
  
  html tier 的页面是一段受限 JSX/Tailwind 文本,由引擎自己的解析器编译(只解析、不执行),标签名原样映射成节点 —— 作者在那一层写下的盒子标签,是该 tier 词表里的一等成员,**没有别的拼法可迁移**。提示照旧对他们开火,给的还是 JSON 作者面的替代建议:一条谁都无法执行的提示不是废弃,是噪声;它同时意味着这个类型永远退不掉,因为引擎自己的编译器一直在产出它。
  
  判据是**来源**,由生产者确立:解析器给它产出的每个节点打一个 symbol 标记(`Symbol.for` 注册键),渲染器读这个标记。symbol 对 `JSON.stringify` / `Object.keys` / DOM 全部不可见 —— 所以它既不会落进被持久化的文档,也就无法被一份(手写或 AI 生成的)JSON 元数据复制回来给自己买到豁免;通过花括号属性夹带进来的 JSON **不打标记**,那部分本来就是手写的,建议对它成立。
  
  迁移建议一字未改,JSON 作者面照旧每次模块加载报一次;提示文案现在写明它针对哪一个作者面。
- a1609a6: Console list filters: a `between` range is submitted only when both bounds are filled, and six operator labels stop rendering as raw i18n keys.
  
  Two defects in the list-view filter panel (objectstack#8815), both in the Console
  render layer, with no workaround available downstream.
  
  **A half-filled range no longer refuses the whole view.** Picking a date column
  and 「介于」 draws two inputs — that part landed in objectui#3958 — but typing
  only one bound produced `["2024-01-01", ""]`, and both write paths read "is this
  row filled in?" with one shape-blind predicate (`null` / `''` / empty array).
  An array of length 2 passed it, so the empty bound went to the server, which
  refuses the query outright (`400 INVALID_FILTER`): the list showed
  「该视图的查询被拒绝」 and the filters the user had already applied stopped
  applying too. The saved-view fold persisted the same half-range, so the refusal
  came back on every later read of that view, for every user of it.
  
  The spec cannot intercept this — `ViewFilterRuleSchema` accepts
  `["2024-01-01", ""]` because it counts the two slots rather than what is in
  them, while refusing a scalar or a one-element array. Authoring validation is
  therefore green on exactly the shape that fails at query time, which makes not
  emitting it the producer's job. `@object-ui/components` now exports
  `isFilterValueComplete(operator, value)` — arity-aware, so a `pair` row needs
  both bounds — and the two consumers that had each kept a copy of the old
  predicate (`plugin-list`'s `convertFilterGroupToAST`, `app-shell`'s
  `foldFilterGroupToSpecRules`) read it instead. A half-filled range is now
  dropped exactly as a half-typed `equals` row already was: no filter, rather than
  a filter the server will reject. Bounds of `0` and `false` stay real bounds.
  
  **Six operator labels are translated in all ten locale packs.**
  `startsWith`, `endsWith`, `isNull`, `isNotNull`, `exists` and `notExists` were
  missing from every pack, so i18next resolved them to the raw key and the dropdown
  showed `filterBuilder.operators.isNull` beside translated entries. The
  component's own defaults table could not cover it: that table serves only the
  no-provider path, and the Console mounts a provider. The report named four —
  a `date` column's bucket offers the four nullness operators; a `text` column
  showed all six.
  
  Because the label key is built dynamically (`t(\`filterBuilder.operators.${op}\`)`),
  no existing gate could see the gap: the call-site checker classifies a template
  key as `missing-prefix` and only asks whether the prefix resolves, and
  cross-pack parity is satisfied when all ten packs are missing a key together.
  A new parity test pins the packs against `FILTER_BUILDER_OPERATORS` in both
  directions, so an operator added to the dropdown now fails loudly until every
  pack labels it.
- 53f23bc: `FilterBuilder` shows the falsy values a row actually holds — a boolean `false` and a number `0` are values, not empty boxes.
  
  The value controls asked `!condition.value` and `String(condition.value || "")`,
  which folds `false` and `0` in with the rows nobody has filled in yet. Both rows
  saved, persisted and filtered by their value the whole time; only the control
  said otherwise:
  
  - a boolean column filtered `equals false` snapped back to the **Select value**
    placeholder the moment the user clicked **False**, while the row carried
    `value: false`;
  - a number column filtered `equals 0` showed an empty box — and typing `0` into
    one looked like the keystroke had never landed, because the row took the value
    and the very next render blanked the input;
  - a single-select whose option id is `0` showed the placeholder too, even though
    the same control's multi-select branch already drew that option as checked.
  
  "No value" is now one judgement (`undefined` / `null` / `''`), read by every
  value control and by the two helpers that already spelled it out correctly, so
  "not picked yet" and "picked False" stay two distinguishable states rather than
  trading places.
  
  The three keyed numeric paths — the token input's commit, a range bound, and the
  single value input — no longer read with `parseFloat(raw) || 0`, which takes half
  of `"42abc"` and turns `"acme"` into `0`: a filter the user never wrote. All
  three now use the same strict reading a field switch uses, so this component
  holds one answer to "is this string a number" instead of a strict one and a
  lenient one. An unreadable entry becomes an unfilled value, except in the token
  input, which declines the commit and leaves the text in the draft box to be
  fixed. No behaviour a user can reach today changes: those inputs are
  `<input type="number">`, which never hands a non-numeric string to the component
  in the first place — this closes the drift, before a text box, a formula or a
  paste path opens it.
- c4533dc: `FilterBuilder` settles a row's operator when its **field** changes, instead of leaving an operator the new field's dropdown does not list.
  
  The operator buckets are per field type and they do not nest: a `select` column
  offers `in` / `notIn`, a `text` column offers none of them, and only a date
  column offers `between`. Changing a row's field wrote `{ field }` alone, so the
  operator survived into a bucket that no longer contained it. Radix's
  `SelectValue` matches against the `SelectItem`s actually mounted, so the
  operator trigger rendered **blank** — while the row went on filtering by an
  operator the user could neither see nor reach, and could only clear by deleting
  the row.
  
  Changing the field is now one edit with the operator and the value's shape, the
  same way objectui#3958 / PR #4762 made changing the operator one edit with the
  value's shape:
  
  - an operator the new field's bucket still offers is **kept** — switching
    `contains` from one text column to another must not silently become `equals`,
    and the value it carries is left alone;
  - one the new bucket cannot offer is replaced by that bucket's **first** entry,
    and the row's `value` is then re-shaped for the family it lands in — a list
    under `in` collapses to its first entry under `equals`, a `between` range
    keeps its lower bound, an untouched `[]` becomes `''`.
  
  Membership is decided through the spec's own `normalizeFilterOperator`, the fold
  `filterValueArity` already uses, so a stored rule that reaches the builder
  spelled `not_in` is recognised as the operator the dropdown lists as `notIn` and
  is not reset out from under the author. The fold is injective over this
  builder's whole operator vocabulary, which is what makes comparing through it
  safe; a test pins that, and fails the day an added operator would break it.
- be60815: `FilterBuilder` settles a row's **value** when its field changes, instead of leaving a value the new column's input cannot show.
  
  objectui#4768 / PR #4779 settled the row's operator on a field switch and
  re-shaped the value only when the operator's family changed — scalar to scalar
  has no shape question, so what the user typed was carried through on purpose.
  But the field's **type** changed too, and the value input is redrawn from it: a
  browser renders a non-numeric value in `<input type="number">` as **blank**. A
  `text` row filtered `equals "acme"`, pointed at a number column, showed an empty
  box while the row went on carrying `"acme"` — `foldFilterGroupToSpecRules`
  persisted it and the live grid queried `amount equals "acme"`. The same
  invisible-value shape as objectui#4768, one column over.
  
  Changing the field is now one edit with the operator, the value's shape **and**
  the value's type. Convertible values are carried, the rest clear to the family's
  empty shape (scalar `''`, list `[]`, range `[]`):
  
  - `"42"` on a number column becomes the number `42`; `"acme"`, `"42abc"` and
    `"1,000"` clear. The reading is deliberately stricter than `parseFloat`, which
    would turn `"acme"` into `0` — a filter the user never wrote;
  - `"true"` / `"false"` convert on a boolean column, and a boolean becomes
    `"true"` / `"false"` on a text column, so the round trip closes; `1` and
    `"yes"` are conventions rather than readings, and clear;
  - date-like columns take only what their own input can render, plus the one
    truncation that loses nothing it could have shown (`"2024-03-05T14:30"` →
    `"2024-03-05"` on a date column). A bare date does **not** gain a midnight to
    fit a `datetime` column: `equals 2024-03-05T00:00` is a filter that looks
    answered and matches almost nothing;
  - a value the new column can already hold is left alone — switching between two
    text columns, or two numeric ones, still keeps what the user typed, and an
    unfilled row stays unfilled.
  
  The convertibility judgement is defined once, next to `reshapeFilterValue`,
  and `getInputType` now reads the same family table it does — so the type a value
  is converted **to** and the input it is edited **in** cannot drift apart.
- 37f6844: FilterConditionField can author the spec's `$icontains` — case-insensitive contains is reachable from the filter UI.
  
  `@objectstack/spec`'s `FieldOperatorsSchema` gained `$icontains` between
  `17.0.0-rc.2` and `rc.5`, and every driver and evaluation face the platform
  ships now executes it. `FilterConditionField` had no builder operator that could
  author it, so the capability was unreachable from the sharing-rule criteria
  builder and sat in that widget's parity test as an explicit `KNOWN_UNREACHABLE`
  entry.
  
  The FilterBuilder gains a `containsCaseInsensitive` operator ("Contains (ignore
  case)", translated in all ten locale packs). `condToMongo` emits
  `{ field: { $icontains: value } }` and `kvToCondition` reads it back, so a saved
  criteria reopens in the visual builder instead of falling into the raw-JSON
  editor. Today's `contains` is unchanged and still emits the case-SENSITIVE
  `$contains`; whether it should have been case-insensitive all along is a product
  question that stays open, and stored filter views keep meaning what they meant.
  
  The fold is ASCII-only by contract — `café` does not match `CAFÉ`.
  
  The new operator is **opt-in per consumer**: `FilterBuilder` takes an
  `extraOperators` prop, and only `FilterConditionField` passes it. The one
  dropdown feeds three at-rest dialects and only the MongoDB-style criteria this
  widget writes can carry the operator — the spec's `VIEW_FILTER_OPERATORS` (saved
  views) and `VALID_AST_OPERATORS` (the live grid's filter AST) have no
  case-insensitive contains, so offering it there would author a filter those
  paths cannot execute. Every other FilterBuilder is unchanged.
- 93de4f6: fix(components): FilterBuilder 的 lookup 列不再因 `options: []` 被拒掉远程搜索 (objectui#5031)
  
  `renderValueInput` 里那条远程 picker 分支的条件写的是 `!field?.options`,而 `[]`
  是真值 —— 于是一个带 `referenceTo`、`options` 为空数组的 lookup 列**进不到**
  `LookupValuePicker`,落进按 options 画的分支:标量算子得到一个候选数为 0 的
  Select(没有搜索框),`in` / `notIn` 得到一个空的勾选框列表。用户在这一列上挑不出
  任何**新**值,而同一列若 `options` 键干脆缺席反而能拿到完整的远程搜索。可达性不需要
  任何异常状态:`@object-ui/fields` 的 `deriveFilterFields` 与 `plugin-view` 的
  `deriveFieldOptions` 都把 `options` 原样透传,对象元数据里 picklist 值尚未到位时
  就是这个形状。
  
  objectui#4874(PR #5030)已经为「静态选项集是否真的在位」建了唯一判据
  `hasStaticOptionDomain(field)`(= `options` 是**非空数组**),并按「`options: []`
  属于远程/未到位」这一侧裁定了值域行为。这条分支条件把同一个问题又答了一遍,两个答案
  对 `options: []` 相反:值域侧当它是远程列(保值),控件侧当它是静态列(画空 Select)。
  
  按 2026-08-17 维护者裁定,分支条件改读同一个判据:
  
  - `referenceTo`(或 `type` 为 `user` / `owner`)且 `options` 为 `[]` 的 lookup 列
    → `LookupValuePicker`,与 `options` 键缺席时完全一致:有搜索框、有候选、能选出
    新值;多值算子走 picker 的多选形态,仍然回吐列表(objectui#3958)。
  - `options` **非空**的列不受影响 —— 选项集就是它的全部值域,静态 Select 依旧。
  - 分支的其余条件未动:没有 `referenceTo` 又不是 `user` / `owner` 的列(无处可搜)、
    以及 `select` 这类非 lookup 列,路由与此前逐字相同。
  
  「值必须可见」这一条不变,只是由 picker 而不是临时 `SelectItem` 兑现。
- 2b50261: `FilterBuilder` gives the set and range operators an input that matches the value shape the spec accepts, and stops minting the shape it refuses.
  
  Three independent paths let one filter row end up with `operator: 'in'` and a
  SCALAR `value` — the shape `ViewFilterRuleSchema` refuses at save time since
  objectstack#6227, and the shape the query path answered `400 INVALID_FILTER` on
  before that (objectstack#5869):
  
  - Changing the operator dropdown wrote `{ operator }` alone, so the seed `''`
    (or whatever the previous family had produced) survived the switch into
    `in` / `not_in` / `between`. The operator and the shape of its value are one
    edit, so they are now made together: switching families re-shapes the value —
    a typed scalar becomes a one-element list, an empty one becomes `[]`, a range
    keeps its first bound and leaves the second open, and a list collapsing to a
    scalar keeps its first entry.
  - A plain text or number column has no static `options`, so `in` fell through to
    the single-value input and the user could only ever type a scalar into it.
    Those columns now get a token input (type, Enter or comma commits, `×` or
    Backspace removes) that always emits an array; `between` gets its two bounds
    instead of one box. The lookup picker's no-DataSource fallback, which also
    handed back a scalar while `multiple`, emits a list too.
  - The multi-value families were decided from a local `["in", "notIn"]` literal,
    already one spelling adrift: `notIn` is an alias and the canonical member is
    `not_in`, so a stored view read back in canonical form got the single-value
    input for a set operator. The families are now read from `@objectstack/spec`'s
    exported `VIEW_FILTER_LIST_VALUE_OPERATORS` / `VIEW_FILTER_PAIR_VALUE_OPERATORS`
    and folded through `normalizeFilterOperator`, so both spellings of one operator
    get one answer and a family the spec widens is picked up without an edit here.
  
  `foldFilterGroupToSpecRules` is unchanged and needed no change: it normalizes the
  operator and carries `value` through verbatim, so the shape that reaches storage
  is the producer's to get right. An untouched `in` row arrives as `[]`, which the
  fold's existing incomplete-row rule already drops.
  
  Four locale keys are added to all ten packs for the new inputs
  (`filterBuilder.addValue` / `.removeValue` / `.rangeStart` / `.rangeEnd`).
- 384f30d: fix(components): FilterBuilder 的值不再落在列的选项集之外还看不见 (objectui#4874)
  
  带 `options` 的 select/lookup 列，其值控件是一个受控的 Radix Select，而
  `SelectValue` 只认已挂载的 `SelectItem`。于是文本列的 `equals "acme"` 指到
  picklist 列（选项 `won` / `lost`）之后，值控件显示空，行里仍是
  `value: "acme"` —— `foldFilterGroupToSpecRules` 照样持久化、实时网格照样拿
  `stage equals "acme"` 去查。这是 #4768（operator）、#4781（值的类型）之后
  「看不见的值」的第三张脸，成因是**值域**而不是类型：`select` / `lookup` 属于
  文本族，`"acme"` 在类型上装得下，只是不在该列的选项集里。
  
  按 2026-08-17 维护者裁定（A + C 组合）：
  
  - **静态选项列**（`options` 是非空数组，选项集就是该列的全部值域）：切换 field
    时做成员判定，不在选项集里的值清到 #4781 的那套空形 —— 标量 `''`、列表逐项
    过滤后 `[]`。列表是**逐项**判定，用户写对的那几项不会被一颗坏项连坐。
  - **远程/异步列**（lookup 远程搜索、`options` 缺席，或 `options: []` 尚未到位）：
    值**保留**并**可见** —— 绝不因一份从未声称完整的本地选项集去删一个合法的
    lookup id。Select 把该值挂成一个临时项（标签用值本身，与
    `LookupValuePicker` 对没有 label 的 id 的做法一致），多值列表把它渲染成一行
    已勾选、可取消的条目。
  - 可见性是**无条件**的：无论值是切列带来的、从已存视图读回来的，还是选项集晚到
    才对不上，控件都显示行里真正带着的东西。「行带值、控件空白」这个形态不再存在，
    也不会为了显示去悄悄改写传入的 `value`。
- ac600e5: A `user` field in a form now receives `dataSource` / `dependentValues` / `dependsOnLabels`, like every other reference field.
  
  The form renderer decided which registered widget gets those three props from a
  module-private `DATA_SOURCE_FIELD_TYPES` set, while `@object-ui/core` kept
  `EXPANDABLE_FIELD_TYPES` for the same underlying fact — a field whose stored
  value is a foreign key into another object. The core side's TSDoc claimed to
  mirror the form's set, and it did for 15 days: the form's copy then gained
  `capability-multiselect` (objectui#2403) and the three widget-hint pickers
  `object-ref` / `filter-condition` / `recipient-picker` (objectui#2421) on the
  same day, after which the two sets were not in a subset relation in either
  direction — `user` only in core, the picker names only in the form — with
  nothing able to report it.
  
  The form now derives its rule instead of restating it: the reference half is
  core's set, the form-specific half is the three picker names, which are widget
  hints and can never be a declarable field `type`. Adding a member to
  `EXPANDABLE_FIELD_TYPES` therefore also grants it the form's data-source wiring;
  that coupling is intended and is now written down on both sides.
  
  The user-visible half is `user`. It previously received none of the three props.
  `dataSource` and `dependentValues` each have a `SchemaRendererContext` fallback
  inside the widget, so the person picker limped along wherever a provider
  happened to supply one; `dependsOnLabels` has no fallback, so a
  dependency-gated user picker interpolated the raw API name into its
  "select ... first" hint in every locale — the leak objectstack#5407 closed for
  lookups and left open here. The widget contract's own `dataSource` doc has
  always named `user` among the types the form renderer injects for.
  
  No change to what is expanded, projected or rendered anywhere else: the core
  set's members are untouched.
- 97fba31: The built-in form's `default` fallback branch now enforces a declared `max_length` ceiling.
  
  The last arm of the field switch — the one serving a `type` that is neither a
  built-in field type nor resolvable from the registry — spread its props straight
  onto the rendered `Input` and never read the declared ceiling. One declaration
  therefore split into two outcomes depending on how it was spelled. Measured on
  `main` after objectui#5201 landed:
  
      max_length: 50 -> attrs=["class","max_length",...]  maxlength=null
      maxLength: 50  -> attrs=["class","maxlength",...]   maxlength="50"
  
  The camelCase spelling capped by coincidence — it happens to name a real DOM
  attribute. The legacy `max_length` capped nothing at all and landed as a stray,
  inert `max_length="50"` attribute: invalid HTML that reads like a working cap to
  the next reader. Two independent defects, both now fixed.
  
  `max_length` is a live authoring spelling, not a fossil: the registered `field:*`
  widgets have dual-read `maxLength ?? max_length` since framework#1878 §3, all
  three producers of a form field normalize it (`ObjectForm`, `sectionFields`,
  `EmbeddableForm.applyDefaultMaxLengths`), and `@object-ui/types` declares it on
  several field types. This branch serves a hand-authored `FormSchema` handed
  straight to the renderer, where there is no normalizing producer in between and
  the author is the producer — so it was the one reader in the repo that dropped
  the declaration.
  
  Same defect and same fix shape as objectui#5201 (the `input` arm) and
  objectui#3439 (the `textarea` arm): the ceiling is resolved locally inside the
  branch, and the legacy key is destructured off locally. The shared
  renderer-only strip table is deliberately unchanged — it feeds the `checkbox`,
  `switch` and `select` arms too, and widening it would alter branches this change
  does not test.
  
  A field that declares no ceiling in either spelling renders no `maxlength`
  attribute, exactly as before.
- 3fbbea1: `container`: honour a declared `maxWidth: false` as "no maximum width"
  
  `ContainerSchema` has always declared `maxWidth?: … | false`, but the renderer
  read it as `schema.maxWidth || 'xl'`, so `false` folded into the default and a
  container asking for **no** constraint rendered `max-w-xl` (`max-width: 36rem`)
  — the opposite of what it declared. The `false` arm of the union had no
  reachable path from the day it was declared.
  
  `maxWidth` is now read with `??` (the spelling `stack` / `grid` always used, and
  the one objectui#4003 gave this file's `padding` and `flex`'s `gap`), and `false`
  emits an explicit **`max-w-none`** rather than simply omitting a class. The two
  are not the same fact: an omitted class leaves an inherited max-width standing —
  `@tailwindcss/typography`'s `.prose` sets `max-width: 65ch` — while `max-w-none`
  cancels it. The registry `inputs` enum for `maxWidth` gains `false` to match the
  type it lagged, so the designer and `sdui-parser`'s manifest gate stop reporting
  a legal value as `invalid-enum`.
  
  No authored node in the repo declared `maxWidth: false`, so nothing that renders
  today changes.
- 616a2a5: The list filter builder no longer offers `Is set` / `Is not set`, which its query dialects cannot express.
  
  **User-visible before/after.** The operator dropdown in the list toolbar's
  filter popover — and in the Studio view/tab/page filter inspectors, the dataset
  inspector and the generic `filter` config field — loses two rows: **"Is set"**
  and **"Is not set"**. The sharing-rule criteria builder (`FilterConditionField`)
  keeps both, unchanged. `Is null` / `Is not null` and `Is empty` / `Is not empty`
  are untouched everywhere and remain the way to filter on a missing value from
  the list.
  
  Nothing that worked stops working. Every save path behind those two rows was
  already broken, in three different ways depending on the surface:
  
  - **Live grid** — `ListView.mapOperator` had no row for either id, so its
    `default:` arm returned the id verbatim and the query went out as
    `['name', 'exists', 'x']`. `exists` is not a member of the spec's
    `VALID_AST_OPERATORS`, so `isFilterAST()` rejects the shape: an unfiltered
    read or a 400, never the filter the user asked for.
  - **Save as view** — `foldFilterGroupToSpecRules` normalizes through the spec's
    `normalizeFilterOperator`, which does not know the pair, and
    `ViewFilterRuleSchema`'s enum then refuses the rule.
  - **Dataset inspector** — `groupToCondition` has no row either and drops the
    condition silently, so the filter simply never applied.
  
  **Why withheld rather than mapped.** Measured on `@objectstack/spec`
  17.0.0-rc.6: neither `VIEW_FILTER_OPERATORS` nor `VALID_AST_OPERATORS` contains
  an existence operator, under any spelling — both sets have zero members matching
  `/exist/`. Only the MongoDB-style `FieldOperatorsSchema` criteria carries
  `$exists`, and that is precisely the dialect `FilterConditionField` writes, so
  the pair moves behind the existing `OPT_IN_OPERATORS` gate and that widget opts
  in. Collapsing them onto `isNotNull` / `isNull` was rejected: the builder
  already draws those as their own rows, the round trip is lossy (a saved
  `exists` reads back as `isNotNull`), and the spec's own note records `$exists` =
  has-value as still unsettled across drivers — `driver-memory`'s live mingo path
  and `driver-mongodb` read key-presence.
  
  **The class is now closed by an assertion, not by discipline.** objectui's three
  existing operator-parity guards all sweep spec vocabulary → objectui; none asked
  whether an id the dropdown draws is an id the consumer can persist, which is the
  direction that broke. `plugin-list`'s new
  `list-offered-operator-expressible-parity.test.ts` forces the set the list
  toolbar offers to **equal** the set its two dialects can express, in both
  directions — so an unexpressible operator cannot be offered, and an operator
  that becomes expressible upstream cannot stay needlessly withheld.
- 4a0bd17: `page:accordion` now renders an item's `icon` in its panel trigger.
  
  `PageAccordionItem` (`packages/components/src/renderers/layout/containers.tsx`)
  has always declared `icon?: string`, but `PageAccordionRenderer` never read it
  — an authored icon reached the trigger and was silently dropped. The
  `objectstack` spec's `PageAccordionProps.items[].icon` already treats this as
  legitimate, undeprecated authorable surface (unlike the neighboring `value`
  key, which the same schema explicitly flags as dead), so the renderer was the
  side out of sync. It now renders the Lucide icon before the panel label,
  following the same convention `page:tabs` items already use in this file.
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
- aff10e2: A `field:`-prefixed `password` no longer renders as clear text when its widget is not registered
  
  On the built-in path (`@object-ui/fields` not registered) a form field spelled with the
  `field:`-prefixed widget id resolved nothing and took the form renderer's `default` input
  branch. That branch's native-input table was keyed on the raw `type`, so the prefixed
  spelling missed it and rendered `type="text"` — and `mapFieldTypeToFormType` emits the
  prefixed id for **every** object-derived form, so this was the normal path, not an edge
  case. An object-derived `password` field therefore put the secret on screen in clear text,
  and an object-derived `email` field lost its native keyboard and validation.
  
  The two spellings now get the answer each deserves:
  
  - **`field:password` refuses.** Reaching the unregistered default with a registry key
    proves the app shipped without the widget it declares, so the value is not rendered at
    all — no input, nothing carrying the secret in the DOM. In its place is an inline
    `role="alert"` refusal naming the missing widget, plus a `console.error` that doubles as
    the fix instruction. Masking alone would still invite a user to type a secret into a form
    whose password widget is absent.
  - **`field:email` renders the native email input**, because the native-input table is now
    keyed on the declared type with the `field:` prefix stripped.
  - **The bare `password` / `email` spellings are unchanged.** They claim no registered
    widget, the default branch is their intended home, and their native input stays exactly
    as it was.
  
  Deliberately narrow: only `password` refuses, and only under the `field:` namespace. Every
  other unregistered `field:*` id renders the same text box it rendered before, and a
  registered `field:password` widget still wins.
- 7458a41: A readonly field's replacement display is now named by the field's label and described by its help text.
  
  A registered field widget's readonly branch renders a replacement display — a
  `mailto:` anchor, a formatted span, a chip row, a preview table — and returns
  before its DOM pass-through, so nothing the form renderer handed down reached an
  element. Measured on a real form, one field per row, with `description` set: the
  host control id (`…-form-item`) was on NO element in the document, so the visible
  label's `for` pointed at nothing and the readonly surface had NO accessible name
  at all, while the rendered help text had zero consumers. All 34 registered
  non-group-labelled widget types read identically, including the four display-only
  ones (`formula` / `summary` / `auto_number` / `vector`) whose whole widget is a
  replacement display.
  
  The form renderer now wraps a readonly registered field widget's output in a
  container carrying the host id, `role="group"`, `aria-labelledby` and
  `aria-describedby`, and the label publishes an `id` in place of its `for` — the
  same WAI-ARIA group pattern objectui#3961 / #3990 / #4005 established for the
  seven composite widgets, applied at the host instead of in each widget. Not one
  widget file changed: the mechanism lands once, so the current widgets and any
  future third-party one are correct by construction, with no "remember to spread
  the host props" step left to miss.
  
  The name is composite — the label's id AND the container's own — so the VALUE
  stays in the accessible name (`Email user@example.com`, not just `Email`);
  `group` is not a name-from-content role, and the value is usually the only thing
  on screen. `aria-invalid` is deliberately dropped at this boundary: it is
  control-channel state reporting what a user's own editing may do wrong, and a
  readonly display cannot be edited (objectui#3291 / #3318 / #4005).
  
  Two consequences worth stating. Readonly registered fields gain one DOM layer,
  which end-to-end selectors written against the widget root as a direct child of
  the form item will see; the layer carries `data-slot="readonly-field-group"` as a
  stable locator. And because that layer is a block box where several readonly
  faces were inline, those rows now take the form's standard label-to-value
  spacing, matching the editable state. Builtin types (`input` / `textarea` /
  `checkbox` / `switch` / `select`), editable fields, group-labelled widgets and
  fields rendered without a label are untouched, byte for byte.
- d971e51: A create form no longer deadlocks on a `requiredWhen` field that also declares a runtime `defaultValue`.
  
  `#4069` ruled that in **create** mode a field whose `defaultValue` is a runtime
  instruction the server resolves per insert (`NOW()` / `current_user`, or a CEL
  Expression envelope) is producer-owned: the control is deliberately left empty
  and the key is omitted from the payload, because `ObjectQL.applyFieldDefaults`
  resolves the declaration only for a field that arrives absent or null. That was
  implemented on the STATIC `required` flag.
  
  The conditional spelling was not covered. `requiredWhen` is resolved one layer
  downstream, in the form renderer, against the live record — so a predicate
  resolving TRUE on a create form put the requirement straight back: the control
  was still empty by design, the submit was refused, and the user had nothing
  sensible to type.
  
  Both spellings now behave identically on a producer-owned field. A
  `requiredWhen` predicate is a claim about the value at rest in a given state,
  and `NOW()` / `current_user` resolve at insert regardless of state, so the
  producer's guarantee covers the conditional claim by the same argument that
  covers the unconditional one. An author who really means "the user must supply
  this in this state" has a natural spelling for it: do not declare the default.
  
  The suppression lands in the single evaluator both layers read,
  `resolveFieldRuleState` — the same verdict that draws the required marker and
  the one the submit-time check consults — so a field can never lose its asterisk
  while still refusing the write. The classifier that answers "is this value the
  producer's to supply" moved down to `@object-ui/core`
  (`isRuntimeDefault` / `isServerOwnedValue`, re-exported from
  `@object-ui/plugin-form`) so the renderer, the wizard's cross-step gate and the
  create-form field builders all read one implementation rather than three.
  
  **Edit mode is unchanged.** Defaults do not re-apply to an existing record, so
  on a persisted row the token was already resolved at insert and blanking the
  column is a real removal: `requiredWhen` enforces there exactly as authored.
  Fields with no declared default, and fields whose default is a static literal
  (which IS seeded into the control), are also unaffected in both modes.
- 75444e3: The dependency-gate hint now enumerates its controlling fields with the locale's
  own list separator, and reads identically whichever caller produced it.
  
  `lookup.selectFirst` and `fields.options.selectFirst` are deliberately one
  wording, so a field gated on two or more parents says the same thing whether the
  lookup widget or the form renderer rendered it. The sentence was shared but its
  `{{fields}}` slot was not: each call site joined the controlling-field names
  with its own hardcoded separator, and not even the same one — `', '` in
  `LookupField`, `' / '` in the form renderer's `gatedHint` and in
  `OptionsEmptyState`. A field gated on Account and Lead Source read
  `Select Account, Lead Source first` from one side and
  `Select Account / Lead Source first` from the other.
  
  A list separator is a property of the locale rather than of the code, so both
  spellings were also wrong for the script under zh/ja (which enumerate with
  U+3001) and under ar (U+060C). All three call sites now read
  `validation.formInvalidJoiner` — the key already shipped in all ten packs for
  the invalid-submit toast's field list, which is the same class of truncated-name
  list. One key, every caller: a second, gate-specific key would have recreated
  the divergence the shared sentence exists to prevent.
  
  No locale pack changes, and no change to what a provider-less render produces in
  English: the `@object-ui/fields` defaults table declares the joiner as `', '`,
  the `en` pack's value and the literal `LookupField` previously hardcoded.
- 2d0bd16: Remove two unreachable renderer registrations, and fail the build on any new same-namespace duplicate.
  
  The component registry silently keeps the LAST registration for a given
  `namespace:type` key. Two renderers on `main` were therefore dead code — they
  compiled, type-checked, and never ran:
  
  - `renderers/data-display/table.tsx` (`SimpleTableRenderer`) lost `ui:table` to
    `renderers/complex/table.tsx`, because `renderers/index.ts` imports
    `./data-display` before `./complex`. It was the only table renderer that read
    `bind`, which is why a `table` node with a two-row `bind` rendered a header and
    zero rows (objectui#5125).
  - The `kbd` entry in `renderers/basic/html-elements.tsx`'s `TAGS` loop lost
    `ui:kbd` to `renderers/data-display/kbd.tsx` — despite that list's own comment
    stating it excludes anything already registered.
  
  In both cases the renderer that serves the key today is the one kept, so no
  reachable behaviour changes: `table` still renders inline `data` against
  `columns` and still ignores `bind`, and `kbd` still renders one `<kbd>` per entry
  in `keys`. Both readings are now pinned by tests.
  
  Whether `table` *should* read `bind` is deliberately left open — that would widen
  the authorable key surface and is a product decision, not a consequence of
  deleting dead code.
  
  The new gate (`renderers/__tests__/registration-uniqueness.test.tsx`) counts every
  registration the production barrel makes and fails on any key registered twice
  under one namespace, so a re-introduced duplicate is caught at CI rather than by
  an accidental probe. It is a test rather than a runtime warning because
  re-registering a key is a supported pattern for test stubs, and a warning there
  would fire mostly on legitimate overrides.
- dad51e5: fix(fields): deliver the host's a11y channels to `slider` and name `signature`
  
  `SliderField` and `SignatureField` forwarded nothing a form host handed them —
  neither spread `toDomProps(props)` at all — so `<FormControl>`'s whole payload
  landed on nothing. Measured on a real form, one required field per row, freshly
  failed validation:
  
  ```
  slider     ariaInvalidTrue=[]  labelFor=…-form-item -> DANGLING  descConsumers=0  ids=[]
  signature  ariaInvalidTrue=[]  labelFor=…-form-item -> DANGLING  descConsumers=0  ids=[]
  text       ariaInvalidTrue=[input]  labelFor -> input            descConsumers=1
  ```
  
  `ids=[]` is the tell: no element in either row carried an id at all, so the
  visible label pointed `for` at nothing, the rendered help text had zero
  consumers, and a failed slider announced no error state.
  
  **`slider`** now delivers all three. Its focusable control is Radix's
  `span[role="slider"]` thumb, which the synced `ui/slider.tsx` renders internally
  and does not export, so the primitive grew a declared `thumbProps` — routed
  through a new `lib/slider-thumb` and applied to the no-touch file as a declared
  sync patch, so it survives regeneration. The split of which keys stay on Root
  (`name`, `disabled`) is the one the `select` fix already settled.
  
  **`signature`** gets the name and the description on a `role="group"` container.
  Its control state deliberately does not follow: the drawing surface is a
  `<canvas>` with no keyboard path, and its only other element is disabled while
  the pad is empty, so there is no element a control state could be read from.
  
  Both are now declared `labelling: 'group'` — a `<span>` and a `<canvas>` are not
  labelable elements, so a host `for` could only dangle at them.
- 1c9c342: The `span` deprecation notice is now reported once per page load, and only to the authoring surface it applies to.
  
  `SpanRenderer` was two rulings behind `div`. It still `console.warn`ed on **every
  render**, and it still fired at nodes the `kind:'html'` tier's own parser had
  emitted — the two defects that were ruled on for `div` in objectui#3965 (PR
  #3998, which explicitly named `span` as the follow-up) and objectui#4000 (PR
  #4916, which built the provenance mechanism). This is that follow-up
  (objectui#4917); it copies the shape now in `basic/div.tsx` rather than inventing
  a second one.
  
  - **Once per module load.** The notice is a property of the deprecated TYPE, not
    of each node, so repeating it per render only buries the page's real console
    errors. The deprecation still fires in dev builds, exactly once.
  - **JSON-authored nodes only.** An author writing the plain inline tag in a
    `kind:'html'` page gets a node this deprecated renderer serves — and was told
    to migrate to `badge` / `text`, neither of which exists in that tier's
    vocabulary, with nothing they could write to make it stop. Provenance is
    established by the producer (the parser stamps what it emits, via
    `isHtmlTierNode`), not guessed from the node's shape here.
  - **The notice now names its surface**, so whoever reads the console can tell
    which of their pages it is about. The migration guidance itself is unchanged:
    this narrows WHO is told, it does not water down WHAT they are told.
  
  Order is load-bearing and pinned by tests: the html-tier exemption is checked
  BEFORE the warn-once set is marked, so an html-tier node rendering first cannot
  swallow the notice a JSON-authored node earns later on the same page.
- 787c738: `span` renders the `value` its type and its published doc both declare, with child content winning when both are present.
  
  Two declared authoring surfaces named `value` the text content of a span and the
  renderer read neither: `TextSpanSchema` declares `value?: string` commented
  `Text content` (`packages/types/src/layout.ts`), and the published doc's Schema
  block lists the same key with the same comment. Before objectui#5027 the
  renderer read `body`, which no producer emits; #5027 moved it to the canonical
  `children`. Neither version ever read `value`. So an author writing
  `{ "type": "span", "value": "hello" }` — exactly what the type and the docs
  instruct — got an empty element, with no warning and no diagnostic. Same failure
  shape as #5027 (content silently dropped), one key over, and not catchable on
  the type surface: `BaseSchema` carries an index signature, so no spelling on
  this node is ever a TS error.
  
  Precedence, ruled 2026-08-17: `children` wins, `value` is the fallback. This is
  the shape the sibling type in the same family already sets — `basic/text.tsx`
  renders `schema.content || schema.value` — so `span` stops being the odd one out
  rather than growing a rule of its own. "No child content" means an absent, empty
  or empty-array `children`; that is exactly when `value` renders.
  
  Both declared faces stay as written. The fix makes them true instead of
  retracting a key that has been published as authorable. `body` remains refused
  (objectui#5027): it is declared nowhere for this type, whereas `value` is
  declared twice — the question is whether a key was published as authorable, not
  whether a tolerant read would be convenient.
- 8396656: The `span` renderer renders its content again — it reads `children`, the key its own type declares and its producers emit.
  
  The renderer read `schema.body` and nothing else, and no producer on either of
  its authoring surfaces emits that key. In a `kind:'html'` page the parser
  assigns compiled child nodes to `children`
  (`@object-ui/sdui-parser`'s `parse.ts`), so an author writing the plain inline
  tag with text inside it got an EMPTY element back — the text was dropped with no
  warning and no diagnostic, because the parser's tree validation does not inspect
  child keys. A sibling paragraph on the same page rendered normally, which is what
  made this read as anything but a compile failure. On the JSON surface the same
  thing happened to anyone following the declaration: `TextSpanSchema` declares
  `value` and `children`, so `children` is what an author writes, and `children` is
  what rendered nothing.
  
  The canonical child key is `children` — what the type declares, what the parser
  emits, and what the sibling `div` renderer already reads. `body` is deliberately
  NOT accepted as a second spelling: a tolerant read would fossilize a second
  de-facto contract for the one type whose declaration never named it
  (Commandment #0.1), and a repo sweep found no page, example, catalog entry or
  metadata document authoring it on this tag. A pin test states both halves — the
  content renders, and a `body` alias renders nothing — so re-adding the lenient
  read turns a test red rather than passing review.
  
  Reachability, stated plainly: the `span` type is deprecated for JSON-authored
  pages, but it is permanent first-class vocabulary of the `kind:'html'` tier,
  where the tag is compiled straight through and no other spelling exists. So the
  authors who could do nothing about the deprecation were exactly the ones losing
  their text.
  
  Not changed here, and named because the declaration still promises it: `value`
  on this tag is declared by `TextSpanSchema` and read by nobody, as it was before
  this fix. Making it render needs a ruling on precedence against `children`,
  which belongs with the wider child-key drift (objectui#4631) rather than in a
  rendering-path fix.
- 138ab04: Fix a list filter that silently applied nothing when the first thing you picked was **Is null** or **Is not null**.
  
  Adding a filter seeds the row with no value, and changing the operator keeps it that way — which is correct for an operator that takes no value, since the panel draws no input for one. The live grid read that row as unfinished and dropped it: the filter appeared in the panel, the query went out without it, and every record came back with no error to explain it. Only `Is empty` / `Is not empty` were exempt; the builder renders six operators value-less.
  
  Which operators are complete without a value now has a single owner — `VALUELESS_FILTER_BUILDER_OPERATORS`, exported from `@object-ui/components` beside the code that decides it. The live grid and the saved-view fold both read it instead of keeping their own lists, so the two halves of one interaction can no longer disagree about whether a row is finished.
- Updated dependencies [88085e3]
- Updated dependencies [69251bf]
- Updated dependencies [57e668f]
- Updated dependencies [516663d]
- Updated dependencies [41ac1b7]
- Updated dependencies [1eaf0a1]
- Updated dependencies [2533ec5]
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
- Updated dependencies [1184192]
- Updated dependencies [a2a9747]
- Updated dependencies [a1609a6]
- Updated dependencies [37f6844]
- Updated dependencies [2b50261]
- Updated dependencies [ac600e5]
- Updated dependencies [d374caf]
- Updated dependencies [c1ef923]
- Updated dependencies [af5e292]
- Updated dependencies [7f96b10]
- Updated dependencies [167ec42]
- Updated dependencies [0046d8f]
- Updated dependencies [f1d4748]
- Updated dependencies [bea374e]
- Updated dependencies [b1119ec]
- Updated dependencies [9f23d2b]
- Updated dependencies [578e025]
- Updated dependencies [af025ee]
- Updated dependencies [d109a4d]
- Updated dependencies [598c89a]
- Updated dependencies [b8b9af4]
- Updated dependencies [31676be]
- Updated dependencies [8c0d52e]
- Updated dependencies [70a774b]
- Updated dependencies [9ce096f]
- Updated dependencies [e05db88]
- Updated dependencies [ad13d63]
- Updated dependencies [5ffcc14]
- Updated dependencies [d971e51]
- Updated dependencies [97abb24]
- Updated dependencies [deb157a]
- Updated dependencies [9c60144]
- Updated dependencies [d2ce342]
- Updated dependencies [9695da7]
- Updated dependencies [58b8346]
- Updated dependencies [a9e17b4]
- Updated dependencies [b8ce7dc]
- Updated dependencies [dbbd38a]
- Updated dependencies [8871c14]
- Updated dependencies [dfc6975]
- Updated dependencies [3cf4de0]
- Updated dependencies [c9dc811]
- Updated dependencies [144ef9b]
- Updated dependencies [a0b9e91]
- Updated dependencies [99bd015]
- Updated dependencies [21e4585]
  - @object-ui/types@17.6.0
  - @object-ui/i18n@17.6.0
  - @object-ui/react@17.6.0
  - @object-ui/core@17.6.0
  - @object-ui/sdui-parser@17.6.0
  - @object-ui/react-runtime@17.6.0

## 17.5.0

### Minor Changes

- dc2aa3e: The action renderers publish the modern `UIActionSchema`, and every `forwardRef` renderer's props parameter is annotated so its declared types survive

  **Breaking semantics (declared `minor` per the repo's version-alignment rule — objectui#4403 precedent — never `major`).** Six exported declarations in `@object-ui/components` change the action type they name, from the `@deprecated` legacy `ActionSchema` (`crud.ts`) to `UIActionSchema` (`ui-action.ts`):

  - `ActionBarSchema.actions`, `ActionBarSchema.systemActions`
  - `ActionMenuSchema.actions`
  - `ActionGroupSchema.actions`
  - `ActionButtonProps.schema`, `ActionIconProps.schema`

  The two types are not interchangeable in either direction. `UIActionSchema` requires `name`, which legacy inherits as optional from `BaseSchema`; legacy pins `type: 'action'` where these renderers serve `'script' | 'url' | 'modal' | 'flow' | 'api'`; and only the modern type declares `locations`, `target`, `endpoint`, `bodyExtra`, `bodyShape` and a `variant` union containing `'primary'` — all of which the implementations already read. objectui#4417 measured four compiler errors proving the VALUES were modern while the DECLARATIONS said legacy; this moves the declarations to match, so the contract and the implementation finally agree.

  No runtime behaviour changes, and no published surface is involved: none of the six declarations is re-exported from the package index, and the sweep found zero type-checked consumers outside each declaration's own file. Metadata that renders today renders identically — the renderers read the same keys through the same paths.

  Separately, all fifteen `schema`-reading `forwardRef` renderers in the package now annotate their render function's first parameter directly, and carry the pass-through index signature on that annotation rather than on the `forwardRef` type argument. `forwardRef` routes its type argument through `PropsWithoutRef`, whose `Omit` collapses a props type carrying `[key: string]: any` down to the bare index signature — every declared property erased, silently, with `noImplicitAny` reporting clean because the `any` is supplied explicitly by the index signature. That is what hid the declaration/implementation drift above for as long as it lasted. Thirteen renderers recover a real declared type for `schema` (the two raw-tag factories keep `any`, which is what they genuinely declare), and a new structural guard, `forwardref-props-annotation.guard.test.ts`, fails on any future `forwardRef` that reintroduces either half of the trap.

- cb13400: One fullscreen long-text editor, hoisted to the package both render paths may import

  The "expand to a full-height dialog" interaction had two independent implementations. `FullscreenTextarea` lived inside the form renderer's built-in (unregistered) `textarea` branch in `@object-ui/components`; `FullscreenFieldEditor` lived in `@object-ui/fields` and served the registered `TextAreaField` / `RichTextField` widgets. They exist because ONE form-level promise — `ObjectFormSchema.mobile.fullscreenLongText`, projected onto every long-text field as `mobile_fullscreen` — is honoured on two render paths, and each path grew its own answer.

  Two copies of a state machine drift, and these did, in both directions: objectui#3400 measured a read-only long-text field that was fully editable through the built-in branch's dialog (and "Done" wrote the edit into form state), objectui#3402 measured the same write-back hole for `disabled` on the registered path, and objectui#3393 (the dialog title needs the field label) and objectui#3272 (the copy needs i18n) each landed on one side before the other. Every repair was correct and none of them scaled.

  `@object-ui/components` now exports `FullscreenEditor`, a single primitive owning the affordance, the dialog, the draft/commit state machine and the copy. The direction follows the measured import graph rather than fighting it: `@object-ui/fields` depends on `@object-ui/components`, and `components` declares no dependency on `fields` in either `dependencies` or `peerDependencies`, so the shared code can only live in `components`. `FullscreenFieldEditor` becomes a thin wrapper over it and keeps its name, its props and its test-id namespaces, so both hosts and their pins are unchanged.

  The load-bearing part of the merge is that the primitive DEFINES `readOnly` and `disabled` instead of inheriting them by accident. Neither copy defined both: the built-in one grew them under objectui#3400, while the fields one declared only `disabled` and was shielded from `readonly` by its hosts' early return — a single implementation cannot be shielded by one caller's control flow. So both are answered once, and both call paths inherit the same answers: `readOnly` renders no affordance at all (it means "shown plainly", so advertising an expand button the user cannot use is worse than showing none), `disabled` leaves an inert one (it means "not interactive, muted"). Neither relies on the toggle alone, because `disabled` also carries the form's `isSubmitting` and can flip to true while the dialog is already open — so opening refuses independently of the attribute, the injected editor is told, "Done" is disabled, and `onCommit` is gated as the single point where a value leaves for host state.

  No copy changed and no locale pack needed an edit: the primitive consumes the same `form.fullscreen.*` / `common.cancel` keys both copies already read, through `createSafeTranslation` with English defaults byte-identical to the literals, so provider-less hosts render exactly what they did. The now-unread `form.fullscreen.*` defaults are dropped from `useFieldTranslation`, where they would have re-created in the defaults map precisely the duplication this change removes from the components.

  `toggleClassName` is not carried into the new primitive. It was declared on `FullscreenFieldEditorProps` and written by nobody — zero producers repo-wide — and `FullscreenFieldEditor` is not exported from the `@object-ui/fields` barrel, so no consumer outside the package could ever have set it. Minting it as part of a NEW public export in `@object-ui/components` would have published a prop with no producer, the shape objectui#3232/#3233 keeps deleting.

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

- bb68488: `element:record_picker` publishes `sort`, `limit` and `emptyText` as authoring
  inputs (objectui#4167).

  All three were already READ by the renderer and declared by the contract — the
  renderer has passed `sort` into `$orderby` and `limit` into `$top` since the
  block existed, and `emptyText` decides the no-rows message — but none of them
  appeared in `inputs`, so every layer that reads a manifest said they did not
  exist. `packages/components/src/renderers/layout/page.tsx` builds the JSX-page
  compiler's prop whitelist from `getKnownTypes()` plus these `inputs`, so writing
  any of the three on a JSX page drew an `unknown-prop` warning from
  `sdui-parser/src/validate.ts` on a key the renderer then went on to honour.

  That is objectui#3407's shape — honoured, undiscoverable — and this is the same
  repair objectui#3808 made for `record:details.hideFields` and objectui#3830 made
  for `element:record_picker.filter`. `@objectstack/spec` 17.0.0-rc.6 is what made
  it actionable: objectstack#5775 declared the three upstream, and the reverse
  direction of the console's registry parity gate went red demanding them the
  moment the pin moved — a red the previous exemption had predicted in writing and
  called "correct and wanted".

  Each description documents the renderer's real behaviour rather than restating
  the schema, because that is the half an author cannot read off the contract:

  - **`sort`** and **`limit`** are both overridden OUTRIGHT by a node-level
    `dataSource` binding (`dataSource.sort ?? sort`), not merged with it — so a
    node that carries a `dataSource` silently ignores them.
  - **`limit`** defaults to 50 in the renderer, not in the schema, and a record
    outside the limit cannot be picked at all with nothing in the control to say
    more exist.
  - **`emptyText`** is published as `string` against a contract of
    `string | Record< string, string >`: rc.6 widened it to `I18nLabel`, and this
    renderer passes the value straight into a text node with no locale resolution,
    so only the plain-string form renders today. The description says so rather
    than advertising a shape the renderer drops — the narrowed-type treatment
    objectui#3832 describes, with the render-site gap tracked in objectui#4163.

  The console's `registry-inputs-spec-parity` suite also drops all twelve of its
  off-spec exemptions, which rc.6 obsoleted at once (objectstack#6776 declared
  `page:header.recordChrome` / `showStar` / `showCopyId`, `page:accordion.variant`
  and `page:tabs.tabStyle`; objectstack#5775 declared the `element:record_picker`
  trio and `children` on the four page containers). The forward direction of that
  gate now runs with no cover of any kind.

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

- d6e5124: An action rendered in the overflow menu, as an icon or inside a group now reaches the runner carrying the same authored keys as the same action rendered inline — `action:menu`, `action:icon` and `action:group` forward `label` and `description`, and the two group/icon surfaces also forward `resultDialog`.

  Every action renderer hands the `ActionRunner` an explicit key WHITELIST rather than the action itself. That is deliberate — a key no renderer honours must not look wired — but the whitelists had drifted, and which renderer a given action gets is decided by `action:bar`'s `maxVisible` split (3 on desktop, 1 on mobile) and by `systemActions`, which are always in the overflow menu. So the same declared action behaved differently depending on the viewport.

  `label` and `description` are what the console's param-collection handler titles its dialog from (`title: action?.label || action?.title`, `description: actionDescription(…, action?.description)`). Dropped, an action with declared `params` opened a dialog titled "Action parameters" while the SAME declaration rendered inline named itself "Create Environment". `resultDialog` is the one-shot reveal spec (a fresh 2FA code, a newly minted OAuth secret): dropped, the runner falls back to the success toast and the value the user was meant to copy is gone — the objectui#3646 defect, still live on two of the four declared surfaces.

  `undoable` and `recordIdField` are deliberately NOT added. Both are read only under a `rowRecord` guard, and `rowRecord` is `params._rowRecord`, written exclusively by the spread-based hosts (`DeclaredActionsBar`, `RelatedRecordActionsBridge`, `ObjectGrid`, `page:header`), none of which dispatch through these renderers. They are unreachable on this path rather than dropped — `action:button` forwards them here inertly — so forwarding them would have added a second inert copy instead of restoring an affordance.

  A new repo gate, `pnpm check:action-forward-parity`, now derives each surface's owed key set (`authorable ∩ runtime-read − retired`) from the spec's own schemas and the consumers' ASTs and fails when a renderer drops one, so the seventh instance of this class fails on the pull request that introduces it rather than shipping green.

- debad27: An `autoTrigger` action that spills past `action:bar`'s `maxVisible` now still runs — `action:menu` consumes the flag instead of dropping it.

  `autoTrigger` is the client-composed "run this action as soon as a renderer receives it" flag behind deep links like the welcome page's "Create your environment" CTA (#844). It was consumed only by `action:button`. `action:bar` splits its post-gate list at `maxVisible` (3 on desktop, 1 on mobile) and hands the tail to `action:menu`, which had no `autoTrigger` handling at all — so an auto-triggered action that happened to sort past that threshold was rendered as an ordinary "More" menu entry and never ran, while the caller had already spent the one-shot signal it stood for. The `?runAction=create_environment` deep link is consumed by stripping it from the URL, so the measured end state was `urlParam=null execute=0`: no dialog, and no URL left to retry from. Which actions lost their auto-trigger was partly a function of viewport width, since `maxVisible` drops to 1 on mobile, and `systemActions` — always in the overflow menu, whatever the viewport — could never fire one at all.

  The flag's contract is now stated and enforced as "execute once on mount by whichever renderer receives the action". `action:menu` consumes it by EXECUTING, through the same path a click on that item takes; it does not open the dropdown, so a transport flag never moves what the user sees. Consumption happens where the action provably arrives — the menu renderer receiving it — not in the menu items, which Radix mounts only once the dropdown opens and which would therefore have waited on the very click the flag exists to avoid.

  Once-ness has one implementation (`renderers/action/auto-trigger.ts`), now shared by both renderers rather than written twice: a guard ref per rendered action, so re-renders never re-fire it and a flag that flips true later still fires exactly once. Container visibility still governs mounting — a hidden `action:bar` or `action:menu` renders no children and auto-triggers nothing — while the action's own `visible` gate does not suppress the trigger, matching `action:button`'s long-standing behaviour so that a deep link cannot depend on where the bar happened to put the action.

  The `action:bar` split, the inline `action:button` path and #4166's arming pins are unchanged.

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

- d0c3b26: Every plain `<button>` now declares its `type`. HTML defaults an untyped button to
  `type="submit"`, so any of these buttons would submit the form it was composed into
  instead of running its own handler — a real risk for renderers (`drawer`, `tree-view`,
  `navigation-overlay`) whose placement inside a form is a JSON metadata decision. 114
  sites were converted to `type="button"`; no site was a genuine submit button, and the
  DOM is otherwise unchanged.

  The defect class is now closed mechanically by a new `object-ui/button-has-type` ESLint
  rule (error), so the next untyped button fails CI at write time rather than being found
  by a fourth audit round (objectui#4045, closing the objectui#3344 family).

- 4dadf0d: `@object-ui/components` compiles under `noImplicitAny` — the workspace's last strict-relaxing package

  `packages/components/tsconfig.json` carried `"noImplicitAny": false`, the only place in the workspace that relaxed a `strict` sub-flag, under a comment that explained the neighbouring `rootDir` removal rather than the flag itself. `tsconfig.test.json` mirrored the one flag deliberately, so that a test project could not become the compiler of record for a source strictness decision the build config owns. Both now simply inherit `strict: true` from the root config, and the mirror's reasoning is rewritten to record why the mirror is gone rather than deleted silently.

  Turning the flag on reported 26 implicitly-`any` sites in five renderer source files and 2 in the package's own tests, all of which now have real types. Nothing about the runtime changed; every one of the package's 1077 tests passes untouched.

  Two of those signatures were typed by measurement rather than by preference, and both are worth recording:

  The ten `sidebar.tsx` entry points follow the convention the package's other registered renderers already use — an inline `{ schema: <X>Schema; [key: string]: any }` annotation naming the registered component's own schema type (21 occurrences across the renderer tree, against zero uses of `ComponentRendererProps`). Only `'sidebar'` itself has a schema type in the registry map; the other ten registrations are sidebar _parts_ with none of their own, so they take `BaseSchema`, the type every registered node satisfies. Annotating them `SidebarSchema` would have asserted `type: 'sidebar'` on a node whose type is `'sidebar-header'`.

  The action renderers' callbacks are typed from `UIActionSchema`, not the legacy `ActionSchema` those three files import for their declarations. The legacy interface (`crud.ts`, already `@deprecated`) has no `locations`, so the shared `actionRendersAt` placement predicate rejects it outright; its `variant` union has no `'primary'`, the value the objectui#2339 ordering tie-break compares against; and its `type` is the literal `'action'`, while the actions actually flowing through these renderers carry `'form' | 'script' | 'url' | 'flow' | 'api' | 'modal'`. `action:bar`'s own documented example is a `UIActionSchema`. None of this was checkable before, because the props type never reached the callbacks at all: `forwardRef` routes props through `PropsWithoutRef`, whose `Omit` collapses a props type carrying `[key: string]: any` down to the bare index signature, so `schema` arrived as `any` and every callback under it inferred `any` too. The fix annotates each action list once where it enters and lets the `filter`/`some`/`map` chains below infer.

  Graded `patch`: no declaration this package publishes changes shape. The three action schema interfaces and the leaf components whose props moved to `UIActionSchema` are internal — none is re-exported from `src/index.ts`. The `actions?: ActionSchema[]` keys those interfaces still declare remain on the legacy type; reconciling that declaration with the type the implementation actually receives reaches roughly 46 sites across 12 files and is filed separately.

- ae10a01: Console chrome reaches the bundle — the list switcher, the aggregate footer, the dialog a11y fallbacks and the whole Settings namespace screen stop being English on non-English consoles

  Six strings on the two screens a user looks at most were hardcoded English literals rather than bundle lookups, so they stayed English on every non-English console with nothing an app could author to change them. They are not object, field, view or action labels — no key in `TranslationData` reaches them — while the console's own bundle already ships zh-CN, ja-JP, es-ES, de, fr, pt, ru, ko and ar and translates hundreds of neighbouring strings. Omissions from an otherwise complete bundle, not a missing capability.

  **Two of the six needed no new keys at all, which is the more interesting half.** The list-view mode switcher named its nine visualizations from a private `VIEW_LABELS` table while `console.objectView.viewType*` — the same nine words — had been resolved through the bundle by the create-view picker for months; the switcher now reads those keys, so the picker's 「画廊」 and the switcher's 「画廊」 cannot drift apart in nine languages. The create/edit dialog's close button is the remainder of a fix that already landed: objectstack#5505 routed the `sr-only` close label through `common.close` for the two Shadcn-synced primitives, but `MobileDialogContent` is a hand-written wrapper outside that regeneration zone with its own close button, and it is exactly what `ModalForm` renders — so the dialog the report measured was the one place still announcing "Close" in English.

  The aggregate footer is the one the original report singled out: the **number** was already locale-formatted and the **prefix** was a hardcoded `Avg: ` / `Sum: `. All eleven aggregation kinds now take their prefix from `grid.summary.*`, and the label/value join is its own key rather than a `': '` baked into the renderer — the separator is translatable content, so zh sets a fullwidth colon and fr the French space-before-colon. The numbers are untouched. The form dialog's `sr-only` description fallback joins the packs too; it is clipped, not visible, so the only way an app could displace it was to author a `description` and thereby put a visible subtitle on every dialog.

  **The Settings namespace screen converts as one unit.** `SettingsView` routed zero framing copy through i18n — save/failure toasts, the env-lock and crypto refusals, the load-error card, the empty-route state, the navigation buttons, the unsaved-changes save bar — while its immediate sibling `SettingsHub`, in the same directory, resolved everything through `t('console.settingsHub.*')`. A zh-CN admin read correctly translated field labels sitting inside an English save bar, because `useSettingsLabel` translates a namespace's authored content but reaches none of the chrome around it. All of it now resolves through a `console.settingsView.*` namespace placed beside the hub's, including the crypto-refusal strings that objectui#4579 deliberately left in English rather than leave one translated string among a dozen literals.

  The save-bar counter was an English plural rule executing in every locale (`change` plus an `s` when the count exceeds one). It is now a real i18next plural family — base key plus `_one` and `_other` in all ten packs — not the `(s)` spelling translated nine ways. The base key is the load-bearing part: i18next asks `Intl.PluralRules` for the one suffix a language needs and, finding no such slot, falls back to English, so without it Russian would read English at counts 2-20 and Arabic at 2-99. Russian and Arabic take the "noun: {count}" form their packs already use for this exact reason, and the counter is verified rendering in-language at 1, 2 and 5.

  The Beta badge reuses the hub's existing key rather than minting a twin, and the refusal messages interpolate their subject through the bundle instead of concatenating a translated word onto an English prefix.

- 4b70d28: data-table row menu — the built-in Edit/Delete predicate parameters are derived from the authoring type, not hand-restated

  One authoring shape (`DataTableSchema.rowEditPredicates` / `rowDeletePredicates`, objectui#2614) had grown four separate declarations in `renderers/complex/data-table.tsx`: the shared `isBuiltinRowActionVisible` gate and `planDataTableRowMenu` each hand-wrote `{ visibleWhen?: unknown }`, and the row-menu ITEM component hand-wrote the full `{ visibleWhen?: unknown; disabledWhen?: unknown }` pair. Nothing tied any of them to the type whose values they receive, so a rename in `@object-ui/types` would have left all four compiling against a shape that no longer existed — the objectui#3009 hand-copy family, in miniature.

  Each one now derives. The planner keeps its deliberate visibility-only subset, `Pick`ed from the very key its caller passes (`Pick<NonNullable<DataTableSchema['rowEditPredicates']>, 'visibleWhen'>` and the delete twin), so the signature still tells the truth about what the function reads while becoming structurally unable to drift from what it subsets. The two consumers that serve both built-ins share one derived alias taken from the union of the twins, so they may only read keys both schema keys declare. Measured: with `visibleWhen` renamed in `@object-ui/types`, the previous hand-written declarations still type-check clean, the derived ones fail to compile.

  No behavior change — no runtime code was touched, and the package's suite passes unchanged. Alongside it, the "a disabled item still counts toward the menu" rule gains the pin it never had where a user meets it: a row whose only action is `disabledWhen`-gated keeps its "⋮" trigger, and that trigger opens the item, present and `aria-disabled`. The two halves of that rule live in different functions, and each half's own test stayed green while the other regressed.

- b4d3c22: `element:button`'s action forward is excess-property checked again — a misspelled key on that payload is now a compile error, not silence

  The payload `element:button` hands to `execute(…)` closed with `as any`. An assertion asks only for comparability, so it switched TypeScript's excess-property (freshness) check off for the whole literal: all sixteen keys the renderer forwards rode unchecked, and `ActionDef` being a closed type (objectui#4046) bought this surface nothing. A typo added to that list — `refreshAftr`, `confirmTxt` — would have compiled, published, and reached a runner that silently does nothing, which is the objectstack#2169 "Mark Done does nothing" shape the closed type exists to prevent.

  The exemption that recorded this assumed the cast was load-bearing, on the reasoning that `element:button` receives a bare `action?: Record< string, any >` prop rather than a typed action, so removing the cast would be a contract change. Measured on TypeScript 6.0.3, that was wrong on the point that mattered: dropping the cast type-checks clean as-is, because every key the literal writes is already declared on `ActionDef`. The prop's type is a separate question and is deliberately untouched here — the forward literal never needed the cast to compile.

  Two literals needed it, not one. The `execute(…)` argument is contextually typed by `execute(action: ActionDef)`, so dropping the cast is enough for the explicit keys. The `paramsPayload` binding spread into it is the second, easily-missed half: a spread source's own keys are not checked _through_ the spread, so `{ actionParams }` / `{ params }` could still invent a key while the payload around them was checked. That binding is now annotated `ActionDef` too.

  Runtime behaviour is unchanged — the object reaching `execute` is identical, key order included, and the emitted `.d.ts` does not move. What changes is that the compiler now rejects an invented key here, verified in both directions: the same probe key produces `TS2353` after this change and no diagnostic at all before it.

  With this surface fixed, `check:action-forward-parity` has no payloads exempt from its freshness rule: all five action-forwarding renderers write into a literal the compiler checks, and the gate's ratchet removed the exemption entry itself as designed.

- bc64bfe: A dependency-gated option list no longer deletes the field's stored value on mount

  The four fixed-option widgets (`SelectField`, `MultiSelectField`, `CheckboxesField`, `RadioField`) end their cascade resolution with a "drop what is no longer offered" effect, and the form renderer runs an equivalent clear of its own over every option field. Both read `resolveCascadingOptions`, which returns an **empty** offered set whenever the list is _gated_ — a declared `dependsOn` parent is still empty. Nothing the field held could be "still offered" against an empty set, so both paths wrote the field empty **on mount, with no interaction**, while the control rendered "Select Country first" beside it: it told the user it could not offer anything, and deleted what they had.

  Gated means **unknown**, not invalid. The cascade clear exists (ADR-0058) so a user-driven parent change prunes a now-invalid child; a withheld list on mount is missing information — the record simply arrived with its controlling field empty (a later-cleared parent, an import, a partially-migrated row) — and that is not a reason to destroy stored data. Both clears now skip while gated, reading the resolver's own `gated` flag rather than re-deriving it from an empty offered set, which would collide with the distinct never-configured case guarded separately in objectui#4220.

  Convergence stays exactly where it belongs: once the parent **is** chosen and the resolved set genuinely excludes the stored value, the prune applies unchanged — including at the moment the gate lifts, so picking a parent whose list does not contain the old value still clears it on that transition. The three states are pinned apart (never-configured / gated / resolved-and-excludes) across all four widgets and the form host, so a future edit cannot collapse them back into one empty-set test.

  Reachable on every host that mounts these widgets with a live record: the form renderer, the grid's inline cell editor, and the detail page's inline editor — where each `onChange` went straight into the record draft the save bar commits.

- 3e19fe7: i18n copy: one ellipsis glyph across the ten packs, `usted` in the es draft-preview empty state, and a pt sentence that stops contracting `de` onto its own hole

  Three locale-copy defects that no gate could see, because all three are _value_ defects on keys whose names, placeholders and key sets were already correct.

  **One ellipsis (objectui#3878).** `en` ended 33 values with three ASCII full stops (`Loading...`, `Ask anything...`) and 110 with the typographic ellipsis `…`, and the nine translation packs had copied `en` value by value — so a user could read both glyphs on one screen: `common.loading` beside `dashboard.loading`, `console.ai.askAnything` beside its own panel's siblings. All ten packs now spell it `…` (U+2026), per the maintainer-authorized consistency pass registered on objectstack#6015. 312 pack values changed: 34 in `en` (the 33 trailing plus the one mid-sentence `collaboration.commentPlaceholder`) and 278 across the nine. Eleven inline `defaultValue` call sites were re-synchronised with the new `en` text, which `scripts/check-i18n-call-site-keys.mjs` requires byte-for-byte.

  The convention is now pinned so the split cannot regrow: `packages/i18n/src/__tests__/ellipsis-glyph-3878.test.ts` fails, by key name, on any value in any of the ten packs that holds three ASCII full stops. It is deliberately wider than "a trailing `...` in `en`", because the census showed the narrow rule would have shipped with two holes in it — `collaboration.commentPlaceholder` puts the ellipsis mid-sentence, and `list.loading` had the packs wrong while `en` was already right, which no `en`-only rule can see.

  Fifteen module-local **no-provider fallback** entries were moved with the packs, across `useCollaborationTranslation`, `useFieldTranslation`, `useDetailTranslation`, `ObjectGrid`, `KanbanImpl`, `data-table` and `ConnectionStatus`. Those maps exist to render when no `LocalizationProvider` is mounted, and each one's own docblock requires it to stay byte-identical to the `en` pack — a requirement objectui#3440 already enforces mechanically for the collaboration map. Leaving them behind would have made the provider-less path disagree with the provider path on ten keys.

  **es `usted` (objectui#3875).** `preview.empty.notReadyDescription` said `Revisa la conversación` — the tú imperative — in a namespace that is otherwise 23:1 usted, and it renders _underneath the usted draft-preview banner at the same moment_, not before or after it. `Revisa` → `Revise`; nothing else in the sentence carries a register. The neighbouring `approvalsInbox` namespace is legitimately tú and was left alone.

  **pt contraction (objectui#3877).** `ConcurrentUpdateDialog` splits `detail.concurrentUpdateDescription` on `{{field}}` and renders a bolded label in the gap, and pt left a bare `de` in front of that gap. When the multi-field conflict branch passes the record label (`este registro`), Portuguese users read `de este registro` — a contraction error every native speaker sees, and one that no spelling of the leaf value could fix (`deste registro` renders `de deste registro`). The pt sentence is rewritten so the hole is preceded by the verb `afeta` instead of any preposition, which closes the whole class rather than trading `de` for an `em` or `a` that contract just as hard. pt only; `en` is unchanged.

  No behavior, no keys added or removed, no placeholder changed.

- 45e1949: Numbers render in the user's locale, and a `Field.number` year is no longer `2,026`

  Every numeric field the console rendered went through an `Intl.NumberFormat` built with the locale hardcoded to `en-US` and `useGrouping` never set. Two defects rode in that one construction: a `zh-CN` or `de-DE` console still grouped and pointed decimals the US way, and a four-digit **year** stored as `Field.number({ scale: 0 })` rendered as `2,026` — in every locale, with no field property able to turn it off. Apps had been converting year columns to `Field.text` to escape it, permanently trading numeric comparison, range filters and dataset dimension types for a display detail.

  The construction had been copied into five places — the number cell renderer, the currency cell renderer, the `CurrencyField` widget, the compact `formatNumber` helper, and the dashboard `MetricWidget` — so fixing any one surface never changed the answer. They now share one formatter, `formatDisplayNumber` in `@object-ui/i18n`, which owns the locale and the grouping policy together, plus one locale resolver, `useDisplayLocale`.

  `useDisplayLocale` composes the two locale channels this repo already had rather than adding a third: the tenant's regional default (`useLocalization().locale`, ADR-0053) when an org has configured one, otherwise the active UI language (`useObjectTranslation().language`) so grouping and decimal marks follow a language switch. That second step is what covers the case the report was measured in — a fresh database, where the tenant localization endpoint has no locale to give.

  Grouping is now suppressed when a field declares `scale: 0` and carries no currency, which is what makes years, fiscal periods and other ordinals render plainly. This is an **interim default** with an accepted cost: a large scale-0 _count_ loses its separators too. It holds only until the spec gains an authorable presentation hint, which is being specified separately, contract-first; when that lands it overrides this heuristic.

  Three surfaces deliberately keep their separators, because a zero-decimal display there does not come from a field declaration: the dashboard `MetricWidget` (its decimals are parsed from a numeral.js format pattern, and its own contract calls the separators load-bearing — "`1,930,000` not `1930000`"), the `element:number` aggregate renderer, and every currency path including amounts whose currency code could not be resolved. An **undeclared** `scale` also keeps grouping — absent means "decimals unknown", not "integer".

  `formatCurrency`, `formatCompactCurrency` and `formatNumber` each take a new optional trailing `locale` argument. Existing calls are unaffected; omitting it now follows the runtime default rather than forcing US conventions.

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

- bfdf3d4: `element:record_picker.filter` is now discoverable from the published `inputs`

  The fourth A-class gap of objectui#3808's own list, and the one its three-way
  triage dropped: `filter` appears in that issue's raw key dump for this block and
  then in none of its A / B / C lists, so the change that added the repo-wide
  parity gate exempted it by name instead of declaring it. It is the same shape as
  the four #3808 fixed — `@objectstack/spec` declares
  `ElementRecordPickerProps.filter`, the renderer has read it all along
  (`composed?.filter ?? props.filter`, straight into the picker query's `$filter`),
  and the registry `inputs` never mentioned it.

  `element:record_picker` is not in the public tier ("record picking is a field
  widget, not a page block"), so the gap was not in `sdui.manifest.json` — it was
  in the JSX-page compiler's prop whitelist, which `renderers/layout/page.tsx`
  builds from `getKnownTypes()` plus these same `inputs`. A JSX page writing
  `filter` therefore got an `unknown-prop` warning from `sdui-parser`'s prop walk
  on the very key that decided which records the picker offered, and the designer
  panel gave an author no way to discover the key existed at all.

  The description is derived from what the renderer does, not from restating the
  spec's one-liner, because the one thing an author cannot read off the spec is
  which of the two places they may write a filter wins: a node-level `dataSource`
  filter (itself AND-combined with any saved `view` it names) is taken and this
  top-level `filter` is DROPPED, not merged — so this key applies only when the
  node carries no `dataSource` filter.

  `type` is `'object'`, taken from the spec's actual shape on the resolved pin
  rather than the `'array'` the issue's landing sketch guessed:
  `FilterConditionSchema` is `z.record(z.string(), z.unknown())` intersected with
  the `$and` / `$or` / `$not` group, so a rule array is rejected. This is the one
  key in the family where `ComponentInput`'s coarse typing costs nothing —
  `sdui-parser`'s `checkType` accepts exactly the values the spec accepts here, so
  unlike `element:text_input.defaultValue` there is no narrowing to disclose.

  The parity gate's explicit exemption for this key is deleted in the same change
  (its own `carries no stale unpublished-key exemption` assertion demands it), and
  the key joins #3808's four in the by-name "declared, not merely not-failing" pin.

- b1e42d0: Conditional required (`requiredWhen`) now decides at SUBMIT time too — the star and the validator can no longer disagree

  A `requiredWhen` predicate that flipped to FALSE after the dialog mounted updated only half the form. The display layer re-evaluated correctly — the asterisk and `aria-required` both disappeared — while submit stayed refused with "<field> is required" and no write was ever issued. The user saw an optional field and a form that would not save, with nothing on screen naming the field it was still waiting on (objectui#4161).

  The cause is not a mount-time snapshot, which is what the symptom looks like. The renderer hands react-hook-form its per-field rules as a `<Controller rules>` prop, and RHF _merges_ that object into the field descriptor it already holds — `_f: { ...previous._f, ...options }`. A rule key that stops being spelled is therefore never removed. Rules could be ADDED live (a predicate flipping TRUE after mount did start enforcing, correctly) but never withdrawn: the `validate.required` entry installed the first time the predicate evaluated TRUE outlived every later FALSE verdict. The validation layer was append-only, latched on the first TRUE the field ever produced.

  The `validate.required` entry is now registered unconditionally and decides required-ness when it _runs_, reading the live verdict the renderer publishes on every render — the same single `resolveFieldRuleState` result that draws the asterisk, not a second evaluation of the predicate with its own copy of the record assembly. Both directions are pinned: a predicate flipping FALSE re-opens submit, a predicate flipping TRUE starts enforcing, and statically required fields are unaffected.

- 3f5f87c: `SchemaRenderer` states its real contract — a typed, required `schema` and a deliberate forwarding surface

  `SchemaRenderer` is the renderer loop: every registered SDUI component is rendered through it. It handed `forwardRef` a props type of `{ schema: SchemaNode } & Record<string, any>`, which puts `string` into `keyof Props`, so `'ref' extends keyof Props` was always true, React's `PropsWithoutRef` took its `Omit` branch, and `Omit` over a type carrying a string index signature keeps only the index signature. Every declared prop was erased. Measured on the pre-fix source: `keyof ComponentProps<typeof SchemaRenderer>` was `string` and `ComponentProps<typeof SchemaRenderer>['schema']` was `any`, while the type argument went on declaring `SchemaNode`. The other half is the same defect seen from the call site — `<SchemaRenderer />` with no schema at all, `<SchemaRenderer schema={12345} />`, and an arbitrary misspelled prop each type-checked in silence. This is objectui#4422 / PR #4438's trap in the most central component in the repo, spelled `Record<string, any>` rather than `[key: string]: any`, which is why every previous sweep's grep and both shipped guards' detector reported the site as clean.

  Graded **minor, not major**, on objectui#4528's reasoning: the type argument has always DECLARED `schema`; the index signature erased it from the resolved type, and restoring what the declaration documents is a fix to the published contract rather than a contract break.

  **The forwarding surface is kept, deliberately.** This component forwards every prop it does not read to the component the schema names, resolved at runtime from a plugin-extensible registry — `packages/react/README.md` documents exactly that, and `@object-ui/components`' form renderer consumes the `onSubmit` it shows being forwarded. Closing that surface would state a false contract and would force every leaf plugin's props into this package. So the two halves are separated: the `forwardRef` type argument is the honest `SchemaRendererProps`, with no index signature for `PropsWithoutRef` to collapse, and the open surface is stated once in an explicit export annotation, which nothing routes through `Omit`. The published `.d.ts` shows the erasure disappearing: `ForwardRefExoticComponent<Omit<{ schema: SchemaNode } & Record<string, any>, "ref"> & RefAttributes<any>>` becomes `ForwardRefExoticComponent<SchemaRendererProps & Record<string, any> & RefAttributes<any>>`.

  `SchemaRendererProps.schema` is declared as `BaseSchema | string | null | undefined` — what this component actually handles. It previously declared `@object-ui/core`'s `SchemaNode` interface, which requires `type: string` and so contradicted the component's own early returns for strings and nullish, while every caller held `@object-ui/types`' wider union. The erasure hid that mismatch completely.

  **One declared behaviour change.** A non-object, non-string primitive schema now renders as its own text. It previously fell through to the shallow copy `{ ...schema }`, which spreads a primitive to an empty object, lost the `type` the renderer then looked up, and surfaced the red "Unknown component type: undefined" box — an accident of the spread rather than a decision. The declared props type excludes `number` / `boolean` so no author is invited to pass them; the runtime handling is defence-in-depth for untyped callers and stored metadata. Strings, `null`, `undefined`, `0` and `false` render exactly as before, and an object naming an unregistered type still gets the error box; all four are pinned.

  Latent defects the erasure had been hiding, each surfaced by the repo-wide type-check and fixed at its call site: `DashboardRenderer` cast its widget schema to `Record<string, any>`, dropping the `type` every branch of `getComponentSchema` sets; `DashboardGridLayout`'s equivalent now states its return type instead of inferring a union that admitted a shape with no `type`; and `ReportViewer` handed a section's `content` array to the renderer whole, so a multi-node section rendered the unknown-component box instead of its content — arrays are mapped rather than widened into the renderer's declared input.

  A repo-wide structural guard replaces the two per-package siblings' blocked direction: it judges every `forwardRef` in `packages/*/src` (219 sites) and its detector resolves `Record<string, …>` and `string`-keyed mapped types in addition to literal index signatures — the spelling the previous detector went blind on. It judges the type argument only, where an index signature is an accidental eraser, and never an export annotation, where one is a stated contract.

- f5e1143: A collapsed sidebar now survives a reload — `SidebarProvider` reads the `sidebar_state` cookie it has always written

  The cookie half of this feature only ever ran in one direction. `setOpen` wrote `sidebar_state` on every toggle with a 7-day max-age, and nothing ever read it back: `SidebarProvider` seeded its state from `defaultOpen` (default `true`), so a sidebar you collapsed came back expanded on the next load with the correct cookie sitting right there, unread. QA measured it at 255px and `data-state=expanded` at +2s, +4s and +8s after load, reproduced three times.

  Upstream Shadcn closes this loop in a **server component** — it reads the cookie there and passes the value down as `defaultOpen`. A pure SPA like the console has no such step, which is why nothing downstream could paper over it: passing a cookie-derived `defaultOpen` from one shell would have fixed that shell and left every other consumer of the primitive broken. The read therefore happens client-side, in the provider, as a lazy `useState` initialiser rather than a mount effect — the state has to be right on the first render, since a post-mount correction would still flash an expanded sidebar at the user.

  Precedence is now pinned, in this order: a controlled `open` prop, then the cookie, then `defaultOpen`, then `true`. The cookie overrides the _default_, never a controlled usage. With no cookie present the behaviour is exactly what it was before, which is what keeps explicit `defaultOpen={false}` call sites — the marketing demos in `apps/site` — rendering unchanged; those cases are controls in the new test file and are green on both sides of the change.

  Only the two values the writer produces are honoured (`"true"` / `"false"`), matched on an exact cookie name; anything else, including an absent or malformed value, falls through to `defaultOpen` rather than inventing a preference the user never expressed. The reader is SSR-safe, which `apps/site` needs: those primitives are `"use client"`, and Next still renders them on the server for the initial HTML, where there is no `document`.

  Because `packages/components/src/ui/**` is regenerated from the Shadcn registry, the primitive itself only gains two anchored one-liners. All of the parsing lives in `packages/components/src/lib/sidebar-cookie.ts`, which the sync never touches, and the two edits are declared in `scripts/shadcn-local-patches.mjs` so `pnpm shadcn:update` re-applies them instead of silently reverting the fix — the same mechanism already used for the translated `Sheet`/`Dialog` close labels.

- 5bf09fd: `ActionParamDialog`'s `select` branch no longer renders a hardcoded English `Select...` placeholder. The fallback used when an action param declares no `placeholder` of its own now reads the existing `common.select` pack key, so it is translated in all ten locales and carries the typographic ellipsis (U+2026) that #3878 converged the packs on. Authored `placeholder` metadata keeps priority, and no locale pack changed — the key was reused from `LookupField`'s identical select-trigger use.
- Updated dependencies [0e67b53]
- Updated dependencies [ceccdcf]
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
- Updated dependencies [ae10a01]
- Updated dependencies [92876f0]
- Updated dependencies [f279deb]
- Updated dependencies [eb7f586]
- Updated dependencies [e901131]
- Updated dependencies [d9d3463]
- Updated dependencies [2a40f69]
- Updated dependencies [bec3e14]
- Updated dependencies [613b167]
- Updated dependencies [1f9b905]
- Updated dependencies [828549a]
- Updated dependencies [e1ade8f]
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
- Updated dependencies [c0f9a4b]
- Updated dependencies [2459a3e]
- Updated dependencies [ac853ce]
- Updated dependencies [fa51109]
- Updated dependencies [d6aa172]
- Updated dependencies [fe52a04]
- Updated dependencies [d46f9b8]
- Updated dependencies [3f5f87c]
- Updated dependencies [2fea4d2]
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
- Updated dependencies [06915b0]
- Updated dependencies [ff84b05]
  - @object-ui/i18n@17.5.0
  - @object-ui/react@17.5.0
  - @object-ui/core@17.5.0
  - @object-ui/types@17.5.0
  - @object-ui/sdui-parser@17.5.0
  - @object-ui/react-runtime@17.5.0

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

- 794c497: `action:bar` member actions declaring `visible: false` are now hidden instead of rendered

  `action:button` and `action:icon` carried the same truthiness gate objectui#3812
  removed from the member-action leaves — `if (schema.visible && !isVisible)
return null` — so `visible: false`, the most explicit way an author can say
  "never show this", fell into the "no gate declared" branch and the action
  rendered anyway.

  objectui#3812's triage judged the five component-level `schema.visible` gates a
  dormant defensive layer, because `packages/react`'s `SchemaRenderer` evaluates
  `newSchema.visible !== undefined` and hides the node before the component ever
  mounts. Two of the five are not dormant, and this is the difference:

  `action:bar` does not route through `SchemaRenderer`. It resolves each member's
  renderer from the `ComponentRegistry` itself and spreads the whole member action
  onto that renderer's schema, so an author's `visible` on a member arrives as the
  child's own `schema.visible` and lands on the child's gate. `action:bar` is also
  the only gate on that path by design — its `filteredActions` deliberately
  filters on `requiredPermissions` and `actionRendersAt` only, leaving `visible` to
  the member renderer. The path is reachable end-to-end and is now pinned that way
  (registry-mounted `action:bar`, member declaring `visible: false`), so the
  reachability does not have to be argued again.

  Both gates now read the same named definition as the rest of the family,
  `hasDeclaredVisibilityGate` (`!= null && !== ''`) — the invariant objectui#3492
  established for the selection bar and objectui#3758 applied to the row-action
  surfaces. The evaluation entry is untouched and already short-circuits a boolean
  rather than handing it to the CEL engine, which `actionPredicate.parity` pins for
  both the engine and the renderer path.

  Behaviour change surface, deliberately narrow: only an `action:button` /
  `action:icon` whose `visible` is the literal boolean `false` (or another falsy
  non-empty value) changes — from rendered to hidden, which is what the
  declaration asked for. `visible: true` still renders, `''` and an absent
  `visible` are still no gate at all, and no expression-valued `visible` changes
  verdict. `ActionSchema.visible` is `ExpressionInputSchema` with no boolean
  member, so `objectstack build` cannot emit this shape; hand-written view JSON and
  in-process callers constructing action defs can.

  The remaining three component-level gates (`action:group`, `action:menu`,
  `action:bar`'s own) stay as they are — they only ever mount through
  `SchemaRenderer`, which resolves `visible` first, and the overflow `action:menu`
  that `action:bar` synthesizes carries no `visible` at all.

- 993336f: An action declaring `disabled: ''` is no longer greyed out forever (objectui#3842)

  The "is a `disabled` gate declared?" test stopped at `!= null`, missing the
  `!== ''` half of the invariant the `visible` family converged on
  (`hasDeclaredVisibilityGate`, objectui#3492 / #3758 / #3812 / #3823 / #3835). So
  `disabled: ''` counted as a declared gate, and the verdict went to the evaluation
  entry — which reads an empty predicate as "no condition → `true`"
  (`toPredicateInput('')` is `undefined`, `evaluateCondition(undefined)` is `true`).

  The direction is why this half is a defect and the `visible` half was not. On
  `visible`, that `true` means SHOW, so an over-broad "declared" test and a
  permissive empty predicate cancel out and `visible: ''` renders either way. On
  `disabled`, the same `true` means DISABLE — the two mistakes compound, and an
  empty predicate stopped meaning "no gate" and started meaning "permanently
  greyed out". One empty predicate, opposite treatment under two keys.

  Two gates now ask the shared definition instead:

  - `@object-ui/app-shell`'s `DeclaredActionsBar` — the hot one. Its actions are
    SERVER-declared (`objectDef.actions[]`) and its hosts are the approvals inbox's
    record sections, so a `disabled: ''` arriving from metadata (an authoring form
    left empty, a template that rendered to an empty string) produced an Approve /
    Reject button nobody could click, indistinguishable from deliberate metadata.
    objectui#3835 was this same surface failing the other way.
  - `@object-ui/components`' `action:button` — verified to be the same shape before
    it was changed (the issue inferred it from the identical spelling but did not
    probe it): with `disabled: ''` the rendered button carried `disabled=""`.

  **Behaviour change surface, deliberately narrow.** Only `disabled: ''` changes —
  from disabled to clickable, which is what "no predicate" asked for. `disabled:
true` still disables, `disabled: false` and an absent `disabled` still do not, and
  no expression-valued `disabled` changes verdict. One consequence worth naming: on
  `action:button`, an empty `disabled` now falls THROUGH to the legacy non-spec
  `enabled` fallback instead of short-circuiting on the empty predicate, so an
  action spelling both (`disabled: ''` + `enabled: true`) becomes clickable.

  The legacy `enabled` leg of `action:button` was routed through the same
  definition for consistency, and that part is behaviour-preserving by derivation
  rather than a fix: the leg is negated (`disabled = !isEnabled`), so an empty
  predicate's `true` already arrived as "not disabled" — the same verdict "no gate"
  produces. All four shapes are identical under either test; the derivation table
  and the reason no test can distinguish them are written down next to the pins.

  `hasDeclaredVisibilityGate` keeps its historic name at both call sites (the
  objectui#3842 dispatch ruling): the predicate is key-neutral, and one
  implementation behind two names is how a repo grows dialects. Each call site says
  so in a comment.

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

- b5980f4: Action-face member actions declaring `visible: false` are now hidden instead of rendered

  The three member-action gates on the action face asked truthiness —
  `if (action.visible && !isVisible) return null` — so `visible: false`, the most
  explicit way an author can say "never show this", fell into the "no gate
  declared" branch and the action rendered anyway:

  - `action:group` in `display: 'inline'` mode (`InlineActionButton`);
  - `action:group` in `display: 'dropdown'` mode (`DropdownActionItem`);
  - `action:menu`'s items (`ActionMenuItem`).

  These leaves `.map()` the component's own `actions` array, so neither
  `SchemaRenderer`'s node-level `visible` handling nor
  `ActionEngine.getActionsForLocation` (whose boolean `visible` was always
  correct) is in the path — the truthy gate was the only gate.

  All three now read one named definition, `hasDeclaredVisibilityGate`
  (`!= null && !== ''`), and let the declaration itself decide. This is not a new
  decision: objectui#3492 established the invariant for the selection bar, whose
  `hasVisibilityGate` spells out why truthiness cannot answer the question, and
  objectui#3758 applied it to both row-action surfaces. The evaluation entry is
  untouched and already short-circuits a boolean rather than handing it to the CEL
  engine, which `actionPredicate.parity` pins for both the engine and the renderer
  path.

  Behaviour change surface, deliberately narrow: only a member action whose
  `visible` is the literal boolean `false` (or another falsy non-empty value)
  changes — from rendered to hidden, which is what the declaration asked for.
  `visible: true` still renders, `''` and an absent `visible` are still no gate at
  all, and no expression-valued `visible` changes verdict.
  `ActionSchema.visible` is `ExpressionInputSchema` with no boolean member, so
  `objectstack build` cannot emit this shape; hand-written view JSON and
  in-process callers constructing action defs can.

- 8aad9fd: Action-face predicates written against the canonical `record.` root now evaluate

  `action:button`, `action:icon`, `action:menu` and `action:group` gated their
  actions on `useCondition(pred, context)`, which evaluates on
  `new ExpressionEvaluator({ ...scope, ...context })` — and the context each of
  them passed was the row spread flat, or nothing at all. Only the shorthand
  spelling resolved:

  | predicate                    | verdict, before                  |
  | ---------------------------- | -------------------------------- |
  | `status == "pending"`        | evaluates (`action:button` only) |
  | `record.status == "pending"` | throws `record is not defined`   |
  | `data.status == "pending"`   | throws `data is not defined`     |

  `record.` is not a mistaken spelling — it is the canonical one. It is what
  `ExpressionEvaluator`'s CEL path binds (`bag.record` as the record namespace),
  what `evalRowPredicate` binds on the record header, list rows, the row kebab
  and conditional formatting (`record.status` / bare `status` / `data.status`),
  and what the server enforces with. A `visible` that fails CLOSED turns the throw
  into "hidden", so a correctly-authored predicate deleted its own button —
  indistinguishable from the gate having said no. On the fail-soft legs the same
  throw lands the other way: `disabled` greyed a control out for everyone.

  Live rather than theoretical: every declared action on framework's
  `sys_approval_request` gates on `record.viewer.*`, so the whole server-declared
  approval decision set was invisible wherever the declared-action bar rendered
  until objectui#4077 fixed that bar. These four generic renderers carried the
  same binding.

  What changed:

  - all four bind the row the three canonical ways, through one named helper
    (`usePredicateRecordContext`, exported from `@object-ui/react` beside
    `useCondition`), so the action face and the row surfaces answer an author's
    `visible:` the same way;
  - `action:icon` reads the row at all. It evaluated against an empty bag, so not
    even the bare-field shorthand resolved — and its `data` prop was landing in
    the props spread onto the DOM button;
  - `action:menu`'s items and `action:group`'s two leaves receive the row from
    their host, which they previously never got;
  - `action:bar` forwards the row into the overflow menu it builds, not just to
    its inline members. An action's predicate had been answering a different
    question purely because it spilled past `maxVisible` — which on mobile
    defaults to 1, making the verdict a function of the viewport.

  Deliberately unchanged: the evaluation entry and each site's error policy. A
  predicate that genuinely faults still fails closed on `action:button` /
  `action:menu` `visible` and still fails soft on the other legs, exactly as
  before; `toPredicateInput`, `hasDeclaredVisibilityGate` and the empty-predicate
  rules keep their pinned semantics. Binding the row is a separate question from
  what to do when the predicate faults.

  A surface with no row of its own binds nothing rather than an empty record, so
  a host that supplies the row through the ambient predicate scope is not blanked
  out; a row passed explicitly still wins over the scope.

- 0cbdca8: Built-in `select` fields: the form's label, validation message and required state now reach the control

  A hand-written form field `{ name: 'status', label: 'Status', type: 'select', options: [...] }`
  rendered a visible "Status" label that pointed at nothing. Measured before the fix:
  `<label for="…-form-item">` resolved to no element at all, `getByLabelText(/status/i)`
  found zero matches, and the trigger button carried no `id`, no `aria-describedby`, no
  `aria-invalid` and no `aria-required`. Clicking the label did nothing and a screen reader
  announced an anonymous combobox with no field name, no error link and no required state.

  Cause: the built-in `select` branch spread its whole DOM pass-through onto Radix's
  `Select.Root`. Root renders no DOM element of its own, so everything it does not
  recognise is silently dropped — and that is exactly where `<FormControl>`'s Slot puts the
  field's `id` / `aria-describedby` / `aria-invalid` and the renderer puts `aria-required`.
  The pass-through now lands on `SelectTrigger`, the focusable `button[role=combobox]` the
  user and their assistive tech actually operate, with the same two keys deliberately kept
  on Root as in the widget-side fix: `name` (the one key Root consumes — it forwards it to
  the hidden native `select` that takes part in form submission) and `disabled` (Root
  disables trigger, items and hidden select together, so the raw prop must not gain a second
  author). `ref` rides the pass-through too, so react-hook-form can finally focus a built-in
  select.

  This is the built-in half of the same mechanism objectui#3306 fixed on the widget side.
  The two halves diverged because `'select'` is a `BUILTIN_FIELD_TYPES` member: an
  object-driven `field:select` resolves to the registered `SelectField` (fixed since #3306),
  while a hand-written bare `type: 'select'` never consults the registry and kept the
  defect. Both paths are now pinned side by side — the registered path as a positive control
  — so they cannot drift apart again. Which component renders a bare `select` is unchanged;
  only where its host props land.

  Authored `className` on a built-in `select` now reaches the trigger (it previously reached
  no element), composed with the branch's touch-target height rather than replacing it.

- d3e738a: Export `hasDeclaredVisibilityGate` from the package barrel (objectui#3835)

  `hasDeclaredVisibilityGate(visible)` — "did this action DECLARE a visibility gate
  at all?", i.e. `!= null && !== ''`, with the verdict left to the evaluation entry
  — is the single definition objectui#3492 established and PR #3816 / #3825 / #3836
  applied to every member-action gate in this package and in `@object-ui/plugin-grid`.
  It lived module-private in `src/renderers/action/visibility-gate.ts`.

  The family turned out to have a member outside these packages:
  `@object-ui/app-shell`'s `DeclaredActionsBar` gates server-declared actions with
  the same question and had the same truthiness bug (objectui#3835). Exporting the
  one definition is what keeps that fix from becoming a fifth hand-spelled copy of
  it — the drift shape objectui#3142 already had to unpick for `locations` in these
  same files.

  Additive only: one `export` line, no behaviour change in this package. The
  function is pure and dependency-free.

- c3b01a7: Give composite and grouped field widgets a real accessible name: the form renderer now associates its label by IDREF for widgets that declare `labelling: 'group'`, instead of emitting a `<label for>` that nothing labelable answers (objectui#3961).

  Six widgets rendered a visible group label that named **nothing** in the accessibility tree. Measured in a real form, one field per row, reading each label's `for` against the DOM:

  ```
  address      for=…-form-item -> MISSING            byLabelText=0   role+name=0
  geolocation  for=…-form-item -> MISSING            byLabelText=0   role+name=0
  checkboxes   for=…-form-item -> div                byLabelText=0   role+name=0
  radio        for=…-form-item -> div[radiogroup]    byLabelText=0   role+name=0
  rating       for=…-form-item -> div                byLabelText=0   role+name=0
  file         for=…-form-item -> div[role=button]   byLabelText=0   role+name=0
  ```

  Two shapes, one outcome. `address` / `geolocation` spread the host's id onto their first sub-input and then replaced it with that input's own unique id (objectui#3343, correct in itself), so the `for` named an id no element carried — clicking "Shipping Address" did nothing and the group label was absent from the accessibility tree entirely. `checkboxes` / `radio` / `rating` / `file` kept the id, but on a `div`: a `<label for>` on a non-labelable element is inert HTML — `HTMLLabelElement.control` is `null`, so it activates nothing and contributes no name. A screen reader heard "Street Address", "City", "Alpha", "Beta" — never which group they belonged to.

  The fix is the WAI-ARIA group pattern, driven by a DECLARATION rather than by the host guessing at widget DOM:

  - `@object-ui/core` — `ComponentMeta` gains `labelling?: 'control' | 'group'`. Additive and optional; absent means `'control'`, which is every existing component's behaviour.
  - `@object-ui/components` — the form renderer reads it. For a `'group'` field the `<FormLabel>` publishes an `id` and drops its `for`, and the widget receives `aria-labelledby`. The single-control path is unchanged down to the attribute: no id on the label, no `aria-labelledby` key on the widget, so no field acquires a second naming channel. `ui/form.tsx` is untouched (Shadcn no-touch) — both halves travel as ordinary props, since `<FormLabel>` spreads props after its own `htmlFor`.
  - `@object-ui/fields` — the six audited widgets declare `labelling: 'group'`. `address` / `geolocation` move the host id (and only the id) from their first sub-input to the group container; `checkboxes` / `rating` answer a host-supplied `aria-labelledby` with `role="group"`; `radio` keeps Radix's more specific `radiogroup`; `file` takes the name on its dropzone with no invented group layer, because it has exactly one control that merely happens not to be labelable.

  No new key in the widget props contract: `aria-*` is already declared on it and forwarded by `toDomProps`, the same channel `aria-required` (objectui#3290) travels.

  Deliberately unchanged: sub-labels keep naming their own inputs (`aria-labelledby` overrides `<label for>`, so putting the group name on the first sub-input would have replaced "Street Address" with the field name — the concatenated-name outcome this issue rejected), `aria-describedby` stays on the first focusable sub-input where focus can reach it (objectui#3318), the sub-input ids of objectui#3343 do not move, and standalone rendering — the inline grid editor, a bare SDUI node, where nobody hands down an id and there is no host label to point at — emits no role and no IDREF at all.

  A widget that does not declare itself keeps the old `for`, which the label-association tests report as an association resolving to a non-labelable element. Silence was the failure mode being fixed; the default path stays loud.

- 7ed3360: fix(data-table): don't render a row overflow ("⋮") trigger that opens an empty menu

  The row overflow trigger was gated on whether row-action **handlers** were
  supplied (`onRowEdit` / `onRowDelete` / `rowActionDefs`), while the menu's items
  were filtered a second time — per item, per record — against
  `rowEditPredicates` / `rowDeletePredicates` and a custom action's `visible`. On a
  row where every item was predicate-suppressed the trigger still rendered and
  opened an empty box, which reads as a broken page.

  The trigger is now decided by the items that will actually render for that row,
  resolved through the same visibility rule the items gate themselves on, so the
  two cannot disagree. The decision is per row: within one table a row that keeps
  an action keeps its trigger while a row with nothing left renders none. The
  actions cell itself is unchanged, so the column stays aligned with its header.

- 0fa5e4d: The `div` deprecation notice is now reported once per module load, not once per render (objectui#3965)

  `DivRenderer` called `console.warn` on every render. That is invisible on a page
  with one `div` and destructive on a page with many: the docs schema-catalog index
  renders 400+ example thumbnails and emitted ~190 byte-identical notices, burying
  the page's real console errors underneath — the two nested-button errors fixed in
  objectui#3903 / PR #3964 had to be fished out of that flood, and it cost a
  browser-verification run its signal twice.

  The deprecation itself is unchanged: dev builds still report it, the message and
  its migration guidance are byte-identical, and production builds are still
  silent. Only the repetition is gone. The guard is a module-level `Set` keyed by
  type, and the production early-return happens _before_ the set is marked, so a
  production render cannot suppress a later dev-build notice.

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

- ab3ad4f: An empty predicate is no longer a declared gate anywhere (objectui#3850, objectui#3862)

  "Is a gate DECLARED on this key — is there a condition to reach a verdict on?" was
  answered three times in this repo, with three different scopes, and the widest
  answers sat on `disabled`, where the mistake is not benign:

  - `hasDeclaredVisibilityGate` (the action face) asked `!= null && !== ''`, so every
    OBJECT counted — including `{ dialect: 'cel', source: '' }`. That envelope is not
    a hand-written curiosity: `@objectstack/spec`'s `ExpressionInputSchema` normalizes
    every authored predicate into one, so "the author left the predicate empty"
    compiles to exactly it. The verdict path normalized the same value back to
    `undefined`, and `evaluateCondition(undefined)` answers `true` — "no condition, so
    visible/enabled". On `visible` that `true` means SHOW, so the two mistakes
    cancelled; on `disabled` it means GREY, so they compounded: a button disabled
    forever that no author asked to disable (objectui#3850, the residue objectui#3842
    left behind).
  - `SchemaRenderer` asked `disabled !== undefined` inline, one notch wider again, so
    `disabled: null` greyed out too — on the GENERIC rendering path, since that block
    runs for every node type, and not as an internal flag either: `_disabled` is
    forwarded to the component as a real `disabled` prop (objectui#3862).
  - `ActionRunner`'s execution gates asked "does this normalize to something
    evaluable?" — the scope that turned out to be right (objectui#3848 / objectui#3872).

  There is now ONE definition, `hasDeclaredPredicate`, exported from
  `@object-ui/core` (`evaluator/declaredPredicate.ts`, beside the `toPredicateInput`
  normalizer it is derived from): a gate is declared when normalization still leaves a
  condition to evaluate. `''`, a whitespace-only string, an empty-`source` envelope
  and any non-predicate value (`0`, `{}`) are NOT declared; `false` IS (a verdict is
  not a missing gate — objectui#3812). `hasDeclaredVisibilityGate` keeps its name as a
  re-export of it, so the five member-action renderer call sites, `DeclaredActionsBar`
  and `record-quick-actions` are unchanged and inherit the scope;
  `SchemaRenderer`'s `disabled` / `disabledOn` chain and `ActionRunner`'s two gates
  read the same function. No consumer got a local "and also check for empty" test —
  that fourth dialect is what objectui#3842 / objectui#3849 spent two PRs merging away.

  Measured behaviour change, `action:button` and the generic path, before → after:

  | value                                                     | `visible`      | `disabled` | `enabled` | `SchemaRenderer` `disabled` prop |
  | --------------------------------------------------------- | -------------- | ---------- | --------- | -------------------------------- |
  | `''`                                                      | shown → shown  | on → on    | on → on   | forwarded → absent               |
  | `null`                                                    | shown → shown  | on → on    | on → on   | forwarded → absent               |
  | `{ dialect: 'cel', source: '' }`                          | shown → shown  | GREY → on  | on → on   | forwarded → absent               |
  | `{ source: '' }`                                          | shown → shown  | GREY → on  | on → on   | forwarded → absent               |
  | `'   '` (whitespace)                                      | HIDDEN → shown | on → on    | GREY → on | forwarded → absent               |
  | `0` / `{}` (not predicates)                               | shown → shown  | GREY → on  | on → on   | forwarded → absent               |
  | `true` / `false` / bare CEL / `${…}` / non-empty envelope | unchanged      | unchanged  | unchanged | unchanged                        |

  Every row moves toward "there is no gate here", never away from it, and no value
  that HAS a verdict changes it — the verdict is still read from the raw value, only
  the gate in front of it narrowed. Two rows are behaviour changes rather than the
  equivalence the ruling expected, and are pinned as such: the whitespace string moves
  on `visible` / `enabled` (it used to normalize to `'${   }'`, which evaluates falsy,
  so a predicate that says nothing HID the action from everyone), and non-predicate
  junk stops greying controls out (fail-open, the posture `ActionRunner` already
  committed to).

  One blank spelling is knowingly still outside the scope: an envelope whose `source`
  is blank but not EMPTY (`{ dialect: 'cel', source: '   ' }`) — the normalizer folds a
  `source` of `''` and does not trim, so the string spelling of a blank predicate is
  trimmed and the envelope spelling is not, and `disabled` still greys out for that one
  value. The ruling enumerated three empty spellings; this is a fourth, measured and
  filed as objectui#3960 rather than widened in here.

  One chain is deliberately untouched: `SchemaRenderer`'s `visible` / `visibleWhen` /
  `visibleOn` / `visibility` / `hidden` / `hiddenOn` legs keep `!== undefined`, because
  narrowing them would change ALIAS PRECEDENCE, not just emptiness. The `hidden` legs
  are not negated and therefore carry this same defect with the polarity that makes the
  node vanish — measured, out of this ruling's scope, filed as objectui#3955.

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

- e24d767: Record page header action predicates now speak CEL, like every other action surface

  `visible` / `hidden` / `disabled` on a `page:header` action were handed to
  ObjectUI's legacy JS evaluator, while the row kebab, the selection bar and
  conditional formatting have evaluated the identical metadata on the canonical
  CEL engine since objectui#1584 / ADR-0058. Every construct that exists only in
  CEL therefore worked in a list row and threw on the record page — where the
  throw fail-closed hid the button, leaving nothing on screen to notice:

  - method calls — `record.f_tags.size() > 0`, `record.f_textarea.contains("x")`
  - the `in` operator — `'"red" in record.f_multiselect'` (a parse error)
  - stdlib functions — `record.f_date < today()` (`today is not a function`)

  Both header evaluation sites now go through `evalRowPredicate`: the same entry,
  the same bindings (`record.*` + bare field names + `data.*` + the host scope,
  with relations bound as the stored foreign key), and the same fail-closed +
  warn-once semantics as the row surfaces. One predicate on one record now reaches
  the same show/hide verdict in the row menu, the selection bar and the record
  header.

  Legacy-dialect strings are unaffected: `${…}`, `===`/`!==`, `?.`, `??` and
  JS-only methods such as `.includes()` still route to the legacy evaluator (with
  its existing one-time deprecation warning), so authored pages keep working. A
  `${…}` template predicate, which the header previously could not evaluate at
  all, now resolves through that fallback instead of hiding the button. A
  predicate that genuinely cannot be evaluated still hides its action, and now
  reports itself once in the same words the other surfaces use, naming the
  surface, the action and the predicate.

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

- 0ef9dfd: `page:card` publishes `children` instead of the retired `body`, and `page:section` / `page:footer` / `page:sidebar` publish the `children` slot they render

  `inputs` is the published authoring surface, not documentation: the Studio block
  designer builds its panel from it, `sdui-parser`'s `gen-manifest.ts` serializes
  it into `sdui.manifest.json` and `sdui-intrinsics.d.ts`, and the JSX-page
  compiler builds its prop whitelist from it. Two of the `page:*` containers had
  drifted from the contract in opposite directions.

  `page:card` published `{ name: 'body', type: 'slot' }`. `@objectstack/spec`
  retired `PageCardProps.body` in objectstack#5775 (PR objectstack#6281, merged
  2026-08-07, ADR-0087 D2) and declared `children` in its place — one composition
  slot with one spelling, the same one `grid`, `flex`, `page:section` and
  `page:tabs` items already use. The designer was teaching a key the contract now
  rejects by name.

  `page:section`, `page:footer` and `page:sidebar` declared no `inputs` at all, so
  the designer could not authorize the child list those three components exist to
  render. The same upstream PR replaced their `EmptyProps` declaration with the
  shared `PageContainerProps`, whose single key is `children`; all three now
  publish that one slot from one shared literal, mirroring the spec's own single
  definition.

  Rendering is unchanged in both directions. `PageCardRenderer` still READS `body`
  first (`schema?.body ?? schema?.children`) and the three thin containers still
  read `schema?.children || schema?.body`, so documents stored under the old
  contract keep rendering until the ADR-0087 D2 conversion rewrites the key at
  load time — a back-compat read is not a second authorable spelling, the same
  split the `page-header-subtitle-alias` sequencing established. No validation
  verdict moves either: `children` is already in `sdui-parser`'s `BASE_PROPS` (so
  it was never an `unknown-prop`), `isContainer: true` was already set on all
  four, and `codegen.ts` filters `slot` inputs out of the generated `.d.ts` where
  `SduiBaseProps.children` types it.

  What changes for an author is the designer surface: `body` is no longer offered
  on `page:card`, `children` is, and the three thin containers gained an
  authorable content slot.

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

- 54233b1: Record detail pages: a header ⟳ that refreshes the record, its related lists and its tab counts in place — no browser reload

  Concurrent-editing scenario from the shop floor (MES work orders): operator A sits on a record's detail page while operator B starts or reports the same order. A had no way to see the new state except F5, which throws away the open tab, the scroll position and any in-progress inline edit along with the stale data.

  The pipeline for this already existed — the objectui#2269 invalidation bus refetches every mounted reader in place, and `RecordContext.refresh` had been declared for it — but nothing produced that field and no UI reached for it. Three changes give it a trigger:

  - **`RecordDetailView` produces `RecordContext.refresh`**, publishing `notifyDataChanged({ objectName: '*' })`. The wildcard is deliberate: a user reaches for refresh because of a write made by SOMEONE ELSE, which this client never saw and therefore cannot attribute to particular objects. `'*'` marks everything mounted as stale, so the main record, every related child list and the tab-count badges all refetch — no remount, so tab / scroll / draft state survive. First phase covers the standalone record route; embedded hosts (list drawer, split-pane preview) keep their existing chrome unchanged.
  - **`page:header` renders the ⟳** at the far end of the header row when — and only when — the host provides `refresh`. It is page chrome rather than a header action, so its position is the same on every record page regardless of which business actions the object declares, and it can never be collapsed into the `⋯` overflow. Styled as that `⋯` trigger's twin so the row reads as one button family. Its accessible name and tooltip come from the existing `common.refresh` key, so the icon-only button is not English-only in the other nine locales. The icon spins for a short floor after a click, because the bus is fire-and-forget and a warm backend would otherwise finish before the click looked like it landed.
  - **`RelatedList` accepts the `'*'` wildcard** on the legacy `objectui:related-changed` event, matching what `dataChangeMatches` already does for the bus's own readers. This listener compared the payload's object name to its own, so a wildcard invalidation reached everything on the page except the related lists — a concrete foreign object name is still ignored.

  Hosts that provide no `refresh` render exactly as before.

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

- Updated dependencies [8aad9fd]
- Updated dependencies [6719877]
- Updated dependencies [56ff091]
- Updated dependencies [7864f03]
- Updated dependencies [d229dfa]
- Updated dependencies [4bc6c23]
- Updated dependencies [c3b01a7]
- Updated dependencies [f5f8744]
- Updated dependencies [69becd2]
- Updated dependencies [5e52495]
- Updated dependencies [b750823]
- Updated dependencies [5bfaabd]
- Updated dependencies [e06810e]
- Updated dependencies [ab3ad4f]
- Updated dependencies [c2fd122]
- Updated dependencies [ac2139c]
- Updated dependencies [b14ab3a]
- Updated dependencies [8c60819]
- Updated dependencies [e64a52e]
- Updated dependencies [844d17f]
- Updated dependencies [48132f7]
- Updated dependencies [4dcd52a]
- Updated dependencies [42ae5c6]
- Updated dependencies [1d723e3]
- Updated dependencies [0109f54]
- Updated dependencies [7e5bb5d]
- Updated dependencies [fbc23e0]
- Updated dependencies [6d762da]
- Updated dependencies [d11996e]
- Updated dependencies [e6fdbdc]
- Updated dependencies [f9faa7d]
- Updated dependencies [6bb454a]
- Updated dependencies [523be48]
- Updated dependencies [7e2b7e9]
- Updated dependencies [33526fd]
- Updated dependencies [32413ec]
- Updated dependencies [c1e1e6b]
  - @object-ui/react@17.4.0
  - @object-ui/core@17.4.0
  - @object-ui/i18n@17.4.0
  - @object-ui/types@17.4.0
  - @object-ui/react-runtime@17.4.0
  - @object-ui/sdui-parser@17.4.0

## 17.3.0

### Minor Changes

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

- 56409c2: Field widgets are finally told when their field fails validation, and the props
  slot that carries it takes the name the published contract gives it
  (objectui#3222).

  **Breaking** for anyone implementing a field widget (see migration below). The
  repo version policy keeps this a `minor` — objectui's major tracks
  `@objectstack`'s — so read the bump as "breaking within objectui".

  ## The a11y defect this fixes

  `@objectstack/spec/ui`'s `FieldWidgetPropsSchema` — the published contract that
  third-party and AI-authored field widgets are written against — has always
  declared `error?: string`. `@object-ui/fields` declared its own slot as
  `errorMessage`. That looked like a naming split; it was worse:

  ```
  producers of `errorMessage` anywhere in packages/ + apps/ :  0
  reads of `errorMessage` in packages/fields/src            : 15  (7 widgets)
  reads of `props.error`                                    :  0
  ```

  The slot was dead under BOTH spellings. No host ever passed it: the form
  renderer showed validation text through its own `<FormMessage/>` and never
  forwarded the prop. So `EmailField`, `CurrencyField`, `UrlField`,
  `RichTextField`, `PercentField`, `TextAreaField` and `PhoneField` each computed
  `aria-invalid={!!errorMessage}` from a value that was `undefined` forever —
  **`aria-invalid` had never once been set, and a screen reader was never told
  the field had failed validation.**

  Worse than "never set": `<FormControl>` is a Radix `Slot` that hands its child a
  CORRECT `aria-invalid`, but a widget's own attribute is written after the props
  spread, so it wins. Those seven widgets were actively overwriting the right
  answer with `false`.

  FROM: `renderFieldComponent` received no validation state, and the widget props
  type declared `errorMessage?: string`, which nothing produced.
  TO: the form renderer passes react-hook-form's `fieldState.error?.message` down
  as `error` when it renders a registered widget, and the props type declares
  `error?: string`. Both ends of the contract are live for the first time; a
  rename alone would only have swapped one dead key for another.

  ## Migration for widget authors

  ```diff
  -export function MyField({ value, onChange, field, readonly, errorMessage }: FieldWidgetComponentProps< string >) {
  -  return <Input value={value} aria-invalid={!!errorMessage} />;
  +export function MyField({ value, onChange, field, readonly, error }: FieldWidgetComponentProps< string >) {
  +  return <Input value={value} aria-invalid={!!error} />;
  ```

  No alias is kept. `errorMessage` was retained nowhere on purpose — a tolerant
  second spelling is exactly the de-facto second contract AGENTS.md #0.1 forbids,
  and it is what would let a missed call site go quiet again. Because
  objectui#3221 had already removed the type's `[key: string]: any`, every missed
  site is a compile error rather than a silent `any`, so the compiler — not grep
  — validated this rename.

  ## Responsibilities are split, not duplicated

  The widget consumes `error` **only** to drive `aria-invalid` on the control it
  renders (which only it can do — `aria-invalid` has to sit on the input element).
  The message TEXT stays with `<FormMessage/>` in the form renderer. A widget that
  also renders the text double-displays it, and the docs, the agent prompt and the
  tests all now say so.

  For the same reason `required` — also declared by the spec, also never delivered
  — is deliberately NOT lowered into widget props: the required marker has exactly
  one author, the renderer's `<FormLabel>`, and giving widgets the flag invites a
  second asterisk. The a11y state a widget could legitimately carry is
  `aria-required`, which needs no contract change at all (`AriaAttributes` is
  already part of the type and widgets already forward it).

  Builtin field types are unaffected: they render inside `<FormControl>`, whose
  Slot already supplies `aria-invalid`, so `error` is stripped there rather than
  leaking into the DOM as a stray attribute.

  Docs updated to match: `content/docs/guide/plugin-development.md`,
  `skills/objectui/guides/plugin-development.md` and
  `.github/prompts/component.prompt.md` — the last of which additionally used the
  spec's non-generic type alias as a generic (`FieldWidgetProps< number >`) and
  destructured a `mode` prop that exists on neither type.

- 042e09d: **BREAKING (v17)** — field widgets receive their metadata on ONE key, `field`.
  `schema` is removed from the widget contract (objectui#3233).

  ## What changed

  `schema` was a second carrier for what `field` already means. Two producers fed
  it: `SchemaRenderer` passed the authored node as `schema`, and the form
  renderer's `renderFieldComponent` passed `schema={props.field || props.schema ||
props}` _alongside_ `field`. The predictable result was ~30 widgets resolving
  their config as `field || schema` — one concept, two spellings, a de-facto
  second contract (AGENTS.md #0.1).

  - `FieldWidgetComponentProps` no longer declares `schema`. Reading
    `props.schema` is now a compile error, not a silent `any`.
  - Both producers converged. The form renderer passes `field` only. The SDUI node
    → `field` translation happens exactly once, in a new registration adapter
    (`withFieldCarrier`), which every built-in field widget is registered through.
  - All `field || schema` reads in `@object-ui/fields` are now plain `field` reads.

  ## Migrating a widget you wrote

  **Reading the metadata** — replace the fallback with the single key:

  ```diff
  -const config = field || (props as any).schema;
  +const config = field;
  ```

  **Registering a widget** — if your widget can be rendered from a schema node
  (anything `SchemaRenderer` dispatches, not just forms), wrap it once so it still
  gets `field`:

  ```diff
  +import { withFieldCarrier } from '@object-ui/fields';
  +
  -ComponentRegistry.register('color', ColorField, { namespace: 'field' });
  +ComponentRegistry.register('color', withFieldCarrier(ColorField), { namespace: 'field' });
  ```

  `withFieldCarrier` forwards the node **by reference** — nothing is copied,
  narrowed or renamed — and consumes `schema` so it cannot reach the DOM through a
  widget's `...props` spread.

  A third-party widget that still reads `props.schema` and is **not** re-registered
  through the adapter will read `undefined` in v17 and silently render an empty /
  default state. That is the deliberate cost of a major boundary: one contract
  beats N dialects, and a widget that picks the wrong spelling should fail at
  compile time rather than work under one host and not another.

  ## What did NOT change

  - **Host metadata (SDUI JSON) is untouched.** No authored schema changes; this is
    a change to how widgets are _written_, not to what apps declare.
  - **`schema` is still the universal SDUI prop** every registered component
    receives from `SchemaRenderer` (`element:*`, `page:*`, grids, reports). Only
    the _field-widget_ contract retired it. In particular `renderFieldComponent`
    still passes `schema` when a form field type resolves to a plain component
    through the bare-name fallback (e.g. `type: 'text'` reaching the display text
    widget) — that component's contract is the node, and dropping it there would
    render `undefined.className`.

  ## Payload equivalence

  Every path that used to deliver a payload through `schema` now delivers the
  identical object through `field`, and both halves are pinned by tests asserting
  **object identity**, not shape:

  - form path — `packages/components/src/renderers/form/__tests__/form-field-carrier.test.tsx`
  - SDUI path — `packages/fields/src/__tests__/field-carrier-sdui.test.tsx`

### Patch Changes

- 532cf8b: Deliver the required state to the control in the five renderers outside the object form that still painted it as an asterisk only (objectui#3299 — the same defect #3290/#3298 fixed in `form.tsx`).

  Each site converges on the reference shape (`EmbeddableForm.tsx`): the control carries `aria-required={required || undefined}` and the asterisk is `aria-hidden="true"`, so assistive tech announces required once, as a state — instead of hearing a bare "asterisk" folded into the accessible name, or nothing at all.

  - `@object-ui/app-shell` — `ActionParamDialog` (both the boolean row and the default branch, delivered through the real field widgets' `toDomProps` whitelist) and `CreateViewDialog` (display label, machine name, and every type-specific required-field selector).
  - `@object-ui/components` — the custom `ActionParamDialog` (all five typed branches, including the Radix select trigger) and `FieldContainer`, whose existing Slot injection (`id` / `aria-describedby` / `aria-invalid`) now also injects `aria-required`, covering every consumer in one place.
  - `@object-ui/plugin-detail` — `InlineCreateRelated`'s create-tab inputs.

  Deliberately NOT the native `required` attribute (#3290 ruling): each of these hosts runs its own validation, and native `required` would arm the browser's constraint-validation bubble beside it. The SDUI controls that already use native `required` (`renderers/form/{input,textarea,select,checkbox}.tsx`, `basic/text-input.tsx`) are unchanged — they don't have a second validator, so their channel is already correct.

- 680080a: The required state now reaches the input control as `aria-required`, instead of
  existing only as part of the control's accessible name (objectui#3290).

  The form renderer has always computed a correct `required` — the static
  `required` flag merged with the `requiredWhen` CEL verdict — and then spent it
  on exactly one thing: the red asterisk in `<FormLabel>`. That asterisk carried
  `aria-label="required"`, so the only path from the computed state to assistive
  tech was `<label for>` folding it into the control's **accessible name**: the
  field was announced as "Title required".

  A state smuggled through a name is broken three ways:

  - it is read in name order rather than announced as a state, and "list the
    required fields" style navigation cannot see it at all;
  - a field rendered without a `label` (compact layouts, inline grid editing)
    draws no asterisk, so the signal disappears entirely;
  - `requiredWhen` makes required **dynamic**, and a state channel can express
    the flip where a name cannot.

  ## What changed

  - Every field control — built-in (`input` / `textarea` / `checkbox` / `switch` /
    `select`) and registered widget alike — now receives `aria-required="true"`
    when the field resolves required, and **no attribute at all** when it does
    not. Absence rather than `aria-required="false"` is deliberate: it is what
    the `requiredWhen`-turns-false case has to produce.
  - The red asterisk is now `aria-hidden="true"` and no longer carries
    `aria-label="required"`. It renders exactly as before for sighted users; it
    simply stops being announced, so the state is reported once (as a state) and
    not twice.

  **No field widget needed a change.** `aria-required` is already declared and
  typed on the widget props contract (`FieldWidgetComponentProps &
AriaAttributes`) and every widget forwards its leftover props to the control it
  renders, so all 48 widgets pick it up unmodified.

  Two non-changes, both deliberate:

  - **No native `required` attribute.** That would arm the browser's own
    constraint-validation bubble alongside react-hook-form's `<FormMessage/>` —
    two validators, two UIs, one field. `aria-required` reports the state without
    triggering native validation.
  - **No `required` boolean in the widget props contract.** A boolean would give
    the required marker a second author, and the next widget draws its own
    asterisk next to the renderer's — the double-display failure objectui#3222
    already declined for the validation message.

  If you select the asterisk in a test, it is now
  `span[data-required-marker]` — an explicit locator, rather than an
  accessibility attribute doubling as a test hook.

- a7651e6: The form renderer's built-in `select` branch stops saying "No options available"
  in English to non-English sessions (objectui#3263).

  FROM: the inline branch that renders a `type: 'select'` field — the one taken
  whenever the field is a `BUILTIN_FIELD_TYPES` member, i.e. before the `field:`
  registry is consulted — rendered `{emptyHint || 'No options available'}`. TO:
  `{emptyHint || t('fields.options.empty')}`, the same i18n key the registered
  option widgets fall back to (objectui#3231, all ten locale packs).

  This was the last hardcoded copy of that sentence in `form.tsx`, and the file was
  half-translated in a way a user could see inside one widget: the dependency-gate
  sentence next to it already went through `t()`
  (`fields.options.selectFirst`), so under a `zh` session a gated select read
  "请先选择 Country" and the same select — one keystroke later, when the parent
  value matched no option — flipped to English.

  `fields.options.empty` is added to `useSafeFormTranslation`'s defaults map, the
  pattern `fields.options.selectFirst` already follows there, so a form rendered
  with no `I18nProvider` (standalone widget, test, embedded form) produces the
  byte-identical English string it produced before. Both halves are pinned by
  tests: the Chinese rendering in one file, the no-provider English fallback in
  another (mounting a provider installs it as react-i18next's global default,
  which would erase the state the second one observes).

  The box moved from an inline `<div>` into a small `BuiltinSelectEmptyState`
  component in the same file, because `renderFieldComponent` is a plain helper that
  early-returns on the registered-widget path — a hook called there would run
  conditionally. It forwards its rest props, since `<FormControl>` is a Radix
  `Slot` that supplies the control's `id` / `aria-describedby`; a test pins that
  the field's `<label for>` still resolves to this box.

  Deliberately NOT unified with `@object-ui/fields`' `OptionsEmptyState`: different
  package, different render path (inline branch vs. registry). What the two share
  is the i18n key, not a component — merging them would impose one path's markup
  and props on the other.

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

- 34595eb: The Combobox trigger now declares `type="button"` explicitly, so it can never
  submit an enclosing `<form>` (objectui#3344). The current Radix
  `PopoverTrigger` happens to supply `type="button"` through its Slot, but that
  form-safety guarantee was an upstream implementation detail — it is now a
  locally declared, regression-tested contract, matching the explicit style of
  LookupField / MultiSelectField / RatingField. The default sits before the
  trigger pass-through spread (objectui#3318), so a consumer who explicitly
  passes `type` (e.g. `type="submit"`) still wins.
- 9cbcbf4: The form renderer's built-in `textarea` branch reads the fullscreen long-text
  flag on one spelling (objectui#3303).

  FROM: the branch resolved the affordance as `mobile_fullscreen || fullscreen`,
  and both prop strips (`stripRendererOnlyProps`, `stripRegisteredFieldProps`)
  carried a matching entry discarding a `fullscreen` key. TO: a single read of
  `mobile_fullscreen`, with no strip entry left for the alias.

  No runtime behaviour changes for anything that exists, because the second term
  was permanently `undefined`. `fullscreen` had **no producer**: a repo-wide grep
  plus `objectstack`'s `packages/spec` turns up only the unrelated
  feedback/loading overlay property of the same name, never a form field. The one
  real producer is `ObjectForm`, which stamps `mobile_fullscreen` onto long-text
  fields from `ObjectFormSchema.mobile.fullscreenLongText` — the same single
  carrier `TextAreaField` and `RichTextField` read.

  This closes the last member of the convergence run objectui#3232 / #3233 /
  #3245 / #3301 started. The changeset for #3232 named this branch explicitly as
  "a separate live path" still accepting two spellings; it is now single-read like
  the two widgets, so the same authored metadata behaves the same way whether a
  field type resolves to a registered widget or falls through to the built-in
  branch.

  Why a no-producer alias is worth removing rather than leaving as harmless
  insurance: it is not insurance, it is a contract that never held. The renderer
  advertised a spelling to whoever reads it next — very much including an AI
  writing form metadata — and that spelling silently does nothing, with no error
  and nowhere to look. That is the lenient consumer fallback AGENTS.md #0.1
  forbids, and the identical mechanism behind #3245 and #3301. Dropping the strip
  entries matters for the same reason: a key nobody produces should not get a
  dedicated discard, it should be in the ordinary unrecognised-key class, so a
  typo is as visible as any other typo instead of being quietly swallowed.

  Pinned by tests in both places the alias lived: the built-in branch renders the
  expand affordance for `mobile_fullscreen` and not for `fullscreen` (the
  canonical case is asserted alongside the alias case, so the negative cannot pass
  for the empty reason of the affordance having disappeared altogether), and the
  strips are shown to own `mobile_fullscreen` — stripped from the top-level props,
  delivered on `field` — while `fullscreen` is now indistinguishable from an
  arbitrary unknown key.

- 85c4c9c: 表单内置 `textarea` 的全屏编辑对话框现在能拿到字段自己的 label：对话框标题显示字段名而不是恒定的通用词「编辑文本」，同一张表单上多个长文本字段的展开按钮也终于有了互不相同的无障碍名（objectui#3393）。

  `renderFormField` 在解构字段配置时把 `label` 单独取走了（它要渲染 `<FormLabel>`），而下游 `renderFieldComponent` 唯一调用点重建 props 对象时显式补回了 `field` / `inputType` / `options` / `placeholder` / `emptyHint` / `dependsOnLabels` 等等，唯独漏了 `label`。于是内置 `textarea` 分支里的 `label` 恒为 `undefined`，`FullscreenTextarea` 中两条依赖它的分支从写下那天起就没走到过：

  - 对话框标题 `label ?? t('form.fullscreen.title')` 永远落到通用词——一个叫「备注」的字段点开全屏编辑，标题不会说自己是「备注」；
  - 展开按钮的无障碍名永远插值通用名词，一张有三个长文本字段的表单上三个按钮读屏完全一样。读屏用户无法判断自己要展开的是哪个字段，这是可达性缺陷而不是观感问题。

  ## 改了什么

  - 调用点显式转发 `label`（与 `placeholder` / `emptyHint` 同法），这是唯一的行为改动。
  - `label` 属于 renderer-only：`stripRendererOnlyProps` 与 `stripRegisteredFieldProps` 各加一条丢弃项，所以它既不会变成 DOM 上的 `label="备注"` 杂属性（每个内置分支都会把剩余 props 直接摊到 DOM 节点上），也不会成为注册型 widget 新收到的 prop——自 v17 起 `field` 是它们唯一的元数据载体（objectui#3233），label 一直在那里读。
  - 内置 `textarea` 分支里那句 `const { label: _label, ...rest }` 随之删除。它本想拦住 label 落到 DOM，但既然从来没有 label 送进来，它拦的是不存在的东西（ESLint 一直报着 `'_label' is assigned a value but never used`），而且只护住了这一个分支。现在这件事由 strip 统一负责，所有分支同等受护。

  十个语言包零改动：#3272 把 `form.fullscreen.toggle` 做成了带 `{{label}}` 插值的整句（zh 插在句尾、ja 插在句首），label 一通，十个语言的句子直接就对。字段没有 label 时仍回落到被翻译的通用词。

- fd54c3e: The form renderer's built-in `textarea` branch now honours `readonly` / `disabled` on its fullscreen exit, which previously bypassed both (objectui#3400). `renderFieldComponent` destructures `readonly` off its props, so it is absent from the `...rest` each branch spreads; the plain exit put it back as `readOnly={readonly}` plus the read-only tint, the `mobile_fullscreen` exit put back neither. `FullscreenTextarea` then renders three controls — the inline textarea, the expand button, and the dialog's own textarea — of which only the first ever saw a spread prop. So a read-only long-text field was editable in place without even opening the dialog, and a disabled one looked correctly greyed out while its expand button stayed live, its dialog accepted any edit, and "Done" wrote that edit back into form state. Neither is an exotic combination: `ObjectForm` stamps `mobile_fullscreen` onto every long-text field when `mobile.fullscreenLongText` is set without consulting either flag, `readonly` is also resolved at runtime from a `readonlyWhen` CEL rule, and `disabled` is additionally true for the whole form while a submit is in flight — so a submit in progress did not stop a long-text edit either. A read-only field now renders no expand button at all, matching the registered `TextAreaField` path so both renderers give the same metadata the same behaviour; a disabled field keeps the button but disables it. Both states also lock the dialog's textarea and its "Done" button independently, because `disabled` can flip to true while the dialog is already open. Editable long-text fields are unaffected.
- 4eeb932: The form renderer's last user-visible English literals now go through i18n (#3272). The fullscreen long-text editor (`mobile_fullscreen`) was an entire untranslated dialog — title, screen-reader description, `Cancel` / `Done` footer buttons, and the expand trigger's accessible name — rendering English inside an otherwise translated zh/ja/ar form; it now reads the new `form.fullscreen.*` keys, shipped in all ten locale packs.

  **Behaviour change worth reading if you author forms:** `submitLabel` and `cancelLabel` no longer default to the literals `'Submit'` and `'Cancel'` in the renderer. They default to _unset_, and the action bar falls back at render time to `common.submit` / `common.cancel`, so a form that declares no button copy now follows the session language instead of being silently frozen to English. A label you DO declare still wins verbatim in every locale — including an English one under a zh session, and including an explicit empty string (the fallback uses `??`, so `submitLabel: ''` renders a blank button rather than being overwritten). The only forms whose rendered text changes are those that never declared the labels and are viewed in a non-English session — which is the bug. `FormSchema.submitLabel` / `cancelLabel` stay optional strings; no spec or type change.

  Also removed the built-in `select` branch's second `|| 'Select an option'` fallback. The single call site already supplies `t('common.selectOption')`, so the literal was reachable only through an authored `placeholder: ''` — where it replaced the author's deliberate blank with an untranslated English word.

- 53811d1: Associate the label with its control at the two form surfaces where the two were never programmatically connected (objectui#3341 — found while implementing #3299/PR #3340, and deliberately left out of that PR's scope fence as a different class of defect).

  `aria-required` reaching the control (#3299) only fixes the required _state_; at these two sites the control's accessible _name_ was still wrong, because the label pointed at nothing:

  - `@object-ui/plugin-detail` — `InlineCreateRelated`'s create-tab fields rendered a `<label>` with no `htmlFor` beside an `<Input>` with no `id`, and the two were siblings rather than wrapper/child. The field label was unreachable for assistive tech, and clicking the label did not focus the input. The ids are namespaced with `React.useId`, because `field.name` alone is unique only within one instance and a detail page mounts one of these per related list.
  - `@object-ui/components` — the custom `ActionParamDialog`'s `select` branch rendered `<Label htmlFor={param.name}>` but never put the matching `id` on its Radix `SelectTrigger`, so the reference dangled. The textarea / number / date / text branches already set `id={param.name}`; select was the only one that did not.

  `SelectTrigger` renders a `<button role="combobox">`, and `button` is a labelable element, so the plain `htmlFor`/`id` pair is the correct association there — no `aria-labelledby` required. No spec change and no widget-props contract change.

- d915c47: Relation fields (`lookup` / `master_detail` / `user` / `tree`) are now usable in action and conditional-formatting predicates: they bind as the stored foreign key on every surface, and the fields a predicate reads are included in the query projection (#3501).

  Before this, one predicate over one relation field had four different fates, decided by things its author does not control. `$expand` **replaces** the id in place with the whole related record, and a view expands exactly the relations it shows as COLUMNS — so `record.owner == "U1"` was **true** where the column was absent, **false** where it was displayed, and a **fault** where the field was neither displayed nor projected (a list's `$select` was built from its columns alone, and CEL treats an absent key as a fault, not as null). A fault is fail-CLOSED on the row kebab and the selection bar and fail-OPEN on the lenient paths, so the same authoring mistake hid the button from everyone on one surface and showed it to everyone on the next, with nothing on screen to point at either. The server, meanwhile, only ever sees the id — so client and server could not agree, which is the one thing ADR-0036 / ADR-0058 exist to guarantee.

  Two changes close it. `toPredicateRecord` (new, `@object-ui/core`) collapses expanded relation values back to their ids when a record is bound for evaluation — driven by the object's own field types, not by sniffing for an `id` key, so a `json` field that happens to carry one is untouched. It is threaded through `evalRowPredicate` / `resolveConditionalFormatting` (via a new `fields` option), `useRowPredicate`, `partitionBulkRows`, and both `page:header` evaluators, with the object schema supplied by `ObjectGrid` / `ListView` / `ObjectKanban` / the record context. Kanban card formatting is threaded the same way, so a rule cannot match on the grid view of a list and silently never match on its board. Display is unaffected — a detail-page title still renders the related record's name, and the schema-only `kanban-ui` entry point (which has no object schema to offer) keeps using the payload verbatim. `collectPredicateFieldRefs` / `listViewPredicates` (new) harvest the `record.x` / `data.x` references out of a view's conditional formatting, row-action defs, bulk-action defs, promoted object actions and `userActions` overrides, and add them to `$select` — intersected with the object's declared fields plus the platform columns every object carries (`isProjectableField`), because an unknown key is not ignored by every backend. No `$expand` is added: a predicate wants the foreign key, which is what an unexpanded relation already is.

- 825bbe3: The option widgets' "this list cannot be filled" message now has one source, and
  it is translated (objectui#3231).

  FROM: `SelectField`, `MultiSelectField`, `RadioField` and `CheckboxesField` each
  carried their own copy of the empty/gated state, each destructured the declared
  `emptyHint` prop into `_emptyHint` and dropped it, and each rendered a hardcoded
  English literal (`'No options available'`, `` `Select ${…} first` ``) even in a
  Chinese or Japanese session. TO: one shared `OptionsEmptyState` — the host's
  `emptyHint` when it supplied one, otherwise a translated fallback
  (`fields.options.empty` / `fields.options.selectFirst`, added to all ten locale
  packs).

  `emptyHint` was declared, produced by the form renderer and transported, then
  lost three times over — so no registered widget could ever render it. All three
  breaks are fixed, because closing only the last one delivers nothing:

  - `isOptionField` compared the raw resolved type against `'select'` /`'radio'` /
    `'multiselect'` / `'checkboxes'`. Object-derived forms emit
    `mapFieldTypeToFormType`'s prefixed ids (`field:select`), which matched none of
    them, so for every option field coming from an object schema — the normal case
    in the console — the whole cascade block was skipped and no hint was computed
    at all. It now normalizes the `field:` prefix, the same normalization
    `stripRegisteredFieldProps` already applied a few lines below.
  - `stripRegisteredFieldProps` then removed the `emptyHint` key from what was
    left. It is now forwarded to the four cascade option types, alongside
    `dependentValues`. This stays an allow-list rather than a blanket
    pass-through: every other registered widget spreads its leftover props onto a
    DOM node, where an unknown `emptyHint` attribute is a React warning.
  - the widgets themselves discarded it. Keeping it out of the `...props` spread
    was correct; not using it afterwards was not.

  User-visible effect: a dependency-gated option list now prompts with the
  controlling field's **label** ("Select Country first") instead of its raw
  metadata name, in the session's language; an unconfigured list says so in the
  session's language too. The gate sentence is one i18n key shared by the renderer
  and the widget fallback, so the two sides cannot word it differently.

  Untouched: the built-in (unregistered) `select` branch of the form renderer,
  which already consumed `emptyHint`. That is a separate live path.

- 5dd0127: Localize the record-overlay and tab-badge chrome that #5430's sweep left behind (objectstack#5506)

  Four more console-chrome strings were still hardcoded English literals. Unlike
  #5430's set they are not all accessible names — one is visible copy, and one was
  a component **default** that only the console happened to override.

  - `page:tabs`' count badge built its `aria-label` by template literal,
    `` `${formatTabCount(count)} items` ``. The badge renders digits only, so that
    label _is_ the badge to a screen reader — and the English plural was baked in
    with no singular branch at all, so a related list with one row announced
    "1 items". Now `common.itemCount` / `common.itemCountOne`.
  - `NavigationOverlay`'s drag-resize handle (`role="separator"`, no visible label)
    — now `common.resizeDrawer`.
  - `NavigationOverlay`'s `expandLabel` **default**. Hosts may override it and the
    console does, but the default is what every other host ships — and it feeds
    both `aria-label` and `title` of an icon-only button. Now
    `detail.openAsFullPage`, still overridable by the prop.
  - `NavigationOverlay`'s `resolvedTitle` fallback, `'Record Detail'` — **visible**
    overlay heading, not just an a11y name. Now `detail.recordDetail`.
  - The sr-only `SheetDescription`/`DialogDescription` prose
    `Record detail overlay for {title}.`, which existed in three copies
    (drawer / modal / popover) — now one `detail.recordDetailOverlay` key with a
    `{{title}}` placeholder.

  The count badge follows this repo's **two-key** plural convention
  (`detail.reactionCount`/`reactionCountOne`, `detail.relatedRecords`/`relatedRecordOne`)
  rather than an i18next `_one`/`_other` pair: zh/ja/ko have no separate singular
  form, so those packs would legitimately omit the `_one` half and
  `all-locales-key-parity` would read that as a lost key. The formatted count
  (`1.2k`, not `1200`) is interpolated so the accessible name and the visible
  digits never disagree — and because i18next skips its own plural resolution when
  `count` is a string, the two-key scheme stays in charge of the choice.

  Both touched components moved from `useSafeTranslate` to `createSafeTranslation`,
  which carries an options bag (two of the new keys interpolate) and an English
  defaults map. That map is what keeps the provider-less path English, which
  consumers outside this package depend on — `plugin-view`'s `ObjectView.test.tsx`
  and `e2e/live/inline-edit-polish-2572.spec.ts` address this chrome by English
  accessible name with no `I18nProvider` mounted.

  All six new keys are added to all ten locale packs.

- 06632e9: `PageRenderer` no longer renders its own `<h1>` when the page authors a titled `page:header`, so a page has exactly one level-1 heading. Every non-record page used to render the page `title`/`label` as an `h1` _and_ let the `page:header` block render a second one — on the showcase master-detail page both said "New Project + Tasks", producing a broken document outline, a page title a screen reader announces twice, and the same string printed twice on screen. Record pages already delegated the whole title block to `page:header`; that rule now holds for `app` / `home` / `utility` pages too, and it is what the live e2e was reporting as a Playwright strict-mode violation (`getByRole('heading', { name })` resolving to 2 elements, objectui#3434).

  Delegation is deliberately conservative: only a `page:header` whose title renders literal text takes the heading over. A header with no title — or one whose title interpolates to nothing (e.g. `title: '{name}'` with no record in scope) — renders no heading of its own, so the page keeps its implicit `h1` rather than ending up with none. The page-level `description` is unaffected; it is the page's own prose, not a duplicate of the header `subtitle`.

  Author-visible effect: on a page carrying both a `label` and a titled `page:header`, only the header's title is shown (e.g. app-crm's welcome page shows "Welcome to the CRM", not also "CRM Welcome"). Pages without a `page:header` are unchanged.

- a4cff5b: Conditional-rule predicates that fail to evaluate are no longer silent
  (objectstack#5149, appeal 2). `evalFieldPredicate` — the canonical funnel for
  `visibleWhen` / `readonlyWhen` / `requiredWhen`, view-level `visibleOn`, legacy
  `condition`, per-option `visibleWhen`, screen-field predicates and list
  conditional formatting — now logs **one `console.warn` per predicate text**
  when evaluation fails (parse error, unbound identifier, engine fault), carrying
  the predicate source, the engine's failure reason, and the field/rule locator
  the call site provides. Renderer call sites thread that locator
  (`visibleWhen of field 'amount'`), so a broken predicate identifies itself in
  the browser console instead of being indistinguishable from an absent one.

  Verdicts are unchanged: evaluation still fails open to the caller's safe
  default (flipping that default is objectstack#5149 appeal 1, tracked
  separately). Fault-probing callers (`evalRowPredicate`'s fail-closed path,
  `ExpressionEvaluator`'s `throwOnError`) opt out via the new
  `diagnostic.warn: false` and keep their own single diagnostic, so no broken
  predicate ever warns twice.

- 71be406: The close button that the `Sheet` and `Dialog` primitives auto-render now announces itself in the session locale instead of always in English. Both buttons are icon-only (a lucide `X`), so their `sr-only` span is not decoration — it IS the control's accessible name, and upstream Shadcn ships it as a hardcoded English literal. Under zh/ja/es every drawer and modal in the console (~20 `SheetContent` consumers plus every `DialogContent` consumer — ChatDock, ActivityFeed, metadata-admin, AiChatPage, BuildDebugDrawer, PeoplePicker, RecordDetailDrawer, …) announced "Close" to a screen reader. The span now renders `<CloseSrLabel />`, which resolves `common.close` (present in all ten locale packs since objectstack#5430) and falls back to English when no `I18nProvider` is mounted, so existing suites and e2e specs that address these controls by their English name are unaffected (objectstack#5505).

  Because `packages/components/src/ui/**` is regenerated from the Shadcn registry, the edit is not a hand patch that the next `pnpm shadcn:update` would silently revert: it is declared as data in `scripts/shadcn-local-patches.mjs`, re-applied automatically on every sync (including `--force`), and enforced in both directions — `pnpm shadcn:check` now exits non-zero if a declared patch is missing from the file on disk or can no longer be re-applied to current upstream, and an offline test gates the same invariant on every PR.

- 8d8094a: 20 more registered field widgets now announce a failed validation to assistive
  tech: `multiselect`, `radio`, `checkboxes`, `tags`, `lookup`, `master_detail`,
  `user`, `owner`, `file`, `image`, `location`, `object`, `color`, `rating`,
  `code`, `avatar`, `address`, `geolocation`, `qrcode` and `object-ref` carry
  `aria-invalid="true"` on their real focusable control after a validation
  failure, where before the red message rendered while a screen reader was told
  nothing (objectui#3318, the registry-wide gap objectui#3306's sweep measured).

  Each widget follows the objectui#3222/#3306 pattern: the `toDomProps(props)`
  whitelist spread goes onto the control the user actually focuses — the input,
  the lookup trigger button, the radiogroup (`role="radiogroup"` is the
  ARIA-designated carrier for a set of radios), every chip/checkbox/star of the
  composite option widgets, the upload dropzone/button — followed by an explicit
  `aria-invalid={!!error}` computed from the published `error` slot. Wrapper
  `<div>`s never carry the state, and `name` is withheld from non-form-control
  elements (the objectui#3291 leak class).

  `Combobox` (`@object-ui/components`) now accepts standard button attributes
  and forwards them to its focusable `role="combobox"` trigger, giving
  combobox-based widgets an element to deliver `aria-invalid` /
  `aria-describedby` to — the same seam objectui#3306 opened on
  `SelectTrigger`.

  Nine types remain on the objectui#3318 ratchet ledger with their blockers
  documented there (`formula`/`summary`/`auto_number`/`vector` render no
  focusable control; `grid`, `slider`, `signature` need component-level design;
  `filter-condition`/`recipient-picker` deliver in their editable states but
  render a dependency-gate hint with no control in a fresh form).

- Updated dependencies [18cd432]
- Updated dependencies [d915c47]
- Updated dependencies [b71fc92]
- Updated dependencies [65516ba]
- Updated dependencies [94c5b7c]
- Updated dependencies [ca0fa8f]
- Updated dependencies [3889ffb]
- Updated dependencies [5781fb1]
- Updated dependencies [7e2406a]
- Updated dependencies [9e9e9a9]
- Updated dependencies [4eeb932]
- Updated dependencies [5c856ec]
- Updated dependencies [23018cc]
- Updated dependencies [68b6a28]
- Updated dependencies [0554e88]
- Updated dependencies [d915c47]
- Updated dependencies [f44d872]
- Updated dependencies [28b2e65]
- Updated dependencies [509104a]
- Updated dependencies [825bbe3]
- Updated dependencies [6195841]
- Updated dependencies [5dd0127]
- Updated dependencies [a415684]
- Updated dependencies [a4cff5b]
- Updated dependencies [175bd79]
- Updated dependencies [5af2852]
- Updated dependencies [f833d3a]
- Updated dependencies [a6ec93d]
- Updated dependencies [2a9513d]
- Updated dependencies [d22ae31]
- Updated dependencies [c7ed4c3]
- Updated dependencies [2409e1d]
- Updated dependencies [789fe3e]
  - @object-ui/core@17.3.0
  - @object-ui/types@17.3.0
  - @object-ui/i18n@17.3.0
  - @object-ui/react@17.3.0
  - @object-ui/sdui-parser@17.3.0
  - @object-ui/react-runtime@17.3.0

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

- 09d30a4: Stop declaring 18 `@object-ui/auth` / `@object-ui/components` / `@object-ui/react`
  symbols under names `@objectstack/spec` owns (objectui#3159, objectstack#4115
  batch 5).

  **Breaking for importers of all three packages** — six exported names changed,
  because the spec exports the same name for a _different_ thing:

  | package      | was                          | now                      | what the spec's same-named export actually is                                  |
  | :----------- | :--------------------------- | :----------------------- | :----------------------------------------------------------------------------- |
  | `auth`       | `AuthSession`                | `AuthClientSession`      | the SERVER's session record (`{ id, userId, expiresAt: ISO string, token? }`)  |
  | `auth`       | `AuthProviderConfig`         | `AuthProviderOptions`    | an OAuth/OIDC provider registration (`{ id, clientId, clientSecret, scope? }`) |
  | `components` | `FilterCondition`            | `FilterBuilderCondition` | the recursive ObjectQL predicate AST (`$and`/`$or`/`$not`)                     |
  | `components` | `Field`                      | `FieldContainer`         | an object FIELD's metadata and its builder namespace                           |
  | `react`      | `ConflictResolutionStrategy` | `ConflictResolution`     | the metadata-MERGE policy (`error \| priority \| first-wins \| last-wins`)     |

  The `react` rename is the odd one out: the new name is the **spec's own** name
  for the union that hook always used, so it is a re-export rather than a dialect.

  Eleven more keep their names and are now **imported or derived from the spec**
  instead of re-declared: `TenancyPosture`, `DelegableScope` (+`DelegableAdminScope`),
  `AuthUser`, `ShareLinkPermission`, `ShareLinkAudience`, `ShareLink`, `SortItem`,
  `OfflineStrategy`, `OfflineCacheConfig`, `OfflineSyncConfig`, `OfflineConfig`,
  `NavigationConfig`.

  **Three of the copies were losing information, not just duplicating it.**

  - `AuthUser` never declared the spec's `positions` or `tenantId` — the
    authorization inputs. Its `[key: string]: unknown` index signature meant the
    omission was invisible at every call site _and_ to any structural comparison
    (the objectstack#4075 mechanism). It now `extends` the spec principal, so the
    display-only fields (`image`, `role`, `roles`, `emailVerified`) are the delta
    and the spec's keys arrive on their own.
  - `useNavigationOverlay`'s copy carried the note _"inline … to avoid importing
    from `@object-ui/types` (which may not be a direct dependency of
    `@object-ui/react`)"_. The vocabulary belongs to `@objectstack/spec`, which
    **is** a direct dependency — the same expired "kept local to avoid a
    dependency" comment objectui#3169 found in `@object-ui/app-shell`.
  - `useOffline` and `usePerformance` both opened with _"Types aligned with
    `@objectstack/spec` v2.0.7"_. The installed spec is 17.0.0-rc.1.

  `ShareLink` derives from the spec row **minus `password_hash`** — omitted rather
  than optional, because it is the credential itself and typing it in a browser
  package is an invitation to render it. `password_protected` (the boolean the UI
  needs in its place) is the one local addition.

  The config types derive from each schema's **input** side, not `z.infer`.
  `useOffline(config: OfflineConfig = {})` defaults to the empty object, which the
  output type — every `.default()`ed key required — would reject outright.

  `@objectstack/spec` moves from `devDependencies` to `dependencies` in
  `@object-ui/components`: its public type surface now references the spec.

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

- f6e8d78: Lookup search inside a create/edit modal is typeable again (objectui#3183).

  In every production console build, the search input of a lookup field's
  quick-select popover — and the nested Record Picker dialog — could not take
  focus while the form modal was open: every click/focus was synchronously
  yanked back to the field trigger, so a lookup could not be searched while
  creating a record.

  Root cause is a race in stock `@radix-ui/react-focus-scope@1.1.16`: the
  focus-scopes stack effect's cleanup schedules `focusScopesStack.remove(scope)`
  in a `setTimeout(0)`. When the effect re-runs for a still-mounted scope (a
  `container` ref flicker), the re-run re-`add`s the scope and the stale timeout
  then evicts it — the dialog's trap listeners stay active but its scope is no
  longer in the stack, so an opening popover pauses nothing and the trap yanks
  focus out of the popover forever.

  Fixed via `patches/@radix-ui__react-focus-scope.patch`: an effect re-run for a
  live scope cancels the pending eviction; a real unmount still runs the full
  delayed cleanup (autofocus-on-unmount + stack removal). Regression-tested in
  `packages/components` with a deterministic reproduction of the race.

- a8ad6c0: A required boolean must be savable in its UNCHECKED state — `false` and `0` are values.

  Reported against an AI-built task tracker whose 任务 object has a required
  `是否完成` boolean: the create form showed the switch OFF, answered "是否完成不能
  为空", and saved instantly once the switch was turned ON. The app could only ever
  create ALREADY-DONE tasks — the one state the control shows by default was the
  one value it refused to save (cloud#972).

  Two defects stacked, and either alone is enough to break it:

  **The `required` verdict read truthiness, not presence.** `@objectstack/spec`
  FieldSchema.required (ADR-0113) is "an insert must provide a NON-NULL value",
  and objectql's record validator implements exactly that. react-hook-form's
  built-in rule instead fails whenever `isBoolean(value) && !value` — its
  accept-the-terms checkbox heritage — silently redefining every required boolean
  as "must be TRUE", including a select whose chosen option value is `false`. It
  also disagreed the other way, letting a whitespace-only string through for the
  server to reject with a 400. The form renderer no longer hands RHF its own
  `required`: the check is now a `validate` entry keyed `required` (so the error
  still surfaces as `type: 'required'`, which the conditional-required cleanup
  keys on) backed by a new shared `isMissingForRequired` in `@object-ui/core`, a
  deliberate mirror of objectql `record-validator.isMissing` — `undefined`,
  `null`, blank-after-trim string, empty array. Deleting the inherited rule also
  stops a `required` that rode in on `validation` from outliving a `requiredWhen`
  that resolved to FALSE.

  **A boolean field held `undefined` while displaying "off".** A two-state control
  has no third state, but a field with no entry in `defaultValues` rendered an OFF
  switch backed by nothing: the create payload omitted the column (it lands null,
  which reads as unchecked but isn't) and the presence check above would still
  refuse it. The form renderer now folds `false` into `defaultValues` for every
  boolean-widget field the caller left unset — in `defaultValues` itself, not
  per-Controller, because that object is also the dirty-check baseline and what
  the defaults-reset window replays. Every surface gets it, including the
  modal/drawer create dialogs that start from a bare `{}`. An authored default
  (or a loaded record, `null` included) still wins.

  `WizardForm`'s cross-step gate had its own copy of the empty-value predicate; it
  now imports the shared one so it cannot drift from the per-field verdict. And
  the field-demo renderer read `schema.defaultValue || schema.value`, throwing
  away an authored default of `false` / `0` / `''` — same falsy-as-empty class,
  now `??`.

  Verified end to end on a local stack against the exact metadata shape
  `apply_blueprint` materializes (`{ type: 'boolean', required: true }`, no
  default): a 是否完成 = 否 task with 工时 = 0 now creates and persists as
  `{ hours: 0, is_done: false }`, turning the switch on still stores `true`, and a
  blank required text is still refused.

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
- Updated dependencies [4a51e77]
- Updated dependencies [ea96284]
- Updated dependencies [d3584c6]
- Updated dependencies [cc70b8f]
- Updated dependencies [a8ad6c0]
- Updated dependencies [444457c]
- Updated dependencies [850033c]
- Updated dependencies [022e4c3]
- Updated dependencies [009e25d]
- Updated dependencies [726b89c]
  - @object-ui/types@17.2.0
  - @object-ui/core@17.2.0
  - @object-ui/react@17.2.0
  - @object-ui/i18n@17.2.0
  - @object-ui/sdui-parser@17.2.0
  - @object-ui/react-runtime@17.2.0

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

- 07de839: fix(notifications): the config, `position` and action `variant` are read instead of forked or ignored (#3014 follow-up)

  The last of the notification contract. After `displayType` (#3071) and `icon`
  (#3076), four gaps of the same family were left:

  - **the config was 3/4 inert** — only `defaultDuration` was ever read.
    `maxVisible` and `stacking` were carried and ignored, while
    `NotificationBanners` capped at a hard-coded `3` of its own;
  - **its field names forked from `NotificationConfigSchema`** — `position` vs
    `defaultPosition`, a renderer-local `stacking` boolean with no spec
    counterpart, and no `pauseOnHover` at all;
  - **a notification could not declare a `position`.** The #3008 parity guard
    asserted the position _vocabulary_ matched the spec while nothing positioned
    anything by it — a guard passing over an unused value;
  - **`NotificationActionButton.variant` was the shadcn Button vocabulary**
    (`default | destructive | outline`) under a spec-shaped name, forking
    `NotificationActionSchema.variant` (`primary | secondary | link`).

  **How positioning resolves now** — `notification.position ?? config.defaultPosition
?? nothing`, and "nothing" is a real answer:

  - **declared** → the surface pins itself there, always. `presentNotificationToast`
    passes it per-toast so the contract wins over the container;
  - **undeclared** → the surface keeps its own anchor (a snackbar's bottom edge) or
    defers to the host's toast chrome.

  That asymmetry is the design decision. The host's sonner container also serves
  toasts that are _not_ spec notifications (the console action runtime's own
  `toast.*` calls), so it stays the fallback authority for placement — never a
  competing one. A declared position a component prop could silently override
  would be the same "validates, then does nothing" shape this whole area is about.
  Hence `defaultPosition` has no fabricated default: "the host didn't say" has to
  be representable.

  Also: `maxVisible` / `stackDirection` now drive every stacking surface through
  one shared `visibleNotificationStack` (cap keeps the NEWEST, stack grows in the
  declared direction); `pauseOnHover` holds a transient notification's timer and
  resumes it with the time it had left, which needed the provider to track live
  timers rather than fire-and-forget `setTimeout`s. Legacy spellings still resolve:
  `position` folds into `defaultPosition`, and `stacking: false` reads as
  `maxVisible: 1` rather than being ignored.

  `onToast` now receives the resolved config as a second argument, so the delegate
  can apply the parts of the contract only it can. Existing one-argument handlers
  are unaffected. The spec-parity guard gained the action-variant vocabulary, the
  one notification enum it did not cover.

- 2a40b5e: feat(notifications): each spec `displayType` gets its own presentation instead of a toast (#3014)

  #3008 closed the **contract** half of this: `NotificationContext`'s union matched
  `NotificationTypeSchema`, and `notify()` materialized the declared type so a
  consumer _could_ branch on it. Nothing did. `NotificationProvider` handed every
  item to the host's `onToast` delegate regardless of type, so an author picking
  `banner` or `inline` got a transient overlay — plausible output, wrong output.

  Each of the five spec types now has a presentation of its own:

  | `displayType` | Presentation                                           | Rendered by                        |
  | ------------- | ------------------------------------------------------ | ---------------------------------- |
  | `toast`       | transient overlay (unchanged)                          | the host's `onToast` delegate      |
  | `snackbar`    | bottom-anchored bar, one at a time, at most one action | `<NotificationSnackbar />`         |
  | `banner`      | page-width strip **in the content flow**               | `<NotificationBanners />`          |
  | `alert`       | blocking acknowledgement dialog, FIFO queue            | `<NotificationAlerts />`           |
  | `inline`      | in place, at the raising surface                       | `<NotificationInline scope="…" />` |

  The four surface components ship from `@object-ui/components` and subscribe via
  `useNotificationsByPresentation(type, scope?)`.

  **Answers to the three questions the issue left open:**

  1. **Banner/inline placement is the host's.** They are not overlays: a banner takes
     space at the top of the content area and an `inline` notification belongs next to
     the thing that raised it. So the context exposes the items and the surfaces
     subscribe, rather than one `onToast`-style delegate positioning everything. An
     `inline` notification carries a `scope` that pairs it with its outlet, so two
     forms on one page don't show each other's messages.
  2. **`alert` is modal-ish but NOT the action system's `ModalHandler`.** That handler
     resolves a page/object, renders it, and reports an `ActionResult` back to the
     `ActionRunner`; a notification alert has no schema, no target and no result.
     Routing it there would mean synthesizing a page just to say "OK". It renders
     through the `AlertDialog` primitive instead — no second action-modal path.
  3. **`snackbar` earns its own component.** It supersedes rather than stacks, anchors
     bottom regardless of the toast position config, and takes at most one action.
     Making it a sonner variant is what "presents as a toast" means.

  **Also fixed:** auto-dismiss now follows the presentation. `toast`/`snackbar` keep
  the transient timer; `banner`/`alert`/`inline` are persistent unless the raiser sets
  `duration` explicitly — a persistent banner used to evaporate on the shared 5s toast
  timer. `dismissible` is honored on the persistent surfaces (an `alert` always keeps
  its acknowledge button; `dismissible: false` only closes the Escape route).

  `onToast` now receives **only** `toast` items. A provider with no `onToast` remains
  the supported store-only mode (a bell reading `notifications`/`unreadCount`), but
  raising one of the other four types with its surface unmounted warns in dev, naming
  the component to mount — that failure used to be silent.

  `NOTIFICATION_PRESENTATIONS` is typed `Record<NotificationPresentation, …>`, so a new
  member in the spec enum fails type-check until its presentation is decided; a parity
  test additionally asserts the table covers `NotificationTypeSchema` exactly and that
  no two types share a surface.

- df613fa: fix(notifications): the spec `icon` is read instead of stored and ignored (#3014 follow-up)

  `NotificationSchema.icon` — "Icon name override" — reached `NotificationItem` and
  stopped there. Every surface drew the severity icon, so an author writing
  `icon: 'rocket'` got the success checkmark. Same shape as the `displayType`
  collapse #3071 fixed: a value that validates, is carried, and renders nothing.

  All five presentations now resolve it through one rule (`notificationIcon`): a
  declared Lucide name — kebab-case or PascalCase — replaces the severity icon;
  anything else falls back to it. That includes the console's sonner toast, so the
  override behaves identically on a toast, a banner, a snackbar, an alert and an
  inline message.

  **The fallback is the interesting part.** `getLazyIcon` degrades an unknown name
  to a `Database` glyph, which is right for a data-shaped schema slot and wrong
  here — on an error notification it swaps a meaningful icon for a meaningless one.
  So the name is checked first, via a new `isLucideIconName` export, and a typo
  costs the author their override and nothing more.

- 0ded602: fix(form): a server rejection that names fields now marks those fields (objectstack#3896)

  The server has always said which field it rejected. `@objectstack/objectql`'s
  validators throw `VALIDATION_FAILED` with `fields[]` — one entry per offending
  field, each with a human `message` — and both the REST layer and the runtime
  dispatcher serve that as a 400 with the entries intact.

  Every form dropped them. The submit handler caught the rejection, ran the
  message through `extractWriteErrorMessage`, and showed **one undirected toast**:
  the user was told something was wrong but not _what_, on a surface that already
  knows how to mark an input — and already does exactly that for client-side
  validation. On a long form the offending field was often off-screen, so "创建"
  appeared to do nothing.

  **Now the two failures behave identically, because they share one
  implementation.** The per-field marking, the toast naming the fields, and the
  scroll-and-focus of the first offender (#2793) were extracted from the
  client-side invalid handler; the server path calls the same function. As far as
  the person filling in the form is concerned these are the same event — only the
  referee differs.

  Three layers, each of which was dropping the detail:

  - **`@object-ui/react`** — new `extractFieldErrors(err)` (exported alongside
    `extractWriteErrorMessage` / `isPermissionError`) normalises the three shapes
    the error can arrive in: a typed `ValidationError` from the ObjectStack
    adapter, the raw `@objectstack/client` error (whose `details` falls back to the
    whole response body, which is where `fields[]` lands), and a hand-rolled error
    carrying `fields` directly — the server duck-types that shape identically, so
    the client must not be pickier than the server. Entries with no usable `field`
    are **dropped rather than guessed at**: marking an innocent input is worse than
    the generic toast.
  - **`@object-ui/data-objectstack`** — `normaliseClientError` now maps a 400
    `VALIDATION_FAILED` onto the `ValidationError` class that has sat in
    `errors.ts` since the package was written, exported and **never once
    constructed**. Its `validationErrors: Array<{ field, message }>` shape was
    already exactly right. `create` also now normalises at all: only `update` did,
    so a rejected insert reached callers as the raw client error — and a create is
    the path that most often trips required-field validation.
  - **`@object-ui/components`** — the form renderer maps the entries onto
    `form.setError` and takes over the failure, **but only when every rejected
    field has a visible input to carry it**. If the server also rejected something
    the form does not render, it falls through to the banner, whose top-level
    message concatenates every field's reason — so the part the user cannot see
    inline is still said out loud instead of silently dropped.

  This also removes the need for the client-side predicate mirroring added in
  #2962: a form no longer has to guess what the server will reject in order to
  warn about it beforehand, and mirrored predicates drift.

  Non-field failures (403 / permission denials / anything without `fields[]`) take
  exactly the path they took before.

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

- 68ef584: fix(test-setup): stop shadowing ten real registrations, and declare page:header's inputs

  `vitest.setup.dom.tsx` re-registered `text`, `email`, `password`, `textarea`,
  `image`, `html`, `avatar`, `select`, `slider` and `grid` by hand — ~380 lines of
  renderer copied out of @object-ui/components — to undo bare-name fallbacks that
  @object-ui/fields and the plugins claimed by loading after it.

  Both sides now register under their own namespace with `skipFallback: true`, so
  nothing overwrites the `ui:` originals and the workaround is obsolete. It was
  not free: the copies carried no `inputs` and no `defaultProps`, so inside the
  test environment four curated public blocks reported an empty configuration
  surface while the real registrations declare one. `apps/console`'s contract
  test reads that registry, so its picture of the contract was fiction for those
  tags — a guard that measures a fixture instead of the product.

  Deleting the block restores what the app actually boots with. Verified: the ten
  tags keep their namespace and canonical type, and their declared surface comes
  back — `text` 1 input, `email` 6, `password` 6, `textarea` 6, `image` 3,
  `html` 1, `avatar` 4, `select` 6, `slider` 5, `grid` 7, plus `defaultProps`.
  The heavy DOM setup also got roughly twice as fast (~545s to ~235s of setup
  time across the suite), since every file in that project was paying to evaluate
  the duplicated renderers.

  With the shadowing gone, `page:header` was left as a genuine gap: a curated
  public block whose renderer reads `title`, `subtitle`, `actions`, `breadcrumb`,
  `recordChrome`, `showStar` and `showCopyId`, with none of them declared. Now
  declared.

  `element:divider` keeps zero inputs on purpose — its renderer reads only
  `className`, so there is nothing to author.

- c769d3d: fix(form): a `defaultValues` change no longer discards the field the user is filling

  The form renderer adopts a changed `defaultValues` with `form.reset()`, which
  replaces the **whole** react-hook-form record — so it also blanks the fields the
  incoming defaults say nothing about. And it runs in a **passive effect**, one
  commit after those fields have been committed and painted, so input landing in
  that window was silently dropped.

  The caught case is the wizard (objectui#2982). It reuses ONE inner form across
  steps and feeds it `defaultValues={formData}` — the merge of the steps submitted
  **so far** — so at every step boundary the incoming defaults are missing exactly
  the fields now on screen:

  ```
  RESET to {"name":"Alice"}   (values before: {"name":"Alice","note":"hello"})
  -> create POST {"name":"Alice"}   — the last step is gone
  ```

  In a browser this needs a busy main thread plus typing on the first frame after
  the new defaults arrive — unlikely by hand, but paste and autofill land in a
  single tick. The same shape had already bitten once before, as a `reset()` on
  `defaultValues` **identity** churn wiping input mid-interaction; comparing by
  value fixed that, and this is the residual hole where the value genuinely did
  change.

  The reset now carries such a value across instead of dropping it. Deliberately
  narrow: only a field the **caller has never carried** — absent from both the
  outgoing and the incoming defaults — and whose value the user actually changed
  is eligible. Wherever the caller has an opinion it stays authoritative, so the
  load-bearing paths are unchanged:

  - an edit-mode record landing after first paint still fills every field it names
    (a field the user has NOT touched is empty-ish against the baseline, using the
    same comparison the dirty check uses, so a widget normalizing its own empty
    value on mount is not mistaken for input);
  - a `recordId` swap still replaces the record outright — drawer/modal/split
    forms re-fetch without re-entering their loading branch, so record B lands in
    the still-mounted form and must not inherit an abandoned edit to record A;
  - a field the caller withdraws from its defaults stops being the user's.

  A reset that carries input now also reports the form as dirty (it is, against
  the caller's defaults) instead of unconditionally announcing pristine, so a
  host's discard guard keeps hearing the truth.

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

- c735bf7: fix(form): a spec-vocabulary field no longer crashes the standalone form, and every surface now says which vocabulary you meant — #3090

  Writing the regression test against the unfixed renderer proved the failure
  was worse than the assumed silent drop: a `{ field: 'x' }` entry (spec
  form-VIEW vocabulary) slipped past the `f?.name` guards into a
  react-hook-form Controller with `name === undefined` and crashed the whole
  standalone form on `name.split('.')`, with nothing naming the culprit entry.
  The renderer now partitions such entries out — the rest of the form renders —
  and surfaces them with an inline alert plus a console.error whose text is the
  fix instruction (rename to `name`, or use an object-bound form whose sections
  accept the spec shape).

  `objectui validate` grows the same boundary awareness: on failure, a
  `{ field: … }` entry in a standalone form gets a "likely cause" hint naming
  the real fix instead of the bare `invalid_union` — the previous message read
  as "bolt a `name` on", which converts spec metadata wrongly. On success,
  mixed-vocabulary entries (`name` + string `field`) get a warning: they
  validate, but the spec key is dead weight the renderer ignores.

  `normalizeSectionField` warns (once per site) when an authored section field
  mixes both identity keys — the spec branch derives the runtime name from
  `field`, so an authored `name` was silently overwritten.

- 02aef0c: fix(sdui): a `kind:'html'` page can use lazily-registered blocks, and recovers when one registers late

  objectui#2953 had a twin one tier over, unreported. The whitelist a
  `kind:'html'` page's source compiles against was built from `getAllTypes()` +
  `getConfig()` — both loaded-only — so any block registered via `registerLazy()`
  was rejected as _"not an allowed component"_.

  The blast radius is worse than the react tier's. There, a missing block cost one
  identifier; here a compile diagnostic fails the **whole page**, so a single
  `<object-kanban>` replaced the entire page with `HTML page failed to compile (2)`.
  And it never recovered: `layoutElement` was memoised on `[schema, pageType]` with
  no registry signal, so the cached error panel outlived the plugin actually
  landing — permanently broken for the session.

  `ComponentRegistry` gains three lazy-aware reads:

  - `getKnownTypes()` — loaded registrations **plus** pending lazy stubs, deduped.
    The set a whitelist or manifest should be built from. `getAllTypes()` keeps its
    loaded-only meaning ("what can render right now") and now says so.
  - `getMeta(type, namespace?)` — metadata from the loaded registration, else from
    a pending stub. `getConfig()` stays loaded-only, since callers read
    `.component` off it.
  - `getVersion()` — monotonic counter of changes to the known set, bumped on
    register / unregister / registerLazy. A cache key that a type _count_ cannot
    substitute for: one registration plus one unregistration leaves the count
    untouched while the set changed.

  `getJsxManifest()` builds from those, and `PageRenderer` subscribes to the
  registry so a page that could not compile retries when the registry grows.

  A stub carries no `inputs` yet, so its props surface as `unknown-prop` warnings
  rather than errors — the page compiles and renders, and the inner
  `SchemaRenderer` triggers the loader and swaps in the real block. Authoring-time
  prop validation is unaffected: `sdui.manifest.json` is generated with every
  plugin eagerly loaded, and asserts as much.

- 9a04d25: fix(registry): prefix every namespaced key exactly once, in every namespace

  objectui#3023 fixed eleven `record:*` blocks registered as
  `register('record:x', …, { namespace: 'record' })` — an already-prefixed name
  handed to a registry that prefixes it again, landing the block at
  `record:record:x` — and guarded that namespace alone. Twenty-two more were
  sitting in `action:` (5), `element:` (10) and `page:` (7), two of them
  (`page:header`, `element:divider`) curated public blocks.

  Checking one namespace is exactly what let them keep sitting there, so the
  guard now asks the whole registry rather than a prefix of it.

  Same fix as before: register the bare name and let `namespace` do the
  prefixing, with `skipFallback: true` so the fallback does not claim that bare
  name globally. It would otherwise take over `header`, `footer`, `sidebar`,
  `tabs`, `card`, `accordion`, `section`, `text`, `image`, `button`, `icon` —
  every one of which belongs to `ui:`. All 22 stay reachable exactly as
  `<namespace>:<name>`; the registry goes 522 keys to 500, and the contract is
  unchanged at 42/42.

  Found while probing why six curated Tier B primitives report no `inputs`. They
  do declare them — `vitest.setup.dom.tsx` registers simplified `text` / `image` /
  `html` / `grid` stubs that shadow the real registrations inside the test
  environment only. That shadowing is a separate question, left alone here; the
  doubled keys it turned up are not test-environment artifacts.

- eb4b740: feat(page,element): declare inputs for the eight configurable page:\* / element:\* blocks

  Same gap objectui#3027 closed for `record:*`, in the two namespaces next door:
  renderers that read real props while every authoring surface reported "takes no
  configuration". Declarations mirror what each renderer reads —

  | block                     | inputs                                                                           |
  | ------------------------- | -------------------------------------------------------------------------------- |
  | `page:tabs`               | items, tabStyle (line/card/pill), position (top/left)                            |
  | `page:card`               | title, bordered, body (slot), footer (slot)                                      |
  | `page:accordion`          | items, allowMultiple, variant (flush/card)                                       |
  | `element:text`            | content, variant (heading/subheading/body/caption), align                        |
  | `element:number`          | object, aggregate (count/sum/avg/min/max), field, filter, format, prefix, suffix |
  | `element:button`          | label, action (inline ActionDef), variant, size, icon, iconPosition, disabled    |
  | `element:definition-list` | items, columns, inline                                                           |
  | `element:repeater`        | object, titleField, fields, filter, sort, limit, emptyText, divided              |

  `page:section`, `page:footer` and `page:sidebar` are left at zero inputs on
  purpose: their renderers render `children`/`body` and nothing else — like
  `element:divider`, they are genuinely prop-less containers, and inventing
  inputs for them would be the opposite falsehood.

  `aria` and `className` stay undeclared throughout, per the convention on
  `record:details`: escape hatches and styling pass-throughs, not authoring
  choices. `element:button`'s registration also documents the split against
  `action:button` — inline ActionDef vs a declared action referenced by name —
  so the two stop reading as duplicates.

  Declaration only; no renderer behavior changes. Curation (which of these join
  `PUBLIC_BLOCKS`) is a separate change.

- 5b084eb: fix(sdui): the react page's "no adapter yet" fallback stops churning its provider context

  Audit of the remaining half of `ReactKindPage`'s scope memo, `[schema, adapter]`.
  The `schema` half was the live bug fixed in objectui#2984; this is the adapter
  half.

  **The hosts are fine.** Both `AdapterCtx.Provider` call sites pass a stable
  value — `AdapterProvider` from `useState`, the console preview from a module
  constant — so there is no state loss in the shipped app.

  **One real instance remained**, one layer down: `<SchemaRendererProvider
dataSource={adapter ?? {}}>` minted a fresh object on every render while the
  adapter was still null (the window before the host connects). That is a context
  value, and `SchemaRendererProvider` memoises on its identity, so every block
  inside the page had its schema re-cloned and its expressions re-run on each
  render of the page. Now a module constant, like the `SchemaRenderer` fallback
  it mirrors.

  **The `adapter` dependency itself must stay**, and is now pinned. It looks like
  the obvious thing to optimise away — it is the last remaining trigger that can
  recompile a page and cost its `useState`. But `ReactRunner` hands React the same
  element object while `(code, scope)` hold, and React bails out on an identical
  element reference, so the page subtree never re-renders on its own: recompiling
  is the _only_ path by which a new adapter reaches the blocks inside the page.
  Removing the dependency strands every block on the first adapter forever — no
  error, just a dead data source. `react-page-adapter.test.tsx` pins both
  directions, so the tradeoff cannot be quietly re-litigated.

  Docs: the react-pages guide now states the host-side requirement — an adapter
  constructed inline on every render resets every react page on every render.

- aa1240a: fix(sdui): lazily-registered public blocks reach a `kind:'react'` page's scope, and ReactRunner keeps the errors it catches

  Two defects in the trusted `kind:'react'` page tier.

  **objectui#2953 — the contract skipped lazy blocks.** `getPublicConfigs()`
  resolved every curated `PUBLIC_BLOCKS` tag through `getConfig()`, which reads
  loaded registrations only, so a block registered with `registerLazy()` was
  absent from the contract until its plugin chunk happened to be imported. In
  `apps/console` that silently dropped `object-kanban`, `object-calendar`,
  `object-gantt`, `object-timeline`, `object-map` and `markdown` from every react
  page's scope — writing `<ObjectKanban/>` threw `ReferenceError` even though the
  tag is a first-class contract member, and whether it threw depended on load
  order. `getPublicConfigs()` now resolves pending lazy stubs too, returning them
  with `lazy: true` and no `component` (new `PublicComponentConfig` type); the
  injected wrapper renders through `SchemaRenderer`, which triggers the loader and
  shows its placeholder. `getConfig()` stays loaded-only by design.

  **objectui#2954 — ReactRunner discarded its own error state.**
  `getDerivedStateFromProps` re-transpiled and re-evaluated the page source on
  every render and unconditionally set `error: null`. React runs it before the
  re-render that follows `getDerivedStateFromError`, so the boundary threw away
  the error it had just caught, rebuilt an identical throwing element, and the
  throw escaped past its own `fallback` to the renderer's generic panel; `onError`
  was gated on state that had already been cleared and never fired for a
  compile-time error at all; and each compile minted a fresh page function — a new
  element type — that remounted the subtree and wiped the page's `useState`. The
  transpile+eval is now memoised on `(code, scope)`, errors persist until the
  inputs actually change, and `onError` reports each error exactly once.

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

- 379728f: fix(fields): a `select` no longer wipes itself when its value outruns its options (#2968)

  Radix keeps a hidden native `<select>` mirror so a Select's value takes part in
  native form submission. Assigning a value that mirror has no `<option>` for is a
  no-op — the element stays on `''` — but Radix still dispatches the synthetic
  `change`, so `''` comes straight back out through `onValueChange` and lands in
  react-hook-form on top of the value the caller just set.

  The window is not theoretical: `SelectContent` registers its native options a
  commit AFTER the trigger mounts, so a record that lands after first paint — an
  edit modal whose `findOne` is still in flight — resets the form into exactly
  that gap. Every rendered select came back empty while RHF's `_defaultValues`
  still held the right value. When one of the wiped fields is the one a
  `visibleWhen` predicate reads, the predicate flips back to false, the
  conditional fields hide again and the form **latches** in the broken state:
  pressing Update then fails validation, or submits an empty enum, on a form the
  user never touched. The wipe is also recorded as a user edit, so Cancel prompts
  "discard changes?" on an untouched form.

  `SelectItem` rejects `value=""` outright, so `''` can never be a value the user
  actually picked — it is always the mirror talking. It is now dropped at the
  single `Select` chokepoint, which covers every surface that renders one (object
  form, inline grid editor, action param dialog). Clearing a select still goes
  through `undefined`, which is untouched — the `dependsOn` cascade-clear behaves
  exactly as before.

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
- Updated dependencies [4952edf]
- Updated dependencies [7f0252e]
- Updated dependencies [c4d7b20]
- Updated dependencies [7639a61]
- Updated dependencies [94e63ef]
- Updated dependencies [02aef0c]
- Updated dependencies [6f29aa5]
- Updated dependencies [d21794c]
- Updated dependencies [c4db402]
- Updated dependencies [5319bf1]
- Updated dependencies [49e5671]
- Updated dependencies [b5b97e2]
- Updated dependencies [f59f2c1]
- Updated dependencies [07de839]
- Updated dependencies [2a40b5e]
- Updated dependencies [4874117]
- Updated dependencies [ad0183a]
- Updated dependencies [ce08d55]
- Updated dependencies [32462dd]
- Updated dependencies [aa1240a]
- Updated dependencies [2374a49]
- Updated dependencies [390c071]
- Updated dependencies [d10f526]
- Updated dependencies [2d5d594]
- Updated dependencies [ea7f477]
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
- Updated dependencies [9867281]
  - @object-ui/core@17.1.0
  - @object-ui/react@17.1.0
  - @object-ui/types@17.1.0
  - @object-ui/i18n@17.1.0
  - @object-ui/sdui-parser@17.1.0
  - @object-ui/react-runtime@17.1.0

## 17.0.0

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

- de5e40c: fix(approvals): Approval Center UX pass — badge nowrap, approve confirm, decision progress bar, localized declared actions (#2762)

  - **Badge no longer stacks CJK text vertically (P0-1)** — `Badge` gains
    `whitespace-nowrap` in its base variants (a badge is a single-line pill by
    definition), and the inbox 状态 column gets a minimum width, so 待审批 can
    never render as 待/审/批.
  - **Quick Approve now confirms (P0-2)** — the row's right-edge ✓, the mobile
    card button and the `a` keyboard shortcut all route through a confirmation
    dialog before executing, mirroring the Reject flow; an irreversible decision
    can no longer fire on a stray click.
  - **Decision progress is visualized (P1-1)** — the drawer renders a segmented
    progress bar (ARIA `progressbar`) for `decision_progress`, per-group chips
    get an explicit unsatisfied ○ state next to the satisfied ✓, the eligible
    approver count is spelled out, and the drawer pager now reads
    "Request N of M" so it can't be misread as approval progress.
  - **Declared action labels localize (P0-3)** — `DeclaredActionsBar` resolves
    label / confirmText / successMessage through the `_actions.<name>.*`
    translation convention (metadata literals as fallback), matching
    ObjectView/RecordDetailView; with the `@objectstack/plugin-approvals`
    bundle, the drawer shows 通过 / 拒绝 / 转签 instead of English in a zh-CN
    workspace. New `approvalsInbox` keys shipped in all ten locales.

- 8fb1295: fix(data-table): keep the right-pinned action column HEADER sticky on horizontal scroll (objectui#2784)

  The row-actions column is pinned to the right edge by injecting `sticky right-0`
  into the column's `className`, which reaches both the body cells and the header
  cell. Body cells stayed pinned, but the header cell unconditionally appended a
  `relative` position utility (it anchors the column-resize handle) — and since
  `cn` is `tailwind-merge`, the later `relative` won over the injected `sticky`.
  So the "操作" title scrolled away while its body cells stayed frozen.

  The header now detects a right-pinned column (its `className` carries
  `sticky` + `right-0`), skips `relative` for it (a sticky cell is already its own
  positioning context, so the `absolute` resize handle still anchors correctly),
  and re-asserts `sticky right-0 z-20` after `col.className` so tailwind-merge
  keeps the pin and it stacks above the body's pinned cells (z-10). Left-frozen
  columns, the resize handle, and non-pinned columns are unaffected.

- c19ac11: fix(form): scroll and focus the first errored field on an invalid submit (#2793)

  Submitting a form with a missing required field already toasts the offending field names (#2329), but in a long form the field itself stays off-screen, so the user still hunts for it. react-hook-form's native focus-on-error only reaches fields whose registered ref is a focusable native input — it silently no-ops for custom widgets (lookup / select / master-detail), which is exactly the reported case. The form renderer now disables RHF's unreliable `shouldFocusError` and, in its `onInvalid` handler, scrolls the first errored field (in visual/declared order) into view via its `data-field` wrapper and focuses a focusable control inside it — working for every field type.

- 2f947e4: fix(page,field): consume the spec's `type`/`label`/`maxLength` keys (framework#1878 §3 naming-drift recheck)

  Three forward-drifts where objectui read a different key than the spec
  declares, so authoring the documented key silently no-oped:

  - **page `type` → `pageType`** (app-shell + components): `PageSchema` declares
    the page KIND as `type`, but `PageRenderer` reads `schema.pageType` and fell
    back to `'record'` — and nothing mapped between them. Every non-record page
    (`home`/`app`/`list`/`utility`) rendered with the record max-width, a wrong
    `data-page-type` attribute, and a suppressed header. `PageView` now passes
    `pageType` alongside the SchemaNode discriminator `type`.
  - **page `label` → `title`** (components): `PageSchema.label` is required but the
    region renderer read only `title`. Now dual-reads `title ?? label`, mirroring
    the fallback `DashboardRenderer` already uses. Coupled with the above — the
    header is gated on `pageType !== 'record'`, so both were needed for a title to
    appear.
  - **field `maxLength`/`minLength`** (plugin-form + fields): validation already
    dual-read these, but `ObjectForm`'s HTML-attribute pass and `TextAreaField`
    read `max_length` only, so a spec-authored `maxLength` gave no browser cap and
    no character counter. Both now dual-read, matching `buildValidationRules`.

  Verified in the browser against the showcase: `capability_map` (`type: 'home'`)
  now renders `data-page-type="home"`, the `home` max-width and its page title;
  record pages are unchanged.

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

- c6aaed8: fix(i18n): retire four hand-rolled zh/en branches (objectui#2871, part 1)

  Four surfaces decided their language with a hand-written `startsWith('zh')`
  check instead of the locale packs, so the other eight shipped languages
  silently rendered English and the strings could never be translated without a
  code change.

  - **`RecordTitleChip`** carried a private zh-CN/zh-TW dictionary behind a
    comment claiming "components is i18n-free". That is not true —
    `@object-ui/components` declares `@object-ui/i18n` and its sibling
    `containers.tsx` already uses it. All four of its keys (`detail.copied`,
    `detail.copyRecordId`, `detail.addToFavorites`, `detail.removeFromFavorites`)
    already existed in **all ten packs**, so this deletes ~35 lines and fixes ten
    locales with zero new translations. It renders on every record detail page.
  - **`EnvironmentListToolbar`**'s three state-aware CTA labels move to a new
    `environment.*` namespace. This surface had already regressed once for the
    same reason (#844) and was fixed then with inline `{en,zh}` pairs.
  - **`StudioAiCopilot`**'s dock title moves to the Studio catalog as
    `engine.studio.aiCopilot`.
  - **`StudioHomePage.relativeTime`** now uses `Intl.RelativeTimeFormat` with
    `numeric: 'auto'` instead of five `zh ? … : …` ternaries. This is strictly
    better than adding ten catalog keys: it covers every locale, applies the
    correct plural rules, and yields "yesterday" / 「昨天」 rather than "1d ago".
    Arabic gets its dual form («أسبوعين») — something a ternary cannot express.

  The new `environment.*` keys are added to all ten packs, so this does not widen
  the gap tracked by objectui#2872 part (a).

  `EnvironmentListToolbar`'s tests now render inside a real `I18nProvider` pinned
  to `en`. Without one, `t()` returns the raw key, so the previous assertions on
  literal English would have been asserting nothing.

- dc334da: fix(i18n): close the last three zh-branch gaps (objectui#2871, part 3)

  The three items the #2871 classification marked as real but _not_ a
  migrate-the-copy fix. Each needed a different remedy.

  **`LoadingScreen` — ten languages collapsed to two.** The boot splash already
  selected real locale packs (not inline copy), but through
  `lang.startsWith('zh') ? zh : en`, so a ja/ko/de user watched the whole startup
  in English. It now indexes `builtInLocales` by the two-letter prefix.

  Each field falls back to `en` **individually**, which matters: `console.*` is
  one of the namespaces that trails in the non-`zh` packs (objectui#2872 part a),
  so a whole-object swap would have rendered `undefined` on the splash rather
  than English. `console.loadingHint` was in fact missing from all eight — added
  here, since a blank line under the progress list is worse than an English one.

  **`containers.tsx` — two language sources that could disagree.** The tab-label
  call sites resolved `language` from `useObjectTranslation()`, then handed the
  string to `translateLabel`, which called `detectLocale()` and read
  `document.documentElement.lang` on its own. Those update independently, so an
  in-app language switch could leave a tab label and its surrounding chrome in
  different languages until the next reload. `language` is now threaded in, and
  `detectLocale` is deleted so nothing reaches for the DOM again.

  **`field-types.ts` — a two-language data catalog.** `FieldTypeMeta` carried a
  `labelZh` column beside `label`, which capped the field-type picker at English
  or Chinese by construction. The 46 type names and 9 category names move into
  the Studio catalog as `engine.fieldType.<id>` / `engine.fieldCategory.<cat>`,
  generated from the existing values so no wording changes. This removes the
  `isZh` helper from **both** `ObjectFieldInspector` and `ObjectFormCanvas` — the
  two files the classification listed as "keep the component, fix the catalog".

  The picker's search filter previously matched `id`, the English label, and
  `labelZh` — so searching in Japanese or German matched nothing. It now matches
  the label as the user actually sees it.

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
- Updated dependencies [e16ed2d]
- Updated dependencies [c6fd752]
- Updated dependencies [f9bbddb]
- Updated dependencies [dfd3705]
- Updated dependencies [c77108c]
- Updated dependencies [2735de6]
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
- Updated dependencies [7d46648]
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
  - @object-ui/i18n@17.0.0
  - @object-ui/react@17.0.0
  - @object-ui/types@17.0.0
  - @object-ui/core@17.0.0
  - @object-ui/react-runtime@17.0.0
  - @object-ui/sdui-parser@17.0.0

## 16.1.0

### Patch Changes

- ef14f69: feat(fields): CheckboxesField per-option `visibleWhen` cascading + `dependsOn` gating (completes the option-widget parity set)

  `checkboxes` was the last static-option widget still rendering `config.options`
  raw — with no per-option `visibleWhen` filtering, `dependsOn` gating, or cascade
  clear. It now matches `MultiSelectField` (its multi-value sibling), completing
  the ADR-0058 parity across `select` / `multiselect` / `radio` / `checkboxes`.

  - **`@object-ui/fields`**: `CheckboxesField` routes through the shared
    `useCascadingOptions` hook — offered boxes narrow against the live record +
    `current_user`, the control gates behind a "select the parent first" hint
    while a `dependsOn` field is empty, and selections no longer offered are
    pruned per-element from the array. Adds `checkboxes-empty-*` /
    `checkboxes-option-*` testids.
  - **`@object-ui/components`**: adds `checkboxes` to the form renderer's option
    field sets (`CASCADE_OPTION_FIELD_TYPES`, the cross-field cascade-clear
    effect, and the option pre-filter) so a `checkboxes` field is threaded
    `dependentValues` and gated identically to the other option widgets.
  - Tests: `CheckboxesField.cascade.test.tsx` mirrors `MultiSelectField.cascade.test.tsx`.

- 69fa5d1: chore(lint): clear the baseline lint errors in components (objectui#2713 Wave 3)

  Wave 3 of the #2713 lint-gate restoration. `@object-ui/components` was red at
  baseline on `main`; cleared every **error** (no behavior change; warnings out of
  scope):

  - **`react-hooks/rules-of-hooks`** — `react-page` `ReactKindPage` had a
    capability-gate early return _before_ four hooks (incl. a `useEffect` that
    `import()`s the react runtime). Hoisted the hooks above the gate **and guarded
    the import** (`if (!capabilityEnabled) return` inside the effect) so a disabled
    build still never loads the gated runtime; the disabled notice is returned
    after the hooks. Translation helpers in `empty` / `action-bar` / `action-menu`
    unwrap a try/catch around the provider-safe `useObjectTranslation` (the #2709
    fix).
  - **`react-hooks/static-components`** — dynamic renderer/icon lookups
    (`ComponentRegistry.get`, `resolveIcon`) in `action-bar` / `action-group` ×2 /
    `action-menu`, and the five `__tests__` helpers that render a registry-resolved
    component, are stable references → justified scoped disables.
  - **`react-hooks/purity`** — `ui/sidebar` skeleton width uses `Math.random()`
    once per mount (`useMemo([])`) for a decorative placeholder → justified scoped
    disable.
  - **`@typescript-eslint/no-empty-object-type`** — `ShimmerSkeletonProps` empty
    extend → `type` alias.
  - **`no-useless-assignment`** — `test-utils` `maxDepth` dead initializer → single
    `const`.
  - **`no-require-imports`** — `config-panel-renderer` test uses a top-level
    `import React` instead of an in-test `require`.
  - **stale `eslint-disable`** — removed a `jsx-a11y/alt-text` directive in
    `elements` whose plugin is not loaded in the flat config.

- 1629313: feat(fields): RadioField per-option `visibleWhen` cascading + `dependsOn` gating; single-source the option resolver

  Brings `RadioField` to parity with `SelectField` / `MultiSelectField` for ADR-0058
  cascading & role-gated options, and collapses the three copies of the
  gate-then-filter logic onto one shared resolver.

  - **`@object-ui/core`**: new pure `resolveCascadingOptions(rawOptions, record, dependsOn, scope)`
    → `{ options, gated, dependsOnFields }` — the single source of truth for
    `dependsOn` gating + per-option `visibleWhen` filtering.
  - **`@object-ui/fields`**: `RadioField` now narrows its offered radios against
    the live record + `current_user`, gates behind a "select the parent first"
    hint while a `dependsOn` field is empty, and clears a value no longer offered
    (scalar cascade clear). The `useCascadingOptions` hook is refactored to a thin
    React wrapper over `resolveCascadingOptions`.
  - **`@object-ui/components`**: the form renderer's inline option pre-filter and
    cross-field cascade-clear effect now call `resolveCascadingOptions` instead of
    re-deriving gating/filtering, so they can't drift from the widgets (no
    behavior change).
  - Tests: `RadioField.cascade.test.tsx` mirrors the select cascade tests; core
    gains `resolveCascadingOptions` unit coverage.

- Updated dependencies [0318118]
- Updated dependencies [1c8935a]
- Updated dependencies [af1b0db]
- Updated dependencies [8b8b744]
- Updated dependencies [7cf4051]
- Updated dependencies [803558e]
- Updated dependencies [2e7d7f0]
- Updated dependencies [94d4876]
- Updated dependencies [1100a8b]
- Updated dependencies [7abe4cd]
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
  - @object-ui/react-runtime@16.1.0
  - @object-ui/sdui-parser@16.1.0

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

- 4c7c47f: fix(form): thread live `dependentValues` to cascading option fields (#2284/#1583)

  The form renderer only injected the live form record into data-source widgets
  (`lookup`/`master_detail`/… — the `DATA_SOURCE_FIELD_TYPES` set). Registered
  option widgets (`field:select`/`field:radio`/`field:multiselect`) that carry
  per-option `visibleWhen` + `dependsOn` cascading were **excluded**, so
  `stripRegisteredFieldProps` dropped `dependentValues` before it reached
  `SelectField`. With no live record and no `formValues` context fallback, a
  cascading `select` never saw its controlling field: in a create form the
  dependent field stayed permanently gated on the "Select the parent first" hint
  even after the parent was chosen (reproduced on the showcase `showcase_cascade`
  B3 fixture — country → province never unlocked).

  Option field types now receive `dependentValues` too, so the widget's
  `dependsOn` gate lifts and its `visibleWhen` set re-filters live as the parent
  changes — the same channel the lookup fix (#2215/#2216) already used. Regression
  guard added in `form-dependent-values.test.tsx` (drives the registered
  `field:select` path, not just the builtin `case 'select'` fallback the prior
  cascading-select test covered).

- 33b4995: Welcome-page "Create your environment" deep-links straight into the create
  dialog (#844): `action:button` gains a client-side `autoTrigger` flag (runs
  the action once on mount — same execute path as a click, so param dialogs /
  confirms / entitlement gates still apply), and the environments list consumes
  `?runAction=create_environment` to mark its create action once entitlements
  resolve (upgrade-locked orgs get the upgrade prompt instead; the param is
  stripped after consumption so refresh/back don't re-open). Also localizes the
  EnvironmentListToolbar's state-aware label overrides ({en,zh}) — they were
  hard-coded English inside a zh console.
- Updated dependencies [d3e19ed]
- Updated dependencies [59d4fa9]
- Updated dependencies [210806a]
- Updated dependencies [b4ef588]
- Updated dependencies [ca0f5f0]
- Updated dependencies [5534535]
- Updated dependencies [9b8f978]
- Updated dependencies [195a651]
  - @object-ui/react@16.0.0
  - @object-ui/types@16.0.0
  - @object-ui/i18n@16.0.0
  - @object-ui/core@16.0.0
  - @object-ui/react-runtime@16.0.0
  - @object-ui/sdui-parser@16.0.0

## 15.0.0

### Patch Changes

- @object-ui/types@15.0.0
- @object-ui/core@15.0.0
- @object-ui/i18n@15.0.0
- @object-ui/react@15.0.0
- @object-ui/react-runtime@15.0.0
- @object-ui/sdui-parser@15.0.0

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

- 073e7aa: Conditional tabs (framework#2606): the `page:tabs` renderer honors an item-level
  `visibleWhen` CEL predicate — when it evaluates FALSE the WHOLE tab (header +
  panel) is omitted from the strip, unlike a child component's own `visibleWhen`,
  which hides only the panel content and leaves an empty tab header behind. The
  predicate binds the same environment as page-component `visibleWhen` (record
  fields bare and via `record.`/`data.`, `user`/`current_user`, and page state as
  `page.<var>`) and re-evaluates live as page variables change. The strip is now
  controlled: when the ACTIVE tab's predicate flips false, selection falls back to
  the first visible tab instead of leaving a blank panel, and the user's own
  selection is restored if the tab becomes visible again. Canonical ADR-0089 key
  only — the deprecated `visibility`/`visibleOn` aliases are not read on this new
  surface. Items without `visibleWhen` behave exactly as before.
- 6c0135c: feat(page-header): metadata-driven multi-button record header (#2361)

  The record detail page header no longer hardcodes a single inline primary
  button (`INLINE_MAX = 1`). It now renders up to `maxVisible` actions
  side-by-side (default 3 desktop / 1 mobile, overridable via
  `maxVisible` / `mobileMaxVisible` on the `page:header` schema) — the same
  contract as `action:bar` — so multi-action objects (e.g. Lead: Convert /
  Assign / Return) can surface several primary buttons at once.

  Which actions claim the inline slots is declared in metadata, mirroring the
  `action:bar` #2339 rules:

  - `order` ascending (unset = 0; lower = more prominent), stable sort;
  - `variant: 'primary'` as a tie-break within equal order (also mapped to the
    Shadcn `default` Button variant instead of leaking through);
  - `component: 'action:menu'` pins an action inside the `⋯` overflow menu
    regardless of the action count.

  The synthesized system actions declare their placement accordingly:
  `sys_edit` gets `order: 100` (behind every authored business action, but
  still inline when slots remain), while `sys_share` / `sys_delete` are pinned
  into the `⋯` menu via `component: 'action:menu'` — Delete never surfaces as
  an inline red button just because an object has few actions.

### Patch Changes

- 055e1d2: fix(components): exit inline edit mode for injected cell editors (#2321)

  Non-discrete inline-edit cells (text, number, date, lookup, user, currency,
  percent, …) got permanently stuck in edit mode: the host-injected `@object-ui/fields`
  widget staged its value on every change but had no way to leave edit mode, so
  clicking outside, pressing Enter, and the row Save button all failed to dismiss
  the editor. Only discrete pickers (select/boolean/radio/rating), which commit on
  selection, exited correctly.

  The DataTable now gives injected widget editors the same exit affordances the
  built-in `<input>` editors have:

  - **Click-outside** commits the staged value and exits, via a capture-phase
    document `pointerdown` listener. It is portal-aware — clicking inside a lookup
    popover / record-picker dialog the widget itself opened does not exit, and a
    modal that merely hosts the grid does not suppress the commit.
  - **Enter** commits and exits (a multi-line `textarea` keeps inserting newlines).
  - **Escape** reverts this session's staged changes and exits.

  Keys that bubble up through a React portal from the widget's own popover keep
  driving that popover rather than the cell. Built-in editors are untouched.

- f30ff68: fix(components): keep the list-view horizontal scrollbar pinned to the viewport bottom

  In a list/grid view with many columns, the horizontal scrollbar was only
  reachable after scrolling all the way to the last row. Root cause: the shadcn
  `<Table>` wraps its `<table>` in a `overflow-auto` scroll `<div>`. When
  `DataTable` already renders the table inside a _bounded_
  `flex-1 min-h-0 overflow-auto` region, that default wrapper became a SECOND,
  height-unbounded scroll container — it stretched to the full table height, so
  its horizontal scrollbar sat at the bottom of _all_ rows.

  - `Table` gains an optional `containerClassName` prop that overrides the
    scroll-wrapper `<div>`'s classes (default behavior unchanged).
  - `DataTable` passes `containerClassName="overflow-visible"` so the outer
    bounded container owns both axes and the horizontal scrollbar stays pinned to
    the viewport bottom — reachable from any scroll position, no need to scroll to
    the last row.

  Verified end-to-end against the running console (data-table with 60+ rows × 19
  columns): the horizontal scroller is now the bounded `flex-1 min-h-0
overflow-auto` region (bottom on-screen, within the viewport) and the table can
  be scrolled fully right while still at the top row.

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

- Updated dependencies [82441e4]
- Updated dependencies [2efa9fd]
- Updated dependencies [0890fa7]
- Updated dependencies [2ded18c]
- Updated dependencies [e628d1f]
- Updated dependencies [5523fc4]
- Updated dependencies [887062c]
- Updated dependencies [23d65c3]
- Updated dependencies [9e2d58f]
- Updated dependencies [dea65f7]
- Updated dependencies [5b52624]
- Updated dependencies [d5b1bc0]
- Updated dependencies [f94905d]
- Updated dependencies [f0f10f5]
  - @object-ui/i18n@14.1.0
  - @object-ui/core@14.1.0
  - @object-ui/types@14.1.0
  - @object-ui/react@14.1.0
  - @object-ui/react-runtime@14.1.0
  - @object-ui/sdui-parser@14.1.0

## 14.0.0

### Minor Changes

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

### Patch Changes

- a44e7b6: Form fields honor their object-schema `widget` render hint on the field-group /
  section layout path. `ObjectForm` renders objects that declare field groups
  (e.g. `sys_sharing_rule`) via an auto-derived section layout that passed each
  field's metadata through without hoisting its `widget` override to the top-level
  form-field config, so a field with `widget: 'object-ref'` (or `filter-condition`
  / `recipient-picker`) degraded to its bare `type` input — an admin was asked to
  hand-type an object name instead of picking it. The form renderer now falls back
  to the field metadata's own `widget` when no top-level override is present, so
  the pickers render on sectioned forms just as they do on flat ones.
- Updated dependencies [443360a]
- Updated dependencies [c70bca7]
- Updated dependencies [86c69c3]
- Updated dependencies [05e56ca]
- Updated dependencies [5971cc4]
- Updated dependencies [6a74160]
  - @object-ui/core@14.0.0
  - @object-ui/i18n@14.0.0
  - @object-ui/react@14.0.0
  - @object-ui/types@14.0.0
  - @object-ui/react-runtime@14.0.0
  - @object-ui/sdui-parser@14.0.0

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
  - @object-ui/react@13.2.0
  - @object-ui/types@13.2.0
  - @object-ui/core@13.2.0
  - @object-ui/react-runtime@13.2.0
  - @object-ui/sdui-parser@13.2.0

## 13.1.0

### Patch Changes

- @object-ui/types@13.1.0
- @object-ui/core@13.1.0
- @object-ui/i18n@13.1.0
- @object-ui/react@13.1.0
- @object-ui/react-runtime@13.1.0
- @object-ui/sdui-parser@13.1.0

## 13.0.0

### Patch Changes

- ac04b76: Data-table row menu: honor each custom row action's `visible` (and `disabled`) predicate.

  The data-table's inline row overflow menu — used by a record detail page's related list — rendered every custom row action unconditionally, ignoring the action's `visible` CEL. ObjectGrid's row menu already evaluates `visible` per row (`RowActionMenuItem`), so the two row-menu paths disagreed: on an organization's Members tab, `sys_member`'s `transfer_ownership` action (`visible: "record.role != 'owner' && …"`) showed on the owner's own row.

  Each custom action now renders through a hook-safe `DataTableRowActionItem` that mirrors `RowActionMenuItem`, evaluating `visible`/`disabled` with `useCondition`/`toPredicateInput` against the same per-row context (`{ ...row, record: row }`); `features`/`user` resolve from the ambient `ExpressionProvider` scope, so gating matches the grid. Rendering-layer only — the action definitions are unchanged.

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

- Updated dependencies [9e38270]
- Updated dependencies [619097e]
  - @object-ui/i18n@13.0.0
  - @object-ui/types@13.0.0
  - @object-ui/react@13.0.0
  - @object-ui/core@13.0.0
  - @object-ui/react-runtime@13.0.0
  - @object-ui/sdui-parser@13.0.0

## 12.1.0

### Minor Changes

- c31874d: Record-header actions honour `Action.order`, so approval decisions no longer get buried in the `⋯` overflow menu (objectui#2339 / framework#2670).

  The `action:bar` renderer now stable-sorts its actions by an explicit **`order`** field (lower = higher / more prominent, default `0`) before the inline/overflow split. The sort is stable and treats unset `order` as `0`, so action groups where nobody sets `order` keep their exact registration order — existing toolbars are unaffected. `order` is added to `ActionSchema` in `@object-ui/types`, mirroring `Action.order` in `@objectstack/spec`.

  `RecordDetailView` now assigns the injected **Approve / Reject** decision buttons a strongly-negative `order` (and gives Approve the highlighted `primary` variant), so on a pending-approval record the approver's decision takes the primary-button slot and app `record_header` actions follow it — instead of the app having to hide its own actions to surface the decision.

### Patch Changes

- 6cbccf3: Localize form validation messages, toast client-side validation failures, and make native date/time picker icons legible in dark mode.

  Record-form validation messages (required, min/max length, min/max value, pattern, email, URL) were hard-coded English even when the field label was localized — e.g. a Chinese "计划开始日期" field showed "计划开始日期 is required". `buildValidationRules` baked English strings, so the form renderer's `t(...)` fallback never applied. It now emits `required: true` and, for the other rules, a `messageKey` + `undefined` message (a field-authored `*_message` still wins and passes through verbatim); the form renderer fills the blanks via i18n (`validation.*` keys already exist in every locale), so messages track the label's language.

  When client-side validation blocks a submit, the offending field's inline error can sit below the fold in a long modal/drawer form — the user clicks 创建 and sees nothing happen. The form renderer now also fires a `toast.error` naming the fields (`validation.formInvalid`, added to all 10 locales), mirroring the existing server-error toast so the feedback is visible regardless of scroll position.

  Separately, native controls now declare `color-scheme` (`light` on `:root`, `dark` on `.dark`), so the webkit calendar-picker-indicator and other built-in glyphs render light-on-dark instead of vanishing against the dark input background.

- Updated dependencies [6cbccf3]
- Updated dependencies [e1840bf]
- Updated dependencies [c31874d]
  - @object-ui/i18n@12.1.0
  - @object-ui/types@12.1.0
  - @object-ui/react@12.1.0
  - @object-ui/core@12.1.0
  - @object-ui/react-runtime@12.1.0
  - @object-ui/sdui-parser@12.1.0

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

### Patch Changes

- Updated dependencies [226fde9]
- Updated dependencies [e4de456]
  - @object-ui/types@12.0.0
  - @object-ui/core@12.0.0
  - @object-ui/react@12.0.0
  - @object-ui/i18n@12.0.0
  - @object-ui/react-runtime@12.0.0
  - @object-ui/sdui-parser@12.0.0

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
- Updated dependencies [6fffd3d]
- Updated dependencies [9255686]
- Updated dependencies [fae75e2]
- Updated dependencies [1072701]
  - @object-ui/i18n@11.5.0
  - @object-ui/react@11.5.0
  - @object-ui/types@11.5.0
  - @object-ui/core@11.5.0
  - @object-ui/react-runtime@11.5.0
  - @object-ui/sdui-parser@11.5.0

## 11.4.0

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

- bce581a: Fix dependent (cascading) lookups: unlock on parent selection and enforce the
  cascade filter on every candidate surface (#2215).

  Two breaks made `depends_on` unusable end to end:

  - **The gate never unlocked in create mode.** `LookupField` resolved dependent
    values from `ctx.formValues` — a member `SchemaRendererContext` never had —
    and nothing injected the `dependentValues` prop, so with a fresh record
    (`ctx.data = {}`) the child lookup stayed disabled no matter what the user
    picked in the parent field. The form renderer now injects its live form
    values (the same reactive snapshot that drives field rules) as
    `dependentValues` for data-source fields.
  - **The Level-2 table picker bypassed the cascade.** The `depends_on` chain
    only reached the quick-select popover filter; `RecordPickerDialog` (and the
    search-first `PeoplePicker`) received just `lookup_filters`, listing the full
    unfiltered record set. Both pickers now take a `baseFilter` — a hard
    `$filter` constraint merged after `lookupFilters` and user filter-bar input,
    so it can never be widened back out — and `LookupField` passes the dependent
    chain there, shares the same filter with the popover query, and disables the
    browse-all button while dependencies are missing.

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

- e84d64d: Block record-scoped toolbar actions launched with zero rows selected (#2210).

  A flow/script action that also mounts on list rows (`locations` includes
  `list_item`) has no record to run on when triggered from the list toolbar with
  nothing selected — pre-fix the wizard opened anyway, collected input, and died
  at its first record-bound node ("Update requires an ID or options.multi=true").
  The console runtime now blocks up front with "select a row first", mirroring
  the existing multi-selection guard. Pure object-level toolbar actions
  (`locations: ['list_toolbar']` only) keep triggering without a record.

  The action renderers (button/icon/menu/group) now forward the `locations`
  declaration to the ActionRunner — previously it was dropped by their
  allow-list payloads, so the runtime could not tell the two shapes apart.

- Updated dependencies [8bf6295]
- Updated dependencies [1948c5b]
- Updated dependencies [9cd9be1]
- Updated dependencies [c38d107]
- Updated dependencies [790558b]
  - @object-ui/types@11.4.0
  - @object-ui/i18n@11.4.0
  - @object-ui/core@11.4.0
  - @object-ui/react@11.4.0
  - @object-ui/react-runtime@11.4.0
  - @object-ui/sdui-parser@11.4.0

## 11.3.0

### Minor Changes

- d23d6eb: Three-tier AI page authoring: `kind:'html'` and a trusted `kind:'react'` tier.

  - **`@object-ui/react-runtime`** (new) — the trusted runtime-React tier for
    `kind:'react'` pages (vendored react-runner: Sucrase transpile + scope-eval,
    no sandbox). Renders real JSX/TSX (any HTML + JS + hooks/useState/map/onClick)
    in the main React tree with an injected scope (React, the public data blocks,
    page data) and a built-in error boundary.
  - **`@object-ui/core`** — new runtime capability gate (`enableCapability` /
    `disableCapability` / `isCapabilityEnabled`, `CAP_REACT_PAGES`). `react-pages`
    defaults **ON** (the platform trusts reviewed, draft-gated authors); a
    deployment turns it OFF server-side (the runtime injects the disable global
    when `OS_DISABLE_REACT_PAGES` is set). Never controlled from authored metadata.
  - **`@object-ui/components`** — PageRenderer now routes `kind:'react'`
    (capability-gated, lazy-loads the runtime) and renders `kind:'html'` (the
    former `kind:'jsx'`, still accepted as a deprecated alias). The `html` tier
    now resolves the full safe native HTML tag set (h1–h6, p, a, ul/ol/li, img,
    blockquote, pre, strong/em, …) so authored HTML lives up to its name.

### Patch Changes

- d88c8ec: fix(data-table): surface inline-edit save failures instead of swallowing them

  A rejected inline-edit save (e.g. a 400 validation failure like an invalid
  status transition) was caught with only `console.error` — the toolbar stayed
  stuck, the cell kept the unsaved value, and the author got no feedback. Now the
  data-table shows the server's reason in the toolbar (with an alert icon) and
  tints the affected row(s) destructive so it's clear which rows didn't persist.
  The pending edit is kept for retry; the error clears on a successful save or on
  cancel. Adds the `table.saveFailed` string across all locales.

- b7237bb: fix(components): keep MobileDialogContent open when interacting with a portalled dropdown

  Radix Select / Popover / DropdownMenu render their flyout into a portal at
  `document.body`, outside the dialog's DOM. Clicking an empty part of an open
  dropdown registered as an "interact outside" and closed the entire dialog
  (create/edit forms). `MobileDialogContent` now guards `onInteractOutside`:
  interactions whose real target is inside a Radix popper layer are ignored
  (the popper dismisses itself), while a genuine backdrop click still closes the
  dialog as before.

- Updated dependencies [d88c8ec]
- Updated dependencies [d23d6eb]
  - @object-ui/i18n@11.3.0
  - @object-ui/react-runtime@11.3.0
  - @object-ui/core@11.3.0
  - @object-ui/react@11.3.0
  - @object-ui/types@11.3.0
  - @object-ui/sdui-parser@11.3.0

## 11.2.0

### Minor Changes

- 9e7a986: ADR-0080: AI-authored UI pages. New `@object-ui/sdui-parser` compiles a constrained JSX/HTML+Tailwind source into the SchemaNode tree (parse, never execute) with whitelist sanitization, manifest validation, and `.d.ts` codegen for the JSX type surface. `PageRenderer` renders `kind:'jsx'` pages; `ComponentRegistry` gains `tier` + `getPublicConfigs()` (capability vs contract).

### Patch Changes

- Updated dependencies [9e7a986]
- Updated dependencies [1311749]
  - @object-ui/sdui-parser@11.2.0
  - @object-ui/core@11.2.0
  - @object-ui/react@11.2.0
  - @object-ui/types@11.2.0
  - @object-ui/i18n@11.2.0

## 11.1.0

### Patch Changes

- Updated dependencies [6726a2b]
  - @object-ui/i18n@11.1.0
  - @object-ui/react@11.1.0
  - @object-ui/types@11.1.0
  - @object-ui/core@11.1.0

## 7.3.0

### Patch Changes

- @object-ui/types@7.3.0
- @object-ui/core@7.3.0
- @object-ui/i18n@7.3.0
- @object-ui/react@7.3.0

## 7.2.0

### Patch Changes

- Updated dependencies [8e7c1da]
- Updated dependencies [d23db5c]
  - @object-ui/i18n@7.2.0
  - @object-ui/types@7.2.0
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

- 90acb7f: Master-detail subform + lightweight list primitives (SDUI).

  - `MasterDetailForm` (`object-master-detail-form`): enter a parent record and its child line items together; client-orchestrated transactional create (parent → FK → bulk children → rollup → cleanup). Enterprise-convention layout (header on top, line grid, single Save bar at the bottom).
  - `LineItemsField` editable child grid (line numbers, right-aligned numerics, running total) and `LineItemsPanel` (`record:line_items`) for detail-page inline edit.
  - `element:definition-list` and `element:repeater` — lightweight, low-chrome list primitives for simple data.

### Patch Changes

- ddbe4a2: B2 step 3: client-side field-level conditional rules (`visibleWhen` / `readonlyWhen` / `requiredWhen`). The form renderer now evaluates these CEL predicates reactively against the live record and gates each field's visibility, read-only state, and required-ness accordingly. Evaluation delegates to the canonical `@objectstack/formula` `ExpressionEngine` — the _same_ dialect the server enforces (`requiredWhen` in the rule-validator, `readonlyWhen` in `stripReadonlyWhenFields`) — so the UX and the persisted verdict always agree. New core helpers `evalFieldPredicate` / `resolveFieldRuleState` (zero-React, fail-open). `FormField` gains `visibleWhen` / `readonlyWhen` / `requiredWhen` (+ deprecated `conditionalRequired` alias), and `ObjectForm` carries them through from object metadata.
- 2d47e94: B2 follow-ups (A): field conditional rules in inline grids + submit-time enforcement.

  - **Grids**: a line-item column's `readonlyWhen` / `requiredWhen` CEL rule is now honored per row — `deriveMasterDetail` carries the props onto the `GridColumn` and `GridField` evaluates them against each row via `resolveFieldRuleState` (a `readonlyWhen`-TRUE cell locks; a `requiredWhen`-TRUE empty cell flags inline-invalid). Rules are row-scoped (`record.*`); the core helpers gained an optional `scope` (and `GridField` a `contextRecord` prop) so a future header-driven lock can bind `parent.*` — that wiring is deferred (it needs the master-detail header's re-renders isolated).
  - **Submit enforcement**: `requiredWhen` already drove react-hook-form's `required` rule, so submit is blocked with a field error when the predicate is TRUE and the value is empty. Added a reactive cleanup so a stale _required_ error clears when the predicate flips FALSE (and all errors clear when a field is hidden by `visibleWhen`).

- 6c0c92c: fix(app-shell): command palette idempotent open + stable locators (ADR-0054 Phase 1)

  The top-bar "Search… ⌘K" button now opens the command palette directly via a
  shared, idempotent `openCommandPalette()` instead of re-dispatching a synthetic
  `⌘K` `KeyboardEvent` — so it works under automation and in ⌘K-reserving
  browsers. Open state is URL-addressable (`?palette=1`, `?cmdk=1` alias), making
  the palette deep-linkable and restore-on-reload. The dialog and header trigger
  emit stable `data-testid` locators (`overlay:command-palette`,
  `action:command-palette:open`) plus an ARIA name. New `useCommandPalette()` hook
  and `CommandPaletteProvider`; `CommandDialog` gains a `contentProps` passthrough
  for the dialog locator/ARIA. Implements invariants C1/C3/C4 of the UI
  testability contract.

- ad8ade6: feat(components): metadata-derived field locators on generated forms (ADR-0054 Phase 4)

  The form renderer now emits a stable `data-testid="field:{objectName}.{field}"`
  (plus `data-field`) on every field wrapper, derived from the form's `objectName`
  and each field's name — closing the locator gap at the source so every generated
  form (`ObjectForm`/`ModalForm`/`DrawerForm`/`SplitForm`/`WizardForm`) inherits
  testable fields with zero per-app work (ADR-0054 C4). `FormSchema` gains an
  optional `objectName`; the object prefix is omitted (`field:{field}`) when a form
  has none. `FormItem` now accepts `data-*` attributes.

- 2eb3096: fix(form): stop `form.reset()` from wiping user input on re-render

  The form renderer reset react-hook-form whenever the `defaultValues` **object
  identity** changed:

  ```ts
  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues]);
  ```

  Callers commonly pass a freshly-built `defaultValues` object every render, so an
  unrelated parent re-render reset the form and discarded whatever the user had
  typed. This broke master-detail "Create": a re-render between the submit click
  and the (deferred) `requestSubmit` blanked the form, so RHF then failed
  required-field validation on the now-empty fields and nothing was submitted —
  the "click Create, nothing happens" report.

  The effect now resets only when `defaultValues` actually **changes by value**
  (JSON-compared), so a genuine change (e.g. an edit-mode record finishing
  loading) still resets while identity churn is ignored.

- 7913390: fix(master-detail): never silent on save — feedback, reset, and a duplicate-submit guard

  `MasterDetailForm`'s "Create" submitted successfully but gave **no feedback**: no toast, no form reset, no navigation. A successful create looked broken, and re-clicking created duplicate records.

  - On success: a `toast.success`, and on create the form clears (line items reset + parent `<ObjectForm>` remounts) ready for the next entry. A page-supplied `onSuccess` still runs afterwards (e.g. to navigate).
  - On failure (validation / network / atomic rollback): a `toast.error` surfaces the message instead of failing silently.
  - In-flight guard: the Create button shows "Saving…" and is disabled while a submit is running, preventing duplicate submissions, with a safety release if client-side validation blocks the submit.
  - `@object-ui/components` now re-exports `toast` (alongside `Toaster`) from its sonner wrapper.

  Tests: two new `MasterDetailForm` tests assert success → toast + form clear, and failure → error toast.

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

- 2270239: feat: scoped style-object rendering (ADR-0065)

  A metadata node may carry `responsiveStyles` (per-breakpoint CSS-property maps);
  `SchemaRenderer` compiles it to **id-scoped CSS** injected as a `<style>` tag and
  appends a scope class to the node. Build-independent (arbitrary values + design
  tokens pass through verbatim — no Tailwind JIT), collision-free (per-node scope,
  unlayered so it beats base utilities), responsive-correct (model breakpoint maps
  → generated `@media`, never `md:` variant classes). Adds `compileScopedStyles`/
  `scopeClassFor`/`hasResponsiveStyles` to `@object-ui/core` and an SDUI design-token
  palette (`--space-*`, `--surface`, `--brand`, …) to the theme. Mirrors Builder.io.

- 8d1195d: Fix `type: 'url'` actions so they actually reach the backend in split-origin dev setups, and so reveal-once result dialogs render.

  - `ActionRunner.executeUrl`: when context provides `apiBase`, relative `/api/...`, `/_auth/...`, and `/_account/...` URLs are now promoted to absolute (`${apiBase}${path}`) before navigation. Same-origin API paths (with or without `apiBase`) trigger a full-page `window.location.href` rather than React-Router push — this is required for server-side OAuth redirect dances (e.g. better-auth `/sign-in/social`) that React Router would otherwise swallow into the SPA's fallback route.
  - `ActionRunner.buildInterpolationContext`: surfaces `ctx.apiBase` for action targets that want to template it explicitly.
  - `ObjectView`: passes `apiBase: import.meta.env.VITE_SERVER_URL` into the toolbar `ActionProvider` context so the above resolves.
  - `action-button` and `action-menu` renderers now forward `resultDialog` when invoking the runner. Previously this field was silently dropped by an explicit whitelist, breaking every "show once, then hide" flow (2FA QR/backup codes, OAuth client_secret, regenerated tokens).

- Updated dependencies [5976ba3]
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
- Updated dependencies [97c6831]
- Updated dependencies [cb2fdb1]
- Updated dependencies [c3749eb]
- Updated dependencies [c09f44e]
- Updated dependencies [6cfa330]
- Updated dependencies [ad8ade6]
- Updated dependencies [d54346c]
- Updated dependencies [3870c20]
- Updated dependencies [b88c560]
- Updated dependencies [0ad72a6]
- Updated dependencies [3fa23a7]
- Updated dependencies [18d0339]
- Updated dependencies [59b6bbb]
- Updated dependencies [d16566f]
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
  - @object-ui/react@7.0.0
  - @object-ui/i18n@7.0.0
  - @object-ui/types@7.0.0

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3
- @object-ui/core@6.2.3
- @object-ui/i18n@6.2.3
- @object-ui/react@6.2.3

## 6.2.2

### Patch Changes

- Updated dependencies [a66f788]
  - @object-ui/react@6.2.2
  - @object-ui/types@6.2.2
  - @object-ui/core@6.2.2
  - @object-ui/i18n@6.2.2

## 6.2.1

### Patch Changes

- @object-ui/types@6.2.1
- @object-ui/core@6.2.1
- @object-ui/i18n@6.2.1
- @object-ui/react@6.2.1

## 6.2.0

### Patch Changes

- @object-ui/react@6.2.0
- @object-ui/types@6.2.0
- @object-ui/core@6.2.0
- @object-ui/i18n@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/core@6.1.0
  - @object-ui/types@6.1.0
  - @object-ui/react@6.1.0
  - @object-ui/i18n@6.1.0

## 6.0.4

### Patch Changes

- @object-ui/types@6.0.4
- @object-ui/core@6.0.4
- @object-ui/i18n@6.0.4
- @object-ui/react@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3
- @object-ui/core@6.0.3
- @object-ui/i18n@6.0.3
- @object-ui/react@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2
- @object-ui/core@6.0.2
- @object-ui/i18n@6.0.2
- @object-ui/react@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1
- @object-ui/core@6.0.1
- @object-ui/i18n@6.0.1
- @object-ui/react@6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0
- @object-ui/core@6.0.0
- @object-ui/i18n@6.0.0
- @object-ui/react@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2
- @object-ui/core@5.4.2
- @object-ui/i18n@5.4.2
- @object-ui/react@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1
- @object-ui/core@5.4.1
- @object-ui/i18n@5.4.1
- @object-ui/react@5.4.1

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0
  - @object-ui/core@5.4.0
  - @object-ui/react@5.4.0
  - @object-ui/i18n@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2
- @object-ui/core@5.3.2
- @object-ui/i18n@5.3.2
- @object-ui/react@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1
- @object-ui/core@5.3.1
- @object-ui/i18n@5.3.1
- @object-ui/react@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0
- @object-ui/core@5.3.0
- @object-ui/i18n@5.3.0
- @object-ui/react@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1
- @object-ui/core@5.2.1
- @object-ui/i18n@5.2.1
- @object-ui/react@5.2.1

## 5.2.0

### Minor Changes

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

- a8d12ec: `page:header` subtitle and title-format interpolation now translates
  enum field values through the i18n option-label dictionary.

  A schema like `subtitle: "{industry} · {type}"` previously rendered the
  raw enum values (`"technology · customer"`) regardless of locale or
  authored option labels. The interpolator now looks up the current
  record's `objectSchema.fields` and routes each token through
  `useSafeFieldLabel().fieldOptionLabel(...)`, so the same template
  renders as `"科技 · 正式客户"` in zh-CN and `"Technology · Customer"`
  in en — without authors having to write per-locale subtitle templates.

  The change is transparent for tokens that resolve to non-enum field
  values; only fields with an `options` array are remapped.

### Patch Changes

- Updated dependencies [de0c5e6]
- Updated dependencies [9997cae]
- Updated dependencies [321294c]
- Updated dependencies [b2d1704]
- Updated dependencies [0a644f0]
- Updated dependencies [a3cb88f]
- Updated dependencies [5425608]
- Updated dependencies [3ebba63]
- Updated dependencies [e919433]
- Updated dependencies [70b5570]
- Updated dependencies [aa063db]
- Updated dependencies [d9c3bae]
- Updated dependencies [d1442e3]
- Updated dependencies [7c7400a]
  - @object-ui/types@5.2.0
  - @object-ui/core@5.2.0
  - @object-ui/i18n@5.2.0
  - @object-ui/react@5.2.0

## 5.1.1

### Patch Changes

- 8955b9c: fix(empty): render `action` schema via `SchemaRenderer` instead of leaking the raw object

  The `empty` renderer was spreading the schema's `action` prop straight onto
  `DataEmptyState`, which renders `{action}` as a child. That worked for React
  nodes but blew up on production builds when the docs site fed it a schema
  shape like `action: { type: 'button', label: 'Create', variant: 'default' }`
  (error: "Objects are not valid as a React child").

  The renderer now passes `schema.action` through `SchemaRenderer` to turn it
  into a real React element, and explicitly strips `action`/`icon` from the
  spread so schema-shaped objects don't reach DOM attributes.

  - @object-ui/types@5.1.1
  - @object-ui/core@5.1.1
  - @object-ui/i18n@5.1.1
  - @object-ui/react@5.1.1

## 5.1.0

### Minor Changes

- cf30cc2: Polish Lightning record detail page layout.
  - `record:details` sections now render with Card chrome by default when a `title` is present, restoring visual grouping that was missing on pages like the opportunity detail page.
  - Section labels can be translated via the `{ns}.objects.{objectName}._sections.{name}.label` convention. Author each section with a stable `name` (e.g. `info`, `forecast`) and the renderer picks up the locale-specific label automatically. Falls back to the literal `label` when no translation exists.
  - The `page:header` action toolbar now collapses into a `⋯` overflow menu when more than two actions are present. The first business action stays inline; secondary system actions (Edit / Share / Delete) move into the menu, with destructive styling applied to Delete.
  - Header action labels resolve via the `{ns}.objects.{objectName}._actions.{name}.label` convention.
  - Removed the meaningless field-count Badge from collapsible section headers (the `2` chip next to "Description"). Field-count metadata wasn't useful in the header and added visual noise.
  - Synth-path `sys_delete` now carries `variant: 'destructive'` so the overflow menu can color it appropriately.

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

- d548d6b: Unify empty-state visuals across timeline + registered `empty` renderer.

  - `RecordActivityTimeline` and `ActivityTimeline` now use `DataEmptyState`
    instead of a bare `<p>` so empty timelines match list/related-list visuals
    (muted icon badge + centered copy).
  - The `ui:empty` schema renderer now delegates to `DataEmptyState`, giving
    schema-driven empty regions the same chrome as ad-hoc consumers.

- Updated dependencies [bd8447d]
- Updated dependencies [d51a577]
- Updated dependencies [1976691]
- Updated dependencies [cf30cc2]
- Updated dependencies [5b80cfd]
- Updated dependencies [49b1760]
- Updated dependencies [c0b236f]
  - @object-ui/react@5.1.0
  - @object-ui/i18n@5.1.0
  - @object-ui/types@5.1.0
  - @object-ui/core@5.1.0

## 5.0.2

### Patch Changes

- Updated dependencies [cab6a93]
  - @object-ui/i18n@5.0.2
  - @object-ui/react@5.0.2
  - @object-ui/types@5.0.2
  - @object-ui/core@5.0.2

## 5.0.1

### Patch Changes

- @object-ui/types@5.0.1
- @object-ui/core@5.0.1
- @object-ui/i18n@5.0.1
- @object-ui/react@5.0.1

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

- 95b6b21: feat(page:header): record-aware chip + dedupe registrations (Phase D)

  The `page:header` schema renderer is the visual anchor of every custom
  record detail page (lead, opportunity, future account/contact/case).
  Before this change it had two problems that bled into every custom
  page across the product:

  1. **Quadruple registration**: `@object-ui/layout` registered both
     `page-header` and `page:header`, and `@object-ui/components`
     independently registered `page:header` (and `page:section`).
     Whichever package loaded last won the unqualified `page:header`
     lookup — visually unstable.
  2. **Bare `<h1>`** with no record affordances (no icon, ★ favourite,
     copy-id, edit, ⋯ menu) — every custom page shipped a thinner header
     than the default detail view it was meant to supersede.

  This commit:

  - Removes the `@object-ui/layout` `page:header` registration. The
    layout package keeps the legacy kebab-cased `page-header` alias only.
    The canonical renderer now lives in `@object-ui/components` and is
    always the one resolved.
  - Upgrades `PageHeaderRenderer` to render a `<RecordTitleChip>` when
    wrapped in a `RecordContext`. The chip mirrors the default detail
    header: title (resolved from `data.name` / `data.title` /
    `data.display_name`, or an interpolated `schema.title`), a favourite
    star, the object label, and a copy-record-id button. Authors opt out
    via `recordChrome: false` or hide individual affordances with
    `showStar: false` / `showCopyId: false`.
  - Extracts the chip into a new shared `RecordTitleChip` component in
    `@object-ui/components/custom`. It carries an inline zh-CN/zh-TW
    dictionary for star/copy tooltips so it stays i18n-correct without
    pulling in a translation dependency.
  - Fixes `interpolate()` so a `{account}`-style token that resolves to
    a related-record object renders as empty instead of
    `"[object Object]"`. Authors who want a field of the related record
    should use a deeper path (`{account.name}`).

  Verified at 1440×900 on `lead_detail` and `opportunity_detail`:
  both pages now show the same chip with star + copy-id and the
  opportunity highlights strip looks coherent with the chip above it.

- ddb08a7: feat(page:header,page:tabs): title fallback + single-tab strip auto-hide (Phase G slice 3 polish)

  - `page:header.resolvedTitle` now honors `objectSchema.titleFormat`
    (e.g. `{first_name} {last_name}`) and falls back through `name →
full_name → title → subject → display_name → label` before degrading
    to `${objectLabel} ${idPrefix}`. Mirrors `DetailView.resolveDisplayTitle`
    so default and synthesized record pages produce identical titles.
  - `page:tabs` hides the tab strip entirely when there's only one tab
    (a single labelled pill is visual clutter, not an affordance).
    Authors can opt back in with `properties.alwaysShowStrip: true`.
    Single-tab content margin tightens from `mt-3` to `mt-0` to remove
    the now-empty top space.

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

- b14fe09: Phase P.0 + P.5: tighten record-detail header chrome.

  - `RecordTitleChip` collapses the title row to a single baseline-aligned line — H1, eyebrow object label, copy-id, favorite star — instead of the previous two-row title + subtitle layout.
  - `record:details` extends the highlight-field dedup set to also exclude the title field resolved from `objectSchema.primaryField` (or the standard `name`/`full_name`/`title`/`subject`/`display_name`/`label` fallbacks). Removes the duplicate row that previously echoed the H1 (e.g. "客户名称: Acme Corporation") inside the field grid.

- a7bef6e: Phase P.3: anchor `page:tabs` 'line' variant with a proper underline rail.

  The Shadcn Tabs primitive defaults to a pill-card look (bg-muted,
  rounded, white-on-active). On long record-detail pages this strip
  floats unmoored — users scroll past it without realising it's a
  section anchor.

  `PageTabsRenderer` now applies an underline-style treatment to the
  default 'line' variant: the `TabsList` gets a bottom border, and each
  `TabsTrigger` renders as a transparent button with a 2px primary-color
  underline when active. 'card' and 'pill' variants are unchanged.

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

### Patch Changes

- 765d50f: fix(components): strip dangling separators from interpolated record titles

  `page:header` now post-processes the result of interpolating a record's
  `titleFormat` through `cleanupTitleSeparators` so a missing field in the
  template doesn't leave a trailing/leading connector.

  Example: with `titleFormat: '{contract_number} - {name}'` and a contract
  whose `name` is empty, the header was rendering `CTR-0001 -` (with a
  dangling hyphen). It now renders `CTR-0001`. Also handles a missing
  middle field (`A -  - B` → `A - B`) and collapses whitespace runs.

  Supports hyphen / em-dash / en-dash / middle-dot / colon / slash / pipe
  connectors. Idempotent. Exported as `cleanupTitleSeparators` from the
  containers module; covered by 10 new unit tests.

- 3154334: fix(components): render `page:header.actions` on custom detail pages

  `PageHeaderRenderer` previously read `title`, `subtitle`, `breadcrumb`,
  `showStar`, `showCopyId` but never the `actions` array. Authored
  Lightning record pages embed action buttons directly on
  `page:header` (e.g. Lead → "Convert Lead", Opportunity → "Clone
  Opportunity"); these buttons silently disappeared.

  The renderer now reads `schema.actions ?? schema.properties?.actions`,
  filters by `locations.includes('record_header')` (default-include when
  absent), evaluates `visible` / `hidden` predicates (boolean, string,
  or `{ dialect, source }` shapes) against the live record via
  `ExpressionEvaluator`, and dispatches clicks through the
  `ActionProvider`'s shared runner — so `confirmText`, `successMessage`,
  `refreshAfter`, `flow`, navigation and modal handlers all fire.

  The `data-page-actions-slot` portal target is preserved as a fallback
  when no actions are declared in schema.

- Updated dependencies [8930b15]
- Updated dependencies [927187a]
- Updated dependencies [8435860]
- Updated dependencies [74962b0]
- Updated dependencies [7213027]
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

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0
- @object-ui/core@4.7.0
- @object-ui/i18n@4.7.0
- @object-ui/react@4.7.0

## 4.6.0

### Minor Changes

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

- @object-ui/types@4.6.0
- @object-ui/core@4.6.0
- @object-ui/i18n@4.6.0
- @object-ui/react@4.6.0

## 4.5.0

### Minor Changes

- 6b6afd1: `page:tabs` items now render their optional `icon` (lucide name) and `count`
  badge after the label. Counts >= 1000 are shortened to compact form
  (e.g. `1.2k`). Spec-aligned: `PageTabsItem.icon` and `PageTabsItem.count`.
- aa7855f: `page:tabs` now auto-derives count badges from any descendant `record:related_list`.

  For every tab item whose `count` is not set explicitly, the renderer walks the tab's children (depth-first) to find the first `record:related_list` schema node and issues a `limit:1` find through the active `dataSource` to read the matching `total`. The badge appears in the tab strip without spec authors having to wire counts manually.

  Behavior:

  - Explicit `count` in the spec always wins.
  - Probe is filtered by the parent record id via `relationshipField` when present (skipped until the parent record is loaded).
  - Best-effort: a failed probe just omits the badge — no error surface.
  - Cancellable on unmount.

### Patch Changes

- 170d89f: PageTabsRenderer auto-count now descends into accordion (`properties.items`) and sums counts when a tab contains multiple `record:related_list` widgets — matches Salesforce "Related" tab semantics. Previously only the first list was probed (or none, if wrapped in an accordion).
- Updated dependencies [ab5e281]
- Updated dependencies [22fa558]
  - @object-ui/types@4.5.0
  - @object-ui/i18n@4.5.0
  - @object-ui/core@4.5.0
  - @object-ui/react@4.5.0

## 4.4.0

### Patch Changes

- 2bd45af: feat(shell): main becomes the scroll container; record tabs are sticky
  - `AppShell`'s SidebarProvider wrapper is now constrained to viewport
    height (`h-svh overflow-hidden`) instead of expanding with content via
    the default `min-h-svh`. This makes the inner `<main>` (which is
    `overflow-auto`) the actual scroll container instead of the window.
  - `RecordDetailView` page-mode container drops the redundant
    `h-full overflow-auto` (avoids nested scrollers; main owns scroll now).
  - `page:tabs` (horizontal) gets `sticky top-0 z-20` with a translucent
    backdrop so the tab strip stays visible while users scroll through
    long record pages — the Salesforce Lightning behaviour our schemas
    were already implying.
  - @object-ui/types@4.4.0
  - @object-ui/core@4.4.0
  - @object-ui/i18n@4.4.0
  - @object-ui/react@4.4.0

## 4.3.1

### Patch Changes

- 6b683c8: fix(detail): clean up record page rendering

  - Drop `ai:chat_window` from the protocol-component placeholder list. The
    floating chat overlay (plugin-chatbot) is the canonical AI entry point;
    inline page schemas that still reference `ai:chat_window` now surface
    as an explicit "Unknown component type" so the misconfiguration is
    fixed at the source instead of silently leaking a placeholder card.
  - `page:header` now resolves `{field.path}` tokens in `title` / `description`
    against the current record context (matching the behaviour of the
    alternative `containers.tsx` renderer). Without this, schemas like
    `title: "{first_name} {last_name}"` rendered the literal template.
  - `containers.tsx` `PageHeaderRenderer`: also read from `schema.properties.*`
    as a fallback so both inlined and raw-bag schema shapes are supported.

- Updated dependencies [5f4ac6e]
  - @object-ui/i18n@4.3.1
  - @object-ui/react@4.3.1
  - @object-ui/types@4.3.1
  - @object-ui/core@4.3.1

## 4.3.0

### Patch Changes

- 4e7bc1b: **Report editor panel overhaul**

  The report configuration panel is now safe to open on any spec-shape `Report` and only exposes fields that are actually persisted by `@objectstack/spec`.

  `@object-ui/plugin-report`:

  - Add a bidirectional `SpecFilterAdapter` so `ReportConfigPanel` can edit
    spec `FilterCondition` filters (`{field: value}`, `{field: {$op: value}}`,
    top-level `$and`/`$or`). Complex / nested filters fall back to a
    read-only banner and are preserved verbatim on save.
  - Drop sections that never round-tripped through the spec
    (`conditionalFormatting`, `sections`, `export`, `schedule`, `appearance`)
    and their helper components.
  - Add type-driven section visibility: `tabular` shows Columns/Filters,
    `summary` adds Rows + Chart, `matrix` adds Rows + Columns axis + Chart.
  - New `GroupingsBuilder` covers `groupingsDown`/`groupingsAcross` with
    `sortOrder` and date-aware `dateGranularity` controls.
  - New `ColumnsEditor` lets users reorder picked columns, override labels,
    set aggregates and choose a display format.
  - Chart subset now mirrors the spec: chart `title`, `showLegend`,
    `showDataLabels`, plus `funnel` (scatter removed).
  - Validation banner highlights missing `objectName` and missing
    rows/columns for `matrix`/`summary` reports.
  - All editor labels and hints are i18n-driven (`report.editor.*`).
  - 18 new unit tests cover the filter adapter round-trip.

  `@object-ui/components`:

  - `FilterBuilder` now guards against malformed external `value` props.
    Previously a spec-shape filter (`{is_active: true}`) would crash the
    component on first render; the builder now falls back to an empty
    AND group whenever `value` is not a valid `FilterGroup`.

  `@object-ui/i18n`:

  - Add `report.editor.*` strings to `en` and `zh`.

- 8442c05: Improve report editor panel usability based on real-user browser testing:

  - **Wider config panel** — the report editor now defaults to a `--config-panel-width`
    of 440px (up from 280px), driven by a new optional `style` prop on
    `ConfigPanelRenderer`. Long field labels, report titles, type labels, and filter
    rows no longer truncate to "Account Na" / "kup" / "ct" / 1-character widths.
  - **Disambiguated "Columns" sections** — for `summary` and `matrix` reports the
    measure list is now labelled **"Values / 度量"** (pivot-style vocabulary) instead
    of "Columns", which previously clashed with the matrix's pivot column axis
    (also called "Columns / 列"). The two sections used to be indistinguishable.
    New i18n key `report.editor.values` / `valuesHint` is shipped for all 10
    locales (en, zh, ar, de, es, fr, ja, ko, pt, ru).
  - **Reordered sections for matrix/summary** — the editor now surfaces _Rows_
    and _Columns_ (the pivot axes) **before** _Values_, mirroring how a business
    user thinks about a pivot table.
  - **Per-row aggregate/format headers** — each column row in `ColumnsEditor` now
    shows small "Aggregate" / "Format" labels above the respective selects, and
    the row uses a 2-line layout so the label input has its own line. The cramped
    3-dropdowns-side-by-side layout at 10px font is gone.
  - **Searchable field picker** — the "Add columns" list now has a search box,
    a `filtered / total` counter, an empty-state message, and a scrollable bordered
    container. New i18n keys: `report.editor.searchFields`,
    `report.editor.noMatchingFields`.

- Updated dependencies [f196cf4]
- Updated dependencies [ee1cc96]
- Updated dependencies [0b032be]
- Updated dependencies [115d36a]
- Updated dependencies [4e7bc1b]
- Updated dependencies [8442c05]
  - @object-ui/i18n@4.3.0
  - @object-ui/react@4.3.0
  - @object-ui/types@4.3.0
  - @object-ui/core@4.3.0

## 4.2.1

### Patch Changes

- @object-ui/types@4.2.1
- @object-ui/core@4.2.1
- @object-ui/i18n@4.2.1
- @object-ui/react@4.2.1

## 4.2.0

### Patch Changes

- Updated dependencies [eb738bd]
- Updated dependencies [650392e]
- Updated dependencies [84b4bf1]
  - @object-ui/i18n@4.2.0
  - @object-ui/react@4.2.0
  - @object-ui/types@4.2.0
  - @object-ui/core@4.2.0

## 4.1.0

### Patch Changes

- @object-ui/types@4.1.0
- @object-ui/core@4.1.0
- @object-ui/i18n@4.1.0
- @object-ui/react@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12
- @object-ui/core@4.0.12
- @object-ui/i18n@4.0.12
- @object-ui/react@4.0.12

## 4.0.11

### Patch Changes

- Updated dependencies [1909bc3]
  - @object-ui/i18n@4.0.11
  - @object-ui/react@4.0.11
  - @object-ui/types@4.0.11
  - @object-ui/core@4.0.11

## 4.0.10

### Patch Changes

- @object-ui/types@4.0.10
- @object-ui/core@4.0.10
- @object-ui/i18n@4.0.10
- @object-ui/react@4.0.10

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9
- @object-ui/core@4.0.9
- @object-ui/i18n@4.0.9
- @object-ui/react@4.0.9

## 4.0.8

### Patch Changes

- Updated dependencies [3d58eaa]
  - @object-ui/i18n@4.0.8
  - @object-ui/react@4.0.8
  - @object-ui/types@4.0.8
  - @object-ui/core@4.0.8

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

- Updated dependencies [7c9b85c]
- Updated dependencies [fd15918]
  - @object-ui/core@4.0.7
  - @object-ui/react@4.0.7
  - @object-ui/i18n@4.0.7
  - @object-ui/types@4.0.7

## 4.0.6

### Patch Changes

- 925051d: fix: convert Tailwind v3 `[--var]` arbitrary value syntax to v4 `(--var)`

  Shadcn `Sidebar`, `Calendar`, `Chart`, `Popover`, `Tooltip`, `HoverCard`,
  `Menubar`, `Select`, `Dropdown`, `Context-Menu`, and `AppSidebar` used the
  Tailwind v3 syntax `w-[--sidebar-width]`, `origin-[--radix-...]`, etc.
  Tailwind v4 no longer interprets the bare `--xxx` inside arbitrary values
  as `var(--xxx)`, so the rule emits empty CSS — the sidebar collapses to
  0 width and overlays the main content, dropdown/popover positions fall
  back to the wrong origin, and the calendar cells lose their fixed size.

  Replaced all such occurrences with the v4 CSS-variable shorthand
  `w-(--sidebar-width)`, `origin-(--radix-...)`, etc. Existing
  `[calc(var(--xxx)*-1)]` arbitrary expressions are unaffected.

- 1b6dc64: fix: complete Tailwind v3→v4 migration cleanup
  - Rename deprecated `flex-shrink-0` → `shrink-0` and `flex-grow-N` →
    `grow-N` (Tailwind v4 dropped the long-form aliases). Affects
    data-table, fields/index, FileField, ChatbotEnhanced,
    FloatingChatbotPanel, ProcessDesigner, HistoryPanel, KanbanEnhanced,
    KanbanImpl, plugin-timeline index, FlowDesigner, LayoutRenderer.
  - Replace `theme(spacing.4)` inside arbitrary-value `[calc(...)]` with
    literal `1rem` in sidebar.tsx — `theme()` is deprecated in v4.
  - Remove obsolete v3-escape CSS overrides from index.css and
    sidebar-fixes.css. The component source now uses native v4 stacked
    data variants (`group-data-[state=collapsed]:group-data-[collapsible=icon]:w-(--sidebar-width-icon)`)
    which Tailwind v4 emits correctly without the manual overrides.
    Only the bespoke `.sidebar-menu-button-icon-mode*` rules are kept.
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

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1
- @object-ui/core@4.0.1
- @object-ui/i18n@4.0.1
- @object-ui/react@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0
  - @object-ui/core@4.0.0
  - @object-ui/react@4.0.0
  - @object-ui/i18n@4.0.0

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

- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
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

## 3.3.1

### Patch Changes

- b429568: chore(examples): relocate console templates under `examples/`

  The fork-ready ObjectStack console template moved from `apps/console-starter`
  to `examples/console-starter`, so `apps/` only contains real deployable
  products (`console`, `site`). The third-party integration demo
  `examples/minimal-console` was renamed to `examples/byo-backend-console`
  to make its "bring-your-own backend" purpose explicit and to remove the
  naming collision with the starter template. Source comments and READMEs in
  `@object-ui/app-shell` and `@object-ui/components` have been updated to
  point at the new paths; no runtime behaviour changed. A new
  `examples/README.md` provides a "which example should I use?" selector.

  - @object-ui/types@3.3.1
  - @object-ui/core@3.3.1
  - @object-ui/i18n@3.3.1
  - @object-ui/react@3.3.1

## 3.3.0

### Patch Changes

- @object-ui/types@3.3.0
- @object-ui/core@3.3.0
- @object-ui/i18n@3.3.0
- @object-ui/react@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0
- @object-ui/core@3.2.0
- @object-ui/i18n@3.2.0
- @object-ui/react@3.2.0

## 3.1.5

### Patch Changes

- @object-ui/react@3.1.5
- @object-ui/types@3.1.5
- @object-ui/core@3.1.5

## 3.1.4

### Patch Changes

- @object-ui/types@3.1.4
- @object-ui/core@3.1.4
- @object-ui/react@3.1.4

## 3.1.3

### Patch Changes

- @object-ui/types@3.1.3
- @object-ui/core@3.1.3
- @object-ui/react@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2
- @object-ui/core@3.1.2
- @object-ui/react@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1
  - @object-ui/core@3.1.1
  - @object-ui/react@3.1.1

## 3.0.3

### Patch Changes

- @object-ui/types@3.0.3
- @object-ui/core@3.0.3
- @object-ui/react@3.0.3

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2
- @object-ui/core@3.0.2
- @object-ui/react@3.0.2

## 3.0.1

### Patch Changes

- Updated dependencies [adf2cc0]
  - @object-ui/react@3.0.1
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

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

### Patch Changes

- Updated dependencies [b859617]
  - @object-ui/types@2.0.0
  - @object-ui/core@2.0.0
  - @object-ui/react@2.0.0

## 0.3.1

### Patch Changes

- Maintenance release - Documentation and build improvements
- Updated dependencies
  - @object-ui/types@0.3.1
  - @object-ui/core@0.3.1
  - @object-ui/react@0.3.1

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

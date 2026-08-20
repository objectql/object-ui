# @object-ui/types

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

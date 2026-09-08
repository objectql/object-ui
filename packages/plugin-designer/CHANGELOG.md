# @object-ui/plugin-designer

## 17.7.0

### Minor Changes

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
- d18a0d3: Object-level metadata payloads no longer emit the three keys `ObjectSchema` refuses by
  name — **group**, **sortOrder** and **relationships** (objectui#6223).
  
  Measured against the installed `@objectstack/spec` 17.2.0, whose `ObjectSchema` accept set
  is 42 keys:
  
  ```
  const base = { name: 'account', label: 'Account', fields: { n: { type: 'text', label: 'N' } } };
  
  ObjectSchema.safeParse(base)                              => success = true    (control)
  ObjectSchema.safeParse({ ...base, isSystem: true })       => success = true    (control)
  ObjectSchema.safeParse({ ...base, pluralLabel: 'A' })     => success = true    (control)
  
  ObjectSchema.safeParse({ ...base, group: 'Sales' })       => unrecognized_keys ["group"]
  ObjectSchema.safeParse({ ...base, sortOrder: 3 })         => unrecognized_keys ["sortOrder"]
  ObjectSchema.safeParse({ ...base, relationships: [ … ] }) => unrecognized_keys ["relationships"]
  ```
  
  The two controls are what make that a key-by-key result rather than a schema refusing
  everything. Each key was resolved on its own, as the objectui#5761 family ruling requires:
  
  - **group** — the Object Manager's grouping is a UI-only display category. The spec has no
    object-level grouping key (`fieldGroups` groups the fields *inside* one object), so the
    grouping control and its column stay, and the value is now DERIVED from the spec key that
    is accepted (`isSystem`) instead of round-tripped. `MetadataObjectsPage` also strips a
    `group` already stored by an earlier build, because its save-back spreads the server
    document verbatim and would otherwise keep re-sending it forever.
  - **sortOrder** — what populated it was the array index the converter happened to be at,
    i.e. the order the list was already in. The declaration is removed from the object
    payload. The field-level `sortOrder` is a different key with a different card
    (objectui#6045) and is untouched.
  - **relationships** — the spec models relationships on the FIELD (`reference` /
    `master_detail`, plus object-level `indexes`). The object payload stops declaring and
    sending an object-level relationship array; what the designer should author for a
    relationship is a data-model question this change does not settle.
  
  **Breaking for TypeScript consumers of `ObjectMetadataPayload`** (exported from app-shell):
  the three properties are gone from the published type, so code that set them stops
  compiling. That is the point — setting any of them produced a payload the metadata route
  refuses. `ObjectDefinition` (the designer's UI model) is unchanged and still carries all
  three.
  
  The parity gate built for objectui#5761 now has a **second oracle**: every shape in
  `PAYLOAD_SHAPES` names the schema that judges it, `ObjectSchema` alongside `FieldSchema`,
  and reach is resolved within an oracle rather than across one — `group` is a legal
  `FieldSchema` key and a refused `ObjectSchema` key at the same time. That extension found a
  fourth object-level key (`enabled`, objectui#6238) and a value-level rejection the key-name
  check cannot see (`fields` sent as an array where the spec wants a map, objectui#6240);
  both are filed and ledgered rather than fixed here.
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
- bdb4dbd: A half-filled relationship field stays in the client and is never PUT (objectui#7714,
  maintainer ruling on objectui#7122 item 4, 2026-09-05).
  
  **Breaking, deliberately, and stated rather than implied.** Both metadata writers —
  `MetadataService.saveFields` / `saveObject` in `@object-ui/app-shell`, and
  `MetadataFieldsPage` in `@object-ui/plugin-designer` — now REFUSE a `lookup` or
  `master_detail` field whose `reference` is missing, empty, blank or not a string. A
  caller that previously got a PUT now gets a thrown error and **no request at all**. The
  refusal is raised while the wire `fields` map is being built, so nothing is sent and
  nothing is partially applied.
  
  **Why the draft may not leave the client.** `@objectstack/spec` 17.3.0 turned
  `reference` from prose into a hard requirement on relationship types (a `custom`
  refinement at path `reference`). Driven against a real 17.3.0 backend in a running
  designer: creating a `lookup` and leaving its target empty PUT the whole object,
  came back `422 INVALID_METADATA` at `fields.<name>.reference` — and then the NEXT
  edit, to a different and already-saved field, was refused identically, because the
  half-filled draft rides along inside the same document. The author sees that later
  edit rendered as applied while the server has none of it, and the only escape that
  does not require noticing the lookup is a reload, which discards the work. An editing
  session's half-finished state belongs to the client, not to the metadata store.
  
  ⛔ **Not** "strip the incomplete field from the body and report a successful save".
  That shows the author a field the server never received — the silent-drop shape
  objectstack#4001 closed.
  
  ⚠️ **A declared divergence: objectui is stricter than the contract here.** The
  predicate is `typeof reference === 'string' && reference.trim() !== ''`. Measured on
  the 17.3.0 artifact, at field level and again through `ObjectSchema`, the spec
  ACCEPTS a whitespace-only `reference` while refusing an absent or empty one — so
  `reference: '   '` is refused by these writers on their own authority, not the
  platform's. Kept deliberately: whitespace names no object (the spec's own
  `ObjectSchema.fields` key grammar `/^[a-z_][a-z0-9_]*$/` admits no whitespace-bearing
  name), so admitting it only moves the identical failure past the PUT and into a stored
  document, where it surfaces with no field named. Filed upstream as objectstack#16126;
  if the spec trims, behaviour here is unchanged and only the declaration retires.
  
  The refusal message diagnoses which of the four states it found — absent, empty,
  non-string (`invalid_type`, a value of the wrong kind rather than a missing target),
  or blank — because the repair and the consequence differ per state.
  
  `minor` rather than `major` per `AGENTS.md`: objectui's major tracks `@objectstack`'s,
  so objectui's own breaking changes ship as `minor` with the breaking semantics stated.
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
- 2cf69e4: The field designer now reads and writes a lookup field's relationship target under the
  spec's spelling `reference` (objectui#6041), in both directions.
  
  `referenceTo` is not in `FieldSchema`'s accept set. Measured against the installed
  `@objectstack/spec` 17.2.0, through the whole object document that
  `PUT /api/v1/meta/object/:name` validates:
  
  ```
  ObjectSchema.safeParse({ …, fields: { rel: { type: 'lookup', label: 'Owner',
                                              referenceTo: 'user' } } })
    => success = false
    => unrecognized_keys at ["fields","rel"] keys=["referenceTo"]
       "Did you mean `referenceTo` -> `reference`?"
  ```
  
  so authoring a lookup field through the designer returned a hard 422 `INVALID_METADATA`,
  and — because the key is then stored — blocked **every subsequent save** of that object,
  with nothing in the UI to say which key did it.
  
  The read direction was broken symmetrically and is the half that would have survived a
  write-only fix: `toDesignerField` read `raw.referenceTo` while a spec-parsed server sends
  `reference`, so every already-saved lookup field loaded into the designer with an **empty
  reference box**. Both wire-bound payload shapes move — `FieldMetadataPayload`
  (`MetadataService.toFieldPayload`) and `ServerFieldSchema`
  (`MetadataFieldsPage.fromDesignerField`).
  
  `referenceTo` also joins `RETIRED_FIELD_KEYS`. Renaming the emit sites alone does not
  unblock an object whose stored fields already carry the misspelling: `carryOver` spreads
  the previous server def verbatim, so the key would ride straight back out to the same 422.
  The designer's in-memory `DesignerFieldDefinition` keeps `referenceTo` — that is the
  internal prop name every other UI surface in this repo already uses (`LookupField`,
  `filter-builder`, `ObjectChart`, `ListView`, `UserFilters`), it reaches no wire-bound
  shape, and the parity gate classifies it as `uiOnly` rather than a violation.
  
  No behavioural change for a half-filled draft: the spec's prose calls `reference`
  "required for relationship types", but that is not enforced by the zod parse at 17.2.0 —
  `{ type: 'lookup', label: 'L' }` parses green at field level and through `ObjectSchema`,
  and `undefined` is dropped by `JSON.stringify` under either spelling, so the wire bytes
  are identical before and after.
- 2cf69e4: The field designer now reads the system-field marker under the spec's spelling `system`,
  and never hands `isSystem` back to the metadata API (objectui#6044).
  
  `isSystem` is not in `FieldSchema`'s accept set. Measured against the installed
  `@objectstack/spec` 17.2.0:
  
  ```
  FieldSchema.safeParse({ type: 'text', label: 'L', isSystem: true })
    => success = false
    => unrecognized_keys keys=["isSystem"]  "Did you mean `isSystem` -> `system`?"
  ```
  
  Two defects, one misspelling, and they are two different sites.
  
  **The read was dead** — the quieter and worse half. `toDesignerField` read `raw.isSystem`
  while a spec-parsed server sends `system`, so the flag was always `undefined`. Nothing went
  red, because the flag is optional and `undefined` is a valid "not a system field". But it is
  load-bearing: `FieldDesigner` refuses to delete a system field and disables its name and
  type inputs, so with the read dead `organization_id`, `created_at` and friends presented as
  ordinary editable, **deletable** business fields.
  
  **The write had no emit site at all.** `fromDesignerField` never names `isSystem`; its only
  route out is the verbatim `...carryOver(prev)` spread, so a stored misspelling round-tripped
  back to `PUT /api/v1/meta/object/:name` as a hard 422 `INVALID_METADATA` that blocks every
  later save. The repair is a `RETIRED_FIELD_KEYS` tombstone rather than a renamed line — and
  it is deliberately paired with the read fix, never a substitute for it: stripping alone would
  close the 422 and fossilize the dead detection. The spec spelling `system` is not stripped,
  so a server-injected flag rides through untouched and feeds the read.
  
  `app-shell`'s `FieldMetadataPayload` never declared the key, so `toFieldPayload` had nothing
  to fix. The designer's in-memory `DesignerFieldDefinition` keeps `isSystem`: it reaches no
  wire-bound shape and the parity gate classifies it as `uiOnly`.
- 00c665e: `appDesigner.fieldDesigner.formula` is retired — one row removed from each of the ten
  locale packs plus the designer defaults map, 11 lines, zero readers (objectui#6310).
  
  objectui#6043 retired the Field Designer's formula-expression textarea, which was the
  key's only call site (`FieldDesigner.tsx`, the `{ name: 'formula', label:
  t('appDesigner.fieldDesigner.formula') }` field descriptor). The value outlived it in
  eleven places: `DESIGNER_DEFAULT_TRANSLATIONS` in
  `packages/plugin-designer/src/hooks/useDesignerTranslation.ts`, and the `appDesigner >
  fieldDesigner > formula` leaf of `packages/i18n/src/locales/{en,de,es,fr,pt,ru,ja,ko,zh,ar}.ts`.
  
  Removed under objectui#4658's evidence standard, re-measured on this branch rather than
  inherited from the card: zero `t()`/`tt()` call sites, no dynamic template head that could
  reach it (`appDesigner.fieldDesigner.typeCategory.` is the namespace's only one), and its
  sole textual occurrence anywhere in the repo was the defaults-map row this change removes
  with it — so the key goes from NEEDS-REVIEW to no footprint at all.
  
  The map and all ten packs move in one commit, which is what keeps
  `defaults-maps-mirror-en-pack` green: that gate fails a map row whose key the `en` pack
  lacks, and `all-locales-key-parity` fails a pack left behind.
  
  Not touched: `designer.field.formula` (`'Formula (CEL)'`) in
  `packages/app-shell/src/views/metadata-admin/i18n.ts`, a different and live key belonging
  to metadata-admin's `ObjectFieldInspector` — the surface that still authors formula
  expressions.
  
  `packages/i18n/src/__tests__/appDesigner-fieldDesigner-formula-retired-6310.test.ts` pins the
  removal by name, following the four prior retirements (objectui#4145, objectui#4392,
  objectui#4730, objectui#5504). Every i18n gate here runs call site → key, so none of them can
  see a dead key come BACK into the packs: the reverse sweep that found this one is report-only
  by design, `all-locales-key-parity` is fully satisfied by ten packs agreeing on a dead key, and
  `check:i18n-drift` only fires when a value changes. Reverse-verified rather than asserted —
  reviving the row in all ten packs turns exactly that one case red, naming each pack, while the
  parity gate and the defaults-map mirror stay green.
- 73e8c33: The Field Designer builds an object's `fields` map by defining own properties and refuses
  the three field lists a name-keyed map cannot carry (objectui#6489). `MetadataFieldsPage`
  keyed the map by blind assignment — `nextFields[f.name] = fromDesignerField(…)` inside a
  bare `for` loop — which failed silently in three directions, all measured on the installed
  `@objectstack/spec` 17.2.0:
  
  - **A field named `__proto__` never reached the wire.** `map['__proto__'] = def` invokes the
    prototype setter instead of creating a key, so the field vanished from the serialised PUT
    body. `__proto__` matches `ObjectSchema.fields`' key rule `/^[a-z_][a-z0-9_]*$/`, so the
    spec stood ready to accept the field the client had thrown away. The map is now built
    through `Object.fromEntries`, which defines an own property.
  - **A nameless field was stored under the literal key `"undefined"`.** Measured:
    `ObjectSchema.safeParse` with `fields: { undefined: … }` returns `success = true`, so the
    document parsed, persisted, and had no reader anywhere. It is now refused before the
    request.
  - **Two fields sharing a name collapsed into one entry.** A designer list carrying two
    `amount` fields PUT a single entry, the later silently replacing the earlier. Also refused
    before the request.
  
  Both refusals raise before `client.save`, so a refused list issues no PUT at all, and the
  message lands in the page's existing error surface naming the offending index — the caller
  is fire-and-forget (`void handleFieldsChange(next)`), so throwing past it would show the
  author nothing.
  
  This is the plugin-designer port of the refusals objectui#6240 landed in the sibling object
  writer (app-shell's `MetadataService.toFieldsMap`), down to the wording, so the two writers
  of the objectui#5761 parity family cannot drift. `fromDesignerField`'s carry-over semantics
  are untouched.
- b49f9a1: `MetadataObjectsPage` keys its object-name lookups as own entries, so deleting an object
  named `constructor` (or `__proto__`) from the Object Manager actually deletes it
  (objectui#6522).
  
  Both name lookups in the page were plain object literals filled by assignment, and the
  consequential one was a READ. The delete scan asked `!nextByName[name]`, which for an
  object named `constructor` answered out of `Object.prototype` with the `Object` function —
  truthy — so the deletion read as "still present" and `client.reset('object', …)` never
  fired. Not a refusal: the row disappeared from the manager, no error was shown, the save
  reported success, and the object was still there after the next reload. Measured against
  the installed `@objectstack/spec`, `ObjectSchema` pins object names to
  `/^[a-z_][a-z0-9_]*$/` and accepts both `constructor` and `__proto__` — those two are
  exactly the intersection with `Object.prototype`'s own names, so both are storable and
  neither was deletable.
  
  The second lookup, one function over, failed on the WRITE instead: `byName[item.name] =
  item` for an object named `__proto__` invoked the prototype setter rather than creating a
  key, so the object never became an own property, never reached the Object Manager at all,
  and left its payload on the lookup's prototype chain for later name lookups to answer out
  of. Both are now `Map`s — neither container is ever serialised, only its values are, so a
  `Map` fits where the sibling `MetadataFieldsPage` fields map (which IS the PUT body) needs
  `Object.fromEntries`.
  
  Keying only. Nameless and duplicate entries behave exactly as before: this page writes
  per-object, so the refusal semantics objectui#6489 added to the fields map are a separate
  question and are deliberately not ported here.
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
- 4db5989: A widget title stored as an inline per-locale map is editable again in both dashboard
  authoring surfaces, and a save writes back only the active locale's entry
  (objectui#5428).
  
  `@objectstack/spec` widened `I18nLabel` from `string` to `string | Record` at
  17.0.0-rc.6, so a stored widget title may be an inline per-locale map while both
  authoring panels edit a title in ONE single-line input. Writing the input's value back
  as the whole value would collapse every other locale on the first keystroke, so both
  surfaces took the same conservative branch: show a map-valued title resolved, and make
  it READ-ONLY.
  
  That branch could not lose data, but it rested on a premise the spec had already
  invalidated — "nothing can reach this path from stored metadata yet, `I18nLabel` was
  plain `string` through rc.5" — stated sixty lines below a comment in the same file
  documenting the rc.6 widening that makes a stored map reachable. Both could not hold.
  The pinned spec is 17.0.0. What the read-only branch did in practice from rc.6 onward
  was not protect an unreachable path: it denied an author the ability to edit a widget
  title in their own locale.
  
  objectui#5301's maintainer ruling settled the write rule for the sibling surface — a
  save replaces only the active locale's entry and preserves the others — and
  `@object-ui/i18n` ships it as `setLocalized`, co-located with `pickLocalized` because
  the read and the write have to agree. Both panels now adopt it:
  
  - `@object-ui/plugin-designer`'s `DashboardEditor` widget property panel;
  - `@object-ui/app-shell`'s `DashboardWidgetInspector` in metadata-admin.
  
  A plain-string title keeps saving as a plain string, so the common path is unchanged.
  An edit made in a locale the stored map does not carry ADDS an entry under that locale
  rather than overwriting the entry the display fell back to.
  
  The pins are preservation pins, not "the input is editable" pins: at both surfaces a
  keystroke on a map-valued title must leave every other locale's entry byte-identical.
  Reverse-verified by mutating each write back to the flattening form and confirming those
  assertions go red at both surfaces.
  
  Not a multi-locale editor: an author still reaches only the entry for the locale they
  are in. Authoring every locale from one panel remains an open product question. The
  stale deferrals both comments carried pointed at objectui#4163, which closed as
  completed on 2026-08-15 while the placeholders were still in the tree; they are replaced
  with the rule that is actually in force rather than re-pointed at another tracker.
- f7e34ca: Close the dashboard widget `type` vocabulary, and admit `metric-card` as objectui's own component extension.
  
  `DashboardWidgetSchema.type` was `string` on the TypeScript interface and `z.string()` in the Zod twin — an unbounded hatch. A typo'd family, a chart type the spec retired, and a component type nothing registers all type-checked and validated, surfacing only as the renderer's red `OBJUI-001` panel at runtime.
  
  It is now the CLOSED `DashboardWidgetTypeName` / `DashboardWidgetTypeSchema`: the spec's own `ChartTypeSchema` families **by reference**, plus two named, closed objectui extension sets — `DASHBOARD_WIDGET_TYPE_EXTENSIONS` (`list`, `custom`: objectui-only widget families) and `DASHBOARD_COMPONENT_WIDGET_TYPES` (`metric-card`: an objectui SDUI **component** type the widget slot holds directly, per the maintainer ruling of 2026-08-14 — objectui's own component enum, explicitly not the spec widget enum).
  
  Three drifts the closure surfaced and this change fixes: the dashboard designer's palette offered `grid`, which is not a widget family in either contract and was refused at publish; the metadata-admin widget inspector and the designer both wrote an unvalidated `string` from their select boxes; and a `@object-ui/types` fixture pinned `bar-chart`, a `plugin-charts` component type, on a dataset-bound widget that could never render as one.
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
- Updated dependencies [993f312]
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
- Updated dependencies [94e2fa7]
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
- Updated dependencies [5127378]
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
- Updated dependencies [f07b976]
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
- Updated dependencies [6a99bb2]
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
- Updated dependencies [53ded82]
- Updated dependencies [64a252d]
- Updated dependencies [d1bebb0]
- Updated dependencies [4f9f1ee]
- Updated dependencies [c842594]
- Updated dependencies [cf1d29e]
- Updated dependencies [0758bd8]
- Updated dependencies [f57ca75]
- Updated dependencies [0ea7054]
- Updated dependencies [fc32921]
- Updated dependencies [8f9d87a]
- Updated dependencies [6bca0e4]
- Updated dependencies [81c0bc4]
- Updated dependencies [3c76801]
- Updated dependencies [b2e85a9]
- Updated dependencies [d5c1f52]
- Updated dependencies [c7cd2b6]
- Updated dependencies [b2065e7]
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
- Updated dependencies [b470e91]
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
- Updated dependencies [8e00bfd]
- Updated dependencies [8d37efb]
- Updated dependencies [9850c6e]
- Updated dependencies [9118a31]
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
- Updated dependencies [57f9b07]
- Updated dependencies [3c73d99]
- Updated dependencies [d91aed9]
- Updated dependencies [ed71d9e]
- Updated dependencies [7776fc2]
- Updated dependencies [c86185e]
- Updated dependencies [fb96ecb]
- Updated dependencies [1170ed1]
- Updated dependencies [f75810e]
- Updated dependencies [4d73b07]
  - @object-ui/plugin-form@17.7.0
  - @object-ui/i18n@17.7.0
  - @object-ui/core@17.7.0
  - @object-ui/types@17.7.0
  - @object-ui/components@17.7.0
  - @object-ui/plugin-grid@17.7.0
  - @object-ui/react@17.7.0
  - @object-ui/data-objectstack@17.7.0

## 17.6.0

### Minor Changes

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
- Updated dependencies [88085e3]
- Updated dependencies [69251bf]
- Updated dependencies [57e668f]
- Updated dependencies [516663d]
- Updated dependencies [41ac1b7]
- Updated dependencies [1eaf0a1]
- Updated dependencies [a09bc33]
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
- Updated dependencies [1ef236e]
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
- Updated dependencies [f68018d]
- Updated dependencies [d374caf]
- Updated dependencies [5673576]
- Updated dependencies [c1ef923]
- Updated dependencies [911ceaa]
- Updated dependencies [98eab36]
- Updated dependencies [375efb4]
- Updated dependencies [af5e292]
- Updated dependencies [3fbbea1]
- Updated dependencies [0bffb18]
- Updated dependencies [3e0214c]
- Updated dependencies [800f455]
- Updated dependencies [dbbd38a]
- Updated dependencies [27c9cbd]
- Updated dependencies [5458414]
- Updated dependencies [3241559]
- Updated dependencies [7f96b10]
- Updated dependencies [167ec42]
- Updated dependencies [cf4f8a6]
- Updated dependencies [616a2a5]
- Updated dependencies [6c68b13]
- Updated dependencies [0046d8f]
- Updated dependencies [3b03704]
- Updated dependencies [f1d4748]
- Updated dependencies [bea374e]
- Updated dependencies [b1119ec]
- Updated dependencies [5607092]
- Updated dependencies [9f23d2b]
- Updated dependencies [b4089be]
- Updated dependencies [578e025]
- Updated dependencies [b4bccc7]
- Updated dependencies [af025ee]
- Updated dependencies [d109a4d]
- Updated dependencies [3d053bb]
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
- Updated dependencies [a8411ad]
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
- Updated dependencies [2165d88]
- Updated dependencies [8871c14]
- Updated dependencies [93fe362]
- Updated dependencies [dfc6975]
- Updated dependencies [3cf4de0]
- Updated dependencies [c9dc811]
- Updated dependencies [144ef9b]
- Updated dependencies [138ab04]
- Updated dependencies [d871f8e]
- Updated dependencies [a0b9e91]
- Updated dependencies [99bd015]
- Updated dependencies [21e4585]
  - @object-ui/types@17.6.0
  - @object-ui/fields@17.6.0
  - @object-ui/i18n@17.6.0
  - @object-ui/react@17.6.0
  - @object-ui/plugin-grid@17.6.0
  - @object-ui/components@17.6.0
  - @object-ui/core@17.6.0
  - @object-ui/data-objectstack@17.6.0
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

- abb0f81: A dashboard date filter's default has one spelling again — the bare preset name — and the `{ preset }` object becomes a documented legacy alias with a retirement window

  `@objectstack/spec` 17.0.0-rc.6 added a cross-field refinement to `GlobalFilterSchema` holding a `type: 'date'` filter's `defaultValue` to three spellings: a preset NAME (`last_7_days`), an ISO date (`2026-01-15`), or a date-macro token (`{today}`). objectui's derived schema had widened `defaultValue` to `z.any()` and did not carry the refinement, so it accepted `{ preset: 'last_7_days' }` — metadata the platform refuses. That is the tolerant-consumer shape where the designer goes green and the save fails server-side, and it is now closed: the refinement is adopted, the widening is retired, and the object form is refused with the spec's own message.

  Per the maintainer ruling on objectui#4165, the spec stays strict and the bare preset name is the single canonical spelling. `{ preset }` is handled as an ADR-0089 legacy alias rather than by a permanently tolerant schema: `liftLegacyGlobalFilterDefault` / `liftLegacyDashboardFilterDefaults` (new exports on `@object-ui/types`) convert it to the bare name, `@object-ui/core`'s `resolveDashboardFilterDefs` applies the lift when it reads a stored dashboard, and the console's dashboard designer applies it as the document enters the editable draft so the next save persists the canonical spelling. The retirement window is recorded at the read site: the alias may be removed in `@object-ui/types` 18.0.0, and every lift warns on the console so a surviving legacy document is visible rather than silently tolerated.

  No stored dashboard has to change for this release. The lift means a document carrying the object form keeps loading and rendering exactly as before — measured, not assumed: a legacy declaration already resolved correctly, because `{ preset }` also happens to be the runtime value shape objectui's own date filters use, and that coincidence is why the object form went unnoticed for so long. What changes is that the declaration is now canonicalized on read and rewritten on save, so the two spellings converge instead of accreting.

  The other two divergences in this schema — the bare-string `options` shorthand and the optional `optionsFrom.labelField` — are unaffected. Carrying the spec's refinement while keeping them needed a new composition: a refined object schema in zod 4 rejects `.extend()` and `.omit()` outright and types every `.safeExtend()` override as `never`, so objectui's schema now spreads the spec's shape and re-attaches the spec's object-level rules by delegating to the spec schema itself. Nothing restates the spec's grammar, and a refinement the spec adds later flows in with no change here.

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

- e076fd5: Inline-edit toggle reads "Edit fields" without an I18nProvider, matching every locale pack

  `DETAIL_DEFAULT_TRANSLATIONS` said `Edit fields inline` where all ten packs say
  `Edit fields`, so `InlineEditSaveBar`'s toggle announced two different names for one
  control — the map's on provider-less hosts (standalone embeds, the preview gallery),
  the pack's in the console. The pack wins; the map row now mirrors it byte for byte.

  The three ungated defaults maps (`plugin-detail`, `plugin-list`, `plugin-designer`) are
  now compared key-by-key against the `en` pack by a new gate, generalizing the
  collaboration-only precedent from objectui#3440. `LIST_DEFAULT_TRANSLATIONS` and
  `DESIGNER_DEFAULT_TRANSLATIONS` are exported for it, as `DETAIL_DEFAULT_TRANSLATIONS`
  and `COLLAB_DEFAULT_TRANSLATIONS` already were.

- dad805d: Six i18n keys no longer render as raw key strings on hosts with no `I18nProvider` (objectui#4396)

  `detail.saving`, `list.resetSortToDefault`, `appDesigner.widgetProperties`, `appDesigner.addWidget`, `appDesigner.modeEdit` and `common.delete` were read through `createSafeTranslation` without a row in their hook's defaults table and without an inline `defaultValue` at the call site — the only two fallbacks that path has. On a provider-less host (standalone embedding, the preview gallery, host apps that never mount a provider) `fallbackT` therefore returned the key itself, so users saw `detail.saving` in the inline-edit save button, `list.resetSortToDefault` on the sort popover's reset control, `appDesigner.widgetProperties` as the dashboard inspector heading, `appDesigner.addWidget` as its toolbar label, `appDesigner.modeEdit` as a button's accessible name, and `common.delete` on the designer's destructive confirm.

  Each key now has a row in its consumer hook's defaults table, byte-identical to the `en` pack value. No pack was edited, no key added, no call site changed.

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
- Updated dependencies [7ffd616]
- Updated dependencies [d0c3b26]
- Updated dependencies [3fc2971]
- Updated dependencies [aca27fa]
- Updated dependencies [dde7283]
- Updated dependencies [f7c6430]
- Updated dependencies [4dadf0d]
- Updated dependencies [ae10a01]
- Updated dependencies [77d6f28]
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
- Updated dependencies [537a0d1]
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
- Updated dependencies [51ab34e]
- Updated dependencies [24bb2de]
- Updated dependencies [0ca6096]
- Updated dependencies [3e19fe7]
- Updated dependencies [bb58d1d]
- Updated dependencies [433ff9f]
- Updated dependencies [5cc847c]
- Updated dependencies [e7663f2]
- Updated dependencies [fa21254]
- Updated dependencies [f565418]
- Updated dependencies [33c32bf]
- Updated dependencies [66fb4fa]
- Updated dependencies [b953a97]
- Updated dependencies [d7f3e30]
- Updated dependencies [6d641c9]
- Updated dependencies [479cc7b]
- Updated dependencies [7e4f0e5]
- Updated dependencies [a84385b]
- Updated dependencies [45e1949]
- Updated dependencies [51ac39f]
- Updated dependencies [5e514c4]
- Updated dependencies [92250d6]
- Updated dependencies [c1d939f]
- Updated dependencies [58bebf6]
- Updated dependencies [36310dc]
- Updated dependencies [52d878a]
- Updated dependencies [405e808]
- Updated dependencies [49ae9f4]
- Updated dependencies [a3ae404]
- Updated dependencies [4270c11]
- Updated dependencies [bfdf3d4]
- Updated dependencies [bb68488]
- Updated dependencies [c0f9a4b]
- Updated dependencies [b1e42d0]
- Updated dependencies [2459a3e]
- Updated dependencies [2776b11]
- Updated dependencies [ac853ce]
- Updated dependencies [fa51109]
- Updated dependencies [d6aa172]
- Updated dependencies [c32a8a1]
- Updated dependencies [fe52a04]
- Updated dependencies [d46f9b8]
- Updated dependencies [3f5f87c]
- Updated dependencies [605b747]
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
- Updated dependencies [b42558a]
- Updated dependencies [d2f6e6b]
- Updated dependencies [ab04728]
- Updated dependencies [85a3082]
- Updated dependencies [5bf09fd]
- Updated dependencies [06915b0]
- Updated dependencies [ff84b05]
  - @object-ui/i18n@17.5.0
  - @object-ui/react@17.5.0
  - @object-ui/components@17.5.0
  - @object-ui/core@17.5.0
  - @object-ui/fields@17.5.0
  - @object-ui/data-objectstack@17.5.0
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
- Updated dependencies [0186cdc]
- Updated dependencies [7864f03]
- Updated dependencies [ea41a59]
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
- Updated dependencies [3765678]
- Updated dependencies [d83f6b3]
- Updated dependencies [5f08c05]
- Updated dependencies [69becd2]
- Updated dependencies [5e52495]
- Updated dependencies [0fa5e4d]
- Updated dependencies [b750823]
- Updated dependencies [5bfaabd]
- Updated dependencies [022002a]
- Updated dependencies [e06810e]
- Updated dependencies [ab3ad4f]
- Updated dependencies [65bb513]
- Updated dependencies [c97a45e]
- Updated dependencies [b19162d]
- Updated dependencies [c2fd122]
- Updated dependencies [1bd6faa]
- Updated dependencies [9154d9e]
- Updated dependencies [ac2139c]
- Updated dependencies [b14ab3a]
- Updated dependencies [e24d767]
- Updated dependencies [8c60819]
- Updated dependencies [aca561a]
- Updated dependencies [41d6022]
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
  - @object-ui/fields@17.4.0
  - @object-ui/i18n@17.4.0
  - @object-ui/types@17.4.0
  - @object-ui/plugin-grid@17.4.0
  - @object-ui/plugin-form@17.4.0
  - @object-ui/data-objectstack@17.4.0

## 17.3.0

### Patch Changes

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
  - @object-ui/plugin-grid@17.3.0
  - @object-ui/i18n@17.3.0
  - @object-ui/react@17.3.0
  - @object-ui/plugin-form@17.3.0
  - @object-ui/data-objectstack@17.3.0

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
- Updated dependencies [c5ccbd5]
- Updated dependencies [d9668a7]
- Updated dependencies [4b470b9]
- Updated dependencies [785b8a5]
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
  - @object-ui/data-objectstack@17.2.0
  - @object-ui/fields@17.2.0

## 17.1.0

### Patch Changes

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

- Updated dependencies [62311b6]
- Updated dependencies [fc0272a]
- Updated dependencies [9e7349e]
- Updated dependencies [8864971]
- Updated dependencies [9b773f9]
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
- Updated dependencies [7d35010]
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
- Updated dependencies [a17ef09]
- Updated dependencies [eb4b740]
- Updated dependencies [aecc934]
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
  - @object-ui/data-objectstack@17.1.0
  - @object-ui/i18n@17.1.0
  - @object-ui/plugin-form@17.1.0
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
- Updated dependencies [341bfb5]
- Updated dependencies [2f947e4]
- Updated dependencies [7d46648]
- Updated dependencies [6e8fd3c]
- Updated dependencies [9b53d72]
- Updated dependencies [bb4aa25]
- Updated dependencies [75f1cdf]
- Updated dependencies [662bdf9]
- Updated dependencies [059a052]
- Updated dependencies [53642d4]
- Updated dependencies [8aae006]
- Updated dependencies [d62fb1f]
- Updated dependencies [c6cfdf1]
- Updated dependencies [dc7a798]
- Updated dependencies [d147a13]
- Updated dependencies [c6aaed8]
- Updated dependencies [263f885]
- Updated dependencies [dc334da]
  - @object-ui/components@17.0.0
  - @object-ui/i18n@17.0.0
  - @object-ui/fields@17.0.0
  - @object-ui/react@17.0.0
  - @object-ui/plugin-grid@17.0.0
  - @object-ui/types@17.0.0
  - @object-ui/data-objectstack@17.0.0
  - @object-ui/core@17.0.0
  - @object-ui/plugin-form@17.0.0

## 16.1.0

### Minor Changes

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

- 549c67d: chore(lint): clear the mechanical baseline lint errors so these packages' lint gates protect them again

  Extends the fields/core cleanup from #2709 (objectui#2713). These eight package
  lints were red at baseline on `main`, so their per-package `lint` gate could not
  catch new violations of the same class. Cleared every **error** (no behavior
  change; warnings are out of scope):

  - **`no-useless-catch`** (`data-objectstack`) — unwrapped five try/catch blocks
    whose `catch` only re-threw; errors still propagate identically.
  - **`preserve-caught-error`** (`cli`, `data-objectstack`, `react`) — the caught
    error's message is inlined into the thrown `Error`; a scoped disable with a
    justifying comment carries each one, because these packages target ES2020
    whose lib types the 1-arg `Error` constructor only (so `{ cause }` won't
    compile) — same reasoning as the core case in #2709.
  - **`prefer-const`** (`plugin-calendar`, `plugin-map`) — `let`→`const` for
    never-reassigned bindings.
  - **`no-empty-object-type`** (`plugin-designer`) — empty extend-only interfaces
    → equivalent `type` aliases.
  - **`no-useless-assignment`** (`react`) — dropped a dead initializer that both
    branches overwrite before it is read.
  - **`no-require-imports`** (`plugin-calendar`, `plugin-timeline` tests) —
    hoisted `vi.mock` factories now use an `async` factory with
    `await import('react')` instead of `require('react')`.
  - **stale `eslint-disable` directive** (`plugin-markdown`) — removed a
    `react/no-danger` disable whose plugin is not loaded in the flat config (an
    unknown-rule reference that ESLint v10 reports as an error); the rationale is
    kept as a plain comment.

- Updated dependencies [0318118]
- Updated dependencies [1c8935a]
- Updated dependencies [af1b0db]
- Updated dependencies [8b8b744]
- Updated dependencies [7cf4051]
- Updated dependencies [803558e]
- Updated dependencies [aefcf39]
- Updated dependencies [8c1e415]
- Updated dependencies [0ea5036]
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
  - @object-ui/data-objectstack@16.1.0
  - @object-ui/types@16.1.0
  - @object-ui/react@16.1.0
  - @object-ui/plugin-form@16.1.0
  - @object-ui/components@16.1.0
  - @object-ui/plugin-grid@16.1.0

## 16.0.0

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
  - @object-ui/fields@16.0.0
  - @object-ui/core@16.0.0
  - @object-ui/data-objectstack@16.0.0

## 15.0.0

### Patch Changes

- @object-ui/types@15.0.0
- @object-ui/core@15.0.0
- @object-ui/i18n@15.0.0
- @object-ui/react@15.0.0
- @object-ui/components@15.0.0
- @object-ui/fields@15.0.0
- @object-ui/data-objectstack@15.0.0
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
- Updated dependencies [2b30583]
- Updated dependencies [23d65c3]
- Updated dependencies [06d5ec6]
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
  - @object-ui/plugin-form@14.1.0
  - @object-ui/plugin-grid@14.1.0
  - @object-ui/components@14.1.0
  - @object-ui/data-objectstack@14.1.0

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
  - @object-ui/plugin-grid@14.0.0
  - @object-ui/components@14.0.0
  - @object-ui/fields@14.0.0
  - @object-ui/data-objectstack@14.0.0
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
  - @object-ui/data-objectstack@13.2.0
  - @object-ui/fields@13.2.0
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
- @object-ui/fields@13.1.0
- @object-ui/data-objectstack@13.1.0
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
  - @object-ui/fields@13.0.0
  - @object-ui/plugin-form@13.0.0
  - @object-ui/plugin-grid@13.0.0
  - @object-ui/react@13.0.0
  - @object-ui/core@13.0.0
  - @object-ui/data-objectstack@13.0.0

## 12.1.0

### Patch Changes

- Updated dependencies [6cbccf3]
- Updated dependencies [e1840bf]
- Updated dependencies [c31874d]
- Updated dependencies [195121a]
  - @object-ui/components@12.1.0
  - @object-ui/fields@12.1.0
  - @object-ui/i18n@12.1.0
  - @object-ui/types@12.1.0
  - @object-ui/plugin-form@12.1.0
  - @object-ui/plugin-grid@12.1.0
  - @object-ui/react@12.1.0
  - @object-ui/core@12.1.0
  - @object-ui/data-objectstack@12.1.0

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
  - @object-ui/plugin-form@12.0.0
  - @object-ui/plugin-grid@12.0.0
  - @object-ui/data-objectstack@12.0.0
  - @object-ui/react@12.0.0
  - @object-ui/i18n@12.0.0

## 11.5.0

### Patch Changes

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
  - @object-ui/data-objectstack@11.5.0
  - @object-ui/fields@11.5.0
  - @object-ui/core@11.5.0

## 11.4.0

### Patch Changes

- Updated dependencies [8bf6295]
- Updated dependencies [144ab55]
- Updated dependencies [1948c5b]
- Updated dependencies [3e42680]
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
- Updated dependencies [c0164ad]
- Updated dependencies [1e9145d]
- Updated dependencies [09e1b26]
- Updated dependencies [e84d64d]
  - @object-ui/plugin-form@11.4.0
  - @object-ui/types@11.4.0
  - @object-ui/plugin-grid@11.4.0
  - @object-ui/components@11.4.0
  - @object-ui/fields@11.4.0
  - @object-ui/i18n@11.4.0
  - @object-ui/data-objectstack@11.4.0
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
  - @object-ui/i18n@11.3.0
  - @object-ui/plugin-grid@11.3.0
  - @object-ui/core@11.3.0
  - @object-ui/fields@11.3.0
  - @object-ui/plugin-form@11.3.0
  - @object-ui/react@11.3.0
  - @object-ui/data-objectstack@11.3.0
  - @object-ui/types@11.3.0

## 11.2.0

### Patch Changes

- Updated dependencies [9e7a986]
- Updated dependencies [1311749]
  - @object-ui/components@11.2.0
  - @object-ui/core@11.2.0
  - @object-ui/fields@11.2.0
  - @object-ui/plugin-form@11.2.0
  - @object-ui/plugin-grid@11.2.0
  - @object-ui/data-objectstack@11.2.0
  - @object-ui/react@11.2.0
  - @object-ui/types@11.2.0
  - @object-ui/i18n@11.2.0

## 11.1.0

### Patch Changes

- Updated dependencies [6726a2b]
  - @object-ui/i18n@11.1.0
  - @object-ui/components@11.1.0
  - @object-ui/fields@11.1.0
  - @object-ui/plugin-form@11.1.0
  - @object-ui/plugin-grid@11.1.0
  - @object-ui/react@11.1.0
  - @object-ui/types@11.1.0
  - @object-ui/core@11.1.0
  - @object-ui/data-objectstack@11.1.0

## 7.3.0

### Patch Changes

- Updated dependencies [788dbf9]
  - @object-ui/fields@7.3.0
  - @object-ui/plugin-form@7.3.0
  - @object-ui/plugin-grid@7.3.0
  - @object-ui/types@7.3.0
  - @object-ui/core@7.3.0
  - @object-ui/i18n@7.3.0
  - @object-ui/react@7.3.0
  - @object-ui/components@7.3.0
  - @object-ui/data-objectstack@7.3.0

## 7.2.0

### Patch Changes

- Updated dependencies [8e7c1da]
- Updated dependencies [0caea33]
- Updated dependencies [4aa8b84]
- Updated dependencies [d23db5c]
  - @object-ui/i18n@7.2.0
  - @object-ui/plugin-grid@7.2.0
  - @object-ui/plugin-form@7.2.0
  - @object-ui/types@7.2.0
  - @object-ui/components@7.2.0
  - @object-ui/fields@7.2.0
  - @object-ui/react@7.2.0
  - @object-ui/core@7.2.0
  - @object-ui/data-objectstack@7.2.0

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
  - @object-ui/data-objectstack@7.1.0
  - @object-ui/fields@7.1.0
  - @object-ui/plugin-grid@7.1.0
  - @object-ui/i18n@7.1.0

## 7.0.0

### Patch Changes

- Updated dependencies [5976ba3]
- Updated dependencies [a00e16d]
- Updated dependencies [eaccefd]
- Updated dependencies [f7f325d]
- Updated dependencies [c12986e]
- Updated dependencies [71d7ce0]
- Updated dependencies [30ee761]
- Updated dependencies [053c948]
- Updated dependencies [b99d9bd]
- Updated dependencies [053c948]
- Updated dependencies [89e113c]
- Updated dependencies [ddbe4a2]
- Updated dependencies [2d47e94]
- Updated dependencies [9049bbe]
- Updated dependencies [77cc6bb]
- Updated dependencies [6c0c92c]
- Updated dependencies [97c6831]
- Updated dependencies [cb2fdb1]
- Updated dependencies [a58c6b8]
- Updated dependencies [c3749eb]
- Updated dependencies [c09f44e]
- Updated dependencies [f6044fa]
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
- Updated dependencies [db8cd00]
- Updated dependencies [650bd1f]
- Updated dependencies [2f31406]
- Updated dependencies [18728c1]
- Updated dependencies [8426db7]
- Updated dependencies [8d1195d]
  - @object-ui/core@7.0.0
  - @object-ui/components@7.0.0
  - @object-ui/plugin-grid@7.0.0
  - @object-ui/react@7.0.0
  - @object-ui/data-objectstack@7.0.0
  - @object-ui/i18n@7.0.0
  - @object-ui/types@7.0.0
  - @object-ui/plugin-form@7.0.0
  - @object-ui/fields@7.0.0

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3
- @object-ui/core@6.2.3
- @object-ui/i18n@6.2.3
- @object-ui/react@6.2.3
- @object-ui/components@6.2.3
- @object-ui/fields@6.2.3
- @object-ui/data-objectstack@6.2.3
- @object-ui/plugin-form@6.2.3
- @object-ui/plugin-grid@6.2.3

## 6.2.2

### Patch Changes

- Updated dependencies [a66f788]
  - @object-ui/react@6.2.2
  - @object-ui/components@6.2.2
  - @object-ui/fields@6.2.2
  - @object-ui/plugin-form@6.2.2
  - @object-ui/plugin-grid@6.2.2
  - @object-ui/types@6.2.2
  - @object-ui/core@6.2.2
  - @object-ui/i18n@6.2.2
  - @object-ui/data-objectstack@6.2.2

## 6.2.1

### Patch Changes

- @object-ui/types@6.2.1
- @object-ui/core@6.2.1
- @object-ui/i18n@6.2.1
- @object-ui/react@6.2.1
- @object-ui/components@6.2.1
- @object-ui/fields@6.2.1
- @object-ui/data-objectstack@6.2.1
- @object-ui/plugin-form@6.2.1
- @object-ui/plugin-grid@6.2.1

## 6.2.0

### Minor Changes

- fe3c1d3: Metadata Admin engine — unified UI for all 27 metadata types.

  A generic, schema-driven admin shell that replaces the old per-type
  bespoke pages with a single registry-driven engine. Admins can now browse,
  create, override, diff, and roll back every registered metadata type from
  the Setup app → _All Metadata Types_.

  ### New: `@object-ui/app-shell` views/metadata-admin

  - **`MetadataDirectoryPage`** — auto-grouped tile directory by domain, with
    free-text search, domain chips, and a _Writable only_ filter.
  - **`MetadataResourceListPage` / `MetadataResourceEditPage` / `…CreatePage` / `…HistoryPage`** —
    generic CRUD shell. Uses the new `/meta/types` schema field to render
    SchemaForm; uses `?layers=code,overlay,effective` to power a 3-state diff
    tab; uses `/references` to warn before destructive deletes.
  - **`MetadataQuickFind`** — Cmd+Shift+M palette searching across types and
    items.
  - **`PermissionMatrixEditor`** — Salesforce-style matrix custom editor for
    `type=permission`. Objects × CRUD/VAMA/lifecycle columns with cascade
    rules (viewAllRecords ⟹ allowRead, etc.), expandable per-object field
    R/W subtable, bulk-set (R / CRUD / All / None), filter, _only granted_
    toggle, destructive-change confirmation, profile switch.
  - **`DesignerEditorWrapper`** — generic load–edit–save shell that hosts any
    bespoke designer (`ObjectViewConfigurator`, `DashboardEditor`,
    `PageCanvasEditor`, …). Handles dirty tracking, Save / Reset / Refresh /
    History buttons, and the read-only fallback when `allowOrgOverride` is
    false.
  - **`i18n.ts`** — bilingual (`en-US`, `zh-CN`) bundle for built-in type
    labels, domain labels, and engine UI strings, with `detectLocale()` and a
    `t(key)` helper.

  ### New routing variant

  - App nav now supports `{ type: 'component', componentRef, params? }` items.
    `AppContent` resolves them through the existing `ComponentRegistry`.
  - Built-in components registered: `metadata:directory`, `metadata:resource`,
    `metadata:object/edit` (FieldsPage), `metadata:permission/edit`
    (PermissionMatrixEditor), and lazy designer wrappers for view / dashboard
    / page.

  ### Plugin-designer

  - Lazy-exported `ObjectManager`, `FieldDesigner`, `ObjectViewConfigurator`,
    `DashboardEditor`, `PageCanvasEditor`, `MetadataObjectsPage`, and
    `MetadataFieldsPage` so the engine can mount them on demand.

  The temporary `/dev/meta` route is removed. Setup app navigation flows
  through the new component routes.

- ec8dcde: Add visual editing for object & field metadata in the Setup app.

  **`@object-ui/data-objectstack`** — new `MetadataClient` class. A thin,
  auth-friendly wrapper over the framework's `/api/v1/meta/*` REST
  endpoints (list / get / save / reset / history), with first-class
  support for `If-Match` (optimistic concurrency), `X-Actor` (audit
  attribution), environment-scoped paths
  (`/environments/:id/meta/*`), and 404-as-null semantics. Use
  `new MetadataClient({ baseUrl })` or `client.withEnvironment(id)` to
  target a specific environment.

  **`@object-ui/plugin-designer`** — two new route-ready pages that
  together close the "Data Model" management loop in the Setup app:

  - `MetadataObjectsPage` — lists every object schema (via
    `MetadataClient.list('object')`), renders the existing
    `ObjectManager`, and persists edits/deletes through PUT/DELETE on
    the metadata REST surface. Honours `allowRuntimeCreate` and
    surfaces server errors verbatim.
  - `MetadataFieldsPage` — for a single object, loads the parent
    schema, projects `fields` into the existing `FieldDesigner`, and
    on save merges the edited field map back into the object before
    issuing a single PUT. Preserves unknown per-field attributes so
    nothing the designer doesn't render is dropped.

  Both pages take either a pre-built `MetadataClient` or a
  `MetadataClientConfig`; neither imposes a routing convention on the
  host app — they can be mounted anywhere (e.g.
  `/apps/setup/_meta/object` and `/apps/setup/_meta/object/:name/fields`).

  These additions do not modify the underlying `ObjectManager` /
  `FieldDesigner` components, which remain pure controlled-input
  components usable in non-REST contexts.

### Patch Changes

- Updated dependencies [fe3c1d3]
- Updated dependencies [ec8dcde]
  - @object-ui/data-objectstack@6.2.0
  - @object-ui/plugin-form@6.2.0
  - @object-ui/plugin-grid@6.2.0
  - @object-ui/react@6.2.0
  - @object-ui/components@6.2.0
  - @object-ui/fields@6.2.0
  - @object-ui/types@6.2.0
  - @object-ui/core@6.2.0
  - @object-ui/i18n@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/core@6.1.0
  - @object-ui/types@6.1.0
  - @object-ui/components@6.1.0
  - @object-ui/fields@6.1.0
  - @object-ui/plugin-form@6.1.0
  - @object-ui/plugin-grid@6.1.0
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
- @object-ui/plugin-form@6.0.4
- @object-ui/plugin-grid@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3
- @object-ui/core@6.0.3
- @object-ui/i18n@6.0.3
- @object-ui/react@6.0.3
- @object-ui/components@6.0.3
- @object-ui/fields@6.0.3
- @object-ui/plugin-form@6.0.3
- @object-ui/plugin-grid@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2
- @object-ui/core@6.0.2
- @object-ui/i18n@6.0.2
- @object-ui/react@6.0.2
- @object-ui/components@6.0.2
- @object-ui/fields@6.0.2
- @object-ui/plugin-form@6.0.2
- @object-ui/plugin-grid@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1
- @object-ui/core@6.0.1
- @object-ui/i18n@6.0.1
- @object-ui/react@6.0.1
- @object-ui/components@6.0.1
- @object-ui/fields@6.0.1
- @object-ui/plugin-form@6.0.1
- @object-ui/plugin-grid@6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0
- @object-ui/core@6.0.0
- @object-ui/i18n@6.0.0
- @object-ui/react@6.0.0
- @object-ui/components@6.0.0
- @object-ui/fields@6.0.0
- @object-ui/plugin-form@6.0.0
- @object-ui/plugin-grid@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2
- @object-ui/core@5.4.2
- @object-ui/i18n@5.4.2
- @object-ui/react@5.4.2
- @object-ui/components@5.4.2
- @object-ui/fields@5.4.2
- @object-ui/plugin-form@5.4.2
- @object-ui/plugin-grid@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1
- @object-ui/core@5.4.1
- @object-ui/i18n@5.4.1
- @object-ui/react@5.4.1
- @object-ui/components@5.4.1
- @object-ui/fields@5.4.1
- @object-ui/plugin-form@5.4.1
- @object-ui/plugin-grid@5.4.1

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0
  - @object-ui/components@5.4.0
  - @object-ui/core@5.4.0
  - @object-ui/fields@5.4.0
  - @object-ui/plugin-form@5.4.0
  - @object-ui/plugin-grid@5.4.0
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
- @object-ui/plugin-form@5.3.2
- @object-ui/plugin-grid@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1
- @object-ui/core@5.3.1
- @object-ui/i18n@5.3.1
- @object-ui/react@5.3.1
- @object-ui/components@5.3.1
- @object-ui/fields@5.3.1
- @object-ui/plugin-form@5.3.1
- @object-ui/plugin-grid@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0
- @object-ui/core@5.3.0
- @object-ui/i18n@5.3.0
- @object-ui/react@5.3.0
- @object-ui/components@5.3.0
- @object-ui/fields@5.3.0
- @object-ui/plugin-form@5.3.0
- @object-ui/plugin-grid@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1
- @object-ui/core@5.2.1
- @object-ui/i18n@5.2.1
- @object-ui/react@5.2.1
- @object-ui/components@5.2.1
- @object-ui/fields@5.2.1
- @object-ui/plugin-form@5.2.1
- @object-ui/plugin-grid@5.2.1

## 5.2.0

### Patch Changes

- Updated dependencies [de0c5e6]
- Updated dependencies [e3160a5]
- Updated dependencies [9997cae]
- Updated dependencies [321294c]
- Updated dependencies [b2d1704]
- Updated dependencies [0a644f0]
- Updated dependencies [a3cb88f]
- Updated dependencies [5425608]
- Updated dependencies [6c3f018]
- Updated dependencies [d912a60]
- Updated dependencies [5633edd]
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
  - @object-ui/plugin-grid@5.2.0
  - @object-ui/i18n@5.2.0
  - @object-ui/react@5.2.0
  - @object-ui/fields@5.2.0
  - @object-ui/components@5.2.0
  - @object-ui/plugin-form@5.2.0

## 5.1.1

### Patch Changes

- Updated dependencies [8955b9c]
  - @object-ui/components@5.1.1
  - @object-ui/fields@5.1.1
  - @object-ui/plugin-form@5.1.1
  - @object-ui/plugin-grid@5.1.1
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
  - @object-ui/plugin-form@5.1.0
  - @object-ui/fields@5.1.0
  - @object-ui/plugin-grid@5.1.0

## 5.0.2

### Patch Changes

- Updated dependencies [cab6a93]
- Updated dependencies [a311e22]
  - @object-ui/plugin-grid@5.0.2
  - @object-ui/i18n@5.0.2
  - @object-ui/plugin-form@5.0.2
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
  - @object-ui/i18n@5.0.0
  - @object-ui/react@5.0.0
  - @object-ui/types@5.0.0
  - @object-ui/fields@5.0.0
  - @object-ui/plugin-form@5.0.0
  - @object-ui/plugin-grid@5.0.0
  - @object-ui/core@5.0.0

## 4.8.0

### Patch Changes

- @object-ui/types@4.8.0
- @object-ui/core@4.8.0
- @object-ui/i18n@4.8.0
- @object-ui/react@4.8.0
- @object-ui/components@4.8.0
- @object-ui/fields@4.8.0
- @object-ui/plugin-form@4.8.0
- @object-ui/plugin-grid@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0
- @object-ui/core@4.7.0
- @object-ui/i18n@4.7.0
- @object-ui/react@4.7.0
- @object-ui/components@4.7.0
- @object-ui/fields@4.7.0
- @object-ui/plugin-form@4.7.0
- @object-ui/plugin-grid@4.7.0

## 4.6.0

### Patch Changes

- Updated dependencies [9aacced]
- Updated dependencies [9661d86]
- Updated dependencies [3ee436d]
  - @object-ui/plugin-grid@4.6.0
  - @object-ui/components@4.6.0
  - @object-ui/fields@4.6.0
  - @object-ui/plugin-form@4.6.0
  - @object-ui/types@4.6.0
  - @object-ui/core@4.6.0
  - @object-ui/i18n@4.6.0
  - @object-ui/react@4.6.0

## 4.5.0

### Patch Changes

- Updated dependencies [6b6afd1]
- Updated dependencies [ab5e281]
- Updated dependencies [d714e85]
- Updated dependencies [6b6afd1]
- Updated dependencies [22fa558]
- Updated dependencies [aa7855f]
- Updated dependencies [170d89f]
  - @object-ui/plugin-form@4.5.0
  - @object-ui/types@4.5.0
  - @object-ui/fields@4.5.0
  - @object-ui/components@4.5.0
  - @object-ui/i18n@4.5.0
  - @object-ui/core@4.5.0
  - @object-ui/plugin-grid@4.5.0
  - @object-ui/react@4.5.0

## 4.4.0

### Patch Changes

- Updated dependencies [63eb66d]
- Updated dependencies [2bd45af]
  - @object-ui/fields@4.4.0
  - @object-ui/components@4.4.0
  - @object-ui/plugin-form@4.4.0
  - @object-ui/plugin-grid@4.4.0
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
  - @object-ui/plugin-form@4.3.1
  - @object-ui/plugin-grid@4.3.1
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
  - @object-ui/plugin-form@4.3.0
  - @object-ui/plugin-grid@4.3.0
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
- @object-ui/plugin-form@4.2.1
- @object-ui/plugin-grid@4.2.1

## 4.2.0

### Patch Changes

- Updated dependencies [eb738bd]
- Updated dependencies [650392e]
- Updated dependencies [84b4bf1]
  - @object-ui/i18n@4.2.0
  - @object-ui/components@4.2.0
  - @object-ui/fields@4.2.0
  - @object-ui/react@4.2.0
  - @object-ui/plugin-form@4.2.0
  - @object-ui/plugin-grid@4.2.0
  - @object-ui/types@4.2.0
  - @object-ui/core@4.2.0

## 4.1.0

### Patch Changes

- @object-ui/types@4.1.0
- @object-ui/core@4.1.0
- @object-ui/i18n@4.1.0
- @object-ui/react@4.1.0
- @object-ui/components@4.1.0
- @object-ui/fields@4.1.0
- @object-ui/plugin-form@4.1.0
- @object-ui/plugin-grid@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12
- @object-ui/core@4.0.12
- @object-ui/i18n@4.0.12
- @object-ui/react@4.0.12
- @object-ui/components@4.0.12
- @object-ui/fields@4.0.12
- @object-ui/plugin-form@4.0.12
- @object-ui/plugin-grid@4.0.12

## 4.0.11

### Patch Changes

- Updated dependencies [1909bc3]
  - @object-ui/i18n@4.0.11
  - @object-ui/components@4.0.11
  - @object-ui/fields@4.0.11
  - @object-ui/react@4.0.11
  - @object-ui/plugin-form@4.0.11
  - @object-ui/plugin-grid@4.0.11
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
- @object-ui/plugin-form@4.0.10
- @object-ui/plugin-grid@4.0.10

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9
- @object-ui/core@4.0.9
- @object-ui/i18n@4.0.9
- @object-ui/react@4.0.9
- @object-ui/components@4.0.9
- @object-ui/fields@4.0.9
- @object-ui/plugin-form@4.0.9
- @object-ui/plugin-grid@4.0.9

## 4.0.8

### Patch Changes

- Updated dependencies [3d58eaa]
  - @object-ui/i18n@4.0.8
  - @object-ui/components@4.0.8
  - @object-ui/fields@4.0.8
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
  - @object-ui/i18n@4.0.7
  - @object-ui/plugin-grid@4.0.7
  - @object-ui/fields@4.0.7
  - @object-ui/plugin-form@4.0.7
  - @object-ui/types@4.0.7

## 4.0.6

### Patch Changes

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

- Updated dependencies [89ae109]
- Updated dependencies [925051d]
- Updated dependencies [1b6dc64]
  - @object-ui/plugin-grid@4.0.6
  - @object-ui/plugin-form@4.0.6
  - @object-ui/fields@4.0.6
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
  - @object-ui/fields@4.0.5
  - @object-ui/plugin-form@4.0.5
  - @object-ui/plugin-grid@4.0.5
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
  - @object-ui/fields@4.0.4
  - @object-ui/plugin-form@4.0.4
  - @object-ui/plugin-grid@4.0.4
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
  - @object-ui/fields@4.0.3
  - @object-ui/plugin-form@4.0.3
  - @object-ui/plugin-grid@4.0.3

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1
- @object-ui/core@4.0.1
- @object-ui/i18n@4.0.1
- @object-ui/react@4.0.1
- @object-ui/components@4.0.1
- @object-ui/fields@4.0.1
- @object-ui/plugin-form@4.0.1
- @object-ui/plugin-grid@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0
  - @object-ui/components@4.0.0
  - @object-ui/core@4.0.0
  - @object-ui/fields@4.0.0
  - @object-ui/plugin-form@4.0.0
  - @object-ui/plugin-grid@4.0.0
  - @object-ui/react@4.0.0
  - @object-ui/i18n@4.0.0

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

- Updated dependencies [a2d7023]
- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
  - @object-ui/components@3.4.0
  - @object-ui/fields@3.4.0
  - @object-ui/plugin-grid@3.4.0
  - @object-ui/types@3.4.0
  - @object-ui/plugin-form@3.4.0
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
- @object-ui/fields@3.3.2
- @object-ui/plugin-form@3.3.2
- @object-ui/plugin-grid@3.3.2

## 3.3.1

### Patch Changes

- Updated dependencies [b429568]
  - @object-ui/components@3.3.1
  - @object-ui/fields@3.3.1
  - @object-ui/plugin-form@3.3.1
  - @object-ui/plugin-grid@3.3.1
  - @object-ui/types@3.3.1
  - @object-ui/core@3.3.1
  - @object-ui/i18n@3.3.1
  - @object-ui/react@3.3.1

## 3.3.0

### Minor Changes

- baaad22: fix changeset

### Patch Changes

- @object-ui/types@3.3.0
- @object-ui/core@3.3.0
- @object-ui/i18n@3.3.0
- @object-ui/react@3.3.0
- @object-ui/components@3.3.0
- @object-ui/fields@3.3.0
- @object-ui/plugin-form@3.3.0
- @object-ui/plugin-grid@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0
- @object-ui/core@3.2.0
- @object-ui/i18n@3.2.0
- @object-ui/react@3.2.0
- @object-ui/components@3.2.0
- @object-ui/fields@3.2.0
- @object-ui/plugin-form@3.2.0
- @object-ui/plugin-grid@3.2.0

## 3.1.5

### Patch Changes

- Updated dependencies [cfe0596]
  - @object-ui/i18n@3.1.5
  - @object-ui/react@3.1.5
  - @object-ui/components@3.1.5
  - @object-ui/types@3.1.5
  - @object-ui/core@3.1.5

## 3.1.4

### Patch Changes

- @object-ui/types@3.1.4
- @object-ui/core@3.1.4
- @object-ui/i18n@3.1.4
- @object-ui/react@3.1.4
- @object-ui/components@3.1.4

## 3.1.3

### Patch Changes

- @object-ui/types@3.1.3
- @object-ui/core@3.1.3
- @object-ui/i18n@3.1.3
- @object-ui/react@3.1.3
- @object-ui/components@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2
- @object-ui/core@3.1.2
- @object-ui/i18n@3.1.2
- @object-ui/react@3.1.2
- @object-ui/components@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1
  - @object-ui/components@3.1.1
  - @object-ui/core@3.1.1
  - @object-ui/react@3.1.1
  - @object-ui/i18n@3.1.1

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

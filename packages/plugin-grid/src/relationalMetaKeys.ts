/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ⭐ WHAT `ObjectGrid` COPIES OFF AN OBJECT-SCHEMA FIELD DEF ONTO A COLUMN'S
 * `fieldMeta` — objectui#6875.
 *
 * ## The defect this file exists to make unrepeatable
 *
 * `RELATIONAL_META_KEYS` used to be a bare array literal inside `ObjectGrid.tsx`,
 * governed by a rule stated in prose: *every key here has to have a measured
 * reader on this grid's own render path*. The rule was right; nothing enforced
 * it in the OTHER direction. The list was a strict SUBSET of what its own
 * consumers read, and had been for as long as anyone had looked:
 *
 *   copied, never read   — none (objectui#6711 and objectui#6874 closed that half)
 *   read, never copied   — `displayField`, `descriptionField`, `lookupColumns`,
 *                          `reference_field`, `lookup_columns`
 *
 * The list was also internally inconsistent about spelling, which is the tell
 * that it was assembled from defect reports rather than derived: `lookupFilters`
 * (camel) sat in it next to `lookup_filters`, while `displayField` and
 * `descriptionField` did NOT sit next to their snake twins. Same fallback
 * chains, same file, opposite outcomes.
 *
 * So the fix is not a longer literal. {@link RELATIONAL_META_READ_SET} below
 * classifies EVERY key the consumers read off this bag, and
 * `__tests__/relationalMetaCopySet.derivation.test.ts` re-derives that read set
 * from the consumer sources on every run. A spelling added to any consumer
 * chain lands in neither column of the table and turns the gate red; it cannot
 * silently become a sixth never-copied key.
 *
 * ## The consumers, and why they are exactly these three
 *
 * `generateColumns()` hands `fieldMeta` to `CellRenderer` as the `field` prop,
 * and `getCellRenderer` dispatches a relational column into
 * `LookupCellRenderer` (`@object-ui/fields/src/index.tsx`). The grid's inline
 * editor renders `LookupField` and `UserField`
 * (`@object-ui/fields/src/widgets/`); `UserField` reads a few keys itself and
 * then spreads its whole meta into `LookupField` — so its own read set is a
 * subset and it adds nothing; it is swept anyway, because a key it read and
 * did NOT forward would otherwise be invisible here.
 *
 * ## ⚠️ Only the FIRST of those three is fed by this bag — objectui#7154
 *
 * This docblock used to say the inline editor "dispatches the same bag" into
 * the two widgets. It does not, and the correction matters because it is what
 * a whole class of card is filed against: `ObjectGrid.renderCellEditor` looks
 * the field up in the object schema and spreads the WHOLE def into the widget
 * (`{ name: ctx.column.accessorKey, ...fieldDef }`), so every key a def carries
 * reaches `LookupField` regardless of this table. `fieldMeta` goes to
 * `<CellRenderer>` and nowhere else.
 *
 * Both halves read `objectSchema?.fields?.[name]` — the same object — so there
 * is no shape where copying could rescue an editor the schema read did not
 * already serve: when that lookup misses, `renderCellEditor` returns `null` and
 * `applyRelationalMeta` copies nothing, together.
 *
 * ⇒ A key whose only reader is one of the two EDITOR widgets gains nothing from
 * being copied here, and copying it would write a member onto a bag its
 * consumer does not read — the shape objectui#6711 and objectui#6874 retired.
 * The four keys objectui#7154 asked about are measured arriving at the picker
 * with this table unchanged, in
 * `__tests__/lookupPickerKeys-7154.test.tsx`.
 *
 * ## ⭐ THREE KEYS LEFT THIS COPY SET BY THAT RULE — objectui#7166
 *
 * objectui#7154 stated the rule for keys that had never been copied. Applied
 * BACKWARDS, to keys already on the list, the same rule retires three of them:
 * `descriptionField`, `lookupColumns` and `lookupFilters`. Each is read off a
 * field meta only by `LookupField` (and `lookupFilters` also by `UserField`) —
 * the two EDITOR widgets — so on the cell path each write landed on a bag whose
 * consumer never looks at it. Re-measured on `47035ce79`, and stated as
 * receivers rather than as a count: `packages/fields/src/index.tsx`, the file
 * that holds EVERY `CellRenderer`, contains zero occurrences of any of the
 * three, against a control of 22 occurrences of the `display_field` /
 * `displayField` / `reference_to` spellings the cell does read.
 *
 * ⇒ The retirement is behaviour-preserving, and that is the half worth pinning:
 * all three still take effect in the inline picker with them OFF this table,
 * because `renderCellEditor` hands the widget the whole schema def.
 * `__tests__/relationalMetaCopySet-7166.test.tsx` renders both halves.
 *
 * ## ⚠️ THE TWO POPULATIONS — why three keys went and three stayed
 *
 * Six copied keys have no reader on this bag; only three left. The other three
 * — `description_field`, `lookup_filters`, `id_field` — are the snake_case
 * `legacy-alias` spellings, recorded that way PRECISELY because a host
 * `DataSource` outside these two repos may hand-feed them. That is a
 * PRODUCER-side argument, and every measurement above is READER-side. Retiring
 * them on this evidence would answer a question nobody asked.
 *
 * Their reader-side verdict is now on the table anyway, so the next pass
 * inherits a measurement instead of a silence. ⛔ The question still OPEN — and
 * which no evidence gathered in these two repos can close — is the producer
 * one: does any host outside them put these spellings on a field def? Closing
 * it needs a producer survey, not another sweep of this repo.
 *
 * ## ⛔ THE DERIVATION GATE CANNOT SEE THIS CLASS — its green is not cover
 *
 * The gate re-extracts a read set that is the UNION over three consumers, two
 * of which are not fed this bag. Membership there means "some consumer reads
 * this key" — never "this bag is how that consumer gets it". Those are
 * different claims, and the second is the one a copy-set entry asserts. All
 * three retired keys REMAIN in the extracted read set, because the editor
 * widgets still read them, so the derivation stays green whichever verdict they
 * carry: it would not go red if someone put them back tomorrow.
 *
 * ⇒ What guards this retirement is the rendering test plus the explicit
 * non-membership pin in the gate — not the derivation. Re-scoping the
 * derivation around the cell alone, with the editor widgets classified
 * separately, would close that gap; it is a design change to objectui#6875's
 * mechanism and is filed rather than made here.
 *
 * ## ⭐ Why a key can be READ and still not be worth copying
 *
 * `@objectstack/spec` 17.2.0's `FieldSchema` is a **strict** object of 71
 * properties. A key it does not declare parses to `unrecognized_keys` — the
 * same code a nonsense key gets — so `PUT /api/v1/meta/object/:name` refuses
 * it and no spec-compliant producer can put it on a field def. Measured on the
 * installed package, with `name` / `type` / `label` as the positive control.
 *
 * Nothing manufactures one on the way in, either. `getObjectSchema` in
 * `@object-ui/data-objectstack` is the choke point every schema read passes
 * through, and its only key rewrites are `normalizeSchemaReferenceKeys` (the
 * `reference` ⇄ `reference_to` pair) and `applyFieldWidgetOverrides` (`widget`).
 * Whatever the server serves for every other property arrives verbatim.
 *
 * ⇒ Copying a key that is neither spec-declared nor adapter-stamped writes a
 * member from the def on every column build that no producer can ever fill.
 * That is precisely what objectui#6711 (`reference_to_field`), objectui#6625
 * (`decimals`) and objectui#6597 (`referenceTo`) retired, and what
 * objectui#6531 removed from `getRecordDisplayName` on the same reasoning. So
 * `reference_field` and `lookup_columns` — two of the five keys objectui#6875
 * named — are deliberately NOT copied, and the gate proves their absence from
 * `FieldSchema` rather than taking this docblock's word for it.
 *
 * ## ⚠️ The asymmetry this file does NOT resolve
 *
 * Four keys already in the copy set — `display_field`, `description_field`,
 * `lookup_filters`, `id_field` — fail that same producer test. They are kept:
 * retiring a key that has shipped is its own adjudication (that is what
 * objectui#6711 and objectui#6874 each were), a host `DataSource` outside these
 * two repos may still hand-feed them, and legacy metadata predating the strict
 * schema is not measurable from here. Recorded as `legacy-alias` so the
 * asymmetry is visible rather than implied.
 *
 * ## ⛔ Two keys were in this list and are RETIRED — do not re-add them
 *
 * Both were measured out under the same rule this file now enforces
 * mechanically: a key belongs here only when a consumer on THIS grid's render
 * path reads it off a FIELD meta. Under the derivation they can no longer be
 * re-added by hand at all — neither appears in the read set the gate extracts,
 * so adding either to the table below turns the gate red as an "extra".
 *
 * ### `reference_to_field` — objectui#6711
 *
 * Swept across `packages/` and `apps/` (and again across the producer repo),
 * the only occurrences of the identifier anywhere were the array literal — the
 * write — and prose recording that nothing reads it. No member access, no
 * destructuring, no bracket read. `FieldSchema` does not declare it either, so
 * nothing authorable produces it.
 *
 * ### `titleFormat` — objectui#6874
 *
 * A zero of a different kind, and a stronger one. `titleFormat` is a real, live
 * key with plenty of readers — it simply has no FIELD-meta reader. The sweep
 * found every member read of the identifier across `packages/` and `apps/`
 * (tests included) and classified each by receiver: `objectDef` /
 * `objectSchema` (`core/utils/record-title.ts`, `containers.tsx`,
 * `plugin-detail/DetailView.tsx`, `ObjectKanban.tsx`, `ObjectCalendar.tsx`,
 * `react/hooks/useRecordSearch.ts`) — OBJECT schema, every one;
 * `refObjectSchema?.titleFormat` in `LookupField.tsx` — the REFERENCED object's
 * schema, fetched by `getSchema(referenceTo)`, and the one that matters here;
 * `param.titleFormat` in `app-shell/utils/paramToField.ts`, off a resolved
 * `ActionParamDef`. ⇒ copying `reference_to` is what makes `titleFormat` work
 * on this path; copying `titleFormat` onto the meta reached nothing.
 * `plugin-dashboard/src/recordFields.tsx` recorded the same measurement first.
 *
 * Both absences stay pinned behaviourally at all three of `generateColumns`'s
 * call sites — `__tests__/relationalMetaCopySet-6711.test.tsx` and
 * `__tests__/relationalMetaCopySet-6874.test.tsx`.
 *
 * ⚠️ Every sweep quoted above bounds these two repos. A host application
 * outside them could still be reading any of these keys off `fieldMeta`; the
 * repo's own contract is what these verdicts are about.
 */

/** What the grid does with a key its consumers read off the field meta. */
export type RelationalMetaVerdict =
  /** Spec-declared on `FieldSchema`. The spelling a live `getObjectSchema` serves. */
  | 'spec'
  /** Not spec-declared, but stamped onto every def by the adapter's choke point. */
  | 'adapter-stamped'
  /** Not producible under the installed contract; copied only for back-compat. */
  | 'legacy-alias'
  /** Read, but no producer can emit it — copying it would reach nothing. */
  | 'no-producer'
  /** Producible and read, but written onto the meta by another block already. */
  | 'handled-elsewhere'
  /**
   * Producible and read, but read ONLY by an editor widget — which
   * `ObjectGrid.renderCellEditor` feeds from the schema def, not from this bag.
   * Copying such a key onto `fieldMeta` reaches nothing. See `note` per key.
   */
  | 'deferred';

/** Verdicts whose keys ARE copied. Everything else is deliberately skipped. */
const COPIED_VERDICTS: ReadonlySet<RelationalMetaVerdict> = new Set([
  'spec',
  'adapter-stamped',
  'legacy-alias',
]);

export interface RelationalMetaEntry {
  readonly verdict: RelationalMetaVerdict;
  readonly note: string;
}

/**
 * Every key the three consumers read off this bag, each with a verdict.
 *
 * ⛔ Do not add a key here to "restore symmetry" with the field def, and do not
 * remove one because it looks unused — the gate reads the consumer sources, and
 * this table has to match what it finds, exactly and in both directions.
 */
export const RELATIONAL_META_READ_SET: Readonly<Record<string, RelationalMetaEntry>> = {
  // ── The relational target ────────────────────────────────────────────────
  reference: { verdict: 'spec', note: "FieldSchema.reference — the served spelling for a lookup's target object." },
  reference_to: { verdict: 'adapter-stamped', note: 'normalizeSchemaReferenceKeys stamps it from `reference` at the getObjectSchema choke point.' },
  reference_field: { verdict: 'no-producer', note: 'Third leg of the display-field chain. Not on FieldSchema; zero occurrences in the producer repo (control: `displayField`, 68 files). objectui#6875.' },

  // ── The display value ───────────────────────────────────────────────────
  displayField: { verdict: 'spec', note: 'FieldSchema.displayField. ⭐ Added by objectui#6875 — the only display spelling a spec-compliant producer can emit, and the one that never arrived.' },
  display_field: { verdict: 'legacy-alias', note: 'Runtime spelling, first leg of every display chain. Not on FieldSchema; kept for back-compat.' },

  // ── The picker's secondary line ─────────────────────────────────────────
  // ⛔ The camel spelling LEFT the copy set in objectui#7166 while its snake
  // twin stayed. That asymmetry is deliberate and is explained under "the two
  // populations" in this file's docblock: the retirement is a READER-side
  // finding, and only the snake spellings carry a producer-side argument.
  descriptionField: { verdict: 'deferred', note: "FieldSchema.descriptionField. Added by objectui#6875, RETIRED from the copy set by objectui#7166: its only reader is LookupField, which the inline editor feeds from the schema def, so the copy reached nothing. Measured by rendering — the picker's secondary line still appears with this table unchanged." },
  description_field: { verdict: 'legacy-alias', note: 'Runtime spelling. Not on FieldSchema; kept for back-compat. Reader-side verdict (objectui#7166): NO reader on this bag either — it survives on the UNANSWERED producer question below, not on a measured reader.' },

  // ── The picker's table ──────────────────────────────────────────────────
  lookupColumns: { verdict: 'deferred', note: "FieldSchema.lookupColumns. Added by objectui#6875, RETIRED from the copy set by objectui#7166 on the same measurement as `descriptionField`. Measured by rendering — the declared columns still shape the picker with this table unchanged." },
  lookup_columns: { verdict: 'no-producer', note: 'Runtime twin of `lookupColumns`, read but never producible. Not on FieldSchema. objectui#6875.' },

  // ── The picker's base scoping ───────────────────────────────────────────
  lookupFilters: { verdict: 'deferred', note: "FieldSchema.lookupFilters. RETIRED from the copy set by objectui#7166: read off a field meta only by LookupField and UserField, both fed by the editor's schema spread. Measured by rendering — the declared filter still scopes the picker's candidates with this table unchanged." },
  lookup_filters: { verdict: 'legacy-alias', note: 'Runtime spelling. Not on FieldSchema; kept for back-compat. Reader-side verdict (objectui#7166): NO reader on this bag; retained on the unanswered producer question, not on a measured reader.' },

  // ── The picker's id column ──────────────────────────────────────────────
  id_field: { verdict: 'legacy-alias', note: 'Picker id column. Neither spelling is on FieldSchema (`idField` is absent too); kept for back-compat. Reader-side verdict (objectui#7166): NO reader on this bag; retained on the unanswered producer question, not on a measured reader.' },

  // ── Read by the EDITOR widgets, producible, and NOT copied ──────────────
  // Found by objectui#6875's re-sweep and left `deferred`. objectui#7154 then
  // measured WHY copying them would reach nothing: their only reader is
  // `LookupField`, which the grid's inline editor feeds from the schema def
  // directly (see this file's docblock). All four already take effect in the
  // picker with this table unchanged — pinned in
  // `__tests__/lookupPickerKeys-7154.test.tsx`. `deferred` keeps the gate
  // watching them; it is no longer a promise to copy them later.
  multiple: { verdict: 'deferred', note: 'FieldSchema.multiple — picker cardinality. Read only by LookupField, which the grid feeds from the schema def, not from this bag: measured accumulating two picks in the inline picker with this table unchanged (objectui#7154).' },
  allowCreate: { verdict: 'deferred', note: 'FieldSchema.allowCreate — picker quick-create affordance. Same route as `multiple`: `allowCreate: false` measured removing the create entry the control column offers (objectui#7154).' },
  lookupPageSize: { verdict: 'deferred', note: 'FieldSchema.lookupPageSize — picker page size. Same route: a declared 3 measured scoping the picker dialog to 3 rows against a control of 10 (objectui#7154).' },
  dependsOn: { verdict: 'deferred', note: 'FieldSchema.dependsOn — cascading picker filter. Same route, and it ARRIVES: the declared column renders the gated trigger. The grid supplies no dependent values, so that gate is permanent — objectui#2215’s grid-side residue, filed separately (objectui#7154).' },

  // ── Read on this path, no producer ──────────────────────────────────────
  allow_create: { verdict: 'no-producer', note: 'Runtime twin of `allowCreate`. Not on FieldSchema.' },
  lookup_page_size: { verdict: 'no-producer', note: 'Runtime twin of `lookupPageSize`. Not on FieldSchema.' },
  depends_on: { verdict: 'no-producer', note: 'Runtime twin of `dependsOn`. Not on FieldSchema.' },
  picker: { verdict: 'no-producer', note: 'PeoplePicker variant opt-in. Not on FieldSchema.' },
  subtitle: { verdict: 'no-producer', note: 'PeoplePicker subtitle fields. Not on FieldSchema.' },
  avatarField: { verdict: 'no-producer', note: 'PeoplePicker avatar field. Not on FieldSchema.' },
  avatar_field: { verdict: 'no-producer', note: 'Runtime twin of `avatarField`. Not on FieldSchema.' },

  // ── Written by another block of the same column build ───────────────────
  options: { verdict: 'handled-elsewhere', note: 'Written by generateColumns as `translateOptions(...)`, which localises the labels; a raw copy would undo that.' },
  dataSource: { verdict: 'handled-elsewhere', note: 'Not a schema key — LookupField reads its own `props.dataSource` fallback off the meta bag.' },
};

/**
 * The copy set, DERIVED from {@link RELATIONAL_META_READ_SET}.
 *
 * Order is the table's, which groups a chain's spellings together — it does not
 * matter to `applyRelationalMeta` (each key is written independently), but it
 * keeps a diff of this file readable.
 */
export const RELATIONAL_META_KEYS: readonly string[] = Object.freeze(
  Object.entries(RELATIONAL_META_READ_SET)
    .filter(([, entry]) => COPIED_VERDICTS.has(entry.verdict))
    .map(([key]) => key),
);

/**
 * Copy the relational metadata a lookup / master_detail / user cell needs off
 * the object-schema field definition onto a column's built `fieldMeta`.
 *
 * A key is written only when the def actually carries it, so a non-relational
 * field's meta gains no keys at all and an absent key never lands as an
 * explicit `undefined` — the semantics `plugin-dashboard`'s sibling
 * `pickCellRelationalMeta` copies.
 */
export function applyRelationalMeta(
  fieldMeta: Record<string, any>,
  fieldDef: Record<string, any> | undefined | null,
): void {
  if (!fieldDef) return;
  for (const key of RELATIONAL_META_KEYS) {
    if (fieldDef[key] !== undefined) fieldMeta[key] = fieldDef[key];
  }
}

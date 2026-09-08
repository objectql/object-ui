/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * MetadataFieldsPage
 *
 * Setup-app container that renders {@link FieldDesigner} bound to one
 * object's `fields` map, loaded from `GET /api/v1/meta/object/:name`
 * and persisted by issuing `PUT /api/v1/meta/object/:name` with the
 * merged-back fields. Mirrors {@link MetadataObjectsPage}.
 *
 * Why we save the *parent object* instead of `/meta/field/:name`:
 *   In the ObjectStack data protocol, fields live INSIDE an object's
 *   `fields: Record<string, FieldSchema>` map — there is no per-field
 *   document in the canonical Zod source. The metadata type registry
 *   does expose `type: 'field'` for cases where a field is shipped as
 *   a stand-alone artifact (third-party extension), but the normal
 *   path used by the Setup app is to mutate the parent object so the
 *   round-trip stays consistent with the artifact format the CLI dump
 *   produces (`*.object.ts`).
 *
 * The container preserves any object-schema attribute it doesn't
 * know about (indexes, hooks, permissions, lifecycle, …) by deep
 * cloning the loaded raw payload and only swapping in the new
 * `fields` map on save.
 *
 * The same principle runs one and two levels down. Per-field KEYS
 * the designer does not render survive via `carryOver`; and a whole
 * FIELD whose stored `type` the designer cannot author is carried
 * through verbatim rather than rebuilt from a model that has no way
 * to hold it (objectui#8060 — see `partitionStoredFields`). Those
 * fields are listed on the page read-only, showing their real stored
 * type, instead of being drawn as editable `text` fields.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DESIGNER_FIELD_TYPES } from '@object-ui/types';
import type { DesignerFieldDefinition, DesignerFieldType } from '@object-ui/types';
// The retired-field-key tombstone registry lives at a dedicated internal
// subpath, not the main barrel — objectui#6527 option B (maintainer ruling,
// 2026-08-28): a barrel import eagerly evaluates every other barrel member,
// which widened an unrelated consumer's module graph under the prior shape.
import { retiredFieldKeysFor } from '@object-ui/types/internal/retired-field-keys';
import { MetadataClient, type MetadataClientConfig } from '@object-ui/data-objectstack';
import { FieldDesigner } from './FieldDesigner';

/** Subset of the framework FieldSchema shape we render. */
interface ServerFieldSchema {
  /** Field type (framework field-type enum). */
  type?: string;
  label?: string;
  description?: string;
  required?: boolean;
  unique?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  group?: string;
  externalId?: boolean;
  trackHistory?: boolean;
  /**
   * Relationship target object name. The spec spells it `reference`
   * (objectui#6041) — `referenceTo` is refused BY NAME by `FieldSchema`, so
   * emitting it made `PUT /api/v1/meta/object/:name` fail 422 and blocked
   * every later save of the object. See {@link RETIRED_FIELD_KEYS}.
   */
  reference?: string;
  /*
   * No `formula` (objectui#6043). The spec spells a formula field's expression
   * `expression` and it is CEL; `FieldSchema` refuses `formula` BY NAME, so
   * emitting it made `PUT /api/v1/meta/object/:name` fail 422 and blocked every
   * later save. It is NOT renamed here — see {@link RETIRED_FIELD_KEYS} and the
   * tombstone on `DesignerFieldDefinition` for why a rename was refused.
   *
   * `expression` itself is deliberately NOT declared: this page renders no
   * control for it, and the index signature below plus `carryOver` already
   * round-trip it verbatim, so a formula authored in metadata-admin survives an
   * edit-and-save here untouched. Declaring it would put it back in this gate's
   * reach for no reader.
   */
  // The framework also stores `select` field options as `options: string[] |
  // {label, value}[]`; we passthrough the raw structure for now.
  options?: unknown;
  /**
   * Marker set by the framework's system-field injection (`organization_id`,
   * `created_at`, `updated_by`, …). The spec spells it `system`
   * (objectui#6044); `isSystem` is refused BY NAME by `FieldSchema`, and — being
   * an OPTIONAL flag — reading the wrong spelling went unnoticed: `undefined`
   * is a valid "not a system field", so system fields presented as ordinary
   * editable, deletable business fields.
   */
  system?: boolean;
  [key: string]: unknown;
}

interface ServerObjectSchema {
  name: string;
  label?: string;
  fields?: Record<string, ServerFieldSchema>;
  [key: string]: unknown;
}

// Derived from the canonical vocabulary rather than restated (objectui#3017).
const KNOWN_FIELD_TYPES: ReadonlySet<DesignerFieldType> = new Set(DESIGNER_FIELD_TYPES);

/**
 * Does the designer own this stored `type` — i.e. can it round-trip it?
 *
 * ## What this replaced, and why the replacement is a PARTITION and not a default
 *
 * This predicate is what is left of `toDesignerType`, which answered
 * `DesignerFieldType` for every input by falling back to `'text'`
 * (objectui#8060). That fallback was not a display default: `toDesignerField`
 * called it on the READ path, so the collapse happened before the author saw
 * anything, and `fromDesignerField` emits `type: designed.type`, so the
 * collapsed value was written back. Relabelling ONE field rewrote every other
 * field whose type this designer does not author:
 *
 *   stored { parent_id: { type: 'master_detail', reference: 'invoice' } }
 *   relabel an unrelated `name` field
 *     => WIRE { parent_id: { "type": "text", "reference": "invoice" } }
 *
 * `text` is a LEGAL spec type, so the PUT succeeded, the designer redrew the
 * field as text, and nothing reported it. Restoring the relationship required
 * knowing what the type used to be, which the stored document no longer said.
 *
 * ## The census — measured, not estimated (objectui#8060 step 1)
 *
 * `DESIGNER_FIELD_TYPES` has 27 members and every one of them is a declared
 * `FieldType`, so the designer's vocabulary is a strict SUBSET of the spec's.
 * `FieldType` in `@objectstack/spec` 17.3.0 declares 49. The difference is 22
 * members, and each one was a distinct data-loss case:
 *
 *   secret, richtext, toggle, multiselect, radio, checkboxes, master_detail,
 *   tree, user, avatar, video, audio, summary, composite, repeater, record,
 *   json, signature, qrcode, progress, tags, vector
 *
 * The card confirmed two of them (`master_detail`, `vector`); the other 20 are
 * enumerated here. The set is pinned by size AND by membership in
 * `MetadataFieldsPage.storedTypePreserved.test.tsx`, which drives its class pin
 * from the difference rather than from a hand-written list — a fix scoped to
 * the two known members would leave 20 fields failing in the way that is
 * hardest to notice next.
 *
 * ⚠️ The 22 are the census, NOT the predicate. This function deliberately does
 * not consult `@objectstack/spec`: see {@link partitionStoredFields} for why a
 * type in NEITHER set is preserved too.
 */
function isDesignerAuthorableType(raw: unknown): raw is DesignerFieldType {
  return typeof raw === 'string' && KNOWN_FIELD_TYPES.has(raw as DesignerFieldType);
}

function toDesignerField(name: string, raw: ServerFieldSchema): DesignerFieldDefinition {
  return {
    id: name,
    name,
    label: raw.label ?? name,
    // Safe by construction rather than by fallback: only fields whose stored
    // type this designer authors reach here — `partitionStoredFields` routes
    // the rest to the preserved half, and a field with NO stored type has
    // nothing to destroy, so it lands here and takes the designer's `'text'`.
    type: isDesignerAuthorableType(raw.type) ? raw.type : 'text',
    group: raw.group,
    description: raw.description,
    required: raw.required,
    unique: raw.unique,
    readonly: raw.readonly,
    hidden: raw.hidden,
    defaultValue: raw.defaultValue,
    placeholder: raw.placeholder,
    isSystem: raw.system,
    externalId: raw.externalId,
    trackHistory: raw.trackHistory,
    referenceTo: raw.reference,
  };
}

/**
 * Field keys the ObjectStack spec REJECTS by name, dropped out of
 * {@link carryOver}.
 *
 * Derived from the tombstone registry (`RETIRED_FIELD_KEY_TOMBSTONES` in
 * `@object-ui/types`, objectui#6527) — this carry-over is the registry's
 * `metadataFieldsPageCarryOver` site. The registry names each retired key, the
 * card that retired it, and which sites strip it; the per-key evidence lives
 * there. What stays HERE is what is specific to THIS writer's history:
 *
 * Each key is one this page's own era wrote (`indexed` via the Advanced
 * section of {@link FieldDesigner}, objectui#4644; `referenceTo` via
 * `fromDesignerField`'s old emit line, objectui#6041; `isSystem` as a declared
 * `ServerFieldSchema` member served back to us, objectui#6044; `formula` via
 * the retired formula textarea, objectui#6043), and `fromDesignerField`
 * spreads `prev` verbatim to preserve unknown keys — so a stored object from
 * that era would carry the key straight back out to
 * `PUT /api/v1/meta/object/:name` as a hard 422 (`INVALID_METADATA`) that
 * blocks every later save, with no control left on screen to clear it.
 * Stripping the carried-over keys is what makes an edit-and-save round-trip of
 * such an object come out parseable; it is keyed to the tombstones, so every
 * other unknown key the designer does not render still survives.
 *
 * Two of the four cost nothing: `fromDesignerField` re-emits the lookup target
 * under the spec spelling `reference` on the very next line, and the system
 * flag is read back from the spec spelling `system` (never re-emitted — the
 * strip IS the whole write half of objectui#6044). `formula` is the one entry
 * whose strip DROPS a value, and that is objectui#6043's deliberate trade: the
 * server refuses to store it, a blind rename to `expression` would launder
 * non-CEL text into a formula that parses green and evaluates to null, and
 * with the textarea gone stripping is the only way out of the 422. The
 * migration surface for the VALUE is metadata-admin's `ObjectFieldInspector`
 * (ruled again on objectui#6526, option B), which is why the READ door's list
 * does not include `formula` while this write door's does. `expression` itself
 * is a real `FieldSchema` key and rides through `carryOver` untouched.
 *
 * `sortOrder` is absent here on the same unmeasured premise it always had: no
 * shipped writer on this tree ever populated a field-level one (objectui#6045)
 * — see its tombstone for the one site that keeps a recorded-defensive strip.
 */
const RETIRED_FIELD_KEYS = retiredFieldKeysFor('metadataFieldsPageCarryOver');

/** Carry over `prev`'s unknown keys, minus {@link RETIRED_FIELD_KEYS}. */
function carryOver(prev?: ServerFieldSchema): ServerFieldSchema {
  if (!prev) return {};
  const next: ServerFieldSchema = { ...prev };
  for (const k of RETIRED_FIELD_KEYS) delete next[k];
  return next;
}

/** One stored field the designer cannot author, kept whole. */
interface PreservedField {
  name: string;
  raw: ServerFieldSchema;
  /** The verbatim stored `type`, rendered so the author sees the truth. */
  storedType: string;
}

/**
 * Split the stored `fields` map into the half this designer authors and the
 * half it only carries (objectui#8060).
 *
 * ## The rule, in three cases — it turns on the STORED type, nothing else
 *
 * | stored `type`             | where it goes | why                                    |
 * |---------------------------|---------------|----------------------------------------|
 * | in `DESIGNER_FIELD_TYPES` | designable    | the designer authors it; unchanged     |
 * | present, outside that set | preserved     | there is a stored type to destroy      |
 * | absent                    | designable    | nothing stored, so nothing to destroy  |
 *
 * The absent case is deliberate and is NOT the old fallback returning under a
 * new name. The defect was rewriting a type the author's document HELD; a field
 * with no `type` holds none, so `'text'` there invents a value rather than
 * replacing one. Routing it to the preserved half instead would emit a
 * type-less field the spec refuses and give the author no control to repair it.
 *
 * ## ⭐ A type in NEITHER set is preserved as well, and that is the decision
 *
 * The predicate asks only "does `DESIGNER_FIELD_TYPES` contain it". It does NOT
 * ask `@objectstack/spec` whether the value is a legal `FieldType`, and the
 * omission is chosen rather than skipped:
 *
 * 1. **A stale local vocabulary must not get a vote on destruction.** The spec
 *    is a versioned dependency and the stored document was written by a server
 *    that may be AHEAD of the copy bundled here. Flattening everything this
 *    build's `FieldType` does not recognise would re-create this very defect
 *    the day the spec declares its 50th type — silently, and only for the
 *    people running a newer backend.
 * 2. **Re-sending a genuinely garbage type is the LOUD failure, not the silent
 *    one.** `FieldSchema` refuses an unknown type by value, so the PUT comes
 *    back `422 INVALID_METADATA` naming `fields.<name>.type`: the author is
 *    told, and the stored document is untouched and still repairable. Rewriting
 *    it to `text` is the opposite trade — the save SUCCEEDS and the evidence of
 *    what the field was is gone. This card exists because that trade was made.
 * 3. It keeps `@objectstack/spec` out of this plugin's runtime graph. The
 *    census above is derived in the TEST, where being one spec version behind
 *    makes a pin stale rather than makes a document lossy.
 *
 * A non-string `type` (an untrusted payload can carry `42`) is "present and
 * outside the set", so it preserves too, on exactly reason 2.
 */
function partitionStoredFields(rawFields: Record<string, ServerFieldSchema> | undefined): {
  designable: DesignerFieldDefinition[];
  preserved: PreservedField[];
} {
  const designable: DesignerFieldDefinition[] = [];
  const preserved: PreservedField[] = [];
  for (const [name, raw] of Object.entries(rawFields ?? {})) {
    if (raw?.type !== undefined && !isDesignerAuthorableType(raw.type)) {
      preserved.push({ name, raw, storedType: String(raw.type) });
    } else {
      designable.push(toDesignerField(name, raw));
    }
  }
  return { designable, preserved };
}

function fromDesignerField(
  designed: DesignerFieldDefinition,
  prev?: ServerFieldSchema,
): ServerFieldSchema {
  return {
    ...carryOver(prev),
    type: designed.type,
    label: designed.label,
    description: designed.description,
    required: designed.required,
    unique: designed.unique,
    readonly: designed.readonly,
    hidden: designed.hidden,
    defaultValue: designed.defaultValue,
    placeholder: designed.placeholder,
    group: designed.group,
    externalId: designed.externalId,
    trackHistory: designed.trackHistory,
    reference: designed.referenceTo,
  };
}

/**
 * Field types whose `reference` — the target object a relationship links to —
 * `@objectstack/spec` requires to be present and non-empty. The sibling of
 * `MetadataService`'s list, kept here for the same reason this file keeps its
 * own `toFieldsMap` and `carryOver`: the two writers convert different input
 * types on different paths and neither owns the other's.
 *
 * Re-measured for objectui#7714 against the 17.3.0 artifact by parsing
 * `{ type, label: 'L' }` for every one of `FieldType`'s 49 declared members:
 * exactly these two are refused at path `reference`, both with code `custom`,
 * and the other 47 are not refused at all on that minimal document.
 *
 * ⭐ `master_detail` is now REACHABLE on this page. It was RECORDED-DEFENSIVE
 * — the entry existed for parity with the sibling writer while nothing here
 * could ever hand the guard one, because `toDesignerType` mapped every type
 * outside `DESIGNER_FIELD_TYPES` to `'text'` on the READ path, so a stored
 * master-detail arrived already flattened. objectui#8060 removed that
 * flattening: a stored type this designer cannot author is now carried through
 * verbatim (see {@link partitionStoredFields}) and `toFieldsMap` runs this
 * guard over the carried-through entries as well, so the branch fires on the
 * real type.
 *
 * ⚠️ That makes this a BEHAVIOUR CHANGE, not just restored coverage, and it is
 * stated rather than left to be discovered: an object holding a target-less
 * stored `master_detail` used to SAVE from this page — by flattening the field
 * to `text` and losing the relationship — and is now refused by name before the
 * PUT. The refusal is the better half of a bad pair: `@objectstack/spec` 17.3.0
 * requires `reference` on `master_detail`, so that document's PUT would answer
 * `422 INVALID_METADATA` anyway; refusing here names the field and says what to
 * fix, and leaves the stored relationship intact instead of overwriting it.
 * The sibling in `MetadataService.ts` has had it reachable all along, through
 * `saveObject` — so the two writers now state ONE invariant and both exercise
 * it.
 */
const RELATIONSHIP_TYPES_REQUIRING_REFERENCE = ['lookup', 'master_detail'];

/**
 * Why THIS value cannot be a target, and what the contract does about it —
 * both halves, because the four states differ on both. The sibling copy in
 * `MetadataService.ts` is word-for-word the same, and both pins assert all four
 * states so the copies cannot drift silently.
 *
 * Measured for objectui#7714 on `@objectstack/spec` 17.3.0, at field level and
 * again through `ObjectSchema`, which agree on every row:
 *
 * | `reference`     | the spec's verdict                                 |
 * |-----------------|----------------------------------------------------|
 * | absent          | refused — `custom` at `reference`                  |
 * | `''`            | refused — `custom` at `reference`                  |
 * | non-string      | refused — **`invalid_type`**, not a missing target |
 * | whitespace-only | ⚠️ **accepted** — refused only by this writer      |
 *
 * A single "…and this one has none" would be wrong for two of the four: a
 * non-string is a value of the wrong KIND rather than an absent target, so
 * "pick the target object" is not the repair for `reference: 42`; and the 422
 * the other branches promise is one this page cannot deliver for the
 * whitespace case, because the spec would let that through.
 */
function describeUnusableTarget(reference: unknown): string {
  if (reference === undefined) {
    return (
      'and this one has none. `@objectstack/spec` requires it (17.3.0), so the server refuses '
        + 'the whole object document with 422 `INVALID_METADATA` — which then blocks EVERY later '
        + 'save of this object, not just this field.'
    );
  }
  if (typeof reference !== 'string') {
    return (
      `and this one holds ${reference === null ? 'null' : `a ${typeof reference}`} instead of `
        + 'an object name. `@objectstack/spec` refuses that (17.3.0) as `invalid_type` at path '
        + '`reference` — not as a missing target — so the server refuses the whole object document '
        + 'with 422 `INVALID_METADATA`, which then blocks EVERY later save of this object.'
    );
  }
  if (reference === '') {
    return (
      'and this one is empty. `@objectstack/spec` requires a non-empty value (17.3.0), so the '
        + 'server refuses the whole object document with 422 `INVALID_METADATA` — which then blocks '
        + 'EVERY later save of this object, not just this field.'
    );
  }
  return (
    'and this one is blank — whitespace names no object, so nothing could ever resolve it. '
      + '`@objectstack/spec` 17.3.0 ACCEPTS this value (measured, at field level and through '
      + '`ObjectSchema`), so the PUT would succeed and the failure would surface later and further '
      + 'away — the record picker with no object to query, `$expand` with nothing to resolve. This '
      + 'writer refuses it deliberately and says so (objectui#7714; upstream objectstack#16126).'
  );
}

/**
 * Refuse a relationship field whose target is unusable — BEFORE the PUT.
 *
 * ## The failure this closes, measured in a running designer
 *
 * `@objectstack/spec` 17.3.0 made `reference` a hard requirement on `lookup`
 * and `master_detail` (a `custom` refinement at path `reference`). At 17.2.0
 * the requirement was prose only — `{ type: 'lookup', label: 'L' }` parsed
 * green at field level AND through `ObjectSchema` — so this page persisted
 * target-less drafts freely.
 *
 * objectui#7714 drove that against a real 17.3.0 backend rather than inferring
 * it: creating a `lookup` and leaving its target empty PUT the whole object and
 * got `422 INVALID_METADATA` at `fields.<name>.reference`, and the next edit —
 * to a DIFFERENT, already-saved field — was refused identically, because the
 * half-filled draft rides along in the same document. The author sees that
 * later edit rendered as applied while the server has none of it. The cost of
 * letting the draft leave the client is not one failed save; it is every
 * subsequent save of that object for the rest of the session.
 *
 * The maintainer's reconciliation (objectui#7122 ruled item 4, 2026-09-05) is
 * that the incomplete draft stays in the client and is never PUT. ⛔ Not the
 * alternative of stripping the incomplete field from the body while still
 * reporting a save — that shows the author a field the server never received,
 * the silent-drop shape objectstack#4001 closed.
 *
 * This raises inside the caller's save `try`, so the message lands in the
 * page's existing error surface — the same banner a nameless or duplicated
 * field already produces, and no new UI affordance.
 *
 * ## The `.trim()` is a DECLARED DIVERGENCE, not an accident
 *
 * The predicate is `typeof reference === 'string' && reference.trim() !== ''`,
 * which is STRICTER than the contract. Measured on 17.3.0, at field level and
 * again through the whole document:
 *
 *   FieldSchema.safeParse({ type: 'lookup', label: 'L', reference: '   ' })
 *     => success = true
 *   ObjectSchema.safeParse({ …, fields: { rel: { …, reference: '   ' } } })
 *     => success = true
 *
 * — the spec ACCEPTS a whitespace-only target and this page refuses it.
 * objectui being stricter than the platform is a divergence, not a neutral
 * choice, so it is STATED rather than left to be inferred from a predicate;
 * undeclared, it is indistinguishable from a bug and the next reader "fixes" it.
 *
 * ⭐ Kept, deliberately. A whitespace-only `reference` names no object — the
 * spec's own `ObjectSchema.fields` key grammar (`/^[a-z_][a-z0-9_]*$/`) admits
 * no whitespace-bearing name for it to resolve to — so admitting it buys the
 * author nothing and only moves the identical failure past the PUT and into a
 * stored document, where it surfaces with no field named.
 *
 * ⚠️ Filed upstream as objectstack#16126 (open). If the spec trims, this page's
 * behaviour is unchanged and only the declaration retires — which is why the
 * pins assert this writer's refusal separately from the spec's verdict.
 */
function assertRelationshipTargetPresent(
  field: { type?: string; reference?: unknown },
  fieldName: string,
  writer: string,
): void {
  if (!RELATIONSHIP_TYPES_REQUIRING_REFERENCE.includes(String(field?.type))) return;
  const reference = field?.reference;
  if (typeof reference === 'string' && reference.trim() !== '') return;
  throw new Error(
    `${writer} cannot save the field \`${fieldName}\`: a \`${field?.type}\` field needs a `
      + `\`reference\` naming the object it links to, ${describeUnusableTarget(reference)} `
      + 'Pick the target object, or change the field to a non-relationship type.',
  );
}

/**
 * Key the designer's field list by field NAME — the shape `ObjectSchema.fields`
 * requires — and refuse the three lists that shape cannot carry
 * (objectui#6489).
 *
 * Ported from the sibling object writer, app-shell's
 * `MetadataService.toFieldsMap` (objectui#6240), deliberately down to the
 * refusal wording: the two writers are the objectui#5761 parity family, and a
 * difference between them is a defect waiting to be found twice.
 *
 * ## Why `Object.fromEntries` and not assignment into a literal
 *
 * `map['__proto__'] = def` does not create a key — it invokes the prototype
 * setter — and `__proto__` is a SPEC-LEGAL field name (`ObjectSchema.fields`'
 * key schema is `/^[a-z_][a-z0-9_]*$/`, which it matches). Built by assignment,
 * such a field disappeared from the serialised PUT body while the spec stood
 * ready to accept it. Measured on `@objectstack/spec` 17.2.0:
 *
 *   ObjectSchema.safeParse({ …, fields: { ['__proto__']: { type: 'text', label: 'P' } } })
 *     => success = true
 *
 * `Object.fromEntries` defines an own property instead. This is what makes the
 * construction load-bearing rather than stylistic.
 *
 * ## Why a missing name THROWS instead of writing `{ undefined: … }`
 *
 * `DesignerFieldDefinition.name` is declared required, but this page is handed
 * whatever the in-memory designer model holds. A nameless field keys as the
 * literal string `"undefined"` — and the spec does NOT catch that either:
 *
 *   ObjectSchema.safeParse({ …, fields: { undefined: { type: 'text', label: 'N' } } })
 *     => success = true
 *
 * So it parses, it is STORED, and no reader anywhere looks for it: a silently
 * corrupt document in place of a loud refusal.
 *
 * ## Why a duplicate name throws too
 *
 * That one is the conversion's OWN hazard rather than an inherited one: the
 * designer's list can carry two fields called `amount` and a map cannot, so the
 * later entry silently swallowed the earlier. Refusing is the only reading that
 * does not lose a field the author declared.
 *
 * The caller runs this inside its save `try`, so a refusal lands in the page's
 * existing error surface. That is the one deliberate difference from the
 * sibling writer, and it is forced by the caller's shape: `onFieldsChange` is
 * fire-and-forget (`void handleFieldsChange(next)`), so throwing to it would
 * produce an unhandled rejection and show the author nothing — the same silent
 * failure this function exists to end. The property both writers do share is
 * the one that matters: it raises BEFORE the request, so a refused list issues
 * no PUT at all.
 */
function toFieldsMap(
  next: DesignerFieldDefinition[],
  prevFields: Record<string, ServerFieldSchema>,
): Record<string, ServerFieldSchema> {
  // Derived HERE from the same `prevFields` this function writes back, rather
  // than passed in from the component's render memo. The two would be computed
  // from the same `state.raw` today, but a preserved list that could disagree
  // with `prevFields` is a way to drop a field silently — and that is the
  // failure mode this whole card is about.
  const preservedByName = new Map(
    partitionStoredFields(prevFields).preserved.map((f) => [f.name, f] as const),
  );
  const designedByName = new Map<string, DesignerFieldDefinition>();
  const seen = new Set<string>();

  next.forEach((designed, index) => {
    const name = designed?.name;
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error(
        `[MetadataFieldsPage] cannot build the object's \`fields\` map: the field at index ${index} has no `
          + '`name`. `ObjectSchema.fields` is keyed by field name, so a nameless field would be written under '
          + 'the literal key "undefined" — which the spec ACCEPTS, leaving a corrupt document stored with '
          + 'nothing to report it. Give the field a name.',
      );
    }
    if (seen.has(name)) {
      throw new Error(
        `[MetadataFieldsPage] cannot build the object's \`fields\` map: duplicate field name \`${name}\` at `
          + `index ${index}. A name-keyed map cannot carry two fields under one name, so the later one would `
          + 'silently replace the earlier. Rename or remove one of them.',
      );
    }
    if (preservedByName.has(name)) {
      // Reachable, not defensive: `FieldDesigner`'s add-field form takes a free
      // text `name`, so an author can create `vec` while a preserved `vec` is
      // sitting in the read-only list they cannot edit. A name-keyed map cannot
      // carry both, and whichever we dropped would be dropped silently — which
      // is the shape this whole card is about.
      throw new Error(
        `[MetadataFieldsPage] cannot build the object's \`fields\` map: the field \`${name}\` at index `
          + `${index} collides with a stored field of type \`${preservedByName.get(name)!.storedType}\`, `
          + 'which this designer cannot author and therefore carries through unchanged. A name-keyed map '
          + 'cannot hold both, and the stored one is not editable here to make room. Rename the new field.',
      );
    }
    seen.add(name);
    designedByName.set(name, designed);
  });

  // ## Ordering — the designer's list is primary, stored positions are honoured
  //
  // Field order is load-bearing: the spec has no field-level ordering key, so
  // DECLARATION ORDER in the `fields` record IS the object's field order.
  // `next` carries the author's order and must stay primary — it can hold a
  // NEW field anywhere in the list, and objectui#6489's `__proto__` pin asserts
  // exactly that. The carried-through fields are not in `next` at all (the
  // designer never sees them), so each one is spliced back in at the position
  // it holds in the STORED document — before the first designer field that
  // stored after it. A carried-through field that jumped to the end would
  // silently reorder the author's object.
  const storedIndex = new Map(Object.keys(prevFields).map((name, i) => [name, i] as const));
  const pending = [...preservedByName.values()].sort(
    (a, b) => (storedIndex.get(a.name) ?? 0) - (storedIndex.get(b.name) ?? 0),
  );
  const entries: Array<[string, ServerFieldSchema]> = [];
  let pendingAt = 0;
  const emitPreservedBefore = (limit: number) => {
    while (pendingAt < pending.length && (storedIndex.get(pending[pendingAt].name) ?? 0) < limit) {
      const keep = pending[pendingAt];
      pendingAt += 1;
      // ⭐ The whole repair, and it is the mechanism this page ALREADY used one
      // level down: `carryOver` is what makes unknown per-field KEYS survive an
      // edit-and-save, and a stored `type` this designer cannot author is the
      // same problem one level up. So the field is re-emitted from the stored
      // document verbatim — `type` included — rather than being rebuilt from a
      // designer model that has no way to hold it. The tombstone strip still
      // applies, because those keys 422 whoever wrote them.
      entries.push([keep.name, carryOver(keep.raw)]);
    }
  };

  for (const [name, designed] of designedByName) {
    // A field the designer ADDED is not in the stored document, so nothing
    // stored can be said to sort after it: flush the rest of the carried-through
    // fields first, keeping every stored field ahead of every new one.
    emitPreservedBefore(storedIndex.get(name) ?? Number.POSITIVE_INFINITY);
    // The carried-over previous definition is read as an OWN property for the
    // same reason the map is BUILT as own properties: `prevFields[name]` answers
    // out of `Object.prototype` for the two spec-legal names that live there
    // (`__proto__`, `constructor`). Measured, that read is harmless today —
    // `carryOver` spreads whatever it gets, and both prototype values spread to
    // `{}`, so the emitted field is identical either way — but the harmlessness
    // is `carryOver`'s to lose, and this function should not depend on it.
    const prev = Object.prototype.hasOwnProperty.call(prevFields, name)
      ? prevFields[name]
      : undefined;
    entries.push([name, fromDesignerField(designed, prev)]);
  }
  emitPreservedBefore(Number.POSITIVE_INFINITY);

  // Checked on the EMITTED entries rather than on the designer models:
  // `fromDesignerField` merges the carried-over server definition underneath
  // the designer's values, so a field the author never touched can legitimately
  // take its target from `prev`; reading `designed.referenceTo` alone would
  // refuse every one of those — a save the server accepts, blocked by the
  // client. It runs over the PRESERVED entries too, and that half is
  // objectui#7714's guard entry going LIVE: the guard listed `master_detail`
  // for parity with the sibling writer while this page could never hand it one,
  // because the flattening turned every stored master-detail into a `text`
  // before the guard saw it. Now that the stored type survives, a stored
  // `master_detail` arrives with its real type and a target-less one is refused
  // BY NAME before the PUT — instead of being saved as a `text` field with the
  // relationship gone.
  for (const [name, field] of entries) {
    assertRelationshipTargetPresent(field, name, '[MetadataFieldsPage]');
  }

  return Object.fromEntries(entries);
}

export interface MetadataFieldsPageProps {
  /** Object name to edit fields for (e.g. `account`, `sys_permission_set`). */
  objectName: string;
  /** Pre-built metadata client (preferred for auth-decorated instances). */
  client?: MetadataClient;
  /** Used when `client` is omitted. */
  clientConfig?: MetadataClientConfig;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Optional CSS class for the wrapper. */
  className?: string;
}

interface ObjectState {
  loading: boolean;
  error: string | null;
  raw: ServerObjectSchema | null;
}

export function MetadataFieldsPage({
  objectName,
  client: clientProp,
  clientConfig,
  readOnly = false,
  className,
}: MetadataFieldsPageProps) {
  const client = useMemo(() => {
    if (clientProp) return clientProp;
    if (!clientConfig) {
      throw new Error('MetadataFieldsPage: provide either `client` or `clientConfig`.');
    }
    return new MetadataClient(clientConfig);
  }, [clientProp, clientConfig]);

  const [state, setState] = useState<ObjectState>({
    loading: true,
    error: null,
    raw: null,
  });

  const reload = useCallback(async () => {
    setState({ loading: true, error: null, raw: null });
    try {
      const raw = await client.get<ServerObjectSchema>('object', objectName);
      if (!raw) {
        setState({
          loading: false,
          error: `Object "${objectName}" not found.`,
          raw: null,
        });
        return;
      }
      setState({ loading: false, error: null, raw });
    } catch (err) {
      setState({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
        raw: null,
      });
    }
  }, [client, objectName]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const { designable: fields, preserved } = useMemo(
    () => partitionStoredFields(state.raw?.fields),
    [state.raw],
  );

  const handleFieldsChange = useCallback(async (next: DesignerFieldDefinition[]) => {
    if (!state.raw) return;
    // Rebuild the fields map preserving prior unknown keys per field, and
    // dropping anything the designer removed.
    const prevFields = state.raw.fields ?? {};
    try {
      // Inside the `try` on purpose: `toFieldsMap` REFUSES a field list a
      // name-keyed map cannot carry (objectui#6489), and this is the page's one
      // error surface. It raises before `client.save`, so a refused list issues
      // no request — see the note on `toFieldsMap`.
      const mergedObject: ServerObjectSchema = {
        ...state.raw,
        fields: toFieldsMap(next, prevFields),
      };
      await client.save('object', objectName, mergedObject);
      await reload();
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [client, objectName, reload, state.raw]);

  if (state.loading) {
    return (
      <div className={className} data-testid="metadata-fields-page-loading">
        Loading fields…
      </div>
    );
  }

  return (
    <div className={className} data-testid="metadata-fields-page">
      {state.error && (
        <pre
          data-testid="metadata-fields-page-error"
          className="mb-2 whitespace-pre-wrap rounded bg-red-50 p-2 text-xs text-red-700"
        >
          {state.error}
        </pre>
      )}
      <FieldDesigner
        objectName={objectName}
        fields={fields}
        onFieldsChange={(next) => { void handleFieldsChange(next); }}
        readOnly={readOnly}
      />
      {preserved.length > 0 && (
        <section
          data-testid="metadata-fields-page-preserved"
          className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
        >
          <h3 className="mb-1 font-medium">
            {`Carried through unchanged (${preserved.length})`}
          </h3>
          <p className="mb-2">
            These fields are stored with a type this designer cannot author, so it shows them
            rather than editing them. They are saved back exactly as stored — editing any other
            field on this object leaves them untouched. Use metadata-admin to change them.
          </p>
          <ul className="space-y-1">
            {preserved.map((f) => (
              <li key={f.name} data-testid={`metadata-fields-page-preserved-${f.name}`}>
                <code>{f.name}</code>
                {' — '}
                <span>{f.raw.label ?? f.name}</span>
                {' · '}
                <code data-testid={`metadata-fields-page-preserved-type-${f.name}`}>
                  {f.storedType}
                </code>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default MetadataFieldsPage;

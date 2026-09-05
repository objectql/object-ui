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

function toDesignerType(raw: string | undefined): DesignerFieldType {
  if (raw && KNOWN_FIELD_TYPES.has(raw as DesignerFieldType)) {
    return raw as DesignerFieldType;
  }
  return 'text';
}

function toDesignerField(name: string, raw: ServerFieldSchema): DesignerFieldDefinition {
  return {
    id: name,
    name,
    label: raw.label ?? name,
    type: toDesignerType(raw.type),
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
 * Field types whose `reference` (the target object a relationship links to)
 * `@objectstack/spec` requires to be present and non-empty — the sibling of
 * `MetadataService`'s list, kept here for the same reason this file keeps its
 * own `toFieldsMap` and `carryOver`: the two writers convert different input
 * types on different paths and neither owns the other's.
 *
 * Measured against the installed 17.3.0 by parsing `{ type, label: 'L' }` for
 * every one of `FieldSchema`'s 49 declared types: exactly `lookup` and
 * `master_detail` are refused for a missing target, and no other type is
 * refused at all on that minimal document.
 */
const RELATIONSHIP_TYPES_REQUIRING_REFERENCE = ['lookup', 'master_detail'];

/**
 * Refuse a relationship field whose target is missing — BEFORE the PUT.
 *
 * `@objectstack/spec` 17.3.0 made `reference` a hard requirement on `lookup`
 * and `master_detail` (a `custom` refinement at path `reference`). Against a
 * matched backend, PUTting a half-filled relationship draft returns `422
 * INVALID_METADATA` for the WHOLE object document — so the damage is not
 * confined to the incomplete field: every later save of that object fails the
 * same way until the draft is completed or removed. At 17.2.0 the requirement
 * was prose only and this page persisted such drafts freely.
 *
 * The maintainer's reconciliation for that change (objectui#7122, 2026-09-05,
 * ruled item 4) is to keep the incomplete draft in the client and never PUT it.
 * This raises inside the caller's save `try`, so the message lands in the
 * page's existing error surface — the same banner a nameless or duplicated
 * field already produces, and no new UI affordance.
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
    `${writer} cannot save the field \`${fieldName}\`: a \`${field?.type}\` field needs a ` +
      '`reference` naming the object it links to, and this one has none. `@objectstack/spec` ' +
      'requires it (17.3.0), so the server refuses the whole object document with 422 ' +
      '`INVALID_METADATA` — which would then block EVERY later save of this object, not just ' +
      'this field. Pick the target object, or change the field to a non-relationship type.',
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
  const entries: Array<[string, ServerFieldSchema]> = [];
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
    seen.add(name);
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
    const emitted = fromDesignerField(designed, prev);
    // Checked on the EMITTED entry, not on `designed`: `fromDesignerField`
    // merges the carried-over server entry underneath the designer's values, so
    // the target may legitimately arrive from `prev` on a field the author did
    // not touch. Reading `designed.referenceTo` alone would refuse those.
    assertRelationshipTargetPresent(emitted, name, '[MetadataFieldsPage]');
    entries.push([name, emitted]);
  });

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

  const fields = useMemo<DesignerFieldDefinition[]>(() => {
    if (!state.raw?.fields) return [];
    return Object.entries(state.raw.fields).map(([name, f]) => toDesignerField(name, f));
  }, [state.raw]);

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
    </div>
  );
}

export default MetadataFieldsPage;

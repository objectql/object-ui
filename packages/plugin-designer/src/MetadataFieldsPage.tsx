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
 * Field keys the ObjectStack spec REJECTS by name (objectui#4644).
 *
 * `indexed` was never a `FieldSchema` key — the field-level flag built no
 * index (objectstack#2377 removed it) and, since objectstack#4001 closed the
 * silent-drop shape, `FieldSchema.safeParse` refuses it outright. Object-level
 * `indexes[]` is the real surface.
 *
 * The Advanced section of {@link FieldDesigner} used to offer it, so objects
 * saved from this page can still carry the key — and `fromDesignerField`
 * spreads `prev` verbatim to preserve unknown keys, which would carry it back
 * out to `PUT /api/v1/meta/object/:name` as a hard 422 (`INVALID_METADATA`)
 * that blocks every later save. Stripping it out of the carried-over keys is
 * what makes an edit-and-save round-trip of such an object come out
 * parseable; it is keyed to the tombstone, so every other unknown key the
 * designer does not render still survives.
 */
/*
 * objectui#6041 adds `referenceTo`. Renaming the emit site alone does not
 * unblock an object a previous designer build already saved: that stored
 * payload still carries `referenceTo`, `carryOver` spreads `prev` verbatim,
 * and the key would round-trip straight back out to the same 422. Stripping it
 * on the way out is what makes an edit-and-save of an ALREADY-BLOCKED object
 * come out parseable. The target itself is not lost — `fromDesignerField`
 * re-emits it under the spec spelling `reference` on the very next line.
 *
 * objectui#6044 adds `isSystem` for the same reason and with one difference
 * worth stating: `fromDesignerField` never NAMES it, so the only way out is the
 * verbatim `carryOver` spread — which makes this line, not any emit site, the
 * whole write half of that card. The spec spelling `system` is not stripped: it
 * is a real `FieldSchema` key, so a server-injected flag rides through
 * untouched, which is exactly what lets `toDesignerField` read it back.
 *
 * objectui#6043 adds `formula`, and it is the one entry here that is NOT half
 * of a rename — the difference matters, because it is the only reason this
 * strip loses anything:
 *
 *   - For `referenceTo` and `isSystem`, `fromDesignerField` re-emits the value
 *     under the spec spelling on a later line, so stripping costs nothing.
 *   - For `formula` there is no re-emit, because the card REFUSED the rename.
 *     `FieldSchema` does not parse CEL at the key level (17.2.0 accepts
 *     `expression: '!!!not cel at all!!!'`), so migrating a stored `formula`
 *     into `expression` would launder a non-CEL string — typically the
 *     `price * quantity` the retired control's own placeholder taught — into a
 *     valid key name, where it parses green and then evaluates to null at
 *     runtime. That is the silent failure the card exists to avoid, so the key
 *     is dropped rather than renamed.
 *
 * Dropping it is what makes an already-blocked object saveable again, and there
 * is no gentler option: with the control gone, an author has no other way to
 * clear the key, so leaving it would keep the object 422-blocked forever. The
 * value being dropped is one the server already refuses to store, so nothing
 * that ever persisted is lost. `expression` is NOT stripped — it is a real
 * `FieldSchema` key, so a formula authored in metadata-admin rides through
 * `carryOver` untouched.
 */
const RETIRED_FIELD_KEYS = ['indexed', 'referenceTo', 'isSystem', 'formula'] as const;

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
    entries.push([name, fromDesignerField(designed, prev)]);
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

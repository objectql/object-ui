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
  referenceTo?: string;
  formula?: string;
  // The framework also stores `select` field options as `options: string[] |
  // {label, value}[]`; we passthrough the raw structure for now.
  options?: unknown;
  // Marker used by the framework's system-field injection (organization_id).
  isSystem?: boolean;
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
    isSystem: raw.isSystem,
    externalId: raw.externalId,
    trackHistory: raw.trackHistory,
    referenceTo: raw.referenceTo,
    formula: raw.formula,
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
const RETIRED_FIELD_KEYS = ['indexed'] as const;

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
    referenceTo: designed.referenceTo,
    formula: designed.formula,
  };
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
    const nextFields: Record<string, ServerFieldSchema> = {};
    for (const f of next) {
      nextFields[f.name] = fromDesignerField(f, prevFields[f.name]);
    }
    const mergedObject: ServerObjectSchema = {
      ...state.raw,
      fields: nextFields,
    };
    try {
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

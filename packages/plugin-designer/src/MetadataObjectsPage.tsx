/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * MetadataObjectsPage
 *
 * Setup-app container that lists every object schema known to the
 * ObjectStack server (via `GET /api/v1/meta/object`) and renders it in
 * the visual {@link ObjectManager}. Reads, edits, creates and deletes
 * persist through the metadata REST API
 * (`PUT/DELETE /api/v1/meta/object/:name`) using
 * {@link MetadataClient}.
 *
 * Architectural note — Salesforce-style Setup vs ad-hoc dialogs:
 *   - Object metadata is treated as a first-class resource, not as a
 *     side effect of running migrations. The page is host-app routable
 *     (mount it at e.g. `/apps/setup/_meta/object`) and serves as the
 *     single visual entry point that mirrors the underlying protocol
 *     contract in `packages/spec/src/data/object.zod.ts`.
 *   - The framework gates creation/deletion via the metadata type
 *     registry (`DEFAULT_METADATA_TYPE_REGISTRY` -> `object` currently
 *     has `allowRuntimeCreate: false`). When the server rejects a write
 *     we surface the 4xx error rather than silently swallowing it, so
 *     admins discover the constraint explicitly.
 *
 * The container deliberately keeps {@link ObjectManager} unchanged —
 * `ObjectManager` is a pure controlled component and continues to be
 * usable in design-time / preview contexts with in-memory data.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ObjectDefinition } from '@object-ui/types';
import { MetadataClient, type MetadataClientConfig } from '@object-ui/data-objectstack';
import { ObjectManager } from './ObjectManager';

/** Minimal shape we consume from a framework ObjectSchema payload. */
interface ServerObjectSchema {
  name: string;
  label?: string;
  pluralLabel?: string;
  description?: string;
  icon?: string;
  group?: string;
  isSystem?: boolean;
  fields?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MetadataObjectsPageProps {
  /**
   * Either a pre-built {@link MetadataClient} or the config to build
   * one. Passing a client lets the host share an auth-decorated
   * instance across pages.
   */
  client?: MetadataClient;
  /** Used when `client` is omitted. */
  clientConfig?: MetadataClientConfig;
  /** Hide objects with `isSystem: true`. Defaults to false (show all). */
  hideSystemObjects?: boolean;
  /** Read-only mode (disables Create / Edit / Delete in the manager). */
  readOnly?: boolean;
  /**
   * Notified when the user opens an object for field editing. Host apps
   * typically use this to navigate to a sibling fields page
   * (e.g. `/apps/setup/_meta/object/:name/fields`).
   */
  onSelectObject?: (object: ObjectDefinition, raw: ServerObjectSchema) => void;
  /** Optional CSS class for the wrapper. */
  className?: string;
}

function toObjectDefinition(raw: ServerObjectSchema): ObjectDefinition {
  const fieldCount = raw.fields && typeof raw.fields === 'object'
    ? Object.keys(raw.fields as Record<string, unknown>).length
    : 0;
  return {
    // ObjectDefinition.id is for the local Manager's row identity; using
    // the object name keeps it stable across reloads.
    id: raw.name,
    name: raw.name,
    label: raw.label ?? raw.name,
    pluralLabel: raw.pluralLabel,
    description: raw.description,
    icon: raw.icon,
    group: raw.group,
    isSystem: raw.isSystem ?? false,
    fieldCount,
  };
}

interface ServerObjectsState {
  loading: boolean;
  error: string | null;
  /** Raw server payloads, indexed by object name (for save-back merging). */
  byName: Record<string, ServerObjectSchema>;
}

export function MetadataObjectsPage({
  client: clientProp,
  clientConfig,
  hideSystemObjects = false,
  readOnly = false,
  onSelectObject,
  className,
}: MetadataObjectsPageProps) {
  const client = useMemo(() => {
    if (clientProp) return clientProp;
    if (!clientConfig) {
      throw new Error('MetadataObjectsPage: provide either `client` or `clientConfig`.');
    }
    return new MetadataClient(clientConfig);
  }, [clientProp, clientConfig]);

  const [state, setState] = useState<ServerObjectsState>({
    loading: true,
    error: null,
    byName: {},
  });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const items = await client.list<ServerObjectSchema>('object');
      const byName: Record<string, ServerObjectSchema> = {};
      for (const item of items) {
        if (item && typeof item === 'object' && typeof item.name === 'string') {
          byName[item.name] = item;
        }
      }
      setState({ loading: false, error: null, byName });
    } catch (err) {
      setState({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
        byName: {},
      });
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const objects = useMemo<ObjectDefinition[]>(
    () => Object.values(state.byName).map(toObjectDefinition),
    [state.byName],
  );

  /**
   * Diff the previous controlled list against the new one emitted by
   * ObjectManager and translate each change into the appropriate REST
   * call. ObjectManager batches add/update/delete into a single
   * onObjectsChange invocation, so we treat the diff as the source of
   * truth.
   *
   * Deletes are issued via DELETE /meta/object/:name (overlay reset).
   * Updates merge the manager's edited fields back onto the raw server
   * payload to preserve everything the manager doesn't render (fields,
   * indexes, hooks, permissions, etc.).
   */
  const handleObjectsChange = useCallback(async (next: ObjectDefinition[]) => {
    const prev = state.byName;
    const nextByName: Record<string, ObjectDefinition> = {};
    for (const o of next) nextByName[o.name] = o;

    const errors: string[] = [];

    // Deletions
    for (const name of Object.keys(prev)) {
      if (!nextByName[name]) {
        try {
          await client.reset('object', name);
        } catch (err) {
          errors.push(`Delete ${name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    // Inserts + updates
    for (const updated of next) {
      const base = prev[updated.name] ?? { name: updated.name };
      const merged: ServerObjectSchema = {
        ...base,
        name: updated.name,
        label: updated.label,
        pluralLabel: updated.pluralLabel,
        description: updated.description,
        icon: updated.icon,
        group: updated.group,
        isSystem: updated.isSystem,
      };
      // Don't issue redundant saves if nothing visible changed.
      if (
        prev[updated.name]
        && prev[updated.name].label === merged.label
        && prev[updated.name].pluralLabel === merged.pluralLabel
        && prev[updated.name].description === merged.description
        && prev[updated.name].icon === merged.icon
        && prev[updated.name].group === merged.group
      ) {
        continue;
      }
      try {
        await client.save('object', updated.name, merged);
      } catch (err) {
        errors.push(`Save ${updated.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    await reload();
    if (errors.length > 0) {
      setState((s) => ({ ...s, error: errors.join('\n') }));
    }
  }, [client, reload, state.byName]);

  const handleSelectObject = useCallback((obj: ObjectDefinition) => {
    const raw = state.byName[obj.name];
    if (raw && onSelectObject) onSelectObject(obj, raw);
  }, [onSelectObject, state.byName]);

  if (state.loading) {
    return (
      <div className={className} data-testid="metadata-objects-page-loading">
        Loading objects…
      </div>
    );
  }

  return (
    <div className={className} data-testid="metadata-objects-page">
      {state.error && (
        <pre
          data-testid="metadata-objects-page-error"
          className="mb-2 whitespace-pre-wrap rounded bg-red-50 p-2 text-xs text-red-700"
        >
          {state.error}
        </pre>
      )}
      <ObjectManager
        objects={objects}
        onObjectsChange={(next) => { void handleObjectsChange(next); }}
        onSelectObject={onSelectObject ? handleSelectObject : undefined}
        showSystemObjects={!hideSystemObjects}
        readOnly={readOnly}
      />
    </div>
  );
}

export default MetadataObjectsPage;

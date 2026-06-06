// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * useObjectFields — loads an Object's field catalog for the View column
 * configurator's "Available fields" pane.
 *
 * Reads `object.fields` (record OR array shape) via the shared
 * MetadataClient and normalizes it into a flat, ordered list the picker
 * can render. Hidden fields are kept (admins legitimately surface them)
 * but flagged so the picker can de-emphasize them.
 *
 * The hook is defensive: a missing object name, a 404, or a transport
 * error all resolve to an empty list with `error` set, so the configurator
 * can gracefully fall back to manual column entry.
 */

import * as React from 'react';
import { useMetadataClient } from '../useMetadata';
import { readFields } from './object-fields-io';

export interface ObjectFieldInfo {
  /** snake_case API name. */
  name: string;
  /** Human label (falls back to the name). */
  label: string;
  /** Raw field type id (e.g. 'text', 'lookup'). */
  type: string;
  hidden: boolean;
}

export interface UseObjectFieldsResult {
  fields: ObjectFieldInfo[];
  loading: boolean;
  error: string | null;
}

export function useObjectFields(
  objectName: string | undefined,
  /**
   * Pre-resolved field catalog. When supplied the hook skips the network
   * fetch entirely and returns this list verbatim — used by hosts that
   * already hold the object definition (e.g. the runtime ViewConfigPanel,
   * which reads `objectDef.fields`) so the inspector has zero network
   * dependency.
   */
  override?: ObjectFieldInfo[],
): UseObjectFieldsResult {
  const client = useMetadataClient();
  const [state, setState] = React.useState<UseObjectFieldsResult>({
    fields: [],
    loading: !override && !!objectName,
    error: null,
  });

  React.useEffect(() => {
    // Override short-circuits the fetch: trust the caller-supplied catalog.
    if (override) {
      setState({ fields: override, loading: false, error: null });
      return;
    }
    if (!objectName) {
      setState({ fields: [], loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    client
      .get<Record<string, unknown>>('object', objectName)
      .then((obj) => {
        if (cancelled) return;
        if (!obj) {
          setState({ fields: [], loading: false, error: 'Object not found' });
          return;
        }
        const view = readFields((obj as any).fields);
        const fields: ObjectFieldInfo[] = view.entries.map((e) => ({
          name: e.name,
          label:
            typeof e.def.label === 'string' && e.def.label
              ? (e.def.label as string)
              : e.name,
          type: typeof e.def.type === 'string' ? (e.def.type as string) : 'text',
          hidden: e.def.hidden === true,
        }));
        setState({ fields, loading: false, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          fields: [],
          loading: false,
          error: err?.message ?? String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [client, objectName, override]);

  return state;
}

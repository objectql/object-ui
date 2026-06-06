// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * useObjectOptions — the list of objects (name + label) for object pickers in
 * the page-editor block inspector. Async; degrades to an empty list (the
 * picker then falls back to a free-text input).
 */
import * as React from 'react';
import { useMetadataClient } from '../useMetadata';

export interface ObjectOption {
  value: string;
  label: string;
}

export function useObjectOptions(): { options: ObjectOption[]; loading: boolean } {
  const client = useMetadataClient();
  const [options, setOptions] = React.useState<ObjectOption[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    client
      .list<{ name?: string; label?: string }>('object')
      .then((items) => {
        if (cancelled) return;
        const mapped = (items ?? [])
          .map((raw) => (raw && typeof raw === 'object' && 'item' in raw ? (raw as any).item : raw))
          .filter((i: any) => typeof i?.name === 'string' && i.name)
          .map((i: any) => ({
            value: i.name as string,
            label: i.label ? `${i.label} (${i.name})` : (i.name as string),
          }))
          .sort((a: ObjectOption, b: ObjectOption) => a.value.localeCompare(b.value));
        setOptions(mapped);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setOptions([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  return { options, loading };
}

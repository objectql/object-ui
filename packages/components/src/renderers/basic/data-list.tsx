/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Lightweight list primitives for SIMPLE data — the antidote to dropping a
 * full data-grid (toolbar + filters + pagination + selection) on a handful of
 * reference rows. Two presentational/low-chrome components:
 *
 *   - element:definition-list — a compact key/value `<dl>` for a single record.
 *   - element:repeater        — a data-bound, chrome-free list: one line per
 *                               row, no toolbar/card/pagination.
 *
 * Props are read off `schema.properties` (spec convention) with a `schema.props`
 * fallback, matching the other `element:*` renderers.
 */

import * as React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { useAdapter } from '@object-ui/react';
import { cn } from '../../lib/utils';
import { readProps } from './readProps';

function toText(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// ---------------------------------------------------------------------------
// element:definition-list — compact key/value display
// ---------------------------------------------------------------------------

interface DefinitionItem {
  term: string;
  description?: unknown;
}

function DefinitionListRenderer({ schema }: { schema: any }) {
  const props = readProps<{
    items?: DefinitionItem[];
    columns?: 1 | 2;
    inline?: boolean;
    className?: string;
  }>(schema);
  const items = Array.isArray(props.items) ? props.items : [];
  const cols = props.columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1';

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No details</p>;
  }

  return (
    <dl
      className={cn('grid gap-x-6 gap-y-3', cols, schema?.className, props.className)}
      data-testid="definition-list"
    >
      {items.map((it, i) => (
        <div
          key={i}
          className={cn(props.inline ? 'flex items-baseline justify-between gap-3' : 'flex flex-col gap-0.5')}
        >
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {it.term}
          </dt>
          <dd className="text-sm text-foreground">{toText(it.description)}</dd>
        </div>
      ))}
    </dl>
  );
}

ComponentRegistry.register('definition-list', DefinitionListRenderer, {
  namespace: 'element',
  skipFallback: true,
  label: 'Definition List',
  category: 'content',
  inputs: [
    { name: 'items', type: 'array', label: 'Items', required: true, description: 'Term/description pairs [{ term, description }]' },
    { name: 'columns', type: 'enum', label: 'Columns', enum: ['1', '2'], defaultValue: '1' },
    { name: 'inline', type: 'boolean', label: 'Inline', description: 'Term and description on one baseline-aligned row' },
  ],
});

// ---------------------------------------------------------------------------
// element:repeater — data-bound, chrome-free list
// ---------------------------------------------------------------------------

interface RepeaterColumn {
  field: string;
  label?: string;
}

function RepeaterRenderer({ schema }: { schema: any }) {
  const props = readProps<{
    object?: string;
    titleField?: string;
    fields?: Array<string | RepeaterColumn>;
    filter?: unknown;
    sort?: any;
    limit?: number;
    emptyText?: string;
    divided?: boolean;
    className?: string;
  }>(schema);

  const adapter = useAdapter() as any;
  const [rows, setRows] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const filterKey = React.useMemo(() => (props.filter ? JSON.stringify(props.filter) : ''), [props.filter]);

  const cols: RepeaterColumn[] = React.useMemo(
    () => (props.fields ?? []).map((f) => (typeof f === 'string' ? { field: f } : f)),
    [props.fields],
  );

  React.useEffect(() => {
    let cancelled = false;
    if (!adapter || !props.object || typeof adapter.find !== 'function') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const query: any = {};
        if (props.filter) query.$filter = props.filter;
        if (props.sort) query.$orderby = props.sort;
        if (props.limit) query.$top = props.limit;
        const res = await adapter.find(props.object, query);
        // `data` is the ONE rows member `QueryResult` (`@object-ui/types`)
        // declares; the bare-array arm stays because fakes at this seam really
        // do answer with a plain array. A `res?.records` arm sat between them
        // until objectui#6726 — a below-the-adapter spelling
        // (`ObjectStackAdapter.normalizeQueryResult` maps the server/SDK
        // `records` envelope to `data` before returning), so no producer emits
        // it here and the arm bought nothing. Pinned by
        // `data-list.contractEnvelope-6726.test.tsx`.
        const data: any[] = res?.data ?? (Array.isArray(res) ? res : []);
        if (!cancelled) setRows(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, props.object, filterKey, props.limit]);

  if (loading) return <p className="py-2 text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="py-2 text-sm text-destructive">{error}</p>;
  if (rows.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">{props.emptyText ?? 'No records'}</p>;
  }

  return (
    <ul
      className={cn(props.divided !== false && 'divide-y divide-border', schema?.className, props.className)}
      data-testid="repeater"
    >
      {rows.map((row, i) => (
        <li key={row?.id ?? i} className="flex items-baseline gap-3 py-2">
          {props.titleField && (
            <span className="text-sm font-medium text-foreground">{toText(row[props.titleField])}</span>
          )}
          {cols.map((c) => (
            <span key={c.field} className="text-sm text-muted-foreground">
              {toText(row[c.field])}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}

ComponentRegistry.register('repeater', RepeaterRenderer, {
  namespace: 'element',
  skipFallback: true,
  label: 'Repeater',
  category: 'content',
  inputs: [
    { name: 'object', type: 'string', label: 'Object', required: true, description: 'Object whose records the list repeats over' },
    { name: 'titleField', type: 'string', label: 'Title Field' },
    { name: 'fields', type: 'array', label: 'Fields', description: 'Columns per row — bare names or { field, label? }' },
    { name: 'filter', type: 'array', label: 'Filter' },
    { name: 'sort', type: 'array', label: 'Sort' },
    { name: 'limit', type: 'number', label: 'Limit' },
    { name: 'emptyText', type: 'string', label: 'Empty Text' },
    { name: 'divided', type: 'boolean', label: 'Divided', description: 'Separator between rows' },
  ],
});

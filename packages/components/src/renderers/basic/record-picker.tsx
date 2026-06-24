/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * element:record_picker — an interactive element that lets the user pick one
 * record of an object and writes the selection into a page variable.
 *
 * Data binding follows the spec's ElementDataSource (`schema.dataSource`):
 *   { object, filter?, sort?, limit? }
 * with `properties.object` accepted as a fallback. Display config is read off
 * `schema.properties`:
 *   { labelField='name', valueField='id', label?, placeholder?, emptyText? }
 *
 * The selection is written through `usePageVariableBinding(schema.id)`: the
 * page variable whose `source` equals this picker's id receives the selected
 * record's `valueField` (default the record id). With no bound variable the
 * picker is uncontrolled (still usable, just inert) so it never throws outside
 * a Page. The written value drives any predicate referencing `page.<var>`
 * (e.g. another component's `visible` / `visibility`).
 */

import * as React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { useAdapter, usePageVariableBinding } from '@object-ui/react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../../ui';
import { cn } from '../../lib/utils';

function readProps<T extends Record<string, any>>(schema: any): T {
  // Per spec, element components carry their config in `schema.properties`.
  // Tolerate `schema.props` (legacy alias) so JSON written either way works.
  const fromProperties = (schema?.properties ?? {}) as T;
  const fromProps = (schema?.props ?? {}) as T;
  return { ...fromProps, ...fromProperties };
}

function toText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    const o = v as Record<string, any>;
    return String(o.label ?? o.name ?? o.title ?? o.en ?? '');
  }
  return String(v);
}

function ElementRecordPickerRenderer({ schema }: { schema: any }) {
  const props = readProps<{
    object?: string;
    labelField?: string;
    valueField?: string;
    label?: unknown;
    placeholder?: string;
    emptyText?: string;
    filter?: unknown;
    sort?: any;
    limit?: number;
  }>(schema);

  // Per-element data binding (ElementDataSourceSchema) takes precedence over the
  // flat `properties.object` shorthand.
  const ds = (schema?.dataSource ?? {}) as {
    object?: string;
    filter?: unknown;
    sort?: unknown;
    limit?: number;
  };
  const object = ds.object ?? props.object;
  const filter = ds.filter ?? props.filter;
  const sort = ds.sort ?? props.sort;
  const limit = ds.limit ?? props.limit ?? 50;
  const labelField = props.labelField ?? 'name';
  const valueField = props.valueField ?? 'id';

  const adapter = useAdapter() as any;
  const binding = usePageVariableBinding(schema?.id);

  const [rows, setRows] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const filterKey = React.useMemo(() => (filter ? JSON.stringify(filter) : ''), [filter]);

  React.useEffect(() => {
    let cancelled = false;
    if (!adapter || !object || typeof adapter.find !== 'function') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const query: any = {};
        if (filter) query.$filter = filter;
        if (sort) query.$orderby = sort;
        if (limit) query.$top = limit;
        const res = await adapter.find(object, query);
        const data: any[] = res?.data ?? res?.records ?? (Array.isArray(res) ? res : []);
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
  }, [adapter, object, filterKey, limit]);

  // Reflect the bound variable's value back into the control. When a variable
  // targets this picker we stay controlled for its whole lifetime (empty string
  // = no selection) so React never warns about an uncontrolled->controlled switch
  // once the first value lands. With no binding the picker is uncontrolled and
  // Radix manages its own state. shadcn Select keys on exact string values, so
  // coerce the id to a string.
  const current = binding?.value;
  const value = binding ? String(current ?? '') : undefined;

  const handleChange = React.useCallback(
    (next: string) => {
      binding?.setValue(next);
    },
    [binding],
  );

  const label = toText(props.label);
  const placeholder = props.placeholder ?? 'Select a record…';

  return (
    <div
      className={cn('space-y-1.5', schema?.className)}
      data-testid="record-picker"
      data-picker-id={schema?.id}
    >
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <Select
        value={value}
        onValueChange={handleChange}
        disabled={loading || !!error || !object}
      >
        <SelectTrigger className="w-full max-w-xs" data-testid="record-picker-trigger">
          <SelectValue
            placeholder={loading ? 'Loading…' : error ? 'Failed to load' : placeholder}
          />
        </SelectTrigger>
        <SelectContent>
          {rows.map((row, i) => {
            const v = row?.[valueField];
            const key = v == null ? String(i) : String(v);
            return (
              <SelectItem key={key} value={key}>
                {toText(row?.[labelField]) || key}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {!loading && !error && rows.length === 0 && (
        <p className="text-xs text-muted-foreground">{props.emptyText ?? 'No records'}</p>
      )}
    </div>
  );
}

ComponentRegistry.register('element:record_picker', ElementRecordPickerRenderer, {
  namespace: 'element',
  label: 'Record Picker',
  category: 'input',
  inputs: [
    { name: 'object', type: 'string', label: 'Object' },
    { name: 'labelField', type: 'string', label: 'Label Field' },
    { name: 'valueField', type: 'string', label: 'Value Field' },
    { name: 'placeholder', type: 'string', label: 'Placeholder' },
    { name: 'label', type: 'string', label: 'Label' },
  ],
});

export { ElementRecordPickerRenderer };

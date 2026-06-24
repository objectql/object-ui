// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowKeyValueField — a small repeatable key/value editor for object-map
 * config (e.g. an action's `params`, a subflow's `input`, request `headers`).
 *
 * Design notes (why local draft state instead of commit-on-keystroke):
 *  - The host inspector owns the draft and re-renders from the top on every
 *    `onPatch`. Committing each keystroke would rehydrate rows mid-edit and
 *    drop focus / collapse half-typed keys. So rows live in LOCAL state and
 *    only flush to `onCommit` on blur, Enter, add, or remove.
 *  - Rows carry a STABLE `id` (not the editable key) so renaming a key never
 *    remounts the row — caret and focus are preserved.
 *  - Values are smart-parsed on commit (number / boolean / else string) so an
 *    author can type `3` or `true` without writing JSON. Empty and duplicate
 *    keys are skipped when flushing (last non-empty wins is avoided — earlier
 *    rows take precedence).
 */

import * as React from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Input, Label } from '@object-ui/components';
import { uniqueId } from './_shared';
import { VariableTextInput } from './VariableTextInput';
import type { ScopeGroup } from './useFlowScope';

export interface Row {
  id: string;
  key: string;
  /** Display string for the value cell. */
  raw: string;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Render a stored value as an editable string. */
function toRaw(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

/** Smart-parse an edited value string back to a scalar (no hand-written JSON). */
function parseValue(raw: string): unknown {
  const s = raw.trim();
  if (s === '') return '';
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  // Round-trip non-scalar values losslessly: a filter operator like
  // `{"$ne": null}` or an array must parse back to its object/array form, not
  // be flattened to a string. Template refs like `{leadId}` are not valid JSON
  // and correctly fall through to a plain string.
  if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
    try {
      return JSON.parse(s);
    } catch {
      return raw;
    }
  }
  return raw;
}

/**
 * Read the stored value as `[key, value]` entries, accepting BOTH shapes a
 * key/value config field can hold: the common object map (`{ var: value }`) and
 * the assignment-node ARRAY form (`[{ variable|name|key, value }]`). The shape
 * is preserved on write (see {@link rowsToValue}).
 */
export function toEntries(value: unknown): Array<[string, unknown]> {
  if (Array.isArray(value)) {
    return value
      .filter((it): it is Record<string, unknown> => isPlainObject(it))
      .map((it) => {
        const k = it.variable ?? it.name ?? it.key;
        return [typeof k === 'string' ? k : '', it.value] as [string, unknown];
      });
  }
  if (isPlainObject(value)) return Object.entries(value);
  return [];
}

function toRows(value: unknown, existingIds: string[]): Row[] {
  const ids = [...existingIds];
  return toEntries(value).map(([key, val]) => {
    const id = uniqueId('kv', ids);
    ids.push(id);
    return { id, key, raw: toRaw(val) };
  });
}

/** Flush rows back to the SAME shape, skipping empty/duplicate keys (first wins). */
export function rowsToValue(
  rows: Row[],
  arrayShape: boolean,
): Record<string, unknown> | Array<Record<string, unknown>> {
  const seen = new Set<string>();
  if (arrayShape) {
    const list: Array<Record<string, unknown>> = [];
    for (const r of rows) {
      const k = r.key.trim();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      list.push({ variable: k, value: parseValue(r.raw) });
    }
    return list;
  }
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out[k] = parseValue(r.raw);
  }
  return out;
}

/** Stable serialization for the resync guard (order-insensitive for objects). */
function serialize(value: Record<string, unknown> | Array<Record<string, unknown>> | undefined): string {
  if (Array.isArray(value)) return JSON.stringify(value);
  const obj = value ?? {};
  const sorted = Object.keys(obj).sort().reduce<Record<string, unknown>>((acc, k) => {
    acc[k] = obj[k];
    return acc;
  }, {});
  return JSON.stringify(sorted);
}

export interface FlowKeyValueFieldProps {
  label: string;
  value: unknown;
  onCommit: (value: Record<string, unknown> | Array<Record<string, unknown>> | undefined) => void;
  disabled?: boolean;
  help?: string;
  addLabel: string;
  keyLabel: string;
  valueLabel: string;
  removeLabel: string;
  emptyLabel: string;
  /** In-scope variable references for the data-picker (#1934). */
  scopeGroups?: ScopeGroup[];
}

export function FlowKeyValueField({
  label,
  value,
  onCommit,
  disabled,
  help,
  addLabel,
  keyLabel,
  valueLabel,
  removeLabel,
  emptyLabel,
  scopeGroups,
}: FlowKeyValueFieldProps) {
  // Preserve whichever shape the value was authored in (object map vs the
  // assignment-node array form) across edits.
  const arrayShape = Array.isArray(value);
  // Normalized serialization of the stored value — used only to detect an
  // EXTERNAL change (node switch) that should resync the rows.
  const external = React.useMemo(
    () => serialize(rowsToValue(toRows(value, []), arrayShape)),
    [value, arrayShape],
  );
  const [rows, setRows] = React.useState<Row[]>(() => toRows(value, []));
  // Track the last value we committed so an external change can resync rows
  // without clobbering an in-progress edit of the same node.
  const lastCommitted = React.useRef(external);

  React.useEffect(() => {
    if (external !== lastCommitted.current) {
      setRows(toRows(value, []));
      lastCommitted.current = external;
    }
  }, [external, value]);

  const flush = (nextRows: Row[]) => {
    const out = rowsToValue(nextRows, arrayShape);
    lastCommitted.current = serialize(out);
    const empty = Array.isArray(out) ? out.length === 0 : Object.keys(out).length === 0;
    onCommit(empty ? undefined : out);
  };

  const setRowField = (id: string, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setRows((rs) => [...rs, { id: uniqueId('kv', rs.map((r) => r.id)), key: '', raw: '' }]);
  };

  const removeRow = (id: string) => {
    setRows((rs) => {
      const next = rs.filter((r) => r.id !== id);
      flush(next);
      return next;
    });
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="space-y-1.5">
        {rows.length === 0 && (
          <p className="text-[11px] italic text-muted-foreground">{emptyLabel}</p>
        )}
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-1.5">
            <Input
              value={row.key}
              onChange={(e) => setRowField(row.id, { key: e.target.value })}
              onBlur={() => flush(rows)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              placeholder={keyLabel}
              disabled={disabled}
              className="h-8 flex-1 font-mono text-xs"
            />
            <VariableTextInput
              mode="template"
              value={row.raw}
              onValueChange={(v) => setRowField(row.id, { raw: v })}
              onBlur={() => flush(rows)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              groups={scopeGroups ?? []}
              placeholder={valueLabel}
              disabled={disabled}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 p-0 text-muted-foreground"
              onClick={() => removeRow(row.id)}
              disabled={disabled}
              aria-label={removeLabel}
              title={removeLabel}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 w-full text-xs"
        onClick={addRow}
        disabled={disabled}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        {addLabel}
      </Button>
      {help && <p className="text-[11px] leading-snug text-muted-foreground">{help}</p>}
    </div>
  );
}

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowObjectListField — a repeatable array-of-objects editor driven by a column
 * schema (e.g. a screen node's `fields`: a list of `{name,label,type,required,
 * visibleWhen}` definitions).
 *
 * Like the sibling key/value and string-list editors, rows are held in LOCAL
 * state with a STABLE id and flushed on blur / Enter / add / remove so a row
 * never remounts mid-keystroke. Empty per-cell values are pruned; a row with no
 * populated cells is dropped on flush; an empty list commits `undefined`.
 */

import * as React from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Input, Label, Checkbox } from '@object-ui/components';
import { uniqueId } from './_shared';
import type { FlowConfigColumn } from './flow-node-config';
import { ReferenceCombobox, resolveRefKind, type FlowReferenceContext } from './FlowReferenceField';

type Cell = string | boolean;
interface Row {
  id: string;
  values: Record<string, Cell>;
}

function toRows(list: Array<Record<string, unknown>>, columns: FlowConfigColumn[]): Row[] {
  const ids: string[] = [];
  return list.map((item) => {
    const id = uniqueId('ol', ids);
    ids.push(id);
    const values: Record<string, Cell> = {};
    for (const col of columns) {
      const v = item[col.key];
      if (col.kind === 'boolean') values[col.key] = v === true;
      else if (v != null) values[col.key] = String(v);
      else values[col.key] = '';
    }
    return { id, values };
  });
}

function rowsToList(rows: Row[], columns: FlowConfigColumn[]): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    const obj: Record<string, unknown> = {};
    let hasValue = false;
    for (const col of columns) {
      const v = row.values[col.key];
      if (col.kind === 'boolean') {
        if (v === true) {
          obj[col.key] = true;
          hasValue = true;
        }
      } else if (typeof v === 'string' && v.trim() !== '') {
        obj[col.key] = v.trim();
        hasValue = true;
      }
    }
    if (hasValue) out.push(obj);
  }
  return out;
}

export interface FlowObjectListFieldProps {
  label: string;
  columns: FlowConfigColumn[];
  value: unknown;
  onCommit: (value: Array<Record<string, unknown>> | undefined) => void;
  disabled?: boolean;
  addLabel: string;
  removeLabel: string;
  emptyLabel: string;
  /** Draft + node context so `reference` columns can resolve their options. */
  context?: FlowReferenceContext;
}

export function FlowObjectListField({
  label,
  columns,
  value,
  onCommit,
  disabled,
  addLabel,
  removeLabel,
  emptyLabel,
  context,
}: FlowObjectListFieldProps) {
  const external = React.useMemo(
    () =>
      Array.isArray(value)
        ? (value.filter((v) => v && typeof v === 'object') as Array<Record<string, unknown>>)
        : [],
    [value],
  );
  const [rows, setRows] = React.useState<Row[]>(() => toRows(external, columns));
  const lastCommitted = React.useRef(JSON.stringify(external));

  React.useEffect(() => {
    const next = JSON.stringify(external);
    if (next !== lastCommitted.current) {
      setRows(toRows(external, columns));
      lastCommitted.current = next;
    }
  }, [external, columns]);

  const flush = (nextRows: Row[]) => {
    const list = rowsToList(nextRows, columns);
    lastCommitted.current = JSON.stringify(list);
    onCommit(list.length ? list : undefined);
  };

  const setCell = (id: string, key: string, v: Cell) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, values: { ...r.values, [key]: v } } : r)));
  };

  const addRow = () => {
    const values: Record<string, Cell> = {};
    for (const col of columns) values[col.key] = col.kind === 'boolean' ? false : '';
    setRows((rs) => [...rs, { id: uniqueId('ol', rs.map((r) => r.id)), values }]);
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
      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="text-[11px] italic text-muted-foreground">{emptyLabel}</p>
        )}
        {rows.map((row) => (
          <div key={row.id} className="rounded border bg-muted/30 p-2">
            <div className="mb-1 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground"
                onClick={() => removeRow(row.id)}
                disabled={disabled}
                aria-label={removeLabel}
                title={removeLabel}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-1.5">
              {columns.map((col) => (
                <div key={col.key} className="flex items-center gap-2">
                  <Label className="w-24 shrink-0 text-[11px] text-muted-foreground">
                    {col.label}
                  </Label>
                  {col.kind === 'boolean' ? (
                    <Checkbox
                      checked={row.values[col.key] === true}
                      onCheckedChange={(c) => {
                        setRows((rs) => {
                          const next = rs.map((r) =>
                            r.id === row.id
                              ? { ...r, values: { ...r.values, [col.key]: c === true } }
                              : r,
                          );
                          flush(next);
                          return next;
                        });
                      }}
                      disabled={disabled}
                    />
                  ) : col.kind === 'reference' ? (
                    <div className="flex-1">
                      <ReferenceCombobox
                        resolved={resolveRefKind(col.ref, (k) => row.values[k])}
                        value={typeof row.values[col.key] === 'string' ? (row.values[col.key] as string) : ''}
                        onCommit={(v) => setCell(row.id, col.key, typeof v === 'string' ? v : '')}
                        onBlur={() => flush(rows)}
                        placeholder={col.placeholder}
                        disabled={disabled}
                        context={context}
                        showHint={false}
                      />
                    </div>
                  ) : (
                    <Input
                      value={typeof row.values[col.key] === 'string' ? (row.values[col.key] as string) : ''}
                      onChange={(e) => setCell(row.id, col.key, e.target.value)}
                      onBlur={() => flush(rows)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      placeholder={col.placeholder}
                      disabled={disabled}
                      className={`h-8 flex-1 text-xs${col.kind === 'expression' ? ' font-mono' : ''}`}
                    />
                  )}
                </div>
              ))}
            </div>
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
    </div>
  );
}

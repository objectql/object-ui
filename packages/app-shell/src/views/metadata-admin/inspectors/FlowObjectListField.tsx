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
 *
 * A column may itself be a *list* (`stringList` / `numberList` / `objectList`) —
 * a repeater-in-repeater. Those cells hold an array and render the matching
 * sibling editor inline (recursively, for `objectList`), so an engine-published
 * nested-array config is editable here instead of dropping to Advanced JSON.
 */

import * as React from 'react';
import { Plus, X } from 'lucide-react';
import {
  Button, Input, Label, Checkbox,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@object-ui/components';
import { uniqueId } from './_shared.js';
import type { FlowConfigColumn } from './flow-node-config.js';
import { ReferenceCombobox, resolveRefKind, type FlowReferenceContext } from './FlowReferenceField.js';
import { FlowStringListField } from './FlowStringListField.js';
import { VariableTextInput } from './VariableTextInput.js';
import type { ScopeGroup } from './useFlowScope.js';
import { FlowExprIssue } from './FlowExprIssue.js';

/** A cell is a scalar (string/boolean) or, for a nested-list column, an array. */
type Cell = string | boolean | unknown[];
interface Row {
  id: string;
  values: Record<string, Cell>;
}

/** Columns whose cell holds an array (a nested repeater) rather than a scalar. */
function isListColumn(kind: FlowConfigColumn['kind']): boolean {
  return kind === 'stringList' || kind === 'numberList' || kind === 'objectList';
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
      else if (isListColumn(col.kind)) values[col.key] = Array.isArray(v) ? v : [];
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
      } else if (isListColumn(col.kind)) {
        // A nested list commits its own already-normalized array (string[] /
        // number[] / object[]); an empty nested list drops the key entirely.
        if (Array.isArray(v) && v.length > 0) {
          obj[col.key] = v;
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
  /** Per-item placeholder for nested `stringList` / `numberList` columns. */
  itemLabel?: string;
  /** Draft + node context so `reference` columns can resolve their options. */
  context?: FlowReferenceContext;
  /** In-scope variable references for `expression` columns (#1934). */
  scopeGroups?: ScopeGroup[];
  /**
   * #3447: picker groups for approval `expression` approver cells — the
   * closed current/trigger/vars root set. Regular flow scopeGroups must NOT
   * be offered there (record.* / bare-field spellings are rejected at
   * runtime), which is why this rides as its own prop.
   */
  approvalScopeGroups?: ScopeGroup[];
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
  itemLabel,
  context,
  scopeGroups,
  approvalScopeGroups,
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

  // Set a cell AND flush — used by controls with no blur to flush on (checkbox,
  // select, record lookup) and by the nested-list editors, which each commit a
  // whole array on their own blur/add/remove.
  //
  // The flush must NOT happen inside the `setRows` updater (objectui#2838):
  // React runs updaters during the RENDER phase, so calling `onCommit` there
  // reaches the parent's setState mid-render —
  //   Cannot update a component (`MetadataResourceEditPageImpl`) while rendering
  //   a different component (`FlowObjectListField`).
  // React usually computes an updater eagerly inside the dispatch, which hides
  // the warning; it surfaces as soon as the component already has a queued
  // update (type in a cell, then hit the row's ✕), which is why the plain suites
  // never caught it and the real designer warns on every commit.
  //
  // So: the handler bumps a commit token alongside the row update, the updater
  // stays pure, and the effect below flushes AFTER commit — publishing the rows
  // React actually applied rather than a stale closure read.
  const [commitToken, setCommitToken] = React.useState(0);

  React.useEffect(() => {
    if (commitToken === 0) return; // mount, not a commit
    flush(rows);
    // Keyed on the token ALONE. `rows` also changes when the external value
    // syncs down (the effect above), and flushing then would echo the parent's
    // own value back at it; the token only moves on a real interaction. `rows`
    // is still read fresh here — both setStates batch into the render this
    // effect belongs to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commitToken]);

  const commitCell = (id: string, key: string, v: Cell) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, values: { ...r.values, [key]: v } } : r)));
    setCommitToken((t) => t + 1);
  };

  const addRow = () => {
    const values: Record<string, Cell> = {};
    for (const col of columns) values[col.key] = col.kind === 'boolean' ? false : isListColumn(col.kind) ? [] : '';
    setRows((rs) => [...rs, { id: uniqueId('ol', rs.map((r) => r.id)), values }]);
  };

  // Same shape as `commitCell`: bump the token, let the effect publish
  // (objectui#2838).
  const removeRow = (id: string) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
    setCommitToken((t) => t + 1);
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
              {columns.map((col) => {
                // A nested-list column (repeater-in-repeater) renders full-width
                // as its own list editor, set off with a left rule. `stringList` /
                // `numberList` reuse FlowStringListField; `objectList` recurses.
                if (col.kind === 'stringList' || col.kind === 'numberList') {
                  const raw = row.values[col.key];
                  const arr = Array.isArray(raw) ? raw : [];
                  return (
                    <div key={col.key} className="border-l-2 border-muted/60 pl-2">
                      <FlowStringListField
                        label={col.label}
                        value={col.kind === 'numberList' ? arr.map((n) => String(n)) : arr}
                        onCommit={(v) => {
                          if (col.kind === 'numberList') {
                            const nums = (v ?? [])
                              .map((s) => Number(String(s).trim()))
                              .filter((n) => Number.isFinite(n));
                            commitCell(row.id, col.key, nums);
                          } else {
                            commitCell(row.id, col.key, v ?? []);
                          }
                        }}
                        disabled={disabled}
                        addLabel={addLabel}
                        itemLabel={itemLabel ?? col.label}
                        removeLabel={removeLabel}
                        emptyLabel={emptyLabel}
                      />
                    </div>
                  );
                }
                if (col.kind === 'objectList') {
                  const raw = row.values[col.key];
                  const arr = (Array.isArray(raw) ? raw : []) as Array<Record<string, unknown>>;
                  return (
                    <div key={col.key} className="border-l-2 border-muted/60 pl-2">
                      <FlowObjectListField
                        label={col.label}
                        columns={col.columns ?? []}
                        value={arr}
                        onCommit={(v) => commitCell(row.id, col.key, v ?? [])}
                        disabled={disabled}
                        addLabel={addLabel}
                        removeLabel={removeLabel}
                        emptyLabel={emptyLabel}
                        itemLabel={itemLabel}
                        context={context}
                        scopeGroups={scopeGroups}
                      />
                    </div>
                  );
                }
                return (
                  <div key={col.key} className="flex items-center gap-2">
                  <Label className="w-24 shrink-0 text-[11px] text-muted-foreground">
                    {col.label}
                  </Label>
                  {col.kind === 'boolean' ? (
                    <Checkbox
                      checked={row.values[col.key] === true}
                      onCheckedChange={(c) => commitCell(row.id, col.key, c === true)}
                      disabled={disabled}
                    />
                  ) : col.kind === 'reference' ? (
                    (() => {
                      const resolved = resolveRefKind(col.ref, (k) => row.values[k]);
                      const disc = col.ref?.kindFrom
                        ? String(row.values[col.ref.kindFrom] ?? '')
                        : '';
                      // #3447: `expression` is a discriminator value, not a
                      // reference kind — an approver whose sibling `type` is
                      // 'expression' authors a CEL expression over the approval
                      // roots (current/trigger/vars). Render the expression
                      // input (mono + syntax check) instead of a dead free-text
                      // reference box, with the APPROVAL scope groups — never
                      // the regular flow scopeGroups, whose record.x /
                      // bare-field spellings the runtime rejects. The same
                      // groups feed FlowExprIssue, so an out-of-contract root
                      // warns inline with a "did you mean" before os lint /
                      // the node-entry pre-check reject it server-side.
                      if (resolved === undefined && disc === 'expression') {
                        const raw = typeof row.values[col.key] === 'string' ? (row.values[col.key] as string) : '';
                        return (
                          <div className="flex-1 space-y-1">
                            <VariableTextInput
                              mode="expression"
                              mono
                              value={raw}
                              onValueChange={(v) => setCell(row.id, col.key, v)}
                              onBlur={() => flush(rows)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              }}
                              groups={approvalScopeGroups ?? []}
                              placeholder={col.placeholder ?? 'current.<field> · trigger.<field> · vars.<node>.<key>'}
                              disabled={disabled}
                            />
                            <FlowExprIssue value={raw} role="value" scopeGroups={approvalScopeGroups} />
                          </div>
                        );
                      }
                      return (
                        <div className="flex-1">
                          <ReferenceCombobox
                            resolved={resolved}
                            value={typeof row.values[col.key] === 'string' ? (row.values[col.key] as string) : ''}
                            onCommit={(v) => setCell(row.id, col.key, typeof v === 'string' ? v : '')}
                            onBlur={() => flush(rows)}
                            // Picker-style selections (record lookup, strict
                            // select) have no blur to flush on — set-and-flush
                            // atomically, like the checkbox/select cells.
                            onSelect={(v) => commitCell(row.id, col.key, v)}
                            placeholder={col.placeholder}
                            disabled={disabled}
                            context={context}
                            showHint={false}
                          />
                        </div>
                      );
                    })()
                  ) : col.kind === 'select' ? (
                    (() => {
                      const current =
                        typeof row.values[col.key] === 'string' ? (row.values[col.key] as string) : '';
                      const opts = col.options ?? [];
                      // A stored value dropped from the options (a deprecated
                      // enum member, e.g. the `role` approver type per
                      // ADR-0090 D3) must still render, or editing a legacy row
                      // would silently blank it. Surface it as selectable but
                      // flag it — it is not offered to fresh rows.
                      const shown =
                        current && !opts.some((o) => o.value === current)
                          ? [...opts, { value: current, label: `${current} (deprecated)` }]
                          : opts;
                      return (
                        <div className="flex-1">
                          <Select
                            value={current || undefined}
                            onValueChange={(v) => commitCell(row.id, col.key, v)}
                            disabled={disabled}
                          >
                            <SelectTrigger className="h-8 w-full text-xs">
                              <SelectValue placeholder={col.placeholder ?? '—'} />
                            </SelectTrigger>
                            <SelectContent>
                              {shown.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })()
                  ) : col.kind === 'expression' ? (
                    <div className="flex-1 space-y-1">
                      <VariableTextInput
                        mode="expression"
                        mono
                        value={typeof row.values[col.key] === 'string' ? (row.values[col.key] as string) : ''}
                        onValueChange={(v) => setCell(row.id, col.key, v)}
                        onBlur={() => flush(rows)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        groups={scopeGroups ?? []}
                        placeholder={col.placeholder}
                        disabled={disabled}
                      />
                      <FlowExprIssue
                        value={typeof row.values[col.key] === 'string' ? (row.values[col.key] as string) : ''}
                        role="predicate"
                        scopeGroups={scopeGroups}
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
                      className="h-8 flex-1 text-xs"
                    />
                  )}
                  </div>
                );
              })}
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

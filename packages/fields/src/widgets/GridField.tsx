import React, { useCallback } from 'react';
import { FieldWidgetProps } from './types';
import {
  cn,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@object-ui/components';
import { Plus, Trash2 } from 'lucide-react';

/**
 * GridField / LineItemsField — editable child-grid ("line items") widget.
 *
 * A controlled component: `value` is an array of row objects, `onChange`
 * receives the next array. It renders one editable cell per configured
 * column, supports add / delete row, and shows a running total of a numeric
 * column. This is the renderer for the `field:grid` widget and the cell
 * engine behind the master-detail subform (see ADR-0001).
 *
 * Column config (a subset of `GridColumnDefinition`):
 *   { field, label?, type?, options?, width?, required?, prefix?, step? }
 *   type ∈ 'text' | 'number' | 'currency' | 'date' | 'select'
 *
 * Field-level config (from `GridFieldMetadata`):
 *   columns, min_rows, max_rows, allow_add, allow_delete, total_field
 */

export interface GridColumn {
  field: string;
  label?: string;
  type?: 'text' | 'number' | 'currency' | 'date' | 'select';
  options?: Array<{ label: string; value: string }>;
  width?: number;
  required?: boolean;
  prefix?: string;
  step?: number;
}

type Row = Record<string, any>;

const isNumeric = (t?: string) => t === 'number' || t === 'currency';

function coerce(type: string | undefined, raw: string): any {
  if (isNumeric(type)) {
    if (raw === '' || raw == null) return null;
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  return raw;
}

/** Sum a numeric column across rows (ignoring blanks/NaN). */
export function sumColumn(rows: Row[], field: string): number {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((acc, r) => {
    const v = Number(r?.[field]);
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);
}

export function GridField({
  value,
  onChange,
  field,
  readonly,
  disabled,
  className,
  ...props
}: FieldWidgetProps<Row[]>) {
  const cfg = (field || (props as any).schema || {}) as any;
  const columns: GridColumn[] = cfg.columns || [];
  const rows: Row[] = Array.isArray(value) ? value : [];

  const allowAdd = cfg.allow_add !== false && !readonly && !disabled;
  const allowDelete = cfg.allow_delete !== false && !readonly && !disabled;
  // Enterprise line grids (NetSuite/SAP/Salesforce) show a line-number column.
  const showLineNumbers = cfg.show_line_numbers !== false;
  const minRows: number = cfg.min_rows ?? 0;
  const maxRows: number | undefined = cfg.max_rows;
  const totalField: string | undefined =
    cfg.total_field || cfg.amount_field || cfg.amountField;

  const emit = useCallback(
    (next: Row[]) => onChange?.(next),
    [onChange],
  );

  const setCell = useCallback(
    (rowIdx: number, col: GridColumn, raw: string) => {
      const next = rows.map((r, i) =>
        i === rowIdx ? { ...r, [col.field]: coerce(col.type, raw) } : r,
      );
      emit(next);
    },
    [rows, emit],
  );

  const addRow = useCallback(() => {
    if (maxRows != null && rows.length >= maxRows) return;
    const blank: Row = {};
    for (const c of columns) blank[c.field] = null;
    emit([...rows, blank]);
  }, [rows, columns, maxRows, emit]);

  const removeRow = useCallback(
    (rowIdx: number) => {
      if (rows.length <= minRows) return;
      emit(rows.filter((_, i) => i !== rowIdx));
    },
    [rows, minRows, emit],
  );

  const showTotal = !!totalField;
  const total = showTotal ? sumColumn(rows, totalField!) : 0;

  // ── Read-only / view rendering ────────────────────────────────────────────
  if (readonly) {
    return (
      <div
        className={cn('border border-border rounded-lg overflow-hidden', className)}
        data-testid="line-items-readonly"
      >
        <table className="w-full text-sm">
          <thead className="bg-muted border-b border-border">
            <tr>
              {showLineNumbers && (
                <th className="w-10 px-2 py-2 text-right text-xs font-medium text-muted-foreground">#</th>
              )}
              {columns.map((c) => (
                <th
                  key={c.field}
                  className={cn(
                    'px-3 py-2 text-xs font-medium text-muted-foreground',
                    isNumeric(c.type) ? 'text-right' : 'text-left',
                  )}
                >
                  {c.label || c.field}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(columns.length + (showLineNumbers ? 1 : 0), 1)}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No items
                </td>
              </tr>
            ) : (
              rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {showLineNumbers && (
                    <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">{rowIdx + 1}</td>
                  )}
                  {columns.map((c) => (
                    <td
                      key={c.field}
                      className={cn('px-3 py-2 text-foreground', isNumeric(c.type) && 'text-right tabular-nums')}
                    >
                      {row[c.field] != null && row[c.field] !== ''
                        ? String(row[c.field])
                        : '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {showTotal && (
            <tfoot className="border-t border-border bg-muted/40">
              <tr>
                <td
                  colSpan={Math.max((showLineNumbers ? 1 : 0) + columns.length - 1, 1)}
                  className="px-3 py-2 text-right text-xs font-medium text-muted-foreground"
                >
                  Total
                </td>
                <td className="px-3 py-2 text-right font-medium text-foreground tabular-nums">
                  {total.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    );
  }

  // ── Editable rendering ──────────────────────────────────────────────────────
  return (
    <div className={cn('space-y-2', className)} data-testid="line-items">
      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b border-border">
            <tr>
              {showLineNumbers && (
                <th className="w-10 px-2 py-2 text-right text-xs font-medium text-muted-foreground">#</th>
              )}
              {columns.map((c) => (
                <th
                  key={c.field}
                  className={cn(
                    'px-3 py-2 text-xs font-medium text-muted-foreground',
                    isNumeric(c.type) ? 'text-right' : 'text-left',
                  )}
                  style={c.width ? { width: c.width } : undefined}
                >
                  {c.label || c.field}
                  {c.required && <span className="text-destructive"> *</span>}
                </th>
              ))}
              {allowDelete && <th className="w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (allowDelete ? 1 : 0) + (showLineNumbers ? 1 : 0)}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No items yet — click “{cfg.add_label || 'Add line'}” to begin.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-muted/30">
                  {showLineNumbers && (
                    <td className="px-2 py-1.5 text-right align-middle text-muted-foreground tabular-nums">
                      {rowIdx + 1}
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.field} className="px-2 py-1.5 align-top">
                      {c.type === 'select' ? (
                        <Select
                          value={row[c.field] != null ? String(row[c.field]) : ''}
                          onValueChange={(v) => setCell(rowIdx, c, v)}
                          disabled={disabled}
                        >
                          <SelectTrigger className="h-8" aria-label={c.label || c.field}>
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {(c.options || []).map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="relative">
                          {c.type === 'currency' && (
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              {c.prefix || '¥'}
                            </span>
                          )}
                          <Input
                            className={cn('h-8', c.type === 'currency' && 'pl-6', isNumeric(c.type) && 'text-right')}
                            type={
                              c.type === 'date'
                                ? 'date'
                                : isNumeric(c.type)
                                  ? 'number'
                                  : 'text'
                            }
                            step={isNumeric(c.type) ? c.step ?? 'any' : undefined}
                            aria-label={c.label || c.field}
                            value={row[c.field] != null ? String(row[c.field]) : ''}
                            onChange={(e) => setCell(rowIdx, c, e.target.value)}
                            disabled={disabled}
                          />
                        </div>
                      )}
                    </td>
                  ))}
                  {allowDelete && (
                    <td className="px-2 py-1.5 text-center align-middle">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label="Remove row"
                        onClick={() => removeRow(rowIdx)}
                        disabled={disabled || rows.length <= minRows}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {showTotal && (
            <tfoot className="border-t border-border bg-muted/40">
              <tr>
                <td
                  colSpan={Math.max((showLineNumbers ? 1 : 0) + columns.length - 1, 1)}
                  className="px-3 py-2 text-right text-xs font-medium text-muted-foreground"
                >
                  Total
                </td>
                <td className="px-3 py-2 text-right font-medium text-foreground tabular-nums" data-testid="line-items-total">
                  {total.toLocaleString()}
                </td>
                {allowDelete && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {allowAdd && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={maxRows != null && rows.length >= maxRows}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {cfg.add_label || 'Add line'}
        </Button>
      )}
    </div>
  );
}

/** Semantic alias — the master-detail subform's child grid. */
export const LineItemsField = GridField;

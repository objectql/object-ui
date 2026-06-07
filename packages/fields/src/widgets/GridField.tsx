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
  Popover,
  PopoverTrigger,
  PopoverContent,
  Checkbox,
  Label,
} from '@object-ui/components';
import { Plus, Trash2, SlidersHorizontal, Maximize2 } from 'lucide-react';
import { LookupField } from './LookupField';

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
  type?: 'text' | 'number' | 'currency' | 'date' | 'select' | 'lookup';
  options?: Array<{ label: string; value: string }>;
  width?: number;
  required?: boolean;
  prefix?: string;
  step?: number;
  /** For `type: 'lookup'` — the referenced object and label/id fields. */
  reference?: string;
  displayField?: string;
  idField?: string;
  multiple?: boolean;
  /**
   * Hidden from the grid by default but revealable via the column chooser.
   * Set by `deriveColumns` for fields beyond the default-visible budget — the
   * data is NOT dropped (it's just collapsed, like Odoo's `optional` columns /
   * Salesforce column personalization), so business-critical fields stay
   * reachable. Required columns are never default-hidden.
   */
  defaultHidden?: boolean;
}

type Row = Record<string, any>;

const isNumeric = (t?: string) => t === 'number' || t === 'currency';

/** Comfortable minimum widths per column type so cells never get crushed; the
 *  grid scrolls horizontally instead. Authors can still pin a `width`. */
const MIN_WIDTH_BY_TYPE: Record<string, number> = {
  text: 160,
  select: 132,
  lookup: 168,
  number: 104,
  currency: 116,
  date: 150,
};
const minWidthFor = (c: GridColumn): number => c.width ?? MIN_WIDTH_BY_TYPE[c.type ?? 'text'] ?? 132;

/** Read-only display text for a cell in list mode (select → option label,
 *  currency/number → formatted, empty → em dash). Lookups render separately. */
function displayText(c: GridColumn, value: any): string {
  if (value === null || value === undefined || value === '') return '—';
  if (c.type === 'select' && Array.isArray(c.options)) {
    const opt = c.options.find((o) => String(o.value) === String(value));
    return opt ? opt.label : String(value);
  }
  if (isNumeric(c.type)) {
    const n = Number(value);
    if (Number.isFinite(n)) return c.type === 'currency' ? `${c.prefix || '¥'}${n.toLocaleString()}` : n.toLocaleString();
  }
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

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
  onRowExpand,
  displayMode,
  onAdd,
  ...props
}: FieldWidgetProps<Row[]> & {
  /** When provided, each row shows an "expand" button that opens the row in a
   *  full form (the host — e.g. MasterDetailForm — renders the drawer/modal and
   *  writes the edited values back). Lets a "fat" child be edited in a real form
   *  while the grid stays a quick at-a-glance editor. */
  onRowExpand?: (rowIndex: number) => void;
  /** 'grid' (default) = editable cells; 'list' = read-only rows whose primary
   *  action is per-row edit (via `onRowExpand`) and whose Add opens a new row
   *  in the full form (via `onAdd`). The form-factor for "fat" children. */
  displayMode?: 'grid' | 'list';
  /** In 'list' mode, "Add" calls this (host opens the full form for a new row)
   *  instead of inserting a blank inline row. */
  onAdd?: () => void;
}) {
  const cfg = (field || (props as any).schema || {}) as any;
  const allColumns: GridColumn[] = cfg.columns || [];
  const rows: Row[] = Array.isArray(value) ? value : [];
  // List mode: rows are read-only at-a-glance; editing happens in the full form.
  const isList = displayMode === 'list' && !readonly;

  // Column visibility — a curated default-visible set with the rest revealable
  // via the column chooser (mainstream "personalize columns" pattern). Required
  // columns are always visible; nothing is ever silently dropped.
  const [extraShown, setExtraShown] = React.useState<Set<string>>(() => new Set());
  const optionalColumns = allColumns.filter((c) => c.defaultHidden && !c.required);
  const columns: GridColumn[] = allColumns.filter(
    (c) => !c.defaultHidden || c.required || extraShown.has(c.field),
  );
  const toggleColumn = useCallback((fieldName: string) => {
    setExtraShown((prev) => {
      const next = new Set(prev);
      if (next.has(fieldName)) next.delete(fieldName);
      else next.add(fieldName);
      return next;
    });
  }, []);

  const allowAdd = cfg.allow_add !== false && !readonly && !disabled;
  const allowDelete = cfg.allow_delete !== false && !readonly && !disabled;
  // Per-row "expand to full form" (mainstream hybrid: quick grid + rich form).
  const showExpand = typeof onRowExpand === 'function' && !readonly;
  const hasRowActions = showExpand || allowDelete;
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

  /** Set a cell to an already-typed value (lookup ids, etc.) without coercion. */
  const setCellValue = useCallback(
    (rowIdx: number, field: string, value: any) => {
      emit(rows.map((r, i) => (i === rowIdx ? { ...r, [field]: value } : r)));
    },
    [rows, emit],
  );

  const setCell = useCallback(
    (rowIdx: number, col: GridColumn, raw: string) => {
      setCellValue(rowIdx, col.field, coerce(col.type, raw));
    },
    [setCellValue],
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
  // Align the running total under the column it sums (not blindly under the
  // last column). The label sits right-aligned immediately to its left.
  const totalColIndex = showTotal ? Math.max(0, columns.findIndex((c) => c.field === totalField)) : -1;

  // Column chooser — reveal/hide the optional (default-hidden) columns. Only
  // rendered when there are optional columns to manage.
  const columnChooser = optionalColumns.length > 0 ? (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground"
          data-testid="line-items-columns"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Columns
          {extraShown.size > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
              +{extraShown.size}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <div className="px-1 pb-1.5 text-xs font-medium text-muted-foreground">Optional columns</div>
        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {optionalColumns.map((c) => {
            const id = `col-toggle-${c.field}`;
            return (
              <Label
                key={c.field}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm font-normal hover:bg-muted"
              >
                <Checkbox
                  id={id}
                  checked={extraShown.has(c.field)}
                  onCheckedChange={() => toggleColumn(c.field)}
                />
                <span className="truncate">{c.label || c.field}</span>
              </Label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  ) : null;

  // ── Read-only / view rendering ────────────────────────────────────────────
  if (readonly) {
    return (
      <div className={cn('space-y-2', className)}>
        {columnChooser && <div className="flex justify-end">{columnChooser}</div>}
        <div className="border border-border rounded-lg overflow-x-auto" data-testid="line-items-readonly">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b border-border">
            <tr>
              {showLineNumbers && (
                <th className="w-10 px-2 py-2 text-right text-xs font-medium text-muted-foreground">#</th>
              )}
              {columns.map((c) => (
                <th
                  key={c.field}
                  style={{ minWidth: minWidthFor(c) }}
                  className={cn(
                    'px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap',
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
                      {c.type === 'lookup' && row[c.field] != null && row[c.field] !== '' ? (
                        <LookupField
                          value={row[c.field]}
                          onChange={() => {}}
                          readonly
                          field={{ reference: c.reference, display_field: c.displayField, id_field: c.idField } as any}
                        />
                      ) : row[c.field] != null && row[c.field] !== '' ? (
                        String(row[c.field])
                      ) : (
                        '—'
                      )}
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
                  colSpan={Math.max((showLineNumbers ? 1 : 0) + totalColIndex, 1)}
                  className="px-3 py-2 text-right text-xs font-medium text-muted-foreground"
                >
                  Total
                </td>
                <td className="px-3 py-2 text-right font-semibold text-foreground tabular-nums">
                  {total.toLocaleString()}
                </td>
                {columns.length - totalColIndex - 1 > 0 && (
                  <td colSpan={columns.length - totalColIndex - 1} />
                )}
              </tr>
            </tfoot>
          )}
        </table>
        </div>
      </div>
    );
  }

  // ── Editable rendering ──────────────────────────────────────────────────────
  return (
    <div className={cn('space-y-2', className)} data-testid="line-items">
      {columnChooser && <div className="flex justify-end">{columnChooser}</div>}
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
                    'px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap',
                    isNumeric(c.type) ? 'text-right' : 'text-left',
                  )}
                  style={{ width: c.width, minWidth: minWidthFor(c) }}
                >
                  {c.label || c.field}
                  {c.required && <span className="text-destructive"> *</span>}
                </th>
              ))}
              {hasRowActions && <th style={{ width: showExpand && allowDelete ? 84 : 44 }} />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (hasRowActions ? 1 : 0) + (showLineNumbers ? 1 : 0)}
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
                    <td key={c.field} className={cn('px-2 py-1.5', isList ? 'align-middle' : 'align-top')}>
                      {isList ? (
                        c.type === 'lookup' && row[c.field] != null && row[c.field] !== '' ? (
                          <LookupField
                            value={row[c.field]}
                            onChange={() => {}}
                            readonly
                            field={{ reference: c.reference, display_field: c.displayField, id_field: c.idField } as any}
                          />
                        ) : (
                          <span className={cn('text-sm text-foreground', isNumeric(c.type) && 'tabular-nums', (row[c.field] == null || row[c.field] === '') && 'text-muted-foreground')}>
                            {displayText(c, row[c.field])}
                          </span>
                        )
                      ) : c.type === 'lookup' ? (
                        <LookupField
                          value={row[c.field]}
                          onChange={(v: any) => setCellValue(rowIdx, c.field, v)}
                          field={
                            {
                              reference: c.reference,
                              display_field: c.displayField,
                              id_field: c.idField,
                              multiple: c.multiple,
                              options: c.options,
                              placeholder: '—',
                            } as any
                          }
                          disabled={disabled}
                        />
                      ) : c.type === 'select' ? (
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
                  {hasRowActions && (
                    <td className="px-2 py-1.5 text-center align-middle whitespace-nowrap">
                      {showExpand && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          aria-label="Open row"
                          title="Open full form"
                          data-testid={`line-items-expand-${rowIdx}`}
                          onClick={() => onRowExpand!(rowIdx)}
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {allowDelete && (
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
                      )}
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
                  colSpan={Math.max((showLineNumbers ? 1 : 0) + totalColIndex, 1)}
                  className="px-3 py-2 text-right text-xs font-medium text-muted-foreground"
                >
                  Total
                </td>
                <td className="px-3 py-2 text-right font-semibold text-foreground tabular-nums" data-testid="line-items-total">
                  {total.toLocaleString()}
                </td>
                {(columns.length - totalColIndex - 1 + (hasRowActions ? 1 : 0)) > 0 && (
                  <td colSpan={columns.length - totalColIndex - 1 + (hasRowActions ? 1 : 0)} />
                )}
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
          onClick={isList && onAdd ? onAdd : addRow}
          disabled={maxRows != null && rows.length >= maxRows}
          data-testid="line-items-add"
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

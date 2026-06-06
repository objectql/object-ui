// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FieldsListEditor — the right-panel column manager (mainstream low-code
 * pattern: a vertical, drag-reorderable list of fields with an inline
 * "+ Add field" picker).
 *
 * This is the SINGLE owner of column read / write / reorder / remove / select
 * logic for a View variant. It is rendered in two places so the fields list is
 * always visible:
 *   • {@link ViewVariantInspector} (the home / variant panel) — no row is
 *     highlighted; clicking a row drills into the scoped column inspector.
 *   • {@link ViewColumnInspector} (the scoped column panel) — the selected row
 *     is highlighted and the column's detail props render below it.
 *
 * Columns round-trip in their original shape: string variants (e.g. kanban
 * card fields) stay strings; object variants keep `{ field, label, … }`. The
 * raw `columns` array is reordered / spliced directly — never normalised — so
 * round-trips stay lossless.
 */

import * as React from 'react';
import { Badge, Label } from '@object-ui/components';
import { appendArray, moveArray, spliceArray } from '../inspectors/_shared';
import { useObjectFields, type ObjectFieldInfo } from './useObjectFields';
import { AddFieldPopover, FieldListRow } from './ViewColumnPanes';
import {
  colFieldName,
  colLabel,
  makeColumn,
  remapIndexAfterMove,
  remapIndexAfterRemove,
  usedFieldNames,
} from './view-column-io';

export interface FieldsListEditorProps {
  /** Top-level variant key the columns belong to (e.g. 'list'). */
  variantKey: string;
  /** The variant schema; re-spread on every column write. */
  schema: Record<string, unknown>;
  /** Raw columns array (entries may be strings or objects). */
  columns: unknown[];
  /** Whether every column is a bare string (drives new-column shape). */
  allStrings: boolean;
  /** Bound object name — drives field icons + the Add-field picker. */
  objectName?: string;
  /**
   * Pre-resolved field catalog. When supplied, skips the network fetch and
   * uses this list instead (host already holds the object definition).
   */
  objectFieldsOverride?: ObjectFieldInfo[];
  /** Index of the currently selected column, or null when none. */
  selectedIndex: number | null;
  /** Read-only mode disables drag / add / remove. */
  readOnly?: boolean;
  /** Apply a shallow patch to the draft. */
  onPatch: (patch: Record<string, unknown>) => void;
  /** Emit / redirect the column selection. */
  onSelectionChange?: (
    sel: { kind: string; id: string; label?: string } | null,
  ) => void;
}

export function FieldsListEditor({
  variantKey,
  schema,
  columns,
  allStrings,
  objectName,
  objectFieldsOverride,
  selectedIndex,
  readOnly,
  onPatch,
  onSelectionChange,
}: FieldsListEditorProps) {
  const canEdit = !readOnly;
  const { fields, loading, error } = useObjectFields(
    objectName || undefined,
    objectFieldsOverride,
  );

  const fieldTypeByName = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const f of fields) m.set(f.name, f.type);
    return m;
  }, [fields]);

  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);

  const writeColumns = React.useCallback(
    (next: unknown[]) => {
      onPatch({ [variantKey]: { ...schema, columns: next } });
    },
    [onPatch, variantKey, schema],
  );

  const addField = React.useCallback(
    (field: ObjectFieldInfo) => {
      const col = makeColumn(allStrings, field.name, field.label);
      const next = appendArray(columns, col);
      writeColumns(next);
      onSelectionChange?.({
        kind: 'column',
        id: `${variantKey}.columns[${next.length - 1}]`,
        label: field.label,
      });
    },
    [allStrings, columns, writeColumns, variantKey, onSelectionChange],
  );

  const removeColumn = React.useCallback(
    (index: number) => {
      const next = spliceArray(columns, index, null);
      writeColumns(next);
      if (selectedIndex != null) {
        const remapped = remapIndexAfterRemove(selectedIndex, index);
        if (remapped == null) onSelectionChange?.(null);
        else
          onSelectionChange?.({
            kind: 'column',
            id: `${variantKey}.columns[${remapped}]`,
            label: colLabel(next[remapped], remapped),
          });
      }
    },
    [columns, writeColumns, selectedIndex, variantKey, onSelectionChange],
  );

  const moveColumn = React.useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      const next = moveArray(columns, from, to);
      writeColumns(next);
      if (selectedIndex != null) {
        const remapped = remapIndexAfterMove(selectedIndex, from, to);
        onSelectionChange?.({
          kind: 'column',
          id: `${variantKey}.columns[${remapped}]`,
          label: colLabel(next[remapped], remapped),
        });
      }
    },
    [columns, writeColumns, selectedIndex, variantKey, onSelectionChange],
  );

  const selectColumn = React.useCallback(
    (index: number) => {
      onSelectionChange?.({
        kind: 'column',
        id: `${variantKey}.columns[${index}]`,
        label: colLabel(columns[index], index),
      });
    },
    [columns, variantKey, onSelectionChange],
  );

  const usedNames = usedFieldNames(columns);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Columns</Label>
        <Badge variant="outline" className="text-[10px]">
          {columns.length}
        </Badge>
      </div>

      {columns.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-3 text-center text-[11px] text-muted-foreground">
          No columns yet. Add a field below.
        </p>
      ) : (
        <div className="space-y-1">
          {columns.map((c, i) => (
            <FieldListRow
              key={i}
              index={i}
              label={colLabel(c, i)}
              fieldName={colFieldName(c)}
              fieldType={fieldTypeByName.get(colFieldName(c) ?? '') ?? 'text'}
              selected={selectedIndex === i}
              canEdit={canEdit}
              dragging={dragIndex !== null}
              dropBefore={overIndex === i && dragIndex !== null && dragIndex !== i}
              onSelect={() => selectColumn(i)}
              onRemove={() => removeColumn(i)}
              onDragStart={() => setDragIndex(i)}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragOverRow={() => setOverIndex(i)}
              onDropRow={() => {
                if (dragIndex != null && dragIndex !== i) moveColumn(dragIndex, i);
                setDragIndex(null);
                setOverIndex(null);
              }}
            />
          ))}
        </div>
      )}

      {canEdit && (
        <AddFieldPopover
          fields={fields}
          usedNames={usedNames}
          loading={loading}
          error={error}
          onAdd={addField}
        />
      )}
    </div>
  );
}

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ReportDefaultInspector — the curated "home" panel for a Report.
 *
 * Shown as the DEFAULT right panel (no selection) for a report. Mirrors
 * {@link ViewVariantInspector} but for the flat Report document.
 *
 * SPEC-DRIVEN: the per-report-type config fields are NOT hardcoded. They are
 * rendered by feeding the spec's canonical authoring form (`reportForm`) and
 * the spec-derived Report JSONSchema into the generic {@link SchemaForm}. The
 * form's type-conditional `visibleOn` section (joined blocks) automatically
 * surfaces the right fields — adding a new report type or prop to
 * `@objectstack/spec` flows through with zero code changes here.
 *
 * The inspector keeps a thin curated layer for the cross-cutting concerns the
 * spec form can't express well on its own:
 *   1. the REPORT TYPE picker (options sourced from the spec `type` enum),
 *   2. the bound OBJECT (`objectName`, drives field loading), and
 *   3. the COLUMNS list — add / reorder / select drills into the scoped
 *      {@link ReportColumnInspector}. Those fields are therefore pruned from
 *      the spec form to avoid double-editing.
 *
 * Unlike a View (a nested document with a variant BODY), a Report is FLAT:
 * label / objectName / type / columns all live at the draft top level, so
 * every write is a plain shallow `onPatch`.
 */

import * as React from 'react';
import { Badge, Label } from '@object-ui/components';
import {
  InspectorShell,
  InspectorTextField,
  InspectorSelectField,
  appendArray,
  moveArray,
  spliceArray,
} from './_shared';
import { AddFieldPopover, FieldListRow } from '../previews/ViewColumnPanes';
import type { MetadataDefaultInspectorProps } from '../default-inspector-registry';
import { SchemaForm } from '../SchemaForm';
import { useObjectFields, type ObjectFieldInfo } from '../previews/useObjectFields';
import { getReportForm, getReportSchema } from '../report-schema';
import { t } from '../i18n';

export interface ReportDefaultInspectorProps extends MetadataDefaultInspectorProps {
  /**
   * Pre-resolved field catalog for the bound object. When supplied, both this
   * inspector and the columns list skip the network fetch (`useObjectFields`)
   * and use this list instead. Hosts that already hold the object definition
   * pass it to keep the inspector free of any network dependency.
   */
  objectFieldsOverride?: ObjectFieldInfo[];
}

interface ReportColumn {
  field?: string;
  label?: string;
  aggregate?: string;
  [k: string]: unknown;
}

/** i18n keys for the spec `type` enum (falls back to the raw value). */
const TYPE_LABEL_KEYS: Record<string, string> = {
  tabular: 'engine.inspector.report.type.tabular',
  summary: 'engine.inspector.report.type.summary',
  matrix: 'engine.inspector.report.type.matrix',
  joined: 'engine.inspector.report.type.joined',
};

/** Build the Report-type <select> options from the spec `type` enum. */
function useTypeOptions(currentType: string, locale: MetadataDefaultInspectorProps['locale']) {
  return React.useMemo(() => {
    const schema = getReportSchema();
    const rawEnum = schema?.properties?.type?.enum;
    const values: string[] =
      Array.isArray(rawEnum) && rawEnum.length
        ? rawEnum.filter((v: unknown): v is string => typeof v === 'string')
        : ['tabular', 'summary', 'matrix', 'joined'];
    const opts = values.map((v) => {
      const key = TYPE_LABEL_KEYS[v];
      // i18n with a raw-value fallback (`t` echoes unknown keys verbatim).
      const label = key ? t(key, locale) : v;
      return { value: v, label: label === key ? v : label };
    });
    if (!opts.some((o) => o.value === currentType) && currentType) {
      opts.push({ value: currentType, label: currentType });
    }
    return opts;
  }, [currentType, locale]);
}

export function ReportDefaultInspector({
  draft,
  onPatch,
  readOnly,
  locale,
  onSelectionChange,
  objectFieldsOverride,
}: ReportDefaultInspectorProps) {
  const tr = React.useCallback((key: string) => t(key, locale), [locale]);

  const reportType =
    typeof draft.type === 'string' ? (draft.type as string) : 'tabular';
  const typeOptions = useTypeOptions(reportType, locale);

  const labelValue = typeof draft.label === 'string' ? (draft.label as string) : '';
  const objectName =
    typeof draft.objectName === 'string' ? (draft.objectName as string) : '';

  const columns: ReportColumn[] = React.useMemo(
    () => (Array.isArray(draft.columns) ? (draft.columns as ReportColumn[]) : []),
    [draft.columns],
  );

  // Load the bound object's field catalog so the columns picker and the
  // spec form's field-reference props render as object-field pickers.
  const { fields: objectFields, loading, error } = useObjectFields(
    objectName || undefined,
    objectFieldsOverride,
  );
  const fieldTypeByName = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const f of objectFields) m.set(f.name, f.type);
    return m;
  }, [objectFields]);
  const widgetContext = React.useMemo(
    () => ({
      objectFields: objectFields.map((f) => ({
        name: f.name,
        label: f.label,
        type: f.type,
      })),
    }),
    [objectFields],
  );

  const usedNames = React.useMemo(() => {
    const out = new Set<string>();
    for (const c of columns) if (c?.field) out.add(c.field);
    return out;
  }, [columns]);

  /* ─────────────── Column read / write / reorder / select ─────────────── */

  const addColumn = (f: ObjectFieldInfo) => {
    const col: ReportColumn = { field: f.name };
    if (f.label && f.label !== f.name) col.label = f.label;
    const next = appendArray(columns, col);
    onPatch({ columns: next });
    onSelectionChange?.({
      kind: 'column',
      id: `columns[${next.length - 1}]`,
      label: f.label,
    });
  };

  const removeColumn = (index: number) => {
    onPatch({ columns: spliceArray(columns, index, null) });
  };

  const moveColumn = (from: number, to: number) => {
    if (from === to) return;
    onPatch({ columns: moveArray(columns, from, to) });
  };

  const selectColumn = (index: number) => {
    const c = columns[index];
    onSelectionChange?.({
      kind: 'column',
      id: `columns[${index}]`,
      label: c?.label || c?.field || `columns[${index}]`,
    });
  };

  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);

  const schema = getReportSchema();
  const form = getReportForm();

  return (
    <InspectorShell
      kindLabel={tr('engine.inspector.report.kind')}
      title={String(labelValue || draft.name || tr('engine.inspector.report.kind'))}
      onClose={() => {}}
      closeLabel={tr('engine.inspector.report.close')}
      hideClose
    >
      <InspectorTextField
        label={tr('engine.inspector.report.label')}
        value={labelValue}
        onCommit={(v) => onPatch({ label: v })}
        placeholder={tr('engine.inspector.report.labelPlaceholder')}
        disabled={readOnly}
      />
      <InspectorSelectField
        label={tr('engine.inspector.report.type')}
        value={reportType}
        options={typeOptions}
        onCommit={(v) => onPatch({ type: v })}
        disabled={readOnly}
      />
      <InspectorTextField
        label={tr('engine.inspector.report.object')}
        value={objectName}
        onCommit={(v) => onPatch({ objectName: v })}
        placeholder={tr('engine.inspector.report.objectPlaceholder')}
        disabled={readOnly}
        mono
      />

      <div className="border-t pt-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">
            {tr('engine.inspector.report.columns')}
          </Label>
          <Badge variant="outline" className="text-[10px]">
            {columns.length}
          </Badge>
        </div>

        {columns.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/30 px-3 py-3 text-center text-[11px] text-muted-foreground">
            {tr('engine.inspector.report.columnsEmpty')}
          </p>
        ) : (
          <div className="space-y-1">
            {columns.map((c, i) => (
              <FieldListRow
                key={i}
                index={i}
                label={c.label || c.field || `col ${i + 1}`}
                fieldName={c.field}
                fieldType={fieldTypeByName.get(c.field ?? '') ?? 'text'}
                selected={false}
                canEdit={!readOnly}
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

        {!readOnly && (
          <AddFieldPopover
            fields={objectFields}
            usedNames={usedNames}
            loading={loading}
            error={error}
            onAdd={addColumn}
          />
        )}
      </div>

      <div className="border-t pt-3">
        {schema ? (
          <SchemaForm
            schema={schema}
            form={form}
            value={draft}
            hiddenFields={['type', 'objectName', 'label', 'name', 'columns']}
            readOnly={readOnly}
            widgetContext={widgetContext}
            onChange={(next) => onPatch(next)}
          />
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {tr('engine.inspector.report.noSchema')}
          </p>
        )}
      </div>
    </InspectorShell>
  );
}

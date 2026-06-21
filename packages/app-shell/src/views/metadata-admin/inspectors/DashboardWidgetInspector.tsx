// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DashboardWidgetInspector — scoped property panel for the widget
 * selected inside <DashboardPreview>.
 *
 * Renders the per-widget form (title / type / data source / KPI value
 * / aggregate / color / layout size) for the widget identified by
 * `selection.id`. Patches are written back into `draft.widgets[i]`
 * (immutably) and emitted via `onPatch`, so live preview updates
 * instantly on the left side.
 *
 * The shape mirrors the WidgetPropertyPanel that ships in
 * @object-ui/plugin-designer's DashboardEditor — same fields, same
 * defaults, same enums — so users familiar with the standalone
 * designer feel at home here.
 */

import * as React from 'react';
import { ColorVariantPicker } from '../color-variant-field';
import { X } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@object-ui/components';
import type { DashboardWidgetSchema } from '@object-ui/types';
import type { MetadataInspectorProps } from '../inspector-registry';
import { t } from '../i18n';
import { InspectorReorderButtons, moveArray } from './_shared';
import { InspectorComboField, type InspectorComboOption } from './InspectorComboField';
import { DatasetNamesEditor } from './ReportDefaultInspector';
import { useDatasetCatalog, useDatasetSemantics } from '../previews/useDatasetCatalog';
import { useObjectFields, type ObjectFieldInfo } from '../previews/useObjectFields';
import { useObjectOptions } from './useDatasetFields';

const WIDGET_TYPES = [
  { value: 'metric', label: 'KPI Metric' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'table', label: 'Table' },
  { value: 'grid', label: 'Grid' },
];

const AGGREGATES = ['count', 'sum', 'avg', 'min', 'max'];

const COLORS = [
  'default',
  'blue',
  'teal',
  'orange',
  'purple',
  'success',
  'warning',
  'danger',
];

function findWidget(
  draft: Record<string, unknown>,
  id: string,
): { widget: DashboardWidgetSchema; index: number } | null {
  const widgets = Array.isArray((draft as any).widgets)
    ? ((draft as any).widgets as DashboardWidgetSchema[])
    : [];
  const index = widgets.findIndex((w) => w?.id === id);
  if (index < 0) return null;
  return { widget: widgets[index], index };
}

export function DashboardWidgetInspector({
  draft,
  selection,
  onPatch,
  onClearSelection,
  onSelectionChange,
  readOnly,
  locale,
}: MetadataInspectorProps) {
  const widgetsAll = Array.isArray((draft as any).widgets)
    ? ((draft as any).widgets as DashboardWidgetSchema[])
    : [];
  const selId = selection.kind === 'widget' ? selection.id : undefined;
  const hit = selId ? findWidget(draft, selId) : null;

  // ── Dataset binding (ADR-0021) ──────────────────────────────────────────
  // Field access goes through `as any`: the bundled `@object-ui/types`
  // `DashboardWidgetSchema` only gains `dataset`/`dimensions`/`values` once
  // objectui bumps `@objectstack/spec`. Same accessor pattern as DatasetWidget.
  const w = (hit?.widget ?? {}) as any;
  const datasetName = typeof w.dataset === 'string' ? (w.dataset as string) : '';
  const objectName = typeof w.object === 'string' ? (w.object as string) : '';
  const dimensions: string[] = Array.isArray(w.dimensions)
    ? (w.dimensions as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const values: string[] = Array.isArray(w.values)
    ? (w.values as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];

  // Catalogs — called unconditionally (stable hook order) BEFORE any early
  // return, so the dataset/object/field pickers below bind to the live schema
  // instead of free-text the author has to recall.
  const catalog = useDatasetCatalog();
  const semantics = useDatasetSemantics(datasetName || undefined, catalog);
  const { options: objectOptions, loading: objectsLoading } = useObjectOptions();
  const { fields: objectFields } = useObjectFields(objectName || undefined);

  const datasetComboOptions: InspectorComboOption[] = React.useMemo(() => {
    const opts = catalog.datasets.map((d) => ({
      value: d.name,
      label: d.label && d.label !== d.name ? `${d.label} (${d.name})` : d.name,
    }));
    if (datasetName && !opts.some((o) => o.value === datasetName)) {
      opts.push({ value: datasetName, label: datasetName });
    }
    return opts;
  }, [catalog.datasets, datasetName]);
  const objectComboOptions: InspectorComboOption[] = React.useMemo(
    () => objectOptions.map((o) => ({ value: o.name, label: o.label })),
    [objectOptions],
  );
  const fieldComboOptions: InspectorComboOption[] = React.useMemo(
    () => objectFields.map((f) => ({ value: f.name, label: f.label, hint: f.type })),
    [objectFields],
  );
  const measureOptions: ObjectFieldInfo[] = React.useMemo(
    () => semantics.measures.map((m) => ({ name: m.name, label: m.aggregate ? `${m.name} · ${m.aggregate}` : m.name, type: 'number', hidden: false })),
    [semantics.measures],
  );
  const dimensionOptions: ObjectFieldInfo[] = React.useMemo(
    () => semantics.dimensions.map((d) => ({ name: d.name, label: d.name, type: d.type ?? 'text', hidden: false })),
    [semantics.dimensions],
  );

  if (selection.kind !== 'widget') {
    return (
      <InspectorEmpty
        message={`Unsupported selection kind: ${selection.kind}`}
        onClose={onClearSelection}
        locale={locale}
      />
    );
  }
  if (!hit) {
    return (
      <InspectorEmpty
        message="The selected widget was removed from the draft."
        onClose={onClearSelection}
        locale={locale}
      />
    );
  }

  const { widget, index } = hit;

  function patchWidget(updates: Partial<DashboardWidgetSchema>) {
    const widgets = [...widgetsAll];
    widgets[index] = { ...widgets[index], ...updates };
    onPatch({ widgets });
  }

  function moveWidget(to: number) {
    onPatch({ widgets: moveArray(widgetsAll, index, to) });
    if (widget.id) {
      onSelectionChange?.({ kind: 'widget', id: widget.id, label: widget.title ?? undefined });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t('engine.inspector.widget.kind', locale)}
          </div>
          <div className="truncate text-sm font-semibold">
            {widget.title || selection.label || `Widget ${index + 1}`}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <InspectorReorderButtons
            index={index}
            total={widgetsAll.length}
            onMove={moveWidget}
            upLabel={t('engine.inspector.reorder.up', locale)}
            downLabel={t('engine.inspector.reorder.down', locale)}
            disabled={readOnly}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onClearSelection}
            title={t('engine.inspector.widget.close', locale)}
            aria-label={t('engine.inspector.widget.close', locale)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Field id="widget-title" label={t('engine.inspector.widget.title', locale)}>
        <Input
          id="widget-title"
          value={widget.title ?? ''}
          onChange={(e) => patchWidget({ title: e.target.value })}
          disabled={readOnly}
        />
      </Field>

      <Field id="widget-type" label={t('engine.inspector.widget.type', locale)}>
        <Select
          value={widget.type ?? 'metric'}
          onValueChange={(v) => patchWidget({ type: v })}
          disabled={readOnly}
        >
          <SelectTrigger id="widget-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WIDGET_TYPES.map((wt) => (
              <SelectItem key={wt.value} value={wt.value}>
                {wt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Dataset binding (ADR-0021) — governed cross-object semantic layer.
          When `dataset` is set, DashboardRenderer renders this widget via
          <DatasetWidget> (consistent numbers, cross-object, RLS-enforced),
          taking precedence over the inline single-object query below. The
          inline fields are kept visible so existing widgets stay editable
          (additive dual-form, mirroring report's dataset binding). */}
      <div className="space-y-3 rounded-md border border-dashed border-primary/40 bg-primary/5 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-primary/80">
          {t('engine.inspector.widget.datasetSection', locale)}
        </div>
        <Field id="widget-dataset" label={t('engine.inspector.widget.dataset', locale)}>
          <InspectorComboField
            value={datasetName}
            onCommit={(v) => patchWidget({ dataset: v || undefined } as Partial<DashboardWidgetSchema>)}
            options={datasetComboOptions}
            loading={catalog.loading}
            placeholder={t('engine.inspector.widget.datasetPlaceholder', locale)}
            searchPlaceholder={t('engine.inspector.widget.datasetPlaceholder', locale)}
            disabled={readOnly}
            mono
          />
          <p className="text-[10px] leading-snug text-muted-foreground">
            {t('engine.inspector.widget.datasetHint', locale)}
          </p>
        </Field>
        {datasetName && (
          <>
            {/* Dimensions / measures picked from the bound dataset's semantic
                layer (reorderable, add-from-catalog) — same control the Report
                inspector uses — instead of comma-separated free text. */}
            <DatasetNamesEditor
              label={t('engine.inspector.widget.dimensions', locale)}
              emptyText={t('engine.inspector.widget.dimensionsHint', locale)}
              names={dimensions}
              options={dimensionOptions}
              loading={semantics.loading}
              error={semantics.error}
              readOnly={readOnly}
              onCommit={(next) => patchWidget({ dimensions: next } as Partial<DashboardWidgetSchema>)}
            />
            <DatasetNamesEditor
              label={t('engine.inspector.widget.values', locale)}
              emptyText={t('engine.inspector.widget.valuesHint', locale)}
              names={values}
              options={measureOptions}
              loading={semantics.loading}
              error={semantics.error}
              readOnly={readOnly}
              onCommit={(next) => patchWidget({ values: next } as Partial<DashboardWidgetSchema>)}
            />
          </>
        )}
      </div>

      <Field id="widget-object" label={t('engine.inspector.widget.object', locale)}>
        <InspectorComboField
          value={widget.object ?? ''}
          onCommit={(v) => patchWidget({ object: v || undefined })}
          options={objectComboOptions}
          loading={objectsLoading}
          placeholder="Select an object…"
          searchPlaceholder="Search objects…"
          disabled={readOnly}
          mono
        />
      </Field>

      <Field id="widget-value-field" label={t('engine.inspector.widget.valueField', locale)}>
        <InspectorComboField
          value={widget.valueField ?? ''}
          onCommit={(v) => patchWidget({ valueField: v || undefined })}
          options={fieldComboOptions}
          placeholder={widget.object ? 'Select a field…' : 'e.g. amount'}
          searchPlaceholder="Search fields…"
          disabled={readOnly}
          mono
        />
      </Field>

      <Field id="widget-category-field" label={t('engine.inspector.widget.categoryField', locale)}>
        <InspectorComboField
          value={widget.categoryField ?? ''}
          onCommit={(v) => patchWidget({ categoryField: v || undefined })}
          options={fieldComboOptions}
          placeholder={widget.object ? 'Select a field…' : 'e.g. status'}
          searchPlaceholder="Search fields…"
          disabled={readOnly}
          mono
        />
      </Field>

      <Field id="widget-aggregate" label={t('engine.inspector.widget.aggregate', locale)}>
        <Select
          value={widget.aggregate ?? 'count'}
          onValueChange={(v) => patchWidget({ aggregate: v })}
          disabled={readOnly}
        >
          <SelectTrigger id="widget-aggregate">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGGREGATES.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field id="widget-color" label={t('engine.inspector.widget.color', locale)}>
        <ColorVariantPicker
          value={widget.colorVariant ?? 'default'}
          onChange={(v) => patchWidget({ colorVariant: v as DashboardWidgetSchema['colorVariant'] })}
          disabled={readOnly}
          options={COLORS.map((c) => ({ value: c }))}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id="widget-w" label={t('engine.inspector.widget.width', locale)}>
          <Input
            id="widget-w"
            type="number"
            min={1}
            value={widget.layout?.w ?? 1}
            onChange={(e) =>
              patchWidget({
                layout: {
                  ...(widget.layout ?? {}),
                  w: Number(e.target.value) || 1,
                } as DashboardWidgetSchema['layout'],
              })
            }
            disabled={readOnly}
          />
        </Field>
        <Field id="widget-h" label={t('engine.inspector.widget.height', locale)}>
          <Input
            id="widget-h"
            type="number"
            min={1}
            value={widget.layout?.h ?? 1}
            onChange={(e) =>
              patchWidget({
                layout: {
                  ...(widget.layout ?? {}),
                  h: Number(e.target.value) || 1,
                } as DashboardWidgetSchema['layout'],
              })
            }
            disabled={readOnly}
          />
        </Field>
      </div>

      {!readOnly && (
        <div className="pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => {
              const widgets = Array.isArray((draft as any).widgets)
                ? ([...(draft as any).widgets] as DashboardWidgetSchema[])
                : [];
              widgets.splice(index, 1);
              onPatch({ widgets });
              onClearSelection();
            }}
          >
            {t('engine.inspector.widget.remove', locale)}
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function InspectorEmpty({
  message,
  onClose,
  locale,
}: {
  message: string;
  onClose: () => void;
  locale: MetadataInspectorProps['locale'];
}) {
  return (
    <div className="space-y-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      <p>{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onClose}>
        {t('engine.inspector.widget.close', locale)}
      </Button>
    </div>
  );
}

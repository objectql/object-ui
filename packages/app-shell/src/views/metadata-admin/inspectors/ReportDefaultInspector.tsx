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
 * ADR-0021 single-form: a 9.0 report is dataset-bound — it binds a
 * semantic-layer `dataset` and selects its `values` (measure names) grouped
 * by `rows` (dimension names). The inspector keeps a thin curated layer for
 * the concerns the spec form can't express well on its own:
 *   1. the REPORT TYPE picker (options sourced from the spec `type` enum),
 *   2. the DATASET binding (drives the measure/dimension catalogs), and
 *   3. the VALUES / ROWS lists — add / remove / reorder from the bound
 *      dataset's measures and dimensions.
 * Those fields are pruned from the spec form to avoid double-editing.
 *
 * Unlike a View (a nested document with a variant BODY), a Report is FLAT:
 * label / dataset / type / values / rows all live at the draft top level, so
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
import { toFieldName } from '../previews/object-fields-io';
import type { MetadataDefaultInspectorProps } from '../default-inspector-registry';
import { SchemaForm } from '../SchemaForm';
import type { ObjectFieldInfo } from '../previews/useObjectFields';
import {
  useDatasetCatalog,
  useDatasetSemantics,
  type DatasetCatalogEntry,
} from '../previews/useDatasetCatalog';
import { getReportForm, getReportSchema } from '../report-schema';
import { mergeServerFields } from '../mergeServerFields';
import { t } from '../i18n';

/**
 * Top-level report fields this inspector renders with its own dedicated
 * controls (type / dataset / values / rows + identity), so the spec-form
 * graft never double-renders them. Mirrors the `hiddenFields` passed to
 * SchemaForm.
 */
const REPORT_CURATED_FIELDS = new Set([
  'type',
  'label',
  'name',
  'dataset',
  'values',
  'rows',
  'columns', // matrix across-dimensions — dedicated list below
  'chart', // dedicated Chart panel below (type + dataset-aware X/Y pickers)
]);

/**
 * Chart types offered in the curated Chart panel. A dataset-bound report plots
 * one measure (yAxis) across one dimension (xAxis), so we surface the families
 * that fit that shape; the renderer maps the rest. (`''` = no chart / table-only.)
 */
const REPORT_CHART_TYPES = ['bar', 'column', 'line', 'area', 'pie', 'donut'] as const;

export interface ReportDefaultInspectorProps extends MetadataDefaultInspectorProps {
  /**
   * Pre-resolved dataset catalog. When supplied, the inspector skips the
   * network fetches (`useDatasetCatalog`) and uses this list instead. Hosts
   * that already hold the catalog pass it to keep the inspector free of any
   * network dependency.
   */
  datasetCatalogOverride?: DatasetCatalogEntry[];
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

/** Read a `string[]` draft field defensively. */
function readNames(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * A reorderable list of dataset member names (the report's `values` or
 * `rows`) with an add-popover fed by the bound dataset's catalog. Exported so
 * the Dashboard widget inspector can bind the same governed dimensions/measures
 * the same way (single source of truth for dataset-member editing).
 */
export function DatasetNamesEditor({
  label,
  emptyText,
  names,
  options,
  loading,
  error,
  readOnly,
  onCommit,
}: {
  label: string;
  emptyText: string;
  names: string[];
  /** Picker options from the dataset's semantic layer. */
  options: ObjectFieldInfo[];
  loading: boolean;
  error: string | null;
  readOnly?: boolean;
  onCommit: (next: string[]) => void;
}) {
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);
  const used = React.useMemo(() => new Set(names), [names]);
  const typeByName = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(o.name, o.type);
    return m;
  }, [options]);

  return (
    <div className="border-t pt-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <Badge variant="outline" className="text-[10px]">
          {names.length}
        </Badge>
      </div>

      {names.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-3 text-center text-[11px] text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-1">
          {names.map((name, i) => (
            <FieldListRow
              key={`${name}-${i}`}
              index={i}
              label={name}
              fieldName={name}
              fieldType={typeByName.get(name) ?? 'number'}
              selected={false}
              canEdit={!readOnly}
              dragging={dragIndex !== null}
              dropBefore={overIndex === i && dragIndex !== null && dragIndex !== i}
              onSelect={() => {}}
              onRemove={() => onCommit(spliceArray(names, i, null))}
              onDragStart={() => setDragIndex(i)}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragOverRow={() => setOverIndex(i)}
              onDropRow={() => {
                if (dragIndex != null && dragIndex !== i) onCommit(moveArray(names, dragIndex, i));
                setDragIndex(null);
                setOverIndex(null);
              }}
            />
          ))}
        </div>
      )}

      {!readOnly && (
        <AddFieldPopover
          fields={options}
          usedNames={used}
          loading={loading}
          error={error}
          onAdd={(f) => onCommit(appendArray(names, f.name))}
        />
      )}
    </div>
  );
}

export function ReportDefaultInspector({
  name,
  draft,
  onPatch,
  readOnly,
  locale,
  datasetCatalogOverride,
  serverSchema,
}: ReportDefaultInspectorProps) {
  const tr = React.useCallback((key: string) => t(key, locale), [locale]);

  // In create mode the host passes an empty `name` (the PK is assigned on
  // first save). Mirror ObjectDefaultInspector: expose an editable Name that
  // auto-derives a snake_case slug from the label until the author edits it
  // directly. Without this, a report created through the canvas would save
  // with an empty name and fail the snake_case identity rule (the create flow
  // would dead-end exactly the way it did before report-create used the canvas).
  const createMode = !name;
  const nameTouched = React.useRef(false);
  const nameValue = typeof draft.name === 'string' ? (draft.name as string) : '';

  const reportType =
    typeof draft.type === 'string' ? (draft.type as string) : 'tabular';
  const typeOptions = useTypeOptions(reportType, locale);

  const labelValue = typeof draft.label === 'string' ? (draft.label as string) : '';
  const datasetName =
    typeof draft.dataset === 'string' ? (draft.dataset as string) : '';
  const values = React.useMemo(() => readNames(draft.values), [draft.values]);
  const rows = React.useMemo(() => readNames(draft.rows), [draft.rows]);
  const columnsAcross = React.useMemo(() => readNames(draft.columns), [draft.columns]);

  // Dataset catalog (binding options) + the bound dataset's semantic layer
  // (measure/dimension picker options).
  const catalog = useDatasetCatalog(datasetCatalogOverride);
  const semantics = useDatasetSemantics(datasetName || undefined, catalog);

  const datasetOptions = React.useMemo(() => {
    const opts = catalog.datasets.map((d) => ({
      value: d.name,
      label: d.label && d.label !== d.name ? `${d.label} (${d.name})` : d.name,
    }));
    if (datasetName && !opts.some((o) => o.value === datasetName)) {
      opts.push({ value: datasetName, label: datasetName });
    }
    return opts;
  }, [catalog.datasets, datasetName]);

  const measureOptions: ObjectFieldInfo[] = React.useMemo(
    () =>
      semantics.measures.map((m) => ({
        name: m.name,
        label: m.aggregate ? `${m.name} · ${m.aggregate}` : m.name,
        type: 'number',
        hidden: false,
      })),
    [semantics.measures],
  );
  const dimensionOptions: ObjectFieldInfo[] = React.useMemo(
    () =>
      semantics.dimensions.map((d) => ({
        name: d.name,
        label: d.name,
        type: d.type ?? 'text',
        hidden: false,
      })),
    [semantics.dimensions],
  );

  // Embedded chart (ADR-0021) — edited via the dedicated panel below so authors
  // pick the X dimension / Y measure from dropdowns sourced from the bound
  // dataset (instead of free-typing field names), and the generic spec-form
  // graft excludes `chart`. Patching merges into the chart object; clearing the
  // type drops the chart entirely.
  const chart =
    draft.chart && typeof draft.chart === 'object'
      ? (draft.chart as Record<string, unknown>)
      : {};
  const chartType = typeof chart.type === 'string' ? (chart.type as string) : '';
  const chartX = typeof chart.xAxis === 'string' ? (chart.xAxis as string) : '';
  const chartY = typeof chart.yAxis === 'string' ? (chart.yAxis as string) : '';
  const chartTitle = typeof chart.title === 'string' ? (chart.title as string) : '';
  const commitChart = (patch: Record<string, unknown>) => {
    const next = { ...chart, ...patch };
    onPatch({ chart: next.type ? next : undefined });
  };
  const chartXOptions = React.useMemo(() => {
    const opts = dimensionOptions.map((d) => ({ value: d.name, label: d.label || d.name }));
    if (chartX && !opts.some((o) => o.value === chartX)) opts.push({ value: chartX, label: chartX });
    return opts;
  }, [dimensionOptions, chartX]);
  const chartYOptions = React.useMemo(() => {
    const opts = measureOptions.map((m) => ({ value: m.name, label: m.label || m.name }));
    if (chartY && !opts.some((o) => o.value === chartY)) opts.push({ value: chartY, label: chartY });
    return opts;
  }, [measureOptions, chartY]);

  // A `joined` report carries its data on dataset-bound `blocks` (edited via
  // the spec form's repeater) — the top-level binding only applies otherwise.
  const datasetBound = reportType !== 'joined';

  // Graft any server-only top-level fields onto the bundled-spec form so they
  // are directly editable here even when the bundled `@objectstack/spec` lags
  // the running server (skew root-cure).
  const { schema, form } = React.useMemo(
    () =>
      mergeServerFields({
        bundledSchema: getReportSchema(),
        bundledForm: getReportForm(),
        serverSchema,
        excludeFields: REPORT_CURATED_FIELDS,
        sectionTitle: t('engine.inspector.moreFields', locale),
      }),
    [serverSchema, locale],
  );

  return (
    <InspectorShell
      kindLabel={tr('engine.inspector.report.kind')}
      title={String(labelValue || draft.name || tr('engine.inspector.report.kind'))}
      onClose={() => {}}
      closeLabel={tr('engine.inspector.report.close')}
      hideClose
    >
      {createMode && (
        <InspectorTextField
          label={tr('engine.inspector.report.name')}
          value={nameValue}
          onCommit={(v) => {
            nameTouched.current = true;
            onPatch({ name: toFieldName(v) });
          }}
          placeholder={tr('engine.inspector.report.namePlaceholder')}
          disabled={readOnly}
          mono
        />
      )}
      <InspectorTextField
        label={tr('engine.inspector.report.label')}
        value={labelValue}
        onCommit={(v) => {
          // Live-derive the snake_case name from the label until the author
          // edits the Name field directly (create mode only).
          const patch: Record<string, unknown> = { label: v };
          if (createMode && !nameTouched.current) patch.name = toFieldName(v);
          onPatch(patch);
        }}
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

      {datasetBound && (
        <>
          {catalog.datasets.length > 0 || datasetName ? (
            <InspectorSelectField
              label={tr('engine.inspector.report.dataset')}
              value={datasetName}
              options={datasetOptions}
              onCommit={(v) => onPatch({ dataset: v })}
              disabled={readOnly}
            />
          ) : (
            // No catalog (offline / older server) — fall back to manual entry.
            <InspectorTextField
              label={tr('engine.inspector.report.dataset')}
              value={datasetName}
              onCommit={(v) => onPatch({ dataset: v })}
              placeholder={tr('engine.inspector.report.datasetPlaceholder')}
              disabled={readOnly}
              mono
            />
          )}

          <DatasetNamesEditor
            label={tr('engine.inspector.report.values')}
            emptyText={tr('engine.inspector.report.valuesEmpty')}
            names={values}
            options={measureOptions}
            loading={semantics.loading}
            error={semantics.error}
            readOnly={readOnly}
            onCommit={(next) => onPatch({ values: next })}
          />
          <DatasetNamesEditor
            label={tr('engine.inspector.report.rows')}
            emptyText={tr('engine.inspector.report.rowsEmpty')}
            names={rows}
            options={dimensionOptions}
            loading={semantics.loading}
            error={semantics.error}
            readOnly={readOnly}
            onCommit={(next) => onPatch({ rows: next })}
          />
          {reportType === 'matrix' && (
            // ADR-0021 D2 — a matrix pivots rows × columns (across dimensions).
            <DatasetNamesEditor
              label={tr('engine.inspector.report.columnsAcross')}
              emptyText={tr('engine.inspector.report.columnsAcrossEmpty')}
              names={columnsAcross}
              options={dimensionOptions}
              loading={semantics.loading}
              error={semantics.error}
              readOnly={readOnly}
              onCommit={(next) => onPatch({ columns: next })}
            />
          )}

          <div className="border-t pt-3 space-y-2">
            <Label className="text-xs text-muted-foreground">
              {tr('engine.inspector.report.chart')}
            </Label>
            <InspectorSelectField
              label={tr('engine.inspector.report.chartType')}
              value={chartType}
              options={[
                { value: '', label: tr('engine.inspector.report.chartNone') },
                ...REPORT_CHART_TYPES.map((tp) => ({ value: tp, label: tp })),
              ]}
              onCommit={(v) => commitChart({ type: v || undefined })}
              disabled={readOnly}
            />
            {chartType ? (
              <>
                <InspectorTextField
                  label={tr('engine.inspector.report.chartTitle')}
                  value={chartTitle}
                  onCommit={(v) => commitChart({ title: v || undefined })}
                  disabled={readOnly}
                />
                <InspectorSelectField
                  label={tr('engine.inspector.report.chartX')}
                  value={chartX}
                  options={chartXOptions}
                  onCommit={(v) => commitChart({ xAxis: v })}
                  disabled={readOnly}
                />
                <InspectorSelectField
                  label={tr('engine.inspector.report.chartY')}
                  value={chartY}
                  options={chartYOptions}
                  onCommit={(v) => commitChart({ yAxis: v })}
                  disabled={readOnly}
                />
              </>
            ) : null}
          </div>
        </>
      )}

      <div className="border-t pt-3">
        {schema ? (
          <SchemaForm
            schema={schema}
            form={form}
            value={draft}
            hiddenFields={['type', 'label', 'name', 'dataset', 'values', 'rows', 'columns', 'chart']}
            readOnly={readOnly}
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

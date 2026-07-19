/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {
  ConfigPanelRenderer,
  useConfigDraft,
  Combobox,
  Button,
  Input,
  cn,
} from '@object-ui/components';
import { ConfigRow } from '@object-ui/components';
import { X } from 'lucide-react';
import type { ConfigPanelSchema, ConfigField } from '@object-ui/components';
import type { WidgetDatasetCatalogEntry } from './dataset-catalog';

// ---------------------------------------------------------------------------
// Widget type options derived from @object-ui/types DASHBOARD_WIDGET_TYPES
// ---------------------------------------------------------------------------

const WIDGET_TYPE_OPTIONS = [
  { value: 'metric', label: 'Metric' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'horizontal-bar', label: 'Horizontal Bar' },
  { value: 'line', label: 'Line Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'donut', label: 'Donut Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'scatter', label: 'Scatter Plot' },
  { value: 'funnel', label: 'Funnel' },
  { value: 'table', label: 'Table' },
  { value: 'pivot', label: 'Pivot Table' },
];

const COLOR_VARIANT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'blue', label: 'Blue' },
  { value: 'teal', label: 'Teal' },
  { value: 'orange', label: 'Orange' },
  { value: 'purple', label: 'Purple' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'danger', label: 'Danger' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHART_TYPES = ['bar', 'horizontal-bar', 'line', 'area', 'pie', 'donut', 'scatter', 'funnel'];
// Single-value widgets — a metric shows ONE aggregated value, so it selects
// `values` but never `dimensions` (adding a dimension would fan it out into a
// series, which the metric renderer can't display).
const METRIC_LIKE_TYPES = ['metric', 'gauge', 'solid-gauge', 'kpi', 'bullet'];

// Widget types that support drill-down. Aggregating widgets (chart / pivot /
// metric) drill *through* — clicking a cell/segment opens a filtered list of
// underlying records. Record widgets (table / list) drill *to record* —
// clicking a row opens that record's detail. Pairs with the @object-ui/core
// `drill-down` helpers and the `DrillDownConfig.mode` discriminator.
const DRILL_DOWN_TYPES = [
  'pivot', 'metric', 'bar', 'horizontal-bar', 'line', 'area', 'pie', 'donut', 'funnel',
  'scatter', 'treemap', 'sankey', 'table', 'list',
];

function isChartType(t: string | undefined): boolean {
  return !!t && CHART_TYPES.includes(t);
}

/** Whether a widget of this type selects dataset `dimensions` (group/split). */
function usesDimensions(t: string | undefined): boolean {
  return !!t && !METRIC_LIKE_TYPES.includes(t);
}

export function supportsDrillDown(t: string | undefined): boolean {
  return !!t && DRILL_DOWN_TYPES.includes(t);
}

// ---------------------------------------------------------------------------
// Dataset member (dimensions / values) multi-picker
//
// A self-contained control: removable chips for the current selection plus an
// "add" control. When the bound dataset's members are known (catalog present)
// the add control is a Combobox of the unused members; otherwise it falls back
// to a free-text input (Enter to add) so authoring still works without a
// catalog. Mirrors app-shell's DatasetNamesEditor, which plugin-dashboard
// cannot import (layering).
// ---------------------------------------------------------------------------

function DatasetNamesField({
  names,
  options,
  placeholder,
  emptyText,
  onChange,
}: {
  names: string[];
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  emptyText: string;
  onChange: (next: string[]) => void;
}) {
  const [draftName, setDraftName] = React.useState('');
  const used = React.useMemo(() => new Set(names), [names]);
  const addable = React.useMemo(
    () => options.filter((o) => !used.has(o.value)),
    [options, used],
  );

  const add = (name: string) => {
    const v = name.trim();
    if (!v || used.has(v)) return;
    onChange([...names, v]);
    setDraftName('');
  };
  const remove = (name: string) => onChange(names.filter((n) => n !== name));

  return (
    <div className="space-y-1.5">
      {names.length === 0 ? (
        <p className="rounded border border-dashed px-2 py-1.5 text-center text-[11px] text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {names.map((name) => (
            <span
              key={name}
              data-testid={`dataset-name-chip-${name}`}
              className={cn(
                'inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5',
                'font-mono text-[11px] text-foreground',
              )}
            >
              {name}
              <button
                type="button"
                aria-label={`Remove ${name}`}
                className="text-muted-foreground hover:text-foreground"
                onClick={() => remove(name)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {addable.length > 0 ? (
        <Combobox
          options={addable}
          value=""
          onValueChange={add}
          placeholder={placeholder}
          searchPlaceholder="Search…"
          emptyText="Nothing left to add."
          className="h-7 w-full text-xs"
        />
      ) : (
        <div className="flex items-center gap-1">
          <Input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add(draftName);
              }
            }}
            placeholder={placeholder}
            className="h-7 flex-1 text-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => add(draftName)}
            disabled={!draftName.trim()}
          >
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schema builder — creates a ConfigPanelSchema for the dataset (ADR-0021)
// authoring shape. `dataset` picks a named semantic-layer dataset; `dimensions`
// and `values` select that dataset's members by name.
// ---------------------------------------------------------------------------

function buildWidgetSchema(
  datasets: WidgetDatasetCatalogEntry[] | undefined,
  widgetType?: string,
): ConfigPanelSchema {
  const catalog = datasets ?? [];
  const hasCatalog = catalog.length > 0;

  const datasetOptions = catalog.map((d) => ({
    value: d.name,
    label: d.label && d.label !== d.name ? `${d.label} (${d.name})` : d.name,
  }));

  const entryFor = (name: unknown): WidgetDatasetCatalogEntry | undefined =>
    typeof name === 'string' ? catalog.find((d) => d.name === name) : undefined;

  // ---- Dataset selector (Combobox over the catalog, free-text fallback) ----
  const datasetField: ConfigField = hasCatalog
    ? {
        key: 'dataset',
        label: 'Dataset',
        type: 'custom',
        helpText: 'The semantic-layer dataset this widget binds to (ADR-0021).',
        render: (value: any, onChange: (v: any) => void) => (
          <ConfigRow label="Dataset">
            <div data-testid="config-field-dataset">
              <Combobox
                options={datasetOptions}
                value={value ?? ''}
                onValueChange={onChange}
                placeholder="Select dataset…"
                searchPlaceholder="Search datasets…"
                emptyText="No datasets found."
                className="h-7 w-40 text-xs"
              />
            </div>
          </ConfigRow>
        ),
      }
    : {
        key: 'dataset',
        label: 'Dataset',
        type: 'input',
        placeholder: 'Dataset name',
        helpText: 'The semantic-layer dataset this widget binds to (ADR-0021).',
      };

  const dimensionsField: ConfigField = {
    key: 'dimensions',
    label: 'Dimensions',
    type: 'custom',
    visibleWhen: (d: Record<string, any>) => usesDimensions(d.type),
    helpText:
      widgetType === 'pivot'
        ? 'Group/split fields. The last dimension spreads across as columns.'
        : 'Group/split the values by these dataset dimensions.',
    render: (value: any, onChange: (v: any) => void, draft: Record<string, any>) => {
      const entry = entryFor(draft.dataset);
      const options = (entry?.dimensions ?? []).map((dim) => ({
        value: dim.name,
        label: dim.label && dim.label !== dim.name ? `${dim.label} (${dim.name})` : dim.name,
      }));
      return (
        <ConfigRow label="Dimensions">
          <div data-testid="config-field-dimensions" className="w-40">
            <DatasetNamesField
              names={Array.isArray(value) ? value : []}
              options={options}
              placeholder="Add dimension…"
              emptyText="No dimensions selected."
              onChange={onChange}
            />
          </div>
        </ConfigRow>
      );
    },
  };

  const valuesField: ConfigField = {
    key: 'values',
    label: 'Values',
    type: 'custom',
    helpText: 'Measure(s) from the dataset to display (at least one).',
    render: (value: any, onChange: (v: any) => void, draft: Record<string, any>) => {
      const entry = entryFor(draft.dataset);
      const options = (entry?.measures ?? []).map((m) => ({
        value: m.name,
        label: m.aggregate ? `${m.label ?? m.name} · ${m.aggregate}` : (m.label ?? m.name),
      }));
      return (
        <ConfigRow label="Values">
          <div data-testid="config-field-values" className="w-40">
            <DatasetNamesField
              names={Array.isArray(value) ? value : []}
              options={options}
              placeholder="Add measure…"
              emptyText="No measures selected."
              onChange={onChange}
            />
          </div>
        </ConfigRow>
      );
    },
  };

  // ---- Breadcrumb varies by widget type ------------------------------------

  const BREADCRUMB_LABELS: Record<string, string> = {
    pivot: 'Pivot table',
    table: 'Table',
  };
  const typeName = BREADCRUMB_LABELS[widgetType ?? '']
    ?? (isChartType(widgetType) ? 'Chart' : 'Widget');

  return {
    breadcrumb: ['Dashboard', typeName],
    sections: [
      // ----- General (always visible) -------------------------------------
      {
        key: 'general',
        title: 'General',
        fields: [
          {
            key: 'title',
            label: 'Title',
            type: 'input',
            placeholder: 'Widget title',
          },
          {
            key: 'description',
            label: 'Description',
            type: 'input',
            placeholder: 'Widget description',
          },
          {
            key: 'type',
            label: 'Widget type',
            type: 'select',
            options: WIDGET_TYPE_OPTIONS,
            defaultValue: 'metric',
          },
        ],
      },

      // ----- Data binding (ADR-0021 dataset shape) ------------------------
      {
        key: 'data',
        title: 'Data Binding',
        collapsible: true,
        fields: [
          datasetField,
          dimensionsField,
          valuesField,
        ],
      },

      // ----- Layout (always visible) --------------------------------------
      {
        key: 'layout',
        title: 'Layout',
        collapsible: true,
        fields: [
          {
            key: 'layoutW',
            label: 'Width (columns)',
            type: 'slider',
            min: 1,
            max: 12,
            step: 1,
            defaultValue: 1,
          },
          {
            key: 'layoutH',
            label: 'Height (rows)',
            type: 'slider',
            min: 1,
            max: 6,
            step: 1,
            defaultValue: 1,
          },
        ],
      },

      // ----- Behavior (always visible, collapsed by default) -------------
      {
        key: 'behavior',
        title: 'Behavior',
        collapsible: true,
        defaultCollapsed: true,
        fields: [
          {
            key: 'actionUrl',
            label: 'Click-through URL',
            type: 'input',
            placeholder: 'https://...',
          },
        ],
      },

      // ----- Appearance (always visible, collapsed by default) ------------
      {
        key: 'appearance',
        title: 'Appearance',
        collapsible: true,
        defaultCollapsed: true,
        fields: [
          {
            key: 'colorVariant',
            label: 'Color variant',
            type: 'select',
            options: COLOR_VARIANT_OPTIONS,
            defaultValue: 'default',
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WidgetConfigPanelProps {
  /** Whether the panel is open */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** Widget configuration (flattened: layout.w → layoutW, layout.h → layoutH) */
  config: Record<string, any>;
  /** Persist the updated widget config */
  onSave: (config: Record<string, any>) => void;
  /** Optional live-update callback */
  onFieldChange?: (field: string, value: any) => void;
  /** Extra content rendered in the header row (e.g. delete button) */
  headerExtra?: React.ReactNode;
  /**
   * Analytics dataset catalog (ADR-0021). When supplied, the dataset selector
   * and the dimensions/values pickers bind to the live schema instead of
   * free-text. Hosts resolve it (e.g. via the metadata client) and inject it;
   * absent → free-text authoring still works.
   */
  datasets?: WidgetDatasetCatalogEntry[];
  /** Whether the dataset catalog is still loading (reserved for future UX). */
  datasetsLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Resolve an I18nLabel (string or {key, defaultValue}) to a plain string. */
function resolveLabel(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const obj = v as Record<string, any>;
    return obj.defaultValue || obj.key || '';
  }
  return String(v);
}

/**
 * Strip keys that are not relevant to the current widget type, and scrub the
 * removed pre-ADR-0021 inline analytics keys so switching type (or saving a
 * legacy widget) never re-emits the dead shape. Metric-like widgets show a
 * single value, so their `dimensions` are dropped.
 */
const LEGACY_ANALYTICS_KEYS = [
  'object', 'categoryField', 'categoryGranularity', 'valueField', 'aggregate',
  'aggregation', 'rowField', 'columnField', 'xAxisField', 'yAxisFields',
  'xAxisLabel', 'yAxisLabel', 'measures',
  'rowSortBy', 'rowSortOrder', 'columnSortBy', 'columnSortOrder',
  'showRowLabels', 'showRowTotals', 'showColumnLabels', 'showColumnTotals',
  'format', 'showLegend', 'searchable', 'pagination',
];

export function sanitizeDraftForType(draft: Record<string, any>): Record<string, any> {
  const t = draft.type as string | undefined;
  const out = { ...draft };
  for (const key of LEGACY_ANALYTICS_KEYS) delete out[key];
  if (!usesDimensions(t)) delete out.dimensions;
  return out;
}

export function WidgetConfigPanel({
  open,
  onClose,
  config,
  onSave,
  onFieldChange,
  headerExtra,
  datasets,
  datasetsLoading: _datasetsLoading,
}: WidgetConfigPanelProps) {
  // Pre-process config to resolve any I18nLabel values for title/description
  const normalizedConfig: Record<string, any> = React.useMemo(() => ({
    ...config,
    title: typeof config.title === 'object' ? resolveLabel(config.title) : config.title,
    description: typeof config.description === 'object' ? resolveLabel(config.description) : config.description,
  }), [config]);

  const { draft, isDirty, updateField, discard } = useConfigDraft(normalizedConfig, {
    onUpdate: onFieldChange,
  });

  const schema = React.useMemo(
    () => buildWidgetSchema(datasets, draft.type),
    [datasets, draft.type],
  );

  return (
    <ConfigPanelRenderer
      open={open}
      onClose={onClose}
      schema={schema}
      draft={draft}
      isDirty={isDirty}
      onFieldChange={updateField}
      onSave={() => onSave(sanitizeDraftForType(draft))}
      onDiscard={discard}
      headerExtra={headerExtra}
    />
  );
}

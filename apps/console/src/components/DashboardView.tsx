/**
 * Dashboard View Component
 * Renders a dashboard based on the dashboardName parameter.
 * Edit mode shows an inline config panel (DashboardConfigPanel / WidgetConfigPanel)
 * on the right side, following the same pattern as ListView.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  DashboardRenderer,
  DashboardConfigPanel,
  WidgetConfigPanel,
} from '@object-ui/plugin-dashboard';
import { Empty, EmptyTitle, EmptyDescription, Button } from '@object-ui/components';
import {
  LayoutDashboard,
  Pencil,
  TrendingUp,
  BarChart3,
  LineChart,
  PieChart,
  Table2,
  LayoutGrid,
  Plus,
  Trash2,
} from 'lucide-react';
import { MetadataToggle, MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { SkeletonDashboard } from './skeletons';
import { useMetadata } from '../context/MetadataProvider';
import { resolveI18nLabel } from '../utils';
import { useAdapter } from '../context/AdapterProvider';
import type { DashboardSchema, DashboardWidgetSchema } from '@object-ui/types';

// ---------------------------------------------------------------------------
// Widget type palette for the add-widget toolbar
// ---------------------------------------------------------------------------

const WIDGET_TYPES = [
  { type: 'metric', label: 'KPI Metric', Icon: TrendingUp },
  { type: 'bar', label: 'Bar Chart', Icon: BarChart3 },
  { type: 'line', label: 'Line Chart', Icon: LineChart },
  { type: 'pie', label: 'Pie Chart', Icon: PieChart },
  { type: 'table', label: 'Table', Icon: Table2 },
  { type: 'grid', label: 'Grid', Icon: LayoutGrid },
];

let widgetCounter = 0;
function createWidgetId(): string {
  widgetCounter += 1;
  return `widget_${Date.now()}_${widgetCounter}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ensure every widget in the schema has a unique id. */
function ensureWidgetIds(schema: DashboardSchema): DashboardSchema {
  if (!schema.widgets?.length) return schema;
  const needsFix = schema.widgets.some((w) => !w.id);
  if (!needsFix) return schema;
  return {
    ...schema,
    widgets: schema.widgets.map((w) => (w.id ? w : { ...w, id: createWidgetId() })),
  };
}

/** Resolve a human-friendly default title for a new widget type. */
function defaultWidgetTitle(type: string): string {
  const entry = WIDGET_TYPES.find((t) => t.type === type);
  return entry ? `New ${entry.label}` : 'New Widget';
}

// ---------------------------------------------------------------------------
// Helpers: flatten / unflatten widget config for WidgetConfigPanel
// ---------------------------------------------------------------------------

function flattenWidgetConfig(widget: DashboardWidgetSchema): Record<string, any> {
  return {
    title: widget.title ?? '',
    description: widget.description ?? '',
    type: widget.type ?? 'metric',
    object: widget.object ?? '',
    categoryField: widget.categoryField ?? '',
    valueField: widget.valueField ?? '',
    aggregate: widget.aggregate ?? 'count',
    layoutW: widget.layout?.w ?? 1,
    layoutH: widget.layout?.h ?? 1,
    colorVariant: widget.colorVariant ?? 'default',
    actionUrl: widget.actionUrl ?? '',
  };
}

function unflattenWidgetConfig(
  config: Record<string, any>,
  base: DashboardWidgetSchema,
): Partial<DashboardWidgetSchema> {
  return {
    title: config.title,
    description: config.description,
    type: config.type,
    object: config.object,
    categoryField: config.categoryField,
    valueField: config.valueField,
    aggregate: config.aggregate,
    layout: { ...(base.layout || {}), w: config.layoutW, h: config.layoutH } as DashboardWidgetSchema['layout'],
    colorVariant: config.colorVariant,
    actionUrl: config.actionUrl,
  };
}

function extractDashboardConfig(schema: DashboardSchema): Record<string, any> {
  return {
    columns: schema.columns ?? 3,
    gap: schema.gap ?? 4,
    rowHeight: String((schema as any).rowHeight ?? '120'),
    refreshInterval: String(schema.refreshInterval ?? '0'),
    title: schema.title ?? '',
    showDescription: (schema as any).showDescription ?? true,
    theme: (schema as any).theme ?? 'auto',
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardView({ dataSource }: { dataSource?: any }) {
  const { dashboardName } = useParams<{ dashboardName: string }>();
  const { showDebug, toggleDebug } = useMetadataInspector();
  const adapter = useAdapter();
  const [isLoading, setIsLoading] = useState(true);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  // Version counter — incremented on save to refresh the stable config reference
  const [configVersion, setConfigVersion] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    queueMicrotask(() => setIsLoading(false));
  }, [dashboardName]);

  const { dashboards, objects: metadataObjects } = useMetadata();
  const dashboard = dashboards?.find((d: any) => d.name === dashboardName);

  // Local schema state for live preview — initialized from metadata
  const [editSchema, setEditSchema] = useState<DashboardSchema | null>(null);

  // ---- Save helper --------------------------------------------------------
  const saveSchema = useCallback(
    async (schema: DashboardSchema) => {
      try {
        if (adapter) {
          await adapter.update('sys_dashboard', dashboardName!, schema);
        }
      } catch (err) {
        console.warn('[DashboardView] Auto-save failed:', err);
      }
    },
    [adapter, dashboardName],
  );

  // ---- Open / close config panel ------------------------------------------
  const handleOpenConfigPanel = useCallback(() => {
    setEditSchema(ensureWidgetIds(dashboard as DashboardSchema));
    setConfigPanelOpen(true);
    setConfigVersion((v) => v + 1);
  }, [dashboard]);

  const handleCloseConfigPanel = useCallback(() => {
    setConfigPanelOpen(false);
    setSelectedWidgetId(null);
  }, []);

  // ---- Widget management --------------------------------------------------
  const addWidget = useCallback(
    (type: string) => {
      if (!editSchema) return;
      const id = createWidgetId();
      const newWidget: DashboardWidgetSchema = {
        id,
        title: defaultWidgetTitle(type),
        type,
        layout: {
          x: 0,
          y: (editSchema.widgets?.length ?? 0),
          w: editSchema.columns ?? 2,
          h: 1,
        },
      };
      const newSchema = { ...editSchema, widgets: [...(editSchema.widgets || []), newWidget] };
      setEditSchema(newSchema);
      saveSchema(newSchema);
      setSelectedWidgetId(id);
      setConfigVersion((v) => v + 1);
    },
    [editSchema, saveSchema],
  );

  const removeWidget = useCallback(
    (widgetId: string) => {
      if (!editSchema) return;
      const newSchema = {
        ...editSchema,
        widgets: editSchema.widgets.filter((w) => w.id !== widgetId),
      };
      setEditSchema(newSchema);
      saveSchema(newSchema);
      if (selectedWidgetId === widgetId) {
        setSelectedWidgetId(null);
      }
    },
    [editSchema, selectedWidgetId, saveSchema],
  );

  // ---- Dashboard config panel handlers ------------------------------------
  // Stabilize config reference: only recompute after explicit actions (panel
  // open, save, widget add). configVersion is incremented on those actions.
  // This prevents useConfigDraft from resetting the draft on every live field
  // change (same pattern as ViewConfigPanel's stableActiveView).
  const dashboardConfig = useMemo(
    () => extractDashboardConfig(editSchema || (dashboard as DashboardSchema)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [configVersion],
  );

  const handleDashboardConfigSave = useCallback(
    (config: Record<string, any>) => {
      if (!editSchema) return;
      const newSchema = {
        ...editSchema,
        columns: config.columns,
        gap: config.gap,
        rowHeight: config.rowHeight,
        refreshInterval: Number(config.refreshInterval) || 0,
        title: config.title,
        showDescription: config.showDescription,
        theme: config.theme,
      } as DashboardSchema;
      setEditSchema(newSchema);
      saveSchema(newSchema);
      setConfigVersion((v) => v + 1);
    },
    [editSchema, saveSchema],
  );

  const handleDashboardFieldChange = useCallback(
    (field: string, value: any) => {
      if (!editSchema) return;
      // Map config field keys to proper DashboardSchema updates for live preview
      setEditSchema((prev) => {
        if (!prev) return prev;
        if (field === 'refreshInterval') {
          return { ...prev, refreshInterval: Number(value) || 0 };
        }
        return { ...prev, [field]: value };
      });
    },
    [editSchema],
  );

  // ---- Widget config panel handlers ---------------------------------------
  const selectedWidget = editSchema?.widgets?.find((w) => w.id === selectedWidgetId);

  // Stabilize widget config: only recompute after explicit actions (widget
  // switch, save, add). configVersion is incremented on save/add, and
  // selectedWidgetId changes on widget switch — this prevents useConfigDraft
  // from resetting the draft on every live field change.
  const widgetConfig = useMemo(
    () => (selectedWidget ? flattenWidgetConfig(selectedWidget) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedWidgetId, configVersion],
  );

  const handleWidgetConfigSave = useCallback(
    (config: Record<string, any>) => {
      if (!editSchema || !selectedWidgetId || !selectedWidget) return;
      const updates = unflattenWidgetConfig(config, selectedWidget);
      const newSchema = {
        ...editSchema,
        widgets: editSchema.widgets.map((w) =>
          w.id === selectedWidgetId ? { ...w, ...updates } : w,
        ),
      };
      setEditSchema(newSchema);
      saveSchema(newSchema);
      setConfigVersion((v) => v + 1);
    },
    [editSchema, selectedWidgetId, selectedWidget, saveSchema],
  );

  const handleWidgetFieldChange = useCallback(
    (field: string, value: any) => {
      if (!selectedWidgetId) return;
      setEditSchema((prev) => {
        if (!prev) return prev;
        const widget = prev.widgets?.find((w) => w.id === selectedWidgetId);
        if (!widget) return prev;
        const flat = flattenWidgetConfig(widget);
        flat[field] = value;
        const updates = unflattenWidgetConfig(flat, widget);
        return {
          ...prev,
          widgets: prev.widgets.map((w) =>
            w.id === selectedWidgetId ? { ...w, ...updates } : w,
          ),
        };
      });
    },
    [selectedWidgetId],
  );

  // ---- Metadata-driven dropdown options -----------------------------------
  const availableObjects = useMemo(() => {
    if (!metadataObjects?.length) return undefined;
    return metadataObjects.map((obj: any) => ({
      value: obj.name,
      label: obj.label || obj.name,
    }));
  }, [metadataObjects]);

  const availableFields = useMemo(() => {
    const objectName = selectedWidget?.object;
    if (!objectName || !metadataObjects?.length) return undefined;
    const obj = metadataObjects.find((o: any) => o.name === objectName);
    if (!obj?.fields) return undefined;
    const fields = obj.fields;
    if (Array.isArray(fields)) {
      return fields
        .filter((f: any) => f.name)
        .map((f: any) => ({ value: f.name, label: f.label || f.name }));
    }
    // fields can be Record<string, FieldMetadata>
    return Object.entries(fields).map(([key, f]: [string, any]) => ({
      value: key,
      label: f.label || key,
    }));
  }, [selectedWidget?.object, metadataObjects]);

  // ---- Loading / not-found guards -----------------------------------------
  if (isLoading) {
    return <SkeletonDashboard />;
  }

  if (!dashboard) {
    return (
      <div className="h-full flex items-center justify-center p-8">
         <Empty>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <LayoutDashboard className="h-6 w-6 text-muted-foreground" />
          </div>
          <EmptyTitle>Dashboard Not Found</EmptyTitle>
          <EmptyDescription>
            The dashboard &quot;{dashboardName}&quot; could not be found.
            It may have been removed or renamed.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  const previewSchema = configPanelOpen && editSchema ? editSchema : dashboard;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-4 p-4 sm:p-6 border-b shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight truncate">{resolveI18nLabel(dashboard.label) || dashboard.name}</h1>
          {dashboard.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{resolveI18nLabel(dashboard.description)}</p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {/* Add-widget toolbar — visible only in edit mode */}
          {configPanelOpen && (
            <div className="flex items-center gap-1 mr-2" data-testid="dashboard-widget-toolbar">
              {WIDGET_TYPES.map(({ type, label, Icon }) => (
                <button
                  key={type}
                  type="button"
                  data-testid={`dashboard-add-${type}`}
                  onClick={() => addWidget(type)}
                  className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  title={`Add ${label}`}
                >
                  <Plus className="h-3 w-3" />
                  <Icon className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={handleOpenConfigPanel}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
            data-testid="dashboard-edit-button"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <MetadataToggle open={showDebug} onToggle={toggleDebug} />
        </div>
      </div>

      {/* ── Main area + Config Panel ─────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col sm:flex-row relative">
         <div className="flex-1 min-w-0 overflow-auto p-0 sm:p-6">
            <DashboardRenderer
              schema={previewSchema}
              dataSource={dataSource}
              designMode={configPanelOpen}
              selectedWidgetId={selectedWidgetId}
              onWidgetClick={setSelectedWidgetId}
            />
         </div>

         {/* Right-side config panel — switches between dashboard / widget config */}
         {selectedWidget ? (
           <WidgetConfigPanel
             key={selectedWidgetId}
             open={configPanelOpen}
             onClose={handleCloseConfigPanel}
             config={widgetConfig}
             onSave={handleWidgetConfigSave}
             onFieldChange={handleWidgetFieldChange}
             availableObjects={availableObjects}
             availableFields={availableFields}
             headerExtra={
               <Button
                 size="sm"
                 variant="ghost"
                 onClick={() => removeWidget(selectedWidgetId!)}
                 className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                 data-testid="widget-delete-button"
                 title="Delete widget"
               >
                 <Trash2 className="h-3.5 w-3.5" />
               </Button>
             }
           />
         ) : (
           <DashboardConfigPanel
             open={configPanelOpen}
             onClose={handleCloseConfigPanel}
             config={dashboardConfig}
             onSave={handleDashboardConfigSave}
             onFieldChange={handleDashboardFieldChange}
           />
         )}

         <MetadataPanel
            open={showDebug}
            sections={[{ title: 'Dashboard Configuration', data: previewSchema }]}
         />
      </div>
    </div>
  );
}

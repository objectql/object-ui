/**
 * Dashboard View Component
 * Renders a dashboard based on the dashboardName parameter.
 * Edit mode shows a single inline config panel (DashboardConfigPanel) on the
 * right side that hosts the studio's dashboard / widget inspectors, following
 * the same pattern as ReportView.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { DashboardRenderer } from '@object-ui/plugin-dashboard';
import { ModalForm } from '@object-ui/plugin-form';
import { DashboardConfigPanel } from './DashboardConfigPanel';
import { useAuth } from '@object-ui/auth';
import { toast } from 'sonner';
import type { ModalHandler, ActionDef, ActionContext, ActionResult } from '@object-ui/core';
import {
  Empty,
  EmptyTitle,
  EmptyDescription,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@object-ui/components';
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
} from 'lucide-react';
import { MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { SkeletonDashboard } from '../skeletons';
import { useMetadata } from '../providers/MetadataProvider';
import { useExpressionContext } from '../providers/ExpressionProvider';
import { resolveI18nLabel, preferLocal } from '../utils';
import { useAdapter } from '../providers/AdapterProvider';
import { useMetadataClient } from './metadata-admin/useMetadata';
import { persistRuntimeMetadata } from './runtime-metadata-persistence';
import { useObjectTranslation, useObjectLabel } from '@object-ui/i18n';
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
  { type: 'pivot', label: 'Pivot', Icon: LayoutGrid },
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
  const needsFix = schema.widgets.some((w: any) => !w.id);
  if (!needsFix) return schema;
  return {
    ...schema,
    widgets: schema.widgets.map((w: any) => (w.id ? w : { ...w, id: createWidgetId() })),
  };
}

/** Resolve a human-friendly default title for a new widget type. */
function defaultWidgetTitle(type: string): string {
  const entry = WIDGET_TYPES.find((t) => t.type === type);
  return entry ? `New ${entry.label}` : 'New Widget';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardView({ dataSource }: { dataSource?: any }) {
  const { dashboardName } = useParams<{ dashboardName: string }>();
  const { showDebug } = useMetadataInspector();
  const adapter = useAdapter();
  // ADR-0034: dashboard edits persist via the metadata draft/publish model.
  const metadataClient = useMetadataClient();
  const { t } = useObjectTranslation();
  const { dashboardLabel, dashboardDescription } = useObjectLabel();
  // Editing a dashboard mutates the SHARED definition, so it is an admin-only
  // quick-edit affordance (mirrors ObjectView's view-config gate).
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [isLoading, setIsLoading] = useState(true);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);

  // Modal state for header action buttons that request a modal (e.g. New Opportunity)
  const [modalState, setModalState] = useState<{
    schema: any;
    resolve: (r: ActionResult) => void;
  } | null>(null);

  const closeModal = useCallback((result: ActionResult) => {
    setModalState((curr) => {
      if (curr) curr.resolve(result);
      return null;
    });
  }, []);

  const modalHandler = useCallback<ModalHandler>(
    (schema) =>
      new Promise<ActionResult>((resolve) => {
        // Normalize string schema (e.g. action.target = 'opportunity' or
        // 'create_opportunity') to a ModalForm-compatible descriptor so header
        // `modal` actions like { actionType: 'modal', actionUrl: 'create_opportunity' }
        // open the create form for that object. Supports the conventional
        // `<verb>_<object>` form (create_/new_/add_/edit_/update_) emitted by
        // server-driven dashboard schemas.
        let normalized: any;
        if (typeof schema === 'string') {
          const m = schema.match(/^(create|new|add|edit|update)_(.+)$/);
          if (m) {
            const verb = m[1];
            const objectName = m[2];
            const mode = verb === 'edit' || verb === 'update' ? 'edit' : 'create';
            normalized = { objectName, mode };
          } else {
            normalized = { objectName: schema, mode: 'create' };
          }
        } else {
          normalized = schema;
        }
        setModalState({ schema: normalized, resolve });
      }),
    [],
  );

  const scriptHandlers = useMemo<Record<string, (a: ActionDef, c: ActionContext) => Promise<ActionResult> | ActionResult>>(
    () => ({
      export_dashboard_pdf: async () => {
        toast.info(t('dashboardActions.pdfPreparing'));
        try {
          window.print();
          return { success: true };
        } catch (err: any) {
          toast.error(t('dashboardActions.exportFailed', { message: err?.message || String(err) }));
          return { success: false, error: err?.message || String(err) };
        }
      },
      forecast_dashboard: async () => {
        toast.info(t('dashboardActions.forecastSoon'));
        return { success: true };
      },
    }),
    [t],
  );

  useEffect(() => {
    setIsLoading(true);
    setEditSchema(null);
    setConfigPanelOpen(false);
    setSelectedWidgetId(null);
    queueMicrotask(() => setIsLoading(false));
  }, [dashboardName]);

  const { dashboards, objects: metadataObjects, refresh } = useMetadata();
  // ADR-0048 Phase 2 — prefer the dashboard owned by the current app's package.
  const { app: activeApp } = useExpressionContext();
  const dashboard = preferLocal(dashboards as any[], dashboardName, (activeApp as any)?._packageId);

  // Local schema state for live preview — initialized from metadata
  const [editSchema, setEditSchema] = useState<DashboardSchema | null>(null);

  // When metadata refreshes (dashboard reference changes), discard stale
  // editSchema if the config panel is already closed.
  useEffect(() => {
    if (!configPanelOpen) {
      setEditSchema(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard]);

  // ---- Save helper --------------------------------------------------------
  const saveSchema = useCallback(
    async (schema: DashboardSchema) => {
      try {
        if (metadataClient) {
          // ADR-0034: save stages a per-item draft; an explicit Publish
          // promotes it (RuntimeDraftBar). `sys_dashboard` is retired.
          await persistRuntimeMetadata('dashboard', dashboardName!, schema, {
            metadataClient,
          });
        }
        // Refresh metadata cache so closing the config panel shows saved data
        refresh().catch(() => {});
      } catch (err) {
        // Surface the failure — previously this was a silent console.warn,
        // which produced "I saw it work, then refresh wiped it" reports
        // because the optimistic state update masked a server-side reject.
        const message = err instanceof Error ? err.message : String(err);
        console.warn('[DashboardView] Auto-save failed:', err);
        toast.error(`Failed to save dashboard: ${message}`);
      }
    },
    [metadataClient, dashboardName, refresh],
  );

  // ---- Open / close config panel ------------------------------------------
  const handleOpenConfigPanel = useCallback(() => {
    setEditSchema(ensureWidgetIds(dashboard as DashboardSchema));
    setConfigPanelOpen(true);
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
    },
    [editSchema, saveSchema],
  );

  const removeWidget = useCallback(
    (widgetId: string) => {
      if (!editSchema) return;
      const newSchema = {
        ...editSchema,
        widgets: editSchema.widgets.filter((w: any) => w.id !== widgetId),
      };
      setEditSchema(newSchema);
      saveSchema(newSchema);
      if (selectedWidgetId === widgetId) {
        setSelectedWidgetId(null);
      }
    },
    [editSchema, selectedWidgetId, saveSchema],
  );

  // Reorder widgets via drag-and-drop from DashboardRenderer's design mode.
  const handleWidgetsReorder = useCallback(
    (nextWidgets: any[]) => {
      const baseSchema = editSchema || (dashboard as DashboardSchema | undefined);
      if (!baseSchema) return;
      const newSchema: DashboardSchema = {
        ...baseSchema,
        widgets: nextWidgets,
      } as DashboardSchema;
      setEditSchema(newSchema);
      saveSchema(newSchema);
    },
    [editSchema, dashboard, saveSchema],
  );

  // ---- Live-edit schema for the config panel ------------------------------
  // The single controlled config panel hosts the studio inspectors, which edit
  // the FULL nested dashboard draft directly (dashboard-level via shallow patch,
  // widget-level by addressing `widgets` by id). No flatten / unflatten / config
  // extraction is required anymore.
  const panelSchema = (editSchema || (dashboard as DashboardSchema)) ?? null;

  // ---- Runtime capability gate (must run before guards to respect Rules of Hooks)
  // Hide widgets whose `requiresObject` is not registered (mirrors
  // NavigationItem.requiresObject for nav entries). Defaults to widget.object
  // when not set, so any object-bound widget disappears gracefully when its
  // backing object isn't in this runtime (e.g. cloud-only
  // `sys_package_installation` on system_overview).
  const registeredObjectNamesForFilter = useMemo(
    () => new Set<string>((metadataObjects || []).map((o: any) => o?.name).filter(Boolean)),
    [metadataObjects],
  );
  const previewSchemaSrc = editSchema || dashboard;
  const previewSchema = useMemo(() => {
    if (!previewSchemaSrc) return previewSchemaSrc;
    // Defer pruning until metadata has actually loaded — otherwise the
    // empty Set would hide every object-bound widget on first render.
    if (registeredObjectNamesForFilter.size === 0) return previewSchemaSrc;
    const widgets = (previewSchemaSrc as any).widgets;
    if (!Array.isArray(widgets) || widgets.length === 0) return previewSchemaSrc;
    const filtered = widgets.filter((w: any) => {
      const required = w?.requiresObject ?? w?.object;
      if (!required) return true;
      return registeredObjectNamesForFilter.has(required);
    });
    if (filtered.length === widgets.length) return previewSchemaSrc;
    return { ...previewSchemaSrc, widgets: filtered };
  }, [previewSchemaSrc, registeredObjectNamesForFilter]);

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
          <EmptyTitle>{t('empty.dashboardNotFound')}</EmptyTitle>
          <EmptyDescription>
            {t('empty.dashboardNotFoundDescription', { name: dashboardName })}
          </EmptyDescription>
        </Empty>
      </div>
    );
  }


  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-4 p-4 sm:p-6 border-b shrink-0">
        <div className="min-w-0 flex-1">
          {(() => {
            // Per @objectstack/spec, DashboardSchema.title is "the dashboard
            // title displayed in the header". We prefer it when present so
            // edits made through the config panel (which writes `title`) are
            // visible after save/reload. Falls back to `label` (the metadata
            // display name) and finally to the raw `name`. We also follow
            // `previewSchema` instead of the cached `dashboard` so the H1
            // updates live while the user is typing in the config panel.
            const headerSrc = (previewSchema as any) || dashboard;
            const resolvedTitle = resolveI18nLabel(headerSrc.title, t);
            const resolvedLabel = resolveI18nLabel(dashboard.label, t);
            const fallbackLabel = dashboardLabel({ name: dashboard.name, label: resolvedLabel });
            const display = resolvedTitle || fallbackLabel || dashboard.name;
            return (
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight truncate">{display}</h1>
            );
          })()}
          {(() => {
            const headerSrc = (previewSchema as any) || dashboard;
            const rawDesc = headerSrc.description ?? dashboard.description;
            const desc = dashboardDescription({
              name: dashboard.name,
              description: resolveI18nLabel(rawDesc, t),
            });
            return desc ? (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{desc}</p>
            ) : null;
          })()}
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {/* Add-widget toolbar — visible only in edit mode */}
          {configPanelOpen && (
            <div className="flex items-center gap-1 mr-2" role="toolbar" aria-label="Add widgets" data-testid="dashboard-widget-toolbar">
              {WIDGET_TYPES.map(({ type, label, Icon }) => (
                <button
                  key={type}
                  type="button"
                  data-testid={`dashboard-add-${type}`}
                  onClick={() => addWidget(type)}
                  className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={`Add ${label}`}
                  aria-label={`Add ${label} widget`}
                >
                  <Plus className="h-3 w-3" />
                  <Icon className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
          {isAdmin && (
          <button
            type="button"
            onClick={handleOpenConfigPanel}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
            data-testid="dashboard-edit-button"
          >
            <Pencil className="h-3.5 w-3.5" />
            {t('common.edit', { defaultValue: 'Edit' })}
          </button>
          )}
        </div>
      </div>

      {/* ── Main area + Config Panel ─────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col sm:flex-row relative">
         <div className="flex-1 min-w-0 overflow-auto p-2 sm:p-4 md:p-6">
            <DashboardRenderer
              schema={previewSchema}
              dataSource={dataSource}
              designMode={configPanelOpen}
              selectedWidgetId={selectedWidgetId}
              onWidgetClick={setSelectedWidgetId}
              onWidgetsReorder={handleWidgetsReorder}
              modalHandler={modalHandler}
              scriptHandlers={scriptHandlers}
              hideHeaderText
            />
         </div>

         {/* Right-side config panel — one controlled panel that switches
             between the dashboard-level and widget-level studio inspectors. */}
         <DashboardConfigPanel
           open={configPanelOpen && isAdmin}
           onClose={handleCloseConfigPanel}
           schema={panelSchema}
           selectedWidgetId={selectedWidgetId}
           onSelectWidget={setSelectedWidgetId}
           onSave={saveSchema}
           onChange={setEditSchema}
           onRemoveWidget={removeWidget}
           name={dashboardName}
           metadataClient={metadataClient}
           onAfterChange={() => refresh().catch(() => {})}
         />

         <MetadataPanel
            open={showDebug}
            sections={[{ title: 'Dashboard Configuration', data: previewSchema }]}
         />
      </div>

      {/* Modal triggered by header actions (e.g. "New Opportunity") */}
      {modalState && modalState.schema?.objectName ? (
        <ModalForm
          schema={{
            type: 'object-form',
            formType: 'modal',
            objectName: modalState.schema.objectName,
            mode: modalState.schema.mode || 'create',
            recordId: modalState.schema.recordId,
            title: modalState.schema.title,
            description: modalState.schema.description,
            fields: modalState.schema.fields,
            open: true,
            onOpenChange: (open: boolean) => { if (!open) closeModal({ success: false }); },
            onSuccess: (data: any) => { closeModal({ success: true, reload: true, data }); },
            onCancel: () => { closeModal({ success: false }); },
            showSubmit: true,
            showCancel: true,
          }}
          dataSource={adapter as any}
        />
      ) : modalState ? (
        <Dialog open onOpenChange={(open) => { if (!open) closeModal({ success: false }); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{modalState.schema?.title || t('actionDialog.defaultActionTitle')}</DialogTitle>
              {modalState.schema?.description && (
                <DialogDescription>{modalState.schema.description}</DialogDescription>
              )}
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => closeModal({ success: false })}>{t('actionDialog.cancel')}</Button>
              <Button onClick={() => closeModal({ success: true })}>{t('actionDialog.ok')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

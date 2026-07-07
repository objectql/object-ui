/**
 * Dashboard View Component
 * Renders a dashboard based on the dashboardName parameter.
 *
 * This is a pure VIEWER. Authoring a dashboard (adding/removing widgets,
 * editing config) lives in Studio's Interfaces pillar — reached via the top
 * bar's "Design in Studio" icon, which deep-links to this dashboard's design
 * surface. The former in-page inline edit button + config panel were retired
 * so there is a single, consistent authoring surface.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { DashboardRenderer } from '@object-ui/plugin-dashboard';
import { DrillNavigationProvider } from '@object-ui/react';
import { useOpenRecordList } from './useOpenRecordList';
import { ModalForm } from '@object-ui/plugin-form';
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
import { LayoutDashboard } from 'lucide-react';
import { MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { SkeletonDashboard } from '../skeletons';
import { useMetadata } from '../providers/MetadataProvider';
import { useExpressionContext } from '../providers/ExpressionProvider';
import { resolveI18nLabel, preferLocal } from '../utils';
import { useAdapter } from '../providers/AdapterProvider';
import { useObjectTranslation, useObjectLabel } from '@object-ui/i18n';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardView({ dataSource }: { dataSource?: any }) {
  // Drill "escape hatch": lets the drill drawers open an object's full list page.
  const openRecordList = useOpenRecordList();
  const { dashboardName } = useParams<{ dashboardName: string }>();
  const { showDebug } = useMetadataInspector();
  const adapter = useAdapter();
  const { t } = useObjectTranslation();
  const { dashboardLabel, dashboardDescription } = useObjectLabel();
  const [isLoading, setIsLoading] = useState(true);

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
    queueMicrotask(() => setIsLoading(false));
  }, [dashboardName]);

  const { dashboards, objects: metadataObjects } = useMetadata();
  // ADR-0048 Phase 2 — prefer the dashboard owned by the current app's package.
  const { app: activeApp } = useExpressionContext();
  const dashboard = preferLocal(dashboards as any[], dashboardName, (activeApp as any)?._packageId);

  // ---- Runtime capability gate --------------------------------------------
  // Hide widgets whose `requiresObject` is not registered (mirrors
  // NavigationItem.requiresObject for nav entries). Defaults to widget.object
  // when not set, so any object-bound widget disappears gracefully when its
  // backing object isn't in this runtime (e.g. cloud-only
  // `sys_package_installation` on system_overview).
  const registeredObjectNamesForFilter = useMemo(
    () => new Set<string>((metadataObjects || []).map((o: any) => o?.name).filter(Boolean)),
    [metadataObjects],
  );
  const previewSchema = useMemo(() => {
    if (!dashboard) return dashboard;
    // Defer pruning until metadata has actually loaded — otherwise the
    // empty Set would hide every object-bound widget on first render.
    if (registeredObjectNamesForFilter.size === 0) return dashboard;
    const widgets = (dashboard as any).widgets;
    if (!Array.isArray(widgets) || widgets.length === 0) return dashboard;
    const filtered = widgets.filter((w: any) => {
      const required = w?.requiresObject ?? w?.object;
      if (!required) return true;
      return registeredObjectNamesForFilter.has(required);
    });
    if (filtered.length === widgets.length) return dashboard;
    return { ...dashboard, widgets: filtered };
  }, [dashboard, registeredObjectNamesForFilter]);

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
            // title displayed in the header". We prefer it when present, then
            // fall back to `label` (the metadata display name) and finally to
            // the raw `name`.
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
      </div>

      {/* ── Main area ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col sm:flex-row relative">
         <div className="flex-1 min-w-0 overflow-auto p-2 sm:p-4 md:p-6">
            <DrillNavigationProvider value={{ openRecordList }}>
              <DashboardRenderer
                schema={previewSchema}
                dataSource={dataSource}
                modalHandler={modalHandler}
                scriptHandlers={scriptHandlers}
                hideHeaderText
              />
            </DrillNavigationProvider>
         </div>

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

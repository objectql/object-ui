/**
 * Console ObjectView
 *
 * Thin wrapper around the plugin-view ObjectView that adds:
 * - Multi-view resolution from objectDef.list_views
 * - MetadataInspector toggle
 * - Drawer for record detail preview
 * - useObjectActions for toolbar create button
 * - ListView delegation for non-grid view types (kanban, calendar, chart, etc.)
 */

import { useMemo, useState, useCallback, useEffect, useRef, lazy, Suspense, type ComponentType } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
const ObjectChart = lazy(() =>
  import('@object-ui/plugin-charts').then((m) => ({ default: m.ObjectChart })),
);
const ImportWizard = lazy(() =>
  import('@object-ui/plugin-grid').then((m) => ({ default: m.ImportWizard })),
);
import { ListView } from '@object-ui/plugin-list';
import { DetailView, RecordChatterPanel } from '@object-ui/plugin-detail';
import { ObjectView as PluginObjectView, ViewTabBar, ManageViewsDialog } from '@object-ui/plugin-view';
import type { ViewTabItem } from '@object-ui/plugin-view';
// Plugin registration is handled by the host app (e.g. apps/console/src/main.tsx
// uses ComponentRegistry.registerLazy so heavy plugins stay code-split).
// Do NOT add eager `import '@object-ui/plugin-*'` side-effect imports here.
import {
  Button,
  Empty,
  EmptyTitle,
  EmptyDescription,
  NavigationOverlay,
} from '@object-ui/components';
import { Plus, Upload, Star, StarOff, Table as TableIcon, KanbanSquare, Calendar, LayoutGrid, Activity, GanttChart, MapPin, BarChart3 } from 'lucide-react';
import { useFavorites } from '../hooks/useFavorites';
import { getIcon } from '../utils/getIcon';
import type { ListViewSchema, ViewNavigationConfig, FeedItem } from '@object-ui/types';
import { MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { ViewConfigPanel } from './ViewConfigPanel';
import { useMetadataClient } from './metadata-admin/useMetadata';
import { persistRuntimeMetadata, createRuntimeMetadata } from './runtime-metadata-persistence';
import { CreateViewDialog } from './CreateViewDialog';
import { PageHeader } from '../layout/PageHeader';
import { useMobileViewSwitcherRegistration } from '../layout/MobileViewSwitcherContext';
import type { MobileViewSwitcherItem } from '../layout/MobileViewSwitcherContext';
import { ManagedByBadge } from '../components/ManagedByBadge';
import { RecordDetailView } from './RecordDetailView';
import { resolveCrudAffordances } from '../utils/crudAffordances';
import { resolveManagedByEmptyState } from '../utils/managedByEmptyState';
import { useObjectActions } from '../hooks/useObjectActions';
import { useObjectTranslation, useObjectLabel } from '@object-ui/i18n';
import { usePermissions } from '@object-ui/permissions';
import { useAuth, createAuthenticatedFetch } from '@object-ui/auth';
import { useRealtimeSubscription, useConflictResolution } from '@object-ui/collaboration';
import { ActionProvider, useNavigationOverlay, SchemaRenderer } from '@object-ui/react';
import { toast } from 'sonner';
import { ActionConfirmDialog, type ConfirmDialogState } from './ActionConfirmDialog';
import { ActionParamDialog, type ParamDialogState } from './ActionParamDialog';
import { ActionResultDialog, type ResultDialogState } from './ActionResultDialog';
import { FlowRunner, type ScreenFlowState } from './FlowRunner';
import { resolveActionParams } from '../utils/resolveActionParams';
import type { ActionDef, ActionParamDef } from '@object-ui/core';

/** Map view types to Lucide icons (Airtable-style) */
const VIEW_TYPE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
    grid: TableIcon,
    kanban: KanbanSquare,
    calendar: Calendar,
    gallery: LayoutGrid,
    timeline: Activity,
    gantt: GanttChart,
    map: MapPin,
    chart: BarChart3,
};

const FALLBACK_USER = { id: 'current-user', name: 'Demo User' };

/**
 * Replace built-in tokens (e.g. `{current_user_id}`) inside a filter array
 * with concrete values. Filters from platform-shipped `listViews` or saved
 * `sys_view` rows may declare context-sensitive predicates like
 * `{ field: 'submitter_id', operator: 'equals', value: '{current_user_id}' }`
 * — those need to be substituted before the query reaches the API.
 *
 * Recognised tokens:
 *   • `{current_user_id}` → the authenticated user's id
 *
 * Returns a deep-cloned copy with substitutions applied. Non-array input
 * is returned unchanged.
 */
function substituteFilterTokens(filter: any, currentUserId: string | undefined): any {
    if (!Array.isArray(filter)) return filter;
    const sub = (v: any): any => {
        if (typeof v === 'string') {
            if (v === '{current_user_id}') return currentUserId ?? v;
            return v;
        }
        if (Array.isArray(v)) return v.map(sub);
        if (v && typeof v === 'object') {
            const out: any = {};
            for (const k of Object.keys(v)) out[k] = sub(v[k]);
            return out;
        }
        return v;
    };
    return filter.map(sub);
}

export function ObjectView({ dataSource, objects, onEdit, externalRefreshKey }: any) {
    const { objectName } = useParams();
    const { t } = useObjectTranslation();

    // Resolve the object definition up front. When it's missing we render the
    // "object not found" empty state *here*, before the inner component mounts.
    // This is the key to keeping the Rules of Hooks satisfied: ObjectViewInner
    // holds ~50 hooks and must call them unconditionally, so the missing-object
    // branch lives in this thin wrapper instead of as a mid-component early
    // return. The inner subtree then mounts/unmounts as a whole (object exists
    // ↔ doesn't) rather than toggling the number of hooks executed per render.
    const objectDef = objects.find((o: any) => o.name === objectName);
    if (!objectDef) {
      return (
        <div className="h-full p-4 flex items-center justify-center">
          <Empty>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <TableIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <EmptyTitle>{t('console.objectView.objectNotFound')}</EmptyTitle>
            <EmptyDescription>
              {t('console.objectView.objectNotFoundDescription', { objectName })}
              {' '}
              {t('console.objectView.objectNotFoundHint')}
            </EmptyDescription>
          </Empty>
        </div>
      );
    }

    return (
      <ObjectViewInner
        dataSource={dataSource}
        objects={objects}
        onEdit={onEdit}
        externalRefreshKey={externalRefreshKey}
      />
    );
}

/**
 * Inner ObjectView body. Only mounted by {@link ObjectView} once the object
 * definition is known to exist, so every hook below runs unconditionally on
 * every render of this component — no early return sits between hook calls.
 */
function ObjectViewInner({ dataSource, objects, onEdit, externalRefreshKey }: any) {
    const navigate = useNavigate();
    const { appName, objectName, viewId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const { showDebug } = useMetadataInspector();
    const { t } = useObjectTranslation();
    const { objectLabel, objectDescription: objectDesc, viewLabel, viewEmptyState, actionLabel, actionConfirm, actionSuccess, fieldLabel, fieldOptionLabel } = useObjectLabel();
    const { isFavorite, toggleFavorite } = useFavorites();
    // ADR-0034: runtime view edits persist via the metadata draft/publish
    // model (the `sys_view` table is retired).
    const metadataClient = useMetadataClient();

    // Inline view config panel state (Airtable-style right sidebar)
    const [showViewConfigPanel, setShowViewConfigPanel] = useState(false);
    const [viewConfigPanelMode, setViewConfigPanelMode] = useState<'create' | 'edit'>('edit');
    // Airtable-style "Create view" dialog (type picker + name input)
    const [showCreateViewDialog, setShowCreateViewDialog] = useState(false);
    // Manage Views dialog (vertical sortable list of all views)
    const [manageViewsOpen, setManageViewsOpen] = useState(false);
    
    // Draft state for view config edits — cached locally, saved on demand
    const [viewDraft, setViewDraft] = useState<Record<string, any> | null>(null);

    // Per-view debounce timers + latest pending patch payloads. Keyed by
    // viewId so toggles on different views don't clobber each other. We
    // merge incoming patches into a single payload so rapid successive
    // toggles (e.g. resize-drag emitting 60 events/sec) collapse into one
    // network write.
    const persistTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const persistPending = useRef<Record<string, Record<string, any>>>({});
    const persistViewPatch = useCallback(
        (viewIdLocal: string, baseViewDef: Record<string, any>, patch: Record<string, any>) => {
            if (!dataSource?.updateViewConfig || !objectName || !viewIdLocal) return;
            // Merge into pending payload — every key present is the latest
            // value the user intended.
            const prev = persistPending.current[viewIdLocal] || {};
            persistPending.current[viewIdLocal] = { ...prev, ...patch };
            const existing = persistTimers.current[viewIdLocal];
            if (existing) clearTimeout(existing);
            persistTimers.current[viewIdLocal] = setTimeout(() => {
                const merged = persistPending.current[viewIdLocal] || {};
                delete persistPending.current[viewIdLocal];
                delete persistTimers.current[viewIdLocal];
                Promise.resolve(
                    dataSource.updateViewConfig(objectName, viewIdLocal, {
                        ...baseViewDef,
                        ...merged,
                    })
                ).catch((err: any) => {
                    console.error('[ObjectView] Failed to persist view config:', err);
                });
            }, 300);
        },
        [dataSource, objectName]
    );

    const handleViewConfigSave = useCallback((draft: Record<string, any>) => {
        setViewDraft(draft);
        setRefreshKey(k => k + 1);

        // ADR-0034: stage a per-item draft via the metadata seam; an explicit
        // Publish (RuntimeDraftBar) promotes it + records a version.
        const vid = draft.id;
        if (metadataClient && vid) {
            persistRuntimeMetadata('view', vid, draft, { metadataClient }).catch((err: any) => {
                console.error('[ViewConfigPanel] Failed to persist view config:', err);
            });
        } else {
            console.warn('[ViewConfigPanel] Cannot persist view config: missing metadataClient or viewId.');
        }
    }, [metadataClient]);

    /** Create a new view via the config panel */
    const handleViewCreate = useCallback(async (config: Record<string, any>) => {
        try {
            let createdId: string | undefined;
            if (metadataClient) {
                // Prefill sensible defaults so the saved view renders rows
                // immediately even if the user didn't pick columns yet.
                const objectDef = objects?.find?.((o: any) => o.name === objectName);
                const SYSTEM_FIELDS = new Set([
                    'id', 'created_at', 'createdAt', 'updated_at', 'updatedAt',
                    'deleted_at', 'deletedAt', 'created_by', 'createdBy',
                    'updated_by', 'updatedBy', '_version', '_rev',
                ]);
                let defaultColumns: string[] = [];
                if (Array.isArray(objectDef?.compactLayout) && objectDef.compactLayout.length > 0) {
                    defaultColumns = objectDef.compactLayout.filter((n: string) => objectDef.fields?.[n]);
                } else if (objectDef?.fields) {
                    defaultColumns = Object.entries(objectDef.fields)
                        .filter(([name, f]: [string, any]) => f && !f.hidden && !SYSTEM_FIELDS.has(name))
                        .map(([name]) => name)
                        .slice(0, 5);
                }
                const incomingColumns = Array.isArray(config.columns) && config.columns.length > 0
                    ? config.columns
                    : defaultColumns;
                // ADR-0005 overlay path — write the full spec under a unique
                // `name` via the metadata customization API instead of into
                // the physical `sys_view` table (whose columns no longer
                // accommodate the spec shape: arrays, nested objects, etc.).
                const spec: Record<string, any> = { ...config, columns: incomingColumns };
                // Per @objectstack/spec, certain view types nest their card/field
                // list inside their type-specific subconfig (e.g. kanban.columns,
                // gallery.visibleFields). The CreateViewDialog only collects
                // required *picker* fields; we mirror the resolved column list
                // into the subconfig here so the spec validator accepts the row.
                if (config.type === 'kanban') {
                    spec.kanban = { ...(spec.kanban || {}), columns: incomingColumns };
                } else if (config.type === 'gallery') {
                    const existing = spec.gallery || {};
                    if (!Array.isArray(existing.visibleFields) || existing.visibleFields.length === 0) {
                        spec.gallery = { ...existing, visibleFields: incomingColumns };
                    }
                }
                // ADR-0034: a new view is created as an invisible per-item
                // draft via the metadata seam; an explicit Publish promotes it.
                // UI-layer concerns (default columns, kanban/gallery massaging
                // above, and the auto-activation below) stay here.
                const draftName = String(
                    (config as any)?.name ?? (config as any)?.id ?? (spec as any)?.id ?? '',
                );
                createdId = await createRuntimeMetadata('view', draftName, spec, {
                    metadataClient,
                });
            }
            setShowViewConfigPanel(false);
            setViewConfigPanelMode('edit');
            setRefreshKey(k => k + 1);
            // Auto-activate the newly created view (Airtable parity).
            // Routing falls back to the default view if `createdId` doesn't
            // resolve yet — re-render after refresh will pick it up.
            if (createdId) {
                if (viewId) {
                    navigate(`../${createdId}`, { relative: 'path' });
                } else {
                    navigate(`view/${createdId}`);
                }
            }
        } catch (err) {
            console.error('[ViewConfigPanel] Failed to create view:', err);
        }
    }, [dataSource, objectName, objects, navigate, viewId, metadataClient]);
    
    // Record count tracking for footer
    const [recordCount, setRecordCount] = useState<number | undefined>(undefined);
    
    // Admin users automatically get design tools (no toggle needed)
    const { user, activeOrganization } = useAuth();
    const isAdmin = user?.role === 'admin';
    const { can } = usePermissions();
    
    // Get Object Definition. The outer ObjectView wrapper already guards the
    // missing-object case, so this always resolves while this component is
    // mounted — every hook below can therefore run unconditionally.
    const objectDef = objects.find((o: any) => o.name === objectName);

    // Refresh trigger — bumped after view CRUD or external data mutations.
    const [refreshKey, setRefreshKey] = useState(0);
    // Screen-flow runtime: a paused `screen`-node flow awaiting user input.
    const [screenFlow, setScreenFlow] = useState<ScreenFlowState | null>(null);

    // Resolve which generic CRUD affordances belong in the toolbar for
    // this object's lifecycle bucket (`managedBy`).  config tables show
    // New/Edit/Delete but no CSV Import; system / append-only / better-auth
    // hide the lot — those flows go through purpose-built actions on the
    // source record (e.g. "Submit for Approval" on an Opportunity creates
    // an `sys_approval_request`).  Permissions still gate the buttons.
    const affordances = useMemo(
      () => resolveCrudAffordances(objectDef as any),
      [objectDef],
    );

    // Propagate externally-triggered refreshes (e.g. global ModalForm submit)
    // into our internal refreshKey so list/data effects re-run.
    useEffect(() => {
        if (externalRefreshKey === undefined || externalRefreshKey === 0) return;
        setRefreshKey(k => k + 1);
    }, [externalRefreshKey]);

    // Import wizard open/close state — toolbar entry triggers it.
    const [showImport, setShowImport] = useState(false);

    // ─── User-defined views (metadata overlay) ──────────────────────────
    // Saved views created via the ViewConfigPanel ("Add View") live in the
    // metadata overlay (`/meta/view`). We fetch them via `listViews` and merge
    // into `views` so the ViewTabBar renders them alongside metadata-defined
    // listViews.
    const [savedViews, setSavedViews] = useState<any[]>([]);
    useEffect(() => {
        let cancelled = false;
        if (!objectName) {
            setSavedViews([]);
            return;
        }
        // Read saved views from the metadata overlay (`/meta/view`) via the
        // adapter's `listViews`. Adapters without it surface no saved views.
        if (typeof (dataSource as any)?.listViews === 'function') {
            (dataSource as any).listViews(objectName)
                .then((rows: any[]) => {
                    if (cancelled) return;
                    // Normalize: ensure each view has an `id` for ViewTabBar
                    // (which is name-keyed downstream). Stamp `objectName`
                    // so the defensive filter in handlers still works.
                    const normalized = (rows || []).map((sv: any) => ({
                        ...sv,
                        // Overlay rows are keyed by `name`. Prefer that as the
                        // tab id so a duplicate's `id` field (which may have
                        // been copied verbatim from the source artifact) does
                        // not collide with the source's view id during dedup.
                        id: sv.name || sv.id,
                        objectName: sv.objectName || sv.object || objectName,
                    }));
                    setSavedViews(normalized);
                })
                .catch((err: any) => {
                    console.error('[ObjectView] Failed to load overlay views:', err);
                    if (!cancelled) setSavedViews([]);
                });
            return () => { cancelled = true; };
        }
        // No overlay API available (e.g. a minimal adapter / test mock) → no
        // saved views. The retired `sys_view` table is no longer read.
        setSavedViews([]);
        return () => { cancelled = true; };
    }, [dataSource, objectName, refreshKey]);

    // Persisted per-view config overrides (e.g. density toggle). Saved
    // separately from `objectDef.listViews` (the embedded definition) via
    // `dataSource.updateViewConfig` and read back here so toggle preferences
    // survive a hard reload. Keyed by viewId → partial view config to merge.
    //
    // Use the batch listViewOverrides() when available — fires one HTTP
    // GET per object instead of N (one per defined view), avoiding a flurry
    // of 404s for objects whose views have never been customized. Falls
    // back to per-view getView() for adapters that don't support the batch
    // method.
    const [viewOverrides, setViewOverrides] = useState<Record<string, any>>({});
    useEffect(() => {
        let cancelled = false;
        if (!dataSource || !objectName) {
            setViewOverrides({});
            return;
        }
        const definedViews = (objectDef.listViews || objectDef.list_views || {}) as Record<string, any>;
        const ids = Object.keys(definedViews);
        // Include the primary view id so overrides apply to it too.
        const primary = (objectDef as any).list;
        if (primary && typeof primary === 'object') {
            const primaryId = primary.name || 'list';
            if (!ids.includes(primaryId)) ids.unshift(primaryId);
        }
        if (ids.length === 0) {
            setViewOverrides({});
            return;
        }

        const loadBatch = async (): Promise<Record<string, any>> => {
            if (typeof (dataSource as any).listViewOverrides === 'function') {
                try {
                    const all = await (dataSource as any).listViewOverrides(objectName);
                    if (all && typeof all === 'object') {
                        const map: Record<string, any> = {};
                        for (const id of ids) {
                            if (all[id]) map[id] = all[id];
                        }
                        return map;
                    }
                } catch {
                    // fall through to per-view fetch
                }
            }
            if (typeof dataSource.getView !== 'function') return {};
            const entries = await Promise.all(
                ids.map(async (id) => {
                    try {
                        const v = await dataSource.getView!(objectName, id);
                        return [id, v] as const;
                    } catch {
                        return [id, null] as const;
                    }
                })
            );
            const map: Record<string, any> = {};
            for (const [id, v] of entries) {
                if (v && typeof v === 'object') map[id] = v;
            }
            return map;
        };

        loadBatch().then((map) => {
            if (!cancelled) setViewOverrides(map);
        });
        return () => { cancelled = true; };
    }, [dataSource, objectName, objectDef.listViews, objectDef.list_views, (objectDef as any).list, refreshKey]);

    // Resolve Views from objectDef.listViews (camelCase per @objectstack/spec)
    const views = useMemo(() => {
        // Default column resolution priority:
        //   1. `compactLayout` (curated primary business fields).
        //   2. Business fields only — exclude system-managed identifiers/audit
        //      columns (id, created_at, updated_at, …) and fields explicitly
        //      marked hidden/readonly on the schema. First 5 kept for compactness.
        const SYSTEM_FIELDS = new Set([
            'id', 'created_at', 'createdAt', 'updated_at', 'updatedAt',
            'deleted_at', 'deletedAt', 'created_by', 'createdBy',
            'updated_by', 'updatedBy', '_version', '_rev',
        ]);
        const resolveDefaultColumns = (): string[] => {
            if (Array.isArray(objectDef.compactLayout) && objectDef.compactLayout.length > 0) {
                return objectDef.compactLayout.filter((n: string) => objectDef.fields?.[n]);
            }
            if (objectDef.fields) {
                return Object.entries(objectDef.fields)
                    .filter(([name, f]: [string, any]) => {
                        if (!f) return false;
                        if (f.hidden) return false;
                        if (SYSTEM_FIELDS.has(name)) return false;
                        return true;
                    })
                    .map(([name]) => name)
                    .slice(0, 5);
            }
            return [];
        };

        const definedViews = objectDef.listViews || objectDef.list_views || {};
        const viewList = Object.entries(definedViews).map(([key, value]: [string, any]) => {
            const override = viewOverrides[key];
            // Override wins per-key — saved overrides represent user
            // preferences (density, column widths, etc.) that should
            // shadow the embedded definition.
            return {
                id: key,
                ...value,
                ...(override || {}),
                type: (override?.type) || value.type || 'grid',
            };
        });

        // Honor `objectDef.list` (the primary list view, per @objectstack/spec
        // ViewSchema). MetadataProvider mirrors it into `listViews` so it's
        // already in `viewList` above; promote it to the front and mark it as
        // the default so `defaultViewId` picks it over secondary listViews.
        const primary = (objectDef as any).list;
        if (primary && typeof primary === 'object') {
            const primaryId = primary.name || 'list';
            const idx = viewList.findIndex(v => v.id === primaryId);
            if (idx >= 0) {
                const [entry] = viewList.splice(idx, 1);
                viewList.unshift({ ...entry, isDefault: true });
            } else {
                const override = viewOverrides[primaryId];
                viewList.unshift({
                    id: primaryId,
                    ...primary,
                    ...(override || {}),
                    type: (override?.type) || primary.type || 'grid',
                    isDefault: true,
                });
            }
        }

        if (viewList.length === 0) {
            viewList.push({
                id: 'all',
                label: t('console.objectView.allRecords'),
                type: 'grid',
                columns: resolveDefaultColumns(),
            });
        }

        // Merge user-defined views (sys_view) after metadata-defined views.
        // Dedup by id so a saved view that shadows a metadata view wins.
        const metaIds = new Set(viewList.map(v => v.id));
        for (const sv of savedViews) {
            const id = sv.id || sv._id;
            if (!id) continue;
            // Drop undefined fields so a partial overlay (e.g. baseline row
            // with no user customization) does not stomp `isDefault`/`columns`
            // populated from the metadata view it shadows.
            const rawNormalized: Record<string, any> = {
                label: sv.label || sv.name || id,
                type: sv.type || 'grid',
                columns: sv.columns,
                filter: sv.filter,
                sort: sv.sort,
                showSearch: sv.showSearch,
                showFilters: sv.showFilters,
                showSort: sv.showSort,
                isPinned: sv.isPinned,
                isDefault: sv.isDefault,
                visibility: sv.visibility,
                sortOrder: sv.sortOrder,
                ...sv,
                id,
            };
            const normalized: Record<string, any> = {};
            for (const [k, v] of Object.entries(rawNormalized)) {
                if (v !== undefined) normalized[k] = v;
            }
            if (metaIds.has(id)) {
                const idx = viewList.findIndex(v => v.id === id);
                viewList[idx] = { ...viewList[idx], ...normalized };
            } else {
                viewList.push(normalized);
            }
        }

        // Apply default columns to any grid-like view that has no explicit
        // columns (e.g. saved views created via "Add View" before the user
        // configured fields). Without this, the grid renders an empty header
        // row and the data fetch omits a `select` clause.
        const GRID_LIKE = new Set(['grid', 'list', 'table']);
        for (const v of viewList) {
            if (!GRID_LIKE.has(v.type)) continue;
            if (!Array.isArray(v.columns) || v.columns.length === 0) {
                v.columns = resolveDefaultColumns();
            }
        }

        // Stable sort: respect a per-user view-order preference (for both
        // metadata and saved views). Falls back to: metadata views first
        // in declared order, then saved views by `sortOrder` / created_at.
        const indexOf = new Map(viewList.map((v, i) => [v.id, i]));
        let userOrder: string[] = [];
        try {
            const raw = typeof window !== 'undefined'
                ? window.localStorage?.getItem(`viewOrder:${objectDef.name}`)
                : null;
            if (raw) userOrder = JSON.parse(raw);
        } catch { /* ignore */ }
        const userOrderIndex = new Map(userOrder.map((id, i) => [id, i]));
        viewList.sort((a, b) => {
            const aUser = userOrderIndex.get(a.id);
            const bUser = userOrderIndex.get(b.id);
            if (aUser !== undefined && bUser !== undefined) return aUser - bUser;
            if (aUser !== undefined) return -1;
            if (bUser !== undefined) return 1;
            const aSaved = savedViews.find((sv: any) => (sv.id || sv._id) === a.id);
            const bSaved = savedViews.find((sv: any) => (sv.id || sv._id) === b.id);
            const aHasOrder = aSaved && typeof aSaved.sortOrder === 'number';
            const bHasOrder = bSaved && typeof bSaved.sortOrder === 'number';
            // Only an explicit user `sortOrder` should reorder views away from
            // the metadata-declared sequence. A bare overlay row (no sortOrder)
            // must not demote a metadata view: that would break primary-view
            // promotion (which relies on declared order) for objects whose
            // overlay seeded a baseline `sys_view` row without sort info.
            if (aHasOrder && bHasOrder) {
                if (aSaved.sortOrder !== bSaved.sortOrder) {
                    return aSaved.sortOrder - bSaved.sortOrder;
                }
                return (aSaved.created_at || '').localeCompare(bSaved.created_at || '');
            }
            if (aHasOrder) return -1;
            if (bHasOrder) return 1;
            return (indexOf.get(a.id) ?? 0) - (indexOf.get(b.id) ?? 0);
        });

        return viewList;
    }, [objectDef, savedViews, viewOverrides, t]);

    // Active View State — merge saved draft if available for this view.
    // Resolution priority: URL viewId → ?view= → user-marked default → first.
    const defaultViewId = useMemo(() => {
        const def = views.find((v: any) => v.isDefault);
        return def?.id;
    }, [views]);
    const activeViewId = viewId || searchParams.get('view') || defaultViewId || views[0]?.id;
    const baseView = views.find((v: any) => v.id === activeViewId) || views[0];
    const activeView = viewDraft && viewDraft.id === baseView?.id
        ? { ...baseView, ...viewDraft }
        : baseView;

    /** Real-time draft field update — propagates each toggle/input change immediately */
    const handleViewUpdate = useCallback((field: string, value: any) => {
        setViewDraft(prev => ({
            ...(prev || {}),
            id: baseView?.id,
            [field]: value,
        }));
    }, [baseView?.id]);

    const handleViewChange = (newViewId: string) => {
        // The plugin ObjectView returns the view ID directly via onViewChange
        const matchedView = views.find((v: any) => v.id === newViewId);
        if (!matchedView) return;
        // Auto-close the config panel only when actually switching to a
        // different view. Same-view clicks (e.g., bubbling from the actions
        // dropdown menu item) must not stomp on a freshly-opened panel.
        if (matchedView.id !== activeViewId) {
            setShowViewConfigPanel(false);
        }
        if (viewId) {
             navigate(`../${matchedView.id}`, { relative: "path" });
        } else {
             navigate(`view/${matchedView.id}`);
        }
    };

    // Mobile view switcher — registers our view list with the AppHeader so
    // the topbar can render a `<viewName> ▾` dropdown instead of the static
    // page label. Desktop ignores this (ViewTabBar handles switching there).
    const mobileViewSwitcherItems = useMemo<MobileViewSwitcherItem[]>(() => {
        return (views || []).map((view: any) => {
            const Icon = VIEW_TYPE_ICONS[view.type as keyof typeof VIEW_TYPE_ICONS];
            return {
                id: view.id,
                label: viewLabel(objectDef.name, view.name || view.id, view.label || view.name || view.id),
                icon: Icon ? <Icon className="h-4 w-4" /> : undefined,
            };
        });
    }, [views, objectDef.name, viewLabel]);
    useMobileViewSwitcherRegistration({
        views: mobileViewSwitcherItems,
        activeViewId: activeViewId ?? '',
        onChange: handleViewChange,
        enabled: mobileViewSwitcherItems.length > 0 && !!activeViewId,
    });

    // ViewSwitcher callbacks — wired to both PluginObjectView instances
    const handleCreateView = useCallback(() => {
        setShowCreateViewDialog(true);
    }, []);

    const handleViewAction = useCallback((actionType: string, viewType: string) => {
        if (actionType === 'settings') {
            const matchedView = views.find((v: { id: string; type: string }) => v.type === viewType);
            if (matchedView) handleViewChange(matchedView.id);
            setViewConfigPanelMode('edit');
            setShowViewConfigPanel(true);
        }
    }, [views, handleViewChange]);

    // ─── ViewTabBar CRUD callbacks (Phase 2) ────────────────────────────
    /** Returns true if the view is backed by a sys_view record (mutable). */
    const isSavedView = useCallback((vid: string) => {
        return savedViews.some((sv: any) => (sv.id || sv._id) === vid);
    }, [savedViews]);

    const handleRenameView = useCallback(async (vid: string, newName: string) => {
        if (!isSavedView(vid)) {
            toast.error(t('console.objectView.cannotEditMetaView') || 'Built-in views cannot be renamed.');
            return;
        }
        try {
            // Metadata overlay path — `vid` is the view's `name` field.
            if (typeof (dataSource as any)?.updateView === 'function') {
                await (dataSource as any).updateView(objectName, vid, { label: newName });
            }
            setRefreshKey(k => k + 1);
        } catch (err) {
            console.error('[ViewTabBar] Failed to rename view:', err);
            toast.error(t('objectViewActions.renameFailed'));
        }
    }, [dataSource, objectName, isSavedView, t]);

    // Promise-based confirm/param dialogs — declared early so destructive
    // handlers (delete, etc.) can `await confirmHandler(...)` for a proper
    // Airtable-style confirmation flow.
    const [confirmState, setConfirmState] = useState<ConfirmDialogState>({ open: false, message: '' });
    const [paramState, setParamState] = useState<ParamDialogState>({ open: false, params: [] });
    const [resultDialogState, setResultDialogState] = useState<ResultDialogState>({ open: false });

    const resultDialogHandler = useCallback(
        (spec: any, data: unknown) => new Promise<void>((resolve) => {
            setResultDialogState({ open: true, spec, data, resolve });
        }),
        [],
    );

    const confirmHandler = useCallback((message: string, options?: { title?: string; confirmText?: string; cancelText?: string }) => {
        return new Promise<boolean>((resolve) => {
            setConfirmState({ open: true, message, options, resolve });
        });
    }, []);

    const paramCollectionHandler = useCallback((params: ActionParamDef[], action?: any) => {
        return new Promise<Record<string, any> | null>((resolve) => {
            // List_item actions stash the row record under params._rowRecord
            // (see ObjectGrid → onRowAction). Pull it out so resolveActionParams
            // can pre-fill `defaultFromRow` params from the row's current values.
            const row = action?.params && !Array.isArray(action.params)
                ? (action.params as Record<string, any>)._rowRecord
                : undefined;
            const resolved = resolveActionParams(params as any, {
                objectName: objectName || objectDef?.name || '',
                objects: objects || [],
                fieldLabel,
                fieldOptionLabel,
                row,
            });
            setParamState({ open: true, params: resolved, resolve });
        });
    }, [objectName, objectDef, objects, fieldLabel, fieldOptionLabel]);

    const handleDeleteView = useCallback(async (vid: string) => {
        if (!dataSource) return;
        if (!isSavedView(vid)) {
            toast.error(t('console.objectView.cannotDeleteMetaView') || 'Built-in views cannot be deleted.');
            return;
        }
        const targetView = views.find((v: any) => v.id === vid);
        const viewLabel = targetView?.label || vid;
        const confirmed = await confirmHandler(
            t('console.objectView.deleteViewConfirm', { name: viewLabel }) ||
                `Are you sure you want to delete the view "${viewLabel}"? This cannot be undone.`,
            {
                title: t('console.objectView.deleteViewTitle') || 'Delete view',
                confirmText: t('console.objectView.delete') || 'Delete',
                cancelText: t('console.objectView.cancel') || 'Cancel',
            },
        );
        if (!confirmed) return;
        try {
            if (typeof (dataSource as any)?.deleteView === 'function') {
                await (dataSource as any).deleteView(objectName, vid);
            }
            // If we deleted the active view, fall back to the first remaining view.
            if (vid === activeViewId) {
                const fallback = views.find((v: any) => v.id !== vid);
                if (fallback) navigate(viewId ? `../${fallback.id}` : `view/${fallback.id}`, viewId ? { relative: 'path' } : undefined);
            }
            setRefreshKey(k => k + 1);
        } catch (err) {
            console.error('[ViewTabBar] Failed to delete view:', err);
            toast.error(t('objectViewActions.deleteFailed'));
        }
    }, [dataSource, isSavedView, activeViewId, views, viewId, navigate, t, confirmHandler]);

    const handlePinView = useCallback(async (vid: string, pinned: boolean) => {
        if (!dataSource) return;
        if (!isSavedView(vid)) {
            toast.error(t('console.objectView.cannotEditMetaView') || 'Built-in views cannot be pinned.');
            return;
        }
        try {
            if (typeof (dataSource as any)?.updateView === 'function') {
                await (dataSource as any).updateView(objectName, vid, { isPinned: pinned });
            }
            setRefreshKey(k => k + 1);
        } catch (err) {
            console.error('[ViewTabBar] Failed to pin view:', err);
        }
    }, [dataSource, objectName, isSavedView, t]);

    const handleSetDefaultView = useCallback(async (vid: string) => {
        if (!dataSource) return;
        if (!isSavedView(vid)) {
            toast.error(
                t('console.objectView.cannotEditMetaView')
                || 'System view — it cannot be set as a default.',
            );
            return;
        }
        try {
            // Clear `isDefault` on all other saved views, then set this one.
            if (typeof (dataSource as any)?.updateView !== 'function') return;
            const updateView = (dataSource as any).updateView;
            const updates = savedViews
                .filter((sv: any) => (sv.id || sv._id) !== vid && sv.isDefault)
                .map((sv: any) => updateView(objectName, sv.id || sv._id, { isDefault: false }));
            updates.push(updateView(objectName, vid, { isDefault: true }));
            await Promise.all(updates);
            setRefreshKey(k => k + 1);
        } catch (err) {
            console.error('[ViewTabBar] Failed to set default view:', err);
            toast.error('Failed to set default view');
        }
    }, [dataSource, objectName, savedViews, isSavedView, t]);

    const handleReorderViews = useCallback(async (orderedIds: string[]) => {
        // Persist order for ALL views (incl. metadata) in localStorage so the
        // UI immediately reflects the new ordering, including reorderings
        // that involve metadata-only views.
        try {
            if (typeof window !== 'undefined') {
                window.localStorage?.setItem(`viewOrder:${objectName}`, JSON.stringify(orderedIds));
            }
        } catch { /* ignore */ }
        // Best-effort: also persist `sortOrder` on each saved view so other
        // sessions / users can pick up the order from the backend.
        if (typeof (dataSource as any)?.updateView === 'function') {
            const updateView = (dataSource as any).updateView;
            const savedIdSet = new Set(savedViews.map((sv: any) => sv.id || sv._id));
            const updates = orderedIds
                .filter(id => savedIdSet.has(id))
                .map((id, idx) => updateView(objectName, id, { sortOrder: idx }));
            try {
                await Promise.all(updates);
            } catch (err) {
                console.error('[ViewTabBar] Failed to reorder views:', err);
            }
        }
        setRefreshKey(k => k + 1);
    }, [dataSource, savedViews, objectName]);

    const handleConfigView = useCallback((vid: string) => {
        // System (metadata-defined) views are read-only — opening the
        // ViewConfigPanel against one would let the user save changes that
        // never persist.
        if (!isSavedView(vid)) {
            toast.error(
                t('console.objectView.cannotEditMetaView')
                || 'System view — it cannot be edited.',
            );
            return;
        }
        if (vid !== activeViewId) handleViewChange(vid);
        setViewConfigPanelMode('edit');
        setShowViewConfigPanel(true);
    }, [activeViewId, handleViewChange, isSavedView, t]);

    const handleAddView = useCallback(() => {
        setShowCreateViewDialog(true);
    }, []);

    // ─── ActionProvider handlers for schema-driven toolbar actions ──────
    const currentUser = user
        ? { id: user.id, name: user.name, avatar: user.image }
        : FALLBACK_USER;

    const toastHandler = useCallback((message: string, options?: { type?: string }) => {
        if (options?.type === 'error') toast.error(message);
        else toast.success(message);
    }, []);

    // Action system for toolbar operations — refreshKey moved up (declared earlier).
    // Wired to confirmHandler/toastHandler so deletes use the Shadcn AlertDialog
    // and Sonner toast instead of native window.confirm.
    const actions = useObjectActions({
        objectName: objectDef.name,
        objectLabel: objectDef.label,
        dataSource,
        onEdit,
        onRefresh: () => setRefreshKey(k => k + 1),
        onConfirm: confirmHandler,
        onToast: toastHandler,
    });

    const navigateHandler = useCallback((url: string, options?: { external?: boolean; newTab?: boolean }) => {
        if (options?.external || options?.newTab) {
            window.open(url, '_blank', 'noopener,noreferrer');
        } else {
            navigate(url);
        }
    }, [navigate]);

    // Authenticated fetch for direct backend calls (e.g. flow trigger,
    // schema actions targeting absolute API paths). Declared before
    // apiHandler so the latter can close over it.
    const authFetch = useMemo(() => createAuthenticatedFetch(), []);

    const apiHandler = useCallback(async (action: ActionDef) => {
        try {
            const target = action.target || action.name;
            const params = action.params || {};

            // Absolute HTTP target (e.g. /api/v1/auth/organization/invite-member,
            // http://..., https://...) — bypass dataSource and call the API
            // directly through the authenticated fetch wrapper so:
            //   - Authorization: Bearer <token> is injected
            //   - X-Tenant-ID is injected (multi-tenant routing)
            //   - Same-origin cookies (better-auth.session_token) ride along
            //
            // This is the canonical path for schema actions on managed-by
            // tables (sys_user/invite_user, sys_session/revoke, …) where
            // generic CRUD does not apply.
            const targetStr = typeof target === 'string' ? target : '';
            const isAbsolute = targetStr.startsWith('/') || /^https?:\/\//i.test(targetStr);
            if (isAbsolute) {
                const baseUrl = import.meta.env.VITE_SERVER_URL || '';
                // Row context is stashed on params under `_rowRecord` by the
                // row-action dispatcher (see ObjectGrid → onRowAction). Pull
                // it out before assembling the request body.
                const rawParams = { ...(params as Record<string, any>) };
                const rowRecord = rawParams._rowRecord as Record<string, any> | undefined;
                delete rawParams._rowRecord;

                // Interpolate `{field}` tokens in the target URL from the
                // row record. Lets actions hit data-API endpoints like
                // `PATCH /api/v1/sys_api_key/{id}` without bespoke wiring.
                let resolvedTarget = targetStr;
                if (rowRecord && /\{[a-z_][a-z0-9_]*\}/i.test(resolvedTarget)) {
                    resolvedTarget = resolvedTarget.replace(/\{([a-z_][a-z0-9_]*)\}/gi, (_, k) => {
                        const v = rowRecord[k];
                        return v == null ? '' : encodeURIComponent(String(v));
                    });
                }
                const url = resolvedTarget.startsWith('http') ? resolvedTarget : `${baseUrl}${resolvedTarget}`;

                // Apply bodyShape: 'flat' (default) keeps user params at top
                // level; { wrap: 'data' } nests them under that key while
                // `recordIdParam` / `organizationId` stay flat (better-auth
                // organization/update semantics).
                const wrap = action.bodyShape && typeof action.bodyShape === 'object' && action.bodyShape.wrap
                    ? action.bodyShape.wrap
                    : undefined;
                const body: Record<string, any> = wrap
                    ? { [wrap]: rawParams }
                    : { ...rawParams };

                // Inject row id (or chosen row field) for list_item actions.
                if (rowRecord && action.recordIdParam) {
                    const rowField = action.recordIdField || 'id';
                    const rowValue = rowRecord[rowField];
                    if (rowValue != null) body[action.recordIdParam] = rowValue;
                }

                // Auto-inject organizationId only for better-auth org-scoped
                // endpoints. Data-API endpoints (/api/v1/{object}/{id}) must
                // NOT receive a stray organizationId field — that would try
                // to overwrite the row's tenant column.
                const isAuthOrgEndpoint = /\/api\/v1\/auth\//.test(resolvedTarget);
                if (isAuthOrgEndpoint && !body.organizationId && activeOrganization?.id) {
                    body.organizationId = activeOrganization.id;
                }

                // Merge static body fragment last so constants override any
                // user-collected values (e.g. resend:true on resend-invite,
                // revoked:true on revoke-api-key).
                if (action.bodyExtra && typeof action.bodyExtra === 'object') {
                    Object.assign(body, action.bodyExtra);
                }

                const method = (action.method || 'POST').toUpperCase();
                const init: any = {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                };
                // GET/DELETE conventionally have no body; for everything else
                // we serialize. (We don't expect GET here today, but keep the
                // guard for safety.)
                if (method !== 'GET' && method !== 'DELETE') {
                    init.body = JSON.stringify(body);
                }
                const res = await authFetch(url, init);
                if (!res.ok) {
                    let detail = `HTTP ${res.status}`;
                    try {
                        const j = await res.json();
                        detail = (j as any)?.error || (j as any)?.message || detail;
                    } catch { /* response body not JSON */ }
                    return { success: false, error: detail };
                }
                const data = await res.json().catch(() => ({}));
                if (action.refreshAfter !== false) setRefreshKey(k => k + 1);
                return { success: true, data, reload: action.refreshAfter !== false };
            }

            // Generic list-level API handler: update/execute via dataSource
            if (typeof dataSource.execute === 'function') {
                await dataSource.execute(objectDef.name, target, params);
            } else if (params.recordId && Object.keys(params).length > 1 && typeof dataSource.update === 'function') {
                await dataSource.update(objectDef.name, params.recordId, params);
            }

            const shouldRefresh = action.refreshAfter !== false;
            if (shouldRefresh) {
                setRefreshKey(k => k + 1);
            }
            return { success: true, reload: shouldRefresh };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }, [dataSource, objectDef.name, authFetch, activeOrganization]);

    // Flow action handler — POST to /api/v1/automation/{name}/trigger.
    // Triggered when an Action with `type: 'flow'` is invoked from list-level
    // locations (list_toolbar, list_item). For list_item the row's recordId is
    // expected in `action.params.recordId`.
    const flowHandler = useCallback(async (action: ActionDef) => {
        const flowName = action.target || action.name;
        if (!flowName) {
            return { success: false, error: 'No flow target provided for flow action' };
        }
        try {
            const baseUrl = import.meta.env.VITE_SERVER_URL || '';
            // Row context is stashed on params under `_rowRecord` by the row-action
            // dispatcher (ObjectGrid → onRowAction). For a list_item flow action the
            // row's id is the flow's `recordId` (e.g. the Reassign wizard targets it).
            const params = { ...(action.params || {}) } as Record<string, any>;
            const rowRecord = params._rowRecord as Record<string, any> | undefined;
            delete params._rowRecord;
            const recordId = params.recordId ?? rowRecord?.id;
            if (recordId != null && params.recordId == null) params.recordId = recordId;
            const res = await authFetch(
                `${baseUrl}/api/v1/automation/${encodeURIComponent(flowName)}/trigger`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recordId,
                        objectName: objectDef.name,
                        params,
                    }),
                },
            );
            const json = await res.json().catch(() => null);
            if (!res.ok || (json && json.success === false)) {
                const errMsg = json?.error || `Flow "${flowName}" failed (HTTP ${res.status})`;
                return { success: false, error: errMsg };
            }
            // Screen-flow runtime: the run paused at a `screen` node awaiting
            // input — open the FlowRunner to render the form + resume. Refresh
            // happens when the FlowRunner completes, not now.
            const data = json?.data ?? {};
            if (data.status === 'paused' && data.screen) {
                setScreenFlow({ flowName, runId: data.runId, screen: data.screen });
                return { success: true };
            }
            const shouldRefresh = action.refreshAfter !== false;
            if (shouldRefresh) {
                setRefreshKey(k => k + 1);
            }
            return { success: true, data: json?.data, reload: shouldRefresh };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }, [authFetch, objectDef.name]);

    // Server-side action handler — POST to /api/v1/actions/{object}/{action}.
    // For list-toolbar/list-item `script` and `modal` actions whose `target`
    // matches a server-registered handler. selectedIds (from action.params)
    // is forwarded so bulk handlers like massUpdateStage / addToCampaign work.
    const serverActionHandler = useCallback(async (action: ActionDef) => {
        const targetName = action.target || action.name;
        if (!targetName) {
            return { success: false, error: 'No action target provided' };
        }
        const params = (action.params && !Array.isArray(action.params))
            ? { ...(action.params as Record<string, unknown>) }
            : {};
        // Row-action path stashes the row under `_rowRecord` (ObjectGrid →
        // onRowAction) but ActionRunner doesn't set `recordId` for `script`
        // handlers — derive it from the row so list_item actions (e.g. "Open"
        // on an environment row) resolve their target record. Strip
        // `_rowRecord` from the sent body.
        const _rowRecord = (params as any)._rowRecord as Record<string, any> | undefined;
        delete (params as any)._rowRecord;
        const recordIdField = (action as any).recordIdField || 'id';
        const resolvedRecordId = (params as any).recordId ?? _rowRecord?.[recordIdField];

        // ── Popup-blocker workaround (mirrors RecordDetailView) ───────────
        // When `action.opensInNewTab` is set, the handler returns
        // `{ redirectUrl }` for the UI to navigate to. Pre-open `about:blank`
        // synchronously *before* the await so the user-gesture context is
        // preserved and Chrome/Safari don't block the eventual navigation —
        // without this, the post-await window.open() on the row-action path
        // is dropped as an unsolicited popup. Falls back to navigating the
        // current tab if the pre-open is itself blocked.
        let preOpenedTab: Window | null = null;
        if ((action as any).opensInNewTab) {
            // NOTE: no 'noopener' — per spec it forces window.open to return
            // null even when the tab opens, losing the handle so we'd fall
            // through to the popup branch and navigate the *current* (list)
            // tab to the redirectUrl (double-navigation bug). We need the
            // reference to drive the pre-opened tab to the SSO redirect.
            try { preOpenedTab = window.open('about:blank', '_blank'); } catch { preOpenedTab = null; }
        }
        try {
            const baseUrl = import.meta.env.VITE_SERVER_URL || '';
            const obj = action.objectName || objectDef.name || 'global';
            const res = await authFetch(
                `${baseUrl}/api/v1/actions/${encodeURIComponent(obj)}/${encodeURIComponent(targetName)}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recordId: resolvedRecordId, params }),
                },
            );
            const json = await res.json().catch(() => null);
            if (!res.ok || (json && json.success === false)) {
                const errMsg = json?.error || `Action "${targetName}" failed (HTTP ${res.status})`;
                if (preOpenedTab) { try { preOpenedTab.close(); } catch { /* ignore */ } }
                // Surface the failure — this custom new-tab path bypasses
                // ActionRunner's toast-on-error, so without this the user sees
                // nothing (e.g. "Open" hitting a 503 looked like a dead button).
                toast.error(errMsg);
                return { success: false, error: errMsg };
            }
            const shouldRefresh = action.refreshAfter !== false;
            if (shouldRefresh) setRefreshKey(k => k + 1);
            const data = json?.data;
            // `{ redirectUrl }` convention: drive the pre-opened tab to it
            // (popup-safe); otherwise open lazily, falling back to the current
            // tab if blocked so the user always reaches the destination.
            const redirectUrl = (data && typeof data === 'object' && typeof (data as any).redirectUrl === 'string')
                ? (data as any).redirectUrl as string
                : null;
            if (redirectUrl) {
                if (preOpenedTab) {
                    try { preOpenedTab.location.href = redirectUrl; }
                    catch {
                        try { preOpenedTab.close(); } catch { /* ignore */ }
                        window.location.href = redirectUrl;
                    }
                } else {
                    let popup: Window | null = null;
                    // No 'noopener' so a successful open returns a truthy
                    // handle; with it the null return would always trip the
                    // current-tab fallback below.
                    try { popup = window.open(redirectUrl, '_blank'); } catch { popup = null; }
                    if (!popup) window.location.href = redirectUrl;
                }
            } else if (preOpenedTab) {
                // opensInNewTab declared but no redirectUrl came back — don't
                // leave a dangling blank tab.
                try { preOpenedTab.close(); } catch { /* ignore */ }
            }
            return { success: true, data, reload: shouldRefresh };
        } catch (error) {
            if (preOpenedTab) { try { preOpenedTab.close(); } catch { /* ignore */ } }
            const msg = (error as Error).message;
            toast.error(msg);
            return { success: false, error: msg };
        }
    }, [authFetch, objectDef.name]);

    // Real-time: auto-refresh when server reports data changes
    const { lastMessage: realtimeMessage } = useRealtimeSubscription({
        channel: `object:${objectDef.name}`,
    });

    // Conflict resolution: detect and queue conflicts on reconnection
    const conflictUserId = objectDef.name ? `user-${objectDef.name}` : 'current-user';
    const { hasConflicts, resolveAllConflicts } = useConflictResolution(conflictUserId);

    useEffect(() => {
        if (realtimeMessage) {
            // On reconnection data change, auto-resolve with server-wins strategy
            if (hasConflicts) {
                resolveAllConflicts('remote');
            }
            setRefreshKey(k => k + 1);
        }
    }, [realtimeMessage, hasConflicts, resolveAllConflicts]);
    
    // Fetch record count for footer display
    useEffect(() => {
        if (dataSource?.find && objectDef.name) {
            dataSource.find(objectDef.name, { limit: 0 }).then((result: any) => {
                if (typeof result?.total === 'number') {
                    setRecordCount(result.total);
                } else if (Array.isArray(result?.data)) {
                    setRecordCount(result.data.length);
                } else if (Array.isArray(result)) {
                    setRecordCount(result.length);
                }
            }).catch(() => {
                // Silently ignore — record count is non-critical
            });
        }
    }, [dataSource, objectDef.name, refreshKey]);

    // Navigation overlay for record detail (supports drawer/modal/split/popover via config)
    // Priority: activeView.navigation > objectDef.navigation > default drawer.
    //
    // Default mode = 'drawer'. Mirrors Linear / Notion / Airtable / Jira where
    // record peek is the primary interaction and full-page is the upgrade.
    // Direct URL access (`/record/:id`) still opens as a full page because
    // RecordDetailView owns its own route — only same-page click navigation
    // is drawer-by-default. Per-view config can still override (e.g. a heavy
    // detail object can set `navigation.mode = 'page'`).
    const detailNavigation: ViewNavigationConfig = useMemo(
        () =>
            activeView?.navigation ??
            objectDef.navigation ?? { mode: 'drawer', width: 'min(92vw, 1280px)' },
        [activeView?.navigation, objectDef.navigation]
    );
    const drawerRecordId = searchParams.get('recordId');

    /**
     * URL-derived equality filters in the form `?filter[<field>]=<value>`.
     * Used by related-list "View All" buttons to scope the destination list
     * to a single parent record. Emitted as ObjectQL triples (`[field, '=', value]`)
     * which matches the shape consumed by the list view's data fetcher when
     * merging base filters.
     */
    const urlFilters = useMemo(() => {
        const out: Array<[string, string, any]> = [];
        searchParams.forEach((value, key) => {
            const m = /^filter\[(.+)\]$/.exec(key);
            if (m && m[1] && value !== '') {
                out.push([m[1], '=', value]);
            }
        });
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams.toString()]);
    // Memoize onNavigate to prevent stale closure in useNavigationOverlay's handleClick
    const handleNavOverlayNavigate = useCallback(
        (recordId: string | number, action?: string) => {
            if (action === 'new_window') {
                // Open record detail in a new browser tab with Console-correct URL
                const basePath = window.location.pathname.replace(/\/view\/.*$/, '');
                window.open(`${basePath}/record/${encodeURIComponent(String(recordId))}`, '_blank');
                return;
            }
            // Default: navigate to record detail page.
            // `action` may be 'view' / 'page' / undefined, OR a custom view name
            // forwarded from `navigation.view` (e.g. 'detail_form'). The view
            // variant is resolved by RecordDetailView from its own config, so
            // any non-`new_window` action lands on the record detail route.
            const originState = {
              from: {
                pathname: location.pathname + (location.search || ''),
                label: viewLabel(objectDef.name, activeView?.name ?? '', activeView?.label ?? '') || objectLabel(objectDef),
              },
            };
            if (viewId) {
                navigate(`../../record/${encodeURIComponent(String(recordId))}`, { relative: 'path', state: originState });
            } else {
                navigate(`record/${encodeURIComponent(String(recordId))}`, { state: originState });
            }
        },
        [navigate, viewId, location.pathname, location.search, objectDef, activeView?.name, activeView?.label, viewLabel, objectLabel]
    );
    const navOverlay = useNavigationOverlay({
        navigation: detailNavigation,
        objectName: objectDef.name,
        onNavigate: handleNavOverlayNavigate,
    });
    const handleDrawerClose = () => {
        navOverlay.close();
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('recordId');
        setSearchParams(newParams);
    };
    /**
     * Row-click handler used by all list/grid/gallery/kanban surfaces inside
     * this object view. Wraps `navOverlay.handleClick` so that drawer-mode
     * opens are URL-driven (writes `?recordId=…`) — making the drawer state
     * shareable, refresh-safe, and respected by browser back/forward. The
     * URL→state sync effect below handles actually opening the drawer.
     */
    const handleRowClick = useCallback(
        (record: any, event?: React.MouseEvent | { metaKey?: boolean; ctrlKey?: boolean; button?: number }) => {
            // Cmd/Ctrl/middle-click — let the hook open in a new tab (full page)
            // regardless of configured mode. Matches browser link convention.
            const isModifier = !!(
                event && ((event as any).metaKey || (event as any).ctrlKey || (event as any).button === 1)
            );
            if (isModifier) {
                navOverlay.handleClick(record, event as any);
                return;
            }
            // Drawer mode → URL is the source of truth. Push `?recordId=…`
            // and let the existing URL-sync effect open the overlay.
            if (navOverlay.mode === 'drawer') {
                const id = (record?.id ?? record?._id) as string | number | undefined;
                if (id != null) {
                    const next = new URLSearchParams(searchParams);
                    next.set('recordId', String(id));
                    setSearchParams(next);
                    return;
                }
            }
            // All other modes (page / modal / split / popover / new_window / none)
            // — delegate to the hook.
            navOverlay.handleClick(record, event as any);
        },
        [navOverlay, searchParams, setSearchParams]
    );
    /**
     * "Expand to full page" — invoked from the drawer header chevron. Closes
     * the drawer (which clears `?recordId=…`) and router-pushes to the
     * dedicated `/record/:id` route. Mirrors Linear/Notion peek-to-page.
     */
    const handleExpandDrawer = useCallback(() => {
        const rec = navOverlay.selectedRecord as Record<string, unknown> | null;
        const id = rec && ((rec as any).id ?? (rec as any)._id);
        if (id == null) return;
        handleDrawerClose();
        handleNavOverlayNavigate(id as string | number);
    }, [navOverlay.selectedRecord, handleNavOverlayNavigate]);
    // Sync URL-based recordId to overlay state
    useEffect(() => {
        if (drawerRecordId && !navOverlay.isOpen) {
            navOverlay.open({ id: drawerRecordId });
        } else if (!drawerRecordId && navOverlay.isOpen) {
            navOverlay.close();
        }
    }, [drawerRecordId]);

    // Render multi-view content via ListView plugin (for kanban, calendar, etc.)
    const renderListView = useCallback(({ schema: listSchema, dataSource: ds, onEdit: editHandler, className, refreshKey: pluginRefreshKey }: any) => {
        // Combine local refreshKey with the plugin ObjectView's refreshKey for full propagation
        const combinedRefreshKey = refreshKey + (pluginRefreshKey || 0);
        const key = `${objectName}-${activeView.id}-${combinedRefreshKey}`;
        const viewDef = activeView;

        // Warn in dev mode if flat properties are used instead of nested spec format
        if (process.env.NODE_ENV === 'development') {
            const flatKeys = ['startDateField', 'endDateField', 'dateField', 'groupBy', 'groupField',
                'locationField', 'imageField', 'chartType', 'xAxisField', 'dependenciesField',
                'progressField', 'colorField', 'allDayField', 'subjectField', 'endField',
                'latitudeField', 'longitudeField', 'zoom', 'center', 'cardFields', 'subtitleField',
                'descriptionField', 'yAxisFields', 'aggregation', 'series'];
            const nestedConfig = (viewDef as any)[viewDef.type] || {};
            const found = flatKeys.filter(k => k in viewDef && !(k in nestedConfig));
            if (found.length > 0) {
                console.warn(
                    `[Spec Compliance] View "${viewDef.id}" uses flat properties ${JSON.stringify(found)}. ` +
                    `Move them under viewDef.${viewDef.type || '<type>'} per @objectstack/spec protocol.`
                );
            }
        }

        if (viewDef.type === 'chart') {
            const chartConfig = viewDef.chart || {};
            // ObjectChart consumes a structured `aggregate` ({ field, function,
            // groupBy }) + `xAxisKey` + `series`, NOT the flat spec-level
            // `xAxisField`/`yAxisFields`/`aggregation` keys. Translate here so the
            // chart actually runs its aggregate query (otherwise it renders empty).
            const categoryField = chartConfig.xAxisField || 'name';
            const valueField =
                (Array.isArray(chartConfig.yAxisFields) && chartConfig.yAxisFields[0]) || 'value';
            const aggFn = chartConfig.aggregation || 'count';
            const series =
                chartConfig.series && chartConfig.series.length > 0
                    ? chartConfig.series
                    : [{ dataKey: valueField, label: valueField }];
            return (
                <Suspense key={key} fallback={<div className="p-4 text-sm text-muted-foreground">Loading chart…</div>}>
                    <ObjectChart
                        dataSource={ds}
                        schema={{
                            type: 'object-chart',
                            objectName: objectDef.name,
                            chartType: chartConfig.chartType || 'bar',
                            aggregate: {
                                field: valueField,
                                function: aggFn,
                                groupBy: categoryField,
                            },
                            xAxisKey: categoryField,
                            series,
                            config: chartConfig.config,
                            filter: chartConfig.filter,
                            className: 'h-[400px] w-full',
                        } as any}
                    />
                </Suspense>
            );
        }

        const fullSchema: ListViewSchema = {
            ...listSchema,
            // Propagate appearance/view-config properties for live preview
            rowHeight: viewDef.rowHeight ?? listSchema.rowHeight,
            densityMode: viewDef.densityMode ?? listSchema.densityMode,
            // Hydrate persisted user preferences so they survive reload
            // (Airtable-style per-view personal config). All four below go
            // through the same persistViewPatch helper which debounces and
            // batches concurrent toggles.
            sort: (viewDef as any).sort ?? listSchema.sort,
            filter: (() => {
                const base = (viewDef as any).filter ?? listSchema.filter;
                const substituted = substituteFilterTokens(base, currentUser.id);
                if (!urlFilters.length) return substituted;
                const baseArr = Array.isArray(substituted) ? substituted : [];
                return [...baseArr, ...urlFilters];
            })(),
            hiddenFields: (viewDef as any).hiddenFields ?? listSchema.hiddenFields,
            columnState: (viewDef as any).columnState ?? (listSchema as any).columnState,
            onDensityChange: (mode) => {
                persistViewPatch(viewDef.id, viewDef, { densityMode: mode });
            },
            onSortChange: (sort: any) => {
                persistViewPatch(viewDef.id, viewDef, { sort });
            },
            onFilterChange: (filter: any) => {
                persistViewPatch(viewDef.id, viewDef, { filter });
            },
            onHiddenFieldsChange: (hidden: string[]) => {
                persistViewPatch(viewDef.id, viewDef, { hiddenFields: hidden });
            },
            onColumnStateChange: (state: { order?: string[]; widths?: Record<string, number> }) => {
                persistViewPatch(viewDef.id, viewDef, { columnState: state });
            },
            inlineEdit: viewDef.inlineEdit ?? viewDef.editRecordsInline ?? listSchema.inlineEdit,
            appearance: viewDef.showDescription != null
                ? { showDescription: viewDef.showDescription }
                : listSchema.appearance,
            // Propagate toolbar/display flags for all view types
            showSearch: viewDef.showSearch ?? listSchema.showSearch,
            showSort: viewDef.showSort ?? listSchema.showSort,
            showFilters: viewDef.showFilters ?? listSchema.showFilters,
            showHideFields: viewDef.showHideFields ?? listSchema.showHideFields,
            showGroup: viewDef.showGroup ?? listSchema.showGroup,
            showColor: viewDef.showColor ?? listSchema.showColor,
            showDensity: viewDef.showDensity ?? listSchema.showDensity,
            allowExport: viewDef.allowExport ?? listSchema.allowExport,
            exportOptions: viewDef.allowExport === false ? undefined : (viewDef.exportOptions ?? listSchema.exportOptions),
            striped: viewDef.striped ?? listSchema.striped,
            bordered: viewDef.bordered ?? listSchema.bordered,
            color: viewDef.color ?? listSchema.color,
            // Propagate view-config properties (Bug 4 / items 14-22)
            wrapHeaders: viewDef.wrapHeaders ?? listSchema.wrapHeaders,
            clickIntoRecordDetails: viewDef.clickIntoRecordDetails ?? listSchema.clickIntoRecordDetails,
            addRecordViaForm: viewDef.addRecordViaForm ?? listSchema.addRecordViaForm,
            addDeleteRecordsInline: viewDef.addDeleteRecordsInline ?? listSchema.addDeleteRecordsInline,
            collapseAllByDefault: viewDef.collapseAllByDefault ?? listSchema.collapseAllByDefault,
            fieldTextColor: viewDef.fieldTextColor ?? listSchema.fieldTextColor,
            prefixField: viewDef.prefixField ?? listSchema.prefixField,
            showDescription: viewDef.showDescription ?? listSchema.showDescription,
            // Propagate new spec properties (P0/P1/P2)
            navigation: viewDef.navigation ?? listSchema.navigation,
            selection: viewDef.selection ?? listSchema.selection,
            pagination: viewDef.pagination ?? listSchema.pagination,
            searchableFields: viewDef.searchableFields ?? listSchema.searchableFields,
            filterableFields: viewDef.filterableFields ?? listSchema.filterableFields,
            resizable: viewDef.resizable ?? listSchema.resizable,
            rowActions: viewDef.rowActions ?? listSchema.rowActions,
            /**
             * Row-context action definitions derived from `objectDef.actions`
             * filtered by `locations.includes('list_item')`. These are full
             * `ActionDef` records (with label/icon/variant/params/recordIdParam
             * /bodyShape) the row menu renders with i18n-correct labels and
             * dispatches via the action runner; legacy `rowActions: string[]`
             * remains for back-compat where the action lives elsewhere.
             */
            rowActionDefs: (Array.isArray((objectDef as any)?.actions)
                ? (objectDef as any).actions
                    .filter((a: any) =>
                      Array.isArray(a?.locations) && a.locations.includes('list_item'))
                    // Localize label / confirm / success the same way the
                    // record_header and list_toolbar paths do — the row kebab
                    // previously rendered raw English `a.label`. The `visible`
                    // CEL is forwarded untouched (spread) and evaluated per-row
                    // at render time inside RowActionMenu.
                    .map((a: any) => ({
                      ...a,
                      label: actionLabel(objectDef.name, a.name, a.label || a.name),
                      ...(a.confirmText !== undefined && {
                        confirmText: actionConfirm(objectDef.name, a.name, a.confirmText),
                      }),
                      ...(a.successMessage !== undefined && {
                        successMessage: actionSuccess(objectDef.name, a.name, a.successMessage),
                      }),
                    }))
                : []),
            bulkActions: viewDef.bulkActions ?? listSchema.bulkActions,
            bulkActionDefs: (viewDef as any).bulkActionDefs ?? (listSchema as any).bulkActionDefs,
            sharing: viewDef.sharing ?? listSchema.sharing,
            addRecord: viewDef.addRecord ?? listSchema.addRecord,
            conditionalFormatting: viewDef.conditionalFormatting ?? listSchema.conditionalFormatting,
            quickFilters: viewDef.quickFilters ?? listSchema.quickFilters,
            userFilters: viewDef.userFilters ?? listSchema.userFilters,
            showRecordCount: viewDef.showRecordCount ?? listSchema.showRecordCount,
            allowPrinting: viewDef.allowPrinting ?? listSchema.allowPrinting,
            virtualScroll: viewDef.virtualScroll ?? listSchema.virtualScroll,
            emptyState:
                viewEmptyState(
                    objectDef.name,
                    viewDef.name || viewDef.id || '',
                    viewDef.emptyState
                        ?? listSchema.emptyState
                        ?? resolveManagedByEmptyState((objectDef as any)?.managedBy),
                ),
            aria: viewDef.aria ?? listSchema.aria,
            tabs: listSchema.tabs,
            // Propagate filter/sort as default filters/sort for data flow
            ...((() => {
                const combined = [
                    ...(Array.isArray(viewDef.filter) ? viewDef.filter : []),
                    ...urlFilters,
                ];
                const substituted = substituteFilterTokens(combined, currentUser.id);
                return Array.isArray(substituted) && substituted.length ? { filters: substituted } : {};
            })()),
            ...(viewDef.sort?.length ? { sort: viewDef.sort } : {}),
            options: {
                kanban: {
                    groupBy: viewDef.kanban?.groupByField || viewDef.kanban?.groupField || 'status',
                    groupField: viewDef.kanban?.groupByField || viewDef.kanban?.groupField || 'status',
                    titleField: viewDef.kanban?.titleField || objectDef.titleField || 'name',
                    cardFields: viewDef.kanban?.columns,
                },
                calendar: {
                    startDateField: viewDef.calendar?.startDateField || 'due_date',
                    endDateField: viewDef.calendar?.endDateField,
                    titleField: viewDef.calendar?.titleField || 'name',
                    colorField: viewDef.calendar?.colorField,
                    allDayField: viewDef.calendar?.allDayField,
                    defaultView: viewDef.calendar?.defaultView,
                },
                timeline: {
                    dateField: viewDef.timeline?.dateField || 'due_date',
                    titleField: viewDef.timeline?.titleField || objectDef.titleField || 'name',
                    descriptionField: viewDef.timeline?.descriptionField,
                },
                map: {
                    locationField: viewDef.map?.locationField,
                    titleField: viewDef.map?.titleField || objectDef.titleField || 'name',
                    latitudeField: viewDef.map?.latitudeField,
                    longitudeField: viewDef.map?.longitudeField,
                    zoom: viewDef.map?.zoom,
                    center: viewDef.map?.center,
                },
                gallery: {
                    // Spread the full view-defined gallery first so spec
                    // fields (cardSize, visibleFields, coverField, coverFit)
                    // make it through; then layer legacy field aliases that
                    // ObjectGallery still consults.
                    ...(viewDef.gallery || {}),
                    imageField: viewDef.gallery?.imageField || viewDef.gallery?.coverField || 'image',
                    coverField: viewDef.gallery?.coverField || viewDef.gallery?.imageField,
                    titleField: viewDef.gallery?.titleField || objectDef.titleField || 'name',
                    subtitleField: viewDef.gallery?.subtitleField,
                },
                gantt: {
                    startDateField: viewDef.gantt?.startDateField || 'start_date',
                    endDateField: viewDef.gantt?.endDateField || 'end_date',
                    titleField: viewDef.gantt?.titleField || 'name',
                    progressField: viewDef.gantt?.progressField,
                    dependenciesField: viewDef.gantt?.dependenciesField,
                    colorField: viewDef.gantt?.colorField,
                },
                chart: {
                    chartType: viewDef.chart?.chartType,
                    xAxisField: viewDef.chart?.xAxisField,
                    yAxisFields: viewDef.chart?.yAxisFields,
                    aggregation: viewDef.chart?.aggregation,
                    series: viewDef.chart?.series,
                    config: viewDef.chart?.config,
                },
            },
        };

        return (
            <ListView
                key={key}
                schema={fullSchema}
                className={className}
                onEdit={editHandler}
                onDelete={(record: any) => {
                    if (record?.id != null) {
                        // useObjectActions.deleteRecord wraps execute() which
                        // already shows a confirmation dialog + success toast
                        // and triggers onRefresh on success.
                        actions.deleteRecord(String(record.id));
                    }
                }}
                onBulkDelete={(records: any[]) => {
                    const valid = records.filter((r: any) => r?.id != null);
                    if (valid.length === 0) return;
                    // Route through actions.execute so the shared AlertDialog
                    // confirms once for the whole batch and the existing
                    // delete handler (now batch-aware) handles refresh + toast.
                    actions.execute({
                        type: 'delete',
                        confirmText: t('console.objectView.bulkDeleteConfirm', {
                            count: valid.length,
                            defaultValue: `Delete ${valid.length} selected records? This cannot be undone.`,
                        }),
                        params: { records: valid },
                    });
                }}
                onRowClick={(record: any, event?: any) => {
                    handleRowClick(record, event);
                }}
                onSortChange={(sort: any) => {
                    persistViewPatch(viewDef.id, viewDef, { sort });
                }}
                onFilterChange={(filter: any) => {
                    persistViewPatch(viewDef.id, viewDef, { filter });
                }}
                onHiddenFieldsChange={(hidden: string[]) => {
                    persistViewPatch(viewDef.id, viewDef, { hiddenFields: hidden });
                }}
                onColumnStateChange={(state: { order?: string[]; widths?: Record<string, number> }) => {
                    persistViewPatch(viewDef.id, viewDef, { columnState: state });
                }}
                dataSource={ds}
            />
        );
    }, [activeView, objectDef, objectName, refreshKey, navOverlay, actions, persistViewPatch, urlFilters]);

    // Memoize the merged views array so PluginObjectView doesn't get a new
    // reference on every render (which would trigger unnecessary data refetches).
    const mergedViews = useMemo(() =>
        views.map((v: any) =>
            v.id === activeViewId && viewDraft && viewDraft.id === v.id
                ? { ...v, ...viewDraft }
                : v
        ),
        [views, activeViewId, viewDraft]
    );

    // Build the ObjectViewSchema for the plugin — reads from activeView (which merges draft)
    const objectViewSchema = useMemo(() => ({
        type: 'object-view' as const,
        objectName: objectDef.name,
        layout: 'page' as const,
        showSearch: activeView?.showSearch !== false,
        showFilters: activeView?.showFilters !== false,
        showSort: activeView?.showSort !== false,
        showCreate: false, // We render our own create button in the header
        showRefresh: true,
        allowCreateView: isAdmin,
        viewActions: isAdmin ? [
            { type: 'settings' as const },
            { type: 'share' as const },
            { type: 'delete' as const },
        ] : [],
        onNavigate: (recordId: string | number, mode: 'view' | 'edit') => {
            if (mode === 'edit') {
                onEdit?.({ id: recordId });
            } else if (mode === 'view') {
                const originState = {
                  from: {
                    pathname: location.pathname + (location.search || ''),
                    label: viewLabel(objectDef.name, activeView?.name ?? '', activeView?.label ?? '') || objectLabel(objectDef),
                  },
                };
                if (viewId) {
                    navigate(`../../record/${encodeURIComponent(String(recordId))}`, { relative: 'path', state: originState });
                } else {
                    navigate(`record/${encodeURIComponent(String(recordId))}`, { state: originState });
                }
            }
        },
    }), [objectDef, onEdit, activeView?.showSearch, activeView?.showFilters, activeView?.showSort, activeView?.name, activeView?.label, navigate, viewId, isAdmin, location.pathname, location.search, viewLabel, objectLabel]);

    return (
        <ActionProvider
            context={{
                objectName: objectDef.name,
                user: currentUser,
                // Backend origin — lets `type: 'url'` actions issue
                // full-page navigations to API endpoints (e.g.
                // better-auth's `/sign-in/social`) even when the SPA
                // and API are on different origins in dev.
                apiBase: (import.meta as any).env?.VITE_SERVER_URL || '',
                // Expose active org so `type: 'url'` actions can template
                // `/organizations/${activeOrganization.slug}/...` etc.
                activeOrganization: activeOrganization
                  ? { id: activeOrganization.id, slug: activeOrganization.slug, name: activeOrganization.name }
                  : null,
            }}
            onConfirm={confirmHandler}
            onToast={toastHandler}
            onNavigate={navigateHandler}
            onParamCollection={paramCollectionHandler}
            onResultDialog={resultDialogHandler}
            handlers={{ api: apiHandler, flow: flowHandler, script: serverActionHandler, modal: serverActionHandler }}
        >
        <div className="h-full flex flex-col bg-background min-w-0 overflow-hidden">
             {/* 1. Header with breadcrumb + description.
                 The managed-by badge sits inline with the title so the
                 lifecycle bucket (system / config / append-only /
                 better-auth) is communicated at a glance; the previous
                 full-width banner was deliberately removed because it
                 (a) leaked engine-internal terminology and (b) repeated
                 itself on list/detail/form for the same record.

                 Mobile: hide the entire PageHeader. The title is already
                 surfaced in the top bar (e.g. "线索"), so re-rendering
                 the icon-pill + title again wastes ~60px of viewport
                 chrome that real-app conventions (Gmail / Notion / Linear)
                 reclaim for content. The create / import / overflow
                 actions move to a floating action button (see below). */}
             <div className="hidden sm:block">
             <PageHeader
                 title={
                   <span className="inline-flex items-center gap-2">
                     <span className="truncate">{objectLabel(objectDef)}</span>
                     <ManagedByBadge managedBy={(objectDef as any)?.managedBy} />
                   </span>
                 }
                 description={objectDef.description ? objectDesc(objectDef) : undefined}
                 icon={(() => { const I = getIcon((objectDef as any)?.icon); return <I className="h-4 w-4" />; })()}
                 actions={
                   <>
                    {/* Favorite toggle */}
                    {objectName && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleFavorite({
                          id: `object:${objectName}`,
                          label: objectLabel(objectDef),
                          href: `/apps/${appName}/${objectName}`,
                          type: 'object',
                        })}
                        className="h-8 sm:h-9 px-2"
                        aria-pressed={isFavorite(`object:${objectName}`)}
                        aria-label={isFavorite(`object:${objectName}`)
                          ? t('common.removeFromFavorites', { defaultValue: 'Remove from favorites' })
                          : t('common.addToFavorites', { defaultValue: 'Add to favorites' })}
                        data-testid={`object-favorite-btn-${objectName}`}
                      >
                        {isFavorite(`object:${objectName}`)
                          ? <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          : <StarOff className="h-4 w-4" />}
                      </Button>
                    )}

                    {/* Primary action - always visible */}
                    {affordances.create && can(objectDef.name, 'create') && (
                    <Button size="sm" onClick={actions.create} className="shadow-none gap-1.5 sm:gap-2 h-8 sm:h-9">
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('console.objectView.new')}</span>
                    </Button>
                    )}

                    {/* Data import — desktop only on phones. CSV imports
                        are inherently a desk/laptop workflow; the button
                        was eating header space on mobile next to the
                        primary "+" action. */}
                    {affordances.import && can(objectDef.name, 'create') && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowImport(true)}
                        className="hidden sm:inline-flex shadow-none gap-1.5 sm:gap-2 h-8 sm:h-9"
                        title={t('console.objectView.importTitle')}
                        data-testid="object-view-import-button"
                    >
                        <Upload className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('console.objectView.import')}</span>
                    </Button>
                    )}

                    {/* Schema-driven toolbar actions */}
                    {objectDef.actions?.some((a: any) => a.locations?.includes('list_toolbar')) && (
                      <SchemaRenderer schema={{
                        type: 'action:bar',
                        location: 'list_toolbar',
                        actions: (objectDef.actions || []).map((a: any) => ({
                          ...a,
                          label: actionLabel(objectDef.name, a.name, a.label || a.name),
                          ...(a.confirmText !== undefined && {
                            confirmText: actionConfirm(objectDef.name, a.name, a.confirmText),
                          }),
                          ...(a.successMessage !== undefined && {
                            successMessage: actionSuccess(objectDef.name, a.name, a.successMessage),
                          }),
                        })),
                        size: 'sm',
                        variant: 'outline',
                        // On mobile, collapse all schema-driven toolbar actions
                        // into a single overflow menu so the icon-only New /
                        // Import buttons stay visible without pushing the page
                        // title off-screen.
                        mobileMaxVisible: 0,
                      }} />
                    )}

                    {/*
                       Design Tools dropdown removed — its items were redundant:
                       - "Edit view"  → use chevron menu's "Edit view config"
                       - "Add view"   → use the `+` button on the tab bar or the "Add new view" footer in Manage Views
                       - "Metadata inspector" → still toggleable via the `?__debug` URL flag (see useMetadataInspector)
                    */}
                   </>
                 }
             />
             </div>

             {/* Floating "+" action button — phone-only counterpart to the
                 PageHeader's primary create action we just hid. Positioned
                 above the bottom mobile-nav (h-12 + safe-area) so it
                 doesn't collide with it. Hidden on tablets/desktops
                 because the inline header button is already visible. */}
             {affordances.create && can(objectDef.name, 'create') && (
               <button
                 type="button"
                 onClick={actions.create}
                 className="sm:hidden fixed right-4 bottom-36 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform inline-flex items-center justify-center"
                 aria-label={t('console.objectView.new')}
                 data-testid="mobile-fab-create"
               >
                 <Plus className="h-5 w-5" />
               </button>
             )}

             {/* CSV Import wizard (lazy-loaded) — opened from the toolbar
                 button above. On completion we bump refreshKey to re-fetch
                 the list so newly-imported rows show up. */}
             {showImport && (
               <Suspense fallback={null}>
                 <ImportWizard
                   open={showImport}
                   onOpenChange={setShowImport}
                   objectName={objectDef.name}
                   objectLabel={objectLabel(objectDef)}
                   fields={Object.entries(objectDef.fields || {}).map(([name, def]: [string, any]) => ({
                     name,
                     label: def?.label || name,
                     type: def?.type || 'text',
                     required: !!def?.required,
                   }))}
                   dataSource={dataSource}
                   onComplete={(result) => {
                     setRefreshKey(k => k + 1);
                     const ok = result.importedRows;
                     const skip = result.skippedRows;
                     if (skip > 0) {
                       toast.warning(t('console.objectView.importedWithSkipped', { ok, skipped: skip }));
                     } else if (ok > 0) {
                       toast.success(t('console.objectView.importedToast', { count: ok }));
                     }
                   }}
                 />
               </Suspense>
             )}

             {/* View Tabs — Airtable-style switcher with rename / delete /
                 duplicate / pin / set-default / drag-reorder. Built-in views
                 (sourced from objectDef.listViews) only support switching;
                 mutating callbacks short-circuit with a toast. */}
             {views.length >= 1 && (() => {
               const viewTabItems: ViewTabItem[] = views.map((view: any) => {
                 const saved = savedViews.find((sv: any) => (sv.id || sv._id) === view.id);
                 // System views (loaded from objectDef.listViews / metadata) are
                 // *read-only*. Only sys_view-backed records can be mutated by
                 // the user; admins must duplicate a system view to customize it.
                 const isSystem = !saved;
                 return {
                   id: view.id,
                   label: viewLabel(objectDef.name, view.name || view.id, view.label || view.name || view.id),
                   type: view.type,
                   hasActiveFilters: Array.isArray(view.filter) && view.filter.length > 0,
                   hasActiveSort: Array.isArray(view.sort) && view.sort.length > 0,
                   isDefault: !!(saved?.isDefault ?? view.isDefault),
                   isPinned: !!(saved?.isPinned ?? view.isPinned),
                   visibility: saved?.visibility ?? view.visibility,
                   readonly: isSystem,
                   readonlyReason: isSystem
                     ? (t('console.objectView.systemViewReadonly')
                       || 'System view defined in code — read-only.')
                     : undefined,
                 } as ViewTabItem;
               });
               return (
               <>
               <div className="hidden sm:block border-b px-3 sm:px-4 bg-background overflow-x-auto shrink-0">
                 <ViewTabBar
                   views={viewTabItems}
                   activeViewId={activeViewId}
                   onViewChange={handleViewChange}
                   viewTypeIcons={VIEW_TYPE_ICONS}
                   config={{
                     reorderable: false,
                     showAddButton: isAdmin,
                     showPinnedSection: true,
                     showVisibilityGroups: true,
                   }}
                   onAddView={isAdmin ? handleAddView : undefined}
                   onRenameView={isAdmin ? handleRenameView : undefined}
                   onDeleteView={isAdmin ? handleDeleteView : undefined}
                   onPinView={isAdmin ? handlePinView : undefined}
                   onSetDefaultView={isAdmin ? handleSetDefaultView : undefined}
                   onConfigView={isAdmin ? handleConfigView : undefined}
                   onManageViews={isAdmin ? () => setManageViewsOpen(true) : undefined}
                 />
                 {isAdmin && (
                   <ManageViewsDialog
                     open={manageViewsOpen}
                     onOpenChange={setManageViewsOpen}
                     views={viewTabItems}
                     activeViewId={activeViewId}
                     viewTypeIcons={VIEW_TYPE_ICONS}
                     onRename={handleRenameView}
                     onDelete={handleDeleteView}
                     onSetDefault={handleSetDefaultView}
                     onSetPinned={handlePinView}
                     onReorder={handleReorderViews}
                     onAddView={handleAddView}
                     onConfigView={handleConfigView}
                   />
                 )}
               </div>
               {/* Mobile view switcher is rendered by AppHeader via
                   MobileViewSwitcherContext (registered above). */}
               </>
               );
             })()}

             {/* 2. Content — Plugin ObjectView with ViewSwitcher + Filter + Sort */}
             <div className="flex-1 overflow-hidden relative flex flex-row">
                {navOverlay.mode === 'split' && navOverlay.isOpen ? (
                    <NavigationOverlay
                        {...navOverlay}
                        setIsOpen={(open: boolean) => { if (!open) handleDrawerClose(); }}
                        title={objectLabel(objectDef)}
                        onExpand={handleExpandDrawer}
                        expandLabel={t('console.objectView.expandToPage', { defaultValue: 'Open as full page' })}
                        storageKey={`drawer-width:${objectDef.name}`}
                        mainContent={
                            <div className="flex-1 min-w-0 relative h-full flex flex-col">
                                <div className="flex-1 relative overflow-hidden">
                                    <div className="h-full overflow-auto">
                                        <PluginObjectView
                                            schema={objectViewSchema}
                                            dataSource={dataSource}
                                            views={mergedViews}
                                            activeViewId={activeViewId}
                                            onViewChange={handleViewChange}
                                            onEdit={(record: any) => onEdit?.(record)}
                                            onRowClick={(record: any, event?: any) => {
                                                handleRowClick(record, event);
                                            }}
                                            renderListView={renderListView}
                                            onCreateView={handleCreateView}
                                            onViewAction={handleViewAction}
                                        />
                                    </div>
                                </div>
                                {typeof recordCount === 'number' && (
                                    <div data-testid="record-count-footer" className="border-t px-3 sm:px-4 py-1.5 text-xs text-muted-foreground bg-muted/5 shrink-0">
                                        {t('console.objectView.recordCount', { count: recordCount })}
                                    </div>
                                )}
                            </div>
                        }
                    >
                        {(record: Record<string, unknown>) => {
                            const recordId = (record.id || record._id) as string;
                            return (
                                <RecordDetailView
                                    dataSource={dataSource}
                                    objects={objects}
                                    onEdit={onEdit}
                                    objectNameOverride={objectDef.name}
                                    recordIdOverride={recordId}
                                    embedded
                                />
                            );
                        }}
                    </NavigationOverlay>
                ) : (
                <div className="flex-1 min-w-0 relative h-full flex flex-col">
                    <div className="flex-1 relative overflow-hidden">
                        <div className="h-full overflow-auto">
                            <PluginObjectView
                                schema={objectViewSchema}
                                dataSource={dataSource}
                                views={mergedViews}
                                activeViewId={activeViewId}
                                onViewChange={handleViewChange}
                                onEdit={(record: any) => onEdit?.(record)}
                                onRowClick={(record: any, event?: any) => {
                                    handleRowClick(record, event);
                                }}
                                renderListView={renderListView}
                                onCreateView={handleCreateView}
                                onViewAction={handleViewAction}
                            />
                        </div>
                    </div>
                    {/* Record count footer removed — ListView already renders record-count-bar */}
                </div>
                )}
                {/* Metadata panel only shows for admin users */}
                <MetadataPanel
                    open={showDebug && isAdmin}
                    sections={[
                        { title: 'View Configuration', data: activeView },
                        { title: 'Object Definition', data: objectDef },
                    ]}
                />
                {/* Inline View Config Panel — Airtable-style right sidebar with slide animation */}
                <div
                    data-testid="view-config-panel-wrapper"
                    className={`transition-[max-width,opacity] duration-300 ease-in-out overflow-hidden ${
                        showViewConfigPanel && isAdmin ? 'max-w-[280px] opacity-100' : 'max-w-0 opacity-0'
                    }`}
                >
                    <ViewConfigPanel
                        open={showViewConfigPanel && isAdmin}
                        onClose={() => { setShowViewConfigPanel(false); setViewConfigPanelMode('edit'); }}
                        mode={viewConfigPanelMode}
                        activeView={activeView}
                        objectDef={objectDef}
                        recordCount={recordCount}
                        onSave={handleViewConfigSave}
                        onViewUpdate={handleViewUpdate}
                        onCreate={handleViewCreate}
                        metadataClient={metadataClient}
                        onAfterChange={() => setRefreshKey(k => k + 1)}
                    />
                </div>
                <CreateViewDialog
                    open={showCreateViewDialog && isAdmin}
                    onOpenChange={setShowCreateViewDialog}
                    existingLabels={views.map((v: any) => v.label).filter(Boolean)}
                    objectDef={objectDef}
                    onCreate={(cfg) => handleViewCreate(cfg)}
                />
             </div>

             {/* Record Detail Overlay — navigation mode driven by objectDef.navigation */}
             {navOverlay.mode !== 'split' && (
             <NavigationOverlay
                 {...navOverlay}
                 setIsOpen={(open: boolean) => { if (!open) handleDrawerClose(); }}
                 title={objectLabel(objectDef)}
                 onExpand={handleExpandDrawer}
                 expandLabel={t('console.objectView.expandToPage', { defaultValue: 'Open as full page' })}
                 storageKey={`drawer-width:${objectDef.name}`}
             >
                 {(record: Record<string, unknown>) => {
                     const recordId = (record.id || record._id) as string;
                     return (
                         <RecordDetailView
                             dataSource={dataSource}
                             objects={objects}
                             onEdit={onEdit}
                             objectNameOverride={objectDef.name}
                             recordIdOverride={recordId}
                             embedded
                         />
                     );
                 }}
             </NavigationOverlay>
             )}
        </div>
        <ActionConfirmDialog state={confirmState} onOpenChange={(open) => {
            if (!open) setConfirmState({ open: false, message: '' });
        }} />
        <ActionParamDialog state={paramState} onOpenChange={(open) => {
            if (!open) setParamState({ open: false, params: [] });
        }} />
        <ActionResultDialog
            state={resultDialogState}
            onAcknowledge={() => {
                resultDialogState.resolve?.();
                setResultDialogState({ open: false });
            }}
        />
        <FlowRunner
            state={screenFlow}
            authFetch={authFetch}
            baseUrl={import.meta.env.VITE_SERVER_URL || ''}
            onClose={() => setScreenFlow(null)}
            onComplete={() => { setScreenFlow(null); setRefreshKey(k => k + 1); }}
        />
        </ActionProvider>
    );
}
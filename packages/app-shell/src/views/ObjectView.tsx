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
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
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
import { Button, Empty, EmptyTitle, EmptyDescription, NavigationOverlay } from '@object-ui/components';
import { Plus, Upload, Table as TableIcon, KanbanSquare, Calendar, LayoutGrid, Activity, GanttChart, MapPin, BarChart3 } from 'lucide-react';
import { getIcon } from '../utils/getIcon';
import type { ListViewSchema, ViewNavigationConfig, FeedItem } from '@object-ui/types';
import { MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { ViewConfigPanel } from './ViewConfigPanel';
import { CreateViewDialog } from './CreateViewDialog';
import { PageHeader } from '../layout/PageHeader';
import { useObjectActions } from '../hooks/useObjectActions';
import { useObjectTranslation, useObjectLabel } from '@object-ui/i18n';
import { usePermissions } from '@object-ui/permissions';
import { useAuth, createAuthenticatedFetch } from '@object-ui/auth';
import { useRealtimeSubscription, useConflictResolution } from '@object-ui/collaboration';
import { ActionProvider, useNavigationOverlay, SchemaRenderer } from '@object-ui/react';
import { toast } from 'sonner';
import { ActionConfirmDialog, type ConfirmDialogState } from './ActionConfirmDialog';
import { ActionParamDialog, type ParamDialogState } from './ActionParamDialog';
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
 * DrawerDetailContent — extracted component for NavigationOverlay content.
 * Needs to be a proper component (not a render prop) so it can use hooks
 * for data fetching, comment handling, etc.
 */
function DrawerDetailContent({ objectDef, recordId, dataSource, onEdit }: {
    objectDef: any;
    recordId: string;
    dataSource: any;
    onEdit: (record: any) => void;
}) {
    const { user } = useAuth();
    const currentUser = user
        ? { id: user.id, name: user.name, avatar: user.image }
        : FALLBACK_USER;

    const [feedItems, setFeedItems] = useState<FeedItem[]>([]);

    // Fetch persisted comments from API
    useEffect(() => {
        if (!dataSource || !objectDef?.name || !recordId) return;
        const threadId = `${objectDef.name}:${recordId}`;
        dataSource.find('sys_comment', { $filter: { threadId }, $orderby: { createdAt: 'asc' } })
            .then((res: any) => {
                if (res.data?.length) {
                    setFeedItems(res.data.map((c: any) => ({
                        id: c.id,
                        type: 'comment' as const,
                        actor: c.author?.name ?? 'Unknown',
                        actorAvatarUrl: c.author?.avatar,
                        body: c.content,
                        createdAt: c.createdAt,
                        updatedAt: c.updatedAt,
                        parentId: c.parentId,
                        reactions: c.reactions
                            ? Object.entries(c.reactions as Record<string, string[]>).map(([emoji, userIds]) => ({
                                emoji,
                                count: userIds.length,
                                reacted: userIds.includes(currentUser.id),
                            }))
                            : undefined,
                    })));
                }
            })
            .catch(() => {});
    }, [dataSource, objectDef?.name, recordId, currentUser.id]);

    const handleAddComment = useCallback(
        async (text: string) => {
            const newItem: FeedItem = {
                id: crypto.randomUUID(),
                type: 'comment',
                actor: currentUser.name,
                actorAvatarUrl: 'avatar' in currentUser ? (currentUser as any).avatar : undefined,
                body: text,
                createdAt: new Date().toISOString(),
            };
            setFeedItems(prev => [...prev, newItem]);
            if (dataSource) {
                const threadId = `${objectDef.name}:${recordId}`;
                dataSource.create('sys_comment', {
                    id: newItem.id,
                    threadId,
                    author: currentUser,
                    content: text,
                    mentions: [],
                    createdAt: newItem.createdAt,
                }).catch(() => {});
            }
        },
        [currentUser, dataSource, objectDef?.name, recordId],
    );

    const handleAddReply = useCallback(
        async (parentId: string | number, text: string) => {
            const newItem: FeedItem = {
                id: crypto.randomUUID(),
                type: 'comment',
                actor: currentUser.name,
                actorAvatarUrl: 'avatar' in currentUser ? (currentUser as any).avatar : undefined,
                body: text,
                createdAt: new Date().toISOString(),
                parentId,
            };
            setFeedItems(prev => {
                const updated = [...prev, newItem];
                return updated.map(item =>
                    item.id === parentId
                        ? { ...item, replyCount: (item.replyCount ?? 0) + 1 }
                        : item
                );
            });
            if (dataSource) {
                const threadId = `${objectDef.name}:${recordId}`;
                dataSource.create('sys_comment', {
                    id: newItem.id,
                    threadId,
                    author: currentUser,
                    content: text,
                    mentions: [],
                    createdAt: newItem.createdAt,
                    parentId,
                }).catch(() => {});
            }
        },
        [currentUser, dataSource, objectDef?.name, recordId],
    );

    const handleToggleReaction = useCallback(
        (itemId: string | number, emoji: string) => {
            setFeedItems(prev => prev.map(item => {
                if (item.id !== itemId) return item;
                const reactions = [...(item.reactions ?? [])];
                const idx = reactions.findIndex(r => r.emoji === emoji);
                if (idx >= 0) {
                    const r = reactions[idx];
                    if (r.reacted) {
                        if (r.count <= 1) {
                            reactions.splice(idx, 1);
                        } else {
                            reactions[idx] = { ...r, count: r.count - 1, reacted: false };
                        }
                    } else {
                        reactions[idx] = { ...r, count: r.count + 1, reacted: true };
                    }
                } else {
                    reactions.push({ emoji, count: 1, reacted: true });
                }
                const updated = { ...item, reactions };
                if (dataSource) {
                    dataSource.update('sys_comment', String(itemId), {
                        $toggleReaction: { emoji, userId: currentUser.id },
                    }).catch(() => {});
                }
                return updated;
            }));
        },
        [currentUser.id, dataSource],
    );

    return (
        <div className="h-full bg-background overflow-auto p-3 sm:p-4 lg:p-6">
            <DetailView
                schema={{
                    type: 'detail-view',
                    objectName: objectDef.name,
                    resourceId: recordId,
                    showBack: false,
                    showEdit: true,
                    title: objectDef.label,
                    sections: [
                        {
                            title: 'Details',
                            fields: Object.keys(objectDef.fields || {}).map((key: string) => ({
                                name: key,
                                label: objectDef.fields[key].label || key,
                                type: objectDef.fields[key].type || 'text'
                            })),
                        }
                    ]
                }}
                dataSource={dataSource}
                onEdit={() => onEdit({ id: recordId })}
            />
            {/* Discussion panel — collapsible in drawer/overlay mode */}
            <div className="mt-6 border-t pt-6">
                <RecordChatterPanel
                    config={{
                        position: 'bottom',
                        collapsible: true,
                        defaultCollapsed: true,
                        feed: {
                            enableReactions: true,
                            enableThreading: true,
                            showCommentInput: true,
                        },
                    }}
                    items={feedItems}
                    onAddComment={handleAddComment}
                    onAddReply={handleAddReply}
                    onToggleReaction={handleToggleReaction}
                />
            </div>
        </div>
    );
}

export function ObjectView({ dataSource, objects, onEdit, externalRefreshKey }: any) {
    const navigate = useNavigate();
    const { objectName, viewId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { showDebug } = useMetadataInspector();
    const { t } = useObjectTranslation();
    const { objectLabel, objectDescription: objectDesc, viewLabel, actionLabel, actionConfirm, actionSuccess } = useObjectLabel();
    
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

        // Persist to backend if dataSource supports it
        if (dataSource?.updateViewConfig) {
            const objName = objectName;
            const vid = draft.id;
            if (objName && vid) {
                dataSource.updateViewConfig(objName, vid, draft).catch((err: any) => {
                    console.error('[ViewConfigPanel] Failed to persist view config:', err);
                });
            } else {
                console.warn('[ViewConfigPanel] Cannot persist view config: missing objectName or viewId.');
            }
        } else {
            console.warn('[ViewConfigPanel] dataSource.updateViewConfig is not available. View config saved locally only.');
        }
    }, [dataSource, objectName]);

    /** Create a new view via the config panel */
    const handleViewCreate = useCallback(async (config: Record<string, any>) => {
        try {
            let createdId: string | undefined;
            if (dataSource?.create) {
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
                // Translate NamedListView spec shape (type, label, kanban, chart,
                // gantt, etc., columns, filter, sort) into the sys_view storage
                // shape (view_type, label, object_name, *_json columns).
                // Per spec: front-end follows the protocol, the persistence
                // boundary owns the mapping to physical columns.
                const VIEW_TYPE_KEYS = [
                    'kanban', 'calendar', 'timeline', 'gantt',
                    'gallery', 'map', 'chart', 'grid',
                ] as const;
                const subConfig: Record<string, any> = {};
                for (const k of VIEW_TYPE_KEYS) {
                    if (config[k] && typeof config[k] === 'object') {
                        Object.assign(subConfig, config[k]);
                    }
                }
                const viewType = (config.type as string) || 'grid';
                const baseLabel = (config.label as string) || (config.name as string) || 'Untitled View';
                const slug = baseLabel
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '_')
                    .replace(/^_+|_+$/g, '')
                    .slice(0, 60) || 'view';
                const payload: Record<string, any> = {
                    name: `${slug}_${Date.now().toString(36)}`,
                    label: baseLabel,
                    object_name: objectName,
                    view_type: viewType,
                    columns_json: JSON.stringify(incomingColumns),
                    filters_json: config.filter ? JSON.stringify(config.filter) : null,
                    sort_json: config.sort ? JSON.stringify(config.sort) : null,
                    config_json: Object.keys(subConfig).length > 0
                        ? JSON.stringify(subConfig)
                        : null,
                    page_size: config.pageSize ?? 25,
                    show_search: config.showSearch !== false,
                    show_filters: config.showFilters !== false,
                    managed_by: 'user',
                };
                const created = await dataSource.create('sys_view', payload);
                createdId = created?.id ?? created?._id;
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
    }, [dataSource, objectName, objects, navigate, viewId]);
    
    // Record count tracking for footer
    const [recordCount, setRecordCount] = useState<number | undefined>(undefined);
    
    // Admin users automatically get design tools (no toggle needed)
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const { can } = usePermissions();
    
    // Get Object Definition
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

    // Refresh trigger — bumped after view CRUD or external data mutations.
    const [refreshKey, setRefreshKey] = useState(0);

    // Propagate externally-triggered refreshes (e.g. global ModalForm submit)
    // into our internal refreshKey so list/data effects re-run.
    useEffect(() => {
        if (externalRefreshKey === undefined || externalRefreshKey === 0) return;
        setRefreshKey(k => k + 1);
    }, [externalRefreshKey]);

    // Import wizard open/close state — toolbar entry triggers it.
    const [showImport, setShowImport] = useState(false);

    // ─── User-defined views (sys_view) ──────────────────────────────────
    // Saved views created via the ViewConfigPanel ("Add View") are persisted
    // to the `sys_view` object. We fetch them here and merge into `views` so
    // the ViewTabBar can render them alongside metadata-defined listViews.
    const [savedViews, setSavedViews] = useState<any[]>([]);
    useEffect(() => {
        let cancelled = false;
        if (!dataSource?.find || !objectName) {
            setSavedViews([]);
            return;
        }
        dataSource
            .find('sys_view', {
                $filter: ['objectName', '=', objectName],
                $orderby: [{ field: 'created_at', order: 'asc' }],
                $top: 200,
            })
            .then((res: any) => {
                if (cancelled) return;
                const rows: any[] = Array.isArray(res)
                    ? res
                    : Array.isArray(res?.data) ? res.data
                    : Array.isArray(res?.records) ? res.records
                    : Array.isArray(res?.value) ? res.value
                    : [];
                // Defensive client-side filter: only keep rows that look like
                // sys_view records for *this* object. Adapters that don't
                // honour $filter (or test mocks that ignore it) won't pollute
                // the view list with arbitrary records.
                const filtered = rows.filter(r => r && r.objectName === objectName);
                setSavedViews(filtered);
            })
            .catch((err: any) => {
                console.error('[ObjectView] Failed to load sys_view records:', err);
                if (!cancelled) setSavedViews([]);
            });
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
    }, [dataSource, objectName, objectDef.listViews, objectDef.list_views, refreshKey]);

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
            const normalized: any = {
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
            if (!aSaved && !bSaved) return (indexOf.get(a.id) ?? 0) - (indexOf.get(b.id) ?? 0);
            if (!aSaved) return -1;
            if (!bSaved) return 1;
            const ao = typeof aSaved.sortOrder === 'number' ? aSaved.sortOrder : Number.MAX_SAFE_INTEGER;
            const bo = typeof bSaved.sortOrder === 'number' ? bSaved.sortOrder : Number.MAX_SAFE_INTEGER;
            if (ao !== bo) return ao - bo;
            return (aSaved.created_at || '').localeCompare(bSaved.created_at || '');
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
        if (!dataSource?.update) return;
        if (!isSavedView(vid)) {
            toast.error(t('console.objectView.cannotEditMetaView') || 'Built-in views cannot be renamed.');
            return;
        }
        try {
            await dataSource.update('sys_view', vid, { label: newName });
            setRefreshKey(k => k + 1);
        } catch (err) {
            console.error('[ViewTabBar] Failed to rename view:', err);
            toast.error(t('objectViewActions.renameFailed'));
        }
    }, [dataSource, isSavedView, t]);

    // Promise-based confirm/param dialogs — declared early so destructive
    // handlers (delete, etc.) can `await confirmHandler(...)` for a proper
    // Airtable-style confirmation flow.
    const [confirmState, setConfirmState] = useState<ConfirmDialogState>({ open: false, message: '' });
    const [paramState, setParamState] = useState<ParamDialogState>({ open: false, params: [] });

    const confirmHandler = useCallback((message: string, options?: { title?: string; confirmText?: string; cancelText?: string }) => {
        return new Promise<boolean>((resolve) => {
            setConfirmState({ open: true, message, options, resolve });
        });
    }, []);

    const paramCollectionHandler = useCallback((params: ActionParamDef[]) => {
        return new Promise<Record<string, any> | null>((resolve) => {
            setParamState({ open: true, params, resolve });
        });
    }, []);

    const handleDeleteView = useCallback(async (vid: string) => {
        if (!dataSource?.delete) return;
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
            await dataSource.delete('sys_view', vid);
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

    const handleDuplicateView = useCallback(async (vid: string) => {
        if (!dataSource?.create) return;
        const source = views.find((v: any) => v.id === vid);
        if (!source) return;
        try {
            const { id: _omit, created_at, updated_at, ...rest } = source as any;
            const newId = `view_${Date.now()}`;
            const payload = {
                ...rest,
                objectName,
                id: newId,
                label: `${source.label || vid} (Copy)`,
                isDefault: false,
                isPinned: false,
            };
            await dataSource.create('sys_view', payload);
            setRefreshKey(k => k + 1);
            // Auto-activate the duplicate (Airtable parity).
            if (viewId) {
                navigate(`../${newId}`, { relative: 'path' });
            } else {
                navigate(`view/${newId}`);
            }
        } catch (err) {
            console.error('[ViewTabBar] Failed to duplicate view:', err);
            toast.error('Failed to duplicate view');
        }
    }, [dataSource, views, objectName, navigate, viewId]);

    const handlePinView = useCallback(async (vid: string, pinned: boolean) => {
        if (!dataSource?.update) return;
        if (!isSavedView(vid)) {
            toast.error(t('console.objectView.cannotEditMetaView') || 'Built-in views cannot be pinned.');
            return;
        }
        try {
            await dataSource.update('sys_view', vid, { isPinned: pinned });
            setRefreshKey(k => k + 1);
        } catch (err) {
            console.error('[ViewTabBar] Failed to pin view:', err);
        }
    }, [dataSource, isSavedView, t]);

    const handleSetDefaultView = useCallback(async (vid: string) => {
        if (!dataSource?.update) return;
        if (!isSavedView(vid)) {
            toast.error(
                t('console.objectView.cannotEditMetaView')
                || 'System view — duplicate it to mark a default.',
            );
            return;
        }
        try {
            // Clear `isDefault` on all other saved views, then set this one.
            const updates = savedViews
                .filter((sv: any) => (sv.id || sv._id) !== vid && sv.isDefault)
                .map((sv: any) => dataSource.update('sys_view', sv.id || sv._id, { isDefault: false }));
            updates.push(dataSource.update('sys_view', vid, { isDefault: true }));
            await Promise.all(updates);
            setRefreshKey(k => k + 1);
        } catch (err) {
            console.error('[ViewTabBar] Failed to set default view:', err);
            toast.error('Failed to set default view');
        }
    }, [dataSource, savedViews, isSavedView, t]);

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
        if (dataSource?.update) {
            const savedIdSet = new Set(savedViews.map((sv: any) => sv.id || sv._id));
            const updates = orderedIds
                .filter(id => savedIdSet.has(id))
                .map((id, idx) => dataSource.update('sys_view', id, { sortOrder: idx }));
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
        // never persist. Steer them to "Duplicate view" instead.
        if (!isSavedView(vid)) {
            toast.error(
                t('console.objectView.cannotEditMetaView')
                || 'System view — duplicate it to make changes.',
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

    const apiHandler = useCallback(async (action: ActionDef) => {
        try {
            const target = action.target || action.name;
            const params = action.params || {};

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
    }, [dataSource, objectDef.name]);

    // Authenticated fetch for direct backend calls (e.g. flow trigger).
    const authFetch = useMemo(() => createAuthenticatedFetch(), []);

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
            const params = action.params || {};
            const res = await authFetch(
                `${baseUrl}/api/v1/automation/${encodeURIComponent(flowName)}/trigger`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recordId: params.recordId,
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
            ? (action.params as Record<string, unknown>)
            : {};
        try {
            const baseUrl = import.meta.env.VITE_SERVER_URL || '';
            const obj = action.objectName || objectDef.name || 'global';
            const res = await authFetch(
                `${baseUrl}/api/v1/actions/${encodeURIComponent(obj)}/${encodeURIComponent(targetName)}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recordId: (params as any).recordId, params }),
                },
            );
            const json = await res.json().catch(() => null);
            if (!res.ok || (json && json.success === false)) {
                const errMsg = json?.error || `Action "${targetName}" failed (HTTP ${res.status})`;
                return { success: false, error: errMsg };
            }
            const shouldRefresh = action.refreshAfter !== false;
            if (shouldRefresh) setRefreshKey(k => k + 1);
            return { success: true, data: json?.data, reload: shouldRefresh };
        } catch (error) {
            return { success: false, error: (error as Error).message };
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
    // Priority: activeView.navigation > objectDef.navigation > default page
    // Memoize to avoid unstable object identity on every render (stale closure prevention)
    const detailNavigation: ViewNavigationConfig = useMemo(
        () => activeView?.navigation ?? objectDef.navigation ?? { mode: 'page' },
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
            if (viewId) {
                navigate(`../../record/${encodeURIComponent(String(recordId))}`, { relative: 'path' });
            } else {
                navigate(`record/${encodeURIComponent(String(recordId))}`);
            }
        },
        [navigate, viewId]
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
            return (
                <Suspense key={key} fallback={<div className="p-4 text-sm text-muted-foreground">Loading chart…</div>}>
                    <ObjectChart 
                        dataSource={ds}
                        schema={{
                            type: 'object-chart',
                            objectName: objectDef.name,
                            chartType: chartConfig.chartType,
                            xAxisField: chartConfig.xAxisField,
                            yAxisFields: chartConfig.yAxisFields,
                            aggregation: chartConfig.aggregation,
                            series: chartConfig.series,
                            config: chartConfig.config,
                            filter: chartConfig.filter,
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
                if (!urlFilters.length) return base;
                const baseArr = Array.isArray(base) ? base : [];
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
            bulkActions: viewDef.bulkActions ?? listSchema.bulkActions,
            sharing: viewDef.sharing ?? listSchema.sharing,
            addRecord: viewDef.addRecord ?? listSchema.addRecord,
            conditionalFormatting: viewDef.conditionalFormatting ?? listSchema.conditionalFormatting,
            quickFilters: viewDef.quickFilters ?? listSchema.quickFilters,
            userFilters: viewDef.userFilters ?? listSchema.userFilters,
            showRecordCount: viewDef.showRecordCount ?? listSchema.showRecordCount,
            allowPrinting: viewDef.allowPrinting ?? listSchema.allowPrinting,
            virtualScroll: viewDef.virtualScroll ?? listSchema.virtualScroll,
            emptyState: viewDef.emptyState ?? listSchema.emptyState,
            aria: viewDef.aria ?? listSchema.aria,
            tabs: listSchema.tabs,
            // Propagate filter/sort as default filters/sort for data flow
            ...((() => {
                const combined = [
                    ...(Array.isArray(viewDef.filter) ? viewDef.filter : []),
                    ...urlFilters,
                ];
                return combined.length ? { filters: combined } : {};
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
                onRowClick={(record: any) => {
                    navOverlay.handleClick(record);
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
            { type: 'duplicate' as const },
            { type: 'delete' as const },
        ] : [],
        onNavigate: (recordId: string | number, mode: 'view' | 'edit') => {
            if (mode === 'edit') {
                onEdit?.({ id: recordId });
            } else if (mode === 'view') {
                if (viewId) {
                    navigate(`../../record/${encodeURIComponent(String(recordId))}`, { relative: 'path' });
                } else {
                    navigate(`record/${encodeURIComponent(String(recordId))}`);
                }
            }
        },
    }), [objectDef.name, onEdit, activeView?.showSearch, activeView?.showFilters, activeView?.showSort, navigate, viewId, isAdmin]);

    return (
        <ActionProvider
            context={{ objectName: objectDef.name, user: currentUser }}
            onConfirm={confirmHandler}
            onToast={toastHandler}
            onNavigate={navigateHandler}
            onParamCollection={paramCollectionHandler}
            handlers={{ api: apiHandler, flow: flowHandler, script: serverActionHandler, modal: serverActionHandler }}
        >
        <div className="h-full flex flex-col bg-background min-w-0 overflow-hidden">
             {/* 1. Header with breadcrumb + description */}
             <PageHeader
                 title={objectLabel(objectDef)}
                 description={objectDef.description ? objectDesc(objectDef) : undefined}
                 icon={(() => { const I = getIcon((objectDef as any)?.icon); return <I className="h-4 w-4" />; })()}
                 actions={
                   <>
                    {/* Primary action - always visible */}
                    {can(objectDef.name, 'create') && (
                    <Button size="sm" onClick={actions.create} className="shadow-none gap-1.5 sm:gap-2 h-8 sm:h-9">
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('console.objectView.new')}</span>
                    </Button>
                    )}

                    {/* Data import — gated by create permission, since
                        importing rows is logically a bulk-create operation.
                        Wires the schema's field map into the existing
                        ImportWizard from @object-ui/plugin-grid. */}
                    {can(objectDef.name, 'create') && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowImport(true)}
                        className="shadow-none gap-1.5 sm:gap-2 h-8 sm:h-9"
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
                       || 'System view defined in code — duplicate to customize.')
                     : undefined,
                 } as ViewTabItem;
               });
               return (
               <div className="border-b px-3 sm:px-4 bg-background overflow-x-auto shrink-0">
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
                   onDuplicateView={isAdmin ? handleDuplicateView : undefined}
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
                     onDuplicate={handleDuplicateView}
                     onSetDefault={handleSetDefaultView}
                     onSetPinned={handlePinView}
                     onReorder={handleReorderViews}
                     onAddView={handleAddView}
                     onConfigView={handleConfigView}
                   />
                 )}
               </div>
               );
             })()}

             {/* 2. Content — Plugin ObjectView with ViewSwitcher + Filter + Sort */}
             <div className="flex-1 overflow-hidden relative flex flex-row">
                {navOverlay.mode === 'split' && navOverlay.isOpen ? (
                    <NavigationOverlay
                        {...navOverlay}
                        setIsOpen={(open: boolean) => { if (!open) handleDrawerClose(); }}
                        title={objectLabel(objectDef)}
                        mainContent={
                            <div className="flex-1 min-w-0 relative h-full flex flex-col">
                                <div className="flex-1 relative overflow-hidden p-3 sm:p-4">
                                    <div className="h-full overflow-auto rounded-lg border bg-card shadow-xs">
                                        <PluginObjectView
                                            schema={objectViewSchema}
                                            dataSource={dataSource}
                                            views={mergedViews}
                                            activeViewId={activeViewId}
                                            onViewChange={handleViewChange}
                                            onEdit={(record: any) => onEdit?.(record)}
                                            onRowClick={(record: any) => {
                                                navOverlay.handleClick(record);
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
                                <DrawerDetailContent
                                    objectDef={objectDef}
                                    recordId={recordId}
                                    dataSource={dataSource}
                                    onEdit={onEdit}
                                />
                            );
                        }}
                    </NavigationOverlay>
                ) : (
                <div className="flex-1 min-w-0 relative h-full flex flex-col">
                    <div className="flex-1 relative overflow-hidden p-3 sm:p-4">
                        <div className="h-full overflow-auto rounded-lg border bg-card shadow-xs">
                            <PluginObjectView
                                schema={objectViewSchema}
                                dataSource={dataSource}
                                views={mergedViews}
                                activeViewId={activeViewId}
                                onViewChange={handleViewChange}
                                onEdit={(record: any) => onEdit?.(record)}
                                onRowClick={(record: any) => {
                                    navOverlay.handleClick(record);
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
                 title={objectDef.label}
                 className={navOverlay.mode === 'drawer' ? 'w-[90vw] sm:max-w-2xl p-0 overflow-hidden' : undefined}
             >
                 {(record: Record<string, unknown>) => {
                     const recordId = (record.id || record._id) as string;
                     return (
                         <DrawerDetailContent
                             objectDef={objectDef}
                             recordId={recordId}
                             dataSource={dataSource}
                             onEdit={onEdit}
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
        </ActionProvider>
    );
}
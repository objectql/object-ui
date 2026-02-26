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

import { useMemo, useState, useCallback, useEffect, type ComponentType } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ObjectChart } from '@object-ui/plugin-charts';
import { ListView } from '@object-ui/plugin-list';
import { DetailView } from '@object-ui/plugin-detail';
import { ObjectView as PluginObjectView, ViewTabBar } from '@object-ui/plugin-view';
import type { ViewTabItem, AvailableViewType } from '@object-ui/plugin-view';
// Import plugins for side-effects (registration)
import '@object-ui/plugin-grid';
import '@object-ui/plugin-kanban';
import '@object-ui/plugin-calendar';
import { Button, Empty, EmptyTitle, EmptyDescription, NavigationOverlay, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@object-ui/components';
import { Plus, Table as TableIcon, Settings2, Wrench, KanbanSquare, Calendar, LayoutGrid, Activity, GanttChart, MapPin, BarChart3, ChevronRight } from 'lucide-react';
import type { ListViewSchema, ViewNavigationConfig } from '@object-ui/types';
import { MetadataToggle, MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { ViewConfigPanel } from './ViewConfigPanel';
import { useObjectActions } from '../hooks/useObjectActions';
import { useObjectTranslation } from '@object-ui/i18n';
import { usePermissions } from '@object-ui/permissions';
import { useAuth } from '@object-ui/auth';
import { useRealtimeSubscription, useConflictResolution } from '@object-ui/collaboration';
import { useNavigationOverlay } from '@object-ui/react';

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

/** Available view types for quick-switch palette */
const AVAILABLE_VIEW_TYPES: AvailableViewType[] = [
    { type: 'grid', label: 'Grid', description: 'Spreadsheet-style rows and columns' },
    { type: 'kanban', label: 'Kanban', description: 'Drag cards between columns' },
    { type: 'calendar', label: 'Calendar', description: 'View records on a calendar' },
    { type: 'gallery', label: 'Gallery', description: 'Visual card layout' },
    { type: 'timeline', label: 'Timeline', description: 'Chronological event view' },
    { type: 'gantt', label: 'Gantt', description: 'Project timeline with dependencies' },
    { type: 'map', label: 'Map', description: 'Geographic location view' },
    { type: 'chart', label: 'Chart', description: 'Data visualization' },
];

export function ObjectView({ dataSource, objects, onEdit, onRowClick }: any) {
    const navigate = useNavigate();
    const { objectName, viewId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { showDebug, toggleDebug } = useMetadataInspector();
    const { t } = useObjectTranslation();
    
    // Inline view config panel state (Airtable-style right sidebar)
    const [showViewConfigPanel, setShowViewConfigPanel] = useState(false);
    const [viewConfigPanelMode, setViewConfigPanelMode] = useState<'create' | 'edit'>('edit');
    
    // Draft state for view config edits — cached locally, saved on demand
    const [viewDraft, setViewDraft] = useState<Record<string, any> | null>(null);
    
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
            if (dataSource?.create) {
                const payload = { objectName, ...config };
                await dataSource.create('sys_view', payload);
            }
            setShowViewConfigPanel(false);
            setViewConfigPanelMode('edit');
            setRefreshKey(k => k + 1);
        } catch (err) {
            console.error('[ViewConfigPanel] Failed to create view:', err);
        }
    }, [dataSource, objectName]);
    
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

    // Resolve Views from objectDef.listViews (camelCase per @objectstack/spec)
    const views = useMemo(() => {
        const definedViews = objectDef.listViews || objectDef.list_views || {};
        const viewList = Object.entries(definedViews).map(([key, value]: [string, any]) => ({
            id: key,
            ...value,
            type: value.type || 'grid'
        }));
        
        if (viewList.length === 0) {
            viewList.push({ 
                id: 'all', 
                label: t('console.objectView.allRecords'), 
                type: 'grid', 
                columns: objectDef.fields ? Object.keys(objectDef.fields).slice(0, 5) : [] 
            });
        }
        return viewList;
    }, [objectDef]);

    // Active View State — merge saved draft if available for this view
    const activeViewId = viewId || searchParams.get('view') || views[0]?.id;
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
        // Auto-close the config panel when switching views
        setShowViewConfigPanel(false);
        if (viewId) {
             navigate(`../${matchedView.id}`, { relative: "path" });
        } else {
             navigate(`view/${matchedView.id}`);
        }
    };

    // Action system for toolbar operations
    const [refreshKey, setRefreshKey] = useState(0);
    const actions = useObjectActions({
        objectName: objectDef.name,
        objectLabel: objectDef.label,
        dataSource,
        onEdit,
        onRefresh: () => setRefreshKey(k => k + 1),
    });

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
    // Priority: activeView.navigation > objectDef.navigation > default drawer
    const detailNavigation: ViewNavigationConfig = activeView?.navigation ?? objectDef.navigation ?? { mode: 'drawer' };
    const drawerRecordId = searchParams.get('recordId');
    const navOverlay = useNavigationOverlay({
        navigation: detailNavigation,
        objectName: objectDef.name,
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
            navOverlay.open({ _id: drawerRecordId, id: drawerRecordId });
        } else if (!drawerRecordId && navOverlay.isOpen) {
            navOverlay.close();
        }
    }, [drawerRecordId]);

    // Render multi-view content via ListView plugin (for kanban, calendar, etc.)
    const renderListView = useCallback(({ schema: listSchema, dataSource: ds, onEdit: editHandler, onRowClick: rowClickHandler, className }: any) => {
        const key = `${objectName}-${activeView.id}-${refreshKey}`;
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
                <ObjectChart 
                    key={key}
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
            );
        }

        const fullSchema: ListViewSchema = {
            ...listSchema,
            // Propagate appearance/view-config properties for live preview
            rowHeight: viewDef.rowHeight ?? listSchema.rowHeight,
            densityMode: viewDef.densityMode ?? listSchema.densityMode,
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
            hiddenFields: viewDef.hiddenFields ?? listSchema.hiddenFields,
            rowActions: viewDef.rowActions ?? listSchema.rowActions,
            bulkActions: viewDef.bulkActions ?? listSchema.bulkActions,
            sharing: viewDef.sharing ?? listSchema.sharing,
            addRecord: viewDef.addRecord ?? listSchema.addRecord,
            conditionalFormatting: viewDef.conditionalFormatting ?? listSchema.conditionalFormatting,
            quickFilters: viewDef.quickFilters ?? listSchema.quickFilters,
            showRecordCount: viewDef.showRecordCount ?? listSchema.showRecordCount,
            allowPrinting: viewDef.allowPrinting ?? listSchema.allowPrinting,
            virtualScroll: viewDef.virtualScroll ?? listSchema.virtualScroll,
            emptyState: viewDef.emptyState ?? listSchema.emptyState,
            aria: viewDef.aria ?? listSchema.aria,
            tabs: listSchema.tabs,
            // Propagate filter/sort as default filters/sort for data flow
            ...(viewDef.filter?.length ? { filters: viewDef.filter } : {}),
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
                    imageField: viewDef.gallery?.imageField || 'image',
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
                onRowClick={rowClickHandler || ((record: any) => editHandler?.(record))}
                dataSource={ds}
            />
        );
    }, [activeView, objectDef, objectName, refreshKey]);

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
        onNavigate: (recordId: string | number, mode: 'view' | 'edit') => {
            if (mode === 'edit') {
                onEdit?.({ _id: recordId, id: recordId });
            }
        },
    }), [objectDef.name, onEdit, activeView?.showSearch, activeView?.showFilters, activeView?.showSort]);

    return (
        <div className="h-full flex flex-col bg-background min-w-0 overflow-hidden">
             {/* 1. Header with breadcrumb + description */}
             <div className="flex justify-between items-center py-2.5 sm:py-3 px-3 sm:px-4 border-b shrink-0 bg-background z-10">
                 <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div className="bg-primary/10 p-1.5 sm:p-2 rounded-md shrink-0">
                        <TableIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                        {/* Breadcrumb: Object > View */}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                            <span className="truncate">{objectDef.label}</span>
                            <ChevronRight className="h-3 w-3 shrink-0" />
                            <span className="truncate font-medium text-foreground">{activeView?.label || t('console.objectView.allRecords')}</span>
                        </div>
                        <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">{objectDef.label}</h1>
                        {objectDef.description && (
                            <p className="text-xs text-muted-foreground truncate hidden sm:block max-w-md">{objectDef.description}</p>
                        )}
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    {/* Primary action - always visible */}
                    {can(objectDef.name, 'create') && (
                    <Button size="sm" onClick={actions.create} className="shadow-none gap-1.5 sm:gap-2 h-8 sm:h-9">
                        <Plus className="h-4 w-4" /> 
                        <span className="hidden sm:inline">{t('console.objectView.new')}</span>
                    </Button>
                    )}
                    
                    {/* Schema-driven toolbar actions */}
                    {objectDef.actions?.filter((a: any) => a.location === 'list_toolbar').map((action: any) => (
                      <Button
                        key={action.name || action.label}
                        size="sm"
                        variant={action.variant || "outline"}
                        className="shadow-none h-8 sm:h-9"
                        onClick={() => actions.execute(action)}
                      >
                        {action.label || action.name}
                      </Button>
                    ))}

                    {/* Design tools menu — visible only to admin users */}
                    {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="shadow-none h-8 sm:h-9 px-2"
                          title={t('console.objectView.designTools')}
                        >
                          <Wrench className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={toggleDebug}>
                          <MetadataToggle open={showDebug} onToggle={toggleDebug} className="hidden" />
                          {t('console.objectView.metadataInspector')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { setViewConfigPanelMode('edit'); setShowViewConfigPanel(prev => !prev); }}>
                          <Settings2 className="h-4 w-4 mr-2" />
                          {t('console.objectView.editView')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setViewConfigPanelMode('create'); setShowViewConfigPanel(true); }}>
                          <Plus className="h-4 w-4 mr-2" />
                          {t('console.objectView.addView')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    )}
                 </div>
             </div>

             {/* View Tabs — Airtable-style named-view switcher with management UX */}
             {views.length > 1 && (
               <div className="border-b px-3 sm:px-4 bg-background overflow-x-auto shrink-0">
                 <ViewTabBar
                   views={views.map((view: { id: string; label: string; type: string; filter?: any[]; sort?: any[] }) => ({
                     id: view.id,
                     label: view.label,
                     type: view.type,
                     hasActiveFilters: Array.isArray((view as any).filter) && (view as any).filter.length > 0,
                     hasActiveSort: Array.isArray((view as any).sort) && (view as any).sort.length > 0,
                   } as ViewTabItem))}
                   activeViewId={activeViewId}
                   onViewChange={handleViewChange}
                   viewTypeIcons={VIEW_TYPE_ICONS}
                   config={{ ...objectDef.viewTabBar, reorderable: isAdmin ? true : objectDef.viewTabBar?.reorderable }}
                   onAddView={isAdmin ? () => { setViewConfigPanelMode('create'); setShowViewConfigPanel(true); } : undefined}
                   onRenameView={(id, newName) => {
                     // Rename is wired for future backend integration
                     console.info('[ViewTabBar] Rename view:', id, newName);
                   }}
                   onDuplicateView={(id) => {
                     console.info('[ViewTabBar] Duplicate view:', id);
                   }}
                   onDeleteView={(id) => {
                     console.info('[ViewTabBar] Delete view:', id);
                   }}
                   onSetDefaultView={(id) => {
                     console.info('[ViewTabBar] Set default view:', id);
                   }}
                   onShareView={(id) => {
                     console.info('[ViewTabBar] Share view:', id);
                   }}
                   onPinView={(id, pinned) => {
                     console.info('[ViewTabBar] Pin view:', id, pinned);
                   }}
                   onReorderViews={(viewIds) => {
                     console.info('[ViewTabBar] Reorder views:', viewIds);
                   }}
                   onChangeViewType={(id, newType) => {
                     console.info('[ViewTabBar] Change view type:', id, newType);
                   }}
                   onConfigView={isAdmin ? (id) => {
                     handleViewChange(id);
                     setViewConfigPanelMode('edit');
                     setShowViewConfigPanel(true);
                   } : undefined}
                   availableViewTypes={AVAILABLE_VIEW_TYPES}
                 />
               </div>
             )}

             {/* 2. Content — Plugin ObjectView with ViewSwitcher + Filter + Sort */}
             <div className="flex-1 overflow-hidden relative flex flex-row">
                <div className="flex-1 min-w-0 relative h-full flex flex-col">
                    <div className="flex-1 relative overflow-auto p-3 sm:p-4">
                        <PluginObjectView
                            schema={objectViewSchema}
                            dataSource={dataSource}
                            views={mergedViews}
                            activeViewId={activeViewId}
                            onViewChange={handleViewChange}
                            onEdit={(record: any) => onEdit?.(record)}
                            onRowClick={onRowClick || ((record: any) => onEdit?.(record))}
                            renderListView={renderListView}
                        />
                    </div>
                    {/* Footer — Record count */}
                    {typeof recordCount === 'number' && (
                        <div data-testid="record-count-footer" className="border-t px-3 sm:px-4 py-1.5 text-xs text-muted-foreground bg-muted/5 shrink-0">
                            {t('console.objectView.recordCount', { count: recordCount })}
                        </div>
                    )}
                </div>
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
             </div>

             {/* Record Detail Overlay — navigation mode driven by objectDef.navigation */}
             <NavigationOverlay
                 {...navOverlay}
                 setIsOpen={(open: boolean) => { if (!open) handleDrawerClose(); }}
                 title={objectDef.label}
                 className={navOverlay.mode === 'drawer' ? 'w-[90vw] sm:max-w-2xl p-0 overflow-hidden' : undefined}
             >
                 {(record: Record<string, unknown>) => {
                     const recordId = (record._id || record.id) as string;
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
                                 onEdit={() => onEdit({ _id: recordId, id: recordId })}
                             />
                         </div>
                     );
                 }}
             </NavigationOverlay>
        </div>
    );
}
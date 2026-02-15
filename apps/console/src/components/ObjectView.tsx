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
import { ObjectView as PluginObjectView } from '@object-ui/plugin-view';
// Import plugins for side-effects (registration)
import '@object-ui/plugin-grid';
import '@object-ui/plugin-kanban';
import '@object-ui/plugin-calendar';
import { cn, Button, Empty, EmptyTitle, EmptyDescription, Sheet, SheetContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@object-ui/components';
import { Plus, Table as TableIcon, Settings2, MoreVertical, Wrench, KanbanSquare, Calendar, LayoutGrid, Activity, GanttChart, MapPin, BarChart3 } from 'lucide-react';
import type { ListViewSchema } from '@object-ui/types';
import { MetadataToggle, MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { useObjectActions } from '../hooks/useObjectActions';
import { useObjectTranslation } from '@object-ui/i18n';
import { usePermissions } from '@object-ui/permissions';
import { useRealtimeSubscription } from '@object-ui/collaboration';

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

export function ObjectView({ dataSource, objects, onEdit, onRowClick }: any) {
    const navigate = useNavigate();
    const { objectName, viewId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { showDebug, toggleDebug } = useMetadataInspector();
    const { t } = useObjectTranslation();
    
    // Design mode toggle - default false for end users
    const [designMode, setDesignMode] = useState(false);
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

    // Active View State
    const activeViewId = viewId || searchParams.get('view') || views[0]?.id;
    const activeView = views.find((v: any) => v.id === activeViewId) || views[0];

    const handleViewChange = (newViewId: string) => {
        // The plugin ObjectView returns the view ID directly via onViewChange
        const matchedView = views.find((v: any) => v.id === newViewId);
        if (!matchedView) return;
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

    useEffect(() => {
        if (realtimeMessage) {
            setRefreshKey(k => k + 1);
        }
    }, [realtimeMessage]);
    
    // Drawer Logic
    const drawerRecordId = searchParams.get('recordId');
    const handleDrawerClose = () => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('recordId');
        setSearchParams(newParams);
    };

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
            const found = flatKeys.filter(k => k in viewDef && !(viewDef as any)[viewDef.type]?.[k]);
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

    // Build the ObjectViewSchema for the plugin
    const objectViewSchema = useMemo(() => ({
        type: 'object-view' as const,
        objectName: objectDef.name,
        layout: 'page' as const,
        showSearch: true,
        showFilters: true,
        showCreate: false, // We render our own create button in the header
        showRefresh: true,
        onNavigate: (recordId: string | number, mode: 'view' | 'edit') => {
            if (mode === 'edit') {
                onEdit?.({ _id: recordId, id: recordId });
            }
        },
    }), [objectDef.name, onEdit]);

    return (
        <div className="h-full flex flex-col bg-background">
             {/* 1. Simplified Header */}
             <div className="flex justify-between items-center py-2.5 sm:py-3 px-3 sm:px-4 border-b shrink-0 bg-background z-10">
                 <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div className="bg-primary/10 p-1.5 sm:p-2 rounded-md shrink-0">
                        <TableIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">{objectDef.label}</h1>
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

                    {/* Design mode tools menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          size="sm" 
                          variant={designMode ? "secondary" : "ghost"}
                          className="shadow-none h-8 sm:h-9 px-2"
                          title={t('console.objectView.designTools')}
                        >
                          {designMode ? <Wrench className="h-4 w-4" /> : <MoreVertical className="h-4 w-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setDesignMode(!designMode)}>
                          <Wrench className="h-4 w-4 mr-2" />
                          {designMode ? t('console.objectView.exitDesignMode') : t('console.objectView.enterDesignMode')}
                        </DropdownMenuItem>
                        {designMode && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={toggleDebug}>
                              <MetadataToggle open={showDebug} onToggle={toggleDebug} className="hidden" />
                              {t('console.objectView.metadataInspector')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(viewId ? `../../views/${viewId}` : `views/${activeViewId}`)}>
                              <Settings2 className="h-4 w-4 mr-2" />
                              {t('console.objectView.editView')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(viewId ? '../../views/new' : 'views/new')}>
                              <Plus className="h-4 w-4 mr-2" />
                              {t('console.objectView.addView')}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                 </div>
             </div>

             {/* View Tabs — Airtable-style named-view switcher */}
             {views.length > 1 && (
               <div className="border-b px-3 sm:px-4 bg-background overflow-x-auto shrink-0">
                 <div className="flex items-center gap-0.5 -mb-px">
                   {views.map((view: { id: string; label: string; type: string }) => {
                     const isActive = view.id === activeViewId;
                     const ViewIcon = VIEW_TYPE_ICONS[view.type] || TableIcon;
                     return (
                       <button
                         key={view.id}
                         onClick={() => handleViewChange(view.id)}
                         className={cn(
                           "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                           isActive
                             ? "border-primary text-primary"
                             : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                         )}
                       >
                         <ViewIcon className="h-3.5 w-3.5" />
                         {view.label}
                       </button>
                     );
                   })}
                 </div>
               </div>
             )}

             {/* 2. Content — Plugin ObjectView with ViewSwitcher + Filter + Sort */}
             <div className="flex-1 overflow-hidden relative flex flex-row">
                <div className="flex-1 relative h-full">
                    <div className="absolute inset-0 overflow-auto p-3 sm:p-4">
                        <PluginObjectView
                            key={refreshKey}
                            schema={objectViewSchema}
                            dataSource={dataSource}
                            views={views}
                            activeViewId={activeViewId}
                            onViewChange={handleViewChange}
                            onEdit={(record: any) => onEdit?.(record)}
                            onRowClick={onRowClick || ((record: any) => onEdit?.(record))}
                            renderListView={renderListView}
                        />
                    </div>
                </div>
                {/* Metadata panel only shows in design mode */}
                <MetadataPanel
                    open={showDebug && designMode}
                    sections={[
                        { title: 'View Configuration', data: activeView },
                        { title: 'Object Definition', data: objectDef },
                    ]}
                />
             </div>

             {/* Drawer for Record Details */}
             <Sheet open={!!drawerRecordId} onOpenChange={(open: boolean) => !open && handleDrawerClose()}>
                <SheetContent side="right" className="w-[90vw] sm:w-150 sm:max-w-none p-0 overflow-hidden">
                    {drawerRecordId && (
                        <div className="h-full bg-background overflow-auto p-3 sm:p-4 lg:p-6">
                            <DetailView
                                schema={{
                                    type: 'detail-view',
                                    objectName: objectDef.name,
                                    resourceId: drawerRecordId,
                                    showBack: false,
                                    showEdit: true,
                                    title: objectDef.label,
                                    sections: [
                                        {
                                            title: 'Details',
                                            fields: Object.keys(objectDef.fields || {}).map(key => ({
                                                name: key,
                                                label: objectDef.fields[key].label || key,
                                                type: objectDef.fields[key].type || 'text'
                                            })),
                                            columns: 1
                                        }
                                    ]
                                }}
                                dataSource={dataSource}
                                onEdit={() => onEdit({ _id: drawerRecordId, id: drawerRecordId })}
                            />
                        </div>
                    )}
                </SheetContent>
             </Sheet>
        </div>
    );
}
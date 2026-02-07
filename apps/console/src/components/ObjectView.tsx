import { useMemo, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ObjectChart } from '@object-ui/plugin-charts';
import { ListView } from '@object-ui/plugin-list';
import { DetailView } from '@object-ui/plugin-detail';
import { ViewSwitcher, FilterUI, SortUI } from '@object-ui/plugin-view';
// Import plugins for side-effects (registration)
import '@object-ui/plugin-grid';
import '@object-ui/plugin-kanban';
import '@object-ui/plugin-calendar';
import { Button, Empty, EmptyTitle, EmptyDescription, Sheet, SheetContent } from '@object-ui/components';
import { Plus, Table as TableIcon } from 'lucide-react';
import type { ListViewSchema, ViewSwitcherSchema, FilterUISchema, SortUISchema, ViewType } from '@object-ui/types';
import { MetadataToggle, MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { useObjectActions } from '../hooks/useObjectActions';

export function ObjectView({ dataSource, objects, onEdit, onRowClick }: any) {
    const navigate = useNavigate();
    const { objectName, viewId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { showDebug, toggleDebug } = useMetadataInspector();
    
    // Get Object Definition
    const objectDef = objects.find((o: any) => o.name === objectName);

    if (!objectDef) {
      return (
        <div className="h-full p-4 flex items-center justify-center">
          <Empty>
            <EmptyTitle>Object Not Found</EmptyTitle>
            <EmptyDescription>The object "{objectName}" does not exist in the current configuration.</EmptyDescription>
          </Empty>
        </div>
      );
    }

    // Resolve Views
    const views = useMemo(() => {
        const definedViews = objectDef.list_views || {};
        const viewList = Object.entries(definedViews).map(([key, value]: [string, any]) => ({
            id: key,
            ...value,
            type: value.type || 'grid'
        }));
        
        // Ensure at least one default view exists
        if (viewList.length === 0) {
            viewList.push({ 
                id: 'all', 
                label: 'All Records', 
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
        if (viewId) {
             // In view route, replace last segment
             navigate(`../${newViewId}`, { relative: "path" });
        } else {
             // In root route, append view
             navigate(`view/${newViewId}`);
        }
    };

    // Build ViewSwitcher schema from object's list_views
    const viewSwitcherSchema: ViewSwitcherSchema = useMemo(() => ({
        type: 'view-switcher' as const,
        variant: 'tabs',
        position: 'top',
        persistPreference: true,
        storageKey: `view-pref-${objectName}`,
        defaultView: (activeView?.type || 'grid') as ViewType,
        activeView: (activeView?.type || 'grid') as ViewType,
        views: views.map((v: any) => ({
            type: v.type as ViewType,
            label: v.label,
            icon: v.type === 'kanban' ? 'kanban' :
                  v.type === 'calendar' ? 'calendar' :
                  v.type === 'gantt' ? 'align-left' :
                  v.type === 'map' ? 'map' :
                  v.type === 'chart' ? 'bar-chart' :
                  'table',
        })),
    }), [views, activeView, objectName]);

    // Handle ViewSwitcher view change (receives ViewType, map to view id)
    const handleViewTypeChange = (viewType: ViewType) => {
        const matchedView = views.find((v: any) => v.type === viewType);
        if (matchedView) {
            handleViewChange(matchedView.id);
        }
    };

    // --- Filter & Sort State ---
    const [filterValues, setFilterValues] = useState<Record<string, any>>({});
    const [sortConfig, setSortConfig] = useState<Array<{ field: string; direction: 'asc' | 'desc' }>>(activeView.sort || []);

    // Build FilterUI schema from object field definitions
    const filterSchema: FilterUISchema = useMemo(() => {
        const fields = objectDef.fields || {};
        const filterableFields = Object.entries(fields)
            .filter(([, f]: [string, any]) => !f.hidden)
            .slice(0, 8) // Limit to 8 most relevant fields
            .map(([key, f]: [string, any]) => {
                const fieldType = f.type || 'text';
                let filterType: 'text' | 'number' | 'select' | 'date' | 'boolean' = 'text';
                let options: Array<{ label: string; value: any }> | undefined;

                if (fieldType === 'number' || fieldType === 'currency' || fieldType === 'percent') {
                    filterType = 'number';
                } else if (fieldType === 'boolean' || fieldType === 'toggle') {
                    filterType = 'boolean';
                } else if (fieldType === 'date' || fieldType === 'datetime') {
                    filterType = 'date';
                } else if (fieldType === 'select' || f.options) {
                    filterType = 'select';
                    options = (f.options || []).map((o: any) =>
                        typeof o === 'string' ? { label: o, value: o } : { label: o.label, value: o.value }
                    );
                }

                return {
                    field: key,
                    label: f.label || key,
                    type: filterType,
                    placeholder: `Filter ${f.label || key}...`,
                    ...(options ? { options } : {}),
                };
            });

        return {
            type: 'filter-ui' as const,
            layout: 'popover' as const,
            showClear: true,
            showApply: true,
            filters: filterableFields,
            values: filterValues,
        };
    }, [objectDef, filterValues]);

    // Build SortUI schema from object field definitions
    const sortSchema: SortUISchema = useMemo(() => {
        const fields = objectDef.fields || {};
        const sortableFields = Object.entries(fields)
            .filter(([, f]: [string, any]) => !f.hidden)
            .slice(0, 10)
            .map(([key, f]: [string, any]) => ({
                field: key,
                label: f.label || key,
            }));

        return {
            type: 'sort-ui' as const,
            variant: 'dropdown' as const,
            multiple: false,
            fields: sortableFields,
            sort: sortConfig,
        };
    }, [objectDef, sortConfig]);

    const handleFilterChange = useCallback((values: Record<string, any>) => {
        setFilterValues(values);
    }, []);

    const handleSortChange = useCallback((sort: SortUISchema['sort']) => {
        setSortConfig(sort || []);
    }, []);

    // Action system for toolbar operations
    const [refreshKey, setRefreshKey] = useState(0);
    const actions = useObjectActions({
        objectName: objectDef.name,
        objectLabel: objectDef.label,
        dataSource,
        onEdit,
        onRefresh: () => setRefreshKey(k => k + 1),
    });
    
    // Drawer Logic
    const drawerRecordId = searchParams.get('recordId');
    const handleDrawerClose = () => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('recordId');
        setSearchParams(newParams);
    };

    const renderCurrentView = () => {
        const key = `${objectName}-${activeView.id}-${refreshKey}`;
        
        // Helper to pass dataSource if component needs it
        const interactionProps = {
            onEdit,
            onRowClick: onRowClick || ((record: any) => onEdit(record)), 
            dataSource
        };

        if (activeView.type === 'chart') {
             return (
                 <ObjectChart 
                     key={key}
                     dataSource={dataSource}
                     schema={{
                         type: 'object-chart',
                         objectName: objectDef.name,
                         chartType: activeView.chartType,
                         xAxisField: activeView.xAxisField,
                         yAxisFields: activeView.yAxisFields,
                         aggregation: activeView.aggregation,
                         series: activeView.series,
                         config: activeView.config,
                         filter: activeView.filter
                     } as any}
                 />
             );
        }

        // Use standard ListView for supported types
        // Mapped options to ensure plugin components receive correct configuration
        // Merge user filter/sort selections with the view's default filter/sort
        const mergedFilters = Object.keys(filterValues).length > 0
            ? Object.entries(filterValues)
                .filter(([, v]) => v !== undefined && v !== '' && v !== null)
                .map(([field, value]) => ({ field, operator: 'equals' as const, value }))
            : activeView.filter;
        const mergedSort = sortConfig.length > 0 ? sortConfig : activeView.sort;

        const listViewSchema: ListViewSchema = {
            type: 'list-view',
            id: activeView.id, // Pass the View ID to the schema
            objectName: objectDef.name,
            viewType: activeView.type,
            fields: activeView.columns,
            filters: mergedFilters,
            sort: mergedSort,
            options: {
                kanban: {
                     groupBy: activeView.groupBy || activeView.groupField || 'status',
                     groupField: activeView.groupBy || activeView.groupField || 'status',
                     titleField: activeView.titleField || objectDef.titleField || 'name',
                     cardFields: activeView.columns || activeView.cardFields
                },
                calendar: {
                    startDateField: activeView.startDateField || activeView.dateField || 'due_date',
                    endDateField: activeView.endDateField || activeView.endField,
                    titleField: activeView.titleField || activeView.subjectField || 'name',
                    colorField: activeView.colorField,
                    allDayField: activeView.allDayField,
                    defaultView: activeView.defaultView
                },
                timeline: {
                    dateField: activeView.dateField || activeView.startDateField || 'due_date',
                    titleField: activeView.titleField || objectDef.titleField || 'name',
                    descriptionField: activeView.descriptionField,
                },
                map: {
                    locationField: activeView.locationField,
                    titleField: activeView.titleField || objectDef.titleField || 'name',
                    latitudeField: activeView.latitudeField,
                    longitudeField: activeView.longitudeField,
                    zoom: activeView.zoom,
                    center: activeView.center
                },
                gallery: {
                    imageField: activeView.imageField || 'image',
                    titleField: activeView.titleField || objectDef.titleField || 'name',
                    subtitleField: activeView.subtitleField
                },
                gantt: {
                    startDateField: activeView.startDateField || 'start_date',
                    endDateField: activeView.endDateField || 'end_date',
                    titleField: activeView.titleField || 'name',
                    progressField: activeView.progressField,
                    dependenciesField: activeView.dependenciesField,
                    colorField: activeView.colorField
                },
                chart: {
                    chartType: activeView.chartType,
                    xAxisField: activeView.xAxisField,
                    yAxisFields: activeView.yAxisFields,
                    aggregation: activeView.aggregation,
                    series: activeView.series,
                    config: activeView.config,
                }
            }
        };

        return (
            <ListView
                key={key}
                schema={listViewSchema}
                className="h-full"
                {...interactionProps}
            />
        );
    };

    return (
        <div className="h-full flex flex-col bg-background">
             {/* 1. Main Header */}
             <div className="flex justify-between items-center py-3 px-4 border-b shrink-0 bg-background z-10">
                 <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-md shrink-0">
                        <TableIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight text-foreground">{objectDef.label}</h1>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-2">
                    <MetadataToggle open={showDebug} onToggle={toggleDebug} className="hidden sm:flex" />
                    <Button size="sm" onClick={actions.create} className="shadow-none gap-2">
                        <Plus className="h-4 w-4" /> 
                        <span className="hidden sm:inline">New</span>
                    </Button>
                 </div>
             </div>

             {/* 2. View Toolbar — Schema-Driven ViewSwitcher */}
             <div className="flex justify-between items-center py-2 px-4 border-b shrink-0 bg-muted/20">
                 <ViewSwitcher
                     schema={viewSwitcherSchema}
                     onViewChange={handleViewTypeChange}
                     className="overflow-x-auto no-scrollbar"
                 />

                 {/* Right: Filter & Sort Controls */}
                 <div className="hidden md:flex items-center gap-2">
                     <FilterUI
                         schema={filterSchema}
                         onChange={handleFilterChange}
                     />
                     <SortUI
                         schema={sortSchema}
                         onChange={handleSortChange}
                     />
                 </div>
             </div>

             {/* 3. Content Area (Edge-to-Edge) */}
             <div className="flex-1 overflow-hidden relative flex flex-row">
                <div className="flex-1 relative h-full">
                    <div className="absolute inset-0">
                        {renderCurrentView()}
                    </div>
                </div>
                <MetadataPanel
                    open={showDebug}
                    sections={[
                        { title: 'View Configuration', data: activeView },
                        { title: 'Object Definition', data: objectDef },
                    ]}
                />
             </div>

             {/* Drawer for Record Details */}
             <Sheet open={!!drawerRecordId} onOpenChange={(open) => !open && handleDrawerClose()}>
                <SheetContent side="right" className="w-[85vw] sm:w-150 sm:max-w-none p-0 overflow-hidden">
                    {drawerRecordId && (
                        <div className="h-full bg-background overflow-auto p-4 lg:p-6">
                            <DetailView
                                schema={{
                                    type: 'detail-view',
                                    objectName: objectDef.name,
                                    resourceId: drawerRecordId,
                                    showBack: false, // No back button in drawer
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
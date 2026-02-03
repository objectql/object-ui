import { useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ObjectGrid } from '@object-ui/plugin-grid';
import { ObjectKanban } from '@object-ui/plugin-kanban';
import { ObjectCalendar } from '@object-ui/plugin-calendar';
import { ObjectGantt } from '@object-ui/plugin-gantt';
import { Button, Tabs, TabsList, TabsTrigger } from '@object-ui/components';
import { Plus, Calendar as CalendarIcon, Kanban as KanbanIcon, Table as TableIcon, AlignLeft } from 'lucide-react';

export function ObjectView({ dataSource, objects, onEdit }: any) {
    const { objectName } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const [refreshKey, setRefreshKey] = useState(0);
    
    // Get Object Definition
    const objectDef = objects.find((o: any) => o.name === objectName);

    if (!objectDef) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/30 rounded-lg border border-dashed p-8 m-4">
          <h3 className="font-semibold text-lg">Object Not Found</h3>
          <p>The object "{objectName}" does not exist in the current configuration.</p>
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
    const activeViewId = searchParams.get('view') || views[0]?.id;
    const activeView = views.find((v: any) => v.id === activeViewId) || views[0];

    // Helper: Normalize Columns for Grid
    const getGridColumns = (view: any) => {
        if (!view.columns) return [];
        return view.columns.map((colName: string) => {
             // Find field definition
             const fieldDef = Array.isArray(objectDef.fields) 
                ? objectDef.fields.find((f: any) => f.name === colName)
                : objectDef.fields?.[colName];
             
             return {
                 field: colName,
                 label: fieldDef?.label || colName,
                 width: 150
             };
        });
    };

    const handleViewChange = (viewId: string) => {
        setSearchParams({ view: viewId });
    };

    const renderCurrentView = () => {
        const key = `${objectName}-${activeView.id}-${refreshKey}`;
        const commonProps = {
            dataSource,
            className: "h-full border-none"
        };
        
        // Define onRowClick/Edit handlers
        const interactionProps = {
            onEdit,
            onRowClick: (record: any) => onEdit(record), // Default to edit on click
        };

        switch (activeView.type) {
            case 'kanban':
                return (
                    <ObjectKanban 
                        key={key}
                        {...commonProps}
                        schema={{
                            type: 'kanban',
                            objectName: objectDef.name,
                            groupBy: activeView.groupBy || 'status',
                            columns: activeView.columns,
                            cardTitle: objectDef.titleField || 'name', // Default title field
                            cardFields: activeView.columns
                        }}
                        {...interactionProps}
                    />
                );
            case 'calendar':
                return (
                    <ObjectCalendar 
                        key={key}
                        {...commonProps}
                        schema={{
                            type: 'calendar',
                            objectName: objectDef.name,
                            dateField: activeView.dateField || 'due_date',
                            endField: activeView.endField,
                            titleField: activeView.titleField || 'name',
                            colorField: activeView.colorField,
                        }}
                       {...interactionProps}
                    />
                );
            case 'gantt':
                return (
                    <ObjectGantt
                        key={key}
                        {...commonProps}
                        schema={{
                            type: 'gantt',
                            objectName: objectDef.name,
                            filter: {
                                gantt: {
                                    startDateField: activeView.startDateField || 'start_date',
                                    endDateField: activeView.endDateField || 'end_date',
                                    titleField: activeView.titleField || 'name',
                                    progressField: activeView.progressField || 'progress',
                                    dependenciesField: activeView.dependenciesField,
                                    colorField: activeView.colorField,
                                }
                            }
                        }}
                        {...interactionProps}
                    />
                );
            case 'grid':
            default:
                return (
                    <ObjectGrid
                        key={key}
                        {...commonProps}
                        schema={{
                            type: 'object-grid',
                            objectName: objectDef.name,
                            filterable: true,
                            columns: getGridColumns(activeView),
                            filter: activeView.filter,
                            sort: activeView.sort
                        }}
                        {...interactionProps}
                        onDelete={async (record: any) => {
                            if (confirm(`Delete record?`)) {
                                await dataSource.delete(objectName, record.id || record._id);
                                setRefreshKey(k => k + 1);
                            }
                        }}
                    />
                );
        }
    };

    return (
        <div className="h-full flex flex-col gap-4">
             {/* Header Section */}
             <div className="flex justify-between items-start">
                 <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">{objectDef.label}</h1>
                    <div className="flex items-center gap-2">
                        {/* View Switcher Tabs */}
                        {views.length > 1 && (
                            <Tabs value={activeView.id} onValueChange={handleViewChange} className="h-8">
                                <TabsList className="h-8 p-0 bg-transparent border-0 gap-2">
                                    {views.map((v: any) => (
                                        <TabsTrigger 
                                            key={v.id} 
                                            value={v.id}
                                            className="h-8 px-3 data-[state=active]:bg-muted data-[state=active]:shadow-none border border-transparent data-[state=active]:border-border rounded-md transition-all"
                                        >
                                            {v.type === 'kanban' && <KanbanIcon className="mr-2 h-3.5 w-3.5" />}
                                            {v.type === 'calendar' && <CalendarIcon className="mr-2 h-3.5 w-3.5" />}
                                            {v.type === 'grid' && <TableIcon className="mr-2 h-3.5 w-3.5" />}
                                            {v.type === 'gantt' && <AlignLeft className="mr-2 h-3.5 w-3.5" />}
                                            {v.label}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                        )}
                        {views.length <= 1 && (
                             <p className="text-slate-500 text-sm">
                                {objectDef.description || 'Manage your records'}
                             </p>
                        )}
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <Button onClick={() => onEdit(null)} className="shadow-none">
                        <Plus className="mr-2 h-4 w-4" /> New {objectDef.label}
                    </Button>
                 </div>
             </div>

             {/* Content Area */}
             <div className="flex-1 rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden p-0 relative">
                <div className="absolute inset-0">
                    {renderCurrentView()}
                </div>
             </div>
        </div>
    );
}

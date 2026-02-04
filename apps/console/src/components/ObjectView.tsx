import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ObjectGantt } from '@object-ui/plugin-gantt';
import { ListView } from '@object-ui/plugin-list';
// Import plugins for side-effects (registration)
import '@object-ui/plugin-grid';
import '@object-ui/plugin-kanban';
import '@object-ui/plugin-calendar';
import { Button, Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { Plus, Calendar as CalendarIcon, Kanban as KanbanIcon, Table as TableIcon, AlignLeft } from 'lucide-react';
import type { ListViewSchema } from '@object-ui/types';

export function ObjectView({ dataSource, objects, onEdit }: any) {
    const { objectName } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    
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
    const activeViewId = searchParams.get('view') || views[0]?.id;
    const activeView = views.find((v: any) => v.id === activeViewId) || views[0];

    const handleViewChange = (viewId: string) => {
        setSearchParams({ view: viewId });
    };

    const renderCurrentView = () => {
        const key = `${objectName}-${activeView.id}`;
        const commonProps = {
            dataSource,
            className: "h-full border-none"
        };
        
        // Define onRowClick/Edit handlers
        const interactionProps = {
            onEdit,
            onRowClick: (record: any) => onEdit(record), // Default to edit on click
        };

        // Gantt is not yet supported by ListView, handle separately
        if (activeView.type === 'gantt') {
           return (
                <ObjectGantt
                    key={key}
                    {...commonProps}
                    schema={{
                        type: 'object-grid',
                        objectName: objectDef.name,
                        gantt: {
                            startDateField: activeView.startDateField || 'start_date',
                            endDateField: activeView.endDateField || 'end_date',
                            titleField: activeView.titleField || 'name',
                            progressField: activeView.progressField || 'progress',
                            dependenciesField: activeView.dependenciesField,
                            colorField: activeView.colorField,
                        }
                    } as any}
                    {...interactionProps}
                />
            );
        }

        // Use standard ListView for supported types
        const listViewSchema: ListViewSchema = {
            type: 'list-view',
            objectName: objectDef.name,
            viewType: activeView.type,
            fields: activeView.columns,
            filters: activeView.filter,
            sort: activeView.sort,
            options: {
                kanban: {
                     groupField: activeView.groupBy || 'status',
                     titleField: objectDef.titleField || 'name',
                     cardFields: activeView.columns
                },
                calendar: {
                    startDateField: activeView.startDateField || activeView.dateField || 'due_date',
                    endDateField: activeView.endDateField || activeView.endField,
                    titleField: activeView.titleField || 'name',
                    colorField: activeView.colorField,
                    allDayField: activeView.allDayField,
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
                    <Button size="sm" onClick={() => onEdit(null)} className="shadow-none gap-2">
                        <Plus className="h-4 w-4" /> 
                        <span className="hidden sm:inline">New</span>
                    </Button>
                 </div>
             </div>

             {/* 2. View Toolbar (Tabs & Controls) */}
             <div className="flex justify-between items-center py-2 px-4 border-b shrink-0 bg-muted/20">
                 {/* Left: View Tabs */}
                 <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {views.map((v: any) => {
                        const isActive = activeView.id === v.id;
                        return (
                            <button
                                key={v.id}
                                onClick={() => handleViewChange(v.id)}
                                className={`
                                    flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap
                                    ${isActive 
                                        ? 'bg-background shadow-sm text-foreground ring-1 ring-border/50' 
                                        : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                                    }
                                `}
                            >
                                {v.type === 'kanban' && <KanbanIcon className="h-3.5 w-3.5 opacity-70" />}
                                {v.type === 'calendar' && <CalendarIcon className="h-3.5 w-3.5 opacity-70" />}
                                {v.type === 'grid' && <TableIcon className="h-3.5 w-3.5 opacity-70" />}
                                {v.type === 'gantt' && <AlignLeft className="h-3.5 w-3.5 opacity-70" />}
                                <span>{v.label}</span>
                            </button>
                        );
                    })}
                 </div>

                 {/* Right: View Options (Placeholder for now) */}
                 <div className="flex items-center gap-2 hidden md:flex">
                     {/* Filter/Sort are handled by ListView now */}
                 </div>
             </div>

             {/* 3. Content Area (Edge-to-Edge) */}
             <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0">
                    {renderCurrentView()}
                </div>
             </div>
        </div>
    );
}
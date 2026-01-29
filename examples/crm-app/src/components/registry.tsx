import { ComponentRegistry } from '@object-ui/core';
import { useDataScope } from '@object-ui/react';
import { cn } from '@object-ui/components';

// 1. Metric Widget
const MetricWidget = ({ schema }: any) => {
    const { value, label, trend, format } = schema.props || {};
    const isPositive = trend?.startsWith('+');
    
    // Simple resolution logic if needed, or assume pre-resolved
    const { scope } = useDataScope();
    const resolvedValue = resolveExpression(value, scope);
    
    return (
        <div className="flex flex-col gap-1">
            <div className="text-2xl font-bold">
                 {format === 'currency' && typeof resolvedValue === 'number' 
                    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(resolvedValue)
                    : resolvedValue}
            </div>
            <div className="text-xs text-muted-foreground">
                {trend && (
                    <span className={cn("mr-1 font-medium", isPositive ? "text-green-600" : "text-red-600")}>
                        {trend}
                    </span>
                )}
                {label}
            </div>
        </div>
    );
};

// 2. Simple CSS Bar Chart
const ChartWidget = ({ schema }: any) => {
    const { title, data, height = 200 } = schema.props || {};
    const safeData = Array.isArray(data) ? data : [];
    const maxValue = Math.max(...(safeData.map((d: any) => d.value) || [100]));
    
    return (
        <div className="flex flex-col h-full w-full">
            {title && <h3 className="text-sm font-medium mb-4">{title}</h3>}
            <div className="flex items-end justify-around w-full" style={{ height: `${height}px` }}>
                {safeData.map((item: any, i: number) => {
                    const percent = (item.value / maxValue) * 100;
                    return (
                        <div key={i} className="flex flex-col items-center gap-2 group w-full px-1">
                             <div className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                {item.value}
                            </div>
                            <div 
                                className="w-full rounded-t hover:opacity-80 transition-all"
                                style={{ 
                                    height: `${percent}%`, 
                                    backgroundColor: item.fill || '#3b82f6' 
                                }}
                            />
                            <div className="text-xs text-center text-muted-foreground truncate w-full">
                                {item.name}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// 3. Timeline View
const TimelineView = ({ schema }: any) => {
    const { items } = schema.props || {};
    
    return (
        <div className={cn("space-y-8", schema.className)}>
            {items?.map((item: any, i: number) => (
                <div key={i} className="flex gap-4">
                    <div className="relative mt-1">
                        <div className="absolute top-8 left-1/2 h-full w-px -translate-x-1/2 bg-gray-200" />
                        <div className="relative flex h-8 w-8 items-center justify-center rounded-full border bg-background shadow-sm">
                             <div className="w-2 h-2 rounded-full bg-blue-500" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 pb-8">
                        <p className="text-sm font-medium leading-none">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                        <p className="text-xs text-muted-foreground">{item.date}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

// 4. List View (Simple)
const ListView = ({ schema }: any) => {
    const { scope } = useDataScope();
    let data = schema.data; 

    if (schema.bind) {
         // Resolve simple property path from scope
         data = scope ? scope[schema.bind] : [];
    }
    
    if (!data || !Array.isArray(data)) return <div className="p-4 text-muted-foreground">No data found</div>;
    
    return (
        <div className="space-y-2">
            {data.slice(0, schema.props?.limit || 10).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded bg-card text-card-foreground">
                    <div className="flex flex-col">
                        <span className="font-medium text-sm">{resolveExpression(schema.props?.render?.title, item) || item.name}</span>
                        <span className="text-xs text-muted-foreground">{resolveExpression(schema.props?.render?.description, item)}</span>
                    </div>
                    {schema.props?.render?.extra && (
                         <div className="text-xs font-semibold px-2 py-1 bg-secondary rounded">
                            {resolveExpression(schema.props?.render?.extra, item)}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

function resolveExpression(expr: string, context: any) {
    if (typeof expr !== 'string') return expr;
    // Handle simplified ${prop}
    return expr.replace(/\$\{(.*?)\}/g, (match, key) => {
        // Strip data. prefix if simple context binding
        const cleanKey = key.replace(/^data\./, '');
        // Traverse object properties
        const val = cleanKey.split('.').reduce((o: any, i: string) => (o ? o[i] : null), context);
        return val !== undefined && val !== null ? val : match;
    });
}

export function registerCustomWidgets() {
    ComponentRegistry.register("widget:metric", MetricWidget);
    ComponentRegistry.register("widget:chart", ChartWidget);
    ComponentRegistry.register("view:timeline", TimelineView);
    ComponentRegistry.register("view:list", ListView);
}

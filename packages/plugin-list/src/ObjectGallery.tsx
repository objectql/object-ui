
import React from 'react';
import { useDataScope } from '@object-ui/react';
import { ComponentRegistry } from '@object-ui/core';

// Utility for class merging (assuming it's available in plugin context, 
// usually provided by @object-ui/components or utils, but here I'll just use string concat if not imported)
// Actually @object-ui/components exports cn
import { cn } from '@object-ui/components';

export const ObjectGallery = (props: any) => {
    const { schema } = props;
    const { data, isLoading } = useDataScope();
    const items = data?.value || [];
    
    // Config
    const imageField = schema.imageField || 'image';
    const titleField = schema.titleField || 'name';
    const subtitleField = schema.subtitleField;

    if (isLoading && !items.length) return <div className="p-4 text-sm text-muted-foreground">Loading Gallery...</div>;
    if (!items.length) return <div className="p-4 text-sm text-muted-foreground">No items to display</div>;

    return (
        <div className={cn("grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4", schema.className)}>
            {items.map((item: any, i: number) => (
                <div key={item._id || i} className="group relative border rounded-lg overflow-hidden bg-card text-card-foreground shadow-sm hover:shadow-md transition-all">
                    <div className="aspect-square w-full overflow-hidden bg-muted relative">
                        {item[imageField] ? (
                            <img 
                                src={item[imageField]} 
                                alt={item[titleField]} 
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://placehold.co/400x400?text=${encodeURIComponent(item[titleField]?.[0] || '?')}`;
                                }}
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-secondary/50 text-muted-foreground">
                                <span className="text-4xl font-light opacity-20">{item[titleField]?.[0]?.toUpperCase()}</span>
                            </div>
                        )}
                    </div>
                    <div className="p-3 border-t">
                        <h3 className="font-medium truncate text-sm" title={item[titleField]}>{item[titleField] || 'Untitled'}</h3>
                        {subtitleField && (
                             <p className="text-xs text-muted-foreground truncate mt-1">{item[subtitleField]}</p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

ComponentRegistry.register('object-gallery', ObjectGallery, {
    namespace: 'plugin-list',
    label: 'Gallery View',
    category: 'view'
});

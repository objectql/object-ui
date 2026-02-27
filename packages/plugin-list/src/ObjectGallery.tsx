/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { useDataScope, SchemaRendererContext, useNavigationOverlay } from '@object-ui/react';
import { ComponentRegistry, buildExpandFields } from '@object-ui/core';
import { cn, Card, CardContent, NavigationOverlay } from '@object-ui/components';
import type { GalleryConfig, ViewNavigationConfig, GroupingConfig } from '@object-ui/types';
import { ChevronRight, ChevronDown } from 'lucide-react';

export interface ObjectGalleryProps {
    schema: {
        objectName?: string;
        bind?: string;
        filter?: unknown;
        data?: Record<string, unknown>[];
        className?: string;
        gallery?: GalleryConfig;
        /** Navigation config for item click behavior */
        navigation?: ViewNavigationConfig;
        /** Grouping configuration for sectioned display */
        grouping?: GroupingConfig;
        /** @deprecated Use gallery.coverField instead */
        imageField?: string;
        /** @deprecated Use gallery.titleField instead */
        titleField?: string;
        subtitleField?: string;
    };
    data?: Record<string, unknown>[];
    dataSource?: { find: (name: string, query: unknown) => Promise<unknown> };
    onCardClick?: (record: Record<string, unknown>) => void;
    /** Callback when a row/item is clicked (overrides NavigationConfig) */
    onRowClick?: (record: Record<string, unknown>) => void;
}

const GRID_CLASSES: Record<NonNullable<GalleryConfig['cardSize']>, string> = {
    small: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
    medium: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    large: 'grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
};

const ASPECT_CLASSES: Record<NonNullable<GalleryConfig['cardSize']>, string> = {
    small: 'aspect-square',
    medium: 'aspect-[4/3]',
    large: 'aspect-[16/10]',
};

export const ObjectGallery: React.FC<ObjectGalleryProps> = (props) => {
    const { schema } = props;
    const context = useContext(SchemaRendererContext);
    const dataSource = props.dataSource || context?.dataSource;
    const boundData = useDataScope(schema.bind);

    const [fetchedData, setFetchedData] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(false);
    const [objectDef, setObjectDef] = useState<any>(null);

    // --- NavigationConfig support ---
    const navigation = useNavigationOverlay({
        navigation: schema.navigation,
        objectName: schema.objectName,
        onRowClick: props.onRowClick ?? props.onCardClick,
    });

    // Resolve GalleryConfig with backwards-compatible fallbacks
    const gallery = schema.gallery;
    const coverField = gallery?.coverField ?? schema.imageField ?? 'image';
    const coverFit = gallery?.coverFit ?? 'cover';
    const cardSize = gallery?.cardSize ?? 'medium';
    const titleField = gallery?.titleField ?? schema.titleField ?? 'name';
    const visibleFields = gallery?.visibleFields;

    // Fetch object definition for metadata
    useEffect(() => {
        let isMounted = true;
        const fetchMeta = async () => {
            if (!dataSource || typeof dataSource.getObjectSchema !== 'function' || !schema.objectName) return;
            try {
                const def = await dataSource.getObjectSchema(schema.objectName);
                if (isMounted) setObjectDef(def);
            } catch (e) {
                console.warn('Failed to fetch object def for ObjectGallery', e);
            }
        };
        fetchMeta();
        return () => { isMounted = false; };
    }, [schema.objectName, dataSource]);

    useEffect(() => {
        let isMounted = true;

        if (props.data && Array.isArray(props.data)) {
            setFetchedData(props.data);
            return;
        }

        const fetchData = async () => {
            if (!dataSource || typeof dataSource.find !== 'function' || !schema.objectName) return;
            if (isMounted) setLoading(true);
            try {
                // Auto-inject $expand for lookup/master_detail fields
                const expand = buildExpandFields(objectDef?.fields);
                const results = await dataSource.find(schema.objectName, {
                    $filter: schema.filter,
                    ...(expand.length > 0 ? { $expand: expand } : {}),
                });

                let data: Record<string, unknown>[] = [];
                if (Array.isArray(results)) {
                    data = results;
                } else if (results && typeof results === 'object') {
                    const r = results as Record<string, unknown>;
                    if (Array.isArray(r.records)) {
                        data = r.records as Record<string, unknown>[];
                    } else if (Array.isArray(r.data)) {
                        data = r.data as Record<string, unknown>[];
                    }
                }

                if (isMounted) {
                    setFetchedData(data);
                }
            } catch (e) {
                console.error('[ObjectGallery] Fetch error:', e);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        if (schema.objectName && !boundData && !schema.data && !props.data) {
            fetchData();
        }
        return () => { isMounted = false; };
    }, [schema.objectName, dataSource, boundData, schema.data, schema.filter, props.data, objectDef]);

    const items: Record<string, unknown>[] = props.data || boundData || schema.data || fetchedData || [];

    // --- Grouping support ---
    const groupingFields = schema.grouping?.fields;
    const isGrouped = !!(groupingFields && groupingFields.length > 0);

    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    // Initialize collapsed state from grouping config
    const defaultCollapsed = useMemo(() => {
        if (!groupingFields) return false;
        return groupingFields.some((f) => f.collapsed);
    }, [groupingFields]);

    const toggleGroup = useCallback((key: string) => {
        setCollapsedGroups((prev) => ({
            ...prev,
            [key]: prev[key] !== undefined ? !prev[key] : !defaultCollapsed,
        }));
    }, [defaultCollapsed]);

    const groupedItems = useMemo(() => {
        if (!isGrouped || !groupingFields) return [];
        const map = new Map<string, { label: string; items: Record<string, unknown>[] }>();
        const keyOrder: string[] = [];
        for (const item of items) {
            const key = groupingFields.map((f) => String(item[f.field] ?? '')).join(' / ');
            if (!map.has(key)) {
                const label = groupingFields
                    .map((f) => {
                        const val = item[f.field];
                        return val !== undefined && val !== null && val !== '' ? String(val) : '(empty)';
                    })
                    .join(' / ');
                map.set(key, { label, items: [] });
                keyOrder.push(key);
            }
            map.get(key)!.items.push(item);
        }
        const primaryOrder = groupingFields[0]?.order ?? 'asc';
        keyOrder.sort((a, b) => {
            const cmp = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
            return primaryOrder === 'desc' ? -cmp : cmp;
        });
        return keyOrder.map((key) => {
            const entry = map.get(key)!;
            const collapsed = key in collapsedGroups ? collapsedGroups[key] : defaultCollapsed;
            return { key, label: entry.label, items: entry.items, collapsed };
        });
    }, [items, groupingFields, isGrouped, collapsedGroups, defaultCollapsed]);

    if (loading && !items.length) return <div className="p-4 text-sm text-muted-foreground">Loading Gallery...</div>;
    if (!items.length) return <div className="p-4 text-sm text-muted-foreground">No items to display</div>;

    const renderCard = (item: Record<string, unknown>, i: number) => {
        const id = (item._id ?? item.id ?? i) as string | number;
        const title = String(item[titleField] ?? 'Untitled');
        const imageUrl = item[coverField] as string | undefined;

        return (
            <Card
                key={id}
                role="listitem"
                className={cn(
                    'group overflow-hidden transition-all hover:shadow-md',
                    (props.onCardClick || props.onRowClick || schema.navigation) && 'cursor-pointer',
                )}
                onClick={() => navigation.handleClick(item)}
            >
                <div className={cn('w-full overflow-hidden bg-muted relative', ASPECT_CLASSES[cardSize])}>
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={title}
                            className={cn(
                                'h-full w-full transition-transform group-hover:scale-105',
                                coverFit === 'cover' && 'object-cover',
                                coverFit === 'contain' && 'object-contain',
                            )}
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-secondary/50 text-muted-foreground">
                            <span className="text-4xl font-light opacity-20">
                                {title[0]?.toUpperCase()}
                            </span>
                        </div>
                    )}
                </div>
                <CardContent className="p-3 border-t">
                    <h3 className="font-medium truncate text-sm" title={title}>
                        {title}
                    </h3>
                    {visibleFields && visibleFields.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                            {visibleFields.map((field) => {
                                const value = item[field];
                                if (value == null) return null;
                                return (
                                    <p key={field} className="text-xs text-muted-foreground truncate">
                                        {String(value)}
                                    </p>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    const renderGrid = (gridItems: Record<string, unknown>[]) => (
        <div
            className={cn('grid gap-4 p-4', GRID_CLASSES[cardSize], schema.className)}
            role="list"
        >
            {gridItems.map((item, i) => renderCard(item, i))}
        </div>
    );

    return (
        <>
            {isGrouped ? (
                <div className="space-y-2">
                    {groupedItems.map((group) => (
                        <div key={group.key} className="border rounded-md">
                            <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-left bg-muted/50 hover:bg-muted transition-colors"
                                onClick={() => toggleGroup(group.key)}
                            >
                                {group.collapsed
                                    ? <ChevronRight className="h-4 w-4 shrink-0" />
                                    : <ChevronDown className="h-4 w-4 shrink-0" />}
                                <span>{group.label}</span>
                                <span className="ml-auto text-xs text-muted-foreground">{group.items.length}</span>
                            </button>
                            {!group.collapsed && renderGrid(group.items)}
                        </div>
                    ))}
                </div>
            ) : (
                renderGrid(items)
            )}
            {navigation.isOverlay && (
                <NavigationOverlay {...navigation} title="Gallery Item">
                    {(record) => (
                        <div className="space-y-3">
                            {Object.entries(record).map(([key, value]) => (
                                <div key={key} className="flex flex-col">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                        {key.replace(/_/g, ' ')}
                                    </span>
                                    <span className="text-sm">{String(value ?? '—')}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </NavigationOverlay>
            )}
        </>
    );
};

ComponentRegistry.register('object-gallery', ObjectGallery, {
    namespace: 'plugin-list',
    label: 'Gallery View',
    category: 'view',
});

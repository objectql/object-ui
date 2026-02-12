/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect } from 'react';
import { useDataScope, useSchemaContext } from '@object-ui/react';
import { ComponentRegistry } from '@object-ui/core';
import { cn, Card, CardContent } from '@object-ui/components';
import type { GalleryConfig } from '@object-ui/types';

export interface ObjectGalleryProps {
    schema: {
        objectName?: string;
        bind?: string;
        filter?: unknown;
        data?: Record<string, unknown>[];
        className?: string;
        gallery?: GalleryConfig;
        /** @deprecated Use gallery.coverField instead */
        imageField?: string;
        /** @deprecated Use gallery.titleField instead */
        titleField?: string;
        subtitleField?: string;
    };
    data?: Record<string, unknown>[];
    dataSource?: { find: (name: string, query: unknown) => Promise<unknown> };
    onCardClick?: (record: Record<string, unknown>) => void;
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
    const context = useSchemaContext();
    const dataSource = props.dataSource || context.dataSource;
    const boundData = useDataScope(schema.bind);

    const [fetchedData, setFetchedData] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(false);

    // Resolve GalleryConfig with backwards-compatible fallbacks
    const gallery = schema.gallery;
    const coverField = gallery?.coverField ?? schema.imageField ?? 'image';
    const coverFit = gallery?.coverFit ?? 'cover';
    const cardSize = gallery?.cardSize ?? 'medium';
    const titleField = gallery?.titleField ?? schema.titleField ?? 'name';
    const visibleFields = gallery?.visibleFields;

    useEffect(() => {
        let isMounted = true;

        if (props.data && Array.isArray(props.data)) {
            setFetchedData(props.data);
            return;
        }

        const fetchData = async () => {
            if (!dataSource || !schema.objectName) return;
            if (isMounted) setLoading(true);
            try {
                const results = await dataSource.find(schema.objectName, {
                    $filter: schema.filter,
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
    }, [schema.objectName, dataSource, boundData, schema.data, schema.filter, props.data]);

    const items: Record<string, unknown>[] = props.data || boundData || schema.data || fetchedData || [];

    if (loading && !items.length) return <div className="p-4 text-sm text-muted-foreground">Loading Gallery...</div>;
    if (!items.length) return <div className="p-4 text-sm text-muted-foreground">No items to display</div>;

    return (
        <div
            className={cn('grid gap-4 p-4', GRID_CLASSES[cardSize], schema.className)}
            role="list"
        >
            {items.map((item, i) => {
                const id = (item._id ?? item.id ?? i) as string | number;
                const title = String(item[titleField] ?? 'Untitled');
                const imageUrl = item[coverField] as string | undefined;

                return (
                    <Card
                        key={id}
                        role="listitem"
                        className={cn(
                            'group overflow-hidden transition-all hover:shadow-md',
                            props.onCardClick && 'cursor-pointer',
                        )}
                        onClick={props.onCardClick ? () => props.onCardClick!(item) : undefined}
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
            })}
        </div>
    );
};

ComponentRegistry.register('object-gallery', ObjectGallery, {
    namespace: 'plugin-list',
    label: 'Gallery View',
    category: 'view',
});

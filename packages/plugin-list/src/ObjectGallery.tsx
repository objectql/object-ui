/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { useDataScope, SchemaRendererContext, useNavigationOverlay, useSafeFieldLabel } from '@object-ui/react';
import { ComponentRegistry, buildExpandFields, getRecordDisplayName } from '@object-ui/core';
import { cn, Card, CardContent, NavigationOverlay } from '@object-ui/components';
import type { GalleryConfig, ViewNavigationConfig, GroupingConfig } from '@object-ui/types';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { getCellRenderer, resolveCellRendererType } from '@object-ui/fields';

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

/**
 * Cell renderer types that produce bare values with no inherent visual
 * context. A card row rendered with one of these renderers is just a
 * number / string with no decoration — without a label prefix, the user
 * has no way to tell whether `5,000,000` is revenue, headcount, or
 * pipeline value. Self-describing renderers (badges, icons on links/
 * phone/email, dates, attachments) are excluded so the card layout
 * stays compact for those types.
 */
const LOW_SEMANTIC_RENDERER_TYPES: ReadonlySet<string> = new Set([
    'number',
    'currency',
    'percent',
    'integer',
    'decimal',
]);

/**
 * Deterministic palette for placeholder card covers (no-image fallback).
 * Index is derived from a tiny title hash so each record gets a stable —
 * but visually varied — soft gradient backdrop. Mirrors the home-page
 * AppCard accent treatment for cross-screen consistency.
 */
const PLACEHOLDER_GRADIENTS: ReadonlyArray<{ bg: string; ring: string; text: string }> = [
    { bg: 'from-indigo-500/15 via-indigo-500/5 to-purple-500/10', ring: 'ring-indigo-500/15', text: 'text-indigo-600/70 dark:text-indigo-300/70' },
    { bg: 'from-sky-500/15 via-sky-500/5 to-cyan-500/10',          ring: 'ring-sky-500/15',    text: 'text-sky-600/70 dark:text-sky-300/70' },
    { bg: 'from-emerald-500/15 via-emerald-500/5 to-teal-500/10',  ring: 'ring-emerald-500/15',text: 'text-emerald-600/70 dark:text-emerald-300/70' },
    { bg: 'from-amber-500/15 via-amber-500/5 to-orange-500/10',    ring: 'ring-amber-500/15',  text: 'text-amber-600/70 dark:text-amber-300/70' },
    { bg: 'from-rose-500/15 via-rose-500/5 to-pink-500/10',        ring: 'ring-rose-500/15',   text: 'text-rose-600/70 dark:text-rose-300/70' },
    { bg: 'from-violet-500/15 via-violet-500/5 to-fuchsia-500/10', ring: 'ring-violet-500/15', text: 'text-violet-600/70 dark:text-violet-300/70' },
];

function pickPlaceholderGradient(seed: string): typeof PLACEHOLDER_GRADIENTS[number] {
    // djb2-ish lightweight hash — stable across renders, no PRNG.
    let h = 5381;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) + h) + seed.charCodeAt(i);
    return PLACEHOLDER_GRADIENTS[Math.abs(h) % PLACEHOLDER_GRADIENTS.length];
}

/**
 * Card cover art with graceful degradation.
 *
 *  - `contain` covers (icons / logos) are centred at a capped size on a soft
 *    tinted backdrop so cards read as polished "app tiles" instead of a giant
 *    glyph stretched edge-to-edge.
 *  - `cover` covers (photos) fill the tile.
 *  - When there is no cover value — or the cover URL fails to load (404, dead
 *    CDN) — we fall back to the deterministic letter-avatar placeholder rather
 *    than leaving a broken `<img>` (alt text on a blank box).
 */
const GalleryCover: React.FC<{
    imageUrl?: string;
    title: string;
    coverFit: 'cover' | 'contain';
    aspectClass: string;
    placeholder: typeof PLACEHOLDER_GRADIENTS[number];
    hidden: boolean;
}> = ({ imageUrl, title, coverFit, aspectClass, placeholder, hidden }) => {
    const [errored, setErrored] = useState(false);
    const showImage = !!imageUrl && !errored;

    return (
        <div className={cn('w-full overflow-hidden relative', aspectClass)} hidden={hidden}>
            {showImage ? (
                coverFit === 'contain' ? (
                    <div className={cn('flex h-full w-full items-center justify-center bg-gradient-to-br', placeholder.bg)}>
                        <img
                            src={imageUrl}
                            alt={title}
                            loading="lazy"
                            onError={() => setErrored(true)}
                            className="h-1/2 w-1/2 max-h-24 max-w-24 object-contain transition-transform duration-300 ease-out group-hover:scale-[1.08]"
                        />
                    </div>
                ) : (
                    <img
                        src={imageUrl}
                        alt={title}
                        loading="lazy"
                        onError={() => setErrored(true)}
                        className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
                    />
                )
            ) : (
                <div
                    className={cn(
                        'flex h-full w-full items-center justify-center bg-gradient-to-br ring-1 ring-inset',
                        placeholder.bg,
                        placeholder.ring,
                    )}
                >
                    <span className={cn('text-5xl font-semibold tracking-tight opacity-90', placeholder.text)}>
                        {title[0]?.toUpperCase()}
                    </span>
                </div>
            )}
        </div>
    );
};

/**
 * Small rounded icon tile used in the compact "app card" layout (icon-style
 * galleries, coverFit:'contain'). Renders the cover image at icon scale on a
 * soft tinted backdrop; falls back to the letter avatar on missing/broken art.
 */
const GalleryIconTile: React.FC<{
    imageUrl?: string;
    title: string;
    placeholder: typeof PLACEHOLDER_GRADIENTS[number];
}> = ({ imageUrl, title, placeholder }) => {
    const [errored, setErrored] = useState(false);
    const showImage = !!imageUrl && !errored;
    return (
        <div
            className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ring-inset',
                placeholder.bg,
                placeholder.ring,
            )}
        >
            {showImage ? (
                <img
                    src={imageUrl}
                    alt={title}
                    loading="lazy"
                    onError={() => setErrored(true)}
                    className="h-6 w-6 object-contain transition-transform duration-300 ease-out group-hover:scale-110"
                />
            ) : (
                <span className={cn('text-base font-semibold', placeholder.text)}>
                    {title[0]?.toUpperCase()}
                </span>
            )}
        </div>
    );
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
    // ADR-0079: honour an author-chosen title field, but DON'T fall back to the
    // literal `'name'`. When unset, each card's title is resolved via the
    // unified `getRecordDisplayName` (titleFormat → object.displayNameField →
    // type-aware derivation → `Record #<id>`), so a gallery over an object whose
    // name lives in e.g. `activity_name` shows the real name, not "Untitled".
    const titleField = gallery?.titleField ?? schema.titleField;
    const visibleFields = gallery?.visibleFields;

    // i18n: translate select-field option labels in card cells
    const { fieldLabel, fieldOptionLabel } = useSafeFieldLabel();

    // Build an enriched FieldMetadata for a given field name so the shared
    // cell renderer pipeline (used by Detail/Grid/Related) receives the
    // same context: type, options, currency, precision, reference target,
    // etc. This is what keeps card output visually aligned with the
    // record detail page.
    const buildEnrichedField = useCallback((fieldName: string) => {
      const def = objectDef?.fields?.[fieldName];
      const enriched: Record<string, any> = { name: fieldName };
      if (def) {
        if (def.type) enriched.type = def.type;
        if (def.label) enriched.label = def.label;
        if (def.options) enriched.options = def.options;
        if (def.currency) enriched.currency = def.currency;
        if (def.precision !== undefined) enriched.precision = def.precision;
        if (def.format) enriched.format = def.format;
        const refTarget = (def as any).reference_to || (def as any).reference;
        if (refTarget) enriched.reference_to = refTarget;
        if ((def as any).reference_field) enriched.reference_field = (def as any).reference_field;
      }
      // Route the field label through the i18n dictionary so the auto-
      // prepended labels on number/currency cards show up translated.
      if (schema.objectName) {
        const fallback = String(enriched.label ?? fieldName);
        enriched.label = fieldLabel(schema.objectName, fieldName, fallback);
      }
      // Translate select option labels via i18n, falling back to raw labels.
      if (schema.objectName && Array.isArray(enriched.options)) {
        enriched.options = enriched.options.map((opt: any) => {
          const value = String(opt?.value ?? opt);
          const fallback = String(opt?.label ?? value);
          return { ...opt, value, label: fieldOptionLabel(schema.objectName!, fieldName, value, fallback) };
        });
      }
      return enriched;
    }, [objectDef, schema.objectName, fieldLabel, fieldOptionLabel]);

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

    // Hide the placeholder cover area when no item actually has an image.
    // Without this, gallery cards on data sets that have no `coverField` (or
    // an explicit one but no populated values) render with a giant empty
    // letter-placeholder block that dwarfs the actual content. By collapsing
    // it when there's nothing to show, the cards become information-dense.
    const hasAnyCover = useMemo(
        () => items.some((it) => typeof (it as any)[coverField] === 'string' && !!(it as any)[coverField]),
        [items, coverField],
    );
    // Show the cover area only when at least one record has a non-empty
    // cover image value. Previously, having `coverField` configured was
    // enough to force the cover area on — which produced giant letter-
    // placeholder blocks (200×200 gradients with a single character) on
    // datasets like Contacts where the field is declared but unpopulated.
    // The configured-but-empty state now matches the unconfigured state:
    // collapse to a compact card with just the title + visible fields.
    const showCoverArea = hasAnyCover;

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

    // Detail rows (description / tags / badges) shared by both card layouts.
    const renderFields = (item: Record<string, unknown>) => {
        if (!visibleFields || visibleFields.length === 0) return null;
        return (
            <div className="mt-1.5 space-y-1">
                {visibleFields.map((field) => {
                    const value = (item as any)[field];
                    if (value == null || value === '') return null;
                    const enriched = buildEnrichedField(field);
                    const rendererType = resolveCellRendererType(enriched as any) || enriched.type || 'text';
                    const CellRenderer = getCellRenderer(rendererType);
                    // Auto-prepend a muted label for low-semantic field types
                    // (bare numbers/currency/percent) so a card row isn't an
                    // unlabeled "5,000,000". Types with inherent visual context
                    // (badges, links, dates) stay unlabeled for a clean look.
                    const fieldLabel: string | undefined =
                        (enriched as any)?.label && String((enriched as any).label).trim()
                            ? String((enriched as any).label)
                            : undefined;
                    const showLabel =
                        fieldLabel != null &&
                        LOW_SEMANTIC_RENDERER_TYPES.has(rendererType);
                    return (
                        <div
                            key={field}
                            className={cn(
                                'text-xs text-muted-foreground truncate [&_*]:!text-xs',
                                showLabel && 'flex items-baseline gap-1.5',
                            )}
                            onClick={(e) => {
                                // Don't navigate when interacting with rich cell
                                // content (email/phone/url links) inside a card.
                                const target = e.target as HTMLElement;
                                if (target.closest('a,button')) e.stopPropagation();
                            }}
                        >
                            {showLabel && (
                                <span className="shrink-0 text-muted-foreground/70 tabular-nums">
                                    {fieldLabel}
                                </span>
                            )}
                            <CellRenderer value={value} field={enriched as any} />
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderCard = (item: Record<string, unknown>, i: number) => {
        const id = (item.id ?? item._id ?? i) as string | number;
        // Prefer the explicit title field when authored & present; otherwise
        // defer to the unified object-level resolver (ADR-0079).
        const explicitTitle =
            titleField != null && item[titleField] != null && item[titleField] !== ''
                ? String(item[titleField])
                : undefined;
        const title = explicitTitle ?? getRecordDisplayName(objectDef, item);
        const imageUrl = item[coverField] as string | undefined;
        const placeholder = pickPlaceholderGradient(String(id) + '|' + title);

        const cardClass = cn(
            'group relative overflow-hidden border-border/60 bg-card',
            'transition-all duration-200 ease-out',
            'hover:shadow-lg hover:border-border hover:-translate-y-0.5',
            (props.onCardClick || props.onRowClick || schema.navigation) && 'cursor-pointer',
        );

        // Icon-style galleries (coverFit:'contain' — app marketplaces, logo
        // catalogues) read far better as a compact "app card": a small rounded
        // icon tile beside the title with details below, instead of a giant
        // glyph stretched across a photo-sized cover. Photographic galleries
        // (coverFit:'cover') keep the full-bleed cover layout.
        const isAppCard = showCoverArea && coverFit === 'contain';

        if (isAppCard) {
            return (
                <Card key={id} role="listitem" className={cardClass} onClick={(e) => navigation.handleClick(item, e)}>
                    <div
                        aria-hidden
                        className={cn('absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r', placeholder.bg)}
                    />
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <GalleryIconTile imageUrl={imageUrl} title={title} placeholder={placeholder} />
                            <div className="min-w-0 flex-1">
                                <h3 className="font-semibold tracking-tight truncate text-sm leading-tight text-foreground" title={title}>
                                    {title}
                                </h3>
                                {renderFields(item)}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            );
        }

        return (
            <Card key={id} role="listitem" className={cardClass} onClick={(e) => navigation.handleClick(item, e)}>
                {/* Top accent strip: only for text-only cards (no cover area). */}
                {!showCoverArea && (
                    <div
                        aria-hidden
                        className={cn('absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r', placeholder.bg)}
                    />
                )}
                <GalleryCover
                    imageUrl={imageUrl}
                    title={title}
                    coverFit={coverFit}
                    aspectClass={ASPECT_CLASSES[cardSize]}
                    placeholder={placeholder}
                    hidden={!showCoverArea}
                />
                <CardContent className={cn('p-3', showCoverArea && 'border-t border-border/60')}>
                    <h3 className="font-semibold tracking-tight truncate text-sm leading-tight text-foreground" title={title}>
                        {title}
                    </h3>
                    {renderFields(item)}
                </CardContent>
            </Card>
        );
    };

    const renderGrid = (gridItems: Record<string, unknown>[]) => (
        <div
            className={cn('grid gap-4 p-4 auto-rows-min content-start', GRID_CLASSES[cardSize], schema.className)}
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

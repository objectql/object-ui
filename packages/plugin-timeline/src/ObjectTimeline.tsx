/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { DataSource, TimelineSchema, ListViewTimelineConfig } from '@object-ui/types';
import { useDataScope, useNavigationOverlay, useSafeFieldLabel } from '@object-ui/react';
import { NavigationOverlay } from '@object-ui/components';
import { extractRecords, buildExpandFields, convertSortToQueryParams } from '@object-ui/core';
import { usePullToRefresh } from '@object-ui/mobile';
import { z } from 'zod';
import { TimelineRenderer } from './renderer';
import { useTimelineTranslation } from './useTimelineTranslation';

/**
 * Rows fetched when the author declared no `limit`.
 *
 * The number is the one this component has always intended: before
 * objectstack#7137 the fetch passed `{ options: { $top: 100 } }`, and `options`
 * is not a `QueryParams` key — no adapter in this repo reads it, so the cap never
 * reached the wire and the timeline fetched whatever the server chose to return.
 * The window is now real, and authorable.
 */
export const DEFAULT_TIMELINE_LIMIT = 100;

const TimelineMappingSchema = z.object({
  title: z.string().optional(),
  date: z.string().optional(),
  description: z.string().optional(),
  variant: z.string().optional(),
});

const TimelineExtensionSchema = z.object({
   mapping: TimelineMappingSchema.optional(),
   objectName: z.string().optional(),
   titleField: z.string().optional(),
   /** @deprecated Use startDateField instead */
   dateField: z.string().optional(),
   startDateField: z.string().optional(),
   endDateField: z.string().optional(),
   descriptionField: z.string().optional(),
   groupByField: z.string().optional(),
   colorField: z.string().optional(),
   scale: z.enum(['hour', 'day', 'week', 'month', 'quarter', 'year']).optional(),
});

export interface ObjectTimelineProps {
  schema: TimelineSchema & {
    objectName?: string;
    /**
     * Spec-compliant nested timeline config. Typed as `ListViewTimelineConfig`
     * — the spec shape plus the legacy `dateField` alias that `@object-ui/types`
     * has always declared on it, and that this renderer now actually reads.
     */
    timeline?: ListViewTimelineConfig;
    /**
     * Query filter for the object fetch, in any shape `toFilterNode` accepts
     * (spec `ViewFilterRule[]`, ObjectQL AST nodes, or a MongoDB-style object).
     *
     * Read here, not merged here: when a `dataSource` binding is present,
     * `ElementDataSourceGate` has already AND-combined this key with the view's
     * filter and the binding's own before the schema reaches this component
     * (objectstack#7137) — the same single sink every other object-bound block
     * composes through.
     */
    filter?: any[] | Record<string, any>;
    /**
     * Query ordering — the legacy `"name desc"` clause or the spec's
     * `SortConfig[]`, both lowered through `convertSortToQueryParams`.
     */
    sort?: string | Array<{ field?: string; order?: 'asc' | 'desc' }>;
    /**
     * Row cap for the fetch. Defaults to {@link DEFAULT_TIMELINE_LIMIT}; a
     * timeline renders one rail with no pagination control, so this is the
     * author's window rather than a page size.
     */
    limit?: number;
    /** @deprecated Use timeline.titleField instead */
    titleField?: string;
    /** @deprecated Use timeline.startDateField instead */
    dateField?: string;
    /** @deprecated Use timeline.startDateField instead */
    startDateField?: string;
    /** @deprecated Use timeline.endDateField instead */
    endDateField?: string;
    descriptionField?: string;
    /** @deprecated Use timeline.groupByField instead */
    groupByField?: string;
    /** @deprecated Use timeline.colorField instead */
    colorField?: string;
    /** @deprecated Use timeline.scale instead */
    scale?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
    // Map data fields to timeline item properties
    mapping?: {
      title?: string;
      date?: string;
      description?: string;
      variant?: string;
    }
  };
  dataSource?: DataSource;
  className?: string;
  onRowClick?: (record: any) => void;
  onItemClick?: (record: any) => void;
}

export const ObjectTimeline: React.FC<ObjectTimelineProps> = ({
  schema,
  dataSource,
  className,
  onRowClick,
  onItemClick,
  ...props
}) => {
  const [fetchedData, setFetchedData] = useState<any[]>([]);
  // Start in loading state when we'll fetch from a dataSource so the timeline
  // doesn't render as a blank/empty surface on slow networks before the fetch
  // effect can flip loading to true.
  const [loading, setLoading] = useState<boolean>(() => {
    const hasInlineItems = Array.isArray(schema.items) && schema.items.length > 0;
    const hasInlineData = Array.isArray((props as any).data) && (props as any).data.length > 0;
    return !hasInlineItems && !hasInlineData && !!schema.objectName;
  });
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [objectDef, setObjectDef] = useState<any>(null);

  // Resolve nested TimelineConfig (spec-compliant)
  const timelineConfig = schema.timeline;

  useEffect(() => {
    const result = TimelineExtensionSchema.safeParse(schema);
    if (!result.success) {
      console.warn(`[ObjectTimeline] Invalid timeline configuration:`, result.error.format());
    }
  }, [schema]);

  const boundData = useDataScope(schema.bind);

  // Fetch object definition for metadata
  useEffect(() => {
    let isMounted = true;
    const fetchMeta = async () => {
      if (!dataSource || typeof dataSource.getObjectSchema !== 'function' || !schema.objectName) return;
      try {
        const def = await dataSource.getObjectSchema(schema.objectName);
        if (isMounted) setObjectDef(def);
      } catch (e) {
        console.warn('Failed to fetch object def for ObjectTimeline', e);
      }
    };
    fetchMeta();
    return () => { isMounted = false; };
  }, [schema.objectName, dataSource]);

  // Content keys, not identities. `filter` / `sort` are fetch inputs from here on
  // (objectstack#7137), and an inline array on a schema node is a NEW object every
  // render — depending on identity would refetch the whole object on every render.
  // Same reason `RelatedList` keys its own scope filter on content.
  const filterKey = JSON.stringify(schema.filter ?? null);
  const sortKey = JSON.stringify(schema.sort ?? null);

  useEffect(() => {
    const fetchData = async () => {
        if (!dataSource || typeof dataSource.find !== 'function' || !schema.objectName) {
            // Can't fetch — clear loading so we don't sit in skeleton forever.
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            // Auto-inject $expand for lookup/master_detail fields
            const expand = buildExpandFields(objectDef?.fields);
            // The authored scope reaches the query (objectstack#7137). Before this,
            // the fetch was `{ options: { $top: 100 } }` — no `$filter`, no
            // `$orderby`, and `options` is not a `QueryParams` key, so even the cap
            // was inert. A `dataSource.view` therefore resolved (a typo still
            // reported) and then contributed nothing: the rail could be wider than
            // the view it named. `filter` arrives already AND-composed by
            // `ElementDataSourceGate`, so there is nothing to merge here.
            const results = await dataSource.find(schema.objectName, {
                $filter: schema.filter,
                $orderby: convertSortToQueryParams(schema.sort),
                $top: schema.limit ?? DEFAULT_TIMELINE_LIMIT,
                ...(expand.length > 0 ? { $expand: expand } : {}),
            });
            const data = extractRecords(results);
            setFetchedData(data);
        } catch (e) {
            console.error(e);
            setError(e as Error);
        } finally {
            setLoading(false);
        }
    };

    if (schema.objectName && !boundData && !schema.items && !(props as any).data) {
        fetchData();
    } else {
        // Have inline / bound items — won't fetch; clear loading.
        setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `schema.filter`/`schema.sort` are tracked by CONTENT (filterKey/sortKey) on purpose; see above
  }, [schema.objectName, dataSource, boundData, schema.items, (props as any).data, refreshKey, objectDef, filterKey, sortKey, schema.limit]);

  const rawData = (props as any).data || boundData || fetchedData;
  const { t } = useTimelineTranslation();
  const { fieldOptionLabel } = useSafeFieldLabel();

  // Resolve TimelineConfig with backwards-compatible fallbacks (computed
  // outside the items-derivation block so we can also use them for
  // grouping / color resolution).
  const titleField = timelineConfig?.titleField ?? schema.mapping?.title ?? schema.titleField ?? 'name';
  // `dateField` is the pre-#2231 alias for `startDateField`. It was honored on
  // the FLAT prop (`schema.dateField`) but never on the nested config, even
  // though `ListViewTimelineConfig` declares it there and both `ObjectView`
  // read-sites resolve it. A view authored as `timeline: { dateField }` therefore
  // fell all the way through to the caller's default (`created_at` / `due_date`),
  // which is usually absent from the projection — so every record bucketed into
  // "No date" while the data it needed was sitting in the row (objectui#3129).
  const startDateField =
    timelineConfig?.startDateField ?? timelineConfig?.dateField
    ?? schema.mapping?.date ?? schema.startDateField ?? schema.dateField ?? 'date';
  const endDateField = timelineConfig?.endDateField ?? schema.endDateField ?? startDateField;
  const descField = schema.mapping?.description ?? schema.descriptionField ?? 'description';
  const variantField = schema.mapping?.variant ?? 'variant';
  const groupByField = timelineConfig?.groupByField ?? schema.groupByField;
  const colorField = timelineConfig?.colorField ?? schema.colorField;

  // Transform data to items if we have raw data and no explicit items.
  // Heavy work (sorting, bucket grouping, option-color lookup) happens once
  // per (data, objectDef) tuple via useMemo so scrolling stays smooth.
  const effectiveItems = useMemo(() => {
    if (schema.items) return schema.items;
    if (!rawData || !Array.isArray(rawData)) return [];

    const fields: Record<string, any> = (objectDef?.fields ?? {}) as Record<string, any>;
    const objectName: string = schema.objectName || '';

    /** Build a quick `value → option` lookup for select fields so we can
     *  map raw values to their localized label / chip color. */
    const optionMap = (fieldName: string | undefined): Record<string, any> => {
      if (!fieldName || !fields[fieldName]?.options) return {};
      const map: Record<string, any> = {};
      for (const opt of fields[fieldName].options as Array<any>) {
        if (opt && opt.value != null) map[String(opt.value)] = opt;
      }
      return map;
    };

    const colorOptions = optionMap(colorField);

    /** Which fields appear as inline chips beside the title.
     *  Spec config: `timeline.metaFields: string[]`.
     *  Heuristic default: `['status', 'priority']` — limited to fields that
     *  actually exist in objectDef so non-CRM objects don't render fake
     *  chips. */
    const metaFieldNames: string[] = Array.isArray((timelineConfig as any)?.metaFields)
      ? (timelineConfig as any).metaFields.filter((f: any) => typeof f === 'string' && f)
      : ['status', 'priority'].filter((f) => fields[f]);
    const metaOptionMaps: Record<string, Record<string, any>> = {};
    for (const f of metaFieldNames) metaOptionMaps[f] = optionMap(f);

    // Resolve the marker color for an item: prefer the explicit `color`
    // attribute on the matching select option, else use the raw value if
    // it already looks like a CSS color.
    const resolveColor = (value: any): string | undefined => {
      if (value == null || value === '') return undefined;
      const opt = colorOptions[String(value)];
      if (opt?.color) return String(opt.color);
      const s = String(value);
      if (/^#([0-9a-f]{3}){1,2}$/i.test(s) || s.startsWith('rgb') || s.startsWith('hsl')) return s;
      return undefined;
    };

    // Resolve the localized label (and color, when known) for a select
    // field. Used for both the explicit groupBy label and the inline
    // status / priority badges.
    const resolveOptionMeta = (
      fieldName: string,
      value: any,
      options: Record<string, any>,
    ): { label: string; color?: string } | null => {
      if (value == null || value === '') return null;
      const opt = options[String(value)];
      const label = opt?.label
        ? fieldOptionLabel(objectName, fieldName, String(value), opt.label)
        : String(value);
      return { label, color: opt?.color };
    };

    const mapped = rawData.map((item: any) => {
      const startRaw = item[startDateField];
      const endRaw = item[endDateField];
      const colorRaw = colorField ? item[colorField] : undefined;
      const groupRaw = groupByField ? item[groupByField] : undefined;

      const meta: Array<{ key: string; label: string; color?: string }> = [];
      if (objectName) {
        for (const f of metaFieldNames) {
          const m = resolveOptionMeta(f, item[f], metaOptionMaps[f] || {});
          if (m) meta.push({ key: f, label: m.label, color: m.color });
        }
      }

      return {
        title: item[titleField],
        time: startRaw,
        startDate: startRaw,
        endDate: endRaw,
        description: item[descField],
        variant: item[variantField] || 'default',
        color: resolveColor(colorRaw),
        group: groupRaw,
        meta,
        _data: item,
      };
    });

    // Sort by start date ascending; nulls sink to the end so users see
    // upcoming work first.
    mapped.sort((a, b) => {
      const ta = a.startDate ? new Date(a.startDate).getTime() : Number.POSITIVE_INFINITY;
      const tb = b.startDate ? new Date(b.startDate).getTime() : Number.POSITIVE_INFINITY;
      return ta - tb;
    });

    // Decide on a final group label for each item:
    //   - explicit groupBy → use the localized field-option label (or
    //     "Unassigned" when null);
    //   - otherwise → date bucket (Overdue / Today / Tomorrow / This week
    //     / Next week / Later / No date) so the timeline doesn't render
    //     as one undifferentiated stripe.
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const today = startOfDay(now);
    const day = 86400000;
    const startOfWeek = today - ((now.getDay() + 6) % 7) * day; // Monday
    const endOfWeek = startOfWeek + 7 * day;
    const endOfNextWeek = endOfWeek + 7 * day;

    const dateBucket = (raw: any): string => {
      if (!raw) return t('timeline.bucket.noDate');
      const ts = startOfDay(new Date(raw));
      if (Number.isNaN(ts)) return t('timeline.bucket.noDate');
      if (ts < today) return t('timeline.bucket.overdue');
      if (ts === today) return t('timeline.bucket.today');
      if (ts === today + day) return t('timeline.bucket.tomorrow');
      if (ts < endOfWeek) return t('timeline.bucket.thisWeek');
      if (ts < endOfNextWeek) return t('timeline.bucket.nextWeek');
      return t('timeline.bucket.later');
    };

    if (groupByField) {
      const allEmpty = mapped.every((m) => m.group == null || m.group === '');
      if (!allEmpty) {
        const groupSelectOptions = optionMap(groupByField);
        return mapped.map((m) => {
          const meta = resolveOptionMeta(groupByField, m.group, groupSelectOptions);
          return {
            ...m,
            group: meta
              ? meta.label
              : (m.group != null && m.group !== ''
                  ? String(m.group)
                  : t('timeline.bucket.unassigned')),
          };
        });
      }
      // Fall through to date bucketing — explicit groupBy field exists
      // but every record's value is empty, so a single empty lane would
      // be useless.
    }

    return mapped.map((m) => ({ ...m, group: dateBucket(m.startDate) }));
  }, [schema.items, rawData, objectDef, schema.objectName, titleField, startDateField, endDateField, descField, variantField, colorField, groupByField, t, fieldOptionLabel]);

  const handleRefresh = useCallback(async () => {
    setRefreshKey(k => k + 1);
  }, []);

  const { ref: pullRef, isRefreshing, pullDistance } = usePullToRefresh<HTMLDivElement>({
    onRefresh: handleRefresh,
    enabled: !!schema.objectName && !!dataSource,
  });

  const navigation = useNavigationOverlay({
    navigation: (schema as any).navigation,
    objectName: schema.objectName,
    onRowClick: onRowClick ?? onItemClick,
  });

  // Resolve scale: spec timeline.scale takes priority over flat schema.scale
  const resolvedScale = timelineConfig?.scale ?? schema.scale;

  const effectiveSchema = {
      ...schema,
      items: effectiveItems || [],
      className: className || schema.className,
      // Emit the resolved axis under the canonical `scale` (used by the gantt
      // variant). This used to write the `timeScale` alias, which objectui#6355
      // retired: leaving it would have made EVERY object-bound gantt fall
      // through to the `month` default the moment `resolveTimelineScale` stopped
      // reading the alias — silently, since this is a composed schema no author
      // ever sees. Writing `scale` after the spread also restores the priority
      // the line above intends: a `timelineConfig.scale` now actually beats a
      // flat `schema.scale`, where under the alias the resolver's `scale ??
      // timeScale` ordering let the flat key win.
      ...(resolvedScale ? { scale: resolvedScale } : {}),
      onItemClick: (item: any) => {
        const record = item._data || item;
        navigation.handleClick(record);
        onItemClick?.(record);
      },
  };

  if (error) {
      return (
        <div className="p-4 text-destructive" data-testid="timeline-error" role="alert">
            Error loading timeline: {error.message}
        </div>
      );
  }

  if (loading && (!effectiveItems || effectiveItems.length === 0)) {
      return (
        <div
          className="flex flex-col h-full min-h-[200px] p-4 gap-3"
          data-testid="timeline-loading"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span className="sr-only">Loading timeline…</span>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3" style={{ opacity: Math.max(0.3, 1 - i * 0.18) }}>
              <div className="h-3 w-3 rounded-full bg-muted/70 animate-pulse mt-1.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-muted/70 animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-muted/50 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      );
  }

  return (
    <div ref={pullRef} className="relative overflow-auto h-full min-w-0">
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center text-xs text-muted-foreground"
          style={{ height: pullDistance }}
        >
          {isRefreshing ? 'Refreshing…' : 'Pull to refresh'}
        </div>
      )}
      <TimelineRenderer schema={effectiveSchema} />
      {navigation.isOverlay && (
        <NavigationOverlay {...navigation} title="Timeline Item">
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
    </div>
  );
}

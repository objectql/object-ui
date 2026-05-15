/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ObjectCalendar Component
 * 
 * A specialized calendar component that works with ObjectQL data sources.
 * Displays records as calendar events based on date field configuration.
 * Implements the calendar view type from @objectstack/spec view.zod ListView schema.
 * 
 * Features:
 * - Month/week/day calendar views
 * - Auto-mapping of records to calendar events
 * - Date range filtering
 * - Event click handling
 * - Color coding support
 * - Works with object/api/value data providers
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { ObjectGridSchema, DataSource, ViewData, CalendarConfig } from '@object-ui/types';
import { CalendarView, type CalendarEvent } from './CalendarView';
import { usePullToRefresh } from '@object-ui/mobile';
import { useNavigationOverlay } from '@object-ui/react';
import { RecordDetailDrawer, deriveRecordPageHref } from '@object-ui/plugin-detail';
import {
  useIsMobile,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
} from '@object-ui/components';
import { extractRecords, buildExpandFields } from '@object-ui/core';

export interface CalendarSchema {
  type: 'calendar';
  objectName?: string;
  dateField?: string;
  endField?: string;
  titleField?: string;
  colorField?: string;
  filter?: any;
  sort?: any;
  /** Initial view mode */
  defaultView?: 'month' | 'week' | 'day';
}

export interface ObjectCalendarProps {
  schema: ObjectGridSchema | CalendarSchema;
  dataSource?: DataSource;
  className?: string;
  /** Pre-fetched records passed by a parent (e.g. ObjectView). When provided, skips internal data fetching. */
  data?: any[];
  /** Loading state propagated from a parent. Respected only when `data` is also provided. */
  loading?: boolean;
  onEventClick?: (record: any) => void;
  onRowClick?: (record: any) => void;
  onDateClick?: (date: Date) => void;
  onEdit?: (record: any) => void;
  onDelete?: (record: any) => void;
  onNavigate?: (date: Date) => void;
  onViewChange?: (view: 'month' | 'week' | 'day') => void;
  onEventDrop?: (record: any, newStart: Date, newEnd?: Date) => void;
  locale?: string;
}

/**
 * Helper to get data configuration from schema
 */
function getDataConfig(schema: ObjectGridSchema | CalendarSchema): ViewData | null {
  if ('data' in schema && schema.data) {
    return schema.data;
  }
  
  if ('staticData' in schema && schema.staticData) {
    return {
      provider: 'value',
      items: schema.staticData,
    };
  }
  
  if (schema.objectName) {
    return {
      provider: 'object',
      object: schema.objectName,
    };
  }
  
  return null;
}

/**
 * Helper to convert sort config to QueryParams format
 */
function convertSortToQueryParams(sort: string | any[] | undefined): Record<string, 'asc' | 'desc'> | undefined {
  if (!sort) return undefined;
  
  // If it's a string like "name desc"
  if (typeof sort === 'string') {
    const parts = sort.split(' ');
    const field = parts[0];
    const order = (parts[1]?.toLowerCase() === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';
    return { [field]: order };
  }
  
  // If it's an array of SortConfig objects
  if (Array.isArray(sort)) {
    return sort.reduce((acc, item) => {
      if (item.field && item.order) {
        acc[item.field] = item.order;
      }
      return acc;
    }, {} as Record<string, 'asc' | 'desc'>);
  }
  
  return undefined;
}

/**
 * Helper to get calendar configuration from schema
 */
function getCalendarConfig(schema: ObjectGridSchema | CalendarSchema): CalendarConfig | null {
  // Check if schema has calendar configuration
  if ('filter' in schema && schema.filter && typeof schema.filter === 'object' && 'calendar' in schema.filter) {
    return (schema.filter as any).calendar as CalendarConfig;
  }
  
  // For backward compatibility, check if schema has calendar config at root
  if ((schema as any).calendar) {
    return (schema as any).calendar as CalendarConfig;
  }
  
  // Check for flat properties (used by ObjectView)
  if ((schema as any).startDateField || (schema as any).dateField) {
      return {
          startDateField: (schema as any).startDateField || (schema as any).dateField,
          endDateField: (schema as any).endDateField || (schema as any).endField,
          titleField: (schema as any).titleField,
          colorField: (schema as any).colorField,
          allDayField: (schema as any).allDayField
      } as CalendarConfig;
  }

  return null;
}

export const ObjectCalendar: React.FC<ObjectCalendarProps> = ({
  schema,
  dataSource,
  className,
  data: externalData,
  loading: externalLoading,
  onEventClick,
  onRowClick,
  onDateClick,
  onNavigate,
  onViewChange,
  onEventDrop,
  locale,
}) => {
  // When the parent (e.g. ObjectView) pre-fetches data and passes it via the `data` prop,
  // we must not trigger a second fetch. Detect external data by checking for an array.
  const hasExternalData = Array.isArray(externalData);

  const [data, setData] = useState<any[]>(hasExternalData ? externalData! : []);
  const [loading, setLoading] = useState(hasExternalData ? (externalLoading ?? false) : true);
  const [error, setError] = useState<Error | null>(null);
  const [objectSchema, setObjectSchema] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const isMobile = useIsMobile();
  const schemaDefaultView = (schema as any).defaultView as 'month' | 'week' | 'day' | undefined;
  // Lazy initializer: read window.innerWidth synchronously so SSR-friendly
  // useIsMobile (which returns false on first render) doesn't lock us into
  // a 24-hour day grid on phones.
  const [view, setView] = useState<'month' | 'week' | 'day'>(() => {
    const wantsDay = schemaDefaultView === 'day' || !schemaDefaultView;
    const isMobileSync = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobileSync && wantsDay) return 'month';
    return schemaDefaultView || 'month';
  });
  // If the viewport later transitions into mobile (rotation, resize) while
  // sitting on day view, downgrade to month.
  useEffect(() => {
    if (isMobile && view === 'day' && (schemaDefaultView === 'day' || !schemaDefaultView)) {
      setView('month');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);
  const [refreshKey, setRefreshKey] = useState(0);

  // P2: Auto-subscribe to DataSource mutation events (standalone mode only).
  // When rendered as a child of ObjectView with external data, parent handles refresh.
  useEffect(() => {
    if (hasExternalData) return; // Parent handles refresh
    if (!dataSource?.onMutation || !schema.objectName) return;
    const unsub = dataSource.onMutation((event: any) => {
      if (event.resource === schema.objectName) {
        setRefreshKey(k => k + 1);
      }
    });
    return unsub;
  }, [dataSource, schema.objectName, hasExternalData]);

  const handlePullRefresh = useCallback(async () => {
    setRefreshKey(k => k + 1);
  }, []);

  const { ref: pullRef, isRefreshing, pullDistance } = usePullToRefresh<HTMLDivElement>({
    onRefresh: handlePullRefresh,
    enabled: !!dataSource && !!schema.objectName,
  });

  const dataConfig = useMemo(() => getDataConfig(schema), [
    (schema as any).data,
    (schema as any).staticData,
    schema.objectName,
  ]);
  const calendarConfig = useMemo(() => getCalendarConfig(schema), [
    schema.filter,
    (schema as any).calendar,
    (schema as any).dateField,
    (schema as any).endField,
    (schema as any).titleField,
    (schema as any).colorField
  ]);
  const hasInlineData = dataConfig?.provider === 'value';

  // Use ref for objectSchema to avoid double-fetch on mount
  const objectSchemaRef = useRef<any>(null);
  objectSchemaRef.current = objectSchema;

  // Sync external data/loading changes from parent (e.g. ObjectView re-fetches after filter change)
  useEffect(() => {
    if (hasExternalData) {
      setData(externalData!);
    }
  }, [externalData, hasExternalData]);

  useEffect(() => {
    if (hasExternalData && externalLoading !== undefined) {
      setLoading(externalLoading);
    }
  }, [externalLoading, hasExternalData]);

  // Fetch data based on provider
  useEffect(() => {
    // Skip internal fetch when data is managed by a parent component
    if (hasExternalData) return;

    let isMounted = true;
    const fetchData = async () => {
      try {
        if (!isMounted) return;
        setLoading(true);
        
        if (hasInlineData && dataConfig?.provider === 'value') {
          if (isMounted) {
            setData(dataConfig.items as any[]);
            setLoading(false);
          }
          return;
        }

        if (!dataSource || typeof dataSource.find !== 'function') {
          throw new Error('DataSource required for object/api providers');
        }

        if (dataConfig?.provider === 'object') {
          const objectName = dataConfig.object;
          // Auto-inject $expand for lookup/master_detail fields
          const expand = buildExpandFields(objectSchemaRef.current?.fields);
          const result = await dataSource.find(objectName, {
            $filter: schema.filter,
            $orderby: convertSortToQueryParams(schema.sort),
            ...(expand.length > 0 ? { $expand: expand } : {}),
          });
          
          let items: any[] = extractRecords(result);
          
          if (isMounted) {
            setData(items);
          }
        } else if (dataConfig?.provider === 'api') {
          console.warn('API provider not yet implemented for ObjectCalendar');
          if (isMounted) setData([]);
        }
        
        if (isMounted) setLoading(false);
      } catch (err) {
        console.error('[ObjectCalendar] Error fetching data:', err);
        if (isMounted) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [hasExternalData, dataConfig, dataSource, hasInlineData, schema.filter, schema.sort, refreshKey]);

  // Fetch object schema for field metadata
  useEffect(() => {
    const fetchObjectSchema = async () => {
      try {
        if (!dataSource) return;
        
        const objectName = dataConfig?.provider === 'object' 
          ? dataConfig.object 
          : schema.objectName;
          
        if (!objectName) return;
        
        const schemaData = await dataSource.getObjectSchema(objectName);
        setObjectSchema(schemaData);
      } catch (err) {
        console.error('Failed to fetch object schema:', err);
      }
    };

    if (!hasInlineData && dataSource) {
      fetchObjectSchema();
    }
  }, [schema.objectName, dataSource, hasInlineData, dataConfig]);

  // Transform data to calendar events
  const events = useMemo(() => {
    if (!calendarConfig || !data.length) {
      return [];
    }

    const { startDateField, endDateField, titleField, colorField } = calendarConfig;
    const rawTitleFormat: any = objectSchema?.titleFormat;
    const titleFormat: string | undefined =
      typeof rawTitleFormat === 'string'
        ? rawTitleFormat
        : (rawTitleFormat && typeof rawTitleFormat === 'object' && typeof rawTitleFormat.source === 'string')
          ? rawTitleFormat.source
          : undefined;
    const nameFieldKey: string | undefined = objectSchema?.NAME_FIELD_KEY;
    const TITLE_FALLBACK_FIELDS = [
      'name', 'full_name', 'fullName', 'title', 'subject',
      'label', 'display_name', 'displayName',
    ];

    const renderFromTemplate = (template: string, item: Record<string, any>) => {
      const EMPTY_TOKEN = '\u0000';
      const SEPARATORS = '[-\\u2013\\u2014|/·,:]';
      let anyResolved = false;
      const raw = template.replace(/\{([^{}]+)\}/g, (_m, key) => {
        const v = item[key.trim()];
        if (v !== undefined && v !== null && v !== '') {
          anyResolved = true;
          return String(v);
        }
        return EMPTY_TOKEN;
      });
      if (!anyResolved) return '';
      return raw
        .replace(new RegExp(`\\s*${SEPARATORS}\\s*${EMPTY_TOKEN}`, 'g'), '')
        .replace(new RegExp(`${EMPTY_TOKEN}\\s*${SEPARATORS}\\s*`, 'g'), '')
        .replace(new RegExp(EMPTY_TOKEN, 'g'), '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const resolveTitle = (record: Record<string, any>): string => {
      let resolved: any = undefined;
      if (titleField) {
        resolved = record[titleField];
        if (typeof resolved === 'string') resolved = resolved.trim();
      }
      if (!resolved && titleFormat) {
        const rendered = renderFromTemplate(titleFormat, record);
        if (rendered) resolved = rendered;
      }
      if (!resolved && nameFieldKey) {
        const v = record[nameFieldKey];
        if (typeof v === 'string') resolved = v.trim();
        else if (v) resolved = v;
      }
      if (!resolved) {
        for (const f of TITLE_FALLBACK_FIELDS) {
          const v = record[f];
          const s = typeof v === 'string' ? v.trim() : v;
          if (s) { resolved = s; break; }
        }
      }
      return resolved || 'Untitled';
    };

    return data.map((record, index) => {
      const startDate = record[startDateField];
      const endDate = endDateField ? record[endDateField] : null;
      const title = resolveTitle(record);
      const color = colorField ? record[colorField] : undefined;

      return {
        id: record.id || record._id || `event-${index}`,
        title,
        start: startDate ? new Date(startDate) : new Date(),
        end: endDate ? new Date(endDate) : undefined,
        color,
        allDay: !endDate, // If no end date, treat as all-day event
        data: record,
      };
    }).filter(event => !isNaN(event.start.getTime())); // Filter out invalid dates
  }, [data, calendarConfig, objectSchema]);

  // Get days in current month view - REMOVED (Handled by CalendarView)
  
  const handleCreate = useCallback(() => {
    // Standard "Create" action trigger
    const today = new Date();
    onDateClick?.(today);
  }, [onDateClick]);

  // --- NavigationConfig support ---
  // Must be called before any early returns to satisfy React hooks rules
  // When the local navigation mode is an overlay (drawer/modal), ignore the
  // inherited onRowClick so the local overlay wins over parent page-nav.
  const navConfig = (schema as any).navigation ?? { mode: 'drawer', width: 'min(960px, 60vw)' };
  const navIsOverlay = navConfig.mode === 'drawer' || navConfig.mode === 'modal' || navConfig.mode === 'split' || navConfig.mode === 'popover';
  const navigation = useNavigationOverlay({
    navigation: navConfig,
    objectName: schema.objectName,
    onRowClick: navIsOverlay ? undefined : onRowClick,
  });

  // Default drag-to-reschedule handler. When the caller hasn't provided an
  // `onEventDrop`, persist the new dates back to the data source so dragging
  // an event in the month view actually changes the record. Optimistic
  // update local state first for snappy feedback; revert on failure.
  // NOTE: This hook (and the quick-create hooks below) MUST be declared
  // before the early returns for `loading` / `error` / `!calendarConfig`,
  // otherwise React detects a hook-order change when those conditions
  // flip across re-renders (e.g. tab switching between board → calendar).
  const handleEventDropDefault = useCallback(async (record: any, newStart: Date, newEnd?: Date) => {
    if (!calendarConfig) return;
    const { startDateField, endDateField } = calendarConfig;
    const id = record?.id ?? record?._id;
    if (!id || !schema.objectName || !dataSource?.update) return;

    const patch: Record<string, string> = {
      [startDateField]: newStart.toISOString(),
    };
    if (endDateField && newEnd) {
      patch[endDateField] = newEnd.toISOString();
    }

    // Optimistic UI update
    const prevData = data;
    setData(prev =>
      prev.map(r => ((r?.id ?? r?._id) === id ? { ...r, ...patch } : r))
    );

    try {
      await dataSource.update(schema.objectName, id, patch);
      // Parent (e.g. ObjectView) listens on onMutation and will refetch.
      // In standalone mode the mutation subscription bumps refreshKey.
    } catch (err) {
      // Roll back optimistic state
      setData(prevData);
      // eslint-disable-next-line no-console
      console.error('[ObjectCalendar] Failed to persist drag-and-drop reschedule:', err);
    }
  }, [calendarConfig, schema.objectName, dataSource, data]);

  // Quick-create state: clicking an empty day cell opens a small dialog
  // pre-filled with that date. On submit, dataSource.create() inserts a
  // record and the mutation event triggers a refetch.
  // `start` always set; `end` set for time-range drags from week/day grid.
  // For month-cell click, `end` equals `start` and the dialog shows date-only.
  const [quickCreate, setQuickCreate] = useState<{ start: Date; end?: Date; title: string; submitting: boolean; error?: string } | null>(null);

  const handleDateClickDefault = useCallback((day: Date) => {
    if (!calendarConfig || !schema.objectName || !dataSource?.create) return;
    setQuickCreate({ start: day, title: '', submitting: false });
  }, [calendarConfig, schema.objectName, dataSource]);

  const handleTimeRangeSelectDefault = useCallback((start: Date, end: Date) => {
    if (!calendarConfig || !schema.objectName || !dataSource?.create) return;
    setQuickCreate({ start, end, title: '', submitting: false });
  }, [calendarConfig, schema.objectName, dataSource]);

  const submitQuickCreate = useCallback(async () => {
    if (!quickCreate || !calendarConfig) return;
    const title = quickCreate.title.trim();
    if (!title) {
      setQuickCreate(qc => qc ? { ...qc, error: 'Title is required' } : qc);
      return;
    }
    if (!schema.objectName || !dataSource?.create) return;

    setQuickCreate(qc => qc ? { ...qc, submitting: true, error: undefined } : qc);
    const { startDateField, endDateField, titleField } = calendarConfig;
    const payload: Record<string, any> = {
      [titleField || 'name']: title,
      [startDateField]: quickCreate.start.toISOString(),
    };
    // Default end_date to range end (or same as start if not provided).
    if (endDateField) {
      payload[endDateField] = (quickCreate.end ?? quickCreate.start).toISOString();
    }
    // Auto-fill required fields the user hasn't provided (e.g. select
    // status, autonumber). Without this the server would 400 on
    // NOT NULL constraint. Uses first option for picklists; falls back
    // to defaultValue or sensible empty string for text.
    const fieldsMeta = objectSchema?.fields;
    if (fieldsMeta && typeof fieldsMeta === 'object') {
      const entries: [string, any][] = Array.isArray(fieldsMeta)
        ? fieldsMeta.map((f: any) => [f.name ?? f.apiName, f] as [string, any])
        : Object.entries(fieldsMeta);
      for (const [name, def] of entries) {
        if (!name || name in payload) continue;
        if (!def?.required) continue;
        if (def.defaultValue !== undefined && def.defaultValue !== null) {
          payload[name] = def.defaultValue;
          continue;
        }
        const t = def.type;
        if (t === 'select' || t === 'picklist' || t === 'status') {
          const opts = (def.options || def.choices || []) as any[];
          const first = opts[0];
          if (first !== undefined) {
            payload[name] = typeof first === 'object' ? (first.value ?? first.id) : first;
          }
        } else if (t === 'boolean' || t === 'checkbox') {
          payload[name] = false;
        } else if (t === 'number' || t === 'integer' || t === 'decimal' || t === 'currency' || t === 'percent') {
          payload[name] = 0;
        }
        // autonumber/text/date that are required but not provided will fall
        // through; the server will surface a clear error which we display.
      }
    }
    try {
      const created = await dataSource.create(schema.objectName, payload);
      // Optimistically insert into local state so the new event appears
      // immediately. Different DataSource implementations may return the
      // record directly, wrapped in `{record}`, or wrapped in `{data}`.
      const c: any = created;
      const newRecord = (c && (c.record || c.data || c)) ?? null;
      if (newRecord && (newRecord.id !== undefined || newRecord._id !== undefined)) {
        setData(prev => [...prev, newRecord]);
      }
      setQuickCreate(null);
    } catch (err: any) {
      const msg = err?.message || String(err);
      setQuickCreate(qc => qc ? { ...qc, submitting: false, error: msg } : qc);
      // eslint-disable-next-line no-console
      console.error('[ObjectCalendar] Quick-create failed:', err);
    }
  }, [quickCreate, calendarConfig, schema.objectName, dataSource, objectSchema]);

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading calendar...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-96">
          <div className="text-destructive">Error: {error.message}</div>
        </div>
      </div>
    );
  }

  if (!calendarConfig) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">
            Calendar configuration required. Please specify startDateField and titleField.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={pullRef} className={className}>
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center text-xs text-muted-foreground"
          style={{ height: pullDistance }}
        >
          {isRefreshing ? 'Refreshing…' : 'Pull to refresh'}
        </div>
      )}
      <div className="border rounded-lg bg-background h-[calc(100vh-120px)] sm:h-[calc(100vh-160px)] md:h-[calc(100vh-200px)] min-h-[400px] sm:min-h-[600px]">
        <CalendarView
          events={events}
          currentDate={currentDate}
          view={view}
          locale={locale}
          onEventClick={(event) => {
            navigation.handleClick(event.data);
            // When the local navigation is an overlay, the drawer wins —
            // don't also fire parent's onEventClick (which would page-navigate).
            if (!navIsOverlay) {
              onEventClick?.(event.data);
            }
          }}
          // Quick-create on empty-day click. Caller-supplied onDateClick
          // wins; otherwise open the quick-create dialog.
          onDateClick={(day) => {
            if (onDateClick) {
              onDateClick(day);
            } else {
              handleDateClickDefault(day);
            }
          }}
          onNavigate={(date) => {
            setCurrentDate(date);
            onNavigate?.(date);
          }}
          onViewChange={(v) => {
            setView(v);
            onViewChange?.(v);
          }}
          onAddClick={undefined}
          // Wire drag-to-reschedule: caller-supplied handler wins, otherwise
          // fall back to persisting via dataSource.update().
          onEventDrop={(event, newStart, newEnd) => {
            if (onEventDrop) {
              onEventDrop(event.data, newStart, newEnd);
            } else {
              void handleEventDropDefault(event.data, newStart, newEnd);
            }
          }}
          onTimeRangeSelect={handleTimeRangeSelectDefault}
        />
      </div>

      {/* Quick-create dialog: opens when the user clicks an empty day cell.
          Pre-fills start_date (and end_date) with the clicked day; only the
          title is required. The full record can be edited afterward via the
          standard detail page. */}
      <Dialog open={!!quickCreate} onOpenChange={(open) => {
        if (!open) setQuickCreate(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
            <DialogDescription>
              {quickCreate && (() => {
                const hasRange = quickCreate.end && quickCreate.end.getTime() !== quickCreate.start.getTime();
                const datePart = quickCreate.start.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
                if (hasRange) {
                  const fmt = (d: Date) => d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
                  return <>{datePart} · {fmt(quickCreate.start)} – {fmt(quickCreate.end!)}</>;
                }
                return <>On {datePart}</>;
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="quick-create-title">Title</Label>
            <Input
              id="quick-create-title"
              autoFocus
              value={quickCreate?.title ?? ''}
              onChange={(e) => setQuickCreate(qc => qc ? { ...qc, title: e.target.value, error: undefined } : qc)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !quickCreate?.submitting) {
                  e.preventDefault();
                  void submitQuickCreate();
                }
              }}
              placeholder="What's this event about?"
              disabled={quickCreate?.submitting}
            />
            {quickCreate?.error && (
              <p className="text-sm text-destructive">{quickCreate.error}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setQuickCreate(null)}
              disabled={quickCreate?.submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void submitQuickCreate()}
              disabled={quickCreate?.submitting || !quickCreate?.title.trim()}
            >
              {quickCreate?.submitting ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {navigation.isOverlay && navigation.isOpen && navigation.selectedRecord && (() => {
        const objectName = dataConfig?.provider === 'object' ? dataConfig.object : schema.objectName;
        const rec = navigation.selectedRecord as Record<string, any>;
        const recordId = rec.id ?? rec._id;
        if (!objectName || recordId == null) return null;
        const titleText = calendarConfig?.titleField
          ? String(rec[calendarConfig.titleField] ?? 'Event Details')
          : 'Event Details';
        return (
          <RecordDetailDrawer
            open
            onClose={navigation.close}
            title={titleText}
            record={rec}
            objectName={objectName}
            recordId={recordId}
            dataSource={dataSource}
            objectSchema={objectSchema as any}
            width={(navigation.width as any) ?? 'min(960px, 60vw)'}
            fullPageHref={deriveRecordPageHref(objectName, recordId) ?? undefined}
            onFieldSave={async (field, value) => {
              if (!dataSource?.update) return;
              await dataSource.update(objectName, String(recordId), { [field]: value });
              setData((prev) => prev.map((r) =>
                String(r.id ?? r._id) === String(recordId)
                  ? { ...r, [field]: value }
                  : r,
              ));
            }}
            onDelete={async () => {
              if (!dataSource?.delete) return;
              await dataSource.delete(objectName, String(recordId));
              setData((prev) => prev.filter((r) =>
                String(r.id ?? r._id) !== String(recordId),
              ));
            }}
          />
        );
      })()}
    </div>
  );
};

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
 * - Works with object/value data providers
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { ObjectGridSchema, DataSource, ViewData, CalendarConfig } from '@object-ui/types';
import { CalendarView, type CalendarViewEvent } from './CalendarView';
import { usePullToRefresh } from '@object-ui/mobile';
import {
  useNavigationOverlay,
  useSafeTranslate,
  useObjectTranslation,
  extractWriteErrorMessage,
  isPermissionError,
  declaredUserMessage,
  useSettledSchema,
  NON_GRID_ROW_CEILING,
  NON_GRID_ROW_CEILING_TOP,
  applyNonGridRowCeiling,
  NonGridRowCeilingNote,
} from '@object-ui/react';
import { RecordDetailDrawer, deriveRecordPageHref } from '@object-ui/plugin-detail';
import { usePermissions } from '@object-ui/permissions';
import { ChevronRight } from 'lucide-react';
import {
  cn,
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
  toast,
} from '@object-ui/components';
import {
  buildExpandFields,
  convertSortToQueryParams,
  getRecordDisplayName,
  createFieldColorResolver,
} from '@object-ui/core';

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

/**
 * Props of the `ObjectCalendar` React component.
 *
 * Renamed off the bare `ObjectCalendarProps` (objectui#4650): from 17.0.0
 * `@objectstack/spec/ui` owns that name, where it is the AUTHORED props
 * document of the `object-calendar` element — `z.input<typeof
 * ObjectCalendarPropsSchema>`, i.e. serialisable authoring keys only. This is
 * the RENDERER's props: a live `dataSource`, records pre-fetched by a parent,
 * and the host callbacks below, none of which can exist in authored metadata.
 * Two layers under one word, resolved the way this repo already resolved it for
 * `PageHeaderProps` -> `PageHeaderComponentProps` (app-shell) and the
 * `Record*ComponentProps` family in `@object-ui/types`.
 *
 * The barrel keeps `ObjectCalendarProps` as a deprecated alias of this type, so
 * no importer breaks. Tripwire: `__tests__/spec-symbol-4650.test.ts`.
 */
export interface ObjectCalendarComponentProps {
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

/**
 * A record the calendar cannot place: the field declared as `startDateField`
 * carries no value on it, so there is no date to draw and none is invented
 * (objectui#7071). Deliberately just an id and a display title — the ruled
 * affordance is a count and a list, so nothing here feeds a scheduling gesture.
 */
interface UnscheduledRecord {
  id: string | number;
  title: string;
}

export const ObjectCalendar: React.FC<ObjectCalendarComponentProps> = ({
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
  const tt = useSafeTranslate();
  // `useSafeTranslate` takes a plain English fallback and passes NO options to
  // i18next, so it cannot fill a `{{count}}` hole — the unscheduled label needs
  // one, and reads its key through `useObjectTranslation` instead. Both spell
  // the provider-less fallback the same way (objectui#6219), so the label is
  // correct whether or not an `I18nProvider` is mounted.
  const { t } = useObjectTranslation();
  // When the parent (e.g. ObjectView) pre-fetches data and passes it via the `data` prop,
  // we must not trigger a second fetch. Detect external data by checking for an array.
  const hasExternalData = Array.isArray(externalData);

  const [data, setData] = useState<any[]>(hasExternalData ? externalData! : []);
  const [loading, setLoading] = useState(hasExternalData ? (externalLoading ?? false) : true);
  const [error, setError] = useState<Error | null>(null);
  /**
   * Did the platform row ceiling bite, and how large was the whole filtered
   * result set (objectui#7210)? Carried from the response that knew it —
   * `data.length === NON_GRID_ROW_CEILING` cannot tell a capped result set
   * apart from one that is exactly that size.
   */
  const [rowCeiling, setRowCeiling] = useState<{ truncated: boolean; total?: number }>({
    truncated: false,
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  // Disclosure state of the "unscheduled" area (objectui#7071). Collapsed by
  // default, as ruled: the count is always on screen, the list is opt-in.
  // Component state is the right home per AGENTS.md §5 #8 — nobody would share
  // or bookmark it — and it survives a data refresh because a refetch re-renders
  // this component rather than remounting it.
  const [unscheduledOpen, setUnscheduledOpen] = useState(false);
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
  /**
   * The record-fetch effect below used to key on `dataConfig` itself — the
   * whole memoised object identity. `useMemo` carries no semantic
   * guarantee (React may discard its cache and recompute), and
   * `getDataConfig(schema)` builds a fresh wrapper object on every call
   * even when its own deps haven't changed, so a discard alone was enough
   * to re-run the effect and refetch. `dataProvider` and `dataItems` are
   * the remaining primitive fields that effect reads off `dataConfig` —
   * `schemaObjectName` below already covers the `object` field for the
   * same purpose. Keying on all three instead of the container object
   * makes a cache discard a no-op (objectui#6592).
   */
  const dataProvider = dataConfig?.provider;
  const dataItems = dataConfig?.provider === 'value' ? dataConfig.items : undefined;

  // ⭐ objectui#6453 — this replaces a `useRef` written in the render body
  // (`objectSchemaRef.current = objectSchema`), which existed so the fetch
  // effect below could read the schema without listing it as a dependency.
  // That bought the effect one run per mount and paid for it with the
  // expansion, permanently: on that one run the ref was still `null`,
  // `buildExpandFields` saw no fields, and the standalone calendar's query went
  // out with no `$expand` at all — so every lookup / master_detail / user /
  // tree field rendered from its raw foreign-key id, forever.
  //
  // The KEY is the object the record query will use, which on this component is
  // NOT simply `schema.objectName`: an authored `data` block can name a
  // different object. Comparing it during render means switching objects closes
  // the gate in the same commit that changes it, not one commit later, so no
  // query can carry the previous object's expand set.
  const schemaObjectName =
    dataConfig?.provider === 'object' ? dataConfig.object : schema.objectName;
  const schemaKey = schemaObjectName ?? '';
  /**
   * Has the object schema for THIS object finished resolving? Note what this is
   * NOT: "`objectSchema` is truthy". A calendar whose adapter exposes no
   * `getObjectSchema`, or whose schema read failed, must still fetch its
   * records — gating on a truthy schema would leave those calendars empty
   * forever. "Settled with nothing" and "not yet settled" are different states
   * and only the second may hold the query.
   */
  //
  // Since objectui#7225 (maintainer ruling B, 2026-09-02) this is the SHARED
  // `useSettledSchema`. `ObjectCalendar` was #6482's named obstacle to that
  // convergence, and the obstacle turned out to be about the GATE half, which
  // the hook deliberately leaves local (the record effect below still gates
  // only its `object`-provider branch). The RESOLUTION half fits via the
  // recipe the hook's own doc comment prescribes for this component by name:
  // an inline `value` data set issues no metadata read, so it is expressed as
  // "there is no source to read from" — `dataSource: undefined` — rather than
  // as a second "should fetch" flag. The hook settles-with-`null` on that
  // path, which is exactly what the hand copy's `hasInlineData` exit did.
  const { ready: objectSchemaReady, def: objectSchema } = useSettledSchema<any>(
    schemaKey,
    hasInlineData ? undefined : dataSource,
  );

  // Permissions context, read here rather than inside the fetch effect below:
  // an effect's DEPENDENCY ARRAY is evaluated during render, so `perms` has to
  // be a binding that already exists by the time this component's render
  // reaches that effect (objectui#7230, same structural note PR #7229 recorded
  // for `ListView`'s memo).
  const perms = usePermissions();

  // Sync external data/loading changes from parent (e.g. ObjectView re-fetches after filter change)
  useEffect(() => {
    if (hasExternalData) {
      setData(externalData!);
      // ...and drop any ceiling this component's OWN fetch had reported
      // (objectui#7210). A parent that hands over `data` owns the query, so it
      // owns whether that query was capped; a `truncated` left over from a
      // fetch whose rows are no longer on screen is a footnote about a result
      // set that is not being drawn. Every other `setData` path here already
      // resets it — this was the one that did not.
      setRowCeiling({ truncated: false });
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

    // ⭐ objectui#6453 — the object schema GATES this query; it does not refine
    // it afterwards. Measured on THIS component (instrumented adapter, three
    // latency profiles), the alternative — putting `objectSchema` in the
    // dependency list below — costs two queries and, when the schema read is
    // the slower of the two, a THREE-step paint: raw ids, back to the
    // "Loading calendar..." placeholder (this effect calls `setLoading(true)`
    // on re-run, and `loading` is an early return above), then the expanded
    // rows. When the schema read is the faster one the first response is
    // instead discarded on arrival — a round trip bought and thrown away.
    // Gating is the only shape that is right in every profile.
    //
    // Scoped to the `object` provider deliberately: an inline (`value`) data
    // set has no expand set to derive and issues no metadata read at all, so
    // gating it would hold a query open on a resolution nothing was going to
    // produce.
    if (dataProvider === 'object' && !objectSchemaReady) return;

    let isMounted = true;
    const fetchData = async () => {
      try {
        if (!isMounted) return;
        setLoading(true);

        if (hasInlineData && dataProvider === 'value') {
          if (isMounted) {
            setData(dataItems as any[]);
            setRowCeiling({ truncated: false });
            setLoading(false);
          }
          return;
        }

        if (!dataSource || typeof dataSource.find !== 'function') {
          throw new Error('DataSource required for object/api providers');
        }

        if (dataProvider === 'object') {
          // `schemaObjectName` already resolves this same 'object' branch's
          // `dataConfig.object` (required on that discriminated-union
          // variant), computed once above for the schema-fetch gate too.
          const objectName = schemaObjectName as string;
          // Auto-inject $expand for lookup/master_detail fields
          // Reached only with the schema resolved (the gate above), so a
          // calendar whose object declares relations queries WITH its
          // expansion the first time. `objectSchema` is `null` here only
          // when there was nothing to resolve it from.
          //
          // [objectui#7230] FIELD-LEVEL SECURITY ON `$expand` — the same gate
          // objectui#7215 / PR #7229 put on the two projection sites in its
          // scope, brought to this one. `$select` on a denied lookup asks the
          // server for a bare foreign key; `$expand` asks it to RESOLVE the
          // relation and return the related record, which is the larger of the
          // two requests.
          //
          // ⚠️ THIS SITE PASSES NO COLUMN LIST, which makes it the sharp one:
          // `buildExpandFields` reads an absent column list as "no column
          // restriction" and falls back to EVERY declared relation on the
          // object, denied ones included. A standalone calendar therefore asks
          // for the maximum possible set by default, not by configuration.
          //
          // Graded as objectui#7215 graded it, by measurement rather than
          // assumption: against ObjectStack this is defence-in-depth, because
          // `plugin-security`'s `FieldMasker.maskRecord` does
          // `delete result[field]` on every unreadable key and objectql's
          // expand path writes the resolved record back under THAT SAME KEY, so
          // one statement removes the expanded object and the bare id alike;
          // the expansion sub-read itself takes the referenced object's full
          // CRUD + RLS + FLS treatment (objectstack#7626). It is load-bearing
          // for a backend that does not strip.
          //
          // ⭐ THE GATE IS ON THE HELPER'S OUTPUT, and on this site the
          // alternative is not merely unsound but unreachable — the call passes
          // `undefined`, so there is no input to gate. Gating the output also
          // gives the required ordering structurally: `buildExpandFields`
          // returns a subset of the object's DECLARED reference-bearing fields,
          // so every name judged here is declared by construction and the
          // "`checkField` answers false for an undeclared key" trap cannot be
          // reached. Pinned in `__tests__/ObjectCalendar.expandFls-7230.test.tsx`.
          //
          // Deferral matches every other gate on this path: an unanswered
          // policy filters nothing, and `perms` is in this effect's dependency
          // list, so the expansion is rebuilt the moment the answer arrives.
          const expandable = buildExpandFields(objectSchema?.fields);
          const expand = !perms?.isLoaded
            ? expandable
            : expandable.filter((f) => perms.checkField(objectName, f, 'read'));
          const result = await dataSource.find(objectName, {
            $filter: schema.filter,
            $orderby: convertSortToQueryParams(schema.sort),
            // The platform ceiling (objectui#7210, ruling a′). A calendar
            // still fetches the whole FILTERED set — it cannot lay out a month
            // from a page whose rows all fall in one week — but the fetch now
            // stops at a number. The one probe row past the ceiling is what
            // makes the cut detectable; `applyNonGridRowCeiling` slices it off.
            // ⛔ Not authorable: no view key reaches this `$top`.
            $top: NON_GRID_ROW_CEILING_TOP,
            ...(expand.length > 0 ? { $expand: expand } : {}),
          });

          const capped = applyNonGridRowCeiling(result);

          if (isMounted) {
            setData(capped.rows);
            setRowCeiling({ truncated: capped.truncated, total: capped.total });
          }
        } else if (dataProvider === 'api') {
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
  }, [hasExternalData, dataProvider, schemaObjectName, dataItems, dataSource, hasInlineData,
      schema.filter, schema.sort, refreshKey, objectSchemaReady, objectSchema, perms]);

  // Transform data to calendar events, and separate out the records that have
  // no date to be placed on at all (objectui#7071 — see the early return in the
  // loop below). ONE pass, so the two lists are always answers about the same
  // dataset and the count under the calendar can never disagree with the grid.
  const { events, unscheduledRecords } = useMemo(() => {
    if (!calendarConfig || !data.length) {
      return { events: [] as CalendarViewEvent[], unscheduledRecords: [] as UnscheduledRecord[] };
    }

    const { startDateField, endDateField, titleField, colorField } = calendarConfig;
    // `colorField` NAMES A FIELD to derive a colour from (objectui#7243). The
    // shared ladder answers the two rungs that depend only on the field's own
    // metadata — the option `color` the author declared for this value, then
    // the value itself when it already IS a colour literal. Built once for the
    // whole dataset, not per record.
    const resolveColorFieldValue = createFieldColorResolver(
      (objectSchema?.fields as Record<string, any> | undefined)?.[colorField ?? ''],
    );
    const resolveTitle = (record: Record<string, any>): string => {
      // 1. Explicit titleField wins when present on the record.
      if (titleField) {
        const v = record[titleField];
        const s = typeof v === 'string' ? v.trim() : v;
        if (s) return String(s);
      }
      // 2-4. Unified object-level resolver (ADR-0079): objectSchema.titleFormat
      //   → objectSchema.displayNameField → type-aware field derivation →
      //   `Record #<id>` floor. Replaces the old per-view chain (template render
      //   → NAME_FIELD_KEY → hard-coded name list → "Untitled") so an event
      //   object whose name lives in e.g. `activity_name` shows the real name.
      return getRecordDisplayName(objectSchema, record);
    };

    const scheduled: CalendarViewEvent[] = [];
    const unscheduled: UnscheduledRecord[] = [];

    data.forEach((record, index) => {
      const startDate = record[startDateField];
      const endDate = endDateField ? record[endDateField] : null;
      const title = resolveTitle(record);
      // Last rung stays where it was: a value no option colours is handed on
      // RAW, so `CalendarView.resolveEventColor` still recognises a Tailwind
      // utility string and still hashes a plain category label onto its
      // theme-aware 8-stop palette. Retiring that would repaint every existing
      // calendar whose `colorField` points at a plain categorical field, which
      // is well beyond this fix.
      const colorRaw = colorField ? record[colorField] : undefined;
      const color = resolveColorFieldValue(colorRaw) ?? colorRaw;
      const id = record.id || record._id || `event-${index}`;

      // NO VALUE in the declared start field means the record has no date —
      // full stop (objectui#7071, ruled 2026-09-01, re-confirmed 2026-09-02).
      // This line used to read `startDate ? new Date(startDate) : new Date()`,
      // so a record missing its date was handed THE CURRENT MOMENT and drawn on
      // today's cell as an ordinary event. The `isNaN` guard below could not
      // catch that by construction: a no-argument `new Date()` is always valid,
      // so the absent-value case was converted into a well-formed lie *before*
      // the check that would have caught it. `end`, three lines down, has
      // always been honest about the same absence (`undefined`); this is
      // `start` catching up. The record leaves the grid entirely and is counted
      // in the "unscheduled" area below the calendar instead: nothing is
      // invented, and nothing disappears without a count.
      if (!startDate) {
        unscheduled.push({ id, title });
        return;
      }

      const start = new Date(startDate);
      // The guard keeps its ORIGINAL job, on a DIFFERENT fact from the one
      // above: a value that is PRESENT but unparseable ('not a date') is
      // dropped here, never bucketed as unscheduled. Absent and malformed are
      // two distinct defects and the two paths stay distinguishable.
      if (isNaN(start.getTime())) return; // Filter out invalid dates

      scheduled.push({
        id,
        title,
        start,
        end: endDate ? new Date(endDate) : undefined,
        color,
        // Only a record that HAS a start reaches this line. That is the point
        // of the early return above, not an accident of ordering: `!endDate`
        // used to fire for a record with no dates AT ALL, so one absent field
        // silently set two rendered properties and a dateless record rendered
        // as an all-day event on today. A record without a start is
        // unscheduled, not all-day. For a record WITH a start the inference is
        // unchanged.
        allDay: !endDate, // If no end date, treat as all-day event
        data: record,
      });
    });

    return { events: scheduled, unscheduledRecords: unscheduled };
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
  // No width is spelled here on purpose (objectui#6303, converging the calendar
  // on the shape #6305 gave ObjectGantt). `width` is `@deprecated [#2578 ->
  // size]` in the spec that owns this shape, and `resolveOverlayWidth` gives an
  // explicit `width` priority OVER `size` — so spelling it kept the deprecated
  // branch load-bearing on the path most calendars take (no declared
  // `navigation`), and made the size buckets unreachable there. Omitting both
  // leaves `resolveOverlayWidth` returning `undefined`, which is what
  // RecordDetailDrawer's own `width` default is for; that default is the
  // identical `min(960px, 60vw)`, so this is a zero-pixel change on every
  // viewport. The absent width is deliberate, not an oversight — do not
  // "restore" it. Pinned by `ObjectCalendar.navWidthDefault.test.tsx`, both
  // halves, because the equivalence now depends on the drawer's default too.
  //
  // Deliberately NOT converged on `size: 'lg'` either: that bucket is
  // `min(92vw, 960px)`, which agrees with the above only at viewport >= 1600px
  // and is up to 53% wider below it. That move is a real behaviour change, and
  // it was RULED AGAINST: objectui#6584, 2026-08-27 — stays on the CSS
  // literal; no bucket convergence. All four surfaces (gantt, kanban,
  // calendar, RecordDetailDrawer) keep today's pixels. The question is
  // CLOSED, not open — do not re-open it as a cleanup. If bucket-vocabulary
  // unification ever becomes a product direction that is a fresh ruling,
  // with visual-regression evidence across all four surfaces in one stroke.
  const navConfig = (schema as any).navigation ?? { mode: 'drawer' };
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
      console.error('[ObjectCalendar] Failed to persist drag-and-drop reschedule:', err);
      // Surface the failure — never silently snap the event back. A row-level
      // security denial (403) is the common case: the user lacks permission to
      // reschedule this record. (cloud#864)
      // …unless the AUTHOR opted in. `userMessage` (objectstack#9934) is the
      // producer-side marking: a field set at throw time to say "this text is
      // for the end user". It is a SEPARATE field from `message`, so nothing
      // unmarked can reach here — the substitution below still governs every
      // platform diagnostic and #3821 holds by construction rather than by us
      // guessing what a body contains. Status-agnostic on purpose: 403 is
      // where this was reported (objectui#5210/#5902), not a fence the
      // contract draws — a marked 409 or 400 renders identically.
      toast.error(
        declaredUserMessage(err) ??
          (isPermissionError(err)
            ? tt('errors.unauthorized', 'You are not authorized to perform this action.')
            : extractWriteErrorMessage(err) ?? tt('table.saveFailed', 'Save failed')),
      );
    }
  }, [calendarConfig, schema.objectName, dataSource, data, tt]);

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
      <div className="bg-background h-[calc(100vh-120px)] sm:h-[calc(100vh-160px)] md:h-[calc(100vh-200px)] min-h-[400px] sm:min-h-[600px]">
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
      {/* objectui#7210 — a month drawn from the first N rows of a larger set
          still reads as a complete month; the note is the only thing that says
          otherwise. Placement follows objectui#7148's chart footnote. */}
      <NonGridRowCeilingNote
        drawn={NON_GRID_ROW_CEILING}
        total={rowCeiling.total}
        truncated={rowCeiling.truncated}
      />

      {/* The "unscheduled" containment area (objectui#7071, ruled 2026-09-01 and
          re-confirmed 2026-09-02). Records with no value in the declared start
          field are no longer given a fabricated date, so they are not on the
          grid above — they are counted here and listed on demand, which is what
          makes their absence from the grid honest rather than silent.

          Rendered only when there is something to report: a calendar whose
          records all carry a date looks exactly as it did before.

          ⛔ Deliberately inert, and that is the ruling, not an omission: no
          drag-to-schedule, no date picker, no way to assign a date from here.
          The ruled affordance is a visible count and an expandable list, and
          nothing more. Do not grow this into a scheduling surface without a
          fresh ruling. */}
      {unscheduledRecords.length > 0 && (
        <div className="mt-2 border-t pt-2" data-calendar-unscheduled="">
          <button
            type="button"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            aria-expanded={unscheduledOpen}
            onClick={() => setUnscheduledOpen((open) => !open)}
          >
            <ChevronRight
              aria-hidden="true"
              className={cn('h-4 w-4 transition-transform', unscheduledOpen && 'rotate-90')}
            />
            {t('calendar.unscheduled', {
              count: unscheduledRecords.length,
              defaultValue: 'Unscheduled ({{count}})',
            })}
          </button>
          {unscheduledOpen && (
            <ul className="mt-1 space-y-1 pl-6" data-calendar-unscheduled-list="">
              {unscheduledRecords.map((record) => (
                <li key={record.id} className="truncate text-sm">
                  {record.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
            // No `?? 'min(960px, 60vw)'` fallback on purpose — `undefined` has
            // to reach the drawer for its OWN identical default to apply. See
            // the `navConfig` comment above (objectui#6303).
            width={navigation.width as any}
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

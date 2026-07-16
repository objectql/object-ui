/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Dashboard-level filter bar (framework#2501).
 *
 * Renders one control per dashboard filter definition — a preset/custom date
 * range for the built-in `dateRange`, a Select for `select`/`lookup` filters,
 * and an Input for `text`/`number` — writing each value into the dashboard's
 * filter variables via `onChange`. The host (`DashboardRenderer`) broadcasts
 * those values into every bound widget's inline query.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  cn,
  Button,
  Calendar,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@object-ui/components';
import { CalendarIcon, RotateCcw } from 'lucide-react';
import { useSafeTranslate } from '@object-ui/i18n';
import {
  DATE_RANGE_PRESETS,
  type DashboardFilterDef,
  type DateRangeValue,
} from '@object-ui/core';

/** Sentinel for the Select's clear item (Radix Select forbids empty values). */
const ALL_VALUE = '__all__';
/** Sentinel for the date-range Select's "Custom…" item. */
const CUSTOM_VALUE = '__custom__';

export interface DashboardFilterBarProps {
  defs: DashboardFilterDef[];
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
  onReset?: () => void;
  dataSource?: any;
  className?: string;
}

/** Format an ISO date (or macro token) for the trigger label. */
function rangeLabel(value: DateRangeValue | undefined, presetLabel: (p: string) => string): string | undefined {
  if (!value) return undefined;
  if (value.preset) return presetLabel(value.preset);
  if (value.from || value.to) return `${value.from ?? '…'} – ${value.to ?? '…'}`;
  return undefined;
}

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function DateRangeFilter({ def, value, onChange }: { def: DashboardFilterDef; value: DateRangeValue | undefined; onChange: (v: DateRangeValue | undefined) => void }) {
  const tt = useSafeTranslate();
  const [customOpen, setCustomOpen] = useState(false);
  const allowCustom = def.allowCustomRange !== false;
  const presetLabel = (p: string) => tt(`dashboard.filters.range.${p}`, p.replace(/_/g, ' '));

  const selectValue = value?.preset ?? (value?.from || value?.to ? CUSTOM_VALUE : ALL_VALUE);

  return (
    <div className="flex items-center gap-1" data-testid={`dashboard-filter-${def.name}`}>
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (v === ALL_VALUE) onChange(undefined);
          else if (v === CUSTOM_VALUE) setCustomOpen(true);
          else onChange({ preset: v });
        }}
      >
        <SelectTrigger className="h-8 w-auto min-w-36 gap-1" aria-label={def.label || tt('dashboard.filters.dateRange', 'Date range')}>
          <CalendarIcon className="size-3.5 opacity-60" />
          <SelectValue placeholder={tt('dashboard.filters.dateRange', 'Date range')}>
            {rangeLabel(value, presetLabel) ?? tt('dashboard.filters.allTime', 'All time')}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{tt('dashboard.filters.allTime', 'All time')}</SelectItem>
          {DATE_RANGE_PRESETS.map((p) => (
            <SelectItem key={p} value={p}>{presetLabel(p)}</SelectItem>
          ))}
          {allowCustom && (
            <SelectItem value={CUSTOM_VALUE}>{tt('dashboard.filters.custom', 'Custom…')}</SelectItem>
          )}
        </SelectContent>
      </Select>
      {allowCustom && (
        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          {/* Invisible anchor — the popover is driven by the "Custom…" select item. */}
          <PopoverTrigger asChild>
            <span aria-hidden className="size-0" />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={{
                from: value?.from && !value.from.startsWith('{') ? new Date(value.from) : undefined,
                to: value?.to && !value.to.startsWith('{') ? new Date(value.to) : undefined,
              }}
              onSelect={(range: any) => {
                if (!range?.from && !range?.to) { onChange(undefined); return; }
                onChange({
                  ...(range?.from ? { from: toIsoDate(range.from) } : {}),
                  ...(range?.to ? { to: toIsoDate(range.to) } : {}),
                });
              }}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function SelectFilter({ def, value, onChange, dataSource }: { def: DashboardFilterDef; value: string | undefined; onChange: (v: string | undefined) => void; dataSource?: any }) {
  const tt = useSafeTranslate();
  const [dynamicOptions, setDynamicOptions] = useState<Array<{ value: string; label: string }> | null>(null);

  // Dynamic options, server-side first (#2578 item 5): when the data source
  // supports dataset queries, distinct values come from a GROUP BY on the
  // server (an inline dataset draft over the source object), so the option
  // list is complete regardless of row count. Falls back to the original
  // best-effort client-side dedupe (top 200 records) when dataset queries
  // are unavailable or the draft is rejected; degrades to an empty list on
  // total failure (same tolerance style as DatasetWidget's option-color
  // fetch).
  const from = def.optionsFrom;
  useEffect(() => {
    if (!from || !dataSource) return;
    let cancelled = false;

    const clientSideFallback = () => {
      if (typeof dataSource.find !== 'function') {
        if (!cancelled) setDynamicOptions([]);
        return;
      }
      dataSource
        .find(from.object, {
          fields: [from.valueField, ...(from.labelField ? [from.labelField] : [])],
          ...(from.filter ? { $filter: from.filter } : {}),
          top: 200,
        })
        .then((records: any) => {
          if (cancelled) return;
          const rows: any[] = Array.isArray(records) ? records : records?.items ?? [];
          const seen = new Map<string, string>();
          for (const r of rows) {
            const v = r?.[from.valueField];
            if (v === undefined || v === null || v === '') continue;
            const key = String(v);
            if (!seen.has(key)) seen.set(key, String(from.labelField ? r?.[from.labelField] ?? key : key));
          }
          setDynamicOptions(Array.from(seen, ([v, l]) => ({ value: v, label: l })));
        })
        .catch(() => { if (!cancelled) setDynamicOptions([]); });
    };

    if (typeof dataSource.queryDataset === 'function') {
      const dimensions = [{ name: from.valueField, field: from.valueField }];
      if (from.labelField && from.labelField !== from.valueField) {
        dimensions.push({ name: from.labelField, field: from.labelField });
      }
      dataSource
        .queryDataset(
          {
            name: 'dashboard_filter_options',
            label: 'Dashboard filter options',
            object: from.object,
            dimensions,
            measures: [{ name: 'option_count', aggregate: 'count' }],
          },
          {
            dimensions: dimensions.map((d) => d.name),
            measures: ['option_count'],
            ...(from.filter ? { runtimeFilter: from.filter } : {}),
            order: { [from.valueField]: 'asc' as const },
            limit: 1000,
          },
        )
        .then((res: any) => {
          if (cancelled) return;
          const rows: any[] = Array.isArray(res?.rows) ? res.rows : [];
          const seen = new Map<string, string>();
          for (const r of rows) {
            const v = r?.[from.valueField];
            if (v === undefined || v === null || v === '') continue;
            const key = String(v);
            if (!seen.has(key)) seen.set(key, String(from.labelField ? r?.[from.labelField] ?? key : key));
          }
          setDynamicOptions(Array.from(seen, ([v, l]) => ({ value: v, label: l })));
        })
        .catch(() => { if (!cancelled) clientSideFallback(); });
    } else {
      clientSideFallback();
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from?.object, from?.valueField, from?.labelField, dataSource]);

  const options = useMemo(() => {
    if (def.options?.length) return def.options.map((o) => ({ value: o, label: o }));
    return dynamicOptions ?? [];
  }, [def.options, dynamicOptions]);

  const label = def.label || def.name;
  return (
    <Select
      // The variables provider initializes string variables to '' — treat
      // any falsy value as "no selection".
      value={value ? String(value) : ALL_VALUE}
      onValueChange={(v) => onChange(v === ALL_VALUE ? undefined : v)}
    >
      <SelectTrigger className="h-8 w-auto min-w-32" aria-label={label} data-testid={`dashboard-filter-${def.name}`}>
        <SelectValue>{value ? String(value) : `${label}: ${tt('dashboard.filters.all', 'All')}`}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>{tt('dashboard.filters.all', 'All')}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TextFilter({ def, value, onChange }: { def: DashboardFilterDef; value: any; onChange: (v: any) => void }) {
  const [draft, setDraft] = useState<string>(value == null ? '' : String(value));
  useEffect(() => { setDraft(value == null ? '' : String(value)); }, [value]);
  const commit = () => {
    const v = draft.trim();
    if (v === '') { onChange(undefined); return; }
    onChange(def.type === 'number' ? Number(v) : v);
  };
  return (
    <Input
      className="h-8 w-36"
      type={def.type === 'number' ? 'number' : 'text'}
      placeholder={def.label || def.name}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
      aria-label={def.label || def.name}
      data-testid={`dashboard-filter-${def.name}`}
    />
  );
}

export function DashboardFilterBar({ defs, values, onChange, onReset, dataSource, className }: DashboardFilterBarProps) {
  const tt = useSafeTranslate();
  if (defs.length === 0) return null;

  // The variables provider initializes undefined defaults to '' / {} by
  // type — normalize those to "empty" so a pristine bar shows no Reset.
  const isEmpty = (v: any) =>
    v == null || v === '' || (typeof v === 'object' && Object.keys(v).length === 0);
  const isDirty = defs.some((def) => {
    const a = values[def.name];
    const b = def.defaultValue;
    if (isEmpty(a) && isEmpty(b)) return false;
    return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
  });

  return (
    <div
      className={cn('col-span-full flex flex-wrap items-center gap-2', className)}
      data-testid="dashboard-filter-bar"
      role="group"
      aria-label={tt('dashboard.filters.label', 'Dashboard filters')}
    >
      {defs.map((def) => {
        const value = values[def.name];
        const set = (v: any) => onChange(def.name, v);
        if (def.type === 'dateRange' || def.type === 'date') {
          return <DateRangeFilter key={def.name} def={def} value={value} onChange={set} />;
        }
        if (def.type === 'select' || def.type === 'lookup') {
          return <SelectFilter key={def.name} def={def} value={value} onChange={set} dataSource={dataSource} />;
        }
        return <TextFilter key={def.name} def={def} value={value} onChange={set} />;
      })}
      {onReset && isDirty && (
        <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground">
          <RotateCcw className="size-3.5" />
          {tt('dashboard.filters.reset', 'Reset')}
        </Button>
      )}
    </div>
  );
}

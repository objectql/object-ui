/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import type { TimelineSchema } from '@object-ui/types';
import {
  Timeline,
  TimelineItem,
  TimelineMarker,
  TimelineContent,
  TimelineTitle,
  TimelineTime,
  TimelineDescription,
  TimelineHorizontal,
  TimelineHorizontalItem,
  TimelineGantt,
  TimelineGanttHeader,
  TimelineGanttRowLabels,
  TimelineGanttGrid,
  TimelineGanttRow,
  TimelineGanttLabel,
  TimelineGanttBar,
  TimelineGanttBarContent,
} from './index';
import { renderChildren, cn } from '@object-ui/components';
import { useDisplayLocale } from '@object-ui/i18n';
import {
  useTimelineTranslation,
  translateTimelineDefault,
  type TimelineTranslate,
} from './useTimelineTranslation';

// Constants
/**
 * The spec's timeline scale vocabulary (`ui/view.zod.ts`
 * `TimelineConfigSchema.scale`). Exported for the spec-parity test.
 */
export const TIMELINE_SCALES: ReadonlySet<string> = new Set([
  'hour', 'day', 'week', 'month', 'quarter', 'year',
]);

/**
 * Resolve the axis scale for the gantt variant. The spec key is `scale`;
 * `timeScale` is this renderer's pre-spec dialect, kept for stored JSON —
 * before #2942 ONLY `timeScale` was read, so every spec-authored `scale`
 * (all six values) was silently ignored. An absent/unknown value keeps the
 * renderer's historical `month` default. The `vertical` / `horizontal`
 * variants are sequential event feeds with no time axis, so `scale` has
 * nothing to bucket there by construction.
 */
export function resolveTimelineScale(schema: { scale?: unknown; timeScale?: unknown }): string {
  const raw = schema.scale ?? schema.timeScale;
  return typeof raw === 'string' && TIMELINE_SCALES.has(raw) ? raw : 'month';
}

/**
 * Gantt header labels for one scale across [minDate, maxDate]. Every spec
 * scale produces a non-empty header row — `hour` / `quarter` / `year` used to
 * fall through the month/week/day chain and return `[]`, blanking the axis
 * (#2942). Exported for the spec-parity test.
 *
 * `locale` is threaded in rather than read here: this is a pure function, and
 * the session's locale lives behind a hook (#4513). The three `Intl` branches
 * below used to pass a literal `'en-US'`, so a fully Chinese timeline rendered
 * an English axis. The default is `'en'` — the same concrete last resort
 * `useDisplayLocale()` falls back to, and byte-identical to the retired
 * `'en-US'` at all three sites — so the existing 3-argument call sites keep
 * producing exactly what they produced before.
 *
 * `t` is threaded on the same seam and for the same reason (#4520). The two are
 * different kinds of dependency and each covers what the other cannot: a locale
 * TAG formats a date, a TRANSLATION spells a word. The `week` and `quarter`
 * branches never touched `Intl`, so #4513 left them reading `Week 1` / `Q3
 * 2026` on an axis that had just become Chinese. Its default is the package's
 * own defaults table, which is what the channel serves with no `I18nProvider`
 * mounted, so 3- and 4-argument call sites keep producing byte-identical
 * English.
 */
export function generateTimeScaleHeaders(
  scale: string,
  minDate: string,
  maxDate: string,
  locale: string = 'en',
  t: TimelineTranslate = translateTimelineDefault,
): string[] {
  const headers: string[] = [];
  const start = new Date(minDate);
  const end = new Date(maxDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return headers;
  const current = new Date(start);
  switch (scale) {
    case 'hour':
      while (current <= end) {
        headers.push(current.toLocaleString(locale, { month: 'short', day: 'numeric', hour: 'numeric' }));
        current.setHours(current.getHours() + 1);
      }
      break;
    case 'day':
      while (current <= end) {
        headers.push(current.toLocaleDateString(locale, { month: 'short', day: 'numeric' }));
        current.setDate(current.getDate() + 1);
      }
      break;
    case 'week': {
      let week = 1;
      while (current <= end) {
        headers.push(t('timeline.scale.week', { n: week++ }));
        current.setDate(current.getDate() + 7);
      }
      break;
    }
    case 'quarter':
      current.setMonth(Math.floor(current.getMonth() / 3) * 3, 1);
      while (current <= end) {
        headers.push(
          t('timeline.scale.quarter', {
            quarter: Math.floor(current.getMonth() / 3) + 1,
            year: current.getFullYear(),
          }),
        );
        current.setMonth(current.getMonth() + 3);
      }
      break;
    case 'year':
      // Snap to the calendar-year start so every year touched by the range
      // gets a bucket (mirrors the quarter snap above).
      current.setMonth(0, 1);
      while (current <= end) {
        headers.push(String(current.getFullYear()));
        current.setFullYear(current.getFullYear() + 1);
      }
      break;
    case 'month':
    default:
      while (current <= end) {
        headers.push(current.toLocaleDateString(locale, { month: 'short', year: 'numeric' }));
        current.setMonth(current.getMonth() + 1);
      }
      break;
  }
  return headers;
}

// Helper function to calculate date range from items
function calculateDateRange(items: any[]): { minDate: string; maxDate: string } {
  const allDates = items.flatMap((row: any) =>
    (row.items || []).flatMap((item: any) => [item.startDate, item.endDate])
  );
  
  const minTimestamp = Math.min(...allDates.map((d: string) => new Date(d).getTime()));
  const maxTimestamp = Math.max(...allDates.map((d: string) => new Date(d).getTime()));
  
  return {
    minDate: new Date(minTimestamp).toISOString().split('T')[0],
    maxDate: new Date(maxTimestamp).toISOString().split('T')[0],
  };
}

// Helper function to calculate bar position and width based on dates
function calculateBarDimensions(
  startDate: string,
  endDate: string,
  minDate: string,
  maxDate: string
): { start: number; width: number } {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const min = new Date(minDate).getTime();
  const max = new Date(maxDate).getTime();

  const totalDuration = max - min;
  const startOffset = start - min;
  const duration = end - start;

  return {
    start: (startOffset / totalDuration) * 100,
    width: (duration / totalDuration) * 100,
  };
}

/**
 * Format one item date for display.
 *
 * `locale` is a REQUIRED parameter, not an optional one (#4513): this helper is
 * module-private, every call site sits inside `TimelineRenderer`, and the two
 * ways it used to get a locale were both wrong in the same session. `'short'`
 * passed nothing at all — and no tag means the MACHINE's locale, which has
 * nothing to do with the user — while `'long'` passed a literal `'en-US'`. A
 * required parameter is what keeps a future branch from quietly reintroducing
 * either. `'iso'` is a machine format by definition and stays locale-free.
 */
function formatDate(dateString: string, format: string | undefined, locale: string): string {
  const date = new Date(dateString);
  if (format === 'short') {
    return date.toLocaleDateString(locale);
  }
  if (format === 'long') {
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  return date.toISOString().split('T')[0];
}

/**
 * Render an inline option chip for the per-item metadata strip
 * (status, priority, …). Uses the option color when supplied so the
 * chip visually echoes the marker, falling back to a neutral pill
 * when the option has no color metadata.
 */
function MetaChip({ label, color }: { label: string; color?: string }) {
  const style = color
    ? { backgroundColor: `${color}22`, color, borderColor: `${color}55` }
    : undefined;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        !color && 'bg-muted text-muted-foreground border-transparent'
      )}
      style={style}
    >
      {label}
    </span>
  );
}

/** Group adjacent items that share the same `group` key (already in
 *  display order) into a single section so the renderer can drop a
 *  sticky header above each bucket. */
function groupAdjacent<T extends { group?: string | null }>(items: T[]): Array<{ key: string; items: T[] }> {
  const out: Array<{ key: string; items: T[] }> = [];
  for (const it of items) {
    const key = it.group == null ? '' : String(it.group);
    const last = out[out.length - 1];
    if (last && last.key === key) last.items.push(it);
    else out.push({ key, items: [it] });
  }
  return out;
}

export const TimelineRenderer = ({ schema, className, ...props }: { schema: TimelineSchema; className?: string; [key: string]: any }) => {
    const {
      variant = 'vertical',
      items = [],
      dateFormat = 'short',
      onItemClick,
    } = schema;

    // The one locale channel every renderer in this repo resolves through:
    // tenant regional default → active UI language → 'en' (#4513, the channel
    // #4468 / PR #4512 converged `@object-ui/fields` onto). Read once here,
    // above every variant's early return so the hook count can never depend on
    // `variant`, and threaded down — `formatDate` and `generateTimeScaleHeaders`
    // are module-level functions and cannot host a hook themselves.
    const displayLocale = useDisplayLocale();

    // The package's translate channel, read on the same terms and for the same
    // structural reason as the locale above: one read, above every variant's
    // early return, threaded down into the module-level helpers that cannot
    // host a hook (#4520).
    //
    // It is a SECOND channel, not a duplicate of the first, and the two are
    // allowed to disagree: `useDisplayLocale()` puts the tenant's regional
    // default first (how this org writes dates), while `t` follows the UI
    // language (what this user reads). A tenant configured `en` with a user
    // reading Chinese chrome therefore renders `Aug 2026` beside `第 1 周` —
    // the same split `timeline.bucket.*` has always had in `ObjectTimeline`.
    const { t } = useTimelineTranslation();

    // Vertical Timeline
    if (variant === 'vertical') {
      // Detect whether the data was annotated with a `group` key
      // (ObjectTimeline does this for both explicit groupBy and the
      // automatic date bucketing fallback). When present we render
      // sticky bucket headers; when absent we keep the historical flat
      // list so JSON-defined timelines aren't visually disturbed.
      const groups = groupAdjacent(items as Array<any>);
      const hasGroups = groups.some((g) => g.key !== '');

      const renderItem = (item: any, key: React.Key) => {
        // Custom CSS color from objectDef option metadata overrides the
        // CVA variant — that lets the marker reflect the live status
        // colour (e.g. amber for "in progress") without us hard-coding
        // every status into the variants enum.
        const markerStyle = item.color
          ? { backgroundColor: `${item.color}33`, borderColor: item.color }
          : undefined;
        const dateLabel = item.time
          ? formatDate(item.time, dateFormat, displayLocale)
          : (item.startDate ? formatDate(item.startDate, dateFormat, displayLocale) : '');
        const endLabel = item.endDate && item.endDate !== item.startDate
          ? formatDate(item.endDate, dateFormat, displayLocale)
          : '';
        const meta = Array.isArray(item.meta) ? item.meta : [];
        return (
          <TimelineItem
            key={key}
            density="compact"
            className={cn(item.className, onItemClick && 'cursor-pointer')}
            onClick={() => onItemClick?.(item)}
          >
            <TimelineMarker
              variant={item.color ? 'default' : (item.variant || 'default')}
              style={markerStyle}
            >
              {item.icon && <span className="text-xs">{item.icon}</span>}
            </TimelineMarker>
            <TimelineContent>
              {(dateLabel || endLabel) && (
                <TimelineTime
                  dateTime={item.time || item.startDate}
                  className="!mb-1 text-xs"
                >
                  {dateLabel}
                  {endLabel && <span className="text-muted-foreground/70"> → {endLabel}</span>}
                </TimelineTime>
              )}
              {item.title && <TimelineTitle className="text-sm sm:text-base mb-1">{item.title}</TimelineTitle>}
              {meta.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1 mb-1">
                  {meta.map((m: any) => (
                    <MetaChip key={m.key} label={m.label} color={m.color} />
                  ))}
                </div>
              )}
              {item.description && (
                <TimelineDescription className="text-sm text-muted-foreground line-clamp-2 sm:line-clamp-none">
                  {item.description}
                </TimelineDescription>
              )}
              {item.content && renderChildren(item.content)}
            </TimelineContent>
          </TimelineItem>
        );
      };

      if (!hasGroups) {
        return (
          <Timeline className={className} {...props}>
            {(items as Array<any>).map((item, index) => renderItem(item, index))}
          </Timeline>
        );
      }

      return (
        <div className={cn('px-4 sm:px-6 py-2', className)} {...props}>
          {groups.map((g, gi) => (
            <section key={`${g.key}-${gi}`} className="mb-4">
              <header className="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-1.5 backdrop-blur bg-background/90 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b">
                <span>{g.key}</span>
                <span className="ml-2 text-muted-foreground/60 font-normal normal-case">
                  {g.items.length}
                </span>
              </header>
              <Timeline className="mt-3">
                {g.items.map((item, index) => renderItem(item, `${gi}-${index}`))}
              </Timeline>
            </section>
          ))}
        </div>
      );
    }

    // Horizontal Timeline
    if (variant === 'horizontal') {
      return (
        <TimelineHorizontal className={cn("overflow-x-auto [-webkit-overflow-scrolling:touch]", className)} {...props}>
          {items.map((item: any, index: number) => (
            <TimelineHorizontalItem key={index} className={cn(item.className, onItemClick && 'cursor-pointer')} onClick={() => onItemClick?.(item)}>
              <div className="flex flex-col items-center">
                <TimelineMarker variant={item.variant || 'default'}>
                  {item.icon && <span className="text-xs">{item.icon}</span>}
                </TimelineMarker>
                <div className="mt-4 text-center">
                  {item.time && (
                    <TimelineTime dateTime={item.time}>
                      {formatDate(item.time, dateFormat, displayLocale)}
                    </TimelineTime>
                  )}
                  {item.title && <TimelineTitle>{item.title}</TimelineTitle>}
                  {item.description && (
                    <TimelineDescription className="text-center line-clamp-2 sm:line-clamp-none">
                      {item.description}
                    </TimelineDescription>
                  )}
                  {item.content && renderChildren(item.content)}
                </div>
              </div>
              {index < items.length - 1 && (
                <div className="absolute left-full w-16 border-t-2 border-gray-200 top-3" />
              )}
            </TimelineHorizontalItem>
          ))}
        </TimelineHorizontal>
      );
    }

    // Gantt/Airtable-style Timeline
    if (variant === 'gantt') {
      // Calculate date range from all items
      const dateRange = calculateDateRange(items);
      const minDate = schema.minDate || dateRange.minDate;
      const maxDate = schema.maxDate || dateRange.maxDate;

      // Generate time scale headers — the spec `scale` key drives this
      // (legacy `timeScale` kept for stored JSON); every spec scale produces
      // a header row (#2942).
      const timeHeaders = generateTimeScaleHeaders(
        resolveTimelineScale(schema as { scale?: unknown; timeScale?: unknown }),
        minDate,
        maxDate,
        displayLocale,
        t,
      );

      return (
        <TimelineGantt className={cn("overflow-x-auto [-webkit-overflow-scrolling:touch]", className)} {...props}>
          {/* Header */}
          <TimelineGanttHeader>
            <TimelineGanttRowLabels className="flex items-center px-2 sm:px-4 py-2 sm:py-3">
              <span className="font-semibold text-xs sm:text-sm">
                {schema.rowLabel || t('timeline.gantt.rowLabel')}
              </span>
            </TimelineGanttRowLabels>
            <TimelineGanttGrid>
              <div className="flex h-full">
                {timeHeaders.map((header, index) => (
                  <div
                    key={index}
                    className="flex-1 px-1 sm:px-2 py-2 sm:py-3 border-r text-xs font-medium text-center"
                  >
                    {header}
                  </div>
                ))}
              </div>
            </TimelineGanttGrid>
          </TimelineGanttHeader>

          {/* Rows */}
          <div>
            <div className="flex">
              <TimelineGanttRowLabels>
                {items.map((row: any, rowIndex: number) => (
                  <TimelineGanttRow key={rowIndex}>
                    <TimelineGanttLabel title={row.label} className="truncate">
                      {row.label}
                    </TimelineGanttLabel>
                  </TimelineGanttRow>
                ))}
              </TimelineGanttRowLabels>
              <TimelineGanttGrid className="relative">
                {items.map((row: any, rowIndex: number) => (
                  <TimelineGanttRow key={rowIndex} className="relative">
                    {(row.items || []).map((item: any, itemIndex: number) => {
                      const dimensions = calculateBarDimensions(
                        item.startDate,
                        item.endDate,
                        minDate,
                        maxDate
                      );

                      return (
                        <TimelineGanttBar
                          key={itemIndex}
                          start={dimensions.start}
                          width={dimensions.width}
                          variant={item.variant || 'default'}
                          onClick={() => onItemClick?.(item, row, rowIndex, itemIndex)}
                          title={`${item.title || ''}\n${formatDate(item.startDate, dateFormat, displayLocale)} - ${formatDate(item.endDate, dateFormat, displayLocale)}`}
                        >
                          <TimelineGanttBarContent>
                            {item.title}
                          </TimelineGanttBarContent>
                        </TimelineGanttBar>
                      );
                    })}
                  </TimelineGanttRow>
                ))}
              </TimelineGanttGrid>
            </div>
          </div>
        </TimelineGantt>
      );
    }

    return null;
  };

ComponentRegistry.register(
  'timeline', 
  TimelineRenderer,
  {
    namespace: 'plugin-timeline',
    label: 'Timeline',
    category: 'data-display',
    inputs: [
      {
        name: 'variant',
        type: 'enum',
        enum: ['vertical', 'horizontal', 'gantt'],
        label: 'Timeline Variant',
        defaultValue: 'vertical',
      },
      {
        name: 'items',
        type: 'array',
        label: 'Timeline Items',
        description:
          'For vertical/horizontal: Array of { time, title, description, variant, icon, content }. For gantt: Array of { label, items: [{ title, startDate, endDate, variant }] }',
      },
      {
        name: 'dateFormat',
        type: 'enum',
        enum: ['short', 'long', 'iso'],
        label: 'Date Format',
        defaultValue: 'short',
      },
      {
        name: 'timeScale',
        type: 'enum',
        enum: ['day', 'week', 'month'],
        label: 'Time Scale (Gantt only)',
        defaultValue: 'month',
      },
      {
        name: 'rowLabel',
        type: 'string',
        label: 'Row Label (Gantt only)',
        defaultValue: 'Items',
      },
      {
        name: 'minDate',
        type: 'string',
        label: 'Min Date (Gantt only)',
        description: 'Override auto-calculated min date (YYYY-MM-DD)',
      },
      {
        name: 'maxDate',
        type: 'string',
        label: 'Max Date (Gantt only)',
        description: 'Override auto-calculated max date (YYYY-MM-DD)',
      },
      { name: 'className', type: 'string', label: 'CSS Class' },
    ],
    defaultProps: {
      variant: 'vertical',
      dateFormat: 'short',
      items: [
        {
          time: '2024-01-15',
          title: 'Project Started',
          description: 'Kickoff meeting and initial planning',
          variant: 'success',
          icon: '🚀',
        },
        {
          time: '2024-02-01',
          title: 'First Milestone',
          description: 'Completed initial design phase',
          variant: 'info',
          icon: '🎨',
        },
        {
          time: '2024-03-15',
          title: 'Beta Release',
          description: 'Released beta version to testers',
          variant: 'warning',
          icon: '⚡',
        },
        {
          time: '2024-04-01',
          title: 'Launch',
          description: 'Official product launch',
          variant: 'success',
          icon: '🎉',
        },
      ],
    },
    examples: {
      vertical: {
        variant: 'vertical',
        dateFormat: 'long',
        items: [
          {
            time: '2024-01-15',
            title: 'Project Started',
            description: 'Kickoff meeting and initial planning',
            variant: 'success',
          },
          {
            time: '2024-02-01',
            title: 'First Milestone',
            description: 'Completed initial design phase',
            variant: 'info',
          },
        ],
      },
      horizontal: {
        variant: 'horizontal',
        dateFormat: 'short',
        items: [
          {
            time: '2024-01-01',
            title: 'Q1',
            description: 'First quarter',
            variant: 'default',
          },
          {
            time: '2024-04-01',
            title: 'Q2',
            description: 'Second quarter',
            variant: 'info',
          },
          {
            time: '2024-07-01',
            title: 'Q3',
            description: 'Third quarter',
            variant: 'warning',
          },
          {
            time: '2024-10-01',
            title: 'Q4',
            description: 'Fourth quarter',
            variant: 'success',
          },
        ],
      },
      gantt: {
        variant: 'gantt',
        dateFormat: 'short',
        timeScale: 'month',
        rowLabel: 'Projects',
        items: [
          {
            label: 'Backend Development',
            items: [
              {
                title: 'API Design',
                startDate: '2024-01-01',
                endDate: '2024-01-31',
                variant: 'success',
              },
              {
                title: 'Implementation',
                startDate: '2024-02-01',
                endDate: '2024-03-31',
                variant: 'info',
              },
            ],
          },
          {
            label: 'Frontend Development',
            items: [
              {
                title: 'UI Design',
                startDate: '2024-01-15',
                endDate: '2024-02-15',
                variant: 'warning',
              },
              {
                title: 'Component Dev',
                startDate: '2024-02-15',
                endDate: '2024-04-15',
                variant: 'default',
              },
            ],
          },
          {
            label: 'Testing',
            items: [
              {
                title: 'QA Phase',
                startDate: '2024-03-01',
                endDate: '2024-04-30',
                variant: 'danger',
              },
            ],
          },
        ],
      },
    },
  }
);

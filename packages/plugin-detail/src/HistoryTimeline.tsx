/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * HistoryTimeline — read-only renderer for record audit history.
 *
 * Design notes:
 * - Mirrors the patterns used by mainstream products (Salesforce / HubSpot /
 *   Jira / Linear / GitHub): avatar + display name + relative time, with
 *   per-field old → new diff when available. We never render a raw user UUID
 *   as the actor label; if no display name is resolved we fall back to
 *   "Unknown user".
 * - Never re-fetches data on its own; relies on the caller to resolve
 *   `user_name` / `user_avatar` from `user_id` and to provide a pre-computed
 *   `changes` diff so this component stays presentation-only and SSR-safe.
 */
import * as React from 'react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from '@object-ui/components';

export interface HistoryChange {
  /** Raw field name from the schema (e.g. "industry"). */
  field: string;
  /** Optional human-readable field label (e.g. "Industry"). */
  label?: string;
  from?: unknown;
  to?: unknown;
}

export interface HistoryEntry {
  id?: string | number;
  created_at?: string | number | Date;
  action?: string;
  user_id?: string | number | null;
  user_name?: string | null;
  user_avatar?: string | null;
  summary?: string | null;
  /** Optional pre-computed field-level diff. */
  changes?: HistoryChange[];
  [extra: string]: unknown;
}

export interface HistoryTimelineProps {
  entries: HistoryEntry[];
  loading?: boolean;
  emptyText?: string;
  /** Localized fallback for entries with no resolved actor name. Defaults to "Unknown user". */
  unknownUserText?: string;
  className?: string;
  /** Locale used for relative time formatting. Defaults to browser locale. */
  locale?: string;
}

const ACTION_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  create: 'default',
  update: 'secondary',
  delete: 'destructive',
  restore: 'outline',
  login: 'outline',
  logout: 'outline',
  permission_change: 'secondary',
  config_change: 'secondary',
  export: 'outline',
  import: 'outline',
};

function formatAbsolute(value: HistoryEntry['created_at']): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

const RELATIVE_THRESHOLDS: Array<[number, Intl.RelativeTimeFormatUnit]> = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [7, 'day'],
  [4.34524, 'week'],
  [12, 'month'],
  [Number.POSITIVE_INFINITY, 'year'],
];

function formatRelative(value: HistoryEntry['created_at'], locale?: string): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  // Negative: in the past. Recharts/Intl convention: -5 minutes = "5 minutes ago".
  let delta = (d.getTime() - Date.now()) / 1000;
  for (const [divisor, unit] of RELATIVE_THRESHOLDS) {
    if (Math.abs(delta) < divisor) {
      try {
        return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
          Math.round(delta),
          unit,
        );
      } catch {
        return formatAbsolute(value);
      }
    }
    delta /= divisor;
  }
  return formatAbsolute(value);
}

function initialsFromName(name?: string | null): string {
  if (!name) return '?';
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return '?';
  return parts
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

function formatDiffValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function HistoryTimeline({
  entries,
  loading,
  emptyText,
  unknownUserText,
  className,
  locale,
}: HistoryTimelineProps) {
  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-md border border-dashed py-10 text-sm text-muted-foreground',
          className,
        )}
      >
        {emptyText ?? 'No history yet'}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <ol className={cn('space-y-4', className)}>
        {entries.map((entry, idx) => {
          const action = (entry.action ?? '').toLowerCase();
          const variant = ACTION_VARIANT[action] ?? 'outline';
          const displayName =
            (typeof entry.user_name === 'string' && entry.user_name.trim()) ||
            unknownUserText ||
            'Unknown user';
          const absoluteWhen = formatAbsolute(entry.created_at);
          const relativeWhen = formatRelative(entry.created_at, locale);
          const avatarUrl = typeof entry.user_avatar === 'string' ? entry.user_avatar : undefined;
          return (
            <li key={(entry.id as React.Key) ?? idx} className="flex items-start gap-3">
              <Avatar className="h-8 w-8 mt-0.5 shrink-0">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
                <AvatarFallback className="text-[10px] font-medium">
                  {initialsFromName(entry.user_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm font-medium text-foreground">{displayName}</span>
                  {entry.action && (
                    <Badge variant={variant} className="text-[10px] uppercase tracking-wide">
                      {entry.action}
                    </Badge>
                  )}
                  {absoluteWhen && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="text-xs text-muted-foreground cursor-help"
                          aria-label={absoluteWhen}
                        >
                          {relativeWhen || absoluteWhen}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{absoluteWhen}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {entry.summary && (
                  <p className="mt-1 text-sm text-muted-foreground">{entry.summary}</p>
                )}
                {entry.changes && entry.changes.length > 0 && (
                  action === 'create' ? (
                    <details className="mt-1 group">
                      <summary className="cursor-pointer list-none text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 select-none">
                        <span className="transition-transform group-open:rotate-90">▸</span>
                        <span>
                          {entry.changes.length === 1
                            ? '1 field populated'
                            : `${entry.changes.length} fields populated`}
                        </span>
                      </summary>
                      <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground pl-4">
                        {entry.changes.map((c) => (
                          <li key={c.field} className="leading-relaxed">
                            <span className="font-medium text-foreground">{c.label || c.field}</span>
                            {': '}
                            <span className="text-foreground">{formatDiffValue(c.to)}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                      {entry.changes.map((c) => (
                        <li key={c.field} className="leading-relaxed">
                          <span className="font-medium text-foreground">{c.label || c.field}</span>
                          {': '}
                          <span className="line-through opacity-70">{formatDiffValue(c.from)}</span>
                          {' → '}
                          <span className="text-foreground">{formatDiffValue(c.to)}</span>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </TooltipProvider>
  );
}

/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useState } from 'react';
import { cn } from '@object-ui/components';
import { Bug, ChevronDown, ChevronUp } from 'lucide-react';

/** Per-widget diagnostic information surfaced by the debug overlay. */
export interface WidgetDebugInfo {
  id: string;
  title?: string;
  type?: string;
  resolvedType?: string;
  hasData: boolean;
  isObjectProvider: boolean;
  objectName?: string;
  hasAggregate: boolean;
  dataSnapshot?: unknown;
}

export interface DashboardDebugOverlayProps {
  dashboardTitle?: string;
  widgetCount: number;
  hasDataSource: boolean;
  dataSourceKeys?: string[];
  widgets: WidgetDebugInfo[];
}

/**
 * Visual debug overlay rendered at the top of a Dashboard when `debug: true`.
 * Shows data-chain diagnostics for every widget so developers can quickly
 * locate broken dataSource/context injection, missing objectName, or
 * absent aggregate configs.
 */
export function DashboardDebugOverlay({
  dashboardTitle,
  widgetCount,
  hasDataSource,
  dataSourceKeys,
  widgets,
}: DashboardDebugOverlayProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "col-span-full rounded-lg border text-xs font-mono mb-3",
        "bg-yellow-50 border-yellow-300 text-yellow-900",
        "dark:bg-yellow-950 dark:border-yellow-700 dark:text-yellow-200"
      )}
      data-testid="dashboard-debug-overlay"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        data-testid="dashboard-debug-toggle"
      >
        <Bug className="h-4 w-4 shrink-0" />
        <span className="font-semibold">Debug</span>
        <span className="truncate">
          {dashboardTitle ?? 'Dashboard'} — {widgetCount} widget(s) — dataSource: {hasDataSource ? 'present' : '⚠ missing'}
        </span>
        {expanded ? <ChevronUp className="ml-auto h-4 w-4 shrink-0" /> : <ChevronDown className="ml-auto h-4 w-4 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2" data-testid="dashboard-debug-details">
          {/* Context summary */}
          <div>
            <span className="font-semibold">dataSource keys: </span>
            {dataSourceKeys && dataSourceKeys.length > 0 ? dataSourceKeys.join(', ') : <span className="text-red-600 dark:text-red-400">none / empty</span>}
          </div>

          {/* Per-widget diagnostics */}
          {widgets.length === 0 && <div className="italic">No widgets rendered yet.</div>}
          {widgets.map((w, i) => (
            <div
              key={w.id ?? i}
              className={cn(
                "rounded border px-2 py-1",
                w.hasData || w.isObjectProvider
                  ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950"
                  : "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950"
              )}
              data-testid={`debug-widget-${w.id}`}
            >
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                <span><b>id:</b> {w.id}</span>
                {w.title && <span><b>title:</b> {w.title}</span>}
                <span><b>type:</b> {w.type ?? '–'}</span>
                <span><b>resolved:</b> {w.resolvedType ?? '–'}</span>
                <span><b>data:</b> {w.hasData ? '✓' : '✗'}</span>
                <span><b>provider:object:</b> {w.isObjectProvider ? '✓' : '✗'}</span>
                {w.objectName && <span><b>objectName:</b> {w.objectName}</span>}
                <span><b>aggregate:</b> {w.hasAggregate ? '✓' : '✗'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

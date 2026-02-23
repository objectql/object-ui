/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { AggregationResult } from './useGroupedData';

export interface GroupRowProps {
  /** Unique key identifying this group */
  groupKey: string;
  /** Display label for the group (field value or "(empty)") */
  label: string;
  /** Number of rows in this group */
  count: number;
  /** Whether the group is collapsed */
  collapsed: boolean;
  /** Computed aggregation results for this group */
  aggregations?: AggregationResult[];
  /** Callback when the group header is clicked to toggle collapse */
  onToggle: (key: string) => void;
  /** Children to render when not collapsed (the group content) */
  children: React.ReactNode;
}

/**
 * GroupRow renders a collapsible group header with field value, record count,
 * and optional aggregation summary. Used by ObjectGrid for grouped rendering.
 */
export const GroupRow: React.FC<GroupRowProps> = ({
  groupKey,
  label,
  count,
  collapsed,
  aggregations,
  onToggle,
  children,
}) => {
  return (
    <div className="border rounded-md" data-testid={`group-row-${groupKey}`}>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-left bg-muted/50 hover:bg-muted transition-colors"
        onClick={() => onToggle(groupKey)}
        aria-expanded={!collapsed}
      >
        {collapsed
          ? <ChevronRight className="h-4 w-4 shrink-0" />
          : <ChevronDown className="h-4 w-4 shrink-0" />}
        <span className="group-label">{label}</span>
        <span className="ml-1 text-xs text-muted-foreground group-count">({count})</span>
        {aggregations && aggregations.length > 0 && (
          <span className="ml-2 text-xs text-muted-foreground group-aggregations">
            {aggregations.map((agg) => (
              <span key={`${agg.field}-${agg.type}`} className="mr-2">
                {agg.type}: {Number.isInteger(agg.value) ? agg.value : agg.value.toFixed(2)}
              </span>
            ))}
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{count}</span>
      </button>
      {!collapsed && children}
    </div>
  );
};

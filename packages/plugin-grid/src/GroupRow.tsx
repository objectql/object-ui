/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@object-ui/components';
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
  /**
   * Small grey caption shown above the group header (the field label being
   * grouped on, e.g. "Status"). When omitted, the caption row is skipped —
   * useful for nested subgroups that share the parent's caption space.
   */
  fieldLabel?: string;
  /**
   * Optional Tailwind class string applied to the group label "pill".
   *
   * Derive it the way the cell renderer of the same field value derives it,
   * or the header and the cell under it disagree on one option's colour
   * (objectui#5183): prefer `getBadgeHexAppearance(color)` from
   * `@object-ui/fields` and use its `className`, falling back to
   * `getBadgeColorClasses(color, value)` when it returns `undefined`. When
   * omitted, the label renders as plain text with a subtle muted background.
   */
  labelColorClass?: string;
  /**
   * Inline style accompanying `labelColorClass`. **Required whenever the
   * class string came from `getBadgeHexAppearance`** — that className reads
   * CSS custom properties which only this style declares, so passing the
   * class alone paints a pill against undefined variables. Pass the helper's
   * `style` verbatim; leave unset on the palette-family path.
   */
  labelColorStyle?: React.CSSProperties;
  /**
   * Short marker rendered beside `count` when the grouping was computed over
   * a PAGE of the result set rather than the whole of it (objectui#7189).
   *
   * `count` is then a page slice, not the group's size, and a group whose
   * records all fall beyond the loaded rows is absent from the list entirely.
   * The marker lives here, next to the number, because that is the number a
   * reader treats as authoritative — the paging footer says nothing about
   * what was grouped, and demonstrably does not prevent the wrong reading.
   *
   * Presence is the switch: leave it unset and no marker renders. The host
   * owns the wording (this package's translation bundle), so this component
   * stays free of i18n wiring like the rest of its props.
   */
  partialLabel?: string;
  /**
   * Full sentence behind `partialLabel` — the marker's `title` and its
   * accessible name. Carries the numbers when the host can support them.
   * Ignored unless `partialLabel` is set.
   */
  partialTitle?: string;
  /** Callback when the group header is clicked to toggle collapse */
  onToggle: (key: string) => void;
  /** Children to render when not collapsed (the group content) */
  children: React.ReactNode;
}

/**
 * GroupRow renders a collapsible group header followed by its children.
 *
 * Visual style follows Airtable's grouped-list pattern: no surrounding
 * border, a small grey field-name caption above (optional), and a header
 * row consisting of a chevron, a colored "pill" label, and a count. The
 * children render directly underneath with a small left rail rather than
 * a nested rounded card, which keeps multi-level grouping legible.
 */
export const GroupRow: React.FC<GroupRowProps> = ({
  groupKey,
  label,
  count,
  collapsed,
  aggregations,
  fieldLabel,
  labelColorClass,
  labelColorStyle,
  partialLabel,
  partialTitle,
  onToggle,
  children,
}) => {
  const pillClass = labelColorClass
    ? cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', labelColorClass)
    : 'inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground';

  return (
    <div data-testid={`group-row-${groupKey}`} className="group/grouprow">
      {fieldLabel && (
        <div className="px-1 pb-1 text-[11px] font-medium text-muted-foreground tracking-wide group-label-caption">
          {fieldLabel}
        </div>
      )}
      <button
        type="button"
        className="flex w-full items-center gap-2 px-1 py-1 text-sm text-left rounded-md hover:bg-muted/40 transition-colors"
        onClick={() => onToggle(groupKey)}
        aria-expanded={!collapsed}
      >
        {collapsed
          ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        <span className={cn(pillClass, 'group-label')} style={labelColorStyle}>{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums group-count">{count}</span>
        {partialLabel && (
          <span
            data-testid={`group-count-partial-${groupKey}`}
            className="rounded-sm bg-muted px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground group-count-partial"
            title={partialTitle}
            aria-label={partialTitle}
          >
            {partialLabel}
          </span>
        )}
        {aggregations && aggregations.length > 0 && (
          <span className="ml-2 text-xs text-muted-foreground group-aggregations">
            {aggregations.map((agg) => (
              <span key={`${agg.field}-${agg.type}`} className="mr-2">
                {agg.type}: {Number.isInteger(agg.value) ? agg.value : agg.value.toFixed(2)}
              </span>
            ))}
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="mt-1 ml-1.5 pl-3 border-l border-border/60">
          {children}
        </div>
      )}
    </div>
  );
};

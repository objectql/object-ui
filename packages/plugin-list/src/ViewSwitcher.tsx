/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Popover, PopoverContent, PopoverTrigger } from '@object-ui/components';
import {
  Grid,
  LayoutGrid,
  Calendar,
  Images,    // gallery
  Activity,  // timeline
  GanttChartSquare, // gantt
  Map,        // map
  BarChart3,  // chart
  Check,
  ChevronDown,
} from 'lucide-react';

export type ViewType =
  | 'grid'
  | 'kanban'
  | 'gallery'
  | 'calendar'
  | 'timeline'
  | 'gantt'
  | 'map'
  | 'chart';

export interface ViewSwitcherProps {
  currentView: ViewType;
  availableViews?: ViewType[];
  onViewChange: (view: ViewType) => void;
  className?: string;
  /** Enable animated transitions between views (default: true) */
  animated?: boolean;
}

const VIEW_ICONS: Record<ViewType, React.ReactNode> = {
  grid: <Grid className="h-4 w-4" />,
  kanban: <LayoutGrid className="h-4 w-4" />,
  gallery: <Images className="h-4 w-4" />,
  calendar: <Calendar className="h-4 w-4" />,
  timeline: <Activity className="h-4 w-4" />,
  gantt: <GanttChartSquare className="h-4 w-4" />,
  map: <Map className="h-4 w-4" />,
  chart: <BarChart3 className="h-4 w-4" />,
};

const VIEW_LABELS: Record<ViewType, string> = {
  grid: 'Grid',
  kanban: 'Kanban',
  gallery: 'Gallery',
  calendar: 'Calendar',
  timeline: 'Timeline',
  gantt: 'Gantt',
  map: 'Map',
  chart: 'Chart',
};

/**
 * Compact dropdown form of the visualization switcher (Airtable-style):
 * a single "List ▾" button in the toolbar's right cluster that opens a
 * menu of the available visualizations. Replaces the full button row so
 * the toolbar stays one line tall.
 */
export const ViewSwitcherDropdown: React.FC<ViewSwitcherProps> = ({
  currentView,
  availableViews = ['grid', 'kanban'],
  onViewChange,
  className,
  animated = true,
}) => {
  const [open, setOpen] = React.useState(false);

  const handleViewChange = React.useCallback(
    (view: ViewType) => {
      setOpen(false);
      if (view === currentView) return;
      if (animated && typeof document !== 'undefined' && 'startViewTransition' in document) {
        (document as Document & {
          startViewTransition: (cb: () => void) => { finished: Promise<void> };
        }).startViewTransition(() => onViewChange(view));
      } else {
        onViewChange(view);
      }
    },
    [animated, currentView, onViewChange],
  );

  // Few visualizations (2–4): render an iOS/Linear-style segmented control
  // inline — a unified rounded track where the active segment lifts onto a
  // white thumb. Clearer and more tactile than a dropdown for a short set.
  // Many (5+) fall through to the compact dropdown below to keep the toolbar
  // one line.
  if (availableViews.length >= 2 && availableViews.length <= 4) {
    return (
      <div
        role="tablist"
        data-testid="view-switcher-segmented"
        className={cn(
          'inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5 oui-view-switcher',
          className,
        )}
      >
        {availableViews.map((view) => {
          const active = view === currentView;
          return (
            <button
              key={view}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={VIEW_LABELS[view]}
              title={VIEW_LABELS[view]}
              data-state={active ? 'on' : 'off'}
              onClick={() => handleViewChange(view)}
              className={cn(
                'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[7px] text-xs font-medium transition-all duration-150',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {VIEW_ICONS[view]}
              <span className="hidden sm:inline-block">{VIEW_LABELS[view]}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="view-switcher-dropdown"
          aria-label={VIEW_LABELS[currentView]}
          className={cn(
            'inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium transition-colors oui-view-switcher',
            open ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground',
            className,
          )}
        >
          {VIEW_ICONS[currentView]}
          <span className="hidden sm:inline-block">{VIEW_LABELS[currentView]}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        {availableViews.map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => handleViewChange(view)}
            data-state={view === currentView ? 'on' : 'off'}
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-muted',
              view === currentView ? 'text-foreground font-medium' : 'text-muted-foreground',
            )}
          >
            {VIEW_ICONS[view]}
            <span className="flex-1 text-left">{VIEW_LABELS[view]}</span>
            {view === currentView && <Check className="h-3.5 w-3.5" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  currentView,
  availableViews = ['grid', 'kanban'],
  onViewChange,
  className,
  animated = true,
}) => {
  const handleViewChange = React.useCallback(
    (view: ViewType) => {
      if (!animated || view === currentView) {
        onViewChange(view);
        return;
      }

      if (typeof document !== 'undefined' && 'startViewTransition' in document) {
        (document as Document & {
          startViewTransition: (cb: () => void) => { finished: Promise<void> };
        }).startViewTransition(() => onViewChange(view));
      } else {
        onViewChange(view);
      }
    },
    [animated, currentView, onViewChange],
  );

  return (
    <div className={cn("flex items-center gap-1 bg-transparent oui-view-switcher", className)}>
      {availableViews.map((view) => {
        const isActive = currentView === view;
        return (
          <button
            key={view}
            type="button"
            onClick={() => handleViewChange(view)}
            aria-label={VIEW_LABELS[view]}
            title={VIEW_LABELS[view]}
            aria-pressed={isActive}
            data-state={isActive ? 'on' : 'off'}
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
              "hover:bg-muted hover:text-muted-foreground",
              "gap-2 px-3 py-2",
              "data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm border-transparent border data-[state=on]:border-border/50",
            )}
          >
            {VIEW_ICONS[view]}
            <span className="hidden sm:inline-block text-xs font-medium">
              {VIEW_LABELS[view]}
            </span>
          </button>
        );
      })}
    </div>
  );
};

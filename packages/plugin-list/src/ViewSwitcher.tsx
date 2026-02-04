/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn } from '@object-ui/components';
import { 
  Grid, 
  LayoutGrid, 
  Calendar, 
  Images,    // gallery
  Activity,  // timeline
  GanttChartSquare, // gantt
  Map,        // map
} from 'lucide-react';

export type ViewType = 
  | 'grid' 
  | 'kanban' 
  | 'gallery' 
  | 'calendar' 
  | 'timeline'
  | 'gantt'
  | 'map';

export interface ViewSwitcherProps {
  currentView: ViewType;
  availableViews?: ViewType[];
  onViewChange: (view: ViewType) => void;
  className?: string;
}

const VIEW_ICONS: Record<ViewType, React.ReactNode> = {
  grid: <Grid className="h-4 w-4" />,
  kanban: <LayoutGrid className="h-4 w-4" />,
  gallery: <Images className="h-4 w-4" />,
  calendar: <Calendar className="h-4 w-4" />,
  timeline: <Activity className="h-4 w-4" />,
  gantt: <GanttChartSquare className="h-4 w-4" />,
  map: <Map className="h-4 w-4" />,
};

const VIEW_LABELS: Record<ViewType, string> = {
  grid: 'Grid',
  kanban: 'Kanban',
  gallery: 'Gallery',
  calendar: 'Calendar',
  timeline: 'Timeline',
  gantt: 'Gantt',
  map: 'Map',
};

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  currentView,
  availableViews = ['grid', 'kanban'],
  onViewChange,
  className,
}) => {
  return (
    <div className={cn("flex items-center gap-1 bg-transparent", className)}>
      {availableViews.map((view) => {
        const isActive = currentView === view;
        return (
          <button
            key={view}
            type="button"
            onClick={() => onViewChange(view)}
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

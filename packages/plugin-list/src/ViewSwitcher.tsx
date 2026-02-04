/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, ToggleGroup, ToggleGroupItem } from '@object-ui/components';
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
    <ToggleGroup 
      type="single" 
      value={currentView} 
      onValueChange={(value) => value && onViewChange(value as ViewType)}
      className={cn("inline-flex", className)}
    >
      {availableViews.map((view) => (
        <ToggleGroupItem
          key={view}
          value={view}
          aria-label={VIEW_LABELS[view]}
          title={VIEW_LABELS[view]}
          className="px-3"
        >
          {VIEW_ICONS[view]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
};

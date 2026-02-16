/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Card, CardHeader, CardTitle, CardContent } from '@object-ui/components';
import { Activity, Edit, PlusCircle, Trash2, MessageSquare, ArrowRightLeft } from 'lucide-react';
import type { ActivityEntry } from '@object-ui/types';

export interface ActivityTimelineProps {
  activities: ActivityEntry[];
  className?: string;
}

const ACTIVITY_ICONS: Record<ActivityEntry['type'], React.ElementType> = {
  field_change: Edit,
  create: PlusCircle,
  delete: Trash2,
  comment: MessageSquare,
  status_change: ArrowRightLeft,
};

const ACTIVITY_COLORS: Record<ActivityEntry['type'], string> = {
  field_change: 'bg-blue-100 text-blue-600',
  create: 'bg-green-100 text-green-600',
  delete: 'bg-red-100 text-red-600',
  comment: 'bg-purple-100 text-purple-600',
  status_change: 'bg-amber-100 text-amber-600',
};

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return timestamp;
  }
}

function formatFieldChange(entry: ActivityEntry): string {
  if (entry.description) return entry.description;

  if (entry.type === 'field_change' && entry.field) {
    const fieldLabel = entry.field.charAt(0).toUpperCase() + entry.field.slice(1).replace(/_/g, ' ');
    const oldVal = entry.oldValue != null ? String(entry.oldValue) : '(empty)';
    const newVal = entry.newValue != null ? String(entry.newValue) : '(empty)';
    return `Changed ${fieldLabel} from "${oldVal}" to "${newVal}"`;
  }

  if (entry.type === 'create') return 'Created this record';
  if (entry.type === 'delete') return 'Deleted this record';
  if (entry.type === 'status_change' && entry.field) {
    const newVal = entry.newValue != null ? String(entry.newValue) : '(empty)';
    return `Changed status to "${newVal}"`;
  }

  return 'Updated record';
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  activities,
  className,
}) => {
  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Activity
          <span className="text-sm font-normal text-muted-foreground">
            ({activities.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No activity recorded
          </p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

            <div className="space-y-4">
              {activities.map((entry) => {
                const Icon = ACTIVITY_ICONS[entry.type] || Edit;
                const colorClass = ACTIVITY_COLORS[entry.type] || 'bg-gray-100 text-gray-600';

                return (
                  <div key={entry.id} className="flex gap-3 relative">
                    {/* Icon */}
                    <div
                      className={cn(
                        'shrink-0 h-8 w-8 rounded-full flex items-center justify-center z-10',
                        colorClass,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm">
                        <span className="font-medium">{entry.user}</span>
                        {' '}
                        <span className="text-muted-foreground">
                          {formatFieldChange(entry)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatTimestamp(entry.timestamp)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

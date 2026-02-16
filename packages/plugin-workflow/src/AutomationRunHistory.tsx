/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@object-ui/components';
import { Clock } from 'lucide-react';

export interface AutomationRun {
  id: string;
  automationId: string;
  automationName: string;
  status: 'success' | 'failure' | 'running' | 'pending';
  startedAt: string;
  completedAt?: string;
  triggerEvent?: string;
  error?: string;
}

export interface AutomationRunHistoryProps {
  runs?: AutomationRun[];
  className?: string;
}

const STATUS_VARIANT: Record<AutomationRun['status'], 'default' | 'destructive' | 'secondary' | 'outline'> = {
  success: 'default',
  failure: 'destructive',
  running: 'secondary',
  pending: 'outline',
};

const STATUS_LABEL: Record<AutomationRun['status'], string> = {
  success: 'Success',
  failure: 'Failed',
  running: 'Running',
  pending: 'Pending',
};

function formatDuration(start: string, end?: string): string {
  if (!end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

/**
 * AutomationRunHistory - Displays a list of past automation executions
 * Shows status, automation name, trigger event, timing, and errors.
 */
export const AutomationRunHistory: React.FC<AutomationRunHistoryProps> = ({
  runs = [],
  className,
}) => {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          Automation Run History
          <Badge variant="outline" className="ml-auto">{runs.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No automation runs yet
          </p>
        ) : (
          <div className="space-y-2">
            {runs.map(run => (
              <div key={run.id} className="flex items-start gap-3 rounded-lg border p-3">
                <Badge variant={STATUS_VARIANT[run.status]}>{STATUS_LABEL[run.status]}</Badge>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{run.automationName}</span>
                    {run.triggerEvent && (
                      <span className="text-xs text-muted-foreground">— {run.triggerEvent}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{new Date(run.startedAt).toLocaleString()}</span>
                    <span>Duration: {formatDuration(run.startedAt, run.completedAt)}</span>
                  </div>
                  {run.status === 'failure' && run.error && (
                    <p className="text-xs text-red-600 mt-1">{run.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

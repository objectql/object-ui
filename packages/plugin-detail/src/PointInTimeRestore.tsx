/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {
  cn,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@object-ui/components';
import { History, RotateCcw, Eye, ChevronRight } from 'lucide-react';

export interface RevisionEntry {
  id: string;
  timestamp: string;
  user: string;
  changes: { field: string; oldValue: any; newValue: any }[];
  /** Full record snapshot at this revision point. */
  snapshot?: Record<string, any>;
}

export interface PointInTimeRestoreProps {
  recordId: string;
  revisions: RevisionEntry[];
  onRestore?: (revisionId: string, snapshot: Record<string, any>) => void | Promise<void>;
  className?: string;
}

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
    return date.toLocaleString();
  } catch {
    return timestamp;
  }
}

export const PointInTimeRestore: React.FC<PointInTimeRestoreProps> = ({
  recordId: _recordId,
  revisions,
  onRestore,
  className,
}) => {
  const [selectedRevisionId, setSelectedRevisionId] = React.useState<string | null>(null);
  const [isConfirming, setIsConfirming] = React.useState(false);
  const [isRestoring, setIsRestoring] = React.useState(false);

  const selectedRevision = React.useMemo(
    () => revisions.find((r) => r.id === selectedRevisionId) ?? null,
    [revisions, selectedRevisionId],
  );

  const handleRestore = React.useCallback(async () => {
    if (!selectedRevision || !onRestore) return;

    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    setIsRestoring(true);
    try {
      const snapshot = selectedRevision.snapshot ?? {};
      await onRestore(selectedRevision.id, snapshot);
      setIsConfirming(false);
      setSelectedRevisionId(null);
    } finally {
      setIsRestoring(false);
    }
  }, [selectedRevision, onRestore, isConfirming]);

  const handleCancelConfirm = React.useCallback(() => {
    setIsConfirming(false);
  }, []);

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Revision History
          <span className="text-sm font-normal text-muted-foreground">
            ({revisions.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {revisions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No revisions recorded
          </p>
        ) : (
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Timeline */}
            <div className="flex-1 min-w-0">
              <div className="relative">
                <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
                <div className="space-y-1">
                  {revisions.map((revision) => {
                    const isSelected = revision.id === selectedRevisionId;
                    return (
                      <button
                        key={revision.id}
                        type="button"
                        className={cn(
                          'w-full text-left flex items-start gap-3 py-2 px-2 rounded-md transition-colors relative',
                          isSelected
                            ? 'bg-accent'
                            : 'hover:bg-accent/50',
                        )}
                        onClick={() => {
                          setSelectedRevisionId(revision.id);
                          setIsConfirming(false);
                        }}
                      >
                        {/* Timeline dot */}
                        <div
                          className={cn(
                            'shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center z-10 mt-0.5',
                            isSelected
                              ? 'border-primary bg-primary'
                              : 'border-border bg-background',
                          )}
                        >
                          {isSelected && (
                            <ChevronRight className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{revision.user}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatTimestamp(revision.timestamp)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {revision.changes.length} field{revision.changes.length !== 1 ? 's' : ''}{' '}
                            changed
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Preview panel */}
            {selectedRevision && (
              <div className="lg:w-80 border rounded-md p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  Revision Preview
                </div>

                {/* Field changes */}
                <div className="space-y-2">
                  {selectedRevision.changes.map((change, i) => (
                    <div key={i} className="text-xs">
                      <span className="font-medium text-muted-foreground">
                        {change.field}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="line-through text-red-600 dark:text-red-400 truncate max-w-[120px]">
                          {change.oldValue != null ? String(change.oldValue) : '(empty)'}
                        </span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-green-600 dark:text-green-400 truncate max-w-[120px]">
                          {change.newValue != null ? String(change.newValue) : '(empty)'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Snapshot values */}
                {selectedRevision.snapshot && (
                  <div className="border-t pt-2 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Record state at this point
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {Object.entries(selectedRevision.snapshot).map(([key, val]) => (
                        <div key={key} className="flex justify-between text-xs gap-2">
                          <span className="text-muted-foreground truncate">{key}</span>
                          <span className="font-mono truncate max-w-[140px]">
                            {val != null ? String(val) : '–'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Restore button */}
                {onRestore && (
                  <div className="pt-1 space-y-2">
                    {isConfirming ? (
                      <>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          This will restore the record to its state at{' '}
                          {formatTimestamp(selectedRevision.timestamp)}. Continue?
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="gap-1.5 flex-1"
                            onClick={handleRestore}
                            disabled={isRestoring}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            {isRestoring ? 'Restoring…' : 'Confirm Restore'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelConfirm}
                            disabled={isRestoring}
                          >
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5"
                        onClick={handleRestore}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore to this point
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

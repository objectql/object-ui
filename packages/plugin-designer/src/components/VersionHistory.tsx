/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { History, User, Clock } from 'lucide-react';

function cn(...inputs: (string | undefined | false)[]) {
  return twMerge(clsx(inputs));
}

export interface VersionEntry {
  /** Version number */
  version: number;
  /** Timestamp */
  timestamp: string;
  /** User who made the change */
  userId: string;
  /** User display name */
  userName: string;
  /** Description of changes */
  description: string;
  /** Whether this is the current version */
  isCurrent?: boolean;
}

export interface VersionHistoryProps {
  /** Version entries */
  versions: VersionEntry[];
  /** Called when user wants to restore a version */
  onRestore?: (version: number) => void;
  /** CSS class */
  className?: string;
}

/**
 * Version history browser with visual diff support.
 * Shows a timeline of changes with the ability to restore previous versions.
 */
export function VersionHistory({
  versions,
  onRestore,
  className,
}: VersionHistoryProps) {
  return (
    <div className={cn('flex flex-col', className)} role="region" aria-label="Version history">
      <div className="p-3 border-b font-medium text-sm flex items-center gap-2">
        <History className="h-4 w-4" />
        Version History
      </div>
      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground text-center">
            No version history available
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
            {versions.map((entry) => (
              <div
                key={entry.version}
                className={cn(
                  'relative flex items-start gap-3 px-3 py-2 hover:bg-accent/50',
                  entry.isCurrent && 'bg-accent/30',
                )}
              >
                {/* Timeline dot */}
                <div className={cn(
                  'relative z-10 mt-1 h-2.5 w-2.5 rounded-full border-2 bg-background',
                  entry.isCurrent ? 'border-primary' : 'border-muted-foreground',
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium">v{entry.version}</span>
                    {entry.isCurrent && (
                      <span className="px-1 py-0.5 rounded bg-primary/10 text-primary text-[0.6rem]">Current</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.description}</p>
                  <div className="flex items-center gap-2 mt-1 text-[0.65rem] text-muted-foreground/70">
                    <User className="h-2.5 w-2.5" />
                    <span>{entry.userName}</span>
                    <Clock className="h-2.5 w-2.5 ml-1" />
                    <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                  {!entry.isCurrent && onRestore && (
                    <button type="button"
                      onClick={() => onRestore(entry.version)}
                      className="mt-1 text-[0.65rem] text-primary hover:underline"
                    >
                      Restore this version
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

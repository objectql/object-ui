/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Button } from '@object-ui/components';
import { formatActionLabel } from './RowActionMenu';

export interface BulkActionBarProps {
  /** Array of selected row records */
  selectedRows: any[];
  /** Bulk/batch action identifiers */
  actions: string[];
  /** Callback when a bulk action button is clicked */
  onAction?: (action: string, selectedRows: any[]) => void;
  /** Callback to clear selection */
  onClearSelection?: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedRows,
  actions,
  onAction,
  onClearSelection,
}) => {
  if (!actions || actions.length === 0 || selectedRows.length === 0) {
    return null;
  }

  return (
    <div
      className="border-t px-4 py-1.5 flex items-center gap-2 text-xs bg-primary/5 shrink-0"
      data-testid="bulk-actions-bar"
    >
      <span className="text-muted-foreground font-medium">
        {selectedRows.length} selected
      </span>
      <div className="flex items-center gap-1 ml-2">
        {actions.map(action => (
          <Button
            key={action}
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onAction?.(action, selectedRows)}
            data-testid={`bulk-action-${action}`}
          >
            {formatActionLabel(action)}
          </Button>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs ml-auto"
        onClick={onClearSelection}
      >
        Clear
      </Button>
    </div>
  );
};

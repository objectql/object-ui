/**
 * MetadataGrid
 *
 * Reusable table/grid component for displaying metadata items in a
 * professional tabular layout with column headers and optional action buttons.
 * Used by MetadataManagerPage when `listMode` is `'grid'` or `'table'`.
 *
 * @module components/MetadataGrid
 */

import { Button } from '@object-ui/components';
import { Pencil, Trash2 } from 'lucide-react';
import type { MetadataColumnDef, MetadataActionDef } from '../config/metadataTypeRegistry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetadataGridProps {
  /** Items to display in the grid. */
  items: Record<string, unknown>[];
  /** Column definitions for the table headers. */
  columns: MetadataColumnDef[];
  /** Whether the grid shows action buttons (edit, delete, custom). */
  editable?: boolean;
  /** Whether a save operation is in progress (disables action buttons). */
  saving?: boolean;
  /** Name of the item currently in the delete-confirm state. */
  deletingName?: string | null;
  /** Singular type label for tooltip text (e.g. 'report'). */
  typeLabel?: string;
  /** Custom row-level actions from the registry. */
  rowActions?: MetadataActionDef[];
  /** Called when an item row is clicked. */
  onItemClick?: (name: string) => void;
  /** Called when the edit button is clicked for an item. */
  onEdit?: (item: Record<string, unknown>) => void;
  /** Called when the delete button is clicked for an item. */
  onDelete?: (name: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MetadataGrid({
  items,
  columns,
  editable = false,
  saving = false,
  deletingName = null,
  typeLabel = 'item',
  rowActions = [],
  onItemClick,
  onEdit,
  onDelete,
}: MetadataGridProps) {
  return (
    <div className="rounded-lg border bg-card" data-testid="metadata-grid">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label={`${typeLabel} list`}>
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left font-medium text-muted-foreground"
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                </th>
              ))}
              {editable && (
                <th className="px-4 py-3 text-right font-medium text-muted-foreground w-24">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const name = String(item.name ?? '');
              return (
                <tr
                  key={name}
                  className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors"
                  data-testid={`metadata-item-${name}`}
                  onClick={() => onItemClick?.(name)}
                >
                  {columns.map((col) => {
                    const cellValue = String(item[col.key] ?? '—');
                    return (
                      <td key={col.key} className="px-4 py-3 truncate max-w-[200px]" title={cellValue}>
                        {cellValue}
                      </td>
                    );
                  })}
                  {editable && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {rowActions.map((action) => (
                          <Button
                            key={action.key}
                            variant={action.variant ?? 'ghost'}
                            size="icon"
                            title={action.label}
                            aria-label={action.label}
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              action.handler?.(item);
                            }}
                            data-testid={`row-action-${action.key}-${name}`}
                          >
                            <span className="text-xs">{action.label.charAt(0)}</span>
                          </Button>
                        ))}
                        <Button
                          variant="ghost"
                          size="icon"
                          title={`Edit ${typeLabel}`}
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            onEdit?.(item);
                          }}
                          disabled={saving}
                          data-testid={`edit-${name}-btn`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={deletingName === name ? 'Click again to confirm' : `Delete ${typeLabel}`}
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            onDelete?.(name);
                          }}
                          disabled={saving}
                          data-testid={`delete-${name}-btn`}
                        >
                          <Trash2 className={`h-4 w-4 ${deletingName === name ? 'text-destructive' : ''}`} />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

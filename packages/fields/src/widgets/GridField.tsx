import React from 'react';
import { FieldWidgetProps } from './types';
import { cn } from '@object-ui/components';

/**
 * GridField - Sub-table/grid data display
 * Shows tabular data in a simplified format
 * For full editing capabilities, use the grid plugin
 */
export function GridField({ value, field, readonly, ...props }: FieldWidgetProps<any[]>) {
  const gridField = (field || (props as any).schema) as any;
  const columns = gridField?.columns || [];

  if (!value || !Array.isArray(value)) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  if (readonly) {
    return (
      <div className={cn("text-sm", props.className)}>
        <span className="text-foreground">{value.length} rows</span>
      </div>
    );
  }

  // Simple read-only table view
  return (
    <div className={cn("border border-border rounded-lg overflow-hidden", props.className)}>
      <div className="overflow-auto max-h-60">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b border-border">
            <tr>
              {columns.map((col: any, idx: number) => (
                <th
                  key={idx}
                  className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                >
                  {col.label || col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {value.slice(0, 5).map((row: any, rowIdx: number) => (
              <tr key={rowIdx} className="hover:bg-muted/50 transition-colors">
                {columns.map((col: any, colIdx: number) => (
                  <td key={colIdx} className="px-3 py-2 text-foreground">
                    {row[col.name] != null ? String(row[col.name]) : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {value.length > 5 && (
        <div className="bg-muted px-3 py-2 text-xs text-muted-foreground border-t border-border">
          Showing 5 of {value.length} rows
        </div>
      )}
    </div>
  );
}

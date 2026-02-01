import React from 'react';
import { FieldWidgetProps } from './types';

/**
 * GridField - Sub-table/grid data display
 * Shows tabular data in a simplified format
 * For full editing capabilities, use the grid plugin
 */
export function GridField({ value, field, readonly, ...props }: FieldWidgetProps<any[]>) {
  const gridField = (field || (props as any).schema) as any;
  const columns = gridField?.columns || [];

  if (!value || !Array.isArray(value)) {
    return <span className="text-sm text-gray-500">-</span>;
  }

  if (readonly) {
    return (
      <div className={`text-sm ${props.className || ''}`}>
        <span className="text-gray-700">{value.length} rows</span>
      </div>
    );
  }

  // Simple read-only table view
  return (
    <div className={`border border-gray-200 rounded-md overflow-hidden ${props.className || ''}`}>
      <div className="overflow-auto max-h-60">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((col: any, idx: number) => (
                <th
                  key={idx}
                  className="px-3 py-2 text-left text-xs font-medium text-gray-700"
                >
                  {col.label || col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {value.slice(0, 5).map((row: any, rowIdx: number) => (
              <tr key={rowIdx} className="hover:bg-gray-50">
                {columns.map((col: any, colIdx: number) => (
                  <td key={colIdx} className="px-3 py-2 text-gray-900">
                    {row[col.name] != null ? String(row[col.name]) : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {value.length > 5 && (
        <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 border-t border-gray-200">
          Showing 5 of {value.length} rows
        </div>
      )}
    </div>
  );
}

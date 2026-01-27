/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { useDataScope } from '@object-ui/react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../../ui/table';
import { cn } from '../../lib/utils';

export const SimpleTableRenderer = ({ schema, className, ..._props }: any) => {
  const data = useDataScope(schema.bind);
  const columns = schema.props?.columns || [];

  // If we have data but it's not an array, show error. 
  // If data is undefined, we might just be loading or empty.
  if (data && !Array.isArray(data)) {
    return <div className="text-red-500 p-2 border border-red-200 bg-red-50 rounded text-sm">Table data must be an array</div>;
  }
  
  const displayData = Array.isArray(data) ? data : [];

  return (
    <div className={cn("rounded-md border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col: any) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          ) : (
            displayData.map((row: any, i: number) => (
              <TableRow key={row.id || i}>
                {columns.map((col: any) => (
                  <TableCell key={col.key}>
                    {row[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

ComponentRegistry.register('table', SimpleTableRenderer);

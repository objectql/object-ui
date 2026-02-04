/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { Suspense } from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { Skeleton } from '@object-ui/components';
import { ObjectKanban } from './ObjectKanban';

// Export types for external use
export type { KanbanSchema, KanbanCard, KanbanColumn } from './types';
export { ObjectKanban };
export type { ObjectKanbanProps } from './ObjectKanban';

// 🚀 Lazy load the implementation files
const LazyKanban = React.lazy(() => import('./KanbanImpl'));
const LazyKanbanEnhanced = React.lazy(() => import('./KanbanEnhanced'));

export interface KanbanRendererProps {
  schema: {
    type: string;
    id?: string;
    className?: string;
    columns?: Array<any>;
    data?: Array<any>;
    groupBy?: string;
    onCardMove?: (cardId: string, fromColumnId: string, toColumnId: string, newIndex: number) => void;
  };
}

/**
 * KanbanRenderer - The public API for the kanban board component
 * This wrapper handles lazy loading internally using React.Suspense
 */
export const KanbanRenderer: React.FC<KanbanRendererProps> = ({ schema }) => {
  // ⚡️ Adapter: Map flat 'data' + 'groupBy' to nested 'cards' structure
  const processedColumns = React.useMemo(() => {
    const { columns = [], data, groupBy } = schema;
    
    // If we have flat data and a grouping key, distribute items into columns
    if (data && groupBy && Array.isArray(data)) {
      // 1. Group data by key
      const groups = data.reduce((acc, item) => {
        const key = item[groupBy];
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {} as Record<string, any[]>);

      // 2. Inject into columns
      return columns.map((col: any) => ({
        ...col,
        cards: [
           ...(col.cards || []),     // Preserve static cards
           ...(groups[col.id] || []) // Add dynamic cards
        ]
      }));
    }
    
    // Default: Return columns as-is (assuming they have 'cards' inside)
    return columns;
  }, [schema]);

  return (
    <Suspense fallback={<Skeleton className="w-full h-[600px]" />}>
      <LazyKanban
        columns={processedColumns}
        onCardMove={schema.onCardMove}
        className={schema.className}
      />
    </Suspense>
  );
};

// Register the component with the ComponentRegistry
ComponentRegistry.register(
  'kanban',
  KanbanRenderer,
  {
    namespace: 'plugin-kanban',
    label: 'Kanban Board',
    icon: 'LayoutDashboard',
    category: 'plugin',
    inputs: [
      { 
        name: 'columns', 
        type: 'array', 
        label: 'Columns',
        description: 'Array of { id, title, cards, limit, className }',
        required: true
      },
      { 
        name: 'onCardMove', 
        type: 'code',
        label: 'On Card Move',
        description: 'Callback when a card is moved',
        advanced: true
      },
      { 
        name: 'className', 
        type: 'string', 
        label: 'CSS Class' 
      }
    ],
    defaultProps: {
      columns: [
        {
          id: 'todo',
          title: 'To Do',
          cards: [
            {
              id: 'card-1',
              title: 'Task 1',
              description: 'This is the first task',
              badges: [
                { label: 'High Priority', variant: 'destructive' },
                { label: 'Feature', variant: 'default' }
              ]
            },
            {
              id: 'card-2',
              title: 'Task 2',
              description: 'This is the second task',
              badges: [
                { label: 'Bug', variant: 'destructive' }
              ]
            }
          ]
        },
        {
          id: 'in-progress',
          title: 'In Progress',
          limit: 3,
          cards: [
            {
              id: 'card-3',
              title: 'Task 3',
              description: 'Currently working on this',
              badges: [
                { label: 'In Progress', variant: 'default' }
              ]
            }
          ]
        },
        {
          id: 'done',
          title: 'Done',
          cards: [
            {
              id: 'card-4',
              title: 'Task 4',
              description: 'This task is completed',
              badges: [
                { label: 'Completed', variant: 'outline' }
              ]
            },
            {
              id: 'card-5',
              title: 'Task 5',
              description: 'Another completed task',
              badges: [
                { label: 'Completed', variant: 'outline' }
              ]
            }
          ]
        }
      ],
      className: 'w-full'
    }
  }
);

// Standard Export Protocol - for manual integration
export const kanbanComponents = {
  'kanban': KanbanRenderer,
  'kanban-enhanced': LazyKanbanEnhanced,
  'object-kanban': ObjectKanban,
};

// Register enhanced Kanban
ComponentRegistry.register(
  'kanban-enhanced',
  ({ schema }: { schema: any }) => {
    const processedColumns = React.useMemo(() => {
      const { columns = [], data, groupBy } = schema;
      if (data && groupBy && Array.isArray(data)) {
        const groups = data.reduce((acc, item) => {
          const key = item[groupBy];
          if (!acc[key]) acc[key] = [];
          acc[key].push(item);
          return acc;
        }, {} as Record<string, any[]>);
        return columns.map((col: any) => ({
          ...col,
          cards: [...(col.cards || []), ...(groups[col.id] || [])]
        }));
      }
      return columns;
    }, [schema]);

    return (
      <Suspense fallback={<Skeleton className="w-full h-[600px]" />}>
        <LazyKanbanEnhanced
          columns={processedColumns}
          onCardMove={schema.onCardMove}
          onColumnToggle={schema.onColumnToggle}
          enableVirtualScrolling={schema.enableVirtualScrolling}
          virtualScrollThreshold={schema.virtualScrollThreshold}
          className={schema.className}
        />
      </Suspense>
    );
  },
  {
    namespace: 'plugin-kanban',
    label: 'Kanban Board (Enhanced)',
    icon: 'LayoutGrid',
    category: 'plugin',
    inputs: [
      { name: 'columns', type: 'array', label: 'Columns', required: true },
      { name: 'enableVirtualScrolling', type: 'boolean', label: 'Virtual Scrolling', defaultValue: false },
      { name: 'virtualScrollThreshold', type: 'number', label: 'Virtual Scroll Threshold', defaultValue: 50 },
      { name: 'onCardMove', type: 'code', label: 'On Card Move', advanced: true },
      { name: 'onColumnToggle', type: 'code', label: 'On Column Toggle', advanced: true },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      columns: [],
      enableVirtualScrolling: false,
      virtualScrollThreshold: 50,
      className: 'w-full'
    }
  }
);

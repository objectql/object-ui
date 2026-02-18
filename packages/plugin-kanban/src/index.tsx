/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { Suspense } from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { useSchemaContext } from '@object-ui/react';
import { Skeleton } from '@object-ui/components';
import { ObjectKanban } from './ObjectKanban';

// Export types for external use
export type { KanbanSchema, KanbanCard, KanbanColumn, CardTemplate, ColumnWidthConfig, InlineFieldDefinition } from './types';
export { ObjectKanban };
export type { ObjectKanbanProps } from './ObjectKanban';

// Phase 13 L2/L3: New components and hooks
export { InlineQuickAdd } from './InlineQuickAdd';
export type { InlineQuickAddProps } from './InlineQuickAdd';
export { CardTemplates } from './CardTemplates';
export type { CardTemplatesProps } from './CardTemplates';
export { useColumnWidths } from './useColumnWidths';
export type { UseColumnWidthsOptions, UseColumnWidthsReturn } from './useColumnWidths';
export { useCrossSwimlaneMove } from './useCrossSwimlaneMove';
export type { Swimlane, CrossSwimlaneMoveEvent, UseCrossSwimlaneOptions, UseCrossSwimlaneMoveReturn } from './useCrossSwimlaneMove';
export { useQuickAddReorder } from './useQuickAddReorder';
export type { UseQuickAddReorderOptions, UseQuickAddReorderReturn } from './useQuickAddReorder';

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
    swimlaneField?: string;
    onCardMove?: (cardId: string, fromColumnId: string, toColumnId: string, newIndex: number) => void;
    onCardClick?: (card: any) => void;
    quickAdd?: boolean;
    onQuickAdd?: (columnId: string, title: string) => void;
    coverImageField?: string;
    conditionalFormatting?: Array<{
      field: string;
      operator: 'equals' | 'not_equals' | 'contains' | 'in';
      value: string | string[];
      backgroundColor?: string;
      borderColor?: string;
    }>;
  };
}

/**
 * KanbanRenderer - The public API for the kanban board component
 * This wrapper handles lazy loading internally using React.Suspense
 */
export const KanbanRenderer: React.FC<KanbanRendererProps> = ({ schema }) => {
  // ⚡️ Adapter: Map flat 'data' + 'groupBy' to nested 'cards' structure
  const processedColumns = React.useMemo(() => {
    const { columns = [], data, groupBy, coverImageField } = schema;
    
    // Helper to map cover image field onto cards
    const mapCoverImage = (item: any) => {
      if (!coverImageField) return item;
      const imgValue = item[coverImageField];
      if (!imgValue) return item;
      const coverImage = typeof imgValue === 'string' ? imgValue : imgValue?.url;
      return coverImage ? { ...item, coverImage } : item;
    };
    
    // If we have flat data and a grouping key, distribute items into columns
    if (data && groupBy && Array.isArray(data)) {
      // Build label→id mapping so data values (labels like "In Progress")
      // match column IDs (option values like "in_progress")
      const labelToColumnId: Record<string, string> = {};
      columns.forEach((col: any) => {
        if (col.id) labelToColumnId[String(col.id).toLowerCase()] = col.id;
        if (col.title) labelToColumnId[String(col.title).toLowerCase()] = col.id;
      });

      // 1. Group data by key, normalizing via label→id mapping
      const groups = data.reduce((acc, item) => {
        const rawKey = String(item[groupBy] ?? '');
        const key = labelToColumnId[rawKey.toLowerCase()] ?? rawKey;
        if (!acc[key]) acc[key] = [];
        acc[key].push(mapCoverImage(item));
        return acc;
      }, {} as Record<string, any[]>);

      // 2. Inject into columns
      return columns.map((col: any) => ({
        ...col,
        cards: [
           ...(col.cards || []).map(mapCoverImage),     // Preserve static cards
           ...(groups[col.id] || []) // Add dynamic cards
        ]
      }));
    }
    
    // Default: Return columns as-is, mapping cover images
    return columns.map((col: any) => ({
      ...col,
      cards: (col.cards || []).map(mapCoverImage),
    }));
  }, [schema]);

  return (
    <Suspense fallback={<Skeleton className="w-full h-[600px]" />}>
      <LazyKanban
        columns={processedColumns}
        onCardMove={schema.onCardMove}
        onCardClick={schema.onCardClick}
        className={schema.className}
        quickAdd={schema.quickAdd}
        onQuickAdd={schema.onQuickAdd}
        coverImageField={schema.coverImageField}
        conditionalFormatting={schema.conditionalFormatting}
        swimlaneField={schema.swimlaneField}
      />
    </Suspense>
  );
};

// Register the component with the ComponentRegistry
ComponentRegistry.register(
  'kanban-ui',
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
          quickAdd={schema.quickAdd}
          onQuickAdd={schema.onQuickAdd}
          conditionalFormatting={schema.conditionalFormatting}
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

// Register object-kanban for ListView integration
export const ObjectKanbanRenderer: React.FC<{ schema: any; [key: string]: any }> = ({ schema, ...props }) => {
  const { dataSource } = useSchemaContext() || {};
  return <ObjectKanban schema={schema} dataSource={dataSource} {...props} />;
};

ComponentRegistry.register(
  'object-kanban',
  ObjectKanbanRenderer,
  {
    namespace: 'plugin-kanban',
    label: 'Object Kanban',
    category: 'view',
    inputs: [
      { name: 'objectName', type: 'string', label: 'Object Name', required: true },
      { name: 'columns', type: 'array', label: 'Columns' }
    ]
  }
);

ComponentRegistry.register(
  'kanban',
  ObjectKanbanRenderer,
  {
    namespace: 'view',
    label: 'Kanban Board',
    category: 'view',
    inputs: [
      { name: 'objectName', type: 'string', label: 'Object Name', required: true },
      { name: 'columns', type: 'array', label: 'Columns' }
    ]
  }
);

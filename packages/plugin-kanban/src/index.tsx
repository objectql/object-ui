/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { Suspense } from 'react';
import { ComponentRegistry } from '@object-ui/core';
import {
  ElementDataSourceGate,
  useSchemaContext,
  type ElementDataSourceMapping,
} from '@object-ui/react';
import { Skeleton } from '@object-ui/components';
import { createSafeTranslation } from '@object-ui/i18n';
import type { KanbanConditionalFormattingRule } from '@object-ui/types';
import { ObjectKanban } from './ObjectKanban';

/**
 * Sentinel column id for records whose `groupBy` value matches no declared
 * column (a status the board doesn't render, an edited/removed picklist
 * option, imported legacy data, or an empty value). Before #2792 these were
 * accumulated during bucketing and then silently dropped — the board looked
 * empty while the list footer still counted the rows. They now surface in a
 * trailing "Uncategorized" lane so no record is invisible and the visible
 * card total reconciles with the record count. Exported so the drag handler
 * can refuse to persist this non-option value as a real status.
 */
export const KANBAN_UNCOLUMNED_ID = '__uncolumned__';

const useUncolumnedT = createSafeTranslation(
  { 'kanban.uncategorized': 'Uncategorized' },
  'kanban.uncategorized',
);

/**
 * The single place flat `data` + `groupBy` is bucketed into per-column card
 * arrays. Kept pure (title passed in, not translated here) so it can be unit
 * tested directly — see index.bucket.test.ts. Records whose group value maps
 * to no declared column land in a trailing `KANBAN_UNCOLUMNED_ID` lane
 * instead of being dropped (#2792).
 */
export function bucketCardsIntoColumns(
  columns: Array<any>,
  data: Array<any> | undefined,
  groupBy: string | undefined,
  coverImageField: string | undefined,
  uncolumnedTitle: string,
): Array<any> {
  const mapCoverImage = (item: any) => {
    if (!coverImageField) return item;
    const imgValue = item[coverImageField];
    if (!imgValue) return item;
    const coverImage = typeof imgValue === 'string' ? imgValue : imgValue?.url;
    return coverImage ? { ...item, coverImage } : item;
  };

  // No flat data / grouping key: return columns as-is (cover-mapped).
  if (!data || !groupBy || !Array.isArray(data)) {
    return columns.map((col: any) => ({
      ...col,
      cards: (col.cards || []).map(mapCoverImage),
    }));
  }

  // Build label→id mapping so data values (labels like "In Progress") match
  // column IDs (option values like "in_progress").
  const labelToColumnId: Record<string, string> = {};
  columns.forEach((col: any) => {
    if (col.id) labelToColumnId[String(col.id).toLowerCase()] = col.id;
    if (col.title) labelToColumnId[String(col.title).toLowerCase()] = col.id;
  });

  // 1. Group data by key, normalizing via label→id mapping.
  const groups = data.reduce((acc, item) => {
    const rawKey = String(item[groupBy] ?? '');
    const key = labelToColumnId[rawKey.toLowerCase()] ?? rawKey;
    if (!acc[key]) acc[key] = [];
    acc[key].push(mapCoverImage(item));
    return acc;
  }, {} as Record<string, any[]>);

  // 2. Inject into declared columns.
  const mapped = columns.map((col: any) => ({
    ...col,
    cards: [
      ...(col.cards || []).map(mapCoverImage), // Preserve static cards
      ...(groups[col.id] || []),               // Add dynamic cards
    ],
  }));

  // 3. Catch records whose group key matched no column (#2792). Without this
  // they sit in `groups` and are dropped — `groups[col.id]` never reads a key
  // that isn't a column id — so the board silently loses rows the list footer
  // still counts. Surface them in a trailing "Uncategorized" lane; dragging
  // one out to a real column repairs its status (the drag handler refuses to
  // persist a move INTO here).
  const knownIds = new Set(columns.map((col: any) => col.id));
  const uncolumnedCards = Object.keys(groups)
    .filter((key) => !knownIds.has(key))
    .flatMap((key) => groups[key]);
  if (uncolumnedCards.length > 0) {
    mapped.push({ id: KANBAN_UNCOLUMNED_ID, title: uncolumnedTitle, cards: uncolumnedCards });
  }
  return mapped;
}

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
    conditionalFormatting?: KanbanConditionalFormattingRule[];
    /**
     * The object's field definitions, injected by `ObjectKanban` (the only
     * entry point that fetches an object schema). Card conditional formatting
     * needs them so a rule comparing a relation field sees the stored foreign
     * key rather than the record `$expand` substituted for it — the board
     * expands relations exactly as the grid does, so without this the SAME
     * rule on the SAME view worked on the grid and silently never matched on
     * the board (objectui#3501). Absent on the schema-only `kanban-ui` entry,
     * which has no object schema to offer; there the payload is used verbatim,
     * as before.
     */
    objectFields?: unknown;
  };
}

/**
 * KanbanRenderer - The public API for the kanban board component
 * This wrapper handles lazy loading internally using React.Suspense
 */
export const KanbanRenderer: React.FC<KanbanRendererProps> = ({ schema }) => {
  const { t } = useUncolumnedT();
  // ⚡️ Adapter: Map flat 'data' + 'groupBy' to nested 'cards' structure.
  const processedColumns = React.useMemo(
    () =>
      bucketCardsIntoColumns(
        schema.columns ?? [],
        schema.data,
        schema.groupBy,
        schema.coverImageField,
        t('kanban.uncategorized'),
      ),
    [schema, t],
  );

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
        objectFields={schema.objectFields}
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

/**
 * What `ObjectKanban` reads for its own query: `objectName` and `filter`
 * (`ObjectKanban.tsx`, the `dataSource.find` call — `$filter: schema.filter`).
 *
 * `columns` is deliberately NOT mapped. A board's `columns` are its SWIMLANES
 * (`{ id, title }` per `groupBy` value), not a field projection — writing a
 * saved view's field list there would render a board with one empty lane per
 * field name. Nor is `sort` or `limit`: the board fetches with a fixed
 * `$top: 100` and no ordering, so there is no key to write them to. Mapping
 * either onto something plausible would re-create the defect this wiring
 * removes — a value accepted and dropped — one layer deeper.
 */
const OBJECT_KANBAN_DATA_SOURCE: ElementDataSourceMapping = {
  filter: true,
};

// Register object-kanban for ListView integration
export const ObjectKanbanRenderer: React.FC<{ schema: any; [key: string]: any }> = ({ schema, ...props }) => {
  const { dataSource } = useSchemaContext() || {};
  // The spec's `PageComponentSchema.dataSource` binding (objectstack#6953):
  // before this, a board authored with `dataSource: { object, view }` and no
  // `objectName` never fetched — the effect is gated on `schema.objectName` —
  // so it rendered its declared lanes with no cards and no error.
  return (
    <ElementDataSourceGate
      schema={schema}
      mapping={OBJECT_KANBAN_DATA_SOURCE}
      dataSource={dataSource}
      testId="object-kanban"
      errorTitle="This board’s data source could not be resolved"
    >
      {(bound) => <ObjectKanban schema={bound} dataSource={dataSource} {...props} />}
    </ElementDataSourceGate>
  );
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

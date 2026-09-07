/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { Suspense } from 'react';
import { ComponentRegistry, elementDataSourceBlock } from '@object-ui/core';
import {
  ElementDataSourceGate,
  useSchemaContext,
  type ElementDataSourceMapping,
} from '@object-ui/react';
import { Skeleton } from '@object-ui/components';
import { createSafeTranslation } from '@object-ui/i18n';
import type { ComponentInput, KanbanConditionalFormattingRule } from '@object-ui/types';
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
export type { ObjectKanbanComponentProps } from './ObjectKanban';

/**
 * @deprecated Use `ObjectKanbanComponentProps`. Renamed in objectui#4650
 * because `@objectstack/spec/ui` owns `ObjectKanbanProps` from 17.0.0, where it
 * means the AUTHORED props document of the `object-kanban` element — not this
 * component's props. The alias denotes the SAME type and is kept only so
 * existing importers keep compiling.
 */
export type { ObjectKanbanComponentProps as ObjectKanbanProps } from './ObjectKanban';

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
        description: 'Array of { id, title, cards, limit, className }',
        required: true
      },
      { 
        name: 'onCardMove', 
        type: 'code',
        description: 'Callback when a card is moved'      },
      { 
        name: 'className', 
        type: 'string'      }
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
      { name: 'columns', type: 'array', required: true },
      { name: 'enableVirtualScrolling', type: 'boolean' },
      { name: 'virtualScrollThreshold', type: 'number' },
      { name: 'onCardMove', type: 'code' },
      { name: 'onColumnToggle', type: 'code' },
      { name: 'className', type: 'string' }
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
 * What `ObjectKanban` reads for its own query: `objectName`, `filter` and
 * `limit` (`ObjectKanban.tsx`, the `dataSource.find` call — `$filter:
 * schema.filter`, `$top: schema.limit ?? DEFAULT_KANBAN_LIMIT`).
 *
 * `limit` was unmapped until objectui#4025, on the rationale that the board
 * "fetches with a fixed `$top: 100`, so there is no key to write it to". That
 * rationale was false in a way nobody could see from here: the cap was written
 * `{ options: { $top: 100 } }`, and `options` is not a `QueryParams` key — no
 * adapter reads it, so the window was not fixed, it did not exist. #4025 moved
 * the cap to a real top-level `$top` and made it read `schema.limit`, so the
 * flag comes with the read site (the order `object-timeline` did it in, #4009)
 * and a bound view's `pagination.pageSize` now actually caps the board.
 *
 * Still deliberately NOT mapped:
 *
 * - `columns` — a board's `columns` are its SWIMLANES (`{ id, title }` per
 *   `groupBy` value), not a field projection; a saved view's field list written
 *   there would render one empty lane per field name.
 * - `sort` — the board has no `$orderby` read site: cards are grouped into lanes
 *   by `groupBy`, and the fetch declares no ordering. Mapping it onto something
 *   plausible would re-create the defect this wiring removes — a value accepted
 *   and dropped — one layer deeper.
 */
const OBJECT_KANBAN_DATA_SOURCE: ElementDataSourceMapping = {
  filter: true,
  limit: 'limit',
};

// Register object-kanban for ListView integration
export const ObjectKanbanRenderer: React.FC<{ schema: any; [key: string]: any }> = elementDataSourceBlock(({ schema, ...props }) => {
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
});

/**
 * The authoring surface both `ObjectKanbanRenderer` tags publish, spelled ONCE
 * and spread into both registrations (objectui#8201).
 *
 * ## Why it is shared rather than hand-copied
 *
 * `object-kanban` and `view:kanban` are the SAME renderer, so the only way the
 * two lists could ever disagree is a hand-copy that missed one — which is
 * precisely what this card found: `filter` reached both because objectui#8186
 * edited both, but nothing structural said it had to.
 *
 * ## Why these keys were added
 *
 * `@objectstack/spec`'s `ComponentPropsMap['object-kanban']` declares thirteen
 * top-level keys; this list published three until objectui#8186 added `filter`.
 * The gap was STRUCTURAL rather than considered — the console registers this
 * block with `ComponentRegistry.registerLazy` and `getConfig` is loaded-only by
 * design, so the block sat outside the console's reverse-parity population
 * entirely until objectui#8176 loaded it. objectui#8201 asked the per-key
 * question that census never got to ask.
 *
 * Each key below was measured against a read site that CHANGES BEHAVIOUR on the
 * `ObjectKanban` path — not a mention, and not a read site belonging to the
 * sibling `kanban-ui` block, which is a different renderer with a different
 * declared surface:
 *
 *   - `groupBy` — `ObjectKanban.tsx` materializes the lanes from this field's
 *     picklist options, `bucketCardsIntoColumns` buckets records by its value,
 *     and a drag between lanes writes the new value back to the record.
 *   - `cardTitle` / `titleField` — one choice with two spellings, `cardTitle`
 *     first; it selects the record field rendered as the card title.
 *   - `swimlaneField` — becomes `effectiveSchema.swimlaneField`, which
 *     `KanbanImpl` splits the board into horizontal swimlanes on (and keys its
 *     per-lane collapsed-state storage by).
 *   - `coverImageField` — `bucketCardsIntoColumns` maps it onto each card's
 *     `coverImage`, which `KanbanImpl` renders as the card's `<img>`.
 *
 * objectui#8313 added the four ARRAY/OBJECT-armed keys the same census left
 * behind. Each was measured at ITS OWN SINK rather than assumed to share one,
 * because the four sinks answer four different questions and only one of them
 * is a pass-through:
 *
 *   - `data` — read TWICE, and the two reads differ. As a GATE it SUPPRESSES
 *     the board's own query; as a VALUE, `rawData = external || boundData ||
 *     schema.data || fetchedData` selects it and `effectiveData` REBUILDS every
 *     member into a card, so it is not a pass-through and no identity claim is
 *     true of it. ⚠️ The gate is DOUBLY guarded on the authored-node path, and
 *     naming only one guard would be wrong: `SchemaRenderer` spreads
 *     non-metadata schema properties as React props, so an authored `data`
 *     arrives as `schema.data` AND as this component's `data` prop — which
 *     makes `hasExternalData` true and returns from the fetch effect at its
 *     first line, BEFORE `if (schema.objectName && !boundData && !schema.data)`
 *     is reached. Measured, not reasoned: removing either guard alone leaves
 *     the query suppressed and the member pin green; removing both makes the
 *     board query and reddens both of its gate rows by name.
 *   - `cardFields` — `resolveKanbanCardFields(schema.cardFields, objectDef)`,
 *     exported and pure. It answers WHICH FIELD NAMES the author chose, which
 *     is a different question from which cells a card ends up carrying: the
 *     card loop further drops a name that duplicates the title and one whose
 *     value is empty. Both are measured; the pin says which row is which.
 *   - `grouping` — one nested position and no more:
 *     `schema.grouping?.fields?.[0]?.field` is the FALLBACK for
 *     `swimlaneField`. Everything else inside `grouping`, later `fields`
 *     entries included, is inert on this board — which is why the declared
 *     description says so rather than implying a shape the board does not read.
 *   - `conditionalFormatting` — the only one this file reads NOWHERE.
 *     `ObjectKanban.tsx` never names it (measured: zero occurrences, against
 *     nine for `cardFields` in the same file); it travels on the
 *     `{ ...schema }` spread into `effectiveSchema` and then into
 *     `KanbanRenderer`, which forwards it to `KanbanImpl`'s `getCardStyles`.
 *     An edit replacing that spread with an explicit key list would drop the
 *     key silently, and the member pin is the only thing that would notice.
 *
 * ## What declaring them widens, and on what grounds (clause ②)
 *
 * Declaring an input WIDENS the authoring surface, so the grounds are stated
 * rather than assumed. They are the same grounds objectui#8186 (`filter`) and
 * objectui#8223 (`sort`) cleared on: the SPEC already declares all five and the
 * RENDERER already honours all five, so this restores `declared = enforced`
 * instead of publishing anything new. Measured with a control on the same
 * `safeParse` call — because "the spec declares it" is exactly the assumption
 * objectui#8172 falsified for `limit`, which four faces teach and the strict
 * `ComponentPropsMap` refuses BY NAME. An unrecognised probe key draws
 * `unrecognized_keys` on these calls while none of these five does.
 *
 * ## What is deliberately NOT here yet
 *
 * ONE of the thirteen keys stays undeclared, keeping its live entry in
 * `apps/console/src/__tests__/registry-inputs-spec-parity.test.ts`:
 *
 *   - `quickAdd` is ESCALATED, not deferred: this renderer does not honour it
 *     at all. `KanbanImpl` gates the control on `quickAdd && onQuickAdd`, and
 *     `onQuickAdd` is an objectui#6124 RUNTIME SLOT the zod twin refuses by
 *     name; nothing on the `ObjectKanban` path supplies one. Whether that is a
 *     permanent carve-out or a feature gap is a product ruling, not a
 *     measurement, so objectui#8201 hands it to the maintainer rather than
 *     writing a carve-out reason it has no standing to write.
 *
 * The declarations are pinned per tag and per key, so removing one from this
 * list reddens a NAMED row rather than a file:
 * `__tests__/scalarKeysAreDeclaredAndHonoured-8201.test.ts` for the five scalar
 * keys, `__tests__/structuredKeysAreDeclaredAndHonoured-8313.test.ts` for the
 * four array/object-armed ones. The MEMBER shape of those four — the second
 * obligation objectui#8212 created, which a declaration pin cannot carry — is
 * `__tests__/ObjectKanban.structuredMembersReachTheirSinks-8313.test.tsx`.
 */
const OBJECT_KANBAN_INPUTS: ComponentInput[] = [
  { name: 'objectName', type: 'string', required: true },
  { name: 'columns', type: 'array' },
  { name: 'filter', type: 'array', description: 'Filter criteria in JSON-rules form, narrowing the records the board fetches. Lowered to `$filter` on the query.' },
  { name: 'groupBy', type: 'string', description: 'Record field whose value buckets cards into lanes. Its picklist options become the lanes when `columns` is absent, and a drag between lanes writes the target lane’s value back to the record. A value matching no lane lands in the trailing “Uncategorized” lane rather than disappearing.' },
  { name: 'cardTitle', type: 'string', description: 'Record field rendered as the card title. Read AHEAD of `titleField`, which is the legacy spelling of the same choice; when neither yields a value the shared record-display resolver names the card.' },
  { name: 'titleField', type: 'string', description: 'Legacy spelling of `cardTitle` — the record field rendered as the card title. `cardTitle` wins when both are authored.' },
  { name: 'swimlaneField', type: 'string', description: 'Record field that splits the board into horizontal swimlanes. When absent the board falls back to `grouping.fields[0].field`.' },
  { name: 'coverImageField', type: 'string', description: 'Record field holding a card cover image — a URL string, or a file object carrying a `url`. Any other value leaves the card without a cover.' },
  { name: 'data', type: 'array', description: 'Inline records to render instead of fetching. Authoring it SUPPRESSES the board’s own query entirely. Members are records: the board reads `id` (or `_id`) as the card identity, the `groupBy` field’s value as the lane, the card-title field, `coverImageField`, and every `cardFields` entry. Records handed down by a parent view and a `bind` expression both take priority over it.' },
  { name: 'cardFields', type: 'array', description: 'Record field NAMES rendered as cells on each card, in the order written. Members are bare names, not entry objects. An explicit list wins over the object’s `highlightFields` role; unlike that fallback it is NOT filtered against the object definition, so a name the object no longer declares simply renders no cell. An empty array reads as omitted.' },
  { name: 'grouping', type: 'object', description: 'Only `grouping.fields[0].field` is read, and only as the FALLBACK for `swimlaneField`: it names the record field that splits the board into horizontal swimlanes when no `swimlaneField` is authored. An explicit `swimlaneField` wins. Every other position inside `grouping`, later `fields` entries included, is inert on this board.' },
  { name: 'conditionalFormatting', type: 'array', description: 'Per-card style rules, each evaluated against that card’s own record. Two member dialects are accepted: the native `{ field, operator, value, backgroundColor?, borderColor? }` and the spec CEL `{ condition, backgroundColor?, borderColor? }`. A matching rule colours that card alone. A rule comparing a relation field sees the stored foreign key rather than the expanded record.' },
];

ComponentRegistry.register(
  'object-kanban',
  ObjectKanbanRenderer,
  {
    namespace: 'plugin-kanban',
    label: 'Object Kanban',
    category: 'view',
    inputs: [...OBJECT_KANBAN_INPUTS],
  }
);
ComponentRegistry.register(
  'kanban',
  ObjectKanbanRenderer,
  {
    namespace: 'view',
    label: 'Kanban Board',
    category: 'view',
    // Same renderer as `object-kanban`, therefore the same declared surface —
    // now SHARED rather than hand-copied (objectui#8201).
    inputs: [...OBJECT_KANBAN_INPUTS],
  }
);
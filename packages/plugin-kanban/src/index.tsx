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
// ⛔ `KanbanSchema` RETIRED with the bare `kanban` node type key (objectui#8802).
export type { KanbanCard, KanbanColumn, CardTemplate, ColumnWidthConfig, InlineFieldDefinition } from './types';
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
     * The lane counts below are counts of a fetched WINDOW, not of the group
     * (objectui#8307). Injected by `ObjectKanban`, the only entry point that
     * issues the windowed `$top` query and can therefore know the answer;
     * `ObjectKanban` supplies nothing on the schema-only `kanban-ui` entry,
     * whose `data` arrives whole from its author and whose counts are complete
     * by construction. Not MEANT to be an authorable input for exactly that
     * reason — same shape and same argument as the `objectFields` prop BELOW,
     * and likewise absent from this component's registry `inputs`. ⚠️ Unlike
     * that prop it still rides this schema bag, so on `kanban-ui` an author can
     * in fact write it; batch #70 did not name the key, so it is recorded here
     * rather than moved (objectui#7742).
     */
    countsAreWindowed?: boolean;
  };
  /**
   * The object's field definitions, injected by `ObjectKanban` (the only entry
   * point that fetches an object schema). Card conditional formatting needs
   * them so a rule comparing a relation field sees the stored foreign key
   * rather than the record `$expand` substituted for it — the board expands
   * relations exactly as the grid does, so without this the SAME rule on the
   * SAME view worked on the grid and silently never matched on the board
   * (objectui#3501).
   *
   * ⛔ INTENDED AS AN INTERNAL CHANNEL, NOT AN AUTHORING SURFACE (objectui#7742,
   * maintainer decision batch #70, 2026-09-07). It sits HERE — a React prop, a
   * sibling of `schema` — and deliberately NOT inside `schema`, which is where
   * it used to live. Inside `schema` it was reachable by an AUTHOR: `BaseSchema`
   * is `.passthrough()`, `SchemaRenderer` hands the node through, and on the
   * schema-only `kanban-ui` entry (which has no object schema of its own to
   * substitute) an authored `objectFields` reached
   * `resolveConditionalFormatting` verbatim. Nothing declared it on any schema
   * face, so nothing judged it either.
   *
   * ⚠️ THE MOVE CLOSES THE `kanban` ARM, NOT THE KEY — measured through the
   * real `SchemaRenderer`, so do NOT read this prop as proof that only
   * `ObjectKanban` can write it. `ObjectKanbanRenderer` serves `type: 'kanban'`
   * and discards its rest-spread (`void _props;`), so an authored `objectFields`
   * on a `'kanban'` node reaches nothing — that arm is genuinely closed. But
   * `objectFields` is NOT on `SchemaRenderer`'s stripped-metadata list (the
   * destructure that feeds its `...componentProps` rest), so on the `kanban-ui`
   * registration below — which THIS component serves — an authored
   * `objectFields` survives the generic prop spread and lands right here, and
   * still reaches `resolveConditionalFormatting` exactly as it did before.
   * Stripping the key at that entry is a separate change, not made here.
   *
   * `ObjectKanban` supplies nothing on the schema-only `kanban-ui` entry — it
   * has no object schema to offer — so unless an author wrote the key and it
   * arrived by the spread above, conditional formatting there reads the card
   * payload as before.
   *
   * ⚠️ `countsAreWindowed` above is the SAME shape and the same argument, and
   * the batch #70 ruling did not name it — it stays on the schema bag, recorded
   * rather than fixed here.
   */
  objectFields?: unknown;
}

/**
 * KanbanRenderer - The public API for the kanban board component
 * This wrapper handles lazy loading internally using React.Suspense
 */
export const KanbanRenderer: React.FC<KanbanRendererProps> = ({ schema, objectFields }) => {
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
        objectFields={objectFields}
        swimlaneField={schema.swimlaneField}
        countsAreWindowed={schema.countsAreWindowed}
      />
    </Suspense>
  );
};

/**
 * ⛔ The `kanban-ui` node type key is RETIRED (objectui#8257, maintainer ruling
 * 2026-09-09), together with `kanban-enhanced` below. `KanbanRenderer` itself
 * stays exported and stays in use — `ObjectKanban` renders it — it is only the
 * REGISTRY KEY that is gone.
 *
 * ## The measurement the ruling was taken on
 *
 * Exact node-type spellings, whole repo: `kanban-ui` was authored 0 times in
 * JSON and 0 times in TS/TSX as a registry-resolved node, against a firing
 * control of 2 JSON / 128 TS occurrences for the live sibling `object-grid` and
 * a silent control (`zzz-not-a-type`, 0). ⇒ a registered type key no document
 * in this repository has ever authored. Declaring an arm for it would have
 * committed the repo to a validation face for a spelling with no writers — the
 * opposite of what ADR-0049 enforce-or-remove asks.
 *
 * ## Why unregistering is the whole retirement
 *
 * ⚠️ `BaseSchema` closes with `[key: string]: any` and `BaseSchemaCore` ends
 * `.passthrough()`, so a dropped MEMBER KEY is KEPT, not refused (objectui#7664).
 * That hazard needs a schema face to arise on, and this key never had one:
 * measured whole-repo, `@object-ui/types` declares `kanban-ui` as a component
 * node type ZERO times (firing control: `object-kanban`, 2 — `objectql.ts` and
 * its Zod mirror). There is no arm to convert into a named refusal.
 * ⇒ Registration-only retirement.
 *
 * ## ⭐ What this closes as a side effect — objectui#8818
 *
 * `SchemaRenderer` strips a fixed, enumerated metadata list and spreads the
 * REST as React props. `objectFields` is not on that list, and `KanbanRenderer`
 * — registered here for `kanban-ui` — declares `objectFields` as a real prop
 * (objectui#7742). So an AUTHORED `objectFields` reached the predicate layer
 * verbatim on this entry, with no schema face declaring or judging it.
 * Retiring this registration closes that path: nothing resolves `kanban-ui` any
 * more, so no authored node reaches `KanbanRenderer` through the registry.
 *
 * ⚠️ This closes the ENTRY, ⛔ not the CLASS. `SchemaRenderer` still spreads
 * every unstripped key; if another renderer ever declares an `objectFields`
 * prop the hole returns. objectui#8818's option (a) — stripping at the
 * `SchemaRenderer` boundary — is the one that would close the class, and it is
 * still open.
 *
 * Pinned in `src/__tests__/kanban-family-registry-keys-retired-8257.test.ts`.
 */

/**
 * Standard Export Protocol — for manual integration.
 *
 * ⛔ The `kanban`, `kanban-enhanced` and `kanban-ui` keys are RETIRED
 * (objectui#8802 / objectui#8257, maintainer rulings 2026-09-09), so this map
 * publishes the one surviving spelling. A host that mounted the retired keys
 * from here was re-teaching them under its own registry; `object-kanban` is the
 * key to mount.
 */
export const kanbanComponents = {
  'object-kanban': ObjectKanban,
};

/**
 * ⛔ The `kanban-enhanced` node type key is RETIRED (objectui#8257, maintainer
 * ruling 2026-09-09) — the card's own subject.
 *
 * ## What went, and what went with it
 *
 * The registration read `onColumnToggle`, `enableVirtualScrolling` and
 * `virtualScrollThreshold` off `schema` and declared them as `inputs`, while
 * `@object-ui/types` declared no `kanban-enhanced` arm at all: the type was
 * dispatched by the registry and validated by nothing but `BaseSchema`'s
 * passthrough. ⇒ Re-measured on this branch and CONFIRMED rather than assumed:
 * with the registration gone those three keys have NO authorable surface left
 * anywhere in the repo — 0 declarations on any schema face, 0 remaining
 * `inputs` entries, 0 read sites (firing control on the same instrument:
 * `groupBy`, which keeps 1 declaration + read sites on the surviving
 * `object-kanban` face). objectui#8257's question is resolved by the removal of
 * its subject, not by an answer.
 *
 * ## The measurement the ruling was taken on
 *
 * `kanban-enhanced` was authored 0 times in JSON and 0 times in TS/TSX, against
 * the same firing control (`object-grid`, 2 JSON / 128 TS) and silent control
 * (`zzz-not-a-type`, 0) the `kanban-ui` note above cites.
 *
 * `KanbanEnhanced` itself is untouched and still importable from
 * `@object-ui/plugin-kanban/KanbanEnhanced`; what is gone is the registry key
 * and the `React.lazy` wrapper that existed only to serve it.
 *
 * Pinned in `src/__tests__/kanban-family-registry-keys-retired-8257.test.ts`.
 */

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
/**
 * ⛔ The bare `kanban` node type key is RETIRED (objectui#8802, maintainer
 * ruling 2026-09-09: 「从我们的业务需求角度，我应该只需要 `object-kanban`」).
 * `object-kanban` above is the one spelling this plugin serves.
 *
 * ## What this dissolves rather than patches
 *
 * The two published faces of this key returned OPPOSITE verdicts on the same
 * document: the registry `inputs` above (shared into both registrations by
 * objectui#8201) declared `titleField`, while the `kanban` Zod arm refused it
 * BY NAME after batch #70. With the key gone there is no arm left to disagree
 * with — objectui#8802's four options are all moot.
 *
 * ## ⚠️ Unlike its `gantt` / `kanban-ui` / `kanban-enhanced` siblings, this one
 * had a DECLARED FACE, so unregistering is only half of it
 *
 * `@object-ui/types` declared `KanbanSchema` with `type: 'kanban'` and mirrored
 * it in `zod/complex.zod.ts`. A plain deletion there would have been the
 * objectui#7664 failure: `BaseSchema` is `.passthrough()`, so a document naming
 * a dropped spelling validates GREEN and renders nothing. The Zod arm is
 * therefore a NAMED REFUSAL (`retiredNodeType()`, `zod/tombstone.zod.ts`)
 * pointing the author at `object-kanban`, and the TS face leaves `ComplexSchema`
 * and `SchemaRegistry` so `tsc` refuses the literal at the authoring site.
 *
 * ## ⛔ Two layers, and only one of them moved
 *
 * `kanban` is ALSO a STORED `NamedListView.type` — the value `CreateViewDialog`
 * writes and every tenant's database holds. That layer is untouched:
 * `packages/plugin-view/src/ObjectView.tsx`'s `switch (viewType)` already emits
 * `object-kanban` for a stored `kanban` view, as it emits `object-*` for all
 * twelve view types. ⇒ Every kanban view any user ever created through the
 * console already renders through the surviving spelling; this retirement moves
 * zero stored documents.
 *
 * Pinned in `src/__tests__/kanban-family-registry-keys-retired-8257.test.ts`
 * and `@object-ui/types`' `__tests__/bare-kanban-node-key-retired-8802.test.ts`.
 */
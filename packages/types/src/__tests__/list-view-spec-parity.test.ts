/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ListView ↔ @objectstack/spec drift guard (issue #2231).
 *
 * objectui's `ListViewSchema` (packages/types/src/zod/objectql.zod.ts) is DERIVED from
 * the spec's `ListViewSchema` (`@objectstack/spec/ui`): spec-owned fields flow in by
 * reference, and only objectui-only / legacy fields are declared locally. That derivation
 * means new spec fields are picked up automatically — but it can still silently break in
 * three ways, which these tests catch:
 *
 *   1. The spec grows a field objectui never triaged (would flow in unnoticed, or — if the
 *      omit list references it — vanish). We assert every spec field is present in the
 *      objectui shape (or explicitly envelope-owned by BaseSchema).
 *   2. The spec RENAMES/REMOVES a field objectui specifically aliases or relaxes
 *      (`type` → `viewType`, `columns` relaxed, `filter` alongside legacy `filters`). The
 *      alias would then point at nothing. We assert those anchors still exist upstream.
 *   3. Someone adds an objectui-local field that shadows what should have been a spec field
 *      (re-opening the drift the unification closed). We assert every objectui-only key is
 *      in the explicitly-sanctioned local set below, forcing a conscious local-vs-upstream
 *      decision on every new field.
 *
 * When one of these fails, do NOT just edit the sets to make it green — decide whether the
 * field belongs upstream in `@objectstack/spec` (promote it) or is a genuine objectui-only
 * extension (add it to SANCTIONED_LOCAL with a rationale). See #2231.
 */
import { describe, it, expect } from 'vitest';
import {
  ListViewSchema as SpecListViewSchema,
  KanbanConfigSchema as SpecKanbanConfigSchema,
  CalendarConfigSchema as SpecCalendarConfigSchema,
  GanttConfigSchema as SpecGanttConfigSchema,
  GalleryConfigSchema as SpecGalleryConfigSchema,
  TimelineConfigSchema as SpecTimelineConfigSchema,
} from '@objectstack/spec/ui';
import { ListViewSchema as OuiListViewSchema } from '../zod/objectql.zod.js';
import { BaseSchema } from '../zod/base.zod.js';

const specShape = (SpecListViewSchema as unknown as { shape: Record<string, unknown> }).shape;
const ouiShape = (OuiListViewSchema as unknown as { shape: Record<string, unknown> }).shape;
const baseShape = (BaseSchema as unknown as { shape: Record<string, unknown> }).shape;

/** Peel `.optional()` / `.default()` wrappers off a field and return its object shape. */
function unwrapObjectShape(schema: unknown): Record<string, unknown> {
  let cur = schema as { unwrap?: () => unknown; shape?: Record<string, unknown> };
  for (let i = 0; i < 5 && cur && !cur.shape && typeof cur.unwrap === 'function'; i++) {
    cur = cur.unwrap() as typeof cur;
  }
  return cur?.shape ?? {};
}

const specKeys = Object.keys(specShape);
const ouiKeys = new Set(Object.keys(ouiShape));
// Component-envelope keys owned by BaseSchema (id, className, visible, etc.) — derived, so
// this test never needs editing when the envelope changes.
const ENVELOPE = new Set(Object.keys(baseShape));

/**
 * objectui-only ListView fields — sanctioned local extensions on top of the spec base.
 * Each is either legacy vocabulary kept for back-compat (migration to the spec-canonical
 * key is deferred — #2231) or a genuinely objectui-only renderer concern. Adding to this
 * set is a deliberate act: prefer promoting the field into `@objectstack/spec` instead.
 */
const SANCTIONED_LOCAL = new Set<string>([
  // component binding (spec binds via data.provider:'object')
  'objectName',
  // renamed spec `type` (view-kind enum); `type` itself is the component discriminator
  'viewType',
  // legacy aliases for spec `columns` / `filter`. `fields` is INPUT-ONLY since
  // #2890: `normalizeListViewSchema` (@object-ui/core) folds it into `columns`
  // at the ListView boundary and no renderer reads it. It stays declared here
  // so stored metadata keeps validating and so the spec's react-blocks
  // `<ListView fields>` prop keeps a schema anchor.
  'fields',
  // `filters` is likewise INPUT-ONLY since #2890 — folded into `filter`.
  'filters',
  // legacy toolbar visibility flags (spec-canonical: `userActions`)
  'showSearch',
  'showSort',
  'showFilters',
  'showHideFields',
  'showGroup',
  'showColor',
  'showDensity',
  'showDescription',
  'allowExport',
  // legacy density shorthand, INPUT-ONLY since #2890: `normalizeListViewSchema`
  // (@object-ui/core) folds it into the spec's `rowHeight` at the ListView
  // boundary and no renderer reads it.
  'densityMode',
  // legacy row/text coloring shorthand (spec-canonical: `rowColor`)
  'color',
  'fieldTextColor',
  'prefixField',
  // objectui renderer flags with no spec equivalent (yet)
  'wrapHeaders',
  'clickIntoRecordDetails',
  'addRecordViaForm',
  'addDeleteRecordsInline',
  'collapseAllByDefault',
  'operations',
  'options',
]);

describe('ListView spec parity (#2231 drift guard)', () => {
  it('covers every @objectstack/spec ListView field (spec cannot grow a field objectui ignores)', () => {
    // Fails when the spec adds a field that objectui neither imports nor envelope-owns —
    // i.e. a field that needs a local-vs-upstream triage decision.
    const missing = specKeys.filter((k) => !ouiKeys.has(k) && !ENVELOPE.has(k));
    expect(missing).toEqual([]);
  });

  it('keeps the spec anchors objectui remaps/relaxes (`type`, `columns`, `filter`)', () => {
    // Fails when the spec renames/removes a field objectui aliases, orphaning the alias.
    expect(specShape).toHaveProperty('type');
    expect(specShape).toHaveProperty('columns');
    expect(specShape).toHaveProperty('filter');
  });

  it('declares no objectui-only field outside the sanctioned-local set', () => {
    // Fails when a new objectui-only field is added without deciding local-vs-upstream.
    const rogue = [...ouiKeys].filter(
      (k) => !specShape[k] && !ENVELOPE.has(k) && !SANCTIONED_LOCAL.has(k),
    );
    expect(rogue).toEqual([]);
  });

  it('preserves the component discriminator + required objectName', () => {
    const bad = OuiListViewSchema.safeParse({ objectName: 'accounts' }); // no type
    expect(bad.success).toBe(false);
    const good = OuiListViewSchema.safeParse({ type: 'list-view', objectName: 'accounts' });
    expect(good.success).toBe(true);
    const noObject = OuiListViewSchema.safeParse({ type: 'list-view' }); // no objectName
    expect(noObject.success).toBe(false);
  });

  it('accepts both legacy (fields/filters/show*) and spec-canonical (columns/filter/userActions) payloads', () => {
    const legacy = OuiListViewSchema.safeParse({
      type: 'list-view',
      objectName: 'accounts',
      viewType: 'kanban',
      fields: ['name', 'stage'],
      filters: [['stage', '=', 'won']],
      showSearch: true,
      showHideFields: true,
      densityMode: 'compact',
    });
    expect(legacy.success).toBe(true);

    const canonical = OuiListViewSchema.safeParse({
      type: 'list-view',
      objectName: 'accounts',
      columns: ['name', 'stage'],
      filter: [{ field: 'stage', operator: 'equals', value: 'won' }],
      userActions: { search: true, filter: true },
      rowHeight: 'compact',
    });
    expect(canonical.success).toBe(true);
  });
});

/**
 * Per-view-type configs — derived from the spec configs, not forked (#2231).
 *
 * These used to be hand-written objects with their own vocabulary
 * (`groupField`/`cardFields`/`imageField`/`dateField`), which is how a
 * spec-authored `kanban: { groupByField }` — exactly what `CreateViewDialog`
 * emits — could pass the ListView capability gate and still render the wrong
 * lanes. They now carry the spec's field set; only the keys asserted below are
 * local, and each is either a deprecated alias or has no spec counterpart.
 */
describe('per-view-type configs derive from the spec', () => {
  const CONFIGS = {
    kanban: { spec: SpecKanbanConfigSchema, local: ['groupField', 'cardFields'] },
    calendar: { spec: SpecCalendarConfigSchema, local: ['defaultView'] },
    gantt: { spec: SpecGanttConfigSchema, local: [] },
    gallery: { spec: SpecGalleryConfigSchema, local: ['imageField'] },
    timeline: { spec: SpecTimelineConfigSchema, local: ['dateField'] },
  } as const;

  it.each(Object.keys(CONFIGS))('%s carries every spec field', (key) => {
    const { spec } = CONFIGS[key as keyof typeof CONFIGS];
    const specKeys = Object.keys((spec as unknown as { shape: Record<string, unknown> }).shape);
    const ouiKeys = new Set(Object.keys(unwrapObjectShape(ouiShape[key])));
    expect(specKeys.filter((k) => !ouiKeys.has(k))).toEqual([]);
  });

  it.each(Object.keys(CONFIGS))('%s declares only the sanctioned local keys', (key) => {
    const { spec, local } = CONFIGS[key as keyof typeof CONFIGS];
    const specKeys = new Set(Object.keys((spec as unknown as { shape: Record<string, unknown> }).shape));
    const localOnly = Object.keys(unwrapObjectShape(ouiShape[key])).filter((k) => !specKeys.has(k));
    expect(localOnly.sort()).toEqual([...local].sort());
  });

  it('accepts spec vocabulary on every config', () => {
    const result = OuiListViewSchema.safeParse({
      type: 'list-view',
      objectName: 'accounts',
      kanban: { groupByField: 'stage', columns: ['name', 'amount'] },
      calendar: { startDateField: 'starts_at', titleField: 'name', colorField: 'stage' },
      gantt: { startDateField: 'starts_at', endDateField: 'ends_at', titleField: 'name', groupByField: 'owner', resourceView: true },
      gallery: { coverField: 'logo', coverFit: 'contain', cardSize: 'large', visibleFields: ['name'] },
      timeline: { startDateField: 'starts_at', titleField: 'name', scale: 'month', groupByField: 'owner' },
    });
    expect(result.success).toBe(true);
    // Spec fields must survive the parse, not be silently stripped.
    expect(result.success && result.data.gantt).toMatchObject({ groupByField: 'owner', resourceView: true });
    expect(result.success && result.data.timeline).toMatchObject({ scale: 'month' });
  });

  it('still accepts the deprecated pre-#2231 aliases so stored views keep validating', () => {
    const result = OuiListViewSchema.safeParse({
      type: 'list-view',
      objectName: 'accounts',
      kanban: { groupField: 'stage', cardFields: ['name'] },
      gallery: { imageField: 'logo' },
      timeline: { dateField: 'due_date' },
      calendar: { startDateField: 'starts_at', defaultView: 'week' },
    });
    expect(result.success).toBe(true);
  });

  it('does not require the spec-required sub-fields the product authors partially', () => {
    // CreateViewDialog emits `kanban: { groupByField }` with no `columns`; spec
    // marks `columns` required, so the derivation must stay `.partial()`.
    expect(OuiListViewSchema.safeParse({
      type: 'list-view',
      objectName: 'accounts',
      kanban: { groupByField: 'stage' },
    }).success).toBe(true);
  });
});

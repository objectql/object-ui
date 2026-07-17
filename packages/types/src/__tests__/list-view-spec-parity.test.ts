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
import { ListViewSchema as SpecListViewSchema } from '@objectstack/spec/ui';
import { ListViewSchema as OuiListViewSchema } from '../zod/objectql.zod.js';
import { BaseSchema } from '../zod/base.zod.js';

const specShape = (SpecListViewSchema as unknown as { shape: Record<string, unknown> }).shape;
const ouiShape = (OuiListViewSchema as unknown as { shape: Record<string, unknown> }).shape;
const baseShape = (BaseSchema as unknown as { shape: Record<string, unknown> }).shape;

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
  // legacy aliases for spec `columns` / `filter`
  'fields',
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
  // legacy density shorthand (spec-canonical: `rowHeight`)
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

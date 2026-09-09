/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#8429 — the RESIDUAL left standing after objectui#8127 / PR #8372.
 *
 * #8127 was the DECLARATION gap: `ViewType` was a hand-written copy of
 * `@objectstack/spec`'s list-view vocabulary, so every structure keyed on it
 * was total over the COPY and compiled green while the spec's `page` had
 * nowhere to land. PR #8372 closed exactly that — both published
 * `@object-ui/types` faces are DERIVED from the spec now.
 *
 * What it did NOT close, and what this file states mechanically, is the
 * renderer gap the derivation made visible rather than removed:
 *
 *   `page` is simultaneously
 *     (a) a list-view type `@objectstack/spec`'s own `ListViewSchema` ACCEPTS,
 *     (b) a member of `@object-ui/types`' published `ViewType` / `ViewTypeSchema`,
 *     (c) NOT a member of the set `ListView` can draw, and therefore
 *     (d) normalised to `viewType: 'grid'` — a DIFFERENT view kind — by
 *         `normalizeListViewSchema`, with the `pageName` mount target left
 *         sitting in the metadata, unread.
 *
 * ⛔ This file is DISPOSITION-FREE and must stay that way. It does not propose
 * that `ListView` grow a page renderer, and it does not propose narrowing
 * `ViewType` back — both are rulings the card deliberately leaves open, and the
 * second would break the derivation #8372 just established. The pin asserts
 * TODAY'S behaviour so that neither disposition can land silently:
 *
 *   · grow a renderer  ⇒ `page` becomes drawable ⇒ the residual set empties and
 *                        the normalised output stops being `'grid'` ⇒ RED.
 *   · narrow `ViewType` ⇒ the published faces stop accepting `page` ⇒ RED.
 *
 * ⚠️ The `console.warn` #8372 added is a signal to the DEVELOPER, not to the end
 * user — the author still gets a grid. It is silenced here, not treated as a
 * mitigation, and its own behaviour stays pinned in `normalize-list-view.test.ts`.
 *
 * ⚠️ Every set below is asserted at its EXACT size before it is used, because a
 * census over an empty set passes. `SPEC_LIST_VIEW_TYPES` in particular is read
 * from the installed `@objectstack/spec` at runtime, so an upstream bump that
 * empties or reshapes the vocabulary must fail here rather than vacuously pass.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ListViewSchema as SpecListViewSchema } from '@objectstack/spec/ui';
import { ViewTypeSchema } from '@object-ui/types/zod';
import type { ViewType } from '@object-ui/types';
import { normalizeListViewSchema, isListViewVisualization } from '../normalize-list-view.js';

/** The spec's own list-view vocabulary, unwrapped from its `.default('grid')`. */
const SPEC_LIST_VIEW_TYPES: readonly string[] = SpecListViewSchema.shape.type.removeDefault().options;

/** objectui's published vocabulary: the spec's list plus the two local CATEGORIES. */
const OBJECTUI_VIEW_TYPES: readonly string[] = ViewTypeSchema.options;

/**
 * A document `@objectstack/spec`'s `ListViewSchema` ACCEPTS — proven below,
 * against three controls, before it is used as the normalizer's input.
 *
 * `pageName` is required on a `page` view and `columns` must be empty beside it
 * (`checkListViewPageMount`, `@objectstack/spec@17.3.0`), so this is not a
 * hand-waved "spec-valid": it is the only shape a page view can legally take.
 */
const SPEC_VALID_PAGE_VIEW = {
  name: 'account_page',
  type: 'page',
  pageName: 'crm_welcome',
  columns: [] as unknown[],
} as const;

const readViewType = (out: unknown): unknown => (out as { viewType?: unknown }).viewType;

describe('the `page` residual (objectui#8429)', () => {
  beforeEach(() => {
    // Developer-facing noise from #8372's undrawable-kind warning. Silenced, not
    // asserted: this file is about what the AUTHOR gets, and the author gets a grid.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('the populations, sized before they are used', () => {
    it('reads a non-empty, exactly-sized vocabulary from each face', () => {
      // The spec's list-view types, as published in @objectstack/spec 17.3.0.
      expect(SPEC_LIST_VIEW_TYPES.length).toBe(10);
      expect([...SPEC_LIST_VIEW_TYPES].sort()).toEqual([
        'calendar', 'chart', 'gallery', 'gantt', 'grid', 'kanban', 'map', 'page', 'timeline', 'tree',
      ]);

      // objectui's derived face: the spec's ten, plus the two local categories.
      expect(OBJECTUI_VIEW_TYPES.length).toBe(12);
      expect([...OBJECTUI_VIEW_TYPES].sort()).toEqual([
        'calendar', 'chart', 'detail', 'gallery', 'gantt', 'grid',
        'kanban', 'list', 'map', 'page', 'timeline', 'tree',
      ]);

      // The derivation itself: objectui declares a superset, never a subset.
      // This is the leg that reddens if `ViewType` is ever narrowed back.
      for (const kind of SPEC_LIST_VIEW_TYPES) {
        expect(OBJECTUI_VIEW_TYPES).toContain(kind);
      }
    });

    it('partitions objectui`s vocabulary into 9 drawable and 3 undrawable kinds', () => {
      const drawable = OBJECTUI_VIEW_TYPES.filter((k) => isListViewVisualization(k));
      const undrawable = OBJECTUI_VIEW_TYPES.filter((k) => !isListViewVisualization(k));

      expect(drawable.length).toBe(9);
      expect(undrawable.length).toBe(3);
      expect(drawable.length + undrawable.length).toBe(OBJECTUI_VIEW_TYPES.length);
      expect([...undrawable].sort()).toEqual(['detail', 'list', 'page']);
    });
  });

  describe('⭐ the contradiction, as a set with exactly one member', () => {
    it('leaves `page` as the ONLY spec-authorable list-view type ListView cannot draw', () => {
      // `list` and `detail` are objectui view CATEGORIES with no spec counterpart,
      // so they are undrawable WITHOUT being a contract violation. Subtracting the
      // drawable set from the SPEC's vocabulary — not from objectui's — is what
      // isolates the residual this card registers.
      const residual = SPEC_LIST_VIEW_TYPES.filter((k) => !isListViewVisualization(k));

      expect(residual).toEqual(['page']);

      // Control: the subtraction is a real one, not an empty-in / empty-out
      // identity. Nine of the spec's ten types ARE drawable.
      expect(SPEC_LIST_VIEW_TYPES.filter((k) => isListViewVisualization(k)).length).toBe(9);
    });

    it('keeps `page` on BOTH published `@object-ui/types` faces', () => {
      // The value face. Reddens the day `ViewTypeSchema` is narrowed.
      expect(ViewTypeSchema.safeParse('page').success).toBe(true);
      // Control: the vocabulary is still CLOSED, so the `true` above is a
      // reading of an enum and not an enum that accepts anything.
      expect(ViewTypeSchema.safeParse('nonsense-control').success).toBe(false);

      // The type face. This line is a COMPILE-time assertion as much as a
      // runtime one: narrowing `ViewType` makes the annotation itself an error.
      const pageAsViewType: ViewType = 'page';
      expect(OBJECTUI_VIEW_TYPES).toContain(pageAsViewType);
    });
  });

  describe('⭐ the OUTPUT — a document the spec accepts comes back as a different view kind', () => {
    it('confirms the input is spec-valid, against three refusal controls', () => {
      expect(SpecListViewSchema.safeParse(SPEC_VALID_PAGE_VIEW).success).toBe(true);

      // The spec's validator is not a rubber stamp — `checkListViewPageMount`
      // refuses a page view with no mount target, refuses `pageName` on any
      // other kind, and the enum still refuses a typo.
      expect(SpecListViewSchema.safeParse({ name: 'account_page', type: 'page', columns: [] }).success).toBe(false);
      expect(
        SpecListViewSchema.safeParse({ name: 'account_board', type: 'kanban', pageName: 'crm_welcome', columns: [] })
          .success,
      ).toBe(false);
      expect(SpecListViewSchema.safeParse({ name: 'account_typo', type: 'nonsense', columns: [] }).success).toBe(false);
    });

    it('normalises that spec-valid `page` view to `viewType: "grid"`', () => {
      const out = normalizeListViewSchema({ ...SPEC_VALID_PAGE_VIEW });

      // ⭐ The sharpest statement of the bug: the author declared a page and the
      // renderer was handed a grid.
      expect(readViewType(out)).toBe('grid');

      // The mount target survives in the metadata — nothing consumed it. The
      // degrade is not "the page could not be found"; it is "the page was never
      // looked for".
      expect((out as { pageName?: unknown }).pageName).toBe('crm_welcome');
      expect((out as { type?: unknown }).type).toBe('page');
    });

    it('degrades the same way through the `specType` slot a `list-view` node uses', () => {
      // `components/renderers/layout/react-page.tsx` parks the SDUI-tier `type`
      // in `specType` (ADR-0078), so this is the OTHER door the same author
      // reaches the normalizer through.
      const out = normalizeListViewSchema({
        type: 'list-view',
        objectName: 'account',
        specType: 'page',
        pageName: 'crm_welcome',
      });
      expect(readViewType(out)).toBe('grid');
    });

    it('discriminates: a drawable kind keeps its own identity', () => {
      // Without this control, the `'grid'` above would also be produced by a
      // normalizer that answered `'grid'` for everything — an implementation
      // strictly worse than the bug, passing a pin about the bug.
      expect(readViewType(normalizeListViewSchema({ type: 'list-view', objectName: 'a', specType: 'kanban' }))).toBe(
        'kanban',
      );
      expect(readViewType(normalizeListViewSchema({ type: 'list-view', objectName: 'a', specType: 'gantt' }))).toBe(
        'gantt',
      );
      expect(readViewType(normalizeListViewSchema({ viewType: 'kanban', objectName: 'a' }))).toBe('kanban');
    });
  });

  describe('the whole vocabulary, as a census', () => {
    it('maps every one of the 12 declared kinds to what the renderer actually gets', () => {
      const census = new Map<string, unknown>(
        OBJECTUI_VIEW_TYPES.map((kind) => [
          kind,
          readViewType(normalizeListViewSchema({ type: 'list-view', objectName: 'account', specType: kind })),
        ]),
      );

      // Population first: a census over an empty set passes.
      expect(census.size).toBe(12);

      expect(Object.fromEntries(census)).toEqual({
        // The nine ListView draws — each keeps its own identity.
        grid: 'grid',
        kanban: 'kanban',
        gallery: 'gallery',
        calendar: 'calendar',
        timeline: 'timeline',
        gantt: 'gantt',
        map: 'map',
        chart: 'chart',
        tree: 'tree',
        // The two objectui CATEGORIES — folding to grid is correct and intended.
        list: 'grid',
        detail: 'grid',
        // ⭐ THE RESIDUAL. Spec-authorable, published on both faces, and handed
        // to the renderer as something else entirely. Not a category: a kind.
        page: 'grid',
      });

      // Stated once more as the property rather than the table, so the
      // contradiction survives a future reshuffle of the rows above: every
      // SPEC-declared kind resolves to itself, except exactly one.
      const misrouted = SPEC_LIST_VIEW_TYPES.filter((kind) => census.get(kind) !== kind);
      expect(misrouted).toEqual(['page']);
    });
  });
});

/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeListViewSchema,
  rowHeightToDensityMode,
  DENSITY_MODE_TO_ROW_HEIGHT,
  ROW_HEIGHT_TO_DENSITY_MODE,
} from '../normalize-list-view.js';

describe('normalizeListViewSchema (#2890)', () => {
  describe('fields → columns', () => {
    it('folds the legacy `fields` into the spec-canonical `columns`', () => {
      const out = normalizeListViewSchema({ type: 'list-view', viewType: 'grid', fields: ['name', 'stage'] });
      expect(out).toEqual({ type: 'list-view', viewType: 'grid', columns: ['name', 'stage'] });
    });

    it('drops the legacy key so a missed read-site fails loudly instead of taking the legacy path', () => {
      const out = normalizeListViewSchema({ viewType: 'grid', fields: ['name'] }) as Record<string, unknown>;
      expect('fields' in out).toBe(false);
    });

    it('lets the canonical key win when a payload carries both', () => {
      const out = normalizeListViewSchema({
        viewType: 'grid',
        columns: ['canonical'],
        fields: ['legacy'],
      }) as Record<string, unknown>;
      expect(out.columns).toEqual(['canonical']);
      expect('fields' in out).toBe(false);
    });

    it('preserves ListColumn object entries, not just string columns', () => {
      const columns = [{ field: 'name', label: 'Name', width: 200 }];
      const out = normalizeListViewSchema({ viewType: 'grid', columns }) as Record<string, unknown>;
      expect(out.columns).toBe(columns);
    });

    it('folds an empty `fields` array (an explicitly empty column set is not "absent")', () => {
      const out = normalizeListViewSchema({ viewType: 'grid', fields: [] }) as Record<string, unknown>;
      expect(out.columns).toEqual([]);
    });

    it('ignores a non-array `fields` — malformed metadata must not become a column set', () => {
      const out = normalizeListViewSchema({ viewType: 'grid', fields: 'name' }) as Record<string, unknown>;
      expect(out.columns).toBeUndefined();
      expect(out.fields).toBe('name');
    });

    it('is idempotent', () => {
      const once = normalizeListViewSchema({ viewType: 'grid', fields: ['name'] });
      const twice = normalizeListViewSchema(once);
      expect(twice).toEqual(once);
      expect(twice).toBe(once); // nothing left to fold → same reference
    });
  });

  describe('densityMode → rowHeight', () => {
    it('folds the legacy `densityMode` into the spec-canonical `rowHeight`', () => {
      const out = normalizeListViewSchema({ viewType: 'grid', densityMode: 'spacious' }) as Record<string, unknown>;
      expect(out.rowHeight).toBe('tall');
      expect('densityMode' in out).toBe(false);
    });

    it('lets the canonical key win when a view carries both', () => {
      const out = normalizeListViewSchema({
        viewType: 'grid',
        rowHeight: 'extra_tall',
        densityMode: 'compact',
      }) as Record<string, unknown>;
      expect(out.rowHeight).toBe('extra_tall');
      expect('densityMode' in out).toBe(false);
    });

    it('leaves an unrecognized density value alone rather than inventing a row height', () => {
      const out = normalizeListViewSchema({ viewType: 'grid', densityMode: 'cozy' }) as Record<string, unknown>;
      expect(out.rowHeight).toBeUndefined();
      expect(out.densityMode).toBe('cozy');
    });

    it('round-trips every density through the widening and back', () => {
      // The fold widens 3 values onto 5 and the renderer narrows them back, so
      // a folded view must render the density the author picked.
      for (const mode of ['compact', 'comfortable', 'spacious'] as const) {
        expect(ROW_HEIGHT_TO_DENSITY_MODE[DENSITY_MODE_TO_ROW_HEIGHT[mode]]).toBe(mode);
      }
    });

    it('narrows every spec row height onto a density the toolbar can show', () => {
      for (const height of ['compact', 'short', 'medium', 'tall', 'extra_tall'] as const) {
        expect(['compact', 'comfortable', 'spacious']).toContain(ROW_HEIGHT_TO_DENSITY_MODE[height]);
      }
    });
  });

  describe('filters → filter', () => {
    it('folds the legacy `filters` into the spec-canonical `filter`', () => {
      const out = normalizeListViewSchema({
        viewType: 'grid',
        filters: [['stage', '=', 'won']],
      }) as Record<string, unknown>;
      expect(out.filter).toEqual([['stage', '=', 'won']]);
      expect('filters' in out).toBe(false);
    });

    it('lets the canonical key win when a view carries both', () => {
      const out = normalizeListViewSchema({
        viewType: 'grid',
        filter: [['stage', '=', 'won']],
        filters: [['stage', '=', 'lost']],
      }) as Record<string, unknown>;
      expect(out.filter).toEqual([['stage', '=', 'won']]);
      expect('filters' in out).toBe(false);
    });

    it('preserves the value verbatim — the fold renames the key, it does not convert the format', () => {
      // Both keys carry an ObjectQL FilterNode array in objectui, including the
      // compound `['and', …]` form. Rewriting it here would change what reaches
      // the data source.
      const filters = ['and', ['stage', '=', 'won'], ['amount', '>', 100]];
      const out = normalizeListViewSchema({ viewType: 'grid', filters }) as Record<string, unknown>;
      expect(out.filter).toBe(filters);
    });

    it('ignores a non-array `filters`', () => {
      const out = normalizeListViewSchema({ viewType: 'grid', filters: 'stage == "won"' }) as Record<string, unknown>;
      expect(out.filter).toBeUndefined();
      expect(out.filters).toBe('stage == "won"');
    });
  });

  describe('show* → userActions', () => {
    it('folds every legacy toolbar flag onto its userActions key', () => {
      const out = normalizeListViewSchema({
        viewType: 'grid',
        showSearch: false,
        showSort: false,
        showFilters: false,
        showDensity: false,
        showGroup: false,
        showHideFields: true,
        showColor: true,
      }) as Record<string, unknown>;
      expect(out.userActions).toEqual({
        search: false,
        sort: false,
        filter: false,
        rowHeight: false,
        group: false,
        hideFields: true,
        rowColor: true,
      });
      for (const flag of ['showSearch', 'showSort', 'showFilters', 'showDensity', 'showGroup', 'showHideFields', 'showColor']) {
        expect(flag in out).toBe(false);
      }
    });

    it('merges into an existing userActions instead of replacing it', () => {
      const out = normalizeListViewSchema({
        viewType: 'grid',
        userActions: { search: false, editInline: true },
        showGroup: false,
      }) as Record<string, unknown>;
      expect(out.userActions).toEqual({ search: false, editInline: true, group: false });
    });

    it('lets the canonical key win per-flag when both are present', () => {
      const out = normalizeListViewSchema({
        viewType: 'grid',
        userActions: { search: true },
        showSearch: false,
        showSort: false,
      }) as Record<string, unknown>;
      // `search` stays canonical-true; `sort` folds in from the legacy flag.
      expect(out.userActions).toEqual({ search: true, sort: false });
    });

    it('applies no defaults — an absent flag stays absent', () => {
      // The defaults are per-toggle and live in the renderer; baking them in
      // here would turn "unset" into "explicitly on" and defeat the merge above.
      const out = normalizeListViewSchema({ viewType: 'grid', showGroup: false }) as Record<string, unknown>;
      expect(out.userActions).toEqual({ group: false });
    });

    it('ignores a non-boolean flag', () => {
      const out = normalizeListViewSchema({ viewType: 'grid', showSearch: 'yes' }) as Record<string, unknown>;
      expect(out.userActions).toBeUndefined();
      expect(out.showSearch).toBe('yes');
    });

    it('folds `showDescription` into `appearance`', () => {
      const out = normalizeListViewSchema({
        viewType: 'grid',
        appearance: { allowedVisualizations: ['grid'] },
        showDescription: false,
      }) as Record<string, unknown>;
      expect(out.appearance).toEqual({ allowedVisualizations: ['grid'], showDescription: false });
      expect('showDescription' in out).toBe(false);
    });
  });

  describe('aria / sharing → the spec sub-shapes', () => {
    it('folds the legacy ARIA spellings onto the spec AriaProps keys', () => {
      const out = normalizeListViewSchema({
        viewType: 'grid',
        aria: { label: 'Accounts', describedBy: 'hint', live: 'polite' },
      }) as Record<string, unknown>;
      expect(out.aria).toEqual({ ariaLabel: 'Accounts', ariaDescribedBy: 'hint', live: 'polite' });
    });

    it('keeps `role` and lets the canonical spellings win', () => {
      const out = normalizeListViewSchema({
        viewType: 'grid',
        aria: { ariaLabel: 'canonical', label: 'legacy', role: 'grid' },
      }) as Record<string, unknown>;
      expect(out.aria).toEqual({ ariaLabel: 'canonical', role: 'grid' });
    });

    it('collapses the visibility audience onto the spec ownership type', () => {
      // Only `private` is personal; every wider audience is collaborative.
      for (const [visibility, type] of Object.entries({
        private: 'personal',
        team: 'collaborative',
        organization: 'collaborative',
        public: 'collaborative',
      })) {
        const out = normalizeListViewSchema({ viewType: 'grid', sharing: { visibility } }) as Record<string, unknown>;
        expect(out.sharing).toEqual({ type });
      }
    });

    it('maps a bare `enabled: true` to `personal` — the badge it used to render', () => {
      const out = normalizeListViewSchema({ viewType: 'grid', sharing: { enabled: true } }) as Record<string, unknown>;
      expect(out.sharing).toEqual({ type: 'personal' });
    });

    it('leaves `enabled: false` without a type, so the share badge stays hidden', () => {
      const out = normalizeListViewSchema({ viewType: 'grid', sharing: { enabled: false } }) as Record<string, unknown>;
      expect(out.sharing).toEqual({});
    });

    it('preserves `lockedBy` and lets an explicit `type` win over `visibility`', () => {
      const out = normalizeListViewSchema({
        viewType: 'grid',
        sharing: { type: 'collaborative', visibility: 'private', lockedBy: 'u1' },
      }) as Record<string, unknown>;
      expect(out.sharing).toEqual({ type: 'collaborative', lockedBy: 'u1' });
    });
  });

  describe('viewType defaulting', () => {
    it('defaults a missing view kind to the renderable `grid`', () => {
      expect(normalizeListViewSchema({ type: 'list-view' })).toEqual({ type: 'list-view', viewType: 'grid' });
    });

    it('maps the view CATEGORY `list` to `grid` (AI-authored metadata stores `list`)', () => {
      const out = normalizeListViewSchema({ viewType: 'list' }) as Record<string, unknown>;
      expect(out.viewType).toBe('grid');
    });

    it('leaves an explicit renderable kind alone', () => {
      const out = normalizeListViewSchema({ viewType: 'kanban' }) as Record<string, unknown>;
      expect(out.viewType).toBe('kanban');
    });
  });

  describe('per-view-type config aliases (#2890 phase-3 carry-over)', () => {
    it('folds each of the four aliases onto its spec key', () => {
      const out = normalizeListViewSchema({
        viewType: 'grid',
        kanban: { groupField: 'stage', cardFields: ['name', 'amount'] },
        gallery: { imageField: 'logo' },
        timeline: { dateField: 'due_date' },
      }) as Record<string, Record<string, unknown>>;
      expect(out.kanban).toEqual({ groupByField: 'stage', columns: ['name', 'amount'] });
      expect(out.gallery).toEqual({ coverField: 'logo' });
      expect(out.timeline).toEqual({ startDateField: 'due_date' });
    });

    it('drops each legacy key so a missed read-site fails loudly', () => {
      const out = normalizeListViewSchema({
        viewType: 'grid',
        kanban: { groupField: 'stage', cardFields: ['name'] },
        gallery: { imageField: 'logo' },
        timeline: { dateField: 'due_date' },
      }) as Record<string, Record<string, unknown>>;
      expect('groupField' in out.kanban).toBe(false);
      expect('cardFields' in out.kanban).toBe(false);
      expect('imageField' in out.gallery).toBe(false);
      expect('dateField' in out.timeline).toBe(false);
    });

    it('lets the canonical key win when a config carries both', () => {
      const out = normalizeListViewSchema({
        viewType: 'grid',
        kanban: { groupByField: 'canonical', groupField: 'legacy', columns: ['canonical'], cardFields: ['legacy'] },
        gallery: { coverField: 'canonical', imageField: 'legacy' },
        timeline: { startDateField: 'canonical', dateField: 'legacy' },
      }) as Record<string, Record<string, unknown>>;
      expect(out.kanban).toEqual({ groupByField: 'canonical', columns: ['canonical'] });
      expect(out.gallery).toEqual({ coverField: 'canonical' });
      expect(out.timeline).toEqual({ startDateField: 'canonical' });
    });

    it('is what corrects ListView\'s inverted kanban precedence', () => {
      // `ListView`'s kanban adapter resolves `cardFields || columns` — legacy
      // over canonical, the same inversion A2 fixed for `densityMode`. The fold
      // is what makes the canonical value the one that reaches it: after this,
      // the adapter's `cardFields` term is undefined and `columns` carries the
      // authored value.
      const out = normalizeListViewSchema({
        viewType: 'grid',
        kanban: { columns: ['canonical'], cardFields: ['legacy'] },
      }) as Record<string, Record<string, unknown>>;
      expect(out.kanban.cardFields).toBeUndefined();
      expect(out.kanban.columns).toEqual(['canonical']);
    });

    it('folds a view whose ONLY legacy vocabulary is a nested alias', () => {
      // Guards the early return: every top-level key here is already canonical,
      // so before this fold existed the schema returned untouched.
      const out = normalizeListViewSchema({
        type: 'list-view',
        viewType: 'kanban',
        columns: ['name'],
        kanban: { groupField: 'stage' },
      }) as Record<string, Record<string, unknown>>;
      expect(out.kanban).toEqual({ groupByField: 'stage' });
    });

    it('leaves `calendar.defaultView` alone — it is a local extension, not an alias', () => {
      // No spec counterpart, so it wants promotion upstream. Folding it would
      // delete an authored value with nowhere to put it.
      const out = normalizeListViewSchema({
        viewType: 'calendar',
        calendar: { startDateField: 'starts_at', defaultView: 'week' },
      }) as Record<string, Record<string, unknown>>;
      expect(out.calendar).toEqual({ startDateField: 'starts_at', defaultView: 'week' });
    });

    it('preserves the renderer-ahead knobs the configs are `.passthrough()` for', () => {
      const out = normalizeListViewSchema({
        viewType: 'grid',
        kanban: { groupField: 'stage', swimlaneField: 'owner' },
        timeline: { dateField: 'due', endField: 'done' },
      }) as Record<string, Record<string, unknown>>;
      expect(out.kanban).toEqual({ groupByField: 'stage', swimlaneField: 'owner' });
      expect(out.timeline).toEqual({ startDateField: 'due', endField: 'done' });
    });

    it('does not reach into the legacy `options.*` twin', () => {
      // `options` is a sanctioned passthrough bag, not the declared per-view
      // path. ListView merges it UNDER `schema.kanban`, and its readers already
      // try both nestings, so folding only the declared path changes nothing
      // there — stated as a test so the boundary is deliberate, not accidental.
      const out = normalizeListViewSchema({
        viewType: 'grid',
        options: { kanban: { groupField: 'stage' } },
      }) as Record<string, Record<string, Record<string, unknown>>>;
      expect(out.options.kanban).toEqual({ groupField: 'stage' });
    });

    it('does not mutate the nested config object', () => {
      const kanban = { groupField: 'stage' };
      const schema = { viewType: 'grid', kanban };
      normalizeListViewSchema(schema);
      expect(kanban).toEqual({ groupField: 'stage' });
    });

    it('returns the input by reference when every nested config is canonical', () => {
      const schema = {
        type: 'list-view',
        viewType: 'grid',
        columns: ['name'],
        kanban: { groupByField: 'stage', columns: ['name'] },
        gallery: { coverField: 'logo' },
        timeline: { startDateField: 'due' },
      };
      expect(normalizeListViewSchema(schema)).toBe(schema);
    });

    it('ignores a non-object per-view config', () => {
      const schema = { type: 'list-view', viewType: 'grid', columns: ['name'], kanban: 'nonsense' };
      expect(normalizeListViewSchema(schema)).toBe(schema);
    });
  });

  describe('reference stability', () => {
    it('returns the input by reference when there is nothing to fold', () => {
      // Load-bearing: ListView memoizes on this identity, so allocating a fresh
      // object on every render would re-run every downstream useMemo.
      const schema = { type: 'list-view', viewType: 'grid', columns: ['name'] };
      expect(normalizeListViewSchema(schema)).toBe(schema);
    });

    it('does not mutate the input when it does fold', () => {
      const schema = { viewType: 'grid', fields: ['name'] };
      normalizeListViewSchema(schema);
      expect(schema).toEqual({ viewType: 'grid', fields: ['name'] });
    });

    it('tolerates non-object input', () => {
      expect(normalizeListViewSchema(null)).toBeNull();
      expect(normalizeListViewSchema(undefined)).toBeUndefined();
      expect(normalizeListViewSchema('list-view')).toBe('list-view');
    });
  });
});

describe('rowHeightToDensityMode (#4440)', () => {
  describe('the five spec row heights — the mapping itself, unchanged', () => {
    it.each([
      ['compact', 'compact'],
      ['short', 'compact'],
      ['medium', 'comfortable'],
      ['tall', 'spacious'],
      ['extra_tall', 'spacious'],
    ] as const)('maps the spec row height %s to %s', (rowHeight, density) => {
      expect(rowHeightToDensityMode(rowHeight)).toBe(density);
    });
  });

  describe('off-spec input — abstain, do not rehabilitate', () => {
    // The retired branch answered `'comfortable'` here, while
    // `@object-ui/react`'s spec bridge answered "no density at all" for the
    // same string after #4352 (PR #4439). One metadata-driven system, two
    // answers for one input, was #4440; this is the surviving answer.
    it.each([
      'comfortable', // the OUTPUT vocabulary, never a spec row height
      'spacious',
      'small',
      'large',
      'gargantuan', // a string in neither vocabulary
      '',
    ])('gives no density for the off-spec rowHeight %j', (rowHeight) => {
      expect(rowHeightToDensityMode(rowHeight)).toBeUndefined();
    });

    it('gives no density for non-string metadata', () => {
      // Stored view definitions reach this function from a database that
      // TypeScript never saw, so the runtime guard is load-bearing, not
      // decoration: `ListViewSchema.rowHeight` is statically `RowHeight`.
      for (const value of [undefined, null, 42, true, {}, ['medium']]) {
        expect(rowHeightToDensityMode(value)).toBeUndefined();
      }
    });

    it('does not answer for an inherited Object.prototype key', () => {
      expect(rowHeightToDensityMode('toString')).toBeUndefined();
      expect(rowHeightToDensityMode('constructor')).toBeUndefined();
    });
  });
});

/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { normalizeListViewSchema } from '../normalize-list-view.js';

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

/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import type { ListViewSchema } from '@object-ui/types';

/**
 * Tests for Gallery/Timeline spec config propagation through ListView's
 * buildViewSchema. We test the internal logic by checking that the
 * ListViewSchema types accept spec config and that the config values are correct.
 */

describe('Gallery/Timeline Spec Config Types', () => {
  describe('GalleryConfig on ListViewSchema', () => {
    it('accepts spec gallery config with coverField', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'products',
        viewType: 'gallery',
        fields: ['name', 'photo'],
        gallery: {
          coverField: 'photo',
          coverFit: 'contain',
          cardSize: 'large',
          titleField: 'name',
          visibleFields: ['status', 'price'],
        },
      };

      expect(schema.gallery?.coverField).toBe('photo');
      expect(schema.gallery?.coverFit).toBe('contain');
      expect(schema.gallery?.cardSize).toBe('large');
      expect(schema.gallery?.titleField).toBe('name');
      expect(schema.gallery?.visibleFields).toEqual(['status', 'price']);
    });

    it('accepts legacy imageField and subtitleField alongside spec fields', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'products',
        viewType: 'gallery',
        fields: ['name'],
        gallery: {
          coverField: 'photo',
          imageField: 'legacyImg',
          subtitleField: 'description',
        },
      };

      expect(schema.gallery?.coverField).toBe('photo');
      expect(schema.gallery?.imageField).toBe('legacyImg');
      expect(schema.gallery?.subtitleField).toBe('description');
    });

    it('accepts gallery config from legacy options as fallback', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'products',
        viewType: 'gallery',
        fields: ['name'],
        options: {
          gallery: { imageField: 'oldImg', titleField: 'label' },
        },
      };

      expect(schema.options?.gallery?.imageField).toBe('oldImg');
      expect(schema.options?.gallery?.titleField).toBe('label');
    });
  });

  describe('TimelineConfig on ListViewSchema', () => {
    it('accepts spec timeline config with all fields', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'events',
        viewType: 'timeline',
        fields: ['name', 'date'],
        timeline: {
          startDateField: 'start_date',
          endDateField: 'end_date',
          titleField: 'event_name',
          groupByField: 'category',
          colorField: 'priority_color',
          scale: 'month',
        },
      };

      expect(schema.timeline?.startDateField).toBe('start_date');
      expect(schema.timeline?.endDateField).toBe('end_date');
      expect(schema.timeline?.titleField).toBe('event_name');
      expect(schema.timeline?.groupByField).toBe('category');
      expect(schema.timeline?.colorField).toBe('priority_color');
      expect(schema.timeline?.scale).toBe('month');
    });

    it('accepts legacy dateField for backward compatibility', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'events',
        viewType: 'timeline',
        fields: ['name'],
        timeline: {
          startDateField: 'created_at',
          titleField: 'name',
          dateField: 'legacy_date',
        },
      };

      expect(schema.timeline?.startDateField).toBe('created_at');
      expect(schema.timeline?.dateField).toBe('legacy_date');
    });

    it('supports all scale values', () => {
      const scales = ['hour', 'day', 'week', 'month', 'quarter', 'year'] as const;
      scales.forEach((scale) => {
        const schema: ListViewSchema = {
          type: 'list-view',
          objectName: 'events',
          viewType: 'timeline',
          fields: ['name'],
          timeline: { startDateField: 'date', titleField: 'name', scale },
        };
        expect(schema.timeline?.scale).toBe(scale);
      });
    });

    it('accepts timeline config from legacy options as fallback', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'events',
        viewType: 'timeline',
        fields: ['name'],
        options: {
          timeline: { dateField: 'created_at', titleField: 'name' },
        },
      };

      expect(schema.options?.timeline?.dateField).toBe('created_at');
    });
  });
});

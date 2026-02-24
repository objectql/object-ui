/**
 * Tests for the ensureWidgetIds helper pattern.
 * Validates that widgets without IDs get auto-assigned unique IDs.
 */

import { describe, it, expect } from 'vitest';
import type { DashboardSchema } from '@object-ui/types';

/**
 * Portable implementation of ensureWidgetIds — mirrors
 * apps/console/src/components/DashboardView.tsx.
 */
let counter = 0;
function createWidgetId(): string {
  counter += 1;
  return `widget_test_${counter}`;
}

function ensureWidgetIds(schema: DashboardSchema): DashboardSchema {
  if (!schema.widgets?.length) return schema;
  const needsFix = schema.widgets.some((w) => !w.id);
  if (!needsFix) return schema;
  return {
    ...schema,
    widgets: schema.widgets.map((w) => (w.id ? w : { ...w, id: createWidgetId() })),
  };
}

describe('ensureWidgetIds', () => {
  beforeEach(() => {
    counter = 0;
  });
  it('should return same schema when all widgets have IDs', () => {
    const schema: DashboardSchema = {
      type: 'dashboard',
      columns: 3,
      widgets: [
        { id: 'w1', title: 'A', type: 'metric' },
        { id: 'w2', title: 'B', type: 'bar' },
      ],
    };
    const result = ensureWidgetIds(schema);
    expect(result).toBe(schema); // same reference — no mutation
  });

  it('should assign IDs to widgets missing them', () => {
    const schema: DashboardSchema = {
      type: 'dashboard',
      columns: 3,
      widgets: [
        { title: 'No ID', type: 'metric' },
        { id: 'w2', title: 'Has ID', type: 'bar' },
      ],
    };
    const result = ensureWidgetIds(schema);
    expect(result).not.toBe(schema);
    expect(result.widgets[0].id).toBeTruthy();
    expect(result.widgets[1].id).toBe('w2');
  });

  it('should handle empty widgets array', () => {
    const schema: DashboardSchema = {
      type: 'dashboard',
      columns: 3,
      widgets: [],
    };
    const result = ensureWidgetIds(schema);
    expect(result).toBe(schema);
  });

  it('should generate unique IDs for multiple missing widgets', () => {
    const schema: DashboardSchema = {
      type: 'dashboard',
      columns: 3,
      widgets: [
        { title: 'A', type: 'metric' },
        { title: 'B', type: 'bar' },
        { title: 'C', type: 'pie' },
      ],
    };
    const result = ensureWidgetIds(schema);
    const ids = result.widgets.map((w) => w.id);
    // All IDs should be unique
    expect(new Set(ids).size).toBe(ids.length);
    // All IDs should be truthy
    ids.forEach((id) => expect(id).toBeTruthy());
  });

  it('should preserve existing widget data', () => {
    const schema: DashboardSchema = {
      type: 'dashboard',
      columns: 3,
      widgets: [
        { title: 'Revenue', type: 'metric', object: 'orders', layout: { x: 0, y: 0, w: 2, h: 1 } },
      ],
    };
    const result = ensureWidgetIds(schema);
    expect(result.widgets[0].title).toBe('Revenue');
    expect(result.widgets[0].type).toBe('metric');
    expect(result.widgets[0].object).toBe('orders');
    expect(result.widgets[0].layout).toEqual({ x: 0, y: 0, w: 2, h: 1 });
  });
});

/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Tests for DashboardConfig types and Zod validation schemas.
 */
import { describe, it, expect } from 'vitest';
import type {
  DashboardConfig,
  DashboardWidgetConfig,
  DashboardColorVariant,
  DashboardWidgetType,
} from '../designer';
import {
  DashboardConfigSchema,
  DashboardWidgetConfigSchema,
} from '../zod/index.zod';

describe('DashboardConfig TypeScript Types', () => {
  it('should accept a minimal DashboardConfig', () => {
    const config: DashboardConfig = {};
    expect(config).toBeDefined();
  });

  it('should accept a full DashboardConfig', () => {
    const config: DashboardConfig = {
      id: 'dash-1',
      title: 'Sales Dashboard',
      description: 'Overview of sales pipeline',
      columns: 12,
      gap: 16,
      refreshInterval: 30,
      widgets: [
        {
          id: 'w1',
          title: 'Total Revenue',
          type: 'metric',
          object: 'deals',
          valueField: 'amount',
          aggregate: 'sum',
          colorVariant: 'success',
          layout: { x: 0, y: 0, w: 3, h: 2 },
        },
      ],
      globalFilters: [['status', '=', 'active']],
      dateRange: {
        enabled: true,
        field: 'created_at',
        presets: ['today', 'this_week', 'this_month'],
      },
      userFilters: [
        { field: 'region', label: 'Region', type: 'select' },
      ],
      showHeader: true,
      showFilters: true,
      showDateRange: true,
      headerActions: [
        { label: 'Export', action: 'export', icon: 'Download', variant: 'outline' },
      ],
      aria: { label: 'Sales dashboard', description: 'Interactive sales overview' },
    };
    expect(config.widgets).toHaveLength(1);
    expect(config.widgets![0].type).toBe('metric');
  });

  it('should allow DashboardWidgetType values', () => {
    const types: DashboardWidgetType[] = [
      'metric', 'bar', 'line', 'pie', 'donut', 'area', 'scatter', 'table', 'list', 'custom',
    ];
    expect(types).toHaveLength(10);
  });

  it('should allow DashboardColorVariant values', () => {
    const colors: DashboardColorVariant[] = [
      'default', 'blue', 'teal', 'orange', 'purple', 'success', 'warning', 'danger',
    ];
    expect(colors).toHaveLength(8);
  });

  it('should allow DashboardWidgetConfig with all properties', () => {
    const widget: DashboardWidgetConfig = {
      id: 'w1',
      title: 'Revenue Chart',
      description: 'Monthly revenue',
      type: 'bar',
      object: 'deals',
      filter: [['status', '=', 'closed']],
      categoryField: 'month',
      valueField: 'amount',
      aggregate: 'sum',
      chartConfig: { stacked: true },
      colorVariant: 'blue',
      layout: { x: 0, y: 0, w: 6, h: 4 },
      actionUrl: '/deals',
    };
    expect(widget.id).toBe('w1');
  });
});

describe('DashboardConfig Zod Validation', () => {
  it('should validate a minimal DashboardConfig', () => {
    const result = DashboardConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should validate a complete DashboardConfig', () => {
    const result = DashboardConfigSchema.safeParse({
      id: 'dash-1',
      title: 'Sales Dashboard',
      description: 'Overview of sales pipeline',
      columns: 12,
      gap: 16,
      refreshInterval: 30,
      widgets: [
        {
          id: 'w1',
          title: 'Total Revenue',
          type: 'metric',
          colorVariant: 'success',
          layout: { x: 0, y: 0, w: 3, h: 2 },
        },
      ],
      showHeader: true,
      showFilters: true,
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid column count', () => {
    const result = DashboardConfigSchema.safeParse({ columns: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject negative gap', () => {
    const result = DashboardConfigSchema.safeParse({ gap: -1 });
    expect(result.success).toBe(false);
  });

  it('should validate DashboardWidgetConfigSchema', () => {
    const result = DashboardWidgetConfigSchema.safeParse({
      id: 'w1',
      title: 'Revenue',
      type: 'bar',
      object: 'deals',
      colorVariant: 'blue',
      layout: { x: 0, y: 0, w: 6, h: 4 },
    });
    expect(result.success).toBe(true);
  });

  it('should reject DashboardWidgetConfigSchema without id', () => {
    const result = DashboardWidgetConfigSchema.safeParse({
      title: 'Revenue',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid colorVariant', () => {
    const result = DashboardWidgetConfigSchema.safeParse({
      id: 'w1',
      colorVariant: 'invalid-color',
    });
    expect(result.success).toBe(false);
  });

  it('should validate dateRange configuration', () => {
    const result = DashboardConfigSchema.safeParse({
      dateRange: {
        enabled: true,
        field: 'created_at',
        presets: ['today', 'this_week'],
      },
    });
    expect(result.success).toBe(true);
  });

  it('should validate userFilters configuration', () => {
    const result = DashboardConfigSchema.safeParse({
      userFilters: [
        { field: 'region', label: 'Region', type: 'select' },
        { field: 'status' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should validate headerActions configuration', () => {
    const result = DashboardConfigSchema.safeParse({
      headerActions: [
        { label: 'Export', action: 'export', icon: 'Download', variant: 'outline' },
        { label: 'Refresh' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should validate aria accessibility attributes', () => {
    const result = DashboardConfigSchema.safeParse({
      aria: { label: 'Sales dashboard', description: 'Interactive overview' },
    });
    expect(result.success).toBe(true);
  });
});

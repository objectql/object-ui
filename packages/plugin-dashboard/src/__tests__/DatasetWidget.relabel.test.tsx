// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Regression for cloud#667: a dataset chart grouped by a `select` field whose
 * stored value is English (active/lost/potential) but whose option labels are
 * localized (合作中/已流失/潜在) rendered every bar at 0 — the value-keyed groups
 * never lined up with the label axis. The widget must resolve value→label from
 * the object field options BEFORE charting, keying by value so each count lands
 * on the right (now label-displayed) category.
 *
 * We register a stub `chart` component to capture the schema the widget hands
 * the renderer, rather than asserting on Recharts' SVG (which doesn't lay out
 * in jsdom). This exercises the REAL DatasetWidget + SchemaRenderer.
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { ComponentRegistry } from '@object-ui/core';
import { DatasetWidget } from '../DatasetWidget';

let capturedChartSchema: any = null;
beforeAll(() => {
  ComponentRegistry.register('chart', (props: any) => {
    capturedChartSchema = props?.schema;
    return null;
  });
});
afterEach(() => {
  cleanup();
  capturedChartSchema = null;
  vi.restoreAllMocks();
});

const valueKeyedSource = () => ({
  // The analytics layer grouped by the stored VALUE (English enum).
  queryDataset: vi.fn(async () => ({
    rows: [
      { status: 'active', count: 6 },
      { status: 'lost', count: 2 },
      { status: 'potential', count: 4 },
    ],
    fields: [
      { name: 'status', type: 'select', label: '状态' },
      { name: 'count', type: 'number', label: '数量' },
    ],
    object: 'tk5f_customer',
    dimensionFields: { status: 'status' },
  })),
});

describe('DatasetWidget select-dimension relabeling (cloud#667)', () => {
  it('shows the option LABEL on the axis while the value-keyed count stays attached', async () => {
    const src = valueKeyedSource();
    // The object field: English values + localized labels (AI-build default).
    const objectSchema = {
      item: {
        name: 'tk5f_customer',
        fields: {
          status: {
            type: 'select',
            options: [
              { value: 'active', label: '合作中' },
              { value: 'lost', label: '已流失' },
              { value: 'potential', label: '潜在' },
            ],
          },
        },
      },
    };
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => objectSchema })) as any;

    render(
      <DatasetWidget
        widget={{ type: 'bar', dataset: 'tk5f_customer_ds', dimensions: ['status'], values: ['count'] }}
        dataSource={src}
      />,
    );

    // The object-schema fetch resolves → dimensionLabels → relabel re-render.
    await waitFor(() => {
      expect(capturedChartSchema).toBeTruthy();
      const byCategory = Object.fromEntries(
        (capturedChartSchema.data || []).map((r: any) => [r.status, r.count]),
      );
      // Every count lands on its LABEL category — the bug zeroed all of these.
      expect(byCategory).toEqual({ 合作中: 6, 已流失: 2, 潜在: 4 });
    });
    // The raw English value must not leak onto the axis.
    const categories = (capturedChartSchema.data || []).map((r: any) => r.status);
    expect(categories).not.toContain('active');
    expect(capturedChartSchema.xAxisKey).toBe('status');
    // The object field options were fetched to build the value→label map.
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/meta/object/tk5f_customer',
      expect.anything(),
    );
  });

  it('passes raw rows through unchanged (no crash) when the object schema is unavailable', async () => {
    const src = valueKeyedSource();
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as any;

    render(
      <DatasetWidget
        widget={{ type: 'bar', dataset: 'tk5f_customer_ds', dimensions: ['status'], values: ['count'] }}
        dataSource={src}
      />,
    );

    // First chart render carries the raw value-keyed rows; with no options the
    // relabel is a no-op, so the widget never crashes and still plots a value.
    await waitFor(() => {
      expect(capturedChartSchema).toBeTruthy();
      expect(capturedChartSchema.data?.[0]).toMatchObject({ status: 'active', count: 6 });
    });
  });
});

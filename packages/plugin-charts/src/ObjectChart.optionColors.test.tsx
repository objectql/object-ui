/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * objectui#4106 — coverage for ObjectChart's category option-color / dimension
 * label resolution (the "P3" effect at ObjectChart.tsx:328).
 *
 * This effect is where every real-network escape in `plugin-charts` came from:
 * it reads `/api/v1/meta/dataset/<dataset>` and `/api/v1/meta/object/<object>`
 * off the global `fetch`, and it is best-effort — any failure is swallowed and
 * leaves the theme palette in place. Under happy-dom those were REAL requests
 * that always failed, so the effect's SUCCESS path had never once executed in
 * this package's suite and nothing asserted the requests at all.
 *
 * These pins give that path its first coverage, from the component's own
 * wiring rather than the helpers' (`buildOptionColorMap` /
 * `buildDimensionLabelMap` / `relabelDimensions` are unit-tested one level
 * down in `@object-ui/core`; what is new here is that ObjectChart asks for the
 * right documents, in the right order, and feeds the results to the renderer).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';

let lastSchema: any = null;

vi.mock('./ChartRenderer', () => ({
  ChartRenderer: (props: any) => {
    lastSchema = props.schema;
    return null;
  },
}));

import { ObjectChart } from './ObjectChart';

/**
 * Records every URL and answers only the documents it is given, so an escape
 * to any other endpoint shows up as a recorded call the assertions reject —
 * never as a swallowed rejection on the real network.
 */
function installMetaFetchDouble(routes: Record<string, unknown> = {}) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const url = String(
        input && typeof input === 'object' && 'url' in input ? (input as { url: unknown }).url : input,
      );
      calls.push(url);
      return { ok: true, json: async () => routes[url] ?? {} };
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  lastSchema = null;
});

beforeEach(() => {
  lastSchema = null;
});

describe('ObjectChart — category option colors (objectui#4106)', () => {
  it('probes the bound object once and paints categories from its field options', async () => {
    const metaCalls = installMetaFetchDouble({
      '/api/v1/meta/object/opportunity': {
        item: {
          name: 'opportunity',
          fields: {
            stage: {
              type: 'select',
              options: [
                { value: 'won', label: 'Won', color: '#16a34a' },
                { value: 'lost', label: 'Lost', color: '#dc2626' },
              ],
            },
          },
        },
      },
    });

    render(
      <ObjectChart
        schema={{
          type: 'object-chart',
          chartType: 'bar',
          objectName: 'opportunity',
          xAxisKey: 'stage',
          data: [
            { stage: 'won', amount: 42 },
            { stage: 'lost', amount: 7 },
          ],
        }}
        dataSource={{ find: async () => ({ data: [] }) }}
      />,
    );

    // The option colors reach the renderer as `categoryColors`, keyed by BOTH
    // the stored value and the display label (either can key a category).
    await waitFor(() => expect(lastSchema?.categoryColors).toBeTruthy());
    expect(lastSchema.categoryColors).toMatchObject({
      won: '#16a34a',
      Won: '#16a34a',
      lost: '#dc2626',
      Lost: '#dc2626',
    });

    // Exactly one document, and no second/dataset hop for an object-bound chart.
    expect(metaCalls).toEqual(['/api/v1/meta/object/opportunity']);
  });

  it('resolves a dataset chart through its definition to the underlying object', async () => {
    const metaCalls = installMetaFetchDouble({
      '/api/v1/meta/dataset/showcase_task_metrics': {
        item: {
          name: 'showcase_task_metrics',
          object: 'task',
          dimensions: [{ name: 'status', field: 'status' }],
        },
      },
      '/api/v1/meta/object/task': {
        item: {
          name: 'task',
          fields: {
            status: {
              type: 'select',
              options: [
                { value: 'todo', label: 'To do' },
                { value: 'done', label: 'Done' },
              ],
            },
          },
        },
      },
    });

    render(
      <ObjectChart
        schema={{
          type: 'object-chart',
          chartType: 'bar',
          dataset: 'showcase_task_metrics',
          dimensions: ['status'],
          values: ['task_count'],
        }}
        dataSource={{
          queryDataset: vi.fn().mockResolvedValue({
            rows: [{ status: 'todo', task_count: 3 }],
            fields: [
              { name: 'status', label: 'Status' },
              { name: 'task_count', label: 'Tasks' },
            ],
          }),
        }}
      />,
    );

    // Two hops, IN ORDER: the dataset definition names the object, and only
    // then can the object's field options be read. The order is the wiring —
    // reversing it would mean fetching an object nothing has named yet.
    await waitFor(() => expect(metaCalls).toHaveLength(2));
    expect(metaCalls).toEqual([
      '/api/v1/meta/dataset/showcase_task_metrics',
      '/api/v1/meta/object/task',
    ]);

    // The value→label map built from the object's options is applied to the
    // dataset rows, so the axis shows "To do" rather than the stored `todo`.
    await waitFor(() => expect(lastSchema?.data?.[0]?.status).toBe('To do'));
  });

  it('keeps the theme palette when the object document carries no options', async () => {
    // The pre-fix observable state: the probe fails (or answers nothing
    // useful), the effect swallows it, and no categoryColors are handed down.
    // Pinned so the "best-effort" contract cannot regress into a hard failure.
    const metaCalls = installMetaFetchDouble({
      '/api/v1/meta/object/opportunity': { item: { name: 'opportunity', fields: {} } },
    });

    render(
      <ObjectChart
        schema={{
          type: 'object-chart',
          chartType: 'bar',
          objectName: 'opportunity',
          xAxisKey: 'stage',
          data: [{ stage: 'won', amount: 42 }],
        }}
        dataSource={{ find: async () => ({ data: [] }) }}
      />,
    );

    await waitFor(() => expect(lastSchema).not.toBeNull());
    expect(lastSchema.categoryColors).toBeUndefined();
    expect(metaCalls).toEqual(['/api/v1/meta/object/opportunity']);
  });
});

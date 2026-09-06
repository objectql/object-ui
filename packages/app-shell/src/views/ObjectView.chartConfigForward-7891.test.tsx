/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7891 — `ObjectView`'s dedicated chart-view route forwarded
 * `chart.config` onto the `object-chart` node it builds, on BOTH branches:
 *
 *     schema={{ type: 'object-chart', …, config: chartConfig.config, … } as any}
 *
 * ## Why that rung was a channel nobody could feed
 *
 * `@objectstack/spec`'s `ListChartConfigSchema` is a `strictObject` whose
 * declared keys are exactly `chartType` / `dataset` / `dimensions` / `values`,
 * and objectui binds that schema BY REFERENCE — `chart` is absent from
 * `LIST_VIEW_LOCAL_OVERRIDES` (`packages/types/src/zod/objectql.zod.ts`), so
 * `ListViewSchema.chart` IS the spec's strict schema. Measured against the
 * published `@objectstack/spec@17.2.0` this repo resolves, a whole view body
 * carrying the key is refused by name:
 *
 *     unrecognized_keys keys=["config"] path=["config","chart"]
 *
 * and that is not a client-side opinion — it is the SAME schema the platform's
 * metadata write door parses every save through (`saveMetaItem` ->
 * `resolveOverlaySchema` -> `getMetadataTypeSchema('view')`, answering
 * `422 INVALID_METADATA`, on draft and publish alike, `force` or not). So no
 * conforming author could write the key and no write path could store it: the
 * forward was not one rendering of a legal declaration, it was a second
 * UNDECLARED channel — and `ObjectChartSchema` does not declare `config`
 * either, so it landed on a node that had no name for it.
 *
 * ## Why nothing caught it, and why the casts went with it
 *
 * `ObjectChart` is published as `(props: any)`, so the literal was type-checked
 * against nothing at all. The `as any` on both literals was therefore INERT,
 * not load-bearing — measured: `tsc --noEmit` over a program that provably
 * contains `ObjectView.tsx` is green with both casts removed. Leaving an inert
 * cast sitting exactly where the defect lived is what invites the next reader
 * to assume the shape was checked.
 *
 * ## What this file pins, and what it deliberately does not
 *
 * It reads the schema `ObjectView` HANDS DOWN, on each of the two branches —
 * not what `ChartRenderer` does with it. `'config' in schema` is the assertion
 * rather than `toBeUndefined()`, because the removed line emitted a PRESENT
 * `config: undefined` key for every chart view, authored or not; `undefined`
 * would have passed against the very defect.
 *
 * The positive controls are not decoration: without them a pin asserting only
 * an ABSENCE goes green when nothing renders at all.
 *
 * ## Direction, written before the run (reverse verification)
 *
 * Re-injecting `config: chartConfig.config,` into either literal was PREDICTED
 * to turn that branch's absence arm RED while leaving every positive control
 * GREEN. Measured — see the PR body for the run.
 *
 * ## Not a break, a degrade
 *
 * `ChartRenderer` generates a container config from `series` plus a positional
 * palette when none is present, so a non-conforming row that somehow existed
 * still renders — with series-derived labels and default colours.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('@object-ui/permissions', () => ({
  usePermissions: () => ({
    check: () => ({ allowed: true }),
    checkField: () => true,
    getFieldPermissions: () => [],
    getRowFilter: () => undefined,
    getObjectApiOperations: () => undefined,
    roles: [],
    isLoaded: false,
    hasCapabilities: () => true,
    can: () => true,
    cannot: () => false,
  }),
  useFieldPermissions: () => ({ canRead: () => true, canWrite: () => true, permissions: [] }),
}));

vi.mock('@object-ui/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Ada' }, activeOrganization: null }),
  useWorkspaceAdminStatus: () => ({ isAdmin: false, isResolved: true }),
  createAuthenticatedFetch: () => vi.fn(),
}));

vi.mock('@object-ui/collaboration', () => ({
  useRealtimeSubscription: () => ({ lastMessage: null }),
  useConflictResolution: () => ({ hasConflicts: false, resolveAllConflicts: () => {} }),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(), error: vi.fn(), info: vi.fn(),
    warning: vi.fn(), loading: vi.fn(), dismiss: vi.fn(),
  }),
}));

/**
 * The `object-chart` node this file builds — captured on the way INTO
 * `ObjectChart`, which is where the removed rung wrote. `ObjectView` reaches it
 * through `lazy(() => import('@object-ui/plugin-charts'))`, so the module mock
 * is what the dynamic import resolves to.
 */
let capturedChartSchema: any = null;
vi.mock('@object-ui/plugin-charts', () => ({
  ObjectChart: (props: any) => {
    capturedChartSchema = props.schema;
    return null;
  },
  ChartRenderer: () => null,
}));

vi.mock('@object-ui/plugin-view', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ObjectView: (props: any) =>
    props.renderListView?.({
      schema: { ...(props.schema ?? {}) },
      dataSource: props.dataSource,
      onEdit: props.onEdit,
      className: '',
      refreshKey: 0,
    }) ?? null,
  ViewTabBar: () => null,
  ManageViewsDialog: () => null,
}));

vi.mock('./MetadataInspector', () => ({
  MetadataPanel: () => null,
  useMetadataInspector: () => ({ showDebug: false, toggle: () => {} }),
}));
vi.mock('./RecordDetailView', () => ({ RecordDetailView: () => null }));

import { ObjectView } from './ObjectView';
import { ExpressionProvider } from '../providers/ExpressionProvider';

const OBJECT_NAME = 'duly_task';

/**
 * The off-spec value an author would have had to write for the removed rung to
 * carry anything. Kept here so the arms below read as one question: does this
 * key reach the node? It must not — the protocol refuses it by name.
 */
const OFF_SPEC_CONFIG = { hours: { label: 'Hours logged', color: '#8884d8' } };

/** ADR-0021 (#1890) dataset binding — `ObjectView`'s FIRST chart branch. */
const DATASET_BLOCK = {
  dataset: 'task_throughput',
  dimensions: ['status'],
  values: ['hours'],
  chartType: 'bar',
};

/** The pre-ADR-0021 inline spelling — `ObjectView`'s SECOND (legacy) branch. */
const LEGACY_BLOCK = {
  chartType: 'line',
  xAxisField: 'status',
  yAxisFields: ['hours'],
  aggregation: 'sum',
};

function objectsWith(chart: Record<string, unknown>) {
  return [
    {
      name: OBJECT_NAME,
      label: 'Task',
      fields: {
        id: { type: 'text', label: 'Id' },
        name: { type: 'text', label: 'Name' },
        status: { type: 'text', label: 'Status' },
        hours: { type: 'number', label: 'Hours' },
      },
      listViews: {
        by_unit: { label: 'By business unit', type: 'chart', columns: ['name'], chart },
      },
    },
  ];
}

function makeDataSource() {
  return {
    find: vi.fn(async () => ({ data: [], total: 0 })),
    findOne: vi.fn(async () => null),
    create: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    getObjectSchema: vi.fn(async () => ({ name: OBJECT_NAME, fields: {} })),
  } as any;
}

/** Mount the dedicated chart view for one authored block and capture the node. */
async function mountChartView(chart: Record<string, unknown>) {
  capturedChartSchema = null;
  const dataSource = makeDataSource();
  render(
    <ExpressionProvider user={{ id: 'u1', name: 'Ada', profile: 'admin' }}>
      <MemoryRouter initialEntries={[`/apps/demo/${OBJECT_NAME}`]}>
        <Routes>
          <Route
            path="/apps/:appName/:objectName"
            element={<ObjectView dataSource={dataSource} objects={objectsWith(chart)} onEdit={() => {}} />}
          />
        </Routes>
      </MemoryRouter>
    </ExpressionProvider>,
  );
  // `type` is set by the same object literal the rung sat in, so its arrival is
  // the signal that the branch actually ran.
  await waitFor(() => {
    expect(capturedChartSchema?.type).toBe('object-chart');
  });
  return capturedChartSchema;
}

beforeEach(() => {
  cleanup();
  capturedChartSchema = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('ObjectView builds no `config` rung on the object-chart node (objectui#7891)', () => {
  it('DATASET BRANCH: an authored `chart.config` does not reach the node', async () => {
    // THE DISCRIMINATING ARM for the first branch. `in` rather than
    // `toBeUndefined()` — the removed line emitted the key PRESENT-and-
    // undefined whenever the author wrote none, so `toBeUndefined()` passed
    // against the defect itself.
    const schema = await mountChartView({ ...DATASET_BLOCK, config: OFF_SPEC_CONFIG });
    expect('config' in schema).toBe(false);
  });

  it('DATASET BRANCH: no `config` key even when the author wrote none', async () => {
    // The everyday population. Under the old literal this key was present on
    // EVERY chart view ever rendered, carrying `undefined`.
    const schema = await mountChartView(DATASET_BLOCK);
    expect('config' in schema).toBe(false);
  });

  it('DATASET BRANCH POSITIVE CONTROL: the declared keys still arrive', async () => {
    // Without this, an absence assertion goes green when nothing renders. It
    // also pins that removing the rung removed ONLY the rung.
    const schema = await mountChartView({ ...DATASET_BLOCK, config: OFF_SPEC_CONFIG });
    expect(schema.dataset).toBe('task_throughput');
    expect(schema.dimensions).toEqual(['status']);
    expect(schema.values).toEqual(['hours']);
    expect(schema.chartType).toBe('bar');
    expect(schema.xAxisKey).toBe('status');
    expect(schema.series).toEqual([{ dataKey: 'hours', label: 'hours' }]);
  });

  it('LEGACY BRANCH: an authored `chart.config` does not reach the node', async () => {
    // THE DISCRIMINATING ARM for the second branch. The two literals are
    // separate code — one arm each, or half the defect stays pinnable.
    const schema = await mountChartView({ ...LEGACY_BLOCK, config: OFF_SPEC_CONFIG });
    expect(schema.dataset).toBeUndefined(); // proves the legacy branch ran
    expect('config' in schema).toBe(false);
  });

  it('LEGACY BRANCH: no `config` key even when the author wrote none', async () => {
    const schema = await mountChartView(LEGACY_BLOCK);
    expect(schema.dataset).toBeUndefined();
    expect('config' in schema).toBe(false);
  });

  it('LEGACY BRANCH POSITIVE CONTROL: the translated keys still arrive', async () => {
    const schema = await mountChartView({ ...LEGACY_BLOCK, config: OFF_SPEC_CONFIG });
    expect(schema.objectName).toBe(OBJECT_NAME);
    expect(schema.chartType).toBe('line');
    expect(schema.aggregate).toEqual({ field: 'hours', function: 'sum', groupBy: 'status' });
    expect(schema.xAxisKey).toBe('status');
    expect(schema.series).toEqual([{ dataKey: 'hours', label: 'hours' }]);
  });
});

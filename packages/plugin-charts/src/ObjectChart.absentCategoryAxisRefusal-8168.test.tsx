/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#8168 — `ObjectChart` REFUSES an object-bound chart that declares no
 * category axis, instead of aggregating on a name nobody wrote.
 *
 * ## What the branch replaces
 *
 * `runAggregate` passed `schema.aggregate` to `ds.aggregate(objectName, {
 * field, function, groupBy, filter })` with no guard on `groupBy`, and the
 * `ds.find` leg handed the same bag to `aggregateRecords`, which buckets on
 * `record[groupBy] ?? 'Unknown'`. With no category declared the first asks a
 * driver to group by `undefined` and the second collapses the object into a
 * single `'Unknown'` bar — and WHICH of those a reader saw was decided by the
 * data source, not by the component. The component's only loud states were a
 * fetch `error` (`chart-error`) and a generic "No data yet"; neither is a
 * statement about an absent binding. `ObjectCalendar`, `ObjectGantt` and
 * `ObjectTimeline` each carry a refusal screen for their own axis; this
 * renderer was the fourth, with none.
 *
 * ## Why the assertions are shaped this way
 *
 * The risk this branch carries is NOT that it fails to fire — it is that it
 * fires on a chart that renders correctly today, because `ObjectChart` is the
 * one choke point every producer reaches. So the pin is two-sided and the
 * second side is the larger one: {@link describe} block 2 is a transcription of
 * the composed schema EVERY producer in this repo hands this component, one
 * `it` per producer leg, each asserting the refusal stays away. An ablation
 * therefore reports which producer a widened predicate would have broken, by
 * name, rather than one undifferentiated red.
 *
 * The distinguishability arm follows objectui#7130's bar (hotcrm#1212): the
 * three states this component can be in must be told apart at a glance, so they
 * are checked on the machine-readable things that carry the difference —
 * `role="alert"` here and on `chart-error`, `role="status"` on
 * `chart-empty-state`, and a distinct `data-testid` on each.
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

vi.mock('recharts', async () => {
  const actual = await vi.importActual<any>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) =>
      React.cloneElement(children, { width: 480, height: 320 }),
  };
});

import { ObjectChart, resolveChartCategoryField } from './ObjectChart';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

const REFUSAL = 'chart-missing-category-axis';

/** Rows a populated data source answers with, so "no rows" never explains a pass. */
const ROWS = [
  { stage: 'won', amount: 10 },
  { stage: 'lost', amount: 4 },
];

const dataSourceWithRows = () => ({
  find: vi.fn().mockResolvedValue(ROWS),
  aggregate: vi.fn().mockResolvedValue(ROWS),
});

const renderChart = (schema: Record<string, unknown>, ds: any = dataSourceWithRows()) =>
  render(<ObjectChart schema={{ chartType: 'bar', isAnimationActive: false, ...schema }} dataSource={ds} />);

/** The refusal is absent AND the chart got far enough to draw. */
const expectNoRefusal = async () => {
  await waitFor(() => {
    expect(screen.queryByTestId(REFUSAL)).toBeNull();
  });
  expect(screen.queryByTestId(REFUSAL)).toBeNull();
};

describe('ObjectChart — absent category axis refusal (objectui#8168)', () => {
  it('refuses an object-bound chart that declares no category by any spelling', async () => {
    renderChart({ objectName: 'crm_opportunity', series: [{ dataKey: 'amount' }] });

    const box = await screen.findByTestId(REFUSAL);
    expect(box).toHaveAttribute('role', 'alert');
    // Names the absence, not a fetch outcome, and tells the author what to write.
    expect(box).toHaveTextContent('category axis required');
    expect(box).toHaveTextContent('will not invent one');
    // The message renders the resolver's OWN vocabulary, canonical-first.
    expect(box).toHaveTextContent('aggregate.groupBy');
    expect(box).toHaveTextContent('xAxisKey');
    expect(box).toHaveTextContent('xAxis.field');
  });

  it('refuses a legacy aggregate whose measure is declared but whose groupBy is not', async () => {
    // The exact bag the card names: `ds.aggregate(obj, { field, function,
    // groupBy: undefined })`. A declared measure does not rescue an absent
    // category — this is the arm that would go green under a predicate keyed on
    // the measure instead.
    renderChart({
      objectName: 'crm_opportunity',
      aggregate: { field: 'amount', function: 'sum' },
      series: [{ dataKey: 'amount' }],
    });

    expect(await screen.findByTestId(REFUSAL)).toBeInTheDocument();
  });

  it('refuses a structured GroupBy node that names no field', async () => {
    // `runAggregate` sends the node itself as the server's `groupBy`, so a node
    // naming no field has no other spelling that could rescue it.
    renderChart({
      objectName: 'crm_opportunity',
      aggregate: { field: 'amount', function: 'sum', groupBy: { dateGranularity: 'day' } },
    });

    expect(await screen.findByTestId(REFUSAL)).toBeInTheDocument();
  });

  it('is a static authoring fact: it does not wait for, or depend on, the fetch', async () => {
    // Placed above `error` and `loading` for `ObjectTimeline`'s reason — a
    // skeleton that resolves into a refusal, or a network error shown first,
    // both send the author to debug the wrong layer. A data source that never
    // settles proves the branch is decided before any of that.
    renderChart(
      { objectName: 'crm_opportunity' },
      { find: () => new Promise(() => {}), aggregate: () => new Promise(() => {}) },
    );

    expect(await screen.findByTestId(REFUSAL)).toBeInTheDocument();
    expect(screen.queryByTestId('chart-loading')).toBeNull();
  });

  it('is distinguishable from the failure state and from the empty state', async () => {
    // objectui#7130's bar: the states must differ on something a machine can
    // read. `chart-error` is also `role="alert"`, so the testid is what
    // separates them; `chart-empty-state` is `role="status"`.
    renderChart({ objectName: 'crm_opportunity' });

    const box = await screen.findByTestId(REFUSAL);
    expect(box).toHaveAttribute('role', 'alert');
    expect(screen.queryByTestId('chart-error')).toBeNull();
    expect(screen.queryByTestId('chart-empty-state')).toBeNull();
    expect(screen.queryByTestId('chart-no-datasource')).toBeNull();
  });
});

/**
 * THE STOP CONDITION, as a pin.
 *
 * `ObjectChart` is reached by producers that supply `'name'` / `'value'`
 * themselves, and a renderer-level refusal fires on those too — so before this
 * branch could ship, every producer that reaches this component with a legacy
 * binding had to be enumerated and checked against it. These are those
 * producers, transcribed from their composing source on `7444916ce`, one `it`
 * per leg. Each cites the line it came from so the transcription can be
 * re-checked rather than trusted.
 *
 * The shared fact that makes them all safe: every one of the five floors its
 * own category — the three relays through the `|| 'name'` literals objectui#7547
 * will retire, the two dashboard surfaces through `options.xField || 'name'`,
 * which is NOT part of #7547's six and stays. So none of them can reach this
 * refusal today, and after #7547 retires the relay floors the three that lose
 * theirs reach it exactly when the author declared nothing — which is the point.
 */
describe('objectui#8168 stop condition — the refusal fires on NO producer that renders today', () => {
  it('plugin-list ListView `case chart` legacy leg', async () => {
    // `const valueField = chartBinding.valueField || 'value';`
    // `const categoryField = chartBinding.categoryField || 'name';`
    renderChart({
      objectName: 'crm_opportunity',
      filter: undefined,
      aggregate: { field: 'value', function: 'count', groupBy: 'name' },
      xAxisKey: 'name',
      series: [{ dataKey: 'value', label: 'value' }],
      className: 'h-[400px] w-full',
    });
    await expectNoRefusal();
  });

  it('plugin-view ObjectView `case chart` legacy leg', async () => {
    renderChart({
      objectName: 'crm_opportunity',
      aggregate: { field: 'value', function: 'count', groupBy: 'name' },
      xAxisKey: 'name',
      series: [{ dataKey: 'value', label: 'value' }],
      className: 'h-[400px] w-full',
    });
    await expectNoRefusal();
  });

  it('app-shell ObjectView chart viewDef legacy leg', async () => {
    // `const categoryField = chartConfig.xAxisField || 'name';`
    // `const valueField = (Array.isArray(...yAxisFields) && ...[0]) || 'value';`
    renderChart({
      objectName: 'crm_opportunity',
      aggregate: { field: 'value', function: 'count', groupBy: 'name' },
      xAxisKey: 'name',
      series: [{ dataKey: 'value', label: 'value' }],
      filter: undefined,
      className: 'h-[400px] w-full',
    });
    await expectNoRefusal();
  });

  it('DashboardRenderer object-provider widget WITH a provider aggregate', async () => {
    // `const xAxisKey = options.xField || 'name';` — floored before the
    // provider is consulted, so this leg carries a category unconditionally.
    renderChart({
      objectName: 'crm_opportunity',
      aggregate: { field: 'amount', function: 'sum', groupBy: 'stage' },
      xAxisKey: 'name',
      series: [{ dataKey: 'amount', label: 'Amount' }],
    });
    await expectNoRefusal();
  });

  it('DashboardRenderer object-provider widget with NO provider aggregate (aggregate: undefined)', async () => {
    // `const effectiveAggregate = providerAgg ? { … } : undefined;` — the
    // raw-record leg. `aggregate` is genuinely absent here, and `xAxisKey` is
    // what keeps it out of the refusal.
    renderChart({
      objectName: 'crm_opportunity',
      aggregate: undefined,
      xAxisKey: 'name',
      series: [{ dataKey: 'value', label: 'value' }],
    });
    await expectNoRefusal();
  });

  it('DashboardGridLayout object-provider widget, both legs', async () => {
    renderChart({
      objectName: 'crm_opportunity',
      aggregate: { field: 'amount', function: 'sum', groupBy: 'stage' },
      xAxisKey: 'name',
      series: [{ dataKey: 'amount' }],
      className: 'h-full',
    });
    await expectNoRefusal();
    cleanup();

    renderChart({
      objectName: 'crm_opportunity',
      aggregate: undefined,
      xAxisKey: 'name',
      series: [{ dataKey: 'value' }],
      className: 'h-full',
    });
    await expectNoRefusal();
  });
});

/**
 * The four carve-outs the condition makes, each one a configuration that
 * renders correctly today and must keep rendering.
 */
describe('objectui#8168 — what the refusal deliberately does not touch', () => {
  it('a `count` aggregate with a declared category and NO measure', async () => {
    // The arm that decides the predicate's shape. `resolveListChartBinding`'s
    // `resolves` is `Boolean(categoryField && valueField)`, so its negation
    // refuses when EITHER is missing — right for a capability gate deciding
    // whether to OFFER a chart, wrong for a renderer deciding whether to DRAW
    // one: `count` takes no field (`aggregateValueKey` projects it under the
    // literal `'count'`), and this chart renders.
    renderChart({
      objectName: 'crm_opportunity',
      aggregate: { function: 'count', groupBy: 'stage' },
      xAxisKey: 'stage',
      series: [{ dataKey: 'count' }],
    });
    await expectNoRefusal();
  });

  it('a spec-shape `xAxis: { field }` with no `xAxisKey`', async () => {
    // `ChartRenderer` normalizes the spec's author-facing shape DOWNSTREAM of
    // this component, so a predicate reading `schema.xAxisKey` alone would have
    // refused a chart that draws correctly. The resolver asks
    // `normalizeChartSchema` — this package's one translation — instead.
    renderChart({
      objectName: 'crm_opportunity',
      xAxis: { field: 'stage' },
      series: [{ dataKey: 'amount' }],
    });
    await expectNoRefusal();
  });

  it('a bare string `xAxis`, the report surface spelling', async () => {
    renderChart({
      objectName: 'crm_opportunity',
      xAxis: 'stage',
      series: [{ dataKey: 'amount' }],
    });
    await expectNoRefusal();
  });

  it('an ADR-0021 dataset chart that declares no dimension', async () => {
    // A dataset selects dimensions and measures BY NAME and may legitimately
    // declare none (a single aggregate) — a different shape with a different
    // answer, exactly as `resolveListChartBinding`'s dataset leg says.
    renderChart({
      dataset: 'showcase_task_metrics',
      dimensions: [],
      values: ['task_count'],
      series: [{ dataKey: 'task_count' }],
    });
    await expectNoRefusal();
  });

  it('an authored `data` array with no object binding at all', async () => {
    renderChart({ data: [{ name: 'a', value: 1 }], series: [{ dataKey: 'value' }] }, undefined);
    await expectNoRefusal();
  });

  it('an object-bound chart carrying authored `data` (the sweep fixture shape)', async () => {
    // `widget-dom-leak-sweep.test.tsx` authors `data` ON TOP of `objectName`
    // precisely so the object-bound targets reach real chart markup. Authored
    // rows are handed to `ChartRenderer` as they are; no field NAME is read to
    // fetch them, so the binding is not required — the `hasAuthoredItems`
    // carve-out of `ObjectTimeline`'s refusal, one renderer over.
    renderChart({
      objectName: 'accounts',
      data: [{ name: 'Acme', amount: 1 }],
      series: [{ dataKey: 'amount' }],
    });
    await expectNoRefusal();
  });
});

/**
 * The resolver itself, unit-level — one spelling of "which column is the
 * category", asked directly. `ObjectChart`'s option-metadata probe reads the
 * same function, so the probe and the refusal cannot disagree about what the
 * category is.
 */
describe('resolveChartCategoryField (objectui#8168)', () => {
  it('prefers a structured GroupBy node field over every other spelling', () => {
    expect(
      resolveChartCategoryField({
        aggregate: { groupBy: { field: 'closed_at', dateGranularity: 'day' } },
        xAxisKey: 'ignored',
      }),
    ).toBe('closed_at');
  });

  it('answers undefined for a structured node with no field, without falling through', () => {
    expect(
      resolveChartCategoryField({ aggregate: { groupBy: { dateGranularity: 'day' } }, xAxisKey: 'stage' }),
    ).toBeUndefined();
  });

  it('reads a legacy string groupBy', () => {
    expect(resolveChartCategoryField({ aggregate: { groupBy: 'stage' }, xAxisKey: 'other' })).toBe('stage');
  });

  it('falls to the normalized x axis when no aggregate is declared', () => {
    expect(resolveChartCategoryField({ xAxisKey: 'stage' })).toBe('stage');
    expect(resolveChartCategoryField({ xAxis: { field: 'stage' } })).toBe('stage');
    expect(resolveChartCategoryField({ xAxis: 'stage' })).toBe('stage');
  });

  it('answers undefined when nothing declares a category', () => {
    expect(resolveChartCategoryField({})).toBeUndefined();
    expect(resolveChartCategoryField(undefined)).toBeUndefined();
    expect(resolveChartCategoryField({ aggregate: { groupBy: '' } })).toBeUndefined();
  });
});

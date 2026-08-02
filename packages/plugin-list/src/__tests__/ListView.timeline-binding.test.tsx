/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#3129 — what ListView hands the timeline renderer.
 *
 * `ListView.test.tsx`'s timeline case only asserts that the Timeline option
 * appears in the view switcher, so the binding it forwards was never checked.
 * These tests register a spy for `object-timeline` and read the resolved props
 * plus the `$select` projection, for each authoring shape the product accepts.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import { ListView } from '../ListView';
import { SchemaRendererProvider } from '@object-ui/react';

const rows = [
  { id: '1', name: 'Spring Launch', start_date: '2099-09-01', end_date: '2099-09-30' },
  { id: '2', name: 'Summer Push', start_date: '2099-10-01', end_date: '2099-10-31' },
];

const objectDef = {
  name: 'crm_campaign',
  label: 'Campaign',
  fields: {
    id: { name: 'id', type: 'text' },
    name: { name: 'name', type: 'text', label: 'Name' },
    start_date: { name: 'start_date', type: 'date', label: 'Start Date' },
    end_date: { name: 'end_date', type: 'date', label: 'End Date' },
  },
};

let captured: Array<Record<string, any>> = [];
let findCalls: Array<Record<string, any>> = [];

ComponentRegistry.register(
  'object-timeline',
  (props: Record<string, any>) => {
    captured.push(props);
    return <div data-testid="timeline-spy" />;
  },
  { namespace: 'test', label: 'Timeline spy', category: 'view' },
);

const makeDataSource = () => ({
  find: vi.fn(async (_object: string, query: Record<string, any>) => {
    findCalls.push(query);
    return rows;
  }),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getObjectSchema: vi.fn(async () => objectDef),
});

const BASE = {
  type: 'list-view',
  objectName: 'crm_campaign',
  viewType: 'timeline',
  columns: ['name'],
} as const;

/** Mount ListView on `schema` and return the props the timeline was given. */
async function timelineProps(schema: Record<string, any>) {
  const dataSource = makeDataSource() as any;
  render(
    <SchemaRendererProvider dataSource={dataSource}>
      <ListView schema={schema as never} dataSource={dataSource} />
    </SchemaRendererProvider>,
  );
  await waitFor(() => expect(captured.length).toBeGreaterThan(0));
  await waitFor(() => expect(findCalls.length).toBeGreaterThan(0));
  return captured[captured.length - 1];
}

describe('ListView — timeline date binding reaches the renderer (objectui#3129)', () => {
  beforeEach(() => {
    captured = [];
    findCalls = [];
  });

  it('forwards the nested spec key `timeline.startDateField`', async () => {
    const props = await timelineProps({
      ...BASE,
      timeline: { startDateField: 'start_date', endDateField: 'end_date', titleField: 'name' },
    });
    expect(props.schema.timeline.startDateField).toBe('start_date');
    expect(props.schema.startDateField).toBe('start_date');
    expect(findCalls[0].$select).toContain('start_date');
  });

  it('forwards the nested LEGACY alias `timeline.dateField`', async () => {
    // The gap this pins: `dateField` was resolved out of `options.timeline` but
    // NOT out of the spec-canonical `schema.timeline`, so the flat prop fell
    // through to `created_at` — a field the projection does not request, which
    // is why the timeline rendered every record under "No date" even though the
    // rows carried the configured date all along.
    const props = await timelineProps({ ...BASE, timeline: { dateField: 'start_date' } });
    expect(props.schema.startDateField).toBe('start_date');
    expect(findCalls[0].$select).toContain('start_date');
  });

  it('forwards the legacy `options.timeline` nesting (both keys)', async () => {
    const viaStart = await timelineProps({
      ...BASE,
      options: { timeline: { startDateField: 'start_date', endDateField: 'end_date' } },
    });
    expect(viaStart.schema.startDateField).toBe('start_date');

    captured = [];
    findCalls = [];
    const viaAlias = await timelineProps({ ...BASE, options: { timeline: { dateField: 'start_date' } } });
    expect(viaAlias.schema.startDateField).toBe('start_date');
  });

  it('offers the Timeline visualization for a config using only the alias', async () => {
    // The capability gate had the same vocabulary gap, so a grid view carrying
    // only the aliased timeline config never offered the Timeline option.
    const dataSource = makeDataSource() as any;
    render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ListView
          schema={{ ...BASE, viewType: 'grid', timeline: { dateField: 'start_date' } } as never}
          dataSource={dataSource}
          showViewSwitcher
        />
      </SchemaRendererProvider>,
    );
    const trigger = screen.queryByTestId('view-switcher-dropdown');
    if (trigger) fireEvent.click(trigger);
    const option =
      screen.queryByRole('tab', { name: 'Timeline' }) ?? screen.queryByRole('button', { name: 'Timeline' });
    expect(option).toBeTruthy();
  });
});

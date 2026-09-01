/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7070 — what ListView hands the gantt renderer, and which views it
 * offers the Gantt toggle to.
 *
 * The sibling of `ListView.calendar-binding-7029` next door. `ObjectView` was
 * one half of this face's problem; this branch is the other, and it is the half
 * that decides whether the fix is observable at all — with the object page fixed
 * and this branch untouched, `'start_date'` / `'end_date'` simply take over as
 * the fabricated names one layer down and the renderer still never sees an
 * absent binding.
 *
 * Two read-sites are pinned because they answer two different questions and both
 * used to be answered by the fabrication:
 *
 *   - the RENDER branch — which fields does the gantt lay its bars on?
 *   - the CAPABILITY gate (`availableViews`) — may this view offer Gantt at all?
 *     ADR-0047: a visualization is offered only when its binding resolves. The
 *     gate reads `schema.gantt?.startDateField || schema.options?.gantt?.…`, and
 *     the object page put a fabricated `options.gantt.startDateField` on every
 *     view in the product, so the toggle was always live.
 *
 * REVERSE VERIFICATION — direction predicted before running, then observed:
 * restore `|| 'start_date'` / `|| 'end_date'` on the two lines this card
 * deletes and the "invents NO binding" case goes RED (the spy reads the
 * fabricated names) while every declared-config case here stays GREEN.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import { render, waitFor, screen, cleanup, fireEvent } from '@testing-library/react';
import { ListView } from '../ListView';
import { SchemaRendererProvider } from '@object-ui/react';

const rows = [
  { id: '1', name: 'Ada onboarding', start_date: '2099-09-01', end_date: '2099-09-03' },
  { id: '2', name: 'Grace onboarding', start_date: '2099-10-01', end_date: '2099-10-02' },
];

const objectDef = {
  name: 'crm_leave_request',
  label: 'Leave Request',
  fields: {
    id: { name: 'id', type: 'text' },
    name: { name: 'name', type: 'text', label: 'Name' },
    start_date: { name: 'start_date', type: 'date', label: 'Start Date' },
    end_date: { name: 'end_date', type: 'date', label: 'End Date' },
  },
};

let captured: Array<Record<string, any>> = [];

ComponentRegistry.register(
  'object-gantt',
  (props: Record<string, any>) => {
    captured.push(props);
    return <div data-testid="gantt-spy" />;
  },
  { namespace: 'test', label: 'Gantt spy', category: 'view' },
);

const makeDataSource = () =>
  ({
    find: vi.fn(async () => rows),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn(async () => objectDef),
  }) as any;

const BASE = {
  type: 'list-view',
  objectName: 'crm_leave_request',
  viewType: 'gantt',
  columns: ['name'],
} as const;

/** Mount ListView on `schema` and return the props the gantt was given. */
async function ganttProps(schema: Record<string, any>) {
  const dataSource = makeDataSource();
  render(
    <SchemaRendererProvider dataSource={dataSource}>
      <ListView schema={schema as never} dataSource={dataSource} />
    </SchemaRendererProvider>,
  );
  await waitFor(() => expect(captured.length).toBeGreaterThan(0));
  return captured[captured.length - 1].schema;
}

const queryViewOption = (name: string) =>
  screen.queryByRole('tab', { name }) ?? screen.queryByRole('button', { name });

beforeEach(() => {
  captured = [];
});
afterEach(cleanup);

describe('ListView gantt branch — only ever restates a DECLARED binding (objectui#7070)', () => {
  it('invents NO date binding for a gantt view that declares no config', async () => {
    // THE DEFECT, at this layer. `startDateField` used to read 'start_date' and
    // `endDateField` 'end_date' here — names this view never wrote. Absent
    // bindings are what let `getGanttConfig` return null downstream, which is
    // the only route to the renderer's refusal screen.
    const props = await ganttProps({ ...BASE });
    expect(props.startDateField).toBeUndefined();
    expect(props.endDateField).toBeUndefined();
  });

  it('invents no date binding when the view carries an EMPTY gantt block', async () => {
    const props = await ganttProps({ ...BASE, gantt: {} });
    expect(props.startDateField).toBeUndefined();
    expect(props.endDateField).toBeUndefined();
  });

  it('invents no date binding when only the OTHER gantt keys are declared', async () => {
    // ⛔ Scoped out of #7070 on purpose: `progressField` / `dependenciesField`
    // keep their floors — not date axes, different absent-value semantics. This
    // case is the measurement that keeping them does not resurrect an axis:
    // `getGanttConfig` gates on the two DATE fields alone, so the refusal stays
    // reachable with the pair still being handed down.
    const props = await ganttProps({ ...BASE, gantt: { progressField: 'pct' } });
    expect(props.startDateField).toBeUndefined();
    expect(props.endDateField).toBeUndefined();
    expect(props.progressField).toBe('pct');
    expect(props.dependenciesField).toBe('dependencies');
  });

  it('CONTROL: forwards the spec-canonical `gantt` block unchanged', async () => {
    const props = await ganttProps({
      ...BASE,
      gantt: { startDateField: 'start_date', endDateField: 'end_date', titleField: 'name' },
    });
    expect(props.startDateField).toBe('start_date');
    expect(props.endDateField).toBe('end_date');
    expect(props.titleField).toBe('name');
  });

  it('CONTROL: forwards the legacy `options.gantt` nesting unchanged', async () => {
    // The nesting app-shell's object page emits. A correctly configured view
    // renders exactly as it did before this card.
    const props = await ganttProps({
      ...BASE,
      options: { gantt: { startDateField: 'start_date', endDateField: 'end_date', colorField: 'status' } },
    });
    expect(props.startDateField).toBe('start_date');
    expect(props.endDateField).toBe('end_date');
    expect(props.colorField).toBe('status');
  });

  it('CONTROL: a partially declared axis keeps its declared half and only that', async () => {
    const props = await ganttProps({ ...BASE, gantt: { startDateField: 'start_date' } });
    expect(props.startDateField).toBe('start_date');
    expect(props.endDateField).toBeUndefined();
  });
});

describe('ListView capability gate — the Gantt toggle follows the binding (objectui#7070)', () => {
  const GRID = { ...BASE, viewType: 'grid' } as const;

  /**
   * The switcher has two forms — an inline segmented control (role="tab") and a
   * collapsed dropdown (plain buttons behind a trigger) — so the trigger has to
   * be opened before querying, and both roles have to be accepted. Querying
   * without opening returns null for BOTH worlds, which would make the negative
   * case below pass while measuring nothing. Copied from the objectui#7029 file
   * next door, where that was measured on its first run.
   */
  const mountSwitcher = async (schema: Record<string, any>) => {
    const dataSource = makeDataSource();
    render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ListView schema={schema as never} dataSource={dataSource} showViewSwitcher />
      </SchemaRendererProvider>,
    );
    await waitFor(() => expect(dataSource.find).toHaveBeenCalled());
    const trigger = screen.queryByTestId('view-switcher-dropdown');
    if (trigger) fireEvent.click(trigger);
  };

  it('CONTROL: offers Gantt to a view that declared a binding', async () => {
    // The positive control comes FIRST: it proves this harness can see the
    // option at all, so the negative case below is a measurement rather than a
    // query that never had anything to find.
    await mountSwitcher({ ...GRID, gantt: { startDateField: 'start_date', endDateField: 'end_date' } });
    await waitFor(() => expect(queryViewOption('Gantt')).toBeInTheDocument());
  });

  it('CONTROL: offers Gantt for the legacy `options.gantt` nesting too', async () => {
    // The shape the object page emits for a view that DID declare a gantt block
    // — the half of the gate that must keep working after the fabrication left.
    await mountSwitcher({
      ...GRID,
      options: { gantt: { startDateField: 'start_date', endDateField: 'end_date' } },
    });
    await waitFor(() => expect(queryViewOption('Gantt')).toBeInTheDocument());
  });

  it('does NOT offer Gantt for the exact bag the fixed object page now emits', async () => {
    // ⭐ THE SECOND PREMISE, measured rather than assumed. #7070 asked whether
    // ADR-0047's gate drops the Gantt toggle "for free" once the fabrication is
    // gone, the way it did for calendar. The gate reads
    // `schema.gantt?.startDateField || schema.options?.gantt?.startDateField`,
    // and the fabrication it used to read came from the OBJECT PAGE, which put
    // `options.gantt.startDateField: 'start_date'` on every view in the product.
    // `{ gantt: { titleField: 'name' } }` is precisely what `ganttViewOptions`
    // now emits for a view that declared nothing — a bag that still EXISTS but
    // carries no axis. The answer is yes: no second mechanism was needed.
    await mountSwitcher({
      ...GRID,
      appearance: { allowedVisualizations: ['grid', 'gantt'] },
      options: { gantt: { titleField: 'name' } },
    });
    expect(queryViewOption('Gantt')).not.toBeInTheDocument();
  });

  it('does NOT offer Gantt to a view that declared no gantt binding', async () => {
    // ADR-0047: offered only when the binding resolves. This is the second
    // premise objectui#7070 asked to be measured rather than assumed — that the
    // capability gate drops the toggle "for free" once the fabrication is gone,
    // as it did for calendar. It does: the gate reads the same declared config
    // this card stopped inventing, so no second mechanism was needed.
    await mountSwitcher({ ...GRID, appearance: { allowedVisualizations: ['grid', 'gantt'] } });
    expect(queryViewOption('Gantt')).not.toBeInTheDocument();
  });
});

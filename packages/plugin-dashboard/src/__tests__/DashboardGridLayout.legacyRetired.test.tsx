/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#4612 — the SECOND dashboard surface gets the same graceful fallback.
 *
 * `DashboardRenderer` has carried the framework#3320 legacy sentinel since the
 * retirement: a widget still holding the pre-ADR-0021 inline-analytics shape
 * (top-level `object`, no `dataset`, no inline `options.data`) renders a VISIBLE
 * error placeholder prompting a rebind. `DashboardGridLayout` — separately
 * exported, and registered as the `dashboard-grid` SDUI component — had none, so
 * the very same stored metadata fell through to its static-data branch with
 * `data: []`: a silent blank chart, no diagnostic, no path to fix. That is the
 * exact outcome `DashboardRenderer.legacyRetired.test.tsx`'s header says must not
 * happen, on the surface nobody pinned.
 *
 * The detector and the placeholder now live in ONE module
 * (`../legacyRetiredWidget`) with two consumers, because the defect existed
 * precisely because there were two surfaces and one fix.
 *
 * The negative controls are the binding half. `options.data = { provider:
 * 'object', … }` carries its OWN nested `object`/`aggregate` and is a DIFFERENT,
 * still-live authoring surface (the #4600 measurement's do-not-conflate note);
 * dataset widgets and static-data widgets are live too. None of them may acquire
 * the placeholder — on either surface.
 */

import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import type { DashboardComponentSchema } from '@object-ui/types';
import { DashboardGridLayout } from '../DashboardGridLayout';

afterEach(cleanup);

/**
 * `object` / `categoryField` / `aggregate` are no longer part of
 * `DashboardWidgetSchema` — the cast mimics stored legacy metadata that predates
 * the ADR-0021 dataset shape, which is the only way this shape can still arrive.
 */
const dash = (widget: Record<string, unknown>): DashboardComponentSchema =>
  ({ type: 'dashboard', widgets: [widget] }) as unknown as DashboardComponentSchema;

describe('DashboardGridLayout retired legacy widgets (#4612)', () => {
  it.each([
    ['chart', { id: 'w1', type: 'bar', object: 'invoices', categoryField: 'month', valueField: 'amount', aggregate: 'sum' }],
    // Byte-for-byte `examples/schema-catalog/src/schemas/plugin-dashboard/
    // filtered-dashboard.json` → `widgets[0]`: the real stored shape, not a
    // fixture invented to match the detector.
    ['catalog bar', { id: 'invoices_by_status', title: 'Invoices by Status', type: 'bar', object: 'invoices', categoryField: 'status', aggregate: 'count' }],
    // The pivot family, whose legacy spelling names `rowField`/`columnField`.
    ['pivot', { id: 'w1', type: 'pivot', object: 'invoices', rowField: 'region', valueField: 'amount' }],
    // `widgets[2]` of the same catalog entry.
    ['metric', { id: 'w1', type: 'metric', object: 'invoices', aggregate: 'count' }],
  ])('renders the visible placeholder for a legacy %s widget', (_kind, widget) => {
    render(<DashboardGridLayout schema={dash(widget)} />);
    expect(screen.getByText(/retired data format/i)).toBeInTheDocument();
  });

  it('states the rebind affordance verbatim, not merely "something is wrong"', () => {
    // The message IS the fix path — a placeholder that does not say what to do
    // is only a prettier blank. Pinned verbatim, and identically to the
    // DashboardRenderer surface (one shared constant, one wording).
    render(<DashboardGridLayout schema={dash({ id: 'w1', type: 'bar', object: 'invoices', aggregate: 'count' })} />);
    expect(
      screen.getByText('This widget uses a retired data format. Edit it to bind a dataset.'),
    ).toBeInTheDocument();
  });

  /**
   * The must-not-change half. Each control asserts BOTH that the placeholder is
   * absent AND that the widget was really rendered — otherwise "no placeholder"
   * would also be satisfied by a grid that threw or drew nothing, and the
   * control would pass for the wrong reason.
   */
  const renderOne = (widget: Record<string, unknown>) => {
    const { container } = render(<DashboardGridLayout schema={dash(widget)} />);
    expect(container.querySelector('[data-testid="grid-layout"]')).toBeInTheDocument();
    return container;
  };

  it('does NOT show the placeholder for a dataset-bound widget', () => {
    renderOne({ id: 'w1', type: 'bar', dataset: 'invoices', values: ['count'] });
    expect(screen.queryByText(/retired data format/i)).not.toBeInTheDocument();
  });

  it('does NOT show the placeholder for an options.data provider widget', () => {
    // The nested `{ provider: 'object', object, aggregate }` config is a
    // separate, LIVE surface. Its `object` is read off `widgetData`, never off
    // the widget top level — conflating the two would retire a working feature.
    renderOne({
      id: 'w1',
      type: 'bar',
      options: { data: { provider: 'object', object: 'invoices', aggregate: { field: 'amount', function: 'sum' } } },
    });
    expect(screen.queryByText(/retired data format/i)).not.toBeInTheDocument();
  });

  it('does NOT show the placeholder for a static-data widget', () => {
    renderOne({ id: 'w1', type: 'bar', options: { data: [{ name: 'A', value: 1 }] } });
    expect(screen.queryByText(/retired data format/i)).not.toBeInTheDocument();
  });

  it('does NOT show the placeholder for a static-data pivot widget', () => {
    // DashboardRenderer's pivot arm returns the placeholder for the WHOLE family
    // because that surface has no pivot renderer at all. This surface does, and
    // a static-data pivot is a live static-data widget — so the shared detector
    // is the inline-analytics sentinel (which the legacy pivot above matches via
    // its top-level `object`), NOT the family arm. Mirroring the family arm here
    // would have retired a working branch.
    renderOne({ id: 'w1', type: 'pivot', options: { data: [{ region: 'EMEA', amount: 1 }] } });
    expect(screen.queryByText(/retired data format/i)).not.toBeInTheDocument();
  });
});

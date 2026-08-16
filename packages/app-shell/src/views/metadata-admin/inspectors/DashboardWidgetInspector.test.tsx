// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DashboardWidgetInspector — dataset binding (ADR-0021). The widget inspector
 * authors the single semantic-layer shape: it binds a governed `dataset` and
 * picks its dimensions/measures from the bound dataset's semantic layer (the
 * same control the Report inspector uses) — instead of free-text the author has
 * to recall. The pre-ADR-0021 inline object query (object/valueField/
 * categoryField/aggregate) was removed (framework#3251), so no Studio surface
 * can author the dead shape. These tests stub the catalog hook so the pickers
 * render network-free.
 */

import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

// Network-free catalog.
vi.mock('../previews/useDatasetCatalog', () => ({
  useDatasetCatalog: () => ({
    datasets: [{ name: 'sales_pipeline', label: 'Sales Pipeline', dimensions: [], measures: [] }],
    loading: false,
    error: null,
  }),
  useDatasetSemantics: () => ({
    dimensions: [{ name: 'stage', type: 'string' }],
    measures: [{ name: 'revenue', aggregate: 'sum' }],
    loading: false,
    error: null,
  }),
}));

import { DashboardWidgetInspector } from './DashboardWidgetInspector';

afterEach(cleanup);

const baseProps = {
  type: 'dashboard',
  name: 'sales',
  locale: 'en-US' as const,
  onClearSelection: vi.fn(),
  onSelectionChange: vi.fn(),
  readOnly: false,
};

const widget = (extra: Record<string, unknown> = {}) => ({ id: 'w1', type: 'bar', title: 'Revenue', ...extra });

function renderWidget(extra: Record<string, unknown> = {}, props: Record<string, unknown> = {}) {
  return render(
    <DashboardWidgetInspector
      {...baseProps}
      {...props}
      draft={{ widgets: [widget(extra)] }}
      selection={{ kind: 'widget', id: 'w1' }}
      onPatch={(props.onPatch as any) ?? vi.fn()}
    />,
  );
}

describe('DashboardWidgetInspector — dataset binding', () => {
  it('shows the Dataset picker; dimensions/values appear only once a dataset is bound', () => {
    const { rerender } = renderWidget();
    expect(screen.getByText('Dataset')).toBeInTheDocument();
    // Dimensions/Values sections are gated behind a bound dataset.
    expect(screen.queryByText('Dimensions')).not.toBeInTheDocument();
    expect(screen.queryByText('Values (measures)')).not.toBeInTheDocument();

    rerender(
      <DashboardWidgetInspector
        {...baseProps}
        draft={{ widgets: [widget({ dataset: 'sales_pipeline', dimensions: ['stage'], values: ['revenue'] })] }}
        selection={{ kind: 'widget', id: 'w1' }}
        onPatch={vi.fn()}
      />,
    );
    // Sections now present, and the bound members render in the lists.
    expect(screen.getByText('Dimensions')).toBeInTheDocument();
    expect(screen.getByText('Values (measures)')).toBeInTheDocument();
    expect(screen.getByText('stage')).toBeInTheDocument();
    expect(screen.getByText('revenue')).toBeInTheDocument();
  });

  it('no longer renders the removed inline object query fields', () => {
    // Legacy inline analytics fields were removed (framework#3251) — the
    // inspector authors only the dataset shape now.
    renderWidget({ dataset: 'sales_pipeline' });
    expect(screen.queryByText('Data Source (Object)')).not.toBeInTheDocument();
    expect(screen.queryByText('Value Field')).not.toBeInTheDocument();
    expect(screen.queryByText('Category Field')).not.toBeInTheDocument();
  });

  it('renders Chinese labels under zh-CN', () => {
    renderWidget({ dataset: 'sales_pipeline' }, { locale: 'zh-CN' });
    expect(screen.getByText('数据集绑定')).toBeInTheDocument();
    expect(screen.getByText('维度')).toBeInTheDocument();
  });

  it('the Dataset label resolves to the combo trigger, not to nothing (#3997)', () => {
    // This panel labels its controls through a `Field` wrapper that renders
    // `<Label htmlFor={id}>` and expects the wrapped control to carry the same
    // id. Every other field honoured it (`Input id`, `SelectTrigger id`); the
    // dataset combo could not, because `InspectorComboField` took no id — so
    // `htmlFor="widget-dataset"` pointed at an id nothing carried and the
    // picker was an anonymous combobox. This is the call-site half of the fix:
    // the atom's own pins live in `_shared.labels.test.tsx`.
    renderWidget({ dataset: 'sales_pipeline' });

    const label = screen.getByText('Dataset');
    const forId = label.getAttribute('for');
    expect(forId).toBeTruthy();

    const trigger = screen.getByLabelText('Dataset');
    expect(trigger).toBe(document.getElementById(forId!));
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveAttribute('role', 'combobox');
    expect(trigger).toHaveAccessibleName('Dataset');
    // Exactly one element answers that id — the trigger, not a wrapper.
    expect(document.querySelectorAll(`[id="${forId}"]`)).toHaveLength(1);

    // This assertion stays scoped to the Dataset `Field`; the panel-wide
    // "no dangling for" sweep it deliberately did not perform — because
    // `widget-color` would have failed it — now lives in the describe block
    // below, with `widget-color` fixed (objectui#4010).
  });

  it('disables every picker when readOnly', () => {
    renderWidget({ dataset: 'sales_pipeline', object: 'crm_opportunity' }, { readOnly: true });
    const combos = screen.getAllByRole('combobox');
    expect(combos.length).toBeGreaterThan(0);
    combos.forEach((c) => expect(c).toBeDisabled());
  });
});

/**
 * objectui#4010 — the Color field, the last `Field` in this panel whose child
 * could not answer to the wrapper's `id`.
 *
 * `Field` renders one of two shapes now. Five fields keep `<Label htmlFor={id}>`
 * over a labelable control carrying that id. `widget-color` wraps a
 * `div[role="radiogroup"]`, which no `for` can name, so its label publishes
 * `widget-color-label` and the group answers `aria-labelledby`. Before the fix
 * it published `htmlFor="widget-color"` at a control that accepted no id: an
 * IDREF resolving to nothing, which reads to tooling as an association that is
 * closed.
 */
describe('DashboardWidgetInspector — the Color group is named (objectui#4010)', () => {
  /** Every `label[for]` in the panel, with whether its IDREF resolves. */
  const danglingFors = () =>
    Array.from(document.querySelectorAll('label[for]'))
      .filter((l) => !document.getElementById(l.getAttribute('for')!))
      .map((l) => ({ text: (l.textContent ?? '').trim(), for: l.getAttribute('for') }));

  it('leaves no `for` in the whole panel pointing at nothing', () => {
    // The panel-wide sweep, now that every `Field` can honour its own contract.
    // Scoped per-field assertions cannot catch a SIXTH field added later with
    // the same defect; this one can, which is why it is written wide.
    renderWidget({ dataset: 'sales_pipeline' });
    expect(danglingFors()).toEqual([]);
  });

  it('names the swatch group with the visible Color Variant label, by IDREF', () => {
    renderWidget();

    const label = screen.getByText('Color Variant');
    const group = screen.getByRole('radiogroup');

    // The label publishes an id and drops its `for` — a group cannot be the
    // target of a labelable association.
    expect(label).toHaveAttribute('id', 'widget-color-label');
    expect(label).not.toHaveAttribute('for');

    const idref = group.getAttribute('aria-labelledby');
    expect(idref).toBe('widget-color-label');
    // Resolved to a NODE, and to THAT node: a name-only assertion would pass on
    // an IDREF aimed at any same-texted element in the panel.
    expect(document.getElementById(idref!)).toBe(label);
    expect(document.querySelectorAll(`[id="${idref}"]`)).toHaveLength(1);
    expect(group).toHaveAccessibleName('Color Variant');
  });

  it('no longer publishes the bare `widget-color` id to anyone', () => {
    // The pre-fix `for` target. Nothing carries it now — and nothing should
    // start to: putting it on the radiogroup would resolve the IDREF while
    // still naming nothing, the half-fix this issue refused.
    renderWidget();
    expect(document.getElementById('widget-color')).toBeNull();
  });

  it('keeps naming the group under zh-CN, with no second string to translate', () => {
    // The IDREF carries whatever the label rendered, so the accessible name is
    // translated by the same `t()` call the visible text already went through.
    renderWidget({}, { locale: 'zh-CN' });
    const group = screen.getByRole('radiogroup');
    const label = document.getElementById(group.getAttribute('aria-labelledby')!);
    expect(label).toBe(screen.getByText('颜色'));
    expect(group).toHaveAccessibleName('颜色');
  });
});

describe('DashboardWidgetInspector — dashboard filter bindings (framework#2501)', () => {
  const filteredDraft = (widgetExtra: Record<string, unknown> = {}) => ({
    dateRange: { field: 'created_at', defaultRange: 'last_30_days' },
    globalFilters: [
      // Options in @objectstack/spec's `{ value, label }` pair form. Nothing in
      // this suite reads the list — it is scenery for the BINDINGS under test —
      // so the deprecated bare-string shorthand it used to spell bought nothing
      // and now warns (objectui#4356). Its coverage is
      // `packages/core/src/utils/__tests__/dashboard-filters.test.ts`.
      { name: 'region', field: 'region', label: 'Region', type: 'select', options: [{ value: 'EMEA', label: 'EMEA' }] },
    ],
    widgets: [widget(widgetExtra)],
  });

  function renderFiltered(widgetExtra: Record<string, unknown> = {}, props: Record<string, unknown> = {}) {
    return render(
      <DashboardWidgetInspector
        {...baseProps}
        {...props}
        draft={filteredDraft(widgetExtra)}
        selection={{ kind: 'widget', id: 'w1' }}
        onPatch={(props.onPatch as any) ?? vi.fn()}
      />,
    );
  }

  it('hides the section when the dashboard declares no filters', () => {
    renderWidget();
    expect(screen.queryByText('Dashboard filter bindings')).not.toBeInTheDocument();
  });

  it('renders one row per dashboard filter (dateRange + each globalFilter)', () => {
    renderFiltered();
    expect(screen.getByText('Dashboard filter bindings')).toBeInTheDocument();
    expect(screen.getByTestId('widget-filter-binding-dateRange')).toBeInTheDocument();
    const region = screen.getByTestId('widget-filter-binding-region');
    expect(within(region).getByText('Region')).toBeInTheDocument();
    // Default placeholder names the filter's own field.
    expect(within(region).getByText('Default (region)')).toBeInTheDocument();
  });

  it('unticking Apply patches filterBindings[name] = false; re-ticking removes the entry', () => {
    const onPatch = vi.fn();
    renderFiltered({}, { onPatch });
    const region = screen.getByTestId('widget-filter-binding-region');
    fireEvent.click(within(region).getByRole('checkbox'));
    expect(onPatch).toHaveBeenCalledWith({
      widgets: [expect.objectContaining({ id: 'w1', filterBindings: { region: false } })],
    });

    cleanup();
    const onPatch2 = vi.fn();
    renderFiltered({ filterBindings: { region: false } }, { onPatch: onPatch2 });
    const region2 = screen.getByTestId('widget-filter-binding-region');
    const checkbox = within(region2).getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    // Opted out → the field picker is hidden for this row.
    expect(within(region2).queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.click(checkbox);
    // Last remaining entry removed → filterBindings collapses to undefined.
    expect(onPatch2).toHaveBeenCalledWith({
      widgets: [expect.objectContaining({ id: 'w1', filterBindings: undefined })],
    });
  });

  it('shows an existing field override and resets it back to the default binding', () => {
    const onPatch = vi.fn();
    renderFiltered({ filterBindings: { dateRange: 'signed_at', region: 'sales_region' } }, { onPatch });
    const dateRow = screen.getByTestId('widget-filter-binding-dateRange');
    expect(within(dateRow).getByText('signed_at')).toBeInTheDocument();
    fireEvent.click(within(dateRow).getByRole('button', { name: 'Reset' }));
    // Only the dateRange override is cleared; the region override survives.
    expect(onPatch).toHaveBeenCalledWith({
      widgets: [expect.objectContaining({ filterBindings: { region: 'sales_region' } })],
    });
  });
});

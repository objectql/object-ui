// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DashboardWidgetInspector — dataset binding (ADR-0021). The widget inspector
 * binds a governed dataset and picks its dimensions/measures from the bound
 * dataset's semantic layer (the same control the Report inspector uses), and
 * the inline object query picks object/fields from the live schema — instead
 * of free-text the author has to recall. These tests stub the catalog hooks so
 * the pickers render network-free.
 */

import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

// Network-free catalogs.
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
vi.mock('./useDatasetFields', () => ({
  useObjectOptions: () => ({ options: [{ name: 'crm_opportunity', label: 'Opportunity' }], loading: false }),
}));
vi.mock('../previews/useObjectFields', () => ({
  useObjectFields: () => ({ fields: [{ name: 'amount', label: 'Amount', type: 'currency', hidden: false }], loading: false, error: null }),
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

  it('renders object + field bindings as pickers (inline single-object query)', () => {
    renderWidget({ object: 'crm_opportunity', valueField: 'amount' });
    expect(screen.getByText('Data Source (Object)')).toBeInTheDocument();
    expect(screen.getByText('Value Field')).toBeInTheDocument();
    // The bound object/field resolve to their catalog labels on the combo triggers.
    expect(screen.getAllByText('Opportunity').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Amount').length).toBeGreaterThan(0);
  });

  it('renders Chinese labels under zh-CN', () => {
    renderWidget({ dataset: 'sales_pipeline' }, { locale: 'zh-CN' });
    expect(screen.getByText('数据集绑定')).toBeInTheDocument();
    expect(screen.getByText('维度')).toBeInTheDocument();
  });

  it('disables every picker when readOnly', () => {
    renderWidget({ dataset: 'sales_pipeline', object: 'crm_opportunity' }, { readOnly: true });
    const combos = screen.getAllByRole('combobox');
    expect(combos.length).toBeGreaterThan(0);
    combos.forEach((c) => expect(c).toBeDisabled());
  });
});

describe('DashboardWidgetInspector — dashboard filter bindings (framework#2501)', () => {
  const filteredDraft = (widgetExtra: Record<string, unknown> = {}) => ({
    dateRange: { field: 'created_at', defaultRange: 'last_30_days' },
    globalFilters: [
      { name: 'region', field: 'region', label: 'Region', type: 'select', options: ['EMEA'] },
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

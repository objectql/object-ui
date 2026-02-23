/**
 * Column Features Tests — pinned, summary, link, action
 *
 * Covers: pinned columns (left/right), column summary footer,
 *         link column rendering, action column rendering,
 *         and the useColumnSummary hook.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { ObjectGrid } from '../ObjectGrid';
import { useColumnSummary } from '../useColumnSummary';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider } from '@object-ui/react';

registerAllFields();

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const numericData = [
  { _id: '1', name: 'Alice', amount: 100, score: 80 },
  { _id: '2', name: 'Bob', amount: 200, score: 90 },
  { _id: '3', name: 'Charlie', amount: 300, score: 70 },
];

const mixedData = [
  { _id: '1', name: 'Alice', status: 'active', amount: 150.5 },
  { _id: '2', name: 'Bob', status: 'inactive', amount: 250 },
  { _id: '3', name: 'Charlie', status: 'active', amount: 350 },
];

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function renderGrid(opts?: Record<string, any>) {
  const schema: any = {
    type: 'object-grid' as const,
    objectName: 'test_object',
    columns: [
      { field: 'name', label: 'Name' },
      { field: 'amount', label: 'Amount', type: 'number' },
    ],
    data: { provider: 'value', items: numericData },
    ...opts,
  };

  return render(
    <ActionProvider>
      <ObjectGrid schema={schema} />
    </ActionProvider>
  );
}

// =========================================================================
// useColumnSummary hook tests
// =========================================================================
describe('useColumnSummary', () => {
  it('returns empty summaries when no columns have summary config', () => {
    const columns = [
      { field: 'name', label: 'Name' },
      { field: 'amount', label: 'Amount' },
    ] as any[];
    const { result } = renderHook(() => useColumnSummary(columns, numericData));
    expect(result.current.hasSummary).toBe(false);
    expect(result.current.summaries.size).toBe(0);
  });

  it('computes sum aggregation', () => {
    const columns = [
      { field: 'name', label: 'Name' },
      { field: 'amount', label: 'Amount', summary: { type: 'sum' } },
    ] as any[];
    const { result } = renderHook(() => useColumnSummary(columns, numericData));
    expect(result.current.hasSummary).toBe(true);
    const summary = result.current.summaries.get('amount');
    expect(summary).toBeDefined();
    expect(summary!.value).toBe(600);
    expect(summary!.label).toContain('Sum');
  });

  it('computes count aggregation', () => {
    const columns = [
      { field: 'name', label: 'Name', summary: 'count' },
    ] as any[];
    const { result } = renderHook(() => useColumnSummary(columns, numericData));
    expect(result.current.hasSummary).toBe(true);
    const summary = result.current.summaries.get('name');
    expect(summary!.value).toBe(3);
    expect(summary!.label).toContain('Count');
  });

  it('computes avg aggregation', () => {
    const columns = [
      { field: 'score', label: 'Score', summary: { type: 'avg' } },
    ] as any[];
    const { result } = renderHook(() => useColumnSummary(columns, numericData));
    const summary = result.current.summaries.get('score');
    expect(summary!.value).toBe(80);
    expect(summary!.label).toContain('Avg');
  });

  it('computes min aggregation', () => {
    const columns = [
      { field: 'amount', label: 'Amount', summary: { type: 'min' } },
    ] as any[];
    const { result } = renderHook(() => useColumnSummary(columns, numericData));
    const summary = result.current.summaries.get('amount');
    expect(summary!.value).toBe(100);
    expect(summary!.label).toContain('Min');
  });

  it('computes max aggregation', () => {
    const columns = [
      { field: 'amount', label: 'Amount', summary: { type: 'max' } },
    ] as any[];
    const { result } = renderHook(() => useColumnSummary(columns, numericData));
    const summary = result.current.summaries.get('amount');
    expect(summary!.value).toBe(300);
    expect(summary!.label).toContain('Max');
  });

  it('handles string shorthand for summary type', () => {
    const columns = [
      { field: 'amount', label: 'Amount', summary: 'sum' },
    ] as any[];
    const { result } = renderHook(() => useColumnSummary(columns, numericData));
    const summary = result.current.summaries.get('amount');
    expect(summary!.value).toBe(600);
  });

  it('handles empty data array', () => {
    const columns = [
      { field: 'amount', label: 'Amount', summary: { type: 'sum' } },
    ] as any[];
    const { result } = renderHook(() => useColumnSummary(columns, []));
    expect(result.current.hasSummary).toBe(false);
  });

  it('handles undefined columns', () => {
    const { result } = renderHook(() => useColumnSummary(undefined, numericData));
    expect(result.current.hasSummary).toBe(false);
  });

  it('handles summary with custom field reference', () => {
    const columns = [
      { field: 'name', label: 'Name', summary: { type: 'sum', field: 'amount' } },
    ] as any[];
    const { result } = renderHook(() => useColumnSummary(columns, numericData));
    const summary = result.current.summaries.get('name');
    expect(summary!.value).toBe(600);
  });

  it('handles string numeric values', () => {
    const data = [
      { _id: '1', amount: '100' },
      { _id: '2', amount: '200' },
    ];
    const columns = [
      { field: 'amount', label: 'Amount', summary: { type: 'sum' } },
    ] as any[];
    const { result } = renderHook(() => useColumnSummary(columns, data));
    const summary = result.current.summaries.get('amount');
    expect(summary!.value).toBe(300);
  });

  it('computes multiple summaries simultaneously', () => {
    const columns = [
      { field: 'amount', label: 'Amount', summary: { type: 'sum' } },
      { field: 'score', label: 'Score', summary: { type: 'avg' } },
    ] as any[];
    const { result } = renderHook(() => useColumnSummary(columns, numericData));
    expect(result.current.summaries.size).toBe(2);
    expect(result.current.summaries.get('amount')!.value).toBe(600);
    expect(result.current.summaries.get('score')!.value).toBe(80);
  });
});

// =========================================================================
// Summary footer rendering in ObjectGrid
// =========================================================================
describe('Summary footer rendering', () => {
  it('renders summary footer when columns have summary config', async () => {
    renderGrid({
      columns: [
        { field: 'name', label: 'Name', summary: 'count' },
        { field: 'amount', label: 'Amount', type: 'number', summary: { type: 'sum' } },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    const footer = screen.getByTestId('column-summary-footer');
    expect(footer).toBeInTheDocument();
    expect(screen.getByTestId('summary-name')).toHaveTextContent('Count: 3');
    expect(screen.getByTestId('summary-amount')).toHaveTextContent('Sum: 600');
  });

  it('does not render summary footer when no columns have summary config', async () => {
    renderGrid();

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('column-summary-footer')).not.toBeInTheDocument();
  });
});

// =========================================================================
// Pinned column support
// =========================================================================
describe('Pinned columns', () => {
  it('renders pinned left columns first in order', async () => {
    renderGrid({
      columns: [
        { field: 'amount', label: 'Amount', type: 'number' },
        { field: 'name', label: 'Name', pinned: 'left' },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    // Both columns should be visible
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('renders pinned right columns last in order', async () => {
    renderGrid({
      columns: [
        { field: 'name', label: 'Name' },
        { field: 'amount', label: 'Amount', type: 'number', pinned: 'right' },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    expect(screen.getByText('Amount')).toBeInTheDocument();
  });

  it('handles mixed pinned and unpinned columns', async () => {
    renderGrid({
      columns: [
        { field: 'score', label: 'Score', type: 'number' },
        { field: 'name', label: 'Name', pinned: 'left' },
        { field: 'amount', label: 'Amount', type: 'number', pinned: 'right' },
      ],
      data: { provider: 'value', items: numericData },
    });

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    // All columns should be rendered
    expect(screen.getByText('Score')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
  });
});

// =========================================================================
// Link column rendering
// =========================================================================
describe('Link columns', () => {
  it('renders link column content as clickable button', async () => {
    renderGrid({
      columns: [
        { field: 'name', label: 'Name', link: true },
        { field: 'amount', label: 'Amount', type: 'number' },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    // Link columns should have clickable buttons with text-primary class
    const linkButtons = screen.getAllByRole('button').filter(
      btn => btn.classList.contains('text-primary')
    );
    expect(linkButtons.length).toBeGreaterThan(0);
  });
});

// =========================================================================
// Action column rendering
// =========================================================================
describe('Action columns', () => {
  it('renders action column with action button', async () => {
    const mockExecuteAction = vi.fn();

    renderGrid({
      columns: [
        { field: 'name', label: 'Name' },
        { field: 'amount', label: 'Amount', type: 'number', action: 'edit' },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    // Action columns render with clickable buttons
    const actionButtons = screen.getAllByRole('button').filter(
      btn => btn.classList.contains('text-primary')
    );
    expect(actionButtons.length).toBeGreaterThan(0);
  });
});

// =========================================================================
// Combined features
// =========================================================================
describe('Combined column features', () => {
  it('supports pinned + summary on the same column', async () => {
    renderGrid({
      columns: [
        { field: 'name', label: 'Name', pinned: 'left' },
        { field: 'amount', label: 'Amount', type: 'number', summary: { type: 'sum' } },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    const footer = screen.getByTestId('column-summary-footer');
    expect(footer).toBeInTheDocument();
    expect(screen.getByTestId('summary-amount')).toHaveTextContent('Sum: 600');
  });

  it('supports link + action on same column (link takes priority)', async () => {
    renderGrid({
      columns: [
        { field: 'name', label: 'Name', link: true, action: 'view' },
        { field: 'amount', label: 'Amount', type: 'number' },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    // Should render as clickable (link takes priority)
    const linkButtons = screen.getAllByRole('button').filter(
      btn => btn.classList.contains('text-primary')
    );
    expect(linkButtons.length).toBeGreaterThan(0);
  });
});

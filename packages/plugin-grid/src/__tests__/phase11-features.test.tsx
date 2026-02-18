/**
 * Phase 11 – Grid & Table Excellence L2/L3 feature tests.
 *
 * Covers: useCellClipboard, useGradientColor, useGroupReorder,
 *         FormulaBar, SplitPaneGrid, useGroupedData (aggregations).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { useCellClipboard } from '../useCellClipboard';
import { useGradientColor } from '../useGradientColor';
import { useGroupReorder } from '../useGroupReorder';
import { FormulaBar } from '../FormulaBar';
import { SplitPaneGrid } from '../SplitPaneGrid';
import { useGroupedData } from '../useGroupedData';
import type { AggregationConfig } from '../useGroupedData';

// ---------------------------------------------------------------------------
// Clipboard mock
// ---------------------------------------------------------------------------
let clipboardText = '';
const clipboardMock = {
  writeText: vi.fn((text: string) => {
    clipboardText = text;
    return Promise.resolve();
  }),
  readText: vi.fn(() => Promise.resolve(clipboardText)),
};
Object.defineProperty(navigator, 'clipboard', {
  value: clipboardMock,
  writable: true,
  configurable: true,
});
beforeEach(() => {
  clipboardText = '';
  clipboardMock.writeText.mockClear();
  clipboardMock.readText.mockClear();
});

// =========================================================================
// useCellClipboard
// =========================================================================
describe('useCellClipboard', () => {
  const data = [
    { name: 'Alice', age: '30', city: 'NYC' },
    { name: 'Bob', age: '25', city: 'LA' },
    { name: 'Carol', age: '35', city: 'SF' },
  ];
  const columns = ['name', 'age', 'city'];

  it('returns initial empty state', () => {
    const { result } = renderHook(() =>
      useCellClipboard({ data, columns }),
    );
    expect(result.current.selectedRange).toBeNull();
  });

  it('setSelectedRange updates range', () => {
    const { result } = renderHook(() =>
      useCellClipboard({ data, columns }),
    );
    act(() => {
      result.current.setSelectedRange({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
    });
    expect(result.current.selectedRange).toEqual({
      startRow: 0, startCol: 0, endRow: 0, endCol: 0,
    });
  });

  it('clearSelection resets to null', () => {
    const { result } = renderHook(() =>
      useCellClipboard({ data, columns }),
    );
    act(() => {
      result.current.setSelectedRange({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
    });
    act(() => {
      result.current.setSelectedRange(null);
    });
    expect(result.current.selectedRange).toBeNull();
  });

  it('onCopy writes to clipboard for single cell', async () => {
    const { result } = renderHook(() =>
      useCellClipboard({ data, columns }),
    );
    act(() => {
      result.current.setSelectedRange({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
    });
    act(() => {
      result.current.onCopy();
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Alice');
  });

  it('onCopy writes tab-separated values for range', () => {
    const { result } = renderHook(() =>
      useCellClipboard({ data, columns }),
    );
    act(() => {
      result.current.setSelectedRange({ startRow: 0, startCol: 0, endRow: 1, endCol: 2 });
    });
    act(() => {
      result.current.onCopy();
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'Alice\t30\tNYC\nBob\t25\tLA',
    );
  });

  it('onPaste reads from clipboard and calls callback', async () => {
    const onPaste = vi.fn();
    clipboardText = 'Dave\t40';
    const { result } = renderHook(() =>
      useCellClipboard({ data, columns, onPaste }),
    );
    act(() => {
      result.current.setSelectedRange({ startRow: 0, startCol: 0, endRow: 0, endCol: 1 });
    });
    await act(async () => {
      result.current.onPaste();
      // Let the clipboard promise resolve
      await Promise.resolve();
    });
    expect(onPaste).toHaveBeenCalledWith([
      { rowIndex: 0, field: 'name', value: 'Dave' },
      { rowIndex: 0, field: 'age', value: '40' },
    ]);
  });
});

// =========================================================================
// useGradientColor
// =========================================================================
describe('useGradientColor', () => {
  const data = [
    { score: 0 },
    { score: 50 },
    { score: 100 },
  ];

  it('returns undefined when value is non-numeric', () => {
    const { result } = renderHook(() =>
      useGradientColor({ field: 'score', data }),
    );
    expect(result.current({ score: 'abc' })).toBeUndefined();
  });

  it('returns gradient class for min value', () => {
    const { result } = renderHook(() =>
      useGradientColor({ field: 'score', data }),
    );
    expect(result.current({ score: 0 })).toBe('bg-green-100');
  });

  it('returns gradient class for max value', () => {
    const { result } = renderHook(() =>
      useGradientColor({ field: 'score', data }),
    );
    expect(result.current({ score: 100 })).toBe('bg-red-100');
  });

  it('returns mid-range gradient', () => {
    const { result } = renderHook(() =>
      useGradientColor({ field: 'score', data }),
    );
    expect(result.current({ score: 50 })).toBe('bg-yellow-100');
  });

  it('handles empty data array', () => {
    const { result } = renderHook(() =>
      useGradientColor({ field: 'score', data: [] }),
    );
    // min === max === 0, so first stop returned
    expect(result.current({ score: 0 })).toBe('bg-green-100');
  });

  it('handles custom color stops', () => {
    const stops = [
      { position: 0, className: 'bg-blue-100' },
      { position: 1, className: 'bg-purple-100' },
    ];
    const { result } = renderHook(() =>
      useGradientColor({ field: 'score', data, stops }),
    );
    expect(result.current({ score: 0 })).toBe('bg-blue-100');
    expect(result.current({ score: 100 })).toBe('bg-purple-100');
  });
});

// =========================================================================
// useGroupReorder
// =========================================================================
describe('useGroupReorder', () => {
  const groupKeys = ['alpha', 'beta', 'gamma'];

  it('initializes with default order', () => {
    const { result } = renderHook(() =>
      useGroupReorder({ groupKeys }),
    );
    expect(result.current.groupOrder).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('moveGroup reorders correctly', () => {
    const { result } = renderHook(() =>
      useGroupReorder({ groupKeys }),
    );
    act(() => {
      result.current.moveGroup(0, 2);
    });
    expect(result.current.groupOrder).toEqual(['beta', 'gamma', 'alpha']);
  });

  it('handles drag start and end events', () => {
    const { result } = renderHook(() =>
      useGroupReorder({ groupKeys }),
    );

    const mockEvent = {
      dataTransfer: { effectAllowed: '', setData: vi.fn() },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.onDragStart(mockEvent, 'beta');
    });
    expect(result.current.draggingKey).toBe('beta');

    act(() => {
      result.current.onDragEnd();
    });
    expect(result.current.draggingKey).toBeNull();
  });

  it('returns isDragging state', () => {
    const { result } = renderHook(() =>
      useGroupReorder({ groupKeys }),
    );
    // Initially not dragging
    expect(result.current.draggingKey).toBeNull();

    const mockEvent = {
      dataTransfer: { effectAllowed: '', setData: vi.fn() },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.onDragStart(mockEvent, 'gamma');
    });
    expect(result.current.draggingKey).toBe('gamma');
  });
});

// =========================================================================
// FormulaBar
// =========================================================================
describe('FormulaBar', () => {
  it('renders current cell value', () => {
    render(<FormulaBar value="Hello" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('Hello');
  });

  it('enters edit mode on click', () => {
    render(<FormulaBar value="Hello" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('readonly');
    fireEvent.click(input);
    expect(input).not.toHaveAttribute('readonly');
  });

  it('confirms on Enter key', () => {
    const onConfirm = vi.fn();
    render(<FormulaBar value="Hello" onConfirm={onConfirm} />);
    const input = screen.getByRole('textbox');
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: 'World' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledWith('World');
  });

  it('cancels on Escape key', () => {
    const onCancel = vi.fn();
    render(<FormulaBar value="Hello" onCancel={onCancel} />);
    const input = screen.getByRole('textbox');
    fireEvent.click(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onConfirm with new value', () => {
    const onConfirm = vi.fn();
    render(<FormulaBar value="old" onConfirm={onConfirm} />);
    const input = screen.getByRole('textbox');
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: 'new' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledWith('new');
  });

  it('calls onCancel', () => {
    const onCancel = vi.fn();
    render(<FormulaBar value="val" onCancel={onCancel} />);
    const input = screen.getByRole('textbox');
    fireEvent.click(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// =========================================================================
// SplitPaneGrid
// =========================================================================
describe('SplitPaneGrid', () => {
  it('renders left and right panes', () => {
    render(
      <SplitPaneGrid
        frozenWidth={200}
        left={<div data-testid="left">Left</div>}
        right={<div data-testid="right">Right</div>}
      />,
    );
    expect(screen.getByTestId('left')).toBeInTheDocument();
    expect(screen.getByTestId('right')).toBeInTheDocument();
  });

  it('shows resize divider', () => {
    render(
      <SplitPaneGrid
        frozenWidth={200}
        left={<div>L</div>}
        right={<div>R</div>}
      />,
    );
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('applies minWidth constraints via frozen pane style', () => {
    const { container } = render(
      <SplitPaneGrid
        frozenWidth={150}
        minFrozenWidth={100}
        minScrollableWidth={200}
        left={<div>L</div>}
        right={<div>R</div>}
      />,
    );
    // The frozen pane should have the specified width
    const frozenPane = container.querySelector('[style]');
    expect(frozenPane).toHaveStyle({ width: '150px' });
  });
});

// =========================================================================
// useGroupedData – aggregations
// =========================================================================
describe('useGroupedData aggregations', () => {
  const data = [
    { category: 'A', amount: 10 },
    { category: 'A', amount: 20 },
    { category: 'B', amount: 30 },
    { category: 'B', amount: 40 },
    { category: 'B', amount: 50 },
  ];

  const config = {
    fields: [{ field: 'category', order: 'asc' as const, collapsed: false }],
  };

  it('computes sum aggregation per group', () => {
    const agg: AggregationConfig[] = [{ field: 'amount', type: 'sum' }];
    const { result } = renderHook(() => useGroupedData(config, data, agg));

    const groupA = result.current.groups.find((g) => g.key === 'A')!;
    const groupB = result.current.groups.find((g) => g.key === 'B')!;

    expect(groupA.aggregations[0]).toEqual({ field: 'amount', type: 'sum', value: 30 });
    expect(groupB.aggregations[0]).toEqual({ field: 'amount', type: 'sum', value: 120 });
  });

  it('computes count aggregation per group', () => {
    const agg: AggregationConfig[] = [{ field: 'amount', type: 'count' }];
    const { result } = renderHook(() => useGroupedData(config, data, agg));

    const groupA = result.current.groups.find((g) => g.key === 'A')!;
    const groupB = result.current.groups.find((g) => g.key === 'B')!;

    expect(groupA.aggregations[0]).toEqual({ field: 'amount', type: 'count', value: 2 });
    expect(groupB.aggregations[0]).toEqual({ field: 'amount', type: 'count', value: 3 });
  });

  it('computes avg aggregation per group', () => {
    const agg: AggregationConfig[] = [{ field: 'amount', type: 'avg' }];
    const { result } = renderHook(() => useGroupedData(config, data, agg));

    const groupA = result.current.groups.find((g) => g.key === 'A')!;
    const groupB = result.current.groups.find((g) => g.key === 'B')!;

    expect(groupA.aggregations[0]).toEqual({ field: 'amount', type: 'avg', value: 15 });
    expect(groupB.aggregations[0]).toEqual({ field: 'amount', type: 'avg', value: 40 });
  });

  it('handles multiple aggregation types simultaneously', () => {
    const agg: AggregationConfig[] = [
      { field: 'amount', type: 'sum' },
      { field: 'amount', type: 'count' },
      { field: 'amount', type: 'avg' },
    ];
    const { result } = renderHook(() => useGroupedData(config, data, agg));

    const groupA = result.current.groups.find((g) => g.key === 'A')!;
    expect(groupA.aggregations).toHaveLength(3);
    expect(groupA.aggregations[0]).toEqual({ field: 'amount', type: 'sum', value: 30 });
    expect(groupA.aggregations[1]).toEqual({ field: 'amount', type: 'count', value: 2 });
    expect(groupA.aggregations[2]).toEqual({ field: 'amount', type: 'avg', value: 15 });
  });
});

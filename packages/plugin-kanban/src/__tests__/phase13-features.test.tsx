/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { InlineQuickAdd } from '../InlineQuickAdd';
import { CardTemplates } from '../CardTemplates';
import { useColumnWidths } from '../useColumnWidths';
import { useCrossSwimlaneMove } from '../useCrossSwimlaneMove';
import { useQuickAddReorder } from '../useQuickAddReorder';
import type { InlineFieldDefinition, CardTemplate, KanbanCard, KanbanColumn } from '../types';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const textField: InlineFieldDefinition = { name: 'title', label: 'Title', type: 'text' };
const numberField: InlineFieldDefinition = { name: 'points', label: 'Points', type: 'number' };
const selectField: InlineFieldDefinition = {
  name: 'priority',
  label: 'Priority',
  type: 'select',
  options: [
    { label: 'Low', value: 'low' },
    { label: 'High', value: 'high' },
  ],
};

const sampleTemplates: CardTemplate[] = [
  { id: 't1', name: 'Bug Report', values: { title: 'Bug: ', priority: 'high' } },
  { id: 't2', name: 'Feature', values: { title: 'Feature: ' } },
];

const makeCards = (ids: string[]): KanbanCard[] =>
  ids.map(id => ({ id, title: `Card ${id}` }));

const makeColumns = (ids: string[]): KanbanColumn[] =>
  ids.map(id => ({ id, title: `Col ${id}`, cards: [] }));

// ---------------------------------------------------------------------------
// InlineQuickAdd
// ---------------------------------------------------------------------------
describe('InlineQuickAdd', () => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form fields based on field definitions', () => {
    render(
      <InlineQuickAdd
        columnId="col1"
        fields={[textField, numberField, selectField]}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByLabelText('Title')).toBeDefined();
    expect(screen.getByLabelText('Points')).toBeDefined();
    expect(screen.getByLabelText('Priority')).toBeDefined();
  });

  it('auto-focuses first field', async () => {
    render(
      <InlineQuickAdd
        columnId="col1"
        fields={[textField]}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText('Title'));
    });
  });

  it('submits on Enter', async () => {
    render(
      <InlineQuickAdd
        columnId="col1"
        fields={[textField]}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    const input = screen.getByLabelText('Title');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('col1', { title: 'Hello' });
  });

  it('cancels on Escape', () => {
    render(
      <InlineQuickAdd
        columnId="col1"
        fields={[textField]}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText('Title'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('applies default values (from template)', () => {
    render(
      <InlineQuickAdd
        columnId="col1"
        fields={[textField, numberField]}
        onSubmit={onSubmit}
        onCancel={onCancel}
        defaultValues={{ title: 'Bug: ', points: 5 }}
      />,
    );
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Bug: ');
    expect((screen.getByLabelText('Points') as HTMLInputElement).value).toBe('5');
  });

  it('calls onSubmit with field values via Save button', () => {
    render(
      <InlineQuickAdd
        columnId="col1"
        fields={[textField]}
        onSubmit={onSubmit}
        onCancel={onCancel}
        defaultValues={{ title: 'task' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSubmit).toHaveBeenCalledWith('col1', { title: 'task' });
  });

  it('calls onCancel via Cancel button', () => {
    render(
      <InlineQuickAdd
        columnId="col1"
        fields={[textField]}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CardTemplates
// ---------------------------------------------------------------------------
describe('CardTemplates', () => {
  const onSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders template dropdown trigger', () => {
    render(<CardTemplates templates={sampleTemplates} onSelect={onSelect} columnId="col1" />);
    expect(screen.getByRole('button', { name: /add card to col1/i })).toBeDefined();
  });

  it('shows template options in dropdown', () => {
    render(<CardTemplates templates={sampleTemplates} onSelect={onSelect} columnId="col1" />);
    fireEvent.click(screen.getByRole('button', { name: /add card to col1/i }));
    expect(screen.getByRole('listbox', { name: /card templates/i })).toBeDefined();
    expect(screen.getByText('Bug Report')).toBeDefined();
    expect(screen.getByText('Feature')).toBeDefined();
  });

  it('calls onSelect with template when clicked', () => {
    render(<CardTemplates templates={sampleTemplates} onSelect={onSelect} columnId="col1" />);
    fireEvent.click(screen.getByRole('button', { name: /add card to col1/i }));
    fireEvent.click(screen.getByText('Bug Report'));
    expect(onSelect).toHaveBeenCalledWith(sampleTemplates[0]);
  });

  it('shows Custom option and calls onSelect(null)', () => {
    render(<CardTemplates templates={sampleTemplates} onSelect={onSelect} columnId="col1" />);
    fireEvent.click(screen.getByRole('button', { name: /add card to col1/i }));
    expect(screen.getByText('Custom')).toBeDefined();
    fireEvent.click(screen.getByText('Custom'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});

// ---------------------------------------------------------------------------
// useColumnWidths
// ---------------------------------------------------------------------------
describe('useColumnWidths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('returns default width for all columns', () => {
    const columns = makeColumns(['a', 'b']);
    const { result } = renderHook(() => useColumnWidths({ columns, defaultWidth: 300 }));
    expect(result.current.getColumnWidth('a')).toBe(300);
    expect(result.current.getColumnWidth('b')).toBe(300);
  });

  it('applies per-column overrides', () => {
    const columns = makeColumns(['a', 'b']);
    const { result } = renderHook(() => useColumnWidths({ columns, defaultWidth: 300 }));
    act(() => { result.current.setColumnWidth('a', 400); });
    expect(result.current.getColumnWidth('a')).toBe(400);
    expect(result.current.getColumnWidth('b')).toBe(300);
  });

  it('clamps to minWidth and maxWidth', () => {
    const columns = makeColumns(['a']);
    const { result } = renderHook(() =>
      useColumnWidths({ columns, defaultWidth: 300, minWidth: 200, maxWidth: 500 }),
    );
    act(() => { result.current.setColumnWidth('a', 100); });
    expect(result.current.getColumnWidth('a')).toBe(200);
    act(() => { result.current.setColumnWidth('a', 900); });
    expect(result.current.getColumnWidth('a')).toBe(500);
  });

  it('persists to localStorage', () => {
    const columns = makeColumns(['a']);
    const { result } = renderHook(() =>
      useColumnWidths({ columns, storageKey: 'board1' }),
    );
    act(() => { result.current.setColumnWidth('a', 350); });
    expect(localStorageMock.setItem).toHaveBeenCalled();
    const stored = JSON.parse(
      localStorageMock.setItem.mock.calls.at(-1)![1] as string,
    );
    expect(stored.a).toBe(350);
  });

  it('resetWidths restores defaults', () => {
    const columns = makeColumns(['a']);
    const { result } = renderHook(() =>
      useColumnWidths({ columns, defaultWidth: 320, storageKey: 'board2' }),
    );
    act(() => { result.current.setColumnWidth('a', 400); });
    expect(result.current.getColumnWidth('a')).toBe(400);
    act(() => { result.current.resetWidths(); });
    expect(result.current.getColumnWidth('a')).toBe(320);
    expect(localStorageMock.removeItem).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useCrossSwimlaneMove
// ---------------------------------------------------------------------------
describe('useCrossSwimlaneMove', () => {
  const swimlanes = [
    { id: 'team-a', title: 'Team A' },
    { id: 'team-b', title: 'Team B', acceptFrom: ['team-a'] },
    { id: 'team-c', title: 'Team C' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state (not dragging)', () => {
    const { result } = renderHook(() =>
      useCrossSwimlaneMove({ swimlanes }),
    );
    expect(result.current.isDraggingAcrossSwimlanes).toBe(false);
  });

  it('handleCrossSwimlaneMove calls onCardMove', () => {
    const onCardMove = vi.fn();
    const { result } = renderHook(() =>
      useCrossSwimlaneMove({ swimlanes, onCardMove }),
    );
    let allowed: boolean;
    act(() => {
      allowed = result.current.handleCrossSwimlaneMove('card1', 'team-a', 'team-c', 'col1');
    });
    expect(allowed!).toBe(true);
    expect(onCardMove).toHaveBeenCalledWith({
      cardId: 'card1',
      fromSwimlane: 'team-a',
      toSwimlane: 'team-c',
      columnId: 'col1',
    });
  });

  it('respects acceptFrom constraints', () => {
    const onCardMove = vi.fn();
    const { result } = renderHook(() =>
      useCrossSwimlaneMove({ swimlanes, onCardMove }),
    );

    // team-b only accepts from team-a
    let allowed: boolean;
    act(() => {
      allowed = result.current.handleCrossSwimlaneMove('card1', 'team-c', 'team-b', 'col1');
    });
    expect(allowed!).toBe(false);
    expect(onCardMove).not.toHaveBeenCalled();

    // team-a → team-b is allowed
    act(() => {
      allowed = result.current.handleCrossSwimlaneMove('card1', 'team-a', 'team-b', 'col1');
    });
    expect(allowed!).toBe(true);
    expect(onCardMove).toHaveBeenCalled();
  });

  it('isDraggingAcrossSwimlanes state tracks movement', () => {
    const { result } = renderHook(() =>
      useCrossSwimlaneMove({ swimlanes }),
    );
    expect(result.current.isDraggingAcrossSwimlanes).toBe(false);
    act(() => { result.current.startCrossSwimlaneDrag('team-a'); });
    expect(result.current.isDraggingAcrossSwimlanes).toBe(true);
    act(() => { result.current.endCrossSwimlaneDrag(); });
    expect(result.current.isDraggingAcrossSwimlanes).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// useQuickAddReorder
// ---------------------------------------------------------------------------
describe('useQuickAddReorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with provided cards', () => {
    const cards = makeCards(['1', '2', '3']);
    const { result } = renderHook(() => useQuickAddReorder({ cards }));
    expect(result.current.reorderedCards.map(c => c.id)).toEqual(['1', '2', '3']);
  });

  it('reorders cards correctly', () => {
    const cards = makeCards(['1', '2', '3']);
    const { result } = renderHook(() => useQuickAddReorder({ cards }));
    // Must be in drag state so the sync guard doesn't reset
    act(() => { result.current.startDrag(); });
    act(() => { result.current.onReorder(0, 2); });
    expect(result.current.reorderedCards.map(c => c.id)).toEqual(['2', '3', '1']);
  });

  it('returns isDragging state', () => {
    const cards = makeCards(['1']);
    const { result } = renderHook(() => useQuickAddReorder({ cards }));
    expect(result.current.isDragging).toBe(false);
    act(() => { result.current.startDrag(); });
    expect(result.current.isDragging).toBe(true);
    act(() => { result.current.endDrag(); });
    expect(result.current.isDragging).toBe(false);
  });

  it('syncs with external card changes', () => {
    const initial = makeCards(['1', '2']);
    const { result, rerender } = renderHook(
      ({ cards }) => useQuickAddReorder({ cards }),
      { initialProps: { cards: initial } },
    );
    expect(result.current.reorderedCards.map(c => c.id)).toEqual(['1', '2']);

    const updated = makeCards(['1', '2', '3']);
    rerender({ cards: updated });
    expect(result.current.reorderedCards.map(c => c.id)).toEqual(['1', '2', '3']);
  });
});

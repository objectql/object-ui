/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import * as React from 'react';
import { KanbanEnhanced, type KanbanColumn } from '../KanbanEnhanced';

// Mock @tanstack/react-virtual
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 1000,
    getVirtualItems: () => [],
    measureElement: vi.fn(),
  }),
}));

// Capture onDragEnd so tests can simulate drag-and-drop events
let capturedOnDragEnd: ((event: any) => void) | null = null;

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: any) => {
    capturedOnDragEnd = onDragEnd;
    return <div data-testid="dnd-context">{children}</div>;
  },
  DragOverlay: ({ children }: any) => <div data-testid="drag-overlay">{children}</div>,
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => [],
  closestCorners: vi.fn(),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div data-testid="sortable-context">{children}</div>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  arrayMove: (array: any[], from: number, to: number) => {
    const newArray = [...array];
    newArray.splice(to, 0, newArray.splice(from, 1)[0]);
    return newArray;
  },
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => '',
    },
  },
}));

// ---------------------------------------------------------------------------
// Undo/Redo state manager (mock integration layer)
// ---------------------------------------------------------------------------

interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}

function createUndoRedoManager<T>(initial: T) {
  const state: UndoRedoState<T> = {
    past: [],
    present: initial,
    future: [],
  };

  return {
    state,

    push(newPresent: T) {
      state.past.push(state.present);
      state.present = newPresent;
      state.future = [];
    },

    undo(): T | null {
      if (state.past.length === 0) return null;
      const previous = state.past.pop()!;
      state.future.push(state.present);
      state.present = previous;
      return previous;
    },

    redo(): T | null {
      if (state.future.length === 0) return null;
      const next = state.future.pop()!;
      state.past.push(state.present);
      state.present = next;
      return next;
    },

    get current() {
      return state.present;
    },

    get canUndo() {
      return state.past.length > 0;
    },

    get canRedo() {
      return state.future.length > 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeColumns(): KanbanColumn[] {
  return [
    {
      id: 'todo',
      title: 'To Do',
      cards: [
        { id: 'card-1', title: 'Task 1' },
        { id: 'card-2', title: 'Task 2' },
        { id: 'card-3', title: 'Task 3' },
      ],
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      cards: [
        { id: 'card-4', title: 'Task 4' },
      ],
    },
    {
      id: 'done',
      title: 'Done',
      cards: [],
    },
  ];
}

/** Deep-clone columns so mutations in the manager don't alias component state. */
function cloneColumns(cols: KanbanColumn[]): KanbanColumn[] {
  return cols.map(c => ({ ...c, cards: c.cards.map(card => ({ ...card })) }));
}

/** Apply a cross-column card move to a columns snapshot and return a new snapshot. */
function applyMove(
  columns: KanbanColumn[],
  cardId: string,
  fromColumnId: string,
  toColumnId: string,
  newIndex: number,
): KanbanColumn[] {
  const next = cloneColumns(columns);
  const fromCol = next.find(c => c.id === fromColumnId)!;
  const toCol = next.find(c => c.id === toColumnId)!;
  const cardIdx = fromCol.cards.findIndex(c => c.id === cardId);
  const [card] = fromCol.cards.splice(cardIdx, 1);
  toCol.cards.splice(newIndex, 0, card);
  return next;
}

/** Apply a same-column reorder to a columns snapshot. */
function applyReorder(
  columns: KanbanColumn[],
  columnId: string,
  cardId: string,
  toCardId: string,
): KanbanColumn[] {
  const next = cloneColumns(columns);
  const col = next.find(c => c.id === columnId)!;
  const fromIdx = col.cards.findIndex(c => c.id === cardId);
  const toIdx = col.cards.findIndex(c => c.id === toCardId);
  const [card] = col.cards.splice(fromIdx, 1);
  col.cards.splice(toIdx, 0, card);
  return next;
}

/** Find which column a card belongs to. */
function findColumnOfCard(columns: KanbanColumn[], cardId: string): string | undefined {
  return columns.find(col => col.cards.some(c => c.id === cardId))?.id;
}

/** Wrapper component that wires KanbanEnhanced to the undo/redo manager. */
function KanbanWithUndo({
  manager,
  onColumnsChange,
}: {
  manager: ReturnType<typeof createUndoRedoManager<KanbanColumn[]>>;
  onColumnsChange: (cols: KanbanColumn[]) => void;
}) {
  const [columns, setColumns] = React.useState<KanbanColumn[]>(manager.current);

  const handleCardMove = React.useCallback(
    (cardId: string, fromColumnId: string, toColumnId: string, newIndex: number) => {
      const updated = applyMove(manager.current, cardId, fromColumnId, toColumnId, newIndex);
      manager.push(updated);
      setColumns(updated);
      onColumnsChange(updated);
    },
    [manager, onColumnsChange],
  );

  // Expose a way for tests to drive undo/redo through re-render
  React.useEffect(() => {
    setColumns(manager.current);
  }, [manager.current]); // eslint-disable-line react-hooks/exhaustive-deps

  return <KanbanEnhanced columns={columns} onCardMove={handleCardMove} />;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DnD + Undo/Redo Integration', () => {
  let manager: ReturnType<typeof createUndoRedoManager<KanbanColumn[]>>;
  let onColumnsChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    capturedOnDragEnd = null;
    manager = createUndoRedoManager<KanbanColumn[]>(makeColumns());
    onColumnsChange = vi.fn();
  });

  // -----------------------------------------------------------------------
  // 1. Moving a card between columns updates the board state
  // -----------------------------------------------------------------------

  it('should update board state when a card is moved between columns', () => {
    render(<KanbanWithUndo manager={manager} onColumnsChange={onColumnsChange} />);

    // Simulate dragging card-1 from "todo" onto "in-progress" column
    act(() => {
      capturedOnDragEnd?.({
        active: { id: 'card-1' },
        over: { id: 'in-progress' },
      });
    });

    expect(onColumnsChange).toHaveBeenCalledTimes(1);

    const updatedColumns = manager.current;
    expect(findColumnOfCard(updatedColumns, 'card-1')).toBe('in-progress');

    // Original column lost the card
    const todoCards = updatedColumns.find(c => c.id === 'todo')!.cards;
    expect(todoCards.some(c => c.id === 'card-1')).toBe(false);

    // Target column gained it
    const ipCards = updatedColumns.find(c => c.id === 'in-progress')!.cards;
    expect(ipCards.some(c => c.id === 'card-1')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 2. Undo after a drag-drop reverts the card to its original column
  // -----------------------------------------------------------------------

  it('should revert the card to its original column on undo', () => {
    const { rerender } = render(
      <KanbanWithUndo manager={manager} onColumnsChange={onColumnsChange} />,
    );

    // Move card-1 → in-progress
    act(() => {
      capturedOnDragEnd?.({
        active: { id: 'card-1' },
        over: { id: 'in-progress' },
      });
    });

    expect(findColumnOfCard(manager.current, 'card-1')).toBe('in-progress');

    // Undo
    act(() => {
      manager.undo();
      rerender(<KanbanWithUndo manager={manager} onColumnsChange={onColumnsChange} />);
    });

    expect(findColumnOfCard(manager.current, 'card-1')).toBe('todo');
    expect(manager.current.find(c => c.id === 'todo')!.cards.map(c => c.id)).toContain('card-1');
  });

  // -----------------------------------------------------------------------
  // 3. Redo after undo re-applies the move
  // -----------------------------------------------------------------------

  it('should re-apply the move on redo after undo', () => {
    const { rerender } = render(
      <KanbanWithUndo manager={manager} onColumnsChange={onColumnsChange} />,
    );

    // Move card-2 → done
    act(() => {
      capturedOnDragEnd?.({
        active: { id: 'card-2' },
        over: { id: 'done' },
      });
    });

    expect(findColumnOfCard(manager.current, 'card-2')).toBe('done');

    // Undo
    act(() => {
      manager.undo();
      rerender(<KanbanWithUndo manager={manager} onColumnsChange={onColumnsChange} />);
    });

    expect(findColumnOfCard(manager.current, 'card-2')).toBe('todo');

    // Redo
    act(() => {
      manager.redo();
      rerender(<KanbanWithUndo manager={manager} onColumnsChange={onColumnsChange} />);
    });

    expect(findColumnOfCard(manager.current, 'card-2')).toBe('done');
  });

  // -----------------------------------------------------------------------
  // 4. Multiple sequential moves can be undone in reverse order
  // -----------------------------------------------------------------------

  it('should undo multiple sequential moves in reverse order', () => {
    const { rerender } = render(
      <KanbanWithUndo manager={manager} onColumnsChange={onColumnsChange} />,
    );

    // Move 1: card-1 → in-progress
    act(() => {
      capturedOnDragEnd?.({
        active: { id: 'card-1' },
        over: { id: 'in-progress' },
      });
    });

    // Move 2: card-2 → done
    act(() => {
      capturedOnDragEnd?.({
        active: { id: 'card-2' },
        over: { id: 'done' },
      });
    });

    // Move 3: card-4 → done
    act(() => {
      capturedOnDragEnd?.({
        active: { id: 'card-4' },
        over: { id: 'done' },
      });
    });

    expect(findColumnOfCard(manager.current, 'card-1')).toBe('in-progress');
    expect(findColumnOfCard(manager.current, 'card-2')).toBe('done');
    expect(findColumnOfCard(manager.current, 'card-4')).toBe('done');

    // Undo move 3 → card-4 back to in-progress
    act(() => {
      manager.undo();
      rerender(<KanbanWithUndo manager={manager} onColumnsChange={onColumnsChange} />);
    });

    expect(findColumnOfCard(manager.current, 'card-4')).toBe('in-progress');
    expect(findColumnOfCard(manager.current, 'card-2')).toBe('done');

    // Undo move 2 → card-2 back to todo
    act(() => {
      manager.undo();
      rerender(<KanbanWithUndo manager={manager} onColumnsChange={onColumnsChange} />);
    });

    expect(findColumnOfCard(manager.current, 'card-2')).toBe('todo');
    expect(findColumnOfCard(manager.current, 'card-1')).toBe('in-progress');

    // Undo move 1 → card-1 back to todo
    act(() => {
      manager.undo();
      rerender(<KanbanWithUndo manager={manager} onColumnsChange={onColumnsChange} />);
    });

    expect(findColumnOfCard(manager.current, 'card-1')).toBe('todo');
    expect(manager.canUndo).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 5. Undo stack is cleared when a new action is performed after undo
  // -----------------------------------------------------------------------

  it('should clear the redo stack when a new move is performed after undo', () => {
    const { rerender } = render(
      <KanbanWithUndo manager={manager} onColumnsChange={onColumnsChange} />,
    );

    // Move card-1 → in-progress
    act(() => {
      capturedOnDragEnd?.({
        active: { id: 'card-1' },
        over: { id: 'in-progress' },
      });
    });

    // Move card-2 → done
    act(() => {
      capturedOnDragEnd?.({
        active: { id: 'card-2' },
        over: { id: 'done' },
      });
    });

    // Undo last move (card-2 back to todo)
    act(() => {
      manager.undo();
      rerender(<KanbanWithUndo manager={manager} onColumnsChange={onColumnsChange} />);
    });

    expect(manager.canRedo).toBe(true);

    // Perform a NEW move — this should discard the redo stack
    act(() => {
      capturedOnDragEnd?.({
        active: { id: 'card-3' },
        over: { id: 'done' },
      });
    });

    expect(manager.canRedo).toBe(false);

    // The original redo (card-2 → done) is gone
    const redoResult = manager.redo();
    expect(redoResult).toBeNull();

    // But the new move is present
    expect(findColumnOfCard(manager.current, 'card-3')).toBe('done');
  });

  // -----------------------------------------------------------------------
  // 6. Moving a card within the same column (reordering) can be undone
  // -----------------------------------------------------------------------

  it('should undo a same-column card reorder', () => {
    // For same-column reorder, KanbanEnhanced handles it internally without
    // calling onCardMove. We test the undo/redo manager directly with the
    // reorder helper to validate the integration pattern.

    const initial = makeColumns();
    const reorderManager = createUndoRedoManager<KanbanColumn[]>(initial);

    // Original order in 'todo': card-1, card-2, card-3
    const todoBefore = reorderManager.current.find(c => c.id === 'todo')!;
    expect(todoBefore.cards.map(c => c.id)).toEqual(['card-1', 'card-2', 'card-3']);

    // Reorder: move card-3 before card-1
    const reordered = applyReorder(reorderManager.current, 'todo', 'card-3', 'card-1');
    reorderManager.push(reordered);

    const todoAfter = reorderManager.current.find(c => c.id === 'todo')!;
    expect(todoAfter.cards.map(c => c.id)).toEqual(['card-3', 'card-1', 'card-2']);

    // Undo → back to original order
    reorderManager.undo();

    const todoReverted = reorderManager.current.find(c => c.id === 'todo')!;
    expect(todoReverted.cards.map(c => c.id)).toEqual(['card-1', 'card-2', 'card-3']);
  });

  // -----------------------------------------------------------------------
  // Additional edge-case coverage
  // -----------------------------------------------------------------------

  it('should handle undo when there is nothing to undo', () => {
    expect(manager.canUndo).toBe(false);
    const result = manager.undo();
    expect(result).toBeNull();
    // State unchanged
    expect(findColumnOfCard(manager.current, 'card-1')).toBe('todo');
  });

  it('should handle redo when there is nothing to redo', () => {
    expect(manager.canRedo).toBe(false);
    const result = manager.redo();
    expect(result).toBeNull();
  });

  it('should render correctly after multiple undo/redo cycles', () => {
    const { rerender } = render(
      <KanbanWithUndo manager={manager} onColumnsChange={onColumnsChange} />,
    );

    // Move card-1 → done
    act(() => {
      capturedOnDragEnd?.({
        active: { id: 'card-1' },
        over: { id: 'done' },
      });
    });

    // Cycle undo ↔ redo several times
    for (let i = 0; i < 3; i++) {
      act(() => {
        manager.undo();
        rerender(<KanbanWithUndo manager={manager} onColumnsChange={onColumnsChange} />);
      });
      expect(findColumnOfCard(manager.current, 'card-1')).toBe('todo');

      act(() => {
        manager.redo();
        rerender(<KanbanWithUndo manager={manager} onColumnsChange={onColumnsChange} />);
      });
      expect(findColumnOfCard(manager.current, 'card-1')).toBe('done');
    }

    // Board still renders correctly
    expect(screen.getByText('Task 1')).toBeInTheDocument();
  });
});

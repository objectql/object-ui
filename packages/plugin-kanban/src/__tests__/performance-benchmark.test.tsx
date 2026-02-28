/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Performance benchmark tests for KanbanBoard (KanbanImpl).
 * Part of P2.4 Performance at Scale roadmap.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import type { KanbanColumn, KanbanCard, KanbanBoardProps } from '../KanbanImpl';

// Mock @dnd-kit/core
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div data-testid="dnd-context">{children}</div>,
  DragOverlay: ({ children }: any) => <div data-testid="drag-overlay">{children}</div>,
  PointerSensor: vi.fn(),
  TouchSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => [],
  closestCorners: vi.fn(),
}));

// Mock @dnd-kit/sortable
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

// Mock @dnd-kit/utilities
vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => '',
    },
  },
}));

// Mock @object-ui/components
vi.mock('@object-ui/components', () => ({
  Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>,
  Card: ({ children, ...props }: any) => <div data-testid="card" {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  ScrollArea: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

// Mock @object-ui/react
vi.mock('@object-ui/react', () => ({
  useHasDndProvider: () => false,
  useDnd: () => ({
    startDrag: vi.fn(),
    endDrag: vi.fn(),
  }),
}));

// --- Data generators ---

function generateCards(count: number): KanbanCard[] {
  const cards: KanbanCard[] = [];
  for (let i = 0; i < count; i++) {
    cards.push({
      id: `card-${i}`,
      title: `Task ${i}`,
      description: `Description for task ${i}`,
      badges: i % 3 === 0
        ? [{ label: 'High', variant: 'destructive' as const }]
        : undefined,
    });
  }
  return cards;
}

function generateColumns(
  columnCount: number,
  totalCards: number,
): KanbanColumn[] {
  const cardsPerColumn = Math.ceil(totalCards / columnCount);
  const columns: KanbanColumn[] = [];
  let cardIndex = 0;
  for (let c = 0; c < columnCount; c++) {
    const columnCards: KanbanCard[] = [];
    const count = Math.min(cardsPerColumn, totalCards - cardIndex);
    for (let i = 0; i < count; i++) {
      columnCards.push({
        id: `col${c}-card-${cardIndex}`,
        title: `Task ${cardIndex}`,
        description: `Description for task ${cardIndex}`,
        badges: cardIndex % 3 === 0
          ? [{ label: 'High', variant: 'destructive' as const }]
          : undefined,
      });
      cardIndex++;
    }
    columns.push({
      id: `col-${c}`,
      title: `Column ${c}`,
      cards: columnCards,
    });
  }
  return columns;
}

let KanbanBoard: React.ComponentType<KanbanBoardProps>;

async function setupMocksAndImport() {
  vi.resetModules();

  vi.doMock('@dnd-kit/core', () => ({
    DndContext: ({ children }: any) => React.createElement('div', { 'data-testid': 'dnd-context' }, children),
    DragOverlay: ({ children }: any) => React.createElement('div', { 'data-testid': 'drag-overlay' }, children),
    PointerSensor: vi.fn(),
    TouchSensor: vi.fn(),
    useSensor: vi.fn(),
    useSensors: () => [],
    closestCorners: vi.fn(),
  }));

  vi.doMock('@dnd-kit/sortable', () => ({
    SortableContext: ({ children }: any) => React.createElement('div', { 'data-testid': 'sortable-context' }, children),
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

  vi.doMock('@dnd-kit/utilities', () => ({
    CSS: { Transform: { toString: () => '' } },
  }));

  vi.doMock('@object-ui/components', () => ({
    Badge: ({ children, ...props }: any) => React.createElement('span', { 'data-testid': 'badge', ...props }, children),
    Card: ({ children, ...props }: any) => React.createElement('div', { 'data-testid': 'card', ...props }, children),
    CardHeader: ({ children, ...props }: any) => React.createElement('div', props, children),
    CardTitle: ({ children, ...props }: any) => React.createElement('div', props, children),
    CardDescription: ({ children, ...props }: any) => React.createElement('div', props, children),
    CardContent: ({ children, ...props }: any) => React.createElement('div', props, children),
    ScrollArea: ({ children, ...props }: any) => React.createElement('div', props, children),
  }));

  vi.doMock('@object-ui/react', () => ({
    useHasDndProvider: () => false,
    useDnd: () => ({ startDrag: vi.fn(), endDrag: vi.fn() }),
  }));

  const mod = await import('../KanbanImpl');
  KanbanBoard = mod.default;
}

// =========================================================================
// Performance Benchmarks
// =========================================================================

describe('KanbanBoard (KanbanImpl): performance benchmarks', () => {
  beforeEach(async () => {
    await setupMocksAndImport();
  });

  it('renders 100 cards spread across 5 columns under 500ms', () => {
    const columns = generateColumns(5, 100);

    const start = performance.now();
    const { container } = render(<KanbanBoard columns={columns} />);
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(500);
  });

  it('renders 200 cards spread across 5 columns under 1,000ms', () => {
    const columns = generateColumns(5, 200);

    const start = performance.now();
    const { container } = render(<KanbanBoard columns={columns} />);
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(1_000);
  });

  it('renders 500 cards spread across 5 columns under 2,000ms', () => {
    const columns = generateColumns(5, 500);

    const start = performance.now();
    const { container } = render(<KanbanBoard columns={columns} />);
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(2_000);
  });

  it('renders with 10+ columns without degradation', () => {
    const columns = generateColumns(12, 120);

    const start = performance.now();
    const { container } = render(<KanbanBoard columns={columns} />);
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(2_000);
  });

  it('renders empty board with 10+ columns quickly', () => {
    const columns = generateColumns(12, 0);

    const start = performance.now();
    const { container } = render(<KanbanBoard columns={columns} />);
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(500);
  });

  it('data generation for 1,000 cards is fast (< 100ms)', () => {
    const start = performance.now();
    const cards = generateCards(1_000);
    const elapsed = performance.now() - start;

    expect(cards).toHaveLength(1_000);
    expect(elapsed).toBeLessThan(100);
  });
});

// =========================================================================
// Scaling characteristics
// =========================================================================

describe('KanbanBoard (KanbanImpl): scaling characteristics', () => {
  beforeEach(async () => {
    await setupMocksAndImport();
  });

  it('renders all column titles for 10+ column board', () => {
    const columns = generateColumns(12, 24);
    render(<KanbanBoard columns={columns} />);

    for (let i = 0; i < 12; i++) {
      expect(document.body.textContent).toContain(`Column ${i}`);
    }
  });

  it('renders cards with badges without significant overhead', () => {
    const columns: KanbanColumn[] = [
      {
        id: 'badges-col',
        title: 'With Badges',
        cards: Array.from({ length: 100 }, (_, i) => ({
          id: `badge-card-${i}`,
          title: `Task ${i}`,
          badges: [
            { label: 'Priority', variant: 'destructive' as const },
            { label: 'Sprint 1', variant: 'secondary' as const },
          ],
        })),
      },
    ];

    const start = performance.now();
    const { container } = render(<KanbanBoard columns={columns} />);
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(2_000);
  });

  it('renders 500 cards across 10 columns under 2,000ms', () => {
    const columns = generateColumns(10, 500);

    const start = performance.now();
    const { container } = render(<KanbanBoard columns={columns} />);
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(2_000);
  });
});

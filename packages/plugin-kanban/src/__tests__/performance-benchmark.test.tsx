/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Performance benchmark tests for KanbanEnhanced.
 * Part of P2.4 Performance at Scale roadmap.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { KanbanEnhanced, type KanbanColumn, type KanbanCard } from '../KanbanEnhanced';

// Mock @tanstack/react-virtual
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 1000,
    getVirtualItems: () => [],
    measureElement: vi.fn(),
  }),
}));

// Mock @dnd-kit/core and utilities
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div data-testid="dnd-context">{children}</div>,
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
  cardsPerColumn: number,
): KanbanColumn[] {
  const columns: KanbanColumn[] = [];
  for (let c = 0; c < columnCount; c++) {
    columns.push({
      id: `col-${c}`,
      title: `Column ${c}`,
      cards: generateCards(cardsPerColumn).map((card) => ({
        ...card,
        id: `col${c}-${card.id}`,
      })),
    });
  }
  return columns;
}

// =========================================================================
// Performance Benchmarks
// =========================================================================

describe('KanbanEnhanced: performance benchmarks', () => {
  it('renders 5 columns × 200 cards (1,000 total) under 1,000ms', () => {
    const columns = generateColumns(5, 200);

    const start = performance.now();
    const { container } = render(<KanbanEnhanced columns={columns} />);
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(1_000);
  });

  it('renders 10 columns × 100 cards (1,000 total) under 1,000ms', () => {
    const columns = generateColumns(10, 100);

    const start = performance.now();
    const { container } = render(<KanbanEnhanced columns={columns} />);
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(1_000);
  });

  it('renders 5 columns × 2,000 cards (10,000 total) under 5,000ms', () => {
    const columns = generateColumns(5, 2_000);

    const start = performance.now();
    const { container } = render(<KanbanEnhanced columns={columns} />);
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(5_000);
  });

  it('handles empty columns efficiently', () => {
    const columns = generateColumns(20, 0);

    const start = performance.now();
    const { container } = render(<KanbanEnhanced columns={columns} />);
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(500);
  });

  it('data generation for 10,000 cards is fast (< 200ms)', () => {
    const start = performance.now();
    const cards = generateCards(10_000);
    const elapsed = performance.now() - start;

    expect(cards).toHaveLength(10_000);
    expect(elapsed).toBeLessThan(200);
  });
});

// =========================================================================
// Scaling characteristics
// =========================================================================

describe('KanbanEnhanced: scaling characteristics', () => {
  it('renders all column titles for large board', () => {
    const columns = generateColumns(8, 50);
    render(<KanbanEnhanced columns={columns} />);

    for (let i = 0; i < 8; i++) {
      expect(document.body.textContent).toContain(`Column ${i}`);
    }
  });

  it('renders with virtual scrolling enabled for large dataset', () => {
    const columns = generateColumns(5, 200);

    const start = performance.now();
    const { container } = render(
      <KanbanEnhanced columns={columns} enableVirtualScrolling={true} />,
    );
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(1_000);
  });

  it('renders cards with badges without significant overhead', () => {
    const columns: KanbanColumn[] = [
      {
        id: 'badges-col',
        title: 'With Badges',
        cards: Array.from({ length: 500 }, (_, i) => ({
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
    const { container } = render(<KanbanEnhanced columns={columns} />);
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(2_000);
  });
});

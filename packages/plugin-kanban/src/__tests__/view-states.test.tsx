/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * P3.3 Plugin View Robustness - Kanban View States
 *
 * Tests empty, populated, and edge-case states for KanbanEnhanced component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { KanbanEnhanced, type KanbanColumn } from '../KanbanEnhanced';

// Mock @tanstack/react-virtual
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 1000,
    getVirtualItems: () => [],
    measureElement: vi.fn(),
  }),
}));

// Mock @dnd-kit/core
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

describe('P3.3 Kanban View States', () => {
  // ---------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------
  describe('empty state', () => {
    it('renders with empty columns array', () => {
      const { container } = render(
        <KanbanEnhanced columns={[]} />
      );
      expect(container.firstElementChild).toBeInTheDocument();
    });

    it('renders columns with no cards', () => {
      const emptyColumns: KanbanColumn[] = [
        { id: 'todo', title: 'To Do', cards: [] },
        { id: 'done', title: 'Done', cards: [] },
      ];
      render(<KanbanEnhanced columns={emptyColumns} />);
      expect(screen.getByText('To Do')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('shows 0 count for empty columns', () => {
      const emptyColumns: KanbanColumn[] = [
        { id: 'todo', title: 'To Do', cards: [] },
      ];
      render(<KanbanEnhanced columns={emptyColumns} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------
  // Populated state
  // ---------------------------------------------------------------
  describe('populated state', () => {
    const populatedColumns: KanbanColumn[] = [
      {
        id: 'todo',
        title: 'To Do',
        cards: [
          { id: 'c1', title: 'Task 1', description: 'First task' },
          { id: 'c2', title: 'Task 2' },
        ],
      },
      {
        id: 'done',
        title: 'Done',
        cards: [
          { id: 'c3', title: 'Task 3', description: 'Completed' },
        ],
      },
    ];

    it('renders column titles', () => {
      render(<KanbanEnhanced columns={populatedColumns} />);
      expect(screen.getByText('To Do')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('renders card titles', () => {
      render(<KanbanEnhanced columns={populatedColumns} />);
      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.getByText('Task 2')).toBeInTheDocument();
      expect(screen.getByText('Task 3')).toBeInTheDocument();
    });

    it('renders card descriptions', () => {
      render(<KanbanEnhanced columns={populatedColumns} />);
      expect(screen.getByText('First task')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('renders card counts', () => {
      render(<KanbanEnhanced columns={populatedColumns} />);
      expect(screen.getByText('2')).toBeInTheDocument(); // To Do has 2
      expect(screen.getByText('1')).toBeInTheDocument(); // Done has 1
    });
  });

  // ---------------------------------------------------------------
  // Columns with limits
  // ---------------------------------------------------------------
  describe('columns with limits', () => {
    it('shows limit indicator', () => {
      const columns: KanbanColumn[] = [
        {
          id: 'wip',
          title: 'In Progress',
          limit: 3,
          cards: [
            { id: 'c1', title: 'Task 1' },
          ],
        },
      ];
      render(<KanbanEnhanced columns={columns} />);
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText(/1\s*\/\s*3/)).toBeInTheDocument();
    });

    it('shows warning at 80% capacity', () => {
      const columns: KanbanColumn[] = [
        {
          id: 'wip',
          title: 'WIP',
          limit: 5,
          cards: Array.from({ length: 4 }, (_, i) => ({
            id: `c${i}`,
            title: `Task ${i}`,
          })),
        },
      ];
      const { container } = render(<KanbanEnhanced columns={columns} />);
      // At 80% (4/5), should show warning styling
      expect(container.querySelector('[class*="text-yellow"]')).toBeInTheDocument();
    });

    it('shows error when over limit', () => {
      const columns: KanbanColumn[] = [
        {
          id: 'wip',
          title: 'WIP',
          limit: 2,
          cards: Array.from({ length: 3 }, (_, i) => ({
            id: `c${i}`,
            title: `Task ${i}`,
          })),
        },
      ];
      const { container } = render(<KanbanEnhanced columns={columns} />);
      // Over limit uses text-destructive class
      expect(container.querySelector('[class*="text-destructive"]')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------
  describe('edge cases', () => {
    it('handles single column', () => {
      const columns: KanbanColumn[] = [
        { id: 'only', title: 'Only Column', cards: [{ id: 'c1', title: 'Alone' }] },
      ];
      render(<KanbanEnhanced columns={columns} />);
      expect(screen.getByText('Only Column')).toBeInTheDocument();
      expect(screen.getByText('Alone')).toBeInTheDocument();
    });

    it('handles many columns', () => {
      const columns: KanbanColumn[] = Array.from({ length: 10 }, (_, i) => ({
        id: `col-${i}`,
        title: `Column ${i}`,
        cards: [],
      }));
      render(<KanbanEnhanced columns={columns} />);
      expect(screen.getByText('Column 0')).toBeInTheDocument();
      expect(screen.getByText('Column 9')).toBeInTheDocument();
    });

    it('handles cards with badges', () => {
      const columns: KanbanColumn[] = [
        {
          id: 'todo',
          title: 'To Do',
          cards: [
            {
              id: 'c1',
              title: 'Badged Task',
              badges: [
                { label: 'Urgent', variant: 'destructive' },
                { label: 'Feature', variant: 'default' },
              ],
            },
          ],
        },
      ];
      render(<KanbanEnhanced columns={columns} />);
      expect(screen.getByText('Urgent')).toBeInTheDocument();
      expect(screen.getByText('Feature')).toBeInTheDocument();
    });

    it('handles card with empty title', () => {
      const columns: KanbanColumn[] = [
        { id: 'col', title: 'Col', cards: [{ id: 'c1', title: '' }] },
      ];
      const { container } = render(<KanbanEnhanced columns={columns} />);
      expect(container).toBeInTheDocument();
    });

    it('accepts className prop', () => {
      const { container } = render(
        <KanbanEnhanced columns={[]} className="my-kanban" />
      );
      expect(container.innerHTML).toContain('my-kanban');
    });
  });
});

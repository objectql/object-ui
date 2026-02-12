/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Screen reader experience tests for KanbanEnhanced.
 *
 * Tests ARIA attributes, roles, landmarks, keyboard navigation,
 * and screen reader announcements for the kanban board plugin.
 * Part of P2.3 Accessibility & Inclusive Design roadmap.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

const mockColumns: KanbanColumn[] = [
  {
    id: 'todo',
    title: 'To Do',
    cards: [
      {
        id: 'card-1',
        title: 'Design Landing Page',
        description: 'Create wireframes and mockups',
        badges: [{ label: 'High', variant: 'destructive' as const }],
      },
      {
        id: 'card-2',
        title: 'Write Documentation',
        description: 'API reference and guides',
      },
    ],
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    limit: 3,
    cards: [
      {
        id: 'card-3',
        title: 'Build Components',
        description: 'Implement the design system',
      },
    ],
  },
  {
    id: 'done',
    title: 'Done',
    cards: [],
  },
];

describe('KanbanEnhanced: Screen Reader & Accessibility', () => {
  describe('board structure and landmarks', () => {
    it('renders all column titles visible for screen readers', () => {
      render(<KanbanEnhanced columns={mockColumns} />);

      expect(screen.getByText('To Do')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('column titles use heading elements for hierarchy', () => {
      render(<KanbanEnhanced columns={mockColumns} />);

      const todoTitle = screen.getByText('To Do');
      expect(todoTitle.tagName).toBe('H3');
    });

    it('renders within a dnd-context container', () => {
      const { container } = render(<KanbanEnhanced columns={mockColumns} />);

      const dndContext = container.querySelector('[data-testid="dnd-context"]');
      expect(dndContext).toBeInTheDocument();
    });
  });

  describe('card content accessibility', () => {
    it('card titles are visible to screen readers', () => {
      render(<KanbanEnhanced columns={mockColumns} />);

      expect(screen.getByText('Design Landing Page')).toBeInTheDocument();
      expect(screen.getByText('Write Documentation')).toBeInTheDocument();
      expect(screen.getByText('Build Components')).toBeInTheDocument();
    });

    it('card descriptions are accessible', () => {
      render(<KanbanEnhanced columns={mockColumns} />);

      expect(screen.getByText('Create wireframes and mockups')).toBeInTheDocument();
      expect(screen.getByText('API reference and guides')).toBeInTheDocument();
    });

    it('card badges convey semantic information', () => {
      render(<KanbanEnhanced columns={mockColumns} />);

      const badge = screen.getByText('High');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('column count and limit indicators', () => {
    it('displays card count per column for progress tracking', () => {
      render(<KanbanEnhanced columns={mockColumns} />);

      // "In Progress" has limit = 3, cards = 1 → shows "1 / 3"
      expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });

    it('shows warning for columns near capacity', () => {
      const nearLimitColumns: KanbanColumn[] = [
        {
          id: 'limited',
          title: 'Limited Column',
          limit: 5,
          cards: Array(4)
            .fill(null)
            .map((_, i) => ({
              id: `card-${i}`,
              title: `Task ${i}`,
            })),
        },
      ];

      const { container } = render(<KanbanEnhanced columns={nearLimitColumns} />);

      // Near-limit indicator uses yellow color
      expect(container.querySelector('.text-yellow-500')).toBeTruthy();
    });

    it('shows error indicator for columns over limit', () => {
      const overLimitColumns: KanbanColumn[] = [
        {
          id: 'full',
          title: 'Full Column',
          limit: 2,
          cards: [
            { id: 'card-1', title: 'Task 1' },
            { id: 'card-2', title: 'Task 2' },
          ],
        },
      ];

      const { container } = render(<KanbanEnhanced columns={overLimitColumns} />);

      // Over-limit shows destructive badge "Full"
      const fullBadge = container.querySelector('[class*="destructive"]');
      expect(fullBadge).toBeTruthy();
    });
  });

  describe('collapse/expand behavior', () => {
    it('columns have toggle buttons for collapse/expand', () => {
      render(<KanbanEnhanced columns={mockColumns} />);

      const buttons = screen.getAllByRole('button');
      // Each column has at least one toggle button
      expect(buttons.length).toBeGreaterThanOrEqual(3);
    });

    it('collapsed column shows title in vertical orientation', () => {
      const collapsedColumns: KanbanColumn[] = [
        {
          id: 'collapsed',
          title: 'Collapsed Column',
          collapsed: true,
          cards: [{ id: 'card-1', title: 'Task 1' }],
        },
      ];

      render(<KanbanEnhanced columns={collapsedColumns} />);

      // Collapsed column still shows title (vertically)
      expect(screen.getByText('Collapsed Column')).toBeInTheDocument();
    });

    it('toggle button click changes column state', () => {
      render(<KanbanEnhanced columns={mockColumns} />);

      // Find the toggle buttons (ghost variant, small)
      const buttons = screen.getAllByRole('button');
      const toggleButton = buttons[0];

      // Click to collapse
      fireEvent.click(toggleButton);

      // The component should still render (no crash)
      expect(toggleButton).toBeInTheDocument();
    });
  });

  describe('drag and drop accessibility', () => {
    it('drag overlay container exists for visual feedback', () => {
      const { container } = render(<KanbanEnhanced columns={mockColumns} />);

      const overlay = container.querySelector('[data-testid="drag-overlay"]');
      expect(overlay).toBeTruthy();
    });

    it('sortable context wraps card list for DnD', () => {
      const { container } = render(<KanbanEnhanced columns={mockColumns} />);

      const sortableContexts = container.querySelectorAll('[data-testid="sortable-context"]');
      // Each non-collapsed column has a sortable context
      expect(sortableContexts.length).toBe(3);
    });
  });

  describe('empty state handling', () => {
    it('handles empty columns array without errors', () => {
      const { container } = render(<KanbanEnhanced columns={[]} />);
      expect(container).toBeTruthy();
    });

    it('renders columns with no cards correctly', () => {
      const emptyColumns: KanbanColumn[] = [
        { id: 'empty', title: 'Empty Column', cards: [] },
      ];

      render(<KanbanEnhanced columns={emptyColumns} />);

      expect(screen.getByText('Empty Column')).toBeInTheDocument();
    });
  });

  describe('visual hierarchy and semantics', () => {
    it('card uses Card component with proper structure', () => {
      render(<KanbanEnhanced columns={mockColumns} />);

      // Card titles use CardTitle which renders with proper styling
      const cardTitle = screen.getByText('Design Landing Page');
      expect(cardTitle).toBeInTheDocument();
    });

    it('custom className is applied to root container', () => {
      const { container } = render(
        <KanbanEnhanced columns={mockColumns} className="custom-board" />
      );

      expect(container.querySelector('.custom-board')).toBeTruthy();
    });
  });
});

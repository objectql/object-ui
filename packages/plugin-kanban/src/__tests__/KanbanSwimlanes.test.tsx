/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock @dnd-kit/core and utilities
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div data-testid="dnd-context">{children}</div>,
  DragOverlay: ({ children }: any) => <div data-testid="drag-overlay">{children}</div>,
  PointerSensor: vi.fn(),
  TouchSensor: vi.fn(),
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

vi.mock('@object-ui/components', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  ScrollArea: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Input: (props: any) => <input {...props} />,
}));

vi.mock('@object-ui/react', () => ({
  useHasDndProvider: () => false,
  useDnd: () => ({
    startDrag: vi.fn(),
    endDrag: vi.fn(),
  }),
}));

vi.mock('lucide-react', () => ({
  Plus: () => <span>+</span>,
}));

import KanbanBoard from '../KanbanImpl';

const mockColumns = [
  {
    id: 'todo',
    title: 'To Do',
    cards: [
      { id: 'c1', title: 'Task 1', priority: 'High', category: 'Frontend' },
      { id: 'c2', title: 'Task 2', priority: 'Low', category: 'Backend' },
    ],
  },
  {
    id: 'done',
    title: 'Done',
    cards: [
      { id: 'c3', title: 'Task 3', priority: 'High', category: 'Frontend' },
      { id: 'c4', title: 'Task 4', priority: 'Medium', category: 'Backend' },
    ],
  },
];

describe('KanbanSwimlanes', () => {
  describe('without swimlaneField', () => {
    it('renders the standard flat layout with no swimlane headers', () => {
      render(<KanbanBoard columns={mockColumns} />);

      // Flat layout renders a region labelled "Kanban board"
      expect(screen.getByRole('region', { name: 'Kanban board' })).toBeInTheDocument();

      // Column titles are visible
      expect(screen.getByText('To Do')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();

      // All cards are visible
      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.getByText('Task 2')).toBeInTheDocument();
      expect(screen.getByText('Task 3')).toBeInTheDocument();
      expect(screen.getByText('Task 4')).toBeInTheDocument();

      // No swimlane region
      expect(screen.queryByRole('region', { name: 'Kanban board with swimlanes' })).not.toBeInTheDocument();
    });
  });

  describe('with swimlaneField', () => {
    it('renders swimlane row headers', () => {
      render(<KanbanBoard columns={mockColumns} swimlaneField="category" />);

      // Swimlane layout renders a region labelled "Kanban board with swimlanes"
      expect(screen.getByRole('region', { name: 'Kanban board with swimlanes' })).toBeInTheDocument();

      // Swimlane headers for each unique category value (sorted)
      expect(screen.getByText('Backend')).toBeInTheDocument();
      expect(screen.getByText('Frontend')).toBeInTheDocument();
    });

    it('renders collapsible swimlane rows with aria-expanded', () => {
      render(<KanbanBoard columns={mockColumns} swimlaneField="category" />);

      // Each swimlane header is a button with aria-expanded
      const swimlaneButtons = screen.getAllByRole('button', { expanded: true });
      expect(swimlaneButtons.length).toBe(2);
    });

    it('collapses a swimlane and hides its cards', () => {
      render(<KanbanBoard columns={mockColumns} swimlaneField="category" />);

      // Frontend cards are visible initially
      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.getByText('Task 3')).toBeInTheDocument();

      // Click the "Frontend" swimlane toggle to collapse it
      const frontendBtn = screen.getByRole('button', { name: /Frontend/i });
      fireEvent.click(frontendBtn);

      // After collapse, Frontend cards should not be visible
      // (Task 1 and Task 3 belong to Frontend)
      expect(screen.queryByText('Task 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Task 3')).not.toBeInTheDocument();

      // Backend cards should still be visible
      expect(screen.getByText('Task 2')).toBeInTheDocument();
      expect(screen.getByText('Task 4')).toBeInTheDocument();
    });

    it('expands a collapsed swimlane and shows its cards again', () => {
      render(<KanbanBoard columns={mockColumns} swimlaneField="category" />);

      const backendBtn = screen.getByRole('button', { name: /Backend/i });

      // Collapse Backend
      fireEvent.click(backendBtn);
      expect(screen.queryByText('Task 2')).not.toBeInTheDocument();
      expect(screen.queryByText('Task 4')).not.toBeInTheDocument();

      // Expand Backend
      fireEvent.click(backendBtn);
      expect(screen.getByText('Task 2')).toBeInTheDocument();
      expect(screen.getByText('Task 4')).toBeInTheDocument();
    });

    it('shows correct card counts in swimlane headers', () => {
      render(<KanbanBoard columns={mockColumns} swimlaneField="category" />);

      // Each swimlane header button contains the lane name and card count
      const backendBtn = screen.getByRole('button', { name: /Backend/i });
      expect(backendBtn.textContent).toContain('(2)');

      const frontendBtn = screen.getByRole('button', { name: /Frontend/i });
      expect(frontendBtn.textContent).toContain('(2)');
    });

    it('shows column headers above swimlane rows', () => {
      render(<KanbanBoard columns={mockColumns} swimlaneField="category" />);

      // Column titles still appear in the column headers
      expect(screen.getByText('To Do')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });
});

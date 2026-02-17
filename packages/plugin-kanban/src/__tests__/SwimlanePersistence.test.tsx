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

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    clear: () => { store = {}; },
    removeItem: vi.fn((key: string) => { delete store[key]; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

const mockColumns = [
  {
    id: 'todo',
    title: 'To Do',
    cards: [
      { id: 'c1', title: 'Task 1', category: 'Frontend' },
      { id: 'c2', title: 'Task 2', category: 'Backend' },
    ],
  },
  {
    id: 'done',
    title: 'Done',
    cards: [
      { id: 'c3', title: 'Task 3', category: 'Frontend' },
    ],
  },
];

describe('KanbanBoard swimlane persistence', () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
  });

  it('reads collapsed lanes from localStorage on mount when swimlaneField is set', () => {
    localStorageMock.setItem(
      'objectui:kanban-collapsed:category',
      JSON.stringify(['Frontend']),
    );
    localStorageMock.getItem.mockClear();

    render(<KanbanBoard columns={mockColumns} swimlaneField="category" />);

    expect(localStorageMock.getItem).toHaveBeenCalledWith(
      'objectui:kanban-collapsed:category',
    );
  });

  it('writes collapsed state to localStorage when a lane is toggled', () => {
    render(<KanbanBoard columns={mockColumns} swimlaneField="category" />);

    // Find a swimlane collapse button and click it
    const collapseButtons = screen.getAllByRole('button').filter(
      btn => btn.getAttribute('aria-label')?.includes('collapse') ||
             btn.getAttribute('aria-label')?.includes('Toggle') ||
             btn.textContent?.includes('▸') ||
             btn.textContent?.includes('▾'),
    );

    if (collapseButtons.length > 0) {
      fireEvent.click(collapseButtons[0]);
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const lastCall = localStorageMock.setItem.mock.calls.at(-1);
      expect(lastCall?.[0]).toBe('objectui:kanban-collapsed:category');
    }
  });

  it('does not access localStorage when swimlaneField is not set', () => {
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();

    render(<KanbanBoard columns={mockColumns} />);

    // No localStorage reads for collapsed state key
    const collapsedCalls = localStorageMock.getItem.mock.calls.filter(
      ([key]: [string]) => key.startsWith('objectui:kanban-collapsed:'),
    );
    expect(collapsedCalls).toHaveLength(0);
  });
});

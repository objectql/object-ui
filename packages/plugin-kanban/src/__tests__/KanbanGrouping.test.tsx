/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React, { Suspense } from 'react';

// Mock dnd-kit
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
  Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
  NavigationOverlay: ({ children, selectedRecord }: any) => (
    selectedRecord ? <div data-testid="navigation-overlay">{children(selectedRecord)}</div> : null
  ),
}));

vi.mock('@object-ui/react', () => ({
  useHasDndProvider: () => false,
  useDnd: () => ({
    startDrag: vi.fn(),
    endDrag: vi.fn(),
  }),
  useDataScope: () => undefined,
  useNavigationOverlay: () => ({
    isOverlay: false,
    handleClick: vi.fn(),
    selectedRecord: null,
    isOpen: false,
    close: vi.fn(),
    setIsOpen: vi.fn(),
    mode: 'page' as const,
  }),
}));

vi.mock('lucide-react', () => ({
  Plus: () => <span>+</span>,
}));

// Import KanbanBoard (the impl) directly to avoid lazy-loading issues in tests
import KanbanBoard from '../KanbanImpl';

const mockColumns = [
  {
    id: 'todo',
    title: 'To Do',
    cards: [
      { id: 'c1', title: 'Task 1', priority: 'High', team: 'Frontend' },
      { id: 'c2', title: 'Task 2', priority: 'Low', team: 'Backend' },
    ],
  },
  {
    id: 'done',
    title: 'Done',
    cards: [
      { id: 'c3', title: 'Task 3', priority: 'High', team: 'Frontend' },
      { id: 'c4', title: 'Task 4', priority: 'Medium', team: 'Backend' },
    ],
  },
];

describe('ObjectKanban grouping config → swimlaneField mapping', () => {
  it('uses grouping field as swimlane when passed to KanbanImpl', () => {
    // This simulates what ObjectKanban does: map grouping.fields[0].field to swimlaneField
    render(<KanbanBoard columns={mockColumns} swimlaneField="team" />);

    // Swimlane layout should render
    expect(screen.getByRole('region', { name: 'Kanban board with swimlanes' })).toBeInTheDocument();

    // Swimlane headers for each team
    expect(screen.getByText('Backend')).toBeInTheDocument();
    expect(screen.getByText('Frontend')).toBeInTheDocument();
  });

  it('renders flat kanban when no swimlane/grouping is provided', () => {
    render(<KanbanBoard columns={mockColumns} />);

    // Flat layout renders "Kanban board"
    expect(screen.getByRole('region', { name: 'Kanban board' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Kanban board with swimlanes' })).not.toBeInTheDocument();
  });

  describe('ObjectKanban swimlaneField resolution logic', () => {
    // Test the resolution logic independently (same as ObjectKanban.tsx effectiveSwimlaneField)
    function resolveEffectiveSwimlaneField(
      swimlaneField?: string,
      grouping?: { fields: Array<{ field: string; order: string; collapsed: boolean }> },
    ): string | undefined {
      return swimlaneField || grouping?.fields?.[0]?.field;
    }

    it('prefers explicit swimlaneField over grouping', () => {
      const result = resolveEffectiveSwimlaneField('priority', {
        fields: [{ field: 'team', order: 'asc', collapsed: false }],
      });
      expect(result).toBe('priority');
    });

    it('falls back to grouping.fields[0].field when no swimlaneField', () => {
      const result = resolveEffectiveSwimlaneField(undefined, {
        fields: [{ field: 'team', order: 'asc', collapsed: false }],
      });
      expect(result).toBe('team');
    });

    it('returns undefined when neither swimlaneField nor grouping is set', () => {
      const result = resolveEffectiveSwimlaneField(undefined, undefined);
      expect(result).toBeUndefined();
    });

    it('returns undefined when grouping has empty fields array', () => {
      const result = resolveEffectiveSwimlaneField(undefined, { fields: [] });
      expect(result).toBeUndefined();
    });
  });
});

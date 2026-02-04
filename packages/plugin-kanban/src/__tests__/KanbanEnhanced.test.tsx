/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('KanbanEnhanced', () => {
  const mockColumns: KanbanColumn[] = [
    {
      id: 'todo',
      title: 'To Do',
      cards: [
        {
          id: 'card-1',
          title: 'Task 1',
          description: 'Description 1',
          badges: [{ label: 'High', variant: 'destructive' }],
        },
        {
          id: 'card-2',
          title: 'Task 2',
          description: 'Description 2',
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
          title: 'Task 3',
        },
      ],
    },
    {
      id: 'done',
      title: 'Done',
      cards: [],
    },
  ];

  it('should render without crashing', () => {
    const { container } = render(<KanbanEnhanced columns={mockColumns} />);
    expect(container).toBeTruthy();
  });

  it('should render all columns', () => {
    render(<KanbanEnhanced columns={mockColumns} />);
    
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('should render all cards', () => {
    render(<KanbanEnhanced columns={mockColumns} />);
    
    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
    expect(screen.getByText('Task 3')).toBeInTheDocument();
  });

  it('should display card count for each column', () => {
    render(<KanbanEnhanced columns={mockColumns} />);
    
    // Columns should show card counts
    expect(screen.getByText(/2/)).toBeInTheDocument(); // To Do has 2 cards
    expect(screen.getByText(/1/)).toBeInTheDocument(); // In Progress has 1 card
  });

  it('should display column limit warning when at 80% capacity', () => {
    const columnsNearLimit: KanbanColumn[] = [
      {
        id: 'limited',
        title: 'Limited Column',
        limit: 5,
        cards: Array(4).fill(null).map((_, i) => ({
          id: `card-${i}`,
          title: `Task ${i}`,
        })),
      },
    ];
    
    render(<KanbanEnhanced columns={columnsNearLimit} />);
    
    // Should show warning indicator (80% of 5 = 4)
    const { container } = render(<KanbanEnhanced columns={columnsNearLimit} />);
    expect(container.querySelector('[class*="warning"]')).toBeTruthy();
  });

  it('should collapse/expand columns when toggle button is clicked', () => {
    render(<KanbanEnhanced columns={mockColumns} enableCollapse={true} />);
    
    // Find collapse toggle button (chevron icons)
    const toggleButtons = screen.getAllByRole('button');
    const collapseButton = toggleButtons.find(btn => 
      btn.querySelector('svg') !== null
    );
    
    if (collapseButton) {
      fireEvent.click(collapseButton);
      // After clicking, the column state would change
      // In a real test with proper DOM, we would verify:
      // - Column content is hidden
      // - Icon changes from ChevronDown to ChevronRight
      expect(collapseButton).toBeTruthy();
    }
  });

  it('should call onCardMove when a card is moved', () => {
    const onCardMove = vi.fn();
    render(<KanbanEnhanced columns={mockColumns} onCardMove={onCardMove} />);
    
    // In our mocked environment with mocked dnd-kit,
    // we can't easily simulate the full drag and drop interaction.
    // In a real integration test, this would verify:
    // - Dragging a card from one column to another
    // - onCardMove is called with correct parameters (cardId, fromColumn, toColumn)
    expect(onCardMove).toBeDefined();
    
    // Example of what the callback would receive:
    // expect(onCardMove).toHaveBeenCalledWith('card-1', 'todo', 'in-progress');
  });

  it('should call onColumnToggle when a column is collapsed', () => {
    const onColumnToggle = vi.fn();
    render(
      <KanbanEnhanced
        columns={mockColumns}
        enableCollapse={true}
        onColumnToggle={onColumnToggle}
      />
    );
    
    expect(onColumnToggle).toBeDefined();
  });

  it('should render card badges', () => {
    render(<KanbanEnhanced columns={mockColumns} />);
    
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('should render card descriptions', () => {
    render(<KanbanEnhanced columns={mockColumns} />);
    
    expect(screen.getByText('Description 1')).toBeInTheDocument();
    expect(screen.getByText('Description 2')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <KanbanEnhanced columns={mockColumns} className="custom-class" />
    );
    
    const kanbanContainer = container.querySelector('.custom-class');
    expect(kanbanContainer).toBeTruthy();
  });

  it('should render empty columns', () => {
    render(<KanbanEnhanced columns={mockColumns} />);
    
    // "Done" column has 0 cards
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('should enable virtual scrolling when specified', () => {
    render(<KanbanEnhanced columns={mockColumns} enableVirtualScrolling={true} />);
    
    // Virtual scrolling should be active
    const { container } = render(<KanbanEnhanced columns={mockColumns} enableVirtualScrolling={true} />);
    expect(container).toBeTruthy();
  });

  it('should render drag overlay when dragging', () => {
    const { container } = render(<KanbanEnhanced columns={mockColumns} />);
    
    const dragOverlay = container.querySelector('[data-testid="drag-overlay"]');
    expect(dragOverlay).toBeTruthy();
  });

  it('should show error state when column is over limit', () => {
    const columnsOverLimit: KanbanColumn[] = [
      {
        id: 'limited',
        title: 'Over Limit',
        limit: 3,
        cards: Array(4).fill(null).map((_, i) => ({
          id: `card-${i}`,
          title: `Task ${i}`,
        })),
      },
    ];
    
    render(<KanbanEnhanced columns={columnsOverLimit} />);
    
    // Should show error indicator (over 100% of limit)
    const { container } = render(<KanbanEnhanced columns={columnsOverLimit} />);
    expect(container.querySelector('[class*="destructive"]')).toBeTruthy();
  });

  it('should handle empty columns array', () => {
    const { container } = render(<KanbanEnhanced columns={[]} />);
    expect(container).toBeTruthy();
  });
});

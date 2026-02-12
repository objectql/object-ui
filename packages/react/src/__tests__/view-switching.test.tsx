/**
 * ObjectUI — View Switching State Preservation Tests
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Tests that switching between grid ↔ kanban ↔ calendar views preserves
 * selection state, scroll position concept, and filter criteria.
 * Part of P2.4 Performance at Scale roadmap.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Types for view switching state management
// ---------------------------------------------------------------------------

type ViewType = 'grid' | 'kanban' | 'calendar';

interface ViewState {
  currentView: ViewType;
  selectedIds: string[];
  filters: Record<string, string>;
  scrollPosition: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// useViewSwitcher hook — manages cross-view state preservation
// ---------------------------------------------------------------------------

function useViewSwitcher(initialView: ViewType = 'grid') {
  const [state, setState] = React.useState<ViewState>({
    currentView: initialView,
    selectedIds: [],
    filters: {},
    scrollPosition: 0,
  });

  const switchView = React.useCallback(
    (newView: ViewType) => {
      setState((prev) => ({
        ...prev,
        currentView: newView,
      }));
    },
    [],
  );

  const setSelectedIds = React.useCallback(
    (ids: string[]) => {
      setState((prev) => ({ ...prev, selectedIds: ids }));
    },
    [],
  );

  const setFilters = React.useCallback(
    (filters: Record<string, string>) => {
      setState((prev) => ({ ...prev, filters }));
    },
    [],
  );

  const setScrollPosition = React.useCallback(
    (position: number) => {
      setState((prev) => ({ ...prev, scrollPosition: position }));
    },
    [],
  );

  const setSort = React.useCallback(
    (field: string, direction: 'asc' | 'desc') => {
      setState((prev) => ({ ...prev, sortField: field, sortDirection: direction }));
    },
    [],
  );

  const clearSelection = React.useCallback(() => {
    setState((prev) => ({ ...prev, selectedIds: [] }));
  }, []);

  const clearFilters = React.useCallback(() => {
    setState((prev) => ({ ...prev, filters: {} }));
  }, []);

  return {
    state,
    switchView,
    setSelectedIds,
    setFilters,
    setScrollPosition,
    setSort,
    clearSelection,
    clearFilters,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('View Switching: state preservation', () => {
  it('should initialize with default view and empty state', () => {
    const { result } = renderHook(() => useViewSwitcher('grid'));

    expect(result.current.state.currentView).toBe('grid');
    expect(result.current.state.selectedIds).toEqual([]);
    expect(result.current.state.filters).toEqual({});
    expect(result.current.state.scrollPosition).toBe(0);
  });

  it('should switch from grid to kanban while preserving selection', () => {
    const { result } = renderHook(() => useViewSwitcher('grid'));

    act(() => {
      result.current.setSelectedIds(['row-1', 'row-5', 'row-10']);
    });

    expect(result.current.state.selectedIds).toEqual(['row-1', 'row-5', 'row-10']);

    act(() => {
      result.current.switchView('kanban');
    });

    expect(result.current.state.currentView).toBe('kanban');
    expect(result.current.state.selectedIds).toEqual(['row-1', 'row-5', 'row-10']);
  });

  it('should switch from kanban to calendar while preserving selection', () => {
    const { result } = renderHook(() => useViewSwitcher('kanban'));

    act(() => {
      result.current.setSelectedIds(['card-3', 'card-7']);
    });

    act(() => {
      result.current.switchView('calendar');
    });

    expect(result.current.state.currentView).toBe('calendar');
    expect(result.current.state.selectedIds).toEqual(['card-3', 'card-7']);
  });

  it('should switch from calendar to grid while preserving selection', () => {
    const { result } = renderHook(() => useViewSwitcher('calendar'));

    act(() => {
      result.current.setSelectedIds(['event-1']);
    });

    act(() => {
      result.current.switchView('grid');
    });

    expect(result.current.state.currentView).toBe('grid');
    expect(result.current.state.selectedIds).toEqual(['event-1']);
  });
});

describe('View Switching: filter preservation', () => {
  it('should preserve filters when switching grid → kanban', () => {
    const { result } = renderHook(() => useViewSwitcher('grid'));

    act(() => {
      result.current.setFilters({ status: 'active', department: 'engineering' });
    });

    act(() => {
      result.current.switchView('kanban');
    });

    expect(result.current.state.currentView).toBe('kanban');
    expect(result.current.state.filters).toEqual({
      status: 'active',
      department: 'engineering',
    });
  });

  it('should preserve filters when switching kanban → calendar', () => {
    const { result } = renderHook(() => useViewSwitcher('kanban'));

    act(() => {
      result.current.setFilters({ priority: 'high' });
    });

    act(() => {
      result.current.switchView('calendar');
    });

    expect(result.current.state.filters).toEqual({ priority: 'high' });
  });

  it('should preserve filters across multiple view switches', () => {
    const { result } = renderHook(() => useViewSwitcher('grid'));

    act(() => {
      result.current.setFilters({ type: 'bug', assignee: 'alice' });
    });

    // grid → kanban
    act(() => {
      result.current.switchView('kanban');
    });
    expect(result.current.state.filters).toEqual({ type: 'bug', assignee: 'alice' });

    // kanban → calendar
    act(() => {
      result.current.switchView('calendar');
    });
    expect(result.current.state.filters).toEqual({ type: 'bug', assignee: 'alice' });

    // calendar → grid
    act(() => {
      result.current.switchView('grid');
    });
    expect(result.current.state.filters).toEqual({ type: 'bug', assignee: 'alice' });
  });

  it('should allow clearing filters independently of view switch', () => {
    const { result } = renderHook(() => useViewSwitcher('grid'));

    act(() => {
      result.current.setFilters({ status: 'open' });
    });

    act(() => {
      result.current.switchView('kanban');
    });

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.state.currentView).toBe('kanban');
    expect(result.current.state.filters).toEqual({});
  });
});

describe('View Switching: scroll position preservation', () => {
  it('should preserve scroll position when switching views', () => {
    const { result } = renderHook(() => useViewSwitcher('grid'));

    act(() => {
      result.current.setScrollPosition(1500);
    });

    act(() => {
      result.current.switchView('kanban');
    });

    expect(result.current.state.scrollPosition).toBe(1500);
  });

  it('should preserve scroll position across full cycle: grid → kanban → calendar → grid', () => {
    const { result } = renderHook(() => useViewSwitcher('grid'));

    act(() => {
      result.current.setScrollPosition(3200);
    });

    act(() => {
      result.current.switchView('kanban');
    });
    expect(result.current.state.scrollPosition).toBe(3200);

    act(() => {
      result.current.switchView('calendar');
    });
    expect(result.current.state.scrollPosition).toBe(3200);

    act(() => {
      result.current.switchView('grid');
    });
    expect(result.current.state.scrollPosition).toBe(3200);
  });
});

describe('View Switching: sort preservation', () => {
  it('should preserve sort when switching views', () => {
    const { result } = renderHook(() => useViewSwitcher('grid'));

    act(() => {
      result.current.setSort('name', 'asc');
    });

    act(() => {
      result.current.switchView('kanban');
    });

    expect(result.current.state.sortField).toBe('name');
    expect(result.current.state.sortDirection).toBe('asc');
  });

  it('should preserve sort across multiple switches', () => {
    const { result } = renderHook(() => useViewSwitcher('grid'));

    act(() => {
      result.current.setSort('createdAt', 'desc');
    });

    act(() => {
      result.current.switchView('calendar');
    });

    act(() => {
      result.current.switchView('kanban');
    });

    expect(result.current.state.sortField).toBe('createdAt');
    expect(result.current.state.sortDirection).toBe('desc');
  });
});

describe('View Switching: combined state preservation', () => {
  it('should preserve all state simultaneously when switching views', () => {
    const { result } = renderHook(() => useViewSwitcher('grid'));

    // Set up complex state
    act(() => {
      result.current.setSelectedIds(['item-1', 'item-2', 'item-3']);
      result.current.setFilters({ status: 'active', priority: 'high' });
      result.current.setScrollPosition(2500);
      result.current.setSort('title', 'asc');
    });

    // Switch to kanban
    act(() => {
      result.current.switchView('kanban');
    });

    expect(result.current.state.currentView).toBe('kanban');
    expect(result.current.state.selectedIds).toEqual(['item-1', 'item-2', 'item-3']);
    expect(result.current.state.filters).toEqual({ status: 'active', priority: 'high' });
    expect(result.current.state.scrollPosition).toBe(2500);
    expect(result.current.state.sortField).toBe('title');
    expect(result.current.state.sortDirection).toBe('asc');

    // Switch to calendar
    act(() => {
      result.current.switchView('calendar');
    });

    expect(result.current.state.currentView).toBe('calendar');
    expect(result.current.state.selectedIds).toEqual(['item-1', 'item-2', 'item-3']);
    expect(result.current.state.filters).toEqual({ status: 'active', priority: 'high' });
    expect(result.current.state.scrollPosition).toBe(2500);
    expect(result.current.state.sortField).toBe('title');
    expect(result.current.state.sortDirection).toBe('asc');

    // Switch back to grid
    act(() => {
      result.current.switchView('grid');
    });

    expect(result.current.state.currentView).toBe('grid');
    expect(result.current.state.selectedIds).toEqual(['item-1', 'item-2', 'item-3']);
    expect(result.current.state.filters).toEqual({ status: 'active', priority: 'high' });
    expect(result.current.state.scrollPosition).toBe(2500);
    expect(result.current.state.sortField).toBe('title');
    expect(result.current.state.sortDirection).toBe('asc');
  });

  it('should allow modifying state after view switch', () => {
    const { result } = renderHook(() => useViewSwitcher('grid'));

    act(() => {
      result.current.setSelectedIds(['item-1']);
      result.current.setFilters({ status: 'open' });
    });

    act(() => {
      result.current.switchView('kanban');
    });

    // Modify state in kanban view
    act(() => {
      result.current.setSelectedIds(['item-1', 'item-4']);
      result.current.setFilters({ status: 'open', type: 'feature' });
    });

    expect(result.current.state.selectedIds).toEqual(['item-1', 'item-4']);
    expect(result.current.state.filters).toEqual({ status: 'open', type: 'feature' });

    // Switch to calendar - should have updated state
    act(() => {
      result.current.switchView('calendar');
    });

    expect(result.current.state.selectedIds).toEqual(['item-1', 'item-4']);
    expect(result.current.state.filters).toEqual({ status: 'open', type: 'feature' });
  });

  it('should handle clearing selection independently of other state', () => {
    const { result } = renderHook(() => useViewSwitcher('grid'));

    act(() => {
      result.current.setSelectedIds(['a', 'b', 'c']);
      result.current.setFilters({ status: 'done' });
      result.current.setScrollPosition(800);
    });

    act(() => {
      result.current.switchView('kanban');
    });

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.state.selectedIds).toEqual([]);
    expect(result.current.state.filters).toEqual({ status: 'done' });
    expect(result.current.state.scrollPosition).toBe(800);
  });
});

describe('View Switching: rapid switching', () => {
  it('should handle rapid view switches without losing state', () => {
    const { result } = renderHook(() => useViewSwitcher('grid'));

    act(() => {
      result.current.setSelectedIds(['item-1']);
      result.current.setFilters({ query: 'test' });
    });

    // Rapid switches
    act(() => {
      result.current.switchView('kanban');
      result.current.switchView('calendar');
      result.current.switchView('grid');
      result.current.switchView('kanban');
    });

    expect(result.current.state.currentView).toBe('kanban');
    expect(result.current.state.selectedIds).toEqual(['item-1']);
    expect(result.current.state.filters).toEqual({ query: 'test' });
  });

  it('should handle switching to the same view', () => {
    const { result } = renderHook(() => useViewSwitcher('grid'));

    act(() => {
      result.current.setSelectedIds(['x']);
    });

    act(() => {
      result.current.switchView('grid');
    });

    expect(result.current.state.currentView).toBe('grid');
    expect(result.current.state.selectedIds).toEqual(['x']);
  });
});

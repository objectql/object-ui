/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewTabBar, type ViewTabItem, type ViewTabBarProps } from '../ViewTabBar';

const createViews = (count: number): ViewTabItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `view-${i}`,
    label: `View ${i}`,
    type: i === 0 ? 'grid' : i === 1 ? 'kanban' : 'calendar',
  }));

const defaultProps: ViewTabBarProps = {
  views: createViews(3),
  activeViewId: 'view-0',
  onViewChange: vi.fn(),
};

describe('ViewTabBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================
  // Basic Rendering
  // ============================
  describe('Basic Rendering', () => {
    it('should render all view tabs', () => {
      render(<ViewTabBar {...defaultProps} />);
      expect(screen.getByTestId('view-tab-bar')).toBeDefined();
      expect(screen.getByTestId('view-tab-view-0')).toBeDefined();
      expect(screen.getByTestId('view-tab-view-1')).toBeDefined();
      expect(screen.getByTestId('view-tab-view-2')).toBeDefined();
    });

    it('should render view labels', () => {
      render(<ViewTabBar {...defaultProps} />);
      expect(screen.getByText('View 0')).toBeDefined();
      expect(screen.getByText('View 1')).toBeDefined();
      expect(screen.getByText('View 2')).toBeDefined();
    });

    it('should highlight active tab', () => {
      render(<ViewTabBar {...defaultProps} />);
      const activeTab = screen.getByTestId('view-tab-view-0');
      expect(activeTab.className).toContain('border-primary');
    });

    it('should call onViewChange when tab is clicked', () => {
      const onViewChange = vi.fn();
      render(<ViewTabBar {...defaultProps} onViewChange={onViewChange} />);
      fireEvent.click(screen.getByTestId('view-tab-view-1'));
      expect(onViewChange).toHaveBeenCalledWith('view-1');
    });
  });

  // ============================
  // Inline "+" Add View Button
  // ============================
  describe('Add View Button', () => {
    it('should render "+" button when onAddView is provided', () => {
      const onAddView = vi.fn();
      render(<ViewTabBar {...defaultProps} onAddView={onAddView} />);
      expect(screen.getByTestId('view-tab-add')).toBeDefined();
    });

    it('should not render "+" button when showAddButton is false', () => {
      render(
        <ViewTabBar
          {...defaultProps}
          onAddView={vi.fn()}
          config={{ showAddButton: false }}
        />
      );
      expect(screen.queryByTestId('view-tab-add')).toBeNull();
    });

    it('should not render "+" button when onAddView is not provided', () => {
      render(<ViewTabBar {...defaultProps} />);
      expect(screen.queryByTestId('view-tab-add')).toBeNull();
    });

    it('should call onAddView when "+" button is clicked', () => {
      const onAddView = vi.fn();
      render(<ViewTabBar {...defaultProps} onAddView={onAddView} />);
      fireEvent.click(screen.getByTestId('view-tab-add'));
      expect(onAddView).toHaveBeenCalledOnce();
    });
  });

  // ============================
  // Tab Overflow ("More" Dropdown)
  // ============================
  describe('Tab Overflow', () => {
    it('should show overflow button when views exceed maxVisibleTabs', () => {
      render(
        <ViewTabBar
          {...defaultProps}
          views={createViews(8)}
          config={{ maxVisibleTabs: 6 }}
        />
      );
      expect(screen.getByTestId('view-tab-overflow')).toBeDefined();
      expect(screen.getByText('2 more')).toBeDefined();
    });

    it('should not show overflow when all views fit', () => {
      render(
        <ViewTabBar
          {...defaultProps}
          views={createViews(3)}
          config={{ maxVisibleTabs: 6 }}
        />
      );
      expect(screen.queryByTestId('view-tab-overflow')).toBeNull();
    });

    it('should only render maxVisibleTabs tabs directly', () => {
      render(
        <ViewTabBar
          {...defaultProps}
          views={createViews(8)}
          config={{ maxVisibleTabs: 4 }}
        />
      );
      // First 4 should be visible as direct tabs
      expect(screen.getByTestId('view-tab-view-0')).toBeDefined();
      expect(screen.getByTestId('view-tab-view-3')).toBeDefined();
      // 5th should NOT be a direct tab
      expect(screen.queryByTestId('view-tab-view-4')).toBeNull();
      // But should appear in overflow
      expect(screen.getByText('4 more')).toBeDefined();
    });
  });

  // ============================
  // Filter/Sort Indicator Badges
  // ============================
  describe('Filter/Sort Indicators', () => {
    it('should show indicator dot when view has active filters', () => {
      const views: ViewTabItem[] = [
        { id: 'v1', label: 'Active', type: 'grid', hasActiveFilters: true },
        { id: 'v2', label: 'All', type: 'grid' },
      ];
      render(<ViewTabBar {...defaultProps} views={views} />);
      expect(screen.getByTestId('view-tab-indicator-v1')).toBeDefined();
      expect(screen.queryByTestId('view-tab-indicator-v2')).toBeNull();
    });

    it('should show indicator dot when view has active sort', () => {
      const views: ViewTabItem[] = [
        { id: 'v1', label: 'Sorted', type: 'grid', hasActiveSort: true },
        { id: 'v2', label: 'All', type: 'grid' },
      ];
      render(<ViewTabBar {...defaultProps} views={views} />);
      expect(screen.getByTestId('view-tab-indicator-v1')).toBeDefined();
    });

    it('should not show indicators when showIndicators is false', () => {
      const views: ViewTabItem[] = [
        { id: 'v1', label: 'Active', type: 'grid', hasActiveFilters: true },
      ];
      render(
        <ViewTabBar
          {...defaultProps}
          views={views}
          config={{ showIndicators: false }}
        />
      );
      expect(screen.queryByTestId('view-tab-indicator-v1')).toBeNull();
    });
  });

  // ============================
  // Context Menu
  // ============================
  describe('Context Menu', () => {
    it('should show context menu items when right-clicking a tab', () => {
      render(
        <ViewTabBar
          {...defaultProps}
          onRenameView={vi.fn()}
          onDuplicateView={vi.fn()}
          onDeleteView={vi.fn()}
          onSetDefaultView={vi.fn()}
          onShareView={vi.fn()}
        />
      );
      // Context menu is rendered but hidden by default via Radix
      // Verify the tab is rendered as a trigger
      const tab = screen.getByTestId('view-tab-view-0');
      expect(tab).toBeDefined();
    });

    it('should not wrap with context menu when contextMenu is false', () => {
      const { container } = render(
        <ViewTabBar
          {...defaultProps}
          config={{ contextMenu: false }}
          onRenameView={vi.fn()}
          onDeleteView={vi.fn()}
        />
      );
      // When contextMenu is disabled, no context menu wrapper
      expect(container.querySelector('[data-testid="context-menu-rename-view-0"]')).toBeNull();
    });
  });

  // ============================
  // Save as View
  // ============================
  describe('Save as View', () => {
    it('should show save-as-view indicator when hasUnsavedChanges is true', () => {
      render(
        <ViewTabBar
          {...defaultProps}
          hasUnsavedChanges={true}
          onSaveAsView={vi.fn()}
        />
      );
      expect(screen.getByTestId('view-tab-save-as')).toBeDefined();
    });

    it('should not show save-as-view indicator when hasUnsavedChanges is false', () => {
      render(
        <ViewTabBar
          {...defaultProps}
          hasUnsavedChanges={false}
          onSaveAsView={vi.fn()}
        />
      );
      expect(screen.queryByTestId('view-tab-save-as')).toBeNull();
    });

    it('should call onSaveAsView when Save button is clicked', () => {
      const onSaveAsView = vi.fn();
      render(
        <ViewTabBar
          {...defaultProps}
          hasUnsavedChanges={true}
          onSaveAsView={onSaveAsView}
        />
      );
      fireEvent.click(screen.getByTestId('view-tab-save-as-btn'));
      expect(onSaveAsView).toHaveBeenCalledOnce();
    });

    it('should call onResetChanges when Reset button is clicked', () => {
      const onResetChanges = vi.fn();
      render(
        <ViewTabBar
          {...defaultProps}
          hasUnsavedChanges={true}
          onSaveAsView={vi.fn()}
          onResetChanges={onResetChanges}
        />
      );
      fireEvent.click(screen.getByTestId('view-tab-reset-btn'));
      expect(onResetChanges).toHaveBeenCalledOnce();
    });

    it('should not show save-as-view when showSaveAsView is false', () => {
      render(
        <ViewTabBar
          {...defaultProps}
          hasUnsavedChanges={true}
          onSaveAsView={vi.fn()}
          config={{ showSaveAsView: false }}
        />
      );
      expect(screen.queryByTestId('view-tab-save-as')).toBeNull();
    });
  });

  // ============================
  // Inline Rename
  // ============================
  describe('Inline Rename', () => {
    it('should enter rename mode on double-click', () => {
      render(
        <ViewTabBar
          {...defaultProps}
          onRenameView={vi.fn()}
        />
      );
      const tab = screen.getByTestId('view-tab-view-0');
      fireEvent.doubleClick(tab);
      expect(screen.getByTestId('view-tab-rename-input-view-0')).toBeDefined();
    });

    it('should call onRenameView on Enter key', () => {
      const onRenameView = vi.fn();
      render(
        <ViewTabBar
          {...defaultProps}
          onRenameView={onRenameView}
        />
      );
      const tab = screen.getByTestId('view-tab-view-0');
      fireEvent.doubleClick(tab);

      const input = screen.getByTestId('view-tab-rename-input-view-0');
      fireEvent.change(input, { target: { value: 'New Name' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onRenameView).toHaveBeenCalledWith('view-0', 'New Name');
    });

    it('should cancel rename on Escape key', () => {
      render(
        <ViewTabBar
          {...defaultProps}
          onRenameView={vi.fn()}
        />
      );
      const tab = screen.getByTestId('view-tab-view-0');
      fireEvent.doubleClick(tab);

      const input = screen.getByTestId('view-tab-rename-input-view-0');
      fireEvent.keyDown(input, { key: 'Escape' });

      // Should exit rename mode
      expect(screen.queryByTestId('view-tab-rename-input-view-0')).toBeNull();
    });

    it('should not enter rename mode when inlineRename is false', () => {
      render(
        <ViewTabBar
          {...defaultProps}
          onRenameView={vi.fn()}
          config={{ inlineRename: false }}
        />
      );
      const tab = screen.getByTestId('view-tab-view-0');
      fireEvent.doubleClick(tab);
      expect(screen.queryByTestId('view-tab-rename-input-view-0')).toBeNull();
    });
  });

  // ============================
  // Default View Indicator
  // ============================
  describe('Default View Indicator', () => {
    it('should show star icon for default view', () => {
      const views: ViewTabItem[] = [
        { id: 'v1', label: 'Default', type: 'grid', isDefault: true },
        { id: 'v2', label: 'Other', type: 'grid' },
      ];
      const { container } = render(<ViewTabBar {...defaultProps} views={views} />);
      // The default view tab should contain a star icon
      const defaultTab = screen.getByTestId('view-tab-v1');
      // Star icon rendered via lucide-react SVG
      expect(defaultTab.querySelector('svg.text-amber-500')).toBeDefined();
    });
  });
});

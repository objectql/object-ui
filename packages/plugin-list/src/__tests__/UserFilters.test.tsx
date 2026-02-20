/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserFilters } from '../UserFilters';

describe('UserFilters', () => {
  // ============================================
  // Dropdown Mode
  // ============================================
  describe('Dropdown mode', () => {
    const dropdownConfig = {
      element: 'dropdown' as const,
      fields: [
        {
          field: 'status',
          label: 'Status',
          type: 'multi-select' as const,
          options: [
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
          ],
        },
        {
          field: 'priority',
          label: 'Priority',
          type: 'multi-select' as const,
          options: [
            { label: 'High', value: 'high', color: '#dc2626' },
            { label: 'Low', value: 'low', color: '#2563eb' },
          ],
        },
      ],
    };

    it('renders field badges with labels', () => {
      const onChange = vi.fn();
      render(<UserFilters config={dropdownConfig} onFilterChange={onChange} />);

      expect(screen.getByTestId('user-filters-dropdown')).toBeInTheDocument();
      expect(screen.getByTestId('filter-badge-status')).toBeInTheDocument();
      expect(screen.getByTestId('filter-badge-priority')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Priority')).toBeInTheDocument();
    });

    it('opens popover and shows options on click', () => {
      const onChange = vi.fn();
      render(<UserFilters config={dropdownConfig} onFilterChange={onChange} />);

      fireEvent.click(screen.getByTestId('filter-badge-status'));
      expect(screen.getByTestId('filter-options-status')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    it('selects option and emits filter change', () => {
      const onChange = vi.fn();
      render(<UserFilters config={dropdownConfig} onFilterChange={onChange} />);

      fireEvent.click(screen.getByTestId('filter-badge-status'));
      fireEvent.click(screen.getByText('Active'));

      expect(onChange).toHaveBeenCalledWith([['status', 'in', ['active']]]);
    });

    it('supports multi-select — selecting multiple options', () => {
      const onChange = vi.fn();
      render(<UserFilters config={dropdownConfig} onFilterChange={onChange} />);

      fireEvent.click(screen.getByTestId('filter-badge-status'));
      fireEvent.click(screen.getByText('Active'));
      fireEvent.click(screen.getByText('Inactive'));

      expect(onChange).toHaveBeenLastCalledWith([['status', 'in', ['active', 'inactive']]]);
    });

    it('shows count badge when options are selected', () => {
      const onChange = vi.fn();
      render(<UserFilters config={dropdownConfig} onFilterChange={onChange} />);

      fireEvent.click(screen.getByTestId('filter-badge-status'));
      fireEvent.click(screen.getByText('Active'));

      // Count badge should show "1"
      const badge = screen.getByTestId('filter-badge-status');
      expect(badge.textContent).toContain('1');
    });

    it('clears filter when X is clicked', () => {
      const onChange = vi.fn();
      render(<UserFilters config={dropdownConfig} onFilterChange={onChange} />);

      // Select an option first
      fireEvent.click(screen.getByTestId('filter-badge-status'));
      fireEvent.click(screen.getByText('Active'));

      // Click the clear button
      fireEvent.click(screen.getByTestId('filter-clear-status'));
      expect(onChange).toHaveBeenLastCalledWith([]);
    });

    it('shows record count per option when showCount is true', () => {
      const config = {
        element: 'dropdown' as const,
        fields: [{
          field: 'status',
          label: 'Status',
          showCount: true,
          options: [
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
          ],
        }],
      };
      const data = [
        { status: 'active' },
        { status: 'active' },
        { status: 'inactive' },
      ];
      const onChange = vi.fn();
      render(<UserFilters config={config} data={data} onFilterChange={onChange} />);

      fireEvent.click(screen.getByTestId('filter-badge-status'));
      // The options list should show counts
      const optionsContainer = screen.getByTestId('filter-options-status');
      expect(optionsContainer.textContent).toContain('2');
      expect(optionsContainer.textContent).toContain('1');
    });

    it('renders color dots for options with color', () => {
      const onChange = vi.fn();
      render(<UserFilters config={dropdownConfig} onFilterChange={onChange} />);

      fireEvent.click(screen.getByTestId('filter-badge-priority'));
      // Color dots should be rendered as span elements
      const optionsContainer = screen.getByTestId('filter-options-priority');
      const colorDots = optionsContainer.querySelectorAll('span[style]');
      expect(colorDots.length).toBeGreaterThanOrEqual(2);
    });

    it('auto-derives options from objectDef when not provided', () => {
      const config = {
        element: 'dropdown' as const,
        fields: [{ field: 'status', label: 'Status' }],
      };
      const objectDef = {
        fields: [
          {
            name: 'status',
            options: [
              { label: 'Open', value: 'open' },
              { label: 'Closed', value: 'closed' },
            ],
          },
        ],
      };
      const onChange = vi.fn();
      render(<UserFilters config={config} objectDef={objectDef} onFilterChange={onChange} />);

      fireEvent.click(screen.getByTestId('filter-badge-status'));
      expect(screen.getByText('Open')).toBeInTheDocument();
      expect(screen.getByText('Closed')).toBeInTheDocument();
    });

    it('applies defaultValues on mount', () => {
      const config = {
        element: 'dropdown' as const,
        fields: [{
          field: 'status',
          label: 'Status',
          options: [
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
          ],
          defaultValues: ['active'] as (string | number | boolean)[],
        }],
      };
      const onChange = vi.fn();
      render(<UserFilters config={config} onFilterChange={onChange} />);

      // Should emit default filter on mount
      expect(onChange).toHaveBeenCalledWith([['status', 'in', ['active']]]);
    });
  });

  // ============================================
  // Tabs Mode
  // ============================================
  describe('Tabs mode', () => {
    const tabsConfig = {
      element: 'tabs' as const,
      showAllRecords: true,
      allowAddTab: true,
      tabs: [
        { id: 'tab-1', label: 'Active', filters: [['status', '=', 'active']], default: true },
        { id: 'tab-2', label: 'My Items', filters: [['owner', '=', '$currentUser']] },
      ],
    };

    it('renders tab bar with tab labels', () => {
      const onChange = vi.fn();
      render(<UserFilters config={tabsConfig} onFilterChange={onChange} />);

      expect(screen.getByTestId('user-filters-tabs')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('My Items')).toBeInTheDocument();
    });

    it('renders "All records" tab when showAllRecords is true', () => {
      const onChange = vi.fn();
      render(<UserFilters config={tabsConfig} onFilterChange={onChange} />);

      expect(screen.getByText('All records')).toBeInTheDocument();
    });

    it('renders add tab button when allowAddTab is true', () => {
      const onChange = vi.fn();
      render(<UserFilters config={tabsConfig} onFilterChange={onChange} />);

      expect(screen.getByTestId('filter-tab-add')).toBeInTheDocument();
    });

    it('switches filters on tab click', () => {
      const onChange = vi.fn();
      render(<UserFilters config={tabsConfig} onFilterChange={onChange} />);

      fireEvent.click(screen.getByText('My Items'));
      expect(onChange).toHaveBeenCalledWith([['owner', '=', '$currentUser']]);
    });

    it('clears filters when "All records" tab is clicked', () => {
      const onChange = vi.fn();
      render(<UserFilters config={tabsConfig} onFilterChange={onChange} />);

      fireEvent.click(screen.getByText('All records'));
      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('emits default tab filters on mount', () => {
      const onChange = vi.fn();
      render(<UserFilters config={tabsConfig} onFilterChange={onChange} />);

      // Default tab (tab-1) should emit its filters on mount
      expect(onChange).toHaveBeenCalledWith([['status', '=', 'active']]);
    });

    it('hides "All records" tab when showAllRecords is false', () => {
      const config = {
        ...tabsConfig,
        showAllRecords: false,
      };
      const onChange = vi.fn();
      render(<UserFilters config={config} onFilterChange={onChange} />);

      expect(screen.queryByText('All records')).not.toBeInTheDocument();
    });

    it('hides add button when allowAddTab is not set', () => {
      const config = {
        ...tabsConfig,
        allowAddTab: false,
      };
      const onChange = vi.fn();
      render(<UserFilters config={config} onFilterChange={onChange} />);

      expect(screen.queryByTestId('filter-tab-add')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Toggle Mode
  // ============================================
  describe('Toggle mode', () => {
    const toggleConfig = {
      element: 'toggle' as const,
      fields: [
        { field: 'is_active', label: 'Active Only' },
        { field: 'is_vip', label: 'VIP' },
      ],
    };

    it('renders toggle buttons with labels', () => {
      const onChange = vi.fn();
      render(<UserFilters config={toggleConfig} onFilterChange={onChange} />);

      expect(screen.getByTestId('user-filters-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('filter-toggle-is_active')).toBeInTheDocument();
      expect(screen.getByTestId('filter-toggle-is_vip')).toBeInTheDocument();
      expect(screen.getByText('Active Only')).toBeInTheDocument();
      expect(screen.getByText('VIP')).toBeInTheDocument();
    });

    it('toggles button active state on click', () => {
      const onChange = vi.fn();
      render(<UserFilters config={toggleConfig} onFilterChange={onChange} />);

      fireEvent.click(screen.getByText('Active Only'));
      expect(onChange).toHaveBeenCalledWith([['is_active', '!=', null]]);

      // Click again to deactivate
      fireEvent.click(screen.getByText('Active Only'));
      expect(onChange).toHaveBeenLastCalledWith([]);
    });

    it('supports multiple active toggles', () => {
      const onChange = vi.fn();
      render(<UserFilters config={toggleConfig} onFilterChange={onChange} />);

      fireEvent.click(screen.getByText('Active Only'));
      fireEvent.click(screen.getByText('VIP'));

      // Both should be active, producing two filter conditions
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(lastCall).toHaveLength(2);
    });

    it('uses defaultValues for filter condition when provided', () => {
      const config = {
        element: 'toggle' as const,
        fields: [
          {
            field: 'status',
            label: 'Active',
            defaultValues: ['active', 'pending'] as (string | number | boolean)[],
          },
        ],
      };
      const onChange = vi.fn();
      render(<UserFilters config={config} onFilterChange={onChange} />);

      // Should emit default filter on mount
      expect(onChange).toHaveBeenCalledWith([['status', 'in', ['active', 'pending']]]);
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe('Edge cases', () => {
    it('returns null for unknown element type', () => {
      const config = { element: 'unknown' as any };
      const onChange = vi.fn();
      const { container } = render(<UserFilters config={config} onFilterChange={onChange} />);
      expect(container.innerHTML).toBe('');
    });

    it('renders empty dropdown with placeholder when no fields provided', () => {
      const config = { element: 'dropdown' as const };
      const onChange = vi.fn();
      render(<UserFilters config={config} onFilterChange={onChange} />);
      expect(screen.getByTestId('user-filters-dropdown')).toBeInTheDocument();
      expect(screen.getByTestId('user-filters-empty')).toBeInTheDocument();
      expect(screen.getByText('No filter fields')).toBeInTheDocument();
    });

    it('renders empty tabs when no tabs provided', () => {
      const config = { element: 'tabs' as const, showAllRecords: false };
      const onChange = vi.fn();
      render(<UserFilters config={config} onFilterChange={onChange} />);
      expect(screen.getByTestId('user-filters-tabs')).toBeInTheDocument();
    });
  });

  // ============================================
  // Add Filter Entry Point
  // ============================================
  describe('Add filter entry', () => {
    it('renders "Add filter" button in dropdown mode', () => {
      const config = {
        element: 'dropdown' as const,
        fields: [
          {
            field: 'status',
            label: 'Status',
            options: [
              { label: 'Active', value: 'active' },
            ],
          },
        ],
      };
      const onChange = vi.fn();
      render(<UserFilters config={config} onFilterChange={onChange} />);
      expect(screen.getByTestId('user-filters-add')).toBeInTheDocument();
      expect(screen.getByText('Add filter')).toBeInTheDocument();
    });

    it('renders "Add filter" button even when no fields are provided', () => {
      const config = { element: 'dropdown' as const };
      const onChange = vi.fn();
      render(<UserFilters config={config} onFilterChange={onChange} />);
      expect(screen.getByTestId('user-filters-add')).toBeInTheDocument();
    });
  });
});

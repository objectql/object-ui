/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NavigationDesigner } from '../NavigationDesigner';
import type { NavigationItem } from '@object-ui/types';

const MOCK_ITEMS: NavigationItem[] = [
  { id: 'nav_1', type: 'object', label: 'Contacts', icon: 'Users', objectName: 'contacts' },
  { id: 'nav_2', type: 'object', label: 'Orders', icon: 'ShoppingCart', objectName: 'orders' },
  { id: 'nav_3', type: 'group', label: 'Reports', icon: 'BarChart3', children: [
    { id: 'nav_4', type: 'report', label: 'Sales Report', reportName: 'sales' },
  ]},
];

describe('NavigationDesigner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================
  // Rendering
  // ============================
  describe('Rendering', () => {
    it('should render with items', () => {
      const onChange = vi.fn();
      render(<NavigationDesigner items={MOCK_ITEMS} onChange={onChange} />);
      expect(screen.getByTestId('navigation-designer')).toBeDefined();
      expect(screen.getByTestId('nav-designer-tree')).toBeDefined();
    });

    it('should render each navigation item', () => {
      const onChange = vi.fn();
      render(<NavigationDesigner items={MOCK_ITEMS} onChange={onChange} />);
      expect(screen.getByTestId('nav-designer-item-nav_1')).toBeDefined();
      expect(screen.getByTestId('nav-designer-item-nav_2')).toBeDefined();
      expect(screen.getByTestId('nav-designer-item-nav_3')).toBeDefined();
    });

    it('should show empty message when no items', () => {
      const onChange = vi.fn();
      render(<NavigationDesigner items={[]} onChange={onChange} />);
      expect(screen.getByText(/No navigation items/)).toBeDefined();
    });

    it('should render quick add buttons', () => {
      const onChange = vi.fn();
      render(<NavigationDesigner items={[]} onChange={onChange} />);
      expect(screen.getByTestId('nav-designer-add-object')).toBeDefined();
      expect(screen.getByTestId('nav-designer-add-dashboard')).toBeDefined();
      expect(screen.getByTestId('nav-designer-add-page')).toBeDefined();
      expect(screen.getByTestId('nav-designer-add-group')).toBeDefined();
      expect(screen.getByTestId('nav-designer-add-url')).toBeDefined();
      expect(screen.getByTestId('nav-designer-add-separator')).toBeDefined();
    });

    it('should show live preview when showPreview=true', () => {
      const onChange = vi.fn();
      render(<NavigationDesigner items={MOCK_ITEMS} onChange={onChange} showPreview />);
      expect(screen.getByTestId('nav-designer-preview')).toBeDefined();
    });

    it('should hide live preview when showPreview=false', () => {
      const onChange = vi.fn();
      render(<NavigationDesigner items={MOCK_ITEMS} onChange={onChange} showPreview={false} />);
      expect(screen.queryByTestId('nav-designer-preview')).toBeNull();
    });
  });

  // ============================
  // Adding Items
  // ============================
  describe('Adding Items', () => {
    it('should add a new object item', () => {
      const onChange = vi.fn();
      render(<NavigationDesigner items={[]} onChange={onChange} />);
      fireEvent.click(screen.getByTestId('nav-designer-add-object'));
      expect(onChange).toHaveBeenCalledOnce();
      const newItems = onChange.mock.calls[0][0] as NavigationItem[];
      expect(newItems).toHaveLength(1);
      expect(newItems[0].type).toBe('object');
    });

    it('should add a new group item', () => {
      const onChange = vi.fn();
      render(<NavigationDesigner items={[]} onChange={onChange} />);
      fireEvent.click(screen.getByTestId('nav-designer-add-group'));
      expect(onChange).toHaveBeenCalledOnce();
      const newItems = onChange.mock.calls[0][0] as NavigationItem[];
      expect(newItems[0].type).toBe('group');
      expect(newItems[0].children).toEqual([]);
    });

    it('should add a separator', () => {
      const onChange = vi.fn();
      render(<NavigationDesigner items={[]} onChange={onChange} />);
      fireEvent.click(screen.getByTestId('nav-designer-add-separator'));
      expect(onChange).toHaveBeenCalledOnce();
      const newItems = onChange.mock.calls[0][0] as NavigationItem[];
      expect(newItems[0].type).toBe('separator');
    });
  });

  // ============================
  // Removing Items
  // ============================
  describe('Removing Items', () => {
    it('should remove an item when remove button is clicked', () => {
      const onChange = vi.fn();
      render(<NavigationDesigner items={MOCK_ITEMS} onChange={onChange} />);
      fireEvent.click(screen.getByTestId('nav-designer-remove-nav_1'));
      expect(onChange).toHaveBeenCalledOnce();
      const newItems = onChange.mock.calls[0][0] as NavigationItem[];
      expect(newItems.find((i) => i.id === 'nav_1')).toBeUndefined();
    });
  });

  // ============================
  // Group Expansion
  // ============================
  describe('Group Expansion', () => {
    it('should show child items when group is expanded', () => {
      const onChange = vi.fn();
      render(<NavigationDesigner items={MOCK_ITEMS} onChange={onChange} />);
      // Groups are expanded by default
      expect(screen.getByTestId('nav-designer-item-nav_4')).toBeDefined();
    });

    it('should add child to group via add child button', () => {
      const onChange = vi.fn();
      render(<NavigationDesigner items={MOCK_ITEMS} onChange={onChange} />);
      fireEvent.click(screen.getByTestId('nav-designer-add-child-nav_3'));
      expect(onChange).toHaveBeenCalledOnce();
    });
  });

  // ============================
  // Type Badges
  // ============================
  describe('Type Badges', () => {
    it('should display type badges for items', () => {
      const onChange = vi.fn();
      render(<NavigationDesigner items={MOCK_ITEMS} onChange={onChange} />);
      expect(screen.getAllByText('Object').length).toBeGreaterThanOrEqual(2);
      // "Group" text appears in both the add button and the type badge
      expect(screen.getAllByText('Group').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================
  // Read-only Mode
  // ============================
  describe('Read-only Mode', () => {
    it('should disable add buttons in read-only mode', () => {
      const onChange = vi.fn();
      render(<NavigationDesigner items={MOCK_ITEMS} onChange={onChange} readOnly />);
      const addBtn = screen.getByTestId('nav-designer-add-object');
      expect(addBtn.hasAttribute('disabled')).toBe(true);
    });

    it('should disable remove buttons in read-only mode', () => {
      const onChange = vi.fn();
      render(<NavigationDesigner items={MOCK_ITEMS} onChange={onChange} readOnly />);
      const removeBtn = screen.getByTestId('nav-designer-remove-nav_1');
      expect(removeBtn.hasAttribute('disabled')).toBe(true);
    });
  });

  // ============================
  // i18n Integration
  // ============================
  describe('i18n Integration', () => {
    it('should display translated type badges via fallback', () => {
      const onChange = vi.fn();
      render(<NavigationDesigner items={MOCK_ITEMS} onChange={onChange} />);
      // Type badges should use fallback English
      expect(screen.getAllByText('Object').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('Group').length).toBeGreaterThanOrEqual(1);
    });

    it('should display translated empty state', () => {
      const onChange = vi.fn();
      render(<NavigationDesigner items={[]} onChange={onChange} />);
      expect(screen.getByText(/No navigation items/)).toBeDefined();
    });

    it('should display translated preview header', () => {
      const onChange = vi.fn();
      render(<NavigationDesigner items={MOCK_ITEMS} onChange={onChange} showPreview />);
      expect(screen.getByText('Live Preview')).toBeDefined();
    });
  });
});

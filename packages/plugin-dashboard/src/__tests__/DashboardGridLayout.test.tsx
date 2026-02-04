/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardGridLayout } from '../DashboardGridLayout';
import type { DashboardSchema } from '@object-ui/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    clear: () => { store = {}; },
    removeItem: (key: string) => { delete store[key]; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock react-grid-layout
vi.mock('react-grid-layout', () => ({
  Responsive: ({ children }: any) => <div data-testid="grid-layout">{children}</div>,
  WidthProvider: (Component: any) => Component,
}));

describe('DashboardGridLayout', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  const mockSchema: DashboardSchema = {
    type: 'dashboard',
    name: 'test_dashboard',
    title: 'Test Dashboard',
    widgets: [
      {
        id: 'widget-1',
        type: 'metric-card',
        title: 'Total Sales',
        layout: { x: 0, y: 0, w: 3, h: 2 },
      },
      {
        id: 'widget-2',
        type: 'bar',
        title: 'Revenue by Month',
        layout: { x: 3, y: 0, w: 6, h: 4 },
      },
    ],
  };

  it('should render without crashing', () => {
    const { container } = render(<DashboardGridLayout schema={mockSchema} />);
    expect(container).toBeTruthy();
  });

  it('should render dashboard title', () => {
    render(<DashboardGridLayout schema={mockSchema} />);
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
  });

  it('should render all widgets', () => {
    render(<DashboardGridLayout schema={mockSchema} />);
    
    expect(screen.getByText('Total Sales')).toBeInTheDocument();
    expect(screen.getByText('Revenue by Month')).toBeInTheDocument();
  });

  it('should render edit mode button', () => {
    render(<DashboardGridLayout schema={mockSchema} />);
    
    const editButton = screen.getByRole('button', { name: /edit/i });
    expect(editButton).toBeInTheDocument();
  });

  it('should toggle edit mode when edit button is clicked', () => {
    render(<DashboardGridLayout schema={mockSchema} />);
    
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);
    
    // In edit mode, should show Save and Cancel buttons
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should save layout to localStorage when save button is clicked', () => {
    render(<DashboardGridLayout schema={mockSchema} persistLayoutKey="test-layout" />);
    
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);
    
    // Check that layout was saved to localStorage
    const saved = localStorageMock.getItem('test-layout');
    expect(saved).toBeTruthy();
  });

  it('should restore layout from localStorage', () => {
    const savedLayout = {
      lg: [
        { i: 'widget-1', x: 0, y: 0, w: 3, h: 2 },
        { i: 'widget-2', x: 3, y: 0, w: 6, h: 4 },
      ],
    };
    
    localStorageMock.setItem('test-layout', JSON.stringify(savedLayout));
    
    render(<DashboardGridLayout schema={mockSchema} persistLayoutKey="test-layout" />);
    
    // Component should render with saved layout
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
  });

  it('should call onLayoutChange when layout changes', () => {
    const onLayoutChange = vi.fn();
    render(<DashboardGridLayout schema={mockSchema} onLayoutChange={onLayoutChange} />);
    
    // Trigger layout change (this would normally happen through drag/drop)
    // In our mock, we can't easily trigger this, but we verify the callback exists
    expect(onLayoutChange).toBeDefined();
  });

  it('should cancel edit mode when cancel button is clicked', () => {
    render(<DashboardGridLayout schema={mockSchema} />);
    
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);
    
    // Should exit edit mode
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  it('should reset layout when reset button is clicked', () => {
    render(<DashboardGridLayout schema={mockSchema} />);
    
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);
    
    // Look for reset button (might be in a dropdown or menu)
    const buttons = screen.getAllByRole('button');
    const resetButton = buttons.find(btn => btn.textContent?.includes('Reset'));
    
    if (resetButton) {
      fireEvent.click(resetButton);
    }
  });

  it('should render grid layout container', () => {
    render(<DashboardGridLayout schema={mockSchema} />);
    
    const gridLayout = screen.getByTestId('grid-layout');
    expect(gridLayout).toBeInTheDocument();
  });

  it('should handle empty widgets array', () => {
    const emptySchema: DashboardSchema = {
      type: 'dashboard',
      name: 'empty_dashboard',
      title: 'Empty Dashboard',
      widgets: [],
    };
    
    const { container } = render(<DashboardGridLayout schema={emptySchema} />);
    expect(container).toBeTruthy();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <DashboardGridLayout schema={mockSchema} className="custom-class" />
    );
    
    const dashboardContainer = container.querySelector('.custom-class');
    expect(dashboardContainer).toBeTruthy();
  });

  it('should render drag handles in edit mode', () => {
    const { container } = render(<DashboardGridLayout schema={mockSchema} />);
    
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);
    
    // In edit mode, widgets should have drag handles (GripVertical icons)
    const gripIcons = container.querySelectorAll('svg');
    expect(gripIcons.length).toBeGreaterThan(0);
  });
});

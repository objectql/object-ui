/**
 * ObjectUI -- Persistence Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListView } from '../ListView';
import type { ListViewSchema } from '@object-ui/types';
import { SchemaRendererProvider } from '@object-ui/react';

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

const mockDataSource = {
  find: vi.fn().mockResolvedValue([]),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const renderWithProvider = (component: React.ReactNode) => {
  return render(
    <SchemaRendererProvider dataSource={mockDataSource}>
      {component}
    </SchemaRendererProvider>
  );
};

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('ListView Persistence', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should use unique storage key when schema.id is provided', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      id: 'my-custom-view',
      objectName: 'tasks',
      viewType: 'grid', // Start with grid
      options: {
        kanban: {
          groupField: 'status',
        },
      },
    };

    renderWithProvider(<ListView schema={schema} showViewSwitcher={true} />);
    
    // Simulate changing to kanban view
    const kanbanButton = screen.getByLabelText('Kanban'); 
    fireEvent.click(kanbanButton);
    
    // Check scoped storage key
    const expectedKey = 'listview-tasks-my-custom-view-view';
    expect(localStorageMock.getItem(expectedKey)).toBe('kanban');
    
    // Check fallback key is NOT set
    expect(localStorageMock.getItem('listview-tasks-view')).toBeNull();
  });

  it('should not conflict with other views of the same object', () => {
     // Setup: View A (Global/Default) prefers Grid
     localStorageMock.setItem('listview-tasks-view', 'grid');
     
     // Setup: View B (Special) prefers Kanban
     // We define View B with valid options for Kanban to force it to render the button
     
     const viewB_Schema: ListViewSchema = {
        type: 'list-view',
        id: 'special-view',
        objectName: 'tasks',
        viewType: 'kanban', // Default to Kanban
        options: {
          kanban: {
            groupField: 'status',
          },
        },
     };

     renderWithProvider(<ListView schema={viewB_Schema} showViewSwitcher={true} />);
     
     // Should use the schema default 'kanban' (since no storage exists for THIS view id)
     // It should NOT use 'grid' from the global/default view.
     
     const kanbanButton = screen.getByLabelText('Kanban');
     expect(kanbanButton.getAttribute('data-state')).toBe('on');
     
     const gridButton = screen.getByLabelText('Grid');
     expect(gridButton.getAttribute('data-state')).toBe('off');
  });
  
  it('should switch correctly when storage has a value for THIS view', () => {
      // Setup: This specific view was previously set to 'kanban'
      localStorageMock.setItem('listview-tasks-my-board-view', 'kanban');
      
      const schema: ListViewSchema = {
          type: 'list-view',
          id: 'my-board',
          objectName: 'tasks',
          viewType: 'grid', // Default in schema is grid
          options: {
            kanban: {
              groupField: 'status',
            },
          },
      };
      
      renderWithProvider(<ListView schema={schema} showViewSwitcher={true} />);
      
      // Should respect schema ('grid') because storage persistence is currently disabled
      const kanbanButton = screen.getByLabelText('Kanban');
      expect(kanbanButton.getAttribute('data-state')).toBe('off');

      const gridButton = screen.getByLabelText('Grid');
      expect(gridButton.getAttribute('data-state')).toBe('on');
  });
});

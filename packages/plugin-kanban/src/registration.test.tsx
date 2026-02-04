import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ObjectKanbanRenderer } from './index';

// Mock dependencies
vi.mock('@object-ui/react', () => ({
  useSchemaContext: vi.fn(() => ({ dataSource: { type: 'mock-datasource' } })),
}));

// Mock the implementation
vi.mock('./ObjectKanban', () => ({
  ObjectKanban: ({ dataSource }: any) => (
    <div data-testid="kanban-mock">
        {dataSource ? `DataSource: ${dataSource.type}` : 'No DataSource'}
    </div>
  )
}));

describe('Plugin Kanban Registration', () => {
  it('renderer passes dataSource from context', () => {
    
    render(<ObjectKanbanRenderer schema={{ type: 'object-kanban' }} />);
    expect(screen.getByTestId('kanban-mock')).toHaveTextContent('DataSource: mock-datasource');
  });
});

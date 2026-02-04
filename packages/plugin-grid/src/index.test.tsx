import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ObjectGridRenderer } from './index';

// Mock dependencies
vi.mock('@object-ui/react', () => ({
  useSchemaContext: vi.fn(() => ({ dataSource: { type: 'mock-datasource' } })),
}));

vi.mock('./ObjectGrid', () => ({
  ObjectGrid: ({ dataSource }: any) => (
    <div data-testid="grid-mock">
        {dataSource ? `DataSource: ${dataSource.type}` : 'No DataSource'}
    </div>
  )
}));

describe('Plugin Grid Registration', () => {
  it('renderer passes dataSource from context', () => {
    
    render(<ObjectGridRenderer schema={{ type: 'object-grid' }} />);
    expect(screen.getByTestId('grid-mock')).toHaveTextContent('DataSource: mock-datasource');
  });
});

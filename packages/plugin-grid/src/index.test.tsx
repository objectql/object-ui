import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ObjectGridRenderer } from './index';
import { SchemaRendererProvider } from '@object-ui/react';

// Mock dependencies
vi.mock('./ObjectGrid', () => ({
  ObjectGrid: ({ dataSource }: any) => (
    <div data-testid="grid-mock">
        {dataSource ? `DataSource: ${dataSource.type}` : 'No DataSource'}
    </div>
  )
}));

describe('Plugin Grid Registration', () => {
  it('renderer passes dataSource from context', () => {
    
    render(
      <SchemaRendererProvider dataSource={{ type: 'mock-datasource' } as any}>
        <ObjectGridRenderer schema={{ type: 'object-grid' }} />
      </SchemaRendererProvider>
    );
    expect(screen.getByTestId('grid-mock')).toHaveTextContent('DataSource: mock-datasource');
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
// import { ComponentRegistry } from '@object-ui/core'; 
// Use relative path to force same instance as verified by alias
import { ObjectMapRenderer } from './index';
// import { ComponentRegistry } from '@object-ui/core';

// Mock dependencies
vi.mock('@object-ui/react', () => ({
  useSchemaContext: vi.fn(() => ({ dataSource: { type: 'mock-datasource' } })),
}));

vi.mock('./ObjectMap', () => ({
  ObjectMap: ({ dataSource }: any) => (
    <div data-testid="map-mock">
        {dataSource ? `DataSource: ${dataSource.type}` : 'No DataSource'}
    </div>
  )
}));

describe('Plugin Map Registration', () => {
  it('renderer passes dataSource from context', () => {
    render(<ObjectMapRenderer schema={{}} />);
    expect(screen.getByTestId('map-mock')).toHaveTextContent('DataSource: mock-datasource');
  });
});

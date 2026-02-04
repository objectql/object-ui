import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ObjectGanttRenderer } from './index';

// Mock dependencies
vi.mock('@object-ui/react', () => ({
  useSchemaContext: vi.fn(() => ({ dataSource: { type: 'mock-datasource' } })),
}));

vi.mock('./ObjectGantt', () => ({
  ObjectGantt: ({ dataSource }: any) => (
    <div data-testid="gantt-mock">
        {dataSource ? `DataSource: ${dataSource.type}` : 'No DataSource'}
    </div>
  )
}));

describe('Plugin Gantt Registration', () => {
  it('renderer passes dataSource from context', () => {
    // Note: We test the renderer directly to avoid singleton issues with ComponentRegistry in tests
    render(<ObjectGanttRenderer schema={{}} />);
    expect(screen.getByTestId('gantt-mock')).toHaveTextContent('DataSource: mock-datasource');
  });
});

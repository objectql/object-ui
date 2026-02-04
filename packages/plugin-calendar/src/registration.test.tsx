import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ObjectCalendarRenderer } from './index';

// Mock dependencies
vi.mock('@object-ui/react', () => ({
  useSchemaContext: vi.fn(() => ({ dataSource: { type: 'mock-datasource' } })),
}));

// Mock the implementation
vi.mock('./ObjectCalendar', () => ({
  ObjectCalendar: ({ dataSource }: any) => (
    <div data-testid="calendar-mock">
        {dataSource ? `DataSource: ${dataSource.type}` : 'No DataSource'}
    </div>
  )
}));

describe('Plugin Calendar Registration', () => {
  it('renderer passes dataSource from context', () => {
    render(<ObjectCalendarRenderer schema={{ type: 'object-calendar' }} />);
    expect(screen.getByTestId('calendar-mock')).toHaveTextContent('DataSource: mock-datasource');
  });
});

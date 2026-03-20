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
  ObjectCalendar: ({ dataSource, data, loading }: any) => (
    <div data-testid="calendar-mock">
        {dataSource ? `DataSource: ${dataSource.type}` : 'No DataSource'}
        {data !== undefined ? ` Data: ${JSON.stringify(data)}` : ''}
        {loading !== undefined ? ` Loading: ${loading}` : ''}
    </div>
  )
}));

describe('Plugin Calendar Registration', () => {
  it('renderer passes dataSource from context', () => {
    render(<ObjectCalendarRenderer schema={{ type: 'object-calendar' }} />);
    expect(screen.getByTestId('calendar-mock')).toHaveTextContent('DataSource: mock-datasource');
  });

  it('renderer passes data and loading props through to ObjectCalendar (no double-fetch)', () => {
    const preloadedData = [{ id: 1, name: 'Event A' }];
    render(
      <ObjectCalendarRenderer
        schema={{ type: 'object-calendar' }}
        data={preloadedData}
        loading={false}
      />
    );
    const el = screen.getByTestId('calendar-mock');
    expect(el).toHaveTextContent('Data: [{"id":1,"name":"Event A"}]');
    expect(el).toHaveTextContent('Loading: false');
  });
});

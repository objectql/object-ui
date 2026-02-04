import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ObjectTimelineRenderer } from './index';

// Mock dependencies
vi.mock('@object-ui/react', () => ({
  useSchemaContext: vi.fn(() => ({ dataSource: { type: 'mock-datasource' } })),
}));

vi.mock('./ObjectTimeline', () => ({
  ObjectTimeline: ({ dataSource }: any) => (
    <div data-testid="timeline-mock">
        {dataSource ? `DataSource: ${dataSource.type}` : 'No DataSource'}
    </div>
  )
}));

describe('Plugin Timeline Registration', () => {
  it('renderer passes dataSource from context', () => {
    render(<ObjectTimelineRenderer schema={{ type: 'object-timeline' }} />);
    expect(screen.getByTestId('timeline-mock')).toHaveTextContent('DataSource: mock-datasource');
  });
});

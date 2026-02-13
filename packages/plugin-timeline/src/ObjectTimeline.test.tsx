import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ObjectTimeline } from './ObjectTimeline';
import { DataSource } from '@object-ui/types';

// Mock useDataScope and useNavigationOverlay
vi.mock('@object-ui/react', () => ({
  useDataScope: () => undefined,
  useNavigationOverlay: () => ({
    isOverlay: false,
    handleClick: vi.fn(),
    selectedRecord: null,
    isOpen: false,
    close: vi.fn(),
    setIsOpen: vi.fn(),
    mode: 'overlay',
  }),
}));

vi.mock('@object-ui/components', () => ({
  NavigationOverlay: () => null,
}));

vi.mock('./renderer', () => ({
  TimelineRenderer: ({ schema }: any) => (
    <div data-testid="timeline-view">
      {schema.items?.map((t: any, idx: number) => (
        <div key={idx} data-testid="timeline-item">{t.title}</div>
      ))}
    </div>
  ),
}));

const mockData = [
  { id: '1', name: 'Event 1', date: '2024-01-01', description: 'Desc 1' },
];

const mockDataSource: DataSource = {
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getObjectSchema: vi.fn(),
};

describe('ObjectTimeline', () => {
    it('renders with static items', async () => {
        const schema: any = {
            type: 'timeline',
            items: [
                { title: 'Static Event', date: '2024-01-01' }
            ]
        };
        render(<ObjectTimeline schema={schema} />);
        await waitFor(() => {
            expect(screen.getByText('Static Event')).toBeDefined();
        });
    });

    it('fetches data when objectName is provided', async () => {
        (mockDataSource.find as any).mockResolvedValue(mockData);
        
        const schema: any = {
            type: 'timeline',
            objectName: 'events',
            titleField: 'name',
            dateField: 'date' // Mapping needs to be correct in logic
        };

        render(<ObjectTimeline schema={schema} dataSource={mockDataSource} />);

        await waitFor(() => {
             expect(mockDataSource.find).toHaveBeenCalled();
        });

        await waitFor(() => {
            expect(screen.getByText('Event 1')).toBeDefined();
        });
    });
});

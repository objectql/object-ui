import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ObjectTimeline } from './ObjectTimeline';
import { DataSource } from '@object-ui/types';

// Mock useDataScope and useNavigationOverlay
vi.mock('@object-ui/react', async () => {
  const React = await import('react');
  return {
    useDataScope: () => undefined,
    useNavigationOverlay: () => ({
      isOverlay: false,
      handleClick: vi.fn(),
      selectedRecord: null,
      isOpen: false,
      close: vi.fn(),
      setIsOpen: vi.fn(),
      mode: 'overlay',
      view: undefined,
    }),
    SchemaRendererContext: React.createContext(null),
  };
});

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
            dateField: 'date' // Backward-compat: legacy dateField still works
        };

        render(<ObjectTimeline schema={schema} dataSource={mockDataSource} />);

        await waitFor(() => {
             expect(mockDataSource.find).toHaveBeenCalled();
        });

        await waitFor(() => {
            expect(screen.getByText('Event 1')).toBeDefined();
        });
    });

    it('uses spec-compliant startDateField property', async () => {
        const dataWithDates = [
            { id: '1', name: 'Sprint 1', start_date: '2024-01-01', end_date: '2024-01-14', team: 'Alpha' },
        ];
        (mockDataSource.find as any).mockResolvedValue(dataWithDates);

        const schema: any = {
            type: 'timeline',
            objectName: 'sprints',
            titleField: 'name',
            startDateField: 'start_date',
            endDateField: 'end_date',
        };

        render(<ObjectTimeline schema={schema} dataSource={mockDataSource} />);

        await waitFor(() => {
            expect(screen.getByText('Sprint 1')).toBeDefined();
        });
    });

    it('supports groupByField and colorField properties', async () => {
        const dataWithGroups = [
            { id: '1', name: 'Task A', start_date: '2024-01-01', team: 'Alpha', priority: 'high' },
        ];
        (mockDataSource.find as any).mockResolvedValue(dataWithGroups);

        const schema: any = {
            type: 'timeline',
            objectName: 'tasks',
            titleField: 'name',
            startDateField: 'start_date',
            groupByField: 'team',
            colorField: 'priority',
        };

        render(<ObjectTimeline schema={schema} dataSource={mockDataSource} />);

        await waitFor(() => {
            expect(screen.getByText('Task A')).toBeDefined();
        });
    });

    it('supports scale property', () => {
        const schema: any = {
            type: 'timeline',
            items: [
                { title: 'Weekly Event', date: '2024-01-01' }
            ],
            scale: 'week',
        };
        render(<ObjectTimeline schema={schema} />);
        expect(screen.getByText('Weekly Event')).toBeDefined();
    });
});

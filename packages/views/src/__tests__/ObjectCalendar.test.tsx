/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ObjectCalendar } from '../ObjectCalendar';
import type { ObjectGridSchema, DataSource } from '@object-ui/types';

describe('ObjectCalendar', () => {
  let mockDataSource: DataSource;
  let mockSchema: ObjectGridSchema;

  beforeEach(() => {
    // Mock data source
    mockDataSource = {
      find: vi.fn().mockResolvedValue({
        data: [
          {
            _id: '1',
            title: 'Meeting 1',
            start_date: '2026-01-15T10:00:00Z',
            end_date: '2026-01-15T11:00:00Z',
          },
          {
            _id: '2',
            title: 'Meeting 2',
            start_date: '2026-01-20T14:00:00Z',
            end_date: '2026-01-20T15:00:00Z',
          },
        ],
      }),
      getObjectSchema: vi.fn().mockResolvedValue({
        name: 'events',
        label: 'Events',
        fields: {
          title: { type: 'text', label: 'Title' },
          start_date: { type: 'datetime', label: 'Start Date' },
          end_date: { type: 'datetime', label: 'End Date' },
        },
      }),
    } as any;

    // Mock schema with calendar config
    mockSchema = {
      type: 'object-grid',
      objectName: 'events',
      data: {
        provider: 'object',
        object: 'events',
      },
      filter: {
        calendar: {
          startDateField: 'start_date',
          endDateField: 'end_date',
          titleField: 'title',
        },
      },
    } as any;
  });

  it('should render loading state initially', () => {
    render(<ObjectCalendar schema={mockSchema} dataSource={mockDataSource} />);
    expect(screen.getByText(/Loading calendar/i)).toBeInTheDocument();
  });

  it('should fetch and display calendar data', async () => {
    render(<ObjectCalendar schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalledWith('events', expect.any(Object));
    });

    await waitFor(() => {
      expect(screen.getByText('Meeting 1')).toBeInTheDocument();
      expect(screen.getByText('Meeting 2')).toBeInTheDocument();
    });
  });

  it('should render with inline data', async () => {
    // Test inline data with the same structure as the mock data
    const inlineDataSchema: ObjectGridSchema = {
      ...mockSchema,
      data: {
        provider: 'value',
        items: [
          {
            _id: '1',
            title: 'Event A',
            start_date: '2026-01-15T10:00:00Z',
            end_date: '2026-01-15T11:00:00Z',
          },
        ],
      },
    } as any;

    // Don't pass dataSource for inline data
    render(<ObjectCalendar schema={inlineDataSchema} />);

    await waitFor(() => {
      expect(screen.getByText('Event A')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should show error when calendar config is missing', async () => {
    const schemaWithoutCalendar = {
      ...mockSchema,
      filter: {},
    } as any;

    render(<ObjectCalendar schema={schemaWithoutCalendar} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByText(/Calendar configuration required/i)).toBeInTheDocument();
    });
  });

  it('should display month navigation', async () => {
    render(<ObjectCalendar schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });
  });

  it('should handle event click', async () => {
    const onEventClick = vi.fn();
    render(
      <ObjectCalendar
        schema={mockSchema}
        dataSource={mockDataSource}
        onEventClick={onEventClick}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Meeting 1')).toBeInTheDocument();
    });

    const event = screen.getByText('Meeting 1');
    event.click();
    
    expect(onEventClick).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Meeting 1' })
    );
  });

  it('should display day names header', async () => {
    render(<ObjectCalendar schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByText('Sun')).toBeInTheDocument();
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Tue')).toBeInTheDocument();
      expect(screen.getByText('Wed')).toBeInTheDocument();
      expect(screen.getByText('Thu')).toBeInTheDocument();
      expect(screen.getByText('Fri')).toBeInTheDocument();
      expect(screen.getByText('Sat')).toBeInTheDocument();
    });
  });
});

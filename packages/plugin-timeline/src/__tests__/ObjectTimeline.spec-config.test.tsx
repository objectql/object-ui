/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ObjectTimeline } from '../ObjectTimeline';

// Mock dependencies
vi.mock('@object-ui/react', () => ({
  useDataScope: () => undefined,
  useNavigationOverlay: () => ({
    isOverlay: false,
    handleClick: vi.fn(),
    selectedRecord: null,
    isOpen: false,
    close: vi.fn(),
    setIsOpen: vi.fn(),
    mode: 'page' as const,
    width: undefined,
    view: undefined,
    open: vi.fn(),
  }),
}));

vi.mock('@object-ui/components', () => ({
  NavigationOverlay: () => null,
}));

vi.mock('@object-ui/mobile', () => ({
  usePullToRefresh: () => ({
    ref: { current: null },
    isRefreshing: false,
    pullDistance: 0,
  }),
}));

// Mock the TimelineRenderer to inspect the schema it receives
const mockTimelineRenderer = vi.fn(() => <div data-testid="timeline-renderer" />);
vi.mock('../renderer', () => ({
  TimelineRenderer: (props: any) => mockTimelineRenderer(props),
}));

describe('ObjectTimeline Spec Config', () => {
  beforeEach(() => {
    mockTimelineRenderer.mockClear();
  });

  const mockData = [
    { id: '1', name: 'Event A', start_date: '2024-01-01', end_date: '2024-01-15', category: 'work', priority_color: 'red' },
    { id: '2', name: 'Event B', start_date: '2024-02-01', end_date: '2024-02-28', category: 'personal', priority_color: 'blue' },
  ];

  describe('nested timeline config', () => {
    it('uses timeline.startDateField to resolve start dates', () => {
      const schema: any = {
        type: 'timeline' as const,
        objectName: 'events',
        timeline: { startDateField: 'start_date', titleField: 'name' },
      };
      render(<ObjectTimeline schema={schema} data={mockData} />);
      expect(mockTimelineRenderer).toHaveBeenCalled();
      const renderedSchema = mockTimelineRenderer.mock.calls[0][0].schema;
      expect(renderedSchema.items[0].time).toBe('2024-01-01');
      expect(renderedSchema.items[0].startDate).toBe('2024-01-01');
    });

    it('uses timeline.titleField to resolve titles', () => {
      const schema: any = {
        type: 'timeline' as const,
        objectName: 'events',
        timeline: { startDateField: 'start_date', titleField: 'name' },
      };
      render(<ObjectTimeline schema={schema} data={mockData} />);
      const renderedSchema = mockTimelineRenderer.mock.calls[0][0].schema;
      expect(renderedSchema.items[0].title).toBe('Event A');
      expect(renderedSchema.items[1].title).toBe('Event B');
    });

    it('uses timeline.endDateField to resolve end dates', () => {
      const schema: any = {
        type: 'timeline' as const,
        objectName: 'events',
        timeline: { startDateField: 'start_date', endDateField: 'end_date', titleField: 'name' },
      };
      render(<ObjectTimeline schema={schema} data={mockData} />);
      const renderedSchema = mockTimelineRenderer.mock.calls[0][0].schema;
      expect(renderedSchema.items[0].endDate).toBe('2024-01-15');
    });

    it('uses timeline.groupByField to add group property', () => {
      const schema: any = {
        type: 'timeline' as const,
        objectName: 'events',
        timeline: { startDateField: 'start_date', titleField: 'name', groupByField: 'category' },
      };
      render(<ObjectTimeline schema={schema} data={mockData} />);
      const renderedSchema = mockTimelineRenderer.mock.calls[0][0].schema;
      expect(renderedSchema.items[0].group).toBe('work');
      expect(renderedSchema.items[1].group).toBe('personal');
    });

    it('uses timeline.colorField to add color property', () => {
      const schema: any = {
        type: 'timeline' as const,
        objectName: 'events',
        timeline: { startDateField: 'start_date', titleField: 'name', colorField: 'priority_color' },
      };
      render(<ObjectTimeline schema={schema} data={mockData} />);
      const renderedSchema = mockTimelineRenderer.mock.calls[0][0].schema;
      expect(renderedSchema.items[0].color).toBe('red');
      expect(renderedSchema.items[1].color).toBe('blue');
    });

    it('uses timeline.scale to set timeScale on rendered schema', () => {
      const schema: any = {
        type: 'timeline' as const,
        objectName: 'events',
        timeline: { startDateField: 'start_date', titleField: 'name', scale: 'month' },
      };
      render(<ObjectTimeline schema={schema} data={mockData} />);
      const renderedSchema = mockTimelineRenderer.mock.calls[0][0].schema;
      expect(renderedSchema.timeScale).toBe('month');
    });

    it('timeline.scale supports all valid values', () => {
      const scales = ['hour', 'day', 'week', 'month', 'quarter', 'year'] as const;
      scales.forEach((scale) => {
        mockTimelineRenderer.mockClear();
        const schema: any = {
          type: 'timeline' as const,
          objectName: 'events',
          timeline: { startDateField: 'start_date', titleField: 'name', scale },
        };
        render(<ObjectTimeline schema={schema} data={mockData} />);
        const renderedSchema = mockTimelineRenderer.mock.calls[0][0].schema;
        expect(renderedSchema.timeScale).toBe(scale);
      });
    });
  });

  describe('backward compatibility', () => {
    it('falls back to flat startDateField when timeline config is not set', () => {
      const schema: any = {
        type: 'timeline' as const,
        objectName: 'events',
        startDateField: 'start_date',
        titleField: 'name',
      };
      render(<ObjectTimeline schema={schema} data={mockData} />);
      const renderedSchema = mockTimelineRenderer.mock.calls[0][0].schema;
      expect(renderedSchema.items[0].time).toBe('2024-01-01');
    });

    it('falls back to legacy dateField when startDateField is not set', () => {
      const data = [{ id: '1', name: 'Event', legacy_date: '2024-03-15' }];
      const schema: any = {
        type: 'timeline' as const,
        objectName: 'events',
        dateField: 'legacy_date',
        titleField: 'name',
      };
      render(<ObjectTimeline schema={schema} data={data} />);
      const renderedSchema = mockTimelineRenderer.mock.calls[0][0].schema;
      expect(renderedSchema.items[0].time).toBe('2024-03-15');
    });

    it('falls back to flat groupByField when timeline.groupByField is not set', () => {
      const schema: any = {
        type: 'timeline' as const,
        objectName: 'events',
        startDateField: 'start_date',
        titleField: 'name',
        groupByField: 'category',
      };
      render(<ObjectTimeline schema={schema} data={mockData} />);
      const renderedSchema = mockTimelineRenderer.mock.calls[0][0].schema;
      expect(renderedSchema.items[0].group).toBe('work');
    });

    it('falls back to flat colorField when timeline.colorField is not set', () => {
      const schema: any = {
        type: 'timeline' as const,
        objectName: 'events',
        startDateField: 'start_date',
        titleField: 'name',
        colorField: 'priority_color',
      };
      render(<ObjectTimeline schema={schema} data={mockData} />);
      const renderedSchema = mockTimelineRenderer.mock.calls[0][0].schema;
      expect(renderedSchema.items[0].color).toBe('red');
    });

    it('falls back to flat scale when timeline.scale is not set', () => {
      const schema: any = {
        type: 'timeline' as const,
        objectName: 'events',
        startDateField: 'start_date',
        titleField: 'name',
        scale: 'week',
      };
      render(<ObjectTimeline schema={schema} data={mockData} />);
      const renderedSchema = mockTimelineRenderer.mock.calls[0][0].schema;
      expect(renderedSchema.timeScale).toBe('week');
    });

    it('spec timeline config takes priority over flat props', () => {
      const schema: any = {
        type: 'timeline' as const,
        objectName: 'events',
        startDateField: 'end_date',      // flat — should be overridden
        titleField: 'id',                 // flat — should be overridden
        groupByField: 'priority_color',   // flat — should be overridden
        timeline: {
          startDateField: 'start_date',   // spec — takes priority
          titleField: 'name',             // spec — takes priority
          groupByField: 'category',       // spec — takes priority
        },
      };
      render(<ObjectTimeline schema={schema} data={mockData} />);
      const renderedSchema = mockTimelineRenderer.mock.calls[0][0].schema;
      expect(renderedSchema.items[0].time).toBe('2024-01-01');
      expect(renderedSchema.items[0].title).toBe('Event A');
      expect(renderedSchema.items[0].group).toBe('work');
    });
  });
});

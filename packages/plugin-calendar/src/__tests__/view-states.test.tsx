/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * P3.3 Plugin View Robustness - Calendar View States
 *
 * Tests empty, populated, and edge-case states for CalendarView component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { CalendarView, type CalendarEvent } from '../CalendarView';

// Mock ResizeObserver
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserver;

// Mock PointerEvents for Radix
if (!global.PointerEvent) {
  class PointerEvent extends Event {
    button: number;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    constructor(type: string, props: any = {}) {
      super(type, props);
      this.button = props.button || 0;
      this.ctrlKey = props.ctrlKey || false;
      this.metaKey = props.metaKey || false;
      this.shiftKey = props.shiftKey || false;
    }
  }
  // @ts-expect-error Mocking global PointerEvent
  global.PointerEvent = PointerEvent as any;
}

// Mock HTMLElement.offsetParent for Radix Popper
Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
  get() {
    return this.parentElement;
  },
});

const defaultDate = new Date(2024, 0, 15); // Jan 15, 2024

describe('P3.3 Calendar View States', () => {
  // ---------------------------------------------------------------
  // Empty state (no events)
  // ---------------------------------------------------------------
  describe('empty state', () => {
    it('renders header with no events', () => {
      render(<CalendarView currentDate={defaultDate} events={[]} locale="en-US" />);
      expect(screen.getByText('January 2024')).toBeInTheDocument();
    });

    it('renders navigation controls with no events', () => {
      render(<CalendarView currentDate={defaultDate} events={[]} locale="en-US" />);
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('renders day headers in month view with no events', () => {
      render(<CalendarView currentDate={defaultDate} events={[]} locale="en-US" view="month" />);
      expect(screen.getByText('Sun')).toBeInTheDocument();
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Sat')).toBeInTheDocument();
    });

    it('renders with undefined events prop', () => {
      render(<CalendarView currentDate={defaultDate} locale="en-US" />);
      expect(screen.getByText('January 2024')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------
  // Populated state
  // ---------------------------------------------------------------
  describe('populated state', () => {
    const events: CalendarEvent[] = [
      {
        id: '1',
        title: 'Team Meeting',
        start: new Date(2024, 0, 15, 10, 0),
        end: new Date(2024, 0, 15, 11, 0),
      },
      {
        id: '2',
        title: 'Lunch Break',
        start: new Date(2024, 0, 15, 12, 0),
        end: new Date(2024, 0, 15, 13, 0),
      },
    ];

    it('renders events in month view', () => {
      render(
        <CalendarView
          currentDate={defaultDate}
          events={events}
          view="month"
          locale="en-US"
        />
      );
      expect(screen.getByText('Team Meeting')).toBeInTheDocument();
      expect(screen.getByText('Lunch Break')).toBeInTheDocument();
    });

    it('fires onEventClick when event is clicked', () => {
      const onClick = vi.fn();
      render(
        <CalendarView
          currentDate={defaultDate}
          events={events}
          view="month"
          locale="en-US"
          onEventClick={onClick}
        />
      );
      fireEvent.click(screen.getByText('Team Meeting'));
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith(events[0]);
    });
  });

  // ---------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------
  describe('navigation', () => {
    it('navigates to previous month', () => {
      const onNavigate = vi.fn();
      render(
        <CalendarView
          currentDate={defaultDate}
          events={[]}
          locale="en-US"
          onNavigate={onNavigate}
        />
      );
      // Click prev button (first icon button after Today)
      const buttons = screen.getAllByRole('button');
      // Find the prev chevron - it's the button after Today
      const todayIdx = buttons.findIndex(b => b.textContent === 'Today');
      fireEvent.click(buttons[todayIdx + 1]);
      expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it('navigates to today', () => {
      const onNavigate = vi.fn();
      render(
        <CalendarView
          currentDate={new Date(2024, 5, 15)}
          events={[]}
          locale="en-US"
          onNavigate={onNavigate}
        />
      );
      fireEvent.click(screen.getByText('Today'));
      expect(onNavigate).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------
  // View modes
  // ---------------------------------------------------------------
  describe('view modes', () => {
    it('renders month view by default', () => {
      render(<CalendarView currentDate={defaultDate} events={[]} locale="en-US" />);
      // Month view has day-of-week headers
      expect(screen.getByText('Sun')).toBeInTheDocument();
      expect(screen.getByText('Mon')).toBeInTheDocument();
    });

    it('renders week view', () => {
      render(
        <CalendarView
          currentDate={defaultDate}
          events={[]}
          view="week"
          locale="en-US"
        />
      );
      // Week view should show a range header and a 7-column grid
      const grids = screen.getAllByRole('grid');
      expect(grids.length).toBeGreaterThanOrEqual(1);
    });

    it('renders day view', () => {
      render(
        <CalendarView
          currentDate={defaultDate}
          events={[]}
          view="day"
          locale="en-US"
        />
      );
      // Day view shows time slots
      expect(screen.getByText('12 AM')).toBeInTheDocument();
      expect(screen.getByText('12 PM')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------
  describe('edge cases', () => {
    it('handles event spanning multiple days', () => {
      const multiDayEvent: CalendarEvent[] = [
        {
          id: 'multi',
          title: 'Conference',
          start: new Date(2024, 0, 15),
          end: new Date(2024, 0, 17),
          allDay: true,
        },
      ];
      render(
        <CalendarView
          currentDate={defaultDate}
          events={multiDayEvent}
          view="month"
          locale="en-US"
        />
      );
      // Multi-day events render on each day they span
      const elements = screen.getAllByText('Conference');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it('handles event with color', () => {
      const coloredEvents: CalendarEvent[] = [
        {
          id: 'red',
          title: 'Red Event',
          start: new Date(2024, 0, 15, 9, 0),
          color: 'bg-red-500 text-white',
        },
      ];
      render(
        <CalendarView
          currentDate={defaultDate}
          events={coloredEvents}
          view="month"
          locale="en-US"
        />
      );
      expect(screen.getByText('Red Event')).toBeInTheDocument();
    });

    it('renders onAddClick button when provided', () => {
      const onAdd = vi.fn();
      render(
        <CalendarView
          currentDate={defaultDate}
          events={[]}
          locale="en-US"
          onAddClick={onAdd}
        />
      );
      // The "New event" button should be visible
      const newButton = screen.getByText('New event');
      expect(newButton).toBeInTheDocument();
      fireEvent.click(newButton);
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it('does not render New button without onAddClick', () => {
      render(
        <CalendarView
          currentDate={defaultDate}
          events={[]}
          locale="en-US"
        />
      );
      expect(screen.queryByText('New event')).not.toBeInTheDocument();
    });

    it('accepts className prop', () => {
      const { container } = render(
        <CalendarView
          currentDate={defaultDate}
          events={[]}
          locale="en-US"
          className="my-calendar"
        />
      );
      expect(container.firstElementChild!.className).toContain('my-calendar');
    });

    it('handles many events without crashing', () => {
      const manyEvents: CalendarEvent[] = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        title: `Event ${i}`,
        start: new Date(2024, 0, (i % 28) + 1, 9, 0),
      }));
      const { container } = render(
        <CalendarView
          currentDate={defaultDate}
          events={manyEvents}
          view="month"
          locale="en-US"
        />
      );
      expect(container).toBeInTheDocument();
    });

    it('handles date at month boundary (last day of month)', () => {
      const boundaryDate = new Date(2024, 0, 31); // Jan 31, 2024
      render(
        <CalendarView
          currentDate={boundaryDate}
          events={[]}
          view="month"
          locale="en-US"
        />
      );
      expect(screen.getByText('January 2024')).toBeInTheDocument();
    });

    it('handles date at month boundary (first day of month)', () => {
      const firstDay = new Date(2024, 1, 1); // Feb 1, 2024
      render(
        <CalendarView
          currentDate={firstDay}
          events={[]}
          view="month"
          locale="en-US"
        />
      );
      expect(screen.getByText('February 2024')).toBeInTheDocument();
    });

    it('handles leap year date', () => {
      const leapDate = new Date(2024, 1, 29); // Feb 29, 2024 (leap year)
      render(
        <CalendarView
          currentDate={leapDate}
          events={[]}
          view="month"
          locale="en-US"
        />
      );
      expect(screen.getByText('February 2024')).toBeInTheDocument();
    });

    it('handles events spanning across month boundary', () => {
      const crossMonthEvent: CalendarEvent[] = [
        {
          id: 'cross',
          title: 'Cross-Month Event',
          start: new Date(2024, 0, 30),
          end: new Date(2024, 1, 2),
          allDay: true,
        },
      ];
      const { container } = render(
        <CalendarView
          currentDate={new Date(2024, 0, 15)}
          events={crossMonthEvent}
          view="month"
          locale="en-US"
        />
      );
      // Should render without crashing; the event spans into next month padding days
      const elements = container.querySelectorAll('[role="button"]');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });
});

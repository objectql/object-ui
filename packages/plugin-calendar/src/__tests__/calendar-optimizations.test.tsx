/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Tests for CalendarView optimizations:
 * - Event index (Map-based lookup instead of O(N) per cell)
 * - Stable default date reference
 * - HEX color text-white fix
 * - onEventDrop / locale passthrough from ObjectCalendar
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { CalendarView, type CalendarEvent } from '../CalendarView';

// Mock @object-ui/components
vi.mock('@object-ui/components', () => ({
  cn: (...classes: (string | undefined | boolean)[]) => classes.filter(Boolean).join(' '),
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Select: ({ children, value, onValueChange }: any) => <div data-testid="select">{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <span>Month</span>,
  Calendar: (props: any) => <div data-testid="calendar-picker">Calendar Picker</div>,
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <div>{children}</div>,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ChevronLeftIcon: (props: any) => <svg data-testid="chevron-left" {...props} />,
  ChevronRightIcon: (props: any) => <svg data-testid="chevron-right" {...props} />,
  CalendarIcon: (props: any) => <svg data-testid="calendar-icon" {...props} />,
  PlusIcon: (props: any) => <svg data-testid="plus-icon" {...props} />,
}));

// Mock ResizeObserver
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserver;

const baseDate = new Date(2024, 0, 15); // Jan 15, 2024

describe('CalendarView optimizations', () => {
  describe('event index (Map-based lookup)', () => {
    it('renders single-day events correctly with the new index', () => {
      const events: CalendarEvent[] = [
        { id: '1', title: 'Morning Meeting', start: new Date(2024, 0, 15, 9, 0), end: new Date(2024, 0, 15, 10, 0) },
        { id: '2', title: 'Lunch', start: new Date(2024, 0, 15, 12, 0), end: new Date(2024, 0, 15, 13, 0) },
      ];
      render(<CalendarView currentDate={baseDate} events={events} view="month" locale="en-US" />);
      expect(screen.getByText('Morning Meeting')).toBeInTheDocument();
      expect(screen.getByText('Lunch')).toBeInTheDocument();
    });

    it('renders multi-day events on all spanned days', () => {
      const events: CalendarEvent[] = [
        {
          id: 'multi-1',
          title: 'Conference',
          start: new Date(2024, 0, 15, 9, 0),
          end: new Date(2024, 0, 17, 17, 0),
          allDay: true,
        },
      ];
      const { container } = render(
        <CalendarView currentDate={baseDate} events={events} view="month" locale="en-US" />
      );
      // The multi-day event should appear on Jan 15, 16, and 17 — 3 cells
      const eventElements = container.querySelectorAll('[role="button"][aria-label="Conference"]');
      expect(eventElements.length).toBe(3);
    });

    it('renders events with no end date on their start day only', () => {
      const events: CalendarEvent[] = [
        { id: 'no-end', title: 'No End Event', start: new Date(2024, 0, 20, 14, 0) },
      ];
      const { container } = render(
        <CalendarView currentDate={baseDate} events={events} view="month" locale="en-US" />
      );
      const eventElements = container.querySelectorAll('[role="button"][aria-label="No End Event"]');
      expect(eventElements.length).toBe(1);
    });
  });

  describe('HEX color text-white fix', () => {
    it('applies text-white class when event color is a HEX value in month view', () => {
      const events: CalendarEvent[] = [
        { id: 'hex-1', title: 'HEX Event', start: new Date(2024, 0, 15), color: '#3b82f6' },
      ];
      const { container } = render(
        <CalendarView currentDate={baseDate} events={events} view="month" locale="en-US" />
      );
      const eventEl = container.querySelector('[aria-label="HEX Event"]');
      expect(eventEl).toBeInTheDocument();
      expect(eventEl!.className).toContain('text-white');
      expect((eventEl as HTMLElement).style.backgroundColor).toBe('#3b82f6');
    });

    it('uses default color class when event color is a Tailwind class', () => {
      const events: CalendarEvent[] = [
        { id: 'tw-1', title: 'Tailwind Event', start: new Date(2024, 0, 15), color: 'bg-red-500 text-white' },
      ];
      const { container } = render(
        <CalendarView currentDate={baseDate} events={events} view="month" locale="en-US" />
      );
      const eventEl = container.querySelector('[aria-label="Tailwind Event"]');
      expect(eventEl).toBeInTheDocument();
      expect(eventEl!.className).toContain('bg-red-500');
      expect(eventEl!.className).toContain('text-white');
    });

    it('falls back to DEFAULT_EVENT_COLOR when no color is specified', () => {
      const events: CalendarEvent[] = [
        { id: 'no-color', title: 'No Color', start: new Date(2024, 0, 15) },
      ];
      const { container } = render(
        <CalendarView currentDate={baseDate} events={events} view="month" locale="en-US" />
      );
      const eventEl = container.querySelector('[aria-label="No Color"]');
      expect(eventEl).toBeInTheDocument();
      expect(eventEl!.className).toContain('bg-blue-500');
      expect(eventEl!.className).toContain('text-white');
    });
  });

  describe('stable default date', () => {
    it('renders without currentDate prop without errors', () => {
      const { container } = render(<CalendarView events={[]} locale="en-US" />);
      expect(container).toBeTruthy();
    });

    it('does not trigger re-render loop when currentDate is not provided', () => {
      const onNavigate = vi.fn();
      const { rerender } = render(<CalendarView events={[]} locale="en-US" onNavigate={onNavigate} />);
      // Re-render the same component — should NOT trigger onNavigate from the effect
      rerender(<CalendarView events={[]} locale="en-US" onNavigate={onNavigate} />);
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  describe('drag-and-drop enablement', () => {
    it('events are draggable when onEventDrop is provided', () => {
      const events: CalendarEvent[] = [
        { id: 'd-1', title: 'Drag Event', start: new Date(2024, 0, 15) },
      ];
      const onEventDrop = vi.fn();
      const { container } = render(
        <CalendarView currentDate={baseDate} events={events} view="month" onEventDrop={onEventDrop} locale="en-US" />
      );
      const eventEl = container.querySelector('[aria-label="Drag Event"]');
      expect(eventEl).toBeInTheDocument();
      expect(eventEl!.getAttribute('draggable')).toBe('true');
    });

    it('events are not draggable when onEventDrop is not provided', () => {
      const events: CalendarEvent[] = [
        { id: 'nd-1', title: 'No Drag Event', start: new Date(2024, 0, 15) },
      ];
      const { container } = render(
        <CalendarView currentDate={baseDate} events={events} view="month" locale="en-US" />
      );
      const eventEl = container.querySelector('[aria-label="No Drag Event"]');
      expect(eventEl).toBeInTheDocument();
      expect(eventEl!.getAttribute('draggable')).toBe('false');
    });
  });
});

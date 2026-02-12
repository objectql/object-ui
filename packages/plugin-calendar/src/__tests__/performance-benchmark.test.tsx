/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Performance benchmark tests for CalendarView.
 * Part of P2.4 Performance at Scale roadmap.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { CalendarView, type CalendarEvent, type CalendarViewProps } from '../CalendarView';

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

// --- Data generators ---

const baseDate = new Date(2024, 0, 15); // Jan 15, 2024

function generateEvents(count: number): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (let i = 0; i < count; i++) {
    const day = (i % 28) + 1;
    const hour = (i % 12) + 8;
    events.push({
      id: `event-${i}`,
      title: `Event ${i}`,
      start: new Date(2024, 0, day, hour, 0),
      end: new Date(2024, 0, day, hour + 1, 0),
      allDay: i % 10 === 0,
    });
  }
  return events;
}

function generateMultiDayEvents(count: number): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (let i = 0; i < count; i++) {
    const startDay = (i % 25) + 1;
    const spanDays = (i % 4) + 2; // 2-5 day span
    events.push({
      id: `multi-event-${i}`,
      title: `Multi-day Event ${i}`,
      start: new Date(2024, 0, startDay, 9, 0),
      end: new Date(2024, 0, startDay + spanDays, 17, 0),
      allDay: true,
    });
  }
  return events;
}

function renderCalendar(overrides: Partial<CalendarViewProps> = {}) {
  const props: CalendarViewProps = {
    currentDate: baseDate,
    locale: 'en-US',
    ...overrides,
  };
  return render(<CalendarView {...props} />);
}

// =========================================================================
// Performance Benchmarks
// =========================================================================

describe('CalendarView: performance benchmarks', () => {
  it('renders with 100 events under 500ms', () => {
    const events = generateEvents(100);

    const start = performance.now();
    const { container } = renderCalendar({ events });
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(500);
  });

  it('renders with 500 events under 1,000ms', () => {
    const events = generateEvents(500);

    const start = performance.now();
    const { container } = renderCalendar({ events });
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(1_000);
  });

  it('renders with 1,000 events under 2,000ms', () => {
    const events = generateEvents(1_000);

    const start = performance.now();
    const { container } = renderCalendar({ events });
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(2_000);
  });

  it('renders with no events instantly', () => {
    const start = performance.now();
    const { container } = renderCalendar({ events: [] });
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(200);
  });

  it('data generation for 1,000 events is fast (< 100ms)', () => {
    const start = performance.now();
    const events = generateEvents(1_000);
    const elapsed = performance.now() - start;

    expect(events).toHaveLength(1_000);
    expect(elapsed).toBeLessThan(100);
  });
});

// =========================================================================
// Multi-day event scaling
// =========================================================================

describe('CalendarView: multi-day event performance', () => {
  it('renders 100 multi-day events under 500ms', () => {
    const events = generateMultiDayEvents(100);

    const start = performance.now();
    const { container } = renderCalendar({ events });
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(500);
  });

  it('renders 500 multi-day events under 1,500ms', () => {
    const events = generateMultiDayEvents(500);

    const start = performance.now();
    const { container } = renderCalendar({ events });
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(1_500);
  });

  it('renders mix of single-day and multi-day events at scale', () => {
    const singleDay = generateEvents(500);
    const multiDay = generateMultiDayEvents(500);
    const events = [...singleDay, ...multiDay];

    const start = performance.now();
    const { container } = renderCalendar({ events });
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(2_000);
  });
});

// =========================================================================
// Scaling across views
// =========================================================================

describe('CalendarView: scaling across views', () => {
  it('renders month view with 500 events under 1,000ms', () => {
    const events = generateEvents(500);

    const start = performance.now();
    renderCalendar({ events, view: 'month' });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1_000);
  });

  it('renders day view with 500 events under 500ms', () => {
    const events = generateEvents(500);

    const start = performance.now();
    renderCalendar({ events, view: 'day' });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
  });

  it('handles events with all-day flag at scale', () => {
    const events = generateEvents(200).map((e) => ({ ...e, allDay: true }));

    const start = performance.now();
    const { container } = renderCalendar({ events });
    const elapsed = performance.now() - start;

    expect(container).toBeTruthy();
    expect(elapsed).toBeLessThan(1_000);
  });
});

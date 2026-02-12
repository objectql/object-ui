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
    expect(screen.getByText('January 2024')).toBeInTheDocument();
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
// Scaling with different views
// =========================================================================

describe('CalendarView: scaling across views', () => {
  it('renders month view with 500 events under 1,000ms', () => {
    const events = generateEvents(500);

    const start = performance.now();
    renderCalendar({ events, view: 'month' });
    const elapsed = performance.now() - start;

    expect(screen.getByText('January 2024')).toBeInTheDocument();
    expect(elapsed).toBeLessThan(1_000);
  });

  it('renders default view with 200 events under 500ms', () => {
    const events = generateEvents(200);

    const start = performance.now();
    renderCalendar({ events });
    const elapsed = performance.now() - start;

    expect(screen.getByText('January 2024')).toBeInTheDocument();
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

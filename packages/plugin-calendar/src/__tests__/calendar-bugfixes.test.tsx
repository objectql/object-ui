/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Tests for calendar bug fixes:
 * - Event click always dispatches action (no schema.onEventClick guard)
 * - i18n integration with useObjectTranslation
 * - Tooltip (title attribute) on truncated event titles
 * - Cross-month date visual distinction (opacity)
 * - Today highlight spacing improvement
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { CalendarView, type CalendarEvent } from '../CalendarView';
import { I18nProvider } from '@object-ui/i18n';

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

const sampleEvents: CalendarEvent[] = [
  {
    id: '1',
    title: 'Design dashboard widget layout and structure',
    start: new Date(2024, 0, 15, 10, 0),
    end: new Date(2024, 0, 15, 11, 0),
    color: '#3b82f6',
  },
  {
    id: '2',
    title: 'Short Event',
    start: new Date(2024, 0, 15, 14, 0),
  },
];

function renderWithI18n(ui: React.ReactElement, lang = 'en') {
  return render(
    <I18nProvider config={{ defaultLanguage: lang, detectBrowserLanguage: false }}>
      {ui}
    </I18nProvider>
  );
}

describe('Calendar Bug Fixes', () => {
  describe('event click dispatches action', () => {
    it('fires onEventClick when event is clicked in month view', () => {
      const onClick = vi.fn();
      renderWithI18n(
        <CalendarView
          currentDate={defaultDate}
          events={sampleEvents}
          view="month"
          onEventClick={onClick}
        />
      );
      fireEvent.click(screen.getByText('Short Event'));
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith(sampleEvents[1]);
    });
  });

  describe('tooltip on truncated event titles', () => {
    it('renders title attribute on event cards in month view', () => {
      renderWithI18n(
        <CalendarView
          currentDate={defaultDate}
          events={sampleEvents}
          view="month"
        />
      );
      const eventEl = screen.getByText('Short Event');
      expect(eventEl.closest('[title]')).toHaveAttribute('title', 'Short Event');
    });

    it('renders title attribute with long title in month view', () => {
      renderWithI18n(
        <CalendarView
          currentDate={defaultDate}
          events={sampleEvents}
          view="month"
        />
      );
      const eventEl = screen.getByText('Design dashboard widget layout and structure');
      expect(eventEl.closest('[title]')).toHaveAttribute(
        'title',
        'Design dashboard widget layout and structure'
      );
    });

    it('renders title attribute on event cards in day view', () => {
      renderWithI18n(
        <CalendarView
          currentDate={defaultDate}
          events={sampleEvents}
          view="day"
        />
      );
      const eventEl = screen.getByText('Short Event');
      expect(eventEl.closest('[title]')).toHaveAttribute('title', 'Short Event');
    });
  });

  describe('i18n integration', () => {
    it('renders labels from i18n when language is en', () => {
      const onAdd = vi.fn();
      renderWithI18n(
        <CalendarView
          currentDate={defaultDate}
          events={[]}
          onAddClick={onAdd}
        />,
        'en'
      );
      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText('New event')).toBeInTheDocument();
    });

    it('renders labels from i18n when language is zh', () => {
      const onAdd = vi.fn();
      renderWithI18n(
        <CalendarView
          currentDate={defaultDate}
          events={[]}
          onAddClick={onAdd}
        />,
        'zh'
      );
      expect(screen.getByText('今天')).toBeInTheDocument();
      expect(screen.getByText('新建事件')).toBeInTheDocument();
    });

    it('renders locale-aware weekday headers for zh', () => {
      renderWithI18n(
        <CalendarView
          currentDate={defaultDate}
          events={[]}
          view="month"
        />,
        'zh'
      );
      expect(screen.getByText('周日')).toBeInTheDocument();
      expect(screen.getByText('周一')).toBeInTheDocument();
    });
  });

  describe('cross-month date styling', () => {
    it('applies opacity to non-current-month dates', () => {
      const { container } = renderWithI18n(
        <CalendarView
          currentDate={new Date(2024, 1, 15)} // Feb 15, 2024
          events={[]}
          view="month"
        />
      );
      const gridCells = container.querySelectorAll('[role="gridcell"]');
      const firstCell = gridCells[0];
      expect(firstCell.className).toContain('opacity-50');
    });

    it('does not apply opacity to current-month dates', () => {
      const { container } = renderWithI18n(
        <CalendarView
          currentDate={new Date(2024, 1, 15)} // Feb 15, 2024
          events={[]}
          view="month"
        />
      );
      const gridCells = container.querySelectorAll('[role="gridcell"]');
      // Feb 2024 starts on Thursday, so index 4 (0-based) is Feb 1
      const feb1Cell = gridCells[4];
      expect(feb1Cell.className).not.toContain('opacity-50');
    });
  });

  describe('today highlight spacing', () => {
    it('renders today date with mb-2 spacing for better separation', () => {
      const today = new Date();
      const { container } = renderWithI18n(
        <CalendarView
          currentDate={today}
          events={[]}
          view="month"
        />
      );
      const todayEl = container.querySelector('[aria-current="date"]');
      expect(todayEl).toBeInTheDocument();
      expect(todayEl?.className).toContain('mb-2');
    });
  });
});

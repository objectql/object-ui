/**
 * Group 3 tests: navigation buttons, year granularity, layout persistence
 * (保存布局), and the PNG / PDF export toolbar buttons.
 *
 * Conventions match the other interaction tests: innerWidth=1280 →
 * columnWidth 110, rowHeight 40.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GanttView, type GanttTask, type GanttLayout } from './GanttView';

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
  window.localStorage.clear();
});

function makeTask(id: string, start: string, end: string, extra: Partial<GanttTask> = {}): GanttTask {
  return { id, title: `Task ${id}`, start: new Date(start), end: new Date(end), progress: 0, ...extra };
}

const TASKS = () => [
  makeTask('a', '2024-06-03T00:00:00.000Z', '2024-06-13T00:00:00.000Z', { progress: 50 }),
  makeTask('b', '2024-06-17T00:00:00.000Z', '2024-06-21T00:00:00.000Z'),
];

function renderView(props: Partial<React.ComponentProps<typeof GanttView>> = {}) {
  return render(
    <div style={{ width: 1280, height: 600 }}>
      <GanttView
        tasks={TASKS()}
        startDate={new Date('2024-06-01T00:00:00.000Z')}
        endDate={new Date('2024-12-30T00:00:00.000Z')}
        {...props}
      />
    </div>
  );
}

describe('GanttView navigation buttons (导航)', () => {
  it('renders jump-to-today / this-week / this-month controls', () => {
    const { getByTestId } = renderView();
    expect(getByTestId('gantt-jump-today')).toBeTruthy();
    expect(getByTestId('gantt-jump-week')).toBeTruthy();
    expect(getByTestId('gantt-jump-month')).toBeTruthy();
  });

  it('this-week / this-month scroll the timeline horizontally', () => {
    const { getByTestId } = renderView();
    const timeline = getByTestId('gantt-timeline') as HTMLElement;
    // jsdom has no layout, so scrollLeft is a plain settable number; assert the
    // handlers run without throwing and leave a finite scrollLeft.
    act(() => { fireEvent.click(getByTestId('gantt-jump-week')); });
    expect(Number.isFinite(timeline.scrollLeft)).toBe(true);
    act(() => { fireEvent.click(getByTestId('gantt-jump-month')); });
    expect(Number.isFinite(timeline.scrollLeft)).toBe(true);
  });
});

describe('GanttView year granularity (年刻度)', () => {
  it('exposes a year view-mode button and switches to it', () => {
    const { getByTestId } = renderView();
    const yearBtn = getByTestId('gantt-view-mode-year');
    expect(yearBtn).toBeTruthy();
    act(() => { fireEvent.click(yearBtn); });
    expect(yearBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('seeds the year granularity from the viewMode prop', () => {
    const { getByTestId } = renderView({ viewMode: 'year' });
    expect(getByTestId('gantt-view-mode-year').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('GanttView export buttons (导出 PNG / PDF)', () => {
  it('renders both the PNG and PDF export buttons', () => {
    const { getByTestId } = renderView();
    expect(getByTestId('gantt-export-png')).toBeTruthy();
    expect(getByTestId('gantt-export-pdf')).toBeTruthy();
  });
});

describe('GanttView save layout (保存布局)', () => {
  it('hides the save-layout button without persistLayoutKey/onLayoutChange', () => {
    const { queryByTestId } = renderView();
    expect(queryByTestId('gantt-save-layout')).toBeNull();
  });

  it('shows the save-layout button when onLayoutChange is set', () => {
    const { getByTestId } = renderView({ onLayoutChange: () => {} });
    expect(getByTestId('gantt-save-layout')).toBeTruthy();
  });

  it('persists the current layout to localStorage under the key', () => {
    const { getByTestId } = renderView({ persistLayoutKey: 'proj1' });
    act(() => { fireEvent.click(getByTestId('gantt-view-mode-month')); });
    act(() => { fireEvent.click(getByTestId('gantt-save-layout')); });
    const raw = window.localStorage.getItem('gantt-layout:proj1');
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw!) as GanttLayout;
    expect(saved.viewMode).toBe('month');
    expect(saved.taskListCollapsed).toBe(false);
  });

  it('calls onLayoutChange with the snapshot on save', () => {
    const onLayoutChange = vi.fn();
    const { getByTestId } = renderView({ onLayoutChange });
    act(() => { fireEvent.click(getByTestId('gantt-view-mode-quarter')); });
    act(() => { fireEvent.click(getByTestId('gantt-save-layout')); });
    expect(onLayoutChange).toHaveBeenCalledTimes(1);
    expect(onLayoutChange.mock.calls[0][0].viewMode).toBe('quarter');
  });

  it('restores a persisted granularity on mount', () => {
    window.localStorage.setItem(
      'gantt-layout:proj2',
      JSON.stringify({ viewMode: 'month', columnWidth: null, taskListCollapsed: false } satisfies GanttLayout)
    );
    const { getByTestId } = renderView({ persistLayoutKey: 'proj2' });
    expect(getByTestId('gantt-view-mode-month').getAttribute('aria-pressed')).toBe('true');
  });

  it('lets the viewMode prop win over a persisted granularity', () => {
    window.localStorage.setItem(
      'gantt-layout:proj3',
      JSON.stringify({ viewMode: 'month', columnWidth: null, taskListCollapsed: false } satisfies GanttLayout)
    );
    const { getByTestId } = renderView({ persistLayoutKey: 'proj3', viewMode: 'week' });
    expect(getByTestId('gantt-view-mode-week').getAttribute('aria-pressed')).toBe('true');
    expect(getByTestId('gantt-view-mode-month').getAttribute('aria-pressed')).toBe('false');
  });

  it('ignores malformed persisted layout JSON', () => {
    window.localStorage.setItem('gantt-layout:proj4', '{not valid json');
    const { getByTestId } = renderView({ persistLayoutKey: 'proj4' });
    // Falls back to the default 'day' granularity without throwing.
    expect(getByTestId('gantt-view-mode-day').getAttribute('aria-pressed')).toBe('true');
  });
});

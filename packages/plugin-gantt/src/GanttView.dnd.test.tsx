/**
 * Drag-and-drop unit tests for GanttView.
 *
 * Verifies that pointer-event-driven drag on a task bar (move + resize-left
 * + resize-right) calls onTaskUpdate with correctly snapped start/end dates.
 *
 * Strategy: render with a fixed timelineRange so columnWidth math is
 * predictable, then dispatch native PointerEvents (jsdom supports them) on
 * the bar / resize handles and on the window for move/up.
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GanttView, type GanttTask } from './GanttView';

// Force the container width to >=1024 so columnWidth=60 (deterministic).
beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
});

function pointer(type: string, clientX: number) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY: 100,
    pointerType: 'mouse',
    button: 0,
    isPrimary: true,
  } as PointerEventInit);
}

const baseTask: GanttTask = {
  id: 't1',
  title: 'Demo task',
  start: new Date('2024-06-10T00:00:00.000Z'),
  end: new Date('2024-06-15T00:00:00.000Z'),
  progress: 0,
  dependencies: [],
};

function renderView(onTaskUpdate?: (task: GanttTask, changes: any) => void) {
  return render(
    <div style={{ width: 1280, height: 600 }}>
      <GanttView
        tasks={[baseTask]}
        startDate={new Date('2024-06-01T00:00:00.000Z')}
        endDate={new Date('2024-06-30T00:00:00.000Z')}
        onTaskUpdate={onTaskUpdate}
      />
    </div>
  );
}

describe('GanttView drag-and-drop', () => {
  it('renders the bar with a stable test id and does NOT attach drag without onTaskUpdate', () => {
    const { container } = renderView(undefined);
    const bar = container.querySelector('[data-testid="gantt-task-bar-t1"]') as HTMLElement;
    expect(bar).toBeTruthy();
    // No resize handles when drag disabled
    expect(container.querySelector('[data-testid="gantt-task-resize-left-t1"]')).toBeFalsy();
    expect(container.querySelector('[data-testid="gantt-task-resize-right-t1"]')).toBeFalsy();
  });

  it('move: dragging the bar body shifts both start AND end by the snapped day delta', () => {
    const onTaskUpdate = vi.fn();
    const { container } = renderView(onTaskUpdate);
    const bar = container.querySelector('[data-testid="gantt-task-bar-t1"]') as HTMLElement;
    expect(bar).toBeTruthy();

    // columnWidth at width>=1024 = 60. Drag +180px → +3 days.
    act(() => {
      bar.dispatchEvent(pointer('pointerdown', 500));
    });
    act(() => {
      window.dispatchEvent(pointer('pointermove', 680));
    });
    act(() => {
      window.dispatchEvent(pointer('pointerup', 680));
    });

    expect(onTaskUpdate).toHaveBeenCalledTimes(1);
    const [task, changes] = onTaskUpdate.mock.calls[0];
    expect(task.id).toBe('t1');
    expect(changes.start.toISOString()).toBe('2024-06-13T00:00:00.000Z');
    expect(changes.end.toISOString()).toBe('2024-06-18T00:00:00.000Z');
  });

  it('resize-right: dragging the right handle shifts ONLY end', () => {
    const onTaskUpdate = vi.fn();
    const { container } = renderView(onTaskUpdate);
    const handle = container.querySelector('[data-testid="gantt-task-resize-right-t1"]') as HTMLElement;
    expect(handle).toBeTruthy();

    act(() => { handle.dispatchEvent(pointer('pointerdown', 500)); });
    act(() => { window.dispatchEvent(pointer('pointermove', 620)); });
    act(() => { window.dispatchEvent(pointer('pointerup', 620)); });

    expect(onTaskUpdate).toHaveBeenCalledTimes(1);
    const [, changes] = onTaskUpdate.mock.calls[0];
    // start unchanged
    expect(changes.start.toISOString()).toBe('2024-06-10T00:00:00.000Z');
    // end shifted +120px / 60 = +2 days
    expect(changes.end.toISOString()).toBe('2024-06-17T00:00:00.000Z');
  });

  it('resize-left: dragging the left handle shifts ONLY start', () => {
    const onTaskUpdate = vi.fn();
    const { container } = renderView(onTaskUpdate);
    const handle = container.querySelector('[data-testid="gantt-task-resize-left-t1"]') as HTMLElement;
    expect(handle).toBeTruthy();

    act(() => { handle.dispatchEvent(pointer('pointerdown', 500)); });
    act(() => { window.dispatchEvent(pointer('pointermove', 380)); });
    act(() => { window.dispatchEvent(pointer('pointerup', 380)); });

    expect(onTaskUpdate).toHaveBeenCalledTimes(1);
    const [, changes] = onTaskUpdate.mock.calls[0];
    // start shifted -120px / 60 = -2 days
    expect(changes.start.toISOString()).toBe('2024-06-08T00:00:00.000Z');
    // end unchanged
    expect(changes.end.toISOString()).toBe('2024-06-15T00:00:00.000Z');
  });

  it('resize-left clamps so start never goes past end (min 1 day duration)', () => {
    const onTaskUpdate = vi.fn();
    const { container } = renderView(onTaskUpdate);
    const handle = container.querySelector('[data-testid="gantt-task-resize-left-t1"]') as HTMLElement;
    // Try to drag start +600px (10 days) — would put it 5 days past end.
    act(() => { handle.dispatchEvent(pointer('pointerdown', 500)); });
    act(() => { window.dispatchEvent(pointer('pointermove', 1100)); });
    act(() => { window.dispatchEvent(pointer('pointerup', 1100)); });

    expect(onTaskUpdate).toHaveBeenCalledTimes(1);
    const [, changes] = onTaskUpdate.mock.calls[0];
    // Clamped: start should be exactly 1 day before end (2024-06-14)
    expect(changes.start.toISOString()).toBe('2024-06-14T00:00:00.000Z');
    expect(changes.end.toISOString()).toBe('2024-06-15T00:00:00.000Z');
  });

  it('drag with zero net movement does NOT call onTaskUpdate', () => {
    const onTaskUpdate = vi.fn();
    const { container } = renderView(onTaskUpdate);
    const bar = container.querySelector('[data-testid="gantt-task-bar-t1"]') as HTMLElement;
    act(() => { bar.dispatchEvent(pointer('pointerdown', 500)); });
    // Move <30px — rounds to 0 days at columnWidth=60.
    act(() => { window.dispatchEvent(pointer('pointermove', 510)); });
    act(() => { window.dispatchEvent(pointer('pointerup', 510)); });
    expect(onTaskUpdate).not.toHaveBeenCalled();
  });
});

describe('GanttView summary group drag', () => {
  const FAMILY: GanttTask[] = [
    {
      id: 'p',
      title: 'Parent',
      start: new Date('2024-06-10T00:00:00.000Z'),
      end: new Date('2024-06-15T00:00:00.000Z'),
      progress: 0,
    },
    {
      id: 'c1',
      title: 'Child 1',
      start: new Date('2024-06-10T00:00:00.000Z'),
      end: new Date('2024-06-12T00:00:00.000Z'),
      progress: 0,
      parent: 'p',
    },
    {
      id: 'c2',
      title: 'Child 2',
      start: new Date('2024-06-13T00:00:00.000Z'),
      end: new Date('2024-06-15T00:00:00.000Z'),
      progress: 0,
      parent: 'p',
    },
    {
      id: 'gc',
      title: 'Grandchild milestone',
      start: new Date('2024-06-14T00:00:00.000Z'),
      end: new Date('2024-06-14T00:00:00.000Z'),
      progress: 0,
      parent: 'c2',
    },
  ];

  function renderFamily(onTaskUpdate: (task: GanttTask, changes: any) => void) {
    return render(
      <div style={{ width: 1280, height: 600 }}>
        <GanttView
          tasks={FAMILY}
          startDate={new Date('2024-06-01T00:00:00.000Z')}
          endDate={new Date('2024-06-30T00:00:00.000Z')}
          onTaskUpdate={onTaskUpdate}
        />
      </div>
    );
  }

  it('dragging the summary bracket shifts the summary AND every descendant by the same delta', () => {
    const onTaskUpdate = vi.fn();
    const { container } = renderFamily(onTaskUpdate);
    const bracket = container.querySelector('[data-testid="gantt-summary-bar-p"]') as HTMLElement;
    expect(bracket).toBeTruthy();

    // +120px → +2 days at columnWidth 60.
    act(() => { bracket.dispatchEvent(pointer('pointerdown', 500)); });
    act(() => { window.dispatchEvent(pointer('pointermove', 620)); });
    act(() => { window.dispatchEvent(pointer('pointerup', 620)); });

    // Summary + c1 + c2 + grandchild — one update each, all shifted +2 days
    // with durations preserved.
    expect(onTaskUpdate).toHaveBeenCalledTimes(4);
    const byId = new Map(
      onTaskUpdate.mock.calls.map(([task, changes]) => [String(task.id), changes])
    );
    expect([...byId.keys()].sort()).toEqual(['c1', 'c2', 'gc', 'p']);
    expect(byId.get('c1').start.toISOString()).toBe('2024-06-12T00:00:00.000Z');
    expect(byId.get('c1').end.toISOString()).toBe('2024-06-14T00:00:00.000Z');
    expect(byId.get('c2').start.toISOString()).toBe('2024-06-15T00:00:00.000Z');
    expect(byId.get('c2').end.toISOString()).toBe('2024-06-17T00:00:00.000Z');
    expect(byId.get('gc').start.toISOString()).toBe('2024-06-16T00:00:00.000Z');
    expect(byId.get('gc').end.toISOString()).toBe('2024-06-16T00:00:00.000Z');
    expect(byId.get('p').start.toISOString()).toBe('2024-06-12T00:00:00.000Z');
    expect(byId.get('p').end.toISOString()).toBe('2024-06-17T00:00:00.000Z');
  });

  it('summary drag with zero net movement does not emit updates', () => {
    const onTaskUpdate = vi.fn();
    const { container } = renderFamily(onTaskUpdate);
    const bracket = container.querySelector('[data-testid="gantt-summary-bar-p"]') as HTMLElement;
    act(() => { bracket.dispatchEvent(pointer('pointerdown', 500)); });
    act(() => { window.dispatchEvent(pointer('pointermove', 510)); });
    act(() => { window.dispatchEvent(pointer('pointerup', 510)); });
    expect(onTaskUpdate).not.toHaveBeenCalled();
  });

  it('moving a child past the parent edge widens the summary bracket via rollup', () => {
    // Stateful wrapper: apply updates so the rollup recomputes like a real
    // app. No grandchild here — c2 must stay a leaf bar to be draggable.
    const FLAT_FAMILY = FAMILY.slice(0, 3);
    function Stateful() {
      const [tasks, setTasks] = React.useState(FLAT_FAMILY);
      return (
        <div style={{ width: 1280, height: 600 }}>
          <GanttView
            tasks={tasks}
            startDate={new Date('2024-06-01T00:00:00.000Z')}
            endDate={new Date('2024-06-30T00:00:00.000Z')}
            onTaskUpdate={(task, changes) =>
              setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...changes } : t)))
            }
          />
        </div>
      );
    }
    const { container } = render(<Stateful />);
    const bracket = () => container.querySelector('[data-testid="gantt-summary-bar-p"]') as HTMLElement;
    const before = {
      left: parseFloat(bracket().style.left),
      width: parseFloat(bracket().style.width),
    };

    // Drag c2 (the latest child) +180px → +3 days past the parent's end.
    const bar = container.querySelector('[data-testid="gantt-task-bar-c2"]') as HTMLElement;
    act(() => { bar.dispatchEvent(pointer('pointerdown', 500)); });
    act(() => { window.dispatchEvent(pointer('pointermove', 680)); });
    act(() => { window.dispatchEvent(pointer('pointerup', 680)); });

    const after = {
      left: parseFloat(bracket().style.left),
      width: parseFloat(bracket().style.width),
    };
    // Parent start is still c1's start; parent end follows c2 → +3 days wider.
    expect(after.left).toBeCloseTo(before.left, 0);
    expect(after.width).toBeCloseTo(before.width + 3 * 60, 0);
  });
});

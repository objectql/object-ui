/**
 * Phase 4 interaction tests: progress drag handle, hover tooltip, context
 * menu, keyboard navigation, drag-to-create dependency, row reorder.
 *
 * Conventions match the links/tree tests: innerWidth=1280 → columnWidth 60,
 * rowHeight 40; geometry asserted via inline styles (timezone-safe); window
 * pointer events dispatched inside act().
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GanttView, type GanttTask } from './GanttView';

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
});

function makeTask(id: string, start: string, end: string, extra: Partial<GanttTask> = {}): GanttTask {
  return {
    id,
    title: `Task ${id}`,
    start: new Date(start),
    end: new Date(end),
    progress: 0,
    ...extra,
  };
}

const A = () => makeTask('a', '2024-06-03T00:00:00.000Z', '2024-06-13T00:00:00.000Z', { progress: 50 });
const B = () => makeTask('b', '2024-06-17T00:00:00.000Z', '2024-06-21T00:00:00.000Z');

function renderView(tasks: GanttTask[], props: Partial<React.ComponentProps<typeof GanttView>> = {}) {
  return render(
    <div style={{ width: 1280, height: 600 }}>
      <GanttView
        tasks={tasks}
        startDate={new Date('2024-06-01T00:00:00.000Z')}
        endDate={new Date('2024-06-30T00:00:00.000Z')}
        {...props}
      />
    </div>
  );
}

function pointer(type: string, clientX: number, clientY = 100) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    pointerType: 'mouse',
    button: 0,
    isPrimary: true,
  } as PointerEventInit);
}

describe('GanttView progress drag handle', () => {
  it('dragging the handle commits a snapped progress update', () => {
    const onTaskUpdate = vi.fn();
    const { container } = renderView([A()], { onTaskUpdate });
    const handle = container.querySelector('[data-testid="gantt-progress-handle-a"]') as HTMLElement;
    expect(handle).toBeTruthy();

    // Bar is 10 days * 60px = 600px wide; +120px = +20% → 70.
    fireEvent.pointerDown(handle, { button: 0, clientX: 300, clientY: 100 });
    act(() => { window.dispatchEvent(pointer('pointermove', 420)); });
    act(() => { window.dispatchEvent(pointer('pointerup', 420)); });

    expect(onTaskUpdate).toHaveBeenCalledTimes(1);
    const [task, changes] = onTaskUpdate.mock.calls[0];
    expect(task.id).toBe('a');
    expect(changes).toEqual({ progress: 70 });
  });

  it('clamps the dragged progress to [0, 100]', () => {
    const onTaskUpdate = vi.fn();
    const { container } = renderView([A()], { onTaskUpdate });
    const handle = container.querySelector('[data-testid="gantt-progress-handle-a"]') as HTMLElement;

    fireEvent.pointerDown(handle, { button: 0, clientX: 300, clientY: 100 });
    act(() => { window.dispatchEvent(pointer('pointermove', 3000)); });
    act(() => { window.dispatchEvent(pointer('pointerup', 3000)); });

    expect(onTaskUpdate.mock.calls[0][1]).toEqual({ progress: 100 });
  });
});

describe('GanttView hover tooltip', () => {
  it('shows title, duration and progress on bar hover', () => {
    const { container } = renderView([A()]);
    const bar = container.querySelector('[data-testid="gantt-task-bar-a"]') as HTMLElement;
    expect(container.querySelector('[data-testid="gantt-tooltip-a"]')).toBeFalsy();

    fireEvent.mouseEnter(bar);
    const tooltip = container.querySelector('[data-testid="gantt-tooltip-a"]') as HTMLElement;
    expect(tooltip).toBeTruthy();
    expect(tooltip.textContent).toContain('Task a');
    expect(tooltip.textContent).toContain('10d');
    expect(tooltip.textContent).toContain('50%');

    fireEvent.mouseLeave(bar);
    expect(container.querySelector('[data-testid="gantt-tooltip-a"]')).toBeFalsy();
  });
});

describe('GanttView context menu', () => {
  it('opens on right-click and routes Delete / View details', () => {
    const onTaskDelete = vi.fn();
    const onTaskClick = vi.fn();
    const { container } = renderView([A()], { onTaskDelete, onTaskClick });
    const bar = container.querySelector('[data-testid="gantt-task-bar-a"]') as HTMLElement;

    fireEvent.contextMenu(bar, { clientX: 200, clientY: 150 });
    const menu = document.querySelector('[data-testid="gantt-context-menu"]') as HTMLElement;
    expect(menu).toBeTruthy();

    fireEvent.click(menu.querySelector('[data-testid="gantt-context-menu-delete"]')!);
    expect(onTaskDelete).toHaveBeenCalledTimes(1);
    expect(onTaskDelete.mock.calls[0][0].id).toBe('a');
    expect(document.querySelector('[data-testid="gantt-context-menu"]')).toBeFalsy();

    fireEvent.contextMenu(bar, { clientX: 200, clientY: 150 });
    fireEvent.click(document.querySelector('[data-testid="gantt-context-menu-view"]')!);
    expect(onTaskClick).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape without firing actions', () => {
    const onTaskDelete = vi.fn();
    const { container } = renderView([A()], { onTaskDelete });
    fireEvent.contextMenu(container.querySelector('[data-testid="gantt-task-bar-a"]')!, { clientX: 10, clientY: 10 });
    expect(document.querySelector('[data-testid="gantt-context-menu"]')).toBeTruthy();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.querySelector('[data-testid="gantt-context-menu"]')).toBeFalsy();
    expect(onTaskDelete).not.toHaveBeenCalled();
  });
});

describe('GanttView keyboard navigation', () => {
  it('arrows move the selection; Enter opens; Delete deletes', () => {
    const onTaskClick = vi.fn();
    const onTaskDelete = vi.fn();
    const { container } = renderView([A(), B()], { onTaskClick, onTaskDelete });
    const body = container.querySelector('[data-testid="gantt-body"]') as HTMLElement;
    const rowA = container.querySelector('[role="treeitem"][aria-level="1"]') as HTMLElement;
    expect(rowA.getAttribute('aria-selected')).toBe('false');

    fireEvent.keyDown(body, { key: 'ArrowDown' });
    const rows = Array.from(container.querySelectorAll('[role="treeitem"]')) as HTMLElement[];
    expect(rows[0].getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(body, { key: 'ArrowDown' });
    expect(rows[0].getAttribute('aria-selected')).toBe('false');
    expect(rows[1].getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(body, { key: 'Enter' });
    expect(onTaskClick).toHaveBeenCalledTimes(1);
    expect(onTaskClick.mock.calls[0][0].id).toBe('b');

    fireEvent.keyDown(body, { key: 'Delete' });
    expect(onTaskDelete).toHaveBeenCalledTimes(1);
    expect(onTaskDelete.mock.calls[0][0].id).toBe('b');
  });

  it('Left/Right arrows collapse and expand a summary row', () => {
    const tasks = [
      makeTask('p', '2024-06-03T00:00:00.000Z', '2024-06-05T00:00:00.000Z'),
      makeTask('c', '2024-06-04T00:00:00.000Z', '2024-06-08T00:00:00.000Z', { parent: 'p' }),
    ];
    const { container } = renderView(tasks);
    const body = container.querySelector('[data-testid="gantt-body"]') as HTMLElement;

    fireEvent.keyDown(body, { key: 'ArrowDown' }); // select p
    expect(container.querySelector('[data-testid="gantt-task-bar-c"]')).toBeTruthy();
    fireEvent.keyDown(body, { key: 'ArrowLeft' }); // collapse
    expect(container.querySelector('[data-testid="gantt-task-bar-c"]')).toBeFalsy();
    fireEvent.keyDown(body, { key: 'ArrowRight' }); // expand
    expect(container.querySelector('[data-testid="gantt-task-bar-c"]')).toBeTruthy();
  });
});

describe('GanttView drag-to-create dependency', () => {
  it('dragging the connector dot onto another bar fires onDependencyCreate', () => {
    const onDependencyCreate = vi.fn();
    const { container } = renderView([A(), B()], { onDependencyCreate });

    const dot = container.querySelector('[data-testid="gantt-link-dot-a"]') as HTMLElement;
    expect(dot).toBeTruthy();
    fireEvent.pointerDown(dot, { button: 0, clientX: 600, clientY: 20 });

    // Rubber band renders while dragging.
    act(() => { window.dispatchEvent(pointer('pointermove', 700, 60)); });
    expect(container.querySelector('[data-testid="gantt-link-draft"]')).toBeTruthy();

    // Moving over the target bar registers it as the drop target.
    const barB = container.querySelector('[data-testid="gantt-task-bar-b"]') as HTMLElement;
    fireEvent.pointerMove(barB, { clientX: 980, clientY: 60 });
    act(() => { window.dispatchEvent(pointer('pointerup', 980, 60)); });

    expect(onDependencyCreate).toHaveBeenCalledTimes(1);
    const [source, target, type] = onDependencyCreate.mock.calls[0];
    expect(source.id).toBe('a');
    expect(target.id).toBe('b');
    expect(type).toBe('fs');
    expect(container.querySelector('[data-testid="gantt-link-draft"]')).toBeFalsy();
  });

  it('releasing over empty space creates nothing', () => {
    const onDependencyCreate = vi.fn();
    const { container } = renderView([A(), B()], { onDependencyCreate });
    const dot = container.querySelector('[data-testid="gantt-link-dot-a"]') as HTMLElement;

    fireEvent.pointerDown(dot, { button: 0, clientX: 600, clientY: 20 });
    act(() => { window.dispatchEvent(pointer('pointermove', 1100, 30)); });
    act(() => { window.dispatchEvent(pointer('pointerup', 1100, 30)); });

    expect(onDependencyCreate).not.toHaveBeenCalled();
  });
});

describe('GanttView row drag-to-reorder', () => {
  function makeDataTransfer() {
    const store: Record<string, string> = {};
    return {
      setData: (k: string, v: string) => { store[k] = v; },
      getData: (k: string) => store[k] ?? '',
      effectAllowed: '',
      dropEffect: '',
    };
  }

  it('dropping a row on a sibling fires onTaskReorder', () => {
    const onTaskReorder = vi.fn();
    const { container } = renderView([A(), B()], { onTaskReorder });
    const rows = Array.from(container.querySelectorAll('[role="treeitem"]')) as HTMLElement[];
    expect(rows[0].getAttribute('draggable')).toBe('true');

    const dt = makeDataTransfer();
    fireEvent.dragStart(rows[1], { dataTransfer: dt });
    fireEvent.dragOver(rows[0], { dataTransfer: dt });
    fireEvent.drop(rows[0], { dataTransfer: dt });

    expect(onTaskReorder).toHaveBeenCalledTimes(1);
    const [moved, before] = onTaskReorder.mock.calls[0];
    expect(moved.id).toBe('b');
    expect(before.id).toBe('a');
  });

  it('ignores drops across different parents', () => {
    const onTaskReorder = vi.fn();
    const tasks = [
      makeTask('p', '2024-06-03T00:00:00.000Z', '2024-06-05T00:00:00.000Z'),
      makeTask('c', '2024-06-04T00:00:00.000Z', '2024-06-08T00:00:00.000Z', { parent: 'p' }),
      makeTask('solo', '2024-06-10T00:00:00.000Z', '2024-06-12T00:00:00.000Z'),
    ];
    const { container } = renderView(tasks, { onTaskReorder });
    const rows = Array.from(container.querySelectorAll('[role="treeitem"]')) as HTMLElement[];

    const dt = makeDataTransfer();
    fireEvent.dragStart(rows[1], { dataTransfer: dt }); // c (child of p)
    fireEvent.dragOver(rows[2], { dataTransfer: dt });
    fireEvent.drop(rows[2], { dataTransfer: dt }); // solo (root)

    expect(onTaskReorder).not.toHaveBeenCalled();
  });
});

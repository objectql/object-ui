/**
 * Pins the drawer width a gantt gets when it declares no `navigation`.
 *
 * ObjectGantt used to hard-code `{ mode: 'drawer', width: 'min(960px, 60vw)' }`
 * as that default. `width` is `@deprecated [#2578 -> size]` and
 * `resolveOverlayWidth` gives an explicit `width` priority OVER `size`, so
 * spelling it kept the deprecated branch load-bearing on the path most gantts
 * take. The default is now `{ mode: 'drawer' }`: `resolveOverlayWidth` returns
 * `undefined` and RecordDetailDrawer's own `width` default supplies the
 * identical CSS — a zero-pixel change.
 *
 * That equivalence was previously pinned by NOTHING: a repo-wide search for
 * `min(960px, 60vw)` returned only producers, zero assertions, and the whole
 * 402-test gantt suite stayed green when the value was changed. Both halves
 * below are load-bearing and fail for different reasons:
 *
 *   half 1 — the gantt must stop injecting a width of its own (it has to hand
 *            `undefined` down, or the drawer's default can never apply);
 *   half 2 — the width the REAL drawer then resolves must still be that value.
 *            Without this half the gantt would follow a moved drawer default
 *            invisibly, which is the regression the indirection introduces.
 *
 * Both assert the resolved width VALUE — never a `className`, never "it
 * renders", either of which passes in both worlds.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectGantt } from './ObjectGantt';

/** The width the gantt's drawer has always resolved to. Must not drift. */
const EXPECTED_WIDTH = 'min(960px, 60vw)';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

vi.mock('./GanttView', () => ({
  GanttView: ({ tasks, onTaskClick }: any) => (
    <div data-testid="gantt-view">
      {tasks.map((t: any) => (
        <button key={t.id} data-testid={`gv-view-${t.id}`} onClick={() => onTaskClick?.(t)}>
          {t.title}
        </button>
      ))}
    </div>
  ),
}));

// Record the props ObjectGantt hands down, then delegate to the REAL drawer so
// half 2 measures the actual resolution rather than a stub's idea of it.
let drawerProps: any = null;
vi.mock('@object-ui/plugin-detail', async (importOriginal) => {
  const actual = await importOriginal<any>();
  const Real = actual.RecordDetailDrawer;
  return {
    ...actual,
    RecordDetailDrawer: (props: any) => {
      drawerProps = props;
      return <Real {...props} />;
    },
  };
});

function makeSchema(): any {
  return {
    type: 'gantt',
    objectName: 'tasks',
    gantt: { titleField: 'name', startDateField: 'start_date', endDateField: 'end_date' },
    data: {
      provider: 'value',
      items: [{ id: '1', name: 'Row', start_date: '2024-01-01', end_date: '2024-01-05' }],
    },
  };
}

async function openDrawer() {
  render(<ObjectGantt schema={makeSchema()} />);
  await waitFor(() => expect(screen.getByTestId('gv-view-1')).toBeDefined());
  fireEvent.click(screen.getByTestId('gv-view-1'));
  await waitFor(() => expect(drawerProps).not.toBeNull());
}

describe('gantt drawer width with no declared `navigation`', () => {
  beforeEach(() => {
    drawerProps = null;
    // Cross-test leakage guard: the drawer prefers a drag-resized width
    // persisted in localStorage over its prop, which would mask half 2.
    try { window.localStorage.clear(); } catch { /* ignore */ }
  });

  it('half 1: the gantt injects no width of its own (so the drawer default applies)', async () => {
    await openDrawer();
    expect(drawerProps.width).toBeUndefined();
  });

  it('half 2: the width the real drawer resolves is still the pinned value', async () => {
    await openDrawer();
    // The drawer applies the resolved width as an inline style on its panel,
    // as BOTH `width` and `max-width`. happy-dom's CSS parser drops the
    // `width` longhand when the value is a `min()` expression but keeps
    // `max-width`, so the surviving declaration is what we read — it is the
    // same resolved string, not a proxy for it.
    const panel = document.querySelector('[role="dialog"]') as HTMLElement | null;
    expect(panel, 'drawer panel').not.toBeNull();
    expect(panel!.style.maxWidth).toBe(EXPECTED_WIDTH);
  });
});

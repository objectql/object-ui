/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7231 — `reload()`'s `finally` must belong to the CURRENT reload.
 *
 * `reload()` sequences concurrent runs with `reloadSeqRef` and guards every
 * result write with `isCurrent()` (`setData` on three branches, `setError` on
 * the error branch). The `finally` used to carry no guard, so a SUPERSEDED
 * reload still flipped `loading` / `refreshing` off — clearing the loading
 * placeholder while the fresh query was still in flight. The user saw an
 * empty chart: placeholder gone, no rows arrived yet.
 *
 * Note which ordering produces it: NOT an exotic out-of-order response, but
 * the plain in-issue-order one. The stale reload merely has to FINISH FIRST,
 * which is the ordinary case whenever a second reload is issued while the
 * first is still in flight. The out-of-order case (fresh finishes first) is
 * the one the pre-existing `setData` guard already covered, and it is kept
 * below as the control.
 *
 * The guard shape matters, hence the third case. The flags are per-MODE
 * (`silent` → `refreshing`, otherwise `loading`), so a `finally` that clears
 * only its own mode's flag when current leaks the other one: a silent reload
 * superseded by a non-silent one would never clear `refreshing`, leaving the
 * toolbar's refresh button stuck busy for the life of the component. What
 * makes clearing BOTH correct is that "I am current AND I am finishing"
 * means nothing is in flight any more — a newer reload would have made this
 * one stale, and an older one has no claim on the flags.
 *
 * Scope: this is the reload guard only. The overlapping-reload pairs it
 * covers include the toolbar refresh and the write-readback paths, where two
 * reloads legitimately overlap and no schema gating is involved — see the
 * card for why this must not be folded into the gating work.
 *
 * ⚠️ HOW THE OVERLAP IS PRODUCED changed with objectui#7225's gating, and the
 * property under test did not. This file used to generate its two in-flight
 * reloads out of the gantt's DUPLICATE mount query: `getObjectSchema` resolved,
 * re-keyed `reload`, and issued a second `find` while the first was still
 * pending — so every case opened with
 * `expect(find.mock.calls.length).toBe(2)`. That duplicate is exactly what
 * objectui#7225 ask 2 removed: the record query is now GATED on the settled
 * schema, so a mount issues ONE `find`, and a test that waits for two would
 * wait forever.
 *
 * So the overlap is now generated from a pair that is real, is the reason the
 * guard exists, and is untouched by gating: a SILENT toolbar refresh
 * superseded by a non-silent filter-change reload. That is what case 3 always
 * used; cases 1 and 2 now use it too. Not one assertion about the guard has
 * been weakened — the orderings (stale-first, fresh-first), the flags and the
 * outcomes are the same. The `finally` guard itself is not modified by that
 * card or this one.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ObjectGantt } from './ObjectGantt';
import type { DataSource } from '@object-ui/types';

// Probe stand-in: the real chart is irrelevant here, but `refreshing` is not —
// case 3 reads it back off the DOM.
vi.mock('./GanttView', () => ({
  GanttView: ({ tasks, onRefresh, refreshing }: any) => (
    <div data-testid="gantt-view" data-refreshing={String(!!refreshing)}>
      {tasks.map((t: any) => (
        <div key={t.id} data-testid="gantt-task">{t.title}</div>
      ))}
      <button data-testid="gv-refresh" onClick={() => onRefresh?.()}>refresh</button>
    </div>
  ),
}));

const PLACEHOLDER = 'Loading Gantt chart...';

const ROWS_A = [
  { id: '1', name: 'From the stale query', start_date: '2024-01-01', end_date: '2024-01-05' },
];
const ROWS_B = [
  { id: '2', name: 'From the fresh query', start_date: '2024-02-01', end_date: '2024-02-05' },
];

const OBJECT_SCHEMA = {
  fields: {
    name: { type: 'text' },
    start_date: { type: 'date' },
    end_date: { type: 'date' },
  },
};

const GANTT_CONFIG = {
  titleField: 'name',
  startDateField: 'start_date',
  endDateField: 'end_date',
};

function schemaWith(filter?: unknown): any {
  return {
    type: 'gantt',
    gantt: GANTT_CONFIG,
    data: { provider: 'object', object: 'tasks' },
    ...(filter === undefined ? {} : { filter }),
  };
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/**
 * A data source whose every `find()` hands back a promise the test resolves
 * by hand, so reload N and reload N+1 can be held in flight together and
 * completed in either order. `getObjectSchema` resolves immediately, which is
 * what opens the gate and lets the mount's single `find()` go out.
 */
function makeDeferredDataSource() {
  const finds: Deferred<any>[] = [];
  const dataSource = {
    find: vi.fn(() => {
      const d = deferred<any>();
      finds.push(d);
      return d.promise;
    }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue(OBJECT_SCHEMA),
  } as unknown as DataSource;
  return { dataSource, finds };
}

/** Settle one held `find()` and let React flush the resulting commits. */
async function settle(d: Deferred<any>, rows: unknown[]) {
  await act(async () => {
    d.resolve({ data: rows });
    await Promise.resolve();
  });
}

/** Let pending microtasks/effects run without resolving anything. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

/**
 * Bring the component to the state every case below needs: painted, then two
 * reloads in flight at once — a SILENT toolbar refresh (`finds[1]`, owns
 * `refreshing`) superseded by a non-silent filter-change reload (`finds[2]`,
 * owns `loading`).
 *
 * The mount issues exactly ONE `find` since objectui#7225's gate; that single
 * assertion is also this file's live control on the gate, because a
 * regression back to the duplicate query makes `toBe(1)` fail here loudly
 * instead of silently restoring the old overlap generator.
 */
async function paintThenOverlap(
  dataSource: DataSource,
  finds: Deferred<any>[],
  rerender: (ui: React.ReactElement) => void,
) {
  await waitFor(() => expect((dataSource.find as any).mock.calls.length).toBe(1));
  await settle(finds[0], ROWS_A);
  await waitFor(() => expect(screen.getByTestId('gantt-view')).toBeTruthy());

  fireEvent.click(screen.getByTestId('gv-refresh'));
  await waitFor(() => expect((dataSource.find as any).mock.calls.length).toBe(2));
  await waitFor(() =>
    expect(screen.getByTestId('gantt-view').getAttribute('data-refreshing')).toBe('true'),
  );

  rerender(<ObjectGantt schema={schemaWith({ status: 'open' })} dataSource={dataSource} />);
  await waitFor(() => expect((dataSource.find as any).mock.calls.length).toBe(3));
}

describe('ObjectGantt — a superseded reload must not clear the loading state (objectui#7231)', () => {
  it('keeps the placeholder up when the STALE reload finishes first and the fresh one is still in flight', async () => {
    const { dataSource, finds } = makeDeferredDataSource();

    const { rerender } = render(<ObjectGantt schema={schemaWith()} dataSource={dataSource} />);
    await paintThenOverlap(dataSource, finds, rerender);

    // The non-silent reload owns `loading`, so the placeholder is up and the
    // chart is unmounted while both are in flight.
    expect(screen.getByText(PLACEHOLDER)).toBeTruthy();

    // The superseded (silent) reload answers first — the ordinary ordering.
    await settle(finds[1], ROWS_A);

    // Its `finally` must NOT clear `loading`: the fresh query has not answered,
    // so releasing the placeholder here paints an empty chart.
    expect(screen.getByText(PLACEHOLDER)).toBeTruthy();
    expect(screen.queryByTestId('gantt-view')).toBeNull();

    // The current reload answers and owns the transition out of loading.
    await settle(finds[2], ROWS_B);

    await waitFor(() => expect(screen.getByTestId('gantt-view')).toBeTruthy());
    expect(screen.getByText('From the fresh query')).toBeTruthy();
    expect(screen.queryByText('From the stale query')).toBeNull();
  });

  it('control — the fresh reload finishing FIRST paints its rows, and the late stale answer changes nothing', async () => {
    const { dataSource, finds } = makeDeferredDataSource();

    const { rerender } = render(<ObjectGantt schema={schemaWith()} dataSource={dataSource} />);
    await paintThenOverlap(dataSource, finds, rerender);

    // Out-of-order: the current reload answers before the superseded one.
    await settle(finds[2], ROWS_B);

    await waitFor(() => expect(screen.getByTestId('gantt-view')).toBeTruthy());
    expect(screen.getByText('From the fresh query')).toBeTruthy();

    // The late stale answer must neither clobber the data (the pre-existing
    // `setData` guard) nor put the placeholder back.
    await settle(finds[1], ROWS_A);
    await flush();

    expect(screen.getByTestId('gantt-view')).toBeTruthy();
    expect(screen.getByText('From the fresh query')).toBeTruthy();
    expect(screen.queryByText('From the stale query')).toBeNull();
    expect(screen.queryByText(PLACEHOLDER)).toBeNull();
  });

  it('does not strand `refreshing` when a SILENT reload is superseded by a non-silent one', async () => {
    const { dataSource, finds } = makeDeferredDataSource();

    const { rerender } = render(<ObjectGantt schema={schemaWith()} dataSource={dataSource} />);
    await paintThenOverlap(dataSource, finds, rerender);

    expect(screen.getByText(PLACEHOLDER)).toBeTruthy();

    // The superseded silent reload answers: it must touch neither flag.
    await settle(finds[1], ROWS_A);
    expect(screen.getByText(PLACEHOLDER)).toBeTruthy();

    // The current reload answers. Nothing is in flight any more, so BOTH flags
    // must be honest — a guard that only cleared `loading` here would leave the
    // refresh button spinning forever.
    await settle(finds[2], ROWS_B);

    await waitFor(() => expect(screen.getByTestId('gantt-view')).toBeTruthy());
    expect(screen.getByTestId('gantt-view').getAttribute('data-refreshing')).toBe('false');
    expect(screen.getByText('From the fresh query')).toBeTruthy();
  });
});

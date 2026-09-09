/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * A prop-driven column update reaches the DOM in the SAME commit — objectui#8534.
 *
 * ── The defect ────────────────────────────────────────────────────────────
 * `KanbanImpl` keeps the `columns` prop mirrored in `boardColumns` state. That
 * mirror used to be re-synced by a passive `useEffect`, and passive effects run
 * AFTER the commit — so the commit that first carried a populated `columns`
 * prop still rendered the PREVIOUS mirror. A board whose data resolved after
 * mount therefore painted one frame of column headers with empty card lists
 * before a second commit filled them in.
 *
 * ── Why the mirror is still there ─────────────────────────────────────────
 * Deriving `boardColumns` away is NOT available, and this file's second test is
 * the reason. The drag path writes the mirror optimistically, and the `columns`
 * prop never carries card ORDER back: `handleDragEnd`'s same-column branch
 * calls no callback at all, and `ObjectKanban.handleCardMove` early-returns on
 * `fromColumnId === toColumnId` and discards `newIndex`. Order truth is local.
 * A `useMemo`-derived board would roll a committed reorder back on the next
 * prop change — which is why test 2 is a REQUIRED control, not a nicety: it
 * fails any "fix" that deletes the mirror.
 *
 * ── How "one commit late" is observable without layout ────────────────────
 * happy-dom performs no layout, but it does COMMIT. The harness below owns the
 * `columns` prop and carries a `useLayoutEffect` with no dependency array, so
 * it snapshots the DOM once per commit of the subtree it renders. Layout
 * effects run BEFORE passive effects, so a mirror synced by `useEffect` has
 * provably not run yet at snapshot time — the stale frame is visible in
 * `commits`, and that is exactly the frame this pin forbids.
 *
 * ⚠️ SCOPE — this closes ONE of the two races on this board. The other, the
 * `React.lazy` chunk load racing the data commit (`index.tsx`'s `LazyKanban`
 * behind `Suspense`), is untouched here and still open.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import KanbanBoard from '../KanbanImpl';
import type { KanbanColumn } from '../types';

// Capture the board's real `onDragEnd` while still rendering the real provider,
// so `@dnd-kit/sortable`'s hooks keep reading the same context instance.
// dnd-kit's pointer sensors need layout and pointer capture that happy-dom does
// not provide, so a synthesized drop on the production handler is the closest
// honest reproduction of a drag.
const dnd = vi.hoisted(() => ({
  onDragEnd: undefined as undefined | ((event: unknown) => void),
}));

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  const ReactMod = await import('react');
  const CapturingDndContext = (props: Record<string, unknown>) => {
    dnd.onDragEnd = props.onDragEnd as (event: unknown) => void;
    return ReactMod.createElement(actual.DndContext, props as never);
  };
  return { ...actual, DndContext: CapturingDndContext };
});

const POPULATED: KanbanColumn[] = [
  {
    id: 'backlog',
    title: 'Backlog',
    cards: [
      { id: 't1', title: 'Alpha' },
      { id: 't2', title: 'Beta' },
    ],
  },
  { id: 'in_progress', title: 'In Progress', cards: [{ id: 't3', title: 'Gamma' }] },
];

interface CommitSnapshot {
  headers: string[];
  cards: string[];
}

/** Every column list currently in the DOM, and every card inside them. */
function snapshot(): CommitSnapshot {
  const lists = screen
    .queryAllByRole('list')
    .filter((el) => (el.getAttribute('aria-label') ?? '').endsWith(' cards'));
  return {
    headers: lists.map((el) => el.getAttribute('aria-label') ?? ''),
    cards: lists.flatMap((el) =>
      within(el)
        .queryAllByRole('listitem')
        .map((li) => li.getAttribute('aria-label') ?? ''),
    ),
  };
}

/** The cards currently rendered inside a column, by the column's visible title. */
function cardsIn(columnTitle: string): string[] {
  const list = screen.getByRole('list', { name: `${columnTitle} cards` });
  return within(list)
    .queryAllByRole('listitem')
    .map((el) => el.getAttribute('aria-label') ?? '');
}

/**
 * Owns the `columns` prop and records one DOM snapshot per commit.
 *
 * The recorder lives in the PARENT deliberately: the parent's re-render is what
 * delivers the new prop, so its layout effect fires for exactly the commit
 * under test.
 */
function Harness({
  initial,
  onReady,
  commits,
}: {
  initial: KanbanColumn[];
  onReady: (setColumns: (next: KanbanColumn[]) => void) => void;
  commits: CommitSnapshot[];
}) {
  const [columns, setColumns] = React.useState<KanbanColumn[]>(initial);
  React.useEffect(() => {
    onReady(setColumns);
  }, [onReady]);
  React.useLayoutEffect(() => {
    commits.push(snapshot());
  });
  return <KanbanBoard columns={columns} />;
}

function mountHarness(initial: KanbanColumn[]) {
  const commits: CommitSnapshot[] = [];
  let setColumns: ((next: KanbanColumn[]) => void) | undefined;
  render(
    <Harness
      initial={initial}
      commits={commits}
      onReady={(fn) => {
        setColumns = fn;
      }}
    />,
  );
  return {
    commits,
    setColumns: (next: KanbanColumn[]) => {
      act(() => setColumns!(next));
    },
  };
}

afterEach(() => {
  dnd.onDragEnd = undefined;
  cleanup();
  vi.restoreAllMocks();
});

describe('KanbanImpl — prop-driven columns reach the DOM in the same commit (#8534)', () => {
  it('THE GATE: the first commit that has headers already has the cards', () => {
    // Data unresolved at mount: no columns yet, so no headers.
    const { commits, setColumns } = mountHarness([]);
    expect(commits[commits.length - 1]?.headers).toEqual([]);

    // Data resolves.
    setColumns(POPULATED);

    const firstWithHeaders = commits.find((c) => c.headers.length > 0);
    expect(firstWithHeaders).toBeDefined();
    expect(firstWithHeaders!.headers).toEqual(['Backlog cards', 'In Progress cards']);
    // Pre-fix this is `[]` — the headers-with-empty-lists frame of #8534,
    // because the mirror was still the previous (empty) value at commit time.
    expect(firstWithHeaders!.cards).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('REQUIRED CONTROL: an optimistic same-column reorder shows the new order immediately', () => {
    // Order truth is LOCAL — nothing pushes it back through the prop. Any fix
    // that derives `boardColumns` from the prop fails here.
    mountHarness(POPULATED);
    expect(cardsIn('Backlog')).toEqual(['Alpha', 'Beta']);

    expect(dnd.onDragEnd).toBeTypeOf('function');
    act(() => {
      dnd.onDragEnd!({ active: { id: 't1' }, over: { id: 't2' } });
    });

    expect(cardsIn('Backlog')).toEqual(['Beta', 'Alpha']);
    // ...and it must survive the re-render that follows, not flash back.
    expect(cardsIn('In Progress')).toEqual(['Gamma']);
  });

  it('REQUIRED CONTROL: a board that is already populated at mount renders its cards', () => {
    const { commits } = mountHarness(POPULATED);
    expect(cardsIn('Backlog')).toEqual(['Alpha', 'Beta']);
    expect(cardsIn('In Progress')).toEqual(['Gamma']);
    expect(commits[0]?.cards).toEqual(['Alpha', 'Beta', 'Gamma']);
  });
});

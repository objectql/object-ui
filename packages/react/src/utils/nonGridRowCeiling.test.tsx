/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7210 (ruling a′) — the platform row ceiling for non-grid views, at
 * the one place all four of them share it.
 *
 * The four view-level pins (gantt, calendar, map, tree) each assert the ruling
 * END TO END on their own surface. This file pins the two things those cannot
 * see, because they are properties of the mechanism rather than of any one
 * view:
 *
 *   1. `NON_GRID_ROW_CEILING_TOP` is the ceiling PLUS ONE. The probe row is
 *      what makes truncation detectable at all, and it is detectable from the
 *      rows alone — a result set of exactly the ceiling and one of 200,000
 *      are otherwise the same 2,000 rows with an optional `total` that many
 *      adapters do not send.
 *   2. The note names BOTH numbers when the adapter reported a total, and
 *      still says something DEFINITE when it did not.
 *
 * REVERSE VERIFICATION — direction predicted before running: change
 * `NON_GRID_ROW_CEILING_TOP` to `NON_GRID_ROW_CEILING` and the "exactly at the
 * ceiling is NOT truncated" / "one past it IS" pair collapses — the second case
 * turns red because the probe row it depends on is gone.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  NON_GRID_ROW_CEILING,
  NON_GRID_ROW_CEILING_TOP,
  applyNonGridRowCeiling,
  NonGridRowCeilingNote,
} from './nonGridRowCeiling.js';

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i + 1) }));

describe('objectui#7210 — the non-grid row ceiling', () => {
  it('asks for exactly one row more than it will draw', () => {
    expect(NON_GRID_ROW_CEILING_TOP).toBe(NON_GRID_ROW_CEILING + 1);
  });

  it('a result set exactly AT the ceiling is not truncated and keeps every row', () => {
    const capped = applyNonGridRowCeiling({ data: rows(NON_GRID_ROW_CEILING) });
    expect(capped.truncated).toBe(false);
    expect(capped.rows).toHaveLength(NON_GRID_ROW_CEILING);
  });

  it('one row PAST the ceiling is truncated, and the probe row is sliced back off', () => {
    const capped = applyNonGridRowCeiling({ data: rows(NON_GRID_ROW_CEILING_TOP), total: 41234 });
    expect(capped.truncated).toBe(true);
    expect(capped.rows).toHaveLength(NON_GRID_ROW_CEILING);
    expect(capped.total).toBe(41234);
  });

  it('detects truncation from a BARE ARRAY response, which carries no total at all', () => {
    // The adapters least likely to page correctly are exactly the ones that
    // report no `total`; a `total`-based test would go quiet on them.
    const capped = applyNonGridRowCeiling(rows(NON_GRID_ROW_CEILING_TOP));
    expect(capped.truncated).toBe(true);
    expect(capped.total).toBeUndefined();
    expect(capped.rows).toHaveLength(NON_GRID_ROW_CEILING);
  });

  it('renders NOTHING when nothing was truncated', () => {
    const { container } = render(
      <NonGridRowCeilingNote drawn={NON_GRID_ROW_CEILING} total={12} truncated={false} />,
    );
    expect(container.querySelector('[data-row-ceiling-note]')).toBeNull();
  });

  it('names BOTH numbers when the adapter reported a total', () => {
    render(<NonGridRowCeilingNote drawn={NON_GRID_ROW_CEILING} total={41234} truncated />);
    const note = screen.getByRole('note');
    expect(note.textContent).toContain(String(NON_GRID_ROW_CEILING));
    expect(note.textContent).toContain('41234');
  });

  it('still says something DEFINITE when the adapter reported no total', () => {
    render(<NonGridRowCeilingNote drawn={NON_GRID_ROW_CEILING} truncated />);
    const note = screen.getByRole('note');
    expect(note.textContent).toContain(String(NON_GRID_ROW_CEILING));
    // Definite, not a "may": the probe row proved more rows exist, and the
    // sentence says "the FIRST N" rather than hedging. It must not invent an M.
    expect(note.textContent).toMatch(/first/i);
    expect(note.textContent).not.toMatch(/undefined|NaN/);
  });
});

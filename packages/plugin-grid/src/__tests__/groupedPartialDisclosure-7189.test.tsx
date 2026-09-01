/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7189 — a grouped grid says, WHERE THE GROUP COUNTS ARE, that it
 * grouped a page.
 *
 * ## The defect this discloses (measured on `main` at a6d8b8d44)
 *
 * `useGroupedData` buckets the rows the browser already holds and computes
 * every per-group aggregate from that same array, so both the set of groups
 * and every number in a group header are properties of the FETCHED PAGE, not
 * of the query. Over a 186-row store distributed 86/61/31/7/1 across five
 * units with `$top: 100`, `main` rendered:
 *
 *   - contiguous rows  → TWO group headers, `86` and `14`. Three of the five
 *     units were absent from the screen entirely.
 *   - interleaved rows → five headers reading 31/31/30/1/7 — every count a
 *     page slice of the real 86/61/31/7/1.
 *
 * and in both cases the document contained no "186", no "partial", no
 * "loaded". A wrong number invites a second look; an absent row invites none.
 *
 * ## What is under test here, and what is NOT
 *
 * The grouping and aggregation algorithm is CORRECT for what it does and is
 * untouched — the counts asserted below are still page slices afterwards.
 * These pins are about the *statement*: the grid now says so beside the
 * numbers a reader treats as authoritative, and stays silent when the result
 * set genuinely fits. Server-side grouping is a separate, undecided question
 * (escalated on #5560) and nothing here anticipates it.
 *
 * The conditional half is as load-bearing as the disclosure half. A marker
 * that is simply always on says nothing, so every positive pin below is
 * paired with a control that must NOT show it.
 *
 * ## Why jsdom is a measurement here and not a guess
 *
 * jsdom applies CSS media-query rules irrespective of `innerWidth`, so a
 * width-dependent reading taken in it is not a measurement. Nothing in this
 * disclosure is width-dependent: it carries no `hidden`/`md:` visibility
 * utility, and the grouped render path is the only one grouping can reach —
 * ObjectGrid's mobile card view is gated `useCardView && … && !isGrouped`.
 * The last pin in this file asserts that gate directly rather than trusting
 * the reading.
 *
 * ## Test-source note
 *
 * This file imports `../ObjectGrid` relatively and the root vitest config
 * aliases `@object-ui/*` to each package's `src`, so no build step stands
 * between the edit and the run (the same standing arrangement
 * `groupingProjection-7179.test.tsx` records).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { ObjectGrid } from '../ObjectGrid';
import { ActionProvider } from '@object-ui/react';

const OBJECT = 'duly_task';

const OBJECT_FIELDS = {
  id: { type: 'text', label: 'Id' },
  subject: { type: 'text', label: 'Subject' },
  business_unit: { type: 'text', label: 'Business Unit' },
  region: { type: 'text', label: 'Region' },
};

/**
 * The card's own distribution: 186 records over five business units, sized
 * 86 / 61 / 31 / 7 / 1. Ordering is a parameter because it decides WHICH
 * shape of the defect you see — contiguous hides whole groups, interleaved
 * shrinks every count — and the disclosure has to be true of both.
 */
const UNITS: Array<[string, number]> = [
  ['Northgate Operations', 86],
  ['Northgate Plant', 61],
  ['Northgate Quality', 31],
  ['Riverside Plant', 7],
  ['Riverside Depot', 1],
];

interface Row {
  id: string;
  subject: string;
  business_unit: string;
  region: string;
}

const buildRows = (interleaved: boolean): Row[] => {
  const buckets = UNITS.map(([unit, n]) =>
    Array.from({ length: n }, (_, i) => ({
      id: `${unit}-${i}`,
      subject: `${unit} #${i}`,
      business_unit: unit,
      region: unit.startsWith('Northgate') ? 'North' : 'River',
    })),
  );
  if (!interleaved) return buckets.flat();
  const out: Row[] = [];
  for (let i = 0; ; i++) {
    let took = false;
    for (const b of buckets) {
      if (i < b.length) { out.push(b[i]); took = true; }
    }
    if (!took) return out;
  }
};

const ALL_186 = buildRows(true);
expect(ALL_186).toHaveLength(186);

/**
 * A data source that honours `$top`/`$skip`. `total` is optional so the
 * "no total is reachable" branch can be measured rather than assumed.
 */
const makeDataSource = (rows: Row[], opts?: { withTotal?: boolean }) => ({
  find: vi.fn(async (_object: string, params: Record<string, unknown>) => {
    const skip = (params.$skip as number | undefined) ?? 0;
    const top = (params.$top as number | undefined) ?? rows.length;
    const page = rows.slice(skip, skip + top);
    return opts?.withTotal === false
      ? { data: page }
      : { data: page, total: rows.length };
  }),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getObjectSchema: vi.fn(async () => ({ name: OBJECT, fields: OBJECT_FIELDS })),
});

const groupRows = () => [...document.querySelectorAll('[data-testid^="group-row-"]')];
const groupHeaders = () =>
  groupRows().map((r) => ({
    label: r.querySelector('.group-label')?.textContent,
    count: r.querySelector('.group-count')?.textContent,
  }));
const partialMarkers = () => [...document.querySelectorAll('.group-count-partial')];
const notice = () => screen.queryByTestId('grouping-partial-notice');

const renderGrid = async (props: Record<string, unknown>) => {
  const result = render(
    <ActionProvider>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ObjectGrid {...(props as any)} />
    </ActionProvider>,
  );
  await vi.waitFor(() => expect(document.querySelector('[data-testid]')).toBeTruthy());
  return result;
};

const groupedSchema = (extra: Record<string, unknown> = {}) => ({
  type: 'object-grid',
  objectName: OBJECT,
  columns: ['subject'],
  grouping: { fields: [{ field: 'business_unit' }] },
  ...extra,
});

afterEach(() => cleanup());

describe('ObjectGrid — a grouped grid discloses that it grouped a page (objectui#7189)', () => {
  // ── PIN 1: THE DISCLOSURE, WHERE THE COUNTS ARE ─────────────────────────
  it('marks every group count when the result set exceeds the rows in hand', async () => {
    const ds = makeDataSource(ALL_186);
    await renderGrid({
      schema: groupedSchema({ pagination: { pageSize: 100 } }),
      dataSource: ds,
    });

    await vi.waitFor(() => expect(groupRows().length).toBeGreaterThan(0));

    // The counts are STILL page slices — the algorithm is untouched. What
    // changed is that each of them now carries the marker.
    expect(
      partialMarkers().length,
      'every group header count is a page slice, so every one of them is marked',
    ).toBe(groupRows().length);
    expect(partialMarkers().length).toBeGreaterThan(0);
  });

  it('states the partial-ness above the group list, with both real numbers', async () => {
    const ds = makeDataSource(ALL_186);
    await renderGrid({
      schema: groupedSchema({ pagination: { pageSize: 100 } }),
      dataSource: ds,
    });

    await vi.waitFor(() => expect(notice()).toBeInTheDocument());
    const text = notice()!.textContent ?? '';
    // 100 rows loaded of a 186-row result set. Both numbers are measured
    // here, not copied: 100 is the `$top` the grid sent, 186 the fixture.
    expect(text).toContain('100');
    expect(text).toContain('186');
    expect(text).toMatch(/missing/i);
  });

  it('is reached by the group-count marker as its accessible name', async () => {
    const ds = makeDataSource(ALL_186);
    await renderGrid({
      schema: groupedSchema({ pagination: { pageSize: 100 } }),
      dataSource: ds,
    });

    await vi.waitFor(() => expect(partialMarkers().length).toBeGreaterThan(0));
    const marker = partialMarkers()[0];
    // The marker beside the number is not a bare glyph: the whole sentence,
    // numbers included, is its `title` AND its accessible name, so the
    // disclosure is not lost to a reader who never sees the banner.
    expect(marker.getAttribute('title')).toContain('186');
    expect(marker.getAttribute('aria-label')).toContain('186');
  });

  // ── PIN 2: THE DEFECT IT DISCLOSES IS REAL, IN BOTH SHAPES ──────────────
  it('discloses the shape where whole groups are missing (contiguous rows)', async () => {
    const ds = makeDataSource(buildRows(false));
    await renderGrid({
      schema: groupedSchema({ pagination: { pageSize: 100 } }),
      dataSource: ds,
    });

    await vi.waitFor(() => expect(groupRows().length).toBeGreaterThan(0));
    // Measured on `main` before the disclosure existed, and unchanged by it:
    // the first 100 of these rows hold only two of the five units.
    expect(groupHeaders()).toEqual([
      { label: 'Northgate Operations', count: '86' },
      { label: 'Northgate Plant', count: '14' },
    ]);
    expect(screen.queryByText('Riverside Depot')).not.toBeInTheDocument();
    // Three units are absent from the screen. THAT is what the notice is for.
    expect(notice()).toBeInTheDocument();
  });

  it('discloses the shape where every count is a slice (interleaved rows)', async () => {
    const ds = makeDataSource(ALL_186);
    await renderGrid({
      schema: groupedSchema({ pagination: { pageSize: 100 } }),
      dataSource: ds,
    });

    await vi.waitFor(() => expect(groupRows().length).toBe(5));
    // All five units resolve (that is objectui#7179's fix, live here), and
    // every count is short of the store's 86/61/31/7/1.
    expect(groupHeaders().map((g) => g.count)).toEqual(['31', '31', '30', '1', '7']);
    expect(partialMarkers().length).toBe(5);
  });

  // ── PIN 3: THE CONTROLS — the marker is CONDITIONAL ─────────────────────
  it('stays silent when the whole result set fits in the page', async () => {
    const fits = ALL_186.slice(0, 40);
    const ds = makeDataSource(fits);
    await renderGrid({
      schema: groupedSchema({ pagination: { pageSize: 100 } }),
      dataSource: ds,
    });

    await vi.waitFor(() => expect(groupRows().length).toBe(5));
    // 40 of 40: every group is whole and every count is the truth.
    const counts = groupHeaders().map((g) => Number(g.count));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(40);
    expect(
      notice(),
      'a marker that is always on says nothing — silence here is what makes it mean something',
    ).not.toBeInTheDocument();
    expect(partialMarkers()).toHaveLength(0);
  });

  it('leaves an UNGROUPED grid untouched, however short of the total it is', async () => {
    const ds = makeDataSource(ALL_186);
    await renderGrid({
      schema: {
        type: 'object-grid',
        objectName: OBJECT,
        columns: ['subject'],
        pagination: { pageSize: 100 },
      },
      dataSource: ds,
    });

    await vi.waitFor(() => expect(ds.find).toHaveBeenCalled());
    await vi.waitFor(() => expect(screen.queryAllByText(/Northgate Operations #0/).length).toBeGreaterThan(0));
    expect(groupRows()).toHaveLength(0);
    expect(notice()).not.toBeInTheDocument();
    expect(partialMarkers()).toHaveLength(0);
  });

  it('does not mark rows handed to it inline — nothing was asked for, nothing withheld', async () => {
    await renderGrid({
      schema: groupedSchema({
        data: { provider: 'value', items: ALL_186 },
        pagination: { pageSize: 100 },
      }),
    });

    await vi.waitFor(() => expect(groupRows().length).toBeGreaterThan(0));
    expect(notice()).not.toBeInTheDocument();
    expect(partialMarkers()).toHaveLength(0);
  });

  // ── PIN 4: WHERE THE TOTAL COMES FROM ───────────────────────────────────
  it('reads the total a HOST supplies (the ListView paging shape)', async () => {
    const ds = makeDataSource(ALL_186);
    await renderGrid({
      schema: groupedSchema(),
      dataSource: ds,
      data: ALL_186.slice(0, 100),
      manualPagination: true,
      rowCount: 186,
      page: 1,
      pageSize: 100,
      onPageChange: () => {},
    });

    await vi.waitFor(() => expect(notice()).toBeInTheDocument());
    // The host owns the fetch here, so the grid's own `totalMatching` is
    // never written; the number has to come from `rowCount`.
    expect(notice()!.textContent).toContain('186');
    expect(partialMarkers().length).toBe(groupRows().length);
  });

  it('falls back to the weaker, honest sentence when NO total is reachable', async () => {
    const ds = makeDataSource(ALL_186, { withTotal: false });
    await renderGrid({
      schema: groupedSchema({ pagination: { pageSize: 100 } }),
      dataSource: ds,
    });

    await vi.waitFor(() => expect(notice()).toBeInTheDocument());
    const text = notice()!.textContent ?? '';
    // The window came back full, which is the same inference `plugin-list`'s
    // own footer draws with no total — so it may only say "may", and it must
    // not invent a figure it does not have.
    expect(text).toContain('100');
    expect(text).toMatch(/\bmay\b/i);
    expect(text).not.toContain('186');
    expect(text).not.toMatch(/of \d+ records/i);
  });

  it('stays silent with no total when the window came back SHORT', async () => {
    const ds = makeDataSource(ALL_186.slice(0, 40), { withTotal: false });
    await renderGrid({
      schema: groupedSchema({ pagination: { pageSize: 100 } }),
      dataSource: ds,
    });

    await vi.waitFor(() => expect(groupRows().length).toBe(5));
    // 40 rows came back against a 100-row window: nothing was withheld.
    expect(notice()).not.toBeInTheDocument();
    expect(partialMarkers()).toHaveLength(0);
  });

  // ── PIN 5: EVERY LEVEL, not just the top one ────────────────────────────
  it('marks nested subgroup counts too — they are page slices at every depth', async () => {
    const ds = makeDataSource(ALL_186);
    await renderGrid({
      schema: groupedSchema({
        pagination: { pageSize: 100 },
        grouping: { fields: [{ field: 'region' }, { field: 'business_unit' }] },
      }),
      dataSource: ds,
    });

    await vi.waitFor(() => expect(groupRows().length).toBeGreaterThan(2));
    const depths = new Set(
      groupRows().map((r) => (r.getAttribute('data-testid') ?? '').includes('__') ? 'nested' : 'top'),
    );
    expect(depths.has('nested'), 'the fixture must actually produce a second level').toBe(true);
    expect(partialMarkers().length).toBe(groupRows().length);
  });

  // ── PIN 6: the jsdom caveat, closed by source rather than by reading ────
  it('is not width-conditional: grouping never reaches the mobile card view', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    // The repo root: this repo's vitest guard refuses any invocation whose
    // root is not it (objectui#3378), so `process.cwd()` is that root by
    // construction and needs no walking up.
    const src = fs.readFileSync(
      path.join(process.cwd(), 'packages/plugin-grid/src/ObjectGrid.tsx'),
      'utf8',
    );
    // The one width-driven branch in this component excludes grouping, so the
    // grouped render path — and therefore this disclosure — is the same at
    // every viewport. Pinned in source because jsdom cannot measure it:
    // it applies media-query rules irrespective of `innerWidth`.
    expect(src).toContain('if (useCardView && data.length > 0 && !isGrouped) {');
    // And the disclosure itself carries no responsive visibility utility.
    const noticeMarkup = src.slice(src.indexOf('data-testid="grouping-partial-notice"'));
    expect(noticeMarkup.slice(0, 400)).not.toMatch(/\b(hidden|sm:hidden|md:hidden|md:block|lg:block)\b/);
  });
});

// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The Data pillar's grid must not issue a duplicate find() on every render —
 * objectui#4567.
 *
 * Measured on origin/main: driving the pillar and forcing three re-renders that
 * change NOTHING (same object, same fields, same refresh signal) produced one
 * extra `find()` per render — 1 -> 4. The trigger is the IDENTITY of the columns
 * array, not its contents. Three legs, all on the path this suite drives:
 *
 *   1. producer — `StudioDesignSurface`'s object-view schema built
 *      `table.fields` with `readFields(objDraft.fields).entries.map().filter()`
 *      inline, allocating a fresh array on every render;
 *   2. forward — plugin-view's ObjectView hands that array to the
 *      `renderListView` slot as `columns` BY REFERENCE
 *      (plugin-view/src/ObjectView.tsx:997 — no map/filter of its own), and in
 *      design mode there is no saved view, so it falls through to
 *      `schema.table?.fields`;
 *   3. consumer — `ListView` derives `expandFields` from `schema.columns` with
 *      that array in the memo's dep array BY IDENTITY
 *      (plugin-list/src/ListView.tsx:1245-1294), and `expandFields` is itself in
 *      the fetch effect's dep array (:1609). A fresh array therefore refetches.
 *
 * The fix is identity stabilisation at the PRODUCER (leg 1). ListView's
 * by-identity dependency is correct for a real column change and is left
 * untouched — plugin-list is read-only here.
 *
 * This suite drives the REAL producer (`DataPillar`), not a reconstruction of
 * it: the defect is a property of how that component builds its schema, so a
 * harness that built its own array would measure the harness. That is also why
 * it is a separate file from `StudioDesignSurface.gridRefresh.test.tsx`
 * (objectui#4549), which drives the slot directly and hoists its own stable
 * `columns` to work around this very defect — those tests stay as they are.
 */

import '@testing-library/jest-dom/vitest';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const objectDef = {
  name: 'showcase_task',
  label: 'Task',
  fields: [
    { name: 'name', label: 'Name', type: 'text' },
    { name: 'status', label: 'Status', type: 'text' },
  ],
};

const mockClient = {
  list: vi.fn(async () => [{ name: 'showcase_task', label: 'Task' }]),
  listDrafts: vi.fn(async () => []),
  layered: vi.fn(async () => ({ effective: objectDef, code: objectDef })),
  getDraft: vi.fn(async () => null),
  save: vi.fn(async () => ({})),
};

/** The counting dataSource — `find` is the measurement. */
function createDataSource() {
  return {
    find: vi.fn(async () => []),
    findOne: vi.fn(async () => null),
    create: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    getObjectSchema: vi.fn(async () => objectDef),
  };
}

/**
 * Module-scope so the `useAdapter` mock factory (hoisted) closes over the
 * binding rather than a value, and so the reference handed to the pillar is
 * STABLE across renders — an adapter that changed identity per render would
 * manufacture the very churn these tests measure.
 */
let dataSource = createDataSource();

vi.mock('../metadata-admin/useMetadata', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../metadata-admin/useMetadata')>();
  return {
    ...mod,
    useMetadataClient: () => mockClient,
    useMetadataTypes: () => ({ entries: [] }),
  };
});

vi.mock('./packages-io', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./packages-io')>();
  return { ...mod, fetchPackages: vi.fn(async () => []) };
});

vi.mock('@object-ui/react', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@object-ui/react')>();
  return { ...mod, useAdapter: () => dataSource };
});

import { DataPillar } from './StudioDesignSurface';

beforeEach(() => {
  dataSource = createDataSource();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Long enough for the mount's own fetch to settle before a measurement. */
const SETTLE_MS = 300;
const settle = () => new Promise((r) => setTimeout(r, SETTLE_MS));

/**
 * Renders the real pillar under a parent that can force a no-op re-render.
 * `DataPillar` is not memoized, so a parent render re-renders it — which is
 * exactly the Studio steady state the card describes (its whole schema is a
 * fresh object literal each time).
 */
function Harness(): React.ReactElement {
  const [, force] = React.useState(0);
  return (
    <MemoryRouter initialEntries={['/studio/com.example.showcase/data']}>
      <button type="button" data-testid="rerender" onClick={() => force((n) => n + 1)}>
        rerender
      </button>
      <DataPillar packageId="com.example.showcase" />
    </MemoryRouter>
  );
}

/** Mount, land on the auto-selected object's grid, and let the first fetch settle. */
async function mountSettledGrid(): Promise<number> {
  render(<Harness />);
  await waitFor(() => expect(dataSource.find).toHaveBeenCalled(), { timeout: 4000 });
  await settle();
  return dataSource.find.mock.calls.length;
}

describe('Studio Data pillar grid — the columns array keeps a stable identity (#4567)', () => {
  it('three no-op re-renders issue NO extra find()', async () => {
    const before = await mountSettledGrid();

    // Nothing changes: same object, same fields, same refresh signal. Before the
    // fix each of these rebuilt `table.fields`, and one find() rode out per render.
    fireEvent.click(screen.getByTestId('rerender'));
    fireEvent.click(screen.getByTestId('rerender'));
    fireEvent.click(screen.getByTestId('rerender'));
    await settle();

    expect(dataSource.find.mock.calls.length).toBe(before);
  });

  /**
   * The dependency must stay LIVE, not be defeated. This pin is green before and
   * after the fix on purpose — it is a must-not-change, not a red-first case.
   * Its force comes from the path it uses: "+ Add field" mutates `objDraft.fields`
   * WITHOUT remounting the grid (its key is `${current.name}:${gridVer}` and
   * `gridVer` is unchanged), so the refetch it produces can only have arrived
   * through the column-identity dependency chain. A memo that froze the columns
   * (or returned a constant) would turn this red.
   */
  it('a REAL column change still refetches — the dependency stays live', async () => {
    const before = await mountSettledGrid();

    fireEvent.click(screen.getAllByRole('button', { name: /Add field/i })[0]);

    await waitFor(() => expect(dataSource.find.mock.calls.length).toBeGreaterThan(before), {
      timeout: 4000,
    });
  });
});

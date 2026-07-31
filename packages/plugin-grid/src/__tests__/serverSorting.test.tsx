/**
 * Column-header sorting reaches the server (objectui#3106).
 *
 * Before the fix, DataTable's header sort was internal state with no callback
 * out of the component, so under server pagination it reordered the fifty rows
 * on screen and stopped there. The list looked sorted by that column; page 2
 * started over. Nothing said so.
 *
 * After the fix a header click becomes a `$orderby` on the refetch — the sort
 * applies to the whole collection — and the grid returns to page 1, because a
 * new ordering makes "page 5" a different set of rows.
 *
 * The relational-column half is #3096's: a `lookup` column shows a related
 * record's name while the server can only order by the stored id
 * (objectstack#4256 settled that no join is coming), so those headers are
 * withheld rather than offered as an ordering by something invisible.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { ObjectGrid, parseSchemaSort } from '../ObjectGrid';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider } from '@object-ui/react';

registerAllFields();

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false) as any;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn() as any;
  }
});

const TOTAL = 300;
const PAGE_SIZE = 50;

function makeDataSource() {
  const find = vi.fn(async (_object: string, params: any) => {
    const top = params.$top ?? PAGE_SIZE;
    const skip = params.$skip ?? 0;
    const rows = Array.from({ length: Math.max(0, Math.min(top, TOTAL - skip)) }, (_, i) => ({
      id: `id-${skip + i}`,
      name: `Row ${skip + i}`,
      status: 'open',
      owner: { id: 'u1', name: 'Ada' },
    }));
    return { data: rows, total: TOTAL, hasMore: skip + rows.length < TOTAL, pageSize: top };
  });
  return {
    find,
    getObjectSchema: async (name: string) => ({
      name,
      fields: {
        id: { type: 'text' },
        name: { type: 'text' },
        status: { type: 'text' },
        owner: { type: 'lookup', reference_to: 'user' },
      },
    }),
  } as any;
}

function renderGrid(dataSource: any, opts?: Record<string, any>) {
  const schema: any = {
    type: 'object-grid',
    objectName: 'task',
    columns: [
      { field: 'name', label: 'Name' },
      { field: 'status', label: 'Status' },
      { field: 'owner', label: 'Owner' },
    ],
    pagination: { pageSize: PAGE_SIZE },
    ...opts,
  };
  return render(
    <ActionProvider>
      <ObjectGrid schema={schema} dataSource={dataSource} />
    </ActionProvider>,
  );
}

const lastFindParams = (ds: any) => ds.find.mock.calls[ds.find.mock.calls.length - 1][1];

const headerCell = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll('thead th')).find((th) =>
    th.textContent?.includes(label),
  ) as HTMLElement;

describe('ObjectGrid — column-header sorting is server-side (#3106)', () => {
  it('turns a header click into an $orderby on the refetch', async () => {
    const ds = makeDataSource();
    const { container } = renderGrid(ds);
    await waitFor(() => expect(screen.getByText('Row 0')).toBeInTheDocument());

    fireEvent.click(headerCell(container, 'Status'));

    await waitFor(() => {
      expect(lastFindParams(ds).$orderby).toEqual([{ field: 'status', order: 'asc' }]);
    });
  });

  it('toggles to descending on the second click', async () => {
    const ds = makeDataSource();
    const { container } = renderGrid(ds);
    await waitFor(() => expect(screen.getByText('Row 0')).toBeInTheDocument());

    fireEvent.click(headerCell(container, 'Status'));
    await waitFor(() => expect(lastFindParams(ds).$orderby).toEqual([{ field: 'status', order: 'asc' }]));

    fireEvent.click(headerCell(container, 'Status'));
    await waitFor(() => expect(lastFindParams(ds).$orderby).toEqual([{ field: 'status', order: 'desc' }]));
  });

  it('returns to page 1 — a new ordering makes the old page index a different set of rows', async () => {
    const ds = makeDataSource();
    const { container } = renderGrid(ds);
    await waitFor(() => expect(screen.getByText('Row 0')).toBeInTheDocument());

    // Advance off page 1 first (last-page button guarantees a forward jump).
    const navButtons = Array.from(container.querySelectorAll('button')).filter(
      (b) => !(b as HTMLButtonElement).disabled,
    );
    fireEvent.click(navButtons[navButtons.length - 1]);
    await waitFor(() => expect(lastFindParams(ds).$skip).toBeGreaterThan(0));

    fireEvent.click(headerCell(container, 'Status'));

    await waitFor(() => {
      const p = lastFindParams(ds);
      expect(p.$orderby).toEqual([{ field: 'status', order: 'asc' }]);
      expect(p.$skip ?? 0).toBe(0);
    });
  });

  it('replaces the view\'s declared sort rather than stacking on it', async () => {
    const ds = makeDataSource();
    const { container } = renderGrid(ds, { sort: 'name desc' });
    await waitFor(() => expect(screen.getByText('Row 0')).toBeInTheDocument());
    // The declared sort goes out as the string form it was authored in.
    expect(lastFindParams(ds).$orderby).toBe('name desc');

    fireEvent.click(headerCell(container, 'Status'));

    await waitFor(() => {
      expect(lastFindParams(ds).$orderby).toEqual([{ field: 'status', order: 'asc' }]);
    });
  });

  it('shows the view\'s declared sort before anyone clicks', async () => {
    // Otherwise the first click on that column asks for `asc` on a list that is
    // already `desc`, and the arrow only tells the truth from click two on.
    const ds = makeDataSource();
    const { container } = renderGrid(ds, { sort: 'status desc' });
    await waitFor(() => expect(screen.getByText('Row 0')).toBeInTheDocument());

    expect(headerCell(container, 'Status').querySelector('[class*="chevron-down"]')).not.toBeNull();

    // …and clicking it therefore toggles to ascending rather than restating desc.
    fireEvent.click(headerCell(container, 'Status'));
    await waitFor(() => {
      expect(lastFindParams(ds).$orderby).toEqual([{ field: 'status', order: 'asc' }]);
    });
  });

  it('withholds the sort affordance from a relational column (#3096)', async () => {
    const ds = makeDataSource();
    const { container } = renderGrid(ds);
    await waitFor(() => expect(screen.getByText('Row 0')).toBeInTheDocument());

    const owner = headerCell(container, 'Owner');
    expect(owner.className).not.toContain('cursor-pointer');

    const before = ds.find.mock.calls.length;
    fireEvent.click(owner);
    // No refetch: the click is not a sort request.
    await new Promise((r) => setTimeout(r, 20));
    expect(ds.find.mock.calls.length).toBe(before);
  });
});

describe('parseSchemaSort — the header reads what the fetch path reads', () => {
  it('reads the bare-string form', () => {
    expect(parseSchemaSort('name desc')).toEqual([{ field: 'name', order: 'desc' }]);
  });

  it('defaults an omitted direction to ascending', () => {
    expect(parseSchemaSort('name')).toEqual([{ field: 'name', order: 'asc' }]);
  });

  it('reads the array-of-strings form', () => {
    expect(parseSchemaSort(['status asc', 'name desc'])).toEqual([
      { field: 'status', order: 'asc' },
      { field: 'name', order: 'desc' },
    ]);
  });

  it('reads the SortNode[] form', () => {
    expect(parseSchemaSort([{ field: 'name', order: 'desc' }])).toEqual([
      { field: 'name', order: 'desc' },
    ]);
  });

  it('yields nothing for an absent or unreadable sort', () => {
    expect(parseSchemaSort(undefined)).toEqual([]);
    expect(parseSchemaSort(null)).toEqual([]);
    expect(parseSchemaSort(42)).toEqual([]);
  });
});

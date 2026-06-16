/**
 * Grouped view pagination + shared horizontal scroll
 *
 * Regression coverage for the grouped list view bugs:
 *   1. data shown incompletely (every group rendered at once, squeezed)
 *   2. no pagination (groups never paginated)
 *   3. no x-axis scrollbar (each group scrolled independently / not at all)
 *
 * The fix paginates whole top-level groups (a group never splits across a
 * page) and wraps every per-group sub-table in ONE shared horizontal scroll
 * container so columns stay aligned with a single x-axis scrollbar.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { ObjectGrid } from '../ObjectGrid';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider } from '@object-ui/react';

registerAllFields();

// 25 rows, each with a unique `category` → 25 distinct top-level groups.
const manyGroups = Array.from({ length: 25 }, (_, i) => ({
  id: String(i + 1),
  name: `Row ${i + 1}`,
  category: `Cat ${String(i + 1).padStart(2, '0')}`,
  amount: (i + 1) * 10,
}));

function renderGroupedGrid(opts?: Record<string, any>) {
  const schema: any = {
    type: 'object-grid' as const,
    objectName: 'test_object',
    columns: [
      { field: 'name', label: 'Name' },
      { field: 'amount', label: 'Amount', type: 'number' },
    ],
    data: { provider: 'value', items: manyGroups },
    grouping: { fields: [{ field: 'category' }] },
    ...opts,
  };
  return render(
    <ActionProvider>
      <ObjectGrid schema={schema} />
    </ActionProvider>
  );
}

const groupRows = () =>
  document.querySelectorAll('[data-testid^="group-row-"]');

describe('Grouped view pagination', () => {
  it('paginates top-level groups instead of rendering all at once', async () => {
    renderGroupedGrid();
    // Default page size falls back to 10 → first page shows 10 of 25 groups.
    await waitFor(() => expect(groupRows().length).toBe(10));
    expect(screen.getByText('Cat 01')).toBeInTheDocument();
    expect(screen.queryByText('Cat 11')).not.toBeInTheDocument();
  });

  it('renders a pager with page info when there is more than one page', async () => {
    renderGroupedGrid();
    await waitFor(() => expect(groupRows().length).toBe(10));
    // 25 groups / 10 per page = 3 pages.
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Rows per page:')).toBeInTheDocument();
  });

  it('advances to the next page of groups when clicking next', async () => {
    renderGroupedGrid();
    await waitFor(() => expect(screen.getByText('Page 1 of 3')).toBeInTheDocument());

    // The "next" chevron is the 3rd of the 4 nav buttons (first, prev, next, last).
    const navButtons = screen
      .getByText('Page 1 of 3')
      .parentElement!.querySelectorAll('button');
    expect(navButtons.length).toBe(4);
    fireEvent.click(navButtons[2]); // next

    await waitFor(() => expect(screen.getByText('Page 2 of 3')).toBeInTheDocument());
    expect(screen.getByText('Cat 11')).toBeInTheDocument();
    expect(screen.queryByText('Cat 01')).not.toBeInTheDocument();
    expect(groupRows().length).toBe(10);
  });

  it('shows the last (partial) page of groups', async () => {
    renderGroupedGrid();
    await waitFor(() => expect(screen.getByText('Page 1 of 3')).toBeInTheDocument());

    const navButtons = screen
      .getByText('Page 1 of 3')
      .parentElement!.querySelectorAll('button');
    fireEvent.click(navButtons[3]); // last

    await waitFor(() => expect(screen.getByText('Page 3 of 3')).toBeInTheDocument());
    // 25 = 10 + 10 + 5 → last page has the remaining 5 groups.
    expect(groupRows().length).toBe(5);
    expect(screen.getByText('Cat 25')).toBeInTheDocument();
  });

  it('changing page size repaginates and resets to page 1', async () => {
    renderGroupedGrid();
    await waitFor(() => expect(screen.getByText('Page 1 of 3')).toBeInTheDocument());

    const select = document.querySelector('select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    fireEvent.change(select, { target: { value: '20' } });

    // 25 / 20 = 2 pages, page reset to 1, first page shows 20 groups.
    await waitFor(() => expect(screen.getByText('Page 1 of 2')).toBeInTheDocument());
    expect(groupRows().length).toBe(20);
  });

  it('does not render a pager when groups fit on a single page', async () => {
    renderGroupedGrid({ pagination: { pageSize: 100 } });
    await waitFor(() => expect(groupRows().length).toBe(25));
    expect(screen.queryByText(/^Page \d+ of \d+$/)).not.toBeInTheDocument();
  });

  it('wraps grouped tables in a single shared horizontal scroll container', async () => {
    const { container } = renderGroupedGrid();
    await waitFor(() => expect(groupRows().length).toBe(10));
    // One shared overflow scroller whose inner track is min-w-max so every
    // sub-table overflows into the SAME x-axis scrollbar.
    const innerTrack = container.querySelector('.min-w-max');
    expect(innerTrack).toBeTruthy();
    const scroller = innerTrack!.parentElement!;
    expect(scroller.className).toContain('overflow-auto');
  });
});

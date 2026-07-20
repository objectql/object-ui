/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Server-windowed pagination for related lists (objectui#2711).
 *
 * With `pageSize` set and no caller-provided `data`, RelatedList must fetch
 * ONE page (`$top`/`$skip`) instead of the whole child collection, surface
 * the server-reported `total` in the count badge / page indicator, turn a
 * user column sort into a server `$orderby`, and keep the historical
 * client-side slicing when the caller supplies `data` directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import * as React from 'react';
import { RelatedList } from '../RelatedList';

// Capture the schema RelatedList hands to SchemaRenderer (the data-table).
const h = vi.hoisted(() => ({ schema: null as any }));
vi.mock('@object-ui/react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    SchemaRenderer: (props: any) => {
      h.schema = props.schema;
      return null;
    },
  };
});

const rows = (start: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `c${start + i}`, name: `Row ${start + i}` }));

const columns = [{ accessorKey: 'name', header: 'Name' }];

/** DataSource stub serving a 12-record collection in $top/$skip windows. */
const makeWindowedDS = (totalRecords = 12) => ({
  find: vi.fn(async (_api: string, params: any) => {
    const skip = params?.$skip ?? 0;
    const top = params?.$top ?? totalRecords;
    return {
      data: rows(skip, Math.max(0, Math.min(top, totalRecords - skip))),
      total: totalRecords,
    };
  }),
});

const nextButton = () => screen.getByRole('button', { name: /next/i }) as HTMLButtonElement;
const prevButton = () => screen.getByRole('button', { name: /previous/i }) as HTMLButtonElement;

beforeEach(() => {
  h.schema = null;
});

describe('RelatedList — server-windowed pagination (#2711)', () => {
  it('fetches one $top/$skip window and shows the server total, not the page size', async () => {
    const ds = makeWindowedDS(12);
    render(
      <RelatedList
        title="Contacts"
        type="table"
        api="contact"
        objectName="contact"
        referenceField="account"
        parentId="ACC-1"
        pageSize={5}
        columns={columns}
        dataSource={ds as any}
      />,
    );

    await waitFor(() => {
      expect(ds.find).toHaveBeenCalledWith('contact', {
        $filter: { account: 'ACC-1' },
        $top: 5,
        $skip: 0,
      });
    });
    // Count badge reflects the whole collection while only one page loaded.
    await screen.findByLabelText('12 records');
    expect(h.schema.data).toHaveLength(5);
    screen.getByText('Page 1 of 3');
  });

  it('pages forward and back by refetching with a new $skip', async () => {
    const ds = makeWindowedDS(12);
    render(
      <RelatedList
        title="Contacts"
        type="table"
        api="contact"
        objectName="contact"
        referenceField="account"
        parentId="ACC-1"
        pageSize={5}
        columns={columns}
        dataSource={ds as any}
      />,
    );
    await screen.findByText('Page 1 of 3');
    expect(prevButton().disabled).toBe(true);

    fireEvent.click(nextButton());
    await waitFor(() => {
      expect(ds.find).toHaveBeenCalledWith('contact', {
        $filter: { account: 'ACC-1' },
        $top: 5,
        $skip: 5,
      });
    });
    await screen.findByText('Page 2 of 3');
    expect(prevButton().disabled).toBe(false);

    // Last page: 12 records / 5 per page → page 3 holds 2 rows, Next disabled.
    fireEvent.click(nextButton());
    await screen.findByText('Page 3 of 3');
    expect(h.schema.data).toHaveLength(2);
    expect(nextButton().disabled).toBe(true);

    fireEvent.click(prevButton());
    await screen.findByText('Page 2 of 3');
  });

  it('sends the declared defaultSort as the server $orderby', async () => {
    const ds = makeWindowedDS(12);
    render(
      <RelatedList
        title="Tasks"
        type="table"
        api="task"
        objectName="task"
        referenceField="project"
        parentId="P-1"
        pageSize={5}
        columns={columns}
        defaultSort={[{ field: 'due_date', order: 'desc' }]}
        dataSource={ds as any}
      />,
    );
    await waitFor(() => {
      expect(ds.find).toHaveBeenCalledWith('task', {
        $filter: { project: 'P-1' },
        $top: 5,
        $skip: 0,
        $orderby: [{ field: 'due_date', order: 'desc' }],
      });
    });
  });

  it("normalizes the spec string form ('-field') of defaultSort", async () => {
    const ds = makeWindowedDS(3);
    render(
      <RelatedList
        title="Tasks"
        type="table"
        api="task"
        objectName="task"
        referenceField="project"
        parentId="P-1"
        pageSize={5}
        columns={columns}
        defaultSort="-created_at"
        dataSource={ds as any}
      />,
    );
    await waitFor(() => {
      expect(ds.find).toHaveBeenCalledWith('task', {
        $filter: { project: 'P-1' },
        $top: 5,
        $skip: 0,
        $orderby: [{ field: 'created_at', order: 'desc' }],
      });
    });
  });

  it('turns a user column sort into a server $orderby from page one', async () => {
    const ds = makeWindowedDS(12);
    render(
      <RelatedList
        title="Contacts"
        type="table"
        api="contact"
        objectName="contact"
        referenceField="account"
        parentId="ACC-1"
        pageSize={5}
        columns={columns}
        sortable
        dataSource={ds as any}
      />,
    );
    await screen.findByText('Page 1 of 3');

    // Move off page one first, so the sort click also proves the page reset.
    fireEvent.click(nextButton());
    await screen.findByText('Page 2 of 3');

    fireEvent.click(screen.getByRole('button', { name: /name/i }));
    await waitFor(() => {
      expect(ds.find).toHaveBeenCalledWith('contact', {
        $filter: { account: 'ACC-1' },
        $top: 5,
        $skip: 0,
        $orderby: [{ field: 'name', order: 'asc' }],
      });
    });
    await screen.findByText('Page 1 of 3');
  });

  it('estimates hasMore from a full page when the backend reports no total', async () => {
    // Legacy/array-shaped backend: 7 records served as raw arrays.
    const all = rows(0, 7);
    const ds = {
      find: vi.fn(async (_api: string, params: any) =>
        all.slice(params.$skip ?? 0, (params.$skip ?? 0) + (params.$top ?? all.length)),
      ),
    };
    render(
      <RelatedList
        title="Contacts"
        type="table"
        api="contact"
        objectName="contact"
        referenceField="account"
        parentId="ACC-1"
        pageSize={5}
        columns={columns}
        dataSource={ds as any}
      />,
    );
    // Full first page → assume there may be more.
    await screen.findByText('Page 1 of 2');
    expect(nextButton().disabled).toBe(false);

    fireEvent.click(nextButton());
    // Second page is short (2 of 5) → no further pages.
    await screen.findByText('Page 2 of 2');
    expect(h.schema.data).toHaveLength(2);
    expect(nextButton().disabled).toBe(true);
  });

  it('keeps client-side slicing when the caller supplies data directly', async () => {
    render(
      <RelatedList
        title="Contacts"
        type="table"
        api="contact"
        objectName="contact"
        data={rows(0, 12)}
        pageSize={5}
        columns={columns}
      />,
    );
    // No dataSource: everything is in memory, sliced per page.
    screen.getByText('Page 1 of 3');
    expect(h.schema.data).toHaveLength(5);
    expect(h.schema.data[0].id).toBe('c0');

    fireEvent.click(nextButton());
    screen.getByText('Page 2 of 3');
    expect(h.schema.data[0].id).toBe('c5');
  });

  it('does not window the fetch when pagination is off (pageSize unset)', async () => {
    const ds = makeWindowedDS(3);
    render(
      <RelatedList
        title="Contacts"
        type="table"
        api="contact"
        objectName="contact"
        referenceField="account"
        parentId="ACC-1"
        columns={columns}
        dataSource={ds as any}
      />,
    );
    await waitFor(() => {
      expect(ds.find).toHaveBeenCalledWith('contact', { $filter: { account: 'ACC-1' } });
    });
  });
});

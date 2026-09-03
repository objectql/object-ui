/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7210, half 2 — maintainer ruling a′ (2026-09-02), on the tree.
 *
 * ⭐ This is the view the ceiling's VALUE was measured on, and the only one of
 * the four whose DOM grows with the result set: gantt virtualises, the
 * calendar month grid caps events per day cell, the map auto-clusters above
 * 100 markers — the tree flattens every expanded node into the document, at a
 * measured 5.2 elements per record. So the ruling's "the DOM row count equals
 * the ceiling" is literally checkable here, against real rendered `<tr>`s,
 * and this file checks it that way rather than through a stub.
 *
 * The truncation is also the most consequential here: a hierarchy assembled
 * from the first N rows is not a subtree of the real one — every node whose
 * parent fell past the cut is silently reparented to a root. Nothing in the
 * rendering says so, which is what the footnote is for.
 *
 * REVERSE VERIFICATION — direction predicted before running: removing
 * `$top: NON_GRID_ROW_CEILING_TOP` from `ObjectTree`'s record fetch turns the
 * truncation case red at BOTH the row count and the footnote (the whole store
 * arrives, nothing is capped, `truncated` is false), while the below-ceiling
 * case stays green.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NON_GRID_ROW_CEILING, NON_GRID_ROW_CEILING_TOP } from '@object-ui/react';
import { ObjectTree } from './ObjectTree';

vi.mock('@object-ui/plugin-detail', () => ({
  RecordDetailDrawer: () => null,
  deriveRecordPageHref: () => null,
}));

const TOTAL_ROWS = 5000;

/** A flat forest: every 10th record is a root, the rest hang off it. */
function makeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: String(i + 1),
    name: `Node ${i + 1}`,
    parent_id: i % 10 === 0 ? null : String(i - (i % 10) + 1),
  }));
}

function makeDataSource(storeSize: number, calls: Array<Record<string, any>>) {
  const store = makeRows(storeSize);
  return {
    find: vi.fn(async (_resource: string, params: any) => {
      calls.push({ ...(params ?? {}) });
      const top = typeof params?.$top === 'number' ? params.$top : store.length;
      return { data: store.slice(0, top), total: store.length };
    }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn(async () => ({
      name: 'node',
      fields: {
        id: { name: 'id', type: 'text' },
        name: { name: 'name', type: 'text' },
        parent_id: { name: 'parent_id', type: 'text' },
      },
    })),
  } as any;
}

const schema: any = {
  type: 'object-tree',
  objectName: 'node',
  tree: { parentField: 'parent_id', labelField: 'name' },
  data: { provider: 'object', object: 'node' },
};

describe('objectui#7210 ruling a′ — the tree draws at most the platform ceiling, loudly', () => {
  it('above the ceiling: the rendered row count EQUALS the ceiling, and both numbers are named', async () => {
    const calls: Array<Record<string, any>> = [];
    const dataSource = makeDataSource(TOTAL_ROWS, calls);

    const { container } = render(<ObjectTree schema={schema} dataSource={dataSource} />);

    await waitFor(() => expect(container.querySelector('[data-testid="object-tree"]')).not.toBeNull());
    await waitFor(() =>
      expect(container.querySelectorAll('tbody tr').length).toBe(NON_GRID_ROW_CEILING),
    );

    expect(calls.length).toBeGreaterThan(0);
    for (const params of calls) {
      expect(params.$top).toBe(NON_GRID_ROW_CEILING_TOP);
    }

    const note = screen.getByRole('note');
    expect(note.getAttribute('data-row-ceiling-note')).toBe('non-grid');
    expect(note.textContent).toContain(String(NON_GRID_ROW_CEILING));
    expect(note.textContent).toContain(String(TOTAL_ROWS));
  });

  it('below the ceiling: every row draws and there is NO footnote', async () => {
    const calls: Array<Record<string, any>> = [];
    const dataSource = makeDataSource(30, calls);

    const { container } = render(<ObjectTree schema={schema} dataSource={dataSource} />);

    await waitFor(() => expect(container.querySelectorAll('tbody tr').length).toBe(30));
    expect(screen.queryByRole('note')).toBeNull();
  });
});

/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:related_list` consumes `PageComponentSchema.dataSource`
 * (objectstack#6953).
 *
 * The spec declares the binding on every page component; this block read none of
 * it. Nothing mapped `dataSource.object` onto the `objectName` the renderer
 * requires, so a related list authored with the binding hit the
 * "missing objectName" placeholder instead of listing anything.
 *
 * ## The one key that is NOT mapped, and why it is a finding
 *
 * `filter` stays unmapped: this renderer DECLARES `filter` in its registry
 * `inputs` ("Additional filter criteria") and never reads it — `RelatedList`
 * builds its query from `{ [referenceField]: parentId }` alone and takes no
 * filter prop for the list's own scope. Mapping the composed filter onto
 * `schema.filter` would hand it to a key nothing consumes, which is the defect
 * objectstack#6953 removes rather than spreads.
 *
 * The consequence is pinned rather than left implicit (last test): while that
 * gap is open, a saved view named here contributes its columns / sort / limit and
 * its FILTER is dropped, so the list can be wider than the view it names. When
 * the flat `filter` gains a read site (objectstack#7118), `filter: true` belongs
 * in the mapping and that test is the one that must change.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import * as React from 'react';
import { RecordContextProvider } from '@object-ui/react';
import { RecordRelatedListRenderer } from '../renderers/record-related-list';

// Capture what the renderer passes down to RelatedList — the question actually
// asked of the list, not merely that a prop was threaded somewhere.
const h = vi.hoisted(() => ({ captured: null as any }));
vi.mock('../RelatedList', () => ({
  RelatedList: (props: any) => {
    h.captured = props;
    return <div data-testid="related-list" />;
  },
}));

const RECENT_VIEW = {
  name: 'recent',
  label: 'Recent contacts',
  columns: ['name', 'email'],
  filter: [['is_active', '=', true]],
  sort: [{ field: 'created', order: 'desc' }],
  pagination: { pageSize: 3 },
};

const makeDataSource = (listViews: Record<string, unknown> = { recent: RECENT_VIEW }) => ({
  find: vi.fn(async () => []),
  getObjectSchema: vi.fn(async (name: string) => ({ name, fields: {}, listViews })),
});

function renderRelated(schema: Record<string, any>, ds = makeDataSource()) {
  const utils = render(
    <RecordContextProvider objectName="account" recordId="ACC-1" dataSource={ds as any}>
      <RecordRelatedListRenderer schema={{ relationshipField: 'account_id', ...schema }} />
    </RecordContextProvider>,
  );
  return { ...utils, ds };
}

beforeEach(() => {
  h.captured = null;
});

describe('record:related_list — dataSource: { object, view } (objectstack#6953)', () => {
  it('maps `object` onto the related objectName it lists', async () => {
    renderRelated({ dataSource: { object: 'contact' } });
    // Before the wiring this rendered the "missing objectName" placeholder.
    await waitFor(() => expect(h.captured).toBeTruthy());
    expect(h.captured.objectName).toBe('contact');
    expect(h.captured.api).toBe('contact');
  });

  it('takes the saved view’s columns, sort and row cap', async () => {
    renderRelated({ dataSource: { object: 'contact', view: 'recent' } });
    await waitFor(() => expect(h.captured).toBeTruthy());
    expect(h.captured.columns).toEqual(['name', 'email']);
    expect(h.captured.defaultSort).toEqual([{ field: 'created', order: 'desc' }]);
    expect(h.captured.pageSize).toBe(3);
  });

  it('lets an authored key win over the same key from the view', async () => {
    renderRelated({
      columns: ['name'],
      limit: 20,
      dataSource: { object: 'contact', view: 'recent' },
    });
    await waitFor(() => expect(h.captured).toBeTruthy());
    expect(h.captured.columns).toEqual(['name']);
    expect(h.captured.pageSize).toBe(20);
  });

  it('reports an unresolvable `view` instead of listing every child row', async () => {
    const { container } = renderRelated({ dataSource: { object: 'contact', view: 'nope' } });
    await waitFor(() =>
      expect(container.querySelector('[data-testid="record-related-list-datasource-error"]')).not.toBeNull(),
    );
    expect(h.captured).toBeNull();
    expect(container.textContent).toContain('recent');
  });

  it('leaves a related list with NO dataSource exactly as it was', async () => {
    renderRelated({ objectName: 'contact', columns: ['name'], limit: 7 });
    await waitFor(() => expect(h.captured).toBeTruthy());
    expect(h.captured.objectName).toBe('contact');
    expect(h.captured.columns).toEqual(['name']);
    expect(h.captured.pageSize).toBe(7);
  });

  it('does NOT hand a composed filter to a key this block cannot read (open gap)', async () => {
    // Honest pin on the residual gap, not a claim that filtering works: the
    // renderer declares `filter` and never reads it, and `RelatedList` has no
    // prop for the list's own filter. Writing the view's filter onto
    // `schema.filter` would look like wiring and change nothing, so the mapping
    // does not — and this asserts that no filter reaches `RelatedList` under any
    // spelling. Filed as objectstack#7118; when a read site lands, this flips.
    renderRelated({ dataSource: { object: 'contact', view: 'recent', filter: [['x', '=', 1]] } });
    await waitFor(() => expect(h.captured).toBeTruthy());
    expect(h.captured.filter).toBeUndefined();
    expect(h.captured.baseFilter).toBeUndefined();
  });
});

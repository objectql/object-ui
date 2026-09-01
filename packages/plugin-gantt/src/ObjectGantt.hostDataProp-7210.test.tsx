/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7210 — the registered `object-gantt` renderer draws its OWN query,
 * not the host's rows.
 *
 * This is the measured basis for the paging-chrome correction one package over
 * (`plugin-list/src/ListView.tsx`, `surfaceDrawsFetchedRows`): a host that
 * fetches a page and hands it down as `data` — `ListView` does exactly that,
 * for every view type — does not thereby feed the chart. `ObjectGanttRenderer`
 * (`./index`) destructures `{ schema }` and renders
 * `< ObjectGantt schema={bound} dataSource={dataSource} / >`, forwarding no
 * other prop, so `ObjectGantt.reload`'s `rest.data` short-circuit is never
 * reached from the registry path and the component queries for itself. The
 * sibling wrappers (`object-grid`, `object-kanban`, `object-calendar`,
 * `object-map`, `object-tree`) all spread `{...props}`; this one is the outlier.
 *
 * Two facts are pinned, because the footer correction rests on both:
 *
 *   1. the rows drawn are the ADAPTER's, not the host `data` prop's;
 *   2. the query carries no `$top` — so its row count is not the host's page
 *      size and cannot be made to be by authoring `pagination.pageSize`.
 *
 * ⛔ Do not "fix" (1) by spreading `{...props}` in the renderer. That caps the
 * chart at the host's page — a complete schedule silently becomes a truncated
 * one that still looks like a schedule. Whether a non-grid view may fetch
 * unbounded at all is an open maintainer decision (objectui#7210, half 2) and
 * is not settled here; this file only records what the code does today, which
 * is what the footer has to stop contradicting either way.
 *
 * REVERSE VERIFICATION — direction and counts predicted before running: add
 * `{...props}` to the `ObjectGanttRenderer` children callback and BOTH
 * assertions in the first case flip (5 rows → 2, host rows drawn), while the
 * `$top` case stays green because the component never gets as far as querying.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchemaRendererProvider, SchemaRenderer } from '@object-ui/react';
import './index';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

vi.mock('./GanttView', () => ({
  GanttView: ({ tasks }: any) => (
    <div data-testid="gantt-view" data-task-count={String(tasks.length)}>
      {tasks.map((t: any) => (
        <div key={t.id} data-testid={`gv-task-${t.id}`}>{t.title}</div>
      ))}
    </div>
  ),
}));

vi.mock('@object-ui/plugin-detail', () => ({
  RecordDetailDrawer: () => null,
  deriveRecordPageHref: () => null,
}));

/** What the adapter answers with — the whole result set. */
const ADAPTER_ROWS = Array.from({ length: 5 }, (_, i) => ({
  id: String(i + 1),
  subject: `Adapter task ${i + 1}`,
  visible_from: '2026-01-01',
  due_date: '2026-01-10',
}));

/** What a paging host hands down as `data` — one page of it. */
const HOST_PAGE = ADAPTER_ROWS.slice(0, 2).map(r => ({ ...r, subject: `Host task ${r.id}` }));

const schema: any = {
  type: 'object-gantt',
  objectName: 'duly_task',
  gantt: {
    titleField: 'subject',
    startDateField: 'visible_from',
    endDateField: 'due_date',
  },
};

let calls: Array<Record<string, any>> = [];

function makeDataSource() {
  return {
    find: vi.fn(async (_resource: string, params: any) => {
      calls.push({ ...(params ?? {}) });
      return { data: ADAPTER_ROWS, total: ADAPTER_ROWS.length };
    }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn(async () => ({
      name: 'duly_task',
      fields: {
        id: { name: 'id', type: 'text' },
        subject: { name: 'subject', type: 'text' },
        visible_from: { name: 'visible_from', type: 'date' },
        due_date: { name: 'due_date', type: 'date' },
      },
    })),
  } as any;
}

describe('objectui#7210 — object-gantt ignores a host `data` prop', () => {
  beforeEach(() => {
    calls = [];
  });

  it('draws the adapter rows, not the page the host handed down', async () => {
    const dataSource = makeDataSource();

    render(
      <SchemaRendererProvider dataSource={dataSource}>
        <SchemaRenderer schema={schema} data={HOST_PAGE} />
      </SchemaRendererProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('gantt-view')).toBeTruthy());
    await waitFor(() =>
      expect(screen.getByTestId('gantt-view').getAttribute('data-task-count')).toBe('5'),
    );

    // The host's two rows are nowhere on screen; all five adapter rows are.
    expect(screen.queryByText('Host task 1')).toBeNull();
    expect(screen.getByText('Adapter task 5')).toBeTruthy();
    expect(calls.length).toBeGreaterThan(0);
  });

  it('issues its query with no `$top` — the host page size cannot bound it', async () => {
    const dataSource = makeDataSource();

    render(
      <SchemaRendererProvider dataSource={dataSource}>
        <SchemaRenderer schema={schema} data={HOST_PAGE} pagination={{ pageSize: 2 }} />
      </SchemaRendererProvider>,
    );

    await waitFor(() => expect(calls.length).toBeGreaterThan(0));

    for (const params of calls) {
      expect(params.$top).toBeUndefined();
      expect(params.$skip).toBeUndefined();
    }
  });
});

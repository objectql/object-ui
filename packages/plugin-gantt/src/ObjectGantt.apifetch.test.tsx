/**
 * provider:'api' must use the host-authenticated fetch (#2725).
 *
 * The composite endpoint behind an api-provider gantt is a platform endpoint
 * like any other — its requests must carry the host's session credentials
 * (Authorization / tenant headers), not ride on cookies alone. The host
 * publishes an authenticated fetch via SchemaRendererContext.apiFetch;
 * ObjectGantt must thread it into resolveDataSource so ApiDataSource uses it
 * instead of the bare global fetch.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SchemaRendererProvider } from '@object-ui/react';
import { ObjectGantt } from './ObjectGantt';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

vi.mock('./GanttView', () => ({
  GanttView: ({ tasks }: any) => (
    <div data-testid="gantt-view">
      {tasks.map((t: any) => (
        <div key={t.id} data-testid={`gv-view-${t.id}`}>{t.title}</div>
      ))}
    </div>
  ),
}));

vi.mock('@object-ui/plugin-detail', () => ({
  RecordDetailDrawer: () => null,
  deriveRecordPageHref: () => null,
}));

const ROWS = [
  { id: '1', name: 'Task A', start_date: '2024-01-01', end_date: '2024-01-05' },
];

function makeSchema(): any {
  return {
    type: 'gantt',
    objectName: 'tasks',
    gantt: {
      titleField: 'name',
      startDateField: 'start_date',
      endDateField: 'end_date',
    },
    data: { provider: 'api', read: { url: '/api/gantt/tree', method: 'GET' } },
  };
}

function makeApiFetch() {
  return vi.fn(async () =>
    new Response(JSON.stringify({ data: ROWS, total: ROWS.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe("ObjectGantt provider:'api' host auth fetch", () => {
  const bareFetch = vi.fn(async () => new Response('{}', { status: 401 }));

  beforeEach(() => {
    bareFetch.mockClear();
    vi.stubGlobal('fetch', bareFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads through SchemaRendererContext.apiFetch, not the bare global fetch', async () => {
    const apiFetch = makeApiFetch();

    render(
      <SchemaRendererProvider dataSource={null} apiFetch={apiFetch as any}>
        <ObjectGantt schema={makeSchema()} />
      </SchemaRendererProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('gv-view-1')).toBeDefined());
    expect(apiFetch).toHaveBeenCalled();
    const [calledUrl] = apiFetch.mock.calls[0] as unknown as [string];
    expect(String(calledUrl)).toContain('/api/gantt/tree');
    expect(bareFetch).not.toHaveBeenCalled();
  });

  it('falls back to the global fetch when no apiFetch is in context', async () => {
    bareFetch.mockImplementation(async () =>
      new Response(JSON.stringify({ data: ROWS, total: ROWS.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<ObjectGantt schema={makeSchema()} />);

    await waitFor(() => expect(screen.getByTestId('gv-view-1')).toBeDefined());
    expect(bareFetch).toHaveBeenCalled();
  });
});

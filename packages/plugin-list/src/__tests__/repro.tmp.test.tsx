import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import { render, waitFor } from '@testing-library/react';
import { ListView } from '../ListView';
import { SchemaRendererProvider } from '@object-ui/react';

const rows = [
  { id: '1', name: 'Spring Launch', start_date: '2026-09-01', end_date: '2026-09-30' },
  { id: '2', name: 'Summer Push', start_date: '2026-10-01', end_date: '2026-10-31' },
];

const objectDef = {
  name: 'crm_campaign',
  label: 'Campaign',
  fields: {
    id: { name: 'id', type: 'text' },
    name: { name: 'name', type: 'text', label: 'Name' },
    start_date: { name: 'start_date', type: 'date', label: 'Start Date' },
    end_date: { name: 'end_date', type: 'date', label: 'End Date' },
  },
};

const captured: any[] = [];
const findCalls: any[] = [];

ComponentRegistry.register('object-timeline', (props: any) => {
  captured.push(props);
  return <div data-testid="tl-spy" />;
}, { namespace: 'test', label: 'spy', category: 'view' });

const makeDs = () => ({
  find: vi.fn(async (_obj: string, q: any) => { findCalls.push(q); return rows; }),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getObjectSchema: vi.fn(async () => objectDef),
});

async function probe(label: string, schema: any) {
  captured.length = 0;
  findCalls.length = 0;
  const ds = makeDs() as any;
  render(
    <SchemaRendererProvider dataSource={ds}>
      <ListView schema={schema} dataSource={ds} />
    </SchemaRendererProvider>
  );
  await waitFor(() => expect(findCalls.length).toBeGreaterThan(0), { timeout: 4000 });
  await waitFor(() => {
    const last = captured[captured.length - 1];
    expect(last?.data?.length).toBeGreaterThan(0);
  }, { timeout: 4000 });
  const last = captured[captured.length - 1];
  // eslint-disable-next-line no-console
  console.log(`### ${label}
  schema.timeline        = ${JSON.stringify(last.schema?.timeline)}
  schema.startDateField  = ${last.schema?.startDateField}
  schema.endDateField    = ${last.schema?.endDateField}
  data[0]                = ${JSON.stringify(last.data?.[0])}
  find[0]                = ${JSON.stringify(findCalls[0])}`);
}

describe('repro #3129 — ListView timeline branch', () => {
  it('A: top-level timeline config (spec shape)', async () => {
    await probe('A top-level timeline', {
      type: 'list-view',
      objectName: 'crm_campaign',
      viewType: 'timeline',
      columns: ['name'],
      timeline: { startDateField: 'start_date', endDateField: 'end_date', titleField: 'name' },
    });
  });

  it('B: app-shell shape — options.timeline only', async () => {
    await probe('B options.timeline', {
      type: 'list-view',
      objectName: 'crm_campaign',
      viewType: 'timeline',
      columns: ['name'],
      options: {
        timeline: {
          startDateField: 'start_date',
          endDateField: 'end_date',
          titleField: 'name',
          descriptionField: undefined,
        },
      },
    });
  });
});

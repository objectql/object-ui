import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import { ListView } from '../ListView';
import { SchemaRendererProvider } from '@object-ui/react';
// Registers `object-timeline` in the ComponentRegistry (module scope on
// purpose — see AGENTS.md testing discipline).
import '@object-ui/plugin-timeline';

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

const findCalls: any[] = [];
const makeDs = () => ({
  find: vi.fn(async (_o: string, q: any) => { findCalls.push(q); return rows; }),
  findOne: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
  getObjectSchema: vi.fn(async () => objectDef),
});

async function mount(schema: any) {
  findCalls.length = 0;
  const ds = makeDs() as any;
  const r = render(
    <SchemaRendererProvider dataSource={ds}>
      <ListView schema={schema} dataSource={ds} />
    </SchemaRendererProvider>
  );
  await waitFor(() => expect(screen.getByText('Spring Launch')).toBeDefined(), { timeout: 5000 });
  return r;
}

describe('repro #3129 — ListView -> real ObjectTimeline composition', () => {
  it('A: spec shape (top-level view.timeline)', async () => {
    await mount({
      type: 'list-view', objectName: 'crm_campaign', viewType: 'timeline',
      columns: ['name'],
      timeline: { startDateField: 'start_date', endDateField: 'end_date', titleField: 'name' },
    });
    // eslint-disable-next-line no-console
    console.log('A find:', JSON.stringify(findCalls[0]));
    // eslint-disable-next-line no-console
    console.log('A buckets:', Array.from(document.querySelectorAll('header span')).map(e => e.textContent).join(' | '));
    expect(screen.queryByText(/No date/i)).toBeNull();
  });

  it('B: app-shell shape (view.options.timeline)', async () => {
    await mount({
      type: 'list-view', objectName: 'crm_campaign', viewType: 'timeline',
      columns: ['name'],
      options: { timeline: { startDateField: 'start_date', endDateField: 'end_date', titleField: 'name', descriptionField: undefined } },
    });
    // eslint-disable-next-line no-console
    console.log('B find:', JSON.stringify(findCalls[0]));
    // eslint-disable-next-line no-console
    console.log('B buckets:', Array.from(document.querySelectorAll('header span')).map(e => e.textContent).join(' | '));
    expect(screen.queryByText(/No date/i)).toBeNull();
  });
});

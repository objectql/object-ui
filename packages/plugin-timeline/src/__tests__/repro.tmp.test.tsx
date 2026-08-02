import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ObjectTimeline } from '../ObjectTimeline';

// REAL renderer — no mock of ./renderer here.
vi.mock('@object-ui/react', async (importOriginal) => {
  const actual = await (importOriginal() as Promise<Record<string, unknown>>);
  return {
    ...actual,
    useDataScope: () => undefined,
    useNavigationOverlay: () => ({
      isOverlay: false, handleClick: vi.fn(), selectedRecord: null,
      isOpen: false, close: vi.fn(), setIsOpen: vi.fn(), mode: 'overlay', view: undefined,
    }),
    useObjectLabel: () => ({
      fieldOptionLabel: (_o: string, _f: string, _v: string, fb: string) => fb,
      translateOptions: (_o: string, _f: string, o: unknown[]) => o,
      fieldLabel: (_o: string, _f: string, fb: string) => fb,
    }),
  };
});

const rows = [
  { id: '1', name: 'Spring Launch', start_date: '2026-09-01', end_date: '2026-09-30' },
  { id: '2', name: 'Summer Push', start_date: '2026-10-01', end_date: '2026-10-31' },
];

describe('repro #3129', () => {
  it('ListView-shaped timeline schema buckets by start_date', async () => {
    // Exactly what plugin-list ListView.tsx `case "timeline"` emits.
    const schema: any = {
      type: 'object-timeline',
      objectName: 'crm_campaign',
      timeline: { startDateField: 'start_date', endDateField: 'end_date', titleField: 'name' },
      startDateField: 'start_date',
      titleField: 'name',
      endDateField: 'end_date',
    };
    render(<ObjectTimeline schema={schema} data={rows} />);
    await waitFor(() => expect(screen.getByText('Spring Launch')).toBeDefined());
    // eslint-disable-next-line no-console
    console.log('=== A (nested timeline) ===\n' + document.body.innerHTML.slice(0, 2500));
    expect(screen.queryByText(/No date/i)).toBeNull();
  });

  it('app-shell ObjectView-shaped (options.timeline only) buckets by start_date', async () => {
    const schema: any = {
      type: 'object-timeline',
      objectName: 'crm_campaign',
      startDateField: 'start_date',
      titleField: 'name',
      endDateField: 'end_date',
    };
    render(<ObjectTimeline schema={schema} data={rows} />);
    await waitFor(() => expect(screen.getByText('Summer Push')).toBeDefined());
    // eslint-disable-next-line no-console
    console.log('=== B (flat only) ===\n' + document.body.innerHTML.slice(0, 2500));
    expect(screen.queryByText(/No date/i)).toBeNull();
  });
});

// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Capture the authenticated fetch so we can assert request bodies.
const mockFetch = vi.fn(async () => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: async () => ({ success: true, message: 'done' }),
}));
vi.mock('@object-ui/auth', () => ({ createAuthenticatedFetch: () => mockFetch }));

// Stub the param dialog: when open, expose a button that resolves with values —
// lets us drive the collect-params promise without the heavy field renderers.
vi.mock('../ActionParamDialog', () => ({
  ActionParamDialog: ({ state }: any) =>
    state.open ? (
      <button type="button" data-testid="submit-params" onClick={() => state.resolve?.({ reason: 'because' })}>
        submit-params
      </button>
    ) : null,
}));
// Stub the result dialog: surface its open state + data for assertions.
vi.mock('../ActionResultDialog', () => ({
  ActionResultDialog: ({ state }: any) =>
    state.open ? <div data-testid="result-dialog">{JSON.stringify(state.data)}</div> : null,
}));

import { MetadataTypeActions } from './MetadataTypeActions';

beforeEach(() => mockFetch.mockClear());

describe('MetadataTypeActions', () => {
  it('runs an api action without params directly (no dialog)', async () => {
    render(
      <MetadataTypeActions
        location="record_header"
        recordId="ds1"
        entry={{ actions: [{ name: 'test_connection', label: 'Test', type: 'api', target: '/api/v1/datasources/${ctx.recordId}/test', locations: ['record_header'] }] }}
      />,
    );
    fireEvent.click(screen.getByTitle('Test'));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/v1/datasources/ds1/test');
    expect(screen.queryByTestId('submit-params')).toBeNull();
  });

  it('collects array params via the dialog and sends them as the body', async () => {
    render(
      <MetadataTypeActions
        location="record_header"
        recordId="ds1"
        entry={{ actions: [{ name: 'sync', label: 'Sync', type: 'api', target: '/api/v1/datasources/${ctx.recordId}/sync', locations: ['record_header'], params: [{ name: 'reason', label: 'Reason', type: 'text' }] as unknown[] }] }}
      />,
    );
    fireEvent.click(screen.getByTitle('Sync'));
    // dialog opens (params present) — no fetch yet
    const submit = await screen.findByTestId('submit-params');
    expect(mockFetch).not.toHaveBeenCalled();
    fireEvent.click(submit);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ reason: 'because' });
  });

  it('shows the result dialog when the action declares resultDialog', async () => {
    render(
      <MetadataTypeActions
        location="record_header"
        recordId="ds1"
        entry={{ actions: [{ name: 'probe', label: 'Probe', type: 'api', target: '/api/v1/x', locations: ['record_header'], resultDialog: { fields: [{ path: 'message' }] } }] }}
      />,
    );
    fireEvent.click(screen.getByTitle('Probe'));
    await waitFor(() => expect(screen.getByTestId('result-dialog')).toBeTruthy());
    expect(screen.getByTestId('result-dialog').textContent).toContain('done');
  });
});

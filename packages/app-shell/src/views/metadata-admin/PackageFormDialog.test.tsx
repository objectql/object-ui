// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PackageFormDialog } from './PackageFormDialog';

// PackageFormDialog renders the manifest form from the spec (package-schema)
// via SchemaForm and talks to `/api/v1/packages`. apiJson uses the raw global
// fetch (fetch → res.text() → JSON.parse), so we stub fetch and mirror the
// runtime's { success, data } envelope.
let calls: Array<{ url: string; init: RequestInit }>;

function stubOk() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      const body = init.body ? JSON.parse(init.body as string) : {};
      const manifest = body.manifest ?? body;
      return {
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ success: true, data: { manifest, status: 'installed' } }),
      } as Response;
    }),
  );
}

beforeEach(() => {
  calls = [];
  stubOk();
});
afterEach(() => vi.unstubAllGlobals());

describe('PackageFormDialog — create mode', () => {
  it('POSTs { manifest } from the spec form and reports the new id', async () => {
    const onSaved = vi.fn();
    render(<PackageFormDialog mode="create" open onOpenChange={vi.fn()} onSaved={onSaved} />);

    // Fields come from the spec-derived FormView (package-schema); target them by label.
    fireEvent.change(await screen.findByLabelText(/package id/i), { target: { value: 'com.acme.new' } });
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'New App' } });
    // version prefills to 0.1.0; type prefills to 'app'.

    fireEvent.click(screen.getByTestId('package-form-submit'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/v1/packages');
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(calls[0].init.body as string).manifest).toMatchObject({
      id: 'com.acme.new',
      name: 'New App',
      version: '0.1.0',
      type: 'app',
    });
    expect(onSaved.mock.calls[0][0].id).toBe('com.acme.new');
  });

  it('maps a 409 duplicate id to a friendly "already exists" message and stays open', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 409,
        text: async () => JSON.stringify({ success: false, error: { message: "Package 'com.acme.new' already exists" } }),
      })),
    );
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(<PackageFormDialog mode="create" open onOpenChange={onOpenChange} onSaved={onSaved} />);

    fireEvent.change(await screen.findByLabelText(/package id/i), { target: { value: 'com.acme.new' } });
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Dup App' } });
    fireEvent.click(screen.getByTestId('package-form-submit'));

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

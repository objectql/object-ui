// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditPackageDialog, type InstalledPackage } from './PackagesPage';

// PackagesPage.apiJson uses the raw global fetch (fetch → res.text() → JSON.parse),
// so we stub global fetch and mirror the runtime's { success, data } envelope —
// exactly what `PATCH /api/v1/packages/:id` returns (framework http-dispatcher).
const PKG: InstalledPackage = {
  manifest: { id: 'com.acme.crm', name: 'Acme CRM', version: '1.0.0', description: 'old', type: 'app' },
  enabled: true,
  status: 'installed',
};

let calls: Array<{ url: string; init: RequestInit }>;

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      // Echo the patched manifest back, the way the dispatcher does.
      const body = init.body ? JSON.parse(init.body as string) : {};
      const updated: InstalledPackage = {
        ...PKG,
        manifest: { ...PKG.manifest, ...body },
      };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true, data: updated }),
      } as Response;
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('EditPackageDialog', () => {
  it('prefills from the manifest and PATCHes only the edited fields', async () => {
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(<EditPackageDialog pkg={PKG} open onOpenChange={onOpenChange} onSaved={onSaved} />);

    const nameInput = (await screen.findByTestId('package-edit-name-input')) as HTMLInputElement;
    expect(nameInput.value).toBe('Acme CRM'); // prefilled

    fireEvent.change(nameInput, { target: { value: 'Acme CRM v2' } });
    fireEvent.click(screen.getByTestId('package-edit-save'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));

    // Issued a PATCH to the package's REST id with the edited manifest fields.
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/v1/packages/com.acme.crm');
    expect(calls[0].init.method).toBe('PATCH');
    const sent = JSON.parse(calls[0].init.body as string);
    expect(sent).toMatchObject({ name: 'Acme CRM v2', version: '1.0.0' });

    // onSaved receives the server's updated package; the dialog closes.
    expect(onSaved.mock.calls[0][0].manifest.name).toBe('Acme CRM v2');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('blocks save on a non-semantic version and never calls the API', async () => {
    render(<EditPackageDialog pkg={PKG} open onOpenChange={vi.fn()} onSaved={vi.fn()} />);
    const versionInput = await screen.findByLabelText(/version/i);
    fireEvent.change(versionInput, { target: { value: '1.2' } });

    const save = screen.getByTestId('package-edit-save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(calls).toHaveLength(0);
  });

  it('surfaces a server error and keeps the dialog open', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ success: false, error: { message: 'version must be semantic (e.g. 1.0.0)' } }),
      })),
    );
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(<EditPackageDialog pkg={PKG} open onOpenChange={onOpenChange} onSaved={onSaved} />);

    fireEvent.click(screen.getByTestId('package-edit-save'));

    expect(await screen.findByText(/version must be semantic/i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

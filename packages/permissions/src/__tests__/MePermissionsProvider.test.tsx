/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Tests for MePermissionsProvider: ensures field-level permission
 * checks against the `/me/permissions` payload are correctly enforced
 * and that consumers receive sensible defaults during load / on error.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MePermissionsProvider } from '../MePermissionsProvider';
import { usePermissions } from '../usePermissions';

function Probe({ object, field }: { object: string; field: string }) {
  const { checkField, isLoaded } = usePermissions();
  return (
    <div>
      <span data-testid="loaded">{String(isLoaded)}</span>
      <span data-testid="read">{String(checkField(object, field, 'read'))}</span>
      <span data-testid="write">{String(checkField(object, field, 'write'))}</span>
    </div>
  );
}

describe('MePermissionsProvider', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch' as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enforces explicit field-level read/write denials', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        authenticated: true,
        userId: 'u1',
        tenantId: 't1',
        roles: ['member'],
        permissionSets: ['restricted'],
        objects: { '*': { allowRead: true, allowEdit: true } },
        fields: {
          'account.annual_revenue': { readable: false, editable: false },
          'account.name': { readable: true, editable: false },
        },
      }),
    });

    render(
      <MePermissionsProvider endpoint="/x">
        <Probe object="account" field="annual_revenue" />
      </MePermissionsProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    expect(screen.getByTestId('read').textContent).toBe('false');
    expect(screen.getByTestId('write').textContent).toBe('false');
  });

  it('returns object-level fallback when no field override exists', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        authenticated: true,
        userId: 'u1',
        tenantId: 't1',
        roles: ['viewer'],
        permissionSets: ['viewer_readonly'],
        objects: { '*': { allowRead: true, allowEdit: false } },
        fields: {},
      }),
    });

    render(
      <MePermissionsProvider endpoint="/x">
        <Probe object="account" field="name" />
      </MePermissionsProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    expect(screen.getByTestId('read').textContent).toBe('true');
    expect(screen.getByTestId('write').textContent).toBe('false');
  });

  it('renders loadingFallback while fetching and is fail-closed', async () => {
    (global.fetch as any).mockReturnValue(new Promise(() => { /* pending */ }));

    render(
      <MePermissionsProvider endpoint="/x" loadingFallback={<div data-testid="loading">…</div>}>
        <Probe object="account" field="name" />
      </MePermissionsProvider>,
    );

    expect(screen.getByTestId('loading')).toBeTruthy();
    expect(screen.queryByTestId('read')).toBeNull();
  });

  // [#2926 ④] Unknown-object default is authentication-gated.
  it('fails CLOSED for an authenticated user when the object has no configured perms', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        authenticated: true,
        userId: 'u1',
        tenantId: 't1',
        roles: ['member'],
        permissionSets: ['restricted'],
        objects: { account: { allowRead: true, allowEdit: true } }, // no '*', nothing for 'project'
        fields: {},
      }),
    });

    render(
      <MePermissionsProvider endpoint="/x">
        <Probe object="project" field="budget" />
      </MePermissionsProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    expect(screen.getByTestId('read').textContent).toBe('false');
    expect(screen.getByTestId('write').textContent).toBe('false');
  });

  it('keeps the permissive default for anonymous sessions (guest/public surfaces)', async () => {
    // The endpoint's no-session response: authenticated:false, NO objects/fields.
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authenticated: false }),
    });

    render(
      <MePermissionsProvider endpoint="/x">
        <Probe object="showcase_inquiry" field="message" />
      </MePermissionsProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    // Server still enforces; the anon UI must not brick public forms.
    expect(screen.getByTestId('read').textContent).toBe('true');
    expect(screen.getByTestId('write').textContent).toBe('true');
  });

  it('uses the injected fetcher (authenticated fetch) instead of global fetch', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        authenticated: true,
        userId: 'u1',
        tenantId: 't1',
        roles: [],
        permissionSets: [],
        objects: { '*': { allowRead: true, allowEdit: true } },
        fields: {},
      }),
    });

    render(
      <MePermissionsProvider endpoint="/perm-endpoint" fetcher={fetcher as any}>
        <Probe object="account" field="name" />
      </MePermissionsProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    expect(fetcher).toHaveBeenCalledWith('/perm-endpoint', expect.objectContaining({ credentials: 'include' }));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByTestId('write').textContent).toBe('true');
  });

  it('skips fetch when initialPermissions provided', () => {
    render(
      <MePermissionsProvider
        endpoint="/x"
        initialPermissions={{
          authenticated: true,
          userId: 'u',
          tenantId: 't',
          roles: [],
          permissionSets: [],
          objects: {},
          fields: { 'account.secret': { readable: false } },
        }}
      >
        <Probe object="account" field="secret" />
      </MePermissionsProvider>,
    );

    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByTestId('loaded').textContent).toBe('true');
    expect(screen.getByTestId('read').textContent).toBe('false');
  });
});

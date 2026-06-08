/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Focused coverage for the shared console action runtime (#1605) — the wiring
 * extracted from ObjectView so PageView can mount it too. We exercise the
 * authenticated handlers directly (regression coverage for ObjectView, which
 * delegates to them) and end-to-end through the provider + an `action:button`'s
 * `useAction()` consumer (PageView action execution).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import React from 'react';

const navigateSpy = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateSpy }));

const authFetchSpy = vi.fn();
vi.mock('@object-ui/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'User', image: null }, activeOrganization: null }),
  createAuthenticatedFetch: () => authFetchSpy,
}));

vi.mock('@object-ui/i18n', () => ({
  useObjectLabel: () => ({
    fieldLabel: (_o: any, _n: any, l: any) => l,
    fieldOptionLabel: (_o: any, _f: any, _v: any, l: any) => l,
    actionParamText: (_o: any, _a: any, _p: any, _attr: any, fallback: any) => fallback,
  }),
}));

// The dialogs/flow-runner are not exercised here — keep them as inert stubs so
// the hook module imports cheaply.
vi.mock('../../views/ActionConfirmDialog', () => ({ ActionConfirmDialog: () => null }));
vi.mock('../../views/ActionParamDialog', () => ({ ActionParamDialog: () => null }));
vi.mock('../../views/ActionResultDialog', () => ({ ActionResultDialog: () => null }));
vi.mock('../../views/FlowRunner', () => ({ FlowRunner: () => null }));

import { useConsoleActionRuntime, ConsoleActionRuntimeProvider } from '../useConsoleActionRuntime';
import { useAction } from '@object-ui/react';

beforeEach(() => {
  authFetchSpy.mockReset();
  navigateSpy.mockReset();
});

describe('useConsoleActionRuntime — authenticated handlers', () => {
  it('apiHandler calls an absolute endpoint via the authenticated fetch and refreshes', async () => {
    authFetchSpy.mockResolvedValue({ ok: true, json: async () => ({ id: 'env_1' }) });
    const onRefresh = vi.fn();
    const { result } = renderHook(() =>
      useConsoleActionRuntime({ dataSource: {}, objects: [], onRefresh }),
    );

    let res: any;
    await act(async () => {
      res = await result.current.apiHandler({
        type: 'api', name: 'createEnv', target: '/api/v1/environments', params: { name: 'prod' },
      } as any);
    });

    expect(authFetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = authFetchSpy.mock.calls[0];
    expect(String(url)).toContain('/api/v1/environments');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({ name: 'prod' });
    expect(res).toMatchObject({ success: true, data: { id: 'env_1' } });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('apiHandler surfaces a failed response and does not refresh', async () => {
    authFetchSpy.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) });
    const onRefresh = vi.fn();
    const { result } = renderHook(() =>
      useConsoleActionRuntime({ dataSource: {}, objects: [], onRefresh }),
    );

    let res: any;
    await act(async () => {
      res = await result.current.apiHandler({ type: 'api', name: 'x', target: '/api/v1/x' } as any);
    });

    expect(res).toEqual({ success: false, error: 'Forbidden' });
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('serverActionHandler targets /actions/global/<name> when no object is bound (page scope)', async () => {
    authFetchSpy.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: {} }) });
    const { result } = renderHook(() =>
      useConsoleActionRuntime({ dataSource: {}, objects: [] /* no objectName */ }),
    );

    let res: any;
    await act(async () => {
      res = await result.current.serverActionHandler({ type: 'script', name: 'provision' } as any);
    });

    expect(String(authFetchSpy.mock.calls[0][0])).toContain('/api/v1/actions/global/provision');
    expect(res).toMatchObject({ success: true });
  });

  it('exposes ActionProvider props with the api/flow/script/modal handlers wired', () => {
    const { result } = renderHook(() =>
      useConsoleActionRuntime({ dataSource: {}, objects: [], objectName: 'inv' }),
    );
    const props = result.current.actionProviderProps;
    expect(props.context.objectName).toBe('inv');
    expect(Object.keys(props.handlers).sort()).toEqual(['api', 'flow', 'modal', 'script']);
    expect(typeof props.onConfirm).toBe('function');
    expect(typeof props.onParamCollection).toBe('function');
  });
});

describe('ConsoleActionRuntimeProvider — page-level action execution', () => {
  function Probe() {
    const { execute } = useAction();
    return (
      <button onClick={() => execute({ type: 'api', name: 'createEnv', target: '/api/v1/environments' } as any)}>
        run
      </button>
    );
  }

  it('an action:button consumer executes an api action through the runtime and triggers refresh', async () => {
    authFetchSpy.mockResolvedValue({ ok: true, json: async () => ({}) });
    const onRefresh = vi.fn();

    render(
      <ConsoleActionRuntimeProvider dataSource={{}} objects={[]} onRefresh={onRefresh}>
        <Probe />
      </ConsoleActionRuntimeProvider>,
    );

    fireEvent.click(screen.getByText('run'));

    await waitFor(() => expect(authFetchSpy).toHaveBeenCalled());
    expect(String(authFetchSpy.mock.calls[0][0])).toContain('/api/v1/environments');
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });
});

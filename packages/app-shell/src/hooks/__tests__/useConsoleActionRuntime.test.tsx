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
    actionParamOptionLabel: (_o: any, _a: any, _p: any, _v: any, fallback: any) => fallback,
    actionDescription: (_o: any, _a: any, fallback: any) => fallback,
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

  it('apiHandler merges bodyExtra into the dataSource update payload (pure-confirmation action)', async () => {
    // A pure-confirmation action carries no params array; its mutation lives in
    // `bodyExtra`. Without merging it, `fields` is empty and the update below is
    // skipped — the confirmation "succeeds" but nothing is persisted.
    const updateSpy = vi.fn().mockResolvedValue(undefined);
    const onRefresh = vi.fn();
    const { result } = renderHook(() =>
      useConsoleActionRuntime({
        dataSource: { update: updateSpy } as any,
        objects: [],
        objectName: 'work_order',
        onRefresh,
      }),
    );

    await act(async () => {
      await result.current.apiHandler({
        type: 'api', name: 'close', // non-absolute target → dataSource branch
        params: { recordId: 'wo_1' },
        bodyExtra: { status: 'closed', closed_at: '2026-06-18' },
      } as any);
    });

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith('work_order', 'wo_1', { status: 'closed', closed_at: '2026-06-18' });
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

describe('flowHandler — list_toolbar selection fallback', () => {
  // Toolbar-invoked flow actions carry no `_rowRecord` (that's a list_item /
  // row-menu concept). The grid publishes its checkbox selection into the
  // shared ActionRunner context as `selectedRecords`; with exactly one row
  // selected the flow must receive that row's id as recordId, otherwise a
  // record-bound flow node fails ("Update requires an ID or options.multi=true").
  it('uses the single selected row from the runner context as recordId', async () => {
    authFetchSpy.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: {} }) });
    const { result } = renderHook(() =>
      useConsoleActionRuntime({ dataSource: {}, objects: [], objectName: 'inv' }),
    );

    let res: any;
    await act(async () => {
      res = await result.current.flowHandler(
        { type: 'flow', name: 'showcase_bulk_reassign', target: 'showcase_reassign_wizard' } as any,
        { selectedRecords: [{ id: 'rec_42', name: 'Acme' }] } as any,
      );
    });

    expect(res).toMatchObject({ success: true });
    const [url, init] = authFetchSpy.mock.calls[0];
    expect(String(url)).toContain('/api/v1/automation/showcase_reassign_wizard/trigger');
    const body = JSON.parse(init.body);
    expect(body.recordId).toBe('rec_42');
    expect(body.params.recordId).toBe('rec_42');
  });

  it('blocks with an error (no trigger call) when multiple rows are selected', async () => {
    const { result } = renderHook(() =>
      useConsoleActionRuntime({ dataSource: {}, objects: [] }),
    );

    let res: any;
    await act(async () => {
      res = await result.current.flowHandler(
        { type: 'flow', target: 'showcase_reassign_wizard' } as any,
        { selectedRecords: [{ id: 'a' }, { id: 'b' }] } as any,
      );
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/single record/i);
    expect(authFetchSpy).not.toHaveBeenCalled();
  });

  it('an explicit _rowRecord (list_item invocation) still wins over the selection', async () => {
    authFetchSpy.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: {} }) });
    const { result } = renderHook(() =>
      useConsoleActionRuntime({ dataSource: {}, objects: [] }),
    );

    await act(async () => {
      await result.current.flowHandler(
        { type: 'flow', target: 'f', params: { _rowRecord: { id: 'row_1' } } } as any,
        { selectedRecords: [{ id: 'other_1' }, { id: 'other_2' }] } as any,
      );
    });

    expect(JSON.parse(authFetchSpy.mock.calls[0][1].body).recordId).toBe('row_1');
  });

  it('end-to-end: selection published via updateContext reaches the flow trigger', async () => {
    authFetchSpy.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: {} }) });

    // Mirrors the real wiring: ObjectGrid calls `updateContext({ selectedRecords })`
    // on the shared runner; the toolbar button then executes the flow action.
    function Probe() {
      const { execute, updateContext } = useAction();
      return (
        <button
          onClick={() => {
            updateContext({ selectedRecords: [{ id: 'sel_1' }] });
            void execute({ type: 'flow', name: 'showcase_bulk_reassign', target: 'showcase_reassign_wizard' } as any);
          }}
        >
          run-flow
        </button>
      );
    }

    render(
      <ConsoleActionRuntimeProvider dataSource={{}} objects={[]}>
        <Probe />
      </ConsoleActionRuntimeProvider>,
    );

    fireEvent.click(screen.getByText('run-flow'));

    await waitFor(() => expect(authFetchSpy).toHaveBeenCalled());
    const [url, init] = authFetchSpy.mock.calls[0];
    expect(String(url)).toContain('/api/v1/automation/showcase_reassign_wizard/trigger');
    expect(JSON.parse(init.body).recordId).toBe('sel_1');
  });
});

describe('serverActionHandler — list_toolbar selection fallback', () => {
  it('uses the single selected row from the runner context as recordId', async () => {
    authFetchSpy.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: {} }) });
    const { result } = renderHook(() =>
      useConsoleActionRuntime({ dataSource: {}, objects: [], objectName: 'inv' }),
    );

    let res: any;
    await act(async () => {
      res = await result.current.serverActionHandler(
        { type: 'script', name: 'archive' } as any,
        { selectedRecords: [{ id: 'rec_7' }] } as any,
      );
    });

    expect(res).toMatchObject({ success: true });
    const [url, init] = authFetchSpy.mock.calls[0];
    expect(String(url)).toContain('/api/v1/actions/inv/archive');
    expect(JSON.parse(init.body).recordId).toBe('rec_7');
  });

  it('honors a custom recordIdField when resolving from the selection', async () => {
    authFetchSpy.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: {} }) });
    const { result } = renderHook(() =>
      useConsoleActionRuntime({ dataSource: {}, objects: [], objectName: 'inv' }),
    );

    await act(async () => {
      await result.current.serverActionHandler(
        { type: 'script', name: 'archive', recordIdField: 'code' } as any,
        { selectedRecords: [{ id: 'rec_7', code: 'INV-001' }] } as any,
      );
    });

    expect(JSON.parse(authFetchSpy.mock.calls[0][1].body).recordId).toBe('INV-001');
  });

  it('blocks with an error (no API call) when multiple rows are selected', async () => {
    const { result } = renderHook(() =>
      useConsoleActionRuntime({ dataSource: {}, objects: [], objectName: 'inv' }),
    );

    let res: any;
    await act(async () => {
      res = await result.current.serverActionHandler(
        { type: 'script', name: 'archive' } as any,
        { selectedRecords: [{ id: 'a' }, { id: 'b' }] } as any,
      );
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/single record/i);
    expect(authFetchSpy).not.toHaveBeenCalled();
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

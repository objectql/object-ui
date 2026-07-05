/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Regression coverage for the delete handler's error feedback (double-toast fix).
 *
 * useObjectActions runs its handlers on an ActionRunner seeded with `onToast`
 * (ObjectView passes its console toastHandler). The delete handler surfaces
 * failures with its own contextual `toast.error` (label + description, or the
 * bulk succeeded/failed summary). It must therefore return WITHOUT an `error`
 * key — otherwise ActionRunner.handlePostExecution toasts the error a SECOND
 * time and the user sees the same delete failure twice.
 *
 * These tests wire `onToast` to the same sonner sink the handler uses (exactly
 * as ObjectView's real toastHandler does) and assert the user sees ONE toast.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const navigateSpy = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateSpy,
  useParams: () => ({ appName: 'crm' }),
}));

vi.mock('@object-ui/i18n', () => ({
  useObjectTranslation: () => ({
    // Echo the interpolated defaultValue so assertions read naturally; fall
    // back to the key when a test doesn't provide one.
    t: (key: string, opts?: Record<string, any>) => (opts?.defaultValue ?? key),
  }),
}));

// Spy on the toast sink. Both the handler's direct call AND the runner's
// onToast bridge funnel here in the real app, so the call count is exactly
// what the user sees.
vi.mock('sonner', () => {
  const fn: any = vi.fn();
  fn.error = vi.fn();
  fn.success = vi.fn();
  return { toast: fn };
});

import { toast } from 'sonner';
import { useObjectActions } from '../useObjectActions';

// Mirror ObjectView's real toastHandler: route the runner's post-execution
// toast into the same sonner sink the handler uses directly.
const onToast = (message: string, options?: { type?: string }) => {
  if (options?.type === 'error') (toast as any).error(message);
  else (toast as any).success(message);
};

const onConfirm = async () => true;

beforeEach(() => {
  navigateSpy.mockReset();
  (toast as any).mockClear?.();
  (toast as any).error.mockClear();
  (toast as any).success.mockClear();
});

function setup(dataSource: any) {
  return renderHook(() =>
    useObjectActions({
      objectName: 'mtc_lead',
      objectLabel: '线索',
      dataSource,
      onConfirm,
      onToast,
    }),
  );
}

describe('useObjectActions — delete handler toast de-duplication', () => {
  it('a failed single delete surfaces EXACTLY ONE error toast (not two)', async () => {
    const dataSource = {
      delete: vi.fn().mockRejectedValue(
        new Error('RECORD_LOCKED: record is locked while an approval is in progress'),
      ),
    };
    const { result } = setup(dataSource);

    let res: any;
    await act(async () => {
      res = await result.current.deleteRecord('lead-1');
    });

    // The handler owns the (richer) failure toast; the runner must stay quiet.
    expect((toast as any).error).toHaveBeenCalledTimes(1);
    // And it's the contextual "deleteFailed" toast (with the error as its
    // description), not the runner's bare error string — i18n is stubbed here,
    // so the key stands in for the interpolated label.
    expect((toast as any).error).toHaveBeenCalledWith(
      'objectActions.deleteFailed',
      expect.objectContaining({ description: expect.stringContaining('RECORD_LOCKED') }),
    );
    // Returning without `error` is exactly what suppresses the runner's toast.
    expect(res).toEqual({ success: false });
  });

  it('a successful delete surfaces one success toast and no error toast', async () => {
    const dataSource = { delete: vi.fn().mockResolvedValue(undefined) };
    const { result } = setup(dataSource);

    await act(async () => {
      await result.current.deleteRecord('lead-1');
    });

    expect((toast as any).success).toHaveBeenCalledTimes(1);
    expect((toast as any).error).not.toHaveBeenCalled();
  });

  it('a partial bulk delete surfaces EXACTLY ONE error toast carrying the summary', async () => {
    // One id succeeds, one rejects → "1 deleted, 1 failed" summary toast only.
    const dataSource = {
      delete: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('boom')),
    };
    const { result } = setup(dataSource);

    let res: any;
    await act(async () => {
      res = await result.current.execute({
        type: 'delete',
        params: { records: [{ id: 'a' }, { id: 'b' }] },
      } as any);
    });

    expect((toast as any).error).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ success: false });
  });
});

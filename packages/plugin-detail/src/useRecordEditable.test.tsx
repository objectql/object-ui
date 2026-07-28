/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectstack#3821 — the record-level write gate behind the detail header's
 * Edit / Delete CTAs.
 *
 * A record shared READ-ONLY lives inside an object the user may otherwise edit,
 * so object-level permissions said "yes" and the header offered Edit; the user
 * only found out at save time, via a 403. The gate asks the explain engine for
 * the row-level verdict instead.
 *
 * Every uncertainty must fail OPEN — a courtesy hint may never be the reason a
 * permitted user cannot act. The server is the authority (ADR-0057 D10).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRecordEditable, __clearRecordEditableCache } from './useRecordEditable';

function mockExplain(body: unknown, ok = true) {
  return vi.fn(async () => ({ ok, json: async () => body })) as any;
}

describe('useRecordEditable', () => {
  beforeEach(() => {
    __clearRecordEditableCache();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('disables the action when the record-level verdict says no', async () => {
    vi.stubGlobal('fetch', mockExplain({ allowed: true, record: { recordId: 'r1', visible: false } }));
    const { result } = renderHook(() => useRecordEditable('note', 'r1'));
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('keeps the action when the record-level verdict says yes', async () => {
    vi.stubGlobal('fetch', mockExplain({ allowed: true, record: { recordId: 'r1', visible: true } }));
    const { result } = renderHook(() => useRecordEditable('note', 'r1'));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('asks about the requested operation and record', async () => {
    const fetchMock = mockExplain({ record: { recordId: 'r1', visible: true } });
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => useRecordEditable('note', 'r1', 'delete'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ object: 'note', operation: 'delete', recordId: 'r1' });
  });

  it('fails open on a non-OK response (401 / 403 / 501 deployments)', async () => {
    vi.stubGlobal('fetch', mockExplain({}, false));
    const { result } = renderHook(() => useRecordEditable('note', 'r1'));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('fails open when the network throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }) as any);
    const { result } = renderHook(() => useRecordEditable('note', 'r1'));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('fails open when the report carries no record verdict', async () => {
    vi.stubGlobal('fetch', mockExplain({ allowed: false }));
    const { result } = renderHook(() => useRecordEditable('note', 'r1'));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('does not call explain when disabled — the object-level gate already decided', async () => {
    const fetchMock = mockExplain({ record: { recordId: 'r1', visible: false } });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useRecordEditable('note', 'r1', 'update', false));
    expect(result.current).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call explain without an object or a record id', async () => {
    const fetchMock = mockExplain({});
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => useRecordEditable(undefined, 'r1'));
    renderHook(() => useRecordEditable('note', undefined));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('memoises the verdict so revisiting a record costs nothing', async () => {
    const fetchMock = mockExplain({ record: { recordId: 'r1', visible: false } });
    vi.stubGlobal('fetch', fetchMock);

    const first = renderHook(() => useRecordEditable('note', 'r1'));
    await waitFor(() => expect(first.result.current).toBe(false));

    const second = renderHook(() => useRecordEditable('note', 'r1'));
    expect(second.result.current).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

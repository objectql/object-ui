/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Regression (framework#3530 — "Console: modal-typed actions resolve `target` as
 * an object"): a `type: 'modal'` action's `target` names the PAGE to open, but
 * the console read it as an OBJECT name and opened a create form for it. That
 * issued `GET /meta/object/<page>`, which 400s, so the modal body was replaced
 * with ModalForm's "Error loading form — Bad Request" and the action never
 * completed.
 *
 * These pin the resolution CONTRACT: page first (what the spec says the name
 * means), object second (back-compat), `null` last so the console runtimes can
 * fall through to the action's server-side handler. The pure normalization
 * step is covered separately in `useActionModal.test.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { MetadataCtx } from '@object-ui/react';
import { useActionModal } from '../useActionModal';

const LOG_CALL_PAGE = { name: 'log_call', type: 'utility', label: 'Log a Call' };
const CONTACT_OBJECT = { name: 'contact', label: 'Contact', fields: {} };

/**
 * Stand-in metadata context. `getItem(type, name)` is the ONLY lookup the
 * resolver may use — reading the whole `pages` list would eagerly load a lazy
 * metadata type at the console root, which is what `getItem` exists to avoid.
 */
function makeWrapper(items: Record<string, any[]>) {
  const getItem = vi.fn(async (type: string, name: string) =>
    (items[type] ?? []).find((i) => i.name === name) ?? null);
  const value: any = {
    apps: [], objects: items.object ?? [], dashboards: [], reports: [], pages: [],
    loading: false, error: null,
    refresh: async () => {}, invalidate: () => {}, ensureType: async () => [],
    getItem,
    getItemsByType: () => [],
    getTypeStatus: () => 'ready',
  };
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MetadataCtx.Provider value={value}>{children}</MetadataCtx.Provider>
  );
  return { wrapper, getItem };
}

beforeEach(() => vi.clearAllMocks());

describe('useActionModal — modal target resolution (framework#3530)', () => {
  it('resolves a string target to the PAGE of that name, never GET /meta/object', async () => {
    const { wrapper, getItem } = makeWrapper({ page: [LOG_CALL_PAGE] });
    const { result } = renderHook(() => useActionModal(), { wrapper });

    let d: any;
    await act(async () => { d = await result.current.resolveModalTarget('log_call'); });

    // Rendered as page CONTENT (same shape PageView feeds SchemaRenderer),
    // not as an object form.
    expect(d.content).toMatchObject({ name: 'log_call', type: 'utility' });
    expect(d.objectName).toBeUndefined();
    expect(d.title).toBe('Log a Call');

    // The object lookup that produced the 400 must never happen.
    expect(getItem).toHaveBeenCalledWith('page', 'log_call');
    expect(getItem).not.toHaveBeenCalledWith('object', 'log_call');
  });

  it('falls back to an object create form when no page owns the name', async () => {
    const { wrapper } = makeWrapper({ page: [], object: [CONTACT_OBJECT] });
    const { result } = renderHook(() => useActionModal(), { wrapper });

    let d: any;
    await act(async () => { d = await result.current.resolveModalTarget('contact'); });

    expect(d).toMatchObject({ objectName: 'contact', mode: 'create' });
    expect(d.content).toBeUndefined();
  });

  it('prefers a page over the object a create_ prefix would parse into', async () => {
    const { wrapper } = makeWrapper({
      page: [{ name: 'create_opportunity', type: 'utility', label: 'New Opportunity' }],
      object: [{ name: 'opportunity' }],
    });
    const { result } = renderHook(() => useActionModal(), { wrapper });

    let d: any;
    await act(async () => { d = await result.current.resolveModalTarget('create_opportunity'); });

    expect(d.content).toMatchObject({ name: 'create_opportunity' });
    expect(d.objectName).toBeUndefined();
  });

  it('still honors the create_ prefix when no page owns the name', async () => {
    const { wrapper } = makeWrapper({ page: [], object: [{ name: 'opportunity' }] });
    const { result } = renderHook(() => useActionModal(), { wrapper });

    let d: any;
    await act(async () => { d = await result.current.resolveModalTarget('create_opportunity'); });

    expect(d).toMatchObject({ objectName: 'opportunity', mode: 'create' });
  });

  it('returns null when the target names neither a page nor an object', async () => {
    // Not an error on its own — the console runtimes read null as "not a
    // client-rendered modal" and run the action server-side instead.
    const { wrapper } = makeWrapper({ page: [], object: [] });
    const { result } = renderHook(() => useActionModal(), { wrapper });

    let d: any;
    await act(async () => { d = await result.current.resolveModalTarget('schedule_followup'); });
    expect(d).toBeNull();
  });

  it('passes an explicit { objectName, mode } descriptor through without lookups', async () => {
    // The lookup field's inline "create the referenced record" path.
    const { wrapper, getItem } = makeWrapper({ page: [], object: [] });
    const { result } = renderHook(() => useActionModal(), { wrapper });

    let d: any;
    await act(async () => {
      d = await result.current.resolveModalTarget({ objectName: 'customers', mode: 'create' });
    });

    expect(d).toMatchObject({ objectName: 'customers', mode: 'create' });
    expect(getItem).not.toHaveBeenCalled();
  });

  it('modalHandler reports an unresolvable target instead of opening a broken form', async () => {
    const { wrapper } = makeWrapper({ page: [], object: [] });
    const { result } = renderHook(() => useActionModal(), { wrapper });

    let r: any;
    await act(async () => { r = await result.current.modalHandler('schedule_followup'); });

    expect(r.success).toBe(false);
    expect(r.error).toContain('schedule_followup');
  });
});

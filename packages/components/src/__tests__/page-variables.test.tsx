/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * End-to-end proof for page-local state (PageSchema.variables):
 *   1. usePageVariableBinding resolves a variable from a component id (source).
 *   2. SchemaRenderer injects `page.<var>` into the expression context so a
 *      component's `visible` / `visibility` predicate gates on page state, and
 *      re-evaluates LIVE when a variable changes.
 *   3. element:record_picker reads its bound variable and queries its object.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, renderHook, act, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import {
  SchemaRenderer,
  PageVariablesProvider,
  usePageVariables,
  usePageVariableBinding,
  AdapterCtx,
} from '@object-ui/react';

beforeAll(async () => {
  await import('../renderers');
}, 30000);

// ---------------------------------------------------------------------------
// usePageVariableBinding — resolve writer binding from a component id
// ---------------------------------------------------------------------------

describe('usePageVariableBinding', () => {
  const wrap =
    (defs: any[]) =>
    ({ children }: { children: React.ReactNode }) =>
      <PageVariablesProvider definitions={defs}>{children}</PageVariablesProvider>;

  it('resolves the variable whose `source` matches the component id', () => {
    const { result } = renderHook(() => usePageVariableBinding('picker1'), {
      wrapper: wrap([{ name: 'selectedId', type: 'string', source: 'picker1' }]),
    });
    expect(result.current?.name).toBe('selectedId');
    expect(result.current?.value).toBe(''); // string default
  });

  it('writes through setValue', () => {
    const { result } = renderHook(() => usePageVariableBinding('picker1'), {
      wrapper: wrap([{ name: 'selectedId', type: 'string', source: 'picker1' }]),
    });
    act(() => result.current!.setValue('rec_42'));
    expect(result.current?.value).toBe('rec_42');
  });

  it('returns null when no variable targets the component', () => {
    const { result } = renderHook(() => usePageVariableBinding('other'), {
      wrapper: wrap([{ name: 'selectedId', type: 'string', source: 'picker1' }]),
    });
    expect(result.current).toBeNull();
  });

  it('returns null outside a PageVariablesProvider', () => {
    const { result } = renderHook(() => usePageVariableBinding('picker1'));
    expect(result.current).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SchemaRenderer — page variables drive component visibility, live
// ---------------------------------------------------------------------------

describe('SchemaRenderer page-variable visibility', () => {
  // A minimal writer that flips a page variable on click — stands in for an
  // interactive element (record picker / filter) without driving Radix in the
  // test renderer. Not registered: rendered directly as a sibling.
  function Writer({ name, value }: { name: string; value: any }) {
    const { setVariable } = usePageVariables();
    return (
      <button type="button" onClick={() => setVariable(name, value)}>
        write
      </button>
    );
  }

  function renderGated(predicateKey: 'visible' | 'visibility') {
    return render(
      <PageVariablesProvider definitions={[{ name: 'sel', type: 'string', source: 'w' }]}>
        <Writer name="sel" value="rec_1" />
        <SchemaRenderer
          schema={{
            type: 'element:text',
            id: 'gated',
            properties: { content: 'NOW VISIBLE' },
            [predicateKey]: "page.sel != ''",
          }}
        />
      </PageVariablesProvider>,
    );
  }

  it('hides a node whose `visible` references an unset page variable, then reveals it live', () => {
    const { queryByText, getByText } = renderGated('visible');
    expect(queryByText('NOW VISIBLE')).toBeNull();
    act(() => {
      fireEvent.click(getByText('write'));
    });
    expect(getByText('NOW VISIBLE')).toBeTruthy();
  });

  it('also gates on the spec-canonical `visibility` predicate', () => {
    const { queryByText, getByText } = renderGated('visibility');
    expect(queryByText('NOW VISIBLE')).toBeNull();
    act(() => {
      fireEvent.click(getByText('write'));
    });
    expect(getByText('NOW VISIBLE')).toBeTruthy();
  });

  it('gates on a `visibility` Expression envelope { dialect, source } (the spec-bridge form)', () => {
    // definePage normalizes a bare predicate string into { dialect: 'cel',
    // source } and the spec→node bridge carries that envelope onto the node —
    // this is the exact shape the showcase page produces at runtime.
    const { queryByText, getByText } = render(
      <PageVariablesProvider definitions={[{ name: 'sel', type: 'record_id', source: 'w' }]}>
        <Writer name="sel" value="rec_1" />
        <SchemaRenderer
          schema={{
            type: 'element:text',
            id: 'gated',
            properties: { content: 'NOW VISIBLE' },
            visibility: { dialect: 'cel', source: "page.sel != ''" },
          }}
        />
      </PageVariablesProvider>,
    );
    expect(queryByText('NOW VISIBLE')).toBeNull();
    act(() => {
      fireEvent.click(getByText('write'));
    });
    expect(getByText('NOW VISIBLE')).toBeTruthy();
  });

  it('does not leak the `visibility` predicate string onto the DOM node', () => {
    const { container } = render(
      <PageVariablesProvider definitions={[{ name: 'sel', type: 'string' }]}>
        <SchemaRenderer
          schema={{
            type: 'element:text',
            id: 'always',
            properties: { content: 'shown' },
            visibility: "page.sel == ''", // truthy initially → visible
          }}
        />
      </PageVariablesProvider>,
    );
    expect(container.querySelector('[visibility]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// element:record_picker — fetches its object and binds to a page variable
// ---------------------------------------------------------------------------

describe('element:record_picker', () => {
  it('is registered', () => {
    expect(ComponentRegistry.get('element:record_picker')).toBeTruthy();
  });

  it('queries the bound object via the adapter on mount', async () => {
    const find = vi.fn().mockResolvedValue({
      data: [
        { id: 'p1', name: 'Apollo' },
        { id: 'p2', name: 'Zephyr' },
      ],
    });
    const adapter = { find } as any;

    render(
      <AdapterCtx.Provider value={adapter}>
        <PageVariablesProvider
          definitions={[{ name: 'sel', type: 'record_id', source: 'picker' }]}
        >
          <SchemaRenderer
            schema={{
              type: 'element:record_picker',
              id: 'picker',
              dataSource: { object: 'showcase_project' },
              properties: { placeholder: 'Pick a project' },
            }}
          />
        </PageVariablesProvider>
      </AdapterCtx.Provider>,
    );

    await waitFor(() =>
      expect(find).toHaveBeenCalledWith('showcase_project', expect.any(Object)),
    );
  });

  it('renders an empty state without an adapter (safe to drop anywhere)', () => {
    const { getByTestId } = render(
      <SchemaRenderer
        schema={{
          type: 'element:record_picker',
          id: 'picker',
          properties: { object: 'showcase_project', emptyText: 'No projects' },
        }}
      />,
    );
    expect(getByTestId('record-picker')).toBeTruthy();
  });
});

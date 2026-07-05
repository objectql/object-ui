/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Regression tests for the `record:details` renderer's rules-of-hooks
 * contract. The renderer calls a fixed set of hooks (record context,
 * permissions, field labels, highlight names, inline-edit state + save
 * callbacks) and must call ALL of them on EVERY render — before any
 * conditional return.
 *
 * The bug these tests lock out: the designer placeholder (`!ctx`) and the
 * permission-denied notice used to `return` *between* hooks. When a
 * related-list row click flipped the bound record / permission state under a
 * mounted `record:details`, the re-render ran fewer hooks than the previous
 * one and React threw error #310 ("Rendered fewer hooks than expected"),
 * crashing the whole detail block. A transition between any two of these
 * branches must NOT throw.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const stub = {
  recordCtx: undefined as any,
  can: true,
};

// Each stubbed hook consumes exactly ONE real React hook slot (via useRef) so
// the component's hook-count invariant is genuinely exercised: `useRecordContext`
// really calls `useContext` before the `!ctx` early return in production, and
// that leading real-hook is what makes a fewer-hooks re-render throw #310. A
// plain `() => value` stub would call no real hook, silently masking the bug.
vi.mock('@object-ui/react', async () => {
  const React = await import('react');
  return {
    useRecordContext: () => (React.useRef(0), stub.recordCtx),
    useHighlightFieldNames: () => (React.useRef(0), [] as string[]),
    useSafeFieldLabel: () => (React.useRef(0), {
      sectionLabel: (_obj: string, _name: string, fallback: string) => fallback,
    }),
  };
});

vi.mock('@object-ui/permissions', async () => {
  const React = await import('react');
  return {
    usePermissions: () => (React.useRef(0), { can: () => stub.can }),
    useFieldPermissions: (_objectName: string) => (React.useRef(0), {
      readableFields: (names: string[]) => names,
    }),
  };
});

// Keep the test focused on the renderer's own hook ordering — stub the heavy
// children so we don't drag in the full DetailView / dialog trees.
vi.mock('../../DetailView', () => ({
  DetailView: (props: any) => <div data-testid="detail-view" data-object={props?.schema?.objectName} />,
}));
vi.mock('../../ConcurrentUpdateDialog', () => ({
  ConcurrentUpdateDialog: () => null,
  isConcurrentUpdateError: () => false,
}));

import { RecordDetailsRenderer } from '../record-details';

const BOUND_CTX = {
  objectName: 'mtc_lead',
  recordId: 'rec_1',
  data: { id: 'rec_1', name: 'Acme' },
  dataSource: { update: async () => ({}) },
  refresh: async () => {},
  objectSchema: { primaryField: 'name' },
};

beforeEach(() => {
  stub.recordCtx = BOUND_CTX;
  stub.can = true;
  cleanup();
});

describe('RecordDetailsRenderer — rules of hooks', () => {
  it('renders the bound record then survives the record UNBINDING (ctx → null)', () => {
    const { rerender, queryByTestId } = render(
      <RecordDetailsRenderer schema={{ fields: ['name'] }} />,
    );
    expect(queryByTestId('detail-view')).not.toBeNull();

    // A related-list row click can unbind the context mid-flight. Pre-fix this
    // re-render dropped from ~11 hooks to 1 → React #310.
    stub.recordCtx = undefined;
    expect(() => rerender(<RecordDetailsRenderer schema={{ fields: ['name'] }} />)).not.toThrow();
    expect(queryByTestId('detail-view')).toBeNull();
  });

  it('survives a permission flip (allowed → denied) between renders', () => {
    const schema = { fields: ['name'], requiredPermissions: ['read'] };
    const { rerender, queryByTestId } = render(<RecordDetailsRenderer schema={schema} />);
    expect(queryByTestId('detail-view')).not.toBeNull();

    // Permissions (re)load and now deny — the permission-denied branch used to
    // return before several hooks, changing the hook count → React #310.
    stub.can = false;
    expect(() => rerender(<RecordDetailsRenderer schema={schema} />)).not.toThrow();
    expect(queryByTestId('detail-view')).toBeNull();
  });

  it('survives re-binding back to a record (null → ctx) without a hook mismatch', () => {
    stub.recordCtx = undefined;
    const { rerender, queryByTestId } = render(
      <RecordDetailsRenderer schema={{ fields: ['name'] }} />,
    );
    expect(queryByTestId('detail-view')).toBeNull();

    stub.recordCtx = BOUND_CTX;
    expect(() => rerender(<RecordDetailsRenderer schema={{ fields: ['name'] }} />)).not.toThrow();
    expect(queryByTestId('detail-view')).not.toBeNull();
  });
});

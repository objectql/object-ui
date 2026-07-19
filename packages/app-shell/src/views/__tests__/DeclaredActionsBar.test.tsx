// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DeclaredActionsBar (objectui#2678 P2-4) — renders + executes an object's
 * SERVER-DECLARED actions for a single record at a location, with no
 * per-action host code. Coverage:
 *   • filters declared actions by `location`;
 *   • renders nothing when nothing matches (graceful degrade);
 *   • dispatches with the record stashed under `params._rowRecord` (so the api
 *     handler resolves `{id}`) and a `params` ARRAY surfaced as `actionParams`
 *     (the runner's param-dialog input).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Capture the execute dispatch from the shared runner.
const executeSpy = vi.fn().mockResolvedValue({ success: true });

vi.mock('@object-ui/react', () => ({
  ActionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAction: () => ({ execute: executeSpy }),
  // `visible` predicate: our test actions omit `visible`, so this is unused,
  // but keep it truthy so a `visible`-carrying action would still render.
  useCondition: () => true,
  toPredicateInput: (v: unknown) => v,
}));

// The runtime is exercised in its own suite; here it's an inert shell so the
// bar mounts without the full auth/i18n/router provider stack.
vi.mock('../../hooks/useConsoleActionRuntime', () => ({
  useConsoleActionRuntime: () => ({ actionProviderProps: {}, dialogs: null }),
}));

vi.mock('../../providers/AdapterProvider', () => ({ useAdapter: () => ({}) }));
vi.mock('../../providers/MetadataProvider', () => ({
  // The tests pass `actions` explicitly, so the metadata fetch is skipped.
  useMetadataItem: () => ({ item: null, loading: false, error: null }),
}));

vi.mock('../../utils/getIcon', () => ({ getIcon: () => () => null }));

vi.mock('@object-ui/components', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
  Separator: () => <hr />,
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

import { DeclaredActionsBar } from '../DeclaredActionsBar';

const REQUEST = { id: 'req_1', status: 'pending', record_id: 'proj_9' };

const ACTIONS = [
  {
    name: 'approval_approve', type: 'api', label: 'Approve',
    target: '/api/v1/approvals/requests/{id}/approve',
    locations: ['record_section'],
  },
  {
    name: 'approval_reassign', type: 'api', label: 'Reassign',
    target: '/api/v1/approvals/requests/{id}/reassign',
    locations: ['record_section'],
    params: [{ name: 'to', label: 'To', type: 'text' }],
  },
  {
    name: 'approval_bulk', type: 'api', label: 'Bulk',
    target: '/api/v1/approvals/bulk',
    locations: ['list_toolbar'],
  },
];

beforeEach(() => executeSpy.mockClear());

describe('DeclaredActionsBar', () => {
  it('renders only the actions declared at the requested location', () => {
    render(
      <DeclaredActionsBar
        objectName="sys_approval_request"
        record={REQUEST}
        location="record_section"
        actions={ACTIONS as any}
      />,
    );
    expect(screen.getByTestId('declared-action-approval_approve')).toBeInTheDocument();
    expect(screen.getByTestId('declared-action-approval_reassign')).toBeInTheDocument();
    // `list_toolbar`-only action must not surface at `record_section`.
    expect(screen.queryByTestId('declared-action-approval_bulk')).toBeNull();
  });

  it('drops `exclude`d actions so a host can keep some in its own UI', () => {
    render(
      <DeclaredActionsBar
        objectName="sys_approval_request"
        record={REQUEST}
        location="record_section"
        actions={ACTIONS as any}
        exclude={['approval_approve']}
      />,
    );
    // Excluded by name — the host renders approve itself.
    expect(screen.queryByTestId('declared-action-approval_approve')).toBeNull();
    // The rest still render.
    expect(screen.getByTestId('declared-action-approval_reassign')).toBeInTheDocument();
  });

  it('renders nothing (no chrome) when `exclude` empties the located set', () => {
    const { container } = render(
      <DeclaredActionsBar
        objectName="sys_approval_request"
        record={REQUEST}
        location="record_section"
        label="Actions"
        actions={[ACTIONS[0]] as any}
        exclude={['approval_approve']}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no declared action matches the location', () => {
    const { container } = render(
      <DeclaredActionsBar
        objectName="sys_approval_request"
        record={REQUEST}
        location="record_header"
        actions={ACTIONS as any}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('dispatches with the record under params._rowRecord so {id} resolves', async () => {
    render(
      <DeclaredActionsBar
        objectName="sys_approval_request"
        record={REQUEST}
        location="record_section"
        actions={ACTIONS as any}
      />,
    );
    fireEvent.click(screen.getByTestId('declared-action-approval_approve'));
    await waitFor(() => expect(executeSpy).toHaveBeenCalledTimes(1));
    const dispatch = executeSpy.mock.calls[0][0];
    expect(dispatch).toMatchObject({
      name: 'approval_approve',
      type: 'api',
      objectName: 'sys_approval_request',
      target: '/api/v1/approvals/requests/{id}/approve',
      params: { _rowRecord: REQUEST },
    });
    // No collection params → no `actionParams`.
    expect(dispatch.actionParams).toBeUndefined();
  });

  it('surfaces a `params` array as `actionParams` for the param dialog', async () => {
    render(
      <DeclaredActionsBar
        objectName="sys_approval_request"
        record={REQUEST}
        location="record_section"
        actions={ACTIONS as any}
      />,
    );
    fireEvent.click(screen.getByTestId('declared-action-approval_reassign'));
    await waitFor(() => expect(executeSpy).toHaveBeenCalledTimes(1));
    const dispatch = executeSpy.mock.calls[0][0];
    expect(dispatch.actionParams).toEqual([{ name: 'to', label: 'To', type: 'text' }]);
    // The array is NOT left on `params` (which is reserved for the row stash).
    expect(dispatch.params).toEqual({ _rowRecord: REQUEST });
  });

  it('renders a labeled divider only when actions are present', () => {
    render(
      <DeclaredActionsBar
        objectName="sys_approval_request"
        record={REQUEST}
        location="record_section"
        label="Actions"
        actions={ACTIONS as any}
      />,
    );
    expect(screen.getByText('Actions')).toBeInTheDocument();
    // Empty location → no divider/label chrome at all.
    const { container: empty } = render(
      <DeclaredActionsBar
        objectName="sys_approval_request"
        record={REQUEST}
        location="record_header"
        label="Actions"
        actions={ACTIONS as any}
      />,
    );
    expect(empty.firstChild).toBeNull();
  });
});

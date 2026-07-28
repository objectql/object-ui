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

// Declared metadata resolves through `useObjectLabel` (falling back to the
// authored literal, which is what the render assertions below expect); the
// bar's OWN chrome resolves through `t`. Marking `t` output makes it visible
// whether a string went through the locale bundle or was baked in English.
vi.mock('@object-ui/i18n', () => ({
  useObjectLabel: () => ({
    actionLabel: (_o: unknown, _n: unknown, fallback: string) => fallback,
    actionConfirm: (_o: unknown, _n: unknown, fallback?: string) => fallback,
    actionSuccess: (_o: unknown, _n: unknown, fallback?: string) => fallback,
  }),
  useObjectTranslation: () => ({ t: (key: string) => `t:${key}` }),
}));

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

  it('maps the spec action `variant` onto Button variants', () => {
    render(
      <DeclaredActionsBar
        objectName="sys_approval_request"
        record={REQUEST}
        location="record_section"
        actions={[
          { name: 'a_primary', type: 'api', label: 'P', target: '/x', locations: ['record_section'], variant: 'primary' },
          { name: 'a_danger', type: 'api', label: 'D', target: '/x', locations: ['record_section'], variant: 'danger' },
          { name: 'a_plain', type: 'api', label: 'N', target: '/x', locations: ['record_section'] },
          { name: 'a_ghost', type: 'api', label: 'G', target: '/x', locations: ['record_section'], variant: 'ghost' },
        ] as any}
      />,
    );
    // primary → the filled default; danger → destructive (the two names the
    // spec enum and Button component spell differently); undeclared → outline;
    // the rest pass through unchanged.
    expect(screen.getByTestId('declared-action-a_primary')).toHaveAttribute('variant', 'default');
    expect(screen.getByTestId('declared-action-a_danger')).toHaveAttribute('variant', 'destructive');
    expect(screen.getByTestId('declared-action-a_plain')).toHaveAttribute('variant', 'outline');
    expect(screen.getByTestId('declared-action-a_ghost')).toHaveAttribute('variant', 'ghost');
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

// objectui#2762 P0-3. The declared action LABELS localize via `useObjectLabel`,
// but two strings the bar authors itself were baked in English and bypassed
// i18n entirely — so a zh-CN workspace got 通过 / 拒绝 buttons sitting inside an
// "Actions" toolbar, with English help text under the decision-output fields.
//
// The help text is the subtler one: those params are synthesized here from the
// record's `decision_output_defs`, so their key path (`outputs.<key>`) is
// dynamic and no `_actions.<action>.params.*` bundle entry can ever match it.
// The runtime's `actionParamText` pass therefore always falls through to the
// literal — the literal IS what renders, every time.
describe('DeclaredActionsBar chrome localization (objectui#2762)', () => {
  it('localizes the toolbar aria-label instead of hardcoding "Actions"', () => {
    render(
      <DeclaredActionsBar
        objectName="sys_approval_request"
        record={REQUEST}
        location="record_section"
        actions={ACTIONS as any}
      />,
    );
    expect(screen.getByRole('toolbar')).toHaveAttribute('aria-label', 't:common.actions');
  });

  it('still prefers a host-supplied label over the translated default', () => {
    render(
      <DeclaredActionsBar
        objectName="sys_approval_request"
        record={REQUEST}
        location="record_section"
        label="决策"
        actions={ACTIONS as any}
      />,
    );
    expect(screen.getByRole('toolbar')).toHaveAttribute('aria-label', '决策');
  });

  it('localizes the decision-output help text', async () => {
    const decideAction = {
      name: 'approval_approve',
      type: 'api',
      label: 'Approve',
      target: '/api/v1/approvals/requests/{id}/approve',
      locations: ['record_section'],
    };
    render(
      <DeclaredActionsBar
        objectName="sys_approval_request"
        record={{
          ...REQUEST,
          decision_output_defs: [
            { key: 'reviewer', type: 'user' },
            { key: 'owning_team', type: 'team' },
            { key: 'notes' },
          ],
        }}
        location="record_section"
        actions={[decideAction] as any}
      />,
    );

    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => expect(executeSpy).toHaveBeenCalled());

    const params = executeSpy.mock.calls[0][0].actionParams as Array<Record<string, unknown>>;
    const byName = Object.fromEntries(params.map((p) => [p.name, p]));
    expect(byName['outputs.reviewer'].helpText).toBe('t:actions.decisionOutput.help');
    expect(byName['outputs.owning_team'].helpText).toBe('t:actions.decisionOutput.help');
    // The free-text variant carries the extra comma-separation sentence.
    expect(byName['outputs.notes'].helpText).toBe('t:actions.decisionOutput.helpMultiValue');
  });
});

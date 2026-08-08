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

// Only the action DISPATCH is doubled here. The predicate entry
// (`useCondition` / `toPredicateInput`) is the REAL one (objectui#3835).
//
// It used to be stubbed constant-true, with a comment saying our test actions
// omit `visible` "so this is unused" — which made the component's `visible`
// gate unreachable from this suite for as long as it existed, so the truthiness
// bug objectui#3835 reports lived here untouched (the objectstack#4984 family: a
// fixture keeping a broken rule green). A re-spelled stub would not fix that:
// `visible: false` only reaches "hidden" if `toPredicateInput` passes the
// boolean through and `evaluateCondition` short-circuits it, so a stub is a
// second copy of exactly the semantics under test. `@object-ui/react`'s barrel
// is cheap for the light `dom` project (`packages/components`' own gate suite
// imports it unmocked), so the gate below is judged by the shipped evaluation
// entry instead.
vi.mock('@object-ui/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@object-ui/react')>();
  return {
    ...actual,
    ActionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useAction: () => ({ execute: executeSpy }),
  };
});

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

// The components barrel stays doubled (its full graph is what the light `dom`
// project deliberately does not load), but `hasDeclaredVisibilityGate` is pulled
// from its real source module — the ONE definition objectui#3492 established and
// PR #3816 / #3825 / #3836 spread across the other four member-action gates. A
// re-spelled `v != null && v !== ''` here would be a fifth copy of it living in
// a test double, and would keep this suite green no matter what the shipped
// predicate does (objectui#3142 is what copies of one answer cost). The module
// is a dependency-free pure function, so importing it directly costs nothing.
vi.mock('@object-ui/components', async () => {
  const { hasDeclaredVisibilityGate } = await import(
    '../../../../components/src/renderers/action/visibility-gate'
  );
  return {
    Button: ({ children, onClick, ...props }: any) => (
      <button onClick={onClick} {...props}>{children}</button>
    ),
    Separator: () => <hr />,
    cn: (...args: any[]) => args.filter(Boolean).join(' '),
    hasDeclaredVisibilityGate,
  };
});

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

  it.each([
    ['/api/v1/approvals/requests/{id}/approve', true],
    ['/api/v1/approvals/requests/{id}/reject', false],
  ])('marks a required output required on %s → %s', async (target, expected) => {
    // The server enforces `required` on approve and never on reject; the two
    // dialogs must differ in exactly that flag (objectui#2955).
    render(
      <DeclaredActionsBar
        objectName="sys_approval_request"
        record={{
          ...REQUEST,
          decision_output_defs: [{ key: 'parallel_positions', type: 'position', required: true }],
        }}
        location="record_section"
        actions={[{
          name: 'decide', type: 'api', label: 'Decide', target, locations: ['record_section'],
        }] as any}
      />,
    );
    fireEvent.click(screen.getByText('Decide'));
    await waitFor(() => expect(executeSpy).toHaveBeenCalled());
    const params = executeSpy.mock.calls[0][0].actionParams as Array<Record<string, unknown>>;
    expect(params[0].required).toBe(expected);
  });

  it('hands the picker target under `reference`, the key that survives resolution', async () => {
    // objectui#2955: the params are spelled for `resolveActionParams`, which
    // rebuilds an inline param from a fixed key list and reads the target from
    // `reference`. Spelled `referenceTo` the target was dropped, and the
    // Approval Center rendered a "paste a record id" text box where a
    // sys_position multi-select belonged. The full round trip is pinned in
    // `utils/decisionOutputParams.test.ts`; this pins what the BAR emits.
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
            { key: 'parallel_positions', label: '并行会审岗位', type: 'position', multiple: true },
          ],
        }}
        location="record_section"
        actions={[decideAction] as any}
      />,
    );

    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => expect(executeSpy).toHaveBeenCalled());

    const params = executeSpy.mock.calls[0][0].actionParams as Array<Record<string, unknown>>;
    expect(params).toHaveLength(1);
    expect(params[0]).toMatchObject({
      name: 'outputs.parallel_positions',
      label: '并行会审岗位',
      type: 'lookup',
      reference: 'sys_position',
      multiple: true,
    });
    expect(params[0].referenceTo).toBeUndefined();
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

/**
 * objectui#3835 — the declared-action `visible` gate. Fifth and hottest member
 * of the objectui#3492 family: `if (action.visible && !isVisible) return null`
 * asked TRUTHINESS, so `visible: false` — the most explicit "never show this" an
 * author can write — was classified as "no gate declared", the verdict was never
 * consulted, and the action rendered for everyone.
 *
 * Why this surface is the hot one, and why the family's mitigation does not
 * cover it:
 *
 *   • The actions are SERVER-DECLARED (`objectDef.actions[]` /
 *     `sys_approval_request`), not hand-written view JSON, so "spec's
 *     `ExpressionInputSchema` has no boolean member, `objectstack build` cannot
 *     emit one" does not apply — the def arrives from server metadata and
 *     in-process construction, where a boolean is the natural spelling.
 *   • `DeclaredActionsBar` is mounted as plain JSX by its hosts
 *     (`apps/console/src/pages/system/ApprovalsInboxPage.tsx:2014` and `:2055`),
 *     so `packages/react`'s `SchemaRenderer` — which hides a node whose
 *     `visible !== undefined` evaluates false, and which made the component-level
 *     gates of objectui#3812 dormant — is not on this path at all. This gate is
 *     the only one there.
 *   • What renders is the approvals inbox's record-section bar: Approve / Reject
 *     / Reassign. A `visible: false` approval action rendered as a live button is
 *     one click away from a real approve/reject call.
 *
 * The gate now asks `hasDeclaredVisibilityGate` (`!= null && !== ''`), imported
 * from `@object-ui/components` rather than re-spelled — the verdict stays with
 * the evaluation entry, which short-circuits a boolean instead of calling the
 * expression engine.
 *
 * All FOUR shapes are asserted, and each one is load-bearing in a different
 * direction:
 *   • `false` hides — the defect itself (red before the fix);
 *   • `true` renders and undeclared renders — the anti-mutation guards: "hide
 *     the action unconditionally" satisfies every `visible: false` assertion on
 *     its own and would otherwise leave the suite green;
 *   • `''` renders — green BEFORE and AFTER the fix, and (measured, not assumed)
 *     green even under a gate mutated to `visible !== undefined`. On THIS
 *     surface `''` is covered twice: over-tightening the gate hands `''` to the
 *     evaluation entry, and `toPredicateInput('')` is `undefined`, which
 *     `evaluateCondition` reads as "no condition → visible". So this case
 *     documents the intended semantics; it is not a mutation detector here, and
 *     a reader should not mistake its passing for proof that the gate's `!== ''`
 *     limb is exercised (the limb itself is pinned in `packages/components`,
 *     next to the definition).
 * Every case carries the ungated `COMPANION`, so a passing "not rendered" can
 * never mean "the whole bar returned null" (the bar renders nothing at all when
 * its located set is empty — a distinct code path, two lines away).
 */
const COMPANION = {
  name: 'approval_reassign',
  type: 'api',
  label: 'Reassign',
  target: '/api/v1/approvals/requests/{id}/reassign',
  locations: ['record_section'],
};

function renderWithGate(action: Record<string, unknown>, record: Record<string, unknown> = REQUEST) {
  return render(
    <DeclaredActionsBar
      objectName="sys_approval_request"
      record={record}
      location="record_section"
      actions={[action, COMPANION] as any}
    />,
  );
}

describe('DeclaredActionsBar — declared `visible` on a server-declared action (objectui#3835)', () => {
  const APPROVE = {
    name: 'approval_approve',
    type: 'api',
    label: 'Approve',
    target: '/api/v1/approvals/requests/{id}/approve',
    locations: ['record_section'],
  };

  it('visible:false → the declared action does not render', () => {
    renderWithGate({ ...APPROVE, visible: false });
    expect(screen.queryByTestId('declared-action-approval_approve')).toBeNull();
    // The bar itself rendered — the assertion above is about the gate, not about
    // an empty located set.
    expect(screen.getByTestId('declared-action-approval_reassign')).toBeInTheDocument();
  });

  it('visible:true → the declared action renders', () => {
    renderWithGate({ ...APPROVE, visible: true });
    expect(screen.getByTestId('declared-action-approval_approve')).toBeInTheDocument();
    expect(screen.getByTestId('declared-action-approval_reassign')).toBeInTheDocument();
  });

  it('no `visible` at all → the declared action renders (ungated stays ungated)', () => {
    renderWithGate({ ...APPROVE });
    expect(screen.getByTestId('declared-action-approval_approve')).toBeInTheDocument();
  });

  it('an empty-string `visible` is not a declared gate — the action still renders', () => {
    renderWithGate({ ...APPROVE, visible: '' });
    expect(screen.getByTestId('declared-action-approval_approve')).toBeInTheDocument();
  });

  it('an expression-valued `visible` keeps its verdict — false hides, true shows', () => {
    const gated = { ...APPROVE, visible: 'status == "pending"' };
    const { unmount } = renderWithGate(gated, { ...REQUEST, status: 'approved' });
    expect(screen.queryByTestId('declared-action-approval_approve')).toBeNull();
    expect(screen.getByTestId('declared-action-approval_reassign')).toBeInTheDocument();
    unmount();
    renderWithGate(gated, { ...REQUEST, status: 'pending' });
    expect(screen.getByTestId('declared-action-approval_approve')).toBeInTheDocument();
  });

  it('a hidden action leaves NO clickable surface in the toolbar', async () => {
    // Hiding is not cosmetic on this surface: this component's own click handler
    // is what POSTs the approve/reject call, so what matters is that the gated
    // action contributes no button at all — not merely that a query by testid
    // misses it. Asserting the toolbar's button SET (rather than clicking the
    // companion and counting dispatches) is what makes this case move: an
    // unclicked extra button dispatches nothing either way, so a
    // dispatch-counting version of this test was green before the fix too.
    renderWithGate({ ...APPROVE, visible: false });
    const buttons = screen.getByRole('toolbar').querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute('data-testid', 'declared-action-approval_reassign');
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(executeSpy).toHaveBeenCalledTimes(1));
    expect(executeSpy.mock.calls[0][0]).toMatchObject({ name: 'approval_reassign' });
  });
});

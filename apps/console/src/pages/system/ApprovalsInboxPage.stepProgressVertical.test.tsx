// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Approvals Inbox — the drawer's step progress bar is a VERTICAL stepper
 * (objectui#5554).
 *
 * ## The defect
 *
 * The bar was a single non-wrapping flex ROW whose steps were each `shrink-0`,
 * so its min-content width is the SUM of every step and grows without bound
 * with step count and label length. On a live 17.1.0 project a real 6-step
 * flow measured **1070px inside a 527px drawer**, and the bar itself was not
 * scrollable (`overflow-x: visible`) — the nearest scroller was the drawer
 * PANEL, so reaching steps 4-6 meant dragging the drawer's own scrollbar,
 * which pushed the record card, the timeline and the action buttons off-screen
 * and left a near-blank panel. The customer acceptance tester read the clipped
 * bar as "there is no data". A wider window does not help: the drawer is
 * fixed-width, and the reporter confirmed identical clipping at 1440x900 and
 * 1920x1000.
 *
 * ## What is asserted, and why not "it renders"
 *
 * "The stepper renders" is green against the broken code too — all six steps
 * were always in the DOM; the clipping was layout. So the assertions name the
 * defect's own property: **no element in the stepper may pin intrinsic width,
 * and no element may be a horizontal scroller** — every step is reachable
 * without dragging anything sideways. Concretely: the container stacks
 * (`flex-col`), each step owns a row, no row is `shrink-0`, every label is
 * `min-w-0` (a flex item defaults to `min-width:auto` = min-content, which is
 * exactly how a long label pushes a row past its container) and none is
 * `whitespace-nowrap`, and nothing in the subtree is an `overflow-x` scroller.
 * The last one also rules out the half-measure the card explicitly rejects —
 * making the bar scroll itself and calling it fixed.
 *
 * ## Viewport and step-count coverage
 *
 * There is no CSSOM here, so these read the class contract Tailwind compiles
 * rather than measured boxes; every token asserted is named for the exact CSS
 * property whose value caused the reported overflow.
 *
 * Rather than sample two viewports, the suite pins the stronger fact that
 * makes sampling unnecessary: the stepper carries **no breakpoint-prefixed
 * axis, overflow or width-pinning class and no measurement**, so its layout is
 * the same at every viewport — there is no width at which an untested branch
 * takes over. The same argument covers flow length: the reported failing
 * regime (6 steps, the reporter's own CJK labels, verbatim) is exercised
 * directly, and a 2/5/6/12-step sweep pins that the layout classes are
 * byte-identical across all four, so no count threshold can put some other
 * length back on the old path.
 *
 * The `RecordApprovalsPanel` twin in `@object-ui/app-shell` carries the same
 * suite, by hand rather than by import: the two steppers live in different
 * packages and are deliberately kept identical, so each side pins the contract
 * for itself.
 *
 * No build artifact sits between the edit and this test: the root Vitest
 * config aliases every `@object-ui` specifier at that package's source, and
 * the page under test is this app's own source.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MePermissionsProvider, type MePermissionsResponse } from '@object-ui/permissions';

const APP = 'com.objectstack.account';

/** The bar's accessible name, as the page spells it through `tr`. */
const STEPPER_LABEL = 'Approval steps';

/** A business field the drawer must show — the counter-anchor for "it loaded". */
const BUSINESS_FIELD = 'Q3 clinical supplies';

type Step = { id: string; label: string; state: 'done' | 'current' | 'upcoming' };

/**
 * The reporter's actual 6-step flow, labels verbatim (objectui#5554). They are
 * CJK on purpose and must not be "translated" to short English: eight to
 * sixteen CJK characters is an ordinary business step name and is roughly
 * double the rendered width of an eight-to-sixteen-character English one, so
 * these labels ARE the reported regime — the 1070px measurement is theirs.
 * Swapping them for English fixtures would quietly move the fixture out of the
 * failing regime the card names.
 */
const REPORTED_STEPS: Step[] = [
  { id: 's1', label: '需求部门负责人初审', state: 'done' },
  { id: 's2', label: '工厂生产工艺负责人审核', state: 'done' },
  { id: 's3', label: '工厂业财审核（确认单价/派工工时）', state: 'current' },
  { id: 's4', label: '事业部成本改善经理加审', state: 'upcoming' },
  { id: 's5', label: '区域总经理+事业部业财运营总监会审', state: 'upcoming' },
  { id: 's6', label: '工厂厂长审批', state: 'upcoming' },
];

/** A synthetic flow of `n` steps, for the step-count invariance sweep. */
function stepsOfLength(n: number): Step[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `syn_${i}`,
    label: `区域总经理+事业部业财运营总监会审 ${i + 1}`,
    state: (i === 0 ? 'current' : 'upcoming') as Step['state'],
  }));
}

const { approvalsApiStub, setFlowSteps, ADAPTER, AUTH, I18N } = vi.hoisted(() => {
  const row: Record<string, unknown> = {
    id: 'req_1',
    process_name: 'purchase_approval',
    process_label: 'Purchase Approval',
    object_name: 'showcase_purchase',
    object_label: 'Purchase',
    record_id: 'po_1',
    record_title: 'PO-4417',
    status: 'pending',
    pending_approvers: ['u_1'],
    submitter_id: 'u_2',
    submitter_name: 'Sam Submitter',
    submitted_at: '2026-08-20T00:00:00.000Z',
    payload: { subject: 'Q3 clinical supplies' },
    flow_steps: [] as unknown[],
  };

  const setFlowSteps = (steps: unknown[]) => { row.flow_steps = steps; };

  const approvalsApiStub = {
    listRequests: vi.fn(async () => ({ data: [row], total: 1 })),
    getRequest: vi.fn(async () => ({ data: row })),
    listActions: vi.fn(async () => ({ data: [] })),
    approve: vi.fn(async () => ({ data: row, finalized: true })),
    reject: vi.fn(async () => ({ data: row, finalized: true })),
  };

  // STABLE singletons: a mocked hook handing back a fresh object per render
  // re-runs the page's load effect forever and the drawer never settles.
  const ADAPTER = { find: vi.fn(async () => ({ data: [{ id: 'po_1' }] })) };
  const AUTH = { user: { id: 'u_1', email: 'approver@example.com' } };
  const I18N = {
    t: (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key),
    language: 'en',
  };

  return { approvalsApiStub, setFlowSteps, ADAPTER, AUTH, I18N };
});

vi.mock('@object-ui/i18n', () => ({ useObjectTranslation: () => I18N }));

vi.mock('@object-ui/auth', () => {
  const authFetch = vi.fn(async () => new Response('{}', { status: 200 }));
  return {
    useAuth: () => AUTH,
    createAuthenticatedFetch: () => authFetch,
    TokenStorage: { get: () => null },
  };
});

vi.mock('@object-ui/app-shell', () => ({
  useAdapter: () => ADAPTER,
  DeclaredActionsBar: () => null,
  isViaOverrideRow: () => false,
}));

vi.mock('../../services/approvalsApi', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  approvalsApi: approvalsApiStub,
}));

// Imported after the mocks so the page picks them up.
import { ApprovalsInboxPage } from './ApprovalsInboxPage';

function permissionsPayload(): MePermissionsResponse {
  return {
    authenticated: true,
    userId: 'u_1',
    tenantId: 't_1',
    roles: [],
    permissionSets: [],
    objects: {},
    fields: {},
    // A business approver — deliberately NOT a platform admin. The stepper is
    // the approver's own read path and is never behind a capability gate.
    systemPermissions: ['setup.access'],
  };
}

/**
 * Open the drawer on `req_1` for a flow of `steps`, the way production opens
 * it — the `?request=` deep link is the page's own notification entry point.
 */
async function openDrawerWithSteps(steps: Step[]): Promise<HTMLElement> {
  setFlowSteps(steps);
  render(
    <MePermissionsProvider initialPermissions={permissionsPayload()}>
      <MemoryRouter initialEntries={[`/apps/${APP}/system/approvals?request=req_1`]}>
        <Routes>
          <Route path="/apps/:appName/system/approvals" element={<ApprovalsInboxPage />} />
        </Routes>
      </MemoryRouter>
    </MePermissionsProvider>,
  );
  const dialog = await screen.findByRole('dialog');
  await within(dialog).findByText('Purchase Approval');
  return dialog;
}

/** Class tokens of an element — `getAttribute` because SVG `className` is not a string. */
function tokens(el: Element): string[] {
  return (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

/**
 * Breakpoint-prefixed tokens in the families that could switch the axis back
 * to a row, reintroduce a scroller, or re-pin intrinsic width. A hit means
 * some viewport gets behaviour no test here covers — which is the failure mode
 * this card exists to end (the reporter measured 1440x900 and 1920x1000 as
 * identical, and a fix that holds at one width and not another is not a fix).
 */
const VIEWPORT_CONDITIONAL_LAYOUT =
  /^(?:sm|md|lg|xl|2xl|min-\[[^\]]+\]|max-\[[^\]]+\]):(?:flex-row|flex-col|flex|inline-flex|grid|overflow-x-[\w-]+|shrink-0|whitespace-nowrap|w-max|w-screen)$/;

/** Every invariant that makes the steps reachable without a sideways drag. */
function expectVerticalStepperContract(stepper: HTMLElement, expectedLabels: string[]): void {
  // 1. Vertical axis — the steps stack; they do not queue across the width.
  expect(tokens(stepper)).toContain('flex-col');

  // 2. One row per step. Connectors live INSIDE a row, so no connector
  //    competes with a step for horizontal space (the old bar interleaved
  //    them as siblings of the step).
  const rows = within(stepper).getAllByRole('listitem');
  expect(rows).toHaveLength(expectedLabels.length);

  // 3. Every step is present, in order. Necessary but VACUOUS ALONE — the
  //    broken bar rendered all of them too. It is here so the width
  //    assertions below cannot be satisfied by an empty stepper.
  expectedLabels.forEach((label, i) => {
    expect(rows[i]).toHaveTextContent(label);
  });

  // 4. No row pins its own width. `shrink-0` on the step rows is precisely
  //    what made the old bar's min-content width the sum of every step.
  for (const row of rows) {
    expect(tokens(row)).not.toContain('shrink-0');
  }

  // 5. Every label may shrink below its intrinsic width and wrap.
  for (const label of expectedLabels) {
    const el = within(stepper).getByText(label);
    expect(tokens(el)).toContain('min-w-0');
    expect(tokens(el)).not.toContain('whitespace-nowrap');
  }

  // 6. Nothing in the subtree is a horizontal scroller. The fix is that the
  //    content FITS — not that the reader may drag it into view.
  for (const el of [stepper, ...Array.from(stepper.querySelectorAll('*'))]) {
    for (const token of tokens(el)) {
      expect(token).not.toMatch(/^overflow-x-(auto|scroll)$/);
    }
  }

  // 7. No viewport gets its own layout — see the regex's comment.
  for (const el of [stepper, ...Array.from(stepper.querySelectorAll('*'))]) {
    for (const token of tokens(el)) {
      expect(token).not.toMatch(VIEWPORT_CONDITIONAL_LAYOUT);
    }
  }
}

beforeEach(() => {
  for (const fn of Object.values(approvalsApiStub)) fn.mockClear();
  ADAPTER.find.mockClear();
});
afterEach(cleanup);

describe('Approvals Inbox — vertical step stepper (objectui#5554)', () => {
  it('lays out the reported 6-step CJK flow so every step is reachable without a sideways drag', async () => {
    const dialog = await openDrawerWithSteps(REPORTED_STEPS);

    // Counter-probe: this drawer really did load its business content, so the
    // layout assertions below cannot be satisfied by an empty render.
    expect(within(dialog).getByText(BUSINESS_FIELD)).toBeInTheDocument();

    expectVerticalStepperContract(
      within(dialog).getByLabelText(STEPPER_LABEL),
      REPORTED_STEPS.map((s) => s.label),
    );
  });

  it('holds the same contract at the guard boundary (2 steps) and well past the report (12)', async () => {
    for (const n of [2, 12]) {
      cleanup();
      const dialog = await openDrawerWithSteps(stepsOfLength(n));
      expect(within(dialog).getByText(BUSINESS_FIELD)).toBeInTheDocument();
      expectVerticalStepperContract(
        within(dialog).getByLabelText(STEPPER_LABEL),
        stepsOfLength(n).map((s) => s.label),
      );
    }
  });

  it('has no step-count regime: the layout classes are identical at 2, 5, 6 and 12 steps', async () => {
    const shapes: Array<{ n: number; rowCount: number; root: string | null; firstRow: string | null; lastRow: string | null }> = [];
    for (const n of [2, 5, 6, 12]) {
      cleanup();
      const dialog = await openDrawerWithSteps(stepsOfLength(n));
      const stepper = within(dialog).getByLabelText(STEPPER_LABEL);
      const rows = within(stepper).getAllByRole('listitem');
      shapes.push({
        n,
        rowCount: rows.length,
        root: stepper.getAttribute('class'),
        firstRow: rows[0].getAttribute('class'),
        lastRow: rows[rows.length - 1].getAttribute('class'),
      });
    }

    // Every flow length renders one row per step...
    expect(shapes.map((s) => [s.n, s.rowCount])).toEqual([[2, 2], [5, 5], [6, 6], [12, 12]]);
    // ...through the SAME layout. A count threshold that put long flows (or
    // short ones) back on a horizontal row would show up here as a difference,
    // and that threshold is the "works at one length, breaks at another" shape
    // this card rules out.
    expect([...new Set(shapes.map((s) => s.root))]).toHaveLength(1);
    expect([
      ...new Set(shapes.map((s) => s.firstRow).concat(shapes.map((s) => s.lastRow))),
    ]).toHaveLength(1);
  });

  it('keeps the connector tint keyed to the step it leads INTO, as the horizontal bar did', async () => {
    const dialog = await openDrawerWithSteps(REPORTED_STEPS);
    const rows = within(within(dialog).getByLabelText(STEPPER_LABEL)).getAllByRole('listitem');

    // A rail segment hangs below every step but the last.
    const rail = (row: HTMLElement) =>
      Array.from(row.querySelectorAll('div')).find((d) => tokens(d).includes('w-px'));
    expect(rows.slice(0, -1).every((r) => rail(r) !== undefined)).toBe(true);
    expect(rail(rows[rows.length - 1])).toBeUndefined();

    // s2 (done) and s3 (current) are the steps rows 0 and 1 lead into, so
    // those segments are green; s4 is upcoming, so row 2's successor is not.
    expect(tokens(rail(rows[0])!)).toContain('bg-emerald-300');
    expect(tokens(rail(rows[1])!)).toContain('bg-emerald-300');
    expect(tokens(rail(rows[2])!)).toContain('bg-border');
  });
});

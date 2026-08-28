// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Approvals Inbox — characterization pins for three #2762 P1/P2 behaviours
 * that shipped in #2803/#2811 with no assertion of their own (objectui#6395).
 *
 * ## What this file is, and is not
 *
 * Triage's charter (objectui#6395, 2026-08-25 19:54Z): commit a characterization
 * suite for the three behaviours below. **No production-code change is
 * chartered** — these are pins on shipped, working behaviour, not a fix.
 *
 *  1. **Approver chips carry their 会签 group** — `approverChips()` keys by
 *     (name, group), so two different approver ids sharing one display name
 *     stay two distinguishable labelled chips instead of collapsing back into
 *     the reported symptom (#2811).
 *  2. **A flow-initiated request names its origin** — `isSystemSubmitter()`
 *     plus the "Flow-initiated" cell, instead of a bare person icon + em dash
 *     (#2803).
 *  3. **Record-card copy and emphasis** — `prettifyKey()` drops a trailing
 *     `id` token (`owner_id` → "Owner") and `decisionAmountEntry()` promotes
 *     the decision amount to a lead figure, excluded from the generic field
 *     grid so it renders exactly once (#2803).
 *
 * The fourth #2762 behaviour the finding named — declared action hierarchy
 * (`variant: 'primary'` renders filled, `variant: 'danger'` renders
 * destructive) — is already pinned at
 * `packages/app-shell/src/views/__tests__/DeclaredActionsBar.test.tsx`
 * ("maps the spec action `variant` onto Button variants"). Not duplicated
 * here.
 *
 * ## Why the fixture is non-degenerate — this is the load-bearing part
 *
 * A single-approver or single-group fixture passes against the PRE-FIX code
 * too, so it proves nothing about the regression each case exists to catch.
 * One shared row therefore carries, at once:
 *
 *  - **two different approver ids sharing one display name, filling two
 *    different 会签 groups** (`u_fin` → Finance, `u_leg` → Legal) — the
 *    fixture #2811 needed: same-name collapse only shows up when there are
 *    two people to conflate;
 *  - a **`flow:`-prefixed submitter id** with no `submitter_name` — the shape
 *    a real flow-initiated request arrives in;
 *  - a payload carrying **both `owner_id` and `amount`** — `owner_id` proves
 *    the id-token trim (a bare `id` key, or one with a resolvable non-`_id`
 *    name, would not exercise `prettifyKey`'s trim branch at all), `amount`
 *    proves both the lead-figure promotion and the single-render exclusion.
 *
 * `approverChips()` and the "Waiting on" chips are rendered only in the
 * drawer's business summary card (`selected.status === 'pending'` gate), and
 * `prettifyKey`/`decisionAmountEntry` back that same card — so all three cases
 * open the drawer. `isSystemSubmitter()` also renders identically in the
 * desktop table row and mobile card; the drawer header is exercised here
 * because it is already open for the other two cases, not because the table
 * row is untested code — same function, same gate, same behaviour.
 *
 * No build artifact sits between the edit and this test: the root Vitest
 * config aliases every `@object-ui` specifier at that package's source
 * directory, and the page under test is this app's own source.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const APP = 'com.objectstack.account';

// `vi.hoisted` is hoisted above ordinary module-scope `const`s (it has to run
// before the `vi.mock` factories below, which are themselves hoisted above
// all imports) — so the two display-value fixtures live INSIDE it and are
// destructured out below, rather than being plain top-level `const`s the
// hoisted block would close over before they existed.
const { approvalsApiStub, getObjectSchema, ADAPTER, AUTH, I18N, OWNER_DISPLAY, AMOUNT_DISPLAY } = vi.hoisted(() => {
  /** The server-resolved display value for `owner_id` — never opaque-dropped. */
  const OWNER_DISPLAY = 'Jordan Lee';
  /** The server-formatted decision amount, as `payload_display` would send it. */
  const AMOUNT_DISPLAY = 'USD 42,000.00';

  // Widened on purpose, same reason as ApprovalsInboxPage.hiddenFieldTrim's
  // ROW: a literal-inferred row would make the fixture's shape a type error
  // in the test rather than in anything under test.
  const ROW: Record<string, unknown> = {
    id: 'req_1',
    process_name: 'budget_approval',
    process_label: 'Budget Approval',
    object_name: 'showcase_purchase',
    object_label: 'Purchase',
    record_id: 'po_1',
    record_title: 'PO-9001',
    status: 'pending',
    // Case 1 fixture: two DIFFERENT approver ids, same display name, two
    // different 会签 groups — the non-degenerate shape #2811 needs.
    pending_approvers: ['u_fin', 'u_leg'],
    pending_approver_names: { u_fin: 'Dev Admin', u_leg: 'Dev Admin' },
    pending_approver_groups: { u_fin: ['Finance'], u_leg: ['Legal'] },
    // Case 2 fixture: a flow-initiated submitter, no resolved name.
    submitter_id: 'flow:budget_escalation',
    submitted_at: '2026-08-20T00:00:00.000Z',
    // Case 3 fixture: an `_id`-suffixed key (prettifyKey's trim branch) and
    // an amount-like key (decisionAmountEntry's lead figure), together.
    payload: {
      owner_id: 'usr_9f3ma2xk1pqz88a',
      amount: 42000,
    },
    payload_display: {
      owner_id: OWNER_DISPLAY,
      amount: AMOUNT_DISPLAY,
    },
  };

  const getObjectSchema = vi.fn(async (_name: string): Promise<unknown> => ({ fields: {} }));

  const approvalsApiStub = {
    listRequests: vi.fn(async () => ({ data: [ROW], total: 1 })),
    getRequest: vi.fn(async () => ({ data: ROW })),
    listActions: vi.fn(async () => ({ data: [] })),
    approve: vi.fn(async () => ({ data: ROW, finalized: true })),
    reject: vi.fn(async () => ({ data: ROW, finalized: true })),
  };

  // STABLE singletons: a mocked hook handing back a fresh object per render
  // re-runs the page's load effect forever and the drawer never settles
  // (same pitfall documented in the sibling pin files).
  const ADAPTER = { find: vi.fn(async () => ({ data: [{ id: 'po_1' }] })), getObjectSchema };
  const AUTH = { user: { id: 'u_fin', email: 'approver@example.com' } };
  const I18N = {
    t: (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key),
    language: 'en',
  };

  return { approvalsApiStub, getObjectSchema, ADAPTER, AUTH, I18N, OWNER_DISPLAY, AMOUNT_DISPLAY };
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

function renderInbox() {
  return render(
    <MemoryRouter initialEntries={[`/apps/${APP}/system/approvals?request=req_1`]}>
      <Routes>
        <Route path="/apps/:appName/system/approvals" element={<ApprovalsInboxPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Open the drawer the way a notification opens it — the `?request=` deep link. */
async function openedDrawer(): Promise<HTMLElement> {
  renderInbox();
  const dialog = await screen.findByRole('dialog');
  await within(dialog).findByText('Budget Approval');
  return dialog;
}

beforeEach(() => {
  getObjectSchema.mockClear();
  getObjectSchema.mockResolvedValue({ fields: {} });
  for (const fn of Object.values(approvalsApiStub)) fn.mockClear();
});
afterEach(cleanup);

describe('Approvals drawer — approver chips carry their 会签 group (objectui#2811, #6395)', () => {
  it('keeps two same-name approvers as two distinguishable, group-labelled chips', async () => {
    const dialog = await openedDrawer();

    // Two DISTINCT badges, not one deduped chip with a "×2" count — that
    // collapse is exactly the reported symptom (#2762 P1-2) the group key
    // exists to prevent. `getByText` matches an element by its OWN direct
    // text-node content (ignoring child elements), so this matches the Badge
    // itself and not its nested group `<span>`.
    const chips = screen.getAllByText('Dev Admin');
    expect(chips).toHaveLength(2);

    const chipTexts = chips.map((el) => el.textContent ?? '').sort();
    expect(chipTexts.some((t) => t.includes('Finance'))).toBe(true);
    expect(chipTexts.some((t) => t.includes('Legal'))).toBe(true);

    // Neither chip carries a count badge — each key was seen once.
    for (const chip of chips) {
      expect(chip.textContent ?? '').not.toContain('×');
    }

    // Scoped to the drawer, not incidental matches elsewhere on the page.
    expect(within(dialog).getAllByText('Dev Admin')).toHaveLength(2);
  });
});

describe('Approvals drawer — a flow-initiated request names its origin (objectui#2803, #6395)', () => {
  it('shows "Flow-initiated" instead of a bare person icon for a `flow:` submitter', async () => {
    const dialog = await openedDrawer();

    expect(within(dialog).getByText('Flow-initiated')).toBeInTheDocument();
    // The alternate (non-system) branch renders `submitterDisplay`, which for
    // this row — no `submitter_name` — falls back to `formatIdentity`'s
    // truncated-middle form of the raw `flow:` id. Its absence shows the
    // system branch actually fired, not just that "Flow-initiated" appears
    // somewhere else on the page.
    expect(within(dialog).queryByText('flow:b…tion')).not.toBeInTheDocument();
  });
});

describe('Approvals drawer — record-card copy and emphasis (objectui#2803, #6395)', () => {
  it('reads `owner_id` as "Owner" and leads with the decision amount exactly once', async () => {
    const dialog = await openedDrawer();

    // prettifyKey: the trailing `id` token is dropped, so the field label
    // reads "Owner", not "Owner Id".
    expect(within(dialog).getByText('Owner')).toBeInTheDocument();
    expect(within(dialog).getByText(OWNER_DISPLAY)).toBeInTheDocument();

    // decisionAmountEntry: the amount is promoted to the lead figure AND
    // excluded from the generic field grid, so its display value renders
    // exactly once on the page — not once as the lead figure and again as an
    // ordinary grid row.
    expect(screen.getAllByText(AMOUNT_DISPLAY)).toHaveLength(1);
  });
});

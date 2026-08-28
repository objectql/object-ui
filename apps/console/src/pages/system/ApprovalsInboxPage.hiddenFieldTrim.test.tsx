// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Approvals drawer — the business summary card honours the object's
 * `hidden: true` declaration (objectui#5565).
 *
 * ## The defect
 *
 * `payloadSummary` built the drawer's summary card from the request's
 * `payload_json` snapshot behind five filters (system keys, the lead amount
 * key, null/object/empty values, unresolved opaque ids, a 6-field cut) and
 * **no field-visibility filter of any kind**. A field the object's metadata
 * declares `hidden: true` was an ordinary scalar to that code, so it rendered
 * in the card, labelled.
 *
 * ## Why the fix is client-side, and why that is not a workaround
 *
 * Maintainer ruling on objectstack#10749: *`hidden: true` stays UI-only;
 * `internal: true` is the serialization primitive*. `hidden` gains no
 * serialization semantic, so the producer is CORRECT to ship the field, and
 * FLS-restricted fields are already redacted at serve time (objectstack#11039)
 * and are not this card's subject. `hidden` is a UI contract — "hidden from the
 * default UI" — and this drawer card is default UI, so the UI is the
 * authoritative place that contract is enforced, not a compensating one.
 *
 * ## ⚠️ Why the fixture is shaped the way it is — the 6-field cut is a
 * confounder in BOTH directions
 *
 * A hidden field only ever rendered if it survived to the first 6 survivors, so
 * a fixture that parks it seventh proves nothing; and a card that merely
 * reordered its rows is not a fix. So the fixture pins the FILTER:
 *
 *   1 subject · 2 vendor · 3 diagnosis_code (the hidden one, well inside the
 *   cut) · 4 department · 5 urgency · 6 ledger_ref · 7 justification · 8 notes
 *
 * Untrimmed the card shows 1-6. Trimmed it shows 1,2,4,5,6 **and 7** — the
 * seventh field is promoted into the slot the hidden field vacated, which can
 * only happen if the drop precedes the `max` cut. `notes` (8) stays out either
 * way, so "promotion" cannot be an off-by-one that simply renders more.
 *
 * ## The counter-probe, and why it is the important half
 *
 * "The hidden field is gone" is satisfiable by breaking the summary card
 * entirely. So the SAME fixture, in the SAME position, is rendered through the
 * SAME helper against an object that declares nothing hidden — and there
 * `diagnosis_code` renders. Every denial case also asserts its sibling business
 * fields, so an empty card fails here before it can pass anywhere.
 *
 * ## Why `setup.access`
 *
 * The raw-JSON panel (objectui#5553) would print the whole snapshot, hidden
 * field included, by a second route. Every render here is a business approver
 * holding `setup.access` — a real, reported grant that is deliberately NOT one
 * of the platform-admin-only capabilities — so that panel never renders and the
 * summary card is the only door under test.
 *
 * No build artifact sits between the edit and this test: the root Vitest config
 * aliases every `@object-ui` specifier at that package's source directory, and
 * the page under test is this app's own source.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MePermissionsProvider, type MePermissionsResponse } from '@object-ui/permissions';

const APP = 'com.objectstack.account';
const OBJECT = 'showcase_purchase';

/** The author's `hidden: true` field, third in the snapshot — inside the cut. */
const HIDDEN_VALUE = 'F32.1 major depressive';
/** Seventh in the snapshot: renders ONLY once the hidden field is dropped. */
const PROMOTED_VALUE = 'Replacing expired stock';
/** Eighth: out of the card either way, so promotion is not just "more rows". */
const NEVER_VALUE = 'Reviewed by pharmacy';
/** Ordinary business fields — the counter-anchor against an empty card. */
const SIBLING_VALUES = ['Q3 clinical supplies', 'Northwind Labs', 'Cardiology', 'Routine'];

const { approvalsApiStub, getObjectSchema, ADAPTER, AUTH, I18N, ROW } = vi.hoisted(() => {
  // Widened on purpose: the amount fixture below re-shapes `payload`, and a
  // literal-inferred row would make that a type error in the test rather than
  // in anything under test.
  const ROW: Record<string, unknown> = {
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
    payload: {
      subject: 'Q3 clinical supplies',
      vendor: 'Northwind Labs',
      diagnosis_code: 'F32.1 major depressive',
      department: 'Cardiology',
      urgency: 'Routine',
      ledger_ref: 'LR-4417',
      justification: 'Replacing expired stock',
      notes: 'Reviewed by pharmacy',
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
  // re-runs the page's load effect forever and the drawer never settles.
  const ADAPTER = { find: vi.fn(async () => ({ data: [{ id: 'po_1' }] })), getObjectSchema };
  const AUTH = { user: { id: 'u_1', email: 'approver@example.com' } };
  const I18N = {
    t: (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key),
    language: 'en',
  };

  return { approvalsApiStub, getObjectSchema, ADAPTER, AUTH, I18N, ROW };
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
    // A real, reported grant that is NOT platform-admin-only: the raw-JSON
    // panel (objectui#5553) stays shut, so the summary card is the only door.
    systemPermissions: ['setup.access'],
  };
}

/** Open the drawer the way a notification opens it — the `?request=` deep link. */
function renderDrawer() {
  return render(
    <MePermissionsProvider initialPermissions={permissionsPayload()}>
      <MemoryRouter initialEntries={[`/apps/${APP}/system/approvals?request=req_1`]}>
        <Routes>
          <Route path="/apps/:appName/system/approvals" element={<ApprovalsInboxPage />} />
        </Routes>
      </MemoryRouter>
    </MePermissionsProvider>,
  );
}

/** Render the page and hand back the drawer, once the request has loaded in. */
async function openedDrawer(): Promise<HTMLElement> {
  renderDrawer();
  const dialog = await screen.findByRole('dialog');
  await within(dialog).findByText('Purchase Approval');
  return dialog;
}

/** The card really rendered its business content — run by every denial case. */
function expectSummaryCardIntact(dialog: HTMLElement): void {
  for (const value of SIBLING_VALUES) {
    expect(within(dialog).getByText(value)).toBeInTheDocument();
  }
}

beforeEach(() => {
  ADAPTER.find.mockClear();
  getObjectSchema.mockClear();
  getObjectSchema.mockResolvedValue({ fields: {} });
  for (const fn of Object.values(approvalsApiStub)) fn.mockClear();
  // `mockClear` keeps implementations, so restore the default row explicitly —
  // otherwise the amount fixture below would leak into a later test.
  approvalsApiStub.listRequests.mockResolvedValue({ data: [ROW], total: 1 });
  approvalsApiStub.getRequest.mockResolvedValue({ data: ROW });
});
afterEach(cleanup);

describe('Approvals drawer summary card — `hidden: true` trim (objectui#5565)', () => {
  it('drops the hidden field and promotes the seventh into its slot', async () => {
    getObjectSchema.mockResolvedValue({
      fields: {
        subject: { type: 'text' },
        diagnosis_code: { type: 'text', hidden: true },
        justification: { type: 'text' },
      },
    });
    const dialog = await openedDrawer();

    // The promoted field is the settlement signal AND the proof that the drop
    // precedes the 6-field cut: seventh in the snapshot, it can only render
    // once the third has been filtered out.
    expect(await within(dialog).findByText(PROMOTED_VALUE)).toBeInTheDocument();

    expect(within(dialog).queryByText(HIDDEN_VALUE)).not.toBeInTheDocument();
    // Not an off-by-one that merely renders one row more.
    expect(within(dialog).queryByText(NEVER_VALUE)).not.toBeInTheDocument();
    expectSummaryCardIntact(dialog);

    expect(getObjectSchema).toHaveBeenCalledWith(OBJECT);
  });

  it('COUNTER-PROBE: same fixture, same position, nothing declared hidden — it renders', async () => {
    getObjectSchema.mockResolvedValue({
      fields: { subject: { type: 'text' }, diagnosis_code: { type: 'text' } },
    });
    const dialog = await openedDrawer();

    await waitFor(() => expect(getObjectSchema).toHaveBeenCalledWith(OBJECT));
    expect(within(dialog).getByText(HIDDEN_VALUE)).toBeInTheDocument();
    // Untrimmed the card is full at six, so the seventh stays out — the mirror
    // image of the promotion above.
    expect(within(dialog).queryByText(PROMOTED_VALUE)).not.toBeInTheDocument();
    expectSummaryCardIntact(dialog);
  });

  it('FAILS OPEN: a source that cannot describe the object renders today’s card', async () => {
    getObjectSchema.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
    const dialog = await openedDrawer();

    await waitFor(() => expect(getObjectSchema).toHaveBeenCalledWith(OBJECT));
    expect(within(dialog).getByText(HIDDEN_VALUE)).toBeInTheDocument();
    expectSummaryCardIntact(dialog);
  });
});

describe('Approvals drawer lead amount — same card, same trim (objectui#5565)', () => {
  /** The bold figure at the top of the summary card, as the server formats it. */
  const AMOUNT_DISPLAY = 'USD 12,500.00';

  function useAmountFixture() {
    const row = {
      ...ROW,
      payload: { total_amount: 12500, subject: 'Ventilator service contract' },
      payload_display: { total_amount: AMOUNT_DISPLAY },
    };
    approvalsApiStub.listRequests.mockResolvedValue({ data: [row], total: 1 });
    approvalsApiStub.getRequest.mockResolvedValue({ data: row });
  }

  it('does not lead with an amount field the object declares hidden', async () => {
    useAmountFixture();
    getObjectSchema.mockResolvedValue({ fields: { total_amount: { hidden: true } } });
    const dialog = await openedDrawer();

    await waitFor(() => expect(getObjectSchema).toHaveBeenCalledWith(OBJECT));
    expect(within(dialog).queryByText(AMOUNT_DISPLAY)).not.toBeInTheDocument();
    // The card is still a card: the hidden amount did not take the drawer with
    // it — and the counter-probe below renders this exact figure from this
    // exact fixture, so the absence above is the filter, not an empty drawer.
    expect(within(dialog).getByText('Ventilator service contract')).toBeInTheDocument();
  });

  it('COUNTER-PROBE: the same amount, undeclared, still leads the card', async () => {
    useAmountFixture();
    getObjectSchema.mockResolvedValue({ fields: { total_amount: {} } });
    const dialog = await openedDrawer();

    await waitFor(() => expect(getObjectSchema).toHaveBeenCalledWith(OBJECT));
    expect(within(dialog).getByText(AMOUNT_DISPLAY)).toBeInTheDocument();
    expect(within(dialog).getByText('Ventilator service contract')).toBeInTheDocument();
  });
});

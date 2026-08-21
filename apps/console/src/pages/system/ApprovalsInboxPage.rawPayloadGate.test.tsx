// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Approvals Inbox — the raw payload snapshot is a platform-operator affordance,
 * never the business approver's read path (objectui#5553).
 *
 * ## The defect
 *
 * The detail drawer's "Raw data (JSON)" panel rendered on `payload != null`
 * alone — no principal check of any kind — so every business approver was
 * handed the submitted record's complete raw row: internal ids, `created_by` /
 * `updated_by` / `owner_id` / `organization_id`, bare lookup ids, and the
 * fields the object's metadata declares `hidden: true`. Reported from a live
 * EHR deployment on 17.1.0 (objectstack#10734), where that declaration is a
 * patient-data control. Per the maintainer's ruling the panel does not render
 * for a business approver by default; holding a platform-admin-only capability
 * (`studio.access`, via `holdsStudioAccess`) is what restores it.
 *
 * ## Why every absence case here carries a counter-probe
 *
 * The acceptance condition is that something does NOT render, and a suite that
 * renders nothing at all reproduces that perfectly. So each denial case also
 * asserts the drawer it is denying inside — the process label and the business
 * summary row — and the `studio.access` case renders the SAME fixture through
 * the SAME helper and finds the panel. An empty render fails the counter-probe;
 * a gate stuck open fails the denials. Neither can pass alone.
 *
 * ## The witnesses
 *
 * `created_by` and `organization_id` are in the page's `PAYLOAD_SYSTEM_KEYS`,
 * so the summary card already drops them: their values can reach the DOM only
 * through the raw panel. That makes them exact witnesses for "the panel
 * rendered", not proxies. (Both are also long enough to trip the summary's
 * opaque-id filter, so neither can slip in by a second route.)
 *
 * ## ⛔ What this deliberately does NOT assert
 *
 * Nothing here says the summary card is trimmed by object metadata. This card
 * is the gate only; trimming the payload by `hidden: true` and the server-side
 * residual (the snapshot reaching the client unfiltered at all) are separate
 * and are tracked elsewhere. Asserting them here would pin behaviour this
 * change does not deliver.
 *
 * No build artifact sits between the edit and this test: the root Vitest config
 * aliases every `@object-ui` specifier at that package's source directory, and
 * the page under test is this app's own source.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MePermissionsProvider, type MePermissionsResponse } from '@object-ui/permissions';

const APP = 'com.objectstack.account';

/** The panel's summary label, as the page spells it through `tr`. */
const PANEL_LABEL = 'Raw data (JSON)';

/** Values that can only reach the DOM via the raw panel (see header). */
const AUDIT_WITNESS = 'usr_audit_witness';
const ORG_WITNESS = 'org_audit_witness';

/** A business field the approver is meant to decide from — the counter-anchor. */
const BUSINESS_FIELD = 'Q3 clinical supplies';

const { approvalsApiStub, adapterFind, ADAPTER, AUTH, I18N } = vi.hoisted(() => {
  const row = {
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
      created_by: 'usr_audit_witness',
      organization_id: 'org_audit_witness',
    },
  };

  const adapterFind = vi.fn(async () => ({ data: [{ id: 'po_1' }] }));

  const approvalsApiStub = {
    listRequests: vi.fn(async () => ({ data: [row], total: 1 })),
    getRequest: vi.fn(async () => ({ data: row })),
    listActions: vi.fn(async () => ({ data: [] })),
    approve: vi.fn(async () => ({ data: row, finalized: true })),
    reject: vi.fn(async () => ({ data: row, finalized: true })),
  };

  // STABLE singletons: a mocked hook handing back a fresh object per render
  // re-runs the page's load effect forever and the drawer never settles.
  const ADAPTER = { find: adapterFind };
  const AUTH = { user: { id: 'u_1', email: 'approver@example.com' } };
  const I18N = {
    t: (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key),
    language: 'en',
  };

  return { approvalsApiStub, adapterFind, ADAPTER, AUTH, I18N };
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

/**
 * `/me/permissions` as the provider receives it. `systemPermissions` is passed
 * through EXACTLY as given — `undefined` stays absent from the payload rather
 * than becoming `[]`, because "never reported" and "reported, holds nothing"
 * are different facts (objectui#4656) and this gate must deny on both.
 */
function permissionsPayload(systemPermissions: string[] | undefined): MePermissionsResponse {
  const base: MePermissionsResponse = {
    authenticated: true,
    userId: 'u_1',
    tenantId: 't_1',
    roles: [],
    permissionSets: [],
    objects: {},
    fields: {},
  };
  return systemPermissions === undefined ? base : { ...base, systemPermissions };
}

/**
 * Render the inbox with the drawer already open on `req_1`, for a principal
 * holding `systemPermissions`. The `?request=` deep link is the page's own
 * notification entry point, so the drawer opens the way production opens it.
 */
function renderDrawerFor(systemPermissions: string[] | undefined) {
  return render(
    <MePermissionsProvider initialPermissions={permissionsPayload(systemPermissions)}>
      <MemoryRouter initialEntries={[`/apps/${APP}/system/approvals?request=req_1`]}>
        <Routes>
          <Route path="/apps/:appName/system/approvals" element={<ApprovalsInboxPage />} />
        </Routes>
      </MemoryRouter>
    </MePermissionsProvider>,
  );
}

/** The open drawer, once the deep-linked request has actually loaded into it. */
async function openedDrawer(): Promise<HTMLElement> {
  const dialog = await screen.findByRole('dialog');
  await within(dialog).findByText('Purchase Approval');
  return dialog;
}

/**
 * The counter-probe, as one assertion: this drawer really did render its
 * business content. Every denial case runs it, so "the panel is absent" can
 * never be satisfied by an empty render.
 */
function expectBusinessDrawerRendered(dialog: HTMLElement): void {
  expect(within(dialog).getByText('Purchase Approval')).toBeInTheDocument();
  expect(within(dialog).getByText(BUSINESS_FIELD)).toBeInTheDocument();
}

beforeEach(() => {
  adapterFind.mockClear();
  for (const fn of Object.values(approvalsApiStub)) fn.mockClear();
});
afterEach(cleanup);

describe('Approvals Inbox — raw payload panel gating (objectui#5553)', () => {
  it('does not render the panel for a business approver, whose drawer is otherwise intact', async () => {
    // `setup.access` is a real, reported grant — an org-level admin holds it —
    // and it is deliberately NOT one of the platform-admin-only capabilities.
    renderDrawerFor(['setup.access']);
    const dialog = await openedDrawer();

    expect(within(dialog).queryByText(PANEL_LABEL)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(new RegExp(AUDIT_WITNESS))).not.toBeInTheDocument();
    expect(within(dialog).queryByText(new RegExp(ORG_WITNESS))).not.toBeInTheDocument();

    expectBusinessDrawerRendered(dialog);
  });

  it('renders the panel, with the raw row, for a holder of studio.access', async () => {
    renderDrawerFor(['studio.access']);
    const dialog = await openedDrawer();

    expect(within(dialog).getByText(PANEL_LABEL)).toBeInTheDocument();
    // The raw row itself, not just its heading: the audit columns the business
    // approver above could not reach are here, in the panel's JSON.
    expect(within(dialog).getByText(new RegExp(AUDIT_WITNESS))).toBeInTheDocument();
    expect(within(dialog).getByText(new RegExp(ORG_WITNESS))).toBeInTheDocument();

    // Same fixture, same helper — so the denial above is a gate, not a fixture
    // that renders nothing.
    expectBusinessDrawerRendered(dialog);
  });

  it('denies on a REPORTED EMPTY capability set — "holds nothing" is a real answer', async () => {
    renderDrawerFor([]);
    const dialog = await openedDrawer();

    expect(within(dialog).queryByText(PANEL_LABEL)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(new RegExp(AUDIT_WITNESS))).not.toBeInTheDocument();
    expectBusinessDrawerRendered(dialog);
  });

  it('denies when the backend reports no capability set at all (fail CLOSED)', async () => {
    // The inverted-stake case: `hasCapabilities` fails OPEN here, and a
    // deployment whose permission resolution just failed answers 200 with no
    // `systemPermissions` at all. That deployment must not be the one that
    // leaks the snapshot, so this gate reads the raw signal and denies.
    renderDrawerFor(undefined);
    const dialog = await openedDrawer();

    expect(within(dialog).queryByText(PANEL_LABEL)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(new RegExp(AUDIT_WITNESS))).not.toBeInTheDocument();
    expectBusinessDrawerRendered(dialog);
  });
});

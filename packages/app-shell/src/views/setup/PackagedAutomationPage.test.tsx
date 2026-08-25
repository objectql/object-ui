// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Setup › Packaged automation (ADR-0126 §7.4) — behaviour.
 *
 * Five properties, in the order the page exercises them:
 *
 *   1. **scope** — the list is packaged flows only. The rule itself lives in
 *      `packagedFlows.ts` and is measured directly in `packagedFlows.test.ts`;
 *      what is checked here is that the rendered page applies it.
 *   2. **round-trip** — flipping the switch calls the toggle route with the
 *      requested state and the shown state follows the SERVER's answer.
 *   3. **refusals, verbatim** — the three shapes this page must relay: the
 *      §5 posture gate (403 `PERMISSION_DENIED`), the §7.3 subflow guard
 *      (409 `DELETE_RESTRICTED`, which NAMES the callers) and the §7.1 clone
 *      name conflict (409). Each is asserted as the exact server string. Two
 *      of the three are transcribed character-for-character from the runtime's
 *      own message builders; what is under test either way is that the page
 *      renders what it was sent, unedited.
 *   4. **clone** — completes with the new name, and puts EXACTLY
 *      `{ name, label }` on the wire. The carried-over definition is not an
 *      editable form field (the #11753 discipline).
 *   5. **no ancestry** — the withdrawn §9 shapes are absent. The sharpest case
 *      is last: even when a response carries a `clonedFrom` key, the page must
 *      not display it. Pinning the rule at the RENDERER and not only at the
 *      wire is the point — a response field is the cheapest place for ancestry
 *      to reappear.
 */

import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';

import { PackagedAutomationPage } from './PackagedAutomationPage';

/* -------------------------------------------------------------------------- */
/* The server's own refusal strings                                            */
/* -------------------------------------------------------------------------- */

/**
 * `refuseUngrantedActivationWrite` (runtime `domains/automation.ts`), for the
 * `group` posture. Transcribed exactly: the sentence naming the posture AND the
 * one naming the sanctioned path are both load-bearing, and a client that
 * shortened it would drop the half that says what to do instead.
 */
const POSTURE_REFUSAL =
  "Enabling or disabling a packaged flow writes an INSTALL-WIDE activation row, and this deployment runs the " +
  "'group' tenancy posture, where that reaches every organization. It requires the platform operator " +
  '(ADR-0126 §5) — an organization administrator cannot flip an install-wide switch. To customize this flow ' +
  'for your organization, clone it under a new name instead.';

/**
 * The §7.3 subflow guard from the automation engine's `toggleFlow`, two
 * callers. The NAMES are the whole value of this refusal — nothing on the
 * client can reconstruct which packaged flows call this one as a subflow.
 */
const SUBFLOW_REFUSAL =
  "Flow 'pkg_notify' cannot be disabled while 2 packaged flows still call it as a subflow: " +
  "'pkg_escalate', 'pkg_onboard'. Disabling it would break those callers mid-run at their subflow node " +
  'with a late, inexplicable failure (ADR-0126 §7.3). Disable the calling flows first, or leave this one armed.';

/**
 * `flowCloneNameTakenMessage`. The trailing suggestion is the server's to
 * choose (`suggestCloneName`); what this file pins is that whatever it sends
 * arrives unedited, so the suggestion is fixture text here, not a contract.
 */
const CLONE_CONFLICT_REFUSAL =
  "Flow 'pkg_notify_copy' already exists — a clone must take a NEW machine name. Same-name clones are " +
  'refused on purpose: the automation engine keys flows by bare name, so a second definition under one ' +
  'name silently shadows the other and which of the two actually dispatches depends on registration ' +
  "order (ADR-0126 §7.1). Retry with a machine name no flow uses (for example 'pkg_notify_copy_2').";

/** `FLOW_CLONE_NOTICE` — returned on every successful clone. */
const CLONE_NOTICE =
  'References are not re-pointed: this clone calls exactly what the original called (subflows, actions ' +
  'and objects are unchanged). It is created with status `draft`, which is a lifecycle label and NOT an ' +
  'off-switch — a cloned record-change or schedule flow is bound to its trigger and will run alongside ' +
  'the flow it was copied from.';

/* -------------------------------------------------------------------------- */
/* Fake server                                                                 */
/* -------------------------------------------------------------------------- */

interface Fixture {
  runtime: Array<Record<string, unknown>>;
  meta: Array<Record<string, unknown>>;
  /** Queued answers for `POST …/toggle`, in call order. */
  toggle: Array<{ status: number; body: unknown }>;
  /** Queued answers for `POST …/clone`, in call order. */
  clone: Array<{ status: number; body: unknown }>;
}

let fixture: Fixture;
let calls: Array<{ url: string; method: string; body?: unknown }>;

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** ADR-0112 error envelope, as the runtime's `deps.error` puts it on the wire. */
function errorEnvelope(code: string, message: string) {
  return { success: false, error: { code, message } };
}

/** A packaged flow metadata item — loader-introduced, real package id. */
function packagedItem(name: string, label: string) {
  return { name, label, _packageId: 'com.objectstack.crm', _provenance: 'package' };
}

beforeEach(() => {
  calls = [];
  fixture = {
    runtime: [
      { name: 'pkg_notify', enabled: true, bound: true },
      { name: 'pkg_escalate', enabled: false, bound: false },
    ],
    meta: [packagedItem('pkg_notify', 'Notify owner'), packagedItem('pkg_escalate', 'Escalate case')],
    toggle: [],
    clone: [],
  };

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });

      if (url.endsWith('/automation/_status')) {
        return response(200, { success: true, data: { flows: fixture.runtime } });
      }
      if (url.endsWith('/meta/flow')) {
        return response(200, { items: fixture.meta });
      }
      if (url.includes('/toggle')) {
        const next = fixture.toggle.shift();
        if (next) return response(next.status, next.body);
        const enabled = (body as { enabled?: boolean } | undefined)?.enabled ?? true;
        const name = decodeURIComponent(url.split('/automation/')[1].replace('/toggle', ''));
        // The engine is the authority on what the state became — mirror it.
        const row = fixture.runtime.find((r) => r.name === name);
        if (row) row.enabled = enabled;
        return response(200, { success: true, data: { name, enabled } });
      }
      if (url.includes('/clone')) {
        const next = fixture.clone.shift();
        if (next) return response(next.status, next.body);
        const payload = body as { name: string; label: string };
        return response(200, {
          success: true,
          data: { flow: { name: payload.name, label: payload.label }, notice: CLONE_NOTICE },
        });
      }
      throw new Error(`unexpected fetch: ${method} ${url}`);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Render and wait for the first list paint. */
async function renderPage() {
  render(<PackagedAutomationPage />);
  await screen.findByText('Notify owner');
}

const toggleCalls = () => calls.filter((c) => c.url.includes('/toggle'));
const cloneCalls = () => calls.filter((c) => c.url.includes('/clone'));

/**
 * The Clone button of ONE named row. Rows are sorted by label, so an index
 * into `getAllByRole` names whichever flow happens to sort first — which is
 * how the first draft of this file clicked `pkg_escalate` while asserting
 * against `pkg_notify`.
 */
function cloneButtonFor(flowName: string) {
  return within(screen.getByTestId(`packaged-flow-${flowName}`)).getByRole('button', {
    name: 'Clone',
  });
}

/* -------------------------------------------------------------------------- */
/* 1) Scope                                                                    */
/* -------------------------------------------------------------------------- */

describe('scoping to packaged flows', () => {
  it('renders the packaged flows and leaves a tenant-authored one off the page', async () => {
    fixture.runtime = [...fixture.runtime, { name: 'my_own_flow', enabled: true, bound: true }];
    fixture.meta = [
      ...fixture.meta,
      // A tenant overlay BOUND to a package: it carries a real package id, so
      // only the provenance clause keeps it off this page (cloud#970).
      { name: 'my_own_flow', label: 'My own flow', _packageId: 'app.crm', _provenance: 'org' },
    ];

    await renderPage();

    expect(screen.getByText('Notify owner')).toBeInTheDocument();
    expect(screen.getByText('Escalate case')).toBeInTheDocument();
    expect(screen.queryByText('My own flow')).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* 2) Activation round-trip                                                    */
/* -------------------------------------------------------------------------- */

describe('activation round-trip', () => {
  it('disables and re-enables a packaged flow, showing what the server reports', async () => {
    await renderPage();

    const notify = screen.getByRole('switch', { name: 'Activation for Notify owner' });
    expect(notify).toBeChecked();

    fireEvent.click(notify);
    await waitFor(() => expect(toggleCalls()).toHaveLength(1));
    expect(toggleCalls()[0].method).toBe('POST');
    expect(toggleCalls()[0].url).toContain('/automation/pkg_notify/toggle');
    expect(toggleCalls()[0].body).toEqual({ enabled: false });
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Activation for Notify owner' })).not.toBeChecked(),
    );

    fireEvent.click(screen.getByRole('switch', { name: 'Activation for Notify owner' }));
    await waitFor(() => expect(toggleCalls()).toHaveLength(2));
    expect(toggleCalls()[1].body).toEqual({ enabled: true });
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Activation for Notify owner' })).toBeChecked(),
    );
  });

  it('shows a disabled packaged flow as off without any further ceremony', async () => {
    await renderPage();
    expect(screen.getByRole('switch', { name: 'Activation for Escalate case' })).not.toBeChecked();
  });
});

/* -------------------------------------------------------------------------- */
/* 3) Refusals, verbatim                                                       */
/* -------------------------------------------------------------------------- */

describe('server refusals reach the operator verbatim', () => {
  it('renders the §5 posture gate refusal (403 PERMISSION_DENIED) unedited', async () => {
    fixture.toggle = [{ status: 403, body: errorEnvelope('PERMISSION_DENIED', POSTURE_REFUSAL) }];
    await renderPage();

    fireEvent.click(screen.getByRole('switch', { name: 'Activation for Notify owner' }));

    expect(await screen.findByText(POSTURE_REFUSAL)).toBeInTheDocument();
    // The refused flip did not move the shown state.
    expect(screen.getByRole('switch', { name: 'Activation for Notify owner' })).toBeChecked();
  });

  it('renders the §7.3 subflow guard refusal (409 DELETE_RESTRICTED) with its named callers', async () => {
    fixture.toggle = [{ status: 409, body: errorEnvelope('DELETE_RESTRICTED', SUBFLOW_REFUSAL) }];
    await renderPage();

    fireEvent.click(screen.getByRole('switch', { name: 'Activation for Notify owner' }));

    const shown = await screen.findByText(SUBFLOW_REFUSAL);
    expect(shown).toBeInTheDocument();
    // The caller names survive — the half a summarising client would drop.
    expect(shown.textContent).toContain("'pkg_escalate', 'pkg_onboard'");
  });

  it('renders the §7.1 clone name conflict (409) unedited, keeping the dialog open', async () => {
    fixture.clone = [{ status: 409, body: errorEnvelope('RESOURCE_CONFLICT', CLONE_CONFLICT_REFUSAL) }];
    await renderPage();

    fireEvent.click(cloneButtonFor('pkg_notify'));
    fireEvent.change(await screen.findByLabelText('New machine name'), {
      target: { value: 'pkg_notify_copy' },
    });
    fireEvent.change(screen.getByLabelText('New label'), { target: { value: 'Notify owner (copy)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create clone' }));

    expect(await screen.findByText(CLONE_CONFLICT_REFUSAL)).toBeInTheDocument();
    // The refusal stays beside the input that caused it.
    expect(screen.getByLabelText('New machine name')).toHaveValue('pkg_notify_copy');
  });
});

/* -------------------------------------------------------------------------- */
/* 4) Clone                                                                    */
/* -------------------------------------------------------------------------- */

describe('clone', () => {
  it('completes with the new name and sends exactly { name, label }', async () => {
    await renderPage();

    fireEvent.click(cloneButtonFor('pkg_notify'));
    fireEvent.change(await screen.findByLabelText('New machine name'), {
      target: { value: 'crm_notify_owner' },
    });
    fireEvent.change(screen.getByLabelText('New label'), { target: { value: 'Notify owner (ours)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create clone' }));

    await waitFor(() => expect(cloneCalls()).toHaveLength(1));
    expect(cloneCalls()[0].url).toContain('/automation/pkg_notify/clone');
    // ⛔ No definition blob on the wire: a clone copies the whole definition
    // server-side, and this page never offers it as editable form fields.
    expect(cloneCalls()[0].body).toEqual({ name: 'crm_notify_owner', label: 'Notify owner (ours)' });

    expect(await screen.findByText(/Created flow "crm_notify_owner"\./)).toBeInTheDocument();
    // The server's post-clone notice, verbatim.
    expect(screen.getByText(CLONE_NOTICE)).toBeInTheDocument();
  });

  it('will not submit until both the new machine name and the new label are given', async () => {
    await renderPage();

    fireEvent.click(cloneButtonFor('pkg_notify'));
    const confirm = await screen.findByRole('button', { name: 'Create clone' });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText('New machine name'), { target: { value: 'crm_notify' } });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText('New label'), { target: { value: 'Ours' } });
    expect(confirm).toBeEnabled();
  });
});

/* -------------------------------------------------------------------------- */
/* 5) No ancestry or drift surface (ADR-0126 §9)                               */
/* -------------------------------------------------------------------------- */

describe('no ancestry or drift surface', () => {
  /**
   * The §9 shapes, as UI vocabulary.
   *
   * ⛔ `/copied from/` is deliberately NOT in this list, and its absence is the
   * distinction the rule actually draws. The server's own post-clone notice
   * ends "…will run alongside the flow it was copied from", and that notice
   * must be relayed VERBATIM. What §9 withdraws is a lineage SURFACE this page
   * would have to invent and maintain — a badge, a diff, a base-moved banner,
   * a link back to a source. It does not censor the server's sentences. The
   * first draft of this file scanned for the phrase and failed on the
   * platform's own words, which is the wrong end of the rule.
   */
  const WITHDRAWN = [
    /based on/i,
    /customized/i,
    /diff/i,
    /compare/i,
    /ancestry/i,
    /lineage/i,
    /out of date/i,
    /base (has )?moved/i,
    /upstream chang/i,
  ];

  it('shows a packaged flow with no drift badge, no diff-vs-base and no base-moved notice', async () => {
    await renderPage();
    for (const shape of WITHDRAWN) {
      expect(screen.queryByText(shape)).toBeNull();
    }
    // The withdrawn shape by name — a "based on v3" style provenance line.
    expect(screen.queryByText(/based on v\d/i)).toBeNull();
    // Nor the flat spelling of it anywhere in the list.
    expect(screen.queryByText(/cloned from/i)).toBeNull();
  });

  it('does not display ancestry even when a response carries it', async () => {
    // The clone route deliberately returns no `clonedFrom`. Feeding one anyway
    // proves the ABSENCE is enforced by this page and not merely by the wire.
    fixture.clone = [
      {
        status: 200,
        body: {
          success: true,
          data: {
            flow: { name: 'crm_notify_owner', label: 'Ours' },
            notice: CLONE_NOTICE,
            clonedFrom: 'pkg_notify',
            baseVersion: 'v3',
          },
        },
      },
    ];
    await renderPage();

    fireEvent.click(cloneButtonFor('pkg_notify'));
    fireEvent.change(await screen.findByLabelText('New machine name'), {
      target: { value: 'crm_notify_owner' },
    });
    fireEvent.change(screen.getByLabelText('New label'), { target: { value: 'Ours' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create clone' }));

    await screen.findByText(/Created flow "crm_notify_owner"\./);
    for (const shape of WITHDRAWN) {
      expect(screen.queryByText(shape)).toBeNull();
    }

    // The two ancestry keys the response smuggled in reach the DOM nowhere.
    // Scoped to the clone result: `pkg_notify` legitimately appears in the
    // table as a row of its own, and a document-wide scan for it would pass
    // for the wrong reason.
    const result = screen.getByRole('status');
    expect(result.textContent).not.toContain('pkg_notify');
    expect(result.textContent).not.toContain('v3');
    expect(screen.queryByText(/v3/)).toBeNull();
  });
});

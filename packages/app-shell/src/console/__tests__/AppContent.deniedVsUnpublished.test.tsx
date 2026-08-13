// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * An app the session may not open must SAY so — not report a deploy state
 * (objectui#4252).
 *
 * ## The measured defect
 *
 * `GET /api/v1/meta/apps` is filtered per session server-side
 * (`filterAppForUser`), so an app withheld by `requiredPermissions` and an app
 * that does not exist were byte-identical to the console: both simply absent
 * from the list. `AppContent`'s `requestedAppMissing` branch therefore rendered
 * its only copy for an absent app — "This app is not available yet — it may
 * still be publishing. Try again in a moment." — over a PERMANENT authorization
 * decision, under a Retry button that can never succeed.
 *
 * The cost was measured on a downstream acceptance round and is not cosmetic:
 * one role hit this screen, another opened the same app fine, and because the
 * copy names a transient deployment state the finding was filed as a platform
 * defect and carried through two test batches. The account was missing a
 * permission-set binding; the gate had been working exactly as designed.
 *
 * ## What made the fix possible, and what it must not become
 *
 * The maintainer ruling (2026-08-12) took the contract-first half first:
 * objectstack#8013 (PR #8135) made the BY-NAME route answer an explicit
 * permission denial, while the LIST route stays filtered exactly as before —
 * no `authorized: false` flag, so the enumeration surface is not widened past
 * what a by-name probe already implies. Measured off that merged diff, the
 * envelope this console consumes is:
 *
 *     403  { success: false, error: { code: 'PERMISSION_DENIED', message } }
 *
 * and absence keeps its 404 `RESOURCE_NOT_FOUND`. So the branch here is on the
 * ADR-0112 **code**, never on the status (the objectui#4408 lesson: a status
 * cannot separate two refusals that share it), and ONLY the measured code
 * changes the copy — every other answer, including a transport failure, keeps
 * today's screen byte-for-byte. That direction is deliberate: a console that
 * guessed "denied" from anything else would re-tell the same lie the other way
 * round.
 *
 * ## Why the route is stubbed at the TRANSPORT
 *
 * The adapter is a real `ObjectStackAdapter` over a stubbed `fetch`, so these
 * cases exercise the real client, the real error stamping (`error.code` /
 * `httpStatus` off the envelope) and the real probe. Injecting a verdict into
 * component state instead would assert the branch against a fixture of its own
 * conclusion, and could not see the accessor (`body.error.code`) change.
 *
 * NOTE ON SCOPE: like `AppContent.inaccessibleAppStrand.test.tsx`, this file
 * measures WHICH SURFACE renders. `ConsoleLayout` and the lazy pages are
 * stubbed; none of their internals are part of the question.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';

// ---------------------------------------------------------------------------
// Mocks — everything that takes part in the DECISION stays real.
// ---------------------------------------------------------------------------

vi.mock('@object-ui/plugin-designer', () => ({
  CreateAppPage: () => <div data-testid="create-app-page" />,
  EditAppPage: () => <div data-testid="edit-app-page" />,
  DashboardDesignPage: () => <div data-testid="dashboard-design-page" />,
}));

vi.mock('../../layout/ConsoleLayout', () => ({
  ConsoleLayout: ({ activeAppName, children }: { activeAppName?: string; children?: React.ReactNode }) => (
    <div data-testid="console-layout" data-active-app={activeAppName}>
      <header>chrome</header>
      {children}
    </div>
  ),
}));
vi.mock('../../chrome/CommandPalette', () => ({ CommandPalette: () => null }));
vi.mock('../../chrome/KeyboardShortcutsDialog', () => ({ KeyboardShortcutsDialog: () => null }));
vi.mock('../../chrome/OnboardingWalkthrough', () => ({ OnboardingWalkthrough: () => null }));
vi.mock('../../views/ObjectView', () => ({ ObjectView: () => <div data-testid="object-view" /> }));

/**
 * `t` resolves out of the REAL locale packs, so what these cases read is the
 * shipped string for the active language rather than the call site's inline
 * default. That is what makes the `zh` case below a rendering fact.
 */
let locale: 'en' | 'zh' = 'en';
vi.mock('@object-ui/i18n', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const lookup = (pack: unknown, key: string): unknown =>
    key.split('.').reduce<any>((node, k) => (node == null ? undefined : node[k]), pack);
  return {
    ...actual,
    useObjectTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => {
        const hit = lookup(locale === 'zh' ? actual.zh : actual.en, key);
        return typeof hit === 'string' ? hit : String(options?.defaultValue ?? key);
      },
    }),
    useObjectLabel: () => ({ objectLabel: ({ label }: { label?: string }) => label }),
  };
});

vi.mock('@object-ui/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAuth: () => ({
    user: { id: 'u_b', name: 'B', email: 'b@example.com', role: 'member' },
    getAuthConfig: async () => ({ features: {} }),
    activeOrganization: { id: 'org_jia', name: '甲' },
  }),
  // Irrelevant to this branch (`requestedAppMissing` returns above the no-app
  // guard), pinned to the least-privileged value so nothing here can be an
  // admin-only result.
  useIsWorkspaceAdmin: () => false,
}));

const actionRunnerStub = { registerHandler: vi.fn(), getContext: () => ({}) };
vi.mock('@object-ui/react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useActionRunner: () => ({ execute: vi.fn(), runner: actionRunnerStub }),
  useGlobalUndo: () => {},
  useMutationInvalidationBridge: () => {},
}));

// ---------------------------------------------------------------------------
// The transport. One stubbed `fetch` behind a real adapter + real client.
// ---------------------------------------------------------------------------

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * The two answers `GET /api/v1/meta/app/:name` gives after objectstack#8135,
 * transcribed from that merged diff — `sendEnvelopeError(res, 403,
 * 'PERMISSION_DENIED', …)` and the pre-existing absence body.
 */
const DENIED_BODY = {
  success: false,
  error: {
    code: 'PERMISSION_DENIED',
    message: "You do not have permission to open the 'finance' app.",
  },
};
const ABSENT_BODY = {
  error: { code: 'RESOURCE_NOT_FOUND', message: 'Metadata item not found or access denied.' },
};

/** URLs the by-name meta route was asked for, in order. */
let metaItemRequests: string[] = [];
/** How the by-name route answers, per app name. */
let byName: Record<string, () => Response> = {};

function makeAdapter() {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/v1/discovery')) {
      return json(200, { success: true, data: { version: 'v0', routes: {}, capabilities: {} } });
    }
    const item = /\/api\/v1\/meta\/app\/([^/?]+)/.exec(url);
    if (item) {
      metaItemRequests.push(url);
      const answer = byName[decodeURIComponent(item[1])];
      return answer ? answer() : json(404, ABSENT_BODY);
    }
    // Nothing else is part of this question; a loud 500 keeps an unexpected
    // call from passing as a silent success.
    return json(500, { error: { code: 'UNEXPECTED_REQUEST', message: url } });
  });
  return new ObjectStackAdapter({ baseUrl: 'http://test.local', fetch: fetchImpl });
}

/** The adapter this render sees — a real one by default. */
let adapter: unknown = null;
vi.mock('../../providers/AdapterProvider', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAdapter: () => adapter,
}));

/**
 * The list as the SERVER hands it to this session: the withheld app is simply
 * ABSENT, exactly as `filterAppForUser` leaves it. The ruling keeps it that way
 * — nothing in this file may depend on a flag in the list.
 */
let metadataApps: unknown[] = [];
const refreshMetadata = vi.fn(async () => {});
vi.mock('../../providers/MetadataProvider', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMetadata: () => ({
    apps: metadataApps,
    objects: [],
    loading: false,
    ensureType: undefined,
    error: null,
    refresh: refreshMetadata,
  }),
}));

import { AppContent } from '../AppContent';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
}

/** Drives an in-tree navigation, so the verdict meets a SECOND app name. */
let navTarget = '/apps/no_such_app';
function NavProbe() {
  const navigate = useNavigate();
  return (
    <button data-testid="go-elsewhere" onClick={() => navigate(navTarget)}>
      go
    </button>
  );
}

function renderConsoleAt(initialUrl: string) {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <LocationProbe />
      <NavProbe />
      <Routes>
        <Route path="/apps/:appName/*" element={<AppContent />} />
        <Route path="/home" element={<div data-testid="home-launcher">home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The publishing copy, verbatim from the `en` pack — the must-not-change half. */
const PUBLISHING_COPY = 'This app is not available yet — it may still be publishing. Try again in a moment.';

describe('AppContent — a denied app says so; an absent one keeps the publishing copy (objectui#4252)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    locale = 'en';
    metadataApps = [{ name: 'crm', label: 'CRM', navigation: [] }];
    metaItemRequests = [];
    byName = {};
    adapter = makeAdapter();
  });

  it('THE DEFECT — a 403 PERMISSION_DENIED renders access denied, never "may still be publishing"', async () => {
    // The card's own repro: a session lacking the app's `requiredPermissions`
    // opens the app URL directly. The list withheld it; the by-name route says
    // WHY.
    byName.finance = () => json(403, DENIED_BODY);

    renderConsoleAt('/apps/finance');

    expect(await screen.findByTestId('app-access-denied')).toBeInTheDocument();
    expect(screen.getByText("You don't have access to this app")).toBeInTheDocument();
    // Pre-fix, THIS is what the same session was shown.
    expect(screen.queryByText(PUBLISHING_COPY)).not.toBeInTheDocument();
    // …and not under a Retry button whose promise is false: the decision is
    // permanent, so retrying it forever is the misdirection, one layer down.
    expect(screen.queryByTestId('app-not-available-retry')).not.toBeInTheDocument();
    // The screen renders above `ConsoleLayout`, so it owns its own way back
    // (objectui#4473's strand, not to be recreated here).
    expect(screen.getByTestId('app-access-denied-home')).toBeInTheDocument();
  });

  it('asks the BY-NAME route for the app it was asked for — the list is never re-read for a flag', async () => {
    byName.finance = () => json(403, DENIED_BODY);

    renderConsoleAt('/apps/finance');
    await screen.findByTestId('app-access-denied');

    expect(metaItemRequests).toHaveLength(1);
    expect(metaItemRequests[0]).toContain('/api/v1/meta/app/finance');
    // The readiness re-check still runs FIRST — the probe is what happens after
    // a refreshed list still cannot find the app, not instead of it.
    expect(refreshMetadata).toHaveBeenCalled();
  });

  it('MUST NOT CHANGE — a genuinely nonexistent app keeps the publishing copy, byte for byte', async () => {
    byName.no_such_app = () => json(404, ABSENT_BODY);

    renderConsoleAt('/apps/no_such_app');

    expect(await screen.findByTestId('app-not-available-retry')).toBeInTheDocument();
    expect(screen.getByText('App not available')).toBeInTheDocument();
    expect(screen.getByText(PUBLISHING_COPY)).toBeInTheDocument();
    expect(screen.queryByTestId('app-access-denied')).not.toBeInTheDocument();
  });

  it('MUST NOT CHANGE — a transport failure never claims a denial', async () => {
    // Only the measured code flips the copy. An unreachable server is the case
    // "try again in a moment" was always honest about.
    byName.finance = () => {
      throw new Error('network down');
    };

    renderConsoleAt('/apps/finance');

    expect(await screen.findByTestId('app-not-available-retry')).toBeInTheDocument();
    expect(screen.getByText(PUBLISHING_COPY)).toBeInTheDocument();
    expect(screen.queryByTestId('app-access-denied')).not.toBeInTheDocument();
  });

  it('MUST NOT CHANGE — an adapter that cannot answer the probe keeps the publishing copy', async () => {
    // A host may inject a DataSource without this probe (AGENTS #1 — the
    // console is protocol-agnostic). Degrading to today's screen is the honest
    // answer; crashing, or asserting a denial it never measured, is not.
    adapter = { onConnectionStateChange: () => () => {}, getConnectionState: () => 'connected' };

    renderConsoleAt('/apps/finance');

    expect(await screen.findByTestId('app-not-available-retry')).toBeInTheDocument();
    expect(screen.getByText(PUBLISHING_COPY)).toBeInTheDocument();
    expect(screen.queryByTestId('app-access-denied')).not.toBeInTheDocument();
  });

  it('MUST NOT CHANGE — an authorized session enters the app, and nothing is probed', async () => {
    metadataApps = [{ name: 'finance', label: 'Finance', navigation: [] }];

    renderConsoleAt('/apps/finance');

    const layout = await screen.findByTestId('console-layout');
    expect(layout).toHaveAttribute('data-active-app', 'finance');
    expect(screen.queryByTestId('app-access-denied')).not.toBeInTheDocument();
    // The probe is a consequence of the app being missing; an app that resolved
    // must not cost a request.
    expect(metaItemRequests).toEqual([]);
  });

  it('renders the denial in the active language — zh, from the shipped pack', async () => {
    locale = 'zh';
    byName.finance = () => json(403, DENIED_BODY);

    renderConsoleAt('/apps/finance');

    expect(await screen.findByTestId('app-access-denied')).toBeInTheDocument();
    expect(screen.getByText('你没有访问此应用的权限')).toBeInTheDocument();
    expect(screen.queryByText(PUBLISHING_COPY)).not.toBeInTheDocument();
  });

  it('renders the absence in the active language too — zh keeps its publishing copy', async () => {
    locale = 'zh';
    byName.no_such_app = () => json(404, ABSENT_BODY);

    renderConsoleAt('/apps/no_such_app');

    expect(await screen.findByTestId('app-not-available-retry')).toBeInTheDocument();
    expect(screen.getByText('此应用尚不可用 —— 可能仍在发布中。请稍后重试。')).toBeInTheDocument();
  });

  it('the verdict belongs to the app it was asked about — a second missing app is judged afresh', async () => {
    // Both apps are missing from the list, so `requestedAppMissing` never goes
    // false between them and no state in this branch is reset by the transition.
    // A verdict held loose from the name it describes would therefore ride into
    // the next URL and answer for an app it never probed — telling a user their
    // typo is a permission problem.
    byName.finance = () => json(403, DENIED_BODY);
    byName.no_such_app = () => json(404, ABSENT_BODY);

    renderConsoleAt('/apps/finance');
    await screen.findByTestId('app-access-denied');

    navTarget = '/apps/no_such_app';
    screen.getByTestId('go-elsewhere').click();

    expect(await screen.findByTestId('app-not-available-retry')).toBeInTheDocument();
    expect(screen.getByText(PUBLISHING_COPY)).toBeInTheDocument();
    expect(screen.queryByTestId('app-access-denied')).not.toBeInTheDocument();
    // …and each app was asked about itself, once.
    expect(metaItemRequests).toHaveLength(2);
    expect(metaItemRequests[1]).toContain('/api/v1/meta/app/no_such_app');
  });

  it('the denial screen offers a way back to /home', async () => {
    byName.finance = () => json(403, DENIED_BODY);

    renderConsoleAt('/apps/finance');
    const home = await screen.findByTestId('app-access-denied-home');
    home.click();

    await waitFor(() => expect(screen.getByTestId('pathname').textContent).toBe('/home'));
  });
});

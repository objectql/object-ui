/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * #4110 — the top-bar bell's Notifications tab was permanently empty on every
 * console surface that is not an app page (Home, Organizations, the full-page
 * AI screen). The bell renders in all of those variants, but the poller that
 * fills it (`sys_inbox_message` + `sys_notification_receipt`, ADR-0030 L5 /
 * #1429) was gated on `isApp` — the same flag that hides the app-only presence
 * avatars and connection dot. So on Home the popover held `[]` forever: the
 * "Unread" sub-filter showed "You're all caught up" and "All" — which filters
 * nothing at all — showed "No notifications", while Home's own To-do card
 * (`useHomeInbox`, ungated) listed the very same row from the very same object.
 *
 * These render the header against a fake adapter holding one canonical
 * MessagingService-emitted inbox row and assert the bell lists it in EVERY
 * variant. The `variant="app"` case is the control: it passed before the fix
 * too, and is what made the defect look like a popover-side filter bug.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// ── Chrome the header pulls in but that this test does not exercise ──────────

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'test' }),
  useParams: () => ({}),
  useNavigate: () => vi.fn(),
  // Reached through `useUrlOverlay` (the ⌘K / shortcuts overlays).
  useSearchParams: () => [new URLSearchParams(), vi.fn()] as const,
  Link: ({ children, to, ...p }: any) => <a href={String(to)} {...p}>{children}</a>,
}));

// Interpolating stub — the real packs carry `{{unread}}` / `{{total}}` holes,
// so returning `defaultValue` verbatim would make the copy assertions vacuous.
// `formatRelativeTime` is reached through `utils/relativeTime` for every row,
// so keep the rest of the module real.
vi.mock('@object-ui/i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useObjectTranslation: () => ({
    language: 'en',
    t: (key: string, options?: Record<string, unknown>) =>
      String(options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_m, name: string) =>
        String(options?.[name] ?? ''),
      ),
  }),
  useObjectLabel: () => ({
    objectLabel: (n: string) => n,
    dashboardLabel: (n: string) => n,
    pageLabel: (n: string) => n,
    reportLabel: (n: string) => n,
    viewLabel: (n: string) => n,
    appLabel: (n: string) => n,
  }),
}));

// Passthrough primitives: the popover body renders inline instead of driving
// Radix open/close in jsdom (i.e. "as if the user clicked the bell"). Menus
// that Radix would keep unmounted while closed render as nothing.
vi.mock('@object-ui/components', () => {
  const Pass = ({ children, ...p }: any) => <div {...stripProps(p)}>{children}</div>;
  const stripProps = (p: any) => {
    const { asChild, variant, size, align, sideOffset, ...rest } = p ?? {};
    return rest;
  };
  return {
    Button: ({ children, asChild, variant, size, ...p }: any) => (
      <button type="button" {...p}>{children}</button>
    ),
    DropdownMenu: Pass,
    DropdownMenuTrigger: Pass,
    DropdownMenuContent: () => null,
    DropdownMenuItem: Pass,
    DropdownMenuLabel: Pass,
    DropdownMenuSeparator: () => null,
    DropdownMenuGroup: Pass,
    Avatar: Pass,
    AvatarImage: () => null,
    AvatarFallback: Pass,
    Popover: Pass,
    PopoverTrigger: Pass,
    PopoverContent: Pass,
    Tabs: Pass,
    TabsList: Pass,
    TabsTrigger: ({ children }: any) => <button type="button">{children}</button>,
    TabsContent: Pass,
    cn: (...c: any[]) => c.filter(Boolean).join(' '),
  };
});

// Every lucide glyph renders as an inert span — the header imports 14 of them
// and the popover 4 more, and the set churns.
vi.mock('lucide-react', () => {
  const Icon = () => <span />;
  return new Proxy(
    { __esModule: true } as Record<string | symbol, unknown>,
    {
      get: (target, prop) => {
        if (prop === 'then' || prop === '__esModule' || typeof prop === 'symbol') {
          return target[prop];
        }
        return Icon;
      },
      // Vitest validates that each imported name exists on the mock, so the
      // proxy has to claim every glyph name, not just answer for it.
      has: (_target, prop) => prop !== 'then',
    },
  );
});

vi.mock('@object-ui/react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useOffline: () => ({ isOnline: true }),
}));

// Presence renders identifiably (and with a non-empty tenant list) so the
// #4197 boundary case can assert that presence stays app-only chrome while the
// activity feed goes user-scoped. `useTenantPresence` is a transport
// subscription, not a `dataSource.find` — there is no presence *read* to count.
vi.mock('@object-ui/collaboration', () => ({
  PresenceAvatars: () => <div data-testid="presence-avatars" />,
  useTenantPresence: () => [{ id: 'u2', name: 'Wang Wu' }],
}));

vi.mock('../ModeToggle', () => ({ ModeToggle: () => null }));
vi.mock('../WorkspaceSwitcher', () => ({ WorkspaceSwitcher: () => null }));
vi.mock('../LocaleSwitcher', () => ({ LocaleSwitcher: () => null }));
vi.mock('../ConnectionStatus', () => ({
  ConnectionStatus: () => <div data-testid="connection-dot" />,
}));
vi.mock('../AppSwitcher', () => ({ AppSwitcher: () => null }));
vi.mock('../LocalizedSidebarTrigger', () => ({ LocalizedSidebarTrigger: () => null }));
vi.mock('../PreviewBadge', () => ({ PreviewBadge: () => null }));

vi.mock('@object-ui/auth', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Zhang San', email: 'zs@example.com' },
    signOut: vi.fn(),
    isAuthEnabled: true,
    organizations: [],
    activeOrganization: null,
    isOrganizationsLoading: false,
    getAuthConfig: undefined,
  }),
  getUserInitials: () => 'ZS',
  useIsWorkspaceAdmin: () => false,
}));

vi.mock('../../providers/MetadataProvider', () => ({
  useMetadata: () => ({ apps: [], dashboards: [], pages: [], reports: [] }),
}));

// ── The inbox fixture: exactly what MessagingService materializes ────────────

/**
 * One `sys_inbox_message` row as the L5 materialization writes it for an emit
 * of `{topic, audience:[userId], payload:{title, body, url}, dedupKey, source}`
 * — the shape #4110 reports as invisible in the bell.
 */
const INBOX_ROW = {
  id: 'ibx_1',
  user_id: 'u1',
  notification_id: 'ntf_1',
  topic: 'hr.contract.expiring',
  title: 'Contract expiring: Zhang San',
  body_md: "Zhang San's labour contract expires in 30 days.",
  action_url: '/apps/ehr/hr_contract/record/c_1',
  created_at: '2026-08-10T09:00:00Z',
};

/** `state: 'delivered'` — delivered is NOT read, so the row must show unread. */
const DELIVERED_RECEIPT = {
  id: 'rcp_1',
  notification_id: 'ntf_1',
  user_id: 'u1',
  channel: 'inbox',
  state: 'delivered',
};

const finds: Array<{ object: string; query: unknown }> = [];
/** What the fake `sys_inbox_message` collection holds for the current test. */
let inboxRows: Array<Record<string, unknown>> = [];

/**
 * #4197 — one `sys_activity` row in plugin-audit's raw column names, the shape
 * both the bell's Activity tab and Home's activity card map onto `ActivityItem`.
 * A named human actor, so it survives BOTH mappings (Home additionally drops
 * `System`-actor churn).
 */
const ACTIVITY_ROW = {
  id: 'act_1',
  type: 'updated',
  actor_name: 'Li Si',
  summary: 'updated Contract C-1',
  object_name: 'hr_contract',
  record_id: 'c_1',
  timestamp: '2026-08-10T08:00:00Z',
};

/** What the fake `sys_activity` collection holds for the current test. */
let activityRows: Array<Record<string, unknown>> = [];

/**
 * What `/api/v1/approvals/requests?status=pending` answers for the current
 * test. Two rows ⇒ `pendingApprovalsCount` 2, which is the second badge addend.
 */
let approvalRows: Array<{ id: string }> = [];

const fakeAdapter = {
  find: (object: string, query: unknown) => {
    finds.push({ object, query });
    if (object === 'sys_inbox_message') return Promise.resolve({ data: inboxRows });
    if (object === 'sys_notification_receipt') {
      return Promise.resolve({ data: inboxRows.length ? [DELIVERED_RECEIPT] : [] });
    }
    if (object === 'sys_activity') return Promise.resolve({ data: activityRows });
    return Promise.resolve({ data: [] });
  },
  getClient: () => undefined,
};

vi.mock('../../providers/AdapterProvider', () => ({
  useAdapter: () => fakeAdapter,
}));

import { AppHeader } from '../AppHeader';
import { useHomeInbox } from '../../hooks/useHomeInbox';
import { __resetSharedUserFeeds } from '../../hooks/sharedUserFeeds';

/** Every URL passed to `fetch`, in order — the approvals reads are counted here. */
let fetchUrls: string[] = [];

beforeEach(() => {
  finds.length = 0;
  fetchUrls = [];
  inboxRows = [INBOX_ROW];
  // Default: no activity, no approvals — so the #4110 cases above keep the
  // exact badge arithmetic they were written against (approvals addend 0).
  activityRows = [];
  approvalRows = [];
  // Drop the shared feeds' cache and poll timer so cases do not inherit each
  // other's reads — the store deliberately outlives any one render tree.
  __resetSharedUserFeeds();
  // Route by URL: the approvals endpoint answers from `approvalRows`; every
  // other request (auth config, mark-read) stays a soft-degrading 404.
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      fetchUrls.push(url);
      if (url.includes('/api/v1/approvals/requests')) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: approvalRows }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(new Response('{}', { status: 404 }));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Objects the bell's poller reads, in the order it issued them. */
const inboxReads = () => finds.filter((f) => f.object === 'sys_inbox_message');
/** `sys_activity` reads issued by anyone in the tree — the dedupe assertion. */
const activityReads = () => finds.filter((f) => f.object === 'sys_activity');
/** Approvals-endpoint requests issued by anyone in the tree. */
const approvalReads = () => fetchUrls.filter((u) => u.includes('/api/v1/approvals/requests'));

describe('AppHeader — the bell polls the inbox in every variant (#4110)', () => {
  it('lists a canonical inbox row on Home, where the To-do card already shows it', async () => {
    render(<AppHeader variant="home" />);

    await waitFor(() => expect(inboxReads().length).toBeGreaterThan(0));
    expect(await screen.findByText('Contract expiring: Zhang San')).toBeInTheDocument();
    // …and the empty states are gone: "Unread" is the default sub-filter, and
    // "All" — which applies no predicate — must never be empty while a row is
    // in hand.
    expect(screen.queryByText("You're all caught up")).not.toBeInTheDocument();
    expect(screen.queryByText('No notifications')).not.toBeInTheDocument();
  });

  it('scopes that read to the signed-in user, newest first (ADR-0030 `mine`)', async () => {
    render(<AppHeader variant="home" />);

    await waitFor(() => expect(inboxReads().length).toBeGreaterThan(0));
    expect(inboxReads()[0].query).toMatchObject({
      $filter: { user_id: 'u1' },
      $orderby: { created_at: 'desc' },
    });
  });

  it('counts a `delivered` receipt as unread, so the badge shows the row', async () => {
    render(<AppHeader variant="home" />);

    expect(await screen.findByTestId('inbox-bell-badge')).toHaveTextContent('1');
  });

  it('lists it on the Organizations variant too', async () => {
    render(<AppHeader variant="orgs" />);

    expect(await screen.findByText('Contract expiring: Zhang San')).toBeInTheDocument();
  });

  it('still lists it inside an app (the control — this half never broke)', async () => {
    render(<AppHeader variant="app" appName="ehr" />);

    expect(await screen.findByText('Contract expiring: Zhang San')).toBeInTheDocument();
  });

  it('shows the empty state only when the inbox is genuinely empty', async () => {
    inboxRows = [];
    render(<AppHeader variant="home" />);

    // The read still happens — "empty" is now an answer, not an unasked question.
    await waitFor(() => expect(inboxReads().length).toBeGreaterThan(0));
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
    expect(screen.queryByTestId('inbox-bell-badge')).not.toBeInTheDocument();
  });
});

/**
 * #4197 — the two sibling effects #4110 left behind. The pending-approvals poll
 * (`if (!isApp || !user?.id) return;`) and the activity read
 * (`if (!dataSource || !isApp) return;`) carried the same variant gate, so
 * off-app the Approvals tab read "No pending approvals" and the Activity tab
 * "No recent activity" — on the very page whose own cards (`useHomeInbox`,
 * ungated) were showing both. Worse, the bell badge is
 * `unreadTopics + pendingApprovalsCount`, so after #4110 only the FIRST addend
 * was fetched off-app: the same user with the same data read 1 on Home and 3
 * inside an app.
 *
 * `variant="home"` is also the AI screen — `AiChatPage` renders
 * `<AppHeader variant="home" />`; there is no separate `ai-chat` variant
 * (`AppHeaderVariant = 'app' | 'home' | 'orgs'`).
 */
describe('AppHeader — Approvals + Activity fill in every variant (#4197)', () => {
  beforeEach(() => {
    approvalRows = [{ id: 'apr_1' }, { id: 'apr_2' }];
    activityRows = [ACTIVITY_ROW];
  });

  // 'app' is the control: it was green before the fix and must stay green.
  for (const variant of ['home', 'orgs', 'app'] as const) {
    it(`fills the Approvals tab on the ${variant} variant`, async () => {
      render(<AppHeader variant={variant} appName={variant === 'app' ? 'ehr' : undefined} />);

      // The count reached the popover: the breakdown line spells the second
      // addend out unclamped, and the tab body offers the drill-in.
      await waitFor(() =>
        expect(screen.getByTestId('inbox-badge-breakdown-approvals')).toHaveTextContent(
          '2 pending approvals',
        ),
      );
      expect(screen.getByText('View approvals')).toBeInTheDocument();
      expect(screen.queryByText('No pending approvals')).not.toBeInTheDocument();
    });

    it(`fills the Activity tab on the ${variant} variant`, async () => {
      render(<AppHeader variant={variant} appName={variant === 'app' ? 'ehr' : undefined} />);

      expect(await screen.findByText('updated Contract C-1')).toBeInTheDocument();
      expect(screen.getByText('Li Si')).toBeInTheDocument();
      expect(screen.queryByText('No recent activity')).not.toBeInTheDocument();
    });

    it(`reads the same badge on ${variant} as anywhere else — 1 unread topic + 2 approvals`, async () => {
      render(<AppHeader variant={variant} appName={variant === 'app' ? 'ehr' : undefined} />);

      // Both addends are fetched, so the badge reconciles against the
      // breakdown line instead of against an unasked question (#4073).
      await waitFor(() =>
        expect(screen.getByTestId('inbox-bell-badge')).toHaveTextContent('3'),
      );
      expect(screen.getByTestId('inbox-badge-breakdown-total')).toHaveTextContent('3 total');
      expect(screen.getByTestId('inbox-badge-breakdown-notifications')).toHaveTextContent(
        '1 notifications',
      );
    });
  }

  it('still reports an empty approvals inbox as an answer, not a gate', async () => {
    approvalRows = [];
    render(<AppHeader variant="home" />);

    await waitFor(() => expect(approvalReads().length).toBeGreaterThan(0));
    expect(await screen.findByText('No pending approvals')).toBeInTheDocument();
    // Badge falls back to the notifications addend alone — correctly this time.
    expect(screen.getByTestId('inbox-bell-badge')).toHaveTextContent('1');
  });
});

/**
 * The To-do card's real data path. `HomePage` renders this hook's output
 * alongside the bell inside `HomeLayout`, so on Home both consumers mount in
 * the same commit — the duplicate-read site the card called out.
 */
function HomeTodoCardProbe() {
  const { pendingApprovalsCount, activities } = useHomeInbox();
  return (
    // Fenced off with a testid so the assertions below can tell the card's
    // copy of a row apart from the bell's — when the fix works, BOTH render
    // the same text and an unscoped `getByText` is ambiguous by construction.
    <div data-testid="home-cards">
      <span data-testid="home-approvals-count">{pendingApprovalsCount}</span>
      <span data-testid="home-activity-summary">{activities[0]?.description ?? ''}</span>
    </div>
  );
}

/**
 * The pin on the triage ruling (#4197): consistency is the acceptance
 * criterion and ONE fetch feeds both consumers. Naively dropping `isApp` would
 * make Home issue the approvals read and the `sys_activity` read twice — once
 * for the bell, once for `useHomeInbox` — which is precisely the trade-off the
 * card refused to resolve by duplicate polling. Both consumers now read one
 * shared store, so the read count stays 1 no matter how many mount.
 */
describe('AppHeader + Home cards share one fetch, not two (#4197)', () => {
  beforeEach(() => {
    approvalRows = [{ id: 'apr_1' }, { id: 'apr_2' }];
    activityRows = [ACTIVITY_ROW];
  });

  it('issues ONE approvals read for the bell and the To-do card together', async () => {
    render(
      <>
        <AppHeader variant="home" />
        <HomeTodoCardProbe />
      </>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('inbox-badge-breakdown-approvals')).toHaveTextContent(
        '2 pending approvals',
      ),
    );
    await waitFor(() => expect(screen.getByTestId('home-approvals-count')).toHaveTextContent('2'));

    // …and exactly one request went out for the two of them.
    expect(approvalReads()).toHaveLength(1);
  });

  it('issues ONE sys_activity read for the bell and the activity card together', async () => {
    render(
      <>
        <AppHeader variant="home" />
        <HomeTodoCardProbe />
      </>,
    );

    // The one row surfaces in BOTH places — the bell's Activity tab and Home's
    // card — so it is matched twice and each match is attributed explicitly.
    await waitFor(() => {
      const homeCards = screen.getByTestId('home-cards');
      const shown = screen.getAllByText('updated Contract C-1');
      expect(shown.some((el) => !homeCards.contains(el))).toBe(true); // the bell's tab
      expect(shown.some((el) => homeCards.contains(el))).toBe(true); // Home's card
    });

    expect(activityReads()).toHaveLength(1);
  });

  it('serves both consumers the same numbers — the consistency criterion', async () => {
    render(
      <>
        <AppHeader variant="home" />
        <HomeTodoCardProbe />
      </>,
    );

    await waitFor(() => expect(screen.getByTestId('home-approvals-count')).toHaveTextContent('2'));
    // The bell's second badge addend IS the card's number, from one read.
    expect(screen.getByTestId('inbox-badge-breakdown-approvals')).toHaveTextContent(
      '2 pending approvals',
    );
  });
});

/**
 * The other half of the boundary. `isApp` still means something — it is the
 * flag that hides genuinely app-scoped chrome — so un-gating the two
 * user/org-scoped reads must NOT drag presence off-app with them.
 *
 * Note what is being pinned: presence never was a *read*. `useTenantPresence`
 * is a transport subscription (`PresenceProvider.subscribeTenant`) and the
 * effect formerly named `fetchPresenceAndActivities` explicitly never probed
 * it — its one and only read is `sys_activity`. So the boundary is a RENDER
 * gate, and these assert it stayed put.
 */
describe('AppHeader — presence stays app-only chrome (#4197 boundary)', () => {
  it('renders no presence avatars and no connection dot off-app', async () => {
    render(<AppHeader variant="home" connectionState="connected" />);

    // Settle on the INBOX read, not the activity read. Asserting an absence
    // needs the tree to have done its work first, and the inbox poll is the
    // one read this variant issues on both sides of this change (#4199
    // un-gated it) — so this case stays green before AND after, which is what
    // a boundary pin is for. Anchored on the activity read it went red on
    // `origin/main` for the settle point never arriving, which would have
    // dressed an unrelated timeout up as evidence about presence.
    await waitFor(() => expect(inboxReads().length).toBeGreaterThan(0));
    expect(screen.queryByTestId('presence-avatars')).not.toBeInTheDocument();
    expect(screen.queryByTestId('connection-dot')).not.toBeInTheDocument();
  });

  it('renders both inside an app (the control)', async () => {
    render(<AppHeader variant="app" appName="ehr" connectionState="connected" />);

    expect(await screen.findByTestId('presence-avatars')).toBeInTheDocument();
    expect(screen.getByTestId('connection-dot')).toBeInTheDocument();
  });

  it('never issues a presence read in any variant — presence is a subscription', async () => {
    render(<AppHeader variant="app" appName="ehr" connectionState="connected" />);

    await waitFor(() => expect(activityReads().length).toBeGreaterThan(0));
    // Not one read names presence — in the variant that DOES render it.
    expect(finds.some((f) => String(f.object).includes('presence'))).toBe(false);
  });
});

/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * #4225 / #4316 — the bell and Home's action centre, driven from ONE inbox feed.
 *
 * ## What was wrong
 *
 * Two consumers read `sys_inbox_message` on `/home`, and they asked different
 * questions of it. The bell's poll joined `sys_notification_receipt` for
 * read-state; `useHomeInbox` did not join anything. So Home could not tell a
 * read message from an unread one and listed the five most recent
 * unconditionally, badged — while the bell two hundred pixels above, reading
 * the same rows through the join, correctly showed zero unread (#4316). One
 * page load, two panels, opposite claims about the same messages.
 *
 * ## What these pin
 *
 * Both surfaces now derive from `sharedUserFeeds`' inbox feed, so the pins here
 * are deliberately *joint*: every case mounts the real `AppHeader` and the real
 * `HomeActionCenter` in ONE tree over ONE fake adapter and asserts what BOTH
 * show. That is the difference between "the bug is fixed" and "the bug has no
 * representable state left" — a future change that re-splits the read has to
 * make these two panels disagree to get past them, which is exactly the failure
 * mode being locked out.
 *
 * Reverse verification (predictions first, measured in PR #4319):
 *   - restore `useHomeInbox`'s own unjoined read ⇒ the #4316 block goes red
 *     (Home lists read messages the bell is not badging) and the one-read block
 *     goes red (two `sys_inbox_message` reads instead of one);
 *   - drop only the `!m.is_read` filter ⇒ the #4316 block goes red, the
 *     one-read block stays GREEN — which is why the read-count pin cannot stand
 *     in for the read-state pin, and both are here.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';

// ── Chrome the header pulls in but that this test does not exercise ──────────
// (the mock set `AppHeader.inboxVariant.test.tsx` established for mounting the
// real header in jsdom — kept in step with it deliberately.)

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'test' }),
  useParams: () => ({}),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()] as const,
  Link: ({ children, to, ...p }: any) => <a href={String(to)} {...p}>{children}</a>,
}));

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

vi.mock('@object-ui/components', () => {
  const stripProps = (p: any) => {
    const { asChild, variant, size, align, sideOffset, ...rest } = p ?? {};
    return rest;
  };
  const Pass = ({ children, ...p }: any) => <div {...stripProps(p)}>{children}</div>;
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

vi.mock('lucide-react', () => {
  const Icon = () => <span />;
  return new Proxy({ __esModule: true } as Record<string | symbol, unknown>, {
    get: (target, prop) => {
      if (prop === 'then' || prop === '__esModule' || typeof prop === 'symbol') {
        return target[prop];
      }
      return Icon;
    },
    has: (_target, prop) => prop !== 'then',
  });
});

vi.mock('@object-ui/react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useOffline: () => ({ isOnline: true }),
}));

vi.mock('@object-ui/collaboration', () => ({
  PresenceAvatars: () => <div data-testid="presence-avatars" />,
  useTenantPresence: () => [],
}));

vi.mock('../../layout/ModeToggle', () => ({ ModeToggle: () => null }));
vi.mock('../../layout/WorkspaceSwitcher', () => ({ WorkspaceSwitcher: () => null }));
vi.mock('../../layout/LocaleSwitcher', () => ({ LocaleSwitcher: () => null }));
vi.mock('../../layout/ConnectionStatus', () => ({ ConnectionStatus: () => null }));
vi.mock('../../layout/AppSwitcher', () => ({ AppSwitcher: () => null }));
vi.mock('../../layout/LocalizedSidebarTrigger', () => ({ LocalizedSidebarTrigger: () => null }));
vi.mock('../../layout/PreviewBadge', () => ({ PreviewBadge: () => null }));

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

// ── The fixture: one user's inbox, read-state carried by the receipts ────────

/**
 * Nine messages for one user — #4316's exact reported shape ("a user who opens
 * the bell and reads all nine messages, then returns to Home").
 */
const NINE = Array.from({ length: 9 }, (_, i) => ({
  id: `ibx_${i + 1}`,
  user_id: 'u1',
  notification_id: `ntf_${i + 1}`,
  topic: 'approval.reminder',
  title: `Approval request ${i + 1} needs your decision`,
  action_url: `/apps/crm/sys_approval_request/record/a_${i + 1}`,
  created_at: `2026-08-0${i + 1}T09:00:00Z`,
}));

/**
 * Ten messages, five of them read — the mixed cut. Three share a `(topic,
 * title)` so BOTH consumers' coalescing passes are exercised: the bell folds by
 * `(topic, title)`, Home by title, and the unread subset has to survive each.
 */
const MIXED = [
  { id: 'ibx_01', notification_id: 'ntf_01', topic: 'approval.reminder', title: 'Approval reminder: INV-1008', created_at: '2026-08-11T04:30:00Z' },
  { id: 'ibx_02', notification_id: 'ntf_02', topic: 'hr.contract.expiring', title: 'Contract expiring: Zhang San', created_at: '2026-08-11T04:00:00Z' },
  { id: 'ibx_03', notification_id: 'ntf_03', topic: 'project.digest', title: 'Scheduled project digest', created_at: '2026-08-11T03:00:00Z' },
  { id: 'ibx_04', notification_id: 'ntf_04', topic: 'project.digest', title: 'Scheduled project digest', created_at: '2026-08-11T02:00:00Z' },
  { id: 'ibx_05', notification_id: 'ntf_05', topic: 'task.mention', title: 'You were mentioned in Task T-42', created_at: '2026-08-11T01:00:00Z' },
  { id: 'ibx_06', notification_id: 'ntf_06', topic: 'project.digest', title: 'Scheduled project digest', created_at: '2026-08-11T00:00:00Z' },
  { id: 'ibx_07', notification_id: 'ntf_07', topic: 'crm.lead.assigned', title: 'Lead assigned: Acme Corp', created_at: '2026-08-10T23:00:00Z' },
  { id: 'ibx_08', notification_id: 'ntf_08', topic: 'invoice.paid', title: 'Invoice INV-1004 paid', created_at: '2026-08-10T22:00:00Z' },
  { id: 'ibx_09', notification_id: 'ntf_09', topic: 'deal.won', title: 'Deal won: Globex renewal', created_at: '2026-08-10T21:00:00Z' },
  { id: 'ibx_10', notification_id: 'ntf_10', topic: 'system.maintenance', title: 'Scheduled maintenance Sunday 02:00', created_at: '2026-08-10T20:00:00Z' },
].map((r) => ({ ...r, user_id: 'u1', action_url: `/apps/showcase/x/record/${r.id}` }));

/** Rows 06-10 are read; 01-05 are not. */
const MIXED_READ_IDS = ['ntf_06', 'ntf_07', 'ntf_08', 'ntf_09', 'ntf_10'];
/** The four distinct UNREAD titles (the two unread digests fold into one). */
const UNREAD_TITLES = [
  'Approval reminder: INV-1008',
  'Contract expiring: Zhang San',
  'Scheduled project digest',
  'You were mentioned in Task T-42',
];
/** Titles that are read — neither surface may present them as waiting. */
const READ_TITLES = [
  'Lead assigned: Acme Corp',
  'Invoice INV-1004 paid',
  'Deal won: Globex renewal',
  'Scheduled maintenance Sunday 02:00',
];

/** `read` for the listed notification ids, `delivered` (= NOT read) for the rest. */
const receiptsFor = (rows: Array<{ notification_id: string }>, readIds: string[]) =>
  rows.map((r, i) => ({
    id: `rcp_${i + 1}`,
    notification_id: r.notification_id,
    user_id: 'u1',
    channel: 'inbox',
    state: readIds.includes(r.notification_id) ? 'read' : 'delivered',
  }));

const finds: Array<{ object: string; query: unknown }> = [];
let inboxRows: Array<Record<string, unknown>> = [];
let receiptRows: Array<Record<string, unknown>> = [];
/** Overrides the inbox read outright (rejections, for the status cases). */
let inboxBehaviour: (() => Promise<unknown>) | null = null;

const fakeAdapter = {
  find: (object: string, query: unknown) => {
    finds.push({ object, query });
    if (object === 'sys_inbox_message') {
      return inboxBehaviour ? inboxBehaviour() : Promise.resolve({ data: inboxRows });
    }
    if (object === 'sys_notification_receipt') return Promise.resolve({ data: receiptRows });
    return Promise.resolve({ data: [] });
  },
  getClient: () => undefined,
};

vi.mock('../../providers/AdapterProvider', () => ({ useAdapter: () => fakeAdapter }));

import { AppHeader } from '../../layout/AppHeader';
import { HomeActionCenter } from '../../console/home/HomeRail';
import { useHomeInbox } from '../useHomeInbox';
import { __resetSharedUserFeeds } from '../sharedUserFeeds';

/**
 * Home's action centre wired exactly as `HomePage` wires it, fenced behind a
 * testid: both panels render the same strings by construction when the fix
 * works, so every assertion has to say WHICH panel it is talking about.
 */
function HomeProbe() {
  const { pendingApprovalsCount, notifications, notificationsStatus } = useHomeInbox();
  return (
    <div data-testid="home-cards">
      <HomeActionCenter
        pendingApprovalsCount={pendingApprovalsCount}
        notifications={notifications}
        notificationsStatus={notificationsStatus}
        onOpenApprovals={() => {}}
        onOpenNotification={() => {}}
        t={(key: string, options?: any) =>
          String(options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_m, name: string) =>
            String(options?.[name] ?? ''),
          )
        }
      />
    </div>
  );
}

/** The page as a user meets it: the bell above, the action centre below. */
function HomeSurfaces() {
  return (
    <>
      <AppHeader variant="home" />
      <HomeProbe />
    </>
  );
}

const home = () => screen.getByTestId('home-cards');
/** Home's "Needs your attention" badge, or null when the card shows none. */
const homeBadge = (): string | null => {
  const heading = within(home()).getByText('Needs your attention');
  const badge = heading.parentElement?.querySelector('span.tabular-nums');
  return badge ? badge.textContent : null;
};
/** Matches inside the bell only — i.e. anywhere that is not Home's card. */
const inBell = (title: string) =>
  screen.queryAllByText(title).filter((el) => !home().contains(el));
const inHome = (title: string) =>
  screen.queryAllByText(title).filter((el) => home().contains(el));

const inboxReads = () => finds.filter((f) => f.object === 'sys_inbox_message');
const receiptReads = () => finds.filter((f) => f.object === 'sys_notification_receipt');

beforeEach(() => {
  finds.length = 0;
  inboxRows = [];
  receiptRows = [];
  inboxBehaviour = null;
  // The feeds are module-scoped stores that outlive any one render tree.
  __resetSharedUserFeeds();
  // Approvals soft-degrade to 0 (404), so every badge below is the inbox's
  // contribution alone and the two surfaces' numbers are directly comparable.
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 404 }))));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('#4316 — an already-read message is not "needs your attention"', () => {
  it('nine messages, all read: the bell badges nothing AND Home lists nothing', async () => {
    // #4316's headline scenario, verbatim: the user opened the bell and read
    // all nine, then came back to Home. Before the join, Home listed five of
    // them under "Needs your attention" with a badge, directly contradicting
    // the bell above it.
    inboxRows = NINE;
    receiptRows = receiptsFor(NINE, NINE.map((r) => r.notification_id));

    render(<HomeSurfaces />);

    await waitFor(() => expect(inboxReads().length).toBeGreaterThan(0));
    await waitFor(() =>
      expect(within(home()).getByText("You're all caught up")).toBeInTheDocument(),
    );
    // Home: no rows, no badge.
    expect(within(home()).queryAllByText(/Approval request \d+ needs your decision/)).toHaveLength(0);
    expect(homeBadge()).toBeNull();
    // The bell agrees, and it is the same nine rows it is agreeing about.
    expect(screen.queryByTestId('inbox-bell-badge')).not.toBeInTheDocument();
  });

  it('one unread among nine: both surfaces name that one, and only that one', async () => {
    // The sharpest cut — everything read except row 3. A card that lists "the
    // five most recent" regardless of read-state shows four wrong rows here.
    inboxRows = NINE;
    receiptRows = receiptsFor(
      NINE,
      NINE.map((r) => r.notification_id).filter((id) => id !== 'ntf_3'),
    );

    render(<HomeSurfaces />);

    await waitFor(() =>
      expect(inHome('Approval request 3 needs your decision')).toHaveLength(1),
    );
    // Nothing else reached Home's card …
    expect(within(home()).queryAllByText(/Approval request \d+ needs your decision/)).toHaveLength(1);
    expect(homeBadge()).toBe('1');
    // … and the bell counts exactly the same single unread message.
    await waitFor(() =>
      expect(screen.getByTestId('inbox-bell-badge')).toHaveTextContent('1'),
    );
  });

  it('mixed read-state: the two surfaces agree on the unread subset', async () => {
    inboxRows = MIXED;
    receiptRows = receiptsFor(MIXED, MIXED_READ_IDS);

    render(<HomeSurfaces />);

    // Home lists the unread titles …
    for (const title of UNREAD_TITLES) {
      await waitFor(() => expect(inHome(title).length).toBeGreaterThan(0));
    }
    // … and not one read title, on either surface's "waiting" reading. The
    // bell's unread filter is its default, so a read row must not be there
    // either — the same rows, the same verdict, from the same feed.
    for (const title of READ_TITLES) {
      expect(inHome(title)).toHaveLength(0);
      expect(inBell(title)).toHaveLength(0);
    }
  });

  it('reads the SAME badge number on both surfaces — 4 unread topics', async () => {
    // Five unread rows folding into four distinct topics. The bell has always
    // badged unread topics; Home now counts the same fold of the same rows, so
    // the two numbers a user can see at once are one number.
    inboxRows = MIXED;
    receiptRows = receiptsFor(MIXED, MIXED_READ_IDS);

    render(<HomeSurfaces />);

    await waitFor(() => expect(screen.getByTestId('inbox-bell-badge')).toHaveTextContent('4'));
    expect(homeBadge()).toBe('4');
  });

  it('an unread message with no receipt at all still counts (delivered ≠ read)', async () => {
    // The other polarity: read-state is asserted by a receipt in a READ state,
    // never inferred from a receipt's absence — a fresh message has no receipt
    // and is unread, which is what makes the join safe to gate the card on.
    inboxRows = NINE;
    receiptRows = [];

    render(<HomeSurfaces />);

    await waitFor(() => expect(homeBadge()).toBe('5'));
    // Home caps its list at `limit` (5) …
    expect(within(home()).queryAllByText(/Approval request \d+ needs your decision/)).toHaveLength(5);
    // … while the bell, which lists the full window, badges all nine topics.
    expect(screen.getByTestId('inbox-bell-badge')).toHaveTextContent('9');
  });
});

describe('#4225 — one feed, one read, however many consumers mount', () => {
  beforeEach(() => {
    inboxRows = MIXED;
    receiptRows = receiptsFor(MIXED, MIXED_READ_IDS);
  });

  it('issues ONE sys_inbox_message read for the bell and Home together', async () => {
    render(<HomeSurfaces />);

    // Both surfaces have rendered from it …
    await waitFor(() => expect(inHome('Approval reminder: INV-1008').length).toBeGreaterThan(0));
    expect(inBell('Approval reminder: INV-1008').length).toBeGreaterThan(0);
    // … and exactly one read went out for the two of them. Two consumers, one
    // query: the duplicate-read the card was filed for.
    expect(inboxReads()).toHaveLength(1);
  });

  it('issues ONE sys_notification_receipt read too — the join is shared', async () => {
    render(<HomeSurfaces />);

    await waitFor(() => expect(receiptReads().length).toBeGreaterThan(0));
    expect(receiptReads()).toHaveLength(1);
  });

  it('reads the ADR-0030 `mine` window once, as the bell\'s superset', async () => {
    render(<HomeSurfaces />);

    await waitFor(() => expect(inboxReads().length).toBeGreaterThan(0));
    expect(inboxReads()[0].query).toMatchObject({
      $filter: { user_id: 'u1' },
      $orderby: { created_at: 'desc' },
      $top: 20,
    });
    expect(receiptReads()[0].query).toMatchObject({
      $filter: { user_id: 'u1', channel: 'inbox' },
    });
  });

  it('serves a second consumer mounting later from the same feed, without re-reading', async () => {
    const view = render(<AppHeader variant="home" />);
    await waitFor(() => expect(inboxReads()).toHaveLength(1));

    // Home mounts afterwards — the common case, the page body settling after
    // the header — and is served the cached rows rather than issuing its own.
    view.rerender(<HomeSurfaces />);

    await waitFor(() => expect(inHome('Approval reminder: INV-1008').length).toBeGreaterThan(0));
    expect(inboxReads()).toHaveLength(1);
  });
});

describe('#4225 — a failed inbox read reaches Home as an error, not as stale data', () => {
  /** objectstack#7344's rejection: the object exists, this caller may not read it. */
  const denied = () => {
    const err = new Error(
      "Access denied: operation 'find' on object 'sys_inbox_message' is not permitted",
    ) as Error & { httpStatus?: number; code?: string };
    err.httpStatus = 403;
    err.code = 'PERMISSION_DENIED';
    return Promise.reject(err);
  };

  it('does not let the store swallow a denial into stale-but-ready rows', async () => {
    // The store's pre-#4225 contract was "on error keep the last value" and say
    // nothing — which for a consumer is indistinguishable from a successful
    // re-read returning the same thing. Here the feed HAS rows in hand and then
    // the next read fails: the rows may stay, but the card must stop claiming
    // they are an answer.
    inboxRows = MIXED;
    receiptRows = receiptsFor(MIXED, MIXED_READ_IDS);
    render(<HomeSurfaces />);
    await waitFor(() => expect(inHome('Approval reminder: INV-1008').length).toBeGreaterThan(0));
    expect(within(home()).queryByTestId('home-action-unanswered')).not.toBeInTheDocument();

    // Re-read the same feed, in the one way a mounted page really does it: the
    // tab regains focus. (A remount would NOT do — it lands inside the store's
    // freshness window and is served the cache, which is the dedupe working.)
    inboxBehaviour = denied;
    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() =>
      expect(within(home()).getByTestId('home-action-unanswered')).toBeInTheDocument(),
    );
    expect(within(home()).getByText('An unexpected error occurred.')).toBeInTheDocument();
    expect(within(home()).queryByText("You're all caught up")).not.toBeInTheDocument();
    // …and the rows are still on screen. "Not an answer any more" is the claim,
    // not "throw the user's inbox away" — the two are different states and the
    // status is what separates them.
    expect(inHome('Approval reminder: INV-1008').length).toBeGreaterThan(0);
  });

  it('still treats a MISSING inbox object as an answer, for both surfaces', async () => {
    // The 404-is-an-answer split, now made once inside the store instead of
    // three times across three call sites (#4225 rider). A community build
    // without service-messaging has no inbox, so nothing is waiting — get this
    // wrong and every such deployment reads an error on Home forever.
    inboxBehaviour = () => {
      const err = new Error('Object not found: sys_inbox_message') as Error & {
        httpStatus?: number;
        code?: string;
      };
      err.httpStatus = 404;
      err.code = 'OBJECT_NOT_FOUND';
      return Promise.reject(err);
    };

    render(<HomeSurfaces />);

    await waitFor(() =>
      expect(within(home()).getByText("You're all caught up")).toBeInTheDocument(),
    );
    expect(within(home()).queryByTestId('home-action-unanswered')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inbox-bell-badge')).not.toBeInTheDocument();
  });
});

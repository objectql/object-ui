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

vi.mock('@object-ui/collaboration', () => ({
  PresenceAvatars: () => null,
  useTenantPresence: () => [],
}));

vi.mock('../ModeToggle', () => ({ ModeToggle: () => null }));
vi.mock('../WorkspaceSwitcher', () => ({ WorkspaceSwitcher: () => null }));
vi.mock('../LocaleSwitcher', () => ({ LocaleSwitcher: () => null }));
vi.mock('../ConnectionStatus', () => ({ ConnectionStatus: () => null }));
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

const fakeAdapter = {
  find: (object: string, query: unknown) => {
    finds.push({ object, query });
    if (object === 'sys_inbox_message') return Promise.resolve({ data: inboxRows });
    if (object === 'sys_notification_receipt') {
      return Promise.resolve({ data: inboxRows.length ? [DELIVERED_RECEIPT] : [] });
    }
    return Promise.resolve({ data: [] });
  },
  getClient: () => undefined,
};

vi.mock('../../providers/AdapterProvider', () => ({
  useAdapter: () => fakeAdapter,
}));

import { AppHeader } from '../AppHeader';

beforeEach(() => {
  finds.length = 0;
  inboxRows = [INBOX_ROW];
  // The approvals count + auth-config reads are not under test; keep them from
  // reaching the network (both are already soft-degrading).
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Objects the bell's poller reads, in the order it issued them. */
const inboxReads = () => finds.filter((f) => f.object === 'sys_inbox_message');

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

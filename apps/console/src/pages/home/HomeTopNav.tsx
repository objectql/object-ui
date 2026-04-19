/**
 * HomeTopNav
 *
 * Single-row top navigation bar for the Home (workspace) landing page.
 *
 *   [Logo + Product]                         [Global search (⌘K)]
 *   [Activity | Help] [Theme | Locale] [Workspace | User]
 *
 * The page title (rendered by `HomePage`) and any primary page actions live
 * in the page body, keeping the chrome compact. See
 * {@link ./HomeLayout.tsx} for composition.
 *
 * @module
 */

import { Link, useNavigate } from 'react-router-dom';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  Separator,
} from '@object-ui/components';
import {
  Search,
  HelpCircle,
  LogOut,
  Settings,
  User as UserIcon,
  ChevronsUpDown,
  Boxes,
} from 'lucide-react';
import { useAuth, getUserInitials } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import { WorkspaceSwitcher } from '../../components/WorkspaceSwitcher';
import { ModeToggle } from '../../components/mode-toggle';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { ActivityFeed, type ActivityItem } from '../../components/ActivityFeed';

interface HomeTopNavProps {
  /** Optional activity feed items. When omitted an empty feed is rendered. */
  activities?: ActivityItem[];
}

/** Opens the global command palette via the ⌘K/CtrlK shortcut it listens for. */
function openCommandPalette() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
}

export function HomeTopNav({ activities }: HomeTopNavProps) {
  const { t } = useObjectTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header
      className="sticky top-0 z-40 w-full shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
      data-testid="home-top-nav"
    >
      {/* ──────────────────────────── Row 1: Global ──────────────────────────── */}
      <div className="flex h-12 w-full items-center gap-2 px-3 sm:px-4 md:px-6">
        {/* Brand */}
        <Link
          to="/home"
          className="flex items-center gap-2 shrink-0 rounded-md px-1.5 py-1 hover:bg-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="home-brand"
          aria-label="ObjectStack"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="h-4 w-4" />
          </div>
          <span className="hidden sm:inline text-sm font-semibold tracking-tight">
            ObjectStack
          </span>
        </Link>

        {/* Search */}
        <button
          onClick={openCommandPalette}
          className="hidden lg:flex relative items-center gap-2 ml-auto w-72 xl:w-96 h-8 px-3 text-sm rounded-md border bg-muted/40 text-muted-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="home-search-trigger"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left truncate">
            {t('console.searchRich', {
              defaultValue: 'Search apps, objects, records…',
            })}
          </span>
          <kbd className="pointer-events-none inline-flex h-5 items-center gap-0.5 rounded border bg-background px-1.5 text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>

        {/* Trailing icon cluster */}
        <div className="ml-auto lg:ml-2 flex items-center gap-0.5 sm:gap-1 shrink-0">
          {/* Search — mobile/tablet */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8 shrink-0"
            onClick={openCommandPalette}
            aria-label={t('console.search', { defaultValue: 'Search...' })}
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* Activity */}
          <div className="hidden sm:flex shrink-0 relative">
            <ActivityFeed activities={activities ?? []} />
          </div>

          {/* Help */}
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="h-8 w-8 hidden md:inline-flex shrink-0"
            aria-label={t('sidebar.helpTooltip', {
              defaultValue: 'Help & Documentation',
            })}
          >
            <a
              href="https://docs.objectstack.ai"
              target="_blank"
              rel="noopener noreferrer"
            >
              <HelpCircle className="h-4 w-4" />
            </a>
          </Button>

          <Separator
            orientation="vertical"
            className="hidden sm:block mx-0.5 h-5"
          />

          {/* Theme + Locale */}
          <div className="hidden sm:flex shrink-0">
            <ModeToggle />
          </div>
          <div className="hidden sm:flex shrink-0">
            <LocaleSwitcher />
          </div>

          <Separator
            orientation="vertical"
            className="hidden sm:block mx-0.5 h-5"
          />

          {/* Workspace switcher — self-sizing; collapses when it renders null */}
          <div className="hidden md:flex shrink-0 min-w-0 max-w-52">
            <WorkspaceSwitcher
              onWorkspaceChange={() => {
                // Reload so adapter / permissions re-initialize with the new
                // tenant context, matching the sidebar's prior behavior.
                window.location.href = `${window.location.origin}/console/home`;
              }}
            />
          </div>

          {/* User profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="home-user-menu-trigger"
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage
                    src={user?.image ?? '/avatars/user.jpg'}
                    alt={user?.name ?? 'User'}
                  />
                  <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-xs">
                    {getUserInitials(user)}
                  </AvatarFallback>
                </Avatar>
                <ChevronsUpDown className="hidden md:block h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4} className="w-56">
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      src={user?.image ?? '/avatars/user.jpg'}
                      alt={user?.name ?? 'User'}
                    />
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                      {getUserInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {user?.name ?? 'User'}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email ?? ''}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => navigate('/apps/setup/system/profile')}
                >
                  <UserIcon className="mr-2 h-4 w-4" />
                  {t('user.profile', { defaultValue: 'Profile' })}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/apps/setup')}>
                  <Settings className="mr-2 h-4 w-4" />
                  {t('sidebar.settings', { defaultValue: 'Settings' })}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => signOut()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t('user.logout', { defaultValue: 'Log out' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

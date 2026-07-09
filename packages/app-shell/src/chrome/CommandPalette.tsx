/**
 * CommandPalette
 *
 * A ⌘+K (Ctrl+K) command palette for quick navigation across apps, objects,
 * dashboards, pages, reports, and global actions.
 *
 * Uses Shadcn's Command (cmdk) component — keyboard-accessible, fuzzy search.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@object-ui/components';
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Database,
  Moon,
  Sun,
  Monitor,
  Search,
} from 'lucide-react';
import { useRecordSearch } from '@object-ui/react';
import { useTheme } from './ThemeProvider';
import { useExpressionContext, evaluateVisibility } from '../providers/ExpressionProvider';
import { useObjectTranslation } from '@object-ui/i18n';
import { resolveI18nLabel, getRecordDisplayName, appRouteSegment } from '../utils';
import { getIcon } from '../utils/getIcon';
import { useRecentItems } from '../context/RecentItemsProvider';
import { useCommandPalette } from '../context/CommandPaletteProvider';
import { resolveHref } from '@object-ui/layout';
import { useAuth } from '@object-ui/auth';

interface CommandPaletteProps {
  apps: any[];
  activeApp: any;
  objects: any[];
  onAppChange: (name: string) => void;
  /**
   * Optional data source used to power record search across objects. When
   * omitted, the palette behaves exactly as before — nav items only.
   */
  dataSource?: any;
}

export function CommandPalette({ apps, activeApp, objects, onAppChange, dataSource }: CommandPaletteProps) {
  const { open, setOpen } = useCommandPalette();
  const [inputValue, setInputValue] = useState('');
  const navigate = useNavigate();
  const { appName } = useParams();
  const { setTheme } = useTheme();
  const { evaluator } = useExpressionContext();
  const { t } = useObjectTranslation();

  // The ⌘K / Ctrl+K accelerator and the open-state source of truth now live in
  // CommandPaletteProvider so the keyboard shortcut, the header button, and the
  // ?palette=1 deep-link all drive the SAME idempotent open path (ADR-0054 C1/C3).

  // Reset query when the palette closes so reopening doesn't show stale state.
  useEffect(() => {
    if (!open) setInputValue('');
  }, [open]);

  const baseUrl = `/apps/${appName || appRouteSegment(activeApp)}`;
  const { user, activeOrganization } = useAuth();
  const templateContext = useMemo(
    () => ({ currentUserId: user?.id ?? null, currentOrgId: activeOrganization?.id ?? null }),
    [user?.id, activeOrganization?.id],
  );

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  // Extract navigation items from active app, filtering by visibility expressions
  const navItems = flattenNavigation(activeApp?.navigation || []).filter(
    (item) => evaluateVisibility(item.visible ?? item.visibleOn, evaluator)
  );

  // Whitelist of object names visible in this app's nav — used as the search
  // scope so we don't fan out to every object in the tenant.
  const searchableObjectNames = useMemo(
    () =>
      navItems
        .filter((i) => i.type === 'object' && typeof i.objectName === 'string')
        .map((i) => i.objectName as string),
    // navItems is rebuilt every render (filtered list); use a stable signature.
    [activeApp?.name, navItems.map((i) => i.objectName || '').join('|')],
  );

  const { results: recordHits, isSearching } = useRecordSearch({
    query: inputValue,
    objects,
    dataSource,
    objectNames: searchableObjectNames,
    enabled: open && Boolean(dataSource),
    getDisplayName: getRecordDisplayName,
  });

  // Cloud-synced (sys_user_preference) recently-visited records,
  // surfaced in the empty state so the palette is useful before the
  // user types anything. Filtered down to record-type entries so we
  // don't double up with the per-app nav above.
  const { recentItems } = useRecentItems();
  const recentRecords = useMemo(
    () => recentItems.filter((it) => it.type === 'record').slice(0, 5),
    [recentItems],
  );
  const showRecentRecords = open && inputValue.trim().length === 0 && recentRecords.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      // Accessible name/description (rendered visually-hidden as the required
      // Radix DialogTitle/Description) — gives the dialog a stable ARIA name (C4).
      title={t('console.commandPalette.title', { defaultValue: 'Command palette' })}
      description={t('console.commandPalette.placeholder')}
      contentProps={{
        // Stable locator so the overlay is addressable by an automated driver
        // without relying on i18n-fragile visible text (C4).
        'data-testid': 'overlay:command-palette',
      }}
    >
      <CommandInput
        placeholder={t('console.commandPalette.placeholder')}
        value={inputValue}
        onValueChange={setInputValue}
      />
      <CommandList>
        <CommandEmpty>
          {isSearching ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse"
              />
              {t('console.commandPalette.searching', { defaultValue: 'Searching…' })}
            </span>
          ) : (
            t('console.commandPalette.noResults')
          )}
        </CommandEmpty>

        {/* Recently visited records (cloud-synced via sys_user_preference).
            Only renders when the input is empty so search results don't
            compete with this fallback list. */}
        {showRecentRecords && (
          <CommandGroup
            heading={t('console.commandPalette.recentRecords', { defaultValue: 'Recently viewed' })}
          >
            {recentRecords.map((item) => (
              <CommandItem
                key={`recent:${item.id}`}
                value={`recent ${item.label} ${item.id}`}
                onSelect={() => runCommand(() => navigate(item.href))}
              >
                <Search className="mr-2 h-4 w-4" />
                <span className="truncate">{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Record search — only renders when there are async hits */}
        {recordHits.length > 0 && (
          <CommandGroup
            heading={
              <span className="inline-flex items-center gap-2">
                {t('console.commandPalette.records', { defaultValue: 'Records' })}
                {isSearching && (
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse"
                  />
                )}
              </span>
            }
          >
            {recordHits.map((hit) => {
              const Icon = getIcon(hit.icon);
              return (
                <CommandItem
                  key={`${hit.objectName}:${hit.recordId}`}
                  // Embed the live query so cmdk's client-side filter doesn't
                  // hide async hits that don't textually match the input.
                  value={`record ${inputValue} ${hit.display} ${hit.objectLabel} ${hit.objectName} ${hit.recordId}`}
                  onSelect={() => runCommand(() => navigate(`${baseUrl}/${hit.objectName}/record/${hit.recordId}`))}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span className="truncate">{hit.display}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{hit.objectLabel}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
        {/* Object Navigation */}
        {navItems.filter(i => i.type === 'object').length > 0 && (
          <CommandGroup heading={t('console.commandPalette.objects')}>
            {navItems
              .filter(i => i.type === 'object')
              .map(item => {
                const Icon = getIcon(item.icon);
                return (
                  <CommandItem
                    key={item.id}
                    value={`object ${resolveI18nLabel(item.label, t)} ${item.objectName}`}
                    onSelect={() => runCommand(() => navigate(resolveHref(item, baseUrl, templateContext).href))}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{resolveI18nLabel(item.label, t)}</span>
                  </CommandItem>
                );
              })}
          </CommandGroup>
        )}

        {/* Dashboards */}
        {navItems.filter(i => i.type === 'dashboard').length > 0 && (
          <CommandGroup heading={t('console.commandPalette.dashboards')}>
            {navItems
              .filter(i => i.type === 'dashboard')
              .map(item => (
                <CommandItem
                  key={item.id}
                  value={`dashboard ${resolveI18nLabel(item.label, t)} ${item.dashboardName}`}
                  onSelect={() => runCommand(() => navigate(resolveHref(item, baseUrl, templateContext).href))}
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  <span>{resolveI18nLabel(item.label, t)}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        )}

        {/* Pages */}
        {navItems.filter(i => i.type === 'page').length > 0 && (
          <CommandGroup heading={t('console.commandPalette.pages')}>
            {navItems
              .filter(i => i.type === 'page')
              .map(item => (
                <CommandItem
                  key={item.id}
                  value={`page ${resolveI18nLabel(item.label, t)} ${item.pageName}`}
                  onSelect={() => runCommand(() => navigate(resolveHref(item, baseUrl, templateContext).href))}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>{resolveI18nLabel(item.label, t)}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        )}

        {/* Reports */}
        {navItems.filter(i => i.type === 'report').length > 0 && (
          <CommandGroup heading={t('console.commandPalette.reports')}>
            {navItems
              .filter(i => i.type === 'report')
              .map(item => (
                <CommandItem
                  key={item.id}
                  value={`report ${resolveI18nLabel(item.label, t)} ${item.reportName}`}
                  onSelect={() => runCommand(() => navigate(resolveHref(item, baseUrl, templateContext).href))}
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  <span>{resolveI18nLabel(item.label, t)}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        )}

        {/* App Switching */}
        {apps.filter(a => a.active !== false).length > 1 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t('console.commandPalette.switchApp')}>
              {apps
                .filter(a => a.active !== false)
                .map(app => {
                  const Icon = getIcon(app.icon);
                  return (
                    <CommandItem
                      key={app.name}
                      value={`app ${resolveI18nLabel(app.label, t)} ${app.name}`}
                      onSelect={() => runCommand(() => onAppChange(appRouteSegment(app) ?? app.name))}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      <span>{resolveI18nLabel(app.label, t)}</span>
                      {app.name === activeApp?.name && (
                        <span className="ml-auto text-xs text-muted-foreground">{t('console.commandPalette.current')}</span>
                      )}
                    </CommandItem>
                  );
                })}
            </CommandGroup>
          </>
        )}

        {/* Theme */}
        <CommandSeparator />
        <CommandGroup heading={t('console.commandPalette.preferences')}>
          <CommandItem value="theme light" onSelect={() => runCommand(() => setTheme('light'))}>
            <Sun className="mr-2 h-4 w-4" />
            <span>{t('console.commandPalette.lightTheme')}</span>
          </CommandItem>
          <CommandItem value="theme dark" onSelect={() => runCommand(() => setTheme('dark'))}>
            <Moon className="mr-2 h-4 w-4" />
            <span>{t('console.commandPalette.darkTheme')}</span>
          </CommandItem>
          <CommandItem value="theme system" onSelect={() => runCommand(() => setTheme('system'))}>
            <Monitor className="mr-2 h-4 w-4" />
            <span>{t('console.commandPalette.systemTheme')}</span>
          </CommandItem>
        </CommandGroup>

        {/* Full Search Page */}
        <CommandSeparator />
        <CommandGroup heading={t('console.commandPalette.actions')}>
          {/* Manual "Create App" deprecated — AI-first builder is the path. */}
          <CommandItem
            value="search all results full page"
            onSelect={() => runCommand(() => navigate(`${baseUrl}/search`))}
          >
            <Search className="mr-2 h-4 w-4" />
            <span>{t('console.commandPalette.openFullSearch')}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/** Flatten nested navigation groups into a flat list of leaf items */
function flattenNavigation(items: any[]): any[] {
  const result: any[] = [];
  for (const item of items) {
    if (item.type === 'group' && item.children) {
      result.push(...flattenNavigation(item.children));
    } else {
      result.push(item);
    }
  }
  return result;
}

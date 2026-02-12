/**
 * CommandPalette
 *
 * A ⌘+K (Ctrl+K) command palette for quick navigation across apps, objects,
 * dashboards, pages, reports, and global actions.
 *
 * Uses Shadcn's Command (cmdk) component — keyboard-accessible, fuzzy search.
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
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
import { useTheme } from './theme-provider';
import { useExpressionContext, evaluateVisibility } from '../context/ExpressionProvider';

/** Resolve a Lucide icon by name (kebab-case or PascalCase) */
function getIcon(name?: string): React.ElementType {
  if (!name) return Database;
  if ((LucideIcons as any)[name]) return (LucideIcons as any)[name];
  const pascal = name
    .split('-')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  if ((LucideIcons as any)[pascal]) return (LucideIcons as any)[pascal];
  return Database;
}

interface CommandPaletteProps {
  apps: any[];
  activeApp: any;
  objects: any[];
  onAppChange: (name: string) => void;
}

export function CommandPalette({ apps, activeApp, objects: _objects, onAppChange }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { appName } = useParams();
  const { setTheme } = useTheme();
  const { evaluator } = useExpressionContext();

  // ⌘+K / Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const baseUrl = `/apps/${appName || activeApp?.name}`;

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  // Extract navigation items from active app, filtering by visibility expressions
  const navItems = flattenNavigation(activeApp?.navigation || []).filter(
    (item) => evaluateVisibility(item.visible ?? item.visibleOn, evaluator)
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Object Navigation */}
        {navItems.filter(i => i.type === 'object').length > 0 && (
          <CommandGroup heading="Objects">
            {navItems
              .filter(i => i.type === 'object')
              .map(item => {
                const Icon = getIcon(item.icon);
                return (
                  <CommandItem
                    key={item.id}
                    value={`object ${item.label} ${item.objectName}`}
                    onSelect={() => runCommand(() => navigate(`${baseUrl}/${item.objectName}`))}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{item.label}</span>
                  </CommandItem>
                );
              })}
          </CommandGroup>
        )}

        {/* Dashboards */}
        {navItems.filter(i => i.type === 'dashboard').length > 0 && (
          <CommandGroup heading="Dashboards">
            {navItems
              .filter(i => i.type === 'dashboard')
              .map(item => (
                <CommandItem
                  key={item.id}
                  value={`dashboard ${item.label} ${item.dashboardName}`}
                  onSelect={() => runCommand(() => navigate(`${baseUrl}/dashboard/${item.dashboardName}`))}
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        )}

        {/* Pages */}
        {navItems.filter(i => i.type === 'page').length > 0 && (
          <CommandGroup heading="Pages">
            {navItems
              .filter(i => i.type === 'page')
              .map(item => (
                <CommandItem
                  key={item.id}
                  value={`page ${item.label} ${item.pageName}`}
                  onSelect={() => runCommand(() => navigate(`${baseUrl}/page/${item.pageName}`))}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        )}

        {/* Reports */}
        {navItems.filter(i => i.type === 'report').length > 0 && (
          <CommandGroup heading="Reports">
            {navItems
              .filter(i => i.type === 'report')
              .map(item => (
                <CommandItem
                  key={item.id}
                  value={`report ${item.label} ${item.reportName}`}
                  onSelect={() => runCommand(() => navigate(`${baseUrl}/report/${item.reportName}`))}
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        )}

        {/* App Switching */}
        {apps.filter(a => a.active !== false).length > 1 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Switch App">
              {apps
                .filter(a => a.active !== false)
                .map(app => {
                  const Icon = getIcon(app.icon);
                  return (
                    <CommandItem
                      key={app.name}
                      value={`app ${app.label} ${app.name}`}
                      onSelect={() => runCommand(() => onAppChange(app.name))}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      <span>{app.label}</span>
                      {app.name === activeApp?.name && (
                        <span className="ml-auto text-xs text-muted-foreground">Current</span>
                      )}
                    </CommandItem>
                  );
                })}
            </CommandGroup>
          </>
        )}

        {/* Theme */}
        <CommandSeparator />
        <CommandGroup heading="Preferences">
          <CommandItem value="theme light" onSelect={() => runCommand(() => setTheme('light'))}>
            <Sun className="mr-2 h-4 w-4" />
            <span>Light Theme</span>
          </CommandItem>
          <CommandItem value="theme dark" onSelect={() => runCommand(() => setTheme('dark'))}>
            <Moon className="mr-2 h-4 w-4" />
            <span>Dark Theme</span>
          </CommandItem>
          <CommandItem value="theme system" onSelect={() => runCommand(() => setTheme('system'))}>
            <Monitor className="mr-2 h-4 w-4" />
            <span>System Theme</span>
          </CommandItem>
        </CommandGroup>

        {/* Full Search Page */}
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            value="search all results full page"
            onSelect={() => runCommand(() => navigate(`${baseUrl}/search`))}
          >
            <Search className="mr-2 h-4 w-4" />
            <span>Open Full Search Page</span>
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

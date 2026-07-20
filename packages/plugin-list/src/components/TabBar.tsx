/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {
  cn,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@object-ui/components';
import { icons, ChevronDown, type LucideIcon } from 'lucide-react';

export interface ViewTab {
  name: string;
  label: string;
  icon?: string;
  view?: string;
  filter?: any;
  order?: number;
  pinned?: boolean;
  isDefault?: boolean;
  visible?: string | boolean;
}

export interface TabBarProps {
  tabs: ViewTab[];
  activeTab?: string;
  onTabChange?: (tab: ViewTab) => void;
  className?: string;
}

/**
 * Resolve a kebab-case or lowercase Lucide icon name to a LucideIcon component.
 * E.g. "arrow-right" → ArrowRight, "star" → Star
 */
function resolveIcon(iconName?: string): LucideIcon | null {
  if (!iconName) return null;
  const pascalCase = iconName
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  return (icons as Record<string, LucideIcon>)[pascalCase] ?? null;
}

/**
 * Filter visible tabs: exclude tabs where visible is 'false' or boolean false.
 * Pinned tabs are always included regardless of other filtering.
 */
function getVisibleTabs(tabs: ViewTab[]): ViewTab[] {
  return tabs
    .filter(tab => tab.pinned || (tab.visible !== 'false' && tab.visible !== false))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * TabBar renders a row of view tabs above the ListView toolbar.
 * Supports icons (resolved via Lucide), pinned tabs, isDefault selection,
 * and emits tab changes with filter/sort configuration.
 */
export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTab: controlledActiveTab,
  onTabChange,
  className,
}) => {
  const visibleTabs = React.useMemo(() => getVisibleTabs(tabs), [tabs]);

  // Determine the default tab: first isDefault tab, or first tab
  const defaultTab = React.useMemo(() => {
    const def = visibleTabs.find(t => t.isDefault);
    return def?.name ?? visibleTabs[0]?.name;
  }, [visibleTabs]);

  const [internalActiveTab, setInternalActiveTab] = React.useState<string | undefined>(defaultTab);

  const activeTabName = controlledActiveTab ?? internalActiveTab;

  const handleTabClick = React.useCallback(
    (tab: ViewTab) => {
      setInternalActiveTab(tab.name);
      onTabChange?.(tab);
    },
    [onTabChange],
  );

  if (visibleTabs.length === 0) return null;

  return (
    <div
      className={cn('px-2 sm:px-4 py-1 flex items-center gap-0.5 bg-background', className)}
      data-testid="view-tabs"
      role="tablist"
    >
      {visibleTabs.map(tab => {
        const TabIcon = resolveIcon(tab.icon);
        const isActive = activeTabName === tab.name;
        return (
          <Button
            key={tab.name}
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2.5 py-1 text-xs rounded-md transition-colors duration-150",
              isActive
                ? "font-medium text-foreground bg-muted"
                : "text-muted-foreground hover:text-foreground hover:bg-transparent"
            )}
            data-testid={`view-tab-${tab.name}`}
            role="tab"
            aria-selected={isActive}
            onClick={() => handleTabClick(tab)}
          >
            {TabIcon && <TabIcon className="h-3 w-3 mr-1.5" />}
            {tab.label}
          </Button>
        );
      })}
    </div>
  );
};

/**
 * Mobile-friendly variant of TabBar: a single dropdown button showing the
 * current view name + chevron. Tap → DropdownMenu listing every view.
 *
 * Pair with TabBar via `hidden sm:flex` / `sm:hidden` wrappers so phones get
 * the compact dropdown and wider screens get the inline pill row.
 */
export const TabBarSelect: React.FC<TabBarProps> = ({
  tabs,
  activeTab: controlledActiveTab,
  onTabChange,
  className,
}) => {
  const visibleTabs = React.useMemo(() => getVisibleTabs(tabs), [tabs]);

  const defaultTab = React.useMemo(() => {
    const def = visibleTabs.find(t => t.isDefault);
    return def?.name ?? visibleTabs[0]?.name;
  }, [visibleTabs]);

  const [internalActiveTab, setInternalActiveTab] = React.useState<string | undefined>(defaultTab);
  const activeTabName = controlledActiveTab ?? internalActiveTab;

  const activeTab = React.useMemo(
    () => visibleTabs.find(t => t.name === activeTabName) ?? visibleTabs[0],
    [visibleTabs, activeTabName],
  );

  const handlePick = React.useCallback(
    (tab: ViewTab) => {
      setInternalActiveTab(tab.name);
      onTabChange?.(tab);
    },
    [onTabChange],
  );

  if (visibleTabs.length === 0) return null;

  const ActiveIcon = resolveIcon(activeTab?.icon);

  return (
    <div className={cn('px-2 py-1', className)} data-testid="view-tabs-select">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs font-medium text-foreground gap-1.5 max-w-[60vw] truncate"
            aria-label="Switch view"
          >
            {/* eslint-disable-next-line react-hooks/static-components -- resolveIcon returns a stable lucide icon component from a static registry, not a component created during render */}
            {ActiveIcon && <ActiveIcon className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{activeTab?.label ?? ''}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
          {visibleTabs.map(tab => {
            const TabIcon = resolveIcon(tab.icon);
            const isActive = activeTabName === tab.name;
            return (
              <DropdownMenuItem
                key={tab.name}
                onClick={() => handlePick(tab)}
                className={cn('text-sm', isActive && 'font-medium bg-muted')}
                data-testid={`view-tab-select-${tab.name}`}
              >
                {TabIcon && <TabIcon className="h-3.5 w-3.5 mr-2 shrink-0" />}
                <span className="truncate">{tab.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

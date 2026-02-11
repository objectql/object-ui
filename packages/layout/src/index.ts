/**
 * ObjectUI Layout
 * Copyright (c) 2024-present ObjectStack Inc.
 */

import { ComponentRegistry } from '@object-ui/core';
import { PageHeader } from './PageHeader';
import { AppShell } from './AppShell';
import { Page } from './Page';
import { PageCard } from './PageCard';
import { SidebarNav } from './SidebarNav';
import { ResponsiveGrid } from './ResponsiveGrid';

export * from './PageHeader';
export * from './AppShell';
export * from './Page';
export * from './PageCard';
export * from './SidebarNav';
export * from './ResponsiveGrid';

export function registerLayout() {
  ComponentRegistry.register('page-header', PageHeader, {
      namespace: 'layout',
      label: 'Page Header',
      category: 'Layout',
      inputs: [
          { name: 'title', type: 'string' },
          { name: 'description', type: 'string' }
      ]
  });

  // Alias for protocol compliance
  ComponentRegistry.register('page:header', PageHeader, { namespace: 'layout' });

  // Page Card
  ComponentRegistry.register('page:card', PageCard, {
    namespace: 'layout',
    label: 'Page Card',
    category: 'Layout',
    isContainer: true
  });

  ComponentRegistry.register('app-shell', AppShell, {
    namespace: 'layout',
    label: 'App Shell',
    category: 'Layout',
  });

  ComponentRegistry.register('responsive-grid', ResponsiveGrid, {
    namespace: 'layout',
    label: 'Responsive Grid',
    category: 'Layout',
    isContainer: true,
    inputs: [
      { name: 'columns', type: 'object' },
      { name: 'gap', type: 'number' },
    ],
  });

  // NOTE: 'page' registration is handled by @object-ui/components PageRenderer.
  // That renderer supports page types (record/home/app/utility), named regions,
  // and PageVariablesProvider. Do NOT re-register 'page' here to avoid conflicts.
}

// Keep backward compatibility for now if called directly
try {
  registerLayout();
} catch (e) {
  // Ignore registration errors during build/test cycles
}

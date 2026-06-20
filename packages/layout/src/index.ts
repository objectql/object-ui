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
import { NavigationRenderer } from './NavigationRenderer';
import { AppSchemaRenderer } from './AppSchemaRenderer';

export * from './PageHeader';
export * from './AppShell';
export * from './Page';
export * from './PageCard';
export * from './SidebarNav';
export * from './ResponsiveGrid';
export * from './NavigationRenderer';
export * from './AppSchemaRenderer';

export function registerLayout() {
  // Legacy `page-header` alias. Kept for any consumer schemas that still
  // reference the kebab-cased ID; the canonical renderer lives in
  // `@object-ui/components` under the protocol-compliant `page:header`
  // namespace. We intentionally do NOT re-register `page:header` here —
  // doing so would (depending on package load order) clobber the
  // record-aware renderer in components with this thinner one.
  ComponentRegistry.register('page-header', PageHeader, {
      namespace: 'layout',
      label: 'Page Header',
      category: 'Layout',
      inputs: [
          { name: 'title', type: 'string' },
          { name: 'description', type: 'string' }
      ]
  });

  // Page Card — register ONLY as `layout:page:card`. `skipFallback` keeps this
  // thin div from clobbering the bare `page:card` key, which belongs to the
  // record-aware PageCardRenderer in @object-ui/components (it renders
  // title/body/children; this one only renders React children and would
  // otherwise leak schema props onto the DOM). Same rationale as `page-header`.
  ComponentRegistry.register('page:card', PageCard, {
    namespace: 'layout',
    skipFallback: true,
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

  ComponentRegistry.register('navigation-renderer', NavigationRenderer, {
    namespace: 'layout',
    label: 'Navigation Renderer',
    category: 'Layout',
    inputs: [
      { name: 'items', type: 'object' },
      { name: 'basePath', type: 'string' },
    ],
  });

  ComponentRegistry.register('app-schema-renderer', AppSchemaRenderer, {
    namespace: 'layout',
    label: 'App Schema Renderer',
    category: 'Layout',
    isContainer: true,
    inputs: [
      { name: 'schema', type: 'object' },
      { name: 'basePath', type: 'string' },
      { name: 'mobileNavMode', type: 'string' },
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

/**
 * ObjectUI Layout
 * Copyright (c) 2024-present ObjectStack Inc.
 */

import { ComponentRegistry } from '@object-ui/core';
import { PageHeader } from './PageHeader';
import { AppShell } from './AppShell';
import { Page } from './Page';

export * from './PageHeader';
export * from './AppShell';
export * from './Page';

export function registerLayout() {
  ComponentRegistry.register('page-header', PageHeader, {
      label: 'Page Header',
      category: 'Layout',
      inputs: [
          { name: 'title', type: 'string' },
          { name: 'description', type: 'string' }
      ]
  });

  ComponentRegistry.register('app-shell', AppShell, {
      label: 'App Shell',
      category: 'Layout',
  });

  // Core Page Renderer
  ComponentRegistry.register('page', Page, {
    label: 'Standard Page',
    category: 'Layout',
    isContainer: true
  });
}

// Keep backward compatibility for now if called directly
try {
  registerLayout();
} catch (e) {
  // Ignore registration errors during build/test cycles
}

'use client';

// Import components to trigger registration
import { initializeComponents } from '@object-ui/components';
import { ComponentRegistry } from '@object-ui/core';
import { useEffect } from 'react';

// Import plugins to register their component types
import '@object-ui/plugin-editor';
import '@object-ui/plugin-charts';
import '@object-ui/plugin-kanban';
import '@object-ui/plugin-markdown';

export function ObjectUIProvider({ children }: { children: React.ReactNode }) {
  // Explicitly call init to ensure components are registered
  useEffect(() => {
    initializeComponents();
    // Log registered components for debugging
    const componentTypes = ComponentRegistry.getAllTypes();
    console.log('[ObjectUIProvider] Registered components:', componentTypes);
  }, []);
  
  return <>{children}</>;
}

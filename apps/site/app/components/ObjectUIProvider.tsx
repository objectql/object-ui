'use client';

// Import components to trigger registration
import { initializeComponents } from '@object-ui/components';
import { ComponentRegistry } from '@object-ui/core';
import { useEffect } from 'react';

// Dynamically import plugins only in browser context (not during SSR)
if (typeof window !== 'undefined') {
  import('@object-ui/plugin-editor');
  import('@object-ui/plugin-charts');
  import('@object-ui/plugin-kanban');
  import('@object-ui/plugin-markdown');
}

export function ObjectUIProvider({ children }: { children: React.ReactNode }) {
  // Explicitly call init to ensure components are registered
  useEffect(() => {
    initializeComponents();
    
    // Wait a bit for plugins to register, then log
    setTimeout(() => {
      const componentTypes = ComponentRegistry.getAllTypes();
      console.log('[ObjectUIProvider] Registered components:', componentTypes);
    }, 100);
  }, []);
  
  return <>{children}</>;
}

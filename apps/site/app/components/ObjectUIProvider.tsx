'use client';

// Import components to trigger registration
import { initializeComponents } from '@object-ui/components';
import { ComponentRegistry } from '@object-ui/core';
import { useEffect } from 'react';

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

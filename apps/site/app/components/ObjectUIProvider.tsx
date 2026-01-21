'use client';

import { useEffect } from 'react';
import { registerDefaultRenderers } from '@object-ui/components';

export function ObjectUIProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Register all default ObjectUI components
    registerDefaultRenderers();
  }, []);

  return <>{children}</>;
}

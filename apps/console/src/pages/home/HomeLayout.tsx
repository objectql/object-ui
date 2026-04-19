/**
 * HomeLayout
 *
 * Unified Home (workspace) landing page layout.
 *
 * Unlike the in-app shell at `/apps/:appName/*`, the Home page uses a
 * **top navigation bar only** (`HomeTopNav`) and deliberately omits the
 * left sidebar. This clearly separates the workspace landing page from
 * individual applications that *do* use `AppShell` + `UnifiedSidebar`.
 *
 * @module
 */

import React, { useEffect } from 'react';
import { useNavigationContext } from '../../context/NavigationContext';
import { HomeTopNav } from './HomeTopNav';

interface HomeLayoutProps {
  children: React.ReactNode;
}

export function HomeLayout({ children }: HomeLayoutProps) {
  const { setContext } = useNavigationContext();

  // Set navigation context to 'home' when this layout mounts so that
  // shared services (breadcrumbs, recent items, etc.) know we are on
  // the workspace landing page.
  useEffect(() => {
    setContext('home');
  }, [setContext]);

  return (
    <div className="flex min-h-svh w-full flex-col bg-background" data-testid="home-layout">
      <HomeTopNav />
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}

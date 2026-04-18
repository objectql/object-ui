/**
 * HomeLayout
 *
 * Unified Home Dashboard layout with persistent sidebar.
 * Uses AppShell + UnifiedSidebar for Airtable-style contextual navigation.
 * The sidebar displays Home-context navigation (workspace-level items).
 *
 * @module
 */

import React, { useEffect } from 'react';
import { AppShell } from '@object-ui/layout';
import { useObjectTranslation } from '@object-ui/i18n';
import { UnifiedSidebar } from '../../components/UnifiedSidebar';
import { AppHeader } from '../../components/AppHeader';
import { useNavigationContext } from '../../context/NavigationContext';
import { useResponsiveSidebar } from '../../hooks/useResponsiveSidebar';

interface HomeLayoutProps {
  children: React.ReactNode;
}

/** Inner component that can access SidebarProvider context */
function HomeLayoutInner({ children }: { children: React.ReactNode }) {
  useResponsiveSidebar();
  return <>{children}</>;
}

export function HomeLayout({ children }: HomeLayoutProps) {
  const { setContext } = useNavigationContext();
  const { t } = useObjectTranslation();

  // Set navigation context to 'home' when this layout mounts
  useEffect(() => {
    setContext('home');
  }, [setContext]);

  return (
    <AppShell
      sidebar={<UnifiedSidebar />}
      navbar={
        <AppHeader
          appName={t('home.nav', { defaultValue: 'Home' })}
          objects={[]}
          connectionState="connected"
        />
      }
      className="p-0 overflow-hidden bg-muted/5"
    >
      <HomeLayoutInner>
        {children}
      </HomeLayoutInner>
    </AppShell>
  );
}

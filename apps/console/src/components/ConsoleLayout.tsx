/**
 * ConsoleLayout
 *
 * Root layout shell for the console application. Composes the AppShell
 * with the sidebar, header, and main content area.
 * @module
 */

import React from 'react';
import { AppShell } from '@object-ui/layout';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { useResponsiveSidebar } from '../hooks/useResponsiveSidebar';
import { resolveI18nLabel } from '../utils';
import type { ConnectionState } from '../dataSource';

interface ConsoleLayoutProps {
  children: React.ReactNode;
  activeAppName: string;
  activeApp: any;
  onAppChange: (name: string) => void;
  objects: any[];
  connectionState?: ConnectionState;
}

/** Inner component that can access SidebarProvider context */
function ConsoleLayoutInner({ children }: { children: React.ReactNode }) {
  useResponsiveSidebar();
  return <>{children}</>;
}

export function ConsoleLayout({ 
  children, 
  activeAppName, 
  activeApp,
  onAppChange,
  objects,
  connectionState
}: ConsoleLayoutProps) {
  return (
    <AppShell
      sidebar={
         <AppSidebar 
           activeAppName={activeAppName} 
           onAppChange={onAppChange} 
         />
      }
      navbar={
          <AppHeader 
            appName={resolveI18nLabel(activeApp?.label) || activeAppName} 
            objects={objects}
            connectionState={connectionState}
          />
      }
      className="p-0 overflow-hidden bg-muted/5"
      branding={
        activeApp?.branding
          ? {
              primaryColor: activeApp.branding.primaryColor,
              accentColor: activeApp.branding.accentColor,
              favicon: activeApp.branding.favicon,
              logo: activeApp.branding.logo,
              title: activeApp.label
                ? `${resolveI18nLabel(activeApp.label)} — ObjectStack Console`
                : undefined,
            }
          : undefined
      }
    >
      <ConsoleLayoutInner>
        {children}
      </ConsoleLayoutInner>
    </AppShell>
  );
}

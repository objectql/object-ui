import React from 'react';
import { AppShell } from '@object-ui/layout';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';

interface ConsoleLayoutProps {
  children: React.ReactNode;
  activeAppName: string;
  activeApp: any;
  onAppChange: (name: string) => void;
  objects: any[];
}

export function ConsoleLayout({ 
  children, 
  activeAppName, 
  activeApp,
  onAppChange,
  objects 
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
            appName={activeApp?.label || activeAppName} 
            objects={objects} 
          />
      }
    >
      {children}
    </AppShell>
  );
}

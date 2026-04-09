/**
 * ConsoleLayout
 *
 * Root layout shell for the console application. Composes the AppShell
 * with the UnifiedSidebar, header, and main content area.
 * Includes the global floating chatbot (FAB) widget.
 * Sets navigation context to 'app' for app-specific routes.
 * @module
 */

import React, { useEffect } from 'react';
import { AppShell } from '@object-ui/layout';
import { FloatingChatbot, useObjectChat, type ChatMessage } from '@object-ui/plugin-chatbot';
import { useDiscovery } from '@object-ui/react';
import { UnifiedSidebar } from './UnifiedSidebar';
import { AppHeader } from './AppHeader';
import { useResponsiveSidebar } from '../hooks/useResponsiveSidebar';
import { useNavigationContext } from '../context/NavigationContext';
import { resolveI18nLabel } from '../utils';
import type { ConnectionState } from '../dataSource';

/** Minimal object shape used by the chatbot context */
interface ConsoleObject {
  name: string;
  label?: string;
}

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

/** Floating chatbot wired with useObjectChat for demo auto-response */
function ConsoleFloatingChatbot({ appLabel, objects }: { appLabel: string; objects: ConsoleObject[] }) {
  const objectNames = objects.map((o) => o.label || o.name).join(', ');

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    stop,
    reload,
    clear,
  } = useObjectChat({
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant' as const,
        content: `Hello! I'm your **${appLabel}** assistant. How can I help you today?`,
      },
    ],
    autoResponse: true,
    autoResponseText: objectNames
      ? `I can help you work with ${objectNames}. What would you like to do?`
      : 'Thanks for your message! I\'m here to help you navigate and manage your data.',
    autoResponseDelay: 800,
  });

  return (
    <FloatingChatbot
      floatingConfig={{
        position: 'bottom-right',
        defaultOpen: false,
        panelWidth: 400,
        panelHeight: 520,
        title: `${appLabel} Assistant`,
        triggerSize: 56,
      }}
      messages={messages as ChatMessage[]}
      placeholder="Ask anything..."
      onSendMessage={(content: string) => sendMessage(content)}
      onClear={clear}
      onStop={isLoading ? stop : undefined}
      onReload={reload}
      isLoading={isLoading}
      error={error}
      enableMarkdown
    />
  );
}

export function ConsoleLayout({
  children,
  activeAppName,
  activeApp,
  onAppChange,
  objects,
  connectionState
}: ConsoleLayoutProps) {
  const appLabel = resolveI18nLabel(activeApp?.label) || activeAppName;
  const { isAiEnabled } = useDiscovery();
  const { setContext, setCurrentAppName } = useNavigationContext();

  // Set navigation context to 'app' when this layout mounts
  useEffect(() => {
    setContext('app');
    setCurrentAppName(activeAppName);
  }, [setContext, setCurrentAppName, activeAppName]);

  return (
    <AppShell
      sidebar={
         <UnifiedSidebar
           activeAppName={activeAppName}
           onAppChange={onAppChange}
         />
      }
      navbar={
          <AppHeader
            appName={appLabel}
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

      {/* Global floating chatbot — rendered only when AI service is available */}
      {isAiEnabled && <ConsoleFloatingChatbot appLabel={appLabel} objects={objects} />}
    </AppShell>
  );
}

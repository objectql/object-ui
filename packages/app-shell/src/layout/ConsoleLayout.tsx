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
import { useDiscovery } from '@object-ui/react';

// Lightweight FAB stub — the heavy chat chunk graph (plugin-chatbot,
// shiki, streamdown, mermaid, @ai-sdk, ~20MB) only downloads on first
// hover/click. See ConsoleChatbotFab.tsx.
import { ConsoleChatbotFab } from './ConsoleChatbotFab';
import { DraftPreviewBar } from '../preview/DraftPreviewBar';
import { UnifiedSidebar } from './UnifiedSidebar';
import { AppHeader } from './AppHeader';
import { MobileViewSwitcherProvider } from './MobileViewSwitcherContext';
import { useResponsiveSidebar } from '../hooks/useResponsiveSidebar';
import { useNavigationContext } from '../context/NavigationContext';
import { resolveI18nLabel } from '../utils';
import { getProductName, getRuntimeConfig } from '../runtime-config';
import type { ConnectionState } from '@object-ui/data-objectstack';

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
  /**
   * Signed-in user id. Forwarded to the floating chatbot so it can hydrate
   * server-backed conversation history. Omit for unauthenticated/local-only.
   */
  userId?: string;
}

/** Inner component that can access SidebarProvider context */
function ConsoleLayoutInner({ children }: { children: React.ReactNode }) {
  useResponsiveSidebar();
  return <>{children}</>;
}

/** Floating chatbot wired with useObjectChat for demo auto-response */
// (moved to ./ConsoleFloatingChatbot.tsx for code-splitting)

export function ConsoleLayout({
  children,
  activeAppName,
  activeApp,
  onAppChange,
  objects,
  connectionState,
  userId,
}: ConsoleLayoutProps) {
  const appLabel = resolveI18nLabel(activeApp?.label) || activeAppName;
  const { isAiEnabled } = useDiscovery();
  // Trust an explicit `VITE_AI_BASE_URL` opt-in even when discovery reports
  // AI as disabled (e.g. framework started without `--preset full`).
  const aiBaseUrlConfigured = Boolean(import.meta.env?.VITE_AI_BASE_URL);
  const showChatbot = isAiEnabled || aiBaseUrlConfigured;
  // AI Studio (AI-driven metadata authoring / "online development") can be
  // turned off per deployment. When off, suppress the metadata-authoring
  // assistant so the chatbot falls back to the generic data assistant — the
  // generic data-chat experience stays available.
  const aiStudioEnabled = getRuntimeConfig().features.aiStudio !== false;
  const effectiveDefaultAgent =
    !aiStudioEnabled && activeApp?.defaultAgent === 'metadata_assistant'
      ? undefined
      : activeApp?.defaultAgent;
  const { setContext, setCurrentAppName } = useNavigationContext();

  // Set navigation context to 'app' when this layout mounts
  useEffect(() => {
    setContext('app');
    setCurrentAppName(activeAppName);
  }, [setContext, setCurrentAppName, activeAppName]);

  return (
    <MobileViewSwitcherProvider>
    <AppShell
      sidebar={
         <UnifiedSidebar
           activeAppName={activeAppName}
           onAppChange={onAppChange}
         />
      }
      navbar={
          <AppHeader
            variant="app"
            appName={appLabel}
            objects={objects}
            connectionState={connectionState}
            activeAppName={activeAppName}
            onAppChange={onAppChange}
          />
      }
      className="!p-0 overflow-y-auto overflow-x-hidden bg-muted/5"
      branding={
        activeApp?.branding
          ? {
              primaryColor: activeApp.branding.primaryColor,
              accentColor: activeApp.branding.accentColor,
              favicon: activeApp.branding.favicon,
              logo: activeApp.branding.logo,
              title: activeApp.label
                ? `${resolveI18nLabel(activeApp.label)} — ${getProductName()}`
                : undefined,
            }
          : undefined
      }
    >
      <ConsoleLayoutInner>
        {/* ADR-0037: unmistakable watermark while rendering the draft overlay
            (?preview=draft) — with one-click exit and one-click Publish. */}
        <DraftPreviewBar />
        {children}
      </ConsoleLayoutInner>

      {/* Global floating chatbot — rendered when AI service is available
          OR when `VITE_AI_BASE_URL` has been explicitly configured. The
          stub FAB is dependency-free; the heavy chat bundle only loads
          on first interaction. */}
      {showChatbot && (
        <ConsoleChatbotFab
          appLabel={appLabel}
          appName={activeAppName}
          defaultAgent={effectiveDefaultAgent}
          objects={objects}
          userId={userId}
        />
      )}
    </AppShell>
    </MobileViewSwitcherProvider>
  );
}

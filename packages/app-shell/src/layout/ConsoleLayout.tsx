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

// Lightweight FAB stub — the heavy chat chunk graph (plugin-chatbot,
// shiki, streamdown, mermaid, @ai-sdk, ~20MB) only downloads on first
// hover/click. See ConsoleChatbotFab.tsx.
import { ConsoleChatbotFab } from './ConsoleChatbotFab';
import { DraftPreviewBar } from '../preview/DraftPreviewBar';
import { UnpublishedAppBar } from '../preview/UnpublishedAppBar';
import { UnifiedSidebar } from './UnifiedSidebar';
import { AppHeader } from './AppHeader';
import { MobileViewSwitcherProvider } from './MobileViewSwitcherContext';
import { useResponsiveSidebar } from '../hooks/useResponsiveSidebar';
import { useAiSurfaceEnabled } from '../hooks/useAiSurface';
import { useNavigationContext } from '../context/NavigationContext';
import { CommandPaletteProvider } from '../context/CommandPaletteProvider';
import { resolveI18nLabel } from '../utils';
import { getProductName } from '../runtime-config';
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
  // Runtime, server-pushed AI gating (shared with the `/ai` route guard and the
  // top-bar AI link): show the chatbot only when the server actually serves AI,
  // or when an explicit `VITE_AI_BASE_URL` opt-in points at an external server.
  const { enabled: showChatbot } = useAiSurfaceEnabled();
  // ADR-0057 P2: the AI-Studio-off downgrade (a `build` default falls back to
  // `ask` when authoring is deployment-disabled) is no longer spelled here — it
  // is folded into the ONE `resolveSurfaceAgent` resolver, which the FAB applies
  // to the raw `app.defaultAgent` below. This was the special case that existed
  // nowhere else; it now lives in exactly one place.
  const { setContext, setCurrentAppName } = useNavigationContext();

  // Set navigation context to 'app' when this layout mounts
  useEffect(() => {
    setContext('app');
    setCurrentAppName(activeAppName);
  }, [setContext, setCurrentAppName, activeAppName]);

  return (
    // One shared, URL-addressable command-palette open state for both the
    // AppHeader trigger (navbar) and the CommandPalette (children) — ADR-0054.
    <CommandPaletteProvider>
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
        {/* ADR-0045: materialized-but-unlisted app — real and interactive,
            invisible to end users until the Publish visibility flip. */}
        <UnpublishedAppBar />
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
          defaultAgent={activeApp?.defaultAgent}
          objects={objects}
          userId={userId}
        />
      )}
    </AppShell>
    </MobileViewSwitcherProvider>
    </CommandPaletteProvider>
  );
}

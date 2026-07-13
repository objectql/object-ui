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
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@object-ui/layout';

// Lightweight FAB stub — the heavy chat chunk graph (plugin-chatbot,
// shiki, streamdown, mermaid, @ai-sdk, ~20MB) only downloads on first
// hover/click. See ConsoleChatbotFab.tsx.
import { ConsoleChatbotFab } from './ConsoleChatbotFab';
import { useChatDockState, ChatDockPanel } from './ChatDock';
import { matchChatDockShortcut, DOCK_EXPANDED_STORAGE_KEY } from './chatDockState';
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

  // ADR-0057 P3a — the right-docked chat rail. DEFAULT OFF: gated on the
  // `chatDock` rollout flag AND the same AI-surface gate as the FAB, so it is
  // strictly additive and renders nothing on OSS / opt-out runtimes. P3c: the
  // expanded state round-trips through sessionStorage so the rail survives
  // in-tab navigation, and so the `/ai` page's collapse-to-dock affordance can
  // arm it before navigating back here (the maximize ⇄ tuck loop).
  const dock = useChatDockState({ persistExpandedKey: DOCK_EXPANDED_STORAGE_KEY });
  const dockEnabled = showChatbot && getRuntimeConfig().features.chatDock === true;
  const navigate = useNavigate();

  // Set navigation context to 'app' when this layout mounts
  useEffect(() => {
    setContext('app');
    setCurrentAppName(activeAppName);
  }, [setContext, setCurrentAppName, activeAppName]);

  // ⌘/Ctrl+Shift+I toggles the dock (composer-safe; see matchChatDockShortcut).
  useEffect(() => {
    if (!dockEnabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (matchChatDockShortcut(e) !== 'toggle') return;
      e.preventDefault();
      dock.toggle();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dockEnabled, dock]);

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
      rightRail={
        dockEnabled && dock.expanded ? (
          <ChatDockPanel
            dock={dock}
            userId={userId}
            // ADR-0057 P3c — "/ai = the dock maximized": the maximize button
            // opens the full-page surface, which canonicalizes `/ai` to the
            // default agent and resolves the same app-less `(user, product)`
            // scope — i.e. THE SAME THREAD this rail shows. (A deployment that
            // overrides the default agent via VITE_AI_DEFAULT_AGENT could in
            // principle diverge from the dock's `resolveSurfaceAgent('default')`
            // pick; both funnel through the same platform default today.)
            onMaximize={() => navigate('/ai')}
          />
        ) : undefined
      }
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
          // ADR-0057 P3b — when the dock is enabled, the FAB becomes its
          // launcher (opens the rail) instead of the floating overlay. This
          // supersedes P3a's edge launcher: the dock is gated on `showChatbot`,
          // so the FAB is always present to launch it.
          onOpenDock={dockEnabled ? dock.expand : undefined}
        />
      )}
    </AppShell>
    </MobileViewSwitcherProvider>
    </CommandPaletteProvider>
  );
}

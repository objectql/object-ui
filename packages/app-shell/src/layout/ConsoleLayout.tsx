/**
 * ConsoleLayout
 *
 * Root layout shell for the console application. Composes the AppShell
 * with the UnifiedSidebar, header, and main content area.
 * Includes the global floating chatbot (FAB) widget.
 * Sets navigation context to 'app' for app-specific routes.
 * @module
 */

import React, { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@object-ui/layout';
import { useIsMobile } from '@object-ui/components';

// Lightweight FAB stub — the heavy chat chunk graph (plugin-chatbot,
// shiki, streamdown, mermaid, @ai-sdk, ~20MB) only downloads on first
// hover/click. See ConsoleChatbotFab.tsx.
import { ConsoleChatbotFab } from './ConsoleChatbotFab';
import { useChatDockState, ChatDockPanel, ChatDockMobileSheet } from './ChatDock';
import {
  matchChatDockShortcut,
  rememberDockReturnLocation,
  DOCK_EXPANDED_STORAGE_KEY,
} from './chatDockState';
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
  // is folded into the ONE `resolveSurfaceAgent` resolver, applied to the raw
  // `app.defaultAgent` below. This was the special case that existed nowhere
  // else; it now lives in exactly one place.
  const { setContext, setCurrentAppName } = useNavigationContext();

  // ADR-0057 P3 — the right-docked chat rail, the console's canonical chat
  // presentation (rollout complete; the FAB below is its launcher). Gated on
  // the same AI-surface signal as every entry point, so it renders nothing on
  // OSS / agent-less runtimes. The expanded state round-trips through
  // sessionStorage so the rail survives in-tab navigation, and so the `/ai`
  // page's collapse-to-dock affordance can arm it before navigating back here
  // (the maximize ⇄ tuck loop).
  const dock = useChatDockState({ persistExpandedKey: DOCK_EXPANDED_STORAGE_KEY });
  const dockEnabled = showChatbot;
  const navigate = useNavigate();
  const location = useLocation();
  // Under `md` there is no horizontal room for the rail — the dock presents as
  // a bottom sheet instead (same conversation, chrome only). The hook (not the
  // rail's `hidden md:` classes alone) decides which one MOUNTS, so the phone
  // never pays for an invisible rail's chat graph.
  const isMobile = useIsMobile();
  // "/ai = the dock maximized": record where we maximized FROM at click time,
  // so the page's collapse-to-dock returns exactly here (history-back could
  // land on a prior /ai URL after in-page conversation switches).
  const openDockFullPage = useCallback(() => {
    rememberDockReturnLocation(`${location.pathname}${location.search}`);
    navigate('/ai');
  }, [location.pathname, location.search, navigate]);

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
        dockEnabled && dock.expanded && !isMobile ? (
          <ChatDockPanel
            dock={dock}
            userId={userId}
            // The dock honors the app's own default agent exactly like the FAB
            // did — through the ONE resolver (bounded to ask/build there).
            defaultAgent={activeApp?.defaultAgent}
            // ADR-0057 P3c — "/ai = the dock maximized": the maximize button
            // opens the full-page surface, which canonicalizes `/ai` to the
            // default agent and resolves the same `(user, product)` scope —
            // i.e. THE SAME THREAD this rail shows.
            onMaximize={openDockFullPage}
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

      {/* The dock's launcher — rendered when AI service is available OR when
          `VITE_AI_BASE_URL` has been explicitly configured. Dependency-free;
          the chat graph loads with the dock, on demand. */}
      {showChatbot && <ConsoleChatbotFab appLabel={appLabel} onOpenDock={dock.expand} />}

      {/* Under `md` the FAB opens the dock as a bottom sheet (no room for a
          rail on a phone) — same conversation, chrome only. */}
      {dockEnabled && isMobile && (
        <ChatDockMobileSheet
          open={dock.expanded}
          onOpenChange={(open) => (open ? dock.expand() : dock.collapse())}
          userId={userId}
          defaultAgent={activeApp?.defaultAgent}
          // Bridge to full-page /ai (history + share live there on mobile). The
          // sheet defers the navigation until it has cleanly closed.
          onMaximize={openDockFullPage}
        />
      )}
    </AppShell>
    </MobileViewSwitcherProvider>
    </CommandPaletteProvider>
  );
}

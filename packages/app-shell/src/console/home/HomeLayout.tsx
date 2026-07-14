/**
 * HomeLayout
 *
 * Home (workspace) landing layout. Uses the unified `AppHeader` top bar in
 * `home` variant so that `/home` shares chrome with the rest of the console;
 * deliberately omits the sidebar.
 *
 * @module
 */

import React, { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNavigationContext } from '../../context/NavigationContext';
import { AppHeader } from '../../layout/AppHeader';
import { useAiSurfaceEnabled } from '../../hooks/useAiSurface';
import { useObjectTranslation } from '@object-ui/i18n';

// The ChatDock's launcher (dependency-free button).
import { ConsoleChatbotFab } from '../../layout/ConsoleChatbotFab';
import { rememberDockReturnLocation } from '../../layout/chatDockState';

interface HomeLayoutProps {
  children: React.ReactNode;
  /**
   * Signed-in user id. Kept for API stability (callers pass it); the full-page
   * chat surface resolves the user itself via useAuth.
   */
  userId?: string;
}

export function HomeLayout({ children }: HomeLayoutProps) {
  const { setContext } = useNavigationContext();
  const { t } = useObjectTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  // ADR-0057: Home has no AppShell to host the docked rail, so its FAB opens
  // the full-page surface — which IS the dock maximized, same thread. The
  // origin is remembered so `/ai`'s collapse-to-dock lands back here.
  const openAssistant = useCallback(() => {
    rememberDockReturnLocation(`${location.pathname}${location.search}`);
    navigate('/ai');
  }, [location.pathname, location.search, navigate]);
  // Render the chatbot only when the server serves AI (or an explicit
  // `VITE_AI_BASE_URL` opt-in is set) — same runtime signal as the rest of the
  // console's AI surface. See useAiSurfaceEnabled.
  const { enabled: showChatbot } = useAiSurfaceEnabled();

  useEffect(() => {
    setContext('home');
  }, [setContext]);

  return (
    <div className="flex min-h-svh w-full flex-col bg-background" data-testid="home-layout">
      <header className="sticky top-0 z-30 flex h-14 w-full shrink-0 items-center gap-2 border-b bg-background px-2 sm:px-4">
        <AppHeader variant="home" />
      </header>
      <main className="flex-1 min-w-0 overflow-auto pb-20 sm:pb-0">
        {children}
      </main>

      {/* Assistant entry on the home/workspace screen — opens the full-page
          chat (the dock maximized; Home has no shell to dock a rail into). */}
      {showChatbot && (
        <ConsoleChatbotFab
          appLabel={t('workspace.default', { defaultValue: 'Workspace' })}
          onOpenDock={openAssistant}
        />
      )}
    </div>
  );
}

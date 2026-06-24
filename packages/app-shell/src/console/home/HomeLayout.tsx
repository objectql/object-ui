/**
 * HomeLayout
 *
 * Home (workspace) landing layout. Uses the unified `AppHeader` top bar in
 * `home` variant so that `/home` shares chrome with the rest of the console;
 * deliberately omits the sidebar.
 *
 * @module
 */

import React, { useEffect } from 'react';
import { useNavigationContext } from '../../context/NavigationContext';
import { AppHeader } from '../../layout/AppHeader';
import { useAiSurfaceEnabled } from '../../hooks/useAiSurface';
import { useObjectTranslation } from '@object-ui/i18n';

// Lightweight FAB stub — the heavy chat chunk graph only downloads on
// first hover/click. See ../../layout/ConsoleChatbotFab.tsx.
import { ConsoleChatbotFab } from '../../layout/ConsoleChatbotFab';

interface HomeLayoutProps {
  children: React.ReactNode;
  /**
   * Signed-in user id. Forwarded to the floating chatbot so it can hydrate
   * server-backed conversation history.
   */
  userId?: string;
}

export function HomeLayout({ children, userId }: HomeLayoutProps) {
  const { setContext } = useNavigationContext();
  const { t } = useObjectTranslation();
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

      {/* Global floating chatbot — also available on the home/workspace
          screen. Stub FAB is dependency-free; the heavy chat bundle only
          loads on first interaction. */}
      {showChatbot && <ConsoleChatbotFab appLabel={t('workspace.default', { defaultValue: 'Workspace' })} objects={[]} userId={userId} />}
    </div>
  );
}

/**
 * ConsoleChatbotFab
 *
 * Lightweight FAB proxy for the console's floating AI assistant.
 *
 * Before any interaction this component renders a small, zero-dependency
 * button (~1KB). On first hover/focus it speculatively warms the heavy
 * chat chunk graph (plugin-chatbot → streamdown → shiki → mermaid →
 * @ai-sdk, ~20MB); on first click it lazy-mounts `<ConsoleFloatingChatbot
 * defaultOpen />` which takes over (its own FAB replaces this stub).
 *
 * Net effect: every console page-load no longer pays the chat-bundle
 * cost just for the FAB to be visible — those bytes only download when
 * the user actually opens (or hovers) the assistant.
 *
 * @module
 */
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useAssistant } from '../assistant/assistantBus';
import { useObjectTranslation } from '@object-ui/i18n';

const ConsoleFloatingChatbot = lazy(() => import('./ConsoleFloatingChatbot'));
const prefetchChatbot = () => {
  void import('./ConsoleFloatingChatbot');
};

import type { ConsoleFloatingChatbotProps } from './ConsoleFloatingChatbot';

export type ConsoleChatbotFabProps = ConsoleFloatingChatbotProps & {
  /**
   * ADR-0057 P3b — when the ChatDock is enabled, the FAB becomes the dock's
   * LAUNCHER: a click (and a designer "Ask AI" open signal) opens the docked
   * rail instead of arming the floating overlay, and the heavy floating chatbot
   * is never mounted (the dock owns the chat). Absent → unchanged floating-FAB
   * behavior.
   */
  onOpenDock?: () => void;
};

export function ConsoleChatbotFab({ onOpenDock, ...props }: ConsoleChatbotFabProps) {
  const [armed, setArmed] = useState(false);
  const { t } = useObjectTranslation();

  // A designer surface can ask the assistant to open (e.g. an "Ask AI"
  // button) via the assistant bus — arming the lazy chatbot just like a
  // click does. Once armed, the chatbot's own trigger owns open/close.
  // When the dock is the target (P3b), the open signal opens the dock instead.
  const { openSeq } = useAssistant();
  const seenOpenSeq = useRef(openSeq);
  useEffect(() => {
    if (openSeq !== seenOpenSeq.current) {
      seenOpenSeq.current = openSeq;
      if (onOpenDock) onOpenDock();
      else setArmed(true);
    }
  }, [openSeq, onOpenDock]);

  // Dock mode (P3b): stay the lightweight launcher — never mount the floating
  // overlay; the click opens the rail, which loads the chat on demand.
  if (armed && !onOpenDock) {
    return (
      <Suspense fallback={null}>
        <ConsoleFloatingChatbot {...props} defaultOpen />
      </Suspense>
    );
  }

  return (
    <button
      type="button"
      aria-label={t('topbar.openAssistant', { defaultValue: 'Open {{name}} assistant', name: props.appLabel })}
      onClick={() => (onOpenDock ? onOpenDock() : setArmed(true))}
      onMouseEnter={onOpenDock ? undefined : prefetchChatbot}
      onFocus={onOpenDock ? undefined : prefetchChatbot}
      className="fixed bottom-20 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/20 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:bottom-6"
      data-testid="console-chatbot-fab"
    >
      {/* Inline SVG — no lucide-react import here, FAB stays dependency-free. */}
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3v3" />
        <path d="M12 18v3" />
        <path d="M5.6 5.6l2.1 2.1" />
        <path d="M16.3 16.3l2.1 2.1" />
        <path d="M3 12h3" />
        <path d="M18 12h3" />
        <path d="M5.6 18.4l2.1-2.1" />
        <path d="M16.3 7.7l2.1-2.1" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  );
}

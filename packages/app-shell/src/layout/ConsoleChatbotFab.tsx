/**
 * ConsoleChatbotFab
 *
 * The console AI assistant's launcher — a small, zero-dependency floating
 * button that opens the ChatDock (ADR-0057: the dock is the canonical chat
 * presentation; this button is its collapsed affordance, the familiar
 * bottom-right entry point that survived the P3 reflow).
 *
 * History: this used to be a lazy proxy that armed a ~20MB floating-overlay
 * chat (`ConsoleFloatingChatbot`) on click. P3b re-pointed it at the dock
 * behind the `chatDock` flag; the final ADR-0057 cleanup removed the overlay
 * path (and the flag) entirely — the dock loads the chat graph on demand, so
 * the FAB stays dependency-free.
 *
 * @module
 */
import React, { useEffect, useRef } from 'react';
import { useAssistant } from '../assistant/assistantBus';
import { useObjectTranslation } from '@object-ui/i18n';

export interface ConsoleChatbotFabProps {
  /** Product/app label for the accessible name. */
  appLabel: string;
  /** Open the ChatDock (rail on desktop, bottom sheet under `md`). */
  onOpenDock: () => void;
}

export function ConsoleChatbotFab({ appLabel, onOpenDock }: ConsoleChatbotFabProps) {
  const { t } = useObjectTranslation();

  // A designer surface can ask the assistant to open (e.g. an "Ask AI"
  // button) via the assistant bus — same effect as clicking the FAB.
  const { openSeq } = useAssistant();
  const seenOpenSeq = useRef(openSeq);
  useEffect(() => {
    if (openSeq !== seenOpenSeq.current) {
      seenOpenSeq.current = openSeq;
      onOpenDock();
    }
  }, [openSeq, onOpenDock]);

  return (
    <button
      type="button"
      aria-label={t('topbar.openAssistant', { defaultValue: 'Open {{name}} assistant', name: appLabel })}
      onClick={onOpenDock}
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

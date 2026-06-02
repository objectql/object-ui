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

const ConsoleFloatingChatbot = lazy(() => import('./ConsoleFloatingChatbot'));
const prefetchChatbot = () => {
  void import('./ConsoleFloatingChatbot');
};

import type { ConsoleFloatingChatbotProps } from './ConsoleFloatingChatbot';

export type ConsoleChatbotFabProps = ConsoleFloatingChatbotProps;

export function ConsoleChatbotFab(props: ConsoleChatbotFabProps) {
  const [armed, setArmed] = useState(false);

  // A designer surface can ask the assistant to open (e.g. an "Ask AI"
  // button) via the assistant bus — arming the lazy chatbot just like a
  // click does. Once armed, the chatbot's own trigger owns open/close.
  const { openSeq } = useAssistant();
  const seenOpenSeq = useRef(openSeq);
  useEffect(() => {
    if (openSeq !== seenOpenSeq.current) {
      seenOpenSeq.current = openSeq;
      setArmed(true);
    }
  }, [openSeq]);

  if (armed) {
    return (
      <Suspense fallback={null}>
        <ConsoleFloatingChatbot {...props} defaultOpen />
      </Suspense>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Open ${props.appLabel} assistant`}
      onClick={() => setArmed(true)}
      onMouseEnter={prefetchChatbot}
      onFocus={prefetchChatbot}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/20 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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

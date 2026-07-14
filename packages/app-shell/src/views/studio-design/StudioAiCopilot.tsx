// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@object-ui/auth';
import { useIsMobile } from '@object-ui/components';
import { useAgents } from '@object-ui/plugin-chatbot';
import { useChatConversation } from '../../hooks/useChatConversation';
import { chatConversationScope, chatProductOfAgent } from '../../hooks/chatScope';
import { resolveSurfaceAgent } from '../../hooks/surfaceAgent';
import { ChatPane, resolveApiBase, type PendingFirstMessage } from '../../console/ai/AiChatPage';
import {
  ChatDockPanel,
  ChatDockLauncher,
  ChatDockMobileSheet,
  useChatDockState,
} from '../../layout/ChatDock';
import { rememberDockReturnLocation } from '../../layout/chatDockState';

interface StudioCopilotConversationProps {
  /** The package the Studio surface is editing — scopes the build agent to it. */
  packageId: string;
  /** ADR-0037/P3c — the Live Canvas open/close seam, forwarded to ChatPane. */
  onCanvasOpenChange?: (open: boolean) => void;
}

/**
 * The Studio copilot's chat body — the build agent scoped to the package being
 * designed, over the ADR-0057 P1 `(user, app, product)` conversation, hosted by
 * {@link StudioChatDock} in the shared dock chrome. Renders nothing when the AI
 * catalog is empty (community edition / no seat) — callers that add chrome
 * around it must apply the same gate so no empty shell renders.
 */
export function StudioCopilotConversation({
  packageId,
  onCanvasOpenChange,
}: StudioCopilotConversationProps): React.ReactElement | null {
  const { user } = useAuth();
  const userId = user?.id;
  const apiBase = React.useMemo(() => resolveApiBase(), []);

  const { agents, isLoading: agentsLoading, error: agentsError } = useAgents({ apiBase });

  // ADR-0057 P2: the Studio authoring surface resolves through the ONE
  // declarative resolver (`studio-build` → build, else platform default), not a
  // local `isBuildAgent` pick. Same result, single source of truth.
  const activeAgent = React.useMemo(
    () => resolveSurfaceAgent('studio-build', { agents }),
    [agents],
  );

  const chatApi = activeAgent
    ? `${apiBase}/agents/${encodeURIComponent(activeAgent)}/chat`
    : undefined;

  // One durable conversation per (user, app, product) — ADR-0057. Keyed on the
  // PACKAGE and PRODUCT, not on this surface, so reopening the same app's design
  // chat in the full-page `/ai/build?package=…` focus view resumes THIS thread
  // (no `studio:` fork). See {@link chatConversationScope}.
  const { conversationId, initialMessages } = useChatConversation({
    userId: activeAgent ? userId : undefined,
    scope: activeAgent
      ? chatConversationScope({ appId: packageId, product: chatProductOfAgent(activeAgent) })
      : undefined,
    apiBase,
    activeId: undefined,
    forceNew: false,
  });

  const pendingFirstMessageRef = React.useRef<PendingFirstMessage | null>(null);

  // No agent served (community edition / misconfigured) → no copilot, plain surface.
  if (!agentsLoading && agents.length === 0) return null;

  return (
    <ChatPane
      key={`${chatApi ?? 'local'}:${conversationId ?? 'pending'}`}
      agents={agents}
      agentsLoading={agentsLoading}
      agentsError={agentsError}
      activeAgent={activeAgent}
      chatApi={chatApi}
      apiBase={apiBase}
      conversationId={conversationId}
      editPackageId={packageId}
      initialMessages={initialMessages}
      pendingFirstMessageRef={pendingFirstMessageRef}
      onSent={() => {}}
      onShare={() => {}}
      showDebug={false}
      onCanvasOpenChange={onCanvasOpenChange}
    />
  );
}

// (The legacy LEFT copilot panel that used to live here was removed by the
// final ADR-0057 cleanup — the right dock below is the copilot's one home.
// The cloud `aiSlot` seam in StudioDesignSurface still accepts an injected
// left panel.)

export interface StudioChatDockProps {
  /** The package the Studio surface is editing — scopes the build agent to it. */
  packageId: string;
  /** UI locale (from the Studio surface) for the dock chrome. */
  locale?: string;
}

/**
 * ADR-0057 P3c — the Studio copilot rendered as the shared RIGHT dock (the
 * ADR's decided grid: `[left: nav/tree] [center: canvas + properties] [right:
 * chat]`). Same conversation as the left copilot it replaces (the P1
 * `(user, package, build)` scope), in the same {@link ChatDockPanel} chrome as
 * the console rail.
 *
 * Differences from the console rail, on purpose:
 *  - Default EXPANDED (the copilot has always been visible by default) and
 *    NOT persisted (parity with the old panel's in-memory collapse).
 *  - Collapsed state = the {@link ChatDockLauncher} edge button — Studio has
 *    no FAB to double as the launcher.
 *  - Maximize opens `/ai/build?package=…`, which resumes THIS thread (the
 *    scope is keyed on the package, not the surface).
 *  - The Live Canvas auto-maximizes the rail on open, tucks on close
 *    (ADR-0037 — the preview needs more width than the rail has).
 */
export function StudioChatDock({ packageId, locale }: StudioChatDockProps): React.ReactElement | null {
  const zh = (locale ?? '').toLowerCase().startsWith('zh');
  const navigate = useNavigate();
  const location = useLocation();
  const apiBase = React.useMemo(() => resolveApiBase(), []);
  const dock = useChatDockState({ defaultExpanded: true });
  // Under `md` the copilot presents as a bottom sheet (there is no horizontal
  // room for a rail). Its open state is LOCAL — a phone must not inherit the
  // desktop "expanded by default" posture, or the sheet would cover the Studio
  // on every load.
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // The catalog gate lives HERE (not in ChatDockPanel): the `children` body
  // override below bypasses the panel's default self-gating conversation.
  const { agents, isLoading: agentsLoading } = useAgents({ apiBase });

  const handleCanvasOpenChange = React.useCallback(
    (open: boolean) => (open ? dock.maximize() : dock.restore()),
    [dock.maximize, dock.restore],
  );

  // Record where we maximized FROM so the `/ai` page's collapse-to-dock
  // returns to THIS Studio surface, not to some console page.
  const openFullPage = React.useCallback(() => {
    rememberDockReturnLocation(`${location.pathname}${location.search}`);
    navigate(`/ai/build?package=${encodeURIComponent(packageId)}`);
  }, [location.pathname, location.search, navigate, packageId]);

  if (!agentsLoading && agents.length === 0) return null;

  if (isMobile) {
    return (
      <>
        <ChatDockLauncher
          onExpand={() => setMobileOpen(true)}
          className="inline-flex md:hidden"
        />
        <ChatDockMobileSheet
          open={mobileOpen}
          onOpenChange={setMobileOpen}
          title={zh ? 'AI 副驾' : 'AI copilot'}
        >
          <StudioCopilotConversation packageId={packageId} />
        </ChatDockMobileSheet>
      </>
    );
  }

  if (!dock.expanded) {
    return <ChatDockLauncher onExpand={dock.expand} />;
  }

  return (
    <ChatDockPanel
      dock={dock}
      title={zh ? 'AI 副驾' : 'AI copilot'}
      onMaximize={openFullPage}
    >
      <StudioCopilotConversation
        packageId={packageId}
        onCanvasOpenChange={handleCanvasOpenChange}
      />
    </ChatDockPanel>
  );
}

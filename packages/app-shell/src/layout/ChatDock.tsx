/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * ADR-0057 P3a — the ChatDock: the console AI chat rendered as a right-docked,
 * collapsible, resizable rail (the VS Code / Cursor idiom) that REFLOWS the main
 * content beside it (via {@link AppShell}'s `rightRail`), rather than overlaying
 * it like the FAB. Additive and DEFAULT-OFF (`features.chatDock`): until an
 * operator opts in, none of this renders and the FAB stays the canonical entry.
 *
 * It reuses the shared {@link ChatPane} engine over the P1 `(user, app, product)`
 * conversation — the same thread the full-page `/ai` surface shows — so the dock
 * is a VIEW, not a new conversation. P3b later retires the FAB into this dock's
 * launcher; P3c makes `/ai` the dock maximized.
 */
import * as React from 'react';
import { cn, Button } from '@object-ui/components';
import { MessagesSquare, PanelRightClose } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import { useAgents } from '@object-ui/plugin-chatbot';
import { ChatPane, resolveApiBase, type PendingFirstMessage } from '../console/ai/AiChatPage';
import { useChatConversation } from '../hooks';
import { chatConversationScope, chatProductOfAgent } from '../hooks/chatScope';
import { resolveSurfaceAgent } from '../hooks/surfaceAgent';
import { getRuntimeConfig } from '../runtime-config';
import {
  clampDockWidth,
  DOCK_DEFAULT_WIDTH,
  DOCK_WIDTH_STORAGE_KEY,
} from './chatDockState';

function readStoredWidth(): number {
  try {
    const raw = window.localStorage.getItem(DOCK_WIDTH_STORAGE_KEY);
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DOCK_DEFAULT_WIDTH;
  } catch {
    return DOCK_DEFAULT_WIDTH;
  }
}

export interface ChatDockState {
  expanded: boolean;
  width: number;
  dragging: boolean;
  toggle: () => void;
  expand: () => void;
  collapse: () => void;
  /** Pointer-down on the rail's left-edge resize handle. */
  onResizePointerDown: (e: React.PointerEvent) => void;
}

/**
 * ChatDock open/collapsed + width state. Default COLLAPSED — the dock has zero
 * layout cost until invoked (preserving the FAB's virtue of not reflowing dense
 * data grids). Width persists to localStorage; the drag anchors the rail's LEFT
 * edge (dragging left widens it). All DOM reads happen in handlers, never render.
 */
export function useChatDockState(): ChatDockState {
  const [expanded, setExpanded] = React.useState(false);
  const [width, setWidth] = React.useState<number>(() => readStoredWidth());
  const [dragging, setDragging] = React.useState(false);

  const onResizePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = width;
      setDragging(true);
      const onMove = (ev: PointerEvent) => {
        // Rail is right-anchored: dragging the left edge LEFT (clientX shrinks)
        // widens it, so the delta is (start − current).
        const next = clampDockWidth(startWidth + (startX - ev.clientX), window.innerWidth);
        setWidth(next);
      };
      const onUp = (ev: PointerEvent) => {
        const final = clampDockWidth(startWidth + (startX - ev.clientX), window.innerWidth);
        try {
          window.localStorage.setItem(DOCK_WIDTH_STORAGE_KEY, String(Math.round(final)));
        } catch {
          /* private mode — width just won't persist */
        }
        setDragging(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [width],
  );

  const toggle = React.useCallback(() => setExpanded((v) => !v), []);
  const expand = React.useCallback(() => setExpanded(true), []);
  const collapse = React.useCallback(() => setExpanded(false), []);

  return { expanded, width, dragging, toggle, expand, collapse, onResizePointerDown };
}

interface ChatDockConversationProps {
  userId: string | undefined;
  apiBase: string;
}

/**
 * The dock's chat body — resolves the ambient `ask` agent + its P1 conversation
 * and mounts the shared {@link ChatPane}. Mirrors StudioAiCopilot's minimal
 * embed, but on the `default` (ask) surface with an app-less scope, so it shows
 * the console's ambient assistant thread. Renders nothing when the AI catalog is
 * empty (OSS / no seat).
 */
function ChatDockConversation({ userId, apiBase }: ChatDockConversationProps) {
  const { agents, isLoading, error } = useAgents({ apiBase });
  const activeAgent = React.useMemo(
    () =>
      resolveSurfaceAgent('default', {
        agents,
        aiStudioEnabled: getRuntimeConfig().features.aiStudio !== false,
      }),
    [agents],
  );
  const chatApi = activeAgent
    ? `${apiBase}/agents/${encodeURIComponent(activeAgent)}/chat`
    : undefined;
  const scope = activeAgent
    ? chatConversationScope({ appId: undefined, product: chatProductOfAgent(activeAgent) })
    : undefined;
  const { conversationId, initialMessages } = useChatConversation({
    userId: activeAgent ? userId : undefined,
    scope,
    apiBase,
    activeId: undefined,
    forceNew: false,
  });
  const pendingFirstMessageRef = React.useRef<PendingFirstMessage | null>(null);

  // OSS / no AI seat → the whole dock body is inert (the launcher is gated too).
  if (!isLoading && agents.length === 0) return null;

  return (
    <ChatPane
      key={`${chatApi ?? 'local'}:${conversationId ?? 'pending'}`}
      agents={agents}
      agentsLoading={isLoading}
      agentsError={error}
      activeAgent={activeAgent}
      chatApi={chatApi}
      apiBase={apiBase}
      conversationId={conversationId}
      initialMessages={initialMessages}
      pendingFirstMessageRef={pendingFirstMessageRef}
      onSent={() => {}}
      onShare={() => {}}
      showDebug={false}
    />
  );
}

export interface ChatDockPanelProps {
  dock: ChatDockState;
  userId: string | undefined;
  apiBase?: string;
}

/**
 * The expanded rail — pass into {@link AppShell} `rightRail` so it reflows the
 * main content. Only render this when `dock.expanded` (the caller decides), so a
 * collapsed dock contributes no flex child.
 */
export function ChatDockPanel({ dock, userId, apiBase: apiBaseProp }: ChatDockPanelProps) {
  const { t } = useObjectTranslation();
  const apiBase = React.useMemo(() => resolveApiBase(apiBaseProp), [apiBaseProp]);
  return (
    <aside
      data-testid="chat-dock-panel"
      style={{ width: dock.width }}
      className="relative hidden h-full shrink-0 flex-col border-l bg-background md:flex"
    >
      {/* Left-edge resize handle. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t('console.ai.dock.resize', { defaultValue: 'Resize chat' })}
        onPointerDown={dock.onResizePointerDown}
        className={cn(
          'absolute left-0 top-0 z-10 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/40',
          dock.dragging && 'bg-primary/50',
        )}
      />
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
          <MessagesSquare className="size-3.5" />
          {t('console.ai.dock.title', { defaultValue: 'Assistant' })}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={dock.collapse}
          aria-label={t('console.ai.dock.collapse', { defaultValue: 'Collapse chat' })}
          data-testid="chat-dock-collapse"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <ChatDockConversation userId={userId} apiBase={apiBase} />
      </div>
    </aside>
  );
}

export interface ChatDockLauncherProps {
  onExpand: () => void;
}

/**
 * The collapsed affordance — a fixed edge button that expands the dock. Rendered
 * only while collapsed, so it never overlaps the expanded rail. (P3b will fold
 * the FAB into this launcher; for P3a they coexist behind the flag.)
 */
export function ChatDockLauncher({ onExpand }: ChatDockLauncherProps) {
  const { t } = useObjectTranslation();
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onExpand}
      data-testid="chat-dock-launcher"
      aria-label={t('console.ai.dock.open', { defaultValue: 'Open assistant' })}
      title={t('console.ai.dock.open', { defaultValue: 'Open assistant (⌘⇧I)' })}
      className="fixed right-0 top-1/2 z-40 hidden h-16 w-7 -translate-y-1/2 rounded-l-md rounded-r-none border-r-0 bg-background shadow-md md:inline-flex"
    >
      <MessagesSquare className="size-4" />
    </Button>
  );
}

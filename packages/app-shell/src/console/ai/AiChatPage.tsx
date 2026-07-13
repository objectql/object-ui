// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * AiChatPage — full-page ChatGPT-style AI surface.
 *
 * Mounted at `/ai` (new chat) and `/ai/:conversationId` (resume an existing
 * conversation). Left rail lists the signed-in user's `ai_conversations`;
 * right pane embeds `ChatbotEnhanced` wired to
 * `POST /api/v1/ai/agents/:name/chat`.
 *
 * Auto-persist is handled server-side in `@objectstack/service-ai`: as long
 * as the request body carries `conversationId`, the user + assistant + tool
 * turns are appended to `ai_messages` automatically.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import { toast } from 'sonner';
import { useAdapter } from '../../providers/AdapterProvider';
import { ExcelImportBar } from './ExcelImportBar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
  Button,
  ShareDialog,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Empty,
  EmptyTitle,
  EmptyDescription,
  cn,
} from '@object-ui/components';
import { Bug, PanelLeft, PanelLeftClose, PanelLeftOpen, Share2 } from 'lucide-react';
import {
  ChatbotEnhanced,
  useAgents,
  useObjectChat,
  useAiModels,
  useHitlInChat,
  resolveDefaultAgentName,
  PLATFORM_DEFAULT_AGENT,
  agentRouteName,
  resolveAgentParam,
  isBuiltinAgentName,
  isBuildAgent,
  isAskAgent,
  publishHealthFromResponse,
  detectDraftResult,
  detectProposedPlan,
  buildProgressFromDraftReview,
  type AgentDescriptor,
  type ChatbotEnhancedToolInvocation,
  type ChatMessage,
} from '@object-ui/plugin-chatbot';

import { AppHeader } from '../../layout/AppHeader';
import { fetchPendingDraftCount } from '../../preview/draftStatus';
import { emitMetadataRefresh } from '../../assistant/assistantBus';
import { getRuntimeConfig } from '../../runtime-config';
import { cloudPricingDeepLink } from '../marketplace/marketplaceApi';
import { useNavigationContext } from '../../context/NavigationContext';
import {
  fetchConversation,
  sanitizeChatMessagesForCache,
  useChatConversation,
  writeConversationMessagesCache,
  type HydratedUIMessage,
  type HydratedUIMessagePart,
} from '../../hooks/useChatConversation';
import { useReconcileOnError } from '../../hooks/useReconcileOnError';
import { chatConversationScope, chatProductOfAgent } from '../../hooks/chatScope';
import { ConversationsSidebar } from './ConversationsSidebar';
import { LiveCanvas } from './LiveCanvas';
import { BuildDebugDrawer } from './BuildDebugDrawer';
import { isConversationZh } from './conversationLanguage';

const DEFAULT_AI_PATH = '/api/v1/ai';

function partString(part: HydratedUIMessagePart, key: string): string | undefined {
  const value = part[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function partToolState(part: HydratedUIMessagePart): ChatbotEnhancedToolInvocation['state'] | undefined {
  const state = partString(part, 'state');
  switch (state) {
    // Hydrated history is never a live stream: the turn that drove these
    // tools has ENDED, so a dangling mid-stream state means the terminal
    // state was never snapshotted server-side — promote to Completed or a
    // reloaded build conversation shows every tool "Running" forever (the
    // same incident mapMessages fixed for the floating-chat path).
    case 'input-streaming':
    case 'input-available':
      return 'output-available';
    case 'approval-requested':
    case 'approval-responded':
    case 'output-available':
    case 'output-error':
    case 'output-denied':
      return state;
    default:
      // No state at all: server-side conversations persist ModelMessage
      // `tool-call` content entries, which carry no UI state — contentToParts
      // passes them through as `tool-call` parts verbatim. In hydrated
      // history that turn has ended too, so stateless ≡ completed; returning
      // undefined here leaves the invocation state-less and the chip renders
      // "Running" forever (the live-verified gap left by the first fix).
      return 'output-available';
  }
}

/** Exported for tests — maps persisted/cached history to renderable messages. */
export function hydratedMessagesToChatMessages(messages: HydratedUIMessage[]): ChatMessage[] {
  return messages.map((message) => {
    const toolInvocations: ChatbotEnhancedToolInvocation[] = [];
    let buildProgress: ReturnType<typeof buildProgressFromDraftReview>;
    const content = message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text ?? '')
      .join('');

    if (message.role === 'assistant') {
      for (const part of message.parts) {
        if (!part.type.startsWith('tool-')) continue;
        const toolName = partString(part, 'toolName') ?? part.type.slice('tool-'.length);
        const toolCallId = partString(part, 'toolCallId') ?? `${message.id}-${toolName}`;
        const state = partToolState(part);
        // The tool RESULT (merged onto the call part by toUIMessages from the
        // separate `tool` row) carries the ADR-0033 draft envelope. Rebuild
        // `draftReview` so the publish / preview / review affordances return,
        // and synthesize the "Built X" panel so the blueprint summary survives
        // a refresh (the live progress bar is transient and not persisted).
        const result =
          (part as { output?: unknown }).output ?? (part as { result?: unknown }).result;
        const draftReview = detectDraftResult(result);
        // The pre-build PLAN (propose_blueprint → blueprint_proposed) rides the
        // same merged tool result; lift it so the "Proposed plan" review card
        // survives a reload on this surface, not just in the floating chat.
        const proposedPlan = detectProposedPlan(result);
        toolInvocations.push({
          toolCallId,
          toolName,
          ...(state ? { state } : {}),
          ...(result !== undefined ? { result } : {}),
          ...(draftReview ? { draftReview } : {}),
          ...(proposedPlan ? { proposedPlan } : {}),
          ...(part.errorText ? { errorText: String(part.errorText) } : {}),
        });
        if (!buildProgress) {
          const synthesized = buildProgressFromDraftReview(draftReview);
          if (synthesized) buildProgress = synthesized;
        }
      }
    }

    return {
      id: message.id,
      role: message.role,
      content,
      ...(toolInvocations.length > 0 ? { toolInvocations } : {}),
      ...(buildProgress ? { buildProgress } : {}),
    };
  });
}

function firstUserMessageText(messages: HydratedUIMessage[]): string | undefined {
  const message = messages.find((item) => item.role === 'user');
  const text = message?.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('')
    .trim();
  return text || undefined;
}

// Keyed by the FRIENDLY agent name (alias-group head) so the new id, the legacy
// id, and the route segment all localize to the same label.
const PLATFORM_AGENT_LABEL_KEYS: Record<string, { key: string; defaultValue: string }> = {
  ask: { key: 'console.ai.agentLabels.ask', defaultValue: 'Ask' },
  build: { key: 'console.ai.agentLabels.build', defaultValue: 'Build' },
};

function localizeAgentLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  agentName: string | undefined,
  fallback: string,
): string {
  const known = agentName ? PLATFORM_AGENT_LABEL_KEYS[agentRouteName(agentName)] : undefined;
  if (!known) return fallback;
  return t(known.key, { defaultValue: known.defaultValue });
}

/**
 * Per-surface empty-state branding. The split gives each assistant its own
 * identity: the Build surface reads as authoring ("describe an app"), the Ask
 * surface as data Q&A ("ask about your records"). Keyed by friendly name; falls
 * back to the generic empty state for custom agents.
 */
function agentEmptyState(
  t: (key: string, options?: Record<string, unknown>) => string,
  agentName: string | undefined,
): { title: string; description: string } {
  if (isBuildAgent(agentName)) {
    return {
      title: t('console.ai.empty.build.title', { defaultValue: 'Build with AI' }),
      description: t('console.ai.empty.build.description', {
        defaultValue:
          'Describe an app or workflow in plain language — I draft the objects, screens and automations, then you review and publish.',
      }),
    };
  }
  if (isAskAgent(agentName)) {
    return {
      title: t('console.ai.empty.ask.title', { defaultValue: 'Ask your data' }),
      description: t('console.ai.empty.ask.description', {
        defaultValue:
          'Ask questions about your records — counts, lists, and summaries across the data you can access.',
      }),
    };
  }
  return {
    title: t('console.ai.emptyTitle', { defaultValue: 'Start a conversation' }),
    description: t('console.ai.emptyDescription', {
      defaultValue: 'Ask anything — the assistant has access to your current app context.',
    }),
  };
}

export function resolveApiBase(explicit?: string): string {
  if (explicit) return explicit.replace(/\/$/, '');
  const env = (import.meta as any).env ?? {};
  const fromEnv = env.VITE_AI_BASE_URL as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const serverUrl = (env.VITE_SERVER_URL as string | undefined) ?? '';
  return `${serverUrl.replace(/\/$/, '')}${DEFAULT_AI_PATH}`;
}

export interface AiChatPageProps {
  /** Override the resolved AI service base URL. */
  apiBase?: string;
  /** Default agent to select on first render. */
  defaultAgent?: string;
}

const CHATS_COLLAPSED_STORAGE_KEY = 'ai-chats-collapsed';

export interface CollapsibleChatsList {
  /** Whether the desktop conversations list is currently hidden. */
  collapsed: boolean;
  /** User-driven collapse/expand; persists the preference and takes manual control. */
  toggle: () => void;
  /** Wire to the preview pane: auto-tucks the list when it opens, restores on close. */
  handleCanvasOpenChange: (open: boolean) => void;
}

/**
 * State for the collapsible desktop conversations list. Exported for tests.
 *
 * Two drivers, one rule — never fight the user:
 *  - **Manual** `toggle()` flips it and PERSISTS the preference (localStorage),
 *    and marks the user as having taken control.
 *  - **Auto** `handleCanvasOpenChange(open)` tucks the list away when the Live
 *    Canvas preview opens (the chat + preview split is tight) and restores it on
 *    close — but ONLY if the auto-collapse is what hid it. A manual toggle (or a
 *    list the user already collapsed) is never overridden, and auto-collapse is
 *    transient (not persisted).
 */
export function useCollapsibleChatsList(): CollapsibleChatsList {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CHATS_COLLAPSED_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const autoCollapsedRef = useRef(false);

  const toggle = useCallback(() => {
    autoCollapsedRef.current = false; // an explicit toggle is the user taking control
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CHATS_COLLAPSED_STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* private mode / disabled storage — preference just won't persist */
      }
      return next;
    });
  }, []);

  const handleCanvasOpenChange = useCallback((open: boolean) => {
    if (open) {
      setCollapsed((prev) => {
        if (!prev) {
          autoCollapsedRef.current = true;
          return true;
        }
        return prev; // already collapsed (manual) — leave it, don't claim it
      });
    } else if (autoCollapsedRef.current) {
      autoCollapsedRef.current = false;
      setCollapsed(false);
    }
  }, []);

  return { collapsed, toggle, handleCanvasOpenChange };
}

const CHAT_PANE_WIDTH_STORAGE_KEY = 'ai-chat-pane-width';
/** Default chat-column width (px) when the preview opens. */
const CHAT_PANE_DEFAULT_WIDTH = 480;
/** Chat column never narrower than this. */
const CHAT_PANE_MIN_WIDTH = 360;
/** Preview pane always keeps at least this much room (caps how wide chat can grow). */
const CHAT_PREVIEW_MIN_WIDTH = 420;
/** Keyboard resize step (px) when the divider is focused. */
const CHAT_PANE_KEYBOARD_STEP = 24;

/**
 * Clamp a desired chat-column width so neither pane collapses: at least
 * `min`, and never so wide that the preview drops below `previewMin`. Pure +
 * exported for tests. `containerWidth <= 0` (unmeasured) skips the upper bound.
 */
export function clampChatPaneWidth(
  desired: number,
  opts: { min: number; previewMin: number; containerWidth: number },
): number {
  const upper = opts.containerWidth > 0 ? Math.max(opts.min, opts.containerWidth - opts.previewMin) : Infinity;
  return Math.min(Math.max(desired, opts.min), upper);
}

interface ResizableChatPane {
  /** Current chat-column width in px (clamped). */
  width: number;
  /** True while a drag is in progress (for cursor/overlay styling). */
  dragging: boolean;
  /** Ref for the split container — measures available width to bound the preview. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Start a pointer drag from the divider. */
  onHandlePointerDown: (e: React.PointerEvent) => void;
  /** Keyboard resize (←/→) when the divider is focused. */
  onHandleKeyDown: (e: React.KeyboardEvent) => void;
  /** Reset to the default width (double-click the divider). */
  reset: () => void;
}

/**
 * Draggable width for the chat column when the Live Canvas preview is open
 * (ChatGPT/Claude-style split). Width persists; drags and keyboard nudges are
 * clamped against the live container so the preview always keeps room, and a
 * ResizeObserver re-clamps when the window shrinks. All DOM reads happen in
 * handlers/effects, never during render.
 */
export function useResizableChatPane(active: boolean): ResizableChatPane {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(CHAT_PANE_WIDTH_STORAGE_KEY));
      return Number.isFinite(saved) && saved > 0 ? saved : CHAT_PANE_DEFAULT_WIDTH;
    } catch {
      return CHAT_PANE_DEFAULT_WIDTH;
    }
  });
  const [dragging, setDragging] = useState(false);

  const clampToContainer = useCallback(
    (desired: number) =>
      clampChatPaneWidth(desired, {
        min: CHAT_PANE_MIN_WIDTH,
        previewMin: CHAT_PREVIEW_MIN_WIDTH,
        containerWidth: containerRef.current?.clientWidth ?? 0,
      }),
    [],
  );

  const persist = useCallback((w: number) => {
    try {
      localStorage.setItem(CHAT_PANE_WIDTH_STORAGE_KEY, String(Math.round(w)));
    } catch {
      /* storage disabled — width just won't persist */
    }
  }, []);

  // Re-clamp when the available width changes (window resize, sidebar collapse),
  // so a previously-saved wide chat can't starve the preview.
  useEffect(() => {
    if (!active) return;
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth((w) => clampToContainer(w)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [active, clampToContainer]);

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = width; // state is the style source, so it == the rendered width
      setDragging(true);
      const onMove = (ev: PointerEvent) => setWidth(clampToContainer(startWidth + (ev.clientX - startX)));
      const onUp = (ev: PointerEvent) => {
        const final = clampToContainer(startWidth + (ev.clientX - startX));
        setWidth(final);
        persist(final);
        setDragging(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [clampToContainer, persist, width],
  );

  const onHandleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const delta = e.key === 'ArrowLeft' ? -CHAT_PANE_KEYBOARD_STEP : e.key === 'ArrowRight' ? CHAT_PANE_KEYBOARD_STEP : 0;
      if (!delta) return;
      e.preventDefault();
      setWidth((w) => {
        const next = clampToContainer(w + delta);
        persist(next);
        return next;
      });
    },
    [clampToContainer, persist],
  );

  const reset = useCallback(() => {
    const next = clampToContainer(CHAT_PANE_DEFAULT_WIDTH);
    setWidth(next);
    persist(next);
  }, [clampToContainer, persist]);

  return { width, dragging, containerRef, onHandlePointerDown, onHandleKeyDown, reset };
}

export type AiChatShortcut = 'toggle-list' | 'new-chat';

/**
 * Match a keydown to an AI-chat shortcut, mirroring ChatGPT/Claude:
 *  - ⌘/Ctrl+Shift+O → new chat
 *  - ⌘/Ctrl+Shift+S → toggle the conversations list
 *
 * Both use the ⌘/Ctrl+Shift modifier so they're safe to fire even while the
 * composer is focused (they can't be produced by ordinary typing). Pure +
 * exported for tests.
 */
export function matchAiChatShortcut(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): AiChatShortcut | null {
  if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || e.altKey) return null;
  switch (e.key.toLowerCase()) {
    case 'o':
      return 'new-chat';
    case 's':
      return 'toggle-list';
    default:
      return null;
  }
}

/** A composer submission held until the conversation id that will carry it exists. */
export interface PendingFirstMessage {
  content: string;
  files?: File[];
}

/**
 * Guards the empty-state FIRST send against the conversation-id remount race.
 *
 * On a fresh `/ai/:agent` the composer (and its suggestion chips) go live the
 * instant the agent resolves — BEFORE `POST /conversations` has minted the id.
 * `<ChatPane>` is keyed on that id (`…:pending` → `…:<id>`), so the moment it
 * resolves React UNMOUNTS the pane and mounts a fresh one. A first message
 * submitted in that window lives inside the doomed pane: its optimistic bubble
 * is discarded and the just-started `…/chat` request is aborted before it
 * reaches the wire — so it vanishes silently (input cleared, no bubble, no
 * error). Distinct from the #2047 path, where `…/chat` WAS sent and failed.
 *
 * The fix: when we have a server endpoint but no id yet, stash the send in a ref
 * the PAGE owns (so it outlives the pane remount) and replay it the moment an id
 * exists — in the freshly-mounted pane (or in place if no remount happened). A
 * send made once the id is present (the normal path, and every send after the
 * first) goes straight through. Local/echo mode (no `chatApi`) also sends
 * immediately, so the offline-demo bot keeps responding.
 *
 * Exported for unit testing.
 */
export function useDeferredFirstSend(opts: {
  /** The chat endpoint — defined once an agent is resolved (server-backed mode). */
  chatApi: string | undefined;
  /** The conversation id; undefined while `POST /conversations` is in flight. */
  conversationId: string | undefined;
  /** Page-owned stash that OUTLIVES the keyed `<ChatPane>` remount. */
  pendingRef: React.MutableRefObject<PendingFirstMessage | null>;
  /** The real send (resetSuppression + sendMessage + onSent). */
  doSend: (content: string, files?: File[]) => void;
}): (content: string, files?: File[]) => void {
  const { chatApi, conversationId, pendingRef, doSend } = opts;
  const apiMode = Boolean(chatApi);

  // Replay a deferred first message the instant a conversation id exists — in
  // the freshly-mounted pane after the remount, or in place if none happened.
  // Clearing the ref before sending makes the replay fire at most once even
  // though `doSend` (and StrictMode's double-invoke) re-run this effect.
  useEffect(() => {
    if (!apiMode || !conversationId) return;
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    doSend(pending.content, pending.files);
  }, [apiMode, conversationId, pendingRef, doSend]);

  return useCallback(
    (content: string, files?: File[]) => {
      // Server-backed, but the id is still being minted: sending now would be
      // lost — a convId-less `/chat` the server won't persist, or a request torn
      // down when the pane remounts as the id resolves. Stash it; the effect
      // above replays it once the id lands.
      if (apiMode && !conversationId) {
        pendingRef.current = { content, files };
        return;
      }
      doSend(content, files);
    },
    [apiMode, conversationId, pendingRef, doSend],
  );
}

export function AiChatPage({ apiBase: apiBaseProp, defaultAgent: defaultAgentProp }: AiChatPageProps = {}) {
  const { user } = useAuth();
  const { t } = useObjectTranslation();
  const userId = user?.id;
  // The agent is BAKED INTO THE ROUTE now: `/ai/:agent[/:conversationId]`.
  // Deriving it from the path param (resolved against the live catalog) removes
  // the old `?agent=` query snapshot, which StrictMode's double-mount + the
  // `/ai`→`/ai/:id` URL rewrite used to drop (the metadata_assistant deep-link
  // bug). The dropdown is now a launcher that navigates between these routes.
  const { agent: agentSegment, conversationId: urlConversationId } =
    useParams<{ agent?: string; conversationId?: string }>();
  const [searchParams] = useSearchParams();
  const searchString = searchParams.toString();
  // Explicit new-conversation intent (`?new=1`, the sidebar's New button).
  // Read LIVE (not snapshotted): the button can be clicked again later from an
  // existing conversation, and the flag is stripped once the fresh id is
  // mirrored into the URL.
  const forceNewConversation = searchParams.get('new') !== null;
  // ADR-0070 "Edit with AI": the package the user opened to edit (from the app
  // list's per-app action). Forwarded to the build agent as `context.packageId`
  // so its metadata reads scope to that app and edits bind to it from the first
  // message (the agent seeds it as the conversation's active package).
  const editPackageId = searchParams.get('package')?.trim() || undefined;
  // ADR-0057 P4 — a build prompt handed off from the `ask` surface's
  // "Open in Builder →" (suggest_builder). Seeded as the build surface's first
  // message below; the URL-mirror strips it once the conversation is minted.
  const handoffPrompt = searchParams.get('handoffPrompt')?.trim() || undefined;
  const navigate = useNavigate();
  const { setContext } = useNavigationContext();

  useEffect(() => {
    setContext('home');
  }, [setContext]);

  const apiBase = useMemo(() => resolveApiBase(apiBaseProp), [apiBaseProp]);
  const env = (import.meta as any).env ?? {};
  const envDefaultAgent = env.VITE_AI_DEFAULT_AGENT as string | undefined;

  const { agents, isLoading: agentsLoading, error: agentsError, refetch: refetchAgents } =
    useAgents({ apiBase });
  const catalogNames = useMemo(() => agents.map((a) => a.name), [agents]);
  // Catalog resolved with no agent to talk to. The `/ai` route guard already
  // redirects when discovery reports AI unavailable (Community Edition), so this
  // is the secondary safety net: a deployment that reports AI enabled but serves
  // no agent (misconfig), a transient `/agents` failure, or a `VITE_AI_BASE_URL`
  // server that returns an empty list. Either way, degrade to a graceful state
  // instead of the agent-less echo chat (autoResponse) that ChatPane falls into.
  const noAgents = !agentsLoading && agents.length === 0;

  // Is the first path segment an agent? It is when it resolves to one (friendly
  // alias / new id / legacy id). When it doesn't, it's a legacy bare
  // `/ai/:conversationId` link (redirected below). `undefined` = catalog still
  // loading, so we can't tell yet and redirects must wait.
  const segmentIsAgent = useMemo<boolean | undefined>(() => {
    if (!agentSegment) return false;
    if (agents.length === 0) return undefined;
    return resolveAgentParam(agentSegment, catalogNames) !== undefined;
  }, [agentSegment, agents.length, catalogNames]);

  // Back-compat: the legacy deep-link `/ai?agent=metadata_assistant` (only
  // meaningful on a bare `/ai`, before the agent moved into the path). Honored
  // here, then stripped as the route is canonicalized to `/ai/:agent`.
  const legacyAgentParam = !agentSegment ? searchParams.get('agent') ?? undefined : undefined;

  // App/platform default — used for a bare `/ai` (respecting the legacy
  // `?agent=`), and as the endpoint while a legacy bare-id link is being
  // redirected to its real agent surface.
  const fallbackAgent = useMemo(
    () => resolveDefaultAgentName(agents, legacyAgentParam ?? defaultAgentProp ?? envDefaultAgent),
    [agents, legacyAgentParam, defaultAgentProp, envDefaultAgent],
  );

  // Resolved backend agent name for this surface (route agent wins; else default).
  const activeAgent = useMemo(() => {
    if (agents.length === 0) return undefined;
    if (agentSegment && segmentIsAgent) {
      return resolveAgentParam(agentSegment, catalogNames);
    }
    return fallbackAgent;
  }, [agents.length, agentSegment, segmentIsAgent, catalogNames, fallbackAgent]);
  const activeAgentRoute = activeAgent ? agentRouteName(activeAgent) : undefined;

  // A KNOWN built-in agent (build/ask/…) that the live catalog doesn't serve —
  // e.g. `/ai/build` on a deployment without the cloud AI Studio plugin. It's
  // an unavailable AGENT, not a conversation id, so we fall back to the default
  // surface instead of treating "build" as a chat to load.
  const unavailableKnownAgent = Boolean(
    agentSegment && segmentIsAgent === false && isBuiltinAgentName(agentSegment),
  );

  // A first segment that ISN'T an agent and ISN'T a known (unavailable) agent
  // name is a legacy bare conversation id.
  const legacyConversationId =
    agentSegment && segmentIsAgent === false && !unavailableKnownAgent ? agentSegment : undefined;

  const chatApi = activeAgent
    ? `${apiBase}/agents/${encodeURIComponent(activeAgent)}/chat`
    : undefined;

  // ADR-0057: key the conversation on `(user, app, product)`, not on surface.
  // When this full-page surface was deep-linked to edit a package
  // (`/ai/build?package=X`, the ADR-0070 "Edit with AI" entry), it shares the
  // Studio copilot's `app:X:build` thread instead of forking a separate one; a
  // generic `/ai/:agent` visit (no `?package=`) degrades to the product alone,
  // unchanged from before. `undefined` while the agent is still resolving.
  const chatScope = activeAgent
    ? chatConversationScope({ appId: editPackageId, product: chatProductOfAgent(activeAgent) })
    : undefined;

  const { conversationId, conversationScope, initialMessages } = useChatConversation({
    // Gate resolution on the agent being known: resolving while `activeAgent`
    // is still undefined (catalog loading) would bind a SCOPELESS conversation
    // that the per-(user,scope) guard then sticks with — so the agent surface
    // would resume some other agent's last chat. Waiting one tick keys the
    // conversation to the right scope from the first resolve.
    userId: activeAgent ? userId : undefined,
    scope: chatScope,
    apiBase,
    activeId: urlConversationId ?? legacyConversationId,
    forceNew: forceNewConversation,
  });

  // ── Route canonicalization ──────────────────────────────────────────────
  // Back-compat redirects (the agent is now in the path): bare `/ai` → the
  // default agent surface (or the `?agent=` deep-link target); a legacy built-in
  // id in the agent slot (`/ai/metadata_assistant`) → its friendly form
  // (`/ai/build`). Custom agents already route by their own name and no-op here.
  // The `?new=1` intent is preserved; the consumed legacy `agent` param is
  // stripped so it doesn't linger in the canonical URL.
  useEffect(() => {
    if (agents.length === 0 || !activeAgent) return;
    const friendly = agentRouteName(activeAgent);
    const preserved = new URLSearchParams(searchString);
    preserved.delete('agent');
    const preservedQuery = preserved.toString() ? `?${preserved.toString()}` : '';
    if (!agentSegment) {
      navigate(`/ai/${friendly}${preservedQuery}`, { replace: true });
      return;
    }
    // A known agent that isn't deployed here (e.g. `/ai/build` with no cloud AI
    // Studio): land cleanly on the default surface rather than treating the
    // segment as a conversation id (which produced the junk `/ai/ask/build`).
    if (unavailableKnownAgent) {
      navigate(`/ai/${friendly}${preservedQuery}`, { replace: true });
      return;
    }
    if (segmentIsAgent && agentSegment !== friendly) {
      const tail = urlConversationId ? `/${encodeURIComponent(urlConversationId)}` : '';
      navigate(`/ai/${friendly}${tail}${preservedQuery}`, { replace: true });
    }
  }, [agents.length, activeAgent, agentSegment, segmentIsAgent, unavailableKnownAgent, urlConversationId, searchString, navigate]);

  // ── Legacy `/ai/:conversationId` (bare id) ──────────────────────────────
  // Resolve the conversation's own agent and 301 to `/ai/:agent/:conversationId`
  // so old bookmarks keep working under the agent-scoped routes.
  useEffect(() => {
    if (legacyConversationId === undefined) return;
    let cancelled = false;
    (async () => {
      let convAgent: string | undefined;
      try {
        const conv = await fetchConversation(apiBase, legacyConversationId);
        convAgent = (conv as { agentId?: string } | null)?.agentId ?? undefined;
      } catch {
        /* gone / inaccessible — fall back to the default surface below */
      }
      if (cancelled) return;
      const resolved = resolveAgentParam(convAgent ?? '', catalogNames);
      const friendly = agentRouteName(resolved ?? activeAgent ?? PLATFORM_DEFAULT_AGENT);
      navigate(`/ai/${friendly}/${encodeURIComponent(legacyConversationId)}`, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [legacyConversationId, apiBase, catalogNames, activeAgent, navigate]);

  const [refreshKey, setRefreshKey] = useState(0);
  const [titleHints, setTitleHints] = useState<Record<string, string>>({});
  const [shareOpen, setShareOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [mobileChatsOpen, setMobileChatsOpen] = useState(false);
  const {
    collapsed: chatsCollapsed,
    toggle: toggleChatsCollapsed,
    handleCanvasOpenChange,
  } = useCollapsibleChatsList();
  // Keyboard shortcuts (ChatGPT/Claude parity): ⌘⇧O new chat, ⌘⇧S toggle list.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const action = matchAiChatShortcut(e);
      if (!action) return;
      e.preventDefault();
      if (action === 'toggle-list') toggleChatsCollapsed();
      else navigate(activeAgentRoute ? `/ai/${activeAgentRoute}?new=1` : '/ai?new=1');
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [toggleChatsCollapsed, navigate, activeAgentRoute]);
  const restApiBase = useMemo(
    () => apiBase.replace(/\/v1\/ai$/, '').replace(/\/ai$/, '') || '/api',
    [apiBase],
  );

  // Public share-link landing base. SharedRecordPage lives UNDER the console
  // SPA basename (e.g. `/_console/s/:token`), so the ShareDialog default of
  // `${origin}/s/:token` 404s for recipients. Derive the base from the SPA's
  // BASE_URL so the copyable link points at the actually-served route.
  const publicShareBase = useMemo(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
    // Mirror the console's own basename resolution (App.tsx resolveBasename):
    // the published SPA uses a relative Vite base, so the mount path is carried
    // by the injected `<base href>` tag, NOT import.meta.env.BASE_URL.
    let base = '';
    try {
      const href = document.querySelector('base')?.getAttribute('href');
      if (href) base = new URL(href, window.location.origin).pathname.replace(/\/+$/, '');
    } catch { /* no <base> → root-mounted SPA */ }
    return `${window.location.origin}${base}/s`;
  }, []);

  // New-conversation race guard. On an IN-SPA `/ai?new=1` navigation the
  // URL-mirroring effect below fires in the SAME commit as the hook's effect,
  // with this render's (stale) `conversationId` still in its closure — the
  // hook's setConversationId(undefined) hasn't re-rendered yet. Unguarded, it
  // bounced straight back to `/ai/:oldId` and stripped the flag before the
  // fresh conversation existed (the New button looked like a no-op; a full
  // page load on the same URL worked because state starts empty). Snapshot
  // the id visible when the flag appears — a RENDER-phase ref write, so it's
  // set before any effect of this commit runs — and refuse to mirror that
  // exact id while the flag is up. The fresh id differs, mirrors normally,
  // and the navigation strips `?new=1`, which resets the snapshot.
  const staleNewTargetRef = useRef<{ id: string | undefined } | null>(null);
  if (forceNewConversation) {
    if (staleNewTargetRef.current === null) staleNewTargetRef.current = { id: conversationId };
  } else {
    staleNewTargetRef.current = null;
  }

  // After the hook resolves a real id for a fresh agent-surface visit, mirror
  // it into the URL (`/ai/:agent/:id`) so the sidebar's active-row + share +
  // refresh all work. Only fires on a real agent surface that has no id yet —
  // not while a bare `/ai` or a legacy bare id is still being redirected.
  useEffect(() => {
    if (!segmentIsAgent || urlConversationId || !conversationId || !activeAgentRoute) return;
    if (staleNewTargetRef.current && staleNewTargetRef.current.id === conversationId) return;
    // Don't mirror a conversation that belongs to the PREVIOUS scope: right
    // after a launcher switch, `conversationId` still holds the old scope's id
    // until the hook re-resolves under the new one. Mirroring it would write
    // it onto the new agent's URL and resume the wrong chat.
    if (conversationScope !== chatScope) return;
    // Preserve the `?package=` binding (ADR-0070 "Edit with AI") across the
    // mirror. Without it the rewrite to `/ai/:agent/:conversationId` drops the
    // query, so `editPackageId` goes undefined and the conversation scope falls
    // back from `app:${package}:${product}` to the product alone (ADR-0057) —
    // which would then let a bare `/ai/build` visit resume this package-scoped
    // thread. The consumed `agent`/`new` params stay stripped as before.
    const pkgQuery = editPackageId ? `?package=${encodeURIComponent(editPackageId)}` : '';
    navigate(`/ai/${activeAgentRoute}/${conversationId}${pkgQuery}`, { replace: true });
  }, [segmentIsAgent, urlConversationId, conversationId, conversationScope, chatScope, activeAgentRoute, editPackageId, navigate]);

  const titledRef = useRef<Set<string>>(new Set());

  // A resumed conversation already has history; treat it as already-titled
  // so we don't clobber the original title on the next user turn.
  useEffect(() => {
    if (conversationId && initialMessages.length > 0) {
      titledRef.current.add(conversationId);
    }
  }, [conversationId, initialMessages.length]);

  useEffect(() => {
    if (!conversationId) return;
    const hint = firstUserMessageText(initialMessages);
    if (!hint) return;
    setTitleHints((current) =>
      current[conversationId] === hint ? current : { ...current, [conversationId]: hint },
    );
  }, [conversationId, initialMessages]);

  // Holds an empty-state first message submitted before the conversation id was
  // minted. Owned by the PAGE (not the keyed <ChatPane>) so it survives the
  // remount that the id-resolution triggers; the freshly-mounted pane replays it
  // via useDeferredFirstSend. See that hook for the full race.
  const pendingFirstMessageRef = useRef<PendingFirstMessage | null>(null);

  // ADR-0057 P4 — seed the handed-off build prompt as this surface's first
  // message. Only on the BUILD surface (the handoff target), once, before the
  // conversation id is minted; `useDeferredFirstSend` (in ChatPane) replays it
  // the moment the id resolves. The URL-mirror then rewrites to
  // `/ai/build/:id?package=…`, dropping `?handoffPrompt`, so a reload never
  // re-sends it.
  const handoffSeededRef = useRef(false);
  useEffect(() => {
    if (!handoffPrompt || handoffSeededRef.current) return;
    if (!activeAgent || agentRouteName(activeAgent) !== 'build') return;
    handoffSeededRef.current = true;
    pendingFirstMessageRef.current = { content: handoffPrompt };
  }, [handoffPrompt, activeAgent]);

  const handleSent = useCallback(
    (firstUserMessage?: string) => {
      // New user turn → bump sidebar list so the row's preview/timestamp refreshes.
      setRefreshKey((k) => k + 1);
      if (firstUserMessage && conversationId) {
        setTitleHints((current) => ({ ...current, [conversationId]: firstUserMessage }));
      }

      // Server now generates a concise LLM-summarised title fire-and-forget
      // after the first assistant turn lands (see service-ai
      // `summarizeConversation`). We don't PATCH a truncated preview from the
      // client anymore — that races the LLM and wins, which would block the
      // real title. Instead, bump the sidebar a couple of times so the new
      // title is picked up whenever the model finally responds.
      if (!firstUserMessage || !conversationId) return;
      if (titledRef.current.has(conversationId)) return;
      titledRef.current.add(conversationId);
      const bump = () => setRefreshKey((k) => k + 1);
      const t1 = setTimeout(bump, 2500);
      const t2 = setTimeout(bump, 6000);
      // Best-effort: if the component unmounts before the bumps fire, the
      // setRefreshKey call is a no-op so we don't bother tracking the timers.
      void t1;
      void t2;
    },
    [conversationId],
  );

  return (
    <div className="flex h-svh w-full flex-col bg-background" data-testid="ai-chat-page">
      <header className="sticky top-0 z-30 flex h-14 w-full shrink-0 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur sm:px-4">
        {/* Mobile: open the chats list as a sheet. The DESKTOP collapse toggle
            is NOT in the top nav — it lives at the bottom-left of the chats
            column (see below), mirroring the app shell's sidebar toggle. Chat
            controls are meaningless with no agent, so hide in that state. */}
        {!noAgents && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 md:hidden"
            onClick={() => setMobileChatsOpen(true)}
            aria-label={t('console.ai.openChats')}
            data-testid="ai-chat-mobile-sidebar-trigger"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <AppHeader variant="home" />
        </div>
      </header>
      {noAgents ? (
        <AiUnavailable
          hasError={Boolean(agentsError)}
          onRetry={refetchAgents}
          onHome={() => navigate('/home')}
          t={t}
        />
      ) : (
      <>
      <Sheet open={mobileChatsOpen} onOpenChange={setMobileChatsOpen}>
        <SheetContent side="left" className="w-[320px] p-0 sm:max-w-[360px]" data-testid="ai-chat-mobile-sidebar">
          <SheetHeader className="sr-only">
            <SheetTitle>{t('console.ai.chats')}</SheetTitle>
            <SheetDescription>{t('console.ai.chatsDescription')}</SheetDescription>
          </SheetHeader>
          <ConversationsSidebar
            userId={userId}
            apiBase={apiBase}
            activeAgent={activeAgent}
            refreshKey={refreshKey}
            titleHints={titleHints}
            className="h-full border-r-0"
            onNavigate={() => setMobileChatsOpen(false)}
          />
        </SheetContent>
      </Sheet>
      {conversationId && (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          objectName="ai_conversations"
          recordId={conversationId}
          recordLabel="this conversation"
          apiBase={restApiBase}
          publicBaseUrl={publicShareBase}
        />
      )}
      {conversationId && isBuildAgent(activeAgent) && (
        <BuildDebugDrawer
          apiBase={apiBase}
          conversationId={conversationId}
          open={debugOpen}
          onOpenChange={setDebugOpen}
        />
      )}
      {/* Uniform `bg-background` across the chat area: the centered chat column
          is `bg-background`, so a `bg-muted` backdrop here produced a hard
          seam between the column and its side gutters (read as accidental). The
          conversations sidebar keeps its own `bg-muted/30` for hierarchy. */}
      <div className="flex min-h-0 flex-1 w-full bg-background">
        {/* Desktop chats column. The collapse/expand control sits at the
            BOTTOM-LEFT (mirroring the app shell's sidebar toggle) rather than
            intruding into the top navigation bar. Collapsed → a slim rail with
            just the expand button; expanded → the list with the toggle in a
            footer. */}
        <div className="hidden shrink-0 flex-col border-r md:flex">
          {!chatsCollapsed && (
            <ConversationsSidebar
              userId={userId}
              apiBase={apiBase}
              activeAgent={activeAgent}
              refreshKey={refreshKey}
              titleHints={titleHints}
              className="w-72 min-h-0 flex-1 border-r-0"
            />
          )}
          <div className={cn('mt-auto p-2', chatsCollapsed ? 'w-12' : 'w-72 border-t')}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleChatsCollapsed}
              aria-label={
                chatsCollapsed
                  ? t('console.ai.showChats', { defaultValue: 'Show chats' })
                  : t('console.ai.hideChats', { defaultValue: 'Hide chats' })
              }
              title={
                chatsCollapsed
                  ? t('console.ai.showChats', { defaultValue: 'Show chats' })
                  : t('console.ai.hideChats', { defaultValue: 'Hide chats' })
              }
              data-testid="ai-chat-collapse-sidebar-trigger"
              aria-pressed={chatsCollapsed}
            >
              {chatsCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <main className="flex min-w-0 flex-1 flex-col">
          <ChatPane
            key={`${chatApi ?? 'local'}:${conversationId ?? 'pending'}`}
            agents={agents}
            agentsLoading={agentsLoading}
            agentsError={agentsError}
            activeAgent={activeAgent}
            chatApi={chatApi}
            apiBase={apiBase}
            conversationId={conversationId}
            editPackageId={editPackageId}
            initialMessages={initialMessages}
            pendingFirstMessageRef={pendingFirstMessageRef}
            onSent={handleSent}
            onShare={() => setShareOpen(true)}
            onDebug={() => setDebugOpen(true)}
            showDebug={isBuildAgent(activeAgent)}
            onCanvasOpenChange={handleCanvasOpenChange}
          />
        </main>
      </div>
      </>
      )}
    </div>
  );
}

/**
 * Graceful state for `/ai` when the agent catalog resolved empty — shown
 * instead of an agent-less echo chat. `hasError` distinguishes "AI not enabled
 * on this deployment" (Community Edition) from "couldn't reach the AI service"
 * (offline/misconfig), which also offers a retry. Either way there's a way out
 * (back to home), so the route never dead-ends.
 */
function AiUnavailable({
  hasError,
  onRetry,
  onHome,
  t,
}: {
  hasError: boolean;
  onRetry: () => void;
  onHome: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6" data-testid="ai-unavailable">
      <Empty>
        <EmptyTitle>
          {t('console.ai.unavailableTitle', { defaultValue: 'AI assistant unavailable' })}
        </EmptyTitle>
        <EmptyDescription>
          {hasError
            ? t('console.ai.unavailableError', {
                defaultValue:
                  "Couldn't reach the AI service. It may be temporarily offline — try again, or head back home.",
              })
            : t('console.ai.unavailableDescription', {
                defaultValue:
                  "This deployment doesn't have an AI assistant enabled. Everything else works as usual.",
              })}
        </EmptyDescription>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
          {hasError && (
            <Button variant="outline" onClick={onRetry} data-testid="ai-unavailable-retry">
              {t('console.ai.unavailableRetry', { defaultValue: 'Try again' })}
            </Button>
          )}
          <Button onClick={onHome} data-testid="ai-unavailable-home">
            {t('console.ai.unavailableHome', { defaultValue: 'Back to home' })}
          </Button>
        </div>
      </Empty>
    </div>
  );
}

interface ChatPaneProps {
  agents: AgentDescriptor[];
  agentsLoading: boolean;
  agentsError: Error | undefined;
  activeAgent: string | undefined;
  chatApi: string | undefined;
  apiBase: string;
  conversationId: string | undefined;
  /** ADR-0070 "Edit with AI": the package the user opened to edit (from `?package=`),
   *  forwarded to the build agent as `context.packageId` to scope it to that app. */
  editPackageId?: string;
  initialMessages: HydratedUIMessage[];
  /** Page-owned stash for a first message sent before the conversation id resolved
   *  (survives this pane's id-keyed remount). See {@link useDeferredFirstSend}. */
  pendingFirstMessageRef: React.MutableRefObject<PendingFirstMessage | null>;
  onSent: (firstUserMessage?: string) => void;
  onShare: () => void;
  /** Opens the Build Doctor drawer (build agent only). */
  onDebug?: () => void;
  /** Show the Build Doctor button — true only for build-agent conversations. */
  showDebug?: boolean;
  /** Reports the Live Canvas preview opening/closing so the page can auto-tuck the chats list. */
  onCanvasOpenChange?: (open: boolean) => void;
}

export function ChatPane({
  agents,
  agentsLoading,
  agentsError,
  activeAgent,
  chatApi,
  apiBase,
  conversationId,
  editPackageId,
  initialMessages,
  pendingFirstMessageRef,
  onSent,
  onShare,
  onDebug,
  showDebug,
  onCanvasOpenChange,
}: ChatPaneProps) {
  const { t } = useObjectTranslation();
  const navigate = useNavigate();
  // The agent dropdown is a LAUNCHER now (not an in-surface mode toggle): it
  // navigates to `/ai/:agent`, so it naturally lists custom agents and can stay
  // always-available. Shown only when there's more than one agent to switch to.
  const showAgentLauncher = agents.length > 1;

  // ADR-0057 P4 — the `ask` agent declined an authoring request (suggest_builder).
  // Open the full-page BUILD surface seeded with the handoff prompt (carried as
  // `?handoffPrompt=`, auto-sent on arrival; ADR-0063 decline-and-redirect — an
  // explicit, user-initiated switch, never a silent re-route). Prefer the
  // handoff's own packageId, else this surface's edit package.
  const openBuilder = useCallback(
    (handoff: { prompt: string; packageId?: string }) => {
      const params = new URLSearchParams();
      const pkg = handoff.packageId || editPackageId;
      if (pkg) params.set('package', pkg);
      if (handoff.prompt) params.set('handoffPrompt', handoff.prompt);
      const qs = params.toString();
      navigate(`/ai/build${qs ? `?${qs}` : ''}`);
    },
    [navigate, editPackageId],
  );

  // ── ADR-0037 Live Canvas ────────────────────────────────────────────────
  // When a build session drafts an `app`, open the split-view canvas: the
  // drafted app rendered as-if-published (`?preview=draft`) beside the chat.
  // Per-artifact signals coalesce (800 ms) into one pane refresh so a
  // whole-app build doesn't trigger an invalidation storm.
  const [canvasApp, setCanvasApp] = useState<{ name: string; segment?: string; materialized: boolean } | null>(null);
  const [canvasRefreshKey, setCanvasRefreshKey] = useState(0);
  // cloud#797 Excel→App: the attached spreadsheet the user can load real rows
  // from (into a built object) via ExcelImportBar. Set when a sheet is sent,
  // cleared on import/dismiss. `dataSource` drives the wizard's schema + import.
  const dataSource = useAdapter();
  const [pendingSheet, setPendingSheet] = useState<File | null>(null);
  const canvasTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (canvasTimerRef.current) window.clearTimeout(canvasTimerRef.current);
  }, []);
  // Tell the page when the preview pane opens/closes so it can tuck the chats
  // list away for the (tight) chat + preview split, and restore it after.
  const canvasOpen = canvasApp !== null;
  useEffect(() => {
    onCanvasOpenChange?.(canvasOpen);
  }, [canvasOpen, onCanvasOpenChange]);
  // Draggable chat ↔ preview split (active only while the preview is open).
  const split = useResizableChatPane(canvasOpen);
  const handleDraftArtifacts = useCallback((artifacts: Array<{ type: string; name: string }>, appSegment?: string) => {
    const app = artifacts.find((a) => a.type === 'app');
    // Route the preview on the app's package id (ADR-0048), not its name.
    if (app) setCanvasApp((prev) => prev ?? { name: app.name, segment: appSegment, materialized: false });
    if (canvasTimerRef.current) window.clearTimeout(canvasTimerRef.current);
    canvasTimerRef.current = window.setTimeout(() => setCanvasRefreshKey((k) => k + 1), 800);
  }, []);
  // ADR-0045: the build finished and was materialized (real tables + data,
  // app unlisted). Switch the open canvas from the draft overlay to the REAL
  // app URL — the reload that follows shows live rows in every list.
  const handleBuildMaterialized = useCallback((appName: string) => {
    setCanvasApp((prev) =>
      prev && prev.name === appName && !prev.materialized
        ? { ...prev, materialized: true } // keep the package-id segment
        : prev ?? { name: appName, materialized: true },
    );
  }, []);
  // A different conversation is a different build session — close the pane.
  useEffect(() => {
    setCanvasApp(null);
  }, [conversationId]);

  const activeAgentLabel = useMemo<string>(() => {
    const found = agents.find((a) => a.name === activeAgent);
    return localizeAgentLabel(t, activeAgent, found?.label ?? activeAgent ?? t('console.ai.assistant'));
  }, [agents, activeAgent, t]);

  const hydrated = useMemo<ChatMessage[]>(() => {
    return hydratedMessagesToChatMessages(initialMessages);
  }, [initialMessages]);

  const suggestions = useMemo<string[] | undefined>(() => {
    if (hydrated.length > 0) return undefined;
    return buildAgentSuggestions(activeAgent, activeAgentLabel, t);
  }, [hydrated.length, activeAgent, activeAgentLabel, t]);

  // Per-surface empty-state branding (Build = authoring, Ask = data Q&A).
  const emptyState = useMemo(() => agentEmptyState(t, activeAgent), [t, activeAgent]);

  // ADR-0013 D2: reconcile a stream-transport failure instead of blindly
  // retrying. Shared across chat surfaces — see useReconcileOnError.
  const { errorSuppressed, handleChatError, setMessagesRef, resetSuppression } =
    useReconcileOnError({ chatApi, conversationId });

  // ADR-0028: plan-filtered selectable AI model on the full-page Build/Ask
  // surface. The footer <select> in ChatbotEnhanced renders only for 2+ models,
  // so free / single-model envs see nothing. Mirrors ConsoleFloatingChatbot;
  // the chosen model rides each request via useObjectChat's `model` below.
  const { models: aiModels, defaultModelId } = useAiModels({ apiBase });
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(undefined);
  const effectiveModelId = selectedModelId ?? defaultModelId;

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    stop,
    reload,
    clear,
    setMessages,
  } = useObjectChat({
    api: chatApi,
    conversationId,
    // ADR-0028: the user's picked model (or the env default) rides each request.
    model: effectiveModelId,
    onError: handleChatError,
    body: {
      context: {
        activeApp: 'AI',
        agentName: activeAgent,
        // Tell the agent the environment's publish posture so its narration
        // matches reality (an auto-published build is live, not "to publish").
        autoPublishAiBuilds: getRuntimeConfig().features.autoPublishAiBuilds,
        // ADR-0070 "Edit with AI": scope the build agent to the app the user
        // opened to edit. Cloud seeds it as the conversation's active package.
        ...(editPackageId ? { packageId: editPackageId } : {}),
      },
    },
    initialMessages: hydrated,
    autoResponse: !chatApi,
    autoResponseText: "Thanks for your message! I'm here to help.",
    autoResponseDelay: 600,
  });

  useEffect(() => {
    setMessagesRef.current = setMessages;
  }, [setMessages]);

  useEffect(() => {
    writeConversationMessagesCache(
      conversationId,
      sanitizeChatMessagesForCache(messages as ChatMessage[]),
    );
  }, [conversationId, messages]);

  // #772 — the confirm-card SEND messages must match the CONVERSATION's
  // language, not the console UI locale: a Chinese thread under an English UI
  // was sending "Looks good — build it as proposed." into its own chat. The
  // gate (service-ai-studio) accepts both languages, so this is a cosmetic —
  // but jarring — mismatch. Override the sent strings to Chinese when the
  // conversation is Chinese; button LABELS stay on the UI locale.
  const convZh = useMemo(
    () => isConversationZh(messages as ChatMessage[]) || isConversationZh(initialMessages),
    [messages, initialMessages],
  );
  const planApproveMessage = convZh
    ? '确认，开始搭建。'
    : t('console.ai.planApproveMessage', { defaultValue: 'Looks good — build it as proposed.' });
  const planApproveDefaultsMessage = convZh
    ? '确认搭建，未决问题按你的合理假设和默认处理。'
    : t('console.ai.planApproveDefaultsMessage', {
        defaultValue: 'Build it with your best assumptions; use sensible defaults for the open questions.',
      });

  // ADR-0037: refresh the live preview when a turn finishes while the canvas is
  // open. The per-artifact `onDraftArtifacts` signal covers a build streaming in,
  // but an incremental edit (add a field, rename) can land without growing the
  // de-duped artifact set — so its draft never reached the iframe and the pane
  // (and its "Changes (N)" count) went stale until a manual reload. Bumping on
  // the loading falling-edge guarantees the preview reflects every change.
  const prevLoadingRef = useRef(false);
  useEffect(() => {
    if (prevLoadingRef.current && !isLoading && canvasApp) {
      setCanvasRefreshKey((k) => k + 1);
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading, canvasApp]);

  const hitl = useHitlInChat({
    messages: messages as ChatMessage[],
    apiBase,
    continueConversation: (prompt) => {
      sendMessage(prompt);
    },
  });

  // The real send, shared by a normal submit and by the deferred-first-message
  // replay below (resetSuppression → send → onSent, in that order).
  //
  // Spreadsheet attachments (cloud#797 WS3): historically every attachment was
  // silently dropped between the composer and the transport. Excel/CSV files
  // are now parsed CLIENT-side (plugin-grid's importParsers; the bytes never
  // leave the page) and the agent is briefed with a compact structured block —
  // headers + first sample rows + row count — appended to the user's text. The
  // agent's solution-design skill takes it from there (match an object, offer
  // missing fields, point at the object list's Import action). Non-spreadsheet
  // attachments stay out of scope and are disclosed rather than dropped.
  const doSend = useCallback(
    (content: string, files?: File[]) => {
      resetSuppression();
      const sheets = (files ?? []).filter((f) => /\.(xlsx|xlsm|csv|tsv|txt)$/i.test(f.name));
      if (!sheets.length) {
        if (files?.length) {
          // Honest disclosure beats a silent drop — the agent cannot read these.
          sendMessage(
            `${content}\n\n(用户上传了 ${files.length} 个附件:${files
              .map((f) => f.name)
              .join('、')} — 当前仅支持读取表格类附件(Excel/CSV),这些文件的内容我没有读取。)`,
          );
          onSent(content);
          return;
        }
        sendMessage(content);
        onSent(content);
        return;
      }
      // Retain the first sheet so ExcelImportBar can load its REAL rows into a
      // built object (cloud#797) — the agent got a brief; the user gets an
      // import affordance without re-picking the file.
      setPendingSheet(sheets[0]);
      void (async () => {
        const cap = (s: string) => (s.length > 40 ? `${s.slice(0, 40)}…` : s);
        const line = (r: string[]) =>
          r.slice(0, 12).map((c) => cap(String(c ?? '')).replace(/\s+/g, ' ')).join(' | ');
        let merged = content;
        for (const f of sheets.slice(0, 2)) {
          try {
            const { parseSpreadsheetFile } = await import('@object-ui/plugin-grid');
            const rows = await parseSpreadsheetFile(f);
            const headers = rows[0] ?? [];
            const samples = rows.slice(1, 4);
            merged += [
              `\n\n[附件表格 ${f.name} — ${Math.max(0, rows.length - 1)} 数据行 × ${headers.length} 列(控制台已在本地解析,文件本体未上传)]`,
              `表头: ${line(headers)}`,
              ...samples.map((r, i) => `样例${i + 1}: ${line(r)}`),
            ].join('\n');
          } catch (err) {
            merged += `\n\n[附件表格 ${f.name}] 解析失败(${err instanceof Error ? err.message : 'unknown'})— 请引导用户改用对象列表的 Import 上传该文件。`;
          }
        }
        if (sheets.length > 2) merged += `\n\n(另有 ${sheets.length - 2} 个表格附件未读取 — 一次最多读取 2 个。)`;
        const nonSheets = (files ?? []).length - sheets.length;
        if (nonSheets > 0) merged += `\n\n(另有 ${nonSheets} 个非表格附件,内容未读取。)`;
        sendMessage(merged);
        onSent(merged);
      })();
    },
    [resetSuppression, sendMessage, onSent],
  );

  // Guards the empty-state first send against the conversation-id remount race:
  // a send made before the id is minted is stashed in the page-owned ref and
  // replayed once the id lands, so the magic-moment first message reliably
  // reaches `…/chat` instead of being dropped. See useDeferredFirstSend.
  const handleSend = useDeferredFirstSend({
    chatApi,
    conversationId,
    pendingRef: pendingFirstMessageRef,
    doSend,
  });

  const headerSlot = (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 pb-2 pt-3 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {showAgentLauncher ? (
          agents.length <= 3 ? (
            // Claude-Code-style segmented switcher (mirrors the floating
            // assistant) so Ask/Build read as visible peer modes, not a hidden
            // dropdown. Each tab navigates to that agent's surface. Falls back
            // to the Select when many custom agents would overflow the header.
            <Tabs
              value={activeAgent}
              onValueChange={(name) => navigate(`/ai/${agentRouteName(name)}`)}
            >
              <TabsList
                className="h-7 gap-0.5 p-0.5"
                data-testid="ai-chat-agent-picker"
                aria-label={t('console.ai.switchAssistant', { defaultValue: 'Switch assistant' })}
              >
                {agents.map((agent) => (
                  <TabsTrigger
                    key={agent.name}
                    value={agent.name}
                    disabled={agentsLoading}
                    title={agent.description || undefined}
                    className="h-6 px-2.5 text-xs"
                  >
                    {localizeAgentLabel(t, agent.name, agent.label)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : (
            <Select
              value={activeAgent}
              onValueChange={(name) => navigate(`/ai/${agentRouteName(name)}`)}
              disabled={agentsLoading}
            >
              <SelectTrigger
                className="h-7 w-auto min-w-0 border-0 bg-transparent px-1.5 text-xs shadow-none hover:bg-accent focus:ring-0 focus:ring-offset-0 focus-visible:ring-1 focus-visible:ring-border/80 focus-visible:ring-offset-0 sm:min-w-[160px]"
                data-testid="ai-chat-agent-picker"
                aria-label={t('console.ai.switchAssistant', { defaultValue: 'Switch assistant' })}
              >
                <SelectValue placeholder={t('console.ai.chooseAgent', { defaultValue: 'Choose assistant…' })} />
              </SelectTrigger>
              <SelectContent align="start">
                {agents.map((agent) => (
                  <SelectItem key={agent.name} value={agent.name} className="text-xs">
                    <span className="font-medium">
                      {localizeAgentLabel(t, agent.name, agent.label)}
                    </span>
                    {agent.description ? (
                      <span className="block text-muted-foreground text-[10px] truncate max-w-[260px]">
                        {agent.description}
                      </span>
                    ) : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        ) : (
          <span className="truncate text-xs font-medium text-foreground/85">
            {activeAgentLabel}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {showDebug && onDebug ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onDebug}
            disabled={!conversationId}
            aria-label="Build Doctor"
            data-testid="ai-chat-debug-button"
            title={conversationId ? 'Build Doctor — what actually landed?' : 'Send a message first'}
          >
            <Bug className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={onShare}
          disabled={!conversationId}
          aria-label={t('console.ai.share')}
          data-testid="ai-chat-share-button"
          title={conversationId ? t('console.ai.shareTitle') : t('console.ai.shareDisabledTitle')}
        >
          <Share2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {agentsError ? (
        <span
          className="basis-full text-[10px] text-amber-700 dark:text-amber-400"
          title={agentsError.message}
        >
          {t('console.ai.offlineDemoMode')}
        </span>
      ) : null}
    </div>
  );

  return (
    <div ref={split.containerRef} className="relative flex min-h-0 flex-1 px-0">
      {/* Excel→App (cloud#797): float the real-data import affordance above the
          chat when a spreadsheet was attached. Absolute so it doesn't disturb
          the chat/canvas flex layout; the ImportWizard it opens is a modal. */}
      {pendingSheet && dataSource ? (
        <div className="pointer-events-none absolute top-2 left-0 right-0 z-20 flex justify-center px-4">
          <div className="pointer-events-auto w-full max-w-3xl">
            <ExcelImportBar
              file={pendingSheet}
              dataSource={dataSource}
              defaultObjectName={canvasApp?.name}
              onDone={() => setPendingSheet(null)}
            />
          </div>
        </div>
      ) : null}
      <div
        data-chat-column
        className={
          canvasApp
            ? 'flex min-h-0 shrink-0 justify-center'
            : 'flex min-h-0 flex-1 justify-center'
        }
        style={canvasApp ? { width: split.width } : undefined}
      >
      <ChatbotEnhanced
        className="min-h-0 flex-1 bg-background md:max-w-5xl"
        onUpgrade={() => window.open(cloudPricingDeepLink(), '_blank', 'noopener,noreferrer')}
        onOpenBuilder={openBuilder}
        surface="plain"
        maxHeight="100%"
        headerSlot={headerSlot}
        messages={messages as ChatMessage[]}
        placeholder={
          activeAgent
            ? agentRouteName(activeAgent) === 'ask'
              // The generic "Ask {agent}…" doubles to "Ask Ask…" for the data-query
              // agent whose label IS "Ask". Use its purpose-built placeholder instead.
              ? t('console.ai.askAnything')
              : t('console.ai.askAgent', { agent: activeAgentLabel })
            : agentsLoading
              ? t('console.ai.loadingAgents')
              : t('console.ai.askAnything')
        }
        labels={{
          emptyTitle: emptyState.title,
          emptyDescription: emptyState.description,
          clear: t('console.ai.clearConversation'),
          sendHint: t('console.ai.sendHint'),
          agentActivity: t('console.ai.agentActivity'),
          toolCompleted: t('console.ai.toolCompleted'),
          toolRunning: t('console.ai.toolRunning'),
          toolAwaitingApproval: t('console.ai.toolAwaitingApproval'),
          toolFailed: t('console.ai.toolFailed'),
          connectionWaiting: t('console.ai.connectionWaiting', { defaultValue: 'Waiting for server…' }),
          connectionStalledLabel: t('console.ai.connectionStalled', { defaultValue: 'Still working…' }),
          connectionOfflineLabel: t('console.ai.connectionOffline', { defaultValue: 'Connection lost — reconnecting…' }),
          // Friendly in-progress feedback for the long, atomic propose_blueprint
          // call — a lead-in plus rotating hints so the wait reads as deliberate
          // design work, not a hang. Each hint is translated individually (the
          // established per-string pattern; avoids an i18n returnObjects array).
          designingPlanLabel: t('console.ai.designingPlan', { defaultValue: 'Designing your app…' }),
          designingPlanHints: [
            t('console.ai.designingPlanHint.data', { defaultValue: 'Mapping out the data you’ll track…' }),
            t('console.ai.designingPlanHint.objects', { defaultValue: 'Shaping objects and their fields…' }),
            t('console.ai.designingPlanHint.relations', { defaultValue: 'Connecting related records…' }),
            t('console.ai.designingPlanHint.lookups', { defaultValue: 'Setting up relationships and lookups…' }),
            t('console.ai.designingPlanHint.views', { defaultValue: 'Planning the screens and views…' }),
            t('console.ai.designingPlanHint.forms', { defaultValue: 'Laying out forms and lists…' }),
            t('console.ai.designingPlanHint.defaults', { defaultValue: 'Adding sensible defaults and validations…' }),
            t('console.ai.designingPlanHint.dashboard', { defaultValue: 'Sketching a dashboard to track it…' }),
            t('console.ai.designingPlanHint.review', { defaultValue: 'Double-checking the structure hangs together…' }),
            t('console.ai.designingPlanHint.finalize', { defaultValue: 'Pulling the plan together…' }),
          ],
          toolDetailsHidden: t('console.ai.toolDetailsHidden'),
          copy: t('console.ai.copy'),
          copied: t('console.ai.copied'),
          regenerate: t('console.ai.regenerate'),
          model: t('console.ai.model'),
          submit: t('console.ai.submit'),
          uploadFiles: t('console.ai.uploadFiles'),
          stopResponse: t('console.ai.stopResponse'),
          sendFailedRateLimited: t('console.ai.sendFailedRateLimited', {
            defaultValue:
              "You're sending messages too quickly. Your message is kept below — wait a moment and try again.",
          }),
          sendFailedGeneric: t('console.ai.sendFailedGeneric', {
            defaultValue: "Couldn't send your message. It's kept below — please try again.",
          }),
          trace: t('console.ai.trace'),
          viewTrace: t('console.ai.viewTrace'),
        }}
        // ADR-0028: selectable AI model — ChatbotEnhanced renders the footer
        // <select> only when 2+ models are offered (free / single-model envs
        // see none). The picked model flows to useObjectChat above.
        models={aiModels}
        selectedModelId={effectiveModelId}
        onModelChange={setSelectedModelId}
        suggestions={suggestions}
        onSendMessage={handleSend}
        onClear={clear}
        hideClearBar
        onStop={isLoading ? stop : undefined}
        onReload={reload}
        isLoading={isLoading}
        error={errorSuppressed ? undefined : error}
        enableMarkdown
        onToolApprove={hitl.decide}
        toolDecisions={hitl.decisions}
        toolApproveLabel="Approve & run"
        toolDenyLabel="Reject"
        toolDenyReason="Operator rejected from chat"
        // Build-tree "Open app": jump straight into the app the agent just built.
        onOpenBuiltApp={(appName, appSegment) =>
          navigate(`/apps/${encodeURIComponent(appSegment ?? appName)}`)}
        openBuiltAppLabel={t('console.ai.openBuiltApp', { defaultValue: 'Open app' })}
        // Live lifecycle truth for draft cards: the server's pending count per
        // package, so reloaded conversations show Published/Publish honestly.
        fetchPendingDraftCount={fetchPendingDraftCount}
        onPublishDrafts={async (packageId) => {
          // Promote the conversation's staged drafts to live (ADR-0033 gate —
          // the human still clicks). Same call as the floating chat + PackagesPage.
          try {
            const res = await fetch(
              `/api/v1/packages/${encodeURIComponent(packageId)}/publish-drafts`,
              {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: '{}',
              },
            );
            const payload = await res.json().catch(() => null);
            if (!res.ok || payload?.success === false) {
              throw new Error(payload?.error?.message || `HTTP ${res.status}`);
            }
            const failed = payload?.data?.failedCount ?? payload?.failedCount ?? 0;
            if (failed) throw new Error(String(failed));
            // Surface a seed-load problem (reported under `seedApplied`, never
            // thrown) so "Published!" can't hide silently empty tables.
            const seedApplied = payload?.data?.seedApplied ?? payload?.seedApplied;
            if (seedApplied && seedApplied.success === false) {
              toast.warning(
                t('console.ai.seedWarn', { defaultValue: 'Published, but some sample data failed to load.' }),
                {
                  description:
                    seedApplied.error ??
                    (Array.isArray(seedApplied.errors) && seedApplied.errors.length
                      ? String(seedApplied.errors[0])
                      : undefined),
                },
              );
            } else {
              toast.success(t('console.ai.publishOk', { defaultValue: 'Published — objects are now live.' }));
            }
            // The live registry just changed but the chat-card publish path
            // does not reload the page (unlike DraftPreviewBar). Pulse every
            // mounted MetadataProvider so open forms/views (incl. the canvas
            // preview) refetch the new schema instead of showing stale, empty
            // dropdowns until a manual reload.
            emitMetadataRefresh();
            // ADR-0038 L3 — hand the runtime verification (seedApplied +
            // probes) back to the chat so the Published card grows a
            // build-health line instead of claiming bare success.
            return { ok: true, health: publishHealthFromResponse(payload) };
          } catch (e) {
            toast.error(t('console.ai.publishFailed', { defaultValue: 'Publish failed' }), {
              description: e instanceof Error ? e.message : undefined,
            });
            return false;
          }
        }}
        publishDraftsLabel={t('console.ai.publishDrafts', { defaultValue: 'Publish' })}
        publishedLabel={t('console.ai.published', { defaultValue: 'Published' })}
        nextStepsLabel={t('console.ai.nextSteps', { defaultValue: "What's next" })}
        planTitleLabel={t('console.ai.planTitle', { defaultValue: 'Proposed plan' })}
        planQuestionsLabel={t('console.ai.planQuestions', { defaultValue: 'Confirm before building' })}
        planAssumptionsLabel={t('console.ai.planAssumptions', { defaultValue: 'Assumptions' })}
        planDeferredLabel={t('console.ai.planDeferred', { defaultValue: 'Not yet built' })}
        planApproveHintLabel={t('console.ai.planApproveHint', {
          defaultValue: 'Reply to approve or adjust this plan.',
        })}
        planApproveLabel={t('console.ai.planApprove', { defaultValue: 'Build it' })}
        planAdjustLabel={t('console.ai.planAdjust', { defaultValue: 'Adjust' })}
        planBuiltLabel={t('console.ai.planBuilt', { defaultValue: 'Built' })}
        planReadyLabel={t('console.ai.planReady', {
          defaultValue: 'The plan is ready. Build it now, or tell me what to adjust.',
        })}
        planApproveMessage={planApproveMessage}
        planApproveDefaultsMessage={planApproveDefaultsMessage}
        planAnswerMessage={(question, option) =>
          t('console.ai.planAnswerMessage', {
            question,
            option,
            defaultValue: 'For "{{question}}", go with: {{option}}.',
          })
        }
        // Self-use "magic moment": when the plan enables it, publish the drafted
        // app automatically the moment the agent finishes — no manual click; the
        // user refreshes and sees it live WITH data. Same governed endpoint.
        autoPublishDrafts={getRuntimeConfig().features.autoPublishAiBuilds}
        // ADR-0037 Live Canvas: open/refresh the draft-preview pane as the
        // agent's artifacts land; Preview buttons deep-link the same route.
        onDraftArtifacts={handleDraftArtifacts}
        onPreviewDraftApp={(appName, opts) =>
          setCanvasApp({ name: appName, segment: opts?.appSegment, materialized: opts?.materialized === true })}
        // ADR-0045: build materialized → canvas leaves the draft overlay for
        // the real (unlisted) app; the reload shows live seed rows.
        onBuildMaterialized={handleBuildMaterialized}
        previewDraftLabel={t('console.ai.previewDraft', { defaultValue: 'Preview' })}
        data-testid="ai-chat-panel"
      />
      </div>
      {canvasApp ? (
        <>
          {/* Draggable divider — resize the chat ↔ preview split. */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t('console.ai.resizeSplit', { defaultValue: 'Resize chat and preview' })}
            tabIndex={0}
            onPointerDown={split.onHandlePointerDown}
            onKeyDown={split.onHandleKeyDown}
            onDoubleClick={split.reset}
            data-testid="ai-chat-split-handle"
            className={cn(
              'group relative hidden w-1.5 shrink-0 cursor-col-resize touch-none select-none md:block',
              'focus:outline-none',
            )}
          >
            {/* Hit area is wider than the visible line for easier grabbing. */}
            <span aria-hidden className="absolute inset-y-0 -left-1.5 -right-1.5" />
            <span
              aria-hidden
              className={cn(
                'absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors',
                'group-hover:bg-primary/60 group-focus-visible:bg-primary',
                split.dragging && 'bg-primary',
              )}
            />
          </div>
          <LiveCanvas
            appName={canvasApp.name}
            appSegment={canvasApp.segment}
            materialized={canvasApp.materialized}
            refreshKey={canvasRefreshKey}
            onClose={() => setCanvasApp(null)}
          />
          {/* While dragging, an overlay above the canvas iframe keeps pointer
              events flowing to the window listeners (an iframe would otherwise
              swallow them) and shows the resize cursor everywhere. */}
          {split.dragging ? <div className="fixed inset-0 z-50 cursor-col-resize" data-testid="ai-chat-split-overlay" /> : null}
        </>
      ) : null}
    </div>
  );
}

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

function dataChatSuggestions(t: TranslationFn): string[] {
  return [
    t('console.ai.suggestions.dataChat.userCount', { defaultValue: 'How many users are in the system? List their emails.' }),
    t('console.ai.suggestions.dataChat.recentRecords', { defaultValue: 'List the 5 most recently created records.' }),
    t('console.ai.suggestions.dataChat.recordCounts', { defaultValue: 'Count records for each object.' }),
  ];
}

function metadataAssistantSuggestions(t: TranslationFn): string[] {
  // Creation-first starters: the authoring agent's job is to BUILD from a
  // natural-language description (the magic moment), so the empty-state nudges
  // toward "describe a system" rather than inspecting existing schema.
  return [
    t('console.ai.suggestions.metadataAssistant.buildCrm', { defaultValue: 'Build a sales CRM — customers, contacts, and a deal pipeline I can total by stage.' }),
    t('console.ai.suggestions.metadataAssistant.buildApp', { defaultValue: 'Create a project tracker — projects, tasks with owners and due dates, and a board by status.' }),
    t('console.ai.suggestions.metadataAssistant.buildFlow', { defaultValue: 'Design a support desk — tickets with priority, a status workflow, and customer links.' }),
    t('console.ai.suggestions.metadataAssistant.buildInventory', { defaultValue: 'Build an inventory app — products, stock levels, suppliers, and low-stock visibility.' }),
    t('console.ai.suggestions.metadataAssistant.buildRecruiting', { defaultValue: 'Make an applicant tracker — candidates, open roles, interview stages, and notes.' }),
  ];
}

function genericSuggestions(t: TranslationFn): string[] {
  return [
    t('console.ai.suggestions.generic.help', { defaultValue: 'What can you help me with?' }),
    t('console.ai.suggestions.generic.availableObjects', { defaultValue: 'List the available data objects.' }),
    t('console.ai.suggestions.generic.recentActivity', { defaultValue: 'Summarize my recent activity.' }),
  ];
}

function buildAgentSuggestions(
  agentName: string | undefined,
  agentLabel: string,
  t: TranslationFn,
): string[] {
  // Alias-aware: `ask`/`data_chat` → data starters, `build`/`metadata_assistant`
  // → authoring starters. Custom agents fall back to a name/label heuristic.
  if (isAskAgent(agentName)) return dataChatSuggestions(t);
  if (isBuildAgent(agentName)) return metadataAssistantSuggestions(t);
  const lower = (agentName ?? agentLabel).toLowerCase();
  if (lower.includes('data')) return dataChatSuggestions(t);
  if (lower.includes('metadata')) return metadataAssistantSuggestions(t);
  return genericSuggestions(t);
}

export default AiChatPage;

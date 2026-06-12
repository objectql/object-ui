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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
  ShareDialog,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@object-ui/components';
import { PanelLeft, Share2 } from 'lucide-react';
import {
  ChatbotEnhanced,
  useAgents,
  useObjectChat,
  useHitlInChat,
  resolveDefaultAgentName,
  publishHealthFromResponse,
  type AgentDescriptor,
  type ChatbotEnhancedToolInvocation,
  type ChatMessage,
} from '@object-ui/plugin-chatbot';

import { AppHeader } from '../../layout/AppHeader';
import { fetchPendingDraftCount } from '../../preview/draftStatus';
import { getRuntimeConfig } from '../../runtime-config';
import { useNavigationContext } from '../../context/NavigationContext';
import {
  sanitizeChatMessagesForCache,
  useChatConversation,
  writeConversationMessagesCache,
  type HydratedUIMessage,
  type HydratedUIMessagePart,
} from '../../hooks/useChatConversation';
import { ConversationsSidebar } from './ConversationsSidebar';
import { LiveCanvas } from './LiveCanvas';

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
        toolInvocations.push({
          toolCallId,
          toolName,
          ...(state ? { state } : {}),
          ...(part.errorText ? { errorText: String(part.errorText) } : {}),
        });
      }
    }

    return {
      id: message.id,
      role: message.role,
      content,
      ...(toolInvocations.length > 0 ? { toolInvocations } : {}),
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

const PLATFORM_AGENT_LABEL_KEYS: Record<string, { key: string; defaultValue: string }> = {
  data_chat: { key: 'console.ai.agentLabels.dataChat', defaultValue: 'Assistant' },
  metadata_assistant: { key: 'console.ai.agentLabels.metadataAssistant', defaultValue: 'Metadata Assistant' },
};

function localizeAgentLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  agentName: string | undefined,
  fallback: string,
): string {
  const known = agentName ? PLATFORM_AGENT_LABEL_KEYS[agentName] : undefined;
  if (!known) return fallback;
  return t(known.key, { defaultValue: known.defaultValue });
}

function resolveApiBase(explicit?: string): string {
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

export function AiChatPage({ apiBase: apiBaseProp, defaultAgent: defaultAgentProp }: AiChatPageProps = {}) {
  const { user } = useAuth();
  const { t } = useObjectTranslation();
  const userId = user?.id;
  const { conversationId: urlConversationId } = useParams<{ conversationId?: string }>();
  const [searchParams] = useSearchParams();
  // Deep-link entry point: `/ai?agent=metadata_assistant` opens the workspace
  // directly on a specific agent. Used by the AI-first home hero to land a new
  // user straight on the authoring assistant (the magic moment) instead of the
  // data-query default. Falls back gracefully when the agent isn't available.
  //
  // Captured ONCE at mount: this page immediately replaces `/ai` with
  // `/ai/:conversationId` (see the redirect effect below), which strips the
  // query string — so reading it lazily would lose the agent before the
  // selection effect runs. The initializer snapshots it before that race.
  const [agentParam] = useState<string | undefined>(() => searchParams.get('agent') ?? undefined);
  // Explicit new-conversation intent (`/ai?new=1`, the sidebar's New button).
  // Read LIVE (not snapshotted): the button can be clicked again later from an
  // existing conversation, and the flag is stripped once the fresh id is
  // mirrored into the URL.
  const forceNewConversation = searchParams.get('new') !== null;
  const navigate = useNavigate();
  const { setContext } = useNavigationContext();

  useEffect(() => {
    setContext('home');
  }, [setContext]);

  const apiBase = useMemo(() => resolveApiBase(apiBaseProp), [apiBaseProp]);
  const env = (import.meta as any).env ?? {};
  const envDefaultAgent = env.VITE_AI_DEFAULT_AGENT as string | undefined;

  const { agents, isLoading: agentsLoading, error: agentsError } = useAgents({ apiBase });

  const [activeAgent, setActiveAgent] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!activeAgent && agents.length > 0) {
      // Prefer the data-query agent over "first in catalog" so the
      // dedicated AI workspace opens on the same default the rest of the
      // platform binds to.
      const preferred = agentParam ?? defaultAgentProp ?? envDefaultAgent;
      const resolved = resolveDefaultAgentName(agents, preferred);
      if (resolved) setActiveAgent(resolved);
    }
  }, [agents, activeAgent, agentParam, defaultAgentProp, envDefaultAgent]);

  const chatApi = activeAgent
    ? `${apiBase}/agents/${encodeURIComponent(activeAgent)}/chat`
    : undefined;

  const { conversationId, initialMessages } = useChatConversation({
    userId,
    scope: activeAgent,
    apiBase,
    activeId: urlConversationId,
    forceNew: forceNewConversation,
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const [titleHints, setTitleHints] = useState<Record<string, string>>({});
  const [shareOpen, setShareOpen] = useState(false);
  const [mobileChatsOpen, setMobileChatsOpen] = useState(false);
  const restApiBase = useMemo(
    () => apiBase.replace(/\/v1\/ai$/, '').replace(/\/ai$/, '') || '/api',
    [apiBase],
  );

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

  // After the hook resolves a real id for a fresh `/ai` visit, mirror it into
  // the URL so the sidebar's active-row + share/refresh both work.
  useEffect(() => {
    if (!urlConversationId && conversationId) {
      if (staleNewTargetRef.current && staleNewTargetRef.current.id === conversationId) return;
      navigate(`/ai/${conversationId}`, { replace: true });
    }
  }, [urlConversationId, conversationId, navigate]);

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
        <div className="min-w-0 flex-1">
          <AppHeader variant="home" />
        </div>
      </header>
      <Sheet open={mobileChatsOpen} onOpenChange={setMobileChatsOpen}>
        <SheetContent side="left" className="w-[320px] p-0 sm:max-w-[360px]" data-testid="ai-chat-mobile-sidebar">
          <SheetHeader className="sr-only">
            <SheetTitle>{t('console.ai.chats')}</SheetTitle>
            <SheetDescription>{t('console.ai.chatsDescription')}</SheetDescription>
          </SheetHeader>
          <ConversationsSidebar
            userId={userId}
            apiBase={apiBase}
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
        />
      )}
      <div className="flex min-h-0 flex-1 w-full bg-muted/20">
        <ConversationsSidebar
          userId={userId}
          apiBase={apiBase}
          refreshKey={refreshKey}
          titleHints={titleHints}
          className="hidden w-72 shrink-0 border-r md:flex"
        />
        <main className="flex min-w-0 flex-1 flex-col">
          <ChatPane
            key={`${chatApi ?? 'local'}:${conversationId ?? 'pending'}`}
            agents={agents}
            agentsLoading={agentsLoading}
            agentsError={agentsError}
            activeAgent={activeAgent}
            onAgentChange={setActiveAgent}
            // ADR-0040: end users never pick an agent — the roster shows only
            // on explicit ?agent= pins (developer surfaces like Studio).
            showAgentPicker={Boolean(agentParam)}
            chatApi={chatApi}
            apiBase={apiBase}
            conversationId={conversationId}
            initialMessages={initialMessages}
            onSent={handleSent}
            onShare={() => setShareOpen(true)}
          />
        </main>
      </div>
    </div>
  );
}

interface ChatPaneProps {
  agents: AgentDescriptor[];
  agentsLoading: boolean;
  agentsError: Error | undefined;
  activeAgent: string | undefined;
  onAgentChange: (name: string) => void;
  /**
   * ADR-0040: the agent roster is NOT consumer UX. The picker renders only
   * when an explicit `?agent=` pin is present (builder/developer deep links,
   * e.g. Studio); end users see the resolved assistant's label.
   */
  showAgentPicker: boolean;
  chatApi: string | undefined;
  apiBase: string;
  conversationId: string | undefined;
  initialMessages: HydratedUIMessage[];
  onSent: (firstUserMessage?: string) => void;
  onShare: () => void;
}

function ChatPane({
  agents,
  agentsLoading,
  showAgentPicker,
  agentsError,
  activeAgent,
  onAgentChange,
  chatApi,
  apiBase,
  conversationId,
  initialMessages,
  onSent,
  onShare,
}: ChatPaneProps) {
  const { t } = useObjectTranslation();
  const navigate = useNavigate();

  // ── ADR-0037 Live Canvas ────────────────────────────────────────────────
  // When a build session drafts an `app`, open the split-view canvas: the
  // drafted app rendered as-if-published (`?preview=draft`) beside the chat.
  // Per-artifact signals coalesce (800 ms) into one pane refresh so a
  // whole-app build doesn't trigger an invalidation storm.
  const [canvasApp, setCanvasApp] = useState<{ name: string; materialized: boolean } | null>(null);
  const [canvasRefreshKey, setCanvasRefreshKey] = useState(0);
  const canvasTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (canvasTimerRef.current) window.clearTimeout(canvasTimerRef.current);
  }, []);
  const handleDraftArtifacts = useCallback((artifacts: Array<{ type: string; name: string }>) => {
    const app = artifacts.find((a) => a.type === 'app');
    if (app) setCanvasApp((prev) => prev ?? { name: app.name, materialized: false });
    if (canvasTimerRef.current) window.clearTimeout(canvasTimerRef.current);
    canvasTimerRef.current = window.setTimeout(() => setCanvasRefreshKey((k) => k + 1), 800);
  }, []);
  // ADR-0045: the build finished and was materialized (real tables + data,
  // app unlisted). Switch the open canvas from the draft overlay to the REAL
  // app URL — the reload that follows shows live rows in every list.
  const handleBuildMaterialized = useCallback((appName: string) => {
    setCanvasApp((prev) =>
      prev && prev.name === appName && !prev.materialized
        ? { name: appName, materialized: true }
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

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    stop,
    reload,
    clear,
  } = useObjectChat({
    api: chatApi,
    conversationId,
    body: {
      context: {
        activeApp: 'AI',
        agentName: activeAgent,
        // Tell the agent the environment's publish posture so its narration
        // matches reality (an auto-published build is live, not "to publish").
        autoPublishAiBuilds: getRuntimeConfig().features.autoPublishAiBuilds,
      },
    },
    initialMessages: hydrated,
    autoResponse: !chatApi,
    autoResponseText: "Thanks for your message! I'm here to help.",
    autoResponseDelay: 600,
  });

  useEffect(() => {
    writeConversationMessagesCache(
      conversationId,
      sanitizeChatMessagesForCache(messages as ChatMessage[]),
    );
  }, [conversationId, messages]);

  const hitl = useHitlInChat({
    messages: messages as ChatMessage[],
    apiBase,
    continueConversation: (prompt) => {
      sendMessage(prompt);
    },
  });

  const handleSend = useCallback(
    (content: string, files?: File[]) => {
      sendMessage(content, files);
      onSent(content);
    },
    [sendMessage, onSent],
  );

  const headerSlot = (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 pb-2 pt-3 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {showAgentPicker && agents.length > 0 ? (
          <Select value={activeAgent} onValueChange={onAgentChange} disabled={agentsLoading}>
            <SelectTrigger
              className="h-7 w-auto min-w-0 border-0 bg-transparent px-1.5 text-xs shadow-none hover:bg-accent focus:ring-0 focus:ring-offset-0 focus-visible:ring-1 focus-visible:ring-border/80 focus-visible:ring-offset-0 sm:min-w-[160px]"
              data-testid="ai-chat-agent-picker"
            >
              <SelectValue placeholder="Choose agent..." />
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
        ) : (
          <span className="truncate text-xs font-medium text-foreground/85">
            {activeAgentLabel}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
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
    <div className="flex min-h-0 flex-1 px-0">
      <div
        className={
          canvasApp
            ? 'flex min-h-0 w-[42%] min-w-[380px] max-w-[640px] shrink-0 justify-center'
            : 'flex min-h-0 flex-1 justify-center'
        }
      >
      <ChatbotEnhanced
        className="min-h-0 flex-1 bg-background md:max-w-5xl"
        surface="plain"
        maxHeight="100%"
        headerSlot={headerSlot}
        messages={messages as ChatMessage[]}
        placeholder={
          activeAgent
            ? t('console.ai.askAgent', { agent: activeAgentLabel })
            : agentsLoading
              ? t('console.ai.loadingAgents')
              : t('console.ai.askAnything')
        }
        labels={{
          emptyTitle: t('console.ai.emptyTitle'),
          emptyDescription: t('console.ai.emptyDescription'),
          clear: t('console.ai.clearConversation'),
          sendHint: t('console.ai.sendHint'),
          agentActivity: t('console.ai.agentActivity'),
          toolCompleted: t('console.ai.toolCompleted'),
          toolRunning: t('console.ai.toolRunning'),
          toolAwaitingApproval: t('console.ai.toolAwaitingApproval'),
          toolFailed: t('console.ai.toolFailed'),
          toolDetailsHidden: t('console.ai.toolDetailsHidden'),
          copy: t('console.ai.copy'),
          copied: t('console.ai.copied'),
          regenerate: t('console.ai.regenerate'),
          model: t('console.ai.model'),
          submit: t('console.ai.submit'),
          uploadFiles: t('console.ai.uploadFiles'),
          stopResponse: t('console.ai.stopResponse'),
          trace: t('console.ai.trace'),
          viewTrace: t('console.ai.viewTrace'),
        }}
        suggestions={suggestions}
        onSendMessage={handleSend}
        onClear={clear}
        hideClearBar
        onStop={isLoading ? stop : undefined}
        onReload={reload}
        isLoading={isLoading}
        error={error}
        enableMarkdown
        onToolApprove={hitl.decide}
        toolDecisions={hitl.decisions}
        toolApproveLabel="Approve & run"
        toolDenyLabel="Reject"
        toolDenyReason="Operator rejected from chat"
        // Build-tree "Open app": jump straight into the app the agent just built.
        onOpenBuiltApp={(appName) => navigate(`/apps/${encodeURIComponent(appName)}`)}
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
        // Self-use "magic moment": when the plan enables it, publish the drafted
        // app automatically the moment the agent finishes — no manual click; the
        // user refreshes and sees it live WITH data. Same governed endpoint.
        autoPublishDrafts={getRuntimeConfig().features.autoPublishAiBuilds}
        // ADR-0037 Live Canvas: open/refresh the draft-preview pane as the
        // agent's artifacts land; Preview buttons deep-link the same route.
        onDraftArtifacts={handleDraftArtifacts}
        onPreviewDraftApp={(appName, opts) =>
          setCanvasApp({ name: appName, materialized: opts?.materialized === true })}
        // ADR-0045: build materialized → canvas leaves the draft overlay for
        // the real (unlisted) app; the reload shows live seed rows.
        onBuildMaterialized={handleBuildMaterialized}
        previewDraftLabel={t('console.ai.previewDraft', { defaultValue: 'Preview' })}
        data-testid="ai-chat-panel"
      />
      </div>
      {canvasApp ? (
        <LiveCanvas
          appName={canvasApp.name}
          materialized={canvasApp.materialized}
          refreshKey={canvasRefreshKey}
          onClose={() => setCanvasApp(null)}
        />
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
    t('console.ai.suggestions.metadataAssistant.buildCrm', { defaultValue: 'Build a CRM: customers, contacts and opportunities, with relationships.' }),
    t('console.ai.suggestions.metadataAssistant.buildApp', { defaultValue: 'Create a project management app: projects, tasks and members.' }),
    t('console.ai.suggestions.metadataAssistant.buildFlow', { defaultValue: 'Design a ticketing system: tickets, priority and a status flow.' }),
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
  if (agentName === 'data_chat') {
    return dataChatSuggestions(t);
  }
  if (agentName === 'metadata_assistant') {
    return metadataAssistantSuggestions(t);
  }
  const lower = (agentName ?? agentLabel).toLowerCase();
  if (lower.includes('data')) return dataChatSuggestions(t);
  if (lower.includes('metadata')) return metadataAssistantSuggestions(t);
  return genericSuggestions(t);
}

export default AiChatPage;

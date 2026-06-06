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
import { useNavigate, useParams } from 'react-router-dom';
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
import { MessageSquare, PanelLeft, Share2 } from 'lucide-react';
import {
  ChatbotEnhanced,
  useAgents,
  useObjectChat,
  useHitlInChat,
  resolveDefaultAgentName,
  type AgentDescriptor,
  type ChatMessage,
} from '@object-ui/plugin-chatbot';

import { AppHeader } from '../../layout/AppHeader';
import { useNavigationContext } from '../../context/NavigationContext';
import { useChatConversation, type HydratedUIMessage } from '../../hooks/useChatConversation';
import { ConversationsSidebar } from './ConversationsSidebar';

const DEFAULT_AI_PATH = '/api/v1/ai';

const PLATFORM_AGENT_LABEL_KEYS: Record<string, { key: string; defaultValue: string }> = {
  data_chat: { key: 'console.ai.agentLabels.dataChat', defaultValue: 'Data Assistant' },
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
      const preferred = defaultAgentProp ?? envDefaultAgent;
      const resolved = resolveDefaultAgentName(agents, preferred);
      if (resolved) setActiveAgent(resolved);
    }
  }, [agents, activeAgent, defaultAgentProp, envDefaultAgent]);

  const chatApi = activeAgent
    ? `${apiBase}/agents/${encodeURIComponent(activeAgent)}/chat`
    : undefined;

  const { conversationId, initialMessages, isLoading: convoLoading } = useChatConversation({
    userId,
    scope: activeAgent,
    apiBase,
    activeId: urlConversationId,
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [mobileChatsOpen, setMobileChatsOpen] = useState(false);
  const restApiBase = useMemo(
    () => apiBase.replace(/\/v1\/ai$/, '').replace(/\/ai$/, '') || '/api',
    [apiBase],
  );

  // After the hook resolves a real id for a fresh `/ai` visit, mirror it into
  // the URL so the sidebar's active-row + share/refresh both work.
  useEffect(() => {
    if (!urlConversationId && conversationId) {
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

  const handleSent = useCallback(
    (firstUserMessage?: string) => {
      // New user turn → bump sidebar list so the row's preview/timestamp refreshes.
      setRefreshKey((k) => k + 1);

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
        <AppHeader variant="home" />
        <div className="hidden min-w-0 border-l pl-3 sm:flex sm:flex-col">
          <div className="flex items-center gap-1.5 text-sm font-medium leading-none">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
            {t('console.ai.workspaceTitle')}
          </div>
          <div className="mt-1 truncate text-[11px] text-muted-foreground">
            {t('console.ai.workspaceSubtitle')}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setShareOpen(true)}
            disabled={!conversationId}
            data-testid="ai-chat-share-button"
            title={conversationId ? t('console.ai.shareTitle') : t('console.ai.shareDisabledTitle')}
          >
            <Share2 className="h-3.5 w-3.5" />
            {t('console.ai.share')}
          </Button>
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
            chatApi={chatApi}
            apiBase={apiBase}
            conversationId={conversationId}
            initialMessages={initialMessages}
            hydrating={convoLoading}
            onSent={handleSent}
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
  chatApi: string | undefined;
  apiBase: string;
  conversationId: string | undefined;
  initialMessages: HydratedUIMessage[];
  hydrating: boolean;
  onSent: (firstUserMessage?: string) => void;
}

function ChatPane({
  agents,
  agentsLoading,
  agentsError,
  activeAgent,
  onAgentChange,
  chatApi,
  apiBase,
  conversationId,
  initialMessages,
  hydrating,
  onSent,
}: ChatPaneProps) {
  const { t } = useObjectTranslation();
  const activeAgentLabel = useMemo<string>(() => {
    const found = agents.find((a) => a.name === activeAgent);
    return localizeAgentLabel(t, activeAgent, found?.label ?? activeAgent ?? t('console.ai.assistant'));
  }, [agents, activeAgent, t]);

  const hydrated = useMemo<ChatMessage[]>(() => {
    return initialMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.parts.map((p) => p.text).join(''),
    }));
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
      },
    },
    initialMessages: hydrated,
    autoResponse: !chatApi,
    autoResponseText: "Thanks for your message! I'm here to help.",
    autoResponseDelay: 600,
  });

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

  const headerSlot =
    agents.length > 0 ? (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background/80 px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <div className="text-xs font-medium leading-none">{activeAgentLabel}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {hydrating
              ? t('console.ai.loadingHistory')
              : conversationId
                ? t('console.ai.conversationReady')
                : t('console.ai.preparingConversation')}
          </div>
        </div>
        <Select value={activeAgent} onValueChange={onAgentChange} disabled={agentsLoading}>
          <SelectTrigger className="h-7 w-full text-xs sm:w-[220px]" data-testid="ai-chat-agent-picker">
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
        {agentsError ? (
          <span
            className="text-[10px] text-amber-700 dark:text-amber-400"
            title={agentsError.message}
          >
            {t('console.ai.offlineDemoMode')}
          </span>
        ) : null}
      </div>
    ) : null;

  return (
    <div className="flex min-h-0 flex-1 justify-center px-0 md:px-4 md:py-4">
      <ChatbotEnhanced
        className="min-h-0 flex-1 rounded-none border-0 bg-background shadow-none md:max-w-5xl md:rounded-md md:border md:shadow-sm"
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
        }}
        suggestions={suggestions}
        onSendMessage={handleSend}
        onClear={clear}
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
            toast.success(t('console.ai.publishOk', { defaultValue: 'Published — objects are now live.' }));
          } catch (e) {
            toast.error(t('console.ai.publishFailed', { defaultValue: 'Publish failed' }), {
              description: e instanceof Error ? e.message : undefined,
            });
          }
        }}
        publishDraftsLabel={t('console.ai.publishDrafts', { defaultValue: 'Publish' })}
        data-testid="ai-chat-panel"
      />
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
  return [
    t('console.ai.suggestions.metadataAssistant.objectTypes', { defaultValue: 'Which object types are registered in the system?' }),
    t('console.ai.suggestions.metadataAssistant.userFields', { defaultValue: 'What fields does the sys_user object have?' }),
    t('console.ai.suggestions.metadataAssistant.userRelationships', { defaultValue: 'Describe the user-related object relationships.' }),
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

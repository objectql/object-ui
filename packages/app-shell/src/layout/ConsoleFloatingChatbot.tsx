/**
 * ConsoleFloatingChatbot
 *
 * Wires the global FAB chatbot to the framework's `@objectstack/service-ai`
 * backend (the `/api/v1/ai/agents/:agentName/chat` Vercel Data Stream
 * endpoint) and exposes an in-header agent picker.
 *
 * The chatbot pulls in `react-markdown` + `micromark` (~150 KB) which is
 * unused on every page until the AI assistant is enabled, so deferring it
 * keeps those bytes off the initial paint.
 * @module
 */
import React from 'react';
import {
  FloatingChatbot,
  useObjectChat,
  useAgents,
  useHitlInChat,
  resolveDefaultAgentName,
  uiMessagesToChatMessages,
  publishHealthFromResponse,
  type ChatMessage,
  type AgentDescriptor,
} from '@object-ui/plugin-chatbot';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
  ShareDialog,
} from '@object-ui/components';
import { Share2, SquarePen } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  sanitizeChatMessagesForCache,
  useChatConversation,
  writeConversationMessagesCache,
  type HydratedUIMessage,
} from '../hooks';
import { useAssistant, requestAssistantReview, emitCanvasInvalidate, type AssistantEditorContext } from '../assistant/assistantBus';
import { getRuntimeConfig } from '../runtime-config';

/**
 * Display names for the built-in platform agents. The backend ships English
 * labels ("Data Assistant" / "Metadata Assistant"); we localize the known
 * ones here so the whole surface reads natively. Custom app agents fall back
 * to whatever label the backend provides.
 */
const PLATFORM_AGENT_LABELS: Record<string, { zh: string; en: string }> = {
  data_chat: { zh: '智能助手', en: 'Assistant' },
  metadata_assistant: { zh: '元数据开发助手', en: 'Metadata Assistant' },
};

function localizeAgentLabel(
  isZh: boolean,
  agentName: string | undefined,
  fallbackLabel: string,
): string {
  const known = agentName ? PLATFORM_AGENT_LABELS[agentName] : undefined;
  if (known) return isZh ? known.zh : known.en;
  return fallbackLabel;
}

/**
 * Localized UI strings + starter prompts for the floating assistant.
 * Keeps the chat surface in the user's language and gives non-expert users
 * concrete things to click instead of a blank input — the modern AI pattern.
 */
function buildChatLocale(
  language: string | undefined,
  appLabel: string,
  agentName: string | undefined,
  fallbackAgentLabel: string,
  objects: ConsoleObject[],
) {
  const isZh = (language ?? '').toLowerCase().startsWith('zh');
  const agentLabel = localizeAgentLabel(isZh, agentName, fallbackAgentLabel);
  const sampleObjects = objects.slice(0, 2).map((o) => o.label || o.name);

  if (isZh) {
    const suggestions = [
      sampleObjects[0] ? `查询最近创建的${sampleObjects[0]}` : '帮我查询最近的数据',
      sampleObjects[0] ? `统计${sampleObjects[0]}的总数量` : '统计各对象的记录数量',
      sampleObjects[1]
        ? `${sampleObjects[1]}有哪些字段？`
        : '当前应用里有哪些数据对象？',
    ].filter(Boolean);
    return {
      agentLabel,
      labels: {
        emptyTitle: `你好，我是${agentLabel}`,
        emptyDescription: `随时帮你查询和分析「${appLabel}」中的数据。试试下面的问题，或直接输入你的需求。`,
        clear: '清空对话',
        sendHint: '发送',
        agentActivity: '执行过程',
        toolCompleted: '已完成',
        toolRunning: '运行中',
        toolAwaitingApproval: '等待确认',
        toolFailed: '失败',
        toolDetailsHidden: '已隐藏工具参数和原始结果，仅保留过程摘要。',
        copy: '复制',
        copied: '已复制',
        regenerate: '重新生成',
        model: '模型',
        submit: '发送',
        uploadFiles: '上传文件',
        stopResponse: '停止生成',
        trace: '调试 trace',
        viewTrace: '查看调试 trace',
      },
      placeholder: `向${agentLabel}提问…`,
      loadingPlaceholder: '正在加载助手…',
      title: `${appLabel} 智能助手`,
      newChat: '开启新对话',
      share: '分享对话',
      reviewDraft: (n: number) => `查看 ${n} 项变更`,
      publishDrafts: '发布',
      published: '已发布',
      publishOk: '已发布，对象已生效。',
      publishFailed: '发布失败',
      seedWarn: '已发布，但部分示例数据未能载入。',
      openBuiltApp: '打开应用',
      suggestions,
    };
  }

  const suggestions = [
    sampleObjects[0] ? `Show the latest ${sampleObjects[0]}` : 'Show my most recent records',
    sampleObjects[0] ? `How many ${sampleObjects[0]} are there?` : 'Count records by status',
    sampleObjects[1]
      ? `What fields does ${sampleObjects[1]} have?`
      : 'What data can I work with here?',
  ].filter(Boolean);
  return {
    agentLabel,
    labels: {
      emptyTitle: `Hi, I'm ${agentLabel}`,
      emptyDescription: `I can help you query and analyze your ${appLabel} data. Try a prompt below, or just type your question.`,
      clear: 'Clear',
      sendHint: 'to send',
      agentActivity: 'Agent activity',
      toolCompleted: 'Completed',
      toolRunning: 'Running',
      toolAwaitingApproval: 'Awaiting approval',
      toolFailed: 'Failed',
      toolDetailsHidden: 'Tool inputs and raw results are hidden in this view.',
      copy: 'Copy',
      copied: 'Copied',
      regenerate: 'Regenerate',
      model: 'Model',
      submit: 'Submit',
      uploadFiles: 'Upload files',
      stopResponse: 'Stop response',
      trace: 'trace',
      viewTrace: 'View trace',
    },
    placeholder: `Ask ${agentLabel}...`,
    loadingPlaceholder: 'Loading assistant...',
    title: `${appLabel} Assistant`,
    newChat: 'New chat',
    share: 'Share conversation',
    reviewDraft: (n: number) => `Review ${n} change${n === 1 ? '' : 's'}`,
    publishDrafts: 'Publish',
    published: 'Published',
    publishOk: 'Published — objects are now live.',
    publishFailed: 'Publish failed',
    seedWarn: 'Published, but some sample data failed to load.',
    openBuiltApp: 'Open app',
    suggestions,
  };
}

interface ConsoleObject {
  name: string;
  label?: string;
}

export interface ConsoleFloatingChatbotProps {
  appLabel: string;
  /**
   * Machine name of the active app (e.g. "studio", "crm"). Forwarded as
   * `context.appName` so the backend can scope skills/resolution to the
   * current application surface.
   */
  appName?: string;
  objects: ConsoleObject[];
  /**
   * Base URL of the AI service. Defaults to `${VITE_SERVER_URL}/api/v1/ai`
   * (or the relative `/api/v1/ai` when no server URL is configured).
   */
  apiBase?: string;
  /**
   * Agent the app is bound to (`app.defaultAgent`). When set, the chatbot
   * opens straight onto this agent — Studio → `metadata_assistant`, every
   * other app falls through to the platform data-query agent (`data_chat`).
   */
  defaultAgent?: string;
  /**
   * Show the in-header agent switcher. Off by default: end users get the
   * single agent bound to their app and never have to choose. Enable for
   * power users / admins (or via `VITE_AI_SHOW_AGENT_PICKER`) when a
   * surface genuinely exposes multiple agents.
   */
  showAgentPicker?: boolean;
  /** Whether the floating panel should open immediately on mount. */
  defaultOpen?: boolean;
  /**
   * Authenticated user id. When provided, the chat hydrates from (and writes
   * to) a server-backed `ai_conversations` row keyed by `userId` + agent.
   * Inert until defined — the floating panel still works in local-only mode.
   */
  userId?: string;
}

const DEFAULT_AI_PATH = '/api/v1/ai';

function resolveApiBase(explicit?: string): string {
  if (explicit) return explicit.replace(/\/$/, '');
  const env = (import.meta as any).env ?? {};
  const fromEnv = env.VITE_AI_BASE_URL as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const serverUrl = (env.VITE_SERVER_URL as string | undefined) ?? '';
  return `${serverUrl.replace(/\/$/, '')}${DEFAULT_AI_PATH}`;
}

/**
 * Inner component that owns the chat hook. Re-mounted (via `key`) whenever
 * the active agent changes so `useObjectChat`'s first-render mode lock
 * (api vs local) picks up the new endpoint.
 */
/**
 * Starter prompts tailored to the metadata item currently open in a
 * designer. Returns null when nothing relevant is being edited, so the
 * caller falls back to the generic agent suggestions.
 */
function buildEditorSuggestions(
  editor: AssistantEditorContext | null,
  language: string,
): string[] | null {
  if (!editor || editor.type !== 'object') return null;
  const subject = editor.label || editor.name || 'this object';
  const zh = (language ?? '').toLowerCase().startsWith('zh');
  return zh
    ? [`为「${subject}」补充字段`, `为「${subject}」建议校验规则`, '添加一个状态选项字段']
    : [`Add fields to ${subject}`, `Suggest validations for ${subject}`, 'Add a status picklist field'];
}

interface ChatbotInnerProps {
  appLabel: string;
  appName?: string;
  objects: ConsoleObject[];
  agents: AgentDescriptor[];
  agentsLoading: boolean;
  agentsError: Error | undefined;
  activeAgent: string | undefined;
  onAgentChange: (name: string) => void;
  /** Whether to render the in-header agent switcher. */
  showAgentPicker: boolean;
  chatApi: string | undefined;
  /**
   * Base URL of the AI service (no trailing slash). Forwarded to
   * `useHitlInChat` so the inline approve/reject buttons can hit
   * `POST /pending-actions/:id/{approve,reject}` on the right host.
   */
  apiBase: string;
  /** Whether the floating panel should open immediately on mount. */
  defaultOpen?: boolean;
  /**
   * Resolved server conversation id. When set, `useObjectChat`'s
   * `conversationId` switches to it (so request bodies carry the real id and
   * server-side auto-persist kicks in). Undefined while hydrating.
   */
  conversationId?: string;
  /**
   * Previously-saved messages for the resolved conversation. Replayed into
   * the chat UI on mount so a page refresh shows the user's prior history
   * instead of an empty "welcome" thread.
   */
  initialMessages?: HydratedUIMessage[];
}

function ChatbotInner({
  appLabel,
  appName,
  objects,
  agents,
  agentsLoading,
  activeAgent,
  onAgentChange,
  showAgentPicker,
  chatApi,
  apiBase,
  defaultOpen = false,
  conversationId,
  initialMessages: persistedMessages,
}: ChatbotInnerProps) {
  const { language } = useObjectTranslation();
  const navigate = useNavigate();

  // What the user is currently editing in a designer (if any). Merged into
  // the agent context so "add a priority field" acts on the open object,
  // and drives context-aware starter suggestions.
  const { editor } = useAssistant();

  // Replay persisted history when present.
  const hydratedHistory = React.useMemo<ChatMessage[]>(() => {
    if (!persistedMessages || persistedMessages.length === 0) return [];
    return uiMessagesToChatMessages(persistedMessages as any) as ChatMessage[];
  }, [persistedMessages]);

  const activeAgentLabel = React.useMemo<string>(() => {
    const found = agents.find((a) => a.name === activeAgent);
    return found?.label ?? activeAgent ?? appLabel;
  }, [agents, activeAgent, appLabel]);

  // Localized labels, placeholder, title and contextual starter prompts.
  const locale = React.useMemo(
    () => buildChatLocale(language, appLabel, activeAgent, activeAgentLabel, objects),
    [language, appLabel, activeAgent, activeAgentLabel, objects],
  );

  // When a designer is open, prefer starter prompts about that item.
  const editorSuggestions = React.useMemo(
    () => buildEditorSuggestions(editor, language),
    [editor, language],
  );

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
        activeApp: appLabel,
        appName,
        objects: objects.map((o) => ({ name: o.name, label: o.label })),
        agentName: activeAgent,
        // Publish posture, so the agent's narration matches reality (an
        // auto-published build is live, not "to publish").
        autoPublishAiBuilds: getRuntimeConfig().features.autoPublishAiBuilds,
        // The metadata item currently open in a designer, so the agent
        // can act on "this object/view/…" without the user restating it.
        ...(editor ? { editing: editor } : {}),
      },
    },
    // Start empty so the modern empty-state + starter prompts render. We no
    // longer inject a synthetic "welcome" bubble — the agent identity now
    // lives in the empty-state title, matching mainstream AI tools.
    initialMessages: hydratedHistory,
    // Local-mode fallback: only used when `chatApi` is undefined (no agent
    // resolved yet, or no backend available). Keeps the UI usable.
    autoResponse: !chatApi,
    autoResponseText: objects.length > 0
      ? `I can help you work with ${objects
          .map((o) => o.label || o.name)
          .join(', ')}. What would you like to do?`
      : "Thanks for your message! I'm here to help you navigate and manage your data.",
    autoResponseDelay: 600,
  });

  React.useEffect(() => {
    writeConversationMessagesCache(
      conversationId,
      sanitizeChatMessagesForCache(messages as ChatMessage[]),
    );
  }, [conversationId, messages]);

  // HITL bridge — turns the pending-approval tool result envelope from the
  // framework's action-tools.ts into inline approve/reject buttons that talk
  // directly to /api/v1/ai/pending-actions/:id/{approve,reject}. After a
  // successful decision the hook synthesises a short follow-up user message
  // so the LLM continues the conversation aware of the outcome.
  const hitl = useHitlInChat({
    messages: messages as ChatMessage[],
    apiBase,
    continueConversation: (prompt) => {
      sendMessage(prompt);
    },
  });

  // Agent switcher — deliberately hidden by default. End users get the
  // single agent bound to their app (Studio → metadata_assistant, others
  // → data_chat) and are never asked to choose. Only surfaces when the
  // host explicitly opts in AND there is more than one agent to pick.
  const headerExtra =
    showAgentPicker && agents.length > 1 ? (
      <Select
        value={activeAgent}
        onValueChange={onAgentChange}
        disabled={agentsLoading}
      >
        <SelectTrigger
          className="h-7 w-[180px] text-xs"
          data-testid="floating-chatbot-agent-picker"
        >
          <SelectValue placeholder="Choose agent..." />
        </SelectTrigger>
        <SelectContent align="end">
          {agents.map((agent: AgentDescriptor) => (
            <SelectItem key={agent.name} value={agent.name} className="text-xs">
              <span className="font-medium">{agent.label}</span>
              {agent.description ? (
                <span className="block text-muted-foreground text-[10px] truncate max-w-[220px]">
                  {agent.description}
                </span>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : null;

  // Share-link control. Sits to the left of the panel's built-in
  // fullscreen / close buttons so users can mint a public link without
  // jumping out to the full `/ai/:id` page.
  const [shareOpen, setShareOpen] = React.useState(false);
  const restApiBase = React.useMemo(
    () => apiBase.replace(/\/v1\/ai$/, '').replace(/\/ai$/, '') || '/api',
    [apiBase],
  );
  const headerActions = (
    <>
      {messages.length > 0 ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label={locale.newChat}
          title={locale.newChat}
          data-testid="floating-chatbot-new"
          onClick={clear}
        >
          <SquarePen className="h-4 w-4" />
        </Button>
      ) : null}
      {conversationId ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label={locale.share}
          title={locale.share}
          data-testid="floating-chatbot-share"
          onClick={() => setShareOpen(true)}
        >
          <Share2 className="h-4 w-4" />
        </Button>
      ) : null}
    </>
  );

  return (
    <>
      <FloatingChatbot
        floatingConfig={{
          position: 'bottom-right',
          defaultOpen,
          panelWidth: 420,
          panelHeight: 560,
          title: locale.title,
          triggerSize: 56,
        }}
        headerExtra={headerExtra}
        headerActions={headerActions}
        messages={messages as ChatMessage[]}
        labels={locale.labels}
        showAvatars
        hideClearBar
        assistantAvatarFallback={locale.agentLabel}
        suggestions={messages.length === 0 ? (editorSuggestions ?? locale.suggestions) : undefined}
        placeholder={
          activeAgent
            ? locale.placeholder
            : agentsLoading
              ? locale.loadingPlaceholder
              : locale.placeholder
        }
        onSendMessage={(content: string) => sendMessage(content)}
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
        onReviewDraft={(items) => {
          // ADR-0033 Phase B: open the first drafted item in the designer's
          // review/diff. The remaining items stay drafted and surface their
          // own review when opened. The host navigator (AppContent) knows the
          // app base and performs the routing.
          if (items[0]) requestAssistantReview(items[0]);
        }}
        toolReviewLabel={locale.reviewDraft}
        // Build-tree "Open app": jump straight into the app the agent just
        // built (the panel only shows this once the build reports done).
        onOpenBuiltApp={(appName) => navigate(`/apps/${encodeURIComponent(appName)}`)}
        openBuiltAppLabel={locale.openBuiltApp}
        // ADR-0037: see the drafted app as-if-published before Publish — same
        // route, draft overlay, watermark bar on top.
        onPreviewDraftApp={(appName, opts) =>
          navigate(
            // ADR-0045: a materialized build is a REAL (unlisted) app — open it
            // directly; the UnpublishedAppBar narrates. Drafts keep the overlay.
            opts?.materialized
              ? `/apps/${encodeURIComponent(appName)}`
              : `/apps/${encodeURIComponent(appName)}?preview=draft`,
          )}
        // ADR-0037 P2.5: announce drafted artifacts so an open ?preview=draft
        // page (same document) drops its cache and refetches the new draft.
        onDraftArtifacts={(artifacts) => {
          for (const a of artifacts) emitCanvasInvalidate(a);
        }}
        onPublishDrafts={async (packageId) => {
          // ADR-0033 — promote the conversation's staged drafts to live in one
          // click (the human still confirms here). Mirrors PackagesPage's
          // publish-drafts call; cookie-authenticated like the rest of the SPA.
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
            // The protocol materializes published `seed` rows and reports under
            // `seedApplied` — a data problem never fails the publish, so it
            // must be surfaced HERE or the user lands on an app with silently
            // empty tables (the staging "No rows" incident).
            const seedApplied = payload?.data?.seedApplied ?? payload?.seedApplied;
            if (seedApplied && seedApplied.success === false) {
              toast.warning(locale.seedWarn, {
                description:
                  seedApplied.error ??
                  (Array.isArray(seedApplied.errors) && seedApplied.errors.length
                    ? String(seedApplied.errors[0])
                    : undefined),
              });
            } else {
              toast.success(locale.publishOk);
            }
            // Publish & Open: land the user ON the thing they just built rather
            // than leaving them on an empty home with only a toast. Prefer the
            // published App (a full navigable surface); the bare-object case has
            // no app to open yet, so the toast is the only feedback there.
            const published: Array<{ type?: string; name?: string }> =
              payload?.data?.published ?? payload?.published ?? [];
            const app = published.find((p) => p?.type === 'app' && p?.name);
            if (app?.name) navigate(`/apps/${encodeURIComponent(app.name)}`);
            // ADR-0038 L3 — hand the runtime verification (seedApplied +
            // probes) back to the chat so the Published card grows a
            // build-health line instead of claiming bare success.
            return { ok: true, health: publishHealthFromResponse(payload) };
          } catch (e) {
            toast.error(locale.publishFailed, {
              description: e instanceof Error ? e.message : undefined,
            });
            return false;
          }
        }}
        publishDraftsLabel={locale.publishDrafts}
        publishedLabel={locale.published}
        // Self-use "magic moment": when the plan enables it, auto-publish the
        // drafted app the instant the agent finishes — the success path above
        // then navigates straight to the live app, so "build" lands the user on
        // a populated, running app with no manual Publish click.
        autoPublishDrafts={getRuntimeConfig().features.autoPublishAiBuilds}
      />
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
    </>
  );
}

export default function ConsoleFloatingChatbot({
  appLabel,
  appName,
  objects,
  apiBase: apiBaseProp,
  defaultAgent: defaultAgentProp,
  showAgentPicker: showAgentPickerProp,
  defaultOpen = false,
  userId,
}: ConsoleFloatingChatbotProps) {
  const apiBase = React.useMemo(() => resolveApiBase(apiBaseProp), [apiBaseProp]);
  const env = (import.meta as any).env ?? {};
  const envDefaultAgent = env.VITE_AI_DEFAULT_AGENT as string | undefined;
  // Power-user / admin escape hatch: force the picker on globally without
  // touching app metadata.
  const showAgentPicker =
    showAgentPickerProp ?? env.VITE_AI_SHOW_AGENT_PICKER === 'true';

  const { agents, isLoading: agentsLoading, error: agentsError } = useAgents({ apiBase });

  const [activeAgent, setActiveAgent] = React.useState<string | undefined>(undefined);
  React.useEffect(() => {
    if (!activeAgent && agents.length > 0) {
      // Mirror the backend's resolution: app.defaultAgent → data_chat →
      // first agent. This binds the right copilot per app instead of
      // landing on whichever agent happens to be first in the catalog.
      const preferred = defaultAgentProp ?? envDefaultAgent;
      const resolved = resolveDefaultAgentName(agents, preferred);
      if (resolved) setActiveAgent(resolved);
    }
  }, [agents, activeAgent, defaultAgentProp, envDefaultAgent]);

  const chatApi = activeAgent
    ? `${apiBase}/agents/${encodeURIComponent(activeAgent)}/chat`
    : undefined;

  // Server-backed conversation. Scoped by agent so each agent gets its own
  // persistent history. Hook is inert until `userId` is provided; without it
  // the FAB continues to work in local-only mode (no persistence).
  const { conversationId, initialMessages } = useChatConversation({
    userId,
    scope: activeAgent,
    apiBase,
  });

  // `key` forces a clean remount whenever the chat endpoint OR the resolved
  // conversation id changes — required because `useObjectChat` locks its mode
  // (api vs local) and its `conversationId` on first render.
  return (
    <ChatbotInner
      key={`${chatApi ?? 'local'}:${conversationId ?? 'pending'}`}
      appLabel={appLabel}
      appName={appName}
      objects={objects}
      agents={agents}
      agentsLoading={agentsLoading}
      agentsError={agentsError}
      activeAgent={activeAgent}
      onAgentChange={setActiveAgent}
      showAgentPicker={showAgentPicker}
      chatApi={chatApi}
      apiBase={apiBase}
      defaultOpen={defaultOpen}
      conversationId={conversationId}
      initialMessages={initialMessages}
    />
  );
}

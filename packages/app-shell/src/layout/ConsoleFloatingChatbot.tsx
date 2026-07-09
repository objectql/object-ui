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
import { useReconcileOnError } from '../hooks/useReconcileOnError';
import {
  FloatingChatbot,
  useObjectChat,
  useAgents,
  useAiModels,
  useHitlInChat,
  resolveDefaultAgentName,
  uiMessagesToChatMessages,
  publishHealthFromResponse,
  agentRouteName,
  type ChatMessage,
  type AgentDescriptor,
} from '@object-ui/plugin-chatbot';
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
} from '@object-ui/components';
import { Share2, SquarePen } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  sanitizeChatMessagesForCache,
  useChatConversation,
  writeConversationMessagesCache,
  type HydratedUIMessage,
} from '../hooks';
import { useAssistant, requestAssistantReview, emitCanvasInvalidate, emitMetadataRefresh, type AssistantEditorContext } from '../assistant/assistantBus';
import { fetchPendingDraftCount } from '../preview/draftStatus';
import { getRuntimeConfig } from '../runtime-config';
import { cloudPricingDeepLink } from '../console/marketplace/marketplaceApi';
import { shouldShowAgentPicker } from './agentPicker';
import { detectConversationLanguage } from '../console/ai/conversationLanguage';

/**
 * Display names for the two built-in platform agents (ADR-0063: `ask` / `build`,
 * bound by surface). The backend ships English labels ("Assistant" / "Builder");
 * we localize the known ones here so the whole surface reads natively. Custom
 * app agents fall back to whatever label the backend provides.
 *
 * Keyed by the FRIENDLY name (alias-group head) so the canonical id
 * (`ask`/`build`) and the legacy alias (`data_chat`/`metadata_assistant`) both
 * resolve — independent of whatever label the backend record carries.
 */
const PLATFORM_AGENT_LABELS: Record<string, { zh: string; en: string }> = {
  ask: { zh: '智能助手', en: 'Assistant' },
  build: { zh: '构建助手', en: 'Build assistant' },
};

function localizeAgentLabel(
  isZh: boolean,
  agentName: string | undefined,
  fallbackLabel: string,
): string {
  const known = agentName ? PLATFORM_AGENT_LABELS[agentRouteName(agentName)] : undefined;
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
  // #772: the BUILD persona used to introduce itself with the ask persona's
  // "query and analyze your data" copy and metadata-Q&A starter chips — the
  // build entry point masqueraded as a data-question box. Give it its own
  // pitch and build-flavoured starters.
  const isBuild = agentRouteName(agentName ?? '') === 'build';

  if (isZh) {
    const suggestions = isBuild
      ? ['帮我搭一个客户跟进 CRM', '搭一个项目与任务管理应用', '给当前应用加一个仪表盘']
      : [
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
        emptyDescription: isBuild
          ? '告诉我你想管理什么，我会为你搭出完整应用——对象、视图、仪表盘和示例数据一次到位；也可以直接说要改哪里。'
          : `随时帮你查询和分析「${appLabel}」中的数据。试试下面的问题，或直接输入你的需求。`,
        clear: '清空对话',
        sendHint: '发送',
        agentActivity: '执行过程',
        toolCompleted: '已完成',
        toolRunning: '运行中',
        toolAwaitingApproval: '等待确认',
        toolFailed: '失败',
        connectionWaiting: '正在等待服务器响应…',
        connectionStalledLabel: '仍在处理中…',
        connectionOfflineLabel: '网络已断开，正在重连…',
        designingPlanLabel: '正在为你设计方案…',
        designingPlanHints: [
          '梳理需要记录的数据…',
          '设计对象与字段…',
          '关联相关记录…',
          '配置关系与查找字段…',
          '规划页面与视图…',
          '布置表单与列表…',
          '补充默认值与校验…',
          '规划一个看板来跟踪…',
          '复核整体结构是否自洽…',
          '汇总成完整方案…',
        ],
        toolDetailsHidden: '已隐藏工具参数和原始结果，仅保留过程摘要。',
        copy: '复制',
        copied: '已复制',
        regenerate: '重新生成',
        model: '模型',
        submit: '发送',
        uploadFiles: '上传文件',
        stopResponse: '停止生成',
        sendFailedRateLimited: '发送过于频繁，请稍候再试。你的消息已保留在输入框中。',
        sendFailedGeneric: '消息发送失败，请重试。你的消息已保留在输入框中。',
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
      nextSteps: '下一步',
      planTitle: '方案预览',
      planQuestions: '搭建前请确认',
      planAssumptions: '假设',
      planDeferred: '待补 / 暂未搭建',
      planApproveHint: '回复以确认或调整该方案。',
      planApprove: '开始搭建',
      planAdjust: '调整方案',
      planBuilt: '已搭建',
      planReady: '方案已就绪。点击开始搭建，或告诉我需要调整什么。',
      // These messages the button SENDS must match the cloud confirm gate's
      // APPROVAL_RE (service-ai-studio confirm-gate.ts) or the agent re-proposes
      // and "开始搭建" looks inert — the gate anchors Chinese approval on 确认 /
      // 直接搭建, so a bare "…搭建吧" does NOT match. Keep these 确认-anchored.
      planApproveMessage: '确认，开始搭建。',
      planApproveDefaultsMessage: '确认搭建，未决问题按你的合理假设和默认处理。',
      planAnswer: (question: string, option: string) => `关于「${question}」，我选择「${option}」。`,
      publishOk: '已发布，对象已生效。',
      publishFailed: '发布失败',
      seedWarn: '已发布，但部分示例数据未能载入。',
      openBuiltApp: '打开应用',
      suggestions,
    };
  }

  const suggestions = isBuild
    ? ['Build me a customer follow-up CRM', 'Build a project & task tracker', 'Add a dashboard to this app']
    : [
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
      emptyDescription: isBuild
        ? "Tell me what you want to manage and I'll build the app — objects, views, a dashboard and sample data in one go. Or just say what to change."
        : `I can help you query and analyze your ${appLabel} data. Try a prompt below, or just type your question.`,
      clear: 'Clear',
      sendHint: 'to send',
      agentActivity: 'Agent activity',
      toolCompleted: 'Completed',
      toolRunning: 'Running',
      toolAwaitingApproval: 'Awaiting approval',
      toolFailed: 'Failed',
      connectionWaiting: 'Waiting for server…',
      connectionStalledLabel: 'Still working…',
      connectionOfflineLabel: 'Connection lost — reconnecting…',
      designingPlanLabel: 'Designing your app…',
      designingPlanHints: [
        'Mapping out the data you’ll track…',
        'Shaping objects and their fields…',
        'Connecting related records…',
        'Setting up relationships and lookups…',
        'Planning the screens and views…',
        'Laying out forms and lists…',
        'Adding sensible defaults and validations…',
        'Sketching a dashboard to track it…',
        'Double-checking the structure hangs together…',
        'Pulling the plan together…',
      ],
      toolDetailsHidden: 'Tool inputs and raw results are hidden in this view.',
      copy: 'Copy',
      copied: 'Copied',
      regenerate: 'Regenerate',
      model: 'Model',
      submit: 'Submit',
      uploadFiles: 'Upload files',
      stopResponse: 'Stop response',
      sendFailedRateLimited:
        "You're sending messages too quickly. Your message is kept below — wait a moment and try again.",
      sendFailedGeneric: "Couldn't send your message. It's kept below — please try again.",
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
    nextSteps: "What's next",
    planTitle: 'Proposed plan',
    planQuestions: 'Confirm before building',
    planAssumptions: 'Assumptions',
    planDeferred: 'Not yet built',
    planApproveHint: 'Reply to approve or adjust this plan.',
    planApprove: 'Build it',
    planAdjust: 'Adjust',
    planBuilt: 'Built',
    planReady: 'The plan is ready. Build it now, or tell me what to adjust.',
    planApproveMessage: 'Looks good — build it as proposed.',
    planApproveDefaultsMessage: 'Build it with your best assumptions; use sensible defaults for the open questions.',
    planAnswer: (question: string, option: string) => `For "${question}", go with: ${option}.`,
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
   * Force the in-header agent switcher on (`true`) or off (`false`),
   * overriding the default. When left undefined the switcher auto-reveals
   * only when AI development is unlocked for the viewer — the live catalog
   * serves BOTH an `ask` and a `build` agent and `aiStudio` isn't disabled —
   * so pure end-user apps (only `ask`) stay clean while builders can flip
   * Ask↔Build inline. `VITE_AI_SHOW_AGENT_PICKER=true` also forces it on.
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

/** Segments after `:appName` that are route prefixes, not object names. */
const NON_OBJECT_ROUTE_SEGMENTS = new Set([
  'view', 'record', 'page', 'dashboard', 'design', 'report', 'metadata',
]);

/** Decode a URL segment, falling back to the raw value on malformed input. */
function safeDecodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Derive the object (and record) the user is currently viewing from the
 * console URL, so the agent can act on "this object" without the user
 * restating it. Mirrors the URL layout parsed by `useTrackRouteAsRecent`:
 *
 *   /apps/:appName/:objectName
 *   /apps/:appName/:objectName/:recordId
 *   /apps/:appName/:objectName/new
 *
 * Tolerates an optional shell prefix (e.g. `/_console`) by locating the
 * `apps` segment dynamically. Returns an empty object when the path isn't an
 * object route (dashboard/page/report/metadata) or the segment doesn't match
 * a known object in the current app.
 */
function resolveCurrentRouteObject(
  pathname: string,
  objects: ConsoleObject[],
): { objectName?: string; recordId?: string } {
  const parts = pathname.split('/').filter(Boolean);
  const appsIdx = parts.indexOf('apps');
  // Need at least [apps, appName, objectName].
  if (appsIdx === -1 || parts.length < appsIdx + 3) return {};

  const objectSeg = safeDecodeSegment(parts[appsIdx + 2]);
  if (NON_OBJECT_ROUTE_SEGMENTS.has(objectSeg)) return {};
  if (!objects.some((o) => o.name === objectSeg)) return {};

  const recordSeg = parts[appsIdx + 3] ? safeDecodeSegment(parts[appsIdx + 3]) : undefined;
  const recordId = recordSeg && recordSeg !== 'new' ? recordSeg : undefined;
  return { objectName: objectSeg, ...(recordId ? { recordId } : {}) };
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
  /**
   * Start a brand-new server conversation (the "New chat" button). Mints a
   * fresh `ai_conversations` row and switches to it — the old thread stays in
   * history. Without this the button only cleared the local message array while
   * the next turn kept appending to the SAME conversation server-side.
   */
  onNewChat: () => void;
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
  onNewChat,
}: ChatbotInnerProps) {
  const { language } = useObjectTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // The object/record the user is currently viewing in the runtime console,
  // derived from the route. Lets the agent answer "analyse this object" and
  // scope data queries to the open page without the user naming it.
  const currentRouteObject = React.useMemo(
    () => resolveCurrentRouteObject(location.pathname, objects),
    [location.pathname, objects],
  );

  // What the user is currently editing in a designer (if any). Merged into
  // the agent context so "add a priority field" acts on the open object,
  // and drives context-aware starter suggestions.
  const { editor } = useAssistant();

  // ADR-0028: the plan-filtered AI-model allowlist this env offers in the
  // picker (free / single-model envs return one entry → the footer picker
  // hides itself). The selected id is sent with each turn; the backend
  // validates it against the same allowlist and weights the quota by the
  // chosen model's cost_weight.
  const { models: aiModels, defaultModelId } = useAiModels({ apiBase });
  const [selectedModelId, setSelectedModelId] = React.useState<string | undefined>(undefined);
  const effectiveModelId = selectedModelId ?? defaultModelId;

  // Replay persisted history when present.
  const hydratedHistory = React.useMemo<ChatMessage[]>(() => {
    if (!persistedMessages || persistedMessages.length === 0) return [];
    return uiMessagesToChatMessages(persistedMessages as any) as ChatMessage[];
  }, [persistedMessages]);

  const activeAgentLabel = React.useMemo<string>(() => {
    const found = agents.find((a) => a.name === activeAgent);
    return found?.label ?? activeAgent ?? appLabel;
  }, [agents, activeAgent, appLabel]);

  // (locale is derived below, after the chat hook — it follows the
  // CONVERSATION language when one is established, not just the UI locale.)

  // ADR-0013 D2: reconcile a stream-transport failure instead of blindly
  // retrying. Shared across chat surfaces — see useReconcileOnError.
  const { errorSuppressed, handleChatError, setMessagesRef, resetSuppression } =
    useReconcileOnError({ chatApi, conversationId });

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
    // ADR-0028: the user's picked model (or the env default) — sent in each
    // request body; the agent route validates it + routes the turn to it.
    model: effectiveModelId,
    onError: handleChatError,
    body: {
      context: {
        activeApp: appLabel,
        appName,
        objects: objects.map((o) => ({ name: o.name, label: o.label })),
        agentName: activeAgent,
        // Publish posture, so the agent's narration matches reality (an
        // auto-published build is live, not "to publish").
        autoPublishAiBuilds: getRuntimeConfig().features.autoPublishAiBuilds,
        // The object/record currently open in the runtime console — the
        // backend injects its schema and scopes data queries to it, so
        // "analyse this object" works without the user naming it.
        ...(currentRouteObject.objectName ? { objectName: currentRouteObject.objectName } : {}),
        ...(currentRouteObject.recordId ? { recordId: currentRouteObject.recordId } : {}),
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
    setMessagesRef.current = setMessages;
  }, [setMessages]);

  React.useEffect(() => {
    writeConversationMessagesCache(
      conversationId,
      sanitizeChatMessagesForCache(messages as ChatMessage[]),
    );
  }, [conversationId, messages]);

  // #772 — the chat surface speaks the CONVERSATION's language. A Chinese
  // thread under an English console used to get English canned messages
  // ("Looks good — build it as proposed."), progress labels and starter chips
  // spliced into it. The conversation's own language wins; the UI locale is
  // the fallback until a thread establishes one.
  const effectiveLanguage = React.useMemo(
    () =>
      detectConversationLanguage(messages as ChatMessage[]) ??
      detectConversationLanguage(hydratedHistory) ??
      language,
    [messages, hydratedHistory, language],
  );

  // Localized labels, placeholder, title and contextual starter prompts.
  const locale = React.useMemo(
    () => buildChatLocale(effectiveLanguage, appLabel, activeAgent, activeAgentLabel, objects),
    [effectiveLanguage, appLabel, activeAgent, activeAgentLabel, objects],
  );

  // When a designer is open, prefer starter prompts about that item.
  const editorSuggestions = React.useMemo(
    () => buildEditorSuggestions(editor, effectiveLanguage),
    [editor, effectiveLanguage],
  );

  // HITL bridge — turns the pending-approval tool result envelope from the
  // framework's action-tools.ts into inline approve/reject buttons that talk
  // directly to /api/v1/ai/pending-actions/:id/{approve,reject}. After a
  // successful decision the hook synthesises a short follow-up user message
  // so the LLM continues the conversation aware of the outcome.
  const hitl = useHitlInChat({
    messages: messages as ChatMessage[],
    apiBase,
    continueConversation: (prompt) => {
      resetSuppression();
      sendMessage(prompt);
    },
  });

  // Agent switcher — Ask ↔ Build (plus any custom agents). Restrained by
  // design: end users bound to a single agent never see it. `showAgentPicker`
  // is true when AI development is unlocked (catalog serves both ask & build)
  // or forced on; it still needs more than one agent to be a real choice.
  //
  // For the common 2–3 agent case (Ask/Build) render a Claude-Code-style
  // segmented switcher so BOTH modes are visible at a glance — a dropdown hid
  // the distinction. Fall back to the compact Select when an env exposes many
  // custom agents and the inline pills would overflow the header.
  const isZh = (language ?? '').toLowerCase().startsWith('zh');
  const headerExtra = !(showAgentPicker && agents.length > 1) ? null : agents.length <= 3 ? (
    <Tabs value={activeAgent} onValueChange={onAgentChange}>
      <TabsList
        className="h-7 gap-0.5 p-0.5"
        data-testid="floating-chatbot-agent-picker"
      >
        {agents.map((agent: AgentDescriptor) => (
          <TabsTrigger
            key={agent.name}
            value={agent.name}
            disabled={agentsLoading}
            title={agent.description || undefined}
            className="h-6 px-2.5 text-xs"
          >
            {localizeAgentLabel(isZh, agent.name, agent.label)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  ) : (
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
  );

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
          onClick={onNewChat}
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
        onUpgrade={() => window.open(cloudPricingDeepLink(), '_blank', 'noopener,noreferrer')}
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
        // ADR-0028: model picker — ChatbotEnhanced renders the footer <select>
        // only when 2+ models are offered, so free / single-model envs see none.
        models={aiModels}
        selectedModelId={effectiveModelId}
        onModelChange={setSelectedModelId}
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
        onSendMessage={(content: string) => { resetSuppression(); sendMessage(content); }}
        onClear={clear}
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
        // Live lifecycle truth for draft cards: the server's pending count per
        // package, so reloaded conversations show Published/Publish honestly.
        fetchPendingDraftCount={fetchPendingDraftCount}
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
            // #772: the failure toast must say WHAT failed — the old
            // `throw new Error(String(failed))` surfaced a bare count
            // ("Publish failed — 2"), which the user cannot act on. Prefer the
            // per-item failure detail the publish endpoint reports.
            const failed = payload?.data?.failedCount ?? payload?.failedCount ?? 0;
            if (failed) {
              const failures: Array<{ type?: string; name?: string; error?: string }> =
                payload?.data?.failed ?? payload?.failed ?? [];
              const first = failures.find((f) => f?.error) ?? failures[0];
              const detail = first
                ? `${[first.type, first.name].filter(Boolean).join(' ')}${first.error ? `: ${first.error}` : ''}`
                : payload?.error?.message;
              throw new Error(
                detail
                  ? `${detail}${failed > 1 ? ` (+${failed - 1} more)` : ''}`
                  : `${failed} item(s) failed to publish`,
              );
            }
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
            // #771 — the launcher/app-switcher must learn about the newly
            // published app WITHOUT a page reload: pulse the metadata bus so
            // MetadataProvider refetches the 'app' type (AiChatPage's publish
            // path already does this; the floating panel was the gap that made
            // "open it from the launcher" a lie until F5).
            emitMetadataRefresh();
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
        nextStepsLabel={locale.nextSteps}
        planTitleLabel={locale.planTitle}
        planQuestionsLabel={locale.planQuestions}
        planAssumptionsLabel={locale.planAssumptions}
        planDeferredLabel={locale.planDeferred}
        planApproveHintLabel={locale.planApproveHint}
        planApproveLabel={locale.planApprove}
        planAdjustLabel={locale.planAdjust}
        planBuiltLabel={locale.planBuilt}
        planReadyLabel={locale.planReady}
        planApproveMessage={locale.planApproveMessage}
        planApproveDefaultsMessage={locale.planApproveDefaultsMessage}
        planAnswerMessage={locale.planAnswer}
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

  const { agents, isLoading: agentsLoading, error: agentsError } = useAgents({ apiBase });

  // Reveal the Build/Ask switcher only when AI development is unlocked for this
  // viewer — the live catalog serves BOTH an `ask` and a `build` agent and
  // authoring isn't deployment-disabled. Pure end-user apps (only `ask`) stay
  // clean; builders can flip "ask about my data" ↔ "extend my app" inline. An
  // explicit prop or `VITE_AI_SHOW_AGENT_PICKER` still forces it. See agentPicker.
  const showAgentPicker = shouldShowAgentPicker({
    agents,
    showAgentPickerProp,
    envOptIn: env.VITE_AI_SHOW_AGENT_PICKER === 'true',
    aiStudioEnabled: getRuntimeConfig().features.aiStudio !== false,
  });

  const [activeAgent, setActiveAgent] = React.useState<string | undefined>(undefined);
  React.useEffect(() => {
    if (!activeAgent && agents.length > 0) {
      // Resolution: app.defaultAgent → env default → BUILD (when offered) →
      // catalog fallback. #771: the catalog only serves `build` to users who
      // can build, and the build surface is the one that RESUMES its
      // conversation — landing them on the ask tab hid their in-progress
      // build thread behind a tab switch ("my build chat disappeared"), and
      // buried the primary capability. Users bound to ask-only see no change.
      const preferred =
        defaultAgentProp ??
        envDefaultAgent ??
        (agents.some((a) => agentRouteName(a.name) === 'build') ? 'build' : undefined);
      const resolved = resolveDefaultAgentName(agents, preferred);
      if (resolved) setActiveAgent(resolved);
    }
  }, [agents, activeAgent, defaultAgentProp, envDefaultAgent]);

  const chatApi = activeAgent
    ? `${apiBase}/agents/${encodeURIComponent(activeAgent)}/chat`
    : undefined;

  // The stateful BUILD surface resumes its in-progress conversation (staged
  // drafts + the awaiting-confirm plan would otherwise be orphaned on reload);
  // the ASK/data surface opens a fresh thread each visit (each question is
  // largely self-contained, and resuming stale data answers is confusing). See
  // `resumeMode` in useChatConversation.
  const isBuildAgent = activeAgent ? agentRouteName(activeAgent) === 'build' : false;

  // Server-backed conversation. Scoped by agent so each agent gets its own
  // persistent history. Hook is inert until `userId` is provided; without it
  // the FAB continues to work in local-only mode (no persistence). Gate `userId`
  // on the agent being resolved so the conversation binds to the right scope
  // from the first resolve (not a scopeless one during the catalog load).
  const { conversationId, initialMessages, startNew } = useChatConversation({
    userId: activeAgent ? userId : undefined,
    scope: activeAgent,
    apiBase,
    resumeMode: isBuildAgent ? 'resume' : 'fresh',
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
      onNewChat={startNew}
    />
  );
}

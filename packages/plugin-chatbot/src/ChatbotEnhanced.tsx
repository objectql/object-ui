/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * ChatbotEnhanced — composed on top of vendored Vercel AI Elements
 * (src/elements/, MIT). Public props remain backwards compatible with the
 * previous custom implementation; internally we now get:
 *  - multi-line auto-growing prompt input (PromptInput)
 *  - smart reverse-stick scroll (Conversation + useStickToBottom)
 *  - message action toolbar surface (Message.actions slot)
 *  - tool-call visualisation (Tool* family)
 *  - reasoning / chain-of-thought collapsible (Reasoning*)
 *  - inline citations / sources panel (Sources*)
 *  - suggestion chips on empty state (Suggestion / Suggestions)
 *  - streaming markdown via streamdown (used by Message internals)
 */
import * as React from 'react';
import { cn } from '@object-ui/components';
import { AlertCircle, Copy, Check, RefreshCw, CornerDownLeft, Bot, GitCompareArrows, Rocket } from 'lucide-react';
import type { ChatStatus } from 'ai';
import {
  humanizeToolName,
  summarizeChatError,
  unwrapToolResult,
} from './tool-display';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from './elements/conversation';
import {
  Message,
  MessageActions,
  MessageAction,
  MessageContent,
  MessageResponse,
  type MessageProps,
} from './elements/message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputAttachments,
  PromptInputAttachment,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
  type PromptInputMessage,
} from './elements/prompt-input';
import { Suggestion, Suggestions } from './elements/suggestion';
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from './elements/tool';
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from './elements/reasoning';
import {
  Sources,
  SourcesTrigger,
  SourcesContent,
  Source,
} from './elements/sources';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  avatar?: string;
  avatarFallback?: string;
  /** Streaming flag — surfaces a shimmer cursor on the assistant bubble. */
  streaming?: boolean;
  /**
   * Tool invocations attached to this message. Mirrors the AI SDK's
   * `ToolUIPart` shape (see `vercel/ai` v3) so we can render them with the
   * vendored `<Tool>` element without any extra mapping.
   */
  toolInvocations?: ChatToolInvocation[];
  /** Chain-of-thought / reasoning text emitted alongside the answer. */
  reasoning?: string;
  /** Optional citation / RAG sources for this assistant message. */
  sources?: ChatSource[];
  /** Optional backend trace id (e.g. `ai_traces.id`) for debugging. */
  traceId?: string;
}

export interface ChatToolInvocation {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  result?: unknown;
  errorText?: string;
  /**
   * AI SDK v6 lifecycle states for a tool part. Defaults to
   * `output-available` when only `result` is present and `input-available`
   * when only `args` is present.
   */
  state?:
    | 'input-streaming'
    | 'input-available'
    | 'approval-requested'
    | 'approval-responded'
    | 'output-available'
    | 'output-error'
    | 'output-denied';
  /**
   * ObjectStack HITL extension. When the framework's `action-tools.ts`
   * proposes a destructive action that requires human approval, the tool
   * result carries `{ status: 'pending_approval', pendingActionId: 'pa_…' }`.
   * `mapMessages.ts` lifts that id here so chat UIs can call the
   * `POST /api/v1/ai/pending-actions/:id/{approve,reject}` REST endpoints
   * without parsing the tool result JSON themselves.
   */
  pendingActionId?: string;
  /**
   * ObjectStack ADR-0033 extension. When a metadata-authoring tool stages a
   * change as a DRAFT, its result carries `{ status: 'drafted', type, name, … }`
   * (or a `drafted: [{type,name}]` batch from `apply_blueprint`). `mapMessages.ts`
   * lifts the reviewable targets here so chat UIs can render a "Review N
   * change(s)" affordance that opens the designer's review/diff. Nothing is
   * live until the human publishes — this is the review entry point.
   */
  draftReview?: { items: Array<{ type: string; name: string }>; summary?: string; packageId?: string };
}

export interface ChatSource {
  id?: string;
  title?: string;
  url: string;
}

/**
 * Localizable UI strings for the chat surface. Every field is optional and
 * falls back to an English default, keeping existing callers source-compatible.
 */
export interface ChatbotLabels {
  /** Empty-state heading shown before the first message. */
  emptyTitle?: string;
  /** Empty-state supporting line. */
  emptyDescription?: string;
  /** "Clear conversation" action label. */
  clear?: string;
  /** Trailing hint next to the send button (e.g. "to send"). */
  sendHint?: string;
}

export interface ChatbotEnhancedProps extends React.HTMLAttributes<HTMLDivElement> {
  messages?: ChatMessage[];
  placeholder?: string;
  /**
   * Send handler. Signature kept backwards compatible — `files` is the list
   * of attachments selected via the prompt-input action menu.
   */
  onSendMessage?: (message: string, files?: File[]) => void;
  onClear?: () => void;
  /** Stop the current streaming response */
  onStop?: () => void;
  /** Reload / retry the last assistant message */
  onReload?: () => void;
  disabled?: boolean;
  /** Whether the assistant is currently generating a response */
  isLoading?: boolean;
  /** Current streaming/API error */
  error?: Error;
  showTimestamp?: boolean;
  /**
   * Render avatars beside each message (assistant gets a bot glyph, the user
   * gets their initial / image). Defaults to false to preserve the previous
   * minimal layout for existing callers.
   */
  showAvatars?: boolean;
  userAvatarUrl?: string;
  userAvatarFallback?: string;
  assistantAvatarUrl?: string;
  assistantAvatarFallback?: string;
  /**
   * Hide the internal "clear conversation" strip. Hosts that surface a clear
   * / new-chat control in their own chrome (e.g. a floating panel header) set
   * this to avoid a redundant second header row.
   */
  hideClearBar?: boolean;
  maxHeight?: string;
  /** Kept for back-compat — markdown is now always rendered by streamdown. */
  enableMarkdown?: boolean;
  /** Enable the attachment action menu. */
  enableFileUpload?: boolean;
  /** Comma-separated list (or accept string) forwarded to the file picker. */
  acceptedFileTypes?: string;
  /** Max file size in bytes (default 10 MB). */
  maxFileSize?: number;
  /**
   * Optional suggestion chips rendered on the empty conversation state.
   * Clicking a chip submits the message immediately.
   */
  suggestions?: string[];
  /**
   * Optional UI string overrides for localization. Each field falls back
   * to its English default, so existing callers keep working unchanged.
   */
  labels?: ChatbotLabels;
  /**
   * Available LLM models for the picker (sourced from
   * `GET /api/v1/ai/models` exposed by `@objectstack/service-ai`).
   */
  models?: ChatbotModelOption[];
  /** Currently selected model id (controlled). */
  selectedModelId?: string;
  /** Fired when the user picks a different model. */
  onModelChange?: (modelId: string) => void;
  /**
   * Optional banner rendered between the message-count strip and the
   * conversation. Used by shell-level UIs (e.g. Studio's assistant status
   * row) without forcing them to fork the whole component.
   */
  headerSlot?: React.ReactNode;
  /**
   * Optional overlay rendered absolute-positioned above the prompt input.
   * Intended for slash-command palettes / inline suggestion popups.
   */
  promptOverlaySlot?: React.ReactNode;
  /**
   * Fired on every keystroke in the prompt textarea (forwarded from the
   * AI Elements `PromptInputTextarea`). Lets callers drive a slash-command
   * palette without owning the textarea state.
   */
  onInputChange?: (value: string) => void;
  /**
   * When provided, tool parts in `approval-requested` state render Approve /
   * Deny buttons inside their body. The callback receives the tool's
   * `toolCallId` (use it to look up the AI SDK approval id if different).
   */
  onToolApprove?: (toolCallId: string, approved: boolean, reason?: string) => void;
  /** Label for the approve button (default "Approve"). */
  toolApproveLabel?: string;
  /** Label for the deny button (default "Deny"). */
  toolDenyLabel?: string;
  /** Reason text sent with a denial response (default "User denied the operation"). */
  toolDenyReason?: string;
  /**
   * Client-side overlay for HITL approval outcomes, keyed by `toolCallId`.
   * Driven by `useHitlInChat` (or any caller-owned map). When an entry is
   * present for a tool in `approval-requested` state, the inline buttons are
   * hidden and the configured message renders in their place — giving the
   * operator immediate feedback while the server processes the decision.
   */
  toolDecisions?: Record<string, ToolDecisionState>;
  /**
   * When provided, tool parts whose result drafted metadata (ADR-0033) render a
   * "Review N change(s)" button inside their body. The callback receives the
   * reviewable `{ type, name }` targets; the host typically navigates to the
   * designer's review/diff. See `ChatToolInvocation.draftReview`.
   */
  onReviewDraft?: (items: Array<{ type: string; name: string }>) => void;
  /** Label for the review-draft button (default "Review {n} change(s)"). */
  toolReviewLabel?: (count: number) => string;
  /**
   * When provided AND the drafted tool result reported its owning `packageId`,
   * tool parts render a one-click "Publish" button so the human can promote the
   * staged drafts to live without leaving the conversation (the ADR-0033 gate
   * stays — the human still clicks). The host wires this to
   * `POST /api/v1/packages/:packageId/publish-drafts`.
   */
  onPublishDrafts?: (packageId: string) => void;
  /** Label for the publish-drafts button (default "Publish"). */
  publishDraftsLabel?: string;
}

export type ToolDecisionState =
  | { state: 'pending'; message?: string }
  | { state: 'success'; message?: string }
  | { state: 'error'; message: string };

export interface ChatbotModelOption {
  id: string;
  label?: string;
  provider?: string;
}

function formatMessageProps(role: ChatMessage['role']): MessageProps['from'] {
  // The vendored Message only knows user/assistant — render system as assistant
  // (FloatingChatbotProvider already renders system messages inline elsewhere).
  return role === 'user' ? 'user' : 'assistant';
}

/**
 * Heuristic: does a tool/output string look like JSON we should syntax-highlight
 * (object / array literal) rather than render as markdown? Plain prose, code
 * fences, and inline backticks should NOT be rendered as JSON.
 */
function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return false;
  if (!(t.startsWith('{') || t.startsWith('['))) return false;
  if (!(t.endsWith('}') || t.endsWith(']'))) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
}

const ChatbotEnhanced = React.forwardRef<HTMLDivElement, ChatbotEnhancedProps>(
  (
    {
      className,
      messages = [],
      placeholder = 'Type your message...',
      onSendMessage,
      onClear,
      onStop,
      onReload,
      disabled = false,
      isLoading = false,
      error,
      showTimestamp = false,
      showAvatars = false,
      userAvatarUrl,
      userAvatarFallback = 'You',
      assistantAvatarUrl,
      assistantAvatarFallback = 'AI',
      hideClearBar = false,
      maxHeight = '500px',
      enableMarkdown: _enableMarkdown = true,
      enableFileUpload = false,
      acceptedFileTypes = 'image/*,.pdf,.doc,.docx,.txt',
      maxFileSize = 10 * 1024 * 1024,
      suggestions,
      labels,
      models,
      selectedModelId,
      onModelChange,
      headerSlot,
      promptOverlaySlot,
      onInputChange,
      onToolApprove,
      toolApproveLabel = 'Approve',
      toolDenyLabel = 'Deny',
      toolDenyReason = 'User denied the operation',
      toolDecisions,
      onReviewDraft,
      toolReviewLabel = (n) => `Review ${n} change${n === 1 ? '' : 's'}`,
      onPublishDrafts,
      publishDraftsLabel = 'Publish',
      ...props
    },
    ref
  ) => {
    const promptStatus: ChatStatus = isLoading ? 'streaming' : 'ready';
    const [copiedId, setCopiedId] = React.useState<string | null>(null);

    // Resolve localizable strings once, English defaults preserved.
    const L = React.useMemo(
      () => ({
        emptyTitle: labels?.emptyTitle ?? 'Start a conversation',
        emptyDescription:
          labels?.emptyDescription ??
          'Ask anything — the assistant has access to your current app context.',
        clear: labels?.clear ?? 'Clear',
        sendHint: labels?.sendHint ?? 'to send',
      }),
      [labels],
    );

    const handleSubmit = React.useCallback(
      (payload: PromptInputMessage) => {
        const hasText = Boolean(payload.text?.trim());
        const files = payload.files
          ?.map((f) => (f as unknown as { file?: File }).file)
          .filter(Boolean) as File[] | undefined;
        const hasFiles = Boolean(files && files.length > 0);
        if (!(hasText || hasFiles)) return;
        onSendMessage?.(payload.text?.trim() ?? '', files);
      },
      [onSendMessage]
    );

    const handleSuggestionClick = React.useCallback(
      (text: string) => {
        onSendMessage?.(text);
      },
      [onSendMessage]
    );

    const handleCopy = React.useCallback((message: ChatMessage) => {
      void navigator.clipboard?.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId((prev) => (prev === message.id ? null : prev)), 1500);
    }, []);

    return (
      <div
        ref={ref}
        className={cn(
          'flex min-h-0 flex-col overflow-hidden rounded-lg border bg-background',
          className
        )}
        style={{ maxHeight }}
        {...props}
      >
        {onClear && !hideClearBar && messages.length > 0 && (
          <div className="flex items-center justify-end px-4 py-2 border-b bg-muted/30">
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {L.clear}
            </button>
          </div>
        )}

        {headerSlot ? (
          <div className="shrink-0 border-b bg-background/50">{headerSlot}</div>
        ) : null}

        <Conversation className="flex-1 min-h-0">
          <ConversationContent className="space-y-4 px-4 py-3">
            {messages.length === 0 ? (
              <ConversationEmptyState className="gap-4">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {assistantAvatarUrl ? (
                    <img
                      src={assistantAvatarUrl}
                      alt=""
                      className="size-full rounded-full object-cover"
                    />
                  ) : (
                    <Bot className="size-6" />
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium text-sm">{L.emptyTitle}</h3>
                  <p className="text-muted-foreground text-sm">
                    {L.emptyDescription}
                  </p>
                </div>
                {suggestions && suggestions.length > 0 ? (
                  <Suggestions className="justify-center">
                    {suggestions.map((s) => (
                      <Suggestion
                        key={s}
                        suggestion={s}
                        onClick={handleSuggestionClick}
                      />
                    ))}
                  </Suggestions>
                ) : null}
              </ConversationEmptyState>
            ) : (
              messages.map((message) => {
                const isUser = message.role === 'user';
                const tools = message.toolInvocations ?? [];
                const reasoning = message.reasoning?.trim();
                const sources = message.sources ?? [];
                const isEmptyAssistantStreaming =
                  !isUser &&
                  Boolean(message.streaming) &&
                  !message.content &&
                  tools.length === 0 &&
                  !reasoning;
                return (
                  <Message key={message.id} from={formatMessageProps(message.role)}>
                    <div
                      className={cn(
                        'flex w-full gap-2.5',
                        showAvatars
                          ? isUser
                            ? 'flex-row-reverse items-start'
                            : 'flex-row items-start'
                          : 'flex-col',
                      )}
                    >
                      {showAvatars ? (
                        <MessageAvatar
                          isUser={isUser}
                          url={isUser ? userAvatarUrl : assistantAvatarUrl}
                          fallback={isUser ? userAvatarFallback : assistantAvatarFallback}
                        />
                      ) : null}
                      <div
                        className={cn(
                          'flex min-w-0 flex-col gap-2',
                          showAvatars && !isUser && 'flex-1',
                        )}
                      >
                    <MessageContent>
                      {!isUser && reasoning ? (
                        <Reasoning
                          isStreaming={Boolean(message.streaming) && !message.content}
                          className="mb-2"
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{reasoning}</ReasoningContent>
                        </Reasoning>
                      ) : null}
                      {!isUser && tools.length > 0
                        ? tools.map((tool) => {
                            const state =
                              tool.state ??
                              (tool.errorText
                                ? 'output-error'
                                : tool.result !== undefined
                                  ? 'output-available'
                                  : 'input-available');
                            const partType = `tool-${tool.toolName}` as `tool-${string}`;
                            const decision = toolDecisions?.[tool.toolCallId];
                            const isAwaitingApproval =
                              state === 'approval-requested' && Boolean(onToolApprove) && !decision;
                            const hidePendingPayload =
                              state === 'approval-requested' && Boolean(tool.pendingActionId);
                            const friendlyTitle = humanizeToolName(tool.toolName);
                            const renderableResult = unwrapToolResult(tool.result);
                            const titleNode = (
                              <span className="inline-flex items-center gap-2">
                                <span>{friendlyTitle || tool.toolName}</span>
                                {friendlyTitle && friendlyTitle.toLowerCase() !== tool.toolName.toLowerCase() ? (
                                  <code className="rounded bg-muted px-1 py-px text-[10px] font-mono text-muted-foreground">
                                    {tool.toolName}
                                  </code>
                                ) : null}
                              </span>
                            );
                            return (
                              <Tool
                                key={tool.toolCallId}
                                defaultOpen={
                                  state === 'output-error' ||
                                  state === 'approval-requested' ||
                                  // Surface pending draft actions (Publish / Review)
                                  // immediately — they live inside ToolContent, so a
                                  // collapsed card hides the primary CTA from the user.
                                  Boolean(tool.draftReview && tool.draftReview.items.length > 0)
                                }
                              >
                                <ToolHeader
                                  type={partType}
                                  state={state}
                                  title={titleNode}
                                />
                                <ToolContent>
                                  {tool.args !== undefined ? (
                                    <ToolInput input={tool.args} />
                                  ) : null}
                                  {hidePendingPayload ? null : (
                                    <SmartToolOutput
                                      output={renderableResult}
                                      errorText={tool.errorText}
                                    />
                                  )}
                                  {decision ? (
                                    <div
                                      className={
                                        'flex items-center gap-2 p-3 border-t text-xs ' +
                                        (decision.state === 'error'
                                          ? 'bg-destructive/10 text-destructive'
                                          : decision.state === 'success'
                                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                            : 'bg-muted/30 text-muted-foreground')
                                      }
                                    >
                                      <span aria-hidden="true">
                                        {decision.state === 'pending'
                                          ? '⏳'
                                          : decision.state === 'success'
                                            ? '✓'
                                            : '✗'}
                                      </span>
                                      <span>
                                        {decision.message ??
                                          (decision.state === 'pending'
                                            ? 'Submitting decision…'
                                            : decision.state === 'success'
                                              ? 'Action approved and executed.'
                                              : 'Decision failed.')}
                                      </span>
                                    </div>
                                  ) : null}
                                  {isAwaitingApproval ? (
                                    <div className="flex gap-2 p-3 border-t bg-muted/30">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onToolApprove?.(tool.toolCallId, true)
                                        }
                                        className="inline-flex h-7 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                                      >
                                        {toolApproveLabel}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onToolApprove?.(
                                            tool.toolCallId,
                                            false,
                                            toolDenyReason,
                                          )
                                        }
                                        className="inline-flex h-7 items-center rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent"
                                      >
                                        {toolDenyLabel}
                                      </button>
                                    </div>
                                  ) : null}
                                  {tool.draftReview &&
                                  tool.draftReview.items.length > 0 &&
                                  (onReviewDraft ||
                                    (onPublishDrafts && tool.draftReview.packageId)) ? (
                                    <div className="flex items-center gap-2 p-3 border-t bg-muted/30">
                                      {onPublishDrafts && tool.draftReview.packageId ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onPublishDrafts(tool.draftReview!.packageId!)
                                          }
                                          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                                        >
                                          <Rocket className="size-3.5" />
                                          {publishDraftsLabel}
                                        </button>
                                      ) : null}
                                      {onReviewDraft ? (
                                        <button
                                          type="button"
                                          onClick={() => onReviewDraft(tool.draftReview!.items)}
                                          className={
                                            onPublishDrafts && tool.draftReview.packageId
                                              ? 'inline-flex h-7 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted'
                                              : 'inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90'
                                          }
                                        >
                                          <GitCompareArrows className="size-3.5" />
                                          {toolReviewLabel(tool.draftReview.items.length)}
                                        </button>
                                      ) : null}
                                      {tool.draftReview.summary ? (
                                        <span className="truncate text-xs text-muted-foreground">
                                          {tool.draftReview.summary}
                                        </span>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </ToolContent>
                              </Tool>
                            );
                          })
                        : null}
                      {isUser ? (
                        message.content ? (
                          <div className="whitespace-pre-wrap break-words">
                            {message.content}
                          </div>
                        ) : null
                      ) : isEmptyAssistantStreaming ? (
                        <ThinkingDots />
                      ) : message.content ? (
                        <MessageResponse>{message.content}</MessageResponse>
                      ) : null}
                      {message.streaming && !isEmptyAssistantStreaming ? (
                        <span
                          aria-hidden
                          className="ml-0.5 inline-block w-[2px] h-4 align-middle bg-current animate-pulse"
                        />
                      ) : null}
                      {!isUser && sources.length > 0 ? (
                        <Sources>
                          <SourcesTrigger count={sources.length} />
                          <SourcesContent>
                            {sources.map((s, i) => (
                              <Source
                                key={s.id ?? s.url ?? i}
                                href={s.url}
                                title={s.title ?? s.url}
                              />
                            ))}
                          </SourcesContent>
                        </Sources>
                      ) : null}
                      {showTimestamp && message.timestamp ? (
                        <div className="text-[10px] opacity-70 mt-1">{message.timestamp}</div>
                      ) : null}
                    </MessageContent>
                    {!isUser && !isEmptyAssistantStreaming ? (
                      <MessageActions className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                        <MessageAction
                          label="Copy"
                          tooltip="Copy"
                          onClick={() => handleCopy(message)}
                        >
                          {copiedId === message.id ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </MessageAction>
                        {onReload ? (
                          <MessageAction
                            label="Regenerate"
                            tooltip="Regenerate"
                            onClick={onReload}
                          >
                            <RefreshCw className="size-3.5" />
                          </MessageAction>
                        ) : null}
                        {message.traceId ? (
                          <a
                            href={`#trace/${message.traceId}`}
                            data-trace-id={message.traceId}
                            className="text-[10px] text-muted-foreground hover:text-foreground ml-1 underline"
                            title="View trace"
                          >
                            trace
                          </a>
                        ) : null}
                      </MessageActions>
                    ) : null}
                      </div>
                    </div>
                  </Message>
                );
              })
            )}
            {isLoading && !messages.some((message) => message.streaming) ? (
              <AssistantThinkingMessage
                showAvatar={showAvatars}
                assistantAvatarUrl={assistantAvatarUrl}
                assistantAvatarFallback={assistantAvatarFallback}
              />
            ) : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {error ? (
          <ErrorBanner error={error} onReload={onReload} />
        ) : null}

        <div className="relative">
          {promptOverlaySlot ? (
            <div className="absolute bottom-full left-0 right-0 z-10 px-3 pb-1">
              {promptOverlaySlot}
            </div>
          ) : null}
          <PromptInput
            accept={acceptedFileTypes}
            maxFileSize={maxFileSize}
            onSubmit={handleSubmit}
            onError={(e) => {
              // Surface upload-level validation errors via the existing toast/alert path
              console.warn('[plugin-chatbot] prompt-input error', e);
            }}
          >
            {enableFileUpload ? (
              <PromptInputBody>
                <PromptInputAttachments>
                  {(attachment) => <PromptInputAttachment data={attachment} />}
                </PromptInputAttachments>
              </PromptInputBody>
            ) : null}
            <PromptInputTextarea
              placeholder={placeholder}
              disabled={disabled || promptStatus === 'streaming'}
              onChange={
                onInputChange
                  ? (e) => onInputChange(e.currentTarget.value)
                  : undefined
              }
            />
            <PromptInputFooter>
              <PromptInputTools>
                {enableFileUpload ? (
                  <PromptInputActionMenu>
                    <PromptInputActionMenuTrigger />
                    <PromptInputActionMenuContent>
                      <PromptInputActionAddAttachments />
                    </PromptInputActionMenuContent>
                  </PromptInputActionMenu>
                ) : null}
                {models && models.length > 0 ? (
                  <select
                    aria-label="Model"
                    value={selectedModelId ?? models[0].id}
                    onChange={(e) => onModelChange?.(e.target.value)}
                    className="h-7 rounded-md border bg-background px-2 text-xs text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label ?? m.id}
                        {m.provider ? ` · ${m.provider}` : ''}
                      </option>
                    ))}
                  </select>
                ) : null}
                <span
                  className="hidden items-center gap-1 text-[10px] text-muted-foreground sm:inline-flex"
                  aria-hidden="true"
                >
                  <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[10px] leading-none">
                    ⌘
                  </kbd>
                  <CornerDownLeft className="h-3 w-3" />
                  <span className="opacity-70">{L.sendHint}</span>
                </span>
              </PromptInputTools>
              <PromptInputSubmit
                aria-label={promptStatus === 'streaming' ? 'Stop response' : 'Submit'}
                status={promptStatus}
                disabled={disabled}
                onClick={promptStatus === 'streaming' ? onStop : undefined}
                type={promptStatus === 'streaming' ? 'button' : 'submit'}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>

      </div>
    );
  }
);

ChatbotEnhanced.displayName = 'ChatbotEnhanced';

/**
 * Compact circular avatar shown beside a message when `showAvatars` is on.
 * Assistant → bot glyph (or image); user → initial (or image).
 */
function MessageAvatar({
  isUser,
  url,
  fallback,
}: {
  isUser: boolean;
  url?: string;
  fallback?: string;
}) {
  return (
    <div
      className={cn(
        'mt-0.5 flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-medium',
        isUser ? 'bg-secondary text-secondary-foreground' : 'bg-primary/10 text-primary',
      )}
      aria-hidden="true"
    >
      {url ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : isUser ? (
        (fallback?.trim()?.charAt(0)?.toUpperCase() || 'U')
      ) : (
        <Bot className="size-4" />
      )}
    </div>
  );
}

function AssistantThinkingMessage({
  showAvatar,
  assistantAvatarUrl,
  assistantAvatarFallback,
}: {
  showAvatar: boolean;
  assistantAvatarUrl?: string;
  assistantAvatarFallback?: string;
}) {
  return (
    <Message from="assistant" aria-live="polite">
      <div className={cn('flex w-full gap-2.5', showAvatar ? 'flex-row items-start' : 'flex-col')}>
        {showAvatar ? (
          <MessageAvatar
            isUser={false}
            url={assistantAvatarUrl}
            fallback={assistantAvatarFallback}
          />
        ) : null}
        <MessageContent className="rounded-lg border bg-muted/30 px-3 py-2 text-muted-foreground">
          <ThinkingDots />
        </MessageContent>
      </div>
    </Message>
  );
}

function ThinkingDots() {
  return (
    <>
      <span className="sr-only">Assistant is responding</span>
      <span aria-hidden="true" className="inline-flex items-center gap-1">
        <span className="size-1.5 rounded-full bg-current animate-pulse" />
        <span className="size-1.5 rounded-full bg-current animate-pulse" />
        <span className="size-1.5 rounded-full bg-current animate-pulse" />
      </span>
    </>
  );
}

function ErrorBanner({
  error,
  onReload,
}: {
  error: Error;
  onReload?: () => void;
}) {
  const { summary, details } = React.useMemo(() => summarizeChatError(error), [error]);
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div
      className="border-t bg-background px-3 py-2 text-sm"
      role="alert"
    >
      <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-foreground">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <div className="font-medium leading-snug text-destructive">Response failed</div>
            <div className="mt-0.5 break-words leading-snug text-muted-foreground">
              {summary || 'Something went wrong. Please try again.'}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {details ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex h-7 items-center rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-foreground"
                aria-expanded={expanded}
              >
                {expanded ? 'Hide' : 'Details'}
              </button>
            ) : null}
            {onReload ? (
              <button
                type="button"
                onClick={onReload}
                className="inline-flex h-7 items-center rounded-md border border-destructive/30 bg-background px-2 text-xs font-medium text-destructive hover:bg-destructive/10"
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Retry
              </button>
            ) : null}
          </div>
        </div>
        {expanded && details ? (
          <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded border bg-background px-2 py-1 font-mono text-[11px] leading-snug text-muted-foreground">
            {details}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Tool result renderer. The vendored `<ToolOutput>` blindly wraps every string
 * in a JSON-highlighted `<CodeBlock>`, which mangles plain text / markdown
 * results from tools (e.g. "Created task 42" or a bullet list). This wrapper
 *
 *  - renders plain-text / markdown strings via `<MessageResponse>` (streamdown)
 *  - falls through to the vendored `<ToolOutput>` for real JSON objects/arrays
 *    and for strings that actually look like JSON literals
 *  - preserves error rendering unchanged
 */
function SmartToolOutput({
  output,
  errorText,
}: {
  output: unknown;
  errorText?: string;
}) {
  if (errorText) {
    return <ToolOutput output={undefined} errorText={errorText} />;
  }
  if (output == null || output === '') return null;
  if (typeof output === 'string' && !looksLikeJson(output)) {
    return (
      <div className="space-y-2 p-4">
        <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Result
        </h4>
        <div className="overflow-x-auto rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground">
          <MessageResponse>{output}</MessageResponse>
        </div>
      </div>
    );
  }
  return <ToolOutput output={output as never} errorText={undefined} />;
}

export { ChatbotEnhanced };

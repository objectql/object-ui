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
import { SchemaRenderer } from '@object-ui/react';
import { AlertCircle, ArrowRight, Copy, Check, RefreshCw, CornerDownLeft, Bot, Eye, GitCompareArrows, Rocket, Clock3, CheckCircle2, XCircle, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { ChatStatus } from 'ai';
import {
  humanizeToolName,
  parseAiQuotaError,
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
  /**
   * Live build progress from a long-running tool (apply_blueprint), lifted from
   * the stream's reconciled `data-build-progress` part. When present, the chat
   * renders a growing "build tree" so the user watches the app take shape
   * instead of staring at a thinking spinner.
   */
  buildProgress?: ChatBuildProgress;
  /**
   * Charts to render inline in the assistant bubble, lifted from the stream's
   * `data-chart` parts (emitted by the `visualize_data` tool via
   * `ctx.onProgress`). Each renders through the platform's SDUI `<chart>`
   * component, so an AI data answer can show a bar/line/pie chart rather than
   * only a wall of text.
   */
  charts?: ChatChart[];
}

/**
 * A chart lifted from a `data-chart` stream part. Mirrors the `schema` prop of
 * the SDUI `<chart>` renderer (plugin-charts `ChartRenderer`), so it can be
 * fed straight into `<SchemaRenderer schema={{ type: 'chart', ...chart }} />`.
 */
export interface ChatChart {
  chartType?:
    | 'bar'
    | 'column'
    | 'horizontal-bar'
    | 'line'
    | 'area'
    | 'pie'
    | 'donut'
    | 'radar'
    | 'scatter';
  /** Optional chart title shown above the chart. */
  title?: string;
  /** Aggregated rows — one object per category. */
  data: Array<Record<string, unknown>>;
  /** Field name used for the category axis (x-axis / pie slices). */
  xAxisKey?: string;
  /** One entry per plotted measure. `dataKey` is the row column to read. */
  series: Array<{ dataKey: string; label?: string }>;
}

/** A reconciled snapshot of an in-flight app build (apply_blueprint). */
export interface ChatBuildProgress {
  /** Coarse phase: drafting structure, generating sample data, or finished. */
  phase: 'structure' | 'data' | 'done';
  /** Human label for the app being built (for the panel header). */
  appLabel?: string;
  /** Artifacts drafted so far, cumulative. */
  items: Array<{ type: string; name: string }>;
  /** Count of artifacts done and the rough total (for the progress bar). */
  done: number;
  total: number;
  /**
   * Monotonic emit counter from the server. Bumps on every progress update —
   * including the keep-alive heartbeats sent during long, quiet seed-generation
   * awaits — so it's the reliable "a fresh byte just arrived" signal the build
   * panel keys its liveness off (content fields stay identical across a
   * heartbeat). Absent from older runtimes.
   */
  seq?: number;
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
  draftReview?: {
    items: Array<{ type: string; name: string }>;
    summary?: string;
    packageId?: string;
    /**
     * Backend lifecycle intent (from the tool result). `true` for whole-app
     * builds (apply_blueprint) — eligible for the auto-publish "magic moment".
     * Omitted for incremental edits, which stay drafts for explicit review.
     */
    autoPublishable?: boolean;
    /** Count of artifacts that failed in a partial build, surfaced not hidden. */
    failedCount?: number;
    /**
     * ADR-0045: the build was MATERIALIZED in-turn — real tables and seed
     * rows exist; the app is live but `hidden` (unlisted). Preview should
     * open the REAL app URL, not the draft overlay.
     */
    materialized?: boolean;
    /**
     * ADR-0038 L1 graph-lint verdict for the staged build. Rendered as a
     * verified/issues chip so "drafted" and "verified" read as the two
     * separate statements they are. Absent on older tool output.
     */
    verification?: { errors: number; warnings: number };
    /**
     * ADR-0038 L1 — the individual findings behind the `verification` counts,
     * surfaced under the chip so "N issues" expands into WHAT is wrong instead
     * of being a dead-end badge.
     */
    issues?: Array<{ severity: 'error' | 'warning'; code: string; message: string; fix?: string }>;
    /**
     * Post-build "what's next" steps (apply_blueprint `nextSteps`). Rendered as
     * a short getting-started checklist under the build summary.
     */
    nextSteps?: string[];
  };
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
  /** Compact agent activity heading shown in summary mode. */
  agentActivity?: string;
  /** Status label for completed tool work. */
  toolCompleted?: string;
  /** Status label for running tool work. */
  toolRunning?: string;
  /** Status label for tool work waiting for approval. */
  toolAwaitingApproval?: string;
  /** Status label for failed tool work. */
  toolFailed?: string;
  /** Helper text explaining that raw internals are hidden. */
  toolDetailsHidden?: string;
  /** Message action label for copying assistant text. */
  copy?: string;
  /** Message action label shown after a successful copy. */
  copied?: string;
  /** Message action label for regenerating the last assistant response. */
  regenerate?: string;
  /** Accessible label for the model picker. */
  model?: string;
  /** Accessible label for the submit button. */
  submit?: string;
  /** Accessible label for the attachment file picker. */
  uploadFiles?: string;
  /** Accessible label for the stop-streaming button. */
  stopResponse?: string;
  /** Trace link label in debug mode. */
  trace?: string;
  /** Trace link tooltip in debug mode. */
  viewTrace?: string;
  /**
   * Shown beside a running turn once the server stream goes quiet (no bytes for
   * a few seconds) — e.g. "Waiting for server…". Honest stall cue, not a claim
   * of progress.
   */
  connectionWaiting?: string;
}

export type ChatbotProcessVisibility = 'hidden' | 'summary' | 'debug';
export type ChatbotSurface = 'card' | 'plain';

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
  /**
   * Called when the user clicks the upgrade / top-up CTA shown for an AI quota
   * refusal (429 from the cloud token guardrail). Hosts typically open the cloud
   * billing/pricing page. When omitted, no CTA button is shown.
   */
  onUpgrade?: () => void;
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
   *
   * Return value (all forms accepted, `false`/`{ok:false}` = failure):
   * - `boolean | void` — legacy success flag;
   * - `{ ok: boolean; health?: PublishHealth }` — ADR-0038 L3: the publish
   *   response's `seedApplied` + runtime `probes`, rendered as a build-health
   *   line under the Published badge so "Published" and "actually works" are
   *   two separately-verified statements.
   */
  onPublishDrafts?: (
    packageId: string,
  ) => void | boolean | PublishOutcome | Promise<void | boolean | PublishOutcome>;
  /**
   * When provided, a finished build tree (`buildProgress.phase === 'done'`) that
   * created an `app` renders an "Open app" action so the user can jump straight
   * into what was just built. The host wires this to its router (e.g.
   * `navigate('/apps/<name>')`).
   */
  onOpenBuiltApp?: (appName: string) => void;
  /** Label for the open-built-app action (default "Open app"). */
  openBuiltAppLabel?: string;
  /**
   * ADR-0037 Live Canvas: preview the drafted app *before* it is published.
   * Rendered next to the build tree's Open-app action and on draft chips
   * whose items include an `app`. The host wires this to its router with the
   * preview flag (e.g. `navigate('/apps/<name>?preview=draft')`).
   * ADR-0045: when the build reports `materialized`, `opts.materialized` is
   * true and the host should open the REAL app URL (no preview flag) — the
   * app is live-but-unlisted, with actual tables and seed data.
   */
  onPreviewDraftApp?: (appName: string, opts?: { materialized?: boolean }) => void;
  /** Label for the preview-draft action (default "Preview"). */
  previewDraftLabel?: string;
  /**
   * ADR-0037 Live Canvas: notifies the host whenever AI-authored draft
   * artifacts land in the conversation (build-progress items + drafted
   * envelopes), with the cumulative deduped set. Hosts use it to open and
   * refresh the live draft-preview pane while the agent builds.
   */
  onDraftArtifacts?: (artifacts: Array<{ type: string; name: string }>) => void;
  /**
   * ADR-0045: fires once per build whose tool result reports `materialized`
   * with an `app` in the draft set — the app is live (tables + seed data)
   * but unlisted. Hosts switch the canvas to the real app URL.
   */
  onBuildMaterialized?: (appName: string) => void;
  /** Label for the publish-drafts button (default "Publish"). */
  publishDraftsLabel?: string;
  /** Label for the published-state badge that replaces the button (default "Published"). */
  publishedLabel?: string;
  /** Label for the clean ADR-0038 verification chip (default "Verified"). */
  verifiedLabel?: string;
  /** Heading for the post-build "what's next" checklist (default "What's next"). */
  nextStepsLabel?: string;
  /**
   * Live draft-status resolver: how many drafts are still PENDING in a
   * package (e.g. `GET /metadata/_drafts?packageId=` count). When provided,
   * each draft card's Publish/Published affordance reflects the SERVER's
   * current state instead of this component's in-memory publish history —
   * so a reloaded conversation shows "Published" for work that went live,
   * and a card whose package gained new drafts offers Publish again. The
   * in-memory snapshot remains the fallback when the prop is absent.
   */
  fetchPendingDraftCount?: (packageId: string) => Promise<number>;
  /**
   * Auto-fire `onPublishDrafts` the moment a turn finishes drafting an app —
   * the self-use "magic moment" where the user refreshes and the app is already
   * live WITH data, instead of clicking Publish. Server-gated by the plan
   * (`features.autoPublishAiBuilds`, env-revertible via
   * `OS_AI_AUTOPUBLISH_DISABLED`); the host passes the resolved flag.
   *
   * Only NEW drafts from the current session fire — drafts already present when
   * the chat mounts (e.g. reopening a conversation) are left for the manual
   * Publish button, so reopening history never silently publishes.
   *
   * @default false
   */
  autoPublishDrafts?: boolean;
  /**
   * Controls how agent internals are exposed. `summary` keeps end-user chat
   * readable by grouping repeated tool calls and hiding raw args/results.
   * Use `debug` for developer/admin trace views.
   *
   * @default 'summary'
   */
  processVisibility?: ChatbotProcessVisibility;
  /**
   * Visual chrome for the chat surface. `card` keeps the embeddable bordered
   * panel; `plain` removes panel chrome for full-page chat workspaces.
   *
   * @default 'card'
   */
  surface?: ChatbotSurface;
}

/**
 * ADR-0038 L3 — what a publish actually did at runtime. Hosts extract this
 * from the publish-drafts response (`seedApplied` + `probes`) so the chat can
 * render a build-health line: "Published" and "actually works" are two
 * separately-verified statements, and the second one must be visible too.
 */
export interface PublishHealth {
  /** Rows materialized by published seeds (`seedApplied` inserted+updated). */
  seededRows?: number;
  /** Seed-load failure detail when sample data did NOT land. */
  seedError?: string;
  /** How many runtime probes ran per plane (`probes.checked`). */
  checked?: { seeds: number; views: number; widgets: number };
  /** Runtime findings (`probes.issues`), already human-readable. */
  issues?: Array<{ severity: 'error' | 'warning'; code: string; message: string }>;
}

/** Structured result of `onPublishDrafts` — richer alternative to a bare boolean. */
export interface PublishOutcome {
  ok: boolean;
  health?: PublishHealth;
}

/**
 * Extract {@link PublishHealth} from a publish-drafts response body (tolerant
 * of the dispatcher's `{ success, data }` envelope). Shared by the hosts that
 * wire `onPublishDrafts` so they all read `seedApplied` + `probes` the same
 * way; returns undefined when the server reported neither (older runtimes).
 */
export function publishHealthFromResponse(payload: unknown): PublishHealth | undefined {
  const root = (payload ?? {}) as Record<string, unknown>;
  const data = (root.data && typeof root.data === 'object' ? root.data : root) as Record<string, unknown>;
  const seedApplied = data.seedApplied as
    | { success?: boolean; inserted?: number; updated?: number; error?: string; errors?: unknown[] }
    | undefined;
  const probes = data.probes as
    | {
        checked?: { seeds?: number; views?: number; widgets?: number };
        issues?: Array<{ severity?: string; code?: string; message?: string }>;
      }
    | undefined;
  if (!seedApplied && !probes) return undefined;
  const health: PublishHealth = {};
  if (seedApplied) {
    if (seedApplied.success === false) {
      health.seedError =
        seedApplied.error ??
        (Array.isArray(seedApplied.errors) && seedApplied.errors.length
          ? String(seedApplied.errors[0])
          : 'Sample data failed to load.');
    } else {
      health.seededRows = (seedApplied.inserted ?? 0) + (seedApplied.updated ?? 0);
    }
  }
  if (probes) {
    health.checked = {
      seeds: probes.checked?.seeds ?? 0,
      views: probes.checked?.views ?? 0,
      widgets: probes.checked?.widgets ?? 0,
    };
    health.issues = (probes.issues ?? [])
      .filter((i) => i && typeof i.message === 'string')
      .map((i) => ({
        severity: i.severity === 'error' ? 'error' : 'warning',
        code: String(i.code ?? 'runtime_issue'),
        message: String(i.message),
      }));
  }
  return health;
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

type ToolSummaryState = 'running' | 'awaiting' | 'completed' | 'failed';

interface ToolSummaryGroup {
  key: string;
  title: string;
  rawName: string;
  count: number;
  state: ToolSummaryState;
  errorText?: string;
}

function getToolState(tool: ChatToolInvocation): ToolSummaryState {
  const state =
    tool.state ??
    (tool.errorText
      ? 'output-error'
      : tool.result !== undefined
        ? 'output-available'
        : 'input-available');

  if (state === 'output-error' || state === 'output-denied') {
    return 'failed';
  }
  if (state === 'approval-requested' || state === 'approval-responded') {
    return 'awaiting';
  }
  if (state === 'output-available') {
    return 'completed';
  }
  return 'running';
}

function shouldRenderDetailedTool(tool: ChatToolInvocation): boolean {
  const state = getToolState(tool);
  return (
    state === 'awaiting' ||
    state === 'failed' ||
    Boolean(tool.pendingActionId) ||
    Boolean(tool.draftReview?.items.length)
  );
}

function getToolStateRank(state: ToolSummaryState): number {
  switch (state) {
    case 'failed':
      return 4;
    case 'awaiting':
      return 3;
    case 'running':
      return 2;
    case 'completed':
      return 1;
  }
}

function summarizeTools(tools: ChatToolInvocation[]): ToolSummaryGroup[] {
  const groups = new Map<string, ToolSummaryGroup>();

  for (const tool of tools) {
    const state = getToolState(tool);
    const key = `${tool.toolName}:${state}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.errorText = existing.errorText ?? tool.errorText;
      continue;
    }
    groups.set(key, {
      key,
      title: humanizeToolName(tool.toolName) || tool.toolName,
      rawName: tool.toolName,
      count: 1,
      state,
      errorText: tool.errorText,
    });
  }

  return Array.from(groups.values()).sort((a, b) => {
    const byRank = getToolStateRank(b.state) - getToolStateRank(a.state);
    if (byRank !== 0) return byRank;
    return a.title.localeCompare(b.title);
  });
}

/**
 * ADR-0038 L3 — the build-health line under a Published badge. Reads the
 * publish's `seedApplied` + runtime-probe results and answers the question
 * the badge alone can't: did the published app actually work when exercised?
 * Renders nothing without health data (older hosts return a bare boolean).
 */
function PublishHealthLine({ health }: { health: PublishHealth | undefined }) {
  if (!health) return null;
  const issues = health.issues ?? [];
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity !== 'error');
  const checked = health.checked;
  const probesRan = !!checked && checked.seeds + checked.views + checked.widgets > 0;
  const okParts: string[] = [];
  if (typeof health.seededRows === 'number' && health.seededRows > 0 && !health.seedError) {
    okParts.push(`${health.seededRows} sample row${health.seededRows === 1 ? '' : 's'} live`);
  }
  if (probesRan && errors.length === 0) {
    const planes: string[] = [];
    if (checked!.views > 0) planes.push(`${checked!.views} view${checked!.views === 1 ? '' : 's'}`);
    if (checked!.widgets > 0) planes.push(`${checked!.widgets} widget${checked!.widgets === 1 ? '' : 's'}`);
    if (checked!.seeds > 0) planes.push(`${checked!.seeds} seed${checked!.seeds === 1 ? '' : 's'}`);
    if (planes.length) okParts.push(`${planes.join(' · ')} verified`);
  }
  if (okParts.length === 0 && !health.seedError && issues.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 border-t bg-muted/20 px-3 py-2" data-testid="publish-health">
      {okParts.length > 0 ? (
        <div className="flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="size-3.5 shrink-0" />
          <span>{okParts.join(' · ')}</span>
        </div>
      ) : null}
      {health.seedError ? (
        <div className="flex items-start gap-1.5 text-xs text-red-600">
          <XCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>{health.seedError}</span>
        </div>
      ) : null}
      {errors.map((i, idx) => (
        <div key={`e${idx}`} className="flex items-start gap-1.5 text-xs text-red-600">
          <XCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>{i.message}</span>
        </div>
      ))}
      {warnings.map((i, idx) => (
        <div key={`w${idx}`} className="flex items-start gap-1.5 text-xs text-amber-600">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>{i.message}</span>
        </div>
      ))}
    </div>
  );
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
      onUpgrade,
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
      onOpenBuiltApp,
      openBuiltAppLabel = 'Open app',
      onPreviewDraftApp,
      previewDraftLabel = 'Preview',
      onDraftArtifacts,
      onBuildMaterialized,
      publishDraftsLabel = 'Publish',
      publishedLabel = 'Published',
      verifiedLabel = 'Verified',
      nextStepsLabel = "What's next",
      fetchPendingDraftCount,
      autoPublishDrafts = false,
      processVisibility = 'summary',
      surface = 'card',
      ...props
    },
    ref
  ) => {
    const promptStatus: ChatStatus = isLoading ? 'streaming' : 'ready';
    const isPlainSurface = surface === 'plain';
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
        agentActivity: labels?.agentActivity ?? 'Agent activity',
        toolCompleted: labels?.toolCompleted ?? 'Completed',
        toolRunning: labels?.toolRunning ?? 'Running',
        toolAwaitingApproval: labels?.toolAwaitingApproval ?? 'Awaiting approval',
        toolFailed: labels?.toolFailed ?? 'Failed',
        toolDetailsHidden:
          labels?.toolDetailsHidden ??
          'Detailed tool inputs and outputs are hidden in this view.',
        copy: labels?.copy ?? 'Copy',
        copied: labels?.copied ?? 'Copied',
        regenerate: labels?.regenerate ?? 'Regenerate',
        model: labels?.model ?? 'Model',
        submit: labels?.submit ?? 'Submit',
        uploadFiles: labels?.uploadFiles ?? 'Upload files',
        stopResponse: labels?.stopResponse ?? 'Stop response',
        trace: labels?.trace ?? 'trace',
        viewTrace: labels?.viewTrace ?? 'View trace',
        connectionWaiting: labels?.connectionWaiting ?? 'Waiting for server…',
      }),
      [labels],
    );

    // Draft tool calls this chat has published (auto or via the manual button),
    // so each card flips from a "Publish" button to a "Published" state instead
    // of leaving a stale, now-meaningless button. Keyed by the draft's
    // `toolCallId`, NOT its packageId: publishing a package promotes the drafts
    // PENDING AT THAT MOMENT, but a later edit into the same package is a new,
    // still-pending draft — it must NOT inherit the earlier build's "Published"
    // badge (that would falsely tell the user an unpublished change is live).
    const [publishedToolCalls, setPublishedToolCalls] = React.useState<ReadonlySet<string>>(
      () => new Set(),
    );
    // ADR-0038 L3 — per published card, what the publish actually did at
    // runtime (rows seeded, probes run, findings). Rendered under the
    // Published badge as the build-health line.
    const [publishHealthByToolCall, setPublishHealthByToolCall] = React.useState<
      ReadonlyMap<string, PublishHealth>
    >(() => new Map());

    // Live publish-state (panel-as-source-of-truth, made literal): the server's
    // CURRENT pending-draft count per package, when the host wires
    // `fetchPendingDraftCount`. The in-memory `publishedToolCalls` snapshot
    // above is an optimistic overlay for THIS session; this map is what keeps a
    // RELOADED conversation honest — published work shows "Published" (count
    // 0), and a package that gained new drafts offers Publish again, no matter
    // which session staged them.
    const [pendingByPackage, setPendingByPackage] = React.useState<
      ReadonlyMap<string, number>
    >(() => new Map());
    const pendingFetchedRef = React.useRef<Set<string>>(new Set());
    const refreshPendingCount = React.useCallback(
      async (packageId: string) => {
        if (!fetchPendingDraftCount) return;
        try {
          const count = await fetchPendingDraftCount(packageId);
          setPendingByPackage((prev) => {
            if (prev.get(packageId) === count) return prev;
            const next = new Map(prev);
            next.set(packageId, count);
            return next;
          });
        } catch {
          // Leave the package unknown — the card falls back to the
          // in-memory snapshot rather than guessing.
        }
      },
      [fetchPendingDraftCount],
    );
    // Resolve the live count as draft cards appear (incl. on mount for
    // reloaded conversations). Keyed by the card's toolCallId — a NEW build
    // into an already-seen package must refresh that package's count, or the
    // older card would keep claiming "Published" while drafts are pending.
    // Waits for the turn to finish so a mid-build fetch doesn't race the
    // still-staging drafts.
    React.useEffect(() => {
      if (!fetchPendingDraftCount || isLoading) return;
      const due = new Set<string>();
      for (const message of messages) {
        for (const tool of message.toolInvocations ?? []) {
          const pkg = tool.draftReview?.packageId;
          const key = tool.toolCallId;
          if (pkg && key && !pendingFetchedRef.current.has(key)) {
            pendingFetchedRef.current.add(key);
            due.add(pkg);
          }
        }
      }
      for (const pkg of due) void refreshPendingCount(pkg);
    }, [messages, isLoading, fetchPendingDraftCount, refreshPendingCount]);
    // Publish a package's drafts and reflect success on exactly the cards that
    // were pending for it at publish time. The host's onPublishDrafts returns
    // `false` / `{ok:false}` on failure (and surfaces its own error); any other
    // outcome (incl. void) counts as success. A structured outcome may carry
    // `health` (seedApplied + runtime probes) for the health line.
    const handlePublishDrafts = React.useCallback(
      async (packageId: string) => {
        if (!onPublishDrafts) return;
        // Snapshot the on-screen draft cards this publish will promote, BEFORE
        // awaiting — later edits into the same package won't be in this set.
        const promoted: string[] = [];
        for (const message of messages) {
          for (const tool of message.toolInvocations ?? []) {
            if (tool.draftReview?.packageId === packageId && tool.toolCallId) {
              promoted.push(tool.toolCallId);
            }
          }
        }
        const res = await onPublishDrafts(packageId);
        const outcome: PublishOutcome | undefined =
          res && typeof res === 'object' ? (res as PublishOutcome) : undefined;
        const ok = outcome ? outcome.ok !== false : res !== false;
        if (ok && promoted.length > 0) {
          setPublishedToolCalls((prev) => {
            const next = new Set(prev);
            for (const id of promoted) next.add(id);
            return next;
          });
          const health = outcome?.health;
          if (health) {
            setPublishHealthByToolCall((prev) => {
              const next = new Map(prev);
              for (const id of promoted) next.set(id, health);
              return next;
            });
          }
        }
        // Re-read the server's pending count so every card bound to this
        // package reflects the post-publish truth (0 on success; unchanged
        // on failure — the button stays).
        void refreshPendingCount(packageId);
      },
      [onPublishDrafts, messages, refreshPendingCount],
    );

    // Auto-publish "magic moment": when the environment enables autoPublishDrafts
    // and a WHOLE-APP build finishes (the backend marks it `autoPublishable`),
    // fire the same publish-drafts call the manual button uses — objects go live
    // and seed data loads, so the user lands on a populated, running app instead
    // of hunting for Publish. Incremental edits are NOT auto-published: they omit
    // `autoPublishable` and stay drafts for explicit review (a destructive edit
    // must never go live silently). Drafts already on screen when the chat mounts
    // are seeded as "seen" so reopening a conversation never republishes prior
    // work; only NEW builds fire, each at most once, after streaming completes.
    //
    // Dedup is keyed by the draft tool's `toolCallId`, NOT its packageId: every
    // build is a distinct tool call and several can target the SAME workspace
    // package in one session. Keying by packageId would publish it only once and
    // silently leave later builds staged. Keyed by toolCallId, each new build
    // publishes its package once (publish-drafts only promotes rows still
    // pending, so re-publishing a package is safe).
    const autoPublishedRef = React.useRef<Set<string>>(new Set());
    const autoPublishSeededRef = React.useRef(false);
    React.useEffect(() => {
      const builds: Array<{ key: string; packageId: string }> = [];
      for (const message of messages) {
        for (const tool of message.toolInvocations ?? []) {
          const dr = tool.draftReview;
          if (dr?.autoPublishable && dr.packageId && tool.toolCallId && dr.items.length > 0) {
            builds.push({ key: tool.toolCallId, packageId: dr.packageId });
          }
        }
      }
      if (!autoPublishSeededRef.current) {
        autoPublishSeededRef.current = true;
        for (const b of builds) autoPublishedRef.current.add(b.key);
        return;
      }
      // Wait for the turn to finish so we publish the complete build once.
      if (!autoPublishDrafts || !onPublishDrafts || isLoading) return;
      const fresh = builds.filter((b) => !autoPublishedRef.current.has(b.key));
      if (fresh.length === 0) return;
      for (const b of fresh) autoPublishedRef.current.add(b.key);
      // One publish per distinct package, even if a turn made several build calls.
      for (const pkg of [...new Set(fresh.map((b) => b.packageId))]) void handlePublishDrafts(pkg);
    }, [messages, isLoading, autoPublishDrafts, onPublishDrafts, handlePublishDrafts]);

    // ADR-0037 Live Canvas: surface every AI-authored draft artifact to the
    // host as it lands — both the streaming build tree's items and drafted
    // envelopes. Deduped cumulatively; the callback fires only when the set
    // actually grows, so hosts can refresh a preview pane without storms.
    const draftArtifactKeysRef = React.useRef<Set<string>>(new Set());
    React.useEffect(() => {
      if (!onDraftArtifacts) return;
      const artifacts = new Map<string, { type: string; name: string }>();
      for (const message of messages) {
        for (const item of message.buildProgress?.items ?? []) {
          if (item?.type && item?.name) artifacts.set(`${item.type}:${item.name}`, item);
        }
        for (const tool of message.toolInvocations ?? []) {
          for (const item of tool.draftReview?.items ?? []) {
            if (item?.type && item?.name) artifacts.set(`${item.type}:${item.name}`, item);
          }
        }
      }
      const seen = draftArtifactKeysRef.current;
      let grew = false;
      for (const key of artifacts.keys()) {
        if (!seen.has(key)) {
          seen.add(key);
          grew = true;
        }
      }
      if (grew) onDraftArtifacts([...artifacts.values()]);
    }, [messages, onDraftArtifacts]);

    // ADR-0045: announce materialized builds (real app live, unlisted) so the
    // host flips its canvas from the draft overlay to the real app URL. Once
    // per build (keyed by toolCallId), including on conversation reload —
    // a reopened materialized build should still preview the real app.
    const materializedKeysRef = React.useRef<Set<string>>(new Set());
    React.useEffect(() => {
      if (!onBuildMaterialized) return;
      for (const message of messages) {
        for (const tool of message.toolInvocations ?? []) {
          const dr = tool.draftReview;
          if (!dr?.materialized || !tool.toolCallId) continue;
          const app = dr.items.find((i) => i.type === 'app');
          if (!app || materializedKeysRef.current.has(tool.toolCallId)) continue;
          materializedKeysRef.current.add(tool.toolCallId);
          onBuildMaterialized(app.name);
        }
      }
    }, [messages, onBuildMaterialized]);

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

    const renderToolDetail = (tool: ChatToolInvocation) => {
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
      const showRawName =
        processVisibility === 'debug' &&
        friendlyTitle &&
        friendlyTitle.toLowerCase() !== tool.toolName.toLowerCase();
      // Raw PARAMETERS/RESULT JSON is developer detail — only in `debug` mode,
      // or when a HITL approval needs the operator to see the exact payload.
      // A drafting tool (create_object / apply_blueprint) is NOT a reason to dump
      // JSON: the human summary + the Publish/Review affordance below already tell
      // a Build-with-AI user what happened, so on the consumer surface (`summary`)
      // the whole-app blueprint JSON and "status: drafted" envelopes stay hidden.
      const showPayload =
        processVisibility === 'debug' ||
        isAwaitingApproval;
      // Lifecycle truth for this card's draft package, in precedence order:
      // the server's live pending-draft count (host wired
      // `fetchPendingDraftCount`), else this session's in-memory publish
      // history. The live count is what keeps reloaded conversations and
      // cross-session edits honest.
      const draftPackageId = tool.draftReview?.packageId;
      const livePendingCount = draftPackageId !== undefined
        ? pendingByPackage.get(draftPackageId)
        : undefined;
      const draftIsPublished = livePendingCount !== undefined
        ? livePendingCount === 0
        : publishedToolCalls.has(tool.toolCallId);
      const titleNode = (
        <span className="inline-flex items-center gap-2">
          <span>{friendlyTitle || tool.toolName}</span>
          {showRawName ? (
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
            Boolean(tool.draftReview && tool.draftReview.items.length > 0)
          }
        >
          <ToolHeader type={partType} state={state} title={titleNode} />
          <ToolContent>
            {showPayload && tool.args !== undefined ? (
              <ToolInput input={tool.args} />
            ) : null}
            {hidePendingPayload ? null : showPayload || state === 'output-error' ? (
              <SmartToolOutput
                output={renderableResult}
                errorText={tool.errorText}
              />
            ) : null}
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
                    ? '...'
                    : decision.state === 'success'
                      ? 'OK'
                      : 'X'}
                </span>
                <span>
                  {decision.message ??
                    (decision.state === 'pending'
                      ? 'Submitting decision...'
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
                  onClick={() => onToolApprove?.(tool.toolCallId, true)}
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
              <>
                <div className="flex items-center gap-2 p-3 border-t bg-muted/30">
                  {onPublishDrafts && tool.draftReview.packageId ? (
                    draftIsPublished ? (
                      // Published (auto or manual): a stable status badge, not a
                      // stale button. Keeps the card honest about lifecycle state.
                      <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="size-3.5" />
                        {publishedLabel}
                        {tool.draftReview.failedCount
                          ? ` · ${tool.draftReview.failedCount} need${tool.draftReview.failedCount === 1 ? 's' : ''} attention`
                          : ''}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handlePublishDrafts(tool.draftReview!.packageId!)}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                        data-testid="draft-publish"
                      >
                        <Rocket className="size-3.5" />
                        {publishDraftsLabel}
                        {typeof livePendingCount === 'number' && livePendingCount > 0
                          ? ` (${livePendingCount})`
                          : ''}
                      </button>
                    )
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
                  {/* ADR-0037: drafted-app preview — see it as-if-published
                      without publishing. Only when the draft set includes an
                      app (the canvas previews whole apps, not single items).
                      Hidden once the package has no pending drafts (live
                      count when available, else this session's history). */}
                  {onPreviewDraftApp && !draftIsPublished
                    ? (() => {
                        const app = tool.draftReview!.items.find((i) => i.type === 'app');
                        return app ? (
                          <button
                            type="button"
                            onClick={() => onPreviewDraftApp(app.name, { materialized: tool.draftReview!.materialized === true })}
                            className="inline-flex h-7 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted"
                            data-testid="draft-preview-app"
                          >
                            <Eye className="size-3.5" />
                            {previewDraftLabel}
                          </button>
                        ) : null;
                      })()
                    : null}
                  {/* ADR-0038 L1 chip: the graph-lint verdict, so the user sees
                      WHY a build did or didn't auto-publish without reading
                      tool JSON. Green = referentially clean; amber = blocking
                      issues, the build stays draft until the agent repairs. */}
                  {tool.draftReview.verification ? (
                    tool.draftReview.verification.errors > 0 ? (
                      <span
                        className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 text-xs font-medium text-amber-700"
                        data-testid="draft-verification-chip"
                      >
                        <TriangleAlert className="size-3.5" />
                        {`${tool.draftReview.verification.errors} issue${tool.draftReview.verification.errors === 1 ? '' : 's'}`}
                      </span>
                    ) : (
                      <span
                        className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-medium text-emerald-700"
                        data-testid="draft-verification-chip"
                      >
                        <ShieldCheck className="size-3.5" />
                        {verifiedLabel}
                      </span>
                    )
                  ) : null}
                  {tool.draftReview.summary ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {tool.draftReview.summary}
                    </span>
                  ) : null}
                </div>
                {/* ADR-0038 L1 — the findings behind the issues chip, so the
                    user sees WHAT is broken (and the fix hint) instead of a
                    bare "N issues" count with no way to learn more. Mirrors the
                    L3 health line below. */}
                {tool.draftReview.issues && tool.draftReview.issues.length > 0 ? (
                  <div
                    className="flex flex-col gap-1 border-t bg-muted/20 px-3 py-2"
                    data-testid="draft-issues"
                  >
                    {tool.draftReview.issues
                      .filter((i) => i.severity === 'error')
                      .map((iss, idx) => (
                        <div
                          key={`e${idx}`}
                          className="flex items-start gap-1.5 text-xs text-red-600"
                        >
                          <XCircle className="mt-0.5 size-3.5 shrink-0" />
                          <span>{iss.fix ? `${iss.message} — ${iss.fix}` : iss.message}</span>
                        </div>
                      ))}
                    {tool.draftReview.issues
                      .filter((i) => i.severity !== 'error')
                      .map((iss, idx) => (
                        <div
                          key={`w${idx}`}
                          className="flex items-start gap-1.5 text-xs text-amber-600"
                        >
                          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                          <span>{iss.message}</span>
                        </div>
                      ))}
                  </div>
                ) : null}
                {/* ADR-0038 L3 — build-health line: what the publish actually
                    did at runtime. Renders only when the host supplied health
                    data; "Published" alone never implies "verified". */}
                {publishedToolCalls.has(tool.toolCallId) ? (
                  <PublishHealthLine health={publishHealthByToolCall.get(tool.toolCallId)} />
                ) : null}
                {/* Post-build getting-started checklist — concrete next actions
                    (make the data yours, refine, automate, publish) so a finished
                    build isn't a dead end. Backend supplies these as
                    `nextSteps` on the apply_blueprint result; lifecycle-neutral. */}
                {tool.draftReview.nextSteps && tool.draftReview.nextSteps.length > 0 ? (
                  <div
                    className="flex flex-col gap-1 border-t bg-muted/20 px-3 py-2"
                    data-testid="draft-next-steps"
                  >
                    <span className="text-xs font-medium text-foreground/80">{nextStepsLabel}</span>
                    {tool.draftReview.nextSteps.map((step, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-1.5 text-xs text-muted-foreground"
                      >
                        <span className="mt-px shrink-0 text-foreground/40">→</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </ToolContent>
        </Tool>
      );
    };

    return (
      <div
        ref={ref}
        className={cn(
          isPlainSurface
            ? 'flex min-h-0 flex-col overflow-hidden bg-background'
            : 'flex min-h-0 flex-col overflow-hidden rounded-lg border bg-background',
          className
        )}
        style={{ maxHeight }}
        {...props}
      >
        {onClear && !hideClearBar && messages.length > 0 && (
          <div
            className={cn(
              'flex items-center justify-end px-4 py-2',
              isPlainSurface ? 'bg-background' : 'border-b bg-muted/30',
            )}
          >
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
          <div className={cn('shrink-0', !isPlainSurface && 'border-b bg-background/50')}>
            {headerSlot}
          </div>
        ) : null}

        <Conversation className="flex-1 min-h-0">
          <ConversationContent
            className={cn(
              'space-y-4',
              isPlainSurface
                ? 'mx-auto w-full max-w-2xl px-4 py-8 sm:px-0'
                : 'px-4 py-3',
            )}
          >
            {messages.length === 0 ? (
              <ConversationEmptyState className="gap-3 px-0 py-8">
                <div className="flex size-9 items-center justify-center rounded-md bg-muted/70 text-muted-foreground">
                  {assistantAvatarUrl ? (
                    <img
                      src={assistantAvatarUrl}
                      alt=""
                      className="size-full rounded-md object-cover"
                    />
                  ) : (
                    <Bot className="size-4" />
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-foreground/90">{L.emptyTitle}</h3>
                  <p className="text-sm text-muted-foreground">
                    {L.emptyDescription}
                  </p>
                </div>
                {suggestions && suggestions.length > 0 ? (
                  <Suggestions className="justify-center gap-2">
                    {suggestions.map((s) => (
                      <Suggestion
                        key={s}
                        className="h-8 border-border/60 bg-background/80 px-3 text-xs font-medium text-foreground/90 shadow-none hover:bg-muted/60"
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
                const buildProgress = !isUser ? message.buildProgress : undefined;
                const isEmptyAssistantStreaming =
                  !isUser &&
                  Boolean(message.streaming) &&
                  !message.content &&
                  tools.length === 0 &&
                  !reasoning &&
                  !buildProgress; // a streaming build shows its tree, not the dots
                const summaryTools =
                  !isUser && processVisibility === 'summary'
                    ? tools.filter((tool) => !shouldRenderDetailedTool(tool))
                    : [];
                const detailedTools =
                  !isUser && processVisibility === 'debug'
                    ? tools
                    : !isUser && processVisibility !== 'debug'
                      ? tools.filter(shouldRenderDetailedTool)
                      : [];
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
                      {buildProgress ? (
                        <BuildProgressPanel
                          progress={buildProgress}
                          onOpenBuiltApp={onOpenBuiltApp}
                          openBuiltAppLabel={openBuiltAppLabel}
                          onPreviewDraftApp={onPreviewDraftApp}
                          previewDraftLabel={previewDraftLabel}
                          waitingLabel={L.connectionWaiting}
                        />
                      ) : null}
                      {!isUser && processVisibility === 'debug' && reasoning ? (
                        <Reasoning
                          isStreaming={Boolean(message.streaming) && !message.content}
                          className="mb-2"
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{reasoning}</ReasoningContent>
                        </Reasoning>
                      ) : null}
                      {!isUser && processVisibility === 'summary' && summaryTools.length > 0 ? (
                        <ToolActivitySummary
                          groups={summarizeTools(summaryTools)}
                          labels={L}
                        />
                      ) : null}
                      {!isUser && detailedTools.length > 0
                        ? detailedTools.map(renderToolDetail)
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
                      {!isUser && (message.charts?.length ?? 0) > 0 ? (
                        <div className="mt-2 flex flex-col gap-3" data-testid="chat-charts">
                          {message.charts!.map((chart, i) => (
                            <div
                              key={i}
                              className="rounded-lg border bg-background p-3"
                              // The chat bubble is `w-fit` (shrinks to content) while the
                              // SDUI chart's ResponsiveContainer is `width:100%` — a
                              // circular dependency. We give the chart a DEFINITE width
                              // sized to the viewport (NOT the shrink-to-fit parent, which
                              // would re-introduce the cycle) so recharts always measures a
                              // stable, non-zero width and renders. Height comes from the
                              // ChartContainer itself (h-[350px] / min-h 280).
                              style={{ width: 'min(520px, 80vw)' }}
                              data-testid="chat-chart"
                            >
                              {chart.title ? (
                                <div className="mb-2 text-sm font-medium text-foreground">
                                  {chart.title}
                                </div>
                              ) : null}
                              <SchemaRenderer
                                schema={{
                                  type: 'chart',
                                  chartType: chart.chartType ?? 'bar',
                                  data: chart.data,
                                  xAxisKey: chart.xAxisKey,
                                  series: chart.series,
                                } as never}
                              />
                            </div>
                          ))}
                        </div>
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
                          label={copiedId === message.id ? L.copied : L.copy}
                          tooltip={copiedId === message.id ? L.copied : L.copy}
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
                            label={L.regenerate}
                            tooltip={L.regenerate}
                            onClick={onReload}
                          >
                            <RefreshCw className="size-3.5" />
                          </MessageAction>
                        ) : null}
                        {processVisibility === 'debug' && message.traceId ? (
                          <a
                            href={`#trace/${message.traceId}`}
                            data-trace-id={message.traceId}
                            className="text-[10px] text-muted-foreground hover:text-foreground ml-1 underline"
                            title={L.viewTrace}
                          >
                            {L.trace}
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
                waitingLabel={L.connectionWaiting}
              />
            ) : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {error ? (
          <ErrorBanner error={error} onReload={onReload} onUpgrade={onUpgrade} />
        ) : null}

        <div
          className={cn(
            'relative',
            isPlainSurface && 'mx-auto w-full max-w-2xl px-4 pb-4 sm:px-0',
          )}
        >
          {promptOverlaySlot ? (
            <div className="absolute bottom-full left-0 right-0 z-10 px-3 pb-1">
              {promptOverlaySlot}
            </div>
          ) : null}
          <PromptInput
            accept={acceptedFileTypes}
            fileInputLabel={L.uploadFiles}
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
                    aria-label={L.model}
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
                aria-label={promptStatus === 'streaming' ? L.stopResponse : L.submit}
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
  waitingLabel,
}: {
  showAvatar: boolean;
  assistantAvatarUrl?: string;
  assistantAvatarFallback?: string;
  waitingLabel: string;
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
          <span className="inline-flex items-center gap-2">
            <ThinkingDots />
            {/* No server bytes yet for this turn → `pending`: shows a neutral
                "waiting" that escalates to amber if the first token never comes,
                never a false "receiving". */}
            <LivenessIndicator active pending activityKey={0} waitingLabel={waitingLabel} />
          </span>
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

/** Format an elapsed-seconds count as `m:ss` (e.g. 42 → "0:42", 95 → "1:35"). */
function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * After this many seconds with no new bytes from the server, a running turn is
 * treated as "quiet" — we genuinely have not heard back, so the indicator says
 * so instead of implying progress. During an app build the server streams
 * `data-build-progress` parts every few seconds, so a healthy build stays under
 * this threshold; only real silence (pre-first-token wait, a stalled/dropped
 * stream) crosses it.
 */
const LIVENESS_QUIET_AFTER_SECONDS = 6;

export interface TurnLiveness {
  /** Whole-turn duration in seconds (since the indicator mounted). */
  elapsedSeconds: number;
  /** Seconds since the last real byte arrived from the server. */
  quietSeconds: number;
  /** True while bytes have arrived recently — an *observed* live stream. */
  live: boolean;
}

/**
 * Liveness derived from REAL stream activity, not a free-running clock.
 *
 * `activityKey` must change whenever actual data arrives from the server (a
 * streamed token, a tool delta, a `data-build-progress` update). We stamp the
 * arrival time when it changes; `live` is then a genuine "the server sent us
 * something in the last few seconds" signal — it goes false during true silence
 * (a stalled or dropped stream), so the UI can stop pretending the turn is
 * progressing. A 1s ticker keeps `quietSeconds` current between arrivals.
 * Everything freezes once `active` turns false, leaving the final duration.
 */
function useTurnLiveness(active: boolean, activityKey: string | number): TurnLiveness {
  const startRef = React.useRef<number>(0);
  const lastActivityRef = React.useRef<number>(0);
  const [seconds, setSeconds] = React.useState({ elapsed: 0, quiet: 0 });

  // Establish the time origin once, in an effect — keeps Date.now() out of
  // render so the derived seconds stay pure for the renderer. Runs before the
  // activity/tick effects below (effects fire in declaration order).
  React.useEffect(() => {
    const now = Date.now();
    startRef.current = now;
    lastActivityRef.current = now;
  }, []);

  // Real data arrived (activityKey changed) → stamp the arrival and zero the
  // quiet timer. Refs/Date.now() are touched only inside this effect, never
  // during render.
  React.useEffect(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    setSeconds({ elapsed: Math.floor((now - startRef.current) / 1000), quiet: 0 });
  }, [activityKey]);

  React.useEffect(() => {
    if (!active) return;
    const tick = () => {
      const now = Date.now();
      setSeconds({
        elapsed: Math.floor((now - startRef.current) / 1000),
        quiet: Math.floor((now - lastActivityRef.current) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);

  return {
    elapsedSeconds: seconds.elapsed,
    quietSeconds: seconds.quiet,
    live: seconds.quiet < LIVENESS_QUIET_AFTER_SECONDS,
  };
}

/**
 * Honest connection cue beside a running spinner, with three states that each
 * reflect a real fact about the stream:
 *
 *  - **receiving** (emerald pulse + `m:ss`) — bytes arrived from the server in
 *    the last few seconds. Only shown when real data has actually been seen.
 *  - **waiting** (muted) — the request is in flight but nothing has come back
 *    yet (`pending`, e.g. before the first token). Neutral, not alarming; never
 *    claims "receiving" when nothing has been received.
 *  - **stalled** (amber + "no response for Ns") — the stream has gone genuinely
 *    quiet past the threshold. The honest "we have not heard back" signal.
 *
 * A hard disconnect surfaces separately via the chat error banner. `pending`
 * selects the waiting-vs-receiving wording for the live window: pass it when no
 * server bytes have been observed for this turn yet (the bare thinking state).
 */
function LivenessIndicator({
  active,
  activityKey,
  pending = false,
  waitingLabel,
}: {
  active: boolean;
  activityKey: string | number;
  pending?: boolean;
  waitingLabel: string;
}) {
  const { elapsedSeconds, quietSeconds, live } = useTurnLiveness(active, activityKey);
  const tier: 'receiving' | 'waiting' | 'stalled' = !live
    ? 'stalled'
    : pending
      ? 'waiting'
      : 'receiving';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-normal tabular-nums',
        tier === 'stalled' ? 'text-amber-600' : 'text-muted-foreground',
      )}
      aria-live="polite"
      title={
        tier === 'receiving'
          ? `Receiving from server · ${formatElapsed(elapsedSeconds)} elapsed`
          : tier === 'waiting'
            ? `${waitingLabel} · ${formatElapsed(elapsedSeconds)} elapsed`
            : `${waitingLabel} (${quietSeconds}s with no response)`
      }
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          tier === 'receiving'
            ? 'bg-emerald-500 animate-pulse'
            : tier === 'waiting'
              ? 'bg-muted-foreground/50 animate-pulse'
              : 'bg-amber-500',
        )}
      />
      {tier === 'receiving' ? (
        <>
          <Clock3 className="size-3 shrink-0" aria-hidden />
          {formatElapsed(elapsedSeconds)}
        </>
      ) : tier === 'waiting' ? (
        <span>{waitingLabel}</span>
      ) : (
        <span>
          {waitingLabel} {quietSeconds}s
        </span>
      )}
    </span>
  );
}

const BUILD_GROUP_ORDER = ['object', 'view', 'dashboard', 'app', 'seed'];
const BUILD_GROUP_LABEL: Record<string, string> = {
  object: 'Objects',
  view: 'Views',
  dashboard: 'Dashboards',
  app: 'App',
  seed: 'Sample data',
};

/**
 * Live "build tree" for an in-flight app build (apply_blueprint). Renders the
 * artifacts as they stream in (via the message's `buildProgress`), so the user
 * watches objects → views → dashboard → app → sample data appear instead of a
 * blank thinking spinner. Collapses to a "Built X" summary when done.
 */
function BuildProgressPanel({
  progress,
  onOpenBuiltApp,
  openBuiltAppLabel = 'Open app',
  onPreviewDraftApp,
  previewDraftLabel = 'Preview',
  waitingLabel = 'Waiting for server…',
}: {
  progress: ChatBuildProgress;
  onOpenBuiltApp?: (appName: string) => void;
  openBuiltAppLabel?: string;
  onPreviewDraftApp?: (appName: string) => void;
  previewDraftLabel?: string;
  waitingLabel?: string;
}) {
  const { phase, appLabel, items, done, total, seq } = progress;
  const isDone = phase === 'done';
  // Real activity key: bumps whenever the server streams another build-progress
  // part. Prefer the server's monotonic `seq` (it also advances on the keep-alive
  // heartbeats during long, quiet seed-generation awaits, where the content
  // fields don't change); fall back to the content signature for older runtimes
  // that don't send `seq`. Drives the liveness indicator off observed bytes, so a
  // healthy build reads as "receiving" and a genuine stall as amber.
  const activityKey = seq ?? `${phase}:${done}:${items.length}`;
  // The created `app` artifact (navigation shell) — the natural "open it" target.
  const builtApp = items.find((it) => it.type === 'app');
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : isDone ? 100 : 6;
  const groups = new Map<string, string[]>();
  for (const it of items) {
    const arr = groups.get(it.type) ?? [];
    arr.push(it.name.replace(/_sample$/, ''));
    groups.set(it.type, arr);
  }
  const orderedTypes = [
    ...BUILD_GROUP_ORDER.filter((t) => groups.has(t)),
    ...[...groups.keys()].filter((t) => !BUILD_GROUP_ORDER.includes(t)),
  ];
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-sm" data-testid="build-progress">
      <div className="mb-2 flex items-center gap-2 font-medium">
        {isDone ? (
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
        ) : (
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
        )}
        <span>{isDone ? `Built ${appLabel ?? 'your app'}` : `Building ${appLabel ?? 'your app'}…`}</span>
        {!isDone && phase === 'data' ? (
          <span className="text-xs font-normal text-muted-foreground">adding sample data</span>
        ) : null}
        {!isDone ? (
          <span className="ml-auto">
            <LivenessIndicator active activityKey={activityKey} waitingLabel={waitingLabel} />
          </span>
        ) : null}
      </div>
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-500', isDone ? 'bg-emerald-500' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="space-y-1">
        {orderedTypes.map((type) => {
          const names = groups.get(type)!;
          return (
            <li key={type} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
              <span className="min-w-0 text-muted-foreground">
                <span className="font-medium text-foreground">{BUILD_GROUP_LABEL[type] ?? type}</span>{' '}
                {names.slice(0, 6).join(', ')}
                {names.length > 6 ? ` +${names.length - 6} more` : ''}
              </span>
            </li>
          );
        })}
      </ul>
      {isDone && builtApp && (onOpenBuiltApp || onPreviewDraftApp) ? (
        <div className="mt-3 flex items-center gap-2">
          {onOpenBuiltApp ? (
            <button
              type="button"
              onClick={() => onOpenBuiltApp(builtApp.name)}
              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              data-testid="build-progress-open-app"
            >
              {openBuiltAppLabel}
              <ArrowRight className="size-3.5" />
            </button>
          ) : null}
          {/* ADR-0037: see the drafted app as-if-published, before Publish. */}
          {onPreviewDraftApp ? (
            <button
              type="button"
              onClick={() => onPreviewDraftApp(builtApp.name)}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted"
              data-testid="build-progress-preview-app"
            >
              <Eye className="size-3.5" />
              {previewDraftLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface ToolActivitySummaryLabels {
  toolCompleted: string;
  toolRunning: string;
  toolAwaitingApproval: string;
  toolFailed: string;
}

function ToolActivitySummary({
  groups,
  labels,
}: {
  groups: ToolSummaryGroup[];
  labels: ToolActivitySummaryLabels;
}) {
  if (groups.length === 0) return null;

  return (
    <div className="not-prose mb-2 border-l border-border/70 pl-3">
      <div className="space-y-1">
        {groups.map((group) => (
          <div
            key={group.key}
            className="flex min-h-6 items-center justify-between gap-3 text-xs"
          >
            <div className="flex min-w-0 items-center gap-2">
              <ToolSummaryIcon state={group.state} />
              <span className="truncate font-medium text-foreground">
                {group.title}
              </span>
              {group.count > 1 ? (
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  x{group.count}
                </span>
              ) : null}
            </div>
            <span
              className={cn(
                'shrink-0 text-[10px] font-medium',
                group.state === 'failed'
                  ? 'text-destructive'
                  : group.state === 'completed'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-muted-foreground',
              )}
            >
              {getToolSummaryStatus(group.state, labels)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolSummaryIcon({ state }: { state: ToolSummaryState }) {
  if (state === 'failed') {
    return <XCircle className="size-3.5 shrink-0 text-destructive" />;
  }
  if (state === 'completed') {
    return <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />;
  }
  return <Clock3 className="size-3.5 shrink-0 text-muted-foreground" />;
}

function getToolSummaryStatus(
  state: ToolSummaryState,
  labels: ToolActivitySummaryLabels,
) {
  switch (state) {
    case 'failed':
      return labels.toolFailed;
    case 'awaiting':
      return labels.toolAwaitingApproval;
    case 'running':
      return labels.toolRunning;
    case 'completed':
      return labels.toolCompleted;
  }
}

function ErrorBanner({
  error,
  onReload,
  onUpgrade,
}: {
  error: Error;
  onReload?: () => void;
  onUpgrade?: () => void;
}) {
  const quota = React.useMemo(() => parseAiQuotaError(error), [error]);
  const { summary, details } = React.useMemo(() => summarizeChatError(error), [error]);
  const [expanded, setExpanded] = React.useState(false);

  // AI quota refusal (429 from the cloud token guardrail) -> friendly upgrade /
  // top-up CTA instead of a red "Response failed" banner.
  if (quota) {
    const isZh =
      typeof navigator !== 'undefined' && !!navigator.language?.toLowerCase().startsWith('zh');
    const text =
      (isZh ? quota.message : quota.messageEn ?? quota.message) ||
      (isZh ? 'AI \u989d\u5ea6\u5df2\u7528\u5b8c\u3002' : 'You have reached your AI quota.');
    const cta = quota.topUp
      ? (isZh ? '\u8d2d\u4e70\u989d\u5ea6\u5305' : 'Buy a credit pack')
      : (isZh ? '\u5347\u7ea7\u65b9\u6848' : 'Upgrade plan');
    const title = isZh ? '\u9700\u8981\u5347\u7ea7' : 'Upgrade needed';
    return (
      <div className="border-t bg-background px-3 py-2 text-sm" role="alert">
        <div className="rounded-md border border-amber-300/40 bg-amber-50/60 px-3 py-2 text-foreground dark:bg-amber-950/20">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-medium leading-snug text-foreground">{title}</div>
              <div className="mt-0.5 break-words leading-snug text-muted-foreground">{text}</div>
            </div>
            {onUpgrade ? (
              <button
                type="button"
                onClick={onUpgrade}
                className="inline-flex h-7 shrink-0 items-center rounded-md border border-amber-400/50 bg-background px-2 text-xs font-medium text-amber-700 hover:bg-amber-100/60 dark:text-amber-300"
              >
                {cta}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

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

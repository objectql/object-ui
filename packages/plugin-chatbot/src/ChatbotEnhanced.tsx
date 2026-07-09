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
 *  - suggestion chips on empty state (Suggestion; wrapped in a flex-wrap row)
 *  - streaming markdown via streamdown (used by Message internals)
 */
import * as React from 'react';
import { cn } from '@object-ui/components';
import { SchemaRenderer } from '@object-ui/react';
import { AlertCircle, ArrowRight, Copy, Check, RefreshCw, CornerDownLeft, Bot, Eye, GitCompareArrows, Rocket, Clock3, CheckCircle2, XCircle, Loader2, ShieldCheck, TriangleAlert, ClipboardList, HelpCircle, Table2, WifiOff, Sparkles, Hourglass } from 'lucide-react';
import type { ChatStatus } from 'ai';
import {
  humanizeToolName,
  isRateLimitError,
  isUnsentSendError,
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
import { Suggestion } from './elements/suggestion';
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
   * Live blueprint-DESIGN progress from the long, atomic `propose_blueprint`
   * call, lifted from the stream's reconciled `data-blueprint-progress` part.
   * When present, the chat renders a "Designing…" panel whose object chips
   * appear one-by-one — upgrading the purely-presentational rotating-hint
   * placeholder to real, event-driven progress. Transient (never persisted):
   * on reload the authoritative "Proposed plan" card is the record instead.
   */
  blueprintProgress?: ChatBlueprintProgress;
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

/**
 * A reconciled snapshot of an in-flight blueprint DESIGN (`propose_blueprint`).
 * The plan-design step is a long, atomic LLM request; the server now streams a
 * reconciled `data-blueprint-progress` part as the schema takes shape, so the
 * chat can show objects appearing one-by-one instead of a static spinner.
 * Mirrors `ChatBuildProgress` (apply_blueprint's BUILD progress) but for the
 * pre-build PLAN — it is superseded by the authoritative "Proposed plan" card
 * the instant the tool result lands.
 */
export interface ChatBlueprintProgress {
  /**
   * Coarse phase. `designing` while the plan is being drafted; `done` once the
   * authoritative blueprint has arrived (on the `propose_blueprint` tool
   * result). Anything unrecognised — including absent — is treated as designing.
   */
  phase: 'designing' | 'done';
  /** Human one-liner for the app being designed (revealed progressively). */
  summary?: string;
  /** Human label for the new app (absent in extend mode). */
  appLabel?: string;
  /** Extend mode: the existing app the new objects would be added into. */
  targetApp?: string;
  /**
   * Objects surfaced so far, cumulative — they appear one-by-one as the design
   * streams. `fields` is the field count for the chip's "· N" suffix.
   */
  objects: Array<{ name: string; label?: string; fields?: number }>;
  /** Running totals for a compact "N objects · N views · …" line. */
  counts?: { objects?: number; views?: number; dashboards?: number };
  /**
   * Monotonic emit counter from the server — the reliable "a fresh byte just
   * arrived" liveness signal (advances on keep-alive heartbeats too, where the
   * content fields are identical). Absent from older runtimes.
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
  /**
   * ObjectStack extension. `propose_blueprint` returns a PLAN before anything
   * is staged (`status: 'blueprint_proposed'`). `mapMessages.ts` lifts the
   * reviewable shape here so chat UIs can render a "Proposed plan" card — the
   * objects the build will create, the agent's assumptions, and any
   * structure-deciding questions — and the user can approve or adjust before
   * `apply_blueprint` runs. Nothing is created yet; this is the confirm gate.
   */
  proposedPlan?: {
    summary?: string;
    objects: Array<{ name: string; label?: string; fieldCount: number }>;
    counts: { objects: number; views: number; dashboards: number; seedData: number };
    questions: string[];
    questionChoices?: Array<{ text: string; options: string[] }>;
    assumptions: string[];
    targetApp?: string;
  };
  /** Granular metadata-change preview (confirm-before-change). Set only
   *  when a mutating tool returned status:'changes_proposed' — i.e. it was
   *  NOT yet approved this turn, so nothing changed. Rendered as a 确认修改 card. */
  proposedChanges?: {
    summary?: string;
    changes: Array<{ verb: string; object?: string; field?: string; type?: string; name?: string; details?: string }>;
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
  /**
   * Inline notice shown when a message couldn't be sent because of rate-limiting
   * (HTTP 429). The user's text is restored to the composer, so the copy should
   * reassure them it isn't lost — e.g. "You're sending too quickly — your message
   * is kept below, wait a moment and try again."
   */
  sendFailedRateLimited?: string;
  /**
   * Inline notice for any other send failure (network / 5xx). Like
   * {@link sendFailedRateLimited}, the text is restored, so reassure the user.
   */
  sendFailedGeneric?: string;
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
  /**
   * Shown when a running turn's stream has gone quiet past the threshold —
   * e.g. "Still working…". Pairs with the live elapsed timer so the user sees
   * both that we are waiting and for how long.
   */
  connectionStalledLabel?: string;
  /**
   * Shown when the browser reports it is offline (navigator.onLine === false)
   * mid-turn — e.g. "Connection lost — reconnecting…". The honest disconnect cue.
   */
  connectionOfflineLabel?: string;
  /**
   * Lead-in shown while the build agent is designing a plan (the long, atomic
   * `propose_blueprint` call) — e.g. "Designing your app…". Pairs with the live
   * timer so the wait reads as deliberate work, not a hang.
   */
  designingPlanLabel?: string;
  /**
   * Rotating "what I'm doing now" hints cycled through during that same
   * propose_blueprint wait (the call is a single atomic LLM request with no
   * partial stream, so these are presentational reassurance, not live status).
   * Defaults to a sensible English set when omitted; pass a localized list to
   * override. An empty array disables rotation (only `designingPlanLabel` shows).
   */
  designingPlanHints?: string[];
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
  /**
   * Render a static, non-interactive transcript: hides the prompt-input
   * composer entirely so the conversation can be embedded in a public /
   * read-only surface (e.g. a `/s/:token` share page). The detailed tool
   * cards (proposed-plan, drafts) still render — but their action buttons
   * stay hidden because the host passes no `onSendMessage`/`onPublishDrafts`
   * callbacks, so the cards degrade to their read-only/summary form.
   */
  readOnly?: boolean;
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
  onOpenBuiltApp?: (appName: string, appSegment?: string) => void;
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
  onPreviewDraftApp?: (
    appName: string,
    opts?: { materialized?: boolean; appSegment?: string },
  ) => void;
  /** Label for the preview-draft action (default "Preview"). */
  previewDraftLabel?: string;
  /**
   * ADR-0037 Live Canvas: notifies the host whenever AI-authored draft
   * artifacts land in the conversation (build-progress items + drafted
   * envelopes), with the cumulative deduped set. Hosts use it to open and
   * refresh the live draft-preview pane while the agent builds.
   */
  onDraftArtifacts?: (
    artifacts: Array<{ type: string; name: string }>,
    appSegment?: string,
  ) => void;
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
  /** Heading for the pre-build proposed-plan card (default "Proposed plan"). */
  planTitleLabel?: string;
  /** Extend mode: prefix shown when proposedPlan.targetApp is set, framing
   *  the build as additive (e.g. "Adding to existing app"). */
  planExtendLabel?: string;
  /** Heading above the structure-deciding questions in the plan card (default "Confirm before building"). */
  planQuestionsLabel?: string;
  /** Heading above the agent's assumptions in the plan card (default "Assumptions"). */
  planAssumptionsLabel?: string;
  /**
   * Heading for the distinct "not yet built" section of the plan card — the
   * assumptions that name a business rule the build is explicitly DEFERRING to a
   * later flow/permission/approval pass (default "Not yet built"). Surfaced apart
   * from ordinary assumptions so the user does not mistake a deferred rule for
   * delivered behaviour (improvement 2). Split heuristically by
   * `classifyAssumptions`; the section only appears when something is deferred. */
  planDeferredLabel?: string;
  /** Footer hint inviting the user to approve or adjust the plan (default "Reply to approve or adjust this plan."). Shown only when `onSendMessage` is absent (no one-click gate). */
  planApproveHintLabel?: string;
  /** Label for the plan card's primary one-click "build it" button (default "Build it"). */
  planApproveLabel?: string;
  /** Label for the plan card's secondary "adjust" button, which focuses the chat input (default "Adjust"). */
  planAdjustLabel?: string;
  /** Static badge shown in place of the "Build it" button once this plan's build has run, so it can't be re-triggered (default "Built"). */
  planBuiltLabel?: string;
  /**
   * Body line of the FALLBACK confirm card shown when a propose_blueprint step
   * finished but produced no structured plan (so the rich card can't render).
   * The "Build it"/"Adjust" buttons (reusing `planApproveLabel`/`planAdjustLabel`)
   * still appear, so the user never has to guess the confirmation phrase
   * (default "The plan is ready. Build it now, or tell me what to adjust."). */
  planReadyLabel?: string;
  /** Message sent when the user approves a plan with no open questions (default "Looks good — build it as proposed."). */
  planApproveMessage?: string;
  /** Message sent when the user approves a plan that still has open questions — tells the agent to proceed on sensible defaults (default "Build it with your best assumptions; use sensible defaults for the open questions."). */
  planApproveDefaultsMessage?: string;
  /**
   * Builds the message sent when the user clicks a one-click answer chip for a
   * structure-deciding question (from `proposedPlan.questionChoices`). Receives
   * the question text and the chosen option. Default:
   * `For "<question>", go with: <option>.` — answers that question and lets the
   * agent continue (ask the next question or build).
   */
  planAnswerMessage?: (question: string, option: string) => string;
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

/**
 * The tool RETURNED, but its result is a confirm-before-change PREVIEW — the
 * change was proposed, NOT applied. Detects the gate envelopes
 * (`changes_proposed` from granular edits, `blueprint_proposed` /
 * `awaiting_confirmation` from the build flow). Tolerates a JSON-string or
 * object result. #772: without this a proposed edit's activity chip read
 * "Completed" even though it was still waiting for the user to confirm.
 */
export function isProposalResult(result: unknown): boolean {
  let obj: unknown = result;
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj);
    } catch {
      return false;
    }
  }
  const status = (obj as { status?: unknown } | null | undefined)?.status;
  return (
    status === 'changes_proposed' ||
    status === 'blueprint_proposed' ||
    status === 'awaiting_confirmation'
  );
}

export function getToolState(tool: ChatToolInvocation): ToolSummaryState {
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
    // A returned-but-not-applied confirm preview is AWAITING the user, not done
    // (#772): the change only commits when they approve on the next turn.
    return isProposalResult(tool.result) ? 'awaiting' : 'completed';
  }
  return 'running';
}

/** Render one granular change descriptor as a readable line for the confirm card. */
function formatChangeRow(c: {
  verb: string;
  object?: string;
  field?: string;
  type?: string;
  name?: string;
  details?: string;
}): string {
  const VERB: Record<string, string> = {
    create_object: '新建对象',
    add_field: '新增字段',
    modify_field: '修改字段',
    delete_field: '删除字段',
    create_metadata: '新建',
    update_metadata: '修改',
    create_seed: '生成示例数据',
    create_package: '新建应用包',
  };
  const verb = VERB[c.verb] ?? c.verb;
  const target = c.field ? `${c.object ? `${c.object}.` : ''}${c.field}` : (c.object ?? c.name ?? '');
  const typePart = c.type ? `（${c.type}）` : '';
  return [verb, `${target}${typePart}`, c.details].filter(Boolean).join(' ');
}

/**
 * True when this tool is the build agent's "propose a plan" step
 * (`propose_blueprint`). Matched by name so we can recognise it even when its
 * result did NOT parse into a structured `proposedPlan` — the case that used to
 * leave the user with a bare "reply 确认 to build" text and no button.
 */
function isBuildProposalTool(tool: ChatToolInvocation): boolean {
  return tool.toolName === 'propose_blueprint';
}

/**
 * A COMPLETED propose_blueprint whose result the detector could not turn into a
 * rich `proposedPlan` card (e.g. the model returned a thin/oddly-shaped envelope,
 * or proposed in prose). We still owe the user an explicit confirm gate, so the
 * detailed body renders a minimal "ready to build — Build it / Adjust" card
 * instead of collapsing the step into a chip and forcing them to guess the magic
 * "确认" phrase. Only the finished, non-error state qualifies: a running proposal
 * keeps its live timer, an errored one keeps its error card.
 */
function isUnstructuredBuildProposal(tool: ChatToolInvocation): boolean {
  return (
    isBuildProposalTool(tool) &&
    getToolState(tool) === 'completed' &&
    !tool.proposedPlan &&
    !tool.proposedChanges &&
    !tool.draftReview?.items.length
  );
}

/**
 * Phrases (Chinese + English, case-insensitive) that mark a plan `assumption` as
 * a business rule the build will NOT implement THIS turn — it is explicitly left
 * for a later flow/permission/approval pass. These read as "…will be added
 * later" / "…需要后续单独补权限" rather than a design note about what the build
 * already does, and the user must not mistake them for delivered behaviour.
 *
 * Kept deliberately conservative: only an explicit deferral marker matches. A
 * neutral design note (e.g. "设备通过所属客户建立归属关系") has none of these and
 * stays a normal assumption. Anchored on forward-looking / "not yet" cues, not on
 * the mere mention of "flow" or "permission" (a built rule can mention those too).
 */
const DEFERRED_ASSUMPTION_MARKERS: readonly string[] = [
  // Chinese deferral cues.
  '待补',
  '后续', // covers 后续 / 需要后续 / 后续单独 / 后续配置
  '将在',
  '稍后',
  '暂不',
  '暂未',
  '尚未',
  '确认后一起补',
  '一起补',
  '另行', // 另行配置 / 另行补充
  '日后',
  // English deferral cues (matched lowercase).
  'not yet',
  'will be implemented',
  'will be added',
  'to be added',
  'to be implemented',
  'later',
  'deferred',
  'follow-up',
  'follow up',
  'future',
  'subsequent',
  'coming soon',
  'tbd',
];

/**
 * Splits a plan's `assumptions` into ordinary design notes vs. business rules the
 * build is explicitly deferring ("待补 / Not yet built"). Pure + side-effect-free
 * so it is unit-tested directly; the card renders the two groups distinctly so a
 * user can tell "already built" from "still to come" at a glance (improvement 2).
 *
 * Order within each group is preserved. A blank/whitespace assumption is dropped.
 */
export function classifyAssumptions(assumptions: readonly string[]): {
  designNotes: string[];
  deferred: string[];
} {
  const designNotes: string[] = [];
  const deferred: string[] = [];
  for (const raw of assumptions) {
    if (typeof raw !== 'string') continue;
    const text = raw.trim();
    if (!text) continue;
    const haystack = text.toLowerCase();
    if (DEFERRED_ASSUMPTION_MARKERS.some((m) => haystack.includes(m))) {
      deferred.push(text);
    } else {
      designNotes.push(text);
    }
  }
  return { designNotes, deferred };
}

function shouldRenderDetailedTool(tool: ChatToolInvocation): boolean {
  const state = getToolState(tool);
  return (
    state === 'awaiting' ||
    state === 'failed' ||
    Boolean(tool.pendingActionId) ||
    Boolean(tool.draftReview?.items.length) ||
    // The pre-build "Proposed plan" card lives in the detailed tool body; route
    // a propose_blueprint result there instead of collapsing it into a chip.
    Boolean(tool.proposedPlan) ||
    Boolean(tool.proposedChanges) ||
    // A completed propose_blueprint that produced NO structured plan still needs
    // the detailed body — that's where the fallback "Build it" confirm gate
    // renders so the user is never left guessing the confirmation phrase.
    isUnstructuredBuildProposal(tool)
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

/**
 * The conversation store persists tool-call-only assistant turns with an
 * internal placeholder as their text ("(called todo_write, propose_blueprint)"
 * / "(tool call)" / "(no content)"). On re-hydration that placeholder used to
 * render as a normal prose bubble — internal jargon spliced into the thread
 * (#772). Detect it so the renderer can collapse it to a quiet activity note.
 */
function isToolCallPlaceholder(content: string): boolean {
  return /^\((?:called [^)]*|tool call|no content)\)$/.test(content.trim());
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
      readOnly = false,
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
      planTitleLabel = 'Proposed plan',
      planExtendLabel = 'Adding to existing app',
      planQuestionsLabel = 'Confirm before building',
      planAssumptionsLabel = 'Assumptions',
      planDeferredLabel = 'Not yet built',
      planApproveHintLabel = 'Reply to approve or adjust this plan.',
      planApproveLabel = 'Build it',
      planAdjustLabel = 'Adjust',
      planBuiltLabel = 'Built',
      planReadyLabel = 'The plan is ready. Build it now, or tell me what to adjust.',
      planApproveMessage = 'Looks good — build it as proposed.',
      planApproveDefaultsMessage = 'Build it with your best assumptions; use sensible defaults for the open questions.',
      planAnswerMessage = (question: string, option: string) => `For "${question}", go with: ${option}.`,
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
    // Last text submitted from the composer — used to RESTORE it when a send is
    // rejected before it reaches the model (rate-limit / network), so the user
    // never loses what they typed. Set on submit, read by the restore effect.
    const lastSubmittedRef = React.useRef<string>('');
    // Guards the restore effect so it fires once per failure (not on every
    // re-render while the error sits in state).
    const restoredErrorRef = React.useRef<unknown>(null);

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
        sendFailedRateLimited:
          labels?.sendFailedRateLimited ??
          "You're sending messages too quickly. Your message is kept below — wait a moment and try again.",
        sendFailedGeneric:
          labels?.sendFailedGeneric ??
          "Couldn't send your message. It's kept below — please try again.",
        trace: labels?.trace ?? 'trace',
        viewTrace: labels?.viewTrace ?? 'View trace',
        connectionWaiting: labels?.connectionWaiting ?? 'Waiting for server…',
        connectionStalledLabel: labels?.connectionStalledLabel ?? 'Still working…',
        connectionOfflineLabel: labels?.connectionOfflineLabel ?? 'Connection lost — reconnecting…',
        designingPlanLabel: labels?.designingPlanLabel ?? 'Designing your app…',
        // `?? DEFAULT_DESIGNING_PLAN_HINTS` (not `||`) so a caller can pass `[]`
        // to deliberately disable the rotation while keeping the lead-in label.
        designingPlanHints: labels?.designingPlanHints ?? DEFAULT_DESIGNING_PLAN_HINTS,
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
      // The preview pane routes on the app's PACKAGE id (ADR-0048), not its
      // name — take it from the draft set that includes the app.
      let appSegment: string | undefined;
      for (const message of messages) {
        for (const item of message.buildProgress?.items ?? []) {
          if (item?.type && item?.name) artifacts.set(`${item.type}:${item.name}`, item);
        }
        for (const tool of message.toolInvocations ?? []) {
          const dr = tool.draftReview;
          for (const item of dr?.items ?? []) {
            if (item?.type && item?.name) artifacts.set(`${item.type}:${item.name}`, item);
          }
          if (dr?.packageId && dr.items?.some((i) => i.type === 'app')) appSegment = dr.packageId;
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
      if (grew) onDraftArtifacts([...artifacts.values()], appSegment);
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
        const text = payload.text?.trim() ?? '';
        // Remember the text so a rejected send can restore it (the composer's
        // own form.reset clears the box optimistically). A fresh attempt also
        // clears any prior send-failure restore guard.
        lastSubmittedRef.current = text;
        restoredErrorRef.current = null;
        onSendMessage?.(text, files);
      },
      [onSendMessage]
    );

    const handleSuggestionClick = React.useCallback(
      (text: string) => {
        onSendMessage?.(text);
      },
      [onSendMessage]
    );

    // The "Proposed plan" card's one-click confirm gate. Approving sends a plain
    // chat message — the same channel the user would type into — so the agent
    // proceeds to apply_blueprint. When the plan still carries open questions,
    // approval explicitly authorizes sensible defaults so a click never silently
    // drops them.
    const promptInputWrapRef = React.useRef<HTMLDivElement>(null);
    const handlePlanApprove = React.useCallback(
      (hasOpenQuestions: boolean) => {
        onSendMessage?.(hasOpenQuestions ? planApproveDefaultsMessage : planApproveMessage);
      },
      [onSendMessage, planApproveMessage, planApproveDefaultsMessage]
    );
    // "Adjust" doesn't send anything — it just drops the cursor into the input so
    // the user can describe the change in their own words.
    const handlePlanAdjust = React.useCallback(() => {
      const textarea = promptInputWrapRef.current?.querySelector('textarea');
      if (textarea) {
        textarea.focus();
        textarea.scrollIntoView({ block: 'nearest' });
      }
    }, []);

    // Restore the composer text when a send was REJECTED before reaching the
    // model (rate-limit / network — `notSent`). The composer's own form.reset
    // clears the box optimistically and the optimistic user bubble was rolled
    // back (useObjectChat), so without this the typed message would just vanish.
    // Runs once per failure and never clobbers text the user has since typed.
    React.useEffect(() => {
      if (!error || !isUnsentSendError(error)) return;
      if (restoredErrorRef.current === error) return;
      restoredErrorRef.current = error;
      const text = lastSubmittedRef.current;
      if (!text) return;
      const textarea = promptInputWrapRef.current?.querySelector('textarea');
      if (textarea && textarea.value.trim() === '') {
        textarea.value = text;
        // Nudge the auto-grow sizing + any onInputChange listener.
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.focus();
      }
    }, [error]);

    const handleCopy = React.useCallback((message: ChatMessage) => {
      void navigator.clipboard?.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId((prev) => (prev === message.id ? null : prev)), 1500);
    }, []);

    // issue #432: a "Proposed plan" card whose build has already run must not
    // keep offering an active "Build it" — clicking it re-sent the approval and
    // re-triggered the entire build. A plan is "built" once an `apply_blueprint`
    // tool invocation appears AFTER it in the conversation. Keyed on `toolName`
    // (not the rich `draftReview`, which a reloaded conversation strips), so the
    // done-state survives a refresh. Positional so a later, not-yet-built plan
    // (e.g. after "make it simpler") keeps its live button.
    const builtPlanIds = React.useMemo(() => {
      const ids = new Set<string>();
      const plans: Array<{ id: string; order: number }> = [];
      let lastBuildOrder = -1;
      let order = 0;
      for (const message of messages) {
        for (const tool of message.toolInvocations ?? []) {
          // Both the structured plan card AND the fallback confirm card (an
          // unstructured propose_blueprint) own a "Build it" button, so both must
          // collapse to the inert "Built" badge once their build has run.
          if ((tool.proposedPlan || isUnstructuredBuildProposal(tool)) && tool.toolCallId) {
            plans.push({ id: tool.toolCallId, order });
          }
          if (tool.toolName === 'apply_blueprint') lastBuildOrder = order;
          order += 1;
        }
      }
      for (const p of plans) if (p.order < lastBuildOrder) ids.add(p.id);
      return ids;
    }, [messages]);

    // A granular 确认修改 card collapses to a static 已确认 badge once the change
    // has been applied — i.e. a LATER invocation of the SAME tool committed (no
    // longer a changes_proposed preview). Positional + per-tool so an earlier
    // confirmed change doesn't silence a later still-pending one.
    const confirmedChangeIds = React.useMemo(() => {
      const ids = new Set<string>();
      const proposals: Array<{ id: string; toolName: string; order: number }> = [];
      const lastCommitByTool = new Map<string, number>();
      let order = 0;
      for (const message of messages) {
        for (const tool of message.toolInvocations ?? []) {
          if (tool.proposedChanges && tool.toolCallId) {
            proposals.push({ id: tool.toolCallId, toolName: tool.toolName ?? '', order });
          } else if (tool.toolName) {
            lastCommitByTool.set(tool.toolName, order);
          }
          order += 1;
        }
      }
      for (const p of proposals) {
        const commit = lastCommitByTool.get(p.toolName);
        if (commit !== undefined && commit > p.order) ids.add(p.id);
      }
      return ids;
    }, [messages]);

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
      // A tool with no output yet is RUNNING — show a live elapsed timer next to
      // its title so a long blueprint/build call has a visible countdown, not a
      // static "Running" (issue #432).
      const isRunning = state === 'input-streaming' || state === 'input-available';
      const titleNode = (
        <span className="inline-flex min-w-0 items-center gap-2">
          <span>{friendlyTitle || tool.toolName}</span>
          {showRawName ? (
            <code className="rounded bg-muted px-1 py-px text-[10px] font-mono text-muted-foreground">
              {tool.toolName}
            </code>
          ) : null}
          {isRunning ? (
            // The plan-design step gets the friendly rotating-hint indicator
            // (long atomic call, no stream); every other running tool keeps the
            // compact timer. Mirrors the summary-strip treatment.
            isBuildProposalTool(tool) ? (
              <BuildProposalProgressHint
                label={L.designingPlanLabel}
                hints={L.designingPlanHints}
                offlineLabel={L.connectionOfflineLabel}
              />
            ) : (
              <ToolRunningTimer offlineLabel={L.connectionOfflineLabel} />
            )
          ) : null}
        </span>
      );

      return (
        <Tool
          key={tool.toolCallId}
          defaultOpen={
            state === 'output-error' ||
            state === 'approval-requested' ||
            Boolean(tool.draftReview && tool.draftReview.items.length > 0) ||
            Boolean(tool.proposedPlan) ||
            Boolean(tool.proposedChanges) ||
            // Fallback confirm gate (unstructured proposal) must open so its
            // "Build it" button is visible without an extra click.
            isUnstructuredBuildProposal(tool)
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
                            onClick={() => onPreviewDraftApp(app.name, { materialized: tool.draftReview!.materialized === true, appSegment: tool.draftReview!.packageId })}
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
            {/* Pre-build "Proposed plan" card — propose_blueprint returns a plan
                (objects, assumptions, structure-deciding questions) before
                anything is staged. Surfacing it as a reviewable card (not a bare
                "Completed" step) gives the user the Airtable-style confirm gate:
                see what will be built, then approve or adjust. Nothing is live
                yet. */}
            {tool.proposedPlan ? (
              <div
                className="flex flex-col gap-2 border-t bg-muted/20 px-3 py-2.5"
                data-testid="proposed-plan"
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                  <ClipboardList className="size-3.5" />
                  {planTitleLabel}
                </span>
                {tool.proposedPlan.targetApp ? (
                  <span
                    className="inline-flex w-fit items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300"
                    data-testid="proposed-plan-extend"
                  >
                    + {planExtendLabel} 「{tool.proposedPlan.targetApp}」
                  </span>
                ) : null}
                {tool.proposedPlan.summary ? (
                  <p className="text-xs text-muted-foreground">{tool.proposedPlan.summary}</p>
                ) : null}
                {tool.proposedPlan.objects.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {tool.proposedPlan.objects.map((o) => (
                      <span
                        key={o.name}
                        className="inline-flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-[11px] text-foreground/80"
                        title={o.name}
                      >
                        <Table2 className="size-3 text-foreground/40" />
                        {o.label || o.name}
                        {o.fieldCount > 0 ? (
                          <span className="text-foreground/40">· {o.fieldCount}</span>
                        ) : null}
                      </span>
                    ))}
                  </div>
                ) : null}
                {(() => {
                  const c = tool.proposedPlan!.counts;
                  const bits: string[] = [];
                  if (c.objects) bits.push(`${c.objects} object${c.objects === 1 ? '' : 's'}`);
                  if (c.views) bits.push(`${c.views} view${c.views === 1 ? '' : 's'}`);
                  if (c.dashboards)
                    bits.push(`${c.dashboards} dashboard${c.dashboards === 1 ? '' : 's'}`);
                  if (c.seedData) bits.push('sample data');
                  return bits.length ? (
                    <span className="text-[11px] text-muted-foreground">{bits.join(' · ')}</span>
                  ) : null;
                })()}
                {/* Assumptions split into ordinary design notes vs. business
                    rules the build is explicitly DEFERRING ("待补 / Not yet
                    built"). The deferred set gets its own labelled, tinted
                    section with an hourglass so a user can't mistake a
                    still-to-come rule for delivered behaviour (improvement 2). */}
                {(() => {
                  const { designNotes, deferred } = classifyAssumptions(
                    tool.proposedPlan!.assumptions,
                  );
                  return (
                    <>
                      {designNotes.length > 0 ? (
                        <div className="flex flex-col gap-0.5" data-testid="proposed-plan-assumptions">
                          <span className="text-[11px] font-medium text-foreground/70">
                            {planAssumptionsLabel}
                          </span>
                          {designNotes.map((a, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-1.5 text-[11px] text-muted-foreground"
                            >
                              <span className="mt-px shrink-0 text-foreground/40">·</span>
                              <span>{a}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {deferred.length > 0 ? (
                        <div
                          className="flex flex-col gap-1 rounded-md border border-dashed border-amber-300 bg-amber-50/60 px-2 py-1.5 dark:border-amber-800/60 dark:bg-amber-950/20"
                          data-testid="proposed-plan-deferred"
                        >
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                            <Hourglass className="size-3.5" />
                            {planDeferredLabel}
                          </span>
                          {deferred.map((a, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-1.5 text-[11px] text-amber-900/90 dark:text-amber-200/90"
                            >
                              <span className="mt-px shrink-0 text-amber-500/80">·</span>
                              <span>{a}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </>
                  );
                })()}
                {tool.proposedPlan.questions.length > 0 ? (
                  <div
                    className="flex flex-col gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 dark:border-amber-900/50 dark:bg-amber-950/30"
                    data-testid="proposed-plan-questions"
                  >
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                      <HelpCircle className="size-3.5" />
                      {planQuestionsLabel}
                    </span>
                    {tool.proposedPlan.questions.map((q, idx) => {
                      // One-click answer chips when the backend derived options
                      // for this exact question; otherwise the user types a reply.
                      const choice = tool.proposedPlan!.questionChoices?.find((c) => c.text === q);
                      return (
                        <div key={idx} className="flex flex-col gap-1">
                          <div className="flex items-start gap-1.5 text-[11px] text-amber-900/90 dark:text-amber-200/90">
                            <span className="mt-px shrink-0">?</span>
                            <span>{q}</span>
                          </div>
                          {onSendMessage && choice && choice.options.length > 0 ? (
                            <div
                              className="flex flex-wrap gap-1 pl-3.5"
                              data-testid="proposed-plan-choice"
                            >
                              {choice.options.map((opt, oi) => (
                                <button
                                  key={oi}
                                  type="button"
                                  onClick={() => onSendMessage(planAnswerMessage(q, opt))}
                                  className="inline-flex h-6 items-center rounded-full border border-amber-300 bg-background px-2 text-[11px] font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/40"
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {/* One-click confirm gate: "Build it" sends an approval message
                    (accepting defaults when questions remain), "Adjust" focuses
                    the input so the user types changes. Falls back to a text hint
                    when the host hasn't wired message sending. Once this plan's
                    build has run (issue #432) the actions collapse to a static
                    "Built" badge so it can't be re-triggered. */}
                {onSendMessage ? (
                  builtPlanIds.has(tool.toolCallId) ? (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5" data-testid="proposed-plan-actions">
                      <span
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                        data-testid="proposed-plan-built"
                      >
                        <CheckCircle2 className="size-3.5" />
                        {planBuiltLabel}
                      </span>
                    </div>
                  ) : (
                  <div
                    className="flex flex-wrap items-center gap-1.5 pt-0.5"
                    data-testid="proposed-plan-actions"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        handlePlanApprove(tool.proposedPlan!.questions.length > 0)
                      }
                      className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      data-testid="proposed-plan-approve"
                    >
                      <Rocket className="size-3.5" />
                      {planApproveLabel}
                    </button>
                    <button
                      type="button"
                      onClick={handlePlanAdjust}
                      className="inline-flex h-7 items-center rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent"
                      data-testid="proposed-plan-adjust"
                    >
                      {planAdjustLabel}
                    </button>
                  </div>
                  )
                ) : (
                  <span className="text-[11px] italic text-muted-foreground/80">
                    {planApproveHintLabel}
                  </span>
                )}
              </div>
            ) : null}
            {/* FALLBACK confirm gate — a propose_blueprint that FINISHED but whose
                result didn't parse into the rich plan card above (a thin/oddly
                shaped envelope, or a prose proposal). Previously this collapsed
                into a "Propose blueprint · Completed" chip and the user was left
                with the assistant's prose telling them to reply "确认" — no
                button, guess-the-phrase. We always give them an explicit, one
                click "Build it" / "Adjust" instead. Same approve/adjust handlers
                and the same #432 built-state collapse as the structured card. */}
            {isUnstructuredBuildProposal(tool) ? (
              <div
                className="flex flex-col gap-2 border-t bg-muted/20 px-3 py-2.5"
                data-testid="proposed-plan-fallback"
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                  <ClipboardList className="size-3.5" />
                  {planTitleLabel}
                </span>
                <p className="text-xs text-muted-foreground">{planReadyLabel}</p>
                {onSendMessage ? (
                  builtPlanIds.has(tool.toolCallId) ? (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5" data-testid="proposed-plan-actions">
                      <span
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                        data-testid="proposed-plan-built"
                      >
                        <CheckCircle2 className="size-3.5" />
                        {planBuiltLabel}
                      </span>
                    </div>
                  ) : (
                    <div
                      className="flex flex-wrap items-center gap-1.5 pt-0.5"
                      data-testid="proposed-plan-actions"
                    >
                      <button
                        type="button"
                        // No structured questions to default through → plain approve.
                        onClick={() => handlePlanApprove(false)}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                        data-testid="proposed-plan-approve"
                      >
                        <Rocket className="size-3.5" />
                        {planApproveLabel}
                      </button>
                      <button
                        type="button"
                        onClick={handlePlanAdjust}
                        className="inline-flex h-7 items-center rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent"
                        data-testid="proposed-plan-adjust"
                      >
                        {planAdjustLabel}
                      </button>
                    </div>
                  )
                ) : (
                  <span className="text-[11px] italic text-muted-foreground/80">
                    {planApproveHintLabel}
                  </span>
                )}
              </div>
            ) : null}
            {/* Granular confirm-before-change card — a mutating tool that was
                not approved this turn returns status:'changes_proposed' (a
                preview) instead of committing. Same confirm gate as the plan
                card: see the change, then 确认修改 / 调整. Nothing changed yet. */}
            {tool.proposedChanges ? (
              <div
                className="flex flex-col gap-2 border-t bg-muted/20 px-3 py-2.5"
                data-testid="proposed-changes"
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                  <ClipboardList className="size-3.5" />
                  确认改动
                </span>
                {tool.proposedChanges.summary ? (
                  <p className="text-xs text-muted-foreground">{tool.proposedChanges.summary}</p>
                ) : null}
                <div className="flex flex-col gap-1">
                  {tool.proposedChanges.changes.map((c, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-1.5 rounded-md border bg-background px-2 py-1 text-[11px] text-foreground/80"
                    >
                      <Table2 className="mt-px size-3 shrink-0 text-foreground/40" />
                      <span>{formatChangeRow(c)}</span>
                    </div>
                  ))}
                </div>
                {onSendMessage ? (
                  confirmedChangeIds.has(tool.toolCallId) ? (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5" data-testid="proposed-changes-actions">
                      <span
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                        data-testid="proposed-changes-confirmed"
                      >
                        <CheckCircle2 className="size-3.5" />
                        已确认
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5" data-testid="proposed-changes-actions">
                      <button
                        type="button"
                        onClick={() => onSendMessage('确认修改，应用你刚才提议的改动。')}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                        data-testid="proposed-changes-confirm"
                      >
                        <CheckCircle2 className="size-3.5" />
                        确认修改
                      </button>
                      <button
                        type="button"
                        onClick={handlePlanAdjust}
                        className="inline-flex h-7 items-center rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent"
                        data-testid="proposed-changes-adjust"
                      >
                        调整
                      </button>
                    </div>
                  )
                ) : (
                  <span className="text-[11px] italic text-muted-foreground/80">回复以确认或调整该改动。</span>
                )}
              </div>
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
                <div className="w-full max-w-full space-y-1">
                  <h3 className="text-sm font-medium text-foreground/90 break-words">{L.emptyTitle}</h3>
                  <p className="text-sm text-muted-foreground break-words">
                    {L.emptyDescription}
                  </p>
                </div>
                {suggestions && suggestions.length > 0 ? (
                  <div className="flex w-full max-w-full flex-wrap justify-center gap-2">
                    {suggestions.map((s) => (
                      <Suggestion
                        key={s}
                        className="h-auto min-h-8 min-w-0 max-w-full whitespace-normal break-words rounded-full border-border/60 bg-background/80 px-3 py-1 text-left text-xs font-medium text-foreground/90 shadow-none hover:bg-muted/60"
                        suggestion={s}
                        onClick={handleSuggestionClick}
                      />
                    ))}
                  </div>
                ) : null}
              </ConversationEmptyState>
            ) : (
              messages.map((message) => {
                const isUser = message.role === 'user';
                const tools = message.toolInvocations ?? [];
                const reasoning = message.reasoning?.trim();
                const sources = message.sources ?? [];
                const buildProgress = !isUser ? message.buildProgress : undefined;
                // The live "Designing…" panel is a hand-off affordance: it
                // yields to the authoritative "Proposed plan" card the instant
                // the propose_blueprint result lands. Suppress it once any tool
                // on this turn carries a structured plan — which also makes it a
                // no-op on reload (only the persisted plan card exists then).
                const blueprintProgress =
                  !isUser && !tools.some((t) => Boolean(t.proposedPlan))
                    ? message.blueprintProgress
                    : undefined;
                const isEmptyAssistantStreaming =
                  !isUser &&
                  Boolean(message.streaming) &&
                  !message.content &&
                  tools.length === 0 &&
                  !reasoning &&
                  !buildProgress &&
                  !blueprintProgress; // a streaming design/build shows its panel, not the dots
                const summaryTools =
                  !isUser && processVisibility === 'summary'
                    ? tools.filter(
                        (tool) =>
                          !shouldRenderDetailedTool(tool) &&
                          // While the live design panel is up it already
                          // represents the running propose_blueprint, so don't
                          // also surface that tool's rotating-hint row in the
                          // activity strip (the panel supersedes the
                          // placeholder). With no events the row stays and shows
                          // the placeholder as before.
                          !(blueprintProgress && tool.toolName === 'propose_blueprint'),
                      )
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
                      {blueprintProgress ? (
                        <BlueprintProgressPanel
                          progress={blueprintProgress}
                          designingLabel={L.designingPlanLabel}
                          extendLabel={planExtendLabel}
                          waitingLabel={L.connectionWaiting}
                          stalledLabel={L.connectionStalledLabel}
                          offlineLabel={L.connectionOfflineLabel}
                        />
                      ) : null}
                      {buildProgress ? (
                        <BuildProgressPanel
                          progress={buildProgress}
                          onOpenBuiltApp={onOpenBuiltApp}
                          openBuiltAppLabel={openBuiltAppLabel}
                          onPreviewDraftApp={onPreviewDraftApp}
                          previewDraftLabel={previewDraftLabel}
                          waitingLabel={L.connectionWaiting}
                          stalledLabel={L.connectionStalledLabel}
                          offlineLabel={L.connectionOfflineLabel}
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
                        isToolCallPlaceholder(message.content) ? (
                          // #772: a re-hydrated tool-call-only turn is persisted
                          // with an internal placeholder ("(called todo_write,
                          // propose_blueprint)"); render a quiet localized
                          // activity note instead of leaking it as prose.
                          <span
                            className="text-xs italic text-muted-foreground/70"
                            title={message.content}
                          >
                            {L.agentActivity}
                          </span>
                        ) : (
                          <MessageResponse>{message.content}</MessageResponse>
                        )
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
                stalledLabel={L.connectionStalledLabel}
                offlineLabel={L.connectionOfflineLabel}
              />
            ) : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {error ? (
          // A never-sent failure (rate-limit / network) gets a friendly "your
          // message is kept" notice — the input was restored above, so a
          // "Response failed / Retry" banner (which regenerates the wrong turn
          // after rollback) would mislead. Quota 429s still use ErrorBanner so
          // its upgrade / top-up CTA shows; mid-stream failures keep Retry.
          isUnsentSendError(error) && !parseAiQuotaError(error) ? (
            <SendErrorNotice
              error={error}
              rateLimitedLabel={L.sendFailedRateLimited}
              genericLabel={L.sendFailedGeneric}
            />
          ) : (
            <ErrorBanner error={error} onReload={onReload} onUpgrade={onUpgrade} />
          )
        ) : null}

        {readOnly ? null : (
        <div
          ref={promptInputWrapRef}
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
                {/* Only a real CHOICE warrants a picker: free / single-model
                    envs (the backend returns one entry) get no dropdown — the
                    lone model is still sent via `selectedModelId`. */}
                {models && models.length > 1 ? (
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
        )}

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
  stalledLabel,
  offlineLabel,
}: {
  showAvatar: boolean;
  assistantAvatarUrl?: string;
  assistantAvatarFallback?: string;
  waitingLabel: string;
  stalledLabel: string;
  offlineLabel: string;
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
            <LivenessIndicator
              active
              pending
              activityKey={0}
              waitingLabel={waitingLabel}
              stalledLabel={stalledLabel}
              offlineLabel={offlineLabel}
            />
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
 * True when the browser reports it is offline. Reads `navigator.onLine` and
 * tracks the window `online`/`offline` events, so a real network drop surfaces
 * IMMEDIATELY — before the stream-quiet timeout would otherwise infer it.
 */
function useIsOffline(): boolean {
  const [offline, setOffline] = React.useState<boolean>(
    () => typeof navigator !== 'undefined' && navigator.onLine === false,
  );
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  return offline;
}

/**
 * Honest connection cue beside a running spinner. A LIVE `m:ss` timer is ALWAYS
 * shown (counting up from the first second, not only once bytes arrive) so the
 * user can always see the turn is progressing and for how long. Four states,
 * each a real fact about the stream:
 *
 *  - **offline** (red WifiOff) — `navigator.onLine` is false: the browser has
 *    no network. Surfaced instantly via the online/offline events.
 *  - **receiving** (emerald pulse) — bytes arrived from the server recently.
 *  - **waiting** (muted) — request in flight, nothing back yet (`pending`,
 *    e.g. before the first token). Neutral, never claims "receiving".
 *  - **stalled** (amber) — the stream has gone quiet past the threshold; the
 *    honest "we have not heard back for Ns" signal.
 *
 * A hard disconnect/error also surfaces via the chat error banner (with Retry).
 * `pending` selects waiting-vs-receiving wording: pass it when no server bytes
 * have been observed for this turn yet (the bare thinking state).
 */
function LivenessIndicator({
  active,
  activityKey,
  pending = false,
  waitingLabel,
  stalledLabel = 'Still working…',
  offlineLabel = 'Connection lost — reconnecting…',
}: {
  active: boolean;
  activityKey: string | number;
  pending?: boolean;
  waitingLabel: string;
  stalledLabel?: string;
  offlineLabel?: string;
}) {
  const { elapsedSeconds, quietSeconds, live } = useTurnLiveness(active, activityKey);
  const offline = useIsOffline();
  const tier: 'offline' | 'stalled' | 'receiving' | 'waiting' = offline
    ? 'offline'
    : !live
      ? 'stalled'
      : pending
        ? 'waiting'
        : 'receiving';
  const elapsed = formatElapsed(elapsedSeconds);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs tabular-nums',
        tier === 'offline'
          ? 'text-red-600 font-medium'
          : tier === 'stalled'
            ? 'text-amber-600 font-medium'
            : 'font-normal text-muted-foreground',
      )}
      aria-live="polite"
      data-liveness-tier={tier}
      title={
        tier === 'offline'
          ? `${offlineLabel} · ${elapsed} elapsed`
          : tier === 'receiving'
            ? `Receiving from server · ${elapsed} elapsed`
            : tier === 'stalled'
              ? `${stalledLabel} (${quietSeconds}s with no response) · ${elapsed} elapsed`
              : `${waitingLabel} · ${elapsed} elapsed`
      }
    >
      {tier === 'offline' ? (
        <WifiOff className="size-3 shrink-0" aria-hidden />
      ) : (
        <span
          aria-hidden
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            tier === 'receiving'
              ? 'bg-emerald-500 animate-pulse'
              : tier === 'stalled'
                ? 'bg-amber-500'
                : 'bg-muted-foreground/50 animate-pulse',
          )}
        />
      )}
      {/* The live count-up timer is ALWAYS visible (the "倒计时"): a turn never
          looks frozen, even before the first server byte. */}
      <Clock3 className="size-3 shrink-0" aria-hidden />
      <span>{elapsed}</span>
      {/* A short status label accompanies the timer in every state except the
          calm "receiving" one (where the green pulse already says data is
          flowing) — so "waiting", "still working" and "connection lost" read
          plainly instead of as a bare number. */}
      {tier === 'receiving' ? null : (
        <span>
          · {tier === 'offline' ? offlineLabel : tier === 'stalled' ? stalledLabel : waitingLabel}
        </span>
      )}
    </span>
  );
}

/**
 * Default rotating hints for the propose_blueprint wait. Presentational
 * reassurance — the call is one atomic LLM request with no partial stream, so
 * these don't reflect real sub-steps; they just let the (tens-of-seconds) wait
 * read as deliberate design work instead of a hang. Order roughly follows how a
 * human would think a schema through, with a few extra later-stage lines so a
 * multi-minute wait keeps showing fresh copy instead of an obvious 5-item loop
 * (improvement 4). Overridable/localizable via the `designingPlanHints` label.
 */
const DEFAULT_DESIGNING_PLAN_HINTS = [
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
];

/** How long each design-stage hint stays up (ms) before advancing to the next. */
const DESIGNING_HINT_ROTATE_MS = 3500;

/**
 * Which design hint to show after `elapsedMs` of waiting. Pure + deterministic
 * so it can be unit-tested and so the visible stage is a function of the live
 * elapsed clock (improvement 4) rather than a free-running interval.
 *
 * It advances ONE stage every `stepMs`, then CLAMPS on the final hint instead of
 * wrapping back to the start — so a long wait reads as steady forward progress
 * ("…pulling it together" stays up at the end) and never loops back to "mapping
 * data", which would look like it restarted. Returns the 0-based stage index;
 * `-1` when there is nothing to show (empty list). This is presentational
 * staging, NOT a claim of real sub-step progress or a fake percentage.
 */
export function selectDesignHintIndex(
  elapsedMs: number,
  hintCount: number,
  stepMs: number = DESIGNING_HINT_ROTATE_MS,
): number {
  if (hintCount <= 0) return -1;
  if (hintCount === 1) return 0;
  const safeElapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  const step = stepMs > 0 ? stepMs : DESIGNING_HINT_ROTATE_MS;
  const stage = Math.floor(safeElapsed / step);
  return Math.min(stage, hintCount - 1);
}

/**
 * Friendly in-progress indicator for the build agent's `propose_blueprint`
 * step. Because that call is a SINGLE long, atomic LLM request (no token
 * stream, no partial results), a bare elapsed timer made it look like the UI
 * might be stuck. This pairs the live `ToolRunningTimer` with a short lead-in
 * ("Designing your app…"), a hint that ADVANCES through the design stages as the
 * wait grows, and a row of step dots filled up to the current stage so the wait
 * visibly "moves forward". The staging is purely presentational — it is NOT
 * claiming real sub-step progress or a percentage; it just clamps on the final
 * stage rather than looping. An empty `hints` array (or a single entry) just
 * pins the lead-in + timer with no rotation or dots.
 */
function BuildProposalProgressHint({
  label,
  hints,
  offlineLabel,
}: {
  label: string;
  hints: string[];
  offlineLabel: string;
}) {
  // Re-read the real elapsed clock once per stage interval; the visible stage is
  // DERIVED from it (via the pure selector) so the hint and the step dots advance
  // off one source of truth. The live seconds timer beside this ticks every 1s on
  // its own, so the strip keeps "moving" between stage changes.
  const [elapsedMs, setElapsedMs] = React.useState(0);
  React.useEffect(() => {
    if (hints.length <= 1) return; // nothing to advance through
    const start = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - start), DESIGNING_HINT_ROTATE_MS);
    return () => clearInterval(id);
  }, [hints.length]);
  const index = selectDesignHintIndex(elapsedMs, hints.length);
  const hint = index >= 0 ? hints[index] : undefined;
  // Show the lightweight step dots only once there are real stages to track and
  // we won't crowd the strip (cap the dot count so a long custom list stays sane).
  const showDots = hints.length > 1 && hints.length <= 12;
  return (
    <span
      className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
      data-testid="build-proposal-progress"
      aria-live="polite"
    >
      <Sparkles className="size-3 shrink-0 animate-pulse text-primary" aria-hidden />
      <span className="font-medium text-foreground/80">{label}</span>
      {hint ? (
        // `key` on the hint text restarts the fade each time it swaps, so the
        // stage change reads as a gentle transition rather than an instant flicker.
        <span key={hint} className="truncate animate-in fade-in duration-500">
          {hint}
        </span>
      ) : null}
      {showDots ? (
        <span
          className="hidden shrink-0 items-center gap-0.5 sm:inline-flex"
          data-testid="build-proposal-progress-dots"
          aria-hidden
        >
          {hints.map((_, i) => (
            <span
              key={i}
              className={cn(
                'size-1 rounded-full transition-colors',
                i <= index ? 'bg-primary/70' : 'bg-muted-foreground/25',
              )}
            />
          ))}
        </span>
      ) : null}
      <ToolRunningTimer offlineLabel={offlineLabel} />
    </span>
  );
}

/**
 * Compact elapsed-timer + offline cue for a tool that is currently RUNNING
 * (issue #432) — e.g. the "Propose blueprint · Running" header. Counts up from
 * when the running card mounts so a long tool call (a blueprint can take tens of
 * seconds) shows a visible "倒计时" instead of a static "Running", and flips to a
 * red offline cue the moment the browser loses the network. Unlike the
 * stream-liveness indicator it never escalates to amber on quiet — a running
 * tool legitimately produces no client bytes while the server works.
 */
function ToolRunningTimer({ offlineLabel }: { offlineLabel: string }) {
  const [elapsed, setElapsed] = React.useState(0);
  const offline = useIsOffline();
  React.useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs tabular-nums',
        offline ? 'text-red-600 font-medium' : 'text-muted-foreground',
      )}
      aria-live="polite"
      data-tool-running-timer
    >
      {offline ? (
        <WifiOff className="size-3 shrink-0" aria-hidden />
      ) : (
        <Clock3 className="size-3 shrink-0" aria-hidden />
      )}
      <span>{formatElapsed(elapsed)}</span>
      {offline ? <span>· {offlineLabel}</span> : null}
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
 * Live "Designing…" panel for an in-flight blueprint DESIGN (`propose_blueprint`).
 * The plan-design call is a long, atomic LLM request; the server now streams a
 * reconciled `data-blueprint-progress` part as the schema takes shape, so this
 * panel shows objects appearing one-by-one (label + field count) with the
 * summary / extend target revealed progressively — replacing the purely
 * presentational rotating-hint placeholder with real, event-driven progress.
 *
 * It is a LIVE affordance only: the caller stops rendering it the instant the
 * `propose_blueprint` result lands (a structured `proposedPlan` exists on the
 * turn), so the authoritative "Proposed plan" card takes over cleanly. With no
 * progress events (older runtimes / non-streaming turns) this never renders and
 * the rotating-hint placeholder remains — zero regression.
 */
function BlueprintProgressPanel({
  progress,
  designingLabel = 'Designing your app…',
  extendLabel = 'Adding to existing app',
  waitingLabel = 'Waiting for server…',
  stalledLabel = 'Still working…',
  offlineLabel = 'Connection lost — reconnecting…',
}: {
  progress: ChatBlueprintProgress;
  designingLabel?: string;
  extendLabel?: string;
  waitingLabel?: string;
  stalledLabel?: string;
  offlineLabel?: string;
}) {
  const { phase, summary, appLabel, targetApp, objects, counts, seq } = progress;
  const isDone = phase === 'done';
  // Real activity key, mirroring BuildProgressPanel: prefer the server's
  // monotonic `seq` (it also advances on keep-alive heartbeats, where the
  // content fields don't change), else a content signature for older runtimes.
  // Drives the liveness indicator off observed bytes so the wait reads as
  // "designing" rather than a hang.
  const activityKey = seq ?? `${phase}:${objects.length}`;
  // At `done` the app's own summary/label is the most informative header; while
  // designing, the localized "Designing your app…" lead-in pairs with the
  // summary shown on its own line below.
  const headerText = isDone ? summary || appLabel || designingLabel : designingLabel;
  const countBits: string[] = [];
  if (counts?.objects)
    countBits.push(`${counts.objects} object${counts.objects === 1 ? '' : 's'}`);
  if (counts?.views) countBits.push(`${counts.views} view${counts.views === 1 ? '' : 's'}`);
  if (counts?.dashboards)
    countBits.push(`${counts.dashboards} dashboard${counts.dashboards === 1 ? '' : 's'}`);
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-sm" data-testid="blueprint-progress">
      <div className="mb-2 flex items-center gap-2 font-medium">
        {isDone ? (
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
        ) : (
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
        )}
        <span className="min-w-0 truncate">{headerText}</span>
        {targetApp ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300"
            data-testid="blueprint-progress-extend"
          >
            + {extendLabel} 「{targetApp}」
          </span>
        ) : null}
        {!isDone ? (
          <span className="ml-auto shrink-0">
            <LivenessIndicator
              active
              activityKey={activityKey}
              waitingLabel={waitingLabel}
              stalledLabel={stalledLabel}
              offlineLabel={offlineLabel}
            />
          </span>
        ) : null}
      </div>
      {/* Summary one-liner — revealed progressively as the design streams. At
          `done` it's already promoted into the header, so only show it here
          while designing. */}
      {!isDone && (summary || appLabel) ? (
        <p className="mb-2 text-xs text-muted-foreground">{summary || appLabel}</p>
      ) : null}
      {objects.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" data-testid="blueprint-progress-objects">
          {objects.map((o) => (
            // `key` on the stable object name fades each chip in exactly once as
            // it first appears, so the panel reads as objects materialising one
            // by one rather than a list snapping into place.
            <span
              key={o.name}
              className="inline-flex animate-in fade-in items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-[11px] text-foreground/80 duration-500"
              title={o.name}
            >
              <Table2 className="size-3 text-foreground/40" />
              {o.label || o.name}
              {o.fields ? <span className="text-foreground/40">· {o.fields}</span> : null}
            </span>
          ))}
        </div>
      ) : null}
      {countBits.length > 0 ? (
        <span className="mt-2 block text-[11px] text-muted-foreground">
          {countBits.join(' · ')}
        </span>
      ) : null}
    </div>
  );
}

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
  stalledLabel = 'Still working…',
  offlineLabel = 'Connection lost — reconnecting…',
}: {
  progress: ChatBuildProgress;
  onOpenBuiltApp?: (appName: string) => void;
  openBuiltAppLabel?: string;
  onPreviewDraftApp?: (appName: string) => void;
  previewDraftLabel?: string;
  waitingLabel?: string;
  stalledLabel?: string;
  offlineLabel?: string;
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
            <LivenessIndicator
              active
              activityKey={activityKey}
              waitingLabel={waitingLabel}
              stalledLabel={stalledLabel}
              offlineLabel={offlineLabel}
            />
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
  connectionOfflineLabel: string;
  designingPlanLabel: string;
  designingPlanHints: string[];
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
            {group.state === 'running' ? (
              // A running tool (e.g. "Propose blueprint") shows a LIVE elapsed
              // timer instead of a static "Running", and a red offline cue if
              // the network drops (issue #432). The build agent's plan-design
              // step is special-cased: that one call is a long, atomic LLM
              // request with no token stream, so a bare timer felt stuck — give
              // it a friendly "Designing your app…" lead-in with rotating hints.
              group.rawName === 'propose_blueprint' ? (
                <BuildProposalProgressHint
                  label={labels.designingPlanLabel}
                  hints={labels.designingPlanHints}
                  offlineLabel={labels.connectionOfflineLabel}
                />
              ) : (
                <ToolRunningTimer offlineLabel={labels.connectionOfflineLabel} />
              )
            ) : (
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
            )}
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

/**
 * Inline notice for a message that couldn't be SENT (rejected before reaching
 * the model — rate-limit 429 / network / 5xx). Distinct from {@link ErrorBanner}
 * (a streamed response that failed): here the typed text has been restored to
 * the composer, so the copy reassures the user it isn't lost rather than
 * offering a Retry that would regenerate the wrong (rolled-back) turn. A
 * rate-limit gets the "you're sending too quickly" wording; anything else the
 * generic one.
 */
function SendErrorNotice({
  error,
  rateLimitedLabel,
  genericLabel,
}: {
  error: Error;
  rateLimitedLabel: string;
  genericLabel: string;
}) {
  const text = React.useMemo(
    () => (isRateLimitError(error) ? rateLimitedLabel : genericLabel),
    [error, rateLimitedLabel, genericLabel],
  );
  return (
    <div className="border-t bg-background px-3 py-2 text-sm" role="alert" data-testid="chat-send-error">
      <div className="rounded-md border border-amber-300/40 bg-amber-50/60 px-3 py-2 text-foreground dark:bg-amber-950/20">
        <div className="flex items-start gap-2">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1 break-words leading-snug">{text}</div>
        </div>
      </div>
    </div>
  );
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

/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Utilities for mapping Vercel AI SDK v6 `UIMessage` shapes (the `parts`
 * model — `[ { type: 'text' | 'reasoning' | 'tool-*' | 'dynamic-tool' |
 * 'source-url' | … } ]`) into the simpler `ChatMessage` shape consumed by
 * `<ChatbotEnhanced>`.
 *
 * Shared between `useObjectChat` (which composes `useChat` internally) and
 * apps that drive `useChat` themselves (e.g. Studio, which needs a custom
 * `prepareSendMessagesRequest` transport).
 */
import type { ChatMessage, ChatToolInvocation, ChatSource, ChatBuildProgress, ChatChart } from './ChatbotEnhanced';

interface AnyPart {
  type?: string;
  text?: string;
  toolCallId?: string;
  toolName?: string;
  id?: string;
  input?: unknown;
  output?: unknown;
  args?: unknown;
  result?: unknown;
  errorText?: string;
  state?: ChatToolInvocation['state'];
  url?: string;
  href?: string;
  title?: string;
  /** Payload of a Vercel custom data part (`data-*`), e.g. build progress. */
  data?: unknown;
}

interface AnyUIMessage {
  id?: string;
  role?: 'user' | 'assistant' | 'system';
  parts?: AnyPart[];
  content?: unknown;
  toolInvocations?: ChatToolInvocation[];
  metadata?: unknown;
}

function extractText(msg: AnyUIMessage, parts: AnyPart[]): string {
  if (typeof msg.content === 'string') return msg.content;
  return parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('');
}

function extractReasoning(parts: AnyPart[]): string | undefined {
  const joined = parts
    .filter((p) => p.type === 'reasoning' || p.type === 'reasoning-delta')
    .map((p) => p.text ?? '')
    .join('\n')
    .trim();
  return joined.length > 0 ? joined : undefined;
}

/**
 * Best-effort detector for the framework's HITL pending envelope. Server-side
 * `action-tools.ts` returns a JSON string of shape
 *   `{ "status": "pending_approval", "pendingActionId": "pa_…", … }`
 * inside the tool's `output.value` when the action is dangerous and approval
 * is enabled. We surface this on the invocation so chat UIs can render an
 * inline approve/reject affordance without round-tripping back to the server.
 */
/**
 * Parse a tool result into the framework's JSON envelope object, if it is one.
 * The Vercel SDK wraps tool outputs as `{ type: 'text', value: string }`, so we
 * peel one layer if present, then fall back to the raw value. Returns the first
 * candidate that parses to a plain object.
 */
function parseResultEnvelope(result: unknown): Record<string, unknown> | undefined {
  const tryParse = (value: unknown): Record<string, unknown> | undefined => {
    if (value && typeof value === 'object') return value as Record<string, unknown>;
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed.startsWith('{')) return undefined;
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
    } catch {
      return undefined;
    }
  };
  const candidates: unknown[] = [result];
  if (result && typeof result === 'object' && 'value' in (result as Record<string, unknown>)) {
    candidates.push((result as Record<string, unknown>).value);
  }
  // Prefer a candidate that carries the framework's `status` discriminator —
  // this peels the Vercel `{ type:'text', value:'…json…' }` wrapper, whose
  // outer object has no `status`, to the inner envelope that does.
  let fallback: Record<string, unknown> | undefined;
  for (const candidate of candidates) {
    const obj = tryParse(candidate);
    if (!obj) continue;
    if (typeof obj.status === 'string') return obj;
    fallback ??= obj;
  }
  return fallback;
}

function detectPendingApproval(
  result: unknown,
): { pendingActionId: string; raw: Record<string, unknown> } | undefined {
  const obj = parseResultEnvelope(result);
  if (!obj) return undefined;
  const id = obj.pendingActionId;
  if (obj.status === 'pending_approval' && typeof id === 'string' && id.length > 0) {
    return { pendingActionId: id, raw: obj };
  }
  return undefined;
}

/**
 * Best-effort detector for the framework's ADR-0033 draft envelopes. Metadata
 * authoring tools stage changes as DRAFTS and return one of:
 *   • single — `{ status:'drafted', type, name, summary, changedKeys }`
 *     (create_object / add_field / create_metadata / update_metadata / …)
 *   • batch  — `{ status:'drafted', drafted:[{type,name}], failed, summary }`
 *     (apply_blueprint)
 * We lift the reviewable `{ type, name }` targets so the chat can render a
 * "Review N change(s)" affordance that opens the designer's review/diff.
 * `blueprint_proposed` (propose_blueprint) has no draft yet → not surfaced here.
 */
export interface DraftReview {
  items: Array<{ type: string; name: string }>;
  summary?: string;
  packageId?: string;
  autoPublishable?: boolean;
  failedCount?: number;
  materialized?: boolean;
  verification?: { errors: number; warnings: number };
  /**
   * ADR-0038 L1 — the individual lint findings behind the `verification`
   * counts, so the chat can show WHAT is wrong (not just "N issues"). Each
   * carries an agent-actionable `message`; `fix` is the mechanical hint.
   */
  issues?: Array<{ severity: 'error' | 'warning'; code: string; message: string; fix?: string }>;
  /**
   * Concrete post-build "what's next" steps the assistant returns on a whole-app
   * build (apply_blueprint `nextSteps`), e.g. "replace the sample data",
   * "publish from the status panel". Rendered as a short getting-started
   * checklist under the build summary so the user has an obvious next action
   * instead of a dead end. Lifecycle-neutral (publishing is described via the
   * status panel, never asserted as done).
   */
  nextSteps?: string[];
}

export function detectDraftResult(result: unknown): DraftReview | undefined {
  const obj = parseResultEnvelope(result);
  if (!obj || obj.status !== 'drafted') return undefined;
  const items: Array<{ type: string; name: string }> = [];
  if (Array.isArray(obj.drafted)) {
    for (const d of obj.drafted) {
      if (d && typeof d === 'object') {
        const { type, name } = d as Record<string, unknown>;
        if (typeof type === 'string' && typeof name === 'string') items.push({ type, name });
      }
    }
  } else if (typeof obj.type === 'string' && typeof obj.name === 'string') {
    items.push({ type: obj.type, name: obj.name });
  }
  if (items.length === 0) return undefined;
  // The owning package (when the staging tool reported it) lets the chat offer
  // a one-click "publish" — POST /packages/:packageId/publish-drafts — so the
  // approval gate is reachable from the conversation, not just a deep link into
  // the designer.
  //
  // `autoPublishable` is the backend's lifecycle intent: whole-app builds
  // (apply_blueprint) set it so the chat can auto-publish the magic moment;
  // incremental edits omit it and stay drafts for explicit review. `failedCount`
  // surfaces partial build failures so the UI never hides them.
  const failedCount = Array.isArray(obj.failed) ? obj.failed.length : 0;
  // ADR-0038 L1 — the build's graph-lint verdict (`verification: {errors,
  // warnings}` on apply_blueprint results). Lifted so the chat can render a
  // verified/issues chip; absent on older tool output → no chip.
  const rawVerification = (obj as { verification?: unknown }).verification;
  const verification =
    rawVerification && typeof rawVerification === 'object' &&
    typeof (rawVerification as { errors?: unknown }).errors === 'number' &&
    typeof (rawVerification as { warnings?: unknown }).warnings === 'number'
      ? {
          errors: (rawVerification as { errors: number }).errors,
          warnings: (rawVerification as { warnings: number }).warnings,
        }
      : undefined;
  // The lint findings themselves (`issues: BuildIssue[]`) ride alongside the
  // counts on the same envelope. Lift the user-facing fields so the chip can
  // expand into "WHAT is wrong" instead of a bare "N issues". Defensive: only
  // well-formed entries with a string message survive.
  const rawIssues = (obj as { issues?: unknown }).issues;
  const issues = Array.isArray(rawIssues)
    ? rawIssues.flatMap((i) => {
        const r = i as { severity?: unknown; code?: unknown; message?: unknown; fix?: unknown };
        if (typeof r?.message !== 'string' || !r.message) return [];
        return [
          {
            severity: r.severity === 'error' ? ('error' as const) : ('warning' as const),
            code: typeof r.code === 'string' ? r.code : 'issue',
            message: r.message,
            ...(typeof r.fix === 'string' && r.fix ? { fix: r.fix } : {}),
          },
        ];
      })
    : [];
  // Post-build "what's next" steps (apply_blueprint `nextSteps: string[]`).
  // Surfaced as a getting-started checklist; only well-formed non-empty strings.
  const rawNextSteps = (obj as { nextSteps?: unknown }).nextSteps;
  const nextSteps = Array.isArray(rawNextSteps)
    ? rawNextSteps.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : [];
  return {
    items,
    summary: typeof obj.summary === 'string' ? obj.summary : undefined,
    ...(typeof obj.packageId === 'string' && obj.packageId ? { packageId: obj.packageId } : {}),
    ...(obj.autoPublishable === true ? { autoPublishable: true } : {}),
    ...(failedCount > 0 ? { failedCount } : {}),
    ...(nextSteps.length ? { nextSteps } : {}),
    // ADR-0045: the build was materialized in-turn (real tables + data, app
    // hidden). The canvas then previews the REAL app URL, not the draft overlay.
    ...(obj.materialized === true ? { materialized: true } : {}),
    ...(verification ? { verification } : {}),
    ...(issues.length ? { issues } : {}),
  };
}

/** snake/kebab artifact name → human title, e.g. `expense_tracker` → `Expense Tracker`. */
function humanizeArtifactName(name: string): string {
  return name
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Synthesize a COMPLETED build-progress summary from a persisted apply_blueprint
 * draft envelope. The live "build tree" (`buildProgress`) is driven by transient
 * `data-build-progress` stream parts that are never persisted — so a reloaded
 * conversation loses the "Built X" panel (ADR-0037/0045). On hydration we
 * reconstruct the done-state from the draft result, which IS persisted, so the
 * summary + its preview/open affordances survive a refresh. Only whole-app
 * builds (a draft set that includes an `app`) get a panel — incremental edits
 * keep their draft card but no build tree, matching the live behaviour.
 */
export function buildProgressFromDraftReview(
  draft: DraftReview | undefined,
): ChatBuildProgress | undefined {
  if (!draft || !Array.isArray(draft.items) || draft.items.length === 0) return undefined;
  const app = draft.items.find((it) => it.type === 'app');
  if (!app) return undefined;
  return {
    phase: 'done',
    appLabel: humanizeArtifactName(app.name),
    items: draft.items,
    done: draft.items.length,
    total: draft.items.length,
  };
}

function extractToolInvocations(
  parts: AnyPart[],
  opts: { liveTail?: boolean } = {},
): ChatToolInvocation[] {
  return parts
    .filter((p) => {
      if (p.type === 'dynamic-tool') return true;
      return typeof p.type === 'string' && p.type.startsWith('tool-');
    })
    .map((p) => {
      const toolName =
        p.type === 'dynamic-tool'
          ? (p.toolName ?? 'tool')
          : typeof p.type === 'string'
            ? p.type.replace(/^tool-/, '')
            : 'tool';
      const result = p.output ?? p.result;
      const pending = detectPendingApproval(result);
      const draftReview = detectDraftResult(result);
      // Promote a dangling `input-*` state to a terminal one so a reloaded
      // conversation never shows "Running" forever (the server doesn't always
      // snapshot the terminal tool state). Two cases:
      //   1. output present → the call finished → Completed.
      //   2. NOT the live streaming tail → the turn that drove this tool has
      //      ENDED, so it cannot still be running, output-snapshot or not.
      // Only the actively-streaming trailing assistant message (`liveTail`)
      // may legitimately keep a tool spinning; everything else is history.
      const persistedState = p.state;
      const isDanglingInput =
        persistedState === 'input-available' || persistedState === 'input-streaming';
      const baseState: ChatToolInvocation['state'] =
        isDanglingInput && (result !== undefined || !opts.liveTail)
          ? 'output-available'
          : persistedState;
      // Promote pending HITL results to `approval-requested` so the UI
      // unlocks the inline approve/reject buttons. Once the operator
      // decides, `useHitlInChat` flips `state` back via the per-call
      // override map and we render the normal output instead.
      const state: ChatToolInvocation['state'] =
        pending && baseState !== 'output-error' ? 'approval-requested' : baseState;
      return {
        toolCallId:
          p.toolCallId ?? p.id ?? `${p.type ?? 'tool'}-${Math.random().toString(36).slice(2, 8)}`,
        toolName,
        args: p.input ?? p.args,
        result,
        errorText: p.errorText,
        state,
        pendingActionId: pending?.pendingActionId,
        draftReview,
      } satisfies ChatToolInvocation;
    });
}

function extractSources(parts: AnyPart[]): ChatSource[] | undefined {
  const sources = parts
    .filter((p) => p.type === 'source-url' || p.type === 'source')
    .map<ChatSource>((p) => ({
      id: p.id,
      title: p.title,
      url: (p.url ?? p.href) as string,
    }))
    .filter((s) => Boolean(s.url));
  return sources.length > 0 ? sources : undefined;
}

/**
 * Lift the live build progress from the stream's reconciled `data-build-progress`
 * part (emitted by apply_blueprint via `ctx.onProgress`). With a stable id the
 * SDK keeps a single, in-place-updated part, so we just read the latest one.
 */
function extractBuildProgress(parts: AnyPart[]): ChatBuildProgress | undefined {
  const part = parts.filter((p) => p.type === 'data-build-progress').pop();
  const data = part?.data;
  if (!data || typeof data !== 'object') return undefined;
  const d = data as Record<string, unknown>;
  const items = Array.isArray(d.items)
    ? (d.items as Array<Record<string, unknown>>)
        .filter((i) => typeof i?.type === 'string' && typeof i?.name === 'string')
        .map((i) => ({ type: i.type as string, name: i.name as string }))
    : [];
  const phase = d.phase === 'data' || d.phase === 'done' ? d.phase : 'structure';
  return {
    phase,
    ...(typeof d.appLabel === 'string' ? { appLabel: d.appLabel } : {}),
    items,
    done: typeof d.done === 'number' ? d.done : items.length,
    total: typeof d.total === 'number' ? d.total : items.length,
    // Monotonic emit counter — advances even on keep-alive heartbeats (identical
    // content), so the build panel can keep its liveness "live" during long
    // quiet seed-generation awaits. Absent on older runtimes.
    ...(typeof d.seq === 'number' ? { seq: d.seq } : {}),
  };
}

/**
 * Lift charts from the stream's `data-chart` parts (emitted by the
 * `visualize_data` tool via `ctx.onProgress`). Unlike `data-build-progress`
 * (one reconciled part), each chart is emitted with its OWN id, so a single
 * answer may carry several — we keep them all, in arrival order. Each part's
 * `data` already matches the SDUI `<chart>` schema; we defensively narrow it
 * so a malformed payload is dropped rather than rendered broken.
 */
function extractCharts(parts: AnyPart[]): ChatChart[] | undefined {
  const charts: ChatChart[] = [];
  for (const p of parts) {
    if (p.type !== 'data-chart') continue;
    const d = p.data;
    if (!d || typeof d !== 'object') continue;
    const c = d as Record<string, unknown>;
    const data = Array.isArray(c.data) ? (c.data as Array<Record<string, unknown>>) : [];
    const series = Array.isArray(c.series)
      ? (c.series as Array<Record<string, unknown>>)
          .filter((s) => s && typeof s.dataKey === 'string')
          .map((s) => ({
            dataKey: s.dataKey as string,
            ...(typeof s.label === 'string' ? { label: s.label } : {}),
          }))
      : [];
    // A chart with no series is unrenderable — skip it.
    if (series.length === 0) continue;
    charts.push({
      ...(typeof c.chartType === 'string' ? { chartType: c.chartType as ChatChart['chartType'] } : {}),
      ...(typeof c.title === 'string' ? { title: c.title } : {}),
      data,
      ...(typeof c.xAxisKey === 'string' ? { xAxisKey: c.xAxisKey } : {}),
      series,
    });
  }
  return charts.length > 0 ? charts : undefined;
}

/**
 * Map a single Vercel AI SDK v6 `UIMessage` to the `ChatMessage` shape that
 * `<ChatbotEnhanced>` renders.
 *
 * @param msg - AI SDK `UIMessage` (or compatible shape with `parts`).
 * @param opts - Optional flags. `streaming` flags the latest assistant
 *   message during an in-flight stream so the cursor pulse renders.
 */
export function uiMessageToChatMessage(
  msg: AnyUIMessage,
  opts: { streaming?: boolean } = {},
): ChatMessage {
  const parts = Array.isArray(msg.parts) ? msg.parts : [];
  // Only the live streaming tail may keep tools in a "Running" state; for any
  // other (historical) message a dangling tool state is stale by definition.
  const tools = extractToolInvocations(parts, { liveTail: opts.streaming });
  const legacyTools = Array.isArray(msg.toolInvocations) ? msg.toolInvocations : [];
  const resolvedTools = tools.length > 0 ? tools : legacyTools;
  // The live `data-build-progress` parts are transient (never persisted), so a
  // reloaded whole-app build loses its "Built X" panel. Fall back to a summary
  // synthesized from the apply_blueprint draft envelope — which IS persisted on
  // the tool result — so the panel + its open/preview affordances survive a
  // refresh. Re-derived on every map (incl. useObjectChat's round-trip), so it
  // cannot be lost the way a one-shot hydration value would.
  const buildProgress =
    extractBuildProgress(parts) ??
    resolvedTools
      .map((tool) => buildProgressFromDraftReview(tool.draftReview))
      .find((bp): bp is ChatBuildProgress => Boolean(bp));
  return {
    id: (msg.id ?? `msg-${Math.random().toString(36).slice(2, 8)}`) as string,
    role: (msg.role ?? 'assistant') as ChatMessage['role'],
    content: extractText(msg, parts),
    reasoning: extractReasoning(parts),
    toolInvocations: resolvedTools,
    sources: extractSources(parts),
    buildProgress,
    charts: extractCharts(parts),
    streaming: opts.streaming,
  };
}

/**
 * Map an array of `UIMessage`s. The trailing assistant message gets the
 * `streaming` flag when `isStreaming` is true (mirrors `useObjectChat`).
 */
export function uiMessagesToChatMessages(
  messages: AnyUIMessage[],
  opts: { isStreaming?: boolean } = {},
): ChatMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  const lastIdx = messages.length - 1;
  return messages.map((m, idx) =>
    uiMessageToChatMessage(m, {
      streaming:
        Boolean(opts.isStreaming) && idx === lastIdx && m.role === 'assistant',
    }),
  );
}

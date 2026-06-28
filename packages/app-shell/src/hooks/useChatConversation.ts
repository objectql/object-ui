// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Server-backed AI chat conversation lifecycle.
 *
 * Binds a chat UI to an `ai_conversations` row owned by the signed-in user.
 * On mount it tries the cached id (per user, optionally per scope); falls
 * back to creating a fresh conversation when the cached one is gone
 * (404/403).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** Minimal UIMessage shape compatible with `@ai-sdk/react`'s `useChat`. */
export interface HydratedUIMessagePart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface HydratedUIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: HydratedUIMessagePart[];
}

export interface UseChatConversationOptions {
  /** Authenticated user id; hook is inert until this is defined. */
  userId: string | undefined;
  /**
   * Optional scope (e.g. agent name) for keying separate conversations under
   * the same user.
   */
  scope?: string;
  /**
   * Base URL of the AI service (no trailing slash). Hook calls
   * `${apiBase}/conversations[/...]`. Required.
   */
  apiBase: string;
  /**
   * Explicit conversation id to hydrate. When provided the cache is bypassed
   * and the hook fetches this conversation directly; falls back to creating a
   * fresh one if the server returns 404/403. When omitted the hook keeps its
   * original cache-first / create-on-miss behaviour.
   */
  activeId?: string;
  /**
   * Explicit "start a NEW conversation" intent (the sidebar's New button,
   * `/ai?new=1`). Without it a bare `/ai` visit resumes the last cached
   * conversation — which is right for a plain visit but made the New button a
   * no-op: the resolved-once guard kept the current id and the URL-mirroring
   * effect immediately rewrote `/ai` back to `/ai/:currentId`. When true (and
   * no `activeId`), the cache and the guard are skipped and a fresh
   * conversation is created. Ignored while `activeId` is set.
   */
  forceNew?: boolean;
  /**
   * How a plain visit (no `activeId`, no `forceNew`) treats the cached
   * conversation:
   *   - `'resume'` (default): re-open the last conversation. Right for the full
   *     `/ai` page and the stateful BUILD surface, where losing an in-progress
   *     build (staged drafts, the awaiting-confirm plan) is harmful.
   *   - `'fresh'`: open a clean thread instead. Used by the floating assistant's
   *     ASK/data surface, where each open should feel new. To avoid littering
   *     the history (the list endpoint keeps empty rows — there's no prune), an
   *     UNTOUCHED (zero-message) cached conversation is REUSED rather than
   *     re-created; a cached conversation that the user actually used is left in
   *     history and a fresh one is minted.
   * Ignored when `activeId` or `forceNew` is set.
   */
  resumeMode?: 'resume' | 'fresh';
}

export interface UseChatConversationReturn {
  conversationId: string | undefined;
  /**
   * The `scope` (agent) the current `conversationId` was resolved under. Lets a
   * host distinguish "this id belongs to the active agent" from "this id is the
   * PREVIOUS agent's, pending re-resolution after a switch" — so it doesn't
   * mirror a stale id onto the new agent's URL.
   */
  conversationScope: string | undefined;
  initialMessages: HydratedUIMessage[];
  isLoading: boolean;
  /** Delete the current conversation + start a fresh one. */
  reset: () => Promise<void>;
  /**
   * Start a NEW conversation WITHOUT deleting the current one (the floating
   * assistant's "New chat" button). Mints a fresh row and switches to it; the
   * prior thread stays in history (reachable from the `/ai` sidebar). Contrast
   * with {@link reset}, which deletes the current conversation first.
   */
  startNew: () => Promise<void>;
}

/**
 * The subset of plugin-chatbot's `DraftReview` (mapMessages.ts) that the chat's
 * draft/publish + ADR-0038 verification cards are derived from. Mirrored here —
 * rather than imported — to keep this low-level hook free of a `@object-ui/
 * plugin-chatbot` dependency; the round-trip test in
 * `useChatConversation.test.tsx` runs these through the REAL detectors, so any
 * incompatible drift fails CI.
 */
interface CachedDraftReview {
  items: Array<{ type: string; name: string }>;
  summary?: string;
  packageId?: string;
  autoPublishable?: boolean;
  failedCount?: number;
  materialized?: boolean;
  verification?: { errors: number; warnings: number };
  issues?: Array<{ severity: 'error' | 'warning'; code: string; message: string; fix?: string }>;
  nextSteps?: string[];
}

/** Mirrors the subset of plugin-chatbot's `ProposedPlan` the "Proposed plan" card needs. */
interface CachedProposedPlan {
  summary?: string;
  objects: Array<{ name: string; label?: string; fieldCount: number }>;
  counts: { objects: number; views: number; dashboards: number; seedData: number };
  questions: string[];
  assumptions: string[];
  targetApp?: string;
}

interface CacheableChatToolInvocation {
  toolCallId: string;
  toolName: string;
  state?: string;
  errorText?: string;
  /**
   * The detect-relevant shapes the live render already derived from the tool
   * result (`uiMessageToChatMessage`). Present on assistant tool invocations
   * that staged a draft (`apply_blueprint` …) or proposed a plan
   * (`propose_blueprint`). We re-serialize these into a COMPACT tool `output`
   * so the cards survive a cache-fallback reload — see
   * `sanitizeChatMessagesForCache`.
   */
  draftReview?: CachedDraftReview;
  proposedPlan?: CachedProposedPlan;
}

interface CacheableChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content?: string;
  toolInvocations?: CacheableChatToolInvocation[];
}

/**
 * Rebuild the MINIMAL `{ status:'drafted', … }` envelope that
 * `mapMessages.detectDraftResult` re-parses, from the already-derived
 * `DraftReview`. Inverse of the detector: we keep only the fields it reads, so
 * the draft "Review N changes / Publish" card and the ADR-0038 verification
 * chip survive without re-storing the (potentially large) blueprint JSON.
 * `failed` is materialized to the right length because the detector counts
 * `failed.length`.
 */
function draftReviewToCachedResult(dr: CachedDraftReview): Record<string, unknown> {
  return {
    status: 'drafted',
    drafted: dr.items,
    ...(dr.summary ? { summary: dr.summary } : {}),
    ...(dr.packageId ? { packageId: dr.packageId } : {}),
    ...(dr.autoPublishable ? { autoPublishable: true } : {}),
    ...(dr.failedCount ? { failed: Array.from({ length: dr.failedCount }, () => null) } : {}),
    ...(dr.materialized ? { materialized: true } : {}),
    ...(dr.verification ? { verification: dr.verification } : {}),
    ...(dr.issues && dr.issues.length ? { issues: dr.issues } : {}),
    ...(dr.nextSteps && dr.nextSteps.length ? { nextSteps: dr.nextSteps } : {}),
  };
}

/**
 * Rebuild the MINIMAL `{ status:'blueprint_proposed', … }` envelope that
 * `mapMessages.detectProposedPlan` re-parses, from the already-derived
 * `ProposedPlan`. Object `fields` are materialized to the right length because
 * the detector reads `fields.length` as the per-object field count — the field
 * definitions themselves are dropped (the lean win).
 */
function proposedPlanToCachedResult(pp: CachedProposedPlan): Record<string, unknown> {
  return {
    status: 'blueprint_proposed',
    ...(pp.summary ? { summary: pp.summary } : {}),
    counts: pp.counts,
    questions: pp.questions,
    ...(pp.targetApp ? { targetApp: pp.targetApp } : {}),
    blueprint: {
      objects: pp.objects.map((o) => ({
        name: o.name,
        ...(o.label ? { label: o.label } : {}),
        fields: Array.from({ length: o.fieldCount }, () => null),
      })),
      assumptions: pp.assumptions,
    },
  };
}

const CACHE_PREFIX = 'objectstack:ai-chat-conversation-id';
const MESSAGE_CACHE_PREFIX = 'objectstack:ai-chat-messages';

function cacheKey(userId: string, scope?: string): string {
  return scope ? `${CACHE_PREFIX}:${userId}:${scope}` : `${CACHE_PREFIX}:${userId}`;
}

function readCache(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeCache(key: string, value: string | undefined): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* ignore — private mode, quota, etc. */
  }
}

function messageCacheKey(conversationId: string): string {
  return `${MESSAGE_CACHE_PREFIX}:${conversationId}`;
}

function readMessageCache(conversationId: string): HydratedUIMessage[] {
  try {
    const raw = localStorage.getItem(messageCacheKey(conversationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((msg): msg is HydratedUIMessage => {
      return (
        Boolean(msg) &&
        typeof msg === 'object' &&
        typeof (msg as { id?: unknown }).id === 'string' &&
        ((msg as { role?: unknown }).role === 'user' ||
          (msg as { role?: unknown }).role === 'assistant' ||
          (msg as { role?: unknown }).role === 'system') &&
        Array.isArray((msg as { parts?: unknown }).parts)
      );
    });
  } catch {
    return [];
  }
}

export function writeConversationMessagesCache(
  conversationId: string | undefined,
  messages: HydratedUIMessage[],
): void {
  if (!conversationId) return;
  try {
    if (messages.length === 0) {
      localStorage.removeItem(messageCacheKey(conversationId));
      return;
    }
    localStorage.setItem(messageCacheKey(conversationId), JSON.stringify(messages));
  } catch {
    /* ignore — private mode, quota, etc. */
  }
}

export function sanitizeChatMessagesForCache(
  messages: CacheableChatMessage[],
): HydratedUIMessage[] {
  return messages
    .map<HydratedUIMessage | undefined>((message) => {
      const parts: HydratedUIMessagePart[] = [];
      if (message.content) {
        parts.push({ type: 'text', text: message.content });
      }
      if (message.role === 'assistant') {
        for (const tool of message.toolInvocations ?? []) {
          // Re-serialize the draft/plan affordance into a compact tool `output`.
          // Without it, a cache-fallback reload (server returns no messages →
          // `readMessageCache`) drops the draft "Review N changes / Publish"
          // card, the ADR-0038 verification chip, and the "Proposed plan" card,
          // because `mapMessages.detect*` read the result `output` that the
          // earlier cache shape never kept. `output` (not a custom part field)
          // is used because the AI SDK preserves it through `useChat` init,
          // exactly as the server-backed tool-result merge relies on.
          const cachedOutput = tool.draftReview
            ? draftReviewToCachedResult(tool.draftReview)
            : tool.proposedPlan
              ? proposedPlanToCachedResult(tool.proposedPlan)
              : undefined;
          parts.push({
            type: `tool-${tool.toolName}`,
            toolCallId: tool.toolCallId,
            toolName: tool.toolName,
            state: tool.state ?? (tool.errorText ? 'output-error' : 'output-available'),
            ...(tool.errorText ? { errorText: tool.errorText } : {}),
            ...(cachedOutput !== undefined ? { output: cachedOutput } : {}),
          });
        }
      }
      if (parts.length === 0) return undefined;
      return {
        id: message.id,
        role: message.role,
        parts,
      };
    })
    .filter((message): message is HydratedUIMessage => Boolean(message));
}

interface ServerMessage {
  id?: string;
  role: string;
  content: unknown;
}

interface ServerConversation {
  id: string;
  messages?: ServerMessage[];
}

function contentToParts(content: unknown): HydratedUIMessagePart[] {
  if (typeof content === 'string') {
    return content ? [{ type: 'text', text: content }] : [];
  }
  if (Array.isArray(content)) {
    return content
      .map<HydratedUIMessagePart | undefined>((part) => {
        if (typeof part === 'string') {
          return part ? { type: 'text', text: part } : undefined;
        }
        if (
          part &&
          typeof part === 'object' &&
          'type' in part &&
          typeof (part as { type?: unknown }).type === 'string'
        ) {
          return part as HydratedUIMessagePart;
        }
        if (
          part &&
          typeof part === 'object' &&
          'text' in part &&
          typeof (part as { text?: unknown }).text === 'string'
        ) {
          return { type: 'text', text: (part as { text: string }).text };
        }
        return undefined;
      })
      .filter((part): part is HydratedUIMessagePart => Boolean(part));
  }
  if (
    content &&
    typeof content === 'object' &&
    'parts' in content &&
    Array.isArray((content as { parts?: unknown }).parts)
  ) {
    return contentToParts((content as { parts: unknown[] }).parts);
  }
  return [];
}

/**
 * Merge a `tool`-role message's tool-result outputs back onto the assistant
 * tool-call parts that requested them. The server persists conversations in
 * ModelMessage format, where a tool CALL (assistant message) and its RESULT (a
 * separate `tool` row) live in different messages. The chat UI needs the output
 * ON the call part so `detectDraftResult` can rebuild the publish/preview
 * affordances after a reload — otherwise the result, and the whole `tool` row
 * (which the UI never renders directly), is dropped and the build card + publish
 * button vanish on refresh.
 */
function mergeToolResultsInto(
  content: unknown,
  byCallId: Map<string, HydratedUIMessagePart>,
): void {
  for (const part of contentToParts(content)) {
    const callId = typeof part.toolCallId === 'string' ? part.toolCallId : undefined;
    if (!callId) continue;
    const target = byCallId.get(callId);
    if (!target) continue;
    const output =
      (part as { output?: unknown }).output ?? (part as { result?: unknown }).result;
    if (output === undefined) continue;
    target.output = output;
    const errorText = (part as { errorText?: unknown }).errorText;
    const isError = Boolean((part as { isError?: unknown }).isError) || typeof errorText === 'string';
    target.state = isError ? 'output-error' : 'output-available';
    if (typeof errorText === 'string') target.errorText = errorText;
  }
}

export function toUIMessages(rows: ServerMessage[] | undefined): HydratedUIMessage[] {
  if (!rows) return [];
  const out: HydratedUIMessage[] = [];
  // Index assistant tool-call parts by id so a later `tool`-role result row can
  // merge its output onto the matching call (see mergeToolResultsInto).
  const toolPartByCallId = new Map<string, HydratedUIMessagePart>();
  rows.forEach((row, idx) => {
    const role = row.role as HydratedUIMessage['role'] | 'tool';
    if (role === 'tool') {
      mergeToolResultsInto(row.content, toolPartByCallId);
      return;
    }
    if (role !== 'user' && role !== 'assistant' && role !== 'system') return;
    const parts = contentToParts(row.content);
    if (parts.length === 0) return;
    if (role === 'assistant') {
      for (const part of parts) {
        // ModelMessage format persists an assistant tool CALL as the literal
        // `type:'tool-call'` with the real tool in `toolName`. Left as-is, the
        // chat humanizes the step title to "Call" (and downstream toolName
        // extraction yields "call"). Remap to the AI SDK UI part type
        // `tool-<toolName>` so the step reads "Apply blueprint" / "Propose
        // blueprint" after a clean server-backed reload; the result-merge below
        // and `detect*` are unaffected (they key off toolCallId / output).
        if (part.type === 'tool-call' && typeof part.toolName === 'string' && part.toolName) {
          part.type = `tool-${part.toolName}`;
        }
        const callId = typeof part.toolCallId === 'string' ? part.toolCallId : undefined;
        if (callId && (part.type === 'tool-call' || part.type.startsWith('tool-'))) {
          toolPartByCallId.set(callId, part);
        }
      }
    }
    out.push({
      id: row.id ?? `msg-${idx}`,
      role,
      parts,
    });
  });
  return out;
}

/**
 * A FLAT `ai_messages` row as returned by the public share endpoint
 * (`GET /api/v1/share-links/:token/messages`), which streams the raw object
 * rows rather than the reconstructed ModelMessage history that the
 * authenticated `GET /conversations/:id` returns.
 */
export interface RawAiMessageRow {
  id?: string;
  role: string;
  /** Persisted text (assistant/user/system) OR a JSON-stringified tool-result array (tool role). */
  content?: unknown;
  /** Assistant tool CALLS, JSON-stringified (`tool-call` parts). */
  tool_calls?: string | null;
  /** Tool RESULT's owning call id (legacy plain-string tool rows). */
  tool_call_id?: string | null;
}

function safeParseArray(value: unknown): Array<Record<string, unknown>> | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reconstruct the ModelMessage-shaped `content` that {@link toUIMessages}
 * expects from the FLAT columns the public share endpoint returns raw.
 *
 * The authenticated path gets this reconstruction server-side
 * (`ObjqlConversationService.toMessage`): an assistant turn's tool CALLS live
 * in the separate `tool_calls` column, and a `tool` row's RESULTS are a
 * JSON-stringified array in `content`. The share endpoint skips that step and
 * dumps the rows verbatim — so the shared transcript previously rendered the
 * raw `{"type":"tool-result",…}` envelope as text instead of a card. Mirroring
 * `toMessage` here lets the share page reuse the exact same hydrate → render
 * pipeline as the live chat. Keep this in lockstep with `toMessage`.
 */
export function aiMessageRowsToServerMessages(rows: RawAiMessageRow[] | undefined): ServerMessage[] {
  if (!rows) return [];
  return rows.map((row) => {
    const id = row.id;
    const text = typeof row.content === 'string' ? row.content : '';
    if (row.role === 'assistant') {
      const toolCalls = safeParseArray(row.tool_calls);
      if (toolCalls && toolCalls.length > 0) {
        const content: Array<Record<string, unknown>> = [];
        if (text) content.push({ type: 'text', text });
        content.push(...toolCalls);
        return { id, role: 'assistant', content };
      }
      return { id, role: 'assistant', content: text };
    }
    if (row.role === 'tool') {
      const results = safeParseArray(row.content);
      if (results && results.length > 0 && results[0]?.type === 'tool-result') {
        return { id, role: 'tool', content: results };
      }
      // Back-compat: pre-array tool rows persisted a plain string.
      return {
        id,
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: row.tool_call_id ?? '',
            toolName: 'unknown',
            output: { type: 'text', value: text },
          },
        ],
      };
    }
    return { id, role: row.role, content: text };
  });
}

export async function fetchConversation(apiBase: string, id: string): Promise<ServerConversation | null> {
  const res = await fetch(`${apiBase}/conversations/${encodeURIComponent(id)}`, {
    credentials: 'include',
  });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`GET conversation failed: ${res.status}`);
  return (await res.json()) as ServerConversation;
}

async function createConversation(apiBase: string): Promise<ServerConversation> {
  const res = await fetch(`${apiBase}/conversations`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`POST conversation failed: ${res.status}`);
  return (await res.json()) as ServerConversation;
}

async function deleteConversation(apiBase: string, id: string): Promise<void> {
  await fetch(`${apiBase}/conversations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  }).catch(() => {
    /* best-effort */
  });
}

export function useChatConversation(
  options: UseChatConversationOptions,
): UseChatConversationReturn {
  const { userId, scope, apiBase, activeId, forceNew, resumeMode = 'resume' } = options;
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [initialMessages, setInitialMessages] = useState<HydratedUIMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(userId));
  const mountedRef = useRef(true);
  // Tracks the (user, scope) we have already resolved a no-activeId
  // conversation for. Keyed by SCOPE as well as user so a deliberate agent
  // switch (the `/ai/:agent` launcher changes `scope`) re-resolves under the
  // new agent's cache instead of clinging to the previous agent's conversation,
  // while a no-op re-render under the same scope still short-circuits.
  const resolvedForUserRef = useRef<string | undefined>(undefined);
  const resolvedScopeRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setConversationId(undefined);
      setInitialMessages([]);
      setIsLoading(false);
      resolvedForUserRef.current = undefined;
      resolvedScopeRef.current = undefined;
      return;
    }
    // Already resolved a conversation for this (user, scope) during the
    // no-activeId window — don't re-create just because an unrelated dep
    // changed. A `forceNew` intent or a scope (agent) change overrides it.
    const scopeChanged = resolvedScopeRef.current !== scope;
    if (
      !activeId &&
      !forceNew &&
      !scopeChanged &&
      resolvedForUserRef.current === userId &&
      conversationId
    ) {
      return;
    }
    let cancelled = false;
    const key = cacheKey(userId, scope);
    // Drop the previous id NOW, before the async resolve, for both an explicit
    // new-conversation intent AND an agent switch: the host page mirrors
    // `conversationId` into the URL the moment `activeId` is empty, so a stale
    // id left in state would be written onto the new agent's URL (`/ai/:agent`)
    // and then resumed as that agent's conversation.
    if (!activeId && (forceNew || (scopeChanged && resolvedForUserRef.current === userId))) {
      setConversationId(undefined);
      setInitialMessages([]);
    }
    setIsLoading(true);

    (async () => {
      try {
        if (activeId) {
          const existing = await fetchConversation(apiBase, activeId);
          if (cancelled) return;
          if (existing) {
            writeCache(key, existing.id);
            setConversationId(existing.id);
            const messages = toUIMessages(existing.messages);
            setInitialMessages(messages.length > 0 ? messages : readMessageCache(existing.id));
            resolvedForUserRef.current = userId;
            resolvedScopeRef.current = scope;
            return;
          }
          // Requested id is gone — fall through to create a fresh one.
          writeCache(key, undefined);
          writeConversationMessagesCache(activeId, []);
        } else if (!forceNew) {
          const cached = readCache(key);
          if (cached) {
            const existing = await fetchConversation(apiBase, cached);
            if (cancelled) return;
            if (existing) {
              const messages = toUIMessages(existing.messages);
              // 'fresh' (the floating ASK surface): only reuse the cached
              // conversation while it's untouched — once the user has actually
              // used it, start a clean thread instead so opening the assistant
              // feels new. Reusing an empty conversation (rather than minting
              // another) keeps repeated opens from littering the history with
              // empty rows. 'resume' (default) re-opens the prior thread.
              const reuse = resumeMode !== 'fresh' || messages.length === 0;
              if (reuse) {
                setConversationId(existing.id);
                setInitialMessages(
                  resumeMode === 'fresh'
                    ? []
                    : messages.length > 0
                      ? messages
                      : readMessageCache(existing.id),
                );
                resolvedForUserRef.current = userId;
                resolvedScopeRef.current = scope;
                return;
              }
              // 'fresh' + a used conversation: fall through to create a fresh
              // one; the used thread stays in history (writeCache below repoints
              // the cache to the new conversation).
            } else {
              writeCache(key, undefined);
              writeConversationMessagesCache(cached, []);
            }
          }
        }
        const fresh = await createConversation(apiBase);
        if (cancelled) return;
        writeCache(key, fresh.id);
        setConversationId(fresh.id);
        setInitialMessages(toUIMessages(fresh.messages));
        resolvedForUserRef.current = userId;
        resolvedScopeRef.current = scope;
      } catch {
        if (!cancelled) {
          setConversationId(undefined);
          setInitialMessages([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `conversationId` intentionally omitted: it's only read inside the
    // short-circuit guard, which is governed by the ref. Including it would
    // re-run the effect after we successfully resolved an id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, scope, apiBase, activeId, forceNew, resumeMode]);

  const reset = useCallback(async () => {
    if (!userId) return;
    const key = cacheKey(userId, scope);
    setIsLoading(true);
    try {
      if (conversationId) await deleteConversation(apiBase, conversationId);
      writeConversationMessagesCache(conversationId, []);
      writeCache(key, undefined);
      const fresh = await createConversation(apiBase);
      writeCache(key, fresh.id);
      writeConversationMessagesCache(fresh.id, []);
      if (!mountedRef.current) return;
      setConversationId(fresh.id);
      setInitialMessages([]);
    } catch {
      if (mountedRef.current) {
        setConversationId(undefined);
        setInitialMessages([]);
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [conversationId, userId, scope, apiBase]);

  const startNew = useCallback(async () => {
    if (!userId) return;
    const key = cacheKey(userId, scope);
    setIsLoading(true);
    try {
      // Mint a fresh conversation and switch to it. The current conversation is
      // intentionally NOT deleted — it stays in history (reachable from the
      // `/ai` sidebar), unlike reset(). The remount keyed on `conversationId`
      // in the host clears the visible thread.
      const fresh = await createConversation(apiBase);
      writeCache(key, fresh.id);
      writeConversationMessagesCache(fresh.id, []);
      if (!mountedRef.current) return;
      setConversationId(fresh.id);
      setInitialMessages([]);
      resolvedForUserRef.current = userId;
      resolvedScopeRef.current = scope;
    } catch {
      // Keep the current conversation on failure — better than dropping the
      // user into a broken empty state.
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [userId, scope, apiBase]);

  // `resolvedScopeRef` is updated in lockstep with every `setConversationId`
  // (same async tick), so at render time it always describes the scope the
  // current `conversationId` was resolved under.
  return { conversationId, conversationScope: resolvedScopeRef.current, initialMessages, isLoading, reset, startNew };
}

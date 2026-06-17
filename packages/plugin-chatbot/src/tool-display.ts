/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Display helpers shared by the tool-invocation card UI. Backend AI tools
 * (notably the framework's MCP-style data/metadata tools) wrap their output
 * in `{ type: 'text', value: '<json-string>' }`. Rendering that envelope
 * naively produces an unreadable, doubly-escaped wall of JSON. These helpers
 * peel the envelope, parse the inner JSON when possible, and produce a
 * human-friendly title for snake_case tool names.
 */

const HUMAN_WORDS: Record<string, string> = {
  ai: 'AI',
  api: 'API',
  crm: 'CRM',
  hitl: 'HITL',
  id: 'ID',
  ids: 'IDs',
  rag: 'RAG',
  sql: 'SQL',
  url: 'URL',
  utc: 'UTC',
};

/**
 * Convert a snake_case / kebab-case tool name into a human-readable title.
 *
 * @example
 *   humanizeToolName('list_objects')        // → 'List objects'
 *   humanizeToolName('query_records')       // → 'Query records'
 *   humanizeToolName('describe-api-tool')   // → 'Describe API tool'
 */
export function humanizeToolName(name: string | undefined | null): string {
  if (!name) return '';
  const trimmed = String(name).trim();
  if (!trimmed) return '';
  const words = trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return trimmed;
  return words
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (HUMAN_WORDS[lower]) return HUMAN_WORDS[lower];
      if (idx === 0) {
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      }
      return lower;
    })
    .join(' ');
}

/**
 * Detect the MCP-style `{ type: 'text', value: '<json|text>' }` envelope used
 * by `@objectstack/service-ai` tool outputs and peel it. When the inner value
 * looks like JSON we parse it so the renderer shows a real object tree
 * instead of `"{\\\"objects\\\":[...]}"`.
 *
 * Non-envelope payloads are returned unchanged.
 */
export function unwrapToolResult(value: unknown): unknown {
  if (value == null) return value;

  // Many backends wrap outputs in an envelope ({type:'text', value: '...'}).
  // Detect and peel one level. Repeat once in case the value was itself a
  // stringified envelope.
  let current: unknown = value;
  for (let depth = 0; depth < 2; depth++) {
    if (
      typeof current === 'object' &&
      current !== null &&
      !Array.isArray(current) &&
      (current as Record<string, unknown>).type === 'text' &&
      typeof (current as Record<string, unknown>).value === 'string'
    ) {
      current = (current as { value: string }).value;
      continue;
    }
    break;
  }

  // If we landed on a string that looks like JSON, parse it. Otherwise leave
  // the string as-is so plain text outputs render correctly.
  if (typeof current === 'string') {
    const trimmed = current.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // Fall through and return the raw string.
      }
    }
  }
  return current;
}

/**
 * Produce a short, headline error string from a possibly-long backend error.
 * The Vercel AI Gateway, in particular, emits multi-sentence messages with
 * doc URLs that overflow the chat error banner. We keep the first sentence
 * (capped to 140 chars) for the headline and expose the full text via the
 * `details` field so callers can render an expandable disclosure.
 */
export function summarizeChatError(err: unknown): {
  summary: string;
  details?: string;
} {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return { summary: 'Something went wrong. Please try again.' };
  }

  // Strip "Failed after N attempts. Last error: " prefix that the AI SDK
  // chat client adds to retried streaming failures.
  const stripped = cleaned.replace(
    /^Failed after \d+ attempts?\.\s*Last error:\s*/i,
    '',
  );

  const headlineSource =
    stripped.match(/^Invalid error response format:\s*(.+)$/i)?.[1]?.trim() ??
    stripped;

  const colonPrefix = headlineSource.match(/^([^:]{8,80}):\s+(.+)$/)?.[1]?.trim();

  // Headline = a human-sized prefix or sentence, otherwise the first 140
  // characters. Avoid preserving a trailing colon as the visible summary.
  const sentence =
    colonPrefix ??
    headlineSource.match(/^([^.;!?]+[.;!?])\s/)?.[1]?.trim() ??
    (headlineSource.length > 140
      ? `${headlineSource.slice(0, 137).trimEnd()}…`
      : headlineSource);

  return {
    summary: sentence.replace(/:$/, ''),
    details: stripped.length > sentence.length ? stripped : undefined,
  };
}

/** AI quota refusal codes emitted by the cloud token guardrail (HTTP 429). */
export type AiQuotaCode =
  | 'ai_design_quota_exhausted'
  | 'ai_data_chat_trial_exhausted'
  | 'ai_allowance_exhausted';

export interface AiQuotaError {
  code: AiQuotaCode;
  /** Localized (zh) message from the backend. */
  message: string;
  /** English message from the backend. */
  messageEn?: string;
  /** Free tier -> upgrade to a paid plan. */
  upgrade: boolean;
  /** Paid tier -> buy a credit top-up pack. */
  topUp: boolean;
}

const AI_QUOTA_CODES = new Set<string>([
  'ai_design_quota_exhausted',
  'ai_data_chat_trial_exhausted',
  'ai_allowance_exhausted',
]);

/**
 * Recognize the cloud AI token guardrail's 429 quota refusals so the chat UI can
 * show a friendly upgrade / top-up CTA instead of a generic "response failed".
 *
 * The ai-sdk chat transport throws a plain Error whose `message` is the response
 * body text (no HTTP status is preserved), so the only signal is the JSON body:
 * strip the same retry/format prefixes summarizeChatError handles, locate the
 * JSON object, and match its `error` code. Returns null for anything else.
 */
export function parseAiQuotaError(err: unknown): AiQuotaError | null {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (!raw) return null;
  const stripped = raw
    .replace(/^Failed after \d+ attempts?\.\s*Last error:\s*/i, '')
    .replace(/^Invalid error response format:\s*/i, '')
    .trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let body: any;
  try {
    body = JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!body || typeof body.error !== 'string' || !AI_QUOTA_CODES.has(body.error)) {
    return null;
  }
  return {
    code: body.error as AiQuotaCode,
    message: typeof body.message === 'string' ? body.message : '',
    messageEn: typeof body.messageEn === 'string' ? body.messageEn : undefined,
    upgrade: body.upgrade === true,
    topUp: body.topUp === true,
  };
}


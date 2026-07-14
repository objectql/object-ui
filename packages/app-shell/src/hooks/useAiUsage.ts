/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * ADR-0057 #8 — the console AI usage indicator's data hook.
 *
 * Fetches `GET {apiBase}/usage` (the cloud runtime's read-only companion to the
 * token guardrail) and exposes the per-meter headroom the ChatDock header renders.
 * The endpoint speaks a D5-SAFE shape — a FRACTION per meter, never a raw token
 * count — so nothing here (or downstream) can leak a token number.
 *
 * Refetch triggers, cheap and event-driven (no busy polling):
 *   - on mount / apiBase change,
 *   - on the `AI_USAGE_REFRESH_EVENT` the chat engine fires after a turn finishes
 *     or a send is rejected (429) — so the ring moves right after the user's action,
 *   - on tab re-focus (catches usage spent in another tab).
 *
 * Fail-soft: any error (endpoint absent on an old backend, network, non-2xx) leaves
 * `usage` null. The indicator treats null as "nothing to show" and renders nothing,
 * so a missing/!deployed endpoint degrades to no widget rather than a broken one.
 */
import * as React from 'react';
import { AI_USAGE_REFRESH_EVENT } from '@object-ui/plugin-chatbot';

export type AiUsageResetKind = 'daily' | 'monthly';
export type AiUsagePlanType = 'free' | 'paid';

/** One meter's D5-safe usage signal (mirrors the cloud endpoint). */
export interface AiMeterUsage {
  planType: AiUsagePlanType;
  /** 0..1 of the binding window's cap, or null when unmetered / unknown. Never tokens. */
  fraction: number | null;
  /** No finite cap (usage-based) — the UI would draw spend, not a ring. */
  unmetered: boolean;
  resetKind: AiUsageResetKind;
  /** Best-effort reset instant (ISO); null when unknown (e.g. monthly cycle anchor). */
  resetsAt: string | null;
  /** Free-tier upgrade CTA applies. */
  upgrade: boolean;
  /** Paid credit-pack top-up CTA applies (monthly window only). */
  topUp: boolean;
}

export interface AiUsageResponse {
  meters: {
    build: AiMeterUsage;
    dataChat: AiMeterUsage;
  };
}

export interface UseAiUsageOptions {
  /** Resolved AI service base (e.g. `/api/v1/ai`). Falsy → the hook is inert. */
  apiBase?: string;
  /** Gate the whole hook (e.g. no AI seat). Default true. */
  enabled?: boolean;
}

export interface UseAiUsageReturn {
  usage: AiUsageResponse | null;
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

function isMeter(v: unknown): v is AiMeterUsage {
  return !!v && typeof v === 'object' && 'fraction' in (v as Record<string, unknown>);
}

/** Validate the wire payload just enough to trust the two meters exist. */
function parseUsage(payload: unknown): AiUsageResponse | null {
  const meters = (payload as { meters?: unknown })?.meters as
    | { build?: unknown; dataChat?: unknown }
    | undefined;
  if (!meters || !isMeter(meters.build) || !isMeter(meters.dataChat)) return null;
  return { meters: { build: meters.build, dataChat: meters.dataChat } };
}

/**
 * Load the environment's AI usage headroom for the console indicator. See the file
 * header for the refetch triggers and fail-soft contract.
 */
export function useAiUsage(options: UseAiUsageOptions = {}): UseAiUsageReturn {
  const { apiBase, enabled = true } = options;
  const [usage, setUsage] = React.useState<AiUsageResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | undefined>(undefined);
  const [reloadToken, setReloadToken] = React.useState(0);

  const refetch = React.useCallback(() => setReloadToken((n) => n + 1), []);

  const active = enabled && !!apiBase;

  React.useEffect(() => {
    if (!active) {
      setUsage(null);
      setError(undefined);
      setLoading(false);
      return;
    }
    if (typeof fetch !== 'function') return; // non-browser env → stay inert (fail-soft)
    let cancelled = false;
    const url = `${apiBase!.replace(/\/$/, '')}/usage`;
    setLoading(true);
    fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load AI usage (${res.status})`);
        return res.json();
      })
      .then((payload) => {
        if (cancelled) return;
        setUsage(parseUsage(payload));
        setError(undefined);
      })
      .catch((err) => {
        if (cancelled) return;
        // Fail-soft: keep no data; the indicator hides itself on null usage.
        setUsage(null);
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, apiBase, reloadToken]);

  // Refetch on the chat engine's post-turn / 429 nudge, and on tab re-focus.
  React.useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    const onRefresh = () => refetch();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    window.addEventListener(AI_USAGE_REFRESH_EVENT, onRefresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(AI_USAGE_REFRESH_EVENT, onRefresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, refetch]);

  return { usage, loading, error, refetch };
}

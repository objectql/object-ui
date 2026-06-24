/**
 * useAiSurfaceEnabled
 *
 * Single source of truth for "should the in-UI AI surface be shown on this
 * deployment?". The console ships under MIT and is edition-agnostic: it never
 * knows at build time whether the runtime is a Community Edition (framework
 * only, no cloud AI package) or a full cloud install. It decides purely at
 * runtime from what the server reports — no `VITE_EDITION` flag, no tree-shake.
 *
 * The signal is **a non-empty agent catalog** (`GET /api/v1/ai/agents`), NOT
 * the discovery `services.ai` flag. That distinction matters:
 *
 *   The `ask`/`build` agent *personas* are a commercial feature that moved to
 *   the cloud-only `@objectstack/service-ai-studio` package; the open-source
 *   framework keeps a HEADLESS `@objectstack/service-ai` that still
 *   `registerService('ai')`s. So on a Community Edition runtime discovery can
 *   STILL report `services.ai` as available (the service is running) while the
 *   agent catalog is empty (no persona attached). Gating on `isAiEnabled` would
 *   then leave the FAB / "Ask AI" affordances visible with nothing to talk to —
 *   a dead end. The catalog is the real "is there an agent to answer?" signal,
 *   and it's exactly what the Home "Build/Ask AI" CTAs already gate on, so every
 *   AI entry point now agrees.
 *
 * The `VITE_AI_BASE_URL` opt-in flows through naturally: {@link resolveAiApiBase}
 * points the catalog fetch at the configured server, so an external AI server
 * with agents lights the surface up and an agent-less one keeps it hidden.
 *
 * `isLoading` is surfaced so the `/ai` route guard can wait for the catalog to
 * resolve before redirecting — otherwise a stale bookmark would flash a redirect
 * to home before the fetch even starts. Entry-point buttons (FAB, top-bar link,
 * designer "Ask AI") ignore it: staying hidden during the brief load is the
 * correct, flash-free behaviour for a control that must not appear unless AI can
 * actually answer.
 *
 * @module
 */

import { useRef } from 'react';
import { useAgents } from '@object-ui/plugin-chatbot';

/**
 * Resolve the AI service base URL, mirroring AiChatPage / the Home CTAs:
 * an explicit `VITE_AI_BASE_URL` wins, otherwise `${VITE_SERVER_URL}/api/v1/ai`.
 * Shared so every catalog fetch (route guard, layouts, Home) hits the same URL.
 */
export function resolveAiApiBase(): string {
  const env = (import.meta as any).env ?? {};
  const fromEnv = env.VITE_AI_BASE_URL as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const serverUrl = (env.VITE_SERVER_URL as string | undefined) ?? '';
  return `${serverUrl.replace(/\/$/, '')}/api/v1/ai`;
}

export interface AiSurfaceState {
  /** True when the AI UI should be rendered (the server serves ≥1 agent). */
  enabled: boolean;
  /** True until the agent catalog has resolved; route guards wait on this. */
  isLoading: boolean;
}

/**
 * Whether the console's AI surface (FAB, `/ai` routes, "Ask AI" affordances)
 * should be shown, driven off the live agent catalog.
 */
export function useAiSurfaceEnabled(): AiSurfaceState {
  const { agents, isLoading } = useAgents({ apiBase: resolveAiApiBase() });

  // useAgents starts `isLoading=false` and only kicks off the fetch in an effect
  // a tick later, so the first render's empty list means "not fetched yet", not
  // "no agents". Latch whether a fetch has actually been in flight so the route
  // guard treats that initial frame as loading (not a definitive empty → redirect).
  const fetchStartedRef = useRef(false);
  if (isLoading) fetchStartedRef.current = true;

  const enabled = agents.length > 0;
  return {
    enabled,
    // Agents present → resolved/available. Otherwise we're loading until a fetch
    // has both started and finished with an empty result.
    isLoading: enabled ? false : isLoading || !fetchStartedRef.current,
  };
}

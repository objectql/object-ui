/**
 * useAiSurfaceEnabled
 *
 * Single source of truth for "should the in-UI AI surface be shown on this
 * deployment?". The console ships under MIT and is edition-agnostic: it decides
 * purely at runtime from what the server reports — no `VITE_EDITION` flag, no
 * tree-shake.
 *
 * The signal is whether the **`@objectstack/service-ai` capability is present**,
 * as reported by discovery (`/discovery` → `services.ai.enabled &&
 * status === 'available'`, i.e. `isAiEnabled`).
 *
 * `service-ai` is an ENTERPRISE capability: a Community-Edition runtime does not
 * depend on it, so the framework never registers the AI service and discovery
 * reports `services.ai` unavailable → the whole AI surface hides. An install
 * that ships `service-ai` reports it available → AI shows. It is the presence of
 * the CAPABILITY that gates, NOT whether any specific agent happens to be
 * configured yet (an install with `service-ai` but no agents has AI "available";
 * AiChatPage degrades gracefully if the catalog is empty).
 *
 * The framework only registers the AI service when the host app declares
 * `@objectstack/service-ai`, so discovery's `services.ai` is an honest edition
 * signal (see objectstack-ai/framework#2311). Earlier this hook gated on the
 * agent catalog as a workaround for the headless service reporting itself
 * available in CE; with #2311 that no longer happens, so discovery is correct.
 *
 * `VITE_AI_BASE_URL` is an explicit opt-in: it points the console at an external
 * AI server and is trusted even when local discovery reports AI unavailable.
 *
 * `isLoading` is surfaced so the `/ai` route guard can wait for discovery to
 * resolve before redirecting — otherwise a stale bookmark would flash a redirect
 * to home before the server's answer is in.
 *
 * @module
 */

import { useDiscovery } from '@object-ui/react';

/**
 * Resolve the AI service base URL, mirroring AiChatPage / the Home CTAs:
 * an explicit `VITE_AI_BASE_URL` wins, otherwise `${VITE_SERVER_URL}/api/v1/ai`.
 * Shared so every AI fetch (Home catalog, AiChatPage) hits the same URL.
 */
export function resolveAiApiBase(): string {
  const env = (import.meta as any).env ?? {};
  const fromEnv = env.VITE_AI_BASE_URL as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const serverUrl = (env.VITE_SERVER_URL as string | undefined) ?? '';
  return `${serverUrl.replace(/\/$/, '')}/api/v1/ai`;
}

export interface AiSurfaceState {
  /** True when the AI capability (`service-ai`) is available, so the AI UI shows. */
  enabled: boolean;
  /** True until discovery resolves (and no `VITE_AI_BASE_URL` opt-in); guards wait on this. */
  isLoading: boolean;
}

/**
 * Whether the console's AI surface (FAB, `/ai` routes, "Ask AI" affordances)
 * should be shown — driven off the presence of the `service-ai` capability in
 * discovery.
 */
export function useAiSurfaceEnabled(): AiSurfaceState {
  const { isAiEnabled, isLoading } = useDiscovery();
  // An explicit external-AI opt-in is trusted even if local discovery reports AI
  // unavailable; it's synchronous, so there's nothing to wait for.
  const aiBaseUrlConfigured = Boolean((import.meta as any).env?.VITE_AI_BASE_URL);
  if (aiBaseUrlConfigured) return { enabled: true, isLoading: false };
  return { enabled: isAiEnabled, isLoading };
}

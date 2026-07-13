// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * surfaceAgent — the one declarative surface→agent resolver (ADR-0057 P2).
 *
 * ADR-0063 fixes the agent model: **exactly two products (`ask` / `build`),
 * bound by SURFACE — no roster, no per-turn classifier.** Before this module the
 * console re-implemented that resolution chain in ~5 places, each spelled
 * slightly differently (and `ConsoleLayout` carried a downgrade special case
 * that existed nowhere else). This is the single place the rule lives, so
 * ADR-0063 is a **structural** guarantee: there is no seam to add a roster or a
 * classifier into.
 *
 * The rule, in one function:
 *
 *   1. `app.defaultAgent` may override the surface default, but it is **bounded**
 *      to the two products (ask/build, alias-aware). Anything else — a withdrawn
 *      tenant custom agent — is **rejected** (not silently passed through), so a
 *      roster cannot be smuggled in via app metadata (ADR-0057 open question #4).
 *   2. Otherwise the surface decides: the Studio authoring surface wants `build`;
 *      every other surface wants `ask`.
 *   3. With AI Studio disabled the build agent is unreachable, so a `build` want
 *      degrades to `ask` (the former `ConsoleLayout` special case, folded in ONCE).
 *   4. The chosen product is resolved against the LIVE catalog (alias-aware); if
 *      it isn't served, fall back to the catalog's platform default.
 *
 * Kept pure (no React) so every call site resolves identically and the ADR-0063
 * table is unit-tested without the chat component graph.
 *
 * @module
 */

import {
  isBuildAgent,
  isBuiltinAgentName,
  resolveAgentParam,
  resolveDefaultAgentName,
  type AgentDescriptor,
} from '@object-ui/plugin-chatbot';

/**
 * The surfaces that resolve an agent. `studio-build` is the ADR-0080 Studio
 * authoring surface (the only one that wants `build` by default); every other
 * surface — the console FAB, the full-page `/ai` fallback, a runtime app — is
 * `default` and wants `ask`. Deliberately NOT a per-shell enum: the axis is the
 * product, not the view.
 */
export type ChatSurface = 'studio-build' | 'default';

/** The ADR-0063 product a surface wants before catalog resolution. */
export const SURFACE_DEFAULT: Record<ChatSurface, 'ask' | 'build'> = {
  'studio-build': 'build',
  default: 'ask',
};

export interface ResolveSurfaceAgentInput {
  /** The live agent catalog (`useAgents`) — the single source of truth. */
  agents: AgentDescriptor[];
  /**
   * `app.defaultAgent` from app metadata. Bounded to ask/build (alias-aware);
   * any other value is rejected so no roster is representable.
   */
  appDefaultAgent?: string;
  /**
   * Whether AI Studio (authoring) is enabled for this deployment. When off, a
   * `build` want degrades to `ask`. Defaults to true.
   */
  aiStudioEnabled?: boolean;
}

/**
 * Resolve the concrete agent NAME a surface should bind, per ADR-0063. Returns
 * `undefined` only when the catalog is empty (no agent to talk to → the AI
 * surface is inert; ADR-0025 OSS degradation).
 */
export function resolveSurfaceAgent(
  surface: ChatSurface,
  { agents, appDefaultAgent, aiStudioEnabled = true }: ResolveSurfaceAgentInput,
): string | undefined {
  const catalog = agents.map((a) => a.name);
  // (1) app.defaultAgent bounded to the two products — reject anything else.
  const bounded = isBuiltinAgentName(appDefaultAgent) ? appDefaultAgent : undefined;
  // (2) surface default when no valid override.
  const want = bounded ?? SURFACE_DEFAULT[surface] ?? SURFACE_DEFAULT.default;
  // (3) the ConsoleLayout downgrade, folded in ONCE.
  const eff = !aiStudioEnabled && isBuildAgent(want) ? 'ask' : want;
  // (4) resolve against the live catalog (alias-aware); else platform default.
  return resolveAgentParam(eff, catalog) ?? resolveDefaultAgentName(agents);
}

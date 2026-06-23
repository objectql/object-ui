/**
 * agentPicker
 *
 * Pure decision logic for the floating assistant's Build/Ask switcher. Kept in
 * its own module (no React, no chat deps) so it can be unit-tested without
 * dragging in the heavy chat component graph (FloatingChatbot → streamdown →
 * shiki → @ai-sdk, ~20MB) that `ConsoleFloatingChatbot` pulls in.
 * @module
 */
import { isAskAgent, isBuildAgent, type AgentDescriptor } from '@object-ui/plugin-chatbot';

/** Minimal catalog shape the decision needs — just the agent name. */
type AgentLike = Pick<AgentDescriptor, 'name'>;

export interface AgentPickerDecisionInput {
  /** Live agent catalog from `useAgents` (the single source of truth). */
  agents: AgentLike[];
  /**
   * Explicit host override. When defined it wins outright — `true` forces the
   * switcher on, `false` forces it off — regardless of catalog or env.
   */
  showAgentPickerProp?: boolean;
  /**
   * `VITE_AI_SHOW_AGENT_PICKER === 'true'` — the power-user / admin global
   * escape hatch that forces the switcher on without touching app metadata.
   */
  envOptIn?: boolean;
  /**
   * Whether AI Studio (authoring / "online development") is enabled for this
   * deployment. When off, the build agent must not be reachable from the panel,
   * so the auto-reveal is suppressed even if the catalog still serves `build`.
   * Mirrors `ConsoleLayout`'s `aiStudioEnabled` gate. Defaults to true.
   */
  aiStudioEnabled?: boolean;
}

/**
 * True when the live catalog exposes BOTH a data/query (`ask`) and an authoring
 * (`build`) agent — alias-aware via {@link isAskAgent}/{@link isBuildAgent}, so
 * a catalog still serving the legacy `data_chat`/`metadata_assistant` ids counts
 * too. This is the "AI development is unlocked for this viewer" signal, the same
 * `askAvailable && buildAvailable` notion HomePage uses to surface "Build with AI".
 */
export function isAiDevUnlocked(agents: AgentLike[]): boolean {
  return (
    agents.some((a) => isAskAgent(a.name)) && agents.some((a) => isBuildAgent(a.name))
  );
}

/**
 * Decide whether the floating assistant should reveal its Build/Ask switcher.
 *
 * Restrained by design (the original "end users shouldn't have to choose" rule):
 * a pure end-user surface bound to a single `ask` agent never sees it. Precedence:
 *  1. `showAgentPickerProp` — explicit host override wins (`true`/`false`).
 *  2. `envOptIn` — `VITE_AI_SHOW_AGENT_PICKER` forces it on globally.
 *  3. Auto-reveal — AI development is unlocked ({@link isAiDevUnlocked}) AND
 *     authoring isn't deployment-disabled (`aiStudioEnabled`).
 *
 * Returns the *intent* only: the render site still requires more than one agent
 * (`agents.length > 1`) to draw an actual choice.
 */
export function shouldShowAgentPicker({
  agents,
  showAgentPickerProp,
  envOptIn = false,
  aiStudioEnabled = true,
}: AgentPickerDecisionInput): boolean {
  if (showAgentPickerProp !== undefined) return showAgentPickerProp;
  if (envOptIn) return true;
  return aiStudioEnabled && isAiDevUnlocked(agents);
}

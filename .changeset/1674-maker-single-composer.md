---
'@object-ui/app-shell': minor
---

One composer for makers — the built-in `ask` folds into `build` for authoring
principals (cloud#1674 maker convergence, Phase B).

Ruling: `build` is the higher-privilege admin agent and, since cloud#1673, a
strict data superset of `ask` — it answers records/aggregation/chart questions
with the same tools. So Ask/Build stop being peer modes for a maker:

- `surfaceAgent.ts` (the ONE ADR-0063 resolver) gains rule (3b): an `ask` want
  upgrades to `build` for a principal with `manage_metadata` when the catalog
  serves it — including over an app's explicit `defaultAgent: 'ask'` pin (the
  pin serves the app's business users; the maker always gets the superset).
  New `makerConvergedOnBuild` / `makerVisibleAgents` carry the same predicate
  to the picker sites.
- ChatPane's agent launcher lists `makerVisibleAgents`: the built-in ask leaves
  the list for makers (custom agents stay), computed inside ChatPane so every
  host — full `/ai` page, Studio copilot, console dock — converges identically.
- A maker's bare `/ai/ask` redirects to `/ai/build`; `/ai/ask/:conversationId`
  keeps rendering, so ask history stays readable.
- `ConversationsSidebar` gains `includeAskConversations`: the converged surface
  lists BOTH built-in groups' threads whichever one is open (merging only ask
  made the build history vanish the moment an ask thread was opened — measured
  in-browser on the first pass).
- Console home shows the single Build entry for makers; non-authoring sessions
  (the objectstack#8270 hosted posture) keep Ask AI, and every layer is a no-op
  for them and for deployments without a build agent.
- `useCanAuthorMetadata` extracted from HomePage to `hooks/` so the CTAs and
  the chat surfaces answer the same per-principal question.

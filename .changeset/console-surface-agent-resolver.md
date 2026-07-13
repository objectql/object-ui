---
"@object-ui/app-shell": patch
---

feat(console-ai): one declarative surface→agent resolver (ADR-0057 P2)

The console re-implemented the ADR-0063 surface→agent chain in ~5 places, each
spelled slightly differently — and `ConsoleLayout` carried an AI-Studio-off
downgrade special case that existed nowhere else. This collapses them into one
pure, unit-tested resolver so ADR-0063 (exactly two products `ask`/`build`,
bound by surface — no roster, no per-turn classifier) becomes a **structural**
guarantee.

- New `hooks/surfaceAgent.ts`: `resolveSurfaceAgent(surface, { agents,
  appDefaultAgent, aiStudioEnabled })` + `SURFACE_DEFAULT`. `app.defaultAgent` is
  **bounded** to ask/build (alias-aware) — a withdrawn tenant custom agent is
  rejected, not passed through, so no roster is representable (ADR-0057 open
  question #4). The AI-Studio-off `build → ask` downgrade is folded in ONCE.
- `StudioAiCopilot` (studio-build → build) and the console FAB (`default` → ask)
  resolve through it. The FAB keeps #771's "prefer build when the catalog unlocks
  it and nothing pinned a product" by passing that as its default PRODUCT input —
  so the resolver still owns bounding + the downgrade, which now also applies to
  the #771 preference (closing the leak where an authoring-disabled deployment
  could still open build).
- `ConsoleLayout`'s bespoke `!aiStudioEnabled && isBuildAgent(...)` downgrade is
  deleted; it passes the raw `app.defaultAgent` and the resolver downgrades.

Ships a unit table proving the ADR-0063 rows: Studio→build, other→ask,
AI-Studio-off downgrade, `app.defaultAgent` bounded (valid override wins, roster
rejected), alias-aware catalog resolution, empty catalog → inert (ADR-0025).

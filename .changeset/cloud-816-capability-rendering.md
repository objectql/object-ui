---
"@object-ui/plugin-chatbot": minor
"@object-ui/app-shell": patch
---

feat(console-ai): render agent behavior by declared capability (cloud#816 / ADR-0057 "B+")

`GET /api/v1/ai/agents` now serves per-agent `capabilities`; the console
consumes them instead of hard-coding `isBuildAgent(name)`:

- `@object-ui/plugin-chatbot`: `AgentDescriptor.capabilities` (normalized from
  the catalog) + new `agentHasCapability(agents, name, cap)` — declaration wins
  when present; falls back to the legacy `isBuildAgent(name)` check when absent
  (older server), so shipping order doesn't matter.
- `@object-ui/app-shell`: the build-doctor drawer + `showDebug` key off
  `'debug'`, the FAB's resume-vs-fresh keys off `'resume'`, HomePage's
  "Build with AI" availability keys off `'authoring'`. The ADR-0063 product-axis
  sites (surface→agent resolver, conversation scope keying, picker availability)
  intentionally stay name-based — capability describes RENDERED behavior, not
  which product an agent is.

A future skill-driven build variant now needs no console change.

---
"@object-ui/app-shell": minor
---

feat(console): hide the AI surface at runtime when the server serves no AI agent (Community Edition)

A self-host Community Edition runtime (framework + this MIT console, without the
cloud `@objectstack/service-ai-studio` package) serves no `ask`/`build` agent.
The console now hides every AI entry point via runtime, server-pushed gating —
no build-time edition flag, no tree-shake.

Crucially, gating is driven off the **agent catalog** (`GET /api/v1/ai/agents`),
not the discovery `services.ai` flag: the open-source framework keeps a headless
`@objectstack/service-ai` that still reports `services.ai` as available, so a CE
runtime can report AI "available" while serving zero agents. The catalog is the
real "is there an agent to answer?" signal.

- New `useAiSurfaceEnabled()` hook + `RequireAiSurface` route guard (exported).
- `/ai*` routes redirect to home when no agent is served; the FAB, top-bar AI
  link and the metadata designers' "Ask AI" buttons hide; `AiChatPage` shows a
  graceful "AI unavailable" state instead of an agent-less echo chat.
- Fully additive for cloud installs — when an agent is served, every AI surface
  renders and works as before.

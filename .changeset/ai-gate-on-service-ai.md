---
"@object-ui/app-shell": patch
---

fix(console): gate the AI surface on the `service-ai` capability (discovery), not the agent catalog

`useAiSurfaceEnabled` now keys off discovery's `services.ai` (`isAiEnabled`) —
i.e. whether the enterprise `@objectstack/service-ai` capability is present —
instead of a non-empty agent catalog.

`service-ai` is an enterprise capability: a Community-Edition runtime doesn't
ship it, so the framework doesn't register the AI service and discovery reports
`services.ai` unavailable → the whole AI surface hides. An install that has
`service-ai` reports it available → AI shows. The presence of the CAPABILITY
gates, not whether a specific agent happens to be configured yet.

The earlier catalog-based gating was a workaround for the headless service
reporting itself available in CE; the framework now only registers the AI
service when the host app declares `@objectstack/service-ai`
(objectstack-ai/framework#2311), so discovery is an honest edition signal and
the catalog detour is no longer needed. Everything else stays: the centralized
hook, the `RequireAiSurface` `/ai` route guard, the gated top-bar link + designer
"Ask AI" buttons, and AiChatPage's graceful empty state.

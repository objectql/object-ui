---
'@object-ui/app-shell': patch
---

fix(console): gate the AI surface on the access-filtered agent catalog (per-user), not the deployment-wide service-ai capability

`useAiSurfaceEnabled` keys off `GET /api/v1/ai/agents` again (>= 1 agent → AI shows), reverting objectui#1992. The agent-catalog route is now access-filtered server-side (ADR-0049 / ADR-0068): it returns only the agents the caller may chat, so a user WITHOUT the per-user AI seat (`ai_seat`) gets an empty catalog and the whole AI surface (FAB, `/ai` routes, top-bar + designer "Ask AI") hides for them — instead of showing a control that 403s on click. The discovery `services.ai` flag is deployment-wide and cannot express per-user seating, so it is the wrong signal for the AI-seat gate. Community-Edition gating is unaffected: no service-ai → no agents → empty catalog → hidden.

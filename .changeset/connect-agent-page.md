---
'@object-ui/app-shell': minor
'@object-ui/i18n': minor
---

feat(setup): "Connect an agent" page widget (`mcp:connect-agent`) — framework#2714 Phase 1, #2363

The interactive body for the plugin-carried Setup page shipped by
`@objectstack/mcp`: the environment's MCP URL (from `/discovery`), per-client
connect cards (claude.ai/Desktop, Claude Code incl. the official plugin,
Cursor one-click deeplink, VS Code, Codex CLI), the SKILL.md download
(`GET /api/v1/mcp/skill`), and show-once API-key minting for headless
callers via the existing `POST /api/v1/keys`. Renders a disabled empty state
when discovery doesn't advertise `routes.mcp` (deployment opted out).
Translations for all nine locales.

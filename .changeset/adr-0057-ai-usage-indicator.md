---
"@object-ui/app-shell": minor
"@object-ui/plugin-chatbot": patch
"@object-ui/i18n": patch
---

feat(console-ai): proactive AI usage indicator in the ChatDock (ADR-0057 #8)

Surfaces remaining AI headroom **before** a send hits the 429 wall, instead of
only learning the limit reactively.

- **AiUsageIndicator** — two meters (build + dataChat) as small progress rings in
  the ChatDock header (desktop rail + mobile sheet). Near-full → an amber
  "running low" hint and a popover with "resets tonight / next cycle" plus the
  upgrade / top-up CTA (reusing the 429 deep-link). D5-safe: fractions and
  qualitative words only, never a token number. Hides itself when the usage
  endpoint is absent (older backend / OSS / no seat).
- **useAiUsage** — fetches the D5-safe per-meter fractions; refetches on the chat
  engine's post-turn / 429 nudge and on tab re-focus; fails soft to nothing.
- **useObjectChat** emits `AI_USAGE_REFRESH_EVENT` on a rejected send (429) and on
  the turn-finish edge so the ring updates right after the user's action.
- i18n: `console.ai.usage.*` in en + zh-CN.

Consumes the cloud `GET /api/v1/ai/usage` endpoint (objectstack-ai/cloud#824).

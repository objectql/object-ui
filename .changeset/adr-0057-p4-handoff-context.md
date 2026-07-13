---
"@object-ui/plugin-chatbot": minor
"@object-ui/app-shell": minor
---

feat(console-ai): ask→build handoff carries conversation context (ADR-0057 P4 / cloud#817)

The P4 "Open in Builder →" handoff previously carried only the build prompt + an
optional package, so the Builder started cold and the user re-explained
themselves. It now also carries the **source `ask` conversation** as context —
ADR-0057 P4 / cloud#817 — so the build agent's first turn starts with the thread
the user already had.

- `@object-ui/app-shell`: both handoff sites (the full-page `AiChatPage` and the
  console FAB) now append `?parentConversationId=<ask thread id>` to the
  `/ai/build` URL. The build surface reads it and forwards it to `useObjectChat`;
  the existing URL-mirror drops it once the build conversation id is minted, so a
  reload never re-carries it.
- `@object-ui/plugin-chatbot`: `useObjectChat` accepts `parentConversationId` and
  sends it as `context.parentConversationId` on the **first turn only** (held in a
  ref, consumed once) — the backend redeems it into the turn's context and the
  client owns history from there. New pure helper `withHandoffContext` (unit
  tested) does the non-mutating `context` merge.

Requires the cloud handoff-context contract (service-ai, cloud#817): the build
agent redeems `context.parentConversationId` into a single system block on its
first turn — ownership-checked, and carrying only the user/assistant text the
user already saw (ADR-0063 governance boundary). Without it the console degrades
cleanly: the id is sent but ignored, and the handoff is a (working) cold start.

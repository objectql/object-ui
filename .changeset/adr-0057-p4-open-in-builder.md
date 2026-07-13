---
"@object-ui/plugin-chatbot": minor
"@object-ui/app-shell": minor
---

feat(console-ai): explicit "Open in Builder →" ask→build handoff (ADR-0057 P4)

When the `ask` agent declines an app-authoring request it now calls the cloud
`suggest_builder` tool (structured decline). The console renders that as an
explicit **"Open in Builder →"** action that opens the full-page build surface
seeded with the handoff prompt — ADR-0063 decline-and-redirect: an explicit,
user-initiated switch, never a silent re-route into authoring.

- `@object-ui/plugin-chatbot`: `detectBuilderHandoff` lifts the
  `{ status:'build_handoff', prompt, packageId? }` result onto the tool
  invocation; `ChatbotEnhanced` renders the "Open in Builder →" card and calls a
  new `onOpenBuilder` prop (disabled when no host wires it).
- `@object-ui/app-shell`: the full-page `AiChatPage` (`ask`) and the console FAB
  wire `onOpenBuilder` to navigate to `/ai/build?package=…&handoffPrompt=…`; the
  build surface seeds that prompt as its first message (auto-sent once the
  conversation is minted), and the URL-mirror strips `?handoffPrompt` so a reload
  never re-sends it. Full ask-conversation context transfer is a later upgrade
  (cloud#817); v1 carries the build prompt + optional package.

Requires the cloud `suggest_builder` signal (service-ai-studio) to light up; the
console degrades cleanly (no card) without it.

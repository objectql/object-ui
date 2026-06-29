---
'@object-ui/plugin-chatbot': minor
---

chore(chatbot): upgrade to Vercel AI SDK v7 / @ai-sdk/react v4

Bump `ai` ^6 -> ^7 and `@ai-sdk/react` ^3 -> ^4. The chatbot's `useChat`,
`DefaultChatTransport`, `UIMessage`/`ChatStatus` usage and the `mapMessages`
parts adapter are all source-compatible with v7 — no code changes required.

Verified: type-check clean, build green, 183/183 unit tests pass on v7.

Part of the org-wide AI SDK v6->v7 / providers v3->v4 upgrade (framework#2464,
cloud#710).

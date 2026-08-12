---
'@object-ui/plugin-chatbot': patch
---

Replace the three `messages as any` casts at the `@object-ui/types` ↔
`@object-ui/plugin-chatbot` `ChatMessage` boundary with one explicit typed
adapter (`toRuntimeMessages` / `authoredToRuntimeMessage`, now exported).

The authoring contract (`ChatbotSchema['messages']`) and the runtime contract
`<ChatbotEnhanced>` renders are both deliberate and deliberately different; the
casts erased ALL of that drift rather than the intentional parts, so a future
vocabulary move would have surfaced as rendering behaviour instead of a type
error. Each narrowing is now named, documented and tested: an authored
`role: 'tool'` message is an assistant message (unchanged rendering — the
implicit fallthrough is now the recorded decision), a `Date` timestamp becomes
its ISO string (one expression, consumed by both the seam and the hook's
`normalizeMessages`), and the legacy tool-invocation states
`'partial-call'`/`'call'`/`'result'` map to their AI SDK v6 equivalents as the
authoring type's own documentation declares — previously they reached the tool
chip unrecognised and rendered a status badge with no label.

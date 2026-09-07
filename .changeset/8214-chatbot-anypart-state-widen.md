---
'@object-ui/plugin-chatbot': minor
---

`uiMessagesToChatMessages` / `uiMessageToChatMessage` now accept `@ai-sdk/react`'s
`UIMessage[]` — the exact input the exported mappers are documented for
(objectui#8214).

**Not breaking.** The parameter type only got looser: every argument that compiled
before still compiles. `minor` rather than `patch` because a published signature
accepts input it refused before, which is a capability a consumer can newly rely on.

`mapMessages.ts`'s local `AnyPart` is written to absorb whatever a producer hands the
mapper — every other member is `string` / `unknown` — but `state` was typed against the
OUTPUT contract (`ChatToolInvocation['state']`, the tool-invocation lifecycle). The AI
SDK's own text and reasoning parts carry `state: 'streaming' | 'done'`, which is not in
that union, so the deliberately-permissive input interface was on that one property
STRICTER than the union it exists to absorb and the whole `UIMessage[]` assignment was
refused (TS2345). An app that followed the README and drove `useChat()` itself had to
add an `as never` / `as any` of its own, permanently disabling checking on that seam.

`AnyPart.state` is now `string`, and the one read site narrows through an `isToolState`
guard whose table is a `Record` over `ChatToolInvocation['state']` — so the output stays
exactly as checked as before, and the table cannot drift from the union it guards.

Small behaviour fix that falls out of the guard: a part carrying an unrecognized state
string (an AI SDK v4 snapshot's `'result'`, say) used to pass through verbatim into
`ChatToolInvocation.state`, fall past every branch in `getToolState`, and render a
finished call as "Running" forever. It now normalizes to `undefined`, which is the
documented "infer from `errorText` / `result`" case.

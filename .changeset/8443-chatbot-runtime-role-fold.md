---
'@object-ui/plugin-chatbot': patch
---

Fold an authored `role: 'tool'` before it seeds the AI SDK store, instead of asserting
it away (objectui#8443).

`useObjectChat`'s `aiInitialMessages` builder wrote `as 'user' | 'assistant' | 'system'`
over the role at both of its arms. The authoring contract accepts `role: 'tool'`,
`normalizeMessages` deliberately does not narrow it, and `renderer.tsx` passes
`schema.messages` straight through as `initialMessages` — so in API mode the store was
seeded with a value outside its own union, declared as one of three roles it was not.

Measured against the real `@ai-sdk/react` 4.0.68 / `ai` 7.0.65 before the change: the
client store holds the out-of-union role verbatim — nothing recognises it, nothing
renders it distinctly — and the SDK's own downstream entry points then reject it.
`convertToModelMessages` throws `AI_MessageConversionError: Unsupported role: tool`, and
`validateUIMessages` throws `AI_TypeValidationError` naming `["system","user","assistant"]`
at `[0].role`. Both legs were read with an in-union control on the identical shape, which
converted and validated cleanly.

Both arms now call `toRuntimeRole(...)` — the package's single expression of this fold
and the named decision of objectui#4399, the same one the render seam already applies:
`'tool'` renders as an assistant bubble. **Behaviour change on the API-mode leg**: an
authored `'tool'` message now seeds the store as `'assistant'` rather than `'tool'`. Its
content, parts and tool invocations are untouched, and the other three roles are
unchanged — `'system'` in particular keeps its own role and its centred pill.

Local mode is deliberately unaffected: an authored `'tool'` role still reaches the hook's
own `messages` surface unchanged and is folded only at the render seam, which is what
`ObjectChatMessage` is a statement about.

Deleting the assertions also re-arms the compile-time tripwire the seam was built to
provide — `chatMessageAdapter.ts` records that "a new authored `role` makes
`toRuntimeRole` unassignable", and an `as` let a future role past these two lines
silently.

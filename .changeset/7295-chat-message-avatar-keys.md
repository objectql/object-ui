---
'@object-ui/types': patch
---

Declare `avatar` and `avatarFallback` on `ChatMessage`, on both faces
(objectui#7295 — the residue of objectui#4424, whose `RuntimeOnlyMessageKeys`
named only the three keys API mode lifts out of the stream, never the two a
human author writes by hand).

`packages/plugin-chatbot/src/index.tsx:173–178` reads
`message.avatar || userAvatarUrl` and
`message.avatarFallback || userAvatarFallback` (and the assistant twins), the
authoring-to-runtime seam spreads every unlisted key through
(`chatMessageAdapter.ts`, `...passthrough`), and the SDUI renderer feeds the
authored `messages[]` straight in — a per-message avatar override renders, is
documented, and no authoring-facing type declared it. `ChatMessage` in
`packages/types/src/complex.ts` has no index signature (objectui#5155,
deliberately — none is added here), so an author annotating
`ChatbotSchema.messages` was told a value that renders is an error (TS2353); the
zod mirror `ChatMessageSchema` is a plain strip-mode `z.object`, so the value
parsed green and was silently DROPPED from the parsed output.

**patch, not minor: the accept set only widens toward what already renders.**
Both keys are optional; no document that validated before stops validating, and
no TypeScript value that compiled before stops compiling. Two verdicts move,
both measured on `446d93d` before the change and both toward the renderer's
behaviour:

- The mirror now KEEPS an authored `avatar` / `avatarFallback` through
  `ChatMessageSchema`, `ChatbotSchema` and `safeValidateSchema` — it stripped
  them before. A consumer that renders the PARSED document (none in this
  repository does; the renderer receives the authored one) sees the override for
  the first time.
- The mirror now REFUSES a non-string value at the key (`avatar: 42` was
  admitted-and-stripped before) — enforcement of the declared type, not a new
  capability.

Same precedent as `CheckboxSchema.wrapperClass` (objectui#6938) and the
objectui#6150 batch. `RuntimeOnlyMessageKeys` in `plugin-chatbot` is untouched;
`SeamChatMessage` inherits the two keys through its `ChatMessage` half. The
three example blocks on `content/docs/plugins/plugin-chatbot.mdx` that PR #7294
left unannotated (`supportChat`, `salesBot`, `multiAgentChat`) are annotated
`ChatbotSchema` again.

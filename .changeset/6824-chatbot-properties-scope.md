---
---

Docs-only fix in `content/docs/plugins/plugin-chatbot.mdx`: the `## Properties` table
was presented as one flat list, but the page documents three registrations
(`chatbot`, `chatbot-enhanced`, `chatbot-floating`) and two of its rows are read by
only some of them, which the table never said (objectui#6824). Measured read points in
`packages/plugin-chatbot/src/renderer.tsx`, per enclosing registration body:
`maxHeight` 1/1/0 and `processVisibility` 0/1/0 across chatbot / enhanced / floating,
against a `placeholder` control that hits all three. The registrations' own `inputs`
declarations agree independently — neither key is offered on `chatbot-floating`, and
`processVisibility` is offered only on `chatbot-enhanced`. Both keys are nonetheless
declared on `ChatbotSchema`, so authoring one on a registration that ignores it
type-checks, parses, and is dropped silently at render time.

Both rows now carry the same bolded scope lead objectui#6687 established on the
`surface` row, and each names what to author instead: a floating chatbot is sized by
`floatingConfig.panelHeight` (a number of pixels, default `520`) — `FloatingChatbot`
additionally pins its inner chat to `maxHeight: '100%'`, so an authored `maxHeight`
would be overridden even if it were forwarded — while `processVisibility` has no
substitute outside `chatbot-enhanced`. A sentence above the table states the default
the other 22 rows rely on (no scope note means all three read it), so the table reads
unambiguously as a whole rather than in two annotated rows against 23 silent ones.

No source or behaviour change; text only.

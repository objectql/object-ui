---
"@object-ui/i18n": patch
"@object-ui/plugin-chatbot": patch
"@object-ui/app-shell": patch
---

fix(i18n): the change card's Confirm button sent text the cloud gate does not accept

The English `console.ai.changesConfirmMessage` was
`"Confirm the changes — apply what you just proposed."`. The cloud confirm gate
(`service-ai-studio` `confirm-gate.ts` `APPROVAL_RE`) recognises
`apply (this|the) change` — **not** "apply what". So the message failed the
gate, and failing the gate is silent: the agent re-proposes instead of applying,
and the Confirm button on the change card simply looks inert.

This affected English conversations **and all eight locales that fall back to
English** for that key. It is now
`"Confirm — apply the change you just proposed."` — singular "the change", so it
still matches if the gate ever tightens to a word boundary. The Chinese string
was always fine (`确认修改` hits the 确认-anchored clause) and is unchanged.

The same literal lives in four places — the locale pack, the
`ChatbotEnhanced` prop default, its doc comment, and the `AiChatPage`
`defaultValue` — and all four are updated together.

**Why the existing guard missed it.** `i18n.test.ts` mirrored only the *Chinese*
clause of `APPROVAL_RE`; the English half was reduced to "starts with Confirm,
contains apply" because nothing in this repo could see the real pattern. That
weaker assertion passed against a string the gate rejected — the guard was
green and the feature was broken.

The mirror is now **verbatim, both clauses**, and drives an `it.each` over every
outbound approval message in both `zh` and `en`. Two supporting tests keep it
honest: one asserting the gate stays narrow (a plain build request like
"帮我搭建一个 CRM" must NOT read as approval), and one asserting
`planAnswerMessage` does *not* match — it answers a structure question and must
never read as blanket approval.

The mirror is duplicated across a repo boundary by necessity (objectui cannot
import from cloud); the comment says so, so the next person changing
`APPROVAL_RE` knows to update it here too.

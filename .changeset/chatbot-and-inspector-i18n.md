---
"@object-ui/i18n": patch
"@object-ui/plugin-chatbot": patch
"@object-ui/app-shell": patch
---

fix(i18n): unconditional Chinese in the chatbot confirm card and the field inspector (objectui#2884, objectui#2885)

Two issues split out of the objectui#2871 survey because neither is a language
*branch* — both are copy that renders in Chinese for every user regardless of
locale.

**objectui#2884 — the confirm-before-change card.** Heading, buttons, hint and
the verb column of each change row were Chinese literals, so an English user
read the whole confirm gate in Chinese. They now follow the same
prop-with-English-default convention the plan card already uses
(`changesTitleLabel`, `changesConfirmLabel`, `changeVerbLabels`, …), with the
console passing translated values from `console.ai.*`.

The serious half was the outbound message. Clicking Confirm sent
`'确认修改，应用你刚才提议的改动。'` unconditionally — an English user's click
told the agent, in Chinese, to apply the changes, and the agent answered in
Chinese for the rest of the thread. That message now routes through the same
`convZh` (conversation-language) switch as `planApproveMessage`, so it matches
the language actually being spoken rather than the UI or a hard-coded literal.

Note this is deliberately *not* "always send English": the repo already decided
outbound agent text follows the CONVERSATION, and the cloud confirm gate
(`service-ai-studio` `confirm-gate.ts` `APPROVAL_RE`) matches on approval
keywords. The Chinese string is unchanged, so that path is byte-for-byte what
the gate already accepted; `i18n.test.ts` now pins it against the mirrored gate
regex alongside the two plan messages.

Also in this component: the error banner's `Response failed` / `Details` /
`Retry` were hard-coded English, and both it and the quota banner used a bare
`t(key)` that renders the raw key when the chat is mounted without an
`I18nProvider`. Both now use `useSafeTranslate`, so they degrade to English
instead of to `chatbotError.title`. The `「…」` corner brackets around the
target-app name are now neutral quotes.

**objectui#2885 — the draft-field suffix.** `ObjectFieldInspector` appended a
bare `(草稿)` to draft objects in the lookup picker — the only Chinese literal
in a 1500-line file where the other 101 strings all go through `t(key, locale)`.
It now reads `engine.inspector.draftSuffix` from the Studio catalog.

The 18 new keys were added to all ten locale packs, so the objectui#2872 part
(a) gap held at 469/471 rather than widening.

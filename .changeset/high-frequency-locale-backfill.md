---
"@object-ui/i18n": patch
---

feat(i18n): translate the four highest-traffic namespaces into the eight trailing locales (objectui#2872 part a)

Backfills `console`, `home`, `topbar` and `layout` — 193 keys × 8 packs, 1,544
strings — so a ja/ko/de/fr/es/pt/ru/ar admin sees the AI console, the home
screen, the top bar and the system navigation in their own language instead of
silently falling back to English.

The gap in those eight packs drops from **469–471 keys to 277–279**. `en` and
`zh` remain at exact parity (2499 : 2499, zero difference in both directions).

This is the "high-frequency namespaces only" strategy from the objectui#2872
discussion, not a full backfill: `grid` (101), `gantt` (58), `dashboard` (25)
and the long tail stay on English fallback and remain tracked there.

**Four keys are deliberately left untranslated**, and that is the load-bearing
part of this change:

```
console.ai.planApproveMessage
console.ai.planApproveDefaultsMessage
console.ai.planAnswerMessage
console.ai.changesConfirmMessage
```

These are not labels. They are the text a button *transmits to the agent*, and
the cloud confirm gate (`service-ai-studio` `confirm-gate.ts` `APPROVAL_RE`)
decides whether that text reads as approval. It recognises Chinese and English
— nothing else. `AiChatPage` therefore selects them by the language of the
CONVERSATION rather than of the UI, and the `t()` call is *expected* to miss in
every non-Chinese pack and fall through to its English `defaultValue`.

Translating them would be an outright regression: a German user's "Build it"
would start sending German, the gate would stop matching, and the agent would
re-propose instead of building — the button looks inert while nothing visibly
errors.

objectui#2900 shipped precisely that bug for `changesConfirmMessage`, which had
been added to all ten packs. **This change removes it from the eight**,
restoring the English fallback. A new guard,
`packages/i18n/src/__tests__/outbound-agent-messages.test.ts`, pins the
invariant in both directions: the four keys must be absent from the eight packs
AND present in `en`/`zh`, while every *other* `console.ai` label must be
translated — so the narrow fix can't be over-applied into an excuse for leaving
surrounding labels in English.

Translations are model-generated and would benefit from native review; the
placeholder set of every string was verified programmatically against the
English source.

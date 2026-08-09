---
"@object-ui/app-shell": patch
---

The AI plan / confirm cards send the agent text in the CONVERSATION's language, not the console UI's (objectui#3896)

#772 / #2884 established the rule and `AiChatPage` states it at the gate:
outbound text follows the conversation, rendered labels follow the UI locale.
Only half of it was implemented. Three of the four outbound messages read

    convZh ? '<Chinese literal>' : t('console.ai.…')

and `t()` is the **UI pack**, so the "not Chinese" branch answered with the UI
locale rather than with English. The fourth, `planAnswerMessage`, had no gate at
all.

Two measured consequences, one in each direction:

- **A zh console holding an English conversation sent Chinese.** The `zh` pack
  defines all four keys, so the `t()` lookup HIT instead of falling through to
  its English default: clicking "Build it" put `确认，开始搭建。` into an English
  thread. Cloud's confirm gate (`service-ai-studio` `confirm-gate.ts`
  `APPROVAL_RE`) recognises both languages, so the build ran — and the agent
  switched the rest of the thread to Chinese. That is objectui#2884's symptom
  with the trigger reversed.
- **The answer chip sent the UI locale in both directions.** Ungated, it put
  `For "…", go with: …` into a Chinese thread — objectui#772's opening complaint
  verbatim — and a Chinese sentence into an English one under a zh console.

All four sites now go through one resolver,
`packages/app-shell/src/console/ai/outboundAgentText.ts`: a Chinese conversation
gets the `zh` pack's value, every other conversation gets the `en` pack's value,
and the UI pack is never consulted. The three console AI surfaces (`/ai` page,
chat dock, Studio copilot) all mount the same `ChatPane`, so all three change
together.

Reading the two packs directly rather than `t(key, { lng })` is deliberate: an
i18next lookup's answer depends on which bundles the host app loaded and on
`fallbackLng`, and a `zh` lookup silently falling back to `en` is exactly the
wrong-language bug above. The per-language fallback table in the resolver is
pinned byte-identical to both packs, so a Chinese conversation falls back to
Chinese — never to English — if a pack ever stops defining a key.

Labels are untouched: they still follow the UI locale, and the pin that fails
when a `*Label` drifts into the conversation gate (objectui#3837) now also fails
when an outbound `*Message` is read back out of the UI pack.

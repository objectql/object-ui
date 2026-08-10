---
"@object-ui/app-shell": patch
---

The plan card's "Building…" badge follows the console UI locale, like every other label on it (objectui#3837)

`AiChatPage` gates four strings on `convZh` — the language of the CONVERSATION,
not of the UI — because the cloud confirm gate (`service-ai-studio`
`confirm-gate.ts` `APPROVAL_RE`) recognises Chinese and English only, so what the
confirm cards SEND has to match the thread it is sent into (objectui#772 /
objectui#2884). The file's own comment above that gate ends with the other half
of the rule: "button LABELS stay on the UI locale."

`planBuildingLabel` (objectui#2632) had drifted onto the wrong side of it, and
handed back a hard-coded `正在搭建…` for any Chinese thread. Two consequences,
both measured:

- **A mixed-language card.** Under an English console, a Chinese thread's plan
  card rendered `Proposed plan` / `Build it` / `Built` / `Not yet built` in
  English with one Chinese badge in the middle. objectui#2458 item 4 recorded the
  reverse direction of the same disease.
- **A dead translation.** A Chinese conversation always took the literal, so the
  zh value of `console.ai.planBuilding` was unreachable for Chinese readers —
  re-wording the pack changed nothing for them. objectui#3546 slice four had just
  backfilled that key into all ten packs (PR #3839) and could only contain the
  defect, by making the zh value byte-identical to the literal and pinning the two
  together.

The badge now reads `t('console.ai.planBuilding', …)` like its twelve neighbours,
so all ten packs are reachable — a German console with a Chinese thread renders
`Wird erstellt…` — and the zh pack is the single source of the Chinese wording
(unchanged: `正在搭建…`, so no Chinese reader sees a different string than before).

The three OUTBOUND strings (`planApproveMessage`,
`planApproveDefaultsMessage`, `changesConfirmMessage`) are untouched and still
follow the conversation: each is passed to `onSendMessage` and read by the gate,
which is the class the `convZh` branch exists for. The slice-four containment pin
in `packages/i18n/src/__tests__/console-namespace-3546.test.tsx` is flipped in the
same change — it now fails if a gate reappears over that label, or if any future
`convZh` read feeds something rendered instead of something sent.

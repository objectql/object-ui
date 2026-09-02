---
'@object-ui/plugin-chatbot': patch
'@object-ui/i18n': patch
---

`AiPendingActionsInbox` speaks the session locale — every string in it, not only its timestamps (objectui#7173).

The AI HITL approval inbox held its own relative-time helper returning hardcoded
English (`'just now'`, `` `${min}m ago` ``), so a zh / ja / ar session read English
relative times on every row. It is the fifth spelling of that helper in the repo,
and the file had **no translation wiring at all** — the unwired-component shape,
not the lookup-swap shape.

It is therefore swept whole. objectui#7142 wired one string into an otherwise
untranslated component and shipped something visibly half-done, and objectui#7149
is what finishing that afterwards cost; the triage ruling on this card (2026-09-01)
carried that forward as *sweep the file whole or leave it*. Everything the user can
read now resolves from the locale packs: the card heading and description, the three
tabs, the refresh button, all five status badges, the six column headings, the empty
state, the row and drawer buttons, all nine drawer field labels, the outcome banner
and the whole reject-reason dialog.

**No new rows for the four relative-time branches.** `detail.justNow`,
`detail.minutesAgo`, `detail.hoursAgo` and `detail.daysAgo` already existed,
translated, in all ten packs, and cross-package key borrowing is this repo's settled
convention rather than an open question — `ObjectGrid`, `ObjectKanban`, `ObjectTree`,
`ListView`, `ObjectView`, `NavigationOverlay`, `RecordAttachmentsPanel`,
`RecordDetailView` and `apps/console` all resolve `detail.*` from outside
`plugin-detail`. One phrase on one kind of control should not get a second
translation that can drift from the first.

The rest of the sweep needed copy no pack had, so `@object-ui/i18n` gains an
`aiApprovals` namespace: 38 keys, translated in all ten packs. It is deliberately
separate from `approvalsInbox`, which is the human approval-**process** inbox — a
different surface and a different feature, so no rows are shared with it. Four
generic verbs are reused rather than forked (`common.refresh`, `common.cancel`,
`common.loading`, `common.ok`).

**⛔ The five relative-time helpers are not unified.** They differ in real behaviour
— `Math.round` here against `Math.floor` in `plugin-detail`, thresholds 45s/30d
against 60s/7d, different tails — so normalising them is a behaviour change wearing
a refactor's clothes and needs its own card. This inbox's arithmetic is untouched,
and three rows in the new suite exist only to pin it: 50s renders `1m ago` (a 60s
threshold would still say "just now"), 90s renders `2m ago` (`Math.floor` gives
`1m ago`), and 20d renders `20d ago` (a 7d threshold would already show a date).

Two assembled English sentences became single interpolated keys — the outcome banner
(`Approve for {{id}}: {{message}}`) and the drawer subtitle
(`Tool {{tool}} on {{object}}`). Their word order differs per locale, which fragments
around a `<code>` element cannot express, so the two identifiers lose their monospace
styling. That is the deliberate cost of making those sentences translatable.

Evidence: an `en`-only assertion cannot discriminate here, because each key's `en`
value is byte-identical to the literal it replaced. The suite asserts in **zh and
ar**, and the provider-less path separately, in its own file (`createI18n` installs
itself as react-i18next's module-level global, so a provider-less render in a file
that has already mounted a provider silently reads that pack instead of the defaults
map). No inline `defaultValue` anywhere (objectui#3517).

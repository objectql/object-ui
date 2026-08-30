---
'@object-ui/i18n': patch
---

The zh pack's `console.breadcrumb.reports` renders 报表, the noun the rest of the pack
already uses for the report feature (objectui#6166).

**The authority for this edit is the maintainer ruling of 2026-08-25, not an occurrence
count.** The card was filed explicitly as a native-speaker call and explicitly forbade
resolving it by normalising to the majority: 报表 (a tabular/data report) and 报告 (a
written/narrative report) are not interchangeable, so a pack that spells one key
differently from its siblings is evidence of a majority and never, on its own, evidence of
a mistake. The maintainer ruled that no deliberate narrative-report distinction was
intended here and that the breadcrumb names the same report feature the rest of the pack
calls 报表.

The render context corroborates the ruling and closes the confidence gap triage recorded
when it declined to decide this itself. `console.breadcrumb.reports` labels the
`routeType === 'report'` **list** route in app-shell's `AppHeader` — a structural sibling
of the `dashboards`, `pages` and `system` segments beside it — and drilling through it
appends a metadata report definition, the same feature named by
`console.commandPalette.reports`, `console.nav.navReport`, `search.typeReports`,
`search.badgeReport` and `search.reportNotFound`. Nothing narrative renders beneath it.

A comment at the key records that this was **ruled** rather than counted, and states the
报表/报告 distinction it was ruled against, so the next reader measuring pack consistency
neither re-files it nor quietly restores 报告 after reading the render context and
disagreeing. That comment is half of the deliverable; the value change alone would leave
the decision unrecorded, which is the failure mode the card was most concerned about.

**Scope: one key, one pack.** This is not a licence to normalise vocabulary across the ten
packs — the card names that hazard explicitly and says it would need its own ruling, and
this ruling grants nothing beyond the single key it names. No `en` value changes, so no
other pack is asked to follow, and no other pack was touched.

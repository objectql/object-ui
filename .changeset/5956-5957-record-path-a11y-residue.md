---
'@object-ui/plugin-detail': patch
'@object-ui/i18n': patch
---

`record:path` finishes localizing and de-colouring its accessible names — the two residues
objectui#5916 named and deliberately left behind (objectui#5956, objectui#5957).

**The list's own label was English on a localized surface, and the other one named nothing.**
Both the desktop and the mobile `role="list"` row did
`aria-label={schema.aria?.label || 'Record path'}`, so a zh/ja/ar session heard `Record path`
for the list while every stage inside it announced in the session locale — one control
speaking two languages at once. The fallback is now `detail.pathLabel`, translated in all ten
packs; the `schema.aria.label` author override still wins ahead of it.

The lost-terminal alt group was a different defect wearing the same clothes: its
`aria-label="Alternative terminal stages"` sat on a bare `div`, which has the `generic` role,
and browsers expose no accessible name on a generic element. That string reached nobody —
inert, not merely untranslated — so translating it would have shipped copy to ten packs that
no user can hear. It is removed rather than given a role that takes a name, on three
measurements: nothing is lost (it was never announced), it would be redundant (every stage
inside already announces `closed lost` in the session locale after objectui#5916, in the one
place `role="list"` can carry it), and it would fork the two rows (the mobile row renders one
flat list with no alt group, so a named group would make one control expose two structures by
viewport).

**An unreached goal terminus was distinguished by hue alone.** `railClass` paints it
`bg-emerald-500/30` where a plain upcoming stage gets `bg-muted` — the renderer's own note
calls this "a faint emerald so the goal is legible" — while both announced the identical
`{{stage}}, upcoming`. Two stages ahead of the record painted differently and read the same:
the WCAG 2.2 SC 1.4.1 class objectui#5916 closed, on the one distinction it left behind, and
reachable without authors opting in because `classify()` finds `won` through the `WON_TOKENS`
heuristic as well as an explicit `terminal: 'won'`. New key `detail.pathStageWonUpcoming`
(`{{stage}}, goal stage, not reached`), translated in all ten packs.

Scoped to the UNREACHED goal, which is a measurement of the stylesheet rather than a
preference: a reached goal terminus paints `bg-primary` when current and `bg-emerald-500` when
completed, byte-identical to any other current or completed stage. Naming it apart would hand
a screen reader a distinction the screen does not make — the mirror image of the defect — so
it is one new key, not a pair, and a test pins that decision so it cannot drift into a fourth
state unnoticed.

Both new keys also land in `DETAIL_DEFAULT_TRANSLATIONS`, which
`defaults-maps-mirror-en-pack` compares against the `en` pack key by key, so neither can fork
between a provider-mounted console and a provider-less embed. No existing `en` value changes,
so no pack is asked to follow an edit.

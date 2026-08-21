---
'@object-ui/i18n': patch
---

`setLocalized`'s published docblock states the single-locale write rule that is
actually in force, instead of deferring the multi-locale-authoring question to a
closed card (objectui#5591).

The docblock read "is not a multi-locale authoring UI (objectui#4163)". objectui#4163
closed as completed on 2026-08-15 with that product question still unanswered, so the
parenthetical pointed at nothing — and it read as though the question had been settled
somewhere a reader could go and check. This is the failure mode objectui#5428
demonstrated is not harmless: there, a dangling deferral of exactly this shape let an
expired justification sit unread for a release cycle at two surfaces.

The remedy is objectui#5428's, not a re-pointing at a successor card: state the rule in
force (`setLocalized` reaches only the entry for the locale the author is in), keep the
open product question open **in place**, and record why there is deliberately no tracker
reference — so the next reader cannot restore one. Re-pointing is how the class
regenerates, because the next card closes too. The same wording form already landed in
`plugin-designer`'s `writeWidgetTitle` and `DashboardWidgetInspector`.

Prose only. No behaviour, no signature, no test changes — `setLocalized`'s pairing with
`pickLocalized` is unchanged and still pinned by `src/__tests__/setLocalized.test.ts`.

Declared as a `patch` for `@object-ui/i18n` alone because the emit was measured per
package rather than assumed, and the two packages this change touches differ:

- `@object-ui/i18n` — the docblock sits on the **exported** `setLocalized`, so it reaches
  the published artifacts. Rebuilt with `tsconfig.tsbuildinfo` cleared first (the build is
  `composite`, which otherwise skips emit), and compared by SHA-256 rather than byte count:
  `dist/pickLocalized.d.ts` `1e2170ad…` -> `124a1c07…` and `dist/pickLocalized.js`
  `06eb88bd…` -> `568cb703…`. A consumer reads this text on hover and in the API docs, so
  it publishes something.
- `@object-ui/plugin-dashboard` — the two comments changed there are a `//` banner between
  declarations and a test docblock, neither attached to an exported declaration.
  `dist/WidgetConfigPanel.d.ts` is **byte-identical** across the rebuild
  (`93252e8cdf5a6faa…` both sides). The only artifact that moved is
  `dist/WidgetConfigPanel.d.ts.map`, whose mappings shift because lines were added above
  the declarations; no declaration text changed. Nothing user-visible publishes from that
  package, so it is not named here.

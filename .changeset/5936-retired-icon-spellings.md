---
'@object-ui/components': patch
'@object-ui/plugin-detail': patch
---

Correct two retired lucide spellings on component-registration `icon` meta
(objectui#5936, the behaviour-neutral slice).

`ui:page` declared `icon: 'Layout'` and `record:alert` declared
`icon: 'AlertTriangle'`. lucide retires a spelling by dropping it from the runtime
`icons` record while keeping the deprecated named export, so both names still
import and still type-check while resolving to nothing through any resolver that
reads that record. They are now the live keys `panels-top-left` and
`triangle-alert`.

**Behaviour-neutral by identity, in every resolution world.** The retired export
and the live record entry are the SAME OBJECT — measured against the installed
lucide 1.31.0, not asserted: `Layout === icons['PanelsTopLeft']` and
`AlertTriangle === icons['TriangleAlert']` are both true. So the repair cannot
substitute one glyph for another; it can only turn a name that resolves to
nothing into one that resolves to the glyph it always meant.

- Through a record-reading resolver (`renderers/action/resolve-icon.ts`), the old
  spellings resolve to `null` and the new ones to that shared object.
- Through the dynamic surface (`iconNames`, 2025 names, retired aliases included),
  both spellings already resolved, and to the same glyph.
- The kebab spellings were chosen because they are the only ones live on BOTH
  surfaces: `PanelsTopLeft` and `TriangleAlert` are record keys but are absent
  from `iconNames`, which is kebab-case only.

Nothing is retired and no gate is extended here. `check-lucide-icon-record-names.mjs`
deliberately does not judge a registration's `icon` meta, and it stays that way —
its verdict is unchanged by this diff (182 names judged, green, both before and
after). Whether the registration `icon` meta itself should be retired is the open
half of objectui#5936 and is a maintainer decision under ADR-0049.

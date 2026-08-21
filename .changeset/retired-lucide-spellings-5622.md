---
'@object-ui/plugin-detail': patch
'@object-ui/components': patch
'@object-ui/plugin-list': patch
---

Repair five retired lucide icon spellings that reach a record-reading resolver, and pin
the names against the runtime `icons` record so the next lucide bump goes red instead of
silently blanking a glyph (objectui#5622).

lucide retires a spelling by dropping it from its runtime `icons` record while KEEPING it
as a deprecated named export. A retired name therefore still imports, still type-checks,
and still renders wherever it is used as a COMPONENT — and resolves to `null` wherever it
is used as a STRING, because every string lookup here reads that record. Nothing goes red
either way. Measured against the installed `lucide-react@1.31.0` (1767 record entries) at
implementation time.

What a user sees change:

- `DetailView`'s mobile Edit action (`icon: 'edit'` → `'square-pen'`) draws its icon
  again. Its items become an `action:bar` schema whose renderers resolve `icon` through
  `renderers/action/resolve-icon.ts`, so the touch-breakpoint edit affordance had been
  drawing a label with nothing beside it. `Edit === SquarePen`, so the glyph is unchanged.
- The `ui:icon` renderer's own declared default (`'smile'` → `'face-slightly-smiling'`, in
  both the registration `icon` and the `name` input's `defaultValue`) resolves again: the
  designer palette entry's glyph was blank, and an `icon` dropped from that palette
  rendered nothing plus a `console.warn`. `Smile === FaceSlightlySmiling`, so the palette
  looks exactly as it did.
- `plugin-list`'s `ViewSwitcher` moves `Grid` → `Grid3x3`, `BarChart3` → `ChartColumn`
  (both identical objects, no visual change) and `GanttChartSquare` → `ChartGantt`. The
  gantt one IS a glyph change: it matches the spelling the sibling `plugin-view` switcher
  landed in objectui#5586, so one view type no longer draws two different icons depending
  on which switcher is on screen.

Four resolvability pins are added — in `plugin-detail`, `plugin-list`, `components` and
alongside the `DeclaredActionsBar` fixtures. Each asserts `icons`-record MEMBERSHIP rather
than resolvability, because every retired spelling repaired here is the SAME component
object as its replacement (`Edit === SquarePen`, `Smile === FaceSlightlySmiling`,
`Grid === Grid3x3`, `BarChart3 === ChartColumn`, `CheckCircle === CircleCheckBig`,
`XCircle === CircleX` are all true): a pin that rendered the glyph, or reached for the
export, would pass on the broken name. That is the blindness that let this ship.

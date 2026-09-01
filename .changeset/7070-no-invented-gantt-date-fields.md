---
'@object-ui/app-shell': minor
'@object-ui/plugin-list': minor
'@object-ui/plugin-view': minor
---

Gantt views no longer render on invented date field names (objectui#7070).

The half PR #7062 fenced out and reported separately. A view that carried no
`gantt:` block used to have a complete-looking date axis synthesized for it:
all three faces floored `startDateField` at `'start_date'` and `endDateField`
at `'end_date'` — field names no view had written and most objects do not
carry.

`ObjectGantt.getGanttConfig` takes its flat branch as soon as BOTH date props
are present, so the fabricated pair short-circuited the renderer's own refusal
screen — "Gantt configuration required. Please specify startDateField,
endDateField, and titleField." — which existed all along and was simply
unreachable from every route. The same fabrication answered ADR-0047's
capability gate in `ListView.availableViews`, so the Gantt toggle was live on
every object view in the product.

⚠️ The premise was MEASURED before anything was deleted, because #7029's
mechanic is only correct where a refusal path exists and that had never been
established for this renderer: on the unmodified tree, `ObjectGantt` REFUSES an
absent binding — it does not render empty, and it does not throw.

Three faces were fabricating, on two independent routes to the same renderer:

- `app-shell/src/views/ObjectView.tsx` — the console object page. The inline
  branch becomes `ganttViewOptions`, the sibling of `calendarViewOptions` and
  `timelineViewOptions`: the declared block spread whole, title floored at
  `'name'`, no date field invented.
- `plugin-list/src/ListView.tsx` — the render branch AND the capability gate.
- `plugin-view/src/ObjectView.tsx` — `generateViewSchema`, the authored
  `object-view` element route, which bypasses `ListView` entirely.

**What changes for an author.** A view that declared no gantt configuration is
no longer offered the Gantt toggle, and one forced onto the renderer reaches
the refusal screen instead of a plausible, fully wrong chart. A view that
declared a binding is unaffected — the declared block is forwarded exactly as
before, every spec key included.

Also corrected: the objectui#3129 note at the top of `app-shell/ObjectView.tsx`
certified the gantt branch below it as already using the safe two-rung shape.
It did not. The note now states each sibling branch as measured, and says
explicitly which fabrication REMAINS — the timeline `'created_at'` floor at the
two plugin faces, which objectui#7070 routes to a ruling rather than settling
per-face.

Deliberately out of scope, and left in place: `progressField` / `dependenciesField`
(not date axes, different absent-value semantics) and the timeline `'created_at'`
posture conflict.

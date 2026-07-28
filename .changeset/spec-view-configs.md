---
"@object-ui/types": patch
"@object-ui/plugin-list": patch
"@object-ui/plugin-view": patch
"@object-ui/app-shell": patch
---

fix(views): the five per-view-type configs speak the spec vocabulary (#2231 phase 3)

`kanban`/`calendar`/`gantt`/`gallery`/`timeline` on `ListViewSchema` were the last
hand-written forks left after #2882 — and the fork was not cosmetic: objectui named
the same concepts differently from `@objectstack/spec/ui`, and several read-sites
only understood one of the two dialects. Two of those gaps were live bugs.

**Kanban lanes ignored the spec key.** `ListView` gated the Kanban tab on
`groupByField || groupField` but rendered lanes off `groupField` alone. A config
authored with the spec key — which is exactly what the product's own
`CreateViewDialog` emits — offered the tab and then grouped by whatever
`detectStatusField()` guessed. The spec's `columns` (the fields shown on each card)
was also spread onto the board verbatim, where `columns` means *lanes*, so
`ObjectKanban` built lanes with `undefined` id and title. `columns` now maps to
`cardFields` and the vocabulary keys are stripped from the passthrough.

**Timeline lost every spec key in app-shell.** `ObjectView`'s `timeline` branch was
a three-key whitelist while its `gallery`/`gantt` siblings had already been fixed to
spread-first, so a stored `timeline: { startDateField, endDateField, groupByField,
colorField, scale }` arrived with only `titleField` and an axis pinned to the
`'due_date'` fallback.

Also: `plugin-view`'s `ObjectView` now reads `gallery.coverField` and
`timeline.startDateField` (it only understood the legacy aliases), and the dead
`gallery.subtitleField` is removed — three producers computed it and `ObjectGallery`
never read it.

The schema side now derives from the spec configs (`.partial()`, since the product
authors partial configs and spec marks `columns`/`titleField`/`startDateField`
required). `gantt` needed no local schema at all. The pre-#2231 names
(`groupField`, `cardFields`, `imageField`, `dateField`) remain accepted as deprecated
aliases so stored views keep validating; the spec key wins wherever both appear.
`calendar.defaultView` stays local — it has no spec counterpart.

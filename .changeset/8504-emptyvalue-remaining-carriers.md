---
'@object-ui/app-shell': minor
'@object-ui/plugin-dashboard': minor
'@object-ui/plugin-grid': minor
'@object-ui/plugin-chatbot': minor
'@object-ui/console': minor
---

Six hand-rolled em-dash placeholders now draw the shared `EmptyValue` from
`@object-ui/components` (objectui#8504), closing the *no accessible name* half
of the class objectui#8491 / PR #8503 opened.

**The accessibility defect.** Each site built its own `<span>` holding a bare em
dash. `EmptyValue` carries three things none of them had: a `data-slot` of
`empty-value`, an `aria-label` resolved through the i18n label hook, and
`select-none` / `no-underline` / `pointer-events-none`. So a screen-reader user
reaching one of these cells heard a naked punctuation mark, while a neighbouring
cell drawn by a type-aware renderer was announced as "No value". Two of the
sites make the inconsistency reachable inside one surface: the metadata list
renders column 0's placeholder *inside the row's `<Link>`*, where the
hand-rolled span inherited the link colour and stayed selectable, and the
dashboard record drawer sits next to renderers that already returned the shared
component.

The six: the metadata list's `defaultCell` and the Audit tab's lock column
(`@object-ui/app-shell`), the dashboard record drawer's empty `<dd>`
(`@object-ui/plugin-dashboard`), the import wizard's saved-mapping transform
cell (`@object-ui/plugin-grid`), the AI-approvals `JsonBlock`
(`@object-ui/plugin-chatbot`), and the Public Forms object column
(`@object-ui/console`).

**A deliberate visual change, not a no-op.** Five sites drop
`text-muted-foreground` (or `/60`) for the shared `text-muted-foreground/50`, so
every placeholder in the workspace is now one colour. The glyph is unchanged
everywhere. The sixth, `JsonBlock`, keeps its `text-xs` through `className`
because it stands where a `text-xs <pre>` would and has no shared neighbour to
match — its delta is the accessible name and the three affordances only.

**Two adjacent lines in the same file, taken deliberately.** The AI-approvals
drawer's `proposed_by` / `decided_by` fields fell back to a bare `'—'` text node
inside a plain `<div>` — a different source spelling of the same rendered
defect, individually verified on the card rather than swept up. They are
converted too. `formatRelative`'s `if (!s) return '—'` is not: that helper is
declared `: string`, so its fallback is not a node.

Filled values are untouched in every path.

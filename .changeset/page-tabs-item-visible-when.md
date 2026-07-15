---
"@object-ui/components": minor
---

Conditional tabs (framework#2606): the `page:tabs` renderer honors an item-level
`visibleWhen` CEL predicate — when it evaluates FALSE the WHOLE tab (header +
panel) is omitted from the strip, unlike a child component's own `visibleWhen`,
which hides only the panel content and leaves an empty tab header behind. The
predicate binds the same environment as page-component `visibleWhen` (record
fields bare and via `record.`/`data.`, `user`/`current_user`, and page state as
`page.<var>`) and re-evaluates live as page variables change. The strip is now
controlled: when the ACTIVE tab's predicate flips false, selection falls back to
the first visible tab instead of leaving a blank panel, and the user's own
selection is restored if the tab becomes visible again. Canonical ADR-0089 key
only — the deprecated `visibility`/`visibleOn` aliases are not read on this new
surface. Items without `visibleWhen` behave exactly as before.

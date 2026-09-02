---
'@object-ui/components': patch
---

Stop the record header title from collapsing when the action tail is wide

The `page:header` record header laid the title column and the action tail out
in a `flex-nowrap` row. The tail is `shrink-0`, so the title column — the only
flexible item — absorbed the entire width deficit. On a record carrying three
labelled `record_header` actions plus the `⋯` and `⟳` chrome, a 799px viewport
left the title column 29.5px of a 687px header and the `h1` rendered as a
single character and an ellipsis, while the breadcrumb above it still showed
the full record name.

The title column now carries a 12rem floor and the header may wrap at `sm` and
up, so a tail that cannot fit alongside a readable title drops to its own line
instead of starving it. Below `sm` the header is already a column and is
unchanged. Headers whose tail already fits keep their single-line layout.

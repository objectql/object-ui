---
"@object-ui/plugin-detail": minor
---

fix(detail): a related list has one sorting semantics instead of two — #3106

A related list carried two. Its own sort-button row (opt-in via `sortable`) went
out as a server `$orderby` over the whole child collection; the `data-table` it
embeds took `sortable`'s default of `true` and sorted the rows it was holding —
which, in windowed mode, is **one page**.

Turning `sortable` on put both in the same card, with nothing saying they meant
different things. Leaving it off — the default — was worse: the page-local sort
was then the *only* one the user could reach, and it looked exactly like the
list being sorted.

The table's column headers now drive this list's sort in both modes, so there is
one order behind them:

- **Windowed**: the header sort becomes the server `$orderby` and resets to page
  one, the same path the buttons took.
- **Client mode**: this list keeps sorting in memory, where its key is the label
  resolved through its own id → name map (#3096) — a key the embedded table
  cannot see, so its sort was the worse of the two even when both were possible.

The button row survives only where there are no headers to click: a `list`
(`data-list`) related list, or a caller-supplied `schema` whose contents we
cannot assume. `sortable`'s documentation now says that is what it controls.

Relational columns keep #3096's rule, moved to the header: no sort affordance
while the sort is a server `$orderby` (the key would be the stored foreign-key
id while the cell shows a name), live in client mode where the key is the label.

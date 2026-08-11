---
'@object-ui/plugin-list': patch
---

A list emptied by the view's own filter says "no records match", instead of inviting you to create your first record

`ListView`'s empty state distinguishes "filtered to empty" from "truly empty (first run)", but the view's own declared `filter` did not count toward that decision — only the search term, the user-filter conditions and the toolbar's live filter group did. A view that returns nothing *because it is filtered* therefore rendered the first-run copy over an object full of records.

That is a small string, and it cost real triage time. In objectui#4155 a stored overlay filter had emptied a list, and the screen said "no data yet / create your first record" — so the report read as data loss or a permission problem, and the investigation went to the data and permission layers rather than to the view layer where the defect was. The same misread is available without any bug at all: a perfectly healthy view declaring `status not_in [archived, deleted]` over an object whose rows are all archived told the user the object was empty.

The base `filter` now counts as an active query, in both at-rest shapes (an array of conditions, and the Mongo-style object form). No new copy — this only routes to the `list.noMatches` / `list.noMatchesMessage` strings that already exist in all ten locales, so there are no new keys to translate. An author-supplied `emptyState.title` / `emptyState.message` still wins over both branches, unchanged.

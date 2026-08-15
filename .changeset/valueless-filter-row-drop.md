---
'@object-ui/components': patch
'@object-ui/plugin-list': patch
'@object-ui/app-shell': patch
---

Fix a list filter that silently applied nothing when the first thing you picked was **Is null** or **Is not null**.

Adding a filter seeds the row with no value, and changing the operator keeps it that way — which is correct for an operator that takes no value, since the panel draws no input for one. The live grid read that row as unfinished and dropped it: the filter appeared in the panel, the query went out without it, and every record came back with no error to explain it. Only `Is empty` / `Is not empty` were exempt; the builder renders six operators value-less.

Which operators are complete without a value now has a single owner — `VALUELESS_FILTER_BUILDER_OPERATORS`, exported from `@object-ui/components` beside the code that decides it. The live grid and the saved-view fold both read it instead of keeping their own lists, so the two halves of one interaction can no longer disagree about whether a row is finished.

---
'@object-ui/app-shell': patch
---

Using a list's filter panel no longer overwrites the view's source-declared `filter` for everyone

Opening a Console list view's filter panel and clicking **Add filter** wrote a view-customization overlay into `sys_metadata`. The row that button inserts is incomplete by construction — `{ field: <first column>, operator: 'equals', value: '' }` — and a view override is merged over the source-declared view key-wise (`{ ...source, ...override }`), so that one stray condition became the view's *entire* `filter`. The list then came back `total: 0` on every subsequent visit, for every user of the view, and the panel's own **Clear all** could not undo it: clearing wrote `filter: []`, which is still an override that deletes the source declaration. Recovery required deleting the `sys_metadata` row and restarting the service.

Two independent changes, because the defect had a write half and a read half.

**The write is gone.** `persistViewFilter` and both `onFilterChange` persist bindings are removed: a filter-panel interaction is transient state belonging to the session and to `writeListFilterState`'s per-browser restore, never to the view's stored body. The threshold for writing a view overlay is now an explicit save — `handleViewConfigSave`, and `ObjectDataPage`'s "Save as view". `ObjectDataPage` had already made exactly this call for the sibling surface ("Deliberately NO onSortChange/onFilterChange persistence hooks", #2251); this surface was the outlier. The surviving handler still writes localStorage, so the panel is not amnesiac — it just no longer speaks for every other user of the view. `foldFilterGroupToSpecRules` (objectstack#5159) survives untouched and is still the one dialect for the explicit paths; what was removed is the automatic write, not the fold.

**Already-poisoned installs self-heal on read.** `sanitizeViewOverride` runs on both branches of `loadViewOverrides` and strips conditions an overlay must never impose — an empty value against an operator that wants one, in both the spec `ViewFilterRule` shape and the legacy runtime triple — then drops the `filter` **key** entirely when nothing effective survives. Dropping the key rather than writing `[]` is the whole point, and the merge semantics are measured in the tests rather than assumed: `filter: []` wins the spread and blanks the declaration, whereas no `filter` key falls through to it. So a stored `field equals ""` and a stored `filter: []` both stop overriding, and the source filter wins again on the next load — no `sys_metadata` surgery, no restart.

One consequence is deliberate and worth naming: an overlay can no longer express "this view has NO filter" over a source view that declares one. That is the strictly safer side of the trade, because the shape that expressed it is the same shape that silently erased source declarations; an author who genuinely wants no filter edits the view, which writes the view body rather than an overlay.

The existing objectstack#5159 ratchet is retargeted rather than deleted — it now asserts that *no* filter reaches the view-config persist path, that the `persistViewFilter` seam does not exist to be called, and that no `onFilterChange` handler reaches any persist call, with the explicit-save path pinned alongside as a control.

---
'@object-ui/plugin-detail': patch
---

`record:alert`'s `visible` predicate no longer logs a spurious `record is not
defined` evaluation-failure warning during the record-detail loading frame.

The predicate is evaluated on every render (Rules of Hooks), including the
frame before `useRecordContext().data` has loaded. In that frame `record` is
unset, `usePredicateRecordContext` binds an empty context bag by design (no
`record` key at all), and a bare/`${…}` predicate referencing `record.*`
faulted with `record is not defined` — logged via `console.warn` on every
page load, even the correct, working ones, because the SAME predicate
resolved fine one frame later once `record` populated. The banner's own
visibility was never wrong (it already hides unconditionally while unloaded);
only the diagnostic was permanently misleading on the happy path.

The predicate is now skipped while `record` hasn't loaded — the same
condition the banner's own "hide while unloaded" early return already used —
since its verdict in that frame was never consulted anyway. A predicate that
is genuinely broken (bad field, bad syntax) still faults, and still logs, on
every frame once `record` is populated (objectui#5776).
